import { NextRequest, NextResponse } from "next/server";
import {
  ConflictError,
  NotFoundError,
  cancelSubscription,
  createSubscription,
  getSubscriptions,
} from "@/skylantern/server/service";
import type { CreateSubscriptionRequest } from "@/skylantern/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/skylantern/subscriptions
 * Returns all commercial subscriptions (slide 13 — pricing tiers R9–R9,999).
 */
export async function GET() {
  const subs = await getSubscriptions();
  return NextResponse.json({ subscriptions: subs, count: subs.length });
}

/**
 * POST /api/skylantern/subscriptions
 * Creates a new subscription. Simulates a Stripe checkout completion.
 * Enforces the R9–R9,999 cap as a design constraint.
 */
export async function POST(req: NextRequest) {
  let body: CreateSubscriptionRequest;
  try {
    body = (await req.json()) as CreateSubscriptionRequest;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }
  try {
    const sub = await createSubscription(body);
    return NextResponse.json({ subscription: sub }, { status: 201 });
  } catch (e) {
    if (e instanceof NotFoundError) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    if (e instanceof ConflictError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/skylantern/subscriptions?id=xxx
 * Cancels a subscription.
 */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { error: "id query parameter is required" },
      { status: 400 }
    );
  }
  try {
    const sub = await cancelSubscription(id);
    return NextResponse.json({ subscription: sub });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
