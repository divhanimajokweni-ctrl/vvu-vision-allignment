/**
 * VVU · STUDIO — empty editor state.
 */
"use client";
import { useStudio } from "@/lib/vvu-studio/store";
import { FilesIcon } from "../Icons";
import type { ViewKey } from "@/lib/vvu-studio/types";

export function EmptyView() {
  const openFile = useStudio((s) => s.openFile);
  const shortcuts: { label: string; view: ViewKey }[] = [
    { label: "README.md", view: "readme" },
    { label: "lab1_lucky.py", view: "lab1" },
    { label: "pipeline.py", view: "ive" },
    { label: "gate_eval.py", view: "depot" },
  ];
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <FilesIcon size={40} className="text-[var(--vs-dimmer)]" />
      <div className="mono text-[11px] tracking-[0.18em] text-[var(--vs-dimmer)]">NO OPEN EDITORS</div>
      <div className="text-[12px] text-[var(--vs-dim)]">Open a file from the explorer, or jump to a common starting point.</div>
      <div className="mt-1 flex flex-wrap justify-center gap-1.5">
        {shortcuts.map((s) => (
          <button
            key={s.view}
            onClick={() => openFile(s.view)}
            className="mono rounded border border-[var(--vs-border2)] bg-[var(--vs-bg3)] px-2 py-1 text-[11px] text-[var(--vs-text2)] hover:border-[var(--vs-accent2)] hover:text-[var(--vs-accent)]"
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
