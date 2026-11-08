'use client';

// src/components/watchdog/BootLedger.tsx — R111 · THE BOOT LEDGER, every
// boot's tenure on port 3000.
//
// The record counted deaths meticulously — ceilings, floors, drifts,
// windows — but never once asked the simplest mortality question: HOW
// LONG DID EACH BOOT LIVE? The guardian's bounce journal carries the
// full spawn/death chain (oldPid → newPid, one row per bounce attempt);
// the shared boot-ledger engine walks it into tenures.
//
//   the strip  — one bar per tracked boot, in spawn order, height ∝
//                tenure (the settled max is the scale). Fill speaks the
//                end state: ink by death cause (port slate / rss rose /
//                avail-critical amber), hollow rose for the STILLBORN
//                (spawned ok:false, never confirmed serving), hollow
//                gray for UNJOURNALED ends (the journal never saw them
//                die; tenure unknown, never invented), and sage for the
//                boot LIVING NOW (censored — a life without an end has
//                no settled tenure).
//   the line   — the settled median, dashed sage across the strip.
//   the lens   — tenure at death by cause: do young boots die of a
//                different cause than old ones? Descriptive medians;
//                the engine never calls a killer.
//
// THE READ is the engine's own note, verbatim.

import { useCallback, useEffect, useState } from 'react';

import type { BootLedgerRead, BootTenure } from '@/lib/boot-ledger';
import { INFANT_TENURE_MIN } from '@/lib/survival';
import { useLaneHome } from '@/hooks/use-lane-home';
import { laneRereadHomeVoice, laneRereadVoice } from '@/lib/watchboard-ledger';

const SAGE = '#c8ff00';
const CYAN = '#00d4e0';
const ROSE = '#e5484d';
const AMBER = '#e0a030';
const INK = '#5f6e55';

function fmt(v: number | null): string {
  return v == null ? '—' : `${Math.round(v * 10) / 10}`;
}

function Chip({
  label,
  tone = 'neutral',
  title,
}: {
  label: string;
  tone?: 'neutral' | 'sage' | 'cyan' | 'rose' | 'amber';
  title?: string;
}) {
  const toneCls =
    tone === 'sage'
      ? 'border-[#6b8a40]/60 text-[#c8ff00] bg-[#6b8a40]/10'
      : tone === 'cyan'
        ? 'border-[#00d4e0]/60 text-[#00d4e0] bg-[#00d4e0]/10'
        : tone === 'rose'
          ? 'border-[#e5484d]/60 text-[#e5484d] bg-[#e5484d]/10'
          : tone === 'amber'
            ? 'border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10'
            : 'border-[#3a4530] text-[#c9d4bd] bg-black/30';
  return (
    <span className={`vvu-label text-[7px] font-bold px-1 py-px rounded-sm border ${toneCls} tabular-nums`} title={title}>
      {label}
    </span>
  );
}

function causeColor(reason: string | null): string {
  switch (reason) {
    case 'rss':
      return ROSE;
    case 'avail-critical':
      return AMBER;
    case 'port':
      return INK;
    default:
      return CYAN;
  }
}

function barTitle(b: BootTenure, maxTenure: number): string {
  const tenure =
    b.tenureMin == null
      ? 'tenure UNKNOWN (end unjournaled — the journal never saw this boot die; not assumed alive)'
      : `${(Math.round(b.tenureMin * 10) / 10).toFixed(1)} min tenure (${Math.round((b.tenureMin / (maxTenure || 1)) * 100)}% of the settled max)`;
  const infant =
    b.endState === 'deceased' && b.served && b.tenureMin != null && b.tenureMin < INFANT_TENURE_MIN
      ? ` · INFANT — died before the ${INFANT_TENURE_MIN}-min line (the survival curve's watch)`
      : '';
  const spawn = `spawned ${b.spawnAt} (pid ${b.pid}${b.stillborn ? ', ok:false — STILLBORN, never confirmed serving' : ', confirmed serving'})`;
  const death =
    b.endState === 'deceased'
      ? `died ${b.deathAt} · cause ${b.deathReason}${b.deathOk === false ? ' · the save itself failed (ok:false) but the kill landed' : ''}`
      : b.endState === 'living'
        ? 'STILL LIVING — tenure censored, excluded from the settled population'
        : 'end UNJOURNALED — excluded from every tenure statistic';
  return `${spawn} · ${death} · ${tenure}${infant}`;
}

const BAR_TONE: Record<string, string> = {
  sage: 'bg-[#c8ff00]/80 border-[#c8ff00]',
  roseHollow: 'bg-transparent border-[#e5484d]/80 border-dashed',
  grayHollow: 'bg-transparent border-[#5f6e55]/70 border-dashed',
  ink: 'bg-[#5f6e55]/70 border-transparent',
};

function barClass(b: BootTenure): string {
  if (b.endState === 'living') return BAR_TONE.sage;
  if (b.endState === 'unjournaled') return BAR_TONE.grayHollow;
  if (b.stillborn) return BAR_TONE.roseHollow;
  return BAR_TONE.ink;
}

export function BootLedger() {
  const [read, setRead] = useState<BootLedgerRead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // R183 · THE LANES' RETURN: the asked read's home-flash state — the
  // R181 idiom, lane-sized (one hook, five lanes). The mount and the
  // 60s self-read never announce; a failed read never reaches the
  // announcement — the completion belongs to the click.
  const { justRead, homeAt, announceHome } = useLaneHome();

  const refetch = useCallback(
    async (announce?: boolean) => {
      setBusy(true);
      try {
        const res = await fetch('/api/estate/boot-ledger', { cache: 'no-store' });
        const body = await res.json();
        if (res.ok && body?.ok) {
          setRead(body.ledger as BootLedgerRead);
          setError(null);
          if (announce) announceHome();
        } else {
          setError(String(body?.error ?? `HTTP ${res.status}`));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'boot ledger fetch failed');
      } finally {
        setBusy(false);
      }
    },
    [announceHome],
  );

  useEffect(() => {
    void refetch();
    const t = setInterval(() => void refetch(), 60_000);
    return () => clearInterval(t);
  }, [refetch]);

  if (!read && !error) return null;

  const settledMax = read
    ? Math.max(...read.boots.map((b) => (b.endState === 'deceased' && b.served ? (b.tenureMin ?? 0) : 0)), 1)
    : 1;
  const lens: Array<{ reason: string; n: number; medianMin: number | null; minMin: number | null; maxMin: number | null }> =
    read ? read.tenureByDeath : [];

  return (
    <div className="mt-1.5 rounded-sm border border-[#3a4530]/60 bg-black/20 p-2 transition-colors duration-200 hover:border-[#4a5a3e]" data-testid="boot-ledger">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p
          className="vvu-label text-[7.5px] font-bold tracking-[0.18em] text-[#7a8a6e]"
          title={`every boot's TENURE on port 3000, walked from the guardian's own bounce journal (vvu-trust/guardian/bounces.jsonl — one row per bounce attempt, oldPid → newPid, the append-only chain that has survived every respawn). End states are named, never smoothed: deceased (a later row killed it), living (no death row AND the current dev pid — tenure censored), unjournaled (no death row and not the current pid — tenure unknown, never invented). A stillborn boot spawned ok:false — written down but never confirmed serving. Drill rows (port 3999) are a separate population and are excluded by name. The trend is an OLS of settled tenure vs spawn index — are boots living shorter as the record ages?`}
        >
          THE BOOT LEDGER · HOW LONG BOOTS HOLD THE PORT
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {read && (
            <>
              <Chip
                label={`${read.boots.length} BOOTS`}
                title={`${read.boots.length} boots spawned inside the record (+ root pid ${read.root?.pid ?? '—'}, born before the record, no witnessed spawn, excluded from every tenure statistic) · ${read.rowsKept} journal rows kept · ${read.drillsExcluded} drill rows excluded · ${read.unparsedRows} unparsed`}
              />
              <Chip
                tone="cyan"
                label={`${read.settledCount} SETTLED`}
                title="settled = deceased AND confirmed serving (spawn ok:true) — the only boots whose tenure is fully witnessed on both ends"
              />
              <Chip
                tone="sage"
                label={`MEDIAN ${fmt(read.medianTenureMin)} MIN`}
                title={`median settled tenure ${fmt(read.medianTenureMin)} min · halves ${fmt(read.firstHalfMedianMin)} → ${fmt(read.lastHalfMedianMin)} min (pair-sheet convention, floor(n/2))`}
              />
              {read.longest && (
                <Chip
                  tone="amber"
                  label={`LONGEST ${fmt(read.longest.tenureMin)} #${read.longest.pid}`}
                  title={`the longest settled tenure: pid ${read.longest.pid}, ${read.longest.from} → ${read.longest.to} = ${fmt(read.longest.tenureMin)} min — the same era the resilience card calls the longest calm`}
                />
              )}
              {read.stillbornPids.length > 0 && (
                <Chip
                  tone="rose"
                  label={`${read.stillbornPids.length} STILLBORN`}
                  title={`spawned ok:false — written down but never confirmed serving a 200: pid ${read.stillbornPids.join(', pid ')}. Their witnessed tenures count, their serving is never assumed`}
                />
              )}
              {read.livingTenureMin != null && (
                <Chip
                  tone="sage"
                  label={`LIVING ${fmt(read.livingTenureMin)} MIN`}
                  title={`the boot serving this page (the current dev pid) has lived ${fmt(read.livingTenureMin)} min — ${read.livingVsMedian != null ? `${(Math.round(read.livingVsMedian * 100) / 100).toFixed(2)}× the settled median` : '—'} — censored, excluded from the settled statistics`}
                />
              )}
              <Chip
                tone={read.trend === 'SHORTENING' ? 'rose' : read.trend === 'LENGTHENING' ? 'sage' : 'neutral'}
                label={`TENURE ${read.trend}${read.trend !== 'TOO FEW' && !read.trendTight ? ' · LOOSE' : ''}`}
                title={
                  read.slopeMinPerBoot != null && read.r2 != null
                    ? `OLS of settled tenure vs spawn index: ${fmt(read.slopeMinPerBoot)} min/boot, R² ${fmt(read.r2)} — the ±${1} min/boot band is strict, and R² ≥ 0.5 is the shared R2_CALL_THRESHOLD (one calibration, many readers). A loose trend is SHOWN and named loose, never averaged away`
                    : `below ${8} settled boots the trend refuses — TOO FEW`
                }
              />
            </>
          )}
          <button
            type="button"
            onClick={() => void refetch(true)}
            disabled={busy}
            aria-busy={busy}
            aria-label={laneRereadVoice('the boot journal', busy)}
            className={`vvu-label text-[7px] font-bold px-1.5 py-px rounded-sm border bg-black/30 transition-colors duration-150 disabled:opacity-50 outline-none ${justRead && !busy ? 'border-[#c8ff00]/60 text-[#c8ff00] shadow-[0_0_6px_rgba(200,255,0,0.3)]' : busy ? 'border-[#e0a030]/60 text-[#e0a030]' : 'border-[#3a4530] text-[#c9d4bd] hover:border-[#6b8a40]/60 hover:text-[#c8ff00] focus-visible:border-[#c8ff00]'}`}
            title="re-walk the journal now — the ledger also re-reads itself every 60s (the journal is append-only; a re-read is cheap and honest). R182 · THE LANES' VOICES: the button's state rides its aria — the offer and the in-flight read, heard without hovering; the read in flight wears the amber. R183 · THE LANES' RETURN: a clicked read that lands speaks its home line once — the lane's own arrival stamp in the house's UTC voice — and wears the lime for 2.6s; the unasked passes (mount, the 60s self-read) and a failed read stay silent — the completion belongs to the click."
          >
            {busy ? 'READING…' : 'REREAD'}
          </button>
          <span aria-live="polite" className="sr-only">
            {justRead && !busy && homeAt ? laneRereadHomeVoice('the boot journal', String(homeAt)) : ''}
          </span>
        </div>
      </div>

      {error && (
        <p className="vvu-label mt-1.5 text-[7px] text-[#e5484d]" data-testid="boot-ledger-error">
          THE JOURNAL IS UNREADABLE · {error} — the boot ledger refuses to invent a record
        </p>
      )}

      {read && (
        <>
          {/* THE STRIP — one bar per tracked boot, spawn order, height ∝ tenure */}
          <div className="mt-2 overflow-x-auto" data-testid="boot-ledger-strip">
            <div className="relative flex min-w-[520px] items-end gap-px h-16 border-b border-[#3a4530]/60 pb-px">
              {/* the settled median line */}
              {read.medianTenureMin != null && (
                <div
                  className="absolute left-0 right-0 border-t border-dashed border-[#c8ff00]/40 pointer-events-none z-10"
                  style={{ bottom: `${Math.min(98, (read.medianTenureMin / settledMax) * 100)}%` }}
                  title={`the settled median tenure ${fmt(read.medianTenureMin)} min — dashed sage across the strip`}
                />
              )}
              {read.boots.map((b) => {
                const h =
                  b.tenureMin == null
                    ? 6 // unjournaled: presence without a length — a stub, never a fabricated height
                    : Math.max(3, (b.tenureMin / settledMax) * 100);
                const cls = barClass(b);
                const tip = barTitle(b, settledMax);
                const isInfant =
                  b.endState === 'deceased' && b.served && b.tenureMin != null && b.tenureMin < INFANT_TENURE_MIN;
                return (
                  <div
                    key={b.pid}
                    tabIndex={0}
                    title={tip}
                    aria-label={tip}
                    className={`relative flex-1 min-w-[3px] rounded-t-[1px] outline-none transition-all duration-150 hover:opacity-100 focus-visible:opacity-100 opacity-75 focus-visible:ring-1 focus-visible:ring-[#c8ff00]/60 ${cls} ${b.endState === 'living' ? 'animate-pulse' : ''}`}
                    style={{ height: `${h}%` }}
                  >
                    {isInfant && (
                      <span
                        className="absolute -bottom-0.5 left-0 right-0 h-[2px] bg-[#e5484d] rounded-full"
                        aria-hidden
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1" aria-hidden>
              <span className="vvu-label text-[6.5px] text-[#5f6e55]">
                <span className="inline-block w-1.5 h-1.5 rounded-sm bg-[#5f6e55]/70 mr-1 align-middle" />
                port
              </span>
              <span className="vvu-label text-[6.5px] text-[#e5484d]">
                <span className="inline-block w-1.5 h-1.5 rounded-sm bg-[#e5484d]/70 mr-1 align-middle" />
                rss
              </span>
              <span className="vvu-label text-[6.5px] text-[#e0a030]">
                <span className="inline-block w-1.5 h-1.5 rounded-sm bg-[#e0a030]/70 mr-1 align-middle" />
                avail-critical
              </span>
              <span className="vvu-label text-[6.5px] text-[#e5484d]">
                <span className="inline-block w-1.5 h-1.5 rounded-sm border border-dashed border-[#e5484d]/80 mr-1 align-middle" />
                stillborn
              </span>
              <span className="vvu-label text-[6.5px] text-[#5f6e55]">
                <span className="inline-block w-1.5 h-1.5 rounded-sm border border-dashed border-[#5f6e55]/70 mr-1 align-middle" />
                unjournaled
              </span>
              <span className="vvu-label text-[6.5px] text-[#c8ff00]">
                <span className="inline-block w-1.5 h-1.5 rounded-sm bg-[#c8ff00]/80 mr-1 align-middle" />
                living now
              </span>
              <span className="vvu-label text-[6.5px] text-[#e5484d]">
                <span className="inline-block w-1.5 h-[2px] bg-[#e5484d] mr-1 align-middle rounded-full" />
                infant (&lt;{INFANT_TENURE_MIN} min — the survival curve's line)
              </span>
              <span className="vvu-label text-[6.5px] text-[#5f6e55] ml-auto">
                left → right = spawn order · height = tenure (settled max {fmt(settledMax)} min = full height)
              </span>
            </div>
          </div>

          {/* THE KILLER LENS — tenure at death by cause */}
          {read.root && (
            <p
              className="vvu-label mt-1.5 text-[6.5px] text-[#5f6e55]"
              data-testid="boot-ledger-root"
              title="the record's first kept row killed a boot whose own spawn predates the journal — a boot without a witnessed spawn has no honest tenure, so it is named here and excluded from every statistic rather than counted with an invented start"
            >
              <span className="text-[#e0a030]">▲</span> ROOT · PID {read.root.pid} · {read.root.note.toUpperCase()}
            </p>
          )}
          <div className="mt-1.5 overflow-x-auto" data-testid="boot-ledger-table">
            <table className="w-full min-w-[420px] border-collapse">
              <thead>
                <tr className="vvu-label text-[6.5px] font-bold tracking-[0.14em] text-[#5f6e55]">
                  <th className="text-left py-0.5 pr-2 font-bold">DEATH CAUSE</th>
                  <th className="text-right py-0.5 px-2 font-bold">N</th>
                  <th className="text-right py-0.5 px-2 font-bold">MEDIAN TENURE</th>
                  <th className="text-right py-0.5 pl-2 font-bold">RANGE</th>
                </tr>
              </thead>
              <tbody>
                {lens.map((k) => {
                  const tip = `${k.reason}: ${k.n} settled boot(s) died of this · median tenure ${fmt(k.medianMin)} min · range ${fmt(k.minMin)}–${fmt(k.maxMin)} min. Descriptive only — the ledger counts and names, it never calls a killer.`;
                  return (
                    <tr
                      key={k.reason}
                      tabIndex={0}
                      title={tip}
                      aria-label={tip}
                      className="vvu-label text-[7.5px] text-[#c9d4bd] tabular-nums outline-none transition-colors duration-150 hover:bg-[#6b8a40]/5 focus-visible:bg-[#6b8a40]/10"
                    >
                      <td className="py-0.5 pr-2">
                        <span className="inline-block w-1.5 h-1.5 rounded-sm mr-1.5 align-middle" style={{ background: causeColor(k.reason) }} />
                        <span className="font-mono">{k.reason}</span>
                      </td>
                      <td className="text-right py-0.5 px-2">{k.n}</td>
                      <td className="text-right py-0.5 px-2" style={{ color: causeColor(k.reason) }}>
                        {fmt(k.medianMin)} min
                      </td>
                      <td className="text-right py-0.5 pl-2 text-[#7a8a6e]">
                        {fmt(k.minMin)}–{fmt(k.maxMin)} min
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="vvu-label mt-1.5 text-[7px] leading-relaxed text-[#7a8a6e]" data-testid="boot-ledger-read">
            <span className="font-bold" style={{ color: CYAN }}>THE READ · </span>
            {read.note}
          </p>
        </>
      )}
    </div>
  );
}
