'use client';

// src/app/page.tsx — VVU Validation Dashboard · single-route projection
// estate. Task 47 wires the FULL estate: the keyboard spec's ten fixed
// surfaces (aliases included — see use-hash-route.ts) plus every historic
// projection.
//
//   THE TEN FIXED SURFACES (keyboard-map.json is the binding source):
//     Ctrl+1  #/ive      → SPATIAL_INTELLIGENCE (the primary instrument view)
//     Ctrl+2  #/evidence → BRIDGE (the vault-bridge evidence chain)
//     Ctrl+3  #/terminal → TERMINAL (command console)
//     Ctrl+4  #/mission  → ANALYTICS (mission control · gates · WORM)
//     Ctrl+5  #/twin     → MUNICIPAL TWIN (the spatial twin artifact)
//     Ctrl+6  #/watchdog → WATCHDOG (rail health · SLA)
//     Ctrl+7  #/receipts → RECEIPTS (cross-rail chain)
//     Ctrl+8  #/pools    → UBUNTU POOLS (community pool view)
//     Ctrl+9  #/bridges  → FIELD (device pairing rails · paired nodes)
//     Ctrl+0  #/settings → SETTINGS (Lindiwe memory · pins · preferences)
//
//   ESTATE PROJECTIONS: outreach · holocom · capability · metro · urllc ·
//   fieldkit · support · commercial · manifest · wildfire · mesh · docs ·
//   ops · sphere (the trust-sphere metrics surface).
//
// Task 48 — three projections recovered from the lost r31–r45 lineage
// (preserved in the /tmp snapshot, wired fresh here): fleet (device fleet
// & onboarding, docs from disk) · broadcast (creator layer) · trust
// (VVU-TRUST community compute pool). #/twin upgraded to the r34
// TwinWorkspace (header band + loading state + WORM-logged standalone).
//
// Task 47 also mounts:
//   · the vanilla keyboard layer + Lindiwe + pinnable panels (loaded from
//     public/vvu-trust/surfaces/dashboard/ — keyboard-map.json is the
//     single source of truth for every binding)
//   · the PiP bridge (a popped-out visual view renders a placeholder here)
//   · the action bridge (Ctrl+R refresh invalidates every query, etc.)

import dynamic from 'next/dynamic';
import Script from 'next/script';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useHashRoute } from '@/hooks/use-hash-route';
import { VvuHeader } from '@/components/vvu/VvuHeader';
import { VvuFooter } from '@/components/vvu/VvuFooter';
import WorkspaceToggle from '@/components/WorkspaceToggle';
import { CommandPalette } from '@/components/vvu/CommandPalette';
import { ShortcutHelp } from '@/components/vvu/ShortcutHelp';

const IcshWorkspace = dynamic(
  () => import('@/components/icsh/IcshWorkspace').then((m) => m.IcshWorkspace),
  { ssr: false, loading: () => <ViewLoader label="INITIALIZING 4TH STATE · CONTRACT ON CHAIN…" /> }
);

const SpatialWorkspace = dynamic(
  () => import('@/components/spatial/SpatialWorkspace').then((m) => m.SpatialWorkspace),
  { ssr: false, loading: () => <ViewLoader label="INITIALIZING SPATIAL INTELLIGENCE…" /> }
);

const AnalyticsWorkspace = dynamic(
  () => import('@/components/analytics/AnalyticsWorkspace').then((m) => m.AnalyticsWorkspace),
  { ssr: false, loading: () => <ViewLoader label="INITIALIZING MISSION CONTROL…" /> }
);

const OutreachWorkspace = dynamic(
  () => import('@/components/outreach/OutreachWorkspace').then((m) => m.OutreachWorkspace),
  { ssr: false, loading: () => <ViewLoader label="INITIALIZING SEQUENCE ENGINE…" /> }
);

const HoloComWorkspace = dynamic(
  () => import('@/components/holocom/HoloComWorkspace').then((m) => m.HoloComWorkspace),
  { ssr: false, loading: () => <ViewLoader label="INITIALIZING HOLOCOM · 6G NeXt…" /> }
);

const CapabilityWorkspace = dynamic(
  () => import('@/components/capability/CapabilityWorkspace').then((m) => m.CapabilityWorkspace),
  { ssr: false, loading: () => <ViewLoader label="INITIALIZING CAPABILITY DOSSIER…" /> }
);

const MetroWorkspace = dynamic(
  () => import('@/components/metro/MetroWorkspace').then((m) => m.MetroWorkspace),
  { ssr: false, loading: () => <ViewLoader label="INITIALIZING PROOFBRIDGE METRO…" /> }
);

const UrllcWorkspace = dynamic(
  () => import('@/components/urllc/UrllcWorkspace').then((m) => m.UrllcWorkspace),
  { ssr: false, loading: () => <ViewLoader label="INITIALIZING URLLC+ NEURAL EDGE…" /> }
);

const FieldKitWorkspace = dynamic(
  () => import('@/components/fieldkit/FieldKitWorkspace').then((m) => m.FieldKitWorkspace),
  { ssr: false, loading: () => <ViewLoader label="INITIALIZING FIELD KIT · CAMPUS WALK…" /> }
);

const SupportWorkspace = dynamic(
  () => import('@/components/support/SupportWorkspace').then((m) => m.SupportWorkspace),
  { ssr: false, loading: () => <ViewLoader label="INITIALIZING SUPPORT · MK-I FUNDING ENDPOINT…" /> }
);

const ManifestWorkspace = dynamic(
  () => import('@/components/manifest/ManifestWorkspace').then((m) => m.ManifestWorkspace),
  { ssr: false, loading: () => <ViewLoader label="INITIALIZING ESTATE MANIFEST · EIS v1.0…" /> }
);

const TwinWorkspace = dynamic(
  () => import('@/components/twin/TwinWorkspace').then((m) => m.TwinWorkspace),
  { ssr: false, loading: () => <ViewLoader label="INITIALIZING MUNICIPAL TWIN · CAPE TOWN WILDFIRE…" /> }
);

const WildfireEmergencyWorkspace = dynamic(
  () => import('@/components/wildfire/WildfireEmergencyWorkspace').then((m) => m.WildfireEmergencyWorkspace),
  { ssr: false, loading: () => <ViewLoader label="INITIALIZING WILDFIRE EMERGENCY VIEW · WINTER POOLS…" /> }
);

const MeshDemoWorkspace = dynamic(
  () => import('@/components/mesh/MeshDemoWorkspace').then((m) => m.MeshDemoWorkspace),
  { ssr: false, loading: () => <ViewLoader label="INITIALIZING FIELD DEMO · SENSOR MESH · :3007…" /> }
);

/* Task 47 — the wired-orphan surfaces (built in lost sessions 36–46,
   unreachable until now) + the two new builds */
const BridgeWorkspace = dynamic(
  () => import('@/components/bridge/BridgeWorkspace').then((m) => m.BridgeWorkspace),
  { ssr: false, loading: () => <ViewLoader label="INITIALIZING EVIDENCE · VAULT BRIDGE…" /> }
);

const TerminalWorkspace = dynamic(
  () => import('@/components/terminal/TerminalWorkspace').then((m) => m.TerminalWorkspace),
  { ssr: false, loading: () => <ViewLoader label="INITIALIZING TERMINAL · COMMAND CONSOLE…" /> }
);

const FieldWorkspace = dynamic(
  () => import('@/components/field/FieldWorkspace').then((m) => m.FieldWorkspace),
  { ssr: false, loading: () => <ViewLoader label="INITIALIZING BRIDGES · FIELD ONBOARDING · :3005…" /> }
);

const WatchdogWorkspace = dynamic(
  () => import('@/components/watchdog/WatchdogWorkspace').then((m) => m.WatchdogWorkspace),
  { ssr: false, loading: () => <ViewLoader label="INITIALIZING WATCHDOG · RAIL HEALTH…" /> }
);

const ReceiptsWorkspace = dynamic(
  () => import('@/components/receipts/ReceiptsWorkspace').then((m) => m.ReceiptsWorkspace),
  { ssr: false, loading: () => <ViewLoader label="INITIALIZING RECEIPTS · CROSS-RAIL CHAIN…" /> }
);

const SettingsWorkspace = dynamic(
  () => import('@/components/settings/SettingsWorkspace').then((m) => m.SettingsWorkspace),
  { ssr: false, loading: () => <ViewLoader label="INITIALIZING SETTINGS…" /> }
);

const PoolsWorkspace = dynamic(
  () => import('@/components/pools/PoolsWorkspace').then((m) => m.PoolsWorkspace),
  { ssr: false, loading: () => <ViewLoader label="INITIALIZING UBUNTU POOLS…" /> }
);

const OpsWorkspace = dynamic(
  () => import('@/components/ops/OpsWorkspace').then((m) => m.OpsWorkspace),
  { ssr: false, loading: () => <ViewLoader label="INITIALIZING OPERATIONS LOOP…" /> }
);

const SphereFrame = dynamic(
  () => import('@/components/sphere/SphereFrame').then((m) => m.SphereFrame),
  { ssr: false, loading: () => <ViewLoader label="INITIALIZING TRUST SPHERE · METRICS SURFACE…" /> }
);

/* Task 48 — the recovered lost-lineage projections (built in lost rounds
   31–37, preserved in the /tmp snapshot, wired here) */
const FleetWorkspace = dynamic(
  () => import('@/components/fleet/FleetWorkspace').then((m) => m.FleetWorkspace),
  { ssr: false, loading: () => <ViewLoader label="INITIALIZING DEVICE FLEET & ONBOARDING…" /> }
);

const BroadcastWorkspace = dynamic(
  () => import('@/components/broadcast/BroadcastWorkspace').then((m) => m.BroadcastWorkspace),
  { ssr: false, loading: () => <ViewLoader label="INITIALIZING BROADCAST · CREATOR LAYER…" /> }
);

const TrustWorkspace = dynamic(
  () => import('@/components/trust/TrustWorkspace').then((m) => m.TrustWorkspace),
  { ssr: false, loading: () => <ViewLoader label="INITIALIZING VVU-TRUST · COMMUNITY COMPUTE POOL…" /> }
);

/* Round 56 — the governance kernel (SIL permit slice) + the first-principles
   projection (the laws beneath the signals). */
const GovernanceWorkspace = dynamic(
  () => import('@/components/governance/GovernanceWorkspace').then((m) => m.GovernanceWorkspace),
  { ssr: false, loading: () => <ViewLoader label="INITIALIZING GOVERNANCE KERNEL · PERMIT GATE…" /> }
);

const FirstPrinciplesWorkspace = dynamic(
  () => import('@/components/firstprinciples/FirstPrinciplesWorkspace').then((m) => m.FirstPrinciplesWorkspace),
  { ssr: false, loading: () => <ViewLoader label="INITIALIZING FIRST PRINCIPLES · THE SUBSTRATE…" /> }
);

/* Round 57 — the SafeGrid ▸ evidence-relay operator console (the 30th
   projection): fail-closed suppression decisions, the transactional
   outbox, the relay worker, the VVU WORM seal chain. */
const SafeGridWorkspace = dynamic(
  () => import('@/components/safegrid/SafeGridWorkspace').then((m) => m.SafeGridWorkspace),
  { ssr: false, loading: () => <ViewLoader label="INITIALIZING SAFEGRID ▸ EVIDENCE_RELAY…" /> }
);

/* Skylantern — the evidence architecture digital twin with a fullscreen
   maplibre-gl 3D map. The map takes the ENTIRE viewport; panels are
   overlays, not sidebars. Access at #/skylantern or #/lantern. */
const SkylanternDashboard = dynamic(
  () => import('@/skylantern/components/Dashboard').then((m) => m.SkylanternDashboard),
  { ssr: false, loading: () => <ViewLoader label="INITIALIZING SKYLANTERN · EVIDENCE DIGITAL TWIN…" /> }
);

function ViewLoader({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#060806]">
      <div className="text-center">
        <div className="vvu-label text-2xl font-bold text-[#f3e38a] tracking-[0.3em]">VVU</div>
        <div className="vvu-label text-[9px] text-[#7a8a6e] mt-3 animate-pulse">{label}</div>
      </div>
    </div>
  );
}

/* ── the PiP bridge: a popped-out visual view shows a placeholder ── */

const VIEW_LABEL: Record<string, string> = {
  twin: 'SPATIAL TWIN',
  sphere: 'TRUST SPHERE',
  mesh: 'SENSOR MESH',
};

function PoppedOutPlaceholder({ view, onRestore }: { view: string; onRestore: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#060806]">
      <button
        type="button"
        onClick={onRestore}
        className="group text-center border border-[rgba(107,138,64,0.4)] rounded-md px-8 py-6 hover:border-[rgba(200,255,0,0.55)] transition-colors"
      >
        <div className="vvu-label text-[9px] text-[#7a8a6e] tracking-[0.24em]">
          {VIEW_LABEL[view] ?? view.toUpperCase()} · LIVE IN ITS OWN WINDOW
        </div>
        <div className="vvu-label text-[13px] text-[#c8ff00] tracking-[0.18em] mt-3">
          POPPED OUT — CLICK TO RESTORE
        </div>
        <div className="vvu-label text-[8px] text-[#4a5744] tracking-[0.16em] mt-3">
          ESC IN THE POP-OUT WINDOW RESTORES IT TOO
        </div>
      </button>
    </div>
  );
}

function usePoppedView(): [string | null, () => void] {
  const [popped, setPopped] = useState<string | null>(null);

  useEffect(() => {
    const onOpened = (e: Event) => {
      const detail = (e as CustomEvent<{ view: string }>).detail;
      if (detail && detail.view) setPopped(detail.view);
    };
    const onClosed = () => setPopped(null);
    window.addEventListener('vvu:pip:opened', onOpened);
    window.addEventListener('vvu:pip:closed', onClosed);
    return () => {
      window.removeEventListener('vvu:pip:opened', onOpened);
      window.removeEventListener('vvu:pip:closed', onClosed);
    };
  }, []);

  const restore = () => {
    const pins = (window as unknown as { VvuPins?: { closePip: () => boolean } }).VvuPins;
    if (pins) pins.closePip();
    setPopped(null);
  };
  return [popped, restore];
}

/* ── the action bridge: the estate's real handlers for the verbs ──
   Everything else dispatches 'vvu:action' — surfaces claim what they own;
   unclaimed actions get the keyboard layer's honest status line. */

function ActionBridge() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const onAction = (e: Event) => {
      const detail = (e as CustomEvent<{ action: string; handled: boolean }>).detail;
      if (!detail) return;
      if (detail.action === 'refresh') {
        detail.handled = true;
        void queryClient.invalidateQueries();
        toast('REFRESH — ALL QUERIES INVALIDATED', {
          description: 'bypassed cache — every surface refetches from source',
        });
      }
    };
    window.addEventListener('vvu:action', onAction);
    return () => window.removeEventListener('vvu:action', onAction);
  }, [queryClient]);

  return null;
}

export default function Home() {
  const [view] = useHashRoute();
  const [popped, restorePopped] = usePoppedView();

  const workspace =
    view === 'icsh' ? (
      <IcshWorkspace />
    ) : view === 'analytics' ? (
      <AnalyticsWorkspace />
    ) : view === 'outreach' ? (
      <OutreachWorkspace />
    ) : view === 'holocom' ? (
      <HoloComWorkspace />
    ) : view === 'urllc' ? (
      <UrllcWorkspace />
    ) : view === 'capability' ? (
      <CapabilityWorkspace />
    ) : view === 'metro' ? (
      <MetroWorkspace />
    ) : view === 'fieldkit' ? (
      <FieldKitWorkspace />
    ) : view === 'support' ? (
      <SupportWorkspace />
    ) : view === 'manifest' ? (
      <ManifestWorkspace />
    ) : view === 'twin' ? (
      <TwinWorkspace />
    ) : view === 'wildfire' ? (
      <WildfireEmergencyWorkspace />
    ) : view === 'mesh' ? (
      <MeshDemoWorkspace />
    ) : view === 'bridge' ? (
      <BridgeWorkspace />
    ) : view === 'terminal' ? (
      <TerminalWorkspace />
    ) : view === 'field' ? (
      <FieldWorkspace />
    ) : view === 'watchdog' ? (
      <WatchdogWorkspace />
    ) : view === 'receipts' ? (
      <ReceiptsWorkspace />
    ) : view === 'settings' ? (
      <SettingsWorkspace />
    ) : view === 'pools' ? (
      <PoolsWorkspace />
    ) : view === 'ops' ? (
      <OpsWorkspace />
    ) : view === 'sphere' ? (
      <SphereFrame />
    ) : view === 'fleet' ? (
      <FleetWorkspace />
    ) : view === 'broadcast' ? (
      <BroadcastWorkspace />
    ) : view === 'trust' ? (
      <TrustWorkspace />
    ) : view === 'governance' ? (
      <GovernanceWorkspace />
    ) : view === 'firstprinciples' ? (
      <FirstPrinciplesWorkspace />
    ) : view === 'safegrid' ? (
      <SafeGridWorkspace />
    ) : view === 'skylantern' ? (
      <SkylanternDashboard />
    ) : (
      <SpatialWorkspace />
    );

  return (
    <div className="min-h-screen flex flex-col bg-[#060806] text-[#c9d4bd]">
      {/* Task 47 — the vanilla keyboard stack (map → tutor → pins → layer).
          keyboard-map.json is the single source of truth; these files only
          implement it. lazyOnload: these are chrome, not critical path —
          injecting after the page's load event keeps them clear of the dev
          server's on-demand compile window (afterInteractive raced page
          compiles and intermittently 404'd). */}
      <Script src="/vvu-trust/surfaces/dashboard/lindiwe.js" strategy="lazyOnload" />
      <Script src="/vvu-trust/surfaces/dashboard/pinnable-panels.js" strategy="lazyOnload" />
      <Script src="/vvu-trust/surfaces/dashboard/keyboard-layer.js" strategy="lazyOnload" />
      <VvuHeader />
      <main className="relative flex-1 min-h-0 overflow-hidden">
        {popped && popped === view ? (
          <PoppedOutPlaceholder view={popped} onRestore={restorePopped} />
        ) : (
          workspace
        )}
      </main>
      <VvuFooter />
      <WorkspaceToggle />
      <CommandPalette />
      <ShortcutHelp />
      <ActionBridge />
    </div>
  );
}
