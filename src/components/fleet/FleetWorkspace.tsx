'use client';

// src/components/fleet/FleetWorkspace.tsx — ROUND 33 · fourteenth projection
// #/fleet — DEVICE FLEET & ONBOARDING (the fleet layer, canonical).
//
//   · OVERVIEW — what arrived this round and how the five docs bind
//     (FABRIC → FIND → PERMIT → BIND → RUN)
//   · DISCOVERY — the four channels, dedup rules, the census-not-subscription line
//   · CONSENT — the four grantors, scopes, revocation, "consent is the first event"
//   · ONBOARDING — the 10-minute timeline, the MESH LIVE mock, the QR fallback
//   · ENGINE — the 7 stages + FAIL CLOSED semantics (PIPELINE_ENGINE_SPEC)
//   · SEVEN DOCS ON DISK — expandable cards that render the canonical markdown
//     straight from vvu-trust/ via /api/vvu/fleet-docs (the repo file IS the
//     source; this view does not fork it) + COPY (WORM-logged)
//   · THE BLOG POST — published 2026-09-20, hero image from disk, the four
//     purchases → eleven channels, the pull quotes from ONBOARDING_FLOW.md
//
// Every doc open and every COPY is WORM-logged (clipboard → toast → ledger →
// audit table) like every other projection.

import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CheckSquare,
  Copy,
  Cpu,
  FileText,
  Layers,
  Newspaper,
  Radar,
  ShieldCheck,
  Timer,
  Workflow,
} from 'lucide-react';
import { Chip, SectionHeader, SectionReveal } from '@/components/analytics/shared';
import { useSendWormLog } from '@/hooks/use-vvu-socket';
import { cn } from '@/lib/utils';
import {
  BLOG_META,
  BLOG_PURCHASES,
  BLOG_QUOTE_SOURCES,
  CONSENT_GRANTORS,
  CONSENT_REVOCATION_RULES,
  CONSENT_SCOPES,
  CONSENT_ONE_LINER,
  DISCOVERY_CHANNELS,
  DISCOVERY_DEDUP,
  DISCOVERY_NOT_DO,
  DISCOVERY_ONE_LINER,
  ENGINE_PROPERTIES,
  ENGINE_STAGES,
  ENGINE_ONE_LINER,
  FLEET_DOCS,
  FLEET_PROVENANCE_NOTE,
  FLEET_STACK,
  ONBOARDING_ELAPSED,
  ONBOARDING_NOT_DO,
  ONBOARDING_ONE_LINER,
  ONBOARDING_TIMELINE,
  type FleetDocMeta,
  type FleetProvenance,
} from '@/lib/fleet-data';

// ─── Section nav ─────────────────────────────────────────────────────────────

type SectionId = 'overview' | 'discovery' | 'consent' | 'onboarding' | 'engine' | 'docs' | 'blog';

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'overview', label: 'OVERVIEW' },
  { id: 'discovery', label: 'DISCOVERY' },
  { id: 'consent', label: 'CONSENT' },
  { id: 'onboarding', label: 'ONBOARDING' },
  { id: 'engine', label: 'ENGINE · 7 STAGES' },
  { id: 'docs', label: 'DOCS · ON DISK' },
  { id: 'blog', label: 'BLOG · PUBLISHED' },
];

const DOC_ICON: Record<FleetDocMeta['id'], typeof Radar> = {
  mesh_spec: Cpu,
  discovery: Radar,
  consent: ShieldCheck,
  onboarding: Timer,
  pipeline_catalog: Layers,
  pipeline_engine: Workflow,
  blog_post: Newspaper,
};

const PROVENANCE_TONE: Record<FleetProvenance, 'lime' | 'amber' | 'teal'> = {
  'OPERATOR VERBATIM': 'lime',
  'WRITTEN THIS ROUND': 'amber',
  'NEXT ARTIFACT': 'teal',
};

const PROVENANCE_NOTE: Record<FleetProvenance, string> = {
  'OPERATOR VERBATIM': 'Full text delivered this round — written to disk exactly as delivered.',
  'WRITTEN THIS ROUND': 'Named as part of the fleet set but not on disk — written this round (standing pattern: spec first, on the word).',
  'NEXT ARTIFACT': 'The runtime the operator proposed to close the loop — five specs, one running mesh.',
};

// ─── The workspace ──────────────────────────────────────────────────────────

export function FleetWorkspace() {
  const sendWormLog = useSendWormLog();
  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const [openDoc, setOpenDoc] = useState<string | null>('discovery');

  // View entry is WORM-logged like every projection (append-only, no silent views).
  useEffect(() => {
    sendWormLog('VIEW_MODE', 'FLEET', '#/fleet opened — 5 fleet docs + engine spec on disk · blog published 2026-09-20');
  }, [sendWormLog]);

  const copyText = useCallback(
    (text: string, label: string, kind: string) => {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          toast.success(`COPIED — ${label}`, { description: 'WORM COPY event appended to ledger' });
          sendWormLog('FLEET_DOC_COPY', 'OPERATOR', `${kind}: ${label} → clipboard`);
          fetch('/api/vvu/audit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              actor: 'OPERATOR',
              action: 'FLEET_DOC_COPY',
              fromState: 'FLEET_VIEW',
              toState: 'FLEET_VIEW',
              symbol: 'COPY',
              reason: `${kind}: ${label}`,
            }),
          }).catch(() => {
            /* offline — audit is best-effort */
          });
        })
        .catch(() => {
          toast.error('CLIPBOARD BLOCKED', { description: 'Browser denied clipboard access — text still readable in the doc card' });
        });
    },
    [sendWormLog]
  );

  const jump = (id: SectionId) => {
    setActiveSection(id);
    document.getElementById(`fleet-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="absolute inset-0 overflow-y-auto vvu-scroll">
      <div className="max-w-6xl mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-5 pb-28">
        {/* ── header ─────────────────────────────────────────────────────── */}
        <SectionHeader
          num="14"
          title="DEVICE FLEET · ONBOARDING"
          kicker="ROUND 33 · FOURTEENTH PROJECTION · THE FLEET LAYER, CANONICAL"
          right={
            <div className="flex flex-wrap gap-1.5">
              <Chip tone="lime">5 FLEET DOCS + ENGINE · ON DISK</Chip>
              <Chip tone="teal">BLOG · PUBLISHED 2026-09-20</Chip>
            </div>
          }
        />

        {/* section nav — touch-friendly chips */}
        <nav
          aria-label="Fleet sections"
          className="flex flex-wrap gap-1.5 sticky top-0 z-20 -mx-1 px-1 py-2 bg-[#060806]/95 backdrop-blur-sm border-b border-[rgba(107,138,64,0.2)]"
        >
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => jump(s.id)}
              aria-current={activeSection === s.id ? 'true' : undefined}
              className={cn(
                'vvu-label text-[8px] sm:text-[9px] px-2.5 py-2 min-h-[36px] rounded-sm border transition-all select-none',
                activeSection === s.id
                  ? 'border-[rgba(200,255,0,0.55)] text-[#c8ff00] bg-[rgba(200,255,0,0.06)]'
                  : 'border-[rgba(107,138,64,0.3)] text-[#7a8a6e] hover:border-[rgba(200,255,0,0.35)] hover:text-[#c8ff00]'
              )}
            >
              {s.label}
            </button>
          ))}
        </nav>

        {/* ── overview — what arrived + how the five docs bind ─────────────── */}
        <section id="fleet-overview" aria-label="Fleet overview" className="space-y-3 scroll-mt-20">
          <SectionReveal featured>
            <div className="p-4 sm:p-5 border-2 border-[rgba(200,255,0,0.5)] bg-[rgba(200,255,0,0.03)] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Radar className="w-4 h-4 shrink-0 text-[#c8ff00]" aria-hidden />
                  <span className="vvu-label text-[10px] sm:text-[11px] text-[#c8ff00] tracking-[0.2em]">
                    THE FLEET LAYER — DISCOVERY · CONSENT · ONBOARDING
                  </span>
                </div>
                <Chip tone="lime">WALK IN · SCAN · TAP · WALK OUT</Chip>
              </div>
              <p className="vvu-label text-[10px] sm:text-[12px] leading-relaxed text-[#f3e38a] font-bold">
                A farm with 20 devices across 6 owners and 4 networks cannot be onboarded by asking each person to
                type credentials. The path has to be: walk in, scan once, everything joins.
              </p>
              <p className="vvu-label text-[9px] leading-relaxed text-[#c9d4bd]">{FLEET_PROVENANCE_NOTE}</p>

              {/* the five-doc stack — FABRIC → FIND → PERMIT → BIND → RUN */}
              <div className="space-y-1.5">
                <div className="vvu-label text-[7px] text-[#7a8a6e] tracking-[0.15em]">HOW THE FIVE DOCS BIND</div>
                <div className="flex flex-wrap items-stretch gap-1.5">
                  {FLEET_STACK.map((layer, i) => (
                    <div key={layer.layer} className="flex items-center gap-1.5 min-w-0">
                      <div className="vvu-label rounded-sm border border-[rgba(46,168,160,0.45)] bg-[rgba(46,168,160,0.04)] px-2.5 py-2 min-w-0 max-w-[13rem]">
                        <div className="text-[7px] text-[#2ea8a0] tracking-[0.12em]">
                          {String(i + 1).padStart(2, '0')} · {layer.layer}
                        </div>
                        <div className="text-[7px] text-[#f3e38a] mt-0.5 break-words">{layer.doc}</div>
                        <div className="text-[6.5px] text-[#7a8a6e] leading-snug mt-0.5">{layer.role}</div>
                      </div>
                      {i < FLEET_STACK.length - 1 && (
                        <span aria-hidden className="text-[#2ea8a0] text-[9px] shrink-0">
                          ▸
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <p className="vvu-label text-[7.5px] leading-relaxed text-[#f3e38a] border-l-2 border-[rgba(243,227,138,0.45)] pl-2.5">
                WHAT THIS CLOSES — the last gap in the mesh is not technical, it is onboarding friction. Any mesh
                that requires per-device typing is dead on arrival in a farm office. This set makes the onboarding
                90 seconds of tapping and 8 minutes of watching devices connect themselves.
              </p>
            </div>
          </SectionReveal>
        </section>

        {/* ── discovery — the four channels ───────────────────────────────── */}
        <section id="fleet-discovery" aria-label="Discovery channels" className="space-y-3 scroll-mt-20">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Radar className="w-3.5 h-3.5 text-[#e0a030]" aria-hidden />
              <span className="vvu-label text-[10px] sm:text-[11px] text-[#f3e38a] tracking-[0.2em]">
                FOUR DISCOVERY CHANNELS — THE CENSUS
              </span>
            </div>
            <Chip tone="dim">ALL LOCAL · NO CREDENTIAL ENTRY</Chip>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {DISCOVERY_CHANNELS.map((c) => (
              <SectionReveal key={c.id}>
                <article className="vvu-panel-solid p-4 space-y-2 min-w-0 flex flex-col">
                  <div className="flex items-center justify-between gap-2">
                    <span className="vvu-label text-[9px] text-[#c8ff00] tracking-[0.15em]">{c.name}</span>
                    <span className="vvu-label text-[6.5px] text-[#7a8a6e] tabular-nums border border-[rgba(107,138,64,0.3)] rounded-sm px-1.5 py-0.5 whitespace-nowrap">
                      {c.latency} · {c.cadence}
                    </span>
                  </div>
                  <div className="vvu-label text-[7.5px] text-[#8fb35a] border-b border-[rgba(107,138,64,0.2)] pb-1.5 break-words">
                    {c.method}
                  </div>
                  <p className="vvu-label text-[7.5px] leading-relaxed text-[#c9d4bd]">{c.catches}</p>
                  <div className="vvu-label text-[7px] text-[#7a8a6e] mt-auto">
                    CONSENT — <span className="text-[#2ea8a0]">{c.consent}</span>
                  </div>
                </article>
              </SectionReveal>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="vvu-panel-solid p-4 space-y-2 min-w-0">
              <div className="vvu-label text-[8px] text-[#f3e38a] tracking-[0.15em]">DEDUPLICATION (SAME DEVICE, MANY CHANNELS)</div>
              <ol className="space-y-1.5">
                {DISCOVERY_DEDUP.map((d, i) => (
                  <li key={d} className="vvu-label text-[7.5px] leading-relaxed text-[#c9d4bd] border-l-2 border-[rgba(143,179,90,0.35)] pl-2.5">
                    <span className="text-[#7a8a6e] tabular-nums">{i + 1}.</span> {d}
                  </li>
                ))}
              </ol>
              <p className="vvu-label text-[7px] leading-relaxed text-[#7a8a6e]">
                The deduplicated device retains all discovery sources. Hidden devices (other VLANs, firewalls,
                randomised BLE MACs) fall through to the QR fallback.
              </p>
            </div>
            <div className="vvu-panel-solid p-4 space-y-2 min-w-0">
              <div className="vvu-label text-[8px] text-[#f3e38a] tracking-[0.15em]">WHAT DISCOVERY DOES NOT DO</div>
              <ul className="space-y-1.5">
                {DISCOVERY_NOT_DO.map((d) => (
                  <li key={d} className="vvu-label text-[7.5px] leading-relaxed text-[#c9d4bd] border-l-2 border-[rgba(229,72,77,0.35)] pl-2.5">
                    {d}
                  </li>
                ))}
              </ul>
              <p className="vvu-label text-[8px] leading-relaxed text-[#c8ff00] border-l-2 border-[rgba(200,255,0,0.45)] pl-2.5 pt-1">
                {DISCOVERY_ONE_LINER}
              </p>
            </div>
          </div>
        </section>

        {/* ── consent — the four grantors ─────────────────────────────────── */}
        <section id="fleet-consent" aria-label="Consent model" className="space-y-3 scroll-mt-20">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldCheck className="w-3.5 h-3.5 text-[#2ea8a0]" aria-hidden />
              <span className="vvu-label text-[10px] sm:text-[11px] text-[#f3e38a] tracking-[0.2em]">
                THE FOUR CONSENT GRANTORS — SIGNED, WINDOWED, CHAINED
              </span>
            </div>
            <Chip tone="teal">ADMIN ENABLES · IT DOES NOT ELIMINATE</Chip>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {CONSENT_GRANTORS.map((g) => (
              <SectionReveal key={g.id}>
                <article className="vvu-panel-solid p-4 space-y-2 min-w-0 flex flex-col">
                  <div className="flex items-center justify-between gap-2">
                    <span className="vvu-label text-[9px] text-[#2ea8a0] tracking-[0.15em]">{g.name}</span>
                    <CheckSquare className="w-3 h-3 text-[#7a8a6e]" aria-hidden />
                  </div>
                  <div className="vvu-label text-[7.5px] text-[#c9d4bd] leading-relaxed border-b border-[rgba(107,138,64,0.2)] pb-1.5">
                    {g.grants}
                  </div>
                  <p className="vvu-label text-[7px] leading-relaxed text-[#7a8a6e]">{g.example}</p>
                  <div className="vvu-label text-[7.5px] text-[#f3e38a] mt-auto">{g.act}</div>
                </article>
              </SectionReveal>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="vvu-panel-solid p-4 space-y-2 min-w-0">
              <div className="vvu-label text-[8px] text-[#f3e38a] tracking-[0.15em]">CONSENT WINDOW SCOPES</div>
              <div className="overflow-x-auto rounded-sm border border-[rgba(107,138,64,0.25)]">
                <table className="w-full border-collapse text-left">
                  <tbody>
                    {CONSENT_SCOPES.map((s) => (
                      <tr key={s.scope} className="even:bg-[rgba(107,138,64,0.03)]">
                        <td className="vvu-label text-[7.5px] text-[#c8ff00] border-b border-[rgba(107,138,64,0.12)] px-2 py-1.5 align-top whitespace-nowrap">
                          {s.scope}
                        </td>
                        <td className="vvu-label text-[7.5px] leading-relaxed text-[#c9d4bd] border-b border-[rgba(107,138,64,0.12)] px-2 py-1.5">
                          {s.meaning}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="vvu-label text-[7px] leading-relaxed text-[#7a8a6e]">
                Default is session. Every scope beyond session requires an additional confirmation tap. A device
                within admin scope can still refuse — the refusal is chained next to the admin&apos;s claim.
              </p>
            </div>
            <div className="vvu-panel-solid p-4 space-y-2 min-w-0">
              <div className="vvu-label text-[8px] text-[#f3e38a] tracking-[0.15em]">REVOCATION — IMMEDIATE, NO GRACE</div>
              <ul className="space-y-1.5">
                {CONSENT_REVOCATION_RULES.map((r) => (
                  <li key={r} className="vvu-label text-[7.5px] leading-relaxed text-[#c9d4bd] border-l-2 border-[rgba(229,72,77,0.35)] pl-2.5">
                    {r}
                  </li>
                ))}
              </ul>
              <p className="vvu-label text-[7px] leading-relaxed text-[#7a8a6e]">
                The chain is the consent record. It is the only consent record. No argument — the record ends it.
              </p>
            </div>
          </div>

          <div className="rounded-sm border border-[rgba(200,255,0,0.45)] bg-[rgba(200,255,0,0.04)] p-3">
            <p className="vvu-label text-[9px] leading-relaxed text-[#c8ff00] text-center tracking-[0.12em]">
              {CONSENT_ONE_LINER}
            </p>
          </div>
        </section>

        {/* ── onboarding — the 10-minute timeline ────────────────────────── */}
        <section id="fleet-onboarding" aria-label="Onboarding flow" className="space-y-3 scroll-mt-20">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Timer className="w-3.5 h-3.5 text-[#c8ff00]" aria-hidden />
              <span className="vvu-label text-[10px] sm:text-[11px] text-[#f3e38a] tracking-[0.2em]">
                THE 10-MINUTE TARGET — EVERY STEP AFTER MINUTE 1 IS A TAP
              </span>
            </div>
            <Chip tone="lime">ZERO CREDENTIALS · ZERO TYPING · ZERO DOCS</Chip>
          </div>

          {/* minute strip */}
          <SectionReveal>
            <div className="vvu-panel-solid p-4 space-y-3">
              <ol className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                {ONBOARDING_TIMELINE.map((t, i) => (
                  <li
                    key={t.minute}
                    className="rounded-sm border border-[rgba(107,138,64,0.3)] bg-[#0b0f0a] px-2 py-2 min-w-0"
                  >
                    <div className="vvu-label text-[7px] text-[#c8ff00] tabular-nums">{t.minute}</div>
                    <div className="vvu-label text-[7px] leading-snug text-[#c9d4bd] mt-0.5 break-words">
                      {t.step}
                    </div>
                    <div aria-hidden className="h-0.5 mt-1.5 rounded-sm bg-[rgba(200,255,0,0.25)]" style={{ width: `${Math.min(100, (i + 1) * 10)}%` }} />
                  </li>
                ))}
              </ol>

              {/* the MESH LIVE mock — step 10 */}
              <div className="rounded-sm border border-[rgba(200,255,0,0.4)] bg-[#040604] overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[rgba(107,138,64,0.3)] bg-[rgba(107,138,64,0.06)]">
                  <span className="vvu-label text-[7px] px-1.5 py-0.5 rounded-sm border border-[rgba(200,255,0,0.5)] text-[#c8ff00]">
                    ● MESH LIVE
                  </span>
                  <span className="vvu-label text-[6.5px] text-[#7a8a6e] tabular-nums">{ONBOARDING_ELAPSED}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1">
                  {[
                    ['DEVICES JOINED', '23 of 23'],
                    ['CONSENTED', '23'],
                    ['REFUSED', '0'],
                    ['PIPELINES ACTIVE', '4'],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-sm border border-[rgba(107,138,64,0.3)] bg-[#090d09] px-2 py-2">
                      <div className="vvu-label text-[6.5px] text-[#7a8a6e]">{k}</div>
                      <div className="vvu-label text-[9px] text-[#f3e38a] tabular-nums mt-0.5">{v}</div>
                    </div>
                  ))}
                  <div className="col-span-2 sm:col-span-4 rounded-sm border border-[rgba(46,168,160,0.35)] bg-[#060a09] px-2.5 py-2 flex flex-wrap items-center gap-2">
                    <span className="vvu-label text-[6.5px] text-[#7a8a6e]">NEXT —</span>
                    <span className="vvu-label text-[7px] text-[#2ea8a0]">[ 3D TWIN ]</span>
                    <span className="vvu-label text-[7px] text-[#2ea8a0]">[ PWA ]</span>
                    <span className="vvu-label text-[7px] text-[#2ea8a0]">[ EVIDENCE ]</span>
                    <span className="vvu-label text-[6px] text-[#7a8a6e] ml-auto hidden sm:inline">
                      the operator walks out; the mesh is autonomous
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <div className="vvu-label text-[8px] text-[#f3e38a] tracking-[0.15em]">WHAT THE FLOW DOES NOT DO</div>
                  <ul className="space-y-1.5">
                    {ONBOARDING_NOT_DO.map((d) => (
                      <li key={d} className="vvu-label text-[7.5px] leading-relaxed text-[#c9d4bd] border-l-2 border-[rgba(229,72,77,0.35)] pl-2.5">
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-1.5">
                  <div className="vvu-label text-[8px] text-[#f3e38a] tracking-[0.15em]">THE QR FALLBACK (AIR-GAPPED)</div>
                  <p className="vvu-label text-[7.5px] leading-relaxed text-[#c9d4bd]">
                    The QR carries the device public key, class, friendly name, and a one-time binding nonce. The
                    operator scans; the aggregator writes a consent event bound to the public key. ~30 seconds per
                    device — 20 devices is still 10 minutes. Same target.
                  </p>
                  <p className="vvu-label text-[7px] leading-relaxed text-[#7a8a6e]">
                    Devices that leave get a <span className="text-[#c9d4bd]">device.left</span> event after 15
                    minutes; on return the consent window is re-validated — valid windows rejoin silently, expired
                    ones prompt for renewal.
                  </p>
                </div>
              </div>

              <p className="vvu-label text-[9px] leading-relaxed text-[#c8ff00] text-center tracking-[0.12em]">
                {ONBOARDING_ONE_LINER}
              </p>
            </div>
          </SectionReveal>
        </section>

        {/* ── the engine — 7 stages ──────────────────────────────────────── */}
        <section id="fleet-engine" aria-label="Pipeline engine" className="space-y-3 scroll-mt-20">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Workflow className="w-3.5 h-3.5 text-[#e0a030]" aria-hidden />
              <span className="vvu-label text-[10px] sm:text-[11px] text-[#f3e38a] tracking-[0.2em]">
                PIPELINE ENGINE — THE RUNTIME THAT TURNS FIVE SPECS INTO ONE RUNNING MESH
              </span>
            </div>
            <Chip tone="amber">NEXT ARTIFACT · AUTHORED</Chip>
          </div>

          <SectionReveal>
            <div className="vvu-panel-solid p-4 space-y-3">
              <div className="overflow-x-auto rounded-sm border border-[rgba(107,138,64,0.25)]">
                <table className="w-full min-w-[560px] border-collapse text-left">
                  <thead>
                    <tr>
                      {['#', 'Stage', 'What happens', 'Failure mode'].map((h) => (
                        <th
                          key={h}
                          className="vvu-label text-[7px] text-[#8fb35a] bg-[rgba(107,138,64,0.08)] border-b border-[rgba(107,138,64,0.35)] px-2 py-1.5 whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ENGINE_STAGES.map((s) => (
                      <tr key={s.n} className="even:bg-[rgba(107,138,64,0.03)]">
                        <td className="vvu-label text-[8px] text-[#c8ff00] border-b border-[rgba(107,138,64,0.12)] px-2 py-1.5 align-top tabular-nums">
                          {String(s.n).padStart(2, '0')}
                        </td>
                        <td className="vvu-label text-[8px] text-[#f3e38a] border-b border-[rgba(107,138,64,0.12)] px-2 py-1.5 align-top whitespace-nowrap">
                          {s.stage}
                        </td>
                        <td className="vvu-label text-[7.5px] leading-relaxed text-[#c9d4bd] border-b border-[rgba(107,138,64,0.12)] px-2 py-1.5 align-top">
                          {s.what}
                        </td>
                        <td className="vvu-label text-[7.5px] leading-relaxed text-[#e0a030] border-b border-[rgba(107,138,64,0.12)] px-2 py-1.5 align-top">
                          {s.failure}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {ENGINE_PROPERTIES.map((p) => (
                  <div key={p.title} className="rounded-sm border border-[rgba(46,168,160,0.4)] bg-[rgba(46,168,160,0.04)] p-3 space-y-1.5">
                    <div className="vvu-label text-[8px] text-[#2ea8a0] tracking-[0.15em]">{p.title}</div>
                    <p className="vvu-label text-[7.5px] leading-relaxed text-[#c9d4bd]">{p.body}</p>
                  </div>
                ))}
              </div>

              <p className="vvu-label text-[8px] leading-relaxed text-[#7a8a6e] border-l-2 border-[rgba(243,227,138,0.45)] pl-2.5">
                CONSENT IS RE-CHECKED AT DECISION TIME, NOT ARRIVAL TIME — a reading that passes stage 3 at ingest
                and whose window expires before stage 6 does not fire a rule on that data. Revocation drops the
                in-flight readings at their next stage boundary and chains CONSENT_DROPPED_INFLIGHT with the count.
              </p>
              <p className="vvu-label text-[8.5px] leading-relaxed text-[#f3e38a] text-center">{ENGINE_ONE_LINER}</p>
            </div>
          </SectionReveal>
        </section>

        {/* ── the seven documents on disk ────────────────────────────────── */}
        <section id="fleet-docs" aria-label="Fleet documents" className="space-y-3 scroll-mt-20">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-3.5 h-3.5 text-[#8fb35a]" aria-hidden />
              <span className="vvu-label text-[10px] sm:text-[11px] text-[#f3e38a] tracking-[0.2em]">
                THE DOCUMENTS — RENDERED FROM DISK, NOT FORKED
              </span>
            </div>
            <Chip tone="sage">7 FILES · CANONICAL PATHS</Chip>
          </div>
          {FLEET_DOCS.map((doc) => (
            <FleetDocCard
              key={doc.id}
              doc={doc}
              open={openDoc === doc.id}
              onToggle={() => {
                setOpenDoc(openDoc === doc.id ? null : doc.id);
                if (openDoc !== doc.id) {
                  sendWormLog('FLEET_DOC_OPEN', 'OPERATOR', `${doc.id} opened — rendering canonical markdown from disk`);
                }
              }}
              onCopy={copyText}
            />
          ))}
        </section>

        {/* ── the blog post — published ─────────────────────────────────── */}
        <section id="fleet-blog" aria-label="Published blog post" className="space-y-3 scroll-mt-20">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Newspaper className="w-3.5 h-3.5 text-[#c8ff00]" aria-hidden />
              <span className="vvu-label text-[10px] sm:text-[11px] text-[#f3e38a] tracking-[0.2em]">
                THE BLOG — PUBLISHED AS-IS, QUOTES PULLED FROM THE SPEC
              </span>
            </div>
            <Chip tone="lime">STATUS: PUBLISHED · 2026-09-20</Chip>
          </div>

          <SectionReveal featured>
            <div className="vvu-panel-solid overflow-hidden">
              {/* hero image — served from the canonical repo path via the API */}
              <figure className="m-0">
                <img
                  src="/api/vvu/fleet-docs?asset=hero"
                  alt={BLOG_META.heroAlt}
                  className="w-full h-auto max-h-[320px] object-cover border-b border-[rgba(107,138,64,0.35)]"
                  width={1344}
                  height={768}
                />
                <figcaption className="px-4 py-2 vvu-label text-[6.5px] text-[#7a8a6e]">
                  HERO — {BLOG_META.hero} · generated this round · served from vvu-trust/blog/assets/ via the disk-canonical API
                </figcaption>
              </figure>

              <div className="p-4 sm:p-5 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="vvu-label text-[12px] sm:text-[14px] text-[#f3e38a] font-bold">{BLOG_META.title}</h3>
                    <div className="vvu-label text-[7px] text-[#7a8a6e] mt-1">
                      {BLOG_META.date} · {BLOG_META.author} · tags: {BLOG_META.tags.join(', ')}
                    </div>
                  </div>
                  <Chip tone="lime">{BLOG_META.status}</Chip>
                </div>

                <p className="vvu-label text-[10px] sm:text-[12px] leading-relaxed text-[#f3e38a] font-bold">
                  Four products. Eleven channels. All of them already in the mesh spec.
                </p>

                {/* the four purchases → channels */}
                <div className="overflow-x-auto rounded-sm border border-[rgba(107,138,64,0.25)]">
                  <table className="w-full min-w-[560px] border-collapse text-left">
                    <thead>
                      <tr>
                        {['The purchase', 'Channels', 'Why it is already mesh'].map((h) => (
                          <th
                            key={h}
                            className="vvu-label text-[7px] text-[#8fb35a] bg-[rgba(107,138,64,0.08)] border-b border-[rgba(107,138,64,0.35)] px-2 py-1.5 whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {BLOG_PURCHASES.map((p) => (
                        <tr key={p.product} className="even:bg-[rgba(107,138,64,0.03)]">
                          <td className="vvu-label text-[7.5px] text-[#f3e38a] border-b border-[rgba(107,138,64,0.12)] px-2 py-2 align-top">
                            {p.product}
                          </td>
                          <td className="vvu-label text-[7px] border-b border-[rgba(107,138,64,0.12)] px-2 py-2 align-top">
                            {p.channels.map((c) => (
                              <span
                                key={c}
                                className="inline-block px-1.5 py-0.5 mr-1 mb-1 rounded-sm border border-[rgba(46,168,160,0.45)] text-[#2ea8a0] whitespace-nowrap"
                              >
                                {c}
                              </span>
                            ))}
                          </td>
                          <td className="vvu-label text-[7.5px] leading-relaxed text-[#c9d4bd] border-b border-[rgba(107,138,64,0.12)] px-2 py-2 align-top">
                            {p.note}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* pull quotes from ONBOARDING_FLOW.md */}
                <div className="space-y-2">
                  <div className="vvu-label text-[7px] text-[#7a8a6e] tracking-[0.15em]">FROM THE ONBOARDING SPEC</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {BLOG_QUOTE_SOURCES.map((q) => (
                      <blockquote key={q} className="vvu-label text-[8px] leading-relaxed text-[#c8ff00] border-l-2 border-[rgba(200,255,0,0.45)] pl-2.5 m-0">
                        {q}
                      </blockquote>
                    ))}
                  </div>
                </div>

                <p className="vvu-label text-[8px] leading-relaxed text-[#c9d4bd] border-l-2 border-[rgba(243,227,138,0.45)] pl-2.5">
                  THE LINE THAT MATTERS — buy four smart products once. Then run them as one system forever, for
                  free. It was already true of a farm. It turns out it is also true of a house.
                </p>

                <BlogFullPost onCopy={copyText} />
              </div>
            </div>
          </SectionReveal>
        </section>

        {/* ── footer note ────────────────────────────────────────────────── */}
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#8fb35a]" aria-hidden />
          <p className="vvu-label text-[7.5px] leading-relaxed text-[#7a8a6e]">
            Every doc open and COPY on this projection is WORM-logged (clipboard → toast → ledger → audit table).
            The seven documents are rendered from the canonical files on disk via /api/vvu/fleet-docs — this view
            does not fork them; the repo file is the single source. Three arrived as operator verbatim text this
            round, two were written to close the referenced set, one is the authored engine spec, and the blog post
            is published with its hero image and the quotes pulled from the onboarding flow.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Fleet doc card — disk-canonical markdown ───────────────────────────────

function FleetDocCard({
  doc,
  open,
  onToggle,
  onCopy,
}: {
  doc: FleetDocMeta;
  open: boolean;
  onToggle: () => void;
  onCopy: (text: string, label: string, kind: string) => void;
}) {
  const Icon = DOC_ICON[doc.id] ?? FileText;
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['fleet-doc', doc.id],
    enabled: open,
    queryFn: async () => {
      const r = await fetch(`/api/vvu/fleet-docs?doc=${doc.id}`);
      if (!r.ok) throw new Error('fleet doc unreadable');
      return (await r.json()) as { path: string; bytes: number; markdown: string };
    },
    staleTime: 5 * 60_000,
  });

  return (
    <article id={`fleet-doc-${doc.id}`} className="vvu-panel-solid min-w-0 scroll-mt-20">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-start justify-between gap-3 p-3.5 text-left hover:bg-[rgba(107,138,64,0.06)] transition-colors"
      >
        <div className="flex items-start gap-2.5 min-w-0">
          <Icon className="w-4 h-4 mt-0.5 shrink-0 text-[#8fb35a]" aria-hidden />
          <div className="min-w-0 space-y-1">
            <div className="vvu-label text-[7px] text-[#7a8a6e] tracking-wide break-all">{doc.path}</div>
            <div className="vvu-label text-[9.5px] text-[#f3e38a] leading-snug">{doc.title}</div>
            <div className="vvu-label text-[7.5px] text-[#7a8a6e] leading-relaxed">{doc.subtitle}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
          <span
            className={cn(
              'vvu-label text-[6.5px] px-1.5 py-0.5 rounded-sm border whitespace-nowrap hidden sm:inline',
              PROVENANCE_TONE[doc.provenance] === 'lime' && 'border-[rgba(200,255,0,0.45)] text-[#c8ff00]',
              PROVENANCE_TONE[doc.provenance] === 'amber' && 'border-[rgba(224,160,48,0.5)] text-[#e0a030]',
              PROVENANCE_TONE[doc.provenance] === 'teal' && 'border-[rgba(46,168,160,0.5)] text-[#2ea8a0]'
            )}
          >
            {doc.provenance}
          </span>
          <span className={cn('vvu-label text-[8px] text-[#7a8a6e] shrink-0', open && 'text-[#c8ff00]')}>
            {open ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 space-y-3 border-t border-[rgba(107,138,64,0.2)] pt-3">
          <p className="vvu-label text-[7px] leading-relaxed text-[#e0a030] border-l-2 border-[rgba(224,160,48,0.5)] pl-2.5">
            {PROVENANCE_NOTE[doc.provenance]}
          </p>
          {isLoading && <p className="vvu-label text-[8px] text-[#7a8a6e] animate-pulse">reading from disk…</p>}
          {isError && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="vvu-label text-[8px] text-[#e5484d]">DOC UNREADABLE ON DISK</span>
              <button
                onClick={() => refetch()}
                className="vvu-label text-[8px] min-h-[36px] px-3 rounded-sm border border-[rgba(229,72,77,0.5)] text-[#e5484d] hover:bg-[rgba(229,72,77,0.08)] transition-colors"
              >
                RETRY
              </button>
            </div>
          )}
          {data && (
            <>
              <div className="overflow-x-auto rounded-sm border border-[rgba(107,138,64,0.25)] bg-[#040604]">
                <pre className="font-mono text-[7px] sm:text-[7.5px] leading-[1.5] text-[#a9c49a] p-2.5 whitespace-pre-wrap break-words max-h-[480px] overflow-y-auto vvu-scroll">
                  {data.markdown}
                </pre>
              </div>
              <div className="flex items-center justify-between gap-2 flex-wrap border-t border-[rgba(107,138,64,0.15)] pt-3">
                <span className="vvu-label text-[7px] text-[#7a8a6e] tabular-nums">
                  {data.path} · {data.bytes.toLocaleString('en-ZA')} bytes · disk-canonical
                </span>
                <button
                  onClick={() => onCopy(data.markdown, doc.title, 'FLEET_DOC')}
                  className="vvu-label text-[8px] min-h-[36px] px-3 rounded-sm border border-[rgba(107,138,64,0.35)] text-[#c9d4bd] hover:border-[rgba(200,255,0,0.5)] hover:text-[#c8ff00] transition-all flex items-center gap-1.5"
                >
                  <Copy className="w-3 h-3" aria-hidden /> COPY MARKDOWN
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </article>
  );
}

// ─── Blog full-post expander — reads the published file from disk ───────────

function BlogFullPost({ onCopy }: { onCopy: (text: string, label: string, kind: string) => void }) {
  const [open, setOpen] = useState(false);
  const sendWormLog = useSendWormLog();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['fleet-doc', 'blog_post'],
    enabled: open,
    queryFn: async () => {
      const r = await fetch('/api/vvu/fleet-docs?doc=blog_post');
      if (!r.ok) throw new Error('blog post unreadable');
      return (await r.json()) as { path: string; bytes: number; markdown: string };
    },
    staleTime: 5 * 60_000,
  });

  return (
    <div className="rounded-sm border border-[rgba(107,138,64,0.3)] bg-[#0b0f0a] p-3 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={() => {
            setOpen(!open);
            if (!open) {
              sendWormLog('FLEET_DOC_OPEN', 'OPERATOR', 'blog_post opened — the published file, from disk');
            }
          }}
          aria-expanded={open}
          className="vvu-label text-[8.5px] min-h-[44px] px-4 rounded-sm border border-[rgba(200,255,0,0.45)] text-[#c8ff00] hover:bg-[rgba(200,255,0,0.07)] transition-all select-none"
        >
          {open ? '▲ CLOSE FULL POST' : '▼ READ THE FULL POST — FROM DISK'}
        </button>
        {data && (
          <span className="vvu-label text-[7px] text-[#7a8a6e] tabular-nums">
            {data.path} · {data.bytes.toLocaleString('en-ZA')} bytes
          </span>
        )}
      </div>
      {open && (
        <div className="space-y-2.5">
          {isLoading && <p className="vvu-label text-[8px] text-[#7a8a6e] animate-pulse">reading from disk…</p>}
          {isError && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="vvu-label text-[8px] text-[#e5484d]">POST UNREADABLE ON DISK</span>
              <button
                onClick={() => refetch()}
                className="vvu-label text-[8px] min-h-[36px] px-3 rounded-sm border border-[rgba(229,72,77,0.5)] text-[#e5484d] hover:bg-[rgba(229,72,77,0.08)] transition-colors"
              >
                RETRY
              </button>
            </div>
          )}
          {data && (
            <>
              <div className="overflow-x-auto rounded-sm border border-[rgba(107,138,64,0.25)] bg-[#040604]">
                <pre className="font-mono text-[7px] sm:text-[7.5px] leading-[1.5] text-[#a9c49a] p-2.5 whitespace-pre-wrap break-words max-h-[520px] overflow-y-auto vvu-scroll">
                  {data.markdown}
                </pre>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => onCopy(data.markdown, BLOG_META.title, 'BLOG_POST')}
                  className="vvu-label text-[8px] min-h-[36px] px-3 rounded-sm border border-[rgba(107,138,64,0.35)] text-[#c9d4bd] hover:border-[rgba(200,255,0,0.5)] hover:text-[#c8ff00] transition-all flex items-center gap-1.5"
                >
                  <Copy className="w-3 h-3" aria-hidden /> COPY PUBLISHED MARKDOWN
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
