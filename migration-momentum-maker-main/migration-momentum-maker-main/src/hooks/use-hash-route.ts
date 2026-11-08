"use client";

// src/hooks/use-hash-route.ts — view routing inside the single `/` route.
//
// Task 47 — THE KEYBOARD SPEC'S TEN FIXED SURFACES + the estate's full
// projection set, one router. Spec-named routes are real routes (the
// keyboard layer navigates to them verbatim); where a spec name covers an
// estate view that already had a hash, BOTH hashes resolve to the same
// view and the estate's canonical hash is what setView writes:
//
//   #/ive      → spatial   (IVE · the primary instrument view)   alias of #/
//   #/evidence → bridge    (the vault-bridge evidence chain)     alias of #/bridge
//   #/terminal → terminal
//   #/mission  → analytics (mission control · gates · WORM)      alias of #/analytics
//   #/twin     → twin      (the spatial twin artifact)
//   #/watchdog → watchdog
//   #/receipts → receipts
//   #/pools    → pools     (Ubuntu Pools)
//   #/bridges  → field     (device pairing rails)                alias of #/field
//   #/settings → settings
//
// Plus the estate's own projections: outreach · holocom · capability ·
// metro · urllc · fieldkit · support · commercial · manifest · wildfire ·
// mesh · docs · ops · sphere (trust sphere) · safegrid (the evidence
// relay console). Task 48 recovers three more
// lost-lineage projections: fleet · broadcast · trust (VVU-TRUST community
// compute pool). Task 49 promotes the ICSH 4TH STATE (contract on chain,
// the ledger as storage) to the DEFAULT front door — #/ and #/icsh — while
// spatial keeps its spec alias #/ive as canonical.
//
// Uses useSyncExternalStore to subscribe to location.hash (external
// state). Works with browser back/forward and survives refresh.

import { useCallback, useSyncExternalStore } from "react";

export type VvuView =
  | "icsh"
  | "spatial"
  | "analytics"
  | "outreach"
  | "holocom"
  | "capability"
  | "metro"
  | "urllc"
  | "fieldkit"
  | "support"
  | "commercial"
  | "manifest"
  | "twin"
  | "wildfire"
  | "mesh"
  | "bridge"
  | "terminal"
  | "field"
  | "watchdog"
  | "receipts"
  | "settings"
  | "pools"
  | "docs"
  | "ops"
  | "sphere"
  | "fleet"
  | "broadcast"
  | "trust"
  | "governance"
  | "firstprinciples"
  | "safegrid"
  | "records"
  | "iveverify"
  | "studio"
  | "fluid";

/** hash (WITHOUT leading '#') → view. Canonical + spec aliases together. */
const HASH_TO_VIEW: Readonly<Record<string, VvuView>> = {
  "": "spatial",
  "/": "spatial",
  "/icsh": "icsh",
  "/ive": "spatial",
  "/analytics": "analytics",
  "/mission": "analytics",
  "/outreach": "outreach",
  "/holocom": "holocom",
  "/capability": "capability",
  "/metro": "metro",
  "/urllc": "urllc",
  "/fieldkit": "fieldkit",
  "/support": "support",
  "/commercial": "commercial",
  "/manifest": "manifest",
  "/twin": "twin",
  "/wildfire": "wildfire",
  "/mesh": "mesh",
  "/bridge": "bridge",
  "/evidence": "bridge",
  "/terminal": "terminal",
  "/field": "field",
  "/bridges": "field",
  "/watchdog": "watchdog",
  "/receipts": "receipts",
  "/settings": "settings",
  "/pools": "pools",
  "/docs": "docs",
  "/ops": "ops",
  "/sphere": "sphere",
  "/fleet": "fleet",
  "/broadcast": "broadcast",
  "/trust": "trust",
  "/governance": "governance",
  "/firstprinciples": "firstprinciples",
  "/fp": "firstprinciples",
  "/safegrid": "safegrid",
  "/records": "records",
  "/ive-verify": "iveverify",
  "/studio": "studio",
  "/fluid": "fluid",
  "/proximity": "records",
};

/** view → the CANONICAL hash this estate writes (spec aliases never
 *  overwrite an established canonical route). */
const VIEW_TO_HASH: Readonly<Record<VvuView, string>> = {
  icsh: "#/",
  spatial: "#/ive",
  analytics: "#/analytics",
  outreach: "#/outreach",
  holocom: "#/holocom",
  capability: "#/capability",
  metro: "#/metro",
  urllc: "#/urllc",
  fieldkit: "#/fieldkit",
  support: "#/support",
  commercial: "#/commercial",
  manifest: "#/manifest",
  twin: "#/twin",
  wildfire: "#/wildfire",
  mesh: "#/mesh",
  bridge: "#/bridge",
  terminal: "#/terminal",
  field: "#/field",
  watchdog: "#/watchdog",
  receipts: "#/receipts",
  settings: "#/settings",
  pools: "#/pools",
  docs: "#/docs",
  ops: "#/ops",
  sphere: "#/sphere",
  fleet: "#/fleet",
  broadcast: "#/broadcast",
  trust: "#/trust",
  governance: "#/governance",
  firstprinciples: "#/firstprinciples",
  safegrid: "#/safegrid",
  records: "#/records",
  iveverify: "#/ive-verify",
  studio: "#/studio",
  fluid: "#/fluid",
};

function subscribe(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

function getSnapshot(): string {
  return window.location.hash;
}

function getServerSnapshot(): string {
  return "";
}

// ── R73 — hash-query support ────────────────────────────────────────────────
// A view's hash can now carry its own query segment, parsed like a real
// query string and laid out AFTER the path:
//
//   #/watchdog?cf=drill&q=over%20guard
//
// (The ?gate=... convention lives BEFORE the hash — a real search param —
// and is untouched by all of this.) The query is a SHAREABLE PROJECTION of
// in-surface state (e.g. the estate chronicle's class filter + search):
// deep-linking a filtered chronicle makes the demo walk hand a URL to the
// pilot conversation instead of a click-path.
//
// Discipline:
//   - reads are pure parses of location.hash; unknown keys are ignored by
//     the consumer, never by the parser (the parser stays generic).
//   - writes go through history.replaceState — SILENT by design: no
//     hashchange event (no re-render loop with the state that mirrors it)
//     and no history entries (a keystroke in a search box must never spam
//     the back button).

/** Split the current hash into its view path and query params. */
export function readHashParts(): { path: string; query: URLSearchParams } {
  const raw = window.location.hash.replace(/^#/, "");
  const qIndex = raw.indexOf("?");
  const path = qIndex === -1 ? raw : raw.slice(0, qIndex);
  const query = new URLSearchParams(qIndex === -1 ? "" : raw.slice(qIndex + 1));
  return { path, query };
}

export type HashQueryUpdates = Record<string, string | null>;

/** Silently mirror query params onto the CURRENT hash. `null` deletes a
 *  key; an empty query collapses back to the bare path. Never navigates,
 *  never fires hashchange, never creates a history entry. */
export function writeHashQuery(updates: HashQueryUpdates): void {
  if (typeof window === "undefined") return;
  const raw = window.location.hash.replace(/^#/, "");
  const qIndex = raw.indexOf("?");
  const path = qIndex === -1 ? raw : raw.slice(0, qIndex);
  const query = new URLSearchParams(qIndex === -1 ? "" : raw.slice(qIndex + 1));
  for (const [k, v] of Object.entries(updates)) {
    if (v == null) query.delete(k);
    else query.set(k, v);
  }
  const qs = query.toString();
  const next = qs ? `${path}?${qs}` : path;
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}#${next}`,
  );
}

export function useHashRoute(): [VvuView, (v: VvuView) => void] {
  const hash = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // R73 — the view resolves from the path segment only; a query segment
  // rides along without changing which surface this is.
  const qIndex = hash.indexOf("?");
  const path = (qIndex === -1 ? hash : hash.slice(0, qIndex)).replace(/^#/, "");
  const view: VvuView = HASH_TO_VIEW[path] ?? "spatial";

  const setView = useCallback((v: VvuView) => {
    const target = VIEW_TO_HASH[v];
    if (window.location.hash !== target) {
      window.location.hash = target; // fires hashchange → store updates
    }
  }, []);

  return [view, setView];
}

// R73 — the hash QUERY as an external store of its own. Returns '' on the
// server and during the hydration render (the sanctioned getServerSnapshot
// dance), then the live query segment once the client sees the real hash —
// which is exactly how a deep link applies itself without any
// setState-in-effect. Note the silent mirror (writeHashQuery) does NOT fire
// hashchange, so this store only moves on REAL navigations — a component
// may therefore treat the hash as the initial reading and its own local
// state as the running truth.
function getQuerySnapshot(): string {
  const h = window.location.hash;
  const i = h.indexOf("?");
  return i === -1 ? "" : h.slice(i + 1);
}

export function useHashQuery(): string {
  return useSyncExternalStore(subscribe, getQuerySnapshot, () => "");
}
