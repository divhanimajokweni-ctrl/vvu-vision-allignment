// src/lib/icsh/contract.ts — THE CONTRACT (4th state). Client-safe constants
// shared by the genesis seeder (server) and the workspace UI. The exact object
// below is what gets written to the WORM chain as CONTRACT_DEPLOYED — our
// contract on chain, per the operator directive.

export const ICSH_VERSION = '4TH-STATE/1.1'; // 1.1 — SESSION LAB amendment (14:39)

export const ICSH_BEATS = [
  'INGEST',
  'INFER',
  'LOG',
  'SYNC',
  'COMPARE',
  'FOLD',
  'MINT',
  'SHIP',
  'WIPE',
  'RETRIEVE',
  'WATCHDOG',
] as const;

export type IcshBeat = (typeof ICSH_BEATS)[number];

export interface IcshViewport {
  clock: string;
  name: string;
  focus: string;
}

/** The continuous zoom viewport rail — pinch between 14:32 and 14:37 triggers
 *  live mesh state reconciliation while working memory stays 32 bytes. */
export const ICSH_VIEWPORTS: IcshViewport[] = [
  { clock: '14:32', name: 'CITY TWIN', focus: 'Forest Hill pipes · local ingestion & physics' },
  { clock: '14:34', name: 'RIG', focus: '25km peer sync · 32-byte gossip across 25 peers' },
  { clock: '14:35', name: 'WORM LEDGER', focus: 'append-only envelope · the ledger IS the storage' },
  { clock: '14:36', name: 'MAP', focus: 'district head coherence folding' },
  { clock: '14:37', name: 'TRUST SPHERE', focus: 'WORM envelope seal · orbit head anchor' },
  { clock: '14:38', name: 'COST MATRIX', focus: 'measured throughput · cost of everything running' },
  { clock: '14:39', name: 'SESSION LAB', focus: 'concurrent 2FA logins · simulated worker phones · PWA sessions on the WORM chain' },
];

export const ICSH_HONESTY = [
  'This receipt proves inclusion, not consensus.',
  'Absent: no canonical tags, no external anchor, no farmer\u2019s phone on the map.',
  'Ghosted regions are NOT YET — never rendered as live.',
  'Every throughput number on this estate is measured at run time.',
] as const;

export const ICSH_DISTRICTS = [
  'GAUTENG',
  'FREE STATE',
  'MPUMALANGA',
  'LIMPOPO',
  'NORTH WEST',
  'KWAZULU-NATAL',
  'EASTERN CAPE',
  'WESTERN CAPE',
  'NORTHERN CAPE',
] as const;

export const ICSH_GHOST_REGIONS = [
  { label: 'EGYPT', x: 62, y: 6 },
  { label: 'KENYA', x: 84, y: 34 },
  { label: 'TANZANIA', x: 76, y: 48 },
  { label: 'NAMIBIA', x: 16, y: 52 },
  { label: 'ANGOLA', x: 40, y: 32 },
  { label: 'ZIMBABWE', x: 80, y: 56 },
] as const;

export const ICSH_CONTRACT = {
  version: ICSH_VERSION,
  name: 'ICSH UNIFIED LOOP — CONTRACT ON CHAIN',
  directive: 'Operator order, verbatim: deploy the 4th state — everything we did dev work on, our contract, on chain. The ledger is the storage.',
  storage: 'THE LEDGER IS THE STORAGE — WORM append-only, SHA-256 chained, one line per cycle, markdown vault one node per cycle.',
  beats: [...ICSH_BEATS],
  viewports: ICSH_VIEWPORTS.map((v) => `${v.clock} ${v.name}`),
  memory: 'Working memory bounded at exactly 32 bytes per node — the orbit head. Storage footprint FLAT.',
  join: {
    method: 'TOTP (RFC 6238) — 6 digits · 30s step · HMAC-SHA1 · window ±1',
    modes: ['QR', 'GOOGLE AUTHENTICATOR (manual key)'],
    wizard: ['LOCATE', 'SCAN', 'CONSENT', 'VERIFY', 'RECEIPT'],
  },
  sessions: {
    ttl: '15-minute PWA session per TOTP login — SESSION_MINTED · SESSION_REVOKED · LOGIN_REJECTED all on chain',
    concurrency: 'verified by the 14:39 SESSION LAB — every onboarded phone logs in at once',
    popia: 'POPIA Act 4 of 2013 — consent recorded per enrolment (JOIN_COMMITTED), revocation honoured (BLOCKED / session revoke)',
  },
  quorum: 'COMPARE beat: agreement when ≥ 18 of 25 peers hold the current bucket head.',
  honesty: [...ICSH_HONESTY],
} as const;
