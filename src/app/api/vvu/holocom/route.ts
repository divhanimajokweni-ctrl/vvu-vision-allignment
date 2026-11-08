import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appendWormEvent } from '@/lib/vvu-ledger';
import {
  MTP_BASELINE_5G_MS,
  MTP_FIXED_TOTAL_MS,
  MTP_TARGET_6G_MS,
  QOS_CLASSES,
  QOS_CLASS_KEYS,
  fountainCoding,
  predictMos,
  runDiscovery,
  toIntOrNull,
  toNumOrNull,
  toQosClassOrNull,
  type InstanceKpi,
} from '@/lib/holocom';
import type { HoloComResponse, HoloInstance, HoloDiscoveryLogRow, HoloQoeSampleRow } from '@/types/vvu';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Round 19 — 6G NeXt HOLOCOM API (Friese et al. split-computing architecture).
// Server-authoritative posture, same as outreach/lead-scoring:
//   · every score/MOS/coding rate is RECOMPUTED here via src/lib/holocom.ts
//     (pure module) — client values are advisory inputs only;
//   · every mutation appends a WORM event (source 'HOLOCOM');
//   · the registry is INFRASTRUCTURE (not personal data), so it seeds
//     idempotently like TrustGateState — 3 render instances, one per the
//     paper's edge-first posture (2 edge + 1 central).

const DEPLOY_WINDOW_SEC = 12; // simulated Docker pull + Unity boot

const DEPLOY_SITES: HoloComResponse['meta']['deploySites'] = [
  { deployment: 'EDGE', site: 'Gqeberha Edge Cloud', region: 'ZA-EC', gpuClass: 'L4 · 24GB', baseLatencyMs: 7.5, costPerHour: 38 },
  { deployment: 'EDGE', site: 'Johannesburg Edge Cloud', region: 'ZA-GP', gpuClass: 'L4 · 24GB', baseLatencyMs: 9.5, costPerHour: 41 },
  { deployment: 'CENTRAL', site: 'Cape Town Central Cloud', region: 'ZA-WC', gpuClass: 'A100 · 80GB', baseLatencyMs: 16.0, costPerHour: 24 },
];

const SEED_INSTANCES: Array<{
  code: string;
  deployment: string;
  site: string;
  region: string;
  engine: string;
  gpuClass: string;
  baseLatencyMs: number;
  capacityGbps: number;
  costPerHour: number;
}> = [
  {
    code: 'edge-gqeberha-01',
    deployment: 'EDGE',
    site: 'Gqeberha Edge Cloud',
    region: 'ZA-EC',
    engine: 'Unity3D 2022 headless',
    gpuClass: 'L4 · 24GB',
    baseLatencyMs: 7.5,
    capacityGbps: 12,
    costPerHour: 38,
  },
  {
    code: 'edge-jhb-01',
    deployment: 'EDGE',
    site: 'Johannesburg Edge Cloud',
    region: 'ZA-GP',
    engine: 'Unity3D 2022 headless',
    gpuClass: 'L4 · 24GB',
    baseLatencyMs: 9.5,
    capacityGbps: 10,
    costPerHour: 41,
  },
  {
    code: 'central-cpt-01',
    deployment: 'CENTRAL',
    site: 'Cape Town Central Cloud',
    region: 'ZA-WC',
    engine: 'Unity3D 2022 headless',
    gpuClass: 'A100 · 80GB',
    baseLatencyMs: 16,
    capacityGbps: 40,
    costPerHour: 24,
  },
];

// ─── serialization ──────────────────────────────────────────────────────────

function serializeInstance(i: {
  id: string;
  code: string;
  deployment: string;
  site: string;
  region: string;
  engine: string;
  status: string;
  gpuClass: string;
  cpuUtil: number;
  gpuUtil: number;
  memUtil: number;
  baseLatencyMs: number;
  capacityGbps: number;
  costPerHour: number;
  sessions: number;
  createdAt: Date;
  updatedAt: Date;
}): HoloInstance {
  return {
    id: i.id,
    code: i.code,
    deployment: i.deployment === 'CENTRAL' ? 'CENTRAL' : 'EDGE',
    site: i.site,
    region: i.region,
    engine: i.engine,
    status: i.status === 'DEPLOYING' ? 'DEPLOYING' : i.status === 'DRAINED' ? 'DRAINED' : 'ACTIVE',
    gpuClass: i.gpuClass,
    cpuUtil: i.cpuUtil,
    gpuUtil: i.gpuUtil,
    memUtil: i.memUtil,
    baseLatencyMs: i.baseLatencyMs,
    capacityGbps: i.capacityGbps,
    costPerHour: i.costPerHour,
    sessions: i.sessions,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  };
}

function serializeLog(l: {
  id: number;
  clientId: string;
  maxLatencyMs: number;
  minBandwidthMbps: number;
  qosClass: string;
  maxCostPerHour: number | null;
  matchedCode: string | null;
  score: number | null;
  candidates: number;
  reason: string;
  wormSeq: number | null;
  createdAt: Date;
}): HoloDiscoveryLogRow {
  return {
    id: l.id,
    clientId: l.clientId,
    maxLatencyMs: l.maxLatencyMs,
    minBandwidthMbps: l.minBandwidthMbps,
    qosClass: l.qosClass,
    maxCostPerHour: l.maxCostPerHour,
    matchedCode: l.matchedCode,
    score: l.score,
    candidates: l.candidates,
    reason: l.reason,
    wormSeq: l.wormSeq,
    createdAt: l.createdAt.toISOString(),
  };
}

function serializeSample(s: {
  id: number;
  mos: number;
  latencyMs: number;
  jitterMs: number;
  lossPct: number;
  stallMs: number;
  codec: string;
  wormSeq: number | null;
  createdAt: Date;
}): HoloQoeSampleRow {
  return {
    id: s.id,
    mos: s.mos,
    latencyMs: s.latencyMs,
    jitterMs: s.jitterMs,
    lossPct: s.lossPct,
    stallMs: s.stallMs,
    codec: s.codec,
    wormSeq: s.wormSeq,
    createdAt: s.createdAt.toISOString(),
  };
}

// ─── GET: registry + logs + samples + meta ──────────────────────────────────

export async function GET() {
  try {
    // Idempotent infrastructure seed (registry is infra, not personal data).
    let seeded = 0;
    if ((await db.holoRenderInstance.count()) === 0) {
      for (const s of SEED_INSTANCES) {
        await db.holoRenderInstance.create({ data: { ...s } });
        seeded++;
      }
      if (seeded > 0) {
        await appendWormEvent({
          source: 'HOLOCOM',
          event: 'HOLO_REGISTRY_SEEDED',
          details: `${seeded} render instances (2 EDGE · 1 CENTRAL) — edge-first posture per 6G NeXt §IV-B`,
        });
      }
    }

    // Lazy state machine: DEPLOYING → ACTIVE once the simulated Docker
    // pull+boot window has elapsed (no timer thread needed).
    const deploying = await db.holoRenderInstance.findMany({ where: { status: 'DEPLOYING' } });
    for (const inst of deploying) {
      const ageSec = (Date.now() - inst.createdAt.getTime()) / 1000;
      if (ageSec >= DEPLOY_WINDOW_SEC) {
        await db.holoRenderInstance.update({ where: { id: inst.id }, data: { status: 'ACTIVE' } });
        await appendWormEvent({
          source: 'HOLOCOM',
          event: 'HOLO_INSTANCE_ACTIVE',
          details: `${inst.code} · ${inst.site} · container up after ${DEPLOY_WINDOW_SEC}s window · ${inst.gpuClass}`,
        });
      }
    }

    const instances = await db.holoRenderInstance.findMany({ orderBy: { createdAt: 'asc' } });
    const discoveryLogs = await db.holoDiscoveryLog.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
    const qoeSamples = await db.holoQoeSample.findMany({ orderBy: { createdAt: 'desc' }, take: 60 });

    const body: HoloComResponse = {
      instances: instances.map(serializeInstance),
      discoveryLogs: discoveryLogs.map(serializeLog),
      qoeSamples: qoeSamples.map(serializeSample),
      meta: {
        qosClasses: QOS_CLASSES.map((c) => ({ ...c })),
        mtpFixedTotalMs: MTP_FIXED_TOTAL_MS,
        mtpTarget6gMs: MTP_TARGET_6G_MS,
        mtpBaseline5gMs: MTP_BASELINE_5G_MS,
        deployWindowSec: DEPLOY_WINDOW_SEC,
        deploySites: DEPLOY_SITES,
      },
    };
    return NextResponse.json(body);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ─── POST: action-based mutations (discover · deploy · drain · qoe · coding) ─

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 });
  }
  const action = typeof body.action === 'string' ? body.action.toLowerCase() : '';

  try {
    switch (action) {
      // §IV-B3 — parameterized discovery request.
      case 'discover': {
        const clientId = (typeof body.clientId === 'string' && body.clientId.trim() ? body.clientId.trim() : 'holocom-client').slice(0, 60);
        const maxLatencyMs = toIntOrNull(body.maxLatencyMs, 3, 200);
        const minBandwidthMbps = toIntOrNull(body.minBandwidthMbps, 50, 20000);
        const qosClass = toQosClassOrNull(body.qosClass);
        const maxCostPerHour = body.maxCostPerHour === undefined || body.maxCostPerHour === null ? null : toNumOrNull(body.maxCostPerHour, 1, 500);
        if (maxLatencyMs === null || minBandwidthMbps === null || qosClass === null) {
          return NextResponse.json(
            { success: false, message: 'discover requires maxLatencyMs (3-200), minBandwidthMbps (50-20000), qosClass (one of ' + (QOS_CLASS_KEYS as readonly string[]).join(' | ') + ')' },
            { status: 422 }
          );
        }
        const rows = await db.holoRenderInstance.findMany({ orderBy: { createdAt: 'asc' } });
        const kpis: InstanceKpi[] = rows.map((r) => ({
          code: r.code,
          deployment: r.deployment,
          site: r.site,
          region: r.region,
          engine: r.engine,
          status: r.status,
          gpuClass: r.gpuClass,
          cpuUtil: r.cpuUtil,
          gpuUtil: r.gpuUtil,
          memUtil: r.memUtil,
          baseLatencyMs: r.baseLatencyMs,
          capacityGbps: r.capacityGbps,
          costPerHour: r.costPerHour,
          sessions: r.sessions,
        }));
        const outcome = runDiscovery(kpis, { clientId, maxLatencyMs, minBandwidthMbps, qosClass, maxCostPerHour });

        // Pin the session to the matched instance (paper: client connects to
        // the recommended instance — sessions++ is that binding).
        if (outcome.matched) {
          const matchedRow = rows.find((r) => r.code === outcome.matched?.code);
          if (matchedRow) {
            await db.holoRenderInstance.update({
              where: { id: matchedRow.id },
              data: { sessions: { increment: 1 } },
            });
          }
        }

        const worm = await appendWormEvent({
          source: 'HOLOCOM',
          event: 'HOLO_DISCOVERY',
          details: outcome.matched
            ? `${clientId} · ${qosClass} · ≤${maxLatencyMs}ms · ≥${minBandwidthMbps}Mbps${maxCostPerHour !== null ? ` · ≤R${maxCostPerHour}/h` : ''} → ${outcome.matched.code} (${outcome.matched.score}/100)`
            : `${clientId} · ${qosClass} · ≤${maxLatencyMs}ms · ≥${minBandwidthMbps}Mbps → NO MATCH · ${outcome.reason}`,
        });
        const log = await db.holoDiscoveryLog.create({
          data: {
            clientId,
            maxLatencyMs,
            minBandwidthMbps,
            qosClass,
            maxCostPerHour,
            matchedCode: outcome.matched?.code ?? null,
            score: outcome.matched?.score ?? null,
            candidates: outcome.candidates.length,
            reason: outcome.reason.slice(0, 240),
            wormSeq: worm.seq,
          },
        });
        return NextResponse.json({ success: true, outcome, log: serializeLog(log), wormSeq: worm.seq }, { status: 201 });
      }

      // §IV-B4 — Service Broker: recommend + deploy a new instance.
      case 'deploy': {
        const siteIndexRaw = toIntOrNull(body.siteIndex, 0, DEPLOY_SITES.length - 1);
        const siteIndex = siteIndexRaw === null ? 0 : siteIndexRaw;
        const site = DEPLOY_SITES[siteIndex] ?? DEPLOY_SITES[0];
        const prefix =
          site.deployment === 'EDGE' ? `edge-${site.site.toLowerCase().includes('gqeberha') ? 'gqeberha' : 'jhb'}` : 'central-cpt';
        const existing = await db.holoRenderInstance.findMany({ where: { code: { startsWith: `${prefix}-` } } });
        const seqNo = existing.length + 1;
        const code = `${prefix}-${String(seqNo).padStart(2, '0')}`;

        const inst = await db.holoRenderInstance.create({
          data: {
            code,
            deployment: site.deployment,
            site: site.site,
            region: site.region,
            engine: 'Unity3D 2022 headless',
            status: 'DEPLOYING',
            gpuClass: site.gpuClass,
            cpuUtil: 0.15,
            gpuUtil: 0.2,
            memUtil: 0.25,
            baseLatencyMs: site.baseLatencyMs,
            capacityGbps: site.deployment === 'EDGE' ? 10 : 40,
            costPerHour: site.costPerHour,
          },
        });
        const worm = await appendWormEvent({
          source: 'HOLOCOM',
          event: 'HOLO_INSTANCE_DEPLOY',
          details: `${code} · ${site.site} · Docker pull → Unity boot · ${site.gpuClass} · broker window ${DEPLOY_WINDOW_SEC}s`,
        });
        return NextResponse.json({ success: true, instance: serializeInstance(inst), wormSeq: worm.seq }, { status: 201 });
      }

      // §IV-B4 — drain an instance (scale-in / decommission).
      case 'drain': {
        const id = typeof body.id === 'string' ? body.id : '';
        if (!id) {
          return NextResponse.json({ success: false, message: 'drain requires id' }, { status: 422 });
        }
        const inst = await db.holoRenderInstance.findFirst({ where: { id } });
        if (!inst) {
          return NextResponse.json({ success: false, message: 'Instance not found' }, { status: 404 });
        }
        if (inst.status === 'DRAINED') {
          return NextResponse.json({ success: false, message: 'Instance already drained' }, { status: 409 });
        }
        const updated = await db.holoRenderInstance.update({
          where: { id: inst.id },
          data: { status: 'DRAINED', sessions: 0 },
        });
        const worm = await appendWormEvent({
          source: 'HOLOCOM',
          event: 'HOLO_INSTANCE_DRAINED',
          details: `${inst.code} · ${inst.site} · ${inst.sessions} sessions released`,
        });
        return NextResponse.json({ success: true, instance: serializeInstance(updated), wormSeq: worm.seq });
      }

      // §IV-D — QoE sample: MOS recomputed server-side from raw KPIs.
      case 'qoe': {
        const latencyMs = toNumOrNull(body.latencyMs, 0, 500);
        const jitterMs = toNumOrNull(body.jitterMs, 0, 100);
        const lossPct = toNumOrNull(body.lossPct, 0, 100);
        const stallMs = toNumOrNull(body.stallMs, 0, 5000);
        const codec = typeof body.codec === 'string' && ['H265', 'AV1', 'VP9'].includes(body.codec.toUpperCase())
          ? body.codec.toUpperCase()
          : 'H265';
        if (latencyMs === null || jitterMs === null || lossPct === null || stallMs === null) {
          return NextResponse.json(
            { success: false, message: 'qoe requires latencyMs, jitterMs, lossPct, stallMs (numbers)' },
            { status: 422 }
          );
        }
        // SERVER recompute — a client-supplied mos is never read.
        const result = predictMos({ latencyMs, jitterMs, lossPct, stallMs, codec });
        const worm = await appendWormEvent({
          source: 'HOLOCOM',
          event: 'HOLO_QOE_SAMPLED',
          details: `MOS ${result.mos} (${result.band}) · MTP ${latencyMs}ms · jitter ${jitterMs}ms · loss ${lossPct}% · stall ${stallMs}ms · ${codec}`,
        });
        const sample = await db.holoQoeSample.create({
          data: { mos: result.mos, latencyMs, jitterMs, lossPct, stallMs, codec, wormSeq: worm.seq },
        });
        return NextResponse.json({ success: true, result, sample: serializeSample(sample), wormSeq: worm.seq }, { status: 201 });
      }

      // §IV-E — fountain coding rate adaptation (two-stage FEC + rateless).
      case 'coding': {
        const lossPct = toNumOrNull(body.lossPct, 0.01, 90);
        const targetReliability = toNumOrNull(body.targetReliability, 0.9, 0.999999);
        const payloadSymbols = toIntOrNull(body.payloadSymbols, 4, 256);
        if (lossPct === null || targetReliability === null || payloadSymbols === null) {
          return NextResponse.json(
            { success: false, message: 'coding requires lossPct (0.01-90), targetReliability (0.9-0.999999), payloadSymbols (4-256)' },
            { status: 422 }
          );
        }
        const result = fountainCoding(lossPct, targetReliability, payloadSymbols);
        const worm = await appendWormEvent({
          source: 'HOLOCOM',
          event: 'HOLO_CODING_RATE',
          details: `rate ${result.codingRate} · k=${payloadSymbols} + ${result.extraSymbols} fountain · loss ${lossPct}% · target ${(targetReliability * 100).toFixed(3)}% · achieved ${(result.achievableReliability * 100).toFixed(3)}%`,
        });
        return NextResponse.json({ success: true, result: { ...result, wormSeq: worm.seq }, wormSeq: worm.seq }, { status: 201 });
      }

      default:
        return NextResponse.json(
          { success: false, message: 'Unknown action — use discover | deploy | drain | qoe | coding' },
          { status: 422 }
        );
    }
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
