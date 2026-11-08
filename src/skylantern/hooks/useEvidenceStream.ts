"use client";

import { useEffect, useRef } from "react";
import { skylanternApi } from "../lib/api";
import { useSkylanternStore } from "./useSkylanternStore";

/**
 * Polls the Skylantern API on an adaptive cadence and hydrates the
 * Zustand store. The digital twin re-renders from the store on every refresh,
 * giving the "live evidence stream" feel.
 *
 * Adaptive backoff: if a fetch fails (e.g. dev server restarting), the
 * interval exponentially backs off up to 30s to avoid spamming warnings.
 * On the next successful fetch, it resets to the base interval.
 */
export function useEvidenceStream(opts?: { intervalMs?: number }) {
  const baseIntervalMs = opts?.intervalMs ?? 4000;
  const maxIntervalMs = 30000;
  const {
    setStats,
    setDevices,
    setEvidence,
    setChain,
    setLoading,
    markUpdated,
    selectedEvidenceId,
    selectEvidence,
    openDrawer,
    auditTimeline,
    setAuditTimeline,
    setSubscriptions,
  } = useSkylanternStore();
  const selectedRef = useRef<string | null>(selectedEvidenceId);
  selectedRef.current = selectedEvidenceId;
  const openDrawerRef = useRef(openDrawer);
  openDrawerRef.current = openDrawer;
  const auditRef = useRef<AuditEventDTO[] | null>(auditTimeline);
  auditRef.current = auditTimeline;
  // Track whether we've auto-seeded to avoid re-seeding on every backoff-retry.
  const hasSeededRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let currentInterval = baseIntervalMs;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      if (cancelled) return;
      setLoading(true);
      try {
        const [stats, devices, evidence, chain, subs] = await Promise.all([
          skylanternApi.getStats(),
          skylanternApi.getDevices(),
          skylanternApi.getEvidence({ limit: 200 }),
          skylanternApi.getChain(60),
          skylanternApi.getSubscriptions(),
        ]);
        if (cancelled) return;
        setStats(stats);
        setDevices(devices);
        setEvidence(evidence);
        setChain(chain);
        setSubscriptions(subs);
        markUpdated();

        // Reset backoff on success.
        currentInterval = baseIntervalMs;

        // Refresh the open drawer if its evidence was updated.
        const openId = selectedRef.current;
        if (openId) {
          const fresh = evidence.find((e) => e.id === openId);
          if (fresh) selectEvidence(fresh);
          // Also refresh the audit timeline if the drawer is open.
          const currentAudit = auditRef.current;
          if (currentAudit && currentAudit.length > 0) {
            try {
              const freshAudit = await skylanternApi.getAuditTimeline(openId);
              if (!cancelled) setAuditTimeline(freshAudit);
            } catch {
              // swallow
            }
          }
        }

        // First load: auto-seed if there are no devices at all.
        if (devices.length === 0 && stats.totalDevices === 0 && !hasSeededRef.current) {
          hasSeededRef.current = true;
          try {
            await skylanternApi.seed();
          } catch {
            // swallow — the next tick will pick it up
          }
        }
      } catch (e) {
        // Network blips are expected during dev hot reloads or when the
        // sandbox dev server is idle-restarting. Exponentially back off
        // instead of spamming warnings every 4s.
        currentInterval = Math.min(currentInterval * 1.6, maxIntervalMs);
        // Only log in dev, and only every Nth failure (not every tick).
        if (
          process.env.NODE_ENV !== "production" &&
          currentInterval >= baseIntervalMs * 2
        ) {
          console.debug(
            `[skylantern] stream backing off to ${Math.round(currentInterval)}ms`,
            e instanceof Error ? e.message : ""
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          timeoutHandle = setTimeout(tick, currentInterval);
        }
      }
    }

    tick();
    return () => {
      cancelled = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
    };
  }, [
    baseIntervalMs,
    setStats,
    setDevices,
    setEvidence,
    setChain,
    setLoading,
    markUpdated,
    selectEvidence,
    setAuditTimeline,
    setSubscriptions,
  ]);
}

// Type-only import to avoid a runtime cycle when AuditEventDTO is only used
// in a ref type annotation above.
import type { AuditEventDTO } from "../types";
