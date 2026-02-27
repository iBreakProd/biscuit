import { db } from "@repo/db";
import { agentTasks } from "@repo/db/schemas";
import { appendAgentEvent } from "@repo/redis";
import { eq } from "drizzle-orm";

/**
 * Fake Agent executor that emits deterministic events
 * to Redis and updates the DB without invoking OpenAI.
 */
export async function runAgentTaskMock(taskId: string) {
  try {
    const timestamp = Date.now();

    // 1. Emit START
    await appendAgentEvent(taskId, {
      taskId,
      type: "start",
      timestamp,
      title: "Agent started processing task",
    });

    // Simulate thinking delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 2. Emit PLAN
    await appendAgentEvent(taskId, {
      taskId,
      type: "plan",
      timestamp: Date.now(),
      title: "Planning actions",
      thought: "I need to search the drive and then summarize",
      totalSteps: 2,
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 3. Emit STEP_EXECUTING
    await appendAgentEvent(taskId, {
      taskId,
      type: "step_executing",
      timestamp: Date.now(),
      stepIndex: 1,
      totalSteps: 2,
      title: "Searching Google Drive",
      tools: ["drive_search"],
      progress: {
        currentStep: 1,
        totalSteps: 2,
        completedSteps: 0,
      }
    });

    await new Promise((resolve) => setTimeout(resolve, 1500));

    // 4. Emit STEP_COMPLETE
    await appendAgentEvent(taskId, {
      taskId,
      type: "step_complete",
      timestamp: Date.now(),
      stepIndex: 1,
      totalSteps: 2,
      title: "Search successful",
      observationSummary: "Found 3 relevant files about project metrics.",
      progress: {
        currentStep: 1,
        totalSteps: 2,
        completedSteps: 1,
      }
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 5. Emit FINISH
    const finalAnswer = "This is a fake answer for testing streaming. The actual RAG query was not performed.";
    
    await appendAgentEvent(taskId, {
      taskId,
      type: "finish",
      timestamp: Date.now(),
      finalAnswerMarkdown: finalAnswer,
    });

    // 6. Update Database Task Status
    await db
      .update(agentTasks)
      .set({
        status: "completed",
        finalAnswerMarkdown: finalAnswer,
        completedAt: new Date(),
      })
      .where(eq(agentTasks.id, taskId));

  } catch (error) {
    console.error("Agent Task Mock Failed:", error);

    // Fallback: mark as error in DB if it crashes
    await db
      .update(agentTasks)
      .set({
        status: "error",
        finalAnswerMarkdown: "An internal testing error occurred.",
        completedAt: new Date(),
      })
      .where(eq(agentTasks.id, taskId));
  }
}
