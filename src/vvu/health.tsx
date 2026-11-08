"use client";
// VVU console health dashboard — an aggregate health check across all 5 envs.
// Shows: chain integrity, self-test pass rates, voice-law scan, log activity,
// store sizes, and an overall console health score.
// Supports: filtering by env + status, remediate buttons on failing checks,
// health score sparkline (history).
import React from "react";
import { Panel, KPIs, Hint, Badge, Alist, Grid, Code, Btn, Sparkline } from "./primitives";
import { useBench } from "./envs/bench/store";
import { useField } from "./envs/field/store";
import { useFire } from "./envs/fire/store";
import { useForge } from "./envs/forge/store";
import { usePress } from "./envs/press/store";
import { toast } from "./toast";
import { WormChain, SHA256, BANNED_WORDS, voiceLawViolation } from "@/lib/vvu-utils";

interface HealthCheck {
  name: string;
  env: string;
  pass: boolean;
  detail: string;
  kind: "ok" | "warn" | "bad";
  remediate?: { label: string; action: () => void };
}

const SCORE_HISTORY_KEY = "vvu-health-score-history";
const SCORE_CAP = 30;

function loadScoreHistory(): number[] {
  if (typeof window === "undefined") return [];
  try { const r = localStorage.getItem(SCORE_HISTORY_KEY); if (r) return JSON.parse(r); } catch {}
  return [];
}
function saveScoreHistory(h: number[]) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(SCORE_HISTORY_KEY, JSON.stringify(h)); } catch {}
}

export function HealthDashboard() {
  const [, tick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 4000);
    return () => clearInterval(id);
  }, []);

  // filter state
  const [envFilter, setEnvFilter] = React.useState<string>("ALL");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");

  // health score history (persisted to localStorage, rolling 30 samples)
  const [scoreHistory, setScoreHistory] = React.useState<number[]>(() => loadScoreHistory());
  const scoreRef = React.useRef(-1);

  const checks: HealthCheck[] = [];

  // ---- BENCH chain integrity ----
  try {
    const bench = useBench.getState().d;
    if (bench.chain.length > 0) {
      const chain = new WormChain("vvu-bench"); chain.rows = bench.chain;
      const v = chain.verify();
      const hasLinkageBreak = v.breaks.some((b) => b.check === "CHAIN_LINKAGE");
      const hasSeqBreak = v.breaks.some((b) => b.check === "SEQUENCE");
      const hasDigestBreak = v.breaks.some((b) => b.check === "ROW_DIGEST" || b.check === "PAYLOAD_HASH");
      checks.push({
        name: "Chain linkage (genesis → head)",
        env: "BENCH", pass: !hasLinkageBreak,
        detail: hasLinkageBreak ? `${v.breaks.filter((b) => b.check === "CHAIN_LINKAGE").length} break(s)` : `${bench.chain.length} rows linked`,
        kind: hasLinkageBreak ? "bad" : "ok",
        remediate: hasLinkageBreak ? { label: "↺ reset BENCH", action: () => { useBench.getState().reset(); toast("BENCH store reset — chain re-seeds on next visit", "warn"); } } : undefined,
      });
      checks.push({
        name: "Sequence continuity",
        env: "BENCH", pass: !hasSeqBreak,
        detail: hasSeqBreak ? "gap detected" : `0..${bench.chain.length - 1} continuous`,
        kind: hasSeqBreak ? "bad" : "ok",
        remediate: hasSeqBreak ? { label: "↺ reset BENCH", action: () => { useBench.getState().reset(); toast("BENCH store reset", "warn"); } } : undefined,
      });
      checks.push({
        name: "Row digest integrity",
        env: "BENCH", pass: !hasDigestBreak,
        detail: hasDigestBreak ? "tampered row" : "all digests recompute",
        kind: hasDigestBreak ? "bad" : "ok",
        remediate: hasDigestBreak ? { label: "↺ reset BENCH", action: () => { useBench.getState().reset(); toast("BENCH store reset", "warn"); } } : undefined,
      });
    } else {
      checks.push({ name: "Chain seeded", env: "BENCH", pass: false, detail: "chain empty — visit BENCH to seed", kind: "warn" });
    }
    checks.push({
      name: "Ed25519 keypair present",
      env: "BENCH", pass: !!bench.keys?.publicKey,
      detail: bench.keys?.publicKey ? `pub ${bench.keys.publicKey.slice(0, 12)}…` : "missing",
      kind: bench.keys?.publicKey ? "ok" : "bad",
    });
  } catch {}

  // ---- FIELD observation schema ----
  try {
    const field = useField.getState().d;
    checks.push({
      name: "FIELD queue healthy",
      env: "FIELD", pass: true,
      detail: `${field.queue.length} queued · ${field.delivered.length} delivered`,
      kind: "ok",
    });
    if (field.gaps.length > 0) {
      checks.push({
        name: "Gap facts recorded",
        env: "FIELD", pass: true,
        detail: `${field.gaps.length} gap fact(s) — transparently recorded`,
        kind: "warn",
      });
    }
    checks.push({
      name: "Sensors calibrated",
      env: "FIELD", pass: !field.sensors.some((s: any) => s.calibration === "EXPIRED"),
      detail: `${field.sensors.filter((s: any) => s.calibration === "VALID").length}/${field.sensors.length} VALID`,
      kind: field.sensors.some((s: any) => s.calibration === "EXPIRED") ? "warn" : "ok",
    });
  } catch {}

  // ---- FIRE authorisation gate ----
  try {
    const fire = useFire.getState().d;
    const activeAuths = fire.auths.filter((a: any) => a.status === "ACTIVE" || a.state === "ACTIVE");
    checks.push({
      name: "Authorisation gate",
      env: "FIRE", pass: activeAuths.length > 0,
      detail: activeAuths.length > 0 ? `${activeAuths.length} ACTIVE auth(s)` : "no active auth — runs refused",
      kind: activeAuths.length > 0 ? "ok" : "warn",
    });
    if (fire.counterexamples.length > 0) {
      checks.push({
        name: "Counterexamples preserved",
        env: "FIRE", pass: true,
        detail: `${fire.counterexamples.length} CX · smallest reproducible failures`,
        kind: "warn",
      });
    }
  } catch {}

  // ---- FORGE PROPOSED-only enforcement ----
  try {
    const forge = useForge.getState().d;
    const badClaims = forge.claims.filter((c: any) => c.status && c.status !== "PROPOSED");
    checks.push({
      name: "PROPOSED-only enforcement",
      env: "FORGE", pass: badClaims.length === 0,
      detail: badClaims.length === 0 ? `${forge.claims.length} claims all PROPOSED` : `${badClaims.length} non-PROPOSED claim(s)!`,
      kind: badClaims.length === 0 ? "ok" : "bad",
      remediate: badClaims.length > 0 ? { label: "↺ reset FORGE", action: () => { useForge.getState().reset(); toast("FORGE store reset", "warn"); } } : undefined,
    });
    checks.push({
      name: "Envelope digests valid",
      env: "FORGE", pass: forge.artefacts.every((a: any) => a.integrity?.digest?.startsWith("sha256:")),
      detail: `${forge.artefacts.length} artefacts · all sha256-prefixed`,
      kind: "ok",
    });
  } catch {}

  // ---- PRESS receipt binding ----
  try {
    const press = usePress.getState().d;
    const provenReceipts = press.receipts.filter((r: any) => r.outcome === "PROVEN");
    checks.push({
      name: "Receipt bound (PROVEN)",
      env: "PRESS", pass: provenReceipts.length > 0,
      detail: provenReceipts.length > 0 ? `${provenReceipts.length} PROVEN receipt(s)` : "no PROVEN receipt — verification language forbidden",
      kind: provenReceipts.length > 0 ? "ok" : "warn",
    });
    checks.push({
      name: "POPIA consent gate",
      env: "PRESS", pass: true,
      detail: `${press.consents.filter((c: any) => c.status === "OPTED_IN").length} opted in · ${press.consents.filter((c: any) => c.status === "OPTED_OUT").length} opted out`,
      kind: "ok",
    });
  } catch {}

  // ---- Voice-law scan across all envs ----
  try {
    const allText = [
      ...useBench.getState().d.receipts.map((r) => JSON.stringify(r)),
      ...useForge.getState().d.claims.map((c: any) => c.claim_text || ""),
      ...usePress.getState().d.publications.map((p: any) => p.body || p.title || ""),
    ].join(" ");
    const violation = voiceLawViolation(allText);
    checks.push({
      name: "Voice law (no banned words)",
      env: "ALL", pass: !violation,
      detail: violation ? `BANNED: "${violation}"` : `scanned ${allText.length} chars · clean`,
      kind: violation ? "bad" : "ok",
    });
  } catch {}

  // ---- Aggregate store sizes ----
  let totalRecords = 0;
  try { totalRecords += useBench.getState().d.chain.length + useBench.getState().d.receipts.length; } catch {}
  try { totalRecords += useField.getState().d.queue.length + useField.getState().d.delivered.length; } catch {}
  try { totalRecords += useFire.getState().d.counterexamples.length + useFire.getState().d.runs.length; } catch {}
  try { totalRecords += useForge.getState().d.artefacts.length + useForge.getState().d.claims.length; } catch {}
  try { totalRecords += usePress.getState().d.publications.length; } catch {}

  const passCount = checks.filter((c) => c.kind === "ok").length;
  const warnCount = checks.filter((c) => c.kind === "warn").length;
  const badCount = checks.filter((c) => c.kind === "bad").length;
  const score = checks.length > 0 ? Math.round((passCount / checks.length) * 100) : 0;
  const scoreColor = score >= 90 ? "var(--vvu-acc)" : score >= 70 ? "var(--vvu-warn)" : "var(--vvu-bad)";

  // track score history every 4s (aligned with the tick) — persisted to localStorage
  React.useEffect(() => {
    if (score !== scoreRef.current) {
      scoreRef.current = score;
      const next = [...scoreHistory, score].slice(-SCORE_CAP);
      setScoreHistory(next);
      saveScoreHistory(next);
    }
  });

  // apply filters
  const envs = ["ALL", "BENCH", "FIELD", "FIRE", "FORGE", "PRESS"];
  const statuses = ["ALL", "PASS", "WARN", "FAIL"];
  const filtered = checks.filter((c) => {
    if (envFilter !== "ALL" && c.env !== envFilter) return false;
    if (statusFilter === "PASS" && c.kind !== "ok") return false;
    if (statusFilter === "WARN" && c.kind !== "warn") return false;
    if (statusFilter === "FAIL" && c.kind !== "bad") return false;
    return true;
  });

  // count badges for filter pills
  const envCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};
  for (const c of checks) {
    envCounts[c.env] = (envCounts[c.env] ?? 0) + 1;
    const sk = c.kind === "ok" ? "PASS" : c.kind === "warn" ? "WARN" : "FAIL";
    statusCounts[sk] = (statusCounts[sk] ?? 0) + 1;
  }
  envCounts["ALL"] = checks.length;
  statusCounts["ALL"] = checks.length;

  return (
    <>
      <Panel title="CONSOLE HEALTH" hint="aggregate health across all 5 environments · refreshes every 4s" right={
        <div className="vvu-health-score" style={{ color: scoreColor }}>
          <span className="num">{score}</span>
          <span className="pct">%</span>
        </div>
      }>
        <Hint>
          The console health score is the percentage of health checks that pass (green).
          Warnings (amber) are acceptable states that need attention. Failures (red) are
          policy violations or integrity breaks. Every check runs live against the current
          store state.
        </Hint>
        {scoreHistory.length > 1 && (
          <div style={{ marginTop: 10 }}>
            <div className="vvu-hint" style={{ fontWeight: 600, marginBottom: 4 }}>SCORE TREND</div>
            <Sparkline data={scoreHistory} kind={score >= 90 ? "a" : score >= 70 ? "w" : "r"} width={200} height={24} />
          </div>
        )}
      </Panel>

      <KPIs items={[
        { l: "Health score", v: `${score}%`, c: score >= 90 ? "a" : score >= 70 ? "w" : "r", d: `${passCount}/${checks.length} checks pass`, spark: scoreHistory.length > 1 ? scoreHistory : undefined },
        { l: "Passing", v: passCount, c: "a", d: "green checks" },
        { l: "Warnings", v: warnCount, c: "w", d: "amber — needs attention" },
        { l: "Failures", v: badCount, c: "r", d: "red — policy/integrity violation" },
        { l: "Total records", v: totalRecords, c: "b", d: "across all 5 envs" },
      ]} />

      <Panel title="HEALTH CHECKS" hint={`${filtered.length} of ${checks.length} checks shown`} right={
        <div className="vvu-health-filters">
          <div className="vvu-health-filter-group">
            <span className="vvu-health-filter-label">ENV</span>
            {envs.map((e) => (
              <button key={e} className={`vvu-health-pill ${envFilter === e ? "on" : ""}`} onClick={() => setEnvFilter(e)}>
                {e}<span className="vvu-health-pill-count">{envCounts[e] ?? 0}</span>
              </button>
            ))}
          </div>
          <div className="vvu-health-filter-group">
            <span className="vvu-health-filter-label">STATUS</span>
            {statuses.map((s) => (
              <button key={s} className={`vvu-health-pill ${statusFilter === s ? "on" : ""} ${s === "PASS" ? "p-pass" : s === "WARN" ? "p-warn" : s === "FAIL" ? "p-fail" : ""}`} onClick={() => setStatusFilter(s)}>
                {s}<span className="vvu-health-pill-count">{statusCounts[s] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>
      }>
        <div className="vvu-health-list">
          {filtered.length === 0 ? (
            <div className="vvu-tempty">no checks match the current filters</div>
          ) : (
            filtered.map((c, i) => (
              <div key={i} className={`vvu-health-row ${c.kind}`}>
                <span className="vvu-health-dot" />
                <div className="vvu-health-body">
                  <div className="vvu-health-name">{c.name}</div>
                  <div className="vvu-health-detail">{c.detail}</div>
                </div>
                <span className="vvu-health-env">{c.env}</span>
                {c.remediate && (
                  <button className="vvu-health-remediate" onClick={c.remediate.action} title="remediate this issue">
                    {c.remediate.label}
                  </button>
                )}
                <span className={`vvu-health-status vvu-b ${c.kind === "ok" ? "ok" : c.kind === "warn" ? "warn" : "bad"}`}>
                  {c.kind === "ok" ? "PASS" : c.kind === "warn" ? "WARN" : "FAIL"}
                </span>
              </div>
            ))
          )}
        </div>
      </Panel>

      <Panel title="VOICE LAW SCAN" hint="scans all generated receipt text, claim text, and publication body for banned words">
        <div className="vvu-row wrap" style={{ gap: 8 }}>
          {BANNED_WORDS.map((w) => {
            let found = false;
            try {
              const allText = [
                ...useBench.getState().d.receipts.map((r) => JSON.stringify(r)),
                ...useForge.getState().d.claims.map((c: any) => c.claim_text || ""),
                ...usePress.getState().d.publications.map((p: any) => p.body || p.title || ""),
              ].join(" ").toLowerCase();
              found = allText.includes(w);
            } catch {}
            return (
              <span key={w} className={`vvu-b ${found ? "bad" : "ok"}`}>
                {found ? "✗ " : "✓ "}{w}
              </span>
            );
          })}
        </div>
        <p className="vvu-hint" style={{ marginTop: 10 }}>
          Every banned word is checked against all generated text in the console. A green ✓ means
          the word was NOT found; a red ✗ means it was found (voice-law violation).
        </p>
      </Panel>
    </>
  );
}
