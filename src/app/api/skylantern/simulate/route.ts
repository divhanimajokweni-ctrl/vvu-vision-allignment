import { NextRequest, NextResponse } from "next/server";
import { submitEvidence } from "@/skylantern/server/service";
import type {
  Domain,
  ObservedFact,
  Primitive,
} from "@/skylantern/types";
import { PRIMITIVE_DEFINITIONS } from "@/skylantern/primitives";

export const dynamic = "force-dynamic";

/**
 * POST /api/skylantern/simulate
 *
 * Releases a synthetic sky lantern from a randomly-picked registered device,
 * exercising the full 4-layer stack (sensor -> crypto -> WORM -> app).
 * Used by the dashboard's "Auto-release demo lantern" button.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    deviceExternalId?: string;
    domain?: Domain;
  };

  const deviceList = await fetchDeviceList();
  if (deviceList.length === 0) {
    return NextResponse.json(
      { error: "No devices registered. Call /api/skylantern/seed first." },
      { status: 409 }
    );
  }

  const candidates = body.deviceExternalId
    ? deviceList.filter((d) => d.externalId === body.deviceExternalId)
    : body.domain
    ? deviceList.filter((d) => d.domain === body.domain)
    : deviceList;
  const device =
    candidates[Math.floor(Math.random() * candidates.length)] ??
    deviceList[0];

  const observedFact = synthesizeFact(device.primitive as Primitive, device.domain as Domain);
  const evidence = await submitEvidence({
    deviceExternalId: device.externalId,
    observedFact,
    derivedEvent: {
      inference: pickInference(device.primitive as Primitive, observedFact),
      firmwareVersion: device.firmwareVersion ?? "vvu-sim/1.0.0",
    },
    decision: {
      action: pickAction(observedFact),
      status: "EXECUTED",
    },
  });

  return NextResponse.json({ evidence, device }, { status: 201 });
}

async function fetchDeviceList() {
  const { getDevices } = await import("@/skylantern/server/service");
  return getDevices();
}

function synthesizeFact(primitive: Primitive, domain: Domain): ObservedFact {
  const def = PRIMITIVE_DEFINITIONS[primitive];
  switch (primitive) {
    case "MOTION":
      return {
        value: Number((Math.random() * 6 - 1).toFixed(2)),
        unit: def.defaultUnit,
        primitive,
        raw: `accel_xyz=${(Math.random() * 2).toFixed(2)},${(
          Math.random() * 2
        ).toFixed(2)},${(Math.random() * 9.8).toFixed(2)}`,
      };
    case "PROXIMITY":
      return {
        value: Math.random() > 0.6 ? false : true,
        unit: def.defaultUnit,
        primitive,
        raw: `ble_rssi=${-40 - Math.floor(Math.random() * 60)}`,
      };
    case "STATE":
      if (domain === "WATER") {
        return {
          value: Number((Math.random() * 14).toFixed(2)),
          unit: "L/s",
          primitive,
          raw: `FLOW=${(Math.random() * 14).toFixed(2)};VALVE=${
            Math.random() > 0.2 ? "OPEN" : "CLOSED"
          }`,
        };
      }
      return {
        value: Math.random() > 0.5 ? "ENGINE_ON" : "ENGINE_OFF",
        unit: def.defaultUnit,
        primitive,
        raw: `CAN:IGN=${Math.random() > 0.5 ? 1 : 0};DOOR=${
          Math.random() > 0.7 ? 1 : 0
        }`,
      };
    case "IDENTITY":
      return {
        value: `fpr-${Math.random().toString(16).slice(2, 10)}`,
        unit: def.defaultUnit,
        primitive,
        raw: `hw_key_fingerprint=${Math.random()
          .toString(16)
          .slice(2, 18)}`,
      };
    case "LOCATION":
      return {
        value: `${(-26.1 - Math.random() * 0.15).toFixed(4)},${(
          28.0 +
          Math.random() * 0.1
        ).toFixed(4)}`,
        unit: def.defaultUnit,
        primitive,
        raw: `gnss_fix=3D;hdop=${(Math.random() * 2).toFixed(2)}`,
      };
    case "ENVIRONMENT":
      return {
        value: Number((Math.random() * 30 + 5).toFixed(2)),
        unit: def.defaultUnit,
        primitive,
        raw: `T=${(Math.random() * 30 + 5).toFixed(1)}C;H=${(
          Math.random() * 80 +
          20
        ).toFixed(0)}%`,
      };
  }
}

function pickInference(
  primitive: Primitive,
  fact: ObservedFact
): string {
  if (primitive === "PROXIMITY" && fact.value === false) {
    return "Theft Inference — tether broken.";
  }
  if (primitive === "STATE" && typeof fact.value === "number" && fact.value > 12) {
    return "High-usage event flagged.";
  }
  if (primitive === "STATE" && typeof fact.value === "number" && fact.value < 0) {
    return "Leak-Candidate Flagged.";
  }
  if (primitive === "ENVIRONMENT" && typeof fact.value === "number" && fact.value > 35) {
    return "Thermal excursion beyond band.";
  }
  return "Observation within nominal band.";
}

function pickAction(fact: ObservedFact): string {
  if (fact.primitive === "PROXIMITY" && fact.value === false) {
    return "Device brick & beacon dispatched.";
  }
  if (fact.primitive === "STATE" && typeof fact.value === "number" && fact.value < 0) {
    return "Maintenance alert SMS dispatched.";
  }
  return "No action — log baseline.";
}
