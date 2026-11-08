"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Settings, Keyboard } from "lucide-react";

export interface DashboardSettings {
  refreshMs: number;
  leakThresholdLpm: number;
  showBootScreen: boolean;
  autoScrollTelemetry: boolean;
}

interface SettingsDialogProps {
  settings: DashboardSettings;
  onChange: (s: DashboardSettings) => void;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}

export function SettingsDialog({
  settings,
  onChange,
  open: openProp,
  onOpenChange,
}: SettingsDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  function update<K extends keyof DashboardSettings>(key: K, value: DashboardSettings[K]) {
    onChange({ ...settings, [key]: value });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
          <Settings className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dashboard Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="flex items-center justify-between text-xs">
              <span>Refresh interval</span>
              <span className="font-mono text-muted-foreground">{settings.refreshMs} ms</span>
            </Label>
            <Slider
              value={[settings.refreshMs]}
              min={500}
              max={10_000}
              step={500}
              onValueChange={(v) => update("refreshMs", v[0])}
            />
            <p className="text-[10px] text-muted-foreground">
              Controls how often the dashboard polls the telemetry + audit APIs.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center justify-between text-xs">
              <span>FAVAD leak threshold</span>
              <span className="font-mono text-muted-foreground">
                {settings.leakThresholdLpm} L/min
              </span>
            </Label>
            <Slider
              value={[settings.leakThresholdLpm]}
              min={200}
              max={2000}
              step={50}
              onValueChange={(v) => update("leakThresholdLpm", v[0])}
            />
          </div>

          <div className="flex items-center justify-between rounded border border-border px-3 py-2">
            <div>
              <Label className="text-xs">Show boot screen on next load</Label>
              <p className="text-[10px] text-muted-foreground">3-second boot sequence</p>
            </div>
            <Switch
              checked={settings.showBootScreen}
              onCheckedChange={(c) => update("showBootScreen", c)}
            />
          </div>

          <div className="flex items-center justify-between rounded border border-border px-3 py-2">
            <div>
              <Label className="text-xs">Auto-scroll telemetry feed</Label>
              <p className="text-[10px] text-muted-foreground">Pin to most recent event</p>
            </div>
            <Switch
              checked={settings.autoScrollTelemetry}
              onCheckedChange={(c) => update("autoScrollTelemetry", c)}
            />
          </div>
        </div>

        <div className="rounded border border-border vvu-surface-deep px-3 py-2 text-[10px] text-muted-foreground">
          <div className="mb-1 flex items-center gap-1 font-semibold text-foreground">
            <Keyboard className="h-3 w-3" /> Keyboard shortcuts
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono">
            <span>
              <kbd className="rounded bg-muted px-1">L</kbd> simulate leak
            </span>
            <span>
              <kbd className="rounded bg-muted px-1">T</kbd> tamper drill
            </span>
            <span>
              <kbd className="rounded bg-muted px-1">R</kbd> recompute SHA
            </span>
            <span>
              <kbd className="rounded bg-muted px-1">?</kbd> toggle help
            </span>
            <span>
              <kbd className="rounded bg-muted px-1">1</kbd>-
              <kbd className="rounded bg-muted px-1">3</kbd> switch site
            </span>
            <span>
              <kbd className="rounded bg-muted px-1">F</kbd> FSM dispatch
            </span>
          </div>
        </div>

        <div className="flex justify-end">
          <Button size="sm" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
