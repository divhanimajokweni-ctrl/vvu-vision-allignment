/**
 * VVU Predictive FFT Watchdog — TypeScript implementation.
 *
 * Spectral integrity rules (per vvu-fft-integrity SKILL.md):
 *   - Frequency mapping is `f_k = k * fs / N`. No hardcoded multiplier is
 *     used (the multiplier is always `fs / N`, derived from the input).
 *   - A Hann window is applied before the FFT.
 *   - The window, fs, N, and bin width (fs/N) are stated in every output.
 *   - No probability is ever produced. The output contains the peak, the
 *     baseline statistic, the deviation, and the verdict only.
 *   - A missing or < 72h baseline returns INCONCLUSIVE with the reason.
 *     No probability, no peak, no verdict beyond INCONCLUSIVE.
 *
 * This is a zero-dependency module. The FFT is a hand-written iterative
 * radix-2 Cooley-Tukey implementation (no npm dependency, per the Golden
 * Rule). The Python parity module (vvu_predictive_watchdog.py) uses numpy
 * and must produce the same peak frequencies within one bin width.
 *
 * Out of bounds (per SKILL.md): training or claiming a predictive model
 * belongs to vvu-academic-validation. This module does NOT claim clinical
 * validity; it reports a spectral observation and a single threshold.
 */

export type WatchdogVerdict = 'NOMINAL' | 'ANOMALY' | 'INCONCLUSIVE';
export type InconclusiveReason = 'baseline_missing' | 'baseline_too_short';

export interface PredictiveWatchdogInput {
  /** Current telemetry frame. Length need not be a power of two; it is
   *  zero-padded to the next power of two for the radix-2 FFT. */
  frame: number[];
  /** Historical baseline representative window. Pass `null` when no baseline
   *  exists — the watchdog will return INCONCLUSIVE with `baseline_missing`. */
  baseline: number[] | null;
  /** Sample rate in Hz for BOTH the frame and the baseline. */
  fs: number;
  /** Duration of the baseline in hours. Caller-provided metadata; the
   *  watchdog does NOT derive it from `baseline.length` because the baseline
   *  array is a representative window, not the full historical record. */
  baselineHours: number;
}

export interface InconclusiveResult {
  verdict: 'INCONCLUSIVE';
  reason: InconclusiveReason;
  baselineHours: number;
}

export interface NominalOrAnomalyResult {
  verdict: 'NOMINAL' | 'ANOMALY';
  /** Peak frequency of the current frame, in Hz. Computed as `k * fs / N`. */
  peakHz: number;
  /** Baseline statistic: the peak FFT magnitude of the baseline window.
   *  Same units as the (un-normalised) FFT magnitude. */
  baselineStatistic: number;
  /** Signed relative deviation of the current peak magnitude from the
   *  baseline statistic: `(current - baseline) / baseline`. */
  deviation: number;
  /** Window function applied before the FFT. Always 'Hann' (periodic). */
  window: 'Hann';
  /** Sample rate in Hz. */
  fs: number;
  /** FFT length used (next power of two >= frame.length). */
  N: number;
  /** Bin width in Hz: `fs / N`. */
  binWidthHz: number;
  /** Human-readable statement of the threshold rule used for the verdict. */
  thresholdRule: string;
}

export type PredictiveWatchdogResult =
  | InconclusiveResult
  | NominalOrAnomalyResult;

/** Minimum baseline duration, in hours, required to produce a verdict. */
export const BASELINE_MIN_HOURS = 72;

/** Verdict threshold: |deviation| above this ratio (50%) => ANOMALY. */
export const DEVIATION_THRESHOLD = 0.5;

/** Threshold rule as a string, stated in every non-INCONCLUSIVE output. */
export const THRESHOLD_RULE =
  `|deviation| > ${DEVIATION_THRESHOLD} (i.e. > 50% from baseline peak ` +
  `magnitude) => ANOMALY; otherwise NOMINAL`;

/**
 * Periodic Hann window of length N: `w[n] = 0.5 - 0.5*cos(2*pi*n/N)`.
 *
 * The periodic (a.k.a. DFT-even) variant is used instead of the symmetric
 * variant `0.5 - 0.5*cos(2*pi*n/(N-1))` because it is the correct window to
 * apply before an FFT of length N (it places the window's periodic replicas
 * seamlessly). The Python parity module uses the same definition.
 */
export function hannWindow(N: number): Float64Array {
  const w = new Float64Array(N);
  const twoPiOverN = (2 * Math.PI) / N;
  for (let n = 0; n < N; n++) {
    w[n] = 0.5 - 0.5 * Math.cos(twoPiOverN * n);
  }
  return w;
}

/** Smallest power of two >= n. */
function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/**
 * In-place iterative radix-2 Cooley-Tukey FFT.
 *
 * Modifies `re` and `im` in place. Length must be a power of two. Forward
 * transform (sign = -1 on the exponent), un-normalised — i.e. the output is
 * `sum_{n=0}^{N-1} x[n] * exp(-2*pi*i*k*n/N)`. The magnitude comparison in
 * this module does not require normalisation, so we skip it for speed.
 */
function fftRadix2(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (n <= 1) return;
  if ((n & (n - 1)) !== 0) {
    throw new Error(`fftRadix2: length ${n} is not a power of two`);
  }

  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) {
      j ^= bit;
    }
    j ^= bit;
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }

  // Butterfly stages: len = 2, 4, 8, ..., N.
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const ang = (-2 * Math.PI) / len;
    const wlenRe = Math.cos(ang);
    const wlenIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wRe = 1;
      let wIm = 0;
      for (let k = 0; k < half; k++) {
        const aRe = re[i + k];
        const aIm = im[i + k];
        const bRe = re[i + k + half];
        const bIm = im[i + k + half];
        // v = b * w
        const vRe = bRe * wRe - bIm * wIm;
        const vIm = bRe * wIm + bIm * wRe;
        re[i + k] = aRe + vRe;
        im[i + k] = aIm + vIm;
        re[i + k + half] = aRe - vRe;
        im[i + k + half] = aIm - vIm;
        // w *= wlen  (complex multiply, preserve old wRe for wIm update)
        const newWRe = wRe * wlenRe - wIm * wlenIm;
        const newWIm = wRe * wlenIm + wIm * wlenRe;
        wRe = newWRe;
        wIm = newWIm;
      }
    }
  }
}

interface SpectralPeak {
  peakBin: number;
  peakHz: number;
  peakMagnitude: number;
  N: number;
}

/**
 * Compute the spectral peak of a real-valued signal.
 *
 * Steps:
 *   1. Zero-pad `signal` to the next power of two, N.
 *   2. Apply a periodic Hann window of length N.
 *   3. Run the radix-2 FFT.
 *   4. Find the bin k in [1, N/2] (excluding DC) with the largest magnitude.
 *   5. Return peakHz = k * fs / N. No hardcoded multiplier is used.
 */
function spectralPeak(signal: number[], fs: number): SpectralPeak {
  const L = signal.length;
  const N = nextPow2(L);
  const w = hannWindow(N);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let i = 0; i < L; i++) {
    re[i] = signal[i] * w[i];
  }
  // (positions L..N-1 stay zero — zero padding)
  fftRadix2(re, im);

  const nyqBin = N >> 1; // N/2, inclusive
  let peakBin = 1;
  let peakMag = -Infinity;
  for (let k = 1; k <= nyqBin; k++) {
    const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
    if (mag > peakMag) {
      peakMag = mag;
      peakBin = k;
    }
  }
  return {
    peakBin,
    peakHz: (peakBin * fs) / N, // f_k = k * fs / N  (CORRECT mapping)
    peakMagnitude: peakMag,
    N,
  };
}

/**
 * Run the predictive FFT watchdog.
 *
 * Returns INCONCLUSIVE when the baseline is missing or shorter than 72h.
 * Otherwise returns NOMINAL or ANOMALY plus the peak frequency, baseline
 * statistic, signed deviation, and the window/fs/N/binWidth metadata.
 */
export function predictiveWatchdog(
  input: PredictiveWatchdogInput,
): PredictiveWatchdogResult {
  const { frame, baseline, fs, baselineHours } = input;

  // Baseline gate. No probability, no peak, no verdict beyond INCONCLUSIVE.
  if (baseline == null) {
    return {
      verdict: 'INCONCLUSIVE',
      reason: 'baseline_missing',
      baselineHours: 0,
    };
  }
  if (baselineHours < BASELINE_MIN_HOURS) {
    return {
      verdict: 'INCONCLUSIVE',
      reason: 'baseline_too_short',
      baselineHours,
    };
  }

  // Spectral peak of the current frame.
  const framePeak = spectralPeak(frame, fs);
  const N = framePeak.N;

  // Spectral peak of the baseline. We use the same FFT length N for parity
  // with the Python implementation. The baseline array is treated as a
  // representative window; if it is shorter than N, it is zero-padded.
  const baselineSlice: number[] = new Array(N).fill(0);
  const copyLen = Math.min(baseline.length, N);
  for (let i = 0; i < copyLen; i++) baselineSlice[i] = baseline[i];
  const baselinePeak = spectralPeak(baselineSlice, fs);

  const baselineStatistic = baselinePeak.peakMagnitude;
  const deviation =
    baselineStatistic > 0
      ? (framePeak.peakMagnitude - baselineStatistic) / baselineStatistic
      : 0;
  const verdict: 'NOMINAL' | 'ANOMALY' =
    Math.abs(deviation) > DEVIATION_THRESHOLD ? 'ANOMALY' : 'NOMINAL';

  return {
    verdict,
    peakHz: framePeak.peakHz,
    baselineStatistic,
    deviation,
    window: 'Hann',
    fs,
    N,
    binWidthHz: fs / N,
    thresholdRule: THRESHOLD_RULE,
  };
}
