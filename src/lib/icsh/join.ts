// src/lib/icsh/join.ts — THE UNIVERSAL JOIN PATH (TOTP · RFC 6238).
// JOIN METHOD modal → LOCATE → SCAN → CONSENT → VERIFY → RECEIPT.
// A successful verify writes a JOIN_COMMITTED event to the WORM chain and
// mints the farmer's receipt code (E965B01E-style). The receipt proves
// inclusion, not consensus — that line ships with every receipt.

import { db } from '@/lib/db';
import { appendWormEvent, sha256 } from '@/lib/vvu-ledger';
import { ICSH_DISTRICTS } from './contract';
import { generateTotpSecret, otpauthUri, verifyTotp } from './totp';
import type { IcshJoinReceipt, IcshJoinSetup } from './types';
import { ensureIcshGenesis } from './engine';

export type JoinOutcome =
  | { ok: true; setup: IcshJoinSetup }
  | { ok: false; error: string; status: number };

export async function joinSetup(callsignRaw: string, farmRaw: string, districtRaw: string): Promise<JoinOutcome> {
  const callsign = callsignRaw.trim().toUpperCase();
  const farm = farmRaw.trim();
  const district = districtRaw.trim().toUpperCase();

  if (!/^[A-Z0-9_]{2,24}$/.test(callsign)) {
    return { ok: false, error: 'CALLSIGN: 2–24 chars, A–Z 0–9 _ (e.g. EDGE_GQ_MKONDO)', status: 400 };
  }
  if (farm.length < 2 || farm.length > 48) {
    return { ok: false, error: 'FARM: 2–48 characters', status: 400 };
  }
  if (!(ICSH_DISTRICTS as readonly string[]).includes(district)) {
    return { ok: false, error: `DISTRICT: pick one of ${ICSH_DISTRICTS.join(' · ')}`, status: 400 };
  }

  await ensureIcshGenesis();

  const active = await db.icshNode.findFirst({ where: { callsign, status: 'ACTIVE' } });
  if (active) {
    return { ok: false, error: `CALLSIGN ${callsign} ALREADY COMMITTED ON CHAIN (seq-included at join)`, status: 409 };
  }

  const secret = generateTotpSecret();
  const existing = await db.icshNode.findFirst({ where: { callsign, status: 'PENDING' } });
  const node = existing
    ? await db.icshNode.update({ where: { id: existing.id }, data: { farm, district, totpSecret: secret } })
    : await db.icshNode.create({ data: { callsign, farm, district, totpSecret: secret } });

  const worm = await appendWormEvent({
    source: 'ICSH',
    event: 'ENROLMENT_OPEN',
    details: `${callsign} · farm "${farm}" · ${district} · TOTP enrolment opened (RFC 6238 · no receipt yet — inclusion not proven)`,
  });

  return {
    ok: true,
    setup: {
      ok: true,
      nodeId: node.id,
      callsign,
      secret,
      otpauth: otpauthUri(callsign, secret),
      wormSeq: worm.seq,
    },
  };
}

export type VerifyOutcome =
  | { ok: true; receipt: IcshJoinReceipt }
  | { ok: false; error: string; status: number };

export async function joinVerify(nodeId: string, code: string): Promise<VerifyOutcome> {
  const node = await db.icshNode.findUnique({ where: { id: nodeId } });
  if (!node) return { ok: false, error: 'ENROLMENT NOT FOUND — run LOCATE again', status: 404 };
  if (node.status === 'ACTIVE') {
    return { ok: false, error: `${node.callsign} IS ALREADY COMMITTED — receipt ${node.joinCode ?? '—'}`, status: 409 };
  }

  if (!verifyTotp(node.totpSecret, code)) {
    return { ok: false, error: 'CODE REJECTED — authenticators rotate every 30 s; try the current code (window ±1 step)', status: 401 };
  }

  const joinCode = sha256(`${node.callsign}|${node.farm}|${node.district}|${node.totpSecret}`).slice(0, 8).toUpperCase();
  const committed = await appendWormEvent({
    source: 'ICSH',
    event: 'JOIN_COMMITTED',
    details: JSON.stringify({ callsign: node.callsign, farm: node.farm, district: node.district, join_code: joinCode }),
  });
  const now = new Date();
  await db.icshNode.update({
    where: { id: node.id },
    data: { status: 'ACTIVE', joinCode, joinedAt: now },
  });
  const activeCount = await db.icshNode.count({ where: { status: 'ACTIVE' } });

  return {
    ok: true,
    receipt: {
      ok: true,
      callsign: node.callsign,
      farm: node.farm,
      district: node.district,
      joinCode,
      wormSeq: committed.seq,
      hash: committed.hash,
      nodeCount: activeCount,
      joinedAt: now.toISOString(),
      honesty: [
        'This receipt proves inclusion, not consensus.',
        'Absent: no canonical tags, no external anchor, no farmer\u2019s phone on the map.',
        'TOTP verified (RFC 6238 · SHA1 · 30 s · ±1 step) — the estate holds no passwords.',
      ],
    },
  };
}
