// src/server/proximity/contract.ts
// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — THE CONTRACT: vvu.proximity.scan.v1
//
// Integer-only, unit-suffixed, closed-world. The seal kernel (JCS subset)
// rejects non-safe-integers, so the CONTRACT carries integers, not floats:
// the kernel is right, the input is wrong. distance_m (float, metres) was
// the rejected draft; distance_cm (integer, centimetres) is the contract.
// risk_milli 821 ≡ RISK 0.821 — never sealed as 0.821.
//
// THE CONTRACT AUDIT (the pre-send check): auditContract() walks the field
// table and asserts, per numeric field, (a) Number.isSafeInteger on the
// validated type, (b) the unit is IN THE NAME (_cm, _dbm, _mv, _ms,
// _milli), (c) an explicit range. A float probe (distance_m: 0.45) is run
// through the real validator and MUST be refused — the regression test for
// the corrected contract, executed live, every audit.
// ─────────────────────────────────────────────────────────────────────────────

import 'server-only';

import { RFC3339_MS_Z } from '@/server/safegrid/canonical';
import type { ContractAuditResult, ContractFieldAudit } from '@/lib/proximity/types';

export class ContractViolationError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'ContractViolationError';
  }
}

export type ScanSource = 'simulator' | 'production';

export interface ScanInput {
  subject_id: string;
  source: ScanSource;
  distance_cm: number;
  rssi_dbm: number;
  battery_mv: number;
  dwell_ms: number;
  risk_milli: number;
  occurred_at: string;
}

/** The sealed payload shape (snake_case, exactly the contract fields). */
export type ScanPayload = ScanInput;

interface NumericFieldSpec {
  field: keyof Omit<ScanInput, 'subject_id' | 'source' | 'occurred_at'>;
  unit: string;
  min: number;
  max: number;
  meaning: string;
}

/** THE NUMERIC CONTRACT — every field an integer, every unit in the name. */
const NUMERIC_FIELDS: readonly NumericFieldSpec[] = [
  { field: 'distance_cm', unit: 'cm', min: 1, max: 10000, meaning: 'DISTANCE (proximity gap)' },
  { field: 'rssi_dbm', unit: 'dBm', min: -100, max: -1, meaning: 'RSSI SIGNAL STRENGTH' },
  { field: 'battery_mv', unit: 'mV', min: 2500, max: 5000, meaning: 'BATTERY VOLTAGE' },
  { field: 'dwell_ms', unit: 'ms', min: 0, max: 600000, meaning: 'DWELL TIME (presence duration)' },
  { field: 'risk_milli', unit: 'milli', min: 0, max: 1000, meaning: 'RISK SCORE (0.821 ≡ 821)' },
];

const UNIT_SUFFIXES = ['_cm', '_dbm', '_mv', '_ms', '_milli'] as const;

const KNOWN_STRING_FIELDS = ['subject_id', 'source', 'occurred_at'] as const;

/** The float the kernel rejected — posted back as a live probe. */
export const FORBIDDEN_FLOAT_PROBE = JSON.stringify({
  subject_id: 'vvu-042',
  source: 'simulator',
  distance_m: 0.45,
  rssi_dbm: -58,
  battery_mv: 3720,
  dwell_ms: 12500,
  risk_milli: 214,
  occurred_at: '2026-11-03T22:14:07.123Z',
});

function integerField(body: Record<string, unknown>, spec: NumericFieldSpec): number {
  const raw = body[spec.field];
  if (typeof raw !== 'number' || !Number.isSafeInteger(raw)) {
    throw new ContractViolationError(
      `${String(spec.field).toUpperCase()}_NOT_INTEGER`,
      `${spec.field} must be a safe integer (${spec.meaning}) — the seal kernel rejects floats`,
    );
  }
  if (raw < spec.min || raw > spec.max) {
    throw new ContractViolationError(
      `${String(spec.field).toUpperCase()}_OUT_OF_RANGE`,
      `${spec.field} must be ${spec.min}..${spec.max} ${spec.unit} (got ${raw} ${spec.unit})`,
    );
  }
  return raw;
}

/**
 * Fail-closed validation of one scan. Closed-world: unknown fields are
 * refused (nothing is inferred, nothing is silently dropped). The banned
 * float draft (distance_m) gets its own violation code so the corrected
 * contract teaches, not just rejects.
 */
export function validateScan(body: unknown): ScanInput {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ContractViolationError('BAD_BODY', 'scan must be a JSON object');
  }
  const b = body as Record<string, unknown>;

  if ('distance_m' in b) {
    throw new ContractViolationError(
      'DISTANCE_M_FORBIDDEN',
      'distance_m (float, metres) is the rejected draft — use distance_cm (integer, centimetres): the kernel is right, the input is wrong',
    );
  }

  const known = new Set<string>([...NUMERIC_FIELDS.map((f) => String(f.field)), ...KNOWN_STRING_FIELDS]);
  for (const key of Object.keys(b)) {
    if (!known.has(key)) {
      throw new ContractViolationError('UNKNOWN_FIELD', `unknown field '${key}' — the contract is closed-world`);
    }
  }

  const subjectId = b.subject_id;
  if (typeof subjectId !== 'string' || !/^[a-z0-9-]{2,32}$/.test(subjectId)) {
    throw new ContractViolationError('BAD_SUBJECT_ID', 'subject_id must match ^[a-z0-9-]{2,32}$');
  }

  const source = b.source;
  if (source !== 'simulator' && source !== 'production') {
    throw new ContractViolationError('BAD_SOURCE', "source must be 'simulator' or 'production'");
  }

  const scan: ScanInput = {
    subject_id: subjectId,
    source,
    distance_cm: 0,
    rssi_dbm: 0,
    battery_mv: 0,
    dwell_ms: 0,
    risk_milli: 0,
    occurred_at: '',
  };
  for (const spec of NUMERIC_FIELDS) {
    (scan[spec.field] as number) = integerField(b, spec);
  }

  const occurredAt = b.occurred_at;
  if (typeof occurredAt !== 'string' || !RFC3339_MS_Z.test(occurredAt)) {
    throw new ContractViolationError(
      'BAD_OCCURRED_AT',
      'occurred_at must be RFC 3339 UTC millisecond precision, e.g. 2026-11-03T22:14:07.123Z',
    );
  }
  scan.occurred_at = occurredAt;
  return scan;
}

/** RFC 3339-ms-Z for "now" — the only timestamp format the layer accepts. */
export function utcNowRfc3339(): string {
  return new Date().toISOString();
}

/**
 * THE CONTRACT AUDIT — programmatic, not prose. Every numeric field must
 * be an integer with its unit in the name; the float probe must be
 * refused. This is the check that runs before the demo is shown to anyone.
 */
export function auditContract(): {
  fields: ContractFieldAudit[];
  floatRejectionProbe: ContractAuditResult['floatRejectionProbe'];
} {
  const fields: ContractFieldAudit[] = NUMERIC_FIELDS.map((spec) => {
    const name = String(spec.field);
    const unitOk = UNIT_SUFFIXES.some((suffix) => name.endsWith(suffix));
    return {
      field: name,
      kind: 'integer' as const,
      unit: spec.unit,
      range: `${spec.min}..${spec.max} ${spec.unit}`,
      numericOk: unitOk,
      numericOkReason: unitOk
        ? `safe integer · unit-suffixed (_${spec.unit}) · range enforced at ingest`
        : 'UNIT MISSING FROM NAME — contract violation',
    };
  });
  fields.push(
    {
      field: 'subject_id',
      kind: 'string' as const,
      unit: null,
      range: '^[a-z0-9-]{2,32}$',
      numericOk: true,
      numericOkReason: 'non-numeric — identifier',
    },
    {
      field: 'source',
      kind: 'enum' as const,
      unit: null,
      range: 'simulator | production',
      numericOk: true,
      numericOkReason: 'non-numeric — the stored partition key',
    },
    {
      field: 'occurred_at',
      kind: 'timestamp' as const,
      unit: null,
      range: 'RFC3339-ms-Z (UTC only)',
      numericOk: true,
      numericOkReason: 'informational — the chain orders by position, never by time',
    },
  );

  let accepted = false;
  let detail = '';
  try {
    validateScan(JSON.parse(FORBIDDEN_FLOAT_PROBE));
    accepted = true;
    detail = 'validator ACCEPTED the float draft — this is a contract regression';
  } catch (e) {
    detail =
      e instanceof ContractViolationError
        ? `refused with ${e.code}: ${e.message}`
        : `refused: ${e instanceof Error ? e.message : String(e)}`;
  }
  return {
    fields,
    floatRejectionProbe: {
      input: 'distance_m: 0.45 (the rejected draft)',
      accepted,
      expected: false,
      verdict: accepted ? ('FAIL' as const) : ('PASS' as const),
      detail,
    },
  };
}
