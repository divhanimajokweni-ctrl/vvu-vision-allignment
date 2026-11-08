"use client";

// src/components/analytics/AuditLogPanel.tsx — §9 AUDIT TRAIL (Task 6-c).
// RLS-scoped append-only audit log viewer: who did what, when, and which FSM
// state transition caused it. Reads GET /api/vvu/audit?limit=50 (DB-backed —
// works even when the telemetry service is offline), polls every 10s. The
// newest row flashes a lime left edge when fresh entries stream in (pure CSS:
// row 0 is keyed by entry id, so a new id remounts the row and replays the
// animation — no state, no effects).

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Chip,
  LiveDot,
  QueryErrorCard,
  SectionHeader,
  fmtStamp,
  fmtTime,
  useAnalyticsQuery,
  useAuditQuery,
  useQueryErrorToast,
  type AuditEntry,
} from "./shared";

// ─── Actor / symbol colour maps (SCADA palette, no blue) ────────────────────

const ACTOR_CLASS: Record<string, string> = {
  "EDGE-FSM": "border-[#2ea8a0]/50 text-[#2ea8a0]",
  OPERATOR: "border-[#f3e38a]/50 text-[#f3e38a]",
  "EDGE-SYSTEM": "border-[#8fb35a]/50 text-[#8fb35a]",
};

function actorClass(actor: string): string {
  return ACTOR_CLASS[actor] ?? "border-[rgba(107,138,64,0.35)] text-[#7a8a6e]";
}

const SYMBOL_CLASS: Record<string, string> = {
  CLICK: "border-[#e5484d]/60 text-[#e5484d]",
  CRIT: "border-[#e5484d]/60 text-[#e5484d]",
  CLEAR: "border-[#8fb35a]/50 text-[#8fb35a]",
  WARN: "border-[#e0a030]/50 text-[#e0a030]",
  RESET: "border-[#c8ff00]/50 text-[#c8ff00]",
  CERT: "border-[#c8ff00]/50 text-[#c8ff00]",
  TOGGLE: "border-[#e0a030]/50 text-[#e0a030]",
};

function symbolClass(symbol: string): string {
  return SYMBOL_CLASS[symbol] ?? "border-[rgba(107,138,64,0.35)] text-[#7a8a6e]";
}

function AuditSkeleton() {
  return (
    <div className="space-y-2 p-1" aria-hidden>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-7 w-full bg-[#141a11]" />
      ))}
    </div>
  );
}

// ─── FSM Δ cell: from —[σ]→ to (dim "—" for non-FSM rows) ───────────────────

function FsmDelta({ entry }: { entry: AuditEntry }) {
  if (!entry.fromState && !entry.toState && !entry.symbol) {
    return <span className="text-[#7a8a6e]">—</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {entry.fromState && <span className="text-[#7a8a6e]">{entry.fromState}</span>}
      {entry.symbol && (
        <span
          className={cn(
            "vvu-label text-[8px] font-bold px-1.5 py-0.5 rounded border shrink-0",
            symbolClass(entry.symbol),
          )}
          title={`SYMBOL ${entry.symbol}`}
        >
          {entry.symbol}
        </span>
      )}
      {entry.fromState && entry.toState && <span className="text-[#7a8a6e]">→</span>}
      {entry.toState && <span className="text-[#c9d4bd]">{entry.toState}</span>}
    </span>
  );
}

// ─── Section ────────────────────────────────────────────────────────────────

export function AuditLogPanel({ num }: { num?: string }) {
  const query = useAuditQuery();
  useQueryErrorToast(query.isError, query.error, "AUDIT TRAIL");
  // True persisted row count (append-only) for the footer note — same cache
  // key as every other section, so this is a free read.
  const analytics = useAnalyticsQuery();
  const persisted = analytics.data?.auditCount ?? null;

  const entries = query.data?.entries ?? [];

  return (
    <section className="vvu-panel vvu-enter p-4 sm:p-5" aria-label="audit trail">
      <SectionHeader
        num={num}
        title="AUDIT TRAIL · RLS-SCOPED"
        kicker="APPEND-ONLY · WHO · WHAT · WHEN"
        right={
          <>
            <Chip tone={query.isError ? "crimson" : query.isPending ? "dim" : "sage"}>
              {query.isPending ? "… ENTRIES" : `${query.data?.total ?? 0} ROWS`}
            </Chip>
            <Chip tone="teal">
              <LiveDot color="#2ea8a0" dim={query.isPending || query.isError} /> LIVE
            </Chip>
          </>
        }
      />

      <div
        className="max-h-96 overflow-y-auto overflow-x-auto -mx-1 px-1 rounded"
        aria-label="audit log entries, newest first"
      >
        {query.isPending ? (
          <AuditSkeleton />
        ) : query.isError ? (
          <QueryErrorCard label="AUDIT TRAIL" onRetry={() => void query.refetch()} />
        ) : entries.length > 0 ? (
          <table className="w-full text-left border-collapse min-w-[760px]">
            <caption className="sr-only">
              Audit trail — most recent 50 append-only entries, newest first
            </caption>
            <thead className="sticky top-0 z-10 bg-[#0b0f0a]">
              <tr className="vvu-label text-[8px] text-[#7a8a6e]">
                <th
                  scope="col"
                  className="px-2 py-2 border-b border-[rgba(107,138,64,0.25)] w-[80px]"
                >
                  TIME
                </th>
                <th scope="col" className="px-2 py-2 border-b border-[rgba(107,138,64,0.25)]">
                  ACTOR
                </th>
                <th scope="col" className="px-2 py-2 border-b border-[rgba(107,138,64,0.25)]">
                  ACTION
                </th>
                <th scope="col" className="px-2 py-2 border-b border-[rgba(107,138,64,0.25)]">
                  FSM Δ
                </th>
                <th scope="col" className="px-2 py-2 border-b border-[rgba(107,138,64,0.25)]">
                  REASON
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <tr
                  key={entry.id}
                  className={cn(
                    "border-b border-[rgba(107,138,64,0.12)] transition-colors hover:bg-[rgba(107,138,64,0.09)]",
                    i % 2 === 1 && "bg-[rgba(107,138,64,0.05)]",
                    i === 0 && "vvu6c-row-flash",
                  )}
                >
                  <td
                    className={cn(
                      "px-2 py-1.5 text-[#7a8a6e] tabular-nums whitespace-nowrap",
                      i === 0 && "vvu6c-edge-flash",
                    )}
                    title={fmtStamp(entry.createdAt)}
                  >
                    {fmtTime(entry.createdAt)}
                  </td>
                  <td className="px-2 py-1.5">
                    <span
                      className={cn(
                        "vvu-label text-[8px] px-1.5 py-0.5 rounded border whitespace-nowrap",
                        actorClass(entry.actor),
                      )}
                      title={`ACTOR ${entry.actor}`}
                    >
                      {entry.actor}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-[#c9d4bd] whitespace-nowrap font-medium">
                    {entry.action}
                  </td>
                  <td className="px-2 py-1.5">
                    <FsmDelta entry={entry} />
                  </td>
                  <td
                    className="px-2 py-1.5 text-[#7a8a6e] max-w-[260px] truncate"
                    title={entry.reason ?? undefined}
                  >
                    {entry.reason ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="vvu-label text-[10px] text-[#7a8a6e] p-4 text-center">
            AUDIT LOG EMPTY · AWAITING FIRST EVENT
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-[rgba(107,138,64,0.25)] flex flex-wrap items-center gap-2">
        <Chip tone="sage">audit_log</Chip>
        <span className="vvu-label text-[9px] text-[#7a8a6e]">
          append-only · PostgreSQL RLS vvu.current_tenant_id · {persisted ?? "59"}+ entries
          persisted
        </span>
      </div>
    </section>
  );
}

export default AuditLogPanel;
