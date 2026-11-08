/* ==========================================================================
   pools/wildfire/wildfire-evidence.js — the 9pt evidence rail + local WORM journal.
   ==========================================================================
   Role (8-file contract, file 7): the evidence layer of the surface.

     · The journal is REAL, not illustrative: a SHA-256 hash-chained,
       append-only event log (the same canonical form as the :3004/:3005
       receipt rails — [seq, ts, actor, event, details, prevHash]).
     · Where the browser supports Ed25519 in WebCrypto (a browser built-in,
       NOT a dependency), every event is also SIGNED with a local-software
       key and the tier line reads
            T0 · LOCAL_SOFTWARE_ED25519_VERIFIED
       Where it does not, the tier line says so honestly:
            T0 · LOCAL_SOFTWARE · SHA-256 CHAIN · UNSIGNED
       The tier is never hidden. If someone running a higher node sees the
       view, the rail reports what THIS journal actually is.
     · Persistence: localStorage (USB-stick file:// included). A corrupt
       chain at load is archived — never silently dropped — and a
       journal.corrupt.detected event starts the fresh chain.
     · Every claim on the page must carry an evidence reference ([E#seq])
       or be labelled UNVERIFIED. This file is where those references point.

   Zero deps. Classic script. Exposes window.WildfireEvidence.
   ========================================================================== */

(function (global) {
  "use strict";

  var STORE_KEY = "pools.wildfire.journal.v1";
  var KEY_STORE = "pools.wildfire.journal.key.v1";
  var GENESIS_PREV = "GENESIS-WINTER-POOLS-WILDFIRE-20260920-0000000000000000";

  var events = []; /* the chain (append-only) */
  var fresh = false; /* true only when THIS init created the chain */
  var ed25519 = false; /* signing actually available and proven */
  var keyPair = null;
  var keyFp = null; /* public key fingerprint (sha256, 32 hex) */
  var queue = Promise.resolve(); /* serialises appends — seq order is the chain */
  var listeners = [];

  function te(s) {
    return new TextEncoder().encode(s);
  }

  function b64(buf) {
    var u = new Uint8Array(buf),
      s = "";
    for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
    return btoa(s);
  }

  async function sha256Hex(data) {
    var digest = await crypto.subtle.digest("SHA-256", te(data));
    return hex(digest);
  }

  function hex(buf) {
    var u = new Uint8Array(buf),
      s = "";
    for (var i = 0; i < u.length; i++) s += u[i].toString(16).padStart(2, "0");
    return s;
  }

  function canonical(e) {
    return JSON.stringify([e.seq, e.ts, e.actor, e.event, e.details, e.prevHash]);
  }

  /* ---- the local-software key (WebCrypto Ed25519 — browser built-in) ---- */

  async function ensureKey() {
    if (!(global.crypto && crypto.subtle)) return;
    try {
      var stored = null;
      try {
        stored = localStorage.getItem(KEY_STORE);
      } catch (e) {
        /* private mode */
      }
      if (stored) {
        var j = JSON.parse(stored);
        keyPair = {
          privateKey: await crypto.subtle.importKey("jwk", j.priv, "Ed25519", true, ["sign"]),
          publicKey: await crypto.subtle.importKey("jwk", j.pub, "Ed25519", true, ["verify"]),
        };
      } else {
        keyPair = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);
        try {
          localStorage.setItem(
            KEY_STORE,
            JSON.stringify({
              priv: await crypto.subtle.exportKey("jwk", keyPair.privateKey),
              pub: await crypto.subtle.exportKey("jwk", keyPair.publicKey),
            }),
          );
        } catch (e) {
          /* private mode — key lives for this session only */
        }
      }
      var raw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
      keyFp = hex(await crypto.subtle.digest("SHA-256", raw)).slice(0, 32);
      /* prove the path end-to-end before claiming the tier */
      var probe = await crypto.subtle.sign(
        "Ed25519",
        keyPair.privateKey,
        te("wildfire-evidence-probe"),
      );
      ed25519 = await crypto.subtle.verify(
        "Ed25519",
        keyPair.publicKey,
        probe,
        te("wildfire-evidence-probe"),
      );
    } catch (e) {
      /* browser without WebCrypto Ed25519 → honest unsigned mode */
      ed25519 = false;
      keyPair = null;
      keyFp = null;
    }
  }

  function tier() {
    return ed25519
      ? "T0 · LOCAL_SOFTWARE_ED25519_VERIFIED"
      : "T0 · LOCAL_SOFTWARE · SHA-256 CHAIN · UNSIGNED";
  }

  /* ---- persistence (archive on corruption — never silently drop) --------- */

  function persist() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ genesis: GENESIS_PREV, tier: tier(), events: events }),
      );
    } catch (e) {
      /* private mode — chain lives for this session only */
    }
  }

  function load() {
    var raw = null;
    try {
      raw = localStorage.getItem(STORE_KEY);
    } catch (e) {
      return;
    }
    if (!raw) return;
    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      parsed = null;
    }
    if (!parsed || !Array.isArray(parsed.events)) {
      archiveCorrupt(raw);
      return;
    }
    events = parsed.events;
    /* structural sanity NOW; full hash verify is verify()'s job (async) */
    for (var i = 0; i < events.length; i++) {
      var e = events[i];
      if (
        !e ||
        typeof e.seq !== "number" ||
        typeof e.hash !== "string" ||
        (i > 0 && events[i - 1].hash !== e.prevHash)
      ) {
        archiveCorrupt(raw);
        return;
      }
    }
  }

  function archiveCorrupt(raw) {
    try {
      localStorage.setItem(STORE_KEY + ".corrupt", raw);
    } catch (e) {
      /* keep going even if the archive write fails */
    }
    events = [];
    fresh = true;
    pendingCorruptNotice = true;
  }

  var pendingCorruptNotice = false;

  /* ---- append (append-only · serialised · signed where possible) --------- */

  function append(event, details, actor) {
    queue = queue.then(function () {
      return doAppend(event, details, actor);
    });
    return queue;
  }

  async function doAppend(event, details, actor) {
    var seq = events.length + 1;
    var ts = new Date().toISOString();
    var prevHash = events.length ? events[events.length - 1].hash : GENESIS_PREV;
    var body = {
      seq: seq,
      ts: ts,
      actor: actor || "OPERATOR",
      event: event,
      details: details || "",
      prevHash: prevHash,
    };
    var canonicalStr = JSON.stringify([
      body.seq,
      body.ts,
      body.actor,
      body.event,
      body.details,
      body.prevHash,
    ]);
    body.hash = await sha256Hex(canonicalStr);
    if (ed25519 && keyPair) {
      try {
        body.sig = b64(await crypto.subtle.sign("Ed25519", keyPair.privateKey, te(canonicalStr)));
      } catch (e) {
        body.sig = null;
      } /* sign failure is honest: chain stays valid */
    }
    events.push(body);
    persist();
    notify();
    return body;
  }

  /* ---- verify (the rail's VERIFY link is real) ----------------------------- */

  async function verify() {
    var checked = 0,
      signed = 0,
      valid = true,
      reason = null;
    var prev = GENESIS_PREV;
    for (var i = 0; i < events.length; i++) {
      var e = events[i];
      if (e.prevHash !== prev) {
        valid = false;
        reason = "prevHash break at #" + e.seq;
        break;
      }
      var expect = await sha256Hex(
        JSON.stringify([e.seq, e.ts, e.actor, e.event, e.details, e.prevHash]),
      );
      if (expect !== e.hash) {
        valid = false;
        reason = "hash mismatch at #" + e.seq;
        break;
      }
      if (e.sig) {
        if (ed25519 && keyPair) {
          var ok = false;
          try {
            ok = await crypto.subtle.verify(
              "Ed25519",
              keyPair.publicKey,
              (function (s) {
                /* base64 → Uint8Array */
                var bin = atob(s),
                  u = new Uint8Array(bin.length);
                for (var k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k);
                return u;
              })(e.sig),
              te(JSON.stringify([e.seq, e.ts, e.actor, e.event, e.details, e.prevHash])),
            );
          } catch (err) {
            ok = false;
          }
          if (!ok) {
            valid = false;
            reason = "signature invalid at #" + e.seq;
            break;
          }
          signed++;
        }
      }
      prev = e.hash;
      checked++;
    }
    return {
      valid: valid,
      checked: checked,
      signed: signed,
      reason: reason,
      tier: tier(),
      keyFp: keyFp,
    };
  }

  /* ---- snapshot + subscribe -------------------------------------------------- */

  function snapshot() {
    var last = events.length ? events[events.length - 1] : null;
    return {
      count: events.length,
      head: last ? last.hash : GENESIS_PREV,
      tier: tier(),
      signed: ed25519,
      keyFp: keyFp,
      events: events.slice() /* newest last */,
    };
  }

  function notify() {
    var snap = snapshot();
    listeners.slice().forEach(function (fn) {
      try {
        fn(snap);
      } catch (e) {
        /* a broken listener never breaks the chain */
      }
    });
  }

  /* ---- init -------------------------------------------------------------------- */

  async function init() {
    await ensureKey();
    load();
    if (!events.length) {
      fresh = true;
      await doAppend(
        "journal.genesis",
        JSON.stringify({
          surface: "pools/wildfire/cape_town_wildfire.html",
          tier: tier(),
          key_fingerprint: keyFp || "unsigned-session",
          genesis_prev: GENESIS_PREV,
        }),
        "SYSTEM",
      );
      if (pendingCorruptNotice) {
        pendingCorruptNotice = false;
        await doAppend(
          "journal.corrupt.detected",
          JSON.stringify({
            action: "previous chain archived to " + STORE_KEY + ".corrupt — never silently dropped",
          }),
          "SYSTEM",
        );
      }
    }
    notify();
    return snapshot();
  }

  global.WildfireEvidence = {
    init: init,
    append: append,
    verify: verify,
    snapshot: snapshot,
    isFresh: function () {
      return fresh;
    },
    subscribe: function (fn) {
      listeners.push(fn);
      return function () {
        var i = listeners.indexOf(fn);
        if (i !== -1) listeners.splice(i, 1);
      };
    },
  };
})(window);
