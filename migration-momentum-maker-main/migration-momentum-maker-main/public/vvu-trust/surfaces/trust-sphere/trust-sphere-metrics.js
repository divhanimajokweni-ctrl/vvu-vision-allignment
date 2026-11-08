/* trust-sphere-metrics.js — Task 47 · the Trust Sphere metrics surface.
 *
 * THE ONE-LINE SUMMARY (spec §"The one-line summary"):
 *   A metrics surface is only honest if every number carries its source and
 *   every missing number renders as missing.
 *
 * FIVE panels, no sixth:
 *   1 NETWORK HEALTH  — weighted composite of 2–5. Weights are READ from the
 *                       #metrics-config JSON island in trust-sphere.html
 *                       (never hard-coded here). If ANY sub-panel is missing,
 *                       the composite is — . No partial numbers, ever.
 *   2 SLA · 72H        — GET /api/vvu/rails. Last-known value may be shown
 *                       marked STALE (amber) when older than 60s; a fetch
 *                       that never returned renders — .
 *   3 TRUSTED NODES    — window.TrustSphereState (client-side; the sphere
 *                       owns it). Three DISJOINT tiers whose sum must be
 *                       ≤ total; a mismatch renders red, never reconciled.
 *   4 DEVICE MESH      — :3005 devices via /api/vvu/rails. Rail down →
 *                       OFFLINE in red. Never a cached number.
 *   5 HEALTH TREND ·1H — in-memory ring buffer (24h, one sample/minute).
 *                       Under one hour of samples → INSUFFICIENT DATA.
 *                       Never interpolated: null samples are gaps.
 *
 * DISCIPLINE:
 *   · every fetch has a 2.5s timeout (config island)
 *   · fetch failures are silent to the user, logged to console
 *   · no spinners — a panel either has a number or it has —
 *   · the source line is always present, always 9pt, always at the bottom
 *   · the sphere is never recoloured by the metrics
 */

(function () {
  "use strict";

  var PANEL_ROOT_ID = "metrics-panel";
  var CONFIG_ID = "metrics-config";

  /* ── config (from the JSON island — the only place weights live) ── */
  var config = {
    poll_interval_ms: 15000,
    fetch_timeout_ms: 2500,
    sla_stale_after_ms: 60000,
    composite_weights: {},
  };
  try {
    var island = document.getElementById(CONFIG_ID);
    if (island) {
      var parsed = JSON.parse(island.textContent);
      if (parsed && typeof parsed === "object") {
        config.poll_interval_ms = parsed.poll_interval_ms || config.poll_interval_ms;
        config.fetch_timeout_ms = parsed.fetch_timeout_ms || config.fetch_timeout_ms;
        config.sla_stale_after_ms = parsed.sla_stale_after_ms || config.sla_stale_after_ms;
        if (parsed.composite_weights) config.composite_weights = parsed.composite_weights;
      }
    }
  } catch (err) {
    console.warn("[trust-sphere-metrics] config island unreadable — using defaults:", err);
  }

  /* ── tiny helpers ── */
  function $(id) {
    return document.getElementById(id);
  }
  function hhmmss(iso) {
    try {
      return new Date(iso).toLocaleTimeString("en-GB", { hour12: false });
    } catch (e) {
      return "—";
    }
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  /* ════════════════════════════════════════════════════════════════════
     PANEL STATE — everything the renderer needs, with honest nulls
     ════════════════════════════════════════════════════════════════════ */

  var panel = {
    rails: null, // last GOOD /api/vvu/rails response (or null)
    railsAt: 0, // when it arrived (ms)
    railsError: null, // last fetch failure string (console-logged)
    buffer: [], // ring buffer of {t, v|null} — one per minute, ≤1440
    bootedAt: Date.now(),
  };

  /* the sub-scores the composite consumes (null = missing — never guessed) */
  function subScores() {
    var fresh = Date.now() - panel.railsAt <= config.sla_stale_after_ms;
    var slaScore = null,
      meshScore = null,
      nodesScore = null,
      trendScore = null;

    if (panel.rails && fresh) {
      var sla = panel.rails.sla;
      if (sla && sla.measuredPct !== null && !sla.insufficient) slaScore = sla.measuredPct;
      var dev = panel.rails.devices;
      if (dev && !dev.offline) {
        if (dev.paired === null || dev.active === null) meshScore = null;
        else if (dev.paired === 0) meshScore = 100;
         /* rail UP, zero devices
           promised — nothing to degrade. Documented in the .md. */
        else meshScore = Math.round((dev.active / dev.paired) * 100);
      }
    }

    var s = window.TrustSphereState;
    if (s && s.total > 0) {
      var t = s.tiers;
      nodesScore = Math.round(((t.identity + t.verified + t.trusted) / s.total) * 100);
    }

    var oneHourAgo = sampleAt(panel.bootedAt, Date.now() - 60 * 60 * 1000);
    if (oneHourAgo !== null && oneHourAgo !== undefined && currentComposite() !== null) {
      trendScore = Math.max(0, Math.min(100, 50 + (currentComposite() - oneHourAgo) * 10));
    }

    return { sla: slaScore, nodes: nodesScore, mesh: meshScore, trend: trendScore };
  }

  function currentComposite() {
    var last = null;
    for (var i = panel.buffer.length - 1; i >= 0; i--) {
      if (panel.buffer[i].v !== null) {
        last = panel.buffer[i].v;
        break;
      }
    }
    return last;
  }

  /* the newest sample at-or-before `at` (null gap = no sample, undefined = none exist) */
  function sampleAt(boot, at) {
    if (at < boot) return undefined;
    var idx = Math.floor((at - boot) / 60000);
    if (idx < 0 || idx >= panel.buffer.length) return undefined;
    return panel.buffer[idx].v;
  }

  /* ════════════════════════════════════════════════════════════════════
     CARD BUILDERS — five cards, source line on every one
     ════════════════════════════════════════════════════════════════════ */

  var root = $(PANEL_ROOT_ID);
  if (!root) {
    console.warn("[trust-sphere-metrics] #metrics-panel missing — surface not rendered");
    return;
  }

  function card(id, title) {
    var c = el("section", "m-card");
    c.id = "m-card-" + id;
    var h = el("div", "m-title");
    h.appendChild(el("span", null, title));
    var badge = el("span", "m-badge");
    badge.id = "m-badge-" + id;
    badge.style.display = "none";
    h.appendChild(badge);
    c.appendChild(h);
    var big = el("div", "m-big missing", "—");
    big.id = "m-big-" + id;
    c.appendChild(big);
    var body = el("div");
    body.id = "m-body-" + id;
    c.appendChild(body);
    var src = el("div", "m-source");
    src.id = "m-src-" + id;
    src.textContent = "source: —";
    c.appendChild(src);
    root.appendChild(c);
    return c;
  }

  function badge(id, cls, text) {
    var b = $("m-badge-" + id);
    if (!b) return;
    if (!text) {
      b.style.display = "none";
      return;
    }
    b.style.display = "inline-block";
    b.className = "m-badge " + cls;
    b.textContent = text;
  }

  function setBig(id, text, cls) {
    var b = $("m-big-" + id);
    if (!b) return;
    b.textContent = text;
    b.className = "m-big" + (cls ? " " + cls : "");
  }

  function setSrc(id, html) {
    var s = $("m-src-" + id);
    if (s) s.innerHTML = html;
  }

  card("health", "NETWORK HEALTH");
  card("sla", "SLA · 72H");
  card("nodes", "TRUSTED NODES");
  card("mesh", "DEVICE MESH");
  card("trend", "HEALTH TREND · 1H");

  /* health body: rail pills + weights disclosure */
  (function () {
    var body = $("m-body-health");
    var rails = el("div", "m-rails");
    rails.id = "m-rails-health";
    body.appendChild(rails);
    var w = el("div", "m-weights");
    w.id = "m-weights-health";
    body.appendChild(w);
  })();

  /* sla body: sub-line */
  (function () {
    var body = $("m-body-sla");
    var sub = el("div", "m-sub");
    sub.id = "m-sub-sla";
    body.appendChild(sub);
  })();

  /* nodes body: three small numbers side by side */
  (function () {
    var body = $("m-body-nodes");
    var tri = el("div", "m-triple");
    ["identity", "verified", "trusted"].forEach(function (k) {
      var cell = el("div", "m-cell");
      var n = el("div", "n", "—");
      n.id = "m-nodes-" + k;
      var l = el("div", "l", k);
      cell.appendChild(n);
      cell.appendChild(l);
      tri.appendChild(cell);
    });
    body.appendChild(tri);
    var sub = el("div", "m-sub");
    sub.id = "m-sub-nodes";
    body.appendChild(sub);
  })();

  /* mesh body: triple + note */
  (function () {
    var body = $("m-body-mesh");
    var tri = el("div", "m-triple");
    ["paired", "active", "stale"].forEach(function (k) {
      var cell = el("div", "m-cell");
      var n = el("div", "n", "—");
      n.id = "m-mesh-" + k;
      var l = el("div", "l", k);
      cell.appendChild(n);
      cell.appendChild(l);
      tri.appendChild(cell);
    });
    body.appendChild(tri);
    var sub = el("div", "m-sub");
    sub.id = "m-sub-mesh";
    body.appendChild(sub);
  })();

  /* trend body: sparkline */
  (function () {
    var body = $("m-body-trend");
    var spark = document.createElement("canvas");
    spark.id = "m-spark-trend";
    spark.className = "m-spark";
    spark.setAttribute("role", "img");
    spark.setAttribute("aria-label", "Health trend sparkline, last 24 hours");
    body.appendChild(spark);
    var sub = el("div", "m-sub");
    sub.id = "m-sub-trend";
    body.appendChild(sub);
  })();

  /* ════════════════════════════════════════════════════════════════════
     FETCH — one endpoint, 2.5s timeout, silent failure (console only)
     ════════════════════════════════════════════════════════════════════ */

  function fetchRails() {
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (ctrl) ctrl.abort();
    }, config.fetch_timeout_ms);
    return fetch("/api/vvu/rails", { cache: "no-store", signal: ctrl ? ctrl.signal : undefined })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .finally(function () {
        clearTimeout(timer);
      });
  }

  /* ════════════════════════════════════════════════════════════════════
     RENDER — every number carries its source; missing renders as missing
     ════════════════════════════════════════════════════════════════════ */

  function render() {
    var fresh = Date.now() - panel.railsAt <= config.sla_stale_after_ms;

    /* ── Panel 2 · SLA ── */
    if (panel.rails && fresh) {
      var sla = panel.rails.sla;
      if (sla && sla.measuredPct !== null && !sla.insufficient) {
        setBig("sla", sla.measuredPct.toFixed(2) + "%");
        setSrc(
          "sla",
          "source: /api/vvu/rails · last check: " +
            hhmmss(panel.rails.generatedAt) +
            " · window since " +
            (sla.since ? hhmmss(sla.since) : "—"),
        );
      } else {
        setBig("sla", "—", "missing");
        setSrc(
          "sla",
          "source: /api/vvu/rails · last check: " +
            hhmmss(panel.rails.generatedAt) +
            " · insufficient sweeps",
        );
      }
      badge("sla", "", "");
      $("m-sub-sla").innerHTML =
        "target: <b>" +
        sla.targetPct.toFixed(2) +
        "%</b>" +
        '<span class="sep"> · </span>window: <b>72h</b>' +
        '<span class="sep"> · </span>breaches: <b>' +
        sla.breaches +
        "</b>" +
        '<span class="sep"> · </span>sweeps: <b>' +
        sla.sweeps +
        "</b>";
    } else if (panel.rails && !fresh) {
      /* stale — the value is SHOWN, marked, and timestamped (never hidden) */
      var slaS = panel.rails.sla;
      var val =
        slaS && slaS.measuredPct !== null && !slaS.insufficient
          ? slaS.measuredPct.toFixed(2) + "%"
          : "—";
      setBig("sla", val, "warn");
      badge("sla", "stale", "STALE");
      setSrc(
        "sla",
        "source: /api/vvu/rails · last check: " +
          hhmmss(panel.rails.generatedAt) +
          " · STALE &gt; " +
          Math.round(config.sla_stale_after_ms / 1000) +
          "s",
      );
    } else {
      setBig("sla", "—", "missing");
      badge("sla", "", "");
      setSrc(
        "sla",
        "source: /api/vvu/rails · no response within " + config.fetch_timeout_ms / 1000 + "s",
      );
      $("m-sub-sla").innerHTML =
        'target: <b>99.50%</b><span class="sep"> · </span>window: <b>72h</b><span class="sep"> · </span>breaches: <b>—</b>';
    }

    /* ── Panel 3 · Trusted Nodes (client-side — the sphere's own state) ── */
    var s = window.TrustSphereState;
    if (s && s.total > 0) {
      var t = s.tiers;
      var sum = t.identity + t.verified + t.trusted;
      if (sum <= s.total) {
        setBig("nodes", String(t.trusted));
        $("m-nodes-identity").textContent = String(t.identity);
        $("m-nodes-verified").textContent = String(t.verified);
        $("m-nodes-trusted").textContent = String(t.trusted);
        badge("nodes", "", "");
        $("m-sub-nodes").innerHTML =
          "unknown: <b>" +
          s.byState.unknown +
          "</b>" +
          '<span class="sep"> · </span>total: <b>' +
          s.total +
          "</b>" +
          '<span class="sep"> · </span>tier sum: <b>' +
          sum +
          "</b> ≤ <b>" +
          s.total +
          "</b>";
      } else {
        /* the surface is broken — SAY SO, never reconcile */
        setBig("nodes", "MISMATCH", "bad");
        badge("nodes", "mismatch", "SUM > TOTAL");
        $("m-nodes-identity").textContent = String(t.identity);
        $("m-nodes-verified").textContent = String(t.verified);
        $("m-nodes-trusted").textContent = String(t.trusted);
        $("m-sub-nodes").innerHTML =
          "tier sum <b>" +
          sum +
          "</b> exceeds total <b>" +
          s.total +
          "</b> — broken, not reconciled";
      }
      setSrc(
        "nodes",
        "source: trust-sphere node state · scope: " +
          (s.scope || "—").toUpperCase() +
          " · " +
          (s.sim ? "SIMULATED CLOCK · SEED DATA" : "live"),
      );
    } else {
      setBig("nodes", "—", "missing");
      setSrc("nodes", "source: trust-sphere node state · not available");
      $("m-sub-nodes").textContent = "";
    }

    /* ── Panel 4 · Device Mesh ── */
    if (panel.rails && fresh) {
      var dev = panel.rails.devices;
      if (dev.offline) {
        setBig("mesh", "OFFLINE", "bad");
        badge("mesh", "offline", ":3005 DOWN");
        $("m-mesh-paired").textContent = "—";
        $("m-mesh-active").textContent = "—";
        $("m-mesh-stale").textContent = "—";
        $("m-sub-mesh").textContent = "";
      } else {
        setBig("mesh", String(dev.active === null ? "—" : dev.active));
        $("m-mesh-paired").textContent = dev.paired === null ? "—" : String(dev.paired);
        $("m-mesh-active").textContent = dev.active === null ? "—" : String(dev.active);
        $("m-mesh-stale").textContent = dev.stale === null ? "—" : String(dev.stale);
        badge("mesh", "", "");
        $("m-sub-mesh").innerHTML =
          "agent: <b>" +
          (dev.agentOnline ? "LIVE" : "NONE") +
          "</b>" +
          '<span class="sep"> · </span>rail: <b>UP</b>';
      }
      setSrc(
        "mesh",
        "source: /api/vvu/rails (:3005) · devices · last check: " + hhmmss(panel.rails.generatedAt),
      );
    } else {
      setBig("mesh", "—", "missing");
      badge("mesh", "", "");
      $("m-mesh-paired").textContent = "—";
      $("m-mesh-active").textContent = "—";
      $("m-mesh-stale").textContent = "—";
      $("m-sub-mesh").textContent = "";
      setSrc("mesh", "source: /api/vvu/rails (:3005) · devices · no response");
    }

    /* ── Panel 5 · Trend (in-memory ring buffer) ── */
    var ageMs = Date.now() - panel.bootedAt;
    var oneHour = sampleAt(panel.bootedAt, Date.now() - 60 * 60 * 1000);
    var cur = currentComposite();
    if (ageMs < 60 * 60 * 1000 || oneHour === undefined || oneHour === null || cur === null) {
      setBig("trend", "INSUFFICIENT DATA", "missing");
      badge("trend", "insufficient", "<1H");
      $("m-sub-trend").innerHTML =
        "running: <b>" +
        Math.floor(ageMs / 60000) +
        "m</b>" +
        '<span class="sep"> · </span>need: <b>1h</b><span class="sep"> · </span>samples: <b>' +
        panel.buffer.length +
        "</b>";
      setSrc("trend", "source: in-memory ring buffer (24h) · never interpolated");
    } else {
      var delta = cur - oneHour;
      var arrow = delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
      var sign = delta > 0 ? "+" : "";
      setBig("trend", arrow + " " + sign + delta, delta < 0 ? "warn" : "");
      badge("trend", "", "");
      $("m-sub-trend").innerHTML =
        "delta 1h: <b>" +
        sign +
        delta +
        "</b>" +
        '<span class="sep"> · </span>now: <b>' +
        cur +
        "</b>" +
        '<span class="sep"> · </span>samples: <b>' +
        panel.buffer.length +
        "</b>";
      setSrc(
        "trend",
        "source: in-memory ring buffer (24h) · " + Math.floor(ageMs / 60000) + "m of data",
      );
    }
    drawSpark();

    /* ── Panel 1 · NETWORK HEALTH (composite — last, it consumes the rest) ── */
    var sc = subScores();
    var w = config.composite_weights;
    var wsum = (w.sla || 0) + (w.nodes || 0) + (w.mesh || 0) + (w.trend || 0);
    var haveAll = sc.sla !== null && sc.nodes !== null && sc.mesh !== null && sc.trend !== null;
    if (haveAll && wsum > 0) {
      var composite = Math.round(
        sc.sla * (w.sla / wsum) +
          sc.nodes * (w.nodes / wsum) +
          sc.mesh * (w.mesh / wsum) +
          sc.trend * (w.trend / wsum),
      );
      setBig("health", String(composite));
      setSrc(
        "health",
        "source: composite · weights sla " +
          (w.sla / wsum).toFixed(2) +
          " / nodes " +
          (w.nodes / wsum).toFixed(2) +
          " / mesh " +
          (w.mesh / wsum).toFixed(2) +
          " / trend " +
          (w.trend / wsum).toFixed(2) +
          " — from #metrics-config",
      );
    } else {
      /* any sub-panel missing → the composite is — . No partial number. */
      setBig("health", "—", "missing");
      var missing = [];
      if (sc.sla === null) missing.push("sla");
      if (sc.nodes === null) missing.push("nodes");
      if (sc.mesh === null) missing.push("mesh");
      if (sc.trend === null) missing.push("trend");
      setSrc(
        "health",
        "source: composite · not computed — missing: " +
          (missing.join(", ") || "—") +
          " (a partial number would be a lie)",
      );
    }
    /* rail pills — honest per-rail up/down from the same fetch */
    var railEl = $("m-rails-health");
    if (panel.rails && fresh && panel.rails.rails) {
      railEl.innerHTML = "";
      panel.rails.rails.forEach(function (r) {
        var pill = el(
          "span",
          "m-rail " + (r.ok ? "up" : "down"),
          ":" + r.port + (r.ok ? " UP " + r.latencyMs + "MS" : " DOWN"),
        );
        railEl.appendChild(pill);
      });
    } else {
      railEl.innerHTML = '<span class="m-rail">rails: —</span>';
    }
    $("m-weights-health").textContent =
      "subs — sla " +
      (sc.sla === null ? "—" : sc.sla) +
      " · nodes " +
      (sc.nodes === null ? "—" : sc.nodes) +
      " · mesh " +
      (sc.mesh === null ? "—" : sc.mesh) +
      " · trend " +
      (sc.trend === null ? "—" : sc.trend);
  }

  /* ── sparkline — 24px tall, full width, gaps where samples are null ── */
  function drawSpark() {
    var c = $("m-spark-trend");
    if (!c) return;
    var dpr = window.devicePixelRatio || 1;
    var w = Math.max(2, Math.floor((c.clientWidth || 240) * dpr));
    var h = Math.max(2, Math.floor(24 * dpr));
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    var g = c.getContext("2d");
    g.clearRect(0, 0, w, h);
    /* baseline */
    g.strokeStyle = "rgba(107,138,64,0.25)";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, h - 1);
    g.lineTo(w, h - 1);
    g.stroke();
    if (panel.buffer.length < 2) {
      g.fillStyle = "rgba(122,138,110,0.9)";
      g.font = Math.floor(7 * dpr) + "px monospace";
      g.fillText("NO SAMPLES YET", 4 * dpr, h / 2 + 2 * dpr);
      return;
    }
    var max = 100,
      min = 0; /* the composite is a 0–100 by construction */
    var span = Math.max(1, panel.buffer.length);
    var px = function (i) {
      return (i / (span - 1)) * (w - 2 * dpr) + dpr;
    };
    var py = function (v) {
      return h - dpr - ((v - min) / (max - min)) * (h - 3 * dpr);
    };
    g.strokeStyle = "#c8ff00";
    g.lineWidth = Math.max(1, dpr * 0.9);
    g.beginPath();
    var drawing = false;
    for (var i = 0; i < span; i++) {
      var v = panel.buffer[i] ? panel.buffer[i].v : null;
      if (v === null || v === undefined) {
        drawing = false;
        continue;
      } /* gap — never interpolate */
      if (!drawing) {
        g.moveTo(px(i), py(v));
        drawing = true;
      } else g.lineTo(px(i), py(v));
    }
    g.stroke();
  }

  /* ════════════════════════════════════════════════════════════════════
     LOOPS — poll every 15s; sample the buffer once per minute
     ════════════════════════════════════════════════════════════════════ */

  function poll() {
    fetchRails()
      .then(function (data) {
        panel.rails = data;
        panel.railsAt = Date.now();
        panel.railsError = null;
        render();
      })
      .catch(function (err) {
        /* silent to the user — the panels already say — / STALE honestly.
           The failure IS logged: discipline, not hiding. */
        panel.railsError = err && err.message ? err.message : String(err);
        console.warn("[trust-sphere-metrics] /api/vvu/rails fetch failed:", panel.railsError);
        render();
      });
  }

  function tickBuffer() {
    var now = Date.now();
    var idx = Math.floor((now - panel.bootedAt) / 60000);
    while (panel.buffer.length < idx) {
      /* a missed minute is an honest null gap, never back-filled */
      panel.buffer.push({ t: panel.bootedAt + panel.buffer.length * 60000, v: null });
    }
    if (panel.buffer.length === idx) {
      panel.buffer.push({ t: now, v: currentCompositeForSample() });
    }
    if (panel.buffer.length > 1440) panel.buffer = panel.buffer.slice(-1440); /* 24h ring */
    render();
  }

  /* what the buffer samples: the composite AT THIS MINUTE (null when it
     cannot be computed — a gap, not a guess) */
  function currentCompositeForSample() {
    var sc = subScores();
    var w = config.composite_weights;
    var wsum = (w.sla || 0) + (w.nodes || 0) + (w.mesh || 0) + (w.trend || 0);
    if (sc.sla === null || sc.nodes === null || sc.mesh === null || sc.trend === null || wsum <= 0)
      return null;
    return Math.round(
      sc.sla * (w.sla / wsum) +
        sc.nodes * (w.nodes / wsum) +
        sc.mesh * (w.mesh / wsum) +
        sc.trend * (w.trend / wsum),
    );
  }

  window.addEventListener("resize", drawSpark);

  poll();
  render();
  setInterval(poll, config.poll_interval_ms);
  setInterval(tickBuffer, 5000); /* checks the minute boundary; samples once/min */
})();
