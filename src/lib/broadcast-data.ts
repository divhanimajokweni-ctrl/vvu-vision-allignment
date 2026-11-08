// src/lib/broadcast-data.ts — ROUND 31 · thirteenth projection data ledger.
// #/broadcast — BROADCAST & CREATOR LAYER (corrected canonical).
//
// PROVENANCE (Zero Fabrication Rule):
//   The operator supplied seven broadcast-layer artifacts in-session
//   (Mk-0.5 Pro Tablet spec, subscription ledger, B2B gift program,
//   influencer licence, challenge format, live routing architecture,
//   creator agreement) and then returned a review verdict BEFORE
//   treating them as canonical:
//
//     1. Platform assumptions → adapter-specific capability contracts
//        (per-platform verification status, never universal claims).
//     2. "Provably unedited" is too strong → "cryptographically
//        verifiable evidence of the recorded run".
//     3. Publishing a current hash ≠ independent anchoring → the
//        stronger pipeline: event → local chain → signed checkpoint →
//        externally observable anchor → public verification.
//     + INVARIANT ZERO: the broadcast system is never part of the
//       evidence-producing system. Pinned BEFORE episode_brief_template
//       .md and host_rotation_spec.md are written.
//
//   All three corrections + the invariant are applied in the document
//   text below. Nothing in this file claims live-platform verification:
//   every adapter capability row carries its own honest verification
//   status. ROUND 32: the two queued artifacts are WRITTEN on the operator's
//   word (supplied in-session, behind the pinned INVARIANT ZERO), making
//   nine canonical documents; correction #3 is applied in the brief text.

// ─── Doc block model ────────────────────────────────────────────────────────

export type DocBlock =
  | { kind: 'p'; text: string }
  | { kind: 'h'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'table'; head: string[]; rows: string[][]; caption?: string }
  | { kind: 'pre'; text: string }
  | { kind: 'callout'; text: string; tone: 'crimson' | 'lime' | 'amber' | 'teal' };

export interface BroadcastDoc {
  id: string;
  path: string;
  title: string;
  subtitle: string;
  /** canonical path label shown on the card */
  status: 'CANONICAL · CORRECTED' | 'CANONICAL';
  corrected: boolean;
  correctionNote?: string;
  blocks: DocBlock[];
}

// ─── The review verdict — three corrections ─────────────────────────────────

export interface Correction {
  id: number;
  target: string;
  was: string;
  now: string;
  why: string;
}

export const CORRECTIONS: Correction[] = [
  {
    id: 1,
    target: 'LIVE_ROUTING_ARCH_v0.md · platform capabilities',
    was: 'One universal OAuth scopes table presenting per-platform scopes (youtube.force-ssl, channel:read:stream_key, live.room.push, pages_manage_posts) as settled fact.',
    now: 'Adapter-specific capability contracts: each platform is its own adapter row with the claimed capability, an honest verification status (VERIFIED / UNVERIFIED / AVAILABILITY UNCONFIRMED) and a ship condition. A contract is either verified against the live platform API with a logged receipt, or the adapter does not ship.',
    why: 'OAuth scopes, live-ingest APIs and TikTok live-push availability change per platform and over time. An unverified scope table presented as universal fact is an overclaim — and this estate does not overclaim.',
  },
  {
    id: 2,
    target: 'ALL DOCUMENTS · terminology',
    was: '"Provably unedited" content (tablet spec, licence, format).',
    now: '"Cryptographically verifiable evidence of the recorded run." The chain establishes that the recorded system events correspond to a particular chain and that the published artifact matches a cryptographic commitment.',
    why: 'It does not, by itself, prove that a video recording contains every relevant event or that the camera feed was never edited. Claim only what the cryptography actually proves — nothing more.',
  },
  {
    id: 3,
    target: 'LIVE_ROUTING_ARCH_v0.md · evidence overlay',
    was: '"The hash updates every 5 seconds … the hash cannot be backdated because it is published live."',
    now: 'Display ≠ anchor. The 5-second ticker is a live VIEW of chain state. The proof path is: event → local chain → signed checkpoint → externally observable timestamp/anchor → public verification.',
    why: 'If the verification server controls both the chain and the verifier, the audience is still trusting VVU for the authoritative state. External anchoring restores Evidence Independence — the audience verifies without trusting us.',
  },
];

// ─── INVARIANT ZERO — pinned before any downstream artifact ─────────────────

export const INVARIANT_ZERO = {
  code: 'INVARIANT ZERO',
  title: 'THE BROADCAST SYSTEM IS NEVER PART OF THE EVIDENCE-PRODUCING SYSTEM',
  rule: 'It consumes evidence; it does not manufacture or validate it.',
  chain: [
    { name: 'Mk-0.5 EDGE NODE', role: 'collects' },
    { name: 'PRO TABLET', role: 'operates' },
    { name: 'PROOFBRIDGE EVIDENCE RUNTIME', role: 'produces the proof' },
    { name: 'MASTER BROADCAST', role: 'consumes the proof' },
    { name: 'CREATOR CHANNELS', role: 'carry the show' },
  ],
  failures: [
    {
      fail: 'Broadcast layer fails',
      direction: 'BROADCAST ✕ EVIDENCE',
      response:
        'The underlying run continues and remains verifiable. The show dies; the proof lives. No on-air claim is invalidated by a dead encoder.',
    },
    {
      fail: 'Evidence circuit breaker trips (chain verify fails)',
      direction: 'EVIDENCE → BROADCAST',
      response:
        'The broadcast truthfully displays EVIDENCE INVALID / BROADCAST HALTED. The show stops rather than lie. If the chain fails, the show stops — this is the difference between a broadcast and a proof.',
    },
  ],
  precedence:
    'Pinned BEFORE episode_brief_template.md and host_rotation_spec.md are written. No downstream artifact — episode brief, host rotation, adapter, overlay — may violate it.',
} as const;

// ─── Anchor pipeline (the stronger verification path) ───────────────────────

export interface AnchorStage {
  stage: string;
  note: string;
}

export const ANCHOR_PIPELINE: AnchorStage[] = [
  { stage: 'EVENT', note: 'Every system action appends to the local WORM journal on the node.' },
  { stage: 'LOCAL CHAIN', note: 'Hash-linked, append-only. First proof layer — but still ours.' },
  { stage: 'SIGNED CHECKPOINT', note: 'Periodic head hash signed by the node key (Ed25519) / TPM quote.' },
  { stage: 'EXTERNAL ANCHOR', note: 'Checkpoint committed to an externally observable timestamp / ledger VVU does not control.' },
  { stage: 'PUBLIC VERIFICATION', note: 'Any third party recomputes: chain segment + checkpoint signature + anchor presence.' },
];

export const ANCHOR_NOTE =
  'Publishing a current hash is DISPLAY, not PROOF. The 5-second live ticker shows chain state; the anchored checkpoint stream is what defeats backdating. Evidence Independence: the audience must never have to trust VVU for the authoritative state.';

// ─── Adapter capability contracts (replace the universal scopes table) ───────

export type AdapterStatus = 'UNVERIFIED — LIVE-API TEST PENDING' | 'AVAILABILITY UNCONFIRMED';

export interface AdapterContract {
  platform: string;
  capability: string;
  status: AdapterStatus;
  shipCondition: string;
}

export const ADAPTER_CONTRACTS: AdapterContract[] = [
  {
    platform: 'YouTube',
    capability: 'Server-side live broadcast creation + RTMP ingest push to the creator channel (OAuth-scoped).',
    status: 'UNVERIFIED — LIVE-API TEST PENDING',
    shipCondition: 'Adapter ships only after a live-API verification test against current YouTube Live docs; scope + ingest behaviour receipt-logged to the chain.',
  },
  {
    platform: 'Twitch',
    capability: 'Ingest URL + stream key retrieval and RTMP push to the creator channel.',
    status: 'UNVERIFIED — LIVE-API TEST PENDING',
    shipCondition: 'Key access may differ by partner tier — verify the actual key path before any commitment; receipt-logged.',
  },
  {
    platform: 'TikTok',
    capability: 'Server-side live push to a creator channel.',
    status: 'AVAILABILITY UNCONFIRMED',
    shipCondition: 'Live push access is region/allowlist-gated. Do not commit TikTok as a destination until a verified access path exists.',
  },
  {
    platform: 'Facebook',
    capability: 'Page live-video creation + RTMP ingest push.',
    status: 'UNVERIFIED — LIVE-API TEST PENDING',
    shipCondition: 'Verify Page-live API + ingest against current Meta docs; receipt-logged.',
  },
];

export const ADAPTER_RULE =
  'Each platform is its own adapter with its own capability contract. A contract is either VERIFIED (tested against the live platform API, receipt logged to the chain) or it does not ship. No universal platform claims. No cross-platform assumptions. Minimum scopes only — never subscriber lists, analytics or private messages.';

// ─── The seven corrected canonical documents ────────────────────────────────

export const BROADCAST_DOCS: BroadcastDoc[] = [
  // 1 ─ MK0.5 PRO TABLET SPEC
  {
    id: 'tablet',
    path: 'vvu-trust/MK0.5_PRO_TABLET_SPEC.md',
    title: 'Mk-0.5 Pro Tablet',
    subtitle: 'Field-grade operator console. Runs the entire surface stack locally. Syncs with Edge Nodes over LoRa, Wi-Fi, or store-and-forward.',
    status: 'CANONICAL · CORRECTED',
    corrected: true,
    correctionNote: 'Terminology correction #2 applied to the content pathway.',
    blocks: [
      { kind: 'h', text: 'Positioning' },
      {
        kind: 'p',
        text: 'The Mk-0.5 Edge Node collects. The Mk-0.5 Pro Tablet operates. It is the surface a farm manager, co-op treasurer, or field technician carries. It holds the full local app: 8-bit onboarding game, spatial twin, PWA dashboard, evidence viewer, contract inspection. No cloud. No account. No subscription required to view local state. The subscription is for multi-node sync + retention + support.',
      },
      { kind: 'h', text: 'Target hardware spec' },
      {
        kind: 'table',
        head: ['Function', 'Component class', 'Target'],
        rows: [
          ['Display', '10" AMOLED, 1920×1200, 400+ nits', 'Ruggedized, glove-capable'],
          ['SoC', '8-core ARM Cortex-A78 class (e.g. RK3588)', 'Runs spatial twin + PWA + LLM locally'],
          ['RAM', '8 GB LPDDR4X minimum', 'Spatial twin + browser stack'],
          ['Storage', '128 GB eMMC + microSD expansion', 'Local WORM chain + spatial assets'],
          ['Attestation', 'TPM 2.0 module', 'T1 attestation tier'],
          ['Radios', 'Wi-Fi 6 + BLE 5.2 + LoRa SX1262', '868 MHz for ZA'],
          ['GNSS', 'u-blox M10 (multi-constellation)', 'Ephemeris + local positioning'],
          ['Camera', '8 MP rear (evidence capture)', 'Photo hashed to WORM chain'],
          ['Battery', '10,000 mAh Li-ion, USB-C PD in', '12h active, 72h standby'],
          ['Enclosure', 'IP65, MIL-STD-810H drop', 'Field-rated'],
          ['OS', 'Debian-based Linux, local-only', 'Full Python stack natively'],
          ['Cooling', 'Passive, no fan', 'Dust + moisture tolerance'],
        ],
        caption: 'Estimated BOM: R6,500 – R8,500 (development + small-batch). Volume target: R4,500 – R5,500 at 500 units.',
      },
      { kind: 'h', text: 'What runs on it (natively, offline)' },
      {
        kind: 'list',
        items: [
          '8-bit onboarding — surfaces/index.html',
          '3D Spatial Twin — surfaces/spatial_twin/spatial_twin_offline.html',
          'Field PWA — surfaces/pwa/agri_smartphone_web_bridge.py',
          'Evidence ledger viewer — reads meantime_journal.jsonl locally',
          'Contract inspector — read-only view of ComputeStokvelROSCA.sol state',
          'Two-gate status — real-time view of Gate 1 / Gate 2 decisions',
          'MCP tool surface — talks to any Edge Node over LoRa or Wi-Fi',
          'Local LLM (optional) — 3B quantized model for on-device reasoning',
        ],
      },
      { kind: 'h', text: 'Sync model with Mk-0.5 Edge Nodes' },
      {
        kind: 'table',
        head: ['Path', 'When', 'What moves'],
        rows: [
          ['Wi-Fi', 'In range', 'Full journal tail + telemetry + spatial deltas'],
          ['LoRa', '5–10 km, low bandwidth', 'Hash head + summary + alert flags'],
          ['Store-and-forward', 'Operator walks by', 'Full journal + SD card pull'],
          ['LoRa mesh', 'Multiple nodes', 'Inter-node hash exchange, no cloud'],
        ],
      },
      {
        kind: 'p',
        text: 'Tablet is the hub. Nodes are the spokes. The hub never requires the internet. The hub IS the internet for that farm.',
      },
      { kind: 'h', text: 'Attestation tier' },
      {
        kind: 'list',
        items: [
          'Tablet: T1 (TPM 2.0 quote).',
          'Edge Node: T0 (Ed25519) or T1 (TPM).',
          'Combined: certificate header reports the LOWEST tier in the chain. Honest by construction.',
        ],
      },
      { kind: 'h', text: 'Content + influencer pathway (CORRECTED)' },
      {
        kind: 'list',
        items: [
          'Open the field PWA.',
          'Trigger a 72h local capture (system logs every action).',
          'Pull the resulting WORM head hash — and the signed, anchored checkpoint that carries it.',
          'Publish the hash + a screen recording as cryptographically verifiable evidence of the recorded run.',
        ],
      },
      {
        kind: 'callout',
        tone: 'amber',
        text: 'TERMINOLOGY STANDARD (correction #2): the chain proves the recorded system events and that the published artifact matches the commitment. It does not prove the recording contains every event or that the camera feed was never edited. The wording is "cryptographically verifiable evidence of the recorded run" — never "provably unedited".',
      },
      {
        kind: 'p',
        text: 'The influencer does not need to trust us. They hold the receipt. The audience does not need to trust them. They can verify the evidence for themselves — against the chain and the external anchor. This is the content moat: nobody else hands an influencer a verifiable receipt for a 3-day unattended run.',
      },
      { kind: 'h', text: 'Subscription ladder (Year 1 → Year 2)' },
      {
        kind: 'table',
        head: ['Tier', 'Year 1 (pilot)', 'Year 2 (standard)', 'Y2 Annual promo'],
        rows: [
          ['Single Node', 'ZAR 5,000 / 31-day rental', 'ZAR 12,500 / mo', 'Annual + 1 mo free'],
          ['Node + Tablet', 'ZAR 8,500 / 31-day rental', 'ZAR 18,500 / mo', 'Annual + 1 mo free + perks'],
          ['Co-op (3 nodes)', 'ZAR 15,000 / 31-day rental', 'ZAR 32,000 / mo', 'Annual + 1 mo free + loyalty'],
        ],
      },
      {
        kind: 'list',
        items: [
          'Conversion levers at end of Year 1:',
          'Early-adopter lock-in price for 90 days only.',
          'Annual plan: 1 month free + priority field support.',
          'Non-annual users: quarterly loyalty credits redeemable against tablet.',
          'B2B gift channel: partner buys 5 subscriptions, gives to their clients.',
          'Loyalty points on refer-a-co-op.',
        ],
      },
      { kind: 'h', text: 'B2B partner plays' },
      {
        kind: 'table',
        head: ['Partner type', 'Value to them', 'Value to us'],
        rows: [
          ['Agri lenders', 'Verifiable borrower evidence', 'Distribution + retention'],
          ['Input suppliers', 'Cold-chain proof for insured stock', 'Reach + data'],
          ['Insurance', 'Tamper-proof claim evidence', 'Trust + price premium'],
          ['Off-takers', 'Proven cold-chain + harvest timing', 'Contractual anchor'],
          ['Mining ops', 'Off-grid proof-of-work', 'Cross-sector reference'],
          ['Municipal water', 'Leak onset evidence', 'Public-sector reference'],
        ],
      },
      { kind: 'h', text: 'Community outreach structure' },
      {
        kind: 'list',
        items: [
          'Dev blog — one post per month, one live 72h capture embedded.',
          'Community day — one co-op per quarter, tablet in hand, live demo.',
          'Youth skills track — teach the 8-bit onboarding game as entry to CS.',
          'Local language PWA — Afrikaans, isiXhosa, isiZulu, Sesotho.',
          'Influencer program — 3 anchor creators, content licence, revenue share.',
          'Open evidence protocol — anyone can verify any published hash.',
        ],
      },
      { kind: 'h', text: 'The line' },
      {
        kind: 'p',
        text: 'The Mk-0.5 Edge Node is the nerve. The Mk-0.5 Pro Tablet is the hand. Together they let a community run, prove, and sell the outcome of its own work — offline, unattended, and cryptographically honest — for 72 hours straight, then do it again. That is the product.',
      },
    ],
  },

  // 2 ─ SUBSCRIPTION LEDGER SPEC
  {
    id: 'ledger',
    path: 'vvu-trust/commercial/subscription_ledger_spec.md',
    title: 'Subscription Ledger — State Machine Spec',
    subtitle: 'Runs on the same WORM chain as everything else. Every state change is an event. Every event is chained. No separate billing system.',
    status: 'CANONICAL',
    corrected: false,
    blocks: [
      { kind: 'h', text: 'Why this exists' },
      {
        kind: 'p',
        text: 'The subscription is not a separate product bolted onto the node. It is a state on the node. When a partner gifts a subscription, it is an event. When a member upgrades from monthly to annual, it is an event. When a loyalty credit is redeemed against a tablet, it is an event. All of it lives in the same journal that records telemetry and control. One chain. One truth.',
      },
      { kind: 'h', text: 'Event vocabulary (extends event_types.py)' },
      {
        kind: 'pre',
        text: `# Subscription lifecycle
SUB_TRIAL_STARTED          = "sub.trial.started"
SUB_TRIAL_ENDED            = "sub.trial.ended"
SUB_ACTIVATED              = "sub.activated"
SUB_RENEWED                = "sub.renewed"
SUB_LAPSED                 = "sub.lapsed"
SUB_CANCELLED              = "sub.cancelled"

# Tier changes
SUB_UPGRADED               = "sub.upgraded"
SUB_DOWNGRADED             = "sub.downgraded"
SUB_ANNUAL_LOCKED          = "sub.annual.locked"

# Gifts and loyalty
GIFT_ISSUED                = "gift.issued"
GIFT_REDEEMED              = "gift.redeemed"
GIFT_EXPIRED               = "gift.expired"
LOYALTY_EARNED             = "loyalty.earned"
LOYALTY_REDEEMED           = "loyalty.redeemed"

# Promotions
PROMO_APPLIED              = "promo.applied"
PROMO_EXPIRED              = "promo.expired"
EARLY_ADOPTER_LOCK         = "promo.early_adopter.locked"

# B2B
B2B_POOL_CREATED           = "b2b.pool.created"
B2B_SEAT_ALLOCATED         = "b2b.seat.allocated"
B2B_SEAT_ACTIVATED         = "b2b.seat.activated"`,
      },
      { kind: 'h', text: 'Subscription state machine' },
      {
        kind: 'pre',
        text: `        TRIAL (7-day free provenance)
              |
              v
   [PILOT_PENDING] ---- ZAR 5,000 paid ----> [PILOT_ACTIVE] (31 days)
                                                  |
                              +-------------------+-------------------+
                              v                                       v
                    [CONVERT_MONTHLY]                      [CONVERT_ANNUAL]
                    ZAR 12,500 / mo                        ZAR 12,500 x 11
                                                           + 1 month free
                              |                                       |
                              +---------------+-----------------------+
                                              v
                                     [RETAINED_ACTIVE]
                                              |
                              +---------------+---------------+
                              v               v               v
                         [RENEWED]       [LAPSED]       [CANCELLED]
                          (annual)       (90-day        (voluntary,
                                          grace)         pro-rata exit)`,
      },
      {
        kind: 'p',
        text: 'Every transition is an event. No transition happens without a preceding event in the same chain.',
      },
      { kind: 'h', text: 'Tier table (canonical)' },
      {
        kind: 'table',
        head: ['Tier ID', 'Name', 'Monthly ZAR', 'Annual ZAR', 'Notes'],
        rows: [
          ['T1', 'Single Node', '12,500', '137,500', '11 mo paid, 1 free'],
          ['T2', 'Node + Tablet', '18,500', '203,500', 'includes Mk-0.5 Pro'],
          ['T3', 'Co-op (3 nodes)', '32,000', '352,000', 'includes tablet + priority'],
          ['T4', 'B2B Pool (10 seats)', '95,000', '1,045,000', 'gift distribution'],
          ['T5', 'Institutional (custom)', 'quoted', 'quoted', 'multi-site, SLA'],
        ],
      },
      { kind: 'h', text: 'Conversion levers (Year 1 → Year 2)' },
      {
        kind: 'p',
        text: 'Applied in this order at pilot end. First applicable wins.',
      },
      {
        kind: 'table',
        head: ['Priority', 'Lever', 'Condition', 'Effect'],
        rows: [
          ['1', 'Early-adopter lock', 'Pilot started before Q4 Y1', 'Locks Y2 price at Y1 rate for 12 mo'],
          ['2', 'Annual promo', 'Any tier', '11 mo paid + 1 free + priority support'],
          ['3', 'Loyalty credits', 'Non-annual users', '4 quarterly credits = 1 mo free'],
          ['4', 'B2B gift', 'Partner-issued', 'Seat activation, no direct payment'],
          ['5', 'Refer-a-co-op', 'Successful referral', '2 loyalty credits per activated co-op'],
        ],
      },
      { kind: 'h', text: 'Gift code structure' },
      {
        kind: 'pre',
        text: `Format:  VVU-GIFT-{TIER}-{PARTNER}-{SEQ}-{CHECK}

Example: VVU-GIFT-T2-AGRI-0001-7F

- TIER   : T1 | T2 | T3 | T4
- PARTNER: 4-char code issued at B2B contract signing
- SEQ    : 4-digit sequential within partner batch
- CHECK  : 2-char CRC of all preceding characters (tamper check)

Redemption:
  1. Recipient opens PWA on tablet or phone
  2. Taps "Redeem gift code"
  3. Enters code
  4. Code verified locally against partner batch manifest
     (pushed to node at contract signing, offline thereafter)
  5. Seat allocated to recipient's Ed25519 devID
  6. GIFT_REDEEMED event chained
  7. Subscription activates`,
      },
      {
        kind: 'p',
        text: 'Codes are offline-verifiable. No central server needed at redemption time. The partner manifest is signed once and shipped to the node. The node checks every code against the manifest.',
      },
      { kind: 'h', text: 'Loyalty credit ledger' },
      {
        kind: 'p',
        text: 'Loyalty is a counter, not a separate currency.',
      },
      {
        kind: 'table',
        head: ['Action', 'Credits earned', 'Notes'],
        rows: [
          ['1 month paid on time', '+1', 'Auto on SUB_RENEWED'],
          ['Referral activated', '+2', 'On first successful referral'],
          ['72h capture published (verified)', '+1', 'Optional — encourages content'],
          ['Field day attended', '+1', 'Operator confirms locally'],
          ['No-overdue, 12 months', '+6', 'Annual bonus'],
        ],
      },
      {
        kind: 'table',
        head: ['Reward', 'Cost'],
        rows: [
          ['1 month free', '4 credits'],
          ['3 months free', '11 credits'],
          ['Tablet accessory bundle', '8 credits'],
          ['Field support visit', '6 credits'],
        ],
      },
      { kind: 'h', text: 'B2B pool mechanics' },
      {
        kind: 'pre',
        text: `Pool creation -> [B2B_POOL_CREATED]
    partner_id, tier, seat_count, expiry_date

Seat allocation -> [B2B_SEAT_ALLOCATED]
    pool_id, seat_index, recipient_hint

Seat activation -> [B2B_SEAT_ACTIVATED]
    seat_id, recipient_devid, activation_ts`,
      },
      {
        kind: 'p',
        text: 'Seats not activated by expiry return to the partner pool automatically. No refund. Partner rolls them forward or reallocates.',
      },
      { kind: 'h', text: 'What the ledger does NOT do' },
      {
        kind: 'list',
        items: [
          'It does not process payments. Stitch and Paystack do that.',
          'It does not store card details. Ever. At any tier.',
          'It does not require internet at redemption. Gift codes and loyalty credits are offline-verifiable against a signed manifest.',
          'It does not double-count. Every event is idempotent on (devid, event_type, period) key.',
        ],
      },
      { kind: 'h', text: 'What the ledger DOES do' },
      {
        kind: 'list',
        items: [
          'It records every subscription state change in the same chain as telemetry.',
          'It produces a single audit view for co-op treasurers.',
          'It lets a partner prove which seats they gifted, to whom, when.',
          'It lets a member see their loyalty balance offline, on their own device, verified by hash chain, without asking us.',
        ],
      },
    ],
  },

  // 3 ─ B2B GIFT PROGRAM
  {
    id: 'gift',
    path: 'vvu-trust/commercial/b2b_gift_program.md',
    title: 'B2B Gift Program — One Page',
    subtitle: 'Partner buys seats. Partner gifts subscriptions. We get distribution. Partner gets verified client engagement. Client gets the product free at first touch.',
    status: 'CANONICAL',
    corrected: false,
    blocks: [
      { kind: 'h', text: 'The offer' },
      {
        kind: 'p',
        text: 'A partner buys a pool of N subscriptions at institutional pricing. They receive N gift codes, each redeemable once by any client. The codes are signed, offline-verifiable, and expiring at a date the partner chooses. Partner pays the institutional rate (T4 in the ledger spec). Partner receives N gift codes + a tracking dashboard. Client receives a 31-day pilot subscription, no cost, no commitment.',
      },
      { kind: 'h', text: 'Partner types and what they get' },
      {
        kind: 'table',
        head: ['Partner', 'What they gift', 'What they get'],
        rows: [
          ['Agri lenders', 'Provenance subscription to farmers they lend to', 'Verifiable borrower evidence, lower default risk'],
          ['Input suppliers', 'Cold-chain tracking to packhouse clients', 'Insured stock proof, premium product tier'],
          ['Insurance', 'Tamper-proof telemetry to policyholders', 'Claim-evidence quality, faster payouts, lower fraud'],
          ['Off-takers', 'Harvest timing subscription to growers', 'Predictable supply chain, contractual anchor'],
          ['Mining operations', 'Off-grid telemetry to remote site contractors', 'SLA evidence, HSE compliance record'],
          ['Municipal water', 'Leak detection subscription to districts', 'Leak onset evidence, reduced NRW'],
          ['Exporters', 'Cold-chain compliance to packhouses', 'PPECB auto-audit, reduced rejections'],
          ['Agri fintechs', 'Verifiable farm revenue to applicants', 'Better underwriting, lower CAC'],
        ],
      },
      { kind: 'h', text: 'What we tell the partner' },
      {
        kind: 'pre',
        text: `"Buy 10 seats. Give them to your best 10 clients. Each client
gets a 31-day pilot at no cost. You get their engagement data,
their telemetry, and their compliance record — all cryptographically
attested, all offline-verified, all auditable.

If they convert to paid, you keep the relationship and we take
the subscription. If they don't, you've lost nothing but gained
10 warm accounts for the next cycle."`,
      },
      { kind: 'h', text: 'What we tell the client' },
      {
        kind: 'pre',
        text: `"Someone you already trust has given you a 31-day trial.
No card required. No account. No install. Scan the code on your
phone and it works.

At the end of the trial, if you want to keep it, you pay direct.
If you don't, nothing happens. You keep the pilot's evidence
chain — it's yours, on your machine."`,
      },
      { kind: 'h', text: 'Pricing (institutional)' },
      {
        kind: 'table',
        head: ['Pool size', 'Rate per seat', 'Total', 'Effective discount'],
        rows: [
          ['10 seats', 'ZAR 8,500', 'ZAR 85,000', '15% off T1 monthly × 12'],
          ['25 seats', 'ZAR 7,900', 'ZAR 197,500', '21% off'],
          ['50 seats', 'ZAR 7,200', 'ZAR 360,000', '28% off'],
          ['100+ seats', 'quoted', 'quoted', '30%+'],
        ],
        caption: 'Rate includes: gift code generation, partner dashboard, quarterly conversion report, offline manifest shipment.',
      },
      { kind: 'h', text: 'What the partner dashboard shows' },
      {
        kind: 'list',
        items: [
          'Seats issued / activated / expired.',
          'Per-seat: activation date, subscription tier after trial, conversion status (converted / lapsed / pending).',
          'Aggregate: trial-to-paid rate, average time to activation, engagement per sector.',
          'Evidence chain: exported WORM head hash for each client\u2019s trial period (with the client\u2019s consent).',
        ],
      },
      { kind: 'h', text: 'The rule' },
      {
        kind: 'callout',
        tone: 'lime',
        text: 'We do not sell to the partner\u2019s clients. The partner does. We sell to the partner. The partner owns the client relationship. We take the subscription revenue only when the client converts of their own accord. If they never convert, the partner keeps the warm account and tries again next cycle. This is a distribution channel, not a lead-gen scheme.',
      },
    ],
  },

  // 4 ─ INFLUENCER LICENCE (CORRECTED)
  {
    id: 'licence',
    path: 'vvu-trust/commercial/influencer_licence_v0.md',
    title: 'Influencer Content Licence — v0',
    subtitle: 'The creator owns the video. We own the hash. Both are publishable. No one needs to trust the other.',
    status: 'CANONICAL · CORRECTED',
    corrected: true,
    correctionNote: 'Terminology correction #2 + anchor pipeline (correction #3) applied to the verification clause.',
    blocks: [
      { kind: 'h', text: 'Purpose' },
      {
        kind: 'p',
        text: 'An influencer wants to record a 72-hour run of the system doing real work and publish it. They need to know: (1) they own their content; (2) they can verify the recorded run against the chain and the anchored checkpoints; (3) they can monetize it however they want; (4) we cannot revoke their licence or shut them down. We need to know: (1) the system produced real evidence; (2) the evidence can be independently verified; (3) we can reference the run without claiming their audience. This licence achieves both.',
      },
      { kind: 'h', text: 'What the influencer owns' },
      {
        kind: 'list',
        items: [
          'The video recording, in any format they choose.',
          'The audio.',
          'Their edit, their commentary, their narrative.',
          'Revenue from any distribution channel: YouTube, TikTok, Patreon, sponsorship, paid re-use, whatever.',
          'The right to re-license the content to third parties.',
        ],
      },
      {
        kind: 'callout',
        tone: 'lime',
        text: 'We claim NO rights to their recording. NO revenue share. NO editorial control.',
      },
      { kind: 'h', text: 'What the influencer receives' },
      {
        kind: 'list',
        items: [
          'A 72-hour unbroken run on a designated Mk-0.5 Edge Node.',
          'A live journal readable in real time via the field PWA.',
          'At the end of the run: a WORM head hash and a signed attestation envelope.',
          'The signed checkpoint stream and its external anchors (timestamps in media VVU does not control).',
          'A public verification path (optional) where any third party can verify the hash and the anchors against the chain.',
          'A copy of the raw journal for their own offline storage.',
        ],
      },
      { kind: 'h', text: 'What the influencer grants' },
      {
        kind: 'p',
        text: 'Limited, revocable only by the influencer:',
      },
      {
        kind: 'list',
        items: [
          'Right to reference the video by URL on our blog and social channels, no re-upload, no edit.',
          'Right to embed the video with attribution.',
          'Right to use the run\u2019s WORM head hash in our own marketing materials.',
          'Right to cite the run as a case study, with the influencer named if they wish.',
        ],
      },
      {
        kind: 'p',
        text: 'Not granted: right to re-edit the video; right to use the influencer\u2019s likeness in paid advertising; right to sell the video; any claim on future content the influencer produces.',
      },
      { kind: 'h', text: 'Verification clause (the core of it — CORRECTED)' },
      {
        kind: 'p',
        text: 'The influencer\u2019s audience does not need to trust the influencer, and does not need to trust us. The verification path follows the anchor pipeline:',
      },
      {
        kind: 'pre',
        text: `1. Influencer publishes video + WORM head hash.
2. Any viewer opens the public verification endpoint.
3. Viewer pastes the hash.
4. Verifier returns:
   - The full event sequence
   - The tier (T0 / T1)
   - The attestation source
   - The chain integrity result
   - The signed checkpoint stream + the EXTERNAL ANCHORS
     (timestamps / placements VVU does not control)
5. Viewer sees: "This run is recorded on the chain with this
   attestation tier. The published artifact matches the
   commitment. The checkpoints are anchored outside VVU.
   Verify the evidence yourself."`,
      },
      {
        kind: 'callout',
        tone: 'teal',
        text: 'EVIDENCE INDEPENDENCE (correction #3): a verification endpoint operated by VVU is a convenience, not a proof. The anchor is what lets an audience verify without trusting us — the checkpoint must be observable outside VVU before it counts. The influencer\u2019s brand is protected because the run\u2019s evidence is independently verifiable; our brand is protected because we cannot be accused of hiding the tier.',
      },
      { kind: 'h', text: 'Payment (optional, at influencer\u2019s discretion)' },
      {
        kind: 'table',
        head: ['Model', 'Description', 'Who pays'],
        rows: [
          ['Pure content', 'Influencer keeps all revenue, we get distribution', 'Nobody'],
          ['Flat fee', 'We pay a flat fee for specified content deliverables', 'Us'],
          ['Revenue share', 'Split on content attributable to the run', 'Both'],
          ['Sponsorship', 'Partner pays influencer, we facilitate', 'Partner'],
        ],
        caption: 'The default is Pure content. Influencers who want to be paid can negotiate. There is no obligation.',
      },
      { kind: 'h', text: 'What we will never do' },
      {
        kind: 'list',
        items: [
          'Take down a video we do not like.',
          'Claim the influencer\u2019s footage.',
          'Publish the run without the influencer\u2019s consent.',
          'Deny attribution to the influencer.',
          'Change the verification path after publishing.',
        ],
      },
      {
        kind: 'p',
        text: 'If we ever need to add a "removed at influencer request" marker, it is added to the chain as an event, and the chain still shows the run happened. The evidence is permanent even if the video is not.',
      },
      { kind: 'h', text: 'What happens when the run ends' },
      {
        kind: 'list',
        items: [
          'The influencer publishes.',
          'We publish a corresponding dev blog entry with the head hash and the anchor references.',
          'The chain continues. The run is a segment, not a terminal event.',
          'If the influencer publishes a follow-up months later, the chain still holds the original run. Nothing is deleted.',
        ],
      },
      { kind: 'h', text: 'Signature' },
      {
        kind: 'p',
        text: 'The licence is signed once. The signature covers: the influencer\u2019s Ed25519 devID; the node\u2019s attestation tier; the run\u2019s start and end timestamps; the head hash at the moment of signing. Any later change requires a new signature and a new event in the chain. Both signatures are kept. Both are verifiable. Neither invalidates the other.',
      },
      { kind: 'h', text: 'The line' },
      {
        kind: 'p',
        text: 'The influencer gets paid and protected. We get distribution and reference. The audience gets evidence they can verify for themselves — anchored outside our hands. Everybody wins or nobody plays. That is the licence.',
      },
    ],
  },

  // 5 ─ CHALLENGE FORMAT (CORRECTED)
  {
    id: 'format',
    path: 'vvu-trust/commercial/CHALLENGE_FORMAT_v0.md',
    title: 'VVU Challenge Format — v0',
    subtitle: 'A recurring live-streamed show. Multiple creators. One composed feed. One system running underneath. Hot-topic driven.',
    status: 'CANONICAL · CORRECTED',
    corrected: true,
    correctionNote: 'Terminology correction #2 applied to the through-line; anchoring referenced per correction #3.',
    blocks: [
      { kind: 'h', text: 'The shape' },
      {
        kind: 'p',
        text: 'A rotating cast of 3–6 creators are given a challenge. They must solve it using the ProofBridge system as the only tool. The system runs unattended for the duration of the episode. Every action is chained.',
      },
      {
        kind: 'table',
        head: ['Format', 'Description', 'Duration'],
        rows: [
          ['Versus', 'Two creators, same challenge, opposing teams', '2–6 h'],
          ['Relay', 'One challenge, passed creator-to-creator', '6–24 h'],
          ['Endurance', 'Everyone on the same challenge, last useful output wins', '24–72 h'],
          ['Detective', 'Hidden fault injected, creators must find it', '2–4 h'],
          ['Build-Off', 'Same inputs, different approaches, audience votes', '4–8 h'],
        ],
      },
      { kind: 'h', text: 'The rule that makes it different' },
      {
        kind: 'p',
        text: 'The system is not a prop. It is the only permitted tool.',
      },
      {
        kind: 'p',
        text: 'Creators cannot: use a phone calculator; use ChatGPT; use Excel; ask someone off-camera; look anything up online.',
      },
      {
        kind: 'p',
        text: 'They can: ask the local LLM on the node; read the live telemetry; query the journal; trigger SIS-gated actions; vote via the two-gate handshake.',
      },
      {
        kind: 'callout',
        tone: 'lime',
        text: 'Every interaction is logged. Every log entry is chained. At the end of the episode, the WORM head hash — with its signed, externally anchored checkpoints — is published on screen. Anyone in the audience can verify the evidence.',
      },
      { kind: 'h', text: 'Why hot topics matter' },
      {
        kind: 'p',
        text: 'The format is a container. The content is whatever is trending.',
      },
      {
        kind: 'table',
        head: ['Trend type', 'Example', 'Adaptation'],
        rows: [
          ['Agricultural crisis', 'Load-shedding Stage 6', '"Keep the cold chain alive with no grid"'],
          ['Weather event', 'Heatwave warning', '"Protect the borehole from overdraw"'],
          ['Market move', 'Citrus export price spike', '"Deliver compliant crop under time pressure"'],
          ['Viral moment', 'A farm TikTok trend', '"Recreate it using only system outputs"'],
          ['Political news', 'Water infrastructure bill', '"Prove a leak in under 60 minutes"'],
          ['Sports', 'Currie Cup final', '"Predict and prove the post-match ice demand"'],
        ],
        caption: 'Trends are monitored weekly. Episode brief is written 72 hours ahead.',
      },
      { kind: 'h', text: 'The cast' },
      {
        kind: 'list',
        items: [
          '10k–500k followers (mid-tier, high engagement).',
          'Distinct audience overlap (no cannibalisation).',
          'Willing to sign the participation agreement.',
          'Willing to hand over a scoped OAuth token for stream routing.',
          'Willing to be on-camera for the full episode.',
          'Big Brother alumni pool: verified format-experienced talent, fast to brief, comfortable on-camera for extended shoots, known faces to mainstream audiences. Booked as the anchor per episode.',
        ],
      },
      { kind: 'h', text: 'The broadcast' },
      {
        kind: 'p',
        text: 'One composed feed. Multi-view layout: creator cams + live system telemetry overlay + the live journal ticker. The head hash, tier badge and the latest anchored checkpoint run pinned to the bottom of the frame (see the composed-feed mock above). This feed is pushed simultaneously to every creator\u2019s channel via their own OAuth token — each audience sees the same composed show, but each creator\u2019s chat handles their own community reaction. Voice-over is recorded live by a rotating host.',
      },
      { kind: 'h', text: 'Cadence' },
      {
        kind: 'table',
        head: ['Phase', 'Timing'],
        rows: [
          ['Trend scan', 'Weekly (Monday)'],
          ['Episode brief', 'T-72h'],
          ['Cast locked', 'T-48h'],
          ['Tech rehearsal', 'T-24h'],
          ['Live episode', 'As scheduled'],
          ['Evidence publish', 'T+2h'],
          ['Creator cutdown', 'T+48h'],
          ['Recap blog', 'T+7d'],
        ],
        caption: 'Target cadence: 2 episodes per month, scaling to weekly once routing is stable.',
      },
      { kind: 'h', text: 'Monetisation per episode' },
      {
        kind: 'table',
        head: ['Stream', 'Recipient', 'Notes'],
        rows: [
          ['YouTube ad revenue', 'Creator, own channel', 'Each creator keeps own'],
          ['Twitch subs', 'Creator, own channel', 'Each creator keeps own'],
          ['TikTok gifts', 'Creator, own channel', 'Each creator keeps own'],
          ['Sponsorship (title)', 'Split — master 40% / creators 60%', 'Sold by us'],
          ['Post-show cutdown', 'Creator keeps 100%', 'Edits, shorts, clips'],
          ['System demo inquiries', 'Master', 'Leads routed to sales'],
        ],
        caption: 'The master server earns from sponsorship placement, not from creator revenue. Creators keep their own platform earnings.',
      },
      { kind: 'h', text: 'The through-line (CORRECTED)' },
      {
        kind: 'callout',
        tone: 'amber',
        text: 'Each episode ends with the same on-screen statement: "This ran for [duration]. The evidence is chained and anchored. The head is [head]. Verify it yourself at [URL]." The audience can verify the evidence. The creators can verify. The sponsors can verify. Nobody needs to take the show\u2019s word for it — the word "unedited" is never claimed; the chain and the anchors are what speak.',
      },
    ],
  },

  // 6 ─ LIVE ROUTING ARCHITECTURE (MOST CORRECTED)
  {
    id: 'routing',
    path: 'vvu-trust/commercial/LIVE_ROUTING_ARCH_v0.md',
    title: 'Live Routing Architecture — v0',
    subtitle: 'One composed feed. Many destinations. Creators hold their own OAuth tokens. Master server never stores them in plaintext.',
    status: 'CANONICAL · CORRECTED',
    corrected: true,
    correctionNote: 'Corrections #1 (adapter capability contracts) + #3 (anchor pipeline) applied; INVARIANT ZERO pinned at the top of the doc.',
    blocks: [
      { kind: 'h', text: 'Invariant Zero (pinned first)' },
      {
        kind: 'callout',
        tone: 'crimson',
        text: 'The broadcast system is never part of the evidence-producing system. It consumes evidence; it does not manufacture or validate it. If the broadcast layer fails, the underlying run continues and remains verifiable. If the evidence layer fails its circuit breaker, the broadcast truthfully displays EVIDENCE INVALID / BROADCAST HALTED. The chain: Mk-0.5 Edge Node → Pro Tablet → ProofBridge evidence runtime → Master Broadcast → Creator channels. The runtime produces the proof; the broadcast only shows it.',
      },
      { kind: 'h', text: 'The problem' },
      {
        kind: 'p',
        text: 'The same composed show must appear live on every creator\u2019s channel simultaneously, with each creator keeping their own audience, their own chat, their own monetisation — without asking creators to install anything or hand over passwords. Scoped OAuth tokens solve this: each platform issues a token that authorises a server to push a stream to a specific channel. The creator grants it once. Either side can revoke at any time.',
      },
      { kind: 'h', text: 'Architecture' },
      {
        kind: 'pre',
        text: `+----------------------------------------------------------+
|              MASTER COMPOSITION SERVER                   |
|                                                            |
|  Inputs:                                                   |
|    - Creator 1 video  (WebRTC from their phone/PC)         |
|    - Creator 2 video                                       |
|    - Creator N video                                       |
|    - System telemetry overlay (from Mk-0.5 Edge Node)      |
|    - Live journal ticker (WORM head hash)                  |
|    - Host voice-over                                       |
|                                                            |
|  Processing:                                               |
|    - Multi-view composition (OBS-class, headless)          |
|    - Overlay injection (telemetry, hash, tier badge)       |
|    - Audio mix (host + creator channels + stingers)        |
|    - HLS segment packaging                                 |
+----------------------------+-------------------------------+
                             |
+----------------------------v-------------------------------+
|              DESTINATION ROUTER                            |
|                                                            |
|  For each creator:                                         |
|    1. Load their OAuth token (decrypted from vault)        |
|    2. Open RTMP/SRT session to their ingest endpoint        |
|    3. Push the composed HLS feed                           |
|    4. Log push status every 5 s                            |
|                                                            |
|  Destinations (PER ADAPTER CAPABILITY CONTRACT):            |
|    - Creator A -> YouTube Live (their channel)              |
|    - Creator B -> YouTube Live (their channel)              |
|    - Creator C -> Twitch (their channel)                    |
|    - Creator D -> TikTok Live (AVAILABILITY UNCONFIRMED)    |
|    - Creator E -> Facebook Live (their page)                |
|    - Host       -> YouTube Live (master channel)            |
+----------------------------------------------------------+`,
      },
      { kind: 'h', text: 'Token handling' },
      {
        kind: 'p',
        text: 'The rule: the master server never stores an OAuth token in plaintext, never logs it, and never transmits it outside the vault.',
      },
      {
        kind: 'pre',
        text: `Creator onboarding:

1. Creator visits the connect endpoint.
2. Creator logs in with their platform account (OAuth).
3. Platform returns token to our redirect URL.
4. Our redirect handler:
   a. Encrypts token with server master key
   b. Stores encrypted blob in vault (Postgres + RLS)
   c. Associates blob with creator devID + platform + scopes
   d. Returns success page to creator
5. Creator sees: "Connected. You can revoke any time."

Revocation:

- Creator revokes via our revocation page,
- or at platform level (YouTube/Twitch/TikTok settings).
- Either path invalidates the token on next use.
- Router detects 401/403 -> marks token dead -> stops pushing.`,
      },
      {
        kind: 'callout',
        tone: 'amber',
        text: 'CORRECTION #1 — the platform scopes table is REPLACED by adapter-specific capability contracts. The exact scopes, ingest APIs and availability are per-platform facts that change over time; each adapter carries its own verified contract (see the ADAPTER CAPABILITY CONTRACTS panel). Minimum scopes only — never subscriber lists, analytics or private messages.',
      },
      { kind: 'h', text: 'Composition server stack' },
      {
        kind: 'table',
        head: ['Layer', 'Component', 'Purpose'],
        rows: [
          ['Media framework', 'FFmpeg (headless)', 'Composition, encoding, HLS packaging'],
          ['WebRTC ingest', 'MediaMTX or Janus', 'Receive creator phone/PC streams'],
          ['Overlay engine', 'Python + Pillow / Cairo', 'Live telemetry + hash injection'],
          ['Audio mixer', 'FFmpeg filters', 'Host + creators + stingers'],
          ['Router', 'Python async + RTMP/SRT lib', 'Push to N destinations'],
          ['Vault', 'Postgres + pgcrypto + RLS', 'Encrypted OAuth token storage'],
          ['Orchestrator', 'FastAPI', 'Episode control, start/stop, health'],
        ],
      },
      {
        kind: 'table',
        head: ['Setup', 'CPU', 'GPU', 'Concurrent destinations'],
        rows: [
          ['Dev', '8-core', 'none', '3'],
          ['Studio', '16-core', '1 × mid-tier GPU', '8'],
          ['Broadcast', '32-core', '2 × GPU', '20'],
        ],
        caption: 'Target: 8 destinations on a single 16-core machine at 1080p30 — enough for 6 creators + 1 host + 1 backup.',
      },
      { kind: 'h', text: 'Failure handling' },
      {
        kind: 'table',
        head: ['Failure', 'Detection', 'Response'],
        rows: [
          ['Creator stream drops', 'WebRTC ICE disconnect', 'Show "reconnecting" slate in their tile'],
          ['Destination push fails', 'HTTP 4xx/5xx from ingest', 'Retry with backoff; log to chain'],
          ['Token expires mid-episode', '401 from platform', 'Log event; other destinations continue'],
          ['Composition server CPU spike', 'Prometheus threshold', 'Drop backup destinations first'],
          ['WORM head hash mismatch', 'Chain verify fails', 'STOP broadcast; display EVIDENCE INVALID / BROADCAST HALTED; log abort event'],
        ],
        caption: 'The abort path is critical. If the chain fails, the show stops. This is the difference between a broadcast and a proof — and it is INVARIANT ZERO enforced in code.',
      },
      { kind: 'h', text: 'Evidence overlay (live — CORRECTED)' },
      {
        kind: 'p',
        text: 'The bottom of the composed feed shows, in real time, the live head hash, the attestation tier, the event count — and the latest anchored checkpoint. The ticker refreshes every 5 seconds and is pinned to the bottom of the frame so every screenshot carries it.',
      },
      {
        kind: 'callout',
        tone: 'teal',
        text: 'DISPLAY ≠ ANCHOR (correction #3): the 5-second ticker is a live view of chain state, not proof. The proof is the anchored checkpoint stream — event → local chain → signed checkpoint → externally observable timestamp/anchor → public verification. Viewers can screenshot any frame, then verify the hash AND the anchor against the public endpoint. The anchors are what the show cannot fake, because they are observable outside VVU.',
      },
      { kind: 'h', text: 'What the creator does NOT have to do' },
      {
        kind: 'list',
        items: [
          'Install software.',
          'Open their own OBS.',
          'Configure RTMP.',
          'Share their password.',
          'Trust us with anything beyond the scoped OAuth grant.',
          'Be online for the whole episode (their tile shows their feed; if they drop, the tile shows a slate).',
        ],
      },
      {
        kind: 'p',
        text: 'The creator\u2019s only job is to be on-camera and hand over the scoped token. Everything else is our server\u2019s problem.',
      },
      { kind: 'h', text: 'What the master server guarantees' },
      {
        kind: 'list',
        items: [
          'Token stored encrypted, never logged, never transmitted.',
          'Push to each channel only during the scheduled episode window.',
          'No access to creator analytics or subscriber data.',
          'Immediate stop on request (kill switch).',
          'Full audit log of every push, every retry, every failure.',
        ],
      },
      {
        kind: 'p',
        text: 'The creator can revoke at any time and the router stops on the next check. No argument, no notice, no delay.',
      },
    ],
  },

  // 7 ─ CREATOR AGREEMENT
  {
    id: 'agreement',
    path: 'vvu-trust/commercial/CREATOR_AGREEMENT_v0.md',
    title: 'Creator Participation Agreement — v0',
    subtitle: 'Between the creator (legal / channel name) and the VVU operating entity, for participation in VVU Challenge episodes.',
    status: 'CANONICAL',
    corrected: false,
    blocks: [
      { kind: 'h', text: '1 · What you are agreeing to' },
      {
        kind: 'p',
        text: 'You will appear on-camera during one or more scheduled episodes of the VVU Challenge format. Your face, voice, and reactions will be included in a composed live feed broadcast to multiple channels, including your own. You will grant us a scoped OAuth token for your streaming platform so that the composed feed can be pushed to your channel during the episode window. You will receive compensation as set out in section 5.',
      },
      { kind: 'h', text: '2 · What you keep' },
      {
        kind: 'list',
        items: [
          'Your channel. Everything stays under your account. We do not own your channel, your subscribers, or your monetisation.',
          'Your audience. Your community sees your channel. We do not harvest, export, or market to them.',
          'Your platform revenue. Ad revenue, subs, gifts, tips, donations from your channel during and after the episode are 100% yours.',
          'Your cutdown rights. You may cut, edit, and re-publish any portion of the episode for your own channels, at any time, forever, with no approval from us and no revenue share to us.',
          'Your likeness. We will not use your likeness in paid advertising outside the episode itself without a separate, signed agreement.',
        ],
      },
      { kind: 'h', text: '3 · What you grant' },
      {
        kind: 'p',
        text: 'For the duration of each episode only: the right to include your camera feed in the composed broadcast; the right to push the composed feed to your channel via your OAuth token; the right to cite your participation in post-episode recaps; the right to include your channel name and subscriber count in sponsor-facing materials (aggregate only, no personal data).',
      },
      {
        kind: 'p',
        text: 'Not granted: right to use your channel after the episode window ends; right to access your analytics or subscriber list; right to re-edit your performance into a different show; right to sell access to your audience through our platform.',
      },
      { kind: 'h', text: '4 · Token handling and revocation' },
      {
        kind: 'list',
        items: [
          'Your OAuth token is encrypted and stored in a vault.',
          'We access it only during the scheduled episode window.',
          'The token is used only to push the composed feed to your channel.',
          'You may revoke the token at any time, at platform level or via our revocation page.',
          'On revocation, we stop pushing to your channel on the next check (within 5 seconds).',
        ],
      },
      {
        kind: 'callout',
        tone: 'crimson',
        text: 'We do not store your platform password. Ever. At no point.',
      },
      { kind: 'h', text: '5 · Compensation' },
      {
        kind: 'table',
        head: ['Model', 'Amount', 'Notes'],
        rows: [
          ['Flat fee', 'ZAR [X]', 'Paid on episode completion'],
          ['Revenue share', '[Y]% of sponsor revenue', 'Attributed by master pool'],
          ['Hybrid', 'ZAR [X] + [Y]%', 'Most common'],
        ],
        caption: 'Platform revenue from your own channel is not affected by this agreement and is not counted against compensation.',
      },
      { kind: 'h', text: '6 · Conduct' },
      {
        kind: 'p',
        text: 'You agree to: remain on-camera for the duration agreed per episode; not use tools outside the VVU system during challenges; not disclose challenge solutions to other participants; not stream the episode on any platform not covered by this agreement without written consent.',
      },
      {
        kind: 'p',
        text: 'You do not agree to: any required political, religious, or social position; any endorsement of our company outside the episode; any restriction on your future content.',
      },
      { kind: 'h', text: '7 · Evidence and verification' },
      {
        kind: 'p',
        text: 'Every episode produces a WORM-chained evidence log. At the end of the episode: the head hash is published on your channel and ours; the full journal is available to you for your own records; you may verify the chain and the anchors yourself at any time; you may publish the verification result to your audience.',
      },
      {
        kind: 'callout',
        tone: 'teal',
        text: 'The chained record cannot be edited by us or by you — that is the point. What your recording shows is your footage; what the chain proves is the recorded run. Both are yours to publish.',
      },
      { kind: 'h', text: '8 · Exit' },
      {
        kind: 'list',
        items: [
          'Before an episode: no penalty, no notice required.',
          'Mid-episode: broadcast continues with your feed replaced by a slate; you keep any platform revenue earned to that point.',
          'After an episode: no ongoing obligation.',
          'We may end the relationship for breach of section 6, illegal conduct on-camera, or repeated failure to appear.',
          'Either party may terminate in writing at any time. No exit fee.',
        ],
      },
      { kind: 'h', text: '9 · Signatures' },
      {
        kind: 'p',
        text: 'Creator: signature + date + Ed25519 devID. VVU: signature + date + role. Both signatures are appended to the WORM chain as an event. The agreement is verifiable by anyone who has the head hash.',
      },
      { kind: 'h', text: 'The one line that matters' },
      {
        kind: 'callout',
        tone: 'lime',
        text: 'You keep your audience, your channel, your money, and your cutdowns. We keep a scoped token, for one window, to push one feed. Nothing else.',
      },
    ],
  },

  // 8 ─ EPISODE BRIEF TEMPLATE (Round 32 · written on the operator's word,
  // behind the pinned INVARIANT ZERO; correction #3 applied to §8)
  {
    id: 'episode_brief',
    path: 'vvu-trust/commercial/episode_brief_template.md',
    title: 'Episode Brief — T-72h',
    subtitle: 'The brief that goes to cast and crew. Trend picked, challenge defined, tools allowed, schedule set.',
    status: 'CANONICAL · CORRECTED',
    corrected: true,
    correctionNote:
      'Correction #3 applied on arrival (§8): the on-screen hash is DISPLAY — backdating is defeated by the signed, externally anchored checkpoint stream, not by the live ticker.',
    blocks: [
      {
        kind: 'pre',
        text: [
          'Episode ID:      EP-{{YYYY}}-{{SEQ}}',
          'Trend under lens: {{TREND_LABEL}}',
          'Challenge type: {{VERSUS | RELAY | ENDURANCE | DETECTIVE | BUILD-OFF}}',
          'Duration target: {{HOURS}} h',
          'Broadcast window: {{START_UTC}} → {{END_UTC}}',
          'Site:            {{SITE_ID}} ({{FARM | MUNICIPAL | INDUSTRIAL}})',
        ].join('\n'),
      },
      { kind: 'h', text: '1 · The trend' },
      {
        kind: 'p',
        text: 'One paragraph. What happened this week that makes this timely. Include the source and date.',
      },
      {
        kind: 'callout',
        tone: 'amber',
        text: 'Example — "On 14 April, Eskom announced Stage 6 load-shedding through the Easter weekend. Citrus harvest is peaking in the Eastern Cape. Packhouses without cold-chain autonomy will lose export-grade fruit."',
      },
      { kind: 'h', text: '2 · The challenge' },
      {
        kind: 'p',
        text: 'One paragraph. The problem each creator must solve using only the ProofBridge system. State the win condition clearly.',
      },
      {
        kind: 'callout',
        tone: 'teal',
        text: 'Example — "Maintain export-grade cold-chain compliance for 24 hours under simulated Stage 6. The system must not exceed 6°C in any chamber at any point. Power is cut at t=0 and does not return. Creators may use the local LLM, telemetry, and SIS-gated actuators only. First creator to complete the run and produce a verified WORM head hash wins."',
      },
      { kind: 'h', text: '3 · Cast' },
      {
        kind: 'table',
        head: ['Slot', 'Creator', 'Channel', 'Subscribers', 'Role'],
        rows: [
          ['Anchor', '{{NAME}}', '{{CHANNEL}}', '{{N}}', 'Lead commentator'],
          ['Creator A', '{{NAME}}', '{{CHANNEL}}', '{{N}}', 'Team A'],
          ['Creator B', '{{NAME}}', '{{CHANNEL}}', '{{N}}', 'Team B'],
          ['Creator C', '{{NAME}}', '{{CHANNEL}}', '{{N}}', 'Floating'],
        ],
      },
      {
        kind: 'p',
        text: 'Host (voice-over): {{NAME}} · Director engine: ProofBridge Studio Director v0.',
      },
      { kind: 'h', text: '4 · Allowed tools' },
      {
        kind: 'list',
        items: [
          'Local LLM on the Mk-0.5 node',
          'Live telemetry dashboard',
          'Journal query',
          'SIS-gated actuator controls (subject to hardware limits)',
          'Two-gate vote interface',
          '8-bit onboarding game (for learning only, not solving)',
        ],
      },
      {
        kind: 'list',
        items: [
          'Any external AI (ChatGPT, Claude, Gemini, etc.)',
          'Calculator apps',
          'Search engines',
          'Off-camera human assistance',
          'Note-taking apps other than the journal',
        ],
      },
      {
        kind: 'callout',
        tone: 'crimson',
        text: 'Violation of "not allowed" is detected by the director engine via screen recording analysis. First violation → warning tile. Second → 10-minute penalty. Third → disqualification.',
      },
      { kind: 'h', text: '5 · Schedule' },
      {
        kind: 'table',
        head: ['T−/+', 'Action'],
        rows: [
          ['T-72h', 'Brief issued to cast'],
          ['T-48h', 'Cast locks (no swaps)'],
          ['T-24h', 'Tech rehearsal (30 min)'],
          ['T-4h', 'Composed feed test to all destinations'],
          ['T-1h', 'Pre-show green room'],
          ['T-0', 'Live'],
          ['T+{{HOURS}}', 'Episode end'],
          ['T+2h', 'Theme drop published'],
          ['T+7d', 'Recap blog'],
        ],
      },
      { kind: 'h', text: '6 · Cue sheet reference' },
      {
        kind: 'p',
        text: 'Cue sheet for this episode: cue_sheets/EP-{{YYYY}}-{{SEQ}}.json — signed by producer on {{DATE}}. Hash: {{HEAD}}.',
      },
      {
        kind: 'callout',
        tone: 'amber',
        text: 'The director engine will not run without a signed cue sheet. If the cue sheet is missing or unsigned, the studio reverts to manual mode and the episode is postponed.',
      },
      { kind: 'h', text: '7 · Sponsor integration' },
      {
        kind: 'table',
        head: ['Slot', 'Sponsor', 'Overlay', 'Duration'],
        rows: [
          ['Opening', '{{NAME}}', '5 s bumper', 'once'],
          ['Mid-1', '{{NAME}}', '10 s ticker', 'at T+{{H}}'],
          ['Mid-2', '{{NAME}}', '10 s ticker', 'at T+{{H}}'],
          ['Closing', '{{NAME}}', '5 s bumper', 'once'],
        ],
      },
      {
        kind: 'p',
        text: 'Sponsor revenue split: master 40% / creators 60% (by screen time).',
      },
      { kind: 'h', text: '8 · Evidence checkpoints' },
      {
        kind: 'p',
        text: 'At these moments, the composed feed will overlay the current WORM head hash for 10 seconds:',
      },
      {
        kind: 'table',
        head: ['Checkpoint', 'Trigger'],
        rows: [
          ['Opening', 'Episode start'],
          ['Mid-1', 'After first narrative beat'],
          ['Mid-2', 'After second narrative beat'],
          ['Chain verify', 'On SIS trip or two-gate resolution'],
          ['Closing', 'Episode end'],
        ],
      },
      {
        kind: 'callout',
        tone: 'teal',
        text: 'The head hash is a live view of chain state — any viewer can screenshot it and verify. What defeats backdating is the signed checkpoint stream anchored outside VVU (DISPLAY ≠ ANCHOR), not the on-screen ticker itself.',
      },
      { kind: 'h', text: '9 · Success criteria' },
      {
        kind: 'list',
        items: [
          'Duration target met (or all creators eliminated)',
          'WORM head hash published and verified',
          'Theme drop package generated successfully',
          'All destinations received the composed feed for > 90% of runtime',
          'No safety gate was bypassed',
        ],
      },
      {
        kind: 'p',
        text: 'Any failure in 5 voids the episode. Failure in 3 delays the drop.',
      },
      { kind: 'h', text: '10 · Sign-off' },
      {
        kind: 'pre',
        text: [
          'Producer:     _____________________  Date: ________',
          'Cast anchor:  _____________________  Date: ________',
          'Sponsor rep:  _____________________  Date: ________',
        ].join('\n'),
      },
      {
        kind: 'p',
        text: 'All signatures appended to the WORM chain as events.',
      },
    ],
  },

  // 9 ─ HOST ROTATION SPEC (Round 32 · written on the operator's word,
  // behind the pinned INVARIANT ZERO)
  {
    id: 'host_rotation',
    path: 'vvu-trust/broadcast/host_rotation_spec.md',
    title: 'Host Rotation Spec — v0',
    subtitle: 'The voice-over host system. Who hosts which episode, how they are booked, what they are paid, how their channel slots into the routing.',
    status: 'CANONICAL',
    corrected: false,
    blocks: [
      {
        kind: 'p',
        text: 'The host is the voice of the episode. They are the anchor tile, the narrator, and the audience\u2019s guide. The director engine cuts; the host explains why.',
      },
      { kind: 'h', text: 'Role' },
      {
        kind: 'p',
        text: 'The host is not a "presenter." They are the audience\u2019s translator. They sit in the control room, they see the composed feed, and they say what is happening in plain language. They are the only voice the audience hears between creator segments.',
      },
      {
        kind: 'p',
        text: 'The host does not control the cuts. The director engine does. The host has a paddle to suspend rules for 30 seconds if a narrative beat demands it. Every paddle press is journaled.',
      },
      { kind: 'h', text: 'Rotation model' },
      {
        kind: 'p',
        text: 'No permanent host. Rotating cast of 5 anchors. Each anchors one episode per cycle. Cycle = 5 episodes ≈ 2.5 months at the 2-per-month cadence.',
      },
      {
        kind: 'table',
        head: ['Host slot', 'Episodes per cycle', 'Channel'],
        rows: [
          ['H1', '1', 'Their own channel (they keep the audience)'],
          ['H2', '1', 'Their own channel'],
          ['H3', '1', 'Their own channel'],
          ['H4', '1', 'Their own channel'],
          ['H5', '1', 'Their own channel'],
          ['Guest', 'occasional', 'Booked per episode'],
        ],
      },
      {
        kind: 'list',
        items: [
          'No single host\u2019s brand overshadows the format',
          'Each host brings their audience the first time',
          'Fatigue is avoided',
          'Multiple hosts can be promoted in parallel',
        ],
      },
      { kind: 'h', text: 'Compensation' },
      {
        kind: 'table',
        head: ['Model', 'Amount', 'Notes'],
        rows: [
          ['Flat per episode', 'ZAR {{X}}', 'Paid on episode completion'],
          ['Revenue share', '15% of sponsor pool', 'Credited per episode'],
          ['Hybrid', 'ZAR {{X/2}} + 10%', 'Most common'],
          ['Guest', 'Daily rate', 'For one-off bookings'],
        ],
      },
      {
        kind: 'p',
        text: 'Host keeps 100% of their own channel\u2019s platform revenue. Same rule as creators.',
      },
      { kind: 'h', text: 'Booking flow' },
      {
        kind: 'table',
        head: ['Stage', 'Timing', 'Actor'],
        rows: [
          ['Availability check', 'T-21d', 'Casting'],
          ['Offer issued', 'T-14d', 'Casting'],
          ['Acceptance', 'T-12d', 'Host'],
          ['Brief delivered', 'T-7d', 'Producer'],
          ['Tech rehearsal', 'T-24h', 'Host + studio'],
          ['Green room', 'T-1h', 'Host + cast'],
          ['Live', 'T-0', 'All'],
          ['Wrap payment', 'T+7d', 'Finance'],
        ],
      },
      {
        kind: 'p',
        text: 'If a host declines, casting escalates to the next available slot within 24 hours.',
      },
      { kind: 'h', text: 'Host channel routing' },
      {
        kind: 'p',
        text: 'The host\u2019s channel receives the same composed feed as every other destination. Their audience sees the same show. Their chat is their own. Their monetisation is their own.',
      },
      {
        kind: 'callout',
        tone: 'lime',
        text: 'Exception — the host channel receives an additional lower-third overlay identifying the host by name and channel. Variant delta: +1 lower-third text box, 4 s display time at each segment boundary. Nothing else.',
      },
      { kind: 'h', text: 'Host responsibilities' },
      {
        kind: 'list',
        items: [
          'Remain on camera for the duration',
          'Narrate cuts explained by the director engine\u2019s rule names',
          'Announce WORM hash checkpoints as they appear',
          'Call out safety events in plain language',
          'Use paddle sparingly (target: < 5 presses per episode)',
        ],
      },
      {
        kind: 'list',
        items: [
          'Publish their own cutdown reel to their channel (within 48h)',
          'Attend a 30-min debrief (optional but encouraged)',
          'Recommend the next host from the rotation pool',
        ],
      },
      {
        kind: 'list',
        items: [
          'Choosing the challenge',
          'Casting creators',
          'Handling sponsor integrations (that\u2019s the producer)',
          'Verifying evidence (that\u2019s anyone\u2019s job, including theirs)',
        ],
      },
      { kind: 'h', text: 'Host onboarding' },
      {
        kind: 'list',
        items: [
          'Signs the same Creator Participation Agreement (no changes)',
          'Watches a 20-minute backstage video on the director engine',
          'Runs one tech rehearsal with a producer',
          'Receives the cue sheet template and a worked example',
          'Confirms understanding that the ledger outranks them',
        ],
      },
      {
        kind: 'callout',
        tone: 'amber',
        text: 'Point 5 is the only non-negotiable. The host explains the show. The ledger records it. If the host says one thing and the ledger says another, the ledger wins.',
      },
      { kind: 'h', text: 'Host rotation calendar (first year)' },
      {
        kind: 'table',
        head: ['Month', 'Episode', 'Host', 'Creators', 'Theme'],
        rows: [
          ['M1', 'E1', 'H1', '3', 'Launch pilot'],
          ['M1', 'E2', 'H2', '4', 'Load-shedding premiere'],
          ['M2', 'E3', 'H3', '4', 'First municipal twin'],
          ['M3', 'E4', 'H4', '5', 'B2B partner episode'],
          ['M3', 'E5', 'H5', '3', 'Youth skills tie-in'],
          ['M4', 'E6', 'H1', '4', 'Relay format debut'],
          ['M4', 'E7', 'H2', '5', 'First endurance run'],
          ['M5', 'E8', 'Guest', '6', 'Trend-led special'],
        ],
      },
      {
        kind: 'p',
        text: 'By end of first year, each host has anchored 2–3 episodes. The rotation deepens. Guest slots become a pipeline for new hosts.',
      },
      { kind: 'h', text: 'Host as content multiplier' },
      {
        kind: 'p',
        text: 'Each host publishes their own cutdown (own channel, 100% revenue). Each host publishes their own backstage commentary (own channel). Each host can re-host their episode as a VOD (own channel).',
      },
      {
        kind: 'p',
        text: 'The host\u2019s channel is the second-most important destination after the master channel. Not because they drive the most viewers, but because their audience comes back for the host. The format earns the audience; the host keeps it warm.',
      },
      { kind: 'h', text: 'The line' },
      {
        kind: 'callout',
        tone: 'lime',
        text: 'The host explains the truth. The ledger records it. The audience verifies it. Every host\u2019s job is to be the bridge between the director engine\u2019s decisions and the human watching at home. That is the role.',
      },
    ],
  },
];

// ─── Round 32 — the two artifacts are WRITTEN (operator's word received) ─────

export interface WrittenArtifact {
  name: string;
  path: string;
  status: string;
  note: string;
}

export const WRITTEN_THIS_ROUND: WrittenArtifact[] = [
  {
    name: 'episode_brief_template.md',
    path: 'vvu-trust/commercial/episode_brief_template.md',
    status: 'WRITTEN — CANONICAL · CORRECTED',
    note: 'Written behind the pinned INVARIANT ZERO. Correction #3 applied to §8: the on-screen hash is DISPLAY; backdating is defeated by the anchored checkpoint stream. Also on disk in the vvu-trust/ repo tree.',
  },
  {
    name: 'host_rotation_spec.md',
    path: 'vvu-trust/broadcast/host_rotation_spec.md',
    status: 'WRITTEN — CANONICAL',
    note: 'Written behind the pinned INVARIANT ZERO. The host explains the show; the ledger records it; the audience verifies it. Also on disk in the vvu-trust/ repo tree.',
  },
];

export const WRITTEN_NOTE =
  'Operator ruling honoured end-to-end: no artifacts were written until the three corrections landed and INVARIANT ZERO was pinned (both done, Round 31). These two were written the moment the operator\u2019s word arrived — supplied in-session, canonicalised with the same shape as the seven, and written to the vvu-trust/ repo tree on disk.';

// ─── Provenance disclosure ──────────────────────────────────────────────────

export const BROADCAST_PROVENANCE = {
  headline: 'NINE ARTIFACTS · CORRECTED + COMPLETED ON THE OPERATOR\u2019S WORD',
  body:
    'The operator supplied seven broadcast-layer artifacts in-session and returned a review verdict before canonicalisation: three corrections (adapter capability contracts, the "provably unedited" overclaim, display-vs-anchor) plus one invariant (the broadcast system never produces evidence). All are applied in the document text. Round 32: the operator\u2019s word arrived and the two queued artifacts — episode brief + host rotation — were written behind the pinned invariant, making nine canonical documents (all also on disk in the vvu-trust/ repo tree). Document statuses remain SPEC-level: no live-platform capability is claimed — every adapter carries its own verification status.',
} as const;

// ─── Markdown builder (single source → canonical text) ──────────────────────

export function docMarkdown(doc: BroadcastDoc): string {
  const lines: string[] = [];
  lines.push(`# ${doc.title.replace(/ — v0$/, '')}`);
  lines.push('');
  lines.push(doc.subtitle);
  lines.push('');
  if (doc.correctionNote) lines.push(`> ${doc.correctionNote} — ${doc.status}`);
  for (const b of doc.blocks) {
    switch (b.kind) {
      case 'h':
        lines.push('', `## ${b.text}`, '');
        break;
      case 'p':
        lines.push(b.text, '');
        break;
      case 'list':
        lines.push(...b.items.map((i) => `- ${i}`), '');
        break;
      case 'pre':
        lines.push('```', b.text, '```', '');
        break;
      case 'callout':
        lines.push(`> ${b.text}`, '');
        break;
      case 'table':
        lines.push(`| ${b.head.join(' | ')} |`);
        lines.push(`| ${b.head.map(() => '---').join(' | ')} |`);
        for (const r of b.rows) lines.push(`| ${r.join(' | ')} |`);
        if (b.caption) lines.push('', `_${b.caption}_`);
        lines.push('');
        break;
    }
  }
  return lines.join('\n').trim() + '\n';
}

export const INVARIANT_MARKDOWN: string = [
  '# Invariant Zero — Evidence / Broadcast Separation',
  '',
  INVARIANT_ZERO.rule,
  '',
  'Chain: ' + INVARIANT_ZERO.chain.map((c) => c.name).join(' → '),
  '',
  '## Failure independence',
  ...INVARIANT_ZERO.failures.map((f) => `- **${f.fail}** — ${f.response}`),
  '',
  '## Precedence',
  INVARIANT_ZERO.precedence,
  '',
  '## Anchor pipeline',
  ...ANCHOR_PIPELINE.map((s, i) => `${i + 1}. **${s.stage}** — ${s.note}`),
  '',
  ANCHOR_NOTE,
  '',
  '## Adapter rule',
  ADAPTER_RULE,
].join('\n');
