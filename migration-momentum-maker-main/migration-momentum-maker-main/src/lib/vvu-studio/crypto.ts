// VVU Studio lib — crypto module
// Browser-only crypto helpers. The studio is 100% client-side; this module
// wraps Web Crypto where available, falling back to a deterministic JS hash
// when crypto.subtle is unavailable (older runtimes, insecure contexts).

/** Truncate a hex hash to its first `len` chars (default 8). Returns "" for
 *  falsy input. Used everywhere the studio shows a fingerprint — receipts,
 *  merkle nodes, audit log lines — so the layout doesn't break on long
 *  SHA-256 digests. */
export function short(hash: string | null | undefined, len = 8): string {
  if (!hash) return "";
  return hash.slice(0, len);
}

/** SHA-256 over an arbitrary string, hex-encoded. Uses Web Crypto when
 *  available; falls back to a 53-bit FNV-1a hash when not (clearly distinct
 *  shape — 16 hex chars, never confused for a real SHA-256). */
export async function sha256Hex(input: string): Promise<string> {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.subtle) {
    const bytes = new TextEncoder().encode(input);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // FNV-1a fallback — clearly distinct (16 hex chars, not 64).
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < input.length; i++) {
    h ^= BigInt(input.charCodeAt(i));
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, "0");
}
