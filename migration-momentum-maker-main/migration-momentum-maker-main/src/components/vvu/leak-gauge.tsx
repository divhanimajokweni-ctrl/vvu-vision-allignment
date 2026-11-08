"use client";

import { Progress } from "@/components/ui/progress";

interface LeakGaugeProps {
  flowRateLs: number;
  pressureHeadM: number;
  thresholdLpm: number;
}

/**
 * FAVAD L/min leak gauge — derived from pressure-drop × flow rate × FAVAD N1=2.5
 * Safe-harbour band shown as the green portion of the gauge.
 */
export function LeakGauge({ flowRateLs, pressureHeadM, thresholdLpm }: LeakGaugeProps) {
  // FAVAD leak estimate (simplified): Q_leak = K * sqrt(H) ; convert L/s to L/min
  const nominalQlpm = flowRateLs * 60;
  // If pressure drops anomalously relative to flow, infer leak (simple proxy)
  const expected = Math.sqrt(Math.max(0, pressureHeadM)) * 12; // expected L/min given H
  const leak = Math.max(0, nominalQlpm - expected * 0.85);
  const pct = Math.min(100, (leak / thresholdLpm) * 100);
  const inSafe = leak < thresholdLpm * 0.6;
  const inWarn = !inSafe && leak < thresholdLpm;
  const tripped = leak >= thresholdLpm;
  const color = tripped ? "bg-red-500" : inWarn ? "bg-orange-500" : "bg-lime-500";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">FAVAD Leak Gauge</h3>
        <span className="text-[10px] text-muted-foreground">
          N1=2.5 · threshold {thresholdLpm} L/min
        </span>
      </div>

      <div className="flex items-end gap-3">
        <div
          className="font-mono text-3xl font-bold tabular-nums"
          style={{
            color: tripped ? "#ef4444" : inWarn ? "#ff8a00" : "#c8ff00",
          }}
        >
          {leak.toFixed(0)}
        </div>
        <div className="mb-1 text-xs text-muted-foreground">L/min</div>
        <div className="ml-auto text-right text-[10px] text-muted-foreground">
          <div>Nominal flow</div>
          <div className="font-mono text-foreground">{nominalQlpm.toFixed(0)} L/min</div>
        </div>
      </div>

      <div className="relative">
        <Progress value={pct} className={`h-2 ${color}`} />
        {/* threshold marker */}
        <div
          className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-red-500"
          style={{ left: "60%" }}
          title={`Soft alarm at 60% of threshold (${(thresholdLpm * 0.6).toFixed(0)} L/min)`}
        />
      </div>

      <div className="flex justify-between text-[10px]">
        <span className={inSafe ? "text-lime-400" : "text-muted-foreground"}>● NOMINAL</span>
        <span className={inWarn ? "text-orange-400" : "text-muted-foreground"}>● WATCH</span>
        <span className={tripped ? "text-red-400" : "text-muted-foreground"}>● LEAK</span>
      </div>

      <div className="rounded border border-border vvu-surface-deep px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
        H = {pressureHeadM.toFixed(1)} m · Q = {flowRateLs.toFixed(1)} L/s · K·sqrt(H) ≈{" "}
        {expected.toFixed(0)} L/min
      </div>
    </div>
  );
}
