"use client";
// VVU history timeline — a horizontal sparkline-style chart showing console
// activity over time, drawn from the metrics history store. Renders inside BRIDGE.
import React from "react";
import { useMetrics, MetricSample } from "./metrics";
import { useBench } from "./envs/bench/store";
import { useField } from "./envs/field/store";
import { useFire } from "./envs/fire/store";
import { useForge } from "./envs/forge/store";
import { usePress } from "./envs/press/store";

export function HistoryTimeline() {
  const history = useMetrics((s) => s.history);
  const [, tick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);

  // build a merged log timeline (last 30 entries across all 5 envs)
  const entries: { env: string; type: string; time: number; detail: string }[] = [];
  const push = (env: string, log: any[]) => {
    for (const e of log.slice(0, 8)) entries.push({ env, type: e.type, time: e.time, detail: e.detail });
  };
  try { push("BENCH", useBench.getState().log); } catch {}
  try { push("FIELD", useField.getState().log); } catch {}
  try { push("FIRE", useFire.getState().log); } catch {}
  try { push("FORGE", useForge.getState().log); } catch {}
  try { push("PRESS", usePress.getState().log); } catch {}
  entries.sort((a, b) => a.time - b.time);
  const logTimeline = entries.slice(-30);

  // metrics sparkline data
  const totals = history.map((h) => h.total);
  const benchData = history.map((h) => h.benchReceipts);
  const fieldData = history.map((h) => h.fieldQueued + h.fieldDelivered);
  const fireData = history.map((h) => h.fireCx);
  const forgeData = history.map((h) => h.forgeArts);
  const pressData = history.map((h) => h.pressPubs);

  const maxTotal = Math.max(...totals, 1);
  const W = 100; // viewBox width units
  const H = 30;

  const toPath = (data: number[], color: string) => {
    if (data.length < 2) return null;
    const max = Math.max(...data, 1);
    const step = W / (data.length - 1);
    const pts = data.map((d, i) => `${(i * step).toFixed(1)},${(H - (d / max) * (H - 2) - 1).toFixed(1)}`);
    return { path: `M${pts.join(" L")}`, color };
  };

  const series = [
    toPath(totals, "var(--vvu-accent)"),
    toPath(benchData, "var(--vvu-acc)"),
    toPath(fieldData, "var(--vvu-warn)"),
    toPath(fireData, "var(--vvu-bad)"),
    toPath(forgeData, "var(--vvu-pur)"),
    toPath(pressData, "var(--vvu-acc2)"),
  ].filter(Boolean);

  const envColor = (e: string) => ({
    BENCH: "var(--vvu-acc)", FIELD: "var(--vvu-warn)", FIRE: "var(--vvu-bad)",
    FORGE: "var(--vvu-pur)", PRESS: "var(--vvu-acc2)",
  } as Record<string, string>)[e] || "var(--vvu-dim)";

  const ago = (t: number) => {
    const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h`;
  };

  return (
    <>
      <div className="vvu-timeline-chart">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="vvu-timeline-svg">
          {series.map((s, i) => (
            <path key={i} d={s!.path} fill="none" stroke={s!.color} strokeWidth="0.5" opacity={i === 0 ? 0.9 : 0.6} />
          ))}
        </svg>
        <div className="vvu-timeline-legend">
          <span className="leg" style={{ color: "var(--vvu-accent)" }}>total</span>
          <span className="leg" style={{ color: "var(--vvu-acc)" }}>bench</span>
          <span className="leg" style={{ color: "var(--vvu-warn)" }}>field</span>
          <span className="leg" style={{ color: "var(--vvu-bad)" }}>fire</span>
          <span className="leg" style={{ color: "var(--vvu-pur)" }}>forge</span>
          <span className="leg" style={{ color: "var(--vvu-acc2)" }}>press</span>
        </div>
      </div>
      <div className="vvu-timeline-log">
        <div className="vvu-timeline-log-h">ACTIVITY LOG (last {logTimeline.length})</div>
        <div className="vvu-timeline-log-list">
          {logTimeline.length === 0 ? (
            <div className="vvu-tempty">no activity yet</div>
          ) : (
            logTimeline.map((e, i) => (
              <div key={i} className="vvu-timeline-log-row">
                <span className="env" style={{ color: envColor(e.env) }}>{e.env}</span>
                <span className="type">{e.type}</span>
                <span className="ago">{ago(e.time)}</span>
                <span className="detail">{e.detail.slice(0, 100)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
