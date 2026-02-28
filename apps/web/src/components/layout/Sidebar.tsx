"use client";

import Link from "next/link";
import { PlusCircle, MessageSquare, Database, Settings, LogOut, CloudSync, FileText, Menu, X } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import DriveSyncModal from "../drive/DriveSyncModal";
import IndexedDocsModal from "../drive/IndexedDocsModal";
import { useAuth } from "@/components/auth/AuthContext";
import { fetchWithAuth } from "@/lib/apiClient";
import { DriveProgressSummary, DriveFileProgress } from "../drive/types";

interface ChatRoom {
  id: string;
  title: string | null;
  updatedAt: string;
}

const POLL_INTERVAL_MS = 3000;

export default function Sidebar() {
  const { logout } = useAuth();
  const pathname = usePathname();
  const [isDriveSyncModalOpen, setIsDriveSyncModalOpen] = useState(false);
  const [isIndexedDocsModalOpen, setIsIndexedDocsModalOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(true);

  // ── Shared drive state (single polling source for both modals) ──────────
  const [driveSummary, setDriveSummary] = useState<DriveProgressSummary | null>(null);
  const [isDriveInitialLoading, setIsDriveInitialLoading] = useState(true);
  const [driveLastSynced, setDriveLastSynced] = useState<Date | null>(null);

  const fetchDriveProgress = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/drive/progress");
      if (res.ok) {
        const data = await res.json();
        setDriveSummary(data);
        setDriveLastSynced(new Date());
        setIsDriveInitialLoading(false);
      }
    } catch (e) {
      console.error("Failed to fetch drive progress:", e);
    }
  }, []);

  // Start polling only when at least one modal is open
  useEffect(() => {
    if (!isDriveSyncModalOpen && !isIndexedDocsModalOpen) return;
    fetchDriveProgress();
    const id = setInterval(fetchDriveProgress, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isDriveSyncModalOpen, isIndexedDocsModalOpen, fetchDriveProgress]);

  // ── Chat history ───────────────────────────────────────────────────────
  useEffect(() => {
    fetchWithAuth("/chats")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.chats) setChats(data.chats); })
      .catch(console.error)
      .finally(() => setIsLoadingChats(false));
  }, [pathname]);

  const indexedFiles: DriveFileProgress[] = driveSummary?.files.filter(f => f.ingestionPhase === "indexed") ?? [];

  const sidebarContent = (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/20">
        <div className="flex items-center justify-between px-2 mb-6 mt-2 text-sand-900">
          <div className="flex items-center gap-3">
            <svg className="size-6 opacity-80" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path d="M24 8C15.1634 8 8 15.1634 8 24C8 32.8366 15.1634 40 24 40C32.8366 40 40 32.8366 40 24C40 15.1634 32.8366 8 24 8ZM24 10C31.732 10 38 16.268 38 24C38 31.732 31.732 38 24 38C16.268 38 10 31.732 10 24C10 16.268 16.268 10 24 10Z" fill="currentColor" />
              <path d="M24 14C18.4772 14 14 18.4772 14 24C14 29.5228 18.4772 34 24 34C29.5228 34 34 29.5228 34 24C34 18.4772 29.5228 14 24 14ZM24 16C28.4183 16 32 19.5817 32 24C32 28.4183 28.4183 32 24 32C19.5817 32 16 28.4183 16 24C16 19.5817 19.5817 16 24 16Z" fill="currentColor" fillOpacity="0.5" />
              <path d="M24 20C21.7909 20 20 21.7909 20 24C20 26.2091 21.7909 28 24 28C26.2091 28 28 26.2091 28 24C28 21.7909 26.2091 20 24 20Z" fill="currentColor" />
            </svg>
            <span className="font-serif text-xl tracking-wide font-light">Biscuit</span>
          </div>
          <button onClick={() => setIsMobileOpen(false)} className="lg:hidden p-1.5 rounded-lg hover:bg-white/30 text-stone-500">
            <X className="size-4" />
          </button>
        </div>

        <Link href="/chat" onClick={() => setIsMobileOpen(false)}
          className="flex items-center gap-2 w-full py-2.5 px-3 rounded-xl bg-white/40 hover:bg-white/60 border border-white/50 text-sand-900 text-sm font-medium transition-all shadow-button hover:shadow-md group">
          <PlusCircle className="size-4 opacity-70 group-hover:opacity-100 transition-opacity" />
          <span>New Chat</span>
        </Link>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <h4 className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest px-3 mb-2">Recent Threads</h4>
        <div className="space-y-1">
          {isLoadingChats ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="h-8 mx-3 rounded-lg bg-stone-200/40 animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
            ))
          ) : chats.length === 0 ? (
            <p className="text-xs text-stone-400 font-light px-3 py-2 italic">No conversations yet.</p>
          ) : (
            chats.map(chat => {
              const isActive = pathname === `/chat/${chat.id}`;
              return (
                <Link key={chat.id} href={`/chat/${chat.id}`} onClick={() => setIsMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors group ${isActive ? "bg-white/50 text-sand-900 shadow-sm" : "text-stone-600 hover:text-sand-900 hover:bg-white/30"}`}>
                  <MessageSquare className={`size-4 shrink-0 ${isActive ? "opacity-70" : "opacity-40 group-hover:opacity-70"}`} />
                  <span className="truncate">{chat.title || "New conversation"}</span>
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* Knowledge Base */}
      <div className="p-4 border-t border-white/20 bg-white/10">
        <h4 className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest px-1 mb-3">Knowledge Base</h4>
        <div className="flex flex-col gap-2">
          <button onClick={() => { setIsDriveSyncModalOpen(true); setIsMobileOpen(false); }}
            className="flex items-center justify-between w-full py-2 px-3 rounded-lg text-sm text-stone-600 hover:text-sand-900 hover:bg-white/30 transition-colors group">
            <div className="flex items-center gap-3">
              <Database className="size-4 opacity-50 group-hover:opacity-80 transition-opacity" />
              <span>Drive Sync</span>
            </div>
            <CloudSync className="size-3.5 opacity-40 group-hover:opacity-100" />
          </button>

          <button onClick={() => { setIsIndexedDocsModalOpen(true); setIsMobileOpen(false); }}
            className="flex items-center gap-3 w-full py-2 px-3 rounded-lg text-sm text-stone-600 hover:text-sand-900 hover:bg-white/30 transition-colors group">
            <FileText className="size-4 opacity-50 group-hover:opacity-80 transition-opacity" />
            <span>Indexed Documents</span>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-stone-200/60">
        <button onClick={logout} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-stone-500 hover:text-stone-800 hover:bg-stone-200/50 transition-colors w-full text-left">
          <LogOut className="size-4 opacity-60" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-30 p-2.5 rounded-xl bg-white/80 backdrop-blur border border-white/60 shadow-button text-stone-600 hover:text-sand-900">
        <Menu className="size-5" />
      </button>

      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-40" onClick={() => setIsMobileOpen(false)} />
      )}

      <div className={`fixed lg:relative inset-y-0 left-0 z-50 lg:z-20 w-64 h-screen border-r border-white/20 bg-pearl-50/90 lg:bg-pearl-50/40 backdrop-blur-3xl shadow-glow flex flex-col shrink-0 transition-transform duration-300 ${isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        {sidebarContent}
      </div>

      {/* Modals — both receive shared drive state */}
      <DriveSyncModal
        isOpen={isDriveSyncModalOpen}
        onClose={() => setIsDriveSyncModalOpen(false)}
        summary={driveSummary}
        isInitialLoading={isDriveInitialLoading}
        lastSynced={driveLastSynced}
        onRefresh={fetchDriveProgress}
      />
      <IndexedDocsModal
        isOpen={isIndexedDocsModalOpen}
        onClose={() => setIsIndexedDocsModalOpen(false)}
        indexedFiles={indexedFiles}
        isLoading={isDriveInitialLoading}
      />
    </>
  );
}
