"use client";
// VVU cross-tab sync — uses BroadcastChannel to sync store changes between
// browser tabs. When tab A commits a change, tab B re-reads its localStorage
// and refreshes the zustand store. No mini-service needed.
import React, { useEffect, useState } from "react";
import { useBench } from "./envs/bench/store";
import { useField } from "./envs/field/store";
import { useFire } from "./envs/fire/store";
import { useForge } from "./envs/forge/store";
import { usePress } from "./envs/press/store";
import { useNotif } from "./notifications";

const CHANNEL = "vvu-console-sync";
const STORE_KEYS = ["bench.vvu.v1", "field.vvu.v1", "fire.vvu.v1", "forge.vvu.v1", "press.vvu.v1"];

let channel: BroadcastChannel | null = null;
let hooked = false;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (!channel) {
    try { channel = new BroadcastChannel(CHANNEL); } catch { return null; }
  }
  return channel;
}

// Call this on boot. It hooks each store's commit() so that every commit
// broadcasts a message to other tabs. It also listens for incoming messages
// and re-reads the affected store from localStorage.
export function initCrossTabSync() {
  if (hooked || typeof window === "undefined") return;
  hooked = true;
  const ch = getChannel();
  if (!ch) return;

  // listen for incoming sync messages
  ch.onmessage = (ev: MessageEvent) => {
    const { key } = ev.data || {};
    if (!key || !STORE_KEYS.includes(key)) return;
    // re-read the store from localStorage and replace the zustand state
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const d = parsed.d ?? parsed;
      const log = parsed.log ?? [];
      if (key === "bench.vvu.v1") useBench.setState({ d: { ...useBench.getState().d, ...d }, log });
      if (key === "field.vvu.v1") useField.setState({ d: { ...useField.getState().d, ...d }, log });
      if (key === "fire.vvu.v1") useFire.setState({ d: { ...useFire.getState().d, ...d }, log });
      if (key === "forge.vvu.v1") useForge.setState({ d: { ...useForge.getState().d, ...d }, log });
      if (key === "press.vvu.v1") usePress.setState({ d: { ...usePress.getState().d, ...d }, log });
      // show a notification
      useNotif.getState().captureToast(`↻ synced from another tab · ${key.split(".")[0]}`, "info");
    } catch {}
  };

  // hook each store's commit to broadcast
  const hookStore = (store: any, key: string) => {
    const origCommit = store.getState().commit;
    store.setState({
      commit: (type: string, detail: string, fn?: any) => {
        origCommit(type, detail, fn);
        // broadcast after the commit persists to localStorage
        setTimeout(() => { try { ch.postMessage({ key, type, detail, ts: Date.now() }); } catch {} }, 0);
      },
    });
  };
  hookStore(useBench, "bench.vvu.v1");
  hookStore(useField, "field.vvu.v1");
  hookStore(useFire, "fire.vvu.v1");
  hookStore(useForge, "forge.vvu.v1");
  hookStore(usePress, "press.vvu.v1");
}

// ---- Cross-tab presence indicator ----
// Uses BroadcastChannel ping/pong to detect how many tabs are open.
const PRESENCE_CHANNEL = "vvu-console-presence";
const tabId = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
let presenceChannel: BroadcastChannel | null = null;
const knownTabs = new Map<string, number>(); // tabId → lastSeen timestamp

function getPresenceChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (!presenceChannel) {
    try { presenceChannel = new BroadcastChannel(PRESENCE_CHANNEL); } catch { return null; }
  }
  return presenceChannel;
}

export function startPresenceMonitor() {
  if (typeof window === "undefined") return;
  const ch = getPresenceChannel();
  if (!ch) return;

  // announce ourselves
  ch.postMessage({ type: "ping", tabId, ts: Date.now() });

  // listen for pings + pongs
  ch.onmessage = (ev: MessageEvent) => {
    const msg = ev.data;
    if (!msg || !msg.tabId) return;
    if (msg.type === "ping" || msg.type === "pong") {
      knownTabs.set(msg.tabId, msg.ts);
      // respond to pings with a pong
      if (msg.type === "ping" && msg.tabId !== tabId) {
        ch.postMessage({ type: "pong", tabId, ts: Date.now() });
      }
    }
  };

  // periodic ping + prune stale tabs (older than 10s)
  setInterval(() => {
    ch.postMessage({ type: "ping", tabId, ts: Date.now() });
    const now = Date.now();
    for (const [id, ts] of knownTabs) {
      if (now - ts > 10000) knownTabs.delete(id);
    }
  }, 4000);

  // cleanup on unload
  window.addEventListener("beforeunload", () => {
    ch.postMessage({ type: "leave", tabId, ts: Date.now() });
  });
}

export function useTabCount(): number {
  const [count, setCount] = useState(1);
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      let c = 1; // this tab
      for (const [, ts] of knownTabs) {
        if (now - ts < 10000) c++;
      }
      setCount(c);
    }, 2000);
    return () => clearInterval(id);
  }, []);
  return count;
}

// A small badge that shows the tab count
export function TabPresenceBadge() {
  const count = useTabCount();
  if (count <= 1) return null;
  return (
    <span className="vvu-tab-presence" title={`${count} tabs open · changes sync live via BroadcastChannel`}>
      <span className="vvu-tab-presence-dot" />
      {count} tabs
    </span>
  );
}
