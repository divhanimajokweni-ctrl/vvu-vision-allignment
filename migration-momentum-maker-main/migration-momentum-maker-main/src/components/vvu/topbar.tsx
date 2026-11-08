"use client";

import { Badge } from "@/components/ui/badge";
import { BorromeanLockup } from "./borromean-logo";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

export interface TopbarStats {
  currentState: string;
  eisPct: number; // Evidence Integrity Score %
  wormCount: number;
  tamperedCount: number;
  telemetryRatePerMin: number;
  apuTempC: number;
  lastCelerity: number;
}

const STATE_COLORS: Record<string, string> = {
  DISCONNECTED: "bg-slate-800 text-slate-300 border-slate-700",
  PAIRING_BLE: "bg-amber-950 text-amber-300 border-amber-800",
  TOTP_VERIFICATION: "bg-yellow-950 text-yellow-300 border-yellow-800",
  STEADY_STATE_LOCKED: "bg-lime-950 text-lime-300 border-lime-700",
  LEAK_SIMULATION_ACTIVE: "bg-orange-950 text-orange-300 border-orange-700",
  THERMAL_THROTTLE: "bg-orange-950 text-orange-400 border-orange-700",
  FAIL_CLOSED_LOCKDOWN: "bg-red-950 text-red-300 border-red-700",
};

export function Topbar({ stats, tenantName }: { stats: TopbarStats; tenantName: string }) {
  const eisColor =
    stats.eisPct >= 80
      ? "border-lime-700 text-lime-300 bg-lime-950"
      : stats.eisPct >= 60
        ? "border-amber-700 text-amber-300 bg-amber-950"
        : "border-red-700 text-red-300 bg-red-950";
  const wormColor =
    stats.tamperedCount > 0
      ? "border-red-700 text-red-300 bg-red-950"
      : "border-lime-700 text-lime-300 bg-lime-950";
  const apuColor =
    stats.apuTempC >= 85
      ? "border-red-700 text-red-300 bg-red-950"
      : stats.apuTempC >= 65
        ? "border-orange-700 text-orange-300 bg-orange-950"
        : "border-lime-700 text-lime-300 bg-lime-950";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-2 px-2 sm:gap-3 sm:px-6 overflow-x-auto">
        <BorromeanLockup size={28} />

        <Separator orientation="vertical" className="h-8 hidden sm:block" />

        <div className="flex items-center gap-1.5 sm:gap-2 flex-1 overflow-x-auto scrollbar-hide">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className={`font-mono shrink-0 text-[9px] sm:text-xs ${STATE_COLORS[stats.currentState] ?? STATE_COLORS.DISCONNECTED}`}
                >
                  <span className="mr-1 inline-block h-2 w-2 rounded-full bg-current animate-pulse" />
                  {stats.currentState.replace(/_/g, " ")}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>FSM — current state of the HBK Mk-II controller</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className={`font-mono ${eisColor}`}>
                  EIS {stats.eisPct.toFixed(1)}%
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                Evidence Integrity Score — additive-weighted SCADA-capped at 0.6
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className={`font-mono ${wormColor}`}>
                  WORM {stats.wormCount}
                  {stats.tamperedCount > 0 && (
                    <span className="ml-1 inline-flex items-center rounded-sm bg-red-500 px-1 text-[10px] font-bold">
                      {stats.tamperedCount} TAMPERED
                    </span>
                  )}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                WORM ledger — sealed receipts in the SHA-256 hash-chained journal
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="font-mono border-sky-800 bg-sky-950 text-sky-300"
                >
                  {stats.telemetryRatePerMin}/min
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Telemetry ingestion rate</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className={`font-mono ${apuColor}`}>
                  APU {stats.apuTempC.toFixed(1)}°C
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                AMD Ryzen AI APU temperature — 65 °C throttle, 85 °C fail-closed
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="font-mono border-violet-800 bg-violet-950 text-violet-300"
                >
                  a = {stats.lastCelerity.toFixed(0)} m/s
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Joukowsky celerity — safe-harbour 200–1400 m/s (SANS)</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground shrink-0">
          <span className="hidden md:inline">{tenantName}</span>
          <span className="hidden md:inline-block h-1.5 w-1.5 rounded-full bg-lime-500 animate-pulse" />
        </div>
      </div>
    </header>
  );
}
