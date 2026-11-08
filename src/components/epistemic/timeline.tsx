"use client";

import { useCallback, useEffect, useState } from "react";
import {
  GitBranch,
  Cpu,
  AlertTriangle,
  Clock,
  Filter,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Activity,
  Gauge,
  Zap,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";
import type { PolicyRow } from "@/lib/types";

type EventKind = "merge" | "shadow" | "violation";

interface TimelineEvent {
  id: string;
  kind: EventKind;
  at: string;
  policyName: string;
  domain: string | null;
  title: string;
  detail: string;
  severity: "info" | "warning" | "critical";
  mergeStatus?: string;
  divergence?: number;
  iterations?: number;
  shadowKind?: string;
  invariant?: string;
  soft?: boolean;
  repaired?: boolean;
  actual?: string | null;
  expected?: string | null;
}

interface Bucket {
  t: number;
  count: number;
  byKind: Record<string, number>;
}

interface TimelineData {
  events: TimelineEvent[];
  total: number;
  buckets: Bucket[];
  policyId: string | null;
}

const KIND_META: Record<
  EventKind,
  { icon: typeof GitBranch; color: string; text: string; bg: string; label: string }
> = {
  merge: {
    icon: GitBranch,
    color: "text-verified",
    text: "text-verified",
    bg: "bg-verified",
    label: "Merge",
  },
  shadow: {
    icon: Cpu,
    color: "text-repairing",
    text: "text-repairing",
    bg: "bg-repairing",
    label: "Shadow",
  },
  violation: {
    icon: AlertTriangle,
    color: "text-violating",
    text: "text-violating",
    bg: "bg-violating",
    label: "Violation",
  },
};

const SEVERITY_META: Record<string, string> = {
  info: "border-verified/30 bg-verified/5",
  warning: "border-repairing/30 bg-repairing/5",
  critical: "border-violating/30 bg-violating/10",
};

export function TimelineSection() {
  const { toast } = useToast();
  const [data, setData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [filterPolicy, setFilterPolicy] = useState<string>("all");
  const [filterKind, setFilterKind] = useState<string>("all");
  const [playing, setPlaying] = useState(false);
  const [cursor, setCursor] = useState<number>(0); // index into filtered events
  const [hoveredBucket, setHoveredBucket] = useState<number | null>(null);

  const load = useCallback(() => {
    const qs = filterPolicy !== "all" ? `?policyId=${filterPolicy}` : "";
    fetch(`/api/timeline${qs}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
        setCursor(0);
      })
      .catch(() => setLoading(false));
  }, [filterPolicy]);

  useEffect(() => {
    fetch("/api/policies")
      .then((r) => r.json())
      .then((d) => setPolicies(d.policies ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  // Autoplay
  useEffect(() => {
    if (!playing || !data) return;
    const t = setInterval(() => {
      setCursor((c) => {
        if (c >= filtered.length - 1) {
          setPlaying(false);
          return c;
        }
        return c + 1;
      });
    }, 1200);
    return () => clearInterval(t);
  }, [playing, data, filterKind]);

  const filtered = data ? data.events.filter((e) => filterKind === "all" || e.kind === filterKind) : [];

  const current = filtered[cursor];

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const totals = {
    merges: data.events.filter((e) => e.kind === "merge").length,
    shadows: data.events.filter((e) => e.kind === "shadow").length,
    violations: data.events.filter((e) => e.kind === "violation").length,
  };

  return (
    <section className="space-y-4">
      {/* Header + filters */}
      <Card className="bg-card/60 backdrop-blur border-border/60 p-4 relative overflow-hidden">
        <div className="bg-grid absolute inset-0 opacity-20" />
        <div className="relative flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-verified/30 bg-verified/10 shrink-0">
            <Clock className="h-5 w-5 text-verified" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold flex items-center gap-2">
              Historical Replay Timeline
              <Badge variant="outline" className="border-verified/30 bg-verified/10 text-verified text-[9px] font-mono">
                {data.total} events
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Scrub through merge proposals, shadow events, and invariant breaches. Replay any episode with modified invariants.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filterPolicy} onValueChange={setFilterPolicy}>
              <SelectTrigger className="h-8 w-[170px] text-xs">
                <Filter className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Policy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All policies</SelectItem>
                {policies.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterKind} onValueChange={setFilterKind}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue placeholder="Kind" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All kinds</SelectItem>
                <SelectItem value="merge">Merges</SelectItem>
                <SelectItem value="shadow">Shadow</SelectItem>
                <SelectItem value="violation">Violations</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Summary + histogram */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="grid grid-cols-3 gap-3 lg:col-span-1">
          <SummaryStat icon={GitBranch} label="Merges" value={totals.merges} accent="verified" />
          <SummaryStat icon={Cpu} label="Shadow" value={totals.shadows} accent="repairing" />
          <SummaryStat icon={AlertTriangle} label="Violations" value={totals.violations} accent="violating" />
        </div>

        <Card className="lg:col-span-2 bg-card/60 backdrop-blur border-border/60 p-4 relative overflow-hidden">
          <div className="bg-grid-fine absolute inset-0 opacity-20" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-3.5 w-3.5 text-verified" />
              <span className="text-xs font-semibold">Event density · last 24h</span>
              <span className="ml-auto text-[10px] text-muted-foreground font-mono">
                {hoveredBucket !== null && data.buckets[hoveredBucket]
                  ? new Date(data.buckets[hoveredBucket].t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
                    ` · ${data.buckets[hoveredBucket].count} events`
                  : "hover a bucket"}
              </span>
            </div>
            <Histogram
              buckets={data.buckets}
              onHover={setHoveredBucket}
              onSelect={(idx) => {
                // Jump cursor to first event in/after that bucket
                const bucketTime = data.buckets[idx].t;
                const idx2 = data.events.findIndex(
                  (e) => new Date(e.at).getTime() >= bucketTime,
                );
                if (idx2 >= 0) setCursor(idx2);
              }}
            />
          </div>
        </Card>
      </div>

      {/* Player + scrubber */}
      <Card className="bg-card/60 backdrop-blur border-border/60 p-4 relative overflow-hidden">
        <div className="bg-grid-fine absolute inset-0 opacity-20" />
        <div className="relative space-y-3">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-verified" />
            <span className="text-sm font-semibold">Episode player</span>
            <span className="ml-auto text-[10px] text-muted-foreground font-mono">
              {filtered.length > 0 ? `${cursor + 1} / ${filtered.length}` : "no events"}
            </span>
          </div>

          {/* Scrubber */}
          <div className="relative h-10 rounded-md border border-border/60 bg-background/40 overflow-hidden">
            <div className="absolute inset-0 flex">
              {filtered.map((e, i) => {
                const m = KIND_META[e.kind];
                return (
                  <button
                    key={e.id}
                    onClick={() => setCursor(i)}
                    className={cn(
                      "flex-1 min-w-[3px] group relative transition-all",
                      i === cursor ? "bg-opacity-100" : "opacity-50 hover:opacity-100",
                    )}
                    title={`${e.title} · ${timeAgo(e.at)}`}
                  >
                    <div className={cn("h-full w-full", m.bg, i === cursor && "opacity-100")} />
                    {i === cursor && (
                      <div className="absolute -top-0.5 left-0 right-0 h-0.5 bg-foreground" />
                    )}
                  </button>
                );
              })}
            </div>
            {filtered.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground italic">
                no events match the filter
              </div>
            )}
          </div>

          {/* Scrubber legend */}
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2 w-3 rounded-sm bg-verified" /> merge
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-3 rounded-sm bg-repairing" /> shadow
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-3 rounded-sm bg-violating" /> violation
            </span>
            <span className="ml-auto italic">click a segment to jump</span>
          </div>

          {/* Transport controls */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => setCursor((c) => Math.max(0, c - 1))}
              disabled={cursor === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              className="h-8 px-4 bg-verified/90 hover:bg-verified text-primary-foreground"
              onClick={() => {
                if (cursor >= filtered.length - 1) {
                  setCursor(0);
                  setPlaying(true);
                } else {
                  setPlaying((p) => !p);
                }
              }}
              disabled={filtered.length === 0}
            >
              {playing ? (
                <>
                  <Pause className="h-3.5 w-3.5 mr-1.5" /> Pause
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 mr-1.5" /> {cursor >= filtered.length - 1 ? "Replay" : "Play"}
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => setCursor((c) => Math.min(filtered.length - 1, c + 1))}
              disabled={cursor >= filtered.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="ml-2 text-[11px] text-muted-foreground font-mono">
              {current ? timeAgo(current.at) : "—"}
            </span>
            <div className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Zap className="h-3 w-3 text-repairing" />
              auto-advance 1.2s
            </div>
          </div>

          {/* Current episode detail */}
          {current ? (
            <EventDetail event={current} onReplay={() => {
              toast({
                title: "Episode queued for replay",
                description: `${current.title} · ${current.policyName}`,
              });
            }} />
          ) : (
            <div className="rounded-md border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
              No episode selected.
            </div>
          )}
        </div>
      </Card>

      {/* Event list */}
      <Card className="bg-card/60 backdrop-blur border-border/60 p-4 relative overflow-hidden">
        <div className="bg-grid-fine absolute inset-0 opacity-20" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-repairing" />
            <span className="text-sm font-semibold">Event stream</span>
            <span className="ml-auto text-[10px] text-muted-foreground font-mono">
              newest first · {filtered.length} shown
            </span>
          </div>
          <div className="max-h-[320px] overflow-y-auto space-y-1 pr-1">
            {filtered.map((e, i) => {
              const m = KIND_META[e.kind];
              const Icon = m.icon;
              return (
                <button
                  key={e.id}
                  onClick={() => setCursor(i)}
                  className={cn(
                    "w-full text-left flex items-start gap-2.5 rounded-md border px-2.5 py-1.5 transition-colors",
                    i === cursor
                      ? "border-verified/40 bg-verified/5"
                      : "border-border/40 bg-background/30 hover:bg-background/50",
                  )}
                >
                  <div className={cn("mt-0.5 h-6 w-6 shrink-0 rounded flex items-center justify-center", m.color, "bg-current/10")}>
                    <Icon className={cn("h-3.5 w-3.5", m.text)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium truncate">{e.title}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground font-mono shrink-0">
                        {timeAgo(e.at)}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate font-mono">
                      {e.policyName} · {e.detail}
                    </p>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground italic py-6 text-center">No events match the filter.</p>
            )}
          </div>
        </div>
      </Card>
    </section>
  );
}

function Histogram({
  buckets,
  onHover,
  onSelect,
}: {
  buckets: Bucket[];
  onHover: (idx: number | null) => void;
  onSelect: (idx: number) => void;
}) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <div className="flex items-end gap-[2px] h-16">
      {buckets.map((b, i) => {
        const h = (b.count / max) * 100;
        const hasM = b.byKind.merge > 0;
        const hasS = b.byKind.shadow > 0;
        const hasV = b.byKind.violation > 0;
        return (
          <button
            key={i}
            onMouseEnter={() => onHover(i)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onSelect(i)}
            className="flex-1 group relative flex flex-col justify-end h-full"
            title={`${new Date(b.t).toLocaleTimeString([], { hour: "2-digit" })} · ${b.count} events`}
          >
            <div className="w-full overflow-hidden rounded-sm flex flex-col justify-end" style={{ height: `${Math.max(4, h)}%` }}>
              {hasV && <div className="w-full bg-violating/80" style={{ flex: b.byKind.violation }} />}
              {hasS && <div className="w-full bg-repairing/80" style={{ flex: b.byKind.shadow }} />}
              {hasM && <div className="w-full bg-verified/80" style={{ flex: b.byKind.merge }} />}
            </div>
            {b.count === 0 && <div className="w-full h-[3px] bg-muted/30 rounded-sm" />}
          </button>
        );
      })}
    </div>
  );
}

function EventDetail({ event, onReplay }: { event: TimelineEvent; onReplay: () => void }) {
  const m = KIND_META[event.kind];
  const Icon = m.icon;
  return (
    <div className={cn("rounded-md border p-3", SEVERITY_META[event.severity])}>
      <div className="flex items-start gap-3">
        <div className={cn("h-9 w-9 rounded-md flex items-center justify-center shrink-0", m.color, "bg-current/10")}>
          <Icon className={cn("h-4.5 w-4.5", m.text)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{event.title}</span>
            <Badge variant="outline" className={cn("text-[9px]", m.text, "border-current/30 bg-current/10")}>
              {m.label}
            </Badge>
            {event.severity === "critical" && (
              <Badge variant="outline" className="text-[9px] border-violating/40 bg-violating/10 text-violating">
                critical
              </Badge>
            )}
            <span className="ml-auto text-[10px] text-muted-foreground font-mono">
              {new Date(event.at).toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 font-mono">{event.detail}</p>
          <div className="mt-2 flex items-center gap-3 flex-wrap text-[11px]">
            <span className="flex items-center gap-1">
              <span className="text-muted-foreground">policy:</span>
              <span className="font-mono">{event.policyName}</span>
            </span>
            {event.domain && (
              <span className="flex items-center gap-1">
                <span className="text-muted-foreground">domain:</span>
                <span className="font-mono">{event.domain}</span>
              </span>
            )}
            {event.divergence !== undefined && (
              <span className="flex items-center gap-1">
                <span className="text-muted-foreground">divergence:</span>
                <span className="font-mono text-repairing">{event.divergence.toFixed(3)}</span>
              </span>
            )}
            {event.iterations !== undefined && (
              <span className="flex items-center gap-1">
                <span className="text-muted-foreground">iters:</span>
                <span className="font-mono">{event.iterations}</span>
              </span>
            )}
            {event.soft !== undefined && event.soft && (
              <Badge variant="outline" className="text-[9px] border-quarantined/30 bg-quarantined/10 text-quarantined">
                soft
              </Badge>
            )}
            {event.repaired && (
              <Badge variant="outline" className="text-[9px] border-verified/30 bg-verified/10 text-verified">
                repaired
              </Badge>
            )}
          </div>
        </div>
        <Button size="sm" variant="outline" className="h-7 shrink-0 border-verified/30 bg-verified/10 text-verified hover:bg-verified/20" onClick={onReplay}>
          <Play className="h-3 w-3 mr-1" /> Replay
        </Button>
      </div>
    </div>
  );
}

function SummaryStat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof GitBranch;
  label: string;
  value: number;
  accent?: "verified" | "repairing" | "violating";
}) {
  const color =
    accent === "verified"
      ? "text-verified"
      : accent === "repairing"
        ? "text-repairing"
        : accent === "violating"
          ? "text-violating"
          : "text-foreground";
  return (
    <Card className="bg-card/60 backdrop-blur border-border/60 p-3 relative overflow-hidden">
      <div className="bg-grid-fine absolute inset-0 opacity-20" />
      <div className="relative flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-md bg-background/60 flex items-center justify-center shrink-0">
          <Icon className={cn("h-4 w-4", color)} />
        </div>
        <div>
          <div className={cn("text-xl font-semibold tabular-nums leading-none", color)}>{value}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">{label}</div>
        </div>
      </div>
    </Card>
  );
}
