'use client';

// src/components/metro/MetroRail.tsx — Round 27 (the user's pinned-rail
// package, merged into the authoritative Metro): GATE 4/5 becomes
// "Game + Left Rail" — the REAL VVU telemetry rail (SYS.02 GIS SPATIAL
// TRUTH + SYS.03 YOLO EDGE AI + alert feed + node array, live-wired via
// the same queries as the / view) pinned beside the Mark V game.
//
//   📌 PINNED  → rail visible (desktop: sticky column; the game shares the
//                row). Click again to collapse.
//   📍 RAIL    → the collapsed state's slim left-edge tab; the game owns
//                the full screen. Phones START collapsed (full-screen game,
//                the user's "collapse on mobile so the map goes full-screen"
//                request) and open the rail as a drawer overlay.
//
// The choice persists (pb_metro_rail) and every toggle is WORM-logged
// (RAIL_PIN · OPERATOR) — the same discipline as the city-side rail.

import { useCallback, useState, type ReactNode } from 'react';
import { Pin } from 'lucide-react';
import CityHudPanels from '@/components/spatial/CityHudPanels';
import { useSendWormLog } from '@/hooks/use-vvu-socket';
import { metroFx } from './MetroWorkspace';
import { cn } from '@/lib/utils';

const RAIL_KEY = 'pb_metro_rail';

function readInitialOpen(): boolean {
  if (typeof window === 'undefined') return true;
  const saved = window.localStorage.getItem(RAIL_KEY);
  if (saved === '0' || saved === '1') return saved === '1';
  // Phones start collapsed — the game owns the full screen; the rail is a
  // drawer away. Large screens pin it beside the game (the "Game + Left
  // Rail" layout the user asked for).
  return window.matchMedia('(min-width: 1024px)').matches;
}

export function MetroTelemetryRail({ children }: { children: ReactNode }) {
  const sendWormLog = useSendWormLog();
  const [open, setOpen] = useState<boolean>(readInitialOpen);

  const toggle = useCallback(() => {
    metroFx.click();
    metroFx.haptic(10);
    setOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(RAIL_KEY, next ? '1' : '0');
      } catch {
        // private mode — the choice just doesn't persist
      }
      sendWormLog(
        'RAIL_PIN',
        'OPERATOR',
        `METRO GATE 4 telemetry rail ${next ? 'PINNED — live SYS.02/SYS.03 beside the game' : 'COLLAPSED — game full-screen'}`,
      );
      return next;
    });
  }, [sendWormLog]);

  return (
    <div className={cn('min-h-0', open && 'lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-4')}>
      {open && (
        <>
          {/* <lg: the rail is a drawer overlay — scrim tap closes it, the
              game keeps the full screen behind. */}
          <button
            type="button"
            aria-label="Close the telemetry rail"
            onClick={toggle}
            className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          />
          <aside
            aria-label="Live city telemetry rail"
            className="fixed inset-y-0 left-0 z-40 w-[88%] max-w-[340px] bg-[#071018] border-r border-[#00e5ff44] overflow-y-auto pbmetro-scroll p-3 lg:static lg:z-0 lg:w-auto lg:max-w-none lg:p-0 lg:border-r-0 lg:bg-transparent lg:overflow-visible"
          >
            {/* sticky column: stays in view while the (scrolling) game runs */}
            <div className="flex flex-col gap-2 lg:sticky lg:top-[70px] lg:max-h-[calc(100vh-92px)] lg:overflow-y-auto pbmetro-scroll">
              {/* rail head — the 📌 pin toggle (user's pinned-rail design) */}
              <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border border-[#214050] bg-[#0a1520]">
                <span className="font-mono text-[9px] tracking-[0.16em] font-bold text-[#00e5ff] whitespace-nowrap">
                  VENTURE VISION UBUNTU
                </span>
                <button
                  type="button"
                  onClick={toggle}
                  aria-label="Collapse the telemetry rail — game full-screen"
                  className="flex items-center gap-1.5 min-h-[44px] px-2.5 rounded-md border border-[#00ffcc88] text-[#00ffcc] bg-[#00ffcc0d] font-mono text-[9px] font-bold tracking-[0.12em] hover:bg-[#00ffcc1a] transition-colors whitespace-nowrap select-none active:scale-[0.97]"
                >
                  <Pin className="size-3" aria-hidden />
                  PINNED
                </button>
              </div>

              {/* the REAL panels — same live-wired components as the / view */}
              <CityHudPanels variant="inline" />

              <div className="text-center font-mono text-[8px] tracking-[0.14em] text-[#5c6f7c] px-2 py-2 border-t border-[#21405055]">
                LIVE CITY FEED · GQEBERHA EDGE · STEADY_STATE_LOCKED
              </div>
            </div>
          </aside>
        </>
      )}

      {!open && (
        /* collapsed: the slim left-edge tab — the game owns the full screen */
        <button
          type="button"
          onClick={toggle}
          aria-label="Pin the telemetry rail — show live SYS.02 GIS and SYS.03 YOLO panels"
          title="Pin the telemetry rail"
          className="fixed left-0 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center justify-center gap-1 min-h-[96px] min-w-[34px] px-1 rounded-r-lg border border-l-0 border-[#00e5ff66] bg-[#0a1520ee] text-[#00e5ff] hover:bg-[#0a1520] hover:border-[#00e5ff] transition-colors select-none active:scale-[0.97]"
        >
          <Pin className="size-3.5" aria-hidden />
          <span className="font-mono text-[8px] font-bold tracking-[0.22em] [writing-mode:vertical-rl]">RAIL</span>
        </button>
      )}

      <div className="min-w-0">{children}</div>
    </div>
  );
}

export default MetroTelemetryRail;
