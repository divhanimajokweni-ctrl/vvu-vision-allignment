import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SAMPLE_STATES } from "@/lib/epd";

// POST /api/miner/mine — propose candidate invariants from historical drift data
// Uses the z-ai LLM (backend-only) to rationalize candidates, with a deterministic
// statistical fallback if the LLM is unavailable.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { policyId, useLLM = true } = body as { policyId?: string; useLLM?: boolean };

  // Gather drift data for the policy (or all policies)
  const where = policyId ? { policyId } : undefined;
  const violations = await db.invariantViolation.findMany({
    where,
    include: { policy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  // Build a statistical summary of drift by field/severity
  const driftSummary = summarize(violations);

  // Deterministic candidate generation (always available)
  const deterministic = generateCandidates(driftSummary);

  let llmCandidates: { predicate: string; rationale: string; confidence: number; severity: string }[] = [];
  let llmUsed = false;
  if (useLLM) {
    try {
      llmCandidates = await mineWithLLM(driftSummary, policyId ?? null);
      llmUsed = true;
    } catch {
      llmUsed = false;
    }
  }

  const all = [...(llmUsed ? llmCandidates : []), ...deterministic];
  // Dedupe by predicate
  const seen = new Set<string>();
  const created: Array<{
    id: string;
    predicate: string;
    severity: string;
    rationale: string;
    confidence: number;
    accepted: boolean;
    policyId: string | null;
    createdAt: Date;
  }> = [];
  for (const c of all) {
    if (seen.has(c.predicate)) continue;
    seen.add(c.predicate);
    const rec = await db.minedInvariant.create({
      data: {
        policyId: policyId ?? null,
        predicate: c.predicate,
        rationale: c.rationale,
        confidence: c.confidence,
        severity: c.severity,
        accepted: false,
      },
    });
    created.push(rec);
  }

  return NextResponse.json({
    mined: created,
    llmUsed,
    driftSummary,
  });
}

interface DriftSummary {
  total: number;
  byInvariant: Record<string, number>;
  bySeverity: Record<string, number>;
  byPolicy: Record<string, number>;
  sampleFields: string[];
}

function summarize(violations: { invariant: string; severity: string; policy: { name: string } }[]): DriftSummary {
  const byInvariant: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const byPolicy: Record<string, number> = {};
  for (const v of violations) {
    byInvariant[v.invariant] = (byInvariant[v.invariant] ?? 0) + 1;
    bySeverity[v.severity] = (bySeverity[v.severity] ?? 0) + 1;
    byPolicy[v.policy.name] = (byPolicy[v.policy.name] ?? 0) + 1;
  }
  // Pull sample field names from SAMPLE_STATES to ground candidate predicates
  const sampleFields = Array.from(
    new Set(Object.values(SAMPLE_STATES).flatMap((s) => Object.keys(s))),
  ).slice(0, 12);
  return {
    total: violations.length,
    byInvariant,
    bySeverity,
    byPolicy,
    sampleFields,
  };
}

function generateCandidates(s: DriftSummary) {
  const out: { predicate: string; rationale: string; confidence: number; severity: string }[] = [];
  const topInvariants = Object.entries(s.byInvariant)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  for (const [name, count] of topInvariants) {
    const confidence = Math.min(0.95, 0.5 + count * 0.08);
    out.push({
      predicate: `${name}_guard >= 0`,
      rationale: `Statistical: '${name}' drifted ${count}× in history — add a non-negative guard`,
      confidence: Number(confidence.toFixed(2)),
      severity: "medium",
    });
  }
  // Field-grounded heuristics
  if (s.sampleFields.includes("frequency")) {
    out.push({
      predicate: "abs(frequency - 50) <= 0.2",
      rationale: "Frequency centered on 50Hz with ±0.2Hz tight band correlates with stability",
      confidence: 0.74,
      severity: "high",
    });
  }
  if (s.sampleFields.includes("speed")) {
    out.push({
      predicate: "speed <= 120",
      rationale: "Speed excursions beyond 120 precede braking_budget exhaustion",
      confidence: 0.69,
      severity: "critical",
    });
  }
  if (s.sampleFields.includes("temperature")) {
    out.push({
      predicate: "temperature in [2, 8]",
      rationale: "Cold-chain excursions cluster outside [2,8]°C pharmacopeia range",
      confidence: 0.77,
      severity: "critical",
    });
  }
  return out;
}

async function mineWithLLM(
  s: DriftSummary,
  policyId: string | null,
): Promise<{ predicate: string; rationale: string; confidence: number; severity: string }[]> {
  const { default: ZAI } = await import("z-ai-web-dev-sdk");
  const zai = await ZAI.create();
  const policy = policyId ? await db.policy.findUnique({ where: { id: policyId } }) : null;
  const domain = policy?.domain ?? "general distributed system";

  const system =
    "You are an epistemic-invariant mining engine for a distributed CRDT/DAG runtime. " +
    "Given drift/violation statistics, propose 3 concise candidate invariants as STRICT JSON. " +
    "Each candidate: {predicate, rationale, confidence (0-1), severity (critical|high|medium|low)}. " +
    "Predicates must use a small expression grammar: comparisons (>=, <=, in [a,b]), arithmetic (+,-,*,/), " +
    "and aggregates (sum(field), max(field), min(field)). Reply ONLY with a JSON array.";

  const user = JSON.stringify({
    domain,
    driftSummary: s,
    instruction:
      "Propose 3 NEW candidate invariants (not already implied by the drift fields) that would have prevented the observed drift. Be concrete and use field names from sampleFields when sensible.",
  });

  const completion = await zai.chat.completions.create({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    thinking: { type: "disabled" },
  });

  const text: string =
    completion?.choices?.[0]?.message?.content ??
    completion?.message?.content ??
    "";
  // Extract the first JSON array from the response
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(
        (x: unknown): x is { predicate: string; rationale: string; confidence: number; severity: string } =>
          typeof x === "object" && x !== null && "predicate" in (x as object),
      )
      .slice(0, 3)
      .map((x) => ({
        predicate: String(x.predicate),
        rationale: String(x.rationale ?? "LLM-mined candidate"),
        confidence: Number(x.confidence ?? 0.6),
        severity: ["critical", "high", "medium", "low"].includes(x.severity)
          ? x.severity
          : "medium",
      }));
  } catch {
    return [];
  }
}
