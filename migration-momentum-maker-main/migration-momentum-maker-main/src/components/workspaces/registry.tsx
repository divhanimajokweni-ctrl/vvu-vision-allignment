// The dashboard's workspace registry — the TanStack port of the source's
// next/dynamic imports in src/app/page.tsx. Core ten surfaces load their real
// component trees; the remaining projections are queued for later migration
// passes and render the honest MIGRATING surface until their pass lands.

import { lazy } from "react";

const SpatialWorkspace = lazy(() =>
  import("@/components/spatial/SpatialWorkspace").then((m) => ({
    default: m.SpatialWorkspace,
  })),
);
const BridgeWorkspace = lazy(() =>
  import("@/components/bridge/BridgeWorkspace").then((m) => ({
    default: m.BridgeWorkspace,
  })),
);
const TerminalWorkspace = lazy(() =>
  import("@/components/terminal/TerminalWorkspace").then((m) => ({
    default: m.TerminalWorkspace,
  })),
);
const AnalyticsWorkspace = lazy(() =>
  import("@/components/analytics/AnalyticsWorkspace").then((m) => ({
    default: m.AnalyticsWorkspace,
  })),
);
const TwinWorkspace = lazy(() =>
  import("@/components/twin/TwinWorkspace").then((m) => ({
    default: m.TwinWorkspace,
  })),
);
const WatchdogWorkspace = lazy(() =>
  import("@/components/watchdog/WatchdogWorkspace").then((m) => ({
    default: m.WatchdogWorkspace,
  })),
);
const ReceiptsWorkspace = lazy(() =>
  import("@/components/receipts/ReceiptsWorkspace").then((m) => ({
    default: m.ReceiptsWorkspace,
  })),
);
const PoolsWorkspace = lazy(() =>
  import("@/components/pools/PoolsWorkspace").then((m) => ({
    default: m.PoolsWorkspace,
  })),
);
const FieldWorkspace = lazy(() =>
  import("@/components/field/FieldWorkspace").then((m) => ({
    default: m.FieldWorkspace,
  })),
);
const SettingsWorkspace = lazy(() =>
  import("@/components/settings/SettingsWorkspace").then((m) => ({
    default: m.SettingsWorkspace,
  })),
);

const SupportWorkspace = lazy(() =>
  import("@/components/support/SupportWorkspace").then((m) => ({
    default: m.SupportWorkspace,
  })),
);

const BroadcastWorkspace = lazy(() =>
  import("@/components/broadcast/BroadcastWorkspace").then((m) => ({
    default: m.BroadcastWorkspace,
  })),
);

const CapabilityWorkspace = lazy(() =>
  import("@/components/capability/CapabilityWorkspace").then((m) => ({
    default: m.CapabilityWorkspace,
  })),
);

const FieldKitWorkspace = lazy(() =>
  import("@/components/fieldkit/FieldKitWorkspace").then((m) => ({
    default: m.FieldKitWorkspace,
  })),
);

const FirstPrinciplesWorkspace = lazy(() =>
  import("@/components/firstprinciples/FirstPrinciplesWorkspace").then((m) => ({
    default: m.FirstPrinciplesWorkspace,
  })),
);

const FleetWorkspace = lazy(() =>
  import("@/components/fleet/FleetWorkspace").then((m) => ({
    default: m.FleetWorkspace,
  })),
);

const HoloComWorkspace = lazy(() =>
  import("@/components/holocom/HoloComWorkspace").then((m) => ({
    default: m.HoloComWorkspace,
  })),
);

const IcshWorkspace = lazy(() =>
  import("@/components/icsh/IcshWorkspace").then((m) => ({
    default: m.IcshWorkspace,
  })),
);

const ManifestWorkspace = lazy(() =>
  import("@/components/manifest/ManifestWorkspace").then((m) => ({
    default: m.ManifestWorkspace,
  })),
);

const MeshDemoWorkspace = lazy(() =>
  import("@/components/mesh/MeshDemoWorkspace").then((m) => ({
    default: m.MeshDemoWorkspace,
  })),
);

const MetroWorkspace = lazy(() =>
  import("@/components/metro/MetroWorkspace").then((m) => ({
    default: m.MetroWorkspace,
  })),
);

const OpsWorkspace = lazy(() =>
  import("@/components/ops/OpsWorkspace").then((m) => ({
    default: m.OpsWorkspace,
  })),
);

const ProximityWorkspace = lazy(() =>
  import("@/components/proximity/ProximityWorkspace").then((m) => ({
    default: m.ProximityWorkspace,
  })),
);

const SafeGridWorkspace = lazy(() =>
  import("@/components/safegrid/SafeGridWorkspace").then((m) => ({
    default: m.SafeGridWorkspace,
  })),
);

const SphereFrame = lazy(() =>
  import("@/components/sphere/SphereFrame").then((m) => ({
    default: m.SphereFrame,
  })),
);

const TrustWorkspace = lazy(() =>
  import("@/components/trust/TrustWorkspace").then((m) => ({
    default: m.TrustWorkspace,
  })),
);

const UrllcWorkspace = lazy(() =>
  import("@/components/urllc/UrllcWorkspace").then((m) => ({
    default: m.UrllcWorkspace,
  })),
);

const GovernanceWorkspace = lazy(() =>
  import("@/components/governance/GovernanceWorkspace").then((m) => ({
    default: m.GovernanceWorkspace,
  })),
);

const WildfireEmergencyWorkspace = lazy(() =>
  import("@/components/wildfire/WildfireEmergencyWorkspace").then((m) => ({
    default: m.WildfireEmergencyWorkspace,
  })),
);

/* Projections queued for later passes — stub surfaces. */
const stub = (label: string) =>
  lazy<React.ComponentType<unknown>>(() =>
    import("@/components/migrating/MigratingSurface").then((m) => ({
      default: () => <m.MigratingSurface label={label} />,
    })),
  );

export type WorkspaceEntry = {
  Component: React.LazyExoticComponent<React.ComponentType<unknown>>;
  label: string;
};

export const WORKSPACES: Record<string, WorkspaceEntry> = {
  spatial: { Component: SpatialWorkspace, label: "SPATIAL INTELLIGENCE" },
  bridge: { Component: BridgeWorkspace, label: "EVIDENCE · VAULT BRIDGE" },
  terminal: { Component: TerminalWorkspace, label: "TERMINAL · COMMAND CONSOLE" },
  analytics: { Component: AnalyticsWorkspace, label: "MISSION CONTROL" },
  twin: { Component: TwinWorkspace, label: "MUNICIPAL TWIN" },
  watchdog: { Component: WatchdogWorkspace, label: "WATCHDOG · RAIL HEALTH" },
  receipts: { Component: ReceiptsWorkspace, label: "RECEIPTS · CROSS-RAIL CHAIN" },
  pools: { Component: PoolsWorkspace, label: "UBUNTU POOLS" },
  field: { Component: FieldWorkspace, label: "BRIDGES · FIELD ONBOARDING" },
  settings: { Component: SettingsWorkspace, label: "SETTINGS" },

  icsh: { Component: IcshWorkspace, label: "ICSH" },
  outreach: { Component: stub("SEQUENCE ENGINE"), label: "SEQUENCE ENGINE" },
  holocom: { Component: HoloComWorkspace, label: "HOLOCOM" },
  urllc: { Component: UrllcWorkspace, label: "URLLC" },
  capability: { Component: CapabilityWorkspace, label: "CAPABILITY" },
  metro: { Component: MetroWorkspace, label: "METRO" },
  fieldkit: { Component: FieldKitWorkspace, label: "FIELDKIT" },
  support: { Component: SupportWorkspace, label: "SUPPORT · MK-I FUNDING" },
  commercial: { Component: stub("COMMERCIAL · DAY-1 SUPPLY"), label: "COMMERCIAL · DAY-1 SUPPLY" },
  manifest: { Component: ManifestWorkspace, label: "MANIFEST" },
  wildfire: { Component: WildfireEmergencyWorkspace, label: "WILDFIRE EMERGENCY VIEW" },
  mesh: { Component: MeshDemoWorkspace, label: "MESH" },
  docs: { Component: stub("DOCUMENTS · FIELD ACCESS"), label: "DOCUMENTS · FIELD ACCESS" },
  ops: { Component: OpsWorkspace, label: "OPS" },
  sphere: { Component: SphereFrame, label: "SPHERE" },
  fleet: { Component: FleetWorkspace, label: "FLEET" },
  broadcast: { Component: BroadcastWorkspace, label: "BROADCAST" },
  trust: { Component: TrustWorkspace, label: "VVU-TRUST · COMMUNITY COMPUTE" },
  governance: { Component: GovernanceWorkspace, label: "GOVERNANCE KERNEL · PERMIT GATE" },
  firstprinciples: { Component: FirstPrinciplesWorkspace, label: "FIRST PRINCIPLES · THE SUBSTRATE" },
  safegrid: { Component: SafeGridWorkspace, label: "SAFEGRID" },
  records: { Component: ProximityWorkspace, label: "RECORDS" },
  iveverify: { Component: stub("IVE · VERIFICATION LATTICE"), label: "IVE · VERIFICATION LATTICE" },
  studio: { Component: stub("VVU · STUDY STUDIO"), label: "VVU · STUDY STUDIO" },
  fluid: { Component: stub("FLUID STUDIO"), label: "FLUID STUDIO" },
};
