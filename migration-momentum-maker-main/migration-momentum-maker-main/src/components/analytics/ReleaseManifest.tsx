"use client";

// src/components/analytics/ReleaseManifest.tsx — Design Freeze Level 1 artifact.
// The 19 master assets of the release manifest, each bound to the WORM ledger
// by a SHA-256 over `${RELEASE_TAG}|${filename}|${role}`. This panel RECOMPUTES
// every hash in the browser (WebCrypto) and diffs it against the hash slice
// registered on the chain — "verification happening in real-time", analyst side.
// If WebCrypto is unavailable (non-secure context) it degrades to ledger-only.
// Task 9-a: every row is an inspectable asset — click / Enter / Space opens a
// drill-down dialog with the full 64-char recomputed digest, the WORM evidence
// (chain seq + registration ts threaded from the ledger feed), the binding
// formula and a copy-to-clipboard action.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck, ShieldAlert, RefreshCw, FileLock2, Copy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { RELEASE_MANIFEST, RELEASE_TAG } from "@/lib/vvu-data";
import type { LedgerEntry } from "@/types/vvu";
import {
  Chip,
  LiveDot,
  QueryErrorCard,
  SectionHeader,
  fmtStamp,
  useLedgerQuery,
  type LedgerResponse,
} from "./shared";

const MANTRA = "NO EDITS WITHOUT RE-HASH · MOI SUPREMACY · WORM · HASH IS PROOF";

interface ManifestRow {
  filename: string;
  role: string;
  /** 16-char hash slice parsed from the WORM ledger entry details (or null) */
  ledgerSlice: string | null;
  /** WORM evidence threaded from the ledger feed (Task 9-a drill-down): the
   * RELEASE_HASH_REGISTERED event name + its chain position + timestamp. */
  event: string;
  seq: number;
  createdAt: string;
}

/** Parse "filename · role · <16hex>… · TAG" details from a MANIFEST ledger event,
 *  retaining the event seq/createdAt as WORM evidence for the asset drill-down. */
function parseManifestRow(e: LedgerEntry): ManifestRow | null {
  if (!e.details) return null;
  const hashMatch = e.details.match(/([0-9a-f]{16})…/);
  const parts = e.details.split(" · ");
  if (parts.length < 2) return null;
  return {
    filename: parts[0],
    role: parts[1],
    ledgerSlice: hashMatch ? hashMatch[1] : null,
    event: e.event,
    seq: e.seq,
    createdAt: e.createdAt,
  };
}

/** Browser-side SHA-256 hex of the manifest binding (mirrors server manifestHash). */
async function recomputeHash(filename: string, role: string): Promise<string | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  const data = new TextEncoder().encode(`${RELEASE_TAG}|${filename}|${role}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Manifest-scoped feed: the 19 RELEASE_HASH_REGISTERED events (any chain depth). */
function useManifestQuery() {
  return useQuery<LedgerResponse, Error>({
    queryKey: ["vvu-manifest"],
    queryFn: async () => {
      const res = await fetch("/api/vvu/ledger?source=MANIFEST&limit=50", { cache: "no-store" });
      if (!res.ok) throw new Error(`MANIFEST FEED HTTP ${res.status}`);
      return (await res.json()) as LedgerResponse;
    },
    refetchInterval: 30000,
    staleTime: 15000,
  });
}

export function ReleaseManifest({ num }: { num?: string }) {
  const ledger = useManifestQuery();
  const chain = useLedgerQuery();
  const [recomputed, setRecomputed] = useState<Record<string, string | null> | null>(null);
  const [computing, setComputing] = useState(false);
  // Task 9-a: drill-down dialog state — assetIdx stays a valid index while the
  // Radix exit animation plays (open=false, content unmounts after the fade).
  const [assetIdx, setAssetIdx] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);

  const openAsset = useCallback((i: number) => {
    setAssetIdx(i);
    setDialogOpen(true);
  }, []);

  // Ledger rows keyed by filename (MANIFEST events carry the stored hash slice).
  const ledgerRows = useMemo(() => {
    const map = new Map<string, ManifestRow>();
    for (const e of ledger.data?.entries ?? []) {
      if (e.source !== "MANIFEST") continue;
      const row = parseManifestRow(e);
      if (row) map.set(row.filename, row);
    }
    return map;
  }, [ledger.data]);

  // Manual re-verify (button): recomputes every manifest hash in the browser.
  const runRecompute = useCallback(async () => {
    setComputing(true);
    try {
      const out: Record<string, string | null> = {};
      for (const m of RELEASE_MANIFEST) {
        out[m.filename] = await recomputeHash(m.filename, m.role);
      }
      setRecomputed(out);
    } finally {
      setComputing(false);
    }
  }, []);

  // Initial compute — all setState happens after the first await (async task,
  // not synchronous effect body). Cancelled on unmount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const out: Record<string, string | null> = {};
      for (const m of RELEASE_MANIFEST) {
        out[m.filename] = await recomputeHash(m.filename, m.role);
      }
      if (!cancelled) setRecomputed((prev) => prev ?? out);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Verification: ledger slice present AND (recomputed missing OR first-16 match).
  const verifiedCount = useMemo(() => {
    let n = 0;
    for (const m of RELEASE_MANIFEST) {
      const row = ledgerRows.get(m.filename);
      if (!row?.ledgerSlice) continue;
      const rec = recomputed?.[m.filename];
      if (rec === undefined || rec === null || rec.slice(0, 16) === row.ledgerSlice) n++;
    }
    return n;
  }, [ledgerRows, recomputed]);

  const total = RELEASE_MANIFEST.length;
  const allVerified = verifiedCount === total;
  const webCryptoLive = recomputed !== null && Object.values(recomputed).some((v) => v !== null);

  // Task 9-a — derived state for the asset drill-down dialog (live: updates in
  // place when the WebCrypto recompute batch lands or the ledger feed refetches).
  const asset = RELEASE_MANIFEST[assetIdx];
  const assetRow = ledgerRows.get(asset.filename);
  const assetSlice = assetRow?.ledgerSlice ?? null;
  const assetRec = recomputed?.[asset.filename];
  const assetHash = typeof assetRec === "string" ? assetRec : null;
  const assetRecomputing = assetRec === undefined; // batch not finished yet
  const assetRecSlice = assetHash ? assetHash.slice(0, 16) : null;
  const assetMatch =
    assetSlice !== null && (assetRecSlice === null || assetRecSlice === assetSlice);
  const assetMissing = assetSlice === null;

  // Task 9-a: COPY HASH — full 64-char digest to the clipboard (BbbeePanel
  // copyScript pattern: success toast + graceful clipboard-unavailable fallback).
  const copyHash = useCallback(async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash);
      toast.success("SHA-256 copied", { description: "Full 64-char digest ready to paste" });
    } catch {
      toast.error("CLIPBOARD UNAVAILABLE", {
        description: "Select the hash text and copy manually",
      });
    }
  }, []);

  if (ledger.isError) {
    return (
      <section className="vvu-panel-solid p-4" aria-label="release manifest">
        <SectionHeader num={num} title="RELEASE MANIFEST" kicker="19 MASTER ASSETS" />
        <QueryErrorCard label="MANIFEST FEED" onRetry={() => void ledger.refetch()} />
      </section>
    );
  }

  return (
    <section className="vvu-panel vvu-enter p-4 sm:p-5" aria-label="release manifest">
      <SectionHeader
        num={num}
        title="RELEASE MANIFEST"
        kicker="19 MASTER ASSETS · APPENDIX E.3 / §20"
        right={
          <>
            <Chip tone={allVerified ? "lime" : ledger.isLoading ? "dim" : "amber"}>
              <LiveDot color={allVerified ? "#c8ff00" : "#e0a030"} dim={ledger.isLoading} />
              {ledger.isLoading ? "READING CHAIN…" : `${verifiedCount}/${total} VERIFIED`}
            </Chip>
            <Chip tone="ochre" dashed>
              {RELEASE_TAG}
            </Chip>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void runRecompute();
                void ledger.refetch();
                void chain.refetch();
              }}
              disabled={computing}
              className="vvu6c-btn min-h-[44px] vvu-label text-[10px] font-bold border-[rgba(107,138,64,0.45)] text-[#8fb35a] hover:bg-[#8fb35a]/10 hover:text-[#c9d4bd] hover:border-[#8fb35a]"
              aria-label="re-verify manifest hashes"
            >
              <RefreshCw className={cn("size-3.5", computing && "animate-spin")} aria-hidden />
              RE-VERIFY
            </Button>
          </>
        }
      />

      {/* freeze mantra strip */}
      <div
        className="mb-3 px-3 py-2 rounded border flex items-center gap-2 flex-wrap"
        style={{ borderColor: "rgba(224,160,48,0.35)", background: "rgba(224,160,48,0.06)" }}
        role="note"
      >
        <FileLock2 className="size-3.5 text-[#e0a030] shrink-0" aria-hidden />
        <span className="vvu-label text-[9px] sm:text-[10px] font-bold text-[#e0a030] tracking-[0.16em]">
          {MANTRA}
        </span>
      </div>

      {/* manifest table */}
      <div className="max-h-96 overflow-y-auto overflow-x-auto rounded border border-[rgba(107,138,64,0.2)]">
        <table className="w-full text-left border-collapse min-w-[560px]">
          <caption className="sr-only">
            Release manifest — 19 master assets with WORM-bound SHA-256 hashes · select a row for
            full asset detail
          </caption>
          <thead className="sticky top-0 z-10 bg-[#0b0f0a]">
            <tr className="vvu-label text-[8px] text-[#7a8a6e]">
              <th scope="col" className="px-2 py-2 border-b border-[rgba(107,138,64,0.25)] w-8">
                #
              </th>
              <th scope="col" className="px-2 py-2 border-b border-[rgba(107,138,64,0.25)]">
                FILENAME
              </th>
              <th
                scope="col"
                className="px-2 py-2 border-b border-[rgba(107,138,64,0.25)] hidden sm:table-cell"
              >
                ROLE
              </th>
              <th scope="col" className="px-2 py-2 border-b border-[rgba(107,138,64,0.25)]">
                SHA-256 · LEDGER
              </th>
              <th
                scope="col"
                className="px-2 py-2 border-b border-[rgba(107,138,64,0.25)] hidden md:table-cell"
              >
                SHA-256 · RECOMPUTED
              </th>
              <th
                scope="col"
                className="px-2 py-2 border-b border-[rgba(107,138,64,0.25)] w-10"
                aria-label="verification status"
              />
            </tr>
          </thead>
          <tbody>
            {RELEASE_MANIFEST.map((m, i) => {
              const row = ledgerRows.get(m.filename);
              const ledgerSlice = row?.ledgerSlice ?? null;
              const rec = recomputed?.[m.filename];
              const recSlice = rec ? rec.slice(0, 16) : null;
              const match = ledgerSlice !== null && (recSlice === null || recSlice === ledgerSlice);
              const missing = ledgerSlice === null;
              return (
                <tr
                  key={m.filename}
                  tabIndex={0}
                  role="button"
                  aria-label={`inspect manifest asset ${m.filename}`}
                  onClick={() => openAsset(i)}
                  onKeyDown={(e) => {
                    // Enter / Space open the drill-down (role=button contract).
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openAsset(i);
                    }
                  }}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-[rgba(107,138,64,0.09)] focus-visible:bg-[rgba(107,138,64,0.14)] focus-visible:outline-none",
                    i % 2 === 1 && "bg-[rgba(107,138,64,0.05)]",
                  )}
                >
                  <td className="px-2 py-1.5 border-b border-[rgba(107,138,64,0.12)] vvu-label text-[8px] text-[#7a8a6e] tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </td>
                  <td
                    className="px-2 py-1.5 border-b border-[rgba(107,138,64,0.12)] text-[10px] text-[#c9d4bd] font-medium whitespace-nowrap"
                    title={m.role}
                  >
                    {m.filename}
                  </td>
                  <td className="px-2 py-1.5 border-b border-[rgba(107,138,64,0.12)] hidden sm:table-cell text-[10px] text-[#7a8a6e]">
                    {m.role}
                  </td>
                  <td className="px-2 py-1.5 border-b border-[rgba(107,138,64,0.12)] text-[10px] text-[#8fb35a] font-mono tabular-nums whitespace-nowrap">
                    {ledgerSlice ? `${ledgerSlice}…` : <span className="text-[#7a8a6e]">—</span>}
                  </td>
                  <td className="px-2 py-1.5 border-b border-[rgba(107,138,64,0.12)] hidden md:table-cell text-[10px] font-mono tabular-nums whitespace-nowrap">
                    {recSlice === null ? (
                      <span className="text-[#7a8a6e]">{recomputed === null ? "…" : "N/A*"}</span>
                    ) : (
                      <span className={match ? "text-[#c9d4bd]" : "text-[#e5484d] font-bold"}>
                        {recSlice}…
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 border-b border-[rgba(107,138,64,0.12)] text-center">
                    {missing ? (
                      <span className="text-[#7a8a6e] text-[10px]" title="not on chain (yet)">
                        ·
                      </span>
                    ) : match ? (
                      <ShieldCheck
                        className="size-3.5 text-[#c8ff00] inline"
                        aria-label="hash verified"
                      />
                    ) : (
                      <ShieldAlert
                        className="size-3.5 text-[#e5484d] inline"
                        aria-label="hash mismatch"
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mt-2">
        <span className="vvu-label text-[8px] text-[#7a8a6e]">
          RUN: bash vvu-hash-verifier-v3-20260901.sh · CHAIN EVENTS: {chain.data?.count ?? "—"} ·{" "}
          {chain.data?.chainValid ? "CHAIN VALID" : "CHAIN BROKEN"}
        </span>
        <span className="vvu-label text-[8px] text-[#7a8a6e]">
          {webCryptoLive
            ? "RECOMPUTED IN-BROWSER VIA WEBCRYPTO SHA-256"
            : "*WEBCRYPTO UNAVAILABLE IN NON-SECURE CONTEXT — LEDGER SLICES ONLY"}
        </span>
      </div>

      {/* ── Task 9-a: per-asset drill-down dialog (row click / Enter / Space) ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          showCloseButton={false}
          aria-label={`manifest asset detail ${asset.filename}`}
          className="vvu-panel-solid flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 shadow-[0_24px_80px_rgba(0,0,0,0.6)] sm:max-w-[480px]"
          style={{ borderColor: "rgba(107,138,64,0.35)" }}
        >
          {/* header — filename + node-style asset tag */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[rgba(107,138,64,0.25)] shrink-0">
            <div className="min-w-0">
              <DialogTitle className="font-mono text-left text-[11px] font-bold leading-tight break-all text-[#d7e2c9]">
                {asset.filename}
              </DialogTitle>
              <DialogDescription className="font-mono text-left mt-1.5 text-[9px] leading-none tracking-[0.18em] text-[#8fb35a]">
                MANIFEST ASSET {String(assetIdx + 1).padStart(2, "0")}/{total}
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              aria-label="close manifest asset detail"
              title="Close (Escape)"
              className="shrink-0 flex items-center justify-center min-h-[44px] min-w-[44px] -my-1.5 -mr-2 rounded-sm text-[#7a8a6e] hover:text-[#e5484d] transition-colors"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          {/* verification status strip */}
          <div className="px-4 py-2 border-b border-[rgba(107,138,64,0.18)] shrink-0">
            {assetMissing ? (
              <Chip tone="dim" dashed>
                NOT ON CHAIN
              </Chip>
            ) : assetMatch ? (
              <Chip tone="lime">
                <LiveDot color="#c8ff00" />
                MATCH · WORM-BOUND
              </Chip>
            ) : (
              <Chip tone="crimson">
                <ShieldAlert className="size-3" aria-hidden />
                HASH MISMATCH
              </Chip>
            )}
          </div>

          {/* sections (internal scroll on short viewports) */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {/* recomputed SHA-256 — full digest */}
            <section
              className="px-4 py-3 border-b border-[rgba(107,138,64,0.18)]"
              aria-label="recomputed sha-256"
            >
              <h3 className="vvu-label text-[8px] font-bold tracking-[0.22em] text-[#7a8a6e] mb-2">
                RECOMPUTED SHA-256 · WEBCRYPTO
              </h3>
              {assetHash ? (
                <p className="font-mono text-[10px] leading-relaxed break-all text-[#c9d4bd]">
                  {assetHash}
                </p>
              ) : assetRecomputing ? (
                <p className="font-mono text-[10px] flex items-center gap-2 text-[#8fb35a]">
                  <LiveDot color="#8fb35a" />
                  RECOMPUTING…
                </p>
              ) : (
                <p className="text-[10px] leading-relaxed text-[#7a8a6e]">
                  N/A — WEBCRYPTO UNAVAILABLE (NON-SECURE CONTEXT) · LEDGER-ONLY MODE
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (assetHash) void copyHash(assetHash);
                }}
                disabled={!assetHash}
                aria-label="copy full sha-256 hash"
                title={assetHash ? "Copy the full 64-char digest" : "Hash not available yet"}
                className="mt-2 vvu6c-btn min-h-[44px] vvu-label text-[10px] font-bold border-[rgba(107,138,64,0.45)] text-[#8fb35a] hover:bg-[#8fb35a]/10 hover:text-[#c9d4bd] hover:border-[#8fb35a]"
              >
                <Copy className="size-3.5" aria-hidden />
                COPY HASH
              </Button>
            </section>

            {/* WORM ledger evidence — slice + event seq + ts */}
            <section
              className="px-4 py-3 border-b border-[rgba(107,138,64,0.18)]"
              aria-label="worm ledger evidence"
            >
              <h3 className="vvu-label text-[8px] font-bold tracking-[0.22em] text-[#7a8a6e] mb-2">
                WORM LEDGER EVIDENCE
              </h3>
              {assetRow ? (
                <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-1.5 items-baseline">
                  <dt className="vvu-label text-[8px] text-[#7a8a6e]">LEDGER SLICE</dt>
                  <dd className="font-mono text-[10px] break-all text-[#8fb35a]">
                    {assetSlice ?? "—"}
                    <span className="text-[#7a8a6e]">… (16/64 CHARS ON CHAIN)</span>
                  </dd>
                  <dt className="vvu-label text-[8px] text-[#7a8a6e]">EVENT</dt>
                  <dd className="font-mono text-[10px] break-all text-[#c9d4bd]">
                    {assetRow.event} · SEQ #{assetRow.seq}
                  </dd>
                  <dt className="vvu-label text-[8px] text-[#7a8a6e]">REGISTERED</dt>
                  <dd className="font-mono text-[10px] tabular-nums text-[#c9d4bd]">
                    {fmtStamp(assetRow.createdAt)}
                  </dd>
                </dl>
              ) : (
                <p className="text-[10px] leading-relaxed text-[#7a8a6e]">
                  NO RELEASE_HASH_REGISTERED EVENT IN LOADED LEDGER — ASSET NOT CHAIN-BOUND (YET)
                </p>
              )}
            </section>

            {/* role + binding formula */}
            <section className="px-4 py-3" aria-label="role and binding formula">
              <h3 className="vvu-label text-[8px] font-bold tracking-[0.22em] text-[#7a8a6e] mb-2">
                ROLE
              </h3>
              <p className="text-[10px] text-[#c9d4bd] mb-3">{asset.role}</p>
              <h3 className="vvu-label text-[8px] font-bold tracking-[0.22em] text-[#7a8a6e] mb-2">
                BINDING FORMULA · SHA-256 INPUT
              </h3>
              <code className="block font-mono text-[10px] leading-relaxed break-all px-2 py-1.5 rounded border border-[rgba(107,138,64,0.35)] bg-[rgba(6,8,6,0.55)] text-[#8fb35a]">
                {RELEASE_TAG}
                <span className="text-[#7a8a6e]">|</span>
                {asset.filename}
                <span className="text-[#7a8a6e]">|</span>
                {asset.role}
              </code>
            </section>
          </div>

          {/* footer strip */}
          <div className="shrink-0 border-t border-[rgba(107,138,64,0.25)] px-4 py-2 flex items-center justify-between gap-2 vvu-label text-[7px] text-[#7a8a6e]">
            <span className="min-w-0 truncate">{RELEASE_TAG} · APPEND-ONLY</span>
            <span className="shrink-0 flex items-center gap-1.5">
              <span className="vvu-kbd">ESC</span> CLOSE
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default ReleaseManifest;
