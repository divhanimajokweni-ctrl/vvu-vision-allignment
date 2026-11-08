"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BorromeanLogo } from "./borromean-logo";
import {
  Eye,
  ShieldCheck,
  Database,
  Map,
  ScrollText,
  LineChart,
  Box,
  Menu,
  Command as CmdIcon,
  Settings as SettingsIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenSettings?: () => void;
  onOpenCommand?: () => void;
}

const TABS = [
  { value: "operator", label: "Operator", icon: Eye, color: "#c8ff00" },
  { value: "evidence", label: "Evidence", icon: ShieldCheck, color: "#a78bfa" },
  { value: "analytics", label: "Analytics", icon: LineChart, color: "#38bdf8" },
  { value: "data", label: "Data", icon: Database, color: "#22c55e" },
  { value: "spatial", label: "Spatial", icon: Map, color: "#fb923c" },
  { value: "hardware", label: "Hardware", icon: Box, color: "#f43f5e" },
  { value: "governance", label: "Governance", icon: ScrollText, color: "#eab308" },
];

export function MobileNav({
  activeTab,
  onTabChange,
  onOpenSettings,
  onOpenCommand,
}: MobileNavProps) {
  const [open, setOpen] = useState(false);

  function handleSelect(tab: string) {
    onTabChange(tab);
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 w-8 p-0 lg:hidden border-border/60">
          <Menu className="h-4 w-4" />
          <span className="sr-only">Open navigation menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0 bg-background border-r border-border">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <BorromeanLogo size={32} animated={false} />
            <span className="text-sm font-bold text-lime-400">VVU Dashboard</span>
          </SheetTitle>
        </SheetHeader>

        <nav className="p-3 space-y-1">
          {TABS.map((t) => {
            const active = activeTab === t.value;
            return (
              <button
                key={t.value}
                onClick={() => handleSelect(t.value)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-md border px-3 py-2 text-sm transition-all",
                  active
                    ? "border-lime-600/60 bg-lime-950/30 text-lime-300 shadow-[0_0_0_1px_rgba(200,255,0,0.15)]"
                    : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
                style={active ? { borderColor: t.color + "60" } : {}}
              >
                <t.icon
                  className="h-4 w-4 shrink-0"
                  style={{ color: active ? t.color : undefined }}
                />
                <span className="flex-1 text-left">{t.label}</span>
                {active && (
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full animate-pulse"
                    style={{ background: t.color }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-border p-3 space-y-2">
          <Button
            size="sm"
            variant="outline"
            className="w-full h-8 gap-2 text-xs justify-start"
            onClick={() => {
              onOpenCommand?.();
              setOpen(false);
            }}
          >
            <CmdIcon className="h-3.5 w-3.5" /> Command palette
            <kbd className="ml-auto rounded bg-muted px-1 py-0.5 text-[9px] font-mono">⌘K</kbd>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-full h-8 gap-2 text-xs justify-start"
            onClick={() => {
              onOpenSettings?.();
              setOpen(false);
            }}
          >
            <SettingsIcon className="h-3.5 w-3.5" /> Settings
          </Button>
          <p className="text-[9px] text-muted-foreground text-center pt-1">
            VVU · Validation Dashboard
            <br />
            CIPC 2026/259053/07
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
