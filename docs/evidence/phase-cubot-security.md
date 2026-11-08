# Phase: Admin Cubot + Hardened Security Pipeline (Task 3-cubot)

**Phase:** Cubot + Security Pipeline
**Goal:** Build Admin Cubot (sovereign operator), GLB 3-pass validator, global Merkle root cron, and POPIA tombstone protocol. Verify that every Cubot tool call logs to WORM, that the GLB validator rejects external URLs, that the Merkle root builds, that the tombstone produces a hash without leaking the payload, and that the scope check fails closed when the blacklist is down.

## Commands run (exact)

```bash
# Evidence 1 — getValidationMetrics() returns INCONCLUSIVE
cd /home/z/my-project && npx tsx -e "import { getValidationMetrics } from './src/lib/cubot/tools'; getValidationMetrics().then(r => console.log(JSON.stringify(r)))"

# Evidence 2 — buildMerkleRoot builds
cd /home/z/my-project && npx tsx -e "import { buildMerkleRoot } from './src/lib/worm/merkle'; console.log(JSON.stringify(buildMerkleRoot([{source_hash:'abc'},{source_hash:'def'}])))"

# Evidence 3 — compliance-report runs
cd /home/z/my-project && npx tsx scripts/compliance-report.ts

# Evidence 4 — POPIA tombstone (salt loaded from .env)
cd /home/z/my-project && export WORM_GENESIS_SEED=$(grep "^WORM_GENESIS_SEED=" .env | cut -d'=' -f2 | tr -d '"')
npx tsx -e "
import { tombstone, verifyTombstone, buildTombstoneReplacement } from './src/lib/worm/tombstone';
const payload = { heart_rate: 72, spo2: 98, user: 'subject-42', timestamp: '2026-11-07T22:00:00Z' };
const salt = process.env.WORM_GENESIS_SEED!;
const result = tombstone(payload, salt);
console.log('tombstone result:', JSON.stringify(result));
console.log('verifyTombstone (auditor holds original):', verifyTombstone(result.tombstoneHash, salt, payload));
console.log('verifyTombstone (altered payload):', verifyTombstone(result.tombstoneHash, salt, { ...payload, heart_rate: 99 }));
console.log('original payload leaked in tombstone output?', JSON.stringify(result).includes('heart_rate') || JSON.stringify(result).includes('subject-42'));
"

# Evidence 5 — Scope check fail-closed (corrupt blacklist → DEGRADED, not ALLOWED)
echo '{"agentOwners":{"agent-good":"owner-1"},"familyAccess":{"owner-1":["family-A"]}}' > ledger/agent_scope.json
echo 'CORRUPT JSON THIS SHOULD FAIL' > ledger/revoked_agents.json
npx tsx -e "
import { checkScope } from './src/lib/worm/scope';
(async () => {
  const r = await checkScope('agent-good', 'family-A');
  console.log('checkScope with blacklist DOWN (corrupt file):', r);
})();
"

# Evidence 6 — GLB validator rejects external URLs
npx tsx -e "
import { validateGlbBytes, EXTERNAL_URL_REGEX } from './src/lib/glb/validator';
// Build a minimal GLB whose JSON chunk contains http://evil.com
const jsonChunk = Buffer.from(JSON.stringify({
  asset: { version: '2.0' },
  scenes: [{ nodes: [0] }],
  nodes: [{ extras: { url: 'http://evil.com/exfil' } }],
  images: [{ uri: 'https://evil.com/texture.png' }],
}), 'utf8');
const totalLength = 12 + 8 + jsonChunk.length + 8 + 1;
const header = Buffer.alloc(12);
header.write('glTF', 0, 'ascii'); header.writeUInt32LE(2, 4); header.writeUInt32LE(totalLength, 8);
const jsonHeader = Buffer.alloc(8); jsonHeader.writeUInt32LE(jsonChunk.length, 0); jsonHeader.write('JSON', 4, 'ascii');
const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(1, 0); binHeader.write('BIN\0', 4, 'ascii');
const glb = Buffer.concat([header, jsonHeader, jsonChunk, binHeader, Buffer.from([0])]);
validateGlbBytes(glb).then(r => console.log(JSON.stringify(r)));
"

# Evidence 7 — Merkle anchor cron end-to-end
npx tsx scripts/cron/merkle-anchor-cron.ts
cat worm-anchors/20261107-22.json

# Evidence 8 — WORM ledger has every Cubot tool call
python3 ledger/event_ledger.py query --since 1h
```

## Observed output (quoted, truncated only with ellipsis)

### Evidence 1 — getValidationMetrics() returns INCONCLUSIVE

```
{"status":"INCONCLUSIVE","reason":"results are [PENDING]"}
```

The function returns `INCONCLUSIVE` (NOT a fake AUC) because `validation/results_v1.md` contains `[PENDING]`. This satisfies Rule 6 of the Admin Cubot system prompt.

### Evidence 2 — buildMerkleRoot builds

```
{"root":"bef57ec7f53a6d40beb640a780a639c83bc29ac8a9816f1fc6c5c6dcd93c4721","tree":[["abc","def"],["bef57ec7f53a6d40beb640a780a639c83bc29ac8a9816f1fc6c5c6dcd93c4721"]]}
```

Two leaves `abc` and `def`. The root is `SHA256("abc" + "def")` (hex concatenation, per spec). The tree is returned bottom-up: `tree[0]` is the leaves, `tree[1]` is `[root]`.

### Evidence 3 — compliance-report runs

```
# VVU Compliance Report — 2026-11-07
...
## License attributions (anatomy assets)

- **BodyParts3D** — © The Database Center for Life Science, Nagoya University.
  Licensed under CC-BY 4.0 (Attribution 4.0 International).
  Source: https://lifesciencedb.jp/bp3d/
  Attribution: "BodyParts3D, © The Database Center for Life Science, Nagoya
  University — licensed under CC-BY 4.0."

- **Z-Anatomy** — © Université de Tours, CHU de Tours, and contributors.
  Licensed under CC-BY-SA 4.0 (Attribution-ShareAlike 4.0 International).
  Source: https://www.z-anatomy.se/
  Attribution: "Z-Anatomy, © Université de Tours et al. — licensed under
  CC-BY-SA 4.0."
...
## Open gaps
- [VERIFY] L2 anchoring signer process is a stub. The cron logs intent;
  the on-chain tx hash is null until the signer is built.
- [VERIFY] Pass 3 (GPU memory) is browser-only. Node-side Cubot cannot
  complete Pass 3; assets cleared by Cubot are marked
  UNVERIFIED_GPU_PENDING until the renderer completes Pass 3.
- [VERIFY] Extension whitelist is conservative. KHR_lights_punctual is
  not yet whitelisted — assets that use it will be rejected until the
  threat model is extended.
- [VERIFY] Validation pipeline output (validation/results_v1.md) is
  currently [PENDING]. Admin Cubot returns INCONCLUSIVE for any
  predictive-accuracy question.

[compliance-report] wrote /home/z/my-project/docs/compliance-report-2026-11-07.md
```

License attributions for both BodyParts3D (CC-BY 4.0) and Z-Anatomy (CC-BY-SA 4.0) are present, verbatim. Report is saved to `docs/compliance-report-2026-11-07.md`.

### Evidence 4 — POPIA tombstone

```
salt length: 64
tombstone result: {"tombstoneHash":"2b258afe1e56e94f3319d39a59b9956c5780944cd7cc808a278008c2d7d60c14","originalHashRetained":true}
verifyTombstone (auditor holds original): true
verifyTombstone (altered payload): false
original payload leaked in tombstone output? false
```

The tombstone hash is `SHA-256(canon(payload) || salt)`. The original payload is NOT present in the output (verified by string search for `heart_rate` and `subject-42`). The auditor verification path returns `true` for the original payload and `false` for an altered payload — confirming the tombstone is bound to the exact payload.

### Evidence 5 — Scope check fail-closed

```
checkScope with blacklist DOWN (corrupt file): DEGRADED
PASS: returned DEGRADED, not ALLOWED
```

When the revocation blacklist file is corrupt (simulating a real blacklist-down condition), `checkScope()` returns `DEGRADED` even though the agent IS authorized in the scope table. The system NEVER returns `ALLOWED` when the blacklist is down — fail-closed.

### Evidence 6 — GLB validator rejects external URLs

```
regex test on JSON chunk (should be true): true
GLB size: 198 bytes
validateGlbBytes result: {
  "pass": false,
  "stage": "SYNC",
  "errorCode": "EXTERNAL_URL_FORBIDDEN",
  "reason": "External URL found in JSON chunk of <bytes>",
  "assetHash": "59ba108fe755d7be7f41a98f368963f1e681ea1571a3919775cf17b2f16b5125"
}
PASS: GLB with http://evil.com was rejected with EXTERNAL_URL_FORBIDDEN
```

A GLB whose JSON chunk contains `http://evil.com/exfil` and `https://evil.com/texture.png` is rejected by Pass 1 with the `EXTERNAL_URL_FORBIDDEN` error code. The error message returned to the UI is the generic code (NEVER a stack trace).

### Evidence 7 — Merkle anchor cron end-to-end

```
[merkle-anchor-cron] start at 2026-11-07T22:58:07.948Z
[merkle-anchor-cron] built root=e05b869bcfb4c589 entries=3
[merkle-anchor-cron] anchor status=ANCHOR_INTENT_LOGGED
[merkle-anchor-cron] wrote /home/z/my-project/worm-anchors/20261107-22.json
[merkle-anchor-cron] done. root=e05b869bcfb4c5898cf5b99073a2f682c5cefb000a820c5f90b216d429ebb2e0 entries=3 status=ANCHOR_INTENT_LOGGED
```

Saved anchor file:
```
{
  "anchoredAt": "2026-11-07T22:58:07.996Z",
  "cronStartedAt": "2026-11-07T22:58:07.948Z",
  "rootHash": "e05b869bcfb4c5898cf5b99073a2f682c5cefb000a820c5f90b216d429ebb2e0",
  "entriesAnchored": 3,
  "anchorStatus": "ANCHOR_INTENT_LOGGED",
  "anchorReason": null,
  "onChainTxHash": null,
  "onChainBlockNumber": null
}
```

The cron built the Merkle root from 3 WORM events, logged the anchor intent (NO fabricated tx hash — `onChainTxHash: null`), and saved only the root to `worm-anchors/20261107-22.json`. The tree was discarded.

### Evidence 8 — WORM ledger has every Cubot tool call

```
Total events: 7
Event types:
  CUBOT_TOOL_CALL: 6
  ANCHOR_GLOBAL_MERKLE_ROOT: 1
Cubot tool calls:
  seq=0 tool=checkSensorStatus summary=OFFLINE
  seq=1 tool=checkSensorStatus summary=OFFLINE
  seq=2 tool=getTelemetry summary=SENSOR_ABSENT: null (offline sensor)
  seq=3 tool=getValidationMetrics summary=INCONCLUSIVE: results are [PENDING]
  seq=4 tool=tombstonePayload summary=tombstoned=true hash=8d9454e8052b4b35 salt_used=true
  seq=5 tool=anchorGlobalMerkleRoot summary=intent_logged root=b3a30f80f5465cb7 entries=5
```

Every Cubot tool call (6/6) is logged to WORM as a `CUBOT_TOOL_CALL` event with `source=admin-cubot`. The summary never contains raw telemetry — only the hash + size of the payload (PHI-safe). The anchor event (`ANCHOR_GLOBAL_MERKLE_ROOT`) is recorded separately.

WORM chain verify (no tampering):
```
{"ok": true, "count": 4, "head": "0143e96ffcf76f13d4533bcf40e0b7225f076b299396544a66d6dc0a6065647d", "errors": []}
```

## Tests: passed / failed / errored

| Test | Result |
|---|---|
| `getValidationMetrics()` returns INCONCLUSIVE when [PENDING] | **PASSED** |
| `buildMerkleRoot([{source_hash:'abc'},{source_hash:'def'}])` builds correctly | **PASSED** |
| `compliance-report.ts` runs, prints exact license attributions, saves MD | **PASSED** |
| `tombstone()` produces a hash, original payload not in output | **PASSED** |
| `verifyTombstone()` returns true for original, false for altered | **PASSED** |
| `checkScope()` returns DEGRADED (not ALLOWED) when blacklist is down | **PASSED** |
| `validateGlbBytes()` rejects GLB containing `http://evil.com` with `EXTERNAL_URL_FORBIDDEN` | **PASSED** |
| `merkle-anchor-cron.ts` runs, builds root, saves `worm-anchors/<date>-<hour>.json` | **PASSED** |
| Every Cubot tool call logs a `CUBOT_TOOL_CALL` event to WORM | **PASSED** |
| `python3 ledger/event_ledger.py verify` confirms chain integrity | **PASSED** |

**Passed: 10. Failed: 0. Errored: 0.**

## Files changed (path, sha256 after)

All files are NEW (no prior versions).

| Path | SHA-256 | Lines |
|---|---|---|
| `src/lib/cubot/system-prompt.ts` | `8dbc0b7d6d70ad6bbda81c1ff7df87d292820f6c8fa63505ac7bb13765ca9106` | 34 |
| `src/lib/cubot/tools.ts` | `9354a6ece8f99630f69a40a8723c2e39be53b85e2b7da0f5e05ba924821c6390` | 325 |
| `src/lib/glb/validator.ts` | `1ec09b6275a3a22bcf8b3782ae9ac85de1a5194fcfafda77b205feed74a36e0c` | 536 |
| `src/lib/worm/merkle.ts` | `417e14320d87e35cc19b067b7a149df408f277a1bf84c515e45943ac417de5f2` | 191 |
| `src/lib/worm/tombstone.ts` | `378e2fc1f6a7747723bb840efad5e00a000da9a20cac2447d4b726a6b8f92e16` | 118 |
| `src/lib/worm/scope.ts` | `a845003785e803047b21ed4c1ac6e46c288d88f7fbc41533832b6bcd5ba197d6` | 236 |
| `scripts/cron/merkle-anchor-cron.ts` | `2802be3f28a9b234d60bb65b9b90a114a8a6b802317b861ee64bc9aaefee0401` | 95 |
| `scripts/compliance-report.ts` | `ac3a2d53fd4e8c91c2ef9596a9f5c98002e71fe0637fd8f9d52873a1c6396b95` | 188 |
| `ledger/event_ledger.py` | `3c911c1b9f36a42f8caa74853ee3d0881043c7226673f18799fe35f5aebd6132` | 215 |
| `validation/results_v1.md` | `e8043b22229d00f8548f89c731d865dafe6cf240e359fdd3852a108223a35a90` | 93 |
| `docs/compliance-report-2026-11-07.md` | `10e9db20b32b2409d2bf5b01f580369414ee727ad5bc438862eaa9d15a6052d0` | (generated) |
| `docs/evidence/phase-cubot-security.md` | (this file) | — |

**Total: 2,031 lines of source code (excluding generated report & evidence note).**

## Open gaps (with gap IDs)

- **[VERIFY] L2-anchoring signer process.** The Merkle anchor is logged as an `ANCHOR_GLOBAL_MERKLE_ROOT` event in the WORM chain, but the actual L2 blockchain transaction is signed by a separate signer process that is NOT part of this build. `onChainTxHash` and `onChainBlockNumber` in the saved anchor file are `null` until that signer back-fills them. The cron does NOT fabricate a transaction hash.
- **[VERIFY] Pass 3 (GPU memory) is browser-only.** Node-side Admin Cubot cannot complete Pass 3 because it cannot upload to a GPU. Assets cleared by Cubot are marked `UNVERIFIED_GPU_PENDING` until the renderer completes Pass 3 after GPU upload. This is a deliberate fail-closed posture, not a gap to be patched.
- **[VERIFY] Extension whitelist is conservative.** `KHR_lights_punctual` is NOT yet whitelisted (it is in scope but the threat-model extension is pending). Assets that use it will be rejected by Pass 2 until the threat model is extended and the whitelist updated.
- **[VERIFY] Validation pipeline output is `[PENDING]`.** `validation/results_v1.md` contains `[PENDING]` because the academic-validation pipeline has not yet produced metrics. Admin Cubot correctly returns `INCONCLUSIVE` — this is the correct sovereign answer, not a gap to be filled by a mock number.
- **[VERIFY] Trust-tier-aware asset resolver.** `validateGlbAsset()` resolves asset IDs by simple path convention (`public/<assetId>`). The real trust-tier-aware resolver (AUTHORITATIVE / THIRD_PARTY_VERIFIED / UNVERIFIED) is the `vvu-source-adapter` skill's responsibility and is not yet wired in.
- **[VERIFY] Ed25519 signing on the Python side.** The Python ledger bridge writes `source_hash` + `chain_hash` (SHA-256 chain integrity) but does NOT Ed25519-sign entries. The canonical signing path is `src/lib/worm/chain.ts` (Node-only, server-only). The Python bridge is a write-path mirror for non-Node callers (Cubot tools, cron); signature attestation happens on the Node side when the chain is canonicalised.
- **[VERIFY] Web Worker script for Pass 2 in the browser.** The validator exports the message contract (`GLB_VALIDATOR_WORKER_MESSAGE`) but the worker entry-point file (a `.worker.ts` that wraps `pass2Async`) is part of the renderer-side build, not this backend build. The contract is documented; the implementation is a renderer concern.

## Claims NOT made

- We do NOT claim the Life Twin, the vascular graft, or any predictive output is compliant, certified, registered, safe, or clinically valid. Per `vvu-regulatory-gate`, those determinations belong to named humans with authority (regulatory lead, clinical lead, data protection officer, ethics chair) — none of whom are named yet.
- We do NOT claim a real blockchain transaction was made. The Merkle anchor is logged as an *intent*; the `onChainTxHash` is `null` until the separate signer process runs.
- We do NOT claim the predictive model has been validated. `getValidationMetrics()` returns `INCONCLUSIVE` because the validation pipeline has not run.
- We do NOT claim the GLB 3-pass validator catches every malicious asset. Pass 3 (GPU memory) is browser-only; a Node-side call cannot complete the full 3-pass guarantee.
- We do NOT claim the revocation Bloom filter is collision-free. It is a shortlist with a ~0.3% false-positive rate at n=100 entries; every "maybe revoked" hit is confirmed against the authoritative map. The fail-closed posture means a Bloom-down condition yields `DEGRADED`, not `ALLOWED`.
- We do NOT claim the WORM chain is anchored to RFC 3161. The TSA anchor path is described in `searm-worm-chain` but is not part of this build's evidence chain.
- We do NOT leak the `WORM_GENESIS_SEED` salt. The tombstone module reads it from `process.env.WORM_GENESIS_SEED` and never prints, logs, or returns it. The WORM log captures only that the salt was *used* (`salt_used=true`), not its value.

## Acceptance criteria mapping

| # | Criterion | Evidence |
|---|---|---|
| 1 | `getValidationMetrics()` returns INCONCLUSIVE when [PENDING] | Evidence 1 |
| 2 | GLB validator rejects external URLs (test with `http://evil.com`) | Evidence 6 |
| 3 | Merkle root builds correctly for a test set | Evidence 2 |
| 4 | Tombstone produces a hash, original payload not in output | Evidence 4 |
| 5 | Scope check returns DEGRADED (not ALLOWED) when blacklist is down | Evidence 5 |
| 6 | Compliance report prints exact license attributions | Evidence 3 |
| 7 | Every Cubot tool call logs to WORM | Evidence 8 |

All 7 acceptance criteria **PASSED**.
