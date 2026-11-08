"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Keyboard, X } from "lucide-react";

interface ShortcutGroup {
  title: string;
  shortcuts: Array<{
    key: string;
    description: string;
    category?: "nav" | "action" | "site" | "help";
  }>;
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Tab Navigation",
    shortcuts: [
      { key: "O", description: "Operator tab", category: "nav" },
      { key: "E", description: "Evidence tab", category: "nav" },
      { key: "A", description: "Analytics tab", category: "nav" },
      { key: "D", description: "Data tab", category: "nav" },
      { key: "S", description: "Spatial tab", category: "nav" },
      { key: "H", description: "Hardware tab", category: "nav" },
      { key: "G", description: "Governance tab", category: "nav" },
    ],
  },
  {
    title: "Site Switching",
    shortcuts: [
      { key: "1", description: "Gqeberha Beachfront R&D", category: "site" },
      { key: "2", description: "Anglo American Mogalakwena", category: "site" },
      { key: "3", description: "Sibanye-Stillwater Marikana", category: "site" },
    ],
  },
  {
    title: "FSM Actions",
    shortcuts: [
      { key: "L", description: "Simulate FAVAD leak (dispatch CLICK)", category: "action" },
      { key: "T", description: "Run tamper drill (flag + auto-restore 10s)", category: "action" },
    ],
  },
  {
    title: "System",
    shortcuts: [
      { key: "?", description: "Open this cheat sheet", category: "help" },
      { key: "Ctrl+K", description: "Open command palette", category: "help" },
      { key: "Esc", description: "Close dialogs / overlays", category: "help" },
    ],
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  nav: "border-sky-700 bg-sky-950/40 text-sky-300",
  action: "border-orange-700 bg-orange-950/40 text-orange-300",
  site: "border-violet-700 bg-violet-950/40 text-violet-300",
  help: "border-lime-700 bg-lime-950/40 text-lime-300",
};

export function KeyboardCheatSheet() {
  const [open, setOpen] = useState(false);

  // Listen for the ? key to toggle
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (
        e.key === "?" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl vvu-card-surface">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-lime-400" />
            <h2 className="text-sm font-bold text-foreground">Keyboard Cheat Sheet</h2>
          </div>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground mb-4">
          Press <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">?</kbd>{" "}
          anytime to toggle this overlay. All shortcuts work when not typing in an input field.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title} className="space-y-2">
              <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                {group.title}
              </h3>
              <div className="space-y-1">
                {group.shortcuts.map((s) => (
                  <div
                    key={s.key}
                    className="flex items-center gap-2 rounded border border-border/40 vvu-surface-deeper px-2 py-1.5"
                  >
                    <kbd
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-mono font-bold border ${CATEGORY_COLORS[s.category ?? "help"]}`}
                    >
                      {s.key}
                    </kbd>
                    <span className="text-[11px] text-foreground flex-1">{s.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-border/40">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
                Categories:
              </span>
              <Badge
                variant="outline"
                className="text-[9px] border-sky-700 bg-sky-950/40 text-sky-300"
              >
                Navigation
              </Badge>
              <Badge
                variant="outline"
                className="text-[9px] border-orange-700 bg-orange-950/40 text-orange-300"
              >
                Actions
              </Badge>
              <Badge
                variant="outline"
                className="text-[9px] border-violet-700 bg-violet-950/40 text-violet-300"
              >
                Sites
              </Badge>
              <Badge
                variant="outline"
                className="text-[9px] border-lime-700 bg-lime-950/40 text-lime-300"
              >
                System
              </Badge>
            </div>
            <span className="text-[9px] text-muted-foreground font-mono">VVU · 15 shortcuts</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
