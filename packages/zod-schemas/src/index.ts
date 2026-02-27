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
