/* keyboard-layer.js — Task 47 · the global keyboard layer.
 *
 * THE MAP IS THE LAW: keyboard-map.json (same directory) is the single
 * source of truth for every binding. No hard-coded bindings live here —
 * this file only IMPLEMENTS what the map declares. A new binding is a new
 * row there, never an edit here.
 *
 * WHAT THIS LAYER DOES:
 *   · Ctrl+1..Ctrl+0  → the ten fixed surfaces (route per the map)
 *   · Ctrl+A..Ctrl+Z  → twenty-six action VERBS, dispatched as
 *                       CustomEvent('vvu:action', {detail:{action, key,
 *                       handled}}) — surfaces implement the verbs they own;
 *                       an action with no handler gets an honest quiet
 *                       status line, never silence, never a fake success
 *   · G → key         → chords, 600ms window, any other key cancels
 *                       silently (never while typing)
 *   · Ctrl+Alt+<key>  → discoverability: flashes the hint 5s, NO execute
 *   · Ctrl+Shift+<key>→ the inverse (Ctrl+H hides / Ctrl+Shift+H reveals;
 *                       Ctrl+Shift+P pops out to PiP)
 *   · Esc             → closes any modal (Radix keeps its own handler —
 *                       this layer never blocks a modal's Esc)
 *
 * WHAT THIS LAYER NEVER DOES (Part 6):
 *   · never blocks a shortcut because a modal is open (Esc is the only
 *     modal-facing key)
 *   · never shows a hint the user has mastered (Lindiwe owns that rule)
 *   · never hijacks text editing: in an editable field only Ctrl+digits
 *     and Ctrl+K pass through the layer; every letter action yields to
 *     the field (Ctrl+A must keep selecting text)
 *   · never intercepts Ctrl+C (native copy always wins; the action is
 *     still dispatched for surfaces that own a payload)
 *   · never persists mastery to a server (localStorage only, via Lindiwe)
 *
 * DECLARED BROWSER LIMITATIONS (honesty over pretending):
 *   · Ctrl+N / Ctrl+T / Ctrl+W are reserved by desktop Chrome/Edge/Firefox
 *     — the keydown never reaches the page in a plain tab. They are bound
 *     (they fire in installed-PWA contexts) and LISTED, but Lindiwe never
 *     teaches them and the map carries the warning on each row.
 *   · WORM parity: keyboard route changes POST /api/vvu/audit exactly like
 *     the lime toggle and the palette (fire-and-forget; failures logged).
 */

(function () {
  "use strict";

  /* The map URL resolves from THIS SCRIPT's own URL, not the document base —
     a classic script's relative fetch() would resolve against the page (/),
     which 404s. document.currentScript is valid during execution. */
  var SCRIPT_BASE = (function () {
    try {
      var cs = document.currentScript;
      if (cs && cs.src) return cs.src.replace(/[^/]*$/, "");
    } catch (err) {
      /* older engines */
    }
    return "/vvu-trust/surfaces/dashboard/"; /* honest fallback */
  })();
  var MAP_URL = SCRIPT_BASE + "keyboard-map.json";
  var G_WINDOW_MS = 600;
  var OVERLAY_MS = 5000;
  var STATUS_RATELIMIT_MS = 15000;

  var map = null; // keyboard-map.json
  var tabByKey = {}; // 'ctrl+1' → tab row
  var actionByKey = {}; // 'ctrl+a' → action row
  var chordBySecond = {}; // 'i' → chord row
  var teachOf = {}; // key → teach line (for Lindiwe's decay pass)

  /* ── helpers ── */
  function isEditable(target) {
    if (!(target instanceof HTMLElement)) return false;
    return (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable
    );
  }
  function normKey(e) {
    /* → 'ctrl+shift+p' / 'ctrl+1' / 'g' / 'i' (lowercased plain letters) */
    if (e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      return e.key.toLowerCase();
    }
    var parts = [];
    if (e.ctrlKey || e.metaKey) parts.push("ctrl");
    if (e.shiftKey) parts.push("shift");
    if (e.altKey) parts.push("alt");
    var k = e.key;
    if (!k) return null;
    if (k === " ") k = "space";
    if (k.length === 1) k = k.toLowerCase();
    else k = k.toLowerCase(); /* 'escape' etc. */
    parts.push(k);
    return parts.join("+");
  }
  function markUsed(key, teach, opts) {
    if (window.Lindiwe && teach) window.Lindiwe.markUsed(key, teach, opts);
  }

  /* ── WORM parity (fire-and-forget, failures logged not thrown) ── */
  function wormLog(action, reason) {
    try {
      fetch("/api/vvu/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor: "KEYBOARD", action: action, reason: reason }),
      }).catch(function (err) {
        console.warn("[keyboard-layer] audit POST failed:", err);
      });
    } catch (err) {
      /* never let logging break navigation */
    }
  }

  function navigate(route, byKey, label) {
    markUsed(byKey, teachOf[byKey]);
    if (window.location.hash !== route) window.location.hash = route;
    wormLog(
      "ROUTE_TOGGLE",
      "keyboard " + byKey + " → " + route + (label ? " (" + label + ")" : ""),
    );
  }

  /* ── the honest status line (actions with no handler are NEVER silent) ── */
  var lastStatusAt = 0,
    lastStatusAction = "";
  var statusEl = null;
  function statusLine(text) {
    var now = Date.now();
    if (text === lastStatusAction && now - lastStatusAt < STATUS_RATELIMIT_MS) return;
    lastStatusAt = now;
    lastStatusAction = text;
    if (!statusEl || !document.body.contains(statusEl)) {
      statusEl = document.createElement("div");
      statusEl.id = "vvu-action-status";
      statusEl.style.cssText =
        "position:fixed;left:12px;bottom:max(2rem, calc(env(safe-area-inset-bottom) + 1.75rem));" +
        'z-index:96;pointer-events:none;font-family:"Geist Mono",Menlo,Consolas,monospace;' +
        "font-size:8.5pt;letter-spacing:0.06em;color:#7a8a6e;" +
        "background:rgba(6,8,6,0.92);border:1px solid rgba(107,138,64,0.3);" +
        "padding:4px 9px;opacity:1;transition:opacity 350ms ease;";
      document.body.appendChild(statusEl);
    }
    statusEl.textContent = text;
    statusEl.style.opacity = "1";
    setTimeout(function () {
      if (statusEl) statusEl.style.opacity = "0";
    }, 3200);
  }

  function dispatchAction(row, e, inverse) {
    var action = row.action;
    markUsed(row.key, row.reserved ? null : row.teach);
    if (row.reserved) {
      /* still bound (PWA contexts) — but never executed silently in a tab
         where the browser owns it; when the event DID reach us, run it. */
    }
    /* verbs this layer implements itself (the panel system owns them) */
    var pins = window.VvuPins;
    if (action === "pin" && pins) {
      pins.pinCurrent();
      return;
    }
    if (action === "unpin" && pins) {
      pins.unpinCurrent();
      return;
    }
    if (action === "hide" && !inverse && pins) {
      pins.hideCurrent();
      return;
    }
    if (action === "reveal" && pins) {
      pins.revealLastHidden();
      return;
    }
    if (action === "pip" && pins) {
      pins.popCurrentVisual();
      return;
    }
    if (action === "yield") {
      navigate("#/ive", "ctrl+y", "YIELD → default surface");
      return;
    }
    if (action === "palette") {
      /* the app's CommandPalette owns ⌘K itself — this dispatch is for the
         FIND verb and surfaces; open it via the estate's event */
      window.dispatchEvent(new CustomEvent("vvu:open-palette", { detail: { via: "keyboard" } }));
      return;
    }
    /* everything else: dispatch and see if a surface claims it */
    var detail = {
      action: action,
      key: row.key,
      inverse: !!inverse,
      handled: false,
      verb: row.teach,
    };
    window.dispatchEvent(new CustomEvent("vvu:action", { detail: detail }));
    if (!detail.handled) {
      statusLine(
        action.toUpperCase() + " — NO TARGET ON THIS SURFACE · dispatched, no handler claimed it",
      );
    }
  }

  /* ── chord state ── */
  var gArmed = null;
  function cancelG() {
    if (gArmed) {
      clearTimeout(gArmed);
      gArmed = null;
    }
  }

  /* ── the handler ── */
  function onKeyDown(e) {
    if (!map) return;
    var key = normKey(e);
    if (!key) return;

    /* Esc — close modals (Radix handles its own; we only cancel chords),
       close the overlay, never preventDefault (dialogs must close). */
    if (key === "escape") {
      cancelG();
      hideOverlay();
      return;
    }

    var mod = e.ctrlKey || e.metaKey;

    /* ── Ctrl+Alt+<key> — discoverability gesture: flash, never execute.
         Ctrl+Alt+K specifically summons the FULL 5s keyboard-map overlay. */
    if (mod && e.altKey) {
      var bare = key.replace("ctrl+alt+", "").replace("alt+", "");
      if (bare === "k") {
        e.preventDefault();
        showOverlay();
        return;
      }
      var probe = "ctrl+" + bare;
      var row = tabByKey[probe] || actionByKey[probe];
      if (row) {
        e.preventDefault();
        if (row.reserved) flashReserved(probe, row);
        else flashHint(probe, row);
      }
      return;
    }

    /* ── chords: plain 'g' arms, the next plain key routes or cancels ── */
    if (!mod && !e.altKey) {
      if (gArmed !== null) {
        clearTimeout(gArmed);
        gArmed = null;
        var chord = chordBySecond[key];
        if (chord) {
          e.preventDefault();
          var chordId = "g-" + key;
          markUsed(chordId, teachOf["ctrl-" + chord.route]);
          if (window.location.hash !== chord.route) window.location.hash = chord.route;
          wormLog("ROUTE_TOGGLE", "keyboard chord g→" + key + " → " + chord.route);
        }
        return; /* consumed either way — silent cancel is correct */
      }
      if (key === "g" && !isEditable(e.target)) {
        gArmed = setTimeout(function () {
          gArmed = null;
        }, G_WINDOW_MS);
        return;
      }
      return;
    }

    if (!mod) return;

    /* ── Ctrl+Shift+<key> — the inverse ── */
    if (e.shiftKey) {
      var inv = actionByKey[key]; /* keys already carry shift, e.g. ctrl+shift+h */
      if (inv) {
        if (isEditable(e.target) && inv.key !== "ctrl+shift+h") return; /* let text fields live */
        e.preventDefault();
        dispatchAction(inv, e, true);
      }
      return;
    }

    /* ── Ctrl+<digit> — the ten fixed surfaces ── */
    var tab = tabByKey[key];
    if (tab) {
      e.preventDefault();
      navigate(tab.route, tab.key, tab.label);
      return;
    }

    /* ── Ctrl+<letter> — the action verbs ── */
    var act = actionByKey[key];
    if (act) {
      if (isEditable(e.target)) {
        /* in a text field the NATIVE meaning wins: Ctrl+A selects, Ctrl+C
           copies, Ctrl+Z undoes. Only the palette (the estate's flagship)
           and pin/unpin/pip remain layer-level. */
        var allowedInField = {
          "ctrl+k": 1,
          "ctrl+p": 1,
          "ctrl+u": 1,
          "ctrl+shift+p": 1,
          "ctrl+shift+h": 1,
        };
        if (!allowedInField[key]) {
          markUsed(key, null);
          return;
        }
      }
      if (key !== "ctrl+c") e.preventDefault(); /* native copy always wins */
      dispatchAction(act, e, false);
      return;
    }
  }

  /* ── discoverability: the ⌨ icon + the 5s overlay ── */
  var iconEl = null,
    overlayEl = null,
    overlayTimer = null;

  function flashHint(key, row) {
    /* a 5s flash of ONE binding without executing it (Ctrl+Alt+gesture) */
    var hint = document.createElement("div");
    hint.style.cssText =
      "position:fixed;right:14px;top:64px;z-index:97;pointer-events:none;" +
      'font-family:"Geist Mono",Menlo,Consolas,monospace;font-size:9pt;' +
      "color:#e0a030;background:rgba(6,8,6,0.94);border:1px solid rgba(224,160,48,0.4);" +
      "border-left:3px solid #e0a030;padding:6px 10px;transition:opacity 400ms ease;";
    hint.textContent = "⇢ " + pretty(key) + "  " + (row.teach || row.label || "");
    document.body.appendChild(hint);
    setTimeout(function () {
      hint.style.opacity = "0";
      setTimeout(function () {
        hint.remove();
      }, 460);
    }, OVERLAY_MS);
  }
  function flashReserved(key, row) {
    var hint = document.createElement("div");
    hint.style.cssText =
      "position:fixed;right:14px;top:64px;z-index:97;pointer-events:none;" +
      'font-family:"Geist Mono",Menlo,Consolas,monospace;font-size:9pt;' +
      "color:#e5484d;background:rgba(6,8,6,0.94);border:1px solid rgba(229,72,77,0.5);" +
      "border-left:3px solid #e5484d;padding:6px 10px;transition:opacity 400ms ease;";
    hint.textContent =
      "⇢ " + pretty(key) + "  " + (row.teach || "") + " — BROWSER-RESERVED ON DESKTOP TABS";
    document.body.appendChild(hint);
    setTimeout(function () {
      hint.style.opacity = "0";
      setTimeout(function () {
        hint.remove();
      }, 460);
    }, OVERLAY_MS);
  }
  function pretty(key) {
    return key
      .split("+")
      .map(function (p) {
        if (p === "ctrl") return "Ctrl";
        if (p === "shift") return "Shift";
        if (p === "alt") return "Alt";
        return p.length === 1 ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1);
      })
      .join("+");
  }

  function buildOverlay() {
    var o = document.createElement("div");
    o.id = "vvu-keyboard-overlay";
    o.setAttribute("role", "dialog");
    o.setAttribute("aria-label", "Keyboard map");
    o.style.cssText =
      "position:fixed;inset:0;z-index:98;display:flex;align-items:center;justify-content:center;" +
      "background:rgba(3,5,3,0.72);backdrop-filter:blur(2px);transition:opacity 480ms ease;" +
      'font-family:"Geist Mono",Menlo,Consolas,monospace;color:#c9d4bd;';
    var card = document.createElement("div");
    card.style.cssText =
      "background:rgba(6,8,6,0.97);border:1px solid rgba(107,138,64,0.4);padding:18px 22px;" +
      "max-width:min(720px,92vw);max-height:82vh;overflow:auto;font-size:9pt;line-height:1.7;";
    var html =
      '<div style="color:#c8ff00;letter-spacing:0.2em;font-size:10pt;margin-bottom:8px">KEYBOARD MAP</div>';
    html +=
      '<div style="color:#7a8a6e;letter-spacing:0.14em;font-size:7.5pt;margin-bottom:10px">TABS — THE TEN FIXED SURFACES</div>';
    map.tabs.forEach(function (t) {
      html +=
        '<div><b style="color:#f3e38a">' +
        pretty(t.key) +
        "</b> " +
        t.route +
        ' <span style="color:#7a8a6e">— ' +
        t.label.toLowerCase() +
        "</span></div>";
    });
    html +=
      '<div style="color:#7a8a6e;letter-spacing:0.14em;font-size:7.5pt;margin:10px 0">ACTIONS — VERBS ON THE CURRENT SURFACE</div>';
    map.actions.forEach(function (a) {
      var res = a.reserved
        ? ' <span style="color:#e5484d">· BROWSER-RESERVED ON DESKTOP TABS</span>'
        : "";
      html +=
        '<div><b style="color:#f3e38a">' +
        pretty(a.key) +
        '</b> <span style="color:#7a8a6e">— ' +
        a.teach +
        "</span>" +
        res +
        "</div>";
    });
    html +=
      '<div style="color:#7a8a6e;letter-spacing:0.14em;font-size:7.5pt;margin:10px 0">CHORDS — G, THEN KEY · 600MS WINDOW</div>';
    map.chords.forEach(function (c) {
      html +=
        '<div><b style="color:#f3e38a">G → ' + c.to.toUpperCase() + "</b> " + c.route + "</div>";
    });
    html +=
      '<div style="color:#7a8a6e;letter-spacing:0.14em;font-size:7.5pt;margin:10px 0">RULES</div>';
    html +=
      '<div style="color:#7a8a6e">Esc closes any modal · Ctrl+Shift+&lt;key&gt; is the inverse · Ctrl+Alt+&lt;key&gt; flashes a hint without executing · Lindiwe teaches once, then is silent</div>';
    html +=
      '<div style="color:#4a5744;margin-top:10px;font-size:7.5pt">PiP windows receive keyboard only when focused, and honour only Esc — a browser limitation, not a VVU limitation. Ctrl+N/T/W are reserved by desktop browsers; they fire in installed-PWA contexts only.</div>';
    html +=
      '<div style="color:#4a5744;margin-top:8px;font-size:7.5pt">source: keyboard-map.json · single source of truth · 5s, then this fades</div>';
    card.innerHTML = html;
    o.appendChild(card);
    o.addEventListener("click", hideOverlay);
    return o;
  }
  function showOverlay() {
    hideOverlay();
    overlayEl = buildOverlay();
    document.body.appendChild(overlayEl);
    overlayTimer = setTimeout(hideOverlay, OVERLAY_MS);
  }
  function hideOverlay() {
    if (overlayTimer) {
      clearTimeout(overlayTimer);
      overlayTimer = null;
    }
    if (overlayEl) {
      var o = overlayEl;
      overlayEl = null;
      o.style.opacity = "0";
      setTimeout(function () {
        o.remove();
      }, 500);
    }
  }

  function buildIcon() {
    var b = document.createElement("button");
    b.id = "vvu-keyboard-icon";
    b.setAttribute("aria-label", "Keyboard map (Ctrl+Alt+K)");
    b.title = "KEYBOARD MAP — 5s glance (Ctrl+Alt+K)";
    b.textContent = "⌨";
    b.style.cssText =
      "position:fixed;right:10px;top:44px;z-index:90;width:30px;height:30px;" +
      "display:flex;align-items:center;justify-content:center;cursor:pointer;" +
      "background:rgba(6,8,6,0.9);border:1px solid rgba(107,138,64,0.4);color:#7a8a6e;" +
      "font-size:13px;border-radius:3px;transition:color 150ms ease,border-color 150ms ease;";
    b.addEventListener("mouseenter", function () {
      b.style.color = "#c8ff00";
      b.style.borderColor = "rgba(200,255,0,0.5)";
    });
    b.addEventListener("mouseleave", function () {
      b.style.color = "#7a8a6e";
      b.style.borderColor = "rgba(107,138,64,0.4)";
    });
    b.addEventListener("click", showOverlay);
    document.body.appendChild(b);
  }

  /* ── boot: fetch the map (with honest retries — a transient 404 during a
     dev rebuild must not leave the layer inert for the whole session),
     build the indexes, listen ── */
  function fetchMap(attempt) {
    fetch(MAP_URL, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (m) {
        map = m;
        map.tabs.forEach(function (t) {
          tabByKey[t.key] = t;
          teachOf[t.key] = t.teach;
          teachOf["ctrl-" + t.route] = t.teach; /* chords teach the tab's line */
        });
        map.actions.forEach(function (a) {
          actionByKey[a.key] = a;
          teachOf[a.key] = a.teach;
        });
        map.chords.forEach(function (c) {
          chordBySecond[c.to] = c;
        });
        window.addEventListener("keydown", onKeyDown, true /* capture: first say */);
        buildIcon();
        if (window.Lindiwe) {
          /* the 5-day decay pass — once per load, quietly */
          window.Lindiwe.decayPass(teachOf);
        }
        window.dispatchEvent(
          new CustomEvent("vvu:keyboard-ready", {
            detail: {
              tabs: map.tabs.length,
              actions: map.actions.length,
              chords: map.chords.length,
            },
          }),
        );
      })
      .catch(function (err) {
        /* Task 48 — 8 → 20 retries: a COLD dev-server start (first visit
           after a restart compiles page + 27 workspaces + API routes; the
           cascade can outlast 8×1.5s=12s and left the layer inert for the
           session — observed live through the gateway). 20×1.5s=30s covers
           the cold cascade; warm loads still succeed on attempt 1. */
        if (attempt < 20) {
          /* transient (dev rebuild races can span a 10s compile) — retry
             with a 1.5s step, quietly, until the map arrives */
          console.warn(
            "[keyboard-layer] map fetch failed (attempt " + (attempt + 1) + "), retrying:",
            err && err.message ? err.message : err,
          );
          setTimeout(function () {
            fetchMap(attempt + 1);
          }, 1500);
          return;
        }
        console.error(
          "[keyboard-layer] keyboard-map.json failed to load — the layer is inert:",
          err,
        );
      });
  }
  fetchMap(0);
})();
