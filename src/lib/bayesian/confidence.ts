/**
 * Beta-Binomial Bayesian Confidence Scoring
 *
 * Implements Bayesian confidence scoring using the Beta-Binomial model.
 * Prior: Beta(α₀, β₀) — default uniform Beta(1,1)
 * After n trials with k successes: posterior Beta(α₀+k, β₀+n-k)
 *
 * Sub-millisecond: all operations are closed-form O(1). No network calls,
 * no special functions, no lookup tables. Normal approximation for credible
 * intervals (accurate for n ≥ 10, conservative for small n).
 *
 * Circuit breaker integration: if the lower bound of the 95% credible
 * interval falls below the threshold, the circuit breaker trips.
 */
export interface BayesianState {
  alpha: number; // prior α (successes + prior)
  beta: number;  // prior β (failures + prior)
  n: number;     // total trials
  k: number;     // total successes
}

export interface ConfidenceResult {
  posteriorMean: number;     // E[θ | data] = (α+k)/(α+β+n)
  posteriorVariance: number; // Var[θ | data]
  credibleIntervalLow: number;  // 95% credible interval lower bound
  credibleIntervalHigh: number; // 95% credible interval upper bound
  confidence: number;          // posterior mean (point estimate)
  shouldTrip: boolean;         // true if credibleIntervalLow < threshold
  elapsedUs: number;           // microseconds elapsed (for latency verification)
}

const DEFAULT_PRIOR_ALPHA = 1; // uniform prior
const DEFAULT_PRIOR_BETA = 1;
const Z_95 = 1.959963984540054; // 95% normal quantile
const DEFAULT_THRESHOLD = 0.95;

export class BayesianConfidence {
  private state: BayesianState;
  private threshold: number;

  constructor(priorAlpha = DEFAULT_PRIOR_ALPHA, priorBeta = DEFAULT_PRIOR_BETA, threshold = DEFAULT_THRESHOLD) {
    this.state = { alpha: priorAlpha, beta: priorBeta, n: 0, k: 0 };
    this.threshold = threshold;
  }

  /** Record a trial outcome. O(1). */
  record(success: boolean): void {
    this.state.n++;
    if (success) this.state.k++;
  }

  /** Record multiple outcomes at once. O(m) where m = outcomes.length. */
  recordBatch(outcomes: boolean[]): void {
    for (const o of outcomes) {
      this.state.n++;
      if (o) this.state.k++;
    }
  }

  /** Compute confidence score. O(1), sub-millisecond. */
  score(): ConfidenceResult {
    const t0 = performance.now();
    const { alpha, beta, n, k } = this.state;
    const posteriorAlpha = alpha + k;
    const posteriorBeta = beta + (n - k);
    const posteriorN = alpha + beta + n;

    // Posterior mean: E[θ | data]
    const posteriorMean = posteriorAlpha / posteriorN;

    // Posterior variance: Var[θ | data] = αβ / (N²(N+1))
    const posteriorVariance = (posteriorAlpha * posteriorBeta) / (posteriorN * posteriorN * (posteriorN + 1));

    // Standard deviation
    const sigma = Math.sqrt(posteriorVariance);

    // 95% credible interval (normal approximation)
    const ciLow = Math.max(0, posteriorMean - Z_95 * sigma);
    const ciHigh = Math.min(1, posteriorMean + Z_95 * sigma);

    // Circuit breaker trips if lower bound of credible interval < threshold
    const shouldTrip = ciLow < this.threshold;

    const elapsedUs = (performance.now() - t0) * 1000;

    return {
      posteriorMean,
      posteriorVariance,
      credibleIntervalLow: ciLow,
      credibleIntervalHigh: ciHigh,
      confidence: posteriorMean,
      shouldTrip,
      elapsedUs,
    };
  }

  /** Get current state (for serialization / on-chain anchoring). */
  getState(): BayesianState {
    return { ...this.state };
  }

  /** Reset state (new session). */
  reset(): void {
    this.state = { alpha: this.state.alpha, beta: this.state.beta, n: 0, k: 0 };
  }

  /** Set threshold. */
  setThreshold(threshold: number): void {
    this.threshold = Math.max(0, Math.min(1, threshold));
  }

  /** Get threshold. */
  getThreshold(): number {
    return this.threshold;
  }
}

/**
 * Fast-path: Wilson score interval lower bound.
 * Even faster than Beta-Binomial (no variance computation).
 * Use for ultra-low-latency circuit breaker checks (< 100μs).
 */
export function wilsonScoreLowerBound(successes: number, trials: number, z = Z_95): number {
  if (trials === 0) return 0;
  const p = successes / trials;
  const z2 = z * z;
  const denom = 1 + z2 / trials;
  const center = p + z2 / (2 * trials);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * trials)) / trials);
  return Math.max(0, (center - margin) / denom);
}

/**
 * Compute confidence from raw counts (stateless, for one-off checks).
 * Sub-millisecond: single function call, no object allocation.
 */
export function computeConfidence(
  successes: number,
  trials: number,
  priorAlpha = DEFAULT_PRIOR_ALPHA,
  priorBeta = DEFAULT_PRIOR_BETA,
  threshold = DEFAULT_THRESHOLD
): { confidence: number; shouldTrip: boolean; elapsedUs: number } {
  const t0 = performance.now();
  const posteriorAlpha = priorAlpha + successes;
  const posteriorBeta = priorBeta + (trials - successes);
  const posteriorN = priorAlpha + priorBeta + trials;
  const mean = posteriorAlpha / posteriorN;
  const variance = (posteriorAlpha * posteriorBeta) / (posteriorN * posteriorN * (posteriorN + 1));
  const sigma = Math.sqrt(variance);
  const ciLow = Math.max(0, mean - Z_95 * sigma);
  const elapsedUs = (performance.now() - t0) * 1000;
  return { confidence: mean, shouldTrip: ciLow < threshold, elapsedUs };
}
