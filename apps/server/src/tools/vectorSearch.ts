import { VectorSearchInputSchema } from "@repo/zod-schemas";
import { embedText } from "../llm/embeddings";
import { searchDriveVectors } from "@repo/qdrant";

export async function vectorSearchTool(args: { query: string; topK?: number }) {
  const { query, topK } = VectorSearchInputSchema.parse(args);
  
  const [embedding] = await embedText([query]);
  if (!embedding) {
    return { hits: [] };
  }
  
  // Hardcoded for dummy userId testing logic mapped out in spec.md
  // In Phase 5/6, we'll extract the correct mapping from auth layout.
  const results = await searchDriveVectors(embedding, "00000000-0000-0000-0000-000000000000", topK || 3);
  
  const hits = results.map((hit: any) => {
    const payload = hit.payload as any;
    return {
      id: String(hit.id),
      score: hit.score,
      title: payload?.file_name || "Unknown",
      text: payload?.text || "",
    };
  });
  
  return { hits };
}
