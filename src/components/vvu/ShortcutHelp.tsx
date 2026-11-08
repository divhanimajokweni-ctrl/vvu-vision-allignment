'use client';

// src/components/vvu/ShortcutHelp.tsx — keyboard shortcut help dialog ("?").
// A SCADA-styled reference card for the REAL global shortcuts (verified
// against CommandPalette.tsx: ⌘K/Ctrl+K + "/" open the palette, Esc closes
// dialogs, ↑/↓ navigate, Enter runs, Tab cycles) plus the mouse/touch
// affordances (mesh/map tap → node inspector, segmented control, lime route
// toggle, palette FSM/sim contents). Opens on "?" (Shift+/) when no field is
// focused and no dialog already owns the keyboard, on the window event
// 'vvu:open-shortcuts' (footer "?" keycap — the touch-device entry point),
// and closes on Esc / ✕ via the Radix dialog primitives.

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

// Platform keycap hint — module-level (SSR renders CTRL; the text mismatch on
// Mac clients is suppressed on the keycap spans, so no hydration warning).
// Same pattern as VvuHeader.
const IS_MAC =
  typeof navigator !== 'undefined' && /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent);
const MOD = IS_MAC ? '⌘' : 'CTRL';

// ── shortcut registry ────────────────────────────────────────────────────────

interface ShortcutRow {
  keys: string[];
  label: string;
  hint: string;
}

interface ShortcutSection {
  title: string;
  color: string;
  rows: ShortcutRow[];
}

const SECTIONS: ShortcutSection[] = [
  {
    title: 'VIEW',
    color: '#c8ff00',
    rows: [
      {
        keys: [`${MOD} 1`, `… ${MOD} 0`],
        label: 'The ten fixed surfaces',
        hint: 'IVE · EVIDENCE · TERMINAL · MISSION · TWIN · WATCHDOG · RECEIPTS · POOLS · BRIDGES · SETTINGS',
      },
      {
        keys: ['G', '→ key'],
        label: 'Chord jumps (600ms window)',
        hint: 'G→I IVE · G→E EVIDENCE · G→T TERMINAL · G→M MISSION · G→W TWIN · G→H WATCHDOG · G→R RECEIPTS · G→P POOLS · G→B BRIDGES · G→S SETTINGS',
      },
      {
        keys: [`${MOD} P`, `${MOD} U`, `${MOD} H`],
        label: 'Pin / unpin / hide the panel in focus',
        hint: `${MOD}+SHIFT+H reveals · right-click a dock header for the menu`,
      },
      {
        keys: [`${MOD} ⇧ P`],
        label: 'Pop the visual panel out to PiP',
        hint: 'twin · sphere · mesh — live in their own window · Esc restores',
      },
      {
        keys: [`${MOD} K`, '/'],
        label: 'Open the command palette',
        hint: 'every projection · type to filter commands',
      },
      {
        keys: [`${MOD} ⌥ K`],
        label: 'The keyboard map (5s overlay)',
        hint: 'or the ⌨ icon, top-right — every binding, then it fades',
      },
      {
        keys: ['◂ ▸'],
        label: 'Bottom-right lime toggle',
        hint: 'the estate cycle over all 24 projections',
      },
    ],
  },
  {
    title: 'ACTIONS',
    color: '#2ea8a0',
    rows: [
      { keys: [`${MOD} A…${MOD} Z`], label: 'Twenty-six action verbs', hint: 'act on the current surface · unclaimed actions say so honestly' },
      { keys: [`${MOD} ⇧ <key>`], label: 'The inverse of any action', hint: `${MOD}+H hides · ${MOD}+⇧+H reveals` },
      { keys: [`${MOD} ⌥ <key>`], label: 'Discoverability flash', hint: 'shows what a key does for 5s — never executes' },
      { keys: [`${MOD} R`], label: 'Refresh from source', hint: 'invalidates every query — cache bypassed' },
      { keys: [`${MOD} Y`], label: 'Yield', hint: 'returns to the default surface (IVE)' },
      {
        keys: ['DECLARED'],
        label: 'Browser-reserved keys',
        hint: 'CTRL+N / CTRL+T / CTRL+W are reserved by desktop browsers — bound for PWA contexts, never taught',
      },
    ],
  },
  {
    title: 'PALETTE',
    color: '#f3e38a',
    rows: [
      { keys: ['↑', '↓'], label: 'Navigate the command list', hint: 'wrapping selection · Home / End jump to the ends' },
      { keys: ['⏎'], label: 'Run the active command', hint: 'Enter · rows are tappable too' },
      { keys: ['TAB'], label: 'Cycle focus inside the palette', hint: 'filter input ↔ active row' },
      { keys: ['ESC'], label: 'Close any open dialog', hint: 'palette · node inspector · this help' },
    ],
  },
  {
    title: 'FSM · SIM',
    color: '#e0a030',
    rows: [
      {
        keys: ['σ'],
        label: 'FSM symbol commands',
        hint: 'palette FSM group or bottom-left console · CLICK / CLEAR / WARN / CRIT / RESET · illegal δ tagged',
      },
      { keys: ['×1', '×5', '×20'], label: 'Simulation speed', hint: 'palette SIMULATION group · business clock multiplier' },
      {
        keys: ['3A', '3B', '3C'],
        label: 'SIM SKIP fast-path + RESET DEMO',
        hint: 'jump gate conditions · certification still required',
      },
    ],
  },
  {
    title: 'INSPECT · TUTOR',
    color: '#7a8a6e',
    rows: [
      {
        keys: ['TAP'],
        label: 'Tap a rig node to inspect it',
        hint: '3D mesh node or map node square → spec + live telemetry panel',
      },
      { keys: ['?'], label: 'Open this shortcut help', hint: 'Shift + / · or the ? keycap in the footer' },
      {
        keys: ['LINDIWE'],
        label: 'The tutor teaches once, then is silent',
        hint: 'first use → one 5s whisper · 3 uses → mastered, silence forever · 5 days unused → one quiet reminder',
      },
    ],
  },
];

// ── the dialog ───────────────────────────────────────────────────────────────

export function ShortcutHelp() {
  const [open, setOpen] = useState(false);

  // "?" (Shift+/) opens the help — only when no field is focused and no
  // dialog already owns the keyboard (the palette focuses its filter input,
  // so typing "?" there must insert a literal question mark; the node
  // inspector / palette / help are all [role=dialog], so one is caught even
  // when focus has escaped back to <body>).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '?' || open) return;
      const el = document.activeElement;
      if (el instanceof HTMLElement) {
        const tag = el.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) return;
        if (el.closest('[role="dialog"]')) return;
      }
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  // Touch-device entry point: the footer "?" keycap dispatches this event
  // (same pattern as 'vvu:open-palette' in VvuHeader).
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('vvu:open-shortcuts', onOpen);
    return () => window.removeEventListener('vvu:open-shortcuts', onOpen);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        aria-label="Keyboard shortcuts"
        className="vvu-panel-solid flex max-h-[88vh] sm:max-h-[82vh] flex-col gap-0 overflow-hidden p-0 shadow-[0_24px_80px_rgba(0,0,0,0.6)] sm:max-w-[620px]"
      >
        {/* ── header ── */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[rgba(107,138,64,0.25)] shrink-0">
          <div className="min-w-0">
            <DialogTitle className="vvu-label text-left text-[11px] font-bold tracking-[0.18em] leading-none text-[#f3e38a]">
              KEYBOARD · SHORTCUTS
            </DialogTitle>
            <DialogDescription className="vvu-label text-left mt-1.5 text-[6.5px] leading-none text-[#7a8a6e]">
              VVU dual-projection console · keycaps are <span suppressHydrationWarning>{MOD}</span> on this platform
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close shortcut help"
            title="Close (Escape)"
            className="shrink-0 flex items-center justify-center min-h-[44px] min-w-[44px] -my-1.5 -mr-2 rounded-sm text-[#7a8a6e] hover:text-[#e5484d] transition-colors"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        {/* ── sections (single column mobile · two columns desktop) ── */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-3 sm:space-y-4">
          {SECTIONS.map((sec) => (
            <section key={sec.title} aria-label={`${sec.title} shortcuts`}>
              <div className="flex items-center gap-1.5 mb-1.5 px-0.5">
                <span className="inline-block size-1.5 shrink-0" style={{ background: sec.color }} aria-hidden />
                <span className="vvu-label text-[8px] font-bold tracking-[0.22em] text-[#7a8a6e]">{sec.title}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
                {sec.rows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-start gap-2.5 min-h-[44px] px-2.5 py-2 rounded-sm border border-[rgba(107,138,64,0.22)] bg-[rgba(6,8,6,0.55)]"
                  >
                    <div className="flex items-center gap-1 shrink-0 flex-wrap max-w-[45%]">
                      {row.keys.map((k) => (
                        <span key={k} className="vvu-kbd" suppressHydrationWarning>
                          {k}
                        </span>
                      ))}
                    </div>
                    <div className="min-w-0">
                      <div className="font-mono text-[10px] leading-tight text-[#d7e2c9]">{row.label}</div>
                      <div className="vvu-label text-[6.5px] text-[#7a8a6e] leading-relaxed mt-0.5">{row.hint}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* ── palette contents strip + Esc hint ── */}
        <div className="shrink-0 border-t border-[rgba(107,138,64,0.25)] px-4 py-2 flex items-center gap-2 flex-wrap vvu-label text-[6.5px] text-[#7a8a6e]">
          <span className="text-[#8fb35a] shrink-0">PALETTE CONTAINS</span>
          <span className="min-w-0">
            route cycle (spatial · analytics · sequence engine · holocom · urllc+ neural edge · capability dossier · metro · field kit campus walk · support mk-i funding) · mesh/map projection · FSM σ · sim speed ×1/×5/×20 · SIM SKIP 3A/3B/3C + RESET DEMO · WORM
            re-verify · CSV export
          </span>
          <span className="ml-auto shrink-0 flex items-center gap-1.5">
            <span className="vvu-kbd">ESC</span> CLOSE
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ShortcutHelp;
