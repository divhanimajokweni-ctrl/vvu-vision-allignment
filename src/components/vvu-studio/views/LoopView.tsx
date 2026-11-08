/**
 * VVU · STUDIO — the loop. The primary surface.
 *
 * Six things the system does:
 *   1. Take in an observation
 *   2. Run written-down rules      → PASS / FAIL / CAN'T-DECIDE
 *   3. Produce a receipt            (hash + sig + ts; stranger-verifiable)
 *   4. Say the current number       (one line: RECEIPTS: N)
 *   5. Close an open item by artifact
 *   6. Fail visibly
 *
 * The loop: record → run rules → receipt → number → repeat.
 * A receipt is issued in ALL THREE cases. The number goes up.
 * The number going up is the point.
 */
"use client";
import { useEffect, useRef, useState } from "react";
import { useStudio } from "@/lib/vvu-studio/store";
import { OBSERVATION_FIELDS, type Observation } from "@/lib/vvu-studio/loop";
import { short } from "@/lib/vvu-studio/crypto";
import { Card, Badge, Button, Field } from "../ui";
import { PlayIcon, RefreshIcon, ShieldIcon, CopyIcon, Icon } from "../Icons";

function VerdictBadge({ v }: { v: "PASS" | "FAIL" | "CANT_DECIDE" }) {
  if (v === "PASS") return <Badge tone="pass">PASS</Badge>;
  if (v === "FAIL") return <Badge tone="fail">FAIL</Badge>;
  return <Badge tone="stub">CAN'T DECIDE</Badge>;
}

const CAPABILITIES = [
  { n: 1, name: "Take in an observation", how: "record what, where, when, who, how much. no judgment. no smoothing.", icon: "📥" },
  { n: 2, name: "Run written-down rules", how: "PASS / FAIL / CAN'T-DECIDE. same input, same rules, same result — for anyone.", icon: "📐" },
  { n: 3, name: "Produce a receipt", how: "hash of the record. signature over the hash. timestamp. a stranger verifies it.", icon: "🧾" },
  { n: 4, name: "Say the current number", how: "one line. RECEIPTS: N. updated when it changes.", icon: "🔢" },
  { n: 5, name: "Close an item by artifact", how: "produce the artifact → it closes. no artifact → \"no artifact\". specific.", icon: "📦" },
  { n: 6, name: "Fail visibly", how: "corrupt file. mismatched hash. rule that can't decide. loud. no silent fallback.", icon: "⚠" },
];

/** Animated count-up number — when `value` changes, animate from old → new. */
function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    const to = value;
    if (from === to) return; // no change — display already correct
    const start = performance.now();
    const dur = 420;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setDisplay(to);
        prev.current = to;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{display}</>;
}

/** The circular loop diagram — record → rules → receipt → number → (repeat). */
function LoopDiagram({ running, lastVerdict }: { running: boolean; lastVerdict?: string }) {
  const cx = 130, cy = 110, r = 72;
  const steps = [
    { label: "record", angle: -90 },
    { label: "rules", angle: 0 },
    { label: "receipt", angle: 90 },
    { label: "number", angle: 180 },
  ];
  const color = lastVerdict === "FAIL" ? "var(--vs-red)" : lastVerdict === "PASS" ? "var(--vs-accent)" : "var(--vs-amber)";
  return (
    <svg viewBox="0 0 260 220" className="w-full max-w-[260px]">
      <defs>
        <linearGradient id="loopgrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--vs-accent)" />
          <stop offset="100%" stopColor="var(--vs-accent2)" />
        </linearGradient>
      </defs>
      {/* the loop circle */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={running ? "url(#loopgrad)" : "var(--vs-border3)"}
        strokeWidth={2}
        strokeDasharray="4 4"
        style={running ? { animation: "vvu-dash 1s linear infinite" } : undefined}
      />
      {/* arrowheads along the circle (cw) */}
      {steps.map((s, i) => {
        const rad = (s.angle * Math.PI) / 180;
        const x = cx + r * Math.cos(rad);
        const y = cy + r * Math.sin(rad);
        const next = steps[(i + 1) % steps.length];
        const nrad = (next.angle * Math.PI) / 180;
        const nx = cx + r * Math.cos(nrad);
        const ny = cy + r * Math.sin(nrad);
        const mx = (x + nx) / 2, my = (y + ny) / 2;
        // arrow tangent direction (perpendicular to radius, cw)
        const tx = -Math.sin(rad) * 6;
        const ty = Math.cos(rad) * 6;
        return (
          <g key={s.label}>
            <line x1={mx - tx} y1={my - ty} x2={mx + tx} y2={my + ty} stroke="var(--vs-accent2)" strokeWidth={1.5} opacity={0.5} />
          </g>
        );
      })}
      {/* step nodes */}
      {steps.map((s) => {
        const rad = (s.angle * Math.PI) / 180;
        const x = cx + r * Math.cos(rad);
        const y = cy + r * Math.sin(rad);
        return (
          <g key={s.label}>
            <circle cx={x} cy={y} r={13} fill="var(--vs-bg2)" stroke={color} strokeWidth={1.5} />
            <text x={x} y={y + 3} fill="var(--vs-text)" fontSize={9} fontFamily="monospace" textAnchor="middle">{s.label.slice(0, 3)}</text>
          </g>
        );
      })}
      {/* center — the verdict */}
      <text x={cx} y={cy - 4} fill="var(--vs-dim)" fontSize={8} fontFamily="monospace" textAnchor="middle">VERDICT</text>
      <text x={cx} y={cy + 10} fill={color} fontSize={12} fontFamily="monospace" fontWeight="bold" textAnchor="middle">
        {lastVerdict ?? "—"}
      </text>
    </svg>
  );
}

export function LoopView() {
  const observation = useStudio((s) => s.observation);
  const setObservation = useStudio((s) => s.setObservation);
  const resetObservation = useStudio((s) => s.resetObservation);
  const runLoop = useStudio((s) => s.runLoop);
  const verifyLoopChain = useStudio((s) => s.verifyLoopChain);
  const resetLoop = useStudio((s) => s.resetLoop);
  const walkthrough = useStudio((s) => s.walkthrough);
  const walkthroughStep = useStudio((s) => s.walkthroughStep);
  const loopReceipts = useStudio((s) => s.loopReceipts);
  const loopVerify = useStudio((s) => s.loopVerify);
  const showToast = useStudio((s) => s.showToast);

  const number = loopReceipts.length;
  const last = loopReceipts[loopReceipts.length - 1];
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleRun = () => {
    setRunning(true);
    runLoop();
    setTimeout(() => setRunning(false), 600);
  };

  const handleWalkthrough = () => {
    void walkthrough();
  };

  // Ctrl+Enter runs the loop (keyboard shortcut)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
      if (typing && (e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleRun();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const copyRecordHash = () => {
    if (!last) return;
    navigator.clipboard?.writeText(last.recordHash).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      showToast("record hash copied", "ok");
    }).catch(() => showToast("copy failed", "err"));
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      {/* THE NUMBER + THE LOOP DIAGRAM — capability 4, front and center */}
      <Card>
        <div className="grid grid-cols-1 items-center gap-4 py-2 sm:grid-cols-[1fr_auto]">
          <div className="text-center sm:text-left">
            <div className="mono text-[10px] uppercase tracking-[0.2em] text-[var(--vs-dim)]">the number · capability 4</div>
            <div className="mono text-[72px] font-bold leading-none text-[var(--vs-accent)] tabular-nums sm:text-[96px]">
              <AnimatedNumber value={number} />
            </div>
            <div className="mono text-[13px] tracking-[0.16em] text-[var(--vs-text2)]">RECEIPTS: {number}</div>
            <div className="mono mt-1 text-[10px] text-[var(--vs-dim)]">
              one line · updated when it changes · the number going up is the point
            </div>
            {last && (
              <div className="mono mt-3 inline-flex items-center gap-1.5 rounded-md border border-[var(--vs-border2)] bg-[var(--vs-bg3)] px-2 py-1 text-[10px]">
                <span className="text-[var(--vs-dim)]">last:</span>
                <span className="text-[var(--vs-text2)]">#{last.seq}</span>
                <VerdictBadge v={last.verdict} />
                {last.firstFail && <span className="text-[var(--vs-red)]">· {last.firstFail.id}</span>}
              </div>
            )}
          </div>
          <div className="mx-auto">
            <LoopDiagram running={running} lastVerdict={last?.verdict} />
          </div>
        </div>
      </Card>

      {/* THE SIX CAPABILITIES */}
      <Card title="THE SIX CAPABILITIES">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((c) => (
            <div key={c.n} className="rounded-md border border-[var(--vs-border2)] bg-[var(--vs-bg3)]/60 px-3 py-2 transition-colors hover:border-[var(--vs-accent)]/40">
              <div className="flex items-center gap-2">
                <span className="text-[14px]">{c.icon}</span>
                <span className="mono flex h-5 w-5 items-center justify-center rounded-full border border-[var(--vs-accent)] bg-[var(--vs-accentbg)] text-[10px] font-bold text-[var(--vs-accent)]">{c.n}</span>
                <span className="mono text-[12px] font-semibold text-[var(--vs-text)]">{c.name}</span>
              </div>
              <div className="mt-1 pl-7 text-[11px] text-[var(--vs-dim)]">{c.how}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* THE LOOP — capability 1 (record) + 2 (run rules) + 3 (receipt) */}
      <Card
        title="THE LOOP · record → run rules → receipt → number"
        right={last ? <VerdictBadge v={last.verdict} /> : null}
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {OBSERVATION_FIELDS.map((f) => (
            <Field key={f.key} label={f.label}>
              {f.key === "tier" ? (
                <select
                  className="vvu-input"
                  value={observation.tier}
                  onChange={(e) => setObservation({ tier: e.target.value as Observation["tier"] })}
                >
                  <option value="T1">T1 · computed</option>
                  <option value="T2">T2 · documented</option>
                  <option value="T3">T3 · claimed</option>
                  <option value="T4">T4 · hearsay</option>
                </select>
              ) : f.key === "confidence" || f.key === "bounds" ? (
                <input
                  className="vvu-input"
                  type="number"
                  step={0.01}
                  min={0}
                  max={f.key === "confidence" ? 1 : 0.5}
                  value={observation[f.key]}
                  onChange={(e) => setObservation({ [f.key]: Number(e.target.value) } as Partial<Observation>)}
                />
              ) : (
                <input
                  className="vvu-input"
                  placeholder={f.placeholder}
                  value={observation[f.key] as string}
                  onChange={(e) => setObservation({ [f.key]: e.target.value } as Partial<Observation>)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); handleRun(); }
                  }}
                />
              )}
            </Field>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Button variant="primary" onClick={handleRun}>
            <PlayIcon size={13} /> {running ? "Running…" : "Run the loop"}
          </Button>
          <Button variant="ghost" onClick={resetObservation}><RefreshIcon size={13} /> Clear observation</Button>
          <Button onClick={verifyLoopChain}><ShieldIcon size={13} /> Verify chain</Button>
          <Button onClick={handleWalkthrough} disabled={walkthroughStep > 0}>
            <Icon name="alert" size={13} /> {walkthroughStep > 0 ? `Walkthrough… (${walkthroughStep}/4)` : "Walkthrough"}
          </Button>
          <Button variant="danger" onClick={resetLoop}>Reset loop</Button>
        </div>

        {/* walkthrough step indicator */}
        {walkthroughStep > 0 && (
          <div className="mt-2 flex items-center gap-1 rounded-md border border-[var(--vs-border2)] bg-[var(--vs-bg3)] px-2.5 py-1.5">
            {["tamper", "verify", "restore", "verify"].map((label, i) => {
              const step = i + 1;
              const done = walkthroughStep > step;
              const active = walkthroughStep === step;
              return (
                <div key={i} className="flex items-center gap-1">
                  <span
                    className={
                      "mono flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold transition-colors " +
                      (done
                        ? "bg-[var(--vs-accent)] text-[#022c22]"
                        : active
                        ? "border border-[var(--vs-amber)] bg-[var(--vs-amberbg)] text-[var(--vs-amber)] vvu-pulse-fast"
                        : "border border-[var(--vs-border3)] bg-[var(--vs-bg)] text-[var(--vs-dimmer)]")
                    }
                  >
                    {done ? "✓" : step}
                  </span>
                  <span className={"mono text-[9px] " + (active ? "text-[var(--vs-amber)]" : done ? "text-[var(--vs-accent)]" : "text-[var(--vs-dimmer)]")}>{label}</span>
                  {i < 3 && <span className="text-[var(--vs-dimmer)]">→</span>}
                </div>
              );
            })}
          </div>
        )}
        <div className="mono mt-2 text-[10px] text-[var(--vs-dimmer)]">
          shortcut: <kbd className="rounded border border-[var(--vs-border2)] bg-[var(--vs-bg3)] px-1">Ctrl</kbd> + <kbd className="rounded border border-[var(--vs-border2)] bg-[var(--vs-bg3)] px-1">Enter</kbd> to run the loop
        </div>
      </Card>

      {/* THE LAST RECEIPT — capability 3 + 6 */}
      {last && (
        <Card title={`LAST RECEIPT · #${last.seq}`}>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div><span className="mono text-[10px] uppercase text-[var(--vs-dim)]">verdict</span><div><VerdictBadge v={last.verdict} /></div></div>
            <div><span className="mono text-[10px] uppercase text-[var(--vs-dim)]">ts</span><div className="mono text-[var(--vs-text)]">{last.ts}</div></div>
            <div className="col-span-2">
              <span className="mono text-[10px] uppercase text-[var(--vs-dim)]">record hash · SHA-256(canonical observation)</span>
              <div className="flex items-start gap-1">
                <div className="mono break-all text-[var(--vs-accent)]">{last.recordHash}</div>
                <button onClick={copyRecordHash} className="mt-0.5 shrink-0 rounded p-1 text-[var(--vs-dimmer)] hover:text-[var(--vs-accent)]" title="copy record hash">
                  <CopyIcon size={11} />
                </button>
              </div>
              {copied && <div className="mono text-[10px] text-[var(--vs-accent)]">✓ copied</div>}
            </div>
            <div className="col-span-2"><span className="mono text-[10px] uppercase text-[var(--vs-dim)]">receipt hash · SHA-256(prev ‖ record ‖ ts)</span><div className="mono break-all text-[var(--vs-accent)]">{last.receiptHash}</div></div>
            <div className="col-span-2"><span className="mono text-[10px] uppercase text-[var(--vs-dim)]">prev hash</span><div className="mono break-all text-[var(--vs-text2)]">{last.prevHash}</div></div>
            <div className="col-span-2"><span className="mono text-[10px] uppercase text-[var(--vs-dim)]">signature · HMAC stand-in for Ed25519</span><div className="mono break-all text-[var(--vs-amber)]">{last.sig} <Badge tone="stub">stubbed</Badge></div></div>
            {last.firstFail && (
              <div className="col-span-2 rounded-md border-l-2 border-[var(--vs-red)] bg-[var(--vs-redbg)]/40 px-3 py-2">
                <span className="mono text-[10px] uppercase text-[var(--vs-dim)]">first failing rule · capability 6 (fail visible)</span>
                <div className="mono text-[12px] text-[var(--vs-red)]">{last.firstFail.id} {last.firstFail.name} — {last.firstFail.reason}</div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* CHAIN VERIFICATION — capability 6 */}
      {loopVerify && (
        <Card title="CHAIN VERIFICATION · capability 6">
          {loopVerify.intact ? (
            <div className="flex items-center gap-2 text-[13px] text-[var(--vs-accent)]">
              <ShieldIcon size={16} /> CHAIN INTACT · {loopReceipts.length} receipts re-verified
            </div>
          ) : (
            <div className="space-y-1.5">
              {loopVerify.failures.map((f, i) => (
                <div key={i} className="rounded-md border-l-2 border-[var(--vs-red)] bg-[var(--vs-redbg)]/40 px-3 py-1.5 text-[12px]">
                  <span className="mono text-[var(--vs-red)]">{f.kind}</span>
                  <span className="mono ml-2 text-[var(--vs-text2)]">{f.message}</span>
                  <span className="mono ml-2 text-[var(--vs-dim)]">@ {f.at}</span>
                </div>
              ))}
              <div className="mono text-[13px] font-semibold text-[var(--vs-red)]">CHAIN BROKEN · {loopVerify.failures.length} failure(s)</div>
            </div>
          )}
        </Card>
      )}

      <div className="vvu-doc">
        <div className="callout">
          <strong>The test.</strong> Can a stranger, using only what's public, do the six things?
          Record format is published. Rules are written down. Hash + signature are on the receipt.
          The number is one line. The receipt says which rule failed first. The failure is loud.
        </div>
      </div>
    </div>
  );
}

export { short };
