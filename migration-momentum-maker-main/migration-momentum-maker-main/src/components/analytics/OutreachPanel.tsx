"use client";

// src/components/analytics/OutreachPanel.tsx — Task 14-a · PILOT OUTREACH engine.
// The REAL outreach engine (Resend REST via the server routes) — deliberately
// distinct from the MrrPanel pipeline counters, which are SIMULATION. This
// panel drives real target rows, the POPIA s69 consent gate (OPT_IN /
// EXISTING_CUSTOMER required — NONE refuses every send), CSV import, DRY-RUN
// previews rendered in a light-bg sandbox (an inbox email, NOT the SCADA
// theme) and the email history log. With no RESEND_API_KEY in env (this
// sandbox, by design) the engine chip reads DRY-RUN ONLY and the SEND button
// is disabled with a visible explanation.

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Loader2, Mail, Plus, Send, ShieldAlert, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useHashRoute } from "@/hooks/use-hash-route";
import type {
  ConsentBasis,
  OutreachEmail,
  OutreachResponse,
  OutreachSendPreview,
  OutreachSendResponse,
  OutreachTarget,
} from "@/types/vvu";
import {
  Chip,
  HttpError,
  QueryErrorCard,
  SectionHeader,
  fmtNum,
  fmtStamp,
  useQueryErrorToast,
} from "./shared";
import {
  clearEstateDraft,
  CONTACT_DRAFT_KEY,
  countDraftWords,
  CSV_DRAFT_KEY,
  readEstateDraft,
  writeEstateDraft,
} from "@/lib/estate-drafts";

// ─── Constants ──────────────────────────────────────────────────────────────

const CONSENT_OPTIONS: ConsentBasis[] = ["OPT_IN", "EXISTING_CUSTOMER", "NONE"];
const BATCH_CAP = 10;

const CONSENT_TONE: Record<ConsentBasis, "lime" | "sage" | "crimson"> = {
  OPT_IN: "lime",
  EXISTING_CUSTOMER: "sage",
  NONE: "crimson",
};

const STATUS_TONE: Record<string, "dim" | "teal" | "lime" | "crimson"> = {
  NEW: "dim",
  PREVIEWED: "teal",
  CONTACTED: "lime",
  BLOCKED: "crimson",
};

const EMAIL_STATUS_TONE: Record<string, "lime" | "crimson" | "amber" | "dim"> = {
  SENT: "lime",
  FAILED: "crimson",
  BLOCKED: "crimson",
  DRY_RUN: "amber",
  QUEUED: "dim",
};

const INPUT_CLASS =
  "w-full min-h-[44px] rounded-sm border border-[rgba(107,138,64,0.3)] bg-[#060806] px-3 font-mono text-[11px] text-[#c9d4bd] placeholder:text-[#5f6f54] focus:outline-none focus:border-[#8fb35a] focus-visible:shadow-[0_0_0_2px_rgba(200,255,0,0.3)] transition-[border-color,box-shadow]";

const CSV_TEXTAREA_CLASS =
  "w-full rounded-sm border border-[rgba(107,138,64,0.3)] bg-[#060806] px-3 py-2.5 font-mono text-[10px] leading-relaxed text-[#c9d4bd] placeholder:text-[#5f6f54] focus:outline-none focus:border-[#8fb35a] focus-visible:shadow-[0_0_0_2px_rgba(200,255,0,0.3)] transition-[border-color,box-shadow] resize-y min-h-[88px]";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ─── Shared local query (single cache key, project polling pattern) ────────

function useOutreachQuery() {
  return useQuery<OutreachResponse, HttpError>({
    queryKey: ["vvu-outreach"],
    queryFn: async () => {
      const res = await fetch("/api/vvu/outreach", { cache: "no-store" });
      if (!res.ok) throw new HttpError(`OUTREACH FEED HTTP ${res.status}`, res.status);
      return (await res.json()) as OutreachResponse;
    },
    refetchInterval: 10_000,
    staleTime: 5000,
  });
}

/** Segmented consent-basis control — SCADA chip buttons (44px, aria-pressed). */
function ConsentSelect({
  value,
  onChange,
  ariaLabel,
}: {
  value: ConsentBasis;
  onChange: (v: ConsentBasis) => void;
  ariaLabel: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={ariaLabel}>
      {CONSENT_OPTIONS.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            aria-pressed={active}
            aria-label={`${ariaLabel}: ${opt}`}
            className={cn(
              "vvu6c-btn vvu-label text-[9px] font-bold min-h-[44px] px-2.5 rounded border whitespace-nowrap",
              active
                ? opt === "NONE"
                  ? "bg-[#e5484d]/15 text-[#e5484d] border-[#e5484d]/60"
                  : "bg-[#c8ff00]/10 text-[#c8ff00] border-[#c8ff00]/60"
                : "border-[rgba(107,138,64,0.35)] text-[#8fb35a] hover:border-[#8fb35a] hover:text-[#c9d4bd]",
            )}
          >
            {opt === "EXISTING_CUSTOMER" ? "EXISTING CUST." : opt}
          </button>
        );
      })}
    </div>
  );
}

// ─── Edit dialog (row click) ────────────────────────────────────────────────

function EditTargetDialog({
  target,
  onClose,
  onSave,
  saving,
}: {
  target: OutreachTarget;
  onClose: () => void;
  onSave: (patch: { consentBasis: ConsentBasis; criticalIssue: string }) => void;
  saving: boolean;
}) {
  const [consentBasis, setConsentBasis] = useState<ConsentBasis>(target.consentBasis);
  const [criticalIssue, setCriticalIssue] = useState(target.criticalIssue ?? "");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        aria-label={`edit outreach target ${target.org}`}
        className="vvu-panel-solid flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 shadow-[0_24px_80px_rgba(0,0,0,0.6)] sm:max-w-[440px]"
        style={{ borderColor: "rgba(107,138,64,0.35)" }}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[rgba(107,138,64,0.25)] shrink-0">
          <div className="min-w-0">
            <DialogTitle className="font-mono text-left text-[11px] font-bold leading-tight break-all text-[#d7e2c9]">
              {target.org}
            </DialogTitle>
            <DialogDescription className="font-mono text-left mt-1.5 text-[9px] leading-none tracking-[0.18em] text-[#8fb35a]">
              EDIT OUTREACH TARGET · {target.email}
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="close target editor"
            title="Close (Escape)"
            className="shrink-0 flex items-center justify-center min-h-[44px] min-w-[44px] -my-1.5 -mr-2 rounded-sm text-[#7a8a6e] hover:text-[#e5484d] transition-colors"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="px-4 py-4 space-y-4 overflow-y-auto">
          <div>
            <div className="vvu-label text-[9px] text-[#7a8a6e] mb-2">
              CONSENT BASIS · POPIA s69 GATE
            </div>
            <ConsentSelect
              value={consentBasis}
              onChange={setConsentBasis}
              ariaLabel="consent basis"
            />
            <p className="vvu-label text-[8px] text-[#7a8a6e] mt-2 leading-relaxed">
              NONE REFUSES EVERY SEND — SERVER-SIDE, NOT JUST UI
            </p>
          </div>
          <div>
            <label
              htmlFor={`edit-issue-${target.id}`}
              className="vvu-label text-[9px] text-[#7a8a6e] mb-2 block"
            >
              CRITICAL ISSUE (PERSONALISES THE EMAIL)
            </label>
            <input
              id={`edit-issue-${target.id}`}
              type="text"
              value={criticalIssue}
              onChange={(e) => setCriticalIssue(e.target.value)}
              maxLength={300}
              placeholder="e.g. unverified B-BBEE supplier certificates"
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div className="px-4 py-3 border-t border-[rgba(107,138,64,0.25)] shrink-0 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="vvu6c-btn min-h-[44px] vvu-label text-[10px] font-bold border-[rgba(107,138,64,0.35)] text-[#7a8a6e] hover:text-[#c9d4bd] hover:border-[#8fb35a]"
          >
            CANCEL
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onSave({ consentBasis, criticalIssue })}
            disabled={saving}
            className="vvu6c-btn min-h-[44px] vvu-label text-[10px] font-bold border-[#c8ff00]/50 text-[#c8ff00] hover:bg-[#c8ff00]/10 hover:text-[#c8ff00]"
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
            SAVE TARGET
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── DRY-RUN preview dialog (light-bg sandbox) ─────────────────────────────

function PreviewDialog({
  previews,
  idx,
  onIdx,
  onClose,
}: {
  previews: OutreachSendPreview[];
  idx: number;
  onIdx: (i: number) => void;
  onClose: () => void;
}) {
  const preview = previews[Math.min(idx, previews.length - 1)];
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        aria-label="dry-run email preview"
        className="vvu-panel-solid flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 shadow-[0_24px_80px_rgba(0,0,0,0.6)] sm:max-w-[680px]"
        style={{ borderColor: "rgba(107,138,64,0.35)" }}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[rgba(107,138,64,0.25)] shrink-0">
          <div className="min-w-0">
            <DialogTitle className="font-mono text-left text-[11px] font-bold leading-tight text-[#c8ff00]">
              DRY-RUN PREVIEW · NO MESSAGE SENT
            </DialogTitle>
            <DialogDescription className="font-mono text-left mt-1.5 text-[9px] leading-none tracking-[0.18em] text-[#8fb35a] truncate">
              {preview.org} · {preview.email}
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="close dry-run preview"
            title="Close (Escape)"
            className="shrink-0 flex items-center justify-center min-h-[44px] min-w-[44px] -my-1.5 -mr-2 rounded-sm text-[#7a8a6e] hover:text-[#e5484d] transition-colors"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        {previews.length > 1 && (
          <div
            className="px-4 py-2 border-b border-[rgba(107,138,64,0.18)] flex items-center gap-1.5 overflow-x-auto shrink-0"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            aria-label="preview target switcher"
          >
            {previews.map((p, i) => (
              <button
                key={p.email}
                type="button"
                onClick={() => onIdx(i)}
                aria-pressed={i === idx}
                className={cn(
                  "vvu6c-btn vvu-label text-[8px] font-bold min-h-[36px] [@media(pointer:coarse)]:min-h-[44px] px-2 rounded border whitespace-nowrap shrink-0",
                  i === idx
                    ? "border-[#c8ff00]/60 bg-[#c8ff00]/10 text-[#c8ff00]"
                    : "border-[rgba(107,138,64,0.35)] text-[#8fb35a] hover:border-[#8fb35a] hover:text-[#c9d4bd]",
                )}
              >
                {p.org}
              </button>
            ))}
          </div>
        )}

        <div className="px-4 py-2 border-b border-[rgba(107,138,64,0.18)] shrink-0">
          <span className="vvu-label text-[8px] text-[#7a8a6e]">SUBJECT</span>
          <p className="font-mono text-[11px] text-[#c9d4bd] mt-1 break-all">{preview.subject}</p>
        </div>

        {/* Rendered email HTML in a LIGHT sandbox — this is inbox content,
            deliberately outside the SCADA dark theme. Server-side template
            escapes every target-supplied field before interpolation.
            Task 16-a: data-theme-exempt keeps it light under DAYSHIFT root
            inversion (globals.css re-inverts exempt containers). */}
        <div
          className="overflow-y-auto bg-[#f4f6f0]"
          aria-label="rendered pilot email preview"
          data-theme-exempt
        >
          <div className="p-3" dangerouslySetInnerHTML={{ __html: preview.html }} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Panel ──────────────────────────────────────────────────────────────────

interface AddApiResponse {
  success: boolean;
  target?: OutreachTarget;
  message?: string;
}

interface ImportApiResponse {
  added?: number;
  skipped?: number;
  message?: string;
  error?: string;
}

export function OutreachPanel({ num }: { num?: string }) {
  const query = useOutreachQuery();
  useQueryErrorToast(query.isError, query.error, "OUTREACH FEED");
  const queryClient = useQueryClient();
  // Round 17 — bridge into the full SEQUENCE ENGINE view (#/outreach):
  // cadences, pipeline kanban, AI drafts. This §4 panel stays as the
  // compliance/dry-run quick view.
  const [, setView] = useHashRoute();

  const targets = query.data?.targets ?? [];
  const emails = query.data?.emails ?? [];
  const config = query.data?.config ?? null;
  const resendConfigured = config?.resendConfigured ?? false;

  // form state — add target
  // THE TWIN REMEMBERS (R196): this panel and the #/outreach dialogs are
  // TWINS of the same authorship — they share ONE draft ledger per purpose
  // (CONTACT_DRAFT_KEY, CSV_DRAFT_KEY). Type on either surface, restore on
  // both; either surface's successful save ends the draft. The estate
  // remembers, not the page.
  const CONTACT_DRAFT_FIELDS = ["org", "contact", "email", "issue"] as const;
  const [contactDraftBoot] = useState(() => {
    if (typeof window === "undefined") {
      return { restored: null as Record<string, string> | null };
    }
    return {
      restored: readEstateDraft(window.localStorage, CONTACT_DRAFT_KEY, CONTACT_DRAFT_FIELDS),
    };
  });
  const [formOrg, setFormOrg] = useState(contactDraftBoot.restored?.org ?? "");
  const [formContact, setFormContact] = useState(contactDraftBoot.restored?.contact ?? "");
  const [formEmail, setFormEmail] = useState(contactDraftBoot.restored?.email ?? "");
  const [formIssue, setFormIssue] = useState(contactDraftBoot.restored?.issue ?? "");
  const [contactEcho, setContactEcho] = useState(contactDraftBoot.restored !== null);
  const [contactWords] = useState(() =>
    contactDraftBoot.restored ? countDraftWords(contactDraftBoot.restored) : 0,
  );
  const [formConsent, setFormConsent] = useState<ConsentBasis>("NONE");

  // import state
  const [csvDraftBoot] = useState(() => {
    if (typeof window === "undefined") {
      return { restored: null as Record<string, string> | null };
    }
    return { restored: readEstateDraft(window.localStorage, CSV_DRAFT_KEY, ["csv"]) };
  });
  const [csvText, setCsvText] = useState(csvDraftBoot.restored?.csv ?? "");
  const [csvEcho, setCsvEcho] = useState(csvDraftBoot.restored !== null);
  const [csvWords] = useState(() =>
    csvDraftBoot.restored ? countDraftWords(csvDraftBoot.restored) : 0,
  );

  // the drafts ride every keystroke — the whole form's shadow, one write
  const persistContact = (
    patch: Partial<{ org: string; contact: string; email: string; issue: string }>,
  ) => {
    if (typeof window !== "undefined") {
      writeEstateDraft(window.localStorage, CONTACT_DRAFT_KEY, {
        org: formOrg,
        contact: formContact,
        email: formEmail,
        issue: formIssue,
        ...patch,
      });
    }
  };
  const persistCsv = (value: string) => {
    if (typeof window !== "undefined") {
      writeEstateDraft(window.localStorage, CSV_DRAFT_KEY, { csv: value });
    }
  };

  // dialogs
  const [editId, setEditId] = useState<string | null>(null);
  const [previews, setPreviews] = useState<OutreachSendPreview[] | null>(null);
  const [previewIdx, setPreviewIdx] = useState(0);

  const editing = useMemo(() => targets.find((t) => t.id === editId) ?? null, [targets, editId]);

  const validConsentCount = useMemo(
    () => targets.filter((t) => t.consentBasis !== "NONE").length,
    [targets],
  );

  // Batch selection (≤10): consented targets first so previews are never
  // starved by refused rows, then createdAt order for stability.
  const batchIds = useMemo(() => {
    const sorted = [...targets].sort((a, b) => {
      const av = a.consentBasis !== "NONE" ? 0 : 1;
      const bv = b.consentBasis !== "NONE" ? 0 : 1;
      if (av !== bv) return av - bv;
      return a.createdAt.localeCompare(b.createdAt);
    });
    return sorted.slice(0, BATCH_CAP).map((t) => t.id);
  }, [targets]);

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["vvu-outreach"] });
    // OUTREACH_* WORM events were appended — refresh the ledger + analytics.
    void queryClient.invalidateQueries({ queryKey: ["vvu-ledger"] });
    void queryClient.invalidateQueries({ queryKey: ["vvu-analytics"] });
  };

  // ── mutations ──

  const addMutation = useMutation<AddApiResponse, HttpError, void>({
    mutationFn: async () => {
      const res = await fetch("/api/vvu/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org: formOrg,
          contactName: formContact,
          email: formEmail,
          criticalIssue: formIssue,
          consentBasis: formConsent,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as AddApiResponse;
      if (!res.ok || !data.success) {
        throw new HttpError(data.message ?? `ADD TARGET FAILED · HTTP ${res.status}`, res.status);
      }
      return data;
    },
    onSuccess: (data) => {
      toast.success("TARGET ADDED", {
        id: "outreach-add",
        description: `${data.target?.org ?? "TARGET"} · CONSENT ${data.target?.consentBasis ?? "—"} · WORM OUTREACH_TARGET_ADDED`,
      });
      setFormOrg("");
      setFormContact("");
      setFormEmail("");
      setFormIssue("");
      setFormConsent("NONE");
      // the target landed — a WORM row, not a draft (the twin's ghost law)
      if (typeof window !== "undefined") {
        clearEstateDraft(window.localStorage, CONTACT_DRAFT_KEY);
      }
      setContactEcho(false);
      invalidateAll();
    },
    onError: (err) => {
      if (err.status === 422 || err.status === 409) {
        toast.warning(err.message, { id: "outreach-add" });
      } else {
        toast.error("ADD TARGET FAILED", { id: "outreach-add", description: err.message });
      }
    },
  });

  const editMutation = useMutation<
    AddApiResponse,
    HttpError,
    { id: string; consentBasis: ConsentBasis; criticalIssue: string }
  >({
    mutationFn: async (patch) => {
      const res = await fetch("/api/vvu/outreach", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json().catch(() => ({}))) as AddApiResponse;
      if (!res.ok || !data.success) {
        throw new HttpError(
          data.message ?? `UPDATE TARGET FAILED · HTTP ${res.status}`,
          res.status,
        );
      }
      return data;
    },
    onSuccess: (data) => {
      toast.success("TARGET UPDATED", {
        description: `${data.target?.org ?? "TARGET"} · CONSENT ${data.target?.consentBasis ?? "—"} · WORM OUTREACH_TARGET_UPDATED`,
      });
      setEditId(null);
      invalidateAll();
    },
    onError: (err) => {
      toast.error("UPDATE TARGET FAILED", { description: err.message });
    },
  });

  const importMutation = useMutation<ImportApiResponse, HttpError, void>({
    mutationFn: async () => {
      const res = await fetch("/api/vvu/outreach/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText }),
      });
      const data = (await res.json().catch(() => ({}))) as ImportApiResponse;
      if (!res.ok || data.error) {
        throw new HttpError(
          data.message ?? data.error ?? `CSV IMPORT FAILED · HTTP ${res.status}`,
          res.status,
        );
      }
      return data;
    },
    onSuccess: (data) => {
      toast.success(`CSV IMPORTED — ADDED ${data.added ?? 0} · SKIPPED ${data.skipped ?? 0}`, {
        id: "outreach-import",
        description:
          "unknown consentBasis values degrade to NONE (POPIA-safe) · WORM OUTREACH_IMPORT",
      });
      setCsvText("");
      // the rows landed — WORM entries, not a draft (the twin's ghost law)
      if (typeof window !== "undefined") {
        clearEstateDraft(window.localStorage, CSV_DRAFT_KEY);
      }
      setCsvEcho(false);
      invalidateAll();
    },
    onError: (err) => {
      toast.error("CSV IMPORT FAILED", { id: "outreach-import", description: err.message });
    },
  });

  const dryRunMutation = useMutation<OutreachSendResponse, HttpError, boolean>({
    mutationFn: async (dryRun) => {
      const res = await fetch("/api/vvu/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetIds: batchIds, dryRun }),
      });
      const data = (await res.json().catch(() => ({}))) as OutreachSendResponse & {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        throw new HttpError(
          data.error ?? data.message ?? `OUTREACH SEND HTTP ${res.status}`,
          res.status,
        );
      }
      return data;
    },
    onSuccess: (data) => {
      if (data.dryRun) {
        toast.success(
          `DRY-RUN COMPLETE — ${data.previews.length} PREVIEW${data.previews.length === 1 ? "" : "S"} · ${data.blocked} BLOCKED`,
          {
            id: "outreach-dryrun",
            description: "no messages sent — templates rendered + stored as DRY_RUN rows",
          },
        );
        if (data.previews.length > 0) {
          setPreviews(data.previews);
          setPreviewIdx(0);
        }
      } else {
        toast.success(
          `SEND COMPLETE — ${data.sent} SENT · ${data.failed} FAILED · ${data.blocked} BLOCKED`,
          {
            description: "WORM OUTREACH_EMAIL events appended per attempt",
          },
        );
      }
      invalidateAll();
    },
    onError: (err) => {
      if (err.status === 501) {
        toast.warning("REAL SENDS REFUSED — DRY-RUN ONLY", { description: err.message });
      } else {
        toast.error("OUTREACH SEND FAILED", { description: err.message });
      }
    },
  });

  // ── derived UI bits ──

  const engineChip = resendConfigured ? (
    <span title="RESEND_API_KEY detected in env — real sends enabled (Resend REST)">
      <Chip tone="lime">
        <span className="vvu-pulse w-1.5 h-1.5 rounded-full bg-[#c8ff00]" aria-hidden />
        ENGINE ARMED
      </Chip>
    </span>
  ) : (
    <span title="No RESEND_API_KEY in env — the engine REFUSES real sends (501) and only DRY-RUN previews are available. Set RESEND_API_KEY to arm.">
      <Chip tone="ochre" dashed>
        DRY-RUN ONLY · SET RESEND_API_KEY
      </Chip>
    </span>
  );

  const addFormValid =
    formOrg.trim().length > 0 && formContact.trim().length > 0 && EMAIL_RE.test(formEmail.trim());

  const sendDisabledReason = !resendConfigured
    ? "SEND DISABLED — RESEND_API_KEY NOT SET · ENGINE REFUSES REAL SENDS (501) · DRY-RUN ONLY"
    : validConsentCount === 0
      ? "SEND DISABLED — NO TARGETS WITH OPT_IN / EXISTING_CUSTOMER CONSENT (POPIA s69)"
      : null;

  const orgById = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of targets) map.set(t.id, t.org);
    return map;
  }, [targets]);

  return (
    <section className="vvu-panel vvu-enter p-4 sm:p-5" aria-label="pilot outreach engine">
      <SectionHeader
        num={num}
        title="PILOT OUTREACH · R5,000 PROGRAMME"
        kicker="REAL ENGINE · RESEND REST · POPIA s69 GATED"
        right={
          <>
            <Chip tone="teal">REAL OUTREACH · NOT SIM</Chip>
            {engineChip}
            <Chip tone="dim">{fmtNum(targets.length)} TARGETS</Chip>
            <button
              type="button"
              onClick={() => setView("outreach")}
              aria-label="Open the full outreach sequence engine workspace"
              title="Cadences · pipeline kanban · AI personalisation · dry-run sends"
              className="vvu6c-btn vvu-label text-[9px] font-bold min-h-[36px] [@media(pointer:coarse)]:min-h-[44px] px-2.5 rounded border border-[#c8ff00]/50 text-[#c8ff00] hover:bg-[#c8ff00]/10 inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
            >
              <Send className="size-3" aria-hidden />
              OPEN SEND ENGINE ▸
            </button>
          </>
        }
      />

      {/* POPIA gate notice — one-line crimson-bordered chip */}
      <div
        className="mb-3 px-3 py-2 rounded border border-[#e5484d]/40 bg-[#e5484d]/5 flex items-center gap-2"
        role="note"
        aria-label="POPIA consent gate notice"
      >
        <ShieldAlert className="size-3.5 text-[#e5484d] shrink-0" aria-hidden />
        <span className="vvu-label text-[9px] text-[#e5484d] leading-relaxed">
          SENDS REFUSED WITHOUT OPT_IN / EXISTING_CUSTOMER CONSENT — POPIA s69 (DIRECT ELECTRONIC
          MARKING)
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ── left column: targets table + email history ── */}
        <div className="lg:col-span-8 min-w-0 space-y-4">
          <div
            className="max-h-96 overflow-y-auto overflow-x-auto -mx-1 px-1 rounded"
            aria-label="outreach targets"
          >
            {query.isPending ? (
              <div className="space-y-2 p-1" aria-hidden>
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-8 w-full bg-[#141a11]" />
                ))}
              </div>
            ) : query.isError ? (
              <QueryErrorCard label="OUTREACH FEED" onRetry={() => void query.refetch()} />
            ) : targets.length === 0 ? (
              <div className="vvu-label text-[10px] text-[#7a8a6e] p-4 text-center border border-dashed border-[rgba(107,138,64,0.3)] rounded">
                NO TARGETS — ADD ONE OR IMPORT CSV
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[520px]">
                <caption className="sr-only">
                  Pilot outreach targets — select a row to edit consent basis and critical issue
                </caption>
                <thead className="sticky top-0 z-10 bg-[#0b0f0a]">
                  <tr className="vvu-label text-[8px] text-[#7a8a6e]">
                    <th scope="col" className="px-2 py-2 border-b border-[rgba(107,138,64,0.25)]">
                      ORG
                    </th>
                    <th
                      scope="col"
                      className="px-2 py-2 border-b border-[rgba(107,138,64,0.25)] hidden md:table-cell"
                    >
                      CONTACT
                    </th>
                    <th scope="col" className="px-2 py-2 border-b border-[rgba(107,138,64,0.25)]">
                      EMAIL
                    </th>
                    <th
                      scope="col"
                      className="px-2 py-2 border-b border-[rgba(107,138,64,0.25)] hidden lg:table-cell"
                    >
                      CRITICAL ISSUE
                    </th>
                    <th scope="col" className="px-2 py-2 border-b border-[rgba(107,138,64,0.25)]">
                      CONSENT
                    </th>
                    <th
                      scope="col"
                      className="px-2 py-2 border-b border-[rgba(107,138,64,0.25)] hidden sm:table-cell"
                    >
                      STATUS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {targets.map((t, i) => (
                    <tr
                      key={t.id}
                      tabIndex={0}
                      role="button"
                      aria-label={`edit outreach target ${t.org} — consent ${t.consentBasis}`}
                      onClick={() => setEditId(t.id)}
                      onKeyDown={(e) => {
                        // Enter / Space open the editor (role=button contract).
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setEditId(t.id);
                        }
                      }}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-[rgba(107,138,64,0.09)] focus-visible:bg-[rgba(107,138,64,0.14)] focus-visible:outline-none",
                        i % 2 === 1 && "bg-[rgba(107,138,64,0.05)]",
                      )}
                    >
                      <td
                        className="px-2 py-2 border-b border-[rgba(107,138,64,0.12)] text-[10px] text-[#c9d4bd] font-medium max-w-[160px] truncate"
                        title={t.org}
                      >
                        {t.org}
                      </td>
                      <td
                        className="px-2 py-2 border-b border-[rgba(107,138,64,0.12)] hidden md:table-cell text-[10px] text-[#7a8a6e] max-w-[140px] truncate"
                        title={t.contactName}
                      >
                        {t.contactName}
                      </td>
                      <td
                        className="px-2 py-2 border-b border-[rgba(107,138,64,0.12)] text-[10px] text-[#8fb35a] font-mono max-w-[180px] truncate"
                        title={t.email}
                      >
                        {t.email}
                      </td>
                      <td
                        className="px-2 py-2 border-b border-[rgba(107,138,64,0.12)] hidden lg:table-cell text-[10px] text-[#7a8a6e] max-w-[200px] truncate"
                        title={t.criticalIssue ?? undefined}
                      >
                        {t.criticalIssue ?? "—"}
                      </td>
                      <td className="px-2 py-2 border-b border-[rgba(107,138,64,0.12)]">
                        <Chip tone={CONSENT_TONE[t.consentBasis]}>{t.consentBasis}</Chip>
                      </td>
                      <td className="px-2 py-2 border-b border-[rgba(107,138,64,0.12)] hidden sm:table-cell">
                        <Chip tone={STATUS_TONE[t.status] ?? "dim"}>{t.status}</Chip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* email history log */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="vvu-label text-[9px] text-[#7a8a6e] flex items-center gap-1.5">
                <Mail className="size-3.5 shrink-0" aria-hidden />
                EMAIL HISTORY · LATEST 50
              </span>
              <Chip tone="dim">{emails.length} ROWS</Chip>
            </div>
            <div
              role="log"
              aria-live="off"
              aria-label="outreach email history"
              className="max-h-44 overflow-y-auto -mx-1 px-1"
            >
              {emails.length === 0 ? (
                <div className="vvu-label text-[9px] text-[#7a8a6e] p-3 text-center border border-dashed border-[rgba(107,138,64,0.3)] rounded">
                  NO OUTREACH EMAILS YET — DRY-RUN OR SEND TO POPULATE
                </div>
              ) : (
                emails.map((e: OutreachEmail) => (
                  <div
                    key={e.id}
                    className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5 border-b border-[rgba(107,138,64,0.12)] last:border-b-0"
                  >
                    <span
                      className="text-[10px] text-[#c9d4bd] font-medium max-w-[150px] truncate"
                      title={orgById.get(e.targetId) ?? e.targetId}
                    >
                      {orgById.get(e.targetId) ?? `${e.targetId.slice(0, 8)}…`}
                    </span>
                    <Chip tone={EMAIL_STATUS_TONE[e.status] ?? "dim"}>{e.status}</Chip>
                    {e.error && (
                      <span
                        className="text-[9px] text-[#e5484d]/80 max-w-[220px] truncate"
                        title={e.error}
                      >
                        {e.error}
                      </span>
                    )}
                    {e.wormSeq !== null && (
                      <span className="vvu-label text-[8px] text-[#7a8a6e] tabular-nums">
                        WORM #{e.wormSeq}
                      </span>
                    )}
                    <span className="vvu-label text-[8px] text-[#7a8a6e] tabular-nums ml-auto whitespace-nowrap">
                      {fmtStamp(e.sentAt ?? e.createdAt)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── right column: add form / import / actions ── */}
        <div className="lg:col-span-4 min-w-0 space-y-4">
          {/* add-target form */}
          <div className="vvu-panel-solid p-3.5">
            <div className="vvu-label text-[9px] text-[#7a8a6e] mb-3 flex items-center gap-1.5">
              <Plus className="size-3.5 shrink-0" aria-hidden />
              ADD TARGET
            </div>
            {contactEcho && (
              <div
                role="status"
                aria-live="polite"
                className="vvu-label text-[8px] font-bold text-[#c8ff00] border border-[#c8ff00]/40 shadow-[0_0_12px_rgba(200,255,0,0.15)] transition-shadow rounded px-2.5 py-2 leading-relaxed mb-2.5"
              >
                DRAFT KEPT · {contactWords} WORD{contactWords === 1 ? "" : "S"} RESTORED — THE STORM
                NEVER TAKES A WORD TWICE
              </div>
            )}
            <div className="space-y-2.5">
              <input
                type="text"
                value={formOrg}
                onChange={(e) => {
                  setFormOrg(e.target.value);
                  persistContact({ org: e.target.value });
                }}
                maxLength={120}
                placeholder="ORGANISATION"
                aria-label="target organisation"
                className={INPUT_CLASS}
              />
              <input
                type="text"
                value={formContact}
                onChange={(e) => {
                  setFormContact(e.target.value);
                  persistContact({ contact: e.target.value });
                }}
                maxLength={120}
                placeholder="CONTACT NAME"
                aria-label="target contact name"
                className={INPUT_CLASS}
              />
              <input
                type="email"
                value={formEmail}
                onChange={(e) => {
                  setFormEmail(e.target.value);
                  persistContact({ email: e.target.value });
                }}
                maxLength={254}
                placeholder="EMAIL"
                aria-label="target email address"
                className={INPUT_CLASS}
              />
              <input
                type="text"
                value={formIssue}
                onChange={(e) => {
                  setFormIssue(e.target.value);
                  persistContact({ issue: e.target.value });
                }}
                maxLength={300}
                placeholder="CRITICAL ISSUE (OPTIONAL)"
                aria-label="target critical issue"
                className={INPUT_CLASS}
              />
              <div>
                <div className="vvu-label text-[9px] text-[#7a8a6e] mb-1.5">CONSENT BASIS</div>
                <ConsentSelect
                  value={formConsent}
                  onChange={setFormConsent}
                  ariaLabel="new target consent basis"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => addMutation.mutate()}
                disabled={!addFormValid || addMutation.isPending}
                className="vvu6c-btn w-full min-h-[44px] vvu-label text-[10px] font-bold border-[#8fb35a]/50 text-[#8fb35a] hover:bg-[#8fb35a]/10 hover:text-[#c9d4bd] hover:border-[#8fb35a]"
                aria-label="add outreach target"
              >
                {addMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Plus className="size-3.5" aria-hidden />
                )}
                ADD TARGET
              </Button>
              {!addFormValid && (
                <p className="vvu-label text-[8px] text-[#7a8a6e] leading-relaxed">
                  REQUIRES ORG · CONTACT · VALID EMAIL — CONSENT DEFAULTS TO NONE (POPIA-SAFE)
                </p>
              )}
            </div>
          </div>

          {/* CSV import block */}
          <div className="vvu-panel-solid p-3.5">
            <div className="vvu-label text-[9px] text-[#7a8a6e] mb-2 flex items-center gap-1.5">
              <Upload className="size-3.5 shrink-0" aria-hidden />
              IMPORT CSV
            </div>
            {csvEcho && (
              <div
                role="status"
                aria-live="polite"
                className="vvu-label text-[8px] font-bold text-[#c8ff00] border border-[#c8ff00]/40 shadow-[0_0_12px_rgba(200,255,0,0.15)] transition-shadow rounded px-2.5 py-2 leading-relaxed mb-2"
              >
                DRAFT KEPT · {csvWords} WORD{csvWords === 1 ? "" : "S"} RESTORED — THE STORM NEVER
                TAKES A WORD TWICE
              </div>
            )}
            <textarea
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value);
                persistCsv(e.target.value);
              }}
              rows={4}
              spellCheck={false}
              placeholder={
                "org,contactName,email,criticalIssue,consentBasis\nAcme Water,Thabo N,ops@acme.co.za,leak losses 30%,OPT_IN"
              }
              aria-label="CSV import text — columns org, contactName, email, criticalIssue, consentBasis"
              className={CSV_TEXTAREA_CLASS}
            />
            <p className="vvu-label text-[8px] text-[#7a8a6e] mt-2 mb-2.5 leading-relaxed">
              HEADER ROW OPTIONAL · QUOTED FIELDS OK · UNKNOWN CONSENT → NONE · DUPES SKIPPED
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => importMutation.mutate()}
              disabled={csvText.trim().length === 0 || importMutation.isPending}
              className="vvu6c-btn w-full min-h-[44px] vvu-label text-[10px] font-bold border-[#8fb35a]/50 text-[#8fb35a] hover:bg-[#8fb35a]/10 hover:text-[#c9d4bd] hover:border-[#8fb35a]"
              aria-label="import CSV targets"
            >
              {importMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Upload className="size-3.5" aria-hidden />
              )}
              IMPORT CSV
            </Button>
          </div>

          {/* actions */}
          <div className="vvu-panel-solid p-3.5">
            <div className="vvu-label text-[9px] text-[#7a8a6e] mb-3 flex items-center gap-1.5">
              <Send className="size-3.5 shrink-0" aria-hidden />
              ENGINE ACTIONS
            </div>
            <div className="space-y-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => dryRunMutation.mutate(true)}
                disabled={validConsentCount === 0 || dryRunMutation.isPending}
                className="vvu6c-btn w-full min-h-[44px] vvu-label text-[10px] font-bold border-[#f3e38a]/50 text-[#f3e38a] hover:bg-[#f3e38a]/10 hover:text-[#f3e38a] hover:border-[#f3e38a]"
                aria-label="dry-run preview of pilot emails"
              >
                {dryRunMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Eye className="size-3.5" aria-hidden />
                )}
                DRY-RUN PREVIEW
              </Button>
              {validConsentCount === 0 && (
                <p className="vvu-label text-[8px] text-[#7a8a6e] leading-relaxed">
                  DRY-RUN NEEDS ≥1 TARGET WITH OPT_IN / EXISTING_CUSTOMER CONSENT
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => dryRunMutation.mutate(false)}
                disabled={sendDisabledReason !== null || dryRunMutation.isPending}
                className="vvu6c-btn w-full min-h-[44px] vvu-label text-[10px] font-bold border-[#c8ff00]/50 text-[#c8ff00] hover:bg-[#c8ff00]/10 hover:text-[#c8ff00] hover:border-[#c8ff00]"
                aria-label="send pilot emails for real"
              >
                {dryRunMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Send className="size-3.5" aria-hidden />
                )}
                SEND PILOT EMAILS
              </Button>
              {sendDisabledReason !== null && (
                <p className="vvu-label text-[8px] text-[#e0a030] leading-relaxed">
                  {sendDisabledReason}
                </p>
              )}
              <p className="vvu-label text-[8px] text-[#7a8a6e] leading-relaxed">
                ≤{BATCH_CAP} PER BATCH · CONSENT GATE + SENDS ENFORCED SERVER-SIDE · RESEND REST VIA
                FETCH
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* row-click edit dialog */}
      {editing && (
        <EditTargetDialog
          key={editing.id}
          target={editing}
          saving={editMutation.isPending}
          onClose={() => setEditId(null)}
          onSave={(patch) =>
            editMutation.mutate({
              id: editing.id,
              consentBasis: patch.consentBasis,
              criticalIssue: patch.criticalIssue,
            })
          }
        />
      )}

      {/* dry-run preview dialog */}
      {previews && previews.length > 0 && (
        <PreviewDialog
          previews={previews}
          idx={previewIdx}
          onIdx={setPreviewIdx}
          onClose={() => setPreviews(null)}
        />
      )}
    </section>
  );
}

export default OutreachPanel;
