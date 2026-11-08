// src/lib/trust-data.ts — VVU-TRUST · Community Compute Pool (Task 37).
// Clean-slate build of the four operator-supplied source artifacts, kept
// VERBATIM and labelled by provenance:
//   · surfaces/index.html   → the 8-bit micro-city onboarding game (ported to
//     React/canvas below; logic sandbox-verified 72/72 in
//     .qa8b-tmp/trust-engine-stress.ts before integration).
//   · PITCH_ONEPAGER.md     → the ProofBridge pitch (verbatim sections).
//   · stokvel_terms_v0.md   → the 8-section community pool terms (verbatim).
//   · MANIFEST.md           → the three-valued status tree + its one rule.
// No other module in this tree owns these strings — this file is the single
// source of truth, and every claim carries its status label.

// ── Three-valued status (verbatim rule from MANIFEST.md) ────────────────────

export type TrustStatus = 'SOURCED' | "SPEC'd" | 'VERIFIED';

export const TRUST_STATUS_LABELS: { label: TrustStatus; meaning: string }[] = [
  { label: 'SOURCED', meaning: 'Specified from imported source material. Not yet integrated.' },
  { label: "SPEC'd", meaning: 'File exists in this tree. Not yet run as part of the bundle.' },
  { label: 'VERIFIED', meaning: 'Has a receipt — hash, commit, or run log — from this build.' },
];

export const TRUST_STATUS_RULE =
  'Never mark an item VERIFIED until a run produces a receipt. A hash, a log line, an exit code. No receipt, no promotion.';

// ── 1. Game data — ported verbatim from surfaces/index.html ──────────────────

export interface TrustComponent {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  label: string;
  full: string;
}

export const TRUST_ISO = { x: 1.0, y: 0.55 } as const;
export const TRUST_DRAW_H_K = TRUST_ISO.y * 1.6; // drawn height factor (source draw loop)

export const TRUST_COMPONENTS: TrustComponent[] = [
  { id: 'CLK', x: -180, y: -40, w: 90, h: 50, color: '#252b31', label: 'CLK', full: 'NE555 Clock' },
  { id: 'BUS', x: 0, y: -8, w: 420, h: 26, color: '#7a5300', label: 'BUS', full: '8-Bit Data Bus' },
  { id: 'Reg A', x: -130, y: 60, w: 120, h: 60, color: '#173247', label: 'Reg A', full: 'Register A · 74LS173' },
  { id: 'Reg B', x: 30, y: 60, w: 120, h: 60, color: '#173247', label: 'Reg B', full: 'Register B · 74LS173' },
  { id: 'ALU', x: 180, y: 60, w: 140, h: 60, color: '#681515', label: 'ALU', full: 'ALU · 74LS283' },
  { id: 'PC', x: -220, y: 140, w: 110, h: 50, color: '#173c4c', label: 'PC', full: 'Program Counter' },
  { id: 'MAR', x: -100, y: 140, w: 110, h: 50, color: '#173c4c', label: 'MAR', full: 'Memory Address Register' },
  { id: 'IR', x: 20, y: 140, w: 110, h: 50, color: '#173c4c', label: 'IR', full: 'Instruction Register' },
  { id: 'RAM', x: 180, y: 140, w: 120, h: 60, color: '#12435a', label: 'RAM', full: 'RAM · 74LS189' },
  { id: 'EEPROM A', x: -180, y: -140, w: 120, h: 60, color: '#4c174e', label: 'EEPROM A', full: 'Control Bank 1' },
  { id: 'EEPROM B', x: -20, y: -140, w: 120, h: 60, color: '#4c174e', label: 'EEPROM B', full: 'Control Bank 2' },
  { id: 'OUT', x: 180, y: -140, w: 120, h: 60, color: '#1a2634', label: 'OUT', full: 'Output Register' },
];

export interface TrustMission {
  t: string;
  d: string;
  a: string;
}

export const TRUST_MISSIONS: TrustMission[] = [
  { t: 'Wake the computer', d: 'Tap CLK. The NE555 is the heartbeat. A clock pulse lets the rest of the machine move.', a: 'CLK' },
  { t: 'Open the highway', d: 'Tap BUS. This is where numbers travel.', a: 'BUS' },
  { t: 'Give A a number', d: 'Tap Reg A. Put the first value, 5, into the accumulator.', a: 'Reg A' },
  { t: 'Give B a number', d: 'Tap Reg B. Put the second value, 3, into the operand register.', a: 'Reg B' },
  { t: 'Remember where we are', d: 'Tap PC. The Program Counter is the bookmark telling the computer which instruction comes next.', a: 'PC' },
  { t: 'Find the address', d: 'Tap MAR. The Memory Address Register holds the memory location we want to visit.', a: 'MAR' },
  { t: 'Capture the instruction', d: 'Tap IR. The Instruction Register catches the current instruction from RAM.', a: 'IR' },
  { t: 'Read the memory', d: 'Tap RAM. Memory stores the program and its data.', a: 'RAM' },
  { t: 'Do the maths', d: 'Tap ALU. Combine A = 5 and B = 3. The expected sum is 8.', a: 'ALU' },
  { t: 'Use Control Bank 1', d: 'Tap EEPROM A. It provides PC, memory, and instruction routing signals.', a: 'EEPROM A' },
  { t: 'Use Control Bank 2', d: 'Tap EEPROM B. It provides register, ALU, flags and step-reset signals.', a: 'EEPROM B' },
  { t: 'Verify the answer', d: 'Tap OUT. The output register sends 00001000 = 8 to the LEDs.', a: 'OUT' },
];

export const TRUST_WIN_TEXT =
  'The virtual node fetched instructions, moved data across the 8-bit bus, used the control banks, performed 5 + 3, and verified the result as 8.';

export const TRUST_TAGLINE = 'Understand → Build → Test → Verify';

/** Screen-space hit test against the DRAWN boxes (h·0.88 tall), reverse draw
 *  order — last drawn wins. Sandbox-verified: every center hits itself. */
export function trustHitTest(
  mx: number,
  my: number,
  pad = 4
): TrustComponent | null {
  for (let i = TRUST_COMPONENTS.length - 1; i >= 0; i--) {
    const c = TRUST_COMPONENTS[i];
    const px = c.x * TRUST_ISO.x;
    const py = c.y * TRUST_ISO.y;
    const drawnH = c.h * TRUST_DRAW_H_K;
    if (Math.abs(mx - px) <= c.w / 2 + pad && Math.abs(my - py) <= drawnH / 2 + pad) {
      return c;
    }
  }
  return null;
}

// ── 2. PITCH_ONEPAGER.md — verbatim ─────────────────────────────────────────

export const TRUST_PITCH = {
  product: 'ProofBridge',
  tagline: 'A machine a community owns together. Runs without internet. Keeps honest records even when the power dies.',
  sections: [
    {
      id: 'problem',
      heading: 'The problem',
      paras: [
        'Every AI tool that reaches rural South Africa arrives on somebody else\u2019s terms. A cloud subscription in dollars. A monthly fee forever. A connection that drops when Eskom drops. Data that leaves the farm and never comes back. And when the company that runs it gets bored or goes broke, the tool stops working.',
        'No single smallholder farmer can afford a proper machine on their own. No bank will lend to one. So they stay locked out.',
      ],
      items: [],
    },
    {
      id: 'built',
      heading: 'What we built',
      paras: [
        'A software stack that runs entirely on a small, cheap computer in the farm office. No cloud. No subscription to a foreign company. No account to create. It reads the farm\u2019s sensors, controls the pump, watches the cold room, and answers questions in plain language \u2014 all on the machine itself, with nothing leaving the property.',
        'A farmer scans a square code on the office wall with their phone. An app opens in the browser. No install. No password. They see live soil, water, cold room, and pump readings. They tap a button and the pump slows. Every action is written down in a chain that cannot be quietly edited.',
        'The management view \u2014 a live 3D map of the farm\u2019s terrain, irrigation, power, and cold-chain assets \u2014 runs from the same machine and is reachable from any phone, tablet, or laptop on the farm Wi-Fi, with or without internet.',
      ],
      items: [],
    },
    {
      id: 'different',
      heading: 'What makes it different',
      paras: [],
      items: [
        {
          lead: 'It survives load-shedding.',
          text: 'When the power and internet drop, the machine keeps recording. When they come back, it reconciles on its own. Nobody presses \u201crestore.\u201d Nobody presses \u201csave.\u201d',
        },
        {
          lead: 'It cannot lie.',
          text: 'Every reading, every button press, every automated action is chained to the one before it. An auditor, an insurer, or a co-op treasurer can read the whole history and see it has not been touched.',
        },
        {
          lead: 'It will not hurt anyone.',
          text: 'A hard, physical safety floor sits beneath the AI. If the AI proposes a pump speed that would damage the aquifer, or a cold room setting that would fail export standards, the safety floor blocks it. The AI never overrides physics.',
        },
        {
          lead: 'It runs on hardware you already have.',
          text: 'The whole system has been tested on a second-hand laptop and a R300 router. Nothing exotic.',
        },
      ],
    },
    {
      id: 'business',
      heading: 'The business model',
      paras: [
        'We do not sell hardware. We do not sell subscriptions.',
        'We provide the software and the setup, and a community pools R1,000 each \u2014 ten neighbours, ten thousand rand \u2014 to buy one machine together. They own it. Shares are proportional, non-transferable, and refundable on exit. If someone has a bad harvest, the group can vote to defer their contribution. No penalties.',
        'When the machine is quiet \u2014 overnight, off-season \u2014 the community can rent the spare capacity to a researcher or a nearby business. That money flows back into the pool.',
        'We take a small, flat orchestration fee per deployment. Paid once. Not monthly. The community keeps the rest forever.',
      ],
      items: [],
    },
    {
      id: 'matters',
      heading: 'Why this matters',
      paras: [
        'This is not a cheaper cloud product. It is a different shape entirely. The machine belongs to the people who paid for it. The record belongs to the community. The AI answers to the safety floor, not to us. And when we are gone, everything keeps working \u2014 because there is nothing to switch off.',
      ],
      items: [],
    },
    {
      id: 'ask',
      heading: 'The ask',
      paras: [
        'We are looking for the first three communities to run this for one full season.',
        'R10,000 per community, pooled by the members themselves. We supply the software, the installer, and the first year of support. In return we get the evidence, the field data, and the proof that the model works at scale.',
        'After three communities, the model funds itself. The fourth community is paid for by the third, and the fifth by the fourth, and so on.',
      ],
      items: [{ lead: 'One page. One machine. One community. That is the whole pitch.', text: '' }],
    },
  ],
  footnote:
    'ProofBridge runs on Windows, Linux, and any browser. No blockchain is visible to users. No data leaves the property. No monthly bill exists.',
} as const;

// ── 3. stokvel_terms_v0.md — verbatim (8 sections) ──────────────────────────

export interface TrustTermSection {
  n: number;
  heading: string;
  paras: string[];
}

export const TRUST_TERMS: TrustTermSection[] = [
  {
    n: 1,
    heading: 'What the pool is',
    paras: [
      'The pool is a group of people who each paid an equal share into a single machine. The machine sits in a fixed location agreed by the group. The machine belongs to the pool, not to any one member, and not to the company that wrote the software.',
    ],
  },
  {
    n: 2,
    heading: 'Who owns what',
    paras: [
      'Each member holds a non-transferable share. The size of the share is the amount they paid, divided by the total pool. A member cannot sell their share to a stranger. They can only withdraw it, as described in section 6.',
    ],
  },
  {
    n: 3,
    heading: 'How the pool is topped up',
    paras: [
      'Members pay into the pool using their ordinary bank account or card. Local payments are made in South African Rand through the group\u2019s chosen collection service. International payments, if any, are made in the member\u2019s own currency and converted at the time of payment. No member is ever required to buy anything in a foreign currency.',
    ],
  },
  {
    n: 4,
    heading: 'How hardship is handled',
    paras: [
      'If a member cannot pay their portion in a given season \u2014 a bad harvest, a family emergency, a health issue \u2014 the group may vote to defer that member\u2019s contribution. A deferral is not a penalty. It is a postponement. The member keeps their share. The group decides how long the deferral lasts, and it can be renewed by another vote.',
    ],
  },
  {
    n: 5,
    heading: 'How idle earnings return to the pool',
    paras: [
      'When the machine is quiet \u2014 overnight, or during off-season \u2014 the group may allow an outside party to use it for a fee. The fee is paid into the pool, not to any individual. At the end of each month, the group may withdraw part of this fee to cover upkeep, or leave it to grow the pool.',
    ],
  },
  {
    n: 6,
    heading: 'How a member leaves',
    paras: [
      'A member may leave at any time. On leaving, they receive a pro-rata return of the pool\u2019s current value, based on their share. There is no exit penalty. If the pool cannot pay in cash at that moment, the group schedules a payment date and honours it.',
    ],
  },
  {
    n: 7,
    heading: 'What the company does and does not do',
    paras: [
      'The company writes and maintains the software. The company does not own the machine. The company does not hold the members\u2019 money. The company does not decide who may join or leave. The company does not shut the machine off if a member misses a payment \u2014 that decision, if any, belongs to the group.',
    ],
  },
  {
    n: 8,
    heading: 'Amendments',
    paras: [
      'These terms may be changed by a majority vote of the group. Any change is recorded with the date and the names of those who voted. The record is kept on the machine itself.',
    ],
  },
];

// ── 4. MANIFEST.md — three-valued tree (verbatim statuses) ───────────────────

export interface TrustManifestEntry {
  path: string;
  status: TrustStatus;
  note?: string;
  /** True when this artifact was supplied verbatim and is integrated in
   *  THIS build (the four files the operator pasted). */
  integratedHere?: boolean;
  /** When a receipt exists in the WORM chain (source TRUST) that satisfies
   *  the manifest rule for this entry, the UI may promote SPEC'd → VERIFIED
   *  and cite the receipt hash. Promotion is receipt-driven, never manual. */
  promotesOn?: 'PROGRAM_COMPLETE';
}

export const TRUST_MANIFEST_TREE: TrustManifestEntry[] = [
  { path: 'foundations/event_types.py', status: "SPEC'd" },
  { path: 'foundations/iec61508_sis_override_sim.py', status: "SPEC'd" },
  { path: 'bridge/meantime_calibration_engine.py', status: "SPEC'd" },
  { path: 'bridge/plugin_registry.py', status: "SPEC'd" },
  { path: 'bridge/agreement_rail_bridge.py', status: "SPEC'd" },
  { path: 'server/opcua_mcp_offline_agri_server.py', status: "SPEC'd" },
  { path: 'server/opcua_mcp_plc_dcs_bridge.py', status: "SPEC'd" },
  { path: 'agent/langgraph_opcua_agent_sim.py', status: "SPEC'd" },
  { path: 'agent/thz_lorawan_langgraph_agent.py', status: "SPEC'd" },
  { path: 'validation/verify_hydro_governance_tee.py', status: "SPEC'd" },
  { path: 'validation/run_7stage_validation_pipeline.py', status: "SPEC'd" },
  { path: 'validation/generate_72hr_audit_certificate_and_experiment.py', status: "SPEC'd" },
  { path: 'validation/run_resilience_test_suite.py', status: "SPEC'd" },
  { path: 'contract/ComputeStokvelROSCA.sol', status: 'SOURCED' },
  { path: 'contract/test_compute_stokvel_rosca.py', status: "SPEC'd" },
  {
    path: 'surfaces/index.html',
    status: "SPEC'd",
    integratedHere: true,
    promotesOn: 'PROGRAM_COMPLETE',
    note: 'Ported to React (TrustOnboarding) in this build; engine sandbox-verified 72/72. VERIFIED on a TRUST_PROGRAM_COMPLETE receipt.',
  },
  { path: 'surfaces/pwa/agri_smartphone_web_bridge.py', status: "SPEC'd" },
  { path: 'surfaces/spatial_twin/spatial_twin_offline.html', status: "SPEC'd" },
  {
    path: 'surfaces/twin/ENVIRONMENTAL_STATE_SYNC.md',
    status: "SPEC'd",
    integratedHere: true,
    note: 'Round 32 — BUILT in this projection set: solar/moon computed client-side (NOAA port), weather polled by the :3003 node every 15 min (Open-Meteo, no API key) with ENV_WEATHER_FETCHED / ENV_WEATHER_STALE chained to the WORM, sun-following site fixtures on the 0°/2° hysteresis. On disk in the vvu-trust/ repo tree.',
  },
  {
    path: 'surfaces/twin/TWIN_VIEWER_SPEC.md',
    status: "SPEC'd",
    integratedHere: true,
    note: 'Round 32 — written (next logical artifact after the environmental layer). Spec-level: the viewer itself is not yet built. Rendered from the SYS.04 panel docs dialog; on disk in the vvu-trust/ repo tree.',
  },
  {
    path: 'surfaces/twin/scenarios/cape_town_wildfire.html',
    status: "SPEC'd",
    integratedHere: true,
    note: 'Round 34 — operator-delivered single-file scenario (verbatim, byte-for-byte on disk). Rendered as the fifteenth projection #/twin via /api/vvu/twin-scenario (raw HTML, no fork, no restyle). First scenario of the municipal twin flavor; the mesh positions are seeded — the live wiring to the pipeline engine is the named next artifact.',
  },
  {
    path: 'fleet/DEVICE_MESH_SPEC.md',
    status: "SPEC'd",
    integratedHere: true,
    note: 'Round 33 — named in the operator\u2019s fleet-set list but not on disk; written this round (standing pattern). Rendered in #/fleet from disk via /api/vvu/fleet-docs.',
  },
  {
    path: 'fleet/DEVICE_DISCOVERY_PROTOCOL.md',
    status: "SPEC'd",
    integratedHere: true,
    note: 'Round 33 — operator verbatim. Four discovery channels, dedup, one-screen census. On disk in the vvu-trust/ repo tree; rendered in #/fleet.',
  },
  {
    path: 'fleet/UNIFIED_CONSENT_MODEL.md',
    status: "SPEC'd",
    integratedHere: true,
    note: 'Round 33 — operator verbatim. Four grantors, windows, revocation; the chain is the consent record. On disk in the vvu-trust/ repo tree; rendered in #/fleet.',
  },
  {
    path: 'fleet/ONBOARDING_FLOW.md',
    status: "SPEC'd",
    integratedHere: true,
    note: 'Round 33 — operator verbatim. Ten minutes, zero typing, QR fallback. On disk in the vvu-trust/ repo tree; rendered in #/fleet.',
  },
  {
    path: 'fleet/PIPELINE_CATALOG.md',
    status: "SPEC'd",
    integratedHere: true,
    note: 'Round 33 — named in the operator\u2019s fleet-set list but not on disk; written this round. Ten pipeline manifests. On disk in the vvu-trust/ repo tree; rendered in #/fleet.',
  },
  {
    path: 'fleet/PIPELINE_ENGINE_SPEC.md',
    status: "SPEC'd",
    integratedHere: true,
    note: 'Round 33 — the proposed next artifact, authored: the runtime that loads the manifests, merges the streams, enforces consent windows, and executes the 7-stage pipeline. On disk in the vvu-trust/ repo tree; rendered in #/fleet.',
  },
  {
    path: 'blog/2026-09-20-four-smart-purchases-one-mesh.md',
    status: "SPEC'd",
    integratedHere: true,
    note: 'Round 33 — operator verbatim, published as-is with quotes pulled from ONBOARDING_FLOW.md and a generated hero image (assets/hero-four-smart-purchases.jpg). On disk in the vvu-trust/ repo tree; rendered in #/fleet.',
  },
  { path: 'installer/install_agri_smartfarm.py', status: "SPEC'd" },
  { path: 'installer/smartfarm_all_in_one_installer.py', status: 'SOURCED' },
  { path: 'installer/vvu_trust_e2e_installer.py', status: 'SOURCED' },
  { path: 'launch.sh', status: "SPEC'd" },
  { path: 'HARDWARE_TIERS.md', status: "SPEC'd" },
  {
    path: 'PITCH_ONEPAGER.md',
    status: "SPEC'd",
    integratedHere: true,
    note: 'Rendered verbatim in the PITCH tab of this build.',
  },
  {
    path: 'stokvel_terms_v0.md',
    status: "SPEC'd",
    integratedHere: true,
    note: 'Rendered verbatim in the STOKVEL TERMS tab of this build.',
  },
  {
    path: 'MANIFEST.md',
    status: "SPEC'd",
    integratedHere: true,
    note: 'Rendered verbatim (statuses + rule) in the MANIFEST tab of this build.',
  },
  { path: 'README.md', status: "SPEC'd" },
];

// ── 5. Stokvel pool simulator defaults (illustrative, grounded in the docs) ──
// Grounding: pitch = "pools R1,000 each — ten neighbours, ten thousand rand"
//            pitch = machine ask "R10,000 per community"
//            terms §5 = idle-fee flows into the pool; §6 = pro-rata exit.
//            Orchestration fee: "a small, flat orchestration fee per
//            deployment. Paid once." — NO figure published → default 0 + hint.
export const TRUST_POOL_DEFAULTS = {
  members: 10,
  contribution: 1000, // R per member
  machineCost: 10000, // R
  orchestrationFee: 0, // R once — figure not published in source docs
  idleRate: 8, // R/hour (illustrative)
  idleHoursPerDay: 8, // quiet window (e.g. 22:00–06:00)
  idleDaysPerMonth: 20,
  upkeepPerMonth: 180, // R — electricity + airtime reserve (illustrative)
  horizonMonths: 12,
} as const;

/** Deterministic pool projection month-by-month. Pure — unit-testable. */
export function projectPool(input: {
  members: number;
  contribution: number;
  machineCost: number;
  orchestrationFee: number;
  idleRate: number;
  idleHoursPerDay: number;
  idleDaysPerMonth: number;
  upkeepPerMonth: number;
  horizonMonths: number;
  deferredMembers?: number;
}) {
  const d = Math.max(0, Math.min(input.members - 1, input.deferredMembers ?? 0));
  const payingMembers = input.members - d;
  const poolCollected = payingMembers * input.contribution;
  const shortfall = d * input.contribution;
  const poolTotalIfAllPaid = input.members * input.contribution;
  const upfrontCost = input.machineCost + input.orchestrationFee;
  const surplus = poolCollected - upfrontCost;
  const sharePct = (100 / input.members);
  const idleIncomePerMonth = input.idleRate * input.idleHoursPerDay * input.idleDaysPerMonth;
  const netGrowthPerMonth = idleIncomePerMonth - input.upkeepPerMonth;
  const breakEvenMonths =
    netGrowthPerMonth > 0 && surplus < 0
      ? Math.ceil(-surplus / netGrowthPerMonth)
      : netGrowthPerMonth > 0
        ? 0
        : null;
  const perMemberTopUp = payingMembers > 0 ? shortfall / payingMembers : shortfall;

  const months: { month: number; poolValue: number; idle: number; upkeep: number }[] = [];
  let value = surplus;
  for (let m = 1; m <= input.horizonMonths; m++) {
    value += netGrowthPerMonth;
    months.push({
      month: m,
      poolValue: Math.round(value),
      idle: Math.round(idleIncomePerMonth * m),
      upkeep: Math.round(input.upkeepPerMonth * m),
    });
  }
  const exitValueNow = Math.max(0, surplus) + Math.max(0, months[months.length - 1]?.poolValue ?? 0);
  const proRataExit = (exitValueNow * sharePct) / 100;

  return {
    poolCollected,
    poolTotalIfAllPaid,
    shortfall,
    payingMembers,
    deferredMembers: d,
    upfrontCost,
    surplus,
    sharePct,
    idleIncomePerMonth,
    netGrowthPerMonth,
    breakEvenMonths,
    perMemberTopUp,
    months,
    proRataExit,
  };
}
