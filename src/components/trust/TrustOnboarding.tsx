'use client';

// src/components/trust/TrustOnboarding.tsx — Task 37-4. Faithful React/canvas
// port of vvu-trust/surfaces/index.html ("ProofBridge 8-Bit — Micro-City
// Onboarding"): 12 modules on an isometric PCB, 12 missions (CLK → BUS →
// Reg A → … → OUT), pulsing target border, chip notches, verified ✓ marks,
// animated bus packets, evidence console + event ledger HUD, toast, and the
// PROGRAM COMPLETE overlay. Engine logic was sandbox-verified 72/72 in
// .qa8b-tmp/trust-engine-stress.ts BEFORE this port (Task 37-1).
//
// Port upgrades over the source (all additive, none change the game):
//   · viewport scaling so the 525×242 world fits phones (source assumed one);
//   · a real-DOM accessible module selector (44px buttons) mirroring every
//     canvas tap — keyboard + assistive-tech path, and a deterministic QA path;
//   · progress persistence (localStorage pb_trust_onboarding);
//   · WORM receipts per level + program completion (POST /api/vvu/trust +
//     socket worm-log), driving the manifest's SPEC'd → VERIFIED promotion;
//   · tiny square-wave audio FX, user-gesture safe, silent on failure.

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Check, RotateCcw, Volume2 } from 'lucide-react';
import { useSendWormLog } from '@/hooks/use-vvu-socket';
import {
  TRUST_COMPONENTS,
  TRUST_DRAW_H_K,
  TRUST_ISO,
  TRUST_MISSIONS,
  TRUST_TAGLINE,
  TRUST_WIN_TEXT,
  trustHitTest,
} from '@/lib/trust-data';

const PROGRESS_KEY = 'pb_trust_onboarding';

interface Persisted {
  step: number;
  placed: string[];
}

function readPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Persisted>;
      const s = p.step;
      if (typeof s === 'number' && Number.isInteger(s) && s >= 0 && s <= TRUST_MISSIONS.length) {
        return { step: s, placed: Array.isArray(p.placed) ? p.placed : [] };
      }
    }
  } catch {
    /* storage blocked — non-fatal */
  }
  return { step: 0, placed: [] };
}

// ── tiny audio FX (square/triangle beeps; user-gesture safe) ─────────────────
let audioCtx: AudioContext | null = null;
function tone(freq: number, ms: number, type: OscillatorType, vol: number) {
  if (typeof window === 'undefined') return;
  try {
    audioCtx ??= new AudioContext();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + ms / 1000);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + ms / 1000);
  } catch {
    /* audio unavailable — silent, non-fatal */
  }
}
const fx = {
  click: () => tone(880, 40, 'square', 0.03),
  place: () => tone(523, 90, 'triangle', 0.05),
  error: () => {
    tone(180, 150, 'sawtooth', 0.04);
    tone(140, 150, 'sawtooth', 0.03);
  },
  win: () => {
    tone(659, 110, 'triangle', 0.05);
    setTimeout(() => tone(880, 110, 'triangle', 0.05), 110);
    setTimeout(() => tone(1175, 220, 'triangle', 0.06), 220);
  },
};

interface Props {
  /** Notified after any WORM receipt lands (level / program / sweep). */
  onReceipt?: () => void;
}

export function TrustOnboarding({ onReceipt }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const sendWormLog = useSendWormLog();

  // ── game state: ref is the source of truth (rAF reads it); state mirrors UI ──
  // `boot` = one-time lazy read of persisted progress (this component renders
  // client-only — dynamic ssr:false — so localStorage is safe here).
  const [boot] = useState<Persisted>(readPersisted);

  const gameRef = useRef({
    step: boot.step,
    placed: new Set<string>(boot.placed),
    done: boot.step >= TRUST_MISSIONS.length,
  });

  const [step, setStep] = useState(boot.step);
  const [placedList, setPlacedList] = useState<string[]>(boot.placed);
  const [done, setDone] = useState(boot.step >= TRUST_MISSIONS.length);
  const [status, setStatus] = useState(
    boot.step >= TRUST_MISSIONS.length ? 'RELEASE: VERIFIED' : 'Waiting for first action.'
  );
  const [ledger, setLedger] = useState<string[]>([]);
  const [toastText, setToastText] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mission = TRUST_MISSIONS[Math.min(step, TRUST_MISSIONS.length - 1)];

  const postReceipt = useCallback(
    (action: string, payload: Record<string, unknown>) => {
      fetch('/api/vvu/trust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then(() => onReceipt?.())
        .catch(() => {
          /* offline — receipt is best-effort; localStorage still holds state */
        });
    },
    [onReceipt]
  );

  const showToast = useCallback((text: string) => {
    setToastText(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastText(null), 1700);
  }, []);

  const log = useCallback((text: string) => {
    const stamp = new Date().toLocaleTimeString('en-GB', { hour12: false });
    setLedger((prev) => [`${stamp} · ${text}`, ...prev].slice(0, 5));
  }, []);

  // ── core attempt() — identical semantics to the sandbox-verified engine ──
  const attempt = useCallback(
    (id: string) => {
      const g = gameRef.current;
      if (g.done) {
        showToast('Program already complete — run it again?');
        return;
      }
      const m = TRUST_MISSIONS[g.step];
      if (!m) return;
      if (id === m.a) {
        g.placed.add(m.a);
        g.step += 1;
        const finished = g.step >= TRUST_MISSIONS.length;
        if (finished) g.done = true;

        log('VERIFIED · ' + m.t);
        setStatus(finished ? 'RELEASE: VERIFIED' : 'Target: ' + TRUST_MISSIONS[g.step].a);
        showToast('✓ ' + m.t);
        setStep(g.step);
        setPlacedList([...g.placed]);
        fx.place();

        const details = `L${String(g.step).padStart(2, '0')}/12 · ${m.t} · ${m.a}`;
        sendWormLog('TRUST_LEVEL_VERIFIED', 'TRUST', details);
        postReceipt('LEVEL_VERIFIED', { level: g.step, title: m.t, component: m.a });

        if (finished) {
          setDone(true);
          setStatus('RELEASE: VERIFIED');
          fx.win();
          sendWormLog('TRUST_PROGRAM_COMPLETE', 'TRUST', '12/12 gates · Understand → Build → Test → Verify');
          postReceipt('PROGRAM_COMPLETE', { levels: 12 });
          toast.success('PROGRAM COMPLETE — 12/12 modules verified', {
            description: 'TRUST_PROGRAM_COMPLETE receipt appended to the WORM ledger',
          });
        }
      } else {
        fx.error();
        showToast('Not yet · target is ' + m.a);
        log('BLOCKED · ' + id + ' is not the current target');
      }
    },
    [log, postReceipt, sendWormLog, showToast]
  );

  const restart = useCallback(() => {
    gameRef.current = { step: 0, placed: new Set(), done: false };
    setStep(0);
    setPlacedList([]);
    setDone(false);
    setLedger([]);
    setStatus('Target: ' + TRUST_MISSIONS[0].a);
    try {
      localStorage.removeItem(PROGRESS_KEY);
    } catch {
      /* non-fatal */
    }
    log('RESTART · program reset to level 1');
  }, [log]);

  // persist on every change
  useEffect(() => {
    try {
      localStorage.setItem(
        PROGRESS_KEY,
        JSON.stringify({ step, placed: placedList } satisfies Persisted)
      );
    } catch {
      /* non-fatal */
    }
  }, [step, placedList]);

  // ── canvas: resize + rAF draw loop (reads refs; never re-renders React) ──
  const viewRef = useRef({ w: 0, h: 0, dpr: 1, scale: 1 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      // world extents on screen: x ±~275, y −103..121 (+shift 30) → fit with margin
      const scale = Math.max(0.42, Math.min(1.15, Math.min((w - 16) / 570, (h - 120) / 300)));
      viewRef.current = { w, h, dpr, scale };
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(stage);
    window.addEventListener('resize', resize);

    let raf = 0;
    let clockT = 0;
    let last = performance.now();

    const draw = (now: number) => {
      clockT += Math.min(0.05, (now - last) / 1000);
      last = now;
      const { w, h, scale } = viewRef.current;
      const cx = w / 2;
      const cy = h / 2 + 30 * scale;
      const S = (wx: number, wy: number) => ({
        sx: cx + wx * TRUST_ISO.x * scale,
        sy: cy + wy * TRUST_ISO.y * scale,
      });

      // background
      ctx.fillStyle = '#08131c';
      ctx.fillRect(0, 0, w, h);

      // iso grid
      ctx.strokeStyle = '#0d2a36';
      ctx.lineWidth = 1;
      for (let gx = -400; gx <= 400; gx += 40) {
        const a = S(gx, -300);
        const b = S(gx, 300);
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();
      }
      for (let gy = -300; gy <= 300; gy += 40) {
        const a = S(-400, gy);
        const b = S(400, gy);
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();
      }

      // PCB outline
      ctx.strokeStyle = '#1e7656';
      ctx.lineWidth = 2;
      const corners = [S(-330, -220), S(330, -220), S(330, 220), S(-330, 220)];
      ctx.beginPath();
      corners.forEach((p, i) => (i === 0 ? ctx.moveTo(p.sx, p.sy) : ctx.lineTo(p.sx, p.sy)));
      ctx.closePath();
      ctx.stroke();

      // components (draw order = array order, same as source)
      const g = gameRef.current;
      const target = g.done ? null : TRUST_MISSIONS[g.step]?.a ?? null;
      const fontSize = Math.max(8, 11 * scale);
      for (const c of TRUST_COMPONENTS) {
        const p = S(c.x, c.y);
        const cw = c.w * scale;
        const ch = c.h * TRUST_DRAW_H_K * scale;
        const active = g.placed.has(c.id);
        const isTarget = target === c.id;
        const pulse = isTarget ? 0.5 + 0.5 * Math.sin(clockT * 6) : 1;

        // body
        ctx.fillStyle = c.color;
        ctx.globalAlpha = active ? 1 : 0.85;
        ctx.fillRect(p.sx - cw / 2, p.sy - ch / 2, cw, ch);
        ctx.globalAlpha = 1;

        // border
        ctx.strokeStyle = isTarget
          ? `rgba(0,255,204,${0.6 + 0.4 * pulse})`
          : active
            ? '#00ffcc'
            : '#496171';
        ctx.lineWidth = isTarget ? 3 : 2;
        ctx.strokeRect(p.sx - cw / 2, p.sy - ch / 2, cw, ch);

        // chip notch (all but BUS)
        if (c.id !== 'BUS') {
          ctx.fillStyle = '#0a1015';
          ctx.beginPath();
          ctx.arc(p.sx, p.sy - ch / 2, 6 * Math.max(scale, 0.7), Math.PI, 0);
          ctx.fill();
        }

        // label
        ctx.fillStyle = '#eef7fa';
        ctx.font = `bold ${fontSize}px system-ui`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(c.label, p.sx, p.sy + 1);

        // verified marker
        if (active && c.id !== 'BUS') {
          ctx.fillStyle = '#00ff88';
          ctx.font = `bold ${Math.max(11, 14 * scale)}px system-ui`;
          ctx.fillText('✓', p.sx + cw / 2 - 10 * scale, p.sy - ch / 2 + 10 * scale);
        }
      }

      // animated packets once the bus is placed
      if (g.placed.has('BUS')) {
        const t = (clockT * 0.6) % 1;
        for (let i = 0; i < 6; i++) {
          const q = (t + i / 6) % 1;
          const p = S(-220 + q * 440, 0);
          ctx.fillStyle = '#ffd36b';
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#ffaa00';
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, Math.max(2.5, 4 * scale), 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', resize);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // ── pointer input on the canvas ──
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const { w, h, scale } = viewRef.current;
      const cx = w / 2;
      const cy = h / 2 + 30 * scale;
      const mx = (e.clientX - rect.left - cx) / scale;
      const my = (e.clientY - rect.top - cy) / scale;
      // trustHitTest expects screen-space px/py (world·ISO), same as the
      // sandbox test — no further conversion needed.
      const hit = trustHitTest(mx, my);
      if (hit) {
        fx.click();
        attempt(hit.id);
      } else {
        fx.error();
        showToast('Tap one of the modules');
      }
    },
    [attempt, showToast]
  );

  const progressPct = done ? 100 : (step / TRUST_MISSIONS.length) * 100;

  return (
    <div className="space-y-3">
      {/* stage */}
      <div
        ref={stageRef}
        className="relative h-[min(68vh,680px)] min-h-[480px] w-full overflow-hidden rounded-md border border-[#213040] bg-[#08131c]"
      >
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          className="absolute inset-0 block h-full w-full touch-none select-none"
          aria-label="8-bit micro-city board — tap the highlighted module to complete each level"
        />

        {/* mission card (overlay, like the source) */}
        <div className="pointer-events-none absolute left-2 right-2 top-2 z-[5] rounded-md border border-[#214050] bg-[#050c13ee] p-2.5 backdrop-blur-sm sm:left-3 sm:right-auto sm:w-[min(560px,58%)] sm:p-3">
          <div className="vvu-label text-[8px] tracking-[0.18em] text-[#00ffcc]">
            LEVEL {Math.min(step + 1, TRUST_MISSIONS.length)} / {TRUST_MISSIONS.length}
          </div>
          <h3 className="mt-0.5 text-sm font-bold text-white sm:text-[15px]">
            {done ? 'Program complete' : mission.t}
          </h3>
          <p className="m-0 text-[10.5px] leading-snug text-[#b8c7d2] sm:text-[11px]">
            {done ? TRUST_TAGLINE : mission.d}
          </p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#152430]">
            <div
              className="h-full rounded-full bg-[#00e5ff] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* HUD */}
        <div className="pointer-events-none absolute inset-x-2 bottom-2 z-[5] grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          <div className="pointer-events-auto min-w-0 rounded-md border border-[#214050] bg-[#050c13ee] p-2 backdrop-blur-sm">
            <b className="vvu-label text-[8px] text-[#00e5ff]">Evidence Console</b>
            <div className="mt-0.5 text-[10px] leading-snug text-[#c4d2dc]">{status}</div>
          </div>
          <div className="pointer-events-auto min-w-0 rounded-md border border-[#214050] bg-[#050c13ee] p-2 backdrop-blur-sm">
            <b className="vvu-label text-[8px] text-[#00e5ff]">Event Ledger</b>
            <div className="mt-0.5 max-h-11 overflow-y-auto font-mono text-[9px] leading-[1.35] text-[#7f95a5] [scrollbar-width:thin]">
              {ledger.length ? ledger.map((l, i) => <div key={i}>{l}</div>) : <div>—</div>}
            </div>
          </div>
        </div>

        {/* toast */}
        <div
          className={`pointer-events-none absolute left-1/2 bottom-24 z-[8] -translate-x-1/2 rounded-md border border-[#00ffcc] bg-[#050c13] px-3.5 py-2 text-center text-[10px] transition-all duration-200 ${
            toastText ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
        >
          {toastText ?? ''}
        </div>

        {/* win overlay */}
        {done && (
          <div className="absolute inset-0 z-[60] grid place-items-center bg-[rgba(2,5,10,0.88)] p-4">
            <div className="w-full max-w-[520px] rounded-lg border border-[#00ffcc] bg-[#07111b] p-6 text-center shadow-[0_0_45px_rgba(0,255,204,0.18)]">
              <div className="vvu-label text-[9px] tracking-[0.3em] text-[#00ffcc]">VVU-TRUST</div>
              <h3 className="mt-1 text-xl font-bold text-white">PROGRAM COMPLETE</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#aebdca]">{TRUST_WIN_TEXT}</p>
              <p className="mt-2 text-xs font-bold text-[#00ffcc]">{TRUST_TAGLINE}</p>
              <p className="mt-2 text-[10px] text-[#7f95a5]">
                A TRUST_PROGRAM_COMPLETE receipt is in the WORM ledger — the MANIFEST tab can now
                cite it.
              </p>
              <button
                type="button"
                onClick={restart}
                className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-md border border-[#00ffcc] bg-transparent px-5 text-xs font-bold text-[#00ffcc] transition-all hover:bg-[#00ffcc12] active:scale-[0.98]"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Run again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* accessible module selector — every canvas tap mirrored as a button */}
      <div className="rounded-md border border-[#213040] bg-[#08131c] p-2.5">
        <div className="flex items-center justify-between gap-2">
          <b className="vvu-label text-[8px] text-[#7f95a5]">
            Module selector · accessible path (taps the board)
          </b>
          <span className="hidden items-center gap-1 text-[9px] text-[#7f95a5] sm:flex">
            <Volume2 className="h-3 w-3" /> audio FX on
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {TRUST_COMPONENTS.map((c) => {
            const placed = placedList.includes(c.id);
            const isTarget = !done && mission?.a === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  fx.click();
                  attempt(c.id);
                }}
                title={c.full}
                aria-label={`${c.full} — ${placed ? 'verified' : isTarget ? 'current target' : 'not yet verified'}`}
                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-sm border px-2.5 text-[10px] font-bold transition-all active:scale-[0.97] ${
                  isTarget
                    ? 'border-[#00ffcc] bg-[#00ffcc14] text-[#00ffcc] shadow-[0_0_12px_rgba(0,255,204,0.25)]'
                    : placed
                      ? 'border-[rgba(0,255,136,0.4)] bg-[rgba(0,255,136,0.07)] text-[#00ff88]'
                      : 'border-[#2a3a46] bg-[#0b141c] text-[#8fa3b0] hover:border-[#3d5261] hover:text-[#c4d2dc]'
                }`}
              >
                {placed && <Check className="h-3 w-3" />}
                {c.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
