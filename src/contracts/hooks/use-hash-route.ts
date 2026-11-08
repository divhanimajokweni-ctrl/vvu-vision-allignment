'use client';

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

import { useCallback, useSyncExternalStore } from 'react';

export type VvuView =
  | 'icsh'
  | 'spatial'
  | 'analytics'
  | 'outreach'
  | 'holocom'
  | 'capability'
  | 'metro'
  | 'urllc'
  | 'fieldkit'
  | 'support'
  | 'commercial'
  | 'manifest'
  | 'twin'
  | 'wildfire'
  | 'mesh'
  | 'bridge'
  | 'terminal'
  | 'field'
  | 'watchdog'
  | 'receipts'
  | 'settings'
  | 'pools'
  | 'docs'
  | 'ops'
  | 'sphere'
  | 'fleet'
  | 'broadcast'
  | 'trust'
  | 'governance'
  | 'firstprinciples'
  | 'safegrid'
  | 'skylantern';

/** hash (WITHOUT leading '#') → view. Canonical + spec aliases together. */
const HASH_TO_VIEW: Readonly<Record<string, VvuView>> = {
  '': 'icsh',
  '/': 'icsh',
  '/icsh': 'icsh',
  '/ive': 'spatial',
  '/analytics': 'analytics',
  '/mission': 'analytics',
  '/outreach': 'outreach',
  '/holocom': 'holocom',
  '/capability': 'capability',
  '/metro': 'metro',
  '/urllc': 'urllc',
  '/fieldkit': 'fieldkit',
  '/support': 'support',
  '/commercial': 'commercial',
  '/manifest': 'manifest',
  '/twin': 'twin',
  '/wildfire': 'wildfire',
  '/mesh': 'mesh',
  '/bridge': 'bridge',
  '/evidence': 'bridge',
  '/terminal': 'terminal',
  '/field': 'field',
  '/bridges': 'field',
  '/watchdog': 'watchdog',
  '/receipts': 'receipts',
  '/settings': 'settings',
  '/pools': 'pools',
  '/docs': 'docs',
  '/ops': 'ops',
  '/sphere': 'sphere',
  '/fleet': 'fleet',
  '/broadcast': 'broadcast',
  '/trust': 'trust',
  '/governance': 'governance',
  '/firstprinciples': 'firstprinciples',
  '/fp': 'firstprinciples',
  '/safegrid': 'safegrid',
  '/skylantern': 'skylantern',
  '/lantern': 'skylantern',
};

/** view → the CANONICAL hash this estate writes (spec aliases never
 *  overwrite an established canonical route). */
const VIEW_TO_HASH: Readonly<Record<VvuView, string>> = {
  icsh: '#/',
  spatial: '#/ive',
  analytics: '#/analytics',
  outreach: '#/outreach',
  holocom: '#/holocom',
  capability: '#/capability',
  metro: '#/metro',
  urllc: '#/urllc',
  fieldkit: '#/fieldkit',
  support: '#/support',
  commercial: '#/commercial',
  manifest: '#/manifest',
  twin: '#/twin',
  wildfire: '#/wildfire',
  mesh: '#/mesh',
  bridge: '#/bridge',
  terminal: '#/terminal',
  field: '#/field',
  watchdog: '#/watchdog',
  receipts: '#/receipts',
  settings: '#/settings',
  pools: '#/pools',
  docs: '#/docs',
  ops: '#/ops',
  sphere: '#/sphere',
  fleet: '#/fleet',
  broadcast: '#/broadcast',
  trust: '#/trust',
  governance: '#/governance',
  firstprinciples: '#/firstprinciples',
  safegrid: '#/safegrid',
  skylantern: '#/skylantern',
};

const ROUTE_EVENT = 'vvu-route-change';

function subscribe(callback: () => void) {
  window.addEventListener('hashchange', callback);
  window.addEventListener(ROUTE_EVENT, callback);
  return () => {
    window.removeEventListener('hashchange', callback);
    window.removeEventListener(ROUTE_EVENT, callback);
  };
}

function getSnapshot(): string {
  return window.location.hash;
}

function getServerSnapshot(): string {
  return '';
}

export function useHashRoute(): [VvuView, (v: VvuView) => void] {
  const hash = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const raw = hash.replace(/^#/, '');
  const view: VvuView = HASH_TO_VIEW[raw] ?? 'spatial';

  const setView = useCallback((v: VvuView) => {
    const target = VIEW_TO_HASH[v];
    if (window.location.hash !== target) {
      // Assigning a fragment beginning with "/" can make the browser try to
      // resolve it as a CSS id selector ("#/watchdog"), which is invalid.
      // Push the hash without triggering fragment scrolling, then notify the
      // external store explicitly.
      window.history.pushState(null, '', target);
      window.dispatchEvent(new Event(ROUTE_EVENT));
    }
  }, []);

  return [view, setView];
}

// ── hash query helpers (used by WatchdogWorkspace + other surfaces) ──────
// Parse query params from the hash: #/watchdog?tab=memory&from=2026-01-01

export function readHashParts(): { view: string; query: Record<string, string> } {
  if (typeof window === 'undefined') return { view: '', query: {} };
  const raw = window.location.hash.replace(/^#/, '');
  const [path, queryString] = raw.split('?');
  const query: Record<string, string> = {};
  if (queryString) {
    new URLSearchParams(queryString).forEach((v, k) => { query[k] = v; });
  }
  return { view: path ?? '', query };
}

export function writeHashQuery(updates: Record<string, string | null>): void {
  if (typeof window === 'undefined') return;
  const { view, query } = readHashParts();
  for (const [k, v] of Object.entries(updates)) {
    if (v === null) delete query[k];
    else query[k] = v;
  }
  const qs = new URLSearchParams(query).toString();
  const target = qs ? `#${view}?${qs}` : `#${view}`;
  if (window.location.hash !== target) {
    window.history.replaceState(null, '', target);
    window.dispatchEvent(new Event('hashchange'));
  }
}

export function useHashQuery(): [Record<string, string>, (updates: Record<string, string | null>) => void] {
  const hash = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { query } = readHashParts();
  const update = useCallback((updates: Record<string, string | null>) => {
    writeHashQuery(updates);
  }, []);
  return [query, update];
}
