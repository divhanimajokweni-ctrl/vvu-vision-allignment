/* VVU SHELL CLIENT — §3 hotkey registry.
 *
 * A SINGLE capture-phase `keydown` listener on `window` resolves every
 * registered combo. One listener (not one-per-binding) is a hard contract:
 * it keeps event ordering deterministic and makes disable()/enable() a
 * single add/removeEventListener pair.
 *
 * No Fn-chords: Fn is invisible to the OS and never reaches keydown, so it
 * is deliberately absent from the default table and rejected on register().
 *
 * SSR-safe: the listener is attached lazily in enable() and only when
 * `typeof window !== 'undefined'`.
 */

import type { HotkeyBinding, UiCommand, UiCommandKind } from './types';
import { DEFAULT_HOTKEYS, FOCUS_INDEX } from './default-hotkeys';

const MODIFIERS = ['alt', 'ctrl', 'meta', 'shift'] as const;
type Modifier = (typeof MODIFIERS)[number];

/** Maps the e.key string of a bare modifier press to our modifier token. */
const MOD_KEY_MAP: Record<string, Modifier> = {
  control: 'ctrl',
  alt: 'alt',
  shift: 'shift',
  meta: 'meta',
};

/** A parsed combo: the set of modifiers + the (lowercased) main key. */
interface ParsedCombo {
  mods: Modifier[];
  key: string;
}

/** Normalizes a human combo string ("Ctrl+Alt+1") into a stable lookup key. */
function parseCombo(combo: string): ParsedCombo | null {
  if (typeof combo !== 'string' || !combo.trim()) return null;
  const parts = combo
    .toLowerCase()
    .replace(/cmd|command/g, 'meta')
    .split('+')
    .map((s) => s.trim())
    .filter(Boolean);
  const mods: Modifier[] = [];
  let key = '';
  for (const p of parts) {
    if ((MODIFIERS as readonly string[]).includes(p)) {
      if (!mods.includes(p as Modifier)) mods.push(p as Modifier);
    } else {
      // The last non-modifier token wins as the main key.
      key = p;
    }
  }
  mods.sort();
  if (!key) return null; // modifier-only combos are not registerable
  // Reject Fn-chords explicitly — Fn never reaches the OS, so any "Fn+..."
  // binding is a documentation bug.
  if (parts.includes('fn')) return null;
  return { mods, key };
}

/** Builds the stable lookup key from a parsed combo. */
function comboLookup({ mods, key }: ParsedCombo): string {
  return mods.join('+') + '|' + key;
}

/** Builds the stable lookup key from a KeyboardEvent. */
function eventLookup(e: KeyboardEvent): string | null {
  const mods = MODIFIERS.filter((m) =>
    e[(m + 'Key') as 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'],
  ).sort();
  let k = e.key.toLowerCase();
  if (k === ' ') k = 'space';
  // Bare modifier press — no main key — cannot match a registerable combo.
  if (MOD_KEY_MAP[k]) return null;
  return mods.join('+') + '|' + k;
}

/** Dispatch callback: the registry mints a UiCommand and hands it off. */
export type HotkeyDispatch = (command: UiCommand) => void;

/**
 * HotkeyRegistry — owns the single capture-phase keydown listener.
 * Use getHotkeyRegistry() to obtain the process-wide singleton.
 */
export class HotkeyRegistry {
  private bindings = new Map<string, HotkeyBinding>();
  private dispatch: HotkeyDispatch | null = null;
  private listener: ((e: KeyboardEvent) => void) | null = null;
  private enabled = false;

  constructor() {
    // Bind the handler once so add/removeEventListener pairs match exactly.
    this.listener = (e: KeyboardEvent) => this.handle(e);
  }

  /** Registers a single binding. Returns false on a duplicate or invalid combo. */
  register(binding: HotkeyBinding): boolean {
    const parsed = parseCombo(binding.combo);
    if (!parsed) return false;
    const lookup = comboLookup(parsed);
    if (this.bindings.has(lookup)) return false;
    this.bindings.set(lookup, { ...binding, combo: normalizedCombo(parsed) });
    return true;
  }

  /** Removes a binding by its (human) combo string. Returns true if removed. */
  unregister(combo: string): boolean {
    const parsed = parseCombo(combo);
    if (!parsed) return false;
    return this.bindings.delete(comboLookup(parsed));
  }

  /** Remaps a binding from oldCombo → newCombo, preserving its command/scope. */
  remap(oldCombo: string, newCombo: string): boolean {
    const oldParsed = parseCombo(oldCombo);
    const newParsed = parseCombo(newCombo);
    if (!oldParsed || !newParsed) return false;
    const oldKey = comboLookup(oldParsed);
    const newKey = comboLookup(newParsed);
    if (oldKey === newKey) return true;
    const binding = this.bindings.get(oldKey);
    if (!binding) return false;
    if (this.bindings.has(newKey)) return false; // refuse to clobber
    this.bindings.delete(oldKey);
    this.bindings.set(newKey, {
      ...binding,
      combo: normalizedCombo(newParsed),
    });
    return true;
  }

  /** Returns a snapshot of the current bindings (sorted by combo). */
  list(): HotkeyBinding[] {
    return Array.from(this.bindings.values()).sort((a, b) =>
      a.combo.localeCompare(b.combo),
    );
  }

  /** Installs the dispatch callback. Required before enable() does anything. */
  setDispatch(dispatch: HotkeyDispatch): void {
    this.dispatch = dispatch;
  }

  /** Attaches the single capture-phase keydown listener to window. */
  enable(): void {
    if (this.enabled) return;
    if (typeof window === 'undefined') return; // SSR — no-op
    if (!this.listener) return;
    // capture: true so we see the event before environment-level handlers
    // and can preventDefault() cleanly.
    window.addEventListener('keydown', this.listener, true);
    this.enabled = true;
  }

  /** Detaches the listener. Safe to call when already disabled or in SSR. */
  disable(): void {
    if (!this.enabled) return;
    if (typeof window === 'undefined') {
      this.enabled = false;
      return;
    }
    if (this.listener) {
      window.removeEventListener('keydown', this.listener, true);
    }
    this.enabled = false;
  }

  /** True when the capture-phase listener is currently attached. */
  isEnabled(): boolean {
    return this.enabled;
  }

  /** Clears every binding (does not detach the listener). */
  clear(): void {
    this.bindings.clear();
  }

  /** Loads the DEFAULT_HOTKEYS table. Idempotent. */
  loadDefaults(): number {
    let n = 0;
    for (const b of DEFAULT_HOTKEYS) {
      if (this.register(b)) n++;
    }
    return n;
  }

  /** The single keydown handler. */
  private handle(e: KeyboardEvent): void {
    const lookup = eventLookup(e);
    if (!lookup) return;
    const binding = this.bindings.get(lookup);
    if (!binding) return;
    if (!this.dispatch) return;
    // Prevent the browser default (e.g. Ctrl+K focusing the URL bar in some
    // browsers) and stop the event from reaching environment-level handlers.
    e.preventDefault();
    e.stopPropagation();
    const command = this.mintCommand(binding);
    if (command) this.dispatch(command);
  }

  /**
   * Mints the UiCommand for a binding. FOCUS bindings carry a concrete
   * target resolved from the combo digit; EXPORT/IMPORT/TOGGLE/etc. are
   * global and carry no target (the orchestrator decides routing).
   */
  private mintCommand(binding: HotkeyBinding): UiCommand | null {
    const command: UiCommandKind = binding.command;
    let target: UiCommand['target'];
    let payload: unknown;
    if (command === 'FOCUS') {
      // Resolve Ctrl+Alt+1..5 → environment id.
      const digit = /(\d)$/.exec(binding.combo);
      if (digit) {
        const idx = parseInt(digit[1], 10) - 1;
        target = FOCUS_INDEX[idx];
      }
    }
    // EXPORT/IMPORT carry the mode (copy/cut/paste) so the orchestrator can
    // distinguish Ctrl+Alt+C (copy) from Ctrl+Alt+X (cut) from Ctrl+Alt+V
    // (paste) — all three are EXPORT/IMPORT but with different semantics.
    if (command === 'EXPORT') {
      payload = binding.combo.endsWith('x') ? 'cut' : 'copy';
    } else if (command === 'IMPORT') {
      payload = 'paste';
    }
    return {
      kind: 'ui.command',
      command,
      target,
      payload,
      timestamp: new Date().toISOString(),
    };
  }
}

/** Returns the canonical display form of a parsed combo ("Ctrl+Alt+1"). */
function normalizedCombo(parsed: ParsedCombo): string {
  const labels: Record<Modifier, string> = {
    ctrl: 'Ctrl',
    alt: 'Alt',
    shift: 'Shift',
    meta: 'Meta',
  };
  const modPart = parsed.mods.map((m) => labels[m]).join('+');
  const keyPart = parsed.key.length === 1
    ? parsed.key.toUpperCase()
    : parsed.key.charAt(0).toUpperCase() + parsed.key.slice(1);
  return modPart ? `${modPart}+${keyPart}` : keyPart;
}

/* ---------- singleton ---------- */

let singleton: HotkeyRegistry | null = null;

/** Process-wide HotkeyRegistry singleton. Lazily constructed. */
export function getHotkeyRegistry(): HotkeyRegistry {
  if (!singleton) singleton = new HotkeyRegistry();
  return singleton;
}
