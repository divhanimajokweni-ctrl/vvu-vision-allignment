// src/lib/icsh/totp.ts — RFC 6238 TOTP (time-based one-time password) with
// HMAC-SHA1, 6 digits, 30s step. This is the universal join path: works with
// Google Authenticator, Microsoft Authenticator, Authy, Aegis, FreeOTP — no
// HTTPS, no camera, no iOS sensor permission. Bank-grade standard.
//
// Secret format honours the accepted artifact: `EDGEGQ-` + 16 base32 chars.

import { createHmac, randomBytes } from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Fresh enrolment secret: `EDGEGQ-` + base32(10 random bytes) — 80 bits. */
export function generateTotpSecret(): string {
  return `EDGEGQ-${base32Encode(randomBytes(10))}`;
}

function hotp(key: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const digest = createHmac('sha1', key).update(buf).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

/** The 6-digit code an authenticator shows right now (±offset steps). */
export function totpAt(secret: string, atMs: number, offsetSteps = 0): string {
  const step = Math.floor(atMs / 1000 / 30) + offsetSteps;
  return hotp(base32Decode(secret.replace(/^EDGEGQ-/, '')), step);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Verify a user-typed code with the standard ±1 step window. */
export function verifyTotp(secret: string, code: string, nowMs = Date.now()): boolean {
  const cleaned = code.replace(/\D/g, '');
  if (cleaned.length !== 6) return false;
  for (const offset of [0, -1, 1]) {
    if (safeEqual(totpAt(secret, nowMs, offset), cleaned)) return true;
  }
  return false;
}

export function otpauthUri(callsign: string, secret: string): string {
  const b32 = secret.replace(/^EDGEGQ-/, '');
  return `otpauth://totp/VVU-TRUST:${encodeURIComponent(callsign)}?secret=${b32}&issuer=VVU-TRUST&algorithm=SHA1&digits=6&period=30`;
}
