# Fail-Closed Empty-State & Digital Turn-Off Architecture

## Core Principle

**The system renders only what the sensor produced. If the sensor produced nothing, the system renders absence — labeled, timestamped, and receipted. Absence is not a fallback; it is a first-class output with its own cryptographic proof.**

> "If the sensor does not produce a value, the system does not render a value. The absence is the output. The absence is receipted. The absence is the feature."

## The Four States

| State | Meaning | Renderer Shows | WORM Records |
|-------|---------|----------------|--------------|
| **LIVE** | Sensor produced a value within the last 15s | The value, pulsing | `VITALS { hr: 72, source: "cubot" }` |
| **ABSENT** | Sensor connected but no value (or removed) | Empty viewport, grey, `SENSOR_ABSENT` badge | `SENSOR_ABSENT { reason: "NO_DATA_IN_WINDOW", last_live: {...} }` |
| **ERROR** | Connection failed (BLE drop, crash) | Empty, red border, `CONNECTION_LOST` | `CONNECTION_LOST { reason: "BLE_TIMEOUT" }` |
| **LOADING** | System initializing (first load) | Empty, spinner, `INITIALIZING` | Nothing yet |

**Rule:** `LOADING ≠ ABSENT ≠ ERROR`. Never collapse them. Never use `value ?? []` or `value || 0`.

## Pipeline (Sensor → Empty → Receipt)

```text
1. CAPTURE   → { heart_rate: 72 } OR { heart_rate: null }
2. VALIDATE  → null/0 = ABSENT; in-range = LIVE; out-of-range = ERROR
3. WINDOW    → if (now - last_value_t > 15000ms) → ABSENT else → LIVE
4. RECEIPT   → Same treatment for LIVE and ABSENT: canonicalize, hash, sign
5. EMIT      → Append to WORM chain (both LIVE and ABSENT entries)
6. RENDER    → LIVE: pulse + color; ABSENT: grey + label; ERROR: red border
```

**Critical:** Steps 4–5 are identical for presence and absence. The absence is signed, hashed, and chained exactly like a value.

## Rendering Contract

```javascript
function renderVital(state, value) {
  switch (state) {
    case 'LIVE':
      heart.scale.setScalar(1 + pulse(value))
      heart.material.color.setHex(0xff2222)
      badge.text = `HR: ${value} BPM`
      break

    case 'ABSENT':
      heart.scale.setScalar(1)
      heart.material.color.setHex(0x666666)
      badge.text = 'SENSOR_ABSENT'
      // No geometry generated. No value displayed. Viewport empty of data — but labeled.
      break

    case 'ERROR':
      heart.material.color.setHex(0x666666)
      badge.text = 'CONNECTION_LOST'
      badge.border = '1px solid #ff0000'
      break

    case 'LOADING':
      heart.visible = false
      badge.text = 'INITIALIZING...'
      break
  }
}
```

**Forbidden:** `badge.text = '—'`, `badge.text = '0'`, carrying forward last known value, placeholder geometry, wireframe fallback.

## WORM Receipt for Absence (Digital Turn-Off)

```json
{
  "seq": 847,
  "type": "SENSOR_ABSENT",
  "timestamp": "2026-11-05T14:32:18.130Z",
  "metrics": null,
  "absent": ["heart_rate", "spo2"],
  "reason": "NO_DATA_IN_WINDOW",
  "window_ms": 15000,
  "last_live": {
    "timestamp": "2026-11-05T14:32:03.127Z",
    "heart_rate": 72,
    "spo2": 98
  },
  "source": "cubot_ble",
  "confidence": "none",
  "meta": {
    "signature": "ed25519:...",
    "device_id": "a3f8c21e9b7d4e6f",
    "signed_at": "2026-11-05T14:32:18.131Z"
  },
  "source_hash": "f4a2b8c1...",
  "chain_hash": "9e3d1a7f..."
}
```

`last_live` is audit context only. **Not rendered.**

## Circuit Breaker (15s)

```text
  ┌──────────┐    15s with no data    ┌──────────────┐
  │  LIVE    │───────────────────────▶│   ABSENT     │
  │ (closed) │                        │ (tripped)    │
  └──────────┘                        └──────────────┘
       ▲                                    │
       │         data arrives               │
       └────────────────────────────────────┘
              (within 30s of trip)
```

Trip/reset events are receipted (signed, hashed, chained). Downtime duration is a receipt.

## State Transition Table

| From | To | Trigger | Renderer | WORM |
|------|-----|---------|----------|------|
| LOADING | LIVE | First value arrives | Heart pulses | VITALS (first) |
| LOADING | ERROR | Connection fails during init | Red border | CONNECTION_LOST |
| LIVE | ABSENT | 15s no data | Grey, `SENSOR_ABSENT` | SENSOR_ABSENT + BREAKER_TRIP |
| LIVE | ERROR | BLE disconnects | Red border | CONNECTION_LOST + BREAKER_TRIP |
| ABSENT | LIVE | Data arrives within 30s | Heart resumes | VITALS + BREAKER_RESET |
| ABSENT | ERROR | BLE disconnects while absent | Red border | CONNECTION_LOST |
| ERROR | LIVE | Connection restored, data flows | Heart resumes | VITALS + BREAKER_RESET |
| ERROR | ABSENT | Connection restored, no data yet | Grey, `SENSOR_ABSENT` | SENSOR_ABSENT |

No other transitions exist. No `LIVE → LOADING`. No `ABSENT → LOADING`.

## 404 Test (3D Viewport)

When a sensor is ABSENT, the corresponding mesh **does not**: hide without explanation, show placeholder/primitive geometry, show last known value as current, or show wireframe fallback.

It **does**: show mesh at last known position **grey** (if asset is loaded), show label `SENSOR_ABSENT — HR — 14:32:18`, show red/trip indicator, and WORM prints the receipt.

**The viewport is not blank. It is empty of data — and the absence is visible and labeled.** "Viewport stays empty and says why. Zero fallback geometry. Zero hallucination."

## One-Page Manifesto

```text
THE FAIL-CLOSED CONTRACT

1. The system renders ONLY what the sensor produced.
2. If the sensor produced nothing, the system renders ABSENCE.
3. Absence is labeled, timestamped, and receipted.
4. Absence is NOT a failure. It is a measurement of nothing.
5. Absence is NOT a fallback. It is a first-class output.
6. The absence receipt is signed, hashed, and chained exactly like a value receipt.
7. The circuit breaker trips after 15s of silence. The trip is a receipt.
8. The breaker resets when data returns. The reset is a receipt.
9. The downtime duration is a receipt.
10. An auditor can verify: "The system correctly refused to render when the sensor was absent."
```

**A dashboard hides the gap. A receipt records the gap.**
