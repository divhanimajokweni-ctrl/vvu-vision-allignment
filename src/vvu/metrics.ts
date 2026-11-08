"use client";
// VVU metrics history — tracks a rolling 20-point history of console-wide metrics
// so KPI cards / sparklines can show trends. Persists to localStorage.
import { create } from "zustand";
import { useBench } from "./envs/bench/store";
import { useField } from "./envs/field/store";
import { useFire } from "./envs/fire/store";
import { useForge } from "./envs/forge/store";
import { usePress } from "./envs/press/store";

export interface MetricSample {
  t: number;
  benchReceipts: number;
  benchChain: number;
  fieldQueued: number;
  fieldDelivered: number;
  fieldGaps: number;
  fireRuns: number;
  fireCx: number;
  forgeArts: number;
  forgeClaims: number;
  pressPubs: number;
  pressReceipts: number;
  total: number;
}

interface MetricsState {
  history: MetricSample[];
  push: (s: MetricSample) => void;
  tick: () => void;
}

const CAP = 20;
const KEY = "vvu-metrics-history";

function loadHistory(): MetricSample[] {
  if (typeof window === "undefined") return [];
  try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r); } catch {}
  return [];
}

function saveHistory(h: MetricSample[]) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(h)); } catch {}
}

function sample(): MetricSample {
  let benchReceipts = 0, benchChain = 0;
  let fieldQueued = 0, fieldDelivered = 0, fieldGaps = 0;
  let fireRuns = 0, fireCx = 0;
  let forgeArts = 0, forgeClaims = 0;
  let pressPubs = 0, pressReceipts = 0;
  try { const b = useBench.getState().d; benchReceipts = b.receipts.length; benchChain = b.chain.length; } catch {}
  try { const f = useField.getState().d; fieldQueued = f.queue.length; fieldDelivered = f.delivered.length; fieldGaps = f.gaps.length; } catch {}
  try { const fi = useFire.getState().d; fireRuns = fi.runs.length; fireCx = fi.counterexamples.length; } catch {}
  try { const fo = useForge.getState().d; forgeArts = fo.artefacts.length; forgeClaims = fo.claims.length; } catch {}
  try { const p = usePress.getState().d; pressPubs = p.publications.length; pressReceipts = p.receipts.length; } catch {}
  const total = benchReceipts + fieldQueued + fieldDelivered + fireCx + forgeArts + forgeClaims + pressPubs;
  return { t: Date.now(), benchReceipts, benchChain, fieldQueued, fieldDelivered, fieldGaps, fireRuns, fireCx, forgeArts, forgeClaims, pressPubs, pressReceipts, total };
}

export const useMetrics = create<MetricsState>((set, get) => ({
  history: loadHistory(),
  push: (s) => {
    set((st) => {
      const next = [...st.history, s].slice(-CAP);
      saveHistory(next);
      return { history: next };
    });
  },
  tick: () => {
    const s = sample();
    get().push(s);
  },
}));

// Auto-tick every 8s on the client (started by the Sparkline component mount)
let started = false;
export function startMetricsTicker() {
  if (started || typeof window === "undefined") return;
  started = true;
  // pre-populate with zero samples so sparklines + timeline render immediately
  const existing = useMetrics.getState().history;
  if (existing.length < 5) {
    const zeros: MetricSample = {
      t: Date.now() - 40000, benchReceipts: 0, benchChain: 0, fieldQueued: 0, fieldDelivered: 0,
      fieldGaps: 0, fireRuns: 0, fireCx: 0, forgeArts: 0, forgeClaims: 0, pressPubs: 0, pressReceipts: 0, total: 0,
    };
    const pre = [
      { ...zeros, t: Date.now() - 40000 },
      { ...zeros, t: Date.now() - 32000 },
      { ...zeros, t: Date.now() - 24000 },
      { ...zeros, t: Date.now() - 16000 },
      { ...zeros, t: Date.now() - 8000 },
    ];
    useMetrics.setState({ history: [...pre, ...existing].slice(-CAP) });
    saveHistory(useMetrics.getState().history);
  }
  // initial real sample
  useMetrics.getState().tick();
  setInterval(() => useMetrics.getState().tick(), 8000);
}
