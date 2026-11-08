# Trust Infrastructure (Public Spec Draft)

This repository is a **public, stripped specification draft** for a fail-closed, append-only evidence/receipt model ("Trust OS" concept). It is **not** a claim of clinical, financial, regulatory, or production safety.

## Core principles (stated carefully)
- **Fail-closed on absence:** if required sensor/data is absent or unverifiable, the system should refuse to emit a normal decision/output and record an explicit absence state (e.g., `SENSOR_ABSENT`).
- **Append-only receipts:** events are recorded as hash-linked entries. A hash chain can demonstrate **post-seal integrity of that sequence** (tamper-evidence *after* sealing), **not** the truth of the underlying observation.
- **Independent verification:** a verifier should be able to recompute hashes from exported data without trusting the operator’s API.

## What this does *not* prove
A verified hash chain **does not** prove:
- the sensor reading was accurate (calibration, drift, spoofing, false presence),
- the operator did not rewrite/regenerate the chain from genesis (without an external anchor),
- the difference between an offline gap, device failure, and data suppression (without signed heartbeats/monotonic counters),
- “WORM” in the strict storage sense (true WORM requires storage-level enforcement such as object lock/write-once media).

## Threat model (minimal)
Defends (partially), when implemented correctly:
- undetected modification of sealed records after commit (hash-chain integrity),
- accidental corruption detectable by recomputation.

Does **not** defend against (without additional controls):
- malicious operator rewriting history and re-anchoring from genesis,
- compromised device emitting false-but-signed/accepted data,
- truncation/withholding unless chain heads are externally anchored and gaps are cryptographically evidenced.

## Required implementation controls (beyond this draft)
- Device identity & signing at capture (e.g., Ed25519) + attestation and calibration records.
- Canonical serialization (e.g., RFC 8785 JCS) and explicit byte encoding/domain separation.
- External anchoring of chain heads (timestamping/public ledger/object-lock publication) to limit rewrite/truncation.
- Signed heartbeats / monotonic counters to interpret gaps.
- Storage-enforced append-only/WORM where claimed.
- Privacy/consent controls for health data (e.g., POPIA special personal information) — **not included here**.

## Files
- `verify-chain.js` — reference verifier for a simple JSONL/JSON chain format (integrity checks only).
- `SPEC.md` — draft chain format, encoding notes, and test-vector guidance.

## Status
Draft for review. Do **not** treat as a compliance, medical, or financial system.
