"use client";

import { X, FileText, Download } from "lucide-react";
import { useEffect, useState } from "react";

interface CitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  citationConfig: {
    chunkId: string;
    fileName: string;
  } | null;
}

export default function CitationModal({ isOpen, onClose, citationConfig }: CitationModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  // Mock data for the UI scaffolding. Will be replaced by React Query fetching GET /drive/chunk/:chunkId
  const mockContent = `This is the retrieved context from the Google Drive file. When we connect the backend API, this will display the specific vector chunk matching the citation, along with its immediate neighbors (chunk index ± 1) to provide full context.
  
The ragify pipeline ensures that even large Enterprise documents are seamlessly vectorized and retrievable in milliseconds.`;

  useEffect(() => {
    if (isOpen && citationConfig) {
      setIsLoading(true);
      // Mock fetch
      const timer = setTimeout(() => setIsLoading(false), 800);
      return () => clearTimeout(timer);
    }
  }, [isOpen, citationConfig]);

  if (!isOpen || !citationConfig) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-50 animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl animate-in fade-in zoom-in-95 duration-300 p-4">
        <div className="bg-white/80 backdrop-blur-2xl rounded-4xl shadow-levitate border border-white/80 overflow-hidden flex flex-col max-h-[80vh]">
          
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-stone-200/50 bg-white/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-stone-100/80 border border-white shadow-sm text-stone-500">
                <FileText className="size-5" strokeWidth={1.5} />
              </div>
              <div className="flex flex-col">
                <h3 className="text-sand-900 font-medium tracking-wide truncate max-w-[300px]">
                  {citationConfig.fileName}
                </h3>
                <span className="text-[10px] text-stone-400 uppercase tracking-widest font-semibold mt-0.5">
                  Drive Ingestion Source
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button className="p-2 text-stone-400 hover:text-sand-900 hover:bg-stone-100 rounded-full transition-colors">
                <Download className="size-4" />
              </button>
              <button 
                onClick={onClose}
                className="p-2 text-stone-400 hover:text-sand-900 hover:bg-stone-100 rounded-full transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-6 md:p-8 overflow-y-auto w-full bg-linear-to-b from-transparent to-stone-50/50">
            {isLoading ? (
              <div className="flex flex-col gap-4 animate-pulse">
                <div className="h-4 bg-stone-200/60 rounded-full w-3/4"></div>
                <div className="h-4 bg-stone-200/60 rounded-full w-full"></div>
                <div className="h-4 bg-stone-200/60 rounded-full w-5/6"></div>
                <div className="h-4 bg-stone-200/60 rounded-full w-4/5 mt-4"></div>
                <div className="h-4 bg-stone-200/60 rounded-full w-full"></div>
              </div>
            ) : (
              <div className="prose prose-stone prose-p:leading-loose prose-p:font-light prose-p:tracking-wide text-[15px] prose-p:text-stone-600 max-w-none">
                {/* For highlighting, we can later map over matched text. For now, render raw text */}
                <p className="whitespace-pre-wrap">{mockContent}</p>
                
                <div className="mt-8 py-3 px-4 rounded-2xl bg-stone-100/50 border border-stone-200/50 inline-flex items-center gap-3">
                   <div className="size-2 rounded-full bg-emerald-400 animate-pulse"></div>
                   <span className="text-[11px] font-medium text-stone-500 uppercase tracking-widest">
                     Chunk ID: {citationConfig.chunkId.substring(0, 8)}...
                   </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
