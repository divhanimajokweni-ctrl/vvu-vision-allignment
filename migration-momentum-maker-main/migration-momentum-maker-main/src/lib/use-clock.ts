"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type ClockRecord = {
  ok: boolean;
  schema?: string;
  version?: string;
  revision?: number;
  current_utc?: string;
  last_written_by?: "dev-spreadsheet" | "production-dashboard";
  last_written_at_utc?: string;
  error?: string;
  detail?: string;
  worm_id?: string;
};

export function useClock() {
  return useQuery<ClockRecord>({
    queryKey: ["vvu-clock"],
    queryFn: async () => {
      const r = await fetch("/api/vvu/clock", { cache: "no-store" });
      const j = await r.json();
      return { ok: r.ok, ...j };
    },
    refetchInterval: 15_000,
    staleTime: 0,
    retry: false,
  });
}

export function useAdvanceClock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (by: "dev-spreadsheet" | "production-dashboard") => {
      const r = await fetch("/api/vvu/clock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ by }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "clock write failed");
      return j;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vvu-clock"] }),
  });
}
