'use client';

// src/components/icsh/PyFlywheel.tsx — 14:39 PY FLYWHEEL · the vvu-trust
// Python core, live. Every number on this surface is read from the real
// on-disk artifacts (ledger as storage) through /api/vvu/flywheel — nothing
// simulated, nothing invented:
//
//   LIVE STRIP   last ledger line: cycle · agreement · peers · bucket · ms · seed
//   HEADS        seed_head / network_head / mint_head (click to copy, full 16ch)
//   SPARK STRIP  agreement over the parsed history window (rose = divergent)
//   BEATS        the 11 beats in order (per-cycle divergent counts are NOT in
//                this ledger's schema — not invented)
//   ARTIFACTS    ledger · vault · chain · receipt · peers cards
//   ACTIONS      RUN 5 CYCLES / STRANGER VERIFY / BOOTSTRAP → the real runner

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  FileJson,
  Network,
  Play,
  RefreshCw,
  Rocket,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { PyFlywheelStatus, PyLedgerLine } from '@/lib/vvu/pyflywheel';
import { Chip, Empty, ago, fmtBytes } from './parts';
import { sfx } from './sound';

type PyAction = 'cycles' | 'verify' | 'bootstrap';

interface PyRunResult {
  ok: boolean;
  exitCode: number | null;
  action?: string;
  stdout: string;
  stderr: string;
  at: number;
}

// ── small atoms ──────────────────────────────────────────────────────────────

/** Full-16ch head chip — click to copy (title carries the hint). */
function HeadChip({ label, value }: { label: string; value: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!value) {
    return <Chip label={label} value="—" />;
  }
  return (
    <button
      type="button"
      title={`${label} ${value} — click to copy`}
      aria-label={`copy ${label} ${value}`}
      onClick={async () => {
        sfx.click();
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          /* clipboard unavailable — the value is in the title anyway */
        }
      }}
      className="flex items-baseline gap-1.5 border border-[#1d2f22] bg-[#070d09] px-2 py-1 text-left transition-colors hover:border-[#7dffa8] focus-visible:border-[#7dffa8] focus-visible:outline-none"
    >
      <span className="text-[8px] tracking-[0.22em] text-[#5f7f68]">{label}</span>
      <span className="font-mono text-[11px] font-bold tabular-nums leading-none text-[#c9e4cd] icsh-glow">
        {copied ? <span className="text-[#7dffa8]">COPIED ✓</span> : value}
      </span>
      <span className="sr-only">{copied ? '(copied to clipboard)' : `(click to copy ${value})`}</span>
    </button>
  );
}

/** Agreement spark-strip — thin bars over the history window. */
function AgreementStrip({ history }: { history: PyLedgerLine[] }) {
  const divergent = history.filter((h) => !h.agreement);
  if (history.length === 0) {
    return <p className="text-[9px] tracking-[0.18em] text-[#3f5748]">NO CYCLES IN WINDOW</p>;
  }
  return (
    <div>
      <div
        className="flex items-end gap-[2px] overflow-x-auto pb-1 icsh-scroll"
        style={{ height: 48 }}
        role="img"
        aria-label={`agreement over the last ${history.length} cycles: ${history.length - divergent.length} agree, ${divergent.length} divergent`}
      >
        {history.map((h) => (
          <span
            key={h.cycle}
            title={`cycle ${h.cycle} · ${h.agreement ? 'agree' : 'diverge'}`}
            className={cn(
              'w-[4px] shrink-0 rounded-[1px]',
              h.agreement ? 'h-[26px] bg-[#7dffa8]' : 'h-[46px] bg-[#ff7a6e]'
            )}
          />
        ))}
      </div>
      {divergent.length > 0 ? (
        <p className="mt-1 text-[8px] tracking-[0.16em] text-[#ff7a6e]">
          DIVERGENT @ C{divergent.map((d) => d.cycle).join(' · C')} — bucket-rollover drift is correct behaviour
        </p>
      ) : (
        <p className="mt-1 text-[8px] tracking-[0.16em] text-[#5f7f68]">
          QUORUM OVER WINDOW — {history.length}/{history.length} AGREE
        </p>
      )}
    </div>
  );
}

/** CRT-styled ui Card wrapper (square corners, estate phosphor field). */
function CrtCard({
  title,
  icon,
  right,
  children,
  className,
}: {
  title: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('gap-0 rounded-none border-[#16241a] bg-[#060b08] py-0 shadow-none', className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-[#16241a] bg-[#081009] px-3 py-2">
        <CardTitle className="flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-[0.28em] text-[#9dbda4] uppercase">
          {icon}
          {title}
        </CardTitle>
        {right ? <div className="flex items-center gap-2">{right}</div> : null}
      </CardHeader>
      <CardContent className="p-3">{children}</CardContent>
    </Card>
  );
}

function KV({ k, v, tone }: { k: string; v: React.ReactNode; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-[#142019] py-1.5 last:border-0">
      <span className="whitespace-nowrap text-[9px] uppercase tracking-[0.2em] text-[#5f7f68]">{k}</span>
      <span className={cn('break-all text-right font-mono text-[11px] tabular-nums', tone ?? 'text-[#c9e4cd]')}>{v}</span>
    </div>
  );
}

// ── the surface ──────────────────────────────────────────────────────────────

export function PyFlywheelSurface() {
  const queryClient = useQueryClient();
  const [output, setOutput] = useState<PyRunResult | null>(null);

  const q = useQuery({
    queryKey: ['pyflywheel'],
    queryFn: async (): Promise<PyFlywheelStatus> => {
      const r = await fetch('/api/vvu/flywheel', { cache: 'no-store' });
      if (!r.ok) throw new Error(`flywheel ${r.status}`);
      return (await r.json()) as PyFlywheelStatus;
    },
    refetchInterval: 3000,
    retry: 1,
  });

  const actMut = useMutation({
    mutationFn: async (action: PyAction): Promise<PyRunResult> => {
      const r = await fetch('/api/vvu/flywheel', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const d = (await r.json()) as (Omit<PyRunResult, 'at'> & { error?: string }) | null;
      if (!r.ok) throw new Error(d?.error ?? `POST ${r.status}`);
      return { ...d, ok: d?.ok ?? false, exitCode: d?.exitCode ?? null, stdout: d?.stdout ?? '', stderr: d?.stderr ?? '', at: Date.now() };
    },
    onSuccess: (d) => {
      setOutput(d);
      if (d.ok) sfx.ok();
      else sfx.err();
      // re-read every artifact right away — the runner just touched them
      void queryClient.invalidateQueries({ queryKey: ['pyflywheel'] });
    },
    onError: (e: Error, action) => {
      setOutput({ ok: false, exitCode: null, action, stdout: '', stderr: e.message, at: Date.now() });
      sfx.err();
    },
  });

  const fire = (action: PyAction) => {
    sfx.click();
    actMut.mutate(action);
  };

  const busy = actMut.isPending;
  const d = q.data ?? null;
  const ledger = d?.ledger ?? null;
  const last = ledger?.last ?? null;
  const seed = d?.seed ?? null;
  const beats = d?.beats ?? [];
  const fetchedAt = q.dataUpdatedAt ? ago(new Date(q.dataUpdatedAt).toISOString()) : '—';

  // ── loading skeleton ──
  if (q.isLoading) {
    return (
      <section aria-label="py flywheel — loading" className="space-y-3">
        <Skeleton className="h-40 w-full rounded-none border border-[#16241a] bg-[#081009]" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-none border border-[#16241a] bg-[#081009]" />
          ))}
        </div>
        <p className="text-[9px] tracking-[0.2em] text-[#3f5748]">READING /tmp/flywheel_icsh + ~/.vvu + VAULT…</p>
      </section>
    );
  }

  // ── error state (with manual retry) ──
  if (q.isError) {
    return (
      <section aria-label="py flywheel — error" className="space-y-3">
        <div className="flex flex-col items-center gap-3 border border-dashed border-[#4d2018] bg-[#100604] px-6 py-10 text-center">
          <p className="text-[11px] tracking-[0.18em] text-[#ff7a6e]">FLYWHEEL STATUS OFFLINE</p>
          <p className="font-mono text-[9px] break-all text-[#7d9a84]">{String(q.error)}</p>
          <Button
            variant="outline"
            onClick={() => void q.refetch()}
            className="h-11 rounded-none border-[#4d2018] bg-transparent font-mono text-[10px] font-bold tracking-[0.22em] text-[#ff7a6e] uppercase hover:bg-[#160806]"
            aria-label="retry flywheel status"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            RETRY
          </Button>
        </div>
      </section>
    );
  }

  // ── empty state — no telemetry on this node yet ──
  if (!ledger?.exists) {
    return (
      <section aria-label="py flywheel — empty" className="space-y-4">
        <Empty
          lines={[
            'NO TELEMETRY YET — THE FLYWHEEL HAS NOT RUN ON THIS NODE',
            '/tmp/flywheel_icsh/ledger.jsonl is absent · BOOTSTRAP runs the fresh-machine one-liner',
          ]}
          action={
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => fire('bootstrap')}
              className="h-11 rounded-none border-[#4d5d12] bg-[#0c0f04] font-mono text-[10px] font-bold tracking-[0.22em] text-[#c8ff00] uppercase hover:bg-[#141a04] disabled:opacity-40"
              aria-label="bootstrap the flywheel (fresh-machine one-liner)"
            >
              {busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Rocket className="h-3.5 w-3.5" aria-hidden="true" />}
              BOOTSTRAP
            </Button>
          }
        />
        {output ? <RunOutput out={output} /> : null}
      </section>
    );
  }

  const history = ledger.history;
  const vault = d?.vault;
  const chain = d?.chain;
  const receipt = d?.receipt;
  const peers = d?.peers;
  const seedOk = seed?.exists === true && seed.bytes === 32;

  return (
    <div className="space-y-4">
      {/* ── live strip + heads + spark + beats ── */}
      <CrtCard
        title="PY FLYWHEEL · THE PYTHON CORE, LIVE"
        icon={<Activity className="h-3.5 w-3.5 text-[#c8ff00]" aria-hidden="true" />}
        right={
          <>
            <span className="text-[8px] tracking-[0.2em] text-[#3f5748]">FETCHED {fetchedAt}</span>
            <button
              type="button"
              title="refresh now"
              aria-label="refresh flywheel status"
              onClick={() => {
                sfx.click();
                void q.refetch();
              }}
              className="flex h-7 w-7 items-center justify-center border border-[#24402c] text-[#9dbda4] transition-colors hover:border-[#7dffa8] hover:text-[#c9e4cd]"
            >
              <RefreshCw className={cn('h-3 w-3', q.isFetching && 'animate-spin')} aria-hidden="true" />
            </button>
          </>
        }
      >
        <section aria-label="live cycle telemetry" className="flex flex-wrap gap-1.5">
          <Chip label="CYCLE" value={last?.cycle ?? '—'} tone="lime" />
          <Chip
            label="AGREEMENT"
            value={last ? (last.agreement ? 'AGREE' : 'DIVERGE') : '—'}
            tone={last ? (last.agreement ? 'lime' : 'red') : 'dim'}
          />
          <Chip label="PEERS" value={last?.peers_reachable ?? '—'} tone="green" />
          <Chip label="BUCKET" value={last ? last.bucket.toLocaleString('en-ZA') : '—'} />
          <Chip label="MS" value={last?.ms ?? '—'} />
          <Chip
            label="SEED"
            value={seed?.exists ? `${seed.bytes} B` : '—'}
            tone={seedOk ? 'green' : 'amber'}
            className={cn(!seedOk && 'icsh-blink')}
          />
          {!seedOk ? (
            <span className="self-center text-[8px] tracking-[0.18em] text-[#f3e38a]" title="the seed must stay exactly 32 bytes">
              ⚠ SEED MUST STAY 32 B
            </span>
          ) : null}
          <Chip label="LEDGER" value={`${ledger.lines.toLocaleString('en-ZA')} LINES`} />
        </section>

        <section aria-label="chain heads — click a chip to copy" className="mt-3">
          <p className="mb-1.5 text-[8px] tracking-[0.26em] text-[#3f5748]">HEADS · LAST CYCLE · CLICK TO COPY</p>
          <div className="flex flex-wrap gap-1.5">
            <HeadChip label="SEED_HEAD" value={last?.seed_head ?? null} />
            <HeadChip label="NETWORK_HEAD" value={last?.network_head ?? null} />
            <HeadChip label="MINT_HEAD" value={last?.mint_head ?? null} />
          </div>
        </section>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <section aria-label="agreement history">
            <p className="mb-1.5 text-[8px] tracking-[0.26em] text-[#3f5748]">
              AGREEMENT · LAST {history.length} CYCLES
            </p>
            <AgreementStrip history={history} />
          </section>
          <section aria-label="the eleven beats, in order">
            <p className="mb-1.5 text-[8px] tracking-[0.26em] text-[#3f5748]">
              THE 11 BEATS · IN ORDER
            </p>
            <div className="flex flex-wrap gap-1">
              {beats.map((b, i) => (
                <Badge
                  key={`${i}-${b}`}
                  variant="outline"
                  title={`beat ${i + 1} of ${beats.length}`}
                  className="rounded-none border-[#1d2f22] bg-[#070d09] px-1.5 py-0.5 font-mono text-[8px] tracking-[0.14em] text-[#7d9a84]"
                >
                  <span className="text-[#3f5748]">{i + 1}·</span>
                  {b}
                </Badge>
              ))}
            </div>
            <p className="mt-1.5 text-[8px] leading-relaxed tracking-[0.1em] text-[#5f7f68]">
              Per-cycle divergent counts are not in this ledger&rsquo;s schema — not invented here.
            </p>
          </section>
        </div>
      </CrtCard>

      {/* ── artifacts grid ── */}
      <section aria-label="on-disk artifacts" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <CrtCard title="LEDGER · JSONL" icon={<FileJson className="h-3.5 w-3.5 text-[#7dffa8]" aria-hidden="true" />}>
          <KV k="LINES" v={ledger.lines.toLocaleString('en-ZA')} tone="text-[#c8ff00]" />
          <KV k="BYTES" v={fmtBytes(ledger.bytes)} />
          <KV
            k="MEAN LINE"
            v={ledger.meanLineBytes !== null ? `${ledger.meanLineBytes} B` : '—'}
            tone="text-[#7dffa8]"
          />
          <p className="mt-2 break-all font-mono text-[8px] leading-relaxed text-[#3f5748]" title="/tmp/flywheel_icsh/ledger.jsonl">
            /tmp/flywheel_icsh/ledger.jsonl
          </p>
        </CrtCard>

        <CrtCard title="VAULT · OBSIDIAN TWIN">
          <KV k="NOTES" v={(vault?.count ?? 0).toLocaleString('en-ZA')} tone="text-[#c8ff00]" />
          <KV k="LAST" v={vault?.last ?? '—'} tone="text-[#7dffa8]" />
          <p
            className="mt-2 break-all font-mono text-[8px] leading-relaxed text-[#3f5748]"
            title={vault?.dir ?? ''}
          >
            {vault?.dir ?? '—'}
          </p>
        </CrtCard>

        <CrtCard title="CHAIN · INSTALLER">
          <KV k="ENTRIES" v={(chain?.entries ?? 0).toLocaleString('en-ZA')} tone="text-[#c8ff00]" />
          <KV k="HEAD" v={chain?.head ? chain.head.slice(0, 16) : '—'} tone="text-[#7dffa8]" />
          <KV
            k="LAST ENTRY"
            v={chain?.lastEntry ? `${chain.lastEntry.name} · ${ago(new Date(chain.lastEntry.ts * 1000).toISOString())}` : '—'}
          />
          <p className="mt-2 break-all font-mono text-[8px] leading-relaxed text-[#3f5748]">~/.vvu/chains/installer.json · Ed25519-signed</p>
        </CrtCard>

        <CrtCard title="RECEIPT · INSTALL" className="sm:col-span-2 lg:col-span-1">
          <KV k="RECEIPT" v={receipt?.receipt ? receipt.receipt.slice(0, 16) : '—'} tone="text-[#c8ff00]" />
          <KV k="TIER" v={receipt?.tier ?? '—'} tone="text-[#f3e38a]" />
          <KV k="STEPS" v={receipt?.steps ?? '—'} />
          <KV k="N_PROBES_CHANGED" v={receipt?.n_probes_changed ?? '—'} tone="text-[#7dffa8]" />
          <p className="mb-1.5 mt-2 text-[8px] tracking-[0.26em] text-[#3f5748]">PROBES · BEFORE (LITERAL)</p>
          <div className="flex flex-wrap gap-1">
            {receipt?.probes
              ? Object.entries(receipt.probes).map(([k, v]) => (
                  <Badge
                    key={k}
                    variant="outline"
                    className="rounded-none border-[#1d2f22] bg-[#070d09] px-1.5 py-0.5 font-mono text-[8px] tracking-[0.1em] text-[#7d9a84]"
                  >
                    {k}=<span className="text-[#f3e38a]">{v}</span>
                  </Badge>
                ))
              : <span className="text-[9px] text-[#3f5748]">—</span>}
          </div>
        </CrtCard>

        <CrtCard title="PEERS · ROSTER" icon={<Network className="h-3.5 w-3.5 text-[#7dffa8]" aria-hidden="true" />}>
          <KV k="COUNT" v={(peers?.count ?? 0).toLocaleString('en-ZA')} tone="text-[#c8ff00]" />
          <KV k="FIRST" v={peers?.first ?? '—'} tone="text-[#7dffa8]" />
          <p className="mt-2 font-mono text-[8px] leading-relaxed text-[#3f5748]">/tmp/flywheel_icsh/peers.json · local:// by default</p>
        </CrtCard>
      </section>

      {/* ── actions + runner output ── */}
      <CrtCard title="RUNNER · vvu_runner.py" icon={<Play className="h-3.5 w-3.5 text-[#c8ff00]" aria-hidden="true" />}>
        <section aria-label="runner actions" className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => fire('cycles')}
            className="h-11 rounded-none border-[#4d5d12] bg-[#0c0f04] font-mono text-[10px] font-bold tracking-[0.22em] text-[#c8ff00] uppercase hover:bg-[#141a04] hover:text-[#c8ff00] disabled:opacity-40"
            aria-label="run 5 flywheel cycles"
          >
            {busy && actMut.variables === 'cycles' ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            RUN 5 CYCLES
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => fire('verify')}
            className="h-11 rounded-none border-[#1d4d2c] bg-[#04100a] font-mono text-[10px] font-bold tracking-[0.22em] text-[#7dffa8] uppercase hover:bg-[#06170e] hover:text-[#7dffa8] disabled:opacity-40"
            aria-label="run stranger verify"
          >
            {busy && actMut.variables === 'verify' ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            STRANGER VERIFY
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => fire('bootstrap')}
            className="h-11 rounded-none border-[#4d4418] bg-[#0f0d04] font-mono text-[10px] font-bold tracking-[0.22em] text-[#f3e38a] uppercase hover:bg-[#141104] hover:text-[#f3e38a] disabled:opacity-40"
            aria-label="bootstrap — runs the fresh-machine one-liner"
          >
            {busy && actMut.variables === 'bootstrap' ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Rocket className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            BOOTSTRAP
          </Button>
          <span className="text-[8px] leading-relaxed tracking-[0.14em] text-[#5f7f68]">
            BOOTSTRAP runs the fresh-machine one-liner — no args.
          </span>
        </section>
        {output ? <div className="mt-3">{<RunOutput out={output} />}</div> : null}
      </CrtCard>
    </div>
  );
}

// ── runner output box ────────────────────────────────────────────────────────

function RunOutput({ out }: { out: PyRunResult }) {
  return (
    <div className="border border-[#132018] bg-[#030604]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#132018] bg-[#081009] px-3 py-1.5">
        <span className="font-mono text-[8px] tracking-[0.24em] text-[#5f7f68]">
          RUNNER OUTPUT · {(out.action ?? '—').toUpperCase()} · EXIT {out.exitCode ?? '—'} · {ago(new Date(out.at).toISOString())}
        </span>
        <span className={cn('font-mono text-[8px] font-bold tracking-[0.2em]', out.ok ? 'text-[#7dffa8]' : 'text-[#ff7a6e]')}>
          {out.ok ? '✓ OK' : '✗ FAIL'}
        </span>
      </div>
      <ScrollArea className="max-h-64 [&_[data-slot=scroll-area-viewport]]:max-h-64">
        <pre
          className="whitespace-pre-wrap break-words p-3 font-mono text-[9px] leading-relaxed text-[#7d9a84]"
          role="log"
          aria-label="runner stdout tail"
        >
          {out.stdout || '(no stdout)'}
          {out.stderr ? `\n── stderr ──\n${out.stderr}` : ''}
        </pre>
      </ScrollArea>
    </div>
  );
}
