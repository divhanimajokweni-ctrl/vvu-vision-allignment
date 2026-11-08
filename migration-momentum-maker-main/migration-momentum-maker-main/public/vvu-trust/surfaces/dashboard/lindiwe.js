/* lindiwe.js — Task 47 · LINDIWE, the adaptive tutor.
 *
 * THE LINDIWE PRINCIPLE, STATED PLAINLY:
 *   The best tutor is the one who becomes unnecessary.
 *   Teach once. Then be silent. Return only if forgotten.
 *   Never nag. Never celebrate. Never leave.
 *
 * WHAT SHE IS: a small, quiet system that teaches keyboard shortcuts in
 * context and then gets out of the way. Not a chatbot. Not an assistant.
 * Not a personality. She speaks in short sentences. She never celebrates.
 * She appears, shows, and leaves.
 *
 * MASTERY (counted, never claimed):
 *   0 uses  — not yet introduced
 *   1 use   — taught in context, at the moment of first use
 *   2 uses  — taught once more ONLY if the first teach was missed (tab
 *             hidden); otherwise silence
 *   3 uses  — mastered. Silence is the reward. No confirmations, no
 *             congratulations, no key-flash pips.
 *   5 days  — a mastered shortcut unused for 5 days is reintroduced ONCE,
 *             quietly, at next load. Bumping last_used after that single
 *             reminder is what makes it "once" — she will not nag.
 *
 * SILENCE RULES:
 *   · user idle 30+s → she does not appear (silence is correct)
 *   · everything on a surface mastered → nothing, ever, until a new
 *     shortcut is added
 *   · browser-reserved combos (ctrl+n/t/w) are NEVER taught — teaching a
 *     key that closes the tab in desktop Chrome would be sabotage, not
 *     teaching (declared in keyboard-map.json `reserved`)
 *   · more than two candidates → the two longest-forgotten win; the rest
 *     are dropped, not queued
 *
 * STATE — localStorage.vvu.lindiwe.v1, exact spec shape, nothing leaves
 * the browser, no server call, ever:
 *   { "version": 1,
 *     "shortcuts": { "ctrl+1": { uses, last_used, mastered } },
 *     "last_active": <ms> }
 *
 * VOICE (allowed: "Press Ctrl+P to pin this panel." / forbidden: "Great
 * job!", "You've mastered this", exclamation marks, first person):
 *   the hint is nine characters of shortcut, three words of description:
 *     ⇢ Ctrl+P  pin this panel
 */

(function () {
  "use strict";

  var STORAGE_KEY = "vvu.lindiwe.v1";
  var HINT_MS = 5000;
  var FADE_MS = 400;
  var IDLE_SILENCE_MS = 30 * 1000;
  var DECAY_MS = 5 * 24 * 60 * 60 * 1000; /* 5 days */
  var MAX_STACKED = 2;
  var AMBER = "#e0a030";

  /* ── state ── */
  var state = { version: 1, shortcuts: {}, last_active: 0 };
  var loaded = false;

  function load() {
    if (loaded) return state;
    loaded = true;
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (
          parsed &&
          parsed.version === 1 &&
          parsed.shortcuts &&
          typeof parsed.shortcuts === "object"
        ) {
          state = parsed;
        }
      }
    } catch (err) {
      /* storage blocked / private mode — Lindiwe works from memory this
         session and never crashes the surface for a tutorial hint. */
      state = { version: 1, shortcuts: {}, last_active: 0 };
    }
    return state;
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      /* live listeners (Settings' mastery table) — same-tab only, no server */
      window.dispatchEvent(
        new CustomEvent("vvu:lindiwe-changed", { detail: { key: STORAGE_KEY } }),
      );
    } catch (err) {
      /* session-only */
    }
  }

  function entry(key) {
    if (!state.shortcuts[key]) {
      state.shortcuts[key] = { uses: 0, last_used: 0, mastered: false };
    }
    return state.shortcuts[key];
  }

  /* ── idle tracking (silence when the user is idle) ── */
  var lastInteraction = Date.now();
  ["keydown", "pointerdown", "wheel", "touchstart"].forEach(function (ev) {
    window.addEventListener(
      ev,
      function () {
        lastInteraction = Date.now();
      },
      { passive: true, capture: true },
    );
  });
  function userIdle() {
    return Date.now() - lastInteraction > IDLE_SILENCE_MS;
  }

  /* ── the hint renderer — a whisper, not a panel ── */
  var stackEl = null;
  function ensureStack() {
    if (stackEl && document.body.contains(stackEl)) return stackEl;
    stackEl = document.createElement("div");
    stackEl.id = "lindiwe-stack";
    stackEl.setAttribute("aria-live", "polite");
    stackEl.style.cssText =
      "position:fixed;left:12px;bottom:max(3.5rem, calc(env(safe-area-inset-bottom) + 3rem));" +
      "z-index:95;display:flex;flex-direction:column;gap:6px;pointer-events:none;" +
      'font-family:"Geist Mono","SFMono-Regular",Menlo,Consolas,monospace;';
    document.body.appendChild(stackEl);
    return stackEl;
  }

  function prettyKey(key) {
    return key
      .split("+")
      .map(function (part) {
        if (part === "ctrl") return "Ctrl";
        if (part === "shift") return "Shift";
        if (part === "alt") return "Alt";
        if (part.length === 1) return part.toUpperCase();
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join("+")
      .replace(/^g\-/, "G → ");
  }

  /** Show one hint. Returns true when it rendered. */
  function show(key, teach) {
    if (userIdle()) return false; /* silence is correct */
    if (document.hidden) return false; /* nobody home */
    var stack = ensureStack();
    while (stack.children.length >= MAX_STACKED) {
      stack.removeChild(stack.firstChild); /* two, never more */
    }
    var hint = document.createElement("div");
    hint.className = "lindiwe-hint";
    hint.setAttribute("role", "status");
    /* the whole hint: ⇢ Ctrl+P  pin this panel — 9pt, soft amber */
    hint.style.cssText =
      "font-size:9pt;line-height:1.5;letter-spacing:0.04em;color:" +
      AMBER +
      ";" +
      "background:rgba(6,8,6,0.92);border:1px solid rgba(224,160,48,0.35);" +
      "border-left:3px solid " +
      AMBER +
      ";padding:5px 10px;max-width:340px;" +
      "opacity:1;transition:opacity " +
      FADE_MS +
      "ms ease;";
    var arrow = document.createElement("span");
    arrow.textContent = "⇢ ";
    var k = document.createElement("b");
    k.style.fontWeight = "600";
    k.style.color = "#f3e38a";
    k.textContent = prettyKey(key);
    var sep = document.createElement("span");
    sep.textContent = "  ";
    sep.style.whiteSpace = "pre";
    var words = document.createElement("span");
    words.textContent = teach;
    hint.appendChild(arrow);
    hint.appendChild(k);
    hint.appendChild(sep);
    hint.appendChild(words);
    stack.appendChild(hint);
    setTimeout(function () {
      hint.style.opacity = "0";
      setTimeout(function () {
        if (hint.parentNode) hint.parentNode.removeChild(hint);
      }, FADE_MS + 60);
    }, HINT_MS);
    return true;
  }

  /* ── the public API (window.Lindiwe) ── */

  /** Mark a use. Counts toward mastery. May whisper — see rules above.
   *  opts.skipHint: true when the use IS the teach moment elsewhere. */
  function markUsed(key, teach, opts) {
    load();
    opts = opts || {};
    var e = entry(key);
    var wasUses = e.uses;
    e.uses += 1;
    e.last_used = Date.now();
    state.last_active = Date.now();
    if (e.uses >= 3) e.mastered = true;
    save();
    if (opts.skipHint || !teach) return false;
    /* teach at first use; once more only if the first teach was missed */
    var showed = false;
    if (e.uses === 1) {
      showed = show(key, teach);
    } else if (e.uses === 2 && !e.firstTeachSeen) {
      showed = show(key, teach);
    }
    if (showed) {
      e.firstTeachSeen = true;
      save();
    }
    return showed;
  }

  /** Decay pass — run once at boot: mastered shortcuts unused for 5 days
   *  are reintroduced ONCE (the two longest-forgotten, never more than
   *  two, the rest dropped). Bumping last_used is what makes it once. */
  function decayPass(teachOf) {
    load();
    var now = Date.now();
    var candidates = [];
    Object.keys(state.shortcuts).forEach(function (key) {
      var e = state.shortcuts[key];
      if (e.mastered && e.last_used && now - e.last_used > DECAY_MS && teachOf[key]) {
        candidates.push({ key: key, last: e.last_used });
      }
    });
    if (!candidates.length) return;
    candidates.sort(function (a, b) {
      return a.last - b.last;
    }); /* longest forgotten first */
    var shown = 0;
    for (var i = 0; i < candidates.length && shown < MAX_STACKED; i++) {
      var c = candidates[i];
      if (show(c.key, teachOf[c.key])) {
        state.shortcuts[c.key].last_used = now; /* once — the clock restarts */
        shown += 1;
      }
    }
    save();
  }

  /** Snapshot for Settings — the mastery table reads this. */
  function snapshot() {
    load();
    return JSON.parse(JSON.stringify(state));
  }

  /** Reset (Settings' guarded RESET). Wipes mastery — she teaches again
   *  from zero. */
  function reset() {
    state = { version: 1, shortcuts: {}, last_active: 0 };
    save();
  }

  window.Lindiwe = {
    markUsed: function (key, teach, opts) {
      markUsed(key, teach, opts); /* returns showed — recorded inside */
    },
    decayPass: decayPass,
    snapshot: snapshot,
    reset: reset,
    _showForSettings: function () {
      return {
        hint_ms: HINT_MS,
        idle_silence_ms: IDLE_SILENCE_MS,
        decay_ms: DECAY_MS,
        max_stacked: MAX_STACKED,
      };
    },
  };
})();
