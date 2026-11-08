"use client";

// src/components/twin/components/WormLedgerPin.tsx — the WORM pin button
// (authorized Option 1). Lives on the FRAME rail (never inside the
// artifact). Right-aligned in the rail, 8px left of the OPEN STANDALONE
// cluster, and deliberately OUT of the fixed lime toggle's corner (the
// worklog reserves that corner — a second floating button there collides).

import { useEffect, type RefObject } from "react";
import { useTwinWormPin } from "../hooks/useTwinWormPin";
import "./WormLedgerPin.css";

export function WormLedgerPin({ iframeRef }: { iframeRef: RefObject<HTMLIFrameElement | null> }) {
  const { visible, toggle, attachTo } = useTwinWormPin();

  useEffect(() => {
    // attachTo also re-applies on every iframe load (see the hook) — the
    // cleanup removes the listener when the rail re-renders.
    return attachTo(iframeRef.current);
  }, [attachTo, iframeRef]);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={visible}
      aria-label={
        visible
          ? "Hide WORM ledger strip in the twin artifact"
          : "Show WORM ledger strip in the twin artifact"
      }
      title={visible ? "Hide WORM ledger" : "Show WORM ledger"}
      className="twin-worm-pin"
      data-visible={visible ? "1" : "0"}
    >
      <span className="twin-worm-pin-dot" aria-hidden="true" />
      WORM {visible ? "ON" : "OFF"}
    </button>
  );
}
