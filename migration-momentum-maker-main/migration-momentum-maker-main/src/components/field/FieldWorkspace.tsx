"use client";

// src/components/field/FieldWorkspace.tsx — Task 37 · eleventh projection
// #/field — VVU FIELD ONBOARDING (FIELD MODE).
//
// The :3005 re-skin of the VERIFIED :3004 payment rail (Task 36, 20/20
// adversarial tests PASS): same pairing, auth, relay, receipts engine —
// copied, not rebuilt. QR = bootstrap only (one-time nonce, 300s window);
// the "SECRET: VVUACTIVATIONKEY" card label is a DISPLAY LABEL for field
// techs — the real auth underneath is nonce → device keypair binding →
// HMAC challenge/response, exactly like the payment rail.
//
// STATUS LOCK (on all docs, this screen included):
//   BRIDGE STATUS: PROTOTYPE — UNVERIFIED ON REAL ANDROID
//   Protocol tested ≠ mobile client tested ≠ live bridge tested.
// Goes LIVE only when a real phone scans this QR and the operator
// artifacts land (output/field_*).
//
// Plugin: obsidian-plugin/proofbridge-field-bridge/ in this repo.
//
// REBUILD NOTE (Task 38): rebuilt byte-equivalent after the platform
// sandbox rollback destroyed the Task 36/37 files; evidence regenerated.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fieldFeed } from "@/lib/bridge-feed";
import { CI_STATE } from "@/lib/vvu/ci-state-data";
import type {
  FieldStatus,
  PairInit,
  Receipt,
  SearchResult,
  VaultResult,
} from "@/components/bridge/bridge-types";
import { toast } from "sonner";
import {
  BookOpenText,
  Cable,
  Factory,
  FilePenLine,
  Fingerprint,
  GitBranch,
  ListChecks,
  Loader2,
  PackageCheck,
  QrCode,
  RefreshCw,
  ScanLine,
  Search,
  ShieldCheck,
  Sigma,
  Smartphone,
  TriangleAlert,
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
import type { CiStateFile } from "@/lib/vvu/ci-state";

// ─── Types (mirror of the vvu-field-onboard service contracts) ───────────────

// ─── Component ───────────────────────────────────────────────────────────────

export function FieldWorkspace() {
  const feedRef = useRef(fieldFeed);

  const [socketUp, setSocketUp] = useState(false);
  const [status, setStatus] = useState<FieldStatus | null>(null);
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

  const [writePath, setWritePath] = useState("ProofBridge/Evidence/field_onboard.md");
  const [writeBody, setWriteBody] = useState(
    "# VVU Field Onboard — evidence note\n\nWritten from the #/field projection through the :3005 rail — this note lands in the LIVE field store on the paired device.\n",
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

  // ── Android APK CI validation state (disk-canonical, changes by HAND — §5) ──
  const [ci, setCi] = useState<CiStateFile | null>(null);
  const [ciError, setCiError] = useState<string | null>(null);

  // ── feed wiring (in-app device rail; was socket.io :3005) ──
  useEffect(() => {
    setSocketUp(true); // the in-app feed is always linked
    const feed = feedRef.current;

    const onStatus = (s: FieldStatus) => {
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
        toast(`FIELD STORE ${e.type.toUpperCase()}: ${e.path.slice(0, 60)}`, {
          description: `live change on the device · ${p.deviceId}`,
        });
    };

    const off = feed.onEvent((e) => {
      if (e.kind === "status" && e.status) onStatus(e.status as FieldStatus);
      else if (e.kind === "receipt" && e.receipt) onReceipt(e.receipt);
      else if (e.kind === "result" && e.result) onResult(e.result);
      else if (e.kind === "events" && e.events) onEvents(e.events);
    });
    onStatus(feed.getStatus() as FieldStatus);

    return () => {
      off();
    };
  }, []);

  // ── initial status + receipts fetch (socket is one channel; HTTP is the other) ──
  const refreshStatus = useCallback(async () => {
    try {
      setStatus(fieldFeed.getStatus() as FieldStatus);
      setStatusError(null);
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : "field bridge unreachable");
    }
  }, []);

  const refreshReceipts = useCallback(async () => {
    try {
      setReceipts(fieldFeed.getReceipts(100));
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

  // CI state changes only when the operator updates the ledger JSON — 30s is plenty.
  const refreshCi = useCallback(async () => {
    try {
      setCi(CI_STATE);
      setCiError(null);
    } catch (e) {
      setCiError(e instanceof Error ? e.message : "ci state unreachable");
    }
  }, []);

  useEffect(() => {
    void refreshCi();
    const t = setInterval(() => void refreshCi(), 30_000);
    return () => clearInterval(t);
  }, [refreshCi]);

  // ── pairing ──
  const initPair = useCallback(async () => {
    setPairLoading(true);
    setPairError(null);
    try {
      const origin = window.location.origin; // the LIVE origin — never invented
      setPair(await fieldFeed.initPair(origin));
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
      // QR window is the field spec's 300s (payload expiry); the single-use
      // token behind it lives 10 min — countdown shows the QR scan window.
      const left = Math.max(
        0,
        Math.round((new Date(pair.qrExpiresAt ?? pair.expiresAt).getTime() - Date.now()) / 1000),
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
      fieldFeed.emitOp(op, args);
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
      const data = fieldFeed.verifyChain();
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

  // CI panel derived values — tone follows the machine state, never guessed.
  const ciStateLabel = ci?.state?.replaceAll("_", " ") ?? "STATE UNKNOWN";
  const ciTone: "lime" | "amber" | "crimson" = ci?.state.includes("VALIDATED")
    ? "lime"
    : ci?.state.includes("FAIL")
      ? "crimson"
      : "amber";

  return (
    <div className="absolute inset-0 overflow-y-auto vvu-grid-bg">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 pb-28 pt-6 space-y-5">
        {/* ── headline ── */}
        <SectionReveal featured>
          <div className="vvu-panel-solid p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="vvu-label text-[10px] text-[#c8ff00] border border-[#c8ff00]/40 px-2 py-0.5">
                    TASK 37 · ELEVENTH PROJECTION · FIELD MODE
                  </span>
                  {status?.agentOnline ? (
                    <Chip tone="lime">
                      <LiveDot /> FIELD AGENT ONLINE
                    </Chip>
                  ) : (
                    <Chip tone="amber" dashed>
                      <WifiOff className="size-3" /> AGENT OFFLINE
                    </Chip>
                  )}
                </div>
                <h1 className="vvu-label text-xl sm:text-2xl font-bold text-[#f3e38a] tracking-[0.18em] mt-2">
                  VVU FIELD ONBOARDING
                </h1>
                <p className="vvu-label text-[9px] sm:text-[10px] text-[#7a8a6e] mt-1 max-w-2xl leading-relaxed">
                  REUSING THE VERIFIED :3004 PAYMENT-RAIL ENGINE ON :3005 · QR-PAIR THE FIELD
                  DEVICE, THEN SEARCH / READ / WRITE THE LIVE STORE — EVERY OPERATION RECEIPTED
                  (SHA-256 CHAIN)
                </p>
                {/* the status lock — on all docs, this screen included */}
                <p className="vvu-label text-[8px] sm:text-[9px] text-[#f3a26b] mt-2 flex items-center gap-1.5">
                  <TriangleAlert className="size-3 shrink-0" />
                  BRIDGE STATUS: PROTOTYPE — UNVERIFIED ON REAL ANDROID · PROTOCOL TESTED ≠ MOBILE
                  CLIENT TESTED ≠ LIVE BRIDGE TESTED
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <Chip tone={socketUp ? "lime" : "dim"}>
                  <LiveDot dim={!socketUp} /> VIEWER {socketUp ? "LINKED" : "DOWN"}
                </Chip>
                <Chip tone="dim">
                  <Cable className="size-3" /> IN-APP DEVICE FEED
                </Chip>
                <Chip tone="dim">
                  <Factory className="size-3" /> {status?.node ?? "FIELD-09"} ·{" "}
                  {status?.protocol ?? "VVU-FIELD-ONBOARD-2026"}
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

        {/* ── §1 QR activation (field poster) ── */}
        <SectionReveal>
          <section className="vvu-panel p-4 sm:p-6" aria-labelledby="field-pair-h">
            <SectionHeader
              num="1"
              title="QR ACTIVATION — THE ONLY SETUP ACTION"
              kicker="scan with the phone camera → Obsidian opens → field device pairs → live"
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
            <div id="field-pair-h" className="grid md:grid-cols-[auto_1fr] gap-5 items-start">
              <div className="mx-auto md:mx-0">
                {pair ? (
                  <div className="relative">
                    <img
                      src={pair.qrDataUrl}
                      alt="VVU field onboarding QR — obsidian://vvu-onboard URI carrying {endpoint, nonce, expiry, node, protocol}"
                      className="w-44 h-44 sm:w-52 sm:h-52 rounded border-2 border-[#6b8a40]/50 bg-[#c8ff00]"
                    />
                    <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 vvu-label text-[9px] px-2 py-0.5 rounded bg-[#060806] border border-[#6b8a40]/60 text-[#c8ff00] tabular-nums whitespace-nowrap">
                      {pairExpiresIn > 0
                        ? `EXPIRES ${Math.floor(pairExpiresIn / 60)}:${String(pairExpiresIn % 60).padStart(2, "0")}`
                        : "EXPIRED — RE-MINT"}
                    </span>
                    {/* field-poster display label (for field techs) — the real
                        secret underneath is the one-time nonce + keypair */}
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 vvu-label text-[8px] px-2 py-0.5 rounded bg-[#c8ff00] text-black border border-black whitespace-nowrap">
                      SECRET: VVUACTIVATIONKEY
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
                      obsidian-plugin/proofbridge-field-bridge/
                    </code>{" "}
                    into the vault&apos;s <code className="text-[#f3e38a]">.obsidian/plugins/</code>{" "}
                    and enable it (Community plugins).
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#c8ff00]">02</span> Scan this QR with the phone CAMERA —
                    it opens Obsidian via{" "}
                    <code className="text-[#f3e38a]">obsidian://vvu-onboard</code> carrying a
                    ONE-TIME nonce (300s window, single-use, dead after pairing).
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#c8ff00]">03</span> The plugin binds a device keypair
                    (Ed25519 where supported) + receives the HMAC credential, then connects +
                    authenticates automatically whenever Obsidian is open.
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#c8ff00]">04</span> Status above flips FIELD AGENT ONLINE
                    — search, read, write the live store; every op returns a hash-chained receipt.
                  </li>
                </ol>
                {pair && (
                  <div className="pt-1">
                    <p className="vvu-label text-[8px] text-[#7a8a6e] mb-1">
                      QR PAYLOAD (what the QR encodes — bootstrap only, NOT the secret; endpoint is
                      this live origin):
                    </p>
                    <p className="text-[9px] font-mono text-[#c9d4bd] break-all leading-relaxed bg-black/40 border border-[#6b8a40]/30 rounded p-2">
                      {JSON.stringify(pair.qrJson)}
                    </p>
                  </div>
                )}
                <p className="vvu-label text-[8px] text-[#7a8a6e]">
                  QR IS BOOTSTRAP, NOT SECRET: one-time nonce → device keypair → challenge/response
                  → paired credential. &ldquo;SECRET: VVUACTIVATIONKEY&rdquo; is a display label for
                  field techs — the real auth is the nonce + keypair underneath (same as the payment
                  rail). Pilot-grade HMAC over gateway TLS — NOT hardware Ed25519 (Mk-node lineage).
                </p>
              </div>
            </div>
          </section>
        </SectionReveal>

        {/* ── §2 field node + agent link ── */}
        <SectionReveal>
          <section className="vvu-panel p-4 sm:p-6" aria-labelledby="field-agent-h">
            <SectionHeader
              num="2"
              title="FIELD NODE + AGENT LINK"
              kicker="node FIELD-09 · the phone-side Obsidian plugin"
            />
            <div id="field-agent-h" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat
                label="FIELD AGENT"
                value={status?.agentOnline ? "ONLINE" : "OFFLINE"}
                tone={status?.agentOnline ? "lime" : "amber"}
                icon={<Smartphone className="size-3.5" />}
              />
              <Stat
                label="NODE"
                value={status?.node ?? "FIELD-09"}
                icon={<Factory className="size-3.5" />}
                mono
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
            </div>
            {status?.agent && (
              <p className="vvu-label text-[9px] text-[#7a8a6e] mt-3">
                DEVICE ID <span className="text-[#c9d4bd] font-mono">{status.agent.deviceId}</span>{" "}
                · PROTOCOL {status.protocol} · SESSION HOLDS WHILE OBSIDIAN IS OPEN · VIEWERS:{" "}
                {status.viewerCount}
              </p>
            )}
          </section>
        </SectionReveal>

        {/* ── §3 live field ops ── */}
        <SectionReveal>
          <section className="vvu-panel p-4 sm:p-6" aria-labelledby="field-ops-h">
            <SectionHeader
              num="3"
              title="LIVE FIELD OPS"
              kicker={
                status?.agentOnline
                  ? "relayed to the paired device — results below + receipts in §4"
                  : "waiting for the field agent (pair the phone)"
              }
              right={
                <Chip tone={status?.agentOnline ? "lime" : "dim"}>
                  <LiveDot dim={!status?.agentOnline} />{" "}
                  {status?.agentOnline ? "RELAY LIVE" : "NO AGENT"}
                </Chip>
              }
            />
            <div id="field-ops-h" className="grid lg:grid-cols-3 gap-4">
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
                    placeholder="search the live field store…"
                    className="h-9 text-xs font-mono bg-black/40"
                    aria-label="Field store search query"
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
                  hint="store-relative path"
                />
                <div className="flex gap-2">
                  <Input
                    value={readPath}
                    onChange={(e) => setReadPath(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && doRead()}
                    placeholder="ProofBridge/…"
                    className="h-9 text-xs font-mono bg-black/40"
                    aria-label="Field store path to read"
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
                  hint="creates / overwrites on the device"
                />
                <Input
                  value={writePath}
                  onChange={(e) => setWritePath(e.target.value)}
                  placeholder="ProofBridge/Evidence/field_onboard.md"
                  className="h-9 text-xs font-mono bg-black/40"
                  aria-label="Field store path to write"
                />
                <Textarea
                  value={writeBody}
                  onChange={(e) => setWriteBody(e.target.value)}
                  className="min-h-[92px] max-h-40 text-[10px] font-mono bg-black/40 resize-y"
                  aria-label="Content to write into the field store"
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={doWrite} disabled={writeOut.busy || !writePath.trim()}>
                    {writeOut.busy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <FilePenLine className="size-3.5" />
                    )}{" "}
                    SAVE TO LIVE FIELD STORE
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
          <section className="vvu-panel p-4 sm:p-6" aria-labelledby="field-rec-h">
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
              id="field-rec-h"
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

        {/* ── §5 Android APK CI — GitHub build validation ── */}
        <SectionReveal>
          <section className="vvu-panel p-4 sm:p-6" aria-labelledby="field-ci-h">
            <SectionHeader
              num="5"
              title="ANDROID APK CI — GITHUB BUILD VALIDATION"
              kicker="the .apk leg of the .exe/.apk deliverable · repo proofbridge-vvu (private) · state changes by hand, panel follows the disk"
              right={
                <Chip tone={ciTone}>
                  <LiveDot dim={ciTone !== "lime"} /> {ciStateLabel}
                </Chip>
              }
            />
            <div id="field-ci-h" className="space-y-4">
              {ciError && (
                <p className="vvu-label text-[9px] text-red-400 leading-relaxed">
                  CI STATE UNREADABLE — {ciError} (disk-canonical twin:
                  vvu-trust/build/ci/android-apk-ci.json)
                </p>
              )}

              {/* facts row — all from the state file, nothing invented */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat
                  label="REVISION"
                  value={ci ? ci.workflow.revision.slice(0, 7) : "—"}
                  icon={<GitBranch className="size-3.5" />}
                  mono
                />
                <Stat
                  label="TRIGGER"
                  value="DISPATCH ONLY"
                  tone="amber"
                  icon={<Smartphone className="size-3.5" />}
                />
                <Stat
                  label="RUNNER PIN"
                  value={ci ? ci?.workflow?.runner_pin?.split(" ")[0] : "—"}
                  icon={<Factory className="size-3.5" />}
                  mono
                />
                <Stat
                  label="ARTIFACT"
                  value={
                    ci ? ci?.workflow?.artifact?.split(" ")[0].split("-").slice(1).join("-") : "—"
                  }
                  icon={<PackageCheck className="size-3.5" />}
                  mono
                />
              </div>

              {/* the acceptance condition — the decisive line of the whole validation */}
              <div className="rounded border border-[#f3e38a]/40 bg-[#f3e38a]/5 p-3">
                <p className="vvu-label text-[9px] text-[#f3e38a] tracking-[0.18em] flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 shrink-0" /> ACCEPTANCE CONDITION — EXACT
                </p>
                <p className="vvu-label text-[9px] sm:text-[10px] text-[#c9d4bd] mt-1.5 leading-relaxed">
                  {ci?.acceptance.condition ?? "—"}
                </p>
                <p className="font-mono text-[10px] text-[#c8ff00] break-all mt-1.5 select-all">
                  {ci?.workflow.revision ?? "—"}
                </p>
                <p className="vvu-label text-[8px] text-[#7a8a6e] mt-1.5 leading-relaxed">
                  {ci?.acceptance.consequence ?? "—"}
                </p>
              </div>

              <div className="lg:grid lg:grid-cols-2 gap-4">
                {/* the five audited gates */}
                <div className="rounded border border-[#6b8a40]/30 bg-black/30">
                  <p className="vvu-label text-[9px] text-[#f3e38a] tracking-[0.18em] px-3 pt-2.5 pb-1.5 flex items-center gap-1.5 border-b border-[#6b8a40]/20">
                    <ListChecks className="size-3.5 shrink-0" /> FIVE GATES — AUDITED ORDER
                    (FAIL-CLOSED)
                  </p>
                  <ul className="max-h-56 overflow-y-auto divide-y divide-[#6b8a40]/15">
                    {(ci?.workflow.gates ?? []).length === 0 ? (
                      <li className="vvu-label text-[9px] text-[#7a8a6e] px-3 py-2.5">
                        NO GATES LOADED — STATE FILE UNREADABLE
                      </li>
                    ) : (
                      ci!.workflow.gates.map((g) => (
                        <li key={g.id} className="px-3 py-2">
                          <p className="flex items-center gap-2">
                            <span className="vvu-label text-[8px] text-[#6b8a40] border border-[#6b8a40]/40 px-1.5 py-0.5 shrink-0">
                              {g.id}
                            </span>
                            <span className="vvu-label text-[9px] text-[#f3e38a] tracking-[0.12em]">
                              {g.name}
                            </span>
                          </p>
                          <p className="text-[9px] font-mono text-[#7a8a6e] mt-1 leading-relaxed">
                            {g.order} — {g.effect}
                          </p>
                        </li>
                      ))
                    )}
                  </ul>
                </div>

                <div className="space-y-4">
                  {/* run classification — stale-revision failures stay classified */}
                  <div className="rounded border border-[#6b8a40]/30 bg-black/30">
                    <p className="vvu-label text-[9px] text-[#f3e38a] tracking-[0.18em] px-3 pt-2.5 pb-1.5 border-b border-[#6b8a40]/20">
                      RUN CLASSIFICATION
                    </p>
                    <div className="max-h-48 overflow-y-auto divide-y divide-[#6b8a40]/15">
                      {(ci?.runs ?? []).length === 0 ? (
                        <p className="vvu-label text-[9px] text-[#7a8a6e] px-3 py-2.5">
                          NO RUNS RECORDED
                        </p>
                      ) : (
                        ci!.runs.map((r) => (
                          <div key={r.run_head} className="px-3 py-2">
                            <p className="flex items-center gap-2 flex-wrap">
                              <span
                                className="font-mono text-[10px] text-[#c9d4bd]"
                                title={r.run_head}
                              >
                                {r.run_head.slice(0, 7)}
                              </span>
                              <Chip tone="crimson" className="!text-[8px]">
                                {r.classification.replaceAll("_", " ")}
                              </Chip>
                            </p>
                            <p className="text-[9px] font-mono text-[#c9d4bd] opacity-80 mt-1 leading-relaxed">
                              {r.reason}
                            </p>
                            <p className="vvu-label text-[8px] text-[#7a8a6e] mt-1 leading-relaxed">
                              {r.verdict}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* parked cleanup — never mixed into the validation run */}
                  <div className="rounded border border-[#f3a26b]/30 bg-[#f3a26b]/5 p-3">
                    <p className="vvu-label text-[9px] text-[#f3a26b] tracking-[0.14em] flex items-center gap-1.5">
                      <TriangleAlert className="size-3.5 shrink-0" /> PARKED CLEANUP — NOT IN THE
                      VALIDATION RUN
                    </p>
                    {(ci?.parked_cleanups ?? []).map((c) => (
                      <div key={c.id} className="mt-2">
                        <p className="font-mono text-[10px] text-[#c9d4bd] break-all leading-relaxed">
                          {c.change}
                        </p>
                        <p className="text-[9px] font-mono text-[#7a8a6e] break-all mt-1">
                          {c.patch}
                        </p>
                        <p className="vvu-label text-[8px] text-[#f3a26b] mt-1 leading-relaxed">
                          {c.status}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* dispatch procedure — the manual step this sandbox cannot do */}
              <div>
                <p className="vvu-label text-[9px] text-[#f3e38a] tracking-[0.18em] mb-1.5">
                  DISPATCH PROCEDURE — OPERATOR, MINUTES
                </p>
                <ol className="vvu-label text-[9px] sm:text-[10px] text-[#c9d4bd] space-y-1.5 leading-relaxed list-none">
                  {(ci?.dispatch_procedure ?? ["—"]).map((step, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-[#c8ff00] shrink-0">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* packager — the XAPK wrapper that runs on the CI artifact once it lands */}
              {ci?.packager && (
                <div className="rounded border border-[#6b8a40]/40 bg-[#6b8a40]/5 p-3">
                  <p className="vvu-label text-[9px] text-[#9db36f] tracking-[0.18em] flex items-center gap-1.5">
                    <PackageCheck className="size-3.5 shrink-0" /> PACKAGE WRAPPER — XAPK PACKAGER
                    (READY)
                  </p>
                  <p className="font-mono text-[10px] text-[#f3e38a] break-all mt-1.5">
                    {ci.packager.path}
                  </p>
                  <p className="text-[9px] font-mono text-[#c9d4bd] leading-relaxed mt-1">
                    {ci.packager.status}
                  </p>
                  <p className="text-[9px] font-mono text-[#7a8a6e] break-all mt-1.5 leading-relaxed">
                    {ci.packager.usage}
                  </p>
                  <p className="vvu-label text-[8px] text-[#7a8a6e] mt-1.5 leading-relaxed">
                    {ci.packager.note}
                  </p>
                  <p className="text-[9px] font-mono text-[#7a8a6e] break-all mt-1">
                    EVIDENCE: {ci.packager.evidence} · DOC: {ci.packager.doc}
                  </p>
                </div>
              )}

              <p className="vvu-label text-[8px] text-[#7a8a6e] leading-relaxed">
                GITHUB ACCESS FROM THIS SANDBOX: {ci?.github_access_from_sandbox ?? "—"} · LEDGER:
                vvu-trust/build/ci/ANDROID_APK_VALIDATION.md · MIRROR SHA-256{" "}
                {ci?.workflow.mirror_sha256?.slice(0, 16) ?? "—"}…
              </p>
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
