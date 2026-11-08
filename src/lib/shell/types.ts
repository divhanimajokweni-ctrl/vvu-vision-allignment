/* VVU SHELL CLIENT — shared types (Deliverable D, Phase 1).
 *
 * Implements the CLIENT side of the shell contract being written in parallel
 * at docs/VVU-SHELL-2026-001.md. The Five Environments are mounted into this
 * shell; the shell owns routing, hotkeys, the command bus, the worker
 * supervisor, and the import/export port. It never assigns VERIFIED — that
 * is Bench's job (and only via a policy check).
 *
 * All types here are environment-agnostic and have ZERO runtime dependencies.
 * They are safe to import from both client and server code (the values are
 * pure data; the singletons in sibling modules guard window/Worker access).
 */

/* ---------- §0 environment identifiers ---------- */

/** The five environments, fixed set. Order is the canonical mount order. */
export type EnvironmentId = 'forge' | 'bench' | 'fire' | 'field' | 'press';

/** Canonical ordered list — used by the router for cycle() + mount ordering. */
export const ENVIRONMENT_ORDER: readonly EnvironmentId[] = [
  'forge',
  'bench',
  'fire',
  'field',
  'press',
] as const;

/** A subscribe key that may target one environment OR the global shell scope. */
export type Scope = EnvironmentId | 'global';

/* ---------- §1.4 status vocabulary (12-state, append-only) ---------- */

export type EnvelopeStatus =
  | 'DRAFT'
  | 'IMPORTED'
  | 'PARSED'
  | 'INTEGRITY_VALID'
  | 'VERIFIED'
  | 'REJECTED'
  | 'INCONCLUSIVE'
  | 'NOT_PROVEN'
  | 'BLOCKED'
  | 'EXPIRED'
  | 'SUPERSEDED'
  | 'WITHDRAWN';

/* ---------- envelope v1.1 cross-environment enums ---------- */

/**
 * Artefact types (envelope v1.1 — cross-environment enum, append-only).
 * Mirrors the interop layer's TYPES_BASE with the v1.1 additions.
 */
export type ArtefactType =
  | 'claim'
  | 'model'
  | 'learning_submission'
  | 'experimental_record'
  | 'observation'
  | 'verification_receipt'
  | 'test_report'
  | 'counterexample'
  | 'publication'
  | 'policy'
  | 'fire_estate_export';

/** Source surfaces (which environment produced an artefact). */
export type SourceSurface = 'forge' | 'bench' | 'fire' | 'field' | 'press';

/* ---------- §1 MOUNT — environment manifest ---------- */

export interface EnvironmentManifest {
  id: EnvironmentId;
  /** semver of the environment's own implementation (not the envelope version). */
  version: string;
  /** URL or path to the environment's entry point (same-origin). */
  entry: string;
  /** What this environment handles (human-readable scope tags). */
  scope: string[];
  /** What it produces — must be a subset of ArtefactType. */
  artefact_types: ArtefactType[];
  /** Store names it owns (dotted, e.g. "forge.drafts"). */
  stores: string[];
  /** Worker descriptor — one worker per environment. */
  worker: { src: string; kind: 'module' | 'classic' };
}

/* ---------- §2 COMMAND BUS — shell → environment commands ---------- */

export type UiCommandKind =
  | 'UNIFY'
  | 'SPLIT'
  | 'PIN'
  | 'SWITCH'
  | 'TOGGLE'
  | 'WORKSPACE'
  | 'EXPORT'
  | 'IMPORT'
  | 'FOCUS';

export interface UiCommand {
  kind: 'ui.command';
  command: UiCommandKind;
  /** Target environment for env-scoped commands. Undefined → global. */
  target?: EnvironmentId;
  /** Optional payload (envelope, layout config, etc.). */
  payload?: unknown;
  /** ISO timestamp the command was minted. */
  timestamp: string;
}

/* ---------- §3 HOTKEY REGISTRY ---------- */

export interface HotkeyBinding {
  /** Normalized combo, e.g. "Ctrl+Alt+1" or "Ctrl+K". No Fn-chords. */
  combo: string;
  command: UiCommandKind;
  scope: EnvironmentId | 'global';
  description: string;
}

/* ---------- §6 IMPORT/EXPORT PORT — envelope ---------- */

export interface Envelope {
  envelope_version: string;
  artefact_id: string;
  artefact_type: ArtefactType;
  produced_by: {
    environment: SourceSurface;
    instance_id: string;
    operator_id: string;
    software_version: string;
  };
  produced_at: string;
  content: unknown;
  provenance: {
    inputs: string[];
    policy?: string | null;
    configuration?: string | null;
  };
  integrity: {
    digest: string;
    signature?: string | null;
    chain_ref?: string | null;
  };
  status: EnvelopeStatus;
  limitations: string[];
}

export type ImportResult =
  | { ok: true; envelope: Envelope; note?: string }
  | { ok: false; reason: string; code: string };

/* ---------- §8 STANDING LIMITATIONS per environment ---------- */

/**
 * Standing limitations attached to every artefact an environment produces.
 * These are epistemic firebreaks — they prevent a Forge draft from being
 * mistaken for a Bench verification, a Fire pass for a safety claim, etc.
 */
export const STANDING_LIMITATIONS: Record<EnvironmentId, string[]> = {
  forge: ["Forge produces drafts; verification is Bench's job."],
  bench: [
    "Bench verifies against a policy; it does not observe the physical world.",
  ],
  fire: [
    'Fire does not emit PROVEN.',
    'PASSED-UNDER-CONDITIONS is not a safety claim.',
  ],
  field: ["Field records observations; interpretation is Bench's job."],
  press: ['Press communicates; it does not verify or challenge.'],
};

/* ---------- envelope version profile ---------- */

/**
 * Envelope versions the shell client will accept on the import port.
 * Mirrors the interop layer's ratified (1.0.0) + proposed (2.0.0) profiles.
 * The negotiate() function in version-negotiation.ts gates against this.
 */
export const SUPPORTED_ENVELOPE_VERSIONS: readonly string[] = [
  '1.0.0',
  '2.0.0',
] as const;

/* ---------- worker channel messages (derived from the envelope schema) ---------- */

/** Inbound: shell → worker. */
export type WorkerInbound =
  | { type: 'command'; command: UiCommand }
  | { type: 'envelope'; envelope: Envelope }
  | { type: 'ping'; id: string };

/** Outbound: worker → shell. */
export type WorkerOutbound =
  | { type: 'envelope'; envelope: Envelope }
  | { type: 'status'; envId: EnvironmentId; status: EnvelopeStatus }
  | { type: 'error'; message: string; code: string }
  | { type: 'pong'; id: string };

/** Handler invoked when a worker posts an outbound message. */
export type WorkerMessageHandler = (msg: WorkerOutbound) => void;

/* ---------- router state snapshot ---------- */

export type LayoutMode = 'unified' | 'split';

export interface RouterState {
  mounted: EnvironmentId[];
  active: EnvironmentId | null;
  pinned: EnvironmentId[];
  layout: LayoutMode;
}
