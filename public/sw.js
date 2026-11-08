// public/sw.js — Task 43-g (0x01: PWA shell not installed), upgraded R54
// (the install path: the page IS the app — every platform installs it),
// upgraded R63 (the stale-chunk lesson, finally structural).
//
// The Validation Dashboard's service worker. STRATEGY IS DELIBERATELY
// CONSERVATIVE because this app runs on a dev server with HMR:
//
//   · NETWORK-FIRST for the app shell (HTML + everything else, INCLUDING
//     /_next/static) — the live page always reflects the server when the
//     network is up, so hot reloads and API data are never served stale.
//     R54 NOTE: cache-first for /_next/static (the classic prod pattern —
//     content-hashed immutable URLs) was tried and REVERTED: on this dev
//     server, chunk URLs are reused across recompiles, so cache-first
//     served STALE BUILD CHUNKS on every reload (observed: a component
//     edit invisible after reload). /_next/static is therefore
//     network-first with a cache FALLBACK — offline the shell still boots
//     from the cached chunks, online it is always the live build;
//   · R63 NOTE (the second half of the lesson): NETWORK-FIRST IS NOT
//     ENOUGH. The worker's own fetch() defaulted to the browser HTTP
//     cache — and on this server, recompiled chunks keep their URLs while
//     their contents change, so a stale body could come back HTTP-cache-fresh
//     and the SW would happily serve it and re-prime the SW cache with it
//     (observed R62: "SUPPRESS_THRESHOLD_MILLI is not defined" surviving
//     reload AND server restart). Every internal network fetch for build
//     assets and general same-origin GETs now goes out with
//     cache:'no-store', and navigations with cache:'reload' — the HTTP
//     cache is never consulted for anything the dev server compiles.
//     Offline, the SW-cache fallback still boots the shell (unchanged);
//   · CACHE-FILL ON SUCCESS for navigations — a successful load of '/' is
//     cloned into the cache, which is what makes the OFFLINE FALLBACK real
//     (v1 never cached the shell, so an offline navigation always fell
//     through to the honest 503 text — correct, but not an offline app);
//   · CACHE-FIRST for the precached identity assets (icons, manifest,
//     this worker) and the twin scenario document (single-file, zero-dep,
//     offline BY DESIGN — the cached copy IS the offline demo);
//   · NAVIGATION FALLBACK — when a navigation fails offline, the cached
//     shell is served; if this device has never completed a load, a
//     plain-text 503 (honest — no fake offline page pretending to be the
//     app);
//   · MESSAGE API (R63) — the estate watchdog's self-integrity section can
//     ASK the worker what it holds and TELL it to wipe itself:
//       { type: 'VVU_SW_STATUS' } → { type, version, caches:[{name,entries}] }
//       { type: 'VVU_SW_RESET' }  → wipes every cache, re-primes the
//                                    precache, replies
//                                   { type, cleared:[names], primed:n }
//     The operator action behind this is how a stale-cache device heals
//     itself without devtools.
//
// The receipts/ledger rails are NEVER cached: WORM state is server truth.
// Version-stamped below; bump to invalidate every cache.

const VERSION = 'vvu-pwa-v4';
const PRECACHE = [
  '/', // the shell itself — network-first online (HMR-safe); the cached copy
       // is ONLY the offline fallback. Precaching it at install (not on the
       // first intercepted navigation, which never comes — the initial load
       // happens before this worker claims the page) is what makes the
       // offline shell real on the FIRST install, not the second visit.
  '/manifest.webmanifest',
  '/logo.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/icons/monochrome-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) =>
      Promise.allSettled(PRECACHE.map((url) => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ─── message API — status + self-reset (R63) ────────────────────────────────

async function statusReport() {
  const names = await caches.keys();
  const cachesInfo = [];
  for (const name of names) {
    const cache = await caches.open(name);
    const keys = await cache.keys();
    cachesInfo.push({ name, entries: keys.length });
  }
  return { type: 'VVU_SW_STATUS', version: VERSION, caches: cachesInfo };
}

async function resetCaches() {
  const names = await caches.keys();
  await Promise.all(names.map((k) => caches.delete(k)));
  const cache = await caches.open(VERSION);
  const results = await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
  const primed = results.filter((r) => r.status === 'fulfilled').length;
  return { type: 'VVU_SW_RESET', cleared: names, primed, version: VERSION };
}

self.addEventListener('message', (event) => {
  const reply = (payload) => {
    if (event.ports && event.ports[0]) event.ports[0].postMessage(payload);
  };
  if (event.data === 'VVU_SW_STATUS' || event.data?.type === 'VVU_SW_STATUS') {
    event.waitUntil(statusReport().then(reply));
  } else if (event.data === 'VVU_SW_RESET' || event.data?.type === 'VVU_SW_RESET') {
    event.waitUntil(resetCaches().then(reply));
  }
});

// Cache-first targets, in order: the twin scenario (offline demo artifact),
// and the precached identity assets. Build assets and everything else:
// network-first — with cache:'no-store'/'reload' so the HTTP cache is
// never the stale link in the chain.

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // never intercept writes
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // same-origin only

  // twin-scenario: cache-first (offline demo artifact)
  if (/^\/api\/vvu\/twin-scenario(\?|$)/.test(url.pathname)) {
    event.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const hit = await cache.match(req, { ignoreSearch: false });
        if (hit) return hit;
        try {
          const res = await fetch(req, { cache: 'no-store' });
          if (res.ok) cache.put(req, res.clone());
          return res;
        } catch {
          return new Response('offline — the twin scenario has not been cached on this device yet', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        }
      })
    );
    return;
  }

  // /_next/static build assets: NETWORK-FIRST with cache fallback (see
  // header — dev chunk URLs are reused across recompiles). R63: the network
  // leg is cache:'no-store' — a recompiled chunk must never be answered
  // from the browser HTTP cache, which is exactly how stale bodies
  // survived reloads in R62.
  if (url.pathname.startsWith('/_next/static')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(VERSION);
        try {
          const res = await fetch(req, { cache: 'no-store' });
          if (res.ok) cache.put(req, res.clone());
          return res;
        } catch {
          const hit = await cache.match(req);
          if (hit) return hit;
          return new Response('', { status: 504 });
        }
      })()
    );
    return;
  }

  // precached identity assets: cache-first
  if (/^\/(manifest\.webmanifest|logo\.svg|icons\/)/.test(url.pathname)) {
    event.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req, { cache: 'no-store' });
          if (res.ok) cache.put(req, res.clone());
          return res;
        } catch {
          return new Response('', { status: 503 });
        }
      })
    );
    return;
  }

  // everything else: network-first (HMR-safe), cache-fill on success for
  // navigations (the offline shell), cache fallback when the network drops.
  // R63: navigations fetch with cache:'reload' (the shell HTML is compiled
  // here too — never trust the HTTP cache for it), other same-origin GETs
  // with cache:'no-store'.
  event.respondWith(
    (async () => {
      const cache = await caches.open(VERSION);
      try {
        const res = await fetch(req, { cache: req.mode === 'navigate' ? 'reload' : 'no-store' });
        // a completed navigation of the shell is the offline ticket —
        // clone it into the cache (only ok responses; only same-origin,
        // which is guaranteed by the origin guard above)
        if (res.ok && req.mode === 'navigate') {
          cache.put(req, res.clone());
        }
        return res;
      } catch {
        if (req.mode === 'navigate') {
          const shell = await cache.match(req);
          if (shell) return shell;
          const root = await cache.match('/');
          if (root) return root;
          return new Response('VVU dashboard offline — the live shell is not cached on this device. The twin scenario and identity assets are.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        }
        const hit = await cache.match(req);
        if (hit) return hit;
        return new Response('', { status: 503 });
      }
    })()
  );
});
