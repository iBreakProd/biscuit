import { Router, Request, Response } from "express";
import { ChatCreateSchema, ChatMessageCreateSchema } from "@repo/zod-schemas";
import {
  createChat,
  getChatWithMessages,
  appendUserMessageWithTask,
} from "../chat/service";
import { requireAuth, AuthenticatedRequest } from "../auth/middleware";

const router: Router = Router();

router.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const chat = await createChat(authReq.user!.id);
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

router.post(
  "/:chatId/messages",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const chatId = req.params.chatId as string;
      const validatedBody = ChatMessageCreateSchema.parse(req.body);
      const authReq = req as Request & { user?: { id: string } };

      const result = await appendUserMessageWithTask(
        chatId,
        authReq.user!.id,
        validatedBody.content
      );

      // Execute real AI agent without awaiting 
      // so HTTP response returns immediately
      runAgentTask(result.taskId).catch(err => {
        console.error("Background agent failed:", err);
      });

      res.json(result);
    } catch (error) {
      console.error("Failed to append message", error);
      res.status(400).json({ error: "Invalid request" });
    }
  }
);

export default router;
