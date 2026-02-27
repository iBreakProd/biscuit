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

    // 3. Execution Phase
    const { stepSummaries, timeoutReached } = await executePlannedSteps({
      taskId,
      inputPrompt: userMessageContent,
      steps,
      appendEvent: async (ev) => {
        await appendAgentEvent(taskId, ev);
      }
    });

    let finalStatus = timeoutReached ? "timeout" : "running"; // will switch to completed later

    // 4. Summarize and Reflect
    await emit({
      type: "reflecting",
      title: "Finalizing response",
    });

    const { finalAnswerMarkdown, citations } = await finalizeTask({
      userMessage: userMessageContent,
      history: historyRows.slice(0, -1).map(r => ({ role: r.role as "user"| "assistant", content: r.content })), 
      stepSummaries
    });

    // 5. Build final event
    await emit({
      type: "finish",
      finalAnswerMarkdown,
      citations: [], 
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
          status: timeoutReached ? "timeout" : "completed",
          finalAnswerMarkdown,
          stepSummaries: stepSummaries as any,
          resultJson: { citations },
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
