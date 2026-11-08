"use client";

import { motion } from "framer-motion";
import { Map as MapIcon, Cpu, Boxes } from "lucide-react";
import { useSkylanternStore } from "../hooks/useSkylanternStore";
import { cn } from "@/lib/utils";
import type { SkylanternState } from "../hooks/useSkylanternStore";

const TABS: {
  key: SkylanternState["mobileView"];
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "devices", label: "Devices", icon: Cpu },
  { key: "map", label: "Map", icon: MapIcon },
  { key: "chain", label: "Chain", icon: Boxes },
];

/**
 * MobileTabBar — bottom tab bar for mobile screens.
 *
 * On mobile (< lg breakpoint), the dashboard's three-column layout collapses
 * into a single full-screen view. This tab bar lets the operator switch
 * between the Device Registry, the 3D Map, and the WORM Chain inspector.
 *
 * Hidden on desktop (lg+) where the full three-column layout is shown.
 */
export function MobileTabBar() {
  const mobileView = useSkylanternStore((s) => s.mobileView);
  const setMobileView = useSkylanternStore((s) => s.setMobileView);
  const stats = useSkylanternStore((s) => s.stats);

  return (
    <motion.nav
      initial={{ y: 60 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      className="relative z-20 flex items-stretch border-t border-slate-800 bg-slate-950/95 backdrop-blur lg:hidden"
      role="tablist"
      aria-label="Mobile view switcher"
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = mobileView === tab.key;
        const count =
          tab.key === "devices"
            ? stats?.totalDevices ?? 0
            : tab.key === "chain"
            ? stats?.totalEvidence ?? 0
            : null;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => setMobileView(tab.key)}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors",
              isActive ? "text-amber-300" : "text-slate-500"
            )}
          >
            <div className="relative">
              <Icon className="h-5 w-5" />
              {count !== null && count > 0 && (
                <span className="absolute -right-2 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-slate-700 px-1 font-mono text-[8px] font-bold text-slate-200">
                  {count}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">{tab.label}</span>
            {isActive && (
              <motion.div
                layoutId="mobile-tab-indicator"
                className="absolute top-0 h-0.5 w-8 rounded-full bg-amber-400"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
          </button>
        );
      })}
    </motion.nav>
  );
}
