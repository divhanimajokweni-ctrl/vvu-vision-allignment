// src/types/vvu.ts — VVU shared type contracts.
// Single source of truth shared by: Next.js frontend, API routes,
// and the telemetry mini-service (mini-services/telemetry-service).
// The mini-service re-declares these in its own index.ts (independent project).

// ─── FSM ────────────────────────────────────────────────────────────────────

export type FsmState =
  | "DISCONNECTED"
  | "PAIRING_BLE"
  | "TOTP_VERIFICATION"
  | "STEADY_STATE_LOCKED"
  | "LEAK_ACTIVE"
  | "THERMAL_THROTTLE"
  | "FAIL_CLOSED";

export type FsmSymbol = "INIT" | "CHAL" | "TOTP_OK" | "CLICK" | "CLEAR" | "WARN" | "CRIT" | "RESET";

export interface FsmLogEntry {
  ts: number;
  from: FsmState;
  to: FsmState;
  symbol: FsmSymbol;
  reason: string;
}

// ─── Nodes & telemetry ──────────────────────────────────────────────────────

export interface NodeTelemetry {
  nodeId: string;
  name: string;
  role: string;
  /** ENU coordinates in millimetres (Appendix C.2) */
  xMm: number;
  yMm: number;
  zMm: number;
  flowRate: number; // L/s
  pressureHead: number; // m
  acousticAbnormal: boolean;
  apuTemperature: number; // °C
}

export interface HistoryBuffer {
  ts: number[];
  flow: number[]; // inlet L/s
  pressure: number[]; // m
  temp: number[]; // °C
  mrr: number[]; // Rand
}

export interface SimMetrics {
  customers: number;
  mrr: number;
  mrrTarget: number;
  consecutiveMonthsAt50k: number;
  nodesSteady: number;
  steadyStateHours: number;
  /** Task 7-a — telemetry service demo hold: accrual clamped at 71.9h until SIM SKIP 3C. */
  steadyFrozen?: boolean;
  simMonth: number;
  simDay: number;
  speedMultiplier: number;
  pipeline: { emails: number; demos: number; pilots: number };
}

export interface LeakState {
  active: boolean;
  nodeId: string | null;
  intensity: number; // 0..1
}

export interface GateProgress {
  id: "3A" | "3B" | "3C";
  /** true when the simulated business conditions for certification are met */
  conditionsMet: boolean;
  progress: Array<{ label: string; current: number; target: number; unit: string }>;
}

export interface WormSimEvent {
  seq: number;
  ts: number;
  source: string;
  event: string;
  details: string;
  hash: string;
  prevHash: string;
}

// Full broadcast frame (every ~1.5s)
export interface TelemetryFrame {
  ts: number;
  fsmState: FsmState;
  nodes: NodeTelemetry[];
  leak: LeakState;
  metrics: SimMetrics;
  thermalThrottled: boolean;
  estimatedCelerity: number;
  invariantOk: boolean;
}

export interface SimSnapshot {
  frame: TelemetryFrame;
  history: HistoryBuffer;
  wormChain: WormSimEvent[];
  fsmLog: FsmLogEntry[];
  gateProgress: GateProgress[];
}

// ─── Client → server socket commands ────────────────────────────────────────

export type FsmCommand = FsmSymbol;

export interface WormLogCommand {
  event: string;
  source: string;
  details: string;
}

// ─── API contracts (Next.js routes) ─────────────────────────────────────────

export interface GateRecord {
  gateId: "3A" | "3B" | "3C";
  title: string;
  requirement: string;
  certification: string;
  beneficiary: string;
  shares: number;
  status: "PENDING" | "CERTIFIED";
  certifiedAt: string | null;
  certHash: string | null;
}

export interface VotingLedger {
  founderVotesA: number; // Class A votes (90,900 × 20)
  founderSweatB: number; // Class B shares from Gate 3A
  trustB: number; // Class B shares from Gates 3B + 3C
  publicB: number; // pre-IPO public Class B
  founderAlignedVotes: number;
  totalVotes: number;
  pct: number; // founder-aligned weighted voting %
  terminalPct: number; // 70.66
  dilutionFloor: number; // 55 (Article 5.3.3)
  jseFreeFloat: number; // 20
}

export interface AnalyticsSummary {
  gates: GateRecord[];
  voting: VotingLedger;
  worm: { count: number; chainValid: boolean; lastHash: string | null };
  telemetryCount: number;
  auditCount: number;
  steadyNodes: number;
}

export interface LedgerEntry {
  id: string;
  seq: number;
  source: string;
  event: string;
  details: string | null;
  prevHash: string;
  hash: string;
  createdAt: string;
}

// ─── Task 14-a — PILOT OUTREACH engine (API contracts) ──────────────────────

/** consentBasis enum — NONE refuses every send (POPIA s69). */
export type ConsentBasis = "OPT_IN" | "EXISTING_CUSTOMER" | "NONE";

export interface OutreachTarget {
  id: string;
  tenantId: string;
  org: string;
  contactName: string;
  email: string;
  criticalIssue: string | null;
  consentBasis: ConsentBasis;
  /** NEW | PREVIEWED | CONTACTED | BLOCKED | SENT | OPENED | REPLIED | MEETING | PILOT | CLOSED */
  status: string;
  /** Round 17 — assigned sequence id (null = unassigned) */
  sequenceId: string | null;
  /** Round 17 — last completed step index (-1 = not started) */
  currentStep: number;
  /** Round 18 — ICP profile (see src/lib/lead-scoring.ts) */
  sector: string | null;
  /** R millions */
  annualRevenue: number | null;
  employees: number | null;
  /** 1..8 */
  bbbeeLevel: number | null;
  supplierCount: number | null;
  auditFail12m: boolean;
  popiaRisk: boolean;
  govContracts: boolean;
  /** server-recomputed on every write (lead-scoring rubric) */
  score: number;
  /** PRIORITY | QUALIFIED | LONG_SHOT | UNSCORED */
  tier: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** QUEUED | SENT | FAILED | BLOCKED | DRY_RUN */
export type OutreachEmailStatus = "QUEUED" | "SENT" | "FAILED" | "BLOCKED" | "DRY_RUN";

export interface OutreachEmail {
  id: string;
  targetId: string;
  subject: string;
  status: OutreachEmailStatus;
  resendId: string | null;
  error: string | null;
  wormSeq: number | null;
  /** Round 17 — sequence step that produced this row (null = Round 14 /send) */
  stepIndex: number | null;
  /** Round 17 — the personalised body actually composed (evidence) */
  bodyHtml: string | null;
  aiGenerated: boolean;
  sentAt: string | null;
  createdAt: string;
}

export interface OutreachConfig {
  resendConfigured: boolean;
  assetBase: string;
  from: string;
}

export interface OutreachResponse {
  targets: OutreachTarget[];
  emails: OutreachEmail[];
  config: OutreachConfig;
  /** Round 18 — the live scoring rubric (rules/threshold/sectors), so the
   *  UI renders the matrix from server data, not a hand-copied table. */
  scoring?: ScoringMeta;
}

// ─── Round 18 — LEAD SCORING (API contracts; logic in src/lib/lead-scoring) ──

export interface ScoringRuleMeta {
  key: string;
  label: string;
  points: number;
  hint: string;
}

export interface ScoringMeta {
  rules: ScoringRuleMeta[];
  priorityThreshold: number;
  qualifiedThreshold: number;
  scoreMax: number;
  sectors: string[];
  icpCore: string[];
  revenueBand: { min: number; max: number };
  employeeBand: { min: number; max: number };
  bbbeeBand: { min: number; max: number };
}

export interface OutreachSendPreview {
  org: string;
  email: string;
  subject: string;
  html: string;
}

export interface OutreachSendResult {
  org: string;
  email: string;
  status: OutreachEmailStatus;
  error?: string;
}

export interface OutreachSendResponse {
  dryRun: boolean;
  previews: OutreachSendPreview[];
  results: OutreachSendResult[];
  blocked: number;
  sent: number;
  failed: number;
}

// ─── Round 17 — SEQUENCE ENGINE (API contracts) ─────────────────────────────

export interface SequenceStep {
  day: number;
  subject: string;
  angle: string;
}

export interface OutreachSequence {
  id: string;
  name: string;
  steps: SequenceStep[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SequencesResponse {
  sequences: OutreachSequence[];
}

/** 'ai' (LLM composed) | 'template' (deterministic fallback) */
export type DraftSource = "ai" | "template";

export interface StepSendPreview extends OutreachSendPreview {
  source: DraftSource;
  stepLabel: string;
}

export interface StepSendResponse {
  dryRun: boolean;
  previews: StepSendPreview[];
  results: OutreachSendResult[];
  blocked: number;
  sent: number;
  failed: number;
}

export interface DraftResponse {
  subject: string;
  bodyText: string;
  bodyHtml: string;
  source: DraftSource;
  stepLabel: string;
}

// ─── Round 19 — 6G NeXt HOLOCOM (split computing; logic in src/lib/holocom) ─

/** Live cross-layer metrics frame (§IV-B2) broadcast by the telemetry
 *  mini-service every 3s on the 'holo' socket event. Three layers, exactly
 *  as the paper defines them, plus the two live network legs used by the MTP
 *  budget and the QoE surrogate. */
export interface HoloFrame {
  ts: number;
  tick: number;
  /** §IV-B2a — application layer (capture + rendering specifics). */
  app: {
    meshPolysM: number; // live 3D model, millions of polygons
    textureResK: number; // texture resolution (K)
    meshBitrateGbps: number; // capture → edge mesh stream
    audioBitrateKbps: number;
    virtualCameras: number; // H3D sub-frame views per eye position
    renderFps: number;
    avgDecodeMs: number;
  };
  /** §IV-B2b — computing layer (client / edge / central utilizations). */
  computing: {
    clientCpu: number; // 0..1
    clientGpu: number;
    edgeCpu: number;
    edgeGpu: number;
    edgeMem: number;
    centralGpu: number;
  };
  /** §IV-B2c — network layer (client ⇄ edge transport KPIs). */
  network: {
    uplinkMs: number;
    downlinkMs: number;
    uplinkGbps: number;
    downlinkGbps: number;
    jitterMs: number;
    lossPct: number;
    stallMs: number;
  };
  /** Derived live flags. */
  mtpTotalMs: number;
  mtpBreach: boolean; // > 20ms 6G target
  stressLevel: number; // 0..3 injected channel stress (SIM command)
}

/** Registry row (§IV-B3/4 — scored by the Discovery Service, deployed by the
 *  Service Broker). Mirrors the Prisma HoloRenderInstance row. */
export interface HoloInstance {
  id: string;
  code: string;
  deployment: "EDGE" | "CENTRAL";
  site: string;
  region: string;
  engine: string;
  status: "ACTIVE" | "DEPLOYING" | "DRAINED";
  gpuClass: string;
  cpuUtil: number;
  gpuUtil: number;
  memUtil: number;
  baseLatencyMs: number;
  capacityGbps: number;
  costPerHour: number;
  sessions: number;
  createdAt: string;
  updatedAt: string;
}

export interface HoloDiscoveryLogRow {
  id: number;
  clientId: string;
  maxLatencyMs: number;
  minBandwidthMbps: number;
  qosClass: string;
  maxCostPerHour: number | null;
  matchedCode: string | null;
  score: number | null;
  candidates: number;
  reason: string;
  wormSeq: number | null;
  createdAt: string;
}

export interface HoloQoeSampleRow {
  id: number;
  mos: number;
  latencyMs: number;
  jitterMs: number;
  lossPct: number;
  stallMs: number;
  codec: string;
  wormSeq: number | null;
  createdAt: string;
}

/** Rubric meta served with every GET (server-driven UI, like ScoringMeta). */
export interface HoloMeta {
  qosClasses: Array<{
    key: string;
    label: string;
    weight: number;
    hint: string;
    latencyMaxMs: number;
  }>;
  mtpFixedTotalMs: number;
  mtpTarget6gMs: number;
  mtpBaseline5gMs: number;
  deployWindowSec: number; // simulated Docker pull+boot before DEPLOYING→ACTIVE
  deploySites: Array<{
    deployment: string;
    site: string;
    region: string;
    gpuClass: string;
    baseLatencyMs: number;
    costPerHour: number;
  }>;
}

export interface HoloDiscoverOutcome {
  clientId: string;
  matched: {
    code: string;
    site: string;
    deployment: string;
    score: number;
    breakdown: Array<{ label: string; points: number; detail: string }>;
  } | null;
  candidates: Array<{
    code: string;
    site: string;
    deployment: string;
    hardPass: boolean;
    violations: string[];
    score: number;
  }>;
  reason: string;
  wormSeq: number;
}

export interface HoloCodingResult {
  payloadSymbols: number;
  extraSymbols: number;
  transmittedSymbols: number;
  codingRate: number;
  overheadPct: number;
  targetReliability: number;
  lossPct: number;
  achievableReliability: number;
  meetsTarget: boolean;
  wormSeq: number;
}

export interface HoloComResponse {
  instances: HoloInstance[];
  discoveryLogs: HoloDiscoveryLogRow[];
  qoeSamples: HoloQoeSampleRow[];
  meta: HoloMeta;
}

// ─── Round 22 — CAPABILITY DOSSIER ──────────────────────────────────────────
// The fifth projection (#/capability). Answers the three capability questions
// an external procurement assistant asked: (1) pilot status — is anything
// running on REAL SCADA data? (2) entity clarification — is "Vivid" a company
// or a voice-to-text error? (3) location — registered province. System facts
// are computed live server-side; only the operator profile is editable.

export type SaProvince =
  | "Eastern Cape"
  | "Free State"
  | "Gauteng"
  | "KwaZulu-Natal"
  | "Limpopo"
  | "Mpumalanga"
  | "North West"
  | "Northern Cape"
  | "Western Cape";

export type BbbeeOption =
  | "EME"
  | "QSE"
  | "LEVEL_1"
  | "LEVEL_2"
  | "LEVEL_3"
  | "LEVEL_4"
  | "LEVEL_5"
  | "LEVEL_6"
  | "LEVEL_7"
  | "LEVEL_8"
  | "GENERIC"
  | "NOT_RATED";

export type PilotDeclaration = "SIMULATION_ONLY" | "SEEKING_PILOT" | "PILOT_DEPLOYED";

export interface CapabilityProfile {
  entityName: string;
  tradingAs: string;
  vividIsTranscription: boolean;
  province: SaProvince | null;
  csdRegistered: boolean;
  sitaRegistered: boolean;
  provincialRegistered: boolean;
  vatRegistered: boolean;
  bbbeeLevel: BbbeeOption | null;
  contactEmail: string | null;
  contactPhone: string | null;
  pilotDeclaration: PilotDeclaration;
  notes: string | null;
  updatedAt: string;
}

export interface CapabilityServiceStatus {
  key: "dashboard" | "telemetry" | "gateway";
  label: string;
  endpoint: string;
  live: boolean;
  detail: string;
}

export interface CapabilityProvenanceRow {
  view: string;
  hash: string;
  data: string;
  provenance: "SIMULATED" | "REAL" | "MIXED";
  note: string;
}

export interface CapabilityFacts {
  generatedAt: string;
  services: CapabilityServiceStatus[];
  worm: { count: number; chainValid: boolean; lastHash: string | null };
  counts: {
    telemetry: number;
    worm: number;
    outreachTargets: number;
    outreachEmails: number;
    sequences: number;
    holoSamples: number;
  };
  provenance: CapabilityProvenanceRow[];
  /** Hard server-side fact: NO live SCADA feed exists anywhere in the stack. */
  scadaLive: false;
}

export interface CapabilityResponse {
  profile: CapabilityProfile;
  facts: CapabilityFacts;
}

export interface CapabilityStatementResult {
  markdown: string;
  wormSeq: number;
  generatedAt: string;
  charCount: number;
}

// ─── Round 28 — URLLC+ NEURAL EDGE ──────────────────────────────────────────
// The seventh projection (#/urllc): the 6G URLLC paper (DTL transfer lab ·
// unsupervised primal-dual optimizer · LEO Doppler/waveform lab · deployment
// matrix). See src/lib/urllc.ts for the real-vs-calibrated honesty ledger.

export type { UrllcPassState, OptRunResult, WaveformRow, DtlPoint } from "@/lib/urllc";

import type { OptRunResult, TimeWarp, UrllcPassState, WaveformRow } from "@/lib/urllc";

export interface UrllcMeta {
  paper: string;
  pillars: string[];
  vSatKms: number;
  kaFcGhz: number;
  tr38811DopplerKhz: number;
  modelMaxDopplerKhz: number;
  reliabilityTarget: number;
  errSupervisedPct: number;
  errUnsupervisedPct: number;
  marginMinPct: number;
  marginMaxPct: number;
  spectrumBudgetKhz: number;
  warp: TimeWarp;
  timeWarps: readonly number[];
  provenance: Array<{ label: string; kind: "REAL" | "CALIBRATED" | "REPORTED"; note: string }>;
}

export interface UrllcSnapshot {
  generatedAt: string;
  pass: UrllcPassState;
  waveforms: { channel: "TDL-A" | "TDL-C"; rows: WaveformRow[] };
  /** packet loss per (waveform × scheduler) at the live Doppler point */
  schedLoss: Array<{
    waveform: string;
    ddpg: number;
    ddpgt: number;
    kaddpg: number;
  }>;
  dtl: { curve: Array<{ samples: number; scratch: number; dtl: number }>; target: number };
  fnn: { total: number; frozen: number; trainable: number; trainablePct: number };
  matrix: Array<{
    paradigm: string;
    data: string;
    complexity: string;
    qos: string;
    waveforms: string;
    enabler: string;
  }>;
  meta: UrllcMeta;
}

export interface UrllcResponse {
  snapshot: UrllcSnapshot;
}

export interface UrllcOptRunResponse {
  run: OptRunResult;
  wormSeq: number;
  serverSolvedAt: string;
  advisoryWarning: string;
}

export interface UrllcDtlRunResponse {
  samples: number;
  advisory: { scratch: number; dtl: number };
  authoritative: { scratch: number; dtl: number; target: number; verdict: string };
  flops: { scratchTotalMflops: number; dtlTotalMflops: number; ratioPct: number };
  wormSeq: number;
}

// ─── Round 29 — FIELD KIT · CAMPUS WALK (#/fieldkit) ─────────────────────────

export type TrustBottleneck =
  "PROVENANCE" | "EVIDENCE_CAPTURE" | "INSTITUTIONAL_TRUST" | "COST_OF_VERIFICATION";

export type WouldUseAnswer = "YES" | "NO" | "MAYBE";

export interface FacultyMapRow {
  faculty: string;
  bottleneck: TrustBottleneck;
  likelySay: string;
}

export interface BottleneckRow {
  key: TrustBottleneck;
  plainMeaning: string;
  proofbridgeHelp: string;
  verdict: "YES" | "PARTIALLY" | "NO";
}

export interface FieldKitCapture {
  id: string;
  lecturer: string;
  faculty: string;
  field: string | null;
  q1Unverifiable: string;
  q2FailurePath: string;
  q3TrustCondition: string;
  dominantBottleneck: TrustBottleneck;
  wouldUse: WouldUseAnswer;
  offered: string | null;
  followUp: string | null;
  wormSeq: number | null;
  createdAt: string;
}

export interface FieldKitStats {
  captures: number;
  byBottleneck: Array<{ key: TrustBottleneck; count: number }>;
  byWouldUse: Array<{ key: WouldUseAnswer; count: number }>;
  byFaculty: Array<{ faculty: string; count: number }>;
  /** verbatim Q3 trust conditions, newest first — the design constraints */
  trustConditions: Array<{ lecturer: string; faculty: string; condition: string }>;
}

export interface FieldKitResponse {
  captures: FieldKitCapture[];
  stats: FieldKitStats;
  facultyMap: FacultyMapRow[];
  bottlenecks: BottleneckRow[];
  leaveBehind: string;
}

export interface FieldKitCaptureResult {
  capture: FieldKitCapture;
  wormSeq: number;
}

// ─── Round 29 — SUPPORT & FUNDING endpoint (#/support) ───────────────────────

export type ContributionType =
  "ACADEMIC_GRANT" | "INSTITUTIONAL_SPONSOR" | "ALUMNI_CONTRIBUTION" | "PUBLIC_DONATION";

export type PaymentMethod = "PAYFAST" | "EFT_DIRECT" | "CRYPTO";

export type PaymentState =
  "INITIATED" | "PENDING_SETTLEMENT" | "VERIFIED_SETTLED" | "LEDGER_LOCKED" | "FAILED";

export interface FundingContributionRow {
  id: string;
  contributionId: string;
  contributorName: string;
  contributorEmail: string;
  institutionAffiliation: string;
  contributionType: ContributionType;
  amountZar: number;
  allocatedTarget: string;
  paymentMethod: PaymentMethod;
  gatewayReference: string | null;
  sha256ReceiptHash: string | null;
  paymentState: PaymentState;
  receiptId: string | null;
  blockId: string | null;
  wormSeq: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface FundingProgress {
  targetZar: number;
  targetLabel: string;
  targetProvisional: true;
  lockedTotalZar: number;
  lockedCount: number;
  pendingTotalZar: number;
  pendingCount: number;
  supporterCount: number;
  pct: number;
  allocation: Array<{ label: string; pct: number }>;
}

export interface FundingFsmState {
  stateId: number;
  name: PaymentState | "IDLE";
  trigger: string;
  actions: string;
}

export interface FundingSupportResponse {
  progress: FundingProgress;
  contributions: FundingContributionRow[];
  fsm: FundingFsmState[];
  honesty: Array<{ layer: string; status: "REAL" | "DESIGN" | "LOCAL_REF"; note: string }>;
  generatedAt: string;
}

export interface FundingActionResult {
  contribution: FundingContributionRow;
  transition: string;
  wormSeq: number;
  receiptText?: string;
}

/** Live weather reading streamed by the estate's environment feed
 *  (source: the rig's weather node; consumed by computeEnvironment). */
export interface EnvWeather {
  condition: string;
  /** WMO weather code (0 clear … 95–99 thunder). */
  code: number;
  precipMm: number;
  cloudCoverPct: number;
  tempC?: number;
  windKmh?: number;
  humidityPct?: number;
  stale?: boolean;
  observedAt?: string;
}
