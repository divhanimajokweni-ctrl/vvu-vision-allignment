/**
 * VVU · STUDIO — labs/lab0_plane.py (interactive number plane).
 * Drag the white point to (3, 4). Numbers are places.
 */
"use client";
import { useRef } from "react";
import { useStudio } from "@/lib/vvu-studio/store";
import { LAB0_TARGET, lab0AtTarget } from "@/lib/vvu-studio/labs";
import { Card, Badge, Button } from "../ui";

// viewBox geometry (matches reference)
const VW = 640;
const VH = 440;
const CX = 320; // svg x of origin
const CY = 220; // svg y of origin
const U = 45.7; // px per unit

const GRID_V: number[] = [];
for (let x = CX - 7 * U; x <= CX + 7 * U + 1; x += U) GRID_V.push(x);
const GRID_H: number[] = [];
for (let y = CY - 4 * U; y <= CY + 4 * U + 1; y += U) GRID_H.push(y);

export function Lab0View() {
  const lab0 = useStudio((s) => s.lab0);
  const lab0Move = useStudio((s) => s.lab0Move);
  const lab0Set = useStudio((s) => s.lab0Set);
  const lab0Reset = useStudio((s) => s.lab0Reset);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const ptX = CX + lab0.x * U;
  const ptY = CY - lab0.y * U;
  const tgtX = CX + LAB0_TARGET.x * U;
  const tgtY = CY - LAB0_TARGET.y * U;
  const dist = Math.hypot(lab0.x - LAB0_TARGET.x, lab0.y - LAB0_TARGET.y);
  const atTarget = lab0AtTarget(lab0.x, lab0.y);

  const toData = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const sx = ((clientX - r.left) / r.width) * VW;
    const sy = ((clientY - r.top) / r.height) * VH;
    const x = Math.round(((sx - CX) / U) * 2) / 2;
    const y = Math.round(((CY - sy) / U) * 2) / 2;
    return { x, y };
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="vvu-doc">
        <div className="vk">labs/lab0_plane.py</div>
        <h1>The Language of Numbers</h1>
        <p className="lede">
          A number is a place. Drag the white point to the address{" "}
          <code className="rounded bg-[var(--vs-bg3)] px-1 text-[var(--vs-accent)]">(3, 4)</code> —
          three steps east of centre, four steps north.
        </p>
      </div>

      <Card
        title="CANVAS · NUMBER PLANE"
        right={atTarget ? <Badge tone="pass">GATE PASS</Badge> : <Badge>gate · pending</Badge>}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VW} ${VH}`}
          className="w-full select-none rounded-md border border-[var(--vs-border)] bg-[#050507]"
          style={{ touchAction: "none" }}
        >
          {/* grid */}
          {GRID_V.map((x, i) => (
            <line key={`v${i}`} x1={x} y1={0} x2={x} y2={VH} stroke="#18181b" strokeWidth={1} />
          ))}
          {GRID_H.map((y, i) => (
            <line key={`h${i}`} x1={0} y1={y} x2={VW} y2={y} stroke="#18181b" strokeWidth={1} />
          ))}
          {/* axes */}
          <line x1={0} y1={CY} x2={VW} y2={CY} stroke="#3f3f46" strokeWidth={1.5} />
          <line x1={CX} y1={0} x2={CX} y2={VH} stroke="#3f3f46" strokeWidth={1.5} />
          {/* axis labels */}
          <text x={VW - 8} y={CY - 6} fill="#71717a" fontSize={9} fontFamily="monospace" textAnchor="end">x · east</text>
          <text x={CX + 6} y={12} fill="#71717a" fontSize={9} fontFamily="monospace">y · north</text>
          {/* tick labels */}
          {[-7, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7].map((n) => (
            <text key={`tx${n}`} x={CX + n * U} y={CY + 14} fill="#71717a" fontSize={9} fontFamily="monospace" textAnchor="middle">{n}</text>
          ))}
          {[-4, -3, -2, -1, 1, 2, 3, 4].map((n) => (
            <text key={`ty${n}`} x={CX - 8} y={CY - n * U + 3} fill="#71717a" fontSize={9} fontFamily="monospace" textAnchor="end">{n}</text>
          ))}
          {/* target */}
          <circle cx={tgtX} cy={tgtY} r={20} fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 3" />
          <circle cx={tgtX} cy={tgtY} r={7} fill="#f59e0b" />
          <text x={tgtX + 14} y={tgtY + 4} fill="#f59e0b" fontSize={11} fontFamily="monospace">(3, 4)</text>
          {/* draggable point */}
          <circle
            cx={ptX}
            cy={ptY}
            r={10}
            fill="#fafafa"
            stroke="#0b0b0d"
            strokeWidth={2}
            className="cursor-grab active:cursor-grabbing"
            onPointerDown={(e) => {
              dragging.current = true;
              (e.target as Element).setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!dragging.current) return;
              const d = toData(e.clientX, e.clientY);
              if (d) lab0Set(d.x, d.y);
            }}
            onPointerUp={(e) => {
              dragging.current = false;
              (e.target as Element).releasePointerCapture?.(e.pointerId);
            }}
            onPointerCancel={() => { dragging.current = false; }}
          />
          <text x={ptX + 14} y={ptY - 10} fill="#fafafa" fontSize={11} fontFamily="monospace">
            ({lab0.x.toFixed(1)}, {lab0.y.toFixed(1)})
          </text>
        </svg>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Button onClick={() => lab0Move(-1, 0)}>← west</Button>
          <Button onClick={() => lab0Move(1, 0)}>east →</Button>
          <Button onClick={() => lab0Move(0, 1)}>↑ north</Button>
          <Button onClick={() => lab0Move(0, -1)}>↓ south</Button>
          <Button variant="ghost" onClick={lab0Reset}>reset</Button>
        </div>
        <div className="mt-2 mono text-[11px] text-[var(--vs-dim)]">
          address: ({lab0.x.toFixed(1)}, {lab0.y.toFixed(1)}) · target: (3.0, 4.0) · distance: {dist.toFixed(2)}
        </div>
      </Card>

      <div className="vvu-doc">
        <div className="callout">
          <strong>The grammar of the plane.</strong> A move along one axis never disturbs the
          other — that independence is the grammar of the plane.
        </div>
      </div>
    </div>
  );
}
