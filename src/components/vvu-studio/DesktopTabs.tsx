/**
 * VVU · STUDIO — desktop tab strip + breadcrumb.
 */
"use client";
import { useStudio } from "@/lib/vvu-studio/store";
import { TAB_META, groupOf } from "@/lib/vvu-studio/fs";
import { XIcon } from "./Icons";
import type { ViewKey } from "@/lib/vvu-studio/types";

function extBadge(ext: "md" | "py" | "json") {
  const map = {
    md: { label: "M", color: "text-[var(--vs-blue)]" },
    py: { label: "P", color: "text-[var(--vs-yellow)]" },
    json: { label: "{}", color: "text-[var(--vs-orange)]" },
  } as const;
  const e = map[ext];
  return (
    <span className={"mono flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded text-[7px] font-bold " + e.color}>
      {e.label}
    </span>
  );
}

export function DesktopTabs() {
  const openTabs = useStudio((s) => s.openTabs);
  const active = useStudio((s) => s.activeTab);
  const setActive = useStudio((s) => s.setActive);
  const closeTab = useStudio((s) => s.closeTab);

  return (
    <div className="vvu-no-scrollbar flex h-[35px] items-stretch overflow-x-auto border-b border-[var(--vs-border)] bg-[var(--vs-bg2)]">
      {openTabs.map((view: ViewKey) => {
        const meta = TAB_META[view];
        const isActive = active === view;
        return (
          <div
            key={view}
            onClick={() => setActive(view)}
            className={
              "group flex shrink-0 cursor-pointer items-center gap-1.5 border-r border-[var(--vs-border)] px-3 text-[12px] transition-colors " +
              (isActive
                ? "bg-[var(--vs-bg)] text-[var(--vs-text)]"
                : "bg-[var(--vs-bg2)] text-[var(--vs-dim)] hover:bg-[var(--vs-bg3)] hover:text-[var(--vs-text2)]")
            }
            style={isActive ? { boxShadow: "inset 0 1px 0 var(--vs-accent)" } : undefined}
          >
            {extBadge(meta.ext)}
            <span className="mono">{meta.label}</span>
            <button
              onClick={(e) => { e.stopPropagation(); closeTab(view); }}
              className="ml-1 rounded p-0.5 text-[var(--vs-dim)] opacity-0 hover:bg-[var(--vs-bg4)] hover:text-[var(--vs-text)] group-hover:opacity-100"
              aria-label={`Close ${meta.label}`}
            >
              <XIcon size={11} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function Breadcrumb() {
  const active = useStudio((s) => s.activeTab);
  if (!active) return <div className="h-[22px] border-b border-[var(--vs-border)] bg-[var(--vs-bg2)]" />;
  const group = groupOf(active);
  const label = TAB_META[active].label;
  return (
    <div className="flex h-[22px] items-center gap-1.5 border-b border-[var(--vs-border)] bg-[var(--vs-bg2)] px-3 mono text-[10px] text-[var(--vs-dim)]">
      <span>VVU-STUDIO</span>
      <span className="text-[var(--vs-dimmer)]">›</span>
      <span>{group}</span>
      <span className="text-[var(--vs-dimmer)]">›</span>
      <span className="text-[var(--vs-text2)]">{label}</span>
    </div>
  );
}
