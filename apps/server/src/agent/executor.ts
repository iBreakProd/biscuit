import { StepSummary, AgentEvent, Citation } from "@repo/zod-schemas";
import { PlannedStep } from "./planner";
import { vectorSearchTool } from "../tools/vectorSearch";

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
  inputPrompt: string;
  steps: PlannedStep[];
  appendEvent: (event: AgentEventInput) => Promise<void>;
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
