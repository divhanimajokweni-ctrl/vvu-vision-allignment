"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Clock, Activity, Zap, Server, Wifi, AlertCircle, Link2, RadioTower } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardStatusBarProps {
  wsConnected: boolean;
  fsmState: string | null;
  eisPct: number | null;
  telemetryRate: number;
  wormHead?: string | null;
  lastTelemetryAt?: number | null;
  lastTelemetryTick?: number | null;
}

export function DashboardStatusBar({
  wsConnected,
  fsmState,
  eisPct,
  telemetryRate,
  wormHead,
  lastTelemetryAt,
  lastTelemetryTick,
}: DashboardStatusBarProps) {
  const [now, setNow] = useState<Date>(new Date());
  const [uptime, setUptime] = useState<number>(0);
  const [sessionStart] = useState<number>(Date.now());

  // Live clock — updates every second
  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date());
      setUptime(Math.floor((Date.now() - sessionStart) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [sessionStart]);

  function formatUptime(s: number): string {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${m}m ${sec}s`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
  }

  function formatUTC(d: Date): string {
    return (
      d.toLocaleTimeString("en-ZA", {
        timeZone: "Africa/Johannesburg",
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }) + " SAST"
    );
  }

  const stateColor =
    fsmState === "FAIL_CLOSED_LOCKDOWN"
      ? "text-red-400"
      : fsmState === "THERMAL_THROTTLE"
        ? "text-orange-400"
        : fsmState === "LEAK_SIMULATION_ACTIVE"
          ? "text-orange-400"
          : fsmState === "STEADY_STATE_LOCKED"
            ? "text-lime-400"
            : "text-muted-foreground";

  const eisColor =
    (eisPct ?? 100) >= 80
      ? "text-lime-400"
      : (eisPct ?? 100) >= 60
        ? "text-amber-400"
        : "text-red-400";

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border/40 bg-background/60 backdrop-blur text-[10px] font-mono overflow-x-auto">
      {/* Live clock */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Clock className="h-3 w-3 text-muted-foreground" />
        <span className="text-foreground vvu-tabular">{formatUTC(now)}</span>
      </div>

      <span className="text-border">·</span>

      {/* Session uptime */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Activity className="h-3 w-3 text-muted-foreground" />
        <span className="text-muted-foreground">session</span>
        <span className="text-foreground vvu-tabular">{formatUptime(uptime)}</span>
      </div>

      <span className="text-border">·</span>

      {/* FSM state */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Zap className={cn("h-3 w-3", stateColor)} />
        <span className={stateColor}>{fsmState?.replace(/_/g, " ") ?? "—"}</span>
      </div>

      <span className="text-border">·</span>

      {/* EIS */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-muted-foreground">EIS</span>
        <span className={eisColor}>{eisPct !== null ? `${eisPct.toFixed(1)}%` : "—"}</span>
      </div>

      <span className="text-border">·</span>

      {/* Telemetry rate */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-muted-foreground">rate</span>
        <span className="text-sky-300">{telemetryRate}/min</span>
      </div>

      {/* Last telemetry tick (if available) */}
      {lastTelemetryTick !== undefined && lastTelemetryTick !== null && (
        <>
          <span className="text-border">·</span>
          <div className="flex items-center gap-1.5 shrink-0">
            <RadioTower className="h-3 w-3 text-violet-400" />
            <span className="text-muted-foreground">tick</span>
            <span className="text-violet-300 vvu-tabular">#{lastTelemetryTick}</span>
          </div>
        </>
      )}

      {/* Right-aligned items */}
      <div className="ml-auto flex items-center gap-3 shrink-0">
        {/* WORM chain head */}
        {wormHead && (
          <div className="flex items-center gap-1.5">
            <Link2 className="h-3 w-3 text-amber-400" />
            <span className="text-muted-foreground">WORM</span>
            <span className="text-amber-300 font-mono">{wormHead.slice(0, 8)}</span>
          </div>
        )}

        {wormHead && <span className="text-border">·</span>}

        {/* WS status */}
        <div className="flex items-center gap-1.5">
          {wsConnected ? (
            <Wifi className="h-3 w-3 text-lime-400 vvu-status-dot" />
          ) : (
            <AlertCircle className="h-3 w-3 text-red-400" />
          )}
          <span className={wsConnected ? "text-lime-400" : "text-red-400"}>
            {wsConnected ? "WS :3003" : "WS offline"}
          </span>
        </div>

        <span className="text-border">·</span>

        {/* Server */}
        <div className="flex items-center gap-1.5">
          <Server className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">prod :3000</span>
        </div>
      </div>
    </div>
  );
}
