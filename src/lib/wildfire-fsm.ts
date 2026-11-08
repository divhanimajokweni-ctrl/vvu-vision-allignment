// src/lib/wildfire-fsm.ts — Winter Pools · Wildfire Emergency View
// SINGLE SOURCE OF TRUTH for the wildfire incident state machine. Imported
// by BOTH the operator console (src/components/wildfire/*) and the
// consent-gated mesh service (mini-services/wildfire-mesh/index.ts via
// relative import — same pattern as vvu-field-onboard importing
// src/lib/proofbridge/merkle.ts).
//
// FSM: NORMAL → WATCH → DECLARED → ESCALATED → STAND-DOWN → NORMAL.
// Legal de-escalation: WATCH→NORMAL, DECLARED→WATCH, ESCALATED→DECLARED.
// Every transition is a WORM event `wildfire.state.transition` and is
// journaled (hash-chained) by the :3006 mesh service and mirrored to the
// estate ledger via POST /api/vvu/ledger.
//
// Honesty ladder (never print a tier the chain does not actually have):
//   T0 · LOCAL_SOFTWARE_SHA256_CHAIN — :3006 journal (hash-chained, local,
//        no external anchor) — REAL, verifiable via GET /verify.
//   T1 · COUNTERSIGNED — reserved for operator counter-signature; NOT
//        implemented; never displayed as active.
//   T2 · SEED_UNVERIFIED — the in-artifact demo journal inside
//        cape_town_wildfire.html (page-local, resets on reload).

export type WildfireFsmState =
  | 'NORMAL'
  | 'WATCH'
  | 'DECLARED'
  | 'ESCALATED'
  | 'STAND-DOWN';

export const WILDFIRE_STATES: readonly WildfireFsmState[] = [
  'NORMAL',
  'WATCH',
  'DECLARED',
  'ESCALATED',
  'STAND-DOWN',
] as const;

/** Legal transitions. Only these are accepted by the :3006 service;
 * anything else returns 409 ILLEGAL_TRANSITION and is NOT journaled. */
export const WILDFIRE_TRANSITIONS: Readonly<
  Record<WildfireFsmState, readonly WildfireFsmState[]>
> = {
  NORMAL: ['WATCH'],
  WATCH: ['DECLARED', 'NORMAL'],
  DECLARED: ['ESCALATED', 'WATCH'],
  ESCALATED: ['DECLARED', 'STAND-DOWN'],
  'STAND-DOWN': ['NORMAL'],
};

export function canTransition(
  from: WildfireFsmState,
  to: WildfireFsmState
): boolean {
  if (from === to) return false;
  return WILDFIRE_TRANSITIONS[from].includes(to);
}

export type WildfireHazard = 'NONE' | 'ELEVATED' | 'ACTIVE' | 'CRITICAL' | 'RECOVERY';

/** Hazard colour semantics shared by the artifact, the ops map and the FSM
 *  banner — one mapping, no per-file drift. */
export function hazardOf(state: WildfireFsmState): WildfireHazard {
  switch (state) {
    case 'NORMAL':
      return 'NONE';
    case 'WATCH':
      return 'ELEVATED';
    case 'DECLARED':
      return 'ACTIVE';
    case 'ESCALATED':
      return 'CRITICAL';
    case 'STAND-DOWN':
      return 'RECOVERY';
  }
}

/** Ember-palette hazard colours (hex, no Tailwind dependency — used by the
 *  canvas renderer too). Deliberately avoids indigo/blue. */
export const WILDFIRE_HAZARD_COLOR: Readonly<
  Record<WildfireHazard, string>
> = {
  NONE: '#7a8a6e',
  ELEVATED: '#f2b84b',
  ACTIVE: '#ff8a3d',
  CRITICAL: '#e5484d',
  RECOVERY: '#2ea8a0',
};

export interface WildfireFsmEvent {
  from: WildfireFsmState;
  to: WildfireFsmState;
  actor: string;
  reason: string;
  at: string; // ISO timestamp
}

/** Estate-ledger WORM projection of a transition (source/event/details fit
 *  the /api/vvu/ledger POST contract: source ≤40, event ≤80, details ≤400). */
export function wildfireWormEvent(
  from: WildfireFsmState,
  to: WildfireFsmState,
  actor: string,
  reason: string
): { source: string; event: string; details: string } {
  const details = `${from}→${to} by ${actor}${reason ? `: ${reason}` : ''}`.slice(0, 400);
  return {
    source: 'WILDFIRE',
    event: 'wildfire.state.transition',
    details,
  };
}

/** Consent WORM projection (grant/revoke of the `wildfire.emergency.mesh`
 *  authorisation). Revocation is a first-class, visible, testable action. */
export function wildfireConsentWormEvent(
  memberId: string,
  callsign: string,
  grant: boolean,
  actor: string
): { source: string; event: string; details: string } {
  return {
    source: 'WILDFIRE',
    event: grant
      ? 'wildfire.mesh.consent.grant'
      : 'wildfire.mesh.consent.revoke',
    details: `${grant ? 'GRANT' : 'REVOKE'} wildfire.emergency.mesh · ${memberId} ${callsign} · by ${actor}`.slice(
      0,
      400
    ),
  };
}

/** Mesh roster — seed members of the Winter Pools co-op + municipal
 *  collaborators. SIMULATED until a real paired device joins the mesh
 *  (the UI labels them SIMULATED — never LIVE). */
export interface WildfireMemberSeed {
  id: string;
  callsign: string;
  role:
    | 'COOP_LEAD'
    | 'FIRE_OFFICER'
    | 'MUNICIPAL_LIAISON'
    | 'FIELD_NODE';
  /** Position on the ops-map isometric grid (col,row 0..43 / 0..35). */
  col: number;
  row: number;
  /** Seed consent state — the grant/revoke path must be testable in BOTH
   *  directions from the first paint. */
  consent: boolean;
}

export const WILDFIRE_MEMBER_SEED: readonly WildfireMemberSeed[] = [
  { id: 'WP-CL-01', callsign: 'NOORDHOEK CO-OP LEAD', role: 'COOP_LEAD', col: 26, row: 26, consent: true },
  { id: 'WP-FO-02', callsign: 'FIRE OFFICER · SOUTHERN FOHNS', role: 'FIRE_OFFICER', col: 21, row: 22, consent: true },
  { id: 'WP-ML-03', callsign: 'CITY DISASTER RISK LIAISON', role: 'MUNICIPAL_LIAISON', col: 30, row: 12, consent: false },
  { id: 'WP-FN-04', callsign: 'FIELD NODE · HOUT BAY', role: 'FIELD_NODE', col: 15, row: 16, consent: false },
  { id: 'WP-FN-05', callsign: 'FIELD NODE · CONSTANTIA', role: 'FIELD_NODE', col: 33, row: 15, consent: false },
  { id: 'WP-FN-06', callsign: 'FIELD NODE · TOKAI', role: 'FIELD_NODE', col: 35, row: 21, consent: false },
  { id: 'WP-FN-07', callsign: 'FIELD NODE · SCARBOROUGH', role: 'FIELD_NODE', col: 9, row: 31, consent: false },
] as const;

/** The eight map layers, identical on the artifact and the operator console
 *  (same isometric projection discipline). Each carries an honesty label —
 *  a layer is only ever LIVE when its feed is live; seed feeds are SIMULATED
 *  and are never upgraded to a stronger label. */
export type WildfireLayerId =
  | 'fire'
  | 'wind'
  | 'smoke'
  | 'evac'
  | 'mesh'
  | 'assets'
  | 'env'
  | 'evidence';

export interface WildfireLayerMeta {
  id: WildfireLayerId;
  label: string;
  /** Honesty label of the seed feed. The mesh + evidence layers are marked
   *  LIVE at runtime only when the :3006 service is connected. */
  seedHonesty: 'SIMULATED' | 'SEED' | 'LIVE-IF-SERVICE';
}

export const WILDFIRE_LAYERS: readonly WildfireLayerMeta[] = [
  { id: 'fire', label: 'FIRE POLYGON', seedHonesty: 'SIMULATED' },
  { id: 'wind', label: 'WIND FIELD', seedHonesty: 'SIMULATED' },
  { id: 'smoke', label: 'SMOKE PLUME', seedHonesty: 'SIMULATED' },
  { id: 'evac', label: 'EVACUATION ZONES', seedHonesty: 'SEED' },
  { id: 'mesh', label: 'MESH DENSITY', seedHonesty: 'LIVE-IF-SERVICE' },
  { id: 'assets', label: 'ASSETS AT RISK', seedHonesty: 'SEED' },
  { id: 'env', label: 'ENVIRONMENTAL', seedHonesty: 'SIMULATED' },
  { id: 'evidence', label: 'EVIDENCE CHAIN', seedHonesty: 'LIVE-IF-SERVICE' },
] as const;
