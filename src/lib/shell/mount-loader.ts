/* VVU SHELL CLIENT — §1 mount loader.
 *
 * Reads environment manifests from a configurable source, validates each
 * against the manifest schema, and calls Router.mount() for every valid
 * manifest. Invalid manifests are reported — NEVER silently coerced.
 *
 * The default source is a static registry of all Five Environments with
 * placeholder entry points (the environments themselves are mounted by the
 * orchestrator in parallel work). The loader is the single chokepoint that
 * turns "a pile of manifests" into "a mounted shell".
 */

import {
  ENVIRONMENT_ORDER,
  type ArtefactType,
  type EnvironmentId,
  type EnvironmentManifest,
} from './types';
import { Router } from './router';

const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

const VALID_ARTEFACT_TYPES: readonly ArtefactType[] = [
  'claim',
  'model',
  'learning_submission',
  'experimental_record',
  'observation',
  'verification_receipt',
  'test_report',
  'counterexample',
  'publication',
  'policy',
  'fire_estate_export',
];

/** Result of validating a single manifest candidate. */
export type ManifestValidation =
  | { ok: true; manifest: EnvironmentManifest }
  | { ok: false; errors: string[] };

/**
 * Validates a manifest candidate against the §1 schema. Returns a list of
 * every problem found (never throws — the caller decides what to do with
 * an invalid manifest, but the loader will never mount one).
 */
export function validateManifest(input: unknown): ManifestValidation {
  const errors: string[] = [];
  if (!input || typeof input !== 'object') {
    return { ok: false, errors: ['manifest is not an object'] };
  }
  const obj = input as Record<string, unknown>;

  // id — must be one of the five.
  if (
    typeof obj.id !== 'string' ||
    !(ENVIRONMENT_ORDER as readonly string[]).includes(obj.id)
  ) {
    errors.push(
      'id must be one of ' + ENVIRONMENT_ORDER.join('|'),
    );
  }

  // version — semver.
  if (typeof obj.version !== 'string' || !SEMVER_RE.test(obj.version)) {
    errors.push('version must be a semver string (MAJOR.MINOR.PATCH)');
  }

  // entry — non-empty string (path or URL).
  if (typeof obj.entry !== 'string' || !obj.entry.trim()) {
    errors.push('entry must be a non-empty string (path or URL)');
  }

  // scope — string[].
  if (
    !Array.isArray(obj.scope) ||
    !obj.scope.every((s) => typeof s === 'string' && s.trim())
  ) {
    errors.push('scope must be a non-empty array of non-empty strings');
  }

  // artefact_types — subset of the enum.
  if (!Array.isArray(obj.artefact_types) || obj.artefact_types.length === 0) {
    errors.push('artefact_types must be a non-empty array');
  } else {
    for (const t of obj.artefact_types) {
      if (
        typeof t !== 'string' ||
        !(VALID_ARTEFACT_TYPES as readonly string[]).includes(t)
      ) {
        errors.push('artefact_types contains unknown value: ' + String(t));
      }
    }
  }

  // stores — string[].
  if (
    !Array.isArray(obj.stores) ||
    !obj.stores.every((s) => typeof s === 'string' && s.trim())
  ) {
    errors.push('stores must be an array of non-empty strings');
  }

  // worker — { src, kind }.
  if (!obj.worker || typeof obj.worker !== 'object') {
    errors.push('worker must be an object with src + kind');
  } else {
    const w = obj.worker as Record<string, unknown>;
    if (typeof w.src !== 'string' || !w.src.trim()) {
      errors.push('worker.src must be a non-empty string');
    }
    if (w.kind !== 'module' && w.kind !== 'classic') {
      errors.push('worker.kind must be "module" or "classic"');
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, manifest: obj as unknown as EnvironmentManifest };
}

/**
 * The default manifest registry — all Five Environments with placeholder
 * entry points. The orchestrator (or a future mount config) may override
 * the entry/worker paths once the real environment bundles exist.
 */
export const DEFAULT_MANIFESTS: readonly EnvironmentManifest[] = [
  {
    id: 'forge',
    version: '1.0.0',
    entry: '/environments/forge/index.js',
    scope: ['authoring', 'drafts', 'learning'],
    artefact_types: ['claim', 'model', 'learning_submission'],
    stores: ['forge.drafts'],
    worker: { src: '/environments/forge/worker.js', kind: 'module' },
  },
  {
    id: 'bench',
    version: '1.0.0',
    entry: '/environments/bench/index.js',
    scope: ['verification', 'policy-check'],
    artefact_types: ['verification_receipt', 'policy'],
    stores: ['bench.results'],
    worker: { src: '/environments/bench/worker.js', kind: 'module' },
  },
  {
    id: 'fire',
    version: '1.0.0',
    entry: '/environments/fire/index.js',
    scope: ['challenge', 'counterexample', 'red-team'],
    artefact_types: ['test_report', 'counterexample', 'fire_estate_export'],
    stores: ['fire.reports'],
    worker: { src: '/environments/fire/worker.js', kind: 'module' },
  },
  {
    id: 'field',
    version: '1.0.0',
    entry: '/environments/field/index.js',
    scope: ['observation', 'sensing', 'telemetry'],
    artefact_types: ['observation', 'experimental_record'],
    stores: ['field.observations'],
    worker: { src: '/environments/field/worker.js', kind: 'module' },
  },
  {
    id: 'press',
    version: '1.0.0',
    entry: '/environments/press/index.js',
    scope: ['publication', 'communication'],
    artefact_types: ['publication'],
    stores: ['press.posts'],
    worker: { src: '/environments/press/worker.js', kind: 'module' },
  },
] as const;

/** A report of a single failed mount. */
export interface MountError {
  /** The id if it could be read, else undefined. */
  id?: string;
  /** The validation errors. */
  errors: string[];
}

/** The outcome of a loadAll() run. */
export interface MountResult {
  mounted: EnvironmentId[];
  errors: MountError[];
}

/**
 * MountLoader — validates + mounts a set of manifests into a Router.
 */
export class MountLoader {
  private router: Router;
  private source: () => readonly EnvironmentManifest[];

  constructor(router: Router, source?: () => readonly EnvironmentManifest[]) {
    this.router = router;
    this.source = source || (() => DEFAULT_MANIFESTS);
  }

  /**
   * Validates every manifest from the source and mounts the valid ones.
   * Invalid manifests are collected into `errors` and NEVER coerced.
   * Idempotent: re-running with the same source is a no-op on the router
   * (mount() is idempotent on manifest.id).
   */
  loadAll(): MountResult {
    const manifests = this.source();
    const mounted: EnvironmentId[] = [];
    const errors: MountError[] = [];
    for (const candidate of manifests) {
      const v = validateManifest(candidate);
      if (!v.ok) {
        errors.push({
          id: readIdSafely(candidate),
          errors: v.errors,
        });
        continue;
      }
      this.router.mount(v.manifest);
      mounted.push(v.manifest.id);
    }
    return { mounted, errors };
  }
}

/** Reads manifest.id without trusting the shape of the candidate. */
function readIdSafely(candidate: unknown): string | undefined {
  if (candidate && typeof candidate === 'object') {
    const id = (candidate as { id?: unknown }).id;
    if (typeof id === 'string') return id;
  }
  return undefined;
}
