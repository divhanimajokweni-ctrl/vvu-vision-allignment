"use client";
// VVU share button — copies the current deep-link URL to clipboard.
import React from "react";
import { toast } from "./toast";
import { useNav } from "./nav";

export function ShareButton() {
  const env = useNav((s) => s.env);
  const view = useNav((s) => s.view);

  const share = async () => {
    const envId = env;
    const viewId = view[envId];
    const hash = viewId && envId !== "overview" && envId !== "bridge"
      ? `#/${envId}/${viewId}`
      : envId === "bridge"
        ? "#/bridge/flow"
        : "#/";
    const url = `${window.location.origin}${window.location.pathname}${hash}`;
    try {
      await navigator.clipboard.writeText(url);
      toast(`copied deep-link · ${hash}`, "ok");
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = url; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); toast(`copied deep-link · ${hash}`, "ok"); }
      catch { toast("clipboard copy failed", "bad"); }
      document.body.removeChild(ta);
    }
  };

  return (
    <button
      className="vvu-iconbtn"
      onClick={share}
      title="copy deep-link URL to clipboard"
      aria-label="share current view"
    >
      ↗
    </button>
  );
}
