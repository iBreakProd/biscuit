import { embedText } from "../llm/embeddings";
import { upsertPoints } from "@repo/qdrant";

const seedDocs = [
  { id: "doc-1", title: "Vector Search Intro", text: "Vector search allows semantic retrieval over embedded text. It is a fundamental mechanic for giving agents contextual knowledge about their environment." },
  { id: "doc-2", title: "Redis Streams Usage", text: "Redis Streams are used to buffer agent events for SSE and polling, ensuring that frontend clients can receive token-by-token updates safely without websocket overhead." },
  { id: "doc-3", title: "Drive Ingestion Overview", text: "Drive ingestion fetches, chunks, and embeds user documents into Qdrant iteratively on background workers without locking the main LLM thread." },
];

export async function seedDummyData() {
  console.log("Seeding dummy data into Qdrant...");
  
  try {
    const texts = seedDocs.map(d => d.text);
    const embeddings = await embedText(texts);
    
    const points = seedDocs.map((doc, i) => ({
      id: doc.id,
      vector: embeddings[i],
      payload: {
        user_id: "00000000-0000-0000-0000-000000000000",
        file_id: "dummy-file-id",
        file_name: doc.title,
        chunk_index: i,
        mime_type: "text/plain",
        text: doc.text,
      },
    }));
    
    await upsertPoints(points);
    console.log("Dummy data seeded successfully.");
  } catch (error) {
    console.error("Failed to seed dummy data:", error);
  }
}
