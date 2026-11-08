"""VVU FFT Integrity — Python parity runner.

Runs the same six test vectors as `fft_vectors.test.ts` through the Python
implementation `vvu_predictive_watchdog.predictive_watchdog`. Prints a
human-readable report followed by a JSON array of per-case results, so the
TS test harness can diff the two outputs.

Run:
  python3 src/lib/fft/__tests__/parity_check.py
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any, Dict, List

import numpy as np

# Allow running directly from the repo root or from __tests__.
_HERE = os.path.dirname(os.path.abspath(__file__))
_PARENT = os.path.abspath(os.path.join(_HERE, ".."))
if _PARENT not in sys.path:
    sys.path.insert(0, _PARENT)

from vvu_predictive_watchdog import (  # noqa: E402  (path setup above)
    THRESHOLD_RULE,
    predictive_watchdog,
)

FS = 100  # Hz
N = 1024  # samples
BIN_WIDTH = FS / N  # 0.09765625 Hz


def sine_wave(freq_hz: float, fs: float, n: int, amplitude: float = 1.0) -> List[float]:
    t = np.arange(n) / fs
    return (amplitude * np.sin(2.0 * np.pi * freq_hz * t)).tolist()


def main() -> int:
    results: List[Dict[str, Any]] = []

    # ---- Test 1: 5 Hz --------------------------------------------------
    frame = sine_wave(5, FS, N)
    baseline = sine_wave(5, FS, N)
    r = predictive_watchdog(frame, baseline, FS, 100)
    results.append({
        "name": "Test 1: 5 Hz sine peak at ~5 Hz within one bin width",
        "pass": abs(r["peakHz"] - 5) <= BIN_WIDTH,
        "expected": 5,
        "actual": r["peakHz"],
        "binWidth": BIN_WIDTH,
        "verdict": r["verdict"],
    })

    # ---- Test 2: 14.2 Hz -----------------------------------------------
    frame = sine_wave(14.2, FS, N)
    baseline = sine_wave(14.2, FS, N)
    r = predictive_watchdog(frame, baseline, FS, 100)
    results.append({
        "name": "Test 2: 14.2 Hz sine peak at ~14.2 Hz within one bin width",
        "pass": abs(r["peakHz"] - 14.2) <= BIN_WIDTH,
        "expected": 14.2,
        "actual": r["peakHz"],
        "binWidth": BIN_WIDTH,
        "verdict": r["verdict"],
    })

    # ---- Test 3: 30 Hz -------------------------------------------------
    frame = sine_wave(30, FS, N)
    baseline = sine_wave(30, FS, N)
    r = predictive_watchdog(frame, baseline, FS, 100)
    results.append({
        "name": "Test 3: 30 Hz sine peak at ~30 Hz within one bin width",
        "pass": abs(r["peakHz"] - 30) <= BIN_WIDTH,
        "expected": 30,
        "actual": r["peakHz"],
        "binWidth": BIN_WIDTH,
        "verdict": r["verdict"],
    })

    # ---- Test 4: Nyquist / aliasing ------------------------------------
    frame = sine_wave(60, FS, N)
    baseline = sine_wave(60, FS, N)
    r = predictive_watchdog(frame, baseline, FS, 100)
    alias_hz = FS - 60  # 40 Hz
    not_at_60 = abs(r["peakHz"] - 60) > BIN_WIDTH
    at_alias = abs(r["peakHz"] - alias_hz) <= BIN_WIDTH
    results.append({
        "name": "Test 4: 60 Hz tone at fs=100 must NOT appear at 60 Hz (aliasing)",
        "pass": not_at_60 and at_alias,
        "expected": alias_hz,
        "actual": r["peakHz"],
        "binWidth": BIN_WIDTH,
        "verdict": r["verdict"],
    })

    # ---- Test 5: Missing baseline --------------------------------------
    frame = sine_wave(5, FS, N)
    r = predictive_watchdog(frame, None, FS, 0)
    pass5 = (
        r["verdict"] == "INCONCLUSIVE"
        and r["reason"] == "baseline_missing"
        and "peakHz" not in r
        and "deviation" not in r
        and "baselineStatistic" not in r
    )
    results.append({
        "name": "Test 5: Missing baseline -> INCONCLUSIVE (baseline_missing)",
        "pass": pass5,
        "expected": {"verdict": "INCONCLUSIVE", "reason": "baseline_missing"},
        "actual": {"verdict": r["verdict"], "reason": r["reason"]},
        "verdict": r["verdict"],
        "reason": r["reason"],
    })

    # ---- Test 6: Baseline < 72h ----------------------------------------
    frame = sine_wave(5, FS, N)
    baseline = sine_wave(5, FS, N)
    r = predictive_watchdog(frame, baseline, FS, 10)
    pass6 = (
        r["verdict"] == "INCONCLUSIVE"
        and r["reason"] == "baseline_too_short"
        and r["baselineHours"] == 10
        and "peakHz" not in r
        and "deviation" not in r
        and "baselineStatistic" not in r
    )
    results.append({
        "name": "Test 6: Baseline < 72h -> INCONCLUSIVE (baseline_too_short)",
        "pass": pass6,
        "expected": {
            "verdict": "INCONCLUSIVE",
            "reason": "baseline_too_short",
            "baselineHours": 10,
        },
        "actual": {
            "verdict": r["verdict"],
            "reason": r["reason"],
            "baselineHours": r["baselineHours"],
        },
        "verdict": r["verdict"],
        "reason": r["reason"],
    })

    # ---- Report --------------------------------------------------------
    passed = sum(1 for r in results if r["pass"])
    failed = len(results) - passed

    print("=== Python FFT Vectors Test Results ===")
    print(f"window=Hann  fs={FS}  N={N}  binWidthHz={BIN_WIDTH}")
    print(f"thresholdRule: {THRESHOLD_RULE}")
    print("")
    for r in results:
        tag = "PASS" if r["pass"] else "FAIL"
        print(f"[{tag}] {r['name']}")
        if isinstance(r["actual"], (int, float)) and isinstance(r["expected"], (int, float)):
            print(
                f"        actual={r['actual']:.6f} Hz  expected={r['expected']} Hz  "
                f"binWidth={r['binWidth']:.6f} Hz  verdict={r.get('verdict', 'n/a')}"
            )
        else:
            print(f"        actual={json.dumps(r['actual'])}  expected={json.dumps(r['expected'])}")
    print("")
    print(f"Total: {len(results)} | Passed: {passed} | Failed: {failed}")
    print("")
    print("=== JSON ARRAY (for parity diff) ===")
    print(json.dumps(results, indent=2))

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
