import { NextRequest, NextResponse } from "next/server";
import { buildProofBundle } from "@/skylantern/server/service";

export const dynamic = "force-dynamic";

/**
 * GET /api/skylantern/evidence/[id]/proof-bundle
 *
 * Returns a self-contained Proof Bundle for municipal auditors (slide 9).
 * Contains:
 *   - the evidence record (full DTO)
 *   - the audit timeline (every state transition)
 *   - the neighbor blocks (previous + next in the chain)
 *   - the integrity check (recomputed hash + signature verification)
 *   - generation metadata
 *
 * Query param ?format=zip returns a flat-file ZIP-like text bundle (since we
 * can't easily ship a binary ZIP without adding a dependency). Default ?format=json.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const format = req.nextUrl.searchParams.get("format") ?? "json";
  const bundle = await buildProofBundle(id);
  if (!bundle) {
    return NextResponse.json(
      { error: "Evidence not found" },
      { status: 404 }
    );
  }

  if (format === "zip") {
    // A human-readable text "bundle" that an auditor can save as .txt or
    // pipe into a real zipper. Keeps the plugin dependency-free.
    const text = renderProofBundleText(bundle);
    const filename = `skylantern-proof-block-${bundle.evidence.sequence}.txt`;
    return new NextResponse(text, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return NextResponse.json({ bundle });
}

function renderProofBundleText(bundle: Awaited<ReturnType<typeof buildProofBundle>> & {}): string {
  const e = bundle!.evidence;
  const lines: string[] = [];
  lines.push("=".repeat(72));
  lines.push("SKYLANTERN PROOF BUNDLE");
  lines.push("One Primitive. Immutable Evidence. Honest Limits.");
  lines.push(`Schema: ${bundle!.schemaVersion}`);
  lines.push(`Generated: ${bundle!.generatedAt}`);
  lines.push("=".repeat(72));
  lines.push("");
  lines.push("## EVIDENCE RECORD");
  lines.push(`  Block #:       ${e.sequence}`);
  lines.push(`  Hash:          ${e.hash}`);
  lines.push(`  PreviousHash:  ${e.previousHash ?? "— (genesis) —"}`);
  lines.push(`  State:         ${e.verificationState} (tier R${e.tierTag})`);
  lines.push(`  Subject:       ${e.subject}`);
  lines.push(`  Source:        ${e.source}`);
  lines.push(`  Observed at:   ${e.observedAt}`);
  lines.push(`  Signed at:     ${e.signedAt}`);
  lines.push(`  Geo:           ${e.lat.toFixed(4)}, ${e.lng.toFixed(4)}`);
  lines.push(`  Signature:     ${e.signature}`);
  lines.push("");
  lines.push("## THE THREE LEVELS (must not collapse)");
  lines.push("  [1] Observed Fact:");
  lines.push(`        value:     ${e.observedFact.value}`);
  lines.push(`        unit:      ${e.observedFact.unit}`);
  lines.push(`        primitive: ${e.observedFact.primitive}`);
  lines.push(`        raw:       ${e.observedFact.raw}`);
  if (e.derivedEvent) {
    lines.push("  [2] Derived Event:");
    lines.push(`        inference:     ${e.derivedEvent.inference}`);
    lines.push(`        firmware:      ${e.derivedEvent.firmwareVersion}`);
  }
  if (e.decision) {
    lines.push("  [3] Decision:");
    lines.push(`        action:  ${e.decision.action}`);
    lines.push(`        status:  ${e.decision.status}`);
  }
  lines.push("");
  lines.push("## SIGNING DEVICE");
  lines.push(`  ${e.device.label} (${e.device.externalId})`);
  lines.push(`  Domain: ${e.device.domain}  Primitive: ${e.device.primitive}`);
  lines.push("");
  lines.push("## WITNESSES");
  if (e.witnesses.length === 0) {
    lines.push("  (none — single-witness record, tier R1)");
  } else {
    for (const w of e.witnesses) {
      lines.push(`  - [${w.witnessType}] ${w.witnessLabel} (signed ${w.signedAt})`);
    }
  }
  lines.push("");
  lines.push("## CHAIN CONTEXT");
  const n = bundle!.neighbors;
  if (n.previous) {
    lines.push(`  Previous block #${n.previous.sequence}`);
    lines.push(`    hash:    ${n.previous.hash}`);
    lines.push(`    subject: ${n.previous.subject}`);
    lines.push(`    state:   ${n.previous.verificationState}`);
  } else {
    lines.push("  Previous block: — (this is the genesis) —");
  }
  if (n.next) {
    lines.push(`  Next block #${n.next.sequence}`);
    lines.push(`    hash:        ${n.next.hash}`);
    lines.push(`    previousHash:${n.next.previousHash}`);
    lines.push(`    subject:     ${n.next.subject}`);
    lines.push(`    state:       ${n.next.verificationState}`);
  } else {
    lines.push("  Next block: — (this is the chain head) —");
  }
  lines.push("");
  lines.push("## INTEGRITY CHECK");
  lines.push(`  Recomputed hash:    ${bundle!.integrity.recomputedHash}`);
  lines.push(`  Matches stored:     ${bundle!.integrity.matchesStoredHash ? "YES ✓" : "NO ✗ — TAMPER DETECTED"}`);
  lines.push(`  Signature valid:    ${bundle!.integrity.signatureValid ? "YES ✓" : "NO ✗"}`);
  lines.push("");
  lines.push("## AUDIT TIMELINE");
  for (const a of bundle!.audit) {
    lines.push(`  ${a.at}  [${a.action}]  ${a.fromState ?? "—"} → ${a.toState ?? "—"}`);
    lines.push(`        actor: ${a.actor}`);
    if (a.note) lines.push(`        note:  ${a.note}`);
  }
  lines.push("");
  lines.push("=".repeat(72));
  lines.push("We prove the record, not the reality.");
  lines.push("=".repeat(72));
  return lines.join("\n") + "\n";
}
