"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface TelemetryRow {
  id: string;
  nodeId: string;
  flowRateLs: number;
  pressureHeadM: number;
  apuTemperatureC: number;
  acousticAbnormal: boolean;
  estimatedCelerity: number;
  invariantOk: boolean;
  systemState: string;
  createdAt: string;
}

interface TelemetryFeedProps {
  rows: TelemetryRow[];
  loading?: boolean;
}

export function TelemetryFeed({ rows, loading }: TelemetryFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to the most recent (bottom)
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [rows]);

  return (
    <div className="flex flex-col h-full">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Live Telemetry Feed</h3>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-lime-500 animate-pulse" />
          <span>{rows.length} events · auto-refresh</span>
        </div>
      </div>
      <ScrollArea className="h-[280px] w-full rounded border border-border vvu-surface-deep">
        <div ref={scrollRef} className="max-h-[280px] overflow-y-auto">
          {rows.length === 0 && !loading && (
            <div className="flex h-full items-center justify-center py-8 text-xs text-muted-foreground">
              No telemetry — simulate an event below.
            </div>
          )}
          {loading && rows.length === 0 && (
            <div className="flex h-full items-center justify-center py-8 text-xs text-muted-foreground">
              Loading…
            </div>
          )}
          <ul className="divide-y divide-border/40 font-mono text-[11px]">
            {rows.map((r) => {
              const warn = !r.invariantOk || r.acousticAbnormal || r.apuTemperatureC >= 65;
              return (
                <li
                  key={r.id}
                  className={cn(
                    "grid grid-cols-[80px_1fr_auto] gap-2 px-2 py-1.5",
                    warn && "bg-red-950/30",
                  )}
                >
                  <span className="text-lime-400">{r.nodeId}</span>
                  <span className="text-foreground">
                    Q=<span className="text-sky-300">{r.flowRateLs.toFixed(1)}</span>
                    <span className="text-muted-foreground"> L/s</span>
                    {" · "}
                    H=<span className="text-sky-300">{r.pressureHeadM.toFixed(1)}</span>
                    <span className="text-muted-foreground"> m</span>
                    {" · "}
                    T=
                    <span
                      className={cn(
                        r.apuTemperatureC >= 85
                          ? "text-red-400"
                          : r.apuTemperatureC >= 65
                            ? "text-orange-400"
                            : "text-lime-400",
                      )}
                    >
                      {r.apuTemperatureC.toFixed(1)}°C
                    </span>
                    {r.acousticAbnormal && <span className="ml-1 text-red-400">⚠ACOUSTIC</span>}
                  </span>
                  <span
                    className={cn(
                      "text-right",
                      r.invariantOk ? "text-muted-foreground" : "text-red-400",
                    )}
                  >
                    a={r.estimatedCelerity.toFixed(0)}m/s
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </ScrollArea>
    </div>
  );
}
