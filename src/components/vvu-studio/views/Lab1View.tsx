/**
 * VVU · STUDIO — labs/lab1_lucky.py (reproducible randomness).
 * A draw without a seed is T4 hearsay; the same draw with a seed is T1 computed.
 */
"use client";
import { useStudio } from "@/lib/vvu-studio/store";
import { Card, Badge, Button, Field } from "../ui";
import { PlayIcon, RefreshIcon } from "../Icons";

const CANVAS_W = 700;
const CANVAS_H = 240;
const LINE_Y = 140;
const LEFT = 28;
const RIGHT = 672;

export function Lab1View() {
  const lab1 = useStudio((s) => s.lab1);
  const setLab1 = (patch: Partial<typeof lab1>) => useStudio.setState({ lab1: { ...lab1, ...patch } });
  const lab1Run = useStudio((s) => s.lab1Run);
  const lab1Reproduce = useStudio((s) => s.lab1Reproduce);
  const lab1Reset = useStudio((s) => s.lab1Reset);

  const { start, end, last, seed } = lab1;
  const range = Math.max(1, end - start);
  const xOf = (n: number) => LEFT + ((n - start) / range) * (RIGHT - LEFT);
  const hasSeed = !!seed && seed.trim() !== "";

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="vvu-doc">
        <div className="vk">labs/lab1_lucky.py</div>
        <h1>Reproducible Randomness</h1>
        <p className="lede">
          A draw without a seed is <strong>T4 hearsay</strong>. The same draw with a
          seed becomes <strong>T1 computed</strong>.
        </p>
      </div>

      <Card title="CANVAS · NUMBER LINE">
        <svg viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} className="w-full rounded-md border border-[var(--vs-border)] bg-[#050507]">
          {/* number line */}
          <line x1={LEFT} y1={LINE_Y} x2={RIGHT} y2={LINE_Y} stroke="#2a2a34" strokeWidth={1.5} />
          {/* ticks */}
          {Array.from({ length: range + 1 }, (_, i) => {
            const n = start + i;
            const big = n % 5 === 0 || n === start || n === end;
            const x = xOf(n);
            return (
              <g key={n}>
                <line x1={x} y1={big ? 132 : 136} x2={x} y2={big ? 148 : 144} stroke={big ? "#2a2a34" : "#27272a"} strokeWidth={big ? 1.5 : 1} />
                {big && (
                  <text x={x} y={164} fill="#71717a" fontSize={9} fontFamily="monospace" textAnchor="middle">{n}</text>
                )}
              </g>
            );
          })}
          <text x={LEFT} y={210} fill="#71717a" fontSize={9} fontFamily="monospace">start = {start}</text>
          <text x={RIGHT} y={210} fill="#71717a" fontSize={9} fontFamily="monospace" textAnchor="end">end = {end}</text>
          {/* drawn numbers */}
          {last?.numbers.map((n, i) => {
            const x = xOf(n);
            const cy = 100 - i * 3;
            return (
              <g key={i}>
                <line x1={x} y1={LINE_Y} x2={x} y2={cy} stroke="#34d399" strokeWidth={1.5} />
                <circle cx={x} cy={cy} r={4.5} fill="#34d399" />
                <text x={x} y={cy - 8} fill="#34d399" fontSize={10} fontFamily="monospace" textAnchor="middle">{n}</text>
              </g>
            );
          })}
          <text x={LEFT} y={28} fill="#71717a" fontSize={9} fontFamily="monospace">seed = {hasSeed ? seed : "random"}</text>
          <text x={RIGHT} y={28} fill="#71717a" fontSize={9} fontFamily="monospace" textAnchor="end">count = {lab1.count}</text>
        </svg>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Field label="name">
            <input className="vvu-input" value={lab1.name} onChange={(e) => setLab1({ name: e.target.value })} />
          </Field>
          <Field label="count">
            <input className="vvu-input" type="number" min={1} max={50} value={lab1.count} onChange={(e) => setLab1({ count: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })} />
          </Field>
          <Field label="start">
            <input className="vvu-input" type="number" value={lab1.start} onChange={(e) => setLab1({ start: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="end">
            <input className="vvu-input" type="number" value={lab1.end} onChange={(e) => setLab1({ end: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="seed">
            <input className="vvu-input" inputMode="numeric" placeholder="random" value={lab1.seed ?? ""} onChange={(e) => setLab1({ seed: e.target.value || null })} />
          </Field>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Button variant="primary" onClick={lab1Run}><PlayIcon size={13} /> Generate</Button>
          <Button onClick={lab1Reproduce}><RefreshIcon size={13} /> Reproduce</Button>
          <Button variant="ghost" onClick={lab1Reset}>reset</Button>
        </div>
      </Card>

      <Card title="OUTPUT">
        {!last ? (
          <div className="mono text-[12px] text-[var(--vs-dimmer)]"># awaiting first draw</div>
        ) : last.error ? (
          <div className="mono text-[12px] text-[var(--vs-red)]">{last.error}</div>
        ) : (
          <div>
            <div className="text-[13px] text-[var(--vs-text2)]">Hello, {lab1.name}! Your lucky numbers are:</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {last.numbers.map((n, i) => (
                <span
                  key={i}
                  className="vvu-pop mono rounded-md border border-[#065f46] bg-[var(--vs-accentbg)] px-2 py-1 text-[14px] font-semibold text-[var(--vs-accent)]"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  {n}
                </span>
              ))}
            </div>
            <div className="mt-2 mono text-[11px] text-[var(--vs-dim)]">
              seed = {last.seedUsed ?? <span className="text-[var(--vs-amber)]">none — unreproducible</span>}
            </div>
          </div>
        )}
      </Card>

      <Card title="EVIDENCE GRADE">
        <div className="grid grid-cols-3 gap-2 text-[12px]">
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.1em] text-[var(--vs-dim)]">seed present</div>
            {hasSeed ? <Badge tone="pass">yes</Badge> : <Badge tone="fail">no</Badge>}
          </div>
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.1em] text-[var(--vs-dim)]">reproducible</div>
            {hasSeed ? <Badge tone="pass">yes</Badge> : <Badge tone="fail">no</Badge>}
          </div>
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.1em] text-[var(--vs-dim)]">tier</div>
            {hasSeed ? <Badge tone="t1">T1</Badge> : <Badge tone="t4">T4</Badge>}
          </div>
        </div>
      </Card>
    </div>
  );
}
