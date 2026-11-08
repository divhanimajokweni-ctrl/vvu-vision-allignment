'use client';

// src/components/terminal/TerminalWorkspace.tsx — Task 41 · #/terminal
// TERMINAL · COMMAND CONSOLE — a REAL console, honestly scoped:
//
//   * Pure CLIENT-side command parser over whitelisted read-only endpoints
//     (/api/watchdog · /api/integrity · /api/{bridge,field}/receipts).
//   * NO shell execution, no server exec — the banner says so.
//   * Command history (↑/↓, last 50, memory only) · ESC blurs · CTRL+L clears.
//   * Async commands print a dim `…` pending line, replaced by the result
//     (or a red line carrying the REAL fetch error). In-flight fetches are
//     aborted on unmount.
//   * No autofocus on touch-like devices (coarse pointer / visualViewport
//     heuristic) — desktop only, so the mobile keyboard never jumps up.
//
// Style: instrument console — near-black, monospace everything, lime prompt.

import { useEffect, useRef, useState } from 'react';
import { useHashRoute, type VvuView } from '@/hooks/use-hash-route';
import keyboardMap from '../../../public/keyboard-map.json';

// ── API contracts (proxies only, relative paths) ─────────────────────────────

interface WatchdogRail {
  id: string;
  label: string;
  port: number;
  ok: boolean;
  latencyMs: number;
  error?: string;
}

interface WatchdogResponse {
  checkedAt: string;
  ok: boolean;
  rails: WatchdogRail[];
}

interface IntegrityResponse {
  match: boolean;
  compiledAt: string;
  uptimeSec: number;
  watchedFiles?: string[];
}

interface ReceiptItem {
  seq: number;
  ts: string;
  actor: string;
  op: string;
  target?: string;
  ok: boolean;
  hash: string;
  tier?: string;
}

interface ReceiptsResponse {
  count: number;
  receipts: ReceiptItem[];
}

interface VerifyResponse {
  valid: boolean;
  checked: number;
  firstBadIndex?: number;
  error?: string;
}

// ── view names (`open` accepts all twenty-four) + the keyboard map ──────────

const VIEW_NAMES: readonly VvuView[] = [
  'spatial', 'analytics', 'outreach', 'holocom', 'capability', 'metro', 'urllc',
  'fieldkit', 'support', 'commercial', 'manifest', 'twin', 'wildfire', 'mesh',
  'bridge', 'field', 'terminal', 'watchdog', 'receipts', 'settings', 'pools',
  'docs', 'ops', 'sphere',
];

/* Task 47 — keyboard-map.json is the single source of truth; the terminal's
   `tabs` command reads the SAME file the vanilla layer fetches. */
const MAP = keyboardMap as {
  version: number;
  tabs: { key: string; route: string; label: string; teach: string }[];
  actions: { key: string; action: string; teach: string }[];
  chords: { from: string; to: string; route: string }[];
};

// ── line model ───────────────────────────────────────────────────────────────

type LineKind = 'banner' | 'echo' | 'out' | 'ok' | 'err' | 'dim' | 'warn';

interface Line {
  id: number;
  kind: LineKind;
  text: string;
}

const LINE_CLASS: Record<LineKind, string> = {
  banner: 'text-[#7a8a6e]',
  echo: 'text-[#d7e2c9]',
  out: 'text-[#d7e2c9]',
  ok: 'text-[#c8ff00]',
  err: 'text-[#e5484d]',
  dim: 'text-[#7a8a6e]',
  warn: 'text-[#e0a030]',
};

const MAX_LINES = 600;

const BOOT: { kind: LineKind; text: string }[] = [
  { kind: 'ok', text: 'VVU FIELD CONSOLE · prototype over live rails · no shell execution' },
  { kind: 'dim', text: 'rails: :3003 telemetry · :3004 vault-bridge · :3005 field-onboard' },
  { kind: 'dim', text: 'type help for commands · CTRL+L clears' },
];

// ── fetch helper (timeout + shared aborter set) ─────────────────────────────

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// ── component ───────────────────────────────────────────────────────────────

export function TerminalWorkspace() {
  const [view, setView] = useHashRoute();
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState('');
  const [histIdx, setHistIdx] = useState<number | null>(null);

  const idRef = useRef(0);
  const historyRef = useRef<string[]>([]);
  const logRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortersRef = useRef<Set<AbortController>>(new Set());

  function nextId(): number {
    idRef.current += 1;
    return idRef.current;
  }

  function append(kind: LineKind, text: string): Line {
    const line: Line = { id: nextId(), kind, text };
    setLines((prev) => [...prev, line].slice(-MAX_LINES));
    return line;
  }

  function appendMany(entries: { kind: LineKind; text: string }[]): Line[] {
    const made: Line[] = entries.map((e) => ({ id: nextId(), ...e }));
    setLines((prev) => [...prev, ...made].slice(-MAX_LINES));
    return made;
  }

  /** Replace a pending `…` line with the result lines (keeps position). */
  function replaceLine(id: number, entries: { kind: LineKind; text: string }[]) {
    const made: Line[] = entries.map((e) => ({ id: nextId(), ...e }));
    setLines((prev) => {
      const i = prev.findIndex((l) => l.id === id);
      if (i < 0) return [...prev, ...made].slice(-MAX_LINES);
      return [...prev.slice(0, i), ...made, ...prev.slice(i + 1)].slice(-MAX_LINES);
    });
  }

  function makeAborter(): AbortController {
    const ac = new AbortController();
    abortersRef.current.add(ac);
    return ac;
  }

  async function fetchJson<T>(url: string, ac: AbortController, timeoutMs = 6000): Promise<T> {
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, { cache: 'no-store', signal: ac.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  // ── boot banner (once) ──
  useEffect(() => {
    appendMany(BOOT);
  }, []);

  // ── abort in-flight fetches on unmount ──
  useEffect(() => {
    const stash = abortersRef.current;
    return () => {
      for (const ac of stash) ac.abort();
      stash.clear();
    };
  }, []);

  // ── auto-scroll to the newest line ──
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  // ── desktop-only autofocus (skip touch-like devices) ──
  useEffect(() => {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const vv = window.visualViewport;
    const viewportJump = !!vv && vv.width < window.innerWidth - 1; // mobile URL-bar heuristic
    if (!coarse && !viewportJump && !('ontouchstart' in window)) {
      inputRef.current?.focus();
    }
  }, []);

  // ── helpers ──

  function fmtHash(h: string | undefined): string {
    return h ? `${h.slice(0, 12)}…` : '—';
  }

  function parseReceiptCount(rest: string[]): number | null {
    if (rest.length === 0) return 5;
    if (rest.length > 1 || !/^\d+$/.test(rest[0])) return null;
    const n = Number(rest[0]);
    if (n < 1 || n > 100) return null;
    return n;
  }

  // ── command execution ──

  async function run(raw: string) {
    const trimmed = raw.trim();
    const parts = trimmed.split(/\s+/);
    const cmd = (parts[0] ?? '').toLowerCase();
    const rest = parts.slice(1);

    switch (cmd) {
      case 'help': {
        appendMany([
          { kind: 'out', text: 'commands:' },
          { kind: 'dim', text: '  help            this list' },
          { kind: 'dim', text: '  clear           clear the output (CTRL+L)' },
          { kind: 'dim', text: '  tabs            list the 10 numbered tabs (keyboard map)' },
          { kind: 'dim', text: '  open <n|name>   switch view (1-0, view name, or spec route)' },
          { kind: 'dim', text: '  status          rail health via /api/watchdog (live probe)' },
          { kind: 'dim', text: '  integrity       self-integrity of the :3000 surface' },
          { kind: 'dim', text: '  receipts [n]    last n bridge receipts (default 5)' },
          { kind: 'dim', text: '  verify          recompute both receipt chains from genesis' },
          { kind: 'dim', text: '  lindiwe         tutor memory snapshot (alias: tutor)' },
          { kind: 'dim', text: '  lindiwe reset   clear tutor memory (teaching restarts)' },
          { kind: 'dim', text: '  whoami          operator context (client-side only)' },
          { kind: 'dim', text: '  version         honest static facts about this surface' },
        ]);
        return;
      }
      case 'clear': {
        setLines([]);
        return;
      }
      case 'tabs': {
        appendMany(
          MAP.tabs.map((t) => ({
            kind: 'out' as LineKind,
            text: `  ${t.key.replace('ctrl+', '').padEnd(2, ' ')}  ${t.label.padEnd(16, ' ')} ${t.route}  — ${t.teach}`,
          })),
        );
        return;
      }
      case 'open': {
        if (rest.length !== 1) {
          append('err', 'usage: open <1-0 | view name> — try tabs');
          return;
        }
        const arg = rest[0].toLowerCase();
        const tab = MAP.tabs.find((t) => t.key === `ctrl+${arg}`);
        if (tab) {
          window.location.hash = tab.route;
          append('ok', `→ switched to ${tab.route} (${tab.label})`);
          return;
        }
        if ((VIEW_NAMES as readonly string[]).includes(arg)) {
          setView(arg as VvuView);
          append('ok', `→ switched to ${arg}`);
          return;
        }
        append('err', `unknown view: ${rest[0]} — try tabs`);
        return;
      }
      case 'status': {
        const pending = append('dim', '…');
        const ac = makeAborter();
        try {
          const data = await fetchJson<WatchdogResponse>('/api/watchdog', ac);
          const out: { kind: LineKind; text: string }[] = [
            { kind: 'dim', text: `checked at ${data.checkedAt}` },
          ];
          for (const r of data.rails) {
            out.push(
              r.ok
                ? { kind: 'ok', text: `  ${r.id.padEnd(10, ' ')} :${r.port} · OK · ${r.latencyMs}ms` }
                : { kind: 'err', text: `  ${r.id.padEnd(10, ' ')} :${r.port} · DOWN · ${r.error ?? 'unreachable'}` },
            );
          }
          out.push(data.ok ? { kind: 'ok', text: 'all rails up' } : { kind: 'err', text: 'one or more rails DOWN' });
          replaceLine(pending.id, out);
        } catch (e) {
          replaceLine(pending.id, [{ kind: 'err', text: `status failed — ${errMsg(e)}` }]);
        } finally {
          abortersRef.current.delete(ac);
        }
        return;
      }
      case 'integrity': {
        const pending = append('dim', '…');
        const ac = makeAborter();
        try {
          const data = await fetchJson<IntegrityResponse>('/api/integrity', ac);
          const out: { kind: LineKind; text: string }[] = [
            { kind: data.match ? 'ok' : 'err', text: `match: ${String(data.match)}` },
            { kind: 'dim', text: `compiledAt ${data.compiledAt} · uptime ${data.uptimeSec}s · watched ${data.watchedFiles?.length ?? '?'} files` },
          ];
          if (!data.match) {
            out.push({ kind: 'err', text: 'STALE MODULE — running surface differs from disk' });
          }
          replaceLine(pending.id, out);
        } catch (e) {
          replaceLine(pending.id, [{ kind: 'err', text: `integrity failed — ${errMsg(e)}` }]);
        } finally {
          abortersRef.current.delete(ac);
        }
        return;
      }
      case 'receipts': {
        const n = parseReceiptCount(rest);
        if (n === null) {
          append('err', 'usage: receipts [n] — n between 1 and 100');
          return;
        }
        const pending = append('dim', '…');
        const ac = makeAborter();
        try {
          const data = await fetchJson<ReceiptsResponse>('/api/bridge/receipts', ac);
          const tail = data.receipts.slice(-n);
          const out: { kind: LineKind; text: string }[] = [
            { kind: 'dim', text: `bridge :3004 · chain count ${data.count} · showing last ${tail.length}` },
          ];
          for (const r of tail) {
            out.push({
              kind: r.ok ? 'out' : 'err',
              text: `  #${String(r.seq).padEnd(4, ' ')} ${r.actor} · ${r.op} · ${fmtHash(r.hash)}${r.ok ? '' : ' · FAILED'}`,
            });
          }
          replaceLine(pending.id, out);
        } catch (e) {
          replaceLine(pending.id, [{ kind: 'err', text: `receipts failed — ${errMsg(e)}` }]);
        } finally {
          abortersRef.current.delete(ac);
        }
        return;
      }
      case 'verify': {
        const pending = append('dim', '…');
        const ac = makeAborter();
        try {
          const bridge = await fetchJson<VerifyResponse>('/api/bridge/receipts?verify=1', ac);
          const field = await fetchJson<VerifyResponse>('/api/field/receipts?verify=1', ac);
          const out: { kind: LineKind; text: string }[] = [
            bridge.valid
              ? { kind: 'ok', text: `bridge :3004 · CHAIN VALID · checked ${bridge.checked} from genesis` }
              : { kind: 'err', text: `bridge :3004 · CHAIN BROKEN · first bad index ${bridge.firstBadIndex ?? '?'} · checked ${bridge.checked}` },
            field.valid
              ? { kind: 'ok', text: `field  :3005 · CHAIN VALID · checked ${field.checked} from genesis` }
              : { kind: 'err', text: `field  :3005 · CHAIN BROKEN · first bad index ${field.firstBadIndex ?? '?'} · checked ${field.checked}` },
          ];
          replaceLine(pending.id, out);
        } catch (e) {
          replaceLine(pending.id, [{ kind: 'err', text: `verify failed — ${errMsg(e)}` }]);
        } finally {
          abortersRef.current.delete(ac);
        }
        return;
      }
      case 'tutor':
      case 'lindiwe': {
        const L = (window as unknown as {
          Lindiwe?: {
            snapshot: () => { shortcuts: Record<string, { uses: number; last_used: number; mastered: boolean }>; last_active: number };
            reset: () => void;
          };
        }).Lindiwe;
        if (rest[0]?.toLowerCase() === 'reset') {
          if (!L) { append('err', 'lindiwe not loaded'); return; }
          L.reset();
          append('ok', 'lindiwe memory cleared — teaching restarts from zero');
          return;
        }
        if (rest.length > 0) {
          append('err', 'usage: lindiwe [reset]');
          return;
        }
        if (!L) { append('err', 'lindiwe not loaded (lindiwe.js)'); return; }
        const snap = L.snapshot();
        const out: { kind: LineKind; text: string }[] = [
          { kind: 'dim', text: `lindiwe · mastery = 3 uses, then silence · ${Object.keys(snap.shortcuts).length} bindings with state` },
        ];
        MAP.tabs.forEach((t) => {
          const e = snap.shortcuts[t.key];
          out.push({
            kind: 'out',
            text: `  ${t.key.padEnd(12, ' ')} ${t.label.padEnd(16, ' ')} ${e?.mastered ? 'MASTERED ' : (e?.uses ?? 0) > 0 ? 'LEARNING ' : 'UNSEEN   '} uses ${e?.uses ?? 0}`,
          });
        });
        appendMany(out);
        return;
      }
      case 'whoami': {
        const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
        const vw = typeof window !== 'undefined' ? `${window.innerWidth}×${window.innerHeight}` : 'unknown';
        const keys =
          typeof window !== 'undefined' && window.localStorage
            ? (['vvu.tutor.v1', 'vvu_events'] as const).map(
                (k) => `  ${k.padEnd(16, ' ')} ${window.localStorage.getItem(k) === null ? 'absent' : 'present'}`,
              )
            : ['  localStorage unavailable'];
        appendMany([
          { kind: 'dim', text: `platform: ${ua.slice(0, 72)}` },
          { kind: 'dim', text: `viewport: ${vw}` },
          { kind: 'dim', text: 'localStorage keys in use:' },
          ...keys.map((k) => ({ kind: 'out' as LineKind, text: k })),
        ]);
        return;
      }
      case 'version': {
        appendMany([
          { kind: 'out', text: 'app: VVU Validation Dashboard' },
          { kind: 'dim', text: 'surface: single-route Next.js app · 15 views hash-projected' },
          { kind: 'dim', text: 'receipt chains: SHA-256 hash-chained, genesis-verified' },
          { kind: 'warn', text: 'anchor: STUB (self-declaring)' },
        ]);
        return;
      }
      default:
        append('err', `unknown command: ${cmd} — try help`);
        return;
    }
  }

  // ── input handling ──

  function submit() {
    const raw = input;
    const trimmed = raw.trim();
    append('echo', `vvu:/${view}$ ${raw}`);
    setInput('');
    if (!trimmed) return; // empty input → no-op beyond the echoed prompt line
    const hist = historyRef.current;
    if (hist[hist.length - 1] !== trimmed) {
      hist.push(trimmed);
      if (hist.length > 50) hist.shift();
    }
    setHistIdx(null);
    void run(trimmed);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      e.currentTarget.blur();
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      if (e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setLines([]);
        /* count the use for Lindiwe (no teach — the console's own banner
           already says CTRL+L clears) */
        (window as unknown as { Lindiwe?: { markUsed: (k: string, t: string | null) => void } }).Lindiwe?.markUsed('ctrl-l', null);
      }
      return;
    }
    const hist = historyRef.current;
    if (e.key === 'ArrowUp' && hist.length > 0) {
      e.preventDefault();
      const next = histIdx === null ? hist.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(next);
      setInput(hist[next]);
      return;
    }
    if (e.key === 'ArrowDown') {
      if (histIdx === null) return;
      e.preventDefault();
      const next = histIdx + 1;
      if (next >= hist.length) {
        setHistIdx(null);
        setInput('');
      } else {
        setHistIdx(next);
        setInput(hist[next]);
      }
    }
  }

  // ── render ──

  return (
    <div className="absolute inset-0 flex flex-col bg-[#060806]" role="region" aria-label="Terminal command console">
      {/* title block */}
      <header className="shrink-0 border-b border-[rgba(107,138,64,0.22)] bg-[rgba(6,8,6,0.55)] px-3 sm:px-5 py-2.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-block size-1.5 bg-[#c8ff00]" aria-hidden />
          <h1 className="vvu-label text-[10px] sm:text-xs font-bold text-[#f3e38a] tracking-[0.22em]">
            TERMINAL · COMMAND CONSOLE
          </h1>
        </div>
        <p className="vvu-label text-[8px] text-[#7a8a6e] mt-1">
          prototype over live rails · no shell execution · client-side parser only
        </p>
      </header>

      {/* output log */}
      <div
        ref={logRef}
        role="log"
        aria-label="Terminal output"
        aria-live="polite"
        className="flex-1 min-h-0 overflow-y-auto font-mono text-[10px] sm:text-[11px] leading-relaxed px-3 sm:px-5 py-3 space-y-0.5"
      >
        {lines.map((l) => (
          <div key={l.id} className={`whitespace-pre-wrap break-all ${LINE_CLASS[l.kind]}`}>
            {l.text || '\u00A0'}
          </div>
        ))}
        {/* keeps the last line clear of the input row */}
        <div aria-hidden className="h-1" />
      </div>

      {/* input line */}
      <form
        className="shrink-0 border-t border-[rgba(107,138,64,0.22)] bg-[rgba(11,15,10,0.92)]"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="flex items-center gap-2 px-3 sm:px-5 py-2 min-h-[44px]">
          <label
            htmlFor="terminal-input"
            className="font-mono text-[10px] sm:text-[11px] text-[#c8ff00] shrink-0 select-none"
          >
            vvu:/{view}$
          </label>
          <input
            id="terminal-input"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Terminal command input"
            placeholder="type a command — try help"
            className="flex-1 min-w-0 bg-transparent border-0 outline-none font-mono text-[10px] sm:text-[11px] text-[#d7e2c9] placeholder:text-[#7a8a6e]/60 focus-visible:ring-1 focus-visible:ring-[#c8ff00]/50"
          />
          <span aria-hidden className="vvu-blink font-mono text-[#c8ff00] text-[11px] hidden sm:inline">
            ▍
          </span>
        </div>
      </form>
    </div>
  );
}
