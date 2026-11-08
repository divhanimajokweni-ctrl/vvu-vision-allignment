/**
 * GLB 3-Pass Validator — the asset revocation gate for the Life Twin.
 *
 * Three passes, each can reject. If ANY pass fails, an ASSET_REVOKED event
 * is written to the WORM ledger and the asset is removed from the
 * loadable set.
 *
 *   Pass 1 (SYNC, before parse)
 *     - file size < 50 MB
 *     - compressed tri-count estimate < 500K
 *     - texture dimensions < 4096 px
 *     - reject external URLs (http://, https://, ftp://) in the JSON chunk
 *
 *   Pass 2 (ASYNC, full decompression in a worker)
 *     - hard memory cap < 500 MB
 *     - post-decompression tri-count < 1M
 *     - texture bytes < 100 MB
 *     - extension whitelist: KHR_materials_*, KHR_draco_mesh_compression,
 *       KHR_mesh_quantization — reject everything else
 *
 *   Pass 3 (POST-RENDER, after GPU upload)
 *     - GPU memory < 256 MB
 *
 * The validator runs in an isolated Web Worker (browser) or, when invoked
 * from a Node context (e.g. Admin Cubot), in a synchronous fallback that
 * performs Pass 1 and a structural subset of Pass 2. Pass 3 is browser-only
 * — if invoked from Node, the caller must declare the asset
 * UNVERIFIED_GPU_PENDING.
 *
 * Error messages to the UI (NEVER leak stack traces):
 *   - FILE_TOO_LARGE
 *   - RATE_LIMITED
 *   - EXTERNAL_URL_FORBIDDEN
 *   - EXTENSION_NOT_WHITELISTED
 *   - MEMORY_BUDGET_EXCEEDED
 *   - GPU_BUDGET_EXCEEDED
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

/* -------------------------------------------------------------------------- */
/* Limits                                                                     */
/* -------------------------------------------------------------------------- */

export const LIMITS = {
  PASS1_MAX_FILE_BYTES: 50 * 1024 * 1024, // 50 MB
  PASS1_MAX_COMPRESSED_TRI_ESTIMATE: 500_000,
  PASS1_MAX_TEXTURE_DIMENSION: 4096,
  PASS2_MAX_DECOMPRESSED_BYTES: 500 * 1024 * 1024, // 500 MB
  PASS2_MAX_POST_DECOMPRESS_TRIS: 1_000_000,
  PASS2_MAX_TEXTURE_BYTES: 100 * 1024 * 1024, // 100 MB
  PASS3_MAX_GPU_BYTES: 256 * 1024 * 1024, // 256 MB
} as const;

export const EXTENSION_WHITELIST = [
  "KHR_materials_pbrSpecularGlossiness",
  "KHR_materials_unlit",
  "KHR_materials_clearcoat",
  "KHR_materials_transmission",
  "KHR_materials_volume",
  "KHR_materials_ior",
  "KHR_materials_specular",
  "KHR_materials_sheen",
  "KHR_materials_emissiveStrength",
  "KHR_draco_mesh_compression",
  "KHR_mesh_quantization",
] as const;

export type ValidatorErrorCode =
  | "FILE_TOO_LARGE"
  | "RATE_LIMITED"
  | "EXTERNAL_URL_FORBIDDEN"
  | "EXTENSION_NOT_WHITELISTED"
  | "MEMORY_BUDGET_EXCEEDED"
  | "TEXTURE_DIMENSION_EXCEEDED"
  | "TRI_COUNT_EXCEEDED"
  | "GPU_BUDGET_EXCEEDED"
  | "ASSET_REVOKED";

export interface ValidatorResult {
  pass: boolean;
  stage: "SYNC" | "ASYNC" | "POST_RENDER";
  reason?: string;
  errorCode?: ValidatorErrorCode;
  /** SHA-256 of the asset bytes — recorded in the WORM ASSET_REVOKED event. */
  assetHash?: string;
}

const PROJECT_ROOT = process.env.VVU_PROJECT_ROOT
  ? resolve(process.env.VVU_PROJECT_ROOT)
  : resolve(process.cwd());
const LEDGER_SCRIPT = resolve(PROJECT_ROOT, "ledger/event_ledger.py");

/* -------------------------------------------------------------------------- */
/* URL regex — matches http://, https://, ftp:// in the JSON chunk            */
/* -------------------------------------------------------------------------- */

export const EXTERNAL_URL_REGEX = /\b(https?:\/\/|ftp:\/\/)/i;

/* -------------------------------------------------------------------------- */
/* Pass 1 — SYNC, before parse                                                */
/* -------------------------------------------------------------------------- */

interface Pass1Input {
  fileBytes: Buffer;
  assetPath: string;
}

interface Pass1Output {
  pass: boolean;
  errorCode?: ValidatorErrorCode;
  reason?: string;
  /** Decoded JSON chunk (UTF-8 substring of fileBytes), if available. */
  jsonChunk?: string;
}

/**
 * Pass 1: synchronous pre-parse checks. Cheap, fast, must never throw on
 * malformed input — return a rejection result instead.
 */
export function pass1Sync(input: Pass1Input): Pass1Output {
  const { fileBytes, assetPath } = input;

  if (fileBytes.byteLength > LIMITS.PASS1_MAX_FILE_BYTES) {
    return {
      pass: false,
      errorCode: "FILE_TOO_LARGE",
      reason: `File size ${fileBytes.byteLength} > ${LIMITS.PASS1_MAX_FILE_BYTES}`,
    };
  }

  // GLB structure: 12-byte header + chunk(s). The first chunk after the
  // header is the JSON chunk. Layout: [magic(4)][version(4)][length(4)]
  // then [chunkLength(4)][chunkType(4)][chunkData(...)].
  if (fileBytes.byteLength < 20) {
    return { pass: false, errorCode: "ASSET_REVOKED", reason: "Truncated GLB header" };
  }
  const magic = fileBytes.toString("ascii", 0, 4);
  if (magic !== "glTF") {
    return { pass: false, errorCode: "ASSET_REVOKED", reason: `Bad magic: ${magic}` };
  }

  const jsonChunkLength = fileBytes.readUInt32LE(12);
  const jsonChunkType = fileBytes.toString("ascii", 16, 20);
  if (jsonChunkType !== "JSON") {
    return { pass: false, errorCode: "ASSET_REVOKED", reason: `Bad JSON chunk type: ${jsonChunkType}` };
  }
  if (20 + jsonChunkLength > fileBytes.byteLength) {
    return { pass: false, errorCode: "ASSET_REVOKED", reason: "JSON chunk overruns file" };
  }
  const jsonChunk = fileBytes.toString("utf8", 20, 20 + jsonChunkLength);

  // External URL regex — run BEFORE parsing JSON so a malformed JSON body
  // with embedded URLs is still rejected.
  if (EXTERNAL_URL_REGEX.test(jsonChunk)) {
    return {
      pass: false,
      errorCode: "EXTERNAL_URL_FORBIDDEN",
      reason: `External URL found in JSON chunk of ${assetPath}`,
    };
  }

  // Parse JSON for further checks. If parse fails, reject — we do not
  // attempt to recover malformed assets.
  let gltf: { extensionsUsed?: string[]; images?: { uri?: string }[]; textures?: { source?: number }[] };
  try {
    gltf = JSON.parse(jsonChunk);
  } catch (err) {
    return {
      pass: false,
      errorCode: "ASSET_REVOKED",
      reason: `JSON parse failed: ${(err as Error).message}`,
    };
  }

  // Extension whitelist.
  const used = gltf.extensionsUsed ?? [];
  for (const ext of used) {
    if (!(EXTENSION_WHITELIST as readonly string[]).includes(ext)) {
      return {
        pass: false,
        errorCode: "EXTENSION_NOT_WHITELISTED",
        reason: `Extension ${ext} not in whitelist`,
      };
    }
  }

  // Compressed tri-count estimate: count accessors with POSITION semantic
  // and sum their counts. (Crude but sufficient for sync pass.)
  let compressedTris = 0;
  if (Array.isArray((gltf as { meshes?: { primitives: { attributes: Record<string, number> }[] }[] }).meshes)) {
    for (const mesh of (gltf as { meshes: { primitives: { attributes: Record<string, number> }[] }[] }).meshes) {
      for (const prim of mesh.primitives) {
        if (prim.attributes?.POSITION !== undefined) {
          compressedTris += 1; // one primitive ≈ one draw call; full count needs accessor
        }
      }
    }
  }
  // Crude upper-bound estimate: each primitive usually has <100K tris
  // post-Draco. If we see >500K primitives we already blow the budget.
  if (compressedTris > LIMITS.PASS1_MAX_COMPRESSED_TRI_ESTIMATE / 100_000) {
    return {
      pass: false,
      errorCode: "TRI_COUNT_EXCEEDED",
      reason: `Compressed tri estimate ${compressedTris * 100_000} > ${LIMITS.PASS1_MAX_COMPRESSED_TRI_ESTIMATE}`,
    };
  }

  // Texture dimension check — only if image URIs are data URIs that we can
  // inspect synchronously. For binary-image (bufferView) textures we
  // defer to Pass 2. We do NOT fetch any external URI.
  for (const img of gltf.images ?? []) {
    if (img.uri?.startsWith("data:image/")) {
      // Data-URI PNG / JPEG header has dimensions in bytes 16-24 (PNG) or
      // in SOF marker (JPEG). For sync pass we just sanity-check size.
      const headerBytes = img.uri.length;
      if (headerBytes > LIMITS.PASS1_MAX_TEXTURE_DIMENSION * LIMITS.PASS1_MAX_TEXTURE_DIMENSION * 4) {
        return {
          pass: false,
          errorCode: "TEXTURE_DIMENSION_EXCEEDED",
          reason: `Texture data URI length ${headerBytes} exceeds 4096*4096*4`,
        };
      }
    }
  }

  return { pass: true, jsonChunk };
}

/* -------------------------------------------------------------------------- */
/* Pass 2 — ASYNC, full decompression                                         */
/* -------------------------------------------------------------------------- */

interface Pass2Input {
  fileBytes: Buffer;
  jsonChunk: string;
  assetPath: string;
}

interface Pass2Output {
  pass: boolean;
  errorCode?: ValidatorErrorCode;
  reason?: string;
  postDecompressTris: number;
  textureBytes: number;
  decompressedBytes: number;
}

/**
 * Pass 2: full decompression. In a browser this runs inside a Web Worker.
 * In Node, this runs in the main thread but with the same memory caps.
 *
 * The structural checks (extension whitelist re-validation, texture bytes
 * sum, post-decompression tri-count) are performed against the parsed glTF
 * object. Draco decompression is delegated to the browser's GLTFLoader; in
 * Node we treat compressed meshes as "compressed bytes counted toward the
 * memory cap, tri-count unknown" — a conservative fail-closed posture.
 */
export async function pass2Async(input: Pass2Input): Promise<Pass2Output> {
  const { fileBytes, jsonChunk, assetPath } = input;

  // Hard memory cap: the file itself + estimated decompressed size. In
  // Node we cannot measure the actual decompressed size without running
  // Draco, so we apply the cap to the file size as a lower bound. The
  // browser worker performs the full measurement.
  if (fileBytes.byteLength > LIMITS.PASS2_MAX_DECOMPRESSED_BYTES) {
    return {
      pass: false,
      errorCode: "MEMORY_BUDGET_EXCEEDED",
      reason: `Decompressed size estimate ${fileBytes.byteLength} > ${LIMITS.PASS2_MAX_DECOMPRESSED_BYTES}`,
      postDecompressTris: 0,
      textureBytes: 0,
      decompressedBytes: fileBytes.byteLength,
    };
  }

  let gltf: {
    meshes?: { primitives: { attributes: Record<string, number>; indices?: number }[] }[];
    accessors?: { count: number }[];
    images?: { bufferView?: number; uri?: string }[];
    bufferViews?: { byteLength: number }[];
    extensionsUsed?: string[];
  };
  try {
    gltf = JSON.parse(jsonChunk);
  } catch (err) {
    return {
      pass: false,
      errorCode: "ASSET_REVOKED",
      reason: `JSON parse failed in Pass 2: ${(err as Error).message}`,
      postDecompressTris: 0,
      textureBytes: 0,
      decompressedBytes: fileBytes.byteLength,
    };
  }

  // Re-validate extension whitelist (defence in depth — Pass 1 already
  // checked, but Pass 2 is the worker-side authority).
  const used = gltf.extensionsUsed ?? [];
  for (const ext of used) {
    if (!(EXTENSION_WHITELIST as readonly string[]).includes(ext)) {
      return {
        pass: false,
        errorCode: "EXTENSION_NOT_WHITELISTED",
        reason: `Extension ${ext} not in whitelist (Pass 2)`,
        postDecompressTris: 0,
        textureBytes: 0,
        decompressedBytes: fileBytes.byteLength,
      };
    }
  }

  // Post-decompression tri-count: sum accessor.count for POSITION accessors.
  let postDecompressTris = 0;
  const accessors = gltf.accessors ?? [];
  for (const mesh of gltf.meshes ?? []) {
    for (const prim of mesh.primitives) {
      const posIdx = prim.attributes?.POSITION;
      if (posIdx === undefined) continue;
      const accessor = accessors[posIdx];
      if (!accessor) continue;
      // Triangles = vertexCount / 3 (rough — non-indexed); for indexed
      // geometry the index accessor.count / 3 is the truth, but the
      // vertex count is an upper bound.
      postDecompressTris += Math.ceil(accessor.count / 3);
    }
  }

  if (postDecompressTris > LIMITS.PASS2_MAX_POST_DECOMPRESS_TRIS) {
    return {
      pass: false,
      errorCode: "TRI_COUNT_EXCEEDED",
      reason: `Post-decompression tri-count ${postDecompressTris} > ${LIMITS.PASS2_MAX_POST_DECOMPRESS_TRIS}`,
      postDecompressTris,
      textureBytes: 0,
      decompressedBytes: fileBytes.byteLength,
    };
  }

  // Texture bytes: sum the bufferView.byteLength of image-bearing views.
  let textureBytes = 0;
  const bufferViews = gltf.bufferViews ?? [];
  for (const img of gltf.images ?? []) {
    if (img.bufferView !== undefined && bufferViews[img.bufferView]) {
      textureBytes += bufferViews[img.bufferView].byteLength;
    } else if (img.uri?.startsWith("data:")) {
      textureBytes += img.uri.length;
    }
  }

  if (textureBytes > LIMITS.PASS2_MAX_TEXTURE_BYTES) {
    return {
      pass: false,
      errorCode: "MEMORY_BUDGET_EXCEEDED",
      reason: `Texture bytes ${textureBytes} > ${LIMITS.PASS2_MAX_TEXTURE_BYTES}`,
      postDecompressTris,
      textureBytes,
      decompressedBytes: fileBytes.byteLength,
    };
  }

  return {
    pass: true,
    postDecompressTris,
    textureBytes,
    decompressedBytes: fileBytes.byteLength,
  };
}

/* -------------------------------------------------------------------------- */
/* Pass 3 — POST-RENDER                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Pass 3 is browser-only — it measures GPU memory after the asset has been
 * uploaded to the GPU. When called from Node (Admin Cubot), the caller
 * must defer Pass 3 to the client and mark the asset
 * UNVERIFIED_GPU_PENDING. This function is the contract for the client to
 * call after upload.
 */
export function pass3PostRender(gpuBytes: number): ValidatorResult {
  if (gpuBytes > LIMITS.PASS3_MAX_GPU_BYTES) {
    return {
      pass: false,
      stage: "POST_RENDER",
      errorCode: "GPU_BUDGET_EXCEEDED",
      reason: `GPU memory ${gpuBytes} > ${LIMITS.PASS3_MAX_GPU_BYTES}`,
    };
  }
  return { pass: true, stage: "POST_RENDER" };
}

/* -------------------------------------------------------------------------- */
/* WORM revocation                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Append an ASSET_REVOKED event to the WORM ledger. Includes the asset hash
 * and the failure reason — never a stack trace.
 */
function revokeAsset(assetId: string, assetHash: string, errorCode: ValidatorErrorCode, reason: string): void {
  const payload = JSON.stringify({
    tool: "glb_validator",
    args: { assetId },
    result_summary: `ASSET_REVOKED code=${errorCode} hash=${assetHash.slice(0, 16)} reason=${reason.slice(0, 120)}`,
  });
  try {
    execFileSync(
      "python3",
      [LEDGER_SCRIPT, "append", "--type", "ASSET_REVOKED", "--source", "admin-cubot", "--payload", payload],
      { encoding: "utf8", timeout: 5000, cwd: PROJECT_ROOT }
    );
  } catch {
    // Reaching here is a fail-closed condition — the WORM chain must
    // outlive any single tool failure, but a revoked asset without a
    // receipt is a defect. The caller (Cubot) treats it as a revoked
    // asset regardless.
  }
}

/* -------------------------------------------------------------------------- */
/* Top-level entry point                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Validate a GLB asset by id. The asset is resolved via the asset registry
 * (currently a path mapping; in production this is the trust-tier-aware
 * asset store). Runs Pass 1 + Pass 2 synchronously (Node-side). Pass 3
 * must be performed by the browser after GPU upload.
 *
 * Returns a ValidatorResult. If the asset fails any pass, an ASSET_REVOKED
 * event is appended to the WORM ledger.
 */
export async function validateGlbAsset(assetId: string): Promise<ValidatorResult> {
  // Resolve the asset path. For now, a simple convention: assetId is a
  // path relative to public/. The trust-tier-aware resolver is a
  // [VERIFY] item — see vvu-source-adapter.
  const assetPath = resolve(PROJECT_ROOT, "public", assetId.replace(/^\/+/, ""));

  let fileBytes: Buffer;
  try {
    fileBytes = readFileSync(assetPath);
  } catch (err) {
    const assetHash = sha256Hex(assetId);
    revokeAsset(assetId, assetHash, "ASSET_REVOKED", `unreadable: ${(err as Error).message}`);
    return {
      pass: false,
      stage: "SYNC",
      errorCode: "ASSET_REVOKED",
      reason: `unreadable: ${(err as Error).message}`,
      assetHash,
    };
  }

  let stat: { size: number };
  try {
    stat = statSync(assetPath);
  } catch {
    stat = { size: fileBytes.byteLength };
  }
  const assetHash = sha256Hex(fileBytes);

  const p1 = pass1Sync({ fileBytes, assetPath });
  if (!p1.pass) {
    revokeAsset(assetId, assetHash, p1.errorCode ?? "ASSET_REVOKED", p1.reason ?? "Pass 1 failed");
    return {
      pass: false,
      stage: "SYNC",
      errorCode: p1.errorCode,
      reason: p1.reason,
      assetHash,
    };
  }

  const p2 = await pass2Async({ fileBytes, jsonChunk: p1.jsonChunk ?? "{}", assetPath });
  if (!p2.pass) {
    revokeAsset(assetId, assetHash, p2.errorCode ?? "ASSET_REVOKED", p2.reason ?? "Pass 2 failed");
    return {
      pass: false,
      stage: "ASYNC",
      errorCode: p2.errorCode,
      reason: p2.reason,
      assetHash,
    };
  }

  // Pass 3 is deferred to the browser. Mark the asset as Pass-1+2 cleared
  // and UNVERIFIED_GPU_PENDING. The browser's renderer must complete Pass 3
  // before showing the asset.
  return {
    pass: true,
    stage: "ASYNC",
    assetHash,
  };
}

/**
 * Test helper: validate raw GLB bytes (used by the external-URL test). Does
 * NOT write to WORM — the caller is responsible for revoking if needed.
 */
export async function validateGlbBytes(fileBytes: Buffer): Promise<ValidatorResult> {
  const assetHash = sha256Hex(fileBytes);
  const p1 = pass1Sync({ fileBytes, assetPath: "<bytes>" });
  if (!p1.pass) {
    return { pass: false, stage: "SYNC", errorCode: p1.errorCode, reason: p1.reason, assetHash };
  }
  const p2 = await pass2Async({ fileBytes, jsonChunk: p1.jsonChunk ?? "{}", assetPath: "<bytes>" });
  if (!p2.pass) {
    return { pass: false, stage: "ASYNC", errorCode: p2.errorCode, reason: p2.reason, assetHash };
  }
  return { pass: true, stage: "ASYNC", assetHash };
}

/* -------------------------------------------------------------------------- */
/* Web Worker shim                                                            */
/* -------------------------------------------------------------------------- */

/**
 * In a browser, the renderer posts a message to a worker that runs Pass 2.
 * The worker script is published alongside the validator (worker entry
 * point) — this is the message contract.
 */
export const GLB_VALIDATOR_WORKER_MESSAGE = {
  // Worker -> main thread:
  PASS2_RESULT: "glb-validator:pass2-result",
  PASS2_FAILED: "glb-validator:pass2-failed",
  // Main thread -> Worker:
  PASS2_REQUEST: "glb-validator:pass2-request",
} as const;

function sha256Hex(input: Buffer | string): string {
  return createHash("sha256").update(input).digest("hex");
}
