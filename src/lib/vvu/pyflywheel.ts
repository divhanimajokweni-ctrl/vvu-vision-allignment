// src/lib/vvu/pyflywheel.ts — pure server-side reader for the Python
// flywheel core (vvu-trust/runner/vvu_runner.py). It never executes the
// runner — it only reads the live artifacts the runner leaves on disk:
//
//   /tmp/flywheel_icsh/ledger.jsonl   one JSON line per cycle (ledger as storage)
//   /tmp/flywheel_icsh/seed.bin       the 32-byte seed (must stay 32)
//   /tmp/flywheel_icsh/peers.json     the 25-peer roster
//   ~/Documents/Proofbridge-Brain/Watchdog/cycle_XXXXX.md   vault notes
//   ~/.vvu/chains/installer.json      signed installer chain (JSONL)
//   <root>/vvu-trust/chains/receipt.json   install receipt (T0)
//
// Every reader degrades to { exists: false, … } — none of them throws.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/** The 11 beats, in execution order (WIPE appears twice, as shipped). */
export const PY_BEATS = [
  'LOG',
  'SYNC',
  'WIPE',
  'COMPARE',
  'INGEST',
  'INFER',
  'MINT',
  'SHIP',
  'WIPE',
  'RETRIEVE',
  'WATCHDOG',
] as const;

// ── paths ────────────────────────────────────────────────────────────────────

const FLYWHEEL_DIR = '/tmp/flywheel_icsh';
const LEDGER_PATH = path.join(FLYWHEEL_DIR, 'ledger.jsonl');
const SEED_PATH = path.join(FLYWHEEL_DIR, 'seed.bin');
const PEERS_PATH = path.join(FLYWHEEL_DIR, 'peers.json');
const VAULT_DIR = path.join(os.homedir(), 'Documents', 'Proofbridge-Brain', 'Watchdog');
const CHAIN_PATH = path.join(os.homedir(), '.vvu', 'chains', 'installer.json');

/** receipt.json lives inside the repo tree — resolve via cwd, absolute fallback. */
function receiptPath(): string {
  const rel = path.join(process.cwd(), 'vvu-trust', 'chains', 'receipt.json');
  try {
    if (fs.existsSync(rel)) return rel;
  } catch {
    /* ignore */
  }
  return '/home/z/my-project/vvu-trust/chains/receipt.json';
}

// ── types ────────────────────────────────────────────────────────────────────

/** One ledger.jsonl line — exactly the schema the Python harness ships. */
export interface PyLedgerLine {
  cycle: number;
  ts: number;
  seed_head: string;
  network_head: string;
  mint_head: string;
  agreement: boolean;
  peers_reachable: number;
  bucket: number;
  beats: number;
  vault_count: number;
  ms: number;
}

export interface PyLedgerStatus {
  exists: boolean;
  lines: number;
  bytes: number;
  /** mean bytes per ledger line over the parsed window (measured, honest). */
  meanLineBytes: number | null;
  /** oldest → newest parsed lines (max maxLines). */
  history: PyLedgerLine[];
  last: PyLedgerLine | null;
}

export interface PySeedStatus {
  exists: boolean;
  bytes: number;
}

export interface PyPeersStatus {
  exists: boolean;
  count: number;
  first: string | null;
}

export interface PyVaultStatus {
  exists: boolean;
  count: number;
  last: string | null;
  dir: string;
}

export interface PyChainStatus {
  exists: boolean;
  entries: number;
  head: string | null;
  lastEntry: { name: string; ts: number } | null;
}

export interface PyReceiptStatus {
  exists: boolean;
  receipt: string | null;
  tier: string | null;
  steps: number;
  n_probes_changed: number | null;
  before_head: string | null;
  after_head: string | null;
  /** the four literal before-probe states, verbatim from the receipt. */
  probes: Record<string, string> | null;
}

export interface PyFlywheelStatus {
  ok: true;
  at: string;
  beats: string[];
  ledger: PyLedgerStatus;
  seed: PySeedStatus;
  peers: PyPeersStatus;
  vault: PyVaultStatus;
  chain: PyChainStatus;
  receipt: PyReceiptStatus;
}

// ── helpers ──────────────────────────────────────────────────────────────────

const WINDOW_BYTES = 64 * 1024;
const WHOLE_FILE_LIMIT = 2 * 1024 * 1024; // count ALL lines only below 2 MB

/**
 * Read the last `windowBytes` of a file as text. When the file is smaller,
 * reads it whole. Returns null when the file is missing/unreadable.
 * A window starting mid-line drops its leading partial fragment.
 */
function readTail(file: string, windowBytes = WINDOW_BYTES): {
  text: string;
  bytes: number;
  windowed: boolean;
} | null {
  let fd: number | undefined;
  try {
    fd = fs.openSync(file, 'r');
    const st = fs.fstatSync(fd);
    if (!st.isFile()) return null;
    const bytes = st.size;
    const windowed = bytes > windowBytes;
    const length = windowed ? windowBytes : bytes;
    const position = windowed ? bytes - windowBytes : 0;
    const buf = Buffer.alloc(length);
    const read = fs.readSync(fd, buf, 0, length, position);
    let text = buf.subarray(0, read).toString('utf8');
    if (windowed) {
      // drop the (usually partial) first fragment so only whole lines remain
      const nl = text.indexOf('\n');
      text = nl >= 0 ? text.slice(nl + 1) : '';
    }
    return { text, bytes, windowed };
  } catch {
    return null;
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {
        /* ignore */
      }
    }
  }
}

/** Non-empty lines of a text blob, in order. */
function contentLines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function safeParse<T>(line: string): T | null {
  try {
    return JSON.parse(line) as T;
  } catch {
    return null;
  }
}

function statBytes(file: string): number | null {
  try {
    return fs.statSync(file).size;
  } catch {
    return null;
  }
}

// ── readers ──────────────────────────────────────────────────────────────────

const LEDGER_EMPTY: PyLedgerStatus = {
  exists: false,
  lines: 0,
  bytes: 0,
  meanLineBytes: null,
  history: [],
  last: null,
};

/** Tail of the flywheel ledger (JSONL). Whole-file line count under 2 MB. */
export function readLedgerTail(maxLines = 64): PyLedgerStatus {
  try {
    // cheap full read for the true line count while the file is small
    const size = statBytes(LEDGER_PATH);
    if (size !== null && size < WHOLE_FILE_LIMIT) {
      const whole = fs.readFileSync(LEDGER_PATH, 'utf8');
      const bytes = Buffer.byteLength(whole, 'utf8');
      const lines = contentLines(whole);
      const parsed = lines
        .map((l) => safeParse<PyLedgerLine>(l))
        .filter((l): l is PyLedgerLine => l !== null);
      const history = parsed.slice(-maxLines);
      return {
        exists: true,
        lines: lines.length,
        bytes,
        meanLineBytes: lines.length > 0 ? Math.round(bytes / lines.length) : null,
        history,
        last: history.length > 0 ? history[history.length - 1] : null,
      };
    }
    // big (or missing) file: honest window only
    const tail = readTail(LEDGER_PATH);
    if (!tail) return { ...LEDGER_EMPTY };
    const lines = contentLines(tail.text);
    const parsed = lines
      .map((l) => safeParse<PyLedgerLine>(l))
      .filter((l): l is PyLedgerLine => l !== null);
    const history = parsed.slice(-maxLines);
    const windowBytes = lines.reduce((a, l) => a + Buffer.byteLength(l, 'utf8') + 1, 0);
    return {
      exists: true,
      lines: lines.length, // window count — the whole-file count is not cheap here
      bytes: tail.bytes,
      meanLineBytes: lines.length > 0 ? Math.round(windowBytes / lines.length) : null,
      history,
      last: history.length > 0 ? history[history.length - 1] : null,
    };
  } catch {
    return { ...LEDGER_EMPTY };
  }
}

/** The 32-byte seed — anything else is flagged by the caller. */
export function seedStatus(): PySeedStatus {
  const bytes = statBytes(SEED_PATH);
  return { exists: bytes !== null, bytes: bytes ?? 0 };
}

/** The 25-peer roster (local:// by default). */
export function peersStatus(): PyPeersStatus {
  try {
    const raw = fs.readFileSync(PEERS_PATH, 'utf8');
    const arr = safeParse<string[]>(raw);
    if (!Array.isArray(arr)) return { exists: false, count: 0, first: null };
    return {
      exists: true,
      count: arr.length,
      first: typeof arr[0] === 'string' ? arr[0] : null,
    };
  } catch {
    return { exists: false, count: 0, first: null };
  }
}

/** Vault notes — the Obsidian graph twin (cycle_XXXXX.md). */
export function vaultStatus(): PyVaultStatus {
  try {
    const names = fs
      .readdirSync(VAULT_DIR)
      .filter((n) => /^cycle_\d+\.md$/.test(n))
      .sort();
    return {
      exists: true,
      count: names.length,
      last: names.length > 0 ? names[names.length - 1] : null,
      dir: VAULT_DIR,
    };
  } catch {
    return { exists: false, count: 0, last: null, dir: VAULT_DIR };
  }
}

/** The signed installer chain (~/.vvu/chains/installer.json, JSONL). */
export function chainStatus(): PyChainStatus {
  try {
    const tail = readTail(CHAIN_PATH);
    if (!tail) return { exists: false, entries: 0, head: null, lastEntry: null };
    const lines = contentLines(tail.text);
    const parsed = lines
      .map((l) => safeParse<{ name?: string; ts?: number; hash?: string }>(l))
      .filter((l): l is { name?: string; ts?: number; hash?: string } => l !== null);
    const lastLine = parsed.length > 0 ? parsed[parsed.length - 1] : null;
    return {
      exists: true,
      entries: lines.length,
      head: typeof lastLine?.hash === 'string' ? lastLine.hash : null,
      lastEntry:
        lastLine && typeof lastLine.name === 'string'
          ? { name: lastLine.name, ts: typeof lastLine.ts === 'number' ? lastLine.ts : 0 }
          : null,
    };
  } catch {
    return { exists: false, entries: 0, head: null, lastEntry: null };
  }
}

/** The install receipt (T0 tier, 4 chained step hashes, probe diff). */
export function receiptStatus(): PyReceiptStatus {
  const degraded: PyReceiptStatus = {
    exists: false,
    receipt: null,
    tier: null,
    steps: 0,
    n_probes_changed: null,
    before_head: null,
    after_head: null,
    probes: null,
  };
  try {
    const raw = fs.readFileSync(receiptPath(), 'utf8');
    const r = safeParse<{
      receipt?: string;
      tier?: string;
      steps?: unknown[];
      diff?: { n_probes_changed?: number };
      before_head?: string;
      after_head?: string;
      probes?: { before?: Record<string, string> };
    }>(raw);
    if (!r) return degraded;
    return {
      exists: true,
      receipt: typeof r.receipt === 'string' ? r.receipt : null,
      tier: typeof r.tier === 'string' ? r.tier : null,
      steps: Array.isArray(r.steps) ? r.steps.length : 0,
      n_probes_changed:
        r.diff && typeof r.diff.n_probes_changed === 'number' ? r.diff.n_probes_changed : null,
      before_head: typeof r.before_head === 'string' ? r.before_head : null,
      after_head: typeof r.after_head === 'string' ? r.after_head : null,
      probes: r.probes && r.probes.before && typeof r.probes.before === 'object' ? r.probes.before : null,
    };
  } catch {
    return degraded;
  }
}

// ── aggregate ────────────────────────────────────────────────────────────────

/**
 * Full flywheel status. Each section is individually guarded: a missing or
 * unreadable artifact degrades to { exists: false, … } and never throws.
 */
export async function getFlywheelStatus(): Promise<PyFlywheelStatus> {
  let ledger: PyLedgerStatus = { ...LEDGER_EMPTY };
  try {
    ledger = readLedgerTail();
  } catch {
    /* degraded */
  }
  let seed: PySeedStatus = { exists: false, bytes: 0 };
  try {
    seed = seedStatus();
  } catch {
    /* degraded */
  }
  let peers: PyPeersStatus = { exists: false, count: 0, first: null };
  try {
    peers = peersStatus();
  } catch {
    /* degraded */
  }
  let vault: PyVaultStatus = { exists: false, count: 0, last: null, dir: VAULT_DIR };
  try {
    vault = vaultStatus();
  } catch {
    /* degraded */
  }
  let chain: PyChainStatus = { exists: false, entries: 0, head: null, lastEntry: null };
  try {
    chain = chainStatus();
  } catch {
    /* degraded */
  }
  let receipt: PyReceiptStatus = {
    exists: false,
    receipt: null,
    tier: null,
    steps: 0,
    n_probes_changed: null,
    before_head: null,
    after_head: null,
    probes: null,
  };
  try {
    receipt = receiptStatus();
  } catch {
    /* degraded */
  }
  return {
    ok: true,
    at: new Date().toISOString(),
    beats: [...PY_BEATS],
    ledger,
    seed,
    peers,
    vault,
    chain,
    receipt,
  };
}
