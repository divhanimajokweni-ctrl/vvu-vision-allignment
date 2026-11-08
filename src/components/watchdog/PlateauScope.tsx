'use client';

// src/components/watchdog/PlateauScope.tsx — R72 · the plateau as SHAPE.
//
// R69 put a LEVEL on the warm plateau (baseline/headroom), R70 put a
// DIRECTION on it (trend) — and both recorded the same structural finding:
// every uptime climbs and ends in a guardian save. Numbers say "climbing";
// only shape shows HOW — the climb rate, the approach to the guard line,
// where each boot begins and resets. This component draws the guardian's
// OWN pass log (the same VmRSS lines the OOM killer weighs) as a time
// series, with boot boundaries taken from the journal (never guessed from
// dips in the line).
//
//   · lime line + gradient area — next-server RSS per healthy pass
//   · dashed rose line  — the OOM guard (the bounce line itself)
//   · dashed lime line  — the R69 warm baseline (median of 10 newest)
//   · solid rose ticks  — real guardian saves inside the window (journal
//                         rows, drill rows excluded — drills never touched
//                         the real surface)
//   · hover crosshair   — stamp · RSS · box avail · the guardian's own
//                         decision word for that pass
//
// HONESTY: absent log → NO SCOPE (with the reason); a DOWN pass has no
// RSS and is counted, never invented into the series; <2 passes → the
// scope refuses to draw a line from one point. READ-ONLY: polling this
// component writes nothing anywhere.

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface ScopeSample {
  at: string;
  atMs: number;
  rssMb: number;
  hwmMb: number | null;
  availMb: number | null;
  port: 'UP' | 'DOWN';
  decision: string;
}

interface ScopeMarker {
  at: string;
  atMs: number;
  reason: string;
  ok: boolean;
  downtimeMs: number | null;
  oldPid: number | null;
  newPid: number | null;
}

export interface PlateauHistoryResponse {
  present: boolean;
  reason?: string;
  generatedAtUtc?: string;
  guardMb: number | null;
  intervalSec: number | null;
  requestedPoints?: number;
  // R73 — which log generations fed this series (copytruncate rotation
  // archives the older pass history into guardian.log.1; the scope reads
  // BOTH, and says so — provenance is part of the reading).
  logGenerations?: Array<{ path: string; present: boolean; lines: number }>;
  window?: {
    passes: number;
    downPasses: number;
    lastDownAt: string | null;
    otherLines: number;
    since: string | null;
    until: string | null;
    spanSec: number | null;
  };
  samples?: ScopeSample[];
  markers?: ScopeMarker[];
  stats?: {
    firstMb: number | null;
    lastMb: number | null;
    minMb: number | null;
    maxMb: number | null;
    climbMb: number | null;
    bootStart: string | null;
    bootComplete: boolean;
    bootPids?: [number | null, number | null] | null;
    baselineMb: number | null;
  };
}

// Fixed coordinate space; preserveAspectRatio="none" + non-scaling strokes
// keep the geometry responsive without distorting line widths.
const W = 1000;
const H = 180;

function hhmmss(at: string | null | undefined): string {
  return at && at.length >= 19 ? at.slice(11, 19) : '—';
}

// R78 — exported for the LEAK VERDICT block: the verdict reads the SAME
// boot-scoped climb the scope draws, from the SAME cached query (react-query
// dedupes to one fetch — the verdict adds no second read of the log).
export function usePlateauHistoryQuery() {
  return useQuery<PlateauHistoryResponse, Error>({
    queryKey: ['guardian-plateau-history'],
    queryFn: async () => {
      const res = await fetch('/api/guardian/plateau-history?points=360', { cache: 'no-store' });
      if (!res.ok) throw new Error(`PLATEAU HISTORY HTTP ${res.status}`);
      return (await res.json()) as PlateauHistoryResponse;
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
}

export function PlateauScope() {
  const hist = usePlateauHistoryQuery();
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const data = hist.data;

  const geom = useMemo(() => {
    const samples = data?.samples ?? [];
    const n = samples.length;
    if (n < 2) return null;
    const guardMb = data?.guardMb ?? null;
    const baselineMb = data?.stats?.baselineMb ?? null;
    const rssVals = samples.map((s) => s.rssMb);
    const dataMax = Math.max(...rssVals);
    const dataMin = Math.min(...rssVals);
    const yMax = Math.max(dataMax, guardMb ?? 0) * 1.03 + 24;
    const yMin = Math.max(0, Math.min(dataMin, baselineMb ?? dataMin) - 120);
    const xOf = (i: number) => (i / (n - 1)) * W;
    const yOf = (mb: number) => H - ((mb - yMin) / (yMax - yMin)) * H;
    const linePath = samples
      .map((s, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(2)},${yOf(s.rssMb).toFixed(2)}`)
      .join(' ');
    const areaPath = `${linePath} L${W},${H} L0,${H} Z`;
    // Markers map into index space by TIME — the bounce gap is 1–2 missed
    // samples, so the tick lands between its neighbours, honestly placed.
    const ticks = (data?.markers ?? [])
      .map((m) => {
        const idx = samples.findIndex((s) => s.atMs >= m.atMs);
        return idx >= 0 ? { m, x: xOf(idx) } : null;
      })
      .filter((t): t is { m: ScopeMarker; x: number } => t !== null);
    return { samples, n, guardMb, baselineMb, xOf, yOf, linePath, areaPath, ticks, yMin, yMax, dataMax };
  }, [data]);

  const hover = hoverIdx != null && geom ? geom.samples[hoverIdx] ?? null : null;
  const hoverPct = hoverIdx != null && geom ? (geom.xOf(hoverIdx) / W) * 100 : null;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!geom || geom.n < 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / Math.max(1, rect.width)));
    setHoverIdx(Math.round(ratio * (geom.n - 1)));
  }

  const stats = data?.stats;
  const win = data?.window;

  return (
    <div className="rounded-sm border border-[#6b8a40]/25 bg-black/20 px-2.5 py-2 transition-colors duration-200 hover:border-[#4a5a3e]" data-testid="plateau-scope">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <p className="vvu-label text-[8px] font-bold tracking-[0.22em] text-[#7a8a6e] inline-flex items-center gap-1.5">
          <Activity className="size-3 text-[#c8ff00]/70" aria-hidden />
          PLATEAU SCOPE · RSS THROUGH TIME — THE CYCLE, NOT JUST THE NUMBER
        </p>
        <div className="ml-auto flex items-center gap-1.5">
          {data?.logGenerations?.some((g) => g.path === 'rotated' && g.present) && (
            <span
              className="vvu-label text-[8px] px-1.5 py-0.5 rounded-sm border border-[#3a4530] text-[#8a9a7e]"
              title="this window spans a log rotation: the older passes come from the archived generation (guardian.log.1), the newer from the live log — the join is at the rotation point, no history was lost"
            >
              ROTATED GEN
            </span>
          )}
          {data?.present && win && (
            <span className="vvu-label text-[8px] text-[#7a8a6e] tabular-nums" title="the window the scope draws — ~20s per pass, the guardian's own cadence">
              {win.passes} PASSES · ~{Math.round((win.spanSec ?? 0) / 60)} MIN
            </span>
          )}
          <button
            type="button"
            onClick={() => void hist.refetch()}
            disabled={hist.isFetching}
            className="vvu-label inline-flex items-center gap-1 rounded-sm border border-[#3a4530] bg-black/30 px-1.5 py-0.5 text-[8px] font-bold text-[#7a8a6e] hover:border-[#6b8a40]/60 hover:text-[#c8ff00] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00] disabled:opacity-40 cursor-pointer"
            title="re-read the guardian pass log"
          >
            <RefreshCw className={`size-2.5 ${hist.isFetching ? 'animate-spin' : ''}`} aria-hidden />
            RESCAN
          </button>
        </div>
      </div>

      {/* pending — first read of the log */}
      {hist.isPending && (
        <div className="mt-2 space-y-1.5">
          <Skeleton className="h-[160px] w-full rounded-sm" />
          <p className="vvu-label text-[8px] text-[#7a8a6e]">READING THE PASS LOG…</p>
        </div>
      )}

      {/* error — honest red */}
      {hist.isError && (
        <div className="mt-2 rounded-sm border border-[#e5484d]/50 bg-[#e5484d]/5 px-2 py-1.5">
          <p className="vvu-label text-[9px] font-bold text-[#e5484d]">PASS LOG UNREADABLE — NO SCOPE DRAWN</p>
          <p className="font-mono text-[9px] text-[#e5484d] mt-0.5 break-all">{hist.error.message}</p>
        </div>
      )}

      {/* honest refusals — no log, no series, no invention */}
      {data && !data.present && (
        <p className="mt-2 vvu-label text-[9px] text-[#7a8a6e] border border-dashed border-[#3a4530] rounded-sm px-3 py-3 text-center">
          NO SCOPE — {data.reason ?? 'the pass log is absent'}. THE SCOPE READS THE GUARDIAN&apos;S OWN PASS LOG; A
          MISSING LOG IS A STATE, NOT SOMETHING TO FAKE.
        </p>
      )}

      {data?.present && geom === null && (
        <p className="mt-2 vvu-label text-[9px] text-[#7a8a6e] border border-dashed border-[#3a4530] rounded-sm px-3 py-3 text-center">
          {(win?.passes ?? 0) < 2
            ? `${win?.passes ?? 0} HEALTHY PASS${(win?.passes ?? 0) === 1 ? '' : 'ES'} ON RECORD — THE SCOPE WILL NOT DRAW A LINE FROM ONE POINT. IT FILLS AS THE GUARDIAN PASSES.`
            : 'WINDOW UNREADABLE — THE SERIES NEEDS TWO TIME-STAMPED PASSES.'}
        </p>
      )}

      {/* the scope */}
      {data?.present && geom && (
        <>
          <div className="mt-2 relative">
            {/* guard / baseline chips ride at their true heights */}
            {geom.guardMb != null && (
              <span
                className="absolute right-0 z-10 vvu-label text-[8px] font-bold px-1 py-px rounded-sm border border-[#e5484d]/60 text-[#e5484d] bg-black/70 pointer-events-none"
                style={{ top: `calc(${(geom.yOf(geom.guardMb) / H) * 100}% - 7px)` }}
              >
                GUARD {geom.guardMb}
              </span>
            )}
            {geom.baselineMb != null && (
              <span
                className="absolute left-0 z-10 vvu-label text-[8px] px-1 py-px rounded-sm border border-[#6b8a40]/50 text-[#c8ff00] bg-black/70 pointer-events-none"
                style={{ top: `calc(${(geom.yOf(geom.baselineMb) / H) * 100}% - 7px)` }}
              >
                BASELINE ~{geom.baselineMb}
              </span>
            )}
            <div className="vvu-scope-in">
              <svg
                viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="none"
                className="w-full h-[160px] block cursor-crosshair [&_rect]:cursor-help [&_line]:cursor-help"
                role="img"
                aria-label={`Plateau scope: next-server RSS across ${geom.n} guardian passes, guard line at ${geom.guardMb ?? 'unknown'} MB${stats?.climbMb != null ? `, current boot climb ${stats.climbMb > 0 ? '+' : ''}${stats.climbMb} MB` : ''}.`}
                onMouseMove={onMove}
                onMouseLeave={() => setHoverIdx(null)}
              >
                <defs>
                  <linearGradient id="vvu-scope-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c8ff00" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#c8ff00" stopOpacity="0.01" />
                  </linearGradient>
                </defs>

                {/* guard line — the bounce line itself */}
                {geom.guardMb != null && (
                  <line
                    x1={0} x2={W} y1={geom.yOf(geom.guardMb)} y2={geom.yOf(geom.guardMb)}
                    stroke="#e5484d" strokeWidth={1} strokeDasharray="6 5" vectorEffect="non-scaling-stroke" opacity={0.75}
                  />
                )}
                {/* warm baseline — the R69 level */}
                {geom.baselineMb != null && (
                  <line
                    x1={0} x2={W} y1={geom.yOf(geom.baselineMb)} y2={geom.yOf(geom.baselineMb)}
                    stroke="#c8ff00" strokeWidth={1} strokeDasharray="2 6" vectorEffect="non-scaling-stroke" opacity={0.4}
                  />
                )}

                {/* the series */}
                <path d={geom.areaPath} fill="url(#vvu-scope-fill)" stroke="none" />
                <path
                  d={geom.linePath}
                  fill="none" stroke="#c8ff00" strokeWidth={1.5}
                  strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"
                />

                {/* boot boundaries — real saves from the journal */}
                {geom.ticks.map(({ m, x }) => (
                  <line
                    key={m.at}
                    x1={x} x2={x} y1={0} y2={H}
                    stroke="#e5484d" strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={0.55}
                  >
                    <title>
                      {`BOOT BOUNDARY · SAVE ${m.at} · reason ${m.reason}${m.ok ? '' : ' · FAILED'}${m.downtimeMs != null ? ` · downtime ${(m.downtimeMs / 1000).toFixed(1)}s` : ''}${m.oldPid != null && m.newPid != null ? ` · ${m.oldPid} → ${m.newPid}` : ''}`}
                    </title>
                  </line>
                ))}

                {/* hover crosshair */}
                {hoverIdx != null && hover && (
                  <g>
                    <line
                      x1={geom.xOf(hoverIdx)} x2={geom.xOf(hoverIdx)} y1={0} y2={H}
                      stroke="#f3e38a" strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={0.6}
                    />
                    <circle
                      cx={geom.xOf(hoverIdx)} cy={geom.yOf(hover.rssMb)} r={3.5}
                      fill="#c8ff00" stroke="#0b0f0a" strokeWidth={1} vectorEffect="non-scaling-stroke"
                    />
                  </g>
                )}
              </svg>
            </div>

            {/* hover readout — HTML so the text never distorts */}
            {hover && hoverPct != null && (
              <div
                className="absolute top-1 z-20 pointer-events-none rounded-sm border border-[#f3e38a]/40 bg-black/85 px-2 py-1 shadow-[0_0_10px_rgba(0,0,0,0.6)]"
                style={{ left: `clamp(0px, ${hoverPct}% - 60px, calc(100% - 210px))` }}
              >
                <p className="font-mono text-[9px] text-[#f3e38a] leading-tight">{hover.at}</p>
                <p className="font-mono text-[9px] text-[#c9d4bd] leading-tight">
                  RSS <span className="text-[#c8ff00]">{hover.rssMb} MB</span>
                  {hover.hwmMb != null ? ` · hwm ${hover.hwmMb}` : ''}
                  {hover.availMb != null ? ` · box ${hover.availMb}MB` : ''}
                </p>
                <p className="font-mono text-[8px] text-[#7a8a6e] leading-tight truncate max-w-[210px]">
                  {hover.port === 'UP' ? 'pass' : 'PORT DOWN'} · {hover.decision || '—'}
                </p>
              </div>
            )}
          </div>

          {/* x-axis stamps + the read row */}
          <div className="flex items-center justify-between mt-1">
            <span className="vvu-label text-[8px] text-[#5f6e55] tabular-nums">{hhmmss(win?.since)} UTC</span>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              <span className="vvu-label text-[8px] text-[#7a8a6e]">
                MIN <span className="font-mono text-[#c9d4bd]">{stats?.minMb ?? '—'}</span> · MAX{' '}
                <span className={`font-mono ${(stats?.maxMb ?? 0) > (geom.guardMb ?? Infinity) ? 'text-[#e5484d]' : 'text-[#c9d4bd]'}`}>
                  {stats?.maxMb ?? '—'}
                </span>
                {(stats?.maxMb ?? 0) > (geom.guardMb ?? Infinity) && (
                  <span
                    className="text-[#e5484d]"
                    title="a single pass crossed the guard and the next pass came back under — the bounce rail needs TWO consecutive over-guard passes; one spike is shown, not hidden"
                  >
                    {' '}· 1-PASS SPIKE
                  </span>
                )}
              </span>
              {stats?.climbMb != null && (
                <span
                  className={`vvu-label text-[8px] font-bold tabular-nums ${stats.climbMb > 16 ? 'text-[#e0a030]' : 'text-[#7a8a6e]'}`}
                  title={
                    stats.bootComplete
                      ? `RSS change across the current boot — cut at the journal's own newPid (the first sample after a save can still be the dying boot's last over-guard pass)${stats.bootPids?.[0] != null ? ` · pid ${stats.bootPids[0]}${stats.bootPids[1] != null && stats.bootPids[1] !== stats.bootPids[0] ? ` → ${stats.bootPids[1]}` : ''}` : ''} since the save at ${stats.bootStart}. The plateau cycle R70 measured, now visible: boot → climb → guard → save → repeat`
                      : `RSS change across the whole window — NO boot boundary inside it, so this spans the tail of a boot (or several); the window is ${Math.round((win?.spanSec ?? 0) / 60)} min`
                  }
                >
                  {stats.bootComplete ? 'CLIMB THIS BOOT' : 'WINDOW CLIMB'}{' '}
                  {stats.climbMb > 0 ? '+' : ''}
                  {stats.climbMb} MB
                </span>
              )}
              {(win?.downPasses ?? 0) > 0 && (
                <span
                  className="vvu-label text-[8px] font-bold text-[#e0a030]"
                  title={`${win?.downPasses} pass${(win?.downPasses ?? 0) === 1 ? '' : 'es'} recorded the port DOWN — they carry no RSS and are counted here, never invented into the line; the gap they leave is the bounce the journal explains`}
                >
                  {win?.downPasses} DOWN PASS{(win?.downPasses ?? 0) === 1 ? '' : 'ES'} (COUNTED)
                </span>
              )}
            </div>
            <span className="vvu-label text-[8px] text-[#5f6e55] tabular-nums">{hhmmss(win?.until)} UTC</span>
          </div>

          <p className="vvu-label mt-1.5 text-[8px] text-[#7a8a6e] leading-relaxed">
            THE LINE IS THE GUARDIAN&apos;S OWN PASS LOG — THE SAME VmRSS THE OOM KILLER WEIGHS, ONE POINT PER 20S PASS.
            ROSE TICKS ARE REAL SAVES FROM THE JOURNAL (BOOT BOUNDARIES — NEVER GUESSED FROM DIPS). AMBER CLIMB AT A
            RISING PLATEAU IS THE GAUGE TELLING THE TRUTH: THIS IS THE CYCLE R70 MEASURED, VISIBLE ~40 MINUTES BEFORE
            IT LANDS. THE LOG ROTATES AT A SIZE CAP (R73) — THE OLDER GENERATION IS ARCHIVED AND READ ALONGSIDE, SO
            THE SHAPE SURVIVES THE ROTATION.
          </p>
        </>
      )}
    </div>
  );
}
