import { db } from "@repo/db";
import { agentTasks, chatMessages } from "@repo/db/schemas";
import { appendAgentEvent } from "@repo/redis";
import { eq, asc, max } from "drizzle-orm";

import { planTask } from "./planner";
import { executePlannedSteps, AgentEventInput } from "./executor";
import { finalizeTask } from "./finalizer";

/**
 * Orchestrates the full 7-step ReAct agent lifecycle with real LLM
 * invocations (missing real tool calls currently).
 */
export async function runAgentTask(taskId: string) {
  try {
    // 1. Mark task as running and load inputs
    const [task] = await db
      .update(agentTasks)
      .set({ status: "running" })
      .where(eq(agentTasks.id, taskId))
      .returning();

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Load Chat History ascending
    const historyRows = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.chatId, task.chatId))
      .orderBy(asc(chatMessages.sequence));

    // Convert into standardized LLM history (we omit the actual prompt we generated)
    // Actually the last message is what sparked this task, so pop it.
    const lastUserMsg = historyRows[historyRows.length - 1];
    const previousHistoryRows = historyRows.slice(0, -1);
    
    const history: Array<{ role: "user" | "assistant"; content: string }> = previousHistoryRows.map(
      r => ({ role: r.role as "user" | "assistant", content: r.content })
    );

    const userMessageContent = lastUserMsg?.content || task.inputPrompt || "";

    // Helper to send events easily
    const emit = async (event: Omit<AgentEventInput, "taskId" | "timestamp">) => {
      await appendAgentEvent(taskId, {
        taskId,
        timestamp: Date.now(),
        ...event,
      });
    };

    const startTime = Date.now();
    const MAX_RUNTIME_MS = 60 * 1000;

    await emit({
      type: "start",
      title: "Agent started processing task",
    });

    // 2. Planning phase
    const availableTools = ["drive_retrieve", "vector_search", "web_search", "web_scrape"];
    
    await emit({
      type: "plan",
      title: "Planning actions",
      thought: "Analyzing request and available tools..."
    });

    const { steps } = await planTask({
      userMessage: userMessageContent,
      history,
      availableTools,
    });
    
    await emit({
      type: "step_planned",
      title: "Plan created",
      totalSteps: steps.length,
    });

    if (Date.now() - startTime >= MAX_RUNTIME_MS) {
       throw new Error("Task timed out before execution phase");
    }

    // 3. Execution Phase
    const citationsAccumulator: any[] = [];
    const { stepSummaries, timeoutReached, maxStepsReached } = await executePlannedSteps({
      taskId,
      userId: task.userId,
      inputPrompt: userMessageContent,
      steps,
      appendEvent: async (ev) => {
        await appendAgentEvent(taskId, ev);
      },
      citationsAccumulator,
      startTime
    });

    // Spec §11.2: status is "timeout" if wall-clock exceeded, "max_steps" if agent used all 7 planned steps
    let finalStatus = timeoutReached ? "timeout" : maxStepsReached ? "max_steps" : "running";

    // 4. Summarize and Reflect
    await emit({
      type: "reflecting",
      title: "Finalizing response",
    });
    
    let finalAnswerMarkdown = "";
    if (timeoutReached) {
       finalAnswerMarkdown = "Task timed out after 60 seconds.";
    } else {
       const finalizerObj = await finalizeTask({
         userMessage: userMessageContent,
         history: historyRows.slice(0, -1).map(r => ({ role: r.role as "user"| "assistant", content: r.content })), 
         stepSummaries,
         citations: citationsAccumulator,
       });
       finalAnswerMarkdown = finalizerObj.finalAnswerMarkdown;
    }

    // Extract deduplicated used chunks
    const usedChunkIds = Array.from(new Set(citationsAccumulator.filter(c => c.type === "drive").map(c => c.chunkId)));

    // 5. Build final event
    await emit({
      type: "finish",
      finalAnswerMarkdown,
      citations: citationsAccumulator, 
    });

    // 6. Push LLM output to Database sequentially
    await db.transaction(async (tx) => {
      // Find MAX sequence id to safely assign this new message
      const [maxSeqResult] = await tx
        .select({ value: max(chatMessages.sequence) })
        .from(chatMessages)
        .where(eq(chatMessages.chatId, task.chatId));

      const nextSequence = (maxSeqResult?.value ?? 0) + 1;

      // Wrap Assistant message creation along with Task completion states
      await tx.insert(chatMessages).values({
        chatId: task.chatId,
        userId: task.userId,
        role: "assistant",
        content: finalAnswerMarkdown,
        sequence: nextSequence,
        agentTaskId: taskId
      });

      await tx
        .update(agentTasks)
        .set({
          status: timeoutReached ? "timeout" : maxStepsReached ? "max_steps" : "completed",
          finalAnswerMarkdown,
          stepSummaries: stepSummaries as any,
          usedChunkIds, // Log the chunks for analytics/retrieval checks later
          resultJson: { citations: citationsAccumulator },
          completedAt: new Date(),
        })
        .where(eq(agentTasks.id, taskId));
    });

  } catch (error) {
    console.error("Agent Task Execution Failed:", error);
    
    await db
      .update(agentTasks)
      .set({
        status: "error",
        finalAnswerMarkdown: "I encountered an internal error while processing your request.",
        completedAt: new Date(),
      })
      .where(eq(agentTasks.id, taskId));

    await appendAgentEvent(taskId, {
      taskId,
      type: "finish",
      timestamp: Date.now(),
      finalAnswerMarkdown: "Internal testing error occurred.",
    }).catch(console.error);
  }
}
