'use client';

// src/components/icsh/TrustSphere.tsx — 14:37 TRUST SPHERE · WORM envelope
// seal + orbit head anchor. A Fibonacci point cloud (420 points, dual-axis
// rotation): mesh peers dim, joined nodes bright, the six horizon regions
// orbit GHOSTED — red, never rendered as live. Global/Personal toggle, legend,
// and three honest metrics that show — when the data is missing.

import { useEffect, useRef, useState } from 'react';
import type { IcshNodeRow, IcshStatus } from '@/lib/icsh/types';
import { cn } from '@/lib/utils';
import { Chip, Panel } from './parts';

interface SpherePoint {
  x: number;
  y: number;
  z: number;
  role: 'peer' | 'node' | 'ghost';
  label?: string;
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

function buildPoints(nodeCount: number): SpherePoint[] {
  const N = 420;
  const points: SpherePoint[] = [];
  for (let i = 0; i < N; i++) {
    const y = 1 - (2 * (i + 0.5)) / N;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = i * GOLDEN;
    const role: SpherePoint['role'] = i < nodeCount ? 'node' : 'peer';
    points.push({ x: Math.cos(theta) * r, y, z: Math.sin(theta) * r, role });
  }
  // ghosts ride high latitudes — dashed red, labelled
  const ghosts = ['EGYPT', 'KENYA', 'TANZANIA', 'NAMIBIA', 'ANGOLA', 'ZIMBABWE'];
  ghosts.forEach((label, i) => {
    const a = (i / ghosts.length) * Math.PI * 2;
    const y = 0.62 + (i % 2) * 0.16;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    points.push({ x: Math.cos(a) * r, y, z: Math.sin(a) * r, role: 'ghost', label });
  });
  return points;
}

export function TrustSphereSurface({ status, nodes }: { status: IcshStatus | null; nodes: IcshNodeRow[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<'GLOBAL' | 'PERSONAL'>('GLOBAL');
  const modeRef = useRef(mode);
  const activeNodes = nodes.filter((n) => n.status === 'ACTIVE');
  const nodeCountRef = useRef(activeNodes.length);

  // refs are updated in effects (never during render) — the rAF loop reads
  // them live so the sphere keeps rotating without re-subscribing
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    nodeCountRef.current = activeNodes.length;
  }, [activeNodes.length]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let t = 0;
    const render = () => {
      t += 0.0042;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const personal = modeRef.current === 'PERSONAL';
      const nodeCount = nodeCountRef.current;
      const points = buildPoints(personal ? Math.max(nodeCount, nodeCount > 0 ? nodeCount : 0) : nodeCount);
      const filtered = personal ? points.filter((p) => p.role !== 'peer') : points;
      const cx = w / 2;
      const cy = h / 2;
      const R = Math.min(w, h) * 0.4;

      // dual-axis rotation
      const ay = t;
      const ax = Math.sin(t * 0.42) * 0.55;
      const cosY = Math.cos(ay);
      const sinY = Math.sin(ay);
      const cosX = Math.cos(ax);
      const sinX = Math.sin(ax);

      type Draw = { sx: number; sy: number; z: number; p: SpherePoint };
      const draws: Draw[] = [];
      for (const p of filtered) {
        if (personal && p.role === 'peer') continue;
        let { x, y, z } = p;
        // Y rotation
        const x1 = x * cosY - z * sinY;
        const z1 = x * sinY + z * cosY;
        // X rotation
        const y2 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;
        draws.push({ sx: cx + x1 * R, sy: cy - y2 * R, z: z2, p });
      }
      draws.sort((a, b) => a.z - b.z);

      for (const d of draws) {
        const front = d.z > -0.15;
        const depth = 0.45 + 0.55 * ((d.z + 1) / 2);
        if (d.p.role === 'ghost') {
          ctx.strokeStyle = `rgba(255,122,110,${front ? 0.9 * depth : 0.25})`;
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 2]);
          ctx.beginPath();
          ctx.arc(d.sx, d.sy, 7, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          if (front && d.p.label) {
            ctx.fillStyle = `rgba(255,122,110,${0.85 * depth})`;
            ctx.font = '8px monospace';
            ctx.fillText(d.p.label, d.sx + 10, d.sy + 3);
          }
        } else if (d.p.role === 'node') {
          ctx.fillStyle = `rgba(200,255,0,${front ? 0.95 : 0.2})`;
          const r = front ? 3.4 : 1.8;
          if (front) {
            ctx.shadowColor = 'rgba(200,255,0,0.8)';
            ctx.shadowBlur = 8;
          }
          ctx.beginPath();
          ctx.arc(d.sx, d.sy, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          ctx.fillStyle = `rgba(125,255,168,${front ? 0.5 * depth : 0.12})`;
          ctx.beginPath();
          ctx.arc(d.sx, d.sy, 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // wire ring
      ctx.strokeStyle = 'rgba(29,77,44,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.06, 0, Math.PI * 2);
      ctx.stroke();

      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, []);

  const lc = status?.lastCycle ?? null;
  const meanTrust = status?.trust ?? null;
  const agreement = lc?.agreement ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip label="VIEWPORT" value="14:37 · SEAL + ANCHOR" tone="lime" />
        <div className="flex border border-[#1d2f22]">
          {(['GLOBAL', 'PERSONAL'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'px-3 py-1 text-[9px] font-bold tracking-[0.2em] transition-colors',
                mode === m ? 'bg-[#0c0f04] text-[#c8ff00]' : 'text-[#5f7f68] hover:text-[#9dbda4]'
              )}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3 text-[8px] tracking-[0.18em]">
          <span className="flex items-center gap-1.5"><span className="inline-block h-1.5 w-1.5 rounded-full bg-[#7dffa8]/60" /> PEER MESH</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-[#c8ff00] icsh-glow-lime" /> JOINED NODE</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full border border-dashed border-[#ff7a6e]" /> GHOST · NOT YET</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel title="TRUST SPHERE · 420-POINT FIBONACCI CLOUD" className="lg:col-span-3" bodyClass="p-0">
          <canvas ref={canvasRef} className="h-[340px] w-full sm:h-[400px]" aria-label="rotating trust sphere" />
          {mode === 'PERSONAL' && activeNodes.length === 0 ? (
            <p className="border-t border-[#16241a] px-3 py-2 text-center text-[8px] tracking-[0.2em] text-[#f3e38a]">
              PERSONAL SPHERE EMPTY — NO JOINED NODES YET (honest state, not an error)
            </p>
          ) : null}
        </Panel>

        <div className="space-y-4 lg:col-span-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="border border-[#16241a] bg-[#060b08] p-3 text-center">
              <p className="text-[8px] tracking-[0.22em] text-[#5f7f68]">NODES</p>
              <p className="mt-1 text-[20px] font-black text-[#c8ff00] icsh-glow-lime tabular-nums">{activeNodes.length}</p>
            </div>
            <div className="border border-[#16241a] bg-[#060b08] p-3 text-center">
              <p className="text-[8px] tracking-[0.22em] text-[#5f7f68]">MEAN TRUST</p>
              <p className="mt-1 text-[20px] font-black text-[#7dffa8] icsh-glow tabular-nums">
                {meanTrust !== null ? meanTrust.toFixed(2) : '—'}
              </p>
            </div>
            <div className="border border-[#16241a] bg-[#060b08] p-3 text-center">
              <p className="text-[8px] tracking-[0.22em] text-[#5f7f68]">AGREEMENT</p>
              <p className={cn('mt-1 text-[20px] font-black tabular-nums', agreement ? 'text-[#7dffa8] icsh-glow' : 'text-[#ff7a6e]')}>
                {agreement === null ? '—' : agreement ? 'HELD' : 'DRIFT'}
              </p>
            </div>
          </div>

          <Panel title="SEAL LINE · WORM ENVELOPE + ORBIT HEAD ANCHOR">
            <div className="space-y-1.5 text-[9px] leading-relaxed tracking-[0.08em] text-[#7d9a84]">
              <p>▸ Every run SHIPs one WORM envelope anchor — the orbit head sealed on the estate chain.</p>
              <p>▸ The sphere shows what the anchor proves: mesh peers (dim), committed farmers (bright), horizon regions (dashed red — NOT YET).</p>
              <p>▸ Trust grows only with attributed cycles: 0.40 enrolment base + cycles ÷ 20,000, capped 0.95. No shortcuts.</p>
            </div>
          </Panel>

          <Panel title="JOINED NODES" bodyClass="p-0">
            <div className="max-h-40 overflow-y-auto icsh-scroll">
              {activeNodes.length === 0 ? (
                <p className="px-3 py-4 text-center text-[9px] tracking-[0.18em] text-[#5f7f68]">NONE YET — JOIN METHOD ▸ TOTP</p>
              ) : (
                activeNodes.map((n) => (
                  <div key={n.id} className="flex items-baseline gap-2 border-b border-[#0e1811] px-3 py-1.5">
                    <span className="text-[9px] font-bold text-[#c8ff00]">{n.callsign}</span>
                    <span className="text-[8px] text-[#5f7f68]">{n.farm}</span>
                    <span className="ml-auto text-[8px] tabular-nums text-[#7dffa8]">trust {n.trust.toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
