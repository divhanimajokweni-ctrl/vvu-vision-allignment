"use client";

import { useState } from "react";
import {
  Library,
  FileCode2,
  Plus,
  Zap,
  Droplets,
  HeartPulse,
  Truck,
  Car,
  Banknote,
  Network,
  ShieldCheck,
  ArrowRight,
  Copy,
  Check,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { validateEpd } from "@/lib/epd";

interface Template {
  id: string;
  name: string;
  domain: string;
  icon: typeof Zap;
  description: string;
  invariants: number;
  shard: boolean;
  zk: boolean;
  shadow: boolean;
  source: string;
}

const TEMPLATES: Template[] = [
  {
    id: "iot-fleet",
    name: "IoT Fleet Telemetry",
    domain: "iot",
    icon: Network,
    description: "Sensor fleet with bandwidth quotas, heartbeat liveness, and monotonic sequence guards.",
    invariants: 4,
    shard: true,
    zk: false,
    shadow: true,
    source: `# IoT Fleet — telemetry liveness + bandwidth invariants
policy "iot_fleet_telemetry" {
  description "Sensor fleet telemetry integrity and liveness"
  domain "iot"
  version "1.0.0"

  shard by region {
    key "geo_zone"
    strategy locality_preserving
    count 4
    replication 2
  }

  invariant "heartbeat_liveness" "Heartbeat must arrive within 60s window" {
    predicate heartbeat_age <= 60
    severity critical
  }

  invariant "sequence_monotonic" "Sequence numbers must never decrease" {
    predicate sequence >= prev_sequence
    severity high
  }

  invariant "bandwidth_quota" "Per-device bandwidth must stay under quota" {
    predicate bandwidth_mbps <= 10
    severity high
  }

  soft invariant "battery_floor" "Battery should stay above 15%" {
    predicate battery_pct >= 15
    severity medium
  }

  expect merge {
    preserves max(sequence)
    locality_preserving true
  }

  on_violation {
    strategy self_repair
    objective least_divergent
    max_iters 100
  }

  ancestry {
    proof mmr
    zk false
    gossip p2p
    anchor rekor
  }

  shadow_bridge {
    enabled true
    takeover_latency_ms 300
    whatif_branching true
    replay true
  }

  export to wasm
}
`,
  },
  {
    id: "datacenter-cooling",
    name: "Datacenter Cooling",
    domain: "datacenter",
    icon: Droplets,
    description: "Rack temperature bounds, coolant flow conservation, and CRAC failover safety.",
    invariants: 5,
    shard: true,
    zk: false,
    shadow: true,
    source: `# Datacenter cooling — thermal + flow conservation invariants
policy "datacenter_cooling_safety" {
  description "Thermal envelope and coolant flow conservation for datacenter CRAC"
  domain "datacenter"
  version "1.0.0"

  shard by subsystem {
    key "rack_row"
    strategy subsystem
    count 6
    replication 2
  }

  invariant "rack_temp_bounds" "Rack inlet temperature must stay within ASHRAE bounds" {
    predicate rack_temp in [18, 27]
    severity critical
  }

  invariant "flow_conservation" "Coolant flow in must equal flow out plus leakage" {
    predicate sum(flow_in) >= sum(flow_out) - leakage_allowance
    severity critical
  }

  invariant "crac_redundancy" "At least N+1 CRAC units must be online" {
    predicate online_crac_count >= 2
    severity high
  }

  invariant "humidity_range" "Relative humidity must stay within bounds" {
    predicate humidity in [40, 60]
    severity high
  }

  soft invariant "pue_target" "PUE should stay below 1.4" {
    predicate pue <= 1.4
    severity low
  }

  expect merge {
    preserves min(rack_temp)
    preserves min(online_crac_count)
    locality_preserving true
  }

  on_violation {
    strategy self_repair
    objective min_energy
    max_iters 80
    notify "facilities@epistemic.io"
  }

  ancestry {
    proof mmr
    zk false
    gossip mesh
    anchor rekor
  }

  shadow_bridge {
    enabled true
    takeover_latency_ms 200
    whatif_branching true
    replay true
    authoritative true
  }

  export to wasm
  export to tla
}
`,
  },
  {
    id: "patient-monitoring",
    name: "Patient Monitoring",
    domain: "healthcare",
    icon: HeartPulse,
    description: "Vital sign bounds, alarm escalation, and privacy-preserving census reconciliation.",
    invariants: 4,
    shard: true,
    zk: true,
    shadow: false,
    source: `# Patient monitoring — vital-sign safety + ZK census reconciliation
policy "patient_monitoring_safety" {
  description "Vital sign bounds and privacy-preserving census reconciliation"
  domain "healthcare"
  version "1.0.0"

  shard by facility {
    key "ward_id"
    strategy hash
    count 5
    replication 2
  }

  invariant "heart_rate_bounds" "Heart rate must stay within physiological bounds" {
    predicate heart_rate in [40, 180]
    severity critical
  }

  invariant "spo2_floor" "SpO2 must stay above 90%" {
    predicate spo2 >= 90
    severity critical
  }

  invariant "alarm_escalation" "Critical alarms must be acknowledged within 5 min" {
    predicate alarm_ack_age <= 300
    severity high
  }

  soft invariant "staff_ratio" "Nurse-to-patient ratio should stay above 1:4" {
    predicate nurse_count * 4 >= patient_count
    severity medium
  }

  expect merge {
    preserves max(alarm_ack_age)
    locality_preserving true
  }

  on_violation {
    strategy escalate
    objective max_consistency
    notify "charge-nurse@epistemic.io"
  }

  ancestry {
    proof mmr
    zk true
    gossip mesh
    anchor transparency_log
  }

  shadow_bridge {
    enabled false
  }

  export to wasm
}
`,
  },
  {
    id: "energy-market",
    name: "Energy Market Settlement",
    domain: "energy",
    icon: Banknote,
    description: "Bid/ask conservation, settlement finality, and ZK-anchored audit trail.",
    invariants: 4,
    shard: true,
    zk: true,
    shadow: false,
    source: `# Energy market — settlement conservation + ZK audit trail
policy "energy_market_settlement" {
  description "Bid/ask conservation and settlement finality for energy trading"
  domain "energy"
  version "1.0.0"

  shard by region {
    key "market_zone"
    strategy locality_preserving
    count 3
    replication 3
  }

  invariant "energy_conservation" "Cleared energy must equal demand" {
    predicate cleared_energy == demand
    severity critical
  }

  invariant "settlement_finality" "Settlements must be irreversible after finality window" {
    predicate settlement_age >= finality_window
    severity high
  }

  invariant "price_bounds" "Clearing price must stay within circuit breaker bounds" {
    predicate clearing_price in [price_floor, price_ceiling]
    severity critical
  }

  soft invariant "bid_volume_cap" "Single participant volume should stay under cap" {
    predicate max(participant_volume) <= volume_cap
    severity medium
  }

  expect merge {
    preserves sum(cleared_energy)
    preserves max(clearing_price)
    locality_preserving true
    max_divergence 0.0
  }

  on_violation {
    strategy reject
    objective max_consistency
    notify "market-ops@epistemic.io"
  }

  ancestry {
    proof mmr
    zk true
    gossip mesh
    anchor blockchain
  }

  shadow_bridge {
    enabled false
  }

  export to wasm
  export to rust
}
`,
  },
];

export function TemplateLibrarySection({ onCreate }: { onCreate?: (source: string, filename: string) => void }) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<Template | null>(null);
  const [editedSource, setEditedSource] = useState("");
  const [policyName, setPolicyName] = useState("");
  const [validation, setValidation] = useState<{ ok: boolean; invCount: number; errors: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const openTemplate = (t: Template) => {
    setSelected(t);
    setEditedSource(t.source);
    // Extract policy name from source
    const m = t.source.match(/policy "([^"]+)"/);
    setPolicyName(m ? m[1] : t.name);
    setValidation(null);
  };

  const validate = () => {
    const result = validateEpd(editedSource);
    setValidation({
      ok: result.ok,
      invCount: result.invariantCount,
      errors: result.diagnostics.filter((d) => d.level === "error").length,
    });
    if (result.ok) {
      toast({ title: "Template valid", description: `${result.invariantCount} invariants compiled` });
    } else {
      toast({ title: "Validation failed", description: `${result.diagnostics.filter((d) => d.level === "error").length} error(s)`, variant: "destructive" });
    }
  };

  const create = async () => {
    const result = validateEpd(editedSource);
    if (!result.ok) {
      toast({ title: "Cannot create — fix errors first", variant: "destructive" });
      return;
    }
    const filename = `${policyName.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}.epd`;
    try {
      const res = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: editedSource, filename }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast({ title: "Create failed", description: d.error ?? "invalid", variant: "destructive" });
      } else {
        toast({ title: "Policy created", description: `${d.policy.name} saved & compiled` });
        setSelected(null);
        onCreate?.(editedSource, filename);
      }
    } catch (e) {
      toast({ title: "Create failed", description: String(e), variant: "destructive" });
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(editedSource);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
      toast({ title: "Source copied" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  return (
    <section className="space-y-4">
      {/* Header */}
      <Card className="bg-card/60 backdrop-blur border-border/60 p-4 relative overflow-hidden">
        <div className="bg-grid absolute inset-0 opacity-20" />
        <div className="relative flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-verified/30 bg-verified/10 shrink-0">
            <Library className="h-5 w-5 text-verified" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold flex items-center gap-2">
              Policy Template Library
              <Badge variant="outline" className="border-verified/30 bg-verified/10 text-verified text-[9px] font-mono">
                {TEMPLATES.length} templates
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Start from a domain template — edit, validate, and compile a new `.epd` policy in one click.
            </p>
          </div>
        </div>
      </Card>

      {/* Template grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TEMPLATES.map((t) => {
          const Icon = t.icon;
          return (
            <Card
              key={t.id}
              className="bg-card/60 backdrop-blur border-border/60 p-4 relative overflow-hidden hover:border-verified/40 transition-colors cursor-pointer group"
              onClick={() => openTemplate(t)}
            >
              <div className="bg-grid-fine absolute inset-0 opacity-20" />
              <div className="relative">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-verified/10 border border-verified/20 flex items-center justify-center shrink-0 group-hover:bg-verified/20 transition-colors">
                    <Icon className="h-5 w-5 text-verified" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold truncate">{t.name}</h3>
                    <p className="text-[10px] font-mono text-muted-foreground">{t.domain}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
                <p className="text-xs text-muted-foreground mt-2.5 leading-relaxed line-clamp-2">{t.description}</p>
                <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                  <Badge variant="outline" className="text-[9px] border-border/60">
                    <ShieldCheck className="h-2.5 w-2.5 mr-0.5" /> {t.invariants} inv
                  </Badge>
                  {t.shard && (
                    <Badge variant="outline" className="text-[9px] border-border/60">sharded</Badge>
                  )}
                  {t.zk && (
                    <Badge variant="outline" className="text-[9px] border-verified/30 bg-verified/10 text-verified">ZK</Badge>
                  )}
                  {t.shadow && (
                    <Badge variant="outline" className="text-[9px] border-repairing/30 bg-repairing/10 text-repairing">shadow</Badge>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Template editor dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selected && (() => {
                const Icon = selected.icon;
                return <Icon className="h-4 w-4 text-verified" />;
              })()}
              {selected?.name ?? "Template"}
            </DialogTitle>
            <DialogDescription>
              {selected?.description}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 py-1">
            <span className="text-[11px] text-muted-foreground shrink-0">Policy name:</span>
            <Input
              value={policyName}
              onChange={(e) => setPolicyName(e.target.value)}
              className="h-7 text-xs font-mono"
            />
          </div>
          <div className="flex-1 min-h-0 overflow-hidden rounded-md border border-border/60 bg-background/40">
            <Textarea
              value={editedSource}
              onChange={(e) => {
                setEditedSource(e.target.value);
                setValidation(null);
              }}
              spellCheck={false}
              className="codeblock h-[320px] w-full resize-none border-0 rounded-none bg-transparent focus-visible:ring-0 text-[11px]"
            />
          </div>
          {validation && (
            <div className={cn(
              "rounded-md border px-2.5 py-1.5 text-xs",
              validation.ok
                ? "border-verified/30 bg-verified/5 text-verified"
                : "border-violating/30 bg-violating/5 text-violating",
            )}>
              {validation.ok
                ? `✓ Valid — ${validation.invCount} invariants compiled`
                : `✗ ${validation.errors} error(s) — fix the source above`}
            </div>
          )}
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={copy}>
              {copied ? <Check className="h-3.5 w-3.5 mr-1.5 text-verified" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button size="sm" variant="outline" onClick={validate}>
              <ShieldCheck className="h-3.5 w-3.5 mr-1.5" /> Validate
            </Button>
            <Button size="sm" className="bg-verified/90 hover:bg-verified text-primary-foreground" onClick={create}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Create policy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
