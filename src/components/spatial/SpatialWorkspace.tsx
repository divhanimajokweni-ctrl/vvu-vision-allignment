'use client';

// src/components/spatial/SpatialWorkspace.tsx — SPATIAL_INTELLIGENCE container.
// Top-center segmented control flips the projection between the three modes
// (also driven by 'vvu:set-projection' CustomEvents from the command palette):
//   CITY TWIN — the City Digital Twin GIS bench (default, Round 12): N01–N06
//               embedded on pipeline mains inside the city, 5 bench layers,
//               SYS.02/SYS.03 HUD (CityHudPanels)
//   RIG       — the WebGL terrain mesh of the Gqeberha edge-node rig
//   MAP       — the 2D tactical ENU map
// Hosts the HUD overlay, the collapsible FSM console, the WORM ledger ticker,
// the reconnect banner, and the node inspector (all modes: bench pod raycast,
// rig raycast or map tap → panel + reticle).

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Boxes, Building2, Map as MapIcon } from 'lucide-react';
import ThreeScene from './ThreeScene';
import CityGisBench from './CityGisBench';
import CityHudPanels from './CityHudPanels';
import TacticalMap from './TacticalMap';
import HudOverlay from './HudOverlay';
import FsmPanel from './FsmPanel';
import NodeInspector from './NodeInspector';
import WormTicker from './WormTicker';
import { useConnected, useRequestSnapshot, useSendWormLog, useVvuSocketStore } from '@/hooks/use-vvu-socket';

type ViewMode = 'city' | 'mesh' | 'map';

const MODE_LABEL: Record<ViewMode, string> = {
  city: 'CITY TWIN',
  mesh: 'RIG',
  map: 'MAP',
};

export function SpatialWorkspace() {
  // Round 12: the city digital twin is the default projection — telemetry is
  // embedded in the CITY, not an isolated mast.
  const [mode, setMode] = useState<ViewMode>('city');
  const [stats, setStats] = useState<{ fps: number; drawCalls: number } | null>(null);
  // Task 11-b — selection + pin live in the zustand store (module scope), so
  // a PINNED selection survives this component unmounting on the spatial ⇄
  // analytics route switch. Unpinned keeps the old behaviour: cleared on
  // unmount (see the cleanup effect below).
  const inspectNodeId = useVvuSocketStore((s) => s.inspectNodeId);
  const setInspectNode = useVvuSocketStore((s) => s.setInspectNode);
  const connected = useConnected();
  const requestSnapshot = useRequestSnapshot();
  const sendWormLog = useSendWormLog();
  const snapAsked = useRef(false);

  // Pull the full sim snapshot once the link is up (state + WORM + log in
  // one round trip, instead of waiting for the next periodic snapshot).
  useEffect(() => {
    if (connected && !snapAsked.current) {
      snapAsked.current = true;
      requestSnapshot();
    }
  }, [connected, requestSnapshot]);

  // Task 11-b — on unmount (route switch to analytics), drop the selection
  // UNLESS it is pinned. State is read at cleanup time (no stale closure);
  // a pinned selection stays in the store and re-hydrates the inspector
  // when the workspace remounts. Explicit dismiss (✕ / Esc) clears both.
  useEffect(
    () => () => {
      const s = useVvuSocketStore.getState();
      if (!s.inspectPinned && s.inspectNodeId) s.setInspectNode(null);
    },
    [],
  );

  const handleStats = useCallback((s: { fps: number; drawCalls: number }) => {
    setStats(s);
  }, []);

  const handleNodeSelect = useCallback((nodeId: string | null) => {
    setInspectNode(nodeId);
  }, [setInspectNode]);

  // Task 11-b — pin toggle: flips the sticky flag in the store and WORM-logs
  // the operator intent (NODE_PIN · OPERATOR — quintet with VIEW_MODE /
  // NODE_INSPECT / ROUTE_TOGGLE / GIS_LAYER; categorized OPERATOR in the
  // ledger filter).
  const handleTogglePin = useCallback(() => {
    const s = useVvuSocketStore.getState();
    const next = !s.inspectPinned;
    s.toggleInspectPin();
    if (s.inspectNodeId) {
      sendWormLog(
        'NODE_PIN',
        'OPERATOR',
        `${s.inspectNodeId} ${next ? 'PINNED — selection survives view switches' : 'UNPINNED'}`,
      );
    }
  }, [sendWormLog]);

  // The inspector now survives the mode fade (all projections can inspect),
  // so switching no longer resets the selection — the city pod tap, the 3D
  // tap, the map tap, the inspector ✕ button and an empty-canvas tap are the
  // only dismiss/select paths.
  const switchMode = useCallback(
    (next: ViewMode) => {
      if (next === mode) return;
      sendWormLog('VIEW_MODE', 'OPERATOR', `${MODE_LABEL[mode]} → ${MODE_LABEL[next]}`);
      setMode(next);
    },
    [mode, sendWormLog],
  );

  // Command palette → projection switch. detail: 'city' | 'mesh' | 'map'.
  // Routed through switchMode so the mode state, the fade and the WORM
  // VIEW_MODE log stay identical to the segmented control; same-mode events
  // are ignored there.
  useEffect(() => {
    const onSetProjection = (evt: Event) => {
      const detail = (evt as CustomEvent<unknown>).detail;
      if (detail === 'city' || detail === 'mesh' || detail === 'map') switchMode(detail);
    };
    window.addEventListener('vvu:set-projection', onSetProjection);
    return () => window.removeEventListener('vvu:set-projection', onSetProjection);
  }, [switchMode]);

  return (
    <div className="absolute inset-0 bg-[#060806] overflow-hidden">
      {/* ── scene / map (swap with fade) ── */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={mode}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          {mode === 'city' ? (
            <CityGisBench onStats={handleStats} onNodeSelect={handleNodeSelect} />
          ) : mode === 'mesh' ? (
            <ThreeScene onStats={handleStats} onNodeSelect={handleNodeSelect} />
          ) : (
            <TacticalMap onNodeSelect={handleNodeSelect} selectedNodeId={inspectNodeId} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── HUD overlay (gauges · chips · FSM banner) — city mode drops the
          gauges to the bottom strip so the left column belongs to the
          SYS.02 / SYS.03 bench panels ── */}
      <HudOverlay
        fps={mode === 'map' ? null : (stats?.fps ?? null)}
        drawCalls={stats?.drawCalls ?? null}
        gaugesBottom={mode === 'city'}
      />

      {/* ── city bench HUD: SYS.02 GIS SPATIAL TRUTH + SYS.03 YOLO EDGE AI +
          NODE ARRAY (only in the CITY TWIN projection) ── */}
      {mode === 'city' && <CityHudPanels variant="overlay" />}

      {/* ── FSM console (bottom-left, collapsible) ── */}
      <FsmPanel />

      {/* ── node inspector (top-right · ALL modes: bench pod raycast, mesh
          raycast / map tap) ── */}
      <NodeInspector
        nodeId={inspectNodeId}
        onClose={() => setInspectNode(null)}
        onTogglePin={handleTogglePin}
      />

      {/* ── WORM ledger ticker (bottom strip) ── */}
      <WormTicker />

      {/* ── view-mode segmented control (top-center) ── */}
      <div className="absolute top-[78px] left-1/2 -translate-x-1/2 z-30 vvu-enter">
        <div
          className="vvu-panel-solid backdrop-blur-md flex p-0.5 shadow-[0_4px_16px_rgba(0,0,0,0.45)]"
          role="tablist"
          aria-label="Projection mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'city'}
            onClick={() => switchMode('city')}
            className={`vvu-label flex items-center gap-1.5 h-11 min-h-11 px-2.5 sm:px-4 rounded-[5px] text-[8px] sm:text-[10px] font-bold transition-all select-none active:scale-[0.97] ${
              mode === 'city'
                ? 'bg-[rgba(200,255,0,0.1)] text-[#c8ff00] shadow-[inset_0_0_0_1px_rgba(200,255,0,0.35),inset_0_2px_6px_rgba(0,0,0,0.45)]'
                : 'text-[#7a8a6e] hover:text-[#c9d4bd]'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" aria-hidden="true" />
            CITY TWIN
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'mesh'}
            onClick={() => switchMode('mesh')}
            className={`vvu-label flex items-center gap-1.5 h-11 min-h-11 px-2.5 sm:px-4 rounded-[5px] text-[8px] sm:text-[10px] font-bold transition-all select-none active:scale-[0.97] ${
              mode === 'mesh'
                ? 'bg-[rgba(200,255,0,0.1)] text-[#c8ff00] shadow-[inset_0_0_0_1px_rgba(200,255,0,0.35),inset_0_2px_6px_rgba(0,0,0,0.45)]'
                : 'text-[#7a8a6e] hover:text-[#c9d4bd]'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" aria-hidden="true" />
            RIG
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'map'}
            onClick={() => switchMode('map')}
            className={`vvu-label flex items-center gap-1.5 h-11 min-h-11 px-2.5 sm:px-4 rounded-[5px] text-[8px] sm:text-[10px] font-bold transition-all select-none active:scale-[0.97] ${
              mode === 'map'
                ? 'bg-[rgba(200,255,0,0.1)] text-[#c8ff00] shadow-[inset_0_0_0_1px_rgba(200,255,0,0.35),inset_0_2px_6px_rgba(0,0,0,0.45)]'
                : 'text-[#7a8a6e] hover:text-[#c9d4bd]'
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" aria-hidden="true" />
            MAP
          </button>
        </div>
      </div>

      {/* ── connection banner ── */}
      <AnimatePresence>
        {!connected && (
          <motion.div
            key="conn-banner"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="absolute top-[138px] left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 h-9 rounded-sm border border-[rgba(224,160,48,0.55)] bg-[rgba(224,160,48,0.1)] backdrop-blur-sm"
            role="alert"
            aria-live="assertive"
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#e0a030] vvu-blink" aria-hidden="true" />
            <span className="vvu-label text-[6.5px] sm:text-[9px] text-[#e0a030] font-bold whitespace-nowrap">
              TELEMETRY LINK DOWN · RECONNECTING
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default SpatialWorkspace;
