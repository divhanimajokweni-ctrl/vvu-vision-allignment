'use client';

// src/components/proximity/tabs/WatchdogTab.tsx
// WatchdogTab — extracted verbatim from ProximityWorkspace.tsx (R62 lazy split).
// Same bytes, same props; the shell now loads this module only when the tab opens.

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Anchor,
  Archive,
  Boxes,
  ClipboardCopy,
  CloudUpload,
  Download,
  FileJson,
  Flame,
  LibraryBig,
  RefreshCw,
  RotateCw,
  Send,
  ShieldCheck,
  Siren,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { BUNDLE_URL, BUNDLE_VAULT_URL, BUNDLE_SYNC_URL, BUNDLE_SYNC_AUDIT_URL, shortHash, Panel, Metric, VerdictChip } from '../shared';

import {
  type AnchorLedger,
  type BundleVerifyResult,
  type ProximityVerifyResult,
  type WatchdogStatus,
  type WebhookStatus,
} from '@/lib/proximity/types';
import {
  clearEstateDraft,
  countDraftWords,
  DISPATCH_URL_DRAFT_KEY,
  PIN_NOTE_DRAFT_KEY,
  readEstateDraft,
  writeEstateDraft,
} from '@/lib/estate-drafts';

// R68 — one vault row as the vault index records it (a complete
// vvu.anchor-bundle.v1 snapshot filed under vvu-trust/bundles/).
interface VaultRow {
  fileName: string;
  bundleHash: string;
  anchors: number;
  headPosition: number | null;
  headHash: string | null;
  exportedAtUtc: string;
  savedAtUtc: string;
  bytes: number;
}

interface VaultListResponse {
  ok: boolean;
  total: number;
  gone: number;
  bytes?: number | null;
  snapshots: VaultRow[];
}

// R69 — one sync attempt as the sync journal records it. R74 adds the
// optional trigger (older rows predate the field) for auto vs manual.
interface SyncRow {
  at: string;
  target: string;
  state: 'SYNCED' | 'STAGED' | 'UNCONFIGURED' | 'FAILED' | 'PARTIAL';
  pushed: number;
  verified: number;
  skipped: number;
  failed: number;
  manifestHash: string | null;
  detail: string | null;
  trigger?: 'manual' | 'auto';
}

interface SyncStatusResponse {
  ok: boolean;
  config: { target: string; configured: boolean; autoSync?: boolean; detail: string | null; envContract: string[] };
  last: SyncRow | null;
  history: SyncRow[];
  journalRows: number;
}

// R74 — one audited file in the mirror (per-file verdict from the
// independent re-hash: vault ↔ mirror ↔ manifest cross-check).
// R79 — the s3 transport adds UNREACHABLE + etag/note evidence fields.
interface AuditFileRow {
  fileName: string;
  verdict: 'OK' | 'DIVERGED' | 'MISSING' | 'EXTRA' | 'MANIFEST_MISMATCH' | 'UNREACHABLE';
  vaultHash: string | null;
  mirrorHash: string | null;
  manifestHash: string | null;
  bytes: number | null;
  etag?: string | null;
  note?: string | null;
}

interface MirrorAudit {
  ok: boolean;
  verdict: 'PASS' | 'DRIFT' | 'UNEXPECTED' | 'INCOMPLETE' | 'UNCONFIGURED' | 'EMPTY' | 'NO_MANIFEST' | 'UNSUPPORTED' | 'UNREACHABLE';
  target: string;
  detail: string | null;
  auditedAtUtc: string;
  files: AuditFileRow[];
  counts: { ok: number; diverged: number; missing: number; extra: number; manifestMismatch: number; unreachable?: number };
  manifest: { present: boolean; format: string | null; entries: number | null; sha256: string | null; note: string | null };
  otherFiles: number;
  message: string;
  transport?: {
    sigv4: 'path-style';
    headOk: number;
    reRead: number;
    etagMatches: number;
    timeoutMs: number;
    listOk?: boolean;
    mirrorObjects?: number | null;
    truncated?: boolean;
    extraReRead?: number;
    listNote?: string | null;
    /** R83 — LIST requests issued; ≥2 means the continuation loop ran and completed. */
    listPages?: number | null;
  } | null;
}

function LatencySparkline({ passes }: { passes: WatchdogStatus['passes'] }) {
  const pts = passes.slice(-40);
  if (pts.length < 2) {
    return (
      <div className="flex h-[52px] items-center justify-center rounded-lg border border-dashed border-slate-800 bg-slate-950/40 font-mono text-[10px] text-slate-600">
        collecting verification passes…
      </div>
    );
  }
  const w = 100;
  const h = 26;
  const lats = pts.map((p) => p.latencyMs);
  const max = Math.max(...lats);
  const min = Math.min(...lats);
  const range = Math.max(max - min, 1);
  const coords = pts.map((p, i) => {
    const x = (i / (pts.length - 1)) * w;
    const y = h - ((p.latencyMs - min) / range) * (h - 6) - 3;
    return [x, y] as const;
  });
  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  const lastValid = pts[pts.length - 1].valid;
  const stroke = lastValid ? '#34d399' : '#fb7185';
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-2 pb-1.5 pt-2">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-8 w-full" aria-hidden="true">
        <defs>
          <linearGradient id="proxSparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#proxSparkFill)" stroke="none" />
        <path d={line} fill="none" stroke={stroke} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-0.5 flex justify-between font-mono text-[8.5px] uppercase tracking-wider text-slate-600">
        <span>verify latency · last {pts.length} passes · min {min} ms</span>
        <span className={lastValid ? 'text-emerald-400' : 'text-rose-400'}>max {max} ms</span>
      </div>
    </div>
  );
}

export default function WatchdogTab({
  watchdog,
  anchors,
  webhook,
  verification,
  busy,
  onAction,
  onPin,
  onVerify,
  onWebhook,
}: {
  watchdog: WatchdogStatus | null;
  anchors: AnchorLedger | null;
  webhook: WebhookStatus | null;
  verification: ProximityVerifyResult | null;
  busy: string | null;
  onAction: (action: 'enable' | 'disable' | 'run-now') => Promise<void>;
  onPin: (note: string) => Promise<boolean>;
  onVerify: () => Promise<void>;
  onWebhook: (
    action: 'set' | 'clear' | 'test' | 'retry-now' | 'dismiss-retry',
    url?: string,
    secret?: string,
    alarmSeq?: number,
  ) => Promise<boolean>;
}) {
  // R196 — THE TWIN REMEMBERS: the dispatch URL and the anchor note draft
  // through the estate's one engine (read once at mount — typeof window —
  // written on every keystroke, cleared when their act LANDS — a saved
  // config/anchor is a WORM row, not a draft). THE SECRET NEVER SLEEPS ON
  // DISK: secretDraft is deliberately wired to NO ledger — a credential
  // lives in memory alone, and retyping it after a bounce is the honest
  // price of never writing it to storage.
  const [urlBoot] = useState(() => {
    if (typeof window === 'undefined') {
      return { restored: null as Record<string, string> | null };
    }
    return { restored: readEstateDraft(window.localStorage, DISPATCH_URL_DRAFT_KEY, ['url']) };
  });
  const [urlEcho, setUrlEcho] = useState(urlBoot.restored !== null);
  const [urlWords] = useState(() => (urlBoot.restored ? countDraftWords(urlBoot.restored) : 0));
  const [noteBoot] = useState(() => {
    if (typeof window === 'undefined') {
      return { restored: null as Record<string, string> | null };
    }
    return { restored: readEstateDraft(window.localStorage, PIN_NOTE_DRAFT_KEY, ['note']) };
  });
  const [noteEcho, setNoteEcho] = useState(noteBoot.restored !== null);
  const [noteWords] = useState(() => (noteBoot.restored ? countDraftWords(noteBoot.restored) : 0));
  const [note, setNote] = useState(noteBoot.restored?.note ?? '');
  const [exporting, setExporting] = useState(false);

  // ── off-box bundle state ──────────────────────────────────────────────
  const [bundleText, setBundleText] = useState('');
  const [bundleResult, setBundleResult] = useState<BundleVerifyResult | null>(null);
  const [bundleBusy, setBundleBusy] = useState(false);

  // ── bundle VAULT state (R68 — snapshots that accumulate) ──────────────
  const [vault, setVault] = useState<VaultListResponse | null>(null);
  const [vaultBusy, setVaultBusy] = useState(false);
  const [vaultRowBusy, setVaultRowBusy] = useState<string | null>(null);

  // ── off-box SYNC state (R69 — evidence leaves the box) ────────────────
  const [sync, setSync] = useState<SyncStatusResponse | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  // R74 — the mirror audit (independent re-read; read-only)
  const [audit, setAudit] = useState<MirrorAudit | null>(null);
  const [auditBusy, setAuditBusy] = useState(false);

  // The vault list + sync state load once when the tab opens.
  useEffect(() => {
    void loadVault();
    void loadSync();
  }, []);

  // ── dispatch config drafts ────────────────────────────────────────────
  const [urlDraft, setUrlDraft] = useState(urlBoot.restored?.url ?? '');
  const [secretDraft, setSecretDraft] = useState('');

  // the drafts ride every keystroke (the secret rides NONE of them)
  const persistUrl = (value: string) => {
    if (typeof window !== 'undefined') {
      writeEstateDraft(window.localStorage, DISPATCH_URL_DRAFT_KEY, { url: value });
    }
  };
  const persistNote = (value: string) => {
    if (typeof window !== 'undefined') {
      writeEstateDraft(window.localStorage, PIN_NOTE_DRAFT_KEY, { note: value });
    }
  };

  // EXPORT — GET the bundle (the API sets content-disposition; we read the
  // same JSON and hand it to the browser as a file download, so it works
  // behind gateways that strip headers too).
  const exportBundle = async () => {
    setBundleBusy(true);
    try {
      const res = await fetch(BUNDLE_URL, { cache: 'no-store' });
      const bundle = (await res.json()) as Record<string, unknown>;
      const text = JSON.stringify(bundle, null, 2);
      const stamp = (typeof bundle.exportedAtUtc === 'string' ? bundle.exportedAtUtc : '').replace(/[^0-9]/g, '').slice(0, 12);
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vvu-anchor-bundle-${stamp || 'export'}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      const count = Array.isArray(bundle.anchors) ? bundle.anchors.length : 0;
      toast.success(`BUNDLE EXPORTED · ${count} ANCHORS`, {
        description: `sha256 ${String(bundle.bundleHash ?? '').slice(0, 16)}… — the file is self-verifying: whoever receives it can hash-check it before trusting it.`,
      });
      // prefill the verify box with what we just exported — the round trip
      // is one click away
      setBundleText(text);
    } catch (e) {
      toast.error('EXPORT FAILED', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBundleBusy(false);
    }
  };

  // VERIFY — replay a received bundle against the LIVE chain. Accepts an
  // optional pre-parsed document (the vault replay path reuses this).
  const verifyBundle = async (rawOverride?: unknown) => {
    setBundleBusy(true);
    try {
      let raw: unknown;
      if (rawOverride !== undefined) {
        raw = rawOverride;
      } else {
        try {
          raw = JSON.parse(bundleText);
        } catch {
          throw new Error('the pasted text is not valid JSON — paste the bundle file contents as-is');
        }
      }
      const res = await fetch(BUNDLE_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(raw),
      });
      const json = (await res.json()) as { ok: boolean; result?: BundleVerifyResult; error?: string };
      if (!json.result) throw new Error(json.error ?? 'verification failed');
      setBundleResult(json.result);
      const r = json.result;
      if (r.bundleIntegrity === 'INTACT' && r.driftCount + r.missingCount === 0 && r.bundleAnchorCount > 0) {
        toast.success('BUNDLE HOLDS', { description: r.verdict });
      } else if (r.bundleIntegrity !== 'INTACT') {
        toast.error(`BUNDLE ${r.bundleIntegrity}`, { description: r.verdict });
      } else {
        toast.warning('BUNDLE DISPUTE', { description: r.verdict });
      }
    } catch (e) {
      toast.error('BUNDLE VERIFY REFUSED', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBundleBusy(false);
    }
  };

  // ── VAULT (R68) — snapshots that accumulate ─────────────────────────────
  // The vault files complete vvu.anchor-bundle.v1 objects under
  // vvu-trust/bundles/ with an append-only index. Sync off-box later = copy
  // the directory. list → GET, file → POST, replay → GET the stored object
  // and push it through the SAME verify endpoint as a pasted bundle.

  const loadVault = async () => {
    setVaultBusy(true);
    try {
      const json = (await fetch(BUNDLE_VAULT_URL, { cache: 'no-store' }).then((r) => r.json())) as VaultListResponse;
      setVault(json);
    } catch (e) {
      toast.error('VAULT READ FAILED', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setVaultBusy(false);
    }
  };

  const loadSync = async () => {
    setSyncBusy(true);
    try {
      const json = (await fetch(BUNDLE_SYNC_URL, { cache: 'no-store' }).then((r) => r.json())) as SyncStatusResponse;
      setSync(json);
    } catch (e) {
      toast.error('SYNC STATE READ FAILED', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSyncBusy(false);
    }
  };

  const runSync = async () => {
    setSyncBusy(true);
    try {
      const res = await fetch(BUNDLE_SYNC_URL, { method: 'POST' });
      const json = (await res.json()) as { ok: boolean; row?: SyncRow; error?: string };
      if (!json.row) throw new Error(json.error ?? 'sync dispatch failed');
      const r = json.row;
      if (r.state === 'SYNCED' || r.state === 'STAGED') {
        toast.success(`SYNC ${r.state} · ${r.verified} VERIFIED`, {
          description: `${r.pushed} pushed · ${r.skipped} already present · ${r.failed} failed${r.manifestHash ? ` · manifest ${r.manifestHash.slice(0, 12)}…` : ''}`,
        });
      } else if (r.state === 'UNCONFIGURED') {
        toast.warning('SYNC UNCONFIGURED', { description: r.detail ?? 'no sync target — set one in vvu-trust/bundles/sync-target.json' });
      } else {
        toast.error(`SYNC ${r.state}`, { description: r.detail ?? 'the sync job failed — read the journal row' });
      }
      await loadSync();
    } catch (e) {
      toast.error('SYNC DISPATCH FAILED', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSyncBusy(false);
    }
  };

  // R74 — the mirror audit: independent re-read of the mirror (read-only —
  // an audit is a reading, not an event). Result lives in `audit` state.
  const runAudit = async () => {
    setAuditBusy(true);
    try {
      const json = (await fetch(BUNDLE_SYNC_AUDIT_URL, { cache: 'no-store' }).then((r) => r.json())) as {
        ok: boolean;
        audit?: MirrorAudit;
        error?: string;
      };
      if (!json.audit) throw new Error(json.error ?? 'audit failed');
      const a = json.audit;
      setAudit(a);
      if (a.verdict === 'PASS') {
        toast.success(`MIRROR AUDIT PASS · ${a.counts.ok} ${a.target === 's3' ? 'OBJECT(S)' : 'FILE(S)'} VERIFIED`, {
          description:
            a.target === 's3'
              ? 'every object re-read from the endpoint, sha256 agrees with the vault and the manifest'
              : 'every byte re-hashed from disk agrees with the vault and the manifest',
        });
      } else if (a.verdict === 'DRIFT') {
        toast.error(`MIRROR AUDIT DRIFT · ${a.counts.diverged + a.counts.missing + a.counts.manifestMismatch} PROBLEM(S)`, {
          description: a.message,
        });
      } else if (a.ok || a.verdict === 'UNEXPECTED' || a.verdict === 'NO_MANIFEST') {
        toast.warning(`MIRROR AUDIT ${a.verdict}`, { description: a.message });
      } else {
        toast.warning(`MIRROR AUDIT ${a.verdict}`, { description: a.message });
      }
    } catch (e) {
      toast.error('MIRROR AUDIT FAILED', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setAuditBusy(false);
    }
  };

  const snapshotVault = async () => {
    setVaultBusy(true);
    try {
      const res = await fetch(BUNDLE_VAULT_URL, { method: 'POST' });
      const json = (await res.json()) as { ok: boolean; fileName?: string; row?: VaultRow; error?: string; mirrored?: { state: string; detail: string | null } | null; note?: string };
      if (!json.ok || !json.row) throw new Error(json.error ?? 'snapshot failed');
      if (json.mirrored) {
        toast.success(`SNAPSHOT FILED · ${json.row.anchors} ANCHORS · MIRROR ${json.mirrored.state.toUpperCase()}`, {
          description: `${json.fileName} — sha256 ${json.row.bundleHash.slice(0, 16)}… · head #${json.row.headPosition ?? '—'} · auto-mirror ${json.mirrored.state}`,
        });
      } else {
        toast.success(`SNAPSHOT FILED · ${json.row.anchors} ANCHORS`, {
          description: `${json.fileName} — sha256 ${json.row.bundleHash.slice(0, 16)}… · head #${json.row.headPosition ?? '—'}`,
        });
      }
      await loadVault();
    } catch (e) {
      toast.error('SNAPSHOT FAILED', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setVaultBusy(false);
    }
  };

  const fetchVaultObject = async (fileName: string): Promise<Record<string, unknown>> => {
    const res = await fetch(`${BUNDLE_VAULT_URL}?file=${encodeURIComponent(fileName)}`, { cache: 'no-store' });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? `vault read failed (HTTP ${res.status})`);
    }
    return (await res.json()) as Record<string, unknown>;
  };

  const replayVaultRow = async (row: VaultRow) => {
    setVaultRowBusy(row.fileName);
    try {
      const obj = await fetchVaultObject(row.fileName);
      setBundleText(JSON.stringify(obj, null, 2)); // prefill the verify box — same round trip as export
      await verifyBundle(obj);
    } catch (e) {
      toast.error('VAULT REPLAY FAILED', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setVaultRowBusy(null);
    }
  };

  const downloadVaultRow = async (row: VaultRow) => {
    setVaultRowBusy(row.fileName);
    try {
      const obj = await fetchVaultObject(row.fileName);
      const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = row.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('SNAPSHOT DOWNLOADED', { description: `${row.fileName} — carry it anywhere; it verifies itself.` });
    } catch (e) {
      toast.error('DOWNLOAD FAILED', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setVaultRowBusy(null);
    }
  };

  // Evidence hand-off: the alarm rail + the anchor ledger as one JSON bundle
  // on the clipboard. Read-only over the API payloads — nothing is mutated.
  const copyEvidence = async () => {
    setExporting(true);
    try {
      const bundle = {
        exportedAtUtc: new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC',
        stream: 'proximity.gqeberha.v1',
        kernel: 'VVU-WORM-v1',
        chain: {
          valid: verification?.valid ?? null,
          records: verification?.records ?? null,
          headPosition: verification?.headPosition ?? null,
          headHash: verification?.headHash ?? null,
        },
        alarmRail: {
          store: 'vvu-trust/chains/proximity-alarms.jsonl',
          onDisk: watchdog?.alarmCount ?? 0,
          alarms: watchdog?.alarms ?? [],
        },
        anchorLedger: anchors
          ? {
              store: anchors.storePath,
              continuity: anchors.continuity,
              coveragePercent: anchors.coveragePercent,
              anchors: anchors.anchors,
            }
          : null,
      };
      await navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
      toast.success('EVIDENCE BUNDLE ON THE CLIPBOARD', {
        description: `${watchdog?.alarmCount ?? 0} alarms + ${anchors?.okCount ?? 0} anchors as JSON — paste it anywhere the pilot conversation lives.`,
      });
    } catch (e) {
      toast.error('COPY REFUSED', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setExporting(false);
    }
  };
  const broken = verification?.valid === false;
  const alarmed = broken;
  const railCount = watchdog?.alarmCount ?? 0;
  const sentinelTone = broken ? 'rose' : railCount > 0 ? 'amber' : watchdog?.running ? 'emerald' : 'slate';
  const sentinelLabel = broken ? 'ALARM' : railCount > 0 ? `RAIL · ${railCount}` : watchdog?.running ? 'ON WATCH' : 'DISARMED';
  const lastPass = watchdog?.passes[watchdog.passes.length - 1] ?? null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,1.1fr)]">
      {/* ═══ LEFT · SENTINEL STATUS — one indicator: is the chain under watch? ═══ */}
      <div className="flex flex-col gap-4">
        <Panel
          title="Sentinel · scheduled verification"
          icon={<Siren className="h-3.5 w-3.5" />}
          indicator={sentinelLabel}
          indicatorTone={sentinelTone as 'rose' | 'emerald' | 'slate' | 'amber'}
        >
          <p className="mb-3 text-[10.5px] leading-relaxed text-slate-500">
            The walker runs on a schedule, not only when someone remembers to press verify. A VALID→BROKEN transition — or
            a shrinking head — is written to the alarm rail on disk before anything else happens.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Metric
              value={((watchdog?.intervalMs ?? 30000) / 1000).toFixed(0)}
              unit="s interval"
              label="verification cadence"
              tone="cyan"
            />
            <Metric value={String(watchdog?.totalPasses ?? 0)} unit="passes" label="checks run this process" />
            <Metric
              value={String(watchdog?.consecutiveValid ?? 0)}
              unit="in a row"
              label="consecutive VALID passes"
              tone="emerald"
            />
            <Metric value={String(watchdog?.alarmCount ?? 0)} unit="alarms" label="on the tamper rail" tone={(watchdog?.alarmCount ?? 0) > 0 ? 'rose' : 'slate'} />
          </div>
          <div className="mt-2.5">
            <LatencySparkline passes={watchdog?.passes ?? []} />
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            <Button
              onClick={() => void onAction('run-now')}
              disabled={busy === 'wd:run-now'}
              size="sm"
              variant="outline"
              className="h-7 border-slate-700 bg-slate-950/60 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300 hover:border-cyan-800 hover:text-cyan-200"
            >
              {busy === 'wd:run-now' ? <RefreshCw className="mr-1 h-3 w-3 animate-spin" /> : <ShieldCheck className="mr-1 h-3 w-3" />}
              pass now
            </Button>
            <Button
              onClick={() => void onAction('enable')}
              disabled={busy === 'wd:enable' || (watchdog?.running ?? false)}
              size="sm"
              variant="outline"
              className="h-7 border-emerald-900/60 bg-emerald-950/30 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-300 hover:bg-emerald-900/40 disabled:opacity-40"
            >
              arm
            </Button>
            <Button
              onClick={() => void onAction('disable')}
              disabled={busy === 'wd:disable' || !watchdog?.running}
              size="sm"
              variant="outline"
              className="h-7 border-slate-700 bg-slate-950/60 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 hover:bg-slate-900 disabled:opacity-40"
            >
              disarm
            </Button>
          </div>
          {lastPass ? (
            <p className="mt-2.5 font-mono text-[9.5px] leading-relaxed text-slate-600">
              last pass {lastPass.atUtc} · {lastPass.valid ? 'VALID' : `BROKEN at ${lastPass.brokenAt}`} ·{' '}
              {lastPass.records} records · {lastPass.latencyMs} ms · head {shortHash(lastPass.headHash, 10)}
            </p>
          ) : (
            <p className="mt-2.5 font-mono text-[9.5px] text-slate-600">
              no pass recorded yet in this process — the scheduler runs every {(watchdog?.intervalMs ?? 30000) / 1000}s and
              on boot.
            </p>
          )}
          {watchdog?.killSwitch && (
            <p className="mt-1.5 font-mono text-[9.5px] text-amber-400">
              PROXIMITY_WATCHDOG=off is set — the kill switch is armed, the timer will not run.
            </p>
          )}
        </Panel>

        <Panel title="How the layers stack" icon={<Boxes className="h-3.5 w-3.5" />} indicator="4 LAYERS" indicatorTone="violet">
          <ol className="space-y-2">
            <li className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-300">1 · stored-bytes rule</span>
                <VerdictChip verdict="PASS" />
              </div>
              <p className="mt-1 font-mono text-[9.5px] leading-relaxed text-slate-500">
                re-hash the stored canonical bytes — catches any byte altered after seal. Runs at every verify, scheduled
                or manual.
              </p>
            </li>
            <li className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-300">2 · sentinel + alarm rail</span>
                <VerdictChip verdict={alarmed ? 'FIRED' : 'ARMED'} />
              </div>
              <p className="mt-1 font-mono text-[9.5px] leading-relaxed text-slate-500">
                makes verification continuous; alarms are append-only JSONL on disk — they outlive the process and are
                never edited or deleted.
              </p>
            </li>
            <li className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-300">3 · external head anchors</span>
                <VerdictChip verdict={anchors?.continuity === 'VALID' ? 'OK' : anchors?.continuity === 'DRIFT' ? 'BROKEN' : 'EMPTY'} />
              </div>
              <p className="mt-1 font-mono text-[9.5px] leading-relaxed text-slate-500">
                pins (position, record_hash) OUTSIDE the database — the full-file rewrite that re-links everything is the
                attack the walker cannot see. The anchor can. Bundles carry the pins off-box by hand.
              </p>
            </li>
            <li className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-300">4 · out-of-band dispatch</span>
                <VerdictChip verdict={webhook?.config.configured ? 'ARMED' : 'OFF-BOX READY'} />
              </div>
              <p className="mt-1 font-mono text-[9.5px] leading-relaxed text-slate-500">
                every raised alarm is also POSTed — signed — to a configured endpoint, with an append-only delivery log.
                If the box dies, the alarm has already left it.
              </p>
            </li>
          </ol>
        </Panel>
      </div>

      {/* ═══ CENTER · TAMPER ALARM RAIL — append-only evidence ═══ */}
      <div className="flex flex-col gap-4">
        <Panel
          title="Tamper alarm rail · append-only"
          icon={<Flame className="h-3.5 w-3.5" />}
          indicator={(watchdog?.alarmCount ?? 0) > 0 ? `${watchdog?.alarmCount} ON RAIL` : 'NO ALARMS'}
          indicatorTone={(watchdog?.alarmCount ?? 0) > 0 ? 'rose' : 'emerald'}
          actions={
            <div className="flex items-center gap-1.5">
              {/* evidence hand-off — the rail as JSON, straight to the clipboard.
                  A pilot conversation is a copy-paste conversation. */}
              <Button
                onClick={() => void copyEvidence()}
                disabled={exporting}
                size="sm"
                variant="outline"
                className="h-7 border-slate-700 bg-slate-950/60 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300 hover:border-amber-800 hover:text-amber-200"
              >
                <ClipboardCopy className="mr-1 h-3 w-3" />
                {exporting ? 'copying…' : 'copy rail json'}
              </Button>
              <Button
                onClick={() => void onVerify()}
                disabled={busy === 'verify'}
                size="sm"
                variant="outline"
                className="h-7 border-slate-700 bg-slate-950/60 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300 hover:border-cyan-800 hover:text-cyan-200"
              >
                {busy === 'verify' ? <RefreshCw className="mr-1 h-3 w-3 animate-spin" /> : <ShieldCheck className="mr-1 h-3 w-3" />}
                verify now
              </Button>
            </div>
          }
        >
          <p className="mb-3 text-[10.5px] leading-relaxed text-slate-500">
            Every alarm line lives at <span className="font-mono text-slate-400">vvu-trust/chains/proximity-alarms.jsonl</span> —
            append-only, on disk, survives restarts. An alarm is evidence; it is never edited, never removed, only
            superseded by the restore that clears the fault.
          </p>
          {(watchdog?.alarms ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-emerald-900/50 bg-emerald-950/20 px-4 py-8 text-center">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-300">no alarms on the rail</p>
              <p className="font-mono text-[9.5px] text-slate-500">
                the chain has never been found broken by the sentinel — tamper the simulator partition to see the rail fire
              </p>
            </div>
          ) : (
            <ol className="max-h-[480px] space-y-1.5 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-800">
              {(watchdog?.alarms ?? []).map((a) => (
                <li key={a.seq} className="rounded-lg border border-rose-900/60 bg-rose-950/25 px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-mono text-[10px] font-bold text-rose-400">#{a.seq}</span>
                    <VerdictChip verdict={a.kind === 'CHAIN_BROKEN' ? 'BROKEN' : 'FIRED'} />
                    <span className="font-mono text-[10px] font-semibold text-rose-300">{a.kind}</span>
                    <span className="ml-auto font-mono text-[9.5px] text-slate-500">{a.raisedAtUtc}</span>
                  </div>
                  <p className="mt-1 font-mono text-[10px] leading-relaxed text-rose-200/80">
                    {a.brokenAt ? `break point ${a.brokenAt} · ` : ''}{a.reason ?? ''}
                  </p>
                  {a.lastGoodPosition !== null && (
                    <p className="mt-0.5 font-mono text-[9px] text-slate-500">
                      last known good: position #{a.lastGoodPosition}
                      {a.lastGoodHash ? ` · hash ${shortHash(a.lastGoodHash, 12)}` : ''}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Panel>

        {/* ═══ OUT-OF-BAND DISPATCH — alarms that leave the box ═══ */}
        <Panel
          title="Out-of-band dispatch"
          icon={<Send className="h-3.5 w-3.5" />}
          indicator={webhook?.config.configured ? `CONFIGURED · ${webhook.config.source.toUpperCase()}` : 'LOCAL ONLY'}
          indicatorTone={webhook?.config.configured ? 'emerald' : 'amber'}
          className={webhook?.config.configured ? '' : 'border-l-2 border-l-amber-500/60'}
        >
          <p className="mb-3 text-[10.5px] leading-relaxed text-slate-500">
            The rail is durable on this box — but if the box is what dies, nobody hears the alarm. Every raised alarm is
            also POSTed, HMAC-signed, to the configured endpoint. Delivery attempts land on an append-only log at{' '}
            <span className="font-mono text-slate-400">vvu-trust/chains/proximity-webhook-deliveries.jsonl</span>. The
            webhook is a notification rail — the JSONL alarm rail remains the evidence of record.
          </p>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Metric
              value={String(webhook?.okCount ?? 0)}
              unit="delivered"
              label="2xx responses logged"
              tone="emerald"
            />
            <Metric
              value={String(webhook?.failCount ?? 0)}
              unit="failed"
              label="timeouts + non-2xx"
              tone={(webhook?.failCount ?? 0) > 0 ? 'rose' : 'slate'}
            />
            <Metric
              value={String(webhook?.skippedCount ?? 0)}
              unit="skipped"
              label="alarms while unconfigured"
              tone={(webhook?.skippedCount ?? 0) > 0 ? 'amber' : 'slate'}
            />
            <Metric
              value={String(webhook?.inboxCount ?? 0)}
              unit="in sink"
              label="loopback demo receiver"
              tone="cyan"
            />
            <Metric
              value={String(webhook?.pendingRetryCount ?? 0)}
              unit="queued"
              label="alarms awaiting retry"
              tone={(webhook?.pendingRetryCount ?? 0) > 0 ? 'amber' : 'slate'}
            />
            <Metric
              value={String(webhook?.givenUpRetryCount ?? 0)}
              unit="given up"
              label="retries exhausted — the gap"
              tone={(webhook?.givenUpRetryCount ?? 0) > 0 ? 'rose' : 'slate'}
            />
          </div>

          {/* config state line */}
          <div className="mt-2.5 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 font-mono text-[9.5px] leading-relaxed text-slate-500">
            {webhook?.config.configured ? (
              <>
                target <span className="font-semibold text-cyan-300">{webhook.config.targetHost}</span> · secret{' '}
                <span className={webhook.config.secretSet ? 'font-semibold text-emerald-300' : 'text-amber-300'}>
                  {webhook.config.secretSet ? 'SET (HMAC-SHA256)' : 'NOT SET (unsigned)'}</span>{' '}
                · timeout {webhook.config.timeoutSeconds}s · source {webhook.config.source}
                {webhook.config.source === 'env' && ' (env — file config would be ignored)'}
              </>
            ) : (
              <>
                no target — alarms raised now are counted as <span className="text-amber-300">skipped</span>, not lost:
                the rail still holds them. Set a target below (env{' '}
                <span className="text-slate-400">PROXIMITY_ALARM_WEBHOOK_URL</span> wins over the file).
              </>
            )}
          </div>

          {/* config form */}
          {urlEcho && (
            <div
              role="status"
              aria-live="polite"
              className="mt-2.5 text-[8px] font-bold text-[#c8ff00] border border-[#c8ff00]/40 shadow-[0_0_12px_rgba(200,255,0,0.15)] transition-shadow rounded px-2.5 py-2 leading-relaxed font-mono"
            >
              DRAFT KEPT · {urlWords} WORD{urlWords === 1 ? '' : 'S'} RESTORED — THE STORM NEVER TAKES A WORD TWICE
            </div>
          )}
          <div className="mt-2.5 grid grid-cols-1 gap-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,140px)_auto]">
            <Input
              value={urlDraft}
              onChange={(e) => { setUrlDraft(e.target.value); persistUrl(e.target.value); }}
              placeholder="https://ops.example.com/hooks/vvu — or the loopback sink below"
              className="h-8 border-slate-800 bg-slate-950/60 font-mono text-[10.5px] text-slate-200 placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500/60"
            />
            <Input
              value={secretDraft}
              onChange={(e) => setSecretDraft(e.target.value)}
              type="password"
              placeholder="HMAC secret (optional)"
              aria-label="HMAC secret — never stored as a draft, memory only"
              className="h-8 border-slate-800 bg-slate-950/60 font-mono text-[10.5px] text-slate-200 placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500/60"
            />
            <div className="flex gap-1.5">
              <Button
                onClick={async () => {
                  if (await onWebhook('set', urlDraft, secretDraft)) {
                    // the config landed server-side — a WORM row, not a draft
                    if (typeof window !== 'undefined') {
                      clearEstateDraft(window.localStorage, DISPATCH_URL_DRAFT_KEY);
                    }
                    setUrlEcho(false);
                  }
                }}
                disabled={busy === 'hk:set' || urlDraft.trim().length === 0}
                size="sm"
                className="h-8 flex-1 border border-cyan-900/70 bg-cyan-950/60 px-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-200 hover:bg-cyan-900/50 disabled:opacity-40 sm:flex-none"
              >
                {busy === 'hk:set' ? <RefreshCw className="mr-1 h-3 w-3 animate-spin" /> : <Send className="mr-1 h-3 w-3" />}
                set
              </Button>
              <Button
                onClick={() => void onWebhook('test')}
                disabled={busy === 'hk:test' || !webhook?.config.configured}
                size="sm"
                variant="outline"
                className="h-8 flex-1 border-slate-700 bg-slate-950/60 px-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300 hover:border-cyan-800 hover:text-cyan-200 disabled:opacity-40 sm:flex-none"
              >
                {busy === 'hk:test' ? <RefreshCw className="mr-1 h-3 w-3 animate-spin" /> : <ShieldCheck className="mr-1 h-3 w-3" />}
                test
              </Button>
              <Button
                onClick={() => void onWebhook('clear')}
                disabled={busy === 'hk:clear' || !webhook?.config.configured}
                size="sm"
                variant="outline"
                className="h-8 flex-1 border-slate-700 bg-slate-950/60 px-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 hover:bg-slate-900 disabled:opacity-40 sm:flex-none"
              >
                clear
              </Button>
            </div>
          </div>
          <p className="mt-1.5 font-mono text-[9px] leading-relaxed text-slate-600">
            loopback demo sink (this box proves the path, not out-of-band):{' '}
            <span className="text-slate-400">{`${typeof window !== 'undefined' ? window.location.origin : ''}/api/proximity/webhook-sink`}</span>{' '}
            — paste it as the target, then TEST. A real deployment points at a receiver the operator controls elsewhere.
          </p>
          <p className="mt-1 font-mono text-[9px] leading-relaxed text-amber-300/80">
            THE SECRET NEVER SLEEPS ON DISK — the URL drafts through the estate's ledger, the HMAC secret rides memory alone and is re-typed after a bounce.
          </p>

          {/* ═══ RETRY QUEUE — a failed delivery is a debt, not a shrug ═══ */}
          <div className="mt-3 rounded-lg border border-amber-900/40 bg-amber-950/10 px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.14em] text-amber-300">
                retry queue · backoff
              </span>
              <span className="font-mono text-[8.5px] uppercase tracking-wider text-slate-500" title="policy: 3 re-attempts at 30s / 2m / 8m, then the row is given up but stays visible">
                policy · {webhook?.retryPolicy.maxRetries ?? 3} retries · {webhook?.retryPolicy.backoffSeconds.map((s) => (s >= 60 ? `${Math.round(s / 60)}m` : `${s}s`)).join(' →') ?? '—'} · tick {webhook?.retryPolicy.tickSeconds ?? 15}s
              </span>
            </div>
            {(webhook?.retryQueue ?? []).filter((r) => r.state === 'pending').length === 0 &&
            (webhook?.retryQueue ?? []).filter((r) => r.state !== 'pending').length === 0 ? (
              <p className="mt-2 font-mono text-[9px] leading-relaxed text-slate-600">
                queue empty — a failed alarm delivery would appear here and re-attempt on its own backoff schedule;
                the delivery log keeps every attempt either way.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {(webhook?.retryQueue ?? []).map((r) => {
                  const due = r.state === 'pending' && r.nextAttemptUtc !== null && webhook !== null && Date.parse(r.nextAttemptUtc) <= Date.parse(webhook.nowUtc);
                  // backoff progress: how far between the last attempt and the next one
                  // (server clock both ends — the one-clock discipline holds)
                  const barPct = (() => {
                    if (r.state !== 'pending' || !r.nextAttemptUtc || !r.lastAttemptAtUtc || !webhook) return null;
                    const a = Date.parse(r.lastAttemptAtUtc);
                    const b = Date.parse(r.nextAttemptUtc);
                    const n = Date.parse(webhook.nowUtc);
                    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
                    return Math.max(2, Math.min(100, Math.round(((n - a) / (b - a)) * 100)));
                  })();
                  // attempt ladder: one dot per attempt so far + the ghost of the next
                  const ladder = [
                    { ok: false, label: 'original' },
                    ...Array.from({ length: r.attempts }, (_, i) => ({ ok: r.state === 'resolved' && i === r.attempts - 1, label: `retry ${i + 1}` })),
                  ];
                  return (
                    <li
                      key={`${r.alarmSeq}-${r.state}`}
                      className={`rounded-lg border px-3 py-2 ${
                        r.state === 'pending'
                          ? 'border-amber-900/50 bg-amber-950/15 border-l-2 border-l-amber-500/70'
                          : r.state === 'given-up'
                            ? 'border-rose-900/40 bg-rose-950/10 opacity-80'
                            : 'border-emerald-900/40 bg-emerald-950/10 opacity-75'
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-mono text-[10px] font-bold text-slate-300">alarm #{r.alarmSeq}</span>
                        <span className="font-mono text-[10px] font-semibold text-slate-400">{r.kind}</span>
                        <span
                          className={`rounded border px-1 font-mono text-[8.5px] uppercase tracking-wider ${
                            r.state === 'pending'
                              ? 'border-amber-700/60 bg-amber-950/40 text-amber-300'
                              : r.state === 'given-up'
                                ? 'border-rose-800/60 bg-rose-950/40 text-rose-300'
                                : 'border-emerald-800/60 bg-emerald-950/40 text-emerald-300'
                          }`}
                        >
                          {r.state === 'pending' ? 'pending' : r.state === 'given-up' ? 'given up' : 'resolved'}
                        </span>
                        {r.state === 'pending' && (
                          <span className="font-mono text-[9px] text-slate-500">
                            attempt {r.attempts}/{webhook?.retryPolicy.maxRetries ?? 3}
                            {r.nextAttemptUtc && !due && ` · next ${r.nextAttemptUtc}`}
                          </span>
                        )}
                        {due && (
                          <span className="rounded border border-amber-600/70 bg-amber-500/10 px-1 font-mono text-[8.5px] font-bold uppercase tracking-wider text-amber-300 vvu-pulse" title="the next-attempt time has passed — the ticker takes it on this tick">
                            due now
                          </span>
                        )}
                        {r.state === 'resolved' && (
                          <span className="font-mono text-[9px] text-emerald-400/80">
                            delivered on retry {r.attempts} · HTTP {r.deliveredStatusCode ?? '—'} · {r.resolvedAtUtc}
                          </span>
                        )}
                        {r.state === 'given-up' && (
                          <span className="font-mono text-[9px] text-rose-400/80">
                            {r.attempts}/{webhook?.retryPolicy.maxRetries ?? 3} retries spent · first failure {r.firstFailedAtUtc}
                          </span>
                        )}
                        {r.state === 'pending' && (
                          <span className="ml-auto flex gap-1.5">
                            <Button
                              onClick={() => void onWebhook('retry-now', undefined, undefined, r.alarmSeq)}
                              disabled={busy === `hk:retry:${r.alarmSeq}`}
                              size="sm"
                              variant="outline"
                              className="h-6 border-amber-800/60 bg-slate-950/60 px-2 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-amber-200 hover:border-amber-600 hover:text-amber-100 disabled:opacity-40"
                            >
                              {busy === `hk:retry:${r.alarmSeq}` ? <RefreshCw className="mr-1 h-2.5 w-2.5 animate-spin" /> : <RotateCw className="mr-1 h-2.5 w-2.5" />}
                              retry now
                            </Button>
                            <Button
                              onClick={() => void onWebhook('dismiss-retry', undefined, undefined, r.alarmSeq)}
                              disabled={busy === `hk:dismiss:${r.alarmSeq}`}
                              size="sm"
                              variant="outline"
                              className="h-6 border-slate-800 bg-slate-950/60 px-2 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500 hover:bg-slate-900 hover:text-slate-300 disabled:opacity-40"
                            >
                              {busy === `hk:dismiss:${r.alarmSeq}` ? <RefreshCw className="mr-1 h-2.5 w-2.5 animate-spin" /> : <Archive className="mr-1 h-2.5 w-2.5" />}
                              dismiss
                            </Button>
                          </span>
                        )}
                      </div>
                      {r.lastError && r.state !== 'resolved' && (
                        <p className="mt-0.5 font-mono text-[9px] leading-relaxed text-slate-500">
                          last error: <span className="text-rose-300">{r.lastError}</span> · last attempt {r.lastAttemptAtUtc ?? '—'}
                        </p>
                      )}
                      {/* attempt ladder + backoff progress — history you can read at a glance */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="flex items-center gap-1" aria-hidden="true">
                          {ladder.map((dot, i) => (
                            <span
                              key={i}
                              title={`${dot.label}: ${dot.ok ? 'delivered' : 'failed'}`}
                              className={`inline-block h-[7px] w-[7px] rounded-full ${
                                dot.ok
                                  ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]'
                                  : 'bg-rose-500/80 shadow-[0_0_5px_rgba(244,63,94,0.35)]'
                              }`}
                            />
                          ))}
                          {r.state === 'pending' && r.attempts < (webhook?.retryPolicy.maxRetries ?? 3) && (
                            <span className="inline-block h-[7px] w-[7px] rounded-full border border-dashed border-amber-500/80" title="next scheduled attempt" />
                          )}
                          {r.state === 'given-up' && (
                            <span className="inline-block h-[7px] w-[7px] rounded-full border border-slate-700 bg-slate-900" title="no further attempts — the gap stays visible" />
                          )}
                        </span>
                        <span className="font-mono text-[8px] uppercase tracking-wider text-slate-600">
                          {ladder.length === 1 ? 'original only' : `${ladder.length - 1} ${ladder.length - 1 === 1 ? 'retry' : 'retries'} on the log`}
                        </span>
                        {barPct !== null && !due && (
                          <span className="flex min-w-[120px] flex-1 items-center gap-2" title={`backoff window ${r.lastAttemptAtUtc} → ${r.nextAttemptUtc} (server clock)`}>
                            <span className="h-1 flex-1 overflow-hidden rounded-full bg-slate-800">
                              <span
                                className="block h-full rounded-full bg-amber-500/70 transition-[width] duration-700 ease-out"
                                style={{ width: `${barPct}%` }}
                              />
                            </span>
                            <span className="font-mono text-[8px] tabular-nums text-slate-600">{barPct}% of backoff</span>
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-2 font-mono text-[8.5px] leading-relaxed text-slate-600">
              the queue is durable (proximity-webhook-retries.jsonl) — a restart does not forget a debt. Resolved rows
              stay as the receipt that the loop closed.
            </p>
          </div>

          {/* delivery log */}
          <div className="mt-2.5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.14em] text-slate-500">
                delivery log · append-only
              </span>
              <span className="font-mono text-[9px] text-slate-600">
                {webhook?.totalDeliveries ?? 0} attempts lifetime
              </span>
            </div>
            {(webhook?.deliveries ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-800 bg-slate-950/40 px-4 py-5 text-center">
                <Send className="h-4 w-4 text-slate-500" />
                <p className="font-mono text-[9.5px] uppercase tracking-wider text-slate-500">no dispatch attempts yet</p>
                <p className="font-mono text-[9px] text-slate-600">set a target and press test — every attempt is logged, ok or failed</p>
              </div>
            ) : (
              <ol className="max-h-[220px] space-y-1 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-800">
                {(webhook?.deliveries ?? []).map((d) => (
                  <li
                    key={d.seq}
                    className={`rounded-lg border px-3 py-2 ${d.ok ? 'border-emerald-900/50 bg-emerald-950/20' : 'border-rose-900/50 bg-rose-950/20'}`}
                  >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-mono text-[10px] font-bold text-slate-400">#{d.seq}</span>
                      {d.ok ? <VerdictChip verdict="OK" /> : <VerdictChip verdict="REFUSED" />}
                      <span className={`font-mono text-[10px] font-semibold ${d.ok ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {d.kind}
                      </span>
                      <span className="rounded border border-slate-700 bg-slate-900/70 px-1 font-mono text-[8.5px] uppercase tracking-wider text-slate-400">
                        {d.mode}
                      </span>
                      {d.mode === 'retry' && d.attempt !== undefined && (
                        <span className="rounded border border-amber-800/60 bg-amber-950/30 px-1 font-mono text-[8.5px] font-bold uppercase tracking-wider text-amber-300" title={`backoff re-attempt number ${d.attempt}`}>
                          ×{d.attempt}
                        </span>
                      )}
                      {d.signatureSent && (
                        <span className="font-mono text-[8.5px] uppercase tracking-wider text-cyan-400/80" title="HMAC-SHA256 signature sent">
                          signed
                        </span>
                      )}
                      <span className="ml-auto font-mono text-[9px] text-slate-600">{d.attemptedAtUtc}</span>
                    </div>
                    <p className="mt-0.5 font-mono text-[9px] leading-relaxed text-slate-500">
                      {d.targetHost} · HTTP {d.statusCode ?? '—'} · {d.latencyMs} ms
                      {d.alarmSeq !== null && ` · alarm #${d.alarmSeq}`}
                      {d.error && <span className="text-rose-300"> · {d.error}</span>}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </Panel>
      </div>

      {/* ═══ RIGHT · EXTERNAL ANCHORS — the phase-two v0 ledger ═══ */}
      <div className="flex flex-col gap-4">
        <Panel
          title="External head anchors"
          icon={<Anchor className="h-3.5 w-3.5" />}
          indicator={anchors?.continuity === 'VALID' ? 'CONTINUITY OK' : anchors?.continuity === 'DRIFT' ? 'DRIFT DETECTED' : 'NO ANCHORS'}
          indicatorTone={anchors?.continuity === 'VALID' ? 'emerald' : anchors?.continuity === 'DRIFT' ? 'rose' : 'slate'}
        >
          <p className="mb-3 text-[10.5px] leading-relaxed text-slate-500">
            Anchoring pins the verified head (position + record_hash) to an append-only store OUTSIDE the database —{' '}
            <span className="font-mono text-slate-400">{anchors?.storePath ?? 'vvu-trust/chains/proximity-heads.jsonl'}</span>. A
            rewritten history drifts from its anchors, even when it re-links itself perfectly. Phase two moves this store
            off-box (object storage / HSM); the line format does not change.
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Metric value={String(anchors?.okCount ?? 0)} unit="pinned" label="anchors replay OK" tone="emerald" />
            <Metric
              value={String((anchors?.driftCount ?? 0) + (anchors?.missingCount ?? 0))}
              unit="disputes"
              label="drift + missing positions"
              tone={(anchors?.driftCount ?? 0) + (anchors?.missingCount ?? 0) > 0 ? 'rose' : 'slate'}
            />
            <Metric
              value={anchors?.coveragePercent === null || anchors === null ? '—' : String(anchors.coveragePercent)}
              unit="% of chain"
              label="anchor coverage of history"
              tone="cyan"
            />
          </div>
          <div className="mt-2.5 flex gap-1.5">
            {noteEcho && (
              <div
                role="status"
                aria-live="polite"
                className="vvu-label w-full text-[8px] font-bold text-[#c8ff00] border border-[#c8ff00]/40 shadow-[0_0_12px_rgba(200,255,0,0.15)] transition-shadow rounded px-2.5 py-2 leading-relaxed"
              >
                DRAFT KEPT · {noteWords} WORD{noteWords === 1 ? '' : 'S'} RESTORED — THE STORM NEVER TAKES A WORD TWICE
              </div>
            )}
          </div>
          <div className="mt-2.5 flex gap-1.5">
            <Input
              value={note}
              onChange={(e) => { setNote(e.target.value); persistNote(e.target.value); }}
              placeholder="anchor note (why this pin matters) — optional"
              aria-label="anchor note"
              className="h-8 flex-1 border-slate-800 bg-slate-950/60 font-mono text-[11px] text-slate-200 placeholder:text-slate-600"
            />
            <Button
              onClick={async () => {
                if (await onPin(note)) {
                  // the anchor landed — a WORM row, not a draft
                  setNote('');
                  if (typeof window !== 'undefined') {
                    clearEstateDraft(window.localStorage, PIN_NOTE_DRAFT_KEY);
                  }
                  setNoteEcho(false);
                }
              }}
              disabled={busy === 'anchor' || broken}
              size="sm"
              className="h-8 shrink-0 border border-cyan-900/70 bg-cyan-950/60 px-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-200 hover:bg-cyan-900/50 disabled:opacity-40"
            >
              {busy === 'anchor' ? <RefreshCw className="mr-1 h-3 w-3 animate-spin" /> : <Anchor className="mr-1 h-3 w-3" />}
              pin head
            </Button>
          </div>
          {broken && (
            <p className="mt-1.5 font-mono text-[9.5px] text-amber-400">
              anchoring is refused while the chain is BROKEN — an anchor is a claim that the past was correct, and the
              kernel does not make claims it has not checked.
            </p>
          )}
          <div className="mt-3 max-h-[300px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-800">
            {(anchors?.anchors ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-800 bg-slate-950/40 px-4 py-6 text-center">
                <Anchor className="h-4 w-4 text-slate-500" />
                <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">no anchors yet</p>
                <p className="font-mono text-[9px] text-slate-600">pin the current verified head — it takes one click</p>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {(anchors?.anchors ?? []).map((a) => (
                  <li key={a.seq} className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-mono text-[10px] font-bold text-slate-400">#{a.seq}</span>
                      <span className="font-mono text-[10px] text-slate-300">
                        head @ pos <span className="font-bold text-cyan-300">#{a.headPosition}</span>
                      </span>
                      {a.status === 'OK' ? (
                        <VerdictChip verdict="OK" />
                      ) : a.status === 'DRIFT' ? (
                        <VerdictChip verdict="BROKEN" />
                      ) : (
                        <VerdictChip verdict="REFUSED" />
                      )}
                      <span className="ml-auto font-mono text-[9.5px] text-slate-600">{a.anchoredAtUtc}</span>
                    </div>
                    <p className="mt-0.5 font-mono text-[9px] text-slate-500">
                      hash {shortHash(a.headHash, 14)} · {a.algorithm}
                      {a.status === 'DRIFT' && <span className="text-rose-300"> · LIVE CHAIN DISAGREES — history rewritten after this pin</span>}
                      {a.status === 'MISSING' && <span className="text-rose-300"> · POSITION NO LONGER ON THE CHAIN — records removed</span>}
                    </p>
                    {a.note && <p className="mt-0.5 font-mono text-[9px] italic text-slate-600">“{a.note}”</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>

        {/* ═══ ANCHOR BUNDLE — evidence that travels ═══ */}
        <Panel
          title="Anchor bundle · off-box v0"
          icon={<FileJson className="h-3.5 w-3.5" />}
          indicator={bundleResult ? bundleResult.bundleIntegrity : 'PORTABLE'}
          indicatorTone={
            bundleResult
              ? bundleResult.bundleIntegrity === 'INTACT'
                ? 'emerald'
                : 'rose'
              : 'cyan'
          }
        >
          <p className="mb-3 text-[10.5px] leading-relaxed text-slate-500">
            The heads file lives on the box it anchors — if the box goes, the pins go with it. The bundle is the off-box
            step available today: one self-describing JSON file (every anchor + chain context + a sha256 over all of it)
            you can carry anywhere. Verify a received bundle against ANY live chain — its hash first, then every anchor
            inside it. The file format is the future object-storage format — and the vault ledger below makes that
            format ACCUMULATE: file a snapshot and every anchor since the last one is preserved on disk, ready to sync.
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Button
              onClick={() => void exportBundle()}
              disabled={bundleBusy}
              size="sm"
              variant="outline"
              className="h-7 flex-1 border-slate-700 bg-slate-950/60 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300 hover:border-cyan-800 hover:text-cyan-200"
            >
              {bundleBusy ? <RefreshCw className="mr-1 h-3 w-3 animate-spin" /> : <Download className="mr-1 h-3 w-3" />}
              export bundle
            </Button>
            <Button
              onClick={() => void verifyBundle()}
              disabled={bundleBusy || bundleText.trim().length === 0}
              size="sm"
              variant="outline"
              className="h-7 flex-1 border-slate-700 bg-slate-950/60 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300 hover:border-emerald-800 hover:text-emerald-200 disabled:opacity-40"
            >
              {bundleBusy ? <RefreshCw className="mr-1 h-3 w-3 animate-spin" /> : <ShieldCheck className="mr-1 h-3 w-3" />}
              verify bundle
            </Button>
            <Button
              onClick={() => void snapshotVault()}
              disabled={vaultBusy}
              size="sm"
              variant="outline"
              className="h-7 flex-1 border-cyan-900/60 bg-cyan-950/30 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-300 hover:border-cyan-700 hover:text-cyan-200 disabled:opacity-40"
            >
              {vaultBusy ? <RefreshCw className="mr-1 h-3 w-3 animate-spin" /> : <LibraryBig className="mr-1 h-3 w-3" />}
              file snapshot
            </Button>
          </div>
          <textarea
            value={bundleText}
            onChange={(e) => {
              setBundleText(e.target.value);
              setBundleResult(null); // stale verdicts clear on new input
            }}
            placeholder="paste a vvu.anchor-bundle.v1 document here — export pre-fills this box, or paste one received from elsewhere"
            rows={4}
            className="mt-2.5 w-full resize-y rounded-lg border border-dashed border-slate-700 bg-slate-950/60 p-2.5 font-mono text-[9.5px] leading-relaxed text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/60"
          />
          {bundleResult && (
            <div
              className={`mt-2.5 rounded-lg border px-3 py-2.5 ${
                bundleResult.bundleIntegrity === 'INTACT'
                  ? 'border-emerald-900/60 bg-emerald-950/25'
                  : 'border-rose-900/60 bg-rose-950/25'
              }`}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <VerdictChip
                  verdict={
                    bundleResult.bundleIntegrity === 'INTACT'
                      ? bundleResult.driftCount + bundleResult.missingCount === 0
                        ? 'PASS'
                        : 'FIRED'
                      : 'BROKEN'
                  }
                />
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-300">
                  bundle {bundleResult.bundleIntegrity}
                </span>
                {bundleResult.exportedAtUtc && (
                  <span className="ml-auto font-mono text-[9px] text-slate-600">exported {bundleResult.exportedAtUtc}</span>
                )}
              </div>
              <p className="mt-1 font-mono text-[9.5px] leading-relaxed text-slate-400">{bundleResult.integrityDetail}</p>
              <p className="mt-1 font-mono text-[10px] font-semibold leading-relaxed text-cyan-200">{bundleResult.verdict}</p>
              {bundleResult.rows.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {bundleResult.rows.map((r) => (
                    <li key={`bundle-${r.seq}`} className="flex flex-wrap items-center gap-x-2 font-mono text-[9px] text-slate-500">
                      <span className="font-bold text-slate-400">#{r.seq}</span>
                      <span>pos #{r.headPosition}</span>
                      {r.status === 'OK' ? (
                        <VerdictChip verdict="OK" />
                      ) : r.status === 'DRIFT' ? (
                        <VerdictChip verdict="BROKEN" />
                      ) : (
                        <VerdictChip verdict="REFUSED" />
                      )}
                      <span>{shortHash(r.headHash, 10)}</span>
                      {r.status === 'DRIFT' && <span className="text-rose-300">live chain disagrees</span>}
                      {r.status === 'MISSING' && <span className="text-rose-300">position gone</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {/* ── VAULT LEDGER (R68) — snapshots that accumulate, still in the
                 object format; syncing them off-box later is a plain copy ── */}
          <div className="mt-3 rounded-lg border border-cyan-900/50 bg-cyan-950/15 p-3">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-300">
                <LibraryBig className="h-3 w-3" aria-hidden />
                vault ledger · snapshots on disk
              </span>
              {vault ? (
                <span className="font-mono text-[9px] uppercase tracking-wider text-slate-500">
                  {vault.total} filed · {vault.gone > 0 ? `${vault.gone} gone` : 'none gone'}
                  {vault.bytes != null ? ` · ${(vault.bytes / 1024).toFixed(1)} kB` : ''}
                </span>
              ) : (
                <span className="font-mono text-[9px] text-slate-600">reading the vault…</span>
              )}
              <button
                type="button"
                onClick={() => void loadVault()}
                disabled={vaultBusy}
                className="ml-auto inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-950/60 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400 hover:border-cyan-800 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500/60 disabled:opacity-40 cursor-pointer"
                title="re-read the vault index"
              >
                {vaultBusy ? <RefreshCw className="h-2.5 w-2.5 animate-spin" aria-hidden /> : <RotateCw className="h-2.5 w-2.5" aria-hidden />}
                refresh
              </button>
            </div>
            <p className="mt-1 font-mono text-[9px] leading-relaxed text-slate-500">
              EVERY SNAPSHOT IS A COMPLETE, SELF-VERIFYING vvu.anchor-bundle.v1 UNDER vvu-trust/bundles/ — REPLAY IT
              AGAINST THE LIVE CHAIN OR DOWNLOAD IT AS-IS. THE DIRECTORY IS THE FUTURE OBJECT STORE: SYNC = COPY.
            </p>
            {vault && vault.snapshots.length === 0 ? (
              <p className="mt-2 rounded-md border border-dashed border-slate-800 bg-slate-950/40 px-3 py-2 font-mono text-[9.5px] text-slate-500">
                THE VAULT IS EMPTY — FILE A SNAPSHOT AND THE LEDGER STARTS. AN EXPORT DOWNLOADED BUT NEVER FILED LEAVES
                NO TRACE ON DISK; THE VAULT IS THE ACCUMULATING COPY.
              </p>
            ) : vault && vault.snapshots.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {vault.snapshots.map((s) => (
                  <li
                    key={s.fileName}
                    className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-md border border-slate-800 bg-slate-950/50 px-2.5 py-1.5"
                  >
                    <span className="font-mono text-[9px] font-bold text-cyan-200">{s.fileName.replace('vvu-anchor-bundle-', '').replace('.json', '')}</span>
                    <span className="font-mono text-[9px] text-slate-500" title={`sha256 ${s.bundleHash}`}>
                      {shortHash(s.bundleHash, 10)}
                    </span>
                    <span className="font-mono text-[9px] text-slate-500">{s.anchors} anchors · head #{s.headPosition ?? '—'}</span>
                    <span className="font-mono text-[9px] text-slate-600">{(s.bytes / 1024).toFixed(1)} kB</span>
                    <span className="ml-auto flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void replayVaultRow(s)}
                        disabled={vaultRowBusy === s.fileName || bundleBusy}
                        className="inline-flex items-center gap-1 rounded-md border border-emerald-900/60 bg-emerald-950/30 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-emerald-300 hover:bg-emerald-900/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/60 disabled:opacity-40 cursor-pointer"
                        title="read the stored snapshot and replay it against the live chain — same verify path as a pasted bundle"
                      >
                        {vaultRowBusy === s.fileName || bundleBusy ? (
                          <RefreshCw className="h-2.5 w-2.5 animate-spin" aria-hidden />
                        ) : (
                          <ShieldCheck className="h-2.5 w-2.5" aria-hidden />
                        )}
                        replay
                      </button>
                      <button
                        type="button"
                        onClick={() => void downloadVaultRow(s)}
                        disabled={vaultRowBusy === s.fileName}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-950/60 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-slate-300 hover:border-cyan-800 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500/60 disabled:opacity-40 cursor-pointer"
                        title="download the stored snapshot file as-is"
                      >
                        <Download className="h-2.5 w-2.5" aria-hidden />
                        get
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {/* ── OFF-BOX SYNC (R69) — the job that makes evidence LEAVE the
                 box. file target = staging rehearsal (real machinery, same
                 geography, honestly labeled); s3 target = the real push.
                 R74 adds the AUTO-MIRROR chip, the journal tail table and
                 the MIRROR AUDIT (independent re-read of the mirror). ── */}
          <div className="mt-3 rounded-lg border border-violet-900/50 bg-violet-950/15 p-3">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">
                <CloudUpload className="h-3 w-3" aria-hidden />
                off-box sync · evidence leaves the box
              </span>
              {sync ? (
                <>
                  {!sync.config.configured ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-amber-900/60 bg-amber-950/40 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-amber-300">
                      no target configured
                    </span>
                  ) : sync.config.target === 's3' ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-900/60 bg-emerald-950/40 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                      s3 · off-box
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md border border-cyan-900/60 bg-cyan-950/40 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-cyan-300">
                      staging mirror · rehearsal
                    </span>
                  )}
                  {sync.config.configured && sync.config.target === 'file' && sync.config.autoSync && (
                    <span
                      className="inline-flex items-center gap-1 rounded-md border border-violet-700/60 bg-violet-900/30 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-violet-200"
                      title={'auto-mirror is ON — every vault snapshot mirrors itself immediately (trigger "auto" in the journal)'}
                    >
                      <span className="vvu-pulse inline-block h-1.5 w-1.5 rounded-full bg-violet-400" aria-hidden />
                      auto-mirror on
                    </span>
                  )}
                </>
              ) : (
                <span className="font-mono text-[9px] text-slate-600">reading sync state…</span>
              )}
              <span className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void runSync()}
                  disabled={syncBusy}
                  className="inline-flex items-center gap-1 rounded-md border border-violet-900/60 bg-violet-950/30 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-violet-300 hover:border-violet-700 hover:text-violet-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/60 disabled:opacity-40 cursor-pointer"
                  title="run the sync job now: manifest → copy/PUT → re-verify → journal row"
                >
                  {syncBusy ? <RefreshCw className="h-2.5 w-2.5 animate-spin" aria-hidden /> : <CloudUpload className="h-2.5 w-2.5" aria-hidden />}
                  run sync
                </button>
                <button
                  type="button"
                  onClick={() => void runAudit()}
                  disabled={auditBusy}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/60 disabled:opacity-40 cursor-pointer ${
                    audit
                      ? audit.ok
                        ? 'border-emerald-800/60 bg-emerald-950/30 text-emerald-300 hover:border-emerald-600 hover:text-emerald-200'
                        : 'border-rose-800/60 bg-rose-950/30 text-rose-300 hover:border-rose-600 hover:text-rose-200'
                      : 'border-slate-700 bg-slate-950/60 text-slate-400 hover:border-emerald-800 hover:text-emerald-200'
                  }`}
                  title="independent mirror audit: re-hash every file from disk, cross-check vault ↔ mirror ↔ manifest (read-only)"
                >
                  {auditBusy ? <RefreshCw className="h-2.5 w-2.5 animate-spin" aria-hidden /> : <ShieldCheck className="h-2.5 w-2.5" aria-hidden />}
                  audit mirror
                </button>
                <button
                  type="button"
                  onClick={() => void loadSync()}
                  disabled={syncBusy}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-950/60 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400 hover:border-violet-800 hover:text-violet-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/60 disabled:opacity-40 cursor-pointer"
                  title="re-read the sync journal"
                >
                  <RotateCw className="h-2.5 w-2.5" aria-hidden />
                  refresh
                </button>
              </span>
            </div>

            {sync && !sync.config.configured && (
              <div className="mt-2 rounded-md border border-dashed border-amber-900/50 bg-amber-950/15 px-3 py-2">
                <p className="font-mono text-[9.5px] leading-relaxed text-amber-200/90">
                  NO SYNC TARGET — NOTHING LEAVES THE BOX, AND THE UI WILL NOT PRETEND OTHERWISE. SET ONE (NO RESTART
                  NEEDED) IN vvu-trust/bundles/sync-target.json:
                </p>
                <ul className="mt-1 space-y-0.5">
                  {sync.config.envContract.map((e) => (
                    <li key={e} className="font-mono text-[9px] text-slate-400">· {e}</li>
                  ))}
                </ul>
              </div>
            )}

            {sync && sync.config.configured && (
              <p className="mt-1 font-mono text-[9px] leading-relaxed text-slate-500">
                TARGET {sync.config.target.toUpperCase()} → {sync.config.detail}
              </p>
            )}

            {sync && sync.last && (
              <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-md border border-slate-800 bg-slate-950/50 px-2.5 py-1.5">
                <span
                  className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${
                    sync.last.state === 'SYNCED' || sync.last.state === 'STAGED'
                      ? 'border-emerald-900/60 bg-emerald-950/40 text-emerald-300'
                      : sync.last.state === 'UNCONFIGURED'
                        ? 'border-amber-900/60 bg-amber-950/40 text-amber-300'
                        : 'border-rose-900/60 bg-rose-950/40 text-rose-300'
                  }`}
                >
                  {sync.last.state}
                </span>
                {sync.last.trigger && (
                  <span
                    className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase tracking-wider ${
                      sync.last.trigger === 'auto'
                        ? 'border-violet-800/60 bg-violet-950/40 text-violet-300'
                        : 'border-slate-700 bg-slate-900/40 text-slate-400'
                    }`}
                    title={sync.last.trigger === 'auto' ? 'this run was fired by the vault snapshot itself' : 'this run was fired by the RUN SYNC button'}
                  >
                    {sync.last.trigger}
                  </span>
                )}
                <span className="font-mono text-[9px] text-slate-400">{sync.last.at}</span>
                <span className="font-mono text-[9px] text-slate-500">
                  {sync.last.pushed} pushed · {sync.last.skipped} already there · {sync.last.verified} verified ·{' '}
                  {sync.last.failed} failed
                </span>
                {sync.last.detail && (
                  <span className="w-full font-mono text-[8.5px] leading-relaxed text-slate-600" title={sync.last.detail}>
                    {sync.last.detail.slice(0, 160)}
                    {(sync.last.detail.length ?? 0) > 160 ? '…' : ''}
                  </span>
                )}
              </div>
            )}

            {/* R74 — the journal tail: the last few sync attempts as rows, so a
                   failed run between two good ones is visible at a glance. */}
            {sync && sync.history.length > 1 && (
              <div className="mt-2 overflow-hidden rounded-md border border-slate-800/80">
                <table className="w-full border-collapse font-mono text-[8.5px] leading-snug">
                  <thead>
                    <tr className="border-b border-slate-800/80 bg-slate-950/70 text-left text-slate-500">
                      <th className="px-2 py-1 font-semibold uppercase tracking-wider">at</th>
                      <th className="px-2 py-1 font-semibold uppercase tracking-wider">state</th>
                      <th className="px-2 py-1 font-semibold uppercase tracking-wider">by</th>
                      <th className="px-2 py-1 text-right font-semibold uppercase tracking-wider">pushed</th>
                      <th className="px-2 py-1 text-right font-semibold uppercase tracking-wider">skip</th>
                      <th className="px-2 py-1 text-right font-semibold uppercase tracking-wider">verif</th>
                      <th className="px-2 py-1 text-right font-semibold uppercase tracking-wider">fail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sync.history.map((row, i) => (
                      <tr
                        key={`${row.at}-${i}`}
                        className={`border-b border-slate-900/60 last:border-b-0 transition-colors duration-150 ${
                          row.state === 'FAILED' || row.state === 'PARTIAL'
                            ? 'bg-rose-950/20 hover:bg-rose-950/30'
                            : 'hover:bg-slate-900/40'
                        }`}
                        title={row.detail ?? undefined}
                      >
                        <td className="whitespace-nowrap px-2 py-1 text-slate-400">{row.at}</td>
                        <td className="px-2 py-1">
                          <span
                            className={`inline-block rounded border px-1 py-px font-bold uppercase tracking-wide ${
                              row.state === 'SYNCED' || row.state === 'STAGED'
                                ? 'border-emerald-900/60 text-emerald-400'
                                : row.state === 'UNCONFIGURED'
                                  ? 'border-amber-900/60 text-amber-400'
                                  : 'border-rose-900/60 text-rose-400'
                            }`}
                          >
                            {row.state}
                          </span>
                        </td>
                        <td className="px-2 py-1 text-slate-500">{row.trigger === 'auto' ? 'auto' : row.trigger === 'manual' ? 'manual' : '—'}</td>
                        <td className="px-2 py-1 text-right text-slate-400">{row.pushed}</td>
                        <td className="px-2 py-1 text-right text-slate-500">{row.skipped}</td>
                        <td className="px-2 py-1 text-right text-slate-400">{row.verified}</td>
                        <td className={`px-2 py-1 text-right font-bold ${row.failed > 0 ? 'text-rose-400' : 'text-slate-600'}`}>{row.failed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="border-t border-slate-900/60 bg-slate-950/70 px-2 py-1 font-mono text-[8px] text-slate-600">
                  JOURNAL TAIL · {sync.journalRows} ROW(S) TOTAL · OLDEST FIRST IN THE FILE, NEWEST FIRST HERE
                </p>
              </div>
            )}

            {/* R74 — the MIRROR AUDIT result: verdict + counts + per-file
                   table. Rendered only after the operator runs one (an audit
                   is an action's result, not ambient chrome). aria-live so a
                   completed audit is announced without a page focus hunt. */}
            {audit && (
              <div className="vvu-audit-in mt-2 rounded-md border border-slate-800 bg-slate-950/60 px-2.5 py-2" aria-live="polite">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${
                      audit.verdict === 'PASS'
                        ? 'border-emerald-900/60 bg-emerald-950/40 text-emerald-300'
                        : audit.verdict === 'DRIFT'
                          ? 'border-rose-900/60 bg-rose-950/40 text-rose-300'
                          : audit.verdict === 'UNREACHABLE'
                            ? 'border-amber-900/60 bg-amber-950/40 text-amber-300'
                            : 'border-amber-900/60 bg-amber-950/40 text-amber-300'
                    }`}
                    title={
                      audit.verdict === 'UNREACHABLE'
                        ? 'the audit is INCOMPLETE — the endpoint would not answer every request; what did come back is in the table'
                        : audit.verdict === 'PASS'
                          ? 'every object re-read from the mirror verifies byte-for-byte against the vault and the manifest, and the signed LIST shows nothing extra under the prefix'
                          : audit.verdict === 'UNEXPECTED'
                            ? 'every vault object verifies, but the signed LIST found object(s) under the prefix the vault does not hold — inventory the extra before trusting the mirror'
                            : audit.verdict === 'INCOMPLETE'
                              ? 'every CHECKED object verifies, but the EXTRA sweep did not finish — the mirror may hold what the sweep could not see; the audit reports the gap instead of claiming a pass'
                              : audit.verdict === 'DRIFT'
                                ? 'the mirror and the vault DISAGREE — read the table, touch nothing'
                                : undefined
                    }
                  >
                    <ShieldCheck className="h-2.5 w-2.5" aria-hidden />
                    {audit.verdict}
                  </span>
                  <span className="font-mono text-[9px] text-slate-500">{audit.auditedAtUtc}</span>
                  <span className="font-mono text-[9px] tabular-nums text-slate-500">
                    {audit.counts.ok} ok · {audit.counts.diverged} diverged · {audit.counts.missing} missing · {audit.counts.extra} extra · {audit.counts.manifestMismatch} manifest
                    {audit.counts.unreachable ? ` · ${audit.counts.unreachable} unreachable` : ''}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[8.5px] leading-relaxed text-slate-500">{audit.message}</p>

                {/* R79 — the transport evidence: what the audit actually DID over
                       the wire. On the page, not in folklore. Cyan accent = the
                       off-box geography (file audits leave this row out). */}
                {audit.transport && (
                  <div className="mt-1.5 flex flex-wrap gap-1" role="group" aria-label="audit transport evidence">
                    {[
                      { label: 'SIGV4', value: 'PATH-STYLE' },
                      { label: 'HEAD OK', value: audit.transport.headOk },
                      { label: 'RE-READ', value: audit.transport.reRead },
                      { label: 'ETAG MD5', value: `${audit.transport.etagMatches}/${audit.transport.headOk}` },
                      { label: 'TIMEOUT', value: `${audit.transport.timeoutMs}MS` },
                      // R82 — the signed LIST: the EXTRA sweep's provenance. Green
                      // when it answered, amber when it failed (the sweep is then
                      // INCOMPLETE — never a silent zero).
                      // R83 — a paginated LIST shows its page count in the value.
                      audit.transport.listOk === true
                        ? {
                            label: 'LIST OK',
                            value:
                              (audit.transport.listPages ?? 1) > 1
                                ? `${audit.transport.mirrorObjects ?? '—'}·${audit.transport.listPages}PG`
                                : (audit.transport.mirrorObjects ?? '—'),
                          }
                        : { label: 'LIST FAILED', value: '—' },
                    ].map((t) => (
                      <span
                        key={t.label}
                        className={`inline-flex min-w-[72px] items-baseline gap-1 rounded border px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider ${
                          t.label === 'LIST FAILED'
                            ? 'border-amber-900/50 bg-amber-950/20'
                            : 'border-cyan-900/40 bg-black/40'
                        }`}
                        title={
                          t.label === 'LIST OK'
                            ? `a signed ListObjectsV2 LIST enumerated the prefix — ${audit.transport?.mirrorObjects ?? '?'} object(s) live there, read across ${audit.transport?.listPages ?? 1} request(s); anything the vault does not hold surfaces as an EXTRA row${(audit.transport?.listPages ?? 1) > 1 ? ' · the continuation loop COMPLETED — the sweep covered the whole prefix' : ''}`
                            : t.label === 'LIST FAILED'
                              ? `the signed LIST did not answer (${audit.transport?.listNote ?? 'no detail'}) — the EXTRA sweep is INCOMPLETE, not zero`
                              : `the audit signed every request with AWS SigV4 — HEAD proves presence, the re-read GET brings the bytes back so sha256 decides; timeout per request ${audit.transport?.timeoutMs}ms`
                        }
                      >
                        <span className="text-slate-500">{t.label}</span>
                        <span className={`font-bold tabular-nums ${t.label === 'LIST FAILED' ? 'text-amber-300' : 'text-cyan-300'}`}>{t.value}</span>
                      </span>
                    ))}
                    {audit.transport.truncated && (
                      <span
                        className="inline-flex min-w-[72px] items-baseline gap-1 rounded border border-amber-900/50 bg-amber-950/20 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider"
                        title="the LIST stopped before covering the whole prefix (page guard hit, or the endpoint stalled without a usable continuation token) — the EXTRA sweep is INCOMPLETE; the audit says so rather than pretending the sweep was whole"
                      >
                        <span className="text-slate-500">LIST</span>
                        <span className="font-bold tabular-nums text-amber-300">TRUNCATED</span>
                      </span>
                    )}
                  </div>
                )}

                {audit.files.length > 0 && (
                  <div className="mt-1.5 overflow-hidden rounded border border-slate-800/80">
                    <table className="w-full border-collapse font-mono text-[8.5px] leading-snug">
                      <thead>
                        <tr className="border-b border-slate-800/80 bg-slate-950/70 text-left text-slate-500">
                          <th className="px-2 py-1 font-semibold uppercase tracking-wider">file</th>
                          <th className="px-2 py-1 font-semibold uppercase tracking-wider">verdict</th>
                          <th className="px-2 py-1 text-right font-semibold uppercase tracking-wider">bytes</th>
                          <th className="px-2 py-1 font-semibold uppercase tracking-wider">sha256 (mirror)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {audit.files.map((f) => (
                          <tr
                            key={f.fileName}
                            className={`border-b border-slate-900/60 last:border-b-0 transition-colors duration-150 ${
                              f.verdict === 'OK'
                                ? 'hover:bg-slate-900/40'
                                : f.verdict === 'UNREACHABLE'
                                  ? 'bg-amber-950/20 hover:bg-amber-950/30'
                                  : 'bg-rose-950/20 hover:bg-rose-950/30'
                            }`}
                            title={
                              f.verdict === 'OK'
                                ? `mirror bytes == vault bytes == manifest claim${f.note ? ` — ${f.note}` : ''}${f.etag ? ` · etag ${f.etag}` : ''}`
                                : f.verdict === 'DIVERGED'
                                  ? `same name, DIFFERENT bytes than the vault — tampering, corruption, or a name collision; a sync will never overwrite it${f.note ? ` — ${f.note}` : ''}`
                                  : f.verdict === 'MISSING'
                                    ? `the vault holds it but the mirror does not — run sync to close the gap${f.note ? ` — ${f.note}` : ''}`
                                    : f.verdict === 'EXTRA'
                                      ? `the mirror holds this bundle-shaped file but the vault does not — inventory it before trusting the mirror${f.note ? ` — ${f.note}` : ''}`
                                      : f.verdict === 'UNREACHABLE'
                                        ? `the audit could not read this object — the row is INCOMPLETE, not a drift verdict${f.note ? ` — ${f.note}` : ''}`
                                        : `file bytes agree vault↔mirror, but the manifest records a different hash — the manifest is the lie${f.note ? ` — ${f.note}` : ''}`
                            }
                          >
                            <td className="max-w-[220px] truncate px-2 py-1 text-slate-300">{f.fileName}</td>
                            <td className="px-2 py-1">
                              <span
                                className={`inline-block rounded border px-1 py-px font-bold uppercase tracking-wide ${
                                  f.verdict === 'OK'
                                    ? 'border-emerald-900/60 text-emerald-400'
                                    : f.verdict === 'EXTRA'
                                      ? 'border-cyan-900/60 text-cyan-400'
                                      : f.verdict === 'UNREACHABLE'
                                        ? 'border-amber-900/60 text-amber-400'
                                        : 'border-rose-900/60 text-rose-400'
                                }`}
                              >
                                {f.verdict === 'MANIFEST_MISMATCH' ? 'MANIFEST' : f.verdict}
                              </span>
                            </td>
                            <td className="px-2 py-1 text-right text-slate-500">{f.bytes ?? '—'}</td>
                            <td className="px-2 py-1 text-slate-600">{f.mirrorHash ? shortHash(f.mirrorHash) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <p className="mt-1 font-mono text-[8px] leading-relaxed text-slate-600">
                  MANIFEST {audit.manifest.present ? `PRESENT · ${audit.manifest.format ?? 'format?'} · ${audit.manifest.entries ?? '?'} ENTRIES` : 'ABSENT'}
                  {audit.manifest.sha256 ? ` · ${shortHash(audit.manifest.sha256)}` : ''}
                  {audit.manifest.note ? ` · ${audit.manifest.note}` : ''}
                  {audit.otherFiles > 0 ? ` · ${audit.otherFiles} non-bundle file(s) ignored` : ''}
                  {audit.transport
                    ? audit.transport.listOk === true
                      ? ` · EXTRA DETECTION RIDES A SIGNED LISTOBJECTSV2 LIST — THE SET RELATION IS PROVEN BOTH WAYS${audit.transport.truncated ? ' (LIST TRUNCATED — SWEEP PARTIAL)' : ''}`
                      : ` · LIST FAILED — THE EXTRA SWEEP IS INCOMPLETE, NOT ZERO`
                    : ''}
                  {' · READ-ONLY — AN AUDIT WRITES NOTHING'}
                </p>
              </div>
            )}

            <p className="mt-2 font-mono text-[9px] leading-relaxed text-slate-600">
              THE STAGING MIRROR RUNS THE FULL MACHINERY — MANIFEST (vvu.sync-manifest.v1, sha256 PER FILE) → COPY →
              RE-READ → HASH COMPARE → JOURNAL — BUT IT IS THE SAME BOX, SO IT PROVES THE PIPELINE, NOT THE GEOGRAPHY.
              R79: AN s3 TARGET IS NOW AUDITED TOO — EVERY KEY GETS A SIGNED SIGV4 HEAD, EVERY OBJECT IS RE-READ
              BYTE-FOR-BYTE, AND THE MANIFEST IS CROSS-CHECKED; R82 ADDED THE SIGNED LIST (LISTOBJECTSV2) SO THE MIRROR
              SIDE IS INVENTORIED AS WELL — AN OBJECT THE VAULT DOES NOT HOLD SURFACES AS AN EXTRA ROW, NEVER A SILENT
              ZERO; R84 PROMOTED THE SWEEP'S OWN HONESTY INTO THE VERDICT ITSELF — A LIST THAT FAILED OR STOPPED EARLY
              IS NOW AN INCOMPLETE VERDICT, NEVER A PASS WITH A FOOTNOTE. THE PATH IS PROVEN END-TO-END AGAINST A SIGNATURE-VALIDATING CONFORMANCE STUB (qa/), AND ITS FIRST
              REAL CLOUD ENDPOINT WILL STILL REPORT HONESTLY WHATEVER IT FINDS. THE AUDIT IS THE SECOND PAIR OF EYES —
              TRUST, BUT VERIFY FROM THE OTHER SIDE.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
