"use client";
// VVU command palette (⌘K / Ctrl+K) — fuzzy env/view navigation + console-wide search.
import React from "react";
import { create } from "zustand";
import { allEnvs, EnvId } from "./registry";
import { useNav } from "./nav";
import { useBench } from "./envs/bench/store";
import { useField } from "./envs/field/store";
import { useFire } from "./envs/fire/store";
import { useForge } from "./envs/forge/store";
import { usePress } from "./envs/press/store";

interface CmdKItem {
  id: string;
  label: string;
  icon: string;
  env: string; // env label like BENCH or "OVERVIEW"
  envId: EnvId;
  view?: string;
  kw?: string; // keywords
  kind?: "nav" | "data"; // nav (default) or a data search result
  meta?: string; // small meta text for data results
}

interface CmdKState {
  open: boolean;
  q: string;
  sel: number;
  items: CmdKItem[];
  setQ: (q: string) => void;
  setSel: (n: number) => void;
  openPal: () => void;
  closePal: () => void;
}

export const useCmdK = create<CmdKState>((set, get) => ({
  open: false,
  q: "",
  sel: 0,
  items: [],
  setQ: (q) => set({ q, sel: 0 }),
  setSel: (n) => set({ sel: n }),
  openPal: () => {
    // build items
    const items: CmdKItem[] = [];
    items.push({ id: "overview", label: "Overview · landing", icon: "◆", env: "OVERVIEW", envId: "overview", kw: "home landing start", kind: "nav" });
    items.push({ id: "bridge", label: "BRIDGE · Evidence Flow", icon: "⇄", env: "BRIDGE", envId: "bridge", view: "flow", kw: "cross environment flow pipeline bridge aggregate worm", kind: "nav" });
    for (const m of allEnvs()) {
      items.push({
        id: `${m.id}:default`, label: `${m.brand} · ${m.groups[0]?.items[0]?.label ?? m.defaultView}`,
        icon: m.icon, env: m.label, envId: m.id, view: m.defaultView,
        kw: `${m.brand} ${m.sub} ${m.spec} ${m.maxim}`, kind: "nav",
      });
      for (const g of m.groups) {
        for (const it of g.items) {
          items.push({
            id: `${m.id}:${it.id}`, label: `${m.brand} · ${it.label}`, icon: it.icon, env: m.label,
            envId: m.id, view: it.id, kw: `${m.label} ${it.label} ${g.label} ${m.brand}`, kind: "nav",
          });
        }
      }
    }

    // ---- console-wide DATA search items ----
    try {
      // BENCH receipts
      const bench = useBench.getState().d;
      bench.receipts.slice(0, 12).forEach((r: any) => {
        items.push({
          id: `bench-receipt:${r.receipt_id}`, label: `BENCH receipt ${r.receipt_id}`, icon: "⚖",
          env: "BENCH", envId: "bench", view: "verify", kind: "data",
          kw: `${r.receipt_id} ${r.outcome} ${r.policy} ${r.claim_ref}`,
          meta: r.outcome,
        });
      });
      // BENCH chain rows
      bench.chain.slice(0, 12).forEach((row: any, i: number) => {
        items.push({
          id: `bench-row:${i}`, label: `BENCH chain row ${row.seq}`, icon: "⛓",
          env: "BENCH", envId: "bench", view: "chain", kind: "data",
          kw: `${row.digest} ${row.payload} ${row.seq}`,
          meta: `seq ${row.seq}`,
        });
      });
    } catch {}
    try {
      // FIELD observations
      const field = useField.getState().d;
      [...field.queue, ...field.delivered].slice(0, 12).forEach((o: any) => {
        items.push({
          id: `field-obs:${o.observation_id}`, label: `FIELD observation ${o.observation_id?.slice(0, 14)}…`, icon: "◉",
          env: "FIELD", envId: "field", view: "queue", kind: "data",
          kw: `${o.observation_id} ${o.sensor_id} ${o.value} ${o.unit}`,
          meta: `${o.value}${o.unit}`,
        });
      });
      // FIELD gap facts
      field.gaps.slice(0, 6).forEach((g: any, i: number) => {
        items.push({
          id: `field-gap:${i}`, label: `FIELD gap fact ${i + 1}`, icon: "⌷",
          env: "FIELD", envId: "field", view: "gaps", kind: "data",
          kw: `gap ${g.duration} ${g.reason}`,
          meta: g.duration,
        });
      });
    } catch {}
    try {
      // FIRE counterexamples
      const fire = useFire.getState().d;
      fire.counterexamples.slice(0, 12).forEach((cx: any) => {
        items.push({
          id: `fire-cx:${cx.cx_id ?? cx.id}`, label: `FIRE counterexample ${cx.case_id ?? cx.caseId}`, icon: "🧬",
          env: "FIRE", envId: "fire", view: "cx", kind: "data",
          kw: `${cx.cx_id ?? cx.id} ${cx.case_id ?? cx.caseId} ${cx.target} ${cx.digest ?? ""}`,
          meta: cx.target,
        });
      });
      // FIRE threats
      fire.threats.slice(0, 8).forEach((t: any) => {
        items.push({
          id: `fire-threat:${t.threat_id ?? t.id}`, label: `FIRE threat ${t.threat_id ?? t.id}`, icon: "⚠",
          env: "FIRE", envId: "fire", view: "threats", kind: "data",
          kw: `${t.threat_id ?? t.id} ${t.capability} ${t.target}`,
          meta: t.target,
        });
      });
    } catch {}
    try {
      // FORGE artefacts
      const forge = useForge.getState().d;
      forge.artefacts.slice(0, 12).forEach((a: any) => {
        items.push({
          id: `forge-art:${a.artefact_id}`, label: `FORGE artefact ${a.artefact_type}`, icon: "▤",
          env: "FORGE", envId: "forge", view: "artefacts", kind: "data",
          kw: `${a.artefact_id} ${a.artefact_type} ${a.integrity?.digest ?? ""}`,
          meta: a.artefact_type,
        });
      });
      // FORGE claims
      forge.claims.slice(0, 8).forEach((c: any) => {
        items.push({
          id: `forge-claim:${c.claim_id}`, label: `FORGE claim ${c.claim_text?.slice(0, 30)}…`, icon: "✎",
          env: "FORGE", envId: "forge", view: "claims", kind: "data",
          kw: `${c.claim_id} ${c.claim_text} PROPOSED`,
          meta: "PROPOSED",
        });
      });
    } catch {}
    try {
      // PRESS publications
      const press = usePress.getState().d;
      press.publications.slice(0, 8).forEach((p: any) => {
        items.push({
          id: `press-pub:${p.id ?? p.publication_id}`, label: `PRESS publication ${p.title?.slice(0, 30) ?? ""}`, icon: "📄",
          env: "PRESS", envId: "press", view: "versions", kind: "data",
          kw: `${p.id ?? ""} ${p.title ?? ""} ${p.status ?? ""}`,
          meta: p.status ?? "",
        });
      });
      // PRESS receipts
      press.receipts.slice(0, 6).forEach((r: any) => {
        items.push({
          id: `press-rcpt:${r.receipt_id}`, label: `PRESS receipt ${r.receipt_id}`, icon: "⚖",
          env: "PRESS", envId: "press", view: "receipts", kind: "data",
          kw: `${r.receipt_id} ${r.outcome} ${r.policy}`,
          meta: r.outcome,
        });
      });
    } catch {}

    set({ open: true, items, q: "", sel: 0 });
  },
  closePal: () => set({ open: false, q: "", sel: 0 }),
}));

function fuzzy(q: string, s: string): boolean {
  q = q.toLowerCase().trim();
  if (!q) return true;
  s = s.toLowerCase();
  if (s.includes(q)) return true;
  // fuzzy: every char of q in order in s
  let i = 0;
  for (const ch of s) {
    if (ch === q[i]) i++;
    if (i >= q.length) return true;
  }
  return false;
}

export function CommandPalette() {
  const open = useCmdK((s) => s.open);
  const q = useCmdK((s) => s.q);
  const sel = useCmdK((s) => s.sel);
  const items = useCmdK((s) => s.items);
  const setQ = useCmdK((s) => s.setQ);
  const setSel = useCmdK((s) => s.setSel);
  const closePal = useCmdK((s) => s.closePal);
  const setEnv = useNav((s) => s.setEnv);
  const setView = useNav((s) => s.setView);

  const filtered = React.useMemo(() => {
    return items.filter((it) => fuzzy(q, `${it.label} ${it.kw ?? ""} ${it.env}`)).slice(0, 50);
  }, [items, q]);

  const go = React.useCallback((it: CmdKItem) => {
    setEnv(it.envId);
    if (it.view) setView(it.envId, it.view);
    closePal();
  }, [setEnv, setView, closePal]);

  // keyboard shortcut to open + arrow navigation
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) closePal();
        else useCmdK.getState().openPal();
      } else if (e.key === "Escape" && open) {
        closePal();
      } else if (open) {
        if (e.key === "ArrowDown") { e.preventDefault(); setSel(Math.min(filtered.length - 1, sel + 1)); }
        else if (e.key === "ArrowUp") { e.preventDefault(); setSel(Math.max(0, sel - 1)); }
        else if (e.key === "Enter") {
          e.preventDefault();
          const it = filtered[sel];
          if (it) go(it);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, sel, setSel, closePal, go]);

  if (!open) return null;

  return (
    <div className="vvu-cmdk-overlay" onClick={closePal}>
      <div className="vvu-cmdk" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="command palette">
        <input
          className="vvu-cmdk-input"
          autoFocus
          placeholder="search anything — environments, views, receipts, observations, counterexamples…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="vvu-cmdk-list">
          {filtered.length === 0 ? (
            <div className="vvu-tempty">no matches · try “bench”, “proven”, “counterexample”, “observation”, “publication”</div>
          ) : (
            filtered.map((it, i) => (
              <div
                key={it.id}
                className={`vvu-cmdk-row ${i === sel ? "sel" : ""}`}
                onClick={() => go(it)}
                onMouseEnter={() => setSel(i)}
              >
                <span className="ic">{it.icon}</span>
                <span>{it.label}</span>
                {it.meta && <span className="res-meta">{it.meta}</span>}
                <span className="env">{it.env}</span>
              </div>
            ))
          )}
        </div>
        <div className="vvu-cmdk-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
          <span style={{ marginLeft: "auto" }}>{filtered.length} of {items.length} indexed</span>
        </div>
      </div>
    </div>
  );
}
