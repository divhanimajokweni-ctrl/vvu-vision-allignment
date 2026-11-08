'use client';

// src/components/icsh/JoinWizard.tsx — JOIN METHOD · the universal join path.
// Two modes (QR / GOOGLE AUTHENTICATOR manual key) → the accepted five-step
// wizard: LOCATE → SCAN → CONSENT → VERIFY → RECEIPT. TOTP is RFC 6238 —
// no HTTPS, no camera, no sensor permission. Bank-grade standard.
//
// On VERIFY success the join is COMMITTED to the WORM chain and the farmer
// receives an E965B01E-style receipt code. The receipt proves inclusion,
// not consensus — that line ships with the receipt.

import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ICSH_DISTRICTS } from '@/lib/icsh/contract';
import type { IcshJoinReceipt, IcshJoinSetup } from '@/lib/icsh/types';
import { cn } from '@/lib/utils';
import { IcshButton } from './parts';
import { sfx } from './sound';

type Step = 'METHOD' | 'LOCATE' | 'SCAN' | 'CONSENT' | 'VERIFY' | 'RECEIPT';

const STEP_ORDER: Exclude<Step, 'METHOD'>[] = ['LOCATE', 'SCAN', 'CONSENT', 'VERIFY', 'RECEIPT'];

const CONSENT_LINES = [
  'I hold the TOTP secret. The estate keeps no passwords and cannot recover it.',
  'My farm data lands on the WORM chain — append-only, hash-chained, permanent.',
  'Ghost regions stay ghosted. Nothing on this estate claims a tier it did not run at.',
];

function SecretChunks({ secret }: { secret: string }) {
  const chunks = useMemo(() => secret.replace(/^EDGEGQ-/, '').match(/.{1,4}/g) ?? [], [secret]);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="border border-[#3d4d12] bg-[#0c0f04] px-2 py-1 text-[10px] font-bold text-[#c8ff00] icsh-glow-lime">
        EDGEGQ-
      </span>
      {chunks.map((c, i) => (
        <span key={i} className="border border-[#24402c] bg-[#081009] px-2 py-1 text-[13px] font-bold tracking-[0.18em] text-[#7dffa8] icsh-glow">
          {c}
        </span>
      ))}
    </div>
  );
}

export function JoinWizard({ open, onClose, onJoined }: { open: boolean; onClose: () => void; onJoined: () => void }) {
  const [step, setStep] = useState<Step>('METHOD');
  const [mode, setMode] = useState<'QR' | 'AUTH'>('QR');
  const [callsign, setCallsign] = useState('');
  const [farm, setFarm] = useState('');
  const [district, setDistrict] = useState<string>('GAUTENG');
  const [consents, setConsents] = useState([false, false, false]);
  const [setup, setSetup] = useState<IcshJoinSetup | null>(null);
  const [code, setCode] = useState('');
  const [receipt, setReceipt] = useState<IcshJoinReceipt | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // reset for the next farmer — a friend joins the same way. Runs on every
  // close path (dialog overlay, ESC, receipt CLOSE) so the next open starts
  // clean without a setState-in-effect.
  const reset = () => {
    setStep('METHOD');
    setConsents([false, false, false]);
    setSetup(null);
    setCode('');
    setReceipt(null);
    setErr(null);
  };
  const close = () => {
    reset();
    onClose();
  };

  const setupMut = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/icsh/join/setup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ callsign, farm, district }),
      });
      const d = (await r.json()) as IcshJoinSetup | { error: string };
      if (!r.ok || 'error' in d) throw new Error('error' in d ? d.error : `setup ${r.status}`);
      return d;
    },
    onSuccess: (d) => {
      setSetup(d);
      sfx.ok();
    },
    onError: (e: Error) => {
      setErr(e.message);
      sfx.err();
    },
  });

  const verifyMut = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/icsh/join/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nodeId: setup?.nodeId, code }),
      });
      const d = (await r.json()) as IcshJoinReceipt | { error: string };
      if (!r.ok || 'error' in d) throw new Error('error' in d ? d.error : `verify ${r.status}`);
      return d;
    },
    onSuccess: (d) => {
      setReceipt(d);
      setStep('RECEIPT');
      sfx.seal();
      toast.success(`${d.callsign} COMMITTED ON CHAIN`, {
        description: `receipt ${d.joinCode} · worm seq ${d.wormSeq} — inclusion, not consensus`,
      });
      onJoined();
    },
    onError: (e: Error) => {
      setErr(e.message);
      sfx.err();
    },
  });

  const go = (s: Step) => {
    setErr(null);
    setStep(s);
    sfx.click();
  };

  const stepIndex = step === 'METHOD' ? -1 : STEP_ORDER.indexOf(step as Exclude<Step, 'METHOD'>);
  const allConsents = consents.every(Boolean);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent
        className="max-h-[88vh] max-w-lg overflow-y-auto border-[#24402c] bg-[#070d09] font-mono text-[#c9e4cd] icsh-scroll"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-baseline justify-between font-mono">
            <span className="text-[11px] font-black tracking-[0.3em] text-[#c8ff00] icsh-glow-lime">JOIN METHOD</span>
            <span className="text-[8px] tracking-[0.26em] text-[#5f7f68]">TOTP · RFC 6238</span>
          </DialogTitle>
        </DialogHeader>

        {/* step rail */}
        <div className="flex items-center gap-1">
          {STEP_ORDER.map((s, i) => (
            <div key={s} className="flex flex-1 items-center gap-1">
              <span
                className={cn(
                  'flex-1 border-t-2 pt-1 text-[7px] tracking-[0.18em]',
                  i <= stepIndex ? 'border-[#c8ff00] text-[#c8ff00]' : 'border-[#1d2f22] text-[#3f5748]'
                )}
              >
                {s}
              </span>
            </div>
          ))}
        </div>

        {err ? (
          <p className="border border-[#4d2018] bg-[#100604] px-3 py-2 text-[9px] tracking-[0.12em] text-[#ff7a6e]">{err}</p>
        ) : null}

        {/* ── METHOD ─────────────────────────────────────────────────────── */}
        {step === 'METHOD' ? (
          <div className="space-y-3">
            <p className="text-[9px] leading-relaxed tracking-[0.12em] text-[#7d9a84]">
              Two ways in. Both end in the same standard six-digit code — the same path banks use.
            </p>
            <button
              type="button"
              onClick={() => {
                setMode('QR');
                go('LOCATE');
              }}
              className="w-full border border-[#24402c] bg-[#081009] p-3 text-left transition-colors hover:border-[#7dffa8]"
            >
              <p className="text-[11px] font-bold tracking-[0.2em] text-[#7dffa8]">▸ QR CODE</p>
              <p className="mt-1 text-[9px] text-[#5f7f68]">scan with any authenticator app · needs a camera on this device</p>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('AUTH');
                go('LOCATE');
              }}
              className="w-full border border-[#24402c] bg-[#081009] p-3 text-left transition-colors hover:border-[#7dffa8]"
            >
              <p className="text-[11px] font-bold tracking-[0.2em] text-[#7dffa8]">▸ GOOGLE AUTHENTICATOR (MANUAL KEY)</p>
              <p className="mt-1 text-[9px] text-[#5f7f68]">type one key into any authenticator · no camera, no HTTPS, no permissions</p>
            </button>
          </div>
        ) : null}

        {/* ── LOCATE ─────────────────────────────────────────────────────── */}
        {step === 'LOCATE' ? (
          <div className="space-y-3">
            <label className="block">
              <span className="text-[8px] tracking-[0.26em] text-[#5f7f68]">CALLSIGN (A–Z 0–9 _ · 2–24)</span>
              <input
                value={callsign}
                onChange={(e) => setCallsign(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 24))}
                placeholder="EDGE_GQ_MKONDO"
                className="mt-1 w-full border border-[#24402c] bg-[#040806] px-3 py-2 text-[12px] tracking-[0.14em] text-[#c9e4cd] outline-none focus:border-[#7dffa8]"
              />
            </label>
            <label className="block">
              <span className="text-[8px] tracking-[0.26em] text-[#5f7f68]">FARM</span>
              <input
                value={farm}
                onChange={(e) => setFarm(e.target.value.slice(0, 48))}
                placeholder="Mthembu Smallholdings"
                className="mt-1 w-full border border-[#24402c] bg-[#040806] px-3 py-2 text-[12px] tracking-[0.14em] text-[#c9e4cd] outline-none focus:border-[#7dffa8]"
              />
            </label>
            <label className="block">
              <span className="text-[8px] tracking-[0.26em] text-[#5f7f68]">DISTRICT</span>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="mt-1 w-full border border-[#24402c] bg-[#040806] px-3 py-2 text-[12px] tracking-[0.14em] text-[#c9e4cd] outline-none focus:border-[#7dffa8]"
              >
                {ICSH_DISTRICTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex justify-between pt-1">
              <IcshButton onClick={() => go('METHOD')}>◀ BACK</IcshButton>
              <IcshButton
                tone="lime"
                disabled={callsign.length < 2 || farm.trim().length < 2 || setupMut.isPending}
                onClick={() => {
                  sfx.click();
                  setStep('SCAN');
                }}
              >
                SCAN ▶
              </IcshButton>
            </div>
          </div>
        ) : null}

        {/* ── SCAN ───────────────────────────────────────────────────────── */}
        {step === 'SCAN' ? (
          <div className="space-y-3">
            <p className="text-[9px] tracking-[0.2em] text-[#7d9a84]">RIG DISCOVERED — 4 READINGS, NO DEAD ENDS:</p>
            {[
              ['ESTATE', 'FOREST HILL DIGITAL TWIN · GAUTENG'],
              ['RIG', 'EDGE_GQ · 5 SENSORS · 25 PEERS · 32-BYTE GOSSIP'],
              ['TOTP', 'RFC 6238 · SHA1 · 30 S · 6 DIGITS · READY'],
              ['STORAGE', 'THE LEDGER — WORM CHAIN · APPEND-ONLY'],
            ].map(([k, v], i) => (
              <div key={k} className="icsh-rise flex items-baseline justify-between gap-3 border-b border-dashed border-[#142019] py-2" style={{ animationDelay: `${i * 140}ms` }}>
                <span className="text-[9px] tracking-[0.22em] text-[#5f7f68]">{k}</span>
                <span className="text-[10px] tracking-[0.1em] text-[#7dffa8] icsh-glow">{v}</span>
              </div>
            ))}
            <div className="flex justify-between pt-1">
              <IcshButton onClick={() => go('LOCATE')}>◀ BACK</IcshButton>
              <IcshButton tone="lime" onClick={() => go('CONSENT')}>
                CONSENT ▶
              </IcshButton>
            </div>
          </div>
        ) : null}

        {/* ── CONSENT ────────────────────────────────────────────────────── */}
        {step === 'CONSENT' ? (
          <div className="space-y-3">
            {CONSENT_LINES.map((line, i) => (
              <label key={i} className="flex cursor-pointer items-start gap-3 border border-[#16241a] bg-[#060b08] p-3">
                <input
                  type="checkbox"
                  checked={consents[i]}
                  onChange={(e) => {
                    const next = [...consents];
                    next[i] = e.target.checked;
                    setConsents(next);
                    sfx.tick();
                  }}
                  className="mt-0.5 h-3.5 w-3.5 accent-[#c8ff00]"
                />
                <span className="text-[9px] leading-relaxed tracking-[0.1em] text-[#a8c2ad]">{line}</span>
              </label>
            ))}
            <div className="flex justify-between pt-1">
              <IcshButton onClick={() => go('SCAN')}>◀ BACK</IcshButton>
              <IcshButton
                tone="lime"
                disabled={!allConsents || setupMut.isPending}
                onClick={() => {
                  setErr(null);
                  setupMut.mutate(undefined, {
                    onSuccess: () => setStep('VERIFY'),
                  });
                }}
              >
                {setupMut.isPending ? 'OPENING ENROLMENT…' : 'VERIFY ▶'}
              </IcshButton>
            </div>
          </div>
        ) : null}

        {/* ── VERIFY ─────────────────────────────────────────────────────── */}
        {step === 'VERIFY' && setup ? (
          <div className="space-y-3">
            <p className="text-[9px] leading-relaxed tracking-[0.12em] text-[#7d9a84]">
              {mode === 'QR'
                ? 'Scan this with your authenticator app, then read the six-digit code back to the estate:'
                : 'Type this key into any authenticator app (⋮ → set up account → enter key), then read the six-digit code back:'}
            </p>
            {mode === 'QR' ? (
              <div className="flex justify-center border border-[#24402c] bg-white p-3">
                <QRCodeSVG value={setup.otpauth} size={176} />
              </div>
            ) : (
              <div className="space-y-2">
                <SecretChunks secret={setup.secret} />
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(setup.secret);
                    sfx.tick();
                    toast('SECRET COPIED', { description: 'paste it straight into your authenticator' });
                  }}
                  className="text-[8px] tracking-[0.22em] text-[#5f7f68] underline hover:text-[#7dffa8]"
                >
                  COPY SECRET
                </button>
              </div>
            )}
            <label className="block">
              <span className="text-[8px] tracking-[0.26em] text-[#5f7f68]">6-DIGIT CODE (rotates every 30 s)</span>
              <input
                value={code}
                inputMode="numeric"
                autoComplete="one-time-code"
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setCode(v);
                  if (v.length === 6) sfx.tick();
                }}
                placeholder="••••••"
                className="mt-1 w-full border border-[#24402c] bg-[#040806] px-3 py-2.5 text-center text-[20px] tracking-[0.6em] text-[#c8ff00] icsh-glow-lime outline-none focus:border-[#7dffa8]"
              />
            </label>
            <div className="flex justify-between pt-1">
              <IcshButton onClick={() => go('CONSENT')}>◀ BACK</IcshButton>
              <IcshButton tone="lime" disabled={code.length !== 6 || verifyMut.isPending} onClick={() => verifyMut.mutate()}>
                {verifyMut.isPending ? 'VERIFYING…' : 'COMMIT JOIN'}
              </IcshButton>
            </div>
            <p className="text-[8px] tracking-[0.14em] text-[#3f5748]">
              ENROLMENT OPEN AT WORM SEQ {setup.wormSeq} — NO RECEIPT YET, INCLUSION NOT YET PROVEN
            </p>
          </div>
        ) : null}

        {/* ── RECEIPT ────────────────────────────────────────────────────── */}
        {step === 'RECEIPT' && receipt ? (
          <div className="space-y-3">
            <div className="border border-[#3d4d12] bg-[#0c0f04] p-4 text-center">
              <p className="text-[8px] tracking-[0.3em] text-[#7d9a84]">READY TO COMMIT — ✓ COMMITTED ON CHAIN</p>
              <p className="mt-2 text-[26px] font-black tracking-[0.3em] text-[#c8ff00] icsh-glow-lime">{receipt.joinCode}</p>
              <p className="mt-2 text-[8px] tracking-[0.2em] text-[#5f7f68]">
                {receipt.callsign} · {receipt.farm} · {receipt.district}
              </p>
            </div>
            <div className="space-y-1.5 border border-[#16241a] bg-[#060b08] p-3">
              {[
                ['WORM SEQ', String(receipt.wormSeq)],
                ['ENTRY HASH', `${receipt.hash.slice(0, 16)}…${receipt.hash.slice(-8)}`],
                ['NODES ON CHAIN', String(receipt.nodeCount)],
                ['METHOD', 'TOTP VERIFIED · RFC 6238 · ±1 STEP'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3">
                  <span className="text-[8px] tracking-[0.22em] text-[#5f7f68]">{k}</span>
                  <span className="text-[10px] tabular-nums text-[#c9e4cd]">{v}</span>
                </div>
              ))}
            </div>
            <div className="border border-dashed border-[#4d4418] bg-[#0a0904] p-3">
              {receipt.honesty.map((l) => (
                <p key={l} className="text-[8px] leading-relaxed tracking-[0.1em] text-[#a89f6e]">
                  ▸ {l}
                </p>
              ))}
            </div>
            <div className="flex justify-end">
              <IcshButton tone="lime" onClick={close}>
                CLOSE — RUN YOUR ITERATIONS
              </IcshButton>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
