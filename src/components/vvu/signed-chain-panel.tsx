"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyRound,
  Link2,
  Radio,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ApiEntry {
  seq: number;
  type: string;
  timestamp: string;
  source: string;
  reason?: string;
  metrics?: Record<string, number>;
  state?: string;
  mode?: string;
  source_hash: string;
  chain_hash: string;
  meta?: { signature?: string; signed_at?: string; device_id?: string; sim?: boolean };
}

interface ApiState {
  identity: { publicKey: string; algorithm: string; deviceId: string };
  genesis: string;
  entries: ApiEntry[];
  entryCount: number;
  head: string;
  verify: {
    valid: boolean;
    count: number;
    warnings: string[];
    errors: { seq: number; reason: string; detail: string }[];
    lastAnchor: { seq: number; timestamp: string } | null;
  };
}

const ACTIONS: { id: string; label: string; tone: string }[] = [
  { id: "telemetry", label: "TELEMETRY", tone: "cyan" },
  { id: "leak", label: "LEAK_ACTIVE", tone: "amber" },
  { id: "breaker", label: "BREAKER_TRIPPED", tone: "red" },
  { id: "absent", label: "SENSOR_ABSENT", tone: "amber" },
  { id: "failclosed", label: "NO_DATA_60S", tone: "red" },
  { id: "reset", label: "OPERATOR_ACK", tone: "emerald" },
];

export function SignedChainPanel() {
  const [state, setState] = useState<ApiState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/vvu/twin-scenario", { cache: "no-store" });
      const j = (await r.json()) as ApiState;
      setState(j);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [state?.entries.length]);

  const postAction = async (action: string) => {
    setBusy(action);
    try {
      await fetch("/api/vvu/twin-scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const toneClass = (t: string) =>
    t === "cyan"
      ? "border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10"
      : t === "amber"
      ? "border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
      : t === "red"
      ? "border-red-500/40 text-red-400 hover:bg-red-500/10"
      : "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10";

  const typeColor = (t: string) => {
    switch (t) {
      case "TELEMETRY":
        return "text-cyan-400/80";
      case "ABSENCE_RECEIPT":
        return "text-amber-400";
      case "HEARTBEAT":
        return "text-muted-foreground";
      case "LEAK_RECEIPT":
        return "text-amber-400";
      case "BREAKER_RECEIPT":
        return "text-red-400";
      case "RESET_RECEIPT":
        return "text-emerald-400";
      default:
        return "text-foreground";
    }
  };

  return (
    <Card className="border-cyan-500/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-cyan-400" />
            <CardTitle className="text-sm font-mono tracking-wide">
              SIGNED AUDIT CHAIN · Ed25519
            </CardTitle>
          </div>
          <Button
            onClick={refresh}
            variant="ghost"
            size="sm"
            className="h-7 px-2 font-mono text-[10px]"
          >
            <RefreshCw className="mr-1 h-3 w-3" /> VERIFY
          </Button>
        </div>
        <CardDescription className="font-mono text-[10px]">
          Server-side WORM chain · RFC 8785 JCS · SHA-256 · Ed25519 signatures · zero phone-home
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Identity + verdict */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="device" value={state?.identity.deviceId ?? "—"} mono />
          <Stat label="algorithm" value={state?.identity.algorithm ?? "—"} mono />
          <Stat
            label="entries"
            value={state ? String(state.entryCount) : "—"}
            mono
          />
          <Stat
            label="verdict"
            value={state ? (state.verify.valid ? "INTACT" : "BROKEN") : "—"}
            mono
            tone={state?.verify.valid ? "emerald" : "red"}
          />
        </div>

        {/* Public key */}
        {state && (
          <div className="rounded-md border border-border/60 bg-muted/20 p-2 font-mono text-[9px] text-muted-foreground">
            <span className="text-cyan-400/80">publicKey (SPKI DER, base64)</span>
            <div className="mt-0.5 break-all text-[9px]">{state.identity.publicKey.slice(0, 96)}…</div>
          </div>
        )}

        {/* Scenario action buttons */}
        <div>
          <div className="mb-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            append signed receipt
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {ACTIONS.map((a) => (
              <Button
                key={a.id}
                onClick={() => postAction(a.id)}
                disabled={busy !== null}
                variant="outline"
                className={`h-9 font-mono text-[9px] ${toneClass(a.tone)}`}
              >
                {busy === a.id && <RefreshCw className="mr-1 h-3 w-3 animate-spin" />}
                {a.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Warnings */}
        {state && state.verify.warnings.length > 0 && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 font-mono text-[9px] text-amber-300/80">
            {state.verify.warnings.map((w, i) => (
              <div key={i}>{w}</div>
            ))}
          </div>
        )}

        {/* Signed terminal */}
        <div className="rounded-lg border border-border/60 bg-[#05070a]">
          <div className="flex items-center justify-between border-b border-border/40 px-3 py-1.5 font-mono text-[10px]">
            <span className="flex items-center gap-1.5 text-cyan-400">
              <Radio className="h-3 w-3" /> SIGNED CHAIN · genesis{" "}
              {state ? state.genesis.slice(0, 10) : "—"}…
            </span>
            <span
              className={
                state?.verify.valid ? "text-emerald-400" : "text-red-400"
              }
            >
              <ShieldCheck className="mr-1 inline h-3 w-3" />
              {state ? (state.verify.valid ? "✅ INTACT" : "❌ BROKEN") : "…"}
            </span>
          </div>
          <div ref={scrollRef} className="max-h-56 overflow-y-auto px-3 py-2 font-mono text-[10px] leading-relaxed tw-scroll-dark">
            {loading && (
              <div className="text-muted-foreground">loading signed chain…</div>
            )}
            {state?.entries.map((e) => (
              <div key={e.seq} className={`whitespace-nowrap ${typeColor(e.type)}`}>
                <span className="text-muted-foreground/60">
                  {String(e.seq).padStart(3, "0")}
                </span>{" "}
                <span className="font-semibold">{e.type}</span>{" "}
                <span className="text-muted-foreground/70">{e.source}</span>{" "}
                {e.reason && <span className="text-amber-400/80">{e.reason}</span>}{" "}
                <span className="text-muted-foreground/50">
                  {new Date(e.timestamp).toLocaleTimeString("en-ZA", { hour12: false })}
                </span>{" "}
                <span className="inline-flex items-center gap-0.5 text-emerald-400/70" title="Ed25519 signature">
                  <Link2 className="h-2.5 w-2.5" />
                  {e.meta?.signature ? e.meta.signature.replace("…", "").slice(0, 10) : "—"}
                </span>{" "}
                <span className="text-muted-foreground/40">{e.chain_hash.slice(0, 10)}</span>
              </div>
            ))}
            {!loading && state && state.entries.length === 0 && (
              <div className="text-muted-foreground">
                chain is empty — append a receipt above
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "emerald" | "red";
}) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/20 p-2">
      <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-0.5 truncate text-sm font-bold ${mono ? "font-mono" : ""} ${
          tone === "emerald"
            ? "text-emerald-400"
            : tone === "red"
            ? "text-red-400"
            : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
