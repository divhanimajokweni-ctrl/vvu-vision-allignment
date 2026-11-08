"use client";

// src/components/spatial/ThreeScene.tsx — WebGL georeferenced scene of the
// Gqeberha edge-node rig: deterministic value-noise terrain, neon-wireframe
// rig built from PHYSICAL_NODES (ENU mm → m, Y-up), rotating radar sweep,
// raycastable pipe runs, leak soil-moisture ring + drip particles, live
// canvas-sprite labels, orbit controls with idle auto-rotate and a cinematic
// camera intro. All state read imperatively from the zustand socket store
// (single source of truth) inside one RAF loop — zero re-render coupling.

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PHYSICAL_NODES, type PhysicalNodeDef } from "@/lib/vvu-data";
import { useVvuSocketStore } from "@/hooks/use-vvu-socket";
import type { TelemetryFrame } from "@/types/vvu";

interface ThreeSceneProps {
  onStats?: (stats: { fps: number; drawCalls: number }) => void;
  /** Node inspector: emitted when the operator taps a rig node (null = dismiss). */
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

const C_HDPE = 0x3fae6e;
const C_PVCO = 0x3aa0c8;
const C_DUCTILE = 0x9aa3ad;

const DRIP_COUNT = 80;

/** ENU mm → three.js metres (Y-up: x→X, z→Y(up), y→−Z so +y is north). */
const enu = (def: { xMm: number; yMm: number; zMm: number }): THREE.Vector3 =>
  new THREE.Vector3(def.xMm / 1000, def.zMm / 1000, -def.yMm / 1000);

const nodeDef = (id: string): PhysicalNodeDef => {
  const d = PHYSICAL_NODES.find((n) => n.nodeId === id);
  if (!d) throw new Error(`VVU: unknown node ${id}`);
  return d;
};

// ── deterministic noise ──────────────────────────────────────────────────────

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

function makeValueNoise(seed: number): (x: number, z: number) => number {
  const G = 64;
  const rnd = mulberry32(seed);
  const vals = new Float32Array(G * G);
  for (let i = 0; i < G * G; i++) vals[i] = rnd();
  const at = (ix: number, iz: number) => vals[(((iz % G) + G) % G) * G + (((ix % G) + G) % G)];
  const fade = (t: number) => t * t * (3 - 2 * t);
  return (x: number, z: number) => {
    const s = 9; // metres per cell
    const fx = x / s;
    const fz = z / s;
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    const tx = fade(fx - ix);
    const tz = fade(fz - iz);
    const a = at(ix, iz);
    const b = at(ix + 1, iz);
    const c = at(ix, iz + 1);
    const d = at(ix + 1, iz + 1);
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  };
}

const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

// ── canvas texture helpers ───────────────────────────────────────────────────

function makeRadialTealTexture(): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = 256;
  cv.height = 256;
  const c = cv.getContext("2d");
  if (c) {
    const g = c.createRadialGradient(128, 128, 8, 128, 128, 126);
    g.addColorStop(0, "rgba(46,168,160,0.55)");
    g.addColorStop(0.35, "rgba(46,168,160,0.28)");
    g.addColorStop(0.7, "rgba(46,168,160,0.1)");
    g.addColorStop(1, "rgba(46,168,160,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

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

// ── component ────────────────────────────────────────────────────────────────

interface Tintable {
  nodeId: string;
  mat: THREE.MeshStandardMaterial;
  base: THREE.Color;
  target: THREE.Color;
  pulsing: boolean;
  hovered: boolean;
}

interface LabelEntry {
  sprite: THREE.Sprite;
  texture: THREE.CanvasTexture;
  ctx: CanvasRenderingContext2D;
  title: string;
  val: (f: TelemetryFrame | null) => string;
  lastText: string;
}

export function ThreeScene({ onStats, onNodeSelect }: ThreeSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const onStatsRef = useRef(onStats);
  const onNodeSelectRef = useRef(onNodeSelect);
  const [webglFailed, setWebglFailed] = useState(false);

  useEffect(() => {
    onStatsRef.current = onStats;
  }, [onStats]);

  useEffect(() => {
    onNodeSelectRef.current = onNodeSelect;
  }, [onNodeSelect]);

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
    scene.fog = new THREE.Fog(BG, 40, 170);
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 3;
    controls.maxDistance = 60;
    controls.maxPolarAngle = 1.45;
    controls.target.set(0, 1, 0);
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.4;
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
    const ambient = new THREE.AmbientLight(0x8a9a78, 0.55);
    const hemi = new THREE.HemisphereLight(0x9ab38a, 0x0a0f0a, 0.6);
    const dirLight = new THREE.DirectionalLight(0xe8f0d8, 1.6);
    dirLight.position.set(12, 18, 8);
    const beaconLight = new THREE.PointLight(LIME, 2.5, 6, 2);
    beaconLight.position.set(0.1, 1.5, 0);
    scene.add(ambient, hemi, dirLight, beaconLight);

    // ── terrain ─────────────────────────────────────────────────────────────
    const noiseA = makeValueNoise(7);
    const noiseB = makeValueNoise(99);
    const heightAt = (x: number, z: number): number => {
      const v = noiseA(x, z) * 0.7 + noiseB(x * 3.1 + 31, z * 3.1 - 17) * 0.3;
      let h = (v - 0.42) * 4.4; // ≈ −1.8 … +2.6 m
      const r = Math.hypot(x, z);
      h *= smoothstep(6, 20, r); // flat pad under the rig
      h += smoothstep(55, 118, r) * 2.4; // gentle distant rise
      return h;
    };

    const terrainGeo = track(new THREE.PlaneGeometry(240, 240, 120, 120));
    terrainGeo.rotateX(-Math.PI / 2);
    const tPos = terrainGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < tPos.count; i++) {
      tPos.setY(i, heightAt(tPos.getX(i), tPos.getZ(i)));
    }
    tPos.needsUpdate = true;
    terrainGeo.computeVertexNormals();

    const terrain = new THREE.Mesh(
      terrainGeo,
      track(new THREE.MeshStandardMaterial({ color: 0x0a0f0a, roughness: 0.95, metalness: 0.02 })),
    );
    scene.add(terrain);

    // wireframe overlay (same geometry, pulled toward camera)
    const wire = new THREE.Mesh(
      terrainGeo,
      track(
        new THREE.MeshBasicMaterial({
          color: SAGE,
          wireframe: true,
          transparent: true,
          opacity: 0.08,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        }),
      ),
    );
    scene.add(wire);

    const grid = new THREE.GridHelper(240, 24, 0x233518, 0x0f180c);
    grid.position.y = 0.045;
    (grid.material as THREE.LineBasicMaterial).transparent = true;
    (grid.material as THREE.LineBasicMaterial).opacity = 0.55;
    track(grid.geometry);
    track(grid.material);
    scene.add(grid);

    // geofence ring (25 m, Sentinel-2)
    const fencePts = new THREE.EllipseCurve(0, 0, 25, 25)
      .getPoints(72)
      .map((p) => new THREE.Vector3(p.x, 0, p.y));
    const fence = new THREE.LineLoop(
      track(new THREE.BufferGeometry().setFromPoints(fencePts)),
      track(new THREE.LineBasicMaterial({ color: SAGE, transparent: true, opacity: 0.35 })),
    );
    fence.position.y = 0.04;
    scene.add(fence);

    // ── radar sweep ─────────────────────────────────────────────────────────
    const radarPivot = new THREE.Group();
    const WEDGE = Math.PI * 0.2;
    const wedge = new THREE.Mesh(
      track(new THREE.RingGeometry(0.4, 20, 36, 1, 0, WEDGE)),
      track(
        new THREE.MeshBasicMaterial({
          color: SAGE_BRIGHT,
          transparent: true,
          opacity: 0.08,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      ),
    );
    wedge.rotation.x = -Math.PI / 2;
    wedge.position.y = 0.07;
    radarPivot.add(wedge);
    const edgePts = [
      new THREE.Vector3(0.5 * Math.cos(WEDGE), 0.5 * Math.sin(WEDGE), 0),
      new THREE.Vector3(20 * Math.cos(WEDGE), 20 * Math.sin(WEDGE), 0),
    ];
    const sweepEdge = new THREE.Line(
      track(new THREE.BufferGeometry().setFromPoints(edgePts)),
      track(new THREE.LineBasicMaterial({ color: SAGE_BRIGHT, transparent: true, opacity: 0.5 })),
    );
    sweepEdge.rotation.x = -Math.PI / 2;
    sweepEdge.position.y = 0.075;
    radarPivot.add(sweepEdge);
    scene.add(radarPivot);

    // ── rig materials & helpers ────────────────────────────────────────────
    const allTints: Tintable[] = [];
    const tintByNode: Record<string, Tintable[]> = {};
    const pipeMeshes: THREE.Mesh[] = [];

    const edgeMat = track(
      new THREE.LineBasicMaterial({ color: SAGE_BRIGHT, transparent: true, opacity: 0.7 }),
    );

    function addEdges(mesh: THREE.Mesh): void {
      const eg = track(new THREE.EdgesGeometry(mesh.geometry, 24));
      mesh.add(new THREE.LineSegments(eg, edgeMat));
    }

    function stdMat(nodeId: string, color: number): THREE.MeshStandardMaterial {
      const mat = track(
        new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.32 }),
      );
      const tint: Tintable = {
        nodeId,
        mat,
        base: new THREE.Color(color),
        target: new THREE.Color(color),
        pulsing: false,
        hovered: false,
      };
      allTints.push(tint);
      (tintByNode[nodeId] ??= []).push(tint);
      return mat;
    }

    function part(
      nodeId: string,
      geom: THREE.BufferGeometry,
      mat: THREE.MeshStandardMaterial,
      pos: THREE.Vector3,
      rot?: THREE.Euler,
      raycast = false,
    ): THREE.Mesh {
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.copy(pos);
      if (rot) mesh.rotation.copy(rot);
      addEdges(mesh);
      mesh.userData.nodeId = nodeId;
      scene.add(mesh);
      if (raycast) pipeMeshes.push(mesh);
      return mesh;
    }

    function pipeBetween(
      nodeId: string,
      a: THREE.Vector3,
      b: THREE.Vector3,
      radius: number,
      mat: THREE.MeshStandardMaterial,
      raycast = true,
    ): THREE.Mesh {
      const dir = b.clone().sub(a);
      const len = dir.length();
      const geom = track(new THREE.CylinderGeometry(radius, radius, len, 18));
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.copy(a).add(b).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      addEdges(mesh);
      mesh.userData.nodeId = nodeId;
      scene.add(mesh);
      if (raycast) pipeMeshes.push(mesh);
      return mesh;
    }

    function flange(
      nodeId: string,
      center: THREE.Vector3,
      axis: THREE.Vector3,
      R: number,
      tube: number,
      mat: THREE.MeshStandardMaterial,
    ): THREE.Mesh {
      const mesh = new THREE.Mesh(track(new THREE.TorusGeometry(R, tube, 10, 24)), mat);
      mesh.position.copy(center);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis.clone().normalize());
      mesh.userData.nodeId = nodeId;
      scene.add(mesh);
      mesh.userData.nodeId = nodeId;
      pipeMeshes.push(mesh);
      return mesh;
    }

    // ── node positions ──────────────────────────────────────────────────────
    const n02v = enu(nodeDef("N02"));
    const n03v = enu(nodeDef("N03"));
    const n04v = enu(nodeDef("N04"));
    const n12v = enu(nodeDef("N12"));

    // N01 — telemetry mast
    const mastMat = stdMat("N01", 0x2a3226);
    part(
      "N01",
      track(new THREE.CylinderGeometry(0.045, 0.05, 1.29, 12)),
      mastMat,
      new THREE.Vector3(0, 0.645, 0),
    );
    const barSpecs: Array<[number, "x" | "z"]> = [
      [1.02, "x"],
      [1.02, "z"],
      [1.18, "x"],
      [1.18, "z"],
    ];
    for (const [y, axis] of barSpecs) {
      const bar = new THREE.Mesh(track(new THREE.CylinderGeometry(0.014, 0.014, 0.52, 8)), mastMat);
      if (axis === "x") bar.rotation.z = Math.PI / 2;
      else bar.rotation.x = Math.PI / 2;
      bar.position.y = y;
      addEdges(bar);
      bar.userData.nodeId = "N01";
      scene.add(bar);
    }

    // N02 / N03 — meter pods (box + sensor lens + leg)
    for (const [id, sgn] of [
      ["N02", 1],
      ["N03", -1],
    ] as const) {
      const base = id === "N02" ? n02v : n03v;
      const mat = stdMat(id, 0x31302c);
      part(id, track(new THREE.BoxGeometry(0.26, 0.34, 0.26)), mat, base.clone().setY(0.93));
      const lens = new THREE.Mesh(track(new THREE.CylinderGeometry(0.05, 0.05, 0.07, 12)), mat);
      lens.rotation.z = Math.PI / 2;
      lens.position.set(base.x + sgn * 0.17, 0.93, base.z);
      addEdges(lens);
      lens.userData.nodeId = id;
      scene.add(lens);
      part(
        id,
        track(new THREE.CylinderGeometry(0.03, 0.03, 0.76, 10)),
        mat,
        new THREE.Vector3(base.x, 0.38, base.z),
      );
    }

    // N04 — DN300 ductile-iron main + structural pedestal + flanges
    const ductileMat = stdMat("N04", C_DUCTILE);
    pipeBetween("N04", n02v, n03v, 0.163, ductileMat);
    const mainDir = n03v.clone().sub(n02v).normalize();
    for (const t of [0.06, 0.5, 0.94]) {
      flange("N04", n02v.clone().lerp(n03v, t), mainDir, 0.21, 0.04, ductileMat);
    }
    part(
      "N04",
      track(new THREE.CylinderGeometry(0.12, 0.14, 0.93, 16)),
      ductileMat,
      new THREE.Vector3(0, 0.465, 0),
      undefined,
      true,
    );
    flange(
      "N04",
      new THREE.Vector3(0, 0.74, 0),
      new THREE.Vector3(0, 1, 0),
      0.19,
      0.03,
      ductileMat,
    );
    part(
      "N04",
      track(new THREE.CylinderGeometry(0.22, 0.24, 0.07, 16)),
      ductileMat,
      new THREE.Vector3(0, 0.035, 0),
    );

    // HDPE service lateral (inlet → N12 spool → N04), offset south
    const hdpeMat = stdMat("N02", C_HDPE);
    (tintByNode["N12"] ??= []).push(tintByNode["N02"][0]);
    const hdpeDir = n04v.clone().sub(n02v).normalize();
    const hdpePerp = new THREE.Vector3()
      .crossVectors(hdpeDir, new THREE.Vector3(0, 1, 0))
      .normalize();
    const off = hdpePerp.clone().multiplyScalar(0.14);
    pipeBetween("N02", n02v.clone().add(off), n04v.clone().add(off), 0.05, hdpeMat);

    // N12 — DN100 spool on the HDPE line
    const spoolMat = stdMat("N12", 0x8a929c);
    const spoolPos = n12v.clone().add(off);
    const spool = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.075, 0.075, 0.22, 14)),
      spoolMat,
    );
    spool.position.copy(spoolPos);
    spool.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), hdpeDir);
    addEdges(spool);
    scene.add(spool);
    spool.userData.nodeId = "N12";
    pipeMeshes.push(spool);
    for (const s of [-0.11, 0.11]) {
      const collarPos = spoolPos.clone().addScaledVector(hdpeDir, s);
      flange("N12", collarPos, hdpeDir, 0.088, 0.014, spoolMat);
    }

    // PVC-O outlet run (N04 → outlet pod), offset north
    const pvcoMat = stdMat("N03", C_PVCO);
    const pvcoDir = n03v.clone().sub(n04v).normalize();
    const pvcoPerp = new THREE.Vector3()
      .crossVectors(pvcoDir, new THREE.Vector3(0, 1, 0))
      .normalize();
    const off2 = pvcoPerp.clone().multiplyScalar(-0.14);
    pipeBetween("N03", n04v.clone().add(off2), n03v.clone().add(off2), 0.05, pvcoMat);

    // N05 — edge control cabinet
    const cabMat = stdMat("N05", 0x2c3626);
    part(
      "N05",
      track(new THREE.BoxGeometry(0.5, 0.8, 0.38)),
      cabMat,
      new THREE.Vector3(0, 0.4, -0.4),
    );
    const strip = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.4, 0.025, 0.012)),
      track(
        new THREE.MeshStandardMaterial({
          color: 0x1a2a12,
          emissive: LIME,
          emissiveIntensity: 0.55,
          roughness: 0.4,
        }),
      ),
    );
    strip.position.set(0, 0.62, -0.4 + 0.19 + 0.007);
    strip.userData.nodeId = "N05";
    scene.add(strip);

    // N06 — power backup (8-cell stripe edge lines)
    const batMat = stdMat("N06", 0x33372e);
    part(
      "N06",
      track(new THREE.BoxGeometry(0.55, 0.42, 0.4)),
      batMat,
      new THREE.Vector3(0, 0.24, 0.4),
    );
    const cellPts: number[] = [];
    for (let i = 0; i < 8; i++) {
      const x = -0.21 + (i * 0.42) / 7;
      cellPts.push(x, 0.1, 0.4 - 0.202, x, 0.38, 0.4 - 0.202);
    }
    const cellsGeom = track(new THREE.BufferGeometry());
    cellsGeom.setAttribute("position", new THREE.Float32BufferAttribute(cellPts, 3));
    scene.add(
      new THREE.LineSegments(
        cellsGeom,
        track(new THREE.LineBasicMaterial({ color: SAGE_BRIGHT, transparent: true, opacity: 0.8 })),
      ),
    );

    // N07 / N08 — service racks
    for (const id of ["N07", "N08"] as const) {
      const v = enu(nodeDef(id));
      const mat = stdMat(id, 0x28302a);
      part(
        id,
        track(new THREE.BoxGeometry(0.55, 0.58, 0.16)),
        mat,
        new THREE.Vector3(v.x, 0.29, v.z),
      );
    }

    // N09 / N10 — datum skids
    for (const id of ["N09", "N10"] as const) {
      const v = enu(nodeDef(id));
      const mat = stdMat(id, 0x22281f);
      part(
        id,
        track(new THREE.BoxGeometry(0.85, 0.08, 0.4)),
        mat,
        new THREE.Vector3(v.x, 0.04, v.z),
      );
    }

    // N11 — top beacon (pulsing emissive sphere on a thin rod)
    const beaconMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x39442f,
        emissive: LIME,
        emissiveIntensity: 1,
        roughness: 0.4,
      }),
    );
    const rod = new THREE.Mesh(track(new THREE.CylinderGeometry(0.012, 0.012, 0.15, 8)), mastMat);
    rod.position.set(0.1, 1.365, 0);
    rod.userData.nodeId = "N11";
    scene.add(rod);
    const beacon = new THREE.Mesh(track(new THREE.SphereGeometry(0.055, 16, 12)), beaconMat);
    beacon.position.set(0.1, 1.465, 0);
    beacon.userData.nodeId = "N11";
    scene.add(beacon);
    const beaconGlow = new THREE.Mesh(
      track(new THREE.SphereGeometry(0.085, 16, 12)),
      track(
        new THREE.MeshBasicMaterial({
          color: LIME,
          transparent: true,
          opacity: 0.18,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      ),
    );
    beaconGlow.position.copy(beacon.position);
    scene.add(beaconGlow);

    // ── labels (canvas sprites, throttled 800 ms) ────────────────────────────
    const nd = (f: TelemetryFrame | null, id: string) => f?.nodes.find((n) => n.nodeId === id);
    const fmt = (v: number | undefined, suf: string) =>
      v === undefined ? `—— ${suf}` : `${v.toFixed(1)} ${suf}`;
    const labels: LabelEntry[] = [
      {
        title: "N01 MAST",
        val: (f: TelemetryFrame | null) => `UPLINK ${f ? (f.invariantOk ? "OK" : "CHECK") : "——"}`,
        pos: new THREE.Vector3(0, 1.82, 0),
      },
      {
        title: "N02 INLET",
        val: (f: TelemetryFrame | null) => fmt(nd(f, "N02")?.flowRate, "L/s"),
        pos: new THREE.Vector3(-0.75, 1.35, 0.16),
      },
      {
        title: "N03 OUTLET",
        val: (f: TelemetryFrame | null) => fmt(nd(f, "N03")?.flowRate, "L/s"),
        pos: new THREE.Vector3(0.75, 1.35, -0.16),
      },
      {
        title: "N04 DN300",
        val: (f: TelemetryFrame | null) => fmt(nd(f, "N04")?.pressureHead, "m"),
        pos: new THREE.Vector3(0, 1.48, -0.62),
      },
      {
        title: "N05 EDGE",
        val: (f: TelemetryFrame | null) => fmt(nd(f, "N05")?.apuTemperature, "°C"),
        pos: new THREE.Vector3(0, 0.98, -0.4),
      },
      {
        title: "N06 PWR",
        val: (f: TelemetryFrame | null) =>
          `BAT ${nd(f, "N06") ? nd(f, "N06")!.apuTemperature.toFixed(0) : "——"}°C`,
        pos: new THREE.Vector3(0, 0.68, 0.4),
      },
    ].map((spec) => {
      const { cv, ctx } = makeLabelCanvas();
      const texture = track(new THREE.CanvasTexture(cv));
      texture.colorSpace = THREE.SRGBColorSpace;
      const mat = track(
        new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }),
      );
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(1.6, 0.4, 1);
      sprite.position.copy(spec.pos);
      sprite.renderOrder = 10;
      scene.add(sprite);
      const entry: LabelEntry = {
        sprite,
        texture,
        ctx,
        title: spec.title,
        val: spec.val,
        lastText: "",
      };
      drawLabel(ctx, spec.title, "——");
      texture.needsUpdate = true;
      return entry;
    });

    // ── leak FX: soil-moisture ring + drip particles ────────────────────────
    const ringTex = track(makeRadialTealTexture());
    const ring = new THREE.Mesh(
      track(new THREE.RingGeometry(0.3, 20, 64)),
      track(
        new THREE.MeshBasicMaterial({
          map: ringTex,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
        }),
      ),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    ring.visible = false;
    ring.frustumCulled = false;
    scene.add(ring);

    const dripPos = new Float32Array(DRIP_COUNT * 3);
    const dripVel = new Float32Array(DRIP_COUNT);
    const dripGeo = track(new THREE.BufferGeometry());
    dripGeo.setAttribute("position", new THREE.BufferAttribute(dripPos, 3));
    const dripMat = track(
      new THREE.PointsMaterial({
        color: CRIMSON,
        size: 0.055,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
    );
    const drips = new THREE.Points(dripGeo, dripMat);
    drips.visible = false;
    drips.frustumCulled = false;
    scene.add(drips);

    const leakPoint = new THREE.Vector3(0, 0.85, 0);
    let leakSpawnT = 0;

    const spawnLeakFx = (nodeId: string | null): void => {
      const def = nodeId ? PHYSICAL_NODES.find((n) => n.nodeId === nodeId) : undefined;
      const p = def ? enu(def) : new THREE.Vector3(0, 0.85, 0);
      leakPoint.copy(p);
      ring.position.set(p.x, 0.05, p.z);
      ring.visible = true;
      drips.visible = true;
      leakSpawnT = performance.now();
      for (let i = 0; i < DRIP_COUNT; i++) {
        const i3 = i * 3;
        dripPos[i3] = p.x + (Math.random() - 0.5) * 0.16;
        dripPos[i3 + 1] = p.y - Math.random() * 0.5;
        dripPos[i3 + 2] = p.z + (Math.random() - 0.5) * 0.16;
        dripVel[i] = 0.4 + Math.random() * 0.8;
      }
      dripGeo.attributes.position.needsUpdate = true;
    };

    const clearLeakFx = (): void => {
      ring.visible = false;
      drips.visible = false;
    };

    // ── interaction (raycast) ───────────────────────────────────────────────
    // nodeMeshes: rig meshes tagged with userData.nodeId that are not pipes —
    // these feed the node inspector (pipes still drive the leak FSM via CLICK).
    const nodeMeshes: THREE.Mesh[] = [];
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.userData.nodeId && !pipeMeshes.includes(mesh)) {
        nodeMeshes.push(mesh);
      }
    });

    const raycaster = new THREE.Raycaster();
    const ndcV = new THREE.Vector2();
    let hoveredId: string | null = null;
    let pendingPick: { x: number; y: number } | null = null;

    const pickAt = (x: number, y: number): string | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      ndcV.x = ((x - rect.left) / rect.width) * 2 - 1;
      ndcV.y = -((y - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndcV, camera);
      const hits = raycaster.intersectObjects(pipeMeshes, false);
      return hits.length > 0 ? (hits[0].object.userData.nodeId as string) : null;
    };

    const pickNodeAt = (x: number, y: number): string | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      ndcV.x = ((x - rect.left) / rect.width) * 2 - 1;
      ndcV.y = -((y - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndcV, camera);
      const hits = raycaster.intersectObjects(nodeMeshes, false);
      return hits.length > 0 ? (hits[0].object.userData.nodeId as string) : null;
    };

    const onPointerDown = (e: PointerEvent): void => {
      // Node-first priority: rig parts are small targets and often sit behind
      // the long pipe runs — a tap that lands on a node opens the inspector.
      // Pipes span most of the view, so leak CLICK still has ample hit area.
      const nodeId = pickNodeAt(e.clientX, e.clientY);
      if (nodeId) {
        onNodeSelectRef.current?.(nodeId);
        return;
      }
      const pipeId = pickAt(e.clientX, e.clientY);
      if (pipeId) {
        // pipe tap -> leak simulation (existing behaviour); dismiss inspector
        useVvuSocketStore.getState().sendFsmCommand("CLICK");
        onNodeSelectRef.current?.(null);
        return;
      }
      // tapping empty terrain closes the inspector
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
      // portrait / narrow screens: shrink sprite labels so they don't crowd
      const portrait = camera.aspect < 0.9;
      const lw = portrait ? 1.18 : 1.6;
      const lh = portrait ? 0.3 : 0.4;
      labels.forEach((l) => l.sprite.scale.set(lw, lh, 1));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    // ── RAF loop ────────────────────────────────────────────────────────────
    const camFrom = new THREE.Vector3(24, 15, 24);
    const camTo = new THREE.Vector3(10, 6.5, 10);
    // Camera fit. Landscape (aspect ≥ 1) keeps the cinematic wide framing
    // (24 → 15 m fly-in, orbit target at rig mid-height). Portrait instead
    // SOLVES the camera distance from the narrow horizontal fov (fovY·aspect)
    // so the ~2.5 m rig span (nodes + sprite labels) fills most of the width:
    // the old uniform pull-back left the rig tiny at ~20 % width with dead
    // black space around it. The orbit target also drops slightly so the rig
    // centres in the band between the top HUD stack and the bottom gauges.
    let lookAtY = 1;
    if (camera.aspect < 1) {
      const halfFovY = THREE.MathUtils.degToRad(camera.fov) / 2;
      const halfFovX = Math.atan(Math.tan(halfFovY) * camera.aspect);
      const rigSpan = 2.9; // rig + label sprites + ground breathing room (m)
      const dist = Math.max(4.5, rigSpan / (2 * Math.tan(halfFovX)));
      camTo.setLength(dist);
      camFrom.setLength(dist * 2.2);
      lookAtY = 0.7;
      controls.target.set(0, lookAtY, 0);
    }
    camera.position.copy(camFrom);
    camera.lookAt(0, lookAtY, 0);
    const introT0 = performance.now();

    const edgeBase = new THREE.Color(SAGE_BRIGHT);
    const edgeHot = new THREE.Color(CRIMSON);
    const crimsonT = new THREE.Color(CRIMSON);
    const amberT = new THREE.Color(AMBER);
    const fogNearNorm = 40;
    const fogFarNorm = 170;

    let raf = 0;
    let lastT = performance.now();
    let lastLabel = 0;
    let prevLeakKey = "none";
    let statFrames = 0;
    let statLast = performance.now();

    const tick = (): void => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      if (document.hidden) return;
      const t = now / 1000;

      const frame = useVvuSocketStore.getState().frame;
      const leak = frame?.leak ?? { active: false, nodeId: null, intensity: 0 };
      const thermal = frame?.thermalThrottled ?? false;
      const fail = frame?.fsmState === "FAIL_CLOSED";

      // camera intro (1.2 s cubic ease-in)
      const it = (now - introT0) / 1200;
      if (it < 1) {
        camera.position.lerpVectors(camFrom, camTo, easeOutCubic(it));
        camera.lookAt(0, lookAtY, 0);
      } else if (!controls.enabled) {
        controls.enabled = true;
      }
      if (controls.enabled) controls.update();

      // radar rotation
      radarPivot.rotation.y += dt * 0.55;

      // beacon pulse
      const bp = 0.5 + 0.5 * Math.sin(t * 2.6);
      beacon.scale.setScalar(1 + 0.16 * Math.sin(t * 2.6));
      beaconMat.emissiveIntensity = 0.5 + 1.1 * bp;
      beaconLight.intensity = 1.2 + 2.2 * bp;
      (beaconGlow.material as THREE.MeshBasicMaterial).opacity = 0.1 + 0.16 * bp;
      beaconGlow.scale.setScalar(1 + 0.2 * Math.sin(t * 2.6));

      // hover raycast (throttled to once per frame)
      if (pendingPick) {
        hoveredId = pickAt(pendingPick.x, pendingPick.y);
        if (!hoveredId) hoveredId = pickNodeAt(pendingPick.x, pendingPick.y);
        pendingPick = null;
        renderer.domElement.style.cursor = hoveredId ? "pointer" : "grab";
      }

      // leak transitions (single source of truth: frame.leak)
      const leakKey = leak.active ? `on:${leak.nodeId}` : "off";
      if (leakKey !== prevLeakKey) {
        prevLeakKey = leakKey;
        for (const tint of allTints) {
          tint.target.copy(tint.base);
          tint.pulsing = false;
        }
        if (leak.active) {
          spawnLeakFx(leak.nodeId);
          if (leak.nodeId && tintByNode[leak.nodeId]) {
            for (const tint of tintByNode[leak.nodeId]) {
              tint.target.copy(crimsonT);
              tint.pulsing = true;
            }
          }
        } else {
          clearLeakFx();
        }
      }

      // thermal: amber cabinet tint (unless that node is leaking)
      if (tintByNode["N05"]) {
        for (const tint of tintByNode["N05"]) {
          if (!tint.pulsing) tint.target.copy(thermal ? amberT : tint.base);
        }
      }

      // material lerp (colour, emissive, hover)
      for (const tint of allTints) {
        tint.hovered = hoveredId === tint.nodeId;
        tint.mat.color.lerp(tint.target, Math.min(1, dt * 5));
        if (tint.pulsing) {
          tint.mat.emissive.copy(crimsonT);
          tint.mat.emissiveIntensity = 0.35 + 0.35 * Math.sin(t * 5);
        } else if (tint.hovered) {
          tint.mat.emissive.setHex(SAGE_BRIGHT);
          tint.mat.emissiveIntensity = 0.22;
        } else if (tint.mat.emissiveIntensity > 0) {
          tint.mat.emissiveIntensity = Math.max(0, tint.mat.emissiveIntensity - dt * 1.8);
        }
      }

      // leak FX animation
      if (ring.visible) {
        const age = (now - leakSpawnT) / 1000;
        const grow = easeOutCubic(Math.min(1, age / 2));
        ring.scale.setScalar(Math.max(0.02, grow) * (1 + 0.03 * Math.sin(t * 1.5)));
        (ring.material as THREE.MeshBasicMaterial).opacity =
          0.55 + 0.35 * Math.min(1, leak.intensity * 1.5);
        dripMat.opacity = 0.5 + 0.4 * Math.min(1, leak.intensity * 1.5);
      }
      if (drips.visible) {
        for (let i = 0; i < DRIP_COUNT; i++) {
          const i3 = i * 3;
          dripPos[i3 + 1] -= dripVel[i] * dt;
          if (dripPos[i3 + 1] < 0.03) {
            dripPos[i3 + 1] = leakPoint.y;
            dripPos[i3] = leakPoint.x + (Math.random() - 0.5) * 0.16;
            dripPos[i3 + 2] = leakPoint.z + (Math.random() - 0.5) * 0.16;
          }
        }
        dripGeo.attributes.position.needsUpdate = true;
      }

      // FAIL_CLOSED: fog thickens + crimson edge flash + dimmed key light
      const fog = scene.fog as THREE.Fog;
      fog.near += ((fail ? 16 : fogNearNorm) - fog.near) * Math.min(1, dt * 2);
      fog.far += ((fail ? 80 : fogFarNorm) - fog.far) * Math.min(1, dt * 2);
      dirLight.intensity += ((fail ? 0.45 : 1.6) - dirLight.intensity) * Math.min(1, dt * 2);
      if (fail) {
        edgeMat.color.copy(edgeBase).lerp(edgeHot, 0.5 + 0.5 * Math.sin(t * 3.2));
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
      aria-label="3D mesh view of the Gqeberha edge rig"
      role="application"
    />
  );
}

export default ThreeScene;
