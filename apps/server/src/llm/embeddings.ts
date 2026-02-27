import { openai } from "./openai";

export async function embedText(texts: string[]): Promise<number[][]> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("MOCK EMBEDDING. API Key missing");
    return texts.map(() => new Array(1536).fill(0.1));
  }

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts,
  });
  
  // Sort by index to maintain exactly the same order as the input strings
  const sorted = response.data.sort((a, b) => a.index - b.index);
  return sorted.map((d) => d.embedding);
}
