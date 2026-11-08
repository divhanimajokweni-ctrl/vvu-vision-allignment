/* pinnable-panels.js — Task 47 · pinnable surfaces + picture-in-picture.
 *
 * PINNING puts a panel on the floor of the current view: pinned panels sit
 * at the bottom of the viewport, above the footer, and remain visible
 * regardless of which numbered tab is active (they are shared across
 * surfaces). They are resizable by dragging their top edge, remember
 * their height across sessions, never take focus, never steal keyboard
 * input, and update live.
 *
 * THE PIN STATE FILE — localStorage.vvu.pins.v1 (exact spec shape + the
 * remembered heights the spec demands):
 *   { "version": 1,
 *     "pinned": ["worm-ledger", "device-mesh"],
 *     "hidden": ["signal-log"],
 *     "heights": { "worm-ledger": 168 } }
 *
 * DEFAULTS: nothing pinned, nothing hidden. The WORM ledger bar is OFF by
 * default (not pinned) but hiding it is an explicit act — if pinned it
 * stays pinned; if hidden it stays hidden until the user reveals it.
 *
 * THE PANELS (the estate's real, data-driven set — each rendered live
 * from a named estate source, each with its source line):
 *   worm-ledger       /api/vvu/ledger (WORM tail · 5s poll)
 *   device-mesh       /api/vvu/rails  (:3005 devices · 15s poll)
 *   wildfire-evidence :3006 /journal  (hash-chained tail · 6s poll)
 *   telemetry-rail    :3003 /healthz  (rail pulse · 10s poll)
 *
 * GESTURES:
 *   Ctrl+P / Ctrl+U / Ctrl+H / Ctrl+Shift+H  — pin / unpin / hide / reveal
 *   right-click a dock panel header — Pin / Unpin / Hide / Pop out
 *   Ctrl+Shift+P — pop the current VISUAL panel (the artifact-backed
 *   views: Spatial Twin · Trust Sphere · Sensor Mesh) out to PiP
 *
 * PiP (Document Picture-in-Picture where available):
 *   Primary path — documentPictureInPicture.requestWindow(): a live iframe
 *   of the artifact's own URL inside the floating window. Full
 *   interactivity preserved. Esc (when the PiP window has focus) closes
 *   it and restores the panel in place.
 *   Fallback path — window.open() popup with the same live URL: live and
 *   interactive (an honest IMPROVEMENT on the spec's read-only canvas
 *   capture for artifact-backed panels — they relocate cleanly by URL).
 *   Last fallback — an honest modal: "Picture-in-picture is not available
 *   on this device. The panel is still live in place." Never a silent
 *   failure.
 *   DECLARED LIMITATION: the PiP window receives keyboard only when it
 *   has focus, and honours only Esc. A browser limitation, not a VVU one.
 *
 * The main view is freed while a panel is popped out: this module
 * dispatches vvu:pip:opened / vvu:pip:closed {view} and the React side
 * renders the "Popped out — click to restore" placeholder.
 */

(function () {
  "use strict";

  var STORAGE_KEY = "vvu.pins.v1";
  var DEFAULT_HEIGHT = 150;
  var MIN_HEIGHT = 90;
  var MAX_HEIGHT = 420;

  /* ═════════════════════════ state ═════════════════════════ */

  var pins = { version: 1, pinned: [], hidden: [], heights: {} };
  var loadedState = false;
  var hiddenStack = []; /* reveal order — Ctrl+Shift+H pops the newest */

  function loadState() {
    if (loadedState) return pins;
    loadedState = true;
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (p && p.version === 1 && Array.isArray(p.pinned) && Array.isArray(p.hidden)) {
          pins = p;
          pins.heights = pins.heights && typeof pins.heights === "object" ? pins.heights : {};
        }
      }
    } catch (err) {
      pins = { version: 1, pinned: [], hidden: [], heights: {} };
    }
    return pins;
  }
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
      window.dispatchEvent(new CustomEvent("vvu:pins-changed", { detail: { key: STORAGE_KEY } }));
    } catch (err) {
      /* session-only */
    }
  }

  /* ═════════════════════════ the panel registry ═════════════════════════
     Every dock panel renders from a NAMED estate source, live, with its
     source line — no decoration, no invented numbers. */

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function hhmmss(iso) {
    try {
      return new Date(iso).toLocaleTimeString("en-GB", { hour12: false });
    } catch (e) {
      return "—";
    }
  }
  function fetchJson(url, timeoutMs) {
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var t = setTimeout(function () {
      if (ctrl) ctrl.abort();
    }, timeoutMs || 2500);
    return fetch(url, { cache: "no-store", signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .finally(function () {
        clearTimeout(t);
      });
  }

  var REGISTRY = [
    {
      id: "worm-ledger",
      label: "WORM LEDGER",
      note: "append-only estate events",
      poll: 5000,
      render: function (body) {
        return fetchJson("/api/vvu/ledger?limit=6", 2500)
          .then(function (d) {
            var rows = (d.entries || [])
              .map(function (e) {
                var kind = esc(e.kind || e.action || "EVENT");
                var at = hhmmss(e.at || e.createdAt || e.timestamp);
                return (
                  '<div class="vdp-row"><span class="vdp-k">' +
                  kind +
                  '</span><span class="vdp-t">' +
                  at +
                  "</span></div>"
                );
              })
              .join("");
            body.innerHTML =
              rows ||
              '<div class="vdp-row vdp-dim">no entries yet — honest empty, not fabricated</div>';
            return "source: /api/vvu/ledger · " + (d.entries ? d.entries.length : 0) + " shown";
          })
          .catch(function (err) {
            body.innerHTML = '<div class="vdp-row vdp-dim">ledger unreachable</div>';
            return "source: /api/vvu/ledger · fetch failed: " + esc(err.message || err);
          });
      },
    },
    {
      id: "device-mesh",
      label: "DEVICE MESH",
      note: ":3005 field-onboard rail",
      poll: 15000,
      render: function (body) {
        return fetchJson("/api/vvu/rails", 2500)
          .then(function (d) {
            var dev = d.devices || {};
            if (dev.offline) {
              body.innerHTML =
                '<div class="vdp-row vdp-bad">:3005 OFFLINE — no cached number</div>';
              return "source: /api/vvu/rails (:3005) · devices · RAIL DOWN";
            }
            body.innerHTML =
              '<div class="vdp-row"><span class="vdp-k">paired</span><b>' +
              (dev.paired == null ? "—" : dev.paired) +
              "</b>" +
              '<span class="vdp-k" style="margin-left:12px">active</span><b>' +
              (dev.active == null ? "—" : dev.active) +
              "</b>" +
              '<span class="vdp-k" style="margin-left:12px">stale</span><b>' +
              (dev.stale == null ? "—" : dev.stale) +
              "</b></div>" +
              '<div class="vdp-row vdp-dim">agent ' +
              (dev.agentOnline ? "LIVE" : "NONE") +
              " · rail UP</div>";
            return "source: /api/vvu/rails (:3005) · devices · check " + hhmmss(d.generatedAt);
          })
          .catch(function (err) {
            body.innerHTML = '<div class="vdp-row vdp-dim">rails endpoint unreachable</div>';
            return "source: /api/vvu/rails · fetch failed: " + esc(err.message || err);
          });
      },
    },
    {
      id: "wildfire-evidence",
      label: "WILDFIRE EVIDENCE",
      note: ":3006 hash-chained journal",
      poll: 6000,
      render: function (body) {
        return fetchJson("/journal?limit=5" + "&XTransformPort=3006", 2500)
          .then(function (d) {
            var entries = d.entries || d.journal || d.tail || [];
            var rows = entries
              .map(function (e) {
                return (
                  '<div class="vdp-row"><span class="vdp-k">' +
                  esc(e.kind || "?") +
                  '</span><span class="vdp-t">#' +
                  (e.seq || "?") +
                  "</span></div>"
                );
              })
              .join("");
            body.innerHTML = rows || '<div class="vdp-row vdp-dim">journal empty</div>';
            return "source: :3006 /journal · hash-chained · T0";
          })
          .catch(function (err) {
            body.innerHTML = '<div class="vdp-row vdp-dim">:3006 unreachable</div>';
            return "source: :3006 /journal · fetch failed: " + esc(err.message || err);
          });
      },
    },
    {
      id: "telemetry-rail",
      label: "TELEMETRY RAIL",
      note: ":3003 pulse",
      poll: 10000,
      render: function (body) {
        return fetchJson("/healthz?XTransformPort=3003", 2500)
          .then(function (d) {
            body.innerHTML =
              '<div class="vdp-row"><span class="vdp-k">:3003</span><b class="vdp-good">' +
              (d.ok ? "UP" : "DEGRADED") +
              "</b></div>";
            return "source: :3003 /healthz · pulse";
          })
          .catch(function (err) {
            body.innerHTML = '<div class="vdp-row vdp-bad">:3003 DOWN</div>';
            return "source: :3003 /healthz · fetch failed: " + esc(err.message || err);
          });
      },
    },
  ];

  function regById(id) {
    for (var i = 0; i < REGISTRY.length; i++) if (REGISTRY[i].id === id) return REGISTRY[i];
    return null;
  }

  /* ═════════════════════════ the dock ═════════════════════════ */

  var dockEl = null;
  var bodyTimers = {}; /* panelId → interval */
  var panelEls = {}; /* panelId → {root, body, src} */
  var currentPanel = null; /* hover/focus tracking for "the current panel" */

  /* Global current-panel tracking: ANY element carrying [data-vvu-panel]
     (dock panels, Settings registry rows, future surfaces) sets the current
     panel on hover/focus — Ctrl+P / Ctrl+U / Ctrl+H act on it. */
  document.addEventListener(
    "pointerover",
    function (e) {
      var el = e.target instanceof Element ? e.target.closest("[data-vvu-panel]") : null;
      if (el) currentPanel = el.getAttribute("data-vvu-panel");
    },
    true,
  );
  document.addEventListener(
    "focusin",
    function (e) {
      var el = e.target instanceof Element ? e.target.closest("[data-vvu-panel]") : null;
      if (el) currentPanel = el.getAttribute("data-vvu-panel");
    },
    true,
  );

  function dock() {
    if (dockEl && document.body.contains(dockEl)) return dockEl;
    dockEl = document.createElement("div");
    dockEl.id = "vvu-pin-dock";
    dockEl.setAttribute("role", "region");
    dockEl.setAttribute("aria-label", "Pinned panels");
    document.body.appendChild(dockEl);
    return dockEl;
  }

  function injectDockStyles() {
    if (document.getElementById("vvu-pin-dock-styles")) return;
    var s = document.createElement("style");
    s.id = "vvu-pin-dock-styles";
    s.textContent =
      "#vvu-pin-dock{position:fixed;left:0;right:340px;bottom:2.55rem;z-index:60;display:flex;" +
      'align-items:flex-end;gap:8px;padding:0 10px;pointer-events:none;font-family:"Geist Mono",Menlo,Consolas,monospace;}' +
      "@media (max-width:799px){#vvu-pin-dock{right:230px;bottom:3.4rem;}}" +
      ".vdp{pointer-events:auto;flex:1 1 0;min-width:180px;display:flex;flex-direction:column;background:rgba(8,11,7,0.97);" +
      "border:1px solid rgba(107,138,64,0.35);border-bottom:0;border-radius:2px 2px 0 0;overflow:hidden;}" +
      ".vdp-grab{height:5px;cursor:ns-resize;background:rgba(107,138,64,0.25);touch-action:none;}" +
      ".vdp-grab:hover{background:rgba(200,255,0,0.35);}" +
      ".vdp-head{display:flex;align-items:center;gap:8px;padding:5px 8px;border-bottom:1px solid rgba(107,138,64,0.22);}" +
      ".vdp-title{font-size:7.5pt;letter-spacing:0.18em;color:#c8ff00;white-space:nowrap;}" +
      ".vdp-note{font-size:7pt;color:#7a8a6e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
      ".vdp-btns{margin-left:auto;display:flex;gap:4px;}" +
      ".vdp-btn{font:inherit;font-size:7pt;letter-spacing:0.08em;background:none;border:1px solid rgba(107,138,64,0.35);" +
      "color:#7a8a6e;padding:2px 6px;cursor:pointer;}" +
      ".vdp-btn:hover{color:#c8ff00;border-color:rgba(200,255,0,0.5);}" +
      ".vdp-body{overflow:auto;flex:1;min-height:0;scrollbar-width:thin;}" +
      ".vdp-row{display:flex;align-items:baseline;gap:8px;font-size:8pt;color:#c9d4bd;padding:2px 8px;white-space:nowrap;}" +
      ".vdp-k{color:#7a8a6e;letter-spacing:0.1em;}" +
      ".vdp-t{margin-left:auto;color:#4a5744;}" +
      ".vdp-dim{color:#7a8a6e;} .vdp-good{color:#8fb35a;} .vdp-bad{color:#e5484d;}" +
      ".vdp-src{font-size:7pt;color:#4a5744;padding:3px 8px;border-top:1px dashed rgba(107,138,64,0.2);" +
      "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
      ".vdp-ctx{position:fixed;z-index:99;background:rgba(6,8,6,0.98);border:1px solid rgba(107,138,64,0.5);" +
      'font-family:"Geist Mono",Menlo,Consolas,monospace;font-size:8.5pt;color:#c9d4bd;min-width:130px;}' +
      ".vdp-ctx button{display:block;width:100%;text-align:left;background:none;border:0;color:inherit;font:inherit;" +
      "padding:7px 12px;cursor:pointer;letter-spacing:0.06em;}" +
      ".vdp-ctx button:hover{background:rgba(200,255,0,0.1);color:#c8ff00;}" +
      "#vvu-pip-modal{position:fixed;inset:0;z-index:99;display:flex;align-items:center;justify-content:center;" +
      'background:rgba(3,5,3,0.75);font-family:"Geist Mono",Menlo,Consolas,monospace;}' +
      "#vvu-pip-modal .box{background:rgba(6,8,6,0.98);border:1px solid rgba(107,138,64,0.5);padding:20px 24px;" +
      "color:#c9d4bd;font-size:9.5pt;line-height:1.8;max-width:min(420px,88vw);}" +
      "#vvu-pip-modal b{color:#c8ff00;letter-spacing:0.14em;}" +
      "#vvu-pip-modal button{margin-top:12px;font:inherit;font-size:8.5pt;letter-spacing:0.14em;background:none;" +
      "border:1px solid rgba(200,255,0,0.4);color:#c8ff00;padding:7px 16px;cursor:pointer;}";
    document.head.appendChild(s);
  }

  function startBody(panelId, bodyEl, srcEl) {
    stopBody(panelId);
    var reg = regById(panelId);
    if (!reg) return;
    var run = function () {
      reg
        .render(bodyEl)
        .then(function (srcLine) {
          if (srcEl) srcEl.textContent = srcLine;
        })
        .catch(function (err) {
          if (srcEl)
            srcEl.textContent =
              "source: " + reg.id + " · error: " + (err && err.message ? err.message : err);
        });
    };
    run();
    bodyTimers[panelId] = setInterval(run, reg.poll);
  }
  function stopBody(panelId) {
    if (bodyTimers[panelId]) {
      clearInterval(bodyTimers[panelId]);
      delete bodyTimers[panelId];
    }
  }

  function buildPanel(panelId) {
    var reg = regById(panelId);
    if (!reg) return null;
    var root = document.createElement("section");
    root.className = "vdp";
    root.setAttribute("data-vvu-panel", panelId);
    var h = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, pins.heights[panelId] || DEFAULT_HEIGHT));
    root.style.height = h + "px";

    var grab = document.createElement("div");
    grab.className = "vdp-grab";
    grab.title = "drag to resize — the height is remembered";
    var head = document.createElement("div");
    head.className = "vdp-head";
    var title = document.createElement("span");
    title.className = "vdp-title";
    title.textContent = reg.label;
    var note = document.createElement("span");
    note.className = "vdp-note";
    note.textContent = reg.note;
    var btns = document.createElement("div");
    btns.className = "vdp-btns";
    var popBtn = document.createElement("button");
    popBtn.className = "vdp-btn";
    popBtn.textContent = "POP OUT";
    popBtn.title = "pop this panel out (Ctrl+Shift+P on a visual panel)";
    var hideBtn = document.createElement("button");
    hideBtn.className = "vdp-btn";
    hideBtn.textContent = "HIDE";
    hideBtn.title = "hide (Ctrl+Shift+H reveals)";
    btns.appendChild(popBtn);
    btns.appendChild(hideBtn);
    head.appendChild(title);
    head.appendChild(note);
    head.appendChild(btns);

    var body = document.createElement("div");
    body.className = "vdp-body";
    var src = document.createElement("div");
    src.className = "vdp-src";
    src.textContent = "source: " + reg.id + " · starting";

    root.appendChild(grab);
    root.appendChild(head);
    root.appendChild(body);
    root.appendChild(src);

    /* current-panel tracking (hover/focus) — Ctrl+P/U/H act on this */
    root.addEventListener("pointerenter", function () {
      currentPanel = panelId;
    });
    root.addEventListener("focusin", function () {
      currentPanel = panelId;
    });

    hideBtn.addEventListener("click", function () {
      hidePanel(panelId);
    });
    popBtn.addEventListener("click", function () {
      popOutDockPanel(panelId);
    });

    /* right-click header → Pin / Unpin / Hide / Pop out */
    head.addEventListener("contextmenu", function (e) {
      e.preventDefault();
      openContextMenu(e.clientX, e.clientY, panelId);
    });

    /* drag-resize by the top edge — remembers the height */
    var drag = null;
    grab.addEventListener("pointerdown", function (e) {
      drag = { y: e.clientY, h: root.offsetHeight, id: panelId };
      grab.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    grab.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var nh = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, drag.h + (drag.y - e.clientY)));
      root.style.height = nh + "px";
    });
    grab.addEventListener("pointerup", function () {
      if (drag) {
        pins.heights[drag.id] = root.offsetHeight;
        saveState();
        drag = null;
      }
    });

    panelEls[panelId] = { root: root, body: body, src: src };
    startBody(panelId, body, src);
    return root;
  }

  function renderDock() {
    injectDockStyles();
    var d = dock();
    /* stop everything, rebuild from state (simple + honest) */
    Object.keys(bodyTimers).forEach(stopBody);
    panelEls = {};
    d.innerHTML = "";
    if (!pins.pinned.length) {
      d.style.display = "none";
      return;
    }
    d.style.display = "flex";
    pins.pinned.forEach(function (id) {
      if (pins.hidden.indexOf(id) !== -1) return; /* hidden stays hidden until revealed */
      var el = buildPanel(id);
      if (el) d.appendChild(el);
    });
  }

  /* ═════════════════════════ the gestures ═════════════════════════ */

  function pinPanel(id) {
    loadState();
    if (pins.pinned.indexOf(id) === -1) pins.pinned.push(id);
    var hi = pins.hidden.indexOf(id);
    if (hi !== -1) {
      pins.hidden.splice(hi, 1);
      hiddenStack = hiddenStack.filter(function (x) {
        return x !== id;
      });
    }
    saveState();
    renderDock();
  }
  function unpinPanel(id) {
    loadState();
    var i = pins.pinned.indexOf(id);
    if (i !== -1) pins.pinned.splice(i, 1);
    saveState();
    renderDock();
  }
  function hidePanel(id) {
    loadState();
    if (pins.hidden.indexOf(id) === -1) pins.hidden.push(id);
    if (hiddenStack.indexOf(id) === -1) hiddenStack.push(id);
    saveState();
    renderDock();
  }
  function revealLastHidden() {
    loadState();
    if (!hiddenStack.length) {
      /* nothing to reveal — the honest quiet note, never silence */
      statusNote("REVEAL — NOTHING HIDDEN");
      return;
    }
    var id = hiddenStack.pop();
    var i = pins.hidden.indexOf(id);
    if (i !== -1) pins.hidden.splice(i, 1);
    saveState();
    renderDock();
  }

  /* "the current panel" — the last dock panel hovered/focused; when
     nothing is tracked, the first registry panel is NOT silently chosen —
     the layer says so honestly. */
  function pinCurrent() {
    loadState();
    if (currentPanel) {
      pinPanel(currentPanel);
      return;
    }
    statusNote("PIN — NO PANEL IN FOCUS · hover a dock panel, or pin from its right-click menu");
  }
  function unpinCurrent() {
    loadState();
    if (currentPanel && pins.pinned.indexOf(currentPanel) !== -1) {
      unpinPanel(currentPanel);
      return;
    }
    statusNote("UNPIN — NO PINNED PANEL IN FOCUS");
  }
  function hideCurrent() {
    loadState();
    if (currentPanel) {
      hidePanel(currentPanel);
      return;
    }
    statusNote("HIDE — NO PANEL IN FOCUS");
  }

  var noteEl = null;
  function statusNote(text) {
    if (!noteEl || !document.body.contains(noteEl)) {
      noteEl = document.createElement("div");
      noteEl.id = "vvu-pins-note";
      noteEl.style.cssText =
        "position:fixed;left:12px;bottom:max(2rem, calc(env(safe-area-inset-bottom) + 1.75rem));" +
        'z-index:96;pointer-events:none;font-family:"Geist Mono",Menlo,Consolas,monospace;' +
        "font-size:8.5pt;color:#7a8a6e;background:rgba(6,8,6,0.92);" +
        "border:1px solid rgba(107,138,64,0.3);padding:4px 9px;transition:opacity 350ms ease;";
      document.body.appendChild(noteEl);
    }
    noteEl.textContent = text;
    noteEl.style.opacity = "1";
    setTimeout(function () {
      if (noteEl) noteEl.style.opacity = "0";
    }, 3200);
  }

  function openContextMenu(x, y, panelId) {
    closeContextMenu();
    var pinned = pins.pinned.indexOf(panelId) !== -1;
    var m = document.createElement("div");
    m.className = "vdp-ctx";
    m.setAttribute("role", "menu");
    var items = pinned
      ? [
          {
            t: "Unpin",
            fn: function () {
              unpinPanel(panelId);
            },
          },
        ]
      : [
          {
            t: "Pin",
            fn: function () {
              pinPanel(panelId);
            },
          },
        ];
    items.push({
      t: "Hide",
      fn: function () {
        hidePanel(panelId);
      },
    });
    items.push({
      t: "Pop out",
      fn: function () {
        popOutDockPanel(panelId);
      },
    });
    items.forEach(function (it) {
      var b = document.createElement("button");
      b.textContent = it.t;
      b.setAttribute("role", "menuitem");
      b.addEventListener("click", function () {
        closeContextMenu();
        it.fn();
      });
      m.appendChild(b);
    });
    document.body.appendChild(m);
    m.style.left = Math.min(x, window.innerWidth - 150) + "px";
    m.style.top = Math.max(8, y - m.offsetHeight - 8) + "px";
    m.id = "vvu-ctx-menu";
    setTimeout(function () {
      document.addEventListener("pointerdown", closeContextMenuOnce, { once: true });
    }, 0);
  }
  function closeContextMenu() {
    var m = document.getElementById("vvu-ctx-menu");
    if (m) m.remove();
  }
  function closeContextMenuOnce() {
    closeContextMenu();
  }

  /* ═════════════════════════ PiP ═════════════════════════ */

  /* the visual (artifact-backed) panels — they relocate cleanly by URL */
  var VISUALS = {
    twin: { title: "SPATIAL TWIN", url: "/twin/cape_town_wildfire.html" },
    sphere: { title: "TRUST SPHERE", url: "/vvu-trust/surfaces/trust-sphere/trust-sphere.html" },
    mesh: { title: "SENSOR MESH", url: "/mesh-demo?XTransformPort=3007" },
  };
  function viewIdFromHash() {
    var h = (window.location.hash || "").replace(/^#\/?/, "").split("?")[0];
    if (!h) return "spatial";
    /* spec aliases resolve to their estate view id */
    if (h === "ive") return "spatial";
    if (h === "evidence") return "bridge";
    if (h === "mission") return "analytics";
    if (h === "bridges") return "field";
    return h;
  }

  var pipWin = null; /* the Document-PiP window when the primary path is live */
  var pipPopup = null; /* the window.open fallback reference */
  var pipPoll = null; /* the closed-check interval for the popup fallback */
  var pipView = null;

  function pipModal(text) {
    var old = document.getElementById("vvu-pip-modal");
    if (old) old.remove();
    var m = document.createElement("div");
    m.id = "vvu-pip-modal";
    m.setAttribute("role", "alertdialog");
    m.setAttribute("aria-label", "Picture-in-picture unavailable");
    var box = document.createElement("div");
    box.className = "box";
    box.innerHTML =
      "<b>PICTURE-IN-PICTURE</b><br>" +
      esc(text) +
      '<br><span style="color:#7a8a6e">The panel is still live in place.</span>';
    var ok = document.createElement("button");
    ok.textContent = "UNDERSTOOD";
    ok.addEventListener("click", function () {
      m.remove();
    });
    box.appendChild(ok);
    m.appendChild(box);
    m.addEventListener("click", function (e) {
      if (e.target === m) m.remove();
    });
    document.body.appendChild(m);
  }

  function pipClosed() {
    pipWin = null;
    if (pipPopup) {
      try {
        pipPopup.close();
      } catch (err) {
        /* already gone */
      }
      pipPopup = null;
    }
    if (pipPoll) {
      clearInterval(pipPoll);
      pipPoll = null;
    }
    if (pipView) {
      window.dispatchEvent(new CustomEvent("vvu:pip:closed", { detail: { view: pipView } }));
      pipView = null;
    }
  }

  /** Restore from the main view's placeholder click — closes the pop-out. */
  function closePip() {
    if (!pipWin && !pipPoll && !pipPopup) return false;
    pipClosed();
    return true;
  }

  function openVisualInPip(viewId) {
    var v = VISUALS[viewId];
    if (!v) {
      statusNote(
        "POP OUT — THE CURRENT VIEW IS NOT VISUAL-ARTIFACT-BACKED (twin · sphere · mesh can pop)",
      );
      return false;
    }
    if (pipWin || pipPoll) {
      statusNote("POP OUT — A PANEL IS ALREADY POPPED (ESC IN ITS WINDOW RESTORES)");
      return false;
    }
    pipView = viewId;

    var finish = function (w) {
      pipWin = w;
      window.dispatchEvent(new CustomEvent("vvu:pip:opened", { detail: { view: viewId } }));
      w.addEventListener("pagehide", pipClosed);
      /* Esc — the only key the PiP window honours (declared limitation) */
      w.document.addEventListener(
        "keydown",
        function (e) {
          if (e.key === "Escape") {
            w.close();
            pipClosed();
          }
        },
        true,
      );
    };

    if (
      document.pictureInPictureEnabled &&
      window.documentPictureInPicture &&
      window.documentPictureInPicture.requestWindow
    ) {
      window.documentPictureInPicture
        .requestWindow({ width: 520, height: 400 })
        .then(function (w) {
          var st = w.document.createElement("style");
          st.textContent =
            "html,body{margin:0;height:100%;background:#060806;overflow:hidden}" +
            '#head{font:9pt "Geist Mono",Menlo,monospace;color:#c8ff00;letter-spacing:0.18em;' +
            "padding:6px 10px;border-bottom:1px solid rgba(107,138,64,0.3)}" +
            "iframe{width:100%;height:calc(100% - 30px);border:0;background:#060806}";
          w.document.head.appendChild(st);
          var head = w.document.createElement("div");
          head.id = "head";
          head.textContent = v.title + " · LIVE · ESC RESTORES";
          w.document.body.appendChild(head);
          var f = w.document.createElement("iframe");
          f.src = v.url;
          w.document.body.appendChild(f);
          finish(w);
        })
        .catch(function (err) {
          console.warn("[pinnable-panels] document PiP failed, trying popup fallback:", err);
          popupFallback(v);
        });
    } else {
      popupFallback(v);
    }
    return true;
  }

  function popupFallback(v) {
    var w = window.open(v.url, "vvu-pip-" + Date.now(), "popup=yes,width=540,height=420");
    if (!w) {
      /* last fallback — the honest modal. Never a silent failure. */
      pipView = null;
      pipModal(
        "Picture-in-picture is not available on this device (the browser blocked the window).",
      );
      return;
    }
    pipPopup = w;
    /* Esc in the pop-out window restores — the declared PiP limitation
       honoured identically on the fallback path (same-origin, so the
       keydown can be attached to the popup window). */
    try {
      w.addEventListener(
        "keydown",
        function (e) {
          if (e.key === "Escape") {
            w.close();
            pipClosed();
          }
        },
        true,
      );
    } catch (err) {
      /* cross-origin popup (should not happen) — close only */
    }
    pipPoll = setInterval(function () {
      if (w.closed) pipClosed();
    }, 1000);
    window.dispatchEvent(new CustomEvent("vvu:pip:opened", { detail: { view: pipView } }));
  }

  function popCurrentVisual() {
    openVisualInPip(viewIdFromHash());
  }

  /* a dock panel pops out by re-rendering its live body inside the PiP
     document (same renderer, same source lines) */
  function popOutDockPanel(panelId) {
    var reg = regById(panelId);
    if (!reg) return;
    if (pipWin || pipPoll) {
      statusNote("POP OUT — A PANEL IS ALREADY POPPED");
      return;
    }
    if (
      document.pictureInPictureEnabled &&
      window.documentPictureInPicture &&
      window.documentPictureInPicture.requestWindow
    ) {
      window.documentPictureInPicture
        .requestWindow({ width: 420, height: 300 })
        .then(function (w) {
          pipView = "dock:" + panelId;
          var st = w.document.createElement("style");
          st.textContent =
            'html,body{margin:0;height:100%;background:#060806;font-family:"Geist Mono",Menlo,monospace;overflow:hidden}' +
            ".t{font-size:8pt;color:#c8ff00;letter-spacing:0.18em;padding:6px 10px}" +
            ".b{position:absolute;top:28px;bottom:20px;left:0;right:0;overflow:auto;font-size:8pt;color:#c9d4bd}" +
            ".s{position:absolute;bottom:0;left:0;right:0;font-size:7pt;color:#4a5744;padding:3px 10px;border-top:1px dashed rgba(107,138,64,0.2)}";
          w.document.head.appendChild(st);
          var t = w.document.createElement("div");
          t.className = "t";
          t.textContent = reg.label + " · LIVE · ESC RESTORES";
          w.document.body.appendChild(t);
          var b = w.document.createElement("div");
          b.className = "b";
          w.document.body.appendChild(b);
          var s = w.document.createElement("div");
          s.className = "s";
          w.document.body.appendChild(s);
          var run = function () {
            reg.render(b).then(function (line) {
              s.textContent = line;
            });
          };
          run();
          var iv = setInterval(run, reg.poll);
          var onhide = function () {
            clearInterval(iv);
            pipClosed();
          };
          w.addEventListener("pagehide", onhide);
          w.document.addEventListener(
            "keydown",
            function (e) {
              if (e.key === "Escape") {
                w.close();
                onhide();
              }
            },
            true,
          );
          pipWin = w;
          window.dispatchEvent(new CustomEvent("vvu:pip:opened", { detail: { view: pipView } }));
        })
        .catch(function (err) {
          console.warn("[pinnable-panels] dock-panel PiP failed:", err);
          pipView = null;
          pipModal("Picture-in-picture is not available on this device.");
        });
    } else {
      pipModal("Picture-in-picture is not available on this device (Document PiP unsupported).");
    }
  }

  /* ═════════════════════════ public API ═════════════════════════ */

  window.VvuPins = {
    pinCurrent: pinCurrent,
    unpinCurrent: unpinCurrent,
    hideCurrent: hideCurrent,
    revealLastHidden: revealLastHidden,
    popCurrentVisual: popCurrentVisual,
    openVisualInPip: openVisualInPip,
    closePip: closePip,
    pin: pinPanel,
    unpin: unpinPanel,
    hide: hidePanel,
    registry: REGISTRY.map(function (r) {
      return { id: r.id, label: r.label, note: r.note };
    }),
    state: function () {
      loadState();
      return JSON.parse(JSON.stringify(pins));
    },
    reset: function () {
      pins = { version: 1, pinned: [], hidden: [], heights: {} };
      saveState();
      renderDock();
    },
  };

  /* boot */
  loadState();
  renderDock();
})();
