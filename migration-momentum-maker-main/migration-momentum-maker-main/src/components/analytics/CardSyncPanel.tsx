"use client";

// src/components/analytics/CardSyncPanel.tsx — §11 CARD SYNC panel: the live
// status of the Field OS Card sync endpoint (/api/vvu/captures/sync — the
// contract in docs/strategy/CARD-SYNC.md). Shows the real capture-store
// state (count, chain head, integrity), the newest stored captures and the
// WORM bridge, refreshed every 15s or on demand. Read-only by design: the
// panel never writes captures — the card does that.

import { useQuery } from "@tanstack/react-query";
import { CreditCard, Loader2, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Chip, HttpError, QueryErrorCard, SectionHeader, fmtTime } from "./shared";
import type { CardCaptureRecord } from "@/lib/card-captures";

type SyncStatusResponse = {
  success: boolean;
  schema: string;
  count: number;
  head: string | null;
  lastReceivedAtUtc: string | null;
  chainValid: boolean;
  recent?: CardCaptureRecord[];
};

function useSyncStatusQuery() {
  return useQuery<SyncStatusResponse, HttpError>({
    queryKey: ["card-sync-status"],
    refetchInterval: 15_000,
    queryFn: async () => {
      const res = await fetch("/api/vvu/captures/sync?recent=10", { cache: "no-store" });
      if (!res.ok) throw new HttpError(`CARD SYNC HTTP ${res.status}`, res.status);
      return (await res.json()) as SyncStatusResponse;
    },
  });
}

const KIND_TONE: Record<string, "lime" | "ochre" | "dim"> = {
  CONTACT: "lime",
  NOTE: "ochre",
  REFERRAL: "dim",
};

export default function CardSyncPanel({ num }: { num?: string }) {
  const { data, isPending, isFetching, error, refetch } = useSyncStatusQuery();

  return (
    <section aria-label="Field OS Card sync status">
      <SectionHeader
        num={num}
        title="FIELD OS CARD · SYNC"
        kicker="FILE-BACKED SHA-256 CHAIN · IDEMPOTENT BY CAPTURE ID"
        right={
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 border-[rgba(107,138,64,0.4)] text-[#c9d4bd] hover:bg-[rgba(107,138,64,0.12)] hover:text-[#f3e38a]"
            onClick={() => {
              toast.promise(refetch(), {
                loading: "Re-reading the capture store…",
                success: "Capture store re-read.",
                error: "Re-read failed — see the panel.",
              });
            }}
          >
            {isFetching ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            REFRESH
          </Button>
        }
      />

      {error ? (
        <QueryErrorCard label="CARD SYNC" onRetry={() => void refetch()} />
      ) : isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full bg-[rgba(107,138,64,0.12)]" />
          <Skeleton className="h-24 w-full bg-[rgba(107,138,64,0.08)]" />
        </div>
      ) : data ? (
        <div className="space-y-3">
          {/* status chip row — real store state, no cache */}
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="ochre" className="gap-1.5">
              <CreditCard className="size-3" aria-hidden />
              {data.count} {data.count === 1 ? "CAPTURE" : "CAPTURES"} STORED
            </Chip>
            <Chip tone={data.chainValid ? "lime" : "dim"} className="gap-1.5">
              {data.chainValid ? (
                <ShieldCheck className="size-3" aria-hidden />
              ) : (
                <ShieldAlert className="size-3" aria-hidden />
              )}
              CHAIN {data.chainValid ? "VALID" : "BROKEN"}
            </Chip>
            <Chip tone="dim">HEAD {data.head ? `${data.head.slice(0, 10)}…` : "EMPTY"}</Chip>
            {data.lastReceivedAtUtc && (
              <Chip tone="dim">LAST {fmtTime(data.lastReceivedAtUtc)}</Chip>
            )}
          </div>

          {/* newest stored captures — the card half is TO_BE_FILLED (no
              card.html base has reached this box); these rows are whatever
              the endpoint has actually accepted. */}
          {data.recent && data.recent.length > 0 ? (
            <div className="max-h-72 overflow-y-auto rounded border border-[rgba(107,138,64,0.28)]">
              <Table>
                <TableHeader className="sticky top-0 bg-[#0a0d09]">
                  <TableRow className="border-[rgba(107,138,64,0.28)] hover:bg-transparent">
                    <TableHead className="vvu-label text-[9px] text-[#7a8a6e]">SEQ</TableHead>
                    <TableHead className="vvu-label text-[9px] text-[#7a8a6e]">ID</TableHead>
                    <TableHead className="vvu-label text-[9px] text-[#7a8a6e]">KIND</TableHead>
                    <TableHead className="vvu-label text-[9px] text-[#7a8a6e]">CONTACT</TableHead>
                    <TableHead className="vvu-label text-[9px] text-[#7a8a6e]">CAPTURED</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recent.map((c) => (
                    <TableRow key={c.id} className="border-[rgba(107,138,64,0.18)]">
                      <TableCell className="font-mono text-[10px] tabular-nums text-[#7a8a6e]">
                        {c.seq}
                      </TableCell>
                      <TableCell className="font-mono text-[10px] text-[#c9d4bd]">{c.id}</TableCell>
                      <TableCell>
                        <Chip tone={KIND_TONE[c.kind] ?? "dim"}>{c.kind}</Chip>
                      </TableCell>
                      <TableCell className="max-w-56 truncate text-[11px] text-[#c9d4bd]">
                        {[c.name, c.phone, c.email, c.linkedin].filter(Boolean).join(" · ") || (
                          <span className="text-[#7a8a6e]">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-[10px] text-[#7a8a6e]">
                        {c.capturedAt ? (
                          fmtTime(c.capturedAt)
                        ) : (
                          <span className="text-[#7a8a6e]">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-[11px] text-[#7a8a6e]">
              Store empty — no captures accepted yet. The card half of the contract is TO_BE_FILLED
              (no card.html base has reached this box); the endpoint is live and measured.
            </p>
          )}

          <p className="text-[10px] leading-relaxed text-[#7a8a6e]">
            Contract: docs/strategy/CARD-SYNC.md · POST is idempotent by capture id · every batch
            bridges to the WORM ledger (source CARD_SYNC). The panel is read-only — the card does
            the writing.
          </p>
        </div>
      ) : null}
    </section>
  );
}
