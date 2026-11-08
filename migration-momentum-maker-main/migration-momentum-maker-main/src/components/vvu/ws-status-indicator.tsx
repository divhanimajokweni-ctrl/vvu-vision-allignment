"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Radio, Wifi, WifiOff, Unplug } from "lucide-react";
import { cn } from "@/lib/utils";

interface WsStatusIndicatorProps {
  connected: boolean;
  error?: string | null;
  lastTick?: number;
  wormHead?: string | null;
  compact?: boolean;
}

export function WsStatusIndicator({
  connected,
  error,
  lastTick,
  wormHead,
  compact,
}: WsStatusIndicatorProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              "font-mono gap-1 cursor-help",
              connected
                ? "border-lime-700 bg-lime-950/50 text-lime-300"
                : "border-slate-700 bg-slate-950/50 text-slate-400",
            )}
          >
            {connected ? (
              <Wifi className="h-3 w-3 animate-pulse" />
            ) : (
              <WifiOff className="h-3 w-3" />
            )}
            {compact ? "WS" : connected ? "WS LIVE" : "WS OFFLINE"}
            {connected && lastTick !== undefined && (
              <span className="text-[9px] text-muted-foreground">#{lastTick}</span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-1 text-[10px] font-mono">
            <div className="font-bold text-foreground">VVU Telemetry WebSocket (:3003)</div>
            <div className={connected ? "text-lime-400" : "text-red-400"}>
              {connected ? "● CONNECTED" : "● DISCONNECTED"}
            </div>
            {error && <div className="text-red-400">error: {error}</div>}
            {connected && wormHead && <div className="text-violet-300">WORM head: {wormHead}</div>}
            <div className="text-muted-foreground">Real-time push · in-app telemetry feed</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
