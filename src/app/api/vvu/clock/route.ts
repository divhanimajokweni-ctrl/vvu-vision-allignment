import { NextResponse } from 'next/server';
import { readFile, writeFile, rename, mkdir } from 'fs/promises';
import path from 'path';
import { appendWormEvent } from '@/lib/vvu-ledger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DATA_DIR = path.join(process.cwd(), 'docs', 'data');
const CLOCK_P = path.join(DATA_DIR, 'clock.json');

const ENVS = new Set(['dev-spreadsheet', 'production-dashboard']);

async function readClock() {
  try {
    const raw = await readFile(CLOCK_P, 'utf8');
    const parsed = JSON.parse(raw);
    if (
      typeof parsed.revision !== 'number' ||
      typeof parsed.current_utc !== 'string'
    ) {
      throw new Error('malformed clock record');
    }
    return { ok: true as const, clock: parsed };
  } catch (err) {
    return { ok: false as const, error: 'CLOCK_UNREACHABLE', detail: String(err) };
  }
}

export async function GET() {
  const r = await readClock();
  if (!r.ok) {
    return NextResponse.json(
      { ok: false, error: r.error, detail: r.detail },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }
  return NextResponse.json(
    { ok: true, ...r.clock },
    { headers: { 'cache-control': 'no-store' } },
  );
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.by !== 'string' || !ENVS.has(body.by)) {
    return NextResponse.json(
      { ok: false, error: 'expected { by: "dev-spreadsheet" | "production-dashboard" }' },
      { status: 400 },
    );
  }
  const r = await readClock();
  if (!r.ok) {
    return NextResponse.json(
      { ok: false, error: r.error, detail: r.detail },
      { status: 503 },
    );
  }
  const now = new Date().toISOString();
  const next = {
    ...r.clock,
    revision: r.clock.revision + 1,
    current_utc: now,
    last_written_by: body.by,
    last_written_at_utc: now,
  };
  await mkdir(DATA_DIR, { recursive: true });
  // R171 · THE ATOMIC ADVANCE: write to a sibling temp file and rename
  // — rename is atomic on POSIX, so a concurrent GET can never catch a
  // half-written clock (a torn read is the one lie the revision law
  // cannot reason about; the rename closes it at the filesystem). The
  // WORM chain still seals every advance either way.
  const tmp = `${CLOCK_P}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(next, null, 2) + '\n', 'utf8');
  await rename(tmp, CLOCK_P);
  // WORM-seal the advance into the estate's existing hash chain. The
  // house's appendWormEvent speaks { source, event, details } with a
  // semantic uppercase source — 'CLOCK' is this chain's first-class
  // citizen, CLOCK_ADVANCED its event, the details the receipt body.
  let wormId: string | undefined;
  try {
    const entry = await appendWormEvent({
      source: 'CLOCK',
      event: 'CLOCK_ADVANCED',
      details: JSON.stringify({
        by: body.by,
        from_revision: r.clock.revision,
        to_revision: next.revision,
        at: now,
      }),
    });
    wormId = entry.id;
  } catch {
    wormId = undefined; // honest: the advance stands (the file is written); the receipt failed and says so by its absence
  }
  return NextResponse.json({ ok: true, worm_id: wormId, ...next }, { status: 200 });
}
