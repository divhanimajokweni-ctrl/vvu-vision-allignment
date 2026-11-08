// src/app/api/ops/sweep/route.ts — Task 45 · OPS_SWEEP (manual run).
//
// The consolidated operating sweep from the operator's Day-1 field directive:
// ONE sweep, eight domains, exception-only verdicts. This route is what the
// 30-minute cadence will call when the operator's cron/MCP infrastructure
// exists; until then it is manually runnable from #/ops (RUN SWEEP NOW).
//
// HONESTY (this file's core contract):
//   * Domains with no instrumentation (customer / sales / commercial) report
//     NOT_INSTRUMENTED with the reason — never a fake green.
//   * LIVE domains are checked against the real estate: :3000 integrity,
//     :3003 health, :3004 governance + receipts chain, :3005 health, WORM
//     ledger validity. No check is simulated.
//   * The verdict logic mirrors the operator's exception format: GREEN /
//     ACTION REQUIRED / SECURITY / MCP.
//   * Every sweep run is itself WORM-receipted (appendWormEvent) — the sweep
//     is evidence too.
//   * The sweep NEVER modifies canonical state — it observes, classifies,
//     and reports. (Automation authority rule, hard.)

import { NextResponse } from 'next/server';
import { appendWormEvent } from '@/lib/vvu-ledger';

export const dynamic = 'force-dynamic';

// ── types ───────────────────────────────────────────────────────────────────

interface DomainResult {
  n: number;
  code: string;
  name: string;
  status: 'GREEN' | 'EXCEPTION' | 'NOT_INSTRUMENTED';
  /** severity when status=EXCEPTION — drives the notification kind. */
  severity?: 'MCP' | 'SECURITY' | 'ACTION REQUIRED';
  lines: string[];
}

interface SweepResult {
  ranAt: string;
  verdict: 'GREEN' | 'ACTION REQUIRED';
  domains: DomainResult[];
  /** The operator-facing exception block (what a phone would receive). */
  notification: string;
  wormReceiptId?: string;
  durationMs: number;
}

// ── fetch helpers (server-side, direct localhost — no gateway needed) ───────

async function getJson(url: string, timeoutMs = 4000): Promise<Record<string, unknown> | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(t);
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ── the sweep ───────────────────────────────────────────────────────────────

export async function GET() {
  const started = Date.now();
  const domains: DomainResult[] = [];

  // gather raw evidence first (single pass, reused across domains)
  const [integrity, wormSummary, governance, bridgeStatus, t3, t5] = await Promise.all([
    getJson('http://localhost:3000/api/integrity'),
    getJson('http://localhost:3000/api/vvu/analytics'),
    getJson('http://localhost:3004/api/bridge/governance'),
    getJson('http://localhost:3004/status'),
    getJson('http://localhost:3003/healthz'),
    getJson('http://localhost:3005/healthz'),
  ]);

  const integrityMatch = integrity?.match === true;
  const wormChainValid =
    (wormSummary?.worm as { chainValid?: boolean } | undefined)?.chainValid === true;
  const wormCount = Number((wormSummary?.worm as { count?: number } | undefined)?.count ?? 0);
  const govChainValid = governance?.chainValid === true;
  const govEntries = Number(governance?.count ?? 0);
  const govDhPending = Number(governance?.dhQueuePending ?? 0);
  const govRevoked = Array.isArray(governance?.revoked) ? (governance.revoked as unknown[]).length : 0;
  const govRules = Array.isArray(governance?.rules) ? (governance.rules as unknown[]).length : 0;
  const receipts = (bridgeStatus?.receipts as { count?: number } | undefined) ?? null;
  const receiptsCount = Number(receipts?.count ?? 0);

  // ── domain 1 · MCP ───────────────────────────────────────────────────────
  {
    const lines: string[] = [];
    let status: DomainResult['status'] = 'GREEN';
    let severity: DomainResult['severity'];
    if (governance === null) {
      status = 'EXCEPTION';
      severity = 'MCP';
      lines.push('governance ledger UNREACHABLE (:3004 no response)');
    } else {
      lines.push(`governance chain ${govChainValid ? 'valid' : 'INVALID'} · ${govEntries} entries · rules wired ${govRules}/6`);
      lines.push(`revoked devIDs: ${govRevoked}`);
      if (govChainValid !== true) {
        status = 'EXCEPTION';
        severity = 'MCP';
        lines.push('CHAIN INVALID — treat as a security event, not noise');
      }
      if (govDhPending > 0) {
        status = 'EXCEPTION';
        severity = 'MCP';
        lines.push(`${govDhPending} events awaiting operator verification (DH queue — mint the operator admin devID to clear)`);
      }
    }
    domains.push({ n: 1, code: 'MCP', name: 'MCP', status, severity, lines });
  }

  // ── domain 2 · Production / IVE ─────────────────────────────────────────
  {
    const lines: string[] = [];
    let status: DomainResult['status'] = 'GREEN';
    if (integrityMatch) lines.push(':3000 integrity MATCH');
    else {
      lines.push(':3000 integrity MISMATCH — running code differs from disk (deployment drift suspected)');
      status = 'EXCEPTION';
    }
    lines.push(t3 ? ':3003 telemetry UP' : ':3003 telemetry DOWN');
    if (!t3) status = 'EXCEPTION';
    lines.push(governance ? ':3004 vault-bridge UP' : ':3004 vault-bridge DOWN');
    if (!governance) status = 'EXCEPTION';
    lines.push(t5 ? ':3005 field-onboard UP' : ':3005 field-onboard DOWN');
    if (!t5) status = 'EXCEPTION';
    domains.push({ n: 2, code: 'PROD', name: 'Production / IVE', status, lines });
  }

  // ── domain 3 · Customer / user activity — NOT_INSTRUMENTED ──────────────
  domains.push({
    n: 3,
    code: 'CUST',
    name: 'Customer / user activity',
    status: 'NOT_INSTRUMENTED',
    lines: ['0 paying customers · 0 users — nothing exists to monitor yet (first customer onboarding brings this domain live)'],
  });

  // ── domain 4 · Sales — NOT_INSTRUMENTED ─────────────────────────────────
  domains.push({
    n: 4,
    code: 'SALES',
    name: 'Sales',
    status: 'NOT_INSTRUMENTED',
    lines: ['no inbound channel instrumented · five Day-1 emails DRAFT — NOT SENT · follow-ups due: none (nothing sent)'],
  });

  // ── domain 5 · Commercial — NOT_INSTRUMENTED ────────────────────────────
  domains.push({
    n: 5,
    code: 'COMM',
    name: 'Commercial',
    status: 'NOT_INSTRUMENTED',
    lines: ['no invoices issued · no subscriptions · 0 paying customers (honest count)'],
  });

  // ── domain 6 · Security ─────────────────────────────────────────────────
  {
    const lines: string[] = [];
    let status: DomainResult['status'] = 'GREEN';
    lines.push(`receipts chain: ${receiptsCount} receipts${receipts ? '' : ' — UNREACHABLE'}`);
    lines.push(`integrity file-watch: ${integrityMatch ? 'no unexpected changes' : 'MISMATCH'}`);
    if (!receipts) status = 'EXCEPTION';
    if (integrityMatch === false) {
      status = 'EXCEPTION';
      lines.push('unexpected file change in watched production files — investigate before anything else');
    }
    domains.push({ n: 6, code: 'SEC', name: 'Security', status, lines });
  }

  // ── domain 7 · Evidence ─────────────────────────────────────────────────
  {
    const lines: string[] = [];
    let status: DomainResult['status'] = 'GREEN';
    lines.push(`WORM ledger: ${wormCount.toLocaleString()} events · chain ${wormChainValid ? 'valid' : 'INVALID'}`);
    lines.push(`governance ledger: ${govEntries} entries · chain ${govChainValid ? 'valid' : 'INVALID'}`);
    lines.push(`receipts issued: ${receiptsCount}`);
    if (!wormChainValid) {
      status = 'EXCEPTION';
      lines.push('WORM chain INVALID — evidence integrity cannot be asserted');
    }
    domains.push({ n: 7, code: 'EVID', name: 'Evidence', status, lines });
  }

  // ── domain 8 · Action queue (derived from 1–7) ──────────────────────────
  {
    const lines: string[] = [];
    const exceptions = domains.filter((d) => d.status === 'EXCEPTION');
    if (exceptions.length === 0) {
      lines.push('no safe-issue auto-resolution needed; nothing consequential to queue; nothing to escalate');
    } else {
      for (const d of exceptions) {
        lines.push(`ESCALATE → ${d.code}: ${d.lines.join(' · ')}`);
      }
      lines.push('canonical state untouched — the sweep observes and reports, it never modifies');
    }
    if (govDhPending > 0) {
      lines.push(`${govDhPending} MCP-pending items stand (DH queue) — operator action, never auto-cleared`);
    }
    domains.push({ n: 8, code: 'QUEUE', name: 'Action queue', status: exceptions.length > 0 ? 'EXCEPTION' : 'GREEN', lines });
  }

  // ── verdict + notification block (exception-only, operator format) ──────
  const hasExceptions = domains.some((d) => d.status === 'EXCEPTION');
  const verdict: SweepResult['verdict'] = hasExceptions ? 'ACTION REQUIRED' : 'GREEN';
  const mcp = domains.find((d) => d.code === 'MCP');
  const sec = domains.find((d) => d.code === 'SEC');

  let notification: string;
  if (!hasExceptions) {
    notification = 'GREEN\nNothing requires attention.';
  } else if (sec?.status === 'EXCEPTION') {
    const secLines = sec.lines.filter((l) => /MISMATCH|UNREACHABLE|unexpected/i.test(l));
    notification = `SECURITY\n${secLines.length ? secLines.join('\n') : 'Security check failed.'}`;
  } else if (mcp?.status === 'EXCEPTION') {
    const mcpLines = mcp.lines.filter((l) => /awaiting|INVALID|UNREACHABLE/i.test(l));
    notification = `MCP\n${mcpLines.length ? mcpLines.join('\n') : 'MCP check failed.'}`;
  } else {
    const excLines = domains.filter((d) => d.status === 'EXCEPTION').flatMap((d) => d.lines).slice(0, 3);
    notification = `ACTION REQUIRED\n${excLines.join('\n')}`;
  }

  const ranAt = new Date().toISOString();

  // ── WORM receipt for the sweep run itself ────────────────────────────────
  let wormReceiptId: string | undefined;
  try {
    const entry = await appendWormEvent({
      source: 'OPS',
      event: 'OPS_SWEEP',
      details: `${verdict} · ${domains.filter((d) => d.status === 'EXCEPTION').length} exceptions · dh-pending ${govDhPending} · worm ${wormCount} · receipts ${receiptsCount}`,
    });
    wormReceiptId = entry.id;
  } catch {
    wormReceiptId = undefined; // honest: the sweep still returns; the receipt failed and says so by its absence
  }

  const result: SweepResult = {
    ranAt,
    verdict,
    domains,
    notification,
    wormReceiptId,
    durationMs: Date.now() - started,
  };

  return NextResponse.json(result, { status: 200 });
}
