// VVU HBK Mk-II Release Manifest — 15-file Design Freeze Level 1
// "Hash is Proof" — every file carries a sha256, a size, a category, a role.

export interface ReleaseFile {
  fileId: string; // F01..F15
  filename: string;
  sha256: string; // pseudo-real 64-hex (deterministic — not real)
  sizeBytes: number;
  category:
    | "FIRMWARE"
    | "SUBSTRATE"
    | "CONTRACT"
    | "SCHEMA"
    | "CONFIG"
    | "KEYS"
    | "RUNTIME"
    | "BRAND"
    | "TESTS"
    | "SPEC";
  role: string;
}

export const RELEASE_STAMP = "20260901";
export const RELEASE_VERSION = "v1.5.2";

export const RELEASE_MANIFEST: ReleaseFile[] = [
  {
    fileId: "F01",
    filename: "vvu-fsm-controller-20260901.ts",
    sha256: "4a2f1c8b3d9e7f6a5b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2",
    sizeBytes: 18_432,
    category: "FIRMWARE",
    role: "7-state DFA controller (DISCONNECTED → PAIRING_BLE → TOTP_VERIFICATION → STEADY_STATE_LOCKED → LEAK_SIMULATION → THERMAL_THROTTLE → FAIL_CLOSED_LOCKDOWN)",
  },
  {
    fileId: "F02",
    filename: "vvu-telemetry-controller-20260901.ts",
    sha256: "b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c",
    sizeBytes: 23_987,
    category: "FIRMWARE",
    role: "Edge telemetry ingestion (flow, pressure, acoustic, APU thermal)",
  },
  {
    fileId: "F03",
    filename: "vvu-ble-pair-20260901.ts",
    sha256: "c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
    sizeBytes: 8_704,
    category: "FIRMWARE",
    role: "BLE pairing + Ed25519 device keypair (single-use QR enrolment, 10-min TTL)",
  },
  {
    fileId: "F04",
    filename: "vvu-init-db-20260901.sh",
    sha256: "d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8",
    sizeBytes: 2_743,
    category: "SCHEMA",
    role: "Sovereign-DB initialise script (idempotent seeder)",
  },
  {
    fileId: "F05",
    filename: "vvu-decision-ledger-20260901.sql",
    sha256: "e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0",
    sizeBytes: 14_638,
    category: "SCHEMA",
    role: "PostgreSQL WORM decision-ledger with RLS policies (agent_identities + decision_ledger + physical_nodes + evidence_anchor)",
  },
  {
    fileId: "F06",
    filename: "vvu-deploy-all-v3-20260901.sh",
    sha256: "f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2",
    sizeBytes: 6_192,
    category: "CONFIG",
    role: "End-to-end deploy orchestrator (6 mini-services :3003–:3008 + Next dev :3000 + Caddy :81)",
  },
  {
    fileId: "F07",
    filename: "vvu-ssh-setup-20260901.sh",
    sha256: "a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4",
    sizeBytes: 3_412,
    category: "CONFIG",
    role: "SSH host hardening (fail2ban, ufw 22/3003-3008/81)",
  },
  {
    fileId: "F08",
    filename: "vvu-hash-verifier-v3-FINAL.sh",
    sha256: "b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6",
    sizeBytes: 4_096,
    category: "TESTS",
    role: "15-file SHA-256 manifest verifier (Design Freeze Level 1)",
  },
  {
    fileId: "F09",
    filename: "VVUIVELedger.sol",
    sha256: "c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8",
    sizeBytes: 11_012,
    category: "CONTRACT",
    role: "Polygon-anchored on-chain evidence ledger (registerEvidence, Five-Conjunct Theorem)",
  },
  {
    fileId: "F10",
    filename: "zoo_step_verifier.py",
    sha256: "d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0",
    sizeBytes: 6_741,
    category: "RUNTIME",
    role: "Python Web3 bridge — Zoo STEP files → SHA-256 → VVUIVELedger.registerEvidence",
  },
  {
    fileId: "F11",
    filename: "vvu-master-textbook-v0.3.md",
    sha256: "e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2",
    sizeBytes: 92_416,
    category: "SPEC",
    role: "Single source of truth — Chapters 1–5 + appendices (FAVAD, Joukowsky, ATECC608B)",
  },
  {
    fileId: "F12",
    filename: "vvu-guardrail-doc-v1.md",
    sha256: "f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4",
    sizeBytes: 18_221,
    category: "SPEC",
    role: "Comparison > checkout policy + Five-Conjunct Theorem formal proof",
  },
  {
    fileId: "F13",
    filename: "vvu-executive-bundle.md",
    sha256: "a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6",
    sizeBytes: 12_084,
    category: "SPEC",
    role: "Executive summary + 5-Gate founder-control roadmap (G0→G5)",
  },
  {
    fileId: "F14",
    filename: "vvu-three-rings.svg",
    sha256: "b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8",
    sizeBytes: 339,
    category: "BRAND",
    role: "Borromean Three Rings mark (Venture/Ubuntu/Vision joined at ProofBridge dot)",
  },
  {
    fileId: "F15",
    filename: "PUBKEY.txt",
    sha256: "c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0",
    sizeBytes: 359,
    category: "KEYS",
    role: "Ed25519 release key fingerprint 127cb1158c… (prior 49003c2d… retired — private lost in sandbox reset)",
  },
];

export const CORPORATE_FACTS = {
  legalEntity: "Vaguely Vanity LLC (Pty) Ltd t/a Venture Vision Ubuntu",
  cipc: "2026/259053/07",
  sars: "9106703292",
  bbbeeLevel: "Level 1",
  bbbeeRecognition: "135%",
  ownership: "100% Black-owned",
  address: "14 Bird Street, Gqeberha, 6001, Eastern Cape, South Africa",
  contactEmail: "dvh@venturevisionubuntu.co.za",
  tagline: "Assertion ≠ Evidence.",
  taglineAlt: "Hash is Proof.",
  releaseStamp: RELEASE_STAMP,
  releaseVersion: RELEASE_VERSION,
} as const;

export const GATE_ROADMAP = [
  { gate: "G0", name: "Discovery", status: "COMPLETE", founderControlPct: 100.0 },
  { gate: "G1", name: "Pilot", status: "COMPLETE", founderControlPct: 100.0 },
  { gate: "G2", name: "Scale", status: "IN-PROGRESS", founderControlPct: 92.4 },
  { gate: "G3A", name: "Trust — Pilot Close", status: "IN-PROGRESS", founderControlPct: 82.5 },
  { gate: "G3B", name: "Trust — R50k MRR", status: "TARGET", founderControlPct: 76.0 },
  { gate: "G3C", name: "Trust — R150k MRR", status: "TARGET", founderControlPct: 72.0 },
  { gate: "G5", name: "JSE IPO", status: "TARGET", founderControlPct: 70.66 },
] as const;

// Hydraulic invariants — safe-harbour bounds (SANS/EN)
export const HYDRAULIC_INVARIANTS = {
  minWaveCelerityMs: 200,
  maxWaveCelerityMs: 1400,
  minFavadExponent: 0.5,
  maxFavadExponent: 2.5,
  maxSacrificialCorrosionMm: 10,
  minFactorOfSafety: 1.5,
  maxFactorOfSafety: 3.0,
  torqueNm: 154.7,
  clampForceKn: 228.96,
  dn300: {
    outerDiameterMm: 323.9,
    innerDiameterMm: 305.0,
    wallThicknessMm: 9.45,
    materialGrade: "SANS 1123 PN16",
  },
  dn100: {
    outerDiameterMm: 114.3,
    innerDiameterMm: 102.3,
    wallThicknessMm: 6.0,
    materialGrade: "SANS 1123 PN16",
  },
} as const;

// Hardware BoM — HBK Mk-II Hydro-Gateway
export const HARDWARE_BOM = {
  apu: "AMD Ryzen AI APU",
  battery: "8S4P LiFePO4 614 Wh",
  storage: "512 GB NVMe WORM store",
  secureElement: "ATECC608B",
  flange: "DN300 SANS 1123 PN16",
  comms: "RF Bulkhead (LoRa + BLE)",
  thermal: "Aluminium radiator + thermal bridge",
  enclosure: "IP66 enclosure base + lid + gasket",
} as const;
