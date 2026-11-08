"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Terminal,
  Play,
  RotateCw,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Server,
  FileText,
  FlaskConical,
  KeyRound,
  List,
  Settings2,
  Loader2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────────────────
// epd-cli mini-service — reached through the Caddy gateway via ?XTransformPort=3031
// ────────────────────────────────────────────────────────────────────────────
const CLI_PORT = "3031";
const CLI_BASE = (path: string) =>
  path.includes("?") ? `${path}&XTransformPort=${CLI_PORT}` : `${path}?XTransformPort=${CLI_PORT}`;

interface CliSample {
  name: string;
  filename: string;
  source: string;
}

interface CliRunResponse {
  ok: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  result?: unknown;
}

interface TerminalEntry {
  id: string;
  prompt: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  ranAt: number;
}

// ────────────────────────────────────────────────────────────────────────────
// ANSI SGR → Tailwind class map (no blue/indigo per design system)
// ────────────────────────────────────────────────────────────────────────────
const ANSI_CLASS: Record<string, string> = {
  "0": "", // reset
  "1": "font-bold",
  "2": "opacity-60",
  "31": "text-violating",
  "32": "text-verified",
  "33": "text-repairing",
  "34": "text-chart-2", // blue → teal (design system forbids blue)
  "35": "text-chart-5", // magenta → warm violet
  "36": "text-chart-2", // cyan → teal
  "90": "text-muted-foreground", // bright black / gray
};

/**
 * Render ANSI-colored text (SGR codes only) as a sequence of styled spans.
 * Splits on `\x1b[...m` escape sequences and applies the accumulated class
 * set to each text segment. Handles combined codes like `\x1b[1;36m`.
 */
function renderAnsi(text: string): React.ReactNode[] {
  if (!text) return [];
  const parts = text.split(/\x1b\[(\d+(?:;\d+)*)m/);
  const nodes: React.ReactNode[] = [];
  let active = new Set<string>();
  let key = 0;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (i % 2 === 1) {
      // escape code segment (one or more ;-separated codes)
      for (const code of part.split(";")) {
        if (code === "0" || code === "") {
          active = new Set();
        } else {
          const cls = ANSI_CLASS[code];
          if (cls) active.add(cls);
        }
      }
    } else if (part) {
      const cls = Array.from(active).join(" ");
      // Preserve whitespace by wrapping in a span; split newlines so React
      // renders them within the pre-formatted container.
      nodes.push(
        <span key={key++} className={cls || undefined}>
          {part}
        </span>,
      );
    }
  }
  return nodes;
}

const DEFAULT_STATE = `{
  "geo_region": "europe-west",
  "frequency": 50.01,
  "generation": [420, 380, 510, 290, 600, 470],
  "load": [410, 375, 500, 285, 590, 460],
  "losses": 12,
  "thermal_headroom": 18
}`;

const VIOLATING_STATE = `{
  "geo_region": "europe-west",
  "frequency": 50.6,
  "thermal_headroom": 6
}`;

// Safe baseline used as the `current` state for the repair command.
const SAFE_CURRENT_STATE = {
  geo_region: "europe-west",
  frequency: 50.0,
  generation: [420, 380, 510, 290, 600, 470],
  load: [410, 375, 500, 285, 590, 460],
  losses: 12,
  thermal_headroom: 18,
};

type CommandKind = "validate" | "repair" | "proof" | "list-samples";

export function CliTerminalSection() {
  const { toast } = useToast();
  const [samples, setSamples] = useState<CliSample[]>([]);
  const [samplesLoading, setSamplesLoading] = useState(true);
  const [selectedSample, setSelectedSample] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [stateText, setStateText] = useState<string>(DEFAULT_STATE);
  const [strict, setStrict] = useState<boolean>(false);
  const [history, setHistory] = useState<TerminalEntry[]>([]);
  const [running, setRunning] = useState<CommandKind | null>(null);
  const [health, setHealth] = useState<{ ok: boolean; checkedAt: number } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever history grows.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  // Load samples on mount.
  const loadSamples = useCallback(async () => {
    setSamplesLoading(true);
    try {
      const r = await fetch(CLI_BASE("/api/samples"));
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d: { samples: CliSample[] } = await r.json();
      const list = d.samples ?? [];
      setSamples(list);
      if (list.length > 0 && !source) {
        setSource(list[0].source);
        setSelectedSample(list[0].filename);
      }
    } catch (e) {
      toast({
        title: "Failed to load samples",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSamplesLoading(false);
    }
  }, [source, toast]);

  useEffect(() => {
    loadSamples();
  }, [loadSamples]);

  // Poll epd-cli health every 10s.
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const r = await fetch(CLI_BASE("/api/health"));
        const d = await r.json();
        if (cancelled) return;
        setHealth({ ok: !!d.ok, checkedAt: Date.now() });
      } catch {
        if (!cancelled) setHealth({ ok: false, checkedAt: Date.now() });
      }
    };
    check();
    const t = setInterval(check, 10_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const loadSample = useCallback(
    (filename: string) => {
      const s = samples.find((x) => x.filename === filename);
      if (s) {
        setSource(s.source);
        setSelectedSample(filename);
        toast({ title: `Loaded ${s.filename}`, description: s.name });
      }
    },
    [samples, toast],
  );

  const parseState = useCallback(
    (label: string): Record<string, unknown> | null => {
      try {
        return JSON.parse(stateText);
      } catch (e) {
        toast({
          title: `Invalid ${label} JSON`,
          description: e instanceof Error ? e.message : "Parse error",
          variant: "destructive",
        });
        return null;
      }
    },
    [stateText, toast],
  );

  const runCommand = useCallback(
    async (kind: CommandKind) => {
      if (kind !== "list-samples" && !source.trim()) {
        toast({ title: "Source is empty", description: "Load a sample or write a .epd policy.", variant: "destructive" });
        return;
      }
      let body: Record<string, unknown>;
      let promptCmd: string;
      if (kind === "validate") {
        const s = parseState("state");
        if (!s) return;
        body = { command: "validate", source, state: s, strict };
        promptCmd = `validate${strict ? " --strict" : ""} (inline source) --state (inline)`;
      } else if (kind === "repair") {
        const proposed = parseState("state");
        if (!proposed) return;
        body = { command: "repair", source, current: SAFE_CURRENT_STATE, proposed };
        promptCmd = `repair (inline source) --current (safe baseline) --proposed (inline)`;
      } else if (kind === "proof") {
        body = { command: "proof", source, index: 0 };
        promptCmd = `proof (inline source) --index 0`;
      } else {
        body = { command: "list-samples" };
        promptCmd = `list-samples`;
      }

      setRunning(kind);
      try {
        const r = await fetch(CLI_BASE("/api/run"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d: CliRunResponse = await r.json();
        const entry: TerminalEntry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          prompt: `$ epd-cli ${promptCmd}`,
          stdout: d.stdout ?? "",
          stderr: d.stderr ?? "",
          exitCode: d.exitCode,
          ranAt: Date.now(),
        };
        setHistory((prev) => [...prev, entry]);
        toast({
          title: d.exitCode === 0 ? "Command succeeded" : "Command failed",
          description: `exit ${d.exitCode} · ${(d.stdout ?? "").length} bytes output`,
          variant: d.exitCode === 0 ? "default" : "destructive",
        });
      } catch (e) {
        const entry: TerminalEntry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          prompt: `$ epd-cli ${promptCmd}`,
          stdout: "",
          stderr: e instanceof Error ? e.message : "Network error",
          exitCode: -1,
          ranAt: Date.now(),
        };
        setHistory((prev) => [...prev, entry]);
        toast({
          title: "Request failed",
          description: e instanceof Error ? e.message : "Unknown error",
          variant: "destructive",
        });
      } finally {
        setRunning(null);
      }
    },
    [source, stateText, strict, parseState, toast],
  );

  const clearTerminal = useCallback(() => {
    setHistory([]);
    toast({ title: "Terminal cleared" });
  }, [toast]);

  const loadViolating = useCallback(() => {
    setStateText(VIOLATING_STATE);
    toast({
      title: "Loaded violating state",
      description: "frequency:50.6 breaches freq_bounds [49.8, 50.2]",
    });
  }, [toast]);

  const loadSafe = useCallback(() => {
    setStateText(DEFAULT_STATE);
    toast({ title: "Loaded safe state", description: "frequency:50.01 — all invariants pass" });
  }, [toast]);

  const online = health?.ok ?? false;

  const cmdButton = (kind: CommandKind, label: string, icon: React.ReactNode, primary?: boolean) => (
    <Button
      onClick={() => runCommand(kind)}
      disabled={running !== null}
      variant="outline"
      className={cn(
        "h-8 gap-1.5",
        primary
          ? "border-verified/40 bg-verified/15 text-verified hover:bg-verified/25"
          : "border-border/60 bg-card/40 text-foreground hover:bg-muted/40",
      )}
    >
      {running === kind ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      <span className="font-mono text-xs">{label}</span>
    </Button>
  );

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-verified/30 bg-verified/10 glow-verified">
            <Terminal className="h-4.5 w-4.5 text-verified" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">epd-cli Terminal</h2>
            <p className="text-xs text-muted-foreground">
              Run the real <span className="font-mono">epd-cli</span> against custom{" "}
              <span className="font-mono text-verified">.epd</span> policy files —
              validate, repair, prove ancestry.
            </p>
          </div>
        </div>

        {/* Health status badge */}
        <Badge
          variant="outline"
          className={cn(
            "gap-1.5 text-[10px] font-mono",
            online
              ? "border-verified/30 bg-verified/10 text-verified"
              : "border-violating/30 bg-violating/10 text-violating",
          )}
        >
          <Server className={cn("h-3 w-3", !online && "animate-epistemic-pulse")} />
          {online ? `epd-cli online · :${CLI_PORT}` : "offline"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* LEFT — composer (2/5) */}
        <div className="space-y-3 lg:col-span-2">
          <Card className="bg-card/60 backdrop-blur border-border/60 p-4 relative overflow-hidden">
            <div className="bg-grid-fine absolute inset-0 opacity-20" />
            <div className="relative space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-repairing" />
                  <span className="text-sm font-semibold text-foreground">Command composer</span>
                </div>
                <Badge variant="outline" className="border-border/60 text-[9px] font-mono">
                  :{CLI_PORT}
                </Badge>
              </div>

              {/* Sample loader */}
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Load bundled sample
                </label>
                {samplesLoading ? (
                  <Skeleton className="h-8 w-full rounded-md bg-muted/40" />
                ) : (
                  <Select value={selectedSample} onValueChange={loadSample}>
                    <SelectTrigger className="bg-card/60 text-xs">
                      <SelectValue placeholder="Select a sample .epd" />
                    </SelectTrigger>
                    <SelectContent>
                      {samples.map((s) => (
                        <SelectItem key={s.filename} value={s.filename}>
                          <span className="font-mono">{s.filename}</span>
                          <span className="ml-1 text-muted-foreground">· {s.name}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Source editor */}
              <div className="space-y-1.5">
                <label className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" /> .epd source
                  </span>
                  <span className="font-mono text-[10px] normal-case text-muted-foreground/70">
                    {source.split("\n").length} lines
                  </span>
                </label>
                <Textarea
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  spellCheck={false}
                  className={cn(
                    "codeblock bg-background/60 min-h-[220px] max-h-[420px] resize-y epistemic-scroll",
                    "border-border/60 focus-visible:border-verified/40",
                  )}
                  placeholder="# Write your .epd policy here…"
                />
              </div>

              {/* State editor */}
              <div className="space-y-1.5">
                <label className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
                  <span>State JSON <span className="normal-case text-muted-foreground/70">(for validate / repair)</span></span>
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={loadSafe}
                      className="rounded border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                    >
                      safe
                    </button>
                    <button
                      type="button"
                      onClick={loadViolating}
                      className="rounded border border-violating/40 bg-violating/10 px-1.5 py-0.5 text-[9px] font-mono text-violating hover:bg-violating/20 transition-colors"
                    >
                      violating
                    </button>
                  </span>
                </label>
                <Textarea
                  value={stateText}
                  onChange={(e) => setStateText(e.target.value)}
                  spellCheck={false}
                  className={cn(
                    "codeblock bg-background/60 min-h-[100px] max-h-[260px] resize-y epistemic-scroll",
                    "border-border/60 focus-visible:border-verified/40",
                  )}
                />
              </div>

              {/* Strict toggle */}
              <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/20 px-2.5 py-1.5">
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-3.5 w-3.5 text-repairing" />
                  <span className="text-xs text-foreground">
                    <span className="font-mono">--strict</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    soft violations → exit 1
                  </span>
                </div>
                <Switch checked={strict} onCheckedChange={setStrict} />
              </div>

              {/* Command buttons */}
              <Separator className="bg-border/40" />
              <div className="grid grid-cols-2 gap-2">
                {cmdButton("validate", "validate", <Play className="h-3.5 w-3.5" />, true)}
                {cmdButton("repair", "repair", <RotateCw className="h-3.5 w-3.5" />)}
                {cmdButton("proof", "proof", <KeyRound className="h-3.5 w-3.5" />)}
                {cmdButton("list-samples", "list-samples", <List className="h-3.5 w-3.5" />)}
              </div>
            </div>
          </Card>
        </div>

        {/* RIGHT — terminal panel (3/5) */}
        <div className="lg:col-span-3">
          <Card className="bg-background/80 backdrop-blur border-border/60 p-0 relative overflow-hidden">
            <div className="bg-grid-fine absolute inset-0 opacity-25 pointer-events-none" />
            {/* Terminal title bar with traffic lights */}
            <div className="relative flex items-center gap-2 border-b border-border/60 bg-background/60 px-3 py-2">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-violating/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-repairing/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-verified/80" />
              </div>
              <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                epd-cli — epistemic://policies
              </span>
              <div className="ml-auto flex items-center gap-2">
                <span
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold",
                    online
                      ? "border-verified/40 bg-verified/10 text-verified"
                      : "border-violating/40 bg-violating/10 text-violating",
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      online ? "bg-verified" : "bg-violating animate-epistemic-pulse",
                    )}
                  />
                  {online ? "connected" : "disconnected"}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearTerminal}
                  disabled={history.length === 0}
                  className="h-7 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                >
                  <Trash2 className="h-3 w-3" />
                  Clear
                </Button>
              </div>
            </div>

            {/* Terminal body */}
            <div
              ref={scrollRef}
              className="relative max-h-[640px] min-h-[400px] overflow-y-auto epistemic-scroll p-3 font-mono text-[12px] leading-relaxed"
            >
              {history.length === 0 ? (
                <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
                  <Terminal className="h-8 w-8 mb-2 text-verified/60" />
                  <p className="text-sm text-foreground/80">
                    epd-cli ready · <span className="text-verified">run a command</span> to see output
                  </p>
                  <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                    try <span className="text-verified font-semibold">validate</span> with the loaded sample
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((entry) => (
                    <TerminalEntryView key={entry.id} entry={entry} />
                  ))}
                  {running && (
                    <div className="flex items-center gap-2 text-[11px] text-repairing">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="font-mono">executing epd-cli {running}…</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Quick reference */}
          <Card className="mt-3 bg-card/60 backdrop-blur border-border/60 p-3 relative overflow-hidden">
            <div className="bg-grid-fine absolute inset-0 opacity-20" />
            <div className="relative grid grid-cols-1 gap-2 text-[10.5px] text-muted-foreground sm:grid-cols-2">
              <div className="flex items-start gap-1.5">
                <Play className="mt-0.5 h-3 w-3 text-verified shrink-0" />
                <span>
                  <span className="font-mono text-foreground">validate</span> — parse + evaluate
                  invariants against <span className="font-mono">state</span>, emit MMR root.
                </span>
              </div>
              <div className="flex items-start gap-1.5">
                <RotateCw className="mt-0.5 h-3 w-3 text-repairing shrink-0" />
                <span>
                  <span className="font-mono text-foreground">repair</span> — least-divergent
                  fix from <span className="font-mono">current</span> → <span className="font-mono">proposed</span>.
                </span>
              </div>
              <div className="flex items-start gap-1.5">
                <KeyRound className="mt-0.5 h-3 w-3 text-verified shrink-0" />
                <span>
                  <span className="font-mono text-foreground">proof</span> — generate an MMR
                  ancestry proof for invariant <span className="font-mono">--index n</span>.
                </span>
              </div>
              <div className="flex items-start gap-1.5">
                <List className="mt-0.5 h-3 w-3 text-muted-foreground shrink-0" />
                <span>
                  <span className="font-mono text-foreground">list-samples</span> — enumerate
                  bundled <span className="font-mono">.epd</span> policies.
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

function TerminalEntryView({ entry }: { entry: TerminalEntry }) {
  const ok = entry.exitCode === 0;
  const failed = entry.exitCode === -1;
  return (
    <div className="space-y-1">
      {/* Prompt line */}
      <div className="flex items-center gap-2">
        <span className="text-verified">{entry.prompt}</span>
      </div>
      {/* Output */}
      {(entry.stdout || entry.stderr) && (
        <pre className="whitespace-pre-wrap break-words text-foreground/90">
          {renderAnsi(entry.stdout)}
          {entry.stderr && (
            <span className="text-violating">
              {renderAnsi(entry.stderr)}
            </span>
          )}
        </pre>
      )}
      {/* Exit code */}
      <div className="flex items-center gap-1.5 pt-0.5">
        {failed ? (
          <span className="inline-flex items-center gap-1 rounded border border-violating/40 bg-violating/10 px-1.5 py-0.5 text-[10px] font-mono text-violating">
            <XCircle className="h-2.5 w-2.5" />
            network error
          </span>
        ) : ok ? (
          <span className="inline-flex items-center gap-1 rounded border border-verified/40 bg-verified/10 px-1.5 py-0.5 text-[10px] font-mono text-verified">
            <CheckCircle2 className="h-2.5 w-2.5" />
            exit 0
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded border border-violating/40 bg-violating/10 px-1.5 py-0.5 text-[10px] font-mono text-violating">
            <AlertTriangle className="h-2.5 w-2.5" />
            exit {entry.exitCode}
          </span>
        )}
        <span className="text-[9px] text-muted-foreground/60 font-mono">
          {new Date(entry.ranAt).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}
