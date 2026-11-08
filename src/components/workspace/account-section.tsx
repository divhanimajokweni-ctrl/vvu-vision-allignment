"use client";

import { useCallback, useEffect, useState } from "react";
import {
  User as UserIcon,
  KeyRound,
  Building2,
  Monitor,
  Smartphone,
  Terminal as TerminalIcon,
  RefreshCw,
  Copy,
  Check,
  Plus,
  Ban,
  AlertTriangle,
  ShieldCheck,
  Activity,
  GitBranch,
  FlaskConical,
  FileText,
  Clock,
  MapPin,
  Mail,
  ChevronRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────

type Role = "FOUNDER" | "ADMIN" | "OPERATOR" | "VIEWER";
type OrgTier = "GOVERNANCE" | "ENTERPRISE" | "PRO" | "OPEN_SOURCE";

interface AccountUser {
  id: string;
  email: string;
  displayName: string;
  avatarColor: string;
  role: Role;
  orgName: string;
  orgTier: OrgTier;
  publicKey: string | null;
  keyFingerprint: string | null;
  bio: string | null;
  title: string | null;
  location: string | null;
  timezone: string;
  locale: string;
  lastLoginAt: string | null;
  createdAt: string;
}

interface AccountSettings {
  userId: string;
  theme: string;
  accentColor: string;
  density: string;
  fontSize: string;
  sidebarCollapsed: boolean;
  defaultDomain: string | null;
  defaultShardStrategy: string;
  emailNotifications: boolean;
  inAppNotifications: boolean;
  slackWebhook: string | null;
  alertOnViolations: boolean;
  alertOnMerges: boolean;
  alertOnShadowTakeover: boolean;
  alertOnMinedInvariants: boolean;
  telemetryOptIn: boolean;
  errorReportingOptIn: boolean;
  dataRetentionDays: number;
}

interface AccountSession {
  id: string;
  label: string;
  userAgent: string | null;
  lastSeenAt: string;
  createdAt: string;
  revokedAt: string | null;
}

interface AccountApiKey {
  id: string;
  label: string;
  keyHint: string;
  scopes: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

interface AccountActivity {
  policies: number;
  merges: number;
  evidence: number;
  recentInvoices: {
    number: string;
    totalZAR: number;
    status: string;
    issuedAt: string;
  }[];
}

interface AccountData {
  user: AccountUser;
  settings: AccountSettings | null;
  sessions: AccountSession[];
  apiKeys: AccountApiKey[];
  activity: AccountActivity;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
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

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Parse a user agent into a small browser/os label. */
function parseUserAgent(ua: string | null): { browser: string; os: string; icon: typeof Monitor } {
  if (!ua) return { browser: "Unknown", os: "Unknown", icon: Monitor };
  const lower = ua.toLowerCase();
  let icon: typeof Monitor = Monitor;
  if (lower.includes("iphone") || lower.includes("android") || lower.includes("mobile")) {
    icon = Smartphone;
  } else if (lower.includes("epd-cli") || lower.includes("bun/") || lower.includes("curl")) {
    icon = TerminalIcon;
  }
  let browser = "Unknown";
  if (lower.includes("chrome")) browser = "Chrome";
  else if (lower.includes("safari")) browser = "Safari";
  else if (lower.includes("firefox")) browser = "Firefox";
  else if (lower.includes("epd-cli")) browser = "epd-cli";
  else if (lower.includes("curl")) browser = "curl";
  let os = "Unknown";
  if (lower.includes("iphone")) os = "iOS";
  else if (lower.includes("android")) os = "Android";
  else if (lower.includes("linux")) os = "Linux";
  else if (lower.includes("mac os") || lower.includes("macos")) os = "macOS";
  else if (lower.includes("windows")) os = "Windows";
  else if (lower.includes("bun/")) os = "Bun runtime";
  return { browser, os, icon };
}

function sessionStatus(s: AccountSession): { label: string; tone: "active" | "revoked" } {
  if (s.revokedAt) return { label: "Revoked", tone: "revoked" };
  return { label: "Active", tone: "active" };
}

function apiKeyStatus(k: AccountApiKey): {
  label: string;
  tone: "active" | "revoked" | "expired";
} {
  if (k.revokedAt) return { label: "Revoked", tone: "revoked" };
  if (k.expiresAt && new Date(k.expiresAt).getTime() < Date.now()) {
    return { label: "Expired", tone: "expired" };
  }
  return { label: "Active", tone: "active" };
}

function invoiceStatusTone(status: string): string {
  switch (status) {
    case "PAID":
      return "border-verified/30 bg-verified/10 text-verified";
    case "OVERDUE":
      return "border-violating/30 bg-violating/10 text-violating";
    case "SENT":
      return "border-repairing/30 bg-repairing/10 text-repairing";
    case "DRAFT":
      return "border-border bg-muted text-muted-foreground";
    case "VOID":
      return "border-border bg-muted text-muted-foreground line-through";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

const TIMEZONES = [
  "Africa/Johannesburg",
  "Africa/Cairo",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Singapore",
  "UTC",
];

const LOCALES = ["en-ZA", "en-GB", "en-US", "af-ZA", "zu-ZA", "xh-ZA", "fr-FR", "de-DE"];

const AVATAR_SWATCHES: { name: string; value: string }[] = [
  { name: "lime", value: "#c8ff00" },
  { name: "sage", value: "#8fb35a" },
  { name: "ochre", value: "#f3e38a" },
  { name: "amber", value: "#e0a030" },
  { name: "teal", value: "#2ea8a0" },
  { name: "crimson", value: "#e5484d" },
];

const GOVERNANCE_FEATURES = [
  "Constitutional governance console",
  "Ed25519 license validation (full)",
  "All 14 feature gates unlocked",
  "Unlimited shards & policies",
  "Court-grade (Tier R2) evidence",
  "Custom retention & residency",
];

// ─── Component ────────────────────────────────────────────────────────────

export function AccountSection() {
  const [data, setData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [rotatingKey, setRotatingKey] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [createKeyOpen, setCreateKeyOpen] = useState(false);
  const [newKeyPlaintext, setNewKeyPlaintext] = useState<string | null>(null);
  const [creatingKey, setCreatingKey] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Edit form state
  const [form, setForm] = useState({
    displayName: "",
    title: "",
    location: "",
    bio: "",
    timezone: "Africa/Johannesburg",
    locale: "en-ZA",
    avatarColor: "#c8ff00",
  });

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/account");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d: AccountData = await r.json();
      setData(d);
      setForm({
        displayName: d.user.displayName ?? "",
        title: d.user.title ?? "",
        location: d.user.location ?? "",
        bio: d.user.bio ?? "",
        timezone: d.user.timezone ?? "Africa/Johannesburg",
        locale: d.user.locale ?? "en-ZA",
        avatarColor: d.user.avatarColor ?? "#c8ff00",
      });
    } catch (e) {
      toast.error("Failed to load account", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Clipboard unavailable");
    }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const r = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: form.displayName,
          title: form.title,
          location: form.location,
          bio: form.bio,
          timezone: form.timezone,
          locale: form.locale,
          avatarColor: form.avatarColor,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast.success("Profile updated");
      setEditOpen(false);
      await load();
    } catch (e) {
      toast.error("Update failed", { description: (e as Error).message });
    } finally {
      setSavingProfile(false);
    }
  };

  const rotateKey = async () => {
    setRotatingKey(true);
    try {
      const r = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rotateKey: true }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast.success("Ed25519 key rotated", {
        description: "Previous signatures remain valid; new evidence uses the new key.",
      });
      setRotateOpen(false);
      await load();
    } catch (e) {
      toast.error("Rotation failed", { description: (e as Error).message });
    } finally {
      setRotatingKey(false);
    }
  };

  const createApiKey = async (label: string, scopes: string) => {
    setCreatingKey(true);
    try {
      const r = await fetch("/api/account/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, scopes }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as { plaintext: string };
      setNewKeyPlaintext(j.plaintext);
      toast.success("API key created", {
        description: "Copy the plaintext now — it won't be shown again.",
      });
      await load();
    } catch (e) {
      toast.error("Failed to create key", { description: (e as Error).message });
    } finally {
      setCreatingKey(false);
    }
  };

  const revokeApiKey = async (id: string) => {
    setRevokingId(id);
    try {
      const r = await fetch(`/api/account/api-keys/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast.success("API key revoked");
      await load();
    } catch (e) {
      toast.error("Revoke failed", { description: (e as Error).message });
    } finally {
      setRevokingId(null);
    }
  };

  const revokeSession = async (id: string) => {
    setRevokingId(id);
    try {
      const r = await fetch(`/api/account/sessions/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast.success("Session revoked");
      await load();
    } catch (e) {
      toast.error("Revoke failed", { description: (e as Error).message });
    } finally {
      setRevokingId(null);
    }
  };

  // ─── Loading skeleton ───────────────────────────────────────────────────
  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-64 lg:col-span-2 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-48 lg:col-span-2 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  const u = data.user;
  const initials2 = initials(u.displayName);

  return (
    <section className="space-y-4">
      {/* ─── Profile header ──────────────────────────────────────────────── */}
      <Card className="p-5 bg-card/40 border-border/60 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-fine opacity-20 pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-start gap-4">
          {/* Avatar */}
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 font-bold text-xl"
            style={{
              backgroundColor: u.avatarColor,
              color: "#060806",
              borderColor: "var(--vvu-lime)",
            }}
            aria-label={`${u.displayName} avatar`}
          >
            {initials2}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight">{u.displayName}</h2>
              <Badge
                variant="outline"
                className="border-verified/30 bg-[var(--vvu-lime)]/10 text-verified text-[10px] font-mono uppercase"
              >
                <ShieldCheck className="h-3 w-3" /> {u.role}
              </Badge>
              <Badge
                variant="outline"
                className="border-quarantined/30 bg-[var(--vvu-amber)]/10 text-quarantined text-[10px] font-mono uppercase"
              >
                Founder-owned
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {u.title && (
                <span className="inline-flex items-center gap-1">
                  <UserIcon className="h-3 w-3" /> {u.title}
                </span>
              )}
              {u.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {u.location}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3 w-3" /> {u.email}
              </span>
            </div>
            {u.bio && (
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{u.bio}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground font-mono">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                last login:{" "}
                <span className="text-foreground">{relativeTime(u.lastLoginAt)}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarIcon />
                member since:{" "}
                <span className="text-foreground">{formatDate(u.createdAt)}</span>
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="shrink-0 hover:border-verified/40 hover:text-verified"
            onClick={() => setEditOpen(true)}
          >
            <UserIcon className="h-3.5 w-3.5" /> Edit profile
          </Button>
        </div>
      </Card>

      {/* ─── Row 1: Identity & keys | Organization ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Identity & keys (col-span-2) */}
        <Card className="p-5 bg-card/40 border-border/60 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound className="h-4 w-4" style={{ color: "var(--vvu-lime)" }} />
            <h3 className="text-sm font-semibold">Identity &amp; keys</h3>
            <span className="ml-auto text-[10px] text-muted-foreground font-mono">
              Ed25519 · sha256 fingerprint
            </span>
          </div>

          {/* Public key block */}
          <div className="rounded-md border border-border/40 bg-background/40 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Public key (hex)
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-2 hover:bg-verified/10 hover:text-verified"
                onClick={() => copy("Public key", u.publicKey ?? "")}
                aria-label="Copy public key"
              >
                {copied === "Public key" ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                copy
              </Button>
            </div>
            <code className="block font-mono text-xs text-verified/90 break-all leading-relaxed">
              {u.publicKey ?? "—"}
            </code>
            <Separator className="my-3 bg-border/40" />
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
                  Fingerprint
                </div>
                <code className="font-mono text-xs" style={{ color: "var(--vvu-ochre)" }}>
                  {u.keyFingerprint ?? "—"}
                </code>
              </div>
              <AlertDialog open={rotateOpen} onOpenChange={setRotateOpen}>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto h-7 text-[11px] hover:border-violating/40 hover:text-violating"
                  onClick={() => setRotateOpen(true)}
                >
                  <RefreshCw className="h-3 w-3" /> Rotate key
                </Button>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle
                        className="h-4 w-4"
                        style={{ color: "var(--vvu-crimson)" }}
                      />
                      Rotate Ed25519 key?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will invalidate all signed evidence going forward. Previous
                      signatures remain verifiable against the old key. The new key will
                      be used for every subsequent commit, merge proposal, and shadow
                      takeover. Continue?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={rotatingKey}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={rotatingKey}
                      onClick={(e) => {
                        e.preventDefault();
                        rotateKey();
                      }}
                      className="bg-destructive text-white hover:bg-destructive/90"
                    >
                      {rotatingKey ? (
                        <>
                          <RefreshCw className="h-3 w-3 animate-spin" /> Rotating…
                        </>
                      ) : (
                        "Rotate key"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {/* API keys table */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                API keys ({data.apiKeys.length})
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] hover:border-verified/40 hover:text-verified"
                onClick={() => {
                  setNewKeyPlaintext(null);
                  setCreateKeyOpen(true);
                }}
              >
                <Plus className="h-3 w-3" /> Create new key
              </Button>
            </div>
            <div className="rounded-md border border-border/40 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40 hover:bg-transparent">
                    <TableHead className="text-[10px] uppercase text-muted-foreground h-8">
                      Label
                    </TableHead>
                    <TableHead className="text-[10px] uppercase text-muted-foreground h-8">
                      Key
                    </TableHead>
                    <TableHead className="text-[10px] uppercase text-muted-foreground h-8">
                      Scopes
                    </TableHead>
                    <TableHead className="text-[10px] uppercase text-muted-foreground h-8">
                      Last used
                    </TableHead>
                    <TableHead className="text-[10px] uppercase text-muted-foreground h-8">
                      Status
                    </TableHead>
                    <TableHead className="text-[10px] uppercase text-muted-foreground h-8 text-right">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.apiKeys.length === 0 && (
                    <TableRow className="border-border/40">
                      <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-6">
                        No API keys yet
                      </TableCell>
                    </TableRow>
                  )}
                  {data.apiKeys.map((k) => {
                    const st = apiKeyStatus(k);
                    return (
                      <TableRow key={k.id} className="border-border/40">
                        <TableCell className="text-xs font-medium py-2">{k.label}</TableCell>
                        <TableCell className="py-2">
                          <code className="font-mono text-xs text-muted-foreground">
                            {k.keyHint}••••
                          </code>
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="flex flex-wrap gap-1">
                            {k.scopes.split(",").map((s) => (
                              <Badge
                                key={s}
                                variant="outline"
                                className="text-[9px] font-mono border-border/40 text-muted-foreground"
                              >
                                {s.trim()}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="py-2 font-mono text-[11px] text-muted-foreground">
                          {relativeTime(k.lastUsedAt)}
                        </TableCell>
                        <TableCell className="py-2">
                          <span
                            className={
                              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium " +
                              (st.tone === "active"
                                ? "border-verified/30 bg-[var(--vvu-lime)]/10 text-verified"
                                : st.tone === "revoked"
                                  ? "border-violating/30 bg-violating/10 text-violating"
                                  : "border-quarantined/30 bg-[var(--vvu-amber)]/10 text-quarantined")
                            }
                          >
                            {st.label}
                          </span>
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[11px] hover:bg-violating/10 hover:text-violating disabled:opacity-50"
                            disabled={!!k.revokedAt || revokingId === k.id}
                            onClick={() => revokeApiKey(k.id)}
                            aria-label={`Revoke API key ${k.label}`}
                          >
                            {revokingId === k.id ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <Ban className="h-3 w-3" />
                            )}
                            Revoke
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </Card>

        {/* Organization */}
        <Card className="p-5 bg-card/40 border-border/60">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-4 w-4" style={{ color: "var(--vvu-lime)" }} />
            <h3 className="text-sm font-semibold">Organization</h3>
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Organization
              </div>
              <div className="text-sm font-semibold">{u.orgName}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Tier
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant="outline"
                  className="border-quarantined/30 bg-[var(--vvu-amber)]/10 text-quarantined font-mono"
                >
                  {u.orgTier}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-verified/30 bg-[var(--vvu-lime)]/10 text-verified text-[10px] font-mono uppercase"
                >
                  Founder-owned
                </Badge>
              </div>
            </div>

            <Separator className="bg-border/40" />

            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
                Tier features (GOVERNANCE)
              </div>
              <ul className="space-y-1">
                {GOVERNANCE_FEATURES.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-1.5 text-[11px] text-foreground/90"
                  >
                    <Check
                      className="h-3 w-3 mt-0.5 shrink-0"
                      style={{ color: "var(--vvu-lime)" }}
                    />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Separator className="bg-border/40" />

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Seat usage
                </span>
                <span className="font-mono text-xs text-foreground">1 / 1</span>
              </div>
              <Progress
                value={100}
                className="h-2 bg-muted"
                style={
                  {
                    "--primary": "var(--vvu-lime)",
                  } as React.CSSProperties
                }
              />
              <p className="mt-1 text-[10px] text-muted-foreground font-mono">
                Founder seat · single-tenant runtime
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* ─── Row 2: Active sessions | Account activity ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Active sessions (col-span-2) */}
        <Card className="p-5 bg-card/40 border-border/60 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Monitor className="h-4 w-4" style={{ color: "var(--vvu-lime)" }} />
            <h3 className="text-sm font-semibold">Active sessions</h3>
            <span className="ml-auto text-[10px] text-muted-foreground font-mono">
              {data.sessions.filter((s) => !s.revokedAt).length} active ·{" "}
              {data.sessions.length} total
            </span>
          </div>
          <div className="rounded-md border border-border/40 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border/40 hover:bg-transparent">
                  <TableHead className="text-[10px] uppercase text-muted-foreground h-8">
                    Session
                  </TableHead>
                  <TableHead className="text-[10px] uppercase text-muted-foreground h-8">
                    Browser · OS
                  </TableHead>
                  <TableHead className="text-[10px] uppercase text-muted-foreground h-8">
                    Last seen
                  </TableHead>
                  <TableHead className="text-[10px] uppercase text-muted-foreground h-8">
                    Status
                  </TableHead>
                  <TableHead className="text-[10px] uppercase text-muted-foreground h-8 text-right">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.sessions.length === 0 && (
                  <TableRow className="border-border/40">
                    <TableCell
                      colSpan={5}
                      className="text-center text-xs text-muted-foreground py-6"
                    >
                      No sessions
                    </TableCell>
                  </TableRow>
                )}
                {data.sessions.map((s) => {
                  const st = sessionStatus(s);
                  const ua = parseUserAgent(s.userAgent);
                  const UaIcon = ua.icon;
                  return (
                    <TableRow key={s.id} className="border-border/40">
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          <UaIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs font-medium truncate max-w-[180px]">
                            {s.label}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 font-mono text-[11px] text-muted-foreground">
                        {ua.browser} · {ua.os}
                      </TableCell>
                      <TableCell className="py-2 font-mono text-[11px] text-muted-foreground">
                        {relativeTime(s.lastSeenAt)}
                      </TableCell>
                      <TableCell className="py-2">
                        <span
                          className={
                            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium " +
                            (st.tone === "active"
                              ? "border-verified/30 bg-[var(--vvu-lime)]/10 text-verified"
                              : "border-violating/30 bg-violating/10 text-violating")
                          }
                        >
                          {st.label}
                        </span>
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[11px] hover:bg-violating/10 hover:text-violating disabled:opacity-50"
                          disabled={!!s.revokedAt || revokingId === s.id}
                          onClick={() => revokeSession(s.id)}
                          aria-label={`Revoke session ${s.label}`}
                        >
                          {revokingId === s.id ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <Ban className="h-3 w-3" />
                          )}
                          Revoke
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Account activity */}
        <Card className="p-5 bg-card/40 border-border/60">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4" style={{ color: "var(--vvu-lime)" }} />
            <h3 className="text-sm font-semibold">Account activity</h3>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <ActivityTile
              icon={FileText}
              label="Policies authored"
              value={data.activity.policies}
            />
            <ActivityTile
              icon={GitBranch}
              label="Merges proposed"
              value={data.activity.merges}
            />
            <ActivityTile
              icon={FlaskConical}
              label="Evidence witnessed"
              value={data.activity.evidence}
            />
          </div>
          <Separator className="bg-border/40 mb-3" />
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
            Recent invoices
          </div>
          <ul className="space-y-1.5 max-h-56 overflow-y-auto scrollbar-thin">
            {data.activity.recentInvoices.length === 0 && (
              <li className="text-[11px] text-muted-foreground italic">No invoices yet</li>
            )}
            {data.activity.recentInvoices.map((inv) => (
              <li
                key={inv.number}
                className="flex items-center gap-2 rounded border border-border/40 bg-background/40 px-2 py-1.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-[11px] font-medium">{inv.number}</code>
                    <span
                      className={
                        "inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-medium " +
                        invoiceStatusTone(inv.status)
                      }
                    >
                      {inv.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                    {formatDate(inv.issuedAt)}
                  </div>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-xs font-semibold tabular-nums">
                    R{inv.totalZAR.toLocaleString("en-ZA")}
                  </div>
                  <div className="text-[9px] text-muted-foreground font-mono">ZAR · incl. VAT</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* ─── Edit profile dialog ───────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>
              Update your display name, location, identity preferences, and avatar accent.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="displayName" className="text-xs">
                Display name
              </Label>
              <Input
                id="displayName"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-xs">
                Title
              </Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="h-9 text-sm"
                placeholder="Founder · Principal Architect"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location" className="text-xs">
                Location
              </Label>
              <Input
                id="location"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="h-9 text-sm"
                placeholder="Gqeberha, South Africa"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bio" className="text-xs">
                Bio
              </Label>
              <Textarea
                id="bio"
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                className="text-sm min-h-[72px]"
                placeholder="A short biography"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Timezone</Label>
                <Select
                  value={form.timezone}
                  onValueChange={(v) => setForm({ ...form, timezone: v })}
                >
                  <SelectTrigger className="h-9 text-xs w-full">
                    <SelectValue placeholder="Timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz} className="text-xs">
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Locale</Label>
                <Select
                  value={form.locale}
                  onValueChange={(v) => setForm({ ...form, locale: v })}
                >
                  <SelectTrigger className="h-9 text-xs w-full">
                    <SelectValue placeholder="Locale" />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCALES.map((l) => (
                      <SelectItem key={l} value={l} className="text-xs">
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Avatar accent</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {AVATAR_SWATCHES.map((s) => {
                  const selected = form.avatarColor.toLowerCase() === s.value.toLowerCase();
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setForm({ ...form, avatarColor: s.value })}
                      aria-label={`Avatar color ${s.name}`}
                      aria-pressed={selected}
                      className={
                        "h-7 w-7 rounded-full border-2 transition-all " +
                        (selected
                          ? "ring-2 ring-offset-2 ring-offset-background scale-110"
                          : "hover:scale-105")
                      }
                      style={{
                        backgroundColor: s.value,
                        borderColor: selected ? "var(--vvu-lime)" : "transparent",
                        // @ts-expect-error CSS var
                        "--tw-ring-color": "var(--vvu-lime)",
                      }}
                    >
                      {selected && (
                        <Check
                          className="h-3.5 w-3.5 mx-auto"
                          style={{ color: "#060806" }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditOpen(false)}
              disabled={savingProfile}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={saveProfile}
              disabled={savingProfile}
              className="bg-[var(--vvu-lime)] text-[#060806] hover:bg-[var(--vvu-lime)]/90"
            >
              {savingProfile ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Check className="h-3 w-3" /> Save changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Create API key dialog ─────────────────────────────────────── */}
      <CreateApiKeyDialog
        open={createKeyOpen}
        onOpenChange={setCreateKeyOpen}
        creating={creatingKey}
        onCreate={createApiKey}
        plaintext={newKeyPlaintext}
        onCopyPlaintext={() => {
          if (newKeyPlaintext) copy("API key", newKeyPlaintext);
        }}
        copied={copied === "API key"}
        onClosePlaintext={() => {
          setNewKeyPlaintext(null);
          setCreateKeyOpen(false);
        }}
      />
    </section>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────

function ActivityTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FileText;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-md border border-border/40 bg-background/40 p-2 text-center">
      <Icon
        className="h-3.5 w-3.5 mx-auto mb-1"
        style={{ color: "var(--vvu-lime)" }}
      />
      <div className="text-lg font-semibold tabular-nums leading-none">{value}</div>
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground mt-1 leading-tight">
        {label}
      </div>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3 w-3"
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18M8 2v4M16 2v4" />
    </svg>
  );
}

function CreateApiKeyDialog({
  open,
  onOpenChange,
  creating,
  onCreate,
  plaintext,
  onCopyPlaintext,
  copied,
  onClosePlaintext,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  creating: boolean;
  onCreate: (label: string, scopes: string) => void;
  plaintext: string | null;
  onCopyPlaintext: () => void;
  copied: boolean;
  onClosePlaintext: () => void;
}) {
  const [label, setLabel] = useState("");
  const [scopes, setScopes] = useState("read");

  const handleOpenChange = (next: boolean) => {
    if (next) {
      // reset form when opening
      setLabel("");
      setScopes("read");
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {plaintext ? "API key created" : "Create new API key"}
          </DialogTitle>
          <DialogDescription>
            {plaintext
              ? "Copy the plaintext now — it won't be shown again."
              : "Generate a new programmatic key. The plaintext is returned once; we store only its sha256 hash."}
          </DialogDescription>
        </DialogHeader>

        {plaintext ? (
          <div className="space-y-3">
            <div className="rounded-md border border-[var(--vvu-ochre)]/40 bg-[var(--vvu-ochre)]/5 p-3">
              <div className="flex items-center gap-2 text-[11px] font-medium mb-2" style={{ color: "var(--vvu-ochre)" }}>
                <AlertTriangle className="h-3.5 w-3.5" />
                Copy now — won&apos;t show again
              </div>
              <code className="block font-mono text-xs text-foreground break-all leading-relaxed">
                {plaintext}
              </code>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs hover:border-verified/40 hover:text-verified"
                onClick={onCopyPlaintext}
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy plaintext"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs ml-auto"
                onClick={onClosePlaintext}
              >
                <ChevronRight className="h-3 w-3" /> Done
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="key-label" className="text-xs">
                  Label
                </Label>
                <Input
                  id="key-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="h-9 text-sm"
                  placeholder="Production dashboard"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Scopes</Label>
                <Select value={scopes} onValueChange={setScopes}>
                  <SelectTrigger className="h-9 text-xs w-full">
                    <SelectValue placeholder="Scopes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="read" className="text-xs">
                      read
                    </SelectItem>
                    <SelectItem value="read,write" className="text-xs">
                      read, write
                    </SelectItem>
                    <SelectItem value="read,write,admin" className="text-xs">
                      read, write, admin
                    </SelectItem>
                    <SelectItem value="write" className="text-xs">
                      write only
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => onCreate(label.trim() || "New API key", scopes)}
                disabled={creating || !label.trim()}
                className="bg-[var(--vvu-lime)] text-[#060806] hover:bg-[var(--vvu-lime)]/90"
              >
                {creating ? (
                  <>
                    <RefreshCw className="h-3 w-3 animate-spin" /> Generating…
                  </>
                ) : (
                  <>
                    <Plus className="h-3 w-3" /> Generate key
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
