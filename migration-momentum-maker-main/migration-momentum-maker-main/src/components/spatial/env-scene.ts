// src/components/spatial/env-scene.ts — ROUND 32 · the environmental render
// layer shared by the twin projections (CITY TWIN + RIG).
//
// Implements the renderer-hints half of vvu-trust/surfaces/twin/
// ENVIRONMENTAL_STATE_SYNC.md: sky gradient, sun/moon discs, starfield,
// rain streaks with wind skew, wet ground, lightning flash, and the
// sun-following site fixtures (street lamps / yard floods with the 0°/2°
// hysteresis). The environment state itself is recomputed at 0.2 Hz (spec
// cadence) — every visual below interpolates smoothly between samples.
//
// The renderer does not call any API. It only reads derived state.

import * as THREE from "three";
import {
  computeEnvironment,
  isSnowy,
  isThunder,
  type EnvironmentState,
  type SiteConfig,
} from "@/lib/environment";
import { useVvuSocketStore } from "@/hooks/use-vvu-socket";

export interface EnvLampSpec {
  /** Fixture id from the site config (on/off resolved per spec rules). */
  fixtureId: string;
  /** Ground position in scene metres (x, z). */
  x: number;
  z: number;
  /** Pole height in metres. */
  heightM: number;
  /** Point-light intensity when on (default 1.6). */
  intensity?: number;
  /** Point-light reach in metres (default 16). */
  distance?: number;
}

export interface EnvLayerOpts {
  site: SiteConfig;
  lamps: EnvLampSpec[];
  /** Scene scale — sun/moon distance + rain box size (default 'city'). */
  scale?: "city" | "rig";
  /** Ground material (wetness drives roughness/metalness). */
  groundMat?: THREE.MeshStandardMaterial;
  /** Camera (diagnostic projection of the star dome into screen space). */
  camera?: THREE.PerspectiveCamera;
  /** Renderer (diagnostic draw counters — points/calls per frame). */
  renderer?: THREE.WebGLRenderer;
}

export interface EnvLayer {
  /** Latest environment state (recomputed every 5 s at 0.2 Hz). */
  readonly state: EnvironmentState;
  /** 0..1 lightning flash value (thunderstorm only) — spike + fast decay. */
  readonly flash: number;
  /** Smoothed ambient light level 0.05..1 (incl. cloud dimming). */
  readonly ambientLevel: number;
  /** Smoothed sky colour (shared instance — read only). */
  readonly skyColor: THREE.Color;
  /** Advance one frame: recompute at 0.2 Hz, interpolate every call. */
  update(nowMs: number): void;
  dispose(): void;
}

function makeDiscTexture(inner: string, outer: string): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = 128;
  cv.height = 128;
  const c = cv.getContext("2d");
  if (c) {
    const g = c.createRadialGradient(64, 64, 6, 64, 64, 62);
    g.addColorStop(0, inner);
    g.addColorStop(0.45, outer);
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const DEG = Math.PI / 180;

/** Direction of an altitude/azimuth on the scene's ENU mapping (+x east, −z north). */
export function skyDir(altitudeDeg: number, azimuthDeg: number, dist: number): THREE.Vector3 {
  const alt = altitudeDeg * DEG;
  const az = azimuthDeg * DEG;
  return new THREE.Vector3(
    dist * Math.cos(alt) * Math.sin(az),
    dist * Math.sin(alt),
    -dist * Math.cos(alt) * Math.cos(az),
  );
}

export function createEnvLayer(scene: THREE.Scene, opts: EnvLayerOpts): EnvLayer {
  const isCity = (opts.scale ?? "city") === "city";
  const celestialDist = isCity ? 520 : 300;
  const rainSpan = isCity ? 230 : 100;
  const rainTop = isCity ? 70 : 24;
  const rainCount = isCity ? 560 : 300;

  const disposables: Array<{ dispose(): void }> = [];
  const track = <T extends { dispose(): void }>(d: T): T => {
    disposables.push(d);
    return d;
  };

  // ── sun + moon discs (fog-immune, drawn behind everything) ────────────────
  const sunTex = track(makeDiscTexture("rgba(255,244,214,1)", "rgba(255,196,96,0.55)"));
  const sunSprite = new THREE.Sprite(
    track(
      new THREE.SpriteMaterial({
        map: sunTex,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        fog: false,
      }),
    ),
  );
  sunSprite.scale.setScalar(isCity ? 90 : 52);
  sunSprite.renderOrder = -100;
  scene.add(sunSprite);

  const moonTex = track(makeDiscTexture("rgba(228,236,248,0.95)", "rgba(190,205,228,0.4)"));
  const moonSprite = new THREE.Sprite(
    track(
      new THREE.SpriteMaterial({
        map: moonTex,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        fog: false,
      }),
    ),
  );
  moonSprite.scale.setScalar(isCity ? 58 : 34);
  moonSprite.renderOrder = -99;
  scene.add(moonSprite);

  // ── starfield (upper dome, fades in as the sky darkens, clouds dim it) ──
  // Implemented as ONE billboarded InstancedMesh of small quads (Mesh draw
  // path — robust across the WebGL backends we ship on) rather than
  // THREE.Points, whose rasterization proved unreliable in this stack.
  // Elevation is horizon-weighted: the twin cameras pitch down ~20° and the
  // page chrome covers the top of the frame, so the 0.2°–3° band is what the
  // default frames actually show; orbiting reveals the higher dome.
  const STAR_COUNT = 320;
  const starPos = new Float32Array(STAR_COUNT * 3);
  const starScale = new Float32Array(STAR_COUNT);
  for (let i = 0; i < STAR_COUNT; i++) {
    const a = (i * 2.399963229728653) % (Math.PI * 2); // golden angle
    // horizon-weighted power curve: ~40% of the dome below 3° elevation (the
    // band the default twin frames show), the rest sparse up to ~80°.
    const e = 0.0025 + 0.885 * Math.pow((i * 0.6180339887) % 1, 1.8);
    const r = celestialDist * 0.96;
    starPos[i * 3] = r * Math.cos(e * Math.PI * 0.5) * Math.cos(a);
    starPos[i * 3 + 1] = r * Math.sin(e * Math.PI * 0.5);
    starPos[i * 3 + 2] = r * Math.cos(e * Math.PI * 0.5) * Math.sin(a);
    // world-unit size, calibrated per scene so every star lands ≈5–8 px on
    // the canvas: city 0.94 m/px at the 499 m dome, rig 0.62 m/px at 288 m.
    const unit = isCity ? 1.1 : 0.72;
    starScale[i] = unit * (5 + 3 * ((i * 0.7548776662) % 1));
  }
  const starMat = track(
    new THREE.MeshBasicMaterial({
      color: 0xe8efff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide,
    }),
  );
  const stars = new THREE.InstancedMesh(track(new THREE.PlaneGeometry(1, 1)), starMat, STAR_COUNT);
  stars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  stars.renderOrder = -98; // behind all transparent HUD geometry; depth-tested against the opaque skyline
  stars.frustumCulled = false;
  scene.add(stars);
  const starQuat = new THREE.Quaternion();
  const starMat4 = new THREE.Matrix4();
  const starScaleVec = new THREE.Vector3();
  const starVec = new THREE.Vector3();
  const billboardStars = (camQuat: THREE.Quaternion | null): void => {
    for (let i = 0; i < STAR_COUNT; i++) {
      starVec.set(starPos[i * 3], starPos[i * 3 + 1], starPos[i * 3 + 2]);
      starScaleVec.setScalar(starScale[i]);
      starMat4.compose(starVec, camQuat ?? starQuat, starScaleVec);
      stars.setMatrixAt(i, starMat4);
    }
    stars.instanceMatrix.needsUpdate = true;
  };

  // ── rain streaks (LineSegments — vertical, wind-skewed, draw-range density) ──
  const rainVerts = new Float32Array(rainCount * 2 * 3);
  const rainGeo = track(new THREE.BufferGeometry());
  rainGeo.setAttribute("position", new THREE.BufferAttribute(rainVerts, 3));
  const rainMat = track(
    new THREE.LineBasicMaterial({
      color: 0x9fb6c9,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    }),
  );
  const rain = new THREE.LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false;
  rain.visible = false;
  scene.add(rain);
  const dropY = new Float32Array(rainCount);
  const dropSpeed = new Float32Array(rainCount);
  const dropX = new Float32Array(rainCount);
  const dropZ = new Float32Array(rainCount);
  for (let i = 0; i < rainCount; i++) {
    dropX[i] = (Math.random() - 0.5) * rainSpan;
    dropZ[i] = (Math.random() - 0.5) * rainSpan;
    dropY[i] = Math.random() * rainTop;
    dropSpeed[i] = 0.75 + Math.random() * 0.5;
  }

  // ── site lamps (sun-following fixtures with hysteresis) ──────────────────
  interface LampRig {
    fixtureId: string;
    group: THREE.Group;
    headMat: THREE.MeshStandardMaterial;
    glow: THREE.Mesh;
    light: THREE.PointLight;
    targetOn: boolean;
    lit: number;
    intensity: number;
  }
  const lampRigs: LampRig[] = [];
  const poleMat = track(
    new THREE.MeshStandardMaterial({ color: 0x1c2318, roughness: 0.7, metalness: 0.35 }),
  );
  for (const lamp of opts.lamps) {
    const g = new THREE.Group();
    const h = lamp.heightM;
    const pole = new THREE.Mesh(track(new THREE.CylinderGeometry(0.09, 0.12, h, 8)), poleMat);
    pole.position.y = h / 2;
    g.add(pole);
    const arm = new THREE.Mesh(track(new THREE.BoxGeometry(0.7, 0.07, 0.07)), poleMat);
    arm.position.set(0.32, h - 0.05, 0);
    g.add(arm);
    const headMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x2a2f24,
        emissive: 0xffd9a0,
        emissiveIntensity: 0,
        roughness: 0.5,
      }),
    );
    const head = new THREE.Mesh(track(new THREE.BoxGeometry(0.46, 0.12, 0.22)), headMat);
    head.position.set(0.62, h - 0.08, 0);
    g.add(head);
    const glowMat = track(
      new THREE.MeshBasicMaterial({
        color: 0xffd9a0,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const glow = new THREE.Mesh(track(new THREE.SphereGeometry(0.34, 12, 8)), glowMat);
    glow.position.copy(head.position);
    g.add(glow);
    g.position.set(lamp.x, 0, lamp.z);
    scene.add(g);
    const light = new THREE.PointLight(0xffd9a0, 0, lamp.distance ?? (isCity ? 17 : 9), 2);
    light.position.set(0.62, h - 0.25, 0); // relative to the pole group
    g.add(light); // light travels with the pole group
    lampRigs.push({
      fixtureId: lamp.fixtureId,
      group: g,
      headMat,
      glow,
      light,
      targetOn: false,
      lit: 0,
      intensity: lamp.intensity ?? (isCity ? 1.7 : 1.1),
    });
  }

  // ── state (0.2 Hz recompute + per-frame interpolation) ───────────────────
  let state = computeEnvironment({
    weather: useVvuSocketStore.getState().envWeather,
    date: new Date(),
    site: opts.site,
  });
  let lastCalc = performance.now();
  const skyColor = new THREE.Color(state.derived.skyColor);
  const targetSky = new THREE.Color(state.derived.skyColor);
  let ambientLevel = state.derived.ambientLight;
  let flash = 0;
  let nextThunderAt = 0;

  const update = (nowMs: number): void => {
    // 0.2 Hz recompute — the spec cadence; everything below interpolates.
    if (nowMs - lastCalc > 5000) {
      lastCalc = nowMs;
      state = computeEnvironment({
        weather: useVvuSocketStore.getState().envWeather,
        date: new Date(),
        site: opts.site,
      });
      targetSky.set(state.derived.skyColor);
      const w = state.weather;
      if (w && isThunder(w.code) && nowMs > nextThunderAt) {
        nextThunderAt = nowMs + 3500 + Math.random() * 5500;
      }
    }

    // QA + operator diagnostic hook (read-only, replaces any prior layer).
    if (typeof window !== "undefined") {
      const cam = opts.camera;
      const rnd = opts.renderer;
      let starScreen: { x: number; y: number; visible: boolean } | null = null;
      if (cam) {
        // project the lowest dome star (elevation ≈ 2.7°, azimuth 0 = north)
        const v = skyDir(2.7, 0, celestialDist * 0.96).project(cam);
        starScreen = {
          x: Math.round(((v.x + 1) / 2) * (cam.aspect > 1 ? 1280 : 390)),
          y: Math.round(((1 - v.y) / 2) * 577),
          visible: v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1,
        };
      }
      (window as unknown as Record<string, unknown>).__vvuEnvLayer = {
        site: opts.site.siteId,
        starsOpacity: starMat.opacity,
        starsVisible: stars.visible,
        ambientLevel,
        skyColor: `#${skyColor.getHexString()}`,
        sunElevationDeg: state.sun.elevationDeg,
        moonElevationDeg: state.moon.elevationDeg,
        starScreen,
        draw: rnd
          ? {
              calls: rnd.info.render.calls,
              triangles: rnd.info.render.triangles,
              starsInScene: scene.children.includes(stars),
            }
          : null,
      };
    }

    const w = state.weather;

    // lightning flash — occasional screen-wide brightness spike (WMO 95–99)
    if (w && isThunder(w.code) && nowMs > nextThunderAt) {
      flash = 1;
      nextThunderAt = nowMs + 3500 + Math.random() * 5500;
    }
    flash = Math.max(0, flash - 0.055);

    // sky + ambient smoothing
    skyColor.lerp(targetSky, 0.06);
    if (flash > 0) {
      skyColor.lerp(new THREE.Color(0xdfe6ee), flash * 0.35);
    }
    ambientLevel += (state.derived.ambientLight - ambientLevel) * 0.06;

    // sun + moon position (deterministic astronomy, not animation)
    const sunDist = skyDir(state.sun.elevationDeg, state.sun.azimuthDeg, celestialDist);
    sunSprite.position.copy(sunDist);
    sunSprite.material.opacity =
      state.sun.elevationDeg > -4 ? 1 : Math.max(0, (state.sun.elevationDeg + 12) / 8);
    const moonDist = skyDir(state.moon.elevationDeg, state.moon.azimuthDeg, celestialDist);
    moonSprite.position.copy(moonDist);
    moonSprite.material.opacity =
      state.moon.elevationDeg > -2
        ? 0.35 + 0.65 * state.moon.illumination
        : Math.max(0, (state.moon.elevationDeg + 8) / 10);

    // stars fade in as ambient drops; clouds hide them
    const cloud = w?.cloudCoverPct ?? 0;
    starMat.opacity =
      Math.min(0.9, Math.max(0, (0.34 - ambientLevel) * 3.4)) * (1 - (cloud / 100) * 0.85);
    billboardStars(opts.camera?.quaternion ?? null);

    // rain streaks — density ∝ precipitation, wind skews the drop angle
    const raining = w ? w.precipMm > 0.1 : false;
    const snow = w ? isSnowy(w.code) : false;
    const intensity = raining ? state.derived.rainIntensity : 0;
    rain.visible = intensity > 0.02;
    if (rain.visible) {
      const dt = 1 / 60; // RAF cadence approximation for streak motion
      const active = Math.max(8, Math.floor(rainCount * Math.min(1, intensity * 1.4)));
      rainGeo.setDrawRange(0, active * 2);
      const fall = (snow ? 4.5 : 15 + 10 * intensity) * dt;
      const skew = snow ? 0 : Math.min(1, (w?.windKmh ?? 8) / 55) * 1.6;
      const streakLen = snow ? 0.28 : 0.9 + 0.7 * intensity;
      for (let i = 0; i < active; i++) {
        dropY[i] -= fall * dropSpeed[i];
        if (dropY[i] < 0) {
          dropY[i] = rainTop * (0.82 + 0.18 * Math.random());
          dropX[i] = (Math.random() - 0.5) * rainSpan;
          dropZ[i] = (Math.random() - 0.5) * rainSpan;
        }
        const i6 = i * 6;
        rainVerts[i6] = dropX[i];
        rainVerts[i6 + 1] = dropY[i];
        rainVerts[i6 + 2] = dropZ[i];
        rainVerts[i6 + 3] = dropX[i] + skew * streakLen * 0.4;
        rainVerts[i6 + 4] = dropY[i] - streakLen;
        rainVerts[i6 + 5] = dropZ[i] + skew * streakLen * 0.25;
      }
      rainGeo.attributes.position.needsUpdate = true;
      rainMat.color.setHex(snow ? 0xdfe8f2 : 0x9fb6c9);
      rainMat.opacity = snow ? 0.5 : 0.3 + 0.25 * intensity;
    }

    // lamps — on/off from the site fixture rules, lerped for smooth dawn/dusk
    for (const rig of lampRigs) {
      rig.targetOn = state.site.lightsOn.includes(rig.fixtureId);
      const goal = rig.targetOn ? 1 : 0;
      rig.lit += (goal - rig.lit) * 0.08;
      rig.headMat.emissiveIntensity = rig.lit * 1.35;
      (rig.glow.material as THREE.MeshBasicMaterial).opacity = rig.lit * 0.32;
      rig.light.intensity = rig.lit * rig.intensity;
    }

    // wet ground — roughness drops, metalness rises while it rains
    if (opts.groundMat) {
      const wet = state.derived.groundWetness;
      opts.groundMat.roughness += (0.96 - wet * 0.55 - opts.groundMat.roughness) * 0.04;
      opts.groundMat.metalness += (0.02 + wet * 0.3 - opts.groundMat.metalness) * 0.04;
    }
  };

  update(performance.now());

  return {
    get state() {
      return state;
    },
    get flash() {
      return flash;
    },
    get ambientLevel() {
      return ambientLevel;
    },
    get skyColor() {
      return skyColor;
    },
    update,
    dispose() {
      scene.remove(sunSprite, moonSprite, stars, rain);
      for (const rig of lampRigs) {
        scene.remove(rig.group); // poles + heads + glow + point light (child)
      }
      for (const d of disposables) d.dispose();
    },
  };
}
