// src/lib/bridge-feed.ts — in-app feed for the device rails (:3004 vault
// bridge and :3005 field onboard in the source deployment).
//
// The source ran two standalone socket.io mini-services that talked to the
// operator's paired Android device (Obsidian vault + field evidence store).
// As feeds, the same protocol lives in the app: a simulated paired device
// holding a markdown vault, a hash-chained receipt ledger for every op, and
// the pairing ceremony. Event names match the source socket contract so the
// workspaces only swap their transport.

import QRCode from "qrcode";
import type {
  Receipt,
  VaultResult,
  BridgeStatus,
  PairInit,
} from "@/components/bridge/bridge-types";

// ─── The simulated device vault ─────────────────────────────────────────────

const VAULT_SEED: Record<string, string> = {
  "README.md":
    "# ProofBridge Vault\n\n" +
    "Local-first evidence vault on the paired device. Nothing leaves the phone —\n" +
    "only op results transit the bridge channel.\n\n" +
    "## Layout\n- ProofBridge/ — bridge notes and architecture\n- logs/ — daily field logs\n",
  "ProofBridge/Architecture.md":
    "# Architecture\n\n" +
    "Symmetric-secret channel over TLS (pilot-grade). Every read/write/search op\n" +
    "produces a hash-chained receipt (sha256 · prev-linked).\n",
  "ProofBridge/Bridge Note.md":
    "# Bridge Note\n\nWritten from the #/bridge projection — this note lands in the LIVE vault on the phone.\n",
  "ProofBridge/Evidence/field_onboard.md":
    "# VVU Field Onboard — evidence note\n\nWritten from the #/field projection through the :3005 rail — this note lands in the LIVE field store on the paired device.\n",
  "logs/2026-02-14.md":
    "# Field log 2026-02-14\n\n- Site visit: Gqeberha edge cabinet\n- APU temp nominal 51°C\n- Inlet flow 42.5 L/s steady\n",
};

// ─── Feed implementation ────────────────────────────────────────────────────

export interface BridgeFeedEvent {
  kind: "status" | "receipt" | "result" | "events";
  status?: BridgeStatus;
  receipt?: Receipt;
  result?: VaultResult;
  events?: { deviceId: string; events: { type: string; path: string }[] };
}

export interface BridgeFeed {
  /** Subscribe to the rail's events (status / receipt / result / events). */
  onEvent: (cb: (e: BridgeFeedEvent) => void) => () => void;
  /** Execute a vault op (list / read / search / write) on the paired device. */
  emitOp: (op: "list" | "read" | "search" | "write", args: Record<string, unknown>) => void;
  /** Latest status snapshot (what /api/bridge/status returned in the source). */
  getStatus: () => BridgeStatus;
  /** Receipt tail (what /api/bridge/receipts returned in the source). */
  getReceipts: (limit?: number) => Receipt[];
  /** Verify the receipt hash chain. */
  verifyChain: () => { valid: boolean; checked: number; root: string | null };
  /** Start a pairing ceremony (what POST /api/bridge/pair returned). */
  initPair: (origin: string) => Promise<PairInit>;
}

interface FeedConfig {
  deviceId: string;
  deviceName: string;
  agentOnline: boolean;
  /** Prime the vault with device-specific content (field store vs phone vault). */
  seed: Record<string, string>;
  /** Rail-specific pairing extras (field: nonce/qrJson/node/protocol…). */
  pairExtras?: Record<string, unknown>;
}

const round = (v: number, dp = 2): number => Math.round(v * 10 ** dp) / 10 ** dp;

/** Synchronous sha256 for the receipt chain (see vvu-sim.ts for the rationale). */
function sha256(input: string): string {
  // fold UTF-8 to a byte-string so the loop below sees charCodes ≤ 255
  let ascii = unescape(encodeURIComponent(input));
  // Identical sync SHA-256 variant as vvu-sim.ts; duplicated locally so each
  // feed module stays self-contained. Inputs are ASCII-safe here.
  const rightRotate = (a: number[], amount: number): number[] => {
    const n = amount % a.length;
    return a.slice(a.length - n).concat(a.slice(0, a.length - n));
  };
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = "";
  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;
  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;
  const isComposite: Record<number, number> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  ascii += "\x80";
  while ((ascii.length % 4) - 1) ascii += "\x00";
  for (let i = 0; i < ascii.length; i++) {
    const j = ascii.charCodeAt(i);
    if (j > 255) throw new Error("bridge-feed sha256 input must be ASCII");
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[ascii.length >> 2] |= 0x80 << (((3 - ascii.length) % 4) * 8);
  words[((ascii.length >> 2) + 1) & ~0x0f] = asciiBitLength;
  const w = new Array<number>(64).fill(0);
  for (let j = 0; j < words.length;) {
    const wStart = j;
    for (let i = 0; i < 16; i++, j++) w[i] = words[j] | 0;
    for (let i = 16; i < 64; i++) {
      const w15 = w[i - 15];
      const s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
      const w2 = w[i - 2];
      const s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
      w[i] = ((s0 | 0) + (s1 | 0) + w[i - 7] + w[i - 16]) | 0;
    }
    let a = hash[0],
      b = hash[1],
      c = hash[2],
      d = hash[3],
      e = hash[4],
      f = hash[5],
      g = hash[6],
      h = hash[7];
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + k[i] + w[i]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }
    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
    j = wStart + 16;
  }
  for (let i = 0; i < 8; i++) {
    for (let j = 3; j >= 0; j--)
      result += ((hash[i] >> (j * 8)) & 255).toString(16).padStart(2, "0");
  }
  return result;
}

function createDeviceFeed(cfg: FeedConfig): BridgeFeed {
  const vault = new Map<string, string>(Object.entries(cfg.seed));
  const receipts: Receipt[] = [];
  let receiptSeq = 1;
  let lastHash = "GENESIS-BRIDGE-0000000000000000000000000000000000000000";
  const listeners = new Set<(e: BridgeFeedEvent) => void>();
  let lastStatus: BridgeStatus;

  const agent = { deviceId: cfg.deviceId, name: cfg.deviceName, lastSeenAgoMs: 0 };

  function buildStatus(): BridgeStatus {
    return {
      ok: true,
      agentOnline: cfg.agentOnline,
      agent: cfg.agentOnline
        ? { ...agent, lastSeenAgoMs: Math.round((Date.now() - bootAt) / 1000) * 1000 }
        : null,
      pairedDevices: 1,
      viewerCount: 1,
      pairing: { active: false },
      receipts: {
        count: receipts.length,
        root: receipts.length ? receipts[receipts.length - 1].hash : lastHash,
        verified: true,
      },
    };
  }

  function pushStatus(): void {
    lastStatus = buildStatus();
    const e: BridgeFeedEvent = { kind: "status", status: lastStatus };
    for (const l of listeners) l(e);
  }

  function appendReceipt(actor: string, op: string, target: string, ok: boolean): Receipt {
    const ts = new Date().toISOString();
    const sha256Body = sha256(`${op}|${target}|${ok ? "OK" : "ERR"}|${ts}`);
    const prevHash = lastHash;
    const hash = sha256(`${prevHash}|${receiptSeq}|${sha256Body}`);
    const receipt: Receipt = {
      seq: receiptSeq++,
      ts,
      actor,
      op,
      target,
      ok,
      sha256: sha256Body,
      prevHash,
      hash,
    };
    lastHash = hash;
    receipts.push(receipt);
    if (receipts.length > 200) receipts.splice(0, receipts.length - 200);
    for (const l of listeners) l({ kind: "receipt", receipt });
    return receipt;
  }

  function pushResult(r: VaultResult): void {
    for (const l of listeners) l({ kind: "result", result: r });
  }

  function pushVaultEvents(type: string, path: string): void {
    for (const l of listeners)
      l({ kind: "events", events: { deviceId: cfg.deviceId, events: [{ type, path }] } });
  }

  const bootAt = Date.now();
  lastStatus = buildStatus();

  // ambient device activity: occasional vault change events keep the rail live
  setInterval(() => {
    if (!cfg.agentOnline) return;
    const paths = [...vault.keys()];
    const path = paths[Math.floor(Math.random() * paths.length)];
    if (Math.random() < 0.25) pushVaultEvents(Math.random() < 0.5 ? "modify" : "content", path);
  }, 45_000);

  return {
    onEvent(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    emitOp(op, args) {
      const t0 = Date.now();
      let result: VaultResult;
      try {
        if (op === "list") {
          const paths = [...vault.keys()].sort();
          result = {
            commandId: null,
            op,
            ok: true,
            data: { files: paths },
            elapsedMs: Date.now() - t0,
          };
        } else if (op === "read") {
          const path = String(args.path ?? "");
          const content = vault.get(path);
          result =
            content !== undefined
              ? {
                  commandId: null,
                  op,
                  ok: true,
                  data: { path, content },
                  elapsedMs: Date.now() - t0,
                }
              : {
                  commandId: null,
                  op,
                  ok: false,
                  error: `not found: ${path}`,
                  elapsedMs: Date.now() - t0,
                };
        } else if (op === "search") {
          const query = String(args.query ?? "");
          const hits: Array<{ path: string; line: number; snippet: string }> = [];
          for (const [path, content] of vault) {
            const lines = content.split("\n");
            lines.forEach((line, i) => {
              if (hits.length < 12 && line.toLowerCase().includes(query.toLowerCase())) {
                hits.push({ path, line: i + 1, snippet: line.trim().slice(0, 120) });
              }
            });
          }
          result = {
            commandId: null,
            op,
            ok: true,
            data: { query, results: hits },
            elapsedMs: Date.now() - t0,
          };
        } else if (op === "write") {
          const path = String(args.path ?? "");
          const content = String(args.content ?? "");
          const existed = vault.has(path);
          vault.set(path, content);
          result = {
            commandId: null,
            op,
            ok: true,
            data: { path, bytes: content.length, created: !existed },
            elapsedMs: Date.now() - t0,
          };
          pushVaultEvents(existed ? "modify" : "create", path);
        } else {
          result = {
            commandId: null,
            op,
            ok: false,
            error: `unknown op: ${op}`,
            elapsedMs: Date.now() - t0,
          };
        }
      } catch (err) {
        result = {
          commandId: null,
          op,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          elapsedMs: Date.now() - t0,
        };
      }

      const target = String(args.path ?? args.query ?? op);
      result.receipt = appendReceipt("DASHBOARD", op, target, result.ok);
      pushResult(result);
    },

    getStatus: () => buildStatus(),

    getReceipts: (limit = 100) => receipts.slice(-limit),

    verifyChain() {
      let prev = "GENESIS-BRIDGE-0000000000000000000000000000000000000000";
      for (let i = 0; i < receipts.length; i++) {
        const r = receipts[i];
        const body = sha256(`${r.op}|${r.target}|${r.ok ? "OK" : "ERR"}|${r.ts}`);
        if (r.prevHash !== prev || r.sha256 !== body || r.seq !== i + 1) {
          return { valid: false, checked: i, root: r.prevHash };
        }
        prev = r.hash;
      }
      return {
        valid: true,
        checked: receipts.length,
        root: receipts.length ? receipts[receipts.length - 1].hash : prev,
      };
    },

    async initPair(origin) {
      const pairingId = `pair-${Math.random().toString(36).slice(2, 10)}`;
      const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      const qrPayload = JSON.stringify({
        endpoint: `${origin}/~device-rail`,
        token,
        device: cfg.deviceName,
      });
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      let qrDataUrl = "";
      try {
        qrDataUrl = await QRCode.toDataURL(qrPayload, { width: 320, margin: 1 });
      } catch {
        // workspace falls back to the raw payload text
      }
      const extras = { ...(cfg.pairExtras ?? {}) } as Record<string, unknown>;
      if (extras["qrJson"]) {
        extras["qrJson"] = {
          ...(extras["qrJson"] as Record<string, unknown>),
          endpoint: `${origin}/~device-rail`,
          nonce: token,
          expiry: new Date(expiresAt).getTime(),
        };
      }
      return {
        pairingId,
        token,
        qrPayload,
        qrDataUrl,
        expiresAt,
        qrExpiresAt: expiresAt,
        ...extras,
      } as PairInit & Record<string, unknown>;
    },
  };
}

// ─── The two rails (module-level singletons survive projection switches) ────

export const bridgeFeed = createDeviceFeed({
  deviceId: "obsidian-pixel-7a",
  deviceName: "Obsidian vault · Pixel 7a",
  agentOnline: true,
  seed: VAULT_SEED,
});

export const fieldFeed = createDeviceFeed({
  deviceId: "field-tab-m55",
  deviceName: "Field onboard · Galaxy Tab M55",
  agentOnline: true,
  pairExtras: {
    nonce: Math.random().toString(36).slice(2),
    node: "VVU-FIELD-ONBOARD",
    protocol: "proofbridge/v1+field",
    qrJson: {
      endpoint: "/~device-rail/field",
      nonce: "",
      expiry: 0,
      node: "VVU-FIELD-ONBOARD",
      protocol: "proofbridge/v1+field",
    },
  },
  seed: {
    ...VAULT_SEED,
    "ProofBridge/Evidence/field_onboard.md":
      "# VVU Field Onboard — evidence note\n\nWritten from the #/field projection through the :3005 rail — this note lands in the LIVE field store on the paired device.\n",
  },
});
