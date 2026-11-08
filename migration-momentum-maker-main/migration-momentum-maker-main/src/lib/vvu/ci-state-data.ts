// src/lib/vvu/ci-state-data.ts — simulated machine twin of the Android APK
// CI validation ledger. In the source deployment this JSON lived on disk
// (vvu-trust/build/ci/android-apk-ci.json) and /api/vvu/ci-state read it with
// fs; here it ships as data so the #/field §5 panel renders without a
// filesystem. Same schema: vvu.ci.android-apk.v1.

import type { CiStateFile } from "@/lib/vvu/ci-state";

export const CI_STATE: CiStateFile = {
  schema: "vvu.ci.android-apk.v1",
  updated: "2026-02-14T09:40:00Z",
  deliverable: "VVU Field Onboard APK (field technician evidence capture)",
  repo: "vvu-trust",
  repo_visibility: "private",
  github_access_from_sandbox: "404 — dispatch is a manual UI step",
  state: "PROTOTYPE_UNVERIFIED_ON_DEVICE",
  state_note:
    "Workflow scaffolded and mirror-hashed; no real-device run recorded. Goes LIVE when the operator dispatches the workflow and pastes the run evidence into ANDROID_APK_VALIDATION.md.",
  acceptance: {
    condition: "A recorded workflow run passes every gate on a real Android device",
    consequence: "Field onboard rail status lifts from PROTOTYPE to VERIFIED-ON-DEVICE",
  },
  dispatch_procedure: [
    "Open the vvu-trust GitHub repo in a browser (sandbox integration cannot dispatch).",
    "Actions → android-apk-validation → Run workflow.",
    "Paste the run URL + verdict into vvu-trust/build/ci/ANDROID_APK_VALIDATION.md.",
    "Regenerate android-apk-ci.json (machine twin) with the new run_head.",
  ],
  workflow: {
    path: ".github/workflows/android-apk-validation.yml",
    revision: "r3",
    plan_reference: "field-onboard §5 CI validation",
    trigger: "workflow_dispatch (manual)",
    permissions: "contents: read · actions: write",
    runner_pin: "ubuntu-24.04@sha256:8d5e0a",
    timeout_minutes: 30,
    artifact: "output/field_apk_validation_report.json",
    gates: [
      { id: "G1", name: "APK builds (gradle assembleRelease)", order: "1", effect: "blocks run" },
      { id: "G2", name: "Signature check (apksigner verify)", order: "2", effect: "blocks run" },
      { id: "G3", name: "Manifest permissions audit", order: "3", effect: "flags" },
      { id: "G4", name: "HMAC challenge/response unit tests", order: "4", effect: "blocks run" },
      { id: "G5", name: "Receipt chain round-trip on emulator", order: "5", effect: "blocks run" },
    ],
    mirror_sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    mirror_note: "workflow mirror hash recorded at scaffold time",
  },
  runs: [
    {
      run_head: "none-recorded",
      classification: "AWAITING_DISPATCH",
      reason: "manual dispatch required (sandbox GitHub integration returns 404)",
      verdict: "PENDING",
    },
  ],
  parked_cleanups: [
    {
      id: "C1",
      change: "pin actions/checkout to a tag, not main",
      status: "PARKED",
      patch: "v5.0.0",
    },
    {
      id: "C2",
      change: "replace ad-hoc emulator script with reusable composite action",
      status: "PARKED",
      patch: "v1 composite",
    },
  ],
  packager: {
    path: "tools/apk/package.py",
    doc: "vvu-trust/build/ci/PACKAGER.md",
    status: "SCAFFOLDED",
    evidence: "dry-run only",
    usage: "python tools/apk/package.py --keystore output/field_debug.keystore",
    note: "keystore generation is a local operator step",
  },
  evidence: {
    ledger: "vvu-trust/build/ci/ANDROID_APK_VALIDATION.md",
    note: "STATE LOCK: BRIDGE STATUS PROTOTYPE — UNVERIFIED ON REAL ANDROID",
  },
};
