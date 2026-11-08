/**
 * @license
 * VVU EARTH TECH ⚙ - REA Plugin API proxy
 * Copyright (c) 2026 Venture Vision Ubuntu
 *
 * Forwards REA scan requests from the dashboard to the REA mini-service
 * on port 3034. The gateway (Caddy) rewrites the port based on the
 * XTransformPort query param.
 *
 * GET  /api/rea/healthz       → proxy to :3034/healthz
 * GET  /api/rea/artifacts     → proxy to :3034/artifacts
 * GET  /api/rea/artifacts/:h  → proxy to :3034/artifacts/:h
 * POST /api/rea/scan          → proxy to :3034/scan
 */

import { NextRequest, NextResponse } from "next/server";

const REA_PORT = "3034";
const REA_BASE = `http://localhost:${REA_PORT}`;

async function proxy(req: NextRequest, path: string): Promise<NextResponse> {
  const url = new URL(req.url);
  const target = new URL(path, REA_BASE);
  // Forward query params (except XTransformPort)
  for (const [k, v] of url.searchParams.entries()) {
    if (k !== "XTransformPort") target.searchParams.set(k, v);
  }

  const headers: Record<string, string> = {
    "content-type": req.headers.get("content-type") ?? "application/json",
  };

  try {
    const res = await fetch(target, {
      method: req.method,
      headers,
      body: req.method !== "GET" && req.method !== "HEAD" ? await req.text() : undefined,
    });
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") ?? "application/json",
        "access-control-allow-origin": "*",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "rea-unreachable", detail: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  const pathStr = path ? path.join("/") : "healthz";
  return proxy(req, `/${pathStr}`);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  const pathStr = path ? path.join("/") : "scan";
  return proxy(req, `/${pathStr}`);
}
