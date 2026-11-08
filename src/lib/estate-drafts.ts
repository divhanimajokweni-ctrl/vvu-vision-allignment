// src/lib/estate-drafts.ts — THE SURVIVING TEMPLATE (R194).
//
// The estate's two cold-route forms (the fieldkit capture template, the
// support contribution form) held their words in ephemeral useState — a
// storm bounce, a zombie-shell reload, an accidental refresh ERASED an
// interview. One engine now stands behind both forms: a draft key, a field
// list, and honesty about every absence.
//
// The laws:
//   · a missing store, a missing key, an unreadable draft, a wrong-shaped
//     draft — ALL read as "no draft" (never throw, never invent, never
//     half-restore: a draft missing one of its own fields is a BROKEN
//     draft, and the form renders empty rather than patched);
//   · a SecurityError (the bounced-load signature) reads as no draft —
//     on read, on write, on clear: the storm never takes the page down
//     with it;
//   · restored values ride VERBATIM (no trim, no casing, no defaults
//     merged in) — a draft is the user's own words, byte for byte;
//   · extra keys in a stored draft are dropped (restore only the known
//     fields — an old draft's leftovers never leak into a new shape);
//   · the reader NEVER writes (purity: a read leaves the store exactly
//     as it found it);
//   · the word count is mechanical and honest: whitespace-split tokens
//     across the known fields, empty fields contribute nothing.
//
// R195 · THE OUTREACH THAT REMEMBERS — the same storm erased the outreach
// surface's authorship: a cadence half-built in the sequence builder, a
// target half-typed in the add-contact dialog, a CSV half-pasted into the
// import dialog — all held in ephemeral useState, all gone on a bounce.
// The flat engine below serves the two flat dialogs (contact, csv) as-is;
// the sequence builder's shape is nested (a name + a LIST of steps), so it
// gets its own pair of readers/writers with the SAME laws:
//   · every absence reads as no draft (missing store/key, unparseable JSON,
//     non-object, array, a non-string name, a non-array step list, a step
//     that is not an object, a step missing one of its own three fields,
//     a non-string day — ALL null, never throw, never half-restore);
//   · the builder's law is SEVEN steps — a stored draft with more reads as
//     broken (an old shape's ghost never mounts);
//   · an EMPTY step list is a valid draft (removing every step IS
//     authorship — the form renders empty and the ADD STEP button waits);
//   · restored values ride VERBATIM (no trim, no defaults merged in);
//   · extra keys are dropped — only the name and the steps ride;
//   · the reader NEVER writes; a SecurityError reads as no draft on read,
//     and is swallowed on write and clear;
//   · the word count is prose-honest: the name and every step's subject
//     and angle count; the DAYS do not — a cadence day is a number, not
//     prose, and counting "1" as a word would flatter the count.

/** The storage-like surface the engine needs (localStorage satisfies it;
 *  tests pass fakes — including ones that throw, the SecurityError twin). */
export type DraftStoreLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

/** The estate's draft keys — one per surface, namespaced like the
 *  devseed family before them. R195 adds the outreach trio; R196 adds the
 *  watchdog pair. ONE LEDGER PER AUTHORSHIP: the outreach contact and csv
 *  keys are SHARED by the #/outreach dialogs and the analytics panel's
 *  twins (type on either surface, restore on both — the estate remembers,
 *  not the page). The watchdog pair drafts the dispatch URL and the pin
 *  note; the HMAC SECRET is DELIBERATELY keyed nowhere — a credential
 *  never sleeps on disk (see WatchdogTab's field law). */
export const FIELDKIT_CAPTURE_DRAFT_KEY = 'vvu.fieldkit.capture-draft';
export const SUPPORT_CONTRIBUTE_DRAFT_KEY = 'vvu.support.contribute-draft';
export const SEQUENCE_DRAFT_KEY = 'vvu.outreach.sequence-draft';
export const CONTACT_DRAFT_KEY = 'vvu.outreach.contact-draft';
export const CSV_DRAFT_KEY = 'vvu.outreach.csv-draft';
export const DISPATCH_URL_DRAFT_KEY = 'vvu.watchdog.dispatch-url-draft';
export const PIN_NOTE_DRAFT_KEY = 'vvu.watchdog.pin-note-draft';

/** The builder's law: a cadence is at most SEVEN steps. A stored draft
 *  beyond the cap is an old shape's ghost — read as no draft. */
export const SEQUENCE_DRAFT_STEP_CAP = 7;

/** One cadence step as the builder holds it — the day is a STRING (the
 *  form's own state shape; the server gets a Number at the edge). */
export type SequenceDraftStep = { day: string; subject: string; angle: string };

/** The sequence builder's draft — the name and the whole step list. */
export type SequenceDraft = { name: string; steps: SequenceDraftStep[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readStep = (value: unknown): SequenceDraftStep | null => {
  if (!isRecord(value)) return null;
  const day = value.day;
  const subject = value.subject;
  const angle = value.angle;
  if (typeof day !== 'string' || typeof subject !== 'string' || typeof angle !== 'string') {
    return null;
  }
  return { day, subject, angle };
};

/** Read a stored sequence draft. Returns the name and the steps verbatim —
 *  or null when ANYTHING is wrong with what the store holds. Never writes. */
export function readSequenceDraft(
  store: DraftStoreLike | null | undefined,
  key: string,
): SequenceDraft | null {
  if (!store) return null;
  let raw: string | null;
  try {
    raw = store.getItem(key);
  } catch {
    return null;
  }
  if (raw == null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  const name = parsed.name;
  const steps = parsed.steps;
  if (typeof name !== 'string') return null;
  if (!Array.isArray(steps)) return null;
  if (steps.length > SEQUENCE_DRAFT_STEP_CAP) return null;
  const read: SequenceDraftStep[] = [];
  for (const value of steps) {
    const step = readStep(value);
    if (step === null) return null;
    read.push(step);
  }
  return { name, steps: read };
}

/** Write a sequence draft. Swallows the SecurityError (and quota errors) —
 *  a refused write is a cadence the dialog simply keeps in memory. */
export function writeSequenceDraft(
  store: DraftStoreLike | null | undefined,
  key: string,
  draft: SequenceDraft,
): void {
  if (!store) return;
  try {
    store.setItem(key, JSON.stringify(draft));
  } catch {
    // the store refused — the words still live in the dialog's own state
  }
}

/** Clear a sequence draft. Swallows the SecurityError like its siblings. */
export function clearSequenceDraft(
  store: DraftStoreLike | null | undefined,
  key: string,
): void {
  if (!store) return;
  try {
    store.removeItem(key);
  } catch {
    // the store refused — nothing to clear is a fine answer
  }
}

/** The restored cadence's PROSE count: whitespace-split tokens across the
 *  name and every step's subject and angle. The days do not count — a
 *  cadence day is a number, not prose. Empty strings contribute nothing;
 *  the count of an empty draft is 0 — the strip says so rather than hiding. */
export function countSequenceDraftWords(draft: SequenceDraft): number {
  let total = 0;
  const prose: string[] = [draft.name];
  for (const step of draft.steps) {
    prose.push(step.subject, step.angle);
  }
  for (const value of prose) {
    const trimmed = value.trim();
    if (trimmed.length === 0) continue;
    total += trimmed.split(/\s+/).length;
  }
  return total;
}

/** Read a stored draft. Returns the known fields verbatim — or null when
 *  ANYTHING is wrong with what the store holds. Never writes. */
export function readEstateDraft(
  store: DraftStoreLike | null | undefined,
  key: string,
  fields: readonly string[],
): Record<string, string> | null {
  if (!store || fields.length === 0) return null;
  let raw: string | null;
  try {
    raw = store.getItem(key);
  } catch {
    return null;
  }
  if (raw == null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  const record = parsed as Record<string, unknown>;
  const restored: Record<string, string> = {};
  for (const field of fields) {
    const value = record[field];
    if (typeof value !== 'string') return null;
    restored[field] = value;
  }
  return restored;
}

/** Write a draft. Swallows the SecurityError (and quota errors) — a
 *  refused write is a draft the form simply keeps in memory. */
export function writeEstateDraft(
  store: DraftStoreLike | null | undefined,
  key: string,
  form: Record<string, string>,
): void {
  if (!store) return;
  try {
    store.setItem(key, JSON.stringify(form));
  } catch {
    // the store refused — the words still live in the form's own state
  }
}

/** Clear a draft. Swallows the SecurityError like its siblings. */
export function clearEstateDraft(
  store: DraftStoreLike | null | undefined,
  key: string,
): void {
  if (!store) return;
  try {
    store.removeItem(key);
  } catch {
    // the store refused — nothing to clear is a fine answer
  }
}

/** The restored strip's honest count: whitespace-split tokens across the
 *  known fields. Empty strings contribute nothing; the count of an empty
 *  draft is 0 — the strip says so rather than hiding. */
export function countDraftWords(form: Record<string, string>): number {
  let total = 0;
  for (const value of Object.values(form)) {
    const trimmed = value.trim();
    if (trimmed.length === 0) continue;
    total += trimmed.split(/\s+/).length;
  }
  return total;
}
