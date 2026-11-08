"use client";
// VVU first-run guided tour — a one-time overlay that walks new users through
// the 5 environments + BRIDGE. Persists "seen" to localStorage.
import React from "react";
import { create } from "zustand";
import { allEnvs } from "./registry";
import { useNav } from "./nav";

interface TourState {
  open: boolean;
  step: number;
  seen: boolean;
  openTour: () => void;
  closeTour: () => void;
  next: () => void;
  prev: () => void;
  goStep: (n: number) => void;
  dismiss: () => void;
}

const KEY = "vvu-tour-seen";

function loadSeen(): boolean {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}
function saveSeen() {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, "1"); } catch {}
}

const STEPS = [
  {
    title: "Welcome to the VVU Console",
    body: "One verification layer. Five environments. Every hash, signature and receipt recomputes locally in your browser — the browser is the validator. This 6-step tour takes about a minute.",
    env: null as null | string,
  },
  { title: "FIELD · captures observations", body: "Offline-first capture with synthetic-only provenance. A durable queue, idempotent sync, gap facts, and a 72-hour disconnection test. Start here to record an observation.", env: "field" },
  { title: "FORGE · creates envelopes", body: "Canonical-hashed envelopes across four surfaces (Plugin-Studio, STUDI, spreadsheet, Validation-Dashboard). Status may only ever be PROPOSED — Forge cannot write VERIFIED.", env: "forge" },
  { title: "BENCH · verifies evidence", body: "Verifies evidence against a named policy and emits an Ed25519-signed receipt. Real SHA-256, an independent verifier that names the exact broken row. Only BENCH may emit PROVEN.", env: "bench" },
  { title: "FIRE · adversarial testing", body: "Authorisation-gated runs against honest and vulnerable builds. Every counterexample is preserved as the smallest reproducible failure. Fire never emits PROVEN.", env: "fire" },
  { title: "PRESS · publishes", body: "Publishes only what a Bench receipt permits, holds the rest, gates by POPIA consent. Publication is irreversible — corrections link back, retractions flag but never remove.", env: "press" },
  { title: "BRIDGE · see the flow", body: "The cross-environment console. See how evidence flows in one direction, run the console-wide self-test (77 checks), import a BENCH receipt into PRESS, and export the whole console.", env: "bridge" },
  { title: "You're ready", body: "Press ⌘K anytime to jump anywhere. Press ? for all shortcuts. Press t to toggle light/dark. Every environment has a self-test — run them to prove the system works.", env: null },
];

export const useTour = create<TourState>((set, get) => ({
  open: false,
  step: 0,
  seen: loadSeen(),
  openTour: () => set({ open: true, step: 0 }),
  closeTour: () => set({ open: false }),
  next: () => {
    const s = get().step;
    if (s >= STEPS.length - 1) { get().dismiss(); return; }
    // navigate to the step's env if specified
    const target = STEPS[s + 1].env;
    if (target) useNav.getState().go(target as any);
    set({ step: s + 1 });
  },
  prev: () => set((st) => ({ step: Math.max(0, st.step - 1) })),
  goStep: (n) => {
    const target = STEPS[n].env;
    if (target) useNav.getState().go(target as any);
    set({ step: n });
  },
  dismiss: () => { saveSeen(); set({ open: false, seen: true }); },
}));

// Auto-open on first visit (if not seen)
export function TourAutostart() {
  const seen = useTour((s) => s.seen);
  const openTour = useTour((s) => s.openTour);
  React.useEffect(() => {
    if (!seen) {
      const t = setTimeout(() => openTour(), 800);
      return () => clearTimeout(t);
    }
  }, [seen, openTour]);
  return null;
}

export function TourOverlay() {
  const open = useTour((s) => s.open);
  const step = useTour((s) => s.step);
  const next = useTour((s) => s.next);
  const prev = useTour((s) => s.prev);
  const dismiss = useTour((s) => s.dismiss);
  const goStep = useTour((s) => s.goStep);
  const openTour = useTour((s) => s.openTour);
  const go = useNav((s) => s.go);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!open) {
        // re-open with "h" (help/tour)
        if (e.key.toLowerCase() === "h" && !(e.metaKey || e.ctrlKey || e.altKey)) {
          const tag = (e.target as HTMLElement)?.tagName;
          if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
            e.preventDefault();
            openTour();
          }
        }
      } else {
        if (e.key === "Escape") dismiss();
        else if (e.key === "ArrowRight" || e.key === "Enter") next();
        else if (e.key === "ArrowLeft") prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, next, prev, dismiss, openTour]);

  if (!open) return null;
  const s = STEPS[step];
  const envs = allEnvs();
  return (
    <div className="vvu-tour-overlay" onClick={dismiss}>
      <div className="vvu-tour-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="guided tour">
        <div className="vvu-tour-progress">
          {STEPS.map((_, i) => (
            <span key={i} className={`vvu-tour-dot ${i === step ? "on" : ""} ${i < step ? "done" : ""}`} onClick={() => goStep(i)} />
          ))}
        </div>
        <button className="vvu-tour-close" onClick={dismiss} aria-label="close tour">×</button>
        <div className="vvu-tour-step">{step + 1} / {STEPS.length}</div>
        <h2>{s.title}</h2>
        <p>{s.body}</p>
        <div className="vvu-tour-actions">
          {step > 0 && <button className="vvu-btn sm" onClick={prev}>← back</button>}
          {s.env && (
            <button className="vvu-btn sm" onClick={() => s.env && go(s.env as any)}>→ jump to {s.env.toUpperCase()}</button>
          )}
          <span style={{ flex: 1 }} />
          {step < STEPS.length - 1 ? (
            <button className="vvu-btn p" onClick={next}>next →</button>
          ) : (
            <button className="vvu-btn p" onClick={dismiss}>✓ done</button>
          )}
        </div>
        <div className="vvu-tour-foot">
          <span>press <kbd>h</kbd> anytime to replay · <kbd>esc</kbd> to close · <kbd>→</kbd> next</span>
          <span className="env-pills">
            {envs.map((m) => (
              <span key={m.id} className={`vvu-tag ${s.env === m.id ? "a" : ""}`} style={{ fontSize: 8.5 }}>{m.brand}</span>
            ))}
            <span className={`vvu-tag ${s.env === "bridge" ? "a" : ""}`} style={{ fontSize: 8.5 }}>BRIDGE</span>
          </span>
        </div>
      </div>
    </div>
  );
}
