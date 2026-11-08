// VVU Studio lib — types module
// The studio is a browser-only workspace; this lib runs client-side.

/** All view (tab) identifiers the studio editor can render. Matches the
 *  `case` clauses in src/components/vvu-studio/Editor.tsx and the keys of
 *  TAB_META in ./fs.ts. */
export type ViewKey =
  | "loop"
  | "rules"
  | "receipts"
  | "items"
  | "commit"
  | "verify"
  | "board"
  | "tree"
  | "stats"
  | "stakeholder"
  | "readme"
  | "doctrine"
  | "gates"
  | "config"
  | "lab0"
  | "lab1"
  | "lab2"
  | "ive"
  | "hash"
  | "depot"
  | "ledger"
  | "lesson0"
  | "lesson1"
  | "lesson2"
  | "lesson3";

/** A gate's status — the studio renders badges for each value. */
export type GateStatus = "PASS" | "FAIL" | "STUB" | "CANNOT_COMPUTE";

/** A mobile drawer name — used by MobileShell's NAV array and the store's
 *  `drawer` state. `null` means no drawer (editor visible). */
export type DrawerName = "explorer" | "agent" | "terminal" | "watch";

/** The 11 canonical fields of the IVE payload — IveView renders them as
 *  a grid. Order matters; the order below matches the reference UI. */
export const CANON_FIELDS: readonly string[] = [
  "submission_id",
  "subject_id",
  "author_id",
  "session_id",
  "evidence_hash",
  "observed_at",
  "submitted_at",
  "tier",
  "confidence",
  "bounds",
  "channel",
] as const;
