import { Router, Response, Router as ExpressRouter } from "express";
import { AuthenticatedRequest, requireAuth } from "../auth/middleware";
import { listDriveFilesForUser } from "./client";
import { db } from "@repo/db";
import { driveFiles } from "@repo/db/schemas";
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
    const files = await listDriveFilesForUser(user.googleTokens);
    
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
          await db.insert(driveFiles).values({
            userId: user.id,
            fileId: file.fileId,
            name: file.name,
            mimeType: file.mimeType,
            lastModifiedAt: fileModifiedDate,
            supported: isSupported,
            ingestionPhase: isPhase,
            ingestionError: errorMsg,
          });
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

export default router;
