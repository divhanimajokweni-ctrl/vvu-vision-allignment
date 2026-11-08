'use client';

// src/components/metro/MetroLab.tsx — GATE 2 (MARK II · The Diagnosed City)
// and GATE 3 (MARK III · The Wired City) of the PROOFBRIDGE METRO projection.
//
// Mark II: the multimeter probes (incl. the ghost-lane fix) + the 8-signal
// microcode repair + the four-phase FETCH animation.
// Mark III: pin-level wiring puzzle — the active-low inverter trap and the
// 74LS245 reversed-pin trap, validated by ENERGIZE.

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Gauge, Play, RotateCcw, Zap } from 'lucide-react';
import { byteBits, hex } from './metro-data';
import { metroFx } from './MetroWorkspace';

// ═════════════════════════════════════════════════════════════════════════════
// GATE 2 · MARK II — THE DIAGNOSED CITY
// ═════════════════════════════════════════════════════════════════════════════

const SIGNALS = ['PC_OUT', 'MAR_LD', 'MI', 'RI', 'CT', 'OP_OUT', 'A_LD', 'S_RST'] as const;

// the correct control-word matrix (rows = microcode steps T0..T3)
const UCODE_PRESET: number[][] = [
  [1, 1, 0, 0, 0, 0, 0, 0], // T0 — address load: PC drives the trunk, MAR catches
  [0, 0, 1, 1, 0, 0, 0, 0], // T1 — instruction fetch: RAM outputs, IR catches
  [0, 0, 0, 0, 1, 0, 0, 0], // T2 — decode: control towers emit 16 signals
  [0, 0, 0, 0, 0, 1, 1, 0], // T3 — operand: OP244 broadcasts, Reg A catches
];

// the broken state the player inherits (MI and A_LD dropped)
const UCODE_BROKEN: number[][] = [
  [1, 1, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 0, 0, 0],
  [0, 0, 0, 0, 0, 1, 0, 0],
];

const ROW_HINTS: string[] = [
  'T0 wrong — PC_OUT/MAR_LD: the address never loads. The city does not know where the next instruction lives.',
  'T1 wrong — MI/RI: RAM never outputs, the IR catches nothing. The city does not know what to do.',
  'T2 wrong — CT: the control towers never emit their 16-bit word. This step has no laws.',
  'T3 wrong — OP_OUT/A_LD: the operand never reaches Reg A. The write-back never happens.',
];

const PHASE_NOTES = [
  'T0 · ADDRESS LOAD — PC-1 broadcasts its address, MAR-1 catches it. The city knows where the next instruction lives.',
  'T1 · INSTRUCTION FETCH — RAM-1 reads the byte, broadcasts it, IR-1 catches it. The city knows what to do.',
  'T2 · DECODE — IR upper 4 bits feed the control towers. 16 synchronized signals. Every station listens.',
  'T3 · OPERAND — OP244 broadcasts the operand bits, Reg A catches them. Write-back is armed.',
];

interface Probe {
  id: string;
  station: string;
  point: string;
  reading: string;
  note: string;
}

function MarkTwo({ done, onComplete }: { done: boolean; onComplete: () => void }) {
  const [ucode, setUcode] = useState<number[][]>(UCODE_BROKEN.map((r) => [...r]));
  const [probed, setProbed] = useState<string[]>([]);
  const [pullDowns, setPullDowns] = useState(false);
  const [noise, setNoise] = useState(0.83);
  const [activeProbe, setActiveProbe] = useState<Probe | null>(null);
  const [phase, setPhase] = useState(-1);
  const [running, setRunning] = useState(false);
  const [phaseErr, setPhaseErr] = useState<number | null>(null);
  const [fetchOk, setFetchOk] = useState(false);

  // ghost-lane noise while the pull-down network is off
  useEffect(() => {
    if (pullDowns) return;
    const t = setInterval(() => setNoise(0.4 + Math.random() * 2.5), 420);
    return () => clearInterval(t);
  }, [pullDowns]);

  const probes: Probe[] = useMemo(
    () => [
      {
        id: 'clk',
        station: 'CLK-1',
        point: 'clock output',
        reading: '2.4 Hz · square wave',
        note: 'Astable multivibrator — the heartbeat of the entire metro. Without it no train moves.',
      },
      {
        id: 'd4',
        station: 'BUS-1 · lane D4',
        point: 'idle lane',
        reading: pullDowns ? '0.00 V · pulled down' : `${noise.toFixed(2)} V · NOISE`,
        note: pullDowns
          ? 'Ten thousand ohms to ground. Nothing floats. Nothing lies.'
          : 'GHOST TRAFFIC — a floating lane reads noise as data. Fix: energize the PULL-1 network.',
      },
      {
        id: 'aen',
        station: 'A-1 · 74LS173',
        point: 'enable M/N',
        reading: 'LOW (0 V) · active-LOW satisfied',
        note: 'Held low through INV-1 — the control tower speaks active-HIGH, the registers need LOW.',
      },
      {
        id: 'ir',
        station: 'IR-1',
        point: 'latch output',
        reading: '0x15 · opcode 0001 (LDA)',
        note: 'The upper nibble feeds the control towers; the lower nibble waits at OP244-1.',
      },
      {
        id: 'cs',
        station: 'RAM-1 · 74LS189',
        point: '/CS select',
        reading: 'LOW · memory bank selected',
        note: 'Sixteen bytes — enough to hold a program and its data.',
      },
      {
        id: 'zero',
        station: 'ZERO-1 · 74LS688',
        point: 'detector output',
        reading: 'HIGH · result non-zero',
        note: 'Active-LOW: fires only on an all-zero result. One more inverter before the flag latch.',
      },
    ],
    [pullDowns, noise]
  );

  const meterDone = probed.length === probes.length && pullDowns;

  useEffect(() => {
    if (meterDone && fetchOk && !done) onComplete();
  }, [meterDone, fetchOk, done, onComplete]);

  const tapProbe = (p: Probe) => {
    metroFx.beep();
    metroFx.haptic(10);
    setActiveProbe(p);
    setProbed((prev) => (prev.includes(p.id) ? prev : [...prev, p.id]));
  };

  const flipBit = (row: number, col: number) => {
    if (fetchOk || running) return;
    metroFx.click();
    metroFx.haptic(6);
    setUcode((prev) => prev.map((r, i) => (i === row ? r.map((b, j) => (j === col ? (b ? 0 : 1) : b)) : r)));
  };

  const runFetch = () => {
    if (running || fetchOk) return;
    metroFx.click();
    setPhaseErr(null);
    setRunning(true);
    setPhase(0);
    let i = 0;
    const t = setInterval(() => {
      const rowOk = ucode[i].every((b, j) => b === UCODE_PRESET[i][j]);
      if (!rowOk) {
        clearInterval(t);
        setRunning(false);
        setPhaseErr(i);
        metroFx.error();
        metroFx.haptic([30, 40, 30]);
        return;
      }
      i += 1;
      if (i >= 4) {
        clearInterval(t);
        setRunning(false);
        setFetchOk(true);
        metroFx.success();
        return;
      }
      setPhase(i);
    }, 750);
  };

  const resetFetch = () => {
    metroFx.click();
    setPhase(-1);
    setPhaseErr(null);
    setFetchOk(false);
    setRunning(false);
  };

  const phaseBus = phase === 0 ? 0x00 : phase === 1 ? 0x15 : phase === 3 ? 0x05 : null;
  const phaseRegs =
    phase >= 0
      ? { MAR: phase >= 0 ? 0x00 : null, IR: phase >= 1 ? 0x15 : null, A: phase >= 3 ? 0x05 : null }
      : { MAR: null, IR: null, A: null };

  return (
    <div className="max-w-[760px] mx-auto px-4 sm:px-6 py-5">
      <header className="mb-4">
        <h2 className="flex items-center gap-2 text-sm sm:text-base font-bold text-white">
          <Gauge className="size-4 text-[#00e5ff]" aria-hidden /> THE DIAGNOSED CITY
        </h2>
        <p className="text-[11px] text-[#91a6b5] mt-1.5 leading-relaxed max-w-[560px]">
          The city gained tools: a multimeter, a pull-down switch, and the microcode editor. You could diagnose
          but not build. Two jobs: probe every station (and fix the ghost lane), then repair the broken control
          word so the fetch cycle runs.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 mb-4">
        <StatusChip ok={meterDone} label={`MULTIMETER · ${probed.length}/${probes.length} PROBES${pullDowns ? ' · PULL-DOWNS ON' : ''}`} />
        <StatusChip ok={fetchOk} label={fetchOk ? 'MICROCODE · FETCH CYCLE VERIFIED' : 'MICROCODE · CONTROL WORD BROKEN'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── multimeter ── */}
        <section className="rounded-xl border border-[#214050] bg-[#0a152080] p-3.5 sm:p-4" aria-label="Multimeter">
          <div className="font-mono text-[8px] tracking-[0.2em] text-[#91a6b5] mb-2.5">MULTIMETER · TAP A PROBE POINT</div>
          <div className="grid grid-cols-2 gap-1.5">
            {probes.map((p) => {
              const isActive = activeProbe?.id === p.id;
              const seen = probed.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => tapProbe(p)}
                  aria-label={`Probe ${p.station} — ${p.point}`}
                  className={`rounded-lg border p-2.5 min-h-[58px] text-left min-w-0 transition-colors
                    ${isActive ? 'border-[#00e5ff] bg-[#00e5ff10]' : 'border-[#29414f] bg-[#0c1a25] hover:border-[#00e5ff66]'}`}
                >
                  <div className="font-mono text-[8px] text-[#91a6b5] truncate">{p.station}</div>
                  <div className={`font-mono text-[10px] font-semibold truncate mt-0.5 ${seen ? 'text-[#00ffcc]' : 'text-[#e8f1f6]'}`}>
                    {p.point}
                  </div>
                  {seen && <CheckCircle2 className="size-3 text-[#00ffcc] mt-1" aria-hidden />}
                </button>
              );
            })}
          </div>

          {/* readout */}
          <div className="mt-3 rounded-lg border border-[#29414f] bg-[#06121a] p-3 font-mono">
            <div className="text-[8px] tracking-[0.2em] text-[#5a7080]">READING</div>
            {activeProbe ? (
              <>
                <div className={`text-sm font-bold mt-1 ${activeProbe.id === 'd4' && !pullDowns ? 'text-[#e5484d]' : 'text-[#00ffcc]'}`}>
                  {activeProbe.reading}
                </div>
                <div className="text-[9px] text-[#91a6b5] leading-relaxed mt-1.5">{activeProbe.note}</div>
              </>
            ) : (
              <div className="text-sm text-[#5a7080] mt-1">-- · tap a probe point</div>
            )}
          </div>

          {/* pull-down switch */}
          <button
            type="button"
            onClick={() => {
              metroFx.place();
              metroFx.haptic(12);
              setPullDowns((v) => !v);
            }}
            aria-pressed={pullDowns}
            className="mt-3 w-full min-h-[44px] rounded-lg border font-mono text-[10px] tracking-[0.12em] transition-colors"
            style={{
              borderColor: pullDowns ? '#00ffcc' : '#ffaa00',
              color: pullDowns ? '#00ffcc' : '#ffaa00',
              background: pullDowns ? 'rgba(0,255,204,0.06)' : 'rgba(255,170,0,0.06)',
            }}
          >
            PULL-1 NETWORK · 10kΩ×8 {pullDowns ? 'ON — LANES GROUNDED' : 'OFF — GHOSTS ON THE LANES'}
          </button>
        </section>

        {/* ── microcode editor ── */}
        <section className="rounded-xl border border-[#214050] bg-[#0a152080] p-3.5 sm:p-4" aria-label="Microcode editor">
          <div className="font-mono text-[8px] tracking-[0.2em] text-[#91a6b5] mb-2.5">
            MICROCODE EDITOR · 4 STEPS × 8 SIGNALS {fetchOk ? '· VERIFIED' : '· 2 BITS DROPPED'}
          </div>
          <div className="hidden sm:grid grid-cols-[44px_repeat(8,1fr)] gap-1 mb-1">
            <span />
            {SIGNALS.map((s) => (
              <span key={s} className="font-mono text-[6.5px] text-center text-[#5a7080] truncate" title={s}>
                {s}
              </span>
            ))}
          </div>
          <div className="space-y-1.5">
            {ucode.map((row, i) => (
              <div key={i} className={`grid grid-cols-[44px_repeat(8,1fr)] gap-1 rounded-md p-1 ${phaseErr === i ? 'bg-[#e5484d1a] ring-1 ring-[#e5484d66]' : phase === i && running ? 'bg-[#00e5ff1a]' : ''}`}>
                <span className="font-mono text-[9px] text-[#ffaa00] self-center">T{i}</span>
                {row.map((bit, j) => (
                  <button
                    key={j}
                    type="button"
                    onClick={() => flipBit(i, j)}
                    disabled={fetchOk || running}
                    aria-label={`Step T${i} signal ${SIGNALS[j]}: ${bit ? 'set' : 'clear'}`}
                    aria-pressed={bit === 1}
                    title={SIGNALS[j]}
                    className={`min-h-[34px] rounded font-mono text-[10px] border transition-colors
                      ${bit ? 'bg-[#00e5ff] text-[#071018] border-[#00e5ff]' : 'bg-[#0c1a25] text-[#5a7080] border-[#29414f] hover:border-[#00e5ff66]'}
                      disabled:opacity-50`}
                  >
                    {bit}
                  </button>
                ))}
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={runFetch}
              disabled={running || fetchOk}
              className="flex-1 min-h-[44px] rounded-lg border border-[#00e5ff] text-[#00e5ff] bg-[#00e5ff0d] font-mono text-[10px] tracking-[0.15em] hover:bg-[#00e5ff1a] transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <Play className="size-3.5" aria-hidden /> {fetchOk ? 'CYCLE VERIFIED' : 'RUN FETCH CYCLE'}
            </button>
            <button
              type="button"
              onClick={resetFetch}
              aria-label="Reset the fetch cycle"
              className="min-h-[44px] min-w-[44px] rounded-lg border border-[#29414f] text-[#91a6b5] hover:border-[#00e5ff66] transition-colors grid place-items-center"
            >
              <RotateCcw className="size-3.5" aria-hidden />
            </button>
          </div>
          {phaseErr !== null && (
            <div role="alert" className="mt-2.5 rounded-lg border border-[#e5484d66] bg-[#e5484d0d] px-3 py-2 font-mono text-[9px] leading-relaxed text-[#e5484d]">
              {ROW_HINTS[phaseErr]}
            </div>
          )}
        </section>
      </div>

      {/* ── fetch animation strip ── */}
      <section className="mt-4 rounded-xl border border-[#214050] bg-[#0a152080] p-3.5 sm:p-4" aria-label="Fetch cycle animation">
        <div className="font-mono text-[8px] tracking-[0.2em] text-[#91a6b5] mb-2.5">FETCH→VERIFY · THE TRUNK CARRIES THE BYTE</div>
        <BusLanes value={phaseBus} active={phase >= 0 && phaseErr === null} />
        <div className="grid grid-cols-3 gap-2 mt-3 font-mono">
          {(
            [
              ['MAR', phaseRegs.MAR],
              ['IR', phaseRegs.IR],
              ['A', phaseRegs.A],
            ] as const
          ).map(([label, v]) => (
            <div key={label} className="rounded-lg border border-[#29414f] bg-[#06121a] px-3 py-2">
              <div className="text-[7px] tracking-[0.2em] text-[#5a7080]">{label}-1</div>
              <div className={`text-[13px] font-bold ${v !== null ? 'text-[#00e5ff]' : 'text-[#3a5060]'}`}>{v !== null ? hex(v) : '——'}</div>
            </div>
          ))}
        </div>
        <div className={`mt-3 rounded-lg px-3.5 py-2.5 font-mono text-[10px] leading-relaxed border ${phaseErr !== null ? 'border-[#e5484d66] text-[#e5484d] bg-[#e5484d0d]' : phase >= 0 ? 'border-[#00e5ff66] text-[#b8c7d2] bg-[#00e5ff08]' : 'border-[#29414f] text-[#5a7080]'}`}>
          {phaseErr !== null
            ? `RUN ABORTED AT T${phaseErr} — ${ROW_HINTS[phaseErr]}`
            : phase >= 0
              ? PHASE_NOTES[Math.min(phase, 3)]
              : 'IDLE — run the fetch cycle from the microcode panel.'}
        </div>
        {fetchOk && (
          <div className="mt-2.5 rounded-lg border border-[#00ffcc] bg-[#00ffcc08] px-3.5 py-2.5 font-mono text-[10px] text-[#00ffcc]">
            ✓ FETCH CYCLE VERIFIED — address load, instruction fetch, decode, operand. The diagnostic city works.
          </div>
        )}
      </section>

      {done && (
        <div className="mt-4 rounded-xl border border-[#00ffcc] bg-[#00ffcc08] p-4 text-center font-mono text-[10px] tracking-[0.2em] text-[#00ffcc] font-bold">
          ✓ GATE 2 CLEARED — THE CITY CAN BE DIAGNOSED
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// GATE 3 · MARK III — THE WIRED CITY
// ═════════════════════════════════════════════════════════════════════════════

interface Pin {
  id: string;
  dir: 'out' | 'in';
  label: string;
  x: number;
  y: number;
}

const PINS: Pin[] = [
  { id: 'epa.en', dir: 'out', label: 'EN', x: 188, y: 66 },
  { id: 'inv.in', dir: 'in', label: 'IN', x: 262, y: 66 },
  { id: 'inv.out', dir: 'out', label: '/OUT', x: 418, y: 66 },
  { id: 'a.en', dir: 'in', label: 'M̄N̄ EN', x: 492, y: 66 },
  { id: 'alu.sum', dir: 'out', label: 'SUM', x: 430, y: 232 },
  { id: 'xcvr.a', dir: 'in', label: 'A[7:0]', x: 462, y: 212 },
  { id: 'xcvr.b', dir: 'out', label: 'B[7:0]', x: 553, y: 232 },
  { id: 'bus.straight', dir: 'in', label: 'STRAIGHT', x: 396, y: 336 },
  { id: 'bus.crossed', dir: 'in', label: 'CROSSED', x: 560, y: 336 },
];

const NODES = [
  { id: 'epa', x: 36, y: 38, w: 152, h: 56, label: 'EPA-1 · 28C16', sub: 'control tower · active-HIGH' },
  { id: 'inv', x: 262, y: 38, w: 156, h: 56, label: 'INV-1 · 74LS04', sub: 'inverter district' },
  { id: 'regA', x: 492, y: 38, w: 152, h: 56, label: 'A-1 · 74LS173', sub: 'enable M/N · active-LOW' },
  { id: 'alu', x: 250, y: 196, w: 180, h: 56, label: 'ALU-1 · 283+86', sub: 'A=5 B=3 · computes' },
  { id: 'xcvr', x: 462, y: 176, w: 182, h: 56, label: 'XCVR-1 · 74LS245', sub: 'B-side pins reversed' },
];

const WIRE_REQUIREMENTS = ['EPA.EN → INV.IN', 'INV./OUT → A-1.EN', 'ALU.SUM → XCVR.A', 'XCVR.B → BUS-IN (CROSSED)'];

function MarkThree({ done, onComplete }: { done: boolean; onComplete: () => void }) {
  const [selected, setSelected] = useState<Pin | null>(null);
  const [wires, setWires] = useState<{ from: string; to: string }[]>([]);
  const [result, setResult] = useState<{ kind: 'fail' | 'ok'; msg: string } | null>(null);
  const [showByte, setShowByte] = useState<'none' | 'straight' | 'crossed'>('none');

  const hasWire = (a: string, b: string) => wires.some((w) => (w.from === a && w.to === b) || (w.from === b && w.to === a));

  const tapPin = (p: Pin) => {
    if (result?.kind === 'ok') return;
    metroFx.click();
    metroFx.haptic(6);
    if (p.dir === 'out') {
      setSelected(p);
      return;
    }
    // input pin
    if (!selected) {
      setResult({ kind: 'fail', msg: 'TAP AN OUTPUT PIN FIRST — outputs are gold-ringed, inputs are cyan-ringed.' });
      return;
    }
    if (p.id === selected.id) return;
    // remove any existing wire into this input
    const cleaned = wires.filter((w) => w.to !== p.id && w.from !== selected.id);
    setWires([...cleaned, { from: selected.id, to: p.id }]);
    setSelected(null);
    setResult(null);
    metroFx.place();
    metroFx.haptic(12);
  };

  const tapWire = (idx: number) => {
    metroFx.click();
    setWires((prev) => prev.filter((_, i) => i !== idx));
    setResult(null);
  };

  const energize = () => {
    const bypass = hasWire('epa.en', 'a.en');
    const invOk = hasWire('epa.en', 'inv.in') && hasWire('inv.out', 'a.en');
    const dataOk = hasWire('alu.sum', 'xcvr.a');
    const busMode: 'straight' | 'crossed' | null = hasWire('xcvr.b', 'bus.straight')
      ? 'straight'
      : hasWire('xcvr.b', 'bus.crossed')
        ? 'crossed'
        : null;

    if (bypass) {
      setResult({
        kind: 'fail',
        msg: 'THE CITY STANDS STILL — you wired EPA-1 straight into A-1. The register enables M/N are active-LOW; the control tower speaks active-HIGH. The registers will never load. Route through INV-1.',
      });
      setShowByte('none');
      metroFx.error();
      metroFx.haptic([40, 60, 40]);
      return;
    }
    if (!invOk || !dataOk || !busMode) {
      setResult({ kind: 'fail', msg: `INCOMPLETE CIRCUIT — required wires: ${WIRE_REQUIREMENTS.join(' · ')}. Tap a wire to remove it.` });
      setShowByte('none');
      metroFx.error();
      return;
    }
    if (busMode === 'straight') {
      setResult({
        kind: 'fail',
        msg: 'THE CITY SPEAKS BACKWARDS — the 74LS245 B-side is physically reversed (B7 lives on pin 11, B0 on pin 18). Straight wiring swaps every byte. Rewire XCVR.B to the CROSSED bus entry.',
      });
      setShowByte('straight');
      metroFx.error();
      metroFx.haptic([40, 60, 40]);
      return;
    }
    // success
    setResult({ kind: 'ok', msg: 'CITY ENERGIZED — polarity correct, byte order correct. A loads 5, ALU computes 5+3, the trunk carries 00001000, LATCH-1 lights the scoreboard.' });
    setShowByte('crossed');
    metroFx.success();
    metroFx.haptic([16, 50, 16, 50, 30]);
    setTimeout(() => {
      if (!done) onComplete();
    }, 1100);
  };

  const busValue = showByte === 'straight' ? 0x10 : showByte === 'crossed' ? 0x08 : null;

  return (
    <div className="max-w-[760px] mx-auto px-4 sm:px-6 py-5">
      <header className="mb-4">
        <h2 className="flex items-center gap-2 text-sm sm:text-base font-bold text-white">
          <Zap className="size-4 text-[#00e5ff]" aria-hidden /> THE WIRED CITY
        </h2>
        <p className="text-[11px] text-[#91a6b5] mt-1.5 leading-relaxed max-w-[560px]">
          The city gained roads. Tap an output pin (gold ring), then tap an input pin (cyan ring) to lay a wire —
          tap a wire to rip it out. Then ENERGIZE. The active-low inverter is no longer a warning; it is a
          required station. Registers hold 5 and 3 — the ALU is ready.
        </p>
      </header>

      <div className="rounded-xl border border-[#214050] bg-[#0a152080] p-2.5 sm:p-4">
        <svg viewBox="0 0 680 400" className="w-full h-auto select-none" role="img" aria-label="Wiring board: control tower, inverter, register, ALU, transceiver and the 8-bit bus">
          {/* bus trunk */}
          <rect x="36" y="336" width="608" height="40" rx="6" fill="#06121a" stroke="#00e5ff" strokeOpacity="0.55" />
          <text x="52" y="360" fill="#00e5ff" fontSize="9" fontFamily="ui-monospace, monospace" letterSpacing="2">
            8-BIT TRUNK · D7 D6 D5 D4 D3 D2 D1 D0
          </text>
          {byteBits(busValue ?? 0).map((b, i) =>
            b && busValue !== null ? (
              <rect key={i} x={392 + i * 22} y={340} width="18" height="8" rx="2" fill="#00ffcc" />
            ) : null
          )}
          {busValue !== null && (
            <text x="52" y="372" fill={showByte === 'straight' ? '#e5484d' : '#00ffcc'} fontSize="9" fontFamily="ui-monospace, monospace">
              {showByte === 'straight' ? 'BUS READS 0001 0000 (0x10) — WRONG ENDIAN' : 'BUS READS 0000 1000 (0x08) — 5+3 VERIFIED'}
            </text>
          )}

          {/* nodes */}
          {NODES.map((n) => (
            <g key={n.id}>
              <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="8" fill="#0a1520" stroke="#214050" />
              <text x={n.x + 12} y={n.y + 24} fill="#e8f1f6" fontSize="11" fontFamily="ui-monospace, monospace" fontWeight="700">
                {n.label}
              </text>
              <text x={n.x + 12} y={n.y + 42} fill="#91a6b5" fontSize="8" fontFamily="ui-monospace, monospace">
                {n.sub}
              </text>
            </g>
          ))}

          {/* latch scoreboard */}
          <g>
            <rect x="36" y="176" width="182" height="76" rx="8" fill="#0a1520" stroke="#214050" />
            <text x="48" y="198" fill="#e8f1f6" fontSize="10" fontFamily="ui-monospace, monospace" fontWeight="700">
              LATCH-1 · 74LS273
            </text>
            <text x="48" y="212" fill="#91a6b5" fontSize="7.5" fontFamily="ui-monospace, monospace">
              the public scoreboard
            </text>
            {byteBits(busValue === 0x08 ? 0x08 : 0).map((b, i) => (
              <circle
                key={i}
                cx={56 + i * 20}
                cy={232}
                r="6"
                fill={b ? '#00ffcc' : '#12303c'}
                stroke={b ? '#00ffcc' : '#29414f'}
                strokeWidth="1.5"
              />
            ))}
          </g>

          {/* wires */}
          {wires.map((w, idx) => {
            const a = PINS.find((p) => p.id === w.from);
            const b = PINS.find((p) => p.id === w.to);
            if (!a || !b) return null;
            const bad = (w.from === 'epa.en' && w.to === 'a.en') || (w.from === 'a.en' && w.to === 'epa.en');
            return (
              <g key={`${w.from}-${w.to}`} onClick={() => tapWire(idx)} style={{ cursor: 'pointer' }}>
                <title>{`${w.from} → ${w.to} (tap to remove)`}</title>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth="16" />
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={bad ? '#e5484d' : '#00e5ff'}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="8 5"
                  opacity="0.9"
                />
                <circle cx={(a.x + b.x) / 2} cy={(a.y + b.y) / 2} r="8" fill="#071018" stroke={bad ? '#e5484d' : '#00e5ff'} strokeWidth="1.5" />
                <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 + 3} fill={bad ? '#e5484d' : '#00e5ff'} fontSize="8" textAnchor="middle" fontFamily="ui-monospace, monospace">
                  ✕
                </text>
              </g>
            );
          })}

          {/* pins */}
          {PINS.map((p) => {
            const isSel = selected?.id === p.id;
            const stroke = p.dir === 'out' ? '#ffaa00' : '#00e5ff';
            return (
              <g key={p.id} data-pin={p.id} onClick={() => tapPin(p)} style={{ cursor: 'pointer' }}>
                <title>{`${p.label} (${p.dir === 'out' ? 'output' : 'input'})`}</title>
                <circle cx={p.x} cy={p.y} r="16" fill="transparent" />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isSel ? 10 : 7}
                  fill={isSel ? stroke : '#0a1520'}
                  stroke={stroke}
                  strokeWidth="2.5"
                  style={isSel ? { filter: `drop-shadow(0 0 6px ${stroke})` } : undefined}
                />
                <text x={p.x} y={p.y - 18} fill={stroke} fontSize="8" textAnchor="middle" fontFamily="ui-monospace, monospace">
                  {p.label}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button
            type="button"
            onClick={energize}
            className="min-h-[44px] flex-1 min-w-[160px] rounded-lg border border-[#ffaa00] text-[#ffaa00] bg-[#ffaa000d] font-mono text-[11px] tracking-[0.2em] hover:bg-[#ffaa001a] transition-colors"
          >
            ⚡ ENERGIZE THE CITY
          </button>
          <button
            type="button"
            onClick={() => {
              metroFx.click();
              setWires([]);
              setSelected(null);
              setResult(null);
              setShowByte('none');
            }}
            className="min-h-[44px] rounded-lg border border-[#29414f] text-[#91a6b5] font-mono text-[10px] tracking-[0.15em] px-4 hover:border-[#00e5ff66] transition-colors"
          >
            CLEAR ALL WIRES
          </button>
        </div>
        {selected && (
          <div className="mt-2.5 font-mono text-[9px] text-[#ffaa00]">IN HAND: {selected.label} — now tap an input pin (cyan ring)</div>
        )}
      </div>

      {result && (
        <div
          role="alert"
          className={`mt-4 rounded-xl border px-4 py-3 font-mono text-[10px] leading-relaxed ${
            result.kind === 'ok'
              ? 'border-[#00ffcc] bg-[#00ffcc08] text-[#00ffcc]'
              : 'border-[#e5484d66] bg-[#e5484d0d] text-[#e5484d]'
          }`}
        >
          {result.msg}
        </div>
      )}

      <div className="mt-4 grid sm:grid-cols-2 gap-2">
        <div className="rounded-lg border border-[#214050] bg-[#0a152080] px-3.5 py-3">
          <div className="font-mono text-[8px] tracking-[0.18em] text-[#ffaa00]">KNOWN TRAP · OP244-1</div>
          <p className="text-[10px] text-[#91a6b5] leading-relaxed mt-1">
            The operand buffer must tap the IR&apos;s internal flip-flop outputs — before the tri-state buffers — or two
            districts scream down the same lanes. Bus contention. The datasheet warns you; the trap waits.
          </p>
        </div>
        <div className="rounded-lg border border-[#214050] bg-[#0a152080] px-3.5 py-3">
          <div className="font-mono text-[8px] tracking-[0.18em] text-[#ffaa00]">KNOWN TRAP · ZERO-1</div>
          <p className="text-[10px] text-[#91a6b5] leading-relaxed mt-1">
            The 74LS688 zero detector fires active-LOW — one more inverter must sit between it and the flag latch.
            Get the polarities right or the city lies.
          </p>
        </div>
      </div>

      {done && (
        <div className="mt-4 rounded-xl border border-[#00ffcc] bg-[#00ffcc08] p-4 text-center font-mono text-[10px] tracking-[0.2em] text-[#00ffcc] font-bold">
          ✓ GATE 3 CLEARED — THE CITY IS WIRED
        </div>
      )}
    </div>
  );
}

// ── shared bits ──────────────────────────────────────────────────────────────
function StatusChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className="font-mono text-[8px] tracking-[0.15em] rounded-md px-2.5 py-1.5 border"
      style={{
        borderColor: ok ? '#00ffcc' : '#29414f',
        color: ok ? '#00ffcc' : '#91a6b5',
        background: ok ? 'rgba(0,255,204,0.06)' : 'transparent',
      }}
    >
      {ok ? '✓ ' : '○ '}
      {label}
    </span>
  );
}

function BusLanes({ value, active }: { value: number | null; active: boolean }) {
  const bits = byteBits(value ?? 0);
  return (
    <div className="rounded-lg border border-[#00e5ff44] bg-[#06121a] px-3 py-2.5">
      <div className="flex items-center justify-between font-mono text-[7px] tracking-[0.2em] text-[#5a7080] mb-1.5">
        <span>8-BIT TRUNK LINE</span>
        <span>{value !== null ? hex(value) : 'IDLE'}</span>
      </div>
      <div className="grid grid-cols-8 gap-1.5">
        {bits.map((b, i) => (
          <div key={i} className="text-center">
            <div
              className={`h-7 rounded border transition-all ${
                value !== null && b
                  ? 'bg-[#00ffcc] border-[#00ffcc] shadow-[0_0_10px_rgba(0,255,204,0.6)]'
                  : active
                    ? 'bg-[#0c1a25] border-[#29414f]'
                    : 'bg-[#0a1520] border-[#214050]'
              }`}
            />
            <div className={`font-mono text-[7px] mt-1 ${value !== null && b ? 'text-[#00ffcc]' : 'text-[#5a7080]'}`}>D{7 - i}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export { MarkTwo, MarkThree, BusLanes };
