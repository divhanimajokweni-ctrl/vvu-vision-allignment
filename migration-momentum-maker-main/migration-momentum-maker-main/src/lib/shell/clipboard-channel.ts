/* VVU SHELL CLIENT — §6 import/export port (clipboard channel).
 *
 * The shell's ONLY channel for moving envelopes between environments (and
 * out to / in from the outside world) is the async Clipboard API. Every
 * write is envelope JSON — never raw text — so a paste can always be
 * validated back into a typed Envelope. The channel never writes a bare
 * string, a screenshot, or an HTML fragment.
 *
 * Fallback: when the async Clipboard API is unavailable (older browsers,
 * insecure context, or SSR), copy() falls back to a hidden textarea +
 * document.execCommand('copy'), and paste() falls back to a focused
 * textarea that listens for a 'paste' event. The fallback is still
 * envelope-JSON-only — it just uses a legacy transport.
 */

import type { Envelope, ImportResult } from './types';
import { SUPPORTED_ENVELOPE_VERSIONS } from './types';
import { negotiate } from './version-negotiation';

/** MIME-like prefix stamped on every clipboard write so paste can self-identify. */
const ENVELOPE_PREFIX = 'vvu-envelope+json:';

/**
 * ClipboardChannel — typed envelope transport over the async Clipboard API.
 * Use getClipboardChannel() for the process-wide singleton.
 */
export class ClipboardChannel {
  /**
   * Writes an envelope to the clipboard as JSON. MUST be called from within
   * a user gesture (the browser enforces this for the async Clipboard API;
   * the textarea fallback relies on it too).
   *
   * Returns { ok: true } on success, or { ok: false, code, reason } on
   * failure (never throws — callers can await confidently).
   */
  async copy(envelope: Envelope): Promise<{ ok: boolean; code?: string; reason?: string }> {
    const text = serializeEnvelope(envelope);
    // Preferred path: async Clipboard API.
    if (hasAsyncClipboard()) {
      try {
        await navigator.clipboard.writeText(text);
        return { ok: true };
      } catch (err) {
        // Fall through to textarea fallback. Some browsers reject writeText
        // outside a secure context or without a gesture; the textarea path
        // is more permissive in those cases.
        console.warn('[shell.clipboard] writeText failed, trying textarea fallback', err);
      }
    }
    // Fallback: hidden textarea + execCommand('copy').
    if (typeof document !== 'undefined') {
      const ok = textareaCopy(text);
      if (ok) return { ok: true };
      return {
        ok: false,
        code: 'CLIPBOARD_WRITE_FAILED',
        reason: 'both async Clipboard API and textarea fallback failed',
      };
    }
    return {
      ok: false,
      code: 'CLIPBOARD_UNAVAILABLE',
      reason: 'no clipboard API available (SSR or insecure context)',
    };
  }

  /**
   * Reads + parses + validates an envelope from the clipboard. Resolves to
   * an ImportResult — { ok: true, envelope } on success, or
   * { ok: false, reason, code } on any failure (bad JSON, wrong shape,
   * unsupported version, etc.).
   *
   * The note from a soft-accept (newer minor within major) is attached to
   * the success branch so the caller can stamp it onto the artefact's
   * limitations[].
   */
  async paste(): Promise<ImportResult> {
    let text: string | null = null;
    if (hasAsyncClipboard()) {
      try {
        text = await navigator.clipboard.readText();
      } catch (err) {
        console.warn('[shell.clipboard] readText failed, trying textarea fallback', err);
        text = null;
      }
    }
    if (text === null && typeof document !== 'undefined') {
      text = await textareaPaste();
    }
    if (text === null || text === '') {
      return {
        ok: false,
        reason: 'clipboard read returned no text',
        code: 'CLIPBOARD_EMPTY',
      };
    }
    return parseEnvelope(text);
  }

  /** True if the async Clipboard API is available (navigator.clipboard + writeText). */
  isAsyncAvailable(): boolean {
    return hasAsyncClipboard();
  }
}

/** Serializes an envelope to the clipboard wire format (prefix + JSON). */
function serializeEnvelope(envelope: Envelope): string {
  // Stable JSON for reproducible digests: sorted keys, no whitespace.
  const json = stableJsonStringify(envelope);
  return ENVELOPE_PREFIX + json;
}

/** Stable JSON stringify — sorts object keys recursively. */
function stableJsonStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[k] = sortKeys((value as Record<string, unknown>)[k]);
    }
    return sorted;
  }
  return value;
}

/** Parses + validates a clipboard string into an Envelope (or ImportResult). */
export function parseEnvelope(text: string): ImportResult {
  let raw = text.trim();
  // Accept both the prefixed wire format and bare JSON (so external tools
  // that emit plain envelope JSON still paste cleanly).
  if (raw.startsWith(ENVELOPE_PREFIX)) {
    raw = raw.slice(ENVELOPE_PREFIX.length).trim();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      ok: false,
      reason: `clipboard text is not valid JSON: ${String(err)}`,
      code: 'INVALID_JSON',
    };
  }
  return validateEnvelope(parsed);
}

/**
 * Validates an unknown value as an Envelope. Runs the version handshake
 * against SUPPORTED_ENVELOPE_VERSIONS. Returns the typed envelope on
 * success, or a structured error.
 */
export function validateEnvelope(obj: unknown): ImportResult {
  if (!obj || typeof obj !== 'object') {
    return { ok: false, reason: 'envelope is not an object', code: 'INVALID_ENVELOPE' };
  }
  const e = obj as Record<string, unknown>;
  const required = [
    'envelope_version',
    'artefact_id',
    'artefact_type',
    'produced_by',
    'produced_at',
    'content',
    'provenance',
    'integrity',
    'status',
    'limitations',
  ] as const;
  for (const f of required) {
    if (!(f in e)) {
      return { ok: false, reason: `missing field: ${f}`, code: 'INVALID_ENVELOPE' };
    }
  }
  // Version handshake.
  const version = String(e.envelope_version);
  const neg = negotiate(version, SUPPORTED_ENVELOPE_VERSIONS);
  if (!neg.ok) {
    return {
      ok: false,
      reason: neg.reason || 'version rejected',
      code: 'REJECTED_VERSION_UNSUPPORTED',
    };
  }
  // Type checks on the fields the shell itself reads.
  if (typeof e.status !== 'string') {
    return { ok: false, reason: 'status must be a string', code: 'INVALID_ENVELOPE' };
  }
  if (!Array.isArray(e.limitations)) {
    return { ok: false, reason: 'limitations must be an array', code: 'INVALID_ENVELOPE' };
  }
  if (!e.provenance || typeof e.provenance !== 'object' || !Array.isArray((e.provenance as Record<string, unknown>).inputs)) {
    return { ok: false, reason: 'provenance.inputs must be an array', code: 'INVALID_ENVELOPE' };
  }
  if (!e.integrity || typeof e.integrity !== 'object' || typeof (e.integrity as Record<string, unknown>).digest !== 'string') {
    return { ok: false, reason: 'integrity.digest must be a string', code: 'INVALID_ENVELOPE' };
  }
  const envelope = e as unknown as Envelope;
  return neg.note
    ? { ok: true, envelope, note: neg.note }
    : { ok: true, envelope };
}

/* ---------- async clipboard availability ---------- */

function hasAsyncClipboard(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.clipboard !== 'undefined' &&
    typeof navigator.clipboard.writeText === 'function' &&
    typeof navigator.clipboard.readText === 'function'
  );
}

/* ---------- textarea fallbacks ---------- */

/** Hidden-textarea copy via execCommand('copy'). Returns true on success. */
function textareaCopy(text: string): boolean {
  if (typeof document === 'undefined') return false;
  const ta = document.createElement('textarea');
  ta.value = text;
  // Hide the textarea off-screen so the copy is invisible.
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.top = '-1000px';
  ta.style.left = '-1000px';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

/**
 * Textarea-paste fallback. Creates a hidden, focused textarea and resolves
 * with the pasted text on the next 'paste' event. Rejects after a timeout
 * so the promise can never hang forever.
 *
 * This is the only way to read the clipboard when the async Clipboard API
 * is unavailable (e.g. non-secure context). The user must press Ctrl/Cmd+V
 * into the (invisible) focused textarea.
 */
function textareaPaste(): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }
    const ta = document.createElement('textarea');
    ta.placeholder = 'Paste (Ctrl/Cmd+V)…';
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '50%';
    ta.style.left = '50%';
    ta.style.transform = 'translate(-50%, -50%)';
    ta.style.width = 'min(90vw, 480px)';
    ta.style.height = '120px';
    ta.style.zIndex = '9999';
    ta.style.opacity = '0.01'; // nearly invisible but focusable
    document.body.appendChild(ta);
    ta.focus();

    let settled = false;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      ta.remove();
      window.removeEventListener('keydown', onKey, true);
    };
    const done = (value: string | null) => {
      cleanup();
      resolve(value);
    };
    const timer = window.setTimeout(() => done(null), 30000);
    const onPaste = (ev: ClipboardEvent) => {
      const data = ev.clipboardData?.getData('text') ?? null;
      ev.preventDefault();
      done(data);
    };
    const onKey = (ev: KeyboardEvent) => {
      // Esc cancels the paste early.
      if (ev.key === 'Escape') {
        ev.preventDefault();
        ev.stopPropagation();
        done(null);
      }
    };
    ta.addEventListener('paste', onPaste, { once: true });
    window.addEventListener('keydown', onKey, true);
  });
}

/* ---------- singleton ---------- */

let singleton: ClipboardChannel | null = null;

/** Process-wide ClipboardChannel singleton. Lazily constructed (SSR-safe). */
export function getClipboardChannel(): ClipboardChannel {
  if (!singleton) singleton = new ClipboardChannel();
  return singleton;
}
