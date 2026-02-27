import { z } from "zod";

export const VectorSearchInputSchema = z.object({
  query: z.string().min(1),
  topK: z.number().int().positive().max(10).optional(),
});

export type VectorSearchInput = z.infer<typeof VectorSearchInputSchema>;
