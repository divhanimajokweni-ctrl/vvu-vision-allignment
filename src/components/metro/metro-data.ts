// src/components/metro/metro-data.ts — PROOFBRIDGE METRO content model.
//
// Round 24 · sixth projection #/metro. A playable 8-bit computer city:
// "Every chip is a district. Every wire is a road. Every signal is traffic."
// Content is the transit-authority briefing, mapped to playable gates
// (Mark 0 → Mark V). Pure data — no JSX, no side effects.

// ── the transit palette (user-specified in the Metro briefing) ───────────────
export const METRO_COLORS = {
  bg: '#071018',
  panel: '#0a1520',
  line: '#214050',
  cyan: '#00e5ff',
  mint: '#00ffcc',
  gold: '#ffaa00',
  text: '#e8f1f6',
  muted: '#91a6b5',
  danger: '#e5484d',
} as const;

// ── districts (the four territories) ─────────────────────────────────────────
export interface District {
  id: string;
  num: string;
  name: string;
  line: string;
  stations: string[];
  role: string;
  rule: string;
  detail: string;
}

export const DISTRICTS: District[] = [
  {
    id: 'heartbeat',
    num: 'TERRITORY 1',
    name: 'THE HEARTBEAT DISTRICT',
    line: 'NORTH OF THE TRUNK',
    stations: ['CLK-1 · NE555 Central Clock Tower', 'HALT-1 · 74LS107 Emergency Brake'],
    role: 'The astable clock pulse is the heartbeat of the entire metro. The HALT latch is the graceful shutdown — not a bug; the point.',
    rule: 'No station runs without the heartbeat. The brake is not a bug; the brake is the point.',
    detail:
      'The NE555 astable multivibrator produces a continuous square wave — a traffic light cycling forever. When the Instruction Register decodes HLT, the 74LS107 JK latch silences the clock tower and the city halts.',
  },
  {
    id: 'skeleton',
    num: 'TERRITORY 2',
    name: 'THE SKELETON DISTRICT',
    line: 'THE TRUNK ITSELF',
    stations: ['BUS-1 · 8-Bit Trunk Line D7…D0', 'PULL-1 · 10k Pull-Down Network'],
    role: 'Eight lanes carry every byte between districts. The only road that connects every station.',
    rule: 'A road without pull-downs is a road with ghosts. Wire the ground. Always.',
    detail:
      'A lane touched by nothing, pulled by nothing, is a floating lane — the city reads noise as data. Ghost traffic. One 10kΩ resistor to ground per lane forces every idle lane to a clean, deterministic 0 volts. Nothing floats. Nothing lies.',
  },
  {
    id: 'processing',
    num: 'TERRITORY 3',
    name: 'THE PROCESSING DISTRICT',
    line: 'NORTH LINE',
    stations: [
      'A-1 / B-1 · 74LS173 Register Towers',
      'INV-1 · 74LS04 Inverter District',
      'ALU-1 · 74LS283 + 74LS86 Arithmetic Core',
      'XCVR-1 · 74LS245 Byte-Order District',
      'LATCH-1 · 74LS273 Output District',
    ],
    role: 'The busiest district: operands are held, polarity is flipped, arithmetic is decided, and the public scoreboard is lit.',
    rule: 'The Inverter District is not optional. The Byte-Order District reverses. The Output District is the truth.',
    detail:
      'The register enable pins M and N are active-LOW while the control tower speaks active-HIGH — the inverter district exists to flip that polarity. The 74LS245 B-side pins are physically reversed (B7 on pin 11, B0 on pin 18). The 74LS273 catches the ALU result and holds it on the LED façade.',
  },
  {
    id: 'brain',
    num: 'TERRITORY 4',
    name: 'THE BRAIN DISTRICT',
    line: 'SOUTH LINE',
    stations: [
      'RAM-1 · 74LS189 Memory Bank (16 bytes)',
      'EPA-1 / EPB-1 · 28C16 Microcode Control Towers',
      'PC-1 · 74LS161 Program Counter',
      'MAR-1 · Memory Address Register',
      'IR-1 · Instruction Register',
      'OP244-1 · 74LS244 Operand Buffer',
      'ZERO-1 · 74LS688 Zero Detector',
    ],
    role: 'The capital district. Every decision the city makes originates here — 16 synchronized control signals orchestrate every station.',
    rule: 'The control towers are the brain. The fetch trio is the spine. The zero detector is the reflex. Get the polarities right or the city lies.',
    detail:
      'OP244 must tap the Instruction Register’s internal flip-flop outputs — before the IR’s own tri-state buffers — or two districts scream down the same lanes (bus contention). The zero detector’s output is active-LOW: one more inverter between it and the flag latch.',
  },
];

// ── bill of materials ────────────────────────────────────────────────────────
export const BOM: { chip: string; role: string; count: number }[] = [
  { chip: 'NE555', role: 'Central Clock Tower — astable heartbeat', count: 1 },
  { chip: '74LS107', role: 'Emergency Brake — JK halt latch', count: 1 },
  { chip: '74LS173', role: 'Register Towers (A, B) + IR catch', count: 3 },
  { chip: '74LS04', role: 'Inverter District — hex inverter', count: 1 },
  { chip: '74LS283 + 74LS86', role: 'Arithmetic Core — 8-bit add + XOR subtract', count: 2 },
  { chip: '74LS245', role: 'Byte-Order District — the reversed-pin trap', count: 1 },
  { chip: '74LS273', role: 'Output District — LED scoreboard latch', count: 1 },
  { chip: '74LS189', role: 'Memory Bank — 16 bytes', count: 1 },
  { chip: '74LS161', role: 'Program Counter — bookmark of the city', count: 1 },
  { chip: '28C16', role: 'Microcode Control Towers (EPA, EPB)', count: 2 },
  { chip: '74LS244', role: 'Operand Buffer — taps IR flip-flops', count: 1 },
  { chip: '74LS688', role: 'Zero Detector — the reflex', count: 1 },
  { chip: '10kΩ network', role: 'Pull-Down resistors — one per lane', count: 8 },
];

// ── metro rules ──────────────────────────────────────────────────────────────
export const METRO_RULES: string[] = [
  'A city without pull-downs is a city of ghosts.',
  'A city without inverters is a city that never wakes.',
  'A city without reversed pins is a city that doesn’t know itself.',
  'A city without microcode is a city with no laws.',
  'A city without verification is a city that lies to itself.',
];

// ── the line map (hub stations = playable gates) ─────────────────────────────
export type GateId = 'g0' | 'g1' | 'g2' | 'g3' | 'g5';

export interface GateStation {
  id: GateId;
  gate: string;
  mark: string;
  name: string;
  line: string;
  desc: string;
  caps: string[];
}

export const GATES: GateStation[] = [
  {
    id: 'g0',
    gate: 'GATE 0',
    mark: 'MARK 0',
    name: 'The Mind Map',
    line: 'CONCEPT LINE',
    desc: 'Decision tree + Micro-City map + bill of materials. Intent before implementation — no playable code.',
    caps: ['Concept', 'No Interaction'],
  },
  {
    id: 'g1',
    gate: 'GATE 1',
    mark: 'MARK I',
    name: 'The Clicker',
    line: 'PLACEMENT LINE',
    desc: 'First playable. Tap a chip in the tray, place it at its station. Wrong district = the ravine.',
    caps: ['Tray Placement', 'Ravine Check'],
  },
  {
    id: 'g2',
    gate: 'GATE 2',
    mark: 'MARK II',
    name: 'The Diagnosed City',
    line: 'DIAGNOSTIC LINE',
    desc: 'Multimeter probes + the 16-bit microcode editor + the four-phase FETCH→VERIFY animation.',
    caps: ['Multimeter', 'Ghost Lane Fix', 'Microcode'],
  },
  {
    id: 'g3',
    gate: 'GATE 3',
    mark: 'MARK III',
    name: 'The Wired City',
    line: 'WIRING LINE',
    desc: 'Pin-level wiring. The active-low inverter stops being a warning and becomes a required station.',
    caps: ['Wire Tool', 'A→INV→ALU', 'Byte Order'],
  },
  {
    id: 'g5',
    gate: 'GATE 4',
    mark: 'MARK V',
    name: 'The Verified City',
    line: 'VERIFICATION LINE',
    desc: 'The full pipeline: fetch, decode, execute, verify. 5 + 3 = 8. The LEDs light 00001000 and the city proves itself.',
    caps: ['Full Pipeline', 'Save / Load', 'LED Verify'],
  },
];

// ── what's past the city limits (roadmap) ────────────────────────────────────
export const ROADMAP: { level: string; name: string; desc: string }[] = [
  { level: 'LEVEL 6', name: 'Interrupt District', desc: 'A station that halts the trunk mid-instruction and jumps to a priority handler.' },
  { level: 'LEVEL 7', name: 'Stack Yard', desc: 'A second 74LS161 becomes the stack pointer. PUSH and POP become train operations.' },
  { level: 'LEVEL 8', name: 'Expansion Zone', desc: 'The 16-byte RAM becomes a 2KB 6116. The city grows.' },
  { level: 'LEVEL 9', name: 'Instruction Set Bypass', desc: 'From 6 toy opcodes to a full 16-opcode transit network.' },
  { level: 'LEVEL 10', name: 'The Press', desc: 'Export the board as a wiring SVG; the microcode as a real .bin for a TL866 programmer.' },
];

// ── shared helpers ───────────────────────────────────────────────────────────
export function byteBits(value: number): number[] {
  const v = value & 0xff;
  return Array.from({ length: 8 }, (_, i) => (v >> (7 - i)) & 1);
}

export function hex(value: number): string {
  return '0x' + (value & 0xff).toString(16).toUpperCase().padStart(2, '0');
}

export function bitsToByte(bits: number[]): number {
  return bits.reduce((acc, b) => (acc << 1) | (b ? 1 : 0), 0) >>> 0;
}
