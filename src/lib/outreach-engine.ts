// src/lib/outreach-engine.ts — Round 17 · SEQUENCE ENGINE core (SERVER ONLY).
// Multi-step outreach cadences with per-contact AI personalisation.
//
// SECURITY POSTURE (deliberate deviation from the "another assistant" plan):
//  · NO NEXT_PUBLIC_* API KEYS — client-exposed keys are exactly how tokens
//    got burned in earlier rounds. AI generation runs HERE, on the server,
//    via z-ai-web-dev-sdk; Resend stays in the send routes reading env only.
//    The API surface only ever reports booleans (aiAvailable / source).
//  · Fallback: if the LLM is unavailable/slow/misbehaving we compose a
//    deterministic template draft — the engine never blocks on AI.
//  · Content guard: the LLM is instructed to use ONLY verifiable VVU facts;
//    output is length-capped and HTML-escaped downstream (outreach-template).

import ZAI from 'z-ai-web-dev-sdk';

// ─── Step / sequence contracts ──────────────────────────────────────────────

export interface SequenceStep {
  /** cadence day (1..30) — when this step should go out */
  day: number;
  /** subject line; {org} / {name} placeholders are substituted */
  subject: string;
  /** the brief for the AI writer — what this step is about */
  angle: string;
}

export interface SequenceRecord {
  id: string;
  name: string;
  steps: SequenceStep[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export const MAX_STEPS = 7;
export const SUBJECT_MAX = 78;
export const ANGLE_MAX = 300;
export const NAME_MAX = 60;

/** Strict parse+validate of stepsJson → SequenceStep[] (throws on bad shape). */
export function parseSteps(stepsJson: string): SequenceStep[] {
  let raw: unknown;
  try {
    raw = JSON.parse(stepsJson);
  } catch {
    throw new Error('stepsJson is not valid JSON');
  }
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('steps must be a non-empty array');
  }
  if (raw.length > MAX_STEPS) {
    throw new Error(`too many steps — max ${MAX_STEPS}`);
  }
  const steps: SequenceStep[] = [];
  raw.forEach((s, i) => {
    if (typeof s !== 'object' || s === null) {
      throw new Error(`step ${i + 1} is not an object`);
    }
    const o = s as Record<string, unknown>;
    const day = Number(o.day);
    const subject = typeof o.subject === 'string' ? o.subject.trim() : '';
    const angle = typeof o.angle === 'string' ? o.angle.trim() : '';
    if (!Number.isInteger(day) || day < 1 || day > 30) {
      throw new Error(`step ${i + 1}: day must be an integer 1–30`);
    }
    if (!subject || subject.length > SUBJECT_MAX) {
      throw new Error(`step ${i + 1}: subject required, ≤ ${SUBJECT_MAX} chars`);
    }
    if (!angle || angle.length > ANGLE_MAX) {
      throw new Error(`step ${i + 1}: angle required, ≤ ${ANGLE_MAX} chars`);
    }
    steps.push({ day, subject, angle });
  });
  // cadence days must be strictly increasing
  for (let i = 1; i < steps.length; i++) {
    if (steps[i].day <= steps[i - 1].day) {
      throw new Error(`step ${i + 1}: day must be greater than step ${i} (day ${steps[i - 1].day})`);
    }
  }
  return steps;
}

export function serializeSequence(row: {
  id: string;
  name: string;
  stepsJson: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}): SequenceRecord {
  return {
    id: row.id,
    name: row.name,
    steps: parseSteps(row.stepsJson), // validated on write; safe on read
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ─── Status pipeline (kanban) ───────────────────────────────────────────────

/** Canonical forward pipeline. PREVIEWED/CONTACTED are Round-14 legacy states
 *  surfaced inside the SENT lane; BLOCKED is terminal (POPIA refusal). */
export const PIPELINE = ['NEW', 'SENT', 'OPENED', 'REPLIED', 'MEETING', 'PILOT', 'CLOSED'] as const;
export type PipelineStatus = (typeof PIPELINE)[number];
export const ALL_STATUSES = [...PIPELINE, 'PREVIEWED', 'CONTACTED', 'BLOCKED'] as const;
export const NEXT_STATUS: Record<string, string> = {
  NEW: 'SENT',
  PREVIEWED: 'SENT',
  CONTACTED: 'OPENED',
  SENT: 'OPENED',
  OPENED: 'REPLIED',
  REPLIED: 'MEETING',
  MEETING: 'PILOT',
  PILOT: 'CLOSED',
};

// ─── AI personalisation ─────────────────────────────────────────────────────

export type DraftSource = 'ai' | 'template';

export interface PersonalisedDraft {
  subject: string;
  /** plain text; blank-line-separated paragraphs */
  bodyText: string;
  source: DraftSource;
}

export interface DraftTarget {
  contactName: string;
  org: string;
  criticalIssue?: string | null;
}

const AI_TIMEOUT_MS = 30_000;
const BODY_MAX = 2500;

const SYSTEM_PROMPT = `You are the outreach copywriter for Venture Vision Ubuntu (VVU Enterprise), a South African water-infrastructure verification company.
Write plain-text B2B emails. Tone: warm, professional, confident. Never oversell — let the facts speak.
HARD RULES:
- Use ONLY these verifiable facts, and only when relevant: B-BBEE Level 1 Contributor (135% procurement recognition); CIPC Reg. 2026/259053/07 (Active); R5,000 fixed-price 30-day pilot (excl. VAT); R30,000/month full licence after 3 successful verifications (3 nodes); 30-second supplier verification; POPIA-compliant SHA-256 WORM audit ledger; City Digital Twin GIS with edge-AI leak, pressure-head and thermal anomaly monitoring.
- NEVER invent figures, awards, clients, testimonials, dates or claims.
- Under 150 words. No markdown, no subject line, no sign-off name (the template adds one).
- End with exactly ONE question that invites a reply.`;

function sanitiseBody(text: string): string {
  const cleaned = text
    .replace(/\r\n/g, '\n')
    .replace(/```[\s\S]*?```/g, '') // fenced blocks
    .replace(/^#+\s*/gm, '') // markdown headers
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1') // bold/italic
    .replace(/\s{3,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return cleaned.slice(0, BODY_MAX);
}

function fill(text: string, t: DraftTarget): string {
  return text
    .replace(/\{name\}/g, t.contactName)
    .replace(/\{org\}/g, t.org)
    .replace(/\{issue\}/g, t.criticalIssue?.trim() || 'supplier verification risk');
}

/** Deterministic fallback draft — same skeleton the AI is briefed on. */
function templateDraft(t: DraftTarget, step: SequenceStep, stepNumber: number, stepCount: number): PersonalisedDraft {
  const name = t.contactName.split(' ')[0] || t.contactName;
  const issue = t.criticalIssue?.trim();
  const paragraphs: string[] = [];
  if (stepNumber === 1) {
    paragraphs.push(
      `I'm reaching out from Venture Vision Ubuntu (VVU Enterprise) — we build POPIA-compliant water-infrastructure intelligence, giving municipalities and industrial water operators live leak, pressure and thermal visibility through a City Digital Twin GIS bench.`
    );
    if (issue) {
      paragraphs.push(
        `Based on your public procurement profile, we believe we can directly address ${issue} — ${t.org}'s teams can verify a supplier in 30 seconds against a SHA-256 WORM audit ledger.`
      );
    }
  } else {
    paragraphs.push(
      `Following up on my earlier note about VVU Enterprise for ${t.org} (step ${stepNumber} of ${stepCount}): ${fill(step.angle, t)}.`
    );
  }
  paragraphs.push(
    `We are a Level 1 B-BBEE contributor (135% procurement recognition) and our R5,000 fixed-price 30-day pilot maps the digital twin to your network anchor points — clear scope, no hidden fees.`
  );
  paragraphs.push(
    stepNumber === stepCount
      ? `Would a 20-minute call this week be the simplest way to see whether the pilot fits ${t.org}?`
      : `Is this worth 20 minutes for ${t.org} this week, ${name}?`
  );
  return { subject: fill(step.subject, t), bodyText: paragraphs.join('\n\n'), source: 'template' };
}

/**
 * Generate the personalised draft for one step of one contact.
 * Tries the server-side LLM (z-ai-web-dev-sdk) with a hard timeout; any
 * failure falls back to the deterministic template — callers never block.
 */
export async function generatePersonalised(input: {
  target: DraftTarget;
  step: SequenceStep;
  stepNumber: number;
  stepCount: number;
  previousSubjects: string[];
}): Promise<PersonalisedDraft> {
  const { target, step, stepNumber, stepCount, previousSubjects } = input;
  const fallback = templateDraft(target, step, stepNumber, stepCount);

  try {
    const zai = await ZAI.create();
    const userPrompt = [
      `Write step ${stepNumber} of ${stepCount} of an outreach sequence.`,
      ``,
      `CONTACT`,
      `Name: ${target.contactName}`,
      `Organisation: ${target.org}`,
      target.criticalIssue?.trim() ? `Most critical issue (from their public procurement profile): ${target.criticalIssue.trim()}` : `Most critical issue: unknown — keep it generic.`,
      ``,
      `THIS STEP`,
      `Cadence day: ${step.day}`,
      `Brief / angle: ${fill(step.angle, target)}`,
      `Suggested subject (use exactly): ${fill(step.subject, target)}`,
      previousSubjects.length > 0
        ? `Subjects already sent (do NOT repeat their content):\n- ${previousSubjects.join('\n- ')}`
        : `No previous emails sent to this contact.`,
      ``,
      `Respond with the email body ONLY (plain text, under 150 words, one closing question).`,
    ].join('\n');

    const completion = await Promise.race([
      zai.chat.completions.create({
        messages: [
          { role: 'assistant', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        thinking: { type: 'disabled' },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('AI timeout')), AI_TIMEOUT_MS)
      ),
    ]);

    const body = sanitiseBody(completion.choices[0]?.message?.content ?? '');
    if (body.split(/\s+/).length < 25) {
      return fallback; // too thin to trust — use the deterministic draft
    }
    return { subject: fill(step.subject, target), bodyText: body, source: 'ai' };
  } catch {
    return fallback;
  }
}
