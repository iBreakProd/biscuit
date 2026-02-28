import { StepSummary, AgentEvent, Citation } from "@repo/zod-schemas";
import { PlannedStep } from "./planner";
import { vectorSearchTool } from "../tools/vectorSearch";
import { driveRetrieveTool } from "../tools/driveRetrieve";

export type AgentEventInput = Omit<AgentEvent, "id">;

/**
 * Executes a list of planned steps while enforcing:
 * - Max 7 steps (ignore extras)
 * - 60 seconds (1 minute) total runtime limit
 *
 * Emits "step_executing" and "step_complete" to Redis for UI streaming.
 */
export async function executePlannedSteps(args: {
  taskId: string;
  userId: string;
  inputPrompt: string;
  steps: PlannedStep[];
  appendEvent: (event: AgentEventInput) => Promise<void>;
  citationsAccumulator?: Citation[];
}): Promise<{ stepSummaries: StepSummary[]; timeoutReached: boolean }> {
  const { taskId, inputPrompt, steps, appendEvent } = args;
  const startTime = Date.now();
  const MAX_RUNTIME_MS = 60 * 1000;
  
  const stepSummaries: StepSummary[] = [];
  const boundedSteps = steps.slice(0, 7);
  let timeoutReached = false;

  for (let idx = 0; idx < boundedSteps.length; idx++) {
    const step = boundedSteps[idx];
    if (!step) continue;
    
    // Check runtime budget
    if (Date.now() - startTime > MAX_RUNTIME_MS) {
      console.warn(`Task ${taskId} timed out in executor loop`);
      timeoutReached = true;
      break;
    }

    // 1. Emit executing
    await appendEvent({
      taskId,
      type: "step_executing",
      timestamp: Date.now(),
      stepIndex: step.index,
      totalSteps: boundedSteps.length,
      title: step.title,
      thought: step.description,
      tools: [], // no real tools yet
      progress: {
        currentStep: idx + 1,
        totalSteps: boundedSteps.length,
        completedSteps: idx,
      }
    });

    // 2. Do the work (fake delay for now)
    const dt = Math.floor(Math.random() * 1000) + 1000;
    await new Promise(r => setTimeout(r, dt));

    let dummyObservation = `Simulated observation for step ${step.index}: ${step.title}`;
    let toolsUsed: string[] = [];

    // Simple phase 4 rule-based executor parsing
    const textToCheck = (step.title + " " + (step.description || "")).toLowerCase();
    if (textToCheck.includes("vector") || textToCheck.includes("search")) {
      try {
        const results = await vectorSearchTool({ query: inputPrompt + " " + step.title });
        if (results.hits.length > 0) {
          dummyObservation = `vector_search returned: ${results.hits.map((h: any) => h.text).join(" | ")}`;
          toolsUsed.push("vector_search");
        } else {
          dummyObservation = "vector_search returned no results.";
          toolsUsed.push("vector_search");
        }
      } catch (error: any) {
        dummyObservation = `vector_search failed: ${error.message}`;
        toolsUsed.push("vector_search");
      }
    } else if (textToCheck.includes("drive") || textToCheck.includes("document") || textToCheck.includes("file") || textToCheck.includes("retrieve")) {
      try {
        console.log(`[executor] Invoking drive_retrieve for userId=${args.userId}, query="${(inputPrompt + " " + step.title).substring(0, 80)}"`);
        const results = await driveRetrieveTool({ query: inputPrompt + " " + step.title, userId: args.userId });
        if (results.citations.length > 0) {
          dummyObservation = `drive_retrieve returned: ${results.formattedSnippet}`;
          toolsUsed.push("drive_retrieve");
          
          // Bubble citations up out of the executor loop
          if (!args.citationsAccumulator) args.citationsAccumulator = [];
          args.citationsAccumulator.push(...results.citations);
        } else {
          dummyObservation = "drive_retrieve returned no results.";
          toolsUsed.push("drive_retrieve");
        }
      } catch (error: any) {
        console.error(`[executor] drive_retrieve THREW:`, error?.message || error);
        dummyObservation = `drive_retrieve failed: ${error.message}`;
        toolsUsed.push("drive_retrieve");
      }
    }
    
    const summary: StepSummary = {
      index: step.index,
      title: step.title,
      description: step.description,
      toolsUsed,
      status: "complete",
      observationSummary: dummyObservation,
    };
    
    stepSummaries.push(summary);

    // 3. Emit completed
    await appendEvent({
      taskId,
      type: "step_complete",
      timestamp: Date.now(),
      stepIndex: step.index,
      totalSteps: boundedSteps.length,
      title: step.title,
      observationSummary: dummyObservation,
      tools: toolsUsed,
      progress: {
        currentStep: idx + 1,
        totalSteps: boundedSteps.length,
        completedSteps: idx + 1,
      }
    });
  }

  return { stepSummaries, timeoutReached };
}
