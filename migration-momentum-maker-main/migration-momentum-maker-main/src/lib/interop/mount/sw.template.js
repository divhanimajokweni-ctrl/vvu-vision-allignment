/* VVU SUB-APP SERVICE WORKER TEMPLATE. Build replaces __ENV__, __VERSION__, __SHELL__.
   Registered at /<env>/sw.js with scope /<env>/. A longer scope wins over a root worker, so a root shell worker
   never intercepts a sub-app and a sub-app worker never intercepts the root.
   Rules: cache only this app's own shell; never touch another environment's caches; never cache or answer
   package traffic (it is local, via BroadcastChannel/postMessage, and never goes through fetch). */
var ENV = '__ENV__', VERSION = '__VERSION__', SHELL = __SHELL__;
var PREFIX = 'vvu.' + ENV + '.shell.', CACHE = PREFIX + VERSION;
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf(PREFIX) === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('message', function (e) { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;   /* leave everything else alone */
  e.respondWith(caches.match(req).then(function (hit) { return hit || fetch(req); }));  /* cache-first: works with no network */
});
