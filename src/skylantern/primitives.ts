/**
 * Skylantern — the 6 functional primitives.
 *
 * Slide 4 of the architecture deck: the Standardisation Funnel.
 *
 *   126 sensor types across 15 device classes
 *       |
 *       | ruthlessly reduced BEFORE cryptographic signing
 *       v
 *   6 functional primitives
 *
 * Each primitive carries:
 *   - an id (used in the chain payload)
 *   - a human label
 *   - the set of device classes that funnel into it
 *   - a representative sensor schema (value/unit/raw)
 */

import type { Domain, Primitive } from "./types";

export interface PrimitiveDefinition {
  id: Primitive;
  label: string;
  /** Short pitch used in tooltips. */
  blurb: string;
  /** Device classes that funnel into this primitive. */
  sources: string[];
  /** Default unit when the raw reading is numeric. */
  defaultUnit: string;
  /** Tailwind color stop used by the UI (amber / emerald / etc. per slide 4 hex icons). */
  accent: string;
}

export const PRIMITIVE_DEFINITIONS: Record<Primitive, PrimitiveDefinition> = {
  MOTION: {
    id: "MOTION",
    label: "Motion",
    blurb: "Acceleration, vibration, wheel speed, door state transitions.",
    sources: ["accelerometer", "wheel_speed", "door_state", "vibration"],
    defaultUnit: "m/s^2",
    accent: "#f97316",
  },
  PROXIMITY: {
    id: "PROXIMITY",
    label: "Proximity",
    blurb: "BLE handshake presence, phone-to-pod tether, second-witness GNSS distance.",
    sources: ["ble_beacon", "phone_pod_tether", "gnss_anchor"],
    defaultUnit: "m",
    accent: "#0ea5e9",
  },
  STATE: {
    id: "STATE",
    label: "State",
    blurb: "Valve open/closed, ignition on/off, leak-candidate flag.",
    sources: ["valve_state", "ignition_state", "leak_candidate_flag"],
    defaultUnit: "enum",
    accent: "#a855f7",
  },
  IDENTITY: {
    id: "IDENTITY",
    label: "Identity",
    blurb: "Hardware key fingerprint, VIN, IMEI - proves the signer, not the truth.",
    sources: ["hw_key_fingerprint", "vin", "imei"],
    defaultUnit: "hash",
    accent: "#ec4899",
  },
  LOCATION: {
    id: "LOCATION",
    label: "Location",
    blurb: "GNSS fix, cell-tower triangulation, geofence breach.",
    sources: ["gnss_fix", "cell_triangulation", "geofence"],
    defaultUnit: "deg",
    accent: "#14b8a6",
  },
  ENVIRONMENT: {
    id: "ENVIRONMENT",
    label: "Environment",
    blurb: "Temperature flux, pressure, humidity, ambient light.",
    sources: ["temperature", "pressure", "humidity", "ambient_light"],
    defaultUnit: "celsius",
    accent: "#22c55e",
  },
};

/** Which primitives apply to which pilot domain (slide 8 cross-domain table). */
export const DOMAIN_PRIMITIVE_MAP: Record<Domain, Primitive[]> = {
  WATER: ["STATE", "ENVIRONMENT", "LOCATION"],
  CELLPHONE: ["PROXIMITY", "MOTION", "IDENTITY"],
  VEHICLE: ["STATE", "MOTION", "PROXIMITY", "IDENTITY"],
};

/** Pricing tiers from the Commercial Constitution (slide 13). */
export const PRICING_TIERS = [
  {
    key: "phone",
    label: "Phone Pilot",
    priceZAR: 25,
    cadence: "per user / mo",
    domain: "CELLPHONE" as Domain,
    primitive: "PROXIMITY" as Primitive,
    blurb: "BLE tether + seconds-level sync. Theft inference only - no mic/camera.",
  },
  {
    key: "vehicle",
    label: "Vehicle Hijack Alert",
    priceZAR: 199,
    cadence: "per mo",
    domain: "VEHICLE" as Domain,
    primitive: "PROXIMITY" as Primitive,
    blurb: "Phone-absent + motion-present. Observes; never actuates the engine.",
  },
  {
    key: "fleet",
    label: "Fleet Evidence Log",
    priceZAR: 250,
    cadence: "per vehicle / mo",
    domain: "VEHICLE" as Domain,
    primitive: "STATE" as Primitive,
    blurb: "Hash-chained CAN bus baseline. Tamper-evident record for insurers.",
  },
  {
    key: "water",
    label: "Water Pilot Unit",
    priceZAR: 999,
    cadence: "90 days",
    domain: "WATER" as Domain,
    primitive: "STATE" as Primitive,
    blurb: "Daily WORM sync of L/s delta. Leak-candidate alert, no satellite.",
  },
  {
    key: "dma",
    label: "Full DMA Rollout Deposit",
    priceZAR: 9999,
    cadence: "deposit",
    domain: "WATER" as Domain,
    primitive: "ENVIRONMENT" as Primitive,
    blurb: "14km DMA chamber boundary. Proof bundle .ZIP for municipal auditors.",
  },
] as const;
