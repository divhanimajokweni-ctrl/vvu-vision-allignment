import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// PATCH /api/subscriptions/[id]
// Cancel a subscription: sets status=CANCELLED + cancelledAt=now.
// Cannot cancel an already-cancelled subscription (idempotency guard).
// The request body is intentionally ignored — cancellation is the only PATCH
// operation this endpoint performs. Reactivation/status changes are NOT supported.
export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = await db.subscription.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: "subscription not found" },
      { status: 404 }
    );
  }
  // Idempotency guard: cannot cancel an already-cancelled subscription.
  if (existing.status === "CANCELLED") {
    return NextResponse.json(
      {
        error:
          "subscription is already cancelled — cancelled records are immutable billing history",
      },
      { status: 400 }
    );
  }
  const updated = await db.subscription.update({
    where: { id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
    },
  });
  return NextResponse.json(updated);
}

// DELETE /api/subscriptions/[id]
// ONLY allowed for TRIALING subscriptions — paid/cancelled history is immutable
// (POPIA + financial-audit compliance: never delete a billing record).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = await db.subscription.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: "subscription not found" },
      { status: 404 }
    );
  }
  if (existing.status !== "TRIALING") {
    return NextResponse.json(
      {
        error: `cannot delete subscription in status ${existing.status} — only TRIALING subscriptions may be deleted (paid/cancelled history is immutable)`,
      },
      { status: 400 }
    );
  }
  // Cascade: unlink any invoices that pointed at this trial subscription,
  // then delete the subscription row. Invoices themselves are retained for audit.
  await db.invoice.updateMany({
    where: { subscriptionId: id },
    data: { subscriptionId: null },
  });
  await db.subscription.delete({ where: { id } });
  return NextResponse.json({ ok: true, id });
}
