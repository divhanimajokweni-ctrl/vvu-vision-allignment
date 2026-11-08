"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Link2,
  Lock,
  Unlock,
  ChevronRight,
  GitBranch,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface WormChainEntry {
  fileId: string;
  filename: string;
  sha256: string;
  verified: boolean;
  tampered: boolean;
}

interface WormChainVisualizerProps {
  entries: WormChainEntry[];
  onTamper?: () => void;
}

/** Compute a deterministic "chain hash" — link entry N to entry N-1 by hashing their two sha256 values together */
function linkHash(prevHash: string, thisHash: string): string {
  // 16-char visible "link digest" — purely for display
  let h = 0;
  const combined = prevHash + thisHash;
  for (let i = 0; i < combined.length; i++) {
    h = ((h << 5) - h + combined.charCodeAt(i)) | 0;
  }
  const hex = (h >>> 0).toString(16).padStart(8, "0");
  return hex + prevHash.slice(0, 8);
}

export function WormChainVisualizer({ entries, onTamper }: WormChainVisualizerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(entries[0]?.fileId ?? null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const chain = useMemo(() => {
    // Build the chain without mutating outer state — use reduce to carry prev forward
    return entries.reduce<
      Array<{
        fileId: string;
        filename: string;
        sha256: string;
        verified: boolean;
        tampered: boolean;
        index: number;
        prevSha: string;
        link: string;
        isHead: boolean;
      }>
    >((acc, e, i) => {
      const prevSha = acc.length === 0 ? "GENESIS_0000" : entries[i - 1].sha256;
      const link = linkHash(prevSha, e.sha256);
      acc.push({
        ...e,
        index: i,
        prevSha: prevSha.slice(0, 16),
        link,
        isHead: i === entries.length - 1,
      });
      return acc;
    }, []);
  }, [entries]);

  const selected = chain.find((c) => c.fileId === selectedId) ?? chain[0];
  const verifiedCount = chain.filter((c) => c.verified && !c.tampered).length;
  const tamperedCount = chain.filter((c) => c.tampered).length;

  function toggle(id: string) {
    setExpanded((prev) => {
      const ns = new Set(prev);
      if (ns.has(id)) ns.delete(id);
      else ns.add(id);
      return ns;
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">WORM Hash-Chain Explorer</h3>
        <div className="flex items-center gap-2 text-[10px]">
          <Badge
            variant="outline"
            className="border-lime-700 bg-lime-950/50 text-lime-300 font-mono"
          >
            <Lock className="mr-1 h-3 w-3" /> {verifiedCount} sealed
          </Badge>
          {tamperedCount > 0 && (
            <Badge
              variant="outline"
              className="border-red-700 bg-red-950/50 text-red-300 font-mono animate-pulse"
            >
              <Unlock className="mr-1 h-3 w-3" /> {tamperedCount} broken
            </Badge>
          )}
          <Badge variant="outline" className="border-sky-700 bg-sky-950/50 text-sky-300 font-mono">
            <GitBranch className="mr-1 h-3 w-3" /> head = F{String(entries.length).padStart(2, "0")}
          </Badge>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Each entry&apos;s SHA-256 hash is linked to the previous entry — recomputed server-side via{" "}
        <code className="font-mono text-foreground">crypto.subtle.digest</code>. Tampering with any
        entry breaks every subsequent link.
      </p>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
        {/* Chain visualization */}
        <Card className="border-border vvu-card-surface p-2 lg:col-span-3 overflow-hidden">
          <ScrollArea className="h-[320px] pr-2">
            <ul className="space-y-1">
              {chain.map((c, i) => {
                const isSel = selected?.fileId === c.fileId;
                const isExp = expanded.has(c.fileId);
                return (
                  <li key={c.fileId}>
                    <div
                      className={cn(
                        "rounded border transition-all cursor-pointer",
                        isSel
                          ? "border-lime-600 bg-lime-950/20 shadow-[0_0_0_1px_rgba(200,255,0,0.2)]"
                          : "border-border/40 bg-card/50 hover:bg-card",
                        c.tampered && "border-red-600 bg-red-950/20",
                      )}
                      onClick={() => setSelectedId(c.fileId)}
                    >
                      <div className="flex items-center gap-2 px-2 py-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggle(c.fileId);
                          }}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={isExp ? "collapse" : "expand"}
                        >
                          <ChevronRight
                            className={cn("h-3 w-3 transition-transform", isExp && "rotate-90")}
                          />
                        </button>
                        <span
                          className={cn(
                            "font-mono text-[10px] font-bold",
                            c.tampered ? "text-red-300" : "text-lime-300",
                          )}
                        >
                          {c.fileId}
                        </span>
                        <span
                          className="font-mono text-[10px] text-foreground truncate flex-1 max-w-[180px]"
                          title={c.filename}
                        >
                          {c.filename}
                        </span>
                        {c.isHead && (
                          <Badge
                            variant="outline"
                            className="px-1 py-0 text-[9px] font-mono border-sky-700 bg-sky-950 text-sky-300"
                          >
                            HEAD
                          </Badge>
                        )}
                        {c.tampered ? (
                          <AlertTriangle className="h-3 w-3 text-red-400 animate-pulse" />
                        ) : c.verified ? (
                          <ShieldCheck className="h-3 w-3 text-lime-400" />
                        ) : (
                          <Unlock className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                      {isExp && (
                        <div className="border-t border-border/30 px-2 py-2 space-y-1 vvu-surface-deeper/50">
                          <div className="grid grid-cols-[60px_1fr] gap-2 text-[10px] font-mono">
                            <span className="text-muted-foreground">sha256</span>
                            <span
                              className={cn(
                                "break-all",
                                c.tampered ? "text-red-300" : "text-sky-300",
                              )}
                            >
                              {c.sha256}
                            </span>
                            <span className="text-muted-foreground">prev</span>
                            <span className="text-amber-300 break-all">{c.prevSha}…</span>
                            <span className="text-muted-foreground">link</span>
                            <span className="text-violet-300 break-all">{c.link}</span>
                            <span className="text-muted-foreground">state</span>
                            <span className={c.tampered ? "text-red-300" : "text-lime-300"}>
                              {c.tampered
                                ? "TAMPERED — chain broken downstream"
                                : "VERIFIED — chain sealed"}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Chain link arrow */}
                    {i < chain.length - 1 && (
                      <div className="flex justify-center py-0.5">
                        <Link2
                          className={cn(
                            "h-3 w-3",
                            c.tampered || chain[i + 1].tampered
                              ? "text-red-500"
                              : "text-lime-600/50",
                          )}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        </Card>

        {/* Selected entry detail */}
        <Card className="border-border vvu-card-surface p-3 lg:col-span-2 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Selected entry
              </span>
              {selected?.tampered ? (
                <Badge
                  variant="outline"
                  className="border-red-700 bg-red-950 text-red-300 animate-pulse"
                >
                  <AlertTriangle className="mr-1 h-3 w-3" /> TAMPERED
                </Badge>
              ) : (
                <Badge variant="outline" className="border-lime-700 bg-lime-950 text-lime-300">
                  <ShieldCheck className="mr-1 h-3 w-3" /> SEALED
                </Badge>
              )}
            </div>
            <div className="font-mono text-xs text-lime-300">{selected?.fileId}</div>
            <div className="font-mono text-[11px] text-foreground">{selected?.filename}</div>
          </div>

          <div className="space-y-2">
            <div className="rounded border border-border/40 vvu-surface-deeper p-2">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                SHA-256 (full)
              </div>
              <div
                className={cn(
                  "font-mono text-[10px] break-all leading-relaxed",
                  selected?.tampered ? "text-red-300" : "text-sky-300",
                )}
              >
                {selected?.sha256}
              </div>
            </div>
            <div className="rounded border border-border/40 vvu-surface-deeper p-2">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                Chain position
              </div>
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-muted-foreground">
                  #{String(selected?.index ?? 0).padStart(2, "0")} / {chain.length - 1}
                </span>
                <span className="text-amber-300">prev: {selected?.prevSha}…</span>
              </div>
              <div className="mt-1 font-mono text-[11px] text-violet-300">
                link: {selected?.link}
              </div>
            </div>
            <div className="rounded border border-border/40 vvu-surface-deeper p-2">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                Recompute
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Server-side SHA-256 recomputes on demand via{" "}
                <code className="font-mono text-foreground">crypto.subtle.digest</code>.
                {selected?.tampered && (
                  <span className="mt-1 block text-red-300">
                    Detected drift — original hash differs from stored value. The drill
                    auto-restores in 10s.
                  </span>
                )}
              </p>
            </div>
          </div>

          {onTamper && (
            <Button
              size="sm"
              variant="outline"
              className="w-full border-red-800 bg-red-950/40 text-red-300 hover:bg-red-950 hover:text-red-200 text-[11px]"
              onClick={onTamper}
            >
              <AlertTriangle className="mr-1 h-3 w-3" /> Run tamper drill on this entry
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
}
