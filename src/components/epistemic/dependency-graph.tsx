"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  GitGraph,
  Move,
  RefreshCw,
  Zap,
  Network,
  Info,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface DepNode {
  id: string;
  name: string;
  domain: string | null;
  invariantCount: number;
  zkEnabled: boolean;
  shadowEnabled: boolean;
  shardKey: string | null;
  degree: number;
  invariantNames: string[];
}

interface DepEdge {
  from: string;
  to: string;
  fromName: string;
  toName: string;
  type: "shared_domain" | "shared_invariant" | "shared_shard_key" | "shared_repair" | "shared_ancestry";
  strength: number;
  detail: string;
}

interface DepData {
  nodes: DepNode[];
  edges: DepEdge[];
  totals: { nodes: number; edges: number; connected: number; isolated: number };
}

interface SimNode extends DepNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number | null;
  fy: number | null;
}

const EDGE_COLORS: Record<DepEdge["type"], string> = {
  shared_domain: "oklch(0.78 0.16 160)",
  shared_invariant: "oklch(0.64 0.21 25)",
  shared_shard_key: "oklch(0.74 0.13 190)",
  shared_repair: "oklch(0.80 0.15 80)",
  shared_ancestry: "oklch(0.70 0.13 40)",
};

const EDGE_LABELS: Record<DepEdge["type"], string> = {
  shared_domain: "domain",
  shared_invariant: "invariant",
  shared_shard_key: "shard key",
  shared_repair: "repair",
  shared_ancestry: "ancestry",
};

const W = 680;
const H = 420;

export function DependencyGraphSection() {
  const [data, setData] = useState<DepData | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(true);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<DepEdge | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [activeTypes, setActiveTypes] = useState<Set<DepEdge["type"]>>(
    new Set(["shared_domain", "shared_invariant", "shared_shard_key", "shared_repair", "shared_ancestry"]),
  );
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const rafRef = useRef<number>(0);
  // Mutable scratch array for the simulation; rendered via a state mirror.
  const scratchRef = useRef<SimNode[]>([]);
  const [renderNodes, setRenderNodes] = useState<SimNode[]>([]);


  useEffect(() => {
    fetch("/api/dependencies")
      .then((r) => r.json())
      .then((d: DepData) => {
        setData(d);
        setLoading(false);
        // Initialize node positions in a circle
        const cx = W / 2;
        const cy = H / 2;
        const radius = Math.min(W, H) * 0.32;
        scratchRef.current = d.nodes.map((n, i) => {
          const angle = (i / d.nodes.length) * Math.PI * 2 - Math.PI / 2;
          return {
            ...n,
            x: cx + Math.cos(angle) * radius + (Math.random() - 0.5) * 15,
            y: cy + Math.sin(angle) * radius + (Math.random() - 0.5) * 15,
            vx: 0,
            vy: 0,
            fx: null,
            fy: null,
          };
        });
        setRenderNodes(scratchRef.current.map((n) => ({ ...n })));
      })
      .catch(() => setLoading(false));
  }, []);

  // Force simulation
  useEffect(() => {
    if (!simulating || !data) return;
    const tick = () => {
      const ns = scratchRef.current;
      if (ns.length === 0) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const es = data.edges.filter((e) => activeTypes.has(e.type));

      // Repulsion
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const a = ns[i];
          const b = ns[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 1) dist = 1;
          const force = 5000 / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          if (a.fx === null) { a.vx -= fx; a.vy -= fy; }
          if (b.fx === null) { b.vx += fx; b.vy += fy; }
        }
      }
      // Spring attraction along edges
      for (const e of es) {
        const a = ns.find((n) => n.id === e.from);
        const b = ns.find((n) => n.id === e.to);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const target = 130 - e.strength * 8;
        const force = (dist - target) * 0.035;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        if (a.fx === null) { a.vx += fx; a.vy += fy; }
        if (b.fx === null) { b.vx -= fx; b.vy -= fy; }
      }
      // Center gravity + damping + bounds
      const cx = W / 2;
      const cy = H / 2;
      for (const n of ns) {
        if (n.fx !== null) {
          n.x = n.fx;
          n.y = n.fy ?? n.y;
          n.vx = 0;
          n.vy = 0;
          continue;
        }
        n.vx += (cx - n.x) * 0.003;
        n.vy += (cy - n.y) * 0.003;
        n.vx *= 0.82;
        n.vy *= 0.82;
        n.x += n.vx;
        n.y += n.vy;
        const pad = 50;
        if (n.x < pad) { n.x = pad; n.vx = 0; }
        if (n.x > W - pad) { n.x = W - pad; n.vx = 0; }
        if (n.y < pad) { n.y = pad; n.vy = 0; }
        if (n.y > H - pad) { n.y = H - pad; n.vy = 0; }
      }
      setRenderNodes(ns.map((n) => ({ ...n })));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [simulating, data, activeTypes]);

  const getPointer = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  };

  const onNodePointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    const p = getPointer(e);
    const node = scratchRef.current.find((n) => n.id === id);
    if (!node) return;
    dragRef.current = { id, offsetX: p.x - node.x, offsetY: p.y - node.y };
    node.fx = node.x;
    node.fy = node.y;
    setSelectedNode(id);
    setSelectedEdge(null);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const p = getPointer(e);
    const node = scratchRef.current.find((n) => n.id === dragRef.current!.id);
    if (node) {
      node.fx = Math.max(40, Math.min(W - 40, p.x - dragRef.current.offsetX));
      node.fy = Math.max(40, Math.min(H - 40, p.y - dragRef.current.offsetY));
    }
  };

  const onPointerUp = () => {
    if (dragRef.current) {
      const node = scratchRef.current.find((n) => n.id === dragRef.current?.id);
      if (node) { node.fx = null; node.fy = null; }
      dragRef.current = null;
    }
  };

  const recenter = () => {
    // Clear pins and scatter velocities.
    const ns = scratchRef.current;
    for (let i = 0; i < ns.length; i++) {
      ns[i].fx = null;
      ns[i].fy = null;
      ns[i].vx = (Math.random() - 0.5) * 4;
      ns[i].vy = (Math.random() - 0.5) * 4;
    }
    setSimulating(true);
    setRenderNodes(scratchRef.current.map((n) => ({ ...n })));
  };

  const toggleType = (t: DepEdge["type"]) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  if (loading || !data) {
    return <Skeleton className="h-96 w-full" />;
  }

  const visibleEdges = data.edges.filter((e) => activeTypes.has(e.type));
  const selectedNodeData = data.nodes.find((n) => n.id === selectedNode);
  const selectedEdges = selectedNode
    ? visibleEdges.filter((e) => e.from === selectedNode || e.to === selectedNode)
    : [];

  return (
    <section className="space-y-4">
      {/* Header */}
      <Card className="bg-card/60 backdrop-blur border-border/60 p-4 relative overflow-hidden">
        <div className="bg-grid absolute inset-0 opacity-20" />
        <div className="relative flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-verified/30 bg-verified/10 shrink-0">
            <GitGraph className="h-5 w-5 text-verified" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold flex items-center gap-2">
              Policy Dependency Graph
              <Badge variant="outline" className="border-verified/30 bg-verified/10 text-verified text-[9px] font-mono">
                {data.totals.nodes} policies · {data.totals.edges} links
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              How policies relate through shared domains, invariants, shard keys, repair strategies, and ancestry.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" className="h-7 text-[10px] text-muted-foreground" onClick={() => setSimulating((s) => !s)}>
              <Zap className={cn("h-3 w-3 mr-1", simulating && "text-repairing")} />
              {simulating ? "pause" : "resume"}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-[10px] text-muted-foreground" onClick={recenter}>
              <RefreshCw className="h-3 w-3 mr-1" /> recenter
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Graph */}
        <Card className="lg:col-span-3 bg-card/60 backdrop-blur border-border/60 p-3 relative overflow-hidden">
          <div className="bg-grid-fine absolute inset-0 opacity-20" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant="outline" className="text-[9px] border-border/60 font-mono">
                <Move className="h-2.5 w-2.5 mr-0.5" /> drag nodes
              </Badge>
              {data.totals.isolated > 0 && (
                <Badge variant="outline" className="text-[9px] border-muted-foreground/30 text-muted-foreground">
                  {data.totals.isolated} isolated
                </Badge>
              )}
              <span className="ml-auto text-[10px] text-muted-foreground font-mono">
                {visibleEdges.length} edges shown
              </span>
            </div>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              className="w-full block touch-none"
              style={{ aspectRatio: `${W} / ${H}` }}
              onPointerDown={() => { setSelectedNode(null); setSelectedEdge(null); }}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              role="img"
              aria-label="Policy dependency graph"
            >
              <defs>
                <radialGradient id="dep-glow-zk" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="oklch(0.78 0.16 160)" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="oklch(0.78 0.16 160)" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="dep-glow-plain" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="oklch(0.70 0.13 40)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="oklch(0.70 0.13 40)" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Edges */}
              {visibleEdges.map((e, i) => {
                const a = renderNodes.find((n) => n.id === e.from);
                const b = renderNodes.find((n) => n.id === e.to);
                if (!a || !b) return null;
                const isHighlighted =
                  hoveredNode === a.id || hoveredNode === b.id ||
                  selectedNode === a.id || selectedNode === b.id;
                const color = EDGE_COLORS[e.type];
                return (
                  <g key={`e-${i}`}>
                    <line
                      x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                      stroke={color}
                      strokeWidth={isHighlighted ? 2.5 : 1 + e.strength * 0.3}
                      strokeOpacity={isHighlighted ? 0.9 : 0.35}
                    />
                    {isHighlighted && (
                      <text
                        x={(a.x + b.x) / 2}
                        y={(a.y + b.y) / 2 - 4}
                        textAnchor="middle"
                        fontSize={8}
                        fill={color}
                        fontFamily="monospace"
                        style={{ pointerEvents: "none" }}
                      >
                        {EDGE_LABELS[e.type]}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Nodes */}
              {renderNodes.map((n) => {
                const r = 14 + n.degree * 1.5;
                const isSelected = selectedNode === n.id;
                const isHovered = hoveredNode === n.id;
                return (
                  <g
                    key={n.id}
                    transform={`translate(${n.x},${n.y})`}
                    style={{ cursor: "grab" }}
                    onPointerDown={(e) => onNodePointerDown(e, n.id)}
                    onMouseEnter={() => setHoveredNode(n.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                  >
                    <circle r={r + 8} fill={`url(#${n.zkEnabled ? "dep-glow-zk" : "dep-glow-plain"})`} />
                    {isSelected && (
                      <circle r={r + 4} fill="none" stroke={n.zkEnabled ? "oklch(0.78 0.16 160)" : "oklch(0.70 0.13 40)"} strokeWidth={1.5} strokeOpacity={0.6} />
                    )}
                    <circle
                      r={r}
                      fill={n.zkEnabled ? "oklch(0.22 0.04 160)" : "oklch(0.22 0.03 40)"}
                      stroke={n.zkEnabled ? "oklch(0.78 0.16 160)" : "oklch(0.70 0.13 40)"}
                      strokeWidth={isHovered || isSelected ? 2.5 : 1.5}
                    />
                    <text
                      y={-2}
                      textAnchor="middle"
                      fontSize={8}
                      fontFamily="var(--font-geist-mono), monospace"
                      fontWeight={600}
                      fill={n.zkEnabled ? "oklch(0.85 0.10 160)" : "oklch(0.85 0.08 40)"}
                      style={{ pointerEvents: "none" }}
                    >
                      {n.name.length > 16 ? n.name.slice(0, 14) + "…" : n.name}
                    </text>
                    <text
                      y={7}
                      textAnchor="middle"
                      fontSize={6.5}
                      fill="oklch(0.55 0.01 165)"
                      style={{ pointerEvents: "none" }}
                    >
                      {n.invariantCount} inv · {n.degree} links
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </Card>

        {/* Side panel */}
        <div className="space-y-3">
          {/* Edge type filter */}
          <Card className="bg-card/60 backdrop-blur border-border/60 p-3 relative overflow-hidden">
            <div className="bg-grid-fine absolute inset-0 opacity-20" />
            <div className="relative">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Edge types</div>
              <div className="space-y-1">
                {Object.entries(EDGE_LABELS).map(([t, label]) => {
                  const active = activeTypes.has(t as DepEdge["type"]);
                  const count = data.edges.filter((e) => e.type === t).length;
                  return (
                    <button
                      key={t}
                      onClick={() => toggleType(t as DepEdge["type"])}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md border px-2 py-1 text-[11px] transition-colors",
                        active ? "border-border/60 bg-background/40" : "border-border/30 opacity-40",
                      )}
                    >
                      <span className="h-2 w-4 rounded-sm" style={{ backgroundColor: EDGE_COLORS[t as DepEdge["type"]] }} />
                      <span className="flex-1 text-left">{label}</span>
                      <span className="font-mono text-muted-foreground">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Selected node details */}
          {selectedNodeData ? (
            <Card className="bg-card/60 backdrop-blur border-verified/30 p-3 relative overflow-hidden">
              <div className="bg-grid-fine absolute inset-0 opacity-20" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <Network className="h-3.5 w-3.5 text-verified" />
                  <span className="text-xs font-semibold truncate">{selectedNodeData.name}</span>
                  <button onClick={() => setSelectedNode(null)} className="ml-auto text-muted-foreground hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <div className="space-y-1 text-[11px]">
                  <Row label="domain" value={selectedNodeData.domain ?? "—"} />
                  <Row label="invariants" value={String(selectedNodeData.invariantCount)} />
                  <Row label="degree" value={String(selectedNodeData.degree)} />
                  <Row label="shard key" value={selectedNodeData.shardKey ?? "—"} />
                  <Row label="ZK" value={selectedNodeData.zkEnabled ? "yes" : "no"} />
                  <Row label="shadow" value={selectedNodeData.shadowEnabled ? "yes" : "no"} />
                </div>
                {selectedEdges.length > 0 && (
                  <div className="mt-2">
                    <div className="text-[9px] uppercase tracking-wide text-muted-foreground mb-1">
                      {selectedEdges.length} connection{selectedEdges.length === 1 ? "" : "s"}
                    </div>
                    <div className="space-y-1 max-h-[120px] overflow-y-auto">
                      {selectedEdges.map((e, i) => {
                        const other = e.from === selectedNode ? e.toName : e.fromName;
                        return (
                          <div key={i} className="flex items-center gap-1.5 text-[10px]">
                            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: EDGE_COLORS[e.type] }} />
                            <span className="font-mono truncate flex-1">{other}</span>
                            <span className="text-muted-foreground shrink-0">{EDGE_LABELS[e.type]}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <Card className="bg-card/60 backdrop-blur border-dashed border-border/60 p-4 text-center">
              <Info className="mx-auto h-6 w-6 text-muted-foreground/30" />
              <p className="mt-1 text-[11px] text-muted-foreground">Click a node to inspect</p>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
