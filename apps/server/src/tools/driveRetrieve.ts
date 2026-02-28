import { getEmbedding } from "../llm/openai";
import { searchDriveVectors } from "@repo/qdrant";
import { db } from "@repo/db";
import { chunks, driveFiles } from "@repo/db/schemas";
import { DriveCitation, DriveRetrieveInput } from "@repo/zod-schemas";
import { inArray, eq } from "drizzle-orm";

export async function driveRetrieveTool(input: DriveRetrieveInput): Promise<{ formattedSnippet: string, citations: DriveCitation[] }> {
  console.log(`[drive_retrieve] Starting search for userId=${input.userId}, query="${input.query.substring(0, 80)}"`);

  // 1. Embed query
  const queryEmbedding = await getEmbedding(input.query);
  console.log(`[drive_retrieve] Embedded query (dim=${queryEmbedding.length})`);

  // 2. Search Qdrant (hard cutoff of 0.3)
  const topK = input.topK || 10;
  let searchResults: Awaited<ReturnType<typeof searchDriveVectors>>;
  try {
    searchResults = await searchDriveVectors(queryEmbedding, input.userId, topK);
    console.log(`[drive_retrieve] Qdrant returned ${searchResults.length} raw hits (topK=${topK}, userId filter=${input.userId})`);
    searchResults.forEach((h, i) => console.log(`  hit[${i}] id=${h.id} score=${h.score.toFixed(4)} payload=${JSON.stringify(h.payload)}`));
  } catch (qdrantErr: any) {
    console.error(`[drive_retrieve] ❌ Qdrant search FAILED:`, qdrantErr?.message || qdrantErr);
    throw qdrantErr; // Re-throw so executor catch logs it too
  }

  const validHits = searchResults.filter(hit => hit.score >= 0.2);
  console.log(`[drive_retrieve] ${validHits.length} hits passed the 0.3 score cutoff`);

  if (validHits.length === 0) {
    return {
      formattedSnippet: "No relevant documents found in Google Drive.",
      citations: []
    };
  }

  const chunkIds = validHits.map(hit => String(hit.id));
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
  validHits.forEach(h => scoreMap.set(String(h.id), h.score));

  // 4. Gather neighbor texts for context enrichment (±1 chunk)
  const enrichedContexts: Array<{ chunkId: string; fileId: string; fileName: string; mimeType: string; score: number; enrichedText: string; }> = [];

  for (const c of dbChunks) {
    const localNeighbors = await db
      .select({ text: chunks.text, index: chunks.chunkIndex })
      .from(chunks)
      .where(eq(chunks.fileId, c.fileId));

    const targetIndices = [c.chunkIndex - 1, c.chunkIndex, c.chunkIndex + 1];
    const relevant = localNeighbors
      .filter(n => targetIndices.includes(n.index))
      .sort((a, b) => a.index - b.index);

    const enrichedText = relevant.map(r => r.text).join("\n...\n");

    enrichedContexts.push({
      chunkId: c.id,
      fileId: c.fileId,
      fileName: c.fileName || "Unknown File",
      mimeType: c.mimeType || "text/plain",
      score: scoreMap.get(c.id) || 0,
      enrichedText
    });
  }

  // 5. Deduplicate and cap at 15 snippets
  const uniqueEnriched = enrichedContexts.filter((v, i, a) =>
    a.findIndex(t => t.fileId === v.fileId && t.chunkId === v.chunkId) === i
  );
  const cappedContexts = uniqueEnriched.slice(0, 15);

  console.log(`[drive_retrieve] Returning ${cappedContexts.length} unique enriched chunks as citations`);

  const formattedSnippet = cappedContexts.map(c => `[File: ${c.fileName} (ID: ${c.fileId})]\n${c.enrichedText}`).join("\n\n---\n\n");

  const citations: DriveCitation[] = cappedContexts.map(c => ({
    type: "drive",
    chunkId: c.chunkId,
    fileId: c.fileId,
    fileName: c.fileName,
    mimeType: c.mimeType,
    score: c.score
  }));

  return { formattedSnippet, citations };
}
