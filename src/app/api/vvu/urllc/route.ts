import { NextRequest, NextResponse } from 'next/server';
import { appendWormEvent } from '@/lib/vvu-ledger';
import {
  DTL_TARGET_ETA,
  ERR_SUPERVISED,
  ERR_UNSUPERVISED,
  KA_FC_HZ,
  MARGIN_MAX_PCT,
  MARGIN_MIN_PCT,
  MODEL_MAX_DOPPLER_HZ,
  PARADIGM_MATRIX,
  RELIABILITY_TARGET,
  SCHEDULERS,
  SPECTRUM_BUDGET_HZ,
  TIME_WARPS,
  TR38811_DOPPLER_HZ,
  V_SAT_KMS,
  clampInt,
  dtlAccuracy,
  dtlCurve,
  dtlFlopBudget,
  effectiveMs,
  fnnParameterCounts,
  passStateAtEffectiveMs,
  runPrimalDual,
  scheduledPacketLoss,
  toWarpOrNull,
  waveformRows,
  type OptUserInput,
  type TimeWarp,
  type WaveformKey,
  type WaveformRow,
} from '@/lib/urllc';
import type {
  UrllcDtlRunResponse,
  UrllcOptRunResponse,
  UrllcResponse,
  UrllcSnapshot,
} from '@/types/vvu';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Round 28 — URLLC+ NEURAL EDGE API (6G URLLC paper projection).
// Server-authoritative posture, same as holocom/outreach:
//   · every optimizer/DTL result is RECOMPUTED here via src/lib/urllc.ts
//     (pure module) — client values are advisory previews only;
//   · every committed lab run appends a WORM event (source 'URLLC');
//   · the LEO pass state is a deterministic pure function of warp-scaled
//     wall clock — identical across simultaneous requests.

const DEFAULT_USERS: OptUserInput[] = [
  { snrDb: 10, demandBits: 24 },
  { snrDb: 8, demandBits: 16 },
  { snrDb: 6, demandBits: 16 },
  { snrDb: 4, demandBits: 12 },
  { snrDb: 2, demandBits: 8 },
  { snrDb: 0, demandBits: 8 },
];

function buildSnapshot(warp: TimeWarp, channel: 'TDL-A' | 'TDL-C'): UrllcSnapshot {
  const now = Date.now();
  const passState = passStateAtEffectiveMs(effectiveMs(now, warp));
  const waveforms: WaveformRow[] = waveformRows(passState.epsDoppler, channel);
  const schedLoss = waveforms.map((w) => ({
    waveform: w.key as string,
    ddpg: scheduledPacketLoss(passState.epsDoppler, channel, w.key, 'ddpg'),
    ddpgt: scheduledPacketLoss(passState.epsDoppler, channel, w.key, 'ddpgt'),
    kaddpg: scheduledPacketLoss(passState.epsDoppler, channel, w.key, 'kaddpg'),
  }));
  return {
    generatedAt: new Date(now).toISOString(),
    pass: passState,
    waveforms: { channel, rows: waveforms },
    schedLoss,
    dtl: { curve: dtlCurve(), target: DTL_TARGET_ETA },
    fnn: fnnParameterCounts(),
    matrix: PARADIGM_MATRIX,
    meta: {
      paper: 'Technical Comparative Analysis of Deep Learning Paradigms for 6G URLLC Systems',
      pillars: [
        '6G Extreme Connectivity',
        'URLLC+ (Intelligence-of-Everything)',
        'Native AI · Neural Edge',
        'Rel-19 regenerative NTN payloads',
      ],
      vSatKms: V_SAT_KMS,
      kaFcGhz: KA_FC_HZ / 1e9,
      tr38811DopplerKhz: TR38811_DOPPLER_HZ / 1e3,
      modelMaxDopplerKhz: Math.round(MODEL_MAX_DOPPLER_HZ) / 1e3,
      reliabilityTarget: RELIABILITY_TARGET,
      errSupervisedPct: Math.round(ERR_SUPERVISED * 1000) / 10,
      errUnsupervisedPct: Math.round(ERR_UNSUPERVISED * 1000) / 10,
      marginMinPct: MARGIN_MIN_PCT,
      marginMaxPct: MARGIN_MAX_PCT,
      spectrumBudgetKhz: SPECTRUM_BUDGET_HZ / 1e3,
      warp,
      timeWarps: TIME_WARPS,
      provenance: [
        {
          label: 'LEO pass geometry · Doppler · RTT',
          kind: 'REAL',
          note: 'circular-orbit central-angle math; computed max Doppler ≈ ±458 kHz at 20 GHz vs TR 38.811 ±480 kHz',
        },
        {
          label: 'Finite blocklength (C, V, n*, ε)',
          kind: 'REAL',
          note: 'normal approximation with closed-form inversion; Q⁻¹ via A&S 26.2.17 + bisection',
        },
        {
          label: 'Primal-dual optimizer',
          kind: 'REAL',
          note: 'dual ascent with closed-form inner b_k(λ), budget projection, convergence trace',
        },
        {
          label: 'FNN parameter arithmetic',
          kind: 'REAL',
          note: 'exact weight/bias counts from 40→800×4→20; frozen first three layers in S₁',
        },
        {
          label: 'DTL sample-efficiency curves',
          kind: 'CALIBRATED',
          note: 'surrogate shapes visualizing the paper-reported η_NN target at 100 samples',
        },
        {
          label: 'Waveform Doppler residuals',
          kind: 'CALIBRATED',
          note: 'CP-OFDM ICI = (π·ε_d)²/3 standard result; OTFS/AFDM residual κ; OCDM irreducible floor',
        },
        {
          label: 'Scheduler packet-loss model',
          kind: 'REPORTED',
          note: `paper-reported scheduler posture (${SCHEDULERS.kaddpg.label}) — SNR offset + delay-violation risk`,
        },
      ],
    },
  };
}

export async function GET(req: NextRequest) {
  const warpParam = toWarpOrNull(req.nextUrl.searchParams.get('warp'));
  const warp: TimeWarp = warpParam ?? 10;
  const channel: 'TDL-A' | 'TDL-C' =
    req.nextUrl.searchParams.get('channel') === 'TDL-C' ? 'TDL-C' : 'TDL-A';
  try {
    const data: UrllcResponse = { snapshot: buildSnapshot(warp, channel) };
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: 'URLLC snapshot failed', detail: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}

interface OptBody {
  action?: string;
  users?: Array<{ snrDb?: number; demandBits?: number }>;
  marginPct?: number;
  samples?: number;
}

export async function POST(req: NextRequest) {
  let body: OptBody;
  try {
    body = (await req.json()) as OptBody;
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  const action = body.action;

  // ── optimizer commit (server recompute + WORM) ──
  if (action === 'opt_run') {
    const rawUsers = Array.isArray(body.users) ? body.users.slice(0, 8) : DEFAULT_USERS;
    const users: OptUserInput[] = rawUsers.map((u) => ({
      snrDb: clampInt(u.snrDb, -10, 20, 5),
      demandBits: clampInt(u.demandBits, 8, 128, 24),
    }));
    const marginPct = clampInt(body.marginPct, 0, 5, 2);
    const run = runPrimalDual(users, marginPct);
    const worm = await appendWormEvent({
      source: 'URLLC',
      event: 'URLLC_OPT_RUN',
      details: `primal-dual · K=${users.length} · margin=${marginPct}% · ε=${run.epsTarget.toExponential(1)} · ΣB=${(run.totalBwHz / 1e3).toFixed(1)}kHz/${(SPECTRUM_BUDGET_HZ / 1e3).toFixed(0)}kHz · converged=${run.converged} · it=${run.iterationsUsed}`,
    });
    const res: UrllcOptRunResponse = {
      run,
      wormSeq: worm.seq,
      serverSolvedAt: new Date().toISOString(),
      advisoryWarning: 'client previews are advisory — this run was recomputed server-side',
    };
    return NextResponse.json(res, { status: 201 });
  }

  // ── DTL lab commit (server recompute + WORM) ──
  if (action === 'dtl_run') {
    const samples = clampInt(body.samples, 10, 20000, 100);
    const advisory = { scratch: dtlAccuracy('scratch', samples), dtl: dtlAccuracy('dtl', samples) };
    const target = DTL_TARGET_ETA;
    const verdict =
      advisory.dtl >= target ? 'DTL MEETS η_NN TARGET' : 'DTL BELOW TARGET — increase samples';
    const scratchVerdict =
      advisory.scratch >= target ? 'SCRATCH MEETS TARGET (atypical)' : 'SCRATCH FAILS TO CONVERGE';
    const flops = dtlFlopBudget(samples);
    const worm = await appendWormEvent({
      source: 'URLLC',
      event: 'URLLC_DTL_RUN',
      details: `S₁ fine-tune · samples=${samples} · η_dtl=${advisory.dtl.toFixed(3)} · η_scratch=${advisory.scratch.toFixed(3)} · trainable=${flops.paramCounts.trainable}/${flops.paramCounts.total} params (${flops.paramCounts.trainablePct.toFixed(1)}%) · flops=${flops.ratioPct}% of scratch`,
    });
    const res: UrllcDtlRunResponse = {
      samples,
      advisory,
      authoritative: {
        scratch: advisory.scratch,
        dtl: advisory.dtl,
        target,
        verdict: `${verdict} · ${scratchVerdict}`,
      },
      flops,
      wormSeq: worm.seq,
    };
    return NextResponse.json(res, { status: 201 });
  }

  return NextResponse.json(
    { error: 'unknown action', expected: 'opt_run | dtl_run' },
    { status: 400 },
  );
}
