'use client';

// src/components/proximity/ProximityWorkspace.tsx
// src/components/proximity/ProximityWorkspace.tsx
// ─────────────────────────────────────────────────────────────────────────────
// PROXIMITY ▸ RECORD LAYER — the four-step record pipeline, as a workspace.
//
//   STEP 1 CONTRACT      — vvu.proximity.scan.v1 (integer-only, unit-suffixed)
//   STEP 2 GOVERNANCE    — explicit ALLOW / REFUSE gate before the sealer
//   STEP 3 SEAL          — the estate's ONE seal kernel (WormSealIndex +
//                          canonical JCS bytes, stored at seal time)
//   STEP 4 VERIFY        — re-hash the STORED bytes, pinpoint the break
//
// TABS (one tense each):
//   PIPELINE    the Present — live triggers, the rule arrows, the ledger live
//   LEDGER      the Past    — the sealed append-only stream, hash by hash
//   GOVERNANCE  the Rules   — the gate + the suppression decision, allowed vs refused
//   DEVELOPERS  the Core    — the contract audit, the boundary proof, the API
//
// DATA PRESENTATION SPEC (docs/DATA_PRESENTATION_SPEC.md) is enforced here:
//   · NO bare numbers — every value carries unit AND meaning
//     ("821 milli · RISK 0.821", "12500 ms · DWELL 12.5 s")
//   · ONE clock — "YYYY-MM-DD HH:MM:SS UTC", never a local timezone
//   · ATOMIC blocks — one primary system indicator per card
//   · dark base · translucent card backings · border-slate-800 · subtle labels
// ─────────────────────────────────────────────────────────────────────────────

// R62 SPLIT: the five tab modules live in ./tabs/* and load through
// next/dynamic — the shell (state + polling + header + nav) compiles alone,
// each tab compiles on first open. Cuts the single-file compile spike that
// was pushing next-server past the sandbox OOM line (R61 risk #1).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import {
  Activity,
  Clock,
  Database,
  Scale,
  ScanLine,
  ShieldCheck,
  Siren,
  Terminal,
} from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';

import {
  ANCHOR_URL,
  AUDIT_URL,
  CHAIN_URL,
  POLL_MS,
  RECORDS_URL,
  RESTORE_URL,
  SCAN_URL,
  TAMPER_URL,
  VERIFY_URL,
  WATCHDOG_URL,
  WEBHOOK_URL,
  DWELL_THRESHOLD_MS,
  SUPPRESS_THRESHOLD_MILLI,
  fetchJson,
  shortHash,
  type ChainResponse,
  type ScanForm,
  type TabId,
} from './shared';
import {
  riskMilliToDisplay,
  type AnchorLedger,
  type ContractAuditResult,
  type ProximityVerifyResult,
  type RecordsPayload,
  type ScanOutcome,
  type WatchdogStatus,
  type WebhookStatus,
} from '@/lib/proximity/types';

// ─── lazy tabs — compile on first open, not on the estate's boot path ───────

function TabFallback() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-busy="true">
      <Skeleton className="h-72 w-full bg-slate-900/60" />
      <Skeleton className="h-72 w-full bg-slate-900/60" />
    </div>
  );
}

const PipelineTab = dynamic(() => import('./tabs/PipelineTab'), { ssr: false, loading: TabFallback });
const LedgerTab = dynamic(() => import('./tabs/LedgerTab'), { ssr: false, loading: TabFallback });
const GovernanceTab = dynamic(() => import('./tabs/GovernanceTab'), { ssr: false, loading: TabFallback });
const WatchdogTab = dynamic(() => import('./tabs/WatchdogTab'), { ssr: false, loading: TabFallback });
const DevelopersTab = dynamic(() => import('./tabs/DevelopersTab'), { ssr: false, loading: TabFallback });

export default function ProximityWorkspace() {
  const [tab, setTab] = useState<TabId>('pipeline');

  // data
  const [records, setRecords] = useState<RecordsPayload | null>(null);
  const [chain, setChain] = useState<ChainResponse | null>(null);
  const [audit, setAudit] = useState<{ ok: boolean; audit: ContractAuditResult } | null>(null);
  const [watchdog, setWatchdog] = useState<WatchdogStatus | null>(null);
  const [anchors, setAnchors] = useState<AnchorLedger | null>(null);
  const [webhook, setWebhook] = useState<WebhookStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [lastOutcome, setLastOutcome] = useState<ScanOutcome | null>(null);
  const [bytesOpen, setBytesOpen] = useState<string | null>(null);
  const mounted = useRef(true);

  // live UTC clock — the one displayed clock
  const [nowUtc, setNowUtc] = useState(() => new Date());
  useEffect(() => {
    const iv = setInterval(() => setNowUtc(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [r, c, w, a, hk] = await Promise.all([
        fetchJson<RecordsPayload>(RECORDS_URL),
        fetchJson<ChainResponse>(CHAIN_URL),
        fetchJson<{ status: WatchdogStatus }>(WATCHDOG_URL),
        fetchJson<{ ledger: AnchorLedger }>(ANCHOR_URL),
        fetchJson<{ status: WebhookStatus }>(WEBHOOK_URL),
      ]);
      if (!mounted.current) return;
      setRecords(r);
      setChain(c);
      setWatchdog(w.status);
      setAnchors(a.ledger);
      setWebhook(hk.status);
    } catch {
      /* transient — the next poll recovers */
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const iv = setInterval(() => void refresh(), POLL_MS);
    return () => {
      mounted.current = false;
      clearInterval(iv);
    };
  }, [refresh]);

  // audit: load once per mount (it probes the boundary — not a poll)
  useEffect(() => {
    let alive = true;
    void fetchJson<{ ok: boolean; audit: ContractAuditResult }>(AUDIT_URL)
      .then((a) => alive && setAudit(a))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const verification = chain?.verification ?? null;
  const statusByEvent = useMemo(() => {
    const m = new Map<string, 'OK' | 'BROKEN'>();
    verification?.perRecord.forEach((p) => m.set(p.eventId, p.status));
    return m;
  }, [verification]);

  // ── the scan form (STEP 1+2 live preview) ────────────────────────────────
  const [form, setForm] = useState<ScanForm>({
    subjectId: 'vvu-042',
    distanceCm: 45,
    rssiDbm: -52,
    batteryMv: 3720,
    dwellMs: 12500,
    riskMilli: 214,
  });

  const enrolled = records?.enrolledSubjects ?? ['vvu-003', 'vvu-017', 'vvu-042', 'vvu-108'];
  const isEnrolled = enrolled.includes(form.subjectId);
  const suppressFires = form.riskMilli > SUPPRESS_THRESHOLD_MILLI;
  const dwellFires = form.dwellMs > DWELL_THRESHOLD_MS;

  const fireScan = useCallback(async () => {
    setBusy('scan');
    try {
      const body = {
        subject_id: form.subjectId,
        source: 'simulator', // the trigger IS the simulator partition
        distance_cm: form.distanceCm,
        rssi_dbm: form.rssiDbm,
        battery_mv: form.batteryMv,
        dwell_ms: form.dwellMs,
        risk_milli: form.riskMilli,
        occurred_at: new Date().toISOString(),
      };
      const res = await fetch(SCAN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { ok: boolean; outcome?: ScanOutcome; detail?: string; error?: string };
      if (!json.ok || !json.outcome) throw new Error(json.detail ?? json.error ?? 'scan refused');
      setLastOutcome(json.outcome);
      if (json.outcome.gate.decision === 'REFUSE') {
        toast.warning(`GATE REFUSED · ${json.outcome.gate.reason}`, {
          description: 'Refused scans are recorded in the decision log and never sealed.',
        });
      } else if (json.outcome.action === 'SUPPRESS') {
        toast.success(`SEALED #${json.outcome.seal?.position ?? '?'} · ACTION SUPPRESSED`, {
          description: `risk_milli ${form.riskMilli} (RISK ${riskMilliToDisplay(form.riskMilli)}) > 820 threshold — evidence sealed, action suppressed.`,
        });
      } else {
        toast.success(`SEALED #${json.outcome.seal?.position ?? '?'}`, {
          description: 'Scan passed the gate and sealed through the estate kernel.',
        });
      }
      await refresh();
    } catch (e) {
      toast.error('SCAN REFUSED AT THE CONTRACT', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  }, [form, refresh]);

  const runVerify = useCallback(async () => {
    setBusy('verify');
    try {
      const v = await fetchJson<{ verification: ProximityVerifyResult }>(VERIFY_URL, { method: 'POST' });
      if (v.verification.valid) {
        toast.success(`CHAIN VALID · ${v.verification.records} records`, {
          description: `head ${shortHash(v.verification.headHash, 16)} · checked in ${v.verification.checkedInMs} ms · ${v.verification.checkedAtUtc}`,
        });
      } else {
        toast.error(`CHAIN BROKEN AT ${v.verification.brokenAt}`, { description: v.verification.reason ?? '' });
      }
      await refresh();
    } catch (e) {
      toast.error('VERIFY FAILED', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  }, [refresh]);

  const tamper = useCallback(
    async (eventId: string, source: string) => {
      if (source === 'production') {
        // The UI never even sends it — but the SERVER is the boundary.
        toast.error('PRODUCTION IMMUTABLE', {
          description: 'Production sources are never mutable — only the simulator partition is demoable. The boundary is enforced in code.',
        });
        return;
      }
      setBusy(`tamper:${eventId}`);
      try {
        const res = await fetch(TAMPER_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ eventId }),
        });
        const json = (await res.json()) as { ok: boolean; fromValue?: number; toValue?: number; detail?: string };
        if (!res.ok || !json.ok) throw new Error(json.detail ?? 'tamper refused');
        toast.warning(`STORED BYTES REWRITTEN — ${eventId.slice(0, 26)}…`, {
          description: `distance_cm ${json.fromValue} cm → ${json.toValue} cm. Run VERIFY: the chain will break at this exact record.`,
        });
        await refresh();
      } catch (e) {
        toast.error('TAMPER REFUSED', { description: e instanceof Error ? e.message : String(e) });
      } finally {
        setBusy(null);
      }
    },
    [refresh],
  );

  const restore = useCallback(
    async (eventId: string) => {
      setBusy(`restore:${eventId}`);
      try {
        const res = await fetch(RESTORE_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ eventId }),
        });
        const json = (await res.json()) as { ok: boolean; detail?: string };
        if (!res.ok || !json.ok) throw new Error(json.detail ?? 'restore refused');
        toast.success('BYTES RESTORED FROM THE RECORD ROW', {
          description: 'Original canonical bytes rebuilt through the same canonicalizer — the chain returns to VALID.',
        });
        await refresh();
      } catch (e) {
        toast.error('RESTORE REFUSED', { description: e instanceof Error ? e.message : String(e) });
      } finally {
        setBusy(null);
      }
    },
    [refresh],
  );

  // ── the sentinel (watchdog) + the anchor ledger ──────────────────────────
  const watchdogAction = useCallback(
    async (action: 'enable' | 'disable' | 'run-now') => {
      setBusy(`wd:${action}`);
      try {
        const res = await fetch(WATCHDOG_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action }),
        });
        const json = (await res.json()) as {
          ok: boolean;
          detail?: string;
          status?: WatchdogStatus;
          pass?: { valid: boolean; brokenAt: string | null; reason: string | null; latencyMs: number; records: number };
        };
        if (json.status) setWatchdog(json.status);
        if (action === 'run-now' && json.pass) {
          if (json.pass.valid) {
            toast.success(`SENTINEL PASS OK · ${json.pass.records} records`, {
              description: `head verified in ${json.pass.latencyMs} ms — the stored bytes still match their digests.`,
            });
          } else {
            toast.error(`SENTINEL ALARM · CHAIN BROKEN AT ${json.pass.brokenAt}`, { description: json.pass.reason ?? '' });
          }
        } else if (json.detail) {
          toast.success(`SENTINEL ${action === 'enable' ? 'ARMED' : 'DISARMED'}`, { description: json.detail });
        }
      } catch (e) {
        toast.error('WATCHDOG ACTION FAILED', { description: e instanceof Error ? e.message : String(e) });
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  // R196 — both actions answer their outcome (true = the act landed), so
  // the caller can end the draft honestly (a saved config/anchor is a
  // WORM row, not a draft — the ghost law needs the verdict).
  const pinHead = useCallback(async (note: string): Promise<boolean> => {
    setBusy('anchor');
    try {
      const res = await fetch(ANCHOR_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ note }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        anchored?: boolean;
        alreadyAnchored?: boolean;
        reason?: string | null;
        ledger?: AnchorLedger;
        error?: string;
      };
      if (json.ledger) setAnchors(json.ledger);
      if (!json.ok) throw new Error(json.error ?? json.reason ?? 'anchor refused');
      if (json.alreadyAnchored) {
        toast.info('HEAD ALREADY ANCHORED', {
          description: json.reason ?? 'idempotent — the last pin matches this exact head hash',
        });
      } else {
        toast.success('HEAD ANCHORED OUTSIDE THE DATABASE', {
          description: 'position + record_hash pinned to the append-only anchor store — replayed on every continuity check.',
        });
      }
      return true;
    } catch (e) {
      toast.error('ANCHOR REFUSED', { description: e instanceof Error ? e.message : String(e) });
      return false;
    } finally {
      setBusy(null);
    }
  }, []);

  // ── out-of-band dispatch (set | clear | test) ─────────────────────────────
  const webhookAction = useCallback(
    async (
      action: 'set' | 'clear' | 'test' | 'retry-now' | 'dismiss-retry',
      url?: string,
      secret?: string,
      alarmSeq?: number,
    ): Promise<boolean> => {
      setBusy(`hk:${action === 'retry-now' && alarmSeq !== undefined ? `retry:${alarmSeq}` : action === 'dismiss-retry' && alarmSeq !== undefined ? `dismiss:${alarmSeq}` : action}`);
      try {
        const res = await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action, url, secret, alarmSeq }),
        });
        const json = (await res.json()) as {
          ok: boolean;
          detail?: string;
          error?: string;
          status?: WebhookStatus;
        };
        if (json.status) setWebhook(json.status);
        if (action === 'retry-now' || action === 'dismiss-retry') {
          if (json.ok) {
            toast.success(action === 'retry-now' ? 'RETRY ATTEMPTED' : 'RETRY RETIRED', { description: json.detail });
          } else {
            toast.warning('RETRY ACTION REFUSED', { description: json.error ?? 'no such queue row' });
          }
          return json.ok;
        }
        if (action === 'test') {
          if (json.ok) {
            toast.success('TEST DELIVERED', { description: json.detail });
          } else {
            toast.warning('TEST NOT DELIVERED', { description: json.detail ?? 'no webhook configured' });
          }
          return json.ok;
        }
        if (json.ok) {
          toast.success(`DISPATCH ${action === 'set' ? 'CONFIGURED' : 'CLEARED'}`, { description: json.detail });
          return true;
        }
        throw new Error(json.detail ?? 'webhook action refused');
      } catch (e) {
        toast.error('WEBHOOK ACTION FAILED', { description: e instanceof Error ? e.message : String(e) });
        return false;
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  // ─── header state ─────────────────────────────────────────────────────────
  const chainValid = verification?.valid ?? null;
  const headerTone =
    chainValid === null ? 'slate' : chainValid ? 'emerald' : 'rose';

  const tabs: { id: TabId; label: string; icon: React.ReactNode; hint: string; badge?: React.ReactNode }[] = [
    { id: 'pipeline', label: 'PIPELINE', icon: <Activity className="h-3.5 w-3.5" />, hint: 'the present · live triggers' },
    {
      id: 'ledger',
      label: 'STATE LEDGER',
      icon: <Database className="h-3.5 w-3.5" />,
      hint: 'the past · sealed hashes',
      badge:
        chain?.verification.records != null ? (
          <span className="rounded border border-slate-700 bg-slate-900/80 px-1 font-mono text-[9px] tabular-nums text-slate-400" title="records sealed on the stream">
            {chain.verification.records}
          </span>
        ) : undefined,
    },
    { id: 'governance', label: 'GOVERNANCE', icon: <Scale className="h-3.5 w-3.5" />, hint: 'the rules · allowed vs refused' },
    {
      id: 'watchdog',
      label: 'WATCHDOG',
      icon: <Siren className="h-3.5 w-3.5" />,
      hint: 'the sentinel · alarms + anchors',
      badge:
        verification?.valid === false ? (
          <span className="rounded border border-rose-900/70 bg-rose-950/50 px-1 font-mono text-[9px] font-bold text-rose-300" title="chain broken — the rail holds the evidence">
            ALARM
          </span>
        ) : watchdog && watchdog.alarmCount > 0 ? (
          <span className="rounded border border-amber-900/70 bg-amber-950/50 px-1 font-mono text-[9px] tabular-nums text-amber-300" title="alarms on the append-only rail (historical evidence)">
            {watchdog.alarmCount}
          </span>
        ) : undefined,
    },
    { id: 'developers', label: 'DEVELOPERS', icon: <Terminal className="h-3.5 w-3.5" />, hint: 'the core · audit + API' },
  ];

  return (
    <div className="relative min-h-screen bg-[#04060c] pb-10 font-sans text-slate-300">
      {/* grid + vignette backdrop — the ops-room texture */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          backgroundImage:
            'linear-gradient(rgba(148,163,184,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.045) 1px, transparent 1px), radial-gradient(ellipse 90% 55% at 50% -8%, rgba(34,211,238,0.075), transparent 70%)',
          backgroundSize: '44px 44px, 44px 44px, 100% 100%',
        }}
      />
      {/* ── header band ─────────────────────────────────────────────────── */}
      <header className="border-b border-slate-800 bg-slate-950/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/80">
              <ScanLine className="h-4 w-4 text-cyan-300" />
            </span>
            <div>
              <h1 className="bg-gradient-to-r from-cyan-200 via-slate-100 to-violet-300 bg-clip-text text-sm font-bold uppercase tracking-[0.16em] text-transparent">PROXIMITY ▸ RECORD LAYER</h1>
              <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500">
                contract → governance gate → seal → verify · runs local, no cloud, no beacons
              </p>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <div className="text-right">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">stream</div>
              <div className="font-mono text-[11px] text-cyan-300">proximity.gqeberha.v1</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">kernel (one, reused)</div>
              <div className="font-mono text-[11px] text-violet-300">VVU-WORM-v1</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">head hash</div>
              <div className="font-mono text-[11px] text-slate-300">{shortHash(verification?.headHash ?? null, 14)}</div>
            </div>
            {/* the sentinel — visible from every tab. Header = CURRENT state
                (broken pulses rose / on watch emerald / disarmed slate); rail
                history lives on the WATCHDOG tab's panels, where it belongs. */}
            <button
              onClick={() => setTab('watchdog')}
              title="open the watchdog"
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${
                verification?.valid === false
                  ? 'border-rose-900/70 bg-rose-950/50 text-rose-300 animate-pulse'
                  : watchdog?.running
                    ? 'border-emerald-900/70 bg-emerald-950/50 text-emerald-300 hover:border-emerald-700'
                    : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-500'
              }`}
            >
              <span className="relative flex h-2 w-2">
                {watchdog?.running && (verification?.valid ?? true) && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${
                    verification?.valid === false ? 'bg-rose-400' : watchdog?.running ? 'bg-emerald-400' : 'bg-slate-500'
                  }`}
                />
              </span>
              {verification?.valid === false
                ? `ALARM · BROKEN AT ${verification.brokenAt}`
                : watchdog?.running
                  ? `SENTINEL · ON WATCH · ${(watchdog?.intervalMs ?? 30000) / 1000}s`
                  : 'SENTINEL · DISARMED'}
            </button>
            <span
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] ${
                headerTone === 'emerald'
                  ? 'border-emerald-900/70 bg-emerald-950/50 text-emerald-300'
                  : headerTone === 'rose'
                    ? 'border-rose-900/70 bg-rose-950/50 text-rose-300'
                    : 'border-slate-700 bg-slate-900/60 text-slate-400'
              }`}
            >
              <ShieldCheck className="h-3 w-3" />
              {chainValid === null ? 'VERIFYING…' : chainValid ? `VALID · ${verification?.records} SEALED` : `BROKEN AT ${verification?.brokenAt}`}
            </span>
            <div className="flex items-center gap-1.5 border-l border-slate-800 pl-4">
              <Clock className="h-3.5 w-3.5 text-slate-500" />
              <span className="font-mono text-[11px] tabular-nums text-slate-400">
                {nowUtc.toISOString().slice(0, 10)} {nowUtc.toISOString().slice(11, 19)} UTC
              </span>
            </div>
          </div>
        </div>

        {/* tab nav */}
        <nav className="mx-auto flex max-w-[1600px] gap-1 overflow-x-auto px-4 sm:px-6" aria-label="workspace sections">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`group flex shrink-0 items-center gap-2 rounded-t-lg border-b-2 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#04060c] ${
                tab === t.id
                  ? 'border-cyan-400 text-cyan-200 drop-shadow-[0_0_8px_rgba(34,211,238,0.45)]'
                  : 'border-transparent text-slate-500 hover:border-slate-700 hover:text-slate-300'
              }`}
            >
              {t.icon}
              {t.label}
              {t.badge}
              <span className="hidden text-[9px] font-normal normal-case tracking-normal text-slate-600 lg:inline">{t.hint}</span>
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
        {tab === 'pipeline' && (
          <PipelineTab
            records={records}
            chain={chain}
            statusByEvent={statusByEvent}
            form={form}
            setForm={setForm}
            enrolled={enrolled}
            isEnrolled={isEnrolled}
            suppressFires={suppressFires}
            dwellFires={dwellFires}
            fireScan={fireScan}
            busy={busy}
            lastOutcome={lastOutcome}
            onVerify={runVerify}
            onTamper={tamper}
            onRestore={restore}
          />
        )}
        {tab === 'ledger' && (
          <LedgerTab
            chain={chain}
            statusByEvent={statusByEvent}
            busy={busy}
            bytesOpen={bytesOpen}
            setBytesOpen={setBytesOpen}
            onVerify={runVerify}
            onTamper={tamper}
            onRestore={restore}
          />
        )}
        {tab === 'governance' && <GovernanceTab records={records} lastOutcome={lastOutcome} />}
        {tab === 'watchdog' && (
          <WatchdogTab
            watchdog={watchdog}
            anchors={anchors}
            webhook={webhook}
            verification={verification}
            busy={busy}
            onAction={watchdogAction}
            onPin={pinHead}
            onVerify={runVerify}
            onWebhook={webhookAction}
          />
        )}
        {tab === 'developers' && <DevelopersTab audit={audit} />}
      </main>
    </div>
  );
}

