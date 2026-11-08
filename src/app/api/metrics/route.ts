import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/metrics?range=1h|6h|24h — performance metrics time series.
// Synthesizes realistic time-series data for merge throughput, repair latency,
// invariant pass rate, and gossip propagation delay, grounded in real DB counts.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const range = searchParams.get("range") ?? "6h";

  const rangeMs =
    range === "1h" ? 3_600_000 : range === "24h" ? 86_400_000 : 21_600_000;
  const bucketCount = range === "1h" ? 30 : range === "24h" ? 48 : 36;
  const bucketMs = rangeMs / bucketCount;

  // Ground the synthetic series in real DB state
  const [
    totalMerges,
    appliedMerges,
    totalShards,
    healthyShards,
    violatingShards,
    totalProofs,
    zkProofs,
    totalViolations,
    policies,
  ] = await Promise.all([
    db.mergeProposal.count(),
    db.mergeProposal.count({ where: { status: "applied" } }),
    db.shard.count(),
    db.shard.count({ where: { invariantStatus: "healthy" } }),
    db.shard.count({ where: { invariantStatus: "violating" } }),
    db.ancestryProof.count(),
    db.ancestryProof.count({ where: { NOT: { zkProof: null } } }),
    db.invariantViolation.count(),
    db.policy.count(),
  ]);

  const successRate = totalMerges ? appliedMerges / totalMerges : 0.8;
  const healthRate = totalShards ? healthyShards / totalShards : 0.7;
  const zkRate = totalProofs ? zkProofs / totalProofs : 0.4;

  // Seeded pseudo-random for deterministic series
  let seed = 42;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  const now = Date.now();
  const buckets: {
    t: number;
    mergeThroughput: number;
    repairLatencyMs: number;
    invariantPassRate: number;
    gossipDelayMs: number;
    zkProofRate: number;
  }[] = [];

  for (let i = bucketCount - 1; i >= 0; i--) {
    const t = now - i * bucketMs;
    // Daily seasonality: dips at ~3am, peaks at ~10am
    const hour = new Date(t).getHours();
    const seasonality = 0.7 + 0.3 * Math.sin((hour - 3) / 24 * Math.PI * 2);
    const noise = 0.85 + rand() * 0.3;

    buckets.push({
      t,
      mergeThroughput: Math.max(0, Math.round((8 * successRate * seasonality * noise) + rand() * 2)),
      repairLatencyMs: Math.round((120 + (1 - healthRate) * 200) * (1 / seasonality) * (0.8 + rand() * 0.4)),
      invariantPassRate: Math.min(100, Math.max(0, Math.round((healthRate * 100 * seasonality + (rand() - 0.5) * 8) * 10) / 10)),
      gossipDelayMs: Math.round((45 + rand() * 35) * (1 + (1 - seasonality) * 0.5)),
      zkProofRate: Math.min(100, Math.max(0, Math.round((zkRate * 100) * (0.9 + rand() * 0.2) * 10) / 10)),
    });
  }

  // Current snapshot
  const latest = buckets[buckets.length - 1];
  const prev = buckets[buckets.length - 2] ?? latest;

  const deltas = {
    mergeThroughput: latest.mergeThroughput - prev.mergeThroughput,
    repairLatencyMs: latest.repairLatencyMs - prev.repairLatencyMs,
    invariantPassRate: latest.invariantPassRate - prev.invariantPassRate,
    gossipDelayMs: latest.gossipDelayMs - prev.gossipDelayMs,
    zkProofRate: latest.zkProofRate - prev.zkProofRate,
  };

  // Aggregates
  const avgThroughput = buckets.reduce((n, b) => n + b.mergeThroughput, 0) / buckets.length;
  const avgLatency = buckets.reduce((n, b) => n + b.repairLatencyMs, 0) / buckets.length;
  const avgPassRate = buckets.reduce((n, b) => n + b.invariantPassRate, 0) / buckets.length;
  const p95Latency = [...buckets.map((b) => b.repairLatencyMs)].sort((a, b) => a - b)[Math.floor(buckets.length * 0.95)] ?? avgLatency;
  const maxGossip = Math.max(...buckets.map((b) => b.gossipDelayMs));

  return NextResponse.json({
    range,
    bucketCount,
    buckets,
    deltas,
    current: latest,
    aggregates: {
      avgThroughput: Math.round(avgThroughput * 10) / 10,
      avgLatency: Math.round(avgLatency),
      avgPassRate: Math.round(avgPassRate * 10) / 10,
      p95Latency,
      maxGossip,
    },
    grounding: {
      totalMerges,
      appliedMerges,
      successRate: Math.round(successRate * 100),
      totalShards,
      healthyShards,
      violatingShards,
      healthRate: Math.round(healthRate * 100),
      totalProofs,
      zkProofs,
      zkRate: Math.round(zkRate * 100),
      totalViolations,
      policies,
    },
  });
}
