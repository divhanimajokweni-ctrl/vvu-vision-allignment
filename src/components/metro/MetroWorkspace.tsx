'use client';

// src/components/metro/MetroWorkspace.tsx — PROOFBRIDGE METRO · sixth
// projection (#/metro). Round 24. The 8-bit computer city of the transit-
// authority briefing: every chip is a district, every wire is a road, every
// signal is traffic. Hub = the line map (Mark 0 → Mark V gates); each gate
// is playable. Progress persists (localStorage pb_metro_progress) and every
// gate completion is WORM-logged like the rest of the VVU console.
//
// This file: hub + shared FX + GATE 0 (Mind Map) + GATE 1 (Clicker).
// MetroLab.tsx: GATE 2 (Diagnosed City) + GATE 3 (Wired City).
// MetroVerified.tsx: GATE 4 (Verified City — full 5+3=8 pipeline).
// MetroRail.tsx: Round 27 — the 📌 pinned live-telemetry rail beside GATE 4
// (the user's "Game + Left Rail" merge: the real SYS.02/SYS.03 panels while
// you play; collapses to full-screen game, phones start collapsed).

import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, BookOpen, CheckCircle2, ChevronDown, Cpu, HeartPulse, Lightbulb, TrainFront } from 'lucide-react';
import { useSendWormLog } from '@/hooks/use-vvu-socket';
import { BOM, DISTRICTS, GATES, METRO_RULES, ROADMAP, type GateId, type GateStation } from './metro-data';
import { MarkTwo, MarkThree } from './MetroLab';
import { MarkFive } from './MetroVerified';
import { MetroTelemetryRail } from './MetroRail';

// ── persistence ──────────────────────────────────────────────────────────────
type Progress = Record<GateId, boolean>;
const EMPTY_PROGRESS: Progress = { g0: false, g1: false, g2: false, g3: false, g5: false };
const PROGRESS_KEY = 'pb_metro_progress';

function readProgress(): Progress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) return { ...EMPTY_PROGRESS, ...(JSON.parse(raw) as Partial<Progress>) };
  } catch {
    /* storage blocked — non-fatal */
  }
  return EMPTY_PROGRESS;
}

function writeProgress(p: Progress) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    /* storage blocked — non-fatal */
  }
}

// ── transit FX (audio + haptics, lazy, user-gesture safe) ────────────────────
let audioCtx: AudioContext | null = null;

function metroTone(freq: number, ms: number, type: OscillatorType, vol: number) {
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

export const metroFx = {
  click: () => metroTone(880, 40, 'square', 0.035),
  place: () => metroTone(520, 70, 'triangle', 0.06),
  beep: () => metroTone(1320, 90, 'sine', 0.05),
  error: () => {
    metroTone(180, 160, 'sawtooth', 0.05);
    metroTone(140, 160, 'sawtooth', 0.04);
  },
  success: () => {
    metroTone(660, 110, 'triangle', 0.06);
    setTimeout(() => metroTone(880, 110, 'triangle', 0.06), 110);
    setTimeout(() => metroTone(1174, 190, 'triangle', 0.07), 220);
  },
  haptic: (pattern: number | number[] = 12) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        /* non-fatal */
      }
    }
  },
};

// ── component ────────────────────────────────────────────────────────────────
export function MetroWorkspace() {
  const [progress, setProgress] = useState<Progress>(readProgress);
  const [active, setActive] = useState<GateId | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const sendWormLog = useSendWormLog();

  const doneCount = useMemo(() => GATES.filter((g) => progress[g.id]).length, [progress]);

  const completeGate = useCallback(
    (id: GateId) => {
      setProgress((prev) => {
        if (prev[id]) return prev;
        const next = { ...prev, [id]: true };
        writeProgress(next);
        return next;
      });
      const gate = GATES.find((g) => g.id === id);
      if (gate) {
        sendWormLog('METRO_GATE_COMPLETE', 'METRO', `${gate.gate} · ${gate.mark} — ${gate.name}`);
        setFlash(`${gate.gate} CLEARED · ${gate.mark}`);
        metroFx.success();
        metroFx.haptic([16, 60, 16]);
        toast.success(`${gate.gate} CLEARED — ${gate.name}`, {
          description: 'METRO_GATE_COMPLETE appended to the WORM ledger',
        });
        setTimeout(() => setFlash(null), 1400);
      }
    },
    [sendWormLog]
  );

  const enterGate = useCallback((id: GateId) => {
    metroFx.click();
    metroFx.haptic(10);
    setActive(id);
  }, []);

  const activeGate: GateStation | undefined = GATES.find((g) => g.id === active);

  return (
    <div className="absolute inset-0 overflow-y-auto pbmetro-scroll bg-[#071018] text-[#e8f1f6]">
      <style>{pbmetroCss}</style>

      {flash && (
        <div className="pointer-events-none fixed inset-0 z-[80] grid place-items-center" aria-hidden>
          <div className="pbmetro-flash">{flash}</div>
        </div>
      )}

      {active === null ? (
        <MetroHub progress={progress} doneCount={doneCount} onEnter={enterGate} />
      ) : (
        <div className="min-h-full grid grid-rows-[auto_1fr]">
          <GateBar gate={activeGate} onBack={() => { metroFx.click(); setActive(null); }} />
          <div className="min-h-0">
            {active === 'g0' && <MarkZero done={progress.g0} onComplete={() => completeGate('g0')} />}
            {active === 'g1' && <MarkOne done={progress.g1} onComplete={() => completeGate('g1')} />}
            {active === 'g2' && <MarkTwo done={progress.g2} onComplete={() => completeGate('g2')} />}
            {active === 'g3' && <MarkThree done={progress.g3} onComplete={() => completeGate('g3')} />}
            {active === 'g5' && (
              <MetroTelemetryRail>
                <MarkFive done={progress.g5} onComplete={() => completeGate('g5')} />
              </MetroTelemetryRail>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── gate bar (inside a gate) ─────────────────────────────────────────────────
function GateBar({ gate, onBack }: { gate: GateStation | undefined; onBack: () => void }) {
  if (!gate) return null;
  return (
    <div className="sticky top-0 z-20 flex items-center gap-3 px-3 sm:px-5 py-2.5 bg-[#0a1520] border-b border-[#00e5ff44]">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back to the Metro line map"
        className="flex items-center justify-center size-[38px] shrink-0 rounded-lg border border-[#00e5ff] text-[#00e5ff] bg-transparent hover:bg-[#00e5ff14] transition-colors"
      >
        <ArrowLeft className="size-4" aria-hidden />
      </button>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-mono tracking-[0.25em] text-[#00ffcc]">{gate.gate} · {gate.mark}</div>
        <div className="text-sm font-semibold text-white truncate">{gate.name}</div>
      </div>
      <div className="shrink-0 font-mono text-[8px] tracking-[0.2em] text-[#ffaa00] border border-[#ffaa0066] rounded-md px-2 py-1 bg-[#ffaa000d]">
        {gate.line}
      </div>
    </div>
  );
}

// ── hub ──────────────────────────────────────────────────────────────────────
function MetroHub({
  progress,
  doneCount,
  onEnter,
}: {
  progress: Progress;
  doneCount: number;
  onEnter: (id: GateId) => void;
}) {
  const allDone = doneCount === GATES.length;
  return (
    <div className="max-w-[760px] mx-auto px-4 sm:px-6 py-5 sm:py-7">
      {/* header */}
      <header className="mb-5 sm:mb-7">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="flex items-center gap-2.5 text-base sm:text-lg font-bold text-[#00e5ff] tracking-[0.14em]" style={{ textShadow: '0 0 14px rgba(0,229,255,0.45)' }}>
            <TrainFront className="size-5 shrink-0" aria-hidden />
            PROOFBRIDGE METRO
          </h1>
          <div className="font-mono text-[8px] tracking-[0.15em] text-[#00ffcc] border border-[#00ffcc] rounded-md px-2.5 py-1.5 bg-[#00ffcc08]">
            ◉ LINE ACTIVE · {doneCount}/{GATES.length} GATES
          </div>
        </div>
        <p className="mt-2 text-[11px] sm:text-xs leading-relaxed text-[#91a6b5] max-w-[560px]">
          The 8-bit node is not a small thing you built — it is a city you founded. Chips are districts, the bus is a
          transit line, signals are traffic. Five gates, one per version. Each gate is playable alone; together they
          are the whole city. <span className="text-[#e8f1f6]">Mind the gates. Mind the polarities. Mind the ghosts.</span>
        </p>
      </header>

      {/* the line map */}
      <div className="relative pl-8 sm:pl-10 pbmetro-map">
        {GATES.map((g) => {
          const done = progress[g.id];
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => onEnter(g.id)}
              aria-label={`Enter ${g.gate} · ${g.mark} — ${g.name}`}
              className="pbmetro-station block w-full text-left mb-3.5 rounded-xl border border-[#214050] bg-[#0a1520e6] p-3.5 sm:p-4 transition-all hover:border-[#00e5ff] hover:translate-x-1 hover:shadow-[0_0_22px_rgba(0,229,255,0.14)] focus-visible:border-[#00e5ff] focus-visible:outline-none"
              data-done={done ? '1' : '0'}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-mono text-[8px] tracking-[0.22em] text-[#91a6b5]">{g.gate}</div>
                  <div className="font-mono text-[10px] tracking-[0.18em] text-[#00ffcc] font-semibold mt-0.5">{g.mark}</div>
                  <h3 className="text-sm sm:text-base text-white font-semibold mt-1">{g.name}</h3>
                  <p className="text-[10px] sm:text-[11px] leading-relaxed text-[#b8c7d2] mt-1 max-w-[480px]">{g.desc}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {g.caps.map((c) => (
                      <span
                        key={c}
                        className="font-mono text-[7.5px] tracking-[0.08em] px-2 py-1 rounded-full border border-[#29414f] bg-[#0c1a25] text-[#00e5ff]"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="shrink-0 mt-0.5" aria-hidden>
                  {done ? (
                    <CheckCircle2 className="size-5 text-[#00ffcc]" />
                  ) : (
                    <span className="block size-5 rounded-full border-2 border-[#3a5a6e]" />
                  )}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {allDone && (
        <div className="mt-1 mb-5 rounded-xl border border-[#00ffcc] bg-[#00ffcc08] p-4">
          <div className="font-mono text-[10px] tracking-[0.2em] text-[#00ffcc] font-bold">THE METRO IS VERIFIED</div>
          <p className="text-[11px] text-[#b8c7d2] mt-1.5 leading-relaxed">
            Fetch is universal. Decode is instruction-specific. Write-back is arithmetic-specific. Reset is universal
            again. The city thinks. The boroughs beyond the city limits are next.
          </p>
        </div>
      )}

      {/* metro rules */}
      <section aria-label="Metro rules" className="mb-5">
        <h2 className="flex items-center gap-2 font-mono text-[9px] tracking-[0.22em] text-[#ffaa00] mb-2.5">
          <Lightbulb className="size-3.5" aria-hidden /> WHAT THE CITY TEACHES ITS OWN BUILDERS
        </h2>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {METRO_RULES.map((r) => (
            <li key={r} className="text-[10px] sm:text-[11px] leading-relaxed text-[#b8c7d2] rounded-lg border border-[#214050] bg-[#0a152080] px-3 py-2.5">
              {r}
            </li>
          ))}
        </ul>
      </section>

      {/* roadmap */}
      <section aria-label="Beyond the city limits" className="mb-4">
        <h2 className="flex items-center gap-2 font-mono text-[9px] tracking-[0.22em] text-[#00e5ff] mb-2.5">
          <TrainFront className="size-3.5" aria-hidden /> WHAT&apos;S PAST THE CITY LIMITS
        </h2>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {ROADMAP.map((lv) => (
            <div key={lv.level} className="rounded-lg border border-[#214050] bg-[#0a152080] px-3 py-2.5">
              <div className="font-mono text-[8px] tracking-[0.18em] text-[#ffaa00]">{lv.level} · {lv.name}</div>
              <p className="text-[10px] text-[#91a6b5] leading-relaxed mt-1">{lv.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="text-center font-mono text-[7.5px] tracking-[0.2em] text-[#5a7080] pb-4">
        PROOFBRIDGE METRO · STAGE ARCHIVE · TAP A STATION TO ENTER · GATES COMPUTED, NOT CLAIMED
      </p>
    </div>
  );
}

// ── GATE 0 · MARK 0 — THE MIND MAP ───────────────────────────────────────────
function MarkZero({ done, onComplete }: { done: boolean; onComplete: () => void }) {
  const [open, setOpen] = useState<string[]>([]);
  const allOpen = DISTRICTS.every((d) => open.includes(d.id));

  const toggle = (id: string) => {
    metroFx.click();
    metroFx.haptic(8);
    setOpen((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="max-w-[760px] mx-auto px-4 sm:px-6 py-5">
      <header className="mb-4">
        <h2 className="flex items-center gap-2 text-sm sm:text-base font-bold text-white">
          <BookOpen className="size-4 text-[#00e5ff]" aria-hidden /> THE MIND MAP
        </h2>
        <p className="text-[11px] text-[#91a6b5] mt-1.5 leading-relaxed max-w-[560px]">
          Intent before implementation. The city exists as a map: four territories, one trunk line, a bill of
          materials. Open every territory to acknowledge the plan — Gate 0 is reading the zoning laws before
          pouring concrete.
        </p>
      </header>

      {/* line map diagram */}
      <div className="rounded-xl border border-[#214050] bg-[#0a152080] p-4 mb-4 overflow-x-auto">
        <div className="font-mono text-[8px] tracking-[0.2em] text-[#91a6b5] mb-3">PROOFBRIDGE METRO · LINE MAP</div>
        <div className="min-w-[520px]">
          <div className="flex gap-3 mb-2 pl-8">
            <span className="font-mono text-[9px] text-[#ffaa00] border border-[#ffaa0066] rounded px-2 py-1">CLK-1 · NE555</span>
            <span className="font-mono text-[9px] text-[#ffaa00] border border-[#ffaa0066] rounded px-2 py-1">HALT-1 · 74LS107</span>
          </div>
          <div className="h-8 rounded-md border-y-2 border-[#00e5ff66] bg-gradient-to-r from-[#ffaa0022] via-[#00e5ff22] to-[#00ffcc22] flex items-center justify-center font-mono text-[8px] tracking-[0.3em] text-[#00e5ff]">
            8-BIT TRUNK LINE · D7 D6 D5 D4 D3 D2 D1 D0
          </div>
          <div className="grid grid-cols-9 gap-1 mt-2 font-mono text-[7.5px] text-center text-[#b8c7d2]">
            {['A', 'B', 'ALU', 'INV', 'MAR', 'IR', 'PC', 'RAM', 'OUT'].map((s) => (
              <span key={s} className="rounded border border-[#29414f] bg-[#0c1a25] py-1">{s}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 mt-1.5 font-mono text-[7.5px] text-center text-[#91a6b5]">
            {['EPA', 'EPB', 'XCVR', 'LATCH', 'ZERO', 'OP244', 'PULL'].map((s) => (
              <span key={s} className="rounded border border-[#29414f] bg-[#0a1520] py-1">{s}</span>
            ))}
          </div>
          <div className="font-mono text-[7px] text-[#5a7080] mt-2 tracking-[0.15em]">
            NORTH LINE · PROCESSING DISTRICT — SOUTH LINE · CONTROL &amp; MEMORY DISTRICT
          </div>
        </div>
      </div>

      {/* territories */}
      <div className="space-y-2.5 mb-4">
        {DISTRICTS.map((d) => {
          const isOpen = open.includes(d.id);
          return (
            <div key={d.id} className="rounded-xl border border-[#214050] bg-[#0a1520e6] overflow-hidden">
              <button
                type="button"
                onClick={() => toggle(d.id)}
                aria-expanded={isOpen}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[#0c1a25] transition-colors min-h-[44px]"
              >
                <Cpu className="size-4 shrink-0 text-[#00e5ff]" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[7.5px] tracking-[0.2em] text-[#91a6b5]">{d.num} · {d.line}</div>
                  <div className="text-[13px] font-semibold text-white mt-0.5">{d.name}</div>
                </div>
                <ChevronDown className={`size-4 shrink-0 text-[#91a6b5] transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden />
              </button>
              {isOpen && (
                <div className="px-4 pb-4 pt-1 border-t border-[#214050] space-y-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {d.stations.map((s) => (
                      <span key={s} className="font-mono text-[7.5px] px-2 py-1 rounded-full border border-[#29414f] bg-[#0c1a25] text-[#00e5ff]">
                        {s}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] leading-relaxed text-[#b8c7d2]">{d.role}</p>
                  <p className="text-[10px] leading-relaxed text-[#91a6b5]">{d.detail}</p>
                  <p className="text-[10px] leading-relaxed font-mono text-[#ffaa00] border-l-2 border-[#ffaa00] pl-2.5">
                    METRO RULE: {d.rule}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* BOM */}
      <details className="rounded-xl border border-[#214050] bg-[#0a152080] mb-5">
        <summary className="px-4 py-3 font-mono text-[9px] tracking-[0.2em] text-[#00e5ff] cursor-pointer min-h-[44px] flex items-center">
          BILL OF MATERIALS · {BOM.length} LINE ITEMS
        </summary>
        <div className="px-4 pb-4 grid gap-1 sm:grid-cols-2">
          {BOM.map((b) => (
            <div key={b.chip} className="flex items-baseline gap-2 text-[10px] text-[#b8c7d2] py-1">
              <span className="font-mono text-[#00ffcc] shrink-0">{b.chip}</span>
              <span className="text-[#5a7080] shrink-0">×{b.count}</span>
              <span className="text-[#91a6b5] min-w-0">{b.role}</span>
            </div>
          ))}
        </div>
      </details>

      <button
        type="button"
        disabled={!allOpen || done}
        onClick={onComplete}
        className="w-full min-h-[48px] rounded-xl font-mono text-[11px] tracking-[0.2em] border transition-all
          disabled:opacity-40 disabled:cursor-not-allowed
          enabled:border-[#00ffcc] enabled:text-[#00ffcc] enabled:bg-[#00ffcc0a] enabled:hover:bg-[#00ffcc1a]"
      >
        {done ? '✓ GATE 0 ACKNOWLEDGED' : allOpen ? 'ACKNOWLEDGE INTENT — PROCEED TO MARK I' : `OPEN ALL ${DISTRICTS.length} TERRITORIES TO ACKNOWLEDGE (${open.length}/${DISTRICTS.length})`}
      </button>
    </div>
  );
}

// ── GATE 1 · MARK I — THE CLICKER ────────────────────────────────────────────
interface TrayChip {
  id: string;
  chip: string;
  label: string;
  hint: string;
}
interface Slot {
  id: string;
  code: string;
  name: string;
  hint: string;
  correct: string;
}

const TRAY: TrayChip[] = [
  { id: 'ne555', chip: 'NE555', label: 'CLOCK TOWER', hint: 'astable square wave · the heartbeat' },
  { id: 'ls107', chip: '74LS107', label: 'EMERGENCY BRAKE', hint: 'JK latch · silences the clock on HLT' },
  { id: 'ls161', chip: '74LS161', label: 'PROGRAM COUNTER', hint: 'the bookmark of the city' },
  { id: 'ls189', chip: '74LS189', label: 'MEMORY BANK', hint: '16 bytes · program + data' },
  { id: 'ls173', chip: '74LS173', label: 'IR LATCH', hint: 'catches the opcode' },
  { id: 'ls283', chip: '74LS283+86', label: 'ARITHMETIC CORE', hint: '8-bit adder · where 5+3 is decided' },
  { id: 'ls273', chip: '74LS273', label: 'OUTPUT LATCH', hint: 'holds the result · LED façade' },
  { id: 'pull', chip: '10kΩ ×8', label: 'PULL-DOWN NET', hint: 'one per lane · no ghosts' },
];

const SLOTS: Slot[] = [
  { id: 's-clk', code: 'CLK-1', name: 'HEARTBEAT', hint: 'produces the pulse', correct: 'ne555' },
  { id: 's-halt', code: 'HALT-1', name: 'HEARTBEAT', hint: 'graceful shutdown', correct: 'ls107' },
  { id: 's-pc', code: 'PC-1', name: 'BRAIN', hint: 'knows which instruction is next', correct: 'ls161' },
  { id: 's-ram', code: 'RAM-1', name: 'BRAIN', hint: 'where the program lives', correct: 'ls189' },
  { id: 's-ir', code: 'IR-1', name: 'BRAIN', hint: 'catches what to do', correct: 'ls173' },
  { id: 's-alu', code: 'ALU-1', name: 'PROCESSING', hint: 'where arithmetic is decided', correct: 'ls283' },
  { id: 's-out', code: 'OUT-1', name: 'PROCESSING', hint: 'the public scoreboard', correct: 'ls273' },
  { id: 's-pull', code: 'PULL-1', name: 'SKELETON', hint: 'no lane floats', correct: 'pull' },
];

function MarkOne({ done, onComplete }: { done: boolean; onComplete: () => void }) {
  const [hand, setHand] = useState<TrayChip | null>(null);
  const [placed, setPlaced] = useState<Record<string, string>>({});
  const [ravine, setRavine] = useState<string | null>(null);
  const [beat, setBeat] = useState(false);

  const placedCount = Object.keys(placed).length;
  const allPlaced = placedCount === SLOTS.length;

  const takeChip = (c: TrayChip) => {
    metroFx.click();
    metroFx.haptic(8);
    setHand(c);
  };

  const tapSlot = (s: Slot) => {
    if (allPlaced) return;
    if (!hand) {
      setRavine('PICK A CHIP FROM THE TRAY FIRST');
      metroFx.error();
      return;
    }
    if (placed[s.id]) return;
    if (hand.id === s.correct) {
      const next = { ...placed, [s.id]: hand.id };
      setPlaced(next);
      setHand(null);
      setRavine(null);
      metroFx.place();
      metroFx.haptic(14);
      if (Object.keys(next).length === SLOTS.length) {
        setBeat(true);
        metroFx.beep();
        setTimeout(() => {
          metroFx.beep();
          onComplete();
        }, 900);
      }
    } else {
      setRavine(`RAVINE — ${hand.chip} does not belong at ${s.code}. ${s.hint.toUpperCase()}.`);
      metroFx.error();
      metroFx.haptic([30, 40, 30]);
    }
  };

  return (
    <div className="max-w-[760px] mx-auto px-4 sm:px-6 py-5">
      <header className="mb-4">
        <h2 className="flex items-center gap-2 text-sm sm:text-base font-bold text-white">
          <Cpu className="size-4 text-[#00e5ff]" aria-hidden /> THE CLICKER
        </h2>
        <p className="text-[11px] text-[#91a6b5] mt-1.5 leading-relaxed max-w-[560px]">
          First playable. The city is a picture that accepts chips. Tap a chip in the tray, then tap its station.
          Wrong district = the ravine. Place all {SLOTS.length} stations and the city gains a heartbeat.
        </p>
      </header>

      {ravine && (
        <div role="alert" className="mb-3 rounded-lg border border-[#e5484d66] bg-[#e5484d0d] px-3.5 py-2.5 font-mono text-[10px] tracking-[0.08em] text-[#e5484d]">
          {ravine}
        </div>
      )}

      {/* the board */}
      <div className={`rounded-xl border p-3.5 sm:p-4 mb-4 transition-colors ${beat ? 'border-[#00ffcc] shadow-[0_0_26px_rgba(0,255,204,0.25)]' : 'border-[#214050]'} bg-[#0a152080]`}>
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono text-[8px] tracking-[0.2em] text-[#91a6b5]">THE BOARD · {placedCount}/{SLOTS.length} STATIONS</span>
          {beat && (
            <span className="flex items-center gap-1.5 font-mono text-[8px] tracking-[0.15em] text-[#00ffcc]">
              <HeartPulse className="size-3.5 pbmetro-heartbeat" aria-hidden /> HEARTBEAT ACQUIRED
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SLOTS.map((s) => {
            const chipId = placed[s.id];
            const chip = TRAY.find((c) => c.id === chipId);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => tapSlot(s)}
                aria-label={`Station ${s.code}: ${chip ? `${chip.chip} placed` : 'empty'}`}
                className={`rounded-lg border p-2.5 min-h-[76px] text-left transition-all min-w-0
                  ${chip ? 'border-[#00ffcc66] bg-[#00ffcc08]' : 'border-[#29414f] bg-[#0c1a25] hover:border-[#00e5ff66]'}
                  ${hand && !chip ? 'ring-1 ring-[#00e5ff55]' : ''}`}
              >
                <div className="font-mono text-[7.5px] tracking-[0.15em] text-[#91a6b5]">{s.code} · {s.name}</div>
                {chip ? (
                  <div className="mt-1">
                    <div className="font-mono text-[10px] text-[#00ffcc] font-semibold truncate">{chip.chip}</div>
                    <div className="text-[8.5px] text-[#91a6b5] truncate">{chip.label.toLowerCase()}</div>
                  </div>
                ) : (
                  <div className="mt-1 text-[9px] text-[#5a7080] leading-snug">{s.hint}…</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* the tray */}
      <div className="rounded-xl border border-[#214050] bg-[#0a1520e6] p-3.5">
        <div className="font-mono text-[8px] tracking-[0.2em] text-[#91a6b5] mb-2.5">
          COMPONENT TRAY {hand ? `· IN HAND: ${hand.chip} — TAP A STATION` : '· TAP TO TAKE A CHIP'}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TRAY.map((c) => {
            const isPlaced = Object.values(placed).includes(c.id);
            const isHand = hand?.id === c.id;
            return (
              <button
                key={c.id}
                type="button"
                disabled={isPlaced || allPlaced}
                onClick={() => takeChip(c)}
                aria-label={`Take ${c.chip} — ${c.label}`}
                className={`rounded-lg border p-2.5 text-left min-h-[64px] min-w-0 transition-all disabled:opacity-30
                  ${isHand ? 'border-[#ffaa00] bg-[#ffaa000d] ring-1 ring-[#ffaa0066]' : 'border-[#29414f] bg-[#0c1a25] hover:border-[#00e5ff66]'}
                  ${isPlaced ? 'cursor-default' : ''}`}
              >
                <div className={`font-mono text-[10px] font-semibold truncate ${isHand ? 'text-[#ffaa00]' : 'text-[#00e5ff]'}`}>
                  {c.chip}
                </div>
                <div className="text-[8.5px] text-[#91a6b5] truncate">{c.label.toLowerCase()}</div>
                <div className="text-[7.5px] text-[#5a7080] truncate mt-0.5">{c.hint}</div>
              </button>
            );
          })}
        </div>
      </div>

      {allPlaced && (
        <div className="mt-4 rounded-xl border border-[#00ffcc] bg-[#00ffcc08] p-4 text-center">
          <div className="font-mono text-[10px] tracking-[0.2em] text-[#00ffcc] font-bold">
            {done ? '✓ GATE 1 CLEARED — THE CITY HAS A HEARTBEAT' : 'CITY ENERGIZED — HEARTBEAT RUNNING'}
          </div>
          <p className="text-[10px] text-[#b8c7d2] mt-1.5">
            No station runs without the heartbeat. The brake is not a bug; the brake is the point.
          </p>
        </div>
      )}
    </div>
  );
}

// ── scoped CSS ───────────────────────────────────────────────────────────────
const pbmetroCss = `
.pbmetro-scroll { scrollbar-width: thin; scrollbar-color: #214050 #071018; }
.pbmetro-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
.pbmetro-scroll::-webkit-scrollbar-track { background: #071018; }
.pbmetro-scroll::-webkit-scrollbar-thumb { background: #214050; border-radius: 4px; }
.pbmetro-scroll::-webkit-scrollbar-thumb:hover { background: #00e5ff66; }

.pbmetro-map { position: relative; }
.pbmetro-map::before {
  content: ""; position: absolute; left: 13px; top: 18px; bottom: 18px; width: 3px;
  background: linear-gradient(180deg, #ffaa00 0%, #00e5ff 25%, #00ffcc 50%, #ffaa00 75%, #00e5ff 100%);
  border-radius: 2px; opacity: 0.55;
}
@media (min-width: 640px) { .pbmetro-map::before { left: 17px; } }
.pbmetro-station { position: relative; }
.pbmetro-station::before {
  content: ""; position: absolute; left: -23px; top: 24px; width: 13px; height: 13px;
  border-radius: 50%; background: #071018; border: 3px solid #00e5ff;
  box-shadow: 0 0 10px rgba(0,229,255,0.6);
}
.pbmetro-station[data-done="1"]::before { border-color: #00ffcc; box-shadow: 0 0 12px rgba(0,255,204,0.8); }

@keyframes pbmetro-gflash {
  0% { opacity: 0; transform: scale(0.85); }
  30% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.12); }
}
.pbmetro-flash {
  font-family: ui-monospace, monospace; font-size: 14px; color: #00e5ff; letter-spacing: 0.3em;
  animation: pbmetro-gflash 1.3s ease-out forwards; text-shadow: 0 0 24px rgba(0,229,255,0.7);
}
@keyframes pbmetro-beat { 0%, 100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 1; transform: scale(1.18); } }
.pbmetro-heartbeat { animation: pbmetro-beat 0.9s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .pbmetro-flash { animation: none; opacity: 1; }
  .pbmetro-heartbeat { animation: none; }
  .pbmetro-station { transition: none; }
}
`;

export default MetroWorkspace;
