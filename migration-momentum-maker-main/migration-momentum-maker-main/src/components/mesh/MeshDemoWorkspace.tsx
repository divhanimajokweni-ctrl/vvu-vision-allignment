'use client';

// src/components/mesh/MeshDemoWorkspace.tsx — FIELD DEMO · SENSOR MESH
// (#/mesh). The operator-facing shell around the :3007 mesh-demo rail:
// the big-screen dashboard (embedded), live service telemetry, one-click
// chain verification, and the honest boundary note. This is the DEMO rail —
// separate from the QR-bridge pairing rail per TEMPLATE_QR_BRIDGE v1.1.0 §15.
//
// Honesty rules: the rail states LIVE/OFFLINE from real probes; chain facts
// come from the service's own /state and /verify endpoints; nothing is
// simulated in THIS component (the QA agent that joins the mesh is labelled
// SIMULATED on the dashboard itself).

import { useCallback, useEffect, useState } from 'react';
import { externalLinkAria } from '@/lib/watchboard-ledger';
import './mesh-demo.css';

const PORT = 3007;
const STATE_URL = `/mesh-demo/state?XTransformPort=${PORT}`;
const VERIFY_URL = `/mesh-demo/verify?XTransformPort=${PORT}`;
const DASH_URL = `/mesh-demo?XTransformPort=${PORT}`;
const JOIN_URL = `/mesh-demo/join?XTransformPort=${PORT}`;

type ServiceState = {
  ok: boolean;
  nodes: number;
  entries: number;
  head: string;
};

type VerifyOut =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'ok'; entries: number; head: string; ms: number }
  | { kind: 'bad'; at: number; reason: string }
  | { kind: 'error'; message: string };

export function MeshDemoWorkspace() {
  const [svc, setSvc] = useState<ServiceState | null>(null);
  const [svcDown, setSvcDown] = useState(false);
  const [verify, setVerify] = useState<VerifyOut>({ kind: 'idle' });
  const [iframeKey, setIframeKey] = useState(0);

  // probe the real service — LIVE/OFFLINE is never guessed
  useEffect(() => {
    let alive = true;
    const probe = async () => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 3500);
        const r = await fetch(STATE_URL, { signal: ctrl.signal, cache: 'no-store' });
        clearTimeout(t);
        const s = await r.json();
        if (!alive) return;
        setSvc({ ok: true, nodes: s.nodes.length, entries: s.chain.entries, head: s.chain.head });
        setSvcDown(false);
      } catch {
        if (alive) setSvcDown(true);
      }
    };
    probe();
    const iv = setInterval(probe, 4000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, []);

  const runVerify = useCallback(async () => {
    setVerify({ kind: 'busy' });
    try {
      const r = await fetch(VERIFY_URL, { cache: 'no-store' });
      const v = await r.json();
      if (v.valid) setVerify({ kind: 'ok', entries: v.entries, head: v.head, ms: v.duration_ms });
      else setVerify({ kind: 'bad', at: v.break_at_seq, reason: v.reason });
    } catch (e) {
      setVerify({ kind: 'error', message: (e as Error).message || 'unreachable' });
    }
  }, []);

  return (
    <div className="mesh-root">
      <header className="mesh-header">
        <div>
          <div className="mesh-brand">PROOFBRIDGE FIELD DEMO · RAIL :3007 · SEPARATE FROM PAIRING BRIDGE (§15)</div>
          <div className="mesh-title">Sensor Mesh — Field Demo</div>
        </div>
        <span className={`mesh-pill ${svcDown ? 'offline' : svc ? 'live' : ''}`}>
          {svcDown ? 'SERVICE OFFLINE' : svc ? `SERVICE LIVE · ${svc.nodes} NODE${svc.nodes === 1 ? '' : 'S'}` : 'PROBING…'}
        </span>
        <span className="mesh-pill">LOCAL-ONLY · NOTHING LEAVES THE ROOM</span>
        <div className="mesh-spacer" />
        <button className="mesh-btn" type="button" onClick={runVerify} disabled={verify.kind === 'busy'}>
          {verify.kind === 'busy' ? 'Walking chain…' : 'Verify chain'}
        </button>
        <button className="mesh-btn ghost" type="button" onClick={() => setIframeKey((k) => k + 1)} title="Reload the embedded dashboard">
          Reload
        </button>
        <a className="mesh-btn ghost" href={DASH_URL} target="_blank" rel="noopener noreferrer" aria-label={externalLinkAria('Open standalone', 'the mesh demo dashboard')}>
          Open standalone
        </a>
      </header>

      <div className="mesh-body">
        <div className="mesh-stage">
          <iframe
            key={iframeKey}
            src={DASH_URL}
            title="Sensor mesh dashboard — live big-screen view (port 3007)"
          />
          <span className="mesh-stage-tag">LIVE VIEW · :3007 · GATEWAY-FORWARDED</span>
        </div>

        <aside className="mesh-rail">
          <section className="mesh-panel">
            <h4>Chain — live from the service</h4>
            <dl className="mesh-kv">
              <dt>ENTRIES</dt>
              <dd>{svc ? String(svc.entries) : svcDown ? '—' : '…'}</dd>
              <dt>HEAD</dt>
              <dd>{svc ? `${svc.head.slice(0, 16)}…` : svcDown ? '—' : '…'}</dd>
              <dt>GENESIS</dt>
              <dd>LINKED · SHA-256 · APPEND-ONLY JSONL</dd>
              <dt>JOURNAL</dt>
              <dd>mini-services/mesh-demo/data/journal.jsonl</dd>
            </dl>
            {verify.kind === 'ok' && (
              <div className="mesh-verify-out">
                CHAIN VALID ✓ — {verify.entries} ENTRIES · RECOMPUTED IN {verify.ms}MS · HEAD {verify.head.slice(0, 12)}…
              </div>
            )}
            {verify.kind === 'bad' && (
              <div className="mesh-verify-out bad">CHAIN BROKEN AT SEQ {verify.at} — {verify.reason}</div>
            )}
            {verify.kind === 'error' && (
              <div className="mesh-verify-out bad">VERIFY FAILED — SERVICE UNREACHABLE ({verify.message})</div>
            )}
            {verify.kind === 'busy' && <div className="mesh-verify-out">WALKING FROM GENESIS…</div>}
          </section>

          <section className="mesh-panel">
            <h4>Demo beats — in order</h4>
            <div className="mesh-beats">
              <ol>
                <li>
                  Guests scan the QR → <b>cards appear</b> on the dashboard
                </li>
                <li>
                  Cover the phone camera → CAMERA flips to <span className="u">UNDEFINED</span> in ≤5 s — never a guess
                </li>
                <li>
                  Tap STOP SHARING on the phone → card disappears, <b>node.leave journaled</b>
                </li>
                <li>
                  VERIFY CHAIN → every reading counted from <b>genesis</b>
                </li>
              </ol>
            </div>
          </section>

          <section className="mesh-panel">
            <h4>Run the QA agent (honestly labelled)</h4>
            <div className="mesh-note">
              <b>cd mini-services/mesh-demo && bun run demo-agent</b> — joins as a
              SIMULATED node, streams all five channels, plays the covered-camera
              beat, then stops sharing. The dashboard shows the{' '}
              <b>SIMULATED · QA AGENT</b> badge on it. Real phones get no badge.
            </div>
          </section>

          <section className="mesh-panel">
            <h4>Boundary &amp; spec</h4>
            <div className="mesh-note">
              <b>ProofBridge/TEMPLATE_QR_BRIDGE.md v1.1.0</b> governs the pairing
              rail. This demo is the <b>separate field-demo sensor mesh rail</b>
              (§15). Its QR carries a plain join URL — a reference, never a
              secret (§1) — rendered locally by the service (§8); every endpoint
              is noindex (§9). Phone page:{' '}
              <a href={JOIN_URL} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--mesh-lime)' }} aria-label={externalLinkAria('/mesh-demo/join', 'the phone page’s join URL')}>
                /mesh-demo/join
              </a>
            </div>
          </section>
        </aside>
      </div>

      <footer className="mesh-honesty">
        <span>FIELD DEMO · SENSOR MESH</span>
        <span className="sep">|</span>
        <span>CATALOGUE STATUS: DEMONSTRATION (§3)</span>
        <span className="sep">|</span>
        <span>QR = JOIN URL (REFERENCE, NOT SECRET) · SERVER = AUTHORITY · JOURNAL = TRUTH</span>
        <span className="sep">|</span>
        <span>MISSING SENSOR ⇒ UNDEFINED, NEVER A GUESS</span>
      </footer>
    </div>
  );
}
