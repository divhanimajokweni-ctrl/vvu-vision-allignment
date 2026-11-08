"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface DbStatsData {
  tenants: number;
  geographicAnchors: number;
  physicalNodes: number;
  pipeSpools: number;
  hydraulicInvariants: number;
  telemetryLogs: number;
  auditLogs: number;
  ledgerEntries: number;
}

interface DbStatsPanelProps {
  stats: DbStatsData;
}

const ROWS: Array<{ key: keyof DbStatsData; label: string; hint: string }> = [
  {
    key: "tenants",
    label: "Tenants",
    hint: "multi-tenant roots (Gqeberha / Mogalakwena / Marikana)",
  },
  { key: "geographicAnchors", label: "Geographic Anchors", hint: "WGS84 → ECEF reference origins" },
  {
    key: "physicalNodes",
    label: "Physical Nodes",
    hint: "ENU mm coordinates of HBK hardware modules",
  },
  { key: "pipeSpools", label: "Pipe Spools", hint: "SANS 1123 PN16 calibration profiles" },
  {
    key: "hydraulicInvariants",
    label: "Hydraulic Invariants",
    hint: "safe-harbour celerity/FAVAD/FoS bounds",
  },
  { key: "telemetryLogs", label: "Telemetry Logs", hint: "edge telemetry ingestion (RLS-scoped)" },
  { key: "auditLogs", label: "Audit Logs", hint: "append-only WORM audit trail" },
  { key: "ledgerEntries", label: "Ledger Entries", hint: "15-file release-manifest WORM evidence" },
];

export function DbStatsPanel({ stats }: DbStatsPanelProps) {
  const total = Object.values(stats).reduce((s, n) => s + n, 0);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Sovereign-DB Stats</h3>
        <span className="text-[10px] text-muted-foreground">SQLite · {total} rows total</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {ROWS.map((r) => {
          const v = stats[r.key];
          return (
            <Card
              key={r.key}
              className="relative overflow-hidden border-border vvu-card-surface p-2"
            >
              <div className="absolute right-0 top-0 h-full w-1 bg-lime-700/30" />
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {r.label}
              </div>
              <div className="font-mono text-xl font-bold tabular-nums text-lime-400">{v}</div>
              <div className="text-[9px] text-muted-foreground truncate" title={r.hint}>
                {r.hint}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
