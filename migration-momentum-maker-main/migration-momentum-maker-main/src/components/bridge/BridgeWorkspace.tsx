"use client";

// src/components/bridge/BridgeWorkspace.tsx — Task 36 · tenth projection
// #/bridge — the LIVE VAULT BRIDGE (Android Obsidian link).
//
// Why this exists: the operator's Obsidian vault lives on the phone at
// /storage/emulated/0/Documents/Obsidian — unreachable from this sandbox
// (Task 35: BLOCKED, the Android path is device-side). This projection is
// the bridge's control surface: QR PAIRING (the only per-device setup
// action), the live agent link, vault search/read/write THROUGH the phone
// (the vault never leaves the device — only op results transit), and the
// hash-chained receipt for every single operation.
//
// Honest labels: the bridge is a pilot-grade symmetric-secret channel over
// the gateway's TLS (not hardware Ed25519 — that is Mk-node lineage work).
// The one-time plugin install is the only manual step before QR pairing.
// Plugin: obsidian-plugin/proofbridge-vault-bridge/ in this repo.
//
// REBUILD NOTE (Task 38): rebuilt byte-equivalent after the platform
// sandbox rollback destroyed the Task 36/37 files; evidence regenerated.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bridgeFeed } from "@/lib/bridge-feed";
import type {
  BridgeStatus,
  PairInit,
  Receipt,
  SearchResult,
  VaultResult,
} from "@/components/bridge/bridge-types";
import { toast } from "sonner";
import {
  BookOpenText,
  Cable,
  FilePenLine,
  Fingerprint,
  Loader2,
  QrCode,
  RefreshCw,
  ScanLine,
  Search,
  ShieldCheck,
  Sigma,
  Smartphone,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Chip,
  LiveDot,
  SectionHeader,
  SectionReveal,
  fmtStamp,
} from "@/components/analytics/shared";
import { cn } from "@/lib/utils";

// ─── Types (mirror of the vault-bridge service contracts) ────────────────────

// ─── Component ───────────────────────────────────────────────────────────────

export function BridgeWorkspace() {
  const feedRef = useRef(bridgeFeed);

  const [socketUp, setSocketUp] = useState(false);
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [pair, setPair] = useState<PairInit | null>(null);
  const [pairLoading, setPairLoading] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);
  const [pairExpiresIn, setPairExpiresIn] = useState(0);

  const [results, setResults] = useState<VaultResult[]>([]); // op log (tail)
  const [receipts, setReceipts] = useState<Receipt[]>([]);

  const [query, setQuery] = useState("ProofBridge");
  const [searchOut, setSearchOut] = useState<{ busy: boolean; result?: VaultResult }>({
    busy: false,
  });

  const [readPath, setReadPath] = useState("README.md");
  const [readOut, setReadOut] = useState<{ busy: boolean; result?: VaultResult; content?: string }>(
    { busy: false },
  );

  const [writePath, setWritePath] = useState("ProofBridge/Bridge Note.md");
  const [writeBody, setWriteBody] = useState(
    "# Bridge Note\n\nWritten from the #/bridge projection — this note lands in the LIVE vault on the phone.\n",
  );
  const [writeOut, setWriteOut] = useState<{ busy: boolean; result?: VaultResult }>({
    busy: false,
  });

  const [verify, setVerify] = useState<{
    busy: boolean;
    valid?: boolean;
    checked?: number;
    root?: string;
  }>({ busy: false });

  // ── feed wiring (in-app device rail; was socket.io :3004) ──
  useEffect(() => {
    setSocketUp(true); // the in-app feed is always linked
    const feed = feedRef.current;

    const onStatus = (s: BridgeStatus) => {
      setStatus(s);
      setStatusError(null);
    };
    const onReceipt = (r: Receipt) =>
      setReceipts((prev) => [...prev.filter((x) => x.seq !== r.seq), r].slice(-100));
    const onResult = (r: VaultResult) => {
      setResults((prev) => [...prev, r].slice(-40));
      if (r.op === "search") setSearchOut({ busy: false, result: r });
      if (r.op === "read")
        setReadOut({
          busy: false,
          result: r,
          content: r.ok
            ? String((r.data as { content?: unknown } | undefined)?.content ?? "")
            : undefined,
        });
      if (r.op === "write") setWriteOut({ busy: false, result: r });
    };
    const onEvents = (p: { deviceId: string; events: { type: string; path: string }[] }) => {
      const e = p.events?.[0];
      if (e)
        toast(`VAULT ${e.type.toUpperCase()}: ${e.path.slice(0, 60)}`, {
          description: `live change on the phone · ${p.deviceId}`,
        });
    };

    const off = feed.onEvent((e) => {
      if (e.kind === "status" && e.status) onStatus(e.status);
      else if (e.kind === "receipt" && e.receipt) onReceipt(e.receipt);
      else if (e.kind === "result" && e.result) onResult(e.result);
      else if (e.kind === "events" && e.events) onEvents(e.events);
    });
    onStatus(feed.getStatus());

    return () => {
      off();
    };
  }, []);

  // ── initial status + receipts fetch (socket is one channel; HTTP is the other) ──
  const refreshStatus = useCallback(async () => {
    try {
      setStatus(bridgeFeed.getStatus());
      setStatusError(null);
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : "bridge unreachable");
    }
  }, []);

  const refreshReceipts = useCallback(async () => {
    try {
      setReceipts(bridgeFeed.getReceipts(100));
    } catch {
      /* feed events keep it fresh */
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
    void refreshReceipts();
    const t = setInterval(() => void refreshStatus(), 15_000);
    return () => clearInterval(t);
  }, [refreshStatus, refreshReceipts]);

  // ── pairing ──
  const initPair = useCallback(async () => {
    setPairLoading(true);
    setPairError(null);
    try {
      const origin = window.location.origin; // the LIVE origin — never invented
      setPair(await bridgeFeed.initPair(origin));
    } catch (e) {
      setPairError(e instanceof Error ? e.message : "pair init failed");
    } finally {
      setPairLoading(false);
    }
  }, []);

  useEffect(() => {
    void initPair();
  }, [initPair]);

  useEffect(() => {
    if (!pair) return;
    const tick = () => {
      const left = Math.max(
        0,
        Math.round((new Date(pair.expiresAt).getTime() - Date.now()) / 1000),
      );
      setPairExpiresIn(left);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [pair]);

  // ── ops ──
  const emitOp = useCallback(
    (op: "list" | "read" | "search" | "write", args: Record<string, unknown>) => {
      bridgeFeed.emitOp(op, args);
    },
    [],
  );

  const doSearch = () => {
    if (!query.trim()) return;
    setSearchOut({ busy: true });
    emitOp("search", { query: query.trim() });
  };
  const doRead = (path?: string) => {
    const p = (path ?? readPath).trim();
    if (!p) return;
    if (path) setReadPath(p);
    setReadOut({ busy: true });
    emitOp("read", { path: p });
  };
  const doWrite = () => {
    if (!writePath.trim()) return;
    setWriteOut({ busy: true });
    emitOp("write", { path: writePath.trim(), content: writeBody });
  };
  const doVerify = async () => {
    setVerify({ busy: true });
    try {
      const data = bridgeFeed.verifyChain();
      setVerify({
        busy: false,
        valid: data.valid,
        checked: data.checked,
        root: data.root ?? undefined,
      });
    } catch {
      setVerify({ busy: false });
    }
  };

  const searchResults = useMemo<SearchResult[]>(() => {
    const d = searchOut.result?.data as { results?: SearchResult[] } | undefined;
    return d?.results ?? [];
  }, [searchOut]);

  const receiptsRoot = status?.receipts.root ?? "";
  const agentName = status?.agent?.name ?? "—";
  const lastSeen = status?.agent ? `${Math.round(status.agent.lastSeenAgoMs / 1000)}s ago` : "—";

  return (
    <div className="absolute inset-0 overflow-y-auto vvu-grid-bg">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 pb-28 pt-6 space-y-5">
        {/* ── headline ── */}
        <SectionReveal featured>
          <div className="vvu-panel-solid p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="vvu-label text-[10px] text-[#c8ff00] border border-[#c8ff00]/40 px-2 py-0.5">
                    TASK 36 · TENTH PROJECTION
                  </span>
                  {status?.agentOnline ? (
                    <Chip tone="lime">
                      <LiveDot /> LIVE VAULT LINKED
                    </Chip>
                  ) : (
                    <Chip tone="amber" dashed>
                      <WifiOff className="size-3" /> AGENT OFFLINE
                    </Chip>
                  )}
                </div>
                <h1 className="vvu-label text-xl sm:text-2xl font-bold text-[#f3e38a] tracking-[0.18em] mt-2">
                  VAULT BRIDGE
                </h1>
                <p className="vvu-label text-[9px] sm:text-[10px] text-[#7a8a6e] mt-1 max-w-2xl leading-relaxed">
                  LIVE ANDROID OBSIDIAN LINK · QR-PAIR THE PHONE, THEN SEARCH / READ / WRITE THE
                  REAL VAULT — EVERY OPERATION RECEIPTED (SHA-256 CHAIN)
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <Chip tone={socketUp ? "lime" : "dim"}>
                  <LiveDot dim={!socketUp} /> VIEWER {socketUp ? "LINKED" : "DOWN"}
                </Chip>
                <Chip tone="dim">
                  <Cable className="size-3" /> IN-APP DEVICE FEED
                </Chip>
                <Chip tone={status?.receipts.verified ? "lime" : "dim"}>
                  <Sigma className="size-3" /> {status?.receipts.count ?? 0} RECEIPTS · CHAIN{" "}
                  {status?.receipts.verified ? "VALID" : "?"}
                </Chip>
              </div>
            </div>
            {statusError && (
              <p className="vvu-label text-[9px] text-red-400 mt-3">
                DEVICE FEED STALLED — {statusError}
              </p>
            )}
          </div>
        </SectionReveal>

        {/* ── §1 pairing ── */}
        <SectionReveal>
          <section className="vvu-panel p-4 sm:p-6" aria-labelledby="bridge-pair-h">
            <SectionHeader
              num="1"
              title="QR PAIRING — THE ONLY SETUP ACTION"
              kicker="scan with the phone camera → Obsidian opens → plugin pairs → live"
              right={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void initPair()}
                  disabled={pairLoading}
                >
                  {pairLoading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3.5" />
                  )}{" "}
                  RE-MINT
                </Button>
              }
            />
            <div id="bridge-pair-h" className="grid md:grid-cols-[auto_1fr] gap-5 items-start">
              <div className="mx-auto md:mx-0">
                {pair ? (
                  <div className="relative">
                    <img
                      src={pair.qrDataUrl}
                      alt="Vault bridge pairing QR — obsidian://proofbridge-pair URI"
                      className="w-44 h-44 sm:w-52 sm:h-52 rounded border-2 border-[#6b8a40]/50 bg-[#f3e38a]"
                    />
                    <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 vvu-label text-[9px] px-2 py-0.5 rounded bg-[#060806] border border-[#6b8a40]/60 text-[#c8ff00] tabular-nums">
                      {pairExpiresIn > 0
                        ? `EXPIRES ${Math.floor(pairExpiresIn / 60)}:${String(pairExpiresIn % 60).padStart(2, "0")}`
                        : "EXPIRED — RE-MINT"}
                    </span>
                  </div>
                ) : (
                  <div className="w-44 h-44 sm:w-52 sm:h-52 rounded border-2 border-dashed border-[#6b8a40]/40 flex items-center justify-center">
                    {pairLoading ? (
                      <Loader2 className="size-8 animate-spin text-[#7a8a6e]" />
                    ) : (
                      <QrCode className="size-8 text-[#7a8a6e]" />
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-2.5 min-w-0">
                {pairError && (
                  <p className="vvu-label text-[9px] text-red-400">
                    PAIR INIT FAILED — {pairError}
                  </p>
                )}
                <ol className="vvu-label text-[9px] sm:text-[10px] text-[#c9d4bd] space-y-1.5 leading-relaxed list-none">
                  <li className="flex gap-2">
                    <span className="text-[#c8ff00]">01</span> ONE-TIME (once per phone): copy{" "}
                    <code className="text-[#f3e38a]">
                      obsidian-plugin/proofbridge-vault-bridge/
                    </code>{" "}
                    into the vault&apos;s <code className="text-[#f3e38a]">.obsidian/plugins/</code>{" "}
                    and enable it (Community plugins).
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#c8ff00]">02</span> Scan this QR with the phone CAMERA —
                    it opens Obsidian via{" "}
                    <code className="text-[#f3e38a]">obsidian://proofbridge-pair</code> with a
                    single-use 10-minute token.
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#c8ff00]">03</span> The plugin pairs (HMAC device
                    secret), then connects + authenticates automatically whenever Obsidian is open.
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#c8ff00]">04</span> Status below flips LIVE — search,
                    read and write the real vault; every op returns a hash-chained receipt.
                  </li>
                </ol>
                {pair && (
                  <div className="pt-1">
                    <p className="vvu-label text-[8px] text-[#7a8a6e] mb-1">
                      PAIRING URI (what the QR encodes — origin is this live dashboard):
                    </p>
                    <p className="text-[9px] font-mono text-[#c9d4bd] break-all leading-relaxed bg-black/40 border border-[#6b8a40]/30 rounded p-2">
                      {pair.qrPayload}
                    </p>
                  </div>
                )}
                <p className="vvu-label text-[8px] text-[#7a8a6e]">
                  HONESTY: pilot-grade symmetric secret over gateway TLS — NOT hardware Ed25519
                  (Mk-node lineage). The vault never leaves the phone; only op results transit.
                </p>
              </div>
            </div>
          </section>
        </SectionReveal>

        {/* ── §2 agent link ── */}
        <SectionReveal>
          <section className="vvu-panel p-4 sm:p-6" aria-labelledby="bridge-agent-h">
            <SectionHeader num="2" title="AGENT LINK" kicker="the phone-side Obsidian plugin" />
            <div id="bridge-agent-h" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat
                label="AGENT"
                value={status?.agentOnline ? "ONLINE" : "OFFLINE"}
                tone={status?.agentOnline ? "lime" : "amber"}
                icon={<Smartphone className="size-3.5" />}
              />
              <Stat
                label="DEVICE"
                value={agentName}
                icon={<Fingerprint className="size-3.5" />}
                mono
              />
              <Stat
                label="LAST SEEN"
                value={lastSeen}
                icon={<ScanLine className="size-3.5" />}
                mono
              />
              <Stat
                label="PAIRED DEVICES"
                value={String(status?.pairedDevices ?? 0)}
                icon={<Cable className="size-3.5" />}
                mono
              />
            </div>
            {status?.agent && (
              <p className="vvu-label text-[9px] text-[#7a8a6e] mt-3">
                DEVICE ID <span className="text-[#c9d4bd] font-mono">{status.agent.deviceId}</span>{" "}
                · SESSION HOLDS WHILE OBSIDIAN IS OPEN · VIEWERS ON THIS PROJECTION:{" "}
                {status.viewerCount}
              </p>
            )}
          </section>
        </SectionReveal>

        {/* ── §3 live vault ops ── */}
        <SectionReveal>
          <section className="vvu-panel p-4 sm:p-6" aria-labelledby="bridge-ops-h">
            <SectionHeader
              num="3"
              title="LIVE VAULT OPS"
              kicker={
                status?.agentOnline
                  ? "relayed to the phone — results below + receipts in §4"
                  : "waiting for the agent (pair the phone)"
              }
              right={
                <Chip tone={status?.agentOnline ? "lime" : "dim"}>
                  <LiveDot dim={!status?.agentOnline} />{" "}
                  {status?.agentOnline ? "RELAY LIVE" : "NO AGENT"}
                </Chip>
              }
            />
            <div id="bridge-ops-h" className="grid lg:grid-cols-3 gap-4">
              {/* search */}
              <div className="space-y-2">
                <OpHead
                  icon={<Search className="size-3.5" />}
                  label="SEARCH"
                  hint="substring · markdown files · live"
                />
                <div className="flex gap-2">
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && doSearch()}
                    placeholder="search the live vault…"
                    className="h-9 text-xs font-mono bg-black/40"
                    aria-label="Vault search query"
                  />
                  <Button size="sm" onClick={doSearch} disabled={searchOut.busy || !query.trim()}>
                    {searchOut.busy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Search className="size-3.5" />
                    )}
                  </Button>
                </div>
                <div className="min-h-[150px] max-h-64 overflow-y-auto rounded border border-[#6b8a40]/30 bg-black/30">
                  {searchResults.length === 0 ? (
                    <p className="vvu-label text-[9px] text-[#7a8a6e] p-3">
                      {searchOut.result
                        ? searchOut.result.ok
                          ? "NO MATCHES"
                          : `ERROR — ${searchOut.result.error}`
                        : "RESULTS APPEAR HERE"}
                    </p>
                  ) : (
                    <ul className="divide-y divide-[#6b8a40]/15">
                      {searchResults.map((r, i) => (
                        <li key={`${r.path}:${r.line}:${i}`}>
                          <button
                            type="button"
                            onClick={() => doRead(r.path)}
                            className="w-full text-left px-2.5 py-1.5 hover:bg-[#6b8a40]/15 transition-colors"
                          >
                            <p className="text-[10px] font-mono text-[#f3e38a] truncate">
                              {r.path}:<span className="text-[#c8ff00]">{r.line}</span>
                            </p>
                            <p className="text-[9px] font-mono text-[#c9d4bd] truncate opacity-80">
                              {r.snippet}
                            </p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* read */}
              <div className="space-y-2">
                <OpHead
                  icon={<BookOpenText className="size-3.5" />}
                  label="READ"
                  hint="vault-relative path"
                />
                <div className="flex gap-2">
                  <Input
                    value={readPath}
                    onChange={(e) => setReadPath(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && doRead()}
                    placeholder="Notes/…"
                    className="h-9 text-xs font-mono bg-black/40"
                    aria-label="Vault file path to read"
                  />
                  <Button
                    size="sm"
                    onClick={() => doRead()}
                    disabled={readOut.busy || !readPath.trim()}
                  >
                    {readOut.busy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <BookOpenText className="size-3.5" />
                    )}
                  </Button>
                </div>
                <div className="min-h-[150px] max-h-64 overflow-y-auto rounded border border-[#6b8a40]/30 bg-black/30 p-2">
                  {readOut.content !== undefined ? (
                    <pre className="text-[9px] font-mono text-[#c9d4bd] whitespace-pre-wrap break-words leading-relaxed">
                      {readOut.content}
                    </pre>
                  ) : (
                    <p className="vvu-label text-[9px] text-[#7a8a6e]">
                      {readOut.result && !readOut.result.ok
                        ? `ERROR — ${readOut.result.error}`
                        : "FILE CONTENT APPEARS HERE"}
                    </p>
                  )}
                </div>
              </div>

              {/* write */}
              <div className="space-y-2">
                <OpHead
                  icon={<FilePenLine className="size-3.5" />}
                  label="WRITE"
                  hint="creates / overwrites on the phone"
                />
                <Input
                  value={writePath}
                  onChange={(e) => setWritePath(e.target.value)}
                  placeholder="ProofBridge/Bridge Note.md"
                  className="h-9 text-xs font-mono bg-black/40"
                  aria-label="Vault file path to write"
                />
                <Textarea
                  value={writeBody}
                  onChange={(e) => setWriteBody(e.target.value)}
                  className="min-h-[92px] max-h-40 text-[10px] font-mono bg-black/40 resize-y"
                  aria-label="Content to write into the vault"
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={doWrite} disabled={writeOut.busy || !writePath.trim()}>
                    {writeOut.busy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <FilePenLine className="size-3.5" />
                    )}{" "}
                    SAVE TO LIVE VAULT
                  </Button>
                  {writeOut.result && (
                    <Chip tone={writeOut.result.ok ? "lime" : "crimson"}>
                      {writeOut.result.ok
                        ? `WRITTEN · ${writeOut.result.elapsedMs ?? "?"}MS`
                        : "FAILED"}
                    </Chip>
                  )}
                </div>
              </div>
            </div>

            {/* op log */}
            <div className="mt-4">
              <p className="vvu-label text-[8px] text-[#7a8a6e] mb-1">OP LOG (latest first):</p>
              <div className="max-h-36 overflow-y-auto rounded border border-[#6b8a40]/30 bg-black/30">
                {results.length === 0 ? (
                  <p className="vvu-label text-[9px] text-[#7a8a6e] p-2.5">NO OPS YET</p>
                ) : (
                  <ul className="divide-y divide-[#6b8a40]/15">
                    {[...results].reverse().map((r, i) => (
                      <li
                        key={`${r.commandId ?? i}:${i}`}
                        className="flex items-center gap-2 px-2.5 py-1.5"
                      >
                        <Chip tone={r.ok ? "lime" : "crimson"} className="!text-[8px]">
                          {r.ok ? "OK" : "FAIL"}
                        </Chip>
                        <span className="vvu-label text-[9px] text-[#f3e38a] w-14 shrink-0">
                          {String(r.op).toUpperCase()}
                        </span>
                        <span className="text-[9px] font-mono text-[#c9d4bd] truncate flex-1">
                          {r.ok
                            ? r.op === "search"
                              ? `${(r.data as { results?: unknown[] })?.results?.length ?? 0} matches`
                              : String(
                                  (r.data as { path?: string })?.path ?? r.receipt?.target ?? "",
                                )
                            : r.error}
                        </span>
                        <span className="vvu-label text-[8px] text-[#7a8a6e] tabular-nums shrink-0">
                          {r.elapsedMs ?? "?"}ms
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        </SectionReveal>

        {/* ── §4 receipts ── */}
        <SectionReveal>
          <section className="vvu-panel p-4 sm:p-6" aria-labelledby="bridge-rec-h">
            <SectionHeader
              num="4"
              title="RECEIPTS — EVERY OPERATION, HASH-CHAINED"
              kicker={`root ${receiptsRoot ? `${receiptsRoot.slice(0, 16)}…` : "(genesis)"}`}
              right={
                <div className="flex items-center gap-2">
                  {verify.valid !== undefined && (
                    <Chip tone={verify.valid ? "lime" : "crimson"}>
                      <ShieldCheck className="size-3" />{" "}
                      {verify.valid ? "CHAIN VALID" : "CHAIN BROKEN"} · {verify.checked ?? 0}{" "}
                      CHECKED
                    </Chip>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void doVerify()}
                    disabled={verify.busy}
                  >
                    {verify.busy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="size-3.5" />
                    )}{" "}
                    VERIFY CHAIN
                  </Button>
                </div>
              }
            />
            <div
              id="bridge-rec-h"
              className="max-h-72 overflow-y-auto rounded border border-[#6b8a40]/30 bg-black/30"
            >
              {receipts.length === 0 ? (
                <p className="vvu-label text-[9px] text-[#7a8a6e] p-3">
                  NO RECEIPTS YET — ops appear here the moment they complete
                </p>
              ) : (
                <table className="w-full text-[9px] font-mono">
                  <thead className="sticky top-0 bg-[#0b0f0a]">
                    <tr className="vvu-label text-[8px] text-[#7a8a6e] text-left">
                      <th className="px-2 py-1.5">SEQ</th>
                      <th className="px-2 py-1.5">TS</th>
                      <th className="px-2 py-1.5">ACTOR</th>
                      <th className="px-2 py-1.5">OP</th>
                      <th className="px-2 py-1.5">TARGET</th>
                      <th className="px-2 py-1.5">HASH</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...receipts].reverse().map((r) => (
                      <tr key={r.seq} className="border-t border-[#6b8a40]/15">
                        <td className="px-2 py-1.5 text-[#7a8a6e] tabular-nums">{r.seq}</td>
                        <td className="px-2 py-1.5 text-[#7a8a6e]">{fmtStamp(r.ts)}</td>
                        <td className="px-2 py-1.5 text-[#c9d4bd] truncate max-w-24">{r.actor}</td>
                        <td className="px-2 py-1.5">
                          <span className={r.ok ? "text-[#c8ff00]" : "text-red-400"}>{r.op}</span>
                        </td>
                        <td
                          className="px-2 py-1.5 text-[#f3e38a] truncate max-w-40"
                          title={r.target}
                        >
                          {r.target || "—"}
                        </td>
                        <td className="px-2 py-1.5 text-[#7a8a6e]">{r.hash.slice(0, 10)}…</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </SectionReveal>
      </div>
    </div>
  );
}

// ─── Small local atoms (match the SCADA register-card look) ──────────────────

function Stat({
  label,
  value,
  tone = "dim",
  icon,
  mono = false,
}: {
  label: string;
  value: string;
  tone?: "lime" | "amber" | "dim";
  icon?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="rounded border border-[#6b8a40]/30 bg-black/30 p-3">
      <div className="flex items-center gap-1.5 vvu-label text-[8px] text-[#7a8a6e]">
        {icon}
        {label}
      </div>
      <p
        className={cn(
          "mt-1.5 truncate",
          mono ? "font-mono text-[11px]" : "vvu-label text-[11px] tracking-[0.12em]",
          tone === "lime"
            ? "text-[#c8ff00]"
            : tone === "amber"
              ? "text-[#f3e38a]"
              : "text-[#c9d4bd]",
        )}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function OpHead({ icon, label, hint }: { icon: React.ReactNode; label: string; hint: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="vvu-label text-[10px] text-[#f3e38a] tracking-[0.18em] flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span className="vvu-label text-[8px] text-[#7a8a6e] truncate">{hint}</span>
    </div>
  );
}
