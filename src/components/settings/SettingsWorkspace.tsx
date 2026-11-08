'use client';

// src/components/settings/SettingsWorkspace.tsx — Task 47 · #/settings
// SETTINGS · LINDIWE MEMORY, PINS & PREFERENCES.
//
//   * LINDIWE (the tutor's memory, Ctrl+0's own page): the mastery table
//     over EVERY binding in keyboard-map.json (the single source of truth,
//     imported directly) — uses / mastered / last-used per shortcut — plus
//     the guarded RESET (Lindiwe teaches again from zero). Lindiwe has NO
//     kill-switch by design: mastery IS the silence (3 uses → silent
//     forever, 5 days unused → one quiet reminder). Nothing here is sent
//     anywhere.
//   * PINS: the pinnable-panel registry with live pin/unpin/hide controls
//     (the same state pinnable-panels.js owns — vvu.pins.v1).
//   * INTERFACE: honest client context (platform · live viewport · theme).
//   * STORAGE: the localStorage keys this app uses — read-only display.
//   * RAILS: read-only reference table of the API proxies.
//   * ABOUT: static honest labels — no invented versions.

import { useSyncExternalStore } from 'react';
import { Brain, Database, Info, Keyboard, Monitor, Pin, Server, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import keyboardMap from '../../../public/keyboard-map.json';

// ── the map (single source of truth — the same file the vanilla layer fetches) ──

type MapTab = { key: string; route: string; label: string; teach: string };
type MapAction = { key: string; action: string; teach: string; reserved?: string };
type MapChord = { from: string; to: string; route: string };
const MAP = keyboardMap as { version: number; tabs: MapTab[]; actions: MapAction[]; chords: MapChord[] };

interface LindiweEntry { uses: number; last_used: number; mastered: boolean }
interface LindiweState { version: number; shortcuts: Record<string, LindiweEntry>; last_active: number }
interface PinState { version: number; pinned: string[]; hidden: string[]; heights: Record<string, number> }
interface DockRegistry { id: string; label: string; note: string }

// ── helpers ─────────────────────────────────────────────────────────────────

function prettyKey(key: string): string {
  return key
    .split('+')
    .map((p) => {
      if (p === 'ctrl') return 'Ctrl';
      if (p === 'shift') return 'Shift';
      if (p === 'alt') return 'Alt';
      if (p.length === 1) return p.toUpperCase();
      return p.charAt(0).toUpperCase() + p.slice(1);
    })
    .join('+')
    .replace(/^G → /, 'G → ');
}

function chordKey(c: MapChord): string {
  return `g-${c.to}`;
}

function usedAgo(ts: number): string {
  if (!ts) return '—';
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// Client-only facts (this workspace is a dynamic ssr:false import).
const PLATFORM = typeof navigator !== 'undefined' ? navigator.platform || 'unknown' : '';

function subscribeResize(cb: () => void): () => void {
  window.addEventListener('resize', cb);
  return () => window.removeEventListener('resize', cb);
}
function viewportSnapshot(): string {
  return `${window.innerWidth}×${window.innerHeight}`;
}
function viewportServerSnapshot(): string {
  return '';
}

/* Lindiwe / pins are VANILLA modules (globals). The React side subscribes
   to their change events — one implementation, one source of truth.
   getSnapshot MUST return a cached, referentially-stable object between
   changes (useSyncExternalStore compares with Object.is — a fresh object
   every call is an infinite-render crash); the cache is invalidated ONLY
   by the module's own change event. */
function subscribeLindiwe(cb: () => void): () => void {
  window.addEventListener('vvu:lindiwe-changed', cb);
  return () => window.removeEventListener('vvu:lindiwe-changed', cb);
}
const EMPTY_LINDIWE: LindiweState = { version: 1, shortcuts: {}, last_active: 0 };
let lindiweCache: LindiweState = EMPTY_LINDIWE;
let lindiweDirty = true;
function lindiweSnapshot(): LindiweState {
  if (!lindiweDirty) return lindiweCache;
  const L = (window as unknown as { Lindiwe?: { snapshot: () => LindiweState } }).Lindiwe;
  lindiweCache = L ? L.snapshot() : EMPTY_LINDIWE;
  lindiweDirty = false;
  return lindiweCache;
}
function lindiweServerSnapshot(): LindiweState {
  return EMPTY_LINDIWE;
}
window.addEventListener('vvu:lindiwe-changed', () => {
  lindiweDirty = true;
});

function subscribePins(cb: () => void): () => void {
  window.addEventListener('vvu:pins-changed', cb);
  return () => window.removeEventListener('vvu:pins-changed', cb);
}
interface PinsView {
  state: PinState;
  registry: DockRegistry[];
}
const EMPTY_PINS: PinsView = { state: { version: 1, pinned: [], hidden: [], heights: {} }, registry: [] };
let pinsCache: PinsView = EMPTY_PINS;
let pinsDirty = true;
function pinsSnapshot(): PinsView {
  if (!pinsDirty) return pinsCache;
  const P = (window as unknown as {
    VvuPins?: { state: () => PinState; registry: DockRegistry[] };
  }).VvuPins;
  pinsCache = P
    ? { state: P.state(), registry: P.registry }
    : EMPTY_PINS;
  pinsDirty = false;
  return pinsCache;
}
function pinsServerSnapshot(): PinsView {
  return EMPTY_PINS;
}
window.addEventListener('vvu:pins-changed', () => {
  pinsDirty = true;
});

// ── component ───────────────────────────────────────────────────────────────

export function SettingsWorkspace() {
  const lindiwe = useSyncExternalStore(subscribeLindiwe, lindiweSnapshot, lindiweServerSnapshot);
  const pinsView = useSyncExternalStore(subscribePins, pinsSnapshot, pinsServerSnapshot);
  const viewport = useSyncExternalStore(subscribeResize, viewportSnapshot, viewportServerSnapshot);

  const entryCount = Object.values(lindiwe.shortcuts).filter((e) => e && e.uses > 0).length;
  const masteredCount = Object.values(lindiwe.shortcuts).filter((e) => e && e.mastered).length;
  const totalBindings = MAP.tabs.length + MAP.actions.length + MAP.chords.length;

  const pinsApi = (window as unknown as {
    VvuPins?: {
      pin: (id: string) => void;
      unpin: (id: string) => void;
      hide: (id: string) => void;
      revealLastHidden: () => void;
      reset: () => void;
    };
  }).VvuPins;

  return (
    <div className="absolute inset-0 overflow-y-auto vvu-grid-bg" role="region" aria-label="Settings — Lindiwe memory, pins and preferences">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 pb-28 pt-6 space-y-5">
        {/* ── title block ── */}
        <section className="vvu-panel-solid p-4 sm:p-6" aria-labelledby="settings-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="vvu-label text-[10px] text-[#c8ff00] border border-[#c8ff00]/40 px-2 py-0.5">
                  CTRL+0 · SETTINGS
                </span>
                <span className="vvu-label text-[9px] px-2 py-0.5 rounded border border-[rgba(107,138,64,0.35)] text-[#7a8a6e]">
                  {entryCount}/{totalBindings} TOUCHED · {masteredCount} MASTERED
                </span>
              </div>
              <h1 id="settings-title" className="vvu-label text-xl sm:text-2xl font-bold text-[#f3e38a] tracking-[0.18em] mt-2">
                SETTINGS · LINDIWE, PINS &amp; PREFERENCES
              </h1>
              <p className="vvu-label text-[9px] sm:text-[10px] text-[#7a8a6e] mt-1 max-w-2xl leading-relaxed">
                THE TUTOR&apos;S LEARNING STATE · THE PIN FLOOR · HONEST CLIENT + RAIL FACTS · NOTHING LEAVES THIS BROWSER
              </p>
            </div>
            <span className="vvu-label text-[8px] text-[#7a8a6e] flex items-center gap-1.5">
              <Brain className="size-3" aria-hidden /> MASTERY = 3 USES · THEN SILENCE IS THE REWARD
            </span>
          </div>
        </section>

        {/* ── §1 Lindiwe memory ── */}
        <section className="vvu-panel p-4 sm:p-6" aria-labelledby="settings-tutor-h">
          <div className="flex items-center gap-1.5 mb-3 px-0.5">
            <span className="inline-block size-1.5 bg-[#c8ff00]" aria-hidden />
            <h2 id="settings-tutor-h" className="vvu-label text-[8px] font-bold tracking-[0.22em] text-[#7a8a6e]">
              LINDIWE · TUTOR MEMORY (vvu.lindiwe.v1)
            </h2>
          </div>

          <p className="vvu-label text-[8.5px] text-[#7a8a6e] leading-relaxed mb-4 max-w-3xl">
            LINDIWE HAS NO OFF SWITCH BY DESIGN — MASTERY IS THE SILENCE. TEACH ONCE AT FIRST USE · SILENT AFTER 3 USES ·
            ONE QUIET REMINDER AFTER 5 DAYS UNUSED · NEVER A HINT FOR BROWSER-RESERVED KEYS (CTRL+N/T/W).
          </p>

          {/* mastery table — every binding in the map, grouped */}
          <div className="space-y-5">
            {(
              [
                ['TABS', 'CTRL+1..CTRL+0 · the ten fixed surfaces', MAP.tabs.map((t) => ({ key: t.key, title: t.label, teach: t.teach }))],
                ['ACTIONS', 'CTRL+A..CTRL+Z · verbs on the current surface', MAP.actions.map((a) => ({ key: a.key, title: a.action, teach: a.teach, reserved: a.reserved }))],
                ['CHORDS', 'G then key · 600ms window', MAP.chords.map((c) => ({ key: chordKey(c), title: `→ ${c.route}`, teach: '' }))],
              ] as const
            ).map(([group, note, rows]) => (
              <div key={group}>
                <div className="flex items-center gap-2 mb-2 px-0.5">
                  <span className="vvu-label text-[8px] font-bold tracking-[0.22em] text-[#7a8a6e]">{group}</span>
                  <span className="vvu-label text-[7px] text-[#7a8a6e]/70">{note}</span>
                </div>
                <div className="max-h-72 overflow-y-auto rounded border border-[#6b8a40]/30 bg-black/30">
                  <table className="w-full font-mono text-[9px] min-w-[520px]">
                    <thead className="sticky top-0 bg-[#0b0f0a]">
                      <tr className="vvu-label text-[8px] text-[#7a8a6e] text-left">
                        <th scope="col" className="px-2.5 py-1.5">KEYS</th>
                        <th scope="col" className="px-2.5 py-1.5">WHAT</th>
                        <th scope="col" className="px-2.5 py-1.5">MASTERY</th>
                        <th scope="col" className="px-2.5 py-1.5">USES</th>
                        <th scope="col" className="px-2.5 py-1.5">LAST USED</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const entry = lindiwe.shortcuts[r.key];
                        const uses = entry?.uses ?? 0;
                        const mastered = uses >= 3;
                        return (
                          <tr key={r.key} className="border-t border-[#6b8a40]/15">
                            <td className="px-2.5 py-1.5">
                              <span className="vvu-kbd">{prettyKey(r.key)}</span>
                            </td>
                            <td className="px-2.5 py-1.5 text-[#d7e2c9] truncate max-w-40" title={r.teach}>
                              {r.title}
                              {'reserved' in r && r.reserved ? (
                                <span className="text-[#e5484d] ml-2" title={r.reserved}>· RESERVED</span>
                              ) : null}
                            </td>
                            <td className="px-2.5 py-1.5">
                              <span
                                className={`vvu-label text-[8px] px-1.5 py-0.5 rounded border ${
                                  mastered
                                    ? 'border-[#c8ff00]/50 text-[#c8ff00] bg-[#c8ff00]/10'
                                    : uses > 0
                                      ? 'border-[#e0a030]/50 text-[#e0a030]'
                                      : 'border-[rgba(107,138,64,0.35)] text-[#7a8a6e]'
                                }`}
                              >
                                {mastered ? 'MASTERED' : uses > 0 ? 'LEARNING' : 'UNSEEN'}
                              </span>
                            </td>
                            <td className="px-2.5 py-1.5 text-[#c9d4bd] tabular-nums">{uses}</td>
                            <td className="px-2.5 py-1.5 text-[#7a8a6e] tabular-nums">{usedAgo(entry?.last_used ?? 0)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          {/* guarded reset */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="vvu-label text-[8px] text-[#7a8a6e] max-w-md leading-relaxed">
              CLEARING RESETS USES / MASTERY TO ZERO FOR ALL {totalBindings} BINDINGS — LINDIWE TEACHES AGAIN FROM ZERO
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px] vvu-label text-[10px] font-bold border-[#e5484d]/50 text-[#e5484d] hover:bg-[#e5484d]/10 hover:text-[#e5484d]"
                >
                  <Trash2 className="size-3.5" aria-hidden /> RESET TUTOR MEMORY
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-[#0b0f0a] border-[#6b8a40]/50">
                <AlertDialogHeader>
                  <AlertDialogTitle className="vvu-label text-xs font-bold text-[#f3e38a] tracking-[0.14em]">
                    CLEAR ALL LINDIWE MEMORY?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="vvu-label text-[9px] text-[#7a8a6e] leading-relaxed">
                    Every shortcut returns to UNSEEN — she teaches again from the first use. This cannot be undone (the old
                    counts are not backed up anywhere).
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="min-h-[44px] vvu-label text-[10px]">KEEP MEMORY</AlertDialogCancel>
                  <AlertDialogAction
                    className="min-h-[44px] vvu-label text-[10px] font-bold bg-[#e5484d]/90 text-white hover:bg-[#e5484d]"
                    onClick={() => {
                      const L = (window as unknown as { Lindiwe?: { reset: () => void } }).Lindiwe;
                      if (L) L.reset();
                      toast('lindiwe memory cleared — teaching restarts from zero');
                    }}
                  >
                    CLEAR IT
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </section>

        {/* ── §2 pins ── */}
        <section className="vvu-panel p-4 sm:p-6" aria-labelledby="settings-pins-h">
          <div className="flex items-center gap-1.5 mb-3 px-0.5">
            <span className="inline-block size-1.5 bg-[#2ea8a0]" aria-hidden />
            <h2 id="settings-pins-h" className="vvu-label text-[8px] font-bold tracking-[0.22em] text-[#7a8a6e]">
              PINS · THE PINNABLE FLOOR (vvu.pins.v1)
            </h2>
          </div>
          <p className="vvu-label text-[8.5px] text-[#7a8a6e] leading-relaxed mb-4 max-w-3xl">
            PINNED PANELS LIVE AT THE BOTTOM OF EVERY SURFACE — LIVE DATA, RESIZABLE BY THEIR TOP EDGE, HEIGHT REMEMBERED.
            CTRL+P PINS THE PANEL IN FOCUS · CTRL+U UNPINS · CTRL+H HIDES · CTRL+SHIFT+H REVEALS · CTRL+SHIFT+P POPS THE
            VISUAL PANEL OUT TO PIP.
          </p>
          <div className="rounded border border-[#6b8a40]/30 bg-black/30 divide-y divide-[#6b8a40]/15">
            {pinsView.registry.length === 0 ? (
              <div className="px-3 py-3 vvu-label text-[9px] text-[#7a8a6e]">
                PIN SYSTEM NOT LOADED (pinnable-panels.js) — no state shown, none invented
              </div>
            ) : (
              pinsView.registry.map((p) => {
                const pinned = pinsView.state.pinned.includes(p.id);
                const hidden = pinsView.state.hidden.includes(p.id);
                const h = pinsView.state.heights[p.id];
                return (
                  <div key={p.id} data-vvu-panel={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 min-h-[44px]">
                    <Pin className={`size-3 ${pinned ? 'text-[#c8ff00]' : 'text-[#7a8a6e]'}`} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="vvu-label text-[9px] text-[#d7e2c9]">{p.label}</p>
                      <p className="vvu-label text-[7.5px] text-[#7a8a6e]">{p.note}</p>
                    </div>
                    {hidden ? (
                      <span className="vvu-label text-[7.5px] text-[#e5484d] border border-[#e5484d]/40 px-1.5 py-0.5">HIDDEN</span>
                    ) : pinned ? (
                      <span className="vvu-label text-[7.5px] text-[#c8ff00] border border-[#c8ff00]/40 px-1.5 py-0.5">
                        PINNED{h ? ` · ${h}PX` : ''}
                      </span>
                    ) : (
                      <span className="vvu-label text-[7.5px] text-[#7a8a6e] border border-[rgba(107,138,64,0.35)] px-1.5 py-0.5">OFF</span>
                    )}
                    <span className="flex gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!pinsApi}
                        onClick={() => pinsApi?.pin(p.id)}
                        className="min-h-[34px] h-8 px-2.5 vvu-label text-[8px]"
                      >
                        PIN
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!pinsApi}
                        onClick={() => pinsApi?.unpin(p.id)}
                        className="min-h-[34px] h-8 px-2.5 vvu-label text-[8px]"
                      >
                        UNPIN
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!pinsApi}
                        onClick={() => pinsApi?.hide(p.id)}
                        className="min-h-[34px] h-8 px-2.5 vvu-label text-[8px]"
                      >
                        HIDE
                      </Button>
                    </span>
                  </div>
                );
              })
            )}
          </div>
          {pinsView.state.hidden.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              disabled={!pinsApi}
              onClick={() => pinsApi?.revealLastHidden()}
              className="mt-3 min-h-[44px] vvu-label text-[9px]"
            >
              REVEAL LAST HIDDEN (CTRL+SHIFT+H) · {pinsView.state.hidden.length} HIDDEN
            </Button>
          ) : null}
        </section>

        {/* ── §3 interface ── */}
        <section className="vvu-panel p-4 sm:p-6" aria-labelledby="settings-ui-h">
          <div className="flex items-center gap-1.5 mb-3 px-0.5">
            <span className="inline-block size-1.5 bg-[#f3e38a]" aria-hidden />
            <h2 id="settings-ui-h" className="vvu-label text-[8px] font-bold tracking-[0.22em] text-[#7a8a6e]">
              INTERFACE · CLIENT CONTEXT
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Fact icon={<Monitor className="size-3.5" aria-hidden />} label="PLATFORM" value={PLATFORM || '—'} />
            <Fact icon={<Monitor className="size-3.5" aria-hidden />} label="VIEWPORT (LIVE)" value={viewport || '—'} />
            <Fact
              icon={<Info className="size-3.5" aria-hidden />}
              label="THEME"
              value="DARK instrument · DAYSHIFT via header sun / palette"
            />
          </div>
          <p className="vvu-label text-[8px] text-[#7a8a6e] mt-3 leading-relaxed">
            PLATFORM + VIEWPORT ARE READ CLIENT-SIDE AFTER MOUNT — NOTHING HERE IS SENT ANYWHERE
          </p>
        </section>

        {/* ── §4 storage ── */}
        <section className="vvu-panel p-4 sm:p-6" aria-labelledby="settings-storage-h">
          <div className="flex items-center gap-1.5 mb-3 px-0.5">
            <span className="inline-block size-1.5 bg-[#2ea8a0]" aria-hidden />
            <h2 id="settings-storage-h" className="vvu-label text-[8px] font-bold tracking-[0.22em] text-[#7a8a6e]">
              STORAGE · LOCALSTORAGE KEYS THIS APP USES
            </h2>
          </div>
          <div className="rounded border border-[#6b8a40]/30 bg-black/30 divide-y divide-[#6b8a40]/15">
            <StorageRow keyName="vvu.lindiwe.v1" what="Lindiwe tutor memory — per-shortcut uses/mastery (nothing leaves the browser)" />
            <StorageRow keyName="vvu.pins.v1" what="pin floor state — pinned/hidden panels + remembered heights" />
            <StorageRow keyName="vvu_events" what="route WORM tail — hash-chained navigation events" />
            <StorageRow keyName="vvu.twin.worm.visible" what="municipal twin — WORM ledger pin default visibility" />
            <StorageRow keyName="vvu.footer.pin" what="footer status row pin preference (legacy)" />
          </div>
          <p className="vvu-label text-[8px] text-[#7a8a6e] mt-3 leading-relaxed">
            READ-ONLY DISPLAY · CLEARING BROWSER STORAGE RESETS TEACHING STATE AND THE LOCAL EVENT TAIL (THE RECEIPT
            CHAINS ON THE RAILS ARE UNAFFECTED)
          </p>
        </section>

        {/* ── §5 rails reference ── */}
        <section className="vvu-panel p-4 sm:p-6" aria-labelledby="settings-rails-h">
          <div className="flex items-center gap-1.5 mb-3 px-0.5">
            <span className="inline-block size-1.5 bg-[#e0a030]" aria-hidden />
            <h2 id="settings-rails-h" className="vvu-label text-[8px] font-bold tracking-[0.22em] text-[#7a8a6e]">
              RAILS · API PROXIES (READ-ONLY REFERENCE)
            </h2>
          </div>
          <div className="rounded border border-[#6b8a40]/30 bg-black/30 divide-y divide-[#6b8a40]/15">
            <RailRow path="/api/vvu/rails" what="Task 47 · aggregate rail probe + SLA (72h derived from persisted sweeps) + :3005 devices" />
            <RailRow path="/api/watchdog" what="rail health — server-side rail probes with 2.5s timeouts" />
            <RailRow path="/api/integrity" what="self fingerprints — running module hash vs disk hash" />
            <RailRow path="/api/bridge/*" what="vault-bridge :3004 — status · receipts · pair" />
            <RailRow path="/api/field/*" what="field-onboard :3005 — status · receipts · pair" />
            <RailRow path="/api/vvu/sphere-meta" what="Task 47 · trust-sphere artifact integrity facts (computed from disk)" />
            <RailRow path="/api/anchor" what="stub anchor relay — self-declaring stub:* txRefs, no real chain write" />
          </div>
        </section>

        {/* ── §6 about ── */}
        <section className="vvu-panel p-4 sm:p-6" aria-labelledby="settings-about-h">
          <div className="flex items-center gap-1.5 mb-3 px-0.5">
            <span className="inline-block size-1.5 bg-[#7a8a6e]" aria-hidden />
            <h2 id="settings-about-h" className="vvu-label text-[8px] font-bold tracking-[0.22em] text-[#7a8a6e]">
              ABOUT · HONEST LABELS, NO INVENTED VERSIONS
            </h2>
          </div>
          <ul className="font-mono text-[9px] text-[#c9d4bd] space-y-1.5">
            <li className="flex gap-2"><span className="text-[#c8ff00]">·</span> single-route app — 24 hash projections over /</li>
            <li className="flex gap-2"><span className="text-[#c8ff00]">·</span> receipt chains — SHA-256 hash-chained, genesis-verified</li>
            <li className="flex gap-2"><span className="text-[#c8ff00]">·</span> keyboard layer — keyboard-map.json is the single source of truth</li>
            <li className="flex gap-2"><span className="text-[#e0a030]">·</span> ANCHOR: STUBBED</li>
            <li className="flex gap-2"><span className="text-[#e0a030]">·</span> ANDROID BRIDGE: PROTOTYPE (LOOPBACK-VERIFIED 9/9)</li>
            <li className="flex gap-2"><span className="text-[#e0a030]">·</span> CTRL+N/T/W: BROWSER-RESERVED ON DESKTOP TABS — PWA CONTEXTS ONLY</li>
            <li className="flex gap-2"><span className="text-[#e5484d]">·</span> REGULATORY: REVIEW REQUIRED</li>
          </ul>
          <p className="vvu-label text-[8px] text-[#7a8a6e] mt-3 flex items-center gap-1.5">
            <Keyboard className="size-3" aria-hidden /> TABS + CHORDS + ACTIONS ARE TAUGHT IN-CONTEXT — TEACH ONCE, THEN SILENCE
            <Server className="size-3" aria-hidden /> <Database className="size-3" aria-hidden />
          </p>
        </section>
      </div>
    </div>
  );
}

// ── small local atoms ───────────────────────────────────────────────────────

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-sm border border-[#6b8a40]/30 bg-black/30 p-3 min-w-0">
      <p className="vvu-label text-[8px] text-[#7a8a6e] flex items-center gap-1.5">{icon}{label}</p>
      <p className="font-mono text-[10px] text-[#d7e2c9] mt-1.5 break-words">{value}</p>
    </div>
  );
}

function StorageRow({ keyName, what }: { keyName: string; what: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2.5">
      <code className="font-mono text-[10px] text-[#c8ff00] shrink-0">{keyName}</code>
      <span className="vvu-label text-[8px] text-[#7a8a6e] min-w-0">{what}</span>
    </div>
  );
}

function RailRow({ path, what }: { path: string; what: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2.5">
      <code className="font-mono text-[10px] text-[#f3e38a] shrink-0">{path}</code>
      <span className="vvu-label text-[8px] text-[#7a8a6e] min-w-0">{what}</span>
    </div>
  );
}
