/* VVU MOUNT — sub-app side of VVU-MOUNT-2026-001. Main-agnostic.
   A sub-app works with NO host (standalone). If a host answers the handshake it also works hosted.
   The host only moves bytes. The sub-app decides what it accepts: it runs receivePackage() itself. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VVUMount = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var CHANNEL = 'vvu.bus.v1', PROTO = 1;
  var KINDS = ['hello', 'hello.ack', 'package.offer', 'package.request', 'package.deliver', 'package.result', 'keys.get', 'keys.result'];

  function attach(opts) {
    var env = opts.env, inst = opts.instance_id, state = { mode: 'standalone', host: null, keys: {} }, ch = null, pending = {};
    function send(kind, payload, to) { if (ch) ch.postMessage({ vvu: PROTO, kind: kind, from: { env: env, instance_id: inst }, to: to || null, payload: payload || {} }); }
    function nonce() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
    var api = {
      state: state,
      send: send,
      /* handshake: resolves 'hosted' or 'standalone'. Standalone is a full mode, not an error. */
      connect: function (timeoutMs) {
        if (typeof BroadcastChannel === 'undefined') return Promise.resolve(state.mode);
        ch = new BroadcastChannel(CHANNEL);
        var n = nonce();
        return new Promise(function (res) {
          var done = false;
          ch.onmessage = function (ev) {
            var m = ev.data;
            if (!m || m.vvu !== PROTO || KINDS.indexOf(m.kind) < 0) return;
            if (m.from && m.from.env === env && m.from.instance_id === inst) return;
            if (m.to && m.to.env && m.to.env !== env) return;
            if (m.kind === 'hello.ack' && m.payload && m.payload.nonce === n && !done) { done = true; state.mode = 'hosted'; state.host = m.from; res('hosted'); }
            else if (m.kind === 'package.deliver' && opts.onPackage) {
              Promise.resolve(opts.onPackage(m.payload.package, m.from)).then(function (summary) { send('package.result', { package_digest: m.payload.package && m.payload.package.package_digest, summary: summary }, m.from); });
            } else if (m.kind === 'package.request' && opts.getPackage) {
              Promise.resolve(opts.getPackage(m.payload)).then(function (pkg) { if (pkg) send('package.deliver', { package: pkg }, m.from); });
            } else if (m.kind === 'keys.result' && pending[m.payload.operator_id]) { pending[m.payload.operator_id](m.payload.public_key || null); delete pending[m.payload.operator_id]; }
          };
          send('hello', { nonce: n, supported_envelope_versions: opts.supportedVersions || ['1.0.0'] });
          setTimeout(function () { if (!done) { done = true; res('standalone'); } }, timeoutMs || 600);
        });
      },
      /* tell the host a package exists; it carries the manifest only, never the content */
      offer: function (pkg) { send('package.offer', { package_digest: pkg.package_digest, manifest: pkg.manifest, exported_by: pkg.exported_by }); },
      /* ask the host for a public key; a missing answer is "unresolved", never "valid" */
      resolveKeyAsync: function (operatorId, timeoutMs) {
        if (state.mode !== 'hosted') return Promise.resolve(null);
        return new Promise(function (res) { pending[operatorId] = res; send('keys.get', { operator_id: operatorId }, state.host); setTimeout(function () { if (pending[operatorId]) { delete pending[operatorId]; res(null); } }, timeoutMs || 1500); });
      },
      close: function () { if (ch) ch.close(); }
    };
    return api;
  }
  return { attach: attach, CHANNEL: CHANNEL, PROTO: PROTO, KINDS: KINDS };
});
