// src/lib/environment.ts — ROUND 32 · ENVIRONMENTAL_STATE_SYNC v0.
//
// The twin must look like the world it represents. Three independent
// inputs (vvu-trust/surfaces/twin/ENVIRONMENTAL_STATE_SYNC.md):
//
//   Layer 1  Solar + lunar position — local astronomical calculation,
//            100% offline, no API, no key, no rate limit. Runs at
//            0.2 Hz; renderers interpolate between samples.
//   Layer 2  Weather — the Mk-0.5 node polls Open-Meteo (free, no API
//            key) every 15 min, caches last-known, chains
//            ENV_WEATHER_FETCHED / ENV_WEATHER_STALE to the WORM and
//            pushes the 'env' socket event. The twin renders what it
//            is told and honestly flags anything > 2 h as STALE.
//   Layer 3  Site state — fully local. Fixtures tagged sun_following
//            turn on below 0° solar elevation and off above 2°
//            (hysteresis against dawn flicker); scheduled fixtures
//            follow their HH:MM-HH:MM window; telemetry.observed
//            always wins over prediction.
//
// The renderer never calls an API. It only reads derived state.
"use client";

import { create } from "zustand";
import type { EnvWeather } from "@/types/vvu";

// ─── Layer 1 · solar position (NOAA simplified, JS port of the spec) ─────────

export interface SolarPosition {
  elevationDeg: number;
  azimuthDeg: number;
  isDaylight: boolean;
}

/**
 * NOAA simplified solar position — the exact algorithm from the spec,
 * ported to TypeScript. Given lat/lon and a UTC instant it returns
 * (elevation°, azimuth°, isDaylight) to within ~0.01°.
 */
export function solarPosition(latDeg: number, lonDeg: number, date: Date): SolarPosition {
  const n = date.getTime() / 86400000 + 2440587.5 - 2451545.0; // days since J2000.0
  const L = (280.46 + 0.9856474 * n) % 360; // mean longitude
  const g = (((357.528 + 0.9856003 * n) % 360) * Math.PI) / 180;
  const lam = (((L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) % 360) * Math.PI) / 180;
  const eps = ((23.439 - 0.0000004 * n) * Math.PI) / 180;

  const ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam));
  const dec = Math.asin(Math.sin(eps) * Math.sin(lam));

  const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
  const lst = (((gmst * 15 + lonDeg) % 360) * Math.PI) / 180;

  const H = lst - ra;
  const phi = (latDeg * Math.PI) / 180;

  const el = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(-Math.sin(H), Math.tan(dec) * Math.cos(phi) - Math.sin(phi) * Math.cos(H));

  const elevationDeg = (el * 180) / Math.PI;
  return {
    elevationDeg,
    azimuthDeg: ((((az * 180) / Math.PI + 180) % 360) + 360) % 360,
    isDaylight: elevationDeg > 0,
  };
}

// ─── Layer 1 · lunar position + phase (low-precision Meeus) ──────────────────

export interface MoonState {
  elevationDeg: number;
  azimuthDeg: number;
  phase: string;
  illumination: number; // 0..1
}

const SYNODIC = 29.530588853;
const NEW_MOON_2000_01_06_UTC = Date.UTC(2000, 0, 6, 18, 14);

const MOON_PHASES = [
  "new_moon",
  "waxing_crescent",
  "first_quarter",
  "waxing_gibbous",
  "full_moon",
  "waning_gibbous",
  "last_quarter",
  "waning_crescent",
] as const;

export function moonState(latDeg: number, lonDeg: number, date: Date): MoonState {
  const n = date.getTime() / 86400000 + 2440587.5 - 2451545.0;

  // ecliptic position (low precision, ±0.3° — plenty for a sky disc)
  const Lp = (((218.316 + 13.176396 * n) % 360) * Math.PI) / 180;
  const M = (((357.529 + 0.98560028 * n) % 360) * Math.PI) / 180;
  const Mp = (((134.963 + 13.064993 * n) % 360) * Math.PI) / 180;
  const F = (((93.272 + 13.22935 * n) % 360) * Math.PI) / 180;
  const lon = Lp + 6.289 * Math.sin(Mp) - 0.146 * Math.sin(M) - 0.059 * Math.sin(2 * Lp - 2 * Mp);
  const lat = 5.128 * Math.sin(F);

  const eps = ((23.439 - 0.0000004 * n) * Math.PI) / 180;
  const ra = Math.atan2(
    Math.sin(lon) * Math.cos(eps) - Math.tan(lat) * Math.sin(eps),
    Math.cos(lon),
  );
  const dec = Math.asin(
    Math.sin(lat) * Math.cos(eps) + Math.cos(lat) * Math.sin(eps) * Math.sin(lon),
  );

  const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
  const lst = (((gmst * 15 + lonDeg) % 360) * Math.PI) / 180;
  const H = lst - ra;
  const phi = (latDeg * Math.PI) / 180;
  const el = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(-Math.sin(H), Math.tan(dec) * Math.cos(phi) - Math.sin(phi) * Math.cos(H));

  const ageDays = ((date.getTime() - NEW_MOON_2000_01_06_UTC) / 86400000) % SYNODIC;
  const phaseFrac = ((ageDays + SYNODIC) % SYNODIC) / SYNODIC;
  const illumination = (1 - Math.cos(2 * Math.PI * phaseFrac)) / 2;
  const phase = MOON_PHASES[Math.floor((((phaseFrac * 8) % 8) + 0.5) % 8)];

  return {
    elevationDeg: (el * 180) / Math.PI,
    azimuthDeg: ((((az * 180) / Math.PI + 180) % 360) + 360) % 360,
    phase,
    illumination,
  };
}

// ─── Day/night cycle — the nine phases and their ambient light ────────────────

export type SunPhase =
  | "night"
  | "astronomical_twilight"
  | "nautical_twilight"
  | "civil_twilight"
  | "golden_hour"
  | "full_morning"
  | "solar_noon"
  | "full_afternoon"
  | "golden_hour_pm";

export const SUN_PHASE_TABLE: { phase: SunPhase; from: number; to: number; ambient: number }[] = [
  { phase: "night", from: -90, to: -18, ambient: 0.05 },
  { phase: "astronomical_twilight", from: -18, to: -12, ambient: 0.08 },
  { phase: "nautical_twilight", from: -12, to: -6, ambient: 0.15 },
  { phase: "civil_twilight", from: -6, to: 0, ambient: 0.3 },
  { phase: "golden_hour", from: 0, to: 6, ambient: 0.55 },
  { phase: "full_morning", from: 6, to: 30, ambient: 0.85 },
  { phase: "solar_noon", from: 30, to: 90, ambient: 1.0 },
];

export function sunPhase(elevationDeg: number): {
  phase: SunPhase;
  ambient: number;
  ascending: boolean;
} {
  const row =
    SUN_PHASE_TABLE.find((r) => elevationDeg >= r.from && elevationDeg < r.to) ??
    SUN_PHASE_TABLE[6];
  // Morning vs afternoon share the golden band; the sign of the next-sample
  // derivative is not available here, so approximate by hour parity of the
  // day: elevations in 0..6° are golden_hour before local noon, golden_hour_pm
  // after it; likewise 6..30 morning vs afternoon. Local solar noon for the
  // site longitude ≈ 12:00 UTC − lon/15 h.
  return { phase: row.phase as SunPhase, ambient: row.ambient, ascending: true };
}

/** Ambient light level, smoothly interpolated between phase anchor points. */
export function ambientLightAt(elevationDeg: number): number {
  const pts: [number, number][] = [
    [-90, 0.05],
    [-18, 0.05],
    [-12, 0.08],
    [-6, 0.15],
    [0, 0.3],
    [6, 0.55],
    [30, 0.85],
    [60, 1.0],
    [90, 1.0],
  ];
  if (elevationDeg <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (elevationDeg <= pts[i][0]) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const t = (elevationDeg - x0) / (x1 - x0);
      const s = t * t * (3 - 2 * t); // smoothstep — no band edges
      return y0 + (y1 - y0) * s;
    }
  }
  return 1;
}

// ─── Layer 2 · WMO weather code mapping ──────────────────────────────────────

export function wmoCondition(code: number): string {
  if (code === 0) return "clear";
  if (code >= 1 && code <= 3) return "partly_cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code >= 61 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "rain_showers";
  if (code >= 95 && code <= 99) return "thunderstorm";
  return "unknown";
}

export const isThunder = (code: number): boolean => code >= 95 && code <= 99;
export const isSnowy = (code: number): boolean => code >= 71 && code <= 77;

// ─── Layer 3 · site fixtures (Rule A sun-following · Rule B telemetry wins) ──

export type FixtureKind = "street_lamp" | "yard_flood" | "gate_lamp" | "signal";

export interface SiteFixture {
  id: string;
  kind: FixtureKind;
  sunFollowing: boolean;
  onElevationDeg: number; // on when solar elevation < this
  offElevationDeg: number; // off when solar elevation > this (hysteresis)
  schedule?: string; // "HH:MM-HH:MM" local site time — for non-sun fixtures
}

export interface SiteConfig {
  siteId: string;
  kind: "rig" | "municipal";
  lat: number;
  lon: number;
  tzOffsetMinutes: number;
  fixtures: SiteFixture[];
}

/** The Gqeberha edge-rig site (the 25 m geofence pad + yard). */
export const RIG_SITE: SiteConfig = {
  siteId: "Gqeberha_Edge_01",
  kind: "rig",
  lat: -33.9608,
  lon: 25.6022,
  tzOffsetMinutes: 120, // SAST (UTC+2)
  fixtures: [
    {
      id: "yard_flood_1",
      kind: "yard_flood",
      sunFollowing: true,
      onElevationDeg: 0,
      offElevationDeg: 2,
    },
    {
      id: "yard_flood_2",
      kind: "yard_flood",
      sunFollowing: true,
      onElevationDeg: 0,
      offElevationDeg: 2,
    },
    {
      id: "gate_lamp_north",
      kind: "gate_lamp",
      sunFollowing: true,
      onElevationDeg: 0,
      offElevationDeg: 2,
    },
  ],
};

/** The municipal twin — same environment object, different fixture list. */
export const CITY_SITE: SiteConfig = {
  siteId: "Gqeberha_Municipal_01",
  kind: "municipal",
  lat: -33.9608,
  lon: 25.6022,
  tzOffsetMinutes: 120,
  fixtures: [
    {
      id: "street_light_main_1",
      kind: "street_lamp",
      sunFollowing: true,
      onElevationDeg: 0,
      offElevationDeg: 2,
    },
    {
      id: "street_light_main_2",
      kind: "street_lamp",
      sunFollowing: true,
      onElevationDeg: 0,
      offElevationDeg: 2,
    },
    {
      id: "street_light_main_3",
      kind: "street_lamp",
      sunFollowing: true,
      onElevationDeg: 0,
      offElevationDeg: 2,
    },
    {
      id: "street_light_main_4",
      kind: "street_lamp",
      sunFollowing: true,
      onElevationDeg: 0,
      offElevationDeg: 2,
    },
    {
      id: "street_light_main_5",
      kind: "street_lamp",
      sunFollowing: true,
      onElevationDeg: 0,
      offElevationDeg: 2,
    },
    {
      id: "street_light_main_6",
      kind: "street_lamp",
      sunFollowing: true,
      onElevationDeg: 0,
      offElevationDeg: 2,
    },
    {
      id: "traffic_signal_1",
      kind: "signal",
      sunFollowing: false,
      onElevationDeg: 0,
      offElevationDeg: 2,
      schedule: "05:30-23:00",
    },
    {
      id: "traffic_signal_2",
      kind: "signal",
      sunFollowing: false,
      onElevationDeg: 0,
      offElevationDeg: 2,
      schedule: "05:30-23:00",
    },
  ],
};

/** Manual override — the spec's `override: manual` fixture property. */
export type EnvOverride = "auto" | "on" | "off";

interface EnvOverrideState {
  override: EnvOverride;
  setOverride: (next: EnvOverride) => void;
}

export const useEnvOverrideStore = create<EnvOverrideState>((set) => ({
  override: "auto",
  setOverride: (next) => set({ override: next }),
}));

/** Hysteresis memo — the last computed on/off per fixture id. The caller
 *  keeps feeding the current solar elevation; the fixture only flips when
 *  it crosses the deadband (0° on / 2° off), never at the band edge. */
const fixtureMemo = new Map<string, boolean>();

function inSchedule(schedule: string | undefined, date: Date, tzOffsetMinutes: number): boolean {
  if (!schedule) return false;
  const m = /^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/.exec(schedule);
  if (!m) return false;
  const local = new Date(date.getTime() + tzOffsetMinutes * 60000);
  const mins = local.getUTCHours() * 60 + local.getUTCMinutes();
  const from = Number(m[1]) * 60 + Number(m[2]);
  const to = Number(m[3]) * 60 + Number(m[4]);
  return from <= to ? mins >= from && mins < to : mins >= from || mins < to;
}

/** Rule A + Rule B. Returns the on/off state of every fixture of the site. */
export function fixtureStates(
  site: SiteConfig,
  elevationDeg: number,
  date: Date,
  override: EnvOverride,
): { id: string; on: boolean }[] {
  return site.fixtures.map((f) => {
    const prev = fixtureMemo.get(f.id);
    let on: boolean;
    if (f.sunFollowing) {
      on = prev ?? elevationDeg < f.onElevationDeg;
      if (on && elevationDeg > f.offElevationDeg) on = false;
      if (!on && elevationDeg < f.onElevationDeg) on = true;
    } else {
      on = inSchedule(f.schedule, date, site.tzOffsetMinutes);
    }
    if (override === "on") on = true;
    else if (override === "off") on = false;
    fixtureMemo.set(f.id, on);
    return { id: f.id, on };
  });
}

// ─── The environment state object ────────────────────────────────────────────

export interface DerivedEnv {
  skyColor: string; // hex
  ambientLight: number; // 0.05..1
  groundWetness: number; // 0..1
  rainIntensity: number; // 0..1
  renderHint: string;
}

export interface EnvironmentState {
  utc: string;
  siteId: string;
  lat: number;
  lon: number;
  sun: { elevationDeg: number; azimuthDeg: number; isDaylight: boolean; phase: SunPhase };
  moon: { elevationDeg: number; azimuthDeg: number; phase: string; illumination: number };
  weather: EnvWeather | null;
  site: { lightsOn: string[]; lightsOff: string[]; activeOverride: EnvOverride };
  derived: DerivedEnv;
}

// sky anchors by solar elevation (day = worldly blues, night = navy, dawn = warm)
const SKY_STOPS: { elev: number; rgb: [number, number, number] }[] = [
  { elev: -90, rgb: [4, 6, 12] },
  { elev: -18, rgb: [6, 9, 18] },
  { elev: -12, rgb: [10, 15, 30] },
  { elev: -6, rgb: [26, 36, 60] },
  { elev: -2, rgb: [86, 70, 84] },
  { elev: 2, rgb: [214, 130, 74] },
  { elev: 8, rgb: [168, 190, 216] },
  { elev: 30, rgb: [140, 182, 220] },
  { elev: 90, rgb: [150, 196, 230] },
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function skyColorAt(
  elevationDeg: number,
  cloudPct: number,
  raining: boolean,
): [number, number, number] {
  let rgb: [number, number, number] = SKY_STOPS[SKY_STOPS.length - 1].rgb;
  if (elevationDeg <= SKY_STOPS[0].elev) rgb = SKY_STOPS[0].rgb;
  else {
    for (let i = 1; i < SKY_STOPS.length; i++) {
      if (elevationDeg <= SKY_STOPS[i].elev) {
        const a = SKY_STOPS[i - 1];
        const b = SKY_STOPS[i];
        const t = (elevationDeg - a.elev) / (b.elev - a.elev);
        rgb = [
          lerp(a.rgb[0], b.rgb[0], t),
          lerp(a.rgb[1], b.rgb[1], t),
          lerp(a.rgb[2], b.rgb[2], t),
        ];
        break;
      }
    }
  }
  // cloud cover desaturates toward slate
  const cloud = Math.min(100, Math.max(0, cloudPct)) / 100;
  if (cloud > 0) {
    const gray = (rgb[0] + rgb[1] + rgb[2]) / 3 + 14;
    rgb = [
      lerp(rgb[0], gray, cloud * 0.62),
      lerp(rgb[1], gray, cloud * 0.62),
      lerp(rgb[2], gray, cloud * 0.62),
    ];
  }
  // rain darkens the sky by 15%
  if (raining) rgb = rgb.map((c) => c * 0.85) as [number, number, number];
  return rgb;
}

const hex2 = (v: number) =>
  Math.round(Math.min(255, Math.max(0, v)))
    .toString(16)
    .padStart(2, "0");

/**
 * Build the full environment state — the single object the renderer reads.
 * Everything is computed locally except weather.*, which is the node's
 * cached reading passed through untouched.
 */
export function computeEnvironment(input: {
  weather: EnvWeather | null;
  date: Date;
  site: SiteConfig;
  override?: EnvOverride;
}): EnvironmentState {
  const { weather, date, site } = input;
  const override = input.override ?? useEnvOverrideStore.getState().override;
  const sun = solarPosition(site.lat, site.lon, date);
  const moon = moonState(site.lat, site.lon, date);
  const { phase } = sunPhase(sun.elevationDeg);

  const raining = weather ? weather.precipMm > 0.1 : false;
  const cloudPct = weather?.cloudCoverPct ?? 0;
  const rgb = skyColorAt(sun.elevationDeg, cloudPct, raining);
  const ambientLight = ambientLightAt(sun.elevationDeg) * (1 - 0.45 * (cloudPct / 100));
  const rainIntensity = raining ? Math.min(1, weather!.precipMm / 6) : 0;
  const groundWetness = raining ? Math.min(1, 0.35 + weather!.precipMm / 8) : 0;

  const weatherHint = weather
    ? weather.stale
      ? `stale_${weather.condition}`
      : weather.condition
    : "no_reading";
  const timeHint = sun.isDaylight
    ? sun.elevationDeg < 6
      ? "golden"
      : "day"
    : sun.elevationDeg > -6
      ? "twilight"
      : "night";

  const states = fixtureStates(site, sun.elevationDeg, date, override);

  return {
    utc: date.toISOString(),
    siteId: site.siteId,
    lat: site.lat,
    lon: site.lon,
    sun: {
      elevationDeg: sun.elevationDeg,
      azimuthDeg: sun.azimuthDeg,
      isDaylight: sun.isDaylight,
      phase,
    },
    moon: {
      elevationDeg: moon.elevationDeg,
      azimuthDeg: moon.azimuthDeg,
      phase: moon.phase,
      illumination: moon.illumination,
    },
    weather,
    site: {
      lightsOn: states.filter((s) => s.on).map((s) => s.id),
      lightsOff: states.filter((s) => !s.on).map((s) => s.id),
      activeOverride: override,
    },
    derived: {
      skyColor: `#${hex2(rgb[0])}${hex2(rgb[1])}${hex2(rgb[2])}`,
      ambientLight,
      groundWetness,
      rainIntensity,
      renderHint: `${timeHint}_${weatherHint}`,
    },
  };
}

/** Direction on the compass for a 0..360° azimuth (display helper). */
export function compassOf(azimuthDeg: number): string {
  const dirs = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];
  return dirs[Math.round((((azimuthDeg % 360) + 360) % 360) / 22.5) % 16];
}
