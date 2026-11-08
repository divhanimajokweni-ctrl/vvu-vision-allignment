"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Cpu,
  Activity,
  Zap,
  Play,
  Radio,
  Moon,
  ShieldAlert,
  FlaskConical,
  RotateCw,
  GitCompare,
  Undo2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Gauge,
  Power,
  ArrowRight,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatValue } from "@/lib/format";
import type {
  PolicyRow,
  ShadowBridgeRow,
  ShadowEventRow,
  ShadowKind,
  Severity,
} from "@/lib/types";
import { SeverityBadge } from "./primitives";

const POLL_MS = 8_000;
const DEFAULT_DELTA = `{"frequency": 49.5}`;

function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  if (diff < 0) return "just now";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtVal(v: unknown): string {
  return formatValue(v, 40);
}

interface InvariantEval {
  name: string;
  passed: boolean;
  severity: Severity;
  soft: boolean;
  actual?: string;
}

/** Event kind → icon + color treatment. */
const KIND_META: Record<
  ShadowKind,
  { icon: typeof ShieldAlert; color: string; border: string; text: string; label: string }
> = {
  takeover: {
    icon: ShieldAlert,
    color: "bg-violating/15",
    border: "border-violating/40",
    text: "text-violating",
    label: "TAKEOVER",
  },
  whatif: {
    icon: FlaskConical,
    color: "bg-repairing/15",
    border: "border-repairing/40",
    text: "text-repairing",
    label: "WHAT-IF",
  },
  replay: {
    icon: RotateCw,
    color: "bg-quarantined/15",
    border: "border-quarantined/40",
    text: "text-quarantined",
    label: "REPLAY",
  },
  divergence: {
    icon: GitCompare,
    color: "bg-violating/15",
    border: "border-violating/40",
    text: "text-violating",
    label: "DIVERGENCE",
  },
  handback: {
    icon: Undo2,
    color: "bg-verified/15",
    border: "border-verified/40",
    text: "text-verified",
    label: "HANDBACK",
  },
};

function StateKV({ state, accent }: { state: Record<string, unknown>; accent?: string }) {
  const entries = Object.entries(state ?? {});
  return (
    <div className="space-y-1">
      {entries.length === 0 && (
        <div className="text-[11px] text-muted-foreground italic">no state</div>
      )}
      {entries.map(([k, v]) => (
        <div
          key={k}
          className="flex items-center justify-between gap-2 rounded px-1.5 py-0.5 hover:bg-muted/30"
        >
          <span className="font-mono text-[11px] text-muted-foreground">{k}</span>
          <span
            className={cn(
              "font-mono text-[11px] truncate max-w-[60%] text-right",
              accent ?? "text-foreground",
            )}
            title={fmtVal(v)}
          >
            {fmtVal(v)}
          </span>
        </div>
      ))}
    </div>
  );
}

function InvariantRow({
  live,
  shadow,
}: {
  live?: InvariantEval;
  shadow?: InvariantEval;
}) {
  const name = live?.name ?? shadow?.name ?? "?";
  const divergent = !!live && !!shadow && live.passed !== shadow.passed;
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded px-1.5 py-1",
        divergent && "bg-violating/10 border border-violating/30",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="font-mono text-[11px] text-foreground truncate">{name}</span>
        <SeverityBadge severity={(live ?? shadow)!.severity} soft={(live ?? shadow)!.soft} />
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span
          className={cn(
            "flex items-center gap-0.5",
            live?.passed ? "text-verified" : "text-violating",
          )}
          title="live"
        >
          {live?.passed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
          <span className="text-[10px] uppercase">L</span>
        </span>
        <span
          className={cn(
            "flex items-center gap-0.5",
            shadow?.passed ? "text-verified" : "text-violating",
          )}
          title="shadow"
        >
          {shadow?.passed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
          <span className="text-[10px] uppercase">S</span>
        </span>
      </div>
    </div>
  );
}

function EventTimelineItem({ ev }: { ev: ShadowEventRow }) {
  const meta = KIND_META[ev.kind] ?? KIND_META.divergence;
  const Icon = meta.icon;
  return (
    <div
      className={cn(
        "relative rounded-md border p-2.5 bg-card/40",
        ev.authoritative ? cn(meta.border, "glow-violating") : "border-border/60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded border",
              meta.color,
              meta.border,
            )}
          >
            <Icon className={cn("h-3 w-3", meta.text)} />
          </span>
          <div className="flex flex-col">
            <span className={cn("text-[10px] font-semibold uppercase tracking-wide", meta.text)}>
              {meta.label}
            </span>
            <span className="text-[11px] text-foreground">{ev.summary}</span>
          </div>
        </div>
        {ev.authoritative && (
          <Badge variant="outline" className="border-violating/40 bg-violating/10 text-violating text-[9px]">
            AUTH
          </Badge>
        )}
      </div>
      <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <GitCompare className="h-2.5 w-2.5" />
          <span className="font-mono">div {ev.divergence.toFixed(3)}</span>
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-2.5 w-2.5" />
          {fmtRelative(ev.createdAt)}
        </span>
      </div>
    </div>
  );
}

/** Central divergence meter — vertical bar + armed indicator. */
function DivergenceMeter({
  divergence,
  authoritative,
}: {
  divergence: number;
  authoritative: boolean;
}) {
  // Map divergence (could be small float) to a 0-100 percentage with a log-ish curve.
  const pct = Math.min(100, Math.round(Math.sqrt(divergence) * 35));
  const armed = divergence > 0.0001 && authoritative;
  const color =
    divergence < 0.001 ? "text-verified" : divergence < 1 ? "text-repairing" : "text-violating";
  const barClass =
    divergence < 0.001
      ? "[&>div]:bg-verified"
      : divergence < 1
        ? "[&>div]:bg-repairing"
        : "[&>div]:bg-violating";
  return (
    <Card
      className={cn(
        "bg-card/60 backdrop-blur border p-3 relative overflow-hidden flex flex-col items-center justify-center gap-2",
        armed ? "border-violating/40 glow-violating" : "border-border/60",
      )}
    >
      <div className="bg-grid-fine absolute inset-0 opacity-20" />
      <div className="relative flex flex-col items-center gap-1.5 w-full">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Twin Divergence
        </div>
        <div className={cn("font-mono text-2xl font-semibold tabular-nums", color)}>
          {divergence.toFixed(3)}
        </div>
        <Progress value={pct} className={cn("h-1.5 w-full", barClass)} />
        <div
          className={cn(
            "mt-1 flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            armed
              ? "border-violating/50 bg-violating/15 text-violating animate-epistemic-pulse"
              : divergence > 0.0001
                ? "border-repairing/40 bg-repairing/10 text-repairing"
                : "border-verified/40 bg-verified/10 text-verified",
          )}
        >
          <Power className="h-3 w-3" />
          {armed ? "TAKEOVER ARMED" : divergence > 0.0001 ? "DRIFT" : "ALIGNED"}
        </div>
        <div className="text-[9px] text-muted-foreground text-center leading-tight font-mono mt-0.5">
          {divergence < 0.001
            ? "live ≡ shadow"
            : divergence < 1
              ? "invariant mismatch"
              : "authoritative breach"}
        </div>
      </div>
    </Card>
  );
}

function TwinCard({
  side,
  state,
  invariants,
  authoritative,
}: {
  side: "live" | "shadow";
  state: Record<string, unknown>;
  invariants: InvariantEval[];
  authoritative?: boolean;
}) {
  const isLive = side === "live";
  return (
    <Card
      className={cn(
        "bg-card/60 backdrop-blur border p-4 relative overflow-hidden",
        isLive ? "border-verified/30" : "border-quarantined/30",
      )}
    >
      {/* texture */}
      {!isLive && <div className="bg-grid absolute inset-0 opacity-25 pointer-events-none" />}
      <div className="relative space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isLive ? (
              <Radio className="h-4 w-4 text-verified" />
            ) : (
              <Moon className="h-4 w-4 text-quarantined" />
            )}
            <span
              className={cn(
                "text-sm font-semibold uppercase tracking-wide",
                isLive ? "text-verified" : "text-quarantined",
              )}
            >
              {isLive ? "Live Plant" : "Shadow Twin"}
            </span>
          </div>
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
              isLive
                ? "border-verified/40 bg-verified/10 text-verified"
                : "border-quarantined/40 bg-quarantined/10 text-quarantined",
            )}
          >
            <span
              className={cn(
                "inline-block h-1.5 w-1.5 rounded-full",
                isLive ? "bg-verified animate-epistemic-pulse" : "bg-quarantined",
              )}
            />
            {isLive ? "● LIVE" : "◐ SHADOW"}
          </span>
        </div>

        {authoritative && !isLive && (
          <div className="flex items-center gap-2 rounded-md border border-violating/40 bg-violating/10 px-2.5 py-1.5 text-[11px] text-violating">
            <ShieldAlert className="h-3.5 w-3.5" />
            <span className="font-semibold uppercase tracking-wide">Authoritative</span>
            <span className="opacity-80">— shadow holds control plane</span>
          </div>
        )}

        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            State snapshot
          </div>
          <div className="rounded-md border border-border/60 bg-background/40 p-2">
            <StateKV state={state} accent={isLive ? "text-foreground" : "text-quarantined/90"} />
          </div>
        </div>

        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            Invariant evaluations
          </div>
          <div className="space-y-0.5">
            {invariants.length === 0 && (
              <div className="text-[11px] text-muted-foreground italic">no invariants</div>
            )}
            {invariants.map((iv) => (
              <div
                key={iv.name}
                className="flex items-center justify-between gap-2 rounded px-1.5 py-1"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="font-mono text-[11px] text-foreground truncate">{iv.name}</span>
                  <SeverityBadge severity={iv.severity} soft={iv.soft} />
                </div>
                <span
                  className={cn(
                    "flex items-center gap-1 text-xs",
                    iv.passed ? "text-verified" : "text-violating",
                  )}
                >
                  {iv.passed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                  <span className="text-[10px] uppercase">{iv.passed ? "pass" : "fail"}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function ShadowBridgeSection() {
  const { toast } = useToast();
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [policyId, setPolicyId] = useState<string>("");
  const [bridge, setBridge] = useState<ShadowBridgeRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [takeoverOpen, setTakeoverOpen] = useState(false);
  const [takingOver, setTakingOver] = useState(false);

  // What-if composer
  const [deltaText, setDeltaText] = useState(DEFAULT_DELTA);
  const [predicate, setPredicate] = useState("");
  const [whatif, setWhatif] = useState<{
    ok: boolean;
    evaluations: InvariantEval[];
    mmrRoot: string;
    divergence: number;
  } | null>(null);
  const [runningWhatif, setRunningWhatif] = useState(false);

  // Load policies once, default to first shadow-enabled.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/policies")
      .then((r) => r.json())
      .then((d: { policies: PolicyRow[] }) => {
        if (cancelled) return;
        const ps = d.policies ?? [];
        setPolicies(ps);
        const shadowFirst = ps.find((p) => p.shadowEnabled);
        if (shadowFirst) setPolicyId(shadowFirst.id);
        else if (ps.length > 0) setPolicyId(ps[0].id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const loadBridge = useCallback(async () => {
    if (!policyId) return;
    try {
      const r = await fetch(`/api/shadow-bridge?policyId=${encodeURIComponent(policyId)}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d: { bridges: ShadowBridgeRow[] } = await r.json();
      const b = (d.bridges ?? [])[0] ?? null;
      setBridge(b);
    } catch (e) {
      toast({
        title: "Failed to load shadow bridge",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [policyId, toast]);

  useEffect(() => {
    if (!policyId) return;
    setLoading(true);
    loadBridge();
    const t = setInterval(loadBridge, POLL_MS);
    return () => clearInterval(t);
  }, [policyId, loadBridge]);

  const doTakeover = useCallback(async () => {
    if (!policyId) return;
    setTakingOver(true);
    try {
      const r = await fetch("/api/shadow-bridge/takeover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyId }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      toast({
        title: "Shadow takeover initiated",
        description: d.event?.summary ?? "Shadow bridge assumed authority.",
      });
      setTakeoverOpen(false);
      loadBridge();
    } catch (e) {
      toast({
        title: "Takeover failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setTakingOver(false);
    }
  }, [policyId, toast, loadBridge]);

  const runWhatif = useCallback(async () => {
    if (!policyId) return;
    let delta: Record<string, unknown> = {};
    if (deltaText.trim()) {
      try {
        delta = JSON.parse(deltaText);
      } catch (e) {
        toast({
          title: "Invalid state delta JSON",
          description: e instanceof Error ? e.message : "Parse error",
          variant: "destructive",
        });
        return;
      }
    }
    setRunningWhatif(true);
    try {
      const body: Record<string, unknown> = { policyId, stateDelta: delta };
      if (predicate.trim()) body.predicateOverride = predicate.trim();
      const r = await fetch("/api/shadow-bridge/whatif", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setWhatif({
        ok: !!d.ok,
        evaluations: (d.evaluations ?? []).map((e: InvariantEval) => ({
          name: e.name,
          passed: e.passed,
          severity: e.severity,
          soft: e.soft,
          actual: e.actual,
        })),
        mmrRoot: d.mmrRoot ?? "—",
        divergence: d.event?.divergence ?? 0,
      });
      toast({
        title: "What-if replay complete",
        description: `${(d.evaluations ?? []).filter((e: InvariantEval) => !e.passed).length} violation(s) under modified rules`,
      });
      loadBridge();
    } catch (e) {
      toast({
        title: "What-if replay failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setRunningWhatif(false);
    }
  }, [policyId, deltaText, predicate, toast, loadBridge]);

  // Build a union of invariant names (live ∪ shadow) preserving order.
  const invariantUnion = useMemo(() => {
    if (!bridge) return [] as { name: string; live?: InvariantEval; shadow?: InvariantEval }[];
    const map = new Map<string, { name: string; live?: InvariantEval; shadow?: InvariantEval }>();
    for (const iv of bridge.liveInvariants) {
      map.set(iv.name, { name: iv.name, live: iv });
    }
    for (const iv of bridge.shadowInvariants) {
      const ex = map.get(iv.name);
      if (ex) ex.shadow = iv;
      else map.set(iv.name, { name: iv.name, shadow: iv });
    }
    return Array.from(map.values());
  }, [bridge]);

  const events = bridge?.events ?? [];
  const selectedPolicy = policies.find((p) => p.id === policyId);
  const shadowEnabled = !!selectedPolicy?.shadowEnabled;
  const takeoverLatency = bridge?.policy.takeoverLatencyMs ?? selectedPolicy?.takeoverLatencyMs ?? null;
  const authoritative = bridge?.policy.authoritative ?? false;

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-quarantined/30 bg-quarantined/10">
            <Cpu className="h-4.5 w-4.5 text-quarantined" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Shadow Bridge</h2>
            <p className="text-xs text-muted-foreground">
              Digital-twin control plane · live vs shadow invariants · takeover-ready
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={policyId} onValueChange={setPolicyId}>
            <SelectTrigger className="w-[260px] bg-card/60">
              <SelectValue placeholder="Select policy" />
            </SelectTrigger>
            <SelectContent>
              {policies.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="flex items-center gap-2">
                    {p.name}
                    {p.shadowEnabled && (
                      <span className="text-[10px] text-quarantined">●shadow</span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Status badges row */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className={cn(
            "border-border/60",
            shadowEnabled ? "text-quarantined border-quarantined/40 bg-quarantined/10" : "text-muted-foreground",
          )}
        >
          <Moon className="h-3 w-3" />
          {shadowEnabled ? "shadow enabled" : "shadow disabled"}
        </Badge>
        <Badge
          variant="outline"
          className={cn(
            "border-border/60",
            authoritative ? "text-violating border-violating/40 bg-violating/10" : "text-muted-foreground",
          )}
        >
          <ShieldAlert className="h-3 w-3" />
          {authoritative ? "authoritative" : "non-authoritative"}
        </Badge>
        <Badge variant="outline" className="border-border/60 text-muted-foreground">
          <Gauge className="h-3 w-3" />
          takeover {takeoverLatency ?? "—"}ms
        </Badge>
        <Badge variant="outline" className="border-border/60 text-muted-foreground">
          <Activity className="h-3 w-3" />
          {events.length} event{events.length === 1 ? "" : "s"}
        </Badge>
      </div>

      {!shadowEnabled && (
        <Card className="bg-repairing/5 border-repairing/30 p-3 text-xs text-repairing flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Selected policy does not have a shadow bridge enabled. Data may be empty — pick a shadow-enabled policy for full functionality.
          </span>
        </Card>
      )}

      {/* Twin comparison + divergence meter */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_1fr]">
          <Skeleton className="h-80 w-full rounded-lg bg-muted/40" />
          <Skeleton className="h-80 w-32 rounded-lg bg-muted/40" />
          <Skeleton className="h-80 w-full rounded-lg bg-muted/40" />
        </div>
      ) : !bridge ? (
        <Card className="bg-card/60 border-border/60 p-8 text-center">
          <Moon className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm text-muted-foreground">No shadow bridge data for this policy.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_1fr] md:items-stretch">
          <TwinCard
            side="live"
            state={bridge.liveState}
            invariants={bridge.liveInvariants}
          />
          <div className="flex md:flex-col gap-3">
            <DivergenceMeter
              divergence={bridge.divergence}
              authoritative={authoritative}
            />
            {/* Invariant divergence matrix */}
            <Card className="bg-card/40 border-border/60 p-2.5 relative overflow-hidden flex-1">
              <div className="bg-grid-fine absolute inset-0 opacity-20" />
              <div className="relative">
                <div className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  L vs S matrix
                </div>
                <div className="space-y-0.5">
                  {invariantUnion.length === 0 && (
                    <div className="text-[11px] text-muted-foreground italic">no invariants</div>
                  )}
                  {invariantUnion.map((row) => (
                    <InvariantRow key={row.name} live={row.live} shadow={row.shadow} />
                  ))}
                </div>
              </div>
            </Card>
          </div>
          <TwinCard
            side="shadow"
            state={bridge.shadowState}
            invariants={bridge.shadowInvariants}
            authoritative={authoritative}
          />
        </div>
      )}

      {/* Controls */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Takeover */}
        <Card className="bg-card/60 backdrop-blur border-border/60 p-4 relative overflow-hidden">
          <div className="bg-grid-fine absolute inset-0 opacity-20" />
          <div className="relative space-y-3">
            <div className="flex items-center gap-2">
              <Power className="h-4 w-4 text-violating" />
              <span className="text-sm font-semibold text-foreground">Authority transfer</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Promote the shadow twin to authoritative control. Live plant will defer to shadow
              invariants within <span className="font-mono text-foreground">{takeoverLatency ?? "—"}ms</span>.
            </p>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <Zap className="h-3 w-3 text-repairing" />
              <span>current state: </span>
              <span className={cn("font-semibold", authoritative ? "text-violating" : "text-verified")}>
                {authoritative ? "SHADOW AUTHORITATIVE" : "LIVE AUTHORITATIVE"}
              </span>
            </div>
            <Dialog open={takeoverOpen} onOpenChange={setTakeoverOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full border-violating/40 bg-violating/10 text-violating hover:bg-violating/20"
                  disabled={!shadowEnabled}
                >
                  <ShieldAlert className="h-4 w-4" />
                  Initiate takeover
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border/60">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-foreground">
                    <ShieldAlert className="h-4 w-4 text-violating" />
                    Confirm shadow takeover
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    The shadow bridge will assume authority for{" "}
                    <span className="font-mono text-foreground">{bridge?.policy.name ?? "this policy"}</span>.
                    Live plant operations will be governed by shadow invariants. Continue?
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline" className="border-border/60">
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button
                    onClick={doTakeover}
                    disabled={takingOver}
                    className="bg-violating/15 border border-violating/40 text-violating hover:bg-violating/25"
                    variant="outline"
                  >
                    {takingOver ? (
                      <RotateCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Power className="h-4 w-4" />
                    )}
                    {takingOver ? "Transferring…" : "Assume authority"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </Card>

        {/* What-if replay composer */}
        <Card className="bg-card/60 backdrop-blur border-border/60 p-4 relative overflow-hidden lg:col-span-2">
          <div className="bg-grid-fine absolute inset-0 opacity-20" />
          <div className="relative space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-repairing" />
                <span className="text-sm font-semibold text-foreground">What-if replay</span>
              </div>
              <Badge variant="outline" className="border-repairing/30 bg-repairing/10 text-repairing text-[10px]">
                branch · replay
              </Badge>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  State delta (JSON)
                </label>
                <Textarea
                  value={deltaText}
                  onChange={(e) => setDeltaText(e.target.value)}
                  className="font-mono text-xs bg-background/60 min-h-[88px] epistemic-scroll"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Predicate override (optional)
                </label>
                <Input
                  value={predicate}
                  onChange={(e) => setPredicate(e.target.value)}
                  placeholder="e.g. frequency in [49.5, 50.5]"
                  className="font-mono text-xs bg-background/60"
                />
                <p className="text-[10px] text-muted-foreground">
                  Rewrites an invariant predicate for this replay only. Original enforcer untouched.
                </p>
                <Button
                  onClick={runWhatif}
                  disabled={runningWhatif || !shadowEnabled}
                  variant="outline"
                  className="w-full border-repairing/40 bg-repairing/10 text-repairing hover:bg-repairing/20"
                >
                  {runningWhatif ? (
                    <RotateCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {runningWhatif ? "Replaying…" : "Run what-if"}
                </Button>
              </div>
            </div>

            {whatif && (
              <div className="rounded-md border border-border/60 bg-background/40 p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Replayed evaluations
                  </span>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="font-mono">div {whatif.divergence.toFixed(3)}</span>
                    <Separator orientation="vertical" className="h-3 bg-border/60" />
                    <span className="font-mono">mmr {whatif.mmrRoot}</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {whatif.evaluations.map((ev) => (
                    <div
                      key={ev.name}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded border px-2 py-1",
                        ev.passed
                          ? "border-verified/30 bg-verified/5"
                          : "border-violating/30 bg-violating/10",
                      )}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {ev.passed ? (
                          <CheckCircle2 className="h-3 w-3 text-verified shrink-0" />
                        ) : (
                          <XCircle className="h-3 w-3 text-violating shrink-0" />
                        )}
                        <span className="font-mono text-[11px] text-foreground truncate">
                          {ev.name}
                        </span>
                      </div>
                      <SeverityBadge severity={ev.severity} soft={ev.soft} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Event timeline */}
      <Card className="bg-card/60 backdrop-blur border-border/60 p-4 relative overflow-hidden">
        <div className="bg-grid-fine absolute inset-0 opacity-15" />
        <div className="relative">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-quarantined" />
              <span className="text-sm font-semibold text-foreground">Event timeline</span>
              <Badge variant="outline" className="border-border/60 text-[10px]">
                {events.length}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              {(["takeover", "whatif", "replay", "divergence", "handback"] as ShadowKind[]).map((k) => {
                const m = KIND_META[k];
                const Icon = m.icon;
                return (
                  <span key={k} className="flex items-center gap-1">
                    <Icon className={cn("h-2.5 w-2.5", m.text)} />
                    {m.label}
                  </span>
                );
              })}
            </div>
          </div>
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Clock className="h-6 w-6 text-muted-foreground/50" />
              <p className="mt-2 text-xs text-muted-foreground">No shadow events recorded.</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto epistemic-scroll space-y-2 pr-1">
              {events.map((ev) => (
                <EventTimelineItem key={ev.id} ev={ev} />
              ))}
            </div>
          )}
        </div>
      </Card>
    </section>
  );
}
