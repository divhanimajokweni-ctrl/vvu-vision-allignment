/**
 * VVU · STUDIO — ive/pipeline.py (the canonical verification pipeline).
 * 11-field payload → sorted JSON → SHA-256 → contentHash → receiptHash → WORM append.
 */
"use client";
import { useStudio } from "@/lib/vvu-studio/store";
import { DEFAULT_PAYLOAD, DEFAULT_AUTHOR } from "@/lib/vvu-studio/content";
import { CANON_FIELDS } from "@/lib/vvu-studio/types";
import { GATES } from "@/lib/vvu-studio/gates";
import { Card, Badge, Button, GateBadge, Term } from "../ui";
import { PlayIcon } from "../Icons";

const STAGE_LABELS = [
  "payload built · 11-field canonical",
  "sorted JSON → SHA-256",
  "compound hash",
  "receipt · stubbed",
  "gates L1–L13",
  "WORM append",
];

export function IveView() {
  const stages = useStudio((s) => s.iveStages);
  const out = useStudio((s) => s.iveOut);
  const gates = useStudio((s) => s.iveGates);
  const badge = useStudio((s) => s.iveBadge);
  const running = useStudio((s) => s.iveRunning);
  const lastRun = useStudio((s) => s.ive.lastRun);
  const iveRun = useStudio((s) => s.iveRun);
  const iveReset = useStudio((s) => s.iveReset);

  const stageClass = (st: string) =>
    st === "active" ? "border-[var(--vs-accent)] bg-[var(--vs-accentbg)]/40" :
    st === "done" ? "border-[#065f46] bg-[var(--vs-accentbg)]/30" :
    st === "fail" ? "border-[#7f1d1d] bg-[var(--vs-redbg)]/40" :
    "border-[var(--vs-border2)] bg-[var(--vs-bg3)]";

  const snClass = (st: string) =>
    st === "active" ? "vvu-pulse-fast border-[var(--vs-accent)] bg-[var(--vs-accent)] text-[#022c22]" :
    st === "done" ? "border-[#065f46] bg-[var(--vs-accent)] text-[#022c22]" :
    st === "fail" ? "border-[#7f1d1d] bg-[var(--vs-red)] text-[#2c0a0a]" :
    "border-[var(--vs-border2)] bg-[var(--vs-bg)] text-[var(--vs-dim)]";

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="vvu-doc">
        <div className="vk">ive/pipeline.py</div>
        <h1>The Canonical Pipeline</h1>
        <p className="lede">
          One path that writes: <code className="rounded bg-[var(--vs-bg3)] px-1 text-[var(--vs-accent)]">submission → payload → hash → sign → gates → append</code>.
        </p>
      </div>

      <Card
        title="PAYLOAD · 11 FIELDS"
        right={badge === "committed" ? <Badge tone="pass">committed</Badge> : badge === "locked" ? <Badge tone="fail">locked</Badge> : undefined}
      >
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">
          {CANON_FIELDS.map((f) => (
            <div key={f} className="flex flex-col">
              <span className="mono text-[9px] uppercase tracking-[0.08em] text-[var(--vs-dim)]">{f}</span>
              <span className="mono truncate text-[11px] text-[var(--vs-text2)]" title={String(DEFAULT_PAYLOAD[f] ?? "—")}>
                {String(DEFAULT_PAYLOAD[f] ?? "—") || <span className="text-[var(--vs-dimmer)]">(auto)</span>}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-[var(--vs-border)] pt-3 sm:grid-cols-3">
          <div><span className="mono text-[9px] uppercase text-[var(--vs-dim)]">author</span><div className="mono truncate text-[11px] text-[var(--vs-text2)]">{DEFAULT_AUTHOR}</div></div>
          <div><span className="mono text-[9px] uppercase text-[var(--vs-dim)]">confidence</span><div className="mono text-[11px] text-[var(--vs-accent)]">0.72 ± 0.05</div></div>
          <div><span className="mono text-[9px] uppercase text-[var(--vs-dim)]">diff edits · L6</span><div className="mono text-[11px] text-[var(--vs-text2)]">14 (min 12)</div></div>
          <div><span className="mono text-[9px] uppercase text-[var(--vs-dim)]">deliberation · L8</span><div className="mono text-[11px] text-[var(--vs-text2)]">18 (min 15)</div></div>
          <div><span className="mono text-[9px] uppercase text-[var(--vs-dim)]">presence · L5</span><div className="mono text-[11px] text-[var(--vs-accent)]">present</div></div>
          <div><span className="mono text-[9px] uppercase text-[var(--vs-dim)]">firmware · L12</span><div className="mono text-[11px] text-[var(--vs-accent)]">studio_v1.2.1</div></div>
        </div>
        <div className="mt-3 flex gap-1.5">
          <Button variant="primary" onClick={iveRun} disabled={running}>
            <PlayIcon size={13} /> {running ? "Running…" : "Run Pipeline"}
          </Button>
          <Button variant="ghost" onClick={iveReset} disabled={running}>Reset</Button>
        </div>
      </Card>

      <Card title="STAGES">
        <div className="space-y-1.5">
          {STAGE_LABELS.map((label, i) => {
            const st = stages[i]?.state ?? "idle";
            return (
              <div key={i} className={"flex items-center gap-2.5 rounded-md border px-2.5 py-1.5 transition-colors " + stageClass(st)}>
                <span className={"mono flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold " + snClass(st)}>{i + 1}</span>
                <span className="mono text-[11px] text-[var(--vs-text2)]">{label}</span>
                {i === 3 && <Badge tone="stub">stubbed</Badge>}
              </div>
            );
          })}
        </div>
        <div className="mt-3">
          <Term lines={out} />
        </div>
      </Card>

      {gates && (
        <Card title={`GATES · ${gates.filter((g) => g.status === "PASS").length} pass`}>
          <div className="space-y-1">
            {gates.map((g) => (
              <div key={g.id} className="flex items-center gap-2 rounded px-2 py-1 text-[11px]">
                <GateBadge status={g.status} />
                <span className="mono text-[var(--vs-text)]">{g.id}</span>
                <span className="mono text-[var(--vs-text2)]">{g.name}</span>
                <span className="mono ml-auto text-[10px] text-[var(--vs-dim)]">{g.detail}</span>
              </div>
            ))}
          </div>
          {lastRun && (
            <div className="mt-2 border-t border-[var(--vs-border)] pt-2 text-[11px] text-[var(--vs-dim)]">
              conf {lastRun.conf} · bounds ±{lastRun.bounds} · {lastRun.diffEdits} diff edits · {lastRun.deliberation}m deliberation
            </div>
          )}
        </Card>
      )}

      <div className="vvu-doc">
        <div className="callout warn">
          <strong>Commit lock.</strong> Any <code>FAIL</code> blocks the append. Stubbed gates
          (<code>L7</code>, <code>L13</code>) never block — they are honestly flagged.
        </div>
      </div>
    </div>
  );
}

export { GATES };
