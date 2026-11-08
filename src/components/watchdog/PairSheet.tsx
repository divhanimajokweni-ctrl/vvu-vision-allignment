'use client';

// src/components/watchdog/PairSheet.tsx — R104 · THE PAIR SHEET, the
// auto-pairs' own record.
//
// The verdict trend strip reads ROWS (each fire, one line). The storm
// history (R103) reads the DEAD's band over time. This panel reads the
// auto-pair ERA itself: every cycle the guardian has run since R99 — opener
// → second on one boot — as one row, plus the openers' climbs as a drift
// strip. Three reads one frame:
//
//   THE OPENING DRIFT — each cycle's opener climb (the boot's temperature
//   when the guardian first looked) vs cycle sequence. R103 read the dead's
//   ceiling rising +15 MB/kill; this reads the living side of the same
//   storm: are the boots opening warmer cycle after cycle? Beads carry the
//   kind tones the ledger already swears by; a too-few refusal renders
//   hollow and drops from the trend (counted, never imputed).
//
//   THE CYCLES — one row per boot: opener kind + climb, the second's kind +
//   climb, the climb delta across the pair, and the outcome. COMPLETE pairs
//   show their arc; HONEST LOSS marks the boot that died before its +1080s
//   second (the storm pressure the pair exists to witness — counted, not
//   hidden); OPERATOR PAIR marks the boot whose auto-opener refused and the
//   operator's hand completed; PENDING pulses amber and promises nothing.
//
//   THE KINDS — flat→mixed (booted cool, warmed), flat→flat (stable),
//   tracked→tracked (opened hot, never cooled): the pair kinds are the
//   warm-state's phase read, one line each, no memory required.

import { pairSheet, type PairSheetRow } from '@/lib/pair-sheet';

const KIND_TONE_HEX: Record<string, string> = {
  flat: '#c8ff00',
  mixed: '#e0a030',
  tracked: '#e5484d',
  'too-few': '#5f6e55',
};

const KIND_CHIP_CLS: Record<string, string> = {
  flat: 'border-[#6b8a40]/60 text-[#c8ff00] bg-[#6b8a40]/10',
  mixed: 'border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10',
  tracked: 'border-[#e5484d]/60 text-[#e5484d] bg-[#e5484d]/10',
  'too-few': 'border-[#3a4530] text-[#7a8a6e] bg-black/30',
};

function kindCls(kind: string): string {
  return KIND_CHIP_CLS[kind] ?? 'border-[#3a4530] text-[#7a8a6e] bg-black/30';
}

function kindHex(kind: string): string {
  return KIND_TONE_HEX[kind] ?? '#5f6e55';
}

const OUTCOME_TAG: Record<string, { label: string; cls: string }> = {
  complete: { label: 'COMPLETE', cls: 'border-[#6b8a40]/60 text-[#c8ff00] bg-[#6b8a40]/10' },
  'honest-loss': { label: 'HONEST LOSS', cls: 'border-[#e5484d]/60 text-[#e5484d] bg-[#e5484d]/10' },
  'operator-pair': { label: 'OPERATOR PAIR', cls: 'border-[#00d4e0]/60 text-[#00d4e0] bg-[#00d4e0]/10' },
  pending: { label: 'PENDING', cls: 'border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10' },
};

/** the row's left rail carries the outcome's own hue — the eye scans the
 *  sheet's shape (completed sage, losses rose, the operator's hand cyan,
 *  the still-open amber) before any text is read. */
const OUTCOME_RAIL: Record<string, string> = {
  complete: 'border-l-[#6b8a40]/70',
  'honest-loss': 'border-l-[#e5484d]/70',
  'operator-pair': 'border-l-[#00d4e0]/70',
  pending: 'border-l-[#e0a030]/70',
};

export function PairSheet({ rows }: { rows: Array<PairSheetRow> }) {
  const s = pairSheet(
    (rows ?? []).map((r) => ({
      atMs: typeof r.atMs === 'number' && Number.isFinite(r.atMs) ? r.atMs : null,
      bootPid: r.bootPid,
      kind: String(r.kind ?? ''),
      climbMb: typeof r.climbMb === 'number' && Number.isFinite(r.climbMb) ? r.climbMb : null,
      uptimeSec: typeof r.uptimeSec === 'number' && Number.isFinite(r.uptimeSec) ? r.uptimeSec : null,
      via: r.via != null ? String(r.via) : null,
    })),
  );
  if (s.cycles.length === 0) return null; // pre-auto-era ledger — the sheet waits, honestly empty

  // ── the drift strip: opener climbs vs cycle sequence ──
  const W = 520;
  const H = 56;
  const pad = 12;
  const beadCycles = s.cycles.filter((c) => c.opener.climbMb != null);
  const vals = beadCycles.map((c) => c.opener.climbMb!);
  const lo = Math.min(...vals, 0) - 25;
  const hi = Math.max(...vals, 0) + 25;
  const span = hi - lo || 1;
  const xSeq = (seq: number) => pad + ((seq - 1) / Math.max(1, s.cycles.length - 1)) * (W - 2 * pad);
  const yC = (v: number) => 6 + (1 - (v - lo) / span) * (H - 12);
  const zeroY = lo < 0 && hi > 0 ? yC(0) : null;

  const trend =
    s.openingDriftMbPerCycle != null && s.openings.length >= 2
      ? (() => {
          const xs = s.openings.map((o) => o.seq);
          const ys = s.openings.map((o) => o.climbMb);
          const n = xs.length;
          const mx = xs.reduce((a, b) => a + b, 0) / n;
          const my = ys.reduce((a, b) => a + b, 0) / n;
          let sxx = 0;
          let sxy = 0;
          for (let i = 0; i < n; i++) {
            sxx += (xs[i]! - mx) * (xs[i]! - mx);
            sxy += (xs[i]! - mx) * (ys[i]! - my);
          }
          if (sxx === 0) return null;
          const slope = sxy / sxx;
          const intercept = my - slope * mx;
          return {
            x1: xSeq(xs[0]!),
            y1: yC(slope * xs[0]! + intercept),
            x2: xSeq(xs[n - 1]!),
            y2: yC(slope * xs[n - 1]! + intercept),
          };
        })()
      : null;

  const hhmm = (ms: number | null) => (ms != null ? new Date(ms).toISOString().slice(11, 19) : '—');
  const fmtClimb = (v: number | null) => (v != null ? `${v > 0 ? '+' : ''}${v} MB` : '—');
  const driftTone =
    s.openingDriftRead === 'warming'
      ? 'border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10'
      : s.openingDriftRead === 'cooling'
        ? 'border-[#00d4e0]/60 text-[#00d4e0] bg-[#00d4e0]/10'
        : 'border-[#3a4530] text-[#7a8a6e] bg-black/30';

  return (
    <div
      className="mt-1.5 space-y-1 border-t border-[#3a4530]/60 pt-1.5"
      data-testid="pair-sheet"
      title="R104 — THE PAIR SHEET: every cycle the guardian's auto-pair has run since R99 (opener +210s, second +1080s after each bounce), read from the verdict ledger's own rows. TOP: each cycle's opener climb vs sequence — are the boots opening warmer as the storm deepens? (R103 read the dead's ceiling rising; this reads the living side of the same question.) A too-few refusal renders hollow and drops from the trend. ROWS: one per boot — opener → second, the climb delta across the pair, and the outcome: COMPLETE, HONEST LOSS (the boot died before its second), OPERATOR PAIR (the auto-opener refused; the operator's hand completed), PENDING (the timer still owes its fire). The ledger holds what fired, never what was scheduled."
    >
      <p className="vvu-label text-[7.5px] font-bold tracking-[0.18em] text-[#7a8a6e]">
        THE PAIR SHEET · THE AUTO-PAIRS&apos; OWN RECORD
      </p>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`pair sheet: ${s.cycles.length} auto-pair cycles, opener drift ${s.openingDriftMbPerCycle ?? '—'} MB per cycle, ${s.completePairs} pairs completed, ${s.honestLosses} honest ${s.honestLosses === 1 ? 'loss' : 'losses'}`}
      >
        {/* the zero line — climbs are signed; cool starts sit under it */}
        {zeroY != null && (
          <line x1={pad} y1={zeroY} x2={W - pad} y2={zeroY} stroke="#3a4530" strokeWidth={0.6} strokeDasharray="3 3" opacity={0.7}>
            <title>{'climb 0 — a boot opening below this line started COOLER than its boot boundary; above it, already climbing'}</title>
          </line>
        )}
        {trend && (
          <line
            x1={trend.x1}
            y1={trend.y1}
            x2={trend.x2}
            y2={trend.y2}
            stroke={s.openingDriftRead === 'cooling' ? '#00d4e0' : '#e0a030'}
            strokeWidth={1.25}
            opacity={s.openingDriftRead === 'flat' ? 0.35 : 0.75}
            strokeDasharray="4 3"
          >
            <title>{`THE OPENING DRIFT — ${s.openingDriftMbPerCycle != null && s.openingDriftMbPerCycle > 0 ? '+' : ''}${s.openingDriftMbPerCycle ?? '—'} MB/cycle (R² ${s.openingDriftR2 ?? '—'}) · first half opened at a ${s.firstHalfMedianClimbMb ?? '—'} MB median climb, last half ${s.lastHalfMedianClimbMb ?? '—'} MB`}</title>
          </line>
        )}
        {beadCycles.map((c) => {
          const tooFew = c.opener.kind === 'too-few';
          const hex = kindHex(c.opener.kind);
          return (
            <g key={`ps-${c.bootPid}`} className="cursor-help">
              <circle
                cx={xSeq(c.seq)}
                cy={yC(c.opener.climbMb!)}
                r={3.2}
                fill={tooFew ? 'transparent' : hex}
                stroke={hex}
                strokeWidth={tooFew ? 1 : 0.5}
                opacity={tooFew ? 0.8 : 0.9}
              />
              <title>
                {`CYCLE ${c.seq} · BOOT ${c.bootPid} — opener ${c.opener.kind.toUpperCase()} @ ${c.opener.uptimeSec ?? '—'}s · climb ${fmtClimb(c.opener.climbMb)}${tooFew ? ' · REFUSED — too few samples to judge; excluded from the drift' : ''}`}
              </title>
            </g>
          );
        })}
      </svg>

      {/* the cycles — one row per boot, 390px-safe wraps */}
      <div className="space-y-0.5">
        {s.cycles.map((c) => {
          const tag = OUTCOME_TAG[c.outcome];
          return (
            <div
              key={`pc-${c.bootPid}`}
              className={`flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-sm border-l-2 bg-black/20 px-1.5 py-0.5 ${OUTCOME_RAIL[c.outcome] ?? 'border-l-[#3a4530]/60'}`}
            >
              <span className="vvu-label text-[7px] font-bold text-[#7a8a6e] tabular-nums" title={`cycle ${c.seq} of the auto era — boot pid ${c.bootPid}${c.opener.atMs != null ? `, opener fired ${hhmm(c.opener.atMs)} UTC` : ''}`}>
                CYCLE {c.seq} · BOOT {c.bootPid}
              </span>
              <span
                className={`vvu-label text-[7px] font-bold px-1 py-px rounded-sm border ${kindCls(c.opener.kind)} tabular-nums`}
                title={`OPENER — ${c.opener.kind.toUpperCase()} @ uptime ${c.opener.uptimeSec ?? '—'}s · climb ${fmtClimb(c.opener.climbMb)} · via ${c.opener.via ?? 'unmarked'} · recorded ${hhmm(c.opener.atMs)} UTC`}
              >
                OPENER {c.opener.kind.toUpperCase()} · {fmtClimb(c.opener.climbMb)}
              </span>
              <span className="text-[#5f6e55] text-[8px]" aria-hidden>
                →
              </span>
              {c.second != null ? (
                <span
                  className={`vvu-label text-[7px] font-bold px-1 py-px rounded-sm border ${kindCls(c.second.kind)} tabular-nums`}
                  title={`SECOND — ${c.second.kind.toUpperCase()} @ uptime ${c.second.uptimeSec ?? '—'}s · climb ${fmtClimb(c.second.climbMb)} · via ${c.second.via ?? 'unmarked'} · recorded ${hhmm(c.second.atMs)} UTC`}
                >
                  SECOND {c.second.kind.toUpperCase()} · {fmtClimb(c.second.climbMb)}
                </span>
              ) : c.outcome === 'operator-pair' ? (
                <span
                  className={`vvu-label text-[7px] font-bold px-1 py-px rounded-sm border ${OUTCOME_TAG['operator-pair'].cls} tabular-nums`}
                  title={`the auto-opener REFUSED (too few samples) — the operator's own hand took this boot's pair: ${c.operatorKinds.join(' → ') || 'no kinds on record'}. The record's triggers are part of the record.`}
                >
                  OPERATOR PAIR · {c.operatorKinds.join('→').toUpperCase() || '—'}
                </span>
              ) : c.outcome === 'honest-loss' ? (
                <span
                  className={`vvu-label text-[7px] font-bold px-1 py-px rounded-sm border ${OUTCOME_TAG['honest-loss'].cls} tabular-nums`}
                  title="the boot DIED before its +1080s second could fire — the honest-loss design working exactly as drawn: the storm's pressure is the finding, the absence is recorded, nothing is imputed"
                >
                  HONEST LOSS
                </span>
              ) : (
                <span
                  className={`vvu-label text-[7px] font-bold px-1 py-px rounded-sm border ${OUTCOME_TAG.pending.cls} tabular-nums vvu-pulse`}
                  title="the opener has fired and no second exists yet — the guardian's +1080s timer still owes its fire. The ledger holds what FIRED, never what was scheduled, so this sheet names the design constant and promises no ETA."
                >
                  SECOND PENDING
                </span>
              )}
              {c.climbDeltaMb != null && (
                <span
                  className="vvu-label text-[7px] font-bold px-1 py-px rounded-sm border border-[#3a4530] text-[#c9d4bd] bg-black/30 tabular-nums cursor-help transition-[filter,border-color] hover:brightness-125"
                  title={`the boot's climb DELTA across the pair: second climb ${fmtClimb(c.second?.climbMb ?? null)} − opener climb ${fmtClimb(c.opener.climbMb)} — positive means it warmed further after the opener, negative means it settled`}
                >
                  Δ {c.climbDeltaMb > 0 ? '+' : ''}
                  {c.climbDeltaMb} MB
                </span>
              )}
              {c.pairGapMin != null && (
                <span
                  className="vvu-label text-[7px] text-[#5f6e55] tabular-nums"
                  title={`the pair's own span: second.atMs − opener.atMs = ${c.pairGapMin} min (design: +210s opener, +1080s second — a real span never lands exactly on the design; the drift is the boot's own clock)`}
                >
                  {c.pairGapMin}M
                </span>
              )}
              <span
                className={`vvu-label text-[7px] font-bold px-1 py-px rounded-sm border ml-auto ${tag.cls} tabular-nums`}
                title={
                  c.outcome === 'complete'
                    ? 'COMPLETE — both fires landed on this boot; the pair reads opener → second as recorded'
                    : c.outcome === 'honest-loss'
                      ? "HONEST LOSS — the guardian moved on to a newer boot before this boot's second could fire"
                      : c.outcome === 'operator-pair'
                        ? "OPERATOR PAIR — the auto-opener refused; the operator completed the boot's readings by hand"
                        : 'PENDING — the second has not fired and no later boot exists; the cycle is still open'
                }
              >
                {tag.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* the chips */}
      <div className="flex flex-wrap items-center gap-1">
        <span
          className="vvu-label text-[7px] font-bold px-1 py-px rounded-sm border border-[#3a4530] text-[#7a8a6e] bg-black/30 tabular-nums cursor-help transition-[filter,border-color] hover:brightness-125"
          title={`${s.cycles.length} auto-guardian cycles joined from ${s.autoRows} ledger rows (via auto-guardian) — ${s.completePairs} complete, ${s.operatorPairs} operator-completed, ${s.honestLosses} honest losses, ${s.pending} pending`}
        >
          {s.cycles.length} CYCLES · {s.autoRows} FIRES
        </span>
        {s.openingDriftRead != null && s.openingDriftMbPerCycle != null && (
          <span
            className={`vvu-label text-[7px] font-bold px-1 py-px rounded-sm border ${driftTone} tabular-nums`}
            title={`OLS of opener climb vs cycle sequence: ${s.openingDriftMbPerCycle > 0 ? '+' : ''}${s.openingDriftMbPerCycle} MB/cycle (R² ${s.openingDriftR2}) over ${s.openings.length} judged openers — ±50 MB/cycle is the first calibration; re-read as the record grows`}
          >
            OPENING DRIFT {s.openingDriftMbPerCycle > 0 ? '+' : ''}
            {s.openingDriftMbPerCycle} MB/CYCLE · {s.openingDriftRead.toUpperCase()}
          </span>
        )}
        {s.pending > 0 && (
          <span
            className="vvu-label text-[7px] font-bold px-1 py-px rounded-sm border border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10 tabular-nums vvu-pulse"
            title="a cycle whose second has not fired — the guardian's +1080s timer still owes its fire; the sheet promises no ETA"
          >
            {s.pending} SECOND{s.pending === 1 ? '' : 'S'} PENDING
          </span>
        )}
      </div>

      {/* THE READ — the engine's own sentence */}
      <p className="text-[9px] leading-relaxed text-[#c9d4bd] rounded-sm border border-[#3a4530]/60 bg-black/20 px-2 py-1">
        {s.note}
      </p>
    </div>
  );
}
