import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/bridge/pair — initialise a vault-bridge pairing session.
// The caller passes its OWN live origin (window.location.origin from the
// browser) — the QR payload embeds it so the phone-side Obsidian plugin
// connects back to whatever origin the dashboard is actually served from.
// No URL is ever invented here. Returns the obsidian:// QR payload plus a
// server-rendered QR PNG (data URL) for the pairing card.
const BRIDGE = 'http://127.0.0.1:3004';

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
    const res = await fetch(`${BRIDGE}/api/pair/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin }),
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json({ error: `bridge pair-init HTTP ${res.status}` }, { status: 502 });
    }
    const data = (await res.json()) as {
      pairingId: string;
      token: string;
      qrPayload: string;
      expiresAt: string;
    };
    // QR renders the obsidian:// URI — scanning it with the phone camera
    // opens Obsidian and hands the pairing token to the plugin.
    const qrDataUrl = await QRCode.toDataURL(data.qrPayload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
      color: { dark: '#060806', light: '#f3e38a' },
    });
    return NextResponse.json({ ...data, qrDataUrl }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'vault-bridge unreachable (is mini-service :3004 running?)' },
      { status: 502 },
    );
  }
}
