"use client";

import { useMemo, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Download,
  Filter,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

export interface AuditRow {
  id: string;
  actor: string;
  action: string;
  fromState: string | null;
  toState: string | null;
  symbol: string | null;
  reason: string | null;
  metadata: string | null;
  createdAt: string;
}

interface AuditViewerProps {
  rows: AuditRow[];
  tenantSlug: string;
}

function toCsv(rows: AuditRow[]): string {
  const headers = ["at", "actor", "action", "fromState", "toState", "symbol", "reason", "metadata"];
  const lines = [headers.join(",")];
  for (const r of rows) {
    const cells = [
      new Date(r.createdAt).toISOString(),
      r.actor,
      r.action,
      r.fromState ?? "",
      r.toState ?? "",
      r.symbol ?? "",
      (r.reason ?? "").replace(/,/g, ";"),
      (r.metadata ?? "").replace(/,/g, ";"),
    ];
    lines.push(cells.map((c) => `"${c.replace(/"/g, '""')}"`).join(","));
  }
  return lines.join("\n");
}

// Action color map for visual grouping
const ACTION_COLORS: Record<string, string> = {
  FSM_DISPATCH: "text-lime-400",
  LEAK_SIMULATION_START: "text-orange-400",
  OPERATOR_TAMPER_DRILL: "text-red-400",
  TAMPER_TEST_FLAG: "text-red-400",
  TAMPER_TEST_AUTO_RESTORE: "text-emerald-400",
  NODE_SELECT: "text-sky-400",
  SITE_CHANGE: "text-violet-400",
};

export function AuditViewer({ rows, tenantSlug }: AuditViewerProps) {
  const [search, setSearch] = useState("");
  const [actorFilter, setActorFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState<string>("all"); // all, 5m, 1h, 24h
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20); // 20, 50, 100

  // Derive unique actors + actions for filter dropdowns
  const { actors, actions } = useMemo(() => {
    const actorSet = new Set<string>();
    const actionSet = new Set<string>();
    rows.forEach((r) => {
      actorSet.add(r.actor);
      actionSet.add(r.action);
    });
    return {
      actors: Array.from(actorSet).sort(),
      actions: Array.from(actionSet).sort(),
    };
  }, [rows]);

  // Apply filters
  const filtered = useMemo(() => {
    const now = Date.now();
    const timeMs: Record<string, number> = {
      "5m": 5 * 60 * 1000,
      "1h": 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
    };
    const cutoff = timeFilter !== "all" ? now - timeMs[timeFilter] : 0;

    return rows.filter((r) => {
      // Time filter
      if (cutoff && new Date(r.createdAt).getTime() < cutoff) return false;
      // Actor filter
      if (actorFilter !== "all" && r.actor !== actorFilter) return false;
      // Action filter
      if (actionFilter !== "all" && r.action !== actionFilter) return false;
      // Search filter (case-insensitive across action, reason, symbol)
      if (search) {
        const q = search.toLowerCase();
        const hay =
          `${r.action} ${r.reason ?? ""} ${r.symbol ?? ""} ${r.actor} ${r.fromState ?? ""} ${r.toState ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, actorFilter, actionFilter, timeFilter]);

  const hasFilters =
    search || actorFilter !== "all" || actionFilter !== "all" || timeFilter !== "all";

  // Pagination — reverse (newest first) then paginate
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pagedRows = useMemo(() => {
    const reversed = [...filtered].reverse();
    const start = currentPage * pageSize;
    return reversed.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  function clearFilters() {
    setSearch("");
    setActorFilter("all");
    setActionFilter("all");
    setTimeFilter("all");
  }

  function downloadCsv() {
    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vvu-audit-${tenantSlug}-${new Date().toISOString().slice(0, 19)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="mb-2 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Audit Log (WORM)</h3>
          <Badge variant="outline" className="font-mono text-[9px]">
            {filtered.length}/{rows.length}
          </Badge>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-[11px]"
          onClick={downloadCsv}
          disabled={filtered.length === 0}
        >
          <Download className="h-3 w-3" /> CSV
        </Button>
      </div>

      {/* Filter controls */}
      <div className="mb-2 flex items-center gap-1.5 flex-wrap">
        <div className="relative flex-1 min-w-[120px]">
          <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Search audit log…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 pl-7 pr-2 text-[11px] font-mono"
          />
        </div>
        <Select value={actorFilter} onValueChange={setActorFilter}>
          <SelectTrigger className="h-7 w-auto text-[10px] gap-1 px-2">
            <SelectValue placeholder="Actor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actors</SelectItem>
            {actors.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="h-7 w-auto text-[10px] gap-1 px-2">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {actions.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={timeFilter} onValueChange={setTimeFilter}>
          <SelectTrigger className="h-7 w-auto text-[10px] gap-1 px-2">
            <SelectValue placeholder="Time" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All time</SelectItem>
            <SelectItem value="5m">Last 5 min</SelectItem>
            <SelectItem value="1h">Last 1 hour</SelectItem>
            <SelectItem value="24h">Last 24 hours</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[10px] gap-1 text-muted-foreground"
            onClick={clearFilters}
          >
            <X className="h-3 w-3" /> Clear
          </Button>
        )}
      </div>

      <ScrollArea className="h-[240px] rounded border border-border vvu-surface-deep">
        <ul className="divide-y divide-border/40 font-mono text-[10px]">
          {filtered.length === 0 && (
            <li className="px-2 py-4 text-center text-muted-foreground">
              {hasFilters ? (
                <span className="flex items-center justify-center gap-1">
                  <Filter className="h-3 w-3" /> No events match filters.
                </span>
              ) : (
                "No audit events."
              )}
            </li>
          )}
          {pagedRows.map((r, i) => (
            <li key={r.id} className="grid grid-cols-[110px_1fr] gap-2 px-2 py-1 vvu-slide-in">
              <div className="flex flex-col">
                <span className="text-muted-foreground">
                  {new Date(r.createdAt).toLocaleTimeString()}
                </span>
                <span className="text-[9px] text-muted-foreground/70">
                  {new Date(r.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="space-y-0.5">
                <div>
                  <span className={ACTION_COLORS[r.action] ?? "text-amber-400"}>{r.action}</span>
                  <span className="ml-1 text-muted-foreground">· {r.actor}</span>
                </div>
                {(r.fromState || r.toState) && (
                  <div className="text-foreground">
                    {r.fromState?.replace(/_/g, " ")} → {r.toState?.replace(/_/g, " ")}
                    {r.symbol && <span className="ml-1 text-amber-400">[{r.symbol}]</span>}
                  </div>
                )}
                {r.reason && <div className="text-muted-foreground">{r.reason}</div>}
              </div>
            </li>
          ))}
        </ul>
      </ScrollArea>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={() => setPage(0)}
              disabled={page === 0}
              title="First page"
            >
              <ChevronsLeft className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              title="Previous page"
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <span className="font-mono text-[10px] text-muted-foreground px-2">
              {page + 1} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              title="Next page"
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={() => setPage(totalPages - 1)}
              disabled={page >= totalPages - 1}
              title="Last page"
            >
              <ChevronsRight className="h-3 w-3" />
            </Button>
          </div>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setPage(0);
            }}
          >
            <SelectTrigger className="h-6 w-[70px] text-[10px] gap-1 px-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="20">20 / page</SelectItem>
              <SelectItem value="50">50 / page</SelectItem>
              <SelectItem value="100">100 / page</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
