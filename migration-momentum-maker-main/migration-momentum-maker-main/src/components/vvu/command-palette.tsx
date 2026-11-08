"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Activity,
  AlertTriangle,
  Cpu,
  Database,
  Eye,
  Gauge,
  Keyboard,
  Map,
  Play,
  ScrollText,
  Settings,
  Shield,
  ShieldCheck,
  Terminal,
  Zap,
  Server,
  Flame,
  Wrench,
  Layers,
  RadioTower,
  Clock,
} from "lucide-react";

export interface CommandAction {
  id: string;
  label: string;
  hint?: string;
  shortcut?: string;
  icon: React.ComponentType<{ className?: string }>;
  group: "Navigate" | "Actions" | "Sites" | "FSM" | "Help";
  onSelect: () => void;
  keywords?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  actions: CommandAction[];
}

export function CommandPalette({ open, onOpenChange, actions }: CommandPaletteProps) {
  // Group actions for the command palette
  const grouped = useMemo(() => {
    const map: Record<string, CommandAction[]> = {};
    for (const a of actions) {
      if (!map[a.group]) map[a.group] = [];
      map[a.group].push(a);
    }
    return map;
  }, [actions]);

  const groupedEntries = Object.entries(grouped);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search… (e.g. 'leak', 'gqeberha', 'tamper')" />
      <CommandList>
        <CommandEmpty>No matching command.</CommandEmpty>
        {groupedEntries.map(([group, items]) => (
          <div key={group}>
            <CommandGroup heading={group}>
              {items.map((a) => (
                <CommandItem
                  key={a.id}
                  value={`${a.label} ${a.keywords ?? ""}`}
                  onSelect={() => {
                    onOpenChange(false);
                    a.onSelect();
                  }}
                  className="group"
                >
                  <a.icon className="mr-2 h-4 w-4 text-lime-400 group-aria-selected:text-foreground" />
                  <span className="flex-1">{a.label}</span>
                  {a.shortcut && <CommandShortcut>{a.shortcut}</CommandShortcut>}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

/**
 * Convenience hook: returns the bound state + a trigger function.
 * Listens for Ctrl+K / Cmd+K to toggle.
 */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((o) => !o), []);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggle]);

  return { open, setOpen, toggle };
}
