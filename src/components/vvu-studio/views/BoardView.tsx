/**
 * VVU · STUDIO — the public board (capability 3 anchor).
 *
 * Everything a stranger needs, in one place:
 *   - the public key (to verify signatures)
 *   - the merkle root (whole-chain commitment)
 *   - the genesis receipt (root authenticity)
 *   - the chain summary (receipt count, integrity)
 *
 * One click exports the whole board as JSON — publish it out-of-band.
 * A stranger verifies the entire chain from this single artifact.
 */
"use client";
import { useStudio } from "@/lib/vvu-studio/store";
import { short } from "@/lib/vvu-studio/crypto";
import { Card, Badge, Button } from "../ui";
import { Icon } from "../Icons";
import { useState } from "react";

export function BoardView() {
  const loopReceipts = useStudio((s) => s.loopReceipts);
  const merkleRootLine = useStudio((s) => s.merkleRootLine);
  const exportBoard = useStudio((s) => s.exportBoard);
  const exportReceiptWithProof = useStudio((s) => s.exportReceiptWithProof);
  const exportVerifyHTML = useStudio((s) => s.exportVerifyHTML);
  const exportChainHTML = useStudio((s) => s.exportChainHTML);
  const exportReceipts = useStudio((s) => s.exportReceipts);
  const pubKeyHex = useStudio((s) => s.pubKeyHex);
  const keyOrigin = useStudio((s) => s.keyOrigin);
  const ed25519Available = useStudio((s) => s.ed25519Available);
  const showToast = useStudio((s) => s.showToast);
  const [copied, setCopied] = useState<string | null>(null);

  const genesis = loopReceipts[0];
  const last = loopReceipts[loopReceipts.length - 1];
  const root = merkleRootLine().replace("MERKLE ROOT: ", "");

  const copy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
      showToast(`${label} copied`, "ok");
    }).catch(() => showToast("copy failed", "err"));
  };

  const doExportAll = () => {
    const json = exportReceipts();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vvu-studio-all-receipts-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("all receipts exported", "ok");
  };

  if (!genesis) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4">
        <div className="vvu-doc">
          <div className="vk">the loop / board.py</div>
          <h1>The Public Board</h1>
          <p className="lede">No receipts yet. Run the loop first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="vvu-doc">
        <div className="vk">the loop / board.py</div>
        <h1>The Public Board · capability 3 anchor</h1>
        <p className="lede">
          Everything a stranger needs, in one place. Export it as JSON and publish out-of-band.
          A stranger verifies the entire chain from this single artifact — no trust required.
        </p>
      </div>

      {/* CHAIN SUMMARY */}
      <Card title="CHAIN SUMMARY">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="text-center">
            <div className="mono text-[24px] font-bold text-[var(--vs-accent)]">{loopReceipts.length}</div>
            <div className="mono text-[9px] uppercase tracking-[0.1em] text-[var(--vs-dim)]">receipts</div>
          </div>
          <div className="text-center">
            <div className="mono text-[24px] font-bold text-[var(--vs-text)]">#{genesis.seq}</div>
            <div className="mono text-[9px] uppercase tracking-[0.1em] text-[var(--vs-dim)]">genesis</div>
          </div>
          <div className="text-center">
            <div className="mono text-[24px] font-bold text-[var(--vs-text)]">#{last.seq}</div>
            <div className="mono text-[9px] uppercase tracking-[0.1em] text-[var(--vs-dim)]">latest</div>
          </div>
          <div className="text-center">
            <div className="mono text-[24px] font-bold text-[var(--vs-accent)]">{ed25519Available ? "Ed" : "HMAC"}</div>
            <div className="mono text-[9px] uppercase tracking-[0.1em] text-[var(--vs-dim)]">sig alg</div>
          </div>
        </div>
      </Card>

      {/* MERKLE ROOT — the single commitment */}
      <Card title="MERKLE ROOT · single commitment">
        <div className="flex items-start gap-2">
          <div className="mono flex-1 break-all rounded-md border border-[var(--vs-border)] bg-[var(--vs-bg2)] px-3 py-2 text-[12px] text-[var(--vs-accent)]">
            {root}
          </div>
          <button
            onClick={() => copy(root, "merkle root")}
            className="mt-1 shrink-0 rounded border border-[var(--vs-border2)] bg-[var(--vs-bg3)] p-1.5 text-[var(--vs-dim)] hover:text-[var(--vs-accent)]"
            title="copy merkle root"
          >
            <Icon name="copy" size={14} />
          </button>
        </div>
        {copied === "merkle root" && <div className="mono mt-1 text-[10px] text-[var(--vs-accent)]">✓ copied</div>}
        <div className="mono mt-1 text-[10px] text-[var(--vs-dim)]">
          a stranger compares this single hash against the published board to verify the whole chain.
        </div>
      </Card>

      {/* PUBLIC KEY */}
      <Card title="PUBLIC KEY · for signature verification">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="mono text-[10px] uppercase text-[var(--vs-dim)]">algorithm:</span>
            {ed25519Available ? <Badge tone="pass">Ed25519</Badge> : <Badge tone="stub">HMAC-SHA256</Badge>}
            <span className="mono text-[10px] uppercase text-[var(--vs-dim)]">·</span>
            {keyOrigin === "indexeddb" ? <Badge tone="pass">IndexedDB</Badge> : <Badge tone="stub">session</Badge>}
          </div>
          {pubKeyHex && (
            <div className="flex items-start gap-2">
              <div className="mono flex-1 break-all rounded-md border border-[var(--vs-border)] bg-[var(--vs-bg2)] px-3 py-2 text-[11px] text-[var(--vs-accent)]">
                {pubKeyHex}
              </div>
              <button
                onClick={() => copy(pubKeyHex, "pubKey")}
                className="mt-1 shrink-0 rounded border border-[var(--vs-border2)] bg-[var(--vs-bg3)] p-1.5 text-[var(--vs-dim)] hover:text-[var(--vs-accent)]"
                title="copy public key"
              >
                <Icon name="copy" size={14} />
              </button>
            </div>
          )}
          {copied === "pubKey" && <div className="mono text-[10px] text-[var(--vs-accent)]">✓ copied</div>}
        </div>
      </Card>

      {/* GENESIS RECEIPT */}
      <Card title="GENESIS RECEIPT · root authenticity">
        <div className="space-y-1.5 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="mono text-[10px] uppercase text-[var(--vs-dim)]">seq:</span>
            <span className="mono text-[var(--vs-text)]">#{genesis.seq}</span>
            <span className="mono text-[10px] uppercase text-[var(--vs-dim)]">· ts:</span>
            <span className="mono text-[var(--vs-text)]">{genesis.ts}</span>
          </div>
          <div>
            <span className="mono text-[10px] uppercase text-[var(--vs-dim)]">recordHash:</span>
            <div className="mono break-all text-[var(--vs-accent)]">{genesis.recordHash}</div>
          </div>
          <div>
            <span className="mono text-[10px] uppercase text-[var(--vs-dim)]">receiptHash:</span>
            <div className="mono break-all text-[var(--vs-accent)]">{genesis.receiptHash}</div>
          </div>
          <div>
            <span className="mono text-[10px] uppercase text-[var(--vs-dim)]">signature ({genesis.sigAlg}):</span>
            <div className="mono break-all text-[var(--vs-amber)]">{genesis.sig}</div>
          </div>
        </div>
      </Card>

      {/* EXPORT BUTTONS */}
      <Card title="EXPORT · publish out-of-band">
        <div className="flex flex-wrap gap-1.5">
          <Button variant="primary" onClick={exportBoard}>
            <Icon name="download" size={13} /> Export public board
          </Button>
          <Button onClick={doExportAll}>
            <Icon name="download" size={13} /> Export all receipts
          </Button>
          <Button onClick={exportChainHTML}>
            <Icon name="download" size={13} /> Export full-chain HTML
          </Button>
        </div>
        <div className="mt-2 text-[12px] text-[var(--vs-dim)]">Self-verifying HTML per receipt (a stranger opens in any browser):</div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {loopReceipts.map((r) => (
            <div key={r.seq} className="flex gap-1">
              <Button variant="ghost" onClick={() => exportReceiptWithProof(r.seq)}>
                <Icon name="copy" size={12} /> #{r.seq} proof
              </Button>
              <Button variant="ghost" onClick={() => exportVerifyHTML(r.seq)}>
                <Icon name="download" size={12} /> #{r.seq} HTML
              </Button>
            </div>
          ))}
        </div>
        <div className="mono mt-2 rounded-md border border-[var(--vs-border)] bg-[#050507] px-3 py-2 text-[10px] text-[var(--vs-text2)]">
          # the public board is the single artifact a stranger needs.<br />
          # export-receipt + proof lets a stranger verify ONE receipt without the whole chain.<br />
          # the full-chain HTML re-verifies EVERY sig + EVERY chain link + the merkle root — one file, whole chain.<br />
          # the self-verifying HTML re-computes sig + hashes + merkle in the browser — no trust, no server.<br />
          # export all receipts gives the full chain for complete re-verification.
        </div>
      </Card>

      {/* THE STRANGER'S PROCEDURE */}
      <Card title="THE STRANGER'S PROCEDURE">
        <ol className="space-y-1.5 text-[12px] text-[var(--vs-text2)]">
          <li><span className="mono text-[var(--vs-accent)]">1.</span> Get the public board (this view, exported).</li>
          <li><span className="mono text-[var(--vs-accent)]">2.</span> Verify the genesis signature using the pubKey.</li>
          <li><span className="mono text-[var(--vs-accent)]">3.</span> Recompute the merkle root from all receipt hashes.</li>
          <li><span className="mono text-[var(--vs-accent)]">4.</span> Compare to the published merkle root.</li>
          <li><span className="mono text-[var(--vs-accent)]">5.</span> For a single receipt: verify its merkle proof against the root.</li>
          <li><span className="mono text-[var(--vs-accent)]">6.</span> All match → the chain is authentic. No trust required.</li>
        </ol>
      </Card>

      <div className="vvu-doc">
        <div className="callout">
          <strong>The test, fully consolidated.</strong> One board. One pubKey. One merkle root.
          One genesis receipt. A stranger verifies the whole chain — or a single receipt via its
          proof — from this. All public. All re-computable. No trust required.
        </div>
      </div>
    </div>
  );
}

export { short };
