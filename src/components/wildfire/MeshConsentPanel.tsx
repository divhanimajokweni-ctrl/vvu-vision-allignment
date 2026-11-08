'use client';

// src/components/wildfire/MeshConsentPanel.tsx — mesh membership + consent
// registry. File 6 of the 8-file Wildfire Emergency View contract.
//
// OPERATOR-SIDE DISCIPLINES:
//   · MESH section lists PRESENT nodes only — a member appears here IFF
//     they granted the `wildfire.emergency.mesh` authorisation. Revoked
//     members are ABSENT (never dimmed, never "half-visible").
//   · CONSENT REGISTRY lists the full roster with a one-click, testable
//     GRANT / REVOKE path. Every change is journaled by :3006 (hash-chained)
//     and mirrored to the estate WORM ledger.
//   · Nodes are SIMULATED until a real paired device joins — labelled, not
//     hidden.

import type { MeshMember, MeshNode, MeshTelemetry } from '@/lib/wildfire-mesh';

export function MeshConsentPanel({
  members,
  nodes,
  telemetry,
  connected,
  onConsent,
}: {
  members: MeshMember[];
  nodes: MeshNode[];
  telemetry: Record<string, MeshTelemetry>;
  connected: boolean;
  onConsent: (memberId: string, grant: boolean) => void;
}) {
  const absentCount = members.length - nodes.length;

  return (
    <>
      {/* ── present nodes ─────────────────────────────────────────── */}
      <section className="pools-panel" aria-label="Mesh — present nodes">
        <div className="pools-panel-head">
          MESH · PRESENT NODES
          <span className="pools-head-badge" data-ok={connected}>
            {connected ? `${nodes.length} ON-MESH` : 'OFFLINE'}
          </span>
        </div>
        <div className="pools-panel-body pools-scroll" style={{ maxHeight: 190 }}>
          {nodes.length === 0 && (
            <p className="wf-absent-line" style={{ paddingTop: 4 }}>
              {connected
                ? 'NO MEMBERS ON-MESH — every consent is REVOKED.'
                : 'MESH SERVICE UNREACHABLE (:3006) — no state is faked here.'}
            </p>
          )}
          {nodes.map((n) => {
            const t = telemetry[n.id];
            return (
              <div className="wf-node" key={n.id}>
                <span className="wf-node-id">{n.id}</span>
                <span className="wf-node-cs" title={n.callsign}>
                  {n.callsign} · SIM
                </span>
                <span className="wf-node-tele" title="simulated node telemetry — 4s cadence">
                  {t
                    ? `${Math.round(t.windKph)}KPH ${Math.round(t.tempC)}°C BAT${Math.round(t.batteryPct)}%`
                    : '…'}
                </span>
              </div>
            );
          })}
          <p className="wf-absent-line">
            ABSENT (NO CONSENT): {absentCount} — revoked members are never drawn.
          </p>
        </div>
      </section>

      {/* ── consent registry ───────────────────────────────────────── */}
      <section className="pools-panel" aria-label="Consent registry — wildfire.emergency.mesh authorisation">
        <div className="pools-panel-head">
          CONSENT REGISTRY
          <span className="pools-head-badge">
            {connected ? 'TESTABLE' : 'OFFLINE'}
          </span>
        </div>
        <div className="pools-panel-body pools-scroll" style={{ maxHeight: 240 }}>
          {members.length === 0 && (
            <p className="wf-absent-line" style={{ paddingTop: 4 }}>
              ROSTER LOADING… (service offline = empty, honestly)
            </p>
          )}
          {members.map((m) => (
            <div className="wf-consent-card" key={m.id}>
              <div className="wf-consent-top">
                <span className="wf-consent-id">{m.id}</span>
                <span className="wf-consent-role">{m.role.replace(/_/g, ' ')}</span>
              </div>
              <div className="wf-consent-cs">{m.callsign}</div>
              <div className="wf-consent-actions">
                <button
                  type="button"
                  className="pools-btn"
                  data-variant={m.consent ? 'red' : 'teal'}
                  disabled={!connected}
                  onClick={() => onConsent(m.id, !m.consent)}
                  title={
                    m.consent
                      ? `Revoke ${m.id}'s wildfire.emergency.mesh authorisation — node leaves the mesh immediately`
                      : `Grant ${m.id} the wildfire.emergency.mesh authorisation — node joins the mesh`
                  }
                >
                  {m.consent ? 'REVOKE' : 'GRANT'}
                </button>
                <span
                  className="wf-consent-state"
                  data-granted={m.consent ? 'true' : 'false'}
                >
                  {m.consent ? 'AUTHORISED' : 'NO CONSENT'}
                </span>
              </div>
            </div>
          ))}
          <p className="wf-absent-line" style={{ paddingTop: 2 }}>
            membership = consent · revocation is immediate + journaled
          </p>
        </div>
      </section>
    </>
  );
}
