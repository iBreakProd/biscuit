import { Router, Request, Response } from "express";
import { db } from "@repo/db";
import { agentTasks } from "@repo/db/schemas";
import { eq } from "drizzle-orm";
import { getRedisClient, redisXRead } from "@repo/redis";

const router: Router = Router();

// Mock Auth Middleware
const requireAuth = (req: Request, res: Response, next: Function) => {
  (req as Request & { user?: { id: string } }).user = { id: "00000000-0000-0000-0000-000000000000" };
  next();
};

router.get("/:taskId", requireAuth, async (req: Request, res: Response) => {
  try {
    const taskId = req.params.taskId as string;

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
    const taskId = req.params.taskId as string;
    const since = (req.query.since as string) || "0";

    const [task] = await db
      .select({ status: agentTasks.status, finalAnswerMarkdown: agentTasks.finalAnswerMarkdown, stepSummaries: agentTasks.stepSummaries, resultJson: agentTasks.resultJson })
      .from(agentTasks)
      .where(eq(agentTasks.id, taskId))
      .limit(1);

    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    const streamKey = `agent_events:${taskId}`;
    const result = await redisXRead(streamKey, since, 100);

    const isDone = ["completed", "error", "timeout", "max_steps"].includes(task.status);
    let events: any[] = [];

    if (result && result.length > 0) {
      // result is [{ name: streamKey, messages: [{ id, message: { ... } }] }]
      events = result[0]!.messages.map((msg: any) => {
        // Assume 'data' field has JSON encoded AgentEvent
        const parsed = msg.message.data ? JSON.parse(msg.message.data) : msg.message;
        return {
          ...parsed,
          id: msg.id,
        };
      });
    }

    res.json({
      done: isDone,
      status: task.status,
      events,
      finalAnswerMarkdown: task.finalAnswerMarkdown,
      stepSummaries: task.stepSummaries,
      citations: task.resultJson ? (task.resultJson as any).citations : undefined,
    });
  } catch (error) {
    console.error("Failed to fetch task events", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
