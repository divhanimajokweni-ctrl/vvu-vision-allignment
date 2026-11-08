/* ==========================================================================
   pools/wildfire/wildfire-state.js — the single source of truth for the view.
   ==========================================================================
   Role (8-file contract, file 3): the state machine. Every operator-visible
   mode of the surface derives from this FSM:

       NORMAL → WATCH → DECLARED → ESCALATED → STAND_DOWN → (close) NORMAL

   Discipline (same FSM pattern as the telemetry service on :3003):
     · Reads and writes ONLY through the mesh/journal contract.
     · Every transition is a WORM event: wildfire.state.transition.
     · Every REFUSED transition is also a WORM event: wildfire.state.refused
       (no silent no-ops — an illegal command is evidence too).
     · Read-only by default: transitions happen only from the operator
       console, with an arm → confirm double step (03:00 hands, no
       accidental declarations).

   Zero deps. Classic script. Exposes window.WildfireState.
   ========================================================================== */

(function (global) {
  "use strict";

  var STATES = {
    NORMAL: {
      label: "NORMAL",
      color: "#52b788",
      banner: "NO ACTIVE EVENT — ROUTINE MONITORING",
      hint: "Fire danger index within seasonal norms. No advisory in force.",
    },
    WATCH: {
      label: "WATCH",
      color: "#f2b84b",
      banner: "FIRE WATCH — PRECAUTIONARY ADVISORY IN FORCE",
      hint: "Conditions support ignition. Precautionary zone published. Members advised to prepare.",
    },
    DECLARED: {
      label: "DECLARED",
      color: "#ff5a3d",
      banner: "STATE OF DISASTER — WILDFIRE (WARD 62)",
      hint: "Local state of disaster declared. Mandatory evacuation zone ACTIVE. Mesh on emergency window.",
    },
    ESCALATED: {
      label: "ESCALATED",
      color: "#ff2f1a",
      banner: "ESCALATED — MULTI-SECTOR RESPONSE",
      hint: "Fire crossing sector boundaries. Provincial resources requested. All shelters open.",
    },
    STAND_DOWN: {
      label: "STAND-DOWN",
      color: "#8fae94",
      banner: "STAND-DOWN — DEMOBILISING",
      hint: "Containment achieved. Mandatory evacuation LIFTED. Re-entry managed by ward ops.",
    },
  };

  /* trigger catalogue — the ONLY legal paths through the machine */
  var TRIGGERS = {
    watch: { from: ["NORMAL"], to: "WATCH", label: "RAISE WATCH" },
    all_clear: { from: ["WATCH"], to: "NORMAL", label: "ALL CLEAR" },
    declare: { from: ["WATCH"], to: "DECLARED", label: "DECLARE DISASTER" },
    escalate: { from: ["DECLARED"], to: "ESCALATED", label: "ESCALATE" },
    stand_down: { from: ["DECLARED", "ESCALATED"], to: "STAND_DOWN", label: "STAND DOWN" },
    reset: { from: ["STAND_DOWN"], to: "NORMAL", label: "CLOSE EVENT" },
  };

  var state = "NORMAL";
  var sinceTs = null; /* when the CURRENT state was entered */
  var enteredAt = null; /* ISO ts of first entry (session) */
  var history = []; /* [{from,to,trigger,ts}] — mirrors the journal */
  var listeners = [];

  function journal() {
    return global.WildfireEvidence;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function snapshot() {
    return {
      state: state,
      meta: STATES[state],
      sinceTs: sinceTs,
      enteredAt: enteredAt,
      history: history.slice(),
      /* evacuation implication — drives the map + panels */
      evacMandatory: state === "DECLARED" || state === "ESCALATED",
      fireActive: state === "WATCH" || state === "DECLARED" || state === "ESCALATED",
      transitions: legalTriggers(),
    };
  }

  function legalTriggers() {
    var out = [];
    Object.keys(TRIGGERS).forEach(function (t) {
      if (TRIGGERS[t].from.indexOf(state) !== -1) out.push(t);
    });
    return out;
  }

  function notify() {
    var snap = snapshot();
    listeners.slice().forEach(function (fn) {
      try {
        fn(snap);
      } catch (e) {
        /* a broken listener never breaks the FSM */
      }
    });
  }

  /**
   * Attempt a transition. Returns { ok, from, to?, refused? }.
   * BOTH outcomes are journaled (append-only — refusal is evidence).
   */
  function transition(trigger, actor) {
    var t = TRIGGERS[trigger];
    var who = actor || "OPERATOR";
    if (!t) {
      journalAppend(
        "wildfire.state.refused",
        JSON.stringify({
          state: state,
          trigger: trigger,
          reason: "unknown trigger",
        }),
        who,
      );
      notify();
      return { ok: false, refused: "unknown trigger" };
    }
    if (t.from.indexOf(state) === -1) {
      journalAppend(
        "wildfire.state.refused",
        JSON.stringify({
          state: state,
          trigger: trigger,
          reason: "illegal transition from " + state,
        }),
        who,
      );
      notify();
      return { ok: false, refused: "illegal transition from " + state };
    }
    var from = state;
    state = t.to;
    sinceTs = nowIso();
    history.push({ from: from, to: t.to, trigger: trigger, ts: sinceTs });
    journalAppend(
      "wildfire.state.transition",
      JSON.stringify({
        from: from,
        to: t.to,
        trigger: trigger,
        actor: who,
      }),
      who,
    );
    notify();
    return { ok: true, from: from, to: t.to };
  }

  function journalAppend(event, details, actor) {
    var j = journal();
    if (j && typeof j.append === "function") {
      j.append(event, details, actor); /* async chain append — fire and forget */
    }
  }

  /* ---- boot --------------------------------------------------------------- */

  function init() {
    state = "NORMAL";
    sinceTs = nowIso();
    enteredAt = sinceTs;
    history = [];

    /* THE JOURNAL IS THE SOURCE OF TRUTH: if a previous session recorded a
       state transition, the machine RESTORES it — an emergency view must
       never silently reset to NORMAL on a browser crash or reload while a
       disaster is declared. The last transition in the chain wins. */
    var j = journal();
    if (j && typeof j.snapshot === "function") {
      var evs = j.snapshot().events || [];
      for (var i = evs.length - 1; i >= 0; i--) {
        var e = evs[i];
        if (e.event === "wildfire.state.transition") {
          try {
            var rec = JSON.parse(e.details);
            if (rec && STATES[rec.to]) {
              state = rec.to;
              sinceTs = e.ts;
              history.push({ from: rec.from, to: rec.to, trigger: rec.trigger, ts: e.ts });
            }
          } catch (err) {
            /* malformed record — keep NORMAL */
          }
          break; /* the LAST transition is the current state */
        }
      }
    }

    journalAppend(
      "wildfire.state.boot",
      JSON.stringify({
        initial: state,
        restored: history.length > 0,
        surface: "pools/wildfire/cape_town_wildfire.html",
      }),
      "SYSTEM",
    );
    notify();
    return snapshot();
  }

  /* ---- public contract ------------------------------------------------------ */

  global.WildfireState = {
    STATES: STATES,
    TRIGGERS: TRIGGERS,
    init: init,
    transition: transition,
    snapshot: snapshot,
    legalTriggers: legalTriggers,
    subscribe: function (fn) {
      listeners.push(fn);
      return function () {
        var i = listeners.indexOf(fn);
        if (i !== -1) listeners.splice(i, 1);
      };
    },
  };
})(window);
