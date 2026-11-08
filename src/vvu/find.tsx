"use client";
// VVU in-page fuzzy finder — press `f` to open a search bar that highlights
// matching text across all visible panels/tables/rows in the current view.
// Arrow keys navigate matches, Enter scrolls to the match, Esc closes.
import React from "react";
import { create } from "zustand";

interface FindState {
  open: boolean;
  q: string;
  matches: { el: HTMLElement; text: string }[];
  sel: number;
  setQ: (q: string) => void;
  setSel: (n: number) => void;
  openFind: () => void;
  close: () => void;
  search: () => void;
}

export const useFind = create<FindState>((set, get) => ({
  open: false,
  q: "",
  matches: [],
  sel: 0,
  setQ: (q) => { set({ q, sel: 0 }); setTimeout(() => get().search(), 0); },
  setSel: (n) => set({ sel: n }),
  openFind: () => set({ open: true, q: "", matches: [], sel: 0 }),
  close: () => {
    // clear highlights
    document.querySelectorAll(".vvu-find-hit").forEach((el) => {
      const parent = el.parentNode;
      if (parent) parent.replaceChild(document.createTextNode(el.textContent || ""), el);
      parent?.normalize();
    });
    set({ open: false, q: "", matches: [], sel: 0 });
  },
  search: () => {
    const q = get().q.trim().toLowerCase();
    // clear previous highlights
    document.querySelectorAll(".vvu-find-hit").forEach((el) => {
      const parent = el.parentNode;
      if (parent) parent.replaceChild(document.createTextNode(el.textContent || ""), el);
      parent?.normalize();
    });
    if (!q || q.length < 1) { set({ matches: [], sel: 0 }); return; }
    // scan the .vvu-view container for text nodes containing the query
    const view = document.querySelector(".vvu-view");
    if (!view) return;
    const matches: { el: HTMLElement; text: string }[] = [];
    const walker = document.createTreeWalker(view, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const p = node.parentElement;
        if (!p || !node.textContent) return NodeFilter.FILTER_REJECT;
        // skip script/style/hidden
        const tag = p.tagName;
        if (tag === "SCRIPT" || tag === "STYLE") return NodeFilter.FILTER_REJECT;
        if (p.offsetParent === null) return NodeFilter.FILTER_REJECT;
        if (node.textContent.toLowerCase().includes(q)) return NodeFilter.FILTER_ACCEPT;
        return NodeFilter.FILTER_REJECT;
      },
    });
    const nodes: Text[] = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n as Text);
    // limit to 50 matches
    for (const tn of nodes.slice(0, 50)) {
      const lc = tn.textContent!.toLowerCase();
      const idx = lc.indexOf(q);
      if (idx < 0) continue;
      // wrap the match in a <mark>
      const range = document.createRange();
      range.setStart(tn, idx);
      range.setEnd(tn, idx + q.length);
      const mark = document.createElement("mark");
      mark.className = "vvu-find-hit";
      range.surroundContents(mark);
      matches.push({ el: mark, text: (tn.textContent || "").slice(Math.max(0, idx - 20), idx + q.length + 30).trim() });
    }
    set({ matches, sel: 0 });
    // scroll to first
    if (matches[0]) {
      matches[0].el.classList.add("sel");
      matches[0].el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  },
}));

export function FindBar() {
  const open = useFind((s) => s.open);
  const q = useFind((s) => s.q);
  const matches = useFind((s) => s.matches);
  const sel = useFind((s) => s.sel);
  const setQ = useFind((s) => s.setQ);
  const close = useFind((s) => s.close);

  const scrollToMatch = React.useCallback((i: number) => {
    const ms = useFind.getState().matches;
    document.querySelectorAll(".vvu-find-hit.sel").forEach((el) => el.classList.remove("sel"));
    if (ms[i]) {
      ms[i].el.classList.add("sel");
      ms[i].el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        if (e.key === "Escape" && open) close();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === "f" && !open) {
        e.preventDefault();
        useFind.getState().openFind();
      } else if (e.key === "Escape" && open) {
        close();
      } else if (open) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          const next = Math.min(matches.length - 1, sel + 1);
          useFind.getState().setSel(next);
          scrollToMatch(next);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          const prev = Math.max(0, sel - 1);
          useFind.getState().setSel(prev);
          scrollToMatch(prev);
        } else if (e.key === "Enter") {
          e.preventDefault();
          scrollToMatch(sel);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, matches, sel, close, scrollToMatch]);

  if (!open) return null;

  return (
    <div className="vvu-find-bar" role="search" aria-label="in-page find">
      <span className="vvu-find-glyph">f</span>
      <input
        className="vvu-find-input"
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
          else if (e.key === "ArrowDown") { e.preventDefault(); const n = Math.min(matches.length - 1, sel + 1); useFind.getState().setSel(n); scrollToMatch(n); }
          else if (e.key === "ArrowUp") { e.preventDefault(); const n = Math.max(0, sel - 1); useFind.getState().setSel(n); scrollToMatch(n); }
          else if (e.key === "Enter") { e.preventDefault(); scrollToMatch(sel); }
        }}
        placeholder="find in this view…  (highlights every match)"
        spellCheck={false}
      />
      <span className="vvu-find-count">
        {matches.length === 0 ? (q ? "no matches" : "type to search") : `${sel + 1}/${matches.length}`}
      </span>
      <button className="vvu-find-close" onClick={close} aria-label="close find">×</button>
    </div>
  );
}
