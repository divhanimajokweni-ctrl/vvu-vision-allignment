'use client';

// src/components/manifest/ManifestWorkspace.tsx — ROUND 30 · eleventh projection
// #/manifest — ESTATE MANIFEST & EIS v1.0.
//
// This projection answers the operator's field question directly: the
// concepts EIS v1.0, the Zero Fabrication Rule, the Shared Spine / 11-field
// canonical payload and the mandatory UI footer mandate were described by a
// prior session whose artifacts were NOT PERSISTED to this repo. That is why
// an external notebook AI, reading the uploaded sources, correctly reported
// it could not find them: they existed only in lost session narrative.
//
// This view codifies them as SPECIFICATION with per-field provenance
// (AS-BUILT with code references vs SPEC layer), plus:
//   · REGRESSION LEDGER — what the prior session claimed vs what the repo
//     actually held vs what this round rebuilt
//   · ESTATE INVENTORY — tiles verified against the live repo (projections,
//     the 14 canonical components, mini-services, docs)
//
// Zero Fabrication Rule applies to this view first of all: no tile here
// claims a status that cannot be pointed at.

import { useEffect, useState } from 'react';
import {
  AlertOctagon,
  Archive,
  Boxes,
  FileWarning,
  Footprints,
  GitCommitHorizontal,
  Layers,
  Radar,
  ScrollText,
  ShieldCheck,
} from 'lucide-react';
import { Chip, SectionHeader, SectionReveal } from '@/components/analytics/shared';
import { useSendWormLog } from '@/hooks/use-vvu-socket';
import { cn } from '@/lib/utils';

// ─── EIS v1.0 — Evidence Independence Specification ──────────────────────────
// Field-level provenance: AS-BUILT fields exist in code today (referenced);
// SPEC fields are rule-layer commitments documented but not yet enforced by
// a runtime.

interface SpineField {
  n: number;
  field: string;
  layer: 'AS-BUILT' | 'SPEC';
  where: string;
  purpose: string;
}

const SHARED_SPINE: SpineField[] = [
  { n: 1, field: 'seq', layer: 'AS-BUILT', where: 'WormEvent.seq · WormSimEvent.seq (types/vvu.ts:88)', purpose: 'Monotonic sequence — total order of the chain' },
  { n: 2, field: 'ts', layer: 'AS-BUILT', where: 'WormSimEvent.ts · WormEvent.createdAt', purpose: 'Timestamp — when the event was emitted' },
  { n: 3, field: 'source', layer: 'AS-BUILT', where: 'WormEvent.source (both representations)', purpose: 'Emitting component — who wrote it' },
  { n: 4, field: 'event', layer: 'AS-BUILT', where: 'WormEvent.event', purpose: 'Event kind — ROUTE_TOGGLE, VIEW_MODE, COMMERCIAL_COPY…' },
  { n: 5, field: 'details', layer: 'AS-BUILT', where: 'WormEvent.details', purpose: 'Human-readable payload — what happened, in words' },
  { n: 6, field: 'prevHash', layer: 'AS-BUILT', where: 'WormEvent.prevHash', purpose: 'Back-link — binds this record to the entire past' },
  { n: 7, field: 'hash', layer: 'AS-BUILT', where: 'WormEvent.hash', purpose: 'SHA-256 of the record — tamper-evidence for this link' },
  { n: 8, field: 'id', layer: 'AS-BUILT', where: 'WormEvent.id (persisted rows only)', purpose: 'Persistent record id — DB identity for retrieval' },
  { n: 9, field: 'status', layer: 'SPEC', where: 'epistemic labels — OBSERVED/VERIFIED/PENDING/UNDEFINED/HYPOTHESIS/VISION', purpose: 'Epistemic state travels WITH the value — no unlabeled numbers' },
  { n: 10, field: 'provenance', layer: 'SPEC', where: 'rule layer — not yet a persisted column', purpose: 'Where the value CAME from — source-of-record chain distinct from emitter' },
  { n: 11, field: 'authority', layer: 'SPEC', where: 'rule layer — hard rule quote below', purpose: 'Who may act on this event — operator / pre-authorized automation / MCP-pending' },
];

const EIS_RULES = [
  {
    id: 'zero-fabrication',
    title: 'RULE 1 — ZERO FABRICATION',
    icon: ShieldCheck,
    text:
      'No component may present a fabricated value as observed. Every displayed number, status or claim carries provenance ' +
      'and an epistemic label (OBSERVED / VERIFIED / PENDING / UNDEFINED / HYPOTHESIS / VISION). A missing value renders as ' +
      'UNDEFINED — never as zero, never as a guess. Stubs are labelled stubs; simulations are labelled simulations.',
    grounding: 'Enforced today by convention across the projections (honesty ledger, TESTED/SPECIFIED/IN BUILD table in the offer doc).',
  },
  {
    id: 'shared-spine',
    title: 'RULE 2 — SHARED SPINE · 11-FIELD CANONICAL PAYLOAD',
    icon: Layers,
    text:
      'Every event in the estate flows one canonical structure — the 11 fields below. Fields 1–8 are AS-BUILT (the live ' +
      'WORM chain: 7 fields in-flight on :3003, 8 persisted in SQLite via Prisma). Fields 9–11 are the SPEC layer: the ' +
      'epistemic, provenance and authority envelope every event must carry before the estate will treat it as evidence.',
    grounding: 'AS-BUILT refs verified in code this round; SPEC fields are the codified target — not yet persisted columns.',
  },
  {
    id: 'footer-mandate',
    title: 'RULE 3 — MANDATORY UI FOOTER',
    icon: Footprints,
    text:
      'Every projection carries the same footer: live FSM state, WORM chain-tip sequence + SHA fragment, steady hours, MOI ' +
      'percentage. The footer is the trust oracle of the chassis — if it is missing, the view is not part of the estate. ' +
      'Sticky to the viewport bottom on short pages, pushed naturally on long ones, safe-area aware on mobile.',
    grounding: 'AS-BUILT — VvuFooter.tsx renders on all 11 projections (mt-auto + env(safe-area-inset-bottom)); verified this round.',
  },
];

const AUTOMOMY_RULE_QUOTE =
  '"Automation may observe, classify, notify, and execute pre-authorized safe actions. It does not silently invent authority."';

// ─── Regression ledger — the honest record ──────────────────────────────────

interface RegressionRow {
  claimed: string;
  repoState: string;
  action: 'REBUILT THIS ROUND' | 'DISCLOSED — NOT REBUILT' | 'NEVER EXISTED';
}

const REGRESSION_LEDGER: RegressionRow[] = [
  { claimed: '#/commercial projection (price card set, 5 email drafts, FS gate)', repoState: 'No component dir, no lib file, no commit', action: 'REBUILT THIS ROUND' },
  { claimed: 'Commercial data ledger src/lib/commercial-data.ts', repoState: 'File absent', action: 'REBUILT THIS ROUND' },
  { claimed: 'Self-contained QR station for field supply', repoState: 'No QR feature', action: 'REBUILT THIS ROUND' },
  { claimed: '#/manifest projection (93-tile inventory: 78 PROVEN / 11 READY / 4 BLOCKED)', repoState: 'No component dir; tile list not recoverable', action: 'REBUILT THIS ROUND' },
  { claimed: 'EIS v1.0 / Zero Fabrication Rule / Shared Spine 11-field / footer mandate as written spec', repoState: 'Concepts existed only in lost session narrative — hence the notebook AI finding "not present in sources"', action: 'REBUILT THIS ROUND' },
  { claimed: 'Commit bf13e79 (Task 44 delivery)', repoState: 'Commit does not exist in history', action: 'DISCLOSED — NOT REBUILT' },
  { claimed: 'vault-bridge mini-service (:3004, WORM receipts)', repoState: 'mini-services/ holds telemetry-service only', action: 'DISCLOSED — NOT REBUILT' },
  { claimed: 'field-onboard mini-service (:3005)', repoState: 'mini-services/ holds telemetry-service only', action: 'DISCLOSED — NOT REBUILT' },
  { claimed: 'WORM seq 9135 (commercial copy chain)', repoState: 'Live chain seq is lower; that number belonged to the lost timeline', action: 'NEVER EXISTED' },
];

// ─── Estate inventory — verified against the live repo this round ────────────

interface InventoryTile {
  name: string;
  status: 'PROVEN' | 'SPEC' | 'UNKNOWN' | 'ABSENT';
  note: string;
}

const PROJECTION_TILES: InventoryTile[] = [
  { name: '/ · SPATIAL_INTELLIGENCE', status: 'PROVEN', note: '3D mesh · tactical map · live :3003 telemetry — browser-verified this round' },
  { name: '#/analytics', status: 'PROVEN', note: 'Trust Gates 3A/3B/3C · MOI 70.66% · WORM ledger · B-BBEE' },
  { name: '#/outreach', status: 'PROVEN', note: 'Sequence engine · cadences · kanban · AI drafts' },
  { name: '#/holocom', status: 'PROVEN', note: '6G NeXt split computing · QoE · discovery' },
  { name: '#/urllc', status: 'PROVEN', note: 'URLLC+ neural edge · DL paradigms · AFDM lab' },
  { name: '#/capability', status: 'PROVEN', note: 'Procurement capability dossier' },
  { name: '#/metro', status: 'PROVEN', note: 'ProofBridge Metro · 8-bit node · five playable gates' },
  { name: '#/fieldkit', status: 'PROVEN', note: 'Campus walk · people notes · Q3 conditions' },
  { name: '#/support', status: 'PROVEN', note: 'Mk-I funding · 5-state DFA · SHA-256 receipts' },
  { name: '#/commercial', status: 'PROVEN', note: 'REBUILT THIS ROUND — 17 cards · QR station · 5 drafts · FS gate' },
  { name: '#/manifest', status: 'PROVEN', note: 'THIS VIEW — EIS v1.0 · regression ledger · inventory' },
];

const COMPONENT_TILES: InventoryTile[] = [
  { name: 'Receipts / WORM spine', status: 'PROVEN', note: 'TESTED — lab-verified over 7,100+ records (offer doc status table)' },
  { name: 'Harness (adversarial)', status: 'SPEC', note: 'Capitec harness JSON exists; executable runner not retained' },
  { name: 'Epistemic Runtime', status: 'SPEC', note: 'L6–L9 bench layers viewable; runtime formalisation pending' },
  { name: 'Krypt (private moat)', status: 'SPEC', note: 'Collision krypt-vs-krypte documented — REPORTED, NOT RENAMED' },
  { name: 'IVE / Trust OS', status: 'SPEC', note: 'Deliberately unbuilt per evidence-first policy' },
  { name: 'AIR', status: 'SPEC', note: 'SIMULATION-ONLY fact-check label — no runtime' },
  { name: 'Liner', status: 'SPEC', note: 'ProofBridge-Liner identity — no standalone build' },
  { name: 'Spec / Adapters', status: 'SPEC', note: 'Architecture-level only' },
  { name: 'Node Mk0 / Mk0.5 / MkI', status: 'SPEC', note: 'Hardware list + prices (R491 / R1,671 / R2,769/R13,479); zero deployed' },
  { name: 'WATCHDOG', status: 'UNKNOWN', note: 'Nearest analog: the :3003 telemetry simulator' },
  { name: 'EIS', status: 'SPEC', note: 'Codified THIS ROUND on this view — runtime enforcement pending' },
  { name: 'SEARM', status: 'UNKNOWN', note: 'Keyword-only presence (layout metadata); zero implementation' },
  { name: 'STUDI', status: 'UNKNOWN', note: 'Zero hits workspace-wide' },
];

const SERVICE_TILES: InventoryTile[] = [
  { name: 'telemetry-service · :3003', status: 'PROVEN', note: 'socket.io simulator — LISTENING (verified ss -ltnp)' },
  { name: 'vault-bridge · :3004', status: 'ABSENT', note: 'Claimed by the lost session — never present in this repo' },
  { name: 'field-onboard · :3005', status: 'ABSENT', note: 'Claimed by the lost session — never present in this repo' },
  { name: 'Caddy gateway · :81', status: 'PROVEN', note: 'Sole public entry; XTransformPort routing for mini-services' },
];

const DOC_TILES: InventoryTile[] = [
  { name: 'blockchain-detection-offer.md', status: 'PROVEN', note: 'v0.1 DRAFT · 15 Sep 2026 — the surviving commercial source of record' },
  { name: 'DOCUMENTATION.md', status: 'PROVEN', note: '9 sources compiled verbatim (Round 31 consolidation)' },
  { name: 'PROOFBRIDGE_COMPILED_RUNNER_WITH_DISCOVERY.md', status: 'PROVEN', note: 'Phase-0 discovery + 14-component map + hardware prices' },
  { name: 'worklog.md', status: 'PROVEN', note: 'Tasks 1–35 persisted; the lost session added no entry (gap recorded)' },
];

const STATUS_TONE: Record<InventoryTile['status'], string> = {
  PROVEN: 'border-[rgba(200,255,0,0.4)] text-[#c8ff00]',
  SPEC: 'border-[rgba(243,227,138,0.4)] text-[#f3e38a]',
  UNKNOWN: 'border-dashed border-[rgba(229,72,77,0.45)] text-[#e5484d]',
  ABSENT: 'border-[rgba(229,72,77,0.6)] text-[#e5484d] bg-[rgba(229,72,77,0.05)]',
};

export function ManifestWorkspace() {
  const sendWormLog = useSendWormLog();
  const [led] = useState(() => REGRESSION_LEDGER);

  useEffect(() => {
    sendWormLog('VIEW_MODE', 'MANIFEST', '#/manifest opened — EIS v1.0 · regression ledger · estate inventory');
  }, [sendWormLog]);

  return (
    <div className="absolute inset-0 overflow-y-auto vvu-scroll">
      <div className="max-w-6xl mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-5">
        <SectionHeader
          num="11"
          title="ESTATE MANIFEST · EIS v1.0"
          kicker="ROUND 30 · ELEVENTH PROJECTION · THE SPEC, THE LOSS, THE REBUILD"
          right={<Chip tone="teal">SINGLE SOURCE OF TRUTH</Chip>}
        />

        {/* ── why this view exists ─────────────────────────────────────────── */}
        <SectionReveal featured>
          <div className="p-4 sm:p-5 space-y-3">
            <div className="vvu-label text-[9px] text-[#2ea8a0] tracking-[0.18em]">WHY THIS VIEW EXISTS</div>
            <p className="vvu-label text-[8.5px] sm:text-[9.5px] leading-relaxed text-[#c9d4bd]">
              An external notebook AI, reading the uploaded estate sources, correctly reported it could not find
              &quot;EIS v1.0, the Zero Fabrication Rule, the Shared Spine / 11-field canonical payload, the mandatory UI
              footer mandate&quot;. The reason is now documented: a prior session described these artifacts, but its files
              were <span className="text-[#e5484d]">never persisted to this repo</span> — no commit, no worklog entry. They lived
              only in session narrative and died with it. This projection rebuilds the supply and records the loss
              verbatim, so the estate&apos;s answer to &quot;where are my documents?&quot; is never again a shrug.
            </p>
            <p className="vvu-label text-[8px] leading-relaxed text-[#7a8a6e] border-l-2 border-[rgba(46,168,160,0.5)] pl-2.5">
              Notebook sources the external AI DID hold: SHA-256 model checksums · GBNF grammar-constrained decoding ·
              application-level tool safeguards · Docker sandboxing · SQLite step-logging. Those are the uploaded
              document&apos;s mechanisms — a different layer of the stack, correctly reported. No conflict: this estate
              adds the evidence-independence layer on top.
            </p>
          </div>
        </SectionReveal>

        {/* ── EIS v1.0 rules ───────────────────────────────────────────────── */}
        <section aria-label="EIS v1.0 rules" className="space-y-3">
          <div className="vvu-label text-[10px] sm:text-[11px] text-[#f3e38a] tracking-[0.2em] flex items-center gap-2">
            <ScrollText className="w-3.5 h-3.5" aria-hidden /> EIS v1.0 — EVIDENCE INDEPENDENCE SPECIFICATION
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {EIS_RULES.map((rule) => (
              <div key={rule.id} className="vvu-panel-solid p-4 space-y-2.5 min-w-0 flex flex-col">
                <div className="flex items-center gap-2">
                  <rule.icon className="w-3.5 h-3.5 text-[#c8ff00] shrink-0" aria-hidden />
                  <h3 className="vvu-label text-[9px] text-[#c8ff00] tracking-[0.12em] leading-snug">{rule.title}</h3>
                </div>
                <p className="vvu-label text-[8.5px] leading-relaxed text-[#c9d4bd]">{rule.text}</p>
                <p className="vvu-label text-[7.5px] leading-relaxed text-[#7a8a6e] border-t border-[rgba(107,138,64,0.2)] pt-2 mt-auto">
                  {rule.grounding}
                </p>
              </div>
            ))}
          </div>

          <div className="p-3.5 border border-[rgba(200,255,0,0.3)] bg-[rgba(200,255,0,0.04)]">
            <p className="vvu-label text-[9px] leading-relaxed text-[#c8ff00] text-center tracking-wide">{AUTOMOMY_RULE_QUOTE}</p>
            <p className="vvu-label text-[7.5px] text-[#7a8a6e] text-center mt-1.5">
              Consequential changes go to MCP-pending, always. Field 11 (authority) exists to make this rule machine-checkable.
            </p>
          </div>
        </section>

        {/* ── shared spine table ────────────────────────────────────────────── */}
        <section aria-label="Shared Spine 11-field canonical payload" className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="vvu-label text-[10px] sm:text-[11px] text-[#f3e38a] tracking-[0.2em] flex items-center gap-2">
              <Layers className="w-3.5 h-3.5" aria-hidden /> SHARED SPINE — 11-FIELD CANONICAL PAYLOAD
            </div>
            <div className="flex gap-1.5">
              <Chip tone="lime">8 AS-BUILT</Chip>
              <Chip tone="amber">3 SPEC</Chip>
            </div>
          </div>

          <div className="vvu-panel-solid overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b border-[rgba(107,138,64,0.3)]">
                  <th className="vvu-label text-[7.5px] text-[#7a8a6e] px-3 py-2">#</th>
                  <th className="vvu-label text-[7.5px] text-[#7a8a6e] px-3 py-2">FIELD</th>
                  <th className="vvu-label text-[7.5px] text-[#7a8a6e] px-3 py-2">LAYER</th>
                  <th className="vvu-label text-[7.5px] text-[#7a8a6e] px-3 py-2">WHERE</th>
                  <th className="vvu-label text-[7.5px] text-[#7a8a6e] px-3 py-2">PURPOSE</th>
                </tr>
              </thead>
              <tbody>
                {SHARED_SPINE.map((f) => (
                  <tr key={f.n} className="border-b border-[rgba(107,138,64,0.12)] hover:bg-[rgba(107,138,64,0.05)]">
                    <td className="vvu-label text-[8px] text-[#7a8a6e] px-3 py-2 tabular-nums">{String(f.n).padStart(2, '0')}</td>
                    <td className="vvu-label text-[8.5px] text-[#f3e38a] px-3 py-2 whitespace-nowrap">{f.field}</td>
                    <td className="px-3 py-2">
                      <span className={cn('vvu-label text-[7px] px-1.5 py-0.5 rounded-sm border whitespace-nowrap', f.layer === 'AS-BUILT' ? STATUS_TONE.PROVEN : STATUS_TONE.SPEC)}>
                        {f.layer}
                      </span>
                    </td>
                    <td className="vvu-label text-[7.5px] text-[#8fb35a] px-3 py-2">{f.where}</td>
                    <td className="vvu-label text-[8px] text-[#c9d4bd] px-3 py-2">{f.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="vvu-label text-[7.5px] leading-relaxed text-[#7a8a6e]">
            RECONSTRUCTED SPEC — the prior session&apos;s written EIS text was not persisted. This table rebuilds it field-by-field
            from the as-built schema (fields 1–8 — every one referenced above exists in code today) plus the estate&apos;s
            documented rule layer (fields 9–11). Promotion of a SPEC field to AS-BUILT requires a persisted migration +
            this ledger updated.
          </p>
        </section>

        {/* ── regression ledger ─────────────────────────────────────────────── */}
        <section aria-label="Regression ledger" className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="vvu-label text-[10px] sm:text-[11px] text-[#f3e38a] tracking-[0.2em] flex items-center gap-2">
              <FileWarning className="w-3.5 h-3.5" aria-hidden /> REGRESSION LEDGER — SESSION LOSS RECORD
            </div>
            <Chip tone="crimson">5 REBUILT · 3 DISCLOSED · 1 NEVER EXISTED</Chip>
          </div>

          <div className="vvu-panel-solid divide-y divide-[rgba(107,138,64,0.15)]">
            {led.map((row) => (
              <div key={row.claimed} className="p-3 sm:p-3.5 grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 md:gap-3 items-start">
                <div className="min-w-0 space-y-0.5">
                  <div className="vvu-label text-[7px] text-[#7a8a6e] tracking-[0.15em]">CLAIMED BY LOST SESSION</div>
                  <p className="vvu-label text-[8.5px] leading-relaxed text-[#c9d4bd]">{row.claimed}</p>
                </div>
                <div className="min-w-0 space-y-0.5">
                  <div className="vvu-label text-[7px] text-[#7a8a6e] tracking-[0.15em]">ACTUAL REPO STATE</div>
                  <p className="vvu-label text-[8.5px] leading-relaxed text-[#7a8a6e]">{row.repoState}</p>
                </div>
                <span
                  className={cn(
                    'vvu-label text-[7px] px-1.5 py-1 rounded-sm border whitespace-nowrap justify-self-start',
                    row.action === 'REBUILT THIS ROUND'
                      ? 'border-[rgba(200,255,0,0.45)] text-[#c8ff00]'
                      : row.action === 'NEVER EXISTED'
                        ? 'border-[rgba(229,72,77,0.5)] text-[#e5484d]'
                        : 'border-[rgba(243,227,138,0.45)] text-[#f3e38a]'
                  )}
                >
                  {row.action}
                </span>
              </div>
            ))}
          </div>
          <p className="vvu-label text-[7.5px] leading-relaxed text-[#7a8a6e] flex items-start gap-2">
            <GitCommitHorizontal className="w-3 h-3 mt-0.5 shrink-0 text-[#8fb35a]" aria-hidden />
            Prevention: this round&apos;s artifacts land with a worklog entry and a commit in the same session. Any future
            handover summary must be checked against <span className="text-[#f3e38a]">git log</span> before its claims are
            treated as fact — narrative is not persistence.
          </p>
        </section>

        {/* ── inventory ────────────────────────────────────────────────────── */}
        <section aria-label="Estate inventory" className="space-y-4">
          <div className="vvu-label text-[10px] sm:text-[11px] text-[#f3e38a] tracking-[0.2em] flex items-center gap-2">
            <Boxes className="w-3.5 h-3.5" aria-hidden /> ESTATE INVENTORY — VERIFIED THIS ROUND
          </div>

          {[
            { title: 'PROJECTIONS · 11', icon: Radar, tiles: PROJECTION_TILES, note: 'Every tile browser-verified this round (9 legacy + 2 rebuilt).' },
            { title: '14 CANONICAL COMPONENTS', icon: Archive, tiles: COMPONENT_TILES, note: 'Statuses from the Phase-0 discovery sweep — not promoted without evidence.' },
            { title: 'SERVICES & GATEWAY', icon: AlertOctagon, tiles: SERVICE_TILES, note: ':3004 / :3005 were claimed by the lost session and never existed here — recorded as ABSENT, not rebuilt silently.' },
            { title: 'SOURCE DOCUMENTS', icon: ScrollText, tiles: DOC_TILES, note: 'The offer doc governs commercial text; where any view differs, the doc wins.' },
          ].map((group) => (
            <div key={group.title} className="space-y-2">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="vvu-label text-[9px] text-[#8fb35a] tracking-[0.15em] flex items-center gap-2">
                  <group.icon className="w-3 h-3" aria-hidden /> {group.title}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                {group.tiles.map((tile) => (
                  <div key={tile.name} className="vvu-panel-solid p-3 space-y-1.5 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className="vvu-label text-[8.5px] text-[#f3e38a] leading-snug min-w-0">{tile.name}</span>
                      <span className={cn('vvu-label text-[6.5px] px-1.5 py-0.5 rounded-sm border shrink-0 whitespace-nowrap', STATUS_TONE[tile.status])}>
                        {tile.status}
                      </span>
                    </div>
                    <p className="vvu-label text-[7.5px] leading-relaxed text-[#7a8a6e]">{tile.note}</p>
                  </div>
                ))}
              </div>
              <p className="vvu-label text-[7px] leading-relaxed text-[#7a8a6e]">{group.note}</p>
            </div>
          ))}
        </section>

        {/* ── footer note ───────────────────────────────────────────────────── */}
        <div className="flex items-start gap-2.5 pb-4">
          <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#8fb35a]" aria-hidden />
          <p className="vvu-label text-[7.5px] leading-relaxed text-[#7a8a6e]">
            The prior 93-tile manifest is NOT reconstructed tile-for-tile — its list was lost. This inventory holds{' '}
            {PROJECTION_TILES.length + COMPONENT_TILES.length + SERVICE_TILES.length + DOC_TILES.length} verified tiles instead, each
            checkable against the repo in minutes. A smaller manifest that is true outranks a large one that is remembered.
          </p>
        </div>
      </div>
    </div>
  );
}
