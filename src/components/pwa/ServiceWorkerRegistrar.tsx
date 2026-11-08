'use client';

// src/components/pwa/ServiceWorkerRegistrar.tsx — R54 (the install path;
// succeeds src/components/pwa-register.tsx from Task 43-g, same semantics,
// canonical home under src/components/pwa/), upgraded R63.
//
// Registers /sw.js (the offline shell + twin-scenario cache +
// /_next/static build assets) on first load. DEV-SERVER HONESTY: the SW is
// network-first for the whole app shell, so hot reloads are never served
// stale; only the identity assets, the single-file twin scenario are
// cache-first (that scenario is offline BY DESIGN — a cached copy is the
// demo, not stale state). Registration is passive: installability comes
// from the manifest + icons and the InstallButton drives the UX.
//
// R63 — the stale-chunk lesson, made structural:
//   · sw.js now fetches build assets with cache:'no-store' (the browser
//     HTTP cache was the stale link that survived reloads AND server
//     restarts in R62 — dev chunk URLs are reused across recompiles);
//   · when a NEW worker arrives (updatefound / a waiting worker), the
//     operator gets a toast with a RELOAD action instead of silently
//     running old code until a coincidence;
//   · swStatus() / swReset() expose the worker's message API so the estate
//     watchdog's self-integrity section can show version + cache contents
//     and offer a one-click self-heal (RESET PWA CACHE).
//
// Renders nothing.

import { useEffect } from 'react';
import { toast } from 'sonner';

export interface SwStatus {
  version: string;
  caches: { name: string; entries: number }[];
}

/** Ask the controlling worker what it holds. Null = no SW (or no controller yet). */
export function swStatus(): Promise<SwStatus | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return Promise.resolve(null);
  if (!navigator.serviceWorker.controller) return Promise.resolve(null);
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = (e) => {
      resolve(e.data?.type === 'VVU_SW_STATUS' ? (e.data as SwStatus) : null);
    };
    // postMessage to the controller directly — getRegistration + worker
    // would race the very first claim on cold load.
    navigator.serviceWorker.controller!.postMessage('VVU_SW_STATUS', [ch.port2]);
    // a worker that never answers must not hang the UI forever
    setTimeout(() => resolve(null), 3000);
  });
}

/** Wipe every SW cache and re-prime the precache. Returns what was cleared. */
export function swReset(): Promise<{ cleared: string[]; primed: number; version?: string } | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return Promise.resolve(null);
  if (!navigator.serviceWorker.controller) return Promise.resolve(null);
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = (e) => {
      resolve(e.data?.type === 'VVU_SW_RESET'
        ? { cleared: e.data.cleared ?? [], primed: e.data.primed ?? 0, version: e.data.version }
        : null);
    };
    navigator.serviceWorker.controller!.postMessage('VVU_SW_RESET', [ch.port2]);
    setTimeout(() => resolve(null), 5000);
  });
}

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    // localhost counts as a secure context; guard anyway for exotic hosts —
    // a plain-HTTP LAN IP cannot register a SW, and the InstallButton's
    // instruction sheet states that plainly rather than failing silently.
    if (!window.isSecureContext) return;

    // A waiting worker means a newer shell is downloaded but not shown —
    // never leave the operator running old code in silence.
    const announceWaiting = (reg: ServiceWorkerRegistration) => {
      if (!reg.waiting) return;
      if (!navigator.serviceWorker.controller) return; // first install, not an update
      toast('PWA SHELL UPDATED', {
        description: `a newer dashboard shell (${reg.waiting.scriptURL.split('/').pop() ?? 'sw.js'}) is ready — reload to apply`,
        action: { label: 'RELOAD', onClick: () => window.location.reload() },
        duration: 15000,
      });
    };

    const register = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          announceWaiting(reg);
          reg.addEventListener('updatefound', () => {
            const nw = reg.installing;
            nw?.addEventListener('statechange', () => {
              if (nw.state === 'installed' && navigator.serviceWorker.controller) announceWaiting(reg);
            });
          });
        })
        .catch(() => { /* registration failure is non-fatal — the dashboard works without the SW */ });
    };

    if (document.readyState === 'complete') register();
    else {
      window.addEventListener('load', register, { once: true });
      return () => window.removeEventListener('load', register);
    }
  }, []);
  return null;
}

export default ServiceWorkerRegistrar;
