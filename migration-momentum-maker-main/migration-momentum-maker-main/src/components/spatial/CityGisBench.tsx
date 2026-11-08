"use client";

// src/components/spatial/CityGisBench.tsx — VVU CITY DIGITAL TWIN GIS BENCH
// (spec: vvu-3d-gis-bench-v3-20260901 · wa_image_8183522056652419501).
//
// The telemetry rig is NOT an isolated mast: N01–N06 are EMBEDDED on pipeline
// mains crossing a city block grid — SYS.02 GIS SPATIAL TRUTH (MAP_SYNC ·
// GEO_GRID · PE pilot anchor) + SYS.03 YOLO EDGE AI live in the DOM HUD
// (CityHudPanels). Five toggleable layers (store-backed, survive route
// switches):
//   L1 INFRA  — 3 pipeline mains (DN300 main + 2 services) + node pods + GEO_GRID anchor
//   L2 FLOW   — animated hydraulic dashes riding the mains
//   L3 POWER  — catenary feed + pulsing substation
//   L4 YOLO   — 25R tracked objects (14 CRITICAL) as moving bounding boxes on roads
//   L5 THREAT — critical-alert heatmap patches
//
// ── Round 30 · PROOFBRIDGE SUBSTRATE (one-file scope) ────────────────────
// BASE SWAP: PCB-style trust substrate under the city (Micro-City V3 port
// from upload/) — solder-mask plate, gold bus spine, copper fabric, corner
// mounting holes. Camera/lights/renderer/HUD/gisLayers store: untouched.
// Four epistemic layers ride it (keys 6/7/8/9, component-local):
//   L6 CUSTODY   — Poggi Q3 · first-signer chain + six equal district
//                   rings pulsing IN PHASE (universality, not elite-first)
//   L7 PROVENANCE — Engineering Q3 · copper traces fab→every node pod +
//                   one standards ring per node (component provenance)
//   L8 SEQUENCE  — Athu Zam Q3 · CAPITEC_R1B corridor (call → balance →
//                   beneficiary → R20k) halted at the DECISION GATE (BLOCK)
//   L9 RECEIPT   — append-only receipt rail; one REJECTED link stays seen
// Discipline: offsets hash from position (hashPos) so duplicate vertices
// agree; roadClamp keeps footprints ≥ 2.1 m off the roads.
// Harness: tests/proofbridge-harness/Capitec_Fraud_Evidence_Harness.json.
//
// Parity with the rig scene: orbit controls (idle auto-rotate), camera intro,
// raycast node selection → NodeInspector, pipe tap → FSM CLICK leak (crimson
// pipe + soil-moisture ring + drip particles), FAIL_CLOSED fog collapse,
// canvas-sprite labels refreshed from the live telemetry store, stats
// callback (fps / draw calls). All state read imperatively from the zustand
// store inside one RAF loop — zero re-render coupling.

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EDGE_COLD_FALLBACK } from "@/lib/vvu-gis";
import { useVvuSocketStore } from "@/hooks/use-vvu-socket";
import type { TelemetryFrame } from "@/types/vvu";

interface CityGisBenchProps {
  onStats?: (stats: { fps: number; drawCalls: number }) => void;
  /** Node inspector: emitted when the operator taps a city node pod (null = dismiss). */
  onNodeSelect?: (nodeId: string | null) => void;
}

// ── constants ────────────────────────────────────────────────────────────────

const BG = 0x060806;
const SAGE = 0x6b8a40;
const SAGE_BRIGHT = 0x8fb35a;
const LIME = 0xc8ff00;
const CRIMSON = 0xe5484d;
const AMBER = 0xe0a030;
const TEAL = 0x2ea8a0;
const PALE = 0xc9d4bd;

const CITY_EXTENT = 120; // metres, x/z ∈ [-60, 60]
const ROADS = [-40, -20, 0, 20, 40];
const DRIP_COUNT = 48;
/** Round 13 — the first N THREAT patches trail the first N CRITICAL movers. */
const TRAIL_PATCH_COUNT = 3;

/** Round 30 — ProofBridge substrate palette (Micro-City V3 port). */
const GOLD = 0xd8a62e; // data-bus spine + receipt chain head
const COPPER = 0xb06a2c; // provenance routing fabric
const MASK = 0x0a3a26; // PCB solder-mask green (substrate plate)
const SILK = 0x2f6b4d; // silkscreen marks on the substrate
/** roadClamp guard — building faces stay ≥ 2.1 m off every road centreline
 *  (pre-fix worst case measured 2.092 m; see PROOFBRIDGE_BUILD_REPORT.md). */
const ROAD_GUARD = 2.1;
/** Worst-case building half-extent ((6.5 + 5) / 2) — the roadClamp bound. */
const MAX_HALF = 5.75;
/** Substrate plate extent (m) — the ProofBridge layer under the city. */
const SUBSTRATE_EXTENT = 124;
/** L6 district lattice — six anchors, one equal service ring each. */
const DISTRICT_X = [-28, 0, 28];
const DISTRICT_Z = [-26, 26];

/** Deterministic PRNG so the bench renders identically on every device. */
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

const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

/** Position hash — a PURE function of quantised (x, z, salt). Two meshes
 *  deriving geometry from the same coordinates agree by construction; a
 *  sequential PRNG makes every extra consumer shift the whole stream (the
 *  mesh-tearing trap). All Round-30 derived offsets route through this. */
function hashPos(x: number, z: number, salt: number): number {
  let h =
    Math.imul(x * 0x1f1f1f1f, 0x85ebca6b) ^
    Math.imul(z * 0x2545f491, 0xc2b2ae35) ^
    Math.imul(salt, 0x9e3779b1);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** roadClamp — push a centre out so its footprint keeps ROAD_GUARD of
 *  clearance from every road centreline. Worst footprint 11.5 m + 2×2.1 m
 *  guard fits inside the 20 m road pitch, so clamping toward one road can
 *  never breach the next. */
function roadClamp(c: number, half: number): number {
  let out = c;
  for (const road of ROADS) {
    const need = ROAD_GUARD + half;
    const d = out - road;
    if (Math.abs(d) < need) out = road + (d < 0 ? -need : need);
  }
  return out;
}

// ── canvas texture helpers ───────────────────────────────────────────────────

function makeLabelCanvas(): { cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const cv = document.createElement("canvas");
  cv.width = 256;
  cv.height = 64;
  const ctx = cv.getContext("2d");
  if (!ctx) throw new Error("VVU: 2D context unavailable");
  return { cv, ctx };
}

function drawLabel(ctx: CanvasRenderingContext2D, title: string, value: string): void {
  ctx.clearRect(0, 0, 256, 64);
  ctx.fillStyle = "rgba(6,8,6,0.78)";
  ctx.fillRect(4, 4, 248, 56);
  ctx.strokeStyle = "rgba(107,138,64,0.55)";
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, 248, 56);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = "700 14px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillStyle = "#f3e38a";
  ctx.fillText(title, 14, 27);
  ctx.font = "700 17px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillStyle = "#c8ff00";
  ctx.fillText(value, 14, 50);
}

/** Radial crimson gradient — the L5 THREAT heatmap patch + leak moisture ring. */
function makeHeatTexture(): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = 256;
  cv.height = 256;
  const c = cv.getContext("2d");
  if (c) {
    const g = c.createRadialGradient(128, 128, 6, 128, 128, 126);
    g.addColorStop(0, "rgba(229,72,77,0.55)");
    g.addColorStop(0.45, "rgba(229,72,77,0.22)");
    g.addColorStop(1, "rgba(229,72,77,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ── component ────────────────────────────────────────────────────────────────

export function CityGisBench({ onStats, onNodeSelect }: CityGisBenchProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const onStatsRef = useRef(onStats);
  const onNodeSelectRef = useRef(onNodeSelect);
  const [webglFailed, setWebglFailed] = useState(false);

  // Round 30 — substrate layers. Component-local ON PURPOSE (gisLayers store
  // + HUD chips are frozen L1–L5 scope): keys 6/7/8/9, default all-ON, ref
  // mirror feeds the RAF loop (zero re-render, as onStats/onNodeSelect).
  const [substrateOn, setSubstrateOn] = useState<Record<"L6" | "L7" | "L8" | "L9", boolean>>({
    L6: true,
    L7: true,
    L8: true,
    L9: true,
  });
  const substrateRef = useRef(substrateOn);

  useEffect(() => {
    onStatsRef.current = onStats;
  }, [onStats]);

  useEffect(() => {
    onNodeSelectRef.current = onNodeSelect;
  }, [onNodeSelect]);

  useEffect(() => {
    substrateRef.current = substrateOn;
  }, [substrateOn]);

  // keys 6/7/8/9 flip the substrate layers (typing in inputs never toggles).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable))
        return;
      if (e.key === "6") setSubstrateOn((s) => ({ ...s, L6: !s.L6 }));
      else if (e.key === "7") setSubstrateOn((s) => ({ ...s, L7: !s.L7 }));
      else if (e.key === "8") setSubstrateOn((s) => ({ ...s, L8: !s.L8 }));
      else if (e.key === "9") setSubstrateOn((s) => ({ ...s, L9: !s.L9 }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const disposables: Array<{ dispose(): void }> = [];
    const track = <T extends { dispose(): void }>(d: T): T => {
      disposables.push(d);
      return d;
    };

    // ── renderer / scene / camera ───────────────────────────────────────────
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
    } catch {
      setWebglFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(BG, 1);
    renderer.domElement.style.display = "block";
    renderer.domElement.classList.add("vvu-canvas-wrap");
    mount.appendChild(renderer.domElement);
    track(renderer);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(BG, 120, 340);
    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 700);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 10;
    controls.maxDistance = 220;
    controls.maxPolarAngle = 1.38;
    controls.target.set(0, 1.5, 0);
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.28;
    controls.enabled = false; // during intro
    track(controls);

    // idle auto-orbit: pause 8 s after user interaction
    let resumeTimer: ReturnType<typeof setTimeout> | null = null;
    const onControlsStart = () => {
      controls.autoRotate = false;
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        controls.autoRotate = true;
      }, 8000);
    };
    controls.addEventListener("start", onControlsStart);

    // lights
    const ambient = new THREE.AmbientLight(0x8a9a78, 0.5);
    const hemi = new THREE.HemisphereLight(0x9ab38a, 0x0a0f0a, 0.55);
    const dirLight = new THREE.DirectionalLight(0xe8f0d8, 1.4);
    dirLight.position.set(60, 90, 40);
    scene.add(ambient, hemi, dirLight);

    // ── ground + road grid (the "white lines on black" city base) ───────────
    const ground = new THREE.Mesh(
      track(new THREE.PlaneGeometry(400, 400)),
      track(new THREE.MeshStandardMaterial({ color: 0x090c09, roughness: 0.96, metalness: 0.02 })),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const grid = new THREE.GridHelper(CITY_EXTENT, 6, 0x9db08c, 0x33452a);
    grid.position.y = 0.04;
    (grid.material as THREE.LineBasicMaterial).transparent = true;
    (grid.material as THREE.LineBasicMaterial).opacity = 0.4;
    track(grid.geometry);
    track(grid.material);
    scene.add(grid);

    // faint outer reference grid (GEO_GRID survey fabric)
    const outer = new THREE.GridHelper(360, 18, 0x1c2814, 0x141d10);
    outer.position.y = 0.02;
    (outer.material as THREE.LineBasicMaterial).transparent = true;
    (outer.material as THREE.LineBasicMaterial).opacity = 0.3;
    track(outer.geometry);
    track(outer.material);
    scene.add(outer);

    // ── Round 30 · BASE SWAP — ProofBridge substrate under the city ────────
    // Micro-City V3 port: PCB-style trust plate as a flat decal stack (all
    // below y 0.07) — buildings, pipes, movers and picking keep their geometry.
    const substrate = new THREE.Mesh(
      track(new THREE.PlaneGeometry(SUBSTRATE_EXTENT, SUBSTRATE_EXTENT)),
      track(new THREE.MeshStandardMaterial({ color: MASK, roughness: 0.82, metalness: 0.12 })),
    );
    substrate.rotation.x = -Math.PI / 2;
    substrate.position.y = 0.015;
    scene.add(substrate);
    // copper routing fabric on the mask (10 m hairline pitch)
    const copperGrid = new THREE.GridHelper(CITY_EXTENT, 12, COPPER, 0x0d2c1c);
    copperGrid.position.y = 0.03;
    (copperGrid.material as THREE.LineBasicMaterial).transparent = true;
    (copperGrid.material as THREE.LineBasicMaterial).opacity = 0.26;
    track(copperGrid.geometry);
    track(copperGrid.material);
    scene.add(copperGrid);
    // gold data-bus spine — southern mirror of the L3 catenary feed
    const busMat = track(
      new THREE.MeshStandardMaterial({
        color: GOLD,
        roughness: 0.35,
        metalness: 0.7,
        emissive: GOLD,
        emissiveIntensity: 0.22,
      }),
    );
    const bus = new THREE.Mesh(track(new THREE.BoxGeometry(116, 0.09, 1.5)), busMat);
    bus.position.set(0, 0.05, 26);
    scene.add(bus);
    for (const ex of [-58, 58]) {
      const tab = new THREE.Mesh(track(new THREE.BoxGeometry(2.6, 0.11, 2.6)), busMat);
      tab.position.set(ex, 0.05, 26);
      scene.add(tab);
    }
    // corner mounting holes + silkscreen fixture rings
    const holeMat = track(new THREE.MeshBasicMaterial({ color: 0x05070a }));
    for (const hx of [-58, 58]) {
      for (const hz of [-58, 58]) {
        const hole = new THREE.Mesh(track(new THREE.CylinderGeometry(0.9, 0.9, 0.1, 20)), holeMat);
        hole.position.set(hx, 0.035, hz);
        scene.add(hole);
        const silk = new THREE.Mesh(
          track(new THREE.RingGeometry(1.25, 1.45, 28)),
          track(
            new THREE.MeshBasicMaterial({
              color: SILK,
              transparent: true,
              opacity: 0.55,
              side: THREE.DoubleSide,
              depthWrite: false,
            }),
          ),
        );
        silk.rotation.x = -Math.PI / 2;
        silk.position.set(hx, 0.045, hz);
        scene.add(silk);
      }
    }

    // ── city blocks: 20 extruded buildings, deterministic skyline ───────────
    const edgeMat = track(
      new THREE.LineBasicMaterial({ color: PALE, transparent: true, opacity: 0.3 }),
    );
    const buildingMat = track(
      new THREE.MeshStandardMaterial({ color: 0x0d120c, roughness: 0.85, metalness: 0.05 }),
    );

    const rnd = mulberry32(20260901);
    const blockCenters: number[] = [-50, -30, -10, 10, 30, 50];
    for (let i = 0; i < 20; i++) {
      const bx = blockCenters[i % 6];
      const bz = blockCenters[Math.floor((i * 7 + 3) % 6)];
      // jitter inside the 20 m block, keep the road corridors (±3 m) clear
      // Round 30 — jitter is a position hash (cell + slot salt): consumers
      // of this block derive identical geometry by construction, where the
      // old sequential draws were call-order dependent (mesh-tearing trap).
      // roadClamp holds the worst-case footprint off the roads (measured guard).
      const jx = roadClamp(bx + (hashPos(bx, bz, 0x60 + i * 2) - 0.5) * 5, MAX_HALF);
      const jz = roadClamp(bz + (hashPos(bx, bz, 0x61 + i * 2) - 0.5) * 5, MAX_HALF);
      const w = 6.5 + rnd() * 5;
      const d = 6.5 + rnd() * 5;
      // skyline: taller ring toward the city edge, flat core for the bench
      const r = Math.hypot(jx, jz);
      const h = 5 + rnd() * 7 + smoothstep(18, 55, r) * (10 + rnd() * 16);
      const geo = track(new THREE.BoxGeometry(w, h, d));
      const mesh = new THREE.Mesh(geo, buildingMat);
      mesh.position.set(jx, h / 2, jz);
      const eg = track(new THREE.EdgesGeometry(geo, 24));
      mesh.add(new THREE.LineSegments(eg, edgeMat));
      scene.add(mesh);
    }

    // ── L1 INFRA — 3 pipeline mains crossing the city ───────────────────────
    const infraGroup = new THREE.Group();
    scene.add(infraGroup);

    const mkCurve = (pts: number[][]): THREE.CatmullRomCurve3 =>
      new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])));

    // DN300 MAIN (lime) — S-curve diagonal through the core; N01/N04/N03 live on it
    const mainCurve = mkCurve([
      [-58, 0.25, -34],
      [-34, 0.25, -26],
      [-6, 0.25, -2],
      [18, 0.25, 14],
      [44, 0.25, 30],
      [58, 0.25, 44],
    ]);
    // LINE B (teal) — southern lateral; N02/N05
    const lineBCurve = mkCurve([
      [-58, 0.2, 22],
      [-30, 0.2, 30],
      [0, 0.2, 38],
      [28, 0.2, 30],
      [58, 0.2, 20],
    ]);
    // LINE C (sage) — western north-south service; N06
    const lineCCurve = mkCurve([
      [-46, 0.2, -58],
      [-40, 0.2, -30],
      [-38, 0.2, 0],
      [-40, 0.2, 30],
      [-44, 0.2, 58],
    ]);

    interface PipeDef {
      curve: THREE.CatmullRomCurve3;
      radius: number;
      emissive: number;
      glow: number;
      nodes: string[];
      tube: THREE.Mesh;
      mat: THREE.MeshStandardMaterial;
      glowMat: THREE.MeshBasicMaterial;
    }

    const pipeMeshes: THREE.Mesh[] = [];
    const pipes: PipeDef[] = [];

    const mkPipe = (
      curve: THREE.CatmullRomCurve3,
      radius: number,
      colorBase: number,
      emissive: number,
      emissiveIntensity: number,
      glow: number,
      nodes: string[],
    ): PipeDef => {
      const tubeGeo = track(new THREE.TubeGeometry(curve, 140, radius, 10, false));
      const mat = track(
        new THREE.MeshStandardMaterial({
          color: colorBase,
          emissive,
          emissiveIntensity,
          roughness: 0.55,
          metalness: 0.1,
        }),
      );
      const tube = new THREE.Mesh(tubeGeo, mat);
      infraGroup.add(tube);
      pipeMeshes.push(tube);
      // additive halo under-tube so the mains read as glowing overlay lines
      const glowGeo = track(new THREE.TubeGeometry(curve, 90, radius * 2.4, 8, false));
      const glowMat = track(
        new THREE.MeshBasicMaterial({
          color: emissive,
          transparent: true,
          opacity: glow,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      const halo = new THREE.Mesh(glowGeo, glowMat);
      infraGroup.add(halo);
      return { curve, radius, emissive, glow, nodes, tube, mat, glowMat };
    };

    const pipeMain = mkPipe(mainCurve, 0.5, 0x243307, LIME, 0.75, 0.1, ["N01", "N04", "N03"]);
    const pipeB = mkPipe(lineBCurve, 0.3, 0x0c2220, TEAL, 0.5, 0.08, ["N02", "N05"]);
    const pipeC = mkPipe(lineCCurve, 0.3, 0x1c260f, SAGE_BRIGHT, 0.45, 0.08, ["N06"]);
    pipes.push(pipeMain, pipeB, pipeC);

    // ── N01–N06 node pods EMBEDDED on the pipelines ─────────────────────────
    const nodeMeshes: THREE.Mesh[] = [];
    interface PodEntry {
      nodeId: string;
      group: THREE.Group;
      mat: THREE.MeshStandardMaterial;
      baseColor: THREE.Color;
      beaconMat: THREE.MeshStandardMaterial;
    }
    const pods: PodEntry[] = [];

    const NODE_T: Record<string, { pipe: PipeDef; t: number }> = {
      N01: { pipe: pipeMain, t: 0.16 },
      N04: { pipe: pipeMain, t: 0.5 },
      N03: { pipe: pipeMain, t: 0.84 },
      N02: { pipe: pipeB, t: 0.3 },
      N05: { pipe: pipeB, t: 0.76 },
      N06: { pipe: pipeC, t: 0.5 },
    };

    interface LabelEntry {
      sprite: THREE.Sprite;
      texture: THREE.CanvasTexture;
      ctx: CanvasRenderingContext2D;
      title: string;
      val: (f: TelemetryFrame | null) => string;
      lastText: string;
    }
    const labels: LabelEntry[] = [];

    const podGeo = track(new THREE.BoxGeometry(1.5, 1.7, 1.3));
    const beaconGeo = track(new THREE.SphereGeometry(0.24, 12, 10));

    for (const nodeId of Object.keys(NODE_T)) {
      const { pipe, t } = NODE_T[nodeId];
      const pos = pipe.curve.getPointAt(t);
      const group = new THREE.Group();
      group.position.copy(pos);
      group.position.y = 0.85;

      const mat = track(
        new THREE.MeshStandardMaterial({
          color: 0x16220e,
          roughness: 0.7,
          metalness: 0.15,
          emissive: 0x000000,
        }),
      );
      const podMesh = new THREE.Mesh(podGeo, mat);
      podMesh.userData.nodeId = nodeId;
      nodeMeshes.push(podMesh);
      const eg = track(new THREE.EdgesGeometry(podGeo, 24));
      podMesh.add(new THREE.LineSegments(eg, edgeMat));
      group.add(podMesh);

      // telemetry beacon — the embedded-node live pulse
      const beaconMat = track(
        new THREE.MeshStandardMaterial({ color: 0x1a2a08, emissive: LIME, emissiveIntensity: 0.9 }),
      );
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.y = 1.25;
      group.add(beacon);

      infraGroup.add(group);
      pods.push({ nodeId, group, mat, baseColor: new THREE.Color(0x16220e), beaconMat });

      // live canvas-sprite label above the pod
      const { cv, ctx } = makeLabelCanvas();
      const texture = track(new THREE.CanvasTexture(cv));
      const sprite = new THREE.Sprite(
        track(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })),
      );
      sprite.center.set(0.5, 0);
      sprite.position.set(pos.x, 2.35, pos.z);
      infraGroup.add(sprite);
      labels.push({
        sprite,
        texture,
        ctx,
        title: nodeId,
        val: (f: TelemetryFrame | null) => {
          const nd = f?.nodes.find((x) => x.nodeId === nodeId);
          return nd
            ? `${nd.flowRate.toFixed(1)} L/s`
            : `${EDGE_COLD_FALLBACK.flowLps.toFixed(1)} L/s`;
        },
        lastText: "",
      });
    }

    // ── GEO_GRID anchor crosshair (MAP_SYNC pulse, city centre = N04) ───────
    const anchorPos = pipeMain.curve.getPointAt(0.5);
    const anchorGroup = new THREE.Group();
    anchorGroup.position.set(anchorPos.x, 0.08, anchorPos.z);
    const ring1 = new THREE.Mesh(
      track(new THREE.RingGeometry(3.1, 3.45, 64)),
      track(
        new THREE.MeshBasicMaterial({
          color: LIME,
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      ),
    );
    ring1.rotation.x = -Math.PI / 2;
    anchorGroup.add(ring1);
    const ring2 = new THREE.Mesh(
      track(new THREE.RingGeometry(4.9, 5.06, 64)),
      track(
        new THREE.MeshBasicMaterial({
          color: LIME,
          transparent: true,
          opacity: 0.2,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      ),
    );
    ring2.rotation.x = -Math.PI / 2;
    anchorGroup.add(ring2);
    const crossPts: THREE.Vector3[] = [
      new THREE.Vector3(-6.5, 0, 0),
      new THREE.Vector3(6.5, 0, 0),
      new THREE.Vector3(0, 0, -6.5),
      new THREE.Vector3(0, 0, 6.5),
    ];
    const crossGeo = track(new THREE.BufferGeometry().setFromPoints(crossPts));
    anchorGroup.add(
      new THREE.LineSegments(
        crossGeo,
        track(new THREE.LineBasicMaterial({ color: LIME, transparent: true, opacity: 0.35 })),
      ),
    );
    infraGroup.add(anchorGroup);

    // ── L2 FLOW — animated dashes riding the mains ──────────────────────────
    const flowGroup = new THREE.Group();
    scene.add(flowGroup);

    interface FlowDash {
      mesh: THREE.Mesh;
      pipe: PipeDef;
      t0: number;
      speed: number;
    }
    const flowDashes: FlowDash[] = [];
    const dashGeo = track(new THREE.BoxGeometry(0.2, 0.12, 1.0));
    for (const pipe of pipes) {
      const n = pipe === pipeMain ? 22 : 14;
      for (let i = 0; i < n; i++) {
        const mat = track(
          new THREE.MeshBasicMaterial({
            color: pipe.emissive,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );
        const mesh = new THREE.Mesh(dashGeo, mat);
        flowGroup.add(mesh);
        flowDashes.push({
          mesh,
          pipe,
          t0: i / n,
          speed: pipe === pipeMain ? 0.028 : 0.02, // fraction per second
        });
      }
    }

    // ── L3 POWER — catenary feed + substation ───────────────────────────────
    const powerGroup = new THREE.Group();
    scene.add(powerGroup);

    const poleMat = track(
      new THREE.MeshStandardMaterial({ color: 0x1a221a, roughness: 0.8, metalness: 0.2 }),
    );
    const poleGeo = track(new THREE.CylinderGeometry(0.14, 0.18, 5.4, 8));
    const crossarmGeo = track(new THREE.BoxGeometry(0.12, 0.12, 1.5));
    const poleXs = [-50, -25, 0, 25, 50];
    const wirePts: number[] = [];
    for (const px of poleXs) {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(px, 2.7, -24.5);
      powerGroup.add(pole);
      const arm = new THREE.Mesh(crossarmGeo, poleMat);
      arm.position.set(px, 5.25, -24.5);
      powerGroup.add(arm);
    }
    // two sagging wires between consecutive pole tops
    for (const dz of [-0.4, 0.4]) {
      for (let i = 0; i < poleXs.length - 1; i++) {
        const x0 = poleXs[i];
        const x1 = poleXs[i + 1];
        for (let s = 0; s < 14; s++) {
          const u0 = s / 14;
          const u1 = (s + 1) / 14;
          const yAt = (u: number) => 5.25 - Math.sin(Math.PI * u) * 0.85;
          wirePts.push(x0 + (x1 - x0) * u0, yAt(u0), -24.5 + dz);
          wirePts.push(x0 + (x1 - x0) * u1, yAt(u1), -24.5 + dz);
        }
      }
    }
    const wireGeo = track(new THREE.BufferGeometry());
    wireGeo.setAttribute("position", new THREE.Float32BufferAttribute(wirePts, 3));
    powerGroup.add(
      new THREE.LineSegments(
        wireGeo,
        track(new THREE.LineBasicMaterial({ color: PALE, transparent: true, opacity: 0.4 })),
      ),
    );

    // substation — pulsing amber block at the feed end
    const subMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x1f1a0c,
        emissive: AMBER,
        emissiveIntensity: 0.7,
        roughness: 0.6,
      }),
    );
    const subGeo = track(new THREE.BoxGeometry(3.8, 2.4, 2.8));
    const substation = new THREE.Mesh(subGeo, subMat);
    substation.position.set(54, 1.2, -24.5);
    powerGroup.add(substation);
    const subEdges = track(new THREE.EdgesGeometry(subGeo, 24));
    substation.add(new THREE.LineSegments(subEdges, edgeMat));

    // ── L4 YOLO — 25R tracked objects on the roads (14 CRITICAL) ────────────
    const yoloGroup = new THREE.Group();
    scene.add(yoloGroup);

    interface Mover {
      body: THREE.Mesh;
      wire: THREE.LineSegments;
      wireMat: THREE.LineBasicMaterial;
      alert: boolean;
      axis: "x" | "z";
      road: number;
      lane: number;
      dir: 1 | -1;
      speed: number;
      base: number;
    }
    const movers: Mover[] = [];
    const yoloRnd = mulberry32(25);
    const bodyGeo = track(new THREE.BoxGeometry(2.1, 0.95, 1.05));
    const bodyGeoV = track(new THREE.BoxGeometry(1.05, 0.95, 2.1));
    const wireGeoH = track(
      new THREE.EdgesGeometry(track(new THREE.BoxGeometry(3.0, 1.8, 1.8)), 24),
    );
    const bodyMatNormal = track(
      new THREE.MeshStandardMaterial({ color: 0x242e1c, roughness: 0.7 }),
    );
    const bodyMatAlert = track(new THREE.MeshStandardMaterial({ color: 0x301c18, roughness: 0.7 }));
    for (let i = 0; i < 25; i++) {
      const alert = i < 14; // 14 CRITICAL · 11 nominal — matches SYS.03 ALERTS readout
      const axis: "x" | "z" = i % 2 === 0 ? "x" : "z";
      const road = ROADS[i % ROADS.length];
      const dir: 1 | -1 = yoloRnd() > 0.5 ? 1 : -1;
      const lane = dir * 1.35;
      const speed = 6 + yoloRnd() * 8;
      const base = yoloRnd() * 116 - 58;
      const body = new THREE.Mesh(
        axis === "x" ? bodyGeo : bodyGeoV,
        alert ? bodyMatAlert : bodyMatNormal,
      );
      const wireMat = track(
        new THREE.LineBasicMaterial({
          color: alert ? CRIMSON : AMBER,
          transparent: true,
          opacity: alert ? 0.95 : 0.7,
        }),
      );
      const wire = new THREE.LineSegments(wireGeoH, wireMat);
      yoloGroup.add(body, wire);
      movers.push({ body, wire, wireMat, alert, axis, road, lane, dir, speed, base });
    }

    // ── L5 THREAT — critical-alert heatmap patches ───────────────────────────
    const threatGroup = new THREE.Group();
    scene.add(threatGroup);
    const heatTex = track(makeHeatTexture());
    const HOTSPOTS: Array<[number, number, number]> = [
      [20, 20, 9],
      [-22, -2, 8],
      [2, -20, 7.5],
      [40, 2, 8],
      [-40, 22, 7],
    ];
    const heatPatches: THREE.Mesh[] = [];
    for (const [hx, hz, hr] of HOTSPOTS) {
      const geo = track(new THREE.CircleGeometry(hr, 40));
      const mat = track(
        new THREE.MeshBasicMaterial({
          map: heatTex,
          transparent: true,
          opacity: 0.5,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      const patch = new THREE.Mesh(geo, mat);
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(hx, 0.07, hz);
      threatGroup.add(patch);
      heatPatches.push(patch);
    }

    // ── shared rider pulse geometry (L6/L7/L8) ──────────────────────────
    const pulseGeo = track(new THREE.SphereGeometry(0.22, 10, 8));

    // ── L6 CUSTODY — Poggi Q3 · signing chain + universal service rings ────
    // Chain of custody on the DN300 main, FIRST SIGNER lit ("show who signed
    // the first link" — the revolving-door answer). Six equal district rings
    // pulse IN PHASE: even-handed, not beachfront-first (universality).
    const custodyGroup = new THREE.Group();
    scene.add(custodyGroup);
    const chainLinks: THREE.Mesh[] = [];
    const linkGeo = track(new THREE.TorusGeometry(0.55, 0.16, 10, 22));
    for (let k = 0; k < 8; k++) {
      const first = k === 0;
      const link = new THREE.Mesh(
        linkGeo,
        track(
          new THREE.MeshStandardMaterial({
            color: first ? 0x1c260f : 0x101a0c,
            emissive: first ? LIME : SAGE_BRIGHT,
            emissiveIntensity: first ? 0.9 : 0.4,
            roughness: 0.5,
          }),
        ),
      );
      const p = pipeMain.curve.getPointAt(0.08 + (k / 7) * 0.84);
      // bobble + yaw from the position hash — co-located consumers agree.
      link.position.set(p.x, 1.9 + hashPos(Math.round(p.x), Math.round(p.z), k) * 0.5, p.z);
      link.rotation.y =
        Math.PI / 2 + (hashPos(Math.round(p.x), Math.round(p.z), 0x20 + k) - 0.5) * 0.8;
      if (first) link.scale.setScalar(1.5);
      custodyGroup.add(link);
      chainLinks.push(link);
    }
    const sigPulse = new THREE.Mesh(
      pulseGeo,
      track(new THREE.MeshBasicMaterial({ color: LIME, transparent: true, opacity: 0.95 })),
    );
    custodyGroup.add(sigPulse);
    const districtRings: THREE.Mesh[] = [];
    const districtGeo = track(new THREE.RingGeometry(15.6, 16.4, 56));
    for (const dx of DISTRICT_X) {
      for (const dz of DISTRICT_Z) {
        const r = new THREE.Mesh(
          districtGeo,
          track(
            new THREE.MeshBasicMaterial({
              color: SAGE_BRIGHT,
              transparent: true,
              opacity: 0.3,
              side: THREE.DoubleSide,
              depthWrite: false,
            }),
          ),
        );
        r.rotation.x = -Math.PI / 2;
        r.position.set(dx, 0.09, dz);
        custodyGroup.add(r);
        districtRings.push(r);
      }
    }

    // ── L7 PROVENANCE — Engineering Q3 · fab origin → node trace network ────
    // One fab origin west; copper traces route to EVERY node pod (component
    // provenance / supply-chain traceability), each ending in a pad + the
    // SAME standards ring — one world standard on every node.
    const provGroup = new THREE.Group();
    scene.add(provGroup);
    const fabMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x2b1a0a,
        emissive: AMBER,
        emissiveIntensity: 0.5,
        roughness: 0.6,
      }),
    );
    const fab = new THREE.Mesh(track(new THREE.CylinderGeometry(1.5, 1.5, 0.22, 6)), fabMat);
    fab.position.set(-56, 0.06, 0);
    provGroup.add(fab);
    const fabRing = new THREE.Mesh(
      track(new THREE.RingGeometry(2.0, 2.3, 32)),
      track(
        new THREE.MeshBasicMaterial({
          color: AMBER,
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      ),
    );
    fabRing.rotation.x = -Math.PI / 2;
    fabRing.position.set(-56, 0.08, 0);
    provGroup.add(fabRing);
    const traceMat = track(
      new THREE.LineBasicMaterial({ color: COPPER, transparent: true, opacity: 0.75 }),
    );
    const padGeo = track(new THREE.CircleGeometry(1.05, 24));
    const padMat = track(
      new THREE.MeshBasicMaterial({
        color: COPPER,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    );
    const stdGeo = track(new THREE.RingGeometry(1.35, 1.55, 28));
    const provPulses: THREE.Mesh[] = [];
    const provRoutes: THREE.Vector3[][] = [];
    for (const pod of pods) {
      const px = pod.group.position.x;
      const pz = pod.group.position.z;
      const midX = -56 + (px + 56) * 0.5;
      const y = 0.055;
      const pts = [
        new THREE.Vector3(-56, y, 0),
        new THREE.Vector3(midX, y, 0),
        new THREE.Vector3(midX, y, pz * 0.5),
        new THREE.Vector3(px, y, pz * 0.5),
        new THREE.Vector3(px, y, pz),
      ];
      provRoutes.push(pts);
      provGroup.add(new THREE.Line(track(new THREE.BufferGeometry().setFromPoints(pts)), traceMat));
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(px, 0.065, pz);
      provGroup.add(pad);
      const std = new THREE.Mesh(
        stdGeo,
        track(
          new THREE.MeshBasicMaterial({
            color: SILK,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
        ),
      );
      std.rotation.x = -Math.PI / 2;
      std.position.set(px, 0.075, pz);
      provGroup.add(std);
      const pulse = new THREE.Mesh(
        pulseGeo,
        track(new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9 })),
      );
      provGroup.add(pulse);
      provPulses.push(pulse);
    }

    // ── L8 SEQUENCE — Athu Zam Q3 · CAPITEC_R1B fraud corridor + gate ──────
    // CLAIM: send R20k to a new beneficiary. OBLIGATION: prove sequence
    // legitimacy. EVIDENCE: unknown call t-5m → abnormal balance t0 → new
    // beneficiary t+1m → R20k t+2m (gogo escalation R2k→R10k). DECISION:
    // BLOCK + step-up. The spine made visible: the path ends AT the gate.
    const seqGroup = new THREE.Group();
    scene.add(seqGroup);
    const SEQ_EVENTS: Array<{
      x: number;
      z: number;
      h: number;
      kind: "call" | "balance" | "beneficiary" | "transfer";
    }> = [
      { x: -34, z: -44, h: 1.1, kind: "call" },
      { x: -11, z: -47, h: 0.5, kind: "balance" },
      { x: 12, z: -47, h: 1.4, kind: "beneficiary" },
      { x: 34, z: -44, h: 1.9, kind: "transfer" },
    ];
    const markerGeos: Record<string, THREE.BufferGeometry> = {
      call: track(new THREE.TetrahedronGeometry(0.85)),
      balance: track(new THREE.CylinderGeometry(0.8, 0.8, 0.16, 20)),
      beneficiary: track(new THREE.BoxGeometry(1.15, 1.15, 1.15)),
      transfer: track(new THREE.OctahedronGeometry(0.85)),
    };
    const seqPts: THREE.Vector3[] = [];
    for (const ev of SEQ_EVENTS) {
      const marker = new THREE.Mesh(
        markerGeos[ev.kind],
        track(
          new THREE.MeshStandardMaterial({
            color: 0x241014,
            emissive: CRIMSON,
            emissiveIntensity: 0.55,
            roughness: 0.55,
          }),
        ),
      );
      marker.position.set(ev.x, ev.h, ev.z);
      seqGroup.add(marker);
      seqPts.push(new THREE.Vector3(ev.x, ev.h, ev.z));
    }
    // the gate stands past the last marker — the path STOPS here (BLOCK)
    seqPts.push(new THREE.Vector3(50, 1.2, -40));
    const seqPath = new THREE.CatmullRomCurve3(seqPts);
    seqGroup.add(
      new THREE.Line(
        track(new THREE.BufferGeometry().setFromPoints(seqPath.getPoints(60))),
        track(new THREE.LineBasicMaterial({ color: CRIMSON, transparent: true, opacity: 0.6 })),
      ),
    );
    const gateMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x241014,
        emissive: AMBER,
        emissiveIntensity: 0.6,
        roughness: 0.5,
      }),
    );
    for (const gz of [-43.2, -36.8]) {
      const pylon = new THREE.Mesh(track(new THREE.BoxGeometry(0.7, 2.6, 0.7)), gateMat);
      pylon.position.set(50, 1.3, gz);
      seqGroup.add(pylon);
    }
    const beam = new THREE.Mesh(track(new THREE.BoxGeometry(0.55, 0.55, 7.0)), gateMat);
    beam.position.set(50, 2.75, -40);
    seqGroup.add(beam);
    const gateRing = new THREE.Mesh(
      track(new THREE.RingGeometry(1.6, 2.05, 36)),
      track(
        new THREE.MeshBasicMaterial({
          color: AMBER,
          transparent: true,
          opacity: 0.3,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      ),
    );
    gateRing.rotation.x = -Math.PI / 2;
    gateRing.position.set(50, 0.1, -40);
    seqGroup.add(gateRing);
    // gogo escalation bars — R2 000 → R4 000 → R8 000 → R10 000
    const gogoBars: THREE.Mesh[] = [];
    for (let b = 0; b < 4; b++) {
      const bar = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.6, 0.5 + b * 0.35, 0.6)),
        track(
          new THREE.MeshStandardMaterial({
            color: 0x241014,
            emissive: CRIMSON,
            emissiveIntensity: 0.4,
            roughness: 0.6,
          }),
        ),
      );
      bar.position.set(30.5 + b * 1.4, (0.5 + b * 0.35) / 2, -43.5);
      seqGroup.add(bar);
      gogoBars.push(bar);
    }
    const attackMat = track(
      new THREE.MeshBasicMaterial({ color: CRIMSON, transparent: true, opacity: 0.95 }),
    );
    const seqPulse = new THREE.Mesh(pulseGeo, attackMat);
    seqGroup.add(seqPulse);

    // ── L9 RECEIPT — tamper-evident append-only rail (south edge) ──────────
    // Every appended event seals the previous link. HEAD pulses; link #9
    // stays REJECTED — the break stays visible (tamper-evidence).
    const receiptGroup = new THREE.Group();
    scene.add(receiptGroup);
    const receiptLinks: THREE.Mesh[] = [];
    const REJECTED_INDEX = 9;
    for (let k = 0; k < 14; k++) {
      const rejected = k === REJECTED_INDEX;
      const blk = new THREE.Mesh(
        track(new THREE.BoxGeometry(1.3, 0.7, 0.9)),
        track(
          new THREE.MeshStandardMaterial({
            color: rejected ? 0x2a0d0e : 0x14200e,
            emissive: rejected ? CRIMSON : k === 13 ? LIME : SAGE,
            emissiveIntensity: rejected ? 0.8 : k === 13 ? 0.9 : 0.35,
            roughness: 0.6,
          }),
        ),
      );
      const rx = -58 + k * (116 / 13);
      blk.position.set(rx + (hashPos(k, 44, 3) - 0.5) * 0.4, 0.5, 44);
      if (rejected) blk.rotation.z = 0.38; // the visible break
      receiptGroup.add(blk);
      receiptLinks.push(blk);
    }
    const connPts: number[] = [];
    for (let k = 0; k < 13; k++) {
      const a = receiptLinks[k].position;
      const b = receiptLinks[k + 1].position;
      connPts.push(a.x + 0.75, 0.5, a.z, b.x - 0.75, 0.5, b.z);
    }
    const connGeo = track(new THREE.BufferGeometry());
    connGeo.setAttribute("position", new THREE.Float32BufferAttribute(connPts, 3));
    receiptGroup.add(
      new THREE.LineSegments(
        connGeo,
        track(new THREE.LineBasicMaterial({ color: SAGE, transparent: true, opacity: 0.5 })),
      ),
    );

    // ── leak FX (FSM CLICK on a pipe) ───────────────────────────────────────
    const moistureTex = track(makeHeatTexture());
    const ring = new THREE.Mesh(
      track(new THREE.CircleGeometry(1, 40)),
      track(
        new THREE.MeshBasicMaterial({
          map: moistureTex,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      ),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    ring.visible = false;
    scene.add(ring);

    const dripGeo = track(new THREE.BufferGeometry());
    const dripPos = new Float32Array(DRIP_COUNT * 3);
    const dripVel = new Float32Array(DRIP_COUNT);
    dripGeo.setAttribute("position", new THREE.BufferAttribute(dripPos, 3));
    const dripMat = track(
      new THREE.PointsMaterial({
        color: CRIMSON,
        size: 0.28,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    const drips = new THREE.Points(dripGeo, dripMat);
    drips.visible = false;
    scene.add(drips);
    const leakPoint = new THREE.Vector3();
    let leakSpawnT = 0;

    const podByNode = (nodeId: string | null): PodEntry | null =>
      nodeId ? (pods.find((p) => p.nodeId === nodeId) ?? null) : null;

    const spawnLeakFx = (nodeId: string | null): void => {
      const pod = podByNode(nodeId);
      if (!pod) return;
      leakPoint.copy(pod.group.position);
      ring.position.set(leakPoint.x, 0.06, leakPoint.z);
      ring.scale.setScalar(0.1);
      ring.visible = true;
      drips.visible = true;
      dripMat.opacity = 0.9;
      leakSpawnT = performance.now();
      for (let i = 0; i < DRIP_COUNT; i++) {
        const i3 = i * 3;
        dripPos[i3] = leakPoint.x + (Math.random() - 0.5) * 0.5;
        dripPos[i3 + 1] = 1.4;
        dripPos[i3 + 2] = leakPoint.z + (Math.random() - 0.5) * 0.5;
        dripVel[i] = 2.5 + Math.random() * 3;
      }
      dripGeo.attributes.position.needsUpdate = true;
    };

    const clearLeakFx = (): void => {
      ring.visible = false;
      drips.visible = false;
      dripMat.opacity = 0;
    };

    // ── pointer picking (node pods first, then pipes → FSM CLICK) ──────────
    const raycaster = new THREE.Raycaster();
    const ndcV = new THREE.Vector2();
    let pendingPick: { x: number; y: number } | null = null;
    let hoveredId: string | null = null;

    const toNdc = (x: number, y: number): boolean => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      ndcV.x = ((x - rect.left) / rect.width) * 2 - 1;
      ndcV.y = -((y - rect.top) / rect.height) * 2 + 1;
      return true;
    };

    const pickPodAt = (x: number, y: number): string | null => {
      if (!toNdc(x, y)) return null;
      raycaster.setFromCamera(ndcV, camera);
      const hits = raycaster.intersectObjects(nodeMeshes, false);
      return hits.length > 0 ? (hits[0].object.userData.nodeId as string) : null;
    };

    const pickPipeAt = (x: number, y: number): boolean => {
      if (!toNdc(x, y)) return false;
      raycaster.setFromCamera(ndcV, camera);
      const hits = raycaster.intersectObjects(pipeMeshes, false);
      return hits.length > 0;
    };

    const onPointerDown = (e: PointerEvent): void => {
      const nodeId = pickPodAt(e.clientX, e.clientY);
      if (nodeId) {
        onNodeSelectRef.current?.(nodeId);
        return;
      }
      if (pickPipeAt(e.clientX, e.clientY)) {
        useVvuSocketStore.getState().sendFsmCommand("CLICK");
        onNodeSelectRef.current?.(null);
        return;
      }
      onNodeSelectRef.current?.(null);
    };
    const onPointerMove = (e: PointerEvent): void => {
      pendingPick = { x: e.clientX, y: e.clientY };
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);

    // ── resize ──────────────────────────────────────────────────────────────
    const resize = (): void => {
      const r = mount.getBoundingClientRect();
      const w = Math.max(1, r.width);
      const h = Math.max(1, r.height);
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const portrait = camera.aspect < 0.9;
      const lw = portrait ? 2.2 : 3.0;
      const lh = portrait ? 0.55 : 0.75;
      labels.forEach((l) => l.sprite.scale.set(lw, lh, 1));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    // ── camera framing + intro ─────────────────────────────────────────────
    const camFrom = new THREE.Vector3(115, 78, 115);
    const camTo = new THREE.Vector3(64, 45, 64);
    let lookAtY = 1.5;
    if (camera.aspect < 1) {
      // portrait: solve the distance from the narrow horizontal fov so the
      // city core (bench + pods) fills the width instead of a tiny black dot
      const halfFovY = THREE.MathUtils.degToRad(camera.fov) / 2;
      const halfFovX = Math.atan(Math.tan(halfFovY) * camera.aspect);
      const span = 74; // core span + label breathing room (m)
      const dist = Math.max(55, span / (2 * Math.tan(halfFovX)));
      camTo.setLength(dist);
      camFrom.setLength(dist * 1.7);
      lookAtY = 1.2;
    }
    camera.position.copy(camFrom);
    camera.lookAt(0, lookAtY, 0);
    const introT0 = performance.now();

    // ── RAF loop ────────────────────────────────────────────────────────────
    const crimsonT = new THREE.Color(CRIMSON);
    const pipeBaseEmissive = pipes.map((p) => new THREE.Color(p.emissive));
    const edgeBase = new THREE.Color(PALE);
    const fogNearNorm = 120;
    const fogFarNorm = 340;

    let raf = 0;
    let lastT = performance.now();
    let lastLabel = 0;
    let prevLeakKey = "none";
    let statFrames = 0;
    let statLast = performance.now();

    const tmpV = new THREE.Vector3();

    const tick = (): void => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      if (document.hidden) return;
      const t = now / 1000;

      const state = useVvuSocketStore.getState();
      const frame = state.frame;
      const leak = frame?.leak ?? { active: false, nodeId: null, intensity: 0 };
      const fail = frame?.fsmState === "FAIL_CLOSED";

      // layer visibility (store-backed, survives route switches)
      const layers = state.gisLayers;
      infraGroup.visible = layers.has("L1");
      flowGroup.visible = layers.has("L2");
      powerGroup.visible = layers.has("L3");
      yoloGroup.visible = layers.has("L4");
      threatGroup.visible = layers.has("L5");

      // Round 30 substrate layers (component-local; keys 6/7/8/9)
      const sub = substrateRef.current;
      custodyGroup.visible = sub.L6;
      provGroup.visible = sub.L7;
      seqGroup.visible = sub.L8;
      receiptGroup.visible = sub.L9;

      // camera intro (1.4 s cubic ease-out)
      const it = (now - introT0) / 1400;
      if (it < 1) {
        camera.position.lerpVectors(camFrom, camTo, easeOutCubic(it));
        camera.lookAt(0, lookAtY, 0);
      } else if (!controls.enabled) {
        controls.enabled = true;
      }
      if (controls.enabled) controls.update();

      // GEO_GRID MAP_SYNC pulse (anchor rings breathe)
      const ap = 0.5 + 0.5 * Math.sin(t * 2.2);
      ring1.scale.setScalar(1 + 0.06 * Math.sin(t * 2.2));
      (ring1.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.3 * ap;
      ring2.scale.setScalar(1 + 0.1 * Math.sin(t * 2.2 + 1.2));

      // node beacons pulse (lime when live, dim when EDGE cold)
      const live = frame !== null;
      for (const pod of pods) {
        pod.beaconMat.emissiveIntensity = live
          ? 0.6 + 1.0 * Math.sin(t * 2.6 + pod.group.position.x)
          : 0.15;
      }

      // L2 flow dashes ride the mains
      if (flowGroup.visible) {
        for (const d of flowDashes) {
          const u = (d.t0 + t * d.speed) % 1;
          d.pipe.curve.getPointAt(u, tmpV);
          d.mesh.position.copy(tmpV);
          d.pipe.curve.getTangentAt(u, tmpV);
          d.mesh.rotation.y = Math.atan2(tmpV.x, tmpV.z);
        }
      }

      // substation pulse
      subMat.emissiveIntensity = 0.45 + 0.5 * Math.sin(t * 1.8);

      // L4 YOLO movers on the road grid
      if (yoloGroup.visible) {
        for (const m of movers) {
          const s = (m.base + m.speed * m.dir * t) % 116;
          const along = s < 0 ? s + 116 : s;
          const coord = along - 58;
          if (m.axis === "x") {
            m.body.position.set(coord, 0.55, m.road + m.lane);
          } else {
            m.body.position.set(m.road + m.lane, 0.55, coord);
          }
          m.wire.position.copy(m.body.position);
          if (m.alert) {
            m.wireMat.opacity = 0.55 + 0.45 * Math.sin(t * 6 + m.base);
          }
        }
      }

      // L5 threat patches breathe; the first 3 TRAIL the first 3 CRITICAL
      // movers (Round 13 — L4↔L5 tie-in: the heatmap concentrates where the
      // critical detections actually are). When L4 is hidden the trailing
      // patches simply hold their last position and keep breathing.
      if (threatGroup.visible) {
        for (let i = 0; i < heatPatches.length; i++) {
          const patch = heatPatches[i];
          if (i < TRAIL_PATCH_COUNT && yoloGroup.visible) {
            const m = movers[i];
            patch.position.x += (m.body.position.x - patch.position.x) * Math.min(1, dt * 1.4);
            patch.position.z += (m.body.position.z - patch.position.z) * Math.min(1, dt * 1.4);
          }
          patch.scale.setScalar(1 + 0.07 * Math.sin(t * 1.4 + i * 1.7));
          (patch.material as THREE.MeshBasicMaterial).opacity = 0.38 + 0.18 * Math.sin(t * 1.1 + i);
        }
      }

      // L6 CUSTODY — signature pulse rides the chain; rings breathe IN PHASE
      if (custodyGroup.visible) {
        for (let k = 0; k < chainLinks.length; k++) {
          const m = chainLinks[k].material as THREE.MeshStandardMaterial;
          m.emissiveIntensity =
            (k === 0 ? 0.9 : 0.4) + 0.35 * Math.max(0, Math.sin(t * 2.0 - k * 0.55));
        }
        const sp = pipeMain.curve.getPointAt(0.08 + ((t * 0.11) % 1) * 0.84);
        sigPulse.position.set(sp.x, 1.9, sp.z);
        const inPhase = 0.5 + 0.5 * Math.sin(t * 1.6); // one value, all rings
        for (const r of districtRings) {
          (r.material as THREE.MeshBasicMaterial).opacity = 0.2 + 0.17 * inPhase;
        }
      }

      // L7 PROVENANCE — fab breathes; pulses ride the copper traces
      if (provGroup.visible) {
        fabMat.emissiveIntensity = 0.4 + 0.25 * Math.sin(t * 1.9);
        for (let k = 0; k < provPulses.length; k++) {
          const pts = provRoutes[k];
          const segF = ((t * 0.14 + k * 0.13) % 1) * (pts.length - 1);
          const si = Math.min(pts.length - 2, Math.floor(segF));
          provPulses[k].position.lerpVectors(pts[si], pts[si + 1], segF - si);
        }
      }

      // L8 SEQUENCE — attack pulse rides + STOPS at the gate (BLOCK + step-up)
      if (seqGroup.visible) {
        const ride = Math.min((t * 0.075) % 1, 0.92);
        seqPulse.position.copy(seqPath.getPointAt(ride));
        const arrived = ride >= 0.9;
        attackMat.color.setHex(arrived ? AMBER : CRIMSON);
        (gateRing.material as THREE.MeshBasicMaterial).opacity = arrived
          ? 0.5 + 0.35 * Math.sin(t * 7)
          : 0.22;
        for (let b = 0; b < gogoBars.length; b++) {
          (gogoBars[b].material as THREE.MeshStandardMaterial).emissiveIntensity =
            0.3 + 0.5 * Math.max(0, Math.sin(t * 2.4 - b * 0.4));
        }
      }

      // L9 RECEIPT — chain-head pulse; the rejected link keeps its break
      if (receiptGroup.visible) {
        (receiptLinks[13].material as THREE.MeshStandardMaterial).emissiveIntensity =
          0.65 + 0.45 * Math.sin(t * 2.2);
        for (let k = 0; k < 13; k++) {
          if (k === REJECTED_INDEX) continue;
          (receiptLinks[k].material as THREE.MeshStandardMaterial).emissiveIntensity =
            0.3 + 0.25 * Math.max(0, Math.sin(t * 1.8 - k * 0.35));
        }
      }

      // hover raycast (throttled to once per frame)
      if (pendingPick) {
        hoveredId = pickPodAt(pendingPick.x, pendingPick.y);
        if (!hoveredId) hoveredId = pickPipeAt(pendingPick.x, pendingPick.y) ? "pipe" : null;
        pendingPick = null;
        renderer.domElement.style.cursor = hoveredId ? "pointer" : "grab";
      }

      // leak transitions (single source of truth: frame.leak)
      const leakKey = leak.active ? `on:${leak.nodeId}` : "off";
      if (leakKey !== prevLeakKey) {
        prevLeakKey = leakKey;
        for (const pipe of pipes) {
          pipe.mat.emissive.copy(pipeBaseEmissive[pipes.indexOf(pipe)]);
          pipe.mat.emissiveIntensity = pipe === pipeMain ? 0.75 : 0.5;
        }
        for (const pod of pods) {
          pod.mat.color.copy(pod.baseColor);
          pod.mat.emissive.setHex(0x000000);
        }
        if (leak.active) {
          spawnLeakFx(leak.nodeId);
          // crimson the pipe that carries the leaking node
          const pipe = pipes.find((p) => leak.nodeId && p.nodes.includes(leak.nodeId));
          if (pipe) {
            pipe.mat.emissive.copy(crimsonT);
            pipe.mat.emissiveIntensity = 1.2;
          }
          const pod = podByNode(leak.nodeId);
          if (pod) {
            pod.mat.color.copy(crimsonT);
            pod.mat.emissive.copy(crimsonT);
          }
        } else {
          clearLeakFx();
        }
      }

      // leak pulse + drip particles
      if (ring.visible) {
        const age = (now - leakSpawnT) / 1000;
        const grow = easeOutCubic(Math.min(1, age / 2.5));
        ring.scale.setScalar(Math.max(0.1, grow) * 7.5);
        (ring.material as THREE.MeshBasicMaterial).opacity =
          0.45 + 0.3 * Math.min(1, (leak.intensity ?? 0) * 1.5);
        const leakPipe = pipes.find((p) => leak.nodeId && p.nodes.includes(leak.nodeId));
        if (leakPipe) {
          leakPipe.mat.emissiveIntensity = 0.8 + 0.7 * Math.sin(t * 5);
        }
        if (podByNode(leak.nodeId)) {
          const pod = podByNode(leak.nodeId)!;
          pod.mat.emissiveIntensity = 0.5 + 0.5 * Math.sin(t * 5);
        }
      }
      if (drips.visible) {
        for (let i = 0; i < DRIP_COUNT; i++) {
          const i3 = i * 3;
          dripPos[i3 + 1] -= dripVel[i] * dt;
          if (dripPos[i3 + 1] < 0.05) {
            dripPos[i3 + 1] = 1.4;
            dripPos[i3] = leakPoint.x + (Math.random() - 0.5) * 0.5;
            dripPos[i3 + 2] = leakPoint.z + (Math.random() - 0.5) * 0.5;
          }
        }
        dripGeo.attributes.position.needsUpdate = true;
      }

      // FAIL_CLOSED: fog collapses + dimmed key light + crimson edge flash
      const fog = scene.fog as THREE.Fog;
      fog.near += ((fail ? 55 : fogNearNorm) - fog.near) * Math.min(1, dt * 2);
      fog.far += ((fail ? 170 : fogFarNorm) - fog.far) * Math.min(1, dt * 2);
      dirLight.intensity += ((fail ? 0.4 : 1.4) - dirLight.intensity) * Math.min(1, dt * 2);
      if (fail) {
        edgeMat.color.copy(edgeBase).lerp(crimsonT, 0.5 + 0.5 * Math.sin(t * 3.2));
      } else {
        edgeMat.color.lerp(edgeBase, Math.min(1, dt * 3));
      }

      // labels: refresh at most every 800 ms
      if (now - lastLabel > 800) {
        lastLabel = now;
        for (const l of labels) {
          const text = l.val(frame);
          if (text !== l.lastText) {
            l.lastText = text;
            drawLabel(l.ctx, l.title, text);
            l.texture.needsUpdate = true;
          }
        }
      }

      renderer.render(scene, camera);

      // stats (fps rolling window + draw calls), throttled ~500 ms
      statFrames++;
      if (now - statLast >= 500) {
        const fps = (statFrames * 1000) / (now - statLast);
        onStatsRef.current?.({ fps, drawCalls: renderer.info.render.calls });
        statFrames = 0;
        statLast = now;
      }
    };
    raf = requestAnimationFrame(tick);

    // ── cleanup ─────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(raf);
      if (resumeTimer) clearTimeout(resumeTimer);
      ro.disconnect();
      controls.removeEventListener("start", onControlsStart);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      controls.dispose();
      for (const d of disposables) d.dispose();
      renderer.domElement.remove();
    };
  }, []);

  if (webglFailed) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-[#060806]">
        <div className="vvu-label text-[9px] text-[#e5484d] vvu-blink">
          WEBGL UNAVAILABLE · SWITCH TO MAP MODE
        </div>
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 vvu-canvas-wrap bg-[#060806]"
      aria-label="City digital twin GIS bench — pipelines with embedded telemetry nodes N01 to N06"
      role="application"
    />
  );
}

export default CityGisBench;
