import { callChatModel } from "../llm/openai";
import { StepSummary, Citation } from "@repo/zod-schemas";

export async function finalizeTask(args: {
  userMessage: string;
  history: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  stepSummaries: StepSummary[];
}): Promise<{ finalAnswerMarkdown: string; citations: Citation[] }> {
  const { userMessage, history, stepSummaries } = args;

  const systemPrompt = `You are an AI assistant that has just completed a sequence of steps to answer the user's request.
Using the observations gathered during your steps, provide a clear, helpful final answer to the user in markdown format.

Here are the summaries of what you did:
${JSON.stringify(stepSummaries, null, 2)}

Synthesize this information and answer the user directly. Do not mention the steps unless necessary.`;

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userMessage },
  ];

  const isMock = !process.env.OPENAI_API_KEY;
  const finalAnswerMarkdown = isMock 
    ? "This is a mocked final response because no OPENAI_API_KEY was found in your environment."
    : await callChatModel({ messages });

  return {
    finalAnswerMarkdown,
    citations: [], // Emitting citations strictly requires Drive tools
  };
}
