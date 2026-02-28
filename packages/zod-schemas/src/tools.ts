import { z } from "zod";

export const VectorSearchInputSchema = z.object({
  query: z.string().min(1),
  topK: z.number().int().positive().max(10).optional(),
});

export const DriveRetrieveInputSchema = z.object({
  query: z.string().min(1),
  userId: z.uuid(),
  topK: z.number().int().positive().max(10).optional(),
});

// Max 3 results per spec (hard cap to keep LLM context small)
export const WebSearchInputSchema = z.object({
  query: z.string().min(1),
  topK: z.number().int().positive().max(3).optional(),
});

export const WebScrapeInputSchema = z.object({
  url: z.string().url(),
});

export type VectorSearchInput = z.infer<typeof VectorSearchInputSchema>;
export type DriveRetrieveInput = z.infer<typeof DriveRetrieveInputSchema>;
export type WebSearchInput = z.infer<typeof WebSearchInputSchema>;
export type WebScrapeInput = z.infer<typeof WebScrapeInputSchema>;
