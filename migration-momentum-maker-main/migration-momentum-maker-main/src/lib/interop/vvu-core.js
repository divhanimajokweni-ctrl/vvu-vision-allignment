/* VVU INTEROP CORE — implements VVU-SF-2026-001 (as amended by VVU-GLOSS-2026-001).
   Zero dependencies. Runs in a page, a Worker, and Node >= 18. No network. No storage.
   Contract: this module never assigns VERIFIED. Only a policy check performed by Bench may. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VVU = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- bytes / encoding ---------- */
  var HEXT = '0123456789abcdef';
  function bytesToHex(b) { var s = ''; for (var i = 0; i < b.length; i++) s += HEXT[b[i] >> 4] + HEXT[b[i] & 15]; return s; }
  function hexToBytes(h) {
    if (typeof h !== 'string' || h.length % 2 || /[^0-9a-f]/.test(h)) throw new Error('invalid lowercase hex');
    var o = new Uint8Array(h.length / 2);
    for (var i = 0; i < o.length; i++) o[i] = parseInt(h.substr(i * 2, 2), 16);
    return o;
  }
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  function b64uEncode(b) {
    var s = '', i = 0;
    for (; i + 2 < b.length; i += 3) {
      var n = (b[i] << 16) | (b[i + 1] << 8) | b[i + 2];
      s += B64[n >> 18] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
    }
    if (i + 1 === b.length) { var n1 = b[i] << 16; s += B64[n1 >> 18] + B64[(n1 >> 12) & 63]; }
    else if (i + 2 === b.length) { var n2 = (b[i] << 16) | (b[i + 1] << 8); s += B64[n2 >> 18] + B64[(n2 >> 12) & 63] + B64[(n2 >> 6) & 63]; }
    return s;
  }
  function b64uDecode(s) {
    if (/[^A-Za-z0-9_-]/.test(s)) throw new Error('invalid base64url');
    var out = [], buf = 0, bits = 0;
    for (var i = 0; i < s.length; i++) {
      buf = (buf << 6) | B64.indexOf(s[i]); bits += 6;
      if (bits >= 8) { bits -= 8; out.push((buf >> bits) & 255); buf &= (1 << bits) - 1; }
    }
    return new Uint8Array(out);
  }
  function utf8(s) { return new TextEncoder().encode(String(s)); }

  /* ---------- SHA-256 (FIPS 180-4) ---------- */
  var SHA256 = (function () {
    var K = new Uint32Array([
      0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
    function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
    function digest(bytes) {
      var l = bytes.length, hi = Math.floor(l / 536870912), lo = (l * 8) >>> 0;
      var pad = ((56 - ((l + 1) % 64)) + 64) % 64, total = l + 1 + pad + 8, m = new Uint8Array(total);
      m.set(bytes); m[l] = 0x80;
      var p = total - 8;
      m[p] = hi >>> 24; m[p + 1] = hi >>> 16; m[p + 2] = hi >>> 8; m[p + 3] = hi;
      m[p + 4] = lo >>> 24; m[p + 5] = lo >>> 16; m[p + 6] = lo >>> 8; m[p + 7] = lo;
      var H = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
      var w = new Uint32Array(64);
      for (var off = 0; off < total; off += 64) {
        for (var i = 0; i < 16; i++) { var j = off + i * 4; w[i] = ((m[j] << 24) | (m[j + 1] << 16) | (m[j + 2] << 8) | m[j + 3]) >>> 0; }
        for (i = 16; i < 64; i++) {
          var x = w[i - 15], y = w[i - 2];
          w[i] = (w[i - 16] + ((rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3)) >>> 0) + w[i - 7] + ((rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10)) >>> 0)) >>> 0;
        }
        var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
        for (i = 0; i < 64; i++) {
          var S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
          var t1 = (h + S1 + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
          var S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
          var t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
          h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
        }
        H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
        H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
      }
      var out = new Uint8Array(32);
      for (i = 0; i < 8; i++) { out[i * 4] = H[i] >>> 24; out[i * 4 + 1] = H[i] >>> 16; out[i * 4 + 2] = H[i] >>> 8; out[i * 4 + 3] = H[i]; }
      return out;
    }
    return { digest: digest, hex: function (s) { return bytesToHex(digest(typeof s === 'string' ? utf8(s) : s)); } };
  })();

  /* ---------- SHA-512 + Ed25519 (RFC 8032), BigInt ---------- */
  var SHA512 = (function () {
    var K = [0x428a2f98d728ae22n,0x7137449123ef65cdn,0xb5c0fbcfec4d3b2fn,0xe9b5dba58189dbbcn,0x3956c25bf348b538n,0x59f111f1b605d019n,0x923f82a4af194f9bn,0xab1c5ed5da6d8118n,0xd807aa98a3030242n,0x12835b0145706fben,0x243185be4ee4b28cn,0x550c7dc3d5ffb4e2n,0x72be5d74f27b896fn,0x80deb1fe3b1696b1n,0x9bdc06a725c71235n,0xc19bf174cf692694n,0xe49b69c19ef14ad2n,0xefbe4786384f25e3n,0x0fc19dc68b8cd5b5n,0x240ca1cc77ac9c65n,0x2de92c6f592b0275n,0x4a7484aa6ea6e483n,0x5cb0a9dcbd41fbd4n,0x76f988da831153b5n,0x983e5152ee66dfabn,0xa831c66d2db43210n,0xb00327c898fb213fn,0xbf597fc7beef0ee4n,0xc6e00bf33da88fc2n,0xd5a79147930aa725n,0x06ca6351e003826fn,0x142929670a0e6e70n,0x27b70a8546d22ffcn,0x2e1b21385c26c926n,0x4d2c6dfc5ac42aedn,0x53380d139d95b3dfn,0x650a73548baf63den,0x766a0abb3c77b2a8n,0x81c2c92e47edaee6n,0x92722c851482353bn,0xa2bfe8a14cf10364n,0xa81a664bbc423001n,0xc24b8b70d0f89791n,0xc76c51a30654be30n,0xd192e819d6ef5218n,0xd69906245565a910n,0xf40e35855771202an,0x106aa07032bbd1b8n,0x19a4c116b8d2d0c8n,0x1e376c085141ab53n,0x2748774cdf8eeb99n,0x34b0bcb5e19b48a8n,0x391c0cb3c5c95a63n,0x4ed8aa4ae3418acbn,0x5b9cca4f7763e373n,0x682e6ff3d6b2b8a3n,0x748f82ee5defb2fcn,0x78a5636f43172f60n,0x84c87814a1f0ab72n,0x8cc702081a6439ecn,0x90befffa23631e28n,0xa4506cebde82bde9n,0xbef9a3f7b2c67915n,0xc67178f2e372532bn,0xca273eceea26619cn,0xd186b8c721c0c207n,0xeada7dd6cde0eb1en,0xf57d4f7fee6ed178n,0x06f067aa72176fban,0x0a637dc5a2c898a6n,0x113f9804bef90daen,0x1b710b35131c471bn,0x28db77f523047d84n,0x32caab7b40c72493n,0x3c9ebe0a15c9bebcn,0x431d67c49c100d4cn,0x4cc5d4becb3e42b6n,0x597f299cfc657e2an,0x5fcb6fab3ad6faecn,0x6c44198c4a475817n];
    var M = 0xffffffffffffffffn;
    function rotr(x, n) { return ((x >> n) | (x << (64n - n))) & M; }
    function digest(bytes) {
      var l = bytes.length, lo = BigInt(l) * 8n;
      var pad = ((112 - ((l + 1) % 128)) + 128) % 128, total = l + 1 + pad + 16, m = new Uint8Array(total);
      m.set(bytes); m[l] = 0x80;
      var p = total - 8, i, j;
      for (i = 0; i < 8; i++) m[p + i] = Number((lo >> BigInt(56 - 8 * i)) & 0xffn);
      var H = [0x6a09e667f3bcc908n,0xbb67ae8584caa73bn,0x3c6ef372fe94f82bn,0xa54ff53a5f1d36f1n,0x510e527fade682d1n,0x9b05688c2b3e6c1fn,0x1f83d9abfb41bd6bn,0x5be0cd19137e2179n];
      var w = new Array(80);
      for (var off = 0; off < total; off += 128) {
        for (i = 0; i < 16; i++) { var v = 0n; for (j = 0; j < 8; j++) v = (v << 8n) | BigInt(m[off + i * 8 + j]); w[i] = v; }
        for (i = 16; i < 80; i++) {
          var x = w[i - 15], y = w[i - 2];
          var s0 = rotr(x, 1n) ^ rotr(x, 8n) ^ (x >> 7n), s1 = rotr(y, 19n) ^ rotr(y, 61n) ^ (y >> 6n);
          w[i] = (w[i - 16] + s0 + w[i - 7] + s1) & M;
        }
        var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
        for (i = 0; i < 80; i++) {
          var S1 = rotr(e, 14n) ^ rotr(e, 18n) ^ rotr(e, 41n), ch = (e & f) ^ ((~e) & g);
          var t1 = (h + S1 + ch + K[i] + w[i]) & M;
          var S0 = rotr(a, 28n) ^ rotr(a, 34n) ^ rotr(a, 39n), mj = (a & b) ^ (a & c) ^ (b & c);
          var t2 = (S0 + mj) & M;
          h = g; g = f; f = e; e = (d + t1) & M; d = c; c = b; b = a; a = (t1 + t2) & M;
        }
        H[0] = (H[0] + a) & M; H[1] = (H[1] + b) & M; H[2] = (H[2] + c) & M; H[3] = (H[3] + d) & M;
        H[4] = (H[4] + e) & M; H[5] = (H[5] + f) & M; H[6] = (H[6] + g) & M; H[7] = (H[7] + h) & M;
      }
      var out = new Uint8Array(64);
      for (i = 0; i < 8; i++) for (j = 0; j < 8; j++) out[i * 8 + j] = Number((H[i] >> BigInt(56 - 8 * j)) & 0xffn);
      return out;
    }
    return { digest: digest };
  })();

  var Ed25519 = (function () {
    var p = (1n << 255n) - 19n, L = (1n << 252n) + 27742317777372353535851937790883648493n;
    function mod(a) { return ((a % p) + p) % p; }
    function pow(b, e) { var r = 1n; b = mod(b); while (e > 0n) { if (e & 1n) r = mod(r * b); b = mod(b * b); e >>= 1n; } return r; }
    function inv(a) { return pow(a, p - 2n); }
    var d = mod(-121665n * inv(121666n)), I = pow(2n, (p - 1n) / 4n);
    function xrecover(y) {
      var xx = mod((y * y - 1n) * inv(d * y * y + 1n)), x = pow(xx, (p + 3n) / 8n);
      if (mod(x * x - xx) !== 0n) x = mod(x * I);
      if (mod(x * x - xx) !== 0n) return null;
      if (x & 1n) x = p - x;
      return x;
    }
    var By = mod(4n * inv(5n)), B = [xrecover(By), By], NEUTRAL = [0n, 1n];
    function add(P, Q) {
      var x1 = P[0], y1 = P[1], x2 = Q[0], y2 = Q[1], t = d * x1 * x2 * y1 * y2;
      return [mod((x1 * y2 + x2 * y1) * inv(1n + t)), mod((y1 * y2 + x1 * x2) * inv(1n - t))];
    }
    function mul(P, e) { var Q = NEUTRAL; while (e > 0n) { if (e & 1n) Q = add(Q, P); P = add(P, P); e >>= 1n; } return Q; }
    function encPoint(P) {
      var y = P[1], b = new Uint8Array(32);
      for (var i = 0; i < 32; i++) { b[i] = Number(y & 0xffn); y >>= 8n; }
      if (P[0] & 1n) b[31] |= 0x80;
      return b;
    }
    function decPoint(b) {
      if (b.length !== 32) return null;
      var y = 0n; for (var i = 31; i >= 0; i--) y = (y << 8n) | BigInt(b[i]);
      var sign = (b[31] & 0x80) !== 0; y &= (1n << 255n) - 1n;
      if (y >= p) return null;
      var x = xrecover(y); if (x === null) return null;
      if (x === 0n && sign) return null;
      if (sign !== ((x & 1n) === 1n)) x = p - x;
      return [x, y];
    }
    function le(bytes) { var n = 0n; for (var i = bytes.length - 1; i >= 0; i--) n = (n << 8n) | BigInt(bytes[i]); return n; }
    function encInt(n) { var b = new Uint8Array(32); for (var i = 0; i < 32; i++) { b[i] = Number(n & 0xffn); n >>= 8n; } return b; }
    function cat() { var t = 0, i; for (i = 0; i < arguments.length; i++) t += arguments[i].length; var o = new Uint8Array(t), k = 0; for (i = 0; i < arguments.length; i++) { o.set(arguments[i], k); k += arguments[i].length; } return o; }
    function keypair(seed) {
      if (!(seed instanceof Uint8Array) || seed.length !== 32) throw new Error('seed must be 32 bytes');
      var h = SHA512.digest(seed), a = le(h.slice(0, 32));
      a &= (1n << 254n) - 8n; a |= (1n << 254n);
      return { seed: seed, secret: a, publicKey: encPoint(mul(B, a)) };
    }
    function sign(kp, msg) {
      var h = SHA512.digest(kp.seed), r = le(SHA512.digest(cat(h.slice(32), msg))) % L, R = encPoint(mul(B, r));
      var k = le(SHA512.digest(cat(R, kp.publicKey, msg))) % L;
      return cat(R, encInt((r + k * kp.secret) % L));
    }
    function verify(pub, msg, sig) {
      if (!(sig instanceof Uint8Array) || sig.length !== 64 || !(pub instanceof Uint8Array) || pub.length !== 32) return false;
      var A = decPoint(pub), R = decPoint(sig.slice(0, 32)), S = le(sig.slice(32));
      if (!A || !R || S >= L) return false;
      var k = le(SHA512.digest(cat(sig.slice(0, 32), pub, msg))) % L;
      var l = mul(B, S), r = add(R, mul(A, k));
      return l[0] === r[0] && l[1] === r[1];
    }
    return { keypair: keypair, sign: sign, verify: verify };
  })();

  /* ---------- RFC 8785 JCS ---------- */
  function jcs(v) {
    if (v === null) return 'null';
    var t = typeof v;
    if (t === 'boolean') return v ? 'true' : 'false';
    if (t === 'number') { if (!isFinite(v)) throw new Error('JCS: non-finite number'); return JSON.stringify(v); }
    if (t === 'string') return JSON.stringify(v);
    if (t === 'undefined' || t === 'function' || t === 'symbol' || t === 'bigint') throw new Error('JCS: unserialisable ' + t);
    if (Array.isArray(v)) return '[' + v.map(function (x) { if (x === undefined) throw new Error('JCS: undefined in array'); return jcs(x); }).join(',') + ']';
    var keys = Object.keys(v).filter(function (k) { return v[k] !== undefined; }).sort();
    return '{' + keys.map(function (k) { return JSON.stringify(k) + ':' + jcs(v[k]); }).join(',') + '}';
  }

  /* ---------- identity ---------- */
  function uuid4() {
    var c = (typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto : null;
    if (!c) throw new Error('no CSPRNG available: refusing to mint an artefact_id');
    var b = new Uint8Array(16); c.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    var h = bytesToHex(b);
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }
  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  var SEMVER_RE = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
  var ENVS = ['forge', 'bench', 'fire', 'field', 'press'];
  var TIERS = ['Reality', 'Architecture', 'Hypothesis', 'Vision'];

  /* ---------- profiles: 1.0.0 = ratified; 2.0.0 = VVU-GLOSS-2026-001 §6 amendments (PROPOSED) ---------- */
  var TYPES_BASE = ['claim', 'model', 'learning_submission', 'experimental_record', 'validation_payload', 'observation', 'verification_receipt', 'test_report', 'counterexample', 'publication'];
  var STATUS_V1 = ['DRAFT', 'IMPORTED', 'PARSED', 'INTEGRITY_VALID', 'VERIFIED', 'INCONCLUSIVE', 'NOT_PROVEN', 'REJECTED', 'BLOCKED', 'EXPIRED', 'SUPERSEDED', 'WITHDRAWN'];
  var STATUS_V2 = STATUS_V1.filter(function (s) { return s !== 'INCONCLUSIVE' && s !== 'NOT_PROVEN'; });
  var PROFILES = {
    '1.0.0': { types: TYPES_BASE.concat(['status_transition']), statuses: STATUS_V1, tierTag: 'forbidden', transitionAs: 'envelope' },
    '2.0.0': { types: TYPES_BASE, statuses: STATUS_V2, tierTag: 'required', transitionAs: 'record' }
  };
  function profileFor(version) { return PROFILES[version] || null; }

  /* ---------- content schemas (GLOSS governs where SF §3.1 text differs: D-INT-03) ---------- */
  var BENCH_OUTCOMES = ['PROVEN', 'INCONCLUSIVE', 'NOT_PROVEN', 'BLOCKED'];
  var FIRE_OUTCOMES = ['PASSED-UNDER-CONDITIONS', 'FAILED', 'INCONCLUSIVE', 'BLOCKED', 'SKIPPED-BY-ASSET-ABSENCE'];
  var SENSOR_STATES = ['NOMINAL', 'DEGRADED', 'FAULT', 'UNKNOWN'];
  var CAL_STATES = ['VALID', 'EXPIRED', 'UNKNOWN'];
  function isObj(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }
  function nes(x) { return typeof x === 'string' && x.length > 0; }
  function req(c, fields, e) { fields.forEach(function (f) { if (!(f in c) || c[f] === undefined) e.push('content.' + f + ' missing'); }); }
  function arr(c, f, e) { if (!Array.isArray(c[f])) e.push('content.' + f + ' must be an array'); }
  var CONTENT = {
    claim: function (c, e) { req(c, ['statement', 'scope', 'basis'], e); arr(c, 'assumptions', e); },
    model: function (c, e) { req(c, ['model_id', 'model_type', 'parameters_ref', 'code_ref'], e); arr(c, 'inputs', e); arr(c, 'outputs', e); },
    learning_submission: function (c, e) { req(c, ['module_id', 'exercise_id', 'response', 'submitted_at'], e); },
    experimental_record: function (c, e) { req(c, ['experiment_id', 'hypothesis', 'method', 'configuration', 'raw_results', 'observed_at'], e); },
    validation_payload: function (c, e) { req(c, ['harness_id', 'harness_version', 'seed', 'configuration', 'outcome', 'output_ref'], e); },
    observation: function (c, e) {
      req(c, ['value', 'unit', 'sensor_id', 'measured_at', 'received_at', 'sensor_state', 'calibration_state', 'location'], e);
      if (c.sensor_state !== undefined && SENSOR_STATES.indexOf(c.sensor_state) < 0) e.push('content.sensor_state must be one of ' + SENSOR_STATES.join('|'));
      if (c.calibration_state !== undefined && CAL_STATES.indexOf(c.calibration_state) < 0) e.push('content.calibration_state must be one of ' + CAL_STATES.join('|'));
    },
    verification_receipt: function (c, e) {
      req(c, ['claim_ref', 'policy', 'outcome', 'scope_statement'], e); arr(c, 'evidence_refs', e); arr(c, 'checks', e);
      if (c.outcome !== undefined && BENCH_OUTCOMES.indexOf(c.outcome) < 0) e.push('content.outcome must be one of ' + BENCH_OUTCOMES.join('|'));
      if (c.scope_statement !== undefined && !nes(c.scope_statement)) e.push('content.scope_statement must be non-empty');
      (Array.isArray(c.checks) ? c.checks : []).forEach(function (k, i) {
        ['check_id', 'description', 'result', 'evidence_ref'].forEach(function (f) { if (!(isObj(k) && f in k)) e.push('content.checks[' + i + '].' + f + ' missing'); });
      });
    },
    test_report: function (c, e) {
      req(c, ['target_ref', 'threat_model_ref', 'summary'], e); arr(c, 'cases', e); arr(c, 'counterexample_refs', e);
      (Array.isArray(c.cases) ? c.cases : []).forEach(function (k, i) {
        ['case_id', 'threat_ref', 'expected', 'actual', 'result'].forEach(function (f) { if (!(isObj(k) && f in k)) e.push('content.cases[' + i + '].' + f + ' missing'); });
        if (isObj(k) && FIRE_OUTCOMES.indexOf(k.result) < 0) e.push('content.cases[' + i + '].result must be one of ' + FIRE_OUTCOMES.join('|'));
      });
      if (isObj(c.summary) && FIRE_OUTCOMES.indexOf(c.summary.result) < 0) e.push('content.summary.result must be a Fire outcome');
    },
    counterexample: function (c, e) { req(c, ['target_ref', 'failure_ref', 'minimal_reproduction', 'conditions', 'expected', 'actual'], e); },
    publication: function (c, e) {
      req(c, ['title', 'body_ref', 'version'], e); arr(c, 'referenced_artefacts', e); arr(c, 'approvals', e); arr(c, 'corrections', e);
      (Array.isArray(c.approvals) ? c.approvals : []).forEach(function (a, i) {
        ['approver_id', 'approved_at', 'approved_version'].forEach(function (f) { if (!(isObj(a) && f in a)) e.push('content.approvals[' + i + '].' + f + ' missing'); });
      });
    },
    status_transition: function (c, e) { req(c, ['artefact_id', 'from_status', 'to_status', 'transitioned_at', 'actor', 'basis'], e); arr(c, 'limitations', e); }
  };

  /* ---------- schema validation (mirrors vvu-envelope.schema.json; encodes the conditionals the file cannot express) ---------- */
  var TOP = ['envelope_version', 'artefact_id', 'artefact_type', 'produced_by', 'produced_at', 'content', 'provenance', 'integrity', 'status', 'limitations'];
  function validate(env, opts) {
    var e = [], codeHint = 'REJECTED_SCHEMA_INVALID';
    opts = opts || {};
    if (!isObj(env)) return { ok: false, code: codeHint, errors: ['envelope must be an object'] };
    var prof = profileFor(opts.profileVersion || env.envelope_version);
    if (!prof) return { ok: false, code: 'REJECTED_VERSION_UNSUPPORTED', errors: ['no profile for envelope_version ' + env.envelope_version] };
    TOP.forEach(function (k) { if (!(k in env)) e.push('missing ' + k); });
    var allowed = TOP.concat(prof.tierTag === 'forbidden' ? [] : ['tier_tag']);
    Object.keys(env).forEach(function (k) { if (allowed.indexOf(k) < 0) e.push('top-level field not permitted: ' + k); });
    if (prof.tierTag === 'required' && TIERS.indexOf(env.tier_tag) < 0) e.push('tier_tag must be one of ' + TIERS.join('|'));
    if ('envelope_version' in env && !SEMVER_RE.test(env.envelope_version)) e.push('envelope_version not semver');
    if ('artefact_id' in env && !UUID_RE.test(String(env.artefact_id))) e.push('artefact_id is not an RFC 9562 v4 UUID');
    if ('artefact_type' in env && prof.types.indexOf(env.artefact_type) < 0) { e.push('artefact_type not in registry'); codeHint = 'REJECTED_TYPE_UNKNOWN'; }
    var pb = env.produced_by;
    if ('produced_by' in env) {
      if (!isObj(pb)) e.push('produced_by must be an object');
      else {
        ['environment', 'instance_id', 'operator_id', 'software_version'].forEach(function (k) { if (!(k in pb)) e.push('produced_by.' + k + ' missing'); });
        Object.keys(pb).forEach(function (k) { if (['environment', 'instance_id', 'operator_id', 'software_version'].indexOf(k) < 0) e.push('produced_by.' + k + ' not permitted'); });
        if ('environment' in pb && ENVS.indexOf(pb.environment) < 0) { e.push('produced_by.environment not one of five'); codeHint = 'REJECTED_TYPE_UNKNOWN'; }
        if ('instance_id' in pb && !(nes(pb.instance_id) && pb.instance_id.length <= 128)) e.push('produced_by.instance_id invalid');
        if ('operator_id' in pb && !(nes(pb.operator_id) && pb.operator_id.length <= 256)) e.push('produced_by.operator_id invalid (anonymous production forbidden)');
        if ('software_version' in pb && !SEMVER_RE.test(String(pb.software_version))) e.push('produced_by.software_version not semver');
      }
    }
    if ('produced_at' in env && !(typeof env.produced_at === 'string' && /Z$/.test(env.produced_at) && !isNaN(Date.parse(env.produced_at)))) e.push('produced_at must be RFC 3339 UTC');
    if ('content' in env && !isObj(env.content)) e.push('content must be an object');
    var pv = env.provenance;
    if ('provenance' in env) {
      if (!isObj(pv)) e.push('provenance must be an object');
      else {
        ['inputs', 'supersedes'].forEach(function (k) {
          if (!Array.isArray(pv[k])) e.push('provenance.' + k + ' must be an array');
          else pv[k].forEach(function (x) { if (!UUID_RE.test(String(x))) e.push('provenance.' + k + ' entry is not a UUID'); });
        });
        Object.keys(pv).forEach(function (k) { if (['inputs', 'supersedes', 'policy', 'configuration'].indexOf(k) < 0) e.push('provenance.' + k + ' not permitted'); });
        ['policy', 'configuration'].forEach(function (k) { if (k in pv && !nes(pv[k])) e.push('provenance.' + k + ' must be a non-empty string'); });
        if (env.artefact_type === 'verification_receipt' && !nes(pv.policy)) e.push('provenance.policy required for verification_receipt');
      }
    }
    var ig = env.integrity;
    if ('integrity' in env) {
      if (!isObj(ig)) e.push('integrity must be an object');
      else {
        if (!/^sha256:[0-9a-f]{64}$/.test(String(ig.digest))) e.push('integrity.digest malformed');
        if ('signature' in ig && !/^ed25519:[A-Za-z0-9_-]{86}$/.test(String(ig.signature))) e.push('integrity.signature malformed');
        if ('chain_ref' in ig && !nes(ig.chain_ref)) e.push('integrity.chain_ref must be non-empty');
        Object.keys(ig).forEach(function (k) { if (['digest', 'signature', 'chain_ref'].indexOf(k) < 0) e.push('integrity.' + k + ' not permitted'); });
      }
    }
    if ('status' in env && prof.statuses.indexOf(env.status) < 0) e.push('status not in vocabulary for ' + env.envelope_version);
    if ('limitations' in env) {
      if (!Array.isArray(env.limitations) || env.limitations.some(function (x) { return !nes(x); })) e.push('limitations must be an array of non-empty strings');
      else if (['INCONCLUSIVE', 'NOT_PROVEN', 'BLOCKED'].indexOf(env.status) >= 0 && env.limitations.length === 0) e.push('limitations must be non-empty for status ' + env.status);
    }
    if (isObj(env.content) && CONTENT[env.artefact_type]) CONTENT[env.artefact_type](env.content, e);
    return { ok: e.length === 0, code: e.length ? codeHint : null, errors: e };
  }

  /* ---------- digest / signature ---------- */
  function digestOf(env) {
    var c = {}; Object.keys(env).forEach(function (k) { if (k !== 'integrity') c[k] = env[k]; });
    return 'sha256:' + SHA256.hex(jcs(c));
  }
  function digestBytes(digestStr) { return hexToBytes(String(digestStr).slice(7)); }
  function signDigest(kp, digestStr) { return 'ed25519:' + b64uEncode(Ed25519.sign(kp, digestBytes(digestStr))); }
  function verifySignature(pub, env) {
    try { return Ed25519.verify(pub, digestBytes(env.integrity.digest), b64uDecode(env.integrity.signature.slice(8))); } catch (x) { return false; }
  }

  /* ---------- producer side ---------- */
  var EXPORT_CAP = { forge: 'DRAFT', field: 'DRAFT', fire: 'INTEGRITY_VALID', press: 'INTEGRITY_VALID', bench: 'VERIFIED' };
  var RANK = { DRAFT: 0, IMPORTED: 1, PARSED: 2, INTEGRITY_VALID: 3, VERIFIED: 4 };
  function nowIso() { return new Date().toISOString(); }
  function seal(spec, opts) {
    opts = opts || {};
    var version = opts.envelope_version || '1.0.0', prof = profileFor(version);
    if (!prof) throw new Error('unsupported envelope_version ' + version);
    var env = {
      envelope_version: version,
      artefact_id: spec.artefact_id || uuid4(),
      artefact_type: spec.artefact_type,
      produced_by: { environment: spec.produced_by.environment, instance_id: spec.produced_by.instance_id, operator_id: spec.produced_by.operator_id, software_version: spec.produced_by.software_version || '1.0.0' },
      produced_at: spec.produced_at || nowIso(),
      content: spec.content,
      provenance: { inputs: (spec.provenance && spec.provenance.inputs) || [], supersedes: (spec.provenance && spec.provenance.supersedes) || [] },
      integrity: { digest: '' },
      status: spec.status || 'DRAFT',
      limitations: spec.limitations || []
    };
    ['policy', 'configuration'].forEach(function (k) { if (spec.provenance && spec.provenance[k]) env.provenance[k] = spec.provenance[k]; });
    if (prof.tierTag !== 'forbidden') env.tier_tag = spec.tier_tag;
    if (spec.chain_ref) env.integrity.chain_ref = spec.chain_ref;
    /* a status_transition records the receiver's own checks (SF §5.5: PARSED unless the transition itself was checked), so the producer cap does not apply, but it can never claim more than PARSED */
    var cap = env.artefact_type === 'status_transition' ? 'PARSED' : EXPORT_CAP[env.produced_by.environment];
    if (RANK[env.status] !== undefined && RANK[env.status] > RANK[cap]) throw new Error(env.produced_by.environment + ' may not export status ' + env.status + ' (cap ' + cap + ')');
    if (env.status === 'VERIFIED' && !(env.artefact_type === 'verification_receipt' && env.content.outcome === 'PROVEN')) throw new Error('VERIFIED requires a verification_receipt with outcome PROVEN');
    env.integrity.digest = digestOf(env);
    if (opts.signer) env.integrity.signature = signDigest(opts.signer, env.integrity.digest);
    var v = validate(env);
    if (!v.ok) throw new Error('sealed envelope failed validation: ' + v.errors.join('; '));
    return env;
  }

  /* ---------- status machine ---------- */
  var TERMINAL = ['REJECTED', 'EXPIRED', 'SUPERSEDED', 'WITHDRAWN'];
  function allowedTransitions(profileVersion) {
    var prof = profileFor(profileVersion), has = function (s) { return prof.statuses.indexOf(s) >= 0; };
    var t = {
      DRAFT: ['IMPORTED'], IMPORTED: ['PARSED', 'REJECTED'], PARSED: ['INTEGRITY_VALID', 'REJECTED'],
      INTEGRITY_VALID: ['VERIFIED', 'INCONCLUSIVE', 'NOT_PROVEN', 'REJECTED', 'BLOCKED'],
      VERIFIED: ['EXPIRED', 'SUPERSEDED', 'WITHDRAWN'],
      INCONCLUSIVE: ['VERIFIED', 'NOT_PROVEN', 'EXPIRED', 'SUPERSEDED', 'WITHDRAWN'],
      NOT_PROVEN: ['VERIFIED', 'INCONCLUSIVE', 'EXPIRED', 'SUPERSEDED', 'WITHDRAWN'],
      BLOCKED: ['PARSED', 'INTEGRITY_VALID', 'VERIFIED', 'INCONCLUSIVE', 'NOT_PROVEN', 'EXPIRED', 'WITHDRAWN']
    };
    var out = {};
    Object.keys(t).forEach(function (k) { if (has(k)) out[k] = t[k].filter(has).slice(); });
    prof.statuses.forEach(function (s) {
      if (TERMINAL.indexOf(s) >= 0) { out[s] = []; return; }
      out[s] = out[s] || [];
      ['REJECTED', 'EXPIRED', 'SUPERSEDED', 'WITHDRAWN'].forEach(function (x) { if (out[s].indexOf(x) < 0) out[s].push(x); });
    });
    return out;
  }
  function canTransition(from, to, profileVersion) {
    var t = allowedTransitions(profileVersion || '1.0.0');
    if (!t[from]) return { ok: false, why: 'unknown status ' + from };
    if (TERMINAL.indexOf(from) >= 0) return { ok: false, why: from + ' is terminal' };
    if (t[from].indexOf(to) < 0) return { ok: false, why: from + ' -> ' + to + ' is not an allowed transition' };
    return { ok: true };
  }

  /* ---------- reason codes (SF §5.6) ---------- */
  var REASON = ['REJECTED_VERSION_UNSUPPORTED', 'REJECTED_SCHEMA_INVALID', 'REJECTED_TYPE_UNKNOWN', 'REJECTED_DIGEST_MISMATCH', 'REJECTED_SIGNATURE_INVALID', 'REJECTED_SIGNATURE_UNRESOLVED', 'REJECTED_POLICY_UNSUPPORTED', 'REJECTED_UNAUTHORIZED', 'REJECTED_DUPLICATE', 'REJECTED_SCOPE_EXCEEDED', 'INCONCLUSIVE_EVIDENCE_MISSING', 'INCONCLUSIVE_EVIDENCE_INSUFFICIENT', 'NOT_PROVEN_CONDITION_UNMET', 'NOT_PROVEN_CONTRADICTED', 'BLOCKED_DEPENDENCY_UNAVAILABLE', 'BLOCKED_INPUT_INCOMPLETE', 'EXPIRED_VALIDITY_PASSED', 'SUPERSEDED_BY_NEWER', 'WITHDRAWN_BY_PRODUCER'];
  var REASON_REQUIRED = ['REJECTED', 'INCONCLUSIVE', 'NOT_PROVEN', 'BLOCKED'];

  function buildTransition(spec, opts) {
    opts = opts || {};
    var version = opts.envelope_version || '1.0.0', prof = profileFor(version);
    var ct = canTransition(spec.from_status, spec.to_status, version);
    if (!ct.ok && !spec.receive_edge) throw new Error('transition refused: ' + ct.why);
    if (!UUID_RE.test(String(spec.artefact_id))) throw new Error('transition needs the artefact_id');
    if (!isObj(spec.actor) || ENVS.indexOf(spec.actor.environment) < 0 || !nes(spec.actor.instance_id) || !nes(spec.actor.operator_id)) throw new Error('transition needs a full actor');
    var needsReason = REASON_REQUIRED.indexOf(spec.to_status) >= 0 && prof.statuses.indexOf(spec.to_status) >= 0;
    if (needsReason) {
      if (REASON.indexOf(spec.reason_code) < 0 || spec.reason_code.indexOf(spec.to_status + '_') !== 0) throw new Error('reason_code required and must belong to ' + spec.to_status);
      if (!spec.limitations || !spec.limitations.length) throw new Error('limitations must be non-empty for ' + spec.to_status);
    }
    if (spec.to_status === 'SUPERSEDED') {
      var m = /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/.exec(String(spec.basis));
      if (spec.reason_code !== 'SUPERSEDED_BY_NEWER' || !m) throw new Error('SUPERSEDED needs SUPERSEDED_BY_NEWER and the superseding artefact_id in basis');
    }
    var rec = { artefact_id: spec.artefact_id, from_status: spec.from_status, to_status: spec.to_status, transitioned_at: spec.transitioned_at || nowIso(), actor: spec.actor, basis: String(spec.basis || ''), limitations: spec.limitations || [] };
    if (spec.reason_code) rec.reason_code = spec.reason_code;
    if (spec.receive_edge) rec.receive_edge = true;
    if (!nes(rec.basis)) throw new Error('basis is required');
    if (prof.transitionAs === 'record') {
      var out = { record_type: 'status_transition', record_version: '1.0.0', record: rec };
      out.digest = 'sha256:' + SHA256.hex(jcs({ record_type: out.record_type, record_version: out.record_version, record: rec }));
      return out;
    }
    return seal({ artefact_type: 'status_transition', produced_by: { environment: spec.actor.environment, instance_id: spec.actor.instance_id, operator_id: spec.actor.operator_id }, content: rec, provenance: { inputs: [spec.artefact_id], supersedes: [] }, status: 'PARSED', limitations: rec.limitations.length ? rec.limitations : [] }, { envelope_version: version, signer: opts.signer });
  }

  /* ---------- version negotiation (SF §6) ---------- */
  function cmp(a, b) { var x = a.split('.').map(Number), y = b.split('.').map(Number); for (var i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; }
  function negotiate(version, supported) {
    if (!SEMVER_RE.test(String(version))) return { accept: false, code: 'REJECTED_VERSION_UNSUPPORTED', detail: 'unparseable envelope_version' };
    if (supported.indexOf(version) >= 0) return { accept: true, profileVersion: version, note: null };
    var p = version.split('.').map(Number), best = null;
    supported.forEach(function (s) { var q = s.split('.').map(Number); if (q[0] === p[0] && cmp(s, version) < 0) best = best && cmp(best, s) >= 0 ? best : s; });
    if (best) return { accept: true, profileVersion: best, note: 'envelope_version ' + version + ' is newer than supported ' + best + ' within major ' + p[0] };
    return { accept: false, code: 'REJECTED_VERSION_UNSUPPORTED', detail: 'received ' + version + '; supported ' + supported.join(', ') };
  }

  /* ---------- receive pipeline (SF §4.5 order) ---------- */
  function deepFreeze(o) { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.keys(o).forEach(function (k) { deepFreeze(o[k]); }); } return o; }
  function lastStatus(trans) {
    if (!trans.length) return null;
    var x = trans[trans.length - 1];
    return x.content ? x.content.to_status : x.record.to_status;
  }
  function receive(input, ctx) {
    var steps = [], trans = [], limits = [], self = ctx.self;
    var supported = ctx.supportedVersions || ['1.0.0'];
    var res = { artefact_id: null, finalStatus: null, reason_code: null, steps: steps, transitions: trans, limitations: limits, duplicate: false, artefact: null, rejection: null };
    var env;
    function t(from, to, basis, reason, lims, edge) {
      if (!res.artefact_id) return;
      trans.push(buildTransition({ artefact_id: res.artefact_id, from_status: from, to_status: to, actor: self, basis: basis, reason_code: reason, limitations: lims || [], receive_edge: !!edge, transitioned_at: (ctx.now || nowIso)() }, { envelope_version: ctx.transitionVersion || '1.0.0', signer: ctx.signer }));
    }
    var exported = 'DRAFT';
    function reject(code, detail) {
      steps.push({ step: 'reject', pass: false, detail: detail });
      res.finalStatus = 'REJECTED'; res.reason_code = code; res.rejection = { reason_code: code, detail: detail };
      if (res.artefact_id) {
        var from = lastStatus(trans);
        if (!from) { t(exported, 'IMPORTED', 'received; contents not trusted', null, [], true); from = 'IMPORTED'; }
        if (from === 'IMPORTED' || from === 'PARSED') t(from, 'REJECTED', detail, code, ['rejected before INTEGRITY_VALID: ' + detail]);
      }
      return res;
    }
    try { env = typeof input === 'string' ? JSON.parse(input) : JSON.parse(JSON.stringify(input)); }
    catch (x) { return reject('REJECTED_SCHEMA_INVALID', 'not parseable JSON'); }
    if (!isObj(env)) return reject('REJECTED_SCHEMA_INVALID', 'envelope is not an object');
    res.artefact_id = UUID_RE.test(String(env.artefact_id)) ? env.artefact_id : null;
    exported = typeof env.status === 'string' ? env.status : 'DRAFT';
    if (typeof env.envelope_version !== 'string') return reject('REJECTED_SCHEMA_INVALID', 'missing envelope_version');
    var nv = negotiate(env.envelope_version, supported);
    steps.push({ step: 'version', pass: nv.accept, detail: nv.accept ? (nv.note || 'supported') : nv.detail });
    if (!nv.accept) return reject(nv.code, nv.detail);
    if (nv.note) limits.push(nv.note);
    var known = ctx.knownDigests && res.artefact_id ? ctx.knownDigests[res.artefact_id] : null;
    var v = validate(env, { profileVersion: nv.profileVersion });
    steps.push({ step: 'schema', pass: v.ok, detail: v.ok ? 'valid' : v.errors.join('; ') });
    if (!v.ok) return reject(v.code, v.errors.join('; '));
    t(exported, 'IMPORTED', 'received in package; exported status ' + exported + ' is the producer\'s assessment and is not relied on', null, [], true);
    t('IMPORTED', 'PARSED', 'envelope parsed and matched the schema for ' + nv.profileVersion);
    var d = digestOf(env), dok = d === env.integrity.digest;
    steps.push({ step: 'digest', pass: dok, detail: dok ? 'recomputed digest matches' : 'recomputed ' + d + ' != declared ' + env.integrity.digest });
    if (!dok) return reject('REJECTED_DIGEST_MISMATCH', 'recomputed digest differs from integrity.digest');
    if (known && known !== env.integrity.digest) return reject('REJECTED_DUPLICATE', 'artefact_id already received with different content');
    var sigNote = 'unsigned: no producer authentication';
    if (env.integrity.signature) {
      var key = ctx.resolveKey ? ctx.resolveKey(env.produced_by) : null;
      if (!key) { steps.push({ step: 'signature', pass: false, detail: 'key not resolvable' }); return reject('REJECTED_SIGNATURE_UNRESOLVED', 'signing key could not be resolved for ' + env.produced_by.operator_id); }
      var sok = verifySignature(key, env);
      steps.push({ step: 'signature', pass: sok, detail: sok ? 'Ed25519 verified over raw digest bytes' : 'Ed25519 verification failed' });
      if (!sok) return reject('REJECTED_SIGNATURE_INVALID', 'signature failed verification');
      sigNote = 'signature verified';
    } else steps.push({ step: 'signature', pass: true, detail: sigNote });
    env.provenance.inputs.forEach(function (id) { if (ctx.hasArtefact && !ctx.hasArtefact(id)) limits.push('provenance input not held by this receiver: ' + id); });
    lintTrust(env).forEach(function (f) { limits.push('lint: ' + f); });
    t('PARSED', 'INTEGRITY_VALID', 'digest recomputed over JCS(envelope without integrity); ' + sigNote, null, limits.slice());
    res.finalStatus = 'INTEGRITY_VALID'; res.artefact = deepFreeze(env);
    if (known && known === env.integrity.digest) res.duplicate = true;
    return res;
  }

  /* ---------- trust lint (GLOSS §4 mapping rule). Recorded in limitations; never upgrades. ---------- */
  function lintTrust(env) {
    var f = [], c = env.content || {}, who = (env.produced_by || {}).environment;
    if (EXPORT_CAP[who] && RANK[env.status] !== undefined && RANK[env.status] > RANK[EXPORT_CAP[who]]) f.push(who + ' exported status ' + env.status + ' above its cap ' + EXPORT_CAP[who]);
    if (env.status === 'VERIFIED' && !(env.artefact_type === 'verification_receipt' && c.outcome === 'PROVEN')) f.push('VERIFIED without a PROVEN verification_receipt');
    if (env.artefact_type === 'observation' && c.sensor_state === 'FAULT' && (env.limitations || []).length === 0) f.push('FAULT observation carries no limitation');
    if (env.artefact_type === 'verification_receipt' && Array.isArray(c.checks) && c.outcome === 'PROVEN' && c.checks.some(function (k) { return k.result !== 'PASS'; })) f.push('PROVEN receipt contains a non-PASS check');
    return f;
  }

  /* ---------- export package (SF §8) ---------- */
  function buildPackage(envelopes, exporter, opts) {
    var man = { artefact_count: envelopes.length, artefacts: envelopes.map(function (e) { return { artefact_id: e.artefact_id, artefact_type: e.artefact_type, digest: e.integrity.digest, status: e.status }; }) };
    return { package_version: '1.0', exported_at: ((opts && opts.now) || nowIso)(), exported_by: { environment: exporter.environment, instance_id: exporter.instance_id, operator_id: exporter.operator_id }, manifest: man, artefacts: envelopes, package_digest: 'sha256:' + SHA256.hex(jcs(man)) };
  }
  function verifyPackage(pkg) {
    var r = { ok: false, code: null, errors: [] };
    if (!isObj(pkg) || pkg.package_version !== '1.0' || !isObj(pkg.manifest) || !Array.isArray(pkg.artefacts) || !Array.isArray(pkg.manifest.artefacts)) { r.code = 'REJECTED_SCHEMA_INVALID'; r.errors.push('not a package_version 1.0 export package'); return r; }
    if (!isObj(pkg.exported_by) || ENVS.indexOf(pkg.exported_by.environment) < 0) { r.code = 'REJECTED_SCHEMA_INVALID'; r.errors.push('exported_by invalid'); return r; }
    if ('sha256:' + SHA256.hex(jcs(pkg.manifest)) !== pkg.package_digest) { r.code = 'REJECTED_DIGEST_MISMATCH'; r.errors.push('package_digest does not match manifest'); return r; }
    var mids = pkg.manifest.artefacts.map(function (m) { return m.artefact_id; }).sort().join(','), aids = pkg.artefacts.map(function (a) { return a && a.artefact_id; }).sort().join(',');
    if (mids !== aids || pkg.manifest.artefact_count !== pkg.artefacts.length) { r.code = 'REJECTED_SCHEMA_INVALID'; r.errors.push('manifest and artefacts[] id sets differ'); return r; }
    pkg.artefacts.forEach(function (a) {
      var m = pkg.manifest.artefacts.filter(function (x) { return x.artefact_id === a.artefact_id; })[0];
      if (!m || m.digest !== (a.integrity && a.integrity.digest) || m.status !== a.status || m.artefact_type !== a.artefact_type) r.errors.push('manifest entry disagrees with artefact ' + a.artefact_id);
    });
    if (r.errors.length) { r.code = 'REJECTED_DIGEST_MISMATCH'; return r; }
    r.ok = true; return r;
  }
  function receivePackage(pkg, ctx) {
    var pv = verifyPackage(pkg);
    if (!pv.ok) return { ok: false, package: pv, results: [] };
    var known = Object.assign({}, ctx.knownDigests || {});
    var results = pkg.artefacts.map(function (a) {
      var r = receive(a, Object.assign({}, ctx, { knownDigests: known }));
      if (r.finalStatus === 'INTEGRITY_VALID' && r.artefact_id) known[r.artefact_id] = r.artefact.integrity.digest;
      return r;
    });
    return { ok: true, package: pv, results: results };
  }

  /* ---------- failure declaration (SF §10) ---------- */
  function checkFailureDeclaration(d) {
    var e = [];
    function g(o, p) { return p.split('.').reduce(function (a, k) { return a == null ? undefined : a[k]; }, o); }
    if (!d || ENVS.indexOf(d.environment) < 0) e.push('environment invalid');
    [['offline_capability.primary_function_offline', true], ['dependency_unavailability.distinguishes_unavailable_from_negative', true], ['recovery.unfinished_work_preserved', true], ['recovery.interrupted_operations_recorded', true], ['portability.export_path_exists', true], ['portability.export_requires_other_environment', false]]
      .forEach(function (x) { if (g(d, x[0]) !== x[1]) e.push(x[0] + ' MUST be ' + x[1]); });
    if (g(d, 'dependency_unavailability.unavailable_status') !== 'BLOCKED') e.push('dependency_unavailability.unavailable_status MUST be BLOCKED');
    if (!/§8|export package/i.test(String(g(d, 'portability.export_format')))) e.push('portability.export_format MUST reference §8');
    ['offline_capability.local_persistence', 'dependency_unavailability.behaviour', 'recovery.resume_safety'].forEach(function (p) { if (!nes(g(d, p))) e.push(p + ' required'); });
    if (!Array.isArray(g(d, 'offline_capability.degraded_functions'))) e.push('offline_capability.degraded_functions must be an array');
    return { ok: e.length === 0, errors: e };
  }

  return {
    version: '1.0.0', ENVS: ENVS, TIERS: TIERS, PROFILES: PROFILES, REASON: REASON, FIRE_OUTCOMES: FIRE_OUTCOMES, BENCH_OUTCOMES: BENCH_OUTCOMES, SENSOR_STATES: SENSOR_STATES,
    sha256Hex: SHA256.hex, sha256: SHA256.digest, Ed25519: Ed25519, jcs: jcs, uuid4: uuid4, bytesToHex: bytesToHex, hexToBytes: hexToBytes, b64uEncode: b64uEncode, b64uDecode: b64uDecode,
    validate: validate, digestOf: digestOf, digestBytes: digestBytes, signDigest: signDigest, verifySignature: verifySignature, seal: seal,
    allowedTransitions: allowedTransitions, canTransition: canTransition, buildTransition: buildTransition, negotiate: negotiate,
    receive: receive, receivePackage: receivePackage, lintTrust: lintTrust, buildPackage: buildPackage, verifyPackage: verifyPackage, checkFailureDeclaration: checkFailureDeclaration, deepFreeze: deepFreeze
  };
});
