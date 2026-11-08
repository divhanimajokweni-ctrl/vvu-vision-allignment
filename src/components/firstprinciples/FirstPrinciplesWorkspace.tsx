'use client';

// src/components/firstprinciples/FirstPrinciplesWorkspace.tsx — Round 56 ·
// #/firstprinciples — FIRST PRINCIPLES: the laws beneath the signals.
//
// Four sections, one per video (chemistry · physics · biology · maths), the
// coupling matrix between the disciplines, and the honest-limits table —
// the same source-tag discipline as the estate's other projections:
//
//   MEASURED (lime) · REPORTED (sage) · DERIVED (ochre) · SPEC (amber)
//
// The projection does not claim the estate's models will improve. It claims
// the models will have the LAWS available to them, and the laws are the
// correct ones for the signals being read.

import {
  FIRST_PRINCIPLES_CLAIMS,
  FIRST_PRINCIPLES_ONE_SENTENCE,
  FIRST_PRINCIPLES_SECTIONS,
  COUPLINGS,
} from '@/lib/first-principles';

const TAG_TONE: Record<string, string> = {
  MEASURED: 'border-[#c8ff00]/50 text-[#c8ff00]',
  REPORTED: 'border-[#8fb35a]/50 text-[#8fb35a]',
  DERIVED: 'border-[#f3e38a]/50 text-[#f3e38a]',
  SPEC: 'border-[#e0a030]/50 text-[#e0a030]',
};

const DISCIPLINE_LABEL: Record<string, string> = {
  chemistry: 'CHEM',
  physics: 'PHYS',
  biology: 'BIO',
  maths: 'MATH',
};

export function FirstPrinciplesWorkspace() {
  return (
    <div className="absolute inset-0 overflow-y-auto vvu-grid-bg" role="region" aria-label="First principles — the laws beneath the signals">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 pb-28 pt-6 space-y-5">
        {/* ── title block ── */}
        <section className="vvu-panel-solid p-4 sm:p-6" aria-labelledby="fp-title">
          <div className="flex flex-wrap items-center gap-2">
            <span className="vvu-label text-[10px] text-[#c8ff00] border border-[#c8ff00]/40 px-2 py-0.5">
              ROUND 56 · #/FIRSTPRINCIPLES
            </span>
            <span className="vvu-label text-[9px] px-2 py-0.5 rounded border border-[#e0a030]/50 text-[#e0a030]">
              SUBSTRATE, NOT SURFACE
            </span>
          </div>
          <h1 id="fp-title" className="vvu-label text-xl sm:text-2xl font-bold text-[#f3e38a] tracking-[0.18em] mt-2">
            FIRST PRINCIPLES · THE LAWS BENEATH THE SIGNALS
          </h1>
          <p className="vvu-label text-[9px] sm:text-[10px] text-[#7a8a6e] mt-2 max-w-4xl leading-relaxed">
            BIOLOGY · PHYSICS · MATHS · CHEMISTRY ARE NOT FOUR SUBJECTS — THEY ARE FOUR VIEWS OF THE SAME SUBSTRATE. THE
            ESTATE&apos;S LIVE SIGNALS ARE THE SURFACE; THESE ARE THE RULES THAT GENERATE IT. A MODEL THAT SEES ONLY THE
            SURFACE CAN INTERPOLATE — A MODEL THAT HOLDS THE LAWS CAN REASON ABOUT WHY A READING IS WHAT IT IS, AND WHAT
            IT WILL DO NEXT.
          </p>
          <p className="vvu-label text-[8px] text-[#7a8a6e] mt-2">
            TAGS — <span className="text-[#c8ff00]">MEASURED</span> THE ESTATE READS THIS SIGNAL ·{' '}
            <span className="text-[#8fb35a]">REPORTED</span> THE VIDEO STATES THIS LAW ·{' '}
            <span className="text-[#f3e38a]">DERIVED</span> THE COUPLING IS COMPUTED FROM THE LAW ·{' '}
            <span className="text-[#e0a030]">SPEC</span> PROPOSED, NOT YET VALIDATED ON LIVE DATA
          </p>
        </section>

        {/* ─§1–§4 the four disciplines ── */}
        {FIRST_PRINCIPLES_SECTIONS.map((section, idx) => (
          <section
            key={section.key}
            className="vvu-panel-solid p-4 sm:p-6"
            aria-labelledby={`fp-${section.key}-title`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id={`fp-${section.key}-title`} className="vvu-label text-sm font-bold text-[#f3e38a] tracking-[0.18em]">
                §{idx + 1} {section.label}
              </h2>
              <span className="vvu-label text-[9px] text-[#7a8a6e]">
                {section.duration} · {section.path}
              </span>
            </div>
            <ul className="mt-3 space-y-2.5">
              {section.bridges.map((bridge) => (
                <li key={bridge.id} className="border border-[#6b8a40]/30 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`vvu-label text-[8px] px-1.5 py-0.5 border ${TAG_TONE[bridge.tag] ?? 'border-[#6b8a40]/40 text-[#c9d4bd]'}`}>
                      {bridge.tag}
                    </span>
                    <span className="vvu-label text-[10px] font-bold text-[#c8ff00]">{bridge.videoChapter}</span>
                    <span className="vvu-label text-[8px] text-[#7a8a6e]">→ {bridge.estateSignal}</span>
                    {'liveValue' in bridge && bridge.liveValue && (
                      <span className="vvu-label text-[8px] text-[#8fb35a] tabular-nums">{bridge.liveValue}</span>
                    )}
                  </div>
                  <p className="vvu-label text-[9px] text-[#c9d4bd]/85 mt-2 leading-relaxed">
                    <span className="text-[#7a8a6e]">LAW · </span>
                    {bridge.law}
                  </p>
                  <p className="vvu-label text-[9px] text-[#c9d4bd]/85 mt-1.5 leading-relaxed">
                    <span className="text-[#7a8a6e]">COUPLING · </span>
                    {bridge.coupling}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {/* ── the coupling matrix ── */}
        <section className="vvu-panel-solid p-4 sm:p-6" aria-labelledby="fp-couplings-title">
          <h2 id="fp-couplings-title" className="vvu-label text-sm font-bold text-[#f3e38a] tracking-[0.18em]">
            THE COUPLING MATRIX — THE DISCIPLINES ARE NOT SEPARATE EITHER
          </h2>
          <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
            {COUPLINGS.map((c, i) => (
              <li key={i} className="border border-[#6b8a40]/30 p-3 flex items-start gap-2.5">
                <span className="vvu-label text-[8px] px-1.5 py-0.5 border border-[#c8ff00]/40 text-[#c8ff00] whitespace-nowrap mt-0.5">
                  {DISCIPLINE_LABEL[c.from]} → {DISCIPLINE_LABEL[c.to]}
                </span>
                <div className="min-w-0">
                  <p className="vvu-label text-[9px] font-bold text-[#f3e38a]">{c.via.toUpperCase()}</p>
                  <p className="vvu-label text-[9px] text-[#c9d4bd]/80 mt-1 leading-relaxed">{c.example}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ── §5 honest limits ── */}
        <section className="vvu-panel-solid p-4 sm:p-6" aria-labelledby="fp-limits-title">
          <h2 id="fp-limits-title" className="vvu-label text-sm font-bold text-[#f3e38a] tracking-[0.18em]">
            §5 · HONEST LIMITS
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left border-collapse vvu-label text-[9px]">
              <thead>
                <tr className="text-[#7a8a6e]">
                  <th scope="col" className="border-b border-[#6b8a40]/40 py-2 pr-3 font-bold">CLAIM</th>
                  <th scope="col" className="border-b border-[#6b8a40]/40 py-2 pr-3 font-bold">STATUS</th>
                  <th scope="col" className="border-b border-[#6b8a40]/40 py-2 font-bold">NOTE</th>
                </tr>
              </thead>
              <tbody>
                {FIRST_PRINCIPLES_CLAIMS.map((c) => (
                  <tr key={c.claim} className="align-top">
                    <td className="border-b border-[#6b8a40]/20 py-2 pr-3 text-[#c9d4bd]">{c.claim}</td>
                    <td className="border-b border-[#6b8a40]/20 py-2 pr-3 text-[#f3e38a] whitespace-nowrap">{c.status}</td>
                    <td className="border-b border-[#6b8a40]/20 py-2 text-[#7a8a6e] leading-relaxed">{c.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="vvu-label text-[9px] text-[#c9d4bd]/85 mt-4 leading-relaxed border-l-2 border-[#c8ff00]/50 pl-3">
            {FIRST_PRINCIPLES_ONE_SENTENCE}
          </p>
        </section>
      </div>
    </div>
  );
}
