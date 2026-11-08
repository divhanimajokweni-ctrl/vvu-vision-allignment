import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appendWormEvent } from '@/lib/vvu-ledger';
import { scoreLead, toBoolOrFalse, toIntOrNull, toSectorOrNull } from '@/lib/lead-scoring';
import { OUTREACH_TENANT_ID } from '@/lib/vvu-data';
import type { ConsentBasis } from '@/types/vvu';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/vvu/outreach/import — bulk CSV import of pilot-outreach targets.
// Core columns: org,contactName,email,criticalIssue,consentBasis — header row
// optional (detected by name) and quoted fields with commas are tolerated.
// Round 18 OPTIONAL scoring columns (any subset, any order, header-only):
//   sector, revenueM (R millions), employees, bbbeeLevel, suppliers,
//   auditFail (12m), popiaRisk, govContracts — booleans accept
//   true/yes/1/y (case-insensitive). Each row is scored server-side.
// Unknown consentBasis values degrade to NONE (POPIA-safe default: refuse).
// Duplicates against existing tenant emails (and within the CSV) are skipped.

const CONSENT_BY_LABEL: Record<string, ConsentBasis> = {
  OPT_IN: 'OPT_IN',
  EXISTING_CUSTOMER: 'EXISTING_CUSTOMER',
};

function normalizeConsent(raw: string): ConsentBasis {
  const key = raw.trim().toUpperCase().replace(/[\s-]+/g, '_');
  return CONSENT_BY_LABEL[key] ?? 'NONE';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Minimal RFC-4180-ish CSV parser: quotes, ""-escapes and commas/newlines
 *  inside quoted fields. Returns rows of cell strings (empty rows dropped). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      // swallow \r of \r\n; any newline ends the row
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.length > 1 || row[0] !== '') rows.push(row);
  return rows;
}

const EXPECTED_COLUMNS = ['org', 'contactName', 'email', 'criticalIssue', 'consentBasis'] as const;

// Round 18 — optional scoring columns (normalised header names; aliases
// tolerate common spellings: bbbee, bbbee_level, revenue, …).
const OPTIONAL_SCORE_COLUMNS = new Set([
  'sector',
  'revenuem',
  'revenue',
  'annualrevenue',
  'employees',
  'bbbeelevel',
  'bbbee',
  'suppliers',
  'suppliercount',
  'auditfail',
  'auditfail12m',
  'popiarisk',
  'govcontracts',
  'gov',
]);

interface ImportRow {
  org: string;
  contactName: string;
  email: string;
  criticalIssue: string | null;
  consentBasis: ConsentBasis;
  sector: string | null;
  annualRevenue: number | null;
  employees: number | null;
  bbbeeLevel: number | null;
  supplierCount: number | null;
  auditFail12m: boolean;
  popiaRisk: boolean;
  govContracts: boolean;
}

export async function POST(req: NextRequest) {
  let body: { csv?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 });
  }
  const csv = (body.csv ?? '').trim();
  if (!csv) {
    return NextResponse.json(
      { success: false, message: 'Missing required field: csv' },
      { status: 422 }
    );
  }

  try {
    const rawRows = parseCsv(csv);
    if (rawRows.length === 0) {
      return NextResponse.json({ added: 0, skipped: 0 });
    }

    // Header detection: first row's labels name the expected columns (order-
    // agnostic, case/space-insensitive). Otherwise rows are positional in
    // EXPECTED_COLUMNS order. Normalisation matters — comparing the mixed-case
    // EXPECTED_COLUMNS literals against lowercased cells would miss
    // 'contactName'/'criticalIssue'/'consentBasis' and treat the header as a
    // (invalid) data row.
    const norm = (c: string): string => c.trim().toLowerCase().replace(/[\s_-]+/g, '');
    const first = rawRows[0].map(norm);
    const expectedNorm = EXPECTED_COLUMNS.map(norm);
    const hasHeader = expectedNorm.every((c) => first.includes(c));
    let colIndex: Record<(typeof EXPECTED_COLUMNS)[number], number>;
    if (hasHeader) {
      colIndex = {
        org: first.indexOf('org'),
        contactName: first.indexOf('contactname'),
        email: first.indexOf('email'),
        criticalIssue: first.indexOf('criticalissue'),
        consentBasis: first.indexOf('consentbasis'),
      };
    } else {
      colIndex = { org: 0, contactName: 1, email: 2, criticalIssue: 3, consentBasis: 4 };
    }
    // Round 18 — map optional scoring columns by (normalised) header name.
    // Positional CSVs (no header) can still put them in columns 5..12 in the
    // documented order.
    const SCORE_COL_ORDER = ['sector', 'revenueM', 'employees', 'bbbeeLevel', 'suppliers', 'auditFail', 'popiaRisk', 'govContracts'] as const;
    const scoreColIndex: Record<string, number> = {};
    if (hasHeader) {
      first.forEach((cell, idx) => {
        if (OPTIONAL_SCORE_COLUMNS.has(cell)) {
          scoreColIndex[cell] = idx;
        }
      });
    } else {
      SCORE_COL_ORDER.forEach((name, i) => {
        scoreColIndex[name] = 5 + i;
      });
    }
    const getScoreCol = (cells: string[], aliases: string[]): string => {
      for (const alias of aliases) {
        const idx = scoreColIndex[alias];
        if (idx !== undefined && idx >= 0 && idx < cells.length) return cells[idx].trim();
      }
      return '';
    };
    const dataRows = hasHeader ? rawRows.slice(1) : rawRows;

    const candidate: ImportRow[] = [];
    let skipped = 0;
    for (const cells of dataRows) {
      const get = (idx: number): string => (idx >= 0 && idx < cells.length ? cells[idx].trim() : '');
      const email = get(colIndex.email).toLowerCase();
      const org = get(colIndex.org);
      const contactName = get(colIndex.contactName);
      if (!email || !org || !contactName || !EMAIL_RE.test(email) || email.length > 254) {
        skipped++;
        continue;
      }
      // within-CSV dedupe (first occurrence wins)
      if (candidate.some((r) => r.email === email)) {
        skipped++;
        continue;
      }
      candidate.push({
        org: org.slice(0, 120),
        contactName: contactName.slice(0, 120),
        email,
        criticalIssue: get(colIndex.criticalIssue).slice(0, 300) || null,
        consentBasis: normalizeConsent(get(colIndex.consentBasis)),
        sector: getScoreCol(cells, ['sector']) || null,
        annualRevenue: toIntOrNull(getScoreCol(cells, ['revenuem', 'revenue', 'annualrevenue']) || null, 1, 100_000),
        employees: toIntOrNull(getScoreCol(cells, ['employees']) || null, 1, 500_000),
        bbbeeLevel: toIntOrNull(getScoreCol(cells, ['bbbeelevel', 'bbbee']) || null, 1, 8),
        supplierCount: toIntOrNull(getScoreCol(cells, ['suppliers', 'suppliercount']) || null, 0, 100_000),
        auditFail12m: toBoolOrFalse(getScoreCol(cells, ['auditfail', 'auditfail12m'])),
        popiaRisk: toBoolOrFalse(getScoreCol(cells, ['popiarisk'])),
        govContracts: toBoolOrFalse(getScoreCol(cells, ['govcontracts', 'gov'])),
      });
    }

    // dedupe against existing tenant emails
    const existing = await db.outreachTarget.findMany({
      where: { tenantId: OUTREACH_TENANT_ID },
      select: { email: true },
    });
    const existingEmails = new Set(existing.map((t) => t.email));
    const fresh = candidate.filter((r) => {
      if (existingEmails.has(r.email)) {
        skipped++;
        return false;
      }
      return true;
    });

    let added = 0;
    let scored = 0;
    for (const r of fresh) {
      const sector = r.sector ? toSectorOrNull(r.sector) : null;
      const profile = {
        sector,
        annualRevenue: r.annualRevenue,
        employees: r.employees,
        bbbeeLevel: r.bbbeeLevel,
        supplierCount: r.supplierCount,
        auditFail12m: r.auditFail12m,
        popiaRisk: r.popiaRisk,
        govContracts: r.govContracts,
      };
      const { score, tier } = scoreLead(profile);
      if (tier !== 'UNSCORED') scored++;
      await db.outreachTarget.create({
        data: {
          tenantId: OUTREACH_TENANT_ID,
          org: r.org,
          contactName: r.contactName,
          email: r.email,
          criticalIssue: r.criticalIssue,
          consentBasis: r.consentBasis,
          ...profile,
          score,
          tier,
        },
      });
      added++;
    }

    // WORM evidence — counts only (no per-row noise on the shared chain).
    await appendWormEvent({
      source: 'OUTREACH',
      event: 'OUTREACH_IMPORT',
      details: `CSV IMPORT · ADDED ${added} · SKIPPED ${skipped} · SCORED ${scored}`,
    });
    return NextResponse.json({ added, skipped, scored });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
