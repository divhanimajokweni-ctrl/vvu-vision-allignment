import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateEpd, evaluateInvariant, type PolicyNode, type InvariantNode } from "@/lib/epd";

// GET /api/test-suite?policyId=... — generate and run a test suite against a policy's invariants.
// For each invariant, generate 3 test cases: (1) a passing state, (2) a boundary-violating state,
// (3) a clearly-violating state. Run each against the invariant predicate and report pass/fail.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const policyId = searchParams.get("policyId");
  if (!policyId) {
    return NextResponse.json({ error: "policyId required" }, { status: 400 });
  }
  const policy = await db.policy.findUnique({ where: { id: policyId } });
  if (!policy) {
    return NextResponse.json({ error: "policy not found" }, { status: 404 });
  }

  const result = validateEpd(policy.source);
  const node = result.ast?.policies[0] as PolicyNode | undefined;
  if (!node) {
    return NextResponse.json({ error: "policy failed to parse" }, { status: 500 });
  }

  type TestCase = {
    id: string;
    invariantName: string;
    severity: string;
    soft: boolean;
    description: string;
    state: Record<string, unknown>;
    expectedPass: boolean;
    actualPass: boolean;
    actualValue?: string;
    status: "pass" | "fail" | "error";
    durationMs: number;
  };

  const testCases: TestCase[] = [];
  let passed = 0;
  let failed = 0;
  let errored = 0;

  for (const inv of node.invariants) {
    const cases = generateCases(inv);
    for (const c of cases) {
      const start = Date.now();
      try {
        const ev = evaluateInvariant(inv, c.state);
        const actualPass = ev.passed;
        // A test "passes" if the invariant evaluator agrees with the expected outcome.
        // i.e. if we expected it to pass and it passed, OR expected to fail and it failed.
        const status: TestCase["status"] =
          actualPass === c.expectedPass ? "pass" : "fail";
        if (status === "pass") passed++;
        else failed++;
        testCases.push({
          id: `${inv.name}-${c.name}`,
          invariantName: inv.name,
          severity: inv.severity,
          soft: inv.soft,
          description: c.description,
          state: c.state,
          expectedPass: c.expectedPass,
          actualPass,
          actualValue: ev.actual,
          status,
          durationMs: Date.now() - start,
        });
      } catch (e) {
        errored++;
        testCases.push({
          id: `${inv.name}-${c.name}`,
          invariantName: inv.name,
          severity: inv.severity,
          soft: inv.soft,
          description: c.description,
          state: c.state,
          expectedPass: c.expectedPass,
          actualPass: false,
          status: "error",
          durationMs: Date.now() - start,
        });
      }
    }
  }

  return NextResponse.json({
    policyId,
    policyName: policy.name,
    total: testCases.length,
    passed,
    failed,
    errored,
    passRate: testCases.length ? Math.round((passed / testCases.length) * 100) : 0,
    durationMs: testCases.reduce((n, t) => n + t.durationMs, 0),
    cases: testCases,
    generatedAt: new Date().toISOString(),
  });
}

// Generate 3 test cases per invariant by parsing its predicate for bounds.
function generateCases(inv: InvariantNode): {
  name: string;
  description: string;
  state: Record<string, unknown>;
  expectedPass: boolean;
}[] {
  const bounds = extractBounds(inv);
  const field = bounds[0]?.field ?? Object.keys(getSampleFields(inv))[0] ?? "value";
  const lo = bounds[0]?.lo ?? 0;
  const hi = bounds[0]?.hi ?? 100;
  const mid = (lo + hi) / 2;

  // Base state with the primary field + supporting fields
  const baseState = getSampleFields(inv);

  return [
    {
      name: "pass-nominal",
      description: `Nominal in-bounds value (${mid})`,
      state: { ...baseState, [field]: mid },
      expectedPass: true,
    },
    {
      name: "pass-boundary",
      description: `Boundary value at upper bound (${hi})`,
      state: { ...baseState, [field]: hi },
      expectedPass: true,
    },
    {
      name: "fail-violation",
      description: `Out-of-bounds value (${hi + Math.max(1, (hi - lo) * 0.2)})`,
      state: { ...baseState, [field]: hi + Math.max(1, (hi - lo) * 0.2) },
      expectedPass: false,
    },
  ];
}

function extractBounds(inv: InvariantNode): { field: string; lo: number; hi: number }[] {
  const out: { field: string; lo: number; hi: number }[] = [];
  if (!inv.predicate) return out;
  walk(inv.predicate, (eRaw) => {
    const e = eRaw as {
      kind: string;
      value?: { kind: string; name?: string };
      range?: Array<{ kind: string; value?: number }>;
    };
    if (
      e.kind === "in" &&
      e.value?.kind === "ident" &&
      e.range?.[0]?.kind === "num" &&
      e.range?.[1]?.kind === "num"
    ) {
      out.push({ field: e.value.name ?? "", lo: e.range[0].value ?? 0, hi: e.range[1].value ?? 0 });
    }
  });
  return out;
}

function walk(expr: unknown, visit: (e: unknown) => void) {
  visit(expr);
  const e = expr as Record<string, unknown>;
  if (!e || typeof e !== "object") return;
  if (e.kind === "unary") walk(e.operand, visit);
  else if (e.kind === "binary" || e.kind === "logic" || e.kind === "compare") {
    walk(e.left, visit);
    walk(e.right, visit);
  } else if (e.kind === "in") {
    walk(e.value, visit);
    walk((e.range as unknown[])[0], visit);
    walk((e.range as unknown[])[1], visit);
  } else if (e.kind === "call") {
    (e.args as unknown[]).forEach((a) => walk(a, visit));
  }
}

// Extract referenced identifier names from the predicate
function getSampleFields(inv: InvariantNode): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (!inv.predicate) return fields;
  walk(inv.predicate, (e) => {
    const node = e as Record<string, unknown>;
    if (node.kind === "ident") {
      const name = node.name as string;
      if (!(name in fields)) {
        // Provide a sensible default value per field name
        fields[name] = defaultFor(name);
      }
    }
  });
  return fields;
}

function defaultFor(name: string): unknown {
  if (name.includes("sum") || name.includes("generation") || name.includes("load")) {
    return [100, 200, 150];
  }
  if (name.includes("count") || name.includes("num")) return 3;
  if (name.includes("temp") || name.includes("ph")) return 7;
  if (name.includes("pressure")) return 5;
  if (name.includes("speed")) return 50;
  if (name.includes("rate") || name.includes("frequency")) return 50;
  return 10;
}
