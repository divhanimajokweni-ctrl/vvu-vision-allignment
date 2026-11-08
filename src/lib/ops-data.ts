// src/lib/ops-data.ts — Task 45 · the OPERATIONS + COMMERCIAL MENU ledger.
//
// Single source of truth for the `#/ops` projection (THE OPERATIONS LOOP —
// OPS_SWEEP_30M spec, roles, automation authority, compliance pack) and the
// `#/commercial` price-card extension (the formal commercial menu v2).
// Ported from the operator's Day-1 field-operations directive (16 Sep 2026).
//
// HONESTY NOTES (Day 1 standard, unchanged):
//   * Prices are OFFERS/TARGETS, not proof of customer-production validation
//     (operator's own caveat — rendered on the view).
//   * SCHEDULING CONSTRAINT (operator-stated, not worked around): the
//     scheduling system available to the operator supports daily/weekly/
//     monthly recurrence only — NOT a true 30-minute cadence. The sweep is
//     therefore built as a MANUALLY-RUNNABLE, on-demand procedure with the
//     stored spec ready for cron/MCP infrastructure. No pretend automation.
//   * Phone notifications (exceptions-only) are a DESIGN TARGET — no phone
//     channel exists in this build. The sweep produces exception-only text
//     blocks ready for any channel; it does not claim to have sent one.
//   * Customer / Sales / Commercial domains are NOT_INSTRUMENTED — 0 paying
//     customers, no leads inbox, no invoices exist. The sweep says so rather
//     than reporting fake greens.
//   * Consent rule: no money is taken without recorded customer consent.
//     No payments exist yet; the record spec is defined and awaiting first
//     real use.
//   * The compliance pack (ToS, complaints, consent, B2B pilots) is
//     DRAFT — REVIEW REQUIRED. Not legal advice until the lawyer signs off
//     (manifest L7: regulatory file review pending).
//
// ZERO runtime dependencies. Hand-typed, one maintainer.

// ── the formal commercial menu — price card v2 ──────────────────────────────

export interface PriceRow {
  id: string;
  offering: string;
  entryPrice: string;
  delivery: string;
  /** Task 44 sales-ledger cross-reference, where one exists. */
  tier?: 'T1' | 'T2' | 'T3';
  featured?: boolean;
}

export const PRICE_CARD: readonly PriceRow[] = [
  { id: 'PC-01', offering: 'ProofBridge Discovery', entryPrice: 'R15,000', delivery: '1 week', tier: 'T1', featured: true },
  { id: 'PC-02', offering: 'ProofBridge Detection Pilot', entryPrice: 'R50,000', delivery: '6 weeks', tier: 'T1', featured: true },
  { id: 'PC-03', offering: 'ProofBridge Monitoring', entryPrice: 'R5,000/month', delivery: 'recurring', tier: 'T1', featured: true },
  { id: 'PC-04', offering: 'Additional monitored address', entryPrice: 'R350/month', delivery: 'each' },
  { id: 'PC-05', offering: 'Additional screening beyond included allowance', entryPrice: 'R250/screen', delivery: 'usage' },
  { id: 'PC-06', offering: 'IVE Workspace — Professional', entryPrice: 'R3,000/month', delivery: 'per workspace', featured: true },
  { id: 'PC-07', offering: 'IVE Workspace — Enterprise', entryPrice: 'R10,000+/month', delivery: 'scoped' },
  { id: 'PC-08', offering: 'STUDI Research / Validation Study', entryPrice: 'R50,000–R150,000', delivery: 'scoped' },
  { id: 'PC-09', offering: 'Enterprise Verification Engagement', entryPrice: 'R100,000–R400,000', delivery: 'scoped' },
  { id: 'PC-10', offering: 'Water / Infrastructure Feasibility Study', entryPrice: 'R50,000–R150,000', delivery: 'scoped', tier: 'T2' },
  { id: 'PC-11', offering: 'Water Infrastructure Pilot', entryPrice: 'R250,000–R1,000,000', delivery: 'site/scoped', tier: 'T2' },
  { id: 'PC-12', offering: 'Bank/Fraud Pilot', entryPrice: 'R500,000–R2,000,000', delivery: 'integration-dependent', tier: 'T2' },
  { id: 'PC-13', offering: 'SEARM Enterprise Assessment', entryPrice: 'R150,000–R500,000+', delivery: 'scoped' },
  { id: 'PC-14', offering: 'Custom SEARM deployment', entryPrice: 'R500,000+', delivery: 'enterprise' },
  { id: 'PC-15', offering: 'Field Kit / methodology package', entryPrice: 'R5,000', delivery: 'one-off', tier: 'T3' },
  { id: 'PC-16', offering: 'Academic harness license', entryPrice: 'R5,000–R25,000', delivery: 'institution/license', tier: 'T3' },
] as const;

export const PRICE_CARD_CAVEAT =
  'Prices are offers/targets, not proof that a capability is already customer-production validated.';

// ── payment discipline (the operator's six rules) ───────────────────────────

export const PAYMENT_DISCIPLINE: readonly string[] = [
  '\u2264 R25k: payment before delivery or agreed short terms.',
  '> R25k: 50% upfront, 50% on defined acceptance.',
  'R50k+: signed SOW.',
  'Subscriptions: paid in advance.',
  'Custom enterprise: priced after discovery.',
  'No discounting the same scope. Reduce scope instead.',
] as const;

// ── the three field pitches — verbatim ──────────────────────────────────────

export interface Pitch {
  id: string;
  audience: string;
  text: string;
}

export const PITCHES: readonly Pitch[] = [
  {
    id: 'PITCH-SMALL',
    audience: 'Small business',
    text: 'We build systems that give organizations verifiable evidence of important decisions and operations. I can show you a working demonstration and identify one process where this could reduce your risk.',
  },
  {
    id: 'PITCH-FIN',
    audience: 'Financial / crypto organization',
    text: 'We can add a verification and evidence layer around screening decisions so you retain a tamper-evident record of what was decided, what evidence supported it, and when it happened.',
  },
  {
    id: 'PITCH-ENTERPRISE',
    audience: 'Enterprise / infrastructure organization',
    text: 'We operate verification and assurance environments for systems where you need to know not merely that something happened, but what evidence establishes that it happened.',
  },
] as const;

export const PITCH_RULE =
  'Then demonstrate. Do not lead with the architecture.';

export const PITCH_WARNING =
  'Do not walk into a business saying \u201cwe have 94 green things.\u201d Walk in with three sentences.';

// ── the role split — operator in the field, system as back office ───────────

export const ROLE_OPERATOR: readonly string[] = [
  'Find problems',
  'Find buyers',
  'Demonstrate',
  'Qualify',
  'Capture requirements',
  'Get meetings',
  'Close',
] as const;

export const ROLE_SYSTEM: readonly string[] = [
  'Monitor',
  'Verify',
  'Record',
  'Escalate',
  'Prepare delivery',
] as const;

export const ROLE_PRINCIPLE =
  'The system should progressively absorb operational work so that your scarce resource — you — stays focused on customers, partnerships, revenue, and strategic decisions.';

// ── OPS_SWEEP_30M — the consolidated operating sweep ────────────────────────

export type SweepDomainStatus = 'LIVE' | 'NOT_INSTRUMENTED';

export interface SweepDomain {
  /** 1–8, operator's numbering. */
  n: number;
  code: string;
  name: string;
  /** The operator's check list, verbatim. */
  checks: readonly string[];
  /** Whether this build can actually check it today. */
  status: SweepDomainStatus;
  /** What the /api/ops/sweep route really does for this domain. */
  liveMapping?: string;
  /** Honest reason when NOT_INSTRUMENTED. */
  notInstrumentedBecause?: string;
}

export const SWEEP_DOMAINS: readonly SweepDomain[] = [
  {
    n: 1,
    code: 'MCP',
    name: 'MCP',
    checks: ['pending operations', 'failed operations', 'stale operations', 'unauthorized changes', 'events awaiting verification'],
    status: 'LIVE',
    liveMapping: 'vault-bridge governance ledger :3004 — DH queue (events awaiting operator verification), revoked devIDs, rules wired 6/6',
  },
  {
    n: 2,
    code: 'PROD',
    name: 'Production / IVE',
    checks: ['health', 'errors', 'failed requests', 'authentication failures', 'unusual traffic', 'deployment drift', 'workspace availability'],
    status: 'LIVE',
    liveMapping: ':3000 integrity MATCH + :3003/:3004/:3005 health + receipts chain verify',
  },
  {
    n: 3,
    code: 'CUST',
    name: 'Customer / user activity',
    checks: ['new users', 'new sessions', 'failed onboarding', 'user-reported problems', 'abandoned workflows', 'support events'],
    status: 'NOT_INSTRUMENTED',
    notInstrumentedBecause: '0 paying customers, 0 users — nothing exists to monitor yet. First customer onboarding brings this domain live.',
  },
  {
    n: 4,
    code: 'SALES',
    name: 'Sales',
    checks: ['new inbound leads', 'email replies', 'contact-form submissions', 'proposal activity', 'meetings requested', 'follow-ups due'],
    status: 'NOT_INSTRUMENTED',
    notInstrumentedBecause: 'no inbound channel instrumented yet; the five Day-1 emails are DRAFT — NOT SENT (follow-ups due: none — nothing sent).',
  },
  {
    n: 5,
    code: 'COMM',
    name: 'Commercial',
    checks: ['unpaid invoices', 'proposals awaiting acceptance', 'pilots approaching start/end', 'subscription events', 'payment failures'],
    status: 'NOT_INSTRUMENTED',
    notInstrumentedBecause: 'no invoices issued, no subscriptions exist — 0 paying customers (honest count).',
  },
  {
    n: 6,
    code: 'SEC',
    name: 'Security',
    checks: ['suspicious authentication', 'credential events', 'unexpected repository activity', 'unexpected deployment', 'anomalous access'],
    status: 'LIVE',
    liveMapping: 'governance + receipts chain validity, integrity file-watch, revocation list replay',
  },
  {
    n: 7,
    code: 'EVID',
    name: 'Evidence',
    checks: ['receipts generated', 'verification failures', 'missing evidence', 'blocked operations', 'evidence requiring human attention'],
    status: 'LIVE',
    liveMapping: 'WORM ledger chain valid + receipt count + governance entries — every sweep run is itself WORM-receipted',
  },
  {
    n: 8,
    code: 'QUEUE',
    name: 'Action queue',
    checks: ['automatically resolve safe issues', 'create an MCP-pending event for consequential changes', 'escalate anything requiring you', 'never silently modify canonical state'],
    status: 'LIVE',
    liveMapping: 'derived from domains 1–7: safe=noted, consequential=MCP-pending, operator-required=escalated exception',
  },
] as const;

// ── exception-only notification formats (verbatim) ──────────────────────────

export interface ExceptionFormat {
  kind: 'GREEN' | 'ACTION REQUIRED' | 'SALES' | 'SECURITY' | 'MCP';
  text: string;
}

export const EXCEPTION_FORMATS: readonly ExceptionFormat[] = [
  { kind: 'GREEN', text: 'Nothing requires attention.' },
  { kind: 'ACTION REQUIRED', text: 'Customer X failed onboarding 3 times.' },
  { kind: 'SALES', text: 'New qualified lead: Company Y.' },
  { kind: 'SECURITY', text: 'Unexpected production authentication event.' },
  { kind: 'MCP', text: 'Operation OP-1842 pending verification.' },
] as const;

export const NOTIFICATION_POLICY =
  'Your phone should receive only exceptions. You should not get 48 noisy notifications a day saying \u201ceverything is fine.\u201d';

// ── the hard rule — automation authority ────────────────────────────────────

export const AUTOMATION_AUTHORITY =
  'Automation may observe, classify, notify, and execute pre-authorized safe actions. It does not silently invent authority.';

export const AUTOMATION_TAIL =
  'For consequential changes, it goes through the MCP-pending path. That is the difference between automation that helps the founder and automation that quietly becomes an uncontrolled second company.';

// ── the scheduling constraint (operator-stated, honest) ────────────────────

export const SCHEDULING_CONSTRAINT =
  'The scheduling system available to the operator supports daily/weekly/monthly recurrence only — not a true 30-minute cadence. No pretend automation is created. The sweep is manually runnable from this view, and the spec is stored ready for the operator\u2019s own cron/MCP infrastructure.';

export const SWEEP_CADENCE = 'every 30 minutes · one consolidated sweep · never dozens of separate jobs';

// ── consent — no money without recorded consent ─────────────────────────────

export const CONSENT_RULE =
  'No money is taken without recorded consent from the customer.';

export const CONSENT_RECORD_FIELDS: readonly string[] = [
  'customer identity (registered name + contact)',
  'offer reference (price card row id)',
  'price + payment terms as presented',
  'explicit consent statement (what the customer agreed to)',
  'consent method (signed SOW / written confirmation / recorded acceptance)',
  'timestamp (UTC) + operator who took it',
  'SOW reference when \u2265 R50k (mandatory)',
  'WORM receipt id for the consent event itself',
] as const;

export const CONSENT_STATUS =
  'SPEC DEFINED — awaiting first real use. No payments exist yet; when the first customer consents, the consent event is WORM-receipted before any money moves.';

// ── price card transition — from the Task 44 tiers to the formal menu ────────

export const PRICE_CARD_TRANSITION: readonly string[] = [
  'PRICE CARD v2 is the canonical commercial menu from 2026-09-16 (Day 1).',
  'It supersedes the Task 44 tier pricing as the reference; the sales ledger and the five email drafts remain valid.',
  'The five Day-1 email drafts quote R15k discovery / R50k pilot / R5k-month monitoring — these reconcile exactly with PC-01/02/03. No re-quote required.',
  'New in v2: usage lines (R350/address/month, R250/screen), IVE Workspace lines, study/engagement lines, SEARM lines, and the academic license.',
  'Every quote issued from Day 1 forward cites the price card row id (PC-01…PC-16) so commercial records trace to one menu.',
] as const;

// ── B2B integration + pilot readiness (the weekend plan) ─────────────────────

export interface PilotPlay {
  id: string;
  name: string;
  priceRow: string;
  readiness: readonly string[];
}

export const PILOT_PLAYS: readonly PilotPlay[] = [
  {
    id: 'PILOT-CRYPTO',
    name: 'Crypto exchange detection pilot',
    priceRow: 'PC-01 \u2192 PC-02 \u2192 PC-03 (+PC-04/05 usage)',
    readiness: [
      'SOW signed (R50k: 50% upfront) + consent record WORM-receipted',
      'customer compliance lead named; 10 addresses + screening allowance agreed',
      'receipt delivery format agreed (SHA-256 receipt per screen; third-party verification path)',
      '6-week schedule: week 1 discovery \u2192 weeks 2–5 monitoring \u2192 week 6 evidence report',
      'exit criteria: evidence report delivered, monitoring decision (continue/cancel), no lock-in',
    ],
  },
  {
    id: 'PILOT-BANK',
    name: 'Bank / fraud sequence-anomaly pilot',
    priceRow: 'PC-12 (R500k–R2M, integration-dependent)',
    readiness: [
      'warm intro secured (fraud team, not procurement cold-call)',
      'harness JSON + one-page summary delivered under NDA',
      'discovery scoping: integration surface, data room, security review, test environment',
      'success criteria defined in the SOW (sequence-anomaly detection on their pipeline)',
      'evidence layer demo: receipt per screening decision — the differentiator',
    ],
  },
  {
    id: 'PILOT-IVE',
    name: 'IVE Workspace deployment',
    priceRow: 'PC-06 professional / PC-07 enterprise',
    readiness: [
      'workspace provisioning per customer (per-workspace pricing)',
      'onboarding + training session (the M0 posture: operator inspects evidence, never trusts screens)',
      'subscription paid in advance (payment discipline rule 4)',
      'support + complaints channel live before handover (see compliance pack)',
    ],
  },
  {
    id: 'PILOT-WATER',
    name: 'Water infrastructure feasibility',
    priceRow: 'PC-10 study \u2192 PC-11 pilot',
    readiness: [
      'municipality named + stakeholder map (NMBM / Cape Town / Johannesburg Water)',
      'feasibility scope: R50k–R150k, data sources, site access',
      'study sells first — sensor network is the pilot\u2019s problem, not the study\u2019s',
      'municipal procurement path identified (CSD registration feeds this)',
    ],
  },
] as const;

export const B2B_TARGET_WINDOW =
  'B2B integration + pilot readiness planned for the weekend: the four pilot plays above are the checklists; each opens with consent + SOW, never before.';

// ── the compliance pack — DRAFT — REVIEW REQUIRED ──────────────────────────

export interface ComplianceDoc {
  id: string;
  name: string;
  path: string;
  purpose: string;
  status: 'DRAFT — REVIEW REQUIRED';
}

export const COMPLIANCE_PACK: readonly ComplianceDoc[] = [
  {
    id: 'TOS',
    name: 'Terms of Service',
    path: 'ProofBridge/compliance/TERMS-OF-SERVICE.md',
    purpose: 'Master terms + per-offering schedules for all 16 price-card lines (consent-before-payment, payment discipline, POPIA, disputes).',
    status: 'DRAFT — REVIEW REQUIRED',
  },
  {
    id: 'COMPLAINTS',
    name: 'Complaints Procedure',
    path: 'ProofBridge/compliance/COMPLAINTS-PROCEDURE.md',
    purpose: 'Intake, acknowledgment SLA, escalation ladder, resolution timelines, WORM-recorded complaint events.',
    status: 'DRAFT — REVIEW REQUIRED',
  },
  {
    id: 'CONSENT',
    name: 'Consent Record Spec',
    path: 'ProofBridge/compliance/CONSENT-RECORD-SPEC.md',
    purpose: 'The no-money-without-consent artifact: fields, WORM receipt linkage, SOW gate at R50k+.',
    status: 'DRAFT — REVIEW REQUIRED',
  },
  {
    id: 'B2B',
    name: 'B2B Pilot Integration',
    path: 'ProofBridge/compliance/B2B-PILOT-INTEGRATION.md',
    purpose: 'The four pilot plays with readiness checklists, integration gates, and exit criteria.',
    status: 'DRAFT — REVIEW REQUIRED',
  },
] as const;

export const COMPLIANCE_PACK_NOTE =
  'None of this is legal advice and none of it is claimed operational until the lawyer signs off (manifest L7 — regulatory file review pending). The drafts exist so review has something to review.';

// ── derived totals ──────────────────────────────────────────────────────────

export interface OpsTotals {
  priceRows: number;
  paymentRules: number;
  pitches: number;
  sweepDomains: number;
  sweepLive: number;
  sweepNotInstrumented: number;
  exceptionFormats: number;
  pilotPlays: number;
  complianceDocs: number;
  consentFields: number;
}

export function opsTotals(): OpsTotals {
  return {
    priceRows: PRICE_CARD.length,
    paymentRules: PAYMENT_DISCIPLINE.length,
    pitches: PITCHES.length,
    sweepDomains: SWEEP_DOMAINS.length,
    sweepLive: SWEEP_DOMAINS.filter((d) => d.status === 'LIVE').length,
    sweepNotInstrumented: SWEEP_DOMAINS.filter((d) => d.status === 'NOT_INSTRUMENTED').length,
    exceptionFormats: EXCEPTION_FORMATS.length,
    pilotPlays: PILOT_PLAYS.length,
    complianceDocs: COMPLIANCE_PACK.length,
    consentFields: CONSENT_RECORD_FIELDS.length,
  };
}
