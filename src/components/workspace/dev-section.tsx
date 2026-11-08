"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Book,
  CheckCircle2,
  Copy,
  ExternalLink,
  GitCommit,
  GitPullRequest,
  Hash,
  Loader2,
  MessageCircle,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Route,
  Terminal,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
// Avatar replaced with inline initials badge — Golden Rule: no @radix-ui/react-avatar dep.
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────

type ContributionType = "ISSUE" | "PR" | "DISCUSSION" | "COMMIT";
type ContributionState = "OPEN" | "MERGED" | "CLOSED" | "DRAFT";
type ChangelogKind =
  | "ADDED"
  | "CHANGED"
  | "FIXED"
  | "REMOVED"
  | "SECURITY"
  | "DEPRECATED";
type RoadmapMilestone = "Q1" | "Q2" | "Q3" | "Q4" | "Backlog";
type RoadmapStatus = "PLANNED" | "IN_PROGRESS" | "SHIPPED" | "AT_RISK";
type RoadmapPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type DocCategory =
  | "QUICKSTART"
  | "GUIDES"
  | "REFERENCE"
  | "ARCHITECTURE"
  | "DSL"
  | "POLICY";
type IncidentSeverity = "MINOR" | "MAJOR" | "CRITICAL" | "MAINTENANCE";
type IncidentStatus =
  | "INVESTIGATING"
  | "IDENTIFIED"
  | "MONITORING"
  | "RESOLVED";

interface Contribution {
  id: string;
  type: ContributionType;
  title: string;
  author: string;
  authorEmail: string | null;
  state: ContributionState;
  labels: string;
  repo: string;
  number: number;
  url: string | null;
  commentsCount: number;
  upvotes: number;
  createdAt: string;
  updatedAt: string;
}

interface ChangelogEntry {
  id: string;
  version: string;
  title: string;
  body: string;
  kind: ChangelogKind;
  publishedAt: string;
  author: string | null;
}

interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  milestone: RoadmapMilestone;
  status: RoadmapStatus;
  priority: RoadmapPriority;
  assignee: string | null;
  progressPct: number;
  tags: string;
  createdAt: string;
  updatedAt: string;
}

interface DocIndexItem {
  id: string;
  slug: string;
  title: string;
  category: DocCategory;
  order: number;
  updatedAt: string;
}

interface DocPage extends DocIndexItem {
  body: string;
}

interface Incident {
  id: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  affectedComponents: string;
  body: string;
  startedAt: string;
  resolvedAt: string | null;
  createdAt: string;
}

interface SystemStatus {
  operational: boolean;
  activeCount: number;
  lastResolvedAt: string | null;
  worstSeverity: string | null;
}

interface DevSummary {
  counts: {
    contributions: number;
    changelog: number;
    roadmap: number;
    docs: number;
    incidents: number;
    openIssues: number;
    openPrs: number;
    mergedThisMonth: number;
    totalUpvotes: number;
  };
  recentContributions: Contribution[];
  recentChangelog: ChangelogEntry[];
  systemStatus: SystemStatus;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatDate(d: string | Date | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function relativeTime(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = Date.now() - date.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

function durationLabel(start: string, end: string | null): string {
  if (!end) return "ongoing";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ${min % 60}m`;
  return `${Math.floor(hr / 24)}d ${hr % 24}h`;
}

function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(" ");
}

function initials(name: string): string {
  return name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

// ─── Pill styles ───────────────────────────────────────────────────────────

function StatePill({ state }: { state: ContributionState }) {
  const map: Record<ContributionState, string> = {
    OPEN: "border-[var(--vvu-ochre)]/40 bg-[var(--vvu-ochre)]/10 text-[color:var(--vvu-ochre)]",
    MERGED:
      "border-[var(--vvu-lime)]/40 bg-[var(--vvu-lime)]/10 text-[color:var(--vvu-lime)]",
    CLOSED:
      "border-[var(--vvu-crimson)]/40 bg-[var(--vvu-crimson)]/10 text-[color:var(--vvu-crimson)]",
    DRAFT: "border-border/60 bg-muted/40 text-muted-foreground",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        map[state],
      )}
    >
      {state}
    </span>
  );
}

function KindPill({ kind }: { kind: ChangelogKind }) {
  const map: Record<ChangelogKind, string> = {
    ADDED: "border-[var(--vvu-lime)]/40 bg-[var(--vvu-lime)]/10 text-[color:var(--vvu-lime)]",
    CHANGED:
      "border-[var(--vvu-ochre)]/40 bg-[var(--vvu-ochre)]/10 text-[color:var(--vvu-ochre)]",
    FIXED: "border-[var(--vvu-teal)]/40 bg-[var(--vvu-teal)]/10 text-[color:var(--vvu-teal)]",
    REMOVED:
      "border-[var(--vvu-crimson)]/40 bg-[var(--vvu-crimson)]/10 text-[color:var(--vvu-crimson)]",
    SECURITY:
      "border-[var(--vvu-crimson)]/40 bg-[var(--vvu-crimson)]/10 text-[color:var(--vvu-crimson)]",
    DEPRECATED:
      "border-[var(--vvu-ochre)]/40 bg-[var(--vvu-ochre)]/10 text-[color:var(--vvu-ochre)]",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        map[kind],
      )}
    >
      {kind}
    </span>
  );
}

function StatusPill({ status }: { status: RoadmapStatus }) {
  const map: Record<RoadmapStatus, string> = {
    PLANNED: "border-border/60 bg-muted/40 text-muted-foreground",
    IN_PROGRESS:
      "border-[var(--vvu-ochre)]/40 bg-[var(--vvu-ochre)]/10 text-[color:var(--vvu-ochre)]",
    SHIPPED:
      "border-[var(--vvu-lime)]/40 bg-[var(--vvu-lime)]/10 text-[color:var(--vvu-lime)]",
    AT_RISK:
      "border-[var(--vvu-crimson)]/40 bg-[var(--vvu-crimson)]/10 text-[color:var(--vvu-crimson)]",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        map[status],
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: RoadmapPriority }) {
  const map: Record<RoadmapPriority, string> = {
    LOW: "border-border/60 text-muted-foreground",
    MEDIUM:
      "border-[var(--vvu-sage-bright)]/40 text-[color:var(--vvu-sage-bright)]",
    HIGH: "border-[var(--vvu-ochre)]/40 text-[color:var(--vvu-ochre)]",
    CRITICAL:
      "border-[var(--vvu-crimson)]/40 text-[color:var(--vvu-crimson)]",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center rounded border bg-transparent px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
        map[priority],
      )}
    >
      {priority}
    </span>
  );
}

function SeverityPill({ severity }: { severity: IncidentSeverity }) {
  const map: Record<IncidentSeverity, string> = {
    MINOR: "border-[var(--vvu-sage-bright)]/40 bg-[var(--vvu-sage-bright)]/10 text-[color:var(--vvu-sage-bright)]",
    MAJOR: "border-[var(--vvu-ochre)]/40 bg-[var(--vvu-ochre)]/10 text-[color:var(--vvu-ochre)]",
    CRITICAL:
      "border-[var(--vvu-crimson)]/40 bg-[var(--vvu-crimson)]/10 text-[color:var(--vvu-crimson)]",
    MAINTENANCE:
      "border-[var(--vvu-teal)]/40 bg-[var(--vvu-teal)]/10 text-[color:var(--vvu-teal)]",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        map[severity],
      )}
    >
      {severity}
    </span>
  );
}

function IncidentStatusPill({ status }: { status: IncidentStatus }) {
  const map: Record<IncidentStatus, string> = {
    INVESTIGATING:
      "border-[var(--vvu-crimson)]/40 bg-[var(--vvu-crimson)]/10 text-[color:var(--vvu-crimson)]",
    IDENTIFIED:
      "border-[var(--vvu-ochre)]/40 bg-[var(--vvu-ochre)]/10 text-[color:var(--vvu-ochre)]",
    MONITORING:
      "border-[var(--vvu-teal)]/40 bg-[var(--vvu-teal)]/10 text-[color:var(--vvu-teal)]",
    RESOLVED:
      "border-[var(--vvu-lime)]/40 bg-[var(--vvu-lime)]/10 text-[color:var(--vvu-lime)]",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        map[status],
      )}
    >
      {status}
    </span>
  );
}

function MethodBadge({ method }: { method: string }) {
  const m = method.toUpperCase();
  const map: Record<string, string> = {
    GET: "border-[var(--vvu-lime)]/40 bg-[var(--vvu-lime)]/10 text-[color:var(--vvu-lime)]",
    POST: "border-[var(--vvu-ochre)]/40 bg-[var(--vvu-ochre)]/10 text-[color:var(--vvu-ochre)]",
    PATCH: "border-[var(--vvu-teal)]/40 bg-[var(--vvu-teal)]/10 text-[color:var(--vvu-teal)]",
    DELETE:
      "border-[var(--vvu-crimson)]/40 bg-[var(--vvu-crimson)]/10 text-[color:var(--vvu-crimson)]",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center justify-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wide",
        map[m] ?? "border-border/60 text-muted-foreground",
      )}
    >
      {m}
    </span>
  );
}

function ContributionTypeIcon({ type }: { type: ContributionType }) {
  switch (type) {
    case "ISSUE":
      return (
        <AlertCircle className="h-3.5 w-3.5 text-[color:var(--vvu-ochre)]" />
      );
    case "PR":
      return (
        <GitPullRequest className="h-3.5 w-3.5 text-[color:var(--vvu-lime)]" />
      );
    case "DISCUSSION":
      return (
        <MessageCircle className="h-3.5 w-3.5 text-[color:var(--vvu-teal)]" />
      );
    case "COMMIT":
      return (
        <GitCommit className="h-3.5 w-3.5 text-[color:var(--vvu-sage-bright)]" />
      );
  }
}

// ─── Markdown renderer (under 60 lines) ────────────────────────────────────

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("`")) {
      parts.push(
        <code
          key={`${keyBase}-i${k++}`}
          className="font-mono text-xs bg-muted/40 px-1 py-0.5 rounded text-foreground"
        >
          {tok.slice(1, -1)}
        </code>,
      );
    } else {
      parts.push(
        <strong
          key={`${keyBase}-i${k++}`}
          className="font-semibold text-foreground"
        >
          {tok.slice(2, -2)}
        </strong>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function renderMarkdown(md: string): React.ReactNode {
  const lines = md.split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Code fence
    if (line.trim().startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        buf.push(lines[i]);
        i++;
      }
      i++;
      blocks.push(
        <pre
          key={`b${key++}`}
          className="bg-muted/30 border border-border/40 p-3 rounded text-xs font-mono overflow-x-auto my-3"
        >
          <code className="text-foreground/90">{buf.join("\n")}</code>
        </pre>,
      );
      continue;
    }
    // Heading
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const lvl = h[1].length;
      const txt = renderInline(h[2], `h${key}`);
      if (lvl === 1)
        blocks.push(
          <h1
            key={`b${key++}`}
            className="text-2xl font-bold mt-4 mb-2 text-foreground"
          >
            {txt}
          </h1>,
        );
      else if (lvl === 2)
        blocks.push(
          <h2
            key={`b${key++}`}
            className="text-lg font-semibold mt-5 mb-2 text-foreground"
          >
            {txt}
          </h2>,
        );
      else
        blocks.push(
          <h3
            key={`b${key++}`}
            className="text-base font-semibold mt-3 mb-1 text-foreground"
          >
            {txt}
          </h3>,
        );
      i++;
      continue;
    }
    // Table
    if (
      line.trim().startsWith("|") &&
      i + 1 < lines.length &&
      /^\s*\|[-:\s|]+\|\s*$/.test(lines[i + 1])
    ) {
      const parseRow = (s: string) =>
        s.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = parseRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(parseRow(lines[i]));
        i++;
      }
      blocks.push(
        <div
          key={`b${key++}`}
          className="my-3 overflow-x-auto rounded border border-border/40"
        >
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border/60 bg-muted/20">
                {head.map((c, ci) => (
                  <th
                    key={ci}
                    className="text-left p-2 font-semibold text-foreground"
                  >
                    {renderInline(c, `th${key}-${ci}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-b border-border/30 last:border-0">
                  {r.map((c, ci) => (
                    <td
                      key={ci}
                      className="p-2 align-top text-muted-foreground"
                    >
                      {renderInline(c, `td${key}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    // Bulleted list
    if (/^\s*-\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*-\s+/, ""));
        i++;
      }
      blocks.push(
        <ul
          key={`b${key++}`}
          className="list-disc pl-5 my-2 space-y-1 text-sm text-muted-foreground"
        >
          {items.map((it, ii) => (
            <li key={ii}>{renderInline(it, `li${key}-${ii}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    // Blank line → paragraph break
    if (line.trim() === "") {
      i++;
      continue;
    }
    // Paragraph
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !lines[i].trim().startsWith("```") &&
      !/^\s*-\s+/.test(lines[i]) &&
      !lines[i].trim().startsWith("|")
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p
        key={`b${key++}`}
        className="text-sm text-muted-foreground my-2 leading-relaxed"
      >
        {renderInline(para.join(" "), `p${key}`)}
      </p>,
    );
  }
  return <div className="markdown-body">{blocks}</div>;
}

// ─── API Reference data (mirrors the seed `api-reference` doc) ─────────────

interface ApiEndpoint {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  description: string;
}

interface ApiGroupDef {
  category: string;
  endpoints: ApiEndpoint[];
}

const API_GROUPS: ApiGroupDef[] = [
  {
    category: "Core",
    endpoints: [
      { method: "GET", path: "/api/stats", description: "Global dashboard stats" },
      { method: "GET", path: "/api/policies", description: "List all policies" },
      { method: "POST", path: "/api/policies", description: "Create a policy" },
      { method: "GET", path: "/api/shards", description: "List shards" },
      { method: "GET", path: "/api/merges", description: "List merge proposals" },
      { method: "GET", path: "/api/proofs", description: "List MMR ancestry proofs" },
      { method: "GET", path: "/api/violations", description: "List invariant violations" },
    ],
  },
  {
    category: "Workspace",
    endpoints: [
      { method: "GET", path: "/api/account", description: "Current user profile" },
      { method: "PATCH", path: "/api/account", description: "Update profile" },
      { method: "GET", path: "/api/settings", description: "User settings" },
      { method: "PATCH", path: "/api/settings", description: "Update settings" },
      { method: "GET", path: "/api/devices", description: "Registered devices" },
      { method: "POST", path: "/api/devices", description: "Register a device" },
      { method: "GET", path: "/api/subscriptions", description: "Active subscription" },
      { method: "GET", path: "/api/dev/contributions", description: "Open issues & PRs" },
      { method: "GET", path: "/api/dev/changelog", description: "Versioned changelog" },
      { method: "GET", path: "/api/dev/roadmap", description: "Roadmap milestones" },
      { method: "GET", path: "/api/dev/docs", description: "Documentation index" },
      { method: "GET", path: "/api/dev/docs/:slug", description: "Single doc page" },
      { method: "GET", path: "/api/dev/incidents", description: "System status incidents" },
    ],
  },
  {
    category: "Mini-services",
    endpoints: [
      {
        method: "GET",
        path: "/api/epd-cli/validate?XTransformPort=3031",
        description: "epd-cli HTTP bridge (port 3031)",
      },
      {
        method: "GET",
        path: "/api/event-bus?XTransformPort=3032",
        description: "event-bus Socket.IO (port 3032)",
      },
      {
        method: "GET",
        path: "/api/worm-nest?XTransformPort=3033",
        description: "worm-nest Socket.IO (port 3033)",
      },
    ],
  },
];

// ─── Status mock components grid ────────────────────────────────────────────

interface ComponentStatus {
  name: string;
  status: "operational" | "degraded" | "down";
  uptime: string;
  latency: string;
}

const COMPONENT_STATUSES: ComponentStatus[] = [
  { name: "Dashboard", status: "operational", uptime: "99.98%", latency: "42ms" },
  { name: "API", status: "operational", uptime: "99.97%", latency: "18ms" },
  { name: "epd-cli", status: "operational", uptime: "99.95%", latency: "—ms" },
  { name: "event-bus", status: "operational", uptime: "99.99%", latency: "6ms" },
  { name: "worm-nest", status: "operational", uptime: "99.92%", latency: "31ms" },
  { name: "Federation", status: "operational", uptime: "99.89%", latency: "84ms" },
];

function componentDot(s: ComponentStatus["status"]): string {
  switch (s) {
    case "operational":
      return "bg-[var(--vvu-lime)]";
    case "degraded":
      return "bg-[var(--vvu-ochre)]";
    case "down":
      return "bg-[var(--vvu-crimson)]";
  }
}

// ─── Docs Tab ──────────────────────────────────────────────────────────────

const DOC_CATEGORIES: DocCategory[] = [
  "QUICKSTART",
  "GUIDES",
  "REFERENCE",
  "ARCHITECTURE",
  "DSL",
  "POLICY",
];

function DocsTab() {
  const [index, setIndex] = useState<DocIndexItem[]>([]);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [doc, setDoc] = useState<DocPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [docLoading, setDocLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dev/docs");
        if (!res.ok) throw new Error("docs index fetch failed");
        const data = (await res.json()) as { items: DocIndexItem[] };
        if (cancelled) return;
        setIndex(data.items);
        const firstQuickstart =
          data.items.find((d) => d.category === "QUICKSTART") ?? data.items[0];
        if (firstQuickstart) setActiveSlug(firstQuickstart.slug);
      } catch {
        if (!cancelled) toast.error("Failed to load doc index");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeSlug) return;
    let cancelled = false;
    setDocLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/dev/docs/${activeSlug}`);
        if (!res.ok) throw new Error("doc fetch failed");
        const data = (await res.json()) as { doc: DocPage };
        if (cancelled) return;
        setDoc(data.doc);
      } catch {
        if (!cancelled) toast.error("Failed to load doc");
      } finally {
        if (!cancelled) setDocLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSlug]);

  const grouped = useMemo(() => {
    const g: Record<DocCategory, DocIndexItem[]> = {
      QUICKSTART: [],
      GUIDES: [],
      REFERENCE: [],
      ARCHITECTURE: [],
      DSL: [],
      POLICY: [],
    };
    for (const d of index) g[d.category]?.push(d);
    return g;
  }, [index]);

  const copyLink = useCallback(() => {
    if (!activeSlug) return;
    const url = `${window.location.origin}/?doc=${activeSlug}#dev`;
    void navigator.clipboard.writeText(url);
    toast.success("Doc link copied to clipboard");
  }, [activeSlug]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[16rem_1fr] gap-4">
      {/* Sidebar (desktop) */}
      <Card className="p-3 bg-card/40 border-border/60 hidden md:block h-fit sticky top-4">
        <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
          <Book className="h-3.5 w-3.5" style={{ color: "var(--vvu-lime)" }} />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Docs
          </span>
        </div>
        <nav className="space-y-3 max-h-[70vh] overflow-y-auto pr-1" aria-label="Doc categories">
          {loading ? (
            <div className="space-y-2 px-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          ) : (
            DOC_CATEGORIES.map((cat) =>
              grouped[cat].length === 0 ? null : (
                <div key={cat}>
                  <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-1">
                    {cat}
                  </div>
                  <ul className="space-y-0.5">
                    {grouped[cat].map((d) => (
                      <li key={d.id}>
                        <button
                          type="button"
                          onClick={() => setActiveSlug(d.slug)}
                          aria-current={activeSlug === d.slug ? "page" : undefined}
                          className={cx(
                            "w-full text-left rounded px-2 py-1.5 text-xs transition-colors",
                            activeSlug === d.slug
                              ? "bg-[var(--vvu-lime)]/10 text-[color:var(--vvu-lime)] font-medium"
                              : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                          )}
                        >
                          {d.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ),
            )
          )}
        </nav>
      </Card>

      {/* Mobile dropdown */}
      <div className="md:hidden">
        <Select value={activeSlug ?? undefined} onValueChange={setActiveSlug}>
          <SelectTrigger
            className="bg-card/40 border-border/60"
            aria-label="Select doc"
          >
            <SelectValue placeholder="Select a doc…" />
          </SelectTrigger>
          <SelectContent>
            {DOC_CATEGORIES.map((cat) =>
              grouped[cat].length === 0 ? null : (
                <SelectGroup key={cat}>
                  <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {cat}
                  </SelectLabel>
                  {grouped[cat].map((d) => (
                    <SelectItem key={d.id} value={d.slug}>
                      {d.title}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ),
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Main doc area */}
      <Card className="p-5 bg-card/40 border-border/60 min-h-[60vh]">
        <div className="flex items-start justify-between gap-3 mb-4 pb-3 border-b border-border/40">
          <div className="min-w-0">
            {doc ? (
              <>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge
                    variant="outline"
                    className="border-[var(--vvu-lime)]/40 text-[color:var(--vvu-lime)] text-[10px]"
                  >
                    {doc.category}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    updated {relativeTime(doc.updatedAt)}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-foreground truncate">
                  {doc.title}
                </h2>
              </>
            ) : (
              <Skeleton className="h-6 w-48" />
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={copyLink}
              disabled={!doc}
              aria-label="Copy doc link"
              className="h-7 text-xs border-border/60"
            >
              <Copy className="h-3 w-3" />
              <span className="hidden sm:inline">Copy link</span>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-7 text-xs border-border/60"
            >
              <a href="#" aria-label="Edit on GitHub">
                <ExternalLink className="h-3 w-3" />
                <span className="hidden sm:inline">Edit</span>
              </a>
            </Button>
          </div>
        </div>
        {docLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : doc ? (
          <article className="prose-sm max-w-none">
            {renderMarkdown(doc.body)}
          </article>
        ) : (
          <p className="text-sm text-muted-foreground">No doc selected.</p>
        )}
      </Card>
    </div>
  );
}

// ─── Contributions Tab ─────────────────────────────────────────────────────

const REPOS = [
  "air-kernel",
  "epistemic-runtime",
  "safe-krypte-basic",
  "safe-liner-basic",
  "hbk-adapter",
];

function KpiTile({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="p-4 bg-card/40 border-border/60">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div
            className="text-2xl font-bold mt-1"
            style={{ color }}
          >
            {value}
          </div>
          {sub && (
            <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
              {sub}
            </div>
          )}
        </div>
        <div
          className="h-8 w-8 rounded flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${color}1a`, color }}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}

function ContributionsTab({
  summary,
}: {
  summary: DevSummary | null;
}) {
  const [items, setItems] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [repoFilter, setRepoFilter] = useState<string>("all");
  const [active, setActive] = useState<Contribution | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (stateFilter !== "all") params.set("state", stateFilter);
      if (repoFilter !== "all") params.set("repo", repoFilter);
      const q = params.toString();
      const res = await fetch(`/api/dev/contributions${q ? `?${q}` : ""}`);
      if (!res.ok) throw new Error("contributions fetch failed");
      const data = (await res.json()) as { items: Contribution[] };
      setItems(data.items);
    } catch {
      toast.error("Failed to load contributions");
    } finally {
      setLoading(false);
    }
  }, [typeFilter, stateFilter, repoFilter]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const openRow = (c: Contribution) => {
    setActive(c);
    setSheetOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* KPI bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summary ? (
          <>
            <KpiTile
              label="Open issues"
              value={summary.counts.openIssues}
              sub="across all repos"
              color="var(--vvu-ochre)"
              icon={<AlertCircle className="h-4 w-4" />}
            />
            <KpiTile
              label="Open PRs"
              value={summary.counts.openPrs}
              sub="awaiting review"
              color="var(--vvu-lime)"
              icon={<GitPullRequest className="h-4 w-4" />}
            />
            <KpiTile
              label="Merged · 30d"
              value={summary.counts.mergedThisMonth}
              sub="merged this month"
              color="var(--vvu-teal)"
              icon={<GitCommit className="h-4 w-4" />}
            />
            <KpiTile
              label="Total upvotes"
              value={summary.counts.totalUpvotes}
              sub="community reactions"
              color="var(--vvu-sage-bright)"
              icon={<ArrowUpRight className="h-4 w-4" />}
            />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))
        )}
      </div>

      {/* Filter bar */}
      <Card className="p-3 bg-card/40 border-border/60">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 w-[140px] text-xs bg-card/40 border-border/60" aria-label="Filter by type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="ISSUE">Issues</SelectItem>
              <SelectItem value="PR">Pull requests</SelectItem>
              <SelectItem value="DISCUSSION">Discussions</SelectItem>
              <SelectItem value="COMMIT">Commits</SelectItem>
            </SelectContent>
          </Select>
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="h-8 w-[140px] text-xs bg-card/40 border-border/60" aria-label="Filter by state">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All states</SelectItem>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="MERGED">Merged</SelectItem>
              <SelectItem value="CLOSED">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={repoFilter} onValueChange={setRepoFilter}>
            <SelectTrigger className="h-8 w-[180px] text-xs bg-card/40 border-border/60" aria-label="Filter by repo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All repos</SelectItem>
              {REPOS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchList()}
            disabled={loading}
            className="h-8 text-xs border-border/60 ml-auto"
            aria-label="Refresh contributions"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Refresh
          </Button>
        </div>
      </Card>

      {/* Table (desktop) */}
      <Card className="p-0 bg-card/40 border-border/60 overflow-hidden hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-border/60 hover:bg-transparent">
              <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground w-[28px]" />
              <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Title</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground w-[120px]">Author</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground w-[140px]">Repo</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground w-[80px]">State</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground w-[160px]">Labels</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground w-[60px] text-right">Comments</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground w-[70px] text-right">Upvotes</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground w-[80px]">Age</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={9}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                  No contributions match these filters.
                </TableCell>
              </TableRow>
            ) : (
              items.map((c) => (
                <TableRow
                  key={c.id}
                  onClick={() => openRow(c)}
                  className="cursor-pointer border-border/40 hover:bg-muted/30 transition-colors"
                >
                  <TableCell className="py-2.5">
                    <ContributionTypeIcon type={c.type} />
                  </TableCell>
                  <TableCell className="py-2.5 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                        {c.repo}#{c.number || "—"}
                      </span>
                      <span className="text-sm text-foreground truncate">
                        {c.title}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5 text-xs text-muted-foreground font-mono">
                    {c.author}
                  </TableCell>
                  <TableCell className="py-2.5">
                    <Badge
                      variant="outline"
                      className="font-mono text-[10px] border-border/60"
                    >
                      {c.repo}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <StatePill state={c.state} />
                  </TableCell>
                  <TableCell className="py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {c.labels
                        .split(",")
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((l) => (
                          <Badge
                            key={l}
                            variant="secondary"
                            className="text-[9px] font-mono bg-muted/40 text-muted-foreground"
                          >
                            {l}
                          </Badge>
                        ))}
                      {c.labels.split(",").filter(Boolean).length > 2 && (
                        <span className="text-[9px] text-muted-foreground">
                          +{c.labels.split(",").filter(Boolean).length - 2}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5 text-right text-xs text-muted-foreground font-mono">
                    {c.commentsCount}
                  </TableCell>
                  <TableCell className="py-2.5 text-right text-xs font-mono" style={{ color: "var(--vvu-lime)" }}>
                    ▲ {c.upvotes}
                  </TableCell>
                  <TableCell className="py-2.5 text-[10px] text-muted-foreground font-mono">
                    {relativeTime(c.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Card list (mobile) */}
      <div className="md:hidden space-y-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))
        ) : items.length === 0 ? (
          <Card className="p-6 bg-card/40 border-border/60 text-center text-sm text-muted-foreground">
            No contributions match these filters.
          </Card>
        ) : (
          items.map((c) => (
            <Card
              key={c.id}
              className="p-3 bg-card/40 border-border/60 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => openRow(c)}
            >
              <div className="flex items-start gap-2">
                <ContributionTypeIcon type={c.type} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="font-mono text-[9px] text-muted-foreground">
                      {c.repo}#{c.number || "—"}
                    </span>
                    <StatePill state={c.state} />
                  </div>
                  <p className="text-xs text-foreground font-medium line-clamp-2">
                    {c.title}
                  </p>
                  <div className="flex items-center justify-between mt-1.5 text-[10px] text-muted-foreground font-mono">
                    <span>@{c.author}</span>
                    <span>▲ {c.upvotes} · {relativeTime(c.createdAt)}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md md:max-w-lg bg-card border-border/60 overflow-y-auto"
        >
          {active && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2 mb-1">
                  <ContributionTypeIcon type={active.type} />
                  <span className="font-mono text-xs text-muted-foreground">
                    {active.repo}#{active.number || "—"}
                  </span>
                  <StatePill state={active.state} />
                </div>
                <SheetTitle className="text-base text-foreground">
                  {active.title}
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Contribution details for {active.title}
                </SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-4 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Author
                    </div>
                    <div className="font-mono text-foreground">@{active.author}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Repo
                    </div>
                    <div className="font-mono text-foreground">{active.repo}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Created
                    </div>
                    <div className="font-mono text-foreground">
                      {formatDate(active.createdAt)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Updated
                    </div>
                    <div className="font-mono text-foreground">
                      {relativeTime(active.updatedAt)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Comments
                    </div>
                    <div className="font-mono text-foreground">
                      {active.commentsCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Upvotes
                    </div>
                    <div className="font-mono" style={{ color: "var(--vvu-lime)" }}>
                      ▲ {active.upvotes}
                    </div>
                  </div>
                </div>
                <Separator className="bg-border/40" />
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                    Labels
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {active.labels
                      .split(",")
                      .filter(Boolean)
                      .map((l) => (
                        <Badge
                          key={l}
                          variant="secondary"
                          className="font-mono text-[10px] bg-muted/40 text-muted-foreground"
                        >
                          {l}
                        </Badge>
                      ))}
                  </div>
                </div>
                {active.authorEmail && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                      Author email
                    </div>
                    <div className="font-mono text-xs text-foreground">
                      {active.authorEmail}
                    </div>
                  </div>
                )}
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="w-full border-border/60 text-xs"
                >
                  <a
                    href={active.url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="View source on GitHub"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View source
                  </a>
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─── Changelog Tab ─────────────────────────────────────────────────────────

function ChangelogTab() {
  const [items, setItems] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dev/changelog");
        if (!res.ok) throw new Error("changelog fetch failed");
        const data = (await res.json()) as { items: ChangelogEntry[] };
        if (cancelled) return;
        setItems(data.items);
      } catch {
        if (!cancelled) toast.error("Failed to load changelog");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div
        className="absolute left-[7px] top-2 bottom-2 w-px bg-border/60"
        aria-hidden
      />
      <ol className="space-y-4">
        {items.map((entry) => (
          <li key={entry.id} className="relative pl-7">
            {/* Dot */}
            <span
              className="absolute left-0 top-3 h-3.5 w-3.5 rounded-full border-2 border-background"
              style={{ backgroundColor: "var(--vvu-lime)" }}
              aria-hidden
            />
            <Card className="p-5 bg-card/40 border-border/60">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span
                  className="font-mono text-sm font-bold"
                  style={{ color: "var(--vvu-lime)" }}
                >
                  v{entry.version}
                </span>
                <KindPill kind={entry.kind} />
                <span className="text-[10px] text-muted-foreground font-mono ml-auto">
                  {formatDate(entry.publishedAt)}
                </span>
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">
                {entry.title}
              </h3>
              {entry.author && (
                <div className="text-[10px] text-muted-foreground font-mono mb-2">
                  by @{entry.author}
                </div>
              )}
              <Separator className="bg-border/40 mb-3" />
              <div className="text-sm">{renderMarkdown(entry.body)}</div>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ─── Roadmap Tab ───────────────────────────────────────────────────────────

const ROADMAP_MILESTONES: RoadmapMilestone[] = ["Q1", "Q2", "Q3", "Q4", "Backlog"];

function RoadmapCard({ item }: { item: RoadmapItem }) {
  return (
    <Card className="p-3 bg-card/40 border-border/60 hover:border-[var(--vvu-lime)]/40 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-semibold text-foreground leading-tight">
          {item.title}
        </h4>
        <PriorityBadge priority={item.priority} />
      </div>
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <StatusPill status={item.status} />
        {item.assignee && (
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border/60 text-[9px] font-bold"
            style={{
              backgroundColor: "var(--vvu-lime)",
              color: "var(--background)",
            }}
            title={item.assignee}
          >
            {initials(item.assignee)}
          </span>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2.5">
        {item.description}
      </p>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
        <span className="font-mono">Progress</span>
        <span className="font-mono" style={{ color: "var(--vvu-lime)" }}>
          {item.progressPct}%
        </span>
      </div>
      <Progress
        value={item.progressPct}
        className="h-1.5 [&_[data-slot=progress-indicator]]:bg-[var(--vvu-lime)]"
      />
      {item.tags && (
        <div className="flex flex-wrap gap-1 mt-2">
          {item.tags
            .split(",")
            .filter(Boolean)
            .slice(0, 3)
            .map((t) => (
              <Badge
                key={t}
                variant="secondary"
                className="text-[9px] font-mono bg-muted/40 text-muted-foreground"
              >
                {t}
              </Badge>
            ))}
        </div>
      )}
    </Card>
  );
}

function RoadmapTab() {
  const [grouped, setGrouped] = useState<Record<string, RoadmapItem[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dev/roadmap");
        if (!res.ok) throw new Error("roadmap fetch failed");
        const data = (await res.json()) as { milestones: Record<string, RoadmapItem[]> };
        if (cancelled) return;
        setGrouped(data.milestones);
      } catch {
        if (!cancelled) toast.error("Failed to load roadmap");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-64 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex md:grid md:grid-cols-5 gap-3 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
      {ROADMAP_MILESTONES.map((m) => {
        const items = grouped[m] ?? [];
        return (
          <div
            key={m}
            className="min-w-[260px] md:min-w-0 flex-shrink-0 md:flex-shrink"
          >
            <div className="flex items-center justify-between mb-2 sticky top-0">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                {m}
              </h3>
              <Badge
                variant="outline"
                className="font-mono text-[10px] border-border/60 text-muted-foreground"
              >
                {items.length}
              </Badge>
            </div>
            <div className="space-y-2">
              {items.length === 0 ? (
                <Card className="p-3 bg-card/20 border-dashed border-border/40 text-center">
                  <p className="text-[10px] text-muted-foreground">No items</p>
                </Card>
              ) : (
                items.map((item) => <RoadmapCard key={item.id} item={item} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── API Reference Tab ─────────────────────────────────────────────────────

function ApiReferenceTab() {
  const [tryEndpoint, setTryEndpoint] = useState<ApiEndpoint | null>(null);
  const [tryOpen, setTryOpen] = useState(false);
  const [tryRes, setTryRes] = useState<string>("");
  const [tryStatus, setTryStatus] = useState<number | null>(null);
  const [running, setRunning] = useState(false);

  const openTry = (ep: ApiEndpoint) => {
    setTryEndpoint(ep);
    setTryRes("");
    setTryStatus(null);
    setTryOpen(true);
  };

  const runTry = async () => {
    if (!tryEndpoint) return;
    setRunning(true);
    setTryRes("Fetching…");
    setTryStatus(null);
    try {
      const res = await fetch(tryEndpoint.path, { method: tryEndpoint.method });
      setTryStatus(res.status);
      const text = await res.text();
      try {
        setTryRes(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        setTryRes(text.slice(0, 4000) || "(empty body)");
      }
    } catch (e) {
      setTryRes(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRunning(false);
    }
  };

  const copyCurl = () => {
    if (!tryEndpoint) return;
    const cmd = `curl -X ${tryEndpoint.method} ${window.location.origin}${tryEndpoint.path}`;
    void navigator.clipboard.writeText(cmd);
    toast.success("curl command copied");
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-card/40 border-border/60">
        <div className="flex items-center gap-2 mb-1">
          <Terminal className="h-4 w-4" style={{ color: "var(--vvu-lime)" }} />
          <h3 className="text-sm font-semibold text-foreground">
            API Reference
          </h3>
        </div>
        <p className="text-xs text-muted-foreground">
          All endpoints are relative; cross-port requests use{" "}
          <code className="font-mono text-[10px] bg-muted/40 px-1 py-0.5 rounded">
            ?XTransformPort=&lt;port&gt;
          </code>
          .
        </p>
      </Card>

      {API_GROUPS.map((group) => (
        <Card key={group.category} className="p-4 bg-card/40 border-border/60">
          <div className="flex items-center gap-2 mb-3">
            <Hash className="h-3.5 w-3.5" style={{ color: "var(--vvu-ochre)" }} />
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              {group.category}
            </h4>
            <Separator className="flex-1 bg-border/40" />
            <span className="text-[10px] text-muted-foreground font-mono">
              {group.endpoints.length} endpoints
            </span>
          </div>
          <div className="space-y-1.5">
            {group.endpoints.map((ep) => (
              <div
                key={`${ep.method}-${ep.path}`}
                className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/30 transition-colors group"
              >
                <MethodBadge method={ep.method} />
                <code className="font-mono text-xs text-foreground flex-1 min-w-0 truncate">
                  {ep.path}
                </code>
                <span className="text-xs text-muted-foreground hidden sm:inline truncate">
                  {ep.description}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openTry(ep)}
                  className="h-6 text-[10px] border-border/60 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  aria-label={`Try ${ep.method} ${ep.path}`}
                >
                  <Play className="h-2.5 w-2.5" />
                  Try
                </Button>
              </div>
            ))}
          </div>
        </Card>
      ))}

      {/* Try-it Dialog */}
      <Dialog open={tryOpen} onOpenChange={setTryOpen}>
        <DialogContent className="sm:max-w-2xl bg-card border-border/60">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {tryEndpoint && <MethodBadge method={tryEndpoint.method} />}
              <code className="font-mono text-sm text-foreground">
                {tryEndpoint?.path}
              </code>
            </DialogTitle>
            <DialogDescription>
              {tryEndpoint?.description}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                curl command
              </div>
              <div className="flex items-stretch gap-1.5">
                <pre className="flex-1 bg-muted/40 border border-border/40 rounded p-2 text-[10px] font-mono overflow-x-auto text-foreground">
                  <code>
                    {tryEndpoint &&
                      `curl -X ${tryEndpoint.method} ${typeof window !== "undefined" ? window.location.origin : ""}${tryEndpoint.path}`}
                  </code>
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyCurl}
                  className="border-border/60 text-xs"
                  aria-label="Copy curl"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Response
                </div>
                {tryStatus !== null && (
                  <Badge
                    variant="outline"
                    className={cx(
                      "font-mono text-[10px]",
                      tryStatus >= 200 && tryStatus < 300
                        ? "border-[var(--vvu-lime)]/40 text-[color:var(--vvu-lime)]"
                        : "border-[var(--vvu-crimson)]/40 text-[color:var(--vvu-crimson)]",
                    )}
                  >
                    HTTP {tryStatus}
                  </Badge>
                )}
              </div>
              <pre className="bg-muted/40 border border-border/40 rounded p-2 text-[10px] font-mono overflow-auto max-h-72 text-foreground">
                <code>{tryRes || "Click Run to fetch the endpoint."}</code>
              </pre>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTryOpen(false)}
              className="border-border/60 text-xs"
            >
              Close
            </Button>
            <Button
              size="sm"
              onClick={() => void runTry()}
              disabled={running}
              className="text-xs"
              style={{
                backgroundColor: "var(--vvu-lime)",
                color: "var(--background)",
              }}
            >
              {running ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Play className="h-3 w-3" />
              )}
              Run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Status Tab ────────────────────────────────────────────────────────────

function StatusTab({ summary }: { summary: DevSummary | null }) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dev/incidents");
        if (!res.ok) throw new Error("incidents fetch failed");
        const data = (await res.json()) as { items: Incident[] };
        if (cancelled) return;
        setIncidents(data.items);
      } catch {
        if (!cancelled) toast.error("Failed to load incidents");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const status = summary?.systemStatus;
  const operational = status?.operational ?? true;
  const activeCount = status?.activeCount ?? 0;

  return (
    <div className="space-y-4">
      {/* Overall banner */}
      <Card
        className={cx(
          "p-5 border",
          operational
            ? "bg-[var(--vvu-lime)]/5 border-[var(--vvu-lime)]/40"
            : "bg-[var(--vvu-ochre)]/5 border-[var(--vvu-ochre)]/40",
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
            style={{
              backgroundColor: operational
                ? "var(--vvu-lime)"
                : "var(--vvu-ochre)",
              color: "var(--background)",
            }}
          >
            {operational ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <Radio className="h-5 w-5 animate-pulse" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3
              className="text-lg font-bold"
              style={{
                color: operational ? "var(--vvu-lime)" : "var(--vvu-ochre)",
              }}
            >
              {operational
                ? "All systems operational"
                : `${activeCount} incident${activeCount === 1 ? "" : "s"} in progress`}
            </h3>
            <p className="text-xs text-muted-foreground">
              {operational
                ? status?.lastResolvedAt
                  ? `Last resolved ${relativeTime(status.lastResolvedAt)}.`
                  : "No active incidents."
                : `Most severe: ${status?.worstSeverity ?? "UNKNOWN"}`}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.success("Subscribed to status updates")}
            className="border-border/60 text-xs shrink-0"
          >
            <Plus className="h-3 w-3" />
            <span className="hidden sm:inline">Subscribe</span>
          </Button>
        </div>
      </Card>

      {/* Component grid */}
      <Card className="p-4 bg-card/40 border-border/60">
        <h4 className="text-xs font-bold uppercase tracking-wider text-foreground mb-3">
          Components
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {COMPONENT_STATUSES.map((c) => (
            <div
              key={c.name}
              className="flex items-center justify-between p-2.5 rounded border border-border/40 bg-muted/20"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={cx(
                    "h-2 w-2 rounded-full shrink-0",
                    componentDot(c.status),
                  )}
                  aria-hidden
                />
                <span className="text-sm font-medium text-foreground truncate">
                  {c.name}
                </span>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[10px] font-mono text-[color:var(--vvu-lime)]">
                  {c.uptime}
                </div>
                <div className="text-[9px] font-mono text-muted-foreground">
                  {c.latency}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Incident history */}
      <Card className="p-4 bg-card/40 border-border/60">
        <h4 className="text-xs font-bold uppercase tracking-wider text-foreground mb-3">
          Incident history
        </h4>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : incidents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No incidents on record.
          </p>
        ) : (
          <ol className="space-y-3">
            {incidents.map((inc) => (
              <li
                key={inc.id}
                className="relative pl-5 border-l border-border/40 ml-1.5"
              >
                <span
                  className="absolute -left-[5px] top-1 h-2 w-2 rounded-full"
                  style={{
                    backgroundColor:
                      inc.status === "RESOLVED"
                        ? "var(--vvu-lime)"
                        : "var(--vvu-ochre)",
                  }}
                  aria-hidden
                />
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <SeverityPill severity={inc.severity} />
                  <IncidentStatusPill status={inc.status} />
                  <span className="text-[10px] text-muted-foreground font-mono ml-auto">
                    {formatDate(inc.startedAt)}
                  </span>
                </div>
                <h5 className="text-sm font-semibold text-foreground mb-1">
                  {inc.title}
                </h5>
                {inc.affectedComponents && (
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {inc.affectedComponents
                      .split(",")
                      .filter(Boolean)
                      .map((c) => (
                        <Badge
                          key={c}
                          variant="outline"
                          className="font-mono text-[9px] border-border/60 text-muted-foreground"
                        >
                          {c}
                        </Badge>
                      ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mb-1.5">
                  {inc.body}
                </p>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
                  <span>
                    Started {relativeTime(inc.startedAt)}
                  </span>
                  {inc.resolvedAt && (
                    <>
                      <span>→</span>
                      <span>
                        Resolved {relativeTime(inc.resolvedAt)}
                      </span>
                      <Badge
                        variant="outline"
                        className="font-mono text-[9px] border-[var(--vvu-lime)]/40 text-[color:var(--vvu-lime)]"
                      >
                        {durationLabel(inc.startedAt, inc.resolvedAt)}
                      </Badge>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

// ─── Main DevSection ───────────────────────────────────────────────────────

export function DevSection() {
  const [summary, setSummary] = useState<DevSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dev");
        if (!res.ok) throw new Error("dev summary fetch failed");
        const data = (await res.json()) as DevSummary;
        if (cancelled) return;
        setSummary(data);
      } catch {
        if (!cancelled) toast.error("Failed to load dev hub");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      aria-label="Dev workspace"
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
            style={{
              backgroundColor: "var(--vvu-lime)",
              color: "var(--background)",
            }}
          >
            <Terminal className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-foreground">Dev hub</h2>
            <p className="text-xs text-muted-foreground truncate">
              Docs · contributions · changelog · roadmap · API · status
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
          {loading ? (
            <Skeleton className="h-4 w-32" />
          ) : summary ? (
            <>
              <span>
                <span style={{ color: "var(--vvu-lime)" }}>
                  {summary.counts.contributions}
                </span>{" "}
                contribs
              </span>
              <span>·</span>
              <span>
                <span style={{ color: "var(--vvu-ochre)" }}>
                  {summary.counts.changelog}
                </span>{" "}
                releases
              </span>
              <span>·</span>
              <span>
                <span style={{ color: "var(--vvu-teal)" }}>
                  {summary.counts.docs}
                </span>{" "}
                docs
              </span>
            </>
          ) : null}
        </div>
      </div>

      <Tabs defaultValue="docs" className="w-full">
        <TabsList className="bg-muted/50 border border-border/60 h-auto p-1 flex-wrap">
          <TabsTrigger
            value="docs"
            className="data-[state=active]:bg-[var(--vvu-lime)]/10 data-[state=active]:text-[color:var(--vvu-lime)] data-[state=active]:border-[var(--vvu-lime)]/40 text-xs"
          >
            <Book className="h-3.5 w-3.5" />
            Docs
          </TabsTrigger>
          <TabsTrigger
            value="contributions"
            className="data-[state=active]:bg-[var(--vvu-lime)]/10 data-[state=active]:text-[color:var(--vvu-lime)] data-[state=active]:border-[var(--vvu-lime)]/40 text-xs"
          >
            <GitPullRequest className="h-3.5 w-3.5" />
            Contributions
          </TabsTrigger>
          <TabsTrigger
            value="changelog"
            className="data-[state=active]:bg-[var(--vvu-lime)]/10 data-[state=active]:text-[color:var(--vvu-lime)] data-[state=active]:border-[var(--vvu-lime)]/40 text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Changelog
          </TabsTrigger>
          <TabsTrigger
            value="roadmap"
            className="data-[state=active]:bg-[var(--vvu-lime)]/10 data-[state=active]:text-[color:var(--vvu-lime)] data-[state=active]:border-[var(--vvu-lime)]/40 text-xs"
          >
            <Route className="h-3.5 w-3.5" />
            Roadmap
          </TabsTrigger>
          <TabsTrigger
            value="api"
            className="data-[state=active]:bg-[var(--vvu-lime)]/10 data-[state=active]:text-[color:var(--vvu-lime)] data-[state=active]:border-[var(--vvu-lime)]/40 text-xs"
          >
            <Terminal className="h-3.5 w-3.5" />
            API
          </TabsTrigger>
          <TabsTrigger
            value="status"
            className="data-[state=active]:bg-[var(--vvu-lime)]/10 data-[state=active]:text-[color:var(--vvu-lime)] data-[state=active]:border-[var(--vvu-lime)]/40 text-xs"
          >
            <Radio className="h-3.5 w-3.5" />
            Status
          </TabsTrigger>
        </TabsList>

        <TabsContent value="docs" className="mt-4 focus-visible:outline-none">
          <DocsTab />
        </TabsContent>
        <TabsContent value="contributions" className="mt-4 focus-visible:outline-none">
          <ContributionsTab summary={summary} />
        </TabsContent>
        <TabsContent value="changelog" className="mt-4 focus-visible:outline-none">
          <ChangelogTab />
        </TabsContent>
        <TabsContent value="roadmap" className="mt-4 focus-visible:outline-none">
          <RoadmapTab />
        </TabsContent>
        <TabsContent value="api" className="mt-4 focus-visible:outline-none">
          <ApiReferenceTab />
        </TabsContent>
        <TabsContent value="status" className="mt-4 focus-visible:outline-none">
          <StatusTab summary={summary} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
