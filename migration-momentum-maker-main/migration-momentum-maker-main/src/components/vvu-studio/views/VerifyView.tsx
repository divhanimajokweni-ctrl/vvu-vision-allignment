/**
 * VVU · STUDIO — the stranger's verification surface (capability 3 test).
 *
 * A stranger picks a receipt and verifies it INDEPENDENTLY:
 *   1. Signature check — Ed25519 verify (or HMAC recompute for stubs)
 *   2. Hash checks — recordHash = SHA-256(canonical), receiptHash = SHA-256(prev‖record‖ts)
 *   3. Merkle inclusion proof — recompute the root from this leaf + siblings
 *
 * All three pass → the receipt is authentic. No trust required.
 */
"use client";
import { useStudio } from "@/lib/vvu-studio/store";
import { short } from "@/lib/vvu-studio/crypto";
import { Card, Badge, Button } from "../ui";
import { Icon } from "../Icons";

export function VerifyView() {
  const loopReceipts = useStudio((s) => s.loopReceipts);
  const verifyReceiptFull = useStudio((s) => s.verifyReceiptFull);
  const fullVerifyResult = useStudio((s) => s.fullVerifyResult);
  const pubKeyHex = useStudio((s) => s.pubKeyHex);
  const keyOrigin = useStudio((s) => s.keyOrigin);
  const ed25519Available = useStudio((s) => s.ed25519Available);
  const merkleRootLine = useStudio((s) => s.merkleRootLine);

  const root = merkleRootLine().replace("MERKLE ROOT: ", "");

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="vvu-doc">
        <div className="vk">the loop / verify.py</div>
        <h1>Stranger-Verify · capability 3 test</h1>
        <p className="lede">
          A stranger picks a receipt and verifies it independently — signature, hashes,
          and merkle inclusion proof. All three pass → authentic. No trust required.
        </p>
      </div>

      {/* KEY STATUS — the stranger needs the pubKey */}
      <Card title="SIGNING KEY · the stranger needs this">
        <div className="space-y-1.5 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="mono text-[10px] uppercase text-[var(--vs-dim)]">algorithm:</span>
            {ed25519Available ? <Badge tone="pass">Ed25519</Badge> : <Badge tone="stub">HMAC-SHA256 stub</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <span className="mono text-[10px] uppercase text-[var(--vs-dim)]">key origin:</span>
            {keyOrigin === "indexeddb" ? (
              <Badge tone="pass">persisted (IndexedDB) — survives reload</Badge>
            ) : keyOrigin === "fresh" ? (
              <Badge tone="stub">fresh this session</Badge>
            ) : (
              <Badge>not yet generated</Badge>
            )}
          </div>
          {pubKeyHex && (
            <div>
              <span className="mono text-[10px] uppercase text-[var(--vs-dim)]">public key:</span>
              <div className="mono break-all text-[var(--vs-accent)]">{pubKeyHex}</div>
            </div>
          )}
        </div>
      </Card>

      {/* RECEIPT SELECTOR + VERIFY */}
      <Card title="VERIFY A RECEIPT">
        {loopReceipts.length === 0 ? (
          <div className="py-4 text-center text-[12px] text-[var(--vs-dim)]">No receipts to verify. Run the loop first.</div>
        ) : (
          <div className="space-y-2">
            <div className="text-[12px] text-[var(--vs-dim)]">
              Click a receipt to run the full stranger-verification (sig + hashes + merkle path):
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {loopReceipts.map((r) => (
                <button
                  key={r.seq}
                  onClick={() => void verifyReceiptFull(r.seq)}
                  className={
                    "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors " +
                    (fullVerifyResult?.seq === r.seq
                      ? fullVerifyResult.overallOk
                        ? "border-[var(--vs-accent)] bg-[var(--vs-accentbg)]/40"
                        : "border-[var(--vs-red)] bg-[var(--vs-redbg)]/40"
                      : "border-[var(--vs-border2)] bg-[var(--vs-bg3)]/40 hover:border-[var(--vs-accent2)]")
                  }
                >
                  <span className="mono text-[11px] text-[var(--vs-text)]">#{r.seq}</span>
                  {r.verdict === "PASS" ? <Badge tone="pass">PASS</Badge> : r.verdict === "FAIL" ? <Badge tone="fail">FAIL</Badge> : <Badge tone="stub">CAN'T DECIDE</Badge>}
                  <span className="mono text-[10px] text-[var(--vs-accent)]">{short(r.recordHash, 14)}</span>
                  {fullVerifyResult?.seq === r.seq && (
                    <span className="mono ml-auto text-[10px]">
                      {fullVerifyResult.overallOk ? <span className="text-[var(--vs-accent)]">✓ verified</span> : <span className="text-[var(--vs-red)]">✗ failed</span>}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* FULL VERIFY RESULT */}
      {fullVerifyResult && (
        <Card title={`VERIFICATION RESULT · receipt #${fullVerifyResult.seq}`}>
          <div className={"mb-3 rounded-md border-l-2 px-3 py-2 text-[13px] font-semibold " + (fullVerifyResult.overallOk ? "border-[var(--vs-accent)] bg-[var(--vs-accentbg)]/40 text-[var(--vs-accent)]" : "border-[var(--vs-red)] bg-[var(--vs-redbg)]/40 text-[var(--vs-red)]")}>
            {fullVerifyResult.overallOk ? "✓ all checks pass — receipt is authentic" : "✗ verification FAILED — receipt is NOT authentic"}
          </div>

          {/* 1. signature */}
          <div className="mb-3">
            <div className="mono mb-1 text-[10px] uppercase text-[var(--vs-dim)]">1. signature check</div>
            {fullVerifyResult.sigCheck ? (
              <div className={"rounded-md border-l-2 px-2.5 py-1.5 text-[11px] " + (fullVerifyResult.sigCheck.ok ? "border-[var(--vs-accent)] bg-[var(--vs-accentbg)]/30 text-[var(--vs-accent)]" : "border-[var(--vs-red)] bg-[var(--vs-redbg)]/30 text-[var(--vs-red)]")}>
                {fullVerifyResult.sigCheck.ok ? "✓" : "✗"} {fullVerifyResult.sigCheck.detail}
              </div>
            ) : (
              <div className="text-[11px] text-[var(--vs-dim)]">not checked</div>
            )}
          </div>

          {/* 2. hashes */}
          <div className="mb-3">
            <div className="mono mb-1 text-[10px] uppercase text-[var(--vs-dim)]">2. hash checks</div>
            <div className="space-y-1">
              {fullVerifyResult.hashChecks.map((c, i) => (
                <div key={i} className={"rounded-md border-l-2 px-2.5 py-1.5 text-[10px] " + (c.pass ? "border-[var(--vs-accent)] bg-[var(--vs-accentbg)]/30" : "border-[var(--vs-red)] bg-[var(--vs-redbg)]/30")}>
                  <div className={c.pass ? "text-[var(--vs-accent)]" : "text-[var(--vs-red)]"}>
                    {c.pass ? "✓" : "✗"} {c.name}
                  </div>
                  <div className="mono mt-0.5 text-[var(--vs-dim)]">
                    expected: <span className="text-[var(--vs-text2)]">{short(c.expected, 24)}</span>
                  </div>
                  <div className="mono text-[var(--vs-dim)]">
                    actual: <span className={c.pass ? "text-[var(--vs-text2)]" : "text-[var(--vs-red)]"}>{short(c.actual, 24)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. merkle inclusion proof */}
          {fullVerifyResult.merklePath && (
            <div>
              <div className="mono mb-1 text-[10px] uppercase text-[var(--vs-dim)]">3. merkle inclusion proof</div>
              <div className={"rounded-md border-l-2 px-2.5 py-1.5 text-[11px] " + (fullVerifyResult.merklePath.pass ? "border-[var(--vs-accent)] bg-[var(--vs-accentbg)]/30 text-[var(--vs-accent)]" : "border-[var(--vs-red)] bg-[var(--vs-redbg)]/30 text-[var(--vs-red)]")}>
                {fullVerifyResult.merklePath.pass ? "✓" : "✗"} recomputed root matches published root
              </div>
              {fullVerifyResult.merklePath.steps.length > 0 && (
                <div className="mt-1.5 space-y-1">
                  <div className="mono text-[10px] text-[var(--vs-dim)]">proof path ({fullVerifyResult.merklePath.steps.length} step{fullVerifyResult.merklePath.steps.length === 1 ? "" : "s"}):</div>
                  {fullVerifyResult.merklePath.steps.map((step, i) => (
                    <div key={i} className="mono flex items-center gap-1.5 rounded bg-[var(--vs-bg2)] px-2 py-1 text-[10px]">
                      <span className="text-[var(--vs-dim)]">step {i + 1}:</span>
                      <span className="text-[var(--vs-text2)]">{step.position === "left" ? "left sibling" : "right sibling"}</span>
                      <span className="text-[var(--vs-accent)]">{short(step.sibling, 20)}</span>
                    </div>
                  ))}
                  <div className="mono mt-1 text-[10px]">
                    <span className="text-[var(--vs-dim)]">recomputed root: </span>
                    <span className={fullVerifyResult.merklePath.pass ? "text-[var(--vs-accent)]" : "text-[var(--vs-red)]"}>{short(fullVerifyResult.merklePath.recomputedRoot, 24)}</span>
                  </div>
                  <div className="mono text-[10px]">
                    <span className="text-[var(--vs-dim)]">published root: </span>
                    <span className="text-[var(--vs-text2)]">{short(fullVerifyResult.merklePath.expectedRoot, 24)}</span>
                  </div>
                </div>
              )}
              {fullVerifyResult.merklePath.steps.length === 0 && (
                <div className="mono mt-1 text-[10px] text-[var(--vs-dim)]">single receipt — the leaf IS the root</div>
              )}
            </div>
          )}
        </Card>
      )}

      <Card title="PUBLISHED MERKLE ROOT">
        <div className="mono break-all text-[12px] text-[var(--vs-accent)]">{root}</div>
        <div className="mono mt-1 text-[10px] text-[var(--vs-dim)]">
          a stranger compares this against the genesis board / commit view. if it matches, the whole chain is committed.
        </div>
      </Card>

      <div className="vvu-doc">
        <div className="callout">
          <strong>The test, fully realized.</strong> A stranger gets: the pubKey (to verify sigs),
          the merkle root (to verify the whole chain), and any single receipt + its merkle proof
          (to verify inclusion). All public. All re-computable. No trust required.
        </div>
      </div>
    </div>
  );
}

export { short };
