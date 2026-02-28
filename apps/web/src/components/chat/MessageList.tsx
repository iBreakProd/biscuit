import { Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";
import DocumentPreviewModal from "../drive/DocumentPreviewModal";

// Using basic types for the mockup until we hook to the backend
export type MessageSource = "user" | "bot";
export type MessageStatus = "sending" | "sent" | "error";

export type Citation = 
  | { type: "drive"; fileId: string; chunkId: string; fileName: string }
  | { type: "web"; url: string; title: string; snippet?: string };

export interface ChatMessageProps {
  id: string;
  content: string;
  source: MessageSource;
  status?: MessageStatus;
  citations?: Citation[];
  isThinking?: boolean;
}

export default function MessageList({ messages }: { messages: ChatMessageProps[] }) {
  const [activeCite, setActiveCite] = useState<Citation | null>(null);

  return (
    <>
      <div className="flex flex-col gap-6 w-full">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} {...msg} onCiteClick={setActiveCite} />
        ))}
      </div>

      <DocumentPreviewModal 
        isOpen={activeCite !== null && activeCite.type === "drive"}
        onClose={() => setActiveCite(null)}
        fileId={activeCite?.type === "drive" ? activeCite.fileId : null}
        fileName={activeCite?.type === "drive" ? activeCite.fileName : undefined}
      />
    </>
  );
}

function MessageBubble({ content, source, citations, status, onCiteClick }: ChatMessageProps & { onCiteClick: (c: Citation) => void }) {
  const isUser = source === "user";

  if (isUser) {
    return (
      <div className="flex w-full justify-end animate-in fade-in slide-in-from-right-2 duration-300">
        <div className="max-w-[80%] md:max-w-[70%] text-right">
          <div className="inline-block px-5 py-3.5 rounded-2xl rounded-tr-sm bg-stone-100/80 text-sand-900 border border-stone-200/50 shadow-sm text-[15px] leading-relaxed font-light tracking-wide text-left">
            {content}
          </div>
          {status === "sending" && (
            <div className="text-[10px] text-stone-400 mt-1 uppercase tracking-widest px-2 opacity-60">Sending...</div>
          )}
        </div>
      </div>
    );
  }

  // AI Message
  return (
    <div className="flex w-full group animate-in fade-in slide-in-from-left-2 duration-500">
      {/* Bot Avatar */}
      <div className="w-10 h-10 rounded-full flex items-center justify-center mr-4 shrink-0 bg-transparent">
        <div className="size-8 rounded-full bg-linear-to-tr from-stone-100 to-white flex items-center justify-center border border-white shadow-sm ring-1 ring-black/5">
           <span className="material-symbols-outlined text-[18px] font-thin text-stone-500">auto_awesome</span>
        </div>
      </div>
      
      {/* Bot Content */}
      <div className="flex flex-col min-h-[40px] max-w-[85%] mt-1">
        <div className="text-sand-900 font-light text-[15px] leading-relaxed tracking-wide prose prose-stone prose-p:leading-relaxed prose-pre:bg-stone-900 prose-pre:text-pearl-50 prose-a:text-stone-600 prose-a:underline-offset-4 max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        </div>
        
        {/* Citations Panel */}
        {citations && citations.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-stone-200/50">
            {citations.map((cite, i) => (
              <button 
                key={i}
                onClick={() => cite.type === "drive" ? onCiteClick(cite) : window.open(cite.url, "_blank")}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/40 hover:bg-white/80 transition-colors rounded-xl border border-stone-200/60 shadow-sm cursor-pointer group/cite"
              >
                <span className="material-symbols-outlined text-[14px] text-stone-400 group-hover/cite:text-stone-600 transition-colors">
                  {cite.type === "drive" ? "description" : "language"}
                </span>
                <span className="text-[11px] font-medium text-stone-500 truncate max-w-[150px] uppercase tracking-wider">
                  {cite.type === "drive" ? cite.fileName : cite.title}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
