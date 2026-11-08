'use client';

// src/lib/wildfire-mesh.ts — client for the consent-gated wildfire mesh
// service (:3006 via the gateway query param — NEVER a hardcoded port).
// File 4 of the 8-file Wildfire Emergency View contract.
//
// One module-level socket, refcounted: React strict-mode double-mounts
// connect/disconnect harmlessly, and the last unmount closes the socket.
// Everything the panels need arrives through this hook:
//   · wildfire.snapshot  → full state on connect
//   · wildfire.fsm / wildfire.consent / wildfire.journal / wildfire.telemetry
//   · client → wildfire.fsm.request / wildfire.consent.request
// The estate-ledger MIRROR (every transition + consent change also appended
// to the main WORM ledger via /api/vvu/ledger) lives here too — the
// evidence rail reports both chains honestly.

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { WildfireFsmState } from '@/lib/wildfire-fsm';

export interface MeshMember {
  id: string;
  callsign: string;
  role: string;
  col: number;
  row: number;
  consent: boolean;
}

export interface MeshNode extends MeshMember {
  sim: true;
}

export interface MeshFsmState {
  state: WildfireFsmState;
  at: string;
  actor: string;
}

export interface MeshJournalEntry {
  seq: number;
  at: string;
  kind: string;
  data: Record<string, unknown>;
  prevHash: string;
  hash: string;
}

export interface MeshTelemetry {
  memberId: string;
  callsign: string;
  col: number;
  row: number;
  windKph: number;
  tempC: number;
  batteryPct: number;
  at: string;
  sim: true;
}

export interface MeshSnapshot {
  fsm: MeshFsmState;
  members: MeshMember[];
  nodes: MeshNode[];
  journalHead: string;
  journalCount: number;
  tier: string;
}

export interface VerifyResult {
  valid: boolean;
  count: number;
  head: string;
  tier: string;
  verifiedAt: string;
}

/* ── singleton socket (refcounted) ─────────────────────────────────── */

interface MeshStore {
  socket: Socket | null;
  refs: number;
}

const store: MeshStore = { socket: null, refs: 0 };

function acquire(): Socket {
  if (!store.socket) {
    // gateway contract: path '/' + XTransformPort in the query — never a
    // hardcoded port, never an absolute URL.
    store.socket = io('/?XTransformPort=3006', {
      transports: ['websocket', 'polling'],
      reconnectionDelayMax: 4000,
    });
  }
  store.refs += 1;
  return store.socket;
}

function release() {
  store.refs -= 1;
  if (store.refs <= 0 && store.socket) {
    store.socket.disconnect();
    store.socket = null;
    store.refs = 0;
  }
}

/* ── estate-ledger mirror ──────────────────────────────────────────── */

export interface MirrorState {
  count: number;
  lastSeq: number | null;
  lastHash: string | null;
  lastEvent: string | null;
  error: string | null;
}

export async function mirrorToEstateLedger(payload: {
  source: string;
  event: string;
  details: string;
}): Promise<{ seq: number; hash: string }> {
  const res = await fetch('/api/vvu/ledger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`MIRROR_HTTP_${res.status}`);
  const body = (await res.json()) as { success: boolean; entry?: { seq: number; hash: string } };
  if (!body.success || !body.entry) throw new Error('MIRROR_REJECTED');
  return { seq: body.entry.seq, hash: body.entry.hash };
}

/* ── the hook ──────────────────────────────────────────────────────── */

const EMPTY_FSM: MeshFsmState = { state: 'NORMAL', at: '', actor: '' };

export function useWildfireMesh() {
  const socketRef = useRef<Socket | null>(null);
  // ref-synced member roster — consent patches need the CURRENT roster, not
  // the first-render closure (the stale-closure bug this ref exists to kill)
  const membersRef = useRef<MeshMember[]>([]);
  const [connected, setConnected] = useState(false);
  const [fsm, setFsm] = useState<MeshFsmState>(EMPTY_FSM);
  const [members, setMembers] = useState<MeshMember[]>([]);
  const [nodes, setNodes] = useState<MeshNode[]>([]);
  const [head, setHead] = useState<string>('');
  const [count, setCount] = useState<number>(0);
  const [tier, setTier] = useState<string>('T0 · LOCAL_SOFTWARE_SHA256_CHAIN');
  const [entries, setEntries] = useState<MeshJournalEntry[]>([]);
  const [telemetry, setTelemetry] = useState<Record<string, MeshTelemetry>>({});
  const [error, setError] = useState<string | null>(null);

  const applyMembers = (next: MeshMember[], nextNodes?: MeshNode[]) => {
    membersRef.current = next;
    setMembers(next);
    // present nodes = consented members ONLY (absent = revoked, never dimmed)
    setNodes(nextNodes ?? next.filter((m) => m.consent).map((m) => ({ ...m, sim: true as const })));
  };

  useEffect(() => {
    const socket = acquire();
    socketRef.current = socket;

    const onSnapshot = (snap: MeshSnapshot) => {
      setFsm(snap.fsm);
      applyMembers(snap.members, snap.nodes);
      setHead(snap.journalHead);
      setCount(snap.journalCount);
      if (snap.tier) setTier(snap.tier);
      setError(null);
    };
    // service broadcast shape (verified against mini-services/wildfire-mesh):
    // wildfire.fsm → { from, to, actor, reason, at, entry }
    const onFsm = (p: { to: WildfireFsmState; at: string; actor: string }) => {
      setFsm({ state: p.to, at: p.at, actor: p.actor });
    };
    // wildfire.consent → { memberId, callsign, grant, actor, at, entry }
    // members are NOT re-broadcast — patch the ref-synced roster and derive
    // nodes from it (no stale closures).
    const onConsent = (p: { memberId: string; grant: boolean }) => {
      applyMembers(
        membersRef.current.map((m) =>
          m.id === p.memberId ? { ...m, consent: p.grant } : m
        )
      );
    };
    const onJournal = (p: { entry: MeshJournalEntry; head: string; count: number }) => {
      setHead(p.head);
      setCount(p.count);
      setEntries((prev) => [p.entry, ...prev].slice(0, 60));
    };
    const onTelemetry = (t: MeshTelemetry) => {
      setTelemetry((prev) => ({ ...prev, [t.memberId]: t }));
    };
    const onErrorEv = (p: { scope: string; message: string }) => {
      setError(`${p.scope.toUpperCase()}: ${p.message}`);
    };
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('wildfire.snapshot', onSnapshot);
    socket.on('wildfire.fsm', onFsm);
    socket.on('wildfire.consent', onConsent);
    socket.on('wildfire.journal', onJournal);
    socket.on('wildfire.telemetry', onTelemetry);
    socket.on('wildfire.error', onErrorEv);

    // REST-prime (also covers the already-connected re-mount case where the
    // service only emits a snapshot on a fresh connection) + journal tail.
    fetchStatus()
      .then((s) => {
        setConnected(true);
        setFsm(s.fsm);
        applyMembers(s.members);
        setHead(s.journalHead);
        setCount(s.journalCount);
        if (s.tier) setTier(s.tier);
      })
      .catch(() => {
        /* offline — the honesty labels show OFFLINE; never fake state */
        setConnected((() => socket.connected)());
      });
    fetchJournalTail(40)
      .then((es) => setEntries(es))
      .catch(() => {
        /* offline — live tail stays empty, honestly */
      });

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('wildfire.snapshot', onSnapshot);
      socket.off('wildfire.fsm', onFsm);
      socket.off('wildfire.consent', onConsent);
      socket.off('wildfire.journal', onJournal);
      socket.off('wildfire.telemetry', onTelemetry);
      socket.off('wildfire.error', onErrorEv);
      socketRef.current = null;
      release();
    };
  }, []);

  /* ── actions (client→service requests; service broadcasts the truth) ── */

  const requestFsm = useCallback(
    (to: WildfireFsmState, actor: string, reason: string) => {
      socketRef.current?.emit('wildfire.fsm.request', { to, actor, reason });
    },
    []
  );

  const requestConsent = useCallback(
    (memberId: string, grant: boolean, actor: string, reason?: string) => {
      socketRef.current?.emit('wildfire.consent.request', { memberId, grant, actor, reason });
    },
    []
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    connected,
    fsm,
    members,
    nodes,
    head,
    count,
    tier,
    entries,
    telemetry,
    error,
    requestFsm,
    requestConsent,
    clearError,
  };
}

/* ── REST helpers (through the gateway query param) ─────────────────── */

const MESH_BASE = '/?XTransformPort=3006';

export interface MeshStatus {
  fsm: MeshFsmState;
  members: MeshMember[];
  journalHead: string;
  journalCount: number;
  tier: string;
  nodesPresent: number;
}

export async function fetchStatus(): Promise<MeshStatus> {
  const res = await fetch('/status?XTransformPort=3006');
  if (!res.ok) throw new Error(`STATUS_HTTP_${res.status}`);
  return (await res.json()) as MeshStatus;
}

export async function fetchJournalTail(limit = 40): Promise<MeshJournalEntry[]> {
  const res = await fetch(`/journal?limit=${limit}&XTransformPort=3006`);
  if (!res.ok) throw new Error(`JOURNAL_HTTP_${res.status}`);
  const body = (await res.json()) as { entries: MeshJournalEntry[] };
  return body.entries ?? [];
}

/* Operator actions go over REST (the response carries the journaled entry
   directly — mirror only what the service actually ACCEPTED). Socket
   broadcasts then update every other viewer. */

export async function postFsmTransition(payload: {
  to: WildfireFsmState;
  actor: string;
  reason: string;
}): Promise<{ ok: true; from: string; to: string; entry: MeshJournalEntry }> {
  const res = await fetch('/fsm?XTransformPort=3006', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(String(body.error ?? `FSM_HTTP_${res.status}`));
  }
  return body as { ok: true; from: string; to: string; entry: MeshJournalEntry };
}

export async function postConsent(payload: {
  memberId: string;
  grant: boolean;
  actor: string;
  reason?: string;
}): Promise<{ ok: true; member: MeshMember; entry: MeshJournalEntry }> {
  const res = await fetch('/consent?XTransformPort=3006', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(String(body.error ?? `CONSENT_HTTP_${res.status}`));
  }
  return body as { ok: true; member: MeshMember; entry: MeshJournalEntry };
}

export async function verifyChain(): Promise<VerifyResult> {
  const res = await fetch('/verify?XTransformPort=3006');
  if (!res.ok) throw new Error(`VERIFY_HTTP_${res.status}`);
  return (await res.json()) as VerifyResult;
}

export const MESH_VERIFY_URL = '/verify?XTransformPort=3006';
