/**
 * VVU · STUDIO — the commitment (capability 3 anchor).
 *
 * The merkle root: a single hash committing to ALL receipts. A stranger
 * compares this one hash against the published value to verify the whole
 * chain hasn't been tampered with — without checking each receipt.
 *
 * Also hosts:
 *   - the genesis board (publish the genesis receipt hash out-of-band)
 *   - the Ed25519 signature status (real vs honest stub)
 */
"use client";
import { useStudio } from "@/lib/vvu-studio/store";
import { merkleTree, isEd25519Available } from "@/lib/vvu-studio/loop";
import { short } from "@/lib/vvu-studio/crypto";
import { Card, Badge, Button } from "../ui";
import { Icon } from "../Icons";
import { useEffect, useState } from "react";

export function CommitView() {
  const loopReceipts = useStudio((s) => s.loopReceipts);
  const merkleRootLine = useStudio((s) => s.merkleRootLine);
  const publishGenesis = useStudio((s) => s.publishGenesis);
  const signAllPending = useStudio((s) => s.signAllPending);
  const ed25519Available = useStudio((s) => s.ed25519Available);
  const pubKeyHex = useStudio((s) => s.pubKeyHex);
  const keyOrigin = useStudio((s) => s.keyOrigin);
  const exportReceipts = useStudio((s) => s.exportReceipts);
  const showToast = useStudio((s) => s.showToast);
  const [localEd, setLocalEd] = useState<boolean | null>(ed25519Available);

  useEffect(() => {
    void isEd25519Available().then((avail) => {
      setLocalEd(ed25519Available ?? avail);
    });
  }, [ed25519Available]);

  const root = merkleRootLine().replace("MERKLE ROOT: ", "");
  const tree = merkleTree(loopReceipts);
  const genesis = loopReceipts[0];
  const realSigCount = loopReceipts.filter((r) => !r.sigStub).length;
  const stubSigCount = loopReceipts.filter((r) => r.sigStub).length;

  const doExport = () => {
    const json = exportReceipts();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vvu-studio-receipts-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("receipts exported (incl. merkle root)", "ok");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="vvu-doc">
        <div className="vk">the loop / commit.py</div>
        <h1>The Commitment · capability 3 anchor</h1>
        <p className="lede">
          The merkle root: one hash committing to <strong>all</strong> receipts.
          A stranger compares this single value against the published board to verify
          the whole chain — without checking each receipt.
        </p>
      </div>

      {/* MERKLE ROOT — the single commitment */}
      <Card title="MERKLE ROOT · single commitment">
        <div className="flex flex-col items-center gap-2 py-2 text-center">
          <div className="mono text-[10px] uppercase tracking-[0.2em] text-[var(--vs-dim)]">SHA-256 over all receipt hashes</div>
          <div className="mono max-w-full break-all px-4 text-[14px] font-bold text-[var(--vs-accent)] sm:text-[16px]">
            {root}
          </div>
          <div className="mono text-[10px] text-[var(--vs-dim)]">
            {loopReceipts.length} receipt{loopReceipts.length === 1 ? "" : "s"} committed ·{" "}
            {tree.length} tree level{tree.length === 1 ? "" : "s"}
          </div>
        </div>
      </Card>

      {/* MERKLE TREE VISUALIZATION */}
      {loopReceipts.length > 0 && (
        <Card title="MERKLE TREE">
          <MerkleTreeSVG levels={tree} root={root} />
          <div className="mono mt-2 text-[10px] text-[var(--vs-dim)]">
            leaves = receiptHashes · internal = SHA-256(left ‖ right) · odd counts duplicate the last
          </div>
        </Card>
      )}

      {/* SIGNATURE STATUS — Ed25519 or honest stub */}
      <Card title="SIGNATURE LAYER">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="mono text-[11px] uppercase text-[var(--vs-dim)]">algorithm:</span>
            {localEd === true ? (
              <Badge tone="pass">Ed25519 (real · Web Crypto)</Badge>
            ) : localEd === false ? (
              <Badge tone="stub">HMAC-SHA256 (stub fallback)</Badge>
            ) : (
              <Badge>checking…</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="mono text-[11px] uppercase text-[var(--vs-dim)]">key persistence:</span>
            {keyOrigin === "indexeddb" ? (
              <Badge tone="pass">IndexedDB · survives reload</Badge>
            ) : keyOrigin === "fresh" ? (
              <Badge tone="stub">fresh this session</Badge>
            ) : (
              <Badge>not yet generated</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="mono text-[var(--vs-dim)]">signed:</span>
            <span className="mono text-[var(--vs-accent)]">{realSigCount} real</span>
            <span className="mono text-[var(--vs-amber)]">{stubSigCount} stub</span>
          </div>
          {pubKeyHex && (
            <div className="rounded-md border border-[var(--vs-border)] bg-[var(--vs-bg2)] p-2">
              <div className="mono text-[10px] uppercase text-[var(--vs-dim)]">public key (publish this for strangers)</div>
              <div className="mono mt-0.5 break-all text-[10px] text-[var(--vs-accent)]">{pubKeyHex}</div>
            </div>
          )}
          {genesis && (
            <div className="rounded-md border border-[var(--vs-border)] bg-[var(--vs-bg2)] p-2.5">
              <div className="mono text-[10px] uppercase text-[var(--vs-dim)]">genesis receipt #1 signature</div>
              <div className="mono mt-0.5 text-[11px] text-[var(--vs-text2)]">alg: {genesis.sigAlg}</div>
              {genesis.sigPubKey && (
                <div className="mono text-[10px] text-[var(--vs-accent)]">pubKey: {short(genesis.sigPubKey, 24)}</div>
              )}
              <div className="mono break-all text-[10px] text-[var(--vs-amber)]">sig: {genesis.sig}</div>
            </div>
          )}
          <div className="flex gap-1.5">
            <Button onClick={() => void signAllPending()}>
              <Icon name="shield" size={13} /> Re-sign all
            </Button>
          </div>
        </div>
      </Card>

      {/* GENESIS BOARD — publish out-of-band */}
      {genesis && (
        <Card title="GENESIS BOARD · publish out-of-band">
          <div className="space-y-1.5 text-[11px]">
            <div><span className="mono text-[10px] uppercase text-[var(--vs-dim)]">genesis recordHash</span><div className="mono break-all text-[var(--vs-accent)]">{genesis.recordHash}</div></div>
            <div><span className="mono text-[10px] uppercase text-[var(--vs-dim)]">genesis receiptHash</span><div className="mono break-all text-[var(--vs-accent)]">{genesis.receiptHash}</div></div>
            <div><span className="mono text-[10px] uppercase text-[var(--vs-dim)]">genesis ts</span><span className="mono ml-2 text-[var(--vs-text)]">{genesis.ts}</span></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Button variant="primary" onClick={publishGenesis}>
              <Icon name="download" size={13} /> Publish genesis board
            </Button>
            <Button onClick={doExport}>
              <Icon name="download" size={13} /> Export full receipts
            </Button>
          </div>
          <div className="mono mt-2 rounded-md border border-[var(--vs-border)] bg-[#050507] px-3 py-2 text-[10px] text-[var(--vs-text2)]">
            # a stranger compares the genesis recordHash against the published board.<br />
            # if it matches, the chain root is authentic. the merkle root commits to everything after.
          </div>
        </Card>
      )}

      <div className="vvu-doc">
        <div className="callout">
          <strong>The test, restated.</strong> A stranger gets three things: the genesis board
          (root authenticity), the merkle root (whole-chain commitment), and any single receipt
          (verifiable independently). All three are public. No trust required.
        </div>
      </div>
    </div>
  );
}

/* ---- Merkle Tree SVG ---- */

function MerkleTreeSVG({ levels, root }: { levels: string[][]; root: string }) {
  const W = 600;
  const leafCount = levels[0]?.length ?? 0;
  const H = Math.max(80, 40 + levels.length * 50);
  const nodeR = 8;
  const colorFor = (h: string) => h === root ? "var(--vs-accent)" : "var(--vs-border3)";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {levels.map((level, li) => {
        const y = 20 + li * 45;
        const isRoot = li === levels.length - 1;
        const isLeaf = li === 0;
        return level.map((hash, i) => {
          const n = level.length;
          const x = n === 1 ? W / 2 : (W / (n + 1)) * (i + 1);
          const parentLi = li + 1;
          const parentLevel = levels[parentLi];
          const parentIdx = Math.floor(i / 2);
          const parentN = parentLevel?.length ?? 0;
          const parentX = parentN === 0 ? null : parentN === 1 ? W / 2 : (W / (parentN + 1)) * (parentIdx + 1);
          const parentY = parentX !== null ? 20 + parentLi * 45 : null;
          return (
            <g key={`${li}-${i}`}>
              {parentX !== null && parentY !== null && (
                <line x1={x} y1={y + nodeR} x2={parentX} y2={parentY - nodeR} stroke={colorFor(hash)} strokeWidth={1} opacity={0.5} />
              )}
              <circle
                cx={x} cy={y} r={nodeR}
                fill={isRoot ? "var(--vs-accent)" : isLeaf ? "var(--vs-bg2)" : "var(--vs-bg3)"}
                stroke={colorFor(hash)}
                strokeWidth={isRoot ? 2 : 1.5}
              />
              {(isLeaf || isRoot) && (
                <text
                  x={x} y={isLeaf ? y + nodeR + 12 : y - nodeR - 6}
                  fill={isRoot ? "var(--vs-accent)" : "var(--vs-dim)"}
                  fontSize={isRoot ? 8 : 7}
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {isRoot ? short(hash, 12) : `#${i + 1}`}
                </text>
              )}
              {!isLeaf && !isRoot && (
                <text x={x} y={y + 3} fill="var(--vs-dim)" fontSize={6} fontFamily="monospace" textAnchor="middle">·</text>
              )}
            </g>
          );
        });
      })}
    </svg>
  );
}
