'use client';

// src/components/fieldkit/FieldKitWorkspace.tsx — Round 29 · eighth projection
// #/fieldkit — the FIELD KIT: CAMPUS WALK.
//
// Why this exists: the operator carries a five-part field kit into lecturer
// conversations (NMU campus walk). Parts 1–3 and 5 are the kit's own content
// (leave-behind · four trust bottlenecks · three questions · faculty map).
// Part 4 — the CAPTURE TEMPLATE — is a WORKING form here: the "people notes"
// filled in per lecturer, persisted server-side and WORM-logged
// (FIELDKIT_CAPTURE_SAVED). The view closes with the Q3 digest — every
// captured trust condition listed as the design constraints for whatever
// ProofBridge becomes next.
//
// Honesty: no sample captures are seeded. The table starts EMPTY; the stats
// read zero until real notes exist.

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  clearEstateDraft,
  countDraftWords,
  FIELDKIT_CAPTURE_DRAFT_KEY,
  readEstateDraft,
  writeEstateDraft,
} from '@/lib/estate-drafts';
import {
  Camera,
  ClipboardList,
  Copy,
  Landmark,
  MessageSquareQuote,
  NotebookPen,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Chip, LiveDot, QueryErrorCard, SectionHeader, SectionReveal, fmtStamp } from '@/components/analytics/shared';
import { cn } from '@/lib/utils';
import {
  BOTTLENECK_LABELS,
  BOTTLENECKS,
  FACULTY_OPTIONS,
  ON_THE_HORSE,
  BEFORE_YOU_WALK,
  THREE_QUESTIONS,
  TRUST_BOTTLENECKS,
  WOULD_USE_ANSWERS,
  bottleneckVerdict,
  wouldUseTone,
} from '@/lib/fieldkit';
import type {
  FieldKitCaptureResult,
  FieldKitResponse,
  TrustBottleneck,
  WouldUseAnswer,
} from '@/types/vvu';

// ─── fetch helpers ───────────────────────────────────────────────────────────

async function getFieldKit(): Promise<FieldKitResponse> {
  const res = await fetch('/api/vvu/fieldkit', { cache: 'no-store' });
  if (!res.ok) throw new Error(`FIELDKIT FEED HTTP ${res.status}`);
  return (await res.json()) as FieldKitResponse;
}

async function saveCapture(form: CaptureForm): Promise<FieldKitCaptureResult> {
  const res = await fetch('/api/vvu/fieldkit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(form),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string; issues?: string[] } | null;
    throw new Error(body?.issues?.join(' · ') ?? body?.error ?? `SAVE HTTP ${res.status}`);
  }
  return (await res.json()) as FieldKitCaptureResult;
}

async function removeCapture(id: string): Promise<void> {
  const res = await fetch(`/api/vvu/fieldkit?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `DELETE HTTP ${res.status}`);
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ─── capture form state ──────────────────────────────────────────────────────

type CaptureForm = {
  lecturer: string;
  faculty: string;
  field: string;
  q1Unverifiable: string;
  q2FailurePath: string;
  q3TrustCondition: string;
  dominantBottleneck: TrustBottleneck;
  wouldUse: WouldUseAnswer;
  offered: string;
  followUp: string;
};

const EMPTY_FORM: CaptureForm = {
  lecturer: '',
  faculty: '',
  field: '',
  q1Unverifiable: '',
  q2FailurePath: '',
  q3TrustCondition: '',
  dominantBottleneck: 'INSTITUTIONAL_TRUST',
  wouldUse: 'MAYBE',
  offered: '',
  followUp: '',
};

// ─── workspace ───────────────────────────────────────────────────────────────

// The capture template's own fields — the draft engine's shape contract.
// All ten are strings; a stored draft missing ANY of them is a broken draft
// and renders empty (never half-restore).
const CAPTURE_DRAFT_FIELDS = [
  'lecturer',
  'faculty',
  'field',
  'q1Unverifiable',
  'q2FailurePath',
  'q3TrustCondition',
  'dominantBottleneck',
  'wouldUse',
  'offered',
  'followUp',
] as const;

export function FieldKitWorkspace() {
  const queryClient = useQueryClient();
  // THE SURVIVING TEMPLATE (R194) — the form's words survive the storm's
  // bounces: read once at mount (server renders empty — typeof window),
  // written on every set, cleared on CLEAR and on a successful save (a
  // submitted note is a WORM row, not a draft — the ghost law).
  const [draftBoot] = useState(() => {
    if (typeof window === 'undefined') {
      return { form: EMPTY_FORM, restored: null as Record<string, string> | null };
    }
    const restored = readEstateDraft(window.localStorage, FIELDKIT_CAPTURE_DRAFT_KEY, CAPTURE_DRAFT_FIELDS);
    return { form: (restored as CaptureForm | null) ?? EMPTY_FORM, restored };
  });
  const [form, setForm] = useState<CaptureForm>(draftBoot.form);
  const [draftEcho, setDraftEcho] = useState(draftBoot.restored !== null);
  const [draftWords] = useState(() => (draftBoot.restored ? countDraftWords(draftBoot.restored) : 0));
  const [copied, setCopied] = useState(false);

  const fieldQuery = useQuery({
    queryKey: ['fieldkit'],
    queryFn: getFieldKit,
    refetchInterval: 15_000,
  });

  const saveMutation = useMutation({
    mutationFn: saveCapture,
    onSuccess: (result) => {
      toast.success(`CAPTURE SAVED · WORM #${result.wormSeq}`, {
        description: `${result.capture.lecturer} · ${BOTTLENECK_LABELS[result.capture.dominantBottleneck]} · would-use ${result.capture.wouldUse}`,
      });
      setForm(EMPTY_FORM);
      if (typeof window !== 'undefined') {
        clearEstateDraft(window.localStorage, FIELDKIT_CAPTURE_DRAFT_KEY);
      }
      setDraftEcho(false);
      void queryClient.invalidateQueries({ queryKey: ['fieldkit'] });
    },
    onError: (e: Error) => toast.error('CAPTURE REJECTED', { description: e.message }),
  });

  const removeMutation = useMutation({
    mutationFn: removeCapture,
    onSuccess: (_void, id) => {
      toast.success('CAPTURE REMOVED', { description: `WORM row remains (append-only, by design) · id ${id.slice(0, 8)}…` });
      void queryClient.invalidateQueries({ queryKey: ['fieldkit'] });
    },
    onError: (e: Error) => toast.error('REMOVE FAILED', { description: e.message }),
  });

  const data = fieldQuery.data;
  const stats = data?.stats;
  const maxBottleneck = useMemo(
    () => Math.max(1, ...(stats?.byBottleneck.map((b) => b.count) ?? [1])),
    [stats],
  );

  const set = <K extends keyof CaptureForm>(key: K, value: CaptureForm[K]) =>
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (typeof window !== 'undefined') {
        writeEstateDraft(window.localStorage, FIELDKIT_CAPTURE_DRAFT_KEY, next);
      }
      return next;
    });

  const formValid =
    form.lecturer.trim().length >= 2 &&
    form.faculty.trim().length >= 2 &&
    form.q1Unverifiable.trim().length >= 4 &&
    form.q2FailurePath.trim().length >= 4 &&
    form.q3TrustCondition.trim().length >= 4;

  return (
    <div className="absolute inset-0 overflow-y-auto vvu-grid-bg">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 pb-28 pt-6 space-y-5">
        {/* ── headline ── */}
        <SectionReveal featured>
          <div className="vvu-panel-solid p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="vvu-label text-[10px] text-[#c8ff00] border border-[#c8ff00]/40 px-2 py-0.5">
                    ROUND 29 · EIGHTH PROJECTION
                  </span>
                  <span className="inline-flex items-center gap-1.5 vvu-label text-[9px] text-[#c8ff00]"><LiveDot /> FIELD FEED LIVE</span>
                </div>
                <h1 className="vvu-label text-xl sm:text-3xl font-bold text-[#f3e38a] mt-3 tracking-wider">
                  FIELD KIT · CAMPUS WALK
                </h1>
                <p className="text-[11px] sm:text-sm text-[#9db08c] mt-2 max-w-2xl leading-relaxed">
                  Five-part field kit for lecturer conversations. Read between faculties; screenshot
                  sections as needed. The single most valuable thing to come back with is a stack of
                  filled-in Q3 answers — the trust conditions lecturers name.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void fieldQuery.refetch()}
                  className="min-h-[44px] vvu-label text-[10px] font-bold border-[#7a8a6e]/60 text-[#c9d4bd] hover:bg-[#7a8a6e]/10"
                >
                  <RefreshCw className={cn('w-3.5 h-3.5', fieldQuery.isFetching && 'animate-spin')} />
                  REFRESH
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
              <StatBox label="CAPTURES" value={String(stats?.captures ?? 0)} hint="people notes on file" />
              <StatBox label="Q3 CONDITIONS" value={String(stats?.trustConditions.length ?? 0)} hint="design constraints" />
              <StatBox label="FACULTIES HIT" value={String(stats?.byFaculty.length ?? 0)} hint="of 10 mapped" />
              <StatBox
                label="WOULD USE · YES"
                value={String(stats?.byWouldUse.find((w) => w.key === 'YES')?.count ?? 0)}
                hint="use-intent"
              />
            </div>
          </div>
        </SectionReveal>

        {fieldQuery.isError && (
          <QueryErrorCard label="FIELDKIT" onRetry={() => void fieldQuery.refetch()} />
        )}

        {/* ── §1 the leave-behind ── */}
        <SectionReveal>
          <div className="vvu-panel-solid p-4 sm:p-6">
            <SectionHeader
              num="1"
              title="THE LEAVE-BEHIND"
              kicker="one paragraph · show this, don't explain it"
              right={
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    const ok = await copyText(data?.leaveBehind ?? '');
                    setCopied(ok);
                    if (ok) {
                      toast.success('LEAVE-BEHIND COPIED', { description: 'Paste it anywhere · hand it over, let them read it' });
                      setTimeout(() => setCopied(false), 2000);
                    }
                  }}
                  className="min-h-[44px] vvu-label text-[10px] font-bold border-[#c8ff00]/50 text-[#c8ff00] hover:bg-[#c8ff00]/10"
                >
                  {copied ? <ClipboardList className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'COPIED' : 'COPY'}
                </Button>
              }
            />
            <div className="mt-4 bg-[#060806] border border-[#7a8a6e]/30 p-4 sm:p-6 font-mono text-[12px] sm:text-[13px] leading-relaxed text-[#d8e4c8] whitespace-pre-line">
              {data?.leaveBehind ?? '…'}
            </div>
            <p className="vvu-label text-[9px] text-[#7a8a6e] mt-3">
              PROOFBRIDGE DOES NOT DETECT LIES — IT MAKES IT IMPOSSIBLE TO CHANGE THE RECORD AFTER
              THE FACT. THE BOTTLENECK IT REMOVES: &ldquo;WE CAN&apos;T PROVE WHAT HAPPENED CHEAPLY,
              PORTABLY, AND ACROSS INSTITUTIONS THAT DON&apos;T TRUST EACH OTHER.&rdquo;
            </p>
          </div>
        </SectionReveal>

        {/* ── §2 the four trust bottlenecks ── */}
        <SectionReveal>
          <div className="vvu-panel-solid p-4 sm:p-6">
            <SectionHeader num="2" title="THE FOUR TRUST BOTTLENECKS" kicker="the taxonomy · read the map before the walk" />
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {(data?.bottlenecks ?? BOTTLENECKS).map((b) => (
                <div key={b.key} className="border border-[#7a8a6e]/30 bg-[#060806] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="vvu-label text-[11px] font-bold text-[#f3e38a]">{BOTTLENECK_LABELS[b.key]}</span>
                    <Chip tone={b.verdict === 'YES' ? 'lime' : b.verdict === 'PARTIALLY' ? 'amber' : 'crimson'}>
                      {b.verdict === 'YES' ? 'PROOFBRIDGE: YES' : b.verdict === 'PARTIALLY' ? 'PARTIALLY' : 'NO'}
                    </Chip>
                  </div>
                  <p className="text-[11px] sm:text-xs text-[#9db08c] mt-2 leading-relaxed">
                    <span className="text-[#c9d4bd]">Plain meaning:</span> {b.plainMeaning}
                  </p>
                  <p className="text-[11px] sm:text-xs text-[#9db08c] mt-1 leading-relaxed">
                    <span className="text-[#c9d4bd]">Does ProofBridge help?</span> {b.proofbridgeHelp}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </SectionReveal>

        {/* ── §3 the three questions ── */}
        <SectionReveal>
          <div className="vvu-panel-solid p-4 sm:p-6">
            <SectionHeader num="3" title="THE THREE QUESTIONS" kicker="ask in this order · write down every word of the Q3 answer" />
            <div className="mt-4 space-y-2">
              {THREE_QUESTIONS.map((q, i) => (
                <div
                  key={q.id}
                  className={cn(
                    'border p-4 bg-[#060806]',
                    q.id === 'Q3' ? 'border-[#c8ff00]/40' : 'border-[#7a8a6e]/30',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        'vvu-label shrink-0 w-10 h-10 flex items-center justify-center border font-bold',
                        q.id === 'Q3'
                          ? 'border-[#c8ff00]/60 text-[#c8ff00]'
                          : 'border-[#7a8a6e]/50 text-[#c9d4bd]',
                      )}
                    >
                      {q.id}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[12px] sm:text-sm text-[#d8e4c8] leading-relaxed">&ldquo;{q.text}&rdquo;</p>
                      <p className="vvu-label text-[9px] text-[#7a8a6e] mt-2">
                        {q.id === 'Q3' ? '★ ' : ''}
                        {q.note}
                        {i < 2 ? ` · then ${THREE_QUESTIONS[i + 1].id}` : ''}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SectionReveal>

        {/* ── §4 the capture template (working form — the people notes) ── */}
        <SectionReveal featured>
          <div className="vvu-panel-solid p-4 sm:p-6">
            <SectionHeader
              num="4"
              title="THE CAPTURE TEMPLATE"
              kicker="fill one per lecturer · saved server-side · WORM-logged"
              right={
                <Chip tone="lime">
                  <NotebookPen className="w-3 h-3 mr-1" />
                  PEOPLE NOTES
                </Chip>
              }
            />
            {draftEcho && (
              <div
                role="status"
                aria-live="polite"
                className="mt-4 flex items-center justify-between gap-3 border border-[#c8ff00]/40 bg-[#060806] px-3 py-2 shadow-[0_0_8px_rgba(200,255,0,0.15)] transition-shadow"
              >
                <span className="vvu-label text-[9px] text-[#c8ff00]">
                  DRAFT KEPT · {draftWords} WORD{draftWords === 1 ? '' : 'S'} RESTORED — THE STORM NEVER TAKES A WORD TWICE
                </span>
                <span className="vvu-label text-[8px] text-[#7a8a6e]">CLEAR ENDS THE DRAFT</span>
              </div>
            )}
            <div className="grid gap-3 mt-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="fieldkit-capture-lecturer" className="vvu-label text-[9px] text-[#7a8a6e]">LECTURER *</Label>
                <Input
                  id="fieldkit-capture-lecturer"
                  value={form.lecturer}
                  onChange={(e) => set('lecturer', e.target.value)}
                  placeholder="e.g. Prof. G. Poggi"
                  className="bg-[#060806] border-[#7a8a6e]/50 text-[13px] min-h-[44px] transition-shadow focus-visible:shadow-[0_0_0_2px_rgba(200,255,0,0.3)]"
                  maxLength={120}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fieldkit-capture-faculty" className="vvu-label text-[9px] text-[#7a8a6e]">FACULTY *</Label>
                <Select value={form.faculty} onValueChange={(v) => set('faculty', v)}>
                  <SelectTrigger
                    id="fieldkit-capture-faculty"
                    className="bg-[#060806] border-[#7a8a6e]/50 text-[13px] min-h-[44px] w-full transition-shadow focus-visible:shadow-[0_0_0_2px_rgba(200,255,0,0.3)]"
                  >
                    <SelectValue placeholder="pick from the faculty map" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0b0f0a] border-[#7a8a6e]/50 max-h-72">
                    {FACULTY_OPTIONS.map((f) => (
                      <SelectItem key={f} value={f} className="text-[12px] text-[#c9d4bd] focus:bg-[#7a8a6e]/20">
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="fieldkit-capture-field" className="vvu-label text-[9px] text-[#7a8a6e]">FIELD / DISCIPLINE</Label>
                <Input
                  id="fieldkit-capture-field"
                  value={form.field}
                  onChange={(e) => set('field', e.target.value)}
                  placeholder="e.g. Computer Vision · Evidence Law · Hydrology"
                  className="bg-[#060806] border-[#7a8a6e]/50 text-[13px] min-h-[44px] transition-shadow focus-visible:shadow-[0_0_0_2px_rgba(200,255,0,0.3)]"
                  maxLength={160}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="fieldkit-capture-q1" className="vvu-label text-[9px] text-[#7a8a6e]">
                  Q1 — BIGGEST UNVERIFIABLE THING *
                </Label>
                <Textarea
                  id="fieldkit-capture-q1"
                  value={form.q1Unverifiable}
                  onChange={(e) => set('q1Unverifiable', e.target.value)}
                  placeholder="In their field, what can't people verify that they wish they could?"
                  className="bg-[#060806] border-[#7a8a6e]/50 text-[13px] min-h-[72px] transition-shadow focus-visible:shadow-[0_0_0_2px_rgba(200,255,0,0.3)]"
                  maxLength={2000}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="fieldkit-capture-q2" className="vvu-label text-[9px] text-[#7a8a6e]">
                  Q2 — HOW FAILURES ARE CAUGHT TODAY / WHO PAYS *
                </Label>
                <Textarea
                  id="fieldkit-capture-q2"
                  value={form.q2FailurePath}
                  onChange={(e) => set('q2FailurePath', e.target.value)}
                  placeholder="Bad decision, falsified record, failure — who catches it, who pays for that check?"
                  className="bg-[#060806] border-[#7a8a6e]/50 text-[13px] min-h-[72px] transition-shadow focus-visible:shadow-[0_0_0_2px_rgba(200,255,0,0.3)]"
                  maxLength={2000}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="fieldkit-capture-q3" className="vvu-label text-[9px] text-[#c8ff00]">
                  Q3 — THEIR TRUST CONDITION * · &ldquo;I WOULD TRUST THIS IF …&rdquo;
                </Label>
                <Textarea
                  id="fieldkit-capture-q3"
                  value={form.q3TrustCondition}
                  onChange={(e) => set('q3TrustCondition', e.target.value)}
                  placeholder="Write down every word of the Q3 answer — these are the design constraints."
                  className="bg-[#060806] border-[#c8ff00]/40 text-[13px] min-h-[88px] transition-shadow focus-visible:shadow-[0_0_0_2px_rgba(200,255,0,0.3)]"
                  maxLength={2000}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fieldkit-capture-bottleneck" className="vvu-label text-[9px] text-[#7a8a6e]">DOMINANT BOTTLENECK (CIRCLE ONE)</Label>
                <Select
                  value={form.dominantBottleneck}
                  onValueChange={(v) => set('dominantBottleneck', v as TrustBottleneck)}
                >
                  <SelectTrigger
                    id="fieldkit-capture-bottleneck"
                    className="bg-[#060806] border-[#7a8a6e]/50 text-[13px] min-h-[44px] w-full transition-shadow focus-visible:shadow-[0_0_0_2px_rgba(200,255,0,0.3)]"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0b0f0a] border-[#7a8a6e]/50">
                    {TRUST_BOTTLENECKS.map((b) => (
                      <SelectItem key={b} value={b} className="text-[12px] text-[#c9d4bd] focus:bg-[#7a8a6e]/20">
                        {BOTTLENECK_LABELS[b]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="vvu-label text-[9px] text-[#7a8a6e]">WOULD THEY USE IT?</Label>
                <div role="group" aria-label="WOULD THEY USE IT?" className="grid grid-cols-3 gap-1.5">
                  {WOULD_USE_ANSWERS.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => set('wouldUse', a)}
                      className={cn(
                        'vvu-label text-[10px] font-bold min-h-[44px] border transition-colors',
                        form.wouldUse === a
                          ? a === 'YES'
                            ? 'bg-[#c8ff00]/15 border-[#c8ff00]/70 text-[#c8ff00]'
                            : a === 'MAYBE'
                              ? 'bg-[#f3e38a]/10 border-[#f3e38a]/60 text-[#f3e38a]'
                              : 'bg-[#e5484d]/10 border-[#e5484d]/60 text-[#e5484d]'
                          : 'border-[#7a8a6e]/40 text-[#7a8a6e] hover:border-[#7a8a6e]/70',
                      )}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="fieldkit-capture-offered" className="vvu-label text-[9px] text-[#7a8a6e]">
                  WHAT THEY OFFERED (lecture invite, intro, data, collaboration)
                </Label>
                <Input
                  id="fieldkit-capture-offered"
                  value={form.offered}
                  onChange={(e) => set('offered', e.target.value)}
                  placeholder="e.g. guest lecture slot · intro to HOD · dataset access"
                  className="bg-[#060806] border-[#7a8a6e]/50 text-[13px] min-h-[44px] transition-shadow focus-visible:shadow-[0_0_0_2px_rgba(200,255,0,0.3)]"
                  maxLength={600}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="fieldkit-capture-followup" className="vvu-label text-[9px] text-[#7a8a6e]">FOLLOW-UP ACTION</Label>
                <Input
                  id="fieldkit-capture-followup"
                  value={form.followUp}
                  onChange={(e) => set('followUp', e.target.value)}
                  placeholder="e.g. send leave-behind PDF · book demo after exams"
                  className="bg-[#060806] border-[#7a8a6e]/50 text-[13px] min-h-[44px] transition-shadow focus-visible:shadow-[0_0_0_2px_rgba(200,255,0,0.3)]"
                  maxLength={600}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
              <p className="vvu-label text-[9px] text-[#7a8a6e]">
                * REQUIRED · SAVES ONE PEOPLE NOTE · WORM EVENT FIELDKIT_CAPTURE_SAVED
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setForm(EMPTY_FORM);
                    if (typeof window !== 'undefined') {
                      clearEstateDraft(window.localStorage, FIELDKIT_CAPTURE_DRAFT_KEY);
                    }
                    setDraftEcho(false);
                  }}
                  className="min-h-[44px] vvu-label text-[10px] font-bold border-[#7a8a6e]/50 text-[#9db08c] hover:bg-[#7a8a6e]/10"
                >
                  CLEAR
                </Button>
                <Button
                  type="button"
                  disabled={!formValid || saveMutation.isPending}
                  onClick={() => saveMutation.mutate(form)}
                  className="min-h-[44px] vvu-label text-[10px] font-bold bg-[#c8ff00] text-black hover:bg-[#d8ff4a] border border-black shadow-[3px_3px_0px_0px_#000] hover:shadow-[1px_1px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                >
                  {saveMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  SAVE CAPTURE
                </Button>
              </div>
            </div>
          </div>
        </SectionReveal>

        {/* ── §5 the faculty map ── */}
        <SectionReveal>
          <div className="vvu-panel-solid p-4 sm:p-6">
            <SectionHeader
              num="5"
              title="THE FACULTY MAP"
              kicker="likely dominant bottleneck per faculty · what they'll probably say"
              right={
                <Chip tone="dim">
                  <Landmark className="w-3 h-3 mr-1" />
                  10 FACULTIES
                </Chip>
              }
            />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[640px]">
                <thead>
                  <tr className="border-b border-[#7a8a6e]/40">
                    <th className="vvu-label text-[9px] text-[#7a8a6e] py-2 pr-3">FACULTY</th>
                    <th className="vvu-label text-[9px] text-[#7a8a6e] py-2 pr-3">LIKELY BOTTLENECK</th>
                    <th className="vvu-label text-[9px] text-[#7a8a6e] py-2">WHAT THEY&apos;LL PROBABLY SAY</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.facultyMap ?? []).map((f) => (
                    <tr key={f.faculty} className="border-b border-[#7a8a6e]/15 hover:bg-[#7a8a6e]/5">
                      <td className="py-2.5 pr-3 text-[12px] text-[#f3e38a] vvu-label align-top">{f.faculty}</td>
                      <td className="py-2.5 pr-3 align-top">
                        <Chip
                          tone={
                            bottleneckVerdict(f.bottleneck) === 'YES'
                              ? 'lime'
                              : bottleneckVerdict(f.bottleneck) === 'PARTIALLY'
                                ? 'amber'
                                : 'crimson'
                          }
                        >
                          {BOTTLENECK_LABELS[f.bottleneck]}
                        </Chip>
                      </td>
                      <td className="py-2.5 text-[11px] sm:text-xs text-[#9db08c] align-top">{f.likelySay}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </SectionReveal>

        {/* ── §6 people notes on file + Q3 digest ── */}
        <SectionReveal featured>
          <div className="vvu-panel-solid p-4 sm:p-6">
            <SectionHeader
              num="6"
              title="PEOPLE NOTES ON FILE"
              kicker={`the stack of Q3 answers · ${stats?.captures ?? 0} capture(s) · starts empty, never seeded`}
              right={
                <Chip tone={stats && stats.captures > 0 ? 'lime' : 'dim'}>
                  <MessageSquareQuote className="w-3 h-3 mr-1" />
                  {stats?.captures ?? 0} NOTES
                </Chip>
              }
            />

            {/* bottleneck distribution */}
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="border border-[#7a8a6e]/30 bg-[#060806] p-4">
                <p className="vvu-label text-[9px] text-[#7a8a6e] mb-3">DOMINANT BOTTLENECK DISTRIBUTION</p>
                <div className="space-y-2">
                  {(stats?.byBottleneck ?? []).map((b) => (
                    <div key={b.key} className="flex items-center gap-2">
                      <span className="vvu-label text-[9px] text-[#9db08c] w-32 shrink-0 truncate">
                        {BOTTLENECK_LABELS[b.key]}
                      </span>
                      <div className="flex-1 h-3 bg-[#0b0f0a] border border-[#7a8a6e]/25 overflow-hidden">
                        <div
                          className={cn(
                            'h-full transition-all duration-500',
                            bottleneckVerdict(b.key) === 'YES'
                              ? 'bg-[#c8ff00]/70'
                              : bottleneckVerdict(b.key) === 'PARTIALLY'
                                ? 'bg-[#f3e38a]/60'
                                : 'bg-[#e5484d]/50',
                          )}
                          style={{ width: `${(b.count / maxBottleneck) * 100}%` }}
                        />
                      </div>
                      <span className="vvu-label text-[10px] text-[#c9d4bd] w-6 text-right">{b.count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border border-[#7a8a6e]/30 bg-[#060806] p-4">
                <p className="vvu-label text-[9px] text-[#7a8a6e] mb-3">USE-INTENT (WOULD THEY USE IT?)</p>
                <div className="grid grid-cols-3 gap-2">
                  {(stats?.byWouldUse ?? []).map((w) => (
                    <div
                      key={w.key}
                      className={cn(
                        'border p-3 text-center',
                        w.key === 'YES'
                          ? 'border-[#c8ff00]/40'
                          : w.key === 'MAYBE'
                            ? 'border-[#f3e38a]/35'
                            : 'border-[#e5484d]/35',
                      )}
                    >
                      <div
                        className={cn(
                          'vvu-label text-2xl font-bold',
                          w.key === 'YES' ? 'text-[#c8ff00]' : w.key === 'MAYBE' ? 'text-[#f3e38a]' : 'text-[#e5484d]',
                        )}
                      >
                        {w.count}
                      </div>
                      <div className="vvu-label text-[9px] text-[#7a8a6e] mt-1">{w.key}</div>
                    </div>
                  ))}
                </div>
                <p className="vvu-label text-[9px] text-[#7a8a6e] mt-3">
                  FACULTIES HIT: {(stats?.byFaculty ?? []).map((f) => f.faculty.split(' /')[0]).join(' · ') || 'NONE YET'}
                </p>
              </div>
            </div>

            {/* Q3 trust conditions — the design constraints */}
            <div className="mt-2 border border-[#c8ff00]/30 bg-[#060806] p-4">
              <p className="vvu-label text-[10px] text-[#c8ff00]">
                ★ THE DESIGN CONSTRAINTS — EVERY CAPTURED Q3 TRUST CONDITION
              </p>
              {(stats?.trustConditions.length ?? 0) === 0 ? (
                <p className="text-[12px] text-[#7a8a6e] mt-3 italic">
                  No Q3 answers captured yet. Walk the campus, fill the template above — this list is
                  what whatever ProofBridge becomes next must prove.
                </p>
              ) : (
                <ul className="mt-3 space-y-2 max-h-72 overflow-y-auto pr-1">
                  {stats?.trustConditions.map((t, i) => (
                    <li key={i} className="border-l-2 border-[#c8ff00]/40 pl-3">
                      <p className="text-[12px] text-[#d8e4c8] leading-relaxed">
                        &ldquo;{t.condition}&rdquo;
                      </p>
                      <p className="vvu-label text-[9px] text-[#7a8a6e] mt-1">
                        — {t.lecturer} · {t.faculty}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* capture cards */}
            <div className="mt-4 space-y-2 max-h-96 overflow-y-auto pr-1">
              {(data?.captures ?? []).length === 0 ? (
                <div className="border border-dashed border-[#7a8a6e]/35 bg-[#060806] p-6 text-center">
                  <NotebookPen className="w-6 h-6 text-[#7a8a6e] mx-auto" />
                  <p className="vvu-label text-[10px] text-[#7a8a6e] mt-2">
                    NO PEOPLE NOTES ON FILE — THE TABLE STARTS EMPTY (NO FABRICATED LECTURERS)
                  </p>
                </div>
              ) : (
                data?.captures.map((c) => (
                  <div key={c.id} className="border border-[#7a8a6e]/30 bg-[#060806] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="vvu-label text-[11px] font-bold text-[#f3e38a]">
                          {c.lecturer}
                          {c.field ? <span className="text-[#7a8a6e] font-normal"> · {c.field}</span> : null}
                        </p>
                        <p className="vvu-label text-[9px] text-[#7a8a6e] mt-0.5">
                          {c.faculty} · {fmtStamp(c.createdAt)} · WORM #{c.wormSeq ?? '—'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Chip tone={bottleneckVerdict(c.dominantBottleneck) === 'YES' ? 'lime' : bottleneckVerdict(c.dominantBottleneck) === 'PARTIALLY' ? 'amber' : 'crimson'}>
                          {BOTTLENECK_LABELS[c.dominantBottleneck]}
                        </Chip>
                        <Chip tone={wouldUseTone(c.wouldUse)}>USE: {c.wouldUse}</Chip>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-label={`Remove capture for ${c.lecturer}`}
                          onClick={() => removeMutation.mutate(c.id)}
                          className="h-9 w-9 min-h-[36px] min-w-[36px] border-[#e5484d]/40 text-[#e5484d] hover:bg-[#e5484d]/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-2 mt-3 text-[11px] sm:text-xs sm:grid-cols-3">
                      <div>
                        <p className="vvu-label text-[8px] text-[#7a8a6e]">Q1 · UNVERIFIABLE</p>
                        <p className="text-[#9db08c] mt-1 leading-relaxed">{c.q1Unverifiable}</p>
                      </div>
                      <div>
                        <p className="vvu-label text-[8px] text-[#7a8a6e]">Q2 · WHO PAYS TODAY</p>
                        <p className="text-[#9db08c] mt-1 leading-relaxed">{c.q2FailurePath}</p>
                      </div>
                      <div>
                        <p className="vvu-label text-[8px] text-[#c8ff00]">Q3 · TRUST CONDITION</p>
                        <p className="text-[#d8e4c8] mt-1 leading-relaxed">&ldquo;{c.q3TrustCondition}&rdquo;</p>
                      </div>
                    </div>
                    {(c.offered || c.followUp) && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-2 border-t border-[#7a8a6e]/15">
                        {c.offered && (
                          <p className="vvu-label text-[9px] text-[#9db08c]">
                            <span className="text-[#7a8a6e]">OFFERED:</span> {c.offered}
                          </p>
                        )}
                        {c.followUp && (
                          <p className="vvu-label text-[9px] text-[#9db08c]">
                            <span className="text-[#7a8a6e]">FOLLOW-UP:</span> {c.followUp}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </SectionReveal>

        {/* ── closing counsel ── */}
        <SectionReveal>
          <div className="vvu-panel-solid p-4 sm:p-6">
            <SectionHeader num="7" title="ON THE HORSE ITSELF · BEFORE YOU WALK" kicker="closing counsel from the kit" />
            <div className="grid gap-2 mt-4 sm:grid-cols-2">
              <div className="border border-[#7a8a6e]/30 bg-[#060806] p-4">
                <p className="text-[12px] text-[#d8e4c8] leading-relaxed whitespace-pre-line">{ON_THE_HORSE}</p>
              </div>
              <div className="border border-[#c8ff00]/30 bg-[#060806] p-4">
                <div className="flex items-start gap-2">
                  <Camera className="w-4 h-4 text-[#c8ff00] shrink-0 mt-0.5" />
                  <p className="text-[12px] text-[#d8e4c8] leading-relaxed">{BEFORE_YOU_WALK}</p>
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <Plus className="w-3.5 h-3.5 text-[#7a8a6e]" />
                  <p className="vvu-label text-[9px] text-[#7a8a6e]">
                    KIT PROVENANCE: DOCUMENTATION.md § 6 (operator fieldkit.html, extracted text ·
                    compiled from download/fieldkit-source.md) · IMPLEMENTED AS THE EIGHTH
                    PROJECTION · NO CONTENT INVENTED
                  </p>
                </div>
              </div>
            </div>
          </div>
        </SectionReveal>
      </div>
    </div>
  );
}

// ─── small stat box ──────────────────────────────────────────────────────────

function StatBox({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="border border-[#7a8a6e]/30 bg-[#060806] p-3">
      <div className="vvu-label text-xl sm:text-2xl font-bold text-[#f3e38a]">{value}</div>
      <div className="vvu-label text-[8px] text-[#7a8a6e] mt-1">{label}</div>
      <div className="vvu-label text-[8px] text-[#5c6b51]">{hint}</div>
    </div>
  );
}
