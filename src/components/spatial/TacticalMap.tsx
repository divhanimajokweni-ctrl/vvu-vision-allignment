'use client';

// src/components/spatial/TacticalMap.tsx — 2D tactical canvas mode.
// Self-contained ENU projection (x→east, y→north) with procedural terrain
// contours (pre-rendered offscreen), 10m grid + 50m ticks, animated radar
// sweep with blip flashes, node pulses, geofence, leak overlay, crosshair +
// WGS84 readout, compass rose, scale bar. Wheel/pinch zoom + drag pan.
// Node inspector: tap a node square (non-drag pointer up within a 14px screen
// hit radius) → onNodeSelect + WORM NODE_INSPECT log; the selected node gets a
// rotating lime reticle + INSPECT tag, hovered nodes a sage ring + pointer cursor.
// Label density: FULL (all labels) / KEY (primary nodes N01–N04 only, tick
// numbers hidden) / OFF (no annotation text; instruments stay functional) —
// manual toggle next to the zoom controls, WORM VIEW_MODE audit on change.

import { useEffect, useRef, useState } from 'react';
import { GQEBERHA_ANCHOR, PHYSICAL_NODES } from '@/lib/vvu-data';
import { useVvuSocketStore } from '@/hooks/use-vvu-socket';

// ENU mm → m (2D: x east, y north).
const P = (id: string) => {
  const n = PHYSICAL_NODES.find((p) => p.nodeId === id);
  if (!n) throw new Error(`missing node ${id}`);
  return { x: n.xMm / 1000, y: n.yMm / 1000, name: n.name, nodeId: n.nodeId };
};

const N = PHYSICAL_NODES.map((n) => ({ x: n.xMm / 1000, y: n.yMm / 1000, nodeId: n.nodeId }));
const N02 = P('N02');
const N04 = P('N04');
const N03 = P('N03');

const PIPE_MAIN: Array<{ x: number; y: number }> = [N02, N04, N03]; // ductile iron DN300
const PIPE_HDPE: Array<{ x: number; y: number }> = [N02, P('N12'), N04]; // HDPE lateral
const PIPE_PVCO: Array<{ x: number; y: number }> = [N04, N03]; // PVC-O outlet

/** Map label density. FULL = every canvas annotation; KEY = primary rig nodes
 * (mast, inlet, outlet, spool) keep their labels, secondary nodes/tick numbers
 * hidden; OFF = no annotation text — nodes, pipes, pulses and the functional
 * instruments (compass rose letters, scale-bar value, INSPECT tag) stay. */
type LabelMode = 'full' | 'key' | 'off';
const PRIMARY_LABEL_NODES: ReadonlySet<string> = new Set(['N01', 'N02', 'N03', 'N04']);
const LABEL_MODES: ReadonlyArray<LabelMode> = ['full', 'key', 'off'];

const C_MAIN = '#9aa3ad';
const C_HDPE = '#3fae6e';
const C_PVCO = '#3aa0c8';
const GEOFENCE_M = 25;

// ── deterministic PRNG + contour pre-render ─────────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pre-render terrain contour bitmap in world space (−EXT..+EXT metres). */
function buildTerrainCanvas(size: number, ext: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const c = cv.getContext('2d');
  if (!c) return cv;
  const rnd = mulberry32(1337);
  const w2s = (x: number, y: number): [number, number] => [
    ((x + ext) / (2 * ext)) * size,
    ((y + ext) / (2 * ext)) * size, // north up: world +y → canvas up
  ];

  // 4 organic blobs, 3 nested contour rings each.
  for (let b = 0; b < 4; b++) {
    const bx = (rnd() * 2 - 1) * ext * 0.55;
    const by = (rnd() * 2 - 1) * ext * 0.55;
    const baseR = ext * (0.1 + rnd() * 0.09);
    const harmonics = [
      { k: 3, p: rnd() * Math.PI * 2, a: 0.22 + rnd() * 0.1 },
      { k: 5, p: rnd() * Math.PI * 2, a: 0.12 + rnd() * 0.08 },
      { k: 7, p: rnd() * Math.PI * 2, a: 0.06 },
    ];
    const radiusAt = (θ: number, R: number) =>
      R * (1 + harmonics.reduce((s, h) => s + h.a * Math.sin(h.k * θ + h.p), 0));

    // soft shaded fill
    const [fx, fy] = w2s(bx, by);
    const fr = baseR * (size / (2 * ext)) * 1.6;
    const grad = c.createRadialGradient(fx, fy, 0, fx, fy, Math.max(1, fr));
    grad.addColorStop(0, 'rgba(26,36,21,0.35)');
    grad.addColorStop(1, 'rgba(26,36,21,0)');
    c.fillStyle = grad;
    c.fillRect(0, 0, size, size);

    for (let ring = 0; ring < 3; ring++) {
      const R = baseR * (1 - ring * 0.24);
      c.beginPath();
      for (let i = 0; i <= 90; i++) {
        const θ = (i / 90) * Math.PI * 2;
        const r = radiusAt(θ, R);
        const [sx, sy] = w2s(bx + r * Math.cos(θ), by + r * Math.sin(θ));
        if (i === 0) c.moveTo(sx, sy);
        else c.lineTo(sx, sy);
      }
      c.closePath();
      c.strokeStyle = ring === 0 ? 'rgba(38,52,26,0.55)' : `rgba(30,42,22,${0.4 - ring * 0.1})`;
      c.lineWidth = 1.1;
      c.stroke();
    }
  }
  return cv;
}

// ── component ───────────────────────────────────────────────────────────────

interface CamState {
  cx: number;
  cy: number;
  pxm: number; // pixels per metre
}

interface TacticalMapProps {
  /** Node inspector: emitted on a non-drag tap — nearest node id, or null when tapping empty map (dismisses). */
  onNodeSelect?: (nodeId: string | null) => void;
  /** Node currently open in the inspector — drives the lime selection reticle. */
  selectedNodeId?: string | null;
}

export function TacticalMap({ onNodeSelect, selectedNodeId }: TacticalMapProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const camRef = useRef<CamState>({ cx: 0, cy: 0, pxm: 8 });
  const terrainRef = useRef<HTMLCanvasElement | null>(null);
  const EXT = 130; // terrain bitmap world extent (metres)

  // Props → refs: the canvas effect below runs exactly once (deps []). These
  // refs feed fresh prop values into the render loop / pointer handlers
  // without tearing down and rebuilding the canvas on every selection.
  const selectedRef = useRef<string | null>(null);
  const onNodeSelectRef = useRef<TacticalMapProps['onNodeSelect']>(undefined);

  // Label density — manual only (no zoom-coupled auto switching), so a ref
  // mirrors it into the RAF loop the same way selection is mirrored.
  const [labelMode, setLabelMode] = useState<LabelMode>('full');
  const labelModeRef = useRef<LabelMode>('full');
  const chooseLabelMode = (m: LabelMode) => {
    if (m === labelMode) return;
    labelModeRef.current = m; // synchronous — the RAF loop reads it next frame
    setLabelMode(m);
    useVvuSocketStore.getState().sendWormLog('VIEW_MODE', 'OPERATOR', `map labels ${m.toUpperCase()}`);
  };

  useEffect(() => {
    selectedRef.current = selectedNodeId ?? null;
  }, [selectedNodeId]);
  useEffect(() => {
    onNodeSelectRef.current = onNodeSelect;
  }, [onNodeSelect]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'vvu-map-cursor';
    canvas.style.touchAction = 'none';
    canvas.setAttribute('aria-label', 'Tactical ENU map of the Gqeberha edge rig');
    canvas.setAttribute('role', 'application');
    wrap.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = 0;
    let H = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    let didInit = false;
    const cam = camRef.current;

    const clampZoom = () => {
      const minPxm = Math.min(W, H) / 300;
      cam.pxm = Math.min(80, Math.max(minPxm, cam.pxm));
    };
    const resetView = () => {
      cam.cx = 0;
      cam.cy = 0;
      cam.pxm = Math.min(W, H) / 72;
      clampZoom();
    };

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width));
      H = Math.max(1, Math.round(r.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!didInit) {
        didInit = true;
        resetView();
      }
    };
    resize();

    terrainRef.current = buildTerrainCanvas(1024, EXT);

    // world (m) → screen (css px)
    const m2s = (wx: number, wy: number): [number, number] => [
      W / 2 + (wx - cam.cx) * cam.pxm,
      H / 2 - (wy - cam.cy) * cam.pxm,
    ];

    // ── pan / zoom (pointer events, incl. pinch) ──
    const pointers = new Map<number, { x: number; y: number }>();
    let dragBase: { cx: number; cy: number; x: number; y: number } | null = null;
    let pinchBase: { dist: number; pxm: number; wx: number; wy: number } | null = null;

    const worldAt = (sx: number, sy: number): [number, number] => [
      cam.cx + (sx - W / 2) / cam.pxm,
      cam.cy - (sy - H / 2) / cam.pxm,
    ];

    // ── node hit-testing (screen-space css px) ──
    // Nearest node within HIT_PX of the pointer. Co-located nodes (N01 mast and
    // N04 spool both project to ENU 0,0) resolve in REVERSE array order with a
    // strict <, so the pick matches the paint order — N04, drawn later, sits on
    // top of the cluster and wins the tap, mirroring the 3D mesh raycast.
    const HIT_PX = 14;
    const hitTest = (sx: number, sy: number): string | null => {
      let hit: string | null = null;
      let bestD = HIT_PX * HIT_PX;
      for (let i = N.length - 1; i >= 0; i--) {
        const [nx, ny] = m2s(N[i].x, N[i].y);
        const d = (nx - sx) * (nx - sx) + (ny - sy) * (ny - sy);
        if (d < bestD) {
          bestD = d;
          hit = N[i].nodeId;
        }
      }
      return hit;
    };

    // hover id (mouse) → pointer cursor + sage ring; tap bookkeeping below
    let hoverId: string | null = null;
    let pinchSeen = false; // any 2-pointer gesture suppresses the next tap
    const downScreen = new Map<number, { x: number; y: number }>();

    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      downScreen.set(e.pointerId, { x: e.clientX, y: e.clientY });
      hoverId = null;
      if (pointers.size === 1) {
        dragBase = { cx: cam.cx, cy: cam.cy, x: e.clientX, y: e.clientY };
        pinchBase = null;
      } else if (pointers.size === 2) {
        dragBase = null;
        pinchSeen = true;
        const pts = [...pointers.values()];
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        const rect = canvas.getBoundingClientRect();
        const [wx, wy] = worldAt(midX - rect.left, midY - rect.top);
        pinchBase = { dist: dist || 1, pxm: cam.pxm, wx, wy };
      }
    };

    const onMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) {
        // free-floating hover (no drag in progress): hit-test for the pointer
        // cursor + sage hover ring; touch never gets here without contact.
        if (pointers.size === 0 && e.pointerType === 'mouse') {
          const rect = canvas.getBoundingClientRect();
          hoverId = hitTest(e.clientX - rect.left, e.clientY - rect.top);
          canvas.style.cursor = hoverId ? 'pointer' : '';
        }
        return;
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1 && dragBase) {
        const dx = e.clientX - dragBase.x;
        const dy = e.clientY - dragBase.y;
        cam.cx = dragBase.cx - dx / cam.pxm;
        cam.cy = dragBase.cy + dy / cam.pxm;
        cam.cx = Math.max(-150, Math.min(150, cam.cx));
        cam.cy = Math.max(-150, Math.min(150, cam.cy));
      } else if (pointers.size === 2 && pinchBase) {
        const pts = [...pointers.values()];
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        const rect = canvas.getBoundingClientRect();
        const factor = dist / pinchBase.dist;
        cam.pxm = pinchBase.pxm * factor;
        clampZoom();
        // keep the pinch midpoint world-anchored
        const sxNow = midX - rect.left;
        const syNow = midY - rect.top;
        cam.cx = pinchBase.wx - (sxNow - W / 2) / cam.pxm;
        cam.cy = pinchBase.wy + (syNow - H / 2) / cam.pxm;
      }
    };

    // Shared pointer-up/cancel cleanup. allowTap: pointerup runs the tap
    // hit-test; pointercancel (browser aborted the gesture) never does.
    const endPointer = (e: PointerEvent, allowTap: boolean) => {
      const down = downScreen.get(e.pointerId);
      downScreen.delete(e.pointerId);
      pointers.delete(e.pointerId);
      if (pointers.size === 0) {
        const wasPinch = pinchSeen;
        pinchSeen = false;
        dragBase = null;
        pinchBase = null;
        // Non-drag tap: ≤6px travel between down and up, never straight after
        // a pinch. Hit a node → open the inspector + WORM log; empty map tap
        // → null (mirrors the 3D mesh: tapping bare terrain dismisses).
        if (allowTap && !wasPinch && down && Math.hypot(e.clientX - down.x, e.clientY - down.y) <= 6) {
          const rect = canvas.getBoundingClientRect();
          const hit = hitTest(e.clientX - rect.left, e.clientY - rect.top);
          onNodeSelectRef.current?.(hit);
          if (hit) {
            useVvuSocketStore.getState().sendWormLog('NODE_INSPECT', 'OPERATOR', `${hit} · tactical map pick`);
          }
        }
      } else if (pointers.size === 1) {
        const [only] = [...pointers.values()];
        dragBase = { cx: cam.cx, cy: cam.cy, x: only.x, y: only.y };
        pinchBase = null;
      }
    };
    const onUp = (e: PointerEvent) => endPointer(e, true);
    const onCancel = (e: PointerEvent) => endPointer(e, false);

    const onLeave = () => {
      hoverId = null;
      canvas.style.cursor = '';
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const [wx, wy] = worldAt(sx, sy);
      const factor = Math.pow(1.0015, -e.deltaY);
      cam.pxm = Math.min(80, Math.max(Math.min(W, H) / 300, cam.pxm * factor));
      cam.cx = wx - (sx - W / 2) / cam.pxm;
      cam.cy = wy + (sy - H / 2) / cam.pxm;
    };

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    // ── RAF render loop ──
    const t0 = performance.now();
    const render = () => {
      raf = requestAnimationFrame(render);
      if (document.hidden) return;
      const t = (performance.now() - t0) / 1000;
      const frame = useVvuSocketStore.getState().frame;
      const leak = frame?.leak ?? { active: false, nodeId: null, intensity: 0 };
      // label density (FULL / KEY / OFF) — read per frame, manual toggle only
      const lm = labelModeRef.current;

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#060806';
      ctx.fillRect(0, 0, W, H);

      // terrain bitmap (world-anchored)
      const terrain = terrainRef.current;
      if (terrain) {
        const [left, top] = m2s(-EXT, EXT);
        const [right, bottom] = m2s(EXT, -EXT);
        ctx.globalAlpha = 0.9;
        ctx.drawImage(terrain, left, top, right - left, bottom - top);
        ctx.globalAlpha = 1;
      }

      // 10 m grid
      const x0w = cam.cx - W / 2 / cam.pxm;
      const x1w = cam.cx + W / 2 / cam.pxm;
      const y0w = cam.cy - H / 2 / cam.pxm;
      const y1w = cam.cy + H / 2 / cam.pxm;
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#1a2415';
      ctx.beginPath();
      for (let gx = Math.ceil(x0w / 10) * 10; gx <= x1w; gx += 10) {
        const [sx] = m2s(gx, 0);
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, H);
      }
      for (let gy = Math.ceil(y0w / 10) * 10; gy <= y1w; gy += 10) {
        const [, sy] = m2s(0, gy);
        ctx.moveTo(0, sy);
        ctx.lineTo(W, sy);
      }
      ctx.stroke();

      // 50 m ticks + labels
      ctx.font = '9px ui-monospace, monospace';
      ctx.fillStyle = '#7a8a6e';
      ctx.strokeStyle = 'rgba(122,138,110,0.35)';
      ctx.beginPath();
      for (let gx = Math.ceil(x0w / 50) * 50; gx <= x1w; gx += 50) {
        const [sx] = m2s(gx, 0);
        ctx.moveTo(sx, H - 30);
        ctx.lineTo(sx, H - 22);
        ctx.textAlign = 'center';
        if (lm === 'full') ctx.fillText(`${gx}`, sx, H - 34);
      }
      for (let gy = Math.ceil(y0w / 50) * 50; gy <= y1w; gy += 50) {
        const [, sy] = m2s(0, gy);
        ctx.moveTo(28, sy);
        ctx.lineTo(36, sy);
        ctx.textAlign = 'left';
        if (lm === 'full') ctx.fillText(`${gy}`, 40, sy + 3);
      }
      ctx.stroke();

      // ── radar sweep (conic gradient + leading edge) ──
      const sweepSpeed = 0.8;
      const sweep = (t * sweepSpeed) % (Math.PI * 2);
      const [rcx, rcy] = m2s(0, 0);
      const Rs = 30 * cam.pxm;
      const hasConic = typeof ctx.createConicGradient === 'function';
      if (hasConic) {
        const grad = ctx.createConicGradient(sweep, rcx, rcy);
        grad.addColorStop(0, 'rgba(143,179,90,0)');
        grad.addColorStop(0.75, 'rgba(143,179,90,0.02)');
        grad.addColorStop(0.97, 'rgba(143,179,90,0.16)');
        grad.addColorStop(1, 'rgba(143,179,90,0.26)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(rcx, rcy, Math.max(1, Rs), 0, Math.PI * 2);
        ctx.fill();
      }
      // leading edge
      ctx.strokeStyle = 'rgba(143,179,90,0.75)';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = 'rgba(143,179,90,0.8)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(rcx, rcy);
      ctx.lineTo(rcx + Math.cos(sweep) * Rs, rcy + Math.sin(sweep) * Rs);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // geofence 25 m dashed
      const [gfx, gfy] = m2s(0, 0);
      const gr = GEOFENCE_M * cam.pxm;
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = 'rgba(107,138,64,0.55)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(gfx, gfy, Math.max(1, gr), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '8px ui-monospace, monospace';
      ctx.fillStyle = 'rgba(122,138,110,0.9)';
      ctx.textAlign = 'center';
      if (lm !== 'off') ctx.fillText('SENTINEL-2 · GEOFENCE 25m', gfx, gfy - gr - 6);

      // ── leak overlay ──
      const leakNode = leak.active && leak.nodeId ? N.find((n) => n.nodeId === leak.nodeId) : null;
      if (leakNode) {
        const [lx, ly] = m2s(leakNode.x, leakNode.y);
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
        // teal moisture gradient disc
        const mr = 20 * cam.pxm * (1 + 0.04 * Math.sin(t * 1.6));
        const mg = ctx.createRadialGradient(lx, ly, 0, lx, ly, Math.max(1, mr));
        mg.addColorStop(0, `rgba(46,168,160,${0.2 + 0.06 * pulse})`);
        mg.addColorStop(0.7, 'rgba(46,168,160,0.08)');
        mg.addColorStop(1, 'rgba(46,168,160,0)');
        ctx.fillStyle = mg;
        ctx.beginPath();
        ctx.arc(lx, ly, Math.max(1, mr), 0, Math.PI * 2);
        ctx.fill();
        // crimson pulsing ring band 20–25 m
        ctx.strokeStyle = `rgba(229,72,77,${0.35 + 0.45 * pulse})`;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = 'rgba(229,72,77,0.8)';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(lx, ly, (20 + 2.5 + 2.5 * Math.sin(t * 2)) * cam.pxm, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // ── pipes ──
      const drawPoly = (pts: Array<{ x: number; y: number }>, color: string, width: number, alpha = 1) => {
        ctx.strokeStyle = color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = width;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        pts.forEach((p, i) => {
          const [sx, sy] = m2s(p.x, p.y);
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.stroke();
        ctx.globalAlpha = 1;
      };

      drawPoly(PIPE_MAIN, C_MAIN, 4, 0.85);
      drawPoly(PIPE_HDPE, C_HDPE, 2.5, 0.9);
      drawPoly(PIPE_PVCO, C_PVCO, 2.5, 0.9);

      // marching flow dashes (direction of flow)
      const dash = (pts: Array<{ x: number; y: number }>, color: string) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([5, 9]);
        ctx.lineDashOffset = -((t * 22) % 14);
        ctx.beginPath();
        pts.forEach((p, i) => {
          const [sx, sy] = m2s(p.x, p.y);
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.stroke();
        ctx.setLineDash([]);
      };
      dash(PIPE_HDPE, 'rgba(143,220,160,0.9)');
      dash(PIPE_PVCO, 'rgba(46,160,200,0.9)');
      dash(PIPE_MAIN, 'rgba(230,238,245,0.7)');

      // DN300 flange ticks at N02/N04/N03
      ctx.strokeStyle = 'rgba(154,163,173,0.95)';
      ctx.lineWidth = 2;
      for (const p of PIPE_MAIN) {
        const [sx, sy] = m2s(p.x, p.y);
        ctx.beginPath();
        ctx.moveTo(sx - 5, sy - 5);
        ctx.lineTo(sx + 5, sy + 5);
        ctx.moveTo(sx - 5, sy + 5);
        ctx.lineTo(sx + 5, sy - 5);
        ctx.stroke();
      }

      // ── nodes: pulses, squares, labels ──
      // Task 11-c — hoisted above the loop: the selection drives label
      // priority (pre-reserved slot) + the reticle/label draw order below.
      const selId = selectedRef.current;
      const labelSlots: Array<[number, number]> = [];
      // Task 11-c — pre-reserve the SELECTED node's label slot. In the
      // zoomed-out rig cluster (N01/N02/N04 all within a few px of ENU 0,0)
      // the greedy pass otherwise lets a co-located neighbour (N01) claim the
      // slot and suppress the inspection target's own id.
      if (selId) {
        const rsn = N.find((n) => n.nodeId === selId);
        if (rsn) {
          const [rx, ry] = m2s(rsn.x, rsn.y);
          labelSlots.push([rx + 7, ry - 6]);
        }
      }
      ctx.font = '8px ui-monospace, monospace';
      N.forEach((n, i) => {
        const [sx, sy] = m2s(n.x, n.y);
        // pulse
        const ph = (t * 0.35 + i * 0.55) % 1;
        ctx.strokeStyle = `rgba(143,179,90,${0.5 * (1 - ph)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sx, sy, 4 + ph * 18, 0, Math.PI * 2);
        ctx.stroke();

        const isLeak = leakNode?.nodeId === n.nodeId;
        // blip flash under sweep
        const nodeAngle = Math.atan2(sy - rcy, sx - rcx);
        let d = (sweep - nodeAngle) % (Math.PI * 2);
        if (d < 0) d += Math.PI * 2;
        const flash = d < 1.1 ? 1 - d / 1.1 : 0;

        const size = Math.max(3, Math.min(9, 0.16 * cam.pxm + 2));
        ctx.shadowColor = isLeak ? 'rgba(229,72,77,0.9)' : flash > 0.05 ? 'rgba(200,255,0,0.9)' : 'rgba(200,255,0,0.45)';
        ctx.shadowBlur = 6 + flash * 8;
        ctx.fillStyle = isLeak
          ? `rgba(229,72,77,${0.7 + 0.3 * Math.sin(t * 6)})`
          : flash > 0.05
            ? `rgba(${Math.round(107 + 93 * flash)},${Math.round(138 + 117 * flash)},${Math.round(64 + 191 * flash)},0.95)`
            : 'rgba(107,138,64,0.9)';
        ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = flash > 0.05 ? `rgba(200,255,0,${0.5 + 0.5 * flash})` : 'rgba(200,255,0,0.55)';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx - size / 2, sy - size / 2, size, size);

        // label (greedy collision). KEY keeps primary nodes only; OFF drops
        // every node label — squares, pulses and pipes are unaffected.
        // Task 11-c — the selected node skips this pass: its id is drawn on a
        // backing chip AFTER the reticle (below), so it always reads on top.
        const lx = sx + 7;
        const ly = sy - 6;
        const labelVisible =
          lm !== 'off' && (lm === 'full' || PRIMARY_LABEL_NODES.has(n.nodeId)) && n.nodeId !== selId;
        if (labelVisible && !labelSlots.some(([px, py]) => Math.abs(px - lx) < 26 && Math.abs(py - ly) < 11)) {
          labelSlots.push([lx, ly]);
          ctx.fillStyle = isLeak ? '#e5484d' : '#c9d4bd';
          ctx.textAlign = 'left';
          ctx.fillText(n.nodeId, lx, ly + 6);
        }
      });

      // ── inspector affordances: sage hover ring + lime selection reticle ──
      // (selId was hoisted above the node loop — Task 11-c label priority.)
      if (hoverId && hoverId !== selId) {
        const hn = N.find((n) => n.nodeId === hoverId);
        if (hn) {
          const [hx, hy] = m2s(hn.x, hn.y);
          ctx.strokeStyle = 'rgba(143,179,90,0.85)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(hx, hy, 11 + 1.5 * Math.sin(t * 3), 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      if (selId) {
        const sn = N.find((n) => n.nodeId === selId);
        if (sn) {
          const [sx, sy] = m2s(sn.x, sn.y);
          const R = 15; // screen-px half-size — stays readable at any zoom level
          // rotating marching-dash square
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(t * 0.9);
          ctx.strokeStyle = 'rgba(200,255,0,0.85)';
          ctx.lineWidth = 1.3;
          ctx.setLineDash([6, 5]);
          ctx.lineDashOffset = -((t * 26) % 11);
          ctx.strokeRect(-R, -R, R * 2, R * 2);
          ctx.restore();
          ctx.setLineDash([]);
          // static lime corner brackets
          const B = R + 6;
          const L = 7;
          ctx.strokeStyle = '#c8ff00';
          ctx.lineWidth = 2;
          ctx.shadowColor = 'rgba(200,255,0,0.75)';
          ctx.shadowBlur = 7;
          ctx.beginPath();
          ctx.moveTo(sx - B, sy - B + L);
          ctx.lineTo(sx - B, sy - B);
          ctx.lineTo(sx - B + L, sy - B);
          ctx.moveTo(sx + B - L, sy - B);
          ctx.lineTo(sx + B, sy - B);
          ctx.lineTo(sx + B, sy - B + L);
          ctx.moveTo(sx + B, sy + B - L);
          ctx.lineTo(sx + B, sy + B);
          ctx.lineTo(sx + B - L, sy + B);
          ctx.moveTo(sx - B + L, sy + B);
          ctx.lineTo(sx - B, sy + B);
          ctx.lineTo(sx - B, sy + B - L);
          ctx.stroke();
          ctx.shadowBlur = 0;
          // INSPECT tag (flips to the left when the node hugs the right edge)
          ctx.font = 'bold 8px ui-monospace, monospace';
          const tag = 'INSPECT';
          const tw = ctx.measureText(tag).width;
          const flip = sx + B + tw + 15 > W;
          const tx = flip ? sx - B - 9 - tw : sx + B + 6;
          ctx.fillStyle = 'rgba(6,8,6,0.85)';
          ctx.fillRect(tx - 3, sy - B - 9, tw + 6, 12);
          ctx.strokeStyle = 'rgba(200,255,0,0.6)';
          ctx.lineWidth = 1;
          ctx.strokeRect(tx - 3, sy - B - 9, tw + 6, 12);
          ctx.fillStyle = '#c8ff00';
          ctx.textAlign = 'left';
          ctx.fillText(tag, tx, sy - B);
          // Task 11-c — the selected node's own id, drawn LAST (on top of the
          // marching-dash reticle) on a dark backing chip so the dashes never
          // cut the glyphs. Co-located neighbours' labels were suppressed by
          // the pre-reserved slot, so this is the cluster's winning label.
          ctx.font = 'bold 8px ui-monospace, monospace';
          const idw = ctx.measureText(sn.nodeId).width;
          ctx.fillStyle = 'rgba(6,8,6,0.85)';
          ctx.fillRect(sx + 4, sy - 6, idw + 6, 11);
          ctx.fillStyle = '#c8ff00';
          ctx.fillText(sn.nodeId, sx + 7, sy + 2);
        }
      }

      // ── crosshair + WGS84 readout ──
      const [chx, chy] = m2s(0, 0);
      ctx.strokeStyle = 'rgba(243,227,138,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(chx - 14, chy);
      ctx.lineTo(chx - 4, chy);
      ctx.moveTo(chx + 4, chy);
      ctx.lineTo(chx + 14, chy);
      ctx.moveTo(chx, chy - 14);
      ctx.lineTo(chx, chy - 4);
      ctx.moveTo(chx, chy + 4);
      ctx.lineTo(chx, chy + 14);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(chx, chy, 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = '7.5px ui-monospace, monospace';
      if (lm !== 'off') {
        // Task 11-c — dark backing chips: the anchor sits inside the rig
        // cluster at zoomed-out levels; reticle brackets / pipes must not
        // cut these glyphs.
        const alines = [
          'GQEBERHA ANCHOR',
          `${GQEBERHA_ANCHOR.lat.toFixed(4)}, ${GQEBERHA_ANCHOR.lon.toFixed(4)} · WGS84→ENU`,
        ];
        ctx.textAlign = 'center';
        alines.forEach((txt, li) => {
          const aw = ctx.measureText(txt).width;
          const ay = chy + 24 + li * 10;
          ctx.fillStyle = 'rgba(6,8,6,0.8)';
          ctx.fillRect(chx - aw / 2 - 3, ay - 8, aw + 6, 10);
          ctx.fillStyle = 'rgba(122,138,110,0.95)';
          ctx.fillText(txt, chx, ay);
        });
      }

      // ── compass rose (screen-fixed, top-right below HUD chips) ──
      const compX = W - 44;
      const compY = 122;
      ctx.strokeStyle = 'rgba(107,138,64,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(compX, compY, 15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(compX, compY + 9);
      ctx.lineTo(compX, compY - 9);
      ctx.stroke();
      ctx.fillStyle = '#f3e38a';
      ctx.beginPath();
      ctx.moveTo(compX, compY - 13);
      ctx.lineTo(compX - 3, compY - 6);
      ctx.lineTo(compX + 3, compY - 6);
      ctx.closePath();
      ctx.fill();
      ctx.font = '8px ui-monospace, monospace';
      ctx.fillStyle = '#8fb35a';
      ctx.textAlign = 'center';
      ctx.fillText('N', compX, compY - 16);
      ctx.fillStyle = '#7a8a6e';
      ctx.fillText('E', compX + 20, compY + 3);
      ctx.fillText('S', compX, compY + 23);
      ctx.fillText('W', compX - 20, compY + 3);

      // ── Task 10-b: KEY-density cluster hint — secondary nodes (N05–N12)
      // stay visible as unlabeled squares in KEY mode; this screen-fixed tag
      // under the compass tells the operator how many service nodes are
      // unlabelled and how to get their IDs back (FULL). Screen-fixed so it
      // never collides with world-anchored rig geometry. ──
      if (lm === 'key') {
        const unlabeled = N.length - PRIMARY_LABEL_NODES.size;
        ctx.font = '7.5px ui-monospace, monospace';
        ctx.fillStyle = 'rgba(122,138,110,0.95)';
        ctx.textAlign = 'center';
        ctx.fillText(`+${unlabeled} SERVICE NODES UNLABELED · FULL RESTORES IDS`, compX, compY + 40);
      }

      // ── scale bar (bottom-left) ──
      const candidates = [2, 5, 10, 20, 50, 100];
      let barM = candidates[0];
      for (const c of candidates) {
        if (c * cam.pxm >= 40) {
          barM = c;
          break;
        }
        barM = c;
      }
      const barPx = Math.max(24, barM * cam.pxm);
      const bx = 18;
      const by = H - 48;
      ctx.strokeStyle = 'rgba(200,255,0,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + barPx, by);
      ctx.moveTo(bx, by - 4);
      ctx.lineTo(bx, by + 4);
      ctx.moveTo(bx + barPx, by - 4);
      ctx.lineTo(bx + barPx, by + 4);
      ctx.stroke();
      ctx.font = '8px ui-monospace, monospace';
      ctx.fillStyle = '#8fb35a';
      ctx.textAlign = 'left';
      ctx.fillText(`${barM} m`, bx, by - 7);

    };

    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('wheel', onWheel);
      canvas.remove();
    };
  }, []);

  const zoom = (factor: number) => {
    const cam = camRef.current;
    cam.pxm = Math.min(80, Math.max(2, cam.pxm * factor));
  };
  const recenter = () => {
    const cam = camRef.current;
    cam.cx = 0;
    cam.cy = 0;
    cam.pxm = 10;
  };

  return (
    <div ref={wrapRef} className="absolute inset-0 vvu-canvas-wrap bg-[#060806]">
      {/* zoom / re-center + label-density controls (DOM buttons over the canvas).
          The NodeInspector (top-right, z-20) is tall enough to cover these at
          top-[44%] on short viewports, so while a node is selected the stack
          slides left of the panel (206px mobile / 280px sm + margins). The
          LABELS control rides the same collision-avoidance slide. */}
      <div
        className={`absolute right-2 sm:right-3 top-[44%] flex flex-col gap-1.5 z-20 transition-transform duration-300 ease-out ${
          selectedNodeId ? '-translate-x-[218px] sm:-translate-x-[292px]' : ''
        }`}
      >
        <button
          type="button"
          onClick={() => zoom(1.35)}
          aria-label="Zoom map in"
          className="vvu-panel-solid backdrop-blur-sm w-11 h-11 min-h-11 flex items-center justify-center text-[#8fb35a] text-lg font-bold border-[rgba(143,179,90,0.35)]! hover:text-[#c8ff00] hover:border-[rgba(143,179,90,0.75)]! hover:bg-[rgba(200,255,0,0.07)] active:scale-[0.94] active:shadow-[inset_0_2px_6px_rgba(0,0,0,0.45)] transition-all duration-[120ms] select-none"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => zoom(1 / 1.35)}
          aria-label="Zoom map out"
          className="vvu-panel-solid backdrop-blur-sm w-11 h-11 min-h-11 flex items-center justify-center text-[#8fb35a] text-lg font-bold border-[rgba(143,179,90,0.35)]! hover:text-[#c8ff00] hover:border-[rgba(143,179,90,0.75)]! hover:bg-[rgba(200,255,0,0.07)] active:scale-[0.94] active:shadow-[inset_0_2px_6px_rgba(0,0,0,0.45)] transition-all duration-[120ms] select-none"
        >
          −
        </button>
        <button
          type="button"
          onClick={recenter}
          aria-label="Re-center map on rig"
          title="Recenter on rig"
          className="vvu-panel-solid backdrop-blur-sm w-11 h-11 min-h-11 flex items-center justify-center text-[#f3e38a] text-sm border-[rgba(143,179,90,0.35)]! hover:text-[#c8ff00] hover:border-[rgba(143,179,90,0.75)]! hover:bg-[rgba(200,255,0,0.07)] active:scale-[0.94] active:shadow-[inset_0_2px_6px_rgba(0,0,0,0.45)] transition-all duration-[120ms] select-none"
        >
          ⌖
        </button>

        {/* label density: FULL / KEY / OFF — manual declutter for the canvas
            annotations. Same active treatment as the top-center MESH/MAP
            segmented control (lime tint + inset ring/press shadow). */}
        <div
          role="group"
          aria-label="map label density control"
          className="vvu-panel-solid backdrop-blur-md flex flex-col gap-1 p-1 mt-0.5"
        >
          <span className="vvu-label text-[6px] sm:text-[6.5px] font-bold text-[#7a8a6e] px-1 tracking-[0.18em] select-none">
            LABELS
          </span>
          <div className="flex gap-0.5">
            {LABEL_MODES.map((m) => {
              const active = labelMode === m;
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={active}
                  onClick={() => chooseLabelMode(m)}
                  title={`Map labels: ${m === 'full' ? 'all annotations' : m === 'key' ? 'primary nodes only' : 'no labels'}`}
                  className={`vvu-label h-11 min-h-11 min-w-[44px] px-2 rounded-[5px] text-[8px] sm:text-[9px] font-bold tracking-[0.1em] transition-all duration-150 select-none active:scale-[0.96] ${
                    active
                      ? 'bg-[rgba(200,255,0,0.1)] text-[#c8ff00] shadow-[inset_0_0_0_1px_rgba(200,255,0,0.35),inset_0_2px_6px_rgba(0,0,0,0.45)]'
                      : 'text-[#7a8a6e] hover:text-[#c9d4bd] hover:bg-[rgba(107,138,64,0.12)]'
                  }`}
                >
                  {m.toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TacticalMap;
