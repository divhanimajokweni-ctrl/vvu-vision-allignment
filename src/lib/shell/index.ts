/* VVU SHELL CLIENT — barrel export (Deliverable D, Phase 1).
 *
 * Re-exports every public type, constant, and singleton so the orchestrator
 * and the Five Environments can import from a single path:
 *
 *   import { getRouter, getCommandBus, getHotkeyRegistry, ... } from '@/lib/shell';
 *
 * Internal-only symbols (private helpers, the textarea fallback functions)
 * are intentionally NOT re-exported.
 */

/* ---------- types + constants (types.ts) ---------- */
export type {
  EnvironmentId,
  Scope,
  EnvelopeStatus,
  ArtefactType,
  SourceSurface,
  EnvironmentManifest,
  UiCommandKind,
  UiCommand,
  HotkeyBinding,
  Envelope,
  ImportResult,
  WorkerInbound,
  WorkerOutbound,
  WorkerMessageHandler,
  LayoutMode,
  RouterState,
} from './types';

export {
  ENVIRONMENT_ORDER,
  STANDING_LIMITATIONS,
  SUPPORTED_ENVELOPE_VERSIONS,
} from './types';

/* ---------- §3 default hotkey table ---------- */
export { DEFAULT_HOTKEYS, FOCUS_INDEX } from './default-hotkeys';

/* ---------- §3 hotkey registry ---------- */
export { HotkeyRegistry, getHotkeyRegistry } from './hotkey-registry';
export type { HotkeyDispatch } from './hotkey-registry';

/* ---------- §2 command bus ---------- */
export { CommandBus, getCommandBus, VALID_ENVIRONMENTS } from './command-bus';
export type { CommandHandler, CommandLogEntry } from './command-bus';

/* ---------- §4 router ---------- */
export { Router, getRouter } from './router';

/* ---------- §1 mount loader ---------- */
export {
  MountLoader,
  DEFAULT_MANIFESTS,
  validateManifest,
} from './mount-loader';
export type { ManifestValidation, MountError, MountResult } from './mount-loader';

/* ---------- §5 worker supervisor ---------- */
export {
  WorkerSupervisor,
  getWorkerSupervisor,
} from './worker-supervisor';
export type { SpawnResult } from './worker-supervisor';

/* ---------- §6 clipboard channel ---------- */
export {
  ClipboardChannel,
  getClipboardChannel,
  parseEnvelope,
  validateEnvelope,
} from './clipboard-channel';

/* ---------- §7 version negotiation ---------- */
export { negotiate } from './version-negotiation';
export type { NegotiateResult } from './version-negotiation';
