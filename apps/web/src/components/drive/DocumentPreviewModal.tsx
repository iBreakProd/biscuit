"use client";

import { X, ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileId: string | null;
  fileName?: string;
}

export default function DocumentPreviewModal({
  isOpen,
  onClose,
  fileId,
  fileName,
}: DocumentPreviewModalProps) {
  const [mounted, setMounted] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset loading state whenever file changes
  useEffect(() => {
    if (isOpen && fileId) {
      setIframeLoading(true);
    }
  }, [isOpen, fileId]);

  if (!isOpen || !mounted || !fileId) return null;

  const previewUrl = `https://drive.google.com/file/d/${fileId}/preview`;
  const driveUrl = `https://drive.google.com/file/d/${fileId}`;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm z-[60] animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-full max-w-5xl h-[88vh] animate-in fade-in zoom-in-95 duration-300 p-4 flex flex-col">
        <div className="bg-white/95 backdrop-blur-2xl rounded-[2.5rem] shadow-levitate border border-white/80 overflow-hidden flex flex-col h-full">

          {/* Header */}
          <div className="flex items-center justify-between px-8 py-4 border-b border-stone-200/50 bg-white/60 shrink-0">
            <div className="flex items-center gap-3 overflow-hidden">
              <div>
                <p className="text-sm font-medium text-sand-900 tracking-wide truncate max-w-[500px]">
                  {fileName ?? "Document Preview"}
                </p>
                <p className="text-[10px] text-stone-400 uppercase tracking-widest font-semibold mt-0.5">
                  Google Drive Viewer
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-4">
              <a
                href={driveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[11px] text-stone-500 hover:text-sand-900 transition-colors uppercase tracking-widest font-medium px-3 py-1.5 rounded-full hover:bg-stone-100"
              >
                Open in Drive
                <ExternalLink className="size-3" />
              </a>
              <button
                onClick={onClose}
                className="p-2 text-stone-400 hover:text-sand-900 hover:bg-stone-100 rounded-full transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>

          {/* Iframe */}
          <div className="relative flex-1 bg-stone-100/50">
            {iframeLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-stone-50 z-10">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="size-6 text-stone-400 animate-spin" />
                  <p className="text-xs text-stone-400 font-medium uppercase tracking-widest">Loading preview…</p>
                </div>
              </div>
            )}
            <iframe
              src={previewUrl}
              className="w-full h-full border-0"
              allow="autoplay"
              onLoad={() => setIframeLoading(false)}
              title={fileName ?? "Document Preview"}
            />
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
