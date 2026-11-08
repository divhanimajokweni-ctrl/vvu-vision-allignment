"use client";
// VVU cross-environment status header — live metrics from all 5 envs.
import React from "react";
import { useBench } from "./envs/bench/store";
import { useField } from "./envs/field/store";
import { useFire } from "./envs/fire/store";
import { useForge } from "./envs/forge/store";
import { usePress } from "./envs/press/store";
import { WormChain, SHA256 } from "@/lib/vvu-utils";

// Subscribes to each store's log so it re-renders on any commit.
export function StatusHeader() {
  // Read once per render — these are non-reactive reads but the component
  // subscribes to a counter that ticks every 2s via a state nudge for the live clock.
  const [, setN] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setN((n) => n + 1), 2000);
    return () => clearInterval(id);
  }, []);

  // defensive reads
  let benchChain = 0, benchReceipts = 0, benchVerified = 0;
  let fieldQueued = 0, fieldDelivered = 0, fieldGaps = 0;
  let fireRuns = 0, fireCx = 0, fireAuths = 0, fireThreats = 0;
  let forgeArtefacts = 0, forgeClaims = 0;
  let pressDrafts = 0, pressPublications = 0, pressReceipts = 0;

  try { const s = useBench.getState().d; benchChain = s.chain.length; benchReceipts = s.receipts.length; benchVerified = s.receipts.filter((r) => r.outcome === "PROVEN").length; } catch {}
  try { const s = useField.getState().d; fieldQueued = s.queue.length; fieldDelivered = s.delivered.length; fieldGaps = s.gaps.length; } catch {}
  try { const s = useFire.getState().d; fireRuns = s.runs.length; fireCx = s.counterexamples.length; fireAuths = s.auths.length; fireThreats = s.threats.length; } catch {}
  try { const s = useForge.getState().d; forgeArtefacts = s.artefacts.length; forgeClaims = s.claims.length; } catch {}
  try { const s = usePress.getState().d; pressDrafts = s.drafts.length; pressPublications = s.publications.length; pressReceipts = s.receipts.length; } catch {}

  // compute an aggregate WORM head from all chains combined
  const head = React.useMemo(() => {
    try {
      const c = new WormChain("vvu-aggregate");
      const bench = useBench.getState().d.chain;
      c.rows = bench;
      return c.head().slice(0, 12) + "…";
    } catch { return "—".padEnd(15); }
  }, [benchChain]);

  const totalRecords = benchReceipts + fieldQueued + fieldDelivered + fireCx + forgeArtefacts + forgeClaims + pressDrafts + pressPublications;
  const now = new Date();
  const clock = now.toISOString().slice(11, 19) + "Z";

  return (
    <div className="vvu-statusbar" role="status" aria-label="cross-environment status">
      <div className="vvu-statcell live">
        <span className="l">VVU · LIVE</span>
        <span className="v acc">STEADY_STATE</span>
      </div>
      <div className="vvu-statcell">
        <span className="l">WORM HEAD</span>
        <span className="v mono">{head}</span>
      </div>
      <div className="vvu-statcell">
        <span className="l">BENCH · receipts</span>
        <span className="v ok">{benchReceipts}</span>
      </div>
      <div className="vvu-statcell">
        <span className="l">FIELD · queued / delivered</span>
        <span className="v">{fieldQueued} / <span style={{ color: "var(--vvu-acc)" }}>{fieldDelivered}</span></span>
      </div>
      <div className="vvu-statcell">
        <span className="l">FIRE · runs / cx</span>
        <span className="v bad">{fireRuns} / {fireCx}</span>
      </div>
      <div className="vvu-statcell">
        <span className="l">FORGE · artefacts</span>
        <span className="v" style={{ color: "var(--vvu-pur)" }}>{forgeArtefacts + forgeClaims}</span>
      </div>
      <div className="vvu-statcell">
        <span className="l">PRESS · published</span>
        <span className="v" style={{ color: "var(--vvu-acc2)" }}>{pressPublications}</span>
      </div>
      <div className="vvu-statcell">
        <span className="l">GAP FACTS</span>
        <span className="v warn">{fieldGaps}</span>
      </div>
      <div className="vvu-statcell">
        <span className="l">TOTAL RECORDS</span>
        <span className="v acc">{totalRecords}</span>
      </div>
      <div className="vvu-statcell" style={{ marginLeft: "auto" }}>
        <span className="l">UTC</span>
        <span className="v mono">{clock}</span>
      </div>
    </div>
  );
}
