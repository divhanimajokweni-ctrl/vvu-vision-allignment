Phase: phase-validation-framework
Goal: Build the validation infrastructure that enforces 'no claim without a frozen protocol, held-out data, and 95% confidence intervals.'
Commands run (exact):
```
# 1. Compute SHA-256 of the placeholder protocol file (pre-anchor).
sha256sum validation/protocol_v1.md
# 2. Embed the hash in the protocol's "Frozen hash" field, then re-compute.
# (Edit protocol_v1.md -> replace PROTOCOL_HASH_PLACEHOLDER with the hash.)
sha256sum validation/protocol_v1.md
# 3. Update validation/manifest.json protocol_hash field to the pre-anchor hash.
# (Edit manifest.json.)
# 4. Initialise the WORM ledger.
cd /home/z/repo-push/vvu-searm-core && python3 ledger/event_ledger.py init
# 5. Append the PROTOCOL_FROZEN event with the pre-anchor hash + post-anchor hash.
python3 ledger/event_ledger.py append --type PROTOCOL_FROZEN --source validation \
  --payload '{"protocol":"v1","hash":"06ff6c1ac8b5c53c354f50721490a726cbcec375ccee72deddf34a43cc14e237","frozen_at":"2026-11-07T22:52:03Z","file":"validation/protocol_v1.md","task":"2-validation","post_anchor_hash":"73fc8284d02a52f4b5a6561d23f0f6364b9a86a0db0e070e6d5b8327a7bc7200"}'
# 6. Verify the ledger.
python3 ledger/event_ledger.py verify
# 7. Smoke-test MISSING_PROTOCOL (Python side): rename protocol, run, restore.
mv validation/protocol_v1.md validation/protocol_v1.md.tmp_hidden && \
  python3 validation/run_validation.py ; rc=$? ; \
  mv validation/protocol_v1.md.tmp_hidden validation/protocol_v1.md ; echo "exit $rc"
# 8. Run the full validation end-to-end (overwrites results_v1.md, writes manifest_generated.json).
python3 validation/run_validation.py
# 9. TypeScript: test ProtocolRegistry.require/hash/MISSING_PROTOCOL + EvidenceLog separation.
bun tests/evidence/registry-and-evidencelog.test.ts
# 10. TypeScript: test ProtocolRegistry.verifyLedger + logToWorm path (SELFTEST event).
bun tests/evidence/protocolregistry-ledger.test.ts
# 11. TypeScript type-check on the new modules.
npx tsc --noEmit --strict --target ES2020 --module esnext --moduleResolution bundler \
  --esModuleInterop --skipLibCheck src/lib/evidence/EvidenceLog.ts src/lib/evidence/ProtocolRegistry.ts
# 12. Regression check: existing FFT parity tests still pass.
bun test src/lib/fft/__tests__/
```
[OBSERVED] output (quoted, truncated only with ellipsis):
```
# 1. Pre-anchor SHA-256 of protocol_v1.md (with PROTOCOL_HASH_PLACEHOLDER)
06ff6c1ac8b5c53c354f50721490a726cbcec375ccee72deddf34a43cc14e237  validation/protocol_v1.md

# 2. Post-anchor SHA-256 of protocol_v1.md (with the hash embedded)
73fc8284d02a52f4b5a6561d23f0f6364b9a86a0db0e070e6d5b8327a7bc7200  validation/protocol_v1.md
# (Self-referential hash honesty note: the post-anchor hash differs from the
#  pre-anchor hash. The ledger is anchored to the PRE-anchor hash
#  06ff6c1a..., which is the canonical frozen identity. See protocol section 9.)

# 4. Ledger init
Ledger initialized. Genesis: 2cb11cee5df36b64...

# 5. Ledger append (PROTOCOL_FROZEN, seq 1)
Appended seq 1 chain_hash 1189d6981b34a430...
# Payload (canonical JSON, sorted keys):
# {"file":"validation/protocol_v1.md","frozen_at":"2026-11-07T22:52:03Z",
#  "hash":"06ff6c1ac8b5c53c354f50721490a726cbcec375ccee72deddf34a43cc14e237",
#  "post_anchor_hash":"73fc8284d02a52f4b5a6561d23f0f6364b9a86a0db0e070e6d5b8327a7bc7200",
#  "protocol":"v1","task":"2-validation"}

# 6. Ledger verify
CHAIN INTACT: 2 entries verified. Head: 1189d6981b34a430... Genesis: 2cb11cee5df36b64...
# exit 0

# 7. MISSING_PROTOCOL smoke test (Python side)
=== VVU Validation Run - protocol_v1.md ===
  started: 2026-11-07T22:55:29.050289+00:00
ERROR: MISSING_PROTOCOL
  expected: /home/z/my-project/validation/protocol_v1.md
  A frozen protocol must exist before any validation runs.
=== exit 2 ===
# (protocol file restored; hash unchanged after restore: 73fc8284...)

# 8. Full validation run
=== VVU Validation Run - protocol_v1.md ===
  started: 2026-11-07T22:57:40.071104+00:00
  protocol_hash: 73fc8284d02a52f4b5a6561d23f0f6364b9a86a0db0e070e6d5b8327a7bc7200
  generating dev split (1000 normal)...
  generating held-out split (1000 normal + 100 anomalous)...
  dev_hash:    020dcbb6748e229b71c315875be520753fa00dc96d70638c215e64dd342b591c
  heldout_hash:b927f01b910730a755898c5f2ad58928a3d530abfe2cdb5709956d05bb7d1996
  detector: /home/z/my-project/src/lib/fft/vvu_predictive_watchdog.py
  scoring dev split...
  threshold tau (99th pct of dev): 11.000000
  scoring held-out split...
  confusion: TP=0 FP=34 FN=100 TN=966
  AUC: 0.9316 [0.9130, 0.9485]
  Sens: 0.0000 [0.0000, 0.0370]
  Spec: 0.9660 [0.9529, 0.9756]
  Prec: 0.0000 [0.0000, 0.1015]
  FAR/h: 122.4000 [87.9529, 169.6867]
  results_v1.md written.
=== RUN COMPLETE ===
# exit 0
# Honest finding: while specificity lower CI (0.9529) exceeds the 0.90
# threshold, sensitivity is 0.0 - the detector flags zero anomalies. The
# compound claim in protocol_v1.md section 1 is therefore NOT SUPPORTED.
# This is the protocol section 6.5 "threshold yielding 0 sensitivity"
# failure mode, reported in full in results_v1.md section 6.

# 9. TypeScript registry/EvidenceLog tests
--- Test 1: protocol v1 exists, hash is computed ---
hash(v1): 73fc8284d02a52f4b5a6561d23f0f6364b9a86a0db0e070e6d5b8327a7bc7200
PASS: hash matches post-anchor SHA-256 (current file state).
--- Test 2: require(v1) succeeds when file is present ---
require(v1) returned: /home/z/my-project/validation/protocol_v1.md
PASS: no throw when file is present.
--- Test 3: MISSING_PROTOCOL when protocol is absent ---
PASS: threw MissingProtocolError with code MISSING_PROTOCOL
     message: MISSING_PROTOCOL: no frozen protocol at /home/z/my-project/validation/protocol_v1.md...
     (restored protocol file)
--- Test 4: EvidenceLog separation ---
PASS: observed and expected are present and distinct.
PASS: builder has no method that cross-writes the slots.
=== ALL TESTS PASSED ===

# 10. TypeScript ledger integration tests
--- TypeScript ProtocolRegistry.verifyLedger() ---
stdout: CHAIN INTACT: 2 entries verified. Head: 1189d6981b34a430... Genesis: 2cb11cee5df36b64...
PASS: TypeScript can call the Python ledger and verify it.
--- TypeScript ProtocolRegistry.logToWorm() (SELFTEST event) ---
stdout: Appended seq 2 chain_hash 7d4cfd4dec2f568e...
PASS: TypeScript-to-Python ledger append works.
--- Ledger verify after SELFTEST append ---
stdout: CHAIN INTACT: 3 entries verified. Head: 7d4cfd4dec2f568e... Genesis: 2cb11cee5df36b64...
PASS: ledger still CHAIN INTACT with 3 entries (genesis + PROTOCOL_FROZEN + SELFTEST).
=== PROTOCOL_REGISTRY_TS_TESTS_PASSED ===

# 11. TypeScript type-check
(npx tsc --noEmit on EvidenceLog.ts and ProtocolRegistry.ts)
=== exit 0 ===
# (no output -> no type errors)

# 12. FFT parity regression check
# All 6 existing FFT tests pass:
"Test 1: 5 Hz sine peak at ~5 Hz within one bin width"  pass: true
"Test 2: 14.2 Hz sine peak at ~14.2 Hz within one bin width"  pass: true
"Test 3: 30 Hz sine peak at ~30 Hz within one bin width"  pass: true
"Test 4: 60 Hz tone at fs=100 must NOT appear at 60 Hz (aliasing)"  pass: true
"Test 5: Missing baseline -> INCONCLUSIVE (baseline_missing)"  pass: true
"Test 6: Baseline < 72h -> INCONCLUSIVE (baseline_too_short)"  pass: true
# exit 0
```
[EXPECTED] output (kept separate from observed; NOT a substitute for observed):
```
# What was expected from each command, kept strictly separate from OBSERVED.
# 1. Pre-anchor hash: a 64-hex-char SHA-256 starting with some prefix.
# 2. Post-anchor hash: a DIFFERENT 64-hex-char SHA-256 (because the file changed).
# 4. Ledger init: "Ledger initialized. Genesis: <hex>..."
# 5. Ledger append: "Appended seq 1 chain_hash <hex>..."
# 6. Ledger verify: "CHAIN INTACT: 2 entries verified. Head: <hex>... Genesis: <hex>..."
# 7. MISSING_PROTOCOL: stderr "ERROR: MISSING_PROTOCOL", exit code 2, no results_v1.md mutation.
# 8. Full validation: deterministic numbers (seed=42); threshold tau around 11 Hz;
#    confusion matrix with TP+FN=100 and FP+TN=1000; AUC somewhere in [0.5, 1.0];
#    Wilson CIs with lower bound above 0 for non-degenerate cells.
#    Expected honest finding: EITHER the claim is supported (both sens and spec
#    lower CIs > 0.90) OR it is not. The script must NOT fake support.
# 9. TS tests: all four sub-tests PASS, including MISSING_PROTOCOL throwing.
# 10. TS ledger tests: verifyLedger returns CHAIN INTACT; logToWorm appends;
#     ledger still verifies after the append.
# 11. TypeScript type-check: exit 0, no output (no type errors).
# 12. FFT parity tests: all 6 pass (no regression).
```
Tests: passed=13 / failed=0 / errored=0
Failing tests:
  (none)
Files changed (path, sha256 before, sha256 after):
  - validation/protocol_v1.md
    before: <missing>
    after:  73fc8284d02a52f4b5a6561d23f0f6364b9a86a0db0e070e6d5b8327a7bc7200
  - validation/manifest.json
    before: <missing>
    after:  21ed0519b1a81f60648f77ae1c90f3033829552ad7536204f1e1e75f3061e35b
  - validation/results_v1.md
    before: <missing>
    after:  e8043b22229d00f8548f89c731d865dafe6cf240e359fdd3852a108223a35a90
  - validation/run_validation.py
    before: <missing>
    after:  a6f8570585a2e413d31a59ba9c1cf4db98153b8500465df5bbed5fbd234b9aa1
  - validation/manifest_generated.json
    before: <missing>
    after:  d322fe351866e4aeb03eff5c331150dfb2f1be20ea9dac16b043abb29be82d50
  - src/lib/evidence/EvidenceLog.ts
    before: <missing>
    after:  dbbe447f1ac147ec43dabc09a63990293ee5514fbdcf7a6b7b921701ab7bbe98
  - src/lib/evidence/ProtocolRegistry.ts
    before: <missing>
    after:  4b03fbe68645045ce1e8b1e2252281b97be17030bc35344e225b365072b275aa
  - docs/evidence/phase-validation-framework.md
    before: <missing>
    after:  <written-by-this-builder>
Open gaps (with gap IDs from MANIFEST.md):
  - GAP-VALIDATION-001: Self-referential hash. SHA-256 is one-way; no file can contain its own hash as a stable fixed point. The protocol's 'Frozen hash' field holds the PRE-anchor hash (06ff6c1a...); the file's CURRENT hash is the POST-anchor hash (73fc8284...). The ledger is anchored to the PRE-anchor hash. See protocol section 9.
  - GAP-VALIDATION-002: Detector API mismatch. The existing detector (src/lib/fft/vvu_predictive_watchdog.py) exports 'spectral_peak(signal, fs)', not the 'fft_anomaly_score(window, fs)' initially specified. run_validation.py wraps 'spectral_peak' into an 'anomaly_score' inline; the detector module itself is left untouched. A future protocol may promote the wrapper into the detector module if it proves stable.
  - GAP-VALIDATION-003: Zero-sensitivity finding. The frozen threshold-tuning rule (99th percentile of dev anomaly scores) produced tau=11.0 Hz, which is above every held-out anomaly score (anomalies at 20-24 Hz give scores 6-10). The detector flags zero anomalies (TP=0). The compound claim in protocol_v1.md section 1 is NOT SUPPORTED. This is a genuine negative result, reported in full in results_v1.md section 6. A follow-up protocol (protocol_v2.md) would be required to re-tune the threshold on dev data using a different rule (e.g. 50th percentile) - that re-tuning MUST NOT be done on the held-out split.
  - GAP-VALIDATION-004: Simulated data only. The validation dataset is Gaussian noise + sine waves. The detector's measured specificity (96.6%) and AUC (0.93) on this dataset do NOT generalise to real-world vibration spectra, which differ in unknown ways. See protocol section 7 (out-of-scope).
  - GAP-VALIDATION-005: No adversarial cases tested. The protocol does not exercise clock skew, dropped frames, or replayed frames. A separate protocol (protocol_adversarial_v1.md) is required before any claim about robustness can be made.
Claims NOT made:
  - NOT claiming the FFT detector is clinically valid or diagnostic for any patient.
  - NOT claiming the FFT detector is safe for any mechanical system from this bench test.
  - NOT claiming the detector generalises to real-world vibration spectra.
  - NOT claiming specificity > 90% is sufficient for deployment - the compound claim fails on sensitivity.
  - NOT claiming the validation results generalise beyond the simulated dataset (seed=42).
  - NOT claiming the post-anchor protocol_v1.md hash (73fc8284...) is the canonical frozen identity - the canonical identity is the pre-anchor hash (06ff6c1a...), as anchored in the WORM ledger.
  - NOT claiming the SELFTEST ledger event (seq 2) is a real protocol freeze - it is a TypeScript-to-Python integration smoke test only.
  - NOT claiming the threshold tau=11.0 Hz is optimal - it is the frozen threshold per the protocol's 99th-percentile rule, and it produces zero sensitivity.

Evidence note written at: 2026-11-07T23:00:45.085Z
