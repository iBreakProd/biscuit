import { z } from "zod";

export const DriveCitationSchema = z.object({
  type: z.literal("drive"),
  chunkId: z.string(),
  fileId: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  score: z.number(),
});

export const WebCitationSchema = z.object({
  type: z.literal("web"),
  url: z.string(),
  title: z.string(),
  snippet: z.string().optional(),
  score: z.number().optional(),
});

export const CitationSchema = z.union([DriveCitationSchema, WebCitationSchema]);

export const AgentEventTypeEnum = z.enum([
  "start",
  "plan",
  "step_planned",
  "step_executing",
  "step_complete",
  "reflecting",
  "finish",
]);

export const AgentEventSchema = z.object({
  id: z.string(), // Redis stream ID
  taskId: z.string(),
  type: AgentEventTypeEnum,
  timestamp: z.number(),

  stepIndex: z.number().optional(),
  totalSteps: z.number().optional(),
  title: z.string().optional(),
  thought: z.string().optional(),
  plan: z.array(z.string()).optional(),
  tools: z.array(z.string()).optional(),
  observationSummary: z.string().optional(),

  progress: z
    .object({
      currentStep: z.number(),
      totalSteps: z.number(),
      completedSteps: z.number(),
    })
    .optional(),

  finalAnswerMarkdown: z.string().optional(),
  citations: z.array(CitationSchema).optional(),
  metrics: z
    .object({
      tokensUsed: z.number().optional(),
      durationMs: z.number().optional(),
    })
    .optional(),
});

export const AgentEventsQuerySchema = z.object({
  since: z.string().optional(),
});

export const StepSummarySchema = z.object({
  index: z.number(),
  title: z.string(),
  description: z.string().optional(),
  toolsUsed: z.array(z.string()),
  status: z.enum(["planned", "executing", "complete", "skipped", "failed"]),
  observationSummary: z.string().optional(),
});

export const AgentProgressResponseSchema = z.object({
  done: z.boolean(),
  status: z.enum(["pending", "running", "completed", "error", "timeout", "max_steps"]),
  events: z.array(AgentEventSchema),
  finalAnswerMarkdown: z.string().optional(),
  citations: z.array(CitationSchema).optional(),
  stepSummaries: z.array(StepSummarySchema).optional(),
});

export type DriveCitation = z.infer<typeof DriveCitationSchema>;
export type WebCitation = z.infer<typeof WebCitationSchema>;
export type Citation = z.infer<typeof CitationSchema>;
export type AgentEvent = z.infer<typeof AgentEventSchema>;
export type AgentEventsQuery = z.infer<typeof AgentEventsQuerySchema>;
export type StepSummary = z.infer<typeof StepSummarySchema>;
export type AgentProgressResponse = z.infer<typeof AgentProgressResponseSchema>;
