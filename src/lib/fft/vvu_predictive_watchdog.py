"""VVU Predictive FFT Watchdog — Python parity module.

Spectral integrity rules (per vvu-fft-integrity SKILL.md):
  - Frequency mapping is `f_k = k * fs / N`. No hardcoded multiplier is
    used (the multiplier is always `fs / N`, derived from the input).
  - A periodic Hann window is applied before the FFT.
  - The window, fs, N, and bin width (fs/N) are stated in every output.
  - No probability is ever produced. The output contains the peak, the
    baseline statistic, the deviation, and the verdict only.
  - A missing or < 72h baseline returns INCONCLUSIVE with the reason.

This module MUST produce the same peak frequencies as the TypeScript module
`predictiveWatchdog.ts` within one bin width. numpy is used for the FFT
(`numpy.fft.fft`); the window is the same periodic Hann as the TS module
(`0.5 - 0.5*cos(2*pi*n/N)`), NOT `numpy.hanning` (which is symmetric).

Out of bounds (per SKILL.md): training or claiming a predictive model belongs
to vvu-academic-validation. This module does NOT claim clinical validity; it
reports a spectral observation and a single threshold.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence, Union

import numpy as np

BASELINE_MIN_HOURS: int = 72
DEVIATION_THRESHOLD: float = 0.5
THRESHOLD_RULE: str = (
    f"|deviation| > {DEVIATION_THRESHOLD} (i.e. > 50% from baseline peak "
    "magnitude) => ANOMALY; otherwise NOMINAL"
)


def hann_window(n: int) -> np.ndarray:
    """Periodic Hann window of length n: w[k] = 0.5 - 0.5*cos(2*pi*k/n).

    Matches the TypeScript `hannWindow` exactly. This is NOT `numpy.hanning`,
    which uses the symmetric form `0.5 - 0.5*cos(2*pi*k/(n-1))`.
    """
    k = np.arange(n, dtype=np.float64)
    return 0.5 - 0.5 * np.cos(2.0 * np.pi * k / float(n))


def _next_pow2(n: int) -> int:
    p = 1
    while p < n:
        p <<= 1
    return p


def spectral_peak(signal: Sequence[float], fs: float) -> Dict[str, float]:
    """Compute the spectral peak of a real-valued signal.

    Steps mirror the TypeScript `spectralPeak`:
      1. Zero-pad to next power of two N.
      2. Apply periodic Hann window of length N.
      3. numpy FFT.
      4. Peak bin k in [1, N/2] (DC excluded).
      5. peakHz = k * fs / N. No hardcoded multiplier is used.
    """
    arr = np.asarray(signal, dtype=np.float64)
    length = int(arr.size)
    n = _next_pow2(length)
    padded = np.zeros(n, dtype=np.float64)
    padded[:length] = arr
    windowed = padded * hann_window(n)
    spectrum = np.fft.fft(windowed)
    mag = np.abs(spectrum)
    nyq_bin = n // 2
    # Search bins 1..nyq_bin inclusive (exclude DC).
    search = mag[1 : nyq_bin + 1]
    peak_idx = int(np.argmax(search)) + 1
    return {
        "peak_bin": peak_idx,
        "peak_hz": peak_idx * float(fs) / float(n),  # f_k = k * fs / N
        "peak_magnitude": float(mag[peak_idx]),
        "N": n,
    }


def predictive_watchdog(
    frame: Sequence[float],
    baseline: Optional[Sequence[float]],
    fs: float,
    baseline_hours: float,
) -> Dict[str, Any]:
    """Run the predictive FFT watchdog.

    Returns INCONCLUSIVE when the baseline is missing or shorter than 72h.
    Otherwise returns NOMINAL or ANOMALY plus the peak frequency, baseline
    statistic, signed deviation, and the window/fs/N/binWidth metadata.
    """
    # Baseline gate. No probability, no peak, no verdict beyond INCONCLUSIVE.
    if baseline is None:
        return {
            "verdict": "INCONCLUSIVE",
            "reason": "baseline_missing",
            "baselineHours": 0,
        }
    if baseline_hours < BASELINE_MIN_HOURS:
        return {
            "verdict": "INCONCLUSIVE",
            "reason": "baseline_too_short",
            "baselineHours": baseline_hours,
        }

    frame_peak = spectral_peak(frame, fs)
    n = int(frame_peak["N"])

    # Baseline slice: same FFT length N as the frame for parity.
    baseline_arr = np.asarray(baseline, dtype=np.float64)
    baseline_slice = np.zeros(n, dtype=np.float64)
    copy_len = min(int(baseline_arr.size), n)
    baseline_slice[:copy_len] = baseline_arr[:copy_len]
    baseline_peak = spectral_peak(baseline_slice, fs)

    baseline_statistic = float(baseline_peak["peak_magnitude"])
    if baseline_statistic > 0:
        deviation = (
            float(frame_peak["peak_magnitude"]) - baseline_statistic
        ) / baseline_statistic
    else:
        deviation = 0.0

    verdict = "ANOMALY" if abs(deviation) > DEVIATION_THRESHOLD else "NOMINAL"

    return {
        "verdict": verdict,
        "peakHz": float(frame_peak["peak_hz"]),
        "baselineStatistic": baseline_statistic,
        "deviation": float(deviation),
        "window": "Hann",
        "fs": float(fs),
        "N": n,
        "binWidthHz": float(fs) / float(n),
        "thresholdRule": THRESHOLD_RULE,
    }
