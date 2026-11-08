"use client";

import { CORPORATE_FACTS, RELEASE_MANIFEST } from "@/lib/vvu-release-manifest";
import { BorromeanLogo } from "./borromean-logo";
import { Shield, MapPin, Mail, FileText, Database, Globe } from "lucide-react";

export function Footer() {
  const year = new Date().getFullYear();
  const totalSize = RELEASE_MANIFEST.reduce((s, f) => s + f.sizeBytes, 0);

  return (
    <footer className="mt-auto border-t-2 border-lime-900/40 bg-gradient-to-b from-background/80 to-[#06080c] backdrop-blur">
      {/* Top accent line — Borromean 3-color */}
      <div className="h-0.5 bg-gradient-to-r from-[#C46D1A] via-[#6B8A40] to-[#F3E38A] opacity-60" />

      <div className="px-4 py-4 sm:px-6">
        {/* Main footer row */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {/* Brand + tagline */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <BorromeanLogo size={40} animated={false} />
              <div className="absolute -inset-1 rounded-full bg-lime-500/5 blur-sm -z-10" />
            </div>
            <div className="space-y-0.5">
              <div className="text-xs font-bold tracking-tight text-foreground">
                VVU · Validation Dashboard
              </div>
              <div className="text-[10px] text-muted-foreground italic">
                {CORPORATE_FACTS.tagline} · {CORPORATE_FACTS.taglineAlt}
              </div>
              <div className="flex items-center gap-1 text-[9px] text-lime-500/70">
                <span className="inline-block h-1 w-1 rounded-full bg-lime-500 animate-pulse" />
                <span>Trust substrate active</span>
              </div>
            </div>
          </div>

          {/* Corporate facts grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] sm:flex sm:flex-wrap sm:gap-x-5">
            <div className="flex items-start gap-1.5">
              <FileText className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <div className="text-muted-foreground text-[9px] uppercase tracking-wider">
                  Legal entity
                </div>
                <div className="text-foreground">{CORPORATE_FACTS.legalEntity}</div>
              </div>
            </div>
            <div className="flex items-start gap-1.5">
              <Shield className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <div className="text-muted-foreground text-[9px] uppercase tracking-wider">
                  CIPC / SARS
                </div>
                <div className="font-mono text-foreground">{CORPORATE_FACTS.cipc}</div>
              </div>
            </div>
            <div className="flex items-start gap-1.5">
              <Database className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <div className="text-muted-foreground text-[9px] uppercase tracking-wider">
                  B-BBEE
                </div>
                <div className="text-foreground">
                  {CORPORATE_FACTS.bbbeeLevel} · {CORPORATE_FACTS.bbbeeRecognition}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-1.5">
              <Globe className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <div className="text-muted-foreground text-[9px] uppercase tracking-wider">
                  Ownership
                </div>
                <div className="text-foreground">{CORPORATE_FACTS.ownership}</div>
              </div>
            </div>
            <div className="flex items-start gap-1.5">
              <Mail className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <div className="text-muted-foreground text-[9px] uppercase tracking-wider">
                  Contact
                </div>
                <div className="font-mono text-foreground break-all">
                  {CORPORATE_FACTS.contactEmail}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="my-3 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />

        {/* Bottom row — copyright + release info */}
        <div className="flex flex-col gap-1 text-[10px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3 text-muted-foreground/60" />
            <span>
              © {year} {CORPORATE_FACTS.legalEntity} · {CORPORATE_FACTS.address}
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono">
            <span className="text-lime-500/60">Release {CORPORATE_FACTS.releaseVersion}</span>
            <span className="text-border">·</span>
            <span>stamp {CORPORATE_FACTS.releaseStamp}</span>
            <span className="text-border">·</span>
            <span>
              {RELEASE_MANIFEST.length} files · {(totalSize / 1024).toFixed(1)}KB
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
