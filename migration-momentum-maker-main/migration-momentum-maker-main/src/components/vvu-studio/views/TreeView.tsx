/**
 * VVU · STUDIO — interactive merkle-tree explorer (multi-select).
 *
 * Shows the full merkle tree as an interactive SVG. Click a leaf (receipt)
 * to highlight its path to the root — the merkle inclusion proof visualized.
 * Multi-select: click multiple leaves to highlight their paths simultaneously,
 * showing shared internal nodes (where proofs overlap).
 */
"use client";
import { useState } from "react";
import { useStudio } from "@/lib/vvu-studio/store";
import { merkleTree, merkleProof } from "@/lib/vvu-studio/loop";
import { short } from "@/lib/vvu-studio/crypto";
import { Card, Badge, Button } from "../ui";
import { Icon } from "../Icons";

export function TreeView() {
  const loopReceipts = useStudio((s) => s.loopReceipts);
  const merkleRootLine = useStudio((s) => s.merkleRootLine);
  const exportVerifyHTML = useStudio((s) => s.exportVerifyHTML);
  const [selectedSeqs, setSelectedSeqs] = useState<number[]>([]);

  const levels = merkleTree(loopReceipts);
  const root = merkleRootLine().replace("MERKLE ROOT: ", "");

  // build the set of (level, index) pairs on ALL selected proof paths
  const pathSet = new Set<string>();
  const siblingSet = new Set<string>();
  const proofsBySeq: Record<number, { idx: number; proof: ReturnType<typeof merkleProof> }> = {};
  for (const seq of selectedSeqs) {
    const idx = loopReceipts.findIndex((r) => r.seq === seq);
    if (idx < 0) continue;
    const proof = merkleProof(loopReceipts, idx);
    proofsBySeq[seq] = { idx, proof };
    let cur = idx;
    for (let li = 0; li < levels.length; li++) {
      pathSet.add(`${li}-${cur}`);
      cur = Math.floor(cur / 2);
    }
    proof.forEach((step, i) => {
      let sibIdx = idx;
      for (let j = 0; j < i; j++) sibIdx = Math.floor(sibIdx / 2);
      if (step.position === "right") siblingSet.add(`${i}-${sibIdx + 1}`);
      else siblingSet.add(`${i}-${sibIdx - 1}`);
    });
  }

  const toggle = (seq: number) => {
    setSelectedSeqs((prev) =>
      prev.includes(seq) ? prev.filter((s) => s !== seq) : [...prev, seq]
    );
  };

  const W = 700;
  const H = Math.max(80, 30 + levels.length * 56);
  const yFor = (li: number) => 24 + li * 46;
  const xFor = (li: number, i: number) => {
    const count = levels[li].length;
    if (count === 1) return W / 2;
    return (W / (count + 1)) * (i + 1);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="vvu-doc">
        <div className="vk">the loop / tree.py</div>
        <h1>Merkle Tree Explorer</h1>
        <p className="lede">
          The full merkle tree. Click leaves to highlight their paths to the root.
          Multi-select: click multiple leaves to see shared internal nodes (where
          proofs overlap). A stranger verifies a single receipt using only the
          sibling hashes along its path.
        </p>
      </div>

      {loopReceipts.length === 0 ? (
        <Card>
          <div className="py-6 text-center text-[12px] text-[var(--vs-dim)]">No receipts. Run the loop first.</div>
        </Card>
      ) : (
        <>
          <Card title={`MERKLE TREE · ${loopReceipts.length} leaves · ${levels.length} level${levels.length === 1 ? "" : "s"} · ${selectedSeqs.length} selected`}>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
              {/* links */}
              {levels.slice(0, -1).map((level, li) =>
                level.map((hash, i) => {
                  const x = xFor(li, i);
                  const y = yFor(li);
                  const parentIdx = Math.floor(i / 2);
                  const px = xFor(li + 1, parentIdx);
                  const py = yFor(li + 1);
                  const onPath = pathSet.has(`${li}-${i}`) && pathSet.has(`${li + 1}-${parentIdx}`);
                  return (
                    <line
                      key={`l-${li}-${i}`}
                      x1={x} y1={y + 8} x2={px} y2={py - 8}
                      stroke={onPath ? "var(--vs-accent)" : "var(--vs-border3)"}
                      strokeWidth={onPath ? 2 : 1}
                      opacity={onPath ? 0.9 : 0.3}
                    />
                  );
                })
              )}
              {/* nodes */}
              {levels.map((level, li) =>
                level.map((hash, i) => {
                  const x = xFor(li, i);
                  const y = yFor(li);
                  const isRoot = li === levels.length - 1;
                  const isLeaf = li === 0;
                  const onPath = pathSet.has(`${li}-${i}`);
                  const isSibling = siblingSet.has(`${li}-${i}`);
                  const isSelectedLeaf = isLeaf && selectedSeqs.includes(loopReceipts[i]?.seq);
                  const fill = isRoot ? "var(--vs-accent)" : isSelectedLeaf ? "var(--vs-accent2)" : onPath ? "var(--vs-accent)" : isSibling ? "var(--vs-amber)" : isLeaf ? "var(--vs-bg3)" : "var(--vs-bg2)";
                  const stroke = isRoot ? "var(--vs-accent)" : isSelectedLeaf ? "var(--vs-accent2)" : onPath ? "var(--vs-accent)" : isSibling ? "var(--vs-amber)" : "var(--vs-border2)";
                  return (
                    <g key={`n-${li}-${i}`}>
                      <circle
                        cx={x} cy={y} r={isRoot ? 10 : isLeaf ? 9 : 7}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={isRoot ? 2.5 : isSelectedLeaf ? 3 : onPath || isSibling ? 2 : 1.5}
                        className={isLeaf ? "cursor-pointer" : ""}
                        onClick={isLeaf ? () => toggle(loopReceipts[i]?.seq) : undefined}
                      >
                        {isLeaf && <title>receipt #{loopReceipts[i]?.seq} — click to {isSelectedLeaf ? "deselect" : "highlight"} path</title>}
                      </circle>
                      {isLeaf && (
                        <text x={x} y={y + 22} fill={isSelectedLeaf ? "var(--vs-accent2)" : onPath ? "var(--vs-accent)" : "var(--vs-dim)"} fontSize={9} fontFamily="monospace" textAnchor="middle">
                          #{loopReceipts[i]?.seq}
                        </text>
                      )}
                      {isRoot && (
                        <>
                          <text x={x} y={y - 16} fill="var(--vs-accent)" fontSize={9} fontFamily="monospace" textAnchor="middle">ROOT</text>
                          <text x={x} y={y + 24} fill="var(--vs-accent)" fontSize={7} fontFamily="monospace" textAnchor="middle">{short(hash, 12)}</text>
                        </>
                      )}
                      {isSibling && !isLeaf && (
                        <text x={x} y={y - 14} fill="var(--vs-amber)" fontSize={7} fontFamily="monospace" textAnchor="middle">sibling</text>
                      )}
                      {/* shared node indicator (on path for >1 selected) */}
                      {onPath && !isLeaf && !isRoot && selectedSeqs.length > 1 && (
                        <text x={x} y={y - 14} fill="var(--vs-accent)" fontSize={7} fontFamily="monospace" textAnchor="middle">shared</text>
                      )}
                    </g>
                  );
                })
              )}
            </svg>
            <div className="mono mt-2 text-[10px] text-[var(--vs-dim)]">
              {selectedSeqs.length === 0
                ? "click leaves to highlight their merkle paths → root (multi-select supported)"
                : `${selectedSeqs.length} receipt${selectedSeqs.length === 1 ? "" : "s"} selected · ${selectedSeqs.map((s) => "#" + s).join(", ")}`}
            </div>
          </Card>

          {/* selected receipts' proof paths */}
          {selectedSeqs.length > 0 && (
            <Card title={`MERKLE PROOFS · ${selectedSeqs.length} receipt${selectedSeqs.length === 1 ? "" : "s"} selected`}>
              <div className="space-y-3">
                {selectedSeqs.map((seq) => {
                  const info = proofsBySeq[seq];
                  if (!info) return null;
                  return (
                    <div key={seq} className="rounded-md border border-[var(--vs-border2)] bg-[var(--vs-bg3)]/40 p-2.5">
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="mono text-[11px] font-bold text-[var(--vs-accent2)]">#{seq}</span>
                        <span className="mono text-[10px] text-[var(--vs-dim)]">leaf (receiptHash):</span>
                        <span className="mono text-[10px] text-[var(--vs-accent)]">{short(loopReceipts[info.idx].receiptHash, 24)}</span>
                      </div>
                      {info.proof.map((step, i) => (
                        <div key={i} className="flex items-center gap-1.5 rounded bg-[var(--vs-bg2)] px-2 py-1 text-[10px]">
                          <span className="mono text-[var(--vs-dim)]">step {i + 1}:</span>
                          <Badge tone="stub">{step.position === "left" ? "L" : "R"}</Badge>
                          <span className="mono text-[var(--vs-amber)]">{short(step.sibling, 20)}</span>
                        </div>
                      ))}
                      <div className="mt-1 flex items-center gap-1.5 rounded bg-[var(--vs-accentbg)]/30 px-2 py-1 text-[10px]">
                        <span className="mono text-[var(--vs-dim)]">→ root:</span>
                        <span className="mono text-[var(--vs-accent)]">{short(root, 20)}</span>
                      </div>
                    </div>
                  );
                })}
                <div className="flex flex-wrap gap-1.5">
                  {selectedSeqs.length === 1 && (
                    <Button onClick={() => exportVerifyHTML(selectedSeqs[0])}>
                      <Icon name="download" size={12} /> Export self-verifying HTML
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => setSelectedSeqs([])}>Clear all</Button>
                  <Button variant="ghost" onClick={() => setSelectedSeqs(loopReceipts.map((r) => r.seq))}>Select all</Button>
                </div>
                {selectedSeqs.length > 1 && (
                  <div className="mono text-[10px] text-[var(--vs-dim)]">
                    {selectedSeqs.length} receipts selected · shared internal nodes (where proofs overlap) are labeled "shared" —
                    that's the merkle efficiency: a stranger verifies N receipts with fewer than N×log₂(N) siblings.
                  </div>
                )}
              </div>
            </Card>
          )}

          <Card title="MERKLE ROOT (single commitment)">
            <div className="mono break-all text-[12px] text-[var(--vs-accent)]">{root}</div>
          </Card>

          <div className="vvu-doc">
            <div className="callout">
              <strong>Why a merkle tree?</strong> A stranger verifies a single receipt's inclusion
              using only <code className="rounded bg-[var(--vs-bg3)] px-1 text-[var(--vs-accent)]">log₂(N)</code> sibling
              hashes — not the whole chain. Select multiple leaves to see shared internal nodes
              (where proofs overlap). The root commits to everything.
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export { short };
