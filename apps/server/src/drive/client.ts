import { google, drive_v3 } from "googleapis";

export async function getDriveClient(tokens: any) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  
  oauth2Client.setCredentials(tokens);
  
  return google.drive({ version: "v3", auth: oauth2Client });
}

export type DriveFileMetadata = {
  fileId: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: number;
};

export async function listDriveFilesForUser(tokens: any): Promise<DriveFileMetadata[]> {
  const drive = await getDriveClient(tokens);
  
  try {
    const res = await drive.files.list({
      q: "trashed = false", // Only active files
      fields: "nextPageToken, files(id, name, mimeType, modifiedTime, size)",
      spaces: "drive",
      pageSize: 100, // Reasonable batch limit for phase 5
    });
    
    const files = res.data.files || [];
    
    return files.map(file => ({
      fileId: file.id as string,
      name: file.name as string,
      mimeType: file.mimeType as string,
      modifiedTime: file.modifiedTime as string,
      size: file.size ? parseInt(file.size, 10) : undefined,
    }));
  } catch (error) {
    console.error("Google Drive API List Error:", error);
    throw error;
  }
}
