'use client';

// src/components/icsh/SessionLab.tsx — 14:39 SESSION LAB · the multi-user PWA
// concurrent-2FA verification surface (Task 50).
//
// The phone grid simulates worker devices running Google Authenticator
// against REAL on-chain enrolments: codes are computed server-side from each
// node's secret, so a real phone paired via the QR card shows the SAME code
// as the simulated screen. LOGIN submits the displayed code through the REAL
// verify path (HMAC-SHA1 · RFC 6238 · ±1 step) and mints a 15-minute PWA
// session (SESSION_MINTED on the WORM chain). The CONCURRENT SWEEP fires
// every phone's login at once — the honest concurrency test.
//
// Honesty: this lab proves the join + session machinery, not consensus.

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type {
  IcshLoginOutcome,
  IcshPhoneTick,
  IcshSessionQr,
  IcshSessionRow,
  IcshSessionTick,
} from '@/lib/icsh/types';
import { cn } from '@/lib/utils';
import { Chip, Empty, HonestyCard, IcshButton, Panel, ago, head8 } from './parts';
import { sfx } from './sound';

/* ── helpers ──────────────────────────────────────────────────────────────── */

function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function fmtCode(c: string): string {
  return `${c.slice(0, 3)} ${c.slice(3)}`;
}

function fmtCountdown(iso: string, now: number): string {
  const s = Math.max(0, Math.floor((new Date(iso).getTime() - now) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

const SESSION_HONESTY = [
  'Phone screens are SIMULATED — the codes are what Google Authenticator would show, computed server-side from each node’s on-chain secret.',
  'The verify path is REAL: HMAC-SHA1 (RFC 6238) server-side, window ±1 step, no passwords stored, works off-line.',
  'Every login, rejection and revocation is a WORM event. POPIA Act 4 of 2013: consent recorded per enrolment; revoke any time.',
  'This lab proves the join + session machinery, not consensus.',
] as const;

const BEATS = ['CONSENT', 'CODE', 'VERIFY', 'BIND', 'MINT', 'LOG'] as const;

/* ── sweep contracts ──────────────────────────────────────────────────────── */

interface SweepRow {
  callsign: string;
  code: string;
  ok: boolean;
  drift: number | null;
  ms: number; // client round-trip
  serverMs: number | null;
  sessionCode: string | null;
  joined: boolean;
  error: string | null;
}

interface SweepResult {
  at: string;
  volleys: { wallMs: number; rows: SweepRow[] }[];
  totals: {
    logins: number;
    verified: number;
    joins: number;
    rejected: number;
    wormEvents: number;
    wallMs: number;
    maxMs: number;
    meanMs: number;
    throughput: number;
  };
}

/* ── the phone card ───────────────────────────────────────────────────────── */

interface PhoneCardProps {
  phone: IcshPhoneTick;
  now: number;
  busy: boolean;
  flash: { ok: boolean; line: string } | null;
  onLogin: (phone: IcshPhoneTick, code: string, wrong: boolean) => void;
  onQr: (phone: IcshPhoneTick) => void;
  sweeping: boolean;
}

const PhoneCard = memo(function PhoneCard({ phone, now, busy, flash, onLogin, onQr, sweeping }: PhoneCardProps) {
  const pct = (phone.secondsRemaining / 30) * 100;
  const barTone =
    phone.secondsRemaining > 10 ? 'bg-[#c8ff00]' : phone.secondsRemaining > 5 ? 'bg-[#f3e38a]' : 'bg-[#ff7a6e]';
  const statusTone =
    phone.status === 'ACTIVE'
      ? 'text-[#7dffa8] border-[#1d4d2c] bg-[#04100a]'
      : phone.status === 'PENDING'
        ? 'text-[#f3e38a] border-[#4d4418] bg-[#0f0d04]'
        : 'text-[#ff7a6e] border-[#4d2018] bg-[#100604]';
  const statusLabel =
    phone.status === 'ACTIVE' ? 'BOUND' : phone.status === 'PENDING' ? 'ENROLMENT OPEN' : 'BLOCKED';

  return (
    <article
      className={cn(
        'flex flex-col border bg-[#060b08] transition-colors',
        phone.status === 'BLOCKED' ? 'border-[#4d2018] opacity-80' : 'border-[#1d2f22] hover:border-[#2c4433]'
      )}
      aria-label={`worker phone ${phone.callsign}`}
    >
      {/* header */}
      <header className="flex items-center justify-between gap-2 border-b border-[#16241a] bg-[#081009] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              'inline-block h-1.5 w-1.5 shrink-0 rounded-full',
              phone.status === 'ACTIVE' ? 'bg-[#7dffa8] icsh-glow' : phone.status === 'PENDING' ? 'bg-[#f3e38a] icsh-blink' : 'bg-[#ff7a6e]'
            )}
            aria-hidden="true"
          />
          <h4 className="truncate text-[10px] font-bold tracking-[0.16em] text-[#c9e4cd]">{phone.callsign}</h4>
        </div>
        <span className={cn('shrink-0 border px-1.5 py-0.5 text-[8px] font-bold tracking-[0.18em]', statusTone)}>
          {statusLabel}
        </span>
      </header>

      {/* the simulated authenticator screen */}
      <div className="px-3 pt-3">
        <div className="border border-[#24402c] bg-[#040806] p-3" role="img" aria-label={`authenticator code ${fmtCode(phone.code)}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[8px] tracking-[0.22em] text-[#5f7f68]">GOOGLE AUTHENTICATOR · SIM</span>
            <span className="text-[8px] tracking-[0.22em] text-[#3f5748]">RFC 6238</span>
          </div>
          <p className="mt-1 truncate text-[9px] tracking-[0.14em] text-[#7d9a84]">VVU-TRUST:{phone.callsign}</p>
          <p
            className={cn(
              'mt-2 text-center text-[28px] font-black leading-none tracking-[0.18em] tabular-nums',
              phone.status === 'BLOCKED' ? 'text-[#4a5f4e]' : 'text-[#c8ff00] icsh-glow-lime'
            )}
            aria-live="off"
          >
            {phone.status === 'BLOCKED' ? '–– –––' : fmtCode(phone.code)}
          </p>
          <div className="mt-3">
            <div
              className="h-1 w-full bg-[#111c14]"
              role="progressbar"
              aria-valuenow={phone.secondsRemaining}
              aria-valuemin={0}
              aria-valuemax={30}
              aria-label="code rotation window"
            >
              <div
                className={cn('h-full transition-[width] duration-1000 ease-linear', barTone)}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[8px] tracking-[0.2em] text-[#3f5748]">30 S STEP</span>
              <span className="text-[8px] tabular-nums tracking-[0.2em] text-[#5f7f68]">
                ROTATES IN {phone.secondsRemaining}S
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* meta */}
      <div className="space-y-1 px-3 py-2.5 text-[9px] tracking-[0.1em] text-[#7d9a84]">
        <p className="truncate">
          {phone.farm} · {phone.district} · <span className="text-[#5f7f68]">{phone.tier}</span>
        </p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            SESSIONS <span className="font-bold text-[#7dffa8] tabular-nums">{phone.activeSessions}</span>
          </span>
          {phone.sessionUntil ? (
            <span className="text-[#f3e38a] tabular-nums">NEXT {fmtCountdown(phone.sessionUntil, now)}</span>
          ) : (
            <span className="text-[#3f5748]">NO ACTIVE SESSION</span>
          )}
          {phone.joinCode ? <span className="text-[#5f7f68]">RECEIPT {phone.joinCode}</span> : null}
        </p>
      </div>

      {/* result flash */}
      {flash ? (
        <p
          className={cn(
            'mx-3 mb-2 border px-2 py-1 text-[8px] tracking-[0.14em]',
            flash.ok ? 'border-[#1d4d2c] bg-[#04100a] text-[#7dffa8]' : 'border-[#4d2018] bg-[#100604] text-[#ff7a6e]'
          )}
          role="status"
        >
          {flash.ok ? '✓ ' : '✗ '}
          {flash.line}
        </p>
      ) : null}

      {/* actions */}
      <footer className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-[#16241a] px-3 py-2.5">
        <IcshButton
          tone="lime"
          disabled={busy || sweeping || phone.status === 'BLOCKED'}
          onClick={() => onLogin(phone, phone.code, false)}
          title="submit this phone's live code through the real verify path"
          className="px-2.5"
        >
          {busy ? 'VERIFYING…' : 'LOGIN'}
        </IcshButton>
        <IcshButton
          disabled={busy || sweeping || phone.status === 'BLOCKED'}
          onClick={() => onLogin(phone, '000000', true)}
          title="submit a deliberately wrong code — proves the rejection path"
          className="px-2.5"
        >
          WRONG
        </IcshButton>
        {phone.status === 'PENDING' ? (
          <IcshButton tone="amber" disabled={sweeping} onClick={() => onQr(phone)} title="pair a real phone via QR" className="px-2.5">
            QR
          </IcshButton>
        ) : null}
      </footer>
    </article>
  );
});

/* ── the QR pairing dialog ────────────────────────────────────────────────── */

function QrPairDialog({ phone, onClose }: { phone: IcshPhoneTick | null; onClose: () => void }) {
  const [card, setCard] = useState<IcshSessionQr | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!phone) return;
    setCard(null);
    setErr(null);
    let live = true;
    (async () => {
      try {
        const r = await fetch(`/api/icsh/session/qr?nodeId=${encodeURIComponent(phone.nodeId)}`, {
          cache: 'no-store',
        });
        const d = (await r.json()) as IcshSessionQr | { error: string };
        if (!live) return;
        if (!r.ok || !('secret' in d)) throw new Error('error' in d ? d.error : `qr ${r.status}`);
        setCard(d);
      } catch (e) {
        if (live) setErr(String(e instanceof Error ? e.message : e));
      }
    })();
    return () => {
      live = false;
    };
  }, [phone]);

  const chunks = card ? (card.secret.replace(/^EDGEGQ-/, '').match(/.{1,4}/g) ?? []) : [];

  return (
    <Dialog open={phone !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-h-[88vh] max-w-md overflow-y-auto border-[#24402c] bg-[#070d09] font-mono text-[#c9e4cd] icsh-scroll"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-baseline justify-between font-mono">
            <span className="text-[11px] font-black tracking-[0.3em] text-[#c8ff00] icsh-glow-lime">PAIR A REAL PHONE</span>
            <span className="text-[8px] tracking-[0.26em] text-[#5f7f68]">TOTP · RFC 6238</span>
          </DialogTitle>
        </DialogHeader>

        {err ? <p className="border border-[#4d2018] bg-[#100604] px-3 py-2 text-[9px] tracking-[0.12em] text-[#ff7a6e]">{err}</p> : null}

        {card ? (
          <div className="space-y-3">
            <p className="text-[9px] leading-relaxed tracking-[0.12em] text-[#7d9a84]">
              Scan with Google Authenticator on your Android / iOS phone. Your phone will then show the{' '}
              <span className="text-[#c8ff00]">SAME code</span> as this lab’s simulated screen for{' '}
              <span className="text-[#c9e4cd]">{card.callsign}</span> — the grid computes its codes from this exact secret.
            </p>

            <div className="flex justify-center border border-[#24402c] bg-white p-3" role="img" aria-label="TOTP provisioning QR code">
              <QRCodeSVG value={card.otpauth} size={188} bgColor="#ffffff" fgColor="#0a0a0a" level="M" marginSize={2} />
            </div>

            <div>
              <p className="mb-1.5 text-[8px] tracking-[0.24em] text-[#5f7f68]">MANUAL KEY — GOOGLE AUTHENTICATOR · ENTER A SETUP KEY</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="border border-[#3d4d12] bg-[#0c0f04] px-2 py-1 text-[10px] font-bold text-[#c8ff00] icsh-glow-lime">EDGEGQ-</span>
                {chunks.map((c, i) => (
                  <span key={i} className="border border-[#24402c] bg-[#081009] px-2 py-1 text-[13px] font-bold tracking-[0.18em] text-[#7dffa8] icsh-glow">
                    {c}
                  </span>
                ))}
              </div>
            </div>

            <p className="break-all border border-[#1d2f22] bg-[#040806] px-2 py-1.5 text-[8px] leading-relaxed tracking-[0.08em] text-[#5f7f68]">
              {card.otpauth}
            </p>

            <div className="border border-dashed border-[#4d4418] bg-[#0a0904] p-3">
              <p className="mb-2 text-[8px] tracking-[0.3em] text-[#f3e38a]">POPIA — ACT 4 OF 2013 · CONSENT FRAME</p>
              <ul className="space-y-1 text-[9px] leading-relaxed text-[#a89f6e]">
                <li>▸ s11 CONSENT — scanning pairs your phone; the first verified code records JOIN_COMMITTED on the WORM chain.</li>
                <li>▸ s10 DATA MINIMISATION — the estate stores no passwords, no phone numbers, no SIM identity.</li>
                <li>▸ OFF-LINE — verification is local HMAC-SHA1; works through load-shedding blackouts.</li>
                <li>▸ s11(3) RIGHT TO REVOKE — revocation writes consent_revoked / BLOCKED on chain; the secret is never re-exposed once bound.</li>
              </ul>
            </div>
          </div>
        ) : !err ? (
          <p className="py-6 text-center text-[9px] tracking-[0.22em] text-[#5f7f68]">FETCHING PAIRING CARD…</p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/* ── the surface ──────────────────────────────────────────────────────────── */

export function SessionLabSurface() {
  const queryClient = useQueryClient();
  const now = useNow(1000);

  const [volleys, setVolleys] = useState(1);
  const [sweeping, setSweeping] = useState(false);
  const [sweepLine, setSweepLine] = useState<string | null>(null);
  const [sweep, setSweep] = useState<SweepResult | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [flashes, setFlashes] = useState<Record<string, { ok: boolean; line: string }>>({});
  const [qrPhone, setQrPhone] = useState<IcshPhoneTick | null>(null);

  const tickQ = useQuery({
    queryKey: ['icsh', 'session-tick'],
    queryFn: async (): Promise<IcshSessionTick> => {
      const r = await fetch('/api/icsh/session/tick', { cache: 'no-store' });
      if (!r.ok) throw new Error(`tick ${r.status}`);
      return (await r.json()) as IcshSessionTick;
    },
    refetchInterval: 1000,
  });
  const sessionsQ = useQuery({
    queryKey: ['icsh', 'sessions'],
    queryFn: async (): Promise<IcshSessionRow[]> => {
      const r = await fetch('/api/icsh/sessions', { cache: 'no-store' });
      if (!r.ok) throw new Error(`sessions ${r.status}`);
      const d = (await r.json()) as { sessions: IcshSessionRow[] };
      return d.sessions;
    },
    refetchInterval: 5000,
  });

  const tick = tickQ.data ?? null;
  const sessions = sessionsQ.data ?? [];
  const phones = tick?.phones ?? [];
  const stats = tick?.stats ?? null;

  const setFlash = useCallback((nodeId: string, ok: boolean, line: string) => {
    setFlashes((m) => ({ ...m, [nodeId]: { ok, line } }));
    window.setTimeout(() => {
      setFlashes((m) => {
        const next = { ...m };
        delete next[nodeId];
        return next;
      });
    }, 5000);
  }, []);

  const loginOne = useCallback(
    async (phone: IcshPhoneTick, code: string, wrong: boolean) => {
      setBusy((m) => ({ ...m, [phone.nodeId]: true }));
      const s0 = performance.now();
      try {
        const r = await fetch('/api/icsh/session/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ nodeId: phone.nodeId, code }),
        });
        const d = (await r.json()) as IcshLoginOutcome;
        const ms = Math.round(performance.now() - s0);
        if (d.ok) {
          sfx.ok();
          toast.success(`${phone.callsign} LOGGED IN`, {
            description: `session ${d.session.code} · drift ${d.session.drift >= 0 ? '+' : ''}${d.session.drift} · ${d.serverMs} ms server · ${ms} ms round-trip${d.joined ? ` · JOIN COMMITTED ${d.joinCode}` : ''}`,
          });
          setFlash(phone.nodeId, true, `SESSION ${d.session.code} · DRIFT ${d.session.drift} · ${d.serverMs}MS SERVER · ${ms}MS RTT`);
        } else {
          sfx.err();
          toast.error(`${phone.callsign} LOGIN REJECTED`, { description: d.error });
          setFlash(phone.nodeId, false, `REJECTED · ${d.error}`);
        }
        void queryClient.invalidateQueries({ queryKey: ['icsh'] });
      } catch (e) {
        sfx.err();
        setFlash(phone.nodeId, false, `TRANSPORT ERROR · ${String(e instanceof Error ? e.message : e)}`);
      } finally {
        setBusy((m) => ({ ...m, [phone.nodeId]: false }));
      }
    },
    [setFlash, queryClient]
  );

  const runSweep = useCallback(async () => {
    if (sweeping) return;
    setSweeping(true);
    setSweep(null);
    sfx.click();
    try {
      const collected: SweepResult['volleys'] = [];
      for (let v = 1; v <= volleys; v++) {
        setSweepLine(`VOLLEY ${v}/${volleys} — FETCHING LIVE CODES…`);
        const tr = await fetch('/api/icsh/session/tick', { cache: 'no-store' });
        const td = (await tr.json()) as IcshSessionTick;
        const live = td.phones.filter((p) => p.status !== 'BLOCKED');
        setSweepLine(`VOLLEY ${v}/${volleys} — ${live.length} PHONES LOGGING IN CONCURRENTLY…`);
        const t0 = performance.now();
        const rows: SweepRow[] = await Promise.all(
          live.map(async (p): Promise<SweepRow> => {
            const s0 = performance.now();
            try {
              const r = await fetch('/api/icsh/session/login', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ nodeId: p.nodeId, code: p.code }),
              });
              const d = (await r.json()) as IcshLoginOutcome;
              return {
                callsign: p.callsign,
                code: p.code,
                ok: d.ok,
                drift: d.ok ? d.session.drift : null,
                ms: Math.round(performance.now() - s0),
                serverMs: d.ok ? d.serverMs : d.serverMs,
                sessionCode: d.ok ? d.session.code : null,
                joined: d.ok ? d.joined : false,
                error: d.ok ? null : d.error,
              };
            } catch (e) {
              return {
                callsign: p.callsign,
                code: p.code,
                ok: false,
                drift: null,
                ms: Math.round(performance.now() - s0),
                serverMs: null,
                sessionCode: null,
                joined: false,
                error: String(e instanceof Error ? e.message : e),
              };
            }
          })
        );
        collected.push({ wallMs: Math.round(performance.now() - t0), rows });
      }

      const allRows = collected.flatMap((v) => v.rows);
      const verified = allRows.filter((r) => r.ok);
      const joins = allRows.filter((r) => r.joined);
      const rejected = allRows.filter((r) => !r.ok);
      const wallMs = collected.reduce((a, v) => a + v.wallMs, 0);
      const maxMs = allRows.reduce((a, r) => Math.max(a, r.ms), 0);
      const meanMs = allRows.length ? Math.round(allRows.reduce((a, r) => a + r.ms, 0) / allRows.length) : 0;
      const result: SweepResult = {
        at: new Date().toISOString(),
        volleys: collected,
        totals: {
          logins: allRows.length,
          verified: verified.length,
          joins: joins.length,
          rejected: rejected.length,
          wormEvents: verified.length + joins.length + rejected.length,
          wallMs,
          maxMs,
          meanMs,
          throughput: wallMs > 0 ? Math.round((allRows.length / wallMs) * 1000) : 0,
        },
      };
      setSweep(result);
      if (result.totals.rejected === 0) {
        sfx.seal();
        toast.success(`SWEEP CLEAN — ${result.totals.verified}/${result.totals.logins} CONCURRENT LOGINS VERIFIED`, {
          description: `wall ${wallMs} ms · mean ${meanMs} ms · ${result.totals.wormEvents} WORM events · ≈${result.totals.throughput} logins/s`,
        });
      } else {
        sfx.err();
        toast.warning(`SWEEP COMPLETE WITH REJECTIONS — ${result.totals.verified}/${result.totals.logins} VERIFIED`, {
          description: `${result.totals.rejected} rejected (LOGIN_REJECTED on chain) · wall ${wallMs} ms`,
        });
      }
      void queryClient.invalidateQueries({ queryKey: ['icsh'] });
    } catch (e) {
      toast.error('SWEEP FAILED', { description: String(e instanceof Error ? e.message : e) });
    } finally {
      setSweeping(false);
      setSweepLine(null);
    }
  }, [sweeping, volleys, queryClient]);

  const revokeAll = useCallback(async () => {
    sfx.click();
    try {
      const r = await fetch('/api/icsh/session/revoke', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      const d = (await r.json()) as { revoked?: number; error?: string };
      if (r.ok) {
        sfx.ok();
        toast.success(`${d.revoked ?? 0} SESSIONS REVOKED`, { description: 'SESSION_REVOKED events appended on chain — POPIA right-to-revoke honoured' });
        void queryClient.invalidateQueries({ queryKey: ['icsh'] });
      } else {
        sfx.err();
        toast.error('REVOKE ALL FAILED', { description: d.error ?? `status ${r.status}` });
      }
    } catch (e) {
      toast.error('REVOKE ALL FAILED', { description: String(e instanceof Error ? e.message : e) });
    }
  }, [queryClient]);

  const revokeOne = useCallback(
    async (s: IcshSessionRow) => {
      sfx.click();
      try {
        const r = await fetch('/api/icsh/session/revoke', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sessionId: s.id }),
        });
        if (r.ok) {
          sfx.ok();
          toast(`${s.callsign} SESSION ${s.code} REVOKED`);
          void queryClient.invalidateQueries({ queryKey: ['icsh'] });
        } else {
          const d = (await r.json()) as { error?: string };
          sfx.err();
          toast.error('REVOKE FAILED', { description: d.error ?? `status ${r.status}` });
        }
      } catch (e) {
        toast.error('REVOKE FAILED', { description: String(e instanceof Error ? e.message : e)});
      }
    },
    [queryClient]
  );

  const beatState = sweeping ? 'RUNNING' : sweep ? 'DONE' : 'IDLE';
  const lastVolley = sweep ? sweep.volleys[sweep.volleys.length - 1] : null;

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => b.mintedAt.localeCompare(a.mintedAt)),
    [sessions]
  );

  return (
    <div className="space-y-4">
      {/* ── intro + controls ── */}
      <Panel
        title={
          <span>
            14:39 · SESSION LAB — <span className="text-[#c8ff00]">MULTI-USER PWA · CONCURRENT 2FA</span>
          </span>
        }
        right={
          <span className="text-[8px] tracking-[0.22em] text-[#5f7f68]">POPIA ACT 4 OF 2013 · OFF-LINE HMAC-SHA1</span>
        }
      >
        <p className="text-[9px] leading-relaxed tracking-[0.12em] text-[#7d9a84]">
          Every phone below is a simulated worker device running Google Authenticator against a{' '}
          <span className="text-[#c9e4cd]">real on-chain enrolment</span>. LOGIN submits that phone&apos;s live code through
          the real verify path (HMAC-SHA1 · RFC 6238 · ±1 step) and mints a{' '}
          <span className="text-[#c8ff00]">{stats ? stats.ttlMin : 15}-minute session</span> on the WORM chain. The sweep
          fires every phone at once — the concurrency test. Pair a <span className="text-[#c9e4cd]">real phone</span> from
          any ENROLMENT OPEN card (QR) and it will show the same code as the screen.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[8px] tracking-[0.24em] text-[#5f7f68]">VOLLEYS</span>
          {[1, 3, 5].map((v) => (
            <button
              key={v}
              type="button"
              disabled={sweeping}
              onClick={() => {
                setVolleys(v);
                sfx.click();
              }}
              className={cn(
                'border px-2 py-1 text-[9px] font-bold tracking-[0.18em] transition-colors disabled:opacity-40',
                volleys === v
                  ? 'border-[#c8ff00] text-[#c8ff00] icsh-glow-lime'
                  : 'border-[#24402c] text-[#7d9a84] hover:border-[#7dffa8] hover:text-[#c9e4cd]'
              )}
              aria-pressed={volleys === v}
            >
              ×{v}
            </button>
          ))}
          <IcshButton tone="lime" onClick={runSweep} disabled={sweeping || phones.length === 0} title="every phone logs in simultaneously — the concurrency test">
            {sweeping ? 'SWEEP RUNNING…' : 'RUN CONCURRENT SWEEP'}
          </IcshButton>
          <IcshButton onClick={revokeAll} disabled={sweeping || sessions.length === 0} tone="red" title="revoke every active session (SESSION_REVOKED on chain)">
            REVOKE ALL SESSIONS
          </IcshButton>
        </div>

        {/* the beat strip */}
        <div className="mt-3 flex items-center gap-1 overflow-x-auto icsh-scroll" aria-label="session beat strip">
          {BEATS.map((b, i) => {
            const lit = beatState === 'DONE' || (beatState === 'RUNNING' && i <= 1);
            return (
              <span key={b} className="flex shrink-0 items-center gap-1">
                {i > 0 ? <span className={cn('text-[10px]', lit ? 'text-[#2c4433]' : 'text-[#1a261e]')}>──►</span> : null}
                <span
                  className={cn(
                    'border px-2 py-1 text-[8px] font-bold tracking-[0.2em]',
                    lit
                      ? 'border-[#1d4d2c] bg-[#04100a] text-[#7dffa8]'
                      : 'border-[#16241a] bg-[#060b08] text-[#3f5748]',
                    beatState === 'RUNNING' && i > 1 ? 'animate-pulse' : ''
                  )}
                >
                  {b}
                </span>
              </span>
            );
          })}
          <span className="ml-2 shrink-0 text-[8px] tracking-[0.18em] text-[#5f7f68]">
            {sweepLine ?? (beatState === 'DONE' ? 'SWEEP COMPLETE — BEATS ALL LOGGED' : 'IDLE — RUN THE SWEEP')}
          </span>
        </div>
      </Panel>

      {/* ── live stats ── */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip label="PHONES" value={stats ? stats.phones : '—'} tone="lime" />
        <Chip label="ENROLMENT OPEN" value={stats ? stats.pending : '—'} tone="amber" />
        <Chip label="BOUND" value={stats ? stats.active : '—'} tone="green" />
        <Chip label="SESSIONS LIVE" value={stats ? stats.sessions : '—'} tone="lime" />
        <Chip label="TTL" value={stats ? `${stats.ttlMin} MIN` : '—'} />
        <Chip label="HEAD" value={tick ? head8(tick.head) : '—'} className="hidden sm:flex" />
        <Chip label="TICK" value={tick ? `${new Date(tick.at).toLocaleTimeString('en-ZA', { hour12: false })}` : '—'} />
      </div>

      {tickQ.isLoading ? (
        <Empty lines={['SYNCING PHONE GRID…', 'fetching on-chain enrolments + live authenticator codes']} />
      ) : tickQ.isError ? (
        <Empty
          lines={['PHONE GRID OFFLINE', String(tickQ.error instanceof Error ? tickQ.error.message : tickQ.error)]}
          action={<IcshButton onClick={() => void queryClient.invalidateQueries({ queryKey: ['icsh', 'session-tick'] })}>RETRY</IcshButton>}
        />
      ) : phones.length === 0 ? (
        <Empty lines={['NO PHONES ONBOARDED YET', 'open JOIN METHOD in the header to enrol the first device']} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {phones.map((p) => (
            <PhoneCard
              key={p.nodeId}
              phone={p}
              now={now}
              busy={!!busy[p.nodeId]}
              flash={flashes[p.nodeId] ?? null}
              onLogin={loginOne}
              onQr={setQrPhone}
              sweeping={sweeping}
            />
          ))}
        </div>
      )}

      {/* ── sweep results ── */}
      {sweep ? (
        <Panel
          title={
            <span>
              SWEEP RESULT —{' '}
              <span className={sweep.totals.rejected === 0 ? 'text-[#7dffa8]' : 'text-[#f3e38a]'}>
                {sweep.totals.verified}/{sweep.totals.logins} CONCURRENT LOGINS VERIFIED
              </span>
            </span>
          }
          right={<span className="text-[8px] tracking-[0.2em] text-[#5f7f68]">{ago(sweep.at)} · CLIENT-MEASURED</span>}
        >
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <Chip label="WALL" value={`${sweep.totals.wallMs} MS`} tone="lime" />
            <Chip label="MEAN RTT" value={`${sweep.totals.meanMs} MS`} />
            <Chip label="SLOWEST" value={`${sweep.totals.maxMs} MS`} />
            <Chip label="JOINS" value={sweep.totals.joins} tone="green" />
            <Chip label="REJECTED" value={sweep.totals.rejected} tone={sweep.totals.rejected ? 'red' : 'dim'} />
            <Chip label="WORM EVENTS" value={`+${sweep.totals.wormEvents}`} tone="amber" />
            <Chip label="THROUGHPUT" value={`≈${sweep.totals.throughput}/S`} tone="lime" />
          </div>

          {sweep.volleys.length > 1 ? (
            <ul className="mb-3 space-y-1">
              {sweep.volleys.map((v, i) => (
                <li key={i} className="flex items-center gap-2 text-[9px] tracking-[0.14em]">
                  <span className="text-[#5f7f68]">VOLLEY {i + 1}</span>
                  <span className="text-[#7dffa8] tabular-nums">{v.rows.filter((r) => r.ok).length}/{v.rows.length} VERIFIED</span>
                  <span className="text-[#7d9a84] tabular-nums">WALL {v.wallMs} MS</span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="max-h-80 overflow-y-auto icsh-scroll">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#16241a] text-[8px] tracking-[0.22em] text-[#5f7f68]">
                  <th className="py-2 pr-3 font-bold">CALLSIGN</th>
                  <th className="py-2 pr-3 font-bold">CODE SUBMITTED</th>
                  <th className="py-2 pr-3 font-bold">DRIFT</th>
                  <th className="py-2 pr-3 font-bold">RTT</th>
                  <th className="py-2 pr-3 font-bold">SERVER</th>
                  <th className="py-2 font-bold">RESULT</th>
                </tr>
              </thead>
              <tbody>
                {(lastVolley?.rows ?? []).map((r) => (
                  <tr key={r.callsign} className="border-b border-dashed border-[#142019] text-[10px] tabular-nums">
                    <td className="py-1.5 pr-3 tracking-[0.1em] text-[#c9e4cd]">{r.callsign}</td>
                    <td className="py-1.5 pr-3 text-[#7dffa8]">{fmtCode(r.code)}</td>
                    <td className="py-1.5 pr-3 text-[#7d9a84]">{r.ok ? (r.drift == null ? '—' : r.drift === 0 ? '±0' : r.drift > 0 ? `+${r.drift}` : r.drift) : '—'}</td>
                    <td className="py-1.5 pr-3 text-[#7d9a84]">{r.ms} MS</td>
                    <td className="py-1.5 pr-3 text-[#7d9a84]">{r.serverMs !== null ? `${r.serverMs} MS` : '—'}</td>
                    <td className="py-1.5">
                      {r.ok ? (
                        <span className="text-[#7dffa8]">
                          SESSION {r.sessionCode}
                          {r.joined ? <span className="ml-1 text-[#c8ff00]">· JOIN COMMITTED</span> : null}
                        </span>
                      ) : (
                        <span className="text-[#ff7a6e]">REJECTED</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      {/* ── active sessions ── */}
      <Panel
        title={
          <span>
            ACTIVE PWA SESSIONS — <span className="text-[#c8ff00]">{sortedSessions.length} LIVE</span>
          </span>
        }
        right={<span className="text-[8px] tracking-[0.2em] text-[#5f7f68]">TTL {stats?.ttlMin ?? 15} MIN · WORM-MINTED</span>}
      >
        {sortedSessions.length === 0 ? (
          <Empty
            lines={['NO ACTIVE SESSIONS', 'LOGIN a phone above or RUN CONCURRENT SWEEP — every login mints a session on chain']}
          />
        ) : (
          <div className="max-h-96 overflow-y-auto icsh-scroll">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#16241a] text-[8px] tracking-[0.22em] text-[#5f7f68]">
                  <th className="py-2 pr-3 font-bold">SESSION</th>
                  <th className="py-2 pr-3 font-bold">WORKER</th>
                  <th className="py-2 pr-3 font-bold">FARM · DISTRICT</th>
                  <th className="py-2 pr-3 font-bold">CODE</th>
                  <th className="py-2 pr-3 font-bold">DRIFT</th>
                  <th className="py-2 pr-3 font-bold">MINTED</th>
                  <th className="py-2 pr-3 font-bold">EXPIRES</th>
                  <th className="py-2 font-bold" aria-label="actions" />
                </tr>
              </thead>
              <tbody>
                {sortedSessions.map((s) => (
                  <tr key={s.id} className="border-b border-dashed border-[#142019] text-[10px] tabular-nums">
                    <td className="py-1.5 pr-3 font-bold tracking-[0.1em] text-[#c8ff00] icsh-glow-lime">{s.code}</td>
                    <td className="py-1.5 pr-3 tracking-[0.1em] text-[#c9e4cd]">{s.callsign}</td>
                    <td className="py-1.5 pr-3 text-[#7d9a84]">
                      {s.farm} <span className="text-[#3f5748]">· {s.district}</span>
                    </td>
                    <td className="py-1.5 pr-3 text-[#7dffa8]">{fmtCode(s.totpCode)}</td>
                    <td className="py-1.5 pr-3 text-[#7d9a84]">{s.drift === 0 ? '±0' : s.drift > 0 ? `+${s.drift}` : s.drift}</td>
                    <td className="py-1.5 pr-3 text-[#7d9a84]">{ago(s.mintedAt)}</td>
                    <td className="py-1.5 pr-3 text-[#f3e38a]">{fmtCountdown(s.expiresAt, now)}</td>
                    <td className="py-1.5">
                      <IcshButton tone="red" onClick={() => void revokeOne(s)} className="px-2 py-1 text-[8px]" title="revoke this session (SESSION_REVOKED on chain)">
                        REVOKE
                      </IcshButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* ── honesty ── */}
      <HonestyCard lines={SESSION_HONESTY} title="SESSION LAB · HONESTY" />

      {/* ── QR pairing dialog ── */}
      <QrPairDialog phone={qrPhone} onClose={() => setQrPhone(null)} />
    </div>
  );
}
