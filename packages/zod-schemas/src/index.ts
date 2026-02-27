import { z } from "zod";

export const UserSchema = z.object({
  id: z.uuid(),
  googleId: z.string(),
  email: z.email(),
  name: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type User = z.infer<typeof UserSchema>;

export const HealthStatusSchema = z.object({
  db: z.enum(["ok", "error"]),
  redis: z.enum(["ok", "error"]),
  qdrant: z.enum(["ok", "error"]),
});

export type HealthStatus = z.infer<typeof HealthStatusSchema>;

export const ChatCreateSchema = z.object({});

export const ChatMessageCreateSchema = z.object({
  content: z.string().min(1),
});

export const TaskIdSchema = z.string();

export type ChatCreate = z.infer<typeof ChatCreateSchema>;
export type ChatMessageCreate = z.infer<typeof ChatMessageCreateSchema>;
export type TaskId = z.infer<typeof TaskIdSchema>;

