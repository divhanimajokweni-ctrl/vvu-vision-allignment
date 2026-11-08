"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ExternalLink,
  FileBox,
  Layers,
  Loader2,
  Radio,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TWIN_SURFACES, type TwinSurface } from "@/lib/twin-surfaces";

interface ResolvedSurface extends TwinSurface {
  assets: (TwinSurface["assets"][number])[];
}

interface RegistryState {
  surfaces: ResolvedSurface[];
}

export function TwinSurfacesRegistry() {
  const [state, setState] = useState<RegistryState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/vvu/twin-scenario", { cache: "no-store" });
        const j = (await r.json()) as RegistryState;
        if (!cancelled) setState(j);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fall back to the static registry if the API hasn't resolved yet
  const surfaces = state?.surfaces ?? TWIN_SURFACES;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-cyan-400" />
          <CardTitle className="text-sm font-mono tracking-wide">
            TWIN SURFACES REGISTRY
          </CardTitle>
        </div>
        <CardDescription className="font-mono text-[10px]">
          Disk-canonical artifact catalogue · one engine, many skins · provenance resolved from disk
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && (
          <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> resolving asset states from disk…
          </div>
        )}
        {surfaces.map((s) => {
          const assetMissing = s.assets.some((a) => a.state === "ASSET_MISSING");
          const allProven = s.assets.length > 0 && s.assets.every((a) => a.state === "PROVEN");
          return (
            <div
              key={s.id}
              className={`rounded-lg border p-3 ${
                assetMissing
                  ? "border-red-500/30 bg-red-500/5"
                  : allProven
                  ? "border-emerald-500/20 bg-emerald-500/5"
                  : "border-border/60 bg-muted/20"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-mono text-xs font-bold text-foreground">{s.title}</h3>
                    <Badge variant="outline" className="font-mono text-[9px] text-muted-foreground">
                      {s.vertical.split(" / ")[0]}
                    </Badge>
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{s.subtitle}</p>
                </div>
                <Button asChild variant="outline" size="sm" className="h-8 shrink-0 font-mono text-[10px]">
                  <a href={s.path} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-1 h-3 w-3" /> OPEN
                  </a>
                </Button>
              </div>

              {/* Doctrine chips */}
              <div className="mt-2 flex flex-wrap gap-1">
                {s.doctrine.map((d) => (
                  <span
                    key={d}
                    className="rounded-sm border border-border/60 px-1.5 py-0.5 font-mono text-[8px] text-muted-foreground"
                  >
                    {d}
                  </span>
                ))}
              </div>

              {/* Asset states */}
              <div className="mt-2.5 space-y-1">
                <div className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground">
                  assets
                </div>
                {s.assets.map((a) => (
                  <div key={a.ref} className="flex items-center gap-2 font-mono text-[10px]">
                    {a.state === "PROVEN" ? (
                      <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" />
                    ) : a.state === "ASSET_MISSING" ? (
                      <AlertTriangle className="h-3 w-3 shrink-0 text-red-400" />
                    ) : a.state === "SIMULATED" ? (
                      <Radio className="h-3 w-3 shrink-0 text-amber-400" />
                    ) : (
                      <Loader2 className="h-3 w-3 shrink-0 text-cyan-400" />
                    )}
                    <span
                      className={`${
                        a.kind === "glb" ? "text-cyan-400/80" : "text-muted-foreground"
                      } truncate`}
                    >
                      {a.kind === "glb" && <FileBox className="mr-1 inline h-2.5 w-2.5" />}
                      {a.ref}
                    </span>
                    <Badge
                      variant="outline"
                      className={`ml-auto shrink-0 font-mono text-[8px] ${
                        a.state === "PROVEN"
                          ? "border-emerald-500/40 text-emerald-400"
                          : a.state === "ASSET_MISSING"
                          ? "border-red-500/40 text-red-400"
                          : a.state === "SIMULATED"
                          ? "border-amber-500/40 text-amber-400"
                          : "border-cyan-500/40 text-cyan-400"
                      }`}
                    >
                      {a.state}
                    </Badge>
                  </div>
                ))}
              </div>

              {/* Fail-closed trigger */}
              <div className="mt-2 flex items-start gap-1.5 rounded-sm border border-border/40 bg-background/40 p-1.5 font-mono text-[9px] text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-2.5 w-2.5 shrink-0 text-amber-400" />
                <span>
                  <span className="text-amber-400/80">fail-closed:</span> {s.failClosedTrigger}
                </span>
              </div>

              {/* Provenance */}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[9px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Boxes className="h-2.5 w-2.5" /> source: {s.provenance.source}
                </span>
                {s.provenance.licence && (
                  <span className="text-amber-400/70">licence: {s.provenance.licence}</span>
                )}
                {s.provenance.attribution && (
                  <span className="text-muted-foreground/70">© {s.provenance.attribution}</span>
                )}
                <span className="flex items-center gap-1 text-emerald-400/70">
                  <CheckCircle2 className="h-2.5 w-2.5" /> verified
                </span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
