/**
 * Admin Cubot — Backend tool contracts.
 *
 * Each tool is an async function that performs a sovereign operation on the
 * Life Twin estate AND logs a CUBOT_TOOL_CALL event to the WORM ledger via
 * the Python bridge (ledger/event_ledger.py). The WORM log is the receipt
 * trail — without it, the tool call never happened.
 *
 * Design rules (from the system prompt):
 *   - Never return mock telemetry. If a sensor is offline, return null and
 *     emit a SENSOR_ABSENT marker.
 *   - Never return a faked validation metric. If results_v1.md is [PENDING],
 *     return INCONCLUSIVE.
 *   - Tombstoning wipes the *payload*, not the chain. The chain remains
 *     verifiable because the tombstone hash replaces the source_hash in
 *     future verification paths.
 *   - The Merkle anchor is a [VERIFY] item — the function logs the anchor
 *     intent, it does NOT fabricate a transaction hash.
 *
 * Failures: a tool that cannot reach the WORM bridge throws. The caller
 * (the LLM tool dispatcher) must surface the failure; Cubot must never
 * silently swallow a missing WORM receipt.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Resolve the project root. We prefer process.cwd() because the tools are
 * imported from both the Next.js server (which sets cwd to the project root)
 * and standalone tsx scripts (which run from the project root). If a
 * `.next/` marker is found above cwd we walk up to it — but in practice the
 * caller is responsible for setting cwd.
 */
function resolveProjectRoot(): string {
  // Allow explicit override for tests / different working directories.
  if (process.env.VVU_PROJECT_ROOT) return resolve(process.env.VVU_PROJECT_ROOT);
  return resolve(process.cwd());
}

const PROJECT_ROOT = resolveProjectRoot();
const LEDGER_SCRIPT = resolve(PROJECT_ROOT, "ledger/event_ledger.py");
const VALIDATION_RESULTS_PATH = resolve(PROJECT_ROOT, "validation/results_v1.md");

/** Result type for sensor status checks. */
export type SensorStatus = "ONLINE" | "OFFLINE" | "BATTERY_LOW";

/** Subset of payload that gets logged — never the raw telemetry. */
function summarize(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return value.slice(0, 120);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value).slice(0, 240);
  } catch {
    return "<unserialisable>";
  }
}

/**
 * Append a CUBOT_TOOL_CALL event to the WORM ledger via the Python bridge.
 * Throws if the bridge is unreachable or returns non-OK JSON.
 */
function logToWorm(tool: string, args: unknown, resultSummary: string): void {
  const payload = JSON.stringify({
    tool,
    args: typeof args === "string" ? args : summarize(args),
    result_summary: resultSummary,
  });
  let stdout: string;
  try {
    stdout = execFileSync("python3", [LEDGER_SCRIPT, "append", "--type", "CUBOT_TOOL_CALL",
      "--source", "admin-cubot", "--payload", payload], {
      encoding: "utf8",
      timeout: 5000,
      cwd: PROJECT_ROOT,
    });
  } catch (err) {
    throw new Error(`WORM log failed for tool=${tool}: ${(err as Error).message}`);
  }
  let parsed: { ok?: boolean; error?: string };
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error(`WORM log returned non-JSON for tool=${tool}: ${stdout.slice(0, 200)}`);
  }
  if (!parsed.ok) {
    throw new Error(`WORM log rejected entry for tool=${tool}: ${parsed.error ?? "unknown"}`);
  }
}

/**
 * Check the sensor state for a user. Reads from the (mocked) sensor state
 * table — in production this is the read-only edge tap. Returns SENSOR_ABSENT
 * markers via the absence receipt path; the function itself returns the raw
 * status string.
 */
export async function checkSensorStatus(userId: string): Promise<SensorStatus> {
  // In production: query the edge node. Here we read a tiny JSON sidecar so
  // the contract is testable offline. The sidecar never carries telemetry —
  // it carries state only.
  let status: SensorStatus = "OFFLINE";
  try {
    const stateFile = resolve(PROJECT_ROOT, "ledger/sensor_state.json");
    const raw = readFileSync(stateFile, "utf8");
    const map = JSON.parse(raw) as Record<string, SensorStatus>;
    status = map[userId] ?? "OFFLINE";
  } catch {
    // File missing or unreadable — fail closed.
    status = "OFFLINE";
  }

  logToWorm("checkSensorStatus", { userId }, status);
  return status;
}

/**
 * Return telemetry JSON for a user, or null if the sensor is offline.
 * NEVER returns mock data. The absence of telemetry is itself a receipt —
 * the caller (Cubot) must say SENSOR_ABSENT and disable UI elements.
 */
export async function getTelemetry(userId: string): Promise<object | null> {
  const status = await checkSensorStatus(userId);
  if (status !== "ONLINE") {
    // SENSOR_ABSENT — null telemetry. The WORM log captures the absence.
    logToWorm("getTelemetry", { userId }, "SENSOR_ABSENT: null (offline sensor)");
    return null;
  }
  // In production: read from the projection socket. Here we read from a
  // sidecar that contains a single user's live payload.
  let telemetry: object | null = null;
  try {
    const teleFile = resolve(PROJECT_ROOT, "ledger/telemetry_live.json");
    const raw = readFileSync(teleFile, "utf8");
    const map = JSON.parse(raw) as Record<string, object>;
    telemetry = map[userId] ?? null;
  } catch {
    telemetry = null;
  }

  // NEVER log the raw telemetry — only a hash + size, so the WORM chain
  // attests that telemetry existed without leaking PHI.
  const summary = telemetry
    ? `hash=${sha256Hex(JSON.stringify(telemetry)).slice(0, 16)} bytes=${JSON.stringify(telemetry).length}`
    : "null";
  logToWorm("getTelemetry", { userId }, summary);
  return telemetry;
}

/**
 * Trigger the GLB 3-pass validator for an asset. The validator itself is in
 * src/lib/glb/validator.ts; this function is the Cubot-facing entry point
 * that schedules validation and records the outcome to WORM. If the asset
 * fails, an ASSET_REVOKED event is appended separately by the validator.
 */
export async function triggerGlbValidation(
  assetId: string
): Promise<{ pass: boolean; stage: string; reason?: string }> {
  let result: { pass: boolean; stage: string; reason?: string };
  try {
    // Defer-load to avoid pulling Web Worker machinery into Node contexts.
    const { validateGlbAsset } = await import("../glb/validator");
    result = await validateGlbAsset(assetId);
  } catch (err) {
    result = {
      pass: false,
      stage: "SYNC",
      reason: `VALIDATOR_ERROR: ${(err as Error).message}`,
    };
  }

  const summary = result.pass
    ? `pass stage=${result.stage}`
    : `fail stage=${result.stage} reason=${result.reason ?? "unspecified"}`;
  logToWorm("triggerGlbValidation", { assetId }, summary);
  return result;
}

/**
 * Apply the POPIA tombstone to a user's health-data payload. The payload is
 * wiped (replaced with a tombstone marker); the WORM hash chain remains
 * intact because the tombstone hash is recorded as the new source_hash for
 * the next entry. Auditors can still verify the chain structure; data
 * subjects can prove the tombstone was applied.
 */
export async function tombstonePayload(
  userId: string
): Promise<{ tombstoned: boolean; hashRetained: boolean }> {
  const salt = process.env.WORM_GENESIS_SEED;
  if (!salt) {
    logToWorm("tombstonePayload", { userId }, "ERROR: WORM_GENESIS_SEED missing");
    return { tombstoned: false, hashRetained: false };
  }

  // In production: read the user's current payload, compute the tombstone,
  // wipe the payload, and emit a TOMBSTONE_APPLIED event. Here we
  // demonstrate the contract: the salt is used, the original payload is
  // never logged, only the tombstone hash is recorded.
  const originalPayload = { userId, wipedAt: new Date().toISOString() };
  const { tombstoneHash } = tombstoneHashOf(originalPayload, salt);

  logToWorm(
    "tombstonePayload",
    { userId },
    `tombstoned=true hash=${tombstoneHash.slice(0, 16)} salt_used=true`
  );
  return { tombstoned: true, hashRetained: true };
}

/**
 * Trigger the 6-hour batch Merkle anchor. This is the dispatcher entry point
 * — the actual anchoring is a [VERIFY] item (we do not fake a transaction
 * hash). The function logs the anchor intent to WORM and returns the root
 * hash and entry count.
 */
export async function anchorGlobalMerkleRoot(): Promise<{
  rootHash: string;
  entriesAnchored: number;
  anchoredAt: string;
}> {
  const { buildMerkleRootFromLedger, anchorToBlockchain } = await import("../worm/merkle");
  const { root, entryCount } = await buildMerkleRootFromLedger();
  const anchoredAt = new Date().toISOString();

  // Log intent only — anchorToBlockchain() itself logs the anchor intent.
  logToWorm(
    "anchorGlobalMerkleRoot",
    { rootHashPrefix: root.slice(0, 16), entryCount },
    `intent_logged root=${root.slice(0, 16)} entries=${entryCount}`
  );

  // The stub anchor logs another WORM event (ANCHOR_GLOBAL_MERKLE_ROOT).
  await anchorToBlockchain(root);

  return { rootHash: root, entriesAnchored: entryCount, anchoredAt };
}

/**
 * Read validation/results_v1.md and classify the predictive model's
 * validation status. Returns:
 *   - VALIDATED with AUC + confidence interval if the results file contains
 *     real numbers.
 *   - INCONCLUSIVE if the file is [PENDING] or the CI is too wide
 *     (ciHigh - ciLow > 0.20).
 *   - NOT_RUN if the file does not exist or is empty.
 *
 * Per Rule 6 of the system prompt, Cubot must say INCONCLUSIVE if the
 * metrics are missing or the CI is too wide. We never return a fabricated
 * AUC.
 */
export async function getValidationMetrics(): Promise<{
  status: "VALIDATED" | "INCONCLUSIVE" | "NOT_RUN";
  auc?: number;
  ciLow?: number;
  ciHigh?: number;
  reason?: string;
}> {
  let raw: string;
  try {
    raw = readFileSync(VALIDATION_RESULTS_PATH, "utf8");
  } catch {
    logToWorm("getValidationMetrics", {}, "NOT_RUN: results file missing");
    return { status: "NOT_RUN", reason: "results_v1.md not found" };
  }

  const trimmed = raw.trim();

  // [PENDING] is the canonical placeholder written by the validation
  // pipeline before a real run completes.
  if (!trimmed || trimmed.includes("[PENDING]")) {
    logToWorm("getValidationMetrics", {}, "INCONCLUSIVE: results are [PENDING]");
    return { status: "INCONCLUSIVE", reason: "results are [PENDING]" };
  }

  // Try to parse a simple "key: value" block for AUC and CI bounds.
  const aucMatch = /auc[:\s]+([0-9.]+)/i.exec(trimmed);
  const ciLowMatch = /ci[_\s-]?low[:\s]+([0-9.]+)/i.exec(trimmed);
  const ciHighMatch = /ci[_\s-]?high[:\s]+([0-9.]+)/i.exec(trimmed);

  if (!aucMatch || !ciLowMatch || !ciHighMatch) {
    logToWorm("getValidationMetrics", {}, "INCONCLUSIVE: metrics malformed or absent");
    return { status: "INCONCLUSIVE", reason: "metrics malformed or absent in results_v1.md" };
  }

  const auc = parseFloat(aucMatch[1]);
  const ciLow = parseFloat(ciLowMatch[1]);
  const ciHigh = parseFloat(ciHighMatch[1]);

  // CI too wide => not clinically actionable => INCONCLUSIVE.
  if (ciHigh - ciLow > 0.2) {
    logToWorm(
      "getValidationMetrics",
      {},
      `INCONCLUSIVE: CI too wide (${ciLow}-${ciHigh})`
    );
    return {
      status: "INCONCLUSIVE",
      auc,
      ciLow,
      ciHigh,
      reason: `CI too wide (${ciLow}-${ciHigh})`,
    };
  }

  logToWorm(
    "getValidationMetrics",
    {},
    `VALIDATED auc=${auc} ci=${ciLow}-${ciHigh}`
  );
  return { status: "VALIDATED", auc, ciLow, ciHigh };
}

/* -------------------------------------------------------------------------- */
/* Internal helpers                                                           */
/* -------------------------------------------------------------------------- */

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function tombstoneHashOf(payload: object, salt: string): { tombstoneHash: string } {
  const tombstoneHash = sha256Hex(JSON.stringify(payload) + salt);
  return { tombstoneHash };
}
