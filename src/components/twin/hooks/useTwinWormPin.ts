"use client";

// src/components/twin/hooks/useTwinWormPin.ts — WORM ledger visibility pin
// (authorized Option 1). Toggles the artifact's `#hud-bottom` WORM strip at
// RUNTIME through the same-origin iframe's contentDocument. The artifact
// file itself is NEVER modified — byte fidelity is preserved (md5 enforced
// by /api/vvu/twin-scenario).
//
// Discipline:
//   · DEFAULT_VISIBLE = true — a hidden WORM strip is a hidden receipt.
//     The pin exists so a DEMONSTRATOR can temporarily hide it, never so
//     an operator forgets it exists.
//   · Persisted in localStorage ("1"/"0") — private-mode failures are
//     silent no-ops, never crashes.
//   · Re-applied on every iframe `load` so the artifact's own boot script
//     cannot silently re-show the strip behind the operator's back.
//   · Cross-origin future: if the artifact ever moves to a subdomain,
//     contentDocument throws → silent no-op (never a crash, never a lie
//     that the strip is hidden when we cannot know).

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "vvu.twin.worm.visible";
const DEFAULT_VISIBLE = true; // Option 1 (authorized): visible by default

function readPin(): boolean {
  if (typeof window === "undefined") return DEFAULT_VISIBLE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "0") return false;
    if (raw === "1") return true;
    return DEFAULT_VISIBLE;
  } catch {
    return DEFAULT_VISIBLE;
  }
}

function writePin(visible: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, visible ? "1" : "0");
  } catch {
    /* storage blocked (private mode) — silent, non-fatal */
  }
}

function applyToFrame(iframe: HTMLIFrameElement | null, visible: boolean) {
  if (!iframe) return;
  let doc: Document | null = null;
  try {
    doc = iframe.contentDocument;
  } catch {
    return; // cross-origin (future) — silent no-op
  }
  if (!doc) return;
  const worm = doc.getElementById("hud-bottom");
  if (!worm) return;
  worm.style.display = visible ? "flex" : "none";
  doc.documentElement.dataset.wormVisible = visible ? "1" : "0";
}

export function useTwinWormPin() {
  const [visible, setVisible] = useState<boolean>(() => readPin());

  const toggle = useCallback(() => {
    setVisible((v) => {
      const next = !v;
      writePin(next);
      return next;
    });
  }, []);

  const show = useCallback(() => {
    setVisible(true);
    writePin(true);
  }, []);

  const hide = useCallback(() => {
    setVisible(false);
    writePin(false);
  }, []);

  // Re-apply on every iframe load — defeats the scenario's own load script.
  const attachTo = useCallback(
    (iframe: HTMLIFrameElement | null) => {
      applyToFrame(iframe, visible);
      if (!iframe) return () => {};
      const onLoad = () => applyToFrame(iframe, visible);
      iframe.addEventListener("load", onLoad);
      return () => iframe.removeEventListener("load", onLoad);
    },
    [visible],
  );

  return { visible, toggle, show, hide, attachTo };
}
