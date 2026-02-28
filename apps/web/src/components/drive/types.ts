// Shared types for drive file state — used by DriveSyncModal, IndexedDocsModal, and Sidebar
export type IngestionPhase = "discovered" | "fetching" | "chunk_pending" | "vectorizing" | "indexed" | "failed";

export interface DriveFileProgress {
  fileId: string;
  name: string;
  mimeType: string;
  ingestionPhase: IngestionPhase;
  ingestionError?: string;
  supported: boolean;
}

export interface DriveProgressSummary {
  totals: {
    supported: number;
    unsupported: number;
    indexed: number;
    inProgress: number;
    failed: number;
  };
  files: DriveFileProgress[];
}
