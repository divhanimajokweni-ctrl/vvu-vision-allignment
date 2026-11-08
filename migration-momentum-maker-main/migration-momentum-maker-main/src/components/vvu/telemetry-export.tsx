"use client";

import { Button } from "@/components/ui/button";
import { Download, FileJson, FileSpreadsheet } from "lucide-react";
import type { TelemetryRow } from "./telemetry-feed";

interface TelemetryExportProps {
  rows: TelemetryRow[];
  tenantSlug: string;
}

function toJson(rows: TelemetryRow[]): string {
  return JSON.stringify(
    rows.map((r) => ({
      id: r.id,
      nodeId: r.nodeId,
      flowRateLs: r.flowRateLs,
      pressureHeadM: r.pressureHeadM,
      apuTemperatureC: r.apuTemperatureC,
      acousticAbnormal: r.acousticAbnormal,
      estimatedCelerity: r.estimatedCelerity,
      invariantOk: r.invariantOk,
      systemState: r.systemState,
      timestamp: r.createdAt,
    })),
    null,
    2,
  );
}

function toCsv(rows: TelemetryRow[]): string {
  const headers = [
    "timestamp",
    "nodeId",
    "flowRateLs",
    "pressureHeadM",
    "apuTemperatureC",
    "acousticAbnormal",
    "estimatedCelerity",
    "invariantOk",
    "systemState",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        new Date(r.createdAt).toISOString(),
        r.nodeId,
        r.flowRateLs.toFixed(2),
        r.pressureHeadM.toFixed(2),
        r.apuTemperatureC.toFixed(1),
        r.acousticAbnormal ? "true" : "false",
        r.estimatedCelerity.toFixed(0),
        r.invariantOk ? "true" : "false",
        r.systemState,
      ].join(","),
    );
  }
  return lines.join("\n");
}

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function TelemetryExport({ rows, tenantSlug }: TelemetryExportProps) {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        className="h-7 gap-1 text-[11px]"
        onClick={() =>
          download(toJson(rows), `vvu-telemetry-${tenantSlug}-${stamp}.json`, "application/json")
        }
        disabled={rows.length === 0}
      >
        <FileJson className="h-3 w-3" /> JSON
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-7 gap-1 text-[11px]"
        onClick={() =>
          download(toCsv(rows), `vvu-telemetry-${tenantSlug}-${stamp}.csv`, "text/csv")
        }
        disabled={rows.length === 0}
      >
        <FileSpreadsheet className="h-3 w-3" /> CSV
      </Button>
    </div>
  );
}
