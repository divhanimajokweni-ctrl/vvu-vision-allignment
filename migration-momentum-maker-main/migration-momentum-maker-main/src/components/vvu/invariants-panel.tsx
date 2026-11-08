"use client";

import { Card } from "@/components/ui/card";
import { HYDRAULIC_INVARIANTS } from "@/lib/vvu-release-manifest";
import {
  SANS_CELERITY_BOUNDS,
  APU_THERMAL_BOUNDS,
  FAVAD_EXPONENT_BOUNDS,
  FACTOR_OF_SAFETY_BOUNDS,
} from "@/lib/vvu-telemetry";
import { Waves, Thermometer, GitBranch, ShieldCheck } from "lucide-react";

const CHECKS: Array<{ icon: typeof Waves; label: string; value: string; range: string }> = [
  {
    icon: Waves,
    label: "Joukowsky celerity",
    value: "a (m/s)",
    range: `${SANS_CELERITY_BOUNDS.min}–${SANS_CELERITY_BOUNDS.max}`,
  },
  {
    icon: Thermometer,
    label: "APU thermal",
    value: "T (°C)",
    range: `${APU_THERMAL_BOUNDS.nominal} nominal · ${APU_THERMAL_BOUNDS.throttle} throttle · ${APU_THERMAL_BOUNDS.failClosed} fail-closed`,
  },
  {
    icon: GitBranch,
    label: "FAVAD exponent N1",
    value: "N1",
    range: `${FAVAD_EXPONENT_BOUNDS.min}–${FAVAD_EXPONENT_BOUNDS.max}`,
  },
  {
    icon: ShieldCheck,
    label: "Factor of safety",
    value: "FoS",
    range: `${FACTOR_OF_SAFETY_BOUNDS.min}–${FACTOR_OF_SAFETY_BOUNDS.max}`,
  },
];

export function InvariantsPanel() {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Hydraulic Safe-Harbour Invariants</h3>
        <span className="text-[10px] text-muted-foreground">
          SANS / EN · all claims cryptographically anchored
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {CHECKS.map((c) => (
          <Card
            key={c.label}
            className="border-border vvu-card-surface p-2 flex items-center gap-2"
          >
            <c.icon className="h-4 w-4 shrink-0 text-lime-400" />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {c.label}
                </span>
                <span className="font-mono text-[10px] text-amber-300">{c.value}</span>
              </div>
              <div className="font-mono text-[11px] text-foreground">{c.range}</div>
            </div>
          </Card>
        ))}
      </div>
      <Card className="border-border vvu-card-surface p-2">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
          Torque · clamp force
        </div>
        <div className="flex items-baseline justify-between gap-3 font-mono text-[11px]">
          <span className="text-foreground">{HYDRAULIC_INVARIANTS.torqueNm} Nm</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-foreground">{HYDRAULIC_INVARIANTS.clampForceKn} kN</span>
          <span className="text-muted-foreground">clamp force</span>
        </div>
        <div className="mt-1 text-[10px] text-muted-foreground">
          DN300 {HYDRAULIC_INVARIANTS.dn300.outerDiameterMm}×
          {HYDRAULIC_INVARIANTS.dn300.wallThicknessMm}mm ({HYDRAULIC_INVARIANTS.dn300.materialGrade}
          ) · DN100 {HYDRAULIC_INVARIANTS.dn100.outerDiameterMm}×
          {HYDRAULIC_INVARIANTS.dn100.wallThicknessMm}mm
        </div>
      </Card>
    </div>
  );
}
