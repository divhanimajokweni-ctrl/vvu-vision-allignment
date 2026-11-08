"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { type ReleaseFile } from "@/lib/vvu-release-manifest";

const CATEGORY_COLORS: Record<ReleaseFile["category"], string> = {
  FIRMWARE: "border-sky-800 bg-sky-950 text-sky-300",
  SUBSTRATE: "border-purple-800 bg-purple-950 text-purple-300",
  CONTRACT: "border-violet-800 bg-violet-950 text-violet-300",
  SCHEMA: "border-cyan-800 bg-cyan-950 text-cyan-300",
  CONFIG: "border-amber-800 bg-amber-950 text-amber-300",
  KEYS: "border-rose-800 bg-rose-950 text-rose-300",
  RUNTIME: "border-emerald-800 bg-emerald-950 text-emerald-300",
  BRAND: "border-yellow-800 bg-yellow-950 text-yellow-300",
  TESTS: "border-lime-800 bg-lime-950 text-lime-300",
  SPEC: "border-orange-800 bg-orange-950 text-orange-300",
};

interface ReleaseManifestProps {
  files: ReleaseFile[];
  stamp: string;
  version: string;
}

export function ReleaseManifest({ files, stamp, version }: ReleaseManifestProps) {
  const totalBytes = files.reduce((s, f) => s + f.sizeBytes, 0);
  return (
    <div className="flex flex-col h-full">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Release Manifest</h3>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <Badge variant="outline" className="font-mono">
            stamp {stamp}
          </Badge>
          <Badge variant="outline" className="font-mono">
            {version}
          </Badge>
          <span className="text-muted-foreground">
            {files.length} files · {(totalBytes / 1024).toFixed(1)} KB
          </span>
        </div>
      </div>

      <ScrollArea className="h-[280px] rounded border border-border vvu-surface-deep">
        <table className="w-full font-mono text-[10px]">
          <thead className="sticky top-0 bg-background/90 backdrop-blur">
            <tr className="border-b border-border text-left">
              <th className="px-2 py-1 font-semibold text-muted-foreground">ID</th>
              <th className="px-2 py-1 font-semibold text-muted-foreground">File</th>
              <th className="px-2 py-1 font-semibold text-muted-foreground">SHA-256 (16)</th>
              <th className="px-2 py-1 font-semibold text-muted-foreground">Cat</th>
              <th className="px-2 py-1 font-semibold text-muted-foreground text-right">Size</th>
            </tr>
          </thead>
          <tbody>
            {files.map((f) => (
              <tr
                key={f.fileId}
                className="border-b border-border/30 hover:bg-accent/30"
                title={f.role}
              >
                <td className="px-2 py-1 text-lime-400">{f.fileId}</td>
                <td className="px-2 py-1 text-foreground truncate max-w-[180px]" title={f.filename}>
                  {f.filename}
                </td>
                <td className="px-2 py-1 text-sky-300">{f.sha256.slice(0, 16)}…</td>
                <td className="px-2 py-1">
                  <Badge variant="outline" className={`text-[9px] ${CATEGORY_COLORS[f.category]}`}>
                    {f.category}
                  </Badge>
                </td>
                <td className="px-2 py-1 text-right text-muted-foreground">
                  {(f.sizeBytes / 1024).toFixed(1)}K
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
      <p className="mt-1 text-[9px] text-muted-foreground/70">
        Design Freeze Level 1 — 15-file HBK Mk-II engineering bundle. Hover any row for the file
        role.
      </p>
    </div>
  );
}
