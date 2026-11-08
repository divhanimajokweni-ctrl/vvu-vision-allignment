# Receipt Chain Spec (Draft)

## Entry format (example)
```json
{
  "seq": 1,
  "prevHash": "GENESIS-...",
  "source": "MANIFEST",
  "event": "RELEASE_HASH_REGISTERED",
  "details": "...",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "hash": "<hex sha256>"
}
```

## Hash computation (must be specified precisely in production)
A production spec must define:
- canonical serialization (recommend RFC 8785 JCS) for structured payloads,
- byte encoding for integers/strings and field ordering,
- domain separation tags (to prevent cross-context replay),
- signature scheme and verification (e.g., Ed25519) if `SIG_INVALID`/authenticity is claimed,
- genesis constant and external anchoring of heads.

**This draft verifier** checks a specific concatenation format used by the reference implementation; treat it as an integrity demo, not a final standard.

## Test vectors
Add known `(input -> hash)` vectors before external use. Without vectors, independent implementations may diverge.
