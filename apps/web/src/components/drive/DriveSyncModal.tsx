"use client";

import { X, CheckCircle2, RotateCcw, AlertTriangle, Loader2, CloudSync } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { fetchWithAuth } from "@/lib/apiClient";
import { DriveProgressSummary, DriveFileProgress, IngestionPhase } from "./types";

interface DriveSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: DriveProgressSummary | null;
  isInitialLoading: boolean;
  lastSynced: Date | null;
  onRefresh: () => Promise<void>;
}

export default function DriveSyncModal({
  isOpen, onClose, summary, isInitialLoading, lastSynced, onRefresh
}: DriveSyncModalProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [isRetryingAll, setIsRetryingAll] = useState(false);

  if (!isOpen) return null;

  const handleStartSync = async () => {
    setIsSyncing(true);
    try {
      await fetchWithAuth("/drive/sync", { method: "POST" });
      await onRefresh();
    } catch (e) { console.error("Failed to start sync", e); }
    finally { setIsSyncing(false); }
  };

  const handleRetry = async (fileId: string) => {
    setRetryingId(fileId);
    try {
      await fetchWithAuth(`/drive/files/${fileId}/retry`, { method: "POST" });
      await onRefresh();
    } catch (e) { console.error("Failed to retry file", e); }
    finally { setRetryingId(null); }
  };

  const handleRetryAll = async () => {
    const failedFiles = summary?.files.filter(f => f.supported && f.ingestionPhase === "failed") ?? [];
    if (!failedFiles.length) return;
    setIsRetryingAll(true);
    for (const file of failedFiles) {
      try { await fetchWithAuth(`/drive/files/${file.fileId}/retry`, { method: "POST" }); }
      catch (e) { console.error(`Retry failed for ${file.fileId}`, e); }
    }
    await onRefresh();
    setIsRetryingAll(false);
  };

  const renderStatusIcon = (phase: IngestionPhase) => {
    switch (phase) {
      case "indexed": return <CheckCircle2 className="size-4 text-emerald-500" />;
      case "failed": return <AlertTriangle className="size-4 text-rose-500" />;
      default: return <Loader2 className="size-4 text-stone-400 animate-spin" />;
    }
  };

  const renderStatusBadge = (file: DriveFileProgress) => {
    switch (file.ingestionPhase) {
      case "indexed":
        return <span className="px-2.5 py-1 bg-emerald-100/50 text-emerald-700 text-[10px] uppercase tracking-widest rounded-full font-medium border border-emerald-200/50">Complete</span>;
      case "failed":
        return (
          <div className="relative group inline-block">
            <span className="px-2.5 py-1 bg-rose-100/50 text-rose-700 text-[10px] uppercase tracking-widest rounded-full font-medium border border-rose-200/50 cursor-help">Failed</span>
            {file.ingestionError && (
              <div className="absolute hidden group-hover:block bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs bg-stone-900 text-white text-[10px] p-2 rounded shadow-xl z-50">
                {file.ingestionError}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-stone-900"></div>
              </div>
            )}
          </div>
        );
      case "chunk_pending":
      case "vectorizing":
        return <span className="px-2.5 py-1 bg-stone-100 text-stone-600 text-[10px] uppercase tracking-widest rounded-full font-medium border border-stone-200">Processing</span>;
      default:
        return <span className="px-2.5 py-1 bg-stone-100 text-stone-500 text-[10px] uppercase tracking-widest rounded-full font-medium border border-stone-200">Queue</span>;
    }
  };

  return createPortal(
    <>
      <div className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-50 animate-in fade-in duration-300" onClick={onClose} />

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-[calc(100vw-1rem)] sm:max-w-3xl animate-in fade-in zoom-in-95 duration-300 p-2 sm:p-4">
        <div className="bg-white/90 backdrop-blur-2xl rounded-4xl sm:rounded-[2.5rem] shadow-levitate border border-white/80 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[85vh]">

          {/* Header */}
          <div className="flex flex-col gap-3 px-4 sm:px-8 py-4 sm:py-6 border-b border-stone-200/50 bg-white/50">
            {/* Row 1: title + close */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-serif text-sand-900 tracking-wide">Drive Synchronization</h2>
                <div className="flex flex-wrap items-center gap-3 sm:gap-6 mt-1.5">
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                    <span className="text-[10px] text-stone-500 uppercase tracking-widest font-semibold">System Active</span>
                  </div>
                  {lastSynced && (
                    <span className="text-[10px] text-stone-400 font-mono tracking-widest">
                      UPDATED: {lastSynced.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={onClose} className="p-2 text-stone-400 hover:text-sand-900 hover:bg-stone-100 rounded-full transition-colors shrink-0">
                <X className="size-5" />
              </button>
            </div>

            {/* Row 2: action buttons — full-width on mobile, inline on sm+ */}
            <div className="flex flex-wrap items-center gap-2">
              {summary && summary.totals.failed > 0 && (
                <button onClick={handleRetryAll} disabled={isRetryingAll}
                  className="flex items-center gap-2 rounded-full h-9 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] uppercase tracking-widest font-medium transition-all disabled:opacity-50">
                  {isRetryingAll ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                  Retry All
                </button>
              )}
              <button onClick={handleStartSync} disabled={isSyncing}
                className="flex items-center gap-2 rounded-full h-9 px-5 bg-stone-900 hover:bg-black text-white text-[11px] uppercase tracking-widest font-medium transition-all shadow-sm disabled:opacity-50">
                {isSyncing ? <Loader2 className="size-3.5 animate-spin" /> : <CloudSync className="size-3.5" />}
                Sync Now
              </button>
            </div>

            {/* 2-col on mobile, 4-col on sm+ */}
            {summary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 pt-3 border-t border-stone-200/50">
                <div className="bg-stone-50 rounded-xl p-3 flex flex-col border border-stone-200/50">
                  <span className="text-[10px] text-stone-400 font-semibold uppercase tracking-widest">Supported</span>
                  <span className="text-2xl font-light text-sand-900 font-serif">{summary.totals.supported}</span>
                </div>
                <div className="bg-emerald-50/50 rounded-xl p-3 flex flex-col border border-emerald-100">
                  <span className="text-[10px] text-emerald-600 font-semibold uppercase tracking-widest">Indexed</span>
                  <span className="text-2xl font-light text-emerald-700 font-serif">{summary.totals.indexed}</span>
                </div>
                <div className="bg-blue-50/50 rounded-xl p-3 flex flex-col border border-blue-100">
                  <span className="text-[10px] text-blue-600 font-semibold uppercase tracking-widest">Processing</span>
                  <span className="text-2xl font-light text-blue-700 font-serif">{summary.totals.inProgress}</span>
                </div>
                <div className="bg-rose-50/50 rounded-xl p-3 flex flex-col border border-rose-100">
                  <span className="text-[10px] text-rose-600 font-semibold uppercase tracking-widest">Failed</span>
                  <span className="text-2xl font-light text-rose-700 font-serif">{summary.totals.failed}</span>
                </div>
              </div>
            )}
          </div>

          {/* Table — horizontal scroll on mobile */}
          <div className="overflow-y-auto bg-stone-50/30 p-2">
            <div className="overflow-x-auto">
              <div className="border border-white/60 rounded-3xl overflow-hidden bg-white/50 backdrop-blur-sm shadow-sm m-3">
              {isInitialLoading ? (
                <div className="divide-y divide-stone-200/30">
                  {[...Array(7)].map((_, i) => (
                    <div key={i} className="px-6 py-4 flex items-center gap-3 animate-pulse" style={{ animationDelay: `${i * 60}ms` }}>
                      <div className="size-4 rounded-full bg-stone-200/80 shrink-0"></div>
                      <div className="h-3.5 bg-stone-200/80 rounded flex-1" style={{ width: `${45 + (i * 13) % 40}%` }}></div>
                      <div className="h-6 w-20 bg-stone-200/50 rounded-full"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <table className="min-w-full divide-y divide-stone-200/50">
                  <thead className="bg-stone-100/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-[10px] font-semibold text-stone-500 uppercase tracking-[0.2em]">Document</th>
                      <th className="px-6 py-4 text-left text-[10px] font-semibold text-stone-500 uppercase tracking-[0.2em]">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200/30">
                    {summary?.files.filter(f => f.supported).map(file => (
                      <tr key={file.fileId} className="hover:bg-white/60 transition-colors">
                         <td className="px-6 py-4 max-w-0 w-full">
                          <div className="flex items-center gap-3 min-w-0">
                            {renderStatusIcon(file.ingestionPhase)}
                            <span className="text-sm font-medium text-sand-900 tracking-wide truncate">{file.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap flex items-center justify-between gap-4">
                          {renderStatusBadge(file)}
                          {file.ingestionPhase === "failed" && file.supported && (
                            <button onClick={() => handleRetry(file.fileId)} disabled={retryingId === file.fileId}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-[10px] font-medium text-stone-600 hover:text-sand-900 hover:bg-stone-50 transition-colors shadow-sm disabled:opacity-50 uppercase tracking-widest">
                              {retryingId === file.fileId ? <Loader2 className="size-3 animate-spin" /> : <RotateCcw className="size-3" />}
                              Retry
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {(!summary?.files || summary.files.filter(f => f.supported).length === 0) && (
                      <tr>
                        <td colSpan={2} className="px-6 py-8 text-center text-sm text-stone-500 font-light italic">
                          No files found. Click "Sync Now" to import from Google Drive.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
