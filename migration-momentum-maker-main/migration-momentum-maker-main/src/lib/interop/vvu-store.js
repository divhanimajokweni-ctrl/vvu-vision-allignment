/* VVU INTEROP STORE — one database PER environment: "vvu.<env>.interop".
   Holds only what crosses a boundary: received artefacts, status transitions, rejections, outbox.
   It never touches an environment's own working store. Usable from a page, a Worker, and Node (memory fallback).
   Immutability: artefacts, transitions and rejections are append-only. A second write with different content is refused. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VVUStore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var IMMUTABLE = { artefacts: 1, transitions: 1, rejections: 1 };
  var KINDS = ['artefacts', 'transitions', 'rejections', 'outbox', 'keys', 'meta'];

  function wrap(req) {
    return new Promise(function (res, rej) { req.onsuccess = function () { res(req.result); }; req.onerror = function () { rej(req.error); }; });
  }

  function create(env, opts) {
    opts = opts || {};
    if (['forge', 'bench', 'fire', 'field', 'press'].indexOf(env) < 0) throw new Error('store needs one of the five environments');
    var name = 'vvu.' + env + '.interop';
    var idbf = opts.indexedDB || (typeof indexedDB !== 'undefined' ? indexedDB : null);
    var mem = new Map(), db = null, backend = 'memory';

    function k(kind, key) { return kind + '\u0000' + key; }
    function check(kind) { if (KINDS.indexOf(kind) < 0) throw new Error('unknown kind ' + kind); }

    var api = {
      name: name,
      backend: function () { return backend; },
      open: function () {
        if (!idbf) return Promise.resolve(api);
        return new Promise(function (res) {
          var r;
          try { r = idbf.open(name, 1); } catch (e) { return res(api); }
          r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
          r.onsuccess = function () { db = r.result; backend = 'indexeddb'; res(api); };
          r.onerror = function () { res(api); };       /* private mode / blocked: stay on memory, and say so via backend() */
          r.onblocked = function () { res(api); };
        });
      },
      get: function (kind, key) {
        check(kind);
        if (!db) return Promise.resolve(mem.has(k(kind, key)) ? mem.get(k(kind, key)) : null);
        return wrap(db.transaction('kv').objectStore('kv').get(k(kind, key))).then(function (v) { return v === undefined ? null : v; });
      },
      put: function (kind, key, value) {
        check(kind);
        var text = JSON.stringify(value);
        return api.get(kind, key).then(function (prev) {
          if (prev !== null && IMMUTABLE[kind]) {
            if (JSON.stringify(prev) === text) return { stored: false, unchanged: true };
            throw new Error('immutable: ' + kind + '/' + key + ' already exists with different content');
          }
          var copy = JSON.parse(text);
          if (!db) { mem.set(k(kind, key), copy); return { stored: true }; }
          return wrap(db.transaction('kv', 'readwrite').objectStore('kv').put(copy, k(kind, key))).then(function () { return { stored: true }; });
        });
      },
      list: function (kind) {
        check(kind);
        var prefix = kind + '\u0000';
        if (!db) {
          var out = [];
          mem.forEach(function (v, key) { if (key.indexOf(prefix) === 0) out.push({ key: key.slice(prefix.length), value: v }); });
          return Promise.resolve(out.sort(function (a, b) { return a.key < b.key ? -1 : 1; }));
        }
        return new Promise(function (res, rej) {
          var out = [], c = db.transaction('kv').objectStore('kv').openCursor(IDBKeyRange.bound(prefix, prefix + '\uffff'));
          c.onsuccess = function () { var cur = c.result; if (!cur) return res(out); out.push({ key: cur.key.slice(prefix.length), value: cur.value }); cur.continue(); };
          c.onerror = function () { rej(c.error); };
        });
      },
      /* the only write path for received artefacts: stores the frozen envelope and its transitions together */
      commitReceipt: function (result, rawEnvelope) {
        var jobs = [];
        if (result.finalStatus === 'INTEGRITY_VALID' && result.artefact) {
          jobs.push(api.put('artefacts', result.artefact.artefact_id, result.artefact));
        } else {
          jobs.push(api.put('rejections', (result.artefact_id || 'unidentified') + '@' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
            { artefact_id: result.artefact_id, reason_code: result.reason_code, detail: result.rejection && result.rejection.detail, at: new Date().toISOString(), raw_digest: rawEnvelope && rawEnvelope.integrity && rawEnvelope.integrity.digest || null }));
        }
        result.transitions.forEach(function (tr, i) {
          var id = (tr.artefact_id || (tr.record && tr.record.artefact_id) || (tr.content && tr.content.artefact_id));
          jobs.push(api.put('transitions', id + '#' + String(Date.now()) + '-' + String(i).padStart(3, '0') + '-' + Math.random().toString(36).slice(2, 6), tr));
        });
        return Promise.all(jobs);
      },
      knownDigests: function () {
        return api.list('artefacts').then(function (rows) { var m = {}; rows.forEach(function (r) { m[r.key] = r.value.integrity.digest; }); return m; });
      },
      history: function (artefactId) {
        return api.list('transitions').then(function (rows) {
          return rows.filter(function (r) { return r.key.indexOf(artefactId + '#') === 0; }).map(function (r) { return r.value; });
        });
      }
    };
    return api;
  }
  return { create: create, KINDS: KINDS };
});
