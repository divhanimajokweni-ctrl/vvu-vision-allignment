import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/field/pair — initialise a VVU field-onboarding pairing session
// (Task 37 — the :3005 re-skin of the verified :3004 payment rail).
// The caller passes its OWN live origin (window.location.origin from the
// browser) — the QR payload embeds it so the phone-side Obsidian plugin
// connects back to whatever origin the dashboard is actually served from.
// No URL is ever invented here. Returns the obsidian://vvu-onboard QR
// payload (bootstrap only — one-time nonce, NOT a long-lived credential)
// plus a server-rendered QR PNG (data URL) for the field pairing card.
const FIELD = 'http://127.0.0.1:3005';

export async function POST(req: NextRequest) {
  let origin: string | undefined;
  try {
    const body = (await req.json()) as { origin?: string };
    origin = body.origin;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!origin || !/^https?:\/\//.test(origin)) {
    return NextResponse.json({ error: 'origin required (http/https)' }, { status: 400 });
  }

  try {
    const res = await fetch(`${FIELD}/api/pair/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin }),
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json({ error: `field pair-init HTTP ${res.status}` }, { status: 502 });
    }
    const data = (await res.json()) as {
      pairingId: string;
      nonce: string;
      node: string;
      protocol: string;
      qrPayload: string;
      qrJson: { endpoint: string; nonce: string; expiry: number; node: string; protocol: string };
      expiresAt: string;
      qrExpiresAt: string;
    };
    // QR renders the obsidian://vvu-onboard URI — scanning it with the phone
    // camera opens Obsidian and hands the one-time nonce to the plugin.
    const qrDataUrl = await QRCode.toDataURL(data.qrPayload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
      color: { dark: '#060806', light: '#c8ff00' }, // field-poster lime
    });
    return NextResponse.json({ ...data, qrDataUrl }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'vvu-field-onboard unreachable (is mini-service :3005 running?)' },
      { status: 502 },
    );
  }
}
