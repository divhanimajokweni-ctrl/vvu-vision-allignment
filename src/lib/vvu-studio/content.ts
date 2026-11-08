// VVU Studio lib — content module
// Static content the studio renders: the IVE default payload, the docs
// (README, doctrine, lessons), and the .vvu/config.json view. Pure data,
// no I/O. The block-based DocContent is what DocView walks to render
// prose with bold, code, callouts, and tables.

import type { ViewKey } from "./types";

// ─── IVE default payload + author ─────────────────────────────────────────────

/** The default 11-field IVE payload — what IveView shows as the canonical
 *  example. The fields mirror CANON_FIELDS in ./types.ts. */
export const DEFAULT_PAYLOAD: Record<string, string | number> = {
  submission_id: "sub_demo_0001",
  subject_id: "vvu-003",
  author_id: "founder@vvu.earth",
  session_id: "sess_42",
  evidence_hash: "0xabc...def",
  observed_at: "2026-01-15T10:42:00Z",
  submitted_at: "2026-01-15T10:43:17Z",
  tier: "T1",
  confidence: 0.72,
  bounds: 0.05,
  channel: "studio",
};

/** The default author — surfaced by IveView's author row. */
export const DEFAULT_AUTHOR = "founder@vvu.earth";

// ─── .vvu/config.json ─────────────────────────────────────────────────────────

/** The .vvu/config.json view — a small, fixed config the studio renders as
 *  syntax-highlighted JSON. Keys mirror the doctrine (Ed25519, MMR,
 *  canonical, gates). */
export const CONFIG_JSON: Record<string, unknown> = {
  doctrine: "paranoia-first",
  canonical: { algorithm: "JCS", hash: "SHA-256" },
  signature: { algorithm: "Ed25519", fallback: "HMAC-SHA256", stub_flagged: true },
  merkle: { algorithm: "SHA-256", leaves: "receiptHash", odd: "duplicate_last" },
  gates: { computed: 11, stubbed: 2, stubbed_flagged: ["L7", "L13"] },
  worm: { append_only: true, genesis: "0".repeat(64) },
};

// ─── Docs (block-based prose) ─────────────────────────────────────────────────

/** A doc block — one element of a DocContent body. The renderer switches
 *  on `type` to produce the right JSX. */
export type DocBlock =
  | { type: "kicker"; text: string }
  | { type: "h1"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "lede"; text: string }
  | { type: "p"; text: string }
  | { type: "pre"; text: string }
  | { type: "callout"; text: string; tone?: "warn" }
  | { type: "table"; head: string[]; rows: string[][] }
  | { type: "hr" };

/** A doc page — a kicker + a title + a body of blocks. */
export interface DocContent {
  blocks: DocBlock[];
}

/** All doc pages, keyed by ViewKey. DocView looks up `DOCS[view]` and
 *  renders the blocks. Pages without a doc (loop, rules, etc.) have their
 *  own dedicated view component — DocView returns null for them. */
export const DOCS: Record<string, DocContent> = {
  readme: {
    blocks: [
      { type: "kicker", text: "the loop / README.md" },
      { type: "h1", text: "Six things · one loop · the number goes up" },
      { type: "lede", text: "The studio is a paranoia-first learning environment. Six capabilities, one loop, one number. The number going up is the point." },
      { type: "p", text: "Take in an observation. Run written-down rules. Produce a receipt. Say the current number. Close an item by artifact. Fail visibly. That's the loop." },
      { type: "callout", text: "A receipt is issued in ALL THREE cases (PASS / FAIL / CAN'T DECIDE). The number goes up regardless. The first failing rule is on the receipt.", tone: "warn" },
      { type: "h2", text: "The test" },
      { type: "p", text: "Can a stranger, using only what's public, do the six things? Record format is published. Rules are written down. Hash + signature are on the receipt. The number is one line. The receipt says which rule failed first. The failure is loud." },
    ],
  },
  doctrine: {
    blocks: [
      { type: "kicker", text: "the loop / doctrine.md" },
      { type: "h1", text: "Computed gates · stubbed flagged · strong = suspicious" },
      { type: "lede", text: "A gate that looks computed but isn't is worse than an honestly stubbed one — because you would act on it." },
      { type: "p", text: "Eleven gates are computed by a known logic path. Two are honestly stubbed and flagged. The system flags its own stubs." },
      { type: "callout", text: "Stubbed gates (L7, L13) never block. They are honestly flagged CANNOT_COMPUTE. A 'strong' result from a stubbed gate is suspicious — the doctrine refuses to fake it.", tone: "warn" },
    ],
  },
  lesson0: {
    blocks: [
      { type: "kicker", text: "lessons / lesson0.md" },
      { type: "h1", text: "Mathematics is a language" },
      { type: "lede", text: "A number is a place. Three steps east of centre, four steps north. The address is the place." },
      { type: "p", text: "Drag the white point to (3, 4) in lab0_plane.py. The grammar of the plane: a move along one axis never disturbs the other. That independence is the grammar." },
    ],
  },
  lesson1: {
    blocks: [
      { type: "kicker", text: "lessons / lesson1.md" },
      { type: "h1", text: "Evidence independence" },
      { type: "lede", text: "A draw without a seed is T4 hearsay. The same draw with a seed becomes T1 computed." },
      { type: "p", text: "Reproducibility is the line between computed and claimed. A seed turns a lottery into a proof." },
    ],
  },
  lesson2: {
    blocks: [
      { type: "kicker", text: "lessons / lesson2.md" },
      { type: "h1", text: "ERC-5192 / Soulbound Tokens" },
      { type: "lede", text: "Bound to the soul, not to the wallet. Transfers impossible by design." },
      { type: "p", text: "A credential that cannot be sold cannot be sold. The contract enforces what the policy declares." },
    ],
  },
  lesson3: {
    blocks: [
      { type: "kicker", text: "lessons / lesson3.md" },
      { type: "h1", text: "Day-one depot protocol" },
      { type: "lede", text: "One visit, one instrument, three questions, one recording line." },
      { type: "p", text: "The depot gate opens IFF cost > R20,000, tier ∈ {T1, T2}, structural visibility, and a read-only capability tap. All four. The gate did not open? Walk away." },
    ],
  },
};

// Re-export ViewKey for DocView's convenience.
export type { ViewKey };
