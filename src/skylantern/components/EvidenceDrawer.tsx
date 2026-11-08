"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Fingerprint,
  Clock,
  Crosshair,
  Shield,
  ShieldCheck,
  TriangleAlert,
  KeyRound,
  ArrowRight,
  FileJson,
  Copy,
  CheckCheck,
  Bug,
  History,
  Download,
  Loader2,
  Link2,
  AlertTriangle,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  shortHash,
  absoluteTime,
  relativeTime,
  verificationToneClass,
  verificationLabel,
  domainLabel,
  primitiveLabel,
} from "../lib/format";
import { LanternIcon } from "./LanternIcon";
import { useSkylanternStore } from "../hooks/useSkylanternStore";
import { skylanternApi } from "../lib/api";
import type { AuditEventDTO, EvidenceRecordDTO } from "../types";
import { toast } from "sonner";

interface EvidenceDrawerProps {
  evidence: EvidenceRecordDTO | null;
  open: boolean;
  onClose: () => void;
  onWitness: () => void;
}

export function EvidenceDrawer({
  evidence,
  open,
  onClose,
  onWitness,
}: EvidenceDrawerProps) {
  const [showPayload, setShowPayload] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tampering, setTampering] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const auditTimeline = useSkylanternStore((s) => s.auditTimeline);
  const setAuditTimeline = useSkylanternStore((s) => s.setAuditTimeline);
  const selectEvidence = useSkylanternStore((s) => s.selectEvidence);

  // Fetch the audit timeline whenever the drawer opens for a new record.
  useEffect(() => {
    if (!open || !evidence) return;
    let cancelled = false;
    skylanternApi
      .getAuditTimeline(evidence.id)
      .then((events) => {
        if (!cancelled) setAuditTimeline(events);
      })
      .catch(() => {
        if (!cancelled) setAuditTimeline([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, evidence?.id, setAuditTimeline]);

  if (!evidence) return null;
  const tone = verificationToneClass(evidence.verificationState);
  const canTamper =
    evidence.verificationState === "CANDIDATE" ||
    evidence.verificationState === "VERIFIED";
  const canArchive = evidence.verificationState !== "ARCHIVED";

  const copyHash = async () => {
    try {
      await navigator.clipboard.writeText(evidence.hash);
      setCopied(true);
      toast.success("Block hash copied to clipboard");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Clipboard not available");
    }
  };

  const handleTamper = async () => {
    setTampering(true);
    try {
      const updated = await skylanternApi.simulateTamper(evidence.id, {
        field: "value",
      });
      selectEvidence(updated);
      // Refresh the audit timeline immediately.
      const freshAudit = await skylanternApi.getAuditTimeline(evidence.id);
      setAuditTimeline(freshAudit);
      toast.error("Tamper detected — chain flagged the record", {
        description: `Block #${updated.sequence} → TAMPER_DETECTED. The hash no longer matches the mutated payload.`,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tamper simulation failed");
    } finally {
      setTampering(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await skylanternApi.downloadProofBundle(evidence.id);
      toast.success("Proof Bundle downloaded", {
        description: `Contains evidence, audit timeline, chain context, and integrity check.`,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const handleArchive = async () => {
    setArchiving(true);
    try {
      const updated = await skylanternApi.archiveEvidence(evidence.id);
      selectEvidence(updated);
      const freshAudit = await skylanternApi.getAuditTimeline(evidence.id);
      setAuditTimeline(freshAudit);
      toast.success("Record archived", {
        description: `Block #${updated.sequence} frozen. No further transitions allowed.`,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Archive failed");
    } finally {
      setArchiving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: 420, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 420, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          className="absolute right-0 top-0 z-30 flex h-full w-full max-w-[440px] flex-col border-l border-slate-800 bg-slate-950/95 backdrop-blur-xl shadow-2xl"
        >
          {/* Header */}
          <header className="flex items-start justify-between gap-3 border-b border-slate-800 p-5">
            <div className="flex items-start gap-3">
              <div className="mt-1 rounded-lg bg-slate-900 p-1.5 ring-1 ring-slate-800">
                <LanternIcon
                  state={evidence.verificationState}
                  size={26}
                  pulse={evidence.verificationState === "CANDIDATE"}
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-mono text-base font-semibold text-slate-100">
                    Block #{evidence.sequence}
                  </h2>
                  <Badge
                    variant="outline"
                    className={`${tone.bg} ${tone.text} ${tone.ring} border-0 font-mono`}
                  >
                    <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                    {verificationLabel(evidence.verificationState)} · R{evidence.tierTag}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {evidence.subject} · {domainLabel(evidence.device.domain)} ·{" "}
                  {primitiveLabel(evidence.device.primitive)}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400 hover:text-slate-100"
              onClick={onClose}
              aria-label="Close drawer"
            >
              <X className="h-4 w-4" />
            </Button>
          </header>

          <ScrollArea className="flex-1">
            <div className="space-y-5 p-5">
              {/* Hash + signature */}
              <section>
                <SectionLabel icon={KeyRound} label="Block Anchor" />
                <button
                  onClick={copyHash}
                  className="mt-2 flex w-full items-center justify-between gap-2 rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2 text-left hover:border-slate-700"
                >
                  <code className="font-mono text-xs text-slate-300">
                    {evidence.hash}
                  </code>
                  {copied ? (
                    <CheckCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  )}
                </button>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <Field label="previousHash">
                    <code className="font-mono text-slate-400">
                      {shortHash(evidence.previousHash)}
                    </code>
                  </Field>
                  <Field label="signature">
                    <code className="font-mono text-slate-400">
                      {shortHash(evidence.signature, 4, 4)}
                    </code>
                  </Field>
                  <Field label="observed at">
                    <span className="text-slate-300">
                      {absoluteTime(evidence.observedAt)}
                    </span>
                  </Field>
                  <Field label="signed at">
                    <span className="text-slate-300">
                      {absoluteTime(evidence.signedAt)}
                    </span>
                    <span className="ml-1 text-slate-500">
                      ({relativeTime(evidence.signedAt)})
                    </span>
                  </Field>
                </div>
              </section>

              <Separator className="bg-slate-800" />

              {/* Three observation levels */}
              <section className="space-y-3">
                <SectionLabel
                  icon={Crosshair}
                  label="The Three Levels · must not collapse"
                />
                <LevelCard
                  index={1}
                  label="Observed Fact"
                  tone="slate"
                  hint="The only absolute truth"
                  body={
                    <div className="space-y-1.5 text-sm">
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-2xl font-semibold text-slate-100">
                          {String(evidence.observedFact.value)}
                        </span>
                        <span className="text-slate-400">
                          {evidence.observedFact.unit}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        primitive: {primitiveLabel(evidence.observedFact.primitive)}
                      </div>
                      <code className="block rounded bg-slate-900/80 px-2 py-1 font-mono text-[11px] text-slate-400">
                        {evidence.observedFact.raw}
                      </code>
                    </div>
                  }
                />
                <LevelCard
                  index={2}
                  label="Derived Event"
                  tone="amber"
                  hint={
                    evidence.derivedEvent
                      ? `inferred by ${evidence.derivedEvent.firmwareVersion}`
                      : "no inference recorded"
                  }
                  body={
                    evidence.derivedEvent ? (
                      <p className="text-sm text-slate-200">
                        {evidence.derivedEvent.inference}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 italic">— none —</p>
                    )
                  }
                />
                <LevelCard
                  index={3}
                  label="Decision"
                  tone="emerald"
                  hint={
                    evidence.decision
                      ? `status: ${evidence.decision.status}`
                      : "no action"
                  }
                  body={
                    evidence.decision ? (
                      <p className="text-sm text-slate-200">
                        {evidence.decision.action}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 italic">— none —</p>
                    )
                  }
                />
              </section>

              <Separator className="bg-slate-800" />

              {/* Device */}
              <section>
                <SectionLabel icon={Fingerprint} label="Signing Device" />
                <div className="mt-2 rounded-md border border-slate-800 bg-slate-900/50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium text-slate-200">
                        {evidence.device.label}
                      </div>
                      <div className="text-xs text-slate-500">
                        {evidence.device.externalId}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-slate-700 font-mono text-[10px] text-slate-400"
                    >
                      {domainLabel(evidence.device.domain)}
                    </Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <Field label="geo">
                      <span className="font-mono text-slate-400">
                        {evidence.lat.toFixed(4)}, {evidence.lng.toFixed(4)}
                      </span>
                    </Field>
                    <Field label="source">
                      <span className="font-mono text-slate-400">
                        {evidence.source}
                      </span>
                    </Field>
                  </div>
                </div>
              </section>

              <Separator className="bg-slate-800" />

              {/* Witnesses */}
              <section>
                <SectionLabel
                  icon={ShieldCheck}
                  label={`Corroboration · ${evidence.witnesses.length} witness(es)`}
                />
                {evidence.witnesses.length === 0 ? (
                  <div className="mt-2 rounded-md border border-amber-900/40 bg-amber-950/20 p-3 text-xs text-amber-200/90">
                    <Shield className="mb-1 inline h-3.5 w-3.5" /> Single-witness
                    record. Tier R1. Court-grade eligibility begins at R2 —
                    attach a second witness to elevate.
                  </div>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {evidence.witnesses.map((w) => (
                      <li
                        key={w.id}
                        className="rounded-md border border-emerald-900/40 bg-emerald-950/20 p-2 text-xs text-emerald-200/90"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{w.witnessLabel}</span>
                          <Badge
                            variant="outline"
                            className="border-emerald-900/50 font-mono text-[10px] text-emerald-300"
                          >
                            {w.witnessType}
                          </Badge>
                        </div>
                        {w.witnessKeyHint && (
                          <div className="mt-0.5 font-mono text-[10px] text-emerald-300/70">
                            keyHint: {w.witnessKeyHint}
                          </div>
                        )}
                        <div className="mt-0.5 text-[10px] text-emerald-300/60">
                          signed {relativeTime(w.signedAt)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {evidence.verificationState === "CANDIDATE" && (
                  <Button
                    className="mt-3 w-full"
                    onClick={onWitness}
                    variant="default"
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Attach Second Witness → Elevate to R2
                  </Button>
                )}
                {evidence.verificationState === "TAMPER_DETECTED" && (
                  <div className="mt-3 flex items-start gap-2 rounded-md border border-rose-900/50 bg-rose-950/30 p-3 text-xs text-rose-200">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <strong>Integrity check failed.</strong> This record has
                      been explicitly flagged — never silently downgraded. The
                      chain still proves the record was not altered post-hoc
                      (because the hash no longer matches), but the reading
                      itself must not be trusted.
                    </div>
                  </div>
                )}
              </section>

              <Separator className="bg-slate-800" />

              {/* Audit Timeline — new in Round 2 */}
              <section>
                <SectionLabel
                  icon={History}
                  label={`Audit Timeline · ${auditTimeline.length} event(s)`}
                />
                {auditTimeline.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500 italic">
                    No audit events recorded.
                  </p>
                ) : (
                  <ol className="mt-3 space-y-0">
                    {auditTimeline.map((ev, idx) => (
                      <AuditTimelineEntry
                        key={ev.id}
                        event={ev}
                        isLast={idx === auditTimeline.length - 1}
                      />
                    ))}
                  </ol>
                )}
              </section>

              <Separator className="bg-slate-800" />

              {/* Payload */}
              <section>
                <button
                  className="flex w-full items-center justify-between"
                  onClick={() => setShowPayload((v) => !v)}
                >
                  <SectionLabel
                    icon={FileJson}
                    label="Locked Payload"
                    className="text-left"
                  />
                  <ArrowRight
                    className={`h-3.5 w-3.5 text-slate-500 transition-transform ${
                      showPayload ? "rotate-90" : ""
                    }`}
                  />
                </button>
                {showPayload && (
                  <pre className="mt-2 max-h-64 overflow-auto rounded-md border border-slate-800 bg-slate-950 p-3 font-mono text-[10px] leading-relaxed text-slate-300">
                    {JSON.stringify(JSON.parse(evidence.payload), null, 2)}
                  </pre>
                )}
              </section>

              <div className="flex items-center gap-1.5 pt-2 text-[10px] text-slate-500">
                <Clock className="h-3 w-3" />
                Created {relativeTime(evidence.createdAt)} ·{" "}
                <span className="text-slate-600">
                  We prove the record, not the reality.
                </span>
              </div>
            </div>
          </ScrollArea>

          {/* Action toolbar — sticky at the bottom of the drawer */}
          <footer className="border-t border-slate-800 bg-slate-950/90 p-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 border-slate-700 bg-slate-900 hover:bg-slate-800"
                onClick={handleDownload}
                disabled={downloading}
              >
                {downloading ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                )}
                Proof Bundle
              </Button>
              {canArchive && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
                      disabled={archiving}
                    >
                      {archiving ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Archive className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Archive
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="border-slate-800 bg-slate-950">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2 text-slate-100">
                        <ArchiveRestore className="h-5 w-5 text-slate-400" />
                        Archive this record?
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-slate-400">
                        Archiving freezes block #{evidence.sequence} in its
                        current state (
                        <code className="rounded bg-slate-800 px-1 font-mono text-slate-300">
                          {evidence.verificationState}
                        </code>
                        ). No further transitions — witness attachment, tamper
                        simulation, or state changes — will be allowed. This is
                        the operator's "close the case" action.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-slate-700 text-white hover:bg-slate-600"
                        onClick={handleArchive}
                      >
                        <Archive className="mr-1.5 h-4 w-4" />
                        Archive block
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {canTamper && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-rose-800/50 bg-rose-950/30 text-rose-300 hover:bg-rose-950/50 hover:text-rose-200"
                      disabled={tampering}
                    >
                      {tampering ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Bug className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Simulate Tamper
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="border-slate-800 bg-slate-950">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2 text-slate-100">
                        <AlertTriangle className="h-5 w-5 text-rose-400" />
                        Simulate a malicious edit?
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-slate-400">
                        This will mutate the stored payload (changing the
                        observed value to 0) <strong>without</strong> updating
                        the hash or signature. The next integrity check will
                        catch the mismatch and flag this block as{" "}
                        <code className="rounded bg-rose-950/50 px-1 font-mono text-rose-300">
                          TAMPER_DETECTED
                        </code>
                        . This demonstrates the core promise:{" "}
                        <em>we prove the record, not the reality.</em>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-rose-600 text-white hover:bg-rose-700"
                        onClick={handleTamper}
                      >
                        <Bug className="mr-1.5 h-4 w-4" />
                        Mutate payload
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </footer>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Audit timeline entry — a vertical timeline with icons per action type.
// ---------------------------------------------------------------------------

function AuditTimelineEntry({
  event,
  isLast,
}: {
  event: AuditEventDTO;
  isLast: boolean;
}) {
  const config = getAuditConfig(event.action);
  const Icon = config.icon;
  return (
    <li className="relative flex gap-3 pb-4">
      {/* Timeline rail */}
      {!isLast && (
        <div className="absolute left-[11px] top-6 bottom-0 w-px bg-slate-800" />
      )}
      <div
        className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${config.bg} ring-1 ${config.ring}`}
      >
        <Icon className={`h-3 w-3 ${config.color}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs font-medium ${config.color}`}>
            {config.label}
          </span>
          <span className="shrink-0 text-[10px] text-slate-500">
            {relativeTime(event.at)}
          </span>
        </div>
        <div className="mt-0.5 text-[11px] text-slate-400">
          {event.fromState && (
            <>
              <span className="font-mono">{event.fromState}</span>
              <ArrowRight className="mx-1 inline h-2.5 w-2.5" />
            </>
          )}
          {event.toState && (
            <span className="font-mono">{event.toState}</span>
          )}
        </div>
        <div className="mt-0.5 text-[10px] text-slate-500">
          actor: <span className="font-mono text-slate-400">{event.actor}</span>
        </div>
        {event.note && (
          <div className="mt-1 rounded bg-slate-900/60 px-2 py-1 text-[10px] text-slate-400">
            {event.note}
          </div>
        )}
      </div>
    </li>
  );
}

function getAuditConfig(action: string): {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  bg: string;
  ring: string;
} {
  switch (action) {
    case "CREATE":
      return {
        icon: KeyRound,
        label: "Block Created",
        color: "text-slate-300",
        bg: "bg-slate-800",
        ring: "ring-slate-700",
      };
    case "WITNESS_ATTACHED":
      return {
        icon: ShieldCheck,
        label: "Witness Attached",
        color: "text-emerald-300",
        bg: "bg-emerald-950/40",
        ring: "ring-emerald-800/50",
      };
    case "STATE_ELEVATED":
      return {
        icon: ShieldCheck,
        label: "State Elevated",
        color: "text-emerald-300",
        bg: "bg-emerald-950/40",
        ring: "ring-emerald-800/50",
      };
    case "TAMPER_FLAGGED":
      return {
        icon: TriangleAlert,
        label: "Tamper Detected",
        color: "text-rose-300",
        bg: "bg-rose-950/40",
        ring: "ring-rose-800/50",
      };
    case "ARCHIVED":
      return {
        icon: Link2,
        label: "Archived",
        color: "text-slate-400",
        bg: "bg-slate-800/50",
        ring: "ring-slate-700",
      };
    default:
      return {
        icon: History,
        label: action,
        color: "text-slate-300",
        bg: "bg-slate-800",
        ring: "ring-slate-700",
      };
  }
}

function SectionLabel({
  icon: Icon,
  label,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-1.5 ${className ?? ""}`}>
      <Icon className="h-3.5 w-3.5 text-slate-500" />
      <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
        {label}
      </span>
    </div>
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
      <div className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

function LevelCard({
  index,
  label,
  tone,
  hint,
  body,
}: {
  index: number;
  label: string;
  tone: "slate" | "amber" | "emerald";
  hint: string;
  body: React.ReactNode;
}) {
  const toneClass = {
    slate: "border-slate-800 bg-slate-900/40",
    amber: "border-amber-900/40 bg-amber-950/15",
    emerald: "border-emerald-900/40 bg-emerald-950/15",
  }[tone];
  const badgeClass = {
    slate: "bg-slate-700/60 text-slate-300",
    amber: "bg-amber-500/20 text-amber-300",
    emerald: "bg-emerald-500/20 text-emerald-300",
  }[tone];
  return (
    <div className={`rounded-md border ${toneClass} p-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex h-5 w-5 items-center justify-center rounded-full font-mono text-[10px] ${badgeClass}`}
          >
            {index}
          </span>
          <span className="text-xs font-medium text-slate-200">{label}</span>
        </div>
        <span className="text-[10px] text-slate-500">{hint}</span>
      </div>
      <div className="mt-2">{body}</div>
    </div>
  );
}
