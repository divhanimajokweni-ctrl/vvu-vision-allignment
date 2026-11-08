/**
 * Substrate Engine test — verifies fail-closed (#REF! = SENSOR_ABSENT)
 * and NTN routing (Rel-17 vs Rel-19).
 */
import { createDefaultSubstrateEngine, SubstrateEngine } from "../engine";

function assert(cond: boolean, msg: string) {
  if (!cond) { console.error("FAIL:", msg); process.exit(1); }
  console.log("  PASS:", msg);
}

console.log("=== Substrate Engine Tests ===\n");

// Test 1: All sensors online → NOMINAL, gait cadence computed
console.log("Test 1: All sensors online");
const engine1 = createDefaultSubstrateEngine();
const result1 = engine1.computeSubstrate("user-001", "Rel-19", true);
assert(result1.verdict === "NOMINAL", "verdict is NOMINAL when all sensors online");
assert(typeof result1.gaitCadenceHz === "number", "gaitCadenceHz is a number");
assert(result1.gaitCadenceHz === 0.85 * 0.42, "gait = B11*C11 = 0.357");
assert(result1.stressLevel === "LOW", "stressLevel is LOW (substrate < 0.5)");
assert(result1.ntnRoute.generation === "Rel-19", "NTN route is Rel-19");
assert(result1.ntnRoute.latencyMs === 27, "Rel-19 latency is 27ms");
assert(result1.teeAttested === true, "TEE attested");

// Test 2: Sensor offline → #REF! = SENSOR_ABSENT (fail-closed)
console.log("\nTest 2: Sensor offline → SENSOR_ABSENT");
const engine2 = createDefaultSubstrateEngine();
const b11 = (engine2 as any).registry.get("B11");
b11.status = "OFFLINE";
b11.value = null;
const result2 = engine2.computeSubstrate("user-001", "Rel-19", true);
assert(result2.verdict === "SENSOR_ABSENT", "verdict is SENSOR_ABSENT when B11 offline");
assert(result2.gaitCadenceHz === null, "gaitCadenceHz is null (no guess)");
assert(result2.stressLevel === "UNKNOWN", "stressLevel is UNKNOWN (no fabrication)");
assert(result2.formulaResults[0].value === "#REF!", "D11 formula returns #REF!");

// Test 3: Rel-17 vs Rel-19 latency
console.log("\nTest 3: NTN routing latency");
const engine3 = createDefaultSubstrateEngine();
const r17 = engine3.computeSubstrate("user-001", "Rel-17");
const r19 = engine3.computeSubstrate("user-001", "Rel-19");
assert(r17.ntnRoute.latencyMs === 54, "Rel-17 latency = 54ms");
assert(r19.ntnRoute.latencyMs === 27, "Rel-19 latency = 27ms");
assert(r17.ntnRoute.gnbLocation === "ground", "Rel-17 gNB on ground");
assert(r19.ntnRoute.gnbLocation === "orbit", "Rel-19 gNB in orbit");
assert(r19.ntnRoute.isl === true, "Rel-19 uses ISL");
assert(r17.ntnRoute.isl === false, "Rel-17 no ISL");

// Test 4: SUM formula with one cell offline → #REF! (fail-closed)
console.log("\nTest 4: SUM with offline cell → #REF!");
const engine4 = createDefaultSubstrateEngine();
const b12 = (engine4 as any).registry.get("B12");
b12.status = "OFFLINE";
const result4 = engine4.computeSubstrate("user-001");
const d12 = result4.formulaResults.find((f: any) => f.cellRef === "D12");
assert(d12?.value === "#REF!", "SUM(B11:B14) with B12 offline = #REF!");
assert(d12?.verdict === "SENSOR_ABSENT", "verdict is SENSOR_ABSENT");

// Test 5: No sensors → all #REF!
console.log("\nTest 5: Empty registry → all SENSOR_ABSENT");
const engine5 = new SubstrateEngine();
const result5 = engine5.computeSubstrate("user-empty");
assert(result5.verdict === "SENSOR_ABSENT", "empty registry = SENSOR_ABSENT");
assert(result5.gaitCadenceHz === null, "no gait cadence");

console.log("\n=== ALL TESTS PASSED ===");
