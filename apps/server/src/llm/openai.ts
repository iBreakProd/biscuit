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
  console.log(`[OpenAI] Calling ${process.env.PLANNING_MODEL || "gpt-4o-mini"} for planning...`);
  
  // Wrap with a 15-second timeout to prevent infinite hangs
  const timeoutPromise = new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error("OpenAI API request timed out after 15 seconds")), 15000)
  );
  
  const completionPromise = openai.chat.completions.create({
    model: process.env.PLANNING_MODEL || "gpt-4o-mini",
    messages: params.messages,
    response_format: { type: "json_object" },
  });

  const completion = await Promise.race([completionPromise, timeoutPromise]);
  console.log(`[OpenAI] Planning request completed successfully.`);
  return (completion as any).choices[0]?.message?.content || "{}";
}
export async function callChatModel(params: {
  messages: { role: "system" | "user" | "assistant"; content: string }[];
}): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return "This is a dummy AI response for local testing.";
  }

  const completion = await openai.chat.completions.create({
    model: process.env.PLANNING_MODEL || "gpt-4o-mini",
    messages: params.messages,
  });

  return completion.choices[0]?.message?.content || "";
}

/**
 * Generates a short, one-sentence thought for a ReAct step.
 * Used to populate the `thought` field in `reflecting` events.
 */
export async function generateStepThought(
  stepTitle: string,
  stepDescription: string | undefined,
  toolToUse: string
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return `Executing "${stepTitle}" using ${toolToUse}.`;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a ReAct agent. In ONE sentence, state your current reasoning for this step. Be direct and concise.",
        },
        {
          role: "user",
          content: `Step: "${stepTitle}". Description: "${stepDescription || "none"}". Tool I will use: ${toolToUse}. What is my thought?`,
        },
      ],
      max_tokens: 80,
    });
    return completion.choices[0]?.message?.content?.trim() || `Using ${toolToUse} for: ${stepTitle}`;
  } catch {
    return `Using ${toolToUse} to address: ${stepTitle}`;
  }
}

export async function getEmbedding(text: string): Promise<number[]> {
  if (!process.env.OPENAI_API_KEY) {
    // Return a zero vector for local testing without an API key
    console.warn("[getEmbedding] No OPENAI_API_KEY — returning zero vector. Drive search will return no results.");
    return new Array(1536).fill(0);
  }
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0]!.embedding;
}
