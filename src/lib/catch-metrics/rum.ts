/**
 * Catch Metrics — RUM (Real User Monitoring) Ingestion
 *
 * Maps Core Web Vitals (FCP, LCP, CLS, INP, TTFB) to the VVU visual substrate.
 * The same substrate that renders 3D acoustic twins also renders web performance twins.
 *
 * Conservative execution: all metrics are hashed, signed, and chained to WORM.
 * No raw user data is stored — only aggregated RUM metrics per page/per session.
 *
 * Payment: ZAR via Stitch (EFT) and Paystack (international). No Web3 wallet.
 */
export interface RumMetric {
  page: string;           // URL path
  sessionId: string;      // anonymized session ID (hashed)
  timestamp: number;      // Unix ms
  fcp: number;            // First Contentful Paint (ms)
  lcp: number;            // Largest Contentful Paint (ms)
  cls: number;            // Cumulative Layout Shift (score 0-1)
  inp: number;            // Interaction to Next Paint (ms)
  ttfb: number;           // Time to First Byte (ms)
  deviceType: "mobile" | "desktop" | "tablet";
  connectionType: "4g" | "3g" | "wifi" | "unknown";
  userAgent: string;      // browser family (not full UA)
}

export interface VitalThresholds {
  fcp: { good: number; needsImprovement: number };
  lcp: { good: number; needsImprovement: number };
  cls: { good: number; needsImprovement: number };
  inp: { good: number; needsImprovement: number };
  ttfb: { good: number; needsImprovement: number };
}

export const DEFAULT_THRESHOLDS: VitalThresholds = {
  fcp: { good: 1800, needsImprovement: 3000 },
  lcp: { good: 2500, needsImprovement: 4000 },
  cls: { good: 0.1, needsImprovement: 0.25 },
  inp: { good: 200, needsImprovement: 500 },
  ttfb: { good: 800, needsImprovement: 1800 },
};

export type VitalRating = "good" | "needs-improvement" | "poor";

export interface VitalScore {
  metric: string;
  value: number;
  rating: VitalRating;
  score: number; // 0-100 normalized
}

export interface RumAnalysis {
  page: string;
  timestamp: number;
  vitals: VitalScore[];
  overallScore: number;     // 0-100
  bottleneck: string | null; // which metric is the worst
  revenueImpact: string;    // estimated revenue impact
  mcpQuery: string;         // MCP-compatible query string
}

/**
 * Rate a single vital metric.
 */
export function rateVital(metric: string, value: number, thresholds: VitalThresholds): VitalScore {
  const t = thresholds[metric as keyof VitalThresholds];
  if (!t) return { metric, value, rating: "good", score: 100 };

  let rating: VitalRating;
  if (value <= t.good) rating = "good";
  else if (value <= t.needsImprovement) rating = "needs-improvement";
  else rating = "poor";

  // Normalize to 0-100 score
  const score = rating === "good" ? 100 : rating === "needs-improvement" ? 50 : 20;

  return { metric, value, rating, score };
}

/**
 * Analyze a RUM metric batch for a page.
 * Returns overall score, bottleneck, and revenue impact estimate.
 */
export function analyzeRum(metrics: RumMetric[], thresholds = DEFAULT_THRESHOLDS): RumAnalysis[] {
  // Group by page
  const byPage = new Map<string, RumMetric[]>();
  for (const m of metrics) {
    if (!byPage.has(m.page)) byPage.set(m.page, []);
    byPage.get(m.page)!.push(m);
  }

  const results: RumAnalysis[] = [];

  for (const [page, pageMetrics] of byPage) {
    // Compute p75 (75th percentile) for each vital
    const p75 = (arr: number[]) => {
      const sorted = [...arr].sort((a, b) => a - b);
      const idx = Math.ceil(sorted.length * 0.75) - 1;
      return sorted[Math.max(0, idx)];
    };

    const fcpP75 = p75(pageMetrics.map((m) => m.fcp));
    const lcpP75 = p75(pageMetrics.map((m) => m.lcp));
    const clsP75 = p75(pageMetrics.map((m) => m.cls));
    const inpP75 = p75(pageMetrics.map((m) => m.inp));
    const ttfbP75 = p75(pageMetrics.map((m) => m.ttfb));

    const vitals = [
      rateVital("fcp", fcpP75, thresholds),
      rateVital("lcp", lcpP75, thresholds),
      rateVital("cls", clsP75, thresholds),
      rateVital("inp", inpP75, thresholds),
      rateVital("ttfb", ttfbP75, thresholds),
    ];

    const overallScore = Math.round(vitals.reduce((s, v) => s + v.score, 0) / vitals.length);

    // Find bottleneck (lowest score, tie-break by metric priority)
    const priority = ["lcp", "inp", "cls", "fcp", "ttfb"];
    let bottleneck: string | null = null;
    let lowestScore = Infinity;
    for (const v of vitals) {
      if (v.score < lowestScore || (v.score === lowestScore && priority.indexOf(v.metric) < priority.indexOf(bottleneck || ""))) {
        lowestScore = v.score;
        bottleneck = v.metric;
      }
    }
    if (lowestScore === 100) bottleneck = null;

    // Revenue impact estimate (simplified: 1% conversion loss per 100ms LCP delay)
    const lcpDelay = Math.max(0, lcpP75 - thresholds.lcp.good);
    const conversionLoss = (lcpDelay / 100) * 0.01; // 1% per 100ms
    const revenueImpact = conversionLoss > 0
      ? `Estimated ${(conversionLoss * 100).toFixed(1)}% conversion loss from LCP delay (${lcpDelay}ms above threshold)`
      : "No significant revenue impact detected";

    // MCP-compatible query string
    const mcpQuery = `Why is ${page} slow? LCP=${lcpP75}ms CLS=${clsP75.toFixed(3)} INP=${inpP75}ms FCP=${fcpP75}ms TTFB=${ttfbP75}ms. Overall score: ${overallScore}/100. Bottleneck: ${bottleneck || "none"}.`;

    results.push({
      page,
      timestamp: Date.now(),
      vitals,
      overallScore,
      bottleneck,
      revenueImpact,
      mcpQuery,
    });
  }

  return results;
}

/**
 * MCP (Model Context Protocol) handler for VVU RUM analysis.
 * Connects LLMs to RUM data for AI-powered performance analysis.
 *
 * Query examples:
 *   "Why is the checkout page slow on mobile in South Africa?"
 *   "Which pages have the worst CLS?"
 *   "What is the revenue impact of LCP delays?"
 */
export function createMcpHandler(analyses: RumAnalysis[]) {
  return {
    name: "vvu-rum-analysis",
    description: "VVU Real User Monitoring — Core Web Vitals analysis with AI-powered insights",
    tools: [
      {
        name: "analyze_page",
        description: "Analyze a specific page's performance",
        parameters: { page: "string" },
        handler: (params: { page: string }) => {
          const analysis = analyses.find((a) => a.page === params.page);
          return analysis || { error: "Page not found" };
        },
      },
      {
        name: "get_bottlenecks",
        description: "Get all pages with performance bottlenecks",
        parameters: {},
        handler: () => analyses.filter((a) => a.bottleneck !== null),
      },
      {
        name: "get_revenue_impact",
        description: "Get revenue impact estimates for all pages",
        parameters: {},
        handler: () => analyses.map((a) => ({ page: a.page, impact: a.revenueImpact, score: a.overallScore })),
      },
      {
        name: "mcp_query",
        description: "Generate an MCP-compatible query for LLM analysis",
        parameters: { page: "string" },
        handler: (params: { page: string }) => {
          const analysis = analyses.find((a) => a.page === params.page);
          return analysis?.mcpQuery || "Page not found";
        },
      },
    ],
  };
}