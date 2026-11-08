'use client';

// src/components/metro/MetroVerified.tsx — GATE 4 · MARK V — THE VERIFIED CITY.
// The full pipeline: fetch, decode, execute, write-back, halt. The program is
// LDA 5 / ADD 3 / OUT / HLT on 16 bytes of RAM; the transit schedule is the
// microcode narration; the LED façade of LATCH-1 is the truth. When 00001000
// glows across it, the city has proven itself. Deterministic: same program,
// same city, every run. SAVE/LOAD mirrors the microcode-state to localStorage.

import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Save, FolderOpen, BadgeCheck } from 'lucide-react';
import { byteBits, hex } from './metro-data';
import { metroFx } from './MetroWorkspace';
import { BusLanes } from './MetroLab';

const SAVE_KEY = 'pb_metro_markV';
const RAM = [0x15, 0x23, 0xe0, 0xf0]; // LDA 5 · ADD 3 · OUT · HLT

interface Snap {
  pc: number;
  mar: number;
  ir: number;
  a: number;
  b: number;
  out: number;
  halted: boolean;
}

interface Step {
  t: string;
  phase: string;
  desc: string;
  bus: number | null;
  snap: Snap;
}

function bin8(v: number): string {
  return byteBits(v).join('');
}

function buildSteps(): Step[] {
  const steps: Step[] = [];
  const st: Snap = { pc: 0, mar: 0, ir: 0, a: 0, b: 0, out: 0, halted: false };
  const push = (t: string, phase: string, desc: string, bus: number | null) => {
    steps.push({ t, phase, desc, bus, snap: { ...st } });
  };

  for (let addr = 0; addr < RAM.length; addr++) {
    const byte = RAM[addr];
    const op = byte >> 4;
    const operand = byte & 0x0f;

    st.mar = st.pc;
    push(
      'T0',
      'FETCH',
      `ADDRESS LOAD — PC-1 broadcasts ${hex(st.pc)} onto the trunk; MAR-1 catches it. The city knows where the next instruction lives.`,
      st.pc
    );

    st.ir = byte;
    push(
      'T1',
      'FETCH',
      `INSTRUCTION FETCH — RAM-1 reads ${hex(byte)}, broadcasts it, IR-1 catches it. The city knows what to do.`,
      byte
    );

    push(
      'T2',
      'DECODE',
      `DECODE — the IR upper nibble ${op.toString(2).padStart(4, '0')} feeds the 28C16 control towers; 16 synchronized signals reach every station.`,
      null
    );

    if (op === 0x1) {
      // LDA imm
      st.a = operand;
      push('T3', 'EXECUTE', `OPERAND — OP244-1 broadcasts the operand; Reg A catches it. A = ${operand}.`, operand);
      st.pc += 1;
      push('T4', 'WRITE-BACK', `STEP_reset fires · PC-1 advances to ${hex(st.pc)}. Fetch is universal; reset is universal again.`, null);
    } else if (op === 0x2) {
      // ADD imm
      st.b = operand;
      push('T3', 'EXECUTE', `OPERAND — OP244-1 broadcasts the operand; Reg B catches it. B = ${operand}.`, operand);
      st.a = (st.a + st.b) & 0xff;
      push('T4', 'EXECUTE', `ARITHMETIC — the 74LS283 + 74LS86 core computes A + B; the result returns to Reg A. A = ${st.a}.`, st.a);
      st.pc += 1;
      push('T5', 'WRITE-BACK', `STEP_reset fires · PC-1 advances to ${hex(st.pc)}. The next instruction begins.`, null);
    } else if (op === 0xe) {
      // OUT
      st.out = st.a;
      push('T3', 'EXECUTE', `WRITE-BACK — A-1 broadcasts ${st.a}; LATCH-1 catches it. The LED façade lights ${bin8(st.a)}.`, st.a);
      st.pc += 1;
      push('T4', 'WRITE-BACK', `STEP_reset fires · PC-1 advances to ${hex(st.pc)}.`, null);
    } else {
      // HLT
      st.halted = true;
      push('T3', 'HALT', 'HALT — the 74LS107 emergency brake silences the clock tower. The city sleeps. Not a failure: graceful shutdown.', null);
    }
  }
  return steps;
}

const STEPS = buildSteps();

export function MarkFive({ done, onComplete }: { done: boolean; onComplete: () => void }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [running, setRunning] = useState(false);
  const completedRef = useRef(false);

  const step = STEPS[Math.min(stepIdx, STEPS.length - 1)];
  const snap = step.snap;
  const isLast = stepIdx >= STEPS.length - 1;
  const verified = isLast && snap.halted && snap.out === 0x08;

  // auto-run ticker
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setStepIdx((prev) => {
        if (prev >= STEPS.length - 1) {
          setRunning(false);
          return prev;
        }
        metroFx.click();
        return prev + 1;
      });
    }, 700);
    return () => clearInterval(t);
  }, [running]);

  // completion
  useEffect(() => {
    if (verified && !done && !completedRef.current) {
      completedRef.current = true;
      metroFx.success();
      metroFx.haptic([16, 60, 16, 60, 40]);
      onComplete();
    }
  }, [verified, done, onComplete]);

  const advance = () => {
    if (isLast) return;
    metroFx.click();
    metroFx.haptic(8);
    setStepIdx((prev) => prev + 1);
  };

  const reset = () => {
    metroFx.click();
    setRunning(false);
    setStepIdx(0);
  };

  const save = () => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ stepIdx }));
      metroFx.beep();
    } catch {
      /* storage blocked — non-fatal */
    }
  };

  const load = () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const o = JSON.parse(raw) as { stepIdx?: number };
      if (typeof o.stepIdx === 'number' && o.stepIdx >= 0 && o.stepIdx < STEPS.length) {
        setRunning(false);
        setStepIdx(o.stepIdx);
        metroFx.beep();
      }
    } catch {
      /* corrupt save — ignore */
    }
  };

  const regs: [string, number, string][] = [
    ['PC-1', snap.pc, 'bookmark'],
    ['MAR-1', snap.mar, 'address'],
    ['IR-1', snap.ir, 'opcode'],
    ['A-1', snap.a, 'accumulator'],
    ['B-1', snap.b, 'operand'],
    ['OUT-1', snap.out, 'scoreboard'],
  ];

  return (
    <div className="max-w-[760px] mx-auto px-4 sm:px-6 py-5">
      <header className="mb-4">
        <h2 className="flex items-center gap-2 text-sm sm:text-base font-bold text-white">
          <BadgeCheck className="size-4 text-[#00e5ff]" aria-hidden /> THE VERIFIED CITY
        </h2>
        <p className="text-[11px] text-[#91a6b5] mt-1.5 leading-relaxed max-w-[560px]">
          The full pipeline: LDA 5 · ADD 3 · OUT · HLT — four instructions, sixteen bytes of RAM, one trunk line.
          STEP walks the transit schedule; RUN lets the clock drive. When the LED façade glows{' '}
          <span className="font-mono text-[#00ffcc]">00001000</span>, the city has verified itself.
        </p>
      </header>

      {/* controls */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => {
            if (isLast) return;
            if (running) {
              setRunning(false);
            } else {
              metroFx.click();
              setRunning(true);
            }
          }}
          disabled={isLast}
          aria-label={running ? 'Pause the clock' : 'Run the clock'}
          className="min-h-[44px] flex-1 min-w-[130px] rounded-lg border border-[#00e5ff] text-[#00e5ff] bg-[#00e5ff0d] font-mono text-[11px] tracking-[0.18em] hover:bg-[#00e5ff1a] transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {running ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
          {running ? 'PAUSE CLOCK' : 'RUN CLOCK'}
        </button>
        <button
          type="button"
          onClick={advance}
          disabled={isLast || running}
          className="min-h-[44px] flex-1 min-w-[110px] rounded-lg border border-[#00ffcc] text-[#00ffcc] bg-[#00ffcc08] font-mono text-[11px] tracking-[0.18em] hover:bg-[#00ffcc14] transition-colors disabled:opacity-40"
        >
          STEP ▸
        </button>
        <button
          type="button"
          onClick={reset}
          aria-label="Reset the run"
          className="min-h-[44px] min-w-[44px] rounded-lg border border-[#29414f] text-[#91a6b5] hover:border-[#00e5ff66] transition-colors grid place-items-center"
        >
          <RotateCcw className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={save}
          aria-label="Save the run state"
          className="min-h-[44px] min-w-[44px] rounded-lg border border-[#29414f] text-[#91a6b5] hover:border-[#00e5ff66] transition-colors grid place-items-center"
        >
          <Save className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={load}
          aria-label="Load the saved run state"
          className="min-h-[44px] min-w-[44px] rounded-lg border border-[#29414f] text-[#91a6b5] hover:border-[#00e5ff66] transition-colors grid place-items-center"
        >
          <FolderOpen className="size-3.5" aria-hidden />
        </button>
      </div>

      {/* transit schedule narration */}
      <div className="rounded-xl border border-[#214050] bg-[#0a152080] p-3.5 sm:p-4 mb-4">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className={`font-mono text-[10px] font-bold tracking-[0.2em] px-2.5 py-1 rounded border ${snap.halted ? 'border-[#ffaa00] text-[#ffaa00]' : 'border-[#00e5ff] text-[#00e5ff]'}`}>
            {step.t} · {step.phase}
          </span>
          <span className="font-mono text-[8px] tracking-[0.2em] text-[#5a7080]">
            STEP {stepIdx + 1}/{STEPS.length} · CLOCK {snap.halted ? 'SILENCED' : running ? 'RUNNING' : 'IDLE'}
          </span>
        </div>
        <div
          role="status"
          className={`rounded-lg px-3.5 py-3 font-mono text-[10.5px] leading-relaxed border ${
            step.phase === 'HALT'
              ? 'border-[#ffaa0066] bg-[#ffaa000d] text-[#ffaa00]'
              : step.phase === 'EXECUTE'
                ? 'border-[#00ffcc55] bg-[#00ffcc08] text-[#b8e8dc]'
                : 'border-[#00e5ff44] bg-[#00e5ff08] text-[#b8c7d2]'
          }`}
        >
          {step.desc}
        </div>
        {/* progress rail */}
        <div className="mt-3 h-1.5 rounded-full bg-[#0c1a25] overflow-hidden" aria-hidden>
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#ffaa00] via-[#00e5ff] to-[#00ffcc] transition-all duration-500"
            style={{ width: `${((stepIdx + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* bus */}
      <div className="mb-4">
        <BusLanes value={step.bus} active={!snap.halted && stepIdx > 0} />
      </div>

      {/* registers */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
        {regs.map(([label, v, sub]) => (
          <div
            key={label}
            className={`rounded-lg border px-2.5 py-2.5 font-mono ${
              label === 'OUT-1' && v === 0x08
                ? 'border-[#00ffcc] bg-[#00ffcc0a] shadow-[0_0_16px_rgba(0,255,204,0.25)]'
                : 'border-[#29414f] bg-[#06121a]'
            }`}
          >
            <div className="text-[7px] tracking-[0.18em] text-[#5a7080]">{label} · {sub}</div>
            <div className={`text-[13px] font-bold mt-0.5 ${label === 'OUT-1' && v === 0x08 ? 'text-[#00ffcc]' : 'text-[#00e5ff]'}`}>
              {hex(v)}
            </div>
            <div className="text-[7px] text-[#5a7080] mt-0.5">{bin8(v)}</div>
          </div>
        ))}
      </div>

      {/* LED scoreboard + program */}
      <div className="grid gap-4 sm:grid-cols-2 mb-4">
        <div className={`rounded-xl border p-3.5 sm:p-4 ${verified ? 'border-[#00ffcc] shadow-[0_0_24px_rgba(0,255,204,0.2)]' : 'border-[#214050]'} bg-[#0a152080]`}>
          <div className="font-mono text-[8px] tracking-[0.2em] text-[#91a6b5] mb-3">LATCH-1 · THE PUBLIC SCOREBOARD</div>
          <div className="flex justify-center gap-2 sm:gap-3">
            {byteBits(snap.out).map((b, i) => (
              <div key={i} className="text-center">
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 transition-all duration-300 ${
                    b ? 'bg-[#00ffcc] border-[#00ffcc] shadow-[0_0_14px_rgba(0,255,204,0.8)]' : 'bg-[#12303c] border-[#29414f]'
                  }`}
                />
                <div className={`font-mono text-[8px] mt-1.5 ${b ? 'text-[#00ffcc]' : 'text-[#5a7080]'}`}>{b}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-center font-mono text-[9px] tracking-[0.15em] text-[#91a6b5]">
            {verified ? '00001000 · 5 + 3 = 8 · VERIFIED' : `OUT = ${snap.out} · ${bin8(snap.out)}`}
          </div>
        </div>

        <div className="rounded-xl border border-[#214050] bg-[#0a152080] p-3.5 sm:p-4">
          <div className="font-mono text-[8px] tracking-[0.2em] text-[#91a6b5] mb-2.5">RAM-1 · 16 BYTES · THE PROGRAM</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono text-[10px]">
            {Array.from({ length: 16 }, (_, addr) => {
              const v = addr < RAM.length ? RAM[addr] : 0x00;
              const isPC = snap.pc === addr && !snap.halted;
              return (
                <div
                  key={addr}
                  className={`flex items-center justify-between rounded px-2 py-1 border ${
                    isPC ? 'border-[#ffaa00] bg-[#ffaa000d] text-[#ffaa00]' : 'border-transparent text-[#b8c7d2]'
                  }`}
                >
                  <span className="text-[#5a7080] text-[8px]">{hex(addr)}</span>
                  <span>{hex(v)}</span>
                  <span className="text-[7.5px] text-[#5a7080] w-[38px] text-right">
                    {addr === 0 ? 'LDA 5' : addr === 1 ? 'ADD 3' : addr === 2 ? 'OUT' : addr === 3 ? 'HLT' : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {verified && (
        <div className="rounded-xl border border-[#00ffcc] bg-[#00ffcc08] p-4 text-center">
          <div className="font-mono text-[11px] tracking-[0.25em] text-[#00ffcc] font-bold">
            {done ? '✓ GATE 4 CLEARED — THE CITY HAS PROVEN ITSELF' : 'THE CITY HAS PROVEN ITSELF'}
          </div>
          <p className="text-[10px] text-[#b8c7d2] mt-2 leading-relaxed">
            Fetch. Decode. Execute. Verify. 5 + 3 = 8, witnessed on the trunk and sealed on the scoreboard. The city
            sleeps only after it has told the truth. Same program, same city, every run — deterministic.
          </p>
        </div>
      )}

      <p className="text-center font-mono text-[7.5px] tracking-[0.18em] text-[#5a7080] mt-4">
        DETERMINISTIC EXECUTION · SAVE/LOAD STATE PERSISTS IN THIS BROWSER · METRO RULE: THE OUTPUT DISTRICT IS THE TRUTH
      </p>
    </div>
  );
}

export default MarkFive;
