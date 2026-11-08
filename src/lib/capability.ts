// src/lib/capability.ts — Round 22 CAPABILITY DOSSIER pure module.
// Mirrors the lead-scoring.ts / holocom.ts posture: NO side effects, NO
// server-only imports — importable from both the API route and the client.
// The server route supplies live facts; this module supplies the vocabulary,
// the honest provenance table, the statement composition and the draft
// requests. Composition happens wherever it is invoked; the API route is the
// authoritative path (client-composed markdown is never trusted on write).
//
// Context: an external procurement assistant asked three blocking capability
// questions — (1) is "VVU AIR KERNEL" running on real SCADA data anywhere?
// (2) is "Vivid" a separate company or a voice-to-text error? (3) which
// province is the entity registered in? The dashboard holds the system truth
// for (1), the canonical answer for (2), and a persisted operator profile
// for (3) plus the SA registration facts that gate the requested drafts.

import type {
  BbbeeOption,
  CapabilityFacts,
  CapabilityProfile,
  PilotDeclaration,
  SaProvince,
} from '@/types/vvu';

/** Structural profile input — accepts CapabilityProfile or the client form
 *  state (both are shape-compatible apart from the server-only updatedAt). */
export type CapabilityProfileInput = Omit<CapabilityProfile, 'updatedAt'>;

// ─── Vocabulary (validated server-side against these exact lists) ───────────

export const SA_PROVINCES: readonly SaProvince[] = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Northern Cape',
  'Western Cape',
] as const;

export const BBEEE_OPTIONS: readonly BbbeeOption[] = [
  'EME',
  'QSE',
  'LEVEL_1',
  'LEVEL_2',
  'LEVEL_3',
  'LEVEL_4',
  'LEVEL_5',
  'LEVEL_6',
  'LEVEL_7',
  'LEVEL_8',
  'GENERIC',
  'NOT_RATED',
] as const;

export const BBEEE_LABELS: Record<BbbeeOption, string> = {
  EME: 'EME · Exempt Micro Enterprise (auto Level 1–4 by turnover)',
  QSE: 'QSE · Qualifying Small Enterprise',
  LEVEL_1: 'Level 1 contributor (≥100 points)',
  LEVEL_2: 'Level 2 contributor (85–99.9 points)',
  LEVEL_3: 'Level 3 contributor (70–84.9 points)',
  LEVEL_4: 'Level 4 contributor (55–69.9 points)',
  LEVEL_5: 'Level 5 contributor (45–54.9 points)',
  LEVEL_6: 'Level 6 contributor (40–44.9 points)',
  LEVEL_7: 'Level 7 contributor (30–39.9 points)',
  LEVEL_8: 'Non-compliant contributor (below 30 points)',
  GENERIC: 'Generic scorecard entity',
  NOT_RATED: 'Not yet rated / sworn affidavit pending',
};

export const PILOT_DECLARATIONS: readonly PilotDeclaration[] = [
  'SIMULATION_ONLY',
  'SEEKING_PILOT',
  'PILOT_DEPLOYED',
] as const;

export const PILOT_DECLARATION_LABELS: Record<PilotDeclaration, string> = {
  SIMULATION_ONLY: 'Simulation only — no live deployment, not yet pitching',
  SEEKING_PILOT: 'Simulation-validated — actively seeking the first live pilot',
  PILOT_DEPLOYED: 'A live pilot deployment exists (describe it in notes)',
};

/** The profile served before the operator ever saves anything. Honest defaults. */
export const DEFAULT_PROFILE: CapabilityProfile = {
  entityName: '',
  tradingAs: '',
  vividIsTranscription: true,
  province: null,
  csdRegistered: false,
  sitaRegistered: false,
  provincialRegistered: false,
  vatRegistered: false,
  bbbeeLevel: null,
  contactEmail: null,
  contactPhone: null,
  pilotDeclaration: 'SIMULATION_ONLY',
  notes: null,
  updatedAt: '1970-01-01T00:00:00.000Z',
};

// ─── Honest provenance — what is real and what is simulated, per view ───────
// This table is the answer to "is anything running on real SCADA data?":
// NO. It is deliberately static vocabulary (not a per-request computation)
// because the stack has no SCADA ingestion path at all — there is no code
// that could connect a real feed. If that ever changes, this table and the
// scadaLive fact change together in one commit.

export const PROVENANCE_TABLE: Readonly<CapabilityFacts['provenance']> = [
  {
    view: 'SPATIAL_INTELLIGENCE',
    hash: '#/',
    data: 'GIS twin · node telemetry · FSM leak/thermal simulation',
    provenance: 'SIMULATED',
    note: 'Gqeberha edge node is a socket.io simulator (:3003) — flows, pressures, acoustics are synthetic walkers',
  },
  {
    view: 'ANALYTICS',
    hash: '#/analytics',
    data: 'Trust Gates · MOI voting · MRR · B-BBEE · WORM ledger',
    provenance: 'MIXED',
    note: 'WORM ledger, audit trail and compliance scenarios are REAL app records; the MRR/revenue trajectory is the business-clock simulation',
  },
  {
    view: 'SEQUENCE ENGINE',
    hash: '#/outreach',
    data: 'Outreach targets · cadences · email drafts',
    provenance: 'REAL',
    note: 'Operator-entered CRM data, POPIA s69 consent-gated; sends are DRY_RUN unless a Resend key is configured (it is not)',
  },
  {
    view: 'HOLOCOM',
    hash: '#/holocom',
    data: '6G split-computing KPIs · MOS · discovery · broker',
    provenance: 'SIMULATED',
    note: 'Mean-reverting synthetic walkers for latency/jitter/loss — a research-projection module, not a deployment',
  },
  {
    view: 'CAPABILITY DOSSIER',
    hash: '#/capability',
    data: 'System facts (server-computed) · operator profile',
    provenance: 'REAL',
    note: 'Service probes, WORM chain verification and the profile are real; every SIMULATED row above is disclosed here by design',
  },
] as const;

// ─── Statement composition ───────────────────────────────────────────────────

const yn = (b: boolean): 'YES' | 'NO' => (b ? 'YES' : 'NO');

function pilotNarrative(p: CapabilityProfileInput): string {
  if (p.pilotDeclaration === 'PILOT_DEPLOYED') {
    return p.notes?.trim()
      ? `A live pilot deployment is declared by the operator: ${p.notes.trim()}`
      : 'A live pilot deployment is declared by the operator (see notes in the Capability Dossier).';
  }
  if (p.pilotDeclaration === 'SEEKING_PILOT') {
    return 'Operator declaration: simulation-validated and actively seeking the first live SCADA pilot (municipal / water board / DWS–SANWRIA programme). A supervised pilot on one reservoir zone would be the first real-data deployment.';
  }
  return 'Operator declaration: simulation only — no live deployment is claimed and none exists. The correct procurement track is pilot acquisition, not a pilot-ready pitch.';
}

/** The full capability statement — composed from the stored profile + live facts. */
export function composeCapabilityStatement(p: CapabilityProfileInput, f: CapabilityFacts): string {
  const entity = p.entityName.trim() || '(not yet recorded — complete the Capability Dossier profile)';
  const trading = p.tradingAs.trim() || '—';
  const province = p.province ?? '(not yet recorded — complete the Capability Dossier profile)';
  const contact = [p.contactEmail?.trim(), p.contactPhone?.trim()].filter(Boolean).join(' · ') || '—';
  const bbbee = p.bbbeeLevel ? BBEEE_LABELS[p.bbbeeLevel] : 'not rated / not yet recorded';
  const worm = f.worm;
  const live = (k: CapabilityFacts['services'][number]['key']): string => {
    const s = f.services.find((x) => x.key === k);
    return s ? (s.live ? 'LIVE' : 'DOWN') : 'UNKNOWN';
  };
  const vividLine = p.vividIsTranscription
    ? '"Vivid" is a **voice-to-text rendering of "VVU"** (Venture Vision Ubuntu) — not a separate company, not a separate product.'
    : '"Vivid" is recorded by the operator as a distinct entity — see the Capability Dossier profile for what it is.';

  return `# VVU Capability Statement

_Generated ${f.generatedAt} by the VVU Validation Dashboard · evidence WORM-logged_

## 1 · Pilot status — SIMULATION ONLY

**No — VVU AIR KERNEL is not running on real SCADA data.** No municipal, farm or
mine deployment exists. All runtime data is simulated:

- **Telemetry** — simulated Gqeberha edge node (socket.io simulator, port 3003); ${f.counts.telemetry.toLocaleString('en-ZA')} frames logged, every one synthetic
- **Hydraulic domain** — deterministic Hazen–Williams water-network model (synthetic physics, seeded)
- **Fraud domain** — seeded behavioural test harness (a synthetic reference specimen, by design)

${pilotNarrative(p)}

**→ Correct track: the pilot acquisition strategy, not the pilot-ready pitch.**

## 2 · Entity clarification

${vividLine}

- Registered entity: ${entity}
- Trading as: ${trading}
- Contact: ${contact}

## 3 · Location & registration

- Province: ${province}
- CSD (Central Supplier Database): ${yn(p.csdRegistered)}${p.csdRegistered ? '' : ' — registration pending, csd.csd.gov.za'}
- SITA vendor registration: ${yn(p.sitaRegistered)}
- Provincial vendor database: ${yn(p.provincialRegistered)}
- VAT registered: ${yn(p.vatRegistered)}
- B-BBEE: ${bbbee}

## What VVU actually is (honest tech summary)

A water-infrastructure intelligence console with a verification-first architecture:

- **GIS / telemetry twin** of a water reticulation network with invariant checking (flows, pressure heads, acoustics, leak FSM)
- **WORM evidence ledger** — SHA-256 hash-chained, append-only, independently re-verifiable: ${worm.count.toLocaleString('en-ZA')} records, chain ${worm.chainValid ? 'VALID' : 'BROKEN'}, tip \`${(worm.lastHash ?? '').slice(0, 16)}…\`
- **Cross-domain verification substrate** — two independent domains (behavioural-fraud analytics + hydraulic network physics) adjudicated by one shared band-language engine, each run sealed with its own evidence chain (Gates A–D discipline: reference specimen, extraction fidelity, second domain, mechanical purity)
- **POPIA-gated outreach engine** — consent-enforced CRM with cadences, dry-run sending and audit-logged actions
- **Data provenance is disclosed per module** — see the Capability Dossier; no live SCADA ingestion path exists anywhere in the stack

## Evidence (live at generation time)

- Dashboard service :3000 — ${live('dashboard')}
- Telemetry simulator :3003 — ${live('telemetry')}
- Gateway :81 — ${live('gateway')}
- WORM ledger — ${worm.count.toLocaleString('en-ZA')} records, chain ${worm.chainValid ? 'VALID' : 'BROKEN'}
- Statement generation itself is appended to the WORM ledger (seq on the generation receipt)

## Suggested next drafts

1. **Pilot acquisition strategy** — VVU is simulation-only: which municipal water services, water boards and DWS/SANWRIA programmes to approach for a first supervised SCADA pilot, the entry offer, and the proof obligations the pilot must satisfy.
2. **Prime-subcontractor one-pager** — VVU as niche verification/evidence tooling under an established prime (B-BBEE: ${p.bbbeeLevel ?? 'not rated'}).
3. **Registration checklist** — CSD ${p.csdRegistered ? 'done' : 'pending'} · SITA ${p.sitaRegistered ? 'done' : 'pending'} · ${province === '(not yet recorded — complete the Capability Dossier profile)' ? 'provincial list (province pending)' : `${province} provincial vendor database ${p.provincialRegistered ? 'done' : 'pending'}`}.
`;
}

// ─── Draft requests (targeted copy-paste prompts for the procurement AI) ────

export interface DraftRequest {
  id: 'pilot-acquisition' | 'prime-one-pager' | 'registration-checklist';
  title: string;
  /** ready when every fact this draft needs is present in the profile */
  ready: boolean;
  blockers: string[];
  prompt: string;
}

export function composeDraftRequests(p: CapabilityProfileInput): DraftRequest[] {
  const entity = p.entityName.trim();
  const province = p.province;
  const bbbee = p.bbbeeLevel ?? 'not rated';

  const pilot: DraftRequest = {
    id: 'pilot-acquisition',
    title: 'Pilot acquisition strategy',
    ready: true,
    blockers: [],
    prompt:
      'Fact check for the drafts you offered: (1) Pilot status — VVU AIR KERNEL is SIMULATION ONLY; no real SCADA deployment exists (no municipality, farm or mine). (2) "Vivid" is a voice-to-text error for "VVU" — Venture Vision Ubuntu, not a separate company. (3) Location — I will confirm the registration province separately if you need it for the checklist. Please draft the PILOT ACQUISITION STRATEGY: target list (municipal water services authorities, water boards, DWS/SANWRIA programmes), the entry offer (a supervised 90-day pilot on one reservoir zone), and the proof obligations the pilot must satisfy before any scale-up claim.',
  };

  const onePager: DraftRequest = {
    id: 'prime-one-pager',
    title: 'Prime-subcontractor one-pager',
    ready: entity.length > 0,
    blockers: entity.length > 0 ? [] : ['Record the registered entity name in the profile (§3)'],
    prompt:
      'Draft the prime-subcontractor one-pager. Supplier: ' +
      (entity || '(entity name pending — I will send it)') +
      (p.tradingAs.trim() ? `, trading as ${p.tradingAs.trim()}` : '') +
      `, B-BBEE ${bbbee}` +
      (province ? `, ${province}` : '') +
      '. Niche: water-infrastructure monitoring and verification tooling — hash-chained (WORM) evidence, cross-domain validation substrate (fraud analytics + hydraulic physics through one adjudication engine), POPIA-compliant outreach. Position: niche evidence/verification subcontractor under an established prime on municipal and DWS/SANWRIA water programmes; simulation-validated, first live pilot pending.',
  };

  const checklist: DraftRequest = {
    id: 'registration-checklist',
    title: 'Registration checklist (CSD · SITA · provincial)',
    ready: province !== null,
    blockers: province !== null ? [] : ['Select the registration province in the profile (§3)'],
    prompt:
      'Draft the exact registration checklist for ' +
      (province ?? '(province pending — I will confirm)') +
      ': CSD registration (csd.csd.gov.za — documents, bank confirmation, tax status), SITA vendor registration (sita.co.za — where relevant for ICT services), the ' +
      (province ?? '(province)') +
      ' provincial supplier database, and anything sector-specific for water-services procurement. Current state: CSD ' +
      (p.csdRegistered ? 'registered' : 'NOT registered') +
      ' · SITA ' +
      (p.sitaRegistered ? 'registered' : 'NOT registered') +
      ' · provincial database ' +
      (p.provincialRegistered ? 'registered' : 'NOT registered') +
      '.',
  };

  return [pilot, onePager, checklist];
}

/** Profile completeness (0–100) — drives the Dossier's readiness meter. */
export function profileCompleteness(p: CapabilityProfileInput): { pct: number; missing: string[] } {
  const scored: Array<[string, boolean]> = [
    ['entity name', p.entityName.trim().length > 0],
    ['province', p.province !== null],
    ['B-BBEE level', p.bbbeeLevel !== null],
    ['contact email', Boolean(p.contactEmail?.trim())],
    ['contact phone', Boolean(p.contactPhone?.trim())],
  ];
  const missing = scored.filter(([, ok]) => !ok).map(([k]) => k);
  const pct = Math.round(((scored.length - missing.length) / scored.length) * 100);
  return { pct, missing };
}
