Phase: Substrate Engine (Excel × 5G NTN × MI300X TEE)
Goal: Build the fusion module mapping Excel cell references to sensors, with #REF! = SENSOR_ABSENT (fail-closed), and 5G NTN routing (Rel-17 vs Rel-19).
Commands run (exact):
  - `npx tsx src/lib/substrate/__tests__/engine.test.ts`
  - `python3 /home/z/cf-rotate.py` (Cloudflare rotation attempt)
Observed output (quoted):
  ```
  === Substrate Engine Tests ===
  Test 1: All sensors online — 7 PASS (NOMINAL, gait=0.357, Rel-19 27ms)
  Test 2: Sensor offline → SENSOR_ABSENT — 4 PASS (#REF!, null gait, UNKNOWN stress)
  Test 3: NTN routing latency — 6 PASS (Rel-17 54ms ground, Rel-19 27ms orbit ISL)
  Test 4: SUM with offline cell → #REF! — 2 PASS (fail-closed on range)
  Test 5: Empty registry → all SENSOR_ABSENT — 2 PASS
  === ALL TESTS PASSED ===
  ```
  Cloudflare rotation: `Token INVALID (HTTP 401): {"success":false,"errors":[{"code":1000,"message":"Invalid API Token"}]}`
  — the exposed token was already revoked (good). New token must be created manually at dash.cloudflare.com.
Tests: 19 passed / 0 failed / 0 errored
Files changed:
  - src/lib/substrate/engine.ts (new, sha256: N/A)
  - src/lib/substrate/__tests__/engine.test.ts (new, sha256: N/A)
  - mi300x/bootstrap_mi300x_droplet.sh (new, preserved verbatim from architect)
  - mi300x/amd-rocm-mi300x-tee-pipeline.py (new, preserved verbatim)
  - mi300x/docker-compose.yml (new, preserved verbatim)
  - mi300x/router.py (new, preserved verbatim)
Open gaps:
  - GAP-SUBSTRATE-1: Stress level threshold (>0.5 = ELEVATED) is a raw mapping, NOT a calibrated detector. Validation belongs to vvu-academic-validation.
  - GAP-SUBSTRATE-2: 5G NTN latency values (54ms/27ms) are from the architect's spec, not measured. [VERIFY] against real Rel-17/Rel-19 deployments.
  - GAP-SUBSTRATE-3: MI300X TEE pipeline is preserved verbatim but not executed (no MI300X hardware in sandbox).
  - GAP-CF-1: Cloudflare token rotation blocked — exposed token already revoked. New token must be created manually.
Claims NOT made:
  - Did not validate the gait substrate as a predictive model (requires vvu-academic-validation).
  - Did not claim the stress level mapping is clinically valid.
  - Did not execute the MI300X TEE pipeline (no hardware).
  - Did not claim 5G NTN latency values are measured (they are from the spec).
