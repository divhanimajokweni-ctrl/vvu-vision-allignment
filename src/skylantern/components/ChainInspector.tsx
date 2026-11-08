"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Link2, Link2Off, Box, Hourglass, ShieldCheck, TriangleAlert, Archive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { shortHash, relativeTime } from "../lib/format";
import { useSkylanternStore } from "../hooks/useSkylanternStore";
import { cn } from "@/lib/utils";

const STATE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  CANDIDATE: Hourglass,
  VERIFIED: ShieldCheck,
  TAMPER_DETECTED: TriangleAlert,
  ARCHIVED: Archive,
};

const STATE_TONE: Record<string, string> = {
  CANDIDATE: "text-amber-300",
  VERIFIED: "text-emerald-300",
  TAMPER_DETECTED: "text-rose-300",
  ARCHIVED: "text-slate-400",
};

const STATE_RING: Record<string, string> = {
  CANDIDATE: "ring-amber-500/40",
  VERIFIED: "ring-emerald-500/40",
  TAMPER_DETECTED: "ring-rose-500/50",
  ARCHIVED: "ring-slate-600/40",
};

/**
 * ChainInspector — the worm-chain block explorer.
 *
 * Renders the chain head-first (newest block at the top) so the operator can
 * watch blocks land in real time. Each block shows:
 *   - sequence number (#1466 ...)
 *   - hash + previousHash linkage (the "worm")
 *   - verification state + tier tag
 *   - observedAt timestamp
 */
export function ChainInspector() {
  const chain = useSkylanternStore((s) => s.chain);
  const selectedId = useSkylanternStore((s) => s.selectedEvidenceId);
  const selectEvidence = useSkylanternStore((s) => s.selectEvidence);
  const openDrawer = useSkylanternStore((s) => s.openDrawer);
  const evidence = useSkylanternStore((s) => s.evidence);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-800 p-4">
        <div className="flex items-center gap-2">
          <Box className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-100">
            WORM Chain
          </h3>
          <Badge
            variant="outline"
            className="ml-auto border-slate-700 font-mono text-[10px] text-slate-400"
          >
            {chain.length} blocks
          </Badge>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          Write-Once-Read-Many. Append-only. Newest first.
        </p>
      </header>
      <ScrollArea className="flex-1">
        <ol className="divide-y divide-slate-900">
          <AnimatePresence initial={false}>
            {chain.map((b) => {
              const isSelected =
                selectedId &&
                evidence.find((e) => e.sequence === b.sequence)?.id ===
                  selectedId;
              const full = evidence.find((e) => e.sequence === b.sequence);
              const StateIcon = STATE_ICON[b.verificationState] ?? Box;
              return (
                <motion.li
                  key={b.hash}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  className={cn(
                    "group relative cursor-pointer p-3 transition-colors hover:bg-slate-900/60",
                    isSelected && "bg-slate-900/80"
                  )}
                  onClick={() => {
                    if (full) {
                      selectEvidence(full);
                      openDrawer(full.id);
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 ring-1",
                        STATE_RING[b.verificationState]
                      )}
                    >
                      <StateIcon
                        className={cn("h-3.5 w-3.5", STATE_TONE[b.verificationState])}
                      />
                    </span>
                    <span className="font-mono text-sm font-semibold text-slate-200">
                      #{b.sequence}
                    </span>
                    <span
                      className={cn(
                        "ml-auto font-mono text-[10px] uppercase tracking-wider",
                        STATE_TONE[b.verificationState]
                      )}
                    >
                      R{b.tierTag}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 font-mono text-[10px] text-slate-500">
                    <span className="text-slate-600">hash</span>
                    <span className="truncate text-slate-300">{shortHash(b.hash, 8, 4)}</span>
                    <span className="text-slate-600">prev</span>
                    <span className="truncate text-slate-500">
                      {b.previousHash ? shortHash(b.previousHash, 8, 4) : "— genesis —"}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500">
                    <span className="truncate">{b.subject}</span>
                    <span className="ml-2 shrink-0">{relativeTime(b.observedAt)}</span>
                  </div>
                  {b.previousHash && (
                    <div className="absolute left-[22px] top-12 bottom-0 w-px bg-gradient-to-b from-slate-700/60 to-transparent">
                      <Link2 className="absolute -left-1.5 top-0 h-3 w-3 text-slate-700" />
                    </div>
                  )}
                  {!b.previousHash && (
                    <div className="absolute left-[22px] top-12 bottom-0 w-px bg-gradient-to-b from-slate-700/60 to-transparent">
                      <Link2Off className="absolute -left-1.5 top-0 h-3 w-3 text-slate-700" />
                    </div>
                  )}
                  <ChevronRight className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-700 opacity-0 transition-opacity group-hover:opacity-100" />
                </motion.li>
              );
            })}
          </AnimatePresence>
          {chain.length === 0 && (
            <li className="p-6 text-center text-xs text-slate-500">
              The chain is empty. Release a lantern to mint the genesis block.
            </li>
          )}
        </ol>
      </ScrollArea>
    </div>
  );
}
