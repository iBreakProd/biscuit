import { Router, Response, Router as ExpressRouter } from "express";
import { AuthenticatedRequest, requireAuth } from "../auth/middleware";
import { enqueueDriveFetchJob, enqueueDriveVectorizeJob } from "@repo/redis";
import { listDriveFilesForUser, getDriveClient } from "./client";
import { db } from "@repo/db";
import { driveFiles, chunks, users } from "@repo/db/schemas";
import { eq, and } from "drizzle-orm";

const router: ExpressRouter = Router();

// In-memory rate limiting (1 request per minute per user_id)
const syncRateLimits = new Map<string, number>();

router.post("/sync", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = req.user!;
  const now = Date.now();
  
  // Enforce 1-minute rate limit
  const lastSyncTime = syncRateLimits.get(user.id) || 0;
  if (now - lastSyncTime < 60000) {
    res.status(429).json({ error: "Rate limit exceeded. Try again in a minute." });
    return;
  }
  syncRateLimits.set(user.id, now);

  try {
    // Load Google refresh token from DB — tokens are NOT stored in JWT anymore (BUG 4 fix)
    const [userRecord] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    if (!userRecord?.googleRefreshToken) {
      res.status(401).json({ error: "Google account not connected. Please re-authenticate." });
      return;
    }
    let files = await listDriveFilesForUser({ refresh_token: userRecord.googleRefreshToken });
    
    // Allow limiting the number of synced files for integration tests
    if (req.query.limit) {
      const limit = parseInt(req.query.limit as string, 10);
      if (!isNaN(limit) && limit > 0) {
          files = files.slice(0, limit);
      }
    }
    
    const SUPPORTED_MIME_TYPES = [
      "application/pdf",
      "text/plain",
      "text/markdown",
      "application/vnd.google-apps.document", // Google Docs
      "application/vnd.google-apps.spreadsheet",
      "application/vnd.google-apps.presentation",
    ];

    let supportedCount = 0;
    let unsupportedCount = 0;

    try {
      for (const file of files) {
        let isSupported = SUPPORTED_MIME_TYPES.includes(file.mimeType);
        
        const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit
        const isOversized = file.size !== undefined && file.size > MAX_SIZE_BYTES;
        if (isOversized) {
          isSupported = false;
        }

        if (isSupported) {
          supportedCount++;
        } else {
          unsupportedCount++;
        }

        type IngestionPhase = "discovered" | "failed" | "fetching" | "chunk_pending" | "vectorizing" | "indexed";
        let isPhase: IngestionPhase = isSupported ? "discovered" : "failed";
        
        let errorMsg = null;
        if (!isSupported) {
          errorMsg = isOversized 
            ? `File exceeds 10MB limit (size: ${file.size} bytes)` 
            : `Unsupported MIME type: ${file.mimeType}`;
        }

        const existingRecord = await db.select().from(driveFiles).where(
          and(eq(driveFiles.userId, user.id), eq(driveFiles.fileId, file.fileId))
        );
        
        const fileModifiedDate = file.modifiedTime ? new Date(file.modifiedTime) : null;

        if (existingRecord.length === 0) {
          const [newRecord] = await db.insert(driveFiles).values({
            userId: user.id,
            fileId: file.fileId,
            name: file.name,
            mimeType: file.mimeType,
            lastModifiedAt: fileModifiedDate,
            supported: isSupported,
            ingestionPhase: isPhase,
            ingestionError: errorMsg,
          }).returning();
          
          if (isSupported) {
              await enqueueDriveFetchJob(user.id, file.fileId);
          }
        } else {
          const record = existingRecord[0]!;
          
          // Determine if Stale
          if (isSupported) {
            const isStaleByDate = fileModifiedDate && record.lastIngestedAt && (fileModifiedDate > record.lastIngestedAt);
            // If the file was already indexed but is now stale, mark it for discovery again
            if (isStaleByDate) {
               isPhase = "discovered";
            } else {
               // Keep existing phase if not stale or if currently processing
               isPhase = record.ingestionPhase as IngestionPhase;
            }
          }

          await db.update(driveFiles)
            .set({
              name: file.name,
              mimeType: file.mimeType,
              lastModifiedAt: fileModifiedDate,
              supported: isSupported,
              ingestionPhase: isPhase,
              ingestionError: errorMsg,
              updatedAt: new Date(),
            })
            .where(eq(driveFiles.id, record.id));
            
          // If we just marked it as discovered (because it was stale), enqueue it again.
          if (isPhase === "discovered" && isSupported) {
             await enqueueDriveFetchJob(user.id, file.fileId);
          }
        }
      }
    } catch (dbError) {
      console.error("Database Iteration Error during Sync:", dbError);
      throw dbError; // rethrow to the outer catch for 500 response
    }

    res.json({
      status: "Sync completed successfully.",
      summary: {
        totalFound: files.length,
        supportedCount,
        unsupportedCount,
      }
    });

  } catch (error) {
    console.error("Drive Sync Error:", error);
    res.status(500).json({ error: "Failed to sync Google Drive files." });
  }
});

router.get("/files", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    try {
        const rows = await db.select().from(driveFiles).where(eq(driveFiles.userId, user.id));
        res.json({ files: rows });
    } catch (error) {
        console.error("Fetch Drive Files Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.get("/progress", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    try {
        const rows = await db.select().from(driveFiles).where(eq(driveFiles.userId, user.id));
        
        let supported = 0, unsupported = 0, indexed = 0, inProgress = 0, failed = 0;
        
        for (const r of rows) {
            if (!r.supported) {
                unsupported++;
            } else {
                supported++;
                if (r.ingestionPhase === "indexed") indexed++;
                else if (r.ingestionPhase === "failed") failed++;
                else inProgress++;
            }
        }
        
        res.json({
            totals: { supported, unsupported, indexed, inProgress, failed },
            files: rows
        });
    } catch (error) {
        console.error("Drive Progress Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.post("/files/:fileId/retry", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    const fileId = req.params.fileId as string;
    
    if (!fileId) {
        res.status(400).json({ error: "fileId parameter is required" });
        return;
    }
    
    try {
        const existing = await db.select().from(driveFiles).where(
            and(eq(driveFiles.userId, user.id), eq(driveFiles.fileId, fileId))
        );
        
        const record = existing[0];
        
        if (!record) {
             res.status(404).json({ error: "File not found" });
             return;
        }
        
        if (record.ingestionPhase !== "failed") {
            res.status(400).json({ error: "Only failed files can be retried manually." });
            return;
        }

        // Spec §8.4: Discriminate retry phase by checking whether raw_documents exists.
        // If raw text was already extracted → failure occurred in vectorize phase:
        //   - reset ingestion_phase to "chunk_pending", enqueue drive_vectorize
        // Otherwise → failure occurred in fetch phase:
        //   - reset ingestion_phase to "discovered", enqueue drive_fetch
        const { rawDocuments } = await import("@repo/db/schemas");
        const existingRawDocs = await db.select({ id: rawDocuments.id })
            .from(rawDocuments)
            .where(eq(rawDocuments.fileId, fileId))
            .limit(1);

        const hadRawText = existingRawDocs.length > 0;

        if (hadRawText) {
            // Vectorize-phase retry: raw text exists, re-vectorize only
            await db.update(driveFiles)
                .set({
                    ingestionPhase: "chunk_pending",
                    retryCount: 0,
                    ingestionError: null,
                    updatedAt: new Date()
                })
                .where(eq(driveFiles.id, record.id));

            await enqueueDriveVectorizeJob(user.id, fileId);
            res.status(200).json({ message: "Vectorize job re-enqueued (raw text preserved)", fileId, retryPhase: "vectorize" });
        } else {
            // Fetch-phase retry: no raw text, start from scratch
            await db.update(driveFiles)
                .set({
                    ingestionPhase: "discovered",
                    retryCount: 0,
                    ingestionError: null,
                    updatedAt: new Date()
                })
                .where(eq(driveFiles.id, record.id));

            await enqueueDriveFetchJob(user.id, fileId);
            res.status(200).json({ message: "Fetch job re-enqueued", fileId, retryPhase: "fetch" });
        }
    } catch (err: any) {
        console.error("Error retrying file:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.get("/chunk/:chunkId", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const chunkId = req.params.chunkId as string;
    
    if (!chunkId) {
        res.status(400).json({ error: "chunkId parameter is required" });
        return;
    }

    try {
        // 1. Fetch the origin chunk
        const [originChunk] = await db.select().from(chunks).where(eq(chunks.id, chunkId)).limit(1);
        
        if (!originChunk) {
            res.status(404).json({ error: "Chunk not found" });
            return;
        }

        // 2. Fetch the file metadata
        const [fileRecord] = await db.select().from(driveFiles).where(eq(driveFiles.fileId, originChunk.fileId)).limit(1);
        
        if (!fileRecord) {
            res.status(404).json({ error: "Associated file not found" });
            return;
        }
        
        // Ensure user owns this chunk
        if (fileRecord.userId !== req.user!.id) {
             res.status(403).json({ error: "Forbidden: Not your file" });
             return;
        }

        // 3. Fetch neighbors computationally (same approach as vector tool)
        const localNeighbors = await db.select({ text: chunks.text, index: chunks.chunkIndex }).from(chunks).where(eq(chunks.fileId, originChunk.fileId));
        
        const targetIndices = [originChunk.chunkIndex - 1, originChunk.chunkIndex, originChunk.chunkIndex + 1];
        const relevant = localNeighbors
            .filter(n => targetIndices.includes(n.index))
            .sort((a, b) => a.index - b.index);
            
        const enrichedText = relevant.map(r => r.text).join("\n...\n");

        res.status(200).json({
            chunkId,
            fileId: fileRecord.fileId,
            fileName: fileRecord.name,
            mimeType: fileRecord.mimeType,
            text: enrichedText
        });
    } catch (err: any) {
        console.error("Error fetching chunk:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
