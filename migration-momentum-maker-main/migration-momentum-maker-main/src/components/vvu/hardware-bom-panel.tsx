"use client";

import { Card } from "@/components/ui/card";
import { HARDWARE_BOM } from "@/lib/vvu-release-manifest";
import { Cpu, Battery, HardDrive, Shield, Wrench, Radio, Flame, Box } from "lucide-react";

const ITEMS: Array<{ icon: typeof Cpu; label: string; value: string; hint: string }> = [
  { icon: Cpu, label: "APU", value: HARDWARE_BOM.apu, hint: "AMD Ryzen AI edge compute" },
  { icon: Battery, label: "Battery", value: HARDWARE_BOM.battery, hint: "8S4P LiFePO4 — 614 Wh" },
  {
    icon: HardDrive,
    label: "WORM Storage",
    value: HARDWARE_BOM.storage,
    hint: "512 GB NVMe — append-only",
  },
  {
    icon: Shield,
    label: "Secure Element",
    value: HARDWARE_BOM.secureElement,
    hint: "ATECC608B — Ed25519 keyslots",
  },
  {
    icon: Wrench,
    label: "Flange",
    value: HARDWARE_BOM.flange,
    hint: "DN300 SANS 1123 PN16 — 154.7 Nm torque",
  },
  { icon: Radio, label: "Comms", value: HARDWARE_BOM.comms, hint: "LoRa + BLE — RF bulkhead" },
  {
    icon: Flame,
    label: "Thermal",
    value: HARDWARE_BOM.thermal,
    hint: "Aluminium radiator + bridge",
  },
  {
    icon: Box,
    label: "Enclosure",
    value: HARDWARE_BOM.enclosure,
    hint: "IP66 — base + lid + gasket",
  },
];

export function HardwareBomPanel() {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">HBK Mk-II Hardware BoM</h3>
        <span className="text-[10px] text-muted-foreground">
          Hydro-Bayesian Kernel · physical substrate
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ITEMS.map((it) => (
          <Card key={it.label} className="border-border vvu-card-surface p-2 space-y-1">
            <div className="flex items-center gap-1.5">
              <it.icon className="h-3.5 w-3.5 text-lime-400" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {it.label}
              </span>
            </div>
            <div className="text-[11px] font-medium text-foreground">{it.value}</div>
            <div className="text-[9px] text-muted-foreground leading-tight">{it.hint}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
