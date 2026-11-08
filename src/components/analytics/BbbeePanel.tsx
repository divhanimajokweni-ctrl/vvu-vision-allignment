'use client';

// src/components/analytics/BbbeePanel.tsx — B-BBEE / ESD compliance: Level 1
// contributor badge, 135% procurement math, ESD 1.5% NPAT + year-end hunting
// season callout, the 30-second verification flow stepper and WhatsApp quick
// reply scripts with clipboard copy.

import { ArrowRight, CalendarClock, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BBEEE, ESD_VERIFICATION_FLOW, WHATSAPP_QUICK_REPLIES } from '@/lib/vvu-data';
import { Chip, SectionHeader } from './shared';

const TOTAL_VERIFY_SECONDS = ESD_VERIFICATION_FLOW.reduce((acc, s) => acc + s.seconds, 0);

async function copyScript(shortcut: string, script: string) {
  try {
    await navigator.clipboard.writeText(script);
    toast.success(`${shortcut} SCRIPT COPIED`, { description: 'Paste straight into WhatsApp' });
  } catch {
    toast.error('CLIPBOARD UNAVAILABLE', { description: 'Select the script text and copy manually' });
  }
}

export function BbbeePanel({ num }: { num?: string }) {
  return (
    <section className="vvu-panel vvu-enter p-4 sm:p-5" aria-label="B-BBEE and ESD compliance">
      <SectionHeader
        num={num}
        title="B-BBEE / ESD COMPLIANCE"
        kicker="CHAPTER 5 · APPENDIX A · PROOFBRIDGE SUPPLIER VERIFICATION"
        right={<Chip tone="lime">LEVEL 1 · 135%</Chip>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── left: badge, company, 135% math, ESD + hunting season ── */}
        <div className="space-y-4 min-w-0">
          <div className="vvu-panel-solid p-4 flex flex-wrap items-center gap-4">
            <div
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 border-[#c8ff00] flex flex-col items-center justify-center shrink-0"
              style={{ boxShadow: '0 0 24px rgba(200,255,0,0.12)' }}
              aria-label="Level 1 B-BBEE contributor badge"
            >
              <span className="vvu-label text-[9px] text-[#7a8a6e]">LEVEL</span>
              <span className="text-3xl font-bold text-[#c8ff00] leading-none">1</span>
              <span className="vvu-label text-[7px] text-[#7a8a6e] mt-0.5">B-BBEE</span>
            </div>
            <div className="min-w-0">
              <div className="vvu-label text-[10px] font-bold text-[#c8ff00]">LEVEL 1 B-BBEE CONTRIBUTOR</div>
              <div className="text-3xl sm:text-4xl font-bold text-[#f3e38a] leading-tight mt-1 tabular-nums">{BBEEE.recognition}%</div>
              <div className="vvu-label text-[9px] text-[#7a8a6e]">PROCUREMENT RECOGNITION</div>
            </div>
          </div>

          <div className="vvu-panel-solid p-3">
            <div className="text-sm font-bold text-[#c9d4bd]">{BBEEE.company}</div>
            <div className="vvu-label text-[9px] text-[#7a8a6e] mt-1">REG {BBEEE.reg}</div>
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              <Chip tone="lime">SARS ✓</Chip>
              <Chip tone="lime">CIPC ✓</Chip>
              <Chip tone="lime">B-BBEE ✓</Chip>
              <Chip tone="sage">{BBEEE.blackOwned}% BLACK OWNED</Chip>
            </div>
          </div>

          <div className="vvu-panel-solid p-3">
            <div className="vvu-label text-[9px] text-[#7a8a6e] mb-2.5">{BBEEE.recognition}% PROCUREMENT MATH</div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex-1 min-w-0 text-center border border-[#8fb35a]/40 rounded p-2.5">
                <div className="text-lg font-bold text-[#8fb35a] tabular-nums">R100k</div>
                <div className="vvu-label text-[8px] text-[#7a8a6e] mt-0.5">SPENT WITH VVU</div>
              </div>
              <ArrowRight className="size-5 text-[#c8ff00] shrink-0" aria-hidden />
              <div className="flex-1 min-w-0 text-center border border-[#c8ff00]/60 rounded p-2.5" style={{ background: 'rgba(200,255,0,0.05)' }}>
                <div className="text-lg font-bold text-[#c8ff00] tabular-nums">R135k</div>
                <div className="vvu-label text-[8px] text-[#7a8a6e] mt-0.5">CLAIMED ON SCORECARD</div>
              </div>
            </div>
          </div>

          <div className="vvu-panel-solid p-3 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="sage">ESD · {BBEEE.esdNpatPct}% OF NPAT</Chip>
              <span className="text-[10px] text-[#7a8a6e] leading-relaxed">must be spent on enterprise &amp; supplier development beneficiaries</span>
            </div>
            <div
              className="rounded border p-2.5 flex items-start gap-2"
              style={{ borderColor: 'rgba(224,160,48,0.45)', background: 'rgba(224,160,48,0.05)' }}
            >
              <CalendarClock className="size-4 text-[#e0a030] shrink-0 mt-0.5" aria-hidden />
              <p className="text-[10px] text-[#e0a030]/90 leading-relaxed">
                <b className="vvu-label text-[9px]">YEAR-END HUNTING SEASON</b> — mines lose unspent ESD budgets Nov–Jan. Close pilots
                before the fiscal year resets: a Level 1 supplier at {BBEEE.recognition}% recognition is the quickest scorecard win left.
              </p>
            </div>
          </div>
        </div>

        {/* ── right: verification flow + WhatsApp quick replies ── */}
        <div className="space-y-4 min-w-0">
          <div className="vvu-panel-solid p-4">
            <div className="vvu-label text-[9px] text-[#7a8a6e] mb-3">30-SECOND VERIFICATION FLOW · CIPC → B-BBEE → SARS</div>
            <ol>
              {ESD_VERIFICATION_FLOW.map((step, i) => (
                <li key={step.step} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < ESD_VERIFICATION_FLOW.length - 1 && (
                    <span aria-hidden className="absolute left-[15px] top-9 bottom-1 w-px bg-[rgba(107,138,64,0.3)]" />
                  )}
                  <span className="w-8 h-8 rounded-full border border-[#8fb35a]/60 text-[#8fb35a] vvu-label text-[10px] font-bold flex items-center justify-center shrink-0">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="vvu-label text-[11px] font-bold text-[#c9d4bd]">{step.step}</span>
                      <Chip tone="teal">{step.seconds}s</Chip>
                    </div>
                    <p className="text-[10px] text-[#7a8a6e] mt-0.5">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-2 pt-3 border-t border-[rgba(107,138,64,0.25)] flex flex-wrap items-center gap-2">
              <Chip tone="lime">Σ {TOTAL_VERIFY_SECONDS} SECONDS</Chip>
              <span className="vvu-label text-[8px] text-[#7a8a6e]">FULL SUPPLIER VERIFICATION · NO PHONE CALLS</span>
            </div>
          </div>

          <div className="vvu-panel-solid p-4 min-w-0">
            <div className="vvu-label text-[9px] text-[#7a8a6e] mb-3">WHATSAPP QUICK REPLIES · APPENDIX A.2</div>
            <Tabs defaultValue={WHATSAPP_QUICK_REPLIES[0]?.shortcut ?? '/verify'}>
              <TabsList className="w-full flex-wrap h-auto gap-1">
                {WHATSAPP_QUICK_REPLIES.map((q) => (
                  <TabsTrigger
                    key={q.shortcut}
                    value={q.shortcut}
                    className="vvu-label text-[9px] font-bold data-[state=active]:text-[#c8ff00] px-3"
                  >
                    {q.shortcut}
                  </TabsTrigger>
                ))}
              </TabsList>
              {WHATSAPP_QUICK_REPLIES.map((q) => (
                <TabsContent key={q.shortcut} value={q.shortcut} className="mt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <Chip tone="sage">SCRIPT · {q.shortcut}</Chip>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void copyScript(q.shortcut, q.script)}
                      className="vvu6c-btn min-h-[44px] vvu-label text-[9px] font-bold border-[#8fb35a]/50 text-[#8fb35a] hover:bg-[#8fb35a]/10 hover:text-[#8fb35a] hover:border-[#8fb35a]"
                      aria-label={`copy ${q.shortcut} script to clipboard`}
                    >
                      <Copy className="size-3.5" aria-hidden /> COPY
                    </Button>
                  </div>
                  <pre className="whitespace-pre-wrap break-words text-[10px] leading-relaxed text-[#c9d4bd] bg-[#060806] border border-[rgba(107,138,64,0.25)] rounded p-3 max-h-44 overflow-y-auto">
                    {q.script}
                  </pre>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </div>
      </div>
    </section>
  );
}

export default BbbeePanel;
