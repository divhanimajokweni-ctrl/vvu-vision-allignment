"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  Gauge,
  Power,
  Radio,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Timer,
  Waves,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  appendClient,
  newClientChain,
  shortHash,
  verifyClientChain,
  type ClientChain,
  type ClientEntry,
} from "@/lib/worm/client";

type SimState = "LIVE" | "SENSOR_ABSENT" | "FAIL_CLOSED";

interface SimSnapshot {
  state: SimState;
  connected: boolean;
  flowIn: number;
  flowOut: number;
  breakerTripped: boolean;
  leakActive: boolean;
  lastReadingAt: number;
  secondsSinceReading: number;
  entries: ClientEntry[];
  valid: boolean;
  head: string;
  count: number;
}

const FAIL_CLOSED_MS = 15000;
const HEARTBEAT_MS = 60000;
const LEAK_THRESHOLD = 5.0;
const LEAK_HOLD_MS = 5000;

export function LiveFailClosedSim() {
  const chainRef = useRef<ClientChain | null>(null);
  const [ready, setReady] = useState(false);
  const [snap, setSnap] = useState<SimSnapshot | null>(null);

  // Mutable sim state in refs (avoids re-creating interval each tick)
  const connectedRef = useRef(true);
  const stateRef = useRef<SimState>("LIVE");
  const lastReadingAtRef = useRef(Date.now());
  const lastHeartbeatAtRef = useRef(Date.now());
  const breakerRef = useRef(false);
  const leakInjectedRef = useRef(false);
  const leakStartedAtRef = useRef<number | null>(null);
  const leakEmittedRef = useRef(false);
  const flowInRef = useRef(41.3);
  const flowOutRef = useRef(33.3);
  const absentEmittedRef = useRef(false);
  const failClosedEmittedRef = useRef(false);
  const [, setTick] = useState(0); // forces re-render
  const [busy, setBusy] = useState(false);

  const pushSnapshot = useCallback(async () => {
    if (!chainRef.current) return;
    const verify = await verifyClientChain(chainRef.current);
    setSnap({
      state: stateRef.current,
      connected: connectedRef.current,
      flowIn: flowInRef.current,
      flowOut: flowOutRef.current,
      breakerTripped: breakerRef.current,
      leakActive: leakEmittedRef.current,
      lastReadingAt: lastReadingAtRef.current,
      secondsSinceReading: Math.round((Date.now() - lastReadingAtRef.current) / 1000),
      entries: [...chainRef.current.entries],
      valid: verify.valid,
      head: verify.head,
      count: verify.count,
    });
  }, []);

  // Init chain
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const c = await newClientChain();
      if (cancelled) return;
      chainRef.current = c;
      lastReadingAtRef.current = Date.now();
      lastHeartbeatAtRef.current = Date.now();
      await appendClient(c, {
        type: "TELEMETRY",
        source: "plc_tap_N02",
        metrics: { flow_in: flowInRef.current, flow_out: flowOutRef.current },
        state: "LIVE",
        mode: "SIM",
        meta: { sim: true },
      });
      setReady(true);
      await pushSnapshot();
    })();
    return () => {
      cancelled = true;
    };
  }, [pushSnapshot]);

  // 1s telemetry loop
  useEffect(() => {
    if (!ready) return;
    const id = setInterval(async () => {
      const c = chainRef.current;
      if (!c) return;
      const now = Date.now();

      if (connectedRef.current) {
        // Drift the SIM values
        flowInRef.current = +(41.3 + (Math.random() - 0.5) * 1.6).toFixed(2);
        let baseOut = 33.3 + (Math.random() - 0.5) * 1.2;
        if (leakInjectedRef.current) baseOut = 22.0 + (Math.random() - 0.5) * 1.5; // leak → out drops
        flowOutRef.current = +baseOut.toFixed(2);
        lastReadingAtRef.current = now;
        absentEmittedRef.current = false;
        failClosedEmittedRef.current = false;

        await appendClient(c, {
          type: "TELEMETRY",
          source: "plc_tap_N02",
          metrics: { flow_in: flowInRef.current, flow_out: flowOutRef.current },
          state: "LIVE",
          mode: "SIM",
          meta: { sim: true },
        });

        // Leak detection
        const delta = flowInRef.current - flowOutRef.current;
        if (delta > LEAK_THRESHOLD) {
          if (leakStartedAtRef.current == null) leakStartedAtRef.current = now;
          else if (now - leakStartedAtRef.current > LEAK_HOLD_MS && !leakEmittedRef.current) {
            leakEmittedRef.current = true;
            await appendClient(c, {
              type: "LEAK_RECEIPT",
              source: "plc_tap_N02",
              reason: "LEAK_ACTIVE",
              metrics: { flow_in: flowInRef.current, flow_out: flowOutRef.current, missing: +delta.toFixed(2) },
              state: "LEAK_ACTIVE",
              mode: "SIM",
              meta: { sim: true },
            });
          }
        } else {
          leakStartedAtRef.current = null;
          leakEmittedRef.current = false;
        }

        stateRef.current = breakerRef.current ? "FAIL_CLOSED" : "LIVE";

        // LIVENESS heartbeat every 60s
        if (now - lastHeartbeatAtRef.current > HEARTBEAT_MS) {
          lastHeartbeatAtRef.current = now;
          await appendClient(c, {
            type: "HEARTBEAT",
            source: "vvu-control-plane",
            reason: "LIVENESS",
            state: "LIVE",
            mode: "SIM",
            meta: { sim: true },
          });
        }
      } else {
        // Disconnected — silence
        const elapsed = now - lastReadingAtRef.current;
        if (elapsed > FAIL_CLOSED_MS && !absentEmittedRef.current) {
          absentEmittedRef.current = true;
          stateRef.current = "SENSOR_ABSENT";
          await appendClient(c, {
            type: "ABSENCE_RECEIPT",
            source: "plc_tap_N02",
            reason: "SENSOR_ABSENT",
            state: "SENSOR_ABSENT",
            mode: "SIM",
            meta: { sim: true },
          });
        }
        if (elapsed > HEARTBEAT_MS && !failClosedEmittedRef.current) {
          failClosedEmittedRef.current = true;
          stateRef.current = "FAIL_CLOSED";
          breakerRef.current = true;
          await appendClient(c, {
            type: "HEARTBEAT",
            source: "plc_tap_N02",
            reason: "NO_DATA_60S",
            state: "FAIL_CLOSED",
            mode: "SIM",
            meta: { sim: true },
          });
          await appendClient(c, {
            type: "BREAKER_RECEIPT",
            source: "plc_tap_N02",
            reason: "BREAKER_TRIPPED",
            state: "BREAKER_TRIPPED",
            mode: "SIM",
            meta: { sim: true },
          });
        }
      }

      await pushSnapshot();
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [ready, pushSnapshot]);

  // Actions
  const act = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true);
      try {
        await fn();
        await pushSnapshot();
      } finally {
        setBusy(false);
      }
    },
    [pushSnapshot]
  );

  const disconnect = () => act(async () => {
    connectedRef.current = false;
  });
  const reconnect = () =>
    act(async () => {
      if (stateRef.current !== "FAIL_CLOSED") return;
      const c = chainRef.current!;
      connectedRef.current = true;
      breakerRef.current = false;
      leakInjectedRef.current = false;
      leakStartedAtRef.current = null;
      leakEmittedRef.current = false;
      absentEmittedRef.current = false;
      failClosedEmittedRef.current = false;
      lastReadingAtRef.current = Date.now();
      lastHeartbeatAtRef.current = Date.now();
      stateRef.current = "LIVE";
      await appendClient(c, {
        type: "RESET_RECEIPT",
        source: "vvu-control-plane",
        reason: "OPERATOR_ACK",
        state: "LIVE",
        mode: "SIM",
        meta: { sim: true },
      });
    });
  const injectLeak = () => act(async () => {
    leakInjectedRef.current = true;
  });
  const overcurrent = () =>
    act(async () => {
      const c = chainRef.current!;
      breakerRef.current = true;
      stateRef.current = "FAIL_CLOSED";
      await appendClient(c, {
        type: "BREAKER_RECEIPT",
        source: "plc_tap_N02",
        reason: "BREAKER_TRIPPED",
        metrics: { breaker_current: 311 },
        state: "BREAKER_TRIPPED",
        mode: "SIM",
        meta: { sim: true },
      });
    });

  if (!snap) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Initialising fail-closed telemetry loop…
        </div>
      </Card>
    );
  }

  const countdownPct = Math.min(100, (snap.secondsSinceReading / 60) * 100);
  const stateColor =
    snap.state === "LIVE"
      ? "text-emerald-400"
      : snap.state === "SENSOR_ABSENT"
      ? "text-amber-400"
      : "text-red-400";
  const stateBg =
    snap.state === "LIVE"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : snap.state === "SENSOR_ABSENT"
      ? "border-amber-500/30 bg-amber-500/5"
      : "border-red-500/50 bg-red-500/5";

  return (
    <Card className={`overflow-hidden border-2 ${stateBg}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-400" />
            <CardTitle className="text-sm font-mono tracking-wide">
              LIVE FAIL-CLOSED TELEMETRY · plc_tap_N02
            </CardTitle>
          </div>
          <Badge
            variant="outline"
            className={`font-mono text-[10px] ${
              snap.state === "LIVE"
                ? "border-emerald-500/40 text-emerald-400"
                : snap.state === "SENSOR_ABSENT"
                ? "border-amber-500/40 text-amber-400"
                : "border-red-500/50 text-red-400"
            }`}
          >
            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
            {snap.state}
          </Badge>
        </div>
        <CardDescription className="font-mono text-[10px]">
          Simulated industrial flow sensor · all values tagged [SIM] · 15s/60s fail-closed windows
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Telemetry + countdown */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric
            icon={<Waves className="h-3.5 w-3.5" />}
            label="flow_in"
            value={snap.connected ? `${snap.flowIn.toFixed(2)}` : "—"}
            unit="L/s"
            sim
          />
          <Metric
            icon={<Waves className="h-3.5 w-3.5" />}
            label="flow_out"
            value={snap.connected ? `${snap.flowOut.toFixed(2)}` : "—"}
            unit="L/s"
            sim
            danger={snap.leakActive}
          />
          <Metric
            icon={<Gauge className="h-3.5 w-3.5" />}
            label="Δ leak"
            value={snap.connected ? `${(snap.flowIn - snap.flowOut).toFixed(2)}` : "—"}
            unit="L/s"
            sim
            danger={snap.leakActive}
          />
          <Metric
            icon={<Zap className="h-3.5 w-3.5" />}
            label="breaker"
            value={snap.breakerTripped ? "TRIPPED" : "CLOSED"}
            unit=""
            danger={snap.breakerTripped}
            sim
          />
        </div>

        {/* Countdown */}
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
          <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Timer className="h-3.5 w-3.5" /> TIME SINCE LAST READING
            </span>
            <span className={stateColor}>
              {snap.secondsSinceReading}s · {snap.state}
            </span>
          </div>
          <Progress
            value={countdownPct}
            className={`h-2 ${
              snap.secondsSinceReading > 60
                ? "[&>div]:bg-red-500"
                : snap.secondsSinceReading > 15
                ? "[&>div]:bg-amber-500"
                : "[&>div]:bg-emerald-500"
            }`}
          />
          <div className="mt-1.5 flex justify-between font-mono text-[9px] text-muted-foreground">
            <span>0s · LIVE</span>
            <span className="text-amber-400">15s · SENSOR_ABSENT</span>
            <span className="text-red-400">60s · FAIL_CLOSED</span>
          </div>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button
            onClick={disconnect}
            disabled={!snap.connected || busy}
            variant="outline"
            className="h-11 font-mono text-[10px] border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
          >
            <Power className="mr-1.5 h-3.5 w-3.5" /> DISCONNECT
          </Button>
          <Button
            onClick={reconnect}
            disabled={snap.state !== "FAIL_CLOSED" || busy}
            variant="outline"
            className="h-11 font-mono text-[10px] border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40"
          >
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> RECONNECT (ACK)
          </Button>
          <Button
            onClick={injectLeak}
            disabled={!snap.connected || busy}
            variant="outline"
            className="h-11 font-mono text-[10px] border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
          >
            <Waves className="mr-1.5 h-3.5 w-3.5" /> INJECT LEAK
          </Button>
          <Button
            onClick={overcurrent}
            disabled={!snap.connected || busy}
            variant="outline"
            className="h-11 font-mono text-[10px] border-red-500/40 text-red-400 hover:bg-red-500/10"
          >
            <Zap className="mr-1.5 h-3.5 w-3.5" /> OVERCURRENT
          </Button>
        </div>
        {snap.state === "FAIL_CLOSED" && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 font-mono text-[10px] text-red-300">
            <ShieldAlert className="mr-1.5 inline h-3.5 w-3.5" />
            FAIL-CLOSED INITIATED · breaker TRIPPED · authorization revoked. Reconnect requires explicit operator ack.
          </div>
        )}

        {/* WORM terminal */}
        <WormTerminal
          entries={snap.entries}
          valid={snap.valid}
          count={snap.count}
          head={snap.head}
          genesis={chainRef.current?.genesis ?? ""}
        />
      </CardContent>
    </Card>
  );
}

function Metric({
  icon,
  label,
  value,
  unit,
  sim,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  sim?: boolean;
  danger?: boolean;
}) {
  return (
    <div className={`rounded-md border p-2.5 ${danger ? "border-red-500/40 bg-red-500/5" : "border-border/60 bg-muted/20"}`}>
      <div className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`mt-1 font-mono text-lg font-bold ${danger ? "text-red-400" : "text-foreground"}`}>
        {value}
        {unit && <span className="ml-1 text-[10px] font-normal text-muted-foreground">{unit}</span>}
      </div>
      {sim && (
        <span className="mt-0.5 inline-block rounded-sm border border-amber-500/30 px-1 font-mono text-[8px] text-amber-400">
          SIM
        </span>
      )}
    </div>
  );
}

function WormTerminal({
  entries,
  valid,
  count,
  head,
  genesis,
}: {
  entries: ClientEntry[];
  valid: boolean;
  count: number;
  head: string;
  genesis: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [entries.length]);

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

  const shown = entries.slice(-40);

  return (
    <div className="rounded-lg border border-border/60 bg-[#05070a]">
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-1.5 font-mono text-[10px]">
        <span className="flex items-center gap-1.5 text-cyan-400">
          <Radio className="h-3 w-3" /> WORM TERMINAL · client SHA-256 chain
        </span>
        <span className={valid ? "text-emerald-400" : "text-red-400"}>
          {valid ? "✅" : "❌"} CHAIN {valid ? "INTACT" : "BROKEN"} · {count} entries
        </span>
      </div>
      <div ref={scrollRef} className="max-h-56 overflow-y-auto px-3 py-2 font-mono text-[10px] leading-relaxed tw-scroll-dark">
        <div className="text-violet-400/70">genesis · {shortHash(genesis, 16)}…</div>
        <div className="text-muted-foreground/50">head · {shortHash(head, 16)}…</div>
        <div className="my-1 h-px bg-border/30" />
        {shown.map((e) => (
          <div key={e.seq} className={`whitespace-nowrap ${typeColor(e.type)}`}>
            <span className="text-muted-foreground/60">{String(e.seq).padStart(3, "0")}</span>{" "}
            <span className="font-semibold">{e.type}</span>{" "}
            <span className="text-muted-foreground/70">{e.source}</span>{" "}
            {e.reason && <span className="text-amber-400/80">{e.reason}</span>}{" "}
            <span className="text-muted-foreground/50">
              {new Date(e.timestamp).toLocaleTimeString("en-ZA", { hour12: false })}
            </span>{" "}
            <span className="text-muted-foreground/40">{shortHash(e.chain_hash)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
