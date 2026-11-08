/**
 * Skylantern — demo seed.
 *
 * Seeds three pilot domains across Johannesburg CBD:
 *   - Water (DMA chamber flow meters)
 *   - Cellphone (BLE tether pods)
 *   - Vehicle (OBD-II dongles)
 *
 * Releases a handful of sky lanterns (evidence records) so the digital twin
 * renders with realistic data on first load. Idempotent — safe to run twice.
 */

import { db } from "@/lib/db";
import type {
  Domain,
  ObservedFact,
  Primitive,
} from "../types";
import { submitEvidence } from "./service";
import { registerDevice } from "./service";

interface SeedDevice {
  externalId: string;
  label: string;
  domain: Domain;
  primitive: Primitive;
  lat: number;
  lng: number;
  firmwareVersion: string;
  pricingBand: string;
}

// Cluster around Johannesburg CBD / Braamfontein / Hillbrow / Newtown.
const SEED_DEVICES: SeedDevice[] = [
  // Water — DMA chamber flow meters along the Brixton / Braamfontein spur.
  {
    externalId: "FLOW-8x4428",
    label: "Brixton DMA Chamber 14km",
    domain: "WATER",
    primitive: "STATE",
    lat: -26.1833,
    lng: 28.0014,
    firmwareVersion: "vvu-flow-firmware/2.3.1",
    pricingBand: "Water Pilot Unit (R999/90d)",
  },
  {
    externalId: "FLOW-8x4501",
    label: "Braamfontein Riser Valve",
    domain: "WATER",
    primitive: "ENVIRONMENT",
    lat: -26.1925,
    lng: 28.0379,
    firmwareVersion: "vvu-flow-firmware/2.3.1",
    pricingBand: "Water Pilot Unit (R999/90d)",
  },
  {
    externalId: "FLOW-8x4519",
    label: "Hillbrow Pressure Sentinel",
    domain: "WATER",
    primitive: "ENVIRONMENT",
    lat: -26.1908,
    lng: 28.0475,
    firmwareVersion: "vvu-flow-firmware/2.4.0-rc1",
    pricingBand: "Water Pilot Unit (R999/90d)",
  },
  // Cellphone — BLE tether pods.
  {
    externalId: "BLE-POD-77c1",
    label: "Consumer Phone Pod (Sandton)",
    domain: "CELLPHONE",
    primitive: "PROXIMITY",
    lat: -26.1076,
    lng: 28.0567,
    firmwareVersion: "vvu-ble-firmware/1.8.4",
    pricingBand: "Phone Pilot (R25/mo)",
  },
  {
    externalId: "BLE-POD-77c2",
    label: "Consumer Phone Pod (Rosebank)",
    domain: "CELLPHONE",
    primitive: "PROXIMITY",
    lat: -26.1444,
    lng: 28.0408,
    firmwareVersion: "vvu-ble-firmware/1.8.4",
    pricingBand: "Phone Pilot (R25/mo)",
  },
  // Vehicle — OBD-II dongles.
  {
    externalId: "OBD-VIN-1G1JF52W",
    label: "Fleet Vehicle — Sandton Route 47",
    domain: "VEHICLE",
    primitive: "STATE",
    lat: -26.0925,
    lng: 28.0571,
    firmwareVersion: "vvu-can-firmware/3.0.0",
    pricingBand: "Fleet Evidence Log (R250/mo)",
  },
  {
    externalId: "OBD-VIN-1G1JC544",
    label: "Fleet Vehicle — CBD Loop",
    domain: "VEHICLE",
    primitive: "PROXIMITY",
    lat: -26.2052,
    lng: 28.0441,
    firmwareVersion: "vvu-can-firmware/3.0.0",
    pricingBand: "Vehicle Hijack Alert (R199/mo)",
  },
];

interface SeedLantern {
  deviceExternalId: string;
  observedFact: ObservedFact;
  derivedEventInference?: string;
  decisionAction?: string;
  observedAt?: Date;
}

const NOW = Date.now();
const MIN = 60 * 1000;

const SEED_LANTERNS: SeedLantern[] = [
  {
    deviceExternalId: "FLOW-8x4428",
    observedFact: {
      value: 12.5,
      unit: "L/s",
      primitive: "STATE",
      raw: "FLOW=12.5;VALVE=OPEN",
    },
    derivedEventInference: "Normal flow within tolerance band.",
    decisionAction: "No action — log baseline.",
    observedAt: new Date(NOW - 2 * MIN),
  },
  {
    deviceExternalId: "FLOW-8x4501",
    observedFact: {
      value: -1.2,
      unit: "bar/4min",
      primitive: "ENVIRONMENT",
      raw: "P_DELTA=-1.2bar;WINDOW=240s",
    },
    derivedEventInference: "Leak-Candidate Flagged.",
    decisionAction: "Maintenance alert SMS dispatched.",
    observedAt: new Date(NOW - 9 * MIN),
  },
  {
    deviceExternalId: "FLOW-8x4519",
    observedFact: {
      value: 8.4,
      unit: "bar",
      primitive: "ENVIRONMENT",
      raw: "P=8.4bar;T=18.7C",
    },
    derivedEventInference: "Pressure within nominal band.",
    decisionAction: "No action.",
    observedAt: new Date(NOW - 14 * MIN),
  },
  {
    deviceExternalId: "BLE-POD-77c1",
    observedFact: {
      value: true,
      unit: "tether",
      primitive: "PROXIMITY",
      raw: "BLE_HANDSHAKE=OK;RSSI=-58dBm",
    },
    derivedEventInference: "Phone in proximity — tether intact.",
    decisionAction: "No action.",
    observedAt: new Date(NOW - 3 * MIN),
  },
  {
    deviceExternalId: "BLE-POD-77c2",
    observedFact: {
      value: false,
      unit: "tether",
      primitive: "PROXIMITY",
      raw: "BLE_HANDSHAKE=LOST;LAST_SEEN=18s",
    },
    derivedEventInference: "Theft Inference — tether broken.",
    decisionAction: "Device brick & beacon dispatched.",
    observedAt: new Date(NOW - 7 * MIN),
  },
  {
    deviceExternalId: "OBD-VIN-1G1JF52W",
    observedFact: {
      value: "DOOR_CLOSED+ENGINE_ON",
      unit: "enum",
      primitive: "STATE",
      raw: "CAN:DOOR=0;ENG=1;WHEEL=0",
    },
    derivedEventInference: "Vehicle stationary, engine idling.",
    decisionAction: "No action.",
    observedAt: new Date(NOW - 4 * MIN),
  },
  {
    deviceExternalId: "OBD-VIN-1G1JC544",
    observedFact: {
      value: "PHONE_ABSENT+MOTION_PRESENT",
      unit: "enum",
      primitive: "PROXIMITY",
      raw: "CAN:PHONE=0;WHEEL=1;VIN=1G1JC544",
    },
    derivedEventInference: "Hijack Indicator — phone absent + motion present.",
    decisionAction: "Tamper-evident record logged for insurers/response.",
    observedAt: new Date(NOW - 11 * MIN),
  },
  {
    deviceExternalId: "FLOW-8x4428",
    observedFact: {
      value: 13.1,
      unit: "L/s",
      primitive: "STATE",
      raw: "FLOW=13.1;VALVE=OPEN",
    },
    derivedEventInference: "Slight increase — within tolerance.",
    decisionAction: "No action.",
    observedAt: new Date(NOW - 1 * MIN),
  },
];

export async function seedSkylantern(opts?: { force?: boolean }): Promise<{
  devicesSeeded: number;
  lanternsSeeded: number;
  witnessesAttached: number;
}> {
  let devicesSeeded = 0;
  let lanternsSeeded = 0;
  let witnessesAttached = 0;

  // Idempotency: only seed if the chain is empty, unless forced.
  const existing = await db.device.count();
  if (existing > 0 && !opts?.force) {
    return { devicesSeeded: 0, lanternsSeeded: 0, witnessesAttached: 0 };
  }

  for (const d of SEED_DEVICES) {
    try {
      await registerDevice(d);
      devicesSeeded += 1;
    } catch {
      // Device already exists — skip.
    }
  }

  for (const l of SEED_LANTERNS) {
    try {
      const evidence = await submitEvidence({
        deviceExternalId: l.deviceExternalId,
        observedFact: l.observedFact,
        derivedEvent: l.derivedEventInference
          ? {
              inference: l.derivedEventInference,
              firmwareVersion: "vvu-demo/seed-v1",
            }
          : null,
        decision: l.decisionAction
          ? { action: l.decisionAction, status: "EXECUTED" }
          : null,
        observedAt: l.observedAt?.toISOString(),
      });
      lanternsSeeded += 1;

      // Attach a second witness to ~40% of records to demonstrate VERIFIED state.
      if (lanternsSeeded % 3 === 0) {
        try {
          await attachWitnessFromSeed(evidence.id);
          witnessesAttached += 1;
        } catch {
          // skip
        }
      }
    } catch (e) {
      console.warn("[skylantern] seed lantern failed", e);
    }
  }

  return { devicesSeeded, lanternsSeeded, witnessesAttached };
}

async function attachWitnessFromSeed(evidenceId: string) {
  const { attachWitness } = await import("./service");
  await attachWitness({
    evidenceId,
    witnessType: "GNSS",
    witnessLabel: "External GNSS Anchor — Johannesburg CBD",
    witnessKeyHint: "gnss-zed-f9p-0a3c",
  });
}
