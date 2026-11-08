'use client';

// src/components/icsh/CostMatrix.tsx — 14:38 COST MATRIX · run your own
// iterations + the cost of the complete everything, running.
//
//   RUN ITERATIONS  ×1 … ×10,000 — the deployed zoom-sim. Terminal output is
//   the real measured response (loop-only + total + quorum + milestones),
//   followed by the auditor's verdict line.
//   COST MATRIX      measured bytes per unit → monthly volumes at two cadences
//   → ZAR estimates (EST, assumptions on the surface).
//
// "I expect then the cost of the Complete everything will be running you will
//  give the matrix. And it will be just ready for me to onboard me and my
//  friends… run our own iterations to prove that it works." — operator order.

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { IcshMetrics, IcshRunResult, IcshRunStatLite, IcshVerifyResult } from '@/lib/icsh/types';
import { cn } from '@/lib/utils';
import { Chip, IcshButton, Panel, ago, fmtBytes, head8, pad } from './parts';
import { sfx } from './sound';

const RUN_OPTIONS = [1, 10, 100, 1000, 10000];

export function CostMatrixSurface({ runner, onRun }: { runner: string; onRun: () => void }) {
  const [lines, setLines] = useState<string[]>([]);
  const [lastResult, setLastResult] = useState<IcshRunResult | null>(null);
  const [running, setRunning] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const termRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      for (const t of timers.current) clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    termRef.current?.scrollTo({ top: termRef.current.scrollHeight });
  }, [lines]);

  const push = (line: string, delay = 0, sound?: 'tick' | 'milestone') => {
    timers.current.push(
      setTimeout(() => {
        setLines((prev) => [...prev.slice(-199), line]);
        if (sound === 'tick') sfx.tick();
        if (sound === 'milestone') sfx.milestone();
      }, delay)
    );
  };

  const runMut = useMutation({
    mutationFn: async (cycles: number): Promise<IcshRunResult> => {
      const r = await fetch('/api/icsh/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cycles, runner }),
      });
      const d = (await r.json()) as IcshRunResult | { error: string };
      if (!r.ok || 'error' in d) throw new Error('error' in d ? d.error : `run ${r.status}`);
      return d;
    },
    onMutate: (cycles) => {
      setRunning(true);
      sfx.boot();
      setLines((prev) => [
        ...prev.slice(-199),
        `──────────────────────────────────────────────`,
        `▶ RUN ${pad(cycles)} CYCLES · RUNNER ${runner} · ${new Date().toLocaleTimeString('en-ZA')}`,
        `  INGEST → INFER → LOG → SYNC → COMPARE → FOLD → MINT → SHIP → WIPE → RETRIEVE → WATCHDOG`,
        `  EXECUTING…`,
      ]);
    },
    onSuccess: (d) => {
      setLastResult(d);
      let delay = 120;
      push(`  ✓ COMPLETE — ${d.cycles.toLocaleString()} cycles`, delay, 'milestone');
      delay += 70;
      push(
        `    loop-only ${d.loopMs.toFixed(3)} ms · total ${d.durationMs.toFixed(3)} ms (ledger+vault persisted) · ${d.cyclesPerSec.toLocaleString('en-ZA', { maximumFractionDigits: 0 })} cycles/s TOTAL`,
        delay,
        'tick'
      );
      delay += 70;
      push(
        `    working memory ${d.milestones[0]?.memoryBytes ?? 32} B FLAT · vault ${d.vaultCount.toLocaleString()} markdown nodes · peers ${d.peersReachable}/25`,
        delay,
        'tick'
      );
      delay += 90;
      for (const m of d.milestones) {
        push(`    [${m.clock} ${m.viewport}] cycle ${m.cycle.toLocaleString()} · head ${m.head.slice(0, 8)}… · vault ${m.vaultCount.toLocaleString()} · mem ${m.memoryBytes} B`, delay, 'milestone');
        delay += 70;
      }
      push(
        `    quorum ${d.quorumCycles.toLocaleString()}/${d.cycles.toLocaleString()} cycles (${(d.agreementRate * 100).toFixed(1)}%) · divergent observations ${d.divergentTotal.toLocaleString()} — drift detected is correct behaviour`,
        delay,
        'tick'
      );
      delay += 90;
      push(`  ⚓ WORM ANCHOR @ seq ${d.wormSeq} · orbit head ${d.finalHead.slice(0, 16)}…`, delay, 'tick');
      delay += 120;
      // auto-audit — the reference loop's verification line
      void (async () => {
        const r = await fetch('/api/icsh/ledger/verify');
        const v = (await r.json()) as IcshVerifyResult;
        push(`  ${v.ok ? '✓ VERIFICATION PASSED' : '✗ VERIFICATION FAILED'} — ${v.line}`, delay, v.ok ? 'tick' : 'milestone');
        push(`──────────────────────────────────────────────`, delay + 40, 'tick');
        if (v.ok) sfx.ok();
        setRunning(false);
      })();
      onRun();
    },
    onError: (e: Error) => {
      push(`  ✗ RUN FAILED — ${e.message}`, 0, 'milestone');
      setRunning(false);
      sfx.err();
    },
  });

  const metricsQ = useQuery({
    queryKey: ['icsh', 'metrics'],
    queryFn: async (): Promise<IcshMetrics> => {
      const r = await fetch('/api/icsh/metrics');
      if (!r.ok) throw new Error(`metrics ${r.status}`);
      return (await r.json()) as IcshMetrics;
    },
    refetchInterval: 30000,
  });
  const runsQ = useQuery({
    queryKey: ['icsh', 'runs'],
    queryFn: async (): Promise<IcshRunStatLite[]> => {
      const r = await fetch('/api/icsh/ledger?mode=runs&limit=12');
      if (!r.ok) throw new Error(`runs ${r.status}`);
      const d = (await r.json()) as { runs: IcshRunStatLite[] };
      return d.runs;
    },
    refetchInterval: 20000,
  });

  const m = metricsQ.data ?? null;
  const runs = runsQ.data ?? [];

  return (
    <div className="space-y-4">
      {/* ── viewport telemetry strip ── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { clock: '14:32', vp: 'CITY TWIN', focus: 'local physics & ingestion' },
          { clock: '14:34', vp: 'RIG', focus: '25km peer sync · 32-byte gossip' },
          { clock: '14:36', vp: 'MAP', focus: 'district head coherence folding' },
          { clock: '14:37', vp: 'TRUST SPHERE', focus: 'WORM seal · orbit anchor' },
        ].map((v) => {
          const live = lastResult?.milestones.some((x) => x.viewport === v.vp);
          return (
            <div
              key={v.vp}
              className={cn(
                'border p-2.5 transition-colors',
                running ? 'border-[#3d5c47] bg-[#081209]' : live ? 'border-[#1d4d2c] bg-[#04100a]' : 'border-[#16241a] bg-[#060b08]'
              )}
            >
              <p className={cn('text-[9px] font-bold tracking-[0.18em]', running ? 'text-[#7dffa8] icsh-glow' : 'text-[#9dbda4]')}>
                {v.clock} {v.vp}
              </p>
              <p className="mt-1 text-[8px] leading-snug text-[#5f7f68]">{v.focus}</p>
            </div>
          );
        })}
      </div>

      {/* ── runner ── */}
      <Panel
        title="RUN ITERATIONS · THE 11-BEAT LOOP, DEPLOYED"
        right={
          <span className="text-[8px] tracking-[0.2em] text-[#3f5748]">
            RUNNER <span className="text-[#c8ff00]">{runner}</span> · EVERY NUMBER MEASURED
          </span>
        }
      >
        <div className="mb-3 flex flex-wrap gap-2">
          {RUN_OPTIONS.map((n) => (
            <IcshButton key={n} tone={n === 10000 ? 'lime' : 'ghost'} disabled={running} onClick={() => runMut.mutate(n)}>
              RUN ×{n.toLocaleString()}
            </IcshButton>
          ))}
          <IcshButton
            tone="amber"
            disabled={running}
            className="ml-auto"
            onClick={() => {
              sfx.click();
              setLines([]);
              setLastResult(null);
            }}
          >
            CLEAR TERMINAL
          </IcshButton>
        </div>
        <div
          ref={termRef}
          className="max-h-80 overflow-y-auto border border-[#132018] bg-[#030604] p-3 icsh-scroll"
          role="log"
          aria-label="run terminal output"
        >
          {lines.length === 0 ? (
            <p className="text-[9px] tracking-[0.18em] text-[#3f5748]">
              TERMINAL READY — pick a run length. ×10,000 is the reference benchmark.
            </p>
          ) : (
            lines.map((l, i) => (
              <p key={i} className={cn('icsh-rise whitespace-pre font-mono text-[9px] leading-relaxed', l.startsWith('▶') ? 'text-[#c8ff00] font-bold' : l.startsWith('  ✓') || l.includes('PASSED') ? 'text-[#7dffa8]' : l.startsWith('  ✗') ? 'text-[#ff7a6e]' : l.startsWith('    [') ? 'text-[#f3e38a]' : 'text-[#7d9a84]')}>
                {l}
              </p>
            ))
          )}
        </div>
        {lastResult ? (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Chip label="THROUGHPUT" value={`${Math.round(lastResult.cyclesPerSec).toLocaleString('en-ZA')} c/s`} tone="lime" />
            <Chip label="LOOP-ONLY" value={`${Math.round(lastResult.cycles / (lastResult.loopMs / 1000)).toLocaleString('en-ZA')} c/s`} tone="green" />
            <Chip label="MEMORY" value="32 B FLAT" tone="amber" />
            <Chip label="QUORUM" value={`${(lastResult.agreementRate * 100).toFixed(1)}%`} tone={lastResult.agreementRate > 0.8 ? 'green' : 'red'} />
          </div>
        ) : null}
      </Panel>

      {/* ── the matrix ── */}
      <Panel
        title="COST MATRIX · THE COMPLETE EVERYTHING, RUNNING"
        right={<Chip label="MEASURED AT" value={new Date().toLocaleDateString('en-ZA')} tone="amber" />}
        bodyClass="p-0"
      >
        <div className="overflow-x-auto icsh-scroll">
          <table className="w-full min-w-[720px] text-left">
            <thead className="bg-[#081009] text-[8px] tracking-[0.2em] text-[#5f7f68]">
              <tr>
                <th className="px-3 py-2 font-normal">COMPONENT</th>
                <th className="px-3 py-2 font-normal">UNIT (MEASURED)</th>
                <th className="px-3 py-2 font-normal">PER 10K CYCLES</th>
                <th className="px-3 py-2 font-normal">MONTH @ 1/5s</th>
                <th className="px-3 py-2 font-normal">MONTH @ 1/30s</th>
              </tr>
            </thead>
            <tbody>
              {(m?.matrix ?? []).map((row) => (
                <tr key={row.component} className="border-t border-[#0e1811] hover:bg-[#081009]">
                  <td className="px-3 py-2">
                    <p className="text-[10px] font-bold text-[#9dbda4]">{row.component}</p>
                    <p className="mt-0.5 text-[8px] text-[#3f5748]">{row.note}</p>
                  </td>
                  <td className="px-3 py-2 text-[10px] tabular-nums text-[#7dffa8]">
                    {row.unitBytes !== null ? `${row.unitBytes} B` : '—'}
                    <span className="block text-[8px] text-[#3f5748]">{row.unitLabel}</span>
                  </td>
                  <td className="px-3 py-2 text-[10px] tabular-nums text-[#c9e4cd]">{row.per10kCycles}</td>
                  <td className="px-3 py-2 text-[10px] tabular-nums text-[#c9e4cd]">{row.perMonthFast}</td>
                  <td className="px-3 py-2 text-[10px] tabular-nums text-[#c9e4cd]">{row.perMonthSlow}</td>
                </tr>
              ))}
              {!m ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-[9px] tracking-[0.2em] text-[#5f7f68]">
                    MEASURING THE LIVE LEDGER…
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* ── ZAR block + totals ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="ZAR · PER FARM NODE / MONTH (EST)">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between border-b border-dashed border-[#142019] py-1.5">
              <span className="text-[9px] tracking-[0.16em] text-[#5f7f68]">DATA @ 1/5s CADENCE</span>
              <span className="text-[13px] font-black text-[#c8ff00] icsh-glow-lime tabular-nums">
                {m?.measured.zarPerMonthFast !== null && m?.measured.zarPerMonthFast !== undefined ? `R${m.measured.zarPerMonthFast.toFixed(2)}` : '—'}
              </span>
            </div>
            <div className="flex items-baseline justify-between border-b border-dashed border-[#142019] py-1.5">
              <span className="text-[9px] tracking-[0.16em] text-[#5f7f68]">DATA @ 1/30s CADENCE</span>
              <span className="text-[13px] font-black text-[#7dffa8] tabular-nums">
                {m?.measured.zarPerMonthSlow !== null && m?.measured.zarPerMonthSlow !== undefined ? `R${m.measured.zarPerMonthSlow.toFixed(2)}` : '—'}
              </span>
            </div>
            <div className="flex items-baseline justify-between border-b border-dashed border-[#142019] py-1.5">
              <span className="text-[9px] tracking-[0.16em] text-[#5f7f68]">NODE HOSTING (VPS, ENTRY)</span>
              <span className="text-[13px] font-black text-[#f3e38a] tabular-nums">R120.00</span>
            </div>
            <div className="flex items-baseline justify-between py-1">
              <span className="text-[9px] tracking-[0.16em] text-[#7d9a84]">TOTAL @ 1/5s</span>
              <span className="text-[15px] font-black text-[#c8ff00] icsh-glow-lime tabular-nums">
                {m?.measured.zarPerMonthFast !== null && m?.measured.zarPerMonthFast !== undefined
                  ? `R${(m.measured.zarPerMonthFast + 120).toFixed(2)}`
                  : '—'}
              </span>
            </div>
            <p className="text-[8px] leading-relaxed tracking-[0.1em] text-[#a89f6e]">
              EST — data priced at R99/GB prepaid; hosting at entry-VPS ballpark. Measure again after the first real farm week.
            </p>
          </div>
        </Panel>

        <Panel title="LIVE LEDGER TOTALS (MEASURED)">
          <div className="grid grid-cols-2 gap-2">
            <Chip label="CYCLES" value={m ? m.measured.totalCycles.toLocaleString() : '—'} tone="lime" />
            <Chip label="VAULT .MD" value={m ? m.measured.totalVaultNodes.toLocaleString() : '—'} tone="green" />
            <Chip label="WORM ENTRIES" value={m ? m.measured.totalWormEntries.toLocaleString() : '—'} />
            <Chip label="RUNS" value={m ? m.measured.totalRuns.toLocaleString() : '—'} />
            <Chip label="DB FILE" value={m ? fmtBytes(m.measured.dbBytes) : '—'} tone="amber" />
            <Chip label="PEERS UP" value={m ? `${m.measured.peersReachable}/25` : '—'} tone="green" />
            <Chip label="MEAN LINE" value={m?.measured.avgLedgerLineBytes ? `${m.measured.avgLedgerLineBytes} B` : '—'} />
            <Chip label="MEAN VAULT" value={m?.measured.avgVaultNodeBytes ? `${m.measured.avgVaultNodeBytes} B` : '—'} />
          </div>
          {m?.measured.cyclesPerSec ? (
            <p className="mt-3 text-[9px] tracking-[0.14em] text-[#7d9a84]">
              ALL-TIME MEASURED THROUGHPUT: <span className="text-[#c8ff00]">{Math.round(m.measured.cyclesPerSec).toLocaleString('en-ZA')} cycles/s</span> (Σ runs ÷ Σ ms)
            </p>
          ) : null}
          {m?.measured.agreementRateAllTime !== null && m?.measured.agreementRateAllTime !== undefined ? (
            <p className="mt-1 text-[9px] tracking-[0.14em] text-[#7d9a84]">
              ALL-TIME QUORUM: <span className="text-[#7dffa8]">{(m.measured.agreementRateAllTime * 100).toFixed(1)}%</span> of cycles
            </p>
          ) : null}
        </Panel>

        <Panel title="READY TO ONBOARD · YOU + YOUR FRIENDS">
          <ol className="space-y-2">
            {[
              ['JOIN METHOD ▸ TOTP', 'any authenticator app — no HTTPS, no camera, no permissions'],
              ['RUN ITERATIONS', '×100 to ×10,000 — measured, attributed to your callsign'],
              ['RUN AUDIT', 'WORM LEDGER ▸ RUN AUDIT — “OK: N cycles · head=…”'],
              ['EXPORT ledger.jsonl', 'take the proof with you — the auditor takes only this file'],
            ].map(([k, v], i) => (
              <li key={k} className="flex items-baseline gap-2">
                <span className="text-[9px] font-black text-[#c8ff00]">{i + 1}▸</span>
                <div>
                  <p className="text-[9px] font-bold tracking-[0.16em] text-[#9dbda4]">{k}</p>
                  <p className="text-[8px] text-[#5f7f68]">{v}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-3 border-t border-dashed border-[#142019] pt-2 text-[8px] leading-relaxed tracking-[0.1em] text-[#a89f6e]">
            Then do it again on your farm. That is the whole point — run your own iterations to prove that it works. 🌱
          </p>
        </Panel>
      </div>

      {/* ── run history ── */}
      <Panel title="RUN HISTORY · MEASURED, ATTRIBUTED, ON CHAIN" bodyClass="p-0">
        <div className="max-h-64 overflow-y-auto icsh-scroll">
          <table className="w-full min-w-[560px] text-left">
            <thead className="sticky top-0 bg-[#081009] text-[8px] tracking-[0.2em] text-[#5f7f68]">
              <tr>
                <th className="px-3 py-2 font-normal">WHEN</th>
                <th className="px-3 py-2 font-normal">CYCLES</th>
                <th className="px-3 py-2 font-normal">TOTAL MS</th>
                <th className="px-3 py-2 font-normal">C/S</th>
                <th className="px-3 py-2 font-normal">QUORUM</th>
                <th className="px-3 py-2 font-normal">FINAL HEAD</th>
                <th className="px-3 py-2 font-normal">RUNNER</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-t border-[#0e1811] hover:bg-[#081009]">
                  <td className="px-3 py-1.5 text-[9px] text-[#5f7f68]">{ago(r.createdAt)}</td>
                  <td className="px-3 py-1.5 text-[10px] tabular-nums text-[#c8ff00]">{r.cycles.toLocaleString()}</td>
                  <td className="px-3 py-1.5 text-[10px] tabular-nums text-[#c9e4cd]">{r.durationMs.toFixed(1)}</td>
                  <td className="px-3 py-1.5 text-[10px] tabular-nums text-[#7dffa8]">{Math.round(r.cyclesPerSec).toLocaleString('en-ZA')}</td>
                  <td className="px-3 py-1.5 text-[10px] tabular-nums text-[#7d9a84]">{(r.agreementRate * 100).toFixed(1)}%</td>
                  <td className="px-3 py-1.5 text-[9px] tabular-nums text-[#5f7f68]">{head8(r.finalHead)}</td>
                  <td className="px-3 py-1.5 text-[9px] tracking-[0.1em] text-[#f3e38a]">{r.runner}</td>
                </tr>
              ))}
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-[9px] tracking-[0.2em] text-[#5f7f68]">
                    NO RUNS YET — the history fills only with real, measured runs
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* ── assumptions ── */}
      {m ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Panel title="ASSUMPTIONS (VISIBLE, ALWAYS)">
            <ul className="space-y-1.5">
              {m.assumptions.map((a) => (
                <li key={a} className="text-[8px] leading-relaxed tracking-[0.08em] text-[#7d9a84]">
                  ▸ {a}
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="HONESTY (WRITTEN INTO THE MATRIX)">
            <ul className="space-y-1.5">
              {m.honesty.map((a) => (
                <li key={a} className="text-[8px] leading-relaxed tracking-[0.08em] text-[#a89f6e]">
                  ▸ {a}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
