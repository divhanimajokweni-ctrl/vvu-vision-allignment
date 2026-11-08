// VVU Validation Dashboard — Service Worker v1
// Network-first for HTML, cache-first for static assets, stale-while-revalidate for API.

const CACHE_VERSION = "vvu-dashboard-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;
const PAGE_CACHE = `${CACHE_VERSION}-pages`;

const STATIC_ASSETS = ["/", "/manifest.webmanifest", "/logo.svg", "/robots.txt"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => !key.startsWith(CACHE_VERSION)).map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== "GET") return;

  // Skip WebSocket upgrade
  if (request.url.startsWith("ws://") || request.url.startsWith("wss://")) return;

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) return;

  // Static assets — cache-first
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/favicon") ||
    url.pathname === "/logo.svg" ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/robots.txt"
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const fresh = await fetch(request);
          cache.put(request, fresh.clone());
          return fresh;
        } catch {
          return cached || new Response("Offline", { status: 503 });
        }
      }),
    );
    return;
  }

  // API routes — stale-while-revalidate (short cache for GET, never cache POST)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request)
          .then((fresh) => {
            // Only cache successful GET responses
            if (fresh.ok) {
              cache.put(request, fresh.clone());
            }
            return fresh;
          })
          .catch(
            () =>
              cached ||
              new Response(JSON.stringify({ ok: false, error: "offline" }), {
                status: 503,
                headers: { "content-type": "application/json" },
              }),
          );
        return cached || fetchPromise;
      }),
    );
    return;
  }

  // HTML pages — network-first, fallback to cache
  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      caches.open(PAGE_CACHE).then(async (cache) => {
        try {
          const fresh = await fetch(request);
          cache.put(request, fresh.clone());
          return fresh;
        } catch {
          const cached = await cache.match(request);
          return cached || caches.match("/");
        }
      }),
    );
    return;
  }
});

// Message handler for cache cleanup
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data === "CLEAR_CACHE") {
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => {
        event.source?.postMessage({ ok: true, msg: "cache cleared" });
      });
  }
});
