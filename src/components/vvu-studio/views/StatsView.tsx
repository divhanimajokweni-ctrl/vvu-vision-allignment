/**
 * VVU · STUDIO — chain statistics view.
 *
 * Aggregate statistics over the whole chain:
 *   - verdict breakdown (PASS / FAIL / CAN'T-DECIDE) with visual bars
 *   - signature breakdown (real Ed25519 / stub) with visual bars
 *   - time span (first → last receipt)
 *   - merkle depth (log₂ of leaf count)
 *   - rule pass/fail counts across all receipts
 *
 * Visual bars make the chain's health visible at a glance.
 */
"use client";
import { useStudio } from "@/lib/vvu-studio/store";
import { merkleTree } from "@/lib/vvu-studio/loop";
import { short } from "@/lib/vvu-studio/crypto";
import { Card, Badge } from "../ui";

function Bar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="mono w-32 shrink-0 text-[var(--vs-text2)]">{label}</span>
      <div className="relative h-4 flex-1 overflow-hidden rounded bg-[var(--vs-bg)]">
        <div className="absolute left-0 top-0 h-full transition-all" style={{ width: `${pct}%`, background: color, opacity: 0.8 }} />
      </div>
      <span className="mono w-16 shrink-0 text-right text-[var(--vs-text)]">{count} / {total}</span>
      <span className="mono w-12 shrink-0 text-right text-[var(--vs-dim)]">{pct.toFixed(0)}%</span>
    </div>
  );
}

export function StatsView() {
  const loopReceipts = useStudio((s) => s.loopReceipts);
  const merkleRootLine = useStudio((s) => s.merkleRootLine);
  const ed25519Available = useStudio((s) => s.ed25519Available);

  const total = loopReceipts.length;
  const passCount = loopReceipts.filter((r) => r.verdict === "PASS").length;
  const failCount = loopReceipts.filter((r) => r.verdict === "FAIL").length;
  const cantCount = loopReceipts.filter((r) => r.verdict === "CANT_DECIDE").length;
  const realSigCount = loopReceipts.filter((r) => !r.sigStub).length;
  const stubSigCount = loopReceipts.filter((r) => r.sigStub).length;

  // time span
  const first = loopReceipts[0];
  const last = loopReceipts[loopReceipts.length - 1];
  let spanMs = 0;
  if (first && last) {
    spanMs = Date.parse(last.ts.replace("Z", "Z")) - Date.parse(first.ts.replace("Z", "Z"));
  }
  const spanSec = Math.abs(spanMs) / 1000;

  // merkle depth
  const tree = merkleTree(loopReceipts);
  const merkleDepth = tree.length;

  // rule pass/fail counts across all receipts
  const ruleStats: Record<string, { pass: number; fail: number; cant: number }> = {};
  for (const r of loopReceipts) {
    for (const rule of r.rules) {
      if (!ruleStats[rule.id]) ruleStats[rule.id] = { pass: 0, fail: 0, cant: 0 };
      if (rule.verdict === "PASS") ruleStats[rule.id].pass++;
      else if (rule.verdict === "FAIL") ruleStats[rule.id].fail++;
      else ruleStats[rule.id].cant++;
    }
  }

  const root = merkleRootLine().replace("MERKLE ROOT: ", "");

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="vvu-doc">
        <div className="vk">the loop / stats.py</div>
        <h1>Chain Statistics</h1>
        <p className="lede">
          Aggregate statistics over the whole chain — verdicts, signatures, time span,
          merkle depth, and per-rule pass/fail counts. Visual bars make the chain's
          health visible at a glance.
        </p>
      </div>

      {total === 0 ? (
        <Card>
          <div className="py-6 text-center text-[12px] text-[var(--vs-dim)]">No receipts. Run the loop first.</div>
        </Card>
      ) : (
        <>
          {/* headline stats */}
          <Card title="CHAIN HEALTH">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="text-center">
                <div className="mono text-[28px] font-bold text-[var(--vs-accent)]">{total}</div>
                <div className="mono text-[9px] uppercase tracking-[0.1em] text-[var(--vs-dim)]">receipts</div>
              </div>
              <div className="text-center">
                <div className="mono text-[28px] font-bold text-[var(--vs-accent)]">{passCount}</div>
                <div className="mono text-[9px] uppercase tracking-[0.1em] text-[var(--vs-dim)]">PASS</div>
              </div>
              <div className="text-center">
                <div className="mono text-[28px] font-bold text-[var(--vs-red)]">{failCount}</div>
                <div className="mono text-[9px] uppercase tracking-[0.1em] text-[var(--vs-dim)]">FAIL</div>
              </div>
              <div className="text-center">
                <div className="mono text-[28px] font-bold text-[var(--vs-amber)]">{cantCount}</div>
                <div className="mono text-[9px] uppercase tracking-[0.1em] text-[var(--vs-dim)]">CAN'T DECIDE</div>
              </div>
            </div>
          </Card>

          {/* verdict breakdown */}
          <Card title="VERDICT BREAKDOWN">
            <div className="space-y-2">
              <Bar label="PASS" count={passCount} total={total} color="var(--vs-accent)" />
              <Bar label="FAIL" count={failCount} total={total} color="var(--vs-red)" />
              <Bar label="CAN'T DECIDE" count={cantCount} total={total} color="var(--vs-amber)" />
            </div>
          </Card>

          {/* signature breakdown */}
          <Card title="SIGNATURE BREAKDOWN">
            <div className="space-y-2">
              <Bar label="real Ed25519" count={realSigCount} total={total} color="var(--vs-accent)" />
              <Bar label="HMAC stub" count={stubSigCount} total={total} color="var(--vs-amber)" />
            </div>
            <div className="mono mt-2 text-[10px] text-[var(--vs-dim)]">
              algorithm: {ed25519Available ? "Ed25519 (Web Crypto)" : "HMAC-SHA256 (fallback)"}
            </div>
          </Card>

          {/* time span + merkle depth */}
          <Card title="CHAIN METRICS">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <div className="mono text-[10px] uppercase text-[var(--vs-dim)]">time span</div>
                <div className="mono text-[16px] text-[var(--vs-text)]">
                  {spanSec < 60 ? `${spanSec.toFixed(1)}s` : spanSec < 3600 ? `${(spanSec / 60).toFixed(1)}m` : `${(spanSec / 3600).toFixed(1)}h`}
                </div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase text-[var(--vs-dim)]">merkle depth</div>
                <div className="mono text-[16px] text-[var(--vs-text)]">{merkleDepth} level{merkleDepth === 1 ? "" : "s"}</div>
              </div>
              <div>
                <div className="mono text-[10px] uppercase text-[var(--vs-dim)]">first receipt</div>
                <div className="mono text-[11px] text-[var(--vs-text2)]">{first?.ts.slice(11, 19)}Z</div>
              </div>
            </div>
          </Card>

          {/* per-rule stats */}
          <Card title="PER-RULE VERDICTS (across all receipts)">
            <div className="space-y-1.5">
              {Object.entries(ruleStats).map(([id, stats]) => (
                <div key={id} className="flex items-center gap-2 text-[11px]">
                  <span className="mono w-8 text-[var(--vs-text)]">{id}</span>
                  <div className="flex flex-1 gap-1">
                    <div className="relative h-4 flex-1 overflow-hidden rounded bg-[var(--vs-bg)]">
                      <div className="absolute left-0 top-0 h-full bg-[var(--vs-accent)] opacity-80" style={{ width: `${(stats.pass / total) * 100}%` }} />
                    </div>
                    <div className="relative h-4 flex-1 overflow-hidden rounded bg-[var(--vs-bg)]">
                      <div className="absolute left-0 top-0 h-full bg-[var(--vs-red)] opacity-80" style={{ width: `${(stats.fail / total) * 100}%` }} />
                    </div>
                    <div className="relative h-4 flex-1 overflow-hidden rounded bg-[var(--vs-bg)]">
                      <div className="absolute left-0 top-0 h-full bg-[var(--vs-amber)] opacity-80" style={{ width: `${(stats.cant / total) * 100}%` }} />
                    </div>
                  </div>
                  <span className="mono w-24 shrink-0 text-right text-[var(--vs-dim)]">{stats.pass}P {stats.fail}F {stats.cant}C</span>
                </div>
              ))}
            </div>
            <div className="mono mt-2 text-[10px] text-[var(--vs-dim)]">
              <span className="text-[var(--vs-accent)]">green = PASS</span> · <span className="text-[var(--vs-red)]">red = FAIL</span> · <span className="text-[var(--vs-amber)]">amber = CAN'T DECIDE</span>
            </div>
          </Card>

          {/* time-series chart: receipts over time */}
          <Card title="RECEIPTS OVER TIME · creation sequence">
            <TimeSeriesChart receipts={loopReceipts} />
          </Card>

          {/* verdict donut */}
          <Card title="VERDICT DISTRIBUTION · donut">
            <VerdictDonut pass={passCount} fail={failCount} cant={cantCount} total={total} />
          </Card>

          {/* activity heatmap */}
          <Card title="ACTIVITY HEATMAP · receipts by UTC hour">
            <ActivityHeatmap receipts={loopReceipts} />
          </Card>

          {/* merkle root */}
          <Card title="MERKLE ROOT">
            <div className="mono break-all text-[12px] text-[var(--vs-accent)]">{root}</div>
            <div className="mono mt-1 text-[10px] text-[var(--vs-dim)]">
              {short(root, 32)} — commits to all {total} receipts
            </div>
          </Card>

          <div className="vvu-doc">
            <div className="callout">
              <strong>Why statistics?</strong> The chain's health is visible at a glance:
              how many PASS vs FAIL, how many real signatures vs stubs, which rules
              fail most often. No trust required — these are all computed from the
              public receipts.
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export { short };

/* ---- Time-Series Chart: receipts over time ---- */
import type { Receipt } from "@/lib/vvu-studio/loop";

function TimeSeriesChart({ receipts }: { receipts: Receipt[] }) {
  if (receipts.length === 0) return <div className="text-[12px] text-[var(--vs-dim)]">no data</div>;
  const W = 600;
  const H = 120;
  const pad = 30;
  const n = receipts.length;
  // x = index, y = cumulative count (always increases by 1)
  const xFor = (i: number) => pad + (n > 1 ? (i / (n - 1)) * (W - pad * 2) : 0);
  const yFor = (count: number) => H - pad - (count / n) * (H - pad * 2);
  const colorFor = (v: string) => v === "PASS" ? "var(--vs-accent)" : v === "FAIL" ? "var(--vs-red)" : "var(--vs-amber)";
  // build path
  let path = "";
  for (let i = 0; i < n; i++) {
    const x = xFor(i);
    const y = yFor(i + 1);
    path += (i === 0 ? "M" : "L") + x + "," + y + " ";
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {/* grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
        <g key={i}>
          <line x1={pad} y1={pad + f * (H - pad * 2)} x2={W - pad} y2={pad + f * (H - pad * 2)} stroke="var(--vs-border)" strokeWidth={0.5} />
          <text x={pad - 4} y={pad + f * (H - pad * 2) + 3} fill="var(--vs-dimmer)" fontSize={8} fontFamily="monospace" textAnchor="end">{Math.round((1 - f) * n)}</text>
        </g>
      ))}
      {/* area under the line */}
      <path d={`${path} L${xFor(n - 1)},${H - pad} L${xFor(0)},${H - pad} Z`} fill="var(--vs-accent)" opacity={0.1} />
      {/* the line */}
      <path d={path} fill="none" stroke="var(--vs-accent)" strokeWidth={2} />
      {/* points colored by verdict */}
      {receipts.map((r, i) => (
        <g key={r.seq}>
          <circle cx={xFor(i)} cy={yFor(i + 1)} r={4} fill={colorFor(r.verdict)} stroke="var(--vs-bg2)" strokeWidth={1.5}>
            <title>#{r.seq} · {r.verdict} · {r.ts.slice(11, 19)}Z</title>
          </circle>
          {(n <= 12 || i % Math.ceil(n / 12) === 0) && (
            <text x={xFor(i)} y={H - pad + 12} fill="var(--vs-dim)" fontSize={7} fontFamily="monospace" textAnchor="middle">#{r.seq}</text>
          )}
        </g>
      ))}
      {/* y-axis label */}
      <text x={pad - 18} y={H / 2} fill="var(--vs-dim)" fontSize={8} fontFamily="monospace" textAnchor="middle" transform={`rotate(-90 ${pad - 18} ${H / 2})`}>cumulative</text>
    </svg>
  );
}

/* ---- Verdict Donut Chart ---- */
function VerdictDonut({ pass, fail, cant, total }: { pass: number; fail: number; cant: number; total: number }) {
  const W = 200, H = 200, cx = 100, cy = 100, r = 70, ir = 45;
  if (total === 0) return <div className="text-[12px] text-[var(--vs-dim)]">no data</div>;
  const segments = [
    { count: pass, color: "var(--vs-accent)", label: "PASS" },
    { count: fail, color: "var(--vs-red)", label: "FAIL" },
    { count: cant, color: "var(--vs-amber)", label: "CAN'T" },
  ];
  let angle = -Math.PI / 2;
  const arcs = segments.filter((s) => s.count > 0).map((s) => {
    const frac = s.count / total;
    const a2 = angle + frac * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
    const ix1 = cx + ir * Math.cos(a2), iy1 = cy + ir * Math.sin(a2);
    const ix2 = cx + ir * Math.cos(angle), iy2 = cy + ir * Math.sin(angle);
    const large = frac > 0.5 ? 1 : 0;
    const d = `M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} L${ix1},${iy1} A${ir},${ir} 0 ${large} 0 ${ix2},${iy2} Z`;
    angle = a2;
    return { d, color: s.color, label: s.label, count: s.count };
  });
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-[180px] shrink-0">
        {arcs.map((a, i) => (
          <path key={i} d={a.d} fill={a.color} opacity={0.85} stroke="var(--vs-bg2)" strokeWidth={1}>
            <title>{a.label}: {a.count}</title>
          </path>
        ))}
        <text x={cx} y={cy - 4} fill="var(--vs-text)" fontSize={28} fontWeight="bold" fontFamily="monospace" textAnchor="middle">{total}</text>
        <text x={cx} y={cy + 12} fill="var(--vs-dim)" fontSize={8} fontFamily="monospace" textAnchor="middle">receipts</text>
      </svg>
      <div className="space-y-1.5 text-[11px]">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm" style={{ background: s.color, opacity: 0.85 }} />
            <span className="mono text-[var(--vs-text2)]">{s.label}</span>
            <span className="mono text-[var(--vs-text)]">{s.count}</span>
            <span className="mono text-[var(--vs-dim)]">{total > 0 ? ((s.count / total) * 100).toFixed(0) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- Activity Heatmap: receipts by UTC hour ---- */
function ActivityHeatmap({ receipts }: { receipts: Receipt[] }) {
  const hours = Array.from({ length: 24 }, () => ({ pass: 0, fail: 0, cant: 0 }));
  for (const r of receipts) {
    const h = parseInt(r.ts.slice(11, 13), 10);
    if (!isNaN(h) && h >= 0 && h < 24) {
      if (r.verdict === "PASS") hours[h].pass++;
      else if (r.verdict === "FAIL") hours[h].fail++;
      else hours[h].cant++;
    }
  }
  const maxCount = Math.max(1, ...hours.map((h) => h.pass + h.fail + h.cant));
  return (
    <div>
      <div className="grid grid-cols-12 gap-1 sm:grid-cols-24">
        {hours.map((h, i) => {
          const count = h.pass + h.fail + h.cant;
          const intensity = count / maxCount;
          const bg = count === 0 ? "var(--vs-bg)" : `rgba(52, 211, 153, ${0.2 + intensity * 0.7})`;
          return (
            <div
              key={i}
              className="mono flex aspect-square items-center justify-center rounded text-[8px]"
              style={{ background: bg, color: count > 0 ? "var(--vs-bg)" : "var(--vs-dimmer)" }}
              title={`${i}:00 UTC · ${count} receipt${count === 1 ? "" : "s"} (P${h.pass} F${h.fail} C${h.cant})`}
            >
              {count > 0 ? count : ""}
            </div>
          );
        })}
      </div>
      <div className="mono mt-2 flex items-center justify-between text-[9px] text-[var(--vs-dim)]">
        <span>00:00 UTC</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>23:00</span>
      </div>
      <div className="mono mt-1 text-[10px] text-[var(--vs-dim)]">
        each cell = a UTC hour · darker = more receipts · hover for breakdown
      </div>
    </div>
  );
}
