"use client";
// VVU keyboard cheat-sheet — press ? to reveal all shortcuts.
import React from "react";
import { create } from "zustand";

interface KeyHintsState {
  open: boolean;
  toggle: () => void;
  set: (o: boolean) => void;
}

export const useKeyHints = create<KeyHintsState>((set) => ({
  open: false,
  toggle: () => set((s) => ({ open: !s.open })),
  set: (o) => set({ open: o }),
}));

const SHORTCUTS: { keys: string; desc: string; group: string }[] = [
  { keys: "⌘ K", desc: "open command palette", group: "navigation" },
  { keys: "↑ ↓", desc: "move selection in palette", group: "navigation" },
  { keys: "↵", desc: "open selected", group: "navigation" },
  { keys: "esc", desc: "close palette / overlay", group: "navigation" },
  { keys: "?", desc: "show this cheat sheet", group: "navigation" },
  { keys: "h", desc: "replay the guided tour", group: "navigation" },
  { keys: "g o", desc: "go to overview", group: "jump to env" },
  { keys: "g b", desc: "go to BENCH", group: "jump to env" },
  { keys: "g f", desc: "go to FIELD", group: "jump to env" },
  { keys: "g i", desc: "go to FIRE", group: "jump to env" },
  { keys: "g r", desc: "go to FORGE", group: "jump to env" },
  { keys: "g p", desc: "go to PRESS", group: "jump to env" },
  { keys: "g d", desc: "go to BRIDGE", group: "jump to env" },
  { keys: "t", desc: "toggle dark / light theme", group: "ui" },
  { keys: "e", desc: "export current environment", group: "ui" },
  { keys: ":", desc: "vim-style command line", group: "ui" },
  { keys: "f", desc: "find in this view (highlights matches)", group: "ui" },
];

export function KeyHints() {
  const open = useKeyHints((s) => s.open);
  const set = useKeyHints((s) => s.set);

  React.useEffect(() => {
    let lastKey = "";
    let lastTs = 0;
    const onKey = (e: KeyboardEvent) => {
      // ignore when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "?") { e.preventDefault(); set(!open); return; }
      if (e.key === "Escape" && open) { set(false); return; }
      // "g <x>" sequence for env jumps
      const now = Date.now();
      if (lastKey === "g" && now - lastTs < 800) {
        const map: Record<string, string> = { o: "overview", b: "bench", f: "field", i: "fire", r: "forge", p: "press", d: "bridge" };
        const target = map[e.key.toLowerCase()];
        if (target) {
          e.preventDefault();
          // dynamic import to avoid circular deps
          import("./nav").then(({ useNav }) => {
            useNav.getState().go(target as any);
          });
        }
        lastKey = ""; lastTs = 0; return;
      }
      if (e.key.toLowerCase() === "g") { lastKey = "g"; lastTs = now; return; }
      // single-key shortcuts
      if (e.key.toLowerCase() === "t") {
        e.preventDefault();
        import("./theme-toggle").then(({ useTheme }) => useTheme.getState().toggle());
      } else if (e.key.toLowerCase() === "e") {
        // export current environment — trigger the topbar export button
        e.preventDefault();
        const btn = document.querySelector(".vvu-topbar button[title*='export']") as HTMLButtonElement | null;
        if (btn) btn.click();
      }
      lastKey = ""; lastTs = 0;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, set]);

  if (!open) return null;

  const groups = Array.from(new Set(SHORTCUTS.map((s) => s.group)));
  return (
    <div className="vvu-cmdk-overlay" onClick={() => set(false)}>
      <div className="vvu-cmdk vvu-keyhints" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="keyboard shortcuts">
        <div className="vvu-keyhints-head">
          <h3>KEYBOARD SHORTCUTS</h3>
          <button className="vvu-iconbtn" onClick={() => set(false)} aria-label="close">×</button>
        </div>
        <div className="vvu-keyhints-body">
          {groups.map((g) => (
            <div key={g} className="vvu-keyhints-group">
              <div className="vvu-keyhints-g-title">{g}</div>
              {SHORTCUTS.filter((s) => s.group === g).map((s, i) => (
                <div key={i} className="vvu-keyhints-row">
                  <span className="vvu-keyhints-keys">
                    {s.keys.split(" ").map((k, j) => <kbd key={j}>{k}</kbd>)}
                  </span>
                  <span className="vvu-keyhints-desc">{s.desc}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="vvu-cmdk-foot">
          <span>press <kbd>?</kbd> anytime to toggle this overlay</span>
          <span style={{ marginLeft: "auto" }}>VVU CONSOLE</span>
        </div>
      </div>
    </div>
  );
}
