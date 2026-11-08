"use client";

// src/components/analytics/MoiVoting.tsx — MOI voting algebra (Chapter 2).
// Radial gauge with live founder-aligned % from the analytics feed, the
// terminal share table (2,727,100 votes → 70.66%), live A/B vote ledger line
// and the "why Class B only" guardrail card.

import { AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MOI, MOI_TERMINAL_TABLE } from "@/lib/vvu-data";
import {
  Chip,
  LiveDot,
  QueryErrorCard,
  SectionHeader,
  fmtNum,
  useAnalyticsQuery,
  useQueryErrorToast,
} from "./shared";

// ─── Radial gauge ───────────────────────────────────────────────────────────

const GAUGE_R = 84;
const GAUGE_CX = 100;
const GAUGE_CY = 100;
const GAUGE_C = 2 * Math.PI * GAUGE_R;

const toRad = (deg: number): number => (deg * Math.PI) / 180;
const ptAt = (deg: number, r: number): { x: number; y: number } => ({
  x: GAUGE_CX + r * Math.cos(toRad(deg)),
  y: GAUGE_CY + r * Math.sin(toRad(deg)),
});

function VotingDonut({
  pct,
  targetPct,
  loading,
}: {
  pct: number | null;
  targetPct: number;
  loading: boolean;
}) {
  const clamped = pct === null ? 0 : Math.max(0, Math.min(100, pct));
  const targetAngle = (targetPct / 100) * 360 - 90;
  const targetOuter = ptAt(targetAngle, GAUGE_R + 14);
  const targetInner = ptAt(targetAngle, GAUGE_R - 14);

  return (
    <div
      className="relative w-full max-w-[250px] mx-auto"
      role="img"
      aria-label={`Founder-aligned control ${pct === null ? "unknown" : `${pct.toFixed(2)} percent`}, terminal target ${targetPct} percent`}
    >
      <svg viewBox="0 0 200 200" className="w-full h-auto block">
        {/* track */}
        <circle
          cx={GAUGE_CX}
          cy={GAUGE_CY}
          r={GAUGE_R}
          fill="none"
          stroke="rgba(107,138,64,0.16)"
          strokeWidth={12}
        />
        {/* live value arc (sage, animates via dash-offset transition) */}
        <circle
          cx={GAUGE_CX}
          cy={GAUGE_CY}
          r={GAUGE_R}
          fill="none"
          stroke="#8fb35a"
          strokeWidth={12}
          strokeDasharray={GAUGE_C}
          strokeDashoffset={GAUGE_C * (1 - clamped / 100)}
          transform={`rotate(-90 ${GAUGE_CX} ${GAUGE_CY})`}
          style={{ transition: "stroke-dashoffset 800ms ease-out" }}
        />
        {/* 10% tick marks */}
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => {
          const a = (i / 10) * 360 - 90;
          const from = ptAt(a, GAUGE_R - 8);
          const to = ptAt(a, GAUGE_R + 8);
          return (
            <line
              key={i}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="#7a8a6e"
              strokeWidth={i % 5 === 0 ? 2 : 1}
              opacity={i % 5 === 0 ? 0.9 : 0.45}
            />
          );
        })}
        {/* ochre target marker at the terminal 70.66% */}
        <line
          x1={targetInner.x}
          y1={targetInner.y}
          x2={targetOuter.x}
          y2={targetOuter.y}
          stroke="#f3e38a"
          strokeWidth={3}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        {loading ? (
          <span className="text-3xl font-bold text-[#7a8a6e]">—</span>
        ) : (
          <>
            <span className="text-3xl sm:text-4xl font-bold text-[#c8ff00] tabular-nums leading-none">
              {pct === null ? "—" : pct.toFixed(2)}
              <span className="text-lg">%</span>
            </span>
            <span className="vvu-label text-[8px] text-[#7a8a6e] mt-1.5">FOUNDER-ALIGNED</span>
            <span className="vvu-label text-[8px] text-[#7a8a6e]">CONTROL</span>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Section ────────────────────────────────────────────────────────────────

export function MoiVoting({ num }: { num?: string }) {
  const query = useAnalyticsQuery();
  useQueryErrorToast(query.isError, query.error, "MOI VOTING");
  const v = query.data?.voting ?? null;
  const terminalReached = v !== null && v.pct >= v.terminalPct - 0.005;
  // Task 8-a — CERTIFIED gate reality from the same analytics feed (gates[]):
  // the % ALIGNED chip is voting-algebra PROJECTION, this second chip is the
  // certification REALITY — the two must be labelled separately.
  const gates = query.data?.gates ?? null;
  const certifiedCount = gates ? gates.filter((g) => g.status === "CERTIFIED").length : null;
  const gateChip =
    certifiedCount === null ? null : certifiedCount === 3 ? (
      <Chip tone="lime">GATES CERTIFIED ✓</Chip>
    ) : certifiedCount > 0 ? (
      <Chip tone="amber">GATES {certifiedCount}/3 CERTIFIED</Chip>
    ) : (
      <Chip tone="dim" dashed>
        UNCERTIFIED · LIVE SIM ONLY
      </Chip>
    );

  return (
    <section className="vvu-panel vvu-enter p-4 sm:p-5" aria-label="MOI voting algebra">
      <SectionHeader
        num={num}
        title="MOI VOTING ALGEBRA · 70.66% TERMINAL"
        kicker="CHAPTER 2 · DUAL-CLASS SHARE STRUCTURE"
        right={
          <>
            <Chip tone={terminalReached ? "lime" : "sage"}>
              {v ? `${v.pct.toFixed(2)}% ALIGNED` : "— ALIGNED"}
            </Chip>
            {gateChip}
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* left: gauge + resolution power chips */}
        <div className="lg:col-span-2 flex flex-col items-center gap-4">
          <VotingDonut pct={v?.pct ?? null} targetPct={MOI.terminalPct} loading={query.isPending} />
          <div className="vvu-label text-[9px] text-[#f3e38a] flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 bg-[#f3e38a]" aria-hidden />
            TARGET {MOI.terminalPct.toFixed(2)}% TERMINAL CONTROL
          </div>
          <div className="flex flex-wrap justify-center gap-1.5 max-w-[300px]">
            <Chip tone="lime">BLOCKS SPECIAL RESOLUTIONS ✓ (&gt;25%)</Chip>
            <Chip tone="lime">PASSES ORDINARY ✓ (50%+1)</Chip>
            <Chip tone="sage">JSE FREE-FLOAT 20% ✓</Chip>
            <Chip tone="sage" dashed>
              DILUTION FLOOR 55% (ART 5.3.3)
            </Chip>
          </div>
        </div>

        {/* right: terminal table + live ledger line + guardrail card */}
        <div className="lg:col-span-3 space-y-3 min-w-0">
          {query.isPending ? (
            <Skeleton className="h-44 w-full bg-[#141a11]" />
          ) : query.isError ? (
            <QueryErrorCard label="MOI VOTING" onRetry={() => void query.refetch()} />
          ) : v ? (
            <>
              <div className="overflow-x-auto -mx-1 px-1">
                <Table className="text-[11px]">
                  <TableHeader>
                    <TableRow className="border-[rgba(107,138,64,0.25)] hover:bg-transparent">
                      <TableHead className="vvu-label text-[9px] text-[#7a8a6e] py-2">
                        HOLDER
                      </TableHead>
                      <TableHead className="vvu-label text-[9px] text-[#7a8a6e] py-2 text-right">
                        SHARES
                      </TableHead>
                      <TableHead className="vvu-label text-[9px] text-[#7a8a6e] py-2 text-right">
                        VOTES
                      </TableHead>
                      <TableHead className="vvu-label text-[9px] text-[#7a8a6e] py-2 hidden md:table-cell">
                        NOTE
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MOI_TERMINAL_TABLE.map((row) => (
                      <TableRow
                        key={row.holder}
                        className="border-[rgba(107,138,64,0.15)] hover:bg-[rgba(107,138,64,0.06)]"
                      >
                        <TableCell className="py-2 text-[#c9d4bd]">{row.holder}</TableCell>
                        <TableCell className="py-2 text-right text-[#7a8a6e]">
                          {row.shares}
                        </TableCell>
                        <TableCell className="py-2 text-right text-[#f3e38a] font-bold tabular-nums">
                          {fmtNum(row.votes)}
                        </TableCell>
                        <TableCell className="py-2 text-[#7a8a6e] hidden md:table-cell">
                          {row.note}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-[rgba(107,138,64,0.35)] bg-[#6b8a40]/10">
                      <TableCell className="py-2 font-bold vvu-label text-[10px] text-[#c8ff00]">
                        TOTAL
                      </TableCell>
                      <TableCell className="py-2 text-right text-[#7a8a6e]">—</TableCell>
                      <TableCell className="py-2 text-right font-bold text-[#c8ff00] tabular-nums">
                        {fmtNum(MOI.terminalTotalVotes)}
                      </TableCell>
                      <TableCell className="py-2 vvu-label text-[9px] text-[#c8ff00] hidden md:table-cell">
                        70.66% TERMINAL CONTROL
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="vvu-panel-solid p-3 flex items-start gap-2">
                <LiveDot />
                <p className="vvu-label text-[10px] text-[#c9d4bd] leading-relaxed">
                  LIVE:{" "}
                  <span className="text-[#f3e38a] tabular-nums">{fmtNum(v.founderVotesA)}</span>{" "}
                  A-VOTES +{" "}
                  <span className="text-[#f3e38a] tabular-nums">
                    {fmtNum(v.founderSweatB + v.trustB)}
                  </span>{" "}
                  B-VOTES ALIGNED ={" "}
                  <span className="text-[#c8ff00] font-bold tabular-nums">
                    {fmtNum(v.founderAlignedVotes)}
                  </span>{" "}
                  / <span className="tabular-nums">{fmtNum(v.totalVotes)}</span> ={" "}
                  <span className="text-[#c8ff00] font-bold tabular-nums">{v.pct.toFixed(2)}%</span>
                </p>
              </div>
            </>
          ) : null}

          <div className="vvu-panel-solid p-3.5" style={{ borderColor: "rgba(229,72,77,0.45)" }}>
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle className="size-3.5 text-[#e0a030] shrink-0" aria-hidden />
              <span className="vvu-label text-[10px] font-bold text-[#e0a030]">
                WHY THE TRUST HOLDS CLASS B ONLY
              </span>
            </div>
            <p className="text-[11px] text-[#e0a030]/90 leading-relaxed">
              If the Trust held Class A: founder hits <b className="text-[#f3e38a]">83.33%</b>{" "}
              weighted voting → breaches the JSE free-float (20% minimum) → JSE will not list.{" "}
              <b>Solution: the Trust ONLY gets Class B.</b>{" "}
              <span className="text-[#7a8a6e]">(Chapter 2.4)</span>
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="vvu-panel-solid p-2.5 flex items-start gap-2">
              <Chip tone="sage">ART 5.3.3</Chip>
              {/* Task 8-a: note paragraphs bumped #7a8a6e → #96a587 (readability) */}
              <span className="text-[10px] text-[#96a587] leading-relaxed">
                DILUTION FLOOR — founder-aligned voting may never fall below 55%.
              </span>
            </div>
            <div className="vvu-panel-solid p-2.5 flex items-start gap-2">
              <Chip tone="sage">ART 5.3.4</Chip>
              <span className="text-[10px] text-[#96a587] leading-relaxed">
                PRE-EMPTIVE TOP-UP — new share issues trigger top-up rights protecting control.
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default MoiVoting;
