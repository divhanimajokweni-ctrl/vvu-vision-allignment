"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Cpu,
  Battery,
  HardDrive,
  Shield,
  Wrench,
  Radio,
  Flame,
  Box,
  Eye,
  EyeOff,
  Layers,
} from "lucide-react";
import { HARDWARE_BOM } from "@/lib/vvu-release-manifest";
import { cn } from "@/lib/utils";

interface Layer {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  value: string;
  hint: string;
  z: number; // 3D depth (px)
  color: string; // accent
}

const LAYERS: Layer[] = [
  {
    id: "enclosure",
    label: "Enclosure Lid",
    icon: Box,
    value: HARDWARE_BOM.enclosure,
    hint: "IP66 lid + gasket — top layer",
    z: 0,
    color: "#94a3b8",
  },
  {
    id: "thermal",
    label: "Thermal Stack",
    icon: Flame,
    value: HARDWARE_BOM.thermal,
    hint: "Aluminium radiator + thermal bridge",
    z: -28,
    color: "#fb923c",
  },
  {
    id: "comms",
    label: "RF Bulkhead",
    icon: Radio,
    value: HARDWARE_BOM.comms,
    hint: "LoRa + BLE radio front-end",
    z: -56,
    color: "#22d3ee",
  },
  {
    id: "secure",
    label: "Secure Element",
    icon: Shield,
    value: HARDWARE_BOM.secureElement,
    hint: "ATECC608B — Ed25519 keyslots",
    z: -84,
    color: "#f43f5e",
  },
  {
    id: "storage",
    label: "WORM Storage",
    icon: HardDrive,
    value: HARDWARE_BOM.storage,
    hint: "512 GB NVMe append-only",
    z: -112,
    color: "#a78bfa",
  },
  {
    id: "compute",
    label: "APU Compute",
    icon: Cpu,
    value: HARDWARE_BOM.apu,
    hint: "AMD Ryzen AI APU — FSM + telemetry controller",
    z: -140,
    color: "#38bdf8",
  },
  {
    id: "power",
    label: "Battery Pack",
    icon: Battery,
    value: HARDWARE_BOM.battery,
    hint: "8S4P LiFePO4 614 Wh",
    z: -168,
    color: "#22c55e",
  },
  {
    id: "flange",
    label: "DN300 Flange",
    icon: Wrench,
    value: HARDWARE_BOM.flange,
    hint: "SANS 1123 PN16 hydraulic interface",
    z: -196,
    color: "#c8ff00",
  },
];

interface HbkExplodedViewProps {
  onSimulateLeak?: () => void;
}

export function HbkExplodedView({ onSimulateLeak }: HbkExplodedViewProps) {
  const [exploded, setExploded] = useState(true);
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);

  const active = focused ?? hovered;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold">HBK Mk-II Hydro-Gateway · Exploded CAD View</h3>
          <p className="text-[10px] text-muted-foreground">
            8-layer parametric CAD assembly (matches the 36 KittyCAD .kcl source files)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-[11px]"
            onClick={() => setExploded((e) => !e)}
          >
            {exploded ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {exploded ? "Collapse" : "Explode"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 border-orange-700 bg-orange-950/40 text-orange-300 hover:bg-orange-950 text-[11px]"
            onClick={onSimulateLeak}
          >
            <Wrench className="h-3 w-3" /> Pressure-test
          </Button>
        </div>
      </div>

      {/* 3D exploded view */}
      <Card className="relative border-border bg-gradient-to-b from-[#070b14] to-[#0a0f18] p-3 overflow-hidden h-[420px]">
        {/* Perspective grid backdrop */}
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(200,255,0,0.06) 1px, transparent 1px),
              linear-gradient(90deg, rgba(200,255,0,0.06) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
            maskImage: "radial-gradient(circle at center, black 30%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(circle at center, black 30%, transparent 75%)",
          }}
        />

        {/* Layer stack — uses CSS 3D transform for depth */}
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            transformStyle: "preserve-3d",
            transform: "translate(-50%, -50%) rotateX(55deg) rotateZ(-12deg)",
            transition: "transform 600ms ease",
          }}
        >
          {LAYERS.map((l, i) => {
            const depth = exploded ? l.z : -i * 4;
            const isActive = active === l.id;
            const dim = active && !isActive;
            return (
              <div
                key={l.id}
                onMouseEnter={() => setHovered(l.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => setFocused((f) => (f === l.id ? null : l.id))}
                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                style={{
                  transform: `translateZ(${depth}px)`,
                  transition: "transform 600ms ease, opacity 200ms",
                  opacity: dim ? 0.35 : 1,
                  zIndex: 100 + i,
                }}
              >
                <div
                  className={cn(
                    "relative rounded-md border-2 transition-all duration-300",
                    isActive ? "shadow-lg scale-105" : "hover:scale-105",
                  )}
                  style={{
                    width: 180,
                    height: 110,
                    borderColor: l.color,
                    background: `linear-gradient(135deg, ${l.color}22, ${l.color}05)`,
                    boxShadow: isActive ? `0 0 28px ${l.color}88` : `0 0 14px ${l.color}33`,
                  }}
                >
                  {/* Layer label */}
                  <div className="absolute left-1.5 top-1.5 flex items-center gap-1">
                    <l.icon className="h-3 w-3" style={{ color: l.color }} />
                    <span className="font-mono text-[9px] font-bold" style={{ color: l.color }}>
                      {l.label}
                    </span>
                  </div>
                  {/* Layer index */}
                  <div className="absolute right-1.5 top-1.5 font-mono text-[8px] text-muted-foreground">
                    L{String(i + 1).padStart(2, "0")}
                  </div>
                  {/* Value */}
                  <div className="absolute inset-x-1.5 bottom-1.5">
                    <div className="text-[9px] text-foreground/90 leading-tight line-clamp-2">
                      {l.value}
                    </div>
                  </div>
                  {/* Borromean accents */}
                  <div
                    className="absolute inset-0 rounded-md pointer-events-none"
                    style={{
                      background: `linear-gradient(90deg, transparent 0%, ${l.color}11 50%, transparent 100%)`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Hover tooltip */}
        {active && (
          <div className="absolute right-3 top-3 z-50 max-w-[220px] rounded-md border border-border bg-background/95 backdrop-blur px-2.5 py-2 shadow-lg">
            {(() => {
              const l = LAYERS.find((x) => x.id === active)!;
              return (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <l.icon className="h-3.5 w-3.5" style={{ color: l.color }} />
                    <span className="font-mono text-xs font-bold" style={{ color: l.color }}>
                      {l.label}
                    </span>
                    <Badge variant="outline" className="ml-auto text-[9px]">
                      L{LAYERS.findIndex((x) => x.id === active) + 1}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-foreground">{l.value}</div>
                  <div className="text-[10px] text-muted-foreground leading-tight">{l.hint}</div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Layer count */}
        <div className="absolute bottom-2 left-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Layers className="h-3 w-3" /> 8 layers · DN300 base · IP66 lid
        </div>
      </Card>

      {/* Compact layer list with role tags */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {LAYERS.map((l, i) => (
          <button
            key={l.id}
            onClick={() => setFocused((f) => (f === l.id ? null : l.id))}
            onMouseEnter={() => setHovered(l.id)}
            onMouseLeave={() => setHovered(null)}
            className={cn(
              "group rounded border vvu-card-surface p-2 text-left transition-all",
              active === l.id
                ? "border-lime-600 bg-lime-950/20"
                : "border-border hover:border-lime-700/50",
            )}
          >
            <div className="flex items-center justify-between">
              <l.icon className="h-3.5 w-3.5" style={{ color: l.color }} />
              <span className="font-mono text-[8px] text-muted-foreground">
                L{String(i + 1).padStart(2, "0")}
              </span>
            </div>
            <div className="mt-1 text-[10px] font-medium text-foreground leading-tight">
              {l.label}
            </div>
            <div className="text-[9px] text-muted-foreground line-clamp-1">{l.value}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
