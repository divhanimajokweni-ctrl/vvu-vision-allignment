'use client';

// src/components/analytics/AnalyticsWorkspace.tsx — Route 2 / #/analytics.
// "Here's why this matters — Trust Gates, compliance, B-BBEE."
// Root scrolls inside the app shell main; the lime bottom-right toggle needs
// pb-24 clearance. Renders: headline strip + sim clock/speed control, then
// TrustGates, MoiVoting, MrrPanel, OutreachPanel (Task 14-a — real outreach
// engine), FinancialScenarios, BbbeePanel, WormLedger and RoadmapDfa. An
// amber banner shows when the telemetry service is offline.

import { AlertTriangle, Building2 } from 'lucide-react';
import { useConnected, useFrame, useSendWormLog, useSetInspectNode, useSetSimSpeed, useVvuSocketStore } from '@/hooks/use-vvu-socket';
import { cn } from '@/lib/utils';
import { Chip, ScadaPolishStyles, SectionReveal } from './shared';
import CityGisBench from '@/components/spatial/CityGisBench';
import CityHudPanels from '@/components/spatial/CityHudPanels';
import NodeInspector from '@/components/spatial/NodeInspector';
import TrustGates from './TrustGates';
import MoiVoting from './MoiVoting';
import MrrPanel from './MrrPanel';
import OutreachPanel from './OutreachPanel';
import FinancialScenarios from './FinancialScenarios';
import BbbeePanel from './BbbeePanel';
import WormLedger from './WormLedger';
import CardSyncPanel from './CardSyncPanel';
import ReleaseManifest from './ReleaseManifest';
import RoadmapDfa from './RoadmapDfa';
import AuditLogPanel from './AuditLogPanel';

const SPEED_STEPS = [1, 5, 20] as const;

function SimClockControl() {
  const frame = useFrame();
  const setSimSpeed = useSetSimSpeed();
  const m = frame?.metrics ?? null;
  const speed = m?.speedMultiplier ?? null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="vvu-panel-solid min-h-[44px] px-3 flex items-center gap-2">
        <span
          className={cn('w-1.5 h-1.5 rounded-full shrink-0', m ? 'vvu-pulse' : 'bg-[#7a8a6e]')}
          style={m ? { background: '#c8ff00' } : undefined}
          aria-hidden
        />
        <span className="vvu-label text-[10px] text-[#7a8a6e]">
          SIM MONTH <b className="text-[#f3e38a] tabular-nums">{m ? m.simMonth : '—'}</b> · DAY{' '}
          <b className="text-[#f3e38a] tabular-nums">{m ? m.simDay : '—'}</b>
        </span>
      </div>
      <div className="vvu-panel-solid p-1 flex items-center gap-1" role="group" aria-label="simulation clock speed control">
        {SPEED_STEPS.map((s) => {
          const active = speed === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSimSpeed(s)}
              aria-pressed={active}
              aria-label={`set simulation speed to ${s} times`}
              // Task 8-a: pressed affordance — the ACTIVE chip gets an inset
              // shadow so the lime fill reads physically depressed; inactive
              // chips sit on a slightly dimmer border.
              style={active ? { boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.45)' } : undefined}
              className={cn(
                'vvu6c-btn vvu-label text-[10px] font-bold min-h-[42px] min-w-[44px] px-2.5 rounded border transition-colors',
                active
                  ? 'bg-[#c8ff00] text-[#060806] border-[#c8ff00]'
                  : 'border-[rgba(107,138,64,0.25)] text-[#8fb35a] hover:border-[#8fb35a] hover:text-[#c9d4bd]'
              )}
            >
              ×{s}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AnalyticsWorkspace() {
  const connected = useConnected();
  const inspectNodeId = useVvuSocketStore((s) => s.inspectNodeId);
  const setInspectNode = useSetInspectNode();
  const sendWormLog = useSendWormLog();

  // Round 12 — city bench node selection (pod tap → inspector overlay) and
  // the pin toggle, mirroring SpatialWorkspace's handlers so the inspector
  // behaves identically on both projections.
  const handleTogglePin = () => {
    const s = useVvuSocketStore.getState();
    const next = !s.inspectPinned;
    s.toggleInspectPin();
    if (s.inspectNodeId) {
      sendWormLog(
        'NODE_PIN',
        'OPERATOR',
        `${s.inspectNodeId} ${next ? 'PINNED — selection survives view switches' : 'UNPINNED'}`,
      );
    }
  };

  return (
    // Round 13 — outer static container + inner scroll area: the
    // NodeInspector sits OUTSIDE the scroll container so its absolute
    // positioning stays pinned to the viewport instead of scrolling away
    // with the content (same HUD behaviour as the spatial view).
    <div className="absolute inset-0">
    <div className="absolute inset-0 overflow-y-auto">
      {/* Task 6-c polish pass: keyframes + micro-interaction CSS, mounted once */}
      <ScadaPolishStyles />
      {/* Task 7-b: section rhythm bumped one step (5/6) for breathing room
          between the nine panels — every section keeps p-4 sm:p-5 padding. */}
      <div className="max-w-[1320px] mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-5 sm:space-y-6 pb-24">
        {!connected && (
          <div
            className="vvu-panel-solid px-4 py-2 flex items-center gap-2"
            style={{ borderColor: 'rgba(224,160,48,0.45)' }}
            role="status"
          >
            <AlertTriangle className="size-3.5 text-[#e0a030] shrink-0" aria-hidden />
            <span className="vvu-label text-[10px] text-[#e0a030]">TELEMETRY SERVICE OFFLINE · LIVE FIGURES FROZEN</span>
          </div>
        )}

        {/* headline strip */}
        <SectionReveal>
          <section className="vvu-panel vvu-enter p-4 sm:p-5" aria-label="analytics headline">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="min-w-0">
                <h1 className="vvu-label text-lg sm:text-2xl font-bold text-[#f3e38a] tracking-[0.14em]">HERE&apos;S WHY THIS MATTERS</h1>
                <div className="flex flex-wrap items-center gap-2 mt-2.5">
                  <Chip tone="lime">TRUST GATES · COMPLIANCE · B-BBEE</Chip>
                  <Chip tone="dim" dashed>
                    ROUTE 2 · ANALYTICS PROJECTION
                  </Chip>
                </div>
              </div>
              <SimClockControl />
            </div>
          </section>
        </SectionReveal>

        {/* Task 6-c: each section fades+rises into view on scroll (once),
            with SCADA corner brackets — lime on the featured panels. */}
        {/* Round 12 — the CITY DIGITAL TWIN GIS bench: same scene as the
            operator view (N01–N06 embedded on pipeline mains, 5 layers, YOLO
            movers), 8+4 grid on lg with the SYS.02/SYS.03 panels beside it. */}
        <SectionReveal featured>
          <section className="vvu-panel vvu-enter p-4 sm:p-5" aria-label="city digital twin GIS bench">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <h2 className="vvu-label text-base sm:text-xl font-bold text-[#f3e38a] tracking-[0.14em] flex items-center gap-2.5">
                  <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#c8ff00] shrink-0" aria-hidden="true" />
                  CITY DIGITAL TWIN · GIS BENCH
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-2.5">
                  <Chip tone="lime">MAP_SYNC · ALIGNED</Chip>
                  <Chip tone="dim">5 LAYERS ACTIVE</Chip>
                  <Chip tone="dim">GEO_GRID · S33°57’38” E25°36’07”</Chip>
                  <Chip tone="dim" dashed>
                    YOLO V8 NANO · 25R · 14 CRITICAL
                  </Chip>
                </div>
              </div>
              <div className="vvu-label text-[8px] sm:text-[9px] text-[#7a8a6e] sm:text-right leading-relaxed shrink-0">
                TELEMETRY EMBEDDED IN THE CITY — NOT AN ISOLATED MAST
                <br />
                TAP A NODE POD (N01–N06) FOR THE INSPECTOR · DRAG TO ORBIT
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-8 relative h-[280px] lg:h-[500px] rounded-sm border border-[rgba(107,138,64,0.3)] overflow-hidden bg-[#060806]">
                <CityGisBench onNodeSelect={setInspectNode} />
              </div>
              <div className="lg:col-span-4 min-w-0">
                <CityHudPanels variant="inline" />
              </div>
            </div>
          </section>
        </SectionReveal>

        <SectionReveal featured>
          <TrustGates num="1" />
        </SectionReveal>
        <SectionReveal featured>
          <MoiVoting num="2" />
        </SectionReveal>
        <SectionReveal>
          <MrrPanel num="3" />
        </SectionReveal>
        {/* Task 14-a — the REAL pilot outreach engine (Resend REST, POPIA
            s69 gated). Placed beside the MRR/pipeline scorecard it feeds —
            the sim pipeline counters live in MrrPanel; this panel drives
            actual target rows, consent gates and email sends/previews. */}
        <SectionReveal>
          <OutreachPanel num="4" />
        </SectionReveal>
        <SectionReveal>
          <FinancialScenarios num="5" />
        </SectionReveal>
        <SectionReveal>
          <BbbeePanel num="6" />
        </SectionReveal>
        <SectionReveal>
          <WormLedger num="7" />
        </SectionReveal>
        <SectionReveal>
          <ReleaseManifest num="8" />
        </SectionReveal>
        <SectionReveal>
          <RoadmapDfa num="9" />
        </SectionReveal>
        <SectionReveal>
          <AuditLogPanel num="10" />
        </SectionReveal>
        {/* §11 — the Field OS Card sync endpoint's live status (the
            CARD-SYNC.md contract): real capture-store state, chain
            integrity, newest accepted captures. Read-only; the card is
            the writer. */}
        <SectionReveal>
          <CardSyncPanel num="11" />
        </SectionReveal>
      </div>
    </div>

    {/* node inspector overlay — shared with the spatial view so city bench
        pod taps open the same panel; pinned OUTSIDE the scroll container
        (Round 13) so it stays put while the analyst scrolls */}
    <NodeInspector nodeId={inspectNodeId} onClose={() => setInspectNode(null)} onTogglePin={handleTogglePin} />
    </div>
  );
}

export default AnalyticsWorkspace;
