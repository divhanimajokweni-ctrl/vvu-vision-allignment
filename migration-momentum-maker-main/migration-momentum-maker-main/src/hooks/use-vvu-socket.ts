// src/hooks/use-vvu-socket.ts — in-app telemetry feed (former socket.io client).
//
// The source deployment connected to a standalone telemetry mini-service on
// port 3003 over socket.io. Here the same simulation runs inside the app
// (src/lib/vvu-sim.ts) and its events flow straight into this Zustand store.
// The store shape and the exported selectors/actions are unchanged for the
// dashboard components.

import { useEffect } from "react";
import { create } from "zustand";
import { ALL_GIS_LAYERS, GIS_LAYERS, type GisLayerId } from "@/lib/vvu-gis";
import {
  startVvuSim,
  onVvuEvent,
  sendVvuCommand,
  sendVvuWormLog,
  setVvuSimSpeed,
  requestVvuSnapshot,
  vvuSimSkip,
  sendVvuHoloStress,
} from "@/lib/vvu-sim";
import type {
  EnvWeather,
  FsmCommand,
  FsmLogEntry,
  FsmState,
  HistoryBuffer,
  HoloFrame,
  SimSnapshot,
  TelemetryFrame,
  WormSimEvent,
} from "@/types/vvu";

interface VvuSocketState {
  connected: boolean;
  frame: TelemetryFrame | null;
  history: HistoryBuffer | null;
  wormChain: WormSimEvent[];
  fsmLog: FsmLogEntry[];
  fsmError: string | null;
  snapshotArrived: boolean;
  /** Latest reading from the estate's weather node (feeds the env scene). */
  envWeather: EnvWeather | null;
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
  /** Round 19 — latest HOLOCOM cross-layer metrics frame (3s cadence) + a
   *  rolling tail of frame MTP/loss history for the QoS prediction surrogate. */
  holoFrame: HoloFrame | null;
  holoHistory: HoloFrame[];
}

interface VvuSocketActions {
  sendFsmCommand: (cmd: FsmCommand) => void;
  sendWormLog: (event: string, source: string, details: string) => void;
  setSimSpeed: (mult: number) => void;
  requestSnapshot: () => void;
  /** Demo fast-path: jump the business sim to a gate's condition (3A/3B/3C) or reset the demo state. */
  simSkip: (gate: "3A" | "3B" | "3C" | "RESET_DEMO") => void;
  /** Round 19 — flip one of the 4 HoloCom channel-stress levels. */
  sendHoloStress: (level: number) => void;
  /** Round 12 — flip one of the 5 GIS bench layers (L1…L5). */
  toggleGisLayer: (id: GisLayerId) => void;
  /** Task 11-b — select a node in the inspector. */
  setInspectNode: (nodeId: string | null) => void;
  /** Task 11-b — flip the pin (sticky mode). */
  toggleInspectPin: () => void;
}

export const useVvuSocketStore = create<VvuSocketState & VvuSocketActions>((set, get) => ({
  connected: false,
  frame: null,
  history: null,
  wormChain: [],
  fsmLog: [],
  fsmError: null,
  snapshotArrived: false,
  envWeather: null,
  inspectNodeId: null,
  inspectPinned: false,
  gisLayers: ALL_GIS_LAYERS,
  holoFrame: null,
  holoHistory: [],

  sendHoloStress: (level) => {
    sendVvuHoloStress(level);
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
    sendVvuCommand(cmd);
  },
  sendWormLog: (event, source, details) => {
    sendVvuWormLog(event, source, details);
  },
  setSimSpeed: (mult) => {
    setVvuSimSpeed(mult);
  },
  requestSnapshot: () => {
    requestVvuSnapshot();
  },
  simSkip: (gate) => {
    vvuSimSkip(gate);
  },
}));

let bootstrapped = false;

/** Mount once — starts the in-app simulation and wires its events. */
export function useVvuSocketBootstrap() {
  useEffect(() => {
    if (bootstrapped) return;
    bootstrapped = true;

    const store = useVvuSocketStore;
    const off = onVvuEvent((e) => {
      switch (e.type) {
        case "snapshot":
          store.setState({
            connected: true,
            frame: e.snap.frame,
            history: e.snap.history,
            wormChain: e.snap.wormChain,
            fsmLog: e.snap.fsmLog,
            snapshotArrived: true,
            fsmError: null,
          });
          break;
        case "telemetry":
          store.setState({ frame: e.frame, fsmError: null });
          break;
        case "history":
          store.setState({ history: e.history });
          break;
        case "worm": {
          const chain = store.getState().wormChain;
          store.setState({ wormChain: [...chain.slice(-79), e.evt] });
          break;
        }
        case "fsm": {
          const log = store.getState().fsmLog;
          store.setState({ fsmLog: [...log.slice(-39), e.entry] });
          break;
        }
        case "fsm-error":
          store.setState({ fsmError: e.message });
          break;
        case "holo": {
          const tail = store.getState().holoHistory;
          store.setState({ holoFrame: e.frame, holoHistory: [...tail.slice(-39), e.frame] });
          break;
        }
        case "env-weather":
          store.setState({ envWeather: e.weather });
          break;
      }
    });

    startVvuSim();

    return () => {
      // the sim lives for the page lifetime; keep the subscription.
      void off;
    };
  }, []);
}

// Convenience selectors
export const useFrame = () => useVvuSocketStore((s) => s.frame);
export const useFsmState = (): FsmState | null =>
  useVvuSocketStore((s) => s.frame?.fsmState ?? null);
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
