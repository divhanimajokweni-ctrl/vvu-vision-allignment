'use client';

// src/components/wildfire/IsoOpsMap.tsx — the operator's isometric ops map.
// File 5 of the 8-file Wildfire Emergency View contract.
//
// Same isometric projection discipline as the twin artifact (same seed
// 20260921, same peninsula spine), but OPS-GRADE: bigger tiles, coordinate
// readout, live mesh nodes drawn ONLY when consented (revoked members are
// absent — never dimmed, never half-visible), per-node telemetry labels,
// and the 8 layers each carrying their honest seed/simulated labels.
//
// The fire/wind/smoke feeds are SIMULATED from the FSM state (labelled);
// mesh + evidence layers are LIVE from the :3006 service when connected.

import { useEffect, useRef } from 'react';
import type { WildfireLayerId, WildfireFsmState } from '@/lib/wildfire-fsm';
import { WILDFIRE_HAZARD_COLOR, hazardOf } from '@/lib/wildfire-fsm';
import type { MeshNode, MeshTelemetry } from '@/lib/wildfire-mesh';

/* ── deterministic terrain (same seed as the artifact — documented drift
      is acceptable: both are procedural from 20260921) ───────────────── */
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GW = 44;
const GH = 36;

function buildTerrain(): number[][] {
  const rand = mulberry32(20260921);
  const H: number[][] = [];
  const sx1 = 36, sy1 = 4, sx2 = 6, sy2 = 33;
  const dx = sx2 - sx1, dy = sy2 - sy1;
  const len = Math.hypot(dx, dy);
  for (let r = 0; r < GH; r++) {
    H[r] = [];
    for (let c = 0; c < GW; c++) {
      const px = c - sx1, py = r - sy1;
      const t = Math.max(0, Math.min(1, (px * dx + py * dy) / (len * len)));
      const lx = sx1 + dx * t, ly = sy1 + dy * t;
      const d = Math.hypot(c - lx, r - ly);
      const wob = 3.4 + Math.sin(t * 9.1 + 20260921 % 7) * 1.6 + Math.sin(t * 21.3) * 0.9;
      let h = 0;
      if (d < wob) {
        h = (1 - d / wob) * 7.4 + rand() * 1.3;
        if (Math.hypot(c - 34, r - 7) < 4.6) h += 3.2;
        if (Math.hypot(c - 30, r - 20) < 2.4) h -= 2.6;
        if (Math.hypot(c - 16, r - 14) < 2.1) h -= 3.1;
        h = Math.max(0.4, Math.min(9.5, h));
      }
      H[r][c] = h;
    }
  }
  return H;
}

const EVAC = [
  { n: 'NOORDHOEK', c: 24, r: 26, rad: 6 },
  { n: 'HOUT BAY', c: 16, r: 14, rad: 5 },
  { n: 'SCARBOROUGH', c: 10, r: 30, rad: 4 },
];
const ASSETS = [
  { n: 'SCHOOL', c: 25, r: 27 },
  { n: 'CLINIC', c: 17, r: 15 },
  { n: 'RESERVOIR', c: 30, r: 10 },
  { n: 'NURSERY', c: 23, r: 22 },
  { n: 'FIRE STN', c: 28, r: 13 },
];
const IGN = { c: 24, r: 23 };

export interface IsoOpsMapProps {
  fsm: WildfireFsmState;
  nodes: MeshNode[];
  telemetry: Record<string, MeshTelemetry>;
  layers: ReadonlySet<WildfireLayerId>;
  journalCount: number;
  connected: boolean;
  /** Simulated scenario seconds — driven by the parent so pausing kills it. */
  scenarioSec: number;
}

export function IsoOpsMap({
  fsm,
  nodes,
  telemetry,
  layers,
  journalCount,
  connected,
  scenarioSec,
}: IsoOpsMapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef({ fsm, nodes, telemetry, layers, journalCount, connected, scenarioSec });

  // sync the render-loop mirror AFTER render (never during — React compiler
  // rule: refs are not writable while rendering)
  useEffect(() => {
    stateRef.current = { fsm, nodes, telemetry, layers, journalCount, connected, scenarioSec };
  });

  useEffect(() => {
    const H = buildTerrain();
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const cx = canvas.getContext('2d');
    if (!cx) return;

    const iso = { ox: 0, oy: 0, tw: 12, th: 6 };
    let raf = 0;
    let alive = true;

    const project = (c: number, r: number, z: number) => ({
      x: iso.ox + (c - r) * iso.tw * 0.5,
      y: iso.oy + (c + r) * iso.th * 0.5 - z,
    });

    const fit = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      iso.tw = Math.max(
        7,
        Math.min((w * 0.92) / ((GW + GH) / 2), (h * 0.82) / ((GH * 1.5) / 2))
      );
      iso.th = iso.tw * 0.5;
      iso.ox = (w - iso.tw * ((GW + GH) / 2)) / 2 + (iso.tw * GH) / 2;
      iso.oy = (h - iso.th * ((GH + GH) / 2)) / 2 + iso.th * 2;
    };

    const ro = new ResizeObserver(() => fit());
    ro.observe(wrap);
    fit();

    const hsl = (h: number, s: number, l: number) => `hsl(${h},${s}%,${l}%)`;
    const wd = { x: -0.86, y: -0.52 };

    const draw = (t: number) => {
      if (!alive) return;
      const { fsm: f, nodes: ns, telemetry: tele, layers: on, journalCount: jc, connected: conn, scenarioSec: sec } = stateRef.current;
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      cx.clearRect(0, 0, w, h);

      /* sea */
      const seaG = cx.createLinearGradient(0, 0, w, h);
      seaG.addColorStop(0, '#08131a');
      seaG.addColorStop(1, '#0a1e24');
      cx.fillStyle = seaG;
      cx.fillRect(0, 0, w, h);

      /* terrain */
      const envT = on.has('env') ? (f === 'ESCALATED' ? 14 : f === 'DECLARED' ? 9 : f === 'WATCH' ? 5 : 0) : 0;
      for (let r = GH - 1; r >= 0; r--) {
        for (let c = GW - 1; c >= 0; c--) {
          const hgt = H[r][c];
          if (hgt <= 0) continue;
          const P = project(c, r, hgt * 3);
          const Pb = project(c, r, 0);
          const hue = 96 - envT - hgt * 7;
          const sat = 16 + hgt * 3.2;
          const lum = 9 + hgt * 2.6;
          cx.beginPath();
          cx.moveTo(P.x - iso.tw / 2, P.y);
          cx.lineTo(P.x, P.y - iso.th / 2);
          cx.lineTo(P.x + iso.tw / 2, P.y);
          cx.lineTo(P.x, P.y + iso.th / 2);
          cx.closePath();
          cx.fillStyle = hsl(hue, sat, lum);
          cx.fill();
          cx.beginPath();
          cx.moveTo(P.x - iso.tw / 2, P.y);
          cx.lineTo(Pb.x - iso.tw / 2, Pb.y);
          cx.lineTo(Pb.x, Pb.y + iso.th / 2);
          cx.lineTo(P.x, P.y + iso.th / 2);
          cx.closePath();
          cx.fillStyle = hsl(hue, sat, Math.max(4, lum - 4.5));
          cx.fill();
        }
      }

      /* evac zones */
      if (on.has('evac')) {
        const arm = f === 'DECLARED' || f === 'ESCALATED';
        EVAC.forEach((z) => {
          const P = project(z.c, z.r, 0);
          const pulse = arm ? 0.55 + 0.45 * Math.sin(t / 300) : 0.35;
          cx.strokeStyle =
            f === 'NORMAL' ? 'rgba(138,153,168,.4)' : `rgba(255,138,61,${pulse})`;
          cx.lineWidth = arm ? 2 : 1;
          cx.setLineDash([5, 4]);
          cx.beginPath();
          cx.ellipse(P.x, P.y, z.rad * iso.tw * 0.9, z.rad * iso.th * 0.9, 0, 0, 7);
          cx.stroke();
          cx.setLineDash([]);
          cx.fillStyle = arm ? 'rgba(255,138,61,.95)' : 'rgba(138,153,168,.7)';
          cx.font = '8px monospace';
          cx.textAlign = 'center';
          cx.fillText(z.n, P.x, P.y - z.rad * iso.th * 0.9 - 4);
        });
      }

      /* fire (SIMULATED — deterministic from FSM + scenario clock) */
      if (on.has('fire') && f !== 'NORMAL') {
        const growth =
          f === 'WATCH' ? 0.25 + 0.1 * Math.sin(sec / 30) :
          f === 'DECLARED' ? 3.2 + Math.min(2.4, sec / 90) :
          f === 'ESCALATED' ? 5.4 + Math.min(4.5, sec / 45) :
          4.6;
        const intensity =
          f === 'WATCH' ? 0.35 : f === 'STAND-DOWN' ? 0.35 : 1;
        const cx0 = IGN.c, cy0 = IGN.r;
        for (let r = 0; r < GH; r++) {
          for (let c = 0; c < GW; c++) {
            if (H[r][c] <= 0) continue;
            const d = Math.hypot((c - cx0) * 0.92, (r - cy0) * 1.08);
            const edge = Math.max(0, 1 - Math.abs(d - growth * 0.55) / 2.2);
            const core = Math.max(0, 1 - d / growth);
            const fv = (core * 0.8 + edge * 0.25) * intensity;
            if (fv <= 0.05) continue;
            const P = project(c, r, H[r][c] * 3);
            const flick = 0.75 + 0.25 * Math.sin(t / 120 + c * 3 + r * 5);
            const rad = iso.tw * 0.62 * fv * flick;
            const g = cx.createRadialGradient(P.x, P.y - 2, 0, P.x, P.y - 2, Math.max(1.5, rad * 2));
            g.addColorStop(0, `rgba(255,220,120,${0.85 * fv})`);
            g.addColorStop(0.45, `rgba(255,110,40,${0.6 * fv})`);
            g.addColorStop(1, 'rgba(180,40,20,0)');
            cx.fillStyle = g;
            cx.beginPath();
            cx.arc(P.x, P.y - 2, Math.max(1.5, rad * 2), 0, 7);
            cx.fill();
          }
        }
        if (f === 'STAND-DOWN') {
          const P0 = project(IGN.c, IGN.r, 0);
          cx.strokeStyle = 'rgba(46,168,160,.8)';
          cx.lineWidth = 2;
          cx.setLineDash([6, 4]);
          cx.beginPath();
          cx.ellipse(P0.x, P0.y, growth * 0.62 * iso.tw, growth * 0.62 * iso.th, 0, 0, 7);
          cx.stroke();
          cx.setLineDash([]);
          cx.fillStyle = 'rgba(46,168,160,.95)';
          cx.font = '8px monospace';
          cx.textAlign = 'center';
          cx.fillText('CONTAINMENT', P0.x, P0.y + growth * 0.62 * iso.th + 14);
        }
      }

      /* smoke (SIMULATED) */
      if (on.has('smoke') && f !== 'NORMAL') {
        const strength = f === 'ESCALATED' ? 1 : f === 'DECLARED' ? 0.7 : 0.3;
        const rand = mulberry32(77 + Math.floor(sec / 4));
        for (let k = 0; k < 46 * strength; k++) {
          const c = IGN.c + (rand() - 0.5) * 10;
          const r = IGN.r + (rand() - 0.5) * 8;
          const P = project(c, r, H[Math.max(0, Math.min(GH - 1, Math.round(r)))][Math.max(0, Math.min(GW - 1, Math.round(c)))] * 3);
          const drift = ((rand() * 0.4 + (sec % 40) / 40) % 1) * 60;
          const life = 1 - ((rand() * 0.6 + (sec % 30) / 30) % 1);
          cx.fillStyle = `rgba(200,205,214,${0.16 * life})`;
          cx.beginPath();
          cx.arc(P.x + wd.x * drift, P.y - drift * 0.7 - 10 * life, 3 + (1 - life) * 16, 0, 7);
          cx.fill();
        }
      }

      /* wind (SIMULATED) */
      if (on.has('wind')) {
        cx.strokeStyle = 'rgba(242,184,75,.32)';
        cx.lineWidth = 1;
        const strength = f === 'ESCALATED' ? 0.9 : f === 'DECLARED' ? 0.66 : f === 'WATCH' ? 0.46 : 0.32;
        const rand = mulberry32(55);
        for (let k = 0; k < 40; k++) {
          const bx = rand() * w;
          const by = rand() * h;
          const ph = ((rand() + sec / 14) % 1);
          const L = 14 + 30 * strength;
          const x = bx + wd.x * ph * L * 2.4;
          const y = by + wd.y * ph * L * 2.4;
          cx.beginPath();
          cx.moveTo(x, y);
          cx.lineTo(x - wd.x * L, y - wd.y * L);
          cx.stroke();
          cx.fillStyle = 'rgba(242,184,75,.5)';
          cx.fillRect(x - wd.x * L - 0.8, y - wd.y * L - 0.8, 1.6, 1.6);
        }
      }

      /* assets */
      if (on.has('assets')) {
        ASSETS.forEach((a) => {
          const P = project(a.c, a.r, H[a.r][a.c] * 3);
          cx.save();
          cx.translate(P.x, P.y - 7);
          cx.rotate(Math.PI / 4);
          cx.fillStyle = '#f2b84b';
          cx.strokeStyle = '#08090c';
          cx.lineWidth = 1;
          cx.fillRect(-3, -3, 6, 6);
          cx.strokeRect(-3, -3, 6, 6);
          cx.restore();
          cx.fillStyle = 'rgba(242,184,75,.9)';
          cx.font = '7px monospace';
          cx.textAlign = 'center';
          cx.fillText(a.n, P.x, P.y - 12);
        });
      }

      /* mesh nodes — PRESENT (consented) ONLY. Revoked = absent, no ghost. */
      if (on.has('mesh')) {
        ns.forEach((n) => {
          const hgt = H[Math.max(0, Math.min(GH - 1, n.row))][Math.max(0, Math.min(GW - 1, n.col))];
          const P = project(n.col, n.row, hgt * 3);
          const pulse = 0.6 + 0.4 * Math.sin(t / 500 + P.x);
          cx.strokeStyle = `rgba(200,255,0,${0.55 * pulse})`;
          cx.lineWidth = 1.4;
          cx.beginPath();
          cx.arc(P.x, P.y - 5, 8 + 2.5 * pulse, 0, 7);
          cx.stroke();
          cx.fillStyle = '#c8ff00';
          cx.beginPath();
          cx.arc(P.x, P.y - 5, 2.8, 0, 7);
          cx.fill();
          cx.fillStyle = 'rgba(200,255,0,.85)';
          cx.font = '7px monospace';
          cx.textAlign = 'center';
          cx.fillText(n.id, P.x, P.y + 10);
          const nodeTele = tele[n.id];
          if (nodeTele) {
            cx.fillStyle = 'rgba(46,168,160,.9)';
            cx.font = '7px monospace';
            cx.fillText(
              `${Math.round(nodeTele.windKph)}KPH ${Math.round(nodeTele.tempC)}°C BAT${Math.round(nodeTele.batteryPct)}%`,
              P.x,
              P.y + 19
            );
          }
        });
      }

      /* evidence chain along the bottom edge */
      if (on.has('evidence')) {
        const y = h - 18;
        const shown = Math.min(jc, 26);
        if (shown > 0) {
          cx.strokeStyle = 'rgba(46,168,160,.5)';
          cx.lineWidth = 1;
          cx.beginPath();
          for (let k = 0; k < shown; k++) {
            const x = 14 + k * ((w - 28) / Math.max(1, shown - 1));
            if (k === 0) cx.moveTo(x, y);
            else cx.lineTo(x, y);
          }
          cx.stroke();
          for (let k = 0; k < shown; k++) {
            const x = 14 + k * ((w - 28) / Math.max(1, shown - 1));
            const last = k === shown - 1;
            const pulse = last ? 0.5 + 0.5 * Math.sin(t / 280) : 0;
            cx.fillStyle = last
              ? `rgba(200,255,0,${0.6 + 0.4 * pulse})`
              : 'rgba(46,168,160,.85)';
            cx.beginPath();
            cx.arc(x, y, last ? 3.4 : 1.8, 0, 7);
            cx.fill();
          }
          cx.fillStyle = 'rgba(46,168,160,.8)';
          cx.font = '8px monospace';
          cx.textAlign = 'left';
          cx.fillText(
            `EVIDENCE CHAIN · ${jc} ENTRIES${conn ? ' · LIVE :3006' : ' · OFFLINE'}`,
            14,
            y - 9
          );
        }
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const hazard = hazardOf(fsm);
  return (
    <div className="wf-map-wrap" ref={wrapRef}>
      <canvas ref={canvasRef} className="wf-map-canvas" role="img" aria-label="Isometric operations map — Cape Peninsula wildfire layers" />
      <div className="wf-map-hud">
        STATE <b style={{ color: WILDFIRE_HAZARD_COLOR[hazard] }}>{fsm}</b>
        <br />
        NODES <b style={{ color: connected ? '#c8ff00' : '#8a99a8' }}>
          {connected ? `${nodes.length} PRESENT` : 'SERVICE OFFLINE'}
        </b>
        <br />
        GRID <b>44×36 · SEED 20260921</b>
      </div>
      <div className="wf-map-honesty">
        FIRE · WIND · SMOKE · ENV <b>SIMULATED</b>
        <br />
        MESH · EVIDENCE{' '}
        <b style={{ color: connected ? '#c8ff00' : '#e5484d' }}>
          {connected ? 'LIVE :3006' : 'OFFLINE'}
        </b>
        <br />
        EVAC · ASSETS <b>SEED PLAN</b>
      </div>
    </div>
  );
}
