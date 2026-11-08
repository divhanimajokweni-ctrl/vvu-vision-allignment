/**
 * VVU · STUDIO — the receipts (capability 3 + 4 + 6).
 * Each receipt: hash + signature + timestamp + first-failing-rule.
 * A stranger re-verifies it without trusting you.
 *
 * This view also hosts:
 *   - the tamper demo (capability 6: fail visible, loudly)
 *   - the stranger-verify panel (capability 3 test)
 *   - export to JSON (capability 3: stranger re-verifies out-of-band)
 *   - the chain timeline (visual)
 */
"use client";
import { useState } from "react";
import { useStudio } from "@/lib/vvu-studio/store";
import { short } from "@/lib/vvu-studio/crypto";
import { type StrangerVerifyInput } from "@/lib/vvu-studio/loop";
import { Card, Badge, Button, GateBadge } from "../ui";
import { Icon } from "../Icons";

function VerdictBadge({ v }: { v: "PASS" | "FAIL" | "CANT_DECIDE" }) {
  if (v === "PASS") return <Badge tone="pass">PASS</Badge>;
  if (v === "FAIL") return <Badge tone="fail">FAIL</Badge>;
  return <Badge tone="stub">CAN'T DECIDE</Badge>;
}

export function ReceiptsView() {
  const loopReceipts = useStudio((s) => s.loopReceipts);
  const verifyLoopChain = useStudio((s) => s.verifyLoopChain);
  const resetLoop = useStudio((s) => s.resetLoop);
  const loopVerify = useStudio((s) => s.loopVerify);
  const tamperReceipt = useStudio((s) => s.tamperReceipt);
  const restoreReceipt = useStudio((s) => s.restoreReceipt);
  const exportReceipts = useStudio((s) => s.exportReceipts);
  const exportReceiptWithProof = useStudio((s) => s.exportReceiptWithProof);
  const runStrangerVerify = useStudio((s) => s.runStrangerVerify);
  const strangerResult = useStudio((s) => s.strangerResult);
  const showToast = useStudio((s) => s.showToast);
  const [strangerInput, setStrangerInput] = useState("");
  const [copied, setCopied] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const reversed = [...loopReceipts].reverse();

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
    showToast("receipts exported to /download", "ok");
  };

  const doCopy = (hash: string, seq: number) => {
    navigator.clipboard?.writeText(hash).then(() => {
      setCopied(seq);
      setTimeout(() => setCopied(null), 1500);
      showToast(`#${seq} hash copied`, "ok");
    }).catch(() => showToast("copy failed", "err"));
  };

  const doStrangerVerify = () => {
    try {
      const parsed = JSON.parse(strangerInput);
      // accept either a single receipt or {receipts:[...]}
      const arr: unknown[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed.receipts) ? parsed.receipts : [parsed];
      if (!arr.length) { showToast("no receipts in input", "err"); return; }
      const first = arr[0] as StrangerVerifyInput;
      runStrangerVerify(first);
    } catch {
      showToast("invalid JSON", "err");
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="vvu-doc">
        <div className="vk">the loop / receipts.json</div>
        <h1>The Receipts · capability 3 + 4</h1>
        <p className="lede">
          Hash of the record. Signature over the hash. Timestamp. A stranger verifies it
          without trusting you. The number is one line:{" "}
          <code className="rounded bg-[var(--vs-bg3)] px-1 text-[var(--vs-accent)]">RECEIPTS: {loopReceipts.length}</code>.
        </p>
      </div>

      {/* CHAIN TIMELINE — visual */}
      {loopReceipts.length > 0 && (
        <Card title="CHAIN TIMELINE">
          <ChainTimeline
            receipts={loopReceipts}
            intact={loopVerify ? loopVerify.intact : true}
          />
        </Card>
      )}

      <Card
        title={`RECEIPTS: ${loopReceipts.length}`}
        right={
          <div className="flex gap-1.5">
            <Button variant="primary" onClick={verifyLoopChain}><Icon name="shield" size={13} /> Verify</Button>
            <Button onClick={doExport}><Icon name="download" size={13} /> Export</Button>
            <Button variant="danger" onClick={resetLoop}><Icon name="trash" size={13} /> Reset</Button>
          </div>
        }
      >
        {loopVerify && (
          <div className={"mb-3 rounded-md border-l-2 px-3 py-2 text-[12px] " + (loopVerify.intact ? "border-[var(--vs-accent)] bg-[var(--vs-accentbg)]/40 text-[var(--vs-accent)]" : "border-[var(--vs-red)] bg-[var(--vs-redbg)]/40 text-[var(--vs-red)]")}>
            {loopVerify.intact ? `✓ CHAIN INTACT · ${loopReceipts.length} receipts re-verified` : `✗ CHAIN BROKEN · ${loopVerify.failures.length} failure(s)`}
          </div>
        )}

        {loopReceipts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Icon name="shield" size={32} className="text-[var(--vs-dimmer)]" />
            <div className="mono text-[11px] tracking-[0.18em] text-[var(--vs-dimmer)]">NO RECEIPTS</div>
            <div className="text-[12px] text-[var(--vs-dim)]">Run the loop to produce the first receipt.</div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {reversed.map((r) => {
              const isTampered = loopVerify && !loopVerify.intact && loopVerify.failures.some((f) => f.message.includes(`#${r.seq}`));
              return (
                <div
                  key={r.seq}
                  className={
                    "rounded-md border p-2.5 transition-colors " +
                    (isTampered
                      ? "border-[var(--vs-red)] bg-[var(--vs-redbg)]/30"
                      : "border-[var(--vs-border2)] bg-[var(--vs-bg3)]/40")
                  }
                >
                  <div className="flex items-center gap-2">
                    <span className="mono w-8 text-[var(--vs-dim)]">#{r.seq}</span>
                    <VerdictBadge v={r.verdict} />
                    <span className="mono text-[11px] text-[var(--vs-accent)]">{short(r.recordHash, 20)}</span>
                    <button
                      onClick={() => doCopy(r.recordHash, r.seq)}
                      className="ml-0.5 rounded p-0.5 text-[var(--vs-dimmer)] hover:text-[var(--vs-accent)]"
                      title="copy record hash"
                    >
                      <Icon name="copy" size={11} />
                    </button>
                    <button
                      onClick={() => setExpanded(expanded === r.seq ? null : r.seq)}
                      className="mono ml-auto rounded border border-[var(--vs-border2)] bg-[var(--vs-bg)] px-1.5 py-0.5 text-[9px] text-[var(--vs-dim)] hover:text-[var(--vs-text2)]"
                      title={expanded === r.seq ? "collapse" : "expand full details"}
                    >
                      {expanded === r.seq ? "▾" : "▸"} details
                    </button>
                  </div>
                  {r.firstFail && (
                    <div className="mt-1.5 pl-10 text-[11px] text-[var(--vs-red)]">
                      first fail: <span className="mono">{r.firstFail.id} {r.firstFail.name}</span> — {r.firstFail.reason}
                    </div>
                  )}
                  <div className="mt-1.5 flex flex-wrap gap-1 pl-10">
                    {r.rules.map((g) => (
                      <span key={g.id} className="flex items-center gap-0.5">
                        <GateBadge status={g.verdict === "CANT_DECIDE" ? "CANNOT_COMPUTE" : g.verdict} />
                        <span className="mono text-[9px] text-[var(--vs-dim)]">{g.id}</span>
                      </span>
                    ))}
                  </div>
                  {/* expandable full detail */}
                  {expanded === r.seq && (
                    <div className="mt-2 space-y-1.5 rounded-md border border-[var(--vs-border)] bg-[var(--vs-bg2)] p-2.5 pl-10">
                      <div><span className="mono text-[9px] uppercase text-[var(--vs-dim)]">canonical observation</span><pre className="mono mt-0.5 max-h-32 overflow-y-auto whitespace-pre-wrap break-all text-[10px] text-[var(--vs-text2)]">{r.canonical}</pre></div>
                      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                        <div><span className="mono text-[9px] uppercase text-[var(--vs-dim)]">record hash</span><div className="mono break-all text-[10px] text-[var(--vs-accent)]">{r.recordHash}</div></div>
                        <div><span className="mono text-[9px] uppercase text-[var(--vs-dim)]">receipt hash</span><div className="mono break-all text-[10px] text-[var(--vs-accent)]">{r.receiptHash}</div></div>
                        <div><span className="mono text-[9px] uppercase text-[var(--vs-dim)]">prev hash</span><div className="mono break-all text-[10px] text-[var(--vs-text2)]">{r.prevHash}</div></div>
                        <div><span className="mono text-[9px] uppercase text-[var(--vs-dim)]">signature (stubbed)</span><div className="mono break-all text-[10px] text-[var(--vs-amber)]">{r.sig}</div></div>
                      </div>
                      <div><span className="mono text-[9px] uppercase text-[var(--vs-dim)]">timestamp</span><span className="mono ml-2 text-[10px] text-[var(--vs-text)]">{r.ts}</span></div>
                      <div><span className="mono text-[9px] uppercase text-[var(--vs-dim)]">rule verdicts ({r.rules.length})</span>
                        <div className="mt-1 space-y-0.5">
                          {r.rules.map((g) => (
                            <div key={g.id} className="flex items-center gap-1.5 text-[10px]">
                              <GateBadge status={g.verdict === "CANT_DECIDE" ? "CANNOT_COMPUTE" : g.verdict} />
                              <span className="mono text-[var(--vs-text2)]">{g.id} {g.name}</span>
                              <span className="mono ml-auto text-[var(--vs-dim)]">{g.reason}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {/* tamper / restore / export-proof controls */}
                  <div className="mt-2 flex flex-wrap gap-1.5 border-t border-[var(--vs-border)] pt-2 pl-10">
                    <button
                      onClick={() => tamperReceipt(r.seq)}
                      className="mono rounded border border-[var(--vs-border2)] bg-[var(--vs-bg)] px-2 py-1 text-[10px] text-[var(--vs-amber)] hover:border-[var(--vs-amber)] hover:bg-[var(--vs-amberbg)]"
                    >
                      ⚠ tamper
                    </button>
                    <button
                      onClick={() => restoreReceipt(r.seq)}
                      className="mono rounded border border-[var(--vs-border2)] bg-[var(--vs-bg)] px-2 py-1 text-[10px] text-[var(--vs-accent)] hover:border-[var(--vs-accent)] hover:bg-[var(--vs-accentbg)]"
                    >
                      ↻ restore
                    </button>
                    <button
                      onClick={() => exportReceiptWithProof(r.seq)}
                      className="mono rounded border border-[var(--vs-border2)] bg-[var(--vs-bg)] px-2 py-1 text-[10px] text-[var(--vs-blue)] hover:border-[var(--vs-blue)] hover:bg-[#0a1330]"
                      title="export this receipt + its merkle proof"
                    >
                      <Icon name="download" size={10} /> proof
                    </button>
                    <span className="mono ml-auto self-center text-[9px] text-[var(--vs-dimmer)]">cap 6 · fail visible</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* STRANGER-VERIFY — capability 3 test */}
      <Card title="STRANGER-VERIFY · capability 3 test">
        <div className="text-[12px] text-[var(--vs-dim)]">
          A stranger pastes a receipt (or an exported JSON) and re-verifies it independently —
          no trust required. The stranger recomputes the hashes and compares.
        </div>
        <textarea
          className="vvu-input mono mt-2 h-28 w-full resize-y text-[10px] leading-[1.5]"
          spellCheck={false}
          placeholder='Paste a receipt JSON, e.g. {"seq":1,"ts":"…","canonical":"…","recordHash":"…","receiptHash":"…","prevHash":"0…"}'
          value={strangerInput}
          onChange={(e) => setStrangerInput(e.target.value)}
        />
        <div className="mt-2 flex gap-1.5">
          <Button variant="primary" onClick={doStrangerVerify} disabled={!strangerInput.trim()}>
            <Icon name="shield" size={13} /> Verify independently
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              const last = loopReceipts[loopReceipts.length - 1];
              if (last) setStrangerInput(JSON.stringify({
                seq: last.seq, ts: last.ts, canonical: last.canonical,
                recordHash: last.recordHash, receiptHash: last.receiptHash, prevHash: last.prevHash,
              }, null, 2));
            }}
            disabled={loopReceipts.length === 0}
          >
            Load last receipt
          </Button>
        </div>

        {strangerResult && (
          <div className={"mt-3 rounded-md border-l-2 px-3 py-2 " + (strangerResult.ok ? "border-[var(--vs-accent)] bg-[var(--vs-accentbg)]/40" : "border-[var(--vs-red)] bg-[var(--vs-redbg)]/40")}>
            <div className={"mono text-[12px] font-semibold " + (strangerResult.ok ? "text-[var(--vs-accent)]" : "text-[var(--vs-red)]")}>
              {strangerResult.ok ? "✓ receipt re-verifies independently" : "✗ receipt FAILS independent re-verify"}
            </div>
            <div className="mt-2 space-y-1">
              {strangerResult.checks.map((c, i) => (
                <div key={i} className="mono text-[10px]">
                  <span className={c.pass ? "text-[var(--vs-accent)]" : "text-[var(--vs-red)]"}>
                    {c.pass ? "✓" : "✗"} {c.name}
                  </span>
                  <div className="ml-3 text-[var(--vs-dim)]">
                    expected: <span className="text-[var(--vs-text2)]">{short(c.expected, 24)}</span>
                  </div>
                  <div className="ml-3 text-[var(--vs-dim)]">
                    actual: <span className={c.pass ? "text-[var(--vs-text2)]" : "text-[var(--vs-red)]"}>{short(c.actual, 24)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card title="THE CHAIN RULE">
        <div className="mono rounded-md border border-[var(--vs-border)] bg-[#050507] px-3 py-2 text-[11px] text-[var(--vs-text2)]">
          recordHash_i = SHA-256(canonical observation_i)
          <br />
          receiptHash_i = SHA-256(prevHash_i ‖ recordHash_i ‖ ts_i)
          <br />
          prevHash_<span className="text-[var(--vs-accent)]">{`{i+1}`}</span> = receiptHash_<span className="text-[var(--vs-accent)]">{`{i}`}</span>
        </div>
        <div className="mt-2 text-[11px] text-[var(--vs-dim)]">
          Genesis prevHash = <code className="mono text-[var(--vs-accent)]">{"0".repeat(8)}…</code> (64 zeros).
          Any tamper to a recordHash breaks every downstream receiptHash loudly.
        </div>
      </Card>
    </div>
  );
}

/* ---- Chain Timeline (SVG) ---- */

function ChainTimeline({ receipts, intact }: { receipts: { seq: number; verdict: string; recordHash: string; ts: string }[]; intact: boolean }) {
  const W = 600;
  const H = 56;
  const n = receipts.length;
  const step = n > 1 ? (W - 40) / (n - 1) : 0;
  const x = (i: number) => 20 + i * step;
  const cy = 28;
  const color = (v: string) => v === "PASS" ? "var(--vs-accent)" : v === "FAIL" ? "var(--vs-red)" : "var(--vs-amber)";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {/* genesis */}
      <circle cx={6} cy={cy} r={3} fill="var(--vs-dim)" />
      <text x={6} y={H - 4} fill="var(--vs-dimmer)" fontSize={7} fontFamily="monospace" textAnchor="middle">0×64</text>
      <line x1={9} y1={cy} x2={x(0) - 6} y2={cy} stroke={intact ? "var(--vs-border3)" : "var(--vs-red)"} strokeWidth={1} strokeDasharray="2 2" />
      {/* links + nodes */}
      {receipts.map((r, i) => {
        const cx = x(i);
        const nextX = i < n - 1 ? x(i + 1) : cx;
        return (
          <g key={r.seq}>
            {i < n - 1 && (
              <line
                x1={cx + 6} y1={cy} x2={nextX - 6} y2={cy}
                stroke={intact ? "var(--vs-accent)" : "var(--vs-red)"}
                strokeWidth={1.5}
                opacity={0.6}
              />
            )}
            <circle cx={cx} cy={cy} r={6} fill={color(r.verdict)} stroke="var(--vs-bg2)" strokeWidth={1.5} />
            <text x={cx} y={16} fill="var(--vs-dim)" fontSize={8} fontFamily="monospace" textAnchor="middle">#{r.seq}</text>
            <text x={cx} y={H - 4} fill={color(r.verdict)} fontSize={7} fontFamily="monospace" textAnchor="middle">{r.ts.slice(11, 19)}</text>
          </g>
        );
      })}
    </svg>
  );
}
