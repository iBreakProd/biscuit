import { getEmbedding } from "../llm/openai";
import { searchDriveVectors } from "@repo/qdrant";
import { db } from "@repo/db";
import { chunks, driveFiles } from "@repo/db/schemas";
import { DriveCitation, DriveRetrieveInput } from "@repo/zod-schemas";
import { inArray, eq, and } from "drizzle-orm";

export async function driveRetrieveTool(input: DriveRetrieveInput): Promise<{ formattedSnippet: string, citations: DriveCitation[] }> {
  console.log(`[drive_retrieve] Starting search for userId=${input.userId}, query="${input.query.substring(0, 80)}"`);

  // 1. Embed query
  const queryEmbedding = await getEmbedding(input.query);
  console.log(`[drive_retrieve] Embedded query (dim=${queryEmbedding.length})`);

  // 2. Search Qdrant (score_threshold=0.4 enforced at the Qdrant level)
  const topK = input.topK || 20;
  let searchResults: Awaited<ReturnType<typeof searchDriveVectors>>;
  try {
    searchResults = await searchDriveVectors(queryEmbedding, input.userId, topK, 0.4);
    console.log(`[drive_retrieve] Qdrant returned ${searchResults.length} raw hits (topK=${topK}, threshold=0.4, userId=${input.userId})`);
    console.log(`[drive_retrieve] ── Score breakdown ──────────────────────────`);
    searchResults.forEach((h, i) => {
      const score = h.score.toFixed(4);
      const bar = "█".repeat(Math.round(h.score * 20)).padEnd(20, "░");
      const fileName = (h.payload?.file_name as string) ?? "unknown";
      const chunkIdx = h.payload?.chunk_index ?? "?";
      console.log(`  [${String(i + 1).padStart(2)}] ${bar} ${score}  "${fileName}" chunk #${chunkIdx}`);
    });
    console.log(`[drive_retrieve] ────────────────────────────────────────────`);
  } catch (qdrantErr: any) {
    console.error(`[drive_retrieve] ❌ Qdrant search FAILED:`, qdrantErr?.message || qdrantErr);
    throw qdrantErr; // Re-throw so executor catch logs it too
  }

  console.log(`[drive_retrieve] ${searchResults.length} hits passed the 0.4 score threshold`);

  if (searchResults.length === 0) {
    return {
      formattedSnippet: "No relevant documents found in Google Drive.",
      citations: []
    };
  }

  const chunkIds = searchResults.map(hit => String(hit.id));
  console.log(`[drive_retrieve] Fetching chunk text for IDs: ${chunkIds.join(", ")}`);

  // 3. Fetch actual chunk text + neighbors from PostgreSQL
  const dbChunks = await db
    .select({
      id: chunks.id,
      fileId: chunks.fileId,
      chunkIndex: chunks.chunkIndex,
      text: chunks.text,
      fileName: driveFiles.name,
      mimeType: driveFiles.mimeType,
    })
    .from(chunks)
    .innerJoin(driveFiles, eq(chunks.fileId, driveFiles.fileId))
    .where(inArray(chunks.id, chunkIds));

  console.log(`[drive_retrieve] DB returned ${dbChunks.length} chunks`);

  // Map scores back so we can sort citations reliably
  const scoreMap = new Map<string, number>();
  searchResults.forEach(h => scoreMap.set(String(h.id), h.score));

  // 4. Group chunks by fileId to deduplicate and compress context
  const fileGroups = new Map<string, Array<{ chunkId: string; fileName: string; mimeType: string; score: number; text: string; }>>();
  
  for (const c of dbChunks) {
    if (!fileGroups.has(c.fileId)) {
      fileGroups.set(c.fileId, []);
    }
    fileGroups.get(c.fileId)!.push({
      chunkId: c.id,
      fileName: c.fileName || "Unknown File",
      mimeType: c.mimeType || "text/plain",
      score: scoreMap.get(c.id) || 0,
      text: c.text
    });
  }

  const formattedSnippetParts: string[] = [];
  const citations: DriveCitation[] = [];

  for (const [fileId, contexts] of fileGroups.entries()) {
    // Sort chunks by score descending so we prioritize the most relevant text within the file
    contexts.sort((a, b) => b.score - a.score);
    
    const highestScore = contexts[0]?.score || 0;
    const sampleContext = contexts[0]!;
    
    // Take at most the top 2 highly relevant chunks per file to save LLM context window space
    const topChunks = contexts.slice(0, 2);
    
    const combinedText = topChunks.map((c, idx) => `[Relevant Snippet ${idx + 1}]\n${c.text}`).join("\n\n");
    
    formattedSnippetParts.push(`[Source File: ${sampleContext.fileName} (ID: ${fileId})]\n${combinedText}`);
    
    citations.push({
      type: "drive",
      chunkId: topChunks.map(c => c.chunkId).join(","), 
      fileId: fileId,
      fileName: sampleContext.fileName,
      mimeType: sampleContext.mimeType,
      score: highestScore
    });
  }

  // Cap top citations so LLM prompt doesn't explode (e.g., max 5 unique files)
  const cappedCitations = citations.slice(0, 5);
  const cappedFormattedSnippetParts = formattedSnippetParts.slice(0, 5);

  console.log(`[drive_retrieve] Returning ${cappedCitations.length} grouped file citations`);

  const formattedSnippet = cappedFormattedSnippetParts.join("\n\n---\n\n");

  return { formattedSnippet, citations: cappedCitations };
}
