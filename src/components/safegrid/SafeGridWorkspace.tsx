'use client';

// src/components/safegrid/SafeGridWorkspace.tsx — Round 57 · #/safegrid
// SAFEGRID ▸ EVIDENCE_RELAY — the OPERATOR CONSOLE for the SafeGrid → VVU
// evidence pipeline (the 30th projection of the estate).
//
//   Producer (SafeGrid mini-service, :3008 — fetched THROUGH THE GATEWAY,
//   relative path + ?XTransformPort=3008, never a direct port URL):
//     POST /v1/alerts → §4 fail-closed decision → ONE transaction
//     {decision + integration_outbox} → relay worker → VVU inbox.
//   Consumer (VVU, same origin):
//     POST /api/safegrid/inbox → WORM hash chain (worm_seal_index).
//
//   * Every panel polls on ONE 2.5 s interval pass (setInterval + cleanup,
//     an in-flight guard prevents fetch storms when the gateway is slow).
//   * §1 THE ORDERING DECISION is the headline: the WORM chain's append
//     order is the authoritative order for the stream. Nothing else is.
//   * The operator actions drive the REAL admin/test hooks (DISCLOSED —
//     the same hooks the acceptance suite uses); every result lands in a
//     toast and live-refreshes the panels.
//   * NO indigo/blue; estate SCADA palette only. Tags: MEASURED (lime) ·
//     REPORTED (sage) · DERIVED (ochre) · SPEC (amber).
//
// BigInt note: worm_seal_index.position arrives as STRING (JSON transport
// of BigInt) — rendered as-is, sorted numerically per stream.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  Cable,
  HeartPulse,
  Inbox,
  Link2,
  ListOrdered,
  Power,
  RadioTower,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Siren,
  Stamp,
  Zap,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import type { ChainVerifyResult, InboxRowView, InboxStatus, SealRowView } from '@/lib/safegrid/types';

// ─── endpoints (ALL relative — the gateway contract) ────────────────────────

const SG_GATEWAY = 'XTransformPort=3008'; // SafeGrid mini-service through the gateway

const CHAIN_URL = '/api/safegrid/chain?limit=50';
const INBOX_URL = '/api/safegrid/inbox?limit=25';
const VVU_HEALTH_URL = '/api/safegrid/health';
const RECONCILE_URL = '/api/safegrid/reconcile?olderThanMs=0';
const OUTBOX_URL = `/v1/outbox/status?${SG_GATEWAY}`;
const DECISIONS_URL = `/v1/decisions?limit=12&${SG_GATEWAY}`;
const ALERTS_URL = `/v1/alerts?${SG_GATEWAY}`;
const RELAY_TICK_URL = `/v1/outbox/relay/tick?${SG_GATEWAY}`;
const REQUEUE_URL = `/v1/outbox/failed/requeue?${SG_GATEWAY}`;
const POLICY_ADMIN_URL = `/v1/admin/policy?${SG_GATEWAY}`;
const CONSENT_ADMIN_URL = `/v1/admin/consent?${SG_GATEWAY}`;
const VVU_HEALTH_ADMIN_URL = `/v1/admin/vvu-health?${SG_GATEWAY}`;
const RELAY_ADMIN_URL = `/v1/admin/relay?${SG_GATEWAY}`;

const POLL_MS = 2500;
const TENANT = 'tenant-gqeberha'; // the demo tenant — stream scope = tenant_id (declared)

// ─── response contracts (live-tested against the running services) ──────────

interface ChainResponse {
  ok: boolean;
  seals: SealRowView[];
  verification: ChainVerifyResult;
}

interface InboxResponse {
  ok: boolean;
  rows: InboxRowView[];
  counts: Partial<Record<InboxStatus, number>>;
}

interface VvuHealthResponse {
  ok: boolean;
  service: string;
  backlog: number;
  sealed: number;
  streams: number;
  reconciler: { running: boolean; intervalMs: number };
  checkedAt: string;
}

type Risk = 'low' | 'high' | 'unknown';

interface DecisionRow {
  id: number; // local insertion order — diagnostic only (§1)
  alertId: string;
  tenantId: string;
  cameraId: string;
  risk: Risk | string;
  decision: 'suppress' | 'hold' | 'escalate' | string;
  policyEpoch: number | null;
  policyFreshness: 'fresh' | 'stale' | 'missing' | string;
  localConsentValid: boolean;
  localCeilingAllows: boolean;
  vvuState: 'healthy' | 'degraded' | 'unavailable' | string;
  decidedAt: string;
  outboxState: 'pending' | 'processing' | 'delivered' | 'failed' | null;
  outboxAttempts: number | null;
  outboxLastError: string | null;
  eventId: string | null;
}

interface DecisionsResponse {
  ok: boolean;
  decisions: DecisionRow[];
}

interface OutboxStatusResponse {
  ok: boolean;
  counts: { pending: number; processing: number; delivered: number; failed: number };
  due: number;
  relay: {
    running: boolean;
    ticks: number;
    postsOk: number;
    postsDuplicate: number;
    postsFailed: number;
    deadLettered: number;
    lastError: string | null;
    lastTickAt: string | null;
    cooldownUntil: string | null;
    leaseMs: number;
  };
  vvu: {
    state: 'healthy' | 'degraded' | 'unavailable' | string;
    backlogDepth: number;
    checkedAt: string;
    lastError: string | null;
  };
  policy: { freshness: 'fresh' | 'stale' | 'missing' | string; epoch: number | null };
}

interface AlertDecisionResponse {
  ok: boolean;
  decision: 'suppress' | 'hold' | 'escalate' | string;
  local_decision_id: number;
  event_id: string;
  stream_id: string;
  vvu_state: string;
  policy_freshness: string;
  evidence: {
    local_consent_valid: boolean;
    local_ceiling_allows: boolean;
    risk: Risk | string;
    backlog_depth: number;
    backlog_ceiling: number;
  };
}

interface ReconcileResponse {
  ok: boolean;
  summary: {
    inspected: number;
    sealedFromExisting: number;
    sealedByAppend: number;
    stillFailing: number;
    errors: string[];
  };
}

interface RelayTickResponse {
  ok: boolean;
  tick: { claimed: number; sealed: number; duplicate: number; failed: number };
}

// ─── fetch helpers ───────────────────────────────────────────────────────────

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
    cache: 'no-store',
  });
  const data = (await res.json().catch(() => null)) as (T & { ok?: boolean; error?: string }) | null;
  if (!res.ok || !data || data.ok === false) {
    throw new Error((data && typeof data.error === 'string' && data.error) || `HTTP ${res.status}`);
  }
  return data;
}

// ─── formatting + tone helpers (estate palette) ──────────────────────────────

function stamp(iso: string): string {
  return iso.replace('T', ' ').replace(/\.\d+Z$/, 'Z');
}

function shortHash(hash: string): string {
  return `${hash.slice(0, 12)}…`;
}

const VVU_STATE_TONE: Record<string, string> = {
  healthy: 'border-[#c8ff00]/50 text-[#c8ff00]',
  degraded: 'border-[#e0a030]/50 text-[#e0a030]',
  unavailable: 'border-[#e5484d]/60 text-[#e5484d]',
};

const INBOX_STATUS_TONE: Record<InboxStatus, string> = {
  sealed: 'border-[#c8ff00]/50 text-[#c8ff00]',
  seal_failed: 'border-[#e5484d]/60 text-[#e5484d]',
  sealing: 'border-[#e0a030]/50 text-[#e0a030]',
  received: 'border-[#e0a030]/50 text-[#e0a030]',
};

const OUTBOX_STATE_TONE: Record<string, string> = {
  delivered: 'border-[#c8ff00]/50 text-[#c8ff00]',
  failed: 'border-[#e5484d]/60 text-[#e5484d]',
  processing: 'border-[#e0a030]/50 text-[#e0a030]',
  pending: 'border-[#e0a030]/50 text-[#e0a030]',
};

const RISK_TONE: Record<string, string> = {
  low: 'border-[#c8ff00]/50 text-[#c8ff00]',
  high: 'border-[#e5484d]/60 text-[#e5484d]',
  unknown: 'border-[rgba(107,138,64,0.45)] text-[#7a8a6e]',
};

const DECISION_TONE: Record<string, string> = {
  suppress: 'border-[#c8ff00]/50 text-[#c8ff00]',
  hold: 'border-[#e0a030]/50 text-[#e0a030]',
  escalate: 'border-[#e5484d]/60 text-[#e5484d]',
};

const FRESHNESS_TONE: Record<string, string> = {
  fresh: 'border-[#c8ff00]/50 text-[#c8ff00]',
  stale: 'border-[#e0a030]/50 text-[#e0a030]',
  missing: 'border-[#e5484d]/60 text-[#e5484d]',
};

function Tag({ children, tone }: { children: ReactNode; tone: string }) {
  return (
    <span className={`vvu-label text-[8px] px-1.5 py-0.5 border rounded whitespace-nowrap ${tone}`}>
      {children}
    </span>
  );
}

function StatChip({ label, value, tone, title }: { label: string; value: number | string; tone: string; title?: string }) {
  return (
    <span
      title={title}
      className={`vvu-label text-[8px] px-1.5 py-0.5 border rounded tabular-nums whitespace-nowrap ${tone}`}
    >
      {label} {value}
    </span>
  );
}

// ─── §1 — the ordering decision rows (REPORTED — operator-decided) ──────────

const ORDERING_ROWS: string[] = [
  'The WORM chain\u2019s append order is the authoritative order for the stream. Nothing else is.',
  'No sequence field in the payload — ever (VVU refuses it: SEQUENCE_FIELD_FORBIDDEN).',
  'local_decision_id = SafeGrid-local insertion order — diagnostic only.',
  'worm_seal_index.position = assigned by the append, monotonic per stream.',
  'No timestamp establishes order — all timestamps informational.',
  'Stream scope: stream_id = tenant_id (declared).',
];

// ─── the workspace ───────────────────────────────────────────────────────────

export function SafeGridWorkspace() {
  // panel state — one 2.5 s interval pass fetches every endpoint
  const [chain, setChain] = useState<ChainResponse | null>(null);
  const [inbox, setInbox] = useState<InboxResponse | null>(null);
  const [outbox, setOutbox] = useState<OutboxStatusResponse | null>(null);
  const [decisions, setDecisions] = useState<DecisionsResponse | null>(null);
  const [vvuHealth, setVvuHealth] = useState<VvuHealthResponse | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [chainDown, setChainDown] = useState(false);
  const [inboxDown, setInboxDown] = useState(false);
  const [producerDown, setProducerDown] = useState(false);
  const [decisionsDown, setDecisionsDown] = useState(false);

  // operator action busy state (per-button loading)
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  // the SIMULATE ALERT inline form
  const [alertFormOpen, setAlertFormOpen] = useState(false);
  const [alertId, setAlertId] = useState('');
  const [risk, setRisk] = useState<Risk>('low');
  const [score, setScore] = useState(20);

  const inflight = useRef(false);

  const refresh = useCallback(async () => {
    if (inflight.current) return; // no fetch storms when the gateway is slow
    inflight.current = true;
    try {
      const [chainRes, inboxRes, outboxRes, decisionsRes, healthRes] = await Promise.allSettled([
        fetchJson<ChainResponse>(CHAIN_URL),
        fetchJson<InboxResponse>(INBOX_URL),
        fetchJson<OutboxStatusResponse>(OUTBOX_URL),
        fetchJson<DecisionsResponse>(DECISIONS_URL),
        fetchJson<VvuHealthResponse>(VVU_HEALTH_URL),
      ]);
      if (chainRes.status === 'fulfilled') { setChain(chainRes.value); setChainDown(false); }
      else setChainDown(true);
      if (inboxRes.status === 'fulfilled') { setInbox(inboxRes.value); setInboxDown(false); }
      else setInboxDown(true);
      // the SafeGrid producer is reached through the gateway (:81 → :3008);
      // direct :3000 access honestly reports the producer unreachable.
      if (outboxRes.status === 'fulfilled') { setOutbox(outboxRes.value); setProducerDown(false); }
      else setProducerDown(true);
      if (decisionsRes.status === 'fulfilled') { setDecisions(decisionsRes.value); setDecisionsDown(false); }
      else setDecisionsDown(true);
      if (healthRes.status === 'fulfilled') setVvuHealth(healthRes.value);
      setFetchedAt(new Date());
    } finally {
      inflight.current = false;
    }
  }, []);

  useEffect(() => {
    void refresh();
    const iv = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(iv);
  }, [refresh]);

  // ── operator action runner: busy state → toast → live refresh ──
  const runAction = useCallback(
    async (key: string, action: () => Promise<void>) => {
      setBusy((b) => ({ ...b, [key]: true }));
      try {
        await action();
      } catch (e) {
        toast.error('ACTION FAILED', { description: e instanceof Error ? e.message : String(e) });
      } finally {
        setBusy((b) => ({ ...b, [key]: false }));
        void refresh();
      }
    },
    [refresh],
  );

  const isBusy = (key: string): boolean => busy[key] === true;

  // ── the actions (all REAL endpoints — the disclosed admin/test hooks) ──

  const openAlertForm = () => {
    setAlertId(`ui-${Math.random().toString(36).slice(2, 8)}`);
    setRisk('low');
    setScore(20);
    setAlertFormOpen(true);
  };

  const submitAlert = () =>
    runAction('alert', async () => {
      const data = await postJson<AlertDecisionResponse>(ALERTS_URL, {
        alert_id: alertId || `ui-${Math.random().toString(36).slice(2, 8)}`,
        tenant_id: TENANT,
        camera_id: 'cam-07',
        risk,
        classification: 'ui_sim',
        score,
      });
      toast(`ALERT ${data.event_id}`, {
        description:
          `DECISION ${data.decision.toUpperCase()} · LOCAL #${data.local_decision_id} (DIAGNOSTIC) · ` +
          `RISK ${String(data.evidence.risk).toUpperCase()} · POLICY ${data.policy_freshness.toUpperCase()} · ` +
          `CONSENT ${data.evidence.local_consent_valid ? 'YES' : 'NO'} · CEILING ${data.evidence.local_ceiling_allows ? 'OK' : 'BLOCKED'} · ` +
          `VVU ${String(data.vvu_state).toUpperCase()} · BACKLOG ${data.evidence.backlog_depth}/${data.evidence.backlog_ceiling}`,
      });
      setAlertFormOpen(false);
    });

  const runReconcile = () =>
    runAction('reconcile', async () => {
      const data = await postJson<ReconcileResponse>(RECONCILE_URL, {});
      const s = data.summary;
      toast('RECONCILE PASS COMPLETE', {
        description:
          `INSPECTED ${s.inspected} · REPAIRED-FROM-SEAL ${s.sealedFromExisting} · SEALED-BY-APPEND ${s.sealedByAppend} · ` +
          `FAILING ${s.stillFailing}${s.errors.length > 0 ? ` · ERRORS: ${s.errors[0]}` : ' · NEVER RE-APPENDS'}`,
      });
    });

  const runRelayTick = () =>
    runAction('relayTick', async () => {
      const data = await postJson<RelayTickResponse>(RELAY_TICK_URL, {});
      const t = data.tick;
      toast('RELAY TICK — ONE PASS NOW', {
        description: `CLAIMED ${t.claimed} · SEALED ${t.sealed} · DUPLICATE ${t.duplicate} · FAILED ${t.failed}`,
      });
    });

  const refreshPolicyEpoch = () =>
    runAction('policy', async () => {
      const current = outbox?.policy.epoch ?? 0;
      const data = await postJson<{ ok: boolean; policy: { freshness: string; epoch: number | null } }>(POLICY_ADMIN_URL, {
        epoch: current + 1,
      });
      toast(`POLICY EPOCH → ${data.policy.epoch}`, {
        description: `FRESHNESS ${String(data.policy.freshness).toUpperCase()} · PREVIOUS EPOCH ${current}`,
      });
    });

  const grantConsent = () =>
    runAction('consent', async () => {
      const data = await postJson<{ ok: boolean; consent_valid: boolean }>(CONSENT_ADMIN_URL, {
        tenant_id: TENANT,
        ttl_ms: 3_600_000,
      });
      toast(data.consent_valid ? 'CONSENT GRANTED — 60 MIN TTL' : 'CONSENT NOT VALID', {
        description: `TENANT ${TENANT} · SUPPRESSION CONSENT WINDOW OPEN`,
      });
    });

  const toggleVvuHealth = () =>
    runAction('vvuHealth', async () => {
      const forced = outbox?.vvu.state === 'unavailable';
      const next = forced ? 'auto' : 'unavailable';
      const data = await postJson<{ ok: boolean; vvu: { state: string; backlogDepth: number } }>(VVU_HEALTH_ADMIN_URL, {
        state: next,
      });
      toast(next === 'unavailable' ? 'VVU PROBE FORCED UNAVAILABLE' : 'VVU PROBE RESTORED TO AUTO', {
        description:
          next === 'unavailable'
            ? 'FAIL-CLOSED DEMONSTRATION — THE NEXT ALERTS HOLD (NO PROOF OF DELIVERY, NO SUPPRESSION)'
            : `PROBER RESTORED · VVU ${String(data.vvu.state).toUpperCase()} · BACKLOG ${data.vvu.backlogDepth}`,
      });
    });

  const toggleRelay = () =>
    runAction('relayToggle', async () => {
      const running = outbox?.relay.running ?? true;
      const data = await postJson<{ ok: boolean; relay: { running: boolean } }>(RELAY_ADMIN_URL, {
        running: !running,
      });
      toast(data.relay.running ? 'RELAY RESUMED' : 'RELAY PAUSED — CRASH SIMULATION', {
        description: data.relay.running
          ? 'THE WORKER CLAIMS AGAIN — THE BACKLOG DRAINS'
          : 'NOTHING IS CLAIMED — DECISIONS STILL COMMIT; EVENTS WAIT IN THE OUTBOX (NO LOSS)',
      });
    });

  const requeueFailed = () =>
    runAction('requeue', async () => {
      const data = await postJson<{ ok: boolean; requeued: number }>(REQUEUE_URL, {});
      toast(`${data.requeued} FAILED ROW(S) REQUEUED`, {
        description: data.requeued > 0 ? 'DEAD-LETTERED ROWS RETURN TO PENDING — THE RELAY RETRIES' : 'NOTHING IN THE DEAD LETTER — NOTHING TO DO',
      });
    });

  // ── derived header status pieces ──
  const relayRunning = outbox?.relay.running ?? null;
  const vvuState = outbox?.vvu.state ?? null;
  const policy = outbox?.policy ?? null;
  const backlog = outbox?.vvu.backlogDepth ?? null;

  const orderedSeals: SealRowView[] = chain
    ? [...chain.seals].sort(
        (a, b) =>
          a.streamId.localeCompare(b.streamId) ||
          (Number(a.position) - Number(b.position)) ||
          a.position.localeCompare(b.position),
      )
    : [];

  const v = chain?.verification;

  return (
    <div className="absolute inset-0 overflow-y-auto vvu-grid-bg" role="region" aria-label="SafeGrid evidence relay — pipeline operator console">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 pb-28 pt-6 space-y-5">
        {/* ── header strip ── */}
        <section className="vvu-panel-solid p-4 sm:p-6" aria-labelledby="safegrid-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="vvu-label text-[10px] text-[#c8ff00] border border-[#c8ff00]/40 px-2 py-0.5">
                  ROUND 57 · #/SAFEGRID
                </span>
                <span className="vvu-label text-[9px] px-2 py-0.5 rounded border border-[#e0a030]/50 text-[#e0a030]">
                  FAIL-CLOSED SUPPRESSION · TRANSACTIONAL OUTBOX · WORM SEALS
                </span>
                <span
                  className="vvu-label text-[9px] px-2 py-0.5 rounded border border-[#8fb35a]/50 text-[#8fb35a] flex items-center gap-1.5"
                  aria-live="polite"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#c8ff00] vvu-pulse" aria-hidden />
                  LIVE · {POLL_MS / 1000}s POLL{fetchedAt ? ` · ${stamp(fetchedAt.toISOString())}` : ''}
                </span>
              </div>
              <h1
                id="safegrid-title"
                className="vvu-label text-xl sm:text-2xl font-bold text-[#f3e38a] tracking-[0.18em] mt-2 flex items-center gap-2"
              >
                <Cable className="size-5 text-[#c8ff00]" aria-hidden /> SAFEGRID ▸ EVIDENCE_RELAY
              </h1>
              <p className="vvu-label text-[9px] sm:text-[10px] text-[#7a8a6e] mt-1 max-w-3xl leading-relaxed">
                THE OPERATOR CONSOLE FOR THE EVIDENCE PIPELINE — EVERY ALERT GETS A FAIL-CLOSED SUPPRESSION DECISION IN ONE
                TRANSACTION WITH ITS OUTBOX EVENT; THE RELAY DELIVERS IT TO VVU; THE WORM CHAIN SEALS IT IN APPEND ORDER.
              </p>
            </div>
          </div>

          {/* live pipeline status line */}
          <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Pipeline status">
            {producerDown ? (
              <span className="vvu-label text-[9px] px-2 py-0.5 rounded border border-[#e5484d]/60 text-[#e5484d]">
                PRODUCER FEED ERROR · SAFEGRID :3008 UNREACHABLE (GATEWAY ONLY — LOAD VIA :81)
              </span>
            ) : (
              <>
                {relayRunning !== null && (
                  <StatChip
                    label="RELAY"
                    value={relayRunning ? 'RUNNING' : 'PAUSED'}
                    tone={relayRunning ? 'border-[#c8ff00]/50 text-[#c8ff00]' : 'border-[#e5484d]/60 text-[#e5484d]'}
                    title="The relay worker — paused is the disclosed crash simulation"
                  />
                )}
                {vvuState !== null && (
                  <StatChip label="VVU" value={String(vvuState).toUpperCase()} tone={VVU_STATE_TONE[vvuState] ?? 'border-[rgba(107,138,64,0.45)] text-[#7a8a6e]'} />
                )}
                {backlog !== null && (
                  <StatChip
                    label="BACKLOG"
                    value={backlog === Number.MAX_SAFE_INTEGER ? '∞' : backlog}
                    tone={backlog === 0 ? 'border-[#c8ff00]/50 text-[#c8ff00]' : 'border-[#e0a030]/50 text-[#e0a030]'}
                    title="Non-terminal inbox rows — sealing behind"
                  />
                )}
                {policy && (
                  <StatChip
                    label={`POLICY EPOCH ${policy.epoch ?? '—'} ·`}
                    value={String(policy.freshness).toUpperCase()}
                    tone={FRESHNESS_TONE[policy.freshness] ?? 'border-[rgba(107,138,64,0.45)] text-[#7a8a6e]'}
                    title="Policy freshness — stale or missing never authorizes suppression"
                  />
                )}
                {vvuHealth && (
                  <StatChip
                    label="SEALED"
                    value={`${vvuHealth.sealed} · ${vvuHealth.streams} STREAM${vvuHealth.streams === 1 ? '' : 'S'}`}
                    tone="border-[#8fb35a]/50 text-[#8fb35a]"
                    title="WORM-sealed events · streams (VVU consumer state)"
                  />
                )}
                {vvuHealth && (
                  <StatChip
                    label="RECONCILER"
                    value={vvuHealth.reconciler.running ? `RUNNING · ${Math.round(vvuHealth.reconciler.intervalMs / 1000)}s` : 'STOPPED'}
                    tone={vvuHealth.reconciler.running ? 'border-[#8fb35a]/50 text-[#8fb35a]' : 'border-[#e5484d]/60 text-[#e5484d]'}
                    title="The VVU-side backstop worker (belt-and-braces)"
                  />
                )}
              </>
            )}
            {chainDown && (
              <span className="vvu-label text-[9px] px-2 py-0.5 rounded border border-[#e5484d]/60 text-[#e5484d]">
                CHAIN FEED ERROR
              </span>
            )}
            {inboxDown && (
              <span className="vvu-label text-[9px] px-2 py-0.5 rounded border border-[#e5484d]/60 text-[#e5484d]">
                INBOX FEED ERROR
              </span>
            )}
          </div>
        </section>

        {/* ── §1 THE ORDERING DECISION (the headline) ── */}
        <section className="vvu-panel-solid p-4 sm:p-6" aria-labelledby="safegrid-ordering-title">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2
              id="safegrid-ordering-title"
              className="vvu-label text-sm font-bold text-[#f3e38a] tracking-[0.18em] flex items-center gap-2"
            >
              <ListOrdered className="size-4 text-[#c8ff00]" aria-hidden /> §1 · THE ORDERING DECISION
            </h2>
            <span className="vvu-label text-[8px] text-[#7a8a6e]">BINDING — THE ORDER CLAIMS ARE PART OF THE PIPELINE CONTRACT</span>
          </div>
          <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
            {ORDERING_ROWS.map((row) => (
              <li key={row} className="border border-[#6b8a40]/30 p-3 flex items-start gap-2.5">
                <Tag tone="border-[#8fb35a]/50 text-[#8fb35a]">REPORTED</Tag>
                <p className="vvu-label text-[9px] text-[#c9d4bd]/85 leading-relaxed">{row}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ── WORM CHAIN + INBOX (consumer side, VVU) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <section className="vvu-panel-solid p-4 sm:p-6" aria-labelledby="safegrid-chain-title">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="safegrid-chain-title" className="vvu-label text-sm font-bold text-[#f3e38a] tracking-[0.18em] flex items-center gap-2">
                <Link2 className="size-4 text-[#c8ff00]" aria-hidden /> WORM CHAIN — VVU CONSUMER
              </h2>
              {v &&
                (v.valid ? (
                  <span className="vvu-label text-[8px] px-2 py-0.5 rounded border border-[#c8ff00]/50 text-[#c8ff00] tabular-nums">
                    CHAIN VALID · {v.records} RECORDS · {v.streams} STREAMS · {v.checkedInMs}ms
                  </span>
                ) : (
                  <span className="vvu-label text-[8px] px-2 py-0.5 rounded border border-[#e5484d]/60 text-[#e5484d]">
                    CHAIN BROKEN · {v.reason ?? 'REASON UNKNOWN'}{v.brokenAt ? ` · AT ${v.brokenAt}` : ''}
                  </span>
                ))}
            </div>
            <p className="vvu-label text-[9px] text-[#7a8a6e] mt-1">
              SORTED (STREAM, POSITION) ASCENDING — THAT IS THE AUTHORITATIVE ORDER. POSITION ARRIVES AS STRING (BIGINT) AND
              RENDERS AS-IS.
            </p>
            {chain === null && !chainDown ? (
              <Skeleton className="h-48 w-full mt-3 bg-[#8fb35a]/10" />
            ) : chainDown ? (
              <p className="vvu-label text-[10px] text-[#e5484d] mt-3">CHAIN FEED UNAVAILABLE — RETRYING EVERY {POLL_MS / 1000}s.</p>
            ) : orderedSeals.length === 0 ? (
              <p className="vvu-label text-[10px] text-[#7a8a6e] mt-3">CHAIN AT GENESIS — NO SEALS YET.</p>
            ) : (
              <div className="mt-3 max-h-96 overflow-auto" role="region" aria-label="WORM seals in authoritative order">
                <table className="w-full text-left border-collapse vvu-label text-[8px] min-w-[700px]">
                  <thead>
                    <tr className="text-[#7a8a6e]">
                      <th scope="col" className="border-b border-[#6b8a40]/40 py-2 pr-3 font-bold whitespace-nowrap">STREAM</th>
                      <th scope="col" className="border-b border-[#6b8a40]/40 py-2 pr-3 font-bold">POS</th>
                      <th scope="col" className="border-b border-[#6b8a40]/40 py-2 pr-3 font-bold">EVENT ID</th>
                      <th scope="col" className="border-b border-[#6b8a40]/40 py-2 pr-3 font-bold">RECORD HASH</th>
                      <th scope="col" className="border-b border-[#6b8a40]/40 py-2 pr-3 font-bold">PREV</th>
                      <th scope="col" className="border-b border-[#6b8a40]/40 py-2 pr-3 font-bold">ALGO</th>
                      <th scope="col" className="border-b border-[#6b8a40]/40 py-2 font-bold">SEALED AT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderedSeals.map((s) => (
                      <tr key={s.eventId} className="align-top">
                        <td className="border-b border-[#6b8a40]/20 py-1.5 pr-3 text-[#8fb35a] truncate max-w-[110px]" title={s.streamId}>
                          {s.streamId}
                        </td>
                        <td className="border-b border-[#6b8a40]/20 py-1.5 pr-3 text-[#f3e38a] font-bold tabular-nums">{s.position}</td>
                        <td className="border-b border-[#6b8a40]/20 py-1.5 pr-3 text-[#c9d4bd] truncate max-w-[200px]" title={s.eventId}>
                          {s.eventId}
                        </td>
                        <td className="border-b border-[#6b8a40]/20 py-1.5 pr-3 text-[#c9d4bd]/85 font-mono tabular-nums" title={`${s.recordHash} (canonical ${s.canonicalEventHash})`}>
                          {shortHash(s.recordHash)}
                        </td>
                        <td className="border-b border-[#6b8a40]/20 py-1.5 pr-3 text-[#7a8a6e] font-mono tabular-nums" title={s.previousRecordHash}>
                          {s.previousRecordHash === '0'.repeat(64) ? 'GENESIS' : shortHash(s.previousRecordHash)}
                        </td>
                        <td className="border-b border-[#6b8a40]/20 py-1.5 pr-3 text-[#7a8a6e] whitespace-nowrap">{s.algorithm}</td>
                        <td className="border-b border-[#6b8a40]/20 py-1.5 text-[#7a8a6e] tabular-nums whitespace-nowrap" title={s.sealedAt}>
                          {stamp(s.sealedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="vvu-panel-solid p-4 sm:p-6" aria-labelledby="safegrid-inbox-title">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="safegrid-inbox-title" className="vvu-label text-sm font-bold text-[#f3e38a] tracking-[0.18em] flex items-center gap-2">
                <Inbox className="size-4 text-[#c8ff00]" aria-hidden /> INBOX — VVU SIDE
              </h2>
              {inbox && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {(['received', 'sealing', 'sealed', 'seal_failed'] as const).map((s) => (
                    <StatChip key={s} label={s.toUpperCase()} value={inbox.counts[s] ?? 0} tone={INBOX_STATUS_TONE[s]} />
                  ))}
                </div>
              )}
            </div>
            <p className="vvu-label text-[9px] text-[#7a8a6e] mt-1">
              RECEIVED → SEALING → SEALED · SEAL_FAILED RETRIES FOREVER (THE RECONCILER BACKSTOP). DUPLICATE ARRIVAL IS 2xx —
              IDEMPOTENT BY DESIGN.
            </p>
            {inbox === null && !inboxDown ? (
              <Skeleton className="h-48 w-full mt-3 bg-[#8fb35a]/10" />
            ) : inboxDown ? (
              <p className="vvu-label text-[10px] text-[#e5484d] mt-3">INBOX FEED UNAVAILABLE — RETRYING EVERY {POLL_MS / 1000}s.</p>
            ) : !inbox || inbox.rows.length === 0 ? (
              <p className="vvu-label text-[10px] text-[#7a8a6e] mt-3">INBOX EMPTY — NO EVENTS RECEIVED YET.</p>
            ) : (
              <ul className="mt-3 max-h-96 overflow-y-auto pr-1 space-y-1.5" aria-label="Inbox rows, newest first (informational order)">
                {inbox.rows.map((r) => (
                  <li key={r.id} className={`border px-2.5 py-1.5 ${r.status === 'seal_failed' ? 'border-[#e5484d]/50' : 'border-[#6b8a40]/30'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-x-3">
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <Tag tone={INBOX_STATUS_TONE[r.status]}>{r.status.toUpperCase()}</Tag>
                        <span className="vvu-label text-[8px] text-[#c9d4bd]/85 truncate max-w-[200px]" title={r.eventId}>
                          {r.eventId}
                        </span>
                      </div>
                      <span className="vvu-label text-[8px] text-[#7a8a6e] tabular-nums whitespace-nowrap" title={r.receivedAt}>
                        RECV {stamp(r.receivedAt)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                      <span className="vvu-label text-[8px] text-[#8fb35a] truncate max-w-[120px]" title={r.streamId}>
                        {r.streamId}
                      </span>
                      <span className="vvu-label text-[8px] text-[#7a8a6e] tabular-nums">ATTEMPTS {r.sealAttempts}</span>
                      {r.sealRef && (
                        <span className="vvu-label text-[8px] text-[#c8ff00] tabular-nums" title="Seal reference — stream#position">
                          SEAL {r.sealRef}
                        </span>
                      )}
                      {r.sealedAt && (
                        <span className="vvu-label text-[8px] text-[#7a8a6e] tabular-nums">SEALED {stamp(r.sealedAt)}</span>
                      )}
                    </div>
                    {r.lastSealError && (
                      <p className="vvu-label text-[8px] text-[#e5484d] truncate mt-1" title={r.lastSealError}>
                        ERROR {r.lastSealError}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* ── OUTBOX + RELAY (producer side, SafeGrid) + DECISION FEED ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <section className="vvu-panel-solid p-4 sm:p-6" aria-labelledby="safegrid-outbox-title">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="safegrid-outbox-title" className="vvu-label text-sm font-bold text-[#f3e38a] tracking-[0.18em] flex items-center gap-2">
                <RadioTower className="size-4 text-[#c8ff00]" aria-hidden /> OUTBOX + RELAY — SAFEGRID PRODUCER
              </h2>
              <span className="vvu-label text-[8px] px-1.5 py-0.5 border rounded border-[#8fb35a]/50 text-[#8fb35a]">
                :3008 · VIA GATEWAY
              </span>
            </div>
            <p className="vvu-label text-[9px] text-[#7a8a6e] mt-1">
              THE ASYNC SIDE OF THE TRANSACTION — DECISION + OUTBOX COMMIT TOGETHER; THE RELAY ONLY COURIERS THE STORED BYTES.
            </p>
            {outbox === null && !producerDown ? (
              <Skeleton className="h-48 w-full mt-3 bg-[#8fb35a]/10" />
            ) : producerDown ? (
              <p className="vvu-label text-[10px] text-[#e5484d] mt-3">
                PRODUCER FEED UNAVAILABLE — SAFEGRID :3008 IS REACHED THROUGH THE GATEWAY (XTransformPort). LOAD THE ESTATE VIA
                :81 OR RUN THE SERVICE.
              </p>
            ) : outbox && (
              <div className="mt-3 space-y-3">
                {/* outbox state counts + due */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {(['pending', 'processing', 'delivered', 'failed'] as const).map((s) => (
                    <StatChip key={s} label={s.toUpperCase()} value={outbox.counts[s] ?? 0} tone={OUTBOX_STATE_TONE[s]} />
                  ))}
                  <StatChip label="DUE" value={outbox.due} tone="border-[#f3e38a]/50 text-[#f3e38a]" title="Rows available for claim now" />
                </div>

                {/* relay stats */}
                <div className="border border-[#6b8a40]/30 p-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag tone={outbox.relay.running ? 'border-[#c8ff00]/50 text-[#c8ff00]' : 'border-[#e5484d]/60 text-[#e5484d]'}>
                      {outbox.relay.running ? 'RELAY RUNNING' : 'RELAY PAUSED'}
                    </Tag>
                    <span className="vvu-label text-[8px] text-[#7a8a6e] tabular-nums">
                      TICKS {outbox.relay.ticks} · LEASE {Math.round(outbox.relay.leaseMs / 1000)}s
                      {outbox.relay.lastTickAt ? ` · LAST ${stamp(outbox.relay.lastTickAt)}` : ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                    <span className="vvu-label text-[8px] text-[#c8ff00] tabular-nums border border-[#c8ff00]/30 px-1.5 py-1">
                      OK {outbox.relay.postsOk}
                    </span>
                    <span className="vvu-label text-[8px] text-[#8fb35a] tabular-nums border border-[#8fb35a]/30 px-1.5 py-1">
                      DUP {outbox.relay.postsDuplicate}
                    </span>
                    <span className="vvu-label text-[8px] text-[#e0a030] tabular-nums border border-[#e0a030]/30 px-1.5 py-1">
                      FAILED {outbox.relay.postsFailed}
                    </span>
                    <span className="vvu-label text-[8px] text-[#e5484d] tabular-nums border border-[#e5484d]/30 px-1.5 py-1">
                      DEAD {outbox.relay.deadLettered}
                    </span>
                  </div>
                  {outbox.relay.lastError && (
                    <p className="vvu-label text-[8px] text-[#e5484d] truncate mt-2" title={outbox.relay.lastError}>
                      LAST ERROR {outbox.relay.lastError}
                    </p>
                  )}
                  {outbox.relay.cooldownUntil && (
                    <p className="vvu-label text-[8px] text-[#e0a030] mt-1 tabular-nums">
                      COOLDOWN UNTIL {stamp(outbox.relay.cooldownUntil)} — HOT-PATH ISOLATION (VVU DOWN)
                    </p>
                  )}
                </div>

                {/* vvu health + policy snapshots (the §4 inputs, live) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="border border-[#6b8a40]/30 p-2.5">
                    <p className="vvu-label text-[8px] text-[#7a8a6e]">VVU HEALTH SNAPSHOT (§4 INPUT)</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <Tag tone={VVU_STATE_TONE[outbox.vvu.state] ?? 'border-[rgba(107,138,64,0.45)] text-[#7a8a6e]'}>
                        {String(outbox.vvu.state).toUpperCase()}
                      </Tag>
                      <span className="vvu-label text-[8px] text-[#c9d4bd]/85 tabular-nums">
                        BACKLOG {outbox.vvu.backlogDepth === Number.MAX_SAFE_INTEGER ? '∞' : outbox.vvu.backlogDepth}
                      </span>
                    </div>
                    {outbox.vvu.lastError && (
                      <p className="vvu-label text-[8px] text-[#e5484d] truncate mt-1.5" title={outbox.vvu.lastError}>
                        {outbox.vvu.lastError}
                      </p>
                    )}
                    <p className="vvu-label text-[8px] text-[#7a8a6e] mt-1.5 tabular-nums">PROBED {stamp(outbox.vvu.checkedAt)}</p>
                  </div>
                  <div className="border border-[#6b8a40]/30 p-2.5">
                    <p className="vvu-label text-[8px] text-[#7a8a6e]">POLICY SNAPSHOT (§4 INPUT)</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <Tag tone={FRESHNESS_TONE[outbox.policy.freshness] ?? 'border-[rgba(107,138,64,0.45)] text-[#7a8a6e]'}>
                        {String(outbox.policy.freshness).toUpperCase()}
                      </Tag>
                      <span className="vvu-label text-[8px] text-[#c9d4bd]/85 tabular-nums">EPOCH {outbox.policy.epoch ?? '—'}</span>
                    </div>
                    <p className="vvu-label text-[8px] text-[#7a8a6e] mt-1.5 leading-relaxed">
                      STALE OR MISSING POLICY NEVER AUTHORIZES SUPPRESSION.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="vvu-panel-solid p-4 sm:p-6" aria-labelledby="safegrid-decisions-title">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="safegrid-decisions-title" className="vvu-label text-sm font-bold text-[#f3e38a] tracking-[0.18em] flex items-center gap-2">
                <Siren className="size-4 text-[#c8ff00]" aria-hidden /> DECISION FEED — FAIL-CLOSED
              </h2>
              <span className="vvu-label text-[8px] text-[#7a8a6e]">LOCAL INSERTION ORDER — DISPLAY ONLY, NOT CHAIN ORDER</span>
            </div>
            <p className="vvu-label text-[9px] text-[#7a8a6e] mt-1">
              MOST DECISIONS SHOULD READ HOLD / ESCALATE — SUPPRESSION ONLY WHEN THE POSITIVE PREDICATE PASSES. THE OUTBOX
              STATE COLUMN IS LIVE (UPDATES EVERY {POLL_MS / 1000}s).
            </p>
            {decisions === null && !decisionsDown ? (
              <Skeleton className="h-48 w-full mt-3 bg-[#8fb35a]/10" />
            ) : decisionsDown ? (
              <p className="vvu-label text-[10px] text-[#e5484d] mt-3">DECISION FEED UNAVAILABLE — PRODUCER REACHED VIA GATEWAY (:81).</p>
            ) : !decisions || decisions.decisions.length === 0 ? (
              <p className="vvu-label text-[10px] text-[#7a8a6e] mt-3">NO DECISIONS YET — SIMULATE AN ALERT BELOW.</p>
            ) : (
              <ul className="mt-3 max-h-96 overflow-y-auto pr-1 space-y-1.5" aria-label="Recent decisions, newest local insertion first">
                {decisions.decisions.map((d) => (
                  <li key={d.id} className="border border-[#6b8a40]/30 px-2.5 py-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-x-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Tag tone={DECISION_TONE[d.decision] ?? 'border-[rgba(107,138,64,0.45)] text-[#7a8a6e]'}>
                          {String(d.decision).toUpperCase()}
                        </Tag>
                        <Tag tone={RISK_TONE[d.risk] ?? 'border-[rgba(107,138,64,0.45)] text-[#7a8a6e]'}>
                          RISK {String(d.risk).toUpperCase()}
                        </Tag>
                        <span
                          className="vvu-label text-[8px] text-[#7a8a6e] tabular-nums"
                          title="local_decision_id — SafeGrid-local insertion order, diagnostic only"
                        >
                          LOCAL #{d.id} — DIAGNOSTIC
                        </span>
                      </div>
                      <span className="vvu-label text-[8px] text-[#7a8a6e] tabular-nums whitespace-nowrap" title={d.decidedAt}>
                        {stamp(d.decidedAt)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                      <span className="vvu-label text-[8px] text-[#c9d4bd]/85 truncate max-w-[150px]" title={d.alertId}>
                        {d.alertId}
                      </span>
                      <span className="vvu-label text-[8px] text-[#8fb35a] truncate max-w-[150px]" title={`${d.tenantId} · ${d.cameraId}`}>
                        {d.tenantId} · {d.cameraId}
                      </span>
                      <span className="vvu-label text-[8px] text-[#7a8a6e]">EPOCH {d.policyEpoch ?? '—'}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                      <span className="vvu-label text-[8px] text-[#7a8a6e]">
                        AT DECISION · POLICY {String(d.policyFreshness).toUpperCase()} · VVU {String(d.vvuState).toUpperCase()}
                      </span>
                      {d.outboxState && (
                        <span className="vvu-label text-[8px] text-[#7a8a6e]">
                          OUTBOX NOW{' '}
                          <span className={`${OUTBOX_STATE_TONE[d.outboxState] ?? 'text-[#7a8a6e]'} border px-1 py-0.5 rounded`}>
                            {d.outboxState.toUpperCase()}
                          </span>{' '}
                          <span className="tabular-nums">× {d.outboxAttempts ?? 0}</span>
                        </span>
                      )}
                      {d.eventId && (
                        <span className="vvu-label text-[8px] text-[#c9d4bd]/70 truncate max-w-[170px]" title={d.eventId}>
                          {d.eventId}
                        </span>
                      )}
                    </div>
                    {d.outboxLastError && (
                      <p className="vvu-label text-[8px] text-[#e5484d] truncate mt-1" title={d.outboxLastError}>
                        OUTBOX ERROR {d.outboxLastError}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* ── §4 the policy invariant ── */}
        <section className="vvu-panel-solid p-4 sm:p-6" aria-labelledby="safegrid-invariant-title">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="safegrid-invariant-title" className="vvu-label text-sm font-bold text-[#f3e38a] tracking-[0.18em] flex items-center gap-2">
              <ShieldCheck className="size-4 text-[#c8ff00]" aria-hidden /> §4 · THE POLICY INVARIANT
            </h2>
            <Tag tone="border-[#e0a030]/50 text-[#e0a030]">SPEC</Tag>
          </div>
          <pre className="mt-3 border border-[#6b8a40]/40 bg-[#060806] px-3 py-2.5 overflow-x-auto vvu-label text-[9px] text-[#c9d4bd] leading-relaxed">
{`suppress ⇔ policy=fresh ∧ consent ∧ ceiling ∧ risk=low ∧ (vvu=healthy ∨ (vvu=degraded ∧ backlog≤ceiling))
else: risk=high ? escalate : hold`}
          </pre>
          <p className="vvu-label text-[9px] text-[#c9d4bd]/85 mt-3 border-l-2 border-[#c8ff00]/50 pl-3 leading-relaxed">
            MISSING PROOF DELAYS SUPPRESSION. IT NEVER SILENTLY AUTHORIZES IT.
          </p>
        </section>

        {/* ── operator actions ── */}
        <section className="vvu-panel-solid p-4 sm:p-6" aria-labelledby="safegrid-actions-title">
          <h2 id="safegrid-actions-title" className="vvu-label text-sm font-bold text-[#f3e38a] tracking-[0.18em] flex items-center gap-2">
            <Zap className="size-4 text-[#c8ff00]" aria-hidden /> OPERATOR ACTIONS
          </h2>
          <p className="vvu-label text-[9px] text-[#7a8a6e] mt-1">
            REAL ENDPOINTS — THE SAME DISCLOSED ADMIN/TEST HOOKS THE ACCEPTANCE SUITE DRIVES. EVERY RESULT LANDS IN A TOAST AND
            LIVE-REFRESHES THE PANELS.
          </p>

          <div className="mt-4 flex flex-wrap gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => (alertFormOpen ? setAlertFormOpen(false) : openAlertForm())}
              aria-label="Simulate alert — open the inline alert form"
              aria-expanded={alertFormOpen}
              className="min-h-[44px] vvu-label text-[10px] font-bold border-[#c8ff00]/50 text-[#c8ff00] hover:bg-[#c8ff00]/10 hover:text-[#c8ff00]"
            >
              <Siren className="size-3.5" aria-hidden /> {alertFormOpen ? 'CLOSE FORM' : 'SIMULATE ALERT'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={runReconcile}
              disabled={isBusy('reconcile')}
              aria-label="Run reconcile pass over the VVU inbox now"
              className="min-h-[44px] vvu-label text-[10px] font-bold border-[#6b8a40]/50 text-[#c9d4bd] hover:bg-[#8fb35a]/10 hover:text-[#c8ff00]"
            >
              <RefreshCw className={`size-3.5 ${isBusy('reconcile') ? 'animate-spin' : ''}`} aria-hidden /> RUN RECONCILE
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={runRelayTick}
              disabled={isBusy('relayTick')}
              aria-label="Force one relay tick pass now"
              className="min-h-[44px] vvu-label text-[10px] font-bold border-[#6b8a40]/50 text-[#c9d4bd] hover:bg-[#8fb35a]/10 hover:text-[#c8ff00]"
            >
              <Zap className={`size-3.5 ${isBusy('relayTick') ? 'animate-pulse' : ''}`} aria-hidden /> RELAY TICK
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={refreshPolicyEpoch}
              disabled={isBusy('policy')}
              aria-label="Refresh the policy epoch to the next integer"
              className="min-h-[44px] vvu-label text-[10px] font-bold border-[#6b8a40]/50 text-[#c9d4bd] hover:bg-[#8fb35a]/10 hover:text-[#c8ff00]"
            >
              <Stamp className={`size-3.5 ${isBusy('policy') ? 'animate-pulse' : ''}`} aria-hidden /> REFRESH POLICY EPOCH
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={grantConsent}
              disabled={isBusy('consent')}
              aria-label="Grant tenant-gqeberha suppression consent for 60 minutes"
              className="min-h-[44px] vvu-label text-[10px] font-bold border-[#6b8a40]/50 text-[#c9d4bd] hover:bg-[#8fb35a]/10 hover:text-[#c8ff00]"
            >
              <Cable className={`size-3.5 ${isBusy('consent') ? 'animate-pulse' : ''}`} aria-hidden /> GRANT CONSENT
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={toggleVvuHealth}
              disabled={isBusy('vvuHealth')}
              aria-label={
                outbox?.vvu.state === 'unavailable'
                  ? 'Restore the VVU health probe to auto'
                  : 'Force the VVU health probe unavailable — demonstrate the fail-closed policy'
              }
              className="min-h-[44px] vvu-label text-[10px] font-bold border-[#e0a030]/50 text-[#e0a030] hover:bg-[#e0a030]/10 hover:text-[#e0a030]"
            >
              <HeartPulse className={`size-3.5 ${isBusy('vvuHealth') ? 'animate-pulse' : ''}`} aria-hidden />
              {outbox?.vvu.state === 'unavailable' ? 'VVU: RESTORE AUTO' : 'VVU: FORCE UNAVAILABLE'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={toggleRelay}
              disabled={isBusy('relayToggle')}
              aria-label={outbox?.relay.running ? 'Pause the relay worker — crash simulation' : 'Resume the relay worker'}
              className="min-h-[44px] vvu-label text-[10px] font-bold border-[#e0a030]/50 text-[#e0a030] hover:bg-[#e0a030]/10 hover:text-[#e0a030]"
            >
              <Power className={`size-3.5 ${isBusy('relayToggle') ? 'animate-pulse' : ''}`} aria-hidden />
              {outbox?.relay.running ? 'RELAY: PAUSE' : 'RELAY: RESUME'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={requeueFailed}
              disabled={isBusy('requeue')}
              aria-label="Requeue dead-lettered outbox rows to pending"
              className="min-h-[44px] vvu-label text-[10px] font-bold border-[#6b8a40]/50 text-[#c9d4bd] hover:bg-[#8fb35a]/10 hover:text-[#c8ff00]"
            >
              <RotateCcw className={`size-3.5 ${isBusy('requeue') ? 'animate-spin' : ''}`} aria-hidden /> REQUEUE FAILED
            </Button>
          </div>

          {/* the SIMULATE ALERT inline form */}
          {alertFormOpen && (
            <form
              className="mt-4 border border-[#c8ff00]/30 p-3 sm:p-4 bg-[#060806]"
              aria-label="Simulate alert form"
              onSubmit={(e) => {
                e.preventDefault();
                void submitAlert();
              }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="vvu-label text-[8px] text-[#7a8a6e]">ALERT ID (AUTO)</p>
                  <p className="vvu-label text-[10px] text-[#f3e38a] font-bold mt-1.5 tabular-nums truncate" title={alertId}>
                    {alertId}
                  </p>
                  <p className="vvu-label text-[8px] text-[#7a8a6e] mt-1">
                    TENANT {TENANT} · CAM-07 · CLASS ui_sim
                  </p>
                </div>
                <div>
                  <label htmlFor="safegrid-risk" className="vvu-label text-[8px] text-[#7a8a6e] block">
                    RISK
                  </label>
                  <Select value={risk} onValueChange={(v) => setRisk(v as Risk)}>
                    <SelectTrigger id="safegrid-risk" className="bg-[#0b0f0a] border-[#7a8a6e]/50 min-h-[44px] w-full mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0b0f0a] border-[#7a8a6e]/50">
                      <SelectItem value="low" className="vvu-label text-[10px] text-[#c9d4bd] focus:bg-[#7a8a6e]/20">LOW</SelectItem>
                      <SelectItem value="high" className="vvu-label text-[10px] text-[#c9d4bd] focus:bg-[#7a8a6e]/20">HIGH</SelectItem>
                      <SelectItem value="unknown" className="vvu-label text-[10px] text-[#c9d4bd] focus:bg-[#7a8a6e]/20">UNKNOWN</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label htmlFor="safegrid-score" className="vvu-label text-[8px] text-[#7a8a6e] block">
                    SCORE — <span className="text-[#f3e38a] font-bold tabular-nums">{score}</span>/100
                  </label>
                  <Slider
                    id="safegrid-score"
                    value={[score]}
                    onValueChange={(vals) => setScore(vals[0] ?? 0)}
                    min={0}
                    max={100}
                    step={1}
                    className="mt-4"
                    aria-label="alert score"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 mt-4">
                <Button
                  type="submit"
                  disabled={isBusy('alert')}
                  aria-label="Post the simulated alert to SafeGrid and show the decision"
                  className="min-h-[44px] vvu-label text-[10px] font-bold bg-[#c8ff00] text-black hover:bg-[#c8ff00]/85"
                >
                  <Siren className={`size-3.5 ${isBusy('alert') ? 'animate-pulse' : ''}`} aria-hidden />
                  {isBusy('alert') ? 'DECIDING…' : 'POST ALERT → DECIDE'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAlertFormOpen(false)}
                  aria-label="Cancel the simulated alert"
                  className="min-h-[44px] vvu-label text-[10px] font-bold border-[#6b8a40]/50 text-[#c9d4bd] hover:bg-[#8fb35a]/10"
                >
                  CANCEL
                </Button>
                <span className="vvu-label text-[8px] text-[#7a8a6e]">POST /v1/alerts → §4 DECIDE → ONE TX (DECISION + OUTBOX)</span>
              </div>
            </form>
          )}
        </section>

        <p className="vvu-label text-[8px] text-[#4a5744] leading-relaxed">
          SAFEGRID MINI-SERVICE :3008 (EXPRESS 5, DRIZZLE/SQLITE) · VVU CONSUMER /API/SAFEGRID (PRISMA/SQLITE, WORM
          VVU-WORM-v1) · GATEWAY :81 (XTransformPort) · ACCEPTANCE SUITE: bun test ./tests/safegrid-pipeline
        </p>
      </div>
    </div>
  );
}
