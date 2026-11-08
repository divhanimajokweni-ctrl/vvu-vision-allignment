// src/lib/fieldkit.ts — Round 29 · FIELD KIT: CAMPUS WALK (pure module).
//
// The five-part field kit for lecturer conversations, exactly as specified in
// the operator's fieldkit source (DOCUMENTATION.md § 6 — compiled from
// download/fieldkit-source.md):
//   1. The Leave-Behind  — one paragraph, shown not explained.
//   2. The Four Trust Bottlenecks — taxonomy table.
//   3. The Three Questions — ask in order; write down every word of Q3.
//   4. The Capture Template — the "people notes" (persisted via the API).
//   5. The Faculty Map — likely dominant bottleneck per faculty.
//
// Zero fabrication: this module contains ONLY the kit's own content and pure
// helpers. Captures live in the database and start empty.

import type {
  BottleneckRow,
  FacultyMapRow,
  TrustBottleneck,
  WouldUseAnswer,
} from '@/types/vvu';

// ─── 1 · The Leave-Behind ────────────────────────────────────────────────────

export const LEAVE_BEHIND = `ProofBridge is a provenance-and-audit layer.

It records what happened in a system — a payment, a reading, a decision — as a cryptographic chain that any third party can verify without trusting the operator.

It does not detect lies. It makes it impossible to change the record after the fact. The bottleneck it removes is: "we can't prove what happened cheaply, portably, and across institutions that don't trust each other."

Show this. Don't explain it. Let them read it.`;

// ─── 2 · The Four Trust Bottlenecks ──────────────────────────────────────────

export const BOTTLENECKS: readonly BottleneckRow[] = [
  {
    key: 'PROVENANCE',
    plainMeaning: 'Where did this come from, and has it changed?',
    proofbridgeHelp: 'Yes — core strength.',
    verdict: 'YES',
  },
  {
    key: 'EVIDENCE_CAPTURE',
    plainMeaning: 'Was the ground truth recorded honestly?',
    proofbridgeHelp: 'Partially — catches tampering after the fact, can\u2019t stop a lying sensor.',
    verdict: 'PARTIALLY',
  },
  {
    key: 'INSTITUTIONAL_TRUST',
    plainMeaning: 'Do we trust who runs the system?',
    proofbridgeHelp: 'No — that\u2019s a governance problem, not a math problem.',
    verdict: 'NO',
  },
  {
    key: 'COST_OF_VERIFICATION',
    plainMeaning: 'The check costs more than trusting.',
    proofbridgeHelp: 'Yes — one hash verify, microseconds.',
    verdict: 'YES',
  },
];

export const BOTTLENECK_LABELS: Record<TrustBottleneck, string> = {
  PROVENANCE: 'Provenance',
  EVIDENCE_CAPTURE: 'Evidence capture',
  INSTITUTIONAL_TRUST: 'Institutional trust',
  COST_OF_VERIFICATION: 'Cost of verification',
};

// ─── 3 · The Three Questions ─────────────────────────────────────────────────

export interface KitQuestion {
  id: 'Q1' | 'Q2' | 'Q3';
  text: string;
  note: string;
}

export const THREE_QUESTIONS: readonly KitQuestion[] = [
  {
    id: 'Q1',
    text: 'In your field, what\u2019s the single biggest thing people cannot verify that they wish they could?',
    note: 'Opens the map. Listen for the bottleneck language.',
  },
  {
    id: 'Q2',
    text: 'When something goes wrong — a bad decision, a falsified record, a failure — how is it caught today, and who pays for that check?',
    note: 'Surfaces the cost of verification as lived experience.',
  },
  {
    id: 'Q3',
    text: 'If you had a system that made every step of that record tamper-evident and cheap to check — what would it have to prove to you, personally, before you\u2019d trust it?',
    note: 'Ask in this order. Write down every word of the Q3 answer.',
  },
];

// ─── 5 · The Faculty Map ─────────────────────────────────────────────────────

export const FACULTY_MAP: readonly FacultyMapRow[] = [
  { faculty: 'Law', bottleneck: 'INSTITUTIONAL_TRUST', likelySay: 'Chain of custody, evidence admissibility, "who signs the first link"' },
  { faculty: 'Medicine / Health Sciences', bottleneck: 'EVIDENCE_CAPTURE', likelySay: 'Clinical trials, adverse events, "the sensor may lie"' },
  { faculty: 'Engineering', bottleneck: 'PROVENANCE', likelySay: 'Supply chains, component traceability, sensor calibration' },
  { faculty: 'Business / Commerce', bottleneck: 'COST_OF_VERIFICATION', likelySay: 'Audit fees, reconciliation overhead, "we already pay for this"' },
  { faculty: 'Humanities / Social Sciences', bottleneck: 'INSTITUTIONAL_TRUST', likelySay: 'Archival authenticity, contested narratives, "whose record is this?"' },
  { faculty: 'Computer Science', bottleneck: 'PROVENANCE', likelySay: 'Distributed systems, trust assumptions, "why not X?"' },
  { faculty: 'Journalism / Media', bottleneck: 'INSTITUTIONAL_TRUST', likelySay: 'Source verification, "we can prove it wasn\u2019t edited, not that it\u2019s true"' },
  { faculty: 'Library / Information Science', bottleneck: 'PROVENANCE', likelySay: 'Archival integrity, chain of custody over long timespans' },
  { faculty: 'Environmental Science', bottleneck: 'EVIDENCE_CAPTURE', likelySay: 'Sensor networks, water quality, calibration drift' },
  { faculty: 'Public Policy / Governance', bottleneck: 'INSTITUTIONAL_TRUST', likelySay: 'Procurement, audit trails, "the check has to be affordable"' },
];

// ─── validation vocabularies (server + client share this module) ────────────

export const TRUST_BOTTLENECKS: readonly TrustBottleneck[] = [
  'PROVENANCE',
  'EVIDENCE_CAPTURE',
  'INSTITUTIONAL_TRUST',
  'COST_OF_VERIFICATION',
];

export const WOULD_USE_ANSWERS: readonly WouldUseAnswer[] = ['YES', 'NO', 'MAYBE'];

export const FACULTY_OPTIONS: readonly string[] = Array.from(
  new Set(FACULTY_MAP.map((f) => f.faculty)),
).sort();

/** Bottleneck colour tone for chips/bars (lime = helps, amber = partial, red = no). */
export function bottleneckVerdict(key: TrustBottleneck): 'YES' | 'PARTIALLY' | 'NO' {
  return BOTTLENECKS.find((b) => b.key === key)?.verdict ?? 'NO';
}

/** Would-use tone: YES lime, MAYBE amber, NO crimson (matches Chip Tone). */
export function wouldUseTone(answer: WouldUseAnswer): 'lime' | 'amber' | 'crimson' {
  return answer === 'YES' ? 'lime' : answer === 'MAYBE' ? 'amber' : 'crimson';
}

// ─── "On the Horse Itself" / "Before You Walk" (kit closing counsel) ─────────

export const ON_THE_HORSE = `You are carrying one paragraph (the leave-behind), one map (the taxonomy), and three questions.

The fraud harness, substrate, audit chain, dashboard, and R490 node are what you say if asked. They are not what you lead with.

The single most valuable thing to come back with is a stack of filled-in Q3 answers — the trust conditions lecturers name. Those are the design constraints for whatever ProofBridge becomes next.`;

export const BEFORE_YOU_WALK = `Open your phone's camera. Photograph the faculty directory board if there is one. When you get back, you'll know exactly which faculties you hit and which you missed.`;
