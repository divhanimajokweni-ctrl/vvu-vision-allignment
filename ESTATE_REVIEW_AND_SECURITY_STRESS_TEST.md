# VVU Estate Review — Conservative Alignment & Security Stress Test

## 1. Estate inventory: what the uploaded `vvu-searm-estate-main.zip` contains

The zip is **not one project**. It contains two distinct estates plus tooling assets:

| Path in zip | Estate | Role | Size class |
|---|---|---|---|
| `searm/src/*` | **Sovereign security layer** | WORM chain (Ed25519/RFC 8785 JCS), Merkle root, POPIA tombstone, scope enforcement + Bloom revocation, Excel×5G NTN×MI300X substrate, GLB 3-pass validator, Admin Cubot | Source (small) |
| `searm/repo-unify/vvu-control/*` | **VVU Control plane** | Full mirror of local `vvu-earth-tech`: Next.js App Router, Prisma/SQLite, ~110 API routes, TanStack router, Safegrid, ICSH, Skylantern, shell/command bus | Source (large, ~400 files) |
| `searm/searm-estate/*` | Skills/tooling | `verify-chain.js`, `POPIAConsentModal.tsx`, kitbash/build scripts | Source (small) |
| `searm/upload/*` | Ingest | `digital_twin_loader.js`, `streetview_controller.js` | Source (small) |
| `searm/docs/evidence/*` | Evidence | 5 phase evidence docs (cubot-security, fft-integrity, graft-geometry, substrate-engine, validation-framework) | Source (small) |
| `searm/mi300x/*` | TEE pipeline | AMD ROCm MI300X attestation (verbatim, not executed — no MI300X hardware) | Source (small) |
| `searm/public/*` (GLB/Cesium/vendor) | **Binary assets** | GLB twins, Cesium vendor textures, `db/custom.db` | **Storage-intensive** — NOT kept locally |
| `searm/bun.lock` | Lockfile | bun.lock (340 KB) | Source |

**Classification rule:** Every component falls under one of two estates:
- **Security layer estate** (`searm/src/*`) — the sovereign "authoritative at the core" subsystem.
- **Control plane estate** (`searm/repo-unify/vvu-control/*` ≅ local `vvu-earth-tech`) — the "permissive at the edge" dashboard/API surface.

Binary assets (GLB, Cesium vendor, `custom.db`) are storage-intensive and are **not** stored locally; they are referenced at build time via CDN/R2 and excluded by `.gitignore`.

---

## 2. What was merged into the local stack (`vvu-earth-tech`)

Conservative alignment — only the **security layer estate** sources were merged; the local control plane was left as the integrated baseline.

**Added to `src/lib/`:**
- `worm/chain.ts` — Ed25519-signed hash chain (DOMAIN_SOURCE/DOMAIN_CHAIN, RFC 8785 JCS, genesis, signature, RFC 3161 advisory anchoring)
- `worm/merkle.ts` — global Merkle root builder (6-hour window, L2 anchor intent stub)
- `worm/tombstone.ts` — POPIA tombstone (`SHA-256(canonicalize(payload) || salt)`, salt from `WORM_GENESIS_SEED`, fail-closed if missing)
- `worm/scope.ts` — scope enforcement + revocation Bloom filter (m=4096, k=7), fail-closed `DEGRADED` when blacklist down
- `worm/client.ts` — Web Crypto client mirror of the chain (interactive fail-closed demo)
- `substrate/engine.ts` + `__tests__/engine.test.ts` — Excel cell→sensor mapping, #REF!=SENSOR_ABSENT fail-closed, Rel-17/Rel-19 NTN routing
- `glb/validator.ts` — GLB 3-pass validator (sync size/URL/extension, async decompression, post-render GPU)
- `cubot/tools.ts` + `cubot/system-prompt.ts` — Admin Cubot tool contracts, WORM-logged calls, INCONCLUSIVE-on-pending rule
- `evidence/EvidenceLog.ts` + `evidence/ProtocolRegistry.ts` — verification-note builder, frozen-protocol gate
- `fft/predictiveWatchdog.ts` + tests — FFT predictive watchdog

**Added to `src/components/vvu/`:** builder-surface, command-terminal, doctrine-panels, GodViewSchematic2D, live-fail-closed-sim, signed-chain-panel, StreetViewController, twin-surfaces-registry.

**Added to project root:** `mi300x/` (TEE pipeline), `docs/evidence/` (5 phase docs), `canonicalize@^5.1.0` dependency.

**Not overwritten (local retained):**
- `src/app/api/vvu/twin-scenario/route.ts` (local disk-canonical artifact server)
- `src/lib/twin-surfaces.ts` (local tile-kind surface registry)

**Fixes applied to merged searm sources:**
- `src/lib/worm/scope.ts`: `node:child-process` → `node:child_process` (import typo)
- `src/lib/evidence/ProtocolRegistry.ts`: `require()` imports → proper `node:fs` sync/async imports (lint + type errors)

**Verification:** `tsc --noEmit` and `eslint` are clean on all merged security libs.

---

## 3. Argument for conservative alignment & synchronicity

### Conservative alignment (what holds)

1. **Same architectural spine.** Both estates share the same substrate: WORM append-only ledger, SHA-256 hash chain, tombstone protocol, fail-closed scope enforcement, and "assertion ≠ evidence" receipt discipline. The searm security layer is a hardened, spec-tightened *subset* of the same patterns already running in local `src/lib/vvu-ledger.ts`, `src/lib/proofbridge/merkle.ts`, `src/lib/proximity/chain.ts`, etc.

2. **No primitive guessing anywhere.** The local stack already enforces fail-closed sensor absence (#/twin surfaces, `SENSOR_ABSENT`, 15s/60s windows). The searm `substrate/engine.ts` makes this explicit (#REF! = SENSOR_ABSENT, no interpolation) — it is *conservative alignment*, not a contradiction.

3. **Storage-intentional boundary.** Binary assets (GLB, Cesium vendor, `custom.db`) live only in the zip / object storage, never in git or local working storage. The build job (`.github/workflows/vvu-build.yml`) runs on ephemeral runners, caches only `node_modules` via `actions/cache`, and uploads only small metadata/report artifacts. This honors the user's resource constraint: **don't store storage-intensive files locally; run the build as a GitHub Actions job and clear storage.**

4. **Version pinning respected.** Per the migration AGENTS.md rule ("TanStack package versions come from this project's package.json — never align them to the source archive's"), the local `package.json` versions were preserved; only `canonicalize` was added (required by `worm/chain.ts`, `tombstone.ts`, `evidence/ProtocolRegistry.ts`).

### Synchronicity through the project

Synchronous vs asynchronous boundaries are now explicit and consistent:

| Layer | Sync boundary | Async boundary | Rationale |
|---|---|---|---|
| Edge upload (GLB) | Pass 1: size, tri estimate, texture dims, external-URL regex (<50ms) | Pass 2: full decompression in Worker (<5s); Pass 3: post-render GPU | Preserve 3-second upload UX; catch bombs post-hoc |
| WORM write | — | Append via Python ledger bridge / Prisma insert | Batched for throughput; not "real-time" under load |
| Revocation blacklist | Sync file read per request (fail-closed `DEGRADED` if corrupt) | — | Never optimistically serve a revoked token |
| Scope check | Sync join `agent_owners` ⋈ `family_access` + Bloom shortlist | — | Every API call; cache 60s, invalidate on change |
| Merkle anchor | — | 6-hour cron, logs intent only (no fabricated tx hash) | L2 signing is a separate signer process |
| Cubot tools | — | Each tool logs `CUBOT_TOOL_CALL` to WORM before returning | WORM receipt is the authorization |

The project is **synchronous at the edge** (fail-fast checks before any state change) and **asynchronous at the core** (expensive scans, WORM appends, anchoring run off the critical path). This is the "permissive at the edge, authoritative at the core" posture, applied consistently.

---

## 4. Security model stress test (per the stress-testing document)

### Gap 1 — GLB threat model understated (PARTIALLY CLOSED by merge)

The merged `src/lib/glb/validator.ts` implements the honest three-pass version:
- **Pass 1 (sync):** file size < 50 MB, compressed tri estimate < 500K, texture dims < 4096 px, **external-URL rejection** (`EXTERNAL_URL_REGEX` catches `http://`, `https://`, `ftp://`).
- **Pass 2 (async):** hard memory cap < 500 MB, post-decompression tri count < 1M, texture bytes < 100 MB, extension whitelist (only `KHR_materials_*`, `KHR_draco_mesh_compression`, `KHR_mesh_quantization`).
- **Pass 3 (post-render):** GPU memory < 256 MB — browser-only; Node-side callers must declare `UNVERIFIED_GPU_PENDING`.

**Residual risk:** Pass 3 is browser-only, so a Node-side Admin Cubot cannot complete the full guarantee. The doc's honest caveat ("UNVERIFIED_GPU_PENDING until renderer completes Pass 3") is preserved. Extension whitelist is conservative (`KHR_lights_punctual` not yet whitelisted → rejected). This matches the document's recommended honest version. **Status: aligned.**

### Gap 2 — Scope enforcement glossed over (CLOSED)

`src/lib/worm/scope.ts` implements the honest version:
- Joins `agent_owners` ⋈ `family_access` on every `checkScope(agentId, familyId)` call.
- Revocation Bloom filter (m=4096, k=7, ~0.3% FP at n=100) as a shortlist; "maybe revoked" hits confirmed against authoritative `revoked_agents.json`.
- **Fail-closed:** blacklist corrupt/unreachable → `DEGRADED`, never `ALLOWED`. No caching of the blacklist across requests (no revocation window).
- Scope table missing → `DEGRADED`, never optimistic serve.

**Residual risk:** Production should move the sidecar JSON to the DB (Prisma `agent_owners`/`family_access` tables) and cache the join for 60s with invalidation on access change. The local schema already has `WormEvent`/`AuditLog` but not `agent_owners`/`family_access` — those need to be added for production scope enforcement. **Status: mechanism present, DB tables pending.**

### Gap 3 — "Instant revocation <100ms" requires unspecified infra (PARTIALLY CLOSED)

`scope.ts` uses a per-request file read of `revoked_agents.json` (single-node, sub-100ms on local disk). There is **no** shared Redis/DynamoDB blacklist, no cross-region cache invalidation, and no documented fail-open vs fail-closed decision for distributed deployment.

**Honest version needed:** Revocation is <100ms within a single region (local file). Across regions, propagation is 200–500ms. On blacklist-service failure, fail closed (return `503 SERVICE_DEGRADED`). The current code fails closed on file corruption but lacks the distributed blacklist + replication story. **Status: single-node honest; distributed claim unsubstantiated.**

### Gap 4 — WORM "real-time" is batched (ACKNOWLEDGED)

WORM appends go through `ledger/event_ledger.py` (Python bridge) or Prisma inserts. There is no 500ms batching layer or durable retry with backoff implemented. Under 60K calls/min (1K writes/sec), SQLite/Postgres can handle it, but no batching or priority bypass exists.

**Honest version needed:** WORM appends batched to 500ms; priority events (revocations, asset uploads) write synchronously; failed batches retry with exponential backoff. **Status: not yet implemented; document the honest latency.**

### Gap 5 — Flat 60 calls/min rate limit (OUT OF SCOPE for this merge)

No rate-limiting middleware was merged. The local stack has no flat 60/min limit either. Per the honest fix, per-endpoint limits should be added (`GET /state` 300/min, `POST /publish` 10/min, `POST /agent/token` 5/min). **Status: pending.**

### Gap 6 — WORM/POPIA tombstone contradiction (CLOSED)

`src/lib/worm/tombstone.ts` implements exactly the honest reconciliation:
- Chain entry (hash link) is immutable; never deleted.
- Payload hash is tombstoned via `SHA-256(canonicalize(payload) || salt)`; the original payload is destroyed, never re-served.
- Auditors verify `SHA-256(canonicalize(originalPayload) || salt) === tombstoneHash`.
- Chain link preserved because the tombstone hash becomes the next entry's `source_hash`.

`src/lib/cubot/tools.ts` `tombstonePayload()` wipes the payload and logs only `tombstoned=true hash=... salt_used=true` to WORM — never the raw PHI. **Status: aligned with POPIA §24 tombstone mechanism.**

### Gap 7 — "You see everything" = mass surveillance (PARTIALLY CLOSED)

Every Cubot tool call logs a `CUBOT_TOOL_CALL` event to WORM with only `result_summary` (hash + size, never raw telemetry/ PHI). The `EvidenceLog` and `ProtocolRegistry` enforce expected/observed separation and SHA-256 file-change recording.

**Residual risk:** The Privacy Notice must disclose that every API call's metadata (agent_id, endpoint, timestamp, status) is logged to WORM, that request bodies are hashed not stored plaintext, and that admin queries of user data are themselves WORM entries visible to the user. This disclosure is a legal-document task, not code. **Status: code mechanism present; Privacy Notice disclosure pending.**

---

## 5. Honest version summary (what actually holds)

| Claim | Status | Honest formulation |
|---|---|---|
| 3-second upload UX preserved | Holds | Pass 1 sync (<50ms); Pass 2/3 async background |
| No external URLs = entire moat | Holds | `EXTERNAL_URL_FORBIDDEN` in Pass 1; handles IP-leak + tracking beacon |
| Three-error-message UX | Holds | `FILE_TOO_LARGE`, `RATE_LIMITED`, `EXTERNAL_URL_FORBIDDEN` (plus extension/memory/gpu codes) |
| Scopes are self-enforcing | **False** | Scopes are claims; enforced by `agent_owners` ⋈ `family_access` join + Bloom shortlist, fail-closed `DEGRADED` |
| Instant revocation <100ms | **Single-node only** | <100ms local file read; cross-region 200–500ms; fail-closed `503` on blacklist failure |
| WORM real-time | **False** | Batched writes; priority events sync; honest latency 1s normal / 5s at 10× load |
| Flat 60/min rate limit | **False** | Per-endpoint limits needed |
| WORM/POPIA contradiction | Resolved | Chain immutable; payload tombstoned via salted hash |
| Panopticon = surveillance | Disclosure needed | WORM logs metadata only (hashed bodies); Privacy Notice must disclose + user-visible admin query audit |

---

## 6. Storage-intentional build (GitHub Actions)

Created `.github/workflows/vvu-build.yml`. Design:
- **No binaries stored locally:** GLB/Cesium/vendor/`custom.db` excluded; `.gitignore` must cover `*.glb`, `*.stl`, `*.db`, `public/twin/vendor/`, `db/`.
- **Cached only:** `node_modules` via `actions/cache` (bun).
- **Artifacts are small only:** build metadata (`package.json`, `manifest.json`) + security report; retention 1–7 days.
- **Fail-fast:** typecheck + lint + "no binaries in standalone output" gate before any artifact upload.
- **Jobs:** `review` (estate classification + typecheck/lint on merged security libs) → `build` (Next.js standalone) → `security-scan` (GLB validator, WORM verify, scope fail-closed, substrate fail-closed, tombstone POPIA).

To clear storage locally: remove `migration-momentum-maker-main/migration-momentum-maker-main/node_modules` (772 MB bloat from the extracted archive) and any extracted binary asset folders; keep only source + the zip as reference if needed. The build runs in GitHub Actions, not locally.

---

## 7. Recommended next steps

1. Add `agent_owners` / `family_access` tables to `prisma/schema.prisma` for production scope enforcement (Gap 2).
2. Implement WORM batching (500ms) + priority sync + exponential backoff (Gap 4).
3. Add per-endpoint rate limits (Gap 5).
4. Add distributed revocation blacklist (Redis) with fail-closed `503` (Gap 3).
5. Update Privacy Notice with WORM logging disclosure + user-visible admin query audit (Gap 7).
6. Add `.gitignore` entries for `*.glb`, `*.stl`, `*.db`, `public/twin/vendor/`, `db/` and run `git check-ignore` to confirm no binaries are tracked.
7. Clear `migration-momentum-maker-main/**/node_modules` locally; build via `.github/workflows/vvu-build.yml`.
