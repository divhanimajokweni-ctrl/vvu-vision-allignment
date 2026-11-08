/**
 * VVU · STUDIO — terminal panel.
 */
"use client";
import { useRef, useState, useEffect } from "react";
import { useStudio } from "@/lib/vvu-studio/store";
import { TrashIcon, XIcon } from "./Icons";

export function Terminal() {
  const term = useStudio((s) => s.term);
  const runTerminal = useStudio((s) => s.runTerminal);
  const clearTerm = useStudio((s) => s.clearTerm);
  const closeDrawer = useStudio((s) => s.closeDrawer);
  const [input, setInput] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [term]);

  const lineClass = (t: string) =>
    t === "err" ? "text-[var(--vs-red)]" :
    t === "ok" ? "text-[var(--vs-accent)]" :
    t === "warn" ? "text-[var(--vs-amber)]" :
    t === "dim" ? "text-[var(--vs-dim)]" :
    t === "in" ? "text-[var(--vs-text)]" :
    "text-[#c4c4cc]";

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 items-center gap-1 border-b border-[var(--vs-border)] px-2">
        <div className="mono flex items-center gap-3 px-1 text-[10px] uppercase tracking-[0.1em]">
          <span className="border-b border-[var(--vs-accent)] pb-1.5 pt-1 text-[var(--vs-accent)]">TERMINAL</span>
          <span className="text-[var(--vs-dim)] hover:text-[var(--vs-text2)]">OUTPUT</span>
          <span className="text-[var(--vs-dim)] hover:text-[var(--vs-text2)]">PROBLEMS</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={clearTerm} className="rounded p-1.5 text-[var(--vs-dim)] hover:bg-[var(--vs-bg3)] hover:text-[var(--vs-text)]" aria-label="Clear"><TrashIcon size={13} /></button>
          <button onClick={() => closeDrawer("terminal")} className="rounded p-1.5 text-[var(--vs-dim)] hover:bg-[var(--vs-bg3)] hover:text-[var(--vs-text)] md:hidden" aria-label="Close"><XIcon size={13} /></button>
        </div>
      </div>

      <div ref={bodyRef} className="mono flex-1 overflow-y-auto px-3.5 py-2.5 text-[12px] leading-[1.65]">
        {term.map((l, i) => (
          <div key={i} className={lineClass(l.t)}>
            {l.t === "in" && <span className="text-[var(--vs-accent)]">❯ </span>}
            {l.v || "\u00A0"}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-[var(--vs-border)] px-3 py-2">
        <span className="mono text-[12px] text-[var(--vs-accent)]">❯</span>
        <span className="mono hidden text-[12px] text-[#569cd6] sm:inline">~/vvu-studio</span>
        <span className="mono text-[12px] text-[var(--vs-dim)]">$</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              runTerminal(input);
              setInput("");
            }
          }}
          placeholder="help"
          className="mono flex-1 bg-transparent text-[12px] text-[var(--vs-text)] outline-none placeholder:text-[var(--vs-dimmer)]"
        />
      </div>
    </div>
  );
}
