'use client';

// src/components/governance/GovernanceWorkspace.tsx — Round 56 · #/governance
// GOVERNANCE KERNEL · SIL — the software-in-the-loop vertical slice surface.
//
//   * /api/governance/state polled every 10s (keyring, policy epoch, the
//     registered actuator with hazards/ASIL/consent, chain verification,
//     recent events, recent permits).
//   * The GovernanceGate drives /api/governance/execute — the ONLY mutation
//     on this surface; every result refreshes the audit stream.
//   * The audit stream is a capped scroll list (max-h + overflow, estate
//     scrollbar styling) — the chain grows without limit in the DB.
//   * NO simulated negative paths as buttons — the negative-path suite is
//     the evidence, linked with its command.
//
// Milestone shown live: a registered actuator cannot execute unless it
// receives a valid, signed, unexpired, single-use permit whose action,
// subject, policy epoch, evidence manifest, and nonce all match
// authoritative state.

import { useQuery } from '@tanstack/react-query';
import { KeyRound, Link2, RefreshCw, ScrollText, ShieldCheck } from 'lucide-react';

import { GovernanceGate, type GovernanceActuatorView } from './GovernanceGate';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface GovernanceStateResponse {
  tag: string;
  releaseLadder: string[];
  releaseStage: string;
  keyring: { configured: boolean; keyId: string | null; error: string | null; algorithm: string; pinned: boolean };
  policyEpoch: number;
  permitTtlMs: number;
  operatorSubject: { id: string; status: string; authMode: string };
  actuators: GovernanceActuatorView[];
  effects: number;
  chain: { valid: boolean; count: number; headHash: string; firstBadSeq: number | null };
  recentEvents: Array<{
    seq: number;
    type: string;
    actionId: string | null;
    subjectId: string | null;
    permitId: string | null;
    observedAt: string;
    hash: string;
    prevHash: string;
  }>;
  recentPermits: Array<{
    permitId: string;
    actionId: string;
    subjectId: string;
    state: string;
    policyEpoch: number;
    issuedAt: string;
    expiresAt: string;
    keyId: string | null;
    signaturePrefix: string | null;
    abortedReason: string | null;
  }>;
  negativePathSuite: { command: string; groups: string[] };
}

const EVENT_TONE: Record<string, { color: string; border: string }> = {
  GOVERNANCE_ALLOW: { color: 'text-[#c8ff00]', border: 'border-[#c8ff00]/40' },
  GOVERNANCE_EXECUTED: { color: 'text-[#8fb35a]', border: 'border-[#8fb35a]/40' },
  GOVERNANCE_REFUSAL: { color: 'text-[#e0a030]', border: 'border-[#e0a030]/50' },
  PERMIT_ABORTED: { color: 'text-[#e5484d]', border: 'border-[#e5484d]/50' },
};

const PERMIT_STATE_TONE: Record<string, string> = {
  AUTHORIZED_UNSIGNED: 'text-[#e0a030] border-[#e0a030]/50',
  SIGNED: 'text-[#c8ff00] border-[#c8ff00]/40',
  ACTUATOR_STARTED: 'text-[#f3e38a] border-[#f3e38a]/40',
  ACTUATOR_CONFIRMED: 'text-[#8fb35a] border-[#8fb35a]/50',
  ABORTED: 'text-[#e5484d] border-[#e5484d]/50',
};

function stamp(iso: string): string {
  return iso.replace('T', ' ').replace(/\.\d+Z$/, 'Z');
}

export function GovernanceWorkspace() {
  const state = useQuery<GovernanceStateResponse, Error>({
    queryKey: ['governance-kernel-state'],
    queryFn: async () => {
      const res = await fetch('/api/governance/state', { cache: 'no-store' });
      if (!res.ok) throw new Error(`STATE HTTP ${res.status}`);
      return (await res.json()) as GovernanceStateResponse;
    },
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
  });

  const data = state.data;
  const firstLoad = state.isPending;

  return (
    <div className="absolute inset-0 overflow-y-auto vvu-grid-bg" role="region" aria-label="Governance kernel — SIL slice">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 pb-28 pt-6 space-y-5">
        {/* ── title block ── */}
        <section className="vvu-panel-solid p-4 sm:p-6" aria-labelledby="governance-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="vvu-label text-[10px] text-[#c8ff00] border border-[#c8ff00]/40 px-2 py-0.5">
                  ROUND 56 · GOVERNANCE KERNEL
                </span>
                {data && (
                  <>
                    <span className="vvu-label text-[9px] px-2 py-0.5 rounded border border-[#8fb35a]/50 text-[#8fb35a]">
                      {data.releaseStage}
                    </span>
                    <span
                      className={`vvu-label text-[9px] px-2 py-0.5 rounded border ${
                        data.chain.valid ? 'border-[#c8ff00]/50 text-[#c8ff00]' : 'border-[#e5484d]/60 text-[#e5484d]'
                      }`}
                    >
                      CHAIN {data.chain.valid ? 'VALID' : 'BROKEN'} · {data.chain.count} EVENTS
                    </span>
                  </>
                )}
                <span className="vvu-label text-[9px] px-2 py-0.5 rounded border border-[#e0a030]/50 text-[#e0a030]">
                  NO ISO 26262 COMPLIANCE CLAIMED
                </span>
              </div>
              <h1 id="governance-title" className="vvu-label text-xl sm:text-2xl font-bold text-[#f3e38a] tracking-[0.18em] mt-2">
                GOVERNANCE · THE PERMIT KERNEL
              </h1>
              <p className="vvu-label text-[9px] sm:text-[10px] text-[#7a8a6e] mt-1 max-w-3xl leading-relaxed">
                A REGISTERED ACTUATOR CANNOT EXECUTE UNLESS IT RECEIVES A VALID, SIGNED, UNEXPIRED, SINGLE-USE PERMIT WHOSE
                ACTION, SUBJECT, POLICY EPOCH, EVIDENCE MANIFEST, AND NONCE ALL MATCH AUTHORITATIVE STATE.
              </p>
              {data && (
                <p className="vvu-label text-[8px] text-[#7a8a6e] mt-1.5">
                  RELEASE LADDER {data.releaseLadder.join(' → ')} · TAG {data.tag}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => void state.refetch()}
                disabled={state.isFetching}
                className="min-h-[44px] vvu-label text-[10px] font-bold border-[#6b8a40]/50 text-[#c9d4bd] hover:bg-[#8fb35a]/10 hover:text-[#c8ff00]"
              >
                <RefreshCw className={`size-3.5 ${state.isFetching ? 'animate-spin' : ''}`} aria-hidden />
                REFRESH STATE
              </Button>
              <p className="vvu-label text-[8px] text-[#7a8a6e] tabular-nums">
                {data ? `POLICY EPOCH ${data.policyEpoch} · TTL ${Math.round(data.permitTtlMs / 1000)}s · EFFECTS ${data.effects}` : firstLoad ? 'LOADING KERNEL STATE…' : '—'}
              </p>
            </div>
          </div>

          {/* keyring / subject strip */}
          {firstLoad && <Skeleton className="h-10 w-full mt-4 bg-[#8fb35a]/10" />}
          {data && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 vvu-label text-[9px]">
              <div className={`border p-2.5 flex items-start gap-2 ${data.keyring.configured ? 'border-[#8fb35a]/40' : 'border-[#e5484d]/60'}`}>
                <KeyRound className={`size-3.5 mt-0.5 ${data.keyring.configured ? 'text-[#8fb35a]' : 'text-[#e5484d]'}`} aria-hidden />
                <div className="min-w-0">
                  <p className={data.keyring.configured ? 'text-[#c8ff00]' : 'text-[#e5484d]'}>
                    {data.keyring.configured ? `KEYRING ${data.keyring.keyId}` : 'KEYRING NOT CONFIGURED'}
                  </p>
                  <p className="text-[#7a8a6e] mt-0.5 break-all">
                    {data.keyring.configured
                      ? `${data.keyring.algorithm} · PINNED KEY ID · CANONICAL PAYLOAD · ENV-HELD (KMS/HSM BEFORE CONTROLLED_BENCH)`
                      : data.keyring.error}
                  </p>
                </div>
              </div>
              <div className={`border p-2.5 flex items-start gap-2 ${data.operatorSubject.status === 'ACTIVE' ? 'border-[#8fb35a]/40' : 'border-[#e5484d]/60'}`}>
                <ShieldCheck className={`size-3.5 mt-0.5 ${data.operatorSubject.status === 'ACTIVE' ? 'text-[#8fb35a]' : 'text-[#e5484d]'}`} aria-hidden />
                <div className="min-w-0">
                  <p className={data.operatorSubject.status === 'ACTIVE' ? 'text-[#c8ff00]' : 'text-[#e5484d]'}>
                    SUBJECT {data.operatorSubject.id} · {data.operatorSubject.status}
                  </p>
                  <p className="text-[#7a8a6e] mt-0.5">
                    {data.operatorSubject.authMode} — RESOLVED SERVER-SIDE ON EVERY CALL; REVOCATION FAILS CLOSED
                  </p>
                </div>
              </div>
            </div>
          )}

          {state.isError && (
            <p className="vvu-label text-[9px] text-[#e5484d] mt-3">STATE PROBE FAILED — {state.error.message}</p>
          )}
        </section>

        {/* ── the gate ── */}
        {firstLoad ? <Skeleton className="h-64 w-full bg-[#8fb35a]/10" /> : (
          <GovernanceGate
            actuator={data?.actuators[0] ?? null}
            keyringConfigured={data?.keyring.configured ?? false}
            onSettled={() => void state.refetch()}
          />
        )}

        {/* ── audit stream + permit ledger ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <section className="vvu-panel-solid p-4 sm:p-6" aria-labelledby="governance-audit-title">
            <div className="flex items-center justify-between gap-2">
              <h2 id="governance-audit-title" className="vvu-label text-sm font-bold text-[#f3e38a] tracking-[0.18em] flex items-center gap-2">
                <ScrollText className="size-4 text-[#c8ff00]" aria-hidden /> AUDIT STREAM
              </h2>
              {data && (
                <span className="vvu-label text-[8px] text-[#7a8a6e] tabular-nums">
                  HEAD {data.chain.headHash.slice(0, 12)}…
                </span>
              )}
            </div>
            <p className="vvu-label text-[9px] text-[#7a8a6e] mt-1">
              HASH-CHAINED · APPEND-ONLY · EVERY REFUSAL IS SEALED BEFORE THE CALLER HEARS IT
            </p>
            {firstLoad ? (
              <Skeleton className="h-48 w-full mt-3 bg-[#8fb35a]/10" />
            ) : !data || data.recentEvents.length === 0 ? (
              <p className="vvu-label text-[10px] text-[#7a8a6e] mt-3">CHAIN AT GENESIS — NO EVENTS YET.</p>
            ) : (
              <ul className="mt-3 max-h-96 overflow-y-auto pr-1 space-y-1.5" aria-label="Governance chain events, newest first">
                {data.recentEvents.map((e) => {
                  const tone = EVENT_TONE[e.type] ?? { color: 'text-[#c9d4bd]', border: 'border-[#6b8a40]/40' };
                  return (
                    <li key={e.seq} className={`border ${tone.border} px-2.5 py-1.5`}>
                      <div className="flex flex-wrap items-center justify-between gap-x-3">
                        <span className={`vvu-label text-[9px] font-bold ${tone.color}`}>
                          #{String(e.seq).padStart(3, '0')} {e.type}
                        </span>
                        <span className="vvu-label text-[8px] text-[#7a8a6e] tabular-nums">{stamp(e.observedAt)}</span>
                      </div>
                      <p className="vvu-label text-[8px] text-[#7a8a6e] mt-0.5 truncate">
                        {e.actionId ?? '—'} · {e.subjectId ?? '—'}{e.permitId ? ` · ${e.permitId.slice(0, 13)}…` : ''}
                      </p>
                      <p className="vvu-label text-[8px] text-[#7a8a6e]/70 tabular-nums truncate" title={`${e.prevHash} → ${e.hash}`}>
                        {e.prevHash.slice(0, 10)}… → {e.hash}…
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="vvu-panel-solid p-4 sm:p-6" aria-labelledby="governance-permits-title">
            <h2 id="governance-permits-title" className="vvu-label text-sm font-bold text-[#f3e38a] tracking-[0.18em] flex items-center gap-2">
              <Link2 className="size-4 text-[#c8ff00]" aria-hidden /> PERMIT LEDGER
            </h2>
            <p className="vvu-label text-[9px] text-[#7a8a6e] mt-1">
              AUTHORIZED_UNSIGNED → SIGNED → ACTUATOR_STARTED → ACTUATOR_CONFIRMED · ABORTED IS TERMINAL
            </p>
            {firstLoad ? (
              <Skeleton className="h-48 w-full mt-3 bg-[#8fb35a]/10" />
            ) : !data || data.recentPermits.length === 0 ? (
              <p className="vvu-label text-[10px] text-[#7a8a6e] mt-3">NO PERMITS ISSUED YET.</p>
            ) : (
              <ul className="mt-3 max-h-96 overflow-y-auto pr-1 space-y-1.5" aria-label="Recent permits, newest first">
                {data.recentPermits.map((p) => (
                  <li key={p.permitId} className="border border-[#6b8a40]/30 px-2.5 py-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-x-3">
                      <span className={`vvu-label text-[8px] px-1.5 py-0.5 border ${PERMIT_STATE_TONE[p.state] ?? 'text-[#c9d4bd] border-[#6b8a40]/40'}`}>
                        {p.state}
                      </span>
                      <span className="vvu-label text-[8px] text-[#7a8a6e] tabular-nums">{stamp(p.issuedAt)}</span>
                    </div>
                    <p className="vvu-label text-[8px] text-[#c9d4bd]/80 mt-1 tabular-nums truncate" title={p.permitId}>
                      {p.permitId}
                    </p>
                    <p className="vvu-label text-[8px] text-[#7a8a6e] truncate">
                      {p.actionId} · EPOCH {p.policyEpoch} · {p.keyId ?? 'UNSIGNED'}
                      {p.signaturePrefix ? ` · ${p.signaturePrefix}…` : ''}
                    </p>
                    {p.abortedReason && (
                      <p className="vvu-label text-[8px] text-[#e5484d] truncate" title={p.abortedReason}>
                        ABORT: {p.abortedReason}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* ── evidence + honest limits ── */}
        <section className="vvu-panel-solid p-4 sm:p-6" aria-labelledby="governance-evidence-title">
          <h2 id="governance-evidence-title" className="vvu-label text-sm font-bold text-[#f3e38a] tracking-[0.18em]">
            EVIDENCE · HONEST LIMITS
          </h2>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="vvu-label text-[9px] text-[#c8ff00]">THE NEGATIVE-PATH SUITE</p>
              <code className="vvu-label text-[9px] text-[#c9d4bd] block mt-1.5 border border-[#6b8a40]/40 px-2.5 py-2 break-all">
                {data?.negativePathSuite.command ?? 'bun test --conditions=react-server ./tests/governance'}
              </code>
              <p className="vvu-label text-[8px] text-[#7a8a6e] mt-1.5 leading-relaxed">
                GROUPS: {(data?.negativePathSuite.groups ?? ['evaluator', 'permit', 'nonce', 'enforcement', 'recovery']).join(' · ')} —
                AGAINST A REAL TEST DATABASE, NOT MOCKS. RECEIPTS: tests/governance/test-log.md
              </p>
            </div>
            <div>
              <p className="vvu-label text-[9px] text-[#c8ff00]">WHAT MAY / MAY NOT BE CLAIMED</p>
              <ul className="vvu-label text-[8px] text-[#c9d4bd]/80 mt-1.5 space-y-1 list-disc pl-4 leading-relaxed">
                <li>MAY: the system contains an auditable safety-assessment interface that refuses unmapped assessments.</li>
                <li>MAY: permits are real Ed25519 over canonical payloads; nonces are durable and single-use; every refusal is sealed.</li>
                <li>MAY NOT: ISO 26262 compliance — the ASIL table is transcribed from the published method and needs standard-text review.</li>
                <li>MAY NOT: any physical actuation — the one actuator is simulated (CONTROLLED_BENCH gate, not this build).</li>
                <li>MAY NOT: production authentication — PROTOTYPE_AUTH resolves the registered operator; credentials are the next gate.</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
