#!/usr/bin/env node
/**
 * verify-chain.js — reference integrity verifier (demo)
 * Verifies hash-link integrity for a JSON array exported from the app's WORM ledger.
 * It DOES NOT prove data truth, device authenticity, or absence of operator rewrite
 * without signatures and external anchoring.
 *
 * Usage:
 *   node verify-chain.js chain.json
 *   node verify-chain.js chain.jsonl
 */
const fs = require('fs');
const crypto = require('crypto');

const GENESIS_HASH = 'GENESIS-20260901-0000000000000000000000000000000000';

function sha256(s) { return crypto.createHash('sha256').update(s, 'utf8').digest('hex'); }

function load(file) {
  const raw = fs.readFileSync(file, 'utf8').trim();
  if (!raw) return [];
  if (raw.startsWith('[')) return JSON.parse(raw);
  return raw.split(/\n+/).map(l => JSON.parse(l));
}

function verify(entries) {
  // sort by seq ascending for verification
  const rows = [...entries].sort((a,b) => (a.seq||0)-(b.seq||0));
  let prev = GENESIS_HASH;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const createdAt = r.createdAt;
    const expect = sha256(`${prev}|${r.seq}|${r.source}|${r.event}|${r.details ?? ''}|${createdAt}`);
    if (r.prevHash !== prev) {
      return { ok: false, breakAt: r.seq, reason: 'PREV_HASH_MISMATCH', index: i };
    }
    if (r.hash !== expect) {
      return { ok: false, breakAt: r.seq, reason: 'HASH_MISMATCH', index: i, expect, got: r.hash };
    }
    prev = r.hash;
  }
  return { ok: true, count: rows.length, lastHash: rows[rows.length-1]?.hash ?? null };
}

const file = process.argv[2];
if (!file) {
  console.error('Usage: node verify-chain.js <chain.json|chain.jsonl>');
  process.exit(2);
}
try {
  const entries = load(file);
  const res = verify(entries);
  console.log(JSON.stringify(res, null, 2));
  process.exit(res.ok ? 0 : 1);
} catch (e) {
  console.error(JSON.stringify({ ok: false, reason: 'LOAD_OR_PARSE_ERROR', message: e.message }, null, 2));
  process.exit(1);
}
