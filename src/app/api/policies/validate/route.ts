import { NextRequest, NextResponse } from "next/server";
import { validateEpd } from "@/lib/epd";

// POST /api/policies/validate — validate .epd source (does not persist)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { source, state } = body as { source?: string; state?: Record<string, unknown> };
  if (!source) {
    return NextResponse.json({ error: "source is required" }, { status: 400 });
  }
  const result = validateEpd(source);

  // If a state is provided, also evaluate every invariant against it
  let evaluations: Array<{ policy: string; name: string; passed: boolean; severity: string; soft: boolean; message?: string; evaluated: string; actual?: string; expected?: string; divergence?: number }> | null = null;
  if (state && result.ast) {
    const { evaluateInvariant } = await import("@/lib/epd");
    evaluations = result.ast.policies.flatMap((p) =>
      p.invariants.map((inv) => ({
        policy: p.name,
        ...evaluateInvariant(inv, state),
      })),
    );
  }

  return NextResponse.json({ ...result, evaluations });
}
