/**
 * EvidenceLog — VVU evidence-and-verification utility.
 *
 * Governing skill: searm-estate/skills/vvu-evidence-and-verification/SKILL.md
 *
 * Rules enforced by this class:
 *  1. A result is "verified" only if the command was run in the container
 *     and its output is quoted in the note.
 *  2. EXPECTED blocks are labelled `EXPECTED`. Observed output is labelled
 *     `OBSERVED`. The builder ENFORCES this separation: there is no method
 *     that allows expected output to be written into the OBSERVED slot,
 *     and no method that allows observed output to be written into the
 *     EXPECTED slot. The two fields live on distinct builder methods and
 *     are serialised under distinct headers in the note.
 *  3. Each changed file is recorded with its SHA-256 before and after.
 *  4. Claims that are NOT made are recorded explicitly.
 *  5. Open gaps are recorded by ID.
 *
 * Usage:
 *   const note = await EvidenceLog.start("phase-x", "goal y")
 *     .command("python3 foo.py")
 *     .observed("ok\n")
 *     .expected("ok\n")
 *     .filesChanged([{path:"a", beforeHash:"00", afterHash:"11"}])
 *     .gaps(["G1"])
 *     .claimsNotMade(["detector is clinically accurate"])
 *     .write();
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export interface FileChange {
  path: string;
  beforeHash: string;
  afterHash: string;
}

export interface EvidenceNoteData {
  phase: string;
  goal: string;
  command: string;
  observed: string;
  expected: string;
  testsPassed: number;
  testsFailed: number;
  testsErrored: number;
  testFailures: string[];
  filesChanged: FileChange[];
  gaps: string[];
  claimsNotMade: string[];
  writtenAt: string;
  notePath: string;
}

/**
 * Hash a file with SHA-256. Returns the hex digest, or "<missing>" if the
 * file does not exist (so the before-hash of a newly created file is
 * recorded honestly as missing, not as zero).
 */
export async function sha256File(absPath: string): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  try {
    const buf = await readFile(absPath);
    return createHash("sha256").update(buf).digest("hex");
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return "<missing>";
    throw e;
  }
}

/** Hash an arbitrary string with SHA-256. */
export function sha256String(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/**
 * EvidenceLog — entry point.
 *
 * `start(phase, goal)` returns a fresh EvidenceBuilder. The builder is a
 * fluent immutable-style builder; each setter returns a new builder with
 * the field set, so partial notes can be safely captured mid-construction.
 */
export class EvidenceLog {
  /** Default output directory, relative to the project root. */
  static readonly DEFAULT_EVIDENCE_DIR = "docs/evidence";

  static start(phase: string, goal: string): EvidenceBuilder {
    return new EvidenceBuilder({
      phase,
      goal,
      command: "",
      observed: "",
      expected: "",
      testsPassed: 0,
      testsFailed: 0,
      testsErrored: 0,
      testFailures: [],
      filesChanged: [],
      gaps: [],
      claimsNotMade: [],
      writtenAt: "",
      notePath: "",
    });
  }

  /**
   * Compute a SHA-256 hash of a file for use in `filesChanged`. Convenience
   * static so callers don't have to import `sha256File` separately.
   */
  static hash(absPath: string): Promise<string> {
    return sha256File(absPath);
  }
}

export class EvidenceBuilder {
  constructor(private readonly data: EvidenceNoteData) {}

  /**
   * Records the EXACT command run in the container. Required for a note
   * to be considered "verified" per skill rule 1.
   */
  command(cmd: string): EvidenceBuilder {
    return new EvidenceBuilder({ ...this.data, command: cmd });
  }

  /**
   * Records [OBSERVED] output — verbatim, quoted from the container. This
   * is the only way to set observed output; there is no method that lets
   * expected output leak into this slot.
   */
  observed(output: string): EvidenceBuilder {
    return new EvidenceBuilder({ ...this.data, observed: output });
  }

  /**
   * Records [EXPECTED] output — what the operator expected, kept strictly
   * separate from observed. There is no method that lets observed output
   * leak into this slot.
   */
  expected(output: string): EvidenceBuilder {
    return new EvidenceBuilder({ ...this.data, expected: output });
  }

  /**
   * Records test counts and the names of failing tests. Failing tests are
   * reported as failing per skill rule 5; environment gaps are recorded
   * as gaps (see `gaps()`), not as passes.
   */
  tests(passed: number, failed: number, errored: number,
        failures: string[] = []): EvidenceBuilder {
    return new EvidenceBuilder({
      ...this.data,
      testsPassed: passed,
      testsFailed: failed,
      testsErrored: errored,
      testFailures: [...failures],
    });
  }

  /**
   * Records the SHA-256 of each changed file BEFORE and AFTER the phase.
   * Per skill rule 3, each changed file MUST be recorded with both hashes.
   */
  filesChanged(files: FileChange[]): EvidenceBuilder {
    return new EvidenceBuilder({
      ...this.data,
      filesChanged: [...this.data.filesChanged, ...files],
    });
  }

  /** Records open gap IDs (cross-referenced to MANIFEST.md). */
  gaps(gapIds: string[]): EvidenceBuilder {
    return new EvidenceBuilder({
      ...this.data,
      gaps: [...this.data.gaps, ...gapIds],
    });
  }

  /**
   * Records claims that are NOT made by this phase. This is the inverse
   * of a results table: it makes explicit what the operator refuses to
   * claim, even when tempted to.
   */
  claimsNotMade(claims: string[]): EvidenceBuilder {
    return new EvidenceBuilder({
      ...this.data,
      claimsNotMade: [...this.data.claimsNotMade, ...claims],
    });
  }

  /**
   * Renders the note using the EXACT template from
   * vvu-evidence-and-verification/SKILL.md. The template is reproduced
   * verbatim — the EXPECTED and OBSERVED blocks are kept under distinct
   * headers so they can never be conflated by a reader.
   */
  render(): string {
    const d = this.data;
    const ts = new Date().toISOString();
    const files = d.filesChanged.length
      ? d.filesChanged
          .map(f => `  - ${f.path}\n    before: ${f.beforeHash}\n    after:  ${f.afterHash}`)
          .join("\n")
      : "  (none)";
    const gaps = d.gaps.length ? d.gaps.map(g => `  - ${g}`).join("\n") : "  (none)";
    const claims = d.claimsNotMade.length
      ? d.claimsNotMade.map(c => `  - ${c}`).join("\n")
      : "  (none)";
    const failures = d.testFailures.length
      ? d.testFailures.map(f => `  - ${f}`).join("\n")
      : "  (none)";

    // The template below is the one in the skill verbatim, with the
    // builder's fields substituted in. EXPECTED and OBSERVED live in
    // distinct fenced blocks under distinct headers, both explicitly
    // labelled per skill rule 2 ("Expected-output blocks are labelled
    // EXPECTED. Observed output is labelled OBSERVED.").
    return `Phase: ${d.phase}
Goal: ${d.goal}
Commands run (exact):
\`\`\`
${d.command || "(none recorded)"}
\`\`\`
[OBSERVED] output (quoted, truncated only with ellipsis):
\`\`\`
${d.observed || "(none recorded)"}
\`\`\`
[EXPECTED] output (kept separate from observed; NOT a substitute for observed):
\`\`\`
${d.expected || "(none recorded)"}
\`\`\`
Tests: passed=${d.testsPassed} / failed=${d.testsFailed} / errored=${d.testsErrored}
Failing tests:
${failures}
Files changed (path, sha256 before, sha256 after):
${files}
Open gaps (with gap IDs from MANIFEST.md):
${gaps}
Claims NOT made:
${claims}

Evidence note written at: ${ts}
`;
  }

  /**
   * Writes the rendered note to `docs/evidence/<phase>.md` (or to
   * `evidenceDir` if set on the builder). Returns the absolute path written.
   * The builder is terminal: no further mutations are possible after write.
   */
  async write(opts: { evidenceDir?: string } = {}): Promise<string> {
    const dir = opts.evidenceDir
      ? resolve(opts.evidenceDir)
      : resolve(process.cwd(), EvidenceLog.DEFAULT_EVIDENCE_DIR);
    const safePhase = this.data.phase.replace(/[^a-zA-Z0-9._-]/g, "_");
    const absPath = resolve(dir, `${safePhase}.md`);
    await mkdir(dirname(absPath), { recursive: true });
    const body = this.render();
    await writeFile(absPath, body, "utf8");
    return absPath;
  }
}
