// VVU persistent store factory — zustand + localStorage + append-only log.
// Each environment gets its own store instance keyed like `bench.vvu.v1`.
import { create } from "zustand";

export interface LogEntry {
  type: string;
  time: number;
  detail: string;
}

const LOG_CAP = 200;

function loadState<T>(key: string, initial: () => T): T {
  if (typeof window === "undefined") return initial();
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return { ...(initial() as object), ...(parsed.d ?? parsed) } as T;
      }
    }
  } catch {
    /* ignore */
  }
  return initial();
}

function loadLog(key: string): LogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.log)) return parsed.log as LogEntry[];
    }
  } catch {
    /* ignore */
  }
  return [];
}

function saveState(key: string, d: unknown, log: LogEntry[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify({ d, log }));
  } catch {
    /* quota */
  }
}

function cloneSafe<T>(o: T): T {
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(o);
    } catch {
      /* fallthrough */
    }
  }
  return JSON.parse(JSON.stringify(o)) as T;
}

// Generic persistent store hook. `d` is the data object; `log` is append-only.
export function makeStore<T extends object>(key: string, initial: () => T) {
  type Shape = {
    d: T;
    log: LogEntry[];
    set: (fn: (draft: T) => void) => void;
    commit: (type: string, detail: string, fn?: (draft: T) => void) => void;
    reset: () => void;
  };

  const store = create<Shape>((set) => ({
    d: loadState(key, initial),
    log: loadLog(key),
    set: (fn) => {
      set((s) => {
        const draft = cloneSafe(s.d);
        fn(draft);
        saveState(key, draft, s.log);
        return { d: draft };
      });
    },
    commit: (type, detail, fn) => {
      set((s) => {
        const draft = cloneSafe(s.d);
        if (fn) fn(draft);
        const entry: LogEntry = { type, time: Date.now(), detail };
        const log = [entry, ...s.log].slice(0, LOG_CAP);
        saveState(key, draft, log);
        return { d: draft, log };
      });
    },
    reset: () => {
      const fresh = initial();
      const entry: LogEntry = {
        type: "system",
        time: Date.now(),
        detail: "store reset to initial state",
      };
      set({ d: fresh, log: [entry] });
      saveState(key, fresh, [entry]);
    },
  }));

  return store;
}

export function count<T>(arr: T[] | undefined | null): number {
  return Array.isArray(arr) ? arr.length : 0;
}
