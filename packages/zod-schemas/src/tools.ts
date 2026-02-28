import { z } from "zod";

export const VectorSearchInputSchema = z.object({
  query: z.string().min(1),
  topK: z.number().int().positive().max(10).optional(),
});

export const DriveRetrieveInputSchema = z.object({
  query: z.string().min(1),
  userId: z.string().uuid(),
  topK: z.number().int().positive().max(10).optional(),
});

export type VectorSearchInput = z.infer<typeof VectorSearchInputSchema>;
export type DriveRetrieveInput = z.infer<typeof DriveRetrieveInputSchema>;
