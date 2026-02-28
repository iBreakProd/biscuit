import { envChecker } from "./utils/envChecker";
import { getRedisClient, redisCreateConsumerGroup, redisXReadGroup, redisXAck } from "@repo/redis";
import { db } from "@repo/db";
import { driveFiles, rawDocuments, chunks } from "@repo/db/schemas";
import { eq, and } from "drizzle-orm";
import { OpenAI } from "openai";
import { get_encoding } from "tiktoken";
import { getQdrantClient, ensureDriveVectorsCollection, upsertPoints } from "@repo/qdrant";
import crypto from "crypto";

envChecker();

const STREAM_NAME = "drive_vectorize:0";
const GROUP_NAME = "drive-vectorize-workers";
const CONSUMER_NAME = `vectorize-worker-${process.pid}`;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function chunkText(text: string, maxTokens: number = 800, overlapTokens: number = 100): Promise<string[]> {
  const enc = get_encoding("cl100k_base"); // Standard embedding encoding
  const tokens = enc.encode(text);
  const chunksArr: string[] = [];

  if (tokens.length === 0) return [];

  let i = 0;
  while (i < tokens.length) {
    const chunkTokens = tokens.slice(i, i + maxTokens);
    const chunkText = enc.decode(chunkTokens);
    // Tiktoken decodes into Uint8Array buffer represented as string, convert it properly
    chunksArr.push(new TextDecoder().decode(chunkText));
    
    i += maxTokens - overlapTokens;
  }

  enc.free();
  return chunksArr;
}

async function processJob(jobData: any, messageId: string) {
  const { userId, fileId } = jobData;

  console.log(`[Job ${messageId}] Vectorizing File: ${fileId} for User: ${userId}`);

  const fileRecords = await db.select().from(driveFiles).where(eq(driveFiles.fileId, fileId)).limit(1);
  const fileRecord = fileRecords[0];

  if (!fileRecord) {
    console.warn(`[Job ${messageId}] DB Record Not found for ${fileId}, skipping...`);
    return;
  }

  try {
    // 1. Mark phase as Vectorizing
    await db.update(driveFiles).set({ ingestionPhase: "vectorizing", updatedAt: new Date() }).where(eq(driveFiles.id, fileRecord.id));

    // 2. Fetch the extracted text
    const rawDocs = await db.select().from(rawDocuments).where(eq(rawDocuments.fileId, fileId)).limit(1);
    const rawDoc = rawDocs[0];

    if (!rawDoc) {
      throw new Error("Raw document text not found for vectorization.");
    }

    // 3. Cleanup existing chunks in DB and Qdrant
    const existingChunks = await db.select({ qdrantPointId: chunks.qdrantPointId }).from(chunks).where(
        and(eq(chunks.userId, userId), eq(chunks.fileId, fileId))
    );
    
    if (existingChunks.length > 0) {
        console.log(`[Job ${messageId}] Cleaning up ${existingChunks.length} existing chunks/vectors...`);
        // Delete from DB
        await db.delete(chunks).where(and(eq(chunks.userId, userId), eq(chunks.fileId, fileId)));
        
        // Delete from Qdrant
        const qdrant = getQdrantClient();
        await qdrant.delete("drive_vectors", {
            wait: true,
            points: existingChunks.map((c: { qdrantPointId: string }) => c.qdrantPointId)
        });
    }

    // 4. Chunk Text
    const textChunks = await chunkText(rawDoc.text, 800, 100);
    
    if (textChunks.length === 0) {
        throw new Error("File resulted in 0 chunks (empty document).");
    }
    
    console.log(`[Job ${messageId}] Created ${textChunks.length} chunks. Generating embeddings...`);

    // 5. Generate Embeddings & Upsert (Process in batches of 50 to maximize throughput and avoid large document bottlenecks)
    const BATCH_SIZE = 50;
    for (let i = 0; i < textChunks.length; i += BATCH_SIZE) {
        const batchChunks = textChunks.slice(i, i + BATCH_SIZE);
        
        const embeddingRes = await openai.embeddings.create({
            input: batchChunks,
            model: "text-embedding-3-small"
        });
        
        const qdrantPoints = [];
        const dbChunkRecords = [];
        
        for (let j = 0; j < batchChunks.length; j++) {
            const chunkIndex = i + j;
            const chunkText = batchChunks[j]!;
            const embedding = embeddingRes.data[j]?.embedding;
            const chunkId = crypto.randomUUID(); // Valid UUID for both DB and Qdrant point
            const chunkHash = crypto.createHash('sha256').update(chunkText).digest('hex');
            
            if (!embedding) throw new Error("Missing embedding from OpenAI");

            qdrantPoints.push({
                id: chunkId,
                vector: embedding,
                payload: {
                    user_id: userId,
                    file_id: fileId,
                    file_name: fileRecord.name,
                    mime_type: fileRecord.mimeType,
                    chunk_index: chunkIndex,
                    hash: chunkHash
                }
            });
            
            dbChunkRecords.push({
                id: chunkId,
                userId,
                fileId,
                chunkIndex,
                text: chunkText,
                hash: chunkHash,
                vectorized: true,
                qdrantPointId: chunkId
            });
        }

        // Upsert to Qdrant
        await upsertPoints(qdrantPoints);
        
        // Insert into DB
        await db.insert(chunks).values(dbChunkRecords);
    }

    // 6. Complete
    await db.update(driveFiles).set({
      ingestionPhase: "indexed",
      hash: rawDoc.hash, // Sync hash
      lastIngestedAt: new Date(),
      updatedAt: new Date(),
      retryCount: 0,
      ingestionError: null
    }).where(eq(driveFiles.id, fileRecord.id));

    console.log(`[Job ${messageId}] ✅ Completed Vectorize. Indexed ${textChunks.length} chunks for ${fileId}.`);

  } catch (err: any) {
    const currentRetries = fileRecord.retryCount || 0;
    
    // Check if it's a token rate limit or temporary network issue (retryable) vs unrecoverable error
    const isPermanent = err.status === 400 || err.status === 401 || err.status === 403 || err.status === 404;

    if (isPermanent || currentRetries >= 2) {
      console.error(`[Job ${messageId}] 💥 Terminal failure splitting/indexing ${fileId}. Permanent=${isPermanent}, Retry=${currentRetries}.`);
      await db.update(driveFiles).set({
        ingestionPhase: "failed",
        ingestionError: err.message?.substring(0, 1000) || "Unknown Error",
        updatedAt: new Date()
      }).where(eq(driveFiles.id, fileRecord.id));
    } else {
      console.error(`[Job ${messageId}] ⚠️ Retryable failure splitting/indexing ${fileId}. Retry=${currentRetries}. Delaying...`, err);
      await db.update(driveFiles).set({
        retryCount: currentRetries + 1,
        lastRetryAt: new Date(),
        ingestionError: err.message?.substring(0, 1000),
        updatedAt: new Date()
      }).where(eq(driveFiles.id, fileRecord.id));

      setTimeout(async () => {
          try {
             const { enqueueDriveVectorizeJob } = require("@repo/redis");
             await enqueueDriveVectorizeJob(userId, fileId); 
          } catch(e){}
      }, Math.pow(2, currentRetries + 1) * 1000);
    }
  }
}

async function mainLoop() {
  console.log(`[Vectorize Worker] Starting ${CONSUMER_NAME}...`);
  await ensureDriveVectorsCollection();
  
  await redisCreateConsumerGroup(STREAM_NAME, GROUP_NAME);

  console.log(`[Vectorize Worker] Listening on stream ${STREAM_NAME}`);

  while (true) {
    try {
      const response = await redisXReadGroup(STREAM_NAME, GROUP_NAME, CONSUMER_NAME, 1, 2000);

      if (response && response.length > 0) {
        const stream = response[0];
        if (stream && stream.messages) {
          for (const message of stream.messages) {
            await processJob(message.message, message.id);
            await redisXAck(STREAM_NAME, GROUP_NAME, message.id);
            console.log(`[Vectorize Worker] Acknowledged ${message.id}`);
          }
        }
      }
    } catch (err: any) {
      console.error(`[Vectorize Worker] Main Loop Error:`, err);
      await new Promise(res => setTimeout(res, 5000));
    }
  }
}

mainLoop().catch(console.error);
