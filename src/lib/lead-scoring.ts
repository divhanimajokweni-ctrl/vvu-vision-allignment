// src/lib/lead-scoring.ts — Round 18 · ICP / LEAD-SCORING framework.
//
// Target-selection strategy from the outreach plan: an explicit scoring
// rubric decides WHO is worth a pilot slot before any cadence fires.
// PURE MODULE — no server-only imports (no z-ai-web-dev-sdk), so the SAME
// rules are used by the API routes (authoritative, recomputed on every
// write) and by the client (live score preview in the dialogs). The stored
// score/tier on OutreachTarget is always the server's word.
//
// Rubric (6 factors, framework-faithful):
//   REVENUE > R100M ................ +20
//   B-BBEE LEVEL 6+ ................ +15
//   50+ SUPPLIERS .................. +10
//   RECENT AUDIT FAILURE ........... +25
//   POPIA NON-COMPLIANCE HISTORY ... +20
//   GOVERNMENT CONTRACTS ........... +15
//   PRIORITY threshold ............. ≥ 50 (max 105)
// Tiers: ≥50 PRIORITY · 25–49 QUALIFIED · <25 LONG_SHOT · no profile at all
// UNSCORED (the lead-scoring framework's "Minimum 50" gate).

// ─── Sectors ────────────────────────────────────────────────────────────────

export const ICP_SECTORS = [
  'MINING',
  'CONSTRUCTION',
  'FINANCIAL',
  'GOV',
  'MUNICIPAL',
  'WATER',
  'INDUSTRIAL',
  'OTHER',
] as const;
export type IcpSector = (typeof ICP_SECTORS)[number];

/** Framework ICP core (Mining, Construction, Financial, Gov contractors)
 *  + VVU's water-infrastructure home turf (Municipal, Water). */
export const ICP_CORE: readonly IcpSector[] = ['MINING', 'CONSTRUCTION', 'FINANCIAL', 'GOV', 'MUNICIPAL', 'WATER'];

/** Human-readable sector labels (UI display only). */
export const SECTOR_LABEL: Record<IcpSector, string> = {
  MINING: 'MINING & RESOURCES',
  CONSTRUCTION: 'CONSTRUCTION & ENGINEERING',
  FINANCIAL: 'FINANCIAL SERVICES',
  GOV: 'GOVERNMENT CONTRACTOR',
  MUNICIPAL: 'MUNICIPAL / WATER BOARD',
  WATER: 'WATER UTILITY',
  INDUSTRIAL: 'INDUSTRIAL',
  OTHER: 'OTHER',
};

// ─── Scoring rubric ─────────────────────────────────────────────────────────

export const SCORE_RULES = [
  { key: 'revenue', label: 'REVENUE > R100M', points: 20, hint: 'annual revenue in R millions' },
  { key: 'bbbee', label: 'B-BBEE LEVEL 6+', points: 15, hint: 'needs improvement — verification pain' },
  { key: 'suppliers', label: '50+ SUPPLIERS', points: 10, hint: 'multi-tier supplier chain' },
  { key: 'audit', label: 'RECENT AUDIT FAILURE', points: 25, hint: 'past 12 months' },
  { key: 'popia', label: 'POPIA NON-COMPLIANCE HISTORY', points: 20, hint: 'documented exposure' },
  { key: 'gov', label: 'GOVERNMENT CONTRACTS', points: 15, hint: 'procurement recognition matters' },
] as const;
export type ScoreRuleKey = (typeof SCORE_RULES)[number]['key'];

export const PRIORITY_THRESHOLD = 50;
export const QUALIFIED_THRESHOLD = 25;
export const SCORE_MAX = SCORE_RULES.reduce((sum, r) => sum + r.points, 0); // 105

export type LeadTier = 'PRIORITY' | 'QUALIFIED' | 'LONG_SHOT' | 'UNSCORED';

export const TIER_TONE: Record<LeadTier, 'lime' | 'sage' | 'ochre' | 'dim'> = {
  PRIORITY: 'lime',
  QUALIFIED: 'sage',
  LONG_SHOT: 'ochre',
  UNSCORED: 'dim',
};

// ─── ICP company profile (fit display, not scored) ──────────────────────────

export const ICP_REVENUE_BAND = { min: 50, max: 500 } as const; // R millions
export const ICP_EMPLOYEE_BAND = { min: 100, max: 1000 } as const;
export const ICP_BBEEE_BAND = { min: 4, max: 8 } as const;

// ─── Scoring ────────────────────────────────────────────────────────────────

export interface LeadProfile {
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
}

export interface ScoreBreakdownItem {
  key: ScoreRuleKey;
  label: string;
  points: number;
  hit: boolean;
  /** human-readable evidence string for the hit */
  detail: string;
}

export interface ScoreResult {
  score: number;
  tier: LeadTier;
  breakdown: ScoreBreakdownItem[];
  icpSector: boolean;
  icpFit: boolean;
}

/** True when the operator entered no profile at all (all null / all false). */
export function isUnscored(p: LeadProfile): boolean {
  return (
    p.sector === null &&
    p.annualRevenue === null &&
    p.employees === null &&
    p.bbbeeLevel === null &&
    p.supplierCount === null &&
    !p.auditFail12m &&
    !p.popiaRisk &&
    !p.govContracts
  );
}

function ruleHits(p: LeadProfile): Record<ScoreRuleKey, { hit: boolean; detail: string }> {
  const revenue = p.annualRevenue ?? 0;
  const bbbee = p.bbbeeLevel ?? 0;
  const suppliers = p.supplierCount ?? 0;
  return {
    revenue: { hit: p.annualRevenue !== null && revenue > 100, detail: p.annualRevenue !== null ? `R${revenue}M` : '—' },
    bbbee: { hit: p.bbbeeLevel !== null && bbbee >= 6, detail: p.bbbeeLevel !== null ? `LEVEL ${bbbee}` : '—' },
    suppliers: { hit: p.supplierCount !== null && suppliers >= 50, detail: p.supplierCount !== null ? `${suppliers} SUPPLIERS` : '—' },
    audit: { hit: p.auditFail12m, detail: p.auditFail12m ? 'FAILED AUDIT ≤12M' : '—' },
    popia: { hit: p.popiaRisk, detail: p.popiaRisk ? 'DOCUMENTED EXPOSURE' : '—' },
    gov: { hit: p.govContracts, detail: p.govContracts ? 'ACTIVE GOV WORK' : '—' },
  };
}

/** The single scoring entry point — server-authoritative, client-previewed. */
export function scoreLead(p: LeadProfile): ScoreResult {
  const hits = ruleHits(p);
  const breakdown: ScoreBreakdownItem[] = SCORE_RULES.map((r) => ({
    key: r.key,
    label: r.label,
    points: r.points,
    hit: hits[r.key].hit,
    detail: hits[r.key].detail,
  }));
  const score = breakdown.reduce((sum, b) => sum + (b.hit ? b.points : 0), 0);
  const tier: LeadTier = isUnscored(p)
    ? 'UNSCORED'
    : score >= PRIORITY_THRESHOLD
      ? 'PRIORITY'
      : score >= QUALIFIED_THRESHOLD
        ? 'QUALIFIED'
        : 'LONG_SHOT';

  const icpSector = p.sector !== null && (ICP_CORE as readonly string[]).includes(p.sector);
  const inBand = (v: number | null, b: { min: number; max: number }): boolean => v !== null && v >= b.min && v <= b.max;
  const icpFit =
    icpSector &&
    inBand(p.annualRevenue, ICP_REVENUE_BAND) &&
    inBand(p.employees, ICP_EMPLOYEE_BAND) &&
    inBand(p.bbbeeLevel, ICP_BBEEE_BAND);

  return { score, tier, breakdown, icpSector, icpFit };
}

// ─── Input parsing helpers (API-side) ───────────────────────────────────────

/** Coerce an unknown JSON value to a bounded int or null. */
export function toIntOrNull(v: unknown, min: number, max: number): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.round(n);
  return i < min || i > max ? null : i;
}

/** Coerce an unknown JSON value to a boolean (strict-ish: 'true'/true/1/'yes'). */
export function toBoolOrFalse(v: unknown): boolean {
  if (v === true) return true;
  if (typeof v === 'string') return ['true', '1', 'yes', 'y'].includes(v.trim().toLowerCase());
  if (typeof v === 'number') return v === 1;
  return false;
}

/** Normalise a sector string to a valid IcpSector or null. */
export function toSectorOrNull(v: unknown): IcpSector | null {
  if (typeof v !== 'string') return null;
  const key = v.trim().toUpperCase().replace(/[\s&-]+/g, '_');
  const alias: Record<string, IcpSector> = {
    MINING: 'MINING',
    MINING_RESOURCES: 'MINING',
    RESOURCES: 'MINING',
    CONSTRUCTION: 'CONSTRUCTION',
    CONSTRUCTION_ENGINEERING: 'CONSTRUCTION',
    ENGINEERING: 'CONSTRUCTION',
    FINANCIAL: 'FINANCIAL',
    FINANCIAL_SERVICES: 'FINANCIAL',
    FINANCE: 'FINANCIAL',
    GOV: 'GOV',
    GOVERNMENT: 'GOV',
    GOVERNMENT_CONTRACTOR: 'GOV',
    GOV_CONTRACTOR: 'GOV',
    MUNICIPAL: 'MUNICIPAL',
    MUNICIPALITY: 'MUNICIPAL',
    WATER: 'WATER',
    WATER_UTILITY: 'WATER',
    UTILITY: 'WATER',
    INDUSTRIAL: 'INDUSTRIAL',
    OTHER: 'OTHER',
  };
  return alias[key] ?? null;
}
