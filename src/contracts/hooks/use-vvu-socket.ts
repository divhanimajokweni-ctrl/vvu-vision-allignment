'use client';

// src/hooks/use-vvu-socket.ts — socket.io client bound to the telemetry
// mini-service (port 3003 via the gateway query param). Zustand store with
// selector-based subscriptions to avoid re-render storms on 1.5s frames.

import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import { create } from 'zustand';
import { ALL_GIS_LAYERS, GIS_LAYERS, type GisLayerId } from '@/lib/vvu-gis';
import type {
  FsmCommand,
  FsmLogEntry,
  FsmState,
  HistoryBuffer,
  HoloFrame,
  SimSnapshot,
  TelemetryFrame,
  WormSimEvent,
} from '@/types/vvu';

interface VvuSocketState {
  socket: Socket | null;
  connected: boolean;
  frame: TelemetryFrame | null;
  history: HistoryBuffer | null;
  wormChain: WormSimEvent[];
  fsmLog: FsmLogEntry[];
  fsmError: string | null;
  snapshotArrived: boolean;
  /** Task 11-b — inspected node + pin. Lives in the module-level store (NOT
   *  component state) so a pinned selection survives the spatial ⇄ analytics
   *  route switch: the workspace unmounts, the store does not. */
  inspectNodeId: string | null;
  inspectPinned: boolean;
  /** Round 12 (city GIS bench) — which of the 5 bench layers are ACTIVE.
   *  Module store (not component state) so layer toggles persist across the
   *  spatial ⇄ analytics route switch, and the RAF loop in CityGisBench can
   *  read it imperatively without re-render coupling. */
  gisLayers: ReadonlySet<GisLayerId>;
  /** Round 19 — latest HOLOCOM cross-layer metrics frame ('holo' event, 3s
   *  cadence) + a rolling tail of frame MTP/loss history for the QoS
   *  prediction surrogate (module store → survives route switches). */
  holoFrame: HoloFrame | null;
  holoHistory: HoloFrame[];
}

interface VvuSocketActions {
  sendFsmCommand: (cmd: FsmCommand) => void;
  sendWormLog: (event: string, source: string, details: string) => void;
  setSimSpeed: (mult: number) => void;
  requestSnapshot: () => void;
  /** Demo fast-path: jump the business sim to a gate's condition (3A/3B/3C) or reset the demo state. */
  simSkip: (gate: '3A' | '3B' | '3C' | 'RESET_DEMO') => void;
  /** Round 19 — flip one of the 4 HoloCom channel-stress levels
   *  (0 NOMINAL · 1 LIGHT · 2 HEAVY · 3 SEVERE) — server WORM-logs
   *  HOLO_CHANNEL_STRESS and re-broadcasts instantly. */
  sendHoloStress: (level: number) => void;
  /** Round 12 — flip one of the 5 GIS bench layers (L1…L5). Ordering of the
   *  replacement Set follows GIS_LAYERS so HUD chips and scene groups agree. */
  toggleGisLayer: (id: GisLayerId) => void;
  /** Task 11-b — select a node in the inspector (null = dismiss: clears pin too —
   *  an explicit close always wins over the pin). */
  setInspectNode: (nodeId: string | null) => void;
  /** Task 11-b — flip the pin (sticky mode: while on, the selection survives
   *  route switches; reselecting another node keeps the pin). */
  toggleInspectPin: () => void;
}

export const useVvuSocketStore = create<VvuSocketState & VvuSocketActions>((set, get) => ({
  socket: null,
  connected: false,
  frame: null,
  history: null,
  wormChain: [],
  fsmLog: [],
  fsmError: null,
  snapshotArrived: false,
  inspectNodeId: null,
  inspectPinned: false,
  gisLayers: ALL_GIS_LAYERS,
  holoFrame: null,
  holoHistory: [],

  sendHoloStress: (level) => {
    get().socket?.emit('holo-stress', { level });
  },
  toggleGisLayer: (id) => {
    const prev = get().gisLayers;
    const next = new Set<GisLayerId>(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    // rebuild in spec order (L1…L5) for stable display + cheap diffs
    const ordered = new Set<GisLayerId>(GIS_LAYERS.map((l) => l.id).filter((x) => next.has(x)));
    set({ gisLayers: ordered });
  },

  setInspectNode: (nodeId) => {
    if (nodeId === null) set({ inspectNodeId: null, inspectPinned: false });
    else set({ inspectNodeId: nodeId });
  },
  toggleInspectPin: () => {
    set((s) => ({ inspectPinned: !s.inspectPinned }));
  },

  sendFsmCommand: (cmd) => {
    get().socket?.emit('cmd', { type: cmd });
  },
  sendWormLog: (event, source, details) => {
    get().socket?.emit('worm-log', { event, source, details });
  },
  setSimSpeed: (mult) => {
    get().socket?.emit('sim-speed', { multiplier: mult });
  },
  requestSnapshot: () => {
    get().socket?.emit('request-snapshot');
  },
  simSkip: (gate) => {
    get().socket?.emit('sim-skip', { gate });
  },
}));

let bootstrapped = false;

/** Mount once (in Providers) — creates the singleton socket connection. */
export function useVvuSocketBootstrap() {
  useEffect(() => {
    if (bootstrapped) return;
    bootstrapped = true;

    // NEVER hardcode the port — the gateway needs XTransformPort in the query.
    const socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    const store = useVvuSocketStore;
    store.setState({ socket });

    socket.on('connect', () => store.setState({ connected: true, fsmError: null }));
    socket.on('disconnect', () => store.setState({ connected: false }));

    socket.on('snapshot', (snap: SimSnapshot) => {
      store.setState({
        frame: snap.frame,
        history: snap.history,
        wormChain: snap.wormChain,
        fsmLog: snap.fsmLog,
        snapshotArrived: true,
      });
    });

    socket.on('telemetry', (frame: TelemetryFrame) => {
      store.setState({ frame, fsmError: null });
    });

    socket.on('history', (history: HistoryBuffer) => {
      store.setState({ history });
    });

    socket.on('worm', (evt: WormSimEvent) => {
      const chain = store.getState().wormChain;
      store.setState({ wormChain: [...chain.slice(-79), evt] });
    });

    socket.on('fsm', (entry: FsmLogEntry) => {
      const log = store.getState().fsmLog;
      store.setState({ fsmLog: [...log.slice(-39), entry] });
    });

    socket.on('fsm-error', (err: { message: string }) => {
      store.setState({ fsmError: err.message });
    });

    // Round 19 — HOLOCOM cross-layer metrics frames (3s cadence). Keep the
    // latest frame + a 40-frame tail for the §6 QoS prediction surrogate.
    socket.on('holo', (frame: HoloFrame) => {
      const tail = store.getState().holoHistory;
      store.setState({ holoFrame: frame, holoHistory: [...tail.slice(-39), frame] });
    });

    return () => {
      // socket lives for the app lifetime; do not disconnect on unmount.
    };
  }, []);
}

// Convenience selectors
export const useFrame = () => useVvuSocketStore((s) => s.frame);
export const useFsmState = (): FsmState | null => useVvuSocketStore((s) => s.frame?.fsmState ?? null);
export const useConnected = () => useVvuSocketStore((s) => s.connected);
export const useWormChain = () => useVvuSocketStore((s) => s.wormChain);
export const useFsmLog = () => useVvuSocketStore((s) => s.fsmLog);
export const useHoloFrame = () => useVvuSocketStore((s) => s.holoFrame);
export const useHoloHistory = () => useVvuSocketStore((s) => s.holoHistory);
export const useSendHoloStress = () => useVvuSocketStore((s) => s.sendHoloStress);

// Stable action selectors — pick individually to keep referential identity.
export const useSendFsmCommand = () => useVvuSocketStore((s) => s.sendFsmCommand);
export const useSendWormLog = () => useVvuSocketStore((s) => s.sendWormLog);
export const useSetSimSpeed = () => useVvuSocketStore((s) => s.setSimSpeed);
export const useRequestSnapshot = () => useVvuSocketStore((s) => s.requestSnapshot);
export const useSimSkip = () => useVvuSocketStore((s) => s.simSkip);
export const useSetInspectNode = () => useVvuSocketStore((s) => s.setInspectNode);
export const useToggleInspectPin = () => useVvuSocketStore((s) => s.toggleInspectPin);
export const useGisLayers = () => useVvuSocketStore((s) => s.gisLayers);
export const useToggleGisLayer = () => useVvuSocketStore((s) => s.toggleGisLayer);
