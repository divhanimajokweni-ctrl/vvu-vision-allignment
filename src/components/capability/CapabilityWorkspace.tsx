'use client';

// src/components/capability/CapabilityWorkspace.tsx — Round 22 · fifth
// projection #/capability — the CAPABILITY DOSSIER.
//
// Why this exists: an external procurement assistant (SANWRIA/DWS track) was
// blocked on three capability facts it cannot know: (1) is "VVU AIR KERNEL"
// running on real SCADA data anywhere? (2) is "Vivid" a separate company or
// a voice-to-text error? (3) which province is the entity registered in?
// This dossier answers (1) with LIVE server-computed probes, (2) with the
// canonical VVU clarification (editable), and (3) with a persisted operator
// profile — then composes a paste-ready capability statement server-side
// (WORM-logged) plus targeted draft-request prompts for the procurement AI.
//
// Posture: system facts are never editable; only the operator profile is.
// Statement composition happens server-side (POST /api/vvu/capability
// action=generate) — the client never writes its own markdown.

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, Check, Compass, Copy, FileText, FlaskConical, ListChecks, MapPin, RefreshCw, Save, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Chip, LiveDot, QueryErrorCard, SCADA, SectionHeader, SectionReveal, fmtNum, fmtStamp } from '@/components/analytics/shared';
import { cn } from '@/lib/utils';
import {
  BBEEE_LABELS,
  BBEEE_OPTIONS,
  PILOT_DECLARATIONS,
  PILOT_DECLARATION_LABELS,
  SA_PROVINCES,
  composeDraftRequests,
  profileCompleteness,
} from '@/lib/capability';
import type { BbbeeOption, CapabilityProfile, CapabilityResponse, CapabilityStatementResult, PilotDeclaration, SaProvince } from '@/types/vvu';

// ─── fetch helpers ───────────────────────────────────────────────────────────

async function getCapability(): Promise<CapabilityResponse> {
  const res = await fetch('/api/vvu/capability', { cache: 'no-store' });
  if (!res.ok) throw new Error(`CAPABILITY FEED HTTP ${res.status}`);
  return (await res.json()) as CapabilityResponse;
}

async function generateStatement(): Promise<CapabilityStatementResult> {
  const res = await fetch('/api/vvu/capability', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'generate' }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `GENERATE HTTP ${res.status}`);
  }
  return (await res.json()) as CapabilityStatementResult;
}

type FormState = {
  entityName: string;
  tradingAs: string;
  vividIsTranscription: boolean;
  province: SaProvince | null;
  csdRegistered: boolean;
  sitaRegistered: boolean;
  provincialRegistered: boolean;
  vatRegistered: boolean;
  bbbeeLevel: BbbeeOption | null;
  contactEmail: string;
  contactPhone: string;
  pilotDeclaration: PilotDeclaration;
  notes: string;
};

const EMPTY_FORM: FormState = {
  entityName: '',
  tradingAs: '',
  vividIsTranscription: true,
  province: null,
  csdRegistered: false,
  sitaRegistered: false,
  provincialRegistered: false,
  vatRegistered: false,
  bbbeeLevel: null,
  contactEmail: '',
  contactPhone: '',
  pilotDeclaration: 'SIMULATION_ONLY',
  notes: '',
};

function fromProfile(p: CapabilityProfile): FormState {
  return {
    entityName: p.entityName,
    tradingAs: p.tradingAs,
    vividIsTranscription: p.vividIsTranscription,
    province: p.province,
    csdRegistered: p.csdRegistered,
    sitaRegistered: p.sitaRegistered,
    provincialRegistered: p.provincialRegistered,
    vatRegistered: p.vatRegistered,
    bbbeeLevel: p.bbbeeLevel,
    contactEmail: p.contactEmail ?? '',
    contactPhone: p.contactPhone ?? '',
    pilotDeclaration: p.pilotDeclaration,
    notes: p.notes ?? '',
  };
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

// ─── the workspace ───────────────────────────────────────────────────────────

export function CapabilityWorkspace() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [dirty, setDirty] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [syncedProfile, setSyncedProfile] = useState<CapabilityProfile | null>(null);

  const { data, isError, error, isLoading, refetch } = useQuery<CapabilityResponse, Error>({
    queryKey: ['vvu-capability'],
    queryFn: getCapability,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  // Seed / re-seed the local form from the server profile while untouched.
  // Render-time sync (the React-docs "adjust state when a prop changes"
  // pattern — guarded, so no loop and no effect): whenever a fresh server
  // profile arrives and there are no unsaved edits, adopt it.
  const serverProfile = data?.profile ?? null;
  if (serverProfile && !dirty && serverProfile !== syncedProfile) {
    setSyncedProfile(serverProfile);
    setForm(fromProfile(serverProfile));
  }

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setDirty(true);
    setForm((f) => (f ? { ...f, [key]: value } : f));
  };

  const profile = data?.profile ?? null;
  const facts = data?.facts ?? null;
  const completeness = useMemo(
    () => profileCompleteness(form ?? EMPTY_FORM),
    [form]
  );
  const drafts = useMemo(
    () => composeDraftRequests(form ?? EMPTY_FORM),
    [form]
  );

  // ── mutations ──
  const saveMutation = useMutation({
    mutationFn: async (f: FormState) => {
      const res = await fetch('/api/vvu/capability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string; issues?: string[] } | null;
        throw new Error([body?.error, ...(body?.issues ?? [])].filter(Boolean).join(' · ') || `SAVE HTTP ${res.status}`);
      }
      return (await res.json()) as { profile: CapabilityProfile; wormSeq: number };
    },
    onSuccess: (d) => {
      setDirty(false);
      void queryClient.invalidateQueries({ queryKey: ['vvu-capability'] });
      toast.success('OPERATOR PROFILE SAVED', {
        description: `WORM CAPABILITY_PROFILE_SAVED · seq #${d.wormSeq}`,
      });
    },
    onError: (e: Error) => {
      toast.error('PROFILE SAVE FAILED', { description: e.message });
    },
  });

  const generateMutation = useMutation({
    mutationFn: generateStatement,
    onSuccess: (d) => {
      void queryClient.invalidateQueries({ queryKey: ['vvu-capability'] });
      toast.success('CAPABILITY STATEMENT COMPOSED', {
        description: `${fmtNum(d.charCount)} chars · WORM CAPABILITY_STATEMENT_GENERATED · seq #${d.wormSeq}`,
      });
    },
    onError: (e: Error) => {
      toast.error('STATEMENT GENERATION FAILED', { description: e.message });
    },
  });

  const handleCopy = async (key: string, text: string, label: string) => {
    const ok = await copyText(text);
    if (ok) {
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1600);
      toast.success(`${label} COPIED`, { description: 'paste-ready for the procurement assistant' });
    } else {
      toast.error('CLIPBOARD BLOCKED', { description: 'select the text manually and copy' });
    }
  };

  const threeAnswers = useMemo(() => {
    const p = profile;
    if (!p) return '';
    const decl =
      p.pilotDeclaration === 'SEEKING_PILOT'
        ? ' Operator is actively seeking the first live pilot (municipal / water board / DWS–SANWRIA).'
        : p.pilotDeclaration === 'PILOT_DEPLOYED'
          ? ' Operator declares a live pilot deployment.'
          : '';
    return [
      '1. Pilot status: VVU AIR KERNEL is SIMULATION ONLY — no real SCADA data anywhere (no municipal, farm or mine deployment).' + decl,
      '2. "Vivid" is a voice-to-text error for "VVU" (Venture Vision Ubuntu) — not a separate company.',
      `3. Location: registered in ${p.province ?? '(province not yet recorded)'} · CSD ${p.csdRegistered ? 'YES' : 'NO'} · SITA ${p.sitaRegistered ? 'YES' : 'NO'}.`,
    ].join('\n');
  }, [profile]);

  if (isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-6">
        <QueryErrorCard label="CAPABILITY DOSSIER" onRetry={() => void refetch()} />
      </div>
    );
  }

  const liveServices = facts?.services.filter((s) => s.live).length ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-3 sm:px-5 pt-4 pb-24 space-y-5 sm:space-y-6">
      <style>{`
/* ── Round 22 capability dossier — scoped to .vvu22-* ─────────────────────── */
.vvu22-pre { scrollbar-width: thin; scrollbar-color: rgba(107,138,64,0.5) transparent; }
.vvu22-pre::-webkit-scrollbar { width: 8px; height: 8px; }
.vvu22-pre::-webkit-scrollbar-thumb { background: rgba(107,138,64,0.5); border-radius: 4px; }
.vvu22-pre::-webkit-scrollbar-track { background: transparent; }
.vvu22-draft-preview { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.vvu22-qcard { transition: border-color 160ms ease, box-shadow 160ms ease; }
.vvu22-qcard:hover { border-color: rgba(143,179,90,0.55); box-shadow: 0 3px 16px rgba(0,0,0,0.4); }
@media (prefers-reduced-motion: reduce) { .vvu22-qcard { transition: none; } }
`}</style>

      {/* ── headline strip ── */}
      <header className="vvu-panel-solid p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <FileText className="size-4 text-[#c8ff00] shrink-0" aria-hidden />
              <h1 className="vvu-label text-sm sm:text-base font-bold text-[#f3e38a] tracking-[0.18em]">CAPABILITY DOSSIER</h1>
            </div>
            <p className="vvu-label text-[8px] sm:text-[9px] text-[#7a8a6e] mt-2 leading-relaxed max-w-xl">
              ROUND 22 · the three capability facts an external procurement assistant asked for — answered from live
              system probes and a persisted operator profile, then composed into a paste-ready statement. System facts
              are never editable; only the profile is.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip tone="amber">SIMULATION ONLY · NO LIVE SCADA</Chip>
            <Chip tone={facts?.worm.chainValid ? 'lime' : 'crimson'}>
              WORM {facts ? (facts.worm.chainValid ? 'VALID' : 'BROKEN') : '…'} @ {facts ? fmtNum(facts.worm.count) : '—'}
            </Chip>
            <Chip tone="dim">SERVICES {liveServices}/3 LIVE</Chip>
            <Chip tone={completeness.pct >= 60 ? 'ochre' : 'sage'}>PROFILE {completeness.pct}%</Chip>
          </div>
        </div>
        {(isLoading || !facts) && (
          <div className="mt-3 flex items-center gap-2 vvu-label text-[9px] text-[#7a8a6e]" aria-live="polite">
            <RefreshCw className="size-3 animate-spin" aria-hidden />
            PROBING SERVICES · VERIFYING WORM CHAIN · READING PROFILE…
          </div>
        )}
      </header>

      {/* ── §1 · the three questions ── */}
      <section aria-label="the three capability questions">
        <SectionHeader
          num="1"
          title="THE THREE QUESTIONS · ANSWERED"
          kicker="what the procurement assistant asked for"
          right={
            profile ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleCopy('three', threeAnswers, 'THREE ANSWERS')}
                className="min-h-[44px] vvu-label text-[9px] font-bold border-[#c8ff00]/50 text-[#c8ff00] hover:bg-[#c8ff00]/10 hover:text-[#c8ff00]"
              >
                {copiedKey === 'three' ? <Check className="size-3" aria-hidden /> : <Copy className="size-3" aria-hidden />}
                COPY 3 ANSWERS
              </Button>
            ) : undefined
          }
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          {/* Q1 — pilot status */}
          <SectionReveal className="h-full">
            <div className="vvu-panel-solid vvu22-qcard h-full p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FlaskConical className="size-3.5 text-[#e0a030] shrink-0" aria-hidden />
                  <span className="vvu-label text-[9px] font-bold text-[#e0a030] tracking-[0.14em]">Q1 · PILOT STATUS</span>
                </div>
                <Chip tone="dim" dashed>SYSTEM FACT</Chip>
              </div>
              <p className="font-mono text-[13px] sm:text-sm font-bold text-[#f3e38a] leading-snug">
                No — VVU AIR KERNEL is <span className="text-[#e0a030]">simulation only</span>. No real SCADA data.
              </p>
              <ul className="space-y-1.5 vvu-label text-[8.5px] text-[#8a9a7c] leading-relaxed">
                <li className="flex gap-1.5">
                  <span className="text-[#e0a030] shrink-0" aria-hidden>▪</span>
                  Telemetry = simulated Gqeberha edge node ({facts ? fmtNum(facts.counts.telemetry) : '—'} synthetic frames)
                </li>
                <li className="flex gap-1.5">
                  <span className="text-[#e0a030] shrink-0" aria-hidden>▪</span>
                  Hydraulic domain = deterministic Hazen–Williams model
                </li>
                <li className="flex gap-1.5">
                  <span className="text-[#e0a030] shrink-0" aria-hidden>▪</span>
                  No municipal / farm / mine deployment exists
                </li>
              </ul>
              <div className="mt-auto pt-2 border-t border-[rgba(107,138,64,0.22)] flex items-center gap-2">
                <Chip tone={profile?.pilotDeclaration === 'SEEKING_PILOT' ? 'lime' : profile?.pilotDeclaration === 'PILOT_DEPLOYED' ? 'teal' : 'sage'}>
                  {profile ? PILOT_DECLARATION_LABELS[profile.pilotDeclaration] : '—'}
                </Chip>
              </div>
              <p className="vvu-label text-[8px] text-[#7a8a6e] leading-relaxed">
                → the correct track: <b className="text-[#c9d4bd]">pilot acquisition strategy</b>, not a pilot-ready pitch.
              </p>
            </div>
          </SectionReveal>

          {/* Q2 — entity */}
          <SectionReveal className="h-full">
            <div className="vvu-panel-solid vvu22-qcard h-full p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 className="size-3.5 text-[#8fb35a] shrink-0" aria-hidden />
                  <span className="vvu-label text-[9px] font-bold text-[#8fb35a] tracking-[0.14em]">Q2 · ENTITY</span>
                </div>
                <Chip tone="dim" dashed>PROFILE</Chip>
              </div>
              <p className="font-mono text-[13px] sm:text-sm font-bold text-[#f3e38a] leading-snug">
                {profile?.vividIsTranscription !== false ? (
                  <>
                    &ldquo;Vivid&rdquo; = voice-to-text of <span className="text-[#c8ff00]">&ldquo;VVU&rdquo;</span> — not a company.
                  </>
                ) : (
                  <>&ldquo;Vivid&rdquo; recorded as a distinct entity — see profile.</>
                )}
              </p>
              <ul className="space-y-1.5 vvu-label text-[8.5px] text-[#8a9a7c] leading-relaxed">
                <li className="flex gap-1.5">
                  <span className="text-[#8fb35a] shrink-0" aria-hidden>▪</span>
                  Registered entity: {profile?.entityName?.trim() || <span className="text-[#e0a030]">not recorded (§3)</span>}
                </li>
                <li className="flex gap-1.5">
                  <span className="text-[#8fb35a] shrink-0" aria-hidden>▪</span>
                  Trading as: {profile?.tradingAs?.trim() || '—'}
                </li>
                <li className="flex gap-1.5">
                  <span className="text-[#8fb35a] shrink-0" aria-hidden>▪</span>
                  Contact: {profile?.contactEmail?.trim() || '—'} {profile?.contactPhone?.trim() ? `· ${profile.contactPhone.trim()}` : ''}
                </li>
              </ul>
              <div className="mt-auto pt-2 border-t border-[rgba(107,138,64,0.22)]">
                <p className="vvu-label text-[8px] text-[#7a8a6e] leading-relaxed">
                  VVU = Venture Vision Ubuntu · edit the entity facts in §3
                </p>
              </div>
            </div>
          </SectionReveal>

          {/* Q3 — location */}
          <SectionReveal className="h-full">
            <div className="vvu-panel-solid vvu22-qcard h-full p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="size-3.5 text-[#2ea8a0] shrink-0" aria-hidden />
                  <span className="vvu-label text-[9px] font-bold text-[#2ea8a0] tracking-[0.14em]">Q3 · LOCATION</span>
                </div>
                <Chip tone="dim" dashed>PROFILE</Chip>
              </div>
              <p className="font-mono text-[13px] sm:text-sm font-bold text-[#f3e38a] leading-snug">
                {profile?.province ? (
                  <>
                    Registered in <span className="text-[#2ea8a0]">{profile.province}</span>
                  </>
                ) : (
                  <span className="text-[#e0a030]">NOT RECORDED — complete §3</span>
                )}
              </p>
              <div className="flex flex-wrap gap-1.5">
                <Chip tone={profile?.csdRegistered ? 'lime' : 'amber'}>CSD {profile?.csdRegistered ? 'YES' : 'NO'}</Chip>
                <Chip tone={profile?.sitaRegistered ? 'lime' : 'amber'}>SITA {profile?.sitaRegistered ? 'YES' : 'NO'}</Chip>
                <Chip tone={profile?.provincialRegistered ? 'lime' : 'amber'}>PROVINCIAL {profile?.provincialRegistered ? 'YES' : 'NO'}</Chip>
                <Chip tone={profile?.vatRegistered ? 'lime' : 'dim'}>VAT {profile?.vatRegistered ? 'YES' : 'NO'}</Chip>
                <Chip tone={profile?.bbbeeLevel ? 'ochre' : 'dim'}>
                  B-BBEE {profile?.bbbeeLevel ? profile.bbbeeLevel.replace('_', ' ') : 'NOT RATED'}
                </Chip>
              </div>
              <div className="mt-auto pt-2 border-t border-[rgba(107,138,64,0.22)]">
                <p className="vvu-label text-[8px] text-[#7a8a6e] leading-relaxed">
                  feeds the exact registration-checklist draft (§5)
                </p>
              </div>
            </div>
          </SectionReveal>
        </div>
      </section>

      {/* ── §2 · system facts ── */}
      <section aria-label="live system facts">
        <SectionHeader num="2" title="SYSTEM FACTS · SERVER-COMPUTED" kicker="probed at request time · never editable" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
          {/* services + worm */}
          <div className="lg:col-span-2 vvu-panel-solid p-4 flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {facts?.services.map((s) => (
                <div key={s.key} className="rounded-sm border border-[rgba(107,138,64,0.25)] bg-[rgba(6,8,6,0.55)] p-3">
                  <div className="flex items-center gap-2">
                    <LiveDot color={s.live ? SCADA.lime : SCADA.crimson} dim={!s.live} />
                    <span className={cn('vvu-label text-[9px] font-bold tracking-[0.1em]', s.live ? 'text-[#c8ff00]' : 'text-[#e5484d]')}>
                      {s.live ? 'LIVE' : 'DOWN'}
                    </span>
                  </div>
                  <p className="font-mono text-[10px] text-[#c9d4bd] mt-1.5 leading-tight">{s.label}</p>
                  <p className="vvu-label text-[8px] text-[#7a8a6e] mt-1 tabular-nums">{s.endpoint}</p>
                  <p className="vvu-label text-[7.5px] text-[#8a9a7c] mt-1.5 leading-relaxed">{s.detail}</p>
                </div>
              ))}
              {!facts && (
                <div className="sm:col-span-3 vvu-label text-[9px] text-[#7a8a6e] py-4 text-center" aria-live="polite">
                  PROBING…
                </div>
              )}
            </div>

            {/* WORM + counts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-sm border border-[rgba(107,138,64,0.25)] bg-[rgba(6,8,6,0.55)] p-3 flex items-start gap-2.5">
                <ShieldCheck className={cn('size-4 shrink-0 mt-0.5', facts?.worm.chainValid ? 'text-[#c8ff00]' : 'text-[#e5484d]')} aria-hidden />
                <div className="min-w-0">
                  <p className="vvu-label text-[9px] font-bold text-[#f3e38a] tracking-[0.12em]">
                    WORM EVIDENCE CHAIN {facts ? (facts.worm.chainValid ? '· VALID' : '· BROKEN') : ''}
                  </p>
                  <p className="font-mono text-[10px] text-[#c9d4bd] mt-1 tabular-nums">
                    {facts ? `${fmtNum(facts.worm.count)} records · SHA-256 chained` : '—'}
                  </p>
                  <p className="vvu-label text-[7.5px] text-[#8a9a7c] mt-1 break-all leading-relaxed">
                    tip {facts?.worm.lastHash ? `${facts.worm.lastHash.slice(0, 24)}…` : '—'}
                  </p>
                </div>
              </div>
              <div className="rounded-sm border border-[rgba(107,138,64,0.25)] bg-[rgba(6,8,6,0.55)] p-3">
                <p className="vvu-label text-[9px] font-bold text-[#f3e38a] tracking-[0.12em] mb-2">EVIDENCE STORED (rows)</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ['telemetry', facts?.counts.telemetry],
                    ['WORM', facts?.counts.worm],
                    ['targets', facts?.counts.outreachTargets],
                    ['emails', facts?.counts.outreachEmails],
                    ['sequences', facts?.counts.sequences],
                    ['holo QoE', facts?.counts.holoSamples],
                  ].map(([label, n]) => (
                    <div key={String(label)}>
                      <p className="font-mono text-[13px] font-bold text-[#c9d4bd] tabular-nums">{n === undefined ? '—' : fmtNum(n as number)}</p>
                      <p className="vvu-label text-[7px] text-[#7a8a6e]">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* provenance */}
          <div className="vvu-panel-solid p-4">
            <p className="vvu-label text-[9px] font-bold text-[#f3e38a] tracking-[0.12em] mb-2.5">DATA PROVENANCE · PER MODULE</p>
            <ul className="space-y-2.5 max-h-[19rem] overflow-y-auto vvu22-pre pr-1">
              {facts?.provenance.map((row) => (
                <li key={row.view} className="rounded-sm border border-[rgba(107,138,64,0.22)] bg-[rgba(6,8,6,0.55)] p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[9.5px] font-bold text-[#c9d4bd] truncate">{row.view}</span>
                    <Chip
                      tone={row.provenance === 'SIMULATED' ? 'amber' : row.provenance === 'REAL' ? 'lime' : 'teal'}
                      className="shrink-0"
                    >
                      {row.provenance}
                    </Chip>
                  </div>
                  <p className="vvu-label text-[7.5px] text-[#8a9a7c] mt-1 leading-relaxed">{row.note}</p>
                </li>
              ))}
              {!facts && <li className="vvu-label text-[9px] text-[#7a8a6e]">LOADING…</li>}
            </ul>
          </div>
        </div>
      </section>

      {/* ── §3 · operator profile ── */}
      <section aria-label="operator profile">
        <SectionHeader
          num="3"
          title="OPERATOR PROFILE · EDITABLE"
          kicker={profile && profile.updatedAt !== '1970-01-01T00:00:00.000Z' ? `last saved ${fmtStamp(profile.updatedAt)}` : 'never saved yet — defaults shown'}
          right={dirty ? <Chip tone="amber">UNSAVED EDITS</Chip> : undefined}
        />
        {form && (
          <div className="vvu-panel-solid p-4 sm:p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="cap-entity" className="vvu-label text-[8.5px] text-[#7a8a6e]">REGISTERED ENTITY NAME</Label>
                <Input
                  id="cap-entity"
                  value={form.entityName}
                  onChange={(e) => update('entityName', e.target.value)}
                  placeholder="e.g. Venture Vision Ubuntu (Pty) Ltd"
                  maxLength={120}
                  className="min-h-[44px] bg-[#0a0e09] border-[rgba(107,138,64,0.35)] text-[#c9d4bd] font-mono text-xs focus-visible:border-[#c8ff00]/60 focus-visible:ring-[#c8ff00]/30"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cap-trading" className="vvu-label text-[8.5px] text-[#7a8a6e]">TRADING AS (optional)</Label>
                <Input
                  id="cap-trading"
                  value={form.tradingAs}
                  onChange={(e) => update('tradingAs', e.target.value)}
                  placeholder="e.g. VVU"
                  maxLength={120}
                  className="min-h-[44px] bg-[#0a0e09] border-[rgba(107,138,64,0.35)] text-[#c9d4bd] font-mono text-xs focus-visible:border-[#c8ff00]/60 focus-visible:ring-[#c8ff00]/30"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cap-province" className="vvu-label text-[8.5px] text-[#7a8a6e]">REGISTRATION PROVINCE</Label>
                <Select
                  value={form.province ?? 'UNSET'}
                  onValueChange={(v) => update('province', v === 'UNSET' ? null : (v as SaProvince))}
                >
                  <SelectTrigger id="cap-province" className="min-h-[44px] bg-[#0a0e09] border-[rgba(107,138,64,0.35)] text-[#c9d4bd] font-mono text-xs">
                    <SelectValue placeholder="NOT RECORDED" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0b0f0a] border-[rgba(107,138,64,0.45)] text-[#c9d4bd]">
                    <SelectItem value="UNSET" className="focus:bg-[#1a2416] focus:text-[#f3e38a] font-mono text-xs">NOT RECORDED</SelectItem>
                    {SA_PROVINCES.map((prov) => (
                      <SelectItem key={prov} value={prov} className="focus:bg-[#1a2416] focus:text-[#f3e38a] font-mono text-xs">
                        {prov}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cap-bbbee" className="vvu-label text-[8.5px] text-[#7a8a6e]">B-BBEE STATUS</Label>
                <Select
                  value={form.bbbeeLevel ?? 'UNSET'}
                  onValueChange={(v) => update('bbbeeLevel', v === 'UNSET' ? null : (v as BbbeeOption))}
                >
                  <SelectTrigger id="cap-bbbee" className="min-h-[44px] bg-[#0a0e09] border-[rgba(107,138,64,0.35)] text-[#c9d4bd] font-mono text-xs">
                    <SelectValue placeholder="NOT RATED" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0b0f0a] border-[rgba(107,138,64,0.45)] text-[#c9d4bd] max-h-72">
                    <SelectItem value="UNSET" className="focus:bg-[#1a2416] focus:text-[#f3e38a] font-mono text-xs">NOT RATED</SelectItem>
                    {BBEEE_OPTIONS.map((lvl) => (
                      <SelectItem key={lvl} value={lvl} className="focus:bg-[#1a2416] focus:text-[#f3e38a] font-mono text-xs">
                        {BBEEE_LABELS[lvl]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cap-email" className="vvu-label text-[8.5px] text-[#7a8a6e]">CONTACT EMAIL</Label>
                <Input
                  id="cap-email"
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => update('contactEmail', e.target.value)}
                  placeholder="procurement@entity.co.za"
                  maxLength={160}
                  className="min-h-[44px] bg-[#0a0e09] border-[rgba(107,138,64,0.35)] text-[#c9d4bd] font-mono text-xs focus-visible:border-[#c8ff00]/60 focus-visible:ring-[#c8ff00]/30"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cap-phone" className="vvu-label text-[8.5px] text-[#7a8a6e]">CONTACT PHONE</Label>
                <Input
                  id="cap-phone"
                  type="tel"
                  value={form.contactPhone}
                  onChange={(e) => update('contactPhone', e.target.value)}
                  placeholder="+27 82 000 0000"
                  maxLength={40}
                  className="min-h-[44px] bg-[#0a0e09] border-[rgba(107,138,64,0.35)] text-[#c9d4bd] font-mono text-xs focus-visible:border-[#c8ff00]/60 focus-visible:ring-[#c8ff00]/30"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="cap-pilot" className="vvu-label text-[8.5px] text-[#7a8a6e]">PILOT DECLARATION (shown beside the system fact)</Label>
                <Select
                  value={form.pilotDeclaration}
                  onValueChange={(v) => update('pilotDeclaration', v as PilotDeclaration)}
                >
                  <SelectTrigger id="cap-pilot" className="min-h-[44px] bg-[#0a0e09] border-[rgba(107,138,64,0.35)] text-[#c9d4bd] font-mono text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0b0f0a] border-[rgba(107,138,64,0.45)] text-[#c9d4bd]">
                    {PILOT_DECLARATIONS.map((d) => (
                      <SelectItem key={d} value={d} className="focus:bg-[#1a2416] focus:text-[#f3e38a] font-mono text-xs">
                        {PILOT_DECLARATION_LABELS[d]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* registration checkboxes */}
              <fieldset className="md:col-span-2 space-y-2.5">
                <legend className="vvu-label text-[8.5px] text-[#7a8a6e] mb-1">SA PROCUREMENT REGISTRATION STATE</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(
                    [
                      ['csdRegistered', 'CSD — Central Supplier Database (csd.csd.gov.za)'],
                      ['sitaRegistered', 'SITA — State IT Agency vendor registration'],
                      ['provincialRegistered', 'Provincial vendor database (per § province)'],
                      ['vatRegistered', 'VAT registered (SARS)'],
                    ] as const
                  ).map(([key, label]) => (
                    <label
                      key={key}
                      className="flex items-center gap-2.5 min-h-[44px] px-2.5 py-2 rounded-sm border border-[rgba(107,138,64,0.22)] bg-[rgba(6,8,6,0.55)] cursor-pointer hover:border-[#8fb35a]/50 transition-colors"
                    >
                      <Checkbox
                        checked={form[key]}
                        onCheckedChange={(c) => update(key, c === true)}
                        className="border-[rgba(107,138,64,0.5)] data-[state=checked]:bg-[#c8ff00] data-[state=checked]:border-[#c8ff00] data-[state=checked]:text-black"
                        aria-label={label}
                      />
                      <span className="font-mono text-[10px] text-[#c9d4bd] leading-tight select-none">{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="cap-vivid" className="vvu-label text-[8.5px] text-[#7a8a6e] flex items-center gap-2.5 min-h-[44px] cursor-pointer">
                  <Checkbox
                    id="cap-vivid"
                    checked={form.vividIsTranscription}
                    onCheckedChange={(c) => update('vividIsTranscription', c === true)}
                    className="border-[rgba(107,138,64,0.5)] data-[state=checked]:bg-[#c8ff00] data-[state=checked]:border-[#c8ff00] data-[state=checked]:text-black"
                  />
                  <span className="font-mono text-[10px] text-[#c9d4bd] leading-tight">
                    &ldquo;Vivid&rdquo; is a voice-to-text rendering of &ldquo;VVU&rdquo; — ticked = canonical answer; untick only if a separate Vivid entity really exists
                  </span>
                </Label>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="cap-notes" className="vvu-label text-[8.5px] text-[#7a8a6e]">NOTES (pilot description, extra registration facts)</Label>
                <Textarea
                  id="cap-notes"
                  value={form.notes}
                  onChange={(e) => update('notes', e.target.value)}
                  placeholder="e.g. supervised 90-day pilot agreed with [municipality] on one reservoir zone…"
                  maxLength={2000}
                  className="min-h-[88px] bg-[#0a0e09] border-[rgba(107,138,64,0.35)] text-[#c9d4bd] font-mono text-xs focus-visible:border-[#c8ff00]/60 focus-visible:ring-[#c8ff00]/30"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={() => form && saveMutation.mutate(form)}
                disabled={saveMutation.isPending || !dirty}
                className="min-h-[44px] vvu-label text-[10px] font-bold bg-[#c8ff00] text-black border border-black hover:bg-[#d8ff4a] disabled:opacity-40"
              >
                {saveMutation.isPending ? <RefreshCw className="size-3.5 animate-spin" aria-hidden /> : <Save className="size-3.5" aria-hidden />}
                {saveMutation.isPending ? 'SAVING…' : dirty ? 'SAVE PROFILE' : 'SAVED'}
              </Button>
              {completeness.missing.length > 0 && (
                <p className="vvu-label text-[8px] text-[#7a8a6e]">STILL MISSING: {completeness.missing.join(' · ')}</p>
              )}
              {profile && profile.updatedAt !== '1970-01-01T00:00:00.000Z' && !dirty && (
                <p className="vvu-label text-[8px] text-[#8a9a7c]">saved {fmtStamp(profile.updatedAt)}</p>
              )}
            </div>
          </div>
        )}
        {!form && <div className="vvu-panel-solid p-4 vvu-label text-[9px] text-[#7a8a6e]">LOADING PROFILE…</div>}
      </section>

      {/* ── §4 · capability statement ── */}
      <section aria-label="capability statement generator">
        <SectionHeader
          num="4"
          title="CAPABILITY STATEMENT · SERVER-COMPOSED"
          kicker="generated from the stored profile + live facts · WORM-logged"
          right={
            generateMutation.data ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip tone="lime">WORM #{generateMutation.data.wormSeq}</Chip>
                <Chip tone="dim">{fmtNum(generateMutation.data.charCount)} CHARS</Chip>
              </div>
            ) : undefined
          }
        />
        <div className="vvu-panel-solid p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="min-h-[44px] vvu-label text-[10px] font-bold bg-[#c8ff00] text-black border border-black hover:bg-[#d8ff4a] disabled:opacity-40"
            >
              {generateMutation.isPending ? <RefreshCw className="size-3.5 animate-spin" aria-hidden /> : <FileText className="size-3.5" aria-hidden />}
              {generateMutation.isPending ? 'COMPOSING…' : 'GENERATE STATEMENT'}
            </Button>
            {generateMutation.data && (
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleCopy('statement', generateMutation.data?.markdown ?? '', 'STATEMENT')}
                className="min-h-[44px] vvu-label text-[10px] font-bold border-[#c8ff00]/50 text-[#c8ff00] hover:bg-[#c8ff00]/10 hover:text-[#c8ff00]"
              >
                {copiedKey === 'statement' ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
                COPY FULL STATEMENT
              </Button>
            )}
            {generateMutation.data && (
              <p className="vvu-label text-[8px] text-[#7a8a6e]">composed {fmtStamp(generateMutation.data.generatedAt)}</p>
            )}
          </div>
          {generateMutation.data ? (
            <pre className="vvu22-pre max-h-[26rem] overflow-auto rounded-sm border border-[rgba(107,138,64,0.3)] bg-[rgba(6,8,6,0.7)] p-3 sm:p-4 font-mono text-[10px] leading-relaxed text-[#c9d4bd] whitespace-pre-wrap break-words" aria-label="capability statement markdown">
              {generateMutation.data.markdown}
            </pre>
          ) : (
            <div className="rounded-sm border border-dashed border-[rgba(107,138,64,0.35)] bg-[rgba(6,8,6,0.5)] p-4">
              <p className="vvu-label text-[9px] text-[#8a9a7c] leading-relaxed">
                The statement answers the three questions with the LIVE system facts (simulation status, WORM chain,
                service probes) + the stored profile (entity, province, registration, B-BBEE), then lists the three
                drafts to request. Generation is composed server-side and appended to the WORM ledger — the exact text
                you paste is the exact text that was logged.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── §5 · drafts to request ── */}
      <section aria-label="draft requests for the procurement assistant">
        <SectionHeader num="5" title="DRAFTS TO REQUEST · READY-TO-PASTE PROMPTS" kicker="one prompt per draft · copy and send back" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
          {drafts.map((d, i) => (
            <SectionReveal key={d.id} className="h-full">
              <div className="vvu-panel-solid vvu22-qcard h-full p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {d.id === 'pilot-acquisition' ? (
                      <Compass className="size-3.5 text-[#e0a030] shrink-0" aria-hidden />
                    ) : d.id === 'prime-one-pager' ? (
                      <FileText className="size-3.5 text-[#8fb35a] shrink-0" aria-hidden />
                    ) : (
                      <ListChecks className="size-3.5 text-[#2ea8a0] shrink-0" aria-hidden />
                    )}
                    <span className="vvu-label text-[9px] font-bold text-[#f3e38a] tracking-[0.12em] truncate">
                      {i + 1} · {d.title.toUpperCase()}
                    </span>
                  </div>
                  {d.id === 'pilot-acquisition' ? (
                    <Chip tone="lime" className="shrink-0">RECOMMENDED NOW</Chip>
                  ) : d.ready ? (
                    <Chip tone="lime" className="shrink-0">READY</Chip>
                  ) : (
                    <Chip tone="amber" className="shrink-0">NEEDS FACTS</Chip>
                  )}
                </div>
                {d.blockers.length > 0 && (
                  <ul className="space-y-1">
                    {d.blockers.map((b) => (
                      <li key={b} className="vvu-label text-[8px] text-[#e0a030]">▪ {b}</li>
                    ))}
                  </ul>
                )}
                <p className="vvu22-draft-preview font-mono text-[9.5px] text-[#8a9a7c] leading-relaxed">{d.prompt}</p>
                <div className="mt-auto pt-2 border-t border-[rgba(107,138,64,0.22)]">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleCopy(`draft-${d.id}`, d.prompt, d.title.toUpperCase())}
                    className="min-h-[44px] w-full vvu-label text-[9px] font-bold border-[#c8ff00]/50 text-[#c8ff00] hover:bg-[#c8ff00]/10 hover:text-[#c8ff00]"
                  >
                    {copiedKey === `draft-${d.id}` ? <Check className="size-3" aria-hidden /> : <Copy className="size-3" aria-hidden />}
                    COPY REQUEST PROMPT
                  </Button>
                </div>
              </div>
            </SectionReveal>
          ))}
        </div>
      </section>

      {/* footer note */}
      <footer className="vvu-panel-solid p-4">
        <p className="vvu-label text-[8px] text-[#7a8a6e] leading-relaxed">
          CAPABILITY DOSSIER · ROUND 22 · system facts probed server-side every 30s · profile persisted in the sovereign
          SQLite store (SCHEMA_VERSION 7 hot upgrade) · every save and statement generation is WORM-logged
          (CAPABILITY_PROFILE_SAVED · CAPABILITY_STATEMENT_GENERATED) · the &ldquo;no live SCADA&rdquo; fact is structural: the
          stack has no SCADA ingestion path — when that changes, this dossier changes with it, in one commit.
        </p>
      </footer>
    </div>
  );
}

export default CapabilityWorkspace;
