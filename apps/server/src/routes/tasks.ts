import { Router, Request, Response } from "express";
import { db } from "@repo/db";
import { agentTasks } from "@repo/db/schemas";
import { eq } from "drizzle-orm";
import { readAgentEvents } from "@repo/redis";
import { TaskIdSchema, AgentEventsQuerySchema, AgentProgressResponseSchema } from "@repo/zod-schemas";
import { requireAuth } from "../auth/middleware";

const router: Router = Router();

router.get("/:taskId", requireAuth, async (req: Request, res: Response) => {
  try {
    const taskId = TaskIdSchema.parse(req.params.taskId);

    const [task] = await db
      .select()
      .from(agentTasks)
      .where(eq(agentTasks.id, taskId))
      .limit(1);

    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    res.json({
      status: task.status,
      input_prompt: task.inputPrompt,
      finalAnswerMarkdown: task.finalAnswerMarkdown,
      resultJson: task.resultJson,
      stepSummaries: task.stepSummaries,
    });
  } catch (error) {
    console.error("Failed to get task", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:taskId/events", requireAuth, async (req: Request, res: Response) => {
  try {
    const taskId = TaskIdSchema.parse(req.params.taskId);
    const since = AgentEventsQuerySchema.parse(req.query).since || null;

    const [task] = await db
      .select({ 
        status: agentTasks.status, 
        finalAnswerMarkdown: agentTasks.finalAnswerMarkdown, 
        stepSummaries: agentTasks.stepSummaries, 
        resultJson: agentTasks.resultJson 
      })
      .from(agentTasks)
      .where(eq(agentTasks.id, taskId))
      .limit(1);

    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    const events = await readAgentEvents(taskId, since, 100);
    const isDone = ["completed", "error", "timeout", "max_steps"].includes(task.status);
    
    // Check if the current raw values from the schema satisfy our valid enum definitions
    const taskStatus = task.status as "pending" | "running" | "completed" | "error" | "timeout" | "max_steps";

    // Standardize object before passing to Zod to omit `null` mapped to `.optional()` fields.
    const unvalidatedResponse: any = {
      done: isDone,
      status: taskStatus,
      events,
    };

    if (task.finalAnswerMarkdown) unvalidatedResponse.finalAnswerMarkdown = task.finalAnswerMarkdown;
    if (task.stepSummaries) unvalidatedResponse.stepSummaries = task.stepSummaries;
    if (task.resultJson) unvalidatedResponse.citations = (task.resultJson as any).citations;

    const validatedResponse = AgentProgressResponseSchema.parse(unvalidatedResponse);

    res.json(validatedResponse);
  } catch (error) {
    console.error("Failed to fetch task events", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
