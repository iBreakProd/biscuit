"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { fetchWithAuth } from "@/lib/apiClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function NewChatPage() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isCreating) return;

    setIsCreating(true);
    try {
      const res = await fetchWithAuth("/chats", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initialMessage: trimmed })
      });
      if (!res.ok) throw new Error("Failed to create chat");
      
      const chat = await res.json();
      
      // Navigate to the room with the taskId and message so the [id] page can 
      // instantly render the user message and attach to the agent SSE stream.
      router.push(`/chat/${chat.id}?taskId=${chat.initialTaskId}&q=${encodeURIComponent(trimmed)}`);
    } catch (err) {
      console.error(err);
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full relative">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 flex items-center h-18 shrink-0 px-4 lg:px-8
        bg-stone-100/90 backdrop-blur-xl border-b border-stone-200/70
        shadow-[0_1px_0_rgba(0,0,0,0.06),0_4px_20px_-6px_rgba(0,0,0,0.08)]">
        <div className="w-10 shrink-0 lg:hidden" />
        <h2 className="text-lg font-serif text-sand-900 tracking-wide">New Conversation</h2>
      </div>

      {/* Content column */}
      <div className="flex flex-col flex-1 w-full max-w-5xl mx-auto overflow-y-auto px-4 lg:px-8 py-6">
        {/* Empty state */}
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-6 opacity-60 pb-40">
          <div className="size-16 rounded-full bg-linear-to-tr from-stone-100 to-white flex items-center justify-center border border-white shadow-sm">
            <span className="material-symbols-outlined text-[32px] font-thin text-stone-400">forum</span>
          </div>
          <p className="text-stone-500 font-light tracking-wide max-w-md">
            Ask anything about your indexed Google Drive documents.
          </p>
        </div>

      {/* Input */}
      <div className="shrink-0 w-full px-3 sm:px-6 lg:px-8 pb-4 sm:pb-6 lg:pb-8 pt-4 bg-linear-to-t from-pearl-50 via-pearl-50/90 to-transparent relative z-20">
        <form
          onSubmit={handleSubmit}
          className="relative max-w-3xl mx-auto bg-white/70 backdrop-blur-xl border border-white/60 shadow-levitate rounded-3xl sm:rounded-4xl p-1.5 sm:p-2 flex items-end gap-2 transition-all hover:bg-white/80 focus-within:bg-white focus-within:shadow-glow-hover"
        >
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask anything about your documents..."
            className="flex-1 max-h-36 sm:max-h-48 min-h-[48px] sm:min-h-[56px] bg-transparent border-none resize-none py-3 sm:py-4 px-4 sm:px-6 text-sand-900 placeholder:text-stone-400 focus:outline-none focus:ring-0 text-[15px] sm:text-base font-light tracking-wide overflow-y-auto"
            rows={1}
            disabled={isCreating}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
            }}
          />
          <div className="flex items-center gap-2 pr-2 pb-2">
            <button
              type="submit"
              disabled={!input.trim() || isCreating}
              className="size-10 rounded-full bg-stone-900 flex items-center justify-center text-white disabled:opacity-50 disabled:bg-stone-300 hover:bg-black transition-all shadow-button disabled:shadow-none"
            >
              <Send className="size-4 ml-0.5" strokeWidth={2} />
            </button>
          </div>
        </form>
        <div className="text-center mt-3 text-[10px] text-stone-400 font-light uppercase tracking-widest">
          AI agents can make mistakes. Verify critical citations.
        </div>
      </div>
      </div>
    </div>
  );
}
