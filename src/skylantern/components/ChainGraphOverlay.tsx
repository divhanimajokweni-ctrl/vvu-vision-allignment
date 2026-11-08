"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Boxes,
  Link2,
  ShieldCheck,
  Hourglass,
  TriangleAlert,
  Archive,
  CircleCheck,
  CircleAlert,
  Loader2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSkylanternStore } from "../hooks/useSkylanternStore";
import { skylanternApi } from "../lib/api";
import { shortHash, relativeTime } from "../lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { VerificationState } from "../types";

interface ChainGraphOverlayProps {
  open: boolean;
  onClose: () => void;
}

const STATE_ICON: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  CANDIDATE: Hourglass,
  VERIFIED: ShieldCheck,
  TAMPER_DETECTED: TriangleAlert,
  ARCHIVED: Archive,
};

const STATE_COLOR: Record<string, string> = {
  CANDIDATE: "#f59e0b",
  VERIFIED: "#10b981",
  TAMPER_DETECTED: "#ef4444",
  ARCHIVED: "#6b7280",
};

const STATE_TONE: Record<string, string> = {
  CANDIDATE: "text-amber-300",
  VERIFIED: "text-emerald-300",
  TAMPER_DETECTED: "text-rose-300",
  ARCHIVED: "text-slate-400",
};

/**
 * ChainGraphOverlay — a full-screen WORM chain visualization.
 *
 * Renders every block as a node in a horizontal flow (newest on the right,
 * genesis on the left), connected by hash-link edges. Tampered nodes glow red;
 * verified nodes glow emerald. Clicking a node opens the evidence drawer.
 *
 * Also runs a live integrity check on mount, showing which nodes fail hash
 * verification.
 */
export function ChainGraphOverlay({ open, onClose }: ChainGraphOverlayProps) {
  const chain = useSkylanternStore((s) => s.chain);
  const evidence = useSkylanternStore((s) => s.evidence);
  const selectEvidence = useSkylanternStore((s) => s.selectEvidence);
  const openDrawer = useSkylanternStore((s) => s.openDrawer);
  const chainIntegrity = useSkylanternStore((s) => s.chainIntegrity);
  const setChainIntegrity = useSkylanternStore((s) => s.setChainIntegrity);
  const isVerifyingChain = useSkylanternStore((s) => s.isVerifyingChain);
  const setVerifyingChain = useSkylanternStore((s) => s.setVerifyingChain);
  const [hoveredSeq, setHoveredSeq] = useState<number | null>(null);

  // Ascending order for the graph (genesis left → head right).
  const ascending = useMemo(
    () => [...chain].reverse(),
    [chain]
  );

  const tamperedSeqs = useMemo(() => {
    if (!chainIntegrity) return new Set<number>();
    return new Set(chainIntegrity.tamperedBlocks.map((b) => b.sequence));
  }, [chainIntegrity]);

  const runVerify = async () => {
    setVerifyingChain(true);
    try {
      const report = await skylanternApi.verifyChain();
      setChainIntegrity(report);
      if (report.tampered === 0) {
        toast.success(`Chain integrity verified · ${report.verified}/${report.totalBlocks} blocks clean`);
      } else {
        toast.error(`${report.tampered} tampered block(s) detected`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verify failed");
    } finally {
      setVerifyingChain(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-40 flex flex-col bg-slate-950/95 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Header */}
          <header className="flex items-center justify-between border-b border-slate-800 p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-slate-900 p-2 ring-1 ring-slate-800">
                <Boxes className="h-5 w-5 text-slate-300" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  WORM Chain Graph
                </h2>
                <p className="text-xs text-slate-500">
                  {chain.length} blocks · genesis → head · hash-linked
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {chainIntegrity && (
                <Badge
                  variant="outline"
                  className={cn(
                    "border-0 font-mono text-[10px]",
                    chainIntegrity.tampered === 0
                      ? "bg-emerald-500/10 text-emerald-300"
                      : "bg-rose-500/10 text-rose-300"
                  )}
                >
                  {chainIntegrity.tampered === 0 ? (
                    <CircleCheck className="mr-1 h-3 w-3" />
                  ) : (
                    <CircleAlert className="mr-1 h-3 w-3" />
                  )}
                  {chainIntegrity.tampered === 0
                    ? `${chainIntegrity.verified}/${chainIntegrity.totalBlocks} clean`
                    : `${chainIntegrity.tampered} tampered`}
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={runVerify}
                disabled={isVerifyingChain}
                className="border-slate-700 bg-slate-900 hover:bg-slate-800"
              >
                {isVerifyingChain ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                )}
                Verify integrity
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-slate-100"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </header>

          {/* Legend */}
          <div className="flex items-center gap-4 border-b border-slate-800 px-5 py-2 text-[11px] text-slate-400">
            <span className="font-mono uppercase tracking-wider text-slate-500">
              Legend:
            </span>
            {(["CANDIDATE", "VERIFIED", "TAMPER_DETECTED", "ARCHIVED"] as VerificationState[]).map(
              (s) => {
                const Icon = STATE_ICON[s];
                return (
                  <span key={s} className="flex items-center gap-1.5">
                    <Icon className={cn("h-3 w-3", STATE_TONE[s])} />
                    <span className={STATE_TONE[s]}>{s.replace("_", " ")}</span>
                  </span>
                );
              }
            )}
            <span className="ml-auto text-slate-600">
              Hover a node for details · click to open
            </span>
          </div>

          {/* Graph canvas — horizontal scroll if chain is long */}
          <div className="relative flex-1 overflow-auto">
            <ScrollArea className="h-full">
              <div className="flex min-h-full items-center gap-0 p-8">
                {ascending.length === 0 && (
                  <div className="mx-auto text-center text-slate-500">
                    <Boxes className="mx-auto mb-2 h-8 w-8 opacity-40" />
                    <p className="text-sm">The chain is empty.</p>
                    <p className="text-xs">Release a lantern to mint the genesis block.</p>
                  </div>
                )}
                {ascending.map((block, idx) => {
                  const state = block.verificationState as VerificationState;
                  const color = STATE_COLOR[state] ?? "#64748b";
                  const Icon = STATE_ICON[state] ?? Boxes;
                  const isHovered = hoveredSeq === block.sequence;
                  const isHead = idx === ascending.length - 1;
                  const isTampered = tamperedSeqs.has(block.sequence);
                  const fullEvidence = evidence.find((e) => e.sequence === block.sequence);
                  return (
                    <div key={block.hash} className="flex items-center">
                      {/* Edge to previous block */}
                      {idx > 0 && (
                        <div className="relative flex items-center">
                          <div
                            className="h-px w-16"
                            style={{
                              background: isTampered
                                ? "linear-gradient(90deg, #ef4444, #ef4444)"
                                : "linear-gradient(90deg, rgba(148,163,184,0.4), rgba(148,163,184,0.4))",
                            }}
                          />
                          <Link2
                            className="absolute left-1/2 -translate-x-1/2 text-slate-600"
                            style={{ color: isTampered ? "#ef4444" : undefined }}
                          />
                        </div>
                      )}
                      {/* Node */}
                      <motion.button
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: idx * 0.04, type: "spring", stiffness: 300, damping: 25 }}
                        whileHover={{ scale: 1.08, y: -4 }}
                        className="group relative flex flex-col items-center"
                        onClick={() => {
                          if (fullEvidence) {
                            selectEvidence(fullEvidence);
                            openDrawer(fullEvidence.id);
                            onClose();
                          }
                        }}
                        onMouseEnter={() => setHoveredSeq(block.sequence)}
                        onMouseLeave={() => setHoveredSeq(null)}
                      >
                        {/* Glow */}
                        <div
                          className="absolute -inset-3 rounded-full opacity-40 blur-xl transition-opacity group-hover:opacity-70"
                          style={{ background: color }}
                        />
                        {/* Node circle */}
                        <div
                          className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 bg-slate-950 transition-all"
                          style={{
                            borderColor: color,
                            boxShadow: isTampered
                              ? `0 0 20px ${color}, 0 0 40px ${color}40`
                              : isHead
                              ? `0 0 16px ${color}80`
                              : `0 0 8px ${color}40`,
                          }}
                        >
                          <Icon className="h-6 w-6" style={{ color: color as string }} />
                          {/* Sequence number */}
                          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 font-mono text-[10px] font-bold text-slate-300 ring-1 ring-slate-700">
                            {block.sequence}
                          </span>
                          {/* Head badge */}
                          {isHead && (
                            <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-500 px-1.5 py-0.5 font-mono text-[8px] font-bold text-slate-900">
                              HEAD
                            </span>
                          )}
                        </div>
                        {/* Label below */}
                        <div className="mt-2 flex flex-col items-center gap-0.5">
                          <span className={cn("text-[10px] font-mono font-bold", STATE_TONE[state])}>
                            {state === "TAMPER_DETECTED" ? "TAMPER" : state}
                          </span>
                          <span className="max-w-24 truncate text-[9px] text-slate-500">
                            {block.subject}
                          </span>
                          <span className="text-[8px] text-slate-600">
                            {relativeTime(block.observedAt)}
                          </span>
                        </div>
                        {/* Hover tooltip */}
                        {isHovered && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="absolute -top-32 left-1/2 z-50 w-48 -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-950/95 p-2 text-left shadow-2xl backdrop-blur"
                          >
                            <div className="flex items-center gap-1.5">
                              <Icon className={cn("h-3 w-3", STATE_TONE[state])} />
                              <span className="text-xs font-semibold text-slate-100">
                                Block #{block.sequence}
                              </span>
                              <span className={cn("ml-auto text-[9px] font-mono", STATE_TONE[state])}>
                                R{block.tierTag}
                              </span>
                            </div>
                            <div className="mt-1 font-mono text-[9px] text-slate-400">
                              <div className="truncate">hash: {shortHash(block.hash, 8, 4)}</div>
                              <div className="truncate">prev: {shortHash(block.previousHash, 8, 4)}</div>
                            </div>
                            <div className="mt-1 truncate text-[10px] text-slate-500">
                              {block.subject}
                            </div>
                            {isTampered && (
                              <div className="mt-1 flex items-center gap-1 text-[9px] text-rose-300">
                                <CircleAlert className="h-2.5 w-2.5" />
                                Hash mismatch — tampered
                              </div>
                            )}
                          </motion.div>
                        )}
                      </motion.button>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Footer with integrity report */}
          {chainIntegrity && (
            <footer className="border-t border-slate-800 bg-slate-950/90 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-slate-400">
                    Last check: {relativeTime(chainIntegrity.checkedAt)}
                  </span>
                  <span className="text-slate-600">·</span>
                  <span className="text-slate-400">
                    {chainIntegrity.totalBlocks} blocks · {chainIntegrity.verified} clean · {chainIntegrity.tampered} tampered
                  </span>
                  <span className="text-slate-600">·</span>
                  <span className={chainIntegrity.allLinksValid ? "text-emerald-300" : "text-rose-300"}>
                    links {chainIntegrity.allLinksValid ? "valid" : "broken"}
                  </span>
                </div>
                {chainIntegrity.tamperedBlocks.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-rose-300">Tampered:</span>
                    {chainIntegrity.tamperedBlocks.map((b) => (
                      <Badge
                        key={b.sequence}
                        variant="outline"
                        className="border-rose-800/50 bg-rose-950/30 font-mono text-[10px] text-rose-300"
                      >
                        #{b.sequence}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </footer>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
