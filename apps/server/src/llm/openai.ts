import OpenAI from "openai";

// Respect existing env-checker pattern
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.warn("OPENAI_API_KEY is missing. Agent calls will fail if invoked.");
}

export const openai = new OpenAI({
  apiKey: apiKey || "dummy-key-for-typing", // Avoid OpenAI constructor crash when env is empty
});

export async function callPlannerLLM(params: {
  messages: { role: "system" | "user" | "assistant"; content: string }[];
}): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: params.messages,
    // Add explicitly JSON response format to ensure valid object
    response_format: { type: "json_object" },
  });

  return completion.choices[0]?.message?.content || "{}";
}

export async function callChatModel(params: {
  messages: { role: "system" | "user" | "assistant"; content: string }[];
}): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return "This is a dummy AI response for local testing.";
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: params.messages,
  });

  return completion.choices[0]?.message?.content || "";
}
