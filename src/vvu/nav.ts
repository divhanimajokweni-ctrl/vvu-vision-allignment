"use client";
// VVU navigation store — extracted to a standalone module to avoid circular imports
// (shell imports env views; env views import useNav; useNav was in shell).
import { create } from "zustand";
import { EnvId, getEnv } from "./registry";

interface NavState {
  env: EnvId;
  view: Partial<Record<EnvId, string>>;
  recent: { env: EnvId; view: string; ts: number }[];
  setEnv: (e: EnvId) => void;
  setView: (e: EnvId, v: string) => void;
  go: (e: EnvId, v?: string) => void;
  pushRecent: (e: EnvId, v: string) => void;
  hydrateFromHash: () => void;
}

function parseHash(): { env: EnvId; view?: string } | null {
  if (typeof window === "undefined") return null;
  const h = window.location.hash.replace(/^#\/?/, "");
  if (!h) return null;
  const [env, view] = h.split("/");
  const valid: EnvId[] = ["overview", "bench", "field", "fire", "forge", "press", "bridge"];
  if (!valid.includes(env as EnvId)) return null;
  return { env: env as EnvId, view: view || undefined };
}

function writeHash(env: EnvId, view?: string) {
  if (typeof window === "undefined") return;
  const h = view && view !== "default" ? `#/${env}/${view}` : `#/${env}`;
  if (window.location.hash !== h) {
    window.history.replaceState(null, "", h);
  }
}

export const useNav = create<NavState>((set, get) => ({
  env: "overview",
  view: {},
  recent: [],
  setEnv: (e) => {
    set({ env: e });
    const v = get().view[e] ?? getEnv(e)?.defaultView;
    if (e !== "overview" && e !== "bridge") writeHash(e, v);
    else if (typeof window !== "undefined" && window.location.hash) window.history.replaceState(null, "", "#/");
  },
  setView: (e, v) => {
    set((s) => ({ view: { ...s.view, [e]: v } }));
    if (e === get().env) writeHash(e, v);
  },
  go: (e, v) => {
    const target = v ?? get().view[e] ?? (e === "bridge" ? "flow" : getEnv(e)?.defaultView);
    set((s) => ({
      env: e,
      view: e === "overview" ? s.view : { ...s.view, [e]: target ?? s.view[e] },
    }));
    if (e !== "overview") {
      writeHash(e, target);
      if (target) get().pushRecent(e, target);
    } else if (typeof window !== "undefined" && window.location.hash) {
      window.history.replaceState(null, "", "#/");
    }
  },
  pushRecent: (e, v) => {
    set((s) => {
      const filtered = s.recent.filter((r) => !(r.env === e && r.view === v));
      return { recent: [{ env: e, view: v, ts: Date.now() }, ...filtered].slice(0, 6) };
    });
  },
  hydrateFromHash: () => {
    const parsed = parseHash();
    if (!parsed) return;
    if (parsed.env === "overview") { set({ env: "overview" }); return; }
    if (parsed.env === "bridge") {
      set({ env: "bridge", view: { ...get().view, bridge: "flow" } });
      return;
    }
    const mod = getEnv(parsed.env);
    if (!mod) return;
    const v = parsed.view && mod.groups.some((g) => g.items.some((i) => i.id === parsed.view))
      ? parsed.view
      : mod.defaultView;
    set((s) => ({ env: parsed.env, view: { ...s.view, [parsed.env]: v } }));
  },
}));
