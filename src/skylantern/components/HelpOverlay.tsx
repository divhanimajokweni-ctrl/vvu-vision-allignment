"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Keyboard as KeyboardIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HelpOverlayProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: ["R"], label: "Release a new sky lantern", desc: "Opens the capture modal" },
  { keys: ["S"], label: "Simulate a synthetic lantern", desc: "Auto-releases from a random device" },
  { keys: ["V"], label: "Verify chain integrity", desc: "Recomputes every hash in the WORM chain" },
  { keys: ["E"], label: "Open Anatomy instrument", desc: "Evidence Instrument visualisation of the selected record" },
  { keys: ["P"], label: "Open pricing tiers", desc: "View the Commercial Constitution & subscribe" },
  { keys: ["G"], label: "Open chain graph", desc: "Full-screen visualization of all blocks" },
  { keys: ["A"], label: "Toggle auto-release", desc: "Starts/stops the 6s auto-release loop" },
  { keys: ["["], label: "Toggle device registry", desc: "Collapses/expands the left panel" },
  { keys: ["]"], label: "Toggle chain inspector", desc: "Collapses/expands the right panel" },
  { keys: ["1"], label: "Mobile: show map", desc: "Switch mobile view to the 3D map" },
  { keys: ["2"], label: "Mobile: show devices", desc: "Switch mobile view to the device registry" },
  { keys: ["3"], label: "Mobile: show chain", desc: "Switch mobile view to the WORM chain" },
  { keys: ["Esc"], label: "Close drawer / modal", desc: "Dismisses the topmost overlay" },
  { keys: ["?"], label: "Toggle this help", desc: "You're looking at it" },
];

export function HelpOverlay({ open, onClose }: HelpOverlayProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-40 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ scale: 0.96, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 12, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-slate-800 p-5">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-slate-900 p-2 ring-1 ring-slate-800">
                  <KeyboardIcon className="h-4 w-4 text-slate-300" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-100">
                    Keyboard Shortcuts
                  </h2>
                  <p className="text-xs text-slate-500">
                    Skylantern digital twin — power-user controls
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-400"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </header>
            <div className="max-h-[60vh] overflow-y-auto p-5">
              <ul className="space-y-2">
                {SHORTCUTS.map((s) => (
                  <li
                    key={s.keys[0]}
                    className="flex items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-900/40 p-2.5"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-200">
                        {s.label}
                      </div>
                      <div className="text-[11px] text-slate-500">{s.desc}</div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {s.keys.map((k) => (
                        <kbd
                          key={k}
                          className="inline-flex h-7 min-w-7 items-center justify-center rounded border border-slate-700 bg-slate-800 px-2 font-mono text-xs font-semibold text-slate-200 shadow-[inset_0_-2px_0_rgba(0,0,0,0.3)]"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-4 rounded-md border border-slate-800 bg-slate-900/40 p-3 text-[11px] text-slate-400">
                <strong className="text-slate-300">Tip:</strong> Click any sky
                lantern on the map, or any block in the chain inspector, to open
                the evidence drawer. Use the drawer's{" "}
                <span className="font-mono text-rose-300">Simulate Tamper</span>{" "}
                button to see the chain catch a malicious edit in real time.
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
