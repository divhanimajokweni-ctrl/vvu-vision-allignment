"use client";

import {
  Ban,
  Globe,
  KeyRound,
  Layers,
  Lock,
  Network,
  ScrollText,
  Server,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DOCTRINE, VERTICAL_TABLE, DELIVERY } from "@/lib/twin-surfaces";

export function EstateNarrativePanel() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Ban className="h-4 w-4 text-red-400" />
          <CardTitle className="text-sm font-mono tracking-wide">
            NO-PRIMITIVES LAW · ESTATE / NARRATIVE
          </CardTitle>
        </div>
        <CardDescription className="font-mono text-[10px]">
          The estate is the physical thing. The narrative is what we render. The narrative must never synthesise a value the estate did not produce.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Non-negotiables */}
        <div className="space-y-1.5">
          {DOCTRINE.nonNegotiables.map((n, i) => (
            <div key={i} className="flex items-start gap-2 font-mono text-[10px]">
              <span className="mt-0.5 text-red-400">✗</span>
              <span className="text-muted-foreground">{n}</span>
            </div>
          ))}
        </div>

        {/* Three windows */}
        <div>
          <div className="mb-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            fail-closed windows
          </div>
          <div className="overflow-hidden rounded-md border border-border/60">
            <table className="w-full font-mono text-[9px]">
              <thead className="bg-muted/30 text-muted-foreground">
                <tr>
                  <th className="px-2 py-1 text-left">state</th>
                  <th className="px-2 py-1 text-left">bound</th>
                  <th className="px-2 py-1 text-left">receipt</th>
                </tr>
              </thead>
              <tbody>
                {DOCTRINE.windows.map((w) => (
                  <tr key={w.name} className="border-t border-border/40">
                    <td
                      className={`px-2 py-1 font-semibold ${
                        w.name === "LIVE"
                          ? "text-emerald-400"
                          : w.name === "SENSOR_ABSENT"
                          ? "text-amber-400"
                          : "text-red-400"
                      }`}
                    >
                      {w.name}
                    </td>
                    <td className="px-2 py-1 text-muted-foreground">{w.bound}</td>
                    <td className="px-2 py-1 text-muted-foreground">{w.receipt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Chain spec */}
        <div>
          <div className="mb-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            worm chain spec
          </div>
          <div className="space-y-1 rounded-md border border-border/60 bg-muted/20 p-2 font-mono text-[9px]">
            <SpecRow k="canonicalisation" v={DOCTRINE.chainSpec.canonicalisation} />
            <SpecRow k="source_hash" v={DOCTRINE.chainSpec.sourceHash} />
            <SpecRow k="chain_hash" v={DOCTRINE.chainSpec.chainHash} />
            <SpecRow k="genesis" v={DOCTRINE.chainSpec.genesis} />
            <SpecRow k="signature" v={DOCTRINE.chainSpec.signature} />
            <SpecRow k="anchoring" v={DOCTRINE.chainSpec.anchoring} />
            <SpecRow k="verifier" v={DOCTRINE.chainSpec.verifier} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SpecRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <span className="shrink-0 text-cyan-400/70">{k}</span>
      <span className="text-muted-foreground">{v}</span>
    </div>
  );
}

export function VerticalSkinsPanel() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-cyan-400" />
          <CardTitle className="text-sm font-mono tracking-wide">
            ONE ENGINE · MANY SKINS
          </CardTitle>
        </div>
        <CardDescription className="font-mono text-[10px]">
          The cryptographic substrate is identical across verticals. The skin changes only the narrative — never the chain, the verifier, or the math.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          {VERTICAL_TABLE.map((v) => (
            <div
              key={v.vertical}
              className="rounded-md border border-border/60 bg-muted/20 p-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] font-bold text-foreground">
                  {v.vertical}
                </span>
                <Badge variant="outline" className="font-mono text-[8px] text-amber-400/80 border-amber-500/30">
                  {v.trigger.split(" → ")[1] ?? v.trigger}
                </Badge>
              </div>
              <div className="mt-1 grid grid-cols-1 gap-0.5 font-mono text-[9px] text-muted-foreground sm:grid-cols-2">
                <span>
                  <span className="text-cyan-400/60">skin:</span> {v.skin}
                </span>
                <span>
                  <span className="text-cyan-400/60">estate:</span> {v.estate}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function DeliveryPanel() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-cyan-400" />
          <CardTitle className="text-sm font-mono tracking-wide">
            DELIVERY · OBSERVABILITY · AUTH
          </CardTitle>
        </div>
        <CardDescription className="font-mono text-[10px]">
          {DELIVERY.domain} · Clerk auth DNS · Vercel + Cloudflare · wrangler observability
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {/* Domain */}
        <Row icon={<Globe className="h-3.5 w-3.5" />} k="domain" v={DELIVERY.domain} />

        {/* Auth */}
        <div className="rounded-md border border-border/60 bg-muted/20 p-2.5">
          <div className="flex items-center gap-2 font-mono text-[10px] font-bold text-cyan-400">
            <KeyRound className="h-3.5 w-3.5" /> AUTH · {DELIVERY.auth.provider}
          </div>
          <div className="mt-1 space-y-0.5 font-mono text-[9px] text-muted-foreground">
            <div>{DELIVERY.auth.dns}</div>
            <div className="text-amber-400/70">{DELIVERY.auth.note}</div>
          </div>
        </div>

        {/* Hosting */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-border/60 bg-muted/20 p-2.5">
            <div className="flex items-center gap-2 font-mono text-[10px] font-bold text-cyan-400">
              <Server className="h-3.5 w-3.5" /> HOSTING
            </div>
            <div className="mt-1 font-mono text-[9px] text-muted-foreground">
              <div>primary: {DELIVERY.hosting.primary}</div>
              <div>edge: {DELIVERY.hosting.edge}</div>
            </div>
          </div>
          <div className="rounded-md border border-border/60 bg-muted/20 p-2.5">
            <div className="flex items-center gap-2 font-mono text-[10px] font-bold text-cyan-400">
              <Network className="h-3.5 w-3.5" /> EDGE / CDN
            </div>
            <div className="mt-1 font-mono text-[9px] text-muted-foreground">
              <div>Cloudflare WAF + R2</div>
              <div>GLB assets disk-canonical</div>
            </div>
          </div>
        </div>

        {/* Observability — wrangler */}
        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-2.5">
          <div className="flex items-center gap-2 font-mono text-[10px] font-bold text-emerald-400">
            <ScrollText className="h-3.5 w-3.5" /> OBSERVABILITY · wrangler.toml
          </div>
          <div className="mt-1.5 space-y-1 font-mono text-[9px]">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">logs</span>
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-[8px]">ON</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">invocation_logs</span>
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-[8px]">ON</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">traces</span>
              <Badge variant="outline" className="border-red-500/40 text-red-400 text-[8px]">OFF · persist=off</Badge>
            </div>
            <div className="mt-1 text-amber-400/60">
              ⚠ The WORM chain is the canonical audit record — not the trace store. No payload bodies persisted.
            </div>
          </div>
        </div>

        {/* Local-first */}
        <div className="rounded-md border border-cyan-500/20 bg-cyan-500/5 p-2.5">
          <div className="flex items-center gap-2 font-mono text-[10px] font-bold text-cyan-400">
            <Lock className="h-3.5 w-3.5" /> LOCAL-FIRST · NOT-SAAS
          </div>
          <div className="mt-1 font-mono text-[9px] text-muted-foreground">
            The verifier runs offline. No phone-home, no API key, no trust — just SHA-256 and Ed25519.
            <span className="text-cyan-400/70"> node verify-chain.js → CHAIN INTACT</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ icon, k, v }: { icon: React.ReactNode; k: string; v: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/20 px-2.5 py-2 font-mono text-[10px]">
      <span className="flex items-center gap-2 text-cyan-400/70">
        {icon}
        {k}
      </span>
      <span className="text-foreground">{v}</span>
    </div>
  );
}
