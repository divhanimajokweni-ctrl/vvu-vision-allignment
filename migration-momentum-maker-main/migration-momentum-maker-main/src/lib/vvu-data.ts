// src/lib/vvu-data.ts — VVU E2E textbook constants (Design Freeze Level 1 · 20260901)
// Corporate math, physical node layout, FSM tables, scenarios, B-BBEE facts.

import type { FsmState, FsmSymbol, GateRecord, VotingLedger } from "@/types/vvu";

// ─── Tenant / georeference ──────────────────────────────────────────────────

export const GQEBERHA_TENANT_ID = "e1002324-0000-0000-0000-000000000001";
export const GQEBERHA_ANCHOR = {
  lat: -33.9608,
  lon: 25.6022,
  datum: "WGS84",
  site: "Gqeberha Edge Node · ENU Local Tangent Plane",
};

// Task 14-a — outreach programme namespace (distinct from the GIS tenant;
// matches the OutreachTarget.tenantId schema default).
export const OUTREACH_TENANT_ID = "VVU_202625905307";

// ─── Physical nodes (Appendix C.2 — ENU mm) ────────────────────────────────

export interface PhysicalNodeDef {
  nodeId: string;
  name: string;
  role: string;
  xMm: number;
  yMm: number;
  zMm: number;
  materialGrade?: string;
  diameterMm?: number;
  assemblyTorqueNm?: number;
}

export const PHYSICAL_NODES: PhysicalNodeDef[] = [
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
    materialGrade: "316L Stainless",
    diameterMm: 114.3,
    assemblyTorqueNm: 85.0,
  },
  {
    nodeId: "N03",
    name: "Outlet Meter Pod",
    role: "Primary outlet flow sensor",
    xMm: 750,
    yMm: 160,
    zMm: 930,
    materialGrade: "316L Stainless",
    diameterMm: 114.3,
    assemblyTorqueNm: 85.0,
  },
  {
    nodeId: "N04",
    name: "Pressure Pipe DN300",
    role: "Central structural pressure-retaining spool",
    xMm: 0,
    yMm: 0,
    zMm: 750,
    materialGrade: "Ductile Iron",
    diameterMm: 326.0,
    assemblyTorqueNm: 154.7,
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
    materialGrade: "316L Stainless",
    diameterMm: 114.3,
    assemblyTorqueNm: 85.0,
  },
];

// ─── Pipe spool profiles (SANS 1123 / EN 1092-1) ────────────────────────────

export const PIPE_SPOOL_PROFILES = [
  {
    nominalSize: "DN100",
    odMm: 114.3,
    wallMm: 6.0,
    material: "316L Stainless",
    flangeStandard: "SANS 1299",
    boltSpec: "8× M16 Grade 8.8",
    torqueNm: 85.0,
  },
  {
    nominalSize: "DN300",
    odMm: 326.0,
    wallMm: 13.0,
    material: "Ductile Iron",
    flangeStandard: "SANS 1123 PN16",
    boltSpec: "12× M24 Grade 8.8",
    torqueNm: 154.7,
  },
];

export const HYDRAULIC_INVARIANTS = [
  { parameter: "Wave Celerity", minValue: 200, maxValue: 1400, unit: "m/s" },
  { parameter: "FAVAD Exponent", minValue: 0.5, maxValue: 2.5, unit: "—" },
  { parameter: "Sacrificial Corrosion", minValue: null, maxValue: 10.0, unit: "mm" },
  { parameter: "Factor of Safety", minValue: 1.5, maxValue: 3.0, unit: "—" },
];

// ─── Thermal boundaries (Appendix D.3) ──────────────────────────────────────

export const THERMAL = {
  warnC: 65, // → THERMAL_THROTTLE
  critC: 85, // → FAIL_CLOSED_LOCKDOWN
  hysteresisC: 5, // de-escalate below 60°C
};

// ─── FSM (Appendix B) ───────────────────────────────────────────────────────

export const FSM_STATES: FsmState[] = [
  "DISCONNECTED",
  "PAIRING_BLE",
  "TOTP_VERIFICATION",
  "STEADY_STATE_LOCKED",
  "LEAK_ACTIVE",
  "THERMAL_THROTTLE",
  "FAIL_CLOSED",
];

export const FSM_TRANSITIONS: Array<{
  from: FsmState;
  symbol: FsmSymbol;
  to: FsmState;
  action: string;
}> = [
  {
    from: "DISCONNECTED",
    symbol: "INIT",
    to: "PAIRING_BLE",
    action: "Establish BLE-SC via ECDH; init watchdog timer.",
  },
  {
    from: "PAIRING_BLE",
    symbol: "CHAL",
    to: "TOTP_VERIFICATION",
    action: "Request challenge signature; display random photo grid.",
  },
  {
    from: "TOTP_VERIFICATION",
    symbol: "TOTP_OK",
    to: "STEADY_STATE_LOCKED",
    action: "Grant access; load config; centre canvas at Gqeberha (-33.9608, 25.6022).",
  },
  {
    from: "TOTP_VERIFICATION",
    symbol: "CRIT",
    to: "DISCONNECTED",
    action: "Purge ephemeral keys; reset hardware; log auth failure.",
  },
  {
    from: "STEADY_STATE_LOCKED",
    symbol: "CLICK",
    to: "LEAK_ACTIVE",
    action: "Fire raycaster; set pipe colour to crimson; project 20m soil moisture overlay.",
  },
  {
    from: "LEAK_ACTIVE",
    symbol: "CLEAR",
    to: "STEADY_STATE_LOCKED",
    action: "Restore pipe colours; initiate slow tank replenishment.",
  },
  {
    from: "LEAK_ACTIVE",
    symbol: "WARN",
    to: "THERMAL_THROTTLE",
    action: "Log thermal fact to WORM storage; reduce APU clock; decimate mesh density by 62.5%.",
  },
  {
    from: "STEADY_STATE_LOCKED",
    symbol: "WARN",
    to: "THERMAL_THROTTLE",
    action: "Log thermal fact to WORM storage; reduce APU clock.",
  },
  {
    from: "THERMAL_THROTTLE",
    symbol: "RESET",
    to: "STEADY_STATE_LOCKED",
    action: "De-escalate throttling after temperature drops below 60°C (5°C hysteresis).",
  },
  {
    from: "THERMAL_THROTTLE",
    symbol: "CRIT",
    to: "FAIL_CLOSED",
    action: "Flush RAM evidence to NVMe; execute battery disconnect within 500ms.",
  },
  {
    from: "FAIL_CLOSED",
    symbol: "RESET",
    to: "STEADY_STATE_LOCKED",
    action: "Perform SHA-256 hash checks across 19 master assets; re-open safety circuit breakers.",
  },
  {
    from: "LEAK_ACTIVE",
    symbol: "RESET",
    to: "STEADY_STATE_LOCKED",
    action: "Authorised human-in-the-loop audit recovery sequence.",
  },
];

// ─── Trust Gates (Chapter 3 / Appendix F.4) ─────────────────────────────────

export interface GateDef {
  gateId: "3A" | "3B" | "3C";
  title: string;
  requirement: string;
  certification: string;
  beneficiary: string;
  shares: number;
}

export const GATE_DEFS: GateDef[] = [
  {
    gateId: "3A",
    title: "First Customer · Verified Invoice",
    requirement: "1 customer with a cleared R5k pilot invoice (WORM invoice + proof of payment).",
    certification: "WORM invoice + POP",
    beneficiary: "Founder (sweat equity)",
    shares: 10000,
  },
  {
    gateId: "3B",
    title: "R50k MRR · 2 Consecutive Months",
    requirement:
      "R50,000 MRR proven by bank statements for 2 consecutive months (Xero reconciled).",
    certification: "Bank statements + Xero",
    beneficiary: "ESD Beneficiary Trust",
    shares: 40000,
  },
  {
    gateId: "3C",
    title: "3 Physical Nodes · Steady State",
    requirement:
      "3 physical nodes producing 72h of STEADY_STATE telemetry (ingestEdgeTelemetry logs).",
    certification: "ingestEdgeTelemetry logs · 72h steady state",
    beneficiary: "ESD Beneficiary Trust",
    shares: 59100,
  },
];

// ─── MOI voting algebra (Chapter 2) ─────────────────────────────────────────

export const MOI = {
  founderAShares: 90900,
  classAVotesPerShare: 20,
  publicBShares: 800000,
  terminalFounderAlignedVotes: 1927100, // 1,818,000 (A) + 109,100 (aligned B)
  terminalTotalVotes: 2727100,
  terminalPct: 70.66,
  dilutionFloor: 55, // Article 5.3.3
  jseFreeFloat: 20,
};

export const FOUNDER_A_VOTES = MOI.founderAShares * MOI.classAVotesPerShare; // 1,818,000

/**
 * Live voting ledger derived from certified gates.
 * Stage: pre-gates → 3A (+10,000 B founder) → 3B (+40,000 B trust) → 3C (+59,100 B trust)
 * Terminal: (1,818,000 + 109,100) / 2,727,100 = 70.66% — exact textbook proof.
 */
export function computeVotingLedger(certifiedGates: Set<string>): VotingLedger {
  const sweatB = certifiedGates.has("3A") ? 10000 : 0;
  const trustB = (certifiedGates.has("3B") ? 40000 : 0) + (certifiedGates.has("3C") ? 59100 : 0);
  const founderAlignedVotes = FOUNDER_A_VOTES + sweatB + trustB;
  const totalVotes = founderAlignedVotes + MOI.publicBShares;
  const pct = (founderAlignedVotes / totalVotes) * 100;
  return {
    founderVotesA: FOUNDER_A_VOTES,
    founderSweatB: sweatB,
    trustB,
    publicB: MOI.publicBShares,
    founderAlignedVotes,
    totalVotes,
    pct: Math.round(pct * 100) / 100,
    terminalPct: MOI.terminalPct,
    dilutionFloor: MOI.dilutionFloor,
    jseFreeFloat: MOI.jseFreeFloat,
  };
}

export const MOI_TERMINAL_TABLE = [
  {
    holder: "Founder Class A",
    shares: "90,900 × 20",
    votes: 1818000,
    note: "Non-transferable · Founder only",
  },
  {
    holder: "Trust Class B (3B+3C)",
    shares: "99,100 × 1",
    votes: 99100,
    note: "ESD Beneficiary Trust",
  },
  {
    holder: "Founder Sweat Class B (3A)",
    shares: "10,000 × 1",
    votes: 10000,
    note: "Sweat equity · first hire",
  },
  {
    holder: "Public Class B (IPO)",
    shares: "800,000 × 1",
    votes: 800000,
    note: "JSE free-float 20% requirement",
  },
];

// ─── Financial scenarios (Appendix G / Chapter 5) ───────────────────────────

export interface ScenarioDef {
  id: string;
  name: string;
  mrr: number;
  infraCost: number;
  contribution: number;
  valuation: number;
  state: string;
  note: string;
}

export const SCENARIOS: ScenarioDef[] = [
  {
    id: "baseline",
    name: "Baseline · R50k MRR",
    mrr: 50000,
    infraCost: 18000,
    contribution: 32000,
    valuation: 600000,
    state: "STEADY_STATE",
    note: "10× ARR = R50k × 12 × 10 = R600k pre-money. Weighted voting 66.67% → 70.66%.",
  },
  {
    id: "hbk",
    name: "HBK Mk-II · 20% Infra Saving",
    mrr: 50000,
    infraCost: 14400,
    contribution: 46250,
    valuation: 720000,
    state: "STEADY_STATE",
    note: "8S4P battery: I²R heat −75% (current halved per string) → Operating Contribution +32%.",
  },
  {
    id: "downside",
    name: "Downside · 40% Churn",
    mrr: 30000,
    infraCost: 18000,
    contribution: 0,
    valuation: 0,
    state: "FAIL_CLOSED",
    note: "Churn > 40% or APU temp > 85°C → FAIL_CLOSED. Stop shipping data, preserve Trust, prevent POPIA breach.",
  },
];

// ─── B-BBEE / ESD (Chapter 5 / Appendix A) ──────────────────────────────────

export const BBEEE = {
  company: "VAGUELY VANITY (PTY) LTD",
  reg: "2026/259053/07",
  level: "Level 1 B-BBEE Contributor",
  recognition: 135,
  blackOwned: 51,
  esdNpatPct: 1.5,
  taxClearance: "Valid",
  cipc: "Active",
  tagline: "Trust through transparent cycles.",
};

export const ESD_VERIFICATION_FLOW = [
  { step: "CIPC", detail: "Registration status + director names", seconds: 10 },
  { step: "B-BBEE", detail: "Certificate level verification", seconds: 12 },
  { step: "SARS", detail: "Tax clearance PIN status", seconds: 8 },
];

// ─── 5-Gate roadmap DFA (Chapter 4) ─────────────────────────────────────────

export const ROADMAP_GATES = [
  {
    gate: "Gate 0–1",
    automaton: "FSA",
    title: "Provisioning",
    detail: "BLE pairing · TOTP verification · finite state acceptance",
    state: "CERTIFIED",
  },
  {
    gate: "Gate 2–3",
    automaton: "PDA",
    title: "Memory of Invoices",
    detail: "Requires stack memory — invoice history drives trust triggers 3A/3B/3C",
    state: "IN_PROGRESS",
  },
  {
    gate: "Gate 4",
    automaton: "LBA",
    title: "Thermal Bounded",
    detail: "HBK thermal envelope bounds the automaton tape",
    state: "PENDING",
  },
  {
    gate: "Gate 5",
    automaton: "TM",
    title: "JSE IPO",
    detail: "Turing-complete governance · free-float waiver · MOI supremacy",
    state: "PENDING",
  },
];

// ─── Release manifest — 19 master assets (Appendix E.3 / §20) ──────────────

export const RELEASE_MANIFEST: Array<{ filename: string; role: string }> = [
  { filename: "VVU_Master_Textbook_v0.3.md", role: "Single source of truth" },
  { filename: "VVU_Guardrail_Doc_v1.md", role: "Agent constraints + escalation" },
  { filename: "contracts/VVUIVELedger.sol", role: "On-chain WORM anchor" },
  { filename: "vvu-decision-ledger-20260901.sql", role: "Decision ledger schema" },
  { filename: "vvu-init-db-20260901.sh", role: "Sovereign DB bootstrap" },
  { filename: "vvu-telemetry-controller-20260901.ts", role: "Telemetry + invariants" },
  { filename: "vvu-deploy-all-v3-20260901.sh", role: "Deployment orchestrator" },
  { filename: "vvu-ssh-setup-20260901.sh", role: "Zero-token SSH handshake" },
  { filename: "vvu-ble-fsm-20260901.ts", role: "Edge-pairing FSM" },
  { filename: "zoo_step_verifier.py", role: "Zoo STEP → ledger bridge" },
  { filename: "vvu-sister-system.py", role: "Celonis Copilot sidecar" },
  { filename: "appendix/CIPC_BBBEE_flow.md", role: "30-second verification flow" },
  { filename: "appendix/MOI_Article5.md", role: "Dual-class share clauses" },
  { filename: "appendix/SHA_Gate3.md", role: "Trust trigger clauses" },
  { filename: "appendix/Financial_Scenarios.xlsx", role: "Scenario tables" },
  { filename: "appendix/ESD_Scripts.md", role: "Cold outreach scripts" },
  { filename: "Vvu-Hash-Verifier-V3-20260901.sh", role: "Hash verifier" },
  { filename: "Zoo-Step-Verifier.py", role: "STEP watcher (alt case)" },
  { filename: "Vvu-Decision-Ledger-20260901.sql", role: "Decision ledger (alt case)" },
];

export const RELEASE_TAG = "DESIGN_FREEZE_LEVEL_1 · RELEASE_20260901";

// ─── WhatsApp quick replies (Appendix A.2) ──────────────────────────────────

export const WHATSAPP_QUICK_REPLIES = [
  {
    shortcut: "/verify",
    script:
      "🔍 PROOFBRIDGE VERIFICATION — Send me the company registration number. I check it LIVE on CIPC in 30 seconds. You get: Registration status, Director names, B-BBEE level, Tax clearance status.",
  },
  {
    shortcut: "/bbbee",
    script:
      "📜 LEVEL 1 B-BBEE CERTIFICATE — VAGUELY VANITY (PTY) LTD — Reg: 2026/259053/07 — 135% Procurement Recognition Points — Attached: Certificate PDF.",
  },
  {
    shortcut: "/invoice",
    script:
      "💰 PROOFBRIDGE-LINER PILOT — Service: Supplier Verification Platform — Pilot Period: 30 Days — Cost: R5,000 (excl. VAT) — Full License: R30,000/month.",
  },
  {
    shortcut: "/close",
    script:
      '✅ HOW TO CLOSE A PILOT — 1. "Mines lose up to 30% of B-BBEE points using fake certificates." 2. "We verify suppliers in 30 seconds. Level 1 supplier. Pilot R5k." 3. "If it doesn\'t save you time, don\'t pay."',
  },
];

// ─── Footer / brand (Appendix K.3) ──────────────────────────────────────────

export const FOOTER = {
  line1: "VENTURE VISION UBUNTU · VERIFICATION LAYER · PROOFBRIDGE-LINER",
  founder: 'Mihle "Divhani" Majokweni · Founder & CEO · VVU Foundation',
  contact: "divh@venturevisionubuntu.co.za · 062 350 6594",
  copyright: "©2026 VVU Foundation · Trust through transparent cycles",
};

// ─── MRR sim targets ────────────────────────────────────────────────────────

export const MRR_TARGET = 50000;
export const PILOT_PRICE = 5000;
export const FULL_LICENSE_PRICE = 30000;
