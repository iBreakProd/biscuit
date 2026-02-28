import { Router, Request, Response } from "express";
import { ChatCreateSchema, ChatMessageCreateSchema } from "@repo/zod-schemas";
import {
  createChat,
  getChatWithMessages,
  appendUserMessageWithTask,
} from "../chat/service";
import { requireAuth, AuthenticatedRequest } from "../auth/middleware";
import { db } from "@repo/db";
import { chatRooms, agentTasks } from "@repo/db/schemas";
import { eq, desc, and } from "drizzle-orm";

const router: Router = Router();

// List all chats for the authenticated user
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const chats = await db
      .select()
      .from(chatRooms)
      .where(eq(chatRooms.userId, authReq.user!.id))
      .orderBy(desc(chatRooms.updatedAt));
    res.json({ chats });
  } catch (error) {
    console.error("Failed to list chats", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update chat title
router.patch("/:chatId", requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const chatId = req.params.chatId as string;
    const { title } = req.body as { title: string };
    if (!title) { res.status(400).json({ error: "title required" }); return; }
    const [updated] = await db
      .update(chatRooms)
      .set({ title: title.substring(0, 80) })
      .where(and(eq(chatRooms.id, chatId), eq(chatRooms.userId, authReq.user!.id)))
      .returning();
    res.json(updated);
  } catch (error) {
    console.error("Failed to update chat", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { initialMessage } = req.body as { initialMessage?: string };

    const title = initialMessage ? initialMessage.substring(0, 60) : undefined;
    const chat = await createChat(authReq.user!.id, title);

    if (initialMessage) {
      if (activeAgentTasks >= MAX_CONCURRENT_TASKS) {
        res.status(429).json({ error: "Too many active tasks. Please try again later." });
        return;
      }
      activeAgentTasks++;
      const result = await appendUserMessageWithTask(chat.id, authReq.user!.id, initialMessage.trim());
      runAgentTask(result.taskId).catch(err => {
        console.error("Background agent failed:", err);
      }).finally(() => {
        activeAgentTasks--;
      });

      res.json({ ...chat, initialTaskId: result.taskId });
      return;
    }

    res.json(chat);
  } catch (error) {
    console.error("Failed to create chat", error);
    res.status(400).json({ error: "Invalid request" });
  }
});

router.get("/:chatId", requireAuth, async (req: Request, res: Response) => {
  try {
    const chatId = req.params.chatId as string;
    const limit = parseInt(req.query.limit as string) || 50;

    const data = await getChatWithMessages(chatId, limit);
    res.json(data);
  } catch (error) {
    console.error("Failed to get chat", error);
    res.status(404).json({ error: "Chat not found" });
  }
});

import { runAgentTask } from "../agent/runAgentTask";

const MAX_CONCURRENT_TASKS = 10;
export let activeAgentTasks = 0;

router.post(
  "/:chatId/messages",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    if (activeAgentTasks >= MAX_CONCURRENT_TASKS) {
      res.status(429).json({ error: "Too many active tasks. Please try again later." });
      return;
    }

    // Synchronously increment before any `await` yields the event loop!
    activeAgentTasks++;
    let taskHandledInAgent = false;

    try {
      const chatId = req.params.chatId as string;
      const validatedBody = ChatMessageCreateSchema.parse(req.body);
      const authReq = req as Request & { user?: { id: string } };

      const result = await appendUserMessageWithTask(
        chatId,
        authReq.user!.id,
        validatedBody.content
      );

      taskHandledInAgent = true;
      // Execute real AI agent without awaiting 
      // so HTTP response returns immediately
      runAgentTask(result.taskId).catch(err => {
        console.error("Background agent failed:", err);
      }).finally(() => {
        activeAgentTasks--;
      });

      res.json(result);
    } catch (error) {
      if (!taskHandledInAgent) {
        activeAgentTasks--;
      }
      console.error("Failed to append message", error);
      res.status(400).json({ error: "Invalid request" });
    }
  }
);

export default router;
