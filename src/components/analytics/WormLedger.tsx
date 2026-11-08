'use client';

// src/components/analytics/WormLedger.tsx — DB-backed WORM event ledger:
// chain integrity badge (valid / broken @ seq), event count, VERIFY button
// (refetch + toast result) and a max-height scrolling table of the newest
// hash-chained events, colour-coded by source. Task 7-b: cursor pagination
// (SHOW OLDER pages 50 at a time via ?before=<oldest seq>) and a full-chain
// CSV export that loops the cursor instead of stopping at the 500-entry cap.
// Task 8-a: source-filter dropdown (ALL SOURCES + sources derived from the
// loaded data) that narrows the table via GET ?source=<SRC>.
// Task 10-a: event-type chip row (second filter dimension over source —
// ALL / FSM / SIM / OPERATOR / MANIFEST / SYSTEM) applied client-side over
// the loaded pool with AND composition against the source filter.

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronsDown, Download, Filter, ListFilter, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { LedgerEntry } from '@/types/vvu';
import {
  Chip,
  HttpError,
  QueryErrorCard,
  SectionHeader,
  fmtNum,
  fmtTime,
  useLedgerQuery,
  useQueryErrorToast,
  type LedgerResponse,
} from './shared';

const SOURCE_CLASS: Record<string, string> = {
  MANIFEST: 'border-[#8fb35a]/50 text-[#8fb35a]',
  GATE_CERT: 'border-[#c8ff00]/50 text-[#c8ff00]',
  TELEMETRY: 'border-[#2ea8a0]/50 text-[#2ea8a0]',
  ROUTE_TOGGLE: 'border-[#e0a030]/50 text-[#e0a030]',
  // Task 14-a — the REAL outreach engine writes via its API routes.
  OUTREACH: 'border-[#f3e38a]/50 text-[#f3e38a]',
  SYSTEM: 'border-[rgba(107,138,64,0.35)] text-[#7a8a6e]',
};

function sourceClass(source: string): string {
  return SOURCE_CLASS[source] ?? 'border-[rgba(107,138,64,0.3)] text-[#c9d4bd]';
}

// Task 16-a — event-tone map (keyed by EVENT, unlike SOURCE_CLASS above,
// which is keyed by source). A row whose event has an entry renders the
// EVENT cell as a bordered mono chip (same pattern as the source chips);
// every other event keeps the historical plain-text cell, so dark output is
// unchanged. THEME_TOGGLE takes the ochre ROUTE_TOGGLE tone.
const EVENT_CLASS: Record<string, string> = {
  THEME_TOGGLE: 'border-[#e0a030]/50 text-[#e0a030]',
};

function eventClass(event: string): string | null {
  return EVENT_CLASS[event] ?? null;
}

// Task 10-a — event-type categories (second filter dimension over source).
// Fixed six labels; membership follows the stable event prefixes the sim
// writes: FSM_* (state transitions), SIM_* (month rolls / speed / skips),
// the operator sextet VIEW_MODE / NODE_INSPECT / NODE_PIN / FSM_GLANCE /
// ROUTE_TOGGLE / GIS_LAYER (Round 12 bench layer toggles) plus the outreach
// quintet (Task 14-a — operator-driven panel actions on the REAL engine) and
// the DAYSHIFT theme toggle (Task 16-a), the single RELEASE_HASH_REGISTERED
// manifest event —
// everything else (INGEST_*, BOOT_*, STEADY_HOLD, DEMO_CTRL…) lands in SYSTEM.
const OPERATOR_EVENTS: ReadonlySet<string> = new Set([
  'VIEW_MODE',
  'NODE_INSPECT',
  'NODE_PIN',
  'FSM_GLANCE',
  'ROUTE_TOGGLE',
  'GIS_LAYER',
  // Task 16-a — DAYSHIFT light/dark ops-mode toggle (header button + palette).
  'THEME_TOGGLE',
  // Task 14-a — outreach engine events (operator actions via the panel):
  'OUTREACH_TARGET_ADDED',
  'OUTREACH_TARGET_UPDATED',
  'OUTREACH_IMPORT',
  'OUTREACH_BLOCKED',
  'OUTREACH_EMAIL',
]);
const EVENT_CATEGORIES = ['FSM', 'SIM', 'OPERATOR', 'MANIFEST', 'SYSTEM'] as const;
type EventCategory = 'ALL' | (typeof EVENT_CATEGORIES)[number];

function eventCategory(event: string): Exclude<EventCategory, 'ALL'> {
  if (event.startsWith('FSM_')) return 'FSM';
  if (event.startsWith('SIM_')) return 'SIM';
  if (event === 'RELEASE_HASH_REGISTERED') return 'MANIFEST';
  if (OPERATOR_EVENTS.has(event)) return 'OPERATOR';
  return 'SYSTEM';
}

/** Task 10-a — one event-type chip: sage resting border, lime bg-tint + lime
 *  text when active (aria-pressed), 45% dimmed when the category has zero
 *  rows in the current pool (discoverable, not hidden). 36px target (44px on
 *  coarse pointers) — a secondary control, still a real focusable button. */
function EventCatChip({
  cat,
  active,
  dimmed,
  onClick,
}: {
  cat: EventCategory;
  active: boolean;
  dimmed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={
        cat === 'ALL' ? 'show all event types' : `show ${cat} events${dimmed ? ' — none in the loaded pool' : ''}`
      }
      className={cn(
        'vvu-label text-[9px] font-bold px-2 py-1 min-h-[36px] [@media(pointer:coarse)]:min-h-[44px]',
        'rounded border whitespace-nowrap shrink-0 inline-flex items-center vvu6c-btn',
        active
          ? 'border-[#c8ff00]/60 bg-[#c8ff00]/10 text-[#c8ff00]'
          : 'border-[#8fb35a]/50 text-[#8fb35a] hover:bg-[#8fb35a]/10 hover:text-[#c9d4bd] hover:border-[#8fb35a]',
        dimmed && 'opacity-45'
      )}
    >
      {cat}
    </button>
  );
}

/** CSV cell: quote when forced or when the value contains , " or newlines. */
function csvCell(raw: string | null, forceQuote = false): string {
  const s = (raw ?? '').replace(/[\r\n]+/g, ' ');
  if (!forceQuote && !/[,"\r\n]/.test(s)) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

/** en-ZA-ish local timestamp: YYYYMMDD-HHmmss. */
function csvStamp(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** Task 7-b — merge appended cursor pages with already-loaded entries,
 *  deduped by seq and sorted newest-first. The 15s background refetch slides
 *  the newest-50 window forward, so dedupe keeps the union consistent. */
function mergeBySeq(loaded: LedgerEntry[], extra: LedgerEntry[]): LedgerEntry[] {
  const bySeq = new Map<number, LedgerEntry>();
  for (const e of extra) bySeq.set(e.seq, e);
  for (const e of loaded) if (!bySeq.has(e.seq)) bySeq.set(e.seq, e);
  return [...bySeq.values()].sort((a, b) => b.seq - a.seq);
}

function LedgerSkeleton() {
  return (
    <div className="space-y-2 p-1" aria-hidden>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-8 w-full bg-[#141a11]" />
      ))}
    </div>
  );
}

/** Task 8-a — source-filtered ledger page (GET /api/vvu/ledger?source=<SRC>).
 *  API behaviour, verified against src/app/api/vvu/ledger/route.ts + live:
 *  · `count` in the response is the GLOBAL chain length (verifyChain counts
 *    every row), NOT the filtered count → the footer's OF-number is derived
 *    from the entries below.
 *  · The route does NOT compose `before=` with `source=` — `before` wins and
 *    the source is ignored. So SHOW OLDER under a filter pages the UNFILTERED
 *    before-cursor and filters client-side over the loaded pool (documented
 *    choice per the task; API edits are off-limits this round).
 *  · The fetch uses limit=500 (the route's take cap) so the filtered view is
 *    complete for every source present today (largest = SYSTEM ≈ 280 events)
 *    and the footer count is exact; if a source ever exceeds 500 the count
 *    renders "N+" and SHOW OLDER keeps appending via the client-side path. */
function useLedgerSourceQuery(source: string | null) {
  return useQuery<LedgerResponse, HttpError>({
    queryKey: ['vvu-ledger-source', source],
    enabled: source !== null,
    queryFn: async ({ queryKey }) => {
      const src = queryKey[1] as string;
      const res = await fetch(`/api/vvu/ledger?source=${encodeURIComponent(src)}&limit=500`, { cache: 'no-store' });
      if (!res.ok) throw new HttpError(`WORM LEDGER HTTP ${res.status}`, res.status);
      return (await res.json()) as LedgerResponse;
    },
    refetchInterval: 15000,
    staleTime: 8000,
  });
}

export function WormLedger({ num }: { num?: string }) {
  const query = useLedgerQuery();
  useQueryErrorToast(query.isError, query.error, 'WORM LEDGER');
  // Task 8-a — source filter: null = ALL SOURCES (default). The unfiltered
  // query above keeps running regardless — it owns the chain badge and the
  // global EVENTS count (chain validity is a whole-chain property, not a
  // per-source one).
  const [filter, setFilter] = useState<string | null>(null);
  // Task 10-a — event-type view filter ('ALL' default). Client-side over the
  // loaded pool; composes with the source filter via AND semantics (both
  // narrow the same pool — no extra fetch, the API has no event dimension).
  const [eventCat, setEventCat] = useState<EventCategory>('ALL');
  const sourceQuery = useLedgerSourceQuery(filter);
  useQueryErrorToast(sourceQuery.isError, sourceQuery.error, 'LEDGER FILTER');
  const sourcePage = sourceQuery.data?.entries ?? [];
  const [verifying, setVerifying] = useState(false);
  const [exporting, setExporting] = useState(false);
  // Task 7-b — running total of events fetched by the multi-page CSV export
  // (drives the "EXPORT 1500…" progress label on the button).
  const [exportCount, setExportCount] = useState(0);
  // Task 7-b — cursor pagination state: appended older pages (newest-first,
  // deduped), in-flight flag and the exhausted flag once a page comes back
  // empty (nothing older than the last loaded seq).
  const [older, setOlder] = useState<LedgerEntry[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);

  const chainOk = query.data?.chainValid ?? null;

  const firstPage = query.data?.entries ?? [];

  // Source-filtered pool = live newest-50 page 1 ∪ appended older pages
  // (unfiltered view). With a source filter active the filtered page joins
  // the pool and the pool is the client-side ∩ filter (see
  // useLedgerSourceQuery note — the API cannot page before+source together).
  // Task 10-a: renamed from `displayed` — SHOW OLDER, seam-heal and genesis
  // detection all operate at POOL level: anchoring the pagination cursor to
  // an event-filtered row would re-fetch already-loaded seqs forever. The
  // event-type filter below is a pure view over this pool.
  const sourcePool = useMemo(() => {
    const pool = older.length === 0 ? firstPage : mergeBySeq(firstPage, older);
    if (filter === null) return pool;
    const withSource = sourcePage.length === 0 ? pool : mergeBySeq(pool, sourcePage);
    return withSource.filter((e) => e.source === filter);
  }, [firstPage, older, filter, sourcePage]);
  const oldestLoadedSeq = sourcePool.length > 0 ? sourcePool[sourcePool.length - 1].seq : null;
  // Task 8-a — a source page shorter than the 500 cap means the server
  // returned EVERY event for that source (newest-first take) → complete view.
  const sourceComplete = filter !== null && sourcePage.length > 0 && sourcePage.length < 500;
  const genesisReached = sourceComplete || exhausted || (oldestLoadedSeq !== null && oldestLoadedSeq <= 1);
  // Task 8-a — distinct sources actually present in the loaded ledger data
  // (page 1 ∪ appended older pages ∪ the filtered page), derived dynamically.
  const sources = useMemo(() => {
    const set = new Set<string>();
    for (const e of firstPage) set.add(e.source);
    for (const e of older) set.add(e.source);
    for (const e of sourcePage) set.add(e.source);
    return [...set].sort();
  }, [firstPage, older, sourcePage]);
  // Task 10-a — displayed view: the event-category chip narrows the pool
  // client-side (AND with the source filter). The lime flash (i === 0 below)
  // stays keyed to the newest row of the active view; appended older rows
  // never occupy index 0.
  const displayed = useMemo(() => {
    if (eventCat === 'ALL') return sourcePool;
    return sourcePool.filter((e) => eventCategory(e.event) === eventCat);
  }, [sourcePool, eventCat]);
  // Task 10-a — per-category counts over the current pool (the rows each
  // chip would display). A zero-count category hides while the source filter
  // is idle (nothing in the loaded pool matches) and stays visible-but-dimmed
  // while the source filter narrows the pool — discoverable, not hidden.
  const catCounts = useMemo(() => {
    const counts: Record<Exclude<EventCategory, 'ALL'>, number> = { FSM: 0, SIM: 0, OPERATOR: 0, MANIFEST: 0, SYSTEM: 0 };
    for (const e of sourcePool) counts[eventCategory(e.event)] += 1;
    return counts;
  }, [sourcePool]);
  // Task 8-a — footer OF-number: global count (no filter) / exact per-source
  // total ("N+" past the 500 cap). The API's count field is always global.
  const footerTotal =
    filter === null
      ? query.data
        ? fmtNum(query.data.count)
        : '—'
      : sourcePage.length === 0
        ? '—'
        : sourcePage.length < 500
          ? fmtNum(sourcePage.length)
          : `${fmtNum(sourcePage.length)}+`;

  // Task 7-b — SHOW OLDER: fetch the 50 entries strictly older than the
  // oldest loaded seq and append them to the pool. Task 8-a: under a source
  // filter this stays an UNFILTERED cursor fetch (the API ignores source
  // when before is present) — the merged rows then flow through the
  // client-side filters in `sourcePool`/`displayed`, so the features
  // compose locally.
  const loadOlder = async () => {
    if (loadingMore || genesisReached || oldestLoadedSeq === null) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/vvu/ledger?limit=50&before=${oldestLoadedSeq}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`WORM LEDGER HTTP ${res.status}`);
      const data = (await res.json()) as LedgerResponse;
      if (data.entries.length === 0) {
        setExhausted(true);
      } else {
        setOlder((prev) => mergeBySeq(prev, data.entries));
      }
    } catch (err) {
      toast.error('LEDGER PAGINATION FAILED', { description: err instanceof Error ? err.message : 'LEDGER UNREACHABLE' });
    } finally {
      setLoadingMore(false);
    }
  };

  // Task 7-b — seam heal: the 15s background refetch slides the newest-50
  // window forward, which would otherwise punch a seq gap between page 1 and
  // the appended pages (an audit table must never skip a seq). When a gap
  // opens, silently re-fetch exactly the missing seq range and merge it in —
  // no extra rows, no state, and it re-runs (converging) if a gap somehow
  // exceeds the API's 500-entry page cap.
  useEffect(() => {
    if (older.length === 0 || firstPage.length === 0) return;
    const firstPageOldest = firstPage[firstPage.length - 1].seq;
    const seam = older[0].seq + 1; // highest seq covered by the appended pages
    const gap = firstPageOldest - seam; // missing entries: [seam, firstPageOldest)
    if (gap <= 0) return; // contiguous — nothing to heal
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/vvu/ledger?limit=${gap}&before=${firstPageOldest}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as LedgerResponse;
        if (!cancelled && data.entries.length > 0) {
          setOlder((prev) => mergeBySeq(prev, data.entries));
        }
      } catch {
        /* transient fetch error — the next 15s poll retries the heal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [firstPage, older]);

  // Task 7-b — full-chain CSV export: page through the ledger with the
  // `before` cursor (500 per page) until a page comes back empty or the oldest
  // seq hits 1 — safety-capped at 40 pages (20k events). The first page's
  // response carries the chain head metadata; the merged set is emitted as
  // one ascending CSV with the same quoting/escaping/stamp/toast as before.
  const exportCsv = async () => {
    setExporting(true);
    setExportCount(0);
    try {
      const all: LedgerEntry[] = [];
      let head: LedgerResponse | null = null;
      let before: number | null = null;
      for (let page = 0; page < 40; page += 1) {
        const url = before === null ? '/api/vvu/ledger?limit=500' : `/api/vvu/ledger?limit=500&before=${before}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`WORM LEDGER HTTP ${res.status}`);
        const data = (await res.json()) as LedgerResponse;
        if (head === null) head = data;
        const entries = data.entries ?? [];
        if (entries.length === 0) break; // genesis page reached — done
        all.push(...entries);
        setExportCount(all.length);
        const oldest = entries[entries.length - 1].seq; // feed is newest-first
        if (oldest <= 1) break;
        before = oldest;
      }
      const rows = [...all].sort((a, b) => a.seq - b.seq);
      const lines = ['seq,timestamp,source,event,details,sha256'];
      for (const e of rows) {
        lines.push(`${e.seq},${e.createdAt},${csvCell(e.source)},${csvCell(e.event)},${csvCell(e.details, true)},${e.hash}`);
      }
      const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vvu-worm-ledger-${csvStamp(new Date())}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`WORM ledger exported — ${rows.length} events · chain ${head?.chainValid ? 'VALID' : 'BROKEN'}`);
    } catch (err) {
      toast.error('CSV EXPORT FAILED', { description: err instanceof Error ? err.message : 'LEDGER UNREACHABLE' });
    } finally {
      setExporting(false);
      setExportCount(0);
    }
  };

  const verifyChain = async () => {
    setVerifying(true);
    try {
      const res = await query.refetch();
      if (res.data) {
        if (res.data.chainValid) {
          toast.success(`CHAIN VALID ✓ · ${res.data.count} EVENTS`, {
            description: `HEAD SHA-256 ${res.data.lastHash?.slice(0, 16) ?? '—'}…`,
          });
        } else {
          toast.error(`CHAIN BROKEN @ SEQ ${res.data.breakAt ?? '—'}`, {
            description: 'WORM integrity violated — re-hash required',
          });
        }
      } else {
        toast.error('VERIFY FAILED', { description: res.error?.message ?? 'LEDGER UNREACHABLE' });
      }
    } finally {
      setVerifying(false);
    }
  };

  const chainBadge =
    chainOk === null ? (
      <Chip tone="dim">CHAIN —</Chip>
    ) : chainOk ? (
      <Chip tone="lime">
        <ShieldCheck className="size-3" aria-hidden /> CHAIN VALID ✓
      </Chip>
    ) : (
      <Chip tone="crimson">
        <ShieldAlert className="size-3" aria-hidden /> CHAIN BROKEN @ {query.data?.breakAt ?? '—'}
      </Chip>
    );

  return (
    <section className="vvu-panel vvu-enter p-4 sm:p-5" aria-label="WORM event ledger">
      <SectionHeader
        num={num}
        title="WORM EVENT LEDGER"
        kicker="SHA-256 HASH-CHAINED · APPEND-ONLY"
        right={
          <>
            {chainBadge}
            <Chip tone="dim">{query.data ? `${query.data.count} EVENTS` : '— EVENTS'}</Chip>
            {/* Task 8-a — source filter: chip-style dropdown matching the button
                row (44px, mono 9px, sage border; lime when open/engaged).
                Radix Select = keyboard operable (Enter/Space opens, ↑/↓ picks,
                Esc closes); ALL SOURCES resets the filter. Options derive from
                the loaded ledger data — never hardcoded. */}
            <Select value={filter ?? 'ALL'} onValueChange={(v) => setFilter(v === 'ALL' ? null : v)}>
              <SelectTrigger
                aria-label="filter ledger by source"
                className={cn(
                  'vvu6c-btn h-auto min-h-[44px] vvu-label text-[9px] font-bold border-[#8fb35a]/50 text-[#8fb35a] hover:bg-[#8fb35a]/10 hover:text-[#c9d4bd] hover:border-[#8fb35a] gap-1.5 px-3 max-w-[210px]',
                  'data-[state=open]:text-[#c8ff00] data-[state=open]:border-[#c8ff00]/60',
                  filter !== null && 'text-[#c8ff00] border-[#c8ff00]/50'
                )}
              >
                <Filter className="size-3.5 shrink-0" aria-hidden />
                <SelectValue placeholder="ALL SOURCES" />
              </SelectTrigger>
              <SelectContent className="border-[rgba(107,138,64,0.4)] shadow-lg">
                <SelectItem value="ALL" className="vvu-label text-[10px] py-2 text-[#c9d4bd]">
                  ALL SOURCES
                </SelectItem>
                {sources.length > 0 && <SelectSeparator className="bg-[rgba(107,138,64,0.25)]" />}
                {sources.map((s) => (
                  <SelectItem key={s} value={s} className="vvu-label text-[10px] py-2 text-[#c9d4bd]">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void exportCsv()}
              disabled={exporting}
              className="vvu6c-btn min-h-[44px] vvu-label text-[9px] font-bold border-[#8fb35a]/50 text-[#8fb35a] hover:bg-[#8fb35a]/10 hover:text-[#c9d4bd] hover:border-[#8fb35a]"
              aria-label="export the full WORM ledger as CSV"
            >
              {exporting ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Download className="size-3.5" aria-hidden />
              )}
              {/* Task 7-b: multi-page fetch progress — "EXPORT 1500…" chip text */}
              <span className="hidden sm:inline">
                {exporting && exportCount > 0 ? `EXPORT ${fmtNum(exportCount)}…` : 'EXPORT CSV'}
              </span>
              <span className="sm:hidden">{exporting && exportCount > 0 ? `${fmtNum(exportCount)}…` : 'CSV'}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void verifyChain()}
              disabled={verifying}
              className="vvu6c-btn min-h-[44px] vvu-label text-[9px] font-bold border-[#8fb35a]/50 text-[#8fb35a] hover:bg-[#8fb35a]/10 hover:text-[#8fb35a] hover:border-[#8fb35a]"
              aria-label="verify WORM chain integrity"
            >
              {verifying ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <ShieldCheck className="size-3.5" aria-hidden />}
              VERIFY
            </Button>
          </>
        }
      />

      {/* Task 10-a — event-type chip row: second filter dimension over source
          (AND semantics — both narrow the same client-side pool). Fixed label
          set, availability derived from the loaded pool: a zero-count category
          hides while the source filter is idle, stays dimmed 45% while it is
          active. One non-wrapping row — horizontal scroll on narrow
          viewports, scrollbar hidden (project utility pattern). */}
      <div className="mb-3 flex items-center gap-2" role="group" aria-label="filter ledger by event type">
        <ListFilter className="size-3.5 shrink-0 text-[#7a8a6e]" aria-hidden />
        <span className="vvu-label text-[9px] font-bold text-[#7a8a6e] shrink-0" aria-hidden>
          TYPE
        </span>
        <div
          className={cn(
            'flex items-center gap-1.5 overflow-x-auto min-w-0',
            // hidden scrollbar — the ! flags + inline style are needed because
            // globals.css sets *{scrollbar-width:thin} / *::-webkit-scrollbar
            // UNLAYERED, which beats Tailwind's @layer utilities in the
            // cascade (and lightningcss drops -ms-overflow-style entirely).
            '[&::-webkit-scrollbar]:hidden! [scrollbar-width:none!] [-ms-overflow-style:none]'
          )}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <EventCatChip cat="ALL" active={eventCat === 'ALL'} dimmed={false} onClick={() => setEventCat('ALL')} />
          {EVENT_CATEGORIES.map((cat) => {
            // hide: zero rows in the pool AND no other filter narrowing it —
            // the selected chip always stays visible regardless.
            if (catCounts[cat] === 0 && filter === null && eventCat !== cat) return null;
            return (
              <EventCatChip
                key={cat}
                cat={cat}
                active={eventCat === cat}
                dimmed={catCounts[cat] === 0}
                onClick={() => setEventCat(cat)}
              />
            );
          })}
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto overflow-x-auto -mx-1 px-1 rounded" aria-label="WORM ledger entries, newest first">
        {query.isPending ? (
          <LedgerSkeleton />
        ) : query.isError ? (
          <QueryErrorCard label="WORM LEDGER" onRetry={() => void query.refetch()} />
        ) : filter !== null && sourceQuery.isPending ? (
          // Task 8-a — filtered page loading: brief skeleton instead of a
          // half-filled table (rows would shift as the filtered page lands).
          <LedgerSkeleton />
        ) : filter !== null && sourceQuery.isError ? (
          <QueryErrorCard label="LEDGER FILTER" onRetry={() => void sourceQuery.refetch()} />
        ) : query.data && displayed.length > 0 ? (
          <>
            <Table className="text-[10px]">
              <TableHeader className="sticky top-0 z-10 bg-[#0b0f0a]">
                <TableRow className="border-[rgba(107,138,64,0.25)] hover:bg-transparent">
                  <TableHead className="vvu-label text-[9px] text-[#7a8a6e] py-2 w-12">SEQ</TableHead>
                  <TableHead className="vvu-label text-[9px] text-[#7a8a6e] py-2">SOURCE</TableHead>
                  <TableHead className="vvu-label text-[9px] text-[#7a8a6e] py-2">EVENT</TableHead>
                  <TableHead className="vvu-label text-[9px] text-[#7a8a6e] py-2">DETAILS</TableHead>
                  <TableHead className="vvu-label text-[9px] text-[#7a8a6e] py-2">SHA-256</TableHead>
                  <TableHead className="vvu-label text-[9px] text-[#7a8a6e] py-2 w-[80px]">TIME</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayed.map((entry, i) => (
                  <TableRow
                    key={entry.id}
                    className={cn(
                      'border-[rgba(107,138,64,0.12)] hover:bg-[rgba(107,138,64,0.09)]',
                      i % 2 === 1 && 'bg-[rgba(107,138,64,0.05)]',
                      // Task 6-c: newest row gets a 2s lime left-edge fade —
                      // row is keyed by id, so a fresh event remounts row 0 and
                      // the CSS animation replays without any state/effects.
                      // Task 7-b/8-a: i === 0 is always the newest row of the
                      // active view (page 1 or the filtered page) — appended
                      // older rows never occupy index 0.
                      i === 0 && 'vvu6c-row-flash-2s'
                    )}
                  >
                    <TableCell className={cn('py-1.5 text-[#7a8a6e] tabular-nums', i === 0 && 'vvu6c-edge-flash')}>{entry.seq}</TableCell>
                    <TableCell className="py-1.5">
                      <span className={`vvu-label text-[8px] px-1.5 py-0.5 rounded border whitespace-nowrap ${sourceClass(entry.source)}`}>
                        {entry.source}
                      </span>
                    </TableCell>
                    <TableCell className="py-1.5 text-[#c9d4bd] whitespace-nowrap">
                      {/* Task 16-a — toned events (THEME_TOGGLE) render as a
                          chip; all other events keep the plain historical
                          text cell (dark output unchanged). */}
                      {eventClass(entry.event) ? (
                        <span
                          className={`vvu-label text-[8px] px-1.5 py-0.5 rounded border whitespace-nowrap ${eventClass(entry.event)}`}
                        >
                          {entry.event}
                        </span>
                      ) : (
                        entry.event
                      )}
                    </TableCell>
                    <TableCell className="py-1.5 text-[#7a8a6e] max-w-[300px] truncate" title={entry.details ?? undefined}>
                      {entry.details ?? '—'}
                    </TableCell>
                    <TableCell className="py-1.5 text-[#7a8a6e] tabular-nums">{entry.hash.slice(0, 12)}…</TableCell>
                    <TableCell className="py-1.5 text-[#7a8a6e] tabular-nums">{fmtTime(entry.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Task 7-b — cursor pagination footer: bottom of the scroll area,
                sticky so it stays in view while auditing rows. Task 8-a: with a
                source filter the OF-number is the per-source total and the
                chain badge above stays unfiltered (whole-chain property). */}
            <div className="sticky bottom-0 z-10 bg-[#0b0f0a] border-t border-[rgba(107,138,64,0.25)] pt-2.5 pb-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
              <span className="vvu-label text-[9px] text-[#7a8a6e] whitespace-nowrap">
                {eventCat !== 'ALL' ? (
                  // Task 10-a — honest filtered counter, compact (≤40 chars):
                  // rows of the selected category shown · rows in the loaded
                  // pool · total of the current scope (global, or the source
                  // total the source filter already selected).
                  <>
                    {fmtNum(displayed.length)} {eventCat} · {fmtNum(sourcePool.length)} LOADED · {footerTotal}{' '}
                    {filter !== null ? filter : 'TOTAL'}
                  </>
                ) : (
                  <>
                    SHOWING {fmtNum(displayed.length)} OF {footerTotal}
                    {filter !== null ? ` ${filter}` : ''} EVENTS
                  </>
                )}
              </span>
              {genesisReached ? (
                <span
                  title={
                    sourceComplete
                      ? `all ${footerTotal} ${filter} events are already visible`
                      : 'oldest ledger entry (seq 1) is already visible'
                  }
                >
                  <Chip tone="dim">GENESIS REACHED</Chip>
                </span>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void loadOlder()}
                  disabled={loadingMore}
                  className="vvu6c-btn min-h-[44px] vvu-label text-[9px] font-bold border-[#8fb35a]/50 text-[#8fb35a] hover:bg-[#8fb35a]/10 hover:text-[#c9d4bd] hover:border-[#8fb35a]"
                  aria-label={`load 50 older WORM ledger events, currently showing ${displayed.length} of ${footerTotal}`}
                >
                  {loadingMore ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <ChevronsDown className="size-3.5" aria-hidden />}
                  SHOW OLDER
                </Button>
              )}
            </div>
          </>
        ) : filter !== null && sourcePool.length === 0 ? (
          <div className="vvu-label text-[10px] text-[#7a8a6e] p-4 text-center">NO {filter} EVENTS IN LOADED LEDGER · SELECT ALL SOURCES</div>
        ) : eventCat !== 'ALL' ? (
          // Task 10-a — the event filter matched nothing in the (source-
          // filtered) pool: name the dimension that zeroed the view so the
          // empty state never lies about which filter matched 0 rows.
          <div className="vvu-label text-[10px] text-[#7a8a6e] p-4 text-center">
            NO {eventCat} EVENTS IN LOADED{filter !== null ? ` ${filter}` : ''} POOL · SELECT ALL TYPES
          </div>
        ) : (
          <div className="vvu-label text-[10px] text-[#7a8a6e] p-4 text-center">LEDGER EMPTY · SEEDING MANIFEST…</div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-[rgba(107,138,64,0.25)] flex flex-wrap items-center gap-2">
        <Chip tone="sage">19 MASTER ASSET HASHES</Chip>
        <span className="vvu-label text-[9px] text-[#7a8a6e]">
          Seeded with the release manifest · Design Freeze Level 1 · no edits without re-hash
        </span>
      </div>
    </section>
  );
}

export default WormLedger;
