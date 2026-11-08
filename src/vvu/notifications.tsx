"use client";
// VVU notifications panel — a bell icon in the topbar that opens a popover
// showing recent toasts (from the toast store) + recent log entries (from all 5 env stores).
import React from "react";
import { create } from "zustand";
import { useBench } from "./envs/bench/store";
import { useField } from "./envs/field/store";
import { useFire } from "./envs/fire/store";
import { useForge } from "./envs/forge/store";
import { usePress } from "./envs/press/store";
import { useNav } from "./nav";

interface NotifItem {
  id: string;
  env: string;
  envId: string;
  type: string; // log type OR "toast"
  time: number;
  detail: string;
  kind: "ok" | "info" | "warn" | "bad" | "mut";
}

interface NotifState {
  open: boolean;
  toasts: { id: string; msg: string; kind: string; time: number }[]; // captured toasts
  captureToast: (msg: string, kind: string) => void;
  toggle: () => void;
  set: (o: boolean) => void;
}

const KEY = "vvu-notif-seen";

export const useNotif = create<NotifState>((set, get) => ({
  open: false,
  toasts: [],
  captureToast: (msg, kind) => {
    set((s) => ({
      toasts: [{ id: `n${Date.now()}${Math.random().toString(36).slice(2,5)}`, msg, kind, time: Date.now() }, ...s.toasts].slice(0, 12),
    }));
    // bump unseen count
    if (typeof window !== "undefined") {
      const cur = parseInt(localStorage.getItem(KEY) || "0", 10);
      localStorage.setItem(KEY, String(cur + 1));
    }
  },
  toggle: () => {
    const next = !get().open;
    if (next && typeof window !== "undefined") localStorage.setItem(KEY, "0");
    set({ open: next });
  },
  set: (o) => set({ open: o }),
}));

// Hook the toast bus so every toast is captured into the notifications panel.
// (Called once on the client.)
let hooked = false;
export function hookToastCapture() {
  if (hooked || typeof window === "undefined") return;
  hooked = true;
  // We can't easily import toast() here without a cycle, so we patch the
  // toast store's push instead — wrap it.
  import("./toast").then(({ useToastStore }) => {
    const orig = useToastStore.getState().push;
    useToastStore.setState({
      push: (msg: string, kind = "info") => {
        try { useNotif.getState().captureToast(msg, kind); } catch {}
        orig(msg, kind);
      },
    });
  });
}

function loadUnseen(): number {
  if (typeof window === "undefined") return 0;
  try { return parseInt(localStorage.getItem(KEY) || "0", 10); } catch { return 0; }
}

function ago(t: number): string {
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function kindOf(t: string): "ok" | "info" | "warn" | "bad" | "mut" {
  if (/fail|tamper|reset|reject|block|error/.test(t)) return "bad";
  if (/seed|repair|verify|append|capture|publish|create|scaffold|approve|import|run|deliver|sync/.test(t)) return "ok";
  if (/export|clock|advance/.test(t)) return "info";
  return "mut";
}

export function NotificationsBell() {
  const open = useNotif((s) => s.open);
  const toggle = useNotif((s) => s.toggle);
  const set = useNotif((s) => s.set);
  const toasts = useNotif((s) => s.toasts);
  const go = useNav((s) => s.go);
  const [, tick] = React.useState(0);

  // refresh every 3s for live log entries + relative times
  React.useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 3000);
    return () => clearInterval(id);
  }, []);

  // close on Escape
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") set(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, set]);

  // build the merged notification feed
  const items: NotifItem[] = [];
  // captured toasts
  for (const t of toasts) {
    items.push({
      id: t.id, env: "TOAST", envId: "overview", type: "toast",
      time: t.time, detail: t.msg,
      kind: (t.kind === "ok" ? "ok" : t.kind === "warn" ? "warn" : t.kind === "bad" ? "bad" : t.kind === "info" ? "info" : "mut") as any,
    });
  }
  // log entries from all 5 envs
  const push = (envLabel: string, envId: string, log: any[]) => {
    for (const e of log.slice(0, 4)) {
      items.push({ id: `${envId}-${e.time}-${e.type}`, env: envLabel, envId, type: e.type, time: e.time, detail: e.detail, kind: kindOf(e.type) });
    }
  };
  try { push("BENCH", "bench", useBench.getState().log); } catch {}
  try { push("FIELD", "field", useField.getState().log); } catch {}
  try { push("FIRE", "fire", useFire.getState().log); } catch {}
  try { push("FORGE", "forge", useForge.getState().log); } catch {}
  try { push("PRESS", "press", usePress.getState().log); } catch {}
  items.sort((a, b) => b.time - a.time);
  const top = items.slice(0, 24);

  const unseen = loadUnseen();
  const hasUnread = unseen > 0;

  return (
    <div className="vvu-notif-wrap">
      <button
        className={`vvu-iconbtn vvu-notif-btn ${hasUnread ? "has-unread" : ""}`}
        onClick={toggle}
        title="notifications (recent toasts + activity log)"
        aria-label="notifications"
        aria-expanded={open}
      >
        ♦
        {hasUnread && <span className="vvu-notif-badge">{unseen > 9 ? "9+" : unseen}</span>}
      </button>
      {open && (
        <>
          <div className="vvu-notif-backdrop" onClick={() => set(false)} />
          <div className="vvu-notif-popover" role="dialog" aria-label="notifications">
            <div className="vvu-notif-head">
              <h3>NOTIFICATIONS</h3>
              <span className="vvu-notif-count">{items.length} total</span>
              <button className="vvu-notif-clear" onClick={() => set(false)} aria-label="close">×</button>
            </div>
            <div className="vvu-notif-list">
              {top.length === 0 ? (
                <div className="vvu-tempty">no activity yet — visit an environment and capture / verify / run something</div>
              ) : (
                top.map((it) => (
                  <div
                    key={it.id}
                    className={`vvu-notif-row ${it.kind}`}
                    onClick={() => { if (it.envId !== "overview") go(it.envId as any); set(false); }}
                    style={{ cursor: it.envId !== "overview" ? "pointer" : "default" }}
                  >
                    <span className="vvu-notif-dot" />
                    <div className="vvu-notif-body">
                      <div className="vvu-notif-meta">
                        <span className="env">{it.env}</span>
                        <span className="type">{it.type}</span>
                        <span className="ago">{ago(it.time)}</span>
                      </div>
                      <div className="detail">{it.detail.slice(0, 140)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="vvu-notif-foot">
              <span>toasts captured · log entries merged · click a row to jump</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
