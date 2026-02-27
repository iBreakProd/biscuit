import { db } from "@repo/db";
import { chatRooms, chatMessages, agentTasks } from "@repo/db/schemas";
import { eq, desc, max, asc } from "drizzle-orm";

export async function createChat(userId: string) {
  const [chat] = await db
    .insert(chatRooms)
    .values({
      userId,
    })
    .returning();

  if (!chat) throw new Error("Failed to create chat");
  return chat;
}

export async function getChatWithMessages(chatId: string, limit: number = 50) {
  const [chat] = await db
    .select()
    .from(chatRooms)
    .where(eq(chatRooms.id, chatId))
    .limit(1);

  if (!chat) {
    throw new Error("Chat not found");
  }

  const messages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.chatId, chatId))
    .orderBy(asc(chatMessages.sequence))
    .limit(limit);

  return { chat, messages };
}

export async function appendUserMessageWithTask(
  chatId: string,
  userId: string,
  content: string
) {
  return await db.transaction(async (tx) => {
    const [maxSeqResult] = await tx
      .select({ value: max(chatMessages.sequence) })
      .from(chatMessages)
      .where(eq(chatMessages.chatId, chatId));

    const nextSequence = (maxSeqResult?.value ?? 0) + 1;

    const [message] = await tx
      .insert(chatMessages)
      .values({
        chatId,
        userId,
        role: "user",
        content,
        sequence: nextSequence,
      })
      .returning();

    if (!message) throw new Error("Failed to insert message");

    const [task] = await tx
      .insert(agentTasks)
      .values({
        userId,
        chatId,
        chatMessageId: message.id,
        inputPrompt: content,
        status: "pending",
      })
      .returning();

    if (!task) throw new Error("Failed to insert agent task");

    return { messageId: message.id, taskId: task.id };
  });
}
