/* VVU SHELL CLIENT — §7 version negotiation (envelope_version handshake).
 *
 * Mirrors the interop layer's negotiate() semantics but with the simpler
 * { ok, reason?, note? } return shape the shell contract calls for.
 *
 * Rules (shell contract §7):
 *   - exact match against supportedVersions  → ok
 *   - newer minor/patch within the SAME major → ok + limitation note
 *   - newer major                            → reject
 *   - older major / unknown                  → reject
 *
 * The note on a soft-accept is a STANDING LIMITATION: a newer-minor envelope
 * is accepted on the assumption that the new fields are additive and the
 * older profile can safely ignore them. The orchestrator should attach the
 * note to the imported artefact's limitations[] so downstream consumers see
 * the version drift.
 */

export interface NegotiateResult {
  ok: boolean;
  /** Present only when ok is false — human-readable rejection reason. */
  reason?: string;
  /** Present only when ok is true AND the version was a soft-accept. */
  note?: string;
}

const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

type Semver = [number, number, number];

function parseSemver(v: string): Semver | null {
  const m = SEMVER_RE.exec(v);
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

function cmpSemver(a: Semver, b: Semver): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/**
 * Negotiates whether an incoming envelope_version is acceptable against a
 * list of supported versions. Pure function — no I/O, no side effects.
 */
export function negotiate(
  incomingVersion: string,
  supportedVersions: readonly string[],
): NegotiateResult {
  const incoming = parseSemver(String(incomingVersion));
  if (!incoming) {
    return {
      ok: false,
      reason: `unparseable envelope_version: ${incomingVersion}`,
    };
  }
  if (supportedVersions.length === 0) {
    return { ok: false, reason: 'no supported versions declared' };
  }

  // Exact match → ok, no note.
  if (supportedVersions.includes(incomingVersion)) {
    return { ok: true };
  }

  // Soft-accept: find the highest supported version that shares the same
  // major AND is older than the incoming version. If one exists, the
  // incoming is a newer minor/patch within the same major → accept + note.
  let best: Semver | null = null;
  let bestStr = '';
  for (const s of supportedVersions) {
    const sp = parseSemver(s);
    if (!sp) continue;
    if (sp[0] === incoming[0] && cmpSemver(sp, incoming) < 0) {
      if (!best || cmpSemver(sp, best) > 0) {
        best = sp;
        bestStr = s;
      }
    }
  }
  if (best) {
    return {
      ok: true,
      note: `envelope_version ${incomingVersion} is newer than supported ${bestStr} within major ${incoming[0]}; new fields treated as additive`,
    };
  }

  // Reject. Distinguish "newer major" from "older/unknown" for clearer logs.
  const supportedMajors = supportedVersions
    .map((s) => parseSemver(s))
    .filter((p): p is Semver => p !== null)
    .map((p) => p[0]);
  const maxSupportedMajor = supportedMajors.length
    ? Math.max(...supportedMajors)
    : -1;

  if (incoming[0] > maxSupportedMajor) {
    return {
      ok: false,
      reason: `newer major not supported: received ${incomingVersion}; supported ${supportedVersions.join(', ')}`,
    };
  }
  return {
    ok: false,
    reason: `unsupported envelope_version: received ${incomingVersion}; supported ${supportedVersions.join(', ')}`,
  };
}
