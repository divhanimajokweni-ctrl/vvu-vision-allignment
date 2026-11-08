import { NextRequest, NextResponse } from "next/server";
import {
  ConflictError,
  attachWitness,
  getDevices,
  registerDevice,
} from "@/skylantern/server/service";
import type { RegisterDeviceRequest } from "@/skylantern/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const devices = await getDevices();
  return NextResponse.json({ devices, count: devices.length });
}

export async function POST(req: NextRequest) {
  let body: RegisterDeviceRequest;
  try {
    body = (await req.json()) as RegisterDeviceRequest;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }
  if (
    !body.externalId ||
    !body.label ||
    !body.domain ||
    !body.primitive ||
    body.lat === undefined ||
    body.lng === undefined
  ) {
    return NextResponse.json(
      {
        error:
          "externalId, label, domain, primitive, lat, lng are required.",
      },
      { status: 400 }
    );
  }
  try {
    const device = await registerDevice(body);
    return NextResponse.json({ device }, { status: 201 });
  } catch (e) {
    if (e instanceof ConflictError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}

// Attach a witness through a dedicated path as well (kept for clarity in the UI).
export async function PATCH(req: NextRequest) {
  let body: {
    evidenceId: string;
    witnessType: "WEARABLE" | "GNSS" | "SECOND_DEVICE" | "OPERATOR";
    witnessLabel: string;
    witnessKeyHint?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }
  try {
    const evidence = await attachWitness(body);
    return NextResponse.json({ evidence });
  } catch (e) {
    if (e instanceof ConflictError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
