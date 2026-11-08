'use client';

// src/components/wildfire/EvidenceRail.tsx — the 9pt evidence rail.
// File 7 of the 8-file Wildfire Emergency View contract.
//
// 9PT DISCIPLINE (non-negotiable):
//   · every glyph in this rail is ≤ 9px;
//   · the rail never exceeds the first screen (bounded, scrolls inside);
//   · it shows REAL evidence only — the :3006 journal head hash, tier,
//     entry count, a WORKING verify link (GET /verify recomputes the whole
//     chain), and the estate-ledger mirror status. If the chain is a stub,
//     it says STUB. If the service is offline, it says OFFLINE.

import { useState } from 'react';
import {
  verifyChain,
  MESH_VERIFY_URL,
  type MeshJournalEntry,
  type VerifyResult,
} from '@/lib/wildfire-mesh';
import type { MirrorState } from '@/lib/wildfire-mesh';
import { externalLinkAria } from '@/lib/watchboard-ledger';

function shortTime(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('en-ZA', { hour12: false });
  } catch {
    return '—';
  }
}

function kindLabel(e: MeshJournalEntry): string {
  const d = e.data as { from?: string; to?: string; memberId?: string; grant?: boolean };
  switch (e.kind) {
    case 'wildfire.state.transition':
      return `${d.from ?? '?'}→${d.to ?? '?'}`;
    case 'wildfire.mesh.consent.grant':
    case 'wildfire.mesh.consent.revoke':
      return `${d.grant ? 'GRANT' : 'REVOKE'} ${d.memberId ?? '?'}`;
    case 'mesh.heartbeat':
      return 'heartbeat';
    case 'GENESIS':
      return 'genesis';
    case 'fsm.seed':
      return 'fsm seed';
    default:
      return e.kind;
  }
}

export function EvidenceRail({
  head,
  count,
  tier,
  entries,
  connected,
  mirror,
}: {
  head: string;
  count: number;
  tier: string;
  entries: MeshJournalEntry[];
  connected: boolean;
  mirror: MirrorState;
}) {
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const runVerify = async () => {
    setVerifying(true);
    setVerifyError(null);
    setResult(null);
    try {
      setResult(await verifyChain());
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : 'VERIFY_FAILED');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <section className="pools-panel wf-evidence pools-9pt" aria-label="Evidence rail — wildfire mesh journal">
      <div className="pools-panel-head">
        EVIDENCE · WILDFIRE MESH JOURNAL
        <span className="pools-head-badge" data-ok={connected}>
          {connected ? 'LIVE :3006' : 'OFFLINE'}
        </span>
      </div>
      <div className="pools-panel-body pools-scroll" style={{ maxHeight: 420 }}>
        {/* chain facts */}
        <div className="wf-ev-row">
          HEAD&nbsp;<span className="wf-ev-hash">{head ? `${head.slice(0, 16)}…` : '—'}</span>
        </div>
        <div className="wf-ev-row">
          ENTRIES&nbsp;<b>{count}</b>&nbsp;· TIER&nbsp;<b>{tier}</b>
        </div>
        <div className="wf-ev-row">
          CHAIN&nbsp;
          {verifying ? (
            <b>RECOMPUTING…</b>
          ) : result ? (
            result.valid ? (
              <span className="wf-ev-ok">VALID ✓ ({result.count} ENTRIES, RECOMPUTED {shortTime(result.verifiedAt)})</span>
            ) : (
              <span className="wf-ev-bad">BROKEN ✗ — CHAIN FAILED RECOMPUTE</span>
            )
          ) : verifyError ? (
            <span className="wf-ev-bad">{verifyError}</span>
          ) : (
            <b>NOT YET RECOMPUTED THIS SESSION</b>
          )}
        </div>

        {/* verify actions — real link, real fetch */}
        <div className="wf-ev-actions">
          <button
            type="button"
            className="pools-btn"
            data-variant="teal"
            onClick={runVerify}
            disabled={verifying || !connected}
            title="Recompute the full hash chain from genesis (GET /verify on :3006)"
          >
            {verifying ? 'VERIFYING…' : 'VERIFY CHAIN'}
          </button>
          <a
            className="pools-btn focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2ea8a0] transition-[filter,box-shadow] hover:brightness-125"
            data-variant="teal"
            href={MESH_VERIFY_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={externalLinkAria('RAW', 'the mesh verify chain\u2019s own JSON')}
            title="Open the raw verify JSON (through the gateway)"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
          >
            RAW <span aria-hidden> ↗</span>
          </a>
        </div>

        {/* estate-ledger mirror */}
        <div className="wf-ev-list" style={{ borderTop: '1px solid var(--pools-line)', marginTop: 8, paddingTop: 6 }}>
          <div className="wf-ev-row">
            ESTATE LEDGER MIRROR&nbsp;
            {mirror.error ? (
              <span className="wf-ev-bad">{mirror.error}</span>
            ) : mirror.count > 0 ? (
              <span className="wf-ev-ok">
                {mirror.count} MIRRORED ✓ LAST #{mirror.lastSeq} · {mirror.lastHash?.slice(0, 10)}…
              </span>
            ) : (
              <b>0 MIRRORED (NO EVENTS THIS SESSION)</b>
            )}
          </div>
          <div className="wf-ev-row" style={{ opacity: 0.75 }}>
            every FSM transition + consent change is ALSO appended to the main
            WORM ledger (/api/vvu/ledger) — two chains, one truth.
          </div>
        </div>

        {/* journal tail */}
        <div className="wf-ev-list">
          <div className="wf-ev-row">
            <b>JOURNAL TAIL</b>&nbsp;(newest first, live)
          </div>
          {entries.length === 0 && (
            <div className="wf-ev-entry">
              <span className="wf-ev-seq">—</span>
              <span className="wf-ev-detail">
                {connected ? 'listening for entries…' : 'offline — no entries faked'}
              </span>
            </div>
          )}
          {entries.slice(0, 14).map((e) => (
            <div className="wf-ev-entry" key={`${e.seq}-${e.hash.slice(0, 6)}`}>
              <span className="wf-ev-seq">#{e.seq}</span>
              <span className="wf-ev-kind">{kindLabel(e)}</span>
              <span className="wf-ev-detail" title={JSON.stringify(e.data)}>
                {e.data && typeof e.data === 'object' && 'actor' in (e.data as Record<string, unknown>)
                  ? String((e.data as Record<string, unknown>).actor)
                  : e.kind}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
