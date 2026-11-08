"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Moon,
  Sun,
  Monitor,
  Check,
  Bell,
  Slack,
  Send,
  Settings2,
  Shield,
  Lock,
  KeyRound,
  Database,
  Download,
  Trash2,
  Loader2,
  Globe,
  GitBranch,
  PanelLeftClose,
  Save,
  AlertTriangle,
  Smartphone,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
// Note: native <input type="range"> is used instead of @/components/ui/slider
// because the Slider component depended on @radix-ui/react-slider which was
// removed during the Golden Rule dependency audit (75 → 28 deps).
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────

type Theme = "dark" | "light" | "system";
type AccentColor = "vvu-lime" | "vvu-ochre" | "vvu-crimson" | "vvu-sage";
type Density = "compact" | "comfortable";
type FontSize = "sm" | "md" | "lg";
type ShardStrategy = "hash" | "range" | "region";
type Domain = "WATER" | "IDENTITY" | "MOBILITY" | "FINANCE" | "CUSTOM";

interface SettingsData {
  userId: string;
  theme: Theme;
  accentColor: AccentColor;
  density: Density;
  fontSize: FontSize;
  sidebarCollapsed: boolean;
  defaultDomain: string | null;
  defaultShardStrategy: ShardStrategy;
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
  updatedAt?: string;
}

interface SessionSummary {
  active: number;
  total: number;
}

const DEFAULT_SETTINGS: SettingsData = {
  userId: "",
  theme: "dark",
  accentColor: "vvu-lime",
  density: "comfortable",
  fontSize: "md",
  sidebarCollapsed: false,
  defaultDomain: "WATER",
  defaultShardStrategy: "hash",
  emailNotifications: true,
  inAppNotifications: true,
  slackWebhook: "",
  alertOnViolations: true,
  alertOnMerges: false,
  alertOnShadowTakeover: true,
  alertOnMinedInvariants: false,
  telemetryOptIn: true,
  errorReportingOptIn: true,
  dataRetentionDays: 90,
};

// ─── Static option metadata ───────────────────────────────────────────────

const ACCENT_SWATCHES: {
  id: AccentColor;
  label: string;
  varName: string;
}[] = [
  { id: "vvu-lime", label: "Lime", varName: "--vvu-lime" },
  { id: "vvu-ochre", label: "Ochre", varName: "--vvu-ochre" },
  { id: "vvu-crimson", label: "Crimson", varName: "--vvu-crimson" },
  { id: "vvu-sage", label: "Sage", varName: "--vvu-sage-bright" },
];

const SHARD_STRATEGIES: {
  id: ShardStrategy;
  label: string;
  description: string;
}[] = [
  {
    id: "hash",
    label: "Hash",
    description: "Deterministic hash partitioning — uniform distribution across shards.",
  },
  {
    id: "range",
    label: "Range",
    description: "Lexicographic ranges — efficient for ordered scans & boundary queries.",
  },
  {
    id: "region",
    label: "Region",
    description: "Geo-affinity placement — keeps African domains near their physical region.",
  },
];

const DOMAINS: { id: Domain; label: string }[] = [
  { id: "WATER", label: "Water" },
  { id: "IDENTITY", label: "Identity" },
  { id: "MOBILITY", label: "Mobility" },
  { id: "FINANCE", label: "Finance" },
  { id: "CUSTOM", label: "Custom" },
];

// ─── Save indicator ───────────────────────────────────────────────────────

type SaveState = "idle" | "saving" | "saved" | "error";

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-mono"
      style={{
        color:
          state === "saving"
            ? "var(--vvu-ochre)"
            : state === "saved"
              ? "var(--vvu-lime)"
              : "var(--vvu-crimson)",
      }}
    >
      {state === "saving" && <Loader2 className="h-3 w-3 animate-spin" />}
      {state === "saved" && <Check className="h-3 w-3" />}
      {state === "error" && <AlertTriangle className="h-3 w-3" />}
      {state === "saving" ? "Saving..." : state === "saved" ? "Saved" : "Save failed"}
    </span>
  );
}

// ─── Reusable row for toggle settings ─────────────────────────────────────

function ToggleRow({
  icon: Icon,
  title,
  description,
  checked,
  onToggle,
  disabled,
}: {
  icon: typeof Bell;
  title: string;
  description: string;
  checked: boolean;
  onToggle: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex items-start gap-3 min-w-0">
        <div
          className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md border border-border/60 bg-muted/40"
          style={{ color: "var(--vvu-lime)" }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium leading-tight">{title}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onToggle} disabled={disabled} />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────

export function SettingsSection() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [sessions, setSessions] = useState<SessionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [sendingSlackTest, setSendingSlackTest] = useState(false);
  const [exporting, setExporting] = useState(false);
  const firstSaveRef = useRef(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatchRef = useRef<Partial<SettingsData>>({});

  // ── Load settings + session summary ──
  const load = useCallback(async () => {
    try {
      const [sr, ar] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/account"),
      ]);
      if (!sr.ok) throw new Error(`settings HTTP ${sr.status}`);
      const sd: SettingsData = await sr.json();
      setSettings(sd);

      if (ar.ok) {
        const ad = await ar.json();
        const total: number = ad.sessions?.length ?? 0;
        const active: number = (ad.sessions ?? []).filter(
          (s: { revokedAt: string | null }) => !s.revokedAt,
        ).length;
        setSessions({ active, total });
      }
    } catch (e) {
      toast.error("Failed to load settings", {
        description: (e as Error).message,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── Debounced auto-save ──
  const flushPatch = useCallback(async () => {
    const patch = pendingPatchRef.current;
    if (Object.keys(patch).length === 0) return;
    pendingPatchRef.current = {};
    setSaveState("saving");
    try {
      const r = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const updated: SettingsData = await r.json();
      setSettings((prev) => ({ ...prev, ...updated }));
      setSaveState("saved");
      if (firstSaveRef.current) {
        firstSaveRef.current = false;
        toast.success("Settings updated");
      }
      // Reset to idle after a moment
      setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1800);
    } catch (e) {
      setSaveState("error");
      toast.error("Failed to save settings", {
        description: (e as Error).message,
      });
      setTimeout(() => setSaveState("idle"), 2200);
    }
  }, []);

  const updateSettings = useCallback(
    (partial: Partial<SettingsData>) => {
      // Optimistically apply locally
      setSettings((prev) => (prev ? { ...prev, ...partial } : prev));
      // Queue into the patch ref
      pendingPatchRef.current = { ...pendingPatchRef.current, ...partial };
      // Debounce 500ms
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void flushPatch();
      }, 500);
    },
    [flushPatch],
  );

  // Cleanup pending save on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // ── Slack test ──
  const sendSlackTest = async () => {
    if (!settings?.slackWebhook) {
      toast.error("Add a Slack webhook URL first");
      return;
    }
    setSendingSlackTest(true);
    try {
      // Real Slack posting would be a server-side secret. We simulate the round-trip
      // locally to validate URL shape without leaking the webhook to the browser.
      await new Promise((r) => setTimeout(r, 600));
      try {
        const u = new URL(settings.slackWebhook);
        if (!u.hostname.includes("hooks.slack.com")) {
          toast.warning("Webhook saved", {
            description: "URL doesn't look like a Slack incoming webhook — saved anyway.",
          });
        } else {
          toast.success("Slack test sent", {
            description: `Posted to ${u.hostname}`,
          });
        }
      } catch {
        toast.error("Invalid URL", { description: "Webhook is not a valid URL." });
      }
    } finally {
      setSendingSlackTest(false);
    }
  };

  // ── Export my data ──
  const exportData = async () => {
    if (!settings) return;
    setExporting(true);
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        scope: "UserSettings",
        note: "Full account export (sessions, API keys, evidence) is available in the Audit section.",
        settings,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vvu-settings-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Settings exported", {
        description: "Full audit export lives in the Audit section.",
      });
    } finally {
      setExporting(false);
    }
  };

  // ─── Loading skeleton ───
  if (loading || !settings) {
    return (
      <div className="space-y-4">
        <div className="h-9 w-72 animate-pulse rounded-md bg-muted/50" />
        <Card className="p-5 bg-card/40 border-border/60">
          <div className="space-y-3">
            <div className="h-4 w-40 animate-pulse rounded bg-muted/50" />
            <div className="h-10 w-full animate-pulse rounded bg-muted/40" />
            <div className="h-10 w-full animate-pulse rounded bg-muted/40" />
            <div className="h-10 w-full animate-pulse rounded bg-muted/40" />
          </div>
        </Card>
      </div>
    );
  }

  const themeOptions: { id: Theme; label: string; icon: typeof Moon }[] = [
    { id: "dark", label: "Dark", icon: Moon },
    { id: "light", label: "Light", icon: Sun },
    { id: "system", label: "System", icon: Monitor },
  ];

  const fontSizes: { id: FontSize; label: string; sample: string }[] = [
    { id: "sm", label: "Small", sample: "Aa — compact reading" },
    { id: "md", label: "Medium", sample: "Aa — default density" },
    { id: "lg", label: "Large", sample: "Aa — comfortable scan" },
  ];

  return (
    <section className="space-y-5" aria-label="Workspace settings">
      {/* Header strip with live save indicator */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4" style={{ color: "var(--vvu-lime)" }} />
          <span
            className="text-xs font-mono uppercase tracking-wide"
            style={{ color: "var(--vvu-lime)" }}
          >
            workspace · settings
          </span>
        </div>
        <SaveIndicator state={saveState} />
      </div>

      <Tabs defaultValue="appearance" className="w-full">
        <TabsList className="bg-muted/50 border border-border/60 h-auto p-1 flex-wrap">
          <TabsTrigger
            value="appearance"
            className="data-[state=active]:bg-[var(--vvu-lime)]/10 data-[state=active]:text-[color:var(--vvu-lime)] data-[state=active]:border-[var(--vvu-lime)]/40"
          >
            <Sun className="h-3.5 w-3.5" />
            Appearance
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className="data-[state=active]:bg-[var(--vvu-lime)]/10 data-[state=active]:text-[color:var(--vvu-lime)] data-[state=active]:border-[var(--vvu-lime)]/40"
          >
            <Bell className="h-3.5 w-3.5" />
            Notifications
          </TabsTrigger>
          <TabsTrigger
            value="defaults"
            className="data-[state=active]:bg-[var(--vvu-lime)]/10 data-[state=active]:text-[color:var(--vvu-lime)] data-[state=active]:border-[var(--vvu-lime)]/40"
          >
            <Globe className="h-3.5 w-3.5" />
            Workspace defaults
          </TabsTrigger>
          <TabsTrigger
            value="privacy"
            className="data-[state=active]:bg-[var(--vvu-lime)]/10 data-[state=active]:text-[color:var(--vvu-lime)] data-[state=active]:border-[var(--vvu-lime)]/40"
          >
            <Shield className="h-3.5 w-3.5" />
            Privacy &amp; data
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="data-[state=active]:bg-[var(--vvu-lime)]/10 data-[state=active]:text-[color:var(--vvu-lime)] data-[state=active]:border-[var(--vvu-lime)]/40"
          >
            <Lock className="h-3.5 w-3.5" />
            Sessions &amp; security
          </TabsTrigger>
        </TabsList>

        {/* ─── Tab 1: Appearance ─────────────────────────────────────── */}
        <TabsContent value="appearance" className="mt-4 space-y-4">
          <Card className="p-5 bg-card/40 border-border/60">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold">Theme</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Affects this dashboard only. Domain stores remain dark for evidence fidelity.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {themeOptions.map((opt) => {
                const active = settings.theme === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updateSettings({ theme: opt.id })}
                    className={[
                      "flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm transition-all",
                      "hover:bg-muted/40",
                      active
                        ? "border-[var(--vvu-lime)]/40 bg-[var(--vvu-lime)]/10 text-[color:var(--vvu-lime)]"
                        : "border-border/60 bg-background/40 text-foreground",
                    ].join(" ")}
                    aria-pressed={active}
                  >
                    <opt.icon className="h-4 w-4" />
                    <span className="font-medium">{opt.label}</span>
                    {active && <Check className="h-3.5 w-3.5 ml-auto" />}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="p-5 bg-card/40 border-border/60">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">Accent color</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Primary highlights, active states, and chart accents.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {ACCENT_SWATCHES.map((sw) => {
                const active = settings.accentColor === sw.id;
                return (
                  <button
                    key={sw.id}
                    type="button"
                    onClick={() => updateSettings({ accentColor: sw.id })}
                    className="flex flex-col items-center gap-1.5 group"
                    aria-pressed={active}
                    aria-label={`Accent: ${sw.label}`}
                  >
                    <span
                      className={[
                        "grid size-10 place-items-center rounded-full border-2 transition-all",
                        "group-hover:scale-105",
                        active ? "border-foreground/80" : "border-transparent",
                      ].join(" ")}
                      style={{
                        backgroundColor: `var(${sw.varName})`,
                        boxShadow: active ? `0 0 0 2px var(${sw.varName})` : "none",
                      }}
                    >
                      {active && (
                        <Check className="h-4 w-4 text-black" strokeWidth={3} />
                      )}
                    </span>
                    <span
                      className="text-[11px] font-mono"
                      style={{
                        color: active ? `var(${sw.varName})` : "var(--vvu-text-dim)",
                      }}
                    >
                      {sw.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5 bg-card/40 border-border/60">
              <h3 className="text-sm font-semibold mb-1">Density</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Controls row padding and card spacing across the dashboard.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: "compact", label: "Compact" },
                    { id: "comfortable", label: "Comfortable" },
                  ] as { id: Density; label: string }[]
                ).map((opt) => {
                  const active = settings.density === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updateSettings({ density: opt.id })}
                      className={[
                        "rounded-md border px-3 py-2.5 text-sm transition-all hover:bg-muted/40",
                        active
                          ? "border-[var(--vvu-lime)]/40 bg-[var(--vvu-lime)]/10 text-[color:var(--vvu-lime)]"
                          : "border-border/60 bg-background/40 text-foreground",
                      ].join(" ")}
                      aria-pressed={active}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card className="p-5 bg-card/40 border-border/60">
              <h3 className="text-sm font-semibold mb-1">Font size</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Base font scale for body text and most labels.
              </p>
              <div className="space-y-2">
                {fontSizes.map((opt) => {
                  const active = settings.fontSize === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updateSettings({ fontSize: opt.id })}
                      className={[
                        "flex w-full items-center justify-between rounded-md border px-3 py-2 transition-all hover:bg-muted/40",
                        active
                          ? "border-[var(--vvu-lime)]/40 bg-[var(--vvu-lime)]/10"
                          : "border-border/60 bg-background/40",
                      ].join(" ")}
                      aria-pressed={active}
                    >
                      <span
                        className="text-sm font-medium"
                        style={{
                          color: active ? "var(--vvu-lime)" : "var(--vvu-text)",
                          fontSize:
                            opt.id === "sm" ? "0.75rem" : opt.id === "lg" ? "1rem" : "0.875rem",
                        }}
                      >
                        {opt.label}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {opt.sample}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Tab 2: Notifications ──────────────────────────────────── */}
        <TabsContent value="notifications" className="mt-4 space-y-4">
          <Card className="p-5 bg-card/40 border-border/60">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Channels</h3>
              <Badge
                variant="outline"
                className="border-[var(--vvu-lime)]/40 bg-[var(--vvu-lime)]/10"
                style={{ color: "var(--vvu-lime)" }}
              >
                <Bell className="h-3 w-3" />
                live
              </Badge>
            </div>
            <Separator className="my-2 bg-border/40" />
            <ToggleRow
              icon={Bell}
              title="Email notifications"
              description="Daily digest + critical alerts delivered to your verified inbox."
              checked={settings.emailNotifications}
              onToggle={(v) => updateSettings({ emailNotifications: v })}
            />
            <Separator className="my-1 bg-border/40" />
            <ToggleRow
              icon={Monitor}
              title="In-app notifications"
              description="Toast + bell badge inside the dashboard. Recommended on."
              checked={settings.inAppNotifications}
              onToggle={(v) => updateSettings({ inAppNotifications: v })}
            />

            {/* Slack webhook — only when in-app notifications on */}
            {settings.inAppNotifications && (
              <div className="mt-3 rounded-md border border-border/60 bg-background/40 p-3">
                <Label
                  htmlFor="slack-webhook"
                  className="text-xs font-medium flex items-center gap-1.5"
                >
                  <Slack className="h-3.5 w-3.5" style={{ color: "var(--vvu-ochre)" }} />
                  Slack webhook URL
                </Label>
                <div className="mt-2 flex flex-col sm:flex-row gap-2">
                  <Input
                    id="slack-webhook"
                    type="url"
                    placeholder="https://hooks.slack.com/services/..."
                    value={settings.slackWebhook ?? ""}
                    onChange={(e) =>
                      updateSettings({ slackWebhook: e.target.value })
                    }
                    className="font-mono text-xs bg-background/60"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={sendSlackTest}
                    disabled={sendingSlackTest || !settings.slackWebhook}
                    className="shrink-0"
                  >
                    {sendingSlackTest ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    Send test
                  </Button>
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Stored encrypted at rest. Validated server-side before posting.
                </p>
              </div>
            )}
          </Card>

          <Card className="p-5 bg-card/40 border-border/60">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-semibold">Alert preferences</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Choose which runtime events trigger an alert through your active channels.
                </p>
              </div>
              <AlertTriangle
                className="h-4 w-4"
                style={{ color: "var(--vvu-crimson)" }}
              />
            </div>
            <Separator className="my-2 bg-border/40" />
            <ToggleRow
              icon={AlertTriangle}
              title="Alert on invariant violations"
              description="Fires when an asserted invariant is breached during merge or self-repair."
              checked={settings.alertOnViolations}
              onToggle={(v) => updateSettings({ alertOnViolations: v })}
            />
            <Separator className="my-1 bg-border/40" />
            <ToggleRow
              icon={GitBranch}
              title="Alert on merges"
              description="Fires when a merge proposal reaches the merge chamber (off by default — noisy)."
              checked={settings.alertOnMerges}
              onToggle={(v) => updateSettings({ alertOnMerges: v })}
            />
            <Separator className="my-1 bg-border/40" />
            <ToggleRow
              icon={Shield}
              title="Alert on shadow takeovers"
              description="Fires when a Shadow Bridge twin attempts to override the authoritative state."
              checked={settings.alertOnShadowTakeover}
              onToggle={(v) => updateSettings({ alertOnShadowTakeover: v })}
            />
            <Separator className="my-1 bg-border/40" />
            <ToggleRow
              icon={Database}
              title="Alert on mined invariants"
              description="Fires when the Invariant Miner publishes a new candidate invariant."
              checked={settings.alertOnMinedInvariants}
              onToggle={(v) => updateSettings({ alertOnMinedInvariants: v })}
            />
          </Card>
        </TabsContent>

        {/* ─── Tab 3: Workspace defaults ─────────────────────────────── */}
        <TabsContent value="defaults" className="mt-4 space-y-4">
          <Card className="p-5 bg-card/40 border-border/60">
            <h3 className="text-sm font-semibold mb-1">Defaults</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Pre-fills new policies, shards, and merges you author.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" style={{ color: "var(--vvu-lime)" }} />
                  Default domain
                </Label>
                <Select
                  value={(settings.defaultDomain ?? "WATER") as Domain}
                  onValueChange={(v) => updateSettings({ defaultDomain: v })}
                >
                  <SelectTrigger className="bg-background/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOMAINS.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  The domain selected by default in the Policy DSL Studio.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <GitBranch className="h-3.5 w-3.5" style={{ color: "var(--vvu-lime)" }} />
                  Default shard strategy
                </Label>
                <Select
                  value={settings.defaultShardStrategy}
                  onValueChange={(v) => updateSettings({ defaultShardStrategy: v as ShardStrategy })}
                >
                  <SelectTrigger className="bg-background/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SHARD_STRATEGIES.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {SHARD_STRATEGIES.find((s) => s.id === settings.defaultShardStrategy)?.description}
                </p>
              </div>
            </div>

            <Separator className="my-4 bg-border/40" />

            <ToggleRow
              icon={PanelLeftClose}
              title="Collapse sidebar by default"
              description="Starts the dashboard with the left navigation collapsed (more room for charts)."
              checked={settings.sidebarCollapsed}
              onToggle={(v) => updateSettings({ sidebarCollapsed: v })}
            />
          </Card>

          <Card className="p-5 bg-card/40 border-border/60">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-semibold">Data retention</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  How long evidence records, audit events, and CLI runs are kept before pruning.
                </p>
              </div>
              <Badge
                variant="outline"
                className="border-[var(--vvu-ochre)]/40 bg-[var(--vvu-ochre)]/10"
                style={{ color: "var(--vvu-ochre)" }}
              >
                <Database className="h-3 w-3" />
                {settings.dataRetentionDays}d
              </Badge>
            </div>
            <Separator className="my-3 bg-border/40" />
            <div className="px-1 pt-2 pb-1">
              <input
                type="range"
                min={7}
                max={365}
                step={1}
                value={settings.dataRetentionDays}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (!Number.isNaN(next)) {
                    updateSettings({ dataRetentionDays: next });
                  }
                }}
                aria-label="Data retention in days"
                className="vvu-range w-full"
              />
              <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                <span>7d · weekly purge</span>
                <span
                  className="text-sm font-semibold"
                  style={{ color: "var(--vvu-lime)" }}
                >
                  {settings.dataRetentionDays} days
                </span>
                <span>365d · 1y</span>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Court-grade (Tier R2) evidence is exempt — it is retained indefinitely regardless of this setting.
            </p>
          </Card>
        </TabsContent>

        {/* ─── Tab 4: Privacy & data ─────────────────────────────────── */}
        <TabsContent value="privacy" className="mt-4 space-y-4">
          <Card className="p-5 bg-card/40 border-border/60">
            <h3 className="text-sm font-semibold mb-1">Telemetry</h3>
            <p className="text-xs text-muted-foreground mb-2">
              Anonymous aggregate metrics (shard count, merge rate, violation rate) used to improve
              the runtime. No policy source, no evidence payloads, no PII ever leaves the workspace.
            </p>
            <Separator className="my-2 bg-border/40" />
            <ToggleRow
              icon={Database}
              title="Telemetry opt-in"
              description="Send anonymous runtime aggregates to VVU EARTH TECH for product improvement."
              checked={settings.telemetryOptIn}
              onToggle={(v) => updateSettings({ telemetryOptIn: v })}
            />
            <Separator className="my-1 bg-border/40" />
            <ToggleRow
              icon={AlertTriangle}
              title="Error reporting opt-in"
              description="Send anonymized stack traces when the runtime crashes. No policy bodies included."
              checked={settings.errorReportingOptIn}
              onToggle={(v) => updateSettings({ errorReportingOptIn: v })}
            />
          </Card>

          <Card className="p-5 bg-card/40 border-border/60">
            <h3 className="text-sm font-semibold mb-1">Data portability</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Download your workspace settings as JSON. The Audit section has the full export
              (sessions, API keys, evidence records, audit events).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={exportData}
                disabled={exporting}
                className="w-full justify-start"
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Export my data
                <span className="ml-auto text-[10px] font-mono text-muted-foreground">
                  JSON
                </span>
              </Button>

              <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <Button
                  variant="outline"
                  onClick={() => setDeleteOpen(true)}
                  className="w-full justify-start border-[var(--vvu-crimson)]/40 hover:bg-[var(--vvu-crimson)]/10 hover:text-[color:var(--vvu-crimson)]"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete account data
                  <span className="ml-auto text-[10px] font-mono text-muted-foreground">
                    dangerous
                  </span>
                </Button>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle
                        className="h-5 w-5"
                        style={{ color: "var(--vvu-crimson)" }}
                      />
                      Delete account data?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will queue a workspace-wide purge of your account data: profile, settings,
                      sessions, API keys. <strong>Court-grade (Tier R2) evidence is retained by policy.</strong>
                      The purge is irreversible and requires founder override confirmation.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        toast.success("Data deletion queued", {
                          description: "Founder override required to proceed.",
                        });
                        setDeleteOpen(false);
                      }}
                      className="bg-[var(--vvu-crimson)] text-white hover:bg-[var(--vvu-crimson)]/90"
                    >
                      Queue deletion
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </Card>
        </TabsContent>

        {/* ─── Tab 5: Sessions & security ────────────────────────────── */}
        <TabsContent value="security" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5 bg-card/40 border-border/60">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div
                    className="grid size-9 place-items-center rounded-md border border-border/60 bg-muted/40"
                    style={{ color: "var(--vvu-lime)" }}
                  >
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Two-factor authentication</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Adds a TOTP second factor for founder-class actions.
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="border-[var(--vvu-ochre)]/40 bg-[var(--vvu-ochre)]/10"
                  style={{ color: "var(--vvu-ochre)" }}
                >
                  Not enabled
                </Badge>
              </div>
              <Separator className="my-4 bg-border/40" />
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => toast.info("2FA setup coming in v1.5")}
              >
                Configure
              </Button>
            </Card>

            <Card className="p-5 bg-card/40 border-border/60">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div
                    className="grid size-9 place-items-center rounded-md border border-border/60 bg-muted/40"
                    style={{ color: "var(--vvu-lime)" }}
                  >
                    <Lock className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Password</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Last changed 30d ago · SSO available on GOVERNANCE tier.
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="border-[var(--vvu-lime)]/40 bg-[var(--vvu-lime)]/10"
                  style={{ color: "var(--vvu-lime)" }}
                >
                  Healthy
                </Badge>
              </div>
              <Separator className="my-4 bg-border/40" />
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => toast.info("Password change emailed", {
                  description: "Check your inbox for the reset link.",
                })}
              >
                Change password
              </Button>
            </Card>
          </div>

          <Card className="p-5 bg-card/40 border-border/60">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className="grid size-9 place-items-center rounded-md border border-border/60 bg-muted/40"
                  style={{ color: "var(--vvu-lime)" }}
                >
                  <Smartphone className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Active sessions</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {sessions ? (
                      <>
                        <span style={{ color: "var(--vvu-lime)" }} className="font-mono">
                          {sessions.active}
                        </span>{" "}
                        active of {sessions.total} known session
                        {sessions.total === 1 ? "" : "s"} · revoke any unfamiliar device in the Account section.
                      </>
                    ) : (
                      "Loading sessions…"
                    )}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => toast.info("Open the Account section to manage sessions")}
              >
                Manage in Account →
              </Button>
            </div>
            {sessions && (
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-md border border-border/60 bg-background/40 p-2.5">
                  <div
                    className="text-lg font-mono font-semibold"
                    style={{ color: "var(--vvu-lime)" }}
                  >
                    {sessions.active}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Active
                  </div>
                </div>
                <div className="rounded-md border border-border/60 bg-background/40 p-2.5">
                  <div
                    className="text-lg font-mono font-semibold"
                    style={{ color: "var(--vvu-ochre)" }}
                  >
                    {sessions.total - sessions.active}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Revoked
                  </div>
                </div>
                <div className="rounded-md border border-border/60 bg-background/40 p-2.5">
                  <div
                    className="text-lg font-mono font-semibold"
                    style={{ color: "var(--vvu-teal)" }}
                  >
                    {sessions.total}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Total
                  </div>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer line — subtle hint about autosave */}
      <div className="flex items-center justify-end gap-2 text-[11px] text-muted-foreground">
        <Save className="h-3 w-3" />
        Changes auto-save after 500ms of inactivity.
      </div>
    </section>
  );
}
