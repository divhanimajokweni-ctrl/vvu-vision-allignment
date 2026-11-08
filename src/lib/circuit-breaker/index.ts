/**
 * Circuit Breaker — Security & Assurance Model Reinforcement
 *
 * Wires Beta-Binomial Bayesian confidence scoring with the on-chain
 * VVUAnchor slash function. When confidence drops below threshold,
 * the circuit breaker:
 *   1. Trips locally (fail-closed, immediate)
 *   2. Slashes the on-chain anchor (immutable record)
 *   3. Renders the architecture fail-safe (SENSOR_ABSENT / FAIL_CLOSED)
 *
 * Sub-millisecond latency: Bayesian scoring is O(1) closed-form.
 * On-chain slash is async (transaction) but the local trip is instant.
 *
 * Puter.js integration: free model inference via Puter.js provides the
 * trial outcomes (success/failure) that feed the Bayesian scorer.
 */
import { BayesianConfidence, computeConfidence, wilsonScoreLowerBound } from "@/lib/bayesian/confidence";
import { ethers } from "ethers";

export interface CircuitBreakerConfig {
  threshold: number;          // confidence threshold (0-1), default 0.95
  priorAlpha: number;         // Beta prior α, default 1
  priorBeta: number;         // Beta prior β, default 1
  onChainEnabled: boolean;    // whether to slash on-chain
  rpcUrl: string;            // Polygon Amoy RPC
  contractAddress: string;    // VVUAnchor address
  operatorKey: string;        // operator private key
  streamId: string;           // VVU stream ID
}

export interface TripResult {
  tripped: boolean;
  confidence: number;
  threshold: number;
  elapsedUs: number;
  onChainTxHash?: string;
  onChainError?: string;
  failSafeState: "NOMINAL" | "DEGRADED" | "FAIL_CLOSED";
}

export class CircuitBreaker {
  private scorer: BayesianConfidence;
  private config: CircuitBreakerConfig;
  private contract: ethers.Contract | null = null;
  private tripped: boolean = false;
  private tripCount: number = 0;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
    this.scorer = new BayesianConfidence(config.priorAlpha, config.priorBeta, config.threshold);

    if (config.onChainEnabled && config.contractAddress && config.operatorKey) {
      const provider = new ethers.JsonRpcProvider(config.rpcUrl, 80002);
      const wallet = new ethers.Wallet(config.operatorKey, provider);
      // ABI for tripCircuitBreaker + isSlashed
      const abi = [
        "function tripCircuitBreaker(bytes32 streamId, bytes32 anchorHash, uint256 confidenceMilli) external",
        "function isSlashed(bytes32 streamId, bytes32 anchorHash) external view returns (bool)",
        "function getThreshold(bytes32 streamId) external view returns (uint256)",
        "function getSlashCount(bytes32 streamId) external view returns (uint256)",
      ];
      this.contract = new ethers.Contract(config.contractAddress, abi, wallet);
    }
  }

  /** Record a trial outcome (success/failure from model inference). O(1). */
  record(success: boolean): void {
    this.scorer.record(success);
  }

  /** Record a batch of outcomes. O(m). */
  recordBatch(outcomes: boolean[]): void {
    this.scorer.recordBatch(outcomes);
  }

  /**
   * Evaluate confidence and trip circuit breaker if threshold breached.
   * Sub-millisecond: Bayesian scoring is O(1) closed-form.
   * On-chain slash is async (fire-and-forget, non-blocking).
   */
  async evaluate(anchorHash: string): Promise<TripResult> {
    const t0 = performance.now();
    const result = this.scorer.score();
    const elapsedUs = (performance.now() - t0) * 1000;

    if (result.shouldTrip && !this.tripped) {
      this.tripped = true;
      this.tripCount++;

      // Fire-and-forget on-chain slash (non-blocking, fail-safe)
      let onChainTxHash: string | undefined;
      let onChainError: string | undefined;

      if (this.config.onChainEnabled && this.contract) {
        const confidenceMilli = Math.round(result.confidence * 1000);
        const streamIdBytes = ethers.keccak256(ethers.toUtf8Bytes(this.config.streamId));

        // Non-blocking: don't await, don't block the circuit breaker
        this.contract.tripCircuitBreaker(streamIdBytes, anchorHash, confidenceMilli)
          .then((tx: any) => {
            console.log(`[CircuitBreaker] On-chain slash tx: ${tx.hash}`);
          })
          .catch((err: any) => {
            console.error(`[CircuitBreaker] On-chain slash failed: ${err.message}`);
          });
      }

      return {
        tripped: true,
        confidence: result.confidence,
        threshold: this.config.threshold,
        elapsedUs,
        onChainTxHash,
        onChainError,
        failSafeState: "FAIL_CLOSED",
      };
    }

    // Reset tripped state if confidence recovers
    if (!result.shouldTrip && this.tripped) {
      this.tripped = false;
    }

    return {
      tripped: this.tripped,
      confidence: result.confidence,
      threshold: this.config.threshold,
      elapsedUs,
      failSafeState: this.tripped ? "FAIL_CLOSED" : result.confidence < this.config.threshold + 0.02 ? "DEGRADED" : "NOMINAL",
    };
  }

  /** Fast-path: Wilson score check (even faster, for ultra-low-latency). */
  fastCheck(successes: number, trials: number): { shouldTrip: boolean; lowerBound: number } {
    const lowerBound = wilsonScoreLowerBound(successes, trials);
    return { shouldTrip: lowerBound < this.config.threshold, lowerBound };
  }

  /** Get current state. */
  getState(): { tripped: boolean; tripCount: number; threshold: number } {
    return { tripped: this.tripped, tripCount: this.tripCount, threshold: this.config.threshold };
  }

  /** Reset (for testing). */
  reset(): void {
    this.scorer.reset();
    this.tripped = false;
  }
}

/**
 * Puter.js Free Inference Integration
 *
 * Uses Puter.js for free model inference. Puter provides free access to
 * multiple AI models (GPT-4, Claude, etc.) without API keys.
 *
 * The inference results feed the Bayesian confidence scorer:
 * - Each inference is a trial (success = model output passes validation)
 * - The scorer tracks success/failure rates
 * - If confidence drops below threshold, circuit breaker trips
 */
export interface PuterInferenceConfig {
  model: string; // e.g. "gpt-4o", "claude-3-5-sonnet", "gemini-1.5-flash"
  maxTokens: number;
  temperature: number;
}

export interface InferenceResult {
  output: string;
  success: boolean;
  latencyMs: number;
  model: string;
}

export class PuterInference {
  private config: PuterInferenceConfig;
  private puter: any = null;

  constructor(config: PuterInferenceConfig) {
    this.config = config;
  }

  /** Initialize Puter.js (browser only). */
  async init(): Promise<boolean> {
    if (typeof window === "undefined") {
      console.warn("[PuterInference] Not in browser environment. Puter.js requires browser.");
      return false;
    }
    try {
      // Puter.js is loaded via script tag: <script src="https://js.puter.com/v2/"></script>
      this.puter = (window as any).puter;
      if (!this.puter) {
        console.error("[PuterInference] Puter.js not loaded. Add <script src='https://js.puter.com/v2/'></script>");
        return false;
      }
      return true;
    } catch (err) {
      console.error("[PuterInference] Init failed:", err);
      return false;
    }
  }

  /** Run inference via Puter.js. Returns output + success/failure. */
  async infer(prompt: string): Promise<InferenceResult> {
    const t0 = performance.now();
    if (!this.puter) {
      return { output: "", success: false, latencyMs: (performance.now() - t0), model: this.config.model };
    }

    try {
      const response = await this.puter.ai.chat(prompt, {
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
      });

      const output = typeof response === "string" ? response : response?.message?.content || "";
      // Success = output is non-empty and doesn't contain error markers
      const success = output.length > 0 && !output.toLowerCase().includes("error");

      return {
        output,
        success,
        latencyMs: performance.now() - t0,
        model: this.config.model,
      };
    } catch (err) {
      return {
        output: "",
        success: false,
        latencyMs: performance.now() - t0,
        model: this.config.model,
      };
    }
  }
}

/**
 * Full pipeline: Puter.js inference → Bayesian scoring → circuit breaker.
 * Sub-millisecond scoring (inference latency is network-bound, scoring is O(1)).
 */
export async function runInferencePipeline(
  breaker: CircuitBreaker,
  inference: PuterInference,
  prompt: string,
  anchorHash: string
): Promise<{ result: InferenceResult; trip: TripResult }> {
  const result = await inference.infer(prompt);
  breaker.record(result.success);
  const trip = await breaker.evaluate(anchorHash);
  return { result, trip };
}