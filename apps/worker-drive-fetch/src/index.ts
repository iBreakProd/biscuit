import "dotenv/config";

import { getRedisClient, redisCreateConsumerGroup, redisXReadGroup, redisXAck, enqueueDriveVectorizeJob, enqueueDriveFetchJob } from "@repo/redis";
import { db } from "@repo/db";
import { driveFiles, rawDocuments, users } from "@repo/db/schemas";
import { eq } from "drizzle-orm";
import { google } from "googleapis";
import crypto from "crypto";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import mammoth from "mammoth";

const STREAM_NAME = "drive_fetch:0";
const GROUP_NAME = "drive-fetch-workers";
const CONSUMER_NAME = `fetch-worker-${process.pid}`;

async function getDriveClient(userId: string) {
    const userRecord = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = userRecord[0];
    if (!user || (!user.googleRefreshToken && !(user as any).googleTokens)) {
        throw new Error("User has no Google OAuth Refresh Token saved in the Database.");
    }
    
    // We are extracting from process.env, ensure it resolves strictly 
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );
    
    // Fallback logic for Phase 5 token vs Phase 6 persistent token
    const token = user.googleRefreshToken || ((user as any).googleTokens?.refresh_token);
    oauth2Client.setCredentials({ refresh_token: token });
      
    return google.drive({ version: "v3", auth: oauth2Client });
}

async function extractTextFromBuffer(buffer: Buffer, mimeType: string, logPrefix: string): Promise<string> {
    console.log(`${logPrefix} [Extract] mimeType=${mimeType} bufferSize=${buffer.length} bytes`);

    if (mimeType === "application/pdf") {
        console.log(`${logPrefix} [Extract] Invoking pdfjs-dist on ${buffer.length}-byte buffer...`);
        try {
            // pdfjs-dist works on Uint8Array
            const uint8 = new Uint8Array(buffer);
            const loadingTask = pdfjsLib.getDocument({ data: uint8, useSystemFonts: true });
            const pdfDoc = await loadingTask.promise;
            console.log(`${logPrefix} [Extract] PDF loaded. numPages=${pdfDoc.numPages}`);
            
            const textPages: string[] = [];
            for (let p = 1; p <= pdfDoc.numPages; p++) {
                const page = await pdfDoc.getPage(p);
                const content = await page.getTextContent();
                const pageText = content.items
                    .filter((item: any) => "str" in item)
                    .map((item: any) => item.str)
                    .join(" ");
                textPages.push(pageText);
            }
            const combined = textPages.join("\n");
            console.log(`${logPrefix} [Extract] PDF extracted. pages=${pdfDoc.numPages} totalLen=${combined.length}`);
            if (!combined.trim()) {
                console.warn(`${logPrefix} [Extract] PDF produced empty text — may be a scanned image-only document.`);
            }
            return combined;
        } catch (pdfErr: any) {
            console.error(`${logPrefix} [Extract] pdfjs-dist error:`, pdfErr?.message ?? pdfErr);
            throw pdfErr;
        }
    } else if (mimeType === "application/vnd.google-apps.document" || mimeType === "application/vnd.google-apps.presentation" || mimeType === "application/vnd.google-apps.spreadsheet") {
         // Google docs exported as text/plain
         const text = buffer.toString("utf8");
         console.log(`${logPrefix} [Extract] Google Doc exported. textLen=${text.length}`);
         return text;
    } else if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") { // docx
        const result = await mammoth.extractRawText({ buffer });
        console.log(`${logPrefix} [Extract] docx parsed. textLen=${result.value.length}`);
        return result.value;
    } else if (mimeType.startsWith("text/") || mimeType === "application/json" || mimeType === "application/csv") {
        const text = buffer.toString("utf8");
        console.log(`${logPrefix} [Extract] Plain-text decoded. textLen=${text.length}`);
        return text;
    } else {
        throw new Error(`Unsupported MIME type for text extraction: ${mimeType}`);
    }
}

// Implement Process Job Constraints + DB logic
async function processJob(jobData: any, messageId: string) {
    const { userId, fileId } = jobData;
    
    console.log(`[Job ${messageId}] Processing File: ${fileId} for User: ${userId}`);
    
    const fileRecords = await db.select().from(driveFiles).where(eq(driveFiles.fileId, fileId)).limit(1);
    const fileRecord = fileRecords[0];
    
    if (!fileRecord) {
        console.warn(`[Job ${messageId}] DB Record Not found for ${fileId}, skipping...`);
        return;
    }
    
    const LOG = `[Job ${messageId}][${fileRecord.name ?? fileId}]`;

    try {
        // 1. Mark phase as Fetching
        console.log(`${LOG} Starting fetch. mimeType=${fileRecord.mimeType}`);
        await db.update(driveFiles).set({ ingestionPhase: "fetching", ingestionError: null, updatedAt: new Date() }).where(eq(driveFiles.id, fileRecord.id));
        
        // 2. Init Drive Client
        const drive = await getDriveClient(userId);
        let fileBuffer: Buffer | null = null;
        
        // 3. Download based on MIME
        if (fileRecord.mimeType.startsWith("application/vnd.google-apps.")) {
            // Native GSuite documents need to be EXPORTED
            const exportMimeMap: Record<string, string> = {
                "application/vnd.google-apps.document": "text/plain",
                "application/vnd.google-apps.spreadsheet": "text/csv",
                "application/vnd.google-apps.presentation": "text/plain"
            };
            const targetMime = exportMimeMap[fileRecord.mimeType] || "text/plain";
            console.log(`${LOG} Exporting Google Workspace file as ${targetMime}...`);
            const response = await drive.files.export({ fileId, mimeType: targetMime }, { responseType: "arraybuffer" });
            fileBuffer = Buffer.from(response.data as ArrayBuffer);
            console.log(`${LOG} Export complete. buffer=${fileBuffer.length} bytes`);
            fileRecord.mimeType = targetMime; // Overwrite for extraction hook
        } else {
            // Standard files just get GET
            console.log(`${LOG} Downloading file via GET...`);
            const response = await drive.files.get({ fileId, alt: "media" }, { responseType: "arraybuffer" });
            fileBuffer = Buffer.from(response.data as ArrayBuffer);
            console.log(`${LOG} Download complete. buffer=${fileBuffer.length} bytes`);
        }
        
        // 4. Extract Text
        let rawText = await extractTextFromBuffer(fileBuffer, fileRecord.mimeType, LOG);
        fileBuffer = null; // free memory
        
        // Hard constraint: Truncate at 100k
        let finalErrorMsg = null;
        if (rawText.length > 100000) {
             rawText = rawText.slice(0, 100000);
             finalErrorMsg = "Warning: File truncated due to 100k character size limit.";
        }
        
        // 5. Update raw_documents and hash
        const hash = crypto.createHash('sha256').update(rawText).digest('hex');
        
        const existingDocs = await db.select().from(rawDocuments).where(eq(rawDocuments.fileId, fileId)).limit(1);
        
        if (existingDocs.length === 0) {
            await db.insert(rawDocuments).values({
               userId, fileId, mimeType: fileRecord.mimeType, text: rawText, hash 
            });
        } else {
            await db.update(rawDocuments).set({ text: rawText, hash, updatedAt: new Date() }).where(eq(rawDocuments.id, existingDocs[0]!.id));
        }
        
        // 6. Finalize drive_files phase + enqueue next
        await db.update(driveFiles).set({
            ingestionPhase: "chunk_pending",
            hash,
            ingestionError: finalErrorMsg, // Clear or set the warning
            retryCount: 0, // Success wipes retries
            updatedAt: new Date()
        }).where(eq(driveFiles.id, fileRecord.id));
        
        await enqueueDriveVectorizeJob(userId, fileId);
        console.log(`[Job ${messageId}] ✅ Completed Fetch. Queued Vectorize for ${fileId}.`);
        
    } catch (err: any) {
        const errMsg = err.message?.substring(0, 1000) || "Unknown Error";
        // Handle Retries
        let isPermanent = false;
        if (err.response?.status && err.response.status >= 400 && err.response.status < 500) {
            isPermanent = true; // e.g., 403 Forbidden, 404 Not Found
        }
        
        const currentRetries = fileRecord.retryCount || 0;
        const LOG = `[Job ${messageId}][${fileRecord.name ?? fileId}]`;
        
        if (isPermanent || currentRetries >= 2) {
             console.error(`${LOG} 💥 Terminal failure. Permanent=${isPermanent}, Retries=${currentRetries}. Error: ${errMsg}`);
             await db.update(driveFiles).set({
                 ingestionPhase: "failed",
                 ingestionError: errMsg,
                 updatedAt: new Date()
             }).where(eq(driveFiles.id, fileRecord.id));
        } else {
             console.error(`${LOG} ⚠️ Retryable failure. Attempt ${currentRetries + 1}/3. Error: ${errMsg}`);
             // Always persist the latest error so UI can show it even during retrying
             await db.update(driveFiles).set({
                 retryCount: currentRetries + 1,
                 lastRetryAt: new Date(),
                 ingestionError: errMsg,
                 updatedAt: new Date()
             }).where(eq(driveFiles.id, fileRecord.id));
             
             // In MVP, we just requeue it immediately at the end of the stream 
             // Production: Use a delayed scheduler. Since we ack this MSG, we must requeue
             setTimeout(async () => {
                 try { await enqueueDriveFetchJob(userId, fileId); } catch(e){}
             }, Math.pow(2, currentRetries + 1) * 1000); 
        }
    }
}

async function mainLoop() {
    console.log(`[Fetch Worker] Starting ${CONSUMER_NAME}...`);
    await redisCreateConsumerGroup(STREAM_NAME, GROUP_NAME);
    
    const client = await getRedisClient();
    console.log(`[Fetch Worker] Listening on stream ${STREAM_NAME}`);
    
    while (true) {
        try {
            // Block for 2 seconds waiting for new jobs
            const response = await redisXReadGroup(STREAM_NAME, GROUP_NAME, CONSUMER_NAME, 1, 2000);
            
            if (response && response.length > 0) {
                const stream = response[0];
                if (stream && stream.messages) {
                    for (const message of stream.messages) {
                        await processJob(message.message, message.id);
                        await redisXAck(STREAM_NAME, GROUP_NAME, message.id);
                        console.log(`[Fetch Worker] Acknowledged ${message.id}`);
                    }
                }
            }
        } catch (err: any) {
            console.error(`[Fetch Worker] Main Loop Error:`, err);
            await new Promise(res => setTimeout(res, 5000)); // Cool down
        }
    }
}

mainLoop().catch(console.error);
