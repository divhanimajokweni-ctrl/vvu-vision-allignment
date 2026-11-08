import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seedWorkspaceIfEmpty } from "@/lib/workspace/seed";

export const dynamic = "force-dynamic";

// GET /api/subscriptions
// Returns all subscriptions + recent invoices + aggregate billing stats (MRR, ARR, LTV).
export async function GET() {
  await seedWorkspaceIfEmpty();
  const [subs, invoices] = await Promise.all([
    db.subscription.findMany({ orderBy: { startDate: "desc" } }),
    db.invoice.findMany({ orderBy: { issuedAt: "desc" }, take: 20 }),
  ]);

  const active = subs.filter((s) => s.status === "ACTIVE");
  const trialing = subs.filter((s) => s.status === "TRIALING");
  const cancelled = subs.filter((s) => s.status === "CANCELLED");

  // Convert a subscription's priceZAR + cadence into a monthly-equivalent MRR contribution.
  // "per user / mo" and "per mo" are already monthly. "90 days" = a quarter, so divide by 3.
  // "deposit" is a one-off (excluded from MRR entirely).
  const monthlyEquivalent = (s: { priceZAR: number; cadence: string }) => {
    if (s.cadence.includes("per user / mo") || s.cadence.includes("per mo")) {
      return s.priceZAR;
    }
    if (s.cadence.includes("90 days")) {
      return Math.round(s.priceZAR / 3);
    }
    return 0; // deposit = one-off, not MRR
  };

  // MRR = monthly-equivalent revenue across all active + trialing subs.
  // (Cancelled subs stop contributing the moment their cancelledAt is set.)
  const mrr =
    active.reduce((sum, s) => sum + monthlyEquivalent(s), 0) +
    trialing.reduce((sum, s) => sum + monthlyEquivalent(s), 0);

  // LTV = sum of (annualized priceZAR) across active subs only — a conservative
  // 12-month forward look at booked revenue from current active customers.
  const ltv = active.reduce((sum, s) => {
    if (s.cadence.includes("per user / mo") || s.cadence.includes("per mo")) {
      return sum + s.priceZAR * 12;
    }
    if (s.cadence.includes("90 days")) {
      return sum + s.priceZAR * 4; // 4 quarters / yr
    }
    return sum; // deposit = one-off
  }, 0);

  return NextResponse.json({
    subscriptions: subs,
    invoices,
    stats: {
      total: subs.length,
      active: active.length,
      trialing: trialing.length,
      cancelled: cancelled.length,
      mrr,
      arr: mrr * 12,
      ltv,
    },
  });
}

// Tier catalogue — the canonical price map (Skylantern slide 13: R9–R9,999 cap).
// Keep this in sync with the workspace/seed.ts subscription seeding.
const TIER_MAP: Record<
  string,
  { label: string; price: number; cadence: string }
> = {
  phone: { label: "Phone Backup", price: 9, cadence: "per user / mo" },
  vehicle: { label: "Vehicle Tracker", price: 49, cadence: "per mo" },
  fleet: { label: "Fleet Mobility", price: 199, cadence: "per mo" },
  dma: { label: "DMA Water Custodian", price: 4999, cadence: "per mo" },
  water: { label: "Water Infrastructure · DMA", price: 9999, cadence: "90 days" },
};

// POST /api/subscriptions
// Create a new subscription in TRIALING status by default.
// Body: { tierKey, customerName, customerEmail?, deviceExternalId?, status? }
export async function POST(req: Request) {
  await seedWorkspaceIfEmpty();
  const body = await req.json().catch(() => null);
  if (!body || !body.tierKey || !body.customerName) {
    return NextResponse.json(
      { error: "tierKey and customerName required" },
      { status: 400 }
    );
  }
  const tier = TIER_MAP[body.tierKey as string];
  if (!tier) {
    return NextResponse.json(
      {
        error:
          "invalid tierKey — must be one of: phone, vehicle, fleet, dma, water",
      },
      { status: 400 }
    );
  }
  const status = body.status === "ACTIVE" ? "ACTIVE" : "TRIALING";
  const sub = await db.subscription.create({
    data: {
      tierKey: body.tierKey,
      tierLabel: tier.label,
      priceZAR: tier.price,
      cadence: tier.cadence,
      customerName: String(body.customerName),
      customerEmail: body.customerEmail ? String(body.customerEmail) : "",
      deviceExternalId: body.deviceExternalId
        ? String(body.deviceExternalId)
        : null,
      status,
    },
  });
  return NextResponse.json(sub);
}
