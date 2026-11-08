"use client";

// src/components/analytics/MrrPanel.tsx — live MRR progress toward the R50k
// Gate 3B threshold, month-streak tracker, 10× ARR valuation line and the
// 30-day pipeline counters (emails/demos/pilots vs the 90-day scorecard).

import { useState } from "react";
import { useFrame } from "@/hooks/use-vvu-socket";
import { FULL_LICENSE_PRICE, MRR_TARGET, PILOT_PRICE } from "@/lib/vvu-data";
import { cn } from "@/lib/utils";
import { Chip, LiveBar, SectionHeader, fmtNum, SCADA } from "./shared";

const PIPELINE_TARGETS = { emails: 300, demos: 30, pilots: 5 } as const;

const PIPELINE_ROWS: Array<{ key: keyof typeof PIPELINE_TARGETS; label: string }> = [
  { key: "emails", label: "EMAILS" },
  { key: "demos", label: "DEMOS" },
  { key: "pilots", label: "PILOTS" },
];

export function MrrPanel({ num }: { num?: string }) {
  const frame = useFrame();
  const m = frame?.metrics ?? null;
  const mrr = m?.mrr ?? null;
  const mrrPct = mrr === null ? 0 : Math.min(100, (mrr / MRR_TARGET) * 100);
  const atTarget = mrr !== null && mrr >= MRR_TARGET;
  const streak = m?.consecutiveMonthsAt50k ?? 0;

  // Task 6-c — flash the big number lime (300ms) when the value INCREASES.
  // Documented "adjust state when a prop changes" pattern (render-phase
  // update, no effects): remember the previous mrr and the direction of the
  // last change. The <span> below is keyed by the value, so an increase
  // remounts it with the flash class; a decrease remounts without it.
  const [prevMrr, setPrevMrr] = useState<number | null>(mrr);
  const [mrrRose, setMrrRose] = useState(false);
  if (mrr !== prevMrr) {
    setPrevMrr(mrr);
    setMrrRose(mrr !== null && prevMrr !== null && mrr > prevMrr);
  }

  return (
    <section className="vvu-panel vvu-enter p-4 sm:p-5" aria-label="MRR progress">
      <SectionHeader
        num={num}
        title="MRR PROGRESS · R50K GATE 3B"
        kicker="LIVE FROM GQEBERHA EDGE SIM"
        right={
          <>
            <Chip tone={m ? "lime" : "dim"}>{m ? "LIVE" : "AWAITING TELEMETRY"}</Chip>
            <Chip tone="dim">CUSTOMERS {m ? fmtNum(m.customers) : "—"}</Chip>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* left: big MRR + bar + streak + valuation */}
        <div className="lg:col-span-3 space-y-4 min-w-0">
          <div>
            <div className="flex items-end gap-2 flex-wrap">
              <span
                key={`${mrr ?? "na"}`}
                className={cn(
                  "text-4xl sm:text-5xl font-bold tabular-nums leading-none",
                  atTarget ? "text-[#c8ff00]" : "text-[#f3e38a]",
                  mrrRose && "vvu6c-flash",
                )}
              >
                {mrr === null ? "—" : `R${(mrr / 1000).toFixed(1)}k`}
              </span>
              <span className="vvu-label text-[10px] text-[#7a8a6e] pb-1">
                / R{(MRR_TARGET / 1000).toFixed(0)}K TARGET
              </span>
            </div>
            <div
              className={cn(
                "mt-3 h-2.5 rounded-full bg-[#131811] border border-[rgba(107,138,64,0.2)] overflow-hidden",
                // Task 6-c: shimmer only while the bar is actively live.
                mrr !== null && "vvu6c-shimmer",
              )}
              role="progressbar"
              aria-label="monthly recurring revenue toward R50k"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(mrrPct)}
            >
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{
                  width: `${mrrPct}%`,
                  background: atTarget
                    ? SCADA.lime
                    : `linear-gradient(90deg, ${SCADA.sage}, ${SCADA.sageBright})`,
                }}
              />
            </div>
            <div className="flex justify-between mt-1.5 vvu-label text-[8px] text-[#7a8a6e]">
              <span>R0</span>
              <span className={atTarget ? "text-[#c8ff00]" : undefined}>
                {mrrPct.toFixed(0)}% OF TARGET
              </span>
              <span>R{(MRR_TARGET / 1000).toFixed(0)}K</span>
            </div>
          </div>

          <div className="vvu-panel-solid p-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              {[0, 1].map((i) => {
                const filled = i < streak;
                return (
                  <span
                    key={i}
                    aria-label={
                      filled ? `month ${i + 1} at R50k achieved` : `month ${i + 1} pending`
                    }
                    className={cn(
                      "w-8 h-8 rounded flex items-center justify-center vvu-label text-[10px] font-bold border",
                      filled
                        ? "bg-[#c8ff00] text-[#060806] border-[#c8ff00]"
                        : "border-[rgba(107,138,64,0.35)] text-[#7a8a6e]",
                    )}
                  >
                    {filled ? "✓" : i + 1}
                  </span>
                );
              })}
            </div>
            <div className="min-w-0">
              <div className="vvu-label text-[9px] text-[#c9d4bd] font-bold">
                CONSECUTIVE MONTHS AT R50K
              </div>
              <div className="vvu-label text-[8px] text-[#7a8a6e] mt-0.5">
                GATE 3B REQUIRES 2 · PROVEN BY BANK STATEMENTS (XERO RECONCILED)
              </div>
            </div>
            <span className="ml-auto vvu-label text-[11px] font-bold text-[#8fb35a] tabular-nums">
              {streak}/2
            </span>
          </div>

          <div className="vvu-panel-solid p-3">
            <div className="vvu-label text-[10px] sm:text-xs font-bold text-[#f3e38a]">
              10× ARR @ R50K → R600,000 PRE-MONEY
            </div>
            <p className="text-[10px] text-[#7a8a6e] leading-relaxed mt-1.5">
              R{PILOT_PRICE / 1000}k pilot (30 days) → R{(FULL_LICENSE_PRICE / 1000).toFixed(0)}k/mo
              full licence (3 nodes) · trigger: 3 successful verifications.
            </p>
          </div>
        </div>

        {/* right: pipeline counters */}
        <div className="lg:col-span-2 vvu-panel-solid p-3.5 min-w-0">
          <div className="vvu-label text-[9px] text-[#7a8a6e] mb-4">
            PIPELINE · 90-DAY SCORECARD {PIPELINE_TARGETS.emails}/{PIPELINE_TARGETS.demos}/
            {PIPELINE_TARGETS.pilots}
          </div>
          <div className="space-y-4">
            {PIPELINE_ROWS.map((row) => (
              <LiveBar
                key={row.key}
                spec={{
                  label: row.label,
                  current: m?.pipeline[row.key] ?? null,
                  target: PIPELINE_TARGETS[row.key],
                  fmt: "num",
                }}
              />
            ))}
          </div>
          <p className="vvu-label text-[8px] text-[#7a8a6e] mt-4 leading-relaxed">
            COUNTERS ACCRUE LIVE FROM THE SIM · EVERY R5K PILOT INVOICE FEEDS GATE 3A
          </p>
        </div>
      </div>
    </section>
  );
}

export default MrrPanel;
