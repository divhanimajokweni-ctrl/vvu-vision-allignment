import { createFileRoute } from "@tanstack/react-router";

// /api/vvu/outreach — the outreach feed (GET · POST add · PATCH edit), with
// /api/vvu/outreach/import and /api/vvu/outreach/send as sibling routes.
// Feed recreation of the source's Prisma-backed outreach pipeline: consent-
// gated, server-scored, dry-run-first (resendConfigured=false → real sends
// are refused with 501, exactly like the source without a Resend key).

import type {
  ConsentBasis,
  OutreachEmail,
  OutreachResponse,
  OutreachSendResponse,
  OutreachTarget,
  ScoringMeta,
} from "@/types/vvu";

const nowIso = () => new Date().toISOString();

interface TargetSeed {
  org: string;
  contactName: string;
  email: string;
  criticalIssue: string | null;
  consentBasis: ConsentBasis;
  status: string;
  sector: string | null;
  annualRevenue: number | null;
  employees: number | null;
  bbbeeLevel: number | null;
  supplierCount: number | null;
  auditFail12m: boolean;
  popiaRisk: boolean;
  govContracts: boolean;
}

const SEEDS: TargetSeed[] = [
  {
    org: "Buffelsdraai Water Co-op",
    contactName: "N. Dlamini",
    email: "ops@buffelsdraai.coop",
    criticalIssue: "non-revenue water at 34%",
    consentBasis: "EXISTING_CUSTOMER",
    status: "PILOT",
    sector: "municipal water",
    annualRevenue: 42,
    employees: 61,
    bbbeeLevel: 2,
    supplierCount: 9,
    auditFail12m: false,
    popiaRisk: false,
    govContracts: true,
  },
  {
    org: "Karoo Agri Processors",
    contactName: "P. Venter",
    email: "pventer@karooagri.co.za",
    criticalIssue: "hydraulic audit failed 12-month check",
    consentBasis: "OPT_IN",
    status: "REPLIED",
    sector: "agri processing",
    annualRevenue: 88,
    employees: 140,
    bbbeeLevel: 4,
    supplierCount: 22,
    auditFail12m: true,
    popiaRisk: false,
    govContracts: false,
  },
  {
    org: "eThekwini Facilities Trust",
    contactName: "S. Mkhize",
    email: "s.mkhize@etft.org.za",
    criticalIssue: null,
    consentBasis: "OPT_IN",
    status: "CONTACTED",
    sector: "facilities",
    annualRevenue: 210,
    employees: 380,
    bbbeeLevel: 1,
    supplierCount: 44,
    auditFail12m: false,
    popiaRisk: true,
    govContracts: true,
  },
  {
    org: "Vanderbijlpark Steel Services",
    contactName: "J. Botha",
    email: "j.botha@vpservices.co.za",
    criticalIssue: "POPIA evidence gaps",
    consentBasis: "OPT_IN",
    status: "SENT",
    sector: "steel services",
    annualRevenue: 155,
    employees: 260,
    bbbeeLevel: 5,
    supplierCount: 31,
    auditFail12m: false,
    popiaRisk: true,
    govContracts: false,
  },
  {
    org: "Gqeberha Cold Chain",
    contactName: "A. Fredericks",
    email: "andre@gqcc.co.za",
    criticalIssue: null,
    consentBasis: "NONE",
    status: "NEW",
    sector: "cold chain",
    annualRevenue: 24,
    employees: 40,
    bbbeeLevel: 3,
    supplierCount: 7,
    auditFail12m: false,
    popiaRisk: false,
    govContracts: false,
  },
];

function scoreOf(s: TargetSeed): number {
  let score = 0;
  if (s.criticalIssue) score += 25;
  if ((s.annualRevenue ?? 0) >= 50) score += 20;
  if ((s.employees ?? 0) >= 50) score += 15;
  if ((s.bbbeeLevel ?? 8) <= 4) score += 15;
  if (s.auditFail12m) score += 10;
  if (s.popiaRisk) score += 10;
  if (s.govContracts) score += 5;
  return Math.min(100, score);
}

function tierOf(score: number): string {
  if (score >= 75) return "PRIORITY";
  if (score >= 55) return "QUALIFIED";
  if (score > 0) return "LONG_SHOT";
  return "UNSCORED";
}

interface Row extends TargetSeed {
  id: string;
  tenantId: string;
  sequenceId: string | null;
  currentStep: number;
  score: number;
  tier: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

function rowOf(s: TargetSeed, i: number): Row {
  const score = scoreOf(s);
  return {
    ...s,
    id: `tgt-${String(i + 1).padStart(3, "0")}`,
    tenantId: "e1002324-0000-0000-0000-000000000001",
    sequenceId: null,
    currentStep: -1,
    score,
    tier: tierOf(score),
    notes: null,
    createdAt: new Date(Date.now() - (30 - i * 3) * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - (5 - i) * 86_400_000).toISOString(),
  };
}

const targets: Row[] = SEEDS.map(rowOf);

const emails: OutreachEmail[] = [
  {
    id: "em-001",
    targetId: "tgt-002",
    subject: "Hydraulic audit failure — the 12-month evidence window",
    status: "SENT",
    resendId: null,
    error: null,
    wormSeq: 4021,
    stepIndex: 0,
    bodyHtml:
      "<p>Your 12-month audit window shows a failed hydraulic check. VVU produces the evidence chain your insurer asks for.</p>",
    aiGenerated: false,
    sentAt: new Date(Date.now() - 6 * 86_400_000).toISOString(),
    createdAt: new Date(Date.now() - 6 * 86_400_000).toISOString(),
  },
  {
    id: "em-002",
    targetId: "tgt-004",
    subject: "POPIA evidence gaps — closed in one sprint",
    status: "DRY_RUN",
    resendId: null,
    error: null,
    wormSeq: 4035,
    stepIndex: 0,
    bodyHtml:
      "<p>Preview only (dry-run): POPIA gaps become hash-chained evidence, not a spreadsheet.</p>",
    aiGenerated: true,
    sentAt: null,
    createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  },
];

const scoring: ScoringMeta = {
  rules: [
    {
      key: "criticalIssue",
      label: "Stated critical issue",
      points: 25,
      hint: "the pain is written down, not guessed",
    },
    { key: "revenue", label: "Revenue ≥ R50m", points: 20, hint: "budget exists" },
    { key: "employees", label: "Headcount ≥ 50", points: 15, hint: "operations depth" },
    { key: "bbbee", label: "B-BBEE level ≤ 4", points: 15, hint: "procurement leverage" },
    {
      key: "auditFail12m",
      label: "Audit failure in 12m",
      points: 10,
      hint: "the evidence need is live",
    },
    { key: "popiaRisk", label: "POPIA exposure", points: 10, hint: "regulatory pressure" },
    { key: "govContracts", label: "Government contracts", points: 5, hint: "compliance culture" },
  ],
  priorityThreshold: 75,
  qualifiedThreshold: 55,
  scoreMax: 100,
  sectors: ["municipal water", "agri processing", "facilities", "steel services", "cold chain"],
  icpCore: ["municipal water", "agri processing"],
  revenueBand: { min: 50, max: 500 },
  employeeBand: { min: 50, max: 5000 },
  bbbeeBand: { min: 1, max: 4 },
};

// ─── Route ──────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/api/vvu/outreach")({
  server: {
    handlers: {
      GET: async () => {
        const payload: OutreachResponse = {
          targets: targets as unknown as OutreachTarget[],
          emails,
          config: { resendConfigured: false, assetBase: "", from: "outreach@vvu-foundation.co.za" },
          scoring,
        };
        return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
      },

      POST: async ({ request }) => {
        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return Response.json({ success: false, message: "invalid JSON" }, { status: 400 });
        }

        const org = String(body.org ?? "").trim();
        const email = String(body.email ?? "").trim();
        const contactName = String(body.contactName ?? "").trim();
        if (!org || !email || !contactName) {
          return Response.json(
            { success: false, message: "org, contactName and email are required" },
            { status: 422 },
          );
        }
        if (targets.some((t) => t.email.toLowerCase() === email.toLowerCase())) {
          return Response.json(
            { success: false, message: `duplicate target email: ${email}` },
            { status: 409 },
          );
        }

        const seed: TargetSeed = {
          org,
          contactName,
          email,
          criticalIssue: body.criticalIssue ? String(body.criticalIssue) : null,
          consentBasis: (body.consentBasis as ConsentBasis) ?? "NONE",
          status: "NEW",
          sector: null,
          annualRevenue: null,
          employees: null,
          bbbeeLevel: null,
          supplierCount: null,
          auditFail12m: false,
          popiaRisk: false,
          govContracts: false,
        };
        const row = rowOf(seed, targets.length);
        targets.push(row);
        return Response.json({ success: true, target: row, message: "WORM OUTREACH_TARGET_ADDED" });
      },

      PATCH: async ({ request }) => {
        let body: { id?: string; consentBasis?: ConsentBasis; criticalIssue?: string };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ success: false, message: "invalid JSON" }, { status: 400 });
        }
        const row = targets.find((t) => t.id === body.id);
        if (!row)
          return Response.json({ success: false, message: "target not found" }, { status: 404 });
        if (body.consentBasis) row.consentBasis = body.consentBasis;
        if (body.criticalIssue !== undefined) row.criticalIssue = body.criticalIssue;
        row.updatedAt = nowIso();
        row.score = scoreOf(row);
        row.tier = tierOf(row.score);
        return Response.json({
          success: true,
          target: row,
          message: "WORM OUTREACH_TARGET_UPDATED",
        });
      },
    },
  },
});
