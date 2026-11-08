Phase: FFT Integrity
Goal: Build predictive FFT watchdog with correct math (k*fs/N, Hann window, no probability)

Commands run (exact):
- `mkdir -p /home/z/my-project/src/lib/fft/__tests__ /home/z/my-project/docs/evidence`
- `cd /home/z/my-project && bun src/lib/fft/__tests__/fft_vectors.test.ts 2>&1`
- `cd /home/z/my-project && python3 src/lib/fft/__tests__/parity_check.py 2>&1`
- `cd /home/z/my-project && grep -rnE "0\.87|2\.8|failureProbability|fft_peak_hz" src/lib/fft/` (exit 1 = ZERO matches)
- `cd /home/z/my-project && sha256sum src/lib/fft/predictiveWatchdog.ts src/lib/fft/vvu_predictive_watchdog.py src/lib/fft/__tests__/fft_vectors.test.ts src/lib/fft/__tests__/parity_check.py`
- `cd /home/z/my-project && wc -l src/lib/fft/predictiveWatchdog.ts src/lib/fft/vvu_predictive_watchdog.py src/lib/fft/__tests__/fft_vectors.test.ts src/lib/fft/__tests__/parity_check.py`

Notes on environment:
- `bun --version` => 1.3.14
- `python3 --version` => Python 3.12.16
- `python3 -c "import numpy; print(numpy.__version__)"` => 2.1.3
- No npm dependency was added. The TS FFT is a hand-written iterative
  radix-2 Cooley-Tukey implementation. The Python FFT uses numpy.
  No vitest was installed; the TS test is a standalone runnable script
  executed directly by `bun`.

Observed output (quoted, truncated only with ellipsis):

[OBSERVED] TypeScript run (`bun src/lib/fft/__tests__/fft_vectors.test.ts`):
```
=== TypeScript FFT Vectors Test Results ===
window=Hann  fs=100  N=1024  binWidthHz=0.09765625
thresholdRule: |deviation| > 0.5 (i.e. > 50% from baseline peak magnitude) => ANOMALY; otherwise NOMINAL

[PASS] Test 1: 5 Hz sine peak at ~5 Hz within one bin width
        actual=4.980469 Hz  expected=5 Hz  binWidth=0.097656 Hz  verdict=NOMINAL
[PASS] Test 2: 14.2 Hz sine peak at ~14.2 Hz within one bin width
        actual=14.160156 Hz  expected=14.2 Hz  binWidth=0.097656 Hz  verdict=NOMINAL
[PASS] Test 3: 30 Hz sine peak at ~30 Hz within one bin width
        actual=29.980469 Hz  expected=30 Hz  binWidth=0.097656 Hz  verdict=NOMINAL
[PASS] Test 4: 60 Hz tone at fs=100 must NOT appear at 60 Hz (aliasing)
        actual=40.039063 Hz  expected=40 Hz  binWidth=0.097656 Hz  verdict=NOMINAL
[PASS] Test 5: Missing baseline -> INCONCLUSIVE (baseline_missing)
        actual={"verdict":"INCONCLUSIVE","reason":"baseline_missing"}  expected={"verdict":"INCONCLUSIVE","reason":"baseline_missing"}
[PASS] Test 6: Baseline < 72h -> INCONCLUSIVE (baseline_too_short)
        actual={"verdict":"INCONCLUSIVE","reason":"baseline_too_short","baselineHours":10}  expected={"verdict":"INCONCLUSIVE","reason":"baseline_too_short","baselineHours":10}

Total: 6 | Passed: 6 | Failed: 0
```
Process exit code: 0.

[OBSERVED] Python run (`python3 src/lib/fft/__tests__/parity_check.py`):
```
=== Python FFT Vectors Test Results ===
window=Hann  fs=100  N=1024  binWidthHz=0.09765625
thresholdRule: |deviation| > 0.5 (i.e. > 50% from baseline peak magnitude) => ANOMALY; otherwise NOMINAL

[PASS] Test 1: 5 Hz sine peak at ~5 Hz within one bin width
        actual=4.980469 Hz  expected=5 Hz  binWidth=0.097656 Hz  verdict=NOMINAL
[PASS] Test 2: 14.2 Hz sine peak at ~14.2 Hz within one bin width
        actual=14.160156 Hz  expected=14.2 Hz  binWidth=0.097656 Hz  verdict=NOMINAL
[PASS] Test 3: 30 Hz sine peak at ~30 Hz within one bin width
        actual=29.980469 Hz  expected=30 Hz  binWidth=0.097656 Hz  verdict=NOMINAL
[PASS] Test 4: 60 Hz tone at fs=100 must NOT appear at 60 Hz (aliasing)
        actual=40.039063 Hz  expected=40 Hz  binWidth=0.097656 Hz  verdict=NOMINAL
[PASS] Test 5: Missing baseline -> INCONCLUSIVE (baseline_missing)
        actual={"verdict": "INCONCLUSIVE", "reason": "baseline_missing"}  expected={"verdict": "INCONCLUSIVE", "reason": "baseline_missing"}
[PASS] Test 6: Baseline < 72h -> INCONCLUSIVE (baseline_too_short)
        actual={"verdict": "INCONCLUSIVE", "reason": "baseline_too_short", "baselineHours": 10}  expected={"verdict": "INCONCLUSIVE", "reason": "baseline_too_short", "baselineHours": 10}

Total: 6 | Passed: 6 | Failed: 0
```
Process exit code: 0.

[OBSERVED] Acceptance grep (`grep -rnE "0\.87|2\.8|failureProbability|fft_peak_hz" src/lib/fft/`):
```
(no output — exit code 1, meaning ZERO matches)
```

[OBSERVED] Cross-language peak-frequency parity (TS vs Python, both at
fs=100, N=1024, binWidth=0.09765625 Hz):
```
Test 1 (5 Hz input):   TS=4.98046875 Hz   PY=4.98046875 Hz   |Δ|=0.00000000 Hz  (within 1 bin)
Test 2 (14.2 Hz input): TS=14.16015625 Hz  PY=14.16015625 Hz  |Δ|=0.00000000 Hz  (within 1 bin)
Test 3 (30 Hz input):  TS=29.98046875 Hz  PY=29.98046875 Hz  |Δ|=0.00000000 Hz  (within 1 bin)
Test 4 (60 Hz @ fs=100, aliases to 40 Hz): TS=40.0390625 Hz  PY=40.0390625 Hz  |Δ|=0.0000000 Hz (within 1 bin; NOT at 60 Hz)
Test 5 (missing baseline): both INCONCLUSIVE / baseline_missing
Test 6 (baseline < 72h):   both INCONCLUSIVE / baseline_too_short, baselineHours=10
```

Tests: 6 passed / 0 failed / 0 errored (TypeScript); 6 passed / 0 failed / 0 errored (Python). No failures to name.

Files changed (path, sha256 before, sha256 after):
- src/lib/fft/predictiveWatchdog.ts            — before: N/A (new file) — after: 992b1e874bd06a19573622e503cb6a00c066cf03675b59c836947e55497aec1e (274 lines)
- src/lib/fft/vvu_predictive_watchdog.py       — before: N/A (new file) — after: 2e43284ddc68fe75ffffc8b2de1b759c46c718859d5389809469e3a2492a9dae (139 lines)
- src/lib/fft/__tests__/fft_vectors.test.ts    — before: N/A (new file) — after: ea2d786bfd8e1f409cf4a74642281e33c01a4c553e51955722272a9763257237 (196 lines)
- src/lib/fft/__tests__/parity_check.py        — before: N/A (new file) — after: 56dc6aded0a2cea8e0d6e0e2cc16800618efdd2a2ad139ed3ead87f30185eb0b (176 lines)

Statement of window, fs, N, and bin width used (per SKILL.md requirement):
- Window: periodic Hann, w[n] = 0.5 - 0.5*cos(2*pi*n/N), length N.
- fs: 100 Hz (test vectors); the value is taken from the input and stated in
  every non-INCONCLUSIVE output.
- N: 1024 (test vectors); in general N = next power of two >= frame.length,
  and is stated in every non-INCONCLUSIVE output.
- Bin width: fs/N = 100/1024 = 0.09765625 Hz; stated in every
  non-INCONCLUSIVE output as `binWidthHz`.

Frequency mapping rule (per SKILL.md): f_k = k * fs / N. The multiplier is
always fs/N, derived from the input — never a hardcoded constant.

Verdict threshold rule (stated in every non-INCONCLUSIVE output):
`|deviation| > 0.5 (i.e. > 50% from baseline peak magnitude) => ANOMALY;
otherwise NOMINAL`, where deviation = (currentPeakMagnitude -
baselineStatistic) / baselineStatistic and baselineStatistic is the baseline
window's peak FFT magnitude.

Acceptance criteria check (all must pass):
1. grep -r "0.87|2.8|failureProbability|fft_peak_hz" src/lib/fft/ => ZERO hits. PASS (grep exit 1).
2. TS and Python return the same peak frequencies for the same input
   (within one bin width). PASS — bit-identical for all 4 frequency vectors.
3. Missing/short baseline returns INCONCLUSIVE — no probability, no
   verdict. PASS — Tests 5 & 6 in both languages.
4. Output includes window, fs, N, binWidthHz — no hardcoded values.
   PASS — all four fields are present and input-derived in every
   non-INCONCLUSIVE result.
5. Evidence note has real [OBSERVED] output, not "it works". PASS — see
   the [OBSERVED] blocks above.

Open gaps (with gap IDs from MANIFEST.md):
- gap-fft-1: The verdict threshold (50% deviation from baseline peak
  magnitude) is a single threshold on a single peak. Per the SKILL.md
  "Required traits" note, this is NOT a validated detector. It is a
  spectral observation with a stated rule. Validation as a predictive
  model belongs to vvu-academic-validation.
- gap-fft-2: The baseline statistic is the peak magnitude of a single
  representative window of length N. It does NOT aggregate across the full
  baseline duration. A production deployment should compute the baseline
  statistic from a representative sample of the full 72h+ history (e.g.
  median of peak magnitudes across many windows). The current
  implementation is correct for the test vectors but is the thinnest
  possible interpretation of "baseline statistic"; a richer statistic is
  deferred.
- gap-fft-3: The baseline duration (baselineHours) is caller-provided
  metadata, not derived from baseline.length / fs / 3600. This was a
  deliberate choice to avoid requiring a 25.92M-sample array at fs=100 for
  a 72h baseline. The caller is responsible for truthfully reporting the
  baseline duration. A future hardening pass could cross-check the
  reported duration against the baseline array length.
- gap-fft-4: No npm test runner (vitest/jest) was installed per the Golden
  Rule. The TS test is a standalone script run directly by `bun`. If the
  project later adopts a test runner, this script can be wrapped in a
  `describe/it` block without changing the assertions.

Claims NOT made:
- Did not validate the detector as a predictive model (that requires
  vvu-academic-validation).
- Did not claim clinical validity.
- Did not claim the 50% threshold is calibrated — it is a stated rule, not
  a learned or statistically validated cutoff.
- Did not claim the baseline statistic generalises beyond the
  representative-window interpretation used here.
- Did not claim the module is production-ready; it is correct against the
  six test vectors and the parity check, nothing more.
