/**
 * VVU Substrate Engine — Excel Formula × 5G NTN × MI300X TEE
 * ============================================================
 *
 * The fusion module. Maps Excel cell references to physical sensors,
 * evaluates formulas with fail-closed (#REF! = SENSOR_ABSENT), routes
 * telemetry through 5G NTN (Rel-17 bent pipe vs Rel-19 regenerative),
 * and returns the visual substrate vector for the 3D twin.
 *
 * Constitutional compliance:
 * - No-Primitives Law: #REF! (missing sensor) is SENSOR_ABSENT, never a guess
 * - Fail-closed: if any cell in a formula is SENSOR_ABSENT, the formula
 *   returns SENSOR_ABSENT — no interpolation, no defaults
 * - vvu-evidence-and-verification: every output traces to a computed field
 *
 * The Excel metaphor:
 *   B11 = phone microphone low-frequency footfall
 *   C11 = smartwatch high-frequency proximity
 *   =B11*C11 = the first spatial equation (gait substrate)
 *   =SUM(B11:B14) = aggregate a 10-second walking window
 *   #REF! = sensor dropped → SENSOR_ABSENT (fail-closed, no hallucination)
 *
 * The 5G NTN routing:
 *   Rel-17 (Transparent Payload): satellite is a bent pipe, ground station
 *     does all routing. Latency: ~54ms.
 *   Rel-19 (Regenerative Payload): gNB is IN the satellite. It demodulates,
 *     decodes, and routes in orbit via ISL. Latency: ~27ms.
 */

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type SensorStatus = "ONLINE" | "OFFLINE" | "BATTERY_LOW";
export type CellValue = number | "#REF!" | "#DIV/0!" | "#VALUE!";
export type SubstrateVerdict = "NOMINAL" | "ANOMALY" | "SENSOR_ABSENT" | "INCONCLUSIVE";

export interface Sensor {
  cellRef: string;
  sensorId: string;
  label: string;
  status: SensorStatus;
  value: number | null;
  lastUpdate: number;
}

export interface FormulaResult {
  cellRef: string;
  formula: string;
  value: CellValue;
  verdict: SubstrateVerdict;
  inputs: { cellRef: string; sensorId: string; status: SensorStatus }[];
  computedAt: number;
}

export interface NTNRoute {
  generation: "Rel-17" | "Rel-19";
  payloadType: "Transparent" | "Regenerative";
  latencyMs: number;
  gnbLocation: "ground" | "orbit";
  isl: boolean;
  description: string;
}

export interface SubstrateVector {
  userId: string;
  timestamp: number;
  formulaResults: FormulaResult[];
  ntnRoute: NTNRoute;
  gaitCadenceHz: number | null;
  stressLevel: "LOW" | "ELEVATED" | "CRITICAL" | "UNKNOWN";
  teeAttested: boolean;
  verdict: SubstrateVerdict;
}

// ═══════════════════════════════════════════════════════════════
// CellRegistry — maps Excel cells to physical sensors
// ═══════════════════════════════════════════════════════════════

export class CellRegistry {
  private cells = new Map<string, Sensor>();

  register(sensor: Sensor): void {
    this.cells.set(sensor.cellRef, sensor);
  }

  get(cellRef: string): Sensor | undefined {
    return this.cells.get(cellRef);
  }

  resolveRange(range: string): string[] {
    if (range.includes(":")) {
      const [start, end] = range.split(":");
      const startCol = start.match(/[A-Z]+/)?.[0] || "A";
      const startRow = parseInt(start.match(/\d+/)?.[0] || "1");
      const endCol = end.match(/[A-Z]+/)?.[0] || startCol;
      const endRow = parseInt(end.match(/\d+/)?.[0] || "1");
      if (startCol === endCol) {
        const refs: string[] = [];
        for (let r = startRow; r <= endRow; r++) refs.push(`${startCol}${r}`);
        return refs;
      }
      return [start, end];
    }
    return [range];
  }

  // FAIL-CLOSED: #REF! = SENSOR_ABSENT — no interpolation, no default
  getValue(cellRef: string): CellValue {
    const sensor = this.cells.get(cellRef);
    if (!sensor || sensor.status === "OFFLINE" || sensor.value === null) {
      return "#REF!";
    }
    return sensor.value;
  }

  all(): Sensor[] {
    return Array.from(this.cells.values());
  }
}

// ═══════════════════════════════════════════════════════════════
// FormulaEvaluator — evaluates Excel-style formulas, fail-closed
// ═══════════════════════════════════════════════════════════════

export class FormulaEvaluator {
  constructor(private registry: CellRegistry) {}

  evaluate(formula: string, resultCell: string): FormulaResult {
    const inputs: { cellRef: string; sensorId: string; status: SensorStatus }[] = [];
    const expr = formula.startsWith("=") ? formula.slice(1) : formula;
    const cellRefs = this.extractCellRefs(expr);
    for (const ref of cellRefs) {
      const sensor = this.registry.get(ref);
      if (sensor) inputs.push({ cellRef: ref, sensorId: sensor.sensorId, status: sensor.status });
    }

    let value: CellValue;
    const upperExpr = expr.toUpperCase();
    if (upperExpr.startsWith("SUM(")) value = this.evalSum(expr);
    else if (upperExpr.startsWith("AVERAGE(")) value = this.evalAverage(expr);
    else if (upperExpr.startsWith("MAX(")) value = this.evalMax(expr);
    else if (upperExpr.startsWith("MIN(")) value = this.evalMin(expr);
    else value = this.evalArithmetic(expr);

    let verdict: SubstrateVerdict;
    if (value === "#REF!") verdict = "SENSOR_ABSENT";
    else if (typeof value === "number") verdict = value > 0.1 ? "NOMINAL" : "ANOMALY";
    else verdict = "INCONCLUSIVE";

    return { cellRef: resultCell, formula, value, verdict, inputs, computedAt: Date.now() };
  }

  private extractCellRefs(expr: string): string[] {
    return [...new Set(expr.match(/[A-Z]\d+/g) || [])];
  }

  private evalSum(expr: string): CellValue {
    const m = expr.match(/SUM\(([^)]+)\)/i); if (!m) return "#VALUE!";
    const refs = this.registry.resolveRange(m[1]);
    let sum = 0;
    for (const ref of refs) { const v = this.registry.getValue(ref); if (v === "#REF!") return "#REF!"; if (typeof v === "number") sum += v; }
    return sum;
  }

  private evalAverage(expr: string): CellValue {
    const m = expr.match(/AVERAGE\(([^)]+)\)/i); if (!m) return "#VALUE!";
    const refs = this.registry.resolveRange(m[1]);
    const vals: number[] = [];
    for (const ref of refs) { const v = this.registry.getValue(ref); if (v === "#REF!") return "#REF!"; if (typeof v === "number") vals.push(v); }
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : "#DIV/0!";
  }

  private evalMax(expr: string): CellValue {
    const m = expr.match(/MAX\(([^)]+)\)/i); if (!m) return "#VALUE!";
    const refs = this.registry.resolveRange(m[1]);
    let max = -Infinity;
    for (const ref of refs) { const v = this.registry.getValue(ref); if (v === "#REF!") return "#REF!"; if (typeof v === "number" && v > max) max = v; }
    return max === -Infinity ? "#VALUE!" : max;
  }

  private evalMin(expr: string): CellValue {
    const m = expr.match(/MIN\(([^)]+)\)/i); if (!m) return "#VALUE!";
    const refs = this.registry.resolveRange(m[1]);
    let min = Infinity;
    for (const ref of refs) { const v = this.registry.getValue(ref); if (v === "#REF!") return "#REF!"; if (typeof v === "number" && v < min) min = v; }
    return min === Infinity ? "#VALUE!" : min;
  }

  private evalArithmetic(expr: string): CellValue {
    let evalExpr = expr;
    const refs = this.extractCellRefs(expr);
    for (const ref of refs) {
      const v = this.registry.getValue(ref);
      if (v === "#REF!") return "#REF!";
      if (typeof v === "number") evalExpr = evalExpr.replace(new RegExp(ref, "gi"), String(v));
    }
    try {
      if (!/^[\d\s+\-*/().]+$/.test(evalExpr)) return "#VALUE!";
      const result = Function(`"use strict"; return (${evalExpr})`)();
      return typeof result === "number" && isFinite(result) ? result : "#VALUE!";
    } catch { return "#VALUE!"; }
  }
}

// ═══════════════════════════════════════════════════════════════
// NTNRouter — 5G NTN Rel-17 vs Rel-19
// ═══════════════════════════════════════════════════════════════

export class NTNRouter {
  static readonly REL17: NTNRoute = {
    generation: "Rel-17", payloadType: "Transparent", latencyMs: 54,
    gnbLocation: "ground", isl: false,
    description: "Bent pipe — satellite relays raw RF to ground station. Higher latency, ground does all routing."
  };
  static readonly REL19: NTNRoute = {
    generation: "Rel-19", payloadType: "Regenerative", latencyMs: 27,
    gnbLocation: "orbit", isl: true,
    description: "Regenerative payload — full gNB in orbit. Demodulates, decodes, routes via ISL. Half the latency."
  };

  route(packet: { userId: string; payload: CellValue }, generation: "Rel-17" | "Rel-19" = "Rel-19") {
    const route = generation === "Rel-17" ? NTNRouter.REL17 : NTNRouter.REL19;
    return { route, deliveredAt: Date.now() + route.latencyMs, packet };
  }
}

// ═══════════════════════════════════════════════════════════════
// SubstrateEngine — fuses Excel + NTN + TEE into a visual vector
// ═══════════════════════════════════════════════════════════════

export class SubstrateEngine {
  private registry: CellRegistry;
  private evaluator: FormulaEvaluator;
  private router: NTNRouter;

  private static readonly SUBSTRATE_FORMULAS = [
    { cell: "D11", formula: "=B11*C11",          label: "Gait Substrate (footfall × proximity)" },
    { cell: "D12", formula: "=SUM(B11:B14)",     label: "10s Footfall Aggregate" },
    { cell: "D13", formula: "=AVERAGE(C11:C14)", label: "10s Proximity Mean" },
    { cell: "D14", formula: "=B11+C11",          label: "Acoustic Sum (low + high)" },
  ];

  constructor() {
    this.registry = new CellRegistry();
    this.evaluator = new FormulaEvaluator(this.registry);
    this.router = new NTNRouter();
  }

  registerSensor(sensor: Sensor): void { this.registry.register(sensor); }

  computeSubstrate(userId: string, ntnGeneration: "Rel-17" | "Rel-19" = "Rel-19", teeAttested = false): SubstrateVector {
    const formulaResults = SubstrateEngine.SUBSTRATE_FORMULAS.map(f => this.evaluator.evaluate(f.formula, f.cell));
    const gaitResult = formulaResults[0];
    const routed = this.router.route({ userId, payload: gaitResult.value }, ntnGeneration);

    let gaitCadenceHz: number | null = null;
    let stressLevel: "LOW" | "ELEVATED" | "CRITICAL" | "UNKNOWN" = "UNKNOWN";
    if (typeof gaitResult.value === "number") {
      gaitCadenceHz = gaitResult.value;
      stressLevel = gaitResult.value > 0.5 ? "ELEVATED" : "LOW";
    } else {
      gaitCadenceHz = null;
      stressLevel = "UNKNOWN";
    }

    const anyAbsent = formulaResults.some(r => r.verdict === "SENSOR_ABSENT");
    const verdict = anyAbsent ? "SENSOR_ABSENT" : gaitResult.verdict;

    return { userId, timestamp: routed.deliveredAt, formulaResults, ntnRoute: routed.route, gaitCadenceHz, stressLevel, teeAttested, verdict };
  }

  getSensors(): Sensor[] { return this.registry.all(); }
}

export function createDefaultSubstrateEngine(): SubstrateEngine {
  const engine = new SubstrateEngine();
  const now = Date.now();
  engine.registerSensor({ cellRef: "B11", sensorId: "phone_mic_low_freq", label: "Phone Microphone Low-Frequency Footfall", status: "ONLINE", value: 0.85, lastUpdate: now });
  engine.registerSensor({ cellRef: "B12", sensorId: "phone_mic_low_freq", label: "Footfall t-1", status: "ONLINE", value: 0.82, lastUpdate: now });
  engine.registerSensor({ cellRef: "B13", sensorId: "phone_mic_low_freq", label: "Footfall t-2", status: "ONLINE", value: 0.88, lastUpdate: now });
  engine.registerSensor({ cellRef: "B14", sensorId: "phone_mic_low_freq", label: "Footfall t-3", status: "ONLINE", value: 0.79, lastUpdate: now });
  engine.registerSensor({ cellRef: "C11", sensorId: "watch_proximity_high_freq", label: "Smartwatch High-Frequency Proximity", status: "ONLINE", value: 0.42, lastUpdate: now });
  engine.registerSensor({ cellRef: "C12", sensorId: "watch_proximity_high_freq", label: "Proximity t-1", status: "ONLINE", value: 0.45, lastUpdate: now });
  engine.registerSensor({ cellRef: "C13", sensorId: "watch_proximity_high_freq", label: "Proximity t-2", status: "ONLINE", value: 0.38, lastUpdate: now });
  engine.registerSensor({ cellRef: "C14", sensorId: "watch_proximity_high_freq", label: "Proximity t-3", status: "ONLINE", value: 0.41, lastUpdate: now });
  return engine;
}
