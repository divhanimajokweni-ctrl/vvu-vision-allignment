"use client";

import { useMemo, useState } from "react";
import {
  CircuitBoard,
  Lock,
  KeyRound,
  ArrowRight,
  Cpu,
  ShieldCheck,
  Zap,
  FileKey,
  Eye,
  EyeOff,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { SAMPLE_POLICIES, validateEpd, type PolicyNode, type InvariantNode } from "@/lib/epd";

interface CircuitGate {
  id: string;
  type: "input" | "constraint" | "aggregate" | "output";
  label: string;
  sublabel?: string;
  x: number;
  y: number;
  invariant?: string;
}

interface CircuitWire {
  from: string;
  to: string;
  kind: "private" | "public";
}

interface Circuit {
  gates: CircuitGate[];
  wires: CircuitWire[];
  publicInputs: string[];
  privateInputs: string[];
  constraintCount: number;
  estimatedRows: number;
  provingKeySize: string;
  verificationKeySize: string;
}

/**
 * Synthesize a ZK-SNARK circuit structure from a policy's invariants.
 * Each invariant becomes a constraint gate; the state fields become private
 * inputs; the MMR root + pass/fail become public outputs.
 */
function synthesizeCircuit(policy: PolicyNode): Circuit {
  const gates: CircuitGate[] = [];
  const wires: CircuitWire[] = [];

  // Collect all referenced fields (private inputs)
  const fields = new Set<string>();
  for (const inv of policy.invariants) {
    if (inv.predicate) {
      extractIdents(inv.predicate, fields);
    }
  }
  const privateInputs = Array.from(fields);
  const publicInputs = ["mmr_root", "policy_hash", "nonce"];

  // Layout: private inputs on the left, constraints in the middle, aggregate on the right
  const inputX = 40;
  const constraintX = 220;
  const aggregateX = 420;
  const outputX = 560;

  // Input gates (private)
  privateInputs.forEach((f, i) => {
    const y = 50 + i * 42;
    gates.push({
      id: `in-${f}`,
      type: "input",
      label: f,
      sublabel: "private",
      x: inputX,
      y,
    });
    // wire to each constraint that references it
    policy.invariants.forEach((inv, j) => {
      const invFields = new Set<string>();
      if (inv.predicate) extractIdents(inv.predicate, invFields);
      if (invFields.has(f)) {
        const cy = 50 + j * 52;
        wires.push({ from: `in-${f}`, to: `c-${inv.name}`, kind: "private" });
      }
    });
  });

  // Constraint gates (one per invariant)
  policy.invariants.forEach((inv, j) => {
    const y = 50 + j * 52;
    gates.push({
      id: `c-${inv.name}`,
      type: "constraint",
      label: inv.name,
      sublabel: inv.severity + (inv.soft ? " · soft" : ""),
      x: constraintX,
      y,
      invariant: inv.name,
    });
    wires.push({ from: `c-${inv.name}`, to: `agg-all`, kind: "private" });
  });

  // Aggregate gate
  gates.push({
    id: "agg-all",
    type: "aggregate",
    label: "ALL(invariants)",
    sublabel: "conjunction",
    x: aggregateX,
    y: 50 + (policy.invariants.length - 1) * 26,
  });

  // Public outputs
  gates.push({
    id: "out-pass",
    type: "output",
    label: "pass",
    sublabel: "public",
    x: outputX,
    y: 50 + (policy.invariants.length - 1) * 26 - 20,
  });
  gates.push({
    id: "out-root",
    type: "output",
    label: "new_mmr_root",
    sublabel: "public",
    x: outputX,
    y: 50 + (policy.invariants.length - 1) * 26 + 20,
  });
  wires.push({ from: "agg-all", to: "out-pass", kind: "public" });
  wires.push({ from: "agg-all", to: "out-root", kind: "public" });

  // Public input gates (top)
  publicInputs.forEach((p, i) => {
    gates.push({
      id: `pub-${p}`,
      type: "input",
      label: p,
      sublabel: "public",
      x: inputX,
      y: 50 + (privateInputs.length + i) * 42 + 20,
    });
    wires.push({ from: `pub-${p}`, to: "agg-all", kind: "public" });
  });

  // Estimated metrics
  const constraintCount = policy.invariants.length + privateInputs.length * 2 + 4;
  const estimatedRows = constraintCount * 8 + privateInputs.length * 3;
  const provingKeySize = `${(estimatedRows * 0.12).toFixed(1)} MB`;
  const verificationKeySize = `${(constraintCount * 0.04 + 0.8).toFixed(1)} KB`;

  return {
    gates,
    wires,
    publicInputs,
    privateInputs,
    constraintCount,
    estimatedRows,
    provingKeySize,
    verificationKeySize,
  };
}

function extractIdents(expr: unknown, out: Set<string>) {
  if (!expr || typeof expr !== "object") return;
  const e = expr as Record<string, unknown>;
  if (e.kind === "ident") {
    out.add(e.name as string);
  } else if (e.kind === "unary") {
    extractIdents(e.operand, out);
  } else if (e.kind === "binary" || e.kind === "logic" || e.kind === "compare") {
    extractIdents(e.left, out);
    extractIdents(e.right, out);
  } else if (e.kind === "in") {
    extractIdents(e.value, out);
    extractIdents((e.range as unknown[])[0], out);
    extractIdents((e.range as unknown[])[1], out);
  } else if (e.kind === "call") {
    (e.args as unknown[]).forEach((a) => extractIdents(a, out));
  }
}

export function ZkCircuitSection() {
  const [filename, setFilename] = useState(SAMPLE_POLICIES[0].filename);
  const [showWires, setShowWires] = useState(true);
  const [revealPrivate, setRevealPrivate] = useState(false);

  const { policy, circuit } = useMemo(() => {
    const sample = SAMPLE_POLICIES.find((s) => s.filename === filename);
    if (!sample) return { policy: null, circuit: null };
    const result = validateEpd(sample.source);
    const p = result.ast?.policies[0];
    if (!p) return { policy: null, circuit: null };
    return { policy: p, circuit: synthesizeCircuit(p) };
  }, [filename]);

  if (!policy || !circuit) {
    return (
      <Card className="bg-card/60 backdrop-blur border-border/60 p-8 text-center">
        <p className="text-sm text-muted-foreground">Select a valid policy.</p>
      </Card>
    );
  }

  const zkEnabled = policy.ancestry?.zk ?? false;
  const width = 640;
  const height = Math.max(280, 80 + Math.max(circuit.privateInputs.length, policy.invariants.length) * 46);

  return (
    <section className="space-y-4">
      {/* Header */}
      <Card className="bg-card/60 backdrop-blur border-border/60 p-4 relative overflow-hidden">
        <div className="bg-grid absolute inset-0 opacity-20" />
        <div className="relative flex flex-wrap items-center gap-3">
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg border shrink-0",
            zkEnabled ? "border-verified/30 bg-verified/10 glow-verified" : "border-border/60 bg-muted/30",
          )}>
            <CircuitBoard className={cn("h-5 w-5", zkEnabled ? "text-verified" : "text-muted-foreground")} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold flex items-center gap-2">
              ZK Proof Circuit
              {zkEnabled ? (
                <Badge variant="outline" className="border-verified/30 bg-verified/10 text-verified text-[9px] font-mono">
                  <Lock className="h-2.5 w-2.5 mr-0.5" /> zk-SNARK enabled
                </Badge>
              ) : (
                <Badge variant="outline" className="border-border/60 bg-muted/30 text-muted-foreground text-[9px] font-mono">
                  <EyeOff className="h-2.5 w-2.5 mr-0.5" /> zk disabled in policy
                </Badge>
              )}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Each invariant compiles to a constraint gate; state fields are private witnesses; the MMR root + pass/fail are public outputs.
            </p>
          </div>
          <Select value={filename} onValueChange={setFilename}>
            <SelectTrigger className="h-8 w-[200px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SAMPLE_POLICIES.map((s) => (
                <SelectItem key={s.filename} value={s.filename}>
                  {s.filename}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Circuit metrics */}
        <div className="lg:col-span-1 space-y-3">
          <Card className="bg-card/60 backdrop-blur border-border/60 p-4 relative overflow-hidden">
            <div className="bg-grid-fine absolute inset-0 opacity-20" />
            <div className="relative space-y-2.5">
              <div className="flex items-center gap-2 mb-1">
                <Cpu className="h-3.5 w-3.5 text-verified" />
                <span className="text-xs font-semibold">Circuit metrics</span>
              </div>
              <Metric label="Constraints" value={String(circuit.constraintCount)} />
              <Metric label="R1CS rows" value={circuit.estimatedRows.toLocaleString()} />
              <Metric label="Private witnesses" value={String(circuit.privateInputs.length)} />
              <Metric label="Public inputs" value={String(circuit.publicInputs.length)} />
              <Metric label="Proving key" value={circuit.provingKeySize} accent="repairing" />
              <Metric label="Verification key" value={circuit.verificationKeySize} accent="verified" />
            </div>
          </Card>

          <Card className="bg-card/60 backdrop-blur border-border/60 p-4 relative overflow-hidden">
            <div className="bg-grid-fine absolute inset-0 opacity-20" />
            <div className="relative space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <Eye className="h-3.5 w-3.5 text-repairing" />
                <span className="text-xs font-semibold">View options</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">show wires</span>
                <Switch checked={showWires} onCheckedChange={setShowWires} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">reveal private</span>
                <Switch checked={revealPrivate} onCheckedChange={setRevealPrivate} />
              </div>
              <p className="text-[10px] text-muted-foreground/70 mt-1">
                {revealPrivate
                  ? "Private witness values visible (debug mode)"
                  : "Private witnesses hidden (production ZK)"}
              </p>
            </div>
          </Card>

          <Card className="bg-card/60 backdrop-blur border-quarantined/30 p-4 relative overflow-hidden">
            <div className="bg-grid-fine absolute inset-0 opacity-20" />
            <div className="relative space-y-1.5">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="h-3.5 w-3.5 text-quarantined" />
                <span className="text-xs font-semibold">Privacy guarantee</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {zkEnabled
                  ? "A prover convinces a verifier that the proposed merge satisfies all invariants without revealing the underlying state. Only the MMR root and pass/fail are public."
                  : "ZK is disabled for this policy. Enable ancestry.zk = true in the .epd source to compile a SNARK."}
              </p>
            </div>
          </Card>
        </div>

        {/* Circuit diagram */}
        <Card className="lg:col-span-3 bg-card/60 backdrop-blur border-border/60 p-4 relative overflow-hidden">
          <div className="bg-grid-fine absolute inset-0 opacity-20" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <CircuitBoard className="h-4 w-4 text-verified" />
              <span className="text-sm font-semibold">{policy.name} · constraint graph</span>
              <div className="ml-auto flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-3 rounded-sm bg-verified/60" /> public wire
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-3 rounded-sm bg-muted-foreground/40" /> private witness
                </span>
              </div>
            </div>
            <div className="overflow-x-auto rounded-md border border-border/40 bg-background/40 p-2">
              <svg
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                className="block"
                role="img"
                aria-label="ZK proof circuit diagram"
              >
                {/* Wires */}
                {showWires && circuit.wires.map((w, i) => {
                  const from = circuit.gates.find((g) => g.id === w.from);
                  const to = circuit.gates.find((g) => g.id === w.to);
                  if (!from || !to) return null;
                  const isPublic = w.kind === "public";
                  return (
                    <path
                      key={`w-${i}`}
                      d={bezierPath(from.x + 90, from.y, to.x - 10, to.y)}
                      fill="none"
                      stroke={isPublic ? "oklch(0.78 0.16 160)" : "oklch(0.42 0.01 165)"}
                      strokeWidth={isPublic ? 1.4 : 1}
                      strokeOpacity={isPublic ? 0.7 : 0.45}
                      strokeDasharray={isPublic ? "0" : "4 3"}
                    />
                  );
                })}
                {/* Gates */}
                {circuit.gates.map((g) => (
                  <GateShape key={g.id} gate={g} revealPrivate={revealPrivate} />
                ))}
              </svg>
            </div>

            {/* Legend */}
            <div className="mt-2 flex items-center gap-3 flex-wrap text-[10px] text-muted-foreground">
              <LegendItem color="bg-verified/20 border-verified/40" label="input" />
              <LegendItem color="bg-repairing/20 border-repairing/40" label="constraint" />
              <LegendItem color="bg-quarantined/20 border-quarantined/40" label="aggregate" />
              <LegendItem color="bg-verified/30 border-verified/50" label="output" />
            </div>
          </div>
        </Card>
      </div>

      {/* Proving flow */}
      <Card className="bg-card/60 backdrop-blur border-border/60 p-4 relative overflow-hidden">
        <div className="bg-grid absolute inset-0 opacity-20" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <FileKey className="h-4 w-4 text-verified" />
            <span className="text-sm font-semibold">Proving &amp; verification flow</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <FlowStep n={1} icon={Cpu} title="witness" detail="state delta + ancestry" />
            <FlowStep n={2} icon={CircuitBoard} title="R1CS" detail="constraint system" />
            <FlowStep n={3} icon={Zap} title="prove" detail="SNARK generation" accent="repairing" />
            <FlowStep n={4} icon={ArrowRight} title="submit" detail="proof + public I/O" />
            <FlowStep n={5} icon={ShieldCheck} title="verify" detail="constant-time check" accent="verified" />
          </div>
        </div>
      </Card>
    </section>
  );
}

function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const cx1 = x1 + (x2 - x1) * 0.4;
  const cy1 = y1;
  const cx2 = x2 - (x2 - x1) * 0.4;
  const cy2 = y2;
  return `M ${x1},${y1} C ${cx1},${cy1} ${cx2},${cy2} ${x2},${y2}`;
}

function GateShape({ gate, revealPrivate }: { gate: CircuitGate; revealPrivate: boolean }) {
  const w = 90;
  const h = 30;
  const x = gate.x;
  const y = gate.y - h / 2;
  const isPrivate = gate.sublabel === "private";
  const hidden = isPrivate && !revealPrivate;

  const config: Record<
    CircuitGate["type"],
    { fill: string; stroke: string; text: string }
  > = {
    input: { fill: "oklch(0.22 0.014 168)", stroke: "oklch(0.45 0.01 165)", text: "oklch(0.85 0.01 165)" },
    constraint: { fill: "oklch(0.25 0.03 80 / 0.6)", stroke: "oklch(0.80 0.15 80 / 0.7)", text: "oklch(0.90 0.10 80)" },
    aggregate: { fill: "oklch(0.25 0.03 40 / 0.6)", stroke: "oklch(0.70 0.13 40 / 0.8)", text: "oklch(0.90 0.10 40)" },
    output: { fill: "oklch(0.22 0.05 160 / 0.7)", stroke: "oklch(0.78 0.16 160)", text: "oklch(0.90 0.12 160)" },
  };
  const c = config[gate.type];

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={4}
        fill={hidden ? "oklch(0.20 0.01 165)" : c.fill}
        stroke={hidden ? "oklch(0.35 0.02 165)" : c.stroke}
        strokeWidth={1.2}
        strokeDasharray={hidden ? "3 2" : "0"}
      />
      <text
        x={x + w / 2}
        y={y + 13}
        textAnchor="middle"
        fontSize={9.5}
        fontFamily="var(--font-geist-mono), monospace"
        fill={hidden ? "oklch(0.50 0.02 165)" : c.text}
        fontWeight={gate.type === "output" || gate.type === "aggregate" ? 600 : 400}
      >
        {hidden ? "•••••" : gate.label.length > 14 ? gate.label.slice(0, 12) + "…" : gate.label}
      </text>
      <text
        x={x + w / 2}
        y={y + 24}
        textAnchor="middle"
        fontSize={7}
        fill="oklch(0.55 0.01 165)"
      >
        {gate.sublabel}
      </text>
    </g>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: "verified" | "repairing" }) {
  const color = accent === "verified" ? "text-verified" : accent === "repairing" ? "text-repairing" : "text-foreground";
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={cn("font-mono text-xs font-medium", color)}>{value}</span>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-3 w-4 rounded-sm border", color)} />
      {label}
    </span>
  );
}

function FlowStep({
  n,
  icon: Icon,
  title,
  detail,
  accent,
}: {
  n: number;
  icon: typeof Cpu;
  title: string;
  detail: string;
  accent?: "verified" | "repairing";
}) {
  const color = accent === "verified" ? "text-verified border-verified/30 bg-verified/5" : accent === "repairing" ? "text-repairing border-repairing/30 bg-repairing/5" : "text-muted-foreground border-border/60 bg-background/40";
  return (
    <div className={cn("rounded-md border p-2.5 relative", color)}>
      <div className="flex items-center gap-1.5">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-current/15 text-[9px] font-mono font-semibold">
          {n}
        </span>
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs font-semibold">{title}</span>
      </div>
      <p className="text-[10px] text-muted-foreground mt-1 font-mono">{detail}</p>
    </div>
  );
}
