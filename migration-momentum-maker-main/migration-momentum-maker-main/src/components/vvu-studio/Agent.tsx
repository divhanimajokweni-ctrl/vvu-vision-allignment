/**
 * VVU · STUDIO — workspace agent panel.
 */
"use client";
import { useRef, useState, useEffect } from "react";
import { useStudio } from "@/lib/vvu-studio/store";
import { SUGGESTIONS } from "@/lib/vvu-studio/agent";
import { TrashIcon, XIcon, SendIcon } from "./Icons";

function formatMsg(text: string) {
  // Split into paragraphs on blank lines; render ```code``` blocks and `inline code` + **bold**.
  const blocks: { kind: "pre" | "p"; content: string }[] = [];
  const parts = text.split(/```/);
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (i % 2 === 1) {
      blocks.push({ kind: "pre", content: part.replace(/^\n/, "").replace(/\n$/, "") });
    } else {
      for (const para of part.split(/\n{2,}/)) {
        if (para.trim()) blocks.push({ kind: "p", content: para.trim() });
      }
    }
  }
  return blocks.map((b, i) => {
    if (b.kind === "pre") {
      return <pre key={i} className="mono mt-1.5 overflow-x-auto rounded border border-[var(--vs-border)] bg-[var(--vs-bg)] px-2.5 py-2 text-[11px] text-[#c4c4cc]">{b.content}</pre>;
    }
    return <p key={i} className="mt-1.5 text-[12px] text-[var(--vs-text2)] leading-relaxed">{inline(b.content)}</p>;
  });
}

function inline(text: string) {
  const out: (string | { b: string } | { c: string })[] = [];
  let i = 0;
  while (i < text.length) {
    const bold = text.indexOf("**", i);
    const code = text.indexOf("`", i);
    const next = bold === -1 ? code : code === -1 ? bold : Math.min(bold, code);
    if (next === -1) { out.push(text.slice(i)); break; }
    if (next > i) out.push(text.slice(i, next));
    if (next === bold) {
      const end = text.indexOf("**", next + 2);
      if (end === -1) { out.push(text.slice(next)); break; }
      out.push({ b: text.slice(next + 2, end) });
      i = end + 2;
    } else {
      const end = text.indexOf("`", next + 1);
      if (end === -1) { out.push(text.slice(next)); break; }
      out.push({ c: text.slice(next + 1, end) });
      i = end + 1;
    }
  }
  return out.map((p, idx) => {
    if (typeof p === "string") return <span key={idx}>{p}</span>;
    if ("b" in p) return <strong key={idx} className="text-[var(--vs-text)]">{p.b}</strong>;
    return <code key={idx} className="mono rounded bg-[var(--vs-bg3)] px-1 text-[var(--vs-accent)]">{p.c}</code>;
  });
}

export function Agent() {
  const chat = useStudio((s) => s.chat);
  const sendAgent = useStudio((s) => s.sendAgent);
  const clearChat = useStudio((s) => s.clearChat);
  const closeDrawer = useStudio((s) => s.closeDrawer);
  const [input, setInput] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [chat]);

  const submit = () => {
    const t = input.trim();
    if (!t) return;
    sendAgent(t);
    setInput("");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-[52px] items-center gap-2 border-b border-[var(--vs-border)] px-3">
        <span className="mono h-6 w-6 rounded bg-gradient-to-br from-[var(--vs-accentbg)] to-[var(--vs-bg)] text-center text-[9px] font-bold leading-6 text-[var(--vs-accent)]">VVU</span>
        <h2 className="mono text-[12px] font-semibold tracking-wide text-[var(--vs-text)]">VVU Agent</h2>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={clearChat} className="rounded p-1.5 text-[var(--vs-dim)] hover:bg-[var(--vs-bg3)] hover:text-[var(--vs-text)]" aria-label="Clear chat"><TrashIcon size={14} /></button>
          <button onClick={() => closeDrawer("agent")} className="rounded p-1.5 text-[var(--vs-dim)] hover:bg-[var(--vs-bg3)] hover:text-[var(--vs-text)] md:hidden" aria-label="Close"><XIcon size={14} /></button>
        </div>
      </div>

      <div ref={bodyRef} className="flex-1 space-y-3 overflow-y-auto p-3">
        {chat.map((m, i) => (
          <div key={i} className="flex gap-2">
            <span className={
              "mono flex h-6 w-6 shrink-0 items-center justify-center rounded text-[9px] font-bold " +
              (m.role === "agent"
                ? "border border-[#065f46] bg-gradient-to-br from-[var(--vs-accentbg)] to-[var(--vs-bg)] text-[var(--vs-accent)]"
                : "border border-[var(--vs-border2)] bg-[var(--vs-bg4)] text-[var(--vs-text2)]")
            }>
              {m.role === "agent" ? "VVU" : "U"}
            </span>
            <div className="min-w-0 flex-1">
              <div className="rounded-lg rounded-tl-sm border border-[var(--vs-border)] bg-[var(--vs-bg2)] px-2.5 py-2">
                {formatMsg(m.text)}
              </div>
              <div className="mono mt-1 text-[9px] text-[var(--vs-dimmer)]">{m.meta}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-[var(--vs-border)] p-2">
        <div className="mb-2 flex flex-wrap gap-1">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => { sendAgent(s); }}
              className="mono rounded-full border border-[var(--vs-border2)] bg-[var(--vs-bg3)] px-2 py-1 text-[10px] text-[var(--vs-text2)] hover:border-[var(--vs-accent)] hover:text-[var(--vs-accent)]"
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2 rounded-lg border border-[var(--vs-border2)] bg-[var(--vs-bg)] p-2 focus-within:border-[var(--vs-accent2)]">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
            }}
            rows={2}
            placeholder="Ask about gates, depots, hashing…"
            className="mono flex-1 resize-none bg-transparent text-[12px] text-[var(--vs-text)] outline-none placeholder:text-[var(--vs-dimmer)]"
          />
          <div className="flex items-center gap-2">
            <span className="mono rounded border border-[var(--vs-border2)] bg-[var(--vs-bg3)] px-1.5 py-0.5 text-[9px] text-[var(--vs-dim)]">@workspace</span>
            <button onClick={submit} className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--vs-accent2)] text-[#022c22] hover:bg-[var(--vs-accent)]" aria-label="Send">
              <SendIcon size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
