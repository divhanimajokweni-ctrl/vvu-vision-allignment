"use client";

import { useEffect, useState } from "react";
import { Wifi, WifiOff, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type ConnectionState = "online" | "offline" | "reconnecting";

/**
 * Detects network status via:
 * 1. navigator.onLine (browser event)
 * 2. Failed fetch attempts (service worker fallback)
 * Shows a sticky banner at the top when offline.
 */
export function OfflineIndicator() {
  const [state, setState] = useState<ConnectionState>("online");
  const [dismissed, setDismissed] = useState(false);
  const [lastOnline, setLastOnline] = useState<Date | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const updateState = () => {
        if (navigator.onLine) {
          setState((prev) => {
            if (prev === "offline") return "reconnecting";
            return "online";
          });
          setLastOnline(new Date());
        } else {
          setState("offline");
        }
      };

      // Initial check
      updateState();

      // Listen for browser online/offline events
      window.addEventListener("online", updateState);
      window.addEventListener("offline", updateState);

      // Also poll the WS service as a secondary check
      const pollWs = async () => {
        try {
          // Try fetching the WS health endpoint via the Caddy gateway
          const res = await fetch("/api/vvu/db-stats", {
            cache: "no-store",
            signal: AbortSignal.timeout(5000),
          });
          if (!res.ok) throw new Error("health check failed");
          setState((prev) => (prev === "offline" ? "reconnecting" : "online"));
        } catch {
          setState((prev) => (prev === "online" ? "offline" : prev));
        }
      };

      // Poll every 30s
      const pollId = setInterval(pollWs, 30_000);

(window as { __vvuOfflineCleanup?: () => void }).__vvuOfflineCleanup = () => {
        window.removeEventListener("online", updateState);
        window.removeEventListener("offline", updateState);
        clearInterval(pollId);
      };
    });
    return () => {
      cancelAnimationFrame(id);
const cleanup = (window as { __vvuOfflineCleanup?: () => void }).__vvuOfflineCleanup;
      if (cleanup) cleanup();
    };
  }, []);

  // Auto-clear "reconnecting" after 3s if still online
  useEffect(() => {
    if (state === "reconnecting") {
      const id = setTimeout(() => {
        if (navigator.onLine) setState("online");
      }, 3000);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [state]);

  // Reset dismissed when state changes
  useEffect(() => {
    setDismissed(false);
  }, [state]);

  if (state === "online" || dismissed) return null;

  const isOffline = state === "offline";

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[60] px-3 py-1.5 text-xs flex items-center justify-between gap-2 vvu-slide-in ${
        isOffline
          ? "bg-red-950/95 border-b border-red-700 text-red-100"
          : "bg-amber-950/95 border-b border-amber-700 text-amber-100"
      } backdrop-blur`}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-center gap-2">
        {isOffline ? (
          <WifiOff className="h-3.5 w-3.5 animate-pulse" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        )}
        <span className="font-medium">
          {isOffline ? (
            <>
              You&apos;re offline. Showing cached dashboard data —{" "}
              <span className="text-red-300">live telemetry paused</span>.
            </>
          ) : (
            <>
              Reconnecting… <span className="text-amber-300">restoring live data feed</span>.
            </>
          )}
        </span>
        {lastOnline && isOffline && (
          <span className="text-red-300/70 font-mono">
            last online {lastOnline.toLocaleTimeString()}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {isOffline && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px] text-red-100 hover:bg-red-900/50"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-3 w-3 mr-1" /> Retry
          </Button>
        )}
        <button
          onClick={() => setDismissed(true)}
          className="text-current/70 hover:text-current"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/**
 * Compact WS status dot for the topbar — shows green/amber/red based on connection.
 */
export function ConnectionDot({ connected }: { connected: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full vvu-status-dot ${
        connected ? "bg-lime-400" : "bg-red-500"
      }`}
      title={connected ? "Connected" : "Disconnected"}
    />
  );
}
