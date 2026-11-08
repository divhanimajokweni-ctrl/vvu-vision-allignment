"use client";
import { useEffect, useRef, useState } from "react";
import { Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
interface LogLine { t: number; tag: "SYS"|"AI"|"WORM"|"FAIL"; text: string; tone: "dim"|"cyan"|"emerald"|"amber"|"red"; }
let tc = 0;
export function CommandTerminal({ className = "" }: { className?: string }) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [simState, setSimState] = useState("LIVE");
  const [ood, setOod] = useState(0.02);
  const ref = useRef<HTMLDivElement>(null);
  const lastSt = useRef("LIVE");
  const lastHb = useRef(Date.now());
  const push = (tag: LogLine["tag"], text: string, tone: LogLine["tone"]) => { tc++; setLines(p => [...p.slice(-80), { t: tc, tag, text, tone }]); };
  useEffect(() => {
    push("SYS", "HBK Mk-II Particle Filter active (10,000 particles)", "cyan");
    push("WORM", "ProofBridge WORM head: E965B01D8A3F4C", "amber");
    push("AI", "OOD detector: Mahalanobis · threshold τ=0.85", "cyan");
  }, []);
  useEffect(() => {
    const id = setInterval(() => {
      const b = document.querySelector("[data-sim-state]");
      const st = b?.getAttribute("data-sim-state") || "LIVE";
      const now = Date.now();
      if (st !== lastSt.current) {
        if (st === "SENSOR_ABSENT") { push("AI", `OOD Score: ${(0.7+Math.random()*0.25).toFixed(2)} — Out of Distribution`, "amber"); push("FAIL", "FAIL_CLOSED triggered. SENSOR_ABSENT receipt minted.", "red"); }
        else if (st === "FAIL_CLOSED") { push("FAIL", "Breaker TRIPPED. Authorization revoked.", "red"); }
        else if (st === "LIVE" && lastSt.current !== "LIVE") { push("SYS", "Operator ack. Resetting breaker.", "emerald"); }
        lastSt.current = st; setSimState(st);
      }
      if (st === "LIVE") {
        const o = +(0.01+Math.random()*0.14).toFixed(3); setOod(o);
        if (tc%5===0) push("AI", `Input distribution check PASS. OOD: ${o.toFixed(3)}`, "emerald");
        if (tc%11===0) push("WORM", `TELEMETRY appended · hash=${Math.random().toString(16).slice(2,14)}`, "cyan");
        if (now-lastHb.current>60000) { lastHb.current=now; push("WORM", "HEARTBEAT(LIVENESS) appended", "dim"); }
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [lines]);
  const tc2 = (t: string) => t==="cyan"?"text-cyan-400/80":t==="emerald"?"text-emerald-400":t==="amber"?"text-amber-400":t==="red"?"text-red-400":"text-muted-foreground/70";
  const tg = (t: string) => t==="AI"?"text-cyan-400":t==="WORM"?"text-amber-400/80":t==="FAIL"?"text-red-400":"text-muted-foreground";
  return (
    <Card className={`flex flex-col ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2"><Terminal className="h-4 w-4 text-cyan-400" /><CardTitle className="text-sm font-mono tracking-wide">COMMAND TERMINAL · AI SAFETY ENVELOPE</CardTitle></div>
          <Badge variant="outline" className={`font-mono text-[10px] ${simState==="LIVE"?"border-emerald-500/40 text-emerald-400":simState==="SENSOR_ABSENT"?"border-amber-500/40 text-amber-400":"border-red-500/50 text-red-400"}`}><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse" />{simState}</Badge>
        </div>
        <CardDescription className="font-mono text-[10px]">ISO/PAS 8800 runtime monitoring · OOD score + Kirchhoff sanity + WORM receipts</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <div ref={ref} className="tw-scroll-dark min-h-[300px] flex-1 overflow-y-auto rounded-lg border border-border/60 bg-[#05070a] px-3 py-2 font-mono text-[10px] leading-relaxed">
          {lines.map(l => <div key={l.t} className={`whitespace-nowrap ${tc2(l.tone)}`}><span className="text-muted-foreground/50">[T+{String(l.t).padStart(3,"0")}]</span> <span className={`font-semibold ${tg(l.tag)}`}>{l.tag}:</span> {l.text}</div>)}
          <div className="text-cyan-400/40"><span className="animate-pulse">▊</span></div>
        </div>
        <div className="mt-2 flex items-center justify-between rounded-sm border border-border/40 bg-background/40 px-2 py-1.5 font-mono text-[9px] text-muted-foreground">
          <span><span className="text-cyan-400/60">OOD:</span> <span className={ood>0.5?"text-red-400":ood>0.15?"text-amber-400":"text-emerald-400"}>{ood.toFixed(3)}</span> / τ=0.850</span>
          <span><span className="text-cyan-400/60">Kirchhoff:</span> <span className="text-emerald-400">PASS</span></span>
          <span>Entries: {lines.length}</span>
        </div>
      </CardContent>
    </Card>
  );
}
