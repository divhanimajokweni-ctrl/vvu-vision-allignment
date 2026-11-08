// src/server/proximity/sync.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE OFF-BOX SYNC — R69: evidence that LEAVES the box.
//
// The vault (R68) accumulates self-verifying bundles on disk; this module is
// the job that pushes them OFF the box. The honest architecture:
//
//   · TARGET=none (default)   → the job refuses with UNCONFIGURED. Nothing is
//     faked, nothing is pretended. The UI shows the env contract to set.
//   · TARGET=file + VVU_SYNC_DIR → a STAGING MIRROR: every byte goes through
//     the real sync machinery (manifest → copy → re-read → sha256 verify →
//     journal), but the geography is the SAME BOX. Real rehearsal, honestly
//     labeled — it proves the pipeline, not the off-box property.
//   · TARGET=s3 + endpoint/bucket/keys → the REAL off-box push: SigV4 PUT of
//     every vault object + the manifest. This path ships ready but is
//     UNTESTED until a real endpoint exists — it will say so on its first
//     run, whatever the result.
//
// Every run appends one row to vvu-trust/bundles/sync-journal.jsonl. The
// manifest itself is a vvu.sync-manifest.v1 object: every file + its sha256,
// so a receiver can verify what it got, byte for byte.
// ─────────────────────────────────────────────────────────────────────────────

import 'server-only';

import { createHash } from 'node:crypto';
import { createHmac } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

const VAULT_DIR = join(process.cwd(), 'vvu-trust', 'bundles');
const JOURNAL_PATH = join(VAULT_DIR, 'sync-journal.jsonl');
const TARGET_CONFIG_PATH = join(VAULT_DIR, 'sync-target.json');
const FILE_RE = /^vvu-anchor-bundle-\d{8}T\d{6}(?:-\d+)?\.json$/;

export type SyncTargetKind = 'none' | 'file' | 's3';

export type SyncTrigger = 'manual' | 'auto';

export interface SyncConfig {
  target: SyncTargetKind;
  configured: boolean;
  /** R74 — mirror after every vault snapshot (config `autoSync: true` or VVU_SYNC_AUTO=1) */
  autoSync: boolean;
  /** staging dir (file target) or "endpoint/bucket/prefix" (s3, secret-masked) */
  detail: string | null;
  envContract: string[];
}

export interface SyncRow {
  at: string;
  target: SyncTargetKind;
  state: 'SYNCED' | 'STAGED' | 'UNCONFIGURED' | 'FAILED' | 'PARTIAL';
  pushed: number;
  verified: number;
  skipped: number;
  failed: number;
  manifestHash: string | null;
  detail: string | null;
  /** R74 — who asked for this run (older rows predate the field and omit it) */
  trigger?: SyncTrigger;
}

export function syncConfig(): SyncConfig {
  // Config precedence: vvu-trust/bundles/sync-target.json (operator-editable
  // WITHOUT a restart — the daemonized dev server cannot take new env) →
  // VVU_SYNC_* env → none. The config file is the primary path on this box.
  // R74: `autoSync: true` (file target only — an s3 auto-push would need a
  // cost/consent decision, so the flag is deliberately ignored for s3) makes
  // the vault mirror itself after every snapshot, no human click required.
  const autoFromEnv = process.env.VVU_SYNC_AUTO === '1';
  try {
    if (existsSync(TARGET_CONFIG_PATH)) {
      const c = JSON.parse(readFileSync(TARGET_CONFIG_PATH, 'utf8')) as {
        target?: string;
        dir?: string;
        autoSync?: boolean;
        endpoint?: string;
        bucket?: string;
        prefix?: string;
        accessKeyId?: string;
        secretAccessKey?: string;
        region?: string;
      };
      if (c.target === 'file') {
        const dir = (c.dir ?? '').trim();
        if (!dir) {
          return {
            target: 'file',
            configured: false,
            autoSync: false,
            detail: null,
            envContract: ['sync-target.json: {"target":"file","dir":"/absolute/path"} — dir is required'],
          };
        }
        return { target: 'file', configured: true, autoSync: c.autoSync === true || autoFromEnv, detail: dir, envContract: [] };
      }
      if (c.target === 's3') {
        const missing: string[] = [];
        if (!c.endpoint) missing.push('endpoint');
        if (!c.bucket) missing.push('bucket');
        if (!c.accessKeyId) missing.push('accessKeyId');
        if (!c.secretAccessKey) missing.push('secretAccessKey');
        if (missing.length > 0) {
          return {
            target: 's3',
            configured: false,
            autoSync: false,
            detail: null,
            envContract: [`sync-target.json is missing: ${missing.join(', ')}`],
          };
        }
        const prefix = (c.prefix ?? 'vvu-anchors').replace(/^\/+|\/+$/g, '');
        return {
          target: 's3',
          configured: true,
          autoSync: false, // deliberate: no unattended real-endpoint pushes without an explicit operator decision
          detail: `${c.endpoint}/${c.bucket}/${prefix} (access key ${String(c.accessKeyId).slice(0, 4)}…, secret hidden)`,
          envContract: [],
        };
      }
    }
  } catch {
    /* an unreadable config file falls through to env — never crash the read */
  }

  const target = (process.env.VVU_SYNC_TARGET ?? '').trim().toLowerCase() as SyncTargetKind;
  if (target === 'file') {
    const dir = (process.env.VVU_SYNC_DIR ?? '').trim();
    if (!dir) {
      return {
        target: 'file',
        configured: false,
        autoSync: false,
        detail: null,
        envContract: ['VVU_SYNC_TARGET=file', 'VVU_SYNC_DIR=/absolute/path/for/the/staging/mirror'],
      };
    }
    return { target: 'file', configured: true, autoSync: autoFromEnv, detail: dir, envContract: [] };
  }
  if (target === 's3') {
    const missing: string[] = [];
    if (!process.env.VVU_SYNC_ENDPOINT) missing.push('VVU_SYNC_ENDPOINT');
    if (!process.env.VVU_SYNC_BUCKET) missing.push('VVU_SYNC_BUCKET');
    if (!process.env.VVU_SYNC_ACCESS_KEY_ID) missing.push('VVU_SYNC_ACCESS_KEY_ID');
    if (!process.env.VVU_SYNC_SECRET_ACCESS_KEY) missing.push('VVU_SYNC_SECRET_ACCESS_KEY');
    if (missing.length > 0) {
      return { target: 's3', configured: false, autoSync: false, detail: null, envContract: missing };
    }
    const prefix = (process.env.VVU_SYNC_PREFIX ?? 'vvu-anchors').replace(/^\/+|\/+$/g, '');
    return {
      target: 's3',
      configured: true,
      autoSync: false, // deliberate: no unattended real-endpoint pushes without an explicit operator decision
      detail: `${process.env.VVU_SYNC_ENDPOINT}/${process.env.VVU_SYNC_BUCKET}/${prefix} (access key ${String(process.env.VVU_SYNC_ACCESS_KEY_ID).slice(0, 4)}…, secret hidden)`,
      envContract: [],
    };
  }
  return {
    target: 'none',
    configured: false,
    autoSync: false,
    detail: null,
    envContract: [
      'staging mirror: VVU_SYNC_TARGET=file + VVU_SYNC_DIR=/abs/path (same box — rehearsal)',
      'real off-box:    VVU_SYNC_TARGET=s3 + VVU_SYNC_ENDPOINT + VVU_SYNC_BUCKET + VVU_SYNC_ACCESS_KEY_ID + VVU_SYNC_SECRET_ACCESS_KEY [+ VVU_SYNC_PREFIX]',
    ],
  };
}

function sha256File(path: string): { hash: string; bytes: number } {
  const buf = readFileSync(path);
  return { hash: createHash('sha256').update(buf).digest('hex'), bytes: buf.length };
}

/** Every vault bundle file right now — the truth on disk, not the index. */
function vaultInventory(): Array<{ fileName: string; sha256: string; bytes: number }> {
  if (!existsSync(VAULT_DIR)) return [];
  return readdirSync(VAULT_DIR)
    .filter((f) => FILE_RE.test(f))
    .sort()
    .map((fileName) => {
      const { hash, bytes } = sha256File(join(VAULT_DIR, fileName));
      return { fileName, sha256: hash, bytes };
    });
}

function readJournal(): SyncRow[] {
  if (!existsSync(JOURNAL_PATH)) return [];
  const rows: SyncRow[] = [];
  for (const line of readFileSync(JOURNAL_PATH, 'utf8').split('\n').filter(Boolean)) {
    try {
      rows.push(JSON.parse(line) as SyncRow);
    } catch {
      /* skip unparsable history */
    }
  }
  return rows.reverse(); // newest first
}

/** R70 — chronicle reader: the sync journal with its corrupt lines COUNTED,
 *  never silently dropped (readJournal's silent skip is fine for status
 *  summaries; a unified evidence timeline must account for every line). */
export function readSyncJournal(cap = 200): {
  rows: SyncRow[]; // newest first
  total: number;
  corrupt: number;
  present: boolean;
} {
  if (!existsSync(JOURNAL_PATH)) return { rows: [], total: 0, corrupt: 0, present: false };
  const rows: SyncRow[] = [];
  let corrupt = 0;
  for (const line of readFileSync(JOURNAL_PATH, 'utf8').split('\n').filter(Boolean)) {
    try {
      rows.push(JSON.parse(line) as SyncRow);
    } catch {
      corrupt += 1;
    }
  }
  const total = rows.length;
  return { rows: rows.slice(-cap).reverse(), total, corrupt, present: true };
}

export function syncStatus() {
  const cfg = syncConfig();
  const history = readJournal();
  return {
    config: cfg,
    last: history[0] ?? null,
    history: history.slice(0, 5),
    journalRows: history.length,
  };
}

function journal(row: SyncRow) {
  mkdirSync(VAULT_DIR, { recursive: true });
  appendFileSync(JOURNAL_PATH, JSON.stringify(row) + '\n', 'utf8');
}

// ── the one public action ────────────────────────────────────────────────────

let syncInFlight = false;

export async function runSync(
  trigger: SyncTrigger = 'manual',
): Promise<{ ok: boolean; row: SyncRow; config?: SyncConfig }> {
  const cfg = syncConfig();
  if (syncInFlight) {
    const row: SyncRow = {
      at: new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC',
      target: cfg.target,
      state: 'FAILED',
      pushed: 0,
      verified: 0,
      skipped: 0,
      failed: 0,
      manifestHash: null,
      detail: 'a sync is already in flight — one at a time',
      trigger,
    };
    return { ok: false, row };
  }
  syncInFlight = true;
  try {
    if (cfg.target === 'none' || !cfg.configured) {
      const row: SyncRow = {
        at: new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC',
        target: cfg.target,
        state: 'UNCONFIGURED',
        pushed: 0,
        verified: 0,
        skipped: 0,
        failed: 0,
        manifestHash: null,
        detail: `no sync target configured — set ${cfg.envContract[0] ?? 'VVU_SYNC_* env'}`,
        trigger,
      };
      journal(row);
      return { ok: false, row, config: cfg };
    }

    const inventory = vaultInventory();
    if (inventory.length === 0) {
      const row: SyncRow = {
        at: new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC',
        target: cfg.target,
        state: 'FAILED',
        pushed: 0,
        verified: 0,
        skipped: 0,
        failed: 0,
        manifestHash: null,
        detail: 'the vault is empty — file a snapshot before syncing',
        trigger,
      };
      journal(row);
      return { ok: false, row, config: cfg };
    }

    const result =
      cfg.target === 'file'
        ? await syncToFileMirror(cfg, inventory)
        : await syncToS3(cfg, inventory);

    result.row.trigger = trigger;
    journal(result.row);
    return { ok: result.row.state === 'SYNCED' || result.row.state === 'STAGED', row: result.row, config: cfg };
  } catch (e) {
    const row: SyncRow = {
      at: new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC',
      target: cfg.target,
      state: 'FAILED',
      pushed: 0,
      verified: 0,
      skipped: 0,
      failed: 0,
      manifestHash: null,
      detail: e instanceof Error ? e.message : 'sync crashed',
      trigger,
    };
    journal(row);
    return { ok: false, row, config: cfg };
  } finally {
    syncInFlight = false;
  }
}

async function syncToFileMirror(
  cfg: SyncConfig,
  inventory: Array<{ fileName: string; sha256: string; bytes: number }>,
): Promise<{ row: SyncRow }> {
  const dir = cfg.detail!;
  mkdirSync(dir, { recursive: true });

  let pushed = 0;
  let verified = 0;
  let skipped = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const f of inventory) {
    const dest = join(dir, f.fileName);
    try {
      if (existsSync(dest)) {
        const existing = sha256File(dest);
        if (existing.hash === f.sha256) {
          skipped++;
          verified++;
          continue;
        }
        // Same name, different bytes — the on-box file changed. The vault
        // never rewrites a filed bundle, so this means tampering or a
        // name collision across boxes; fail loudly, never overwrite.
        failed++;
        failures.push(`${f.fileName}: mirror diverges (sha mismatch) — left untouched`);
        continue;
      }
      // complete-or-nothing copy: temp file + rename, then verify by re-read
      const tmp = join(dir, `${fileNameTmp(f.fileName)}`);
      writeFileSync(tmp, readFileSync(join(VAULT_DIR, f.fileName)));
      renameSync(tmp, dest);
      const back = sha256File(dest);
      if (back.hash === f.sha256) {
        pushed++;
        verified++;
      } else {
        failed++;
        failures.push(`${f.fileName}: re-read hash mismatch after copy`);
      }
    } catch (e) {
      failed++;
      failures.push(`${f.fileName}: ${e instanceof Error ? e.message : 'copy failed'}`);
    }
  }

  // The manifest travels WITH the files — a receiver verifies from it.
  const manifest = {
    format: 'vvu.sync-manifest.v1',
    at: new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC',
    target: 'file',
    detail: dir,
    files: inventory,
  };
  const manifestText = JSON.stringify(manifest, null, 2);
  const manifestHash = createHash('sha256').update(manifestText).digest('hex');
  const manifestTmp = join(dir, `sync-manifest.tmp`);
  writeFileSync(manifestTmp, manifestText);
  renameSync(manifestTmp, join(dir, 'sync-manifest.json'));

  const state: SyncRow['state'] = failed === 0 ? 'STAGED' : pushed + skipped > 0 ? 'PARTIAL' : 'FAILED';
  return {
    row: {
      at: manifest.at,
      target: 'file',
      state,
      pushed,
      verified,
      skipped,
      failed,
      manifestHash,
      detail:
        failed > 0
          ? failures.slice(0, 3).join(' · ')
          : `staging mirror updated (${dir}) — REHEARSAL ONLY: same box, real machinery. Off-box needs VVU_SYNC_TARGET=s3.`,
    },
  };
}

function fileNameTmp(name: string): string {
  return `.${name}.tmp`;
}

// ── R79 · the RAW s3 target — the credentials the audit rides on ────────────
// syncConfig() masks the secrets for display; the audit needs them intact.
// ONE reader, ONE precedence (config file → env), used by the push AND the
// audit, so the verification always re-reads the same geography the push
// wrote to.

export interface S3TargetRaw {
  endpoint: string;
  bucket: string;
  prefix: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

function readS3Target(): S3TargetRaw | null {
  try {
    if (existsSync(TARGET_CONFIG_PATH)) {
      const c = JSON.parse(readFileSync(TARGET_CONFIG_PATH, 'utf8')) as {
        target?: string;
        endpoint?: string;
        bucket?: string;
        prefix?: string;
        accessKeyId?: string;
        secretAccessKey?: string;
        region?: string;
      };
      if (
        c.target === 's3' &&
        c.endpoint &&
        c.bucket &&
        c.accessKeyId &&
        c.secretAccessKey
      ) {
        return {
          endpoint: c.endpoint.replace(/\/+$/, ''),
          bucket: c.bucket,
          prefix: (c.prefix ?? 'vvu-anchors').replace(/^\/+|\/+$/g, ''),
          accessKeyId: c.accessKeyId,
          secretAccessKey: c.secretAccessKey,
          region: c.region ?? 'us-east-1',
        };
      }
      if (c.target === 's3') return null; // incomplete config — syncConfig reports the exact gap
    }
  } catch {
    /* unreadable config file falls through to env — never crash the read */
  }
  if (
    (process.env.VVU_SYNC_TARGET ?? '').trim().toLowerCase() === 's3' &&
    process.env.VVU_SYNC_ENDPOINT &&
    process.env.VVU_SYNC_BUCKET &&
    process.env.VVU_SYNC_ACCESS_KEY_ID &&
    process.env.VVU_SYNC_SECRET_ACCESS_KEY
  ) {
    return {
      endpoint: process.env.VVU_SYNC_ENDPOINT.replace(/\/+$/, ''),
      bucket: process.env.VVU_SYNC_BUCKET,
      prefix: (process.env.VVU_SYNC_PREFIX ?? 'vvu-anchors').replace(/^\/+|\/+$/g, ''),
      accessKeyId: process.env.VVU_SYNC_ACCESS_KEY_ID,
      secretAccessKey: process.env.VVU_SYNC_SECRET_ACCESS_KEY,
      region: process.env.VVU_SYNC_REGION ?? 'us-east-1',
    };
  }
  return null;
}

// ── the ONE SigV4 signer — PUT, HEAD and GET all ride the same code ─────────
// R79: s3Put used to hand-roll its signing; the audit needs HEAD and GET
// signed by EXACTLY the same rules (the conformance drill proves all three
// verbs against one signature-validating endpoint, so one signer it is).

const EMPTY_PAYLOAD_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const S3_TIMEOUT_MS = 5000;

async function s3Request(
  method: 'PUT' | 'HEAD' | 'GET',
  target: S3TargetRaw,
  key: string,
  body?: Buffer,
  /** R82 — query parameters to SIGN (the LIST verb). SigV4 canonicalizes them sorted, URI-encoded. */
  query?: Record<string, string>,
): Promise<Response> {
  const { endpoint, bucket, region, accessKeyId, secretAccessKey } = target;
  // R86 — path-style keys are URI-ENCODED per segment before they touch a
  // URL: `new URL()` normalizes the wire path implicitly and inconsistently
  // (`?` would open the query, `#` would open the fragment, and everything
  // else rides on the URL parser's mood). Encoding each segment up front
  // makes the wire path, url.pathname (what the signature canonicalizes)
  // and the endpoint's decode agree for ANY key — the estate's keys are
  // [a-z0-9./-] today, but the conformance drill now plants hostile keys
  // (&, spaces, quotes, unicode) and the extra re-read must fetch exactly
  // what the LIST decoded. `/` survives as the segment separator by design.
  const encodedKey = key
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  const url = new URL(`${endpoint}/${bucket}/${encodedKey}`);
  const amzDate = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = body ? createHash('sha256').update(body).digest('hex') : EMPTY_PAYLOAD_SHA256;
  const host = url.host;

  const canonicalHeaders =
    `host:${host}\n` + `x-amz-content-sha256:${payloadHash}\n` + `x-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  // R82 — canonical query string: sorted by key, both sides URI-encoded. PUT/
  // HEAD/plain GET sign no parameters (empty string, as before); the LIST verb
  // signs list-type + prefix so the endpoint can verify the exact query.
  const canonicalQuery = query
    ? Object.keys(query)
        .sort()
        .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`)
        .join('&')
    : '';
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v);
  const canonicalRequest = [
    method,
    url.pathname,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');

  const kDate = createHmac('sha256', `AWS4${secretAccessKey}`).update(dateStamp).digest();
  const kRegion = createHmac('sha256', kDate).update(region).digest();
  const kService = createHmac('sha256', kRegion).update('s3').digest();
  const kSigning = createHmac('sha256', kService).update('aws4_request').digest();
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return fetch(url, {
    method,
    ...(body ? { body: new Uint8Array(body) } : {}),
    headers: {
      Authorization: authorization,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      ...(body ? { 'content-length': String(body.length) } : {}),
    },
    signal: AbortSignal.timeout(S3_TIMEOUT_MS),
  });
}

// ── R82 · the signed LIST — ListObjectsV2, same signer, mirror-side inventory ─
// GET /{bucket}?list-type=2&prefix={prefix}/ signed like every other verb.
// The response is XML; the parse below is deliberately minimal (Contents →
// Key/Size/ETag) and honest about what it cannot do: a paginated (truncated)
// LIST is surfaced as truncated, never silently flattened, and a parse failure
// reports as a failed LIST — the audit's EXTRA sweep then says INCOMPLETE.

interface S3ListedObject {
  key: string;
  size: number;
  etag: string | null;
}

interface S3ListResult {
  ok: boolean;
  status?: number;
  keys: S3ListedObject[];
  /** true ONLY when the sweep is INCOMPLETE — the page cap was hit, a page
   *  stalled without a continuation token, or a mid-loop request failed. A
   *  COMPLETED pagination is not truncation (R83). */
  truncated: boolean;
  /** R83 — LIST requests issued (1 = single-page, ≥2 = the continuation loop ran). */
  pages: number;
  /** R83 — the MAX_LIST_PAGES guard fired; `keys` holds what the cap let through. */
  pageCapReached: boolean;
  error?: string;
}

/** R83 — hard cap on LIST pages. At the estate's scale (single-digit objects)
 *  this never fires; it exists so a hostile/misconfigured endpoint cannot keep
 *  the audit looping forever. 20 pages × 1000 keys = 20k objects of honesty. */
const MAX_LIST_PAGES = 20;

/** R86 — XML entity decoding for LIST `<Key>` values. Real endpoints
 *  (AWS/MinIO) XML-escape object keys: `&` → `&amp;`, `<` → `&lt;`, and the
 *  quote family per the XML spec. R82's parser kept the entities in the name
 *  (honest for the estate's [a-z0-9./-] keys, which never carry any), but the
 *  comparison against vault names would then invent a FALSE EXTRA for any
 *  real-endpoint key that needed escaping — the extra sweep's set relation
 *  must compare the DECODED names both sides actually mean. The five named
 *  entities plus numeric/hex character references; an unknown entity stays
 *  verbatim (the row stays visible — never a silent invention). */
function decodeXmlKey(raw: string): string {
  return raw
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

async function s3ListObjects(target: S3TargetRaw): Promise<S3ListResult> {
  const keys: S3ListedObject[] = [];
  let pages = 0;
  let continuationToken: string | null = null;
  do {
    const query: Record<string, string> = {
      'list-type': '2',
      prefix: `${target.prefix}/`,
    };
    if (continuationToken) query['continuation-token'] = continuationToken;
    let res: Response;
    try {
      res = await s3Request('GET', target, '', undefined, query);
    } catch (e) {
      return {
        ok: false,
        keys,
        truncated: pages > 0, // partial pages collected — the sweep is INCOMPLETE
        pages,
        pageCapReached: false,
        error: e instanceof Error ? e.message : 'network error',
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        keys,
        truncated: pages > 0,
        pages,
        pageCapReached: false,
      };
    }
    const xml = await res.text().catch(() => '');
    const pageTruncated = /<IsTruncated>\s*true\s*<\/IsTruncated>/i.test(xml);
    // R86 — `<Key>` values are XML-DECODED (see decodeXmlKey): the EXTRA
    // sweep compares decoded names against the vault's names, so a real
    // endpoint's escaped key reads as the object it is. `&quot;` in an ETag
    // was already handled by the etag line below.
    let pageKeys = 0;
    for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const block = m[1];
      const keyRaw = /<Key>([\s\S]*?)<\/Key>/.exec(block)?.[1];
      if (!keyRaw) continue;
      const key = decodeXmlKey(keyRaw);
      const size = Number(/<Size>(\d+)<\/Size>/.exec(block)?.[1] ?? '0');
      const etag = /<ETag>([\s\S]*?)<\/ETag>/.exec(block)?.[1]?.replace(/&quot;/g, '"').replace(/"/g, '') ?? null;
      keys.push({ key, size, etag });
      pageKeys++;
    }
    // R86 — the KeyCount cross-check: a real ListObjectsV2 response states
    // how many keys THIS page carries. If the endpoint said N and the
    // Contents parse found M ≠ N, the parser MISSED something (a shape it
    // does not know, a truncated body) — the honest answer is a failed page,
    // which surfaces as INCOMPLETE, never as a wrong PASS.
    const keyCountRaw = /<KeyCount>\s*(\d+)\s*<\/KeyCount>/.exec(xml)?.[1];
    if (keyCountRaw != null && Number(keyCountRaw) !== pageKeys) {
      return {
        ok: false,
        status: res.status,
        keys,
        truncated: pages > 0,
        pages,
        pageCapReached: false,
        error: `LIST parse mismatch — the page declares KeyCount ${keyCountRaw} but ${pageKeys} Contents block(s) parsed`,
      };
    }
    if (pageKeys === 0 && !/<ListBucketResult/i.test(xml)) {
      return {
        ok: false,
        status: res.status,
        keys,
        truncated: pages > 0,
        pages,
        pageCapReached: false,
        error: 'unrecognised LIST response',
      };
    }
    pages++;
    if (pageTruncated) {
      const next = /<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(xml)?.[1] ?? null;
      if (!next || next === continuationToken) {
        // The endpoint says truncated but offers no way forward — an honest
        // stop: what was read stands, the sweep is INCOMPLETE, never a wrong PASS.
        return { ok: true, status: res.status, keys, truncated: true, pages, pageCapReached: false };
      }
      continuationToken = next;
    } else {
      continuationToken = null;
    }
  } while (continuationToken && pages < MAX_LIST_PAGES);
  const pageCapReached = continuationToken != null && pages >= MAX_LIST_PAGES;
  return { ok: true, status: 200, keys, truncated: pageCapReached, pages, pageCapReached };
}

// ── s3 target — SigV4 PUT, path-style (MinIO/AWS compatible) ────────────────

async function syncToS3(
  cfg: SyncConfig,
  inventory: Array<{ fileName: string; sha256: string; bytes: number }>,
): Promise<{ row: SyncRow }> {
  // R79 — the raw target now comes from readS3Target() (config file → env,
  // the SAME precedence syncConfig documents) instead of reading env alone:
  // the conformance drill configures s3 via sync-target.json, and the audit
  // needs the same credentials the push used. An unreadable target fails
  // honestly — it does not fall back to a different geography.
  const raw = readS3Target();
  if (!raw) {
    return {
      row: {
        at: new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC',
        target: 's3',
        state: 'FAILED',
        pushed: 0,
        verified: 0,
        skipped: 0,
        failed: 0,
        manifestHash: null,
        detail: 's3 target selected but the raw credentials are unreadable (config file nor env yield a complete target)',
        trigger: 'manual',
      },
    };
  }
  const { endpoint, bucket, prefix, accessKeyId: accessKey, secretAccessKey: secretKey, region } = raw;

  let pushed = 0;
  let verified = 0;
  let failed = 0;
  const failures: string[] = [];

  const objects: Array<{ key: string; body: Buffer }> = inventory.map((f) => ({
    key: `${prefix}/${f.fileName}`,
    body: readFileSync(join(VAULT_DIR, f.fileName)),
  }));
  const manifestBody = Buffer.from(
    JSON.stringify(
      {
        format: 'vvu.sync-manifest.v1',
        at: new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC',
        target: 's3',
        detail: `${endpoint}/${bucket}/${prefix}`,
        files: inventory,
      },
      null,
      2,
    ),
  );
  objects.push({ key: `${prefix}/sync-manifest.json`, body: manifestBody });

  for (const o of objects) {
    try {
      await s3Put(endpoint, bucket, o.key, o.body, region, accessKey, secretKey);
      pushed++;
      verified++;
    } catch (e) {
      failed++;
      failures.push(`${o.key}: ${e instanceof Error ? e.message : 'PUT failed'}`);
    }
  }

  const state: SyncRow['state'] = failed === 0 ? 'SYNCED' : pushed > 0 ? 'PARTIAL' : 'FAILED';
  return {
    row: {
      at: new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC',
      target: 's3',
      state,
      pushed,
      verified,
      skipped: 0,
      failed,
      manifestHash: createHash('sha256').update(manifestBody).digest('hex'),
      detail: failed === 0 ? `pushed to ${endpoint}/${bucket}/${prefix}` : failures.slice(0, 3).join(' · '),
    },
  };
}

/** Minimal AWS SigV4 PUT for a single object, path-style.
 *  R79 — the signing itself moved into s3Request() (shared with the audit's
 *  HEAD/GET); this wrapper keeps the call sites and error wording intact. */
async function s3Put(
  endpoint: string,
  bucket: string,
  key: string,
  body: Buffer,
  region: string,
  accessKey: string,
  secretKey: string,
): Promise<void> {
  const res = await s3Request(
    'PUT',
    { endpoint, bucket, prefix: '', accessKeyId: accessKey, secretAccessKey: secretKey, region },
    key,
    body,
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`S3 PUT ${res.status}: ${text.slice(0, 140)}`);
  }
}

// ── R74 · THE MIRROR AUDIT — trust, but verify from the other side ─────────
// ─────────────────────────────────────────────────────────────────────────────
// The push (syncToFileMirror) verifies what IT copies; nothing has ever
// independently re-read the mirror AFTER the fact. The audit is that second
// pair of eyes: re-hash every bundle in the mirror from disk, cross-check
// vault ↔ mirror ↔ manifest three ways, and report per-file verdicts.
//
//   OK                 — mirror bytes == vault bytes == what the manifest claims
//   DIVERGED           — same name, different bytes than the vault: tampering,
//                        corruption, or a name collision. Never overwritten by
//                        a sync either — this is the row that makes it visible.
//   MISSING            — vault holds it, mirror does not
//   EXTRA              — mirror holds a bundle-shaped file the vault does not
//   MANIFEST_MISMATCH  — file bytes agree vault↔mirror, but the manifest's
//                        recorded hash disagrees: the manifest is the lie
//
// READ-ONLY by construction: no writes anywhere, no journal row (an audit is
// a reading, not an event). An s3 target honestly refuses — the audit reads
// local disk, and no HEAD-by-key path has been proven against a real endpoint.
// ─────────────────────────────────────────────────────────────────────────────

export type AuditVerdict =
  | 'PASS'
  | 'DRIFT'
  | 'UNEXPECTED'
  | 'INCOMPLETE' // R84 — the EXTRA sweep (signed LIST) failed or stopped early: everything CHECKED verifies, but the audit never saw the whole prefix, so it refuses to say PASS
  | 'UNCONFIGURED'
  | 'EMPTY'
  | 'NO_MANIFEST'
  | 'UNSUPPORTED'
  | 'UNREACHABLE'; // R79 — the s3 endpoint could not be reached (or a request timed out); the audit is INCOMPLETE, not failed

export interface AuditFileRow {
  fileName: string;
  verdict: 'OK' | 'DIVERGED' | 'MISSING' | 'EXTRA' | 'MANIFEST_MISMATCH' | 'UNREACHABLE';
  vaultHash: string | null;
  mirrorHash: string | null;
  manifestHash: string | null;
  bytes: number | null;
  /** R79 — s3 only: the ETag the endpoint reports for the object (md5 for a simple PUT). Display evidence, never the verdict's authority — sha256 is. */
  etag?: string | null;
  /** R79 — s3 only: per-row honesty note (why a row is UNREACHABLE, etag cross-check outcome). */
  note?: string | null;
}

export interface MirrorAudit {
  ok: boolean;
  verdict: AuditVerdict;
  target: SyncTargetKind;
  detail: string | null;
  auditedAtUtc: string;
  files: AuditFileRow[];
  counts: { ok: number; diverged: number; missing: number; extra: number; manifestMismatch: number; unreachable?: number };
  manifest: { present: boolean; format: string | null; entries: number | null; sha256: string | null; note: string | null };
  otherFiles: number;
  message: string;
  /** R79 — s3 only: what the transport actually did, so the verdict's provenance is on the page, not in folklore. */
  transport?: {
    sigv4: 'path-style';
    headOk: number;
    reRead: number;
    etagMatches: number;
    timeoutMs: number;
    /** R82 — the signed LIST probe that powers EXTRA detection. */
    listOk?: boolean;
    /** R82 — objects the LIST saw under the prefix (bundles + manifest + extras). */
    mirrorObjects?: number | null;
    /** R82 — true when the endpoint paginated (our scale never hits it; honesty anyway). */
    truncated?: boolean;
    /** R82 — EXTRA objects whose bytes were re-read for sha256 evidence. */
    extraReRead?: number;
    /** R82 — why the EXTRA sweep is incomplete, when it is. R83 also carries
     *  the positive note when a pagination COMPLETED (pages > 1, full coverage). */
    listNote?: string | null;
    /** R83 — LIST requests issued (≥2 means the continuation loop ran). */
    listPages?: number | null;
  } | null;
}

export function auditMirror(): MirrorAudit {
  const auditedAtUtc = new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC';
  const cfg = syncConfig();
  const base = {
    target: cfg.target,
    detail: cfg.configured ? cfg.detail : null,
    auditedAtUtc,
    files: [] as AuditFileRow[],
    counts: { ok: 0, diverged: 0, missing: 0, extra: 0, manifestMismatch: 0 },
    manifest: { present: false, format: null as string | null, entries: null as number | null, sha256: null as string | null, note: null as string | null },
    otherFiles: 0,
  };

  if (cfg.target === 'none' || !cfg.configured) {
    return {
      ...base,
      ok: false,
      verdict: 'UNCONFIGURED',
      message: 'no sync target configured — there is no mirror to audit',
    };
  }
  if (cfg.target === 's3') {
    return {
      ...base,
      ok: false,
      verdict: 'UNSUPPORTED',
      message:
        'the audit reads local disk only — an s3 mirror audit needs a proven HEAD-by-key path against a real endpoint; none has shipped yet (honest refusal, not a fake pass)',
    };
  }

  const dir = cfg.detail!;
  const vaultFiles = vaultInventory();

  if (vaultFiles.length === 0) {
    return {
      ...base,
      ok: false,
      verdict: 'EMPTY',
      message: 'the vault is empty — file a snapshot before there is anything to audit',
    };
  }

  if (!existsSync(dir)) {
    return {
      ...base,
      ok: false,
      verdict: 'DRIFT',
      files: vaultFiles.map((f) => ({
        fileName: f.fileName,
        verdict: 'MISSING' as const,
        vaultHash: f.sha256,
        mirrorHash: null,
        manifestHash: null,
        bytes: null,
      })),
      counts: { ok: 0, diverged: 0, missing: vaultFiles.length, extra: 0, manifestMismatch: 0 },
      manifest: { ...base.manifest, note: `the mirror directory does not exist (${dir})` },
      message: `the mirror directory is GONE (${dir}) — every vault file is missing from it`,
    };
  }

  // manifest first — the receiver's contract
  const manifestPath = join(dir, 'sync-manifest.json');
  interface ManifestFile { fileName: string; sha256: string; bytes?: number }
  let manifestFiles = new Map<string, string>();
  if (existsSync(manifestPath)) {
    try {
      const raw = readFileSync(manifestPath, 'utf8');
      base.manifest.present = true;
      base.manifest.sha256 = createHash('sha256').update(raw).digest('hex');
      const parsed = JSON.parse(raw) as { format?: string; files?: ManifestFile[] };
      base.manifest.format = parsed.format ?? null;
      if (parsed.format !== 'vvu.sync-manifest.v1') {
        base.manifest.note = `unexpected manifest format "${parsed.format ?? 'missing'}" — expected vvu.sync-manifest.v1`;
      } else {
        manifestFiles = new Map((parsed.files ?? []).map((f) => [f.fileName, f.sha256]));
        base.manifest.entries = manifestFiles.size;
      }
    } catch (e) {
      base.manifest.note = `manifest UNREADABLE: ${e instanceof Error ? e.message : 'parse failed'}`;
    }
  } else {
    base.manifest.note = 'no manifest in the mirror — a receiver could not verify what it got';
  }

  // mirror inventory: every bundle-shaped file + count the bystanders
  const mirrorFiles = new Map<string, { sha256: string; bytes: number }>();
  for (const f of readdirSync(dir)) {
    if (!FILE_RE.test(f)) {
      base.otherFiles += 1;
      continue;
    }
    const { hash, bytes } = sha256File(join(dir, f));
    mirrorFiles.set(f, { sha256: hash, bytes });
  }

  const files: AuditFileRow[] = [];
  const vaultNames = new Set(vaultFiles.map((f) => f.fileName));

  for (const f of vaultFiles) {
    const mirror = mirrorFiles.get(f.fileName);
    const claimed = manifestFiles.get(f.fileName) ?? null;
    let verdict: AuditFileRow['verdict'];
    if (!mirror) {
      verdict = 'MISSING';
    } else if (mirror.sha256 !== f.sha256) {
      verdict = 'DIVERGED';
    } else if (base.manifest.present && manifestFiles.size > 0 && claimed !== f.sha256) {
      verdict = 'MANIFEST_MISMATCH';
    } else {
      verdict = 'OK';
    }
    files.push({
      fileName: f.fileName,
      verdict,
      vaultHash: f.sha256,
      mirrorHash: mirror?.sha256 ?? null,
      manifestHash: claimed,
      bytes: mirror?.bytes ?? null,
    });
  }
  for (const [name, m] of mirrorFiles) {
    if (!vaultNames.has(name)) {
      files.push({
        fileName: name,
        verdict: 'EXTRA',
        vaultHash: null,
        mirrorHash: m.sha256,
        manifestHash: manifestFiles.get(name) ?? null,
        bytes: m.bytes,
      });
    }
  }
  files.sort((a, b) => a.fileName.localeCompare(b.fileName));

  const counts = {
    ok: files.filter((f) => f.verdict === 'OK').length,
    diverged: files.filter((f) => f.verdict === 'DIVERGED').length,
    missing: files.filter((f) => f.verdict === 'MISSING').length,
    extra: files.filter((f) => f.verdict === 'EXTRA').length,
    manifestMismatch: files.filter((f) => f.verdict === 'MANIFEST_MISMATCH').length,
  };

  const hardDrift = counts.diverged > 0 || counts.missing > 0 || counts.manifestMismatch > 0;
  const manifestProblem = base.manifest.note !== null;
  let verdict: AuditVerdict;
  let message: string;
  if (hardDrift) {
    verdict = 'DRIFT';
    message = `the mirror and the vault DISAGREE — ${counts.diverged} diverged, ${counts.missing} missing, ${counts.manifestMismatch} manifest mismatch(es); read the table, touch nothing`;
  } else if (counts.extra > 0) {
    verdict = 'UNEXPECTED';
    message = `every vault file verifies, but the mirror holds ${counts.extra} bundle-shaped object(s) the vault does not — inventory the extra before trusting the mirror`;
  } else if (!base.manifest.present || manifestProblem) {
    verdict = 'NO_MANIFEST';
    message = `all ${counts.ok} file(s) verify byte-for-byte, but the manifest side has a problem: ${base.manifest.note ?? 'manifest absent'}`;
  } else {
    verdict = 'PASS';
    message = `all ${counts.ok} file(s) verify byte-for-byte against the vault and the manifest — the mirror is what it claims to be`;
  }

  return { ...base, ok: verdict === 'PASS', verdict, files, counts, manifest: base.manifest, message };
}

// ── R79 · THE s3 MIRROR AUDIT — HEAD by key, then re-read, then judge ───────
// ─────────────────────────────────────────────────────────────────────────────
// The R74 backlog, closed: an s3 target no longer gets an honest refusal — it
// gets an honest AUDIT. Same contract as the file audit, different transport:
//
//   HEAD  every vault key (signed SigV4, path-style)   → exists? content-length? etag?
//   GET   every object the HEAD found                   → re-read the BYTES the
//                                                         endpoint actually holds,
//                                                         sha256 them — the same
//                                                         byte-for-byte authority
//                                                         the file audit uses
//   GET   the manifest                                  → cross-check the claims
//   LIST  the prefix (R82, ListObjectsV2)               → the mirror-side
//                                                         inventory the HEAD-by-
//                                                         key pass structurally
//                                                         cannot see: objects the
//                                                         vault does NOT hold
//                                                         surface as EXTRA rows
//
// Verdicts per file: OK / DIVERGED (re-read hash ≠ vault hash) / MISSING
// (404) / MANIFEST_MISMATCH / UNREACHABLE (network error, timeout, or a
// status the audit cannot interpret) / EXTRA (R82 — the signed LIST found
// the key under the prefix, the vault does not hold it). A failed LIST never
// fakes a zero: the transport block reports it and the footer says the EXTRA
// sweep was incomplete.
//
// READ-ONLY by construction: HEAD, GET and LIST write nothing — no journal
// row, no object touched. An audit is a reading, not an event, on ANY transport.
// ─────────────────────────────────────────────────────────────────────────────

export async function auditS3Mirror(): Promise<MirrorAudit> {
  const auditedAtUtc = new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC';
  const cfg = syncConfig();
  const base = {
    target: 's3' as const,
    detail: cfg.configured ? cfg.detail : null,
    auditedAtUtc,
    files: [] as AuditFileRow[],
    counts: { ok: 0, diverged: 0, missing: 0, extra: 0, manifestMismatch: 0, unreachable: 0 },
    manifest: { present: false, format: null as string | null, entries: null as number | null, sha256: null as string | null, note: null as string | null },
    otherFiles: 0,
    transport: {
      sigv4: 'path-style' as const,
      headOk: 0,
      reRead: 0,
      etagMatches: 0,
      timeoutMs: S3_TIMEOUT_MS,
      listOk: false,
      mirrorObjects: null as number | null,
      truncated: false,
      extraReRead: 0,
      listNote: null as string | null,
      listPages: null as number | null, // R83
    },
  };

  if (cfg.target !== 's3' || !cfg.configured) {
    return {
      ...base,
      transport: null,
      ok: false,
      verdict: 'UNCONFIGURED',
      message: 'no s3 target configured — there is no off-box mirror to audit',
    };
  }
  const raw = readS3Target();
  if (!raw) {
    return {
      ...base,
      transport: null,
      ok: false,
      verdict: 'UNCONFIGURED',
      message: 's3 target selected but the raw credentials are unreadable — fix sync-target.json (or the VVU_SYNC_* env) before auditing',
    };
  }

  const vaultFiles = vaultInventory();
  if (vaultFiles.length === 0) {
    return {
      ...base,
      transport: null,
      ok: false,
      verdict: 'EMPTY',
      message: 'the vault is empty — file a snapshot before there is anything to audit',
    };
  }

  // The manifest first — the receiver's contract, same order as the file audit.
  const manifestKey = `${raw.prefix}/sync-manifest.json`;
  const manifestFiles = new Map<string, string>();
  try {
    const res = await s3Request('GET', raw, manifestKey);
    if (res.status === 404) {
      base.manifest.note = 'no manifest at the s3 target — a receiver could not verify what it got';
    } else if (res.ok) {
      const body = Buffer.from(await res.arrayBuffer());
      base.manifest.present = true;
      base.manifest.sha256 = createHash('sha256').update(body).digest('hex');
      try {
        const parsed = JSON.parse(body.toString('utf8')) as { format?: string; files?: Array<{ fileName: string; sha256: string }> };
        base.manifest.format = parsed.format ?? null;
        if (parsed.format !== 'vvu.sync-manifest.v1') {
          base.manifest.note = `unexpected manifest format "${parsed.format ?? 'missing'}" — expected vvu.sync-manifest.v1`;
        } else {
          for (const f of parsed.files ?? []) manifestFiles.set(f.fileName, f.sha256);
          base.manifest.entries = manifestFiles.size;
        }
      } catch (e) {
        base.manifest.note = `manifest UNREADABLE: ${e instanceof Error ? e.message : 'parse failed'}`;
      }
    } else {
      base.manifest.note = `manifest GET returned HTTP ${res.status} — the endpoint answered, the contract did not`;
    }
  } catch (e) {
    base.manifest.note = `manifest GET failed: ${e instanceof Error ? e.message : 'network error'}`;
  }

  // Per-file: HEAD by key, then a full re-read of the bytes behind it.
  const files: AuditFileRow[] = [];
  let unreachableRows = 0;

  for (const f of vaultFiles) {
    const key = `${raw.prefix}/${f.fileName}`;
    let head: Response | null = null;
    try {
      head = await s3Request('HEAD', raw, key);
    } catch (e) {
      unreachableRows += 1;
      files.push({
        fileName: f.fileName,
        verdict: 'UNREACHABLE',
        vaultHash: f.sha256,
        mirrorHash: null,
        manifestHash: manifestFiles.get(f.fileName) ?? null,
        bytes: null,
        etag: null,
        note: `HEAD failed: ${e instanceof Error ? e.message : 'network error'}`,
      });
      continue;
    }

    if (head.status === 404) {
      files.push({
        fileName: f.fileName,
        verdict: 'MISSING',
        vaultHash: f.sha256,
        mirrorHash: null,
        manifestHash: manifestFiles.get(f.fileName) ?? null,
        bytes: null,
        etag: null,
        note: 'the endpoint answered 404 — the object was never pushed, or it was deleted off-box',
      });
      continue;
    }
    if (!head.ok) {
      unreachableRows += 1;
      files.push({
        fileName: f.fileName,
        verdict: 'UNREACHABLE',
        vaultHash: f.sha256,
        mirrorHash: null,
        manifestHash: manifestFiles.get(f.fileName) ?? null,
        bytes: null,
        etag: null,
        note: `HEAD returned HTTP ${head.status} — the audit cannot interpret this answer`,
      });
      continue;
    }

    base.transport.headOk += 1;
    const bytes = Number(head.headers.get('content-length') ?? '0');
    const etag = head.headers.get('etag')?.replace(/"/g, '') ?? null;

    // The re-read: the HEAD only proves SOMETHING is there; the GET brings the
    // bytes back so the sha256 authority applies, exactly like the file audit.
    let body: Buffer;
    try {
      const res = await s3Request('GET', raw, key);
      if (!res.ok) {
        unreachableRows += 1;
        files.push({
          fileName: f.fileName,
          verdict: 'UNREACHABLE',
          vaultHash: f.sha256,
          mirrorHash: null,
          manifestHash: manifestFiles.get(f.fileName) ?? null,
          bytes,
          etag,
          note: `HEAD ok but the re-read GET returned HTTP ${res.status}`,
        });
        continue;
      }
      body = Buffer.from(await res.arrayBuffer());
      base.transport.reRead += 1;
    } catch (e) {
      unreachableRows += 1;
      files.push({
        fileName: f.fileName,
        verdict: 'UNREACHABLE',
        vaultHash: f.sha256,
        mirrorHash: null,
        manifestHash: manifestFiles.get(f.fileName) ?? null,
        bytes,
        etag,
        note: `re-read GET failed: ${e instanceof Error ? e.message : 'network error'}`,
      });
      continue;
    }

    const reReadHash = createHash('sha256').update(body).digest('hex');
    let note: string | null = null;
    // ETag cross-check: for a simple (non-multipart) PUT the ETag is the md5
    // of the stored bytes. Evidence only — sha256 decides every verdict.
    if (etag && !etag.includes('-')) {
      const md5 = createHash('md5').update(body).digest('hex');
      if (md5 === etag) {
        base.transport.etagMatches += 1;
        note = 'etag md5 cross-check matches the re-read bytes';
      } else {
        note = `etag md5 cross-check MISMATCHES the re-read bytes (etag ${etag.slice(0, 8)}…) — sha256 still decides, but the transport is worth a look`;
      }
    } else if (etag) {
      note = 'multipart-style etag — md5 cross-check skipped, sha256 decides';
    }

    const claimed = manifestFiles.get(f.fileName) ?? null;
    let verdict: AuditFileRow['verdict'];
    if (reReadHash !== f.sha256) {
      verdict = 'DIVERGED';
    } else if (base.manifest.present && manifestFiles.size > 0 && claimed !== f.sha256) {
      verdict = 'MANIFEST_MISMATCH';
    } else {
      verdict = 'OK';
    }
    files.push({
      fileName: f.fileName,
      verdict,
      vaultHash: f.sha256,
      mirrorHash: reReadHash,
      manifestHash: claimed,
      bytes: body.length,
      etag,
      note,
    });
  }

  // ── R82 · the signed LIST — the mirror-side inventory ────────────────────
  // HEAD-by-key proves the vault→mirror direction; structurally it cannot see
  // an object the vault does NOT know about. The LIST (ListObjectsV2, same
  // SigV4 signer) enumerates the prefix so the set relation is proven in BOTH
  // directions: anything under the prefix that is neither a vault bundle nor
  // the manifest is an EXTRA row — existence proven by the signed LIST, bytes
  // re-read for sha256 evidence where the endpoint lets us.
  try {
    const list = await s3ListObjects(raw);
    if (!list.ok) {
      base.transport.listNote = `LIST failed (${list.error ?? `HTTP ${list.status}`}) — the EXTRA sweep is INCOMPLETE, not zero`;
    } else {
      base.transport.listOk = true;
      base.transport.mirrorObjects = list.keys.length;
      base.transport.listPages = list.pages; // R83
      base.transport.truncated = list.truncated;
      if (list.truncated) {
        base.transport.listNote = list.pageCapReached
          ? `the LIST hit the ${MAX_LIST_PAGES}-page guard before covering the whole prefix — the EXTRA sweep saw ${list.keys.length} object(s), INCOMPLETE`
          : `the LIST stalled mid-pagination (no usable continuation token) — the EXTRA sweep saw ${list.keys.length} object(s), INCOMPLETE`;
      } else if (list.pages > 1) {
        // R83 — pagination COMPLETED: say so, loudly. This is the positive
        // honesty that mirrors the incomplete note.
        base.transport.listNote = `the LIST paginated ${list.pages} pages and covered the whole prefix — the EXTRA sweep is COMPLETE`;
      }
      const vaultNames = new Set(vaultFiles.map((f) => f.fileName));
      for (const o of list.keys) {
        const baseName = o.key.startsWith(`${raw.prefix}/`) ? o.key.slice(raw.prefix.length + 1) : o.key;
        if (!baseName || baseName === 'sync-manifest.json' || vaultNames.has(baseName)) continue;
        // Existence is proven; the re-read is evidence, not the verdict.
        let extraHash: string | null = null;
        let extraBytes: number | null = o.size;
        let extraNote = 'the signed LIST found this key under the prefix, but the vault does not hold it — pushed off-contract or left behind off-box';
        try {
          const extraRes = await s3Request('GET', raw, o.key);
          if (extraRes.ok) {
            const extraBody = Buffer.from(await extraRes.arrayBuffer());
            extraHash = createHash('sha256').update(extraBody).digest('hex');
            extraBytes = extraBody.length;
            base.transport.extraReRead = (base.transport.extraReRead ?? 0) + 1;
            extraNote += '; re-read for sha256 evidence';
          } else {
            extraNote += `; re-read GET returned HTTP ${extraRes.status} (existence stands on the LIST)`;
          }
        } catch (e) {
          extraNote += `; re-read GET failed (${e instanceof Error ? e.message : 'network error'}) — existence stands on the LIST`;
        }
        files.push({
          fileName: baseName,
          verdict: 'EXTRA',
          vaultHash: null,
          mirrorHash: extraHash,
          manifestHash: manifestFiles.get(baseName) ?? null,
          bytes: extraBytes,
          etag: o.etag,
          note: extraNote,
        });
      }
    }
  } catch (e) {
    base.transport.listNote = `LIST failed (${e instanceof Error ? e.message : 'network error'}) — the EXTRA sweep is INCOMPLETE, not zero`;
  }

  files.sort((a, b) => a.fileName.localeCompare(b.fileName));

  const counts = {
    ok: files.filter((f) => f.verdict === 'OK').length,
    diverged: files.filter((f) => f.verdict === 'DIVERGED').length,
    missing: files.filter((f) => f.verdict === 'MISSING').length,
    extra: files.filter((f) => f.verdict === 'EXTRA').length, // R82 — real, from the signed LIST
    manifestMismatch: files.filter((f) => f.verdict === 'MANIFEST_MISMATCH').length,
    unreachable: unreachableRows,
  };

  const hardDrift = counts.diverged > 0 || counts.missing > 0 || counts.manifestMismatch > 0;
  const manifestProblem = base.manifest.note !== null;
  // R84 — the sweep's own completeness feeds the ladder. listOk stays false on
  // a failed LIST; truncated stays true on a page-guard stop or a stalled
  // paginator. Either way the audit never saw the whole prefix, so "nothing
  // extra" would be a claim it did not earn — that state is now the INCOMPLETE
  // verdict, not a PASS with a note buried in the footer (R82 risk #2).
  const sweepIncomplete = !base.transport.listOk || base.transport.truncated === true;
  let verdict: AuditVerdict;
  let message: string;
  if (counts.unreachable > 0) {
    verdict = 'UNREACHABLE';
    message = `the audit is INCOMPLETE — ${counts.unreachable} of ${files.length} object(s) could not be read from ${raw.endpoint}/${raw.bucket}/${raw.prefix} (network, timeout, or an HTTP status the audit refuses to guess about); what did come back is in the table`;
  } else if (hardDrift) {
    verdict = 'DRIFT';
    message = `the s3 mirror and the vault DISAGREE — ${counts.diverged} diverged, ${counts.missing} missing, ${counts.manifestMismatch} manifest mismatch(es); read the table, touch nothing`;
  } else if (counts.extra > 0) {
    verdict = 'UNEXPECTED';
    message = `every vault object verifies, but the signed LIST found ${counts.extra} object(s) under ${raw.prefix} the vault does not hold — inventory the extra before trusting the mirror`;
  } else if (!base.manifest.present || manifestProblem) {
    verdict = 'NO_MANIFEST';
    message = `all ${counts.ok} object(s) verify byte-for-byte against the vault, but the manifest side has a problem: ${base.manifest.note ?? 'manifest absent'}`;
  } else if (sweepIncomplete) {
    verdict = 'INCOMPLETE';
    message = `all ${counts.ok} object(s) re-read from ${raw.endpoint}/${raw.bucket}/${raw.prefix} verify byte-for-byte against the vault and the manifest, but the EXTRA sweep did not finish (${base.transport.listNote ?? 'LIST incomplete'}) — the mirror may hold what the sweep could not see; the audit reports the gap instead of claiming a pass`;
  } else {
    verdict = 'PASS';
    message = `all ${counts.ok} object(s) re-read from ${raw.endpoint}/${raw.bucket}/${raw.prefix} verify byte-for-byte against the vault and the manifest, and the LIST shows nothing extra under the prefix — the off-box mirror is what it claims to be`;
  }

  return { ...base, ok: verdict === 'PASS', verdict, files, counts, manifest: base.manifest, message };
}
