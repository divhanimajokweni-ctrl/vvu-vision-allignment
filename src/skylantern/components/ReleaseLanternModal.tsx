"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Flame, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  PRIMITIVE_DEFINITIONS,
  PRICING_TIERS,
} from "../primitives";
import type {
  Domain,
  Primitive,
  SubmitEvidenceRequest,
} from "../types";
import { PRIMITIVES, DOMAINS } from "../types";
import { skylanternApi } from "../lib/api";
import { useSkylanternStore } from "../hooks/useSkylanternStore";
import { LanternIcon } from "./LanternIcon";

interface ReleaseLanternModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * ReleaseLanternModal — the capture flow for a new sky lantern.
 *
 * Walks the operator through the 4-layer stack as they fill the form:
 *   1. Pick a physical device (layer 1)
 *   2. Capture the observed fact (layer 1)
 *   3. Optionally add a derived event (layer 4 - inference)
 *   4. Optionally add a decision (layer 4 - action)
 *
 * The hardware crypto + WORM chain (layers 2 & 3) happen automatically
 * server-side on submit — see /api/skylantern/evidence POST.
 */
export function ReleaseLanternModal({ open, onClose }: ReleaseLanternModalProps) {
  const devices = useSkylanternStore((s) => s.devices);
  const selectEvidence = useSkylanternStore((s) => s.selectEvidence);
  const openDrawer = useSkylanternStore((s) => s.openDrawer);

  const [deviceExternalId, setDeviceExternalId] = useState<string>("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  const [primitive, setPrimitive] = useState<Primitive>("STATE");
  const [raw, setRaw] = useState("");
  const [inference, setInference] = useState("");
  const [decisionAction, setDecisionAction] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const filteredDevices = devices;

  const reset = () => {
    setDeviceExternalId("");
    setValue("");
    setUnit("");
    setPrimitive("STATE");
    setRaw("");
    setInference("");
    setDecisionAction("");
  };

  const submit = async () => {
    if (!deviceExternalId) {
      toast.error("Pick a device first.");
      return;
    }
    if (!value || !raw) {
      toast.error("Observed value and raw reading are required.");
      return;
    }
    const numeric = Number(value);
    const valueField: SubmitEvidenceRequest["observedFact"]["value"] = Number.isFinite(
      numeric
    )
      ? numeric
      : value;
    setSubmitting(true);
    try {
      const evidence = await skylanternApi.submitEvidence({
        deviceExternalId,
        observedFact: {
          value: valueField,
          unit: unit || PRIMITIVE_DEFINITIONS[primitive].defaultUnit,
          primitive,
          raw,
        },
        derivedEvent: inference
          ? { inference, firmwareVersion: "vvu-operator/1.0.0" }
          : null,
        decision: decisionAction
          ? { action: decisionAction, status: "RECOMMENDED" }
          : null,
      });
      toast.success(`Block #${evidence.sequence} released · ${evidence.hash.slice(0, 10)}…`);
      selectEvidence(evidence);
      openDrawer(evidence.id);
      reset();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

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
            className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-2xl"
          >
            <header className="flex items-start justify-between border-b border-slate-800 p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-500/10 p-2 ring-1 ring-amber-500/30">
                  <Flame className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-100">
                    Release a Sky Lantern
                  </h2>
                  <p className="text-xs text-slate-500">
                    Capture an observation → sign → chain. The 4-layer stack in one click.
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

            <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
              <Field label="Signing Device (Layer 1)">
                <Select
                  value={deviceExternalId}
                  onValueChange={setDeviceExternalId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a registered device…" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredDevices.map((d) => (
                      <SelectItem key={d.id} value={d.externalId}>
                        <span className="font-mono">{d.externalId}</span>
                        <span className="ml-2 text-slate-400">{d.label}</span>
                      </SelectItem>
                    ))}
                    {filteredDevices.length === 0 && (
                      <div className="px-2 py-1.5 text-xs text-slate-500">
                        No devices registered.
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Functional Primitive">
                <Select
                  value={primitive}
                  onValueChange={(v) => setPrimitive(v as Primitive)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIMITIVES.map((p) => (
                      <SelectItem key={p} value={p}>
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ background: PRIMITIVE_DEFINITIONS[p].accent }}
                          />
                          {p}
                          <span className="text-slate-500">
                            — {PRIMITIVE_DEFINITIONS[p].label}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[10px] text-slate-500">
                  {PRIMITIVE_DEFINITIONS[primitive].blurb}
                </p>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Observed Value">
                  <Input
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="42.7"
                    className="bg-slate-900 font-mono"
                  />
                </Field>
                <Field label="Unit">
                  <Input
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder={PRIMITIVE_DEFINITIONS[primitive].defaultUnit}
                    className="bg-slate-900 font-mono"
                  />
                </Field>
              </div>

              <Field label="Raw Sensor Reading">
                <Textarea
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                  placeholder="P=8.4bar;T=18.7C;FLOW=12.5"
                  className="bg-slate-950 font-mono text-xs"
                  rows={2}
                />
                <p className="mt-1 text-[10px] text-slate-500">
                  The only absolute truth. Survives every layer above.
                </p>
              </Field>

              <div className="rounded-md border border-slate-800 bg-slate-900/40 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                    Optional · Layer 4
                  </span>
                </div>
                <Field label="Derived Event (inference)">
                  <Input
                    value={inference}
                    onChange={(e) => setInference(e.target.value)}
                    placeholder="Leak-Candidate Flagged."
                    className="bg-slate-950"
                  />
                </Field>
                <div className="mt-2">
                  <Field label="Decision (action)">
                    <Input
                      value={decisionAction}
                      onChange={(e) => setDecisionAction(e.target.value)}
                      placeholder="Maintenance alert SMS dispatched."
                      className="bg-slate-950"
                    />
                  </Field>
                </div>
              </div>

              <div className="rounded-md border border-amber-900/30 bg-amber-950/10 p-3 text-[11px] text-amber-200/80">
                Once the hardware key signs the payload, silent deletion becomes
                mathematically impossible for both the user and the operator.
              </div>
            </div>

            <footer className="flex items-center justify-between border-t border-slate-800 bg-slate-950/80 p-4">
              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                <LanternIcon state="CANDIDATE" size={20} pulse />
                <span>Will mint block #{`?`} · state CANDIDATE · tier R1</span>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={onClose} disabled={submitting}>
                  Cancel
                </Button>
                <Button onClick={submit} disabled={submitting}>
                  {submitting ? "Signing…" : "Release Lantern"}
                  {!submitting && <ChevronRight className="ml-1 h-4 w-4" />}
                </Button>
              </div>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-400">
        {label}
      </Label>
      {children}
    </div>
  );
}

export { PRICING_TIERS, DOMAINS };
