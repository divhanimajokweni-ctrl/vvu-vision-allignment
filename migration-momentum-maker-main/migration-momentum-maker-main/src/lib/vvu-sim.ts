// src/lib/vvu-sim.ts — in-app port of the estate's telemetry mini-service.
//
// The source deployment ran a standalone Bun + socket.io service on :3003.
// This is the same simulation — FSM physics (Appendix B.3), hydraulic /
// thermal telemetry (Joukowsky celerity invariant), the MRR / Trust-Gate
// 3A-3B-3C business sim, the WORM hash chain and the HOLOCOM cross-layer
// metrics — recreated as a client-safe module that emits events into the
// app instead of over a socket. Same 1.5s tick cadence.

import type {
  FsmState,
  FsmSymbol,
  FsmLogEntry,
  GateProgress,
  HoloFrame,
  HistoryBuffer,
  LeakState,
  NodeTelemetry,
  SimMetrics,
  SimSnapshot,
  TelemetryFrame,
  WormSimEvent,
} from "@/types/vvu";

// ─── Constants (source: mini-services/telemetry-service) ────────────────────

const TICK_MS = 1500;
const MONTH_TICKS = 40;
const MRR_TARGET = 50000;
const WORM_CHAIN_CAP = 500;
const HISTORY_CAP = 120;
const FSM_LOG_CAP = 50;

/** Genesis prevHash for the sim-side WORM chain (Appendix: 2026-09-01 boot). */
const GENESIS_PREV = "GENESIS-20260901-0000000000000000000000000000000000";

// ─── The 12 physical nodes (Appendix C.2 — ENU mm) ──────────────────────────

interface NodeDef {
  nodeId: string;
  name: string;
  role: string;
  xMm: number;
  yMm: number;
  zMm: number;
}

const NODE_DEFS: NodeDef[] = [
  {
    nodeId: "N01",
    name: "Telemetry Mast",
    role: "Antenna mast & edge-cloud telemetry",
    xMm: 0,
    yMm: 0,
    zMm: 1290,
  },
  {
    nodeId: "N02",
    name: "Inlet Meter Pod",
    role: "Primary inlet flow sensor",
    xMm: -750,
    yMm: -160,
    zMm: 930,
  },
  {
    nodeId: "N03",
    name: "Outlet Meter Pod",
    role: "Primary outlet flow sensor",
    xMm: 750,
    yMm: 160,
    zMm: 930,
  },
  {
    nodeId: "N04",
    name: "Pressure Pipe DN300",
    role: "Central structural pressure-retaining spool",
    xMm: 0,
    yMm: 0,
    zMm: 750,
  },
  {
    nodeId: "N05",
    name: "Edge Control Cabinet",
    role: "Sealed edge node; Bayesian inference",
    xMm: 0,
    yMm: 400,
    zMm: 400,
  },
  {
    nodeId: "N06",
    name: "Power Backup Module",
    role: "8S4P LiFePO₄ battery pack (HBK)",
    xMm: 0,
    yMm: -400,
    zMm: 400,
  },
  {
    nodeId: "N07",
    name: "Left Service Rack",
    role: "Cable management & lateral mounting",
    xMm: -720,
    yMm: -240,
    zMm: 290,
  },
  {
    nodeId: "N08",
    name: "Right Service Rack",
    role: "Cable management & lateral mounting",
    xMm: 720,
    yMm: 240,
    zMm: 290,
  },
  {
    nodeId: "N09",
    name: "North Datum Skid",
    role: "Heavy base support chassis",
    xMm: 0,
    yMm: 560,
    zMm: 40,
  },
  {
    nodeId: "N10",
    name: "South Datum Skid",
    role: "Heavy base support chassis",
    xMm: 0,
    yMm: -560,
    zMm: 40,
  },
  {
    nodeId: "N11",
    name: "Top Height Beacon",
    role: "Visual vertical reference",
    xMm: 100,
    yMm: 0,
    zMm: 1465,
  },
  {
    nodeId: "N12",
    name: "Pipe Spool DN100",
    role: "SANS 1299 service lateral",
    xMm: -375,
    yMm: -80,
    zMm: 840,
  },
];

/** Wetted hydraulic path — these nodes carry the shared pressure head & acoustic flag. */
const HYDRAULIC_NODES = new Set(["N02", "N03", "N04", "N12"]);
/** Leak nodes cycle in this order (each CLICK picks the next). */
const LEAK_CYCLE: readonly string[] = ["N04", "N12", "N02"];

// ─── FSM transition table (Appendix B.3 — enforced EXACTLY) ─────────────────

interface FsmEdge {
  to: FsmState;
  reason: string;
}

const FSM_TABLE: Record<FsmState, Partial<Record<FsmSymbol, FsmEdge>>> = {
  DISCONNECTED: {
    INIT: { to: "PAIRING_BLE", reason: "Establish BLE-SC via ECDH; init watchdog timer" },
  },
  PAIRING_BLE: {
    CHAL: {
      to: "TOTP_VERIFICATION",
      reason: "Request challenge signature; display random photo grid",
    },
  },
  TOTP_VERIFICATION: {
    TOTP_OK: {
      to: "STEADY_STATE_LOCKED",
      reason: "Grant access; load config; centre canvas at Gqeberha",
    },
    CRIT: { to: "DISCONNECTED", reason: "Purge ephemeral keys; reset hardware; log auth failure" },
  },
  STEADY_STATE_LOCKED: {
    CLICK: {
      to: "LEAK_ACTIVE",
      reason: "Fire raycaster; set pipe crimson; project 20m soil moisture overlay",
    },
    WARN: { to: "THERMAL_THROTTLE", reason: "Log thermal fact to WORM; reduce APU clock" },
  },
  LEAK_ACTIVE: {
    CLEAR: { to: "STEADY_STATE_LOCKED", reason: "Restore pipe colours; slow tank replenishment" },
    WARN: {
      to: "THERMAL_THROTTLE",
      reason: "Log thermal fact to WORM; reduce APU clock; decimate mesh 62.5%",
    },
    RESET: { to: "STEADY_STATE_LOCKED", reason: "Authorised human-in-the-loop audit recovery" },
  },
  THERMAL_THROTTLE: {
    RESET: {
      to: "STEADY_STATE_LOCKED",
      reason: "De-escalate throttling after temp < 60°C (5°C hysteresis)",
    },
    CRIT: {
      to: "FAIL_CLOSED",
      reason: "Flush RAM evidence to NVMe; battery disconnect within 500ms",
    },
  },
  FAIL_CLOSED: {
    RESET: {
      to: "STEADY_STATE_LOCKED",
      reason: "SHA-256 hash checks across 19 master assets; re-open circuit breakers",
    },
  },
};

const FSM_SYMBOLS: readonly string[] = [
  "INIT",
  "CHAL",
  "TOTP_OK",
  "CLICK",
  "CLEAR",
  "WARN",
  "CRIT",
  "RESET",
];

// ─── Small helpers ──────────────────────────────────────────────────────────

const round = (v: number, dp = 2): number => Math.round(v * 10 ** dp) / 10 ** dp;

/**
 * Synchronous SHA-256 (browser-safe; Web Crypto's digest is async and the
 * WORM chain links hashes synchronously). Standard public-domain variant.
 */
function sha256(input: string): string {
  // fold UTF-8 to a byte-string so the loop below sees charCodes ≤ 255
  let ascii = unescape(encodeURIComponent(input));
  const rightRotate = (a: number[], amount: number): number[] => {
    const n = amount % a.length;
    return a.slice(a.length - n).concat(a.slice(0, a.length - n));
  };

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = "";
  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;
  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: Record<number, number> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  ascii += "\x80";
  while ((ascii.length % 4) - 1) ascii += "\x00";
  for (let i = 0; i < ascii.length; i++) {
    const j = ascii.charCodeAt(i);
    if (j > 255) {
      // multi-byte characters fold — chain inputs stay ASCII in practice
      throw new Error("vvu-sim sha256 input must be ASCII");
    }
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[ascii.length >> 2] |= 0x80 << (((3 - ascii.length) % 4) * 8);
  words[((ascii.length >> 2) + 1) & ~0x0f] = asciiBitLength;

  const w = new Array<number>(64).fill(0);
  for (let j = 0; j < words.length;) {
    const wStart = j;
    for (let i = 0; i < 16; i++, j++) w[i] = words[j] | 0;
    for (let i = 16; i < 64; i++) {
      const w15 = w[i - 15];
      const s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
      const w2 = w[i - 2];
      const s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
      w[i] = ((s0 | 0) + (s1 | 0) + w[i - 7] + w[i - 16]) | 0 | 0;
    }

    let a = hash[0],
      b = hash[1],
      c = hash[2],
      d = hash[3],
      e = hash[4],
      f = hash[5],
      g = hash[6],
      h = hash[7];
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + k[i] + w[i]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }
    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
    j = wStart + 16;
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 3; j >= 0; j--) {
      result += ((hash[i] >> (j * 8)) & 255).toString(16).padStart(2, "0");
    }
  }
  return result;
}

// ─── Event plumbing (replaces socket.io) ────────────────────────────────────

export type VvuSimEvent =
  | { type: "snapshot"; snap: SimSnapshot }
  | { type: "telemetry"; frame: TelemetryFrame }
  | { type: "history"; history: HistoryBuffer }
  | { type: "worm"; evt: WormSimEvent }
  | { type: "fsm"; entry: FsmLogEntry }
  | { type: "fsm-error"; message: string }
  | { type: "holo"; frame: HoloFrame }
  | { type: "env-weather"; weather: EnvWeather };

import type { EnvWeather } from "@/types/vvu";

type VvuListener = (e: VvuSimEvent) => void;
const listeners = new Set<VvuListener>();

function broadcast(e: VvuSimEvent): void {
  for (const l of listeners) l(e);
}

export function onVvuEvent(listener: VvuListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ─── Sim state ──────────────────────────────────────────────────────────────

const sim = {
  fsmState: "STEADY_STATE_LOCKED" as FsmState,
  fsmLog: [] as FsmLogEntry[],

  leak: { active: false, nodeId: null as string | null, intensity: 0 } as LeakState,
  leakClearing: false,
  leakCycleIdx: 0,

  inletFlow: 42.5,
  outletFlow: 42.5,
  pressureHead: 58,
  acoustic: false,

  apuTemp: 51,

  celerity: 688,
  invariantOk: true,
  invariantHoldTick: -1,

  tick: 0,
  ticksIntoMonth: 0,
  metrics: {
    customers: 1,
    mrr: 5000,
    mrrTarget: MRR_TARGET,
    consecutiveMonthsAt50k: 0,
    nodesSteady: 3,
    steadyStateHours: 66.2,
    steadyFrozen: false,
    simMonth: 1,
    simDay: 0,
    speedMultiplier: 1,
    pipeline: { emails: 0, demos: 0, pilots: 0 },
  } as SimMetrics,

  history: {
    ts: [] as number[],
    flow: [] as number[],
    pressure: [] as number[],
    temp: [] as number[],
    mrr: [] as number[],
  },

  frame: null as TelemetryFrame | null,
};

// ─── WORM hash chain ────────────────────────────────────────────────────────

const wormChain: WormSimEvent[] = [];
let wormSeq = 1;

function appendWorm(source: string, event: string, details: string): WormSimEvent {
  const seq = wormSeq++;
  const ts = Date.now();
  const tsISO = new Date(ts).toISOString();
  const prevHash = wormChain.length > 0 ? wormChain[wormChain.length - 1].hash : GENESIS_PREV;
  const hash = sha256(`${prevHash}|${seq}|${source}|${event}|${details}|${tsISO}`);
  const evt: WormSimEvent = { seq, ts, source, event, details, hash, prevHash };
  wormChain.push(evt);
  if (wormChain.length > WORM_CHAIN_CAP) wormChain.splice(0, wormChain.length - WORM_CHAIN_CAP);
  broadcast({ type: "worm", evt });
  return evt;
}

// ─── FSM engine ─────────────────────────────────────────────────────────────

function startLeak(): void {
  const nodeId = LEAK_CYCLE[sim.leakCycleIdx % LEAK_CYCLE.length];
  sim.leakCycleIdx++;
  sim.leak = { active: true, nodeId, intensity: 0 };
  sim.leakClearing = false;
}

function hardClearLeak(reason: string): void {
  sim.leak = { active: false, nodeId: null, intensity: 0 };
  sim.leakClearing = false;
}

function doTransition(from: FsmState, to: FsmState, symbol: FsmSymbol, reason: string): void {
  sim.fsmState = to;

  if (to === "LEAK_ACTIVE") {
    startLeak();
  } else if (to === "FAIL_CLOSED") {
    hardClearLeak("FAIL_CLOSED safety cutoff (battery disconnect within 500ms)");
  }
  if (from === "LEAK_ACTIVE" && (symbol === "CLEAR" || symbol === "RESET")) {
    sim.leakClearing = true;
  }

  const entry: FsmLogEntry = { ts: Date.now(), from, to, symbol, reason };
  sim.fsmLog.push(entry);
  if (sim.fsmLog.length > FSM_LOG_CAP) sim.fsmLog.splice(0, sim.fsmLog.length - FSM_LOG_CAP);

  appendWorm("FSM", `FSM_${symbol}_${to}`, reason);
  broadcast({ type: "fsm", entry });
}

function handleCommand(symbolRaw: unknown): void {
  const symbol = String(symbolRaw ?? "");
  if (!FSM_SYMBOLS.includes(symbol)) {
    broadcast({ type: "fsm-error", message: `ILLEGAL δ: ${symbol} in ${sim.fsmState}` });
    return;
  }
  const edge = FSM_TABLE[sim.fsmState][symbol as FsmSymbol];
  if (!edge) {
    broadcast({ type: "fsm-error", message: `ILLEGAL δ: ${symbol} in ${sim.fsmState}` });
    return;
  }
  doTransition(sim.fsmState, edge.to, symbol as FsmSymbol, edge.reason);
}

/** Thermal guards — run AFTER the APU temperature is computed each tick. */
function runThermalGuards(): void {
  const t = sim.apuTemp;
  if (t >= 85) {
    if (sim.fsmState === "FAIL_CLOSED") return;
    const crit = FSM_TABLE[sim.fsmState].CRIT;
    if (crit) {
      doTransition(sim.fsmState, crit.to, "CRIT", `THERMAL GUARD ≥85°C · ${crit.reason}`);
    } else {
      doTransition(
        sim.fsmState,
        "FAIL_CLOSED",
        "CRIT",
        "System temperatures exceeded critical limits",
      );
    }
    return;
  }
  if (t >= 65 && (sim.fsmState === "STEADY_STATE_LOCKED" || sim.fsmState === "LEAK_ACTIVE")) {
    const warn = FSM_TABLE[sim.fsmState].WARN!;
    doTransition(sim.fsmState, warn.to, "WARN", `THERMAL GUARD ≥65°C · ${warn.reason}`);
    return;
  }
  if (sim.fsmState === "THERMAL_THROTTLE" && t < 60) {
    const reset = FSM_TABLE.THERMAL_THROTTLE.RESET!;
    doTransition("THERMAL_THROTTLE", reset.to, "RESET", `AUTO · ${reset.reason}`);
  }
}

// ─── Tick physics ───────────────────────────────────────────────────────────

function advanceLeak(): void {
  if (!sim.leak.active) return;
  if (sim.leakClearing) {
    sim.leak.intensity -= 0.1;
    if (sim.leak.intensity < 0.05) hardClearLeak("ease-out complete (intensity < 0.05)");
  } else if (sim.leak.intensity < 1) {
    sim.leak.intensity = Math.min(1, sim.leak.intensity + 1 / 6);
  }
}

function advanceHydraulics(): void {
  const inletFlow = 42.5 + (Math.random() - 0.5) * 2.4;
  const intensity = sim.leak.active ? sim.leak.intensity : 0;
  const draw = sim.leak.active ? (8 + 6 * intensity) * intensity : 0;
  sim.inletFlow = inletFlow;
  sim.outletFlow = inletFlow - draw;
  sim.pressureHead = 58 + (Math.random() - 0.5) * 1.6 - (sim.leak.active ? 4.5 * intensity : 0);
  sim.acoustic = sim.leak.active && sim.leak.intensity > 0.25 && Math.random() > 0.02;

  const c = Math.round(
    Math.sqrt(
      Math.max(1, sim.pressureHead) * 9.81 * 1480 * (0.35 + Math.min(0.4, inletFlow / 200)),
    ),
  );
  sim.celerity = c;
  if (c < 200 || c > 1400) {
    sim.invariantOk = false;
    sim.invariantHoldTick = sim.tick + 1;
  } else if (sim.tick >= sim.invariantHoldTick) {
    sim.invariantOk = true;
  }
}

function advanceThermal(): void {
  const baseline = 51 + 3 * Math.sin(sim.tick / 40) + (Math.random() - 0.5) * 1.2;
  const leakDrawing = sim.leak.active && sim.leak.intensity > 0.05;
  const throttled = sim.fsmState === "THERMAL_THROTTLE";

  if (leakDrawing) sim.apuTemp += 4.5 * sim.leak.intensity;
  if (throttled) {
    sim.apuTemp = Math.max(baseline + 6, sim.apuTemp - 1.5);
  } else if (!leakDrawing) {
    sim.apuTemp = Math.max(baseline, sim.apuTemp - 0.4);
  }
  if (sim.apuTemp < baseline) sim.apuTemp = baseline;
}

function advanceBusiness(): void {
  const m = sim.metrics;
  const speed = m.speedMultiplier;

  if (sim.fsmState !== "FAIL_CLOSED") {
    if (m.customers < 10 && Math.random() < 0.012 * speed) m.customers++;
  }
  m.pipeline.emails += Math.round(Math.random() * 2 * speed);
  if (Math.random() < Math.min(1, 0.05 * speed)) m.pipeline.demos++;
  if (m.customers < 10 && Math.random() < Math.min(1, 0.008 * speed)) m.pipeline.pilots++;
  m.mrr = m.customers * 5000;

  sim.ticksIntoMonth++;
  if (sim.ticksIntoMonth >= MONTH_TICKS) {
    sim.ticksIntoMonth = 0;
    m.simMonth++;
    if (m.mrr >= MRR_TARGET) m.consecutiveMonthsAt50k++;
    else m.consecutiveMonthsAt50k = 0;
    appendWorm(
      "SYSTEM",
      "SIM_MONTH_ROLL",
      `month ${m.simMonth - 1} closed · MRR R${m.mrr.toLocaleString("en-ZA")} · streak ${m.consecutiveMonthsAt50k} month(s) at R50k`,
    );
  }
  m.simDay = Math.floor(sim.ticksIntoMonth / (MONTH_TICKS / 30));
}

// ─── Environment weather (the estate's weather node) ────────────────────────

/** WMO code pool cycled with a random walk — Gqeberha coastal profile. */
const WEATHER_CODES: readonly number[] = [0, 1, 2, 3, 45, 51, 61, 63, 80, 81, 95];
const weather = {
  idx: 1,
  tempC: 21.4,
  windKmh: 14,
  humidityPct: 64,
};

const WMO_TO_CONDITION: Record<number, string> = {
  0: "clear",
  1: "clear",
  2: "partly cloudy",
  3: "overcast",
  45: "fog",
  51: "drizzle",
  61: "rain",
  63: "rain",
  80: "showers",
  81: "showers",
  95: "thunderstorm",
};
const WMO_TO_PRECIP: Record<number, number> = {
  0: 0,
  1: 0,
  2: 0,
  3: 0,
  45: 0,
  51: 0.2,
  61: 1.1,
  63: 2.8,
  80: 1.6,
  81: 2.2,
  95: 4.5,
};
const WMO_TO_CLOUD: Record<number, number> = {
  0: 8,
  1: 18,
  2: 42,
  3: 88,
  45: 96,
  51: 70,
  61: 82,
  63: 90,
  80: 78,
  81: 84,
  95: 95,
};

function buildEnvWeather(): EnvWeather {
  if (Math.random() < 0.04) weather.idx = Math.floor(Math.random() * WEATHER_CODES.length);
  const code = WEATHER_CODES[weather.idx];
  weather.tempC = round(Math.max(14, Math.min(30, weather.tempC + (Math.random() - 0.5) * 0.6)), 1);
  weather.windKmh = round(
    Math.max(2, Math.min(45, weather.windKmh + (Math.random() - 0.5) * 2.5)),
    1,
  );
  weather.humidityPct = Math.round(
    Math.max(35, Math.min(95, weather.humidityPct + (Math.random() - 0.5) * 3)),
  );
  return {
    code,
    condition: WMO_TO_CONDITION[code] ?? "clear",
    precipMm: WMO_TO_PRECIP[code] ?? 0,
    cloudCoverPct: WMO_TO_CLOUD[code] ?? 20,
    tempC: weather.tempC,
    windKmh: weather.windKmh,
    humidityPct: weather.humidityPct,
    stale: false,
    observedAt: new Date().toISOString(),
  };
}

// ─── Frame / snapshot builders ──────────────────────────────────────────────

function nodesSteadyNow(): number {
  return sim.fsmState === "STEADY_STATE_LOCKED" ? 3 : 0;
}

function buildFrame(): TelemetryFrame {
  const m = sim.metrics;
  m.nodesSteady = nodesSteadyNow();

  const nodes: NodeTelemetry[] = NODE_DEFS.map((n) => {
    const hydraulic = HYDRAULIC_NODES.has(n.nodeId);
    const flowRate =
      n.nodeId === "N02"
        ? round(sim.inletFlow)
        : n.nodeId === "N03"
          ? round(sim.outletFlow)
          : round((Math.random() - 0.5) * 0.1); // idle nodes: tiny noise
    const pressureHead = hydraulic ? round(sim.pressureHead) : round((Math.random() - 0.5) * 0.1);
    const acousticAbnormal = hydraulic ? sim.acoustic : false;
    const apuTemperature =
      n.nodeId === "N05" ? round(sim.apuTemp) : round(34 + (Math.random() - 0.5) * 4);
    return {
      nodeId: n.nodeId,
      name: n.name,
      role: n.role,
      xMm: n.xMm,
      yMm: n.yMm,
      zMm: n.zMm,
      flowRate,
      pressureHead,
      acousticAbnormal,
      apuTemperature,
    };
  });

  return {
    ts: Date.now(),
    fsmState: sim.fsmState,
    nodes,
    leak: {
      active: sim.leak.active,
      nodeId: sim.leak.nodeId,
      intensity: round(sim.leak.intensity, 3),
    },
    metrics: { ...m, pipeline: { ...m.pipeline } },
    thermalThrottled: sim.fsmState === "THERMAL_THROTTLE",
    estimatedCelerity: sim.celerity,
    invariantOk: sim.invariantOk,
  };
}

function pushHistory(): void {
  const h = sim.history;
  h.ts.push(sim.frame!.ts);
  h.flow.push(round(sim.inletFlow));
  h.pressure.push(round(sim.pressureHead));
  h.temp.push(round(sim.apuTemp));
  h.mrr.push(sim.metrics.mrr);
  if (h.ts.length > HISTORY_CAP) {
    h.ts.shift();
    h.flow.shift();
    h.pressure.shift();
    h.temp.shift();
    h.mrr.shift();
  }
}

function historyCopy(): HistoryBuffer {
  const h = sim.history;
  return {
    ts: [...h.ts],
    flow: [...h.flow],
    pressure: [...h.pressure],
    temp: [...h.temp],
    mrr: [...h.mrr],
  };
}

function computeGates(): GateProgress[] {
  const m = sim.metrics;
  const steady = nodesSteadyNow();
  return [
    {
      id: "3A",
      conditionsMet: m.customers >= 1,
      progress: [{ label: "Pilot customers", current: m.customers, target: 1, unit: "customers" }],
    },
    {
      id: "3B",
      conditionsMet: m.mrr >= MRR_TARGET && m.consecutiveMonthsAt50k >= 2,
      progress: [
        { label: "MRR", current: m.mrr, target: MRR_TARGET, unit: "R" },
        {
          label: "Consecutive months at R50k",
          current: m.consecutiveMonthsAt50k,
          target: 2,
          unit: "months",
        },
      ],
    },
    {
      id: "3C",
      conditionsMet: steady >= 3 && m.steadyStateHours >= 72,
      progress: [
        { label: "Steady nodes", current: steady, target: 3, unit: "nodes" },
        {
          label: "Steady-state hours",
          current: round(Math.min(m.steadyStateHours, 72), 1),
          target: 72,
          unit: "h",
        },
      ],
    },
  ];
}

function buildSnapshot(): SimSnapshot {
  return {
    frame: sim.frame!,
    history: historyCopy(),
    wormChain: wormChain.slice(-30),
    fsmLog: sim.fsmLog.slice(-20),
    gateProgress: computeGates(),
  };
}

// ─── HOLOCOM channel + cross-layer metrics sim ──────────────────────────────

const HOLO_MTP_FIXED_MS = 1.2 + 3.0 + 2.0 + 3.5 + 1.8 + 2.2 + 1.0; // 14.7
const HOLO_MTP_TARGET_MS = 20;

const holo = {
  tick: 0,
  stressLevel: 0,
  lastBreach: false,
  uplinkMs: 2.1,
  downlinkMs: 2.3,
  jitterMs: 0.5,
  lossPct: 0.3,
  stallMs: 0,
  uplinkGbps: 2.1,
  downlinkGbps: 1.9,
  meshPolysM: 2.4,
  renderFps: 90,
  edgeGpu: 0.52,
  edgeCpu: 0.41,
};

function walk(current: number, base: number, amplitude: number, lo: number): number {
  const noise = (Math.random() - 0.5) * 2 * amplitude;
  const revert = (base - current) * 0.25;
  return Math.max(lo, current + noise + revert);
}

function holoStressProfile(level: number): {
  legMs: number;
  loss: number;
  jitter: number;
  stall: number;
  bw: number;
} {
  return [
    { legMs: 0, loss: 0, jitter: 0, stall: 0, bw: 1 },
    { legMs: 1.6, loss: 2.0, jitter: 1.2, stall: 25, bw: 0.85 },
    { legMs: 3.6, loss: 5.5, jitter: 2.6, stall: 90, bw: 0.6 },
    { legMs: 7.5, loss: 11.0, jitter: 4.5, stall: 260, bw: 0.38 },
  ][Math.max(0, Math.min(3, level))];
}

function buildHoloFrame(): HoloFrame {
  const p = holoStressProfile(holo.stressLevel);
  holo.uplinkMs = walk(holo.uplinkMs, 2.1 + p.legMs, 0.3, 0.8);
  holo.downlinkMs = walk(holo.downlinkMs, 2.3 + p.legMs, 0.32, 0.9);
  holo.jitterMs = walk(holo.jitterMs, 0.5 + p.jitter, 0.18, 0.05);
  holo.lossPct = walk(holo.lossPct, 0.3 + p.loss, 0.12, 0.02);
  holo.stallMs = walk(holo.stallMs, p.stall, p.stall > 0 ? p.stall * 0.2 : 2, 0);
  holo.uplinkGbps = walk(holo.uplinkGbps, 2.1 * p.bw, 0.14, 0.4);
  holo.downlinkGbps = walk(holo.downlinkGbps, 1.9 * p.bw, 0.12, 0.3);
  holo.meshPolysM = walk(holo.meshPolysM, 2.4, 0.1, 1.5);
  holo.renderFps = Math.max(
    24,
    Math.round(walk(holo.renderFps, 90 - holo.stressLevel * 18, 2, 20)),
  );
  holo.edgeGpu = walk(holo.edgeGpu, 0.52 + holo.stressLevel * 0.06, 0.03, 0.1);
  holo.edgeCpu = walk(holo.edgeCpu, 0.41, 0.025, 0.1);

  const mtpTotal = HOLO_MTP_FIXED_MS + round(holo.uplinkMs + holo.downlinkMs, 2);
  const breach = mtpTotal > HOLO_MTP_TARGET_MS;

  if (breach !== holo.lastBreach) {
    holo.lastBreach = breach;
    appendWorm(
      "HOLOCOM",
      breach ? "HOLO_MTP_BREACH" : "HOLO_MTP_RECOVERED",
      breach
        ? `MTP ${round(mtpTotal, 2)}ms > ${HOLO_MTP_TARGET_MS}ms 6G target · UL ${round(holo.uplinkMs, 2)}ms · DL ${round(holo.downlinkMs, 2)}ms · stress L${holo.stressLevel}`
        : `MTP recovered to ${round(mtpTotal, 2)}ms (≤ ${HOLO_MTP_TARGET_MS}ms target) · stress L${holo.stressLevel}`,
    );
  }

  return {
    ts: Date.now(),
    tick: ++holo.tick,
    app: {
      meshPolysM: round(holo.meshPolysM, 2),
      textureResK: 8,
      meshBitrateGbps: round(3.6 * (holo.meshPolysM / 2.4), 2),
      audioBitrateKbps: 256,
      virtualCameras: 4,
      renderFps: holo.renderFps,
      avgDecodeMs: round(1.8 + holo.stressLevel * 0.4, 2),
    },
    computing: {
      clientCpu: round(walk(0.35, 0.35, 0.02, 0.1), 3),
      clientGpu: round(walk(0.24, 0.24, 0.015, 0.05), 3),
      edgeCpu: round(holo.edgeCpu, 3),
      edgeGpu: round(holo.edgeGpu, 3),
      edgeMem: round(walk(0.45, 0.45, 0.02, 0.1), 3),
      centralGpu: round(walk(0.3, 0.3, 0.02, 0.05), 3),
    },
    network: {
      uplinkMs: round(holo.uplinkMs, 2),
      downlinkMs: round(holo.downlinkMs, 2),
      uplinkGbps: round(holo.uplinkGbps, 2),
      downlinkGbps: round(holo.downlinkGbps, 2),
      jitterMs: round(holo.jitterMs, 2),
      lossPct: round(holo.lossPct, 2),
      stallMs: round(holo.stallMs, 1),
    },
    mtpTotalMs: round(mtpTotal, 2),
    mtpBreach: breach,
    stressLevel: holo.stressLevel,
  };
}

// ─── The tick (1500ms) ──────────────────────────────────────────────────────

function tick(): void {
  sim.tick++;

  advanceBusiness();
  advanceLeak();
  advanceHydraulics();
  advanceThermal();
  runThermalGuards();

  if (sim.fsmState === "STEADY_STATE_LOCKED" && !sim.metrics.steadyFrozen) {
    const next = sim.metrics.steadyStateHours + 0.15 * sim.metrics.speedMultiplier;
    if (next >= 71.9 && sim.metrics.steadyStateHours < 72) {
      sim.metrics.steadyStateHours = 71.9;
      sim.metrics.steadyFrozen = true;
      appendWorm(
        "SYSTEM",
        "STEADY_HOLD",
        "Steady accrual hold @ 71.9h — Gate 3C maturity requires explicit SIM SKIP 3C (demo narrative control)",
      );
    } else {
      sim.metrics.steadyStateHours = round(next, 3);
    }
  }

  sim.frame = buildFrame();
  pushHistory();

  broadcast({ type: "telemetry", frame: sim.frame });
  if (sim.tick % 10 === 0) broadcast({ type: "history", history: historyCopy() });
  if (sim.tick % 2 === 0) broadcast({ type: "holo", frame: buildHoloFrame() });
  if (sim.tick % 4 === 0) broadcast({ type: "env-weather", weather: buildEnvWeather() });
}

// ─── Boot + client command surface (replaces socket.emit handlers) ─────────

let started = false;
let tickTimer: ReturnType<typeof setInterval> | null = null;

/** Start the simulation exactly once per page lifetime. */
export function startVvuSim(): void {
  if (started) return;
  started = true;

  sim.frame = buildFrame();

  appendWorm("SYSTEM", "SYSTEM_BOOT", "Gqeberha edge node online · in-app feed (Lovable)");
  appendWorm("SYSTEM", "TENANT_RLS_SCOPE", "vvu.current_tenant_id scoped · RLS isolation active");
  appendWorm(
    "FSM",
    "FSM_BOOT_STEADY_STATE",
    "Nodes pre-provisioned · STEADY_STATE_LOCKED · steady 66.2h",
  );
  appendWorm("GATE", "GATE_3A_EVIDENCE", "R5k pilot invoice verified · WORM invoice + POP bound");
  appendWorm(
    "TELEMETRY",
    "TELEMETRY_WORM_BIND",
    "ingestEdgeTelemetry cadence 1.5s · celerity bounds [200,1400] m/s",
  );

  broadcast({ type: "snapshot", snap: buildSnapshot() });
  broadcast({ type: "env-weather", weather: buildEnvWeather() });
  tickTimer = setInterval(tick, TICK_MS);
}

export function sendVvuCommand(cmd: FsmSymbol): void {
  handleCommand(cmd);
}

export function sendVvuWormLog(event: string, source: string, details: string): void {
  const e = String(event ?? "")
    .trim()
    .slice(0, 80);
  if (!e) return;
  const s =
    String(source ?? "")
      .trim()
      .slice(0, 40) || "OPERATOR";
  const d = String(details ?? "").slice(0, 400);
  appendWorm(s, e, d);
}

export function setVvuSimSpeed(multiplier: number): void {
  const raw = Number(multiplier);
  if (!Number.isFinite(raw)) return;
  const clamped = Math.min(20, Math.max(1, round(raw, 2)));
  if (clamped === sim.metrics.speedMultiplier) return;
  const old = sim.metrics.speedMultiplier;
  sim.metrics.speedMultiplier = clamped;
  appendWorm("SYSTEM", "SIM_SPEED", `sim speed multiplier ${old}× → ${clamped}×`);
  if (sim.frame) broadcast({ type: "telemetry", frame: buildFrame() });
}

export function requestVvuSnapshot(): void {
  broadcast({ type: "snapshot", snap: buildSnapshot() });
}

export function vvuSimSkip(gate: "3A" | "3B" | "3C" | "RESET_DEMO"): void {
  const g = String(gate ?? "")
    .trim()
    .toUpperCase();
  if (!["3A", "3B", "3C", "RESET_DEMO"].includes(g)) {
    broadcast({
      type: "fsm-error",
      message: `SIM-SKIP: unknown gate "${g}" (3A · 3B · 3C · RESET_DEMO)`,
    });
    return;
  }
  const m = sim.metrics;
  let details = "";

  if (g === "3A") {
    m.customers = Math.max(1, m.customers);
    m.mrr = m.customers * 5000;
    details = `Gate 3A fast path · customers ${m.customers} · MRR R${m.mrr.toLocaleString("en-ZA")}`;
  } else if (g === "3B") {
    m.customers = 10;
    m.mrr = MRR_TARGET;
    m.consecutiveMonthsAt50k = Math.max(2, m.consecutiveMonthsAt50k);
    details = `Gate 3B fast path · customers 10 · MRR R${m.mrr.toLocaleString("en-ZA")} · streak ${m.consecutiveMonthsAt50k} month(s)`;
  } else if (g === "3C") {
    if (sim.fsmState !== "STEADY_STATE_LOCKED") {
      const edge = FSM_TABLE[sim.fsmState].RESET;
      doTransition(
        sim.fsmState,
        "STEADY_STATE_LOCKED",
        "RESET",
        `SIM SKIP 3C normalisation · ${edge ? edge.reason : "demo state reset"}`,
      );
      hardClearLeak("SIM SKIP 3C normalisation");
      sim.leakClearing = false;
    }
    m.steadyStateHours = Math.max(72, m.steadyStateHours);
    m.steadyFrozen = false;
    details = `Gate 3C fast path · steady nodes 3 · ${m.steadyStateHours.toFixed(1)}h (≥72h met)`;
  } else {
    if (sim.fsmState !== "STEADY_STATE_LOCKED") {
      doTransition(
        sim.fsmState,
        "STEADY_STATE_LOCKED",
        "RESET",
        "SIM RESET_DEMO · fresh demo state",
      );
    }
    hardClearLeak("SIM RESET_DEMO");
    sim.leakClearing = false;
    sim.apuTemp = 51;
    sim.inletFlow = 42.5;
    sim.outletFlow = 42.5;
    sim.pressureHead = 58;
    sim.acoustic = false;
    Object.assign(m, {
      customers: 1,
      mrr: 5000,
      consecutiveMonthsAt50k: 0,
      nodesSteady: 3,
      steadyStateHours: 66.2,
      steadyFrozen: false,
      simMonth: 1,
      simDay: 0,
      speedMultiplier: 1,
    });
    sim.ticksIntoMonth = 0;
    details =
      "demo state reset · 1 customer · MRR R5k · 66.2h steady · ×1 speed · STEADY_STATE_LOCKED";
  }

  appendWorm("DEMO_CTRL", "SIM_SKIP", details);
  sim.frame = buildFrame();
  broadcast({ type: "telemetry", frame: sim.frame });
  broadcast({ type: "snapshot", snap: buildSnapshot() });
}

export function sendVvuHoloStress(level: number): void {
  const raw = Number(level);
  if (!Number.isFinite(raw)) return;
  const lvl = Math.max(0, Math.min(3, Math.round(raw)));
  if (lvl === holo.stressLevel) return;
  const old = holo.stressLevel;
  holo.stressLevel = lvl;
  const names = ["NOMINAL", "LIGHT", "HEAVY", "SEVERE"];
  appendWorm(
    "HOLOCOM",
    "HOLO_CHANNEL_STRESS",
    `channel stress L${old} ${names[Math.min(3, old)]} → L${lvl} ${names[lvl]} · radio shadow + interference walk injected`,
  );
  broadcast({ type: "holo", frame: buildHoloFrame() });
}

/** Live gate progress (the source service exposed this on GET /state). */
export function getVvuGateProgress(): GateProgress[] {
  return computeGates();
}
