import { Loader2, CheckCircle2, Circle } from "lucide-react";

export interface AgentThoughtLoaderProps {
  plan?: string[];
  thoughts: { id: string, text: string }[];
  currentStepIndex: number;
}

export default function AgentThoughtLoader({ plan, thoughts, currentStepIndex }: AgentThoughtLoaderProps) {
  return (
    <div className="flex w-full mb-6 group animate-in slide-in-from-bottom-2 fade-in duration-500">
      {/* Bot Avatar */}
      <div className="w-10 h-10 rounded-full flex items-center justify-center mr-4 shrink-0 bg-transparent">
        <div className="size-8 rounded-full bg-linear-to-tr from-stone-100 to-white flex items-center justify-center border border-white shadow-sm ring-1 ring-black/5 animate-pulse">
           <span className="material-symbols-outlined text-[18px] font-thin text-stone-400">auto_awesome</span>
        </div>
      </div>
      
      <div className="flex flex-col flex-1 min-h-[40px] max-w-[85%] pt-1 gap-3">
        {/* Plan Checklist Section */}
        {plan && plan.length > 0 && (
          <div className="glass-card flex flex-col gap-2 p-4 rounded-2xl border border-white/60 shadow-sm max-w-lg mb-2">
            <h4 className="text-xs font-medium text-stone-500 uppercase tracking-widest border-b border-stone-200/60 pb-2 mb-1">
              Agent Plan
            </h4>
            {plan.map((step, idx) => {
              // 1-indexed to match currentStepIndex which starts 1-indexed for execution
              const stepNumber = idx + 1;
              const isCompleted = stepNumber < currentStepIndex;
              const isCurrent = stepNumber === currentStepIndex;
              
              return (
                <div key={idx} className="flex items-start gap-2.5">
                  {isCompleted ? (
                    <CheckCircle2 className="size-4 shrink-0 text-stone-400 mt-0.5" />
                  ) : isCurrent ? (
                    <Loader2 className="size-4 shrink-0 text-stone-500 animate-spin mt-0.5" />
                  ) : (
                    <Circle className="size-4 shrink-0 text-stone-300 mt-0.5" />
                  )}
                  <span className={`text-sm tracking-wide ${isCompleted ? 'text-stone-400 line-through opacity-70' : isCurrent ? 'text-stone-700 font-medium' : 'text-stone-500'}`}>
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Thoughts History Log */}
        <div className="flex flex-col gap-2 relative pl-2 border-l border-stone-200/60 ml-2">
          {thoughts.map((thought, idx) => {
            const isLast = idx === thoughts.length - 1;
            return (
              <div key={thought.id} className="flex items-start sm:items-center gap-3">
                  {isLast ? (
                    <Loader2 className="size-3.5 animate-spin text-stone-400 shrink-0 mt-0.5 sm:mt-0" />
                  ) : (
                    <div className="size-3.5 rounded-full border border-stone-200 bg-stone-100 shrink-0 mt-0.5 sm:mt-0" />
                  )}
                  <span className={`font-serif italic text-sm tracking-wide wrap-break-word whitespace-pre-wrap ${isLast ? 'text-stone-600 animate-pulse-slow' : 'text-stone-400 opacity-60'}`}>
                    {thought.text}
                  </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
