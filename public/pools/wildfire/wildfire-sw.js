/* ==========================================================================
   pools/wildfire/wildfire-sw.js — the service worker for the wildfire view.
   ==========================================================================
   Role (8-file contract, file 6): caches the surface, serves it offline,
   reconciles on reconnect.

     · Primes on first load: the shell + all siblings go into the cache.
     · SERVES OFFLINE: with the network physically unplugged the view
       still boots from the cached copy — the same network-off test the
       twin passed, same sequence, same pass criterion.
     · preserve_origin: the shell is cached and replayed ONLY for
       same-origin requests — never cross-origin, never rewritten.
     · cache-first for assets (css/js/view files).
     · network-first with cache fallback for the mesh client (its logic
       updates when online; the view still boots offline).
     · Bridge traffic is NEVER intercepted: any request carrying
       XTransformPort or engine.io query params passes straight through
       to the network — no stale mesh data, no cached WORM rails.
     · On reconnect the page asks the SW to 'reconcile': every precached
       URL is re-fetched and the cache refreshed in the background.

   Same SW discipline as the app shell (public/sw.js, Task 43-g) scoped
   to /pools/wildfire/ — nested inside the app SW's scope, the MOST
   SPECIFIC registration wins for these URLs.
   ========================================================================== */

var CACHE = 'pools-wildfire-v2';

var SHELL = './cape_town_wildfire.html';
var ASSETS = [
  './wildfire-view.css',
  '../pools.css',
  './wildfire-state.js',
  './wildfire-layers.js',
  './wildfire-evidence.js',
];
var NETWORK_FIRST = [
  './wildfire-mesh-client.js',
];
var PRECACHE = [SHELL].concat(ASSETS, NETWORK_FIRST);

/* absolute pathnames for matching (cache keys resolve against the SW URL) */
var SCOPE = self.registration && self.registration.scope
  ? new URL(self.registration.scope).pathname
  : '/pools/wildfire/';

function toAbsPath(rel) {
  if (rel.slice(0, 2) === './') return SCOPE + rel.slice(2);
  if (rel.slice(0, 3) === '../') return SCOPE.replace(/[^/]+\/$/, '') + rel.slice(3);
  return rel;
}

var ABS_PRECACHE = PRECACHE.map(toAbsPath);
var ABS_NETWORK_FIRST = NETWORK_FIRST.map(toAbsPath);
var ABS_SHELL = toAbsPath(SHELL);

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) {
        /* prime everything; a failed sibling fails the install honestly */
        return cache.addAll(PRECACHE);
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* bridge / engine.io traffic detection — NEVER cache or serve these */
function isBridgeTraffic(url) {
  return url.searchParams.has('XTransformPort') ||
         url.searchParams.has('EIO') ||
         url.searchParams.has('transport') ||
         url.searchParams.has('sid');
}

function scopePath(pathname) {
  /* navigation to the scope root serves the shell */
  if (pathname === SCOPE || pathname === SCOPE.slice(0, -1)) return ABS_SHELL;
  return pathname;
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;                          /* writes: network */

  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;          /* cross-origin: passthrough */
  if (isBridgeTraffic(url)) return;                          /* bridge: network-only, never cached */

  var path = scopePath(url.pathname);
  var isNetFirst = ABS_NETWORK_FIRST.indexOf(path) !== -1;
  var isPrecachedPath = ABS_PRECACHE.indexOf(path) !== -1;
  if (!isNetFirst && !isPrecachedPath) return;               /* everything else: passthrough */

  /* shell/asset requests are matched by the canonical scope path so the
     cached copy is replayed for the SAME origin + path only (preserve_origin) */
  var cacheReq = path === url.pathname ? req : new Request(url.origin + path, { method: 'GET' });

  event.respondWith(
    isNetFirst
      ? fetch(req).then(function (res) {
          if (res && res.ok) {
            caches.open(CACHE).then(function (c) { c.put(cacheReq, res.clone()); });
          }
          return res;
        }).catch(function () {
          return caches.match(cacheReq).then(function (hit) {
            return hit || offline503();
          });
        })
      : caches.match(cacheReq).then(function (hit) {
          if (hit) return hit;
          return fetch(req).then(function (res) {
            if (res && res.ok) {
              caches.open(CACHE).then(function (c) { c.put(cacheReq, res.clone()); });
            }
            return res;
          }).catch(function () { return offline503(); });
        })
  );
});

function offline503() {
  return new Response(
    'POOLS WILDFIRE · OFFLINE — this file is not in the service-worker cache and the network is unreachable.\n',
    { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
  );
}

/* ---- reconcile: the page (on 'online') asks the SW to refresh the cache -- */

self.addEventListener('message', function (event) {
  var msg = event.data || {};
  if (msg.kind === 'reconcile') {
    event.waitUntil(
      caches.open(CACHE).then(function (cache) {
        return Promise.all(PRECACHE.map(function (rel) {
          var cacheReq = new Request(new URL(rel, self.registration.scope).href, { method: 'GET' });
          return cache.match(cacheReq).then(function (hit) {
            if (!hit) return cache.add(rel);
            return fetch(new Request(cacheReq, { cache: 'reload' })).then(function (res) {
              if (res && res.ok) return cache.put(cacheReq, res);
            }).catch(function () { /* offline still — cache stands */ });
          });
        }));
      })
    );
  }
  if (msg.kind === 'skipWaiting') self.skipWaiting();
});
