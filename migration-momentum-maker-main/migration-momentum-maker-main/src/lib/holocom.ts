// src/lib/holocom.ts — 6G NeXt HOLOCOM computation core (Round 19).
//
// Adapted from Friese et al., "True 3D Holography: A Communication Service of
// Tomorrow and Its Requirements for a New Converged Cloud and Network
// Architecture on the Path to 6G" (project 6G NeXt, BMBF 16KISK17x).
//
// PURE MODULE — no SDK, no DB, no Next imports (mirrors src/lib/lead-scoring.ts
// from Round 18): importable from BOTH the API routes (server-authoritative
// recompute on every write) and the client (advisory live preview).
//
// Covers the paper's quantitative pillars, mapped to this sandbox:
//   §III/IV-A  MTP (Motion-to-Photon) latency budget  → MTP_SEGMENTS + computeMtp
//   §IV-B3     Discovery Service (KPI-parameterized)  → QOS_CLASSES + scoreInstance
//   §IV-D      QoE alignment (P.1203-inspired MOS)    → predictMos + qoeConstructs
//   §IV-E      QoS prediction (offline/online phases) → predictQos (EMA+linear
//              trend surrogate standing in for the paper's LSTM/DRL models)
//   §IV-E      Two-stage FEC + fountain coding rate   → fountainCoding

// ─── §III/IV-A — MTP latency budget (ms) ────────────────────────────────────
// Eye-tracking → 3D capture → H265 encode → 6G uplink → headless Unity render
// (edge) → 6G downlink → H265 decode → H3D sub-frame compute → display photon.
// Fixed stages are hardware constants; the two transport stages carry the live
// network KPIs from the telemetry sim. 6G target ≤ 20ms (paper: "extremely
// low delay + high bandwidth … realistic experience"); 5G baseline 40ms.

export interface MtpSegment {
  key: string;
  label: string;
  domain: 'CLIENT' | 'NETWORK' | 'EDGE' | 'DISPLAY';
  fixedMs: number;
  hint: string;
}

export const MTP_SEGMENTS: readonly MtpSegment[] = [
  { key: 'eye', label: 'EYE-TRACK', domain: 'CLIENT', fixedMs: 1.2, hint: 'gaze sampling 240Hz' },
  { key: 'capture', label: '3D-CAPTURE', domain: 'CLIENT', fixedMs: 3.0, hint: 'RGB-D + depth-from-stereo fusion' },
  { key: 'encode', label: 'H265-ENC', domain: 'CLIENT', fixedMs: 2.0, hint: 'hardware encode, sub-frame slices' },
  { key: 'uplink', label: '6G-UL', domain: 'NETWORK', fixedMs: 0, hint: 'client → edge (live KPI)' },
  { key: 'render', label: 'UNITY-RENDER', domain: 'EDGE', fixedMs: 3.5, hint: 'headless Unity, H3D view synthesis' },
  { key: 'downlink', label: '6G-DL', domain: 'EDGE', fixedMs: 0, hint: 'edge → client (live KPI)' },
  { key: 'decode', label: 'H265-DEC', domain: 'CLIENT', fixedMs: 1.8, hint: 'hardware decode' },
  { key: 'holo', label: 'H3D-COMPUTE', domain: 'DISPLAY', fixedMs: 2.2, hint: 'hologram sub-frame interpolation' },
  { key: 'photon', label: 'PHOTON', domain: 'DISPLAY', fixedMs: 1.0, hint: 'light-field display emission' },
] as const;

export const MTP_TARGET_6G_MS = 20;
export const MTP_BASELINE_5G_MS = 40;
/** Fixed (non-network) part of the chain: 14.7ms with the 6G-era hardware
 *  constants above — the two live transport legs decide 6G-target compliance. */
export const MTP_FIXED_TOTAL_MS = round2(
  MTP_SEGMENTS.reduce((acc, s) => acc + s.fixedMs, 0)
);

export interface MtpResult {
  segments: Array<MtpSegment & { liveMs: number }>;
  totalMs: number;
  networkMs: number;
  budget6gMs: number;
  budget5gMs: number;
  meets6g: boolean;
  meets5g: boolean;
}

/** Compose the live MTP chain from the two live transport stages. */
export function computeMtp(uplinkMs: number, downlinkMs: number): MtpResult {
  const live: Record<string, number> = { uplink: uplinkMs, downlink: downlinkMs };
  const segments = MTP_SEGMENTS.map((s) => {
    const liveMs = s.key === 'uplink' ? round2(uplinkMs) : s.key === 'downlink' ? round2(downlinkMs) : s.fixedMs;
    return { ...s, liveMs };
  });
  const networkMs = round2(uplinkMs + downlinkMs);
  const totalMs = round2(segments.reduce((acc, s) => acc + s.liveMs, 0));
  return {
    segments,
    totalMs,
    networkMs,
    budget6gMs: MTP_TARGET_6G_MS,
    budget5gMs: MTP_BASELINE_5G_MS,
    meets6g: totalMs <= MTP_TARGET_6G_MS,
    meets5g: totalMs <= MTP_BASELINE_5G_MS,
  };
}

// ─── §IV-B — Discovery Service scoring ──────────────────────────────────────

/** Traffic classes inside one HoloCom call (paper: video/audio/control with
 *  "very heterogeneous requirements" — the fountain lab divides on these). */
export const QOS_CLASSES = [
  { key: 'CONVERSATIONAL', label: 'CONVERSATIONAL', weight: 1.0, hint: 'H3D video + audio · strict latency', latencyMaxMs: 20 },
  { key: 'STREAMING', label: 'STREAMING', weight: 0.7, hint: 'depth-map side channel · jitter-tolerant', latencyMaxMs: 60 },
  { key: 'CONTROL', label: 'CONTROL', weight: 0.9, hint: 'eye-tracking + input events · loss-sensitive', latencyMaxMs: 15 },
  { key: 'BEST_EFFORT', label: 'BEST_EFFORT', weight: 0.4, hint: 'telemetry + metrics function uplink', latencyMaxMs: 200 },
] as const;

export type QosClassKey = (typeof QOS_CLASSES)[number]['key'];
export const QOS_CLASS_KEYS = QOS_CLASSES.map((c) => c.key) as readonly QosClassKey[];

/** Instance KPI shape (mirrors the Prisma row + live sim overlay). */
export interface InstanceKpi {
  code: string;
  deployment: string; // EDGE | CENTRAL
  site: string;
  region: string;
  engine: string;
  status: string; // ACTIVE | DEPLOYING | DRAINED
  gpuClass: string;
  cpuUtil: number; // 0..1
  gpuUtil: number; // 0..1
  memUtil: number; // 0..1
  baseLatencyMs: number;
  capacityGbps: number;
  costPerHour: number;
  sessions: number;
}

/** A client's parameterized Discovery Request (paper §IV-B3: KPIs "regarded
 *  to bandwidth or latency requirements but also to QoS classes or costs"). */
export interface DiscoveryRequest {
  clientId: string;
  maxLatencyMs: number;
  minBandwidthMbps: number;
  qosClass: QosClassKey;
  maxCostPerHour?: number | null;
}

export interface DiscoveryCandidate {
  code: string;
  site: string;
  deployment: string;
  hardPass: boolean;
  violations: string[];
  score: number; // 0..100 (only meaningful when hardPass)
  breakdown: Array<{ label: string; points: number; detail: string }>;
}

export interface DiscoveryOutcome {
  matched: DiscoveryCandidate | null;
  candidates: DiscoveryCandidate[];
  reason: string;
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Score one instance against a discovery request.
 *
 * Hard gate (paper: instance must "fulfil certain KPIs"):
 *   status ACTIVE · latency ≤ max · capacity ≥ min · cost ≤ max (when set).
 * Soft score 0-100 — latency margin 40 + compute headroom 30 + cost 20 +
 * edge bonus 10 (the paper favours edge: "run the rendering instances close
 * to the consumer device").
 */
export function scoreInstance(inst: InstanceKpi, req: DiscoveryRequest): DiscoveryCandidate {
  const violations: string[] = [];
  if (inst.status !== 'ACTIVE') violations.push(`status ${inst.status}`);
  if (inst.baseLatencyMs > req.maxLatencyMs) violations.push(`latency ${round2(inst.baseLatencyMs)}ms > ${req.maxLatencyMs}ms`);
  const capacityMbps = inst.capacityGbps * 1000;
  if (capacityMbps < req.minBandwidthMbps) violations.push(`capacity ${round2(capacityMbps)}Mbps < ${req.minBandwidthMbps}Mbps`);
  if (req.maxCostPerHour != null && inst.costPerHour > req.maxCostPerHour) violations.push(`cost R${round2(inst.costPerHour)}/h > R${round2(req.maxCostPerHour)}/h`);

  const hardPass = violations.length === 0;
  let score = 0;
  const breakdown: DiscoveryCandidate['breakdown'] = [];

  if (hardPass) {
    // Latency margin (40): full points when ≤ 60% of the budget.
    const latencyUse = clamp(inst.baseLatencyMs / Math.max(1, req.maxLatencyMs), 0, 1);
    const latencyPts = Math.round((1 - latencyUse) * 40);
    score += latencyPts;
    breakdown.push({
      label: 'LATENCY MARGIN',
      points: latencyPts,
      detail: `${round2(inst.baseLatencyMs)}ms of ${req.maxLatencyMs}ms budget · ${Math.round((1 - latencyUse) * 100)}% headroom`,
    });

    // Compute headroom (30): least-loaded CPU/GPU/mem mix.
    const load = clamp((inst.cpuUtil + inst.gpuUtil + inst.memUtil) / 3, 0, 1);
    const headPts = Math.round((1 - load) * 30);
    score += headPts;
    breakdown.push({
      label: 'COMPUTE HEADROOM',
      points: headPts,
      detail: `CPU ${Math.round(inst.cpuUtil * 100)}% · GPU ${Math.round(inst.gpuUtil * 100)}% · MEM ${Math.round(inst.memUtil * 100)}%`,
    });

    // Cost (20): cheapest ACTIVE candidate earns full points, relative.
    const costPts = 20 - Math.round(clamp(inst.costPerHour / 120, 0, 1) * 20);
    score += costPts;
    breakdown.push({
      label: 'COST EFFICIENCY',
      points: costPts,
      detail: `R${round2(inst.costPerHour)}/h · ${inst.gpuClass}`,
    });

    // Edge proximity (10): paper's edge-first posture.
    const edgePts = inst.deployment === 'EDGE' ? 10 : 4;
    score += edgePts;
    breakdown.push({
      label: 'EDGE PROXIMITY',
      points: edgePts,
      detail: inst.deployment === 'EDGE' ? 'edge cloud near the RAN' : 'central cloud · transport penalty',
    });
  }

  return {
    code: inst.code,
    site: inst.site,
    deployment: inst.deployment,
    hardPass,
    violations,
    score: clamp(score, 0, 100),
    breakdown,
  };
}

/** Rank the registry: hard-pass candidates by score desc; edge-first tiebreak. */
export function runDiscovery(instances: InstanceKpi[], req: DiscoveryRequest): DiscoveryOutcome {
  const candidates = instances
    .map((i) => scoreInstance(i, req))
    .sort((a, b) => {
      if (a.hardPass !== b.hardPass) return a.hardPass ? -1 : 1;
      if (b.score !== a.score) return b.score - a.score;
      if (a.deployment !== b.deployment) return a.deployment === 'EDGE' ? -1 : 1;
      return a.code.localeCompare(b.code);
    });
  const matched = candidates.find((c) => c.hardPass) ?? null;
  const reason = matched
    ? `matched ${matched.code} · score ${matched.score}/100 · ${candidates.filter((c) => c.hardPass).length} of ${candidates.length} instances pass KPIs`
    : candidates.length === 0
      ? 'registry empty'
      : `no instance satisfies KPIs — ${candidates[0]?.violations.slice(0, 2).join('; ') ?? 'no candidates'}`;
  return { matched, candidates, reason };
}

// ─── §IV-D — QoE alignment: P.1203-inspired MOS prediction ──────────────────
// The paper builds a "prediction model, relating QoE indicators with
// service-related KPIs" on the ITU-T P.1203/P.1204 conceptual basis. This
// surrogate keeps the structure (additive impairment on the 5-point ACR
// scale) with closed-form penalties: latency (interactive MTP), stall
// (freezing), loss (artifacts), plus a codec/resolution term.

export interface QoeInputs {
  latencyMs: number; // end-to-end MTP
  jitterMs: number;
  lossPct: number; // 0..100
  stallMs: number; // accumulated freezing in the last window
  codec?: string; // H265 | AV1 | VP9 (resolution term below is codec-agnostic)
}

export interface QoeResult {
  mos: number; // 1..5
  penalties: Array<{ label: string; points: number; detail: string }>;
  band: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'BAD';
  constructs: { coPresence: number; immersion: number; realism: number };
}

export function predictMos(input: QoeInputs): QoeResult {
  const latency = Math.max(0, input.latencyMs);
  const jitter = Math.max(0, input.jitterMs);
  const loss = clamp(input.lossPct, 0, 100);
  const stall = Math.max(0, input.stallMs);

  // Latency: no penalty ≤ 20ms (6G target), then a log-shaped impairment —
  // at 40ms ≈ -0.5, at 80ms ≈ -1.35, at 150ms ≈ -2.3 (conversation breakdown).
  const latencyPenalty = latency <= 20 ? 0 : 0.62 * Math.log2(latency / 20);
  // Jitter: manifests as micro-stalls; -0.12 per ms above 1ms, capped -1.2.
  const jitterPenalty = Math.min(1.2, Math.max(0, jitter - 1) * 0.12);
  // Loss: artifacts + concealment; -0.09 per 1% above 0.5%, capped -2.2.
  const lossPenalty = Math.min(2.2, Math.max(0, loss - 0.5) * 0.09);
  // Stall (freezing): -0.05 per 10ms, capped -1.5 (paper: "blurring,
  // freezing … negatively impact the user experience").
  const stallPenalty = Math.min(1.5, (stall / 10) * 0.05);

  const mos = clamp(5 - latencyPenalty - jitterPenalty - lossPenalty - stallPenalty, 1, 5);
  const band: QoeResult['band'] = mos >= 4.3 ? 'EXCELLENT' : mos >= 3.8 ? 'GOOD' : mos >= 3.0 ? 'FAIR' : mos >= 2.0 ? 'POOR' : 'BAD';

  // Conversational constructs (paper §IV-D questionnaires: co-presence,
  // immersion, realism) — derived views over the same penalties.
  const coPresence = clamp(5 - latencyPenalty * 1.15 - jitterPenalty * 1.3, 1, 5);
  const immersion = clamp(5 - stallPenalty * 1.8 - lossPenalty * 0.9, 1, 5);
  const realism = clamp(5 - lossPenalty * 1.25 - jitterPenalty * 0.8, 1, 5);

  return {
    mos: round2(mos),
    penalties: [
      { label: 'LATENCY', points: round2(latencyPenalty), detail: `${round2(latency)}ms MTP` },
      { label: 'JITTER', points: round2(jitterPenalty), detail: `${round2(jitter)}ms` },
      { label: 'LOSS', points: round2(lossPenalty), detail: `${round2(loss)}%` },
      { label: 'STALL', points: round2(stallPenalty), detail: `${round2(stall)}ms frozen` },
    ],
    band,
    constructs: {
      coPresence: round2(coPresence),
      immersion: round2(immersion),
      realism: round2(realism),
    },
  };
}

// ─── §IV-E — QoS prediction surrogate (offline/online phases) ───────────────
// The paper trains LSTM/DRL models offline on monitoring data, then answers
// online prediction requests over a horizon. This sandbox surrogate: EMA
// smoothing + weighted linear regression over the last N samples, with a
// widening confidence band — deterministic, dependency-free, honest about
// being a stand-in (the UI labels it exactly that).

export interface QosPoint {
  t: number; // sample index
  value: number;
}

export interface QosPrediction {
  horizon: number;
  predicted: number[]; // next `horizon` values
  confidence: number[]; // ± band per predicted point
  trendPerStep: number;
  ema: number;
}

export function predictQos(values: number[], horizon = 10, emaAlpha = 0.35): QosPrediction {
  const n = values.length;
  if (n === 0) {
    return { horizon, predicted: [], confidence: [], trendPerStep: 0, ema: 0 };
  }
  // EMA over the window (online "current state" estimate).
  let ema = values[0];
  for (let i = 1; i < n; i++) ema = emaAlpha * values[i] + (1 - emaAlpha) * ema;

  // Weighted least-squares slope (recent samples dominate): x = 0..n−1.
  const w = (i: number): number => i + 1;
  let sw = 0;
  let swx = 0;
  let swy = 0;
  for (let i = 0; i < n; i++) {
    sw += w(i);
    swx += w(i) * i;
    swy += w(i) * values[i];
  }
  const xBar = swx / sw;
  const yBar = swy / sw;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += w(i) * (i - xBar) * (values[i] - yBar);
    den += w(i) * (i - xBar) * (i - xBar);
  }
  const slope = den === 0 ? 0 : num / den;

  // Residual scatter drives the confidence band (widens with horizon).
  const residuals = values.map((v, i) => Math.abs(v - (yBar + slope * (i - (n - 1)))));
  const scatter = residuals.length ? Math.sqrt(residuals.reduce((a, r) => a + r * r, 0) / residuals.length) : 0;

  const predicted: number[] = [];
  const confidence: number[] = [];
  for (let h = 1; h <= horizon; h++) {
    predicted.push(round2(ema + slope * h));
    confidence.push(round2(clamp(scatter * (0.6 + 0.35 * h), 0.05, 999)));
  }
  return { horizon, predicted, confidence, trendPerStep: round2(slope), ema: round2(ema) };
}

// ─── §IV-E — Two-stage FEC + fountain coding rate ───────────────────────────
// Stage 1 FEC turns the wireless channel into a packet-erasure channel; stage 2
// fountain (rateless) coding generates an arbitrary number of sub-codewords —
// "the coding rate can be adjusted on the fly" to meet the required
// reliability. Closed form: with per-symbol erasure p and target decode
// success R, the expected extra symbols per k payload symbols is
//   extra = ceil( ln(1−R) / ln(p) )  →  rate = k / (k+extra)

export interface FountainResult {
  payloadSymbols: number;
  extraSymbols: number;
  transmittedSymbols: number;
  codingRate: number; // k/(k+extra), 0..1
  overheadPct: number;
  targetReliability: number;
  lossPct: number;
  achievableReliability: number; // model: 1 − p^(extra+1)
  meetsTarget: boolean;
}

export function fountainCoding(lossPct: number, targetReliability = 0.999, payloadSymbols = 16): FountainResult {
  const k = Math.max(1, Math.round(payloadSymbols));
  const R = clamp(targetReliability, 0.5, 0.999999);
  const p = clamp(Math.max(lossPct, 1e-4) / 100, 1e-6, 0.95);
  const extra = p >= 0.95 ? 8 * k : Math.max(0, Math.ceil(Math.log(1 - R) / Math.log(p)));
  const transmitted = k + extra;
  const rate = transmitted === 0 ? 0 : round2(k / transmitted);
  const achievable = round4(1 - Math.pow(p, extra + 1));
  return {
    payloadSymbols: k,
    extraSymbols: extra,
    transmittedSymbols: transmitted,
    codingRate: rate,
    overheadPct: Math.round((extra / k) * 100),
    targetReliability: R,
    lossPct: round2(clamp(lossPct, 0, 100)),
    achievableReliability: achievable,
    meetsTarget: achievable >= R - 1e-9,
  };
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

// ─── coercion helpers (API boundary — mirror lead-scoring.ts) ───────────────

export function toNumOrNull(v: unknown, lo: number, hi: number): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  return clamp(Math.round(n * 100) / 100, lo, hi);
}

export function toIntOrNull(v: unknown, lo: number, hi: number): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.round(clamp(n, lo, hi));
}

export function toQosClassOrNull(v: unknown): QosClassKey | null {
  return typeof v === 'string' && (QOS_CLASS_KEYS as readonly string[]).includes(v.toUpperCase())
    ? (v.toUpperCase() as QosClassKey)
    : null;
}
