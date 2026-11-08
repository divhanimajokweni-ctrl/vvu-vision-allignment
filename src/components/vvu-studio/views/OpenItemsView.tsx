/**
 * VVU · STUDIO — open items (capability 5).
 * Close an open item by producing the artifact.
 * No artifact → stays open, reason is specific: "no artifact".
 * Not "missing Role 3". Not "State 4 required".
 *
 * The close is backed by a REAL receipt: the artifact hash is embedded in
 * the observation → part of the canonical → part of the recordHash →
 * verifiable by a stranger.
 */
"use client";
import { useState } from "react";
import { useStudio } from "@/lib/vvu-studio/store";
import { short } from "@/lib/vvu-studio/crypto";
import { Card, Badge, Button, Field } from "../ui";
import { Icon } from "../Icons";

export function OpenItemsView() {
  const openItems = useStudio((s) => s.openItems);
  const loopReceipts = useStudio((s) => s.loopReceipts);
  const closeOpenItem = useStudio((s) => s.closeOpenItem);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const openCount = openItems.filter((i) => !i.artifactProduced).length;
  const closedCount = openItems.length - openCount;

  const findReceipt = (seq: number | null) => seq ? loopReceipts.find((r) => r.seq === seq) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="vvu-doc">
        <div className="vk">the loop / items.py</div>
        <h1>Open Items · capability 5</h1>
        <p className="lede">
          You have the file? Submit it. It closes — and the close is backed by a real receipt.
          The artifact hash is on the receipt. You don't have it? It stays open,
          reason specific: <strong>"no artifact."</strong>
          Not "missing Role 3." Not "State 4 required."
        </p>
      </div>

      <Card title={`OPEN ITEMS · ${openCount} open · ${closedCount} closed`}>
        <div className="space-y-2">
          {openItems.map((it) => {
            const closed = !!it.artifactProduced;
            const closeReceipt = it.closedBySeq == null ? undefined : findReceipt(it.closedBySeq);
            return (
              <div
                key={it.id}
                className={
                  "rounded-md border px-3 py-2 transition-colors " +
                  (closed
                    ? "border-[#065f46]/50 bg-[var(--vs-accentbg)]/30"
                    : "border-[var(--vs-border2)] bg-[var(--vs-bg3)]/40 hover:border-[var(--vs-border3)]")
                }
              >
                <div className="flex items-center gap-2">
                  <span className="mono text-[11px] text-[var(--vs-text)]">{it.id}</span>
                  <span className="text-[12px] text-[var(--vs-text2)]">{it.title}</span>
                  {closed ? <Badge tone="pass">CLOSED</Badge> : <Badge tone="fail">OPEN</Badge>}
                  {closed && it.closedAt && (
                    <span className="mono ml-auto text-[10px] text-[var(--vs-dimmer)]">{it.closedAt.slice(11, 19)}Z</span>
                  )}
                </div>
                <div className="mt-1.5 text-[11px]">
                  <span className="mono text-[10px] uppercase text-[var(--vs-dim)]">artifact required: </span>
                  <span className="mono text-[var(--vs-text2)]">{it.artifactRequired}</span>
                </div>
                {closed ? (
                  <div className="mt-2 space-y-1.5 border-t border-[var(--vs-border)] pt-2">
                    <div className="text-[11px]">
                      <span className="mono text-[10px] uppercase text-[var(--vs-dim)]">artifact produced: </span>
                      <span className="mono text-[var(--vs-accent)]">{it.artifactProduced}</span>
                    </div>
                    {it.artifactHash && (
                      <div className="text-[11px]">
                        <span className="mono text-[10px] uppercase text-[var(--vs-dim)]">artifact hash: </span>
                        <span className="mono break-all text-[var(--vs-accent)]">{it.artifactHash}</span>
                      </div>
                    )}
                    {closeReceipt && (
                      <div className="rounded-md bg-[var(--vs-bg2)] p-2">
                        <div className="flex items-center gap-1.5">
                          <Icon name="shield" size={12} className="text-[var(--vs-accent)]" />
                          <span className="mono text-[10px] uppercase text-[var(--vs-dim)]">close receipt</span>
                          <span className="mono text-[11px] text-[var(--vs-text)]">#{closeReceipt.seq}</span>
                          {closeReceipt.verdict === "PASS" ? <Badge tone="pass">PASS</Badge> : <Badge tone="fail">FAIL</Badge>}
                        </div>
                        <div className="mt-1 mono break-all text-[10px] text-[var(--vs-accent)]">
                          {closeReceipt.recordHash}
                        </div>
                        <div className="mt-0.5 mono text-[9px] text-[var(--vs-dim)]">
                          recordHash = SHA-256(canonical) · the artifact hash is embedded in the observation
                        </div>
                      </div>
                    )}
                    {it.closedBySeq && (
                      <div className="mono text-[10px] text-[var(--vs-dim)]">
                        a stranger re-verifies: SHA-256(artifact content) must equal the hash embedded in receipt #{it.closedBySeq}'s observation
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-2 flex items-end gap-1.5">
                    <Field label="produce the artifact">
                      <input
                        className="vvu-input"
                        placeholder={it.artifactRequired}
                        value={drafts[it.id] ?? ""}
                        onChange={(e) => setDrafts({ ...drafts, [it.id]: e.target.value })}
                      />
                    </Field>
                    <Button variant="primary" onClick={() => { closeOpenItem(it.id, drafts[it.id] ?? null); setDrafts({ ...drafts, [it.id]: "" }); }}>
                      Submit artifact
                    </Button>
                    <Button variant="ghost" onClick={() => { closeOpenItem(it.id, null); setDrafts({ ...drafts, [it.id]: "" }); }}>
                      Submit nothing
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="vvu-doc">
        <div className="callout">
          <strong>What I got wrong before.</strong> I invented roles. Roles are human
          coordination, not system capability. I invented states. Same thing. An item
          closes because the artifact is produced — and now the close is backed by a
          receipt with the artifact hash. A stranger can verify it.
        </div>
      </div>

      <Card title="THE TEST">
        <div className="flex items-center gap-2 text-[12px] text-[var(--vs-text2)]">
          <Icon name="shield" size={16} className="text-[var(--vs-accent)]" />
          Can a stranger close an open item? Yes — by producing the artifact. The reason
          for an open item is always specific: <span className="mono text-[var(--vs-amber)]">no artifact</span>.
          And the close is verifiable: the artifact hash is on the receipt.
        </div>
      </Card>
    </div>
  );
}

export { short };
