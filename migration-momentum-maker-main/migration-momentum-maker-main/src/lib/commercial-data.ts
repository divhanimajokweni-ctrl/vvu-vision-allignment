// src/lib/commercial-data.ts — ROUND 30 · tenth+eleventh projection data ledger.
//
// RECONSTRUCTION DISCLOSURE (Zero Fabrication Rule):
//   A prior session built a commercial data ledger (price cards, email drafts,
//   FS operating standard) whose files were NEVER PERSISTED to this repo —
//   no commit, no file, no worklog entry survived. The operator noticed
//   ("why am I lost… you're no longer supplying me with these types of
//   documents"). This file REBUILDS that ledger from surviving sources only:
//
//     · blockchain-detection-offer.md (v0.1, 15 Sep 2026) — pilot pricing,
//       delivery-status table, "What this is NOT", next steps — used verbatim.
//     · PROOFBRIDGE_COMPILED_RUNNER_WITH_DISCOVERY.md — 14-component
//       architecture incl. Node hardware prices (Mk0 R491 / Mk0.5 R1671 /
//       MkI R2,769/R13,479).
//     · Session handover summary — the 16-card price list (prices are
//       OFFERS/TARGETS, not production-verified), payment discipline rules,
//       three-door scripts, operator quotes. Labelled SUMMONED below.
//
//   Every price card carries a `source` field. SUMMONED items are reconstructed
//   from the handover summary and are marked as such in the UI. Nothing in
//   this file claims production verification.

export type PriceCardSource =
  | 'OFFER-DOC' // blockchain-detection-offer.md — verbatim, hashed doc
  | 'RUNNER-DOC' // compiled runner + discovery — hardware list
  | 'SUMMONED'; // prior-session summary — reconstructed, not persisted

export type CardStatus =
  | 'PRICED · OFFER LIVE'
  | 'PRICED · SPEC STATUS'
  | 'PRICED · TARGET';

export interface PriceCard {
  id: string;
  name: string;
  price: string;
  unit: string;
  audience: string;
  oneLine: string;
  status: CardStatus;
  componentNote: string;
  source: PriceCardSource;
  sourceRef: string;
  includes: string[];
}

export const PRICING_DISCLOSURE = {
  headline: 'PRICES ARE OFFERS / TARGETS — NOT PRODUCTION-VERIFIED COMMITMENTS',
  body:
    'This card set was rebuilt after the prior session\'s ledger was not persisted. ' +
    'Per-card provenance: OFFER-DOC = blockchain-detection-offer.md v0.1 (verbatim) · ' +
    'RUNNER-DOC = compiled runner hardware list · SUMMONED = reconstructed from the ' +
    'handover summary (prices were stated as offers/targets there too). Delivery status ' +
    'for the detection product line is disclosed in the offer document: substrate TESTED ' +
    '(7,100+ chain records), scorer IN BUILD, sequence model SPECIFIED. No card here ' +
    'may be presented to a customer as a deployed capability without the offer doc\'s ' +
    'status table.',
} as const;

export const PRICE_CARDS: PriceCard[] = [
  {
    id: 'discovery',
    name: 'Blockchain Detection — Discovery',
    price: 'R15,000',
    unit: 'once-off · 1 week',
    audience: 'Any pilot prospect',
    oneLine: 'Chain coverage, thresholds, your 10 watch-only addresses, success criteria signed off.',
    status: 'PRICED · OFFER LIVE',
    componentNote: 'Credited in full against the pilot if you proceed.',
    source: 'OFFER-DOC',
    sourceRef: 'blockchain-detection-offer.md §4',
    includes: [
      'Chain coverage confirmed',
      'Alert thresholds set',
      'Escalation contacts agreed',
      'Fee credited against pilot on signature',
    ],
  },
  {
    id: 'pilot',
    name: 'Blockchain Detection — Pilot',
    price: 'R50,000',
    unit: 'fixed · 6 weeks',
    audience: 'Post-discovery prospects',
    oneLine: '3-case live demo, 10-address monitoring, 50 screens, evidence pack per alert, weekly Thursday report.',
    status: 'PRICED · OFFER LIVE',
    componentNote: 'Scorer IN BUILD — deployed on customer addresses by pilot week 2 (offer commitment).',
    source: 'OFFER-DOC',
    sourceRef: 'blockchain-detection-offer.md §3–4',
    includes: [
      '3-case live demonstration at kickoff',
      'Continuous monitoring — 10 addresses',
      '50 on-demand screening checks',
      'SHA-256 hash-chained receipt per alert',
      'Final evidence report with full test log',
    ],
  },
  {
    id: 'monitoring',
    name: 'Monitoring Subscription',
    price: 'R5,000',
    unit: '/ month · in advance',
    audience: 'Post-pilot continuity',
    oneLine: '10 addresses watched · +R350/address/mo beyond 10 · +R250/check beyond the 50 included.',
    status: 'PRICED · OFFER LIVE',
    componentNote: '30-day notice, no lock-in.',
    source: 'OFFER-DOC',
    sourceRef: 'blockchain-detection-offer.md §4',
    includes: [
      '10 addresses included',
      'R350 / additional address / month',
      'R250 / additional on-demand screen',
      '30-day notice · no lock-in',
    ],
  },
  {
    id: 'node-mk0',
    name: 'Node Mk0 — Pi Zero 2 W',
    price: 'R491',
    unit: 'hardware · once-off',
    audience: 'Edge verification node',
    oneLine: 'Mk0 edge node on Pi Zero 2 W with Ed25519 — the R491 parts basis for the Field Kit.',
    status: 'PRICED · SPEC STATUS',
    componentNote: 'Component per compiled runner architecture list. Node hardware: all three marks currently SPEC, not deployed.',
    source: 'RUNNER-DOC',
    sourceRef: 'PROOFBRIDGE_COMPILED_RUNNER §architecture',
    includes: ['Pi Zero 2 W', 'Ed25519 identity', 'One chain — three bodies doctrine'],
  },
  {
    id: 'node-mk05',
    name: 'Node Mk0.5 — HDMI',
    price: 'R1,671',
    unit: 'hardware · once-off',
    audience: 'Bench / demo node',
    oneLine: 'Mk0.5 HDMI variant — bench body in the one-chain-three-bodies node line.',
    status: 'PRICED · SPEC STATUS',
    componentNote: 'Component per compiled runner architecture list — SPEC status.',
    source: 'RUNNER-DOC',
    sourceRef: 'PROOFBRIDGE_COMPILED_RUNNER §architecture',
    includes: ['HDMI bench variant', 'Same chain as Mk0/MkI'],
  },
  {
    id: 'node-mki',
    name: 'Node MkI — Pi5 NVMe',
    price: 'R2,769',
    unit: 'hardware · once-off (R13,479 full build)',
    audience: 'Primary edge node',
    oneLine: 'Pi5 + NVMe + ATECC608A secure element + BNO085 IMU — two documented build tiers.',
    status: 'PRICED · SPEC STATUS',
    componentNote: 'Component per compiled runner architecture list — SPEC status, not deployed.',
    source: 'RUNNER-DOC',
    sourceRef: 'PROOFBRIDGE_COMPILED_RUNNER §architecture',
    includes: ['Pi5 + NVMe', 'ATECC608A secure element', 'BNO085 IMU', 'R2,769 / R13,479 tiers'],
  },
  {
    id: 'field-kit',
    name: 'Field Kit (Mk0 basis)',
    price: 'R5,000',
    unit: 'once-off',
    audience: 'Campus walk / field capture',
    oneLine: 'Mk0-class field kit — parts basis R491 (Pi Zero 2 W), assembled and loaded with the capture template.',
    status: 'PRICED · TARGET',
    componentNote: 'SUMMONED price; parts basis grounded in the runner doc. See #/fieldkit for the capture workflow it runs.',
    source: 'SUMMONED',
    sourceRef: 'handover summary · card set',
    includes: ['Mk0-class node', 'Capture template preloaded', 'People-notes workflow (#/fieldkit)'],
  },
  {
    id: 'ive-pro',
    name: 'IVE Pro License',
    price: 'R3,000',
    unit: 'license',
    audience: 'Verification power users',
    oneLine: 'License tier for the IVE / Trust OS executor layer.',
    status: 'PRICED · TARGET',
    componentNote: 'SUMMONED price. Component status: IVE deliberately unbuilt per the evidence-first policy — the substrate earns existence first.',
    source: 'SUMMONED',
    sourceRef: 'handover summary · card set',
    includes: ['IVE / Trust OS executor tier', 'Not deployable today — spec status'],
  },
  {
    id: 'enterprise-tier',
    name: 'Enterprise Tier',
    price: 'R10,000+',
    unit: '/ month',
    audience: 'Multi-team orgs',
    oneLine: 'Organisation tier above the standard monitoring line — multi-seat, org-level evidence registry.',
    status: 'PRICED · TARGET',
    componentNote: 'SUMMONED price — entry point at R10k/month, scale-up scoped per org.',
    source: 'SUMMONED',
    sourceRef: 'handover summary · card set',
    includes: ['Multi-seat access', 'Org evidence registry', 'Scoped per organisation'],
  },
  {
    id: 'studi',
    name: 'STUDI Engagement',
    price: 'R50,000 – R150,000',
    unit: 'per engagement',
    audience: 'Architecture-scale clients',
    oneLine: 'STUDI-track engagement — scoped architecture study on the 14-component spine.',
    status: 'PRICED · TARGET',
    componentNote: 'SUMMONED price. Component status: STUDI UNKNOWN — zero implementation hits in the discovery sweep.',
    source: 'SUMMONED',
    sourceRef: 'handover summary · card set',
    includes: ['Scoped architecture study', 'Component-spine mapping', 'Evidence-first deliverables'],
  },
  {
    id: 'enterprise-verification',
    name: 'Enterprise Verification Program',
    price: 'R100,000 – R400,000',
    unit: 'per program',
    audience: 'Large orgs needing verified claims',
    oneLine: 'Full verification program — claim/obligation/evidence formalisation for enterprise procurement.',
    status: 'PRICED · TARGET',
    componentNote: 'SUMMONED price — program scope per client.',
    source: 'SUMMONED',
    sourceRef: 'handover summary · card set',
    includes: ['Claims register', 'Proof-obligation mapping', 'Verification results + receipts'],
  },
  {
    id: 'water-feasibility',
    name: 'Water Utility Feasibility Study',
    price: 'R50,000 – R150,000',
    unit: 'per study',
    audience: 'Municipal water utilities',
    oneLine: 'Feasibility study for hydraulic-invariant monitoring on utility infrastructure — the #/ analytics FSM spine.',
    status: 'PRICED · TARGET',
    componentNote: 'SUMMONED price. Feasibility → pilot ladder with the water pilot card below.',
    source: 'SUMMONED',
    sourceRef: 'handover summary · card set',
    includes: ['Hydraulic invariant mapping', 'Node placement plan', 'Monitoring business case'],
  },
  {
    id: 'water-pilot',
    name: 'Water Utility Pilot',
    price: 'R250,000 – R1,000,000',
    unit: 'per pilot',
    audience: 'Post-feasibility utilities',
    oneLine: 'Live pilot on utility infrastructure — nodes, telemetry, leak/thermal FSM, evidence receipts.',
    status: 'PRICED · TARGET',
    componentNote: 'SUMMONED price. The FSM leak/thermal simulation that runs on this dashboard is the demo basis.',
    source: 'SUMMONED',
    sourceRef: 'handover summary · card set',
    includes: ['Node deployment', 'Continuous telemetry', 'Leak/thermal FSM alerts', 'Evidence pack per event'],
  },
  {
    id: 'bank-fraud',
    name: 'Bank Fraud Detection Program',
    price: 'R500,000 – R2,000,000',
    unit: 'per program',
    audience: 'Banks / tier-1 financial institutions',
    oneLine: 'Fraud-sequence detection with cryptographic evidence for dispute, compliance and insurance files.',
    status: 'PRICED · TARGET',
    componentNote: 'SUMMONED price. Fraud-sequence model status per offer doc: SPECIFIED — adversarial suites defined, not deployed.',
    source: 'SUMMONED',
    sourceRef: 'handover summary · card set',
    includes: ['Sequence model (unknown contact → balance change → new beneficiary → transfer)', 'Adversarial test suites', 'Dispute-grade evidence packs'],
  },
  {
    id: 'searm',
    name: 'SEARM Engagement',
    price: 'R150,000 – R500,000+',
    unit: 'per engagement',
    audience: 'Security-scale clients',
    oneLine: 'SEARM-track engagement on the estate\'s security architecture line.',
    status: 'PRICED · TARGET',
    componentNote: 'SUMMONED price. Component status: SEARM UNKNOWN — keyword-only presence (layout metadata), zero implementation.',
    source: 'SUMMONED',
    sourceRef: 'handover summary · card set',
    includes: ['Scoped security engagement', 'Evidence-first reporting'],
  },
  {
    id: 'custom',
    name: 'Custom Engineering',
    price: 'R500,000+',
    unit: 'per build',
    audience: 'Bespoke verification builds',
    oneLine: 'Custom verification / detection builds on the receipts spine — scoped by SOW only.',
    status: 'PRICED · TARGET',
    componentNote: 'SUMMONED price — floor R500k, SOW mandatory at this size.',
    source: 'SUMMONED',
    sourceRef: 'handover summary · card set',
    includes: ['SOW mandatory', 'Receipts-spine basis', 'Evidence-first acceptance criteria'],
  },
];

// The academic licence closes the 16-card set.
export const ACADEMIC_LICENSE: PriceCard = {
  id: 'academic',
  name: 'Academic / Research Licence',
  price: 'R5,000 – R25,000',
  unit: '/ year',
  audience: 'Universities · research groups',
  oneLine: 'Research licence for the verification bench — lab use, citation obligations, no commercial monitoring.',
  status: 'PRICED · TARGET',
  componentNote: 'SUMMONED price. Tied to the L6–L9 epistemic bench layers already viewable on this dashboard.',
  source: 'SUMMONED',
  sourceRef: 'handover summary · card set',
  includes: ['Lab / bench use', 'Citation obligations', 'No commercial monitoring rights'],
};

export const ALL_PRICE_CARDS: PriceCard[] = [...PRICE_CARDS, ACADEMIC_LICENSE];

// ─── Payment discipline (operator directives — verbatim where quoted) ──────

export interface DisciplineRule {
  id: number;
  rule: string;
  detail: string;
  quote?: string;
}

export const PAYMENT_DISCIPLINE: DisciplineRule[] = [
  {
    id: 1,
    rule: 'NO MONEY WITHOUT CONSENT',
    detail: 'Payment is only ever taken after the customer has explicitly consented to the charge. No silent card capture, no auto-billing on signup.',
    quote: '"We will not take no money without getting consent from customers." — operator directive',
  },
  {
    id: 2,
    rule: '≤ R25,000 → PAID UPFRONT',
    detail: 'Small engagements: full payment on signature. No credit terms below this line.',
  },
  {
    id: 3,
    rule: '> R25,000 → 50% + 50%',
    detail: 'Larger engagements: 50% deposit on signature, 50% on acceptance of the deliverable.',
  },
  {
    id: 4,
    rule: '≥ R50,000 → SOW MANDATORY',
    detail: 'Every engagement at or above R50,000 carries a signed Statement of Work. No verbal scope.',
  },
  {
    id: 5,
    rule: 'SUBSCRIPTIONS BILLED IN ADVANCE',
    detail: 'Monitoring and licence lines bill monthly/annually in advance. 30-day notice, no lock-in.',
  },
  {
    id: 6,
    rule: 'SAME SCOPE NEVER DISCOUNTED',
    detail: 'If the price is too high, the scope comes down — the price for a given scope does not. Reduce scope, not price.',
  },
];

// ─── Five email drafts — DRAFT — NOT SENT · REBUILT ─────────────────────────
// The prior session held five verbatim prospect emails that were never
// persisted. These five REBUILTS are grounded in blockchain-detection-offer.md
// language (the one surviving commercial document) and the three-door
// scripts. They are templates until the operator approves and sends.

export interface EmailDraft {
  id: string;
  to: string;
  door: string;
  subject: string;
  body: string[];
  label: string;
}

const NOT_SENT_LABEL = 'DRAFT — NOT SENT · REBUILT FROM OFFER DOC';

export const EMAIL_DRAFTS: EmailDraft[] = [
  {
    id: 'sme',
    to: 'Small-business owner (name to insert)',
    door: 'DOOR 1 · SMALL BUSINESS',
    subject: 'When a payment goes wrong, the bank asks for proof — not opinions',
    body: [
      'Hi [name],',
      'You move real money over rails — card, EFT, increasingly crypto. When a transaction goes wrong, you need two things fast: to KNOW what happened, and to PROVE it — to a bank, a lawyer, or an insurer.',
      'Screening tools give you a score and ask you to trust it. They do not give you evidence you can hand over in a dispute. That gap costs money exactly when you can least afford it — after the transaction has already gone wrong.',
      'We screen addresses and transactions, watch your exposure continuously, and issue a tamper-evident cryptographic receipt with every result. Any third party can re-verify it in microseconds. No trust in us required — that is the point.',
      'A one-week discovery (R15,000, credited in full if you proceed to the pilot) confirms coverage, thresholds and your watch-only address list. Worth 20 minutes this week?',
    ],
    label: NOT_SENT_LABEL,
  },
  {
    id: 'fintech',
    to: 'Fintech / crypto platform compliance lead (name to insert)',
    door: 'DOOR 2 · FINANCE & CRYPTO',
    subject: 'Every alert ships evidence — screening your addresses without asking for trust',
    body: [
      'Hi [name],',
      'Your compliance file needs more than a vendor\'s risk score — it needs artifacts a dispute officer, an auditor or a court can verify independently.',
      'Our screening returns {target, risk_score, reasons[], evidence_hash, receipt}. Monitoring watches up to 10 addresses for velocity spikes, new-counterparty activity, and sequence anomalies — e.g. the known scam pattern: unknown contact → abnormal balance change → new beneficiary created → immediate high-value transfer, all inside minutes.',
      'Every alert carries a SHA-256 hash-chained, timestamped, signed receipt. The verification substrate is lab-tested over 7,100+ chain records; the scorer is in build with deployment on customer addresses by pilot week 2. We disclose status because we do not overclaim.',
      'Pilot: R50,000 fixed over 6 weeks, 50 screens included, weekly Thursday report, final evidence report with the full valid + invalid test log. Should I send the offer document?',
    ],
    label: NOT_SENT_LABEL,
  },
  {
    id: 'utility',
    to: 'Municipal water utility engineering lead (name to insert)',
    door: 'DOOR 3 · ENTERPRISE / INFRASTRUCTURE',
    subject: 'Leak detection with receipts — feasibility study for [utility]',
    body: [
      'Hi [name],',
      'Infrastructure monitoring lives and dies on two questions: is the alert real, and can the record survive audit. Most telemetry answers neither.',
      'We run hydraulic-invariant monitoring — flow-balance and thermal invariants with a finite-state leak/thermal model — and every event lands in a write-once evidence chain with a SHA-256 receipt. Your engineers get the raw invariant state; your auditors get the tamper-evident trail.',
      'The first step is a feasibility study (R50,000–R150,000 scoped to your network): invariant mapping, node placement, business case. If it holds, the pilot (R250,000–R1,000,000) deploys nodes and proves it live on your infrastructure.',
      'Can I align the feasibility scope with your network team in the next two weeks?',
    ],
    label: NOT_SENT_LABEL,
  },
  {
    id: 'bank',
    to: 'Bank fraud / financial crime lead (name to insert)',
    door: 'DOOR 2 · FINANCE & CRYPTO',
    subject: 'Fraud-sequence detection with dispute-grade evidence',
    body: [
      'Hi [name],',
      'Fraud teams can detect sequences; the hard part is evidencing them to the standard a dispute, an insurance claim or a regulator demands.',
      'We are building fraud-sequence detection where every alert ships with a cryptographically verifiable receipt — the sequence logic (unknown contact → abnormal balance change → new beneficiary → immediate high-value transfer) is specified with adversarial test suites, and the program includes the full valid + invalid test log at handover.',
      'This is a program-level engagement (R500,000–R2,000,000 scoped by SOW): discovery, deployment on agreed transaction classes, measured precision/recall against agreed targets, and 100% of alerts carrying receipts that re-verify deterministically.',
      'Not equity, not tokens, not custody — a working capability with evidence. Who on your side should see the technical annex?',
    ],
    label: NOT_SENT_LABEL,
  },
  {
    id: 'academic',
    to: 'University research group lead (name to insert)',
    door: 'DOOR 1 · SMALL BUSINESS (research variant)',
    subject: 'Research licence — verification bench with the evidence chain intact',
    body: [
      'Hi [name],',
      'Your group works on trust and verification claims; our bench runs them with the evidence chain intact — hash-chained receipts on every step, epistemic labels on every number (OBSERVED / VERIFIED / PENDING — never blurred).',
      'The academic licence (R5,000–R25,000/year, scoped to lab size) covers bench use of the L6–L9 epistemic layers and the receipts spine, with citation obligations and no commercial monitoring rights.',
      'If your students need a substrate where every artifact is re-verifiable by construction, this is it. Happy to walk your team through it on a call.',
    ],
    label: NOT_SENT_LABEL,
  },
];

// ─── FS Operating Standard — 15-question gate (all PENDING) ──────────────────
// RECONSTRUCTED: the prior session's 15 questions were not persisted. These
// rebuild the gate from the operator's three standing directives (ToS per
// service, complaints process, consent-before-payment) plus the SA financial
// services compliance domains the estate has disclosed elsewhere (POPIA,
// FSCA status, AML support boundaries in the offer doc's "What this is NOT").

export interface FsGateQuestion {
  id: number;
  question: string;
  status: 'PENDING' | 'REGULATORY PENDING';
  note: string;
}

export const FS_GATE: FsGateQuestion[] = [
  { id: 1, question: 'Does every paid service have a published Terms of Service the customer accepted before payment?', status: 'PENDING', note: 'Operator directive — ToS per service. Text drafted, not yet published.' },
  { id: 2, question: 'Is there a documented complaints process with acknowledgement and resolution timelines?', status: 'PENDING', note: 'Operator directive — complaints document flow. Draft stage.' },
  { id: 3, question: 'Is explicit customer consent captured before ANY payment is taken?', status: 'PENDING', note: 'Operator directive — "we will not take no money without getting consent from customers". Mechanism to be wired into the payment DFA.' },
  { id: 4, question: 'Are refunds / credits (e.g. discovery fee credited against pilot) stated in writing per engagement?', status: 'PENDING', note: 'Offer doc states the credit — needs generalised terms.' },
  { id: 5, question: 'Is pricing consistently communicated across offer docs, invoices and this dashboard?', status: 'PENDING', note: 'This projection is the single price source; invoice template pending.' },
  { id: 6, question: 'Is a Statement of Work issued for every engagement ≥ R50,000?', status: 'PENDING', note: 'Discipline rule #4 — SOW template not yet drafted.' },
  { id: 7, question: 'Are payment terms (upfront / 50-50 / advance billing) disclosed before signature?', status: 'PENDING', note: 'Rules published here; customer-facing disclosure text pending.' },
  { id: 8, question: 'Is personal customer data processed under a POPIA-compliant basis with a retention schedule?', status: 'REGULATORY PENDING', note: 'POPIA operator registration / information officer steps outstanding.' },
  { id: 9, question: 'Is any activity conducted that requires FSCA licensing or exemption analysis?', status: 'REGULATORY PENDING', note: 'Detection/evidence services border financial-advice boundaries — legal read outstanding.' },
  { id: 10, question: 'Are AML support boundaries stated ("not a replacement for your compliance/AML obligations")?', status: 'REGULATORY PENDING', note: 'Offer doc §5 states the boundary; needs elevation into standing terms.' },
  { id: 11, question: 'Is VAT treatment (15% where applicable) applied and disclosed on all invoices?', status: 'PENDING', note: 'VAT registration status outstanding (operator).' },
  { id: 12, question: 'Is there a dispute-resolution path named in every service agreement?', status: 'PENDING', note: 'Tied to complaints process (#2).' },
  { id: 13, question: 'Are receipts and evidence packs retained and re-verifiable for the agreed retention period?', status: 'PENDING', note: 'WORM spine is TESTED — retention policy text pending.' },
  { id: 14, question: 'Is insurance / professional indemnity cover in place for advisory-adjacent deliverables?', status: 'PENDING', note: 'Operator decision outstanding.' },
  { id: 15, question: 'Is a named accountable person published for each service line?', status: 'PENDING', note: 'Single-founder estate — naming waits on entity registration details.' },
];

// ─── Three-door opening scripts (never open with architecture) ───────────────

export interface DoorScript {
  id: string;
  door: string;
  opensWith: string;
  lines: string[];
  neverDo: string;
}

export const THREE_DOOR_SCRIPTS: DoorScript[] = [
  {
    id: 'sme',
    door: 'DOOR 1 · SMALL BUSINESS',
    opensWith: 'Open with the loss, not the stack.',
    lines: [
      '"When a payment goes wrong — disputed, suspicious, or just strange — what does your bank ask you for?"',
      'Let them describe the evidence gap. Then: "That exact gap — proof, not opinions — is what we hand you with every alert."',
      'Only after they ask "how": one sentence on hash-chained receipts. Never lead with it.',
    ],
    neverDo: 'Never open with architecture, chains or nodes. The door is their money already lost.',
  },
  {
    id: 'finance',
    door: 'DOOR 2 · FINANCE & CRYPTO',
    opensWith: 'Open with the audit file, not the model.',
    lines: [
      '"Your compliance file needs artifacts an auditor can verify without calling you. What would that be worth per alert?"',
      'Then: "Every alert we ship carries a SHA-256 receipt any third party re-verifies in microseconds — the trust question is removed by construction."',
      'Status honesty is the differentiator: substrate TESTED (7,100+ records), scorer IN BUILD, deployment by pilot week 2. Say it in that order.',
    ],
    neverDo: 'Never blur TESTED / IN BUILD / SPECIFIED. Compliance buyers punish overclaiming more than gaps.',
  },
  {
    id: 'infra',
    door: 'DOOR 3 · ENTERPRISE / INFRASTRUCTURE',
    opensWith: 'Open with audit survival, not sensors.',
    lines: [
      '"When your infrastructure monitoring raises an alert, who can challenge the record — and does the record survive it?"',
      'Then: hydraulic invariants with finite-state leak/thermal model, write-once evidence chain, receipt per event — engineers get raw state, auditors get the trail.',
      'Ladder them: feasibility study (R50–150k) before pilot (R250k–1M). The study is the trust step.',
    ],
    neverDo: 'Never quote the pilot before the feasibility study has been accepted. The ladder IS the sale.',
  },
];

// ─── Self-contained QR payloads (no URL is minted — estate rule) ────────────
// The operator asked for QR codes in the field. There is NO public URL for
// this dashboard (gateway is localhost-only), and inventing a URL violates
// the estate's first non-negotiable. These payloads therefore encode the
// DOCUMENT TEXT ITSELF — a scan shows the price line directly, offline,
// with no server involved. When a public endpoint exists, the operator
// decides the URL and the payloads can be re-pointed.

export const QR_STATION_DISCLOSURE =
  'QR payloads are SELF-CONTAINED TEXT — they encode the offer line itself, not a URL. ' +
  'Reason: no public endpoint exists for this dashboard; minting a QR to an invented ' +
  'URL is prohibited (estate rule #1: never invent URLs). When the operator exposes ' +
  'a public address, payloads can be re-pointed with a one-line change.';

export function priceCardQrPayload(card: PriceCard): string {
  return [
    `PROOFBRIDGE · ${card.name.toUpperCase()}`,
    `${card.price} ${card.unit}`,
    card.oneLine,
    'Every alert ships evidence. Assertion ≠ Evidence.',
    'STATUS: prices are offers/targets — see offer doc for delivery status.',
  ].join('\n');
}

export const PRICELIST_QR_PAYLOAD: string = [
  'PROOFBRIDGE · PRICE LIST (OFFERS/TARGETS)',
  'Detection: Discovery R15k · Pilot R50k · Monitoring R5k/mo',
  'Extra address R350/mo · Extra screen R250',
  'Field Kit R5k · IVE Pro R3k · Enterprise R10k+/mo',
  'Academic licence R5–25k/yr',
  'Programs: Water feasibility R50–150k, pilot R250k–1M',
  'Bank fraud R500k–2M · SEARM R150–500k+',
  'STUDI R50–150k · Enterprise verification R100–400k · Custom R500k+',
  'Nodes: Mk0 R491 · Mk0.5 R1,671 · MkI R2,769/R13,479',
  'No money without consent. Same scope never discounted.',
  'Assertion ≠ Evidence',
].join('\n');
