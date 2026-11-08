"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Banknote,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  Landmark,
  Loader2,
  Receipt,
  Sparkles,
  TrendingUp,
  Wallet,
  XCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
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

// ─── Types ─────────────────────────────────────────────────────────────────

type TierKey = "phone" | "vehicle" | "fleet" | "dma" | "water";
type SubStatus = "ACTIVE" | "TRIALING" | "CANCELLED";
type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "VOID";

interface Subscription {
  id: string;
  tierKey: TierKey;
  tierLabel: string;
  priceZAR: number;
  cadence: string;
  customerName: string;
  customerEmail: string;
  deviceExternalId: string | null;
  status: SubStatus;
  startDate: string;
  cancelledAt: string | null;
  createdAt: string;
}

interface LineItem {
  description: string;
  amount: number;
}

interface Invoice {
  id: string;
  subscriptionId: string | null;
  number: string;
  customerName: string;
  customerEmail: string;
  amountZAR: number;
  taxZAR: number;
  totalZAR: number;
  status: InvoiceStatus;
  issuedAt: string;
  dueAt: string | null;
  paidAt: string | null;
  lineItems: string; // JSON array of LineItem
  pdfPath: string | null;
}

interface SubStats {
  total: number;
  active: number;
  trialing: number;
  cancelled: number;
  mrr: number;
  arr: number;
  ltv: number;
}

interface SubscriptionData {
  subscriptions: Subscription[];
  invoices: Invoice[];
  stats: SubStats;
}

// ─── Tier catalogue (mirrors the API route + seed) ─────────────────────────

interface TierCard {
  key: TierKey;
  label: string;
  price: number;
  cadence: string;
  bestFor: string;
  features: string[];
  icon: typeof Wallet;
}

const TIERS: TierCard[] = [
  {
    key: "phone",
    label: "Phone Backup",
    price: 9,
    cadence: "per user / mo",
    bestFor: "Individuals & field crews who need a tamper-evident backup of phone-collected evidence.",
    features: [
      "1 phone · BLE-POD pairing",
      "WORM-chain custody (Tier R1)",
      "30-day evidence retention",
      "Email support",
    ],
    icon: Wallet,
  },
  {
    key: "vehicle",
    label: "Vehicle Tracker",
    price: 49,
    cadence: "per mo",
    bestFor: "Owner-operators tracking a single vehicle with OBD-VIN signed telemetry.",
    features: [
      "1 vehicle · OBD-VIN signing",
      "Tier R1 + R2 witness attach",
      "90-day evidence retention",
      "Geofence alerts",
    ],
    icon: Activity,
  },
  {
    key: "fleet",
    label: "Fleet Mobility",
    price: 199,
    cadence: "per mo",
    bestFor: "Small-to-mid fleets (up to 50 vehicles) needing aggregate mobility analytics.",
    features: [
      "Up to 50 vehicles",
      "Fleet dashboard + API",
      "Tier R2 court-grade evidence",
      "Webhook + Slack alerts",
    ],
    icon: TrendingUp,
  },
  {
    key: "dma",
    label: "DMA Water Custodian",
    price: 4999,
    cadence: "per mo",
    bestFor: "District Metered Area custodians running continuous water-loss detection.",
    features: [
      "1 DMA zone · unlimited sensors",
      "Continuous NRW analytics",
      "Tier R2 evidence + audit packs",
      "24/7 founder-direct line",
    ],
    icon: Landmark,
  },
  {
    key: "water",
    label: "Water Infrastructure · DMA",
    price: 9999,
    cadence: "90 days",
    bestFor: "Municipal-scale water infrastructure with full digital-twin and shadow-bridge access.",
    features: [
      "Multi-DMA + SCADA integration",
      "CityTwin3D + Shadow Bridge",
      "Court-grade audit packs (R2)",
      "Founding-tier SLA · 99.95%",
    ],
    icon: Sparkles,
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatZAR(n: number): string {
  // Format like "R 9 999" — space-separated thousands, no decimals, ZA-style.
  const rounded = Math.round(n);
  const withSpaces = rounded
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `R ${withSpaces}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Compute the next renewal date from a startDate + cadence.
// "per mo" / "per user / mo" → 30 days. "90 days" → 90 days. Other → 30 days default.
function nextRenewal(startDate: string, cadence: string): Date {
  const start = new Date(startDate).getTime();
  const days = cadence.includes("90 days") ? 90 : 30;
  // Find the next renewal in the future by stepping forward in cadence-sized increments.
  const stepMs = days * 86400000;
  let next = start + stepMs;
  const now = Date.now();
  while (next < now) next += stepMs;
  return new Date(next);
}

function daysUntil(date: Date): number {
  return Math.max(
    0,
    Math.ceil((date.getTime() - Date.now()) / 86400000)
  );
}

// Status pill classes — green for ACTIVE, ochre for TRIALING, red for CANCELLED.
function subStatusPill(status: SubStatus): { label: string; className: string } {
  switch (status) {
    case "ACTIVE":
      return {
        label: "Active",
        className:
          "border-[var(--vvu-lime)]/40 bg-[var(--vvu-lime)]/10 text-[color:var(--vvu-lime)]",
      };
    case "TRIALING":
      return {
        label: "Trialing",
        className:
          "border-[var(--vvu-ochre)]/40 bg-[var(--vvu-ochre)]/10 text-[color:var(--vvu-ochre)]",
      };
    case "CANCELLED":
      return {
        label: "Cancelled",
        className:
          "border-[var(--vvu-crimson)]/40 bg-[var(--vvu-crimson)]/10 text-[color:var(--vvu-crimson)]",
      };
  }
}

// Invoice status pill — PAID=lime, OVERDUE=crimson, SENT=ochre, DRAFT=gray, VOID=crimson.
function invoiceStatusPill(status: InvoiceStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case "PAID":
      return {
        label: "Paid",
        className:
          "border-[var(--vvu-lime)]/40 bg-[var(--vvu-lime)]/10 text-[color:var(--vvu-lime)]",
      };
    case "OVERDUE":
      return {
        label: "Overdue",
        className:
          "border-[var(--vvu-crimson)]/40 bg-[var(--vvu-crimson)]/10 text-[color:var(--vvu-crimson)]",
      };
    case "SENT":
      return {
        label: "Sent",
        className:
          "border-[var(--vvu-ochre)]/40 bg-[var(--vvu-ochre)]/10 text-[color:var(--vvu-ochre)]",
      };
    case "DRAFT":
      return {
        label: "Draft",
        className:
          "border-border/60 bg-muted text-muted-foreground",
      };
    case "VOID":
      return {
        label: "Void",
        className:
          "border-[var(--vvu-crimson)]/40 bg-[var(--vvu-crimson)]/10 text-[color:var(--vvu-crimson)]",
      };
  }
}

// Tier priority order — water > dma > fleet > vehicle > phone.
const TIER_PRIORITY: Record<TierKey, number> = {
  water: 5,
  dma: 4,
  fleet: 3,
  vehicle: 2,
  phone: 1,
};

// Parse invoice lineItems JSON safely.
function parseLineItems(raw: string): LineItem[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as LineItem[];
  } catch {
    return [];
  }
}

// ─── Component ─────────────────────────────────────────────────────────────

export function SubscriptionSection() {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Usage meters sourced from /api/devices + /api/stats.
  const [deviceCount, setDeviceCount] = useState<number>(0);
  const [evidenceCount, setEvidenceCount] = useState<number>(0);

  // Dialog / sheet state.
  const [manageOpen, setManageOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Subscription | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [invoiceSheet, setInvoiceSheet] = useState<Invoice | null>(null);
  const [subscribingTier, setSubscribingTier] = useState<TierKey | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/subscriptions", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as SubscriptionData;
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load subscriptions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Fetch device + evidence counts in parallel for the usage meters.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [devRes, statsRes] = await Promise.all([
          fetch("/api/devices?XTransformPort=3000", { cache: "no-store" }),
          fetch("/api/stats", { cache: "no-store" }),
        ]);
        if (cancelled) return;
        if (devRes.ok) {
          const devJson = (await devRes.json()) as { total?: number };
          if (typeof devJson.total === "number") setDeviceCount(devJson.total);
        }
        if (statsRes.ok) {
          const statsJson = (await statsRes.json()) as {
            counts?: { evidence?: number };
          };
          const ev = statsJson.counts?.evidence;
          if (typeof ev === "number") setEvidenceCount(ev);
        }
      } catch {
        // Soft-fail: meters just show 0 / cap.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Actions ─────────────────────────────────────────────────────────────

  const cancelSubscription = async (sub: Subscription) => {
    setCancelling(true);
    try {
      const res = await fetch(`/api/subscriptions/${sub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "User-initiated cancel" }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      toast.success("Subscription cancelled", {
        description: `${sub.tierLabel} · ${sub.customerName}`,
      });
      setCancelTarget(null);
      setManageOpen(false);
      await refresh();
    } catch (e) {
      toast.error("Failed to cancel", {
        description: e instanceof Error ? e.message : "unknown error",
      });
    } finally {
      setCancelling(false);
    }
  };

  const startTrial = async (tier: TierKey) => {
    setSubscribingTier(tier);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tierKey: tier,
          customerName: "VVU EARTH TECH",
          customerEmail: "founder@vvu.earth",
          status: "TRIALING",
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const tierMeta = TIERS.find((t) => t.key === tier);
      toast.success("Trial started", {
        description: `${tierMeta?.label} · 14-day trial · ${formatZAR(
          tierMeta?.price ?? 0
        )} ${tierMeta?.cadence}`,
      });
      await refresh();
    } catch (e) {
      toast.error("Failed to start trial", {
        description: e instanceof Error ? e.message : "unknown error",
      });
    } finally {
      setSubscribingTier(null);
    }
  };

  // ─── Derived state ───────────────────────────────────────────────────────

  const activeSubs = (data?.subscriptions ?? []).filter(
    (s) => s.status === "ACTIVE" || s.status === "TRIALING"
  );
  // Pick the highest-tier active subscription as the "current plan".
  const currentPlan = activeSubs.length
    ? [...activeSubs].sort(
        (a, b) => TIER_PRIORITY[b.tierKey] - TIER_PRIORITY[a.tierKey]
      )[0]
    : null;

  const stats = data?.stats;
  const invoices = data?.invoices ?? [];

  // Year-to-date paid total.
  const ytdPaid = invoices
    .filter((i) => i.status === "PAID")
    .filter((i) => new Date(i.paidAt ?? i.issuedAt).getFullYear() === new Date().getFullYear())
    .reduce((sum, i) => sum + i.totalZAR, 0);

  // Usage meter values.
  const deviceCap = 50;
  const evidenceCap = 10000;
  const apiCap = 100000;
  const storageCap = 50; // GB
  // Mock-but-deterministic API + storage usage derived from device/evidence counts.
  const apiUsed = Math.min(apiCap, evidenceCount * 12 + deviceCount * 80);
  const storageUsed = Math.min(
    storageCap,
    Math.round((evidenceCount * 0.0025 + deviceCount * 0.1) * 10) / 10
  );

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <section aria-label="Subscription workspace" className="space-y-6">
      {/* ═══ KPI BAR ═══ */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiCard
          label="MRR"
          sublabel="Monthly recurring"
          value={stats ? formatZAR(stats.mrr) : null}
          suffix={stats ? "/ mo" : null}
          icon={TrendingUp}
          accent="lime"
          loading={loading}
        />
        <KpiCard
          label="ARR"
          sublabel="Annual run rate"
          value={stats ? formatZAR(stats.arr) : null}
          suffix={stats ? "/ yr" : null}
          icon={Wallet}
          accent="teal"
          loading={loading}
        />
        <KpiCard
          label="Active"
          sublabel="Paid + trialing"
          value={stats ? String(stats.active + stats.trialing) : null}
          suffix={
            stats
              ? `· ${stats.active} paid · ${stats.trialing} trial`
              : null
          }
          icon={Activity}
          accent="ochre"
          loading={loading}
        />
        <KpiCard
          label="LTV"
          sublabel="Lifetime value"
          value={stats ? formatZAR(stats.ltv) : null}
          suffix={null}
          icon={Banknote}
          accent="lime"
          loading={loading}
        />
      </div>

      {error && (
        <Card className="p-4 border-[var(--vvu-crimson)]/40 bg-[var(--vvu-crimson)]/5">
          <p
            className="text-sm"
            style={{ color: "var(--vvu-crimson)" }}
          >
            Failed to load subscription data: {error}
          </p>
        </Card>
      )}

      {/* ═══ SECTION 1 — Current plan banner ═══ */}
      {loading ? (
        <Skeleton className="h-44 w-full rounded-lg" />
      ) : currentPlan ? (
        <Card className="relative overflow-hidden p-6 bg-card/40 border-border/60">
          <div
            className="absolute inset-x-0 top-0 h-1"
            style={{
              background:
                "linear-gradient(90deg, var(--vvu-lime), var(--vvu-teal))",
            }}
          />
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex-1 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  Current plan
                </span>
                <Badge
                  className={subStatusPill(currentPlan.status).className}
                  variant="outline"
                >
                  {subStatusPill(currentPlan.status).label}
                </Badge>
              </div>
              <div>
                <h2
                  className="text-2xl font-bold tracking-tight"
                  style={{ color: "var(--vvu-lime)" }}
                >
                  {currentPlan.tierLabel}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {currentPlan.customerName} · {currentPlan.customerEmail}
                </p>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">
                  {formatZAR(currentPlan.priceZAR)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {currentPlan.cadence}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="size-3.5" />
                    <span>Started</span>
                  </div>
                  <p className="font-mono text-xs">
                    {formatDate(currentPlan.startDate)}
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="size-3.5" />
                    <span>Next renewal</span>
                  </div>
                  <p
                    className="font-mono text-xs"
                    style={{ color: "var(--vvu-lime)" }}
                  >
                    {formatDate(
                      nextRenewal(
                        currentPlan.startDate,
                        currentPlan.cadence
                      ).toISOString()
                    )}
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Activity className="size-3.5" />
                    <span>Renews in</span>
                  </div>
                  <p className="font-mono text-xs">
                    {daysUntil(
                      nextRenewal(
                        currentPlan.startDate,
                        currentPlan.cadence
                      )
                    )}{" "}
                    days
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
              <Button
                variant="outline"
                className="border-[var(--vvu-lime)]/40 text-[color:var(--vvu-lime)] hover:bg-[var(--vvu-lime)]/10"
                onClick={() => setManageOpen(true)}
              >
                <Activity className="size-4" /> Manage plan
              </Button>
              <Button
                variant="outline"
                className="border-[var(--vvu-crimson)]/40 text-[color:var(--vvu-crimson)] hover:bg-[var(--vvu-crimson)]/10"
                onClick={() => setCancelTarget(currentPlan)}
                disabled={currentPlan.status === "CANCELLED"}
              >
                <XCircle className="size-4" /> Cancel subscription
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-8 bg-card/40 border-border/60 text-center">
          <div className="mx-auto max-w-md space-y-3">
            <div
              className="mx-auto flex size-12 items-center justify-center rounded-full"
              style={{
                background: "var(--vvu-lime)",
                color: "var(--background)",
              }}
            >
              <Sparkles className="size-6" />
            </div>
            <h3 className="text-lg font-semibold">No active subscription</h3>
            <p className="text-sm text-muted-foreground">
              Choose a tier below to start a 14-day trial. All tiers include
              WORM-chain evidence custody and SHA-256 signing.
            </p>
          </div>
        </Card>
      )}

      {/* ═══ SECTION 2 — Tier comparison grid ═══ */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Pricing tiers
          </h3>
          <span className="text-xs text-muted-foreground">
            R9 – R9,999 · South African Rand
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          {TIERS.map((tier) => {
            const isCurrent =
              currentPlan?.tierKey === tier.key &&
              (currentPlan?.status === "ACTIVE" ||
                currentPlan?.status === "TRIALING");
            const Icon = tier.icon;
            const isSubscribing = subscribingTier === tier.key;
            return (
              <Card
                key={tier.key}
                className={`flex flex-col p-5 transition-all ${
                  isCurrent
                    ? "border-[var(--vvu-lime)]/60 bg-[var(--vvu-lime)]/5"
                    : "bg-card/40 border-border/60 hover:border-border"
                }`}
              >
                <div className="mb-3 flex items-start justify-between">
                  <div
                    className="flex size-9 items-center justify-center rounded-md"
                    style={{
                      background: isCurrent
                        ? "var(--vvu-lime)"
                        : "rgba(200, 255, 0, 0.08)",
                      color: isCurrent
                        ? "var(--background)"
                        : "var(--vvu-lime)",
                    }}
                  >
                    <Icon className="size-4" />
                  </div>
                  {isCurrent && (
                    <Badge
                      className="border-[var(--vvu-lime)]/40 bg-[var(--vvu-lime)]/15 text-[color:var(--vvu-lime)]"
                      variant="outline"
                    >
                      <CheckCircle2 className="size-3" /> Current
                    </Badge>
                  )}
                </div>
                <h4 className="text-sm font-semibold">{tier.label}</h4>
                <div className="mt-2 flex items-baseline gap-1">
                  <span
                    className="text-2xl font-bold"
                    style={{
                      color: isCurrent ? "var(--vvu-lime)" : undefined,
                    }}
                  >
                    {formatZAR(tier.price)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {tier.cadence}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {tier.bestFor}
                </p>
                <Separator className="my-4" />
                <ul className="flex-1 space-y-2">
                  {tier.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-xs"
                    >
                      <CheckCircle2
                        className="mt-0.5 size-3 shrink-0"
                        style={{ color: "var(--vvu-lime)" }}
                      />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4">
                  {isCurrent ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-muted-foreground"
                      disabled
                    >
                      <CheckCircle2 className="size-3.5" /> Active
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-border hover:border-[var(--vvu-lime)]/40 hover:text-[color:var(--vvu-lime)]"
                      onClick={() => startTrial(tier.key)}
                      disabled={isSubscribing}
                    >
                      {isSubscribing ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" /> Starting…
                        </>
                      ) : (
                        <>Choose</>
                      )}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ═══ SECTION 3 — Usage meters ═══ */}
      <Card className="p-5 bg-card/40 border-border/60">
        <div className="mb-4 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Usage this period
          </h3>
          <span className="text-xs text-muted-foreground">
            Resets in {daysUntil(
              nextRenewal(new Date().toISOString(), "per mo")
            )}{" "}
            days
          </span>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <UsageMeter
            label="Devices"
            used={deviceCount}
            cap={deviceCap}
            unit=""
            tone="lime"
          />
          <UsageMeter
            label="Evidence records (90-day window)"
            used={evidenceCount}
            cap={evidenceCap}
            unit=""
            tone="teal"
          />
          <UsageMeter
            label="API calls this month"
            used={apiUsed}
            cap={apiCap}
            unit=""
            tone="ochre"
          />
          <UsageMeter
            label="Storage"
            used={storageUsed}
            cap={storageCap}
            unit=" GB"
            tone="lime"
          />
        </div>
      </Card>

      {/* ═══ SECTION 4 — Invoices table ═══ */}
      <Card className="p-0 bg-card/40 border-border/60 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/60 p-4">
          <div className="flex items-center gap-2">
            <Receipt className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Invoices
            </h3>
          </div>
          <span className="text-xs text-muted-foreground">
            YTD paid:{" "}
            <span style={{ color: "var(--vvu-lime)" }} className="font-mono">
              {formatZAR(ytdPaid)}
            </span>
          </span>
        </div>
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No invoices yet — your first invoice will appear here after the
            trial ends.
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-medium text-muted-foreground">Number</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Customer</TableHead>
                    <TableHead className="text-right font-medium text-muted-foreground">Amount</TableHead>
                    <TableHead className="text-right font-medium text-muted-foreground">Tax</TableHead>
                    <TableHead className="text-right font-medium text-muted-foreground">Total</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Status</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Issued</TableHead>
                    <TableHead className="font-medium text-muted-foreground">Due</TableHead>
                    <TableHead className="text-right font-medium text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => {
                    const pill = invoiceStatusPill(inv.status);
                    return (
                      <TableRow
                        key={inv.id}
                        className="cursor-pointer hover:bg-muted/30"
                        onClick={() => setInvoiceSheet(inv)}
                      >
                        <TableCell className="font-mono text-xs">
                          {inv.number}
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate">
                          {inv.customerName}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatZAR(inv.amountZAR)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {formatZAR(inv.taxZAR)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold">
                          {formatZAR(inv.totalZAR)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={pill.className}
                            variant="outline"
                          >
                            {pill.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {formatDate(inv.issuedAt)}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {formatDate(inv.dueAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              aria-label={`View invoice ${inv.number}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setInvoiceSheet(inv);
                              }}
                            >
                              <Eye className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              aria-label={`Download PDF for ${inv.number}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toast("Generating PDF…", {
                                  description: `${inv.number} · ${formatZAR(
                                    inv.totalZAR
                                  )}`,
                                });
                              }}
                            >
                              <Download className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile card list */}
            <div className="divide-y divide-border/60 lg:hidden">
              {invoices.map((inv) => {
                const pill = invoiceStatusPill(inv.status);
                return (
                  <button
                    key={inv.id}
                    onClick={() => setInvoiceSheet(inv)}
                    className="flex w-full flex-col gap-2 p-4 text-left hover:bg-muted/30"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs">{inv.number}</span>
                      <Badge className={pill.className} variant="outline">
                        {pill.label}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm">
                        {inv.customerName}
                      </span>
                      <span className="font-mono text-sm font-semibold">
                        {formatZAR(inv.totalZAR)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>Issued {formatDate(inv.issuedAt)}</span>
                      <div className="flex gap-1">
                        <Eye className="size-3.5" />
                        <Download className="size-3.5" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-border/60 p-3 text-xs text-muted-foreground">
              <span>
                {invoices.length} invoice{invoices.length === 1 ? "" : "s"} ·
                YTD paid{" "}
                <span
                  style={{ color: "var(--vvu-lime)" }}
                  className="font-mono"
                >
                  {formatZAR(ytdPaid)}
                </span>
              </span>
              <span>VAT 15% included</span>
            </div>
          </>
        )}
      </Card>

      {/* ═══ SECTION 5 — Payment method ═══ */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 bg-card/40 border-border/60 lg:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className="flex size-10 items-center justify-center rounded-md"
                style={{
                  background: "rgba(200, 255, 0, 0.08)",
                  color: "var(--vvu-lime)",
                }}
              >
                <Landmark className="size-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">Payment method</h3>
                <p className="text-sm">Bank transfer · Standard Bank</p>
                <p className="font-mono text-xs text-muted-foreground">
                  Account · 00 000 000 0 · Branch 000 00
                </p>
                <p className="text-xs text-muted-foreground">
                  Reference:{" "}
                  <span className="font-mono">VVU-{currentPlan?.tierKey.toUpperCase() ?? "TRIAL"}</span>
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-border hover:border-[var(--vvu-lime)]/40 hover:text-[color:var(--vvu-lime)]"
              onClick={() =>
                toast("Banking details managed by founder", {
                  description:
                    "Contact founder@vvu.earth to update EFT details.",
                })
              }
            >
              Update payment method
            </Button>
          </div>
        </Card>
        <Card className="p-5 bg-card/40 border-border/60">
          <h3 className="mb-3 text-sm font-semibold">Tax & billing</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">VAT number</dt>
              <dd className="font-mono text-xs">4XX0XX0XXX0</dd>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Billing email</dt>
              <dd className="font-mono text-xs">billing@vvu.earth</dd>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Currency</dt>
              <dd className="text-xs">ZAR (R)</dd>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">VAT rate</dt>
              <dd className="text-xs">15% included</dd>
            </div>
          </dl>
        </Card>
      </div>

      {/* ═══ Manage-plan dialog ═══ */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage subscription</DialogTitle>
            <DialogDescription>
              Upgrade, switch tier, or cancel your current plan. Changes take
              effect at the next renewal date.
            </DialogDescription>
          </DialogHeader>
          {currentPlan && (
            <div className="space-y-4">
              <div className="rounded-md border border-border/60 bg-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Current plan
                    </p>
                    <p
                      className="text-lg font-semibold"
                      style={{ color: "var(--vvu-lime)" }}
                    >
                      {currentPlan.tierLabel}
                    </p>
                  </div>
                  <Badge
                    className={subStatusPill(currentPlan.status).className}
                    variant="outline"
                  >
                    {subStatusPill(currentPlan.status).label}
                  </Badge>
                </div>
                <Separator className="my-3" />
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Price</p>
                    <p className="font-mono">
                      {formatZAR(currentPlan.priceZAR)} /{" "}
                      {currentPlan.cadence}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Next renewal</p>
                    <p className="font-mono">
                      {formatDate(
                        nextRenewal(
                          currentPlan.startDate,
                          currentPlan.cadence
                        ).toISOString()
                      )}
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Available actions:
                </p>
                <ul className="space-y-1.5 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2
                      className="mt-0.5 size-3.5 shrink-0"
                      style={{ color: "var(--vvu-lime)" }}
                    />
                    <span>
                      <strong>Upgrade tier</strong> — switch to a higher tier
                      (DMA / Water) at next renewal. The current plan stays
                      active until then.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2
                      className="mt-0.5 size-3.5 shrink-0"
                      style={{ color: "var(--vvu-lime)" }}
                    />
                    <span>
                      <strong>Cancel</strong> — stop renewal. Service stays
                      active until the next renewal date, then cancels.
                      Invoices remain in your history.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setManageOpen(false)}>
              Close
            </Button>
            <Button
              variant="outline"
              className="border-[var(--vvu-lime)]/40 text-[color:var(--vvu-lime)] hover:bg-[var(--vvu-lime)]/10"
              onClick={() => {
                setManageOpen(false);
                toast("Upgrade flow", {
                  description:
                    "Choose a higher tier from the pricing grid to start a parallel trial.",
                });
              }}
            >
              Upgrade tier
            </Button>
            <Button
              variant="outline"
              className="border-[var(--vvu-crimson)]/40 text-[color:var(--vvu-crimson)] hover:bg-[var(--vvu-crimson)]/10"
              onClick={() => {
                if (currentPlan) setCancelTarget(currentPlan);
              }}
              disabled={!currentPlan || currentPlan.status === "CANCELLED"}
            >
              <XCircle className="size-4" /> Cancel plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Cancel confirmation ═══ */}
      <AlertDialog
        open={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget && (
                <>
                  This will cancel <strong>{cancelTarget.tierLabel}</strong>{" "}
                  for {cancelTarget.customerName}. The service stays active
                  until the next renewal date, then stops. Past invoices
                  remain in your billing history (POPIA + financial-audit
                  compliance). This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>
              Keep plan
            </AlertDialogCancel>
            <AlertDialogAction
              className="border-[var(--vvu-crimson)]/40 bg-[var(--vvu-crimson)]/10 text-[color:var(--vvu-crimson)] hover:bg-[var(--vvu-crimson)]/20"
              disabled={cancelling}
              onClick={(e) => {
                e.preventDefault();
                if (cancelTarget) void cancelSubscription(cancelTarget);
              }}
            >
              {cancelling ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Cancelling…
                </>
              ) : (
                <>
                  <XCircle className="size-4" /> Cancel subscription
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══ Invoice detail sheet ═══ */}
      <Sheet
        open={!!invoiceSheet}
        onOpenChange={(open) => {
          if (!open) setInvoiceSheet(null);
        }}
      >
        <SheetContent className="w-full sm:max-w-md md:max-w-lg overflow-y-auto">
          {invoiceSheet && (
            <>
              <SheetHeader>
                <SheetTitle className="font-mono">
                  {invoiceSheet.number}
                </SheetTitle>
                <SheetDescription>
                  Issued {formatDate(invoiceSheet.issuedAt)}
                  {invoiceSheet.dueAt &&
                    ` · Due ${formatDate(invoiceSheet.dueAt)}`}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 p-4">
                <div className="flex items-center justify-between">
                  <Badge
                    className={invoiceStatusPill(invoiceSheet.status).className}
                    variant="outline"
                  >
                    {invoiceStatusPill(invoiceSheet.status).label}
                  </Badge>
                  {invoiceSheet.paidAt && (
                    <span className="text-xs text-muted-foreground">
                      Paid {formatDate(invoiceSheet.paidAt)}
                    </span>
                  )}
                </div>
                <Separator />
                <div className="space-y-2 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      Bill to
                    </p>
                    <p className="font-medium">{invoiceSheet.customerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {invoiceSheet.customerEmail}
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Line items
                  </p>
                  {parseLineItems(invoiceSheet.lineItems).length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No line items recorded.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {parseLineItems(invoiceSheet.lineItems).map((li, i) => (
                        <li
                          key={i}
                          className="flex items-start justify-between gap-3 text-sm"
                        >
                          <span className="text-muted-foreground">
                            {li.description}
                          </span>
                          <span className="font-mono text-xs">
                            {formatZAR(li.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <Separator />
                <dl className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd className="font-mono text-xs">
                      {formatZAR(invoiceSheet.amountZAR)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">VAT (15%)</dt>
                    <dd className="font-mono text-xs">
                      {formatZAR(invoiceSheet.taxZAR)}
                    </dd>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <dt className="font-semibold">Total</dt>
                    <dd
                      className="font-mono text-sm font-bold"
                      style={{ color: "var(--vvu-lime)" }}
                    >
                      {formatZAR(invoiceSheet.totalZAR)}
                    </dd>
                  </div>
                </dl>
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-border hover:border-[var(--vvu-lime)]/40 hover:text-[color:var(--vvu-lime)]"
                    onClick={() =>
                      toast("Generating PDF…", {
                        description: `${invoiceSheet.number} · ${formatZAR(
                          invoiceSheet.totalZAR
                        )}`,
                      })
                    }
                  >
                    <Download className="size-3.5" /> Download PDF
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  sublabel: string;
  value: string | null;
  suffix: string | null;
  icon: typeof TrendingUp;
  accent: "lime" | "teal" | "ochre";
  loading: boolean;
}

function KpiCard({
  label,
  sublabel,
  value,
  suffix,
  icon: Icon,
  accent,
  loading,
}: KpiCardProps) {
  const accentColor =
    accent === "lime"
      ? "var(--vvu-lime)"
      : accent === "teal"
      ? "var(--vvu-teal)"
      : "var(--vvu-ochre)";
  return (
    <Card className="p-4 bg-card/40 border-border/60">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5 min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground truncate">
            {label}
          </p>
          <p className="text-[10px] text-muted-foreground/70 truncate">
            {sublabel}
          </p>
        </div>
        <div
          className="flex size-7 items-center justify-center rounded-md shrink-0"
          style={{
            background: `color-mix(in srgb, ${accentColor} 12%, transparent)`,
            color: accentColor,
          }}
        >
          <Icon className="size-3.5" />
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        {loading ? (
          <Skeleton className="h-6 w-20" />
        ) : (
          <span
            className="text-2xl font-bold tracking-tight"
            style={{ color: accentColor }}
          >
            {value}
          </span>
        )}
        {suffix && !loading && (
          <span className="text-xs text-muted-foreground">{suffix}</span>
        )}
      </div>
    </Card>
  );
}

interface UsageMeterProps {
  label: string;
  used: number;
  cap: number;
  unit: string;
  tone: "lime" | "teal" | "ochre";
}

function UsageMeter({ label, used, cap, unit, tone }: UsageMeterProps) {
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  // Tailwind arbitrary child selector to recolor the shadcn Progress indicator
  // per-meter — the indicator uses bg-primary by default; we override via the
  // data-slot attribute the shadcn component exposes.
  const indicatorClass =
    tone === "lime"
      ? "[&_[data-slot=progress-indicator]]:bg-[var(--vvu-lime)]"
      : tone === "teal"
      ? "[&_[data-slot=progress-indicator]]:bg-[var(--vvu-teal)]"
      : "[&_[data-slot=progress-indicator]]:bg-[var(--vvu-ochre)]";
  const toneColor =
    tone === "lime"
      ? "var(--vvu-lime)"
      : tone === "teal"
      ? "var(--vvu-teal)"
      : "var(--vvu-ochre)";
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm">{label}</span>
        <span className="font-mono text-xs text-muted-foreground">
          <span style={{ color: toneColor }}>
            {used.toLocaleString("en-ZA")}
          </span>
          <span className="text-muted-foreground/60">
            {" "}
            / {cap.toLocaleString("en-ZA")}
            {unit}
          </span>
        </span>
      </div>
      <Progress value={pct} className={`h-2 bg-muted ${indicatorClass}`} />
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{pct}% used</span>
        <span>
          {Math.max(0, cap - used).toLocaleString("en-ZA")}
          {unit} remaining
        </span>
      </div>
    </div>
  );
}
