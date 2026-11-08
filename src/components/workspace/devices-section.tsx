"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Cpu,
  ShieldCheck,
  Eye,
  Plus,
  Search,
  Activity,
  CircleDot,
  Ban,
  Pencil,
  Trash2,
  Loader2,
  X,
  MapPin,
  Fingerprint,
  Calendar,
  Hash,
  Server,
  Radio,
  Droplet,
  Smartphone,
  Car,
  ClipboardList,
  History,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// Note: dropdown-menu was replaced with inline action buttons (Golden Rule — no @radix-ui/react-dropdown-menu dep).
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────

type DeviceDomain = "WATER" | "CELLPHONE" | "VEHICLE";
type DevicePrimitive =
  | "MOTION"
  | "PROXIMITY"
  | "STATE"
  | "IDENTITY"
  | "LOCATION"
  | "ENVIRONMENT";
type DeviceStatus = "ACTIVE" | "DORMANT" | "RETIRED";

interface DeviceRow {
  id: string;
  externalId: string;
  label: string;
  domain: DeviceDomain;
  primitive: DevicePrimitive;
  lat: number;
  lng: number;
  firmwareVersion: string | null;
  hardwareKeyHint: string | null;
  status: DeviceStatus;
  pricingBand: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { evidence: number };
}

interface RecentEvidence {
  id: string;
  hash: string;
  verificationState: string;
  tierTag: number;
  subject: string;
  source: string;
  observedAt: string;
  signedAt: string;
}

interface RecentAuditEvent {
  id: string;
  action: string;
  fromState: string | null;
  toState: string | null;
  actor: string;
  note: string | null;
  at: string;
}

interface DeviceDetail {
  id: string;
  externalId: string;
  label: string;
  domain: DeviceDomain;
  primitive: DevicePrimitive;
  lat: number;
  lng: number;
  firmwareVersion: string | null;
  hardwareKeyHint: string | null;
  status: DeviceStatus;
  pricingBand: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { evidence: number };
  evidence: RecentEvidence[];
}

interface DeviceDetailResponse {
  device: DeviceDetail;
  auditEvents: RecentAuditEvent[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

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

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusMeta(status: DeviceStatus): {
  label: string;
  dot: string;
  badge: string;
} {
  switch (status) {
    case "ACTIVE":
      return {
        label: "Active",
        dot: "bg-[var(--verified)]",
        badge:
          "border-[var(--verified)]/40 bg-[var(--verified)]/10 text-[color:var(--verified)]",
      };
    case "DORMANT":
      return {
        label: "Dormant",
        dot: "bg-muted-foreground/50",
        badge: "border-border/60 bg-muted text-muted-foreground",
      };
    case "RETIRED":
      return {
        label: "Retired",
        dot: "bg-[var(--violating)]",
        badge:
          "border-[var(--violating)]/40 bg-[var(--violating)]/10 text-[color:var(--violating)]",
      };
  }
}

function domainMeta(domain: DeviceDomain): { label: string; icon: typeof Droplet; badge: string } {
  switch (domain) {
    case "WATER":
      return {
        label: "Water",
        icon: Droplet,
        badge: "border-[var(--vvu-teal)]/40 bg-[var(--vvu-teal)]/10 text-[color:var(--vvu-teal)]",
      };
    case "CELLPHONE":
      return {
        label: "Cellphone",
        icon: Smartphone,
        badge: "border-[var(--vvu-amber)]/40 bg-[var(--vvu-amber)]/10 text-[color:var(--vvu-amber)]",
      };
    case "VEHICLE":
      return {
        label: "Vehicle",
        icon: Car,
        badge:
          "border-[var(--vvu-ochre)]/40 bg-[var(--vvu-ochre)]/10 text-[color:var(--vvu-ochre)]",
      };
  }
}

function evidenceTone(state: string): string {
  switch (state) {
    case "VERIFIED":
      return "border-[var(--verified)]/40 bg-[var(--verified)]/10 text-[color:var(--verified)]";
    case "CANDIDATE":
      return "border-[var(--repairing)]/40 bg-[var(--repairing)]/10 text-[color:var(--repairing)]";
    case "TAMPER_DETECTED":
    case "TAMPERED":
      return "border-[var(--violating)]/40 bg-[var(--violating)]/10 text-[color:var(--violating)]";
    case "ARCHIVED":
      return "border-[var(--quarantined)]/40 bg-[var(--quarantined)]/10 text-[color:var(--quarantined)]";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

function auditActionTone(action: string): string {
  switch (action) {
    case "CREATE":
      return "text-[color:var(--verified)]";
    case "WITNESS_ATTACHED":
    case "STATE_ELEVATED":
      return "text-[color:var(--vvu-teal)]";
    case "TAMPER_FLAGGED":
      return "text-[color:var(--violating)]";
    case "ARCHIVED":
      return "text-[color:var(--quarantined)]";
    default:
      return "text-[color:var(--vvu-ochre)]";
  }
}

const DOMAINS: DeviceDomain[] = ["WATER", "CELLPHONE", "VEHICLE"];
const PRIMITIVES: DevicePrimitive[] = [
  "MOTION",
  "PROXIMITY",
  "STATE",
  "IDENTITY",
  "LOCATION",
  "ENVIRONMENT",
];

// ─── Component ─────────────────────────────────────────────────────────────

export function DevicesSection() {
  const [rows, setRows] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState<"" | DeviceDomain>("");
  const [status, setStatus] = useState<"" | DeviceStatus>("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Detail drawer
  const [detail, setDetail] = useState<DeviceDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [revealFullFingerprint, setRevealFullFingerprint] = useState(false);

  // Register / edit / retire
  const [registerOpen, setRegisterOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [retireOpen, setRetireOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);

  // ── Fetch list ──────────────────────────────────────────────────────────
  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (domain) params.set("domain", domain);
      if (status) params.set("status", status);
      if (debouncedSearch) params.set("q", debouncedSearch);
      const res = await fetch(`/api/devices?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setRows(json.devices ?? []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "failed to load devices";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [domain, status, debouncedSearch]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Debounced search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  // ── KPI roll-up ─────────────────────────────────────────────────────────
  const total = rows.length;
  const active = rows.filter((r) => r.status === "ACTIVE").length;
  const dormantOrRetired = rows.filter(
    (r) => r.status === "DORMANT" || r.status === "RETIRED"
  ).length;
  const totalEvidence = rows.reduce(
    (acc, r) => acc + (r._count?.evidence ?? 0),
    0
  );

  // ── Open detail drawer ─────────────────────────────────────────────────
  const openDetail = useCallback(async (id: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    setRevealFullFingerprint(false);
    try {
      const res = await fetch(`/api/devices/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as DeviceDetailResponse;
      setDetail(json);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "failed to load device";
      toast.error(msg);
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // ── Re-verify fingerprint ───────────────────────────────────────────────
  const reverifyFingerprint = useCallback(
    async (id: string) => {
      setVerifying(id);
      try {
        const res = await fetch(`/api/devices/${id}/fingerprint`, {
          method: "POST",
        });
        if (!res.ok) {
          const j = await res.json().catch(() => null);
          throw new Error(j?.error ?? `HTTP ${res.status}`);
        }
        const json = await res.json();
        toast.success("Device fingerprint re-verified", {
          description: `New hint: ${json.hardwareKeyHint}`,
        });
        // If detail drawer is open for this device, refresh it.
        if (detail?.device.id === id) {
          await openDetail(id);
        }
        // Refresh the list so the row's lastSeenAt updates.
        void fetchList();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "re-verify failed";
        toast.error(msg);
      } finally {
        setVerifying(null);
      }
    },
    [detail, openDetail, fetchList]
  );

  // ── Retire device ───────────────────────────────────────────────────────
  const retireDevice = useCallback(async () => {
    if (!detail) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/devices/${detail.device.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "RETIRED" }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? `HTTP ${res.status}`);
      }
      toast.success("Device retired", {
        description: `${detail.device.externalId} is now RETIRED. Existing evidence is preserved.`,
      });
      setRetireOpen(false);
      await openDetail(detail.device.id);
      void fetchList();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "retire failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }, [detail, openDetail, fetchList]);

  // ── Delete device ───────────────────────────────────────────────────────
  const deleteDevice = useCallback(
    async (id: string, externalId: string) => {
      try {
        const res = await fetch(`/api/devices/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const j = await res.json().catch(() => null);
          throw new Error(j?.error ?? `HTTP ${res.status}`);
        }
        toast.success("Device deleted", {
          description: `${externalId} removed from registry.`,
        });
        if (detail?.device.id === id) {
          setDetailOpen(false);
          setDetail(null);
        }
        void fetchList();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "delete failed";
        toast.error(msg);
      }
    },
    [detail, fetchList]
  );

  // ── Edit device ─────────────────────────────────────────────────────────
  const saveEdit = useCallback(
    async (patch: {
      label: string;
      firmwareVersion: string;
      pricingBand: string;
    }) => {
      if (!detail) return;
      setSubmitting(true);
      try {
        const res = await fetch(`/api/devices/${detail.device.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: patch.label,
            firmwareVersion: patch.firmwareVersion || null,
            pricingBand: patch.pricingBand || null,
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => null);
          throw new Error(j?.error ?? `HTTP ${res.status}`);
        }
        toast.success("Device updated");
        setEditOpen(false);
        await openDetail(detail.device.id);
        void fetchList();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "update failed";
        toast.error(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [detail, openDetail, fetchList]
  );

  // ── Register device ─────────────────────────────────────────────────────
  const registerDevice = useCallback(
    async (form: RegisterForm) => {
      setSubmitting(true);
      try {
        const res = await fetch(`/api/devices`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => null);
          throw new Error(j?.error ?? `HTTP ${res.status}`);
        }
        toast.success("Device registered", {
          description: `${form.externalId} is now ACTIVE.`,
        });
        setRegisterOpen(false);
        void fetchList();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "register failed";
        // Inline error is shown by the form component via toast.
        toast.error(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [fetchList]
  );

  return (
    <section
      aria-label="Devices workspace"
      className="flex flex-col gap-5"
    >
      {/* ─── KPI bar ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<Server className="h-4 w-4" />}
          label="Total devices"
          value={total}
          loading={loading}
          accent="vvu-lime"
        />
        <KpiCard
          icon={<CircleDot className="h-4 w-4" />}
          label="Active"
          value={active}
          loading={loading}
          accent="verified"
        />
        <KpiCard
          icon={<Ban className="h-4 w-4" />}
          label="Dormant / Retired"
          value={dormantOrRetired}
          loading={loading}
          accent="quarantined"
        />
        <KpiCard
          icon={<ClipboardList className="h-4 w-4" />}
          label="Evidence records"
          value={totalEvidence}
          loading={loading}
          accent="vvu-teal"
          hint="across all devices"
        />
      </div>

      {/* ─── Filter bar ──────────────────────────────────────────────────── */}
      <Card className="p-4 bg-card/40 border-border/60">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search externalId or label…"
                aria-label="Search devices"
                className="pl-9 bg-background/60"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <ButtonGroup
              label="Domain filter"
              value={domain}
              onChange={(v) => setDomain(v as "" | DeviceDomain)}
              options={[
                { value: "", label: "All" },
                { value: "WATER", label: "Water" },
                { value: "CELLPHONE", label: "Cellphone" },
                { value: "VEHICLE", label: "Vehicle" },
              ]}
            />

            <ButtonGroup
              label="Status filter"
              value={status}
              onChange={(v) => setStatus(v as "" | DeviceStatus)}
              options={[
                { value: "", label: "All" },
                { value: "ACTIVE", label: "Active" },
                { value: "DORMANT", label: "Dormant" },
                { value: "RETIRED", label: "Retired" },
              ]}
            />
          </div>

          <Button
            onClick={() => setRegisterOpen(true)}
            className="bg-transparent border border-[var(--vvu-lime)]/50 text-[color:var(--vvu-lime)] hover:bg-[var(--vvu-lime)]/10 hover:text-[color:var(--vvu-lime)]"
            style={{ color: "var(--vvu-lime)" }}
          >
            <Plus className="h-4 w-4" />
            Register device
          </Button>
        </div>
      </Card>

      {/* ─── Devices table (desktop) ────────────────────────────────────── */}
      <Card className="p-0 bg-card/40 border-border/60 overflow-hidden">
        <div className="hidden lg:block">
          <Table>
            <TableHeader>
              <TableRow className="border-border/60 hover:bg-transparent">
                <TableHead className="pl-5">Device</TableHead>
                <TableHead>External ID</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Primitive</TableHead>
                <TableHead>Firmware</TableHead>
                <TableHead>Last seen</TableHead>
                <TableHead className="text-center">Evidence</TableHead>
                <TableHead className="text-right pr-5">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={`sk-${i}`} className="border-border/40">
                    <TableCell colSpan={8} className="py-4">
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow className="border-border/40">
                  <TableCell colSpan={8} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Search className="h-6 w-6 opacity-40" />
                      <span className="text-sm">
                        No devices match your filters
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((d) => {
                  const sm = statusMeta(d.status);
                  const dm = domainMeta(d.domain);
                  const DomainIcon = dm.icon;
                  return (
                    <TableRow
                      key={d.id}
                      onClick={() => openDetail(d.id)}
                      className="border-border/40 cursor-pointer hover:bg-muted/30 transition-colors"
                    >
                      <TableCell className="pl-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${sm.dot} ${
                              d.status === "ACTIVE" ? "animate-pulse" : ""
                            }`}
                            aria-label={`status: ${sm.label}`}
                          />
                          <span className="font-medium text-foreground">
                            {d.label}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">
                          {d.externalId}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`gap-1 ${dm.badge}`}
                        >
                          <DomainIcon className="h-3 w-3" />
                          {dm.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {d.primitive}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">
                          {d.firmwareVersion ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {relativeTime(d.lastSeenAt)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className="font-mono text-xs"
                          style={{
                            color:
                              d._count.evidence > 0
                                ? "var(--vvu-lime)"
                                : undefined,
                          }}
                        >
                          {d._count.evidence}
                        </span>
                      </TableCell>
                      <TableCell
                        className="text-right pr-5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            aria-label="View device"
                            onClick={() => openDetail(d.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            aria-label="Re-verify fingerprint"
                            disabled={verifying === d.id}
                            onClick={() => reverifyFingerprint(d.id)}
                          >
                            {verifying === d.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ShieldCheck className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            aria-label="View device"
                            onClick={() => openDetail(d.id)}
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            aria-label="Edit device"
                            onClick={() => {
                              setDetail({
                                device: d,
                                auditEvents: [],
                              } as unknown as DeviceDetailResponse);
                              setEditOpen(true);
                            }}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            aria-label="Retire device"
                            disabled={d.status === "RETIRED"}
                            onClick={() => {
                              setDetail({
                                device: d,
                                auditEvents: [],
                              } as unknown as DeviceDetailResponse);
                              setRetireOpen(true);
                            }}
                            title="Retire"
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 hover:text-[color:var(--violating)]"
                            aria-label="Delete device"
                            onClick={() => deleteDevice(d.id, d.externalId)}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* ─── Mobile card list ─────────────────────────────────────────── */}
        <div className="lg:hidden divide-y divide-border/40">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={`msk-${i}`} className="p-4">
                <Skeleton className="h-16 w-full" />
              </div>
            ))
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">
              No devices match your filters
            </div>
          ) : (
            rows.map((d) => {
              const sm = statusMeta(d.status);
              const dm = domainMeta(d.domain);
              const DomainIcon = dm.icon;
              return (
                <div
                  key={d.id}
                  onClick={() => openDetail(d.id)}
                  className="p-4 cursor-pointer hover:bg-muted/30 active:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span
                        className={`mt-1.5 inline-block h-2 w-2 flex-shrink-0 rounded-full ${sm.dot} ${
                          d.status === "ACTIVE" ? "animate-pulse" : ""
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="font-medium text-foreground truncate">
                          {d.label}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground truncate">
                          {d.externalId}
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <Badge
                            variant="outline"
                            className={`gap-1 ${dm.badge}`}
                          >
                            <DomainIcon className="h-3 w-3" />
                            {dm.label}
                          </Badge>
                          <Badge variant="outline" className={sm.badge}>
                            {sm.label}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="border-border/60 text-muted-foreground"
                          >
                            {d.primitive}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span
                        className="font-mono text-xs"
                        style={{
                          color:
                            d._count.evidence > 0
                              ? "var(--vvu-lime)"
                              : undefined,
                        }}
                      >
                        {d._count.evidence} ev.
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        aria-label="Re-verify fingerprint"
                        disabled={verifying === d.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          reverifyFingerprint(d.id);
                        }}
                      >
                        {verifying === d.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ShieldCheck className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                    <span>Firmware: {d.firmwareVersion ?? "—"}</span>
                    <span>Seen: {relativeTime(d.lastSeenAt)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {error && (
        <div className="text-xs text-[color:var(--violating)]">
          Failed to load devices: {error}
        </div>
      )}

      {/* ─── Detail drawer ──────────────────────────────────────────────── */}
      <Sheet
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setDetail(null);
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-md md:max-w-lg lg:max-w-xl overflow-y-auto"
        >
          {detailLoading || !detail ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <DeviceDetailBody
              detail={detail}
              revealFullFingerprint={revealFullFingerprint}
              onToggleReveal={() =>
                setRevealFullFingerprint((v) => !v)
              }
              onReverify={() => reverifyFingerprint(detail.device.id)}
              verifying={verifying === detail.device.id}
              onEdit={() => setEditOpen(true)}
              onRetire={() => setRetireOpen(true)}
              onClose={() => {
                setDetailOpen(false);
                setDetail(null);
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* ─── Register device dialog ─────────────────────────────────────── */}
      <RegisterDeviceDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        onSubmit={registerDevice}
        submitting={submitting}
      />

      {/* ─── Edit device dialog ─────────────────────────────────────────── */}
      <EditDeviceDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        device={detail?.device ?? null}
        onSubmit={saveEdit}
        submitting={submitting}
      />

      {/* ─── Retire device confirmation ─────────────────────────────────── */}
      <AlertDialog open={retireOpen} onOpenChange={setRetireOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retire this device?</AlertDialogTitle>
            <AlertDialogDescription>
              {detail?.device && (
                <>
                  <span className="font-mono text-xs">
                    {detail.device.externalId}
                  </span>{" "}
                  ({detail.device.label}) will move to{" "}
                  <span className="text-[color:var(--violating)] font-medium">
                    RETIRED
                  </span>
                  . This is a one-way transition — retired devices cannot be
                  reactivated. Existing evidence records are preserved.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting}
              onClick={(e) => {
                e.preventDefault();
                void retireDevice();
              }}
              className="bg-[var(--violating)] text-white hover:bg-[var(--violating)]/90"
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Ban className="mr-2 h-4 w-4" />
              )}
              Retire device
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  loading,
  accent,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  loading: boolean;
  accent: "vvu-lime" | "verified" | "quarantined" | "vvu-teal";
  hint?: string;
}) {
  const color = `var(--${accent})`;
  return (
    <Card className="p-4 bg-card/40 border-border/60">
      <div className="flex items-center justify-between">
        <span
          className="text-xs uppercase tracking-wide text-muted-foreground"
        >
          {label}
        </span>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        {loading ? (
          <Skeleton className="h-7 w-12" />
        ) : (
          <span
            className="text-2xl font-semibold tabular-nums"
            style={{ color }}
          >
            {value}
          </span>
        )}
        {hint && (
          <span className="text-[10px] text-muted-foreground">{hint}</span>
        )}
      </div>
    </Card>
  );
}

function ButtonGroup<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div
      className="inline-flex items-center rounded-md border border-border/60 bg-background/40 p-0.5"
      role="group"
      aria-label={label}
    >
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value || "all"}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(opt.value)}
            className={`px-2.5 py-1 text-xs rounded transition-colors ${
              isActive
                ? "bg-[var(--vvu-lime)]/15 text-[color:var(--vvu-lime)]"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
            style={
              isActive ? { color: "var(--vvu-lime)" } : undefined
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function DeviceDetailBody({
  detail,
  revealFullFingerprint,
  onToggleReveal,
  onReverify,
  verifying,
  onEdit,
  onRetire,
  onClose,
}: {
  detail: DeviceDetailResponse;
  revealFullFingerprint: boolean;
  onToggleReveal: () => void;
  onReverify: () => void;
  verifying: boolean;
  onEdit: () => void;
  onRetire: () => void;
  onClose: () => void;
}) {
  const { device, auditEvents } = detail;
  const sm = statusMeta(device.status);
  const dm = domainMeta(device.domain);
  const DomainIcon = dm.icon;

  // Stylized map preview: a 200x100 box with a pulsing dot at the device's
  // normalized lat/lng. Pure SVG, no maplibre here.
  const mapX = 50 + ((device.lng + 180) / 360) * 100; // lng [-180,180] → [50,150]
  const mapY = 50 - ((device.lat - 0) / 90) * 40; // lat [0..90] → [50..10]

  return (
    <div className="flex h-full flex-col">
      <SheetHeader className="border-b border-border/60 pr-10">
        <div className="flex items-start gap-3">
          <span
            className={`mt-1.5 inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full ${sm.dot} ${
              device.status === "ACTIVE" ? "animate-pulse" : ""
            }`}
          />
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-lg font-semibold leading-tight">
              {device.label}
            </SheetTitle>
            <SheetDescription className="mt-0.5 flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs">{device.externalId}</span>
              <Badge variant="outline" className={sm.badge}>
                {sm.label}
              </Badge>
              <Badge variant="outline" className={`gap-1 ${dm.badge}`}>
                <DomainIcon className="h-3 w-3" />
                {dm.label}
              </Badge>
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Map preview */}
        <div className="rounded-lg border border-border/60 bg-background/40 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
            <span className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-3 w-3" style={{ color: "var(--vvu-lime)" }} />
              Location
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {device.lat.toFixed(4)}, {device.lng.toFixed(4)}
            </span>
          </div>
          <svg
            viewBox="0 0 200 100"
            className="w-full h-32"
            role="img"
            aria-label={`Map preview at ${device.lat}, ${device.lng}`}
          >
            <defs>
              <pattern
                id="grid"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 20 0 L 0 0 0 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.3"
                  className="text-border/60"
                />
              </pattern>
              <radialGradient id="pulseGrad">
                <stop
                  offset="0%"
                  stopColor="var(--vvu-lime)"
                  stopOpacity="0.7"
                />
                <stop
                  offset="100%"
                  stopColor="var(--vvu-lime)"
                  stopOpacity="0"
                />
              </radialGradient>
            </defs>
            <rect width="200" height="100" fill="url(#grid)" />
            <line
              x1="0"
              y1="50"
              x2="200"
              y2="50"
              stroke="currentColor"
              strokeWidth="0.4"
              className="text-border/80"
            />
            <line
              x1="100"
              y1="0"
              x2="100"
              y2="100"
              stroke="currentColor"
              strokeWidth="0.4"
              className="text-border/80"
            />
            <circle cx={mapX} cy={mapY} r="14" fill="url(#pulseGrad)">
              <animate
                attributeName="r"
                values="8;16;8"
                dur="2s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="1;0.4;1"
                dur="2s"
                repeatCount="indefinite"
              />
            </circle>
            <circle
              cx={mapX}
              cy={mapY}
              r="3"
              fill="var(--vvu-lime)"
            />
          </svg>
        </div>

        {/* Fields grid */}
        <div className="grid grid-cols-2 gap-3">
          <Field
            icon={<Hash className="h-3 w-3" />}
            label="Primitive"
            value={device.primitive}
          />
          <Field
            icon={<Cpu className="h-3 w-3" />}
            label="Firmware"
            value={device.firmwareVersion ?? "—"}
            mono
          />
          <Field
            icon={<Activity className="h-3 w-3" />}
            label="Pricing band"
            value={device.pricingBand ?? "—"}
          />
          <Field
            icon={<Calendar className="h-3 w-3" />}
            label="Last seen"
            value={relativeTime(device.lastSeenAt)}
          />
          <Field
            icon={<Calendar className="h-3 w-3" />}
            label="Created"
            value={formatDate(device.createdAt)}
          />
          <Field
            icon={<ClipboardList className="h-3 w-3" />}
            label="Evidence"
            value={`${device._count.evidence} record${
              device._count.evidence === 1 ? "" : "s"
            }`}
            accent={device._count.evidence > 0 ? "vvu-lime" : undefined}
          />
        </div>

        {/* Hardware key hint */}
        <div className="rounded-lg border border-border/60 bg-background/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Fingerprint
                className="h-4 w-4 flex-shrink-0"
                style={{ color: "var(--vvu-ochre)" }}
              />
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Hardware key hint
                </div>
                <div className="font-mono text-sm text-[color:var(--vvu-ochre)] truncate">
                  {device.hardwareKeyHint ?? "—"}
                  {revealFullFingerprint && device.hardwareKeyHint && (
                    <span className="text-muted-foreground">
                      {" •••••••• (full fingerprint withheld)"}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={onToggleReveal}
                disabled={!device.hardwareKeyHint}
              >
                {revealFullFingerprint ? "Hide" : "Reveal"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs border-[var(--vvu-lime)]/40 text-[color:var(--vvu-lime)] hover:bg-[var(--vvu-lime)]/10"
                onClick={onReverify}
                disabled={verifying}
              >
                {verifying ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-1 h-3 w-3" />
                )}
                Re-verify
              </Button>
            </div>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground leading-snug">
            First 8 chars of the device public-key fingerprint. Re-verifying
            generates a fresh attestation and bumps <code>lastSeenAt</code>.
          </p>
        </div>

        {/* Recent evidence */}
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
            <ClipboardList className="h-3 w-3" />
            Recent evidence
            <span
              className="ml-1 rounded-full px-1.5 py-0.5 text-[10px]"
              style={{
                background: "var(--vvu-lime)",
                color: "#0a0a0a",
              }}
            >
              {device._count.evidence}
            </span>
          </h3>
          {device.evidence.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
              No evidence records yet
            </div>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {device.evidence.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border/40 bg-background/30 px-2.5 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[11px] text-foreground truncate">
                      {ev.hash.slice(0, 16)}…
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {ev.subject}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 ${evidenceTone(
                        ev.verificationState
                      )}`}
                    >
                      {ev.verificationState}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {relativeTime(ev.observedAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent audit events */}
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
            <History className="h-3 w-3" />
            Recent audit events
          </h3>
          {auditEvents.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
              No audit events recorded
            </div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {auditEvents.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start justify-between gap-2 rounded-md border border-border/40 bg-background/30 px-2.5 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Radio
                        className={`h-3 w-3 ${auditActionTone(a.action)}`}
                      />
                      <span
                        className={`text-xs font-medium ${auditActionTone(
                          a.action
                        )}`}
                      >
                        {a.action}
                      </span>
                      {a.toState && (
                        <span className="text-[10px] text-muted-foreground">
                          → {a.toState}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      by {a.actor}
                      {a.note && ` · ${a.note}`}
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">
                    {formatDateTime(a.at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="border-t border-border/60 p-4 flex flex-wrap gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          disabled={device.status === "RETIRED"}
        >
          <Pencil className="mr-1 h-3.5 w-3.5" />
          Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onRetire}
          disabled={device.status === "RETIRED"}
          className="border-[var(--violating)]/40 text-[color:var(--violating)] hover:bg-[var(--violating)]/10"
        >
          <Ban className="mr-1 h-3.5 w-3.5" />
          Retire device
        </Button>
      </div>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  mono,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  accent?: "vvu-lime" | "vvu-ochre" | "vvu-teal";
}) {
  const color = accent ? `var(--${accent})` : undefined;
  return (
    <div className="rounded-md border border-border/40 bg-background/30 px-2.5 py-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div
        className={`mt-0.5 text-sm truncate ${mono ? "font-mono" : ""}`}
        style={color ? { color } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

// ─── Register / Edit dialogs ───────────────────────────────────────────────

interface RegisterForm {
  externalId: string;
  label: string;
  domain: DeviceDomain;
  primitive: DevicePrimitive;
  lat: number;
  lng: number;
  firmwareVersion: string;
  pricingBand: string;
}

function RegisterDeviceDialog({
  open,
  onOpenChange,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (form: RegisterForm) => void;
  submitting: boolean;
}) {
  // The form lives inside DialogContent, which Radix unmounts when closed —
  // so the form's useState initializers run fresh each time the dialog opens.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <RegisterDeviceForm
          onSubmit={onSubmit}
          onOpenChange={onOpenChange}
          submitting={submitting}
        />
      </DialogContent>
    </Dialog>
  );
}

function RegisterDeviceForm({
  onSubmit,
  onOpenChange,
  submitting,
}: {
  onSubmit: (form: RegisterForm) => void;
  onOpenChange: (v: boolean) => void;
  submitting: boolean;
}) {
  const [form, setForm] = useState<RegisterForm>({
    externalId: "",
    label: "",
    domain: "WATER",
    primitive: "STATE",
    lat: -33.96,
    lng: 25.6,
    firmwareVersion: "",
    pricingBand: "",
  });
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = () => {
    if (!form.externalId.trim() || !form.label.trim()) {
      setLocalError("External ID and label are required");
      return;
    }
    if (!/^[A-Za-z0-9_-]+$/.test(form.externalId)) {
      setLocalError(
        "External ID may only contain letters, numbers, underscores and hyphens"
      );
      return;
    }
    setLocalError(null);
    onSubmit(form);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle style={{ color: "var(--vvu-lime)" }}>
          Register device
        </DialogTitle>
        <DialogDescription>
          Add a new physical device to the registry. The device will be
          created with <code>ACTIVE</code> status.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-3 py-2 max-h-[60vh] overflow-y-auto pr-1">
          <div className="grid gap-1.5">
            <Label htmlFor="reg-external-id">External ID *</Label>
            <Input
              id="reg-external-id"
              placeholder="SENSOR_ID_8x4428"
              value={form.externalId}
              onChange={(e) =>
                setForm({ ...form, externalId: e.target.value })
              }
              className="font-mono text-sm"
            />
            <p className="text-[10px] text-muted-foreground">
              Globally unique, never changes. Use the manufacturer&apos;s
              serial or a domain-prefixed identifier.
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="reg-label">Label *</Label>
            <Input
              id="reg-label"
              placeholder="Baakens River flow meter"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="reg-domain">Domain</Label>
              <Select
                value={form.domain}
                onValueChange={(v) =>
                  setForm({ ...form, domain: v as DeviceDomain })
                }
              >
                <SelectTrigger id="reg-domain">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOMAINS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d.charAt(0) + d.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="reg-primitive">Primitive</Label>
              <Select
                value={form.primitive}
                onValueChange={(v) =>
                  setForm({ ...form, primitive: v as DevicePrimitive })
                }
              >
                <SelectTrigger id="reg-primitive">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIMITIVES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p.charAt(0) + p.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="reg-lat">Latitude</Label>
              <Input
                id="reg-lat"
                type="number"
                step="0.0001"
                value={form.lat}
                onChange={(e) =>
                  setForm({ ...form, lat: Number(e.target.value) })
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="reg-lng">Longitude</Label>
              <Input
                id="reg-lng"
                type="number"
                step="0.0001"
                value={form.lng}
                onChange={(e) =>
                  setForm({ ...form, lng: Number(e.target.value) })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="reg-fw">Firmware version (optional)</Label>
              <Input
                id="reg-fw"
                placeholder="1.4.2-hbk"
                value={form.firmwareVersion}
                onChange={(e) =>
                  setForm({ ...form, firmwareVersion: e.target.value })
                }
                className="font-mono text-sm"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="reg-band">Pricing band (optional)</Label>
              <Input
                id="reg-band"
                placeholder="R199/mo"
                value={form.pricingBand}
                onChange={(e) =>
                  setForm({ ...form, pricingBand: e.target.value })
                }
              />
            </div>
          </div>

          {localError && (
            <div className="rounded-md border border-[var(--violating)]/40 bg-[var(--violating)]/10 px-3 py-2 text-xs text-[color:var(--violating)]">
              {localError}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={submitting}
            className="border-[var(--vvu-lime)]/50 bg-[var(--vvu-lime)]/15 text-[color:var(--vvu-lime)] hover:bg-[var(--vvu-lime)]/25"
          >
            {submitting ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-1 h-4 w-4" />
            )}
            Register
          </Button>
        </DialogFooter>
    </>
  );
}

function EditDeviceDialog({
  open,
  onOpenChange,
  device,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  device: DeviceDetail | null;
  onSubmit: (patch: {
    label: string;
    firmwareVersion: string;
    pricingBand: string;
  }) => void;
  submitting: boolean;
}) {
  // The form is keyed by device.id so it remounts (and re-initializes state)
  // whenever the user opens the edit dialog on a different device.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {device && (
          <EditDeviceForm
            key={device.id}
            device={device}
            onSubmit={onSubmit}
            onOpenChange={onOpenChange}
            submitting={submitting}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditDeviceForm({
  device,
  onSubmit,
  onOpenChange,
  submitting,
}: {
  device: DeviceDetail;
  onSubmit: (patch: {
    label: string;
    firmwareVersion: string;
    pricingBand: string;
  }) => void;
  onOpenChange: (v: boolean) => void;
  submitting: boolean;
}) {
  // useState lazy initializers — run once when the form mounts.
  // The form is remounted (via key={device.id}) whenever the user opens
  // the edit dialog on a different device, so initializers re-run then.
  const [label, setLabel] = useState(device.label);
  const [firmware, setFirmware] = useState(device.firmwareVersion ?? "");
  const [pricing, setPricing] = useState(device.pricingBand ?? "");

  return (
    <>
      <DialogHeader>
        <DialogTitle style={{ color: "var(--vvu-lime)" }}>
          Edit device
        </DialogTitle>
        <DialogDescription>
          Update label, firmware version, or pricing band for{" "}
          <span className="font-mono text-xs">{device.externalId}</span>.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-3 py-2">
        <div className="grid gap-1.5">
          <Label htmlFor="edit-label">Label</Label>
          <Input
            id="edit-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="edit-fw">Firmware version</Label>
          <Input
            id="edit-fw"
            value={firmware}
            onChange={(e) => setFirmware(e.target.value)}
            placeholder="—"
            className="font-mono text-sm"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="edit-band">Pricing band</Label>
          <Input
            id="edit-band"
            value={pricing}
            onChange={(e) => setPricing(e.target.value)}
            placeholder="—"
          />
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="ghost"
          onClick={() => onOpenChange(false)}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          onClick={() =>
            onSubmit({
              label: label.trim(),
              firmwareVersion: firmware.trim(),
              pricingBand: pricing.trim(),
            })
          }
          disabled={submitting || !label.trim()}
          className="border-[var(--vvu-lime)]/50 bg-[var(--vvu-lime)]/15 text-[color:var(--vvu-lime)] hover:bg-[var(--vvu-lime)]/25"
        >
          {submitting && (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          )}
          Save changes
        </Button>
      </DialogFooter>
    </>
  );
}
