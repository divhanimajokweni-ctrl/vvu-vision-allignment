"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Microscope, Info } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EvidenceInstrument } from "./EvidenceInstrument";
import { AnatomyAdapter } from "./anatomy-adapter";
import {
  fromEvidenceRecord,
  RENDER_MODE,
  validateVisualState,
  type VisualState,
  type VisualEvent,
} from "./visual-state";
import { useSkylanternStore } from "../hooks/useSkylanternStore";
import { skylanternApi } from "../lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AnatomyOverlayProps {
  open: boolean;
  onClose: () => void;
}

/**
 * AnatomyOverlay — full-screen Evidence Instrument visualisation.
 *
 * Shows the Anatomy Evidence Instrument for the currently-selected evidence
 * record. The instrument is driven ENTIRELY by the VisualState derived from
 * the record's verification state — it never computes its own verification
 * result.
 *
 * "The system establishes what is true, the evidence explains why the system
 * believes it, and the visualisation makes both inspectable."
 */
export function AnatomyOverlay({ open, onClose }: AnatomyOverlayProps) {
  const selectedEvidence = useSkylanternStore((s) => s.selectedEvidence);
  const auditTimeline = useSkylanternStore((s) => s.auditTimeline);

  // Build the adapter once.
  const adapter = useMemo(
    () =>
      new AnatomyAdapter({
        id: "anatomy-overlay",
        type: "evidence-instrument",
        onInteraction: (componentId) => {
          toast.info(`Component selected: ${componentId}`, {
            description:
              "The visualisation reported a user interaction. The verification state is NOT affected.",
          });
        },
        onError: (err) => {
          if (process.env.NODE_ENV !== "production") {
            console.warn("[anatomy]", err.message);
          }
        },
      }),
    []
  );

  // Current visual state (re-derived when the selected evidence changes).
  // Derive with useMemo instead of useState+useEffect to avoid the
  // "calling setState synchronously within an effect" cascading render warning.
  const visualState = useMemo<VisualState | null>(() => {
    if (!open || !selectedEvidence) return null;

    const events: VisualEvent[] = auditTimeline.map((e) => ({
      id: e.id,
      action: e.action,
      at: e.at,
      note: e.note ?? undefined,
    }));

    const state = fromEvidenceRecord(selectedEvidence, events);
    const validation = validateVisualState(state);
    if (!validation.isValid) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[anatomy] visual state validation failed:", validation.errors);
      }
    }
    adapter.update(state);
    return state;
  }, [open, selectedEvidence, auditTimeline, adapter]);

  useEffect(() => {
    if (!open) return;
    adapter.init();
    return () => adapter.destroy();
  }, [open, adapter]);

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
                <Microscope className="h-5 w-5 text-slate-300" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  Anatomy × VVU — Evidence Instrument
                </h2>
                <p className="text-xs text-slate-500">
                  Visualisation layer · driven by authoritative verification state
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedEvidence && (
                <Badge
                  variant="outline"
                  className="border-slate-700 font-mono text-[10px] text-slate-400"
                >
                  Block #{selectedEvidence.sequence}
                </Badge>
              )}
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

          <ScrollArea className="flex-1">
            <div className="mx-auto max-w-4xl p-6">
              {/* The critical boundary notice */}
              <div className="mb-6 flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <div className="text-xs text-slate-400">
                  <strong className="text-slate-300">
                    The critical boundary:
                  </strong>{" "}
                  Anatomy renders the system. VVU·IVE determines the system&apos;s
                  state. ProofBridge supplies the evidence. This instrument
                  <em> reflects </em> the verification result — it never
                  <em> computes </em> it. If the interlock is disengaged, it stays
                  disengaged regardless of how the animation looks.
                </div>
              </div>

              {!selectedEvidence ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Microscope className="mb-3 h-12 w-12 text-slate-700" />
                  <h3 className="text-base font-semibold text-slate-300">
                    No evidence record selected
                  </h3>
                  <p className="mt-1 max-w-sm text-xs text-slate-500">
                    Select a block from the WORM Chain inspector, or click a sky
                    lantern on the map, to see its verification state rendered as
                    a precision instrument.
                  </p>
                </div>
              ) : (
                visualState && (
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* The instrument */}
                    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-6">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-200">
                          The Evidence Instrument
                        </h3>
                        <span className="font-mono text-[10px] text-slate-600">
                          5 stages · isometric SVG
                        </span>
                      </div>
                      <EvidenceInstrument
                        state={visualState}
                        onComponentSelect={(id) =>
                          adapter.handleInteraction(id)
                        }
                      />
                    </div>

                    {/* The 5-pass pipeline explanation */}
                    <div className="space-y-4">
                      <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-6">
                        <h3 className="mb-3 text-sm font-semibold text-slate-200">
                          The 5 Mechanical Stages
                        </h3>
                        <ol className="space-y-3 text-xs">
                          <PipelineStage
                            num={1}
                            name="Input Carriage"
                            desc="Evidence intake — slides into position when a reading is received."
                            state={
                              visualState.sources.length > 0
                                ? "ENGAGED"
                                : "DISENGAGED"
                            }
                            active={visualState.sources.length > 0}
                          />
                          <PipelineStage
                            num={2}
                            name="Source Selector"
                            desc="Identifies which source produced the reading."
                            state={`${visualState.sources.length} source(s)`}
                            active={visualState.sources.length > 0}
                          />
                          <PipelineStage
                            num={3}
                            name="Interlock"
                            desc="Independence requirement — engages only when a second witness is attached (R2)."
                            state={
                              visualState.verification.tierTag >= 2
                                ? "ENGAGED · R2"
                                : "DISENGAGED · R1"
                            }
                            active={visualState.verification.tierTag >= 2}
                          />
                          <PipelineStage
                            num={4}
                            name="Final Indicator"
                            desc="The verification verdict — points to PROVEN, BLOCKED, or INCONCLUSIVE."
                            state={visualState.verification.status}
                            active={visualState.verification.status === "PROVEN"}
                          />
                          <PipelineStage
                            num={5}
                            name="Release Lever"
                            desc="Physically blocked unless verification is PROVEN."
                            state={
                              visualState.verification.status === "PROVEN" ||
                              visualState.verification.status === "RELEASED"
                                ? "ENGAGED"
                                : "BLOCKED"
                            }
                            active={
                              visualState.verification.status === "PROVEN" ||
                              visualState.verification.status === "RELEASED"
                            }
                          />
                        </ol>
                      </div>

                      {/* Architecture note */}
                      <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-6">
                        <h3 className="mb-2 text-sm font-semibold text-slate-200">
                          Architecture
                        </h3>
                        <pre className="overflow-x-auto rounded-md bg-slate-950 p-3 font-mono text-[10px] leading-relaxed text-slate-400">
{`Skylantern WORM Chain
  └─ EvidenceRecord (authoritative)
       └─ fromEvidenceRecord()  ← THE ONLY translation
            └─ VisualState
                 └─ AnatomyAdapter
                      └─ EvidenceInstrument (passive)
                           └─ user interaction → onInteraction callback
                                (does NOT change verification state)`}
                        </pre>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          </ScrollArea>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PipelineStage({
  num,
  name,
  desc,
  state,
  active,
}: {
  num: number;
  name: string;
  desc: string;
  state: string;
  active: boolean;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold",
          active
            ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
            : "bg-slate-800 text-slate-500 ring-1 ring-slate-700"
        )}
      >
        {num}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-200">{name}</span>
          <span
            className={cn(
              "font-mono text-[10px]",
              active ? "text-emerald-300" : "text-slate-500"
            )}
          >
            {state}
          </span>
        </div>
        <p className="mt-0.5 text-[10px] text-slate-500">{desc}</p>
      </div>
    </li>
  );
}
