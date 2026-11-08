// src/lib/vvu/ci-state.ts — disk-canonical reader for the Android APK CI
// validation state (vvu-trust/build/ci/android-apk-ci.json).
//
// The dashboard twin (#/field §5) renders this through /api/vvu/ci-state.
// The state changes BY HAND: the sandbox's GitHub integration returns 404
// for the repo, so dispatching the workflow is a manual UI step and the
// evidence lands in the ledger when the operator pastes it. The JSON is the
// machine twin of vvu-trust/build/ci/ANDROID_APK_VALIDATION.md.
//
// NEVER throws — every failure is a degraded { ok: false } payload.

import { readFile } from "fs/promises";
import path from "path";

// ── Contract of android-apk-ci.json (schema vvu.ci.android-apk.v1) ──────────

export interface CiGate {
  id: string;
  name: string;
  order: string;
  effect: string;
}

export interface CiRun {
  run_head: string;
  classification: string;
  reason: string;
  verdict: string;
}

export interface CiCleanup {
  id: string;
  change: string;
  status: string;
  patch: string;
}

export interface CiPackager {
  path: string;
  doc: string;
  status: string;
  evidence: string;
  usage: string;
  note: string;
}

export interface CiWorkflow {
  path: string;
  revision: string;
  plan_reference: string;
  trigger: string;
  permissions: string;
  runner_pin: string;
  timeout_minutes: number;
  artifact: string;
  gates: CiGate[];
  mirror_sha256: string;
  mirror_note: string;
}

export interface CiStateFile {
  schema: string;
  updated: string;
  deliverable: string;
  repo: string;
  repo_visibility: string;
  github_access_from_sandbox: string;
  workflow: CiWorkflow;
  state: string;
  state_note: string;
  acceptance: { condition: string; consequence: string };
  dispatch_procedure: string[];
  runs: CiRun[];
  parked_cleanups: CiCleanup[];
  packager?: CiPackager;
  evidence: unknown;
}

export type CiStateResponse =
  | { ok: true; ledger: string; ci: CiStateFile }
  | { ok: false; error: string; path: string; hint?: string };

const STATE_PATH = path.join(process.cwd(), "vvu-trust", "build", "ci", "android-apk-ci.json");
const LEDGER = "vvu-trust/build/ci/ANDROID_APK_VALIDATION.md";

export async function readCiState(): Promise<CiStateResponse> {
  try {
    const raw = await readFile(STATE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as CiStateFile;
    if (!parsed?.workflow?.revision || !parsed.state) {
      return {
        ok: false,
        error: "state file present but structurally incomplete",
        path: "vvu-trust/build/ci/android-apk-ci.json",
      };
    }
    return { ok: true, ledger: LEDGER, ci: parsed };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "ci state unreadable",
      path: "vvu-trust/build/ci/android-apk-ci.json",
      hint: `the state file is the machine twin of ${LEDGER} — restore it from the ledger`,
    };
  }
}
