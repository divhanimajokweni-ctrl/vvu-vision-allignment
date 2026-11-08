"use client";

// src/components/vvu/VvuHeader.tsx — fixed top bar: Borromean rings logo,
// brand, tier badge, live FSM chip, socket LED, MRR + sim clock chips,
// guardian heartbeat chip (R71 — the 'last guardian save' fact, R70
// handoff priority #2, so a fresh pid is never a surprise), install
// button (R54 — the PWA install path), palette trigger (⌘K — also
// the mobile entry point), SAST clock.
// A 1px lime gradient edge (vvu-header-edge) finishes the chrome — and
// since R71 it TELLS THE TRUTH: when the guardian's gauge leaves the lime
// zone (amber ≥80% of guard, rose ≥95%/stale), the edge tints with it.

import { useEffect, useState } from "react";
import { Command, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { InstallButton } from "@/components/pwa/InstallButton";
import { GuardianHeartbeatChip } from "@/components/vvu/GuardianHeartbeatChip";
import { guardianZone, useGuardianHeartbeat } from "@/hooks/use-guardian-heartbeat";
import { useConnected, useFsmState, useFrame, useSendWormLog } from "@/hooks/use-vvu-socket";
import { RELEASE_TAG } from "@/lib/vvu-data";
import type { FsmState } from "@/types/vvu";

// Platform keycap hint — module-level (SSR-safe guard; text mismatch on Mac
// clients is suppressed on the span, so no hydration warning).
const IS_MAC =
  typeof navigator !== "undefined" &&
  /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent);

const FSM_COLOR: Record<FsmState, string> = {
  DISCONNECTED: "#7a8a6e",
  PAIRING_BLE: "#e0a030",
  TOTP_VERIFICATION: "#e0a030",
  STEADY_STATE_LOCKED: "#c8ff00",
  LEAK_ACTIVE: "#e5484d",
  THERMAL_THROTTLE: "#e0a030",
  FAIL_CLOSED: "#e5484d",
};

function BorromeanRings({ size = 34 }: { size?: number }) {
  const r = size * 0.3;
  const c = size / 2;
  const off = r * 0.62;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle
        cx={c - off * 0.87}
        cy={c - off * 0.5}
        r={r}
        fill="none"
        stroke="#8fb35a"
        strokeWidth={size * 0.045}
      />
      <circle
        cx={c + off * 0.87}
        cy={c - off * 0.5}
        r={r}
        fill="none"
        stroke="#f3e38a"
        strokeWidth={size * 0.045}
      />
      <circle cx={c} cy={c + off} r={r} fill="none" stroke="#c8ff00" strokeWidth={size * 0.045} />
    </svg>
  );
}

export function VvuHeader() {
  const fsm = useFsmState();
  const connected = useConnected();
  const frame = useFrame();
  const [clock, setClock] = useState("");
  // Task 16-a — DAYSHIFT light ops mode. setTheme is the ONLY next-themes
  // API used here; the icon visibility is pure CSS (globals.css), so nothing
  // is read at render time (no hydration concerns, dark output unchanged).
  const { setTheme } = useTheme();
  const sendWormLog = useSendWormLog();

  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString("en-ZA", {
          hour12: false,
          timeZone: "Africa/Johannesburg",
        }) + " SAST",
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const metrics = frame?.metrics;
  const mrr = metrics?.mrr ?? 0;
  const simMonth = metrics?.simMonth ?? null;
  const simDay = metrics?.simDay ?? null;
  const steadyHours = metrics?.steadyStateHours ?? null;

  // R71 — the guardian heartbeat: one light poll (30s) for the whole
  // estate's chrome; the chip renders it, the edge tints with it.
  const heartbeat = useGuardianHeartbeat();
  const heartbeatG = heartbeat.data?.guardian;
  const edgeGuard: "lime" | "amber" | "rose" | "dim" =
    heartbeat.data?.present && heartbeatG
      ? heartbeat.data?.stale || heartbeat.data?.guardianAlive === false
        ? "rose"
        : guardianZone(
            heartbeatG.rssKb != null ? Math.round(heartbeatG.rssKb / 1024) : null,
            heartbeatG.guardMb ?? null,
          )
      : "lime"; // guardian off / still loading — the classic edge, no theater

  const openPalette = () => {
    // The CommandPalette (src/components/vvu/CommandPalette.tsx) listens for
    // this event — the only reliable entry point on touch devices.
    window.dispatchEvent(new Event("vvu:open-palette"));
  };

  // Task 16-a — DAYSHIFT toggle. The click handler reads the CURRENT theme
  // from the DOM (client-only, always available post-mount) and flips it via
  // next-themes (data-theme attribute + localStorage persistence). WORM-audited
  // as THEME_TOGGLE · OPERATOR; stable toast id 'theme-toggle' (Round 11
  // convention — rapid toggles REPLACE, never stack). Mirrored 1:1 by the
  // palette command 'view-theme-toggle' in CommandPalette.tsx.
  const toggleTheme = () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    setTheme(next);
    sendWormLog(
      "THEME_TOGGLE",
      "OPERATOR",
      next === "light" ? "DAYSHIFT light ops mode" : "NIGHTWATCH scada dark mode",
    );
    toast(next === "light" ? "DAYSHIFT · LIGHT OPS MODE" : "NIGHTWATCH · SCADA DARK MODE", {
      id: "theme-toggle",
      description: next === "light" ? "high-contrast ops theme" : "standard SCADA palette",
    });
  };

  return (
    <header className="relative z-30 border-b border-[rgba(107,138,64,0.25)] bg-[rgba(6,8,6,0.92)] backdrop-blur-sm">
      <div className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4 h-12 sm:h-14">
        <BorromeanRings />
        <div className="min-w-0">
          <div className="vvu-label text-ochre text-[10px] sm:text-xs font-bold truncate text-[#f3e38a]">
            VENTURE VISION UBUNTU
          </div>
          <div className="vvu-label text-[6px] sm:text-[8px] text-[#7a8a6e] truncate hidden xs:block sm:block">
            PROOFBRIDGE-LINER · GQEBERHA EDGE · {RELEASE_TAG.split(" · ")[1] ?? "20260901"}
          </div>
        </div>

        <div className="flex-1" />

        {/* Live chips */}
        <div className="hidden md:flex items-center gap-2 vvu-label text-[8px]">
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-sm border ${
              connected
                ? "border-[rgba(107,138,64,0.45)] text-[#8fb35a]"
                : "border-[rgba(229,72,77,0.5)] text-[#e5484d]"
            }`}
          >
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full ${connected ? "bg-[#c8ff00] vvu-pulse" : "bg-[#e5484d] vvu-blink"}`}
            />
            {connected ? "TELEMETRY LIVE" : "RECONNECTING"}
          </span>
          <span
            className="px-2 py-1 rounded-sm border border-[rgba(107,138,64,0.25)] text-[#7a8a6e] cursor-default select-none transition-colors hover:border-[rgba(107,138,64,0.55)] hover:text-[#a8bd8a]"
            title="Monthly recurring revenue from the live telemetry frame"
          >
            MRR R{(mrr / 1000).toFixed(1)}k
          </span>
          {simMonth !== null && (
            <span
              className="px-2 py-1 rounded-sm border border-[rgba(243,227,138,0.28)] text-[#f3e38a] tabular-nums cursor-default select-none transition-colors hover:border-[rgba(243,227,138,0.55)]"
              title="Business simulation calendar — month rollover every 60s"
            >
              SIM M{simMonth}·D{simDay ?? 0}
            </span>
          )}
          {steadyHours !== null && (
            <span
              className="px-2 py-1 rounded-sm border border-[rgba(46,168,160,0.3)] text-[#2ea8a0] tabular-nums cursor-default select-none transition-colors hover:border-[rgba(46,168,160,0.6)]"
              title="Steady-state telemetry accrual — Gate 3C needs ≥72h"
            >
              {steadyHours.toFixed(1)}h STEADY
            </span>
          )}
        </div>

        {/* ── GUARDIAN HEARTBEAT (R71) — the 'last guardian save' fact.
            Renders its own compact variant under md: (the live-chips row
            above is desktop-only); the 390px row gets minutes-since-save.
            Click-through to #/watchdog; announces a landed save by toast. */}
        <GuardianHeartbeatChip data={heartbeat.data} isError={heartbeat.isError} />

        {/* ── INSTALL (R54 — the PWA install path) ──
            Chromium over HTTPS/localhost: the browser's own install prompt
            (deferred beforeinstallprompt). iOS Safari / HTTP-over-LAN /
            Firefox: the platform instruction sheet. Collapses to an
            INSTALLED chip once the estate runs standalone. Icon-only under
            sm: (the fixed 44px header row has no wordmark headroom at
            390px); 44px touch target, 36px from sm: — same rhythm as the
            DAYSHIFT toggle beside it. */}
        <InstallButton />

        {/* ── DAYSHIFT theme toggle — light/dark ops mode (Task 16-a) ──
            Both icons render; globals.css shows the SUN in dark mode
            ("switch to light") and the MOON in light mode. 44px touch target
            on mobile, 36px from sm: up — matches the palette trigger rhythm. */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle light/dark ops mode"
          title="DAYSHIFT light ops mode — high contrast for bright control rooms"
          className="flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] rounded-sm border border-[rgba(107,138,64,0.4)] text-[#8fb35a] hover:bg-[rgba(107,138,64,0.12)] hover:border-[rgba(107,138,64,0.6)] active:scale-[0.97] transition-all select-none"
        >
          <Sun className="w-3.5 h-3.5 vvu-theme-icon-sun" aria-hidden="true" />
          <Moon className="w-3.5 h-3.5 vvu-theme-icon-moon" aria-hidden="true" />
        </button>

        {/* ── palette trigger — mobile entry point for the command palette ── */}
        <button
          type="button"
          onClick={openPalette}
          aria-label="Open command palette"
          title="Command palette — view switching, FSM console, simulation controls"
          className="flex items-center gap-1.5 min-h-[40px] sm:min-h-[36px] px-2 sm:px-2.5 rounded-sm border border-[rgba(243,227,138,0.35)] bg-[rgba(243,227,138,0.06)] text-[#f3e38a] hover:bg-[rgba(243,227,138,0.12)] hover:border-[rgba(243,227,138,0.55)] active:scale-[0.97] transition-all select-none"
        >
          <Command className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" aria-hidden="true" />
          <span className="vvu-kbd hidden sm:inline" suppressHydrationWarning>
            {IS_MAC ? "⌘K" : "CTRL K"}
          </span>
        </button>

        <span
          className="vvu-label text-[7px] sm:text-[9px] px-2 py-1 rounded-sm border font-bold max-w-[110px] sm:max-w-none truncate"
          style={{
            color: FSM_COLOR[fsm ?? "DISCONNECTED"] ?? "#7a8a6e",
            borderColor: `${FSM_COLOR[fsm ?? "DISCONNECTED"]}55`,
            background: `${FSM_COLOR[fsm ?? "DISCONNECTED"]}12`,
          }}
          aria-live="polite"
          title={`estate FSM state: ${fsm ?? "BOOTING"}`}
        >
          {/* R93 — the long states (STEADY_STATE_LOCKED) overflowed a 390px
              viewport by ~18px: the full label lives at sm+, mobile gets the
              state's leading word (STEADY / WARN / LEAK), and the tooltip
              always carries the whole truth. */}
          <span className="hidden sm:inline">{fsm ?? "BOOTING"}</span>
          <span className="sm:hidden">{(fsm ?? "BOOTING").split("_")[0]}</span>
        </span>

        <span className="hidden sm:inline vvu-label text-[8px] text-[#7a8a6e] border border-[rgba(107,138,64,0.25)] px-2 py-1 rounded-sm">
          L1 · EIS v1.0
        </span>

        <span className="vvu-label text-[7px] sm:text-[9px] text-[#8fb35a] tabular-nums hidden xs:block">
          {clock}
        </span>
      </div>

      {/* 1px lime gradient edge — signature chrome line. R71: it tints
          with the guardian zone (amber/rose) so the chrome itself carries
          the distance-to-guard truth; lime/dim keeps the classic edge. */}
      <div
        className="vvu-header-edge"
        data-guard={edgeGuard === "amber" || edgeGuard === "rose" ? edgeGuard : undefined}
        aria-hidden="true"
      />
    </header>
  );
}
