import { embedText } from "../llm/embeddings";
import { upsertPoints } from "@repo/qdrant";
import crypto from "crypto";

const seedDocs = [
  { id: "doc-1", title: "Vector Search Intro", text: "Vector search allows semantic retrieval over embedded text. It is a fundamental mechanic for giving agents contextual knowledge about their environment." },
  { id: "doc-2", title: "Redis Streams Usage", text: "Redis Streams are used to buffer agent events for SSE and polling, ensuring that frontend clients can receive token-by-token updates safely without websocket overhead." },
  { id: "doc-3", title: "Drive Ingestion Overview", text: "Drive ingestion fetches, chunks, and embeds user documents into Qdrant iteratively on background workers without locking the main LLM thread." },
];

export async function seedDummyData() {
  console.log("Seeding dummy data into Qdrant...");
  
  try {
    // Phase 6 Check: Chunking logic (~800 tokens, 100 overlap) simulated using typical 4 chars/token heuristic
    const charsPerToken = 4;
    const chunkSizeChars = 800 * charsPerToken;
    const overlapChars = 100 * charsPerToken;

    let points: any[] = [];
    let globalIndex = 0;

    for (let i = 0; i < seedDocs.length; i++) {
        const doc = seedDocs[i]!;
        
        // Explicitly simulated chunking to comply with Phase-6-locked architecture constraint
        let currentStart = 0;
        let originalText = doc.text;
        
        // Create at least one chunk even if it's small
        let chunks: string[] = [];
        do {
            const end = Math.min(currentStart + chunkSizeChars, originalText.length);
            chunks.push(originalText.substring(currentStart, end));
            currentStart = end - overlapChars;
        } while (currentStart + overlapChars < originalText.length);

        const embeddings = await embedText(chunks);

        chunks.forEach((chunkText, chunkIndex) => {
            points.push({
                id: crypto.randomUUID(), // Qdrant strictly requires UUID or unsigned integer
                vector: embeddings[chunkIndex],
                payload: {
                  user_id: "00000000-0000-0000-0000-000000000000",
                  file_id: doc.id,
                  file_name: doc.title,
                  chunk_index: chunkIndex,
                  mime_type: "text/plain",
                  text: chunkText,
                },
            });
            globalIndex++;
        });
    }
    
    await upsertPoints(points);
    console.log("Dummy data seeded successfully.");
  } catch (error) {
    console.error("Failed to seed dummy data:", error);
    throw error; // Bubble up so the HTTP handler can send a 500
  }
}
