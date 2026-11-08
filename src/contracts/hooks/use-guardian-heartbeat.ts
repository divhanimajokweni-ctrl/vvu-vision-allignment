'use client';

import { useEffect, useState } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

export interface GuardianSnapshot {
  rssKb: number | null;
  guardMb: number | null;
  lastBounceAtUtc: string | null;
  pid: number | null;
  nodeVersion: string | null;
}

export interface GuardianHeartbeatData {
  present: boolean;
  stale: boolean;
  guardianAlive: boolean;
  guardian: GuardianSnapshot | null;
  checkedAt: number;
  armCommand?: string;
  plateau?: { driftMb: number | null; trend: string | null };
}

// ── Zone logic ─────────────────────────────────────────────────────────────
// guardianZone classifies RSS vs the guard rail into a color zone.
// - lime: healthy (RSS well under guard)
// - amber: warning (RSS approaching guard)
// - rose: critical (RSS at or over guard)
// - dim: unknown (no data)

export type GuardianZone = 'lime' | 'amber' | 'rose' | 'dim';

export function guardianZone(rssMb: number | null, guardMb: number | null): GuardianZone {
  if (rssMb == null || guardMb == null || guardMb <= 0) return 'dim';
  const ratio = rssMb / guardMb;
  if (ratio >= 0.9) return 'rose';
  if (ratio >= 0.7) return 'amber';
  return 'lime';
}

export const GUARDIAN_ZONE_COLOR: Record<GuardianZone, string> = {
  lime: '#c8ff00',
  amber: '#e0a030',
  rose: '#e5484d',
  dim: '#4a5744',
};

// ── Time formatting ────────────────────────────────────────────────────────

export function guardianAgoLabel(ts: string | null, now: number): string {
  if (!ts) return '—';
  const delta = Math.max(0, now - new Date(ts).getTime());
  const s = Math.floor(delta / 1000);
  if (s < 60) return s + 's ago';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

export function guardianAgoCompact(ts: string | null, now: number): string {
  if (!ts) return '—';
  const delta = Math.max(0, now - new Date(ts).getTime());
  const s = Math.floor(delta / 1000);
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h';
  return Math.floor(h / 24) + 'd';
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useGuardianHeartbeat() {
  const [data, setData] = useState<GuardianHeartbeatData | null>(null);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const res = await fetch('/api/guardian');
        if (!alive) return;
        if (res.ok) {
          const json = await res.json();
          setIsError(false);
          setData({
            present: true,
            stale: false,
            guardianAlive: json.alive ?? true,
            guardian: {
              rssKb: json.rssKb ?? null,
              guardMb: json.guardMb ?? null,
              lastBounceAtUtc: json.lastBounceAtUtc ?? null,
              pid: json.pid ?? null,
              nodeVersion: json.nodeVersion ?? null,
            },
            checkedAt: Date.now(),
          });
        } else {
          setIsError(true);
          setData({ present: false, stale: true, guardianAlive: false, guardian: null, checkedAt: Date.now() });
        }
      } catch {
        if (!alive) return;
        setIsError(true);
        setData({ present: false, stale: true, guardianAlive: false, guardian: null, checkedAt: Date.now() });
      }
    };
    check();
    const interval = setInterval(check, 15000);
    return () => { alive = false; clearInterval(interval); };
  }, []);

  return { data, isError };
}
