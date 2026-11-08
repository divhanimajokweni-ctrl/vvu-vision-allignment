'use client';

// src/components/WorkspaceToggle.tsx — the ONE toggle button, now 13-way.
// Bottom-right, lime #c8ff00, visible on all thirteen projections.
// Round 22: SPATIAL → ANALYTICS → OUTREACH (SEND ENGINE) → HOLOCOM (6G) →
// CAPABILITY (DOSSIER) → SPATIAL. Round 24: … CAPABILITY → METRO → SPATIAL.
// Round 28: … HOLOCOM → URLLC+ (NEURAL EDGE) → CAPABILITY → METRO → SPATIAL.
// Round 29: … METRO → FIELD KIT (CAMPUS WALK) → SUPPORT (MK-I FUNDING) →
// SPATIAL. Round 30: … SUPPORT → COMMERCIAL (DAY-1 SUPPLY) → MANIFEST
// (EIS v1.0) → SPATIAL. Round 31: … MANIFEST → TWIN (MUNICIPAL · CAPE TOWN
// WILDFIRE) → WILDFIRE (WINTER POOLS EMERGENCY CONSOLE) → SPATIAL. Round 32:
// … WILDFIRE → MESH (FIELD DEMO · SENSOR MESH :3007) → SPATIAL. Task 48
// recovers the lost-lineage trio: … OPS → FLEET (DEVICE FLEET &
// ONBOARDING) → BROADCAST (CREATOR LAYER) → VVU-TRUST (COMMUNITY COMPUTE
// POOL) → SPATIAL — 29 projections in the cycle. Every
// toggle is WORM-logged (localStorage vvu_events + socket worm-log +
// /api/vvu/audit append) exactly like the original dual-route design.
// Round 57 adds SAFEGRID ▸ EVIDENCE_RELAY (the 30th projection) after
// FIRST_PRINCIPLES in the cycle.

import { toast } from 'sonner';
import { useHashRoute } from '@/hooks/use-hash-route';
import type { VvuView } from '@/hooks/use-hash-route';
import { useSendWormLog } from '@/hooks/use-vvu-socket';

const NEXT_VIEW: Record<VvuView, VvuView> = {
  spatial: 'analytics',
  analytics: 'outreach',
  outreach: 'holocom',
  holocom: 'urllc',
  urllc: 'capability',
  capability: 'metro',
  metro: 'fieldkit',
  fieldkit: 'support',
  support: 'commercial',
  commercial: 'manifest',
  manifest: 'twin',
  twin: 'wildfire',
  wildfire: 'mesh',
  mesh: 'sphere',
  sphere: 'bridge',
  bridge: 'field',
  field: 'terminal',
  terminal: 'watchdog',
  watchdog: 'receipts',
  receipts: 'settings',
  settings: 'pools',
  pools: 'docs',
  docs: 'ops',
  ops: 'fleet',
  fleet: 'broadcast',
  broadcast: 'trust',
  trust: 'governance',
  governance: 'firstprinciples',
  firstprinciples: 'safegrid',
  safegrid: 'skylantern',
  skylantern: 'icsh',
  icsh: 'spatial',
};

const VIEW_HASH: Record<VvuView, string> = {
  icsh: '/',
  spatial: '/#/ive',
  analytics: '/#/analytics',
  outreach: '/#/outreach',
  holocom: '/#/holocom',
  urllc: '/#/urllc',
  capability: '/#/capability',
  metro: '/#/metro',
  fieldkit: '/#/fieldkit',
  support: '/#/support',
  commercial: '/#/commercial',
  manifest: '/#/manifest',
  twin: '/#/twin',
  wildfire: '/#/wildfire',
  mesh: '/#/mesh',
  bridge: '/#/bridge',
  terminal: '/#/terminal',
  field: '/#/field',
  watchdog: '/#/watchdog',
  receipts: '/#/receipts',
  settings: '/#/settings',
  pools: '/#/pools',
  docs: '/#/docs',
  ops: '/#/ops',
  sphere: '/#/sphere',
  fleet: '/#/fleet',
  broadcast: '/#/broadcast',
  trust: '/#/trust',
  governance: '/#/governance',
  firstprinciples: '/#/firstprinciples',
  safegrid: '/#/safegrid',
  skylantern: '/#/skylantern',
};

const VIEW_TITLE: Record<VvuView, string> = {
  icsh: 'ICSH 4TH STATE · contract on chain, the ledger as storage',
  spatial: 'MAP_TWIN · operator verification view',
  analytics: 'ANALYTICS · gates, compliance, B-BBEE',
  outreach: 'SEQUENCE ENGINE · cadences, kanban, AI drafts',
  holocom: 'HOLOCOM · 6G NeXt split computing, QoE, discovery',
  urllc: 'URLLC+ · neural-edge DL paradigms, NTN pass, AFDM',
  capability: 'CAPABILITY DOSSIER · facts, profile, statement',
  metro: 'PROOFBRIDGE METRO · 8-bit node, five gates',
  fieldkit: 'FIELD KIT · campus walk, people notes, Q3 conditions',
  support: 'SUPPORT · Mk-I funding endpoint, DFA, receipts',
  commercial: 'COMMERCIAL · 17 price cards, QR station, 5 drafts, FS gate',
  manifest: 'ESTATE MANIFEST · EIS v1.0, regression ledger, inventory',
  twin: 'MUNICIPAL TWIN · Cape Town wildfire artifact, WORM pin',
  wildfire: 'WILDFIRE EMERGENCY · Winter Pools console, consent-gated mesh',
  mesh: 'FIELD DEMO · sensor mesh, local-only rail :3007, hash-chained journal',
  bridge: 'EVIDENCE · live vault bridge, QR pairing, receipt per operation',
  terminal: 'TERMINAL · command console, whitelisted read-only endpoints',
  field: 'BRIDGES · field onboarding rail :3005, device pairing',
  watchdog: 'WATCHDOG · rail health, integrity, governance ledger',
  receipts: 'RECEIPTS · cross-rail chain explorer, verify from genesis',
  settings: 'SETTINGS · Lindiwe memory, pins, preferences',
  pools: 'UBUNTU POOLS · community pool view, contribution ≠ access',
  docs: 'DOCUMENTS · field access, QR carry',
  ops: 'OPERATIONS LOOP · field sales → back office',
  sphere: 'TRUST SPHERE · 420 nodes, seven-state machine, metrics surface',
  fleet: 'FLEET · device set, onboarding flow, seven fleet documents from disk',
  broadcast: 'BROADCAST · creator layer, Mk-0.5 tablet, host rotation',
  trust: 'VVU-TRUST · community compute pool, onboarding game, stokvel terms',
  governance: 'GOVERNANCE · the permit kernel — Ed25519, single-use nonces, SIL slice',
  firstprinciples: 'FIRST PRINCIPLES · the laws beneath the signals',
  safegrid: 'SAFEGRID · evidence relay, outbox pipeline, WORM seals',
  skylantern: 'SKYLANTERN · field evidence surface',
};

/* Task 47 — the compact toggle labels (the chain of ternaries is gone;
   one record covers all 27 projections — Task 48 added the recovered
   fleet · broadcast · trust trio). */
const TOGGLE_LABEL: Record<VvuView, string> = {
  icsh: 'ICSH ▸ 4TH_STATE',
  spatial: 'MAP_TWIN',
  analytics: 'ANALYTICS ▸ MISSION_CTRL',
  outreach: 'SEQUENCE ▸ SEND_ENGINE',
  holocom: 'HOLOCOM ▸ 6G_NeXt',
  urllc: 'URLLC+ ▸ NEURAL_EDGE',
  capability: 'CAPABILITY ▸ DOSSIER',
  metro: 'METRO ▸ 8-BIT_NODE',
  fieldkit: 'FIELD_KIT ▸ CAMPUS_WALK',
  support: 'SUPPORT ▸ MK-I_FUNDING',
  commercial: 'COMMERCIAL ▸ DAY-1_SUPPLY',
  manifest: 'MANIFEST ▸ EIS_v1.0',
  twin: 'TWIN ▸ CAPE_TOWN_WILDFIRE',
  wildfire: 'WILDFIRE ▸ EMERGENCY_CONSOLE',
  mesh: 'FIELD_DEMO ▸ SENSOR_MESH',
  bridge: 'EVIDENCE ▸ VAULT_BRIDGE',
  terminal: 'TERMINAL ▸ CONSOLE',
  field: 'BRIDGES ▸ FIELD_ONBOARD',
  watchdog: 'WATCHDOG ▸ RAIL_HEALTH',
  receipts: 'RECEIPTS ▸ CHAIN',
  settings: 'SETTINGS ▸ PREFERENCES',
  pools: 'POOLS ▸ UBUNTU',
  docs: 'DOCUMENTS ▸ FIELD_ACCESS',
  ops: 'OPERATIONS ▸ DAY-1_LOOP',
  sphere: 'TRUST_SPHERE ▸ METRICS',
  fleet: 'FLEET ▸ DEVICE_ONBOARD',
  broadcast: 'BROADCAST ▸ CREATOR_LAYER',
  trust: 'VVU-TRUST ▸ COMPUTE_POOL',
  governance: 'GOVERNANCE ▸ PERMIT_KERNEL',
  firstprinciples: 'FIRST_PRINCIPLES ▸ SUBSTRATE',
  safegrid: 'SAFEGRID ▸ EVIDENCE_RELAY',
  skylantern: 'SKYLANTERN ▸ FIELD_EVIDENCE',
};

export default function WorkspaceToggle() {
  const [view, setView] = useHashRoute();
  const sendWormLog = useSendWormLog();
  const target = NEXT_VIEW[view];

  const handleToggle = () => {
    const from = VIEW_HASH[view];
    const to = VIEW_HASH[target];

    // 1. WORM log — localStorage (same key as the original dashboard)
    try {
      const entry = {
        ts: new Date().toISOString(),
        event: 'ROUTE_TOGGLE',
        from,
        to,
        fsm: view === 'spatial' ? 'LEAK_SIMULATION_ACTIVE' : 'STEADY_STATE_LOCKED',
      };
      const existing = JSON.parse(localStorage.getItem('vvu_events') || '[]');
      existing.push(entry);
      localStorage.setItem('vvu_events', JSON.stringify(existing.slice(-100)));
    } catch {
      /* storage full/blocked — non-fatal */
    }

    // 2. WORM log — live socket feed
    sendWormLog('ROUTE_TOGGLE', 'DASHBOARD', `${from} → ${to}`);

    // 3. Append-only audit trail (server-side)
    fetch('/api/vvu/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actor: 'OPERATOR',
        action: 'ROUTE_TOGGLE',
        fromState: `${view.toUpperCase()}_VIEW`,
        toState: `${target.toUpperCase()}_VIEW`,
        symbol: 'TOGGLE',
        reason: `Workspace toggle ${from} → ${to}`,
      }),
    }).catch(() => {
      /* offline — audit is best-effort */
    });

    toast.success(VIEW_TITLE[target], {
      description: 'WORM ROUTE_TOGGLE appended to ledger',
    });

    setView(target);
  };

  return (
    <button
      onClick={handleToggle}
      aria-label={`Switch to ${target} view`}
      className="fixed z-[60] right-3 sm:right-5 px-3 py-3 sm:px-4 bg-[#c8ff00] text-black vvu-label font-bold border border-black shadow-[3px_3px_0px_0px_#000] hover:shadow-[1px_1px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all active:scale-[0.97] min-h-[44px] text-[7.5px] sm:text-[10px] leading-none select-none whitespace-nowrap"
      style={{
        bottom: 'max(4.75rem, calc(env(safe-area-inset-bottom) + 4.5rem))',
        right: 'max(0.75rem, calc(env(safe-area-inset-right) + 0.75rem))',
      }}
    >
      {target === 'spatial' ? (
        <span className="opacity-100">◂ MAP_TWIN : OPERATOR</span>
      ) : (
        <span className="opacity-100">
          {TOGGLE_LABEL[target] ?? TOGGLE_LABEL.spatial} <span className="opacity-60">▸</span>{' '}
          <span className="opacity-60">&gt;</span>
        </span>
      )}
    </button>
  );
}
