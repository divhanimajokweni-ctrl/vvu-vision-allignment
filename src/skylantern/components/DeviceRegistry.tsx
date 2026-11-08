"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Cpu,
  MapPin,
  Radio,
  Droplets,
  Car,
  Smartphone,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Domain, DeviceDTO } from "../types";
import { useSkylanternStore } from "../hooks/useSkylanternStore";
import { relativeTime } from "../lib/format";

const DOMAIN_ICON: Record<Domain, React.ComponentType<{ className?: string }>> = {
  WATER: Droplets,
  CELLPHONE: Smartphone,
  VEHICLE: Car,
};

const DOMAIN_TONE: Record<Domain, string> = {
  WATER: "text-sky-300",
  CELLPHONE: "text-fuchsia-300",
  VEHICLE: "text-orange-300",
};

/**
 * DeviceRegistry — left sidebar listing all registered physical devices.
 *
 * Clicking a device flies the map to its latest lantern.
 */
export function DeviceRegistry() {
  const devices = useSkylanternStore((s) => s.devices);
  const evidence = useSkylanternStore((s) => s.evidence);
  const selectEvidence = useSkylanternStore((s) => s.selectEvidence);
  const openDrawer = useSkylanternStore((s) => s.openDrawer);
  const filterDomain = useSkylanternStore((s) => s.filterDomain);
  const setFilterDomain = useSkylanternStore((s) => s.setFilterDomain);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-800 p-4">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-100">Devices</h3>
          <Badge
            variant="outline"
            className="ml-auto border-slate-700 font-mono text-[10px] text-slate-400"
          >
            {devices.length} registered
          </Badge>
        </div>
        <div className="mt-2 flex gap-1">
          {(["ALL", "WATER", "CELLPHONE", "VEHICLE"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setFilterDomain(d)}
              className={cn(
                "rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors",
                filterDomain === d
                  ? "bg-slate-200 text-slate-900"
                  : "bg-slate-900 text-slate-400 hover:bg-slate-800"
              )}
            >
              {d === "ALL" ? "all" : d.slice(0, 3)}
            </button>
          ))}
        </div>
      </header>
      <ScrollArea className="flex-1">
        <ul className="divide-y divide-slate-900">
          <AnimatePresence initial={false}>
            {devices
              .filter((d) => filterDomain === "ALL" || d.domain === filterDomain)
              .map((d) => (
                <DeviceRow
                  key={d.id}
                  device={d}
                  evidence={evidence as unknown as { id: string; deviceId: string; verificationState: string; sequence: number }[]}
                  onSelect={(id) => {
                    selectEvidence(
                      evidence.find((e) => e.id === id) ?? null
                    );
                    openDrawer(id);
                  }}
                />
              ))}
          </AnimatePresence>
          {devices.length === 0 && (
            <li className="p-6 text-center text-xs text-slate-500">
              No devices registered. The demo auto-seeds on first load —
              refresh in a moment.
            </li>
          )}
        </ul>
      </ScrollArea>
    </div>
  );
}

function DeviceRow({
  device,
  evidence,
  onSelect,
}: {
  device: DeviceDTO;
  evidence: { id: string; deviceId: string; verificationState: string; sequence: number }[];
  onSelect: (id: string) => void;
}) {
  const Icon = DOMAIN_ICON[device.domain];
  const tone = DOMAIN_TONE[device.domain];
  const latest = evidence
    .filter((e) => e.deviceId === device.id || e.id === device.id)
    .sort((a, b) => b.sequence - a.sequence)[0];

  // The evidence list does not carry deviceId directly in the reduced type above,
  // so fall back to matching by source/externalId via the store if needed.
  const latestForDevice = useSkylanternStore((s) => {
    return s.evidence
      .filter((e) => e.device.externalId === device.externalId)
      .sort((a, b) => b.sequence - a.sequence)[0];
  });

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="cursor-pointer p-3 transition-colors hover:bg-slate-900/60"
      onClick={() => {
        if (latestForDevice) onSelect(latestForDevice.id);
      }}
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 ring-1 ring-slate-800">
          <Icon className={cn("h-3.5 w-3.5", tone)} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-slate-200">
            {device.label}
          </div>
          <div className="truncate font-mono text-[10px] text-slate-500">
            {device.externalId}
          </div>
        </div>
        {device.status === "ACTIVE" ? (
          <span className="flex items-center gap-1 text-[10px] text-emerald-400">
            <Activity className="h-3 w-3" /> live
          </span>
        ) : (
          <span className="text-[10px] text-slate-500">{device.status}</span>
        )}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
        <Field label="domain" value={device.domain} />
        <Field label="primitive" value={device.primitive} />
        <Field label="evidence" value={String(device.evidenceCount)} />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {device.lat.toFixed(4)}, {device.lng.toFixed(4)}
        </span>
        <span>seen {relativeTime(device.lastSeenAt)}</span>
      </div>
      {device.pricingBand && (
        <div className="mt-1.5">
          <Badge
            variant="outline"
            className="border-slate-700 bg-slate-900/60 font-mono text-[9px] text-slate-400"
          >
            <Radio className="mr-1 h-2.5 w-2.5" />
            {device.pricingBand}
          </Badge>
        </div>
      )}
      {latestForDevice && (
        <div className="mt-1.5 text-[10px] text-slate-500">
          latest block{" "}
          <span className="font-mono text-slate-300">
            #{latestForDevice.sequence}
          </span>{" "}
          ·{" "}
          <span
            className={cn(
              latestForDevice.verificationState === "CANDIDATE" && "text-amber-300",
              latestForDevice.verificationState === "VERIFIED" && "text-emerald-300",
              latestForDevice.verificationState === "TAMPER_DETECTED" && "text-rose-300"
            )}
          >
            {latestForDevice.verificationState}
          </span>
        </div>
      )}
    </motion.li>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider text-slate-600">
        {label}
      </div>
      <div className="truncate font-mono text-slate-400">{value}</div>
    </div>
  );
}
