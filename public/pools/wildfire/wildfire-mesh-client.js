/* ==========================================================================
   pools/wildfire/wildfire-mesh-client.js — the bridge to the mesh.
   ==========================================================================
   Role (8-file contract, file 4): talks to the field-onboard service
   (:3005) — the two-gate-handshaked source (QR nonce gate → device
   keypair binding gate) — and exposes what it ACTUALLY serves:

     · bridge:status snapshots over WebSocket (live inventory + the
       SHA-256 receipts chain of the pairing rail)
     · the consent-gated member roster (UNIFIED_CONSENT_MODEL.md format)

   ZERO DEPS: this is a hand-rolled engine.io v4 + socket.io v4 client on
   the NATIVE WebSocket API — no library, no CDN, no build step. The wire
   conversation it speaks:

       open  ws /?EIO=4&transport=websocket&XTransformPort=3005   (gateway
             contract — port in the query, never in the host)
       ←     0{"sid":…}            engine.io OPEN
       →     40                     socket.io namespace CONNECT
       ←     40{"sid":…}            socket.io CONNECT ack
       ←     42["bridge:status",{…}] the events we read
       ←     2   →  3               engine.io PING → PONG (stay alive)

   Honesty rules (contract §"What this contract refuses to do"):
     · A member who has not granted wildfire.emergency.mesh renders
       ABSENT, never dimmed. Consent ≠ battery level.
     · Node POSITIONS are the roster's registered home locations
       (CACHED) — live GPS is the pipeline engine's named next artifact,
       and this client forces exactly that interface.
     · No fabricating mesh density. If the bridge is unreachable the
       panel says OFFLINE — it never invents devices.
     · file:// (USB stick) with the network unplugged is a first-class
       state: OFFLINE, honestly labelled.
   ========================================================================== */

(function (global) {
  'use strict';

  var BRIDGE_PORT = 3005;
  var POLL_INTERVAL_MS = 12000;
  var WS_RETRY_BASE_MS = 2000;
  var WS_RETRY_MAX_MS = 30000;

  var phase = 'offline';          /* live | polling | offline | disabled */
  var status = null;             /* latest bridge:status payload */
  var lastSeenTs = null;
  var lastError = null;
  var ws = null;
  var pollTimer = null;
  var retryTimer = null;
  var retryDelay = WS_RETRY_BASE_MS;
  var listeners = [];

  /* ── roster (consent-gated — UNIFIED_CONSENT_MODEL.md record format) ───── */

  function iso(offsetMs) { return new Date(Date.now() + (offsetMs || 0)).toISOString(); }

  /* next LOCAL midnight — the model's `daily` auto-renew boundary */
  function nextLocalMidnight() {
    var d = new Date();
    var m = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
    return m;
  }

  function dailyConsent(id) {
    return {
      event_type: 'consent.granted',
      grantor_type: 'owner',
      grantor_devid: 'ed25519:' + id.replace('member_', 'g').padEnd(8, '0') + '…',
      device_id: 'ed25519:' + id.replace('member_', 'd').padEnd(8, '0') + '…',
      channels: ['gps', 'accelerometer'],
      pipeline_id: 'wildfire.emergency.mesh',
      granted_at: iso(0),
      expires_at: nextLocalMidnight().toISOString(),
      scope: 'daily',
      status: 'granted',
      seed: true,
    };
  }

  var ROSTER = [
    /* 10 members, owner-granted, daily scope (auto-renews at local midnight) */
    { id: 'member_01', label: 'MKHIZE H.',     x: -30,  y: 80,   consent: dailyConsent('member_01') },
    { id: 'member_02', label: 'VAN WYK D.',    x: 20,   y: 120,  consent: dailyConsent('member_02') },
    { id: 'member_03', label: 'ABRAHAMSE M.',  x: 70,   y: 60,   consent: dailyConsent('member_03') },
    { id: 'member_04', label: 'SITHOLE N.',    x: 120,  y: 140,  consent: dailyConsent('member_04') },
    { id: 'member_05', label: 'FOURIE K.',     x: -80,  y: 150,  consent: dailyConsent('member_05') },
    { id: 'member_06', label: 'DAMONS L.',     x: 160,  y: -60,  consent: dailyConsent('member_06') },
    { id: 'member_08', label: 'WILLIAMS R.',   x: 200,  y: -110, consent: dailyConsent('member_08') },
    { id: 'member_10', label: 'JOSEPHS P.',    x: -60,  y: -20,  consent: dailyConsent('member_10') },
    { id: 'member_11', label: 'CEZULA T.',     x: 30,   y: -50,  consent: dailyConsent('member_11') },
    { id: 'member_12', label: 'BROOKS G.',     x: -120, y: 40,   consent: dailyConsent('member_12') },
    /* member_07 — session scope, 90-second window: the EXPIRY path is
       visible and testable without waiting half an hour (granted at boot,
       lapses 90s in, node goes ABSENT — never dimmed — ledger says EXPIRED) */
    { id: 'member_09', label: 'ADAMS F.',      x: 90,   y: 100,  consent: (function () {
        var c = dailyConsent('member_09');
        c.scope = 'session';
        c.expires_at = iso(90 * 1000);
        return c;
      })() },
    /* member_07 — REVOKED mid-event (member request — the path is visible:
       consent.revoked record + node ABSENT from the map) */
    { id: 'member_07', label: 'PETERS A.',     x: 10,   y: 160,  consent: {
        event_type: 'consent.revoked',
        grantor_type: 'owner',
        grantor_devid: 'ed25519:g0000007…',
        device_id: 'ed25519:d0000007…',
        channels: ['gps', 'accelerometer'],
        pipeline_id: 'wildfire.emergency.mesh',
        granted_at: iso(-52 * 60 * 1000),
        revoked_at: iso(-6 * 60 * 1000),
        scope: 'session',
        status: 'revoked',
        revoke_reason: 'member request — two sentences in the app, tap to stop',
        seed: true,
      } },
    /* member_13 — NO GRANT. Consent is not assumed. ABSENT, never dimmed. */
    { id: 'member_13', label: 'NDLOVU S.',     x: 240,  y: 30,   consent: null },
  ];

  /* municipal sensors — admin-scope consent (the network admin declared
     the sensor VLAN scope; per-device opt-out honoured) */
  var SENSORS = [
    { id: 'wind_ridge_01',  label: 'WIND · RIDGE',   x: -150, y: -140, kind: 'sensor' },
    { id: 'temp_hum_02',    label: 'TEMP/RH',       x: -60,  y: -110,  kind: 'sensor' },
    { id: 'cam_ridge_03',   label: 'CAM · RIDGE',    x: -100, y: -170, kind: 'sensor' },
    { id: 'pm25_04',        label: 'PM2.5',          x: 40,   y: -90,  kind: 'sensor' },
    { id: 'rain_05',        label: 'RAIN',           x: 180,  y: 40,   kind: 'sensor' },
    { id: 'wind_cbd_06',    label: 'WIND · CBD',     x: 230,  y: -30,  kind: 'sensor' },
  ];
  var ADMIN_SCOPE = {
    event_type: 'admin.scope.declared',
    grantor_type: 'admin',
    scope: 'sensor VLAN 10 (municipal environmental)',
    pipeline_id: 'wildfire.emergency.mesh',
    declared_at: iso(0),
    seed: true,
  };

  /* ── consent evaluation (windows are enforced, not decorative) ────────── */

  function evalConsent(member, nowMs) {
    var c = member.consent;
    if (!c) return 'absent';                                   /* no grant */
    if (c.status === 'revoked') return 'revoked';              /* permanent */
    if (c.status === 'expired') return 'expired';              /* lapsed earlier */
    var exp = Date.parse(c.expires_at);
    if (!isNaN(exp) && nowMs > exp) {
      if (c.scope === 'daily') {
        /* the model: daily auto-renews at local midnight */
        c.expires_at = nextLocalMidnight().toISOString();
        c.renewed_at = iso(0);
        journal('consent.renewed', JSON.stringify({
          device_id: c.device_id, pipeline_id: c.pipeline_id, scope: 'daily',
        }), 'SYSTEM');
        return 'granted';
      }
      c.status = 'expired';
      journal('consent.expired', JSON.stringify({
        device_id: c.device_id, pipeline_id: c.pipeline_id,
        expired_at: c.expires_at, note: 'window lapsed — re-grant is member-side only',
      }), 'SYSTEM');
      return 'expired';
    }
    return 'granted';
  }

  function evaluate() {
    var nowMs = Date.now();
    ROSTER.forEach(function (m) { m._state = evalConsent(m, nowMs); });
  }

  /* the renderable set — CONSENTED ONLY. Absent means absent. */
  function nodes() {
    return ROSTER.filter(function (m) { return m._state === 'granted'; });
  }

  function ledger() {
    return ROSTER.map(function (m) {
      return {
        id: m.id, label: m.label,
        state: m._state,
        consent: m.consent,
      };
    });
  }

  /* ── the bridge origin (gateway contract / file:// honesty) ────────────── */

  function bridgeBase() {
    /* http(s): same-origin gateway — port in the QUERY, never the host */
    if (location.protocol === 'http:' || location.protocol === 'https:') return '';
    /* file:// (USB stick): an explicit ?bridge=http://host:port overrides;
       without it there is no honest bridge origin — OFFLINE by design */
    var q = new URLSearchParams(location.search).get('bridge');
    return q ? q.replace(/\/+$/, '') : null;
  }

  function wsUrl(base) {
    var t = Date.now() + '-' + Math.random().toString(36).slice(2);
    if (base === null) return null;
    if (base) return base.replace(/^http/, 'ws') + '/?EIO=4&transport=websocket&t=' + t + '&XTransformPort=' + BRIDGE_PORT;
    var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return proto + '//' + location.host + '/?EIO=4&transport=websocket&t=' + t + '&XTransformPort=' + BRIDGE_PORT;
  }

  function httpUrl(base) {
    return (base || '') + '/?XTransformPort=' + BRIDGE_PORT;
  }

  /* ── engine.io v4 / socket.io v4 over the NATIVE WebSocket ────────────── */

  function connectWs() {
    var base = bridgeBase();
    var url = wsUrl(base);
    if (!url) {
      phase = 'disabled';
      lastError = 'file:// without ?bridge= — no bridge origin (offline by design)';
      notify();
      return;
    }
    try { ws = new WebSocket(url); }
    catch (e) { scheduleWsRetry(); return; }

    /* watchdog — if the socket.io CONNECT ack never lands, close + retry */
    var watchdog = setTimeout(function () {
      if (phase !== 'live') { try { ws.close(); } catch (e2) { /* noop */ } }
    }, 6000);

    ws.onmessage = function (ev) {
      var m = ev.data;
      if (typeof m !== 'string' || m === '') return;
      var k = m.charAt(0);
      if (k === '0') {                       /* engine.io OPEN */
        ws.send('40');                       /* socket.io namespace CONNECT */
        return;
      }
      if (k === '2') { ws.send('3'); return; }  /* PING → PONG */
      if (k === '3') return;                    /* PONG (server's) */
      if (m.indexOf('40') === 0) {              /* socket.io CONNECT ack */
        clearTimeout(watchdog);
        phase = 'live';
        lastError = null;
        lastSeenTs = Date.now();
        stopPolling();
        notify();
        return;
      }
      if (m.indexOf('42') === 0) {              /* socket.io EVENT */
        try {
          var pair = JSON.parse(m.slice(2));
          if (pair[0] === 'bridge:status') handleStatus(pair[1]);
        } catch (e) { /* malformed frame — ignore, never crash the view */ }
        return;
      }
      if (k === '41' || m.indexOf('44') === 0) { /* disconnect / connect_error */
        teardownWs();
        scheduleWsRetry();
      }
    };

    ws.onopen = function () { /* handshake arrives as the '0' packet */ };

    ws.onerror = function () { lastError = 'websocket error'; };

    ws.onclose = function () {
      clearTimeout(watchdog);
      teardownWs();
      if (phase === 'live') { phase = 'offline'; notify(); }
      scheduleWsRetry();
    };
  }

  function teardownWs() {
    if (ws) {
      ws.onmessage = ws.onopen = ws.onerror = ws.onclose = null;
      try { ws.close(); } catch (e) { /* already closing */ }
      ws = null;
    }
  }

  function scheduleWsRetry() {
    if (retryTimer) return;
    retryTimer = setTimeout(function () {
      retryTimer = null;
      retryDelay = Math.min(retryDelay * 2, WS_RETRY_MAX_MS);
      startPollingIfHttpWorks();           /* probe the cheaper path meanwhile */
      connectWs();
    }, retryDelay);
  }

  /* ── HTTP fallback (the landing endpoint serves the same snapshot) ─────── */

  function startPollingIfHttpWorks() {
    if (pollTimer) return;
    var base = bridgeBase();
    if (base === null) return;
    fetch(httpUrl(base), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        if (phase !== 'live') {
          phase = 'polling';
          handleStatus(j);
          pollTimer = setInterval(function () {
            fetch(httpUrl(bridgeBase()), { cache: 'no-store' })
              .then(function (r) { return r.json(); })
              .then(function (j2) { if (phase !== 'live') handleStatus(j2); })
              .catch(function () { /* one missed poll — keep last-known */ });
          }, POLL_INTERVAL_MS);
        }
      })
      .catch(function () { /* offline — WS retry will try again */ });
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  function handleStatus(j) {
    status = j;
    lastSeenTs = Date.now();
    notify();
  }

  /* ── journal bridge (state + consent events are WORM events) ───────────── */

  function journal(event, details, actor) {
    var j = global.WildfireEvidence;
    if (j && typeof j.append === 'function') j.append(event, details, actor);
  }

  /* ── snapshot + subscribe ───────────────────────────────────────────────── */

  function snapshot() {
    evaluate();
    var granted = nodes();
    return {
      phase: phase,
      transport: phase === 'live' ? 'websocket' : (phase === 'polling' ? 'http' : null),
      status: status,
      lastSeenTs: lastSeenTs,
      lastError: lastError,
      roster: {
        total: ROSTER.length,
        granted: granted.length,
        revoked: ROSTER.filter(function (m) { return m._state === 'revoked'; }).length,
        expired: ROSTER.filter(function (m) { return m._state === 'expired'; }).length,
        absent: ROSTER.filter(function (m) { return m._state === 'absent'; }).length,
      },
      nodes: granted.map(function (m) {
        return { id: m.id, label: m.label, x: m.x, y: m.y, kind: 'member' };
      }),
      sensors: SENSORS.slice(),
      adminScope: ADMIN_SCOPE,
      ledger: ledger(),
    };
  }

  function notify() {
    var snap = snapshot();
    listeners.slice().forEach(function (fn) {
      try { fn(snap); } catch (e) { /* a broken listener never breaks the bridge */ }
    });
  }

  /* ── init ────────────────────────────────────────────────────────────────── */

  function init() {
    evaluate();
    var j = global.WildfireEvidence;
    /* first boot of a fresh journal: seed the roster baseline as WORM events
       (seed-tagged — historical, not live grants). Reloads do NOT re-seed. */
    if (j && j.isFresh && j.isFresh()) {
      journal('mesh.roster.baseline', JSON.stringify({
        members: ROSTER.length, granted: nodes().length,
        revoked: 1, no_grant: 1, sensors: SENSORS.length,
        admin_scope: ADMIN_SCOPE.scope,
        positions: 'ROSTER-CACHED (registered home locations — live GPS is the pipeline engine\u2019s named next artifact)',
        seed: true,
      }), 'SEED');
      ROSTER.forEach(function (m) {
        var c = m.consent;
        if (c && c.status === 'granted') {
          journal('consent.granted', JSON.stringify(c), 'SEED');
        } else if (c && c.status === 'revoked') {
          journal('consent.revoked', JSON.stringify(c), 'SEED');
        }
      });
      journal('admin.scope.declared', JSON.stringify(ADMIN_SCOPE), 'SEED');
    }

    connectWs();

    /* consent windows are live constraints — re-evaluate + notify at 1Hz */
    setInterval(function () {
      var before = JSON.stringify(ledger().map(function (r) { return r.state; }));
      evaluate();
      var after = JSON.stringify(ledger().map(function (r) { return r.state; }));
      if (before !== after) notify();
    }, 1000);

    return snapshot();
  }

  global.WildfireMesh = {
    init: init,
    snapshot: snapshot,
    subscribe: function (fn) {
      listeners.push(fn);
      return function () {
        var i = listeners.indexOf(fn);
        if (i !== -1) listeners.splice(i, 1);
      };
    },
    reconnect: function () {           /* called by the page on 'online' */
      retryDelay = WS_RETRY_BASE_MS;
      teardownWs();
      if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
      stopPolling();
      connectWs();
    },
  };
})(window);
