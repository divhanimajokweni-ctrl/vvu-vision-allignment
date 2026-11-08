'use client';

// src/components/wildfire/WildfireEmergencyWorkspace.tsx — WINTER POOLS ·
// WILDFIRE EMERGENCY VIEW (#/wildfire). File 8 of the 8-file contract.
//
// This is the OPERATOR-SIDE console — not a demo. A fire officer or co-op
// collaborator must be able to declare an incident at 03:00 from this
// screen: see the state in ONE glance (hazard banner), flip the FSM with
// an armed two-step confirm, watch consented mesh nodes (absent members
// stay absent), and verify the evidence chain with one click.
//
// Honesty footer states exactly what is LIVE vs SIMULATED vs SEED at all
// times. Nothing is faked when the service is offline.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  WILDFIRE_STATES,
  WILDFIRE_LAYERS,
  WILDFIRE_HAZARD_COLOR,
  canTransition,
  hazardOf,
  wildfireWormEvent,
  wildfireConsentWormEvent,
  type WildfireFsmState,
  type WildfireLayerId,
} from '@/lib/wildfire-fsm';
import {
  useWildfireMesh,
  postFsmTransition,
  postConsent,
  mirrorToEstateLedger,
  type MirrorState,
} from '@/lib/wildfire-mesh';
import { IsoOpsMap } from './IsoOpsMap';
import { MeshConsentPanel } from './MeshConsentPanel';
import { EvidenceRail } from './EvidenceRail';
import './wildfire-view.css';

const ACTORS = ['FIRE_OFFICER', 'COOP_LEAD', 'MUNICIPAL_LIAISON', 'OPERATOR'] as const;

const BANNER_META: Record<WildfireFsmState, string> = {
  NORMAL: 'baseline · no ignition · monitoring cycle',
  WATCH: 'smoke sighted · watch cycle 15 min · pre-position mesh consents',
  DECLARED: 'active fire · evacuation zones armed · mesh consents required',
  ESCALATED: 'running fire · spot fires · full evacuation + asset triage',
  'STAND-DOWN': 'containment · mop-up · stand-down cycle 30 min',
};

export function WildfireEmergencyWorkspace() {
  const mesh = useWildfireMesh();
  const { connected, fsm, members, nodes, telemetry, head, count, tier, entries } = mesh;

  const [layers, setLayers] = useState<ReadonlySet<WildfireLayerId>>(
    () => new Set(WILDFIRE_LAYERS.map((l) => l.id))
  );
  const [actor, setActor] = useState<string>('FIRE_OFFICER');
  const [reason, setReason] = useState('');
  const [armed, setArmed] = useState<WildfireFsmState | null>(null);
  const [busy, setBusy] = useState(false);
  const [mirror, setMirror] = useState<MirrorState>({
    count: 0,
    lastSeq: null,
    lastHash: null,
    lastEvent: null,
    error: null,
  });
  const [scenarioSec, setScenarioSec] = useState(0);
  const [clock, setClock] = useState('--:--:--');

  /* scenario clock + SAST wall clock */
  useEffect(() => {
    const iv = setInterval(() => {
      setScenarioSec((s) => s + 1);
      try {
        setClock(
          new Date().toLocaleTimeString('en-ZA', {
            timeZone: 'Africa/Johannesburg',
            hour12: false,
          })
        );
      } catch {
        setClock(new Date().toLocaleTimeString('en-ZA', { hour12: false }));
      }
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  /* surface socket errors as toasts (e.g. a rejected request) */
  useEffect(() => {
    if (mesh.error) {
      toast.error(`MESH: ${mesh.error}`, {
        description: 'The service rejected the request — nothing was journaled.',
      });
      mesh.clearError();
    }
  }, [mesh.error, mesh]);

  const doMirror = useCallback(async (payload: { source: string; event: string; details: string }) => {
    try {
      const r = await mirrorToEstateLedger(payload);
      setMirror((m) => ({
        count: m.count + 1,
        lastSeq: r.seq,
        lastHash: r.hash,
        lastEvent: payload.event,
        error: null,
      }));
    } catch (e) {
      setMirror((m) => ({
        ...m,
        error: `MIRROR FAILED: ${e instanceof Error ? e.message : 'UNKNOWN'}`,
      }));
    }
  }, []);

  /* ── FSM execution (armed, two-step confirm, REST → mirror on accept) ── */
  const executeTransition = useCallback(
    async (to: WildfireFsmState) => {
      if (busy || !connected) return;
      setBusy(true);
      try {
        const res = await postFsmTransition({ to, actor, reason: reason.trim() });
        toast.success(`FSM ${res.from} → ${res.to}`, {
          description: `journaled #${res.entry.seq} · mirrored to estate ledger`,
        });
        void doMirror(wildfireWormEvent(res.from as WildfireFsmState, to, actor, reason.trim()));
        setArmed(null);
        setReason('');
      } catch (e) {
        toast.error(`TRANSITION REJECTED: ${e instanceof Error ? e.message : 'UNKNOWN'}`, {
          description: 'nothing was journaled — the state is unchanged',
        });
      } finally {
        setBusy(false);
      }
    },
    [actor, busy, connected, doMirror, reason]
  );

  /* ── consent (immediate, journaled, mirrored) ─────────────────────────── */
  const handleConsent = useCallback(
    async (memberId: string, grant: boolean) => {
      if (busy || !connected) return;
      setBusy(true);
      try {
        const res = await postConsent({ memberId, grant, actor });
        toast.success(`${grant ? 'GRANT' : 'REVOKE'} · ${memberId}`, {
          description: `wildfire.emergency.mesh · journaled #${res.entry.seq}${
            grant ? ' · node joined the mesh' : ' · node left the mesh (absent)'
          }`,
        });
        const m = members.find((x) => x.id === memberId);
        if (m) {
          void doMirror(wildfireConsentWormEvent(memberId, m.callsign, grant, actor));
        }
      } catch (e) {
        toast.error(`CONSENT REJECTED: ${e instanceof Error ? e.message : 'UNKNOWN'}`, {
          description: 'nothing was journaled — consent unchanged',
        });
      } finally {
        setBusy(false);
      }
    },
    [actor, busy, connected, doMirror, members]
  );

  const hazard = hazardOf(fsm.state);
  const layerList = useMemo(() => WILDFIRE_LAYERS, []);

  return (
    <div className="pools-root absolute inset-0 flex flex-col">
      {/* ── incident header ─────────────────────────────────────────── */}
      <header className="wf-header">
        <div className="wf-title">
          WINTER POOLS · WILDFIRE EMERGENCY VIEW
          <small>OPERATOR CONSOLE · CAPE PENINSULA · #/wildfire</small>
        </div>
        <span className="pools-honesty" data-tone={connected ? 'good' : 'bad'}>
          {connected ? 'MESH :3006 LIVE' : 'MESH :3006 OFFLINE'}
        </span>
        <span className="pools-honesty" data-tone="dim">NODES SIMULATED</span>
        <div className="wf-clock">
          SAST <b>{clock}</b>
          <br />
          SCENARIO <b>T+{String(Math.floor(scenarioSec / 60)).padStart(2, '0')}:{String(scenarioSec % 60).padStart(2, '0')}</b>
        </div>
      </header>

      {/* ── hazard banner — the 03:00 one-glance read ───────────────── */}
      <div className="wf-banner" data-hazard={hazard} role="status">
        <span className="wf-banner-state" style={{ color: WILDFIRE_HAZARD_COLOR[hazard] }}>
          {fsm.state}
        </span>
        <span className="wf-banner-meta">
          {BANNER_META[fsm.state]}
          {fsm.at ? ` · since ${new Date(fsm.at).toLocaleTimeString('en-ZA', { hour12: false })}` : ''}
          {fsm.actor ? ` · by ${fsm.actor}` : ''}
        </span>
      </div>

      {/* ── main grid ───────────────────────────────────────────────── */}
      <div className="pools-grid ops flex-1 min-h-0">
        {/* left rail: layers + mesh + consent */}
        <div className="pools-area-left">
          <section className="pools-panel" aria-label="Map layers">
            <div className="pools-panel-head">
              LAYERS · 8
              <span className="pools-head-badge">
                {layers.size}/8 ON
              </span>
            </div>
            <div className="pools-panel-body" style={{ maxHeight: 210 }}>
              {layerList.map((L) => {
                const on = layers.has(L.id);
                const live = (L.id === 'mesh' || L.id === 'evidence') && connected;
                return (
                  <label key={L.id} className={`wf-layer${on ? ' on' : ''}`}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => {
                        setLayers((prev) => {
                          const next = new Set(prev);
                          if (next.has(L.id)) next.delete(L.id);
                          else next.add(L.id);
                          return next;
                        });
                      }}
                      aria-label={L.label}
                    />
                    <span className="wf-layer-sw" aria-hidden="true" />
                    <span className="wf-layer-name">{L.label}</span>
                    <span className="wf-layer-tag" data-live={live ? 'true' : 'false'}>
                      {live ? 'LIVE' : L.seedHonesty === 'LIVE-IF-SERVICE' ? 'OFFLINE' : L.seedHonesty}
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          <MeshConsentPanel
            members={members}
            nodes={nodes}
            telemetry={telemetry}
            connected={connected}
            onConsent={handleConsent}
          />
        </div>

        {/* centre: ops map + FSM control */}
        <div className="pools-area-map">
          <IsoOpsMap
            fsm={fsm.state}
            nodes={nodes}
            telemetry={telemetry}
            layers={layers}
            journalCount={count}
            connected={connected}
            scenarioSec={scenarioSec}
          />
        </div>
        <div className="pools-area-fsm">
          <section className="pools-panel" aria-label="Incident state control">
            <div className="pools-panel-head">
              FSM CONTROL · ARMED TWO-STEP
              <span className="pools-head-badge">
                {connected ? 'SERVICE AUTHORISED' : 'OFFLINE — LOCKED'}
              </span>
            </div>
            <div className="wf-fsm-bar">
              {WILDFIRE_STATES.map((s) => {
                const isCurrent = s === fsm.state;
                const legal = !isCurrent && canTransition(fsm.state, s);
                const isArmed = armed === s;
                return (
                  <button
                    key={s}
                    type="button"
                    className={`wf-chip${isArmed ? ' armed' : ''}`}
                    aria-current={isCurrent ? 'true' : 'false'}
                    data-legal={legal ? 'true' : 'false'}
                    disabled={!connected || (!legal && !isCurrent)}
                    onClick={() => {
                      if (isCurrent) return;
                      if (!legal) return;
                      setArmed((a) => (a === s ? null : s));
                    }}
                    title={
                      isCurrent
                        ? 'current state'
                        : legal
                          ? `arm ${fsm.state} → ${s}, then EXECUTE`
                          : `ILLEGAL: ${fsm.state} → ${s} is not a legal transition`
                    }
                    style={
                      isCurrent
                        ? { background: WILDFIRE_HAZARD_COLOR[hazardOf(s)], borderColor: WILDFIRE_HAZARD_COLOR[hazardOf(s)] }
                        : undefined
                    }
                  >
                    {s}
                  </button>
                );
              })}
              <div className="wf-fsm-exec">
                <select
                  className="pools-select"
                  value={actor}
                  onChange={(e) => setActor(e.target.value)}
                  aria-label="Acting officer"
                  title="acting officer — journaled with every action"
                >
                  {ACTORS.map((a) => (
                    <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
                  ))}
                </select>
                <input
                  className="pools-input"
                  placeholder="reason (journaled)…"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  aria-label="Transition reason"
                  maxLength={120}
                />
                <button
                  type="button"
                  className="pools-btn"
                  data-variant="go"
                  disabled={!armed || busy || !connected}
                  onClick={() => armed && void executeTransition(armed)}
                  title={
                    armed
                      ? `EXECUTE ${fsm.state} → ${armed} as ${actor}`
                      : 'select a legal target state first'
                  }
                >
                  {busy ? 'EXECUTING…' : armed ? `EXECUTE ${fsm.state} → ${armed}` : 'ARM A TARGET STATE'}
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* right rail: evidence */}
        <div className="pools-area-right">
          <EvidenceRail
            head={head}
            count={count}
            tier={tier}
            entries={entries}
            connected={connected}
            mirror={mirror}
          />
        </div>
      </div>

      {/* ── honesty footer ──────────────────────────────────────────── */}
      <footer className="wf-footer">
        <span>
          <span className="dot" data-ok={connected ? 'true' : 'false'} />
          MESH SERVICE :3006 {connected ? 'LIVE' : 'OFFLINE'}
        </span>
        <span>NODES SIMULATED · CONSENT-GATED (ABSENT = REVOKED)</span>
        <span>FIRE · WIND · SMOKE · ENV SIMULATED</span>
        <span>EVAC · ASSETS SEED PLAN</span>
        <span>EVIDENCE {connected ? 'T0 LOCAL CHAIN' : 'OFFLINE'}</span>
        <span>ESTATE MIRROR {mirror.count > 0 ? `${mirror.count} ✓` : 'IDLE'}</span>
      </footer>
    </div>
  );
}
