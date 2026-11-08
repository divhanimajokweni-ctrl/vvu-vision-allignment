# trust-sphere-metrics.md — the metrics surface data sources

Task 47 · Trust Sphere Metrics Surface. This file is the single source of
truth for every metric the surface shows, where it comes from, and what it
means. It must be updated BEFORE any new panel is added — and no new panel
is added without a new spec; five questions, five panels, no sixth.

One line: a metrics surface is only honest if every number carries its
source and every missing number renders as missing.

---

## Metric: NETWORK HEALTH

Source: composite of the four sub-panels (SLA · TRUSTED NODES · DEVICE MESH · HEALTH TREND)
Interval: 15s (recomputed on every render)
Fallback: none — renders — if ANY sub-panel is missing. No partial numbers.
Computation: Σ weight_i × score_i, weights read from the #metrics-config
JSON island inside trust-sphere.html (sla 0.30 · nodes 0.30 · mesh 0.25 ·
trend 0.15, normalised at read time). The island exists because the file
contract allows exactly four files in this directory — the spec named
"metrics-config.json" but forbade a fifth file, so the config is a JSON
data island in the HTML source, read at runtime. Changing a weight means
editing the island, never the JS.
Sub-scores (each 0–100 or missing):
sla = measured uptime percent
nodes = (identity + verified + trusted) / total × 100
mesh = 100 when the rail is UP with zero paired devices (nothing
promised, nothing to degrade); else active / paired × 100
trend = clamp(50 + delta_1h × 10, 0, 100)
Honest behaviour: any sub-panel — ⇒ the composite is — .
Notes: the rail pills on this card are per-rail up/down + latency from the
same /api/vvu/rails fetch — displayed facts, not inputs to the composite.

## Metric: SLA · 72H

Source: GET /api/vvu/rails (server-side parallel probe of :3000/:3003/
:3004/:3005/:3006/:3007, each with a 2.5s timeout)
Interval: 15s
Fallback: last known value, shown, marked STALE in amber when older than
60s; a fetch that never returned renders — .
Computation: uptime_sweeps / total_sweeps × 100, derived from persisted
RailSweep rows (one row per 15s background sweep; a sweep is up iff every
probed rail answered). The window is 72h OR since the first recorded
sweep, whichever is shorter — the card's source line carries the honest
"window since HH:MM:SS". Restarts do not zero the window.
Honest behaviour: renders — if no response within 2.5s; STALE (amber,
timestamped) between 60s and the next good fetch.
Notes: breach count is derived, not declared — a breach is a CONTIGUOUS
down episode (a down sweep whose predecessor was up). Target 99.50%.
The spec's aggregate named :3000/:3003/:3004/:3005; :3006 (wildfire-mesh)
and :3007 (mesh-demo) were added by later estate rounds and are included
because estate health is the health of all its rails — recorded here as
a deliberate, documented extension of the spec's four.

## Metric: TRUSTED NODES

Source: trust-sphere node state (client-side — window.TrustSphereState,
published by trust-sphere.html; the metrics read it and never write it)
Interval: on every sphere publish (state clock ticks every 4s) + every render
Fallback: not applicable — the client has it. Renders — only if the sphere
script failed to publish.
Computation: three DISJOINT tiers over the seven-state machine
(unknown → identity → contribution → receipt → hash → zk → trust):
identity = nodes whose furthest passed gate is identity
verified = passed identity + contribution, not final
(states contribution · receipt · hash · zk)
trusted = reached the final state (trust)
Honest behaviour: the three tiers must sum to ≤ total nodes. If they do
not, the card renders MISMATCH in red with the numbers, and does not
attempt to reconcile.
Notes: node states are SEEDED (deterministic mulberry32, seed 20260921) and
the state clock is SIMULATED (one node advances per 4s) — honestly
badged on the artifact and in this card's source line. The Global/Personal
scope toggle changes the visible set (the metrics follow the sphere's
published scope); the tiers are recomputed over exactly that set.

## Metric: DEVICE MESH

Source: GET /api/vvu/rails → devices (the :3005 vvu-field-onboard rail's
own /status, probed server-side with a 2.5s timeout)
Interval: 15s
Fallback: OFFLINE in red when :3005 is down. Never a cached number.
Computation:
paired = :3005 pairedDevices (devices ever paired on this rail)
active = 1 when the agent link is live, else 0 — the rail keeps a
single agent session, so at most one device can be
"currently sending"
stale = paired − active (paired devices with no live session)
Honest behaviour: if the fetch itself fails, the panel renders — (not
OFFLINE — the difference between "rail down" and "cannot know" is real).
Notes: the spec's "stale — paired but silent > 5 min" cannot be computed
from this rail: it does not persist per-device lastSeen for disconnected
devices, so a true silence duration is UNKNOWABLE. The paired − active
floor above is what is real, and this file says so rather than
fabricating timestamps. The big number is ACTIVE (currently sending).

## Metric: HEALTH TREND · 1H

Source: in-memory ring buffer (client-side, 24h, one sample per minute,
≤1440 samples; a missed minute is an honest null gap)
Interval: sampled once per minute; rendered on every tick
Fallback: INSUFFICIENT DATA until the buffer holds a sample that is at
least one hour old. Never interpolated.
Computation: delta = current composite − the sample at/just-before
(now − 1h). Displayed as ↑ +N / ↓ -N / → 0. The sparkline (24px tall,
full card width) draws the last 24h with GAPS where samples are null —
consecutive non-null points are connected, nulls break the line.
Honest behaviour: under one hour of session time the trend reads
INSUFFICIENT DATA — the buffer is in-memory, so a page reload honestly
restarts the measurement window. This is the spec's design, kept.

---

## What this surface must never do (kept, verbatim in spirit)

· Show a number without a source line. Never.
· Show a spinner. Never. It shows — or it shows a number.
· Interpolate. Never.
· Hide a stale value. A stale value is shown stale, marked, timestamped.
· Claim VERIFIED when the underlying rail is UNVERIFIED or STUB.
· Sum mismatched categories. If the tiers do not sum ≤ total, the panel
shows the mismatch, not a fixed number.
· Add a sixth panel. A stakeholder asking for one gets a new spec.
· Recolour the sphere. Sphere colours are owned by the sphere.

## Verification log (spec §VERIFICATION — recorded honestly)

Run through the :81 gateway (the real user path) after build. Results are
appended to the estate worklog (Task 47), not fabricated here.
