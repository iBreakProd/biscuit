"use client";

import { X, FileText, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { DriveFileProgress } from "./types";
import DocumentPreviewModal from "./DocumentPreviewModal";

interface IndexedDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
  indexedFiles: DriveFileProgress[];
  isLoading: boolean;
}

export default function IndexedDocsModal({ isOpen, onClose, indexedFiles, isLoading }: IndexedDocsModalProps) {
  const [selectedFile, setSelectedFile] = useState<{ fileId: string; name: string } | null>(null);

  if (!isOpen) return null;

  const modal = createPortal(
    <>
      <div className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-50 animate-in fade-in duration-300" onClick={onClose} />

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-[calc(100vw-1rem)] sm:max-w-2xl animate-in fade-in zoom-in-95 duration-300 p-2 sm:p-4">
        <div className="bg-white/90 backdrop-blur-2xl rounded-4xl sm:rounded-[2.5rem] shadow-levitate border border-white/80 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[80vh]">

          {/* Header */}
          <div className="flex items-center justify-between gap-4 px-6 sm:px-8 py-5 sm:py-6 border-b border-stone-200/50 bg-white/50">
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-9 sm:size-10 rounded-full bg-emerald-100/50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                <FileText className="size-4 sm:size-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-serif text-sand-900 tracking-wide">Ready for Retrieval</h2>
                <div className="text-xs text-stone-500 uppercase tracking-widest font-medium mt-0.5">
                  {isLoading ? "Fetching catalog..." : `${indexedFiles.length} Documents Indexed`}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-stone-400 hover:text-sand-900 hover:bg-stone-100 rounded-full transition-colors shrink-0">
              <X className="size-5" />
            </button>
          </div>

          {/* List */}
          <div className="overflow-y-auto bg-stone-50/30 p-4 sm:p-6 space-y-3">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 bg-white border border-stone-200/60 p-4 rounded-2xl animate-pulse" style={{ animationDelay: `${i * 70}ms` }}>
                    <div className="size-5 rounded-full bg-stone-200/80 shrink-0" />
                    <div className="flex flex-col gap-1.5 flex-1">
                      <div className="h-3.5 bg-stone-200/80 rounded" style={{ width: `${40 + (i * 17) % 45}%` }} />
                      <div className="h-2.5 bg-stone-100 rounded w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : indexedFiles.length > 0 ? (
              indexedFiles.map(file => (
                <button
                  key={file.fileId}
                  onClick={() => setSelectedFile({ fileId: file.fileId, name: file.name })}
                  className="w-full flex items-center gap-3 sm:gap-4 bg-white border border-stone-200/60 p-3 sm:p-4 rounded-2xl shadow-sm hover:shadow-md hover:border-stone-300 hover:bg-stone-50/50 transition-all group text-left"
                >
                  <CheckCircle2 className="size-5 text-emerald-500 shrink-0" />
                  <div className="flex flex-col overflow-hidden flex-1 min-w-0">
                    <span className="text-sm font-medium text-sand-900 tracking-wide truncate">{file.name}</span>
                    <span className="text-[10px] text-stone-400 font-mono uppercase mt-1">{file.mimeType}</span>
                  </div>
                  <span className="text-[10px] text-stone-400 uppercase tracking-widest font-medium opacity-0 group-hover:opacity-100 transition-opacity shrink-0 hidden sm:block">Preview →</span>
                </button>
              ))
            ) : (
              <div className="text-center py-12 px-6">
                <div className="inline-flex size-12 items-center justify-center rounded-full bg-stone-100 mb-4">
                  <FileText className="size-5 text-stone-400" />
                </div>
                <h3 className="text-sm font-medium text-stone-900 mb-1">No Indexed Documents</h3>
                <p className="text-xs text-stone-500">Sync and wait for vectorization to complete before documents appear here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );

  return (
    <>
      {modal}
      <DocumentPreviewModal
        isOpen={!!selectedFile}
        onClose={() => setSelectedFile(null)}
        fileId={selectedFile?.fileId ?? null}
        fileName={selectedFile?.name}
      />
    </>
  );
}
