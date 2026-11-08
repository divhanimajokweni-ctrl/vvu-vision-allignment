/**
 * ProtocolRegistry — VVU academic-validation gatekeeper.
 *
 * Governing skill: searm-estate/skills/vvu-academic-validation/SKILL.md
 *
 * Rule enforced: a claim may not be made, and its corresponding test may
 * not run, until a frozen protocol exists at `validation/<name>.md` and
 * its hash has been logged to the WORM ledger as a `PROTOCOL_FROZEN`
 * event.
 *
 * The Python reproduction script (`validation/run_validation.py`) mirrors
 * the same guard so that the check is enforced from both language sides.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

/** Thrown by `require()` when the named protocol file is absent. */
export class MissingProtocolError extends Error {
  public readonly code = "MISSING_PROTOCOL";
  constructor(public readonly protocolName: string,
              public readonly expectedPath: string) {
    super(
      `MISSING_PROTOCOL: no frozen protocol at ${expectedPath}. ` +
      `A protocol named "${protocolName}" must be created and ` +
      `hashed before its corresponding test may run. ` +
      `See vvu-academic-validation/SKILL.md procedure §1.`
    );
    this.name = "MissingProtocolError";
  }
}

export interface ProtocolRegistryOptions {
  /** Directory containing protocol markdown files. Default: ./validation */
  validationDir?: string;
  /** Path to the Python ledger CLI. */
  ledgerPy?: string;
}

export class ProtocolRegistry {
  private readonly validationDir: string;
  private readonly ledgerPy: string;

  constructor(opts: ProtocolRegistryOptions = {}) {
    this.validationDir = resolve(opts.validationDir ?? "validation");
    this.ledgerPy = opts.ledgerPy ??
      "/home/z/repo-push/vvu-searm-core/ledger/event_ledger.py";
  }

  /** Absolute path to the markdown file for the named protocol. */
  pathFor(protocolName: string): string {
    // accept either "v1" or "protocol_v1"; normalise to protocol_<name>.md
    const stem = protocolName.startsWith("protocol_")
      ? protocolName
      : `protocol_${protocolName}`;
    return resolve(this.validationDir, `${stem}.md`);
  }

  /**
   * Returns true if the named protocol exists on disk. Does NOT throw.
   */
  exists(protocolName: string): boolean {
    // Synchronous existence check via require.resolve is awkward; use a
    // quick read attempt through readFile and catch. The function is
    // async-friendly via `hash()`, but callers that need a sync boolean
    // can use `existsSync` from fs directly. We expose this for symmetry.
    const p = this.pathFor(protocolName);
    try {
      // execFileSync is too heavy here; use a tiny stat via require trick.
      // (We do not import fs directly to avoid pulling sync stat in the
      //  browser-targeted bundle path; tests run in node anyway.)
      // Fallback: attempt a zero-byte read.
      const buf = readFileSync(p);
      return Buffer.isBuffer(buf);
    } catch {
      return false;
    }
  }

  /**
   * Throws `MissingProtocolError` (code `MISSING_PROTOCOL`) if the named
   * protocol file is absent. Returns the absolute path otherwise.
   */
  require(protocolName: string): string {
    const p = this.pathFor(protocolName);
    try {
      readFileSync(p);
    } catch {
      throw new MissingProtocolError(protocolName, p);
    }
    return p;
  }

  /**
   * Returns the SHA-256 hex digest of the named protocol file. Throws
   * `MissingProtocolError` if absent.
   */
  async hash(protocolName: string): Promise<string> {
    const p = this.require(protocolName);
    const buf = await readFile(p);
    return createHash("sha256").update(buf).digest("hex");
  }

  /**
   * Logs a `PROTOCOL_FROZEN` event to the WORM ledger by shelling to the
   * Python ledger CLI. The hash is included in the payload so that the
   * ledger becomes the canonical anchor for the protocol identity.
   *
   * Returns the stdout of the ledger CLI (for evidence-note capture).
   * If the ledger CLI is unreachable, the error is re-thrown with the
   * command that failed — we do NOT silently swallow ledger failures.
   */
  logToWorm(protocolName: string, hash: string,
            extra?: Record<string, unknown>): string {
    const payload = JSON.stringify({
      protocol: protocolName,
      hash,
      frozen_at: new Date().toISOString(),
      ...(extra ?? {}),
    });
    const args = [
      this.ledgerPy,
      "append",
      "--type", "PROTOCOL_FROZEN",
      "--source", "validation",
      "--payload", payload,
    ];
    try {
      const stdout = execFileSync("python3", args, {
        encoding: "utf8",
        // Large ledger outputs should still be captured.
        maxBuffer: 16 * 1024 * 1024,
      });
      return stdout;
    } catch (e: unknown) {
      const err = e as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
      throw new Error(
        `WORM_LEDGER_WRITE_FAILED: python3 ${args.join(" ")}\n` +
        `stdout: ${err.stdout ?? ""}\nstderr: ${err.stderr ?? err.message}`
      );
    }
  }

  /**
   * Convenience: verify the WORM ledger integrity. Returns the stdout of
   * `python3 <ledger> verify`. Throws on non-zero exit.
   */
  verifyLedger(): string {
    try {
      return execFileSync("python3", [this.ledgerPy, "verify"], {
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
      });
    } catch (e: unknown) {
      const err = e as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
      throw new Error(
        `WORM_LEDGER_VERIFY_FAILED: python3 ${this.ledgerPy} verify\n` +
        `stdout: ${err.stdout ?? ""}\nstderr: ${err.stderr ?? err.message}`
      );
    }
  }
}

/**
 * Singleton default registry bound to the project's `validation/` directory
 * and the canonical ledger path. Most callers should use this.
 */
export const defaultRegistry = new ProtocolRegistry();
