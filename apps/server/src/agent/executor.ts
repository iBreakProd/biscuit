import { StepSummary, AgentEvent, Citation } from "@repo/zod-schemas";
import { PlannedStep } from "./planner";
import { vectorSearchTool } from "../tools/vectorSearch";
import { driveRetrieveTool } from "../tools/driveRetrieve";
import { webSearchTool } from "../tools/web_search";
import { webScrapeTool } from "../tools/web_scrape";
import { generateStepThought } from "../llm/openai";

export type AgentEventInput = Omit<AgentEvent, "id">;

/**
 * Executes a list of planned steps while enforcing:
 * - Max 7 steps (ignore extras)
 * - 60 seconds (1 minute) total runtime limit
 *
 * Per-step flow (spec §11.2):
 *   1. Emit step_executing (with predicted tool + planned thought)
 *   2. Determine which tool to call via keyword routing
 *   3. Call LLM to generate a short reasoning thought (generateStepThought)
 *   4. Emit reflecting with that thought
 *   5. Execute the tool
 *   6. Emit step_complete with observationSummary + toolsUsed
 */
export async function executePlannedSteps(args: {
  taskId: string;
  userId: string;
  inputPrompt: string;
  steps: PlannedStep[];
  appendEvent: (event: AgentEventInput) => Promise<void>;
  citationsAccumulator?: Citation[];
}): Promise<{ stepSummaries: StepSummary[]; timeoutReached: boolean; maxStepsReached: boolean }> {
  const { taskId, inputPrompt, steps, appendEvent } = args;
  const startTime = Date.now();
  const MAX_RUNTIME_MS = 60 * 1000;

  const stepSummaries: StepSummary[] = [];
  const boundedSteps = steps.slice(0, 7);
  let timeoutReached = false;
  let maxStepsReached = false;

  for (let idx = 0; idx < boundedSteps.length; idx++) {
    const step = boundedSteps[idx];
    if (!step) continue;

    // Check runtime budget
    if (Date.now() - startTime > MAX_RUNTIME_MS) {
      console.warn(`Task ${taskId} timed out in executor loop`);
      timeoutReached = true;
      break;
    }

    const textToCheck = (step.title + " " + (step.description || "")).toLowerCase();

    // Determine which tool this step plans to use (for step_executing metadata)
    const predictedTool = determinePredictedTool(textToCheck);

    // 1. Emit step_executing with the predicted tool and the plan's description as initial thought
    await appendEvent({
      taskId,
      type: "step_executing",
      timestamp: Date.now(),
      stepIndex: step.index,
      totalSteps: boundedSteps.length,
      title: step.title,
      thought: step.description,
      tools: predictedTool ? [predictedTool] : [],
      progress: {
        currentStep: idx + 1,
        totalSteps: boundedSteps.length,
        completedSteps: idx,
      },
    });

    // 2. Generate a real LLM thought for this step (spec § 11.2: "Ask LLM which tools to call and its current thought")
    const llmThought = await generateStepThought(step.title, step.description, predictedTool || "none");

    // 3. Emit reflecting with the LLM-generated thought (per-step, not just at finalization)
    await appendEvent({
      taskId,
      type: "reflecting",
      timestamp: Date.now(),
      stepIndex: step.index,
      thought: llmThought,
      title: `Thinking about step ${step.index}: ${step.title}`,
    });

    let observationSummary = `No tool needed for step ${step.index}: ${step.title}`;
    let toolsUsed: string[] = [];

    // 4. Dispatch to the appropriate tool
    if (textToCheck.includes("vector")) {
      try {
        const results = await vectorSearchTool({ query: inputPrompt + " " + step.title });
        if (results.hits.length > 0) {
          observationSummary = `vector_search returned: ${results.hits.map((h: any) => h.text).join(" | ")}`;
        } else {
          observationSummary = "vector_search returned no results.";
        }
        toolsUsed.push("vector_search");
      } catch (error: any) {
        observationSummary = `vector_search failed: ${error.message}`;
        toolsUsed.push("vector_search");
      }
    } else if (
      textToCheck.includes("drive") ||
      textToCheck.includes("document") ||
      textToCheck.includes("file") ||
      textToCheck.includes("retrieve")
    ) {
      try {
        console.log(`[executor] Invoking drive_retrieve for userId=${args.userId}, query="${(inputPrompt + " " + step.title).substring(0, 80)}"`);
        const results = await driveRetrieveTool({ query: inputPrompt + " " + step.title, userId: args.userId });
        if (results.citations.length > 0) {
          observationSummary = `drive_retrieve returned: ${results.formattedSnippet}`;
          if (!args.citationsAccumulator) args.citationsAccumulator = [];
          args.citationsAccumulator.push(...results.citations);
        } else {
          observationSummary = "drive_retrieve returned no results.";
        }
        toolsUsed.push("drive_retrieve");
      } catch (error: any) {
        console.error(`[executor] drive_retrieve THREW:`, error?.message || error);
        observationSummary = `drive_retrieve failed: ${error.message}`;
        toolsUsed.push("drive_retrieve");
      }
    } else if (textToCheck.includes("scrape") || textToCheck.includes("webpage")) {
      // URL extraction priority: step.description → step.title → original user inputPrompt
      // The planner often omits the URL from step descriptions, so we fall back to the inputPrompt.
      const urlSources = [step.description || "", step.title, inputPrompt];
      let urlMatch: RegExpMatchArray | null = null;
      for (const src of urlSources) {
        urlMatch = src.match(/https?:\/\/[^\s"']+/);
        if (urlMatch) break;
      }

      if (urlMatch) {
        const url = urlMatch[0].replace(/[.,;)]+$/, ""); // strip trailing punctuation
        try {
          console.log(`[executor] Invoking web_scrape for url=${url}`);
          const result = await webScrapeTool({ url });
          observationSummary = `web_scrape (${result.title}) returned ${result.content.length} chars:\n${result.content.substring(0, 500)}`;
          toolsUsed.push("web_scrape");
        } catch (error: any) {
          console.error(`[executor] web_scrape THREW:`, error?.message || error);
          observationSummary = `web_scrape failed: ${error.message}`;
          toolsUsed.push("web_scrape");
        }
      } else {
        observationSummary = "web_scrape skipped: no URL found in step description.";
        toolsUsed.push("web_scrape");
      }
    } else if (
      textToCheck.includes("web") ||
      textToCheck.includes("internet") ||
      textToCheck.includes("current") ||
      textToCheck.includes("latest") ||
      textToCheck.includes("news") ||
      textToCheck.includes("stock") ||
      textToCheck.includes("today")
    ) {
      try {
        console.log(`[executor] Invoking web_search for query="${(inputPrompt + " " + step.title).substring(0, 100)}"`);
        const results = await webSearchTool({ query: inputPrompt + " " + step.title });
        observationSummary = `web_search returned: ${results.formattedSnippet}`;
        toolsUsed.push("web_search");
        if (results.citations.length > 0) {
          if (!args.citationsAccumulator) args.citationsAccumulator = [];
          args.citationsAccumulator.push(...results.citations);
        }
      } catch (error: any) {
        console.error(`[executor] web_search THREW:`, error?.message || error);
        observationSummary = `web_search failed: ${error.message}`;
        toolsUsed.push("web_search");
      }
    }

    const summary: StepSummary = {
      index: step.index,
      title: step.title,
      description: step.description,
      toolsUsed,
      status: "complete",
      observationSummary,
    };

    stepSummaries.push(summary);

    // 5. Emit step_complete
    await appendEvent({
      taskId,
      type: "step_complete",
      timestamp: Date.now(),
      stepIndex: step.index,
      totalSteps: boundedSteps.length,
      title: step.title,
      observationSummary,
      tools: toolsUsed,
      progress: {
        currentStep: idx + 1,
        totalSteps: boundedSteps.length,
        completedSteps: idx + 1,
      },
    });
  }

  // Spec §11.2: max_steps is reached when we planned the max of 7 steps AND ran them all without early timeout
  if (!timeoutReached && steps.length >= 7 && stepSummaries.length === boundedSteps.length) {
    maxStepsReached = true;
  }

  return { stepSummaries, timeoutReached, maxStepsReached };
}

/**
 * Keyword-based tool prediction for step_executing metadata.
 * Returns the name of the most likely tool for a given step,
 * or null if no tool is needed.
 */
function determinePredictedTool(textToCheck: string): string | null {
  if (textToCheck.includes("drive") || textToCheck.includes("document") || textToCheck.includes("file") || textToCheck.includes("retrieve")) {
    return "drive_retrieve";
  }
  if (textToCheck.includes("scrape") || textToCheck.includes("webpage")) {
    return "web_scrape";
  }
  if (
    textToCheck.includes("web") ||
    textToCheck.includes("internet") ||
    textToCheck.includes("current") ||
    textToCheck.includes("latest") ||
    textToCheck.includes("news") ||
    textToCheck.includes("stock") ||
    textToCheck.includes("today")
  ) {
    return "web_search";
  }
  if (textToCheck.includes("vector")) {
    return "vector_search";
  }
  return null;
}
