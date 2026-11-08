"use client";

import { GATE_ROADMAP } from "@/lib/vvu-release-manifest";
import { cn } from "@/lib/utils";
import { CheckCircle2, CircleDot, Circle, ArrowRight } from "lucide-react";

const STATUS_META: Record<string, { color: string; bg: string; Icon: typeof CheckCircle2 }> = {
  COMPLETE: { color: "#c8ff00", bg: "rgba(200,255,0,0.08)", Icon: CheckCircle2 },
  "IN-PROGRESS": { color: "#ff8a00", bg: "rgba(255,138,0,0.08)", Icon: CircleDot },
  TARGET: { color: "#94a3b8", bg: "rgba(148,163,184,0.08)", Icon: Circle },
};

export function GateRoadmap() {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">5-Gate Founder-Control Roadmap</h3>
        <span className="text-[10px] text-muted-foreground">
          JSE Main Board · target 70.66% founder control at IPO
        </span>
      </div>

      <div className="space-y-1">
        {GATE_ROADMAP.map((g, i) => {
          const meta = STATUS_META[g.status] ?? STATUS_META.TARGET;
          const Icon = meta.Icon;
          return (
            <div key={g.gate}>
              <div
                className="flex items-center gap-3 rounded border px-3 py-2"
                style={{ borderColor: meta.color + "40", background: meta.bg }}
              >
                <Icon className="h-4 w-4 shrink-0" style={{ color: meta.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold" style={{ color: meta.color }}>
                      {g.gate}
                    </span>
                    <span className="text-xs text-foreground truncate">{g.name}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">{g.status}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-xs tabular-nums" style={{ color: meta.color }}>
                    {g.founderControlPct.toFixed(2)}%
                  </div>
                  <div className="text-[9px] text-muted-foreground">founder control</div>
                </div>
              </div>
              {i < GATE_ROADMAP.length - 1 && (
                <div className="flex justify-center py-0.5 text-muted-foreground/30">
                  <ArrowRight className="h-3 w-3 rotate-90" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[9px] text-muted-foreground/70 pt-1">
        5-Gate founder-control arc: G0 Discovery → G1 Pilot → G2 Scale → G3 Trust (A/B/C) → G5 JSE
        IPO. Founder floor at 70.66% (MOI Article 5 floor).
      </p>
    </div>
  );
}
