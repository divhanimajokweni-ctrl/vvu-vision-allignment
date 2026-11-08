'use client';

// src/components/governance/GovernanceGate.tsx — Round 56 · #/governance
// THE GOVERNANCE GATE — request UI ONLY (per spec). One registered actuator,
// one REQUEST PERMIT & EXECUTE button, the honest result of each attempt.
// Negative paths are NOT simulated here — they are proven in the negative-
// path suite (tests/governance); this surface shows the live kernel state
// and the durable consequences of real requests.
//
//   EXECUTED → the full permit (id, nonce, epoch, manifest, key id,
//              signature) + the effect id + the bound GOVERNANCE_ALLOW event
//   REFUSED  → the reason code, the evaluator's check log, and the SEALED
//              refusal event on the chain (seq + id)
//   ERROR    → fail-closed operational errors (keyring not configured etc.)

import { useState } from 'react';
import { ArrowRightLeft, CheckCircle2, Copy, Loader2, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

// ── API contracts (mirror of src/server/request-execution.ts) ───────────────

export interface GovernanceHazardView {
  id: string;
  status: string;
  severity: string;
  exposure: string;
  controllability: string;
  asil: string;
}

export interface GovernanceActuatorView {
  id: string;
  displayName: string;
  riskClass: string;
  requiresConsent: boolean;
  simulated: boolean;
  effectKind: string;
  description: string;
  harmBenefit: { harm: number; benefit: number; assessedAt: string };
  hazards: GovernanceHazardView[];
  consent: { policyEpoch: number; grantedAt: string } | null;
}

export interface PublicPermitView {
  permitId: string;
  actionId: string;
  actionNonce: string;
  subjectId: string;
  policyEpoch: number;
  evidenceManifestHash: string;
  governanceEventId: string;
  issuedAt: string;
  expiresAt: string;
  keyId: string;
  algorithm: string;
  signature: string;
}

export interface CheckLogView {
  check: string;
  outcome: 'PASS' | 'REFUSED';
  detail: string;
}

export type ExecutionOutcomeView =
  | {
      status: 'EXECUTED';
      actionId: string;
      subjectId: string;
      permit: PublicPermitView;
      effectId: string;
      effect: string;
      governanceEventId: string;
    }
  | {
      status: 'REFUSED';
      actionId: string;
      subjectId: string | null;
      reasonCode: string;
      reason: string | null;
      checks?: CheckLogView[];
      sealedEventSeq: number | null;
      sealedEventId: string | null;
    }
  | {
      status: 'ERROR';
      actionId: string | null;
      subjectId: string | null;
      reasonCode: string;
      detail?: string;
    };

// ── the gate ────────────────────────────────────────────────────────────────

export function GovernanceGate({
  actuator,
  keyringConfigured,
  onSettled,
}: {
  actuator: GovernanceActuatorView | null;
  keyringConfigured: boolean;
  onSettled: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ExecutionOutcomeView | null>(null);

  async function requestExecution() {
    if (!actuator || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/governance/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId: actuator.id }),
      });
      const outcome = (await res.json()) as ExecutionOutcomeView;
      setResult(outcome);
      if (outcome.status === 'EXECUTED') {
        toast('PERMIT EXECUTED', {
          description: `permit ${outcome.permit.permitId.slice(0, 8)}… · effect ${outcome.effectId.slice(0, 8)}…`,
        });
      } else if (outcome.status === 'REFUSED') {
        toast.error('REFUSED — SEALED', {
          description: `${outcome.reasonCode}${outcome.sealedEventSeq !== null ? ` · event #${outcome.sealedEventSeq}` : ''}`,
        });
      } else {
        toast.error('EXECUTION ERROR', { description: outcome.reasonCode });
      }
    } catch (error) {
      const outcome: ExecutionOutcomeView = {
        status: 'ERROR',
        actionId: actuator.id,
        subjectId: null,
        reasonCode: 'REQUEST_FAILED',
        detail: error instanceof Error ? error.message : String(error),
      };
      setResult(outcome);
      toast.error('REQUEST FAILED', { description: outcome.detail });
    } finally {
      setBusy(false);
      onSettled();
    }
  }

  function copyPermitJson() {
    if (result?.status !== 'EXECUTED') return;
    void navigator.clipboard
      .writeText(JSON.stringify(result.permit, null, 2))
      .then(() => toast('PERMIT COPIED', { description: 'full signed permit JSON on the clipboard' }))
      .catch(() => toast.error('COPY FAILED', { description: 'clipboard unavailable' }));
  }

  const disabled = !actuator || !keyringConfigured || busy;

  return (
    <section className="vvu-panel-solid p-4 sm:p-6" aria-labelledby="governance-gate-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="governance-gate-title" className="vvu-label text-sm sm:text-base font-bold text-[#f3e38a] tracking-[0.18em]">
          THE GATE · REQUEST PERMIT &amp; EXECUTE
        </h2>
        <span className="vvu-label text-[9px] text-[#7a8a6e]">REQUEST UI ONLY — NEGATIVE PATHS LIVE IN THE SUITE</span>
      </div>

      {!actuator ? (
        <p className="vvu-label text-[10px] text-[#7a8a6e] mt-4">NO REGISTERED ACTUATOR LOADED…</p>
      ) : (
        <>
          {/* the registered actuator card */}
          <div className="mt-4 border border-[#6b8a40]/30 p-3 sm:p-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="vvu-label text-[10px] font-bold text-[#c8ff00]">{actuator.displayName}</span>
              <span className="vvu-label text-[8px] px-1.5 py-0.5 border border-[#c8ff00]/40 text-[#c8ff00]">{actuator.riskClass}</span>
              {actuator.simulated && (
                <span className="vvu-label text-[8px] px-1.5 py-0.5 border border-[#e0a030]/50 text-[#e0a030]">SIM · NO PHYSICAL OUTPUT</span>
              )}
              {actuator.requiresConsent && (
                <span className={`vvu-label text-[8px] px-1.5 py-0.5 border ${actuator.consent ? 'border-[#8fb35a]/50 text-[#8fb35a]' : 'border-[#e5484d]/60 text-[#e5484d]'}`}>
                  CONSENT {actuator.consent ? `@EPOCH ${actuator.consent.policyEpoch}` : 'MISSING'}
                </span>
              )}
            </div>
            <p className="vvu-label text-[9px] text-[#c9d4bd]/80 leading-relaxed">{actuator.description}</p>
            <div className="vvu-label text-[9px] text-[#7a8a6e] flex flex-wrap gap-x-4 gap-y-1">
              {actuator.hazards.map((h) => (
                <span key={h.id}>
                  HAZARD {h.id} · {h.status} · SEC {h.severity}/{h.exposure}/{h.controllability} · ASIL{' '}
                  <span className={h.asil === 'UNMAPPED' ? 'text-[#e5484d]' : 'text-[#c8ff00]'}>{h.asil}</span>
                </span>
              ))}
              <span>
                HARM-BENEFIT {actuator.harmBenefit.harm} → {actuator.harmBenefit.benefit}
              </span>
            </div>
          </div>

          {!keyringConfigured && (
            <p className="vvu-label text-[9px] text-[#e5484d] mt-3">
              SIGNING KEYRING NOT CONFIGURED — EXECUTION FAILS CLOSED (bun scripts/governance-keys.ts --write)
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={requestExecution}
              disabled={disabled}
              className="min-h-[44px] vvu-label text-[10px] font-bold border border-[#c8ff00]/50 bg-[#c8ff00]/10 text-[#c8ff00] hover:bg-[#c8ff00]/20 hover:text-[#f3e38a]"
              aria-label="Request permit and execute the registered actuator"
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ArrowRightLeft className="size-4" aria-hidden />}
              {busy ? 'EVALUATING · SIGNING · EXECUTING…' : 'REQUEST PERMIT & EXECUTE'}
            </Button>
            <span className="vvu-label text-[8px] text-[#7a8a6e] max-w-md leading-relaxed">
              EVALUATE → DURABLE ALLOW + NONCE (ONE TX) → ED25519 SIGN → INDEPENDENT VERIFY → NONCE CONSUME → ACTUATOR
            </span>
          </div>
        </>
      )}

      {/* the result */}
      {result && (
        <div className="mt-5" aria-live="polite">
          {result.status === 'EXECUTED' ? (
            <div className="border border-[#c8ff00]/40 p-3 sm:p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-[#c8ff00]" aria-hidden />
                  <span className="vvu-label text-[11px] font-bold text-[#c8ff00]">EXECUTED · EXACTLY ONCE</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={copyPermitJson}
                  className="min-h-[36px] vvu-label text-[9px] border-[#6b8a40]/50 text-[#c9d4bd] hover:bg-[#8fb35a]/10"
                >
                  <Copy className="size-3" aria-hidden /> COPY PERMIT
                </Button>
              </div>
              <dl className="vvu-label text-[9px] text-[#c9d4bd] grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                <div className="truncate"><dt className="text-[#7a8a6e] inline">PERMIT </dt><dd className="inline tabular-nums">{result.permit.permitId}</dd></div>
                <div className="truncate"><dt className="text-[#7a8a6e] inline">NONCE </dt><dd className="inline tabular-nums">{result.permit.actionNonce}</dd></div>
                <div className="truncate"><dt className="text-[#7a8a6e] inline">SUBJECT </dt><dd className="inline">{result.permit.subjectId}</dd></div>
                <div className="truncate"><dt className="text-[#7a8a6e] inline">POLICY EPOCH </dt><dd className="inline tabular-nums">{result.permit.policyEpoch}</dd></div>
                <div className="truncate"><dt className="text-[#7a8a6e] inline">MANIFEST </dt><dd className="inline tabular-nums">{result.permit.evidenceManifestHash.slice(0, 24)}…</dd></div>
                <div className="truncate"><dt className="text-[#7a8a6e] inline">KEY </dt><dd className="inline">{result.permit.keyId} · {result.permit.algorithm}</dd></div>
                <div className="truncate"><dt className="text-[#7a8a6e] inline">VALID </dt><dd className="inline tabular-nums">{result.permit.issuedAt} → {result.permit.expiresAt}</dd></div>
                <div className="truncate"><dt className="text-[#7a8a6e] inline">ALLOW EVENT </dt><dd className="inline tabular-nums">{result.governanceEventId.slice(0, 18)}…</dd></div>
                <div className="sm:col-span-2" >
                  <dt className="text-[#7a8a6e] inline">SIGNATURE </dt>
                  <dd className="inline tabular-nums break-all" title={result.permit.signature}>{result.permit.signature.slice(0, 56)}…</dd>
                </div>
                <div className="sm:col-span-2"><dt className="text-[#7a8a6e] inline">EFFECT </dt><dd className="inline text-[#8fb35a] break-all">{result.effect}</dd></div>
              </dl>
            </div>
          ) : result.status === 'REFUSED' ? (
            <div className="border border-[#e0a030]/50 p-3 sm:p-4 space-y-3">
              <div className="flex items-center gap-2">
                <XCircle className="size-4 text-[#e0a030]" aria-hidden />
                <span className="vvu-label text-[11px] font-bold text-[#e0a030]">REFUSED · {result.reasonCode}</span>
                {result.sealedEventSeq !== null && (
                  <span className="vvu-label text-[8px] px-1.5 py-0.5 border border-[#8fb35a]/50 text-[#8fb35a]">
                    SEALED · CHAIN EVENT #{result.sealedEventSeq}
                  </span>
                )}
              </div>
              {result.reason && <p className="vvu-label text-[9px] text-[#c9d4bd]/85 leading-relaxed">{result.reason}</p>}
              {result.checks && result.checks.length > 0 && (
                <details className="text-[#c9d4bd]">
                  <summary className="vvu-label text-[9px] text-[#7a8a6e] cursor-pointer hover:text-[#c8ff00]">
                    EVALUATOR CHECK LOG ({result.checks.length})
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {result.checks.map((c, i) => (
                      <li key={i} className="vvu-label text-[9px] flex gap-2">
                        <span className={c.outcome === 'PASS' ? 'text-[#8fb35a]' : 'text-[#e5484d]'}>{c.outcome === 'PASS' ? '✓' : '✗'}</span>
                        <span className="text-[#7a8a6e]">{c.check}:</span>
                        <span className="text-[#c9d4bd]/80 break-all">{c.detail}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ) : (
            <div className="border border-[#e5484d]/50 p-3 sm:p-4 flex items-start gap-2">
              <ShieldAlert className="size-4 text-[#e5484d] mt-0.5" aria-hidden />
              <div>
                <span className="vvu-label text-[11px] font-bold text-[#e5484d]">ERROR · {result.reasonCode}</span>
                {result.detail && <p className="vvu-label text-[9px] text-[#c9d4bd]/80 mt-1 break-all">{result.detail}</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* outcome footer note */}
      {result && (
        <p className="sr-only">
          {result.status === 'EXECUTED'
            ? `Permit executed. Permit id ${result.permit.permitId}.`
            : result.status === 'REFUSED'
              ? `Request refused: ${result.reasonCode}`
              : `Execution error: ${result.reasonCode}`}
        </p>
      )}

      {/* success marker for a11y tree assertions */}
      {result?.status === 'EXECUTED' && <CheckCircle2 className="hidden" aria-hidden />}
    </section>
  );
}
