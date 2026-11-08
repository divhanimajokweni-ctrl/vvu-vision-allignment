import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { readdir, readFile, stat } from "fs/promises";

// GET /api/golden-rule — run the golden rule check and return results
export async function GET() {
  const reportPath = join(process.cwd(), "golden-rule-report.json");

  // If a pre-generated report exists, use it; otherwise generate inline
  if (existsSync(reportPath)) {
    try {
      const raw = readFileSync(reportPath, "utf-8");
      const report = JSON.parse(raw);
      return NextResponse.json(report);
    } catch {
      /* fall through to inline scan */
    }
  }

  // Inline scan (simplified version of the golden-rule-checker.js)
  const OSS_DIR = join(process.cwd(), "open-source");
  const FORBIDDEN = [
    "ProofBridge", "Ubuntu Pools", "UbuntuPools", "SafeGrid",
    "Stokvel", "ROSCA", "FSCA", "FICA", "POPIA",
    "kimi_reply", "vision_agent", "Hydro-Gateway", "HBK", "VVU EARTH TECH",
    "Jendamark", "Welfit Oddy", "Formex", "Algoa", "Gqeberha",
    "NMBM", "Propella", "TIA Seed", "WRC",
  ];
  const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".rs", ".go"];

  const violations: { file: string; line: number; keyword: string; content: string }[] = [];
  let scanned = 0;

  async function scan(dir: string) {
    let entries: import("fs").Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await scan(full);
      } else if (EXTENSIONS.includes(entry.name.slice(entry.name.lastIndexOf(".")))) {
        scanned++;
        const content = await readFile(full, "utf-8");
        content.split("\n").forEach((line, i) => {
          if (line.trim().startsWith("//") || line.trim().startsWith("*")) return;
          for (const kw of FORBIDDEN) {
            if (line.includes(kw)) {
              violations.push({
                file: full.replace(process.cwd() + "/", ""),
                line: i + 1,
                keyword: kw,
                content: line.trim().slice(0, 80),
              });
            }
          }
        });
      }
    }
  }

  await scan(OSS_DIR);

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    filesScanned: scanned,
    violationCount: violations.length,
    forbiddenStrings: FORBIDDEN,
    violations,
    status: violations.length === 0 ? "PASS" : "FAIL",
  });
}
