"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, XCircle, ShieldOff, Circle } from "lucide-react";
import type { ShardStatus, Severity, MergeStatus } from "@/lib/types";

export function StatusDot({
  status,
  className,
}: {
  status: ShardStatus | "verified" | "violating" | "repairing" | "quarantined" | "idle";
  className?: string;
}) {
  const map: Record<string, { color: string; pulse: boolean }> = {
    healthy: { color: "bg-[var(--verified)]", pulse: false },
    verified: { color: "bg-[var(--verified)]", pulse: false },
    repairing: { color: "bg-[var(--repairing)]", pulse: true },
    violating: { color: "bg-[var(--violating)]", pulse: true },
    quarantined: { color: "bg-[var(--quarantined)]", pulse: false },
    idle: { color: "bg-muted-foreground", pulse: false },
  };
  const { color, pulse } = map[status] ?? map.idle;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", color)}>
        {pulse && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full rounded-full opacity-60 animate-epistemic-pulse",
              color,
            )}
          />
        )}
      </span>
    </span>
  );
}

export function StatusPill({
  status,
  label,
  className,
}: {
  status: ShardStatus | MergeStatus | "verified" | "violating" | "repairing" | "quarantined" | "idle" | "applied" | "rejected" | "pending";
  label?: string;
  className?: string;
}) {
  const config: Record<
    string,
    { color: string; text: string; icon: typeof CheckCircle2; defaultLabel: string }
  > = {
    healthy: { color: "border-verified/30 bg-verified/10", text: "text-verified", icon: CheckCircle2, defaultLabel: "Healthy" },
    verified: { color: "border-verified/30 bg-verified/10", text: "text-verified", icon: CheckCircle2, defaultLabel: "Verified" },
    applied: { color: "border-verified/30 bg-verified/10", text: "text-verified", icon: CheckCircle2, defaultLabel: "Applied" },
    repairing: { color: "border-repairing/30 bg-repairing/10", text: "text-repairing", icon: AlertTriangle, defaultLabel: "Repairing" },
    pending: { color: "border-repairing/30 bg-repairing/10", text: "text-repairing", icon: Circle, defaultLabel: "Pending" },
    violating: { color: "border-violating/30 bg-violating/10", text: "text-violating", icon: XCircle, defaultLabel: "Violating" },
    rejected: { color: "border-violating/30 bg-violating/10", text: "text-violating", icon: XCircle, defaultLabel: "Rejected" },
    quarantined: { color: "border-quarantined/30 bg-quarantined/10", text: "text-quarantined", icon: ShieldOff, defaultLabel: "Quarantined" },
    idle: { color: "border-border bg-muted", text: "text-muted-foreground", icon: Circle, defaultLabel: "Idle" },
  };
  const c = config[status] ?? config.idle;
  const Icon = c.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        c.color,
        c.text,
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {label ?? c.defaultLabel}
    </span>
  );
}

export function SeverityBadge({ severity, soft }: { severity: Severity; soft?: boolean }) {
  const map: Record<Severity, string> = {
    critical: "border-violating/40 bg-violating/10 text-violating",
    high: "border-repairing/40 bg-repairing/10 text-repairing",
    medium: "border-quarantined/40 bg-quarantined/10 text-quarantined",
    low: "border-border bg-muted text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        map[severity],
      )}
    >
      {severity}
      {soft && <span className="opacity-70">·soft</span>}
    </span>
  );
}

export function Hash({
  value,
  length = 10,
  className,
}: {
  value: string;
  length?: number;
  className?: string;
}) {
  const display =
    value.length > length ? `${value.slice(0, length)}…` : value;
  return (
    <span
      className={cn("font-mono text-xs text-muted-foreground", className)}
      title={value}
    >
      {display}
    </span>
  );
}
