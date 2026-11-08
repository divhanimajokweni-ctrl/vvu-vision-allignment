/* ==========================================================================
   pools/wildfire/wildfire-layers.js — the layer renderer.
   ==========================================================================
   Role (8-file contract, file 5): renders the eight layers onto the canvas,
   in the twin's own isometric discipline (same projection, same world
   space, same visible/hidden toggle contract) — the emergency view is the
   same product as the municipal twin, deliberately:

       1 FIRE POLYGON   (SIMULATED — activation follows the FSM)
       2 WIND           (SIMULATED — seed 38 km/h SE)
       3 SMOKE PLUME    (SIMULATED — only while fire is active)
       4 EVACUATION     (SIMULATED — mandatory zone gated by the FSM)
       5 MESH DENSITY   (CACHED positions · CONSENT-GATED — absent means
                         absent; heat overlay over consented nodes only)
       6 ASSETS         (SIMULATED — municipal assets + admin-scoped sensors)
       7 ENVIRONMENTAL  (SIMULATED — golden-hour sun + weather backdrop)
       8 EVIDENCE CHAIN (LIVE — the journal tail + head hash, on canvas)

   Honesty contract: every layer carries its source label in the toggle
   (LIVE / CACHED / SIMULATED / STALE) and nothing renders a layer whose
   data it does not honestly have.
   ========================================================================== */

(function (global) {
  "use strict";

  /* ── layer registry (the toggle contract) ─────────────────────────────── */

  var LAYERS = [
    { id: "fire", label: "FIRE", src: "SIMULATED", visible: true },
    { id: "wind", label: "WIND", src: "SIMULATED", visible: true },
    { id: "smoke", label: "SMOKE", src: "SIMULATED", visible: true },
    { id: "evac", label: "EVAC", src: "SIMULATED", visible: true },
    { id: "mesh", label: "MESH", src: "CACHED", visible: true },
    { id: "assets", label: "ASSETS", src: "SIMULATED", visible: true },
    { id: "env", label: "ENV", src: "SIMULATED", visible: true },
    { id: "evidence", label: "EVIDENCE", src: "LIVE", visible: true },
  ];

  function layer(id) {
    for (var i = 0; i < LAYERS.length; i++) if (LAYERS[i].id === id) return LAYERS[i];
    return null;
  }

  /* ── canvas + isometric projection (twin discipline, verbatim maths) ──── */

  var canvas, ctx;
  var W = 0,
    H = 0,
    DPR = 1;
  var ISO_Y = 0.55;
  var ZOOM = 0.75;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function project(wx, wy) {
    var angle = -0.35;
    var rx = wx * Math.cos(angle) - wy * Math.sin(angle);
    var ry = wx * Math.sin(angle) * ISO_Y + wy * Math.cos(angle) * ISO_Y;
    return { px: rx * ZOOM, py: ry * ZOOM };
  }

  function worldToScreen(wx, wy) {
    var p = project(wx, wy);
    return { x: W / 2 + p.px, y: H / 2 + p.py - 30 };
  }

  /* ── the world (same space as the twin — Devil's Peak, Ward 62) ───────── */

  var FIRE_POLYGON = [
    [-180, -120],
    [-90, -160],
    [10, -150],
    [60, -90],
    [40, 10],
    [-30, 60],
    [-130, 40],
    [-190, -30],
    [-200, -80],
  ];
  var FIRE_CENTROID = [-70, -60];

  var ZONE_MANDATORY = [
    [-220, -180],
    [-40, -220],
    [40, -140],
    [-20, -20],
    [-160, 20],
    [-230, -40],
  ];
  var ZONE_PRECAUTION = [
    [-260, -240],
    [80, -260],
    [140, -140],
    [40, 80],
    [-120, 140],
    [-260, 60],
    [-280, -80],
  ];

  var EVAC_ROUTES = [
    [
      [-140, 60],
      [40, 80],
      [180, 100],
      [260, 120],
    ] /* east */,
    [
      [-100, 120],
      [0, 200],
      [100, 260],
    ] /* south */,
    [
      [60, -20],
      [200, -20],
      [300, 0],
    ] /* CBD */,
  ];

  var ASSETS = [
    { x: 180, y: -40, type: "fire_station", label: "Roeland St Fire" },
    { x: 220, y: 60, type: "fire_station", label: "Salt River Fire" },
    { x: 90, y: 120, type: "shelter", label: "Groote Schuur HS" },
    { x: -30, y: 140, type: "shelter", label: "Rondebosch Boys" },
    { x: 130, y: -140, type: "clinic", label: "CBD Clinic" },
    { x: -140, y: 100, type: "school", label: "Newlands Primary" },
    { x: 40, y: -200, type: "water_point", label: "Reservoir 1" },
    { x: 250, y: 0, type: "municipal", label: "Ward 62 Ops" },
  ];

  var SMOKE = [];
  var WIND = [];

  function seed() {
    var rand = mulberry32(42);
    for (var i = 0; i < 220; i++) {
      SMOKE.push({
        x: FIRE_CENTROID[0] + (rand() - 0.5) * 80,
        y: FIRE_CENTROID[1] + (rand() - 0.5) * 40,
        life: rand(),
        size: 4 + rand() * 8,
        vx: 0.6 + rand() * 0.5,
        vy: 0.3 + rand() * 0.3,
      });
    }
    for (var gx = -260; gx <= 280; gx += 90) {
      for (var gy = -220; gy <= 240; gy += 90) {
        WIND.push({ x: gx, y: gy, phase: rand() * Math.PI * 2 });
      }
    }
  }

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ── state + mesh readers ───────────────────────────────────────────────── */

  function fsm() {
    return (
      (global.WildfireState && global.WildfireState.snapshot()) || {
        state: "NORMAL",
        fireActive: false,
        evacMandatory: false,
      }
    );
  }
  function mesh() {
    return (global.WildfireMesh && global.WildfireMesh.snapshot()) || { nodes: [], sensors: [] };
  }
  function journal() {
    return (
      (global.WildfireEvidence && global.WildfireEvidence.snapshot()) || { events: [], head: "—" }
    );
  }

  /* ── drawing helpers ────────────────────────────────────────────────────── */

  function drawPolygon(points, fill, stroke, alpha) {
    if (points.length < 3) return;
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.beginPath();
    for (var i = 0; i < points.length; i++) {
      var s = worldToScreen(points[i][0], points[i][1]);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    }
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPolyline(points, stroke, width, dash) {
    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width || 2;
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    for (var i = 0; i < points.length; i++) {
      var s = worldToScreen(points[i][0], points[i][1]);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawGrid() {
    ctx.save();
    ctx.strokeStyle = "rgba(88,166,255,0.06)";
    ctx.lineWidth = 1;
    for (var gx = -320; gx <= 320; gx += 40) {
      ctx.beginPath();
      var a = worldToScreen(gx, -280),
        b = worldToScreen(gx, 280);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (var gy = -280; gy <= 280; gy += 40) {
      ctx.beginPath();
      var a2 = worldToScreen(-320, gy),
        b2 = worldToScreen(320, gy);
      ctx.moveTo(a2.x, a2.y);
      ctx.lineTo(b2.x, b2.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ── layer 7: environmental backdrop ───────────────────────────────────── */

  function drawEnv(now) {
    if (!layer("env").visible) return;
    var g = ctx.createLinearGradient(0, 0, 0, H * 0.55);
    g.addColorStop(0.0, "#1a1424");
    g.addColorStop(0.35, "#3d1f1e");
    g.addColorStop(0.62, "#8c3a1f");
    g.addColorStop(0.85, "#c4422a");
    g.addColorStop(1.0, "#0a0e17");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    var sunX = W * 0.82,
      sunY = H * 0.48;
    var rg = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 320);
    rg.addColorStop(0, "rgba(255, 210, 140, 0.35)");
    rg.addColorStop(0.5, "rgba(232, 160, 32, 0.12)");
    rg.addColorStop(1, "rgba(232, 160, 32, 0)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);

    /* Table Mountain silhouette */
    ctx.save();
    ctx.fillStyle = "rgba(10,14,23,0.9)";
    ctx.beginPath();
    var baseY = H * 0.42;
    ctx.moveTo(-20, baseY + 60);
    var pts = [
      [0.02, 40],
      [0.05, 0],
      [0.1, -20],
      [0.18, -25],
      [0.24, -25],
      [0.3, -20],
      [0.35, -10],
      [0.4, 20],
      [0.44, 60],
      [0.48, 90],
    ];
    for (var i = 0; i < pts.length; i++) ctx.lineTo(W * pts[i][0], baseY + pts[i][1]);
    ctx.lineTo(W * 0.52, baseY + 60);
    ctx.lineTo(-20, baseY + 60);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    drawGrid();
  }

  /* ── layer 4: evacuation (state-gated) ─────────────────────────────────── */

  function drawEvac(now) {
    if (!layer("evac").visible) return;
    var f = fsm();
    if (f.state === "NORMAL") return; /* nothing in force */

    if (f.state === "WATCH" || f.state === "DECLARED" || f.state === "ESCALATED") {
      drawPolygon(ZONE_PRECAUTION, "rgba(242,184,75,0.06)", "rgba(242,184,75,0.5)", 1);
    }
    if (f.evacMandatory) {
      drawPolygon(ZONE_MANDATORY, "rgba(196,66,42,0.10)", "rgba(196,66,42,0.75)", 1);
    }
    if (f.state === "STAND_DOWN") {
      /* lifted — outline only, dashed, green: the honest after-state */
      drawPolygon(ZONE_MANDATORY, null, "rgba(82,183,136,0.55)", 1);
      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.restore();
    }

    var t = (now / 1000) % 1;
    for (var r = 0; r < EVAC_ROUTES.length; r++) {
      var route = EVAC_ROUTES[r];
      drawPolyline(
        route,
        f.state === "STAND_DOWN" ? "rgba(82,183,136,0.4)" : "rgba(82,183,136,0.9)",
        3,
      );
      for (var i = 0; i < route.length - 1; i++) {
        var a = route[i],
          b = route[i + 1];
        for (var k = 0; k < 4; k++) {
          var q = (t + k / 4) % 1;
          var s = worldToScreen(a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q);
          ctx.beginPath();
          ctx.fillStyle = "#52b788";
          ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  /* ── layer 2: wind ─────────────────────────────────────────────────────── */

  function drawWind(now) {
    if (!layer("wind").visible) return;
    ctx.save();
    for (var i = 0; i < WIND.length; i++) {
      var w = WIND[i];
      var s = worldToScreen(w.x, w.y);
      var pulse = 0.5 + 0.5 * Math.sin(now / 500 + w.phase);
      var len = 18 + pulse * 8;
      var dx = 0.78,
        dy = 0.62;
      var x2 = s.x + dx * len,
        y2 = s.y + dy * len;
      ctx.strokeStyle = "rgba(255,255,255," + (0.08 + 0.12 * pulse) + ")";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - 5, y2 - 3);
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - 3, y2 + 3);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ── layer 1: fire polygon (FSM-aware intensity) ───────────────────────── */

  function fireIntensity() {
    var st = fsm().state;
    return st === "ESCALATED" ? 1.3 : st === "DECLARED" ? 1.0 : st === "WATCH" ? 0.7 : 0;
  }

  function drawFire(now) {
    if (!layer("fire").visible) return;
    var f = fsm();
    if (!f.fireActive) {
      /* NORMAL: the dormant watch area — dim dashed outline, no burn */
      ctx.save();
      ctx.setLineDash([8, 6]);
      drawPolygon(FIRE_POLYGON, null, "rgba(242,184,75,0.28)", 1);
      ctx.restore();
      return;
    }
    var k = fireIntensity();

    ctx.save();
    for (var g = 0; g < 3; g++) {
      var alpha = (0.06 - g * 0.018) * k;
      var scale = 1 + g * 0.08;
      ctx.beginPath();
      for (var i = 0; i < FIRE_POLYGON.length; i++) {
        var p = FIRE_POLYGON[i];
        var wx = FIRE_CENTROID[0] + (p[0] - FIRE_CENTROID[0]) * scale;
        var wy = FIRE_CENTROID[1] + (p[1] - FIRE_CENTROID[1]) * scale;
        var s = worldToScreen(wx, wy);
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      }
      ctx.closePath();
      ctx.fillStyle = "rgba(255,90,61," + alpha + ")";
      ctx.fill();
    }
    ctx.restore();

    drawPolygon(FIRE_POLYGON, "rgba(196,66,42," + 0.55 * Math.min(1, k) + ")", "#ff5a3d", 1);

    var flicker = 0.7 + 0.3 * Math.sin(now / 180);
    var c = worldToScreen(FIRE_CENTROID[0], FIRE_CENTROID[1]);
    var rg = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 140 * ZOOM);
    rg.addColorStop(0, "rgba(255,220,120," + 0.55 * flicker * Math.min(1, k) + ")");
    rg.addColorStop(0.4, "rgba(255,140,60," + 0.35 * flicker * Math.min(1, k) + ")");
    rg.addColorStop(1, "rgba(255,90,61,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  }

  /* ── layer 3: smoke ────────────────────────────────────────────────────── */

  function drawSmoke(now) {
    if (!layer("smoke").visible || !fsm().fireActive) return;
    var k = Math.min(1, fireIntensity());
    ctx.save();
    for (var i = 0; i < SMOKE.length; i++) {
      var p = SMOKE[i];
      p.x += p.vx * k;
      p.y += p.vy * k;
      p.life -= 0.003 * k;
      if (p.life <= 0) {
        p.x = FIRE_CENTROID[0] + (Math.random() - 0.5) * 80;
        p.y = FIRE_CENTROID[1] + (Math.random() - 0.5) * 40;
        p.life = 1;
      }
      var s = worldToScreen(p.x, p.y);
      var alpha = 0.12 * p.life * k;
      var rad = p.size * (1 + (1 - p.life) * 2) * ZOOM;
      var grd = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, rad);
      grd.addColorStop(0, "rgba(140,140,150," + alpha + ")");
      grd.addColorStop(1, "rgba(80,80,90,0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(s.x, s.y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ── layer 5: mesh density (consent-gated heat) ────────────────────────── */

  function drawMesh(now) {
    if (!layer("mesh").visible) return;
    var snap = mesh();
    var nodes = snap.nodes || [];

    /* density heat overlay — CONSENTED nodes only, never fabricated */
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var s = worldToScreen(n.x, n.y);
      var near = dist(n, { x: FIRE_CENTROID[0], y: FIRE_CENTROID[1] }) < 150;
      var pulse = 0.5 + 0.5 * Math.sin(now / 600 + i);
      var rad = (26 + pulse * 6) * ZOOM;
      var grd = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, rad);
      grd.addColorStop(0, near ? "rgba(255,120,50,0.16)" : "rgba(88,166,255,0.13)");
      grd.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(s.x, s.y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    /* node cores — pulsing dots (absent members are simply not here) */
    ctx.save();
    for (var j = 0; j < nodes.length; j++) {
      var nd = nodes[j];
      var sc = worldToScreen(nd.x, nd.y);
      var ph = 0.5 + 0.5 * Math.sin(now / 600 + j * 1.7);
      var nearFire = dist(nd, { x: FIRE_CENTROID[0], y: FIRE_CENTROID[1] }) < 150;
      var color = nearFire ? "rgba(255,140,60," : "rgba(88,166,255,";
      ctx.beginPath();
      ctx.fillStyle = color + (0.1 + 0.1 * ph) + ")";
      ctx.arc(sc.x, sc.y, 5 + ph * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = color + "0.95)";
      ctx.arc(sc.x, sc.y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function dist(a, b) {
    var dx = a.x - b.x,
      dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /* ── layer 6: assets + admin-scoped sensors ────────────────────────────── */

  function drawAssets(now) {
    if (!layer("assets").visible) return;
    ctx.save();
    var iconColor = {
      fire_station: "#ff5a3d",
      shelter: "#f2b84b",
      clinic: "#52b788",
      school: "#58a6ff",
      water_point: "#58a6ff",
      municipal: "#a371f7",
    };
    var f = fsm();
    for (var i = 0; i < ASSETS.length; i++) {
      var a = ASSETS[i];
      var s = worldToScreen(a.x, a.y);
      var col = iconColor[a.type] || "#fff";
      var engaged = f.state === "DECLARED" || f.state === "ESCALATED";
      ctx.beginPath();
      ctx.fillStyle = col;
      ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "9px ui-monospace, monospace";
      ctx.fillStyle = engaged ? "rgba(224,230,237,0.9)" : "rgba(224,230,237,0.6)";
      ctx.fillText(a.label, s.x + 8, s.y + 3);
    }

    /* municipal sensors — purple diamonds (admin-scope consented) */
    var sensors = mesh().sensors || [];
    for (var k = 0; k < sensors.length; k++) {
      var sn = sensors[k];
      var ss = worldToScreen(sn.x, sn.y);
      ctx.save();
      ctx.translate(ss.x, ss.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = "#a371f7";
      ctx.fillRect(-3.5, -3.5, 7, 7);
      ctx.restore();
      ctx.font = "8px ui-monospace, monospace";
      ctx.fillStyle = "rgba(163,113,247,0.85)";
      ctx.fillText(sn.label, ss.x + 8, ss.y + 3);
    }
    ctx.restore();
  }

  /* ── layer 8: the evidence chain (LIVE journal, on canvas) ─────────────── */

  function drawEvidence(now) {
    if (!layer("evidence").visible) return;
    var j = journal();
    var tail = (j.events || []).slice(-3);
    var x = W - 16,
      y = 74;
    ctx.save();
    ctx.font = "9px ui-monospace, monospace";
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(127,149,165,0.9)";
    ctx.fillText("EVIDENCE CHAIN · LIVE", x, y);
    y += 14;
    for (var i = tail.length - 1; i >= 0; i--) {
      var e = tail[i];
      ctx.fillStyle = "rgba(184,199,210,0.75)";
      var line = "#" + e.seq + " " + e.event + " · " + e.ts.slice(11, 19) + "Z";
      ctx.fillText(line, x, y);
      y += 13;
    }
    ctx.fillStyle = "#f2b84b";
    ctx.fillText("HEAD " + (j.head || "—").slice(0, 16) + "…", x, y);
    ctx.restore();
  }

  /* ── compass ────────────────────────────────────────────────────────────── */

  function drawCompass() {
    var s = worldToScreen(-260, 240);
    ctx.save();
    ctx.strokeStyle = "rgba(224,230,237,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#ff5a3d";
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.fillText("SE", s.x, s.y + 3);
    ctx.restore();
  }

  /* ── frame loop ─────────────────────────────────────────────────────────── */

  function frame(now) {
    drawEnv(now);
    drawEvac(now);
    drawWind(now);
    drawSmoke(now);
    drawFire(now);
    drawMesh(now);
    drawAssets(now);
    drawCompass();
    drawEvidence(now);
    requestAnimationFrame(frame);
  }

  /* ── init + public contract ─────────────────────────────────────────────── */

  function init() {
    canvas = document.getElementById("wf-scene");
    if (!canvas) return;
    ctx = canvas.getContext("2d");
    seed();
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener(
      "wheel",
      function (e) {
        ZOOM *= e.deltaY > 0 ? 0.95 : 1.05;
        ZOOM = Math.max(0.35, Math.min(2.2, ZOOM));
      },
      { passive: true },
    );
    requestAnimationFrame(frame);
    return { layers: LAYERS };
  }

  global.WildfireLayers = {
    init: init,
    layers: LAYERS,
    toggle: function (id) {
      var l = layer(id);
      if (l) l.visible = !l.visible;
      return l ? l.visible : null;
    },
  };
})(window);
