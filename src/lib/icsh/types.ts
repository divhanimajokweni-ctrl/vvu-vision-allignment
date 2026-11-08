// src/lib/icsh/types.ts — shared ICSH contracts (client-safe: no db import).
// Task 49 · the 4th state — contract on chain, the ledger as storage.

export interface IcshMilestone {
  cycle: number;
  clock: string;
  viewport: string;
  focus: string;
  head: string;
  vaultCount: number;
  memoryBytes: number; // always 32 — bounded working memory
}

export interface IcshRunStatLite {
  id: number;
  cycles: number;
  durationMs: number;
  cyclesPerSec: number;
  finalHead: string;
  agreementRate: number;
  peersReachable: number;
  runner: string;
  createdAt: string;
}

export interface IcshRunResult {
  ok: true;
  cycles: number;
  durationMs: number; // TOTAL measured: loop + persistence + anchor
  loopMs: number; // in-memory 11-beat loop only (engineering line)
  cyclesPerSec: number;
  headBefore: string;
  finalHead: string;
  vaultCountBefore: number;
  vaultCount: number;
  peersReachable: number;
  agreementRate: number; // 0..1 fraction of cycles with quorum
  quorumCycles: number;
  divergentTotal: number;
  perCycleMs: number; // measured per-cycle mean
  runner: string;
  wormSeq: number; // the ORBIT_HEAD_ANCHOR envelope seq
  milestones: IcshMilestone[];
}

export interface IcshStatus {
  head: string;
  headSource: 'CYCLE' | 'CONTRACT' | 'GENESIS';
  cycles: number;
  vaultNodes: number;
  wormEntries: number;
  icshWormEntries: number;
  peers: { total: number; reachable: number };
  nodes: { active: number; pending: number };
  runs: number;
  totalCyclesRun: number;
  measuredCyclesPerSec: number | null;
  lastRun: IcshRunStatLite | null;
  contract: { seq: number; hash: string; version: string; deployedAt: string } | null;
  lastCycle: {
    cycle: number;
    viewport: string;
    head: string;
    districtHead: string;
    agreement: boolean;
    divergentPeers: number;
    peersReachable: number;
    durationMs: number;
    at: string;
    sensors: IcshSensors | null;
    state: string;
  } | null;
  tier: string;
  trust: number | null;
  trustBasis: string;
  uptimeSec: number;
  dbBytes: number;
}

export interface IcshSensors {
  pressureBar: number;
  flowLps: number;
  ph: number;
  turbidityNtu: number;
  levelPct: number;
}

export interface IcshPeerRow {
  nodeId: string;
  endpoint: string;
  reachable: boolean;
  bucket: number;
  lastHead: string | null;
  simulatedHead: string; // what the sync beat computes this instant
  divergentNow: boolean;
}

export interface IcshNodeRow {
  id: string;
  callsign: string;
  farm: string;
  district: string;
  tier: string;
  trust: number;
  status: string;
  joinCode: string | null;
  joinedAt: string | null;
  cyclesAttributed: number;
}

export interface IcshCycleRow {
  seq: number;
  cycle: number;
  viewport: string;
  head: string;
  districtHead: string;
  vaultCount: number;
  peersReachable: number;
  agreement: boolean;
  divergentPeers: number;
  durationMs: number;
  at: string;
}

export interface IcshJoinSetup {
  ok: true;
  nodeId: string;
  callsign: string;
  secret: string; // EDGEGQ-XXXXXXXXXXXXXXXX
  otpauth: string;
  wormSeq: number; // ENROLMENT_OPEN event
}

export interface IcshJoinReceipt {
  ok: true;
  callsign: string;
  farm: string;
  district: string;
  joinCode: string; // E965B01E-style
  wormSeq: number;
  hash: string;
  nodeCount: number; // active nodes on chain after this join
  joinedAt: string;
  honesty: string[];
}

export interface IcshVerifyResult {
  ok: boolean;
  line: string; // "OK: 10000 cycles · head=eec6f437…" | "BREAK at cycle 1234 …"
  cycles: number;
  wormEntries: number;
  head: string | null;
  breakAtCycle: number | null;
  breakAtSeq: number | null;
  checkedAt: string;
}

export interface IcshMatrixRow {
  component: string;
  unitLabel: string;
  unitBytes: number | null; // measured mean bytes per unit
  per10kCycles: string; // measured-derived volume per 10,000 cycles
  perMonthFast: string; // @ 1 cycle / 5s (17,280/day)
  perMonthSlow: string; // @ 1 cycle / 30s (2,880/day)
  note: string;
}

// ─── Task 50 · SESSION LAB — multi-user concurrent 2FA PWA logins ────────────

export interface IcshPhoneTick {
  nodeId: string;
  callsign: string;
  farm: string;
  district: string;
  tier: string;
  trust: number;
  status: 'PENDING' | 'ACTIVE' | 'BLOCKED';
  joinCode: string | null;
  /** What Google Authenticator shows right now — computed server-side from
   *  the node's on-chain secret, so a REAL phone paired via the QR shows the
   *  SAME code as the simulated screen. */
  code: string;
  secondsRemaining: number; // 30 − (now/1000)%30
  activeSessions: number;
  sessionUntil: string | null; // nearest active session expiry (ISO)
}

export interface IcshSessionRow {
  id: string;
  code: string; // S-XXXXXX receipt-style session code
  nodeId: string;
  callsign: string;
  farm: string;
  district: string;
  tier: string;
  totpCode: string; // the 6-digit code that minted it
  drift: number; // −1 | 0 | +1 matched step
  wormSeq: number;
  mintedAt: string;
  expiresAt: string;
}

export interface IcshSessionTick {
  at: string;
  head: string; // WORM chain tip hash
  phones: IcshPhoneTick[];
  stats: {
    phones: number;
    pending: number;
    active: number;
    blocked: number;
    sessions: number;
    ttlMin: number;
  };
}

export type IcshLoginOutcome =
  | {
      ok: true;
      joined: boolean; // first login also committed the join on chain
      joinCode: string | null;
      session: IcshSessionRow;
      activeSessions: number; // node's live session count after the mint
      serverMs: number; // measured server-side (verify + WORM + persistence)
    }
  | { ok: false; error: string; status: number; serverMs: number };

export interface IcshSessionQr {
  ok: true;
  nodeId: string;
  callsign: string;
  secret: string;
  otpauth: string;
}

export interface IcshMetrics {
  measured: {
    cyclesPerSec: number | null;
    lastRunAt: string | null;
    avgLedgerLineBytes: number | null;
    avgVaultNodeBytes: number | null;
    dbBytes: number;
    totalCycles: number;
    totalVaultNodes: number;
    totalWormEntries: number;
    totalRuns: number;
    peersReachable: number;
    agreementRateAllTime: number | null;
    zarPerMonthFast: number | null; // data cost @ 1/5s cadence
    zarPerMonthSlow: number | null;
  };
  matrix: IcshMatrixRow[];
  cadences: { label: string; perDay: number; perMonth: number }[];
  assumptions: string[];
  honesty: string[];
}
