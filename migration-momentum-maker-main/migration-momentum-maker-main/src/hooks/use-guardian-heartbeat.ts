"use client";

// src/hooks/use-guardian-heartbeat.ts — R71 · the guardian's own heartbeat,
// polled for the fixed header. R70 handoff priority #2: "consider a 'last
// guardian save' fact on the dashboard header so a fresh pid is never a
// surprise". This hook is the READ side of that fact:
//
//   · /api/guardian is the guardian's own report (status.json rewritten
//     every 20s pass + the append-only bounces journal). A 30s poll keeps
//     the header within 1.5 guardian passes — the watchdog surface already
//     polls the same endpoint at 15s under a DIFFERENT query key, and the
//     two must not share one (different surfaces, different cadences).
//   · the payload is read-only truth: present:false means GUARDIAN OFF
//     (no fake green), stale:true means the passes stopped (no silent
//     death) — the same honesty rules the /api/guardian route enforces.
//
// The zone reuses the watchdog gauge's R66 semantics exactly: the warmed
// estate idles at ~1.85–1.95GB against a 2100MB guard, so color encodes
// DISTANCE TO THE BOUNCE LINE (80% / 95% of guard), not "is it alive".

import { useQuery } from "@tanstack/react-query";

export interface GuardianHeartbeatStatus {
  mode: string;
  guardianPid: number;
  intervalSec: number;
  guardMb: number;
  nextServerPid: number | null;
  rssKb: number | null;
  hwmKb: number | null;
  boxAvailKb?: number | null;
  bounces: number;
  lastAction: string;
  lastBounceAtUtc: string | null;
  lastPassAtUtc: string;
}

export interface GuardianJournalRow {
  at?: string;
  reason?: string;
  oldPid?: number | null;
  newPid?: number | null;
  downtimeMs?: number | null;
  ok?: boolean;
  drill?: boolean;
  [key: string]: unknown;
}

export interface GuardianHeartbeatPlateau {
  baselineMb: number | null;
  headroomMb: number | null;
  driftMb: number | null;
  samples?: number;
}

export interface GuardianHeartbeatData {
  present: boolean;
  guardianAlive?: boolean;
  stale?: boolean;
  guardian?: GuardianHeartbeatStatus;
  bounces?: GuardianJournalRow[];
  plateau?: GuardianHeartbeatPlateau | null;
  error?: string;
  armCommand?: string;
}

export type GuardianZone = "lime" | "amber" | "rose" | "dim";

export function useGuardianHeartbeat() {
  return useQuery<GuardianHeartbeatData, Error>({
    queryKey: ["guardian-heartbeat"],
    queryFn: async () => {
      const res = await fetch("/api/guardian", { cache: "no-store" });
      if (!res.ok) throw new Error(`GUARDIAN HEARTBEAT HTTP ${res.status}`);
      return (await res.json()) as GuardianHeartbeatData;
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });
}

// guardian.py stamps "%Y-%m-%d %H:%M:%S UTC" — parse on the UTC wall clock
// (same contract as the /api/guardian route's own parser; duplicated here
// rather than imported so the header carries no server-route code).
export function parseGuardianUtc(label: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) UTC$/.exec(label.trim());
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

/** Time since the label, in words — the chip's ago label. Deterministic
 *  per second; callers re-render on their own tick. */
export function guardianAgoLabel(label: string | null | undefined, now: number): string | null {
  if (!label) return null;
  const at = parseGuardianUtc(label);
  if (!Number.isFinite(at)) return null;
  const sec = Math.max(0, Math.round((now - at) / 1000));
  if (sec < 90) return "JUST NOW";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}M AGO`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return m > 0 ? `${h}H ${m}M AGO` : `${h}H AGO`;
  const d = Math.floor(h / 24);
  return d > 0 ? `${d}D ${h % 24}H AGO` : `${h}H AGO`;
}

/** Compact variant for the 390px header row — no "AGO", hours folded. */
export function guardianAgoCompact(label: string | null | undefined, now: number): string | null {
  if (!label) return null;
  const at = parseGuardianUtc(label);
  if (!Number.isFinite(at)) return null;
  const min = Math.max(0, Math.round((now - at) / 60000));
  if (min < 1) return "NOW";
  if (min < 60) return `${min}M`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}H${min % 60 > 0 ? `${String(min % 60).padStart(2, "0")}` : ""}`;
  return `${Math.floor(h / 24)}D${String(h % 24).padStart(2, "0")}H`;
}

/** The watchdog gauge's R66 zone thresholds — one contract, two surfaces. */
export function guardianZone(rssMb: number | null, guardMb: number | null): GuardianZone {
  if (rssMb == null || !guardMb) return "dim";
  const ratio = rssMb / guardMb;
  if (ratio >= 0.95) return "rose";
  if (ratio >= 0.8) return "amber";
  return "lime";
}

export const GUARDIAN_ZONE_COLOR: Record<GuardianZone, string> = {
  lime: "#c8ff00",
  amber: "#e0a030",
  rose: "#e5484d",
  dim: "#6b8a40",
};
