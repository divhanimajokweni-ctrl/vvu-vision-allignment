"use client";

import { useCallback, useEffect, useState } from "react";
import {
  History,
  GitCommit,
  ArrowRight,
  RotateCcw,
  FileCode2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Fingerprint,
  User,
  ChevronDown,
  ChevronRight,
  GitCompare,
  Plus,
  Camera,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";
import type { PolicyRow } from "@/lib/types";

interface Revision {
  id: string;
  version: number;
  wasmFingerprint: string | null;
  invariantCount: number;
  changeSummary: string | null;
  author: string | null;
  createdAt: string;
}

interface RevisionsData {
  revisions: Revision[];
  policy: {
    name: string;
    source: string;
    wasmFingerprint: string | null;
    invariantCount: number;
    updatedAt: string;
  } | null;
}

export function PolicyVersioningSection() {
  const { toast } = useToast();
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [policyId, setPolicyId] = useState<string>("");
  const [data, setData] = useState<RevisionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRev, setExpandedRev] = useState<string | null>(null);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [snapshotSummary, setSnapshotSummary] = useState("");
  const [restoring, setRestoring] = useState<string | null>(null);
  const [diffRevisions, setDiffRevisions] = useState<{ a: Revision; b: Revision } | null>(null);

  useEffect(() => {
    fetch("/api/policies")
      .then((r) => r.json())
      .then((d) => {
        setPolicies(d.policies ?? []);
        if (d.policies?.[0]) setPolicyId(d.policies[0].id);
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!policyId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/policies/revisions?policyId=${policyId}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d: RevisionsData = await r.json();
      setData(d);
      setExpandedRev(d.revisions[0]?.id ?? null);
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, [policyId]);

  useEffect(() => {
    load();
  }, [load]);

  const snapshot = async () => {
    try {
      const r = await fetch("/api/policies/revisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyId, changeSummary: snapshotSummary || undefined }),
      });
      const d = await r.json();
      if (!r.ok) {
        toast({ title: "Snapshot failed", description: d.error, variant: "destructive" });
      } else {
        toast({
          title: "Revision snapshot saved",
          description: `v${d.revision.version} · ${d.revision.changeSummary}`,
        });
        setSnapshotOpen(false);
        setSnapshotSummary("");
        load();
      }
    } catch (e) {
      toast({ title: "Snapshot failed", description: String(e), variant: "destructive" });
    }
  };

  const restore = async (rev: Revision) => {
    setRestoring(rev.id);
    try {
      const r = await fetch("/api/policies/revisions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revisionId: rev.id }),
      });
      const d = await r.json();
      if (!r.ok) {
        toast({ title: "Restore failed", description: d.error, variant: "destructive" });
      } else {
        toast({
          title: "Policy restored",
          description: `Reverted to v${rev.version} · ${rev.changeSummary ?? ""}`,
        });
        load();
      }
    } catch (e) {
      toast({ title: "Restore failed", description: String(e), variant: "destructive" });
    } finally {
      setRestoring(null);
    }
  };

  return (
    <section className="space-y-4">
      {/* Header */}
      <Card className="bg-card/60 backdrop-blur border-border/60 p-4 relative overflow-hidden">
        <div className="bg-grid absolute inset-0 opacity-20" />
        <div className="relative flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-verified/30 bg-verified/10 shrink-0">
            <History className="h-5 w-5 text-verified" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold flex items-center gap-2">
              Policy Versioning
              <Badge variant="outline" className="border-verified/30 bg-verified/10 text-verified text-[9px] font-mono">
                revision history
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Track `.epd` revisions over time — snapshot the current version, restore previous revisions, diff any two.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={policyId} onValueChange={setPolicyId}>
              <SelectTrigger className="h-8 w-[200px] text-xs">
                <SelectValue placeholder="Select policy" />
              </SelectTrigger>
              <SelectContent>
                {policies.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-8 bg-verified/90 hover:bg-verified text-primary-foreground"
              onClick={() => setSnapshotOpen(true)}
              disabled={!policyId}
            >
              <Camera className="h-3.5 w-3.5 mr-1.5" /> Snapshot
            </Button>
          </div>
        </div>
      </Card>

      {/* Current version summary */}
      {data?.policy && (
        <Card className="bg-card/60 backdrop-blur border-border/60 p-4 relative overflow-hidden">
          <div className="bg-grid-fine absolute inset-0 opacity-20" />
          <div className="relative flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <GitCommit className="h-4 w-4 text-verified" />
              <span className="text-sm font-semibold">Current (HEAD)</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">invariants:</span>
              <span className="font-mono text-verified">{data.policy.invariantCount}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">fingerprint:</span>
              <span className="font-mono text-foreground">{data.policy.wasmFingerprint ?? "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">updated {timeAgo(data.policy.updatedAt)}</span>
            </div>
            <Badge variant="outline" className="ml-auto text-[9px] border-verified/30 bg-verified/10 text-verified">
              {data.revisions.length} revision{data.revisions.length === 1 ? "" : "s"}
            </Badge>
          </div>
        </Card>
      )}

      {/* Revision timeline */}
      {loading || !data ? (
        <Skeleton className="h-64 w-full" />
      ) : data.revisions.length === 0 ? (
        <Card className="bg-card/60 border-dashed border-border/60 p-8 text-center">
          <History className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">No revisions yet.</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Click <span className="font-mono text-verified">Snapshot</span> to capture the current version.
          </p>
        </Card>
      ) : (
        <Card className="bg-card/60 backdrop-blur border-border/60 p-4 relative overflow-hidden">
          <div className="bg-grid-fine absolute inset-0 opacity-20" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <History className="h-4 w-4 text-repairing" />
              <span className="text-sm font-semibold">Revision history</span>
              <span className="ml-auto text-[10px] text-muted-foreground font-mono">newest first</span>
            </div>
            <div className="relative space-y-2">
              {/* timeline line */}
              <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border/60" />
              {data.revisions.map((rev, i) => {
                const isLatest = i === 0;
                const expanded = expandedRev === rev.id;
                const prevRev = data.revisions[i + 1];
                return (
                  <div key={rev.id} className="relative pl-9">
                    {/* node */}
                    <div
                      className={cn(
                        "absolute left-[8px] top-2 h-3.5 w-3.5 rounded-full border-2 z-10",
                        isLatest
                          ? "border-verified bg-verified"
                          : "border-muted-foreground bg-background",
                      )}
                    />
                    <div
                      className={cn(
                        "rounded-md border bg-background/40 transition-colors",
                        expanded ? "border-verified/30" : "border-border/40 hover:border-border",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedRev(expanded ? null : rev.id)}
                        className="w-full text-left p-2.5"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          {expanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          )}
                          <span className="font-mono text-sm font-semibold">v{rev.version}</span>
                          {isLatest && (
                            <Badge variant="outline" className="text-[9px] border-verified/30 bg-verified/10 text-verified">
                              HEAD
                            </Badge>
                          )}
                          <span className="text-xs text-foreground truncate flex-1 min-w-0">
                            {rev.changeSummary ?? "—"}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                            {timeAgo(rev.createdAt)}
                          </span>
                        </div>
                      </button>
                      {expanded && (
                        <div className="border-t border-border/40 p-2.5 space-y-2">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <Meta label="invariants" value={String(rev.invariantCount)} mono />
                            <Meta label="fingerprint" value={rev.wasmFingerprint ?? "—"} mono />
                            <Meta label="author" value={rev.author ?? "—"} mono />
                            <Meta label="created" value={new Date(rev.createdAt).toLocaleString()} mono />
                          </div>
                          <Separator className="bg-border/40" />
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {prevRev && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[10px] border-repairing/30 bg-repairing/10 text-repairing hover:bg-repairing/20"
                                onClick={() => setDiffRevisions({ a: prevRev, b: rev })}
                              >
                                <GitCompare className="h-3 w-3 mr-1" /> diff v{prevRev.version}→v{rev.version}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[10px] border-verified/30 bg-verified/10 text-verified hover:bg-verified/20"
                              onClick={() => restore(rev)}
                              disabled={restoring === rev.id || isLatest}
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              {restoring === rev.id ? "restoring…" : isLatest ? "current" : "restore"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Snapshot dialog */}
      <Dialog open={snapshotOpen} onOpenChange={setSnapshotOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-verified" />
              Snapshot current version
            </DialogTitle>
            <DialogDescription>
              Capture the current `.epd` source as a new revision. You can restore it later if a future change causes regressions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Change summary
            </label>
            <Textarea
              value={snapshotSummary}
              onChange={(e) => setSnapshotSummary(e.target.value)}
              placeholder="e.g. Tightened freq_bounds to [49.9, 50.1]"
              className="min-h-[70px] text-xs"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button size="sm" variant="outline">Cancel</Button>
            </DialogClose>
            <Button size="sm" className="bg-verified/90 hover:bg-verified text-primary-foreground" onClick={snapshot}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Create revision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diff dialog */}
      <Dialog open={!!diffRevisions} onOpenChange={(o) => !o && setDiffRevisions(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCompare className="h-4 w-4 text-repairing" />
              Revision diff
            </DialogTitle>
            <DialogDescription>
              {diffRevisions && (
                <>
                  Comparing <span className="font-mono">v{diffRevisions.a.version}</span> →{" "}
                  <span className="font-mono">v{diffRevisions.b.version}</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {diffRevisions && (
            <div className="space-y-2 py-2 max-h-[60vh] overflow-y-auto">
              <DiffRow
                label="invariants"
                from={String(diffRevisions.a.invariantCount)}
                to={String(diffRevisions.b.invariantCount)}
              />
              <DiffRow
                label="fingerprint"
                from={diffRevisions.a.wasmFingerprint ?? "—"}
                to={diffRevisions.b.wasmFingerprint ?? "—"}
                mono
              />
              <DiffRow
                label="summary"
                from={diffRevisions.a.changeSummary ?? "—"}
                to={diffRevisions.b.changeSummary ?? "—"}
              />
              <DiffRow
                label="author"
                from={diffRevisions.a.author ?? "—"}
                to={diffRevisions.b.author ?? "—"}
              />
              <DiffRow
                label="created"
                from={new Date(diffRevisions.a.createdAt).toLocaleString()}
                to={new Date(diffRevisions.b.createdAt).toLocaleString()}
              />
              <div className="rounded-md border border-border/40 bg-background/40 p-2.5 mt-2">
                <p className="text-[10px] text-muted-foreground mb-1">
                  The `.epd` source at each revision is preserved verbatim — restore either version to
                  inspect or roll back.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button size="sm" variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded border border-border/40 bg-background/40 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("text-xs truncate mt-0.5", mono && "font-mono")}>{value}</div>
    </div>
  );
}

function DiffRow({
  label,
  from,
  to,
  mono,
}: {
  label: string;
  from: string;
  to: string;
  mono?: boolean;
}) {
  const changed = from !== to;
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs",
        changed ? "border-repairing/30 bg-repairing/5" : "border-border/40 bg-background/30",
      )}
    >
      <span className="text-muted-foreground font-mono w-20 shrink-0">{label}</span>
      {changed ? (
        <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
          <span className={cn("text-violating line-through opacity-70 truncate", mono && "font-mono")}>{from}</span>
          <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className={cn("text-verified truncate", mono && "font-mono")}>{to}</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className={cn("text-muted-foreground truncate", mono && "font-mono")}>{from}</span>
          <CheckCircle2 className="h-3 w-3 text-verified ml-auto shrink-0" />
          <span className="text-[10px] text-verified shrink-0">unchanged</span>
        </div>
      )}
    </div>
  );
}
