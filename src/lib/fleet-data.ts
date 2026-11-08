// src/lib/fleet-data.ts — Round 33 · DEVICE FLEET & ONBOARDING (fourteenth
// projection). Metadata + structured surfaces for #/fleet.
//
// PROVENANCE MODEL (per-doc, honest):
//   · OPERATOR VERBATIM — the operator pasted the full text this round;
//     written to disk exactly, restored tables/headers only.
//   · WRITTEN THIS ROUND — referenced by the operator as part of the fleet
//     layer ("the earlier set") but not present on disk → written to the
//     standing pattern (spec first, on the word).
//   · NEXT ARTIFACT — the runtime the operator proposed at the end of the
//     fleet delivery; authored in the operator voice.
//
// Doc BODIES are NOT forked into this file — the workspace renders them from
// disk via /api/vvu/fleet-docs (single source of truth, same pattern as the
// Round 32 twin docs).

// ── Provenance ───────────────────────────────────────────────────────────────

export type FleetProvenance = 'OPERATOR VERBATIM' | 'WRITTEN THIS ROUND' | 'NEXT ARTIFACT';

export const FLEET_PROVENANCE_NOTE =
  'Three artifacts arrived as full text this round (discovery, consent, onboarding) and were written to disk exactly as delivered. The mesh spec and pipeline catalog were named as the earlier fleet set but were not on disk — written this round to the standing pattern. The pipeline engine spec is the proposed next artifact, authored to close the loop: five specs, one running mesh. The blog post publishes as-is, quotes pulled from the onboarding flow, hero image generated.';

// ── Doc registry ─────────────────────────────────────────────────────────────

export interface FleetDocMeta {
  id: 'mesh_spec' | 'discovery' | 'consent' | 'onboarding' | 'pipeline_catalog' | 'pipeline_engine' | 'blog_post';
  path: string;
  title: string;
  subtitle: string;
  provenance: FleetProvenance;
  /** Rendered badge colour logic uses provenance; icon picked in the view. */
}

export const FLEET_DOCS: FleetDocMeta[] = [
  {
    id: 'mesh_spec',
    path: 'vvu-trust/fleet/DEVICE_MESH_SPEC.md',
    title: 'Device Mesh Spec — v0',
    subtitle: 'The sensor fabric · three node classes · the 11-channel registry · the reading envelope',
    provenance: 'WRITTEN THIS ROUND',
  },
  {
    id: 'discovery',
    path: 'vvu-trust/fleet/DEVICE_DISCOVERY_PROTOCOL.md',
    title: 'Device Discovery Protocol — v0',
    subtitle: 'Four channels (LAN · BLE · cloud · pre-registered) · dedup · the one-screen census',
    provenance: 'OPERATOR VERBATIM',
  },
  {
    id: 'consent',
    path: 'vvu-trust/fleet/UNIFIED_CONSENT_MODEL.md',
    title: 'Unified Consent Model — v0',
    subtitle: 'Four grantors (owner · admin · collective · delegate) · windows · revocation · the chain is the record',
    provenance: 'OPERATOR VERBATIM',
  },
  {
    id: 'onboarding',
    path: 'vvu-trust/fleet/ONBOARDING_FLOW.md',
    title: 'Onboarding Flow — v0',
    subtitle: 'Ten minutes, ten steps, zero typing · the QR fallback · what happens when the operator leaves',
    provenance: 'OPERATOR VERBATIM',
  },
  {
    id: 'pipeline_catalog',
    path: 'vvu-trust/fleet/PIPELINE_CATALOG.md',
    title: 'Pipeline Catalog — v0',
    subtitle: 'Ten pipeline manifests · channels in, decisions out · what a pipeline cannot do',
    provenance: 'WRITTEN THIS ROUND',
  },
  {
    id: 'pipeline_engine',
    path: 'vvu-trust/fleet/PIPELINE_ENGINE_SPEC.md',
    title: 'Pipeline Engine Spec — v0',
    subtitle: 'The runtime that turns the five specs into one running mesh · the 7 stages · FAIL CLOSED',
    provenance: 'NEXT ARTIFACT',
  },
  {
    id: 'blog_post',
    path: 'vvu-trust/blog/2026-09-20-four-smart-purchases-one-mesh.md',
    title: 'Four smart purchases, one mesh',
    subtitle: 'Published 2026-09-20 · the residential pitch · four products, eleven channels',
    provenance: 'OPERATOR VERBATIM',
  },
];

// ── The blog post — published ────────────────────────────────────────────────

export const BLOG_META = {
  title: 'Four smart purchases, one mesh',
  date: '2026-09-20',
  author: 'VVU Editorial',
  tags: ['mesh', 'residential', 'energy', 'evidence'] as const,
  status: 'PUBLISHED',
  hero: 'assets/hero-four-smart-purchases.jpg',
  heroAlt: 'A phone showing the mesh PWA with a live thermal overlay',
  pullLine: 'Four devices. Four separate apps. One mesh. One dashboard.',
};

/** The four purchases and their channels — from the published post. */
export const BLOG_PURCHASES: { product: string; channels: string[]; note: string }[] = [
  {
    product: 'Thermal camera (phone plug-in)',
    channels: ['thermal'],
    note: 'Same channel the structural-motion and machinery-health pipelines read from the phone sensors — the external camera just makes it better.',
  },
  {
    product: 'Instant hot water dispenser',
    channels: ['flow_rate', 'temperature'],
    note: 'A home with one produces more heat samples per minute — already signed by the device\u2019s own controller.',
  },
  {
    product: 'Portable power station + solar',
    channels: ['battery_soc', 'solar_output', 'grid_status'],
    note: 'A home with a SOLIX is a 1-node microgrid. The pipeline does not care whether the battery is a farm borehole bank or a kitchen backup.',
  },
  {
    product: 'Battery circulator fan',
    channels: ['fan_state', 'power_draw'],
    note: 'A deferrable load. The mesh knows how to defer it — that is the dispatch decision the microgrid pipeline automates.',
  },
];

export const BLOG_QUOTE_SOURCES: string[] = [
  '"Every step after minute 1 is a tap. Nothing requires typing."',
  '"9 minutes 42 seconds from arrival to live mesh."',
  '"The devices were already there. The network was already there."',
  '"Walk in. Scan. Tap. Walk out. Ten minutes."',
];

// ── Discovery — the four channels ────────────────────────────────────────────

export interface DiscoveryChannel {
  id: string;
  name: string;
  method: string;
  latency: string;
  consent: string;
  cadence: string;
  catches: string;
}

export const DISCOVERY_CHANNELS: DiscoveryChannel[] = [
  {
    id: 'lan',
    name: 'LOCAL NETWORK',
    method: 'mDNS + SSDP + ARP scan + vendor OUI lookup',
    latency: '< 5 s',
    consent: 'Per-device tap',
    cadence: 'every 60 s',
    catches: 'Chromecasts, AirPlay, printers, NAS, cameras, UPnP TVs — everything on the LAN, including silent devices.',
  },
  {
    id: 'ble',
    name: 'BLUETOOTH',
    method: 'Passive scan + RSSI ranking + SIG company IDs',
    latency: '< 10 s',
    consent: 'Per-device tap',
    cadence: 'every 30 s',
    catches: 'Watches, wearables, beacons. Strong signal = same room; weak signal = a neighbour\u2019s device, deprioritised.',
  },
  {
    id: 'cloud',
    name: 'CLOUD-LINKED',
    method: 'OAuth to provider APIs (Tuya · SmartThings · HomeKit · Nest)',
    latency: '< 60 s',
    consent: 'OAuth grant',
    cadence: 'on link',
    catches: 'Devices already on a vendor cloud. Token stored encrypted, used only to poll status, never transmitted off-property.',
  },
  {
    id: 'registered',
    name: 'PRE-REGISTERED',
    method: 'Signed mDNS record, Ed25519 factory keypair',
    latency: 'instant',
    consent: 'Pre-authorised',
    cadence: 'always on',
    catches: 'Mk-0.5 nodes and Pro Tablets. Signature verified, added automatically — consent is per-pipeline, not per-device.',
  },
];

export const DISCOVERY_DEDUP = [
  'MAC address (highest priority)',
  'Cloud device ID (if exposed by the vendor)',
  'BLE advertised name + vendor (lowest priority)',
];

export const DISCOVERY_NOT_DO: string[] = [
  'It does not automatically join any device to any pipeline.',
  'It does not read any device data.',
  'It does not store credentials for non-cloud devices.',
  'It does not phone home. All discovery is local.',
];

export const DISCOVERY_ONE_LINER = 'Discovery is a census, not a subscription. Consent is the next step.';

// ── Consent — the four grantors ──────────────────────────────────────────────

export interface ConsentGrantor {
  id: string;
  name: string;
  grants: string;
  example: string;
  act: string;
}

export const CONSENT_GRANTORS: ConsentGrantor[] = [
  {
    id: 'owner',
    name: 'OWNER',
    grants: 'Their own devices',
    example: 'Farmer taps to join their phone',
    act: 'One tap',
  },
  {
    id: 'admin',
    name: 'ADMIN',
    grants: 'Any device on a network they control',
    example: 'Farm manager joins all cameras on the farm LAN',
    act: 'One signature (Ed25519 scope)',
  },
  {
    id: 'collective',
    name: 'COLLECTIVE',
    grants: 'Shared assets by vote',
    example: 'Co-op votes to share the community pump data',
    act: 'One vote (majority, veto on proven harm)',
  },
  {
    id: 'delegate',
    name: 'DELEGATE',
    grants: 'On behalf of another person, with proof',
    example: 'Adult child joins elderly parent\u2019s watch',
    act: 'One signature (accepted by the device)',
  },
];

export const CONSENT_SCOPES: { scope: string; meaning: string }[] = [
  { scope: 'session', meaning: 'Expires at expires_at — the default' },
  { scope: 'daily', meaning: 'Auto-renews at local midnight for N days' },
  { scope: 'while_employed', meaning: 'Valid until revocation by admin' },
  { scope: 'lifetime', meaning: 'Valid until explicit revocation (rare)' },
];

export const CONSENT_REVOCATION_RULES: string[] = [
  'Revocation is immediate. No grace period.',
  'Any stream received after the revocation timestamp is rejected by the pipeline engine.',
  'Historical data collected under the previous consent remains in the chain (coarsened per pipeline rules).',
  'Revocation is irreversible. Re-granting requires a new consent event.',
];

export const CONSENT_ONE_LINER = 'Consent is not assumed. Consent is the first event.';

// ── Onboarding — the 10-minute timeline ──────────────────────────────────────

export const ONBOARDING_TIMELINE: { minute: string; step: string }[] = [
  { minute: '0:00', step: 'Operator arrives with tablet' },
  { minute: '0:30', step: 'Tablet connected to farm Wi-Fi' },
  { minute: '1:00', step: 'Aggregator started' },
  { minute: '1:30', step: 'Discovery scan completes' },
  { minute: '2:00', step: 'Operator reviews discovered devices' },
  { minute: '4:00', step: 'Bulk admin consent granted' },
  { minute: '6:00', step: 'Per-device review of non-admin devices' },
  { minute: '8:00', step: 'Pipelines assigned' },
  { minute: '9:00', step: 'Consent events chained' },
  { minute: '10:00', step: 'Mesh live, first telemetry visible' },
];

export const ONBOARDING_ELAPSED = '9 minutes 42 seconds from arrival to live mesh';

export const ONBOARDING_NOT_DO: string[] = [
  'It does not require typing a password.',
  'It does not require the operator to know the device\u2019s IP.',
  'It does not require the device to run any special software.',
  'It does not require internet.',
  'It does not require the operator to be technically skilled.',
];

export const ONBOARDING_ONE_LINER = 'Walk in. Scan. Tap. Walk out. Ten minutes.';

// ── The engine — 7 stages ─────────────────────────────────────────────────────

export interface EngineStage {
  n: number;
  stage: string;
  what: string;
  failure: string;
}

export const ENGINE_STAGES: EngineStage[] = [
  { n: 1, stage: 'DECODE', what: 'Envelope parsed, channel typed', failure: 'Unknown type → DROP, chained' },
  { n: 2, stage: 'VERIFY', what: 'Ed25519 over device_id‖channel‖ts‖value‖seq', failure: 'Bad sig → DROP · quarantine after 3' },
  { n: 3, stage: 'CONSENT', what: 'Channel + device inside an active window', failure: 'No window → DROP — not read at all' },
  { n: 4, stage: 'SEQUENCE', what: 'seq monotonic per device', failure: 'Gap → chained, replay honoured, marked' },
  { n: 5, stage: 'MERGE', what: 'Ring buffer + state rebuilt at cadence', failure: 'Stale > window → pipeline sees STALE, decides nothing' },
  { n: 6, stage: 'DECIDE', what: 'Manifest rules fire against merged state', failure: 'No rule matched → NO_DECISION, still chained' },
  { n: 7, stage: 'EMIT', what: 'Decision + causative readings coarsened, signed, chained', failure: 'Chain write fails → engine halts' },
];

export const ENGINE_PROPERTIES: { title: string; body: string }[] = [
  {
    title: 'NO STAGE BEFORE 3',
    body: 'An unconseted reading never reaches merge, decide, or emit. It is not read, not buffered, not counted.',
  },
  {
    title: 'NOTHING WITHOUT 7',
    body: 'A decision that cannot be chained does not exist. The chain write is part of the decision, not a log line after it.',
  },
  {
    title: 'FAIL CLOSED',
    body: 'Engine crash → devices keep reading, nodes keep buffering, the chain on disk stands. Chain write failure → the engine halts entirely. Kill the engine and you have a farm that records everything and decides nothing — annoying, honest, recoverable.',
  },
];

export const ENGINE_ONE_LINER =
  'The engine has no opinions — the manifests hold the opinions, the chain holds the reasons, and the engine refuses ever to confuse the two.';

// ── The fleet stack — how the five docs bind ────────────────────────────────

export const FLEET_STACK: { layer: string; doc: string; role: string }[] = [
  { layer: 'FABRIC', doc: 'DEVICE_MESH_SPEC.md', role: 'Everything that produces a channel is a node; every reading signed, chained' },
  { layer: 'FIND', doc: 'DEVICE_DISCOVERY_PROTOCOL.md', role: 'The census — four channels, one screen, no credentials' },
  { layer: 'PERMIT', doc: 'UNIFIED_CONSENT_MODEL.md', role: 'The first event — four grantors, windows, revocation, all chained' },
  { layer: 'BIND', doc: 'ONBOARDING_FLOW.md', role: 'Ten minutes from arrival to live mesh, zero typing' },
  { layer: 'RUN', doc: 'PIPELINE_CATALOG.md → PIPELINE_ENGINE_SPEC.md', role: 'Ten manifests, one engine, one chain' },
];
