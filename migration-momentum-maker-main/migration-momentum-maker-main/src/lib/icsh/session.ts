// src/lib/icsh/session.ts — THE SESSION LAB (Task 50 · 14:39).
// The session layer on top of the join path: multi-user concurrent 2FA PWA
// logins. Every TOTP login mints a 15-minute session (SESSION_MINTED on the
// WORM chain), every revocation is a SESSION_REVOKED event, every rejection
// a LOGIN_REJECTED event. The phone grid displays what Google Authenticator
// would show — codes are computed server-side from each node's on-chain
// secret, so a REAL phone paired via the QR shows the SAME code as the
// simulated screen.
//
// Honesty: this surface verifies the join + session machinery (HMAC-SHA1
// RFC 6238 server-side, window ±1 step), not consensus.

import { db } from '@/lib/db';
import { appendWormEvent, sha256 } from '@/lib/vvu-ledger';
import { otpauthUri, totpAt } from './totp';
import { joinSetup } from './join';
import type {
  IcshLoginOutcome,
  IcshPhoneTick,
  IcshSessionQr,
  IcshSessionRow,
  IcshSessionTick,
} from './types';

export const SESSION_TTL_MS = 15 * 60_000;
export const SESSION_TTL_MIN = 15;

/** The demo worker cohort — created through the REAL joinSetup path (each
 *  member gets an ENROLMENT_OPEN event on chain) the first time the session
 *  lab opens. Idempotent per callsign; the operator's own joins mix in. */
const COHORT: { callsign: string; farm: string; district: string }[] = [
  { callsign: 'FIELD_WORKER_PAARL_01', farm: 'Paarl Vineyard Co-op', district: 'WESTERN CAPE' },
  { callsign: 'EDGE_GQ_NDLUVU', farm: 'Ndlovu Boerdery', district: 'MPUMALANGA' },
  { callsign: 'EDGE_GQ_VANDYK', farm: 'Van Dyk Greenhouses', district: 'WESTERN CAPE' },
  { callsign: 'EDGE_GQ_KHUMALO', farm: 'Khumalo Family Farm', district: 'KWAZULU-NATAL' },
  { callsign: 'EDGE_GQ_MOFYA', farm: 'Mofya Cooperative', district: 'LIMPOPO' },
];

let cohortEnsured = false;

export async function ensureSessionCohort(): Promise<number> {
  if (cohortEnsured) return 0;
  let created = 0;
  for (const m of COHORT) {
    const existing = await db.icshNode.findFirst({ where: { callsign: m.callsign } });
    if (existing) continue;
    const out = await joinSetup(m.callsign, m.farm, m.district);
    if (out.ok) created++;
  }
  cohortEnsured = true;
  return created;
}

/** RFC 6238 verify with drift attribution — returns the matched step offset
 *  (−1 | 0 | +1) or null. Same window order as verifyTotp: [0, −1, +1]. */
function verifyWithDrift(secret: string, code: string, nowMs = Date.now()): number | null {
  const cleaned = code.replace(/\D/g, '');
  if (cleaned.length !== 6) return null;
  for (const drift of [0, -1, 1]) {
    if (totpAt(secret, nowMs, drift) === cleaned) return drift;
  }
  return null;
}

type SessionDbRow = {
  id: string;
  nodeId: string;
  callsign: string;
  code: string;
  totpCode: string;
  drift: number;
  wormSeq: number;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
};

function serializeSession(
  row: SessionDbRow,
  node: { farm: string; district: string; tier: string } | null
): IcshSessionRow {
  return {
    id: row.id,
    code: row.code,
    nodeId: row.nodeId,
    callsign: row.callsign,
    farm: node?.farm ?? '—',
    district: node?.district ?? '—',
    tier: node?.tier ?? '—',
    totpCode: row.totpCode,
    drift: row.drift,
    wormSeq: row.wormSeq,
    mintedAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}

/* ── the phone-grid heartbeat ─────────────────────────────────────────────── */

export async function sessionTick(): Promise<IcshSessionTick> {
  await ensureSessionCohort();
  const now = new Date();
  const nowMs = now.getTime();
  const [nodes, sessions, tip] = await Promise.all([
    db.icshNode.findMany({ orderBy: { createdAt: 'asc' } }),
    db.icshSession.findMany({
      where: { revokedAt: null, expiresAt: { gt: now } },
      orderBy: { expiresAt: 'asc' },
    }),
    db.wormEvent.findFirst({ orderBy: { seq: 'desc' } }),
  ]);

  const byNode = new Map<string, { count: number; until: Date }>();
  for (const s of sessions) {
    const cur = byNode.get(s.nodeId);
    if (!cur) byNode.set(s.nodeId, { count: 1, until: s.expiresAt });
    else {
      cur.count++;
      if (s.expiresAt < cur.until) cur.until = s.expiresAt;
    }
  }

  const phones: IcshPhoneTick[] = nodes.map((n) => {
    const sess = byNode.get(n.id);
    return {
      nodeId: n.id,
      callsign: n.callsign,
      farm: n.farm,
      district: n.district,
      tier: n.tier,
      trust: n.trust,
      status: n.status as IcshPhoneTick['status'],
      joinCode: n.joinCode,
      code: totpAt(n.totpSecret, nowMs),
      secondsRemaining: 30 - (Math.floor(nowMs / 1000) % 30),
      activeSessions: sess?.count ?? 0,
      sessionUntil: sess ? sess.until.toISOString() : null,
    };
  });

  return {
    at: now.toISOString(),
    head: tip?.hash ?? '',
    phones,
    stats: {
      phones: nodes.length,
      pending: nodes.filter((n) => n.status === 'PENDING').length,
      active: nodes.filter((n) => n.status === 'ACTIVE').length,
      blocked: nodes.filter((n) => n.status === 'BLOCKED').length,
      sessions: sessions.length,
      ttlMin: SESSION_TTL_MIN,
    },
  };
}

/* ── LOGIN — the real verify path + session mint ──────────────────────────── */

export async function sessionLogin(nodeId: string, code: string): Promise<IcshLoginOutcome> {
  const t0 = performance.now();
  const ms = () => Math.round((performance.now() - t0) * 10) / 10;

  const node = await db.icshNode.findUnique({ where: { id: nodeId } });
  if (!node) {
    return { ok: false, error: 'NODE NOT FOUND — refresh the phone grid', status: 404, serverMs: ms() };
  }

  if (node.status === 'BLOCKED') {
    await appendWormEvent({
      source: 'ICSH',
      event: 'LOGIN_REJECTED',
      details: `${node.callsign} · node BLOCKED · no session minted (POPIA s11 revocation honoured)`,
    });
    return {
      ok: false,
      error: `${node.callsign} IS BLOCKED — consent revoked; re-enrol via JOIN METHOD`,
      status: 403,
      serverMs: ms(),
    };
  }

  const cleaned = code.replace(/\D/g, '');
  const drift = verifyWithDrift(node.totpSecret, cleaned);
  if (drift === null) {
    await appendWormEvent({
      source: 'ICSH',
      event: 'LOGIN_REJECTED',
      details: `${node.callsign} · TOTP rejected (RFC 6238 · window ±1 step) · no session minted`,
    });
    return {
      ok: false,
      error: 'CODE REJECTED — authenticators rotate every 30 s; window ±1 step',
      status: 401,
      serverMs: ms(),
    };
  }

  // A PENDING node's first successful login completes the join — the same
  // commit the wizard performs (JOIN_COMMITTED on chain, receipt minted).
  let joined = false;
  let joinCode = node.joinCode;
  if (node.status === 'PENDING') {
    joinCode = sha256(`${node.callsign}|${node.farm}|${node.district}|${node.totpSecret}`)
      .slice(0, 8)
      .toUpperCase();
    await appendWormEvent({
      source: 'ICSH',
      event: 'JOIN_COMMITTED',
      details: JSON.stringify({
        callsign: node.callsign,
        farm: node.farm,
        district: node.district,
        join_code: joinCode,
        via: 'SESSION_LAB_PHONE_LOGIN',
      }),
    });
    await db.icshNode.update({
      where: { id: node.id },
      data: { status: 'ACTIVE', joinCode, joinedAt: new Date() },
    });
    joined = true;
  }

  const sessionCode = `S-${sha256(`${node.callsign}|${node.totpSecret}|${Date.now()}|${cleaned}`)
    .slice(0, 6)
    .toUpperCase()}`;
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const worm = await appendWormEvent({
    source: 'ICSH',
    event: 'SESSION_MINTED',
    details: JSON.stringify({
      callsign: node.callsign,
      session_code: sessionCode,
      drift,
      totp: cleaned,
      ttl_min: SESSION_TTL_MIN,
      expires: expiresAt.toISOString(),
    }),
  });
  const row = await db.icshSession.create({
    data: {
      nodeId: node.id,
      callsign: node.callsign,
      code: sessionCode,
      totpCode: cleaned,
      drift,
      wormSeq: worm.seq,
      expiresAt,
    },
  });
  const activeSessions = await db.icshSession.count({
    where: { nodeId: node.id, revokedAt: null, expiresAt: { gt: new Date() } },
  });

  return {
    ok: true,
    joined,
    joinCode,
    session: serializeSession(row, node),
    activeSessions,
    serverMs: ms(),
  };
}

/* ── active sessions + revocation ─────────────────────────────────────────── */

export async function sessionsActive(): Promise<IcshSessionRow[]> {
  const now = new Date();
  const rows = await db.icshSession.findMany({
    where: { revokedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: 'desc' },
  });
  if (rows.length === 0) return [];
  const nodes = await db.icshNode.findMany();
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  return rows.map((r) => serializeSession(r, nodeById.get(r.nodeId) ?? null));
}

export async function sessionRevoke(sessionId: string): Promise<{ ok: boolean; error?: string }> {
  const row = await db.icshSession.findUnique({ where: { id: sessionId } });
  if (!row || row.revokedAt || row.expiresAt <= new Date()) {
    return { ok: false, error: 'SESSION NOT ACTIVE' };
  }
  await appendWormEvent({
    source: 'ICSH',
    event: 'SESSION_REVOKED',
    details: JSON.stringify({
      callsign: row.callsign,
      session_code: row.code,
      worm_seq_mint: row.wormSeq,
    }),
  });
  await db.icshSession.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
  return { ok: true };
}

export async function sessionRevokeAll(): Promise<{ revoked: number }> {
  const rows = await db.icshSession.findMany({
    where: { revokedAt: null, expiresAt: { gt: new Date() } },
  });
  for (const row of rows) {
    await appendWormEvent({
      source: 'ICSH',
      event: 'SESSION_REVOKED',
      details: JSON.stringify({
        callsign: row.callsign,
        session_code: row.code,
        worm_seq_mint: row.wormSeq,
        bulk: true,
      }),
    });
    await db.icshSession.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
  }
  return { revoked: rows.length };
}

/* ── QR pairing — expose a PENDING node's secret for a real phone ─────────── */

export async function sessionQr(
  nodeId: string
): Promise<IcshSessionQr | { ok: false; error: string; status: number }> {
  const node = await db.icshNode.findUnique({ where: { id: nodeId } });
  if (!node) return { ok: false, error: 'NODE NOT FOUND', status: 404 };
  if (node.status === 'ACTIVE') {
    return {
      ok: false,
      error: `${node.callsign} IS ALREADY BOUND — secret not re-exposed; re-enrol via JOIN METHOD for a fresh secret`,
      status: 409,
    };
  }
  if (node.status === 'BLOCKED') {
    return { ok: false, error: `${node.callsign} IS BLOCKED — consent revoked`, status: 403 };
  }
  return {
    ok: true,
    nodeId: node.id,
    callsign: node.callsign,
    secret: node.totpSecret,
    otpauth: otpauthUri(node.callsign, node.totpSecret),
  };
}
