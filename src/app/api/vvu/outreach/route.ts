import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appendWormEvent } from '@/lib/vvu-ledger';
import { OUTREACH_ASSET_BASE, OUTREACH_FROM } from '@/lib/outreach-template';
import { ALL_STATUSES } from '@/lib/outreach-engine';
import {
  ICP_CORE,
  ICP_EMPLOYEE_BAND,
  ICP_REVENUE_BAND,
  ICP_BBEEE_BAND,
  ICP_SECTORS,
  PRIORITY_THRESHOLD,
  QUALIFIED_THRESHOLD,
  SCORE_MAX,
  SCORE_RULES,
  isUnscored,
  scoreLead,
  toBoolOrFalse,
  toIntOrNull,
  toSectorOrNull,
} from '@/lib/lead-scoring';
import { OUTREACH_TENANT_ID } from '@/lib/vvu-data';
import type { ConsentBasis, OutreachEmail, OutreachTarget, ScoringMeta } from '@/types/vvu';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Task 14-a — REAL pilot outreach engine (NOT the MrrPanel sim counters).
// Compliance posture: RESEND_API_KEY is read from env ONLY and never logged
// or echoed — the API surfaces resendConfigured as a BOOLEAN. With no key
// configured (this sandbox, by design) only DRY-RUN previews are possible
// (see send/route.ts, which 501s real sends).

const CONSENT_BASES: ConsentBasis[] = ['OPT_IN', 'EXISTING_CUSTOMER', 'NONE'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function isValidEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_RE.test(email);
}

/** Round 18 — the live rubric served with every GET (single source of truth:
 *  src/lib/lead-scoring.ts — the UI never hand-copies the matrix). */
const SCORING_META: ScoringMeta = {
  rules: SCORE_RULES.map((r) => ({ key: r.key, label: r.label, points: r.points, hint: r.hint })),
  priorityThreshold: PRIORITY_THRESHOLD,
  qualifiedThreshold: QUALIFIED_THRESHOLD,
  scoreMax: SCORE_MAX,
  sectors: [...ICP_SECTORS],
  icpCore: [...ICP_CORE],
  revenueBand: { min: ICP_REVENUE_BAND.min, max: ICP_REVENUE_BAND.max },
  employeeBand: { min: ICP_EMPLOYEE_BAND.min, max: ICP_EMPLOYEE_BAND.max },
  bbbeeBand: { min: ICP_BBEEE_BAND.min, max: ICP_BBEEE_BAND.max },
};

/** Parse the ICP profile fields off an unknown JSON body into a LeadProfile
 *  (nulls preserved — UNSCORED is a valid state, not a zero). */
function parseProfile(body: Record<string, unknown>) {
  return {
    sector: body.sector !== undefined ? toSectorOrNull(body.sector) : undefined,
    annualRevenue: body.annualRevenue !== undefined ? toIntOrNull(body.annualRevenue, 1, 100_000) : undefined,
    employees: body.employees !== undefined ? toIntOrNull(body.employees, 1, 500_000) : undefined,
    bbbeeLevel: body.bbbeeLevel !== undefined ? toIntOrNull(body.bbbeeLevel, 1, 8) : undefined,
    supplierCount: body.supplierCount !== undefined ? toIntOrNull(body.supplierCount, 0, 100_000) : undefined,
    auditFail12m: body.auditFail12m !== undefined ? toBoolOrFalse(body.auditFail12m) : undefined,
    popiaRisk: body.popiaRisk !== undefined ? toBoolOrFalse(body.popiaRisk) : undefined,
    govContracts: body.govContracts !== undefined ? toBoolOrFalse(body.govContracts) : undefined,
  };
}

function serializeTarget(t: {
  id: string;
  tenantId: string;
  org: string;
  contactName: string;
  email: string;
  criticalIssue: string | null;
  consentBasis: string;
  status: string;
  sequenceId: string | null;
  currentStep: number;
  sector: string | null;
  annualRevenue: number | null;
  employees: number | null;
  bbbeeLevel: number | null;
  supplierCount: number | null;
  auditFail12m: boolean;
  popiaRisk: boolean;
  govContracts: boolean;
  score: number;
  tier: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): OutreachTarget {
  return {
    id: t.id,
    tenantId: t.tenantId,
    org: t.org,
    contactName: t.contactName,
    email: t.email,
    criticalIssue: t.criticalIssue,
    consentBasis: (CONSENT_BASES as string[]).includes(t.consentBasis) ? (t.consentBasis as ConsentBasis) : 'NONE',
    status: t.status,
    sequenceId: t.sequenceId,
    currentStep: t.currentStep,
    sector: t.sector,
    annualRevenue: t.annualRevenue,
    employees: t.employees,
    bbbeeLevel: t.bbbeeLevel,
    supplierCount: t.supplierCount,
    auditFail12m: t.auditFail12m,
    popiaRisk: t.popiaRisk,
    govContracts: t.govContracts,
    score: t.score,
    tier: t.tier,
    notes: t.notes,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

function serializeEmail(e: {
  id: string;
  targetId: string;
  subject: string;
  status: string;
  resendId: string | null;
  error: string | null;
  wormSeq: number | null;
  stepIndex: number | null;
  aiGenerated: boolean;
  sentAt: Date | null;
  createdAt: Date;
}): OutreachEmail {
  return {
    id: e.id,
    targetId: e.targetId,
    subject: e.subject,
    status: e.status as OutreachEmail['status'],
    resendId: e.resendId,
    error: e.error,
    wormSeq: e.wormSeq,
    stepIndex: e.stepIndex,
    bodyHtml: null, // list view: bodies are fetched per-email (see GET ?emailId)
    aiGenerated: e.aiGenerated,
    sentAt: e.sentAt ? e.sentAt.toISOString() : null,
    createdAt: e.createdAt.toISOString(),
  };
}

// GET /api/vvu/outreach — all targets + latest 50 emails + engine config.
// The table starts EMPTY by design — no rows are fabricated or seeded.
// Query `?emailId=<id>` returns ONE email WITH its bodyHtml (history viewer).
export async function GET(req: NextRequest) {
  try {
    const emailId = req.nextUrl.searchParams.get('emailId');
    if (emailId) {
      const row = await db.outreachEmail.findFirst({ where: { id: emailId } });
      if (!row) {
        return NextResponse.json({ success: false, message: 'Email not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, email: { ...serializeEmail(row), bodyHtml: row.bodyHtml } });
    }
    const targets = await db.outreachTarget.findMany({
      where: { tenantId: OUTREACH_TENANT_ID },
      orderBy: { createdAt: 'asc' },
    });
    const emails = await db.outreachEmail.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({
      targets: targets.map(serializeTarget),
      emails: emails.map(serializeEmail),
      config: {
        resendConfigured: Boolean(process.env.RESEND_API_KEY),
        assetBase: OUTREACH_ASSET_BASE,
        from: OUTREACH_FROM,
      },
      scoring: SCORING_META,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/vvu/outreach — add ONE target. 422 on invalid email/consentBasis.
// Round 18: optional ICP profile fields — the server computes score/tier
// (never trusts a client-supplied score) and stamps it into the WORM row.
export async function POST(req: NextRequest) {
  let body: {
    org?: string;
    contactName?: string;
    email?: string;
    criticalIssue?: string;
    consentBasis?: string;
    notes?: string;
    sector?: string | null;
    annualRevenue?: number | null;
    employees?: number | null;
    bbbeeLevel?: number | null;
    supplierCount?: number | null;
    auditFail12m?: boolean;
    popiaRisk?: boolean;
    govContracts?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 });
  }

  const org = (body.org ?? '').trim();
  const contactName = (body.contactName ?? '').trim();
  const email = (body.email ?? '').trim().toLowerCase();
  const criticalIssue = body.criticalIssue?.trim() || null;
  const consentBasis = (body.consentBasis ?? 'NONE').trim().toUpperCase();

  if (!org || !contactName) {
    return NextResponse.json(
      { success: false, message: 'Missing required fields: org, contactName' },
      { status: 422 }
    );
  }
  if (!isValidEmail(email)) {
    return NextResponse.json(
      { success: false, message: 'Invalid email format' },
      { status: 422 }
    );
  }
  if (!(CONSENT_BASES as string[]).includes(consentBasis)) {
    return NextResponse.json(
      { success: false, message: `Invalid consentBasis — must be one of ${CONSENT_BASES.join(' | ')}` },
      { status: 422 }
    );
  }

  try {
    const existing = await db.outreachTarget.findFirst({
      where: { tenantId: OUTREACH_TENANT_ID, email },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, message: `Target already exists for ${email}` },
        { status: 409 }
      );
    }
    // Round 18 — server-side scoring (the client's live preview is advisory).
    const parsed = parseProfile(body as Record<string, unknown>);
    const profile = {
      sector: parsed.sector ?? null,
      annualRevenue: parsed.annualRevenue ?? null,
      employees: parsed.employees ?? null,
      bbbeeLevel: parsed.bbbeeLevel ?? null,
      supplierCount: parsed.supplierCount ?? null,
      auditFail12m: parsed.auditFail12m ?? false,
      popiaRisk: parsed.popiaRisk ?? false,
      govContracts: parsed.govContracts ?? false,
    };
    const { score, tier } = scoreLead(profile);
    const target = await db.outreachTarget.create({
      data: {
        tenantId: OUTREACH_TENANT_ID,
        org: org.slice(0, 120),
        contactName: contactName.slice(0, 120),
        email: email.slice(0, 254),
        criticalIssue: criticalIssue?.slice(0, 300) ?? null,
        consentBasis,
        notes: body.notes?.slice(0, 400) ?? null,
        ...profile,
        score,
        tier,
      },
    });
    // WORM evidence — same appendWormEvent pattern as ledger/gates/telemetry
    // routes. Details carry the org + consent basis, NEVER a key value.
    await appendWormEvent({
      source: 'OUTREACH',
      event: 'OUTREACH_TARGET_ADDED',
      details: isUnscored(profile)
        ? `${target.org} · ${target.email} · CONSENT ${target.consentBasis}`
        : `${target.org} · ${target.email} · CONSENT ${target.consentBasis} · SCORE ${score} · TIER ${tier}`,
    });
    return NextResponse.json({ success: true, target: serializeTarget(target) }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH /api/vvu/outreach — edit a target. Round 14: consent basis /
// critical issue / notes (dialog). Round 17 adds:
//   · status     — kanban pipeline transition (validated, WORM OUTREACH_STATUS)
//   · sequenceId — assign/unassign a cadence (WORM OUTREACH_ASSIGNED; null unassigns)
// Round 18 adds:
//   · ICP profile fields — server re-scores; a CHANGED score/tier appends
//     WORM OUTREACH_SCORED (old→new) because lead priority changes are
//     exactly the facts the chain should carry.
// WORM-logged because consent + pipeline changes are exactly the facts the
// chain should carry.
export async function PATCH(req: NextRequest) {
  let body: {
    id?: string;
    consentBasis?: string;
    criticalIssue?: string;
    notes?: string;
    status?: string;
    sequenceId?: string | null;
    sector?: string | null;
    annualRevenue?: number | null;
    employees?: number | null;
    bbbeeLevel?: number | null;
    supplierCount?: number | null;
    auditFail12m?: boolean;
    popiaRisk?: boolean;
    govContracts?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 });
  }
  if (!body.id) {
    return NextResponse.json({ success: false, message: 'Missing required field: id' }, { status: 422 });
  }
  const consentBasis = body.consentBasis?.trim().toUpperCase();
  if (consentBasis !== undefined && !(CONSENT_BASES as string[]).includes(consentBasis)) {
    return NextResponse.json(
      { success: false, message: `Invalid consentBasis — must be one of ${CONSENT_BASES.join(' | ')}` },
      { status: 422 }
    );
  }
  const status = body.status?.trim().toUpperCase();
  if (status !== undefined && !(ALL_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json(
      { success: false, message: `Invalid status — must be one of ${(ALL_STATUSES as readonly string[]).join(' | ')}` },
      { status: 422 }
    );
  }

  try {
    const existing = await db.outreachTarget.findFirst({
      where: { id: body.id, tenantId: OUTREACH_TENANT_ID },
    });
    if (!existing) {
      return NextResponse.json({ success: false, message: 'Target not found' }, { status: 404 });
    }

    // Sequence assignment validation (null = unassign is always allowed).
    let sequenceName: string | null = null;
    if (body.sequenceId !== undefined && body.sequenceId !== null) {
      const seq = await db.outreachSequence.findFirst({
        where: { id: body.sequenceId, tenantId: OUTREACH_TENANT_ID },
      });
      if (!seq) {
        return NextResponse.json({ success: false, message: 'Sequence not found' }, { status: 404 });
      }
      sequenceName = seq.name;
    }

    // Round 18 — merge the ICP profile over the existing row, re-score on the
    // server. `undefined` fields keep the stored value (sparse PATCH).
    const parsed = parseProfile(body as Record<string, unknown>);
    const profile = {
      sector: parsed.sector !== undefined ? parsed.sector : existing.sector,
      annualRevenue: parsed.annualRevenue !== undefined ? parsed.annualRevenue : existing.annualRevenue,
      employees: parsed.employees !== undefined ? parsed.employees : existing.employees,
      bbbeeLevel: parsed.bbbeeLevel !== undefined ? parsed.bbbeeLevel : existing.bbbeeLevel,
      supplierCount: parsed.supplierCount !== undefined ? parsed.supplierCount : existing.supplierCount,
      auditFail12m: parsed.auditFail12m !== undefined ? parsed.auditFail12m : existing.auditFail12m,
      popiaRisk: parsed.popiaRisk !== undefined ? parsed.popiaRisk : existing.popiaRisk,
      govContracts: parsed.govContracts !== undefined ? parsed.govContracts : existing.govContracts,
    };
    const { score: newScore, tier: newTier } = scoreLead(profile);
    const scoreChanged = newScore !== existing.score || newTier !== existing.tier;

    const target = await db.outreachTarget.update({
      where: { id: existing.id },
      data: {
        ...(consentBasis !== undefined ? { consentBasis } : {}),
        ...(body.criticalIssue !== undefined ? { criticalIssue: body.criticalIssue.trim().slice(0, 300) || null } : {}),
        ...(body.notes !== undefined ? { notes: body.notes.trim().slice(0, 400) || null } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(body.sequenceId !== undefined ? { sequenceId: body.sequenceId } : {}),
        ...profile,
        score: newScore,
        tier: newTier,
        // re-arming a refused/blocked target once a valid basis is recorded
        ...(consentBasis !== undefined && consentBasis !== 'NONE' && existing.status === 'BLOCKED'
          ? { status: 'NEW' }
          : {}),
      },
    });

    if (scoreChanged) {
      await appendWormEvent({
        source: 'OUTREACH',
        event: 'OUTREACH_SCORED',
        details: `${target.org} · ${target.email} · SCORE ${existing.score}→${newScore} · TIER ${newTier}`,
      });
    }

    if (status !== undefined && status !== existing.status) {
      await appendWormEvent({
        source: 'OUTREACH',
        event: 'OUTREACH_STATUS',
        details: `${target.org} · ${target.email} · ${existing.status}→${status}`,
      });
    }
    if (body.sequenceId !== undefined && body.sequenceId !== existing.sequenceId) {
      await appendWormEvent({
        source: 'OUTREACH',
        event: 'OUTREACH_ASSIGNED',
        details: `${target.org} · ${target.email} · SEQUENCE ${sequenceName ?? '— unassigned —'}`,
      });
    }
    await appendWormEvent({
      source: 'OUTREACH',
      event: 'OUTREACH_TARGET_UPDATED',
      details: `${target.org} · ${target.email} · CONSENT ${existing.consentBasis}→${target.consentBasis}`,
    });
    return NextResponse.json({ success: true, target: serializeTarget(target) });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
