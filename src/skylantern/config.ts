/**
 * Skylantern — plugin configuration.
 *
 * Everything that a host stack might want to override lives here. The plugin
 * is fully functional with zero configuration (sensible defaults baked in),
 * but every knob is exposed so an investor / operator can tune it.
 */

export interface SkylanternConfig {
  /** Display name shown in the dashboard chrome. */
  productName: string;
  /** Codename from the architecture deck. */
  codename: string;
  /** Tier tag - drives the status pill in the UI. */
  statusTier: string;
  /** MapLibre style URL. Default: OpenFreeMap Liberty (free, no API key). */
  mapStyleUrl: string;
  /** Default map center (Johannesburg CBD by default - matches the ZA timezone). */
  mapCenter: [number, number];
  mapZoom: number;
  mapPitch: number;
  mapBearing: number;
  /** MapTiler API key (optional). When set, the canonical maptiler-3d-gl-style
   * is used in preference to the OpenFreeMap fallback. */
  maptilerKey: string | null;
  /** Whether the bundled 3D building layer should be enabled. */
  enable3DBuildings: boolean;
  /** Synthetic hardware key used to sign evidence. In production this would
   * be a per-device HSM-backed secret; here it is deterministic per externalId
   * so the demo is reproducible. NEVER expose this in client code. */
  hardwareKeySeed: string;
  /** Pricing band cap (R9 - R9,999) from the Commercial Constitution. */
  pricingBandFloorZAR: number;
  pricingBandCeilingZAR: number;
}

const env = (typeof process !== "undefined" ? process.env : {}) as Record<
  string,
  string | undefined
>;

export const skylanternConfig: SkylanternConfig = {
  productName: "Skylantern",
  codename: "Venture Vision Ubuntu",
  statusTier: "Tier 2 (Specified)",
  mapStyleUrl:
    env.SKYLANTERN_MAP_STYLE ||
    "https://tiles.openfreemap.org/styles/liberty",
  mapCenter: [
    Number(env.SKYLANTERN_MAP_LNG ?? 28.0473),
    Number(env.SKYLANTERN_MAP_LAT ?? -26.2041),
  ],
  mapZoom: Number(env.SKYLANTERN_MAP_ZOOM ?? 14.2),
  mapPitch: Number(env.SKYLANTERN_MAP_PITCH ?? 60),
  mapBearing: Number(env.SKYLANTERN_MAP_BEARING ?? -17.6),
  maptilerKey: env.MAPTILER_KEY || null,
  enable3DBuildings: env.SKYLANTERN_DISABLE_3D !== "1",
  hardwareKeySeed:
    env.SKYLANTERN_HW_KEY_SEED || "vvu-skylantern-tier2-seed-v1",
  pricingBandFloorZAR: 9,
  pricingBandCeilingZAR: 9999,
};

/**
 * Canonical maptiler-3d-gl-style.json - bundled as a reference artifact.
 * Loaded only when MAPTILER_KEY is provided by the host stack.
 * (Source: https://github.com/openmaptiles/maptiler-3d-gl-style)
 */
export const maptiler3DStyleUrl =
  "https://raw.githubusercontent.com/openmaptiles/maptiler-3d-gl-style/master/style.json";
