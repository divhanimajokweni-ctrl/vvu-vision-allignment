/* VVU SHELL CLIENT — §3 default hotkey table.
 *
 * Single source of truth for the default key bindings. NO Fn-chords (Fn is
 * invisible to the OS — it cannot be observed via keydown). All combos use
 * Ctrl+Alt+<key> for environment-scoped actions and Ctrl+<key> for global
 * palette actions, matching the shell contract §3.
 *
 * Touch parity is provided by the orchestrator's UI (toolbar buttons that
 * mint the same UiCommands) — hotkeys are an accelerator, never the only
 * way to reach a command. This keeps the shell mobile-first at 360px.
 */

import type { EnvironmentId, HotkeyBinding } from './types';

/**
 * The default hotkey bindings (§3). Order is the registration order.
 * Combos are case-insensitive on parse; the registry normalizes them.
 */
export const DEFAULT_HOTKEYS: readonly HotkeyBinding[] = [
  {
    combo: 'Ctrl+Alt+1',
    command: 'FOCUS',
    scope: 'global',
    description: 'Focus the Forge environment',
  },
  {
    combo: 'Ctrl+Alt+2',
    command: 'FOCUS',
    scope: 'global',
    description: 'Focus the Bench environment',
  },
  {
    combo: 'Ctrl+Alt+3',
    command: 'FOCUS',
    scope: 'global',
    description: 'Focus the Fire environment',
  },
  {
    combo: 'Ctrl+Alt+4',
    command: 'FOCUS',
    scope: 'global',
    description: 'Focus the Field environment',
  },
  {
    combo: 'Ctrl+Alt+5',
    command: 'FOCUS',
    scope: 'global',
    description: 'Focus the Press environment',
  },
  {
    combo: 'Ctrl+Alt+U',
    command: 'UNIFY',
    scope: 'global',
    description: 'Unify the workspace into a single pane',
  },
  {
    combo: 'Ctrl+Alt+S',
    command: 'SPLIT',
    scope: 'global',
    description: 'Split the workspace into pinned panes',
  },
  {
    combo: 'Ctrl+Alt+P',
    command: 'PIN',
    scope: 'global',
    description: 'Pin/unpin the active environment',
  },
  {
    combo: 'Ctrl+Alt+W',
    command: 'WORKSPACE',
    scope: 'global',
    description: 'Cycle the active workspace layout',
  },
  {
    combo: 'Ctrl+Alt+C',
    command: 'EXPORT',
    scope: 'global',
    description: 'Copy the active artefact envelope to the clipboard',
  },
  {
    combo: 'Ctrl+Alt+V',
    command: 'IMPORT',
    scope: 'global',
    description: 'Paste an envelope from the clipboard',
  },
  {
    combo: 'Ctrl+Alt+X',
    command: 'EXPORT',
    scope: 'global',
    description: 'Cut — export and mark the artefact for supersession',
  },
  {
    combo: 'Ctrl+K',
    command: 'TOGGLE',
    scope: 'global',
    description: 'Toggle the command palette',
  },
] as const;

/**
 * The FOCUS index → environment id map. The registry resolves a FOCUS hotkey
 * (Ctrl+Alt+1..5) to a concrete environment id via this table so the
 * dispatched UiCommand always carries a concrete target.
 */
export const FOCUS_INDEX: readonly EnvironmentId[] = [
  'forge',
  'bench',
  'fire',
  'field',
  'press',
] as const;
