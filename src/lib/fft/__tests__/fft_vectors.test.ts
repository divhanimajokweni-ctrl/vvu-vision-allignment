/**
 * VVU FFT Integrity — TypeScript test vectors.
 *
 * This is a standalone runnable test script (no vitest/jest dependency, per
 * the Golden Rule). Run with:
 *   bun  src/lib/fft/__tests__/fft_vectors.test.ts
 *   # or: npx tsx src/lib/fft/__tests__/fft_vectors.test.ts
 *
 * Each test vector is a pure sine wave at a known frequency, plus a baseline.
 * The peak frequency returned by `predictiveWatchdog` must match the input
 * frequency within one bin width (fs/N). The Nyquist vector asserts that a
 * 60 Hz tone sampled at fs=100 does NOT appear at 60 Hz. The two baseline
 * vectors assert that missing or < 72h baselines return INCONCLUSIVE.
 *
 * The script prints a JSON array at the end so it can be diffed against the
 * output of `parity_check.py`.
 */

import { predictiveWatchdog, THRESHOLD_RULE } from '../predictiveWatchdog';

interface CaseResult {
  name: string;
  pass: boolean;
  expected?: unknown;
  actual?: unknown;
  binWidth?: number;
  verdict?: string;
  reason?: string;
}

const FS = 100; // Hz
const N = 1024; // samples (power of two)
const BIN_WIDTH = FS / N; // 0.09765625 Hz

function sineWave(freqHz: number, fs: number, n: number, amplitude = 1): number[] {
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    out[i] = amplitude * Math.sin((2 * Math.PI * freqHz * i) / fs);
  }
  return out;
}

const results: CaseResult[] = [];

// ---- Test 1: 5 Hz sine --------------------------------------------------
{
  const frame = sineWave(5, FS, N);
  const baseline = sineWave(5, FS, N);
  const r = predictiveWatchdog({ frame, baseline, fs: FS, baselineHours: 100 }) as any;
  const pass = Math.abs(r.peakHz - 5) <= BIN_WIDTH;
  results.push({
    name: 'Test 1: 5 Hz sine peak at ~5 Hz within one bin width',
    pass,
    expected: 5,
    actual: r.peakHz,
    binWidth: BIN_WIDTH,
    verdict: r.verdict,
  });
}

// ---- Test 2: 14.2 Hz sine -----------------------------------------------
{
  const frame = sineWave(14.2, FS, N);
  const baseline = sineWave(14.2, FS, N);
  const r = predictiveWatchdog({ frame, baseline, fs: FS, baselineHours: 100 }) as any;
  const pass = Math.abs(r.peakHz - 14.2) <= BIN_WIDTH;
  results.push({
    name: 'Test 2: 14.2 Hz sine peak at ~14.2 Hz within one bin width',
    pass,
    expected: 14.2,
    actual: r.peakHz,
    binWidth: BIN_WIDTH,
    verdict: r.verdict,
  });
}

// ---- Test 3: 30 Hz sine -------------------------------------------------
{
  const frame = sineWave(30, FS, N);
  const baseline = sineWave(30, FS, N);
  const r = predictiveWatchdog({ frame, baseline, fs: FS, baselineHours: 100 }) as any;
  const pass = Math.abs(r.peakHz - 30) <= BIN_WIDTH;
  results.push({
    name: 'Test 3: 30 Hz sine peak at ~30 Hz within one bin width',
    pass,
    expected: 30,
    actual: r.peakHz,
    binWidth: BIN_WIDTH,
    verdict: r.verdict,
  });
}

// ---- Test 4: Nyquist / aliasing -----------------------------------------
// A 60 Hz tone at fs=100 is above Nyquist (50 Hz). It must NOT appear at
// 60 Hz. It aliases to fs - 60 = 40 Hz, so the peak should be at ~40 Hz.
{
  const frame = sineWave(60, FS, N);
  const baseline = sineWave(60, FS, N);
  const r = predictiveWatchdog({ frame, baseline, fs: FS, baselineHours: 100 }) as any;
  const notAt60 = Math.abs(r.peakHz - 60) > BIN_WIDTH;
  const aliasHz = FS - 60; // 40 Hz
  const atAlias = Math.abs(r.peakHz - aliasHz) <= BIN_WIDTH;
  const pass = notAt60 && atAlias;
  results.push({
    name: 'Test 4: 60 Hz tone at fs=100 must NOT appear at 60 Hz (aliasing)',
    pass,
    expected: aliasHz,
    actual: r.peakHz,
    binWidth: BIN_WIDTH,
    verdict: r.verdict,
  });
}

// ---- Test 5: Missing baseline -------------------------------------------
{
  const frame = sineWave(5, FS, N);
  const r = predictiveWatchdog({
    frame,
    baseline: null,
    fs: FS,
    baselineHours: 0,
  }) as any;
  const pass =
    r.verdict === 'INCONCLUSIVE' &&
    r.reason === 'baseline_missing' &&
    r.peakHz === undefined &&
    r.deviation === undefined &&
    r.baselineStatistic === undefined;
  results.push({
    name: 'Test 5: Missing baseline -> INCONCLUSIVE (baseline_missing)',
    pass,
    expected: { verdict: 'INCONCLUSIVE', reason: 'baseline_missing' },
    actual: { verdict: r.verdict, reason: r.reason },
    verdict: r.verdict,
    reason: r.reason,
  });
}

// ---- Test 6: Baseline < 72h ---------------------------------------------
{
  const frame = sineWave(5, FS, N);
  const baseline = sineWave(5, FS, N);
  const r = predictiveWatchdog({
    frame,
    baseline,
    fs: FS,
    baselineHours: 10,
  }) as any;
  const pass =
    r.verdict === 'INCONCLUSIVE' &&
    r.reason === 'baseline_too_short' &&
    r.baselineHours === 10 &&
    r.peakHz === undefined &&
    r.deviation === undefined &&
    r.baselineStatistic === undefined;
  results.push({
    name: 'Test 6: Baseline < 72h -> INCONCLUSIVE (baseline_too_short)',
    pass,
    expected: { verdict: 'INCONCLUSIVE', reason: 'baseline_too_short', baselineHours: 10 },
    actual: { verdict: r.verdict, reason: r.reason, baselineHours: r.baselineHours },
    verdict: r.verdict,
    reason: r.reason,
  });
}

// ---- Report -------------------------------------------------------------
const passed = results.filter((r) => r.pass).length;
const failed = results.length - passed;

console.log('=== TypeScript FFT Vectors Test Results ===');
console.log(`window=Hann  fs=${FS}  N=${N}  binWidthHz=${BIN_WIDTH}`);
console.log(`thresholdRule: ${THRESHOLD_RULE}`);
console.log('');
for (const r of results) {
  const tag = r.pass ? 'PASS' : 'FAIL';
  console.log(`[${tag}] ${r.name}`);
  if (typeof r.actual === 'number' && typeof r.expected === 'number') {
    console.log(
      `        actual=${r.actual.toFixed(6)} Hz  expected=${r.expected} Hz  ` +
        `binWidth=${(r.binWidth ?? 0).toFixed(6)} Hz  verdict=${r.verdict ?? 'n/a'}`,
    );
  } else if (r.actual !== undefined) {
    console.log(`        actual=${JSON.stringify(r.actual)}  expected=${JSON.stringify(r.expected)}`);
  }
}
console.log('');
console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);

// JSON array for cross-language diffing.
console.log('');
console.log('=== JSON ARRAY (for parity diff) ===');
console.log(JSON.stringify(results, null, 2));

if (typeof process !== 'undefined' && typeof process.exit === 'function') {
  process.exit(failed === 0 ? 0 : 1);
}
