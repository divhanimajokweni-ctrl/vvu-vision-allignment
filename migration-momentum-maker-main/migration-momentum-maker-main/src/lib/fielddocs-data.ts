// src/lib/fielddocs-data.ts — Task 46 · THE DOCUMENTS (#/docs).
//
// The field document registry: what the system supplies to the operator in
// the field, plus the compact TEXT forms used as QR payloads. The operator's
// directive (field message, Task 46): documents must reach the hand that
// sells — every document readable on a phone, QR-accessible, printable.
//
// Honesty rules that govern everything built from this file:
//   * QRs never invent a URL. The master QR encodes window.location.origin
//     (whatever address actually serves this build) + '#/docs'. When that
//     address is local or unreachable from a phone, the per-document TEXT
//     QRs carry the content itself — they work with no server at all.
//   * Text QRs are capped (DOCS_QR_CAP) — a longer document gets an honest
//     "too long for a QR" state and the COPY button, never silent
//     truncation.
//   * The compliance pack is DRAFT — REVIEW REQUIRED until the lawyer signs
//     off (manifest L7). The QR/copy/print of a draft carries that state.
//
// ZERO runtime dependencies beyond the existing ledgers (ops-data,
// commercial-data). Hand-typed, one maintainer.

import {
  COMPLIANCE_PACK,
  CONSENT_RECORD_FIELDS,
  CONSENT_RULE,
  CONSENT_STATUS,
  PAYMENT_DISCIPLINE,
  PITCHES,
  PITCH_RULE,
  PRICE_CARD,
  PRICE_CARD_CAVEAT,
} from './ops-data';
import type { Pitch } from './ops-data';
import { EMAIL_DRAFTS } from './commercial-data';

// ── QR payload cap (mirrors /api/docs/qr — 413 below this line) ──────────────

export const DOCS_QR_CAP = 1000;

// ── compact document texts (QR payloads · clipboard · print sheets) ──────────

/** A pitch as a self-contained text artifact: audience + the three
 *  sentences + the rule. Identical bytes to what COPY PITCH puts on the
 *  clipboard — one source, no divergence. */
export function pitchDocText(pitch: Pitch): string {
  return `${pitch.audience.toUpperCase()} — PITCH (3 SENTENCES)\n\n${pitch.text}\n\n${PITCH_RULE}`;
}

/** The price card as compact text — every row verbatim (id · offering ·
 *  price), plus the caveat so the artifact can never travel without its
 *  honesty label. */
export function priceCardDocText(): string {
  const rows = PRICE_CARD.map((r) => `${r.id} ${r.offering} — ${r.entryPrice}`).join('\n');
  return `PROOFBRIDGE PRICE CARD v2\n(${PRICE_CARD_CAVEAT})\n\n${rows}`;
}

/** The six payment rules, numbered. */
export function paymentDocText(): string {
  return `PAYMENT DISCIPLINE\n\n${PAYMENT_DISCIPLINE.map((r, i) => `${i + 1}. ${r}`).join('\n')}`;
}

/** The consent rule + every record field — the no-money-without-consent
 *  artifact in text form. */
export function consentDocText(): string {
  return `CONSENT — THE RULE\n\n${CONSENT_RULE}\n\nCONSENT RECORD FIELDS:\n${CONSENT_RECORD_FIELDS.map(
    (f, i) => `${i + 1}. ${f}`,
  ).join('\n')}`;
}

// ── QR honesty labels (rendered on the view, never implied) ──────────────────

export const QR_HONESTY = {
  masterUrl:
    'This QR encodes the address this build is actually served from, plus #/docs. Nothing was invented. If the scanning phone cannot open that address (preview addresses can be session-bound), use any document\u2019s text QR instead — it carries the content itself and needs no server.',
  textMode:
    'No public URL is claimed. This QR carries the document text itself — scanning it shows the content on any phone, with no server and no invented address.',
  local:
    'The detected serving address is local — it opens only on machines that can reach this host. The per-document text QRs below work everywhere regardless.',
  capNote: `Text QRs are capped at ${DOCS_QR_CAP} characters — longer documents honestly report TOO LONG FOR A QR and offer the COPY button instead of being silently truncated.`,
} as const;

// ── derived totals (the ledger wins — nothing hand-claimed) ──────────────────

export interface FieldDocsTotals {
  /** pitches + price card + payment + consent (built from the ledgers). */
  builtInDocs: number;
  /** 4 compliance pack files + the offer document (server allowlist). */
  complianceFiles: number;
  totalDocs: number;
  priceRows: number;
  paymentRules: number;
  consentFields: number;
  emailDrafts: number;
  qrCap: number;
}

export function fielddocsTotals(): FieldDocsTotals {
  const builtInDocs = PITCHES.length + 3; // + price card, payment discipline, consent
  const complianceFiles = COMPLIANCE_PACK.length + 1; // + blockchain-detection-offer.md (manifest J1)
  return {
    builtInDocs,
    complianceFiles,
    totalDocs: builtInDocs + complianceFiles,
    priceRows: PRICE_CARD.length,
    paymentRules: PAYMENT_DISCIPLINE.length,
    consentFields: CONSENT_RECORD_FIELDS.length,
    emailDrafts: EMAIL_DRAFTS.length,
    qrCap: DOCS_QR_CAP,
  };
}

// ── ledger cross-reference for the served compliance docs ────────────────────

/** Purpose line from COMPLIANCE_PACK for a served doc id, if one exists. */
export function compliancePurposeFor(id: string): string | null {
  const found = COMPLIANCE_PACK.find((d) => d.id === id);
  return found ? found.purpose : null;
}
