"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Braces,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Play,
  Save,
  FileCode2,
  Cpu,
  Terminal,
  Sparkles,
  Wand2,
  Copy,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { SAMPLE_POLICIES, BROKEN_POLICY_SOURCE, type ValidationResult, type PolicyNode } from "@/lib/epd";
import type { PolicyRow } from "@/lib/types";
import { SeverityBadge, StatusPill } from "./primitives";

const DEFAULT_SOURCE = SAMPLE_POLICIES[0].source;

export function PolicyStudioSection() {
  const { toast } = useToast();
  const [source, setSource] = useState(DEFAULT_SOURCE);
  const [filename, setFilename] = useState(SAMPLE_POLICIES[0].filename);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [stateJson, setStateJson] = useState(
    `{\n  "frequency": 50.01,\n  "generation": [420, 380, 510, 290, 600, 470],\n  "load": [410, 375, 500, 285, 590, 460],\n  "losses": 12,\n  "thermal_headroom": 18\n}`,
  );
  const [evaluations, setEvaluations] = useState<
    { name: string; passed: boolean; severity: string; soft: boolean; actual?: string; expected?: string }[] | null
  >(null);
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>("");
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [enforcerTab, setEnforcerTab] = useState<"rust" | "wasm" | "tla">("rust");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  // Load saved policies
  useEffect(() => {
    fetch("/api/policies")
      .then((r) => r.json())
      .then((d) => setPolicies(d.policies ?? []))
      .catch(() => {});
  }, []);

  const lines = useMemo(() => source.split("\n"), [source]);

  const syncScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const validate = async () => {
    setValidating(true);
    try {
      let state: Record<string, unknown> | undefined;
      try {
        state = stateJson.trim() ? JSON.parse(stateJson) : undefined;
      } catch {
        /* ignore parse errors — send without state */
      }
      const res = await fetch("/api/policies/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, state }),
      });
      const data: ValidationResult & { evaluations?: typeof evaluations } = await res.json();
      setResult(data);
      setEvaluations(data.evaluations ?? null);
    } catch (e) {
      toast({ title: "Validation failed", description: String(e), variant: "destructive" });
    } finally {
      setValidating(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, filename }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Save rejected",
          description: data.diagnostics?.[0]?.message ?? "invalid .epd",
          variant: "destructive",
        });
      } else {
        toast({ title: "Policy compiled & saved", description: data.policy.name });
        // refresh list
        fetch("/api/policies")
          .then((r) => r.json())
          .then((d) => setPolicies(d.policies ?? []));
      }
    } finally {
      setSaving(false);
    }
  };

  const loadSample = (name: string) => {
    const s = SAMPLE_POLICIES.find((p) => p.name === name || p.filename === name);
    if (s) {
      setSource(s.source);
      setFilename(s.filename);
      setResult(null);
      setEvaluations(null);
    }
  };

  const loadBroken = () => {
    setSource(BROKEN_POLICY_SOURCE);
    setFilename("broken.epd");
    setResult(null);
    setEvaluations(null);
  };

  const loadSaved = async (id: string) => {
    setSelectedPolicyId(id);
    if (!id) return;
    const res = await fetch(`/api/policies/${id}`);
    const data = await res.json();
    if (data.policy) {
      setSource(data.policy.source);
      setFilename(data.policy.filename);
      setResult(null);
      setEvaluations(null);
    }
  };

  const ast = result?.ast;
  const policy: PolicyNode | undefined = ast?.policies[0];
  const enforcer = result?.compiledEnforcer;

  const diagCounts = {
    error: result?.diagnostics.filter((d) => d.level === "error").length ?? 0,
    warning: result?.diagnostics.filter((d) => d.level === "warning").length ?? 0,
    info: result?.diagnostics.filter((d) => d.level === "info").length ?? 0,
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
      {/* Editor column */}
      <div className="xl:col-span-3 space-y-4">
        <Card className="bg-card/60 backdrop-blur border-border/60 overflow-hidden">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-3 py-2 bg-background/40">
            <FileCode2 className="h-4 w-4 text-verified" />
            <span className="text-sm font-medium font-mono">{filename}</span>
            <div className="ml-2 flex items-center gap-1.5">
              <Select value={filename} onValueChange={(v) => loadSample(v)}>
                <SelectTrigger className="h-7 w-[200px] text-xs">
                  <SelectValue placeholder="Samples" />
                </SelectTrigger>
                <SelectContent>
                  {SAMPLE_POLICIES.map((s) => (
                    <SelectItem key={s.filename} value={s.filename}>
                      {s.filename}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedPolicyId} onValueChange={loadSaved}>
                <SelectTrigger className="h-7 w-[180px] text-xs">
                  <SelectValue placeholder="Saved policies" />
                </SelectTrigger>
                <SelectContent>
                  {policies.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={loadBroken}>
                <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Broken demo
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={save} disabled={saving}>
                <Save className="h-3.5 w-3.5 mr-1" /> {saving ? "Saving…" : "Compile & Save"}
              </Button>
              <Button size="sm" className="h-7 text-xs bg-verified/90 hover:bg-verified text-primary-foreground" onClick={validate} disabled={validating}>
                <Play className="h-3.5 w-3.5 mr-1" /> {validating ? "Validating…" : "Validate"}
              </Button>
            </div>
          </div>

          {/* Editor with line numbers */}
          <div className="relative flex bg-background/30 h-[460px]">
            <div
              ref={gutterRef}
              className="select-none overflow-hidden py-3 pl-3 pr-2 text-right font-mono text-xs text-muted-foreground/60 bg-background/20 shrink-0"
              style={{ minWidth: 52 }}
              aria-hidden
            >
              {lines.map((_, i) => (
                <div key={i} style={{ height: "1.55em", lineHeight: "1.55em" }}>
                  {i + 1}
                </div>
              ))}
            </div>
            <Textarea
              ref={textareaRef}
              value={source}
              onChange={(e) => setSource(e.target.value)}
              onScroll={syncScroll}
              spellCheck={false}
              className="codeblock flex-1 h-full resize-none border-0 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
        </Card>

        {/* State evaluator */}
        <Card className="bg-card/60 backdrop-blur border-border/60 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-repairing" />
            <h3 className="text-sm font-semibold">Invariant Evaluation State</h3>
            <span className="ml-auto text-[10px] text-muted-foreground font-mono">JSON — evaluated on validate</span>
          </div>
          <Textarea
            value={stateJson}
            onChange={(e) => setStateJson(e.target.value)}
            spellCheck={false}
            className="codeblock min-h-[110px] font-mono text-xs"
          />
          {evaluations && evaluations.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {evaluations.map((ev, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-md border border-border/50 bg-background/40 px-2.5 py-1.5"
                >
                  {ev.passed ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-verified shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-violating shrink-0" />
                  )}
                  <span className="text-xs font-mono">{ev.name}</span>
                  <SeverityBadge severity={ev.severity as "critical" | "high" | "medium" | "low"} soft={ev.soft} />
                  <span className="ml-auto text-[11px] font-mono text-muted-foreground">
                    {ev.passed ? "PASS" : "FAIL"} · {ev.actual}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Diagnostics + AST + Enforcer column */}
      <div className="xl:col-span-2 space-y-4">
        {/* Validation summary */}
        <Card className="bg-card/60 backdrop-blur border-border/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Braces className="h-4 w-4 text-verified" />
            <h3 className="text-sm font-semibold">Validation</h3>
            {result && (
              <span className="ml-auto">
                {result.ok ? (
                  <StatusPill status="verified" label={`${policy?.invariants.length ?? 0} invariants OK`} />
                ) : (
                  <StatusPill status="violating" label={`${diagCounts.error} error(s)`} />
                )}
              </span>
            )}
          </div>
          {result ? (
            <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
              {result.diagnostics.length === 0 && (
                <p className="text-xs text-verified flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> No diagnostics — policy is well-formed.
                </p>
              )}
              {result.diagnostics.map((d, i) => {
                const Icon =
                  d.level === "error" ? XCircle : d.level === "warning" ? AlertTriangle : Info;
                const color =
                  d.level === "error"
                    ? "text-violating"
                    : d.level === "warning"
                      ? "text-repairing"
                      : "text-muted-foreground";
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-2 rounded-md border border-border/40 bg-background/40 px-2.5 py-1.5 text-xs`}
                  >
                    <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${color}`} />
                    <span className="font-mono text-[10px] text-muted-foreground shrink-0">L{d.line}</span>
                    <span className={color}>{d.message}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Press <span className="font-mono text-verified">Validate</span> to parse & semantically check the policy.
            </p>
          )}
        </Card>

        {/* Compiled enforcer */}
        <Card className="bg-card/60 backdrop-blur border-border/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Cpu className="h-4 w-4 text-verified" />
            <h3 className="text-sm font-semibold">Compiled Enforcer</h3>
            <span className="ml-auto text-[10px] text-muted-foreground font-mono">
              {enforcer ? `${enforcer.invariantFingerprints.length} guardians` : "—"}
            </span>
          </div>
          {enforcer ? (
            <Tabs value={enforcerTab} onValueChange={(v) => setEnforcerTab(v as typeof enforcerTab)}>
              <TabsList className="h-8">
                <TabsTrigger value="rust" className="text-xs">Rust</TabsTrigger>
                <TabsTrigger value="wasm" className="text-xs">Wasm</TabsTrigger>
                <TabsTrigger value="tla" className="text-xs">TLA+</TabsTrigger>
              </TabsList>
              <TabsContent value="rust">
                <pre className="codeblock mt-2 max-h-[220px] overflow-auto rounded-md border border-border/40 bg-background/50 p-2.5 text-[11px]">
                  {enforcer.rustPreview}
                </pre>
              </TabsContent>
              <TabsContent value="wasm">
                <pre className="codeblock mt-2 max-h-[220px] overflow-auto rounded-md border border-border/40 bg-background/50 p-2.5 text-[11px]">
                  {enforcer.wasmPreview}
                </pre>
              </TabsContent>
              <TabsContent value="tla">
                <pre className="codeblock mt-2 max-h-[220px] overflow-auto rounded-md border border-border/40 bg-background/50 p-2.5 text-[11px]">
                  {enforcer.tlaPreview}
                </pre>
              </TabsContent>
            </Tabs>
          ) : (
            <p className="text-xs text-muted-foreground">
              Compiled, zero-overhead guardians appear here after a successful validation.
            </p>
          )}
          {enforcer && (
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Invariant fingerprints
              </p>
              <div className="space-y-1 max-h-[100px] overflow-y-auto">
                {enforcer.invariantFingerprints.map((f) => (
                  <div key={f.name} className="flex items-center gap-2 text-[11px]">
                    <span className="font-mono text-muted-foreground truncate flex-1">{f.name}</span>
                    <span className="font-mono text-verified">{f.hash}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* AST viewer */}
        <Card className="bg-card/60 backdrop-blur border-border/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Braces className="h-4 w-4 text-repairing" />
            <h3 className="text-sm font-semibold">Parsed AST</h3>
            {policy && (
              <span className="ml-auto text-[10px] text-muted-foreground font-mono truncate max-w-[160px]">
                {policy.name}
              </span>
            )}
          </div>
          {policy ? (
            <ScrollArea className="max-h-[260px] rounded-md border border-border/40 bg-background/50">
              <pre className="codeblock p-2.5 text-[11px]">
                {formatAst(policy)}
              </pre>
            </ScrollArea>
          ) : (
            <p className="text-xs text-muted-foreground">No parsed policy yet.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function formatAst(p: PolicyNode): string {
  const lines: string[] = [];
  lines.push(`Policy "${p.name}"`);
  if (p.domain) lines.push(`  domain: ${p.domain}`);
  if (p.version) lines.push(`  version: ${p.version}`);
  if (p.shard) {
    lines.push(
      `  shard by ${p.shard.dimension ?? "?"} {`,
    );
    lines.push(`    key: "${p.shard.key}"`);
    lines.push(`    strategy: ${p.shard.strategy}`);
    if (p.shard.count) lines.push(`    count: ${p.shard.count}`);
    if (p.shard.replication) lines.push(`    replication: ${p.shard.replication}`);
    lines.push(`  }`);
  }
  lines.push(`  invariants (${p.invariants.length}):`);
  for (const inv of p.invariants) {
    lines.push(
      `    ${inv.soft ? "soft " : ""}${inv.name} [${inv.severity}]`,
    );
    lines.push(`      predicate: ${inv.rawPredicate}`);
    if (inv.message) lines.push(`      message: "${inv.message}"`);
  }
  if (p.expectMerge) {
    lines.push(`  expect merge {`);
    for (const pres of p.expectMerge.preserves) lines.push(`    preserves ${pres}`);
    if (p.expectMerge.localityPreserving !== undefined)
      lines.push(`    locality_preserving: ${p.expectMerge.localityPreserving}`);
    for (const req of p.expectMerge.requires) lines.push(`    requires ${req}`);
    if (p.expectMerge.maxDivergence !== undefined)
      lines.push(`    max_divergence: ${p.expectMerge.maxDivergence}`);
    lines.push(`  }`);
  }
  if (p.onViolation) {
    lines.push(`  on_violation {`);
    lines.push(`    strategy: ${p.onViolation.strategy}`);
    lines.push(`    objective: ${p.onViolation.objective}`);
    if (p.onViolation.maxIters) lines.push(`    max_iters: ${p.onViolation.maxIters}`);
    lines.push(`  }`);
  }
  if (p.ancestry) {
    lines.push(`  ancestry {`);
    lines.push(`    proof: ${p.ancestry.proof}`);
    lines.push(`    zk: ${p.ancestry.zk}`);
    lines.push(`    gossip: ${p.ancestry.gossip}`);
    lines.push(`    anchor: ${p.ancestry.anchor}`);
    lines.push(`  }`);
  }
  if (p.shadowBridge) {
    lines.push(`  shadow_bridge {`);
    lines.push(`    enabled: ${p.shadowBridge.enabled}`);
    if (p.shadowBridge.takeoverLatencyMs !== undefined)
      lines.push(`    takeover_latency_ms: ${p.shadowBridge.takeoverLatencyMs}`);
    if (p.shadowBridge.whatifBranching !== undefined)
      lines.push(`    whatif_branching: ${p.shadowBridge.whatifBranching}`);
    lines.push(`  }`);
  }
  if (p.exports.length) lines.push(`  exports: ${p.exports.join(", ")}`);
  return lines.join("\n");
}
