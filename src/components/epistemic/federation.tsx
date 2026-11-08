"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Globe2,
  Network,
  KeyRound,
  ShieldCheck,
  ArrowRight,
  Link2,
  Lock,
  Zap,
  Building2,
  Boxes,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Fingerprint,
  Server,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatValue, timeAgo } from "@/lib/format";
import { FederationGossipSim } from "./gossip-sim";

interface FedOrg {
  id: string;
  domain: string;
  name: string;
  policyCount: number;
  shardCount: number;
  zkPolicies: number;
  rootHash: string;
  anchored: number;
  totalProofs: number;
  handshake: string;
  trustLevel: "verifiable" | "anchored" | "unverified";
  policies: {
    id: string;
    name: string;
    invariantCount: number;
    shadowEnabled: boolean;
    zkEnabled: boolean;
    shardCount: number;
    proofKind: string | null;
  }[];
}

interface FedChannel {
  from: string;
  to: string;
  fromName: string;
  toName: string;
  kind: "zk_merge" | "mmr_reconcile" | "gossip_sync";
  status: "verified" | "negotiating" | "drift";
  rootHash: string;
}

interface FederationData {
  federation: FedOrg[];
  channels: FedChannel[];
  totals: {
    organizations: number;
    policies: number;
    channels: number;
    zkOrgs: number;
    globalRoot: string;
  };
}

const TRUST_META: Record<
  FedOrg["trustLevel"],
  { color: string; border: string; text: string; label: string; icon: typeof ShieldCheck }
> = {
  verifiable: {
    color: "bg-verified/10",
    border: "border-verified/40",
    text: "text-verified",
    label: "ZK-Verifiable",
    icon: ShieldCheck,
  },
  anchored: {
    color: "bg-repairing/10",
    border: "border-repairing/40",
    text: "text-repairing",
    label: "Anchored",
    icon: KeyRound,
  },
  unverified: {
    color: "bg-muted",
    border: "border-border",
    text: "text-muted-foreground",
    label: "Unverified",
    icon: AlertTriangle,
  },
};

const KIND_META: Record<
  FedChannel["kind"],
  { color: string; text: string; label: string; icon: typeof Lock }
> = {
  zk_merge: {
    color: "bg-verified/10 border-verified/40",
    text: "text-verified",
    label: "ZK Merge",
    icon: Lock,
  },
  mmr_reconcile: {
    color: "bg-repairing/10 border-repairing/40",
    text: "text-repairing",
    label: "MMR Reconcile",
    icon: KeyRound,
  },
  gossip_sync: {
    color: "bg-quarantined/10 border-quarantined/40",
    text: "text-quarantined",
    label: "Gossip Sync",
    icon: Zap,
  },
};

const STATUS_META: Record<
  FedChannel["status"],
  { text: string; label: string }
> = {
  verified: { text: "text-verified", label: "verified" },
  negotiating: { text: "text-repairing", label: "negotiating" },
  drift: { text: "text-violating", label: "drift" },
};

export function FederationSection() {
  const { toast } = useToast();
  const [data, setData] = useState<FederationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);

  const load = useCallback(() => {
    fetch("/api/federation")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 12000);
    return () => clearInterval(t);
  }, [load]);

  const reconcile = async (fromDomain: string, toDomain: string, fromName: string, toName: string) => {
    setReconciling(true);
    try {
      const res = await fetch("/api/federation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromDomain, toDomain }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast({ title: "Reconciliation failed", description: d.error, variant: "destructive" });
      } else {
        const r = d.reconciliation;
        toast({
          title: `${r.kind === "zk_merge" ? "ZK" : "MMR"} reconciliation complete`,
          description: `${fromName} ↔ ${toName} · ${r.privacy}`,
        });
      }
    } catch (e) {
      toast({ title: "Reconciliation failed", description: String(e), variant: "destructive" });
    } finally {
      setReconciling(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const { totals, federation, channels } = data;

  return (
    <section className="space-y-4">
      {/* Header banner */}
      <Card className="bg-card/60 backdrop-blur border-border/60 p-4 relative overflow-hidden">
        <div className="bg-grid absolute inset-0 opacity-20" />
        <div className="relative flex flex-wrap items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-verified/30 bg-verified/10 glow-verified shrink-0">
            <Globe2 className="h-5 w-5 text-verified" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold flex items-center gap-2">
              epistemic:// Federation
              <Badge variant="outline" className="border-verified/30 bg-verified/10 text-verified text-[9px] font-mono">
                verifiable state sync
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Competing organizations reconciling operational realities — the TCP/IP of trustworthy multi-agent coordination.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Global root</div>
              <div className="font-mono text-sm text-verified">{totals.globalRoot}</div>
            </div>
            <div className="h-10 w-px bg-border/60" />
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Orgs / ZK-enabled</div>
              <div className="font-mono text-sm">
                <span className="text-foreground">{totals.organizations}</span>
                <span className="text-muted-foreground mx-1">/</span>
                <span className="text-verified">{totals.zkOrgs}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryStat icon={Building2} label="Organizations" value={totals.organizations} accent="verified" />
        <SummaryStat icon={Boxes} label="Policies" value={totals.policies} />
        <SummaryStat icon={Network} label="Reconcile channels" value={totals.channels} accent="repairing" />
        <SummaryStat icon={KeyRound} label="ZK-verifiable orgs" value={totals.zkOrgs} accent="verified" />
      </div>

      {/* Gossip simulation */}
      <FederationGossipSim orgs={federation.map((o) => ({ id: o.id, name: o.name, zkPolicies: o.zkPolicies }))} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Federation map (orgs + channels) */}
        <Card className="lg:col-span-2 bg-card/60 backdrop-blur border-border/60 p-4 relative overflow-hidden">
          <div className="bg-grid-fine absolute inset-0 opacity-20" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <Network className="h-4 w-4 text-verified" />
              <h3 className="text-sm font-semibold">Federation topology</h3>
              <span className="ml-auto text-[10px] text-muted-foreground font-mono">
                {federation.length} peers · {channels.length} channels
              </span>
            </div>

            {/* Org grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {federation.map((org) => (
                <OrgCard key={org.id} org={org} />
              ))}
            </div>

            {/* Channels */}
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2">
                <Link2 className="h-3.5 w-3.5 text-repairing" />
                <span className="text-xs font-semibold">Cross-org reconciliation channels</span>
              </div>
              <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
                {channels.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">No channels — need ≥2 organizations.</p>
                )}
                {channels.map((ch, i) => {
                  const km = KIND_META[ch.kind];
                  const sm = STATUS_META[ch.status];
                  const KIcon = km.icon;
                  return (
                    <div
                      key={i}
                      className={cn(
                        "flex items-center gap-2 rounded-md border bg-background/40 px-2.5 py-1.5",
                        km.color,
                      )}
                    >
                      <KIcon className={cn("h-3.5 w-3.5 shrink-0", km.text)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="font-medium truncate">{ch.fromName}</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate">{ch.toName}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-[10px] text-muted-foreground">{ch.rootHash}</span>
                          <span className={cn("text-[10px] font-mono uppercase", sm.text)}>· {sm.label}</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={reconciling}
                        onClick={() => {
                          const fromOrg = federation.find((o) => o.id === ch.from);
                          const toOrg = federation.find((o) => o.id === ch.to);
                          if (fromOrg && toOrg) reconcile(fromOrg.domain, toOrg.domain, fromOrg.name, toOrg.name);
                        }}
                        className="h-6 px-2 text-[10px] border-verified/30 bg-verified/10 text-verified hover:bg-verified/20 shrink-0"
                      >
                        <RefreshCw className={cn("h-3 w-3 mr-1", reconciling && "animate-spin")} />
                        reconcile
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>

        {/* Side: protocol explainer + handshake log */}
        <div className="space-y-4">
          <Card className="bg-card/60 backdrop-blur border-border/60 p-4 relative overflow-hidden">
            <div className="bg-grid-fine absolute inset-0 opacity-20" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <Server className="h-4 w-4 text-verified" />
                <h3 className="text-sm font-semibold">epistemic:// protocol</h3>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Every organization speaks a common epistemic handshake. MMR ancestry proofs let any peer verify a merge without seeing full history; with ZK enabled, the proof is a SNARK over the state delta — enabling trustless, privacy-preserving reconciliation.
              </p>
              <div className="mt-3 space-y-1.5">
                <ProtoRow step="1" label="handshake" detail="epistemic://<domain>/<root>" />
                <ProtoRow step="2" label="ancestry proof" detail="MMR path + ZK-SNARK" />
                <ProtoRow step="3" label="invariant check" detail="compiled enforcer (Wasm)" />
                <ProtoRow step="4" label="merge" detail="least-divergent correction" />
              </div>
            </div>
          </Card>

          <Card className="bg-card/60 backdrop-blur border-border/60 p-4 relative overflow-hidden">
            <div className="bg-grid-fine absolute inset-0 opacity-20" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <Fingerprint className="h-4 w-4 text-repairing" />
                <h3 className="text-sm font-semibold">Trust posture</h3>
              </div>
              <div className="space-y-2">
                {federation.map((o) => {
                  const tm = TRUST_META[o.trustLevel];
                  const TIcon = tm.icon;
                  return (
                    <div key={o.id} className="flex items-center gap-2 text-xs">
                      <TIcon className={cn("h-3.5 w-3.5 shrink-0", tm.text)} />
                      <span className="truncate flex-1">{o.name}</span>
                      <span className={cn("font-mono text-[10px]", tm.text)}>{tm.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

function OrgCard({ org }: { org: FedOrg }) {
  const tm = TRUST_META[org.trustLevel];
  const TIcon = tm.icon;
  return (
    <div
      className={cn(
        "rounded-lg border bg-background/40 p-3 relative overflow-hidden transition-colors hover:bg-background/60",
        tm.border,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm font-semibold truncate">{org.name}</span>
          </div>
          <div className="font-mono text-[10px] text-muted-foreground mt-0.5 truncate">{org.handshake}</div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase shrink-0",
            tm.color,
            tm.border,
            tm.text,
          )}
        >
          <TIcon className="h-2.5 w-2.5" />
          {tm.label}
        </span>
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
        <MiniStat label="policies" value={org.policyCount} />
        <MiniStat label="shards" value={org.shardCount} />
        <MiniStat label="proofs" value={org.totalProofs} />
      </div>
      <div className="mt-2 flex items-center gap-1 flex-wrap">
        {org.zkPolicies > 0 && (
          <Badge variant="outline" className="border-verified/30 bg-verified/10 text-verified text-[9px] gap-0.5 px-1.5">
            <Lock className="h-2.5 w-2.5" /> ZK
          </Badge>
        )}
        {org.anchored > 0 && (
          <Badge variant="outline" className="border-repairing/30 bg-repairing/10 text-repairing text-[9px] gap-0.5 px-1.5 whitespace-nowrap">
            <KeyRound className="h-2.5 w-2.5" /> {org.anchored} anch
          </Badge>
        )}
        <span className="ml-auto font-mono text-[10px] text-muted-foreground" title={org.rootHash}>
          {org.rootHash.slice(0, 8)}
        </span>
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
  icon: typeof Globe2;
  label: string;
  value: number;
  accent?: "verified" | "repairing";
}) {
  const color =
    accent === "verified"
      ? "text-verified"
      : accent === "repairing"
        ? "text-repairing"
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

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded bg-muted/30 py-1">
      <div className="text-sm font-semibold tabular-nums">{value}</div>
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function ProtoRow({ step, label, detail }: { step: string; label: string; detail: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border/40 bg-background/40 px-2 py-1">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-verified/15 text-verified text-[10px] font-mono font-semibold shrink-0">
        {step}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium">{label}</div>
        <div className="font-mono text-[10px] text-muted-foreground truncate">{detail}</div>
      </div>
    </div>
  );
}
