"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface SessionRow {
  id: string; ambient: boolean; status: 'open' | 'closed';
  startedAt: string; closedAt?: string; eventCount: number;
  merkleRoot?: string; meta: Record<string, unknown>;
}
interface Ev { seq: number; ts: string; type: string; level: string; source: string; message: string }
interface VerifyResult { sessionId: string; ok: boolean; checked: number; merkleRoot?: string; firstBroken?: { seq: number } }
interface ReplayResult {
  eventCount: number; httpCount: number; errorCount: number;
  levelCounts: Record<string, number>; typeCounts: Record<string, number>;
  httpBySource: Array<{ source: string; count: number; p50?: number; p95?: number; max?: number }>;
  errors: Array<{ seq: number; ts: string; source: string; message: string }>;
  spans: Array<{ spanId: string; name: string; durationMs?: number; closed: boolean }>;
  chainHead: string;
}
interface DiffRow { signature: string; count: number; firstSeq: number; error: boolean }
interface DiffResult {
  a: string; b: string;
  summary: { onlyInA: number; onlyInB: number; drift: number };
  earliestDivergence?: { signature: string; firstSeq: number; interpretation: string };
  onlyInA: DiffRow[]; onlyInB: DiffRow[];
  drift: Array<{ signature: string; countA: number; countB: number; countDelta: number; p50A?: number; p50B?: number; durationRatio?: number }>;
}

const LEVEL_CLASS: Record<string, string> = {
  error: "text-violating", warn: "text-repairing", info: "text-foreground", debug: "text-muted-foreground",
};

async function apiGet(qs: string) {
  const r = await fetch(`/api/debugger?${qs}`);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).reason ?? `HTTP ${r.status}`);
  return r.json();
}
async function apiPost(body: Record<string, unknown>) {
  const r = await fetch('/api/debugger', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return r.json();
}

export function DebuggerPanel() {
  const [up, setUp] = useState<boolean | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [live, setLive] = useState<Ev[]>([]);
  const [replay, setReplay] = useState<ReplayResult | null>(null);
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [diffA, setDiffA] = useState('');
  const [diffB, setDiffB] = useState('');
  const [verdicts, setVerdicts] = useState<Record<string, VerifyResult>>({});
  const [busy, setBusy] = useState(false);
  const lastSeq = useRef(0);

  const activeSession = useMemo(() => sessions.find((s) => s.id === selected), [sessions, selected]);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        await apiGet('op=status');
        if (alive) setUp(true);
        const j = await apiGet('op=sessions');
        if (alive) setSessions(j.sessions ?? []);
      } catch { if (alive) setUp(false); }
    };
    void tick();
    const t = setInterval(tick, 4000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  useEffect(() => {
    if (!selected || activeSession?.status !== 'open') return;
    let alive = true;
    const tick = async () => {
      try {
        const j = await apiGet(`op=session&id=${encodeURIComponent(selected)}&afterSeq=${lastSeq.current}`);
        if (!alive) return;
        const evs: Ev[] = j.events ?? [];
        if (evs.length > 0) {
          lastSeq.current = evs[evs.length - 1]!.seq;
          setLive((prev) => [...prev, ...evs].slice(-300));
        }
      } catch {}
    };
    void tick();
    const t = setInterval(tick, 1500);
    return () => { alive = false; clearInterval(t); };
  }, [selected, activeSession?.status]);

  const select = (id: string) => { setSelected(id); setLive([]); setReplay(null); lastSeq.current = 0; };

  const startCapture = async () => {
    setBusy(true);
    try {
      const j = await apiPost({ op: 'start', payload: { app: 'vvu-web', label: 'dashboard capture' } });
      if (j.sessionId) { await apiPost({ op: 'bind', id: j.sessionId }); select(j.sessionId); }
    } finally { setBusy(false); }
  };

  const stopCapture = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await apiPost({ op: 'unbind' });
      const j = await apiPost({ op: 'close', id: selected, payload: { reason: 'dashboard' } });
      if (j.merkleRoot) void checkVerify(selected);
    } finally { setBusy(false); }
  };

  const checkVerify = useCallback(async (id: string) => {
    try {
      const result = await apiGet(`op=verify&id=${encodeURIComponent(id)}`);
      setVerdicts((v) => ({ ...v, [id]: result }));
    } catch {}
  }, []);

  const runReplay = async () => {
    if (!selected) return;
    setBusy(true);
    try { const j = await apiGet(`op=replay&id=${encodeURIComponent(selected)}`); setReplay(j.replay); }
    finally { setBusy(false); }
  };

  const runDiff = async () => {
    if (!diffA || !diffB || diffA === diffB) return;
    setBusy(true);
    try { const j = await apiPost({ op: 'diff', payload: { a: diffA, b: diffB } }); setDiff(j.diff); }
    finally { setBusy(false); }
  };

  return (
    <Card className="bg-card/60 backdrop-blur border-border/60 p-4 relative overflow-hidden">
      <div className="bg-grid-fine absolute inset-0 opacity-20" />
      <div className="relative">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/60">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: "var(--vvu-lime)" }}>Native Debugger</h3>
            <p className="text-[10px] text-muted-foreground">WORM evidence · pure replay · least-divergent diff · :3098</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("h-2 w-2 rounded-full", up === null ? "animate-pulse bg-muted-foreground" : up ? "bg-[var(--vvu-lime)]" : "bg-[var(--vvu-crimson)]")} />
              {up === null ? 'probing' : up ? 'collector online' : 'offline'}
            </span>
            {activeSession?.status === 'open' ? (
              <Button size="sm" variant="destructive" onClick={stopCapture} disabled={busy}>Stop & Anchor</Button>
            ) : (
              <Button size="sm" onClick={startCapture} disabled={busy || up !== true} style={{ background: "var(--vvu-lime)", color: "var(--vvu-bg)" }}>Start Capture</Button>
            )}
          </div>
        </div>

        {up === false && (
          <div className="mb-3 rounded-md border p-3 text-xs" style={{ borderColor: "rgba(229,72,77,0.3)", background: "rgba(229,72,77,0.05)", color: "var(--vvu-crimson)" }}>
            Collector unreachable on :3098 — start it with <code className="font-mono">cd mini-services/debugger && bun run dev</code>. Zero-trust: the panel reports the gap; it never fabricates evidence.
          </div>
        )}

        <Tabs defaultValue="sessions" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
            <TabsTrigger value="live">Live</TabsTrigger>
            <TabsTrigger value="replay">Replay</TabsTrigger>
            <TabsTrigger value="diff">Diff</TabsTrigger>
          </TabsList>

          <TabsContent value="sessions" className="space-y-2">
            <div className="max-h-72 overflow-auto rounded-md border border-border/60">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left font-medium">Session</th>
                    <th className="p-2 text-left font-medium">Status</th>
                    <th className="p-2 text-right font-medium">Events</th>
                    <th className="p-2 text-left font-medium">Anchor</th>
                    <th className="p-2 text-right font-medium">Chain</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id} onClick={() => select(s.id)} className={cn("cursor-pointer border-t hover:bg-muted/30", selected === s.id && "bg-muted/40")}>
                      <td className="p-2 font-mono">
                        {s.ambient && <Badge variant="outline" className="mr-1.5 py-0 text-[10px]">ambient</Badge>}
                        {s.id}
                      </td>
                      <td className="p-2"><Badge variant={s.status === 'open' ? 'default' : 'secondary'} className="py-0 text-[10px]">{s.status}</Badge></td>
                      <td className="p-2 text-right font-mono">{s.eventCount}</td>
                      <td className="p-2 font-mono text-[10px] text-muted-foreground">{s.merkleRoot ? `${s.merkleRoot.slice(0, 10)}…` : '—'}</td>
                      <td className="p-2 text-right">
                        {verdicts[s.id] ? (
                          <Badge variant={verdicts[s.id]!.ok ? 'default' : 'destructive'} className="py-0 text-[10px]">
                            {verdicts[s.id]!.ok ? `✓ ${verdicts[s.id]!.checked}` : `✗ @${verdicts[s.id]!.firstBroken?.seq}`}
                          </Badge>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={(e) => { e.stopPropagation(); void checkVerify(s.id); }}>verify</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {sessions.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No sessions yet — start a capture.</td></tr>}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="live" className="space-y-2">
            {!selected ? (
              <p className="p-4 text-center text-xs text-muted-foreground">Select a session above.</p>
            ) : activeSession?.status === 'open' ? (
              <div className="max-h-72 overflow-auto rounded-md border border-border/60 bg-background/50 p-2 font-mono text-[11px] leading-relaxed">
                {live.length === 0 && <p className="text-muted-foreground">listening…</p>}
                {live.map((e) => (
                  <div key={e.seq} className="flex gap-2">
                    <span className="w-10 shrink-0 text-right text-muted-foreground">{e.seq}</span>
                    <span className="w-16 shrink-0 text-muted-foreground">{e.ts.slice(11, 23)}</span>
                    <span className="w-14 shrink-0 uppercase" style={{ color: "var(--vvu-sage-bright)" }}>{e.type}</span>
                    <span className={cn("w-10 shrink-0 uppercase", LEVEL_CLASS[e.level] ?? "")}>{e.level}</span>
                    <span className="w-28 shrink-0 truncate" style={{ color: "var(--vvu-ochre)" }}>{e.source}</span>
                    <span className="text-foreground">{e.message}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="p-4 text-center text-xs text-muted-foreground">Session closed — see Replay for the compiled view.</p>
            )}
          </TabsContent>

          <TabsContent value="replay" className="space-y-3">
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={runReplay} disabled={!selected || busy}>Compile Replay</Button>
              {replay && <span className="text-xs text-muted-foreground">head <code className="font-mono">{replay.chainHead.slice(0, 16)}…</code></span>}
            </div>
            {replay && (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Stat label="events" value={replay.eventCount} />
                  <Stat label="http" value={replay.httpCount} />
                  <Stat label="errors" value={replay.errorCount} highlight={replay.errorCount > 0} />
                  <Stat label="spans open" value={replay.spans.filter((s) => !s.closed).length} />
                </div>
                {replay.httpBySource.length > 0 && (
                  <Tableish header={['source', 'count', 'p50', 'p95', 'max']} rows={replay.httpBySource.map((h) => [h.source, String(h.count), String(h.p50 ?? '—'), String(h.p95 ?? '—'), String(h.max ?? '—')])} />
                )}
                {replay.errors.length > 0 && (
                  <div className="max-h-40 overflow-auto rounded-md border p-2 font-mono text-[11px]" style={{ borderColor: "rgba(229,72,77,0.2)", background: "rgba(229,72,77,0.05)", color: "var(--vvu-crimson)" }}>
                    {replay.errors.map((e) => (<div key={e.seq}>#{e.seq} {e.ts.slice(11, 19)} [{e.source}] {e.message}</div>))}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="diff" className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label className="flex items-center gap-1">A (investigate)
                <select className="rounded border border-border/60 bg-background px-1.5 py-1" value={diffA} onChange={(e) => setDiffA(e.target.value)}>
                  <option value="">—</option>
                  {sessions.map((s) => <option key={s.id} value={s.id}>{s.id}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-1">B (baseline)
                <select className="rounded border border-border/60 bg-background px-1.5 py-1" value={diffB} onChange={(e) => setDiffB(e.target.value)}>
                  <option value="">—</option>
                  {sessions.map((s) => <option key={s.id} value={s.id}>{s.id}</option>)}
                </select>
              </label>
              <Button size="sm" onClick={runDiff} disabled={!diffA || !diffB || diffA === diffB || busy}>Diff</Button>
            </div>
            {diff && (
              <>
                <p className="text-xs text-muted-foreground">{diff.summary.onlyInA} only in A · {diff.summary.onlyInB} only in B · {diff.summary.drift} drifted</p>
                {diff.earliestDivergence && (
                  <div className="rounded-md border p-2 text-xs" style={{ borderColor: "rgba(243,227,138,0.3)", background: "rgba(243,227,138,0.05)" }}>
                    <span className="font-medium" style={{ color: "var(--vvu-ochre)" }}>Least-divergent suspect:</span>{' '}
                    <code className="font-mono">{diff.earliestDivergence.signature}</code>{' '}
                    <span className="text-muted-foreground">(first at seq {diff.earliestDivergence.firstSeq} in A)</span>
                  </div>
                )}
                {diff.onlyInA.length > 0 && <Tableish header={['only in A', 'count', 'first seq']} mono rows={diff.onlyInA.map((r) => [r.signature, String(r.count), String(r.firstSeq)])} />}
                {diff.drift.length > 0 && <Tableish header={['drifted', 'A', 'B', 'Δcount', 'p50A', 'p50B', '×dur']} mono rows={diff.drift.map((r) => [r.signature, String(r.countA), String(r.countB), String(r.countDelta), String(r.p50A ?? '—'), String(r.p50B ?? '—'), String(r.durationRatio ?? '—')])} />}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={cn("rounded-md border p-2", highlight ? "border-violating/30 bg-violating/5" : "border-border/40")}>
      <div className={cn("font-mono text-lg", highlight && "text-violating")}>{value}</div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
    </div>
  );
}

function Tableish({ header, rows, mono }: { header: string[]; rows: string[][]; mono?: boolean }) {
  return (
    <div className="max-h-44 overflow-auto rounded-md border border-border/60">
      <table className="w-full text-[11px]">
        <thead className="sticky top-0 bg-muted/50 text-muted-foreground">
          <tr>{header.map((h) => <th key={h} className="p-1.5 text-left font-medium">{h}</th>)}</tr>
        </thead>
        <tbody className={mono ? 'font-mono' : ''}>
          {rows.map((r, i) => (<tr key={i} className="border-t border-border/40">{r.map((c, j) => <td key={j} className={cn("p-1.5", j > 0 && "text-right")}>{c}</td>)}</tr>))}
        </tbody>
      </table>
    </div>
  );
}
