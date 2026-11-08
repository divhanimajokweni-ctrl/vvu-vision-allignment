// src/lib/manifest-data.ts — Task 43 · the LAUNCH MANIFEST ledger.
//
// Single source of truth for the `/#/manifest` projection — every verified,
// tested, operational item in the estate, in the operator's own 13-section
// structure (A–M). Ported 1:1 from the source document "LAUNCH MANIFEST —
// EVERY GREEN LIGHT" (uploaded 2026-09-16); state labels preserved verbatim.
//
// HONESTY NOTE (doctrine: nothing is claimed green that isn't):
//   The source document's prose SUMMARY said "Total green items: 94", but
//   its own tile enumeration counts 78 PROVEN + 11 READY + 4 BLOCKED = 93
//   items. This build makes no hardcoded count claims anywhere — every number
//   on the view is DERIVED from this ledger at render time. The ledger wins
//   over the prose, every time, by construction.
//
// ZERO runtime dependencies. Hand-typed, one maintainer (hostile-dependency
// doctrine).

export type ManifestState = 'proven' | 'ready' | 'blocked';

export interface ManifestItem {
  /** Section letter + number, e.g. "A1". */
  id: string;
  /** Short tile title. */
  name: string;
  /** Status line under the title (verbatim from the manifest). */
  detail: string;
  /** Rail/dot state — proven green · ready gold · blocked red. */
  state: ManifestState;
  /** Extra evidence shown in the tile's title tooltip + expandable row. */
  meta?: string;
}

export interface ManifestSection {
  /** Scroll anchor id, e.g. "sec-a". */
  key: string;
  /** Section letter, e.g. "A". */
  code: string;
  /** Section title, e.g. "Live Services". */
  title: string;
  /** Parenthetical from the manifest header, e.g. "(running now)". */
  subtitle: string;
  items: ManifestItem[];
}

// ── the ledger ──────────────────────────────────────────────────────────────

export const MANIFEST_SECTIONS: readonly ManifestSection[] = [
  {
    key: 'sec-a',
    code: 'A',
    title: 'Live Services',
    subtitle: 'running now',
    items: [
      { id: 'A1', name: 'Next.js dashboard', detail: ':3000 · GET / → 200', state: 'proven', meta: 'next-server v16.1.3' },
      { id: 'A2', name: 'Telemetry mini-service', detail: ':3003 · /healthz → 200', state: 'proven', meta: 'bun runtime' },
      { id: 'A3', name: 'Vault bridge', detail: ':3004 · 22/22 adversarial PASS', state: 'proven', meta: 'receipts chain VALID' },
      { id: 'A4', name: 'Field onboard', detail: ':3005 · 33/33 adversarial PASS', state: 'proven', meta: 'Ed25519 binding live' },
      { id: 'A5', name: 'Caddy gateway', detail: ':81 · proxy OK', state: 'proven', meta: 'routes :3000 + XTransformPort 3003/3004/3005' },
    ],
  },
  {
    key: 'sec-b',
    code: 'B',
    title: 'Bridge Engine',
    subtitle: 'Tasks 36–40, shipped',
    items: [
      { id: 'B1', name: ':3004 vault bridge', detail: '20/20 → 22/22 re-verified', state: 'proven' },
      { id: 'B2', name: ':3005 field bridge', detail: '33/33', state: 'proven' },
      { id: 'B3', name: 'Obsidian vault plugin', detail: 'installed · correct unpaired state', state: 'proven', meta: 'on phone' },
      { id: 'B4', name: 'Obsidian field plugin', detail: 'same engine · Ed25519', state: 'proven' },
      { id: 'B5', name: 'Task 39 full-chain', detail: 'tier/anchor/POPIA/HUD · 20/20', state: 'proven', meta: 'commit 01821a8 · 49-receipt mixed v1/v2 chain genesis-verified' },
      { id: 'B6', name: 'Task 40 write-safety', detail: 'Merkle/integrity · 71/71 + 22/22 + 33/33', state: 'proven', meta: 'commit 179ccd3' },
      { id: 'B7', name: 'FINAL_GO_LIVE_EVIDENCE.md', detail: 'receipt 1b9fc33f · CHAIN VALID', state: 'proven', meta: 'sha256 f743aa90…' },
      { id: 'B8', name: 'Cron 388477', detail: 'active · 15-min webDevReview', state: 'proven' },
    ],
  },
  {
    key: 'sec-c',
    code: 'C',
    title: 'MCP Control Plane + Validator',
    subtitle: '16 Sep',
    items: [
      { id: 'C1', name: 'mcp_event.py', detail: 'schema + 3-axis state machine', state: 'proven' },
      { id: 'C2', name: 'fixtures.py — 7 forgery classes', detail: '7/7 PASS', state: 'proven' },
      { id: 'C3', name: 'Self-attestation guard', detail: 'rejected at record_observed() entry', state: 'proven' },
      { id: 'C4', name: 'Unsigned signer rejected', detail: 'validator catches', state: 'proven' },
      { id: 'C5', name: 'Post-signature tamper caught', detail: 'hash recompute mismatch', state: 'proven' },
      { id: 'C6', name: 'Impostor control plane rejected', detail: 'SIGNATURE_INVALID', state: 'proven' },
      { id: 'C7', name: 'Deployment-without-verification', detail: 'caught by ControlPlane AND validator', state: 'proven' },
      { id: 'C8', name: 'Self-approval rejected', detail: 'authorization_actor ≠ proposer', state: 'proven' },
      { id: 'C9', name: 'Ed25519 signing', detail: 'real crypto, working', state: 'proven' },
      { id: 'C10', name: 'Versioned canonical v1/v2', detail: '14 legacy receipts verify unchanged', state: 'proven' },
    ],
  },
  {
    key: 'sec-d',
    code: 'D',
    title: 'VVU-devID System',
    subtitle: '16 Sep',
    items: [
      { id: 'D1', name: 'CANONICAL_ROLES.md', detail: 'GREEN', state: 'proven' },
      { id: 'D2', name: 'VVU-SIG_SPEC.md', detail: 'RFC8785 JCS + Ed25519', state: 'proven' },
      { id: 'D3', name: 'dev-id-registry.json', detail: '4 family templates', state: 'proven' },
      { id: 'D4', name: 'vvu-dev-id-hook.js', detail: 'offline queue + sync', state: 'proven' },
      { id: 'D5', name: 'VVU-MCP_URI_SPEC.md', detail: 'GREEN', state: 'proven' },
      { id: 'D6', name: 'proofbridge-ive-tutor', detail: 'v0.1.0 · 5 files · zero deps', state: 'proven' },
      { id: 'D7', name: 'FIRST-LOG-ENTRY.json', detail: 'signed · wormSeq 1', state: 'proven' },
      { id: 'D8', name: 'dropin-20260916.zip', detail: '156 KB', state: 'proven' },
    ],
  },
  {
    key: 'sec-e',
    code: 'E',
    title: 'E2E Execution',
    subtitle: '16 Sep',
    items: [
      { id: 'E1', name: 'E2E Logs 1–8', detail: 'all written', state: 'proven' },
      { id: 'E2', name: '83/83 checks', detail: 'full pass', state: 'proven' },
      { id: 'E3', name: 'Control plane wired + exercised', detail: 'logs 2–7 ledgered', state: 'proven' },
      { id: 'E4', name: 'WORM + Merkle verification', detail: 'independent', state: 'proven' },
      { id: 'E5', name: 'Session/credential boundaries', detail: 'tested', state: 'proven' },
      { id: 'E6', name: 'Negative enforcement tests', detail: 'passed', state: 'proven' },
      { id: 'E7', name: 'DH mechanism', detail: 'pending mode — correct, no operator admin devID yet', state: 'proven', meta: 'demonstrated; signs only after operator devID minted' },
      { id: 'E8', name: 'Evidence pack', detail: 'hashed', state: 'proven' },
      { id: 'E9', name: 'No false production claims', detail: 'all stubs/blocks labeled', state: 'proven' },
    ],
  },
  {
    key: 'sec-f',
    code: 'F',
    title: 'Field Evidence',
    subtitle: '14–15 Sep',
    items: [
      { id: 'F1', name: 'fieldkit.html', detail: '6,205 B · 84fc656105d110d6', state: 'proven' },
      { id: 'F2', name: 'poggi_full_transcript_clean.txt', detail: '10,022 B · 22dc7ab20e02a637', state: 'proven' },
      { id: 'F3', name: 'NMU_Poggi_Full_Capture.md', detail: '4,335 B · 23826a63527f43e9', state: 'proven' },
      { id: 'F4', name: 'NMU_Engineering_Capture.md', detail: '2,370 B · 4b6f9ddcb38a862a', state: 'proven' },
      { id: 'F5', name: 'Athu_Zam_Shuttle_Capture.md', detail: '3,782 B · 711640fc15d6d879', state: 'proven' },
      { id: 'F6', name: 'Capitec_Fraud_Evidence_Harness.json', detail: '1,568 B · 9a67c2818bb62b23', state: 'proven' },
      { id: 'F7', name: 'Capitec_Fraud_Sequence_EN.srt', detail: '2,160 B · 287cd7d2c59ba5d6', state: 'proven' },
      { id: 'F8', name: 'NMU_2ndAve_Business_Capture.md', detail: 'captured', state: 'proven' },
      { id: 'F9', name: 'NMU_Taxonomy_Capture.md', detail: 'captured', state: 'proven' },
      { id: 'F10', name: 'NMU_Water_TrustOS_Capture.md', detail: 'captured', state: 'proven' },
      { id: 'F11', name: 'Six Q3 trust conditions', detail: 'mapped', state: 'proven' },
    ],
  },
  {
    key: 'sec-g',
    code: 'G',
    title: 'Fraud Harness + Chain',
    subtitle: '',
    items: [
      { id: 'G1', name: 'Capitec R1B case', detail: 'CAPITEC_R1B_SEQUENCE_ANOMALY_001', state: 'proven' },
      { id: 'G2', name: 'WORM chain', detail: '7,177+ events VALID', state: 'proven', meta: 'round-29 QA' },
      { id: 'G3', name: 'Receipt reproduction rule', detail: 'stored == recomputed', state: 'proven' },
      { id: 'G4', name: 'Krypte labelled-rebuild zip', detail: '55,757 B · md5 01562c14cc1c85fa7b1228dcee77b78a', state: 'proven' },
      { id: 'G5', name: 'CityGisBench.tsx', detail: '1,374 lines · sha256 40ed844e9864cab9…', state: 'proven' },
      { id: 'G6', name: 'Round-30 commit', detail: '8f60564 · +358/−2 one file', state: 'proven' },
    ],
  },
  {
    key: 'sec-h',
    code: 'H',
    title: 'Institutional / Legal',
    subtitle: '',
    items: [
      { id: 'H1', name: 'Vaguely Vanity LLC', detail: 'CIPC registered', state: 'proven' },
      { id: 'H2', name: 'Trading as Venture Vision Ubuntu', detail: 'CoR 15.1B MOI', state: 'proven' },
      { id: 'H3', name: 'B-BBEE Level 1', detail: '135% procurement recognition', state: 'proven' },
      { id: 'H4', name: 'SARS tax compliant', detail: 'GREEN', state: 'proven' },
      { id: 'H5', name: 'CIPC registration', detail: '2026/259053/07', state: 'proven' },
    ],
  },
  {
    key: 'sec-i',
    code: 'I',
    title: 'Infrastructure',
    subtitle: 'standing up',
    items: [
      { id: 'I1', name: 'Vercel project proofbridge-liner', detail: 'preview deployed', state: 'proven', meta: 'next: promote to production' },
      { id: 'I2', name: 'Team aCognuPad on Vercel', detail: 'GREEN', state: 'proven' },
      { id: 'I3', name: '3 env vars', detail: 'configured', state: 'proven' },
      { id: 'I4', name: 'HostAfrica API access', detail: 'docs read · token path known', state: 'proven', meta: 'next: execute domain registration' },
      { id: 'I5', name: 'Obsidian vault', detail: 'Documents/Proofbridge-Brain', state: 'proven' },
      { id: 'I6', name: 'Vault plugin installed on phone', detail: 'NOT PAIRED — correct state', state: 'proven', meta: 'pair via QR when :3004 reachable from phone' },
    ],
  },
  {
    key: 'sec-j',
    code: 'J',
    title: 'Commercial Artifacts',
    subtitle: '',
    items: [
      { id: 'J1', name: 'blockchain-detection-offer.md', detail: 'DRAFT v0.1 · ready to send', state: 'proven' },
      { id: 'J2', name: 'Faculty Map + 4 trust bottlenecks', detail: 'GREEN', state: 'proven' },
      { id: 'J3', name: 'Leave-behind paragraph', detail: 'GREEN', state: 'proven' },
      { id: 'J4', name: 'ZAR pricing structure', detail: 'R15k / R50k / R5k', state: 'proven' },
      { id: 'J5', name: 'Success criteria', detail: 'defined', state: 'proven' },
      { id: 'J6', name: 'Non-claims list', detail: 'GREEN', state: 'proven' },
    ],
  },
  {
    key: 'sec-k',
    code: 'K',
    title: 'Philosophy / Governance',
    subtitle: '',
    items: [
      { id: 'K1', name: '"Don\u2019t believe us. Test us."', detail: 'LOCKED', state: 'proven', meta: 'We do not chase approval. We chase scrutiny.' },
      { id: 'K2', name: 'Control path, not author', detail: 'CODE-ENFORCED', state: 'proven', meta: 'Event record generated by the control path surrounding mutation, never by the author' },
      { id: 'K3', name: 'Scope ladder', detail: 'SPEC\u2019D — none → read → propose → observe → verify → promote → approve → admin', state: 'ready', meta: 'control-plane enforced end' },
      { id: 'K4', name: 'QR-as-role-grant', detail: 'SPEC\u2019D', state: 'ready', meta: 'QR is bootstrap only; the credential defines scope; expiry/revocation ends authority' },
      { id: 'K5', name: 'Session ≠ account ≠ role', detail: 'TESTED', state: 'proven' },
      { id: 'K6', name: 'One-line survival', detail: 'LOCKED', state: 'proven', meta: 'chatbot proposes, runner executes, control plane observes, human approves' },
    ],
  },
  {
    key: 'sec-l',
    code: 'L',
    title: 'Ready to Launch',
    subtitle: 'one action away',
    items: [
      { id: 'L1', name: 'Operator admin devID', detail: 'mint TOTP', state: 'ready', meta: 'blocker: not minted — QR action' },
      { id: 'L2', name: 'Android bridge LIVE', detail: 'scan QR', state: 'ready', meta: 'blocker: no real phone artifacts' },
      { id: 'L3', name: 'Anchor target', detail: 'replace stub with Base calldata', state: 'ready', meta: 'blocker: STUBBED — /api/anchor/route.ts' },
      { id: 'L4', name: 'Production domain', detail: 'HostAfrica API call', state: 'ready', meta: 'blocker: unregistered' },
      { id: 'L5', name: 'Vercel production', detail: 'promote deployment', state: 'ready', meta: 'blocker: preview only' },
      { id: 'L6', name: 'First paying customer', detail: 'send offer × 3', state: 'ready', meta: 'blocker: offer unsent' },
      { id: 'L7', name: 'Regulatory file', detail: 'hand to legal', state: 'ready', meta: 'blocker: review pending (FSCA/FIC)' },
      { id: 'L8', name: 'IVE Plugin Registry', detail: 'ship the 4-file retarget run', state: 'ready', meta: 'blocker: not built' },
      { id: 'L9', name: 'PIP receipts', detail: 'flip enabled_by_default', state: 'ready', meta: 'blocker: opt-in off' },
    ],
  },
  {
    key: 'sec-m',
    code: 'M',
    title: 'Blocked',
    subtitle: 'do not attempt until upstream resolves',
    items: [
      { id: 'M1', name: 'Public canonical tags', detail: 'pre-step-1 hold', state: 'blocked', meta: 'domain unregistered — correctly held' },
      { id: 'M2', name: 'CityGisBench +358/−2 change', detail: 'already landed', state: 'blocked', meta: 'scope satisfied' },
      { id: 'M3', name: 'Cron 383376 recreate', detail: 'DO-NOT-RECREATE', state: 'blocked' },
      { id: 'M4', name: 'Evidence attachment', detail: 'user-side originals', state: 'blocked', meta: 'requires original files' },
    ],
  },
] as const;

// ── ship status (prose claims, kept as labels — the counts above are data) ──

export interface ShipStatus {
  label: string;
  value: string;
  tone: 'proven' | 'ready';
  sub: string;
}

export const SHIP_STATUS: readonly ShipStatus[] = [
  { label: 'Engineering', value: 'GREEN', tone: 'proven', sub: 'control plane exercised · receipts chained · bridges tested · validator refuses forgery' },
  { label: 'Infrastructure', value: 'GREEN', tone: 'proven', sub: 'Vercel deployed · HostAfrica reachable · Obsidian installed' },
  { label: 'Commercial', value: 'READY', tone: 'ready', sub: 'offer written · taxonomy mapped · pricing set' },
  { label: 'Go-Live', value: 'ONE ACTION', tone: 'ready', sub: 'afternoon + one email away' },
] as const;

// ── derived totals (the ledger wins, never the prose) ────────────────────────

export interface ManifestTotals {
  proven: number;
  ready: number;
  blocked: number;
  total: number;
  liveServices: number;
  sections: number;
}

export function manifestTotals(): ManifestTotals {
  let proven = 0;
  let ready = 0;
  let blocked = 0;
  for (const section of MANIFEST_SECTIONS) {
    for (const item of section.items) {
      if (item.state === 'proven') proven += 1;
      else if (item.state === 'ready') ready += 1;
      else blocked += 1;
    }
  }
  return {
    proven,
    ready,
    blocked,
    total: proven + ready + blocked,
    liveServices: MANIFEST_SECTIONS[0]?.items.length ?? 0,
    sections: MANIFEST_SECTIONS.length,
  };
}

/** The IVE visual language tokens (source: Launch Manifest HTML, 16 Sep 2026). */
export const IVE = {
  gold: '#C9A84C',
  proven: '#3DFFB0',
  ready: '#F5A623',
  blocked: '#FF4D5F',
  lime: '#c8ff00',
} as const;

export const STATE_LABEL: Record<ManifestState, string> = {
  proven: 'PROVEN',
  ready: 'READY',
  blocked: 'BLOCKED',
};
