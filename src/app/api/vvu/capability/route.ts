import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { appendWormEvent, verifyChain } from '@/lib/vvu-ledger';
import {
  BBEEE_OPTIONS,
  DEFAULT_PROFILE,
  PILOT_DECLARATIONS,
  PROVENANCE_TABLE,
  SA_PROVINCES,
  composeCapabilityStatement,
} from '@/lib/capability';
import type { CapabilityFacts, CapabilityProfile, CapabilityResponse, CapabilityStatementResult } from '@/types/vvu';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// /api/vvu/capability — Round 22 CAPABILITY DOSSIER backing route.
//   GET  → operator profile + live system facts (service probes, WORM chain
//          verification, table counts, the honest provenance table).
//   PUT  → validate + upsert the operator profile (WORM CAPABILITY_PROFILE_SAVED).
//   POST → { action: 'generate' } composes the capability statement SERVER-SIDE
//          from the stored profile + fresh facts and WORM-logs the generation
//          (client-composed markdown is never trusted on write).
//
// The system facts are deliberately not editable: the dashboard answers the
// procurement questions with live probes, not with operator claims.

type ProfileRow = {
  entityName: string;
  tradingAs: string;
  vividIsTranscription: boolean;
  province: string | null;
  csdRegistered: boolean;
  sitaRegistered: boolean;
  provincialRegistered: boolean;
  vatRegistered: boolean;
  bbbeeLevel: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  pilotDeclaration: string;
  notes: string | null;
  updatedAt: Date;
};

function serializeProfile(row: ProfileRow | null): CapabilityProfile {
  if (!row) return { ...DEFAULT_PROFILE };
  return {
    entityName: row.entityName,
    tradingAs: row.tradingAs,
    vividIsTranscription: row.vividIsTranscription,
    province: (SA_PROVINCES as readonly string[]).includes(row.province ?? '')
      ? (row.province as CapabilityProfile['province'])
      : null,
    csdRegistered: row.csdRegistered,
    sitaRegistered: row.sitaRegistered,
    provincialRegistered: row.provincialRegistered,
    vatRegistered: row.vatRegistered,
    bbbeeLevel: (BBEEE_OPTIONS as readonly string[]).includes(row.bbbeeLevel ?? '')
      ? (row.bbbeeLevel as CapabilityProfile['bbbeeLevel'])
      : null,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    pilotDeclaration: (PILOT_DECLARATIONS as readonly string[]).includes(row.pilotDeclaration)
      ? (row.pilotDeclaration as CapabilityProfile['pilotDeclaration'])
      : 'SIMULATION_ONLY',
    notes: row.notes,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function readProfile(): Promise<CapabilityProfile> {
  const row = await db.capabilityProfile.findUnique({ where: { id: 'operator' } });
  return serializeProfile(row);
}

/** Liveness probe: any HTTP answer (even 4xx/5xx) means the port is LISTENING. */
async function probe(url: string, timeoutMs = 1500): Promise<boolean> {
  try {
    await fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' });
    return true;
  } catch {
    return false;
  }
}

async function gatherFacts(): Promise<CapabilityFacts> {
  const [dashboardLive, telemetryLive, gatewayLive, worm, telemetry, wormCount, outreachTargets, outreachEmails, sequences, holoSamples] =
    await Promise.all([
      probe('http://127.0.0.1:3000/api/vvu/db-stats'),
      probe('http://127.0.0.1:3003/socket.io/?EIO=4&transport=polling'),
      probe('http://127.0.0.1:81/'),
      verifyChain(),
      db.telemetryLog.count(),
      db.wormEvent.count(),
      db.outreachTarget.count(),
      db.outreachEmail.count(),
      db.outreachSequence.count(),
      db.holoQoeSample.count(),
    ]);

  return {
    generatedAt: new Date().toISOString(),
    services: [
      {
        key: 'dashboard',
        label: 'VVU dashboard · Next.js dev',
        endpoint: '127.0.0.1:3000',
        live: dashboardLive,
        detail: 'this API answering is the probe',
      },
      {
        key: 'telemetry',
        label: 'Telemetry simulator · socket.io',
        endpoint: '127.0.0.1:3003',
        live: telemetryLive,
        detail: 'Gqeberha edge-node SIMULATOR (synthetic frames)',
      },
      {
        key: 'gateway',
        label: 'Gateway · caddy',
        endpoint: '127.0.0.1:81',
        live: gatewayLive,
        detail: 'browser QA entry point',
      },
    ],
    worm: { count: worm.count, chainValid: worm.chainValid, lastHash: worm.lastHash },
    counts: {
      telemetry,
      worm: wormCount,
      outreachTargets,
      outreachEmails,
      sequences,
      holoSamples,
    },
    provenance: [...PROVENANCE_TABLE],
    // Hard fact: the stack has no SCADA ingestion path — nothing to connect to.
    scadaLive: false as const,
  };
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const [profile, facts] = await Promise.all([readProfile(), gatherFacts()]);
    const body: CapabilityResponse = { profile, facts };
    return NextResponse.json(body);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}

// ─── PUT (profile save) ──────────────────────────────────────────────────────

const profileSchema = z.object({
  entityName: z.string().max(120),
  tradingAs: z.string().max(120),
  vividIsTranscription: z.boolean(),
  province: z.enum(SA_PROVINCES as unknown as [string, ...string[]]).nullable(),
  csdRegistered: z.boolean(),
  sitaRegistered: z.boolean(),
  provincialRegistered: z.boolean(),
  vatRegistered: z.boolean(),
  bbbeeLevel: z.enum(BBEEE_OPTIONS as unknown as [string, ...string[]]).nullable(),
  contactEmail: z
    .string()
    .max(160)
    .refine((v) => !v || /.+@.+\..+/.test(v), 'invalid email')
    .nullable(),
  contactPhone: z
    .string()
    .max(40)
    .refine((v) => !v || /^[+\d][\d\s()-]{5,}$/.test(v), 'invalid phone')
    .nullable(),
  pilotDeclaration: z.enum(PILOT_DECLARATIONS as unknown as [string, ...string[]]),
  notes: z.string().max(2000).nullable(),
});

export async function PUT(request: Request) {
  try {
    const raw = (await request.json()) as unknown;
    const parsed = profileSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_FAILED', issues: parsed.error.issues.map((i) => `${i.path.join('.') || 'root'}: ${i.message}`) },
        { status: 422 }
      );
    }
    const v = parsed.data;
    const data = {
      id: 'operator',
      entityName: v.entityName.trim(),
      tradingAs: v.tradingAs.trim(),
      vividIsTranscription: v.vividIsTranscription,
      province: v.province,
      csdRegistered: v.csdRegistered,
      sitaRegistered: v.sitaRegistered,
      provincialRegistered: v.provincialRegistered,
      vatRegistered: v.vatRegistered,
      bbbeeLevel: v.bbbeeLevel,
      contactEmail: v.contactEmail?.trim() ? v.contactEmail.trim() : null,
      contactPhone: v.contactPhone?.trim() ? v.contactPhone.trim() : null,
      pilotDeclaration: v.pilotDeclaration,
      notes: v.notes?.trim() ? v.notes.trim() : null,
    };
    const row = await db.capabilityProfile.upsert({ where: { id: 'operator' }, create: data, update: data });
    const profile = serializeProfile(row);

    const entry = await appendWormEvent({
      source: 'CAPABILITY',
      event: 'CAPABILITY_PROFILE_SAVED',
      details: `entity=${profile.entityName || 'unset'} · province=${profile.province ?? 'unset'} · bbbee=${profile.bbbeeLevel ?? 'unset'} · csd=${profile.csdRegistered ? 'Y' : 'N'} · sita=${profile.sitaRegistered ? 'Y' : 'N'} · pilot=${profile.pilotDeclaration}`,
    });

    return NextResponse.json({ profile, wormSeq: entry.seq });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}

// ─── POST (statement generation — server-authoritative) ─────────────────────

const postSchema = z.object({ action: z.literal('generate') });

export async function POST(request: Request) {
  try {
    const parsed = postSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'UNKNOWN_ACTION', expected: "POST { action: 'generate' }" }, { status: 422 });
    }
    const [profile, facts] = await Promise.all([readProfile(), gatherFacts()]);
    const markdown = composeCapabilityStatement(profile, facts);
    const entry = await appendWormEvent({
      source: 'CAPABILITY',
      event: 'CAPABILITY_STATEMENT_GENERATED',
      details: `chars=${markdown.length} · entity=${profile.entityName || 'unset'} · province=${profile.province ?? 'unset'} · scadaLive=false`,
    });
    const body: CapabilityStatementResult = {
      markdown,
      wormSeq: entry.seq,
      generatedAt: facts.generatedAt,
      charCount: markdown.length,
    };
    return NextResponse.json(body);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}
