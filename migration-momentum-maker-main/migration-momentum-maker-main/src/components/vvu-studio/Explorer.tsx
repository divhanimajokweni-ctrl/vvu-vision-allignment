/**
 * VVU · STUDIO — file explorer (tree).
 */
"use client";
import { useStudio } from "@/lib/vvu-studio/store";
import { FILE_SYSTEM, TAB_META, type FsNode } from "@/lib/vvu-studio/fs";
import type { ViewKey } from "@/lib/vvu-studio/types";
import { ChevronIcon, FilesIcon } from "./Icons";

function extBadge(ext?: "md" | "py" | "json") {
  if (!ext) return null;
  const map = {
    md: { label: "M", color: "text-[var(--vs-blue)]" },
    py: { label: "P", color: "text-[var(--vs-yellow)]" },
    json: { label: "{}", color: "text-[var(--vs-orange)]" },
  } as const;
  const e = map[ext];
  return (
    <span className={"mono flex h-4 w-4 shrink-0 items-center justify-center rounded text-[8px] font-bold " + e.color}>
      {e.label}
    </span>
  );
}

function Node({ node, depth }: { node: FsNode; depth: number }) {
  const active = useStudio((s) => s.activeTab);
  const folders = useStudio((s) => s.folders);
  const toggleFolder = useStudio((s) => s.toggleFolder);
  const openFile = useStudio((s) => s.openFile);

  if (node.children) {
    const isOpen = depth === 0 ? true : folders[node.name] ?? false;
    return (
      <div>
        <button
          onClick={() => toggleFolder(node.name)}
          className="flex w-full items-center gap-1.5 px-2.5 py-[5px] text-left text-[12px] text-[var(--vs-text2)] hover:bg-[var(--vs-bg3)]"
          style={{ paddingLeft: 6 + depth * 14 }}
        >
          <ChevronIcon size={12} className={isOpen ? "rotate-90 text-[var(--vs-dim)] transition-transform" : "text-[var(--vs-dim)] transition-transform"} />
          <span className="mono h-4 w-4 shrink-0 rounded bg-[var(--vs-accentbg)] text-center text-[8px] font-bold leading-4 text-[var(--vs-accent)]">▸</span>
          <span className="mono text-[11px]">{node.name}</span>
        </button>
        {isOpen && node.children.map((c) => <Node key={c.name} node={c} depth={depth + 1} />)}
      </div>
    );
  }

  const view = node.view as ViewKey;
  const isActive = active === view;
  return (
    <button
      onClick={() => openFile(view)}
      className="flex w-full items-center gap-1.5 px-2.5 py-[5px] text-left text-[12px] hover:bg-[var(--vs-bg3)]"
      style={{
        paddingLeft: 6 + depth * 14,
        borderLeft: isActive ? "2px solid var(--vs-accent)" : "2px solid transparent",
        background: isActive ? "var(--vs-bg4)" : undefined,
        color: isActive ? "var(--vs-text)" : "var(--vs-text2)",
      }}
    >
      <span className="w-3" />
      {extBadge(node.ext)}
      <span className="mono truncate text-[11px]">{node.name}</span>
    </button>
  );
}

export function Explorer() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--vs-border)] px-3 py-2">
        <span className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--vs-dim)]">Explorer</span>
        <FilesIcon size={13} className="text-[var(--vs-dim)]" />
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        <div className="mono px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--vs-dimmer)]">VVU-STUDIO</div>
        {FILE_SYSTEM.children?.map((c) => <Node key={c.name} node={c} depth={1} />)}
      </div>
      <div className="border-t border-[var(--vs-border)] px-3 py-2">
        <div className="mono text-[9px] uppercase tracking-[0.14em] text-[var(--vs-dimmer)]">doctrine</div>
        <div className="text-[11px] text-[var(--vs-dim)]">computed gates · stubbed flagged · strong = suspicious</div>
      </div>
    </div>
  );
}

export { TAB_META };
