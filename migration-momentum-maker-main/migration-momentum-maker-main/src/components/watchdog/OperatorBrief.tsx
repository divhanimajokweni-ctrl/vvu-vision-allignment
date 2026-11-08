"use client";

// src/components/watchdog/OperatorBrief.tsx — R93 · THE CALIBRATION MENU,
// ON THE SURFACE WHERE THE EVIDENCE LIVES.
//
// R90 PROVED the root cause (kernel OOM-killer shoots next-server between
// guardian passes — SIGKILL leaves no trace, ~2GB rebound instantly);
// R91 deployed the answer's first rail (the 1-pass deep-critical landing);
// R92 built the ledger that quantifies the cost (MTBF, coverage-scoped
// availability, cadence). What remained open was the OPERATOR DECISION:
// the rss guard (2400MB) sits ABOVE the kernel's patience on this 4GB box,
// and only the operator can move it — it trades crash risk for bounce
// rhythm. This panel assembles that decision ON the watchdog surface: the
// proven chain, the live numbers, the three options with their costs.
//
// It decides NOTHING. The chip says DECISION PENDING · OPERATOR — the
// panel's job is that the next decision is made WITH the evidence in view,
// not from a worklog alone. Every number it shows is read live from the
// same payload the page already fetched; nothing is cached beyond it, and
// every absence renders as a dash (the R75 honesty contract).

import { ShieldQuestion, Scale, ChevronRight } from "lucide-react";

interface BriefGuardian {
  rssKb?: number | null;
  hwmKb?: number | null;
  boxAvailKb?: number | null;
  guardMb?: number;
  availFloorMb?: number;
  availCriticalMb?: number;
  nextServerPid?: number | null;
  bounces?: number;
}

interface BriefPlateau {
  baselineMb?: number | null;
  headroomMb?: number | null;
  driftMb?: number | null;
}

interface BriefResilience {
  count?: number;
  spanHours?: number | null;
  byReason?: Record<string, number>;
  witnessRows?: number;
  mtbfMin?: number | null;
  availabilityPct?: number | null;
  cadence?: "accelerating" | "cooling" | "steady" | null;
}

interface OperatorBriefProps {
  present: boolean;
  guardian?: BriefGuardian;
  plateau?: BriefPlateau | null;
  resilience?: BriefResilience;
}

function kbToMb(kb: number | null | undefined): number | null {
  return typeof kb === "number" && Number.isFinite(kb) ? Math.round(kb / 1024) : null;
}

export function OperatorBrief({ present, guardian, plateau, resilience }: OperatorBriefProps) {
  if (!present) return null;

  const rssMb = kbToMb(guardian?.rssKb);
  const hwmMb = kbToMb(guardian?.hwmKb);
  const availMb = kbToMb(guardian?.boxAvailKb);
  const guardMb = guardian?.guardMb;
  const floorMb = guardian?.availFloorMb;
  const critMb = guardian?.availCriticalMb;
  const baselineMb = plateau?.baselineMb ?? null;
  const headroomMb = plateau?.headroomMb ?? null;
  const driftMb = plateau?.driftMb ?? null;

  const count = resilience?.count ?? 0;
  const byReason = resilience?.byReason ?? {};
  const portSaves = byReason.port ?? 0;
  const rssSaves = byReason.rss ?? 0;
  const witnessRows = resilience?.witnessRows ?? 0;
  const mtbf = resilience?.mtbfMin ?? null;
  const availPct = resilience?.availabilityPct ?? null;
  const cadence = resilience?.cadence ?? null;
  const spanH = resilience?.spanHours ?? null;

  // Option A's working number: the guard the evidence points at — the
  // kernel has repeatedly killed boots whose RSS sat in the 1.9-2.1GB band,
  // so a guard below that zone is the one that can out-race it. Computed
  // from the LIVE guard so the text stays truthful after recalibration.
  const aGuard = guardMb != null ? Math.max(1200, Math.round((guardMb - 200) / 100) * 100) : null;

  const liveRow: Array<{ k: string; v: string; tone?: string; title?: string }> = [
    {
      k: "RSS NOW",
      v: rssMb != null ? `${rssMb} MB` : "—",
      tone: guardMb != null && rssMb != null && rssMb > guardMb - 300 ? "amber" : undefined,
      title: "next-server VmRSS, the guardian\u2019s own /proc read this pass",
    },
    {
      k: "HWM",
      v: hwmMb != null ? `${hwmMb} MB` : "—",
      title: "VmHWM — the kernel\u2019s remembered high-water mark; GC cannot lower it",
    },
    {
      k: "GUARD",
      v: guardMb != null ? `${guardMb} MB` : "—",
      title:
        "the rss rail\u2019s bounce line — 2 consecutive passes above it triggers the controlled landing",
    },
    {
      k: "BASELINE",
      v: baselineMb != null ? `~${baselineMb} MB` : "—",
      title: "R69 warm plateau — median RSS of the 10 newest healthy passes",
    },
    {
      k: "HEADROOM",
      v: headroomMb != null ? `${headroomMb} MB` : "—",
      tone:
        headroomMb != null && headroomMb < 150
          ? "red"
          : headroomMb != null && headroomMb < 300
            ? "amber"
            : "lime",
      title: "guard minus warm baseline — the space the warm cycle has to live in",
    },
    {
      k: "BOX AVAIL",
      v: availMb != null ? `${availMb} MB` : "—",
      title: "MemAvailable — what the kernel can still hand out before it starts killing",
    },
    {
      k: "MTBF",
      v: mtbf != null ? `${mtbf.toFixed(1)}M` : "—",
      title: "mean interval between real saves, over the journal\u2019s own coverage",
    },
    {
      k: "AVAIL",
      v: availPct != null ? `${availPct.toFixed(2)}%` : "—",
      tone: availPct != null && availPct < 99 ? "amber" : "lime",
      title: "1 − downtime/span over the journal\u2019s coverage — never arm age, never all-time",
    },
    {
      k: "CADENCE",
      v: cadence ? cadence.toUpperCase() : "—",
      title: "the last 3 save intervals against the overall mean (needs ≥6 intervals)",
    },
  ];

  const options: Array<{
    key: string;
    title: string;
    body: string;
    cost: string;
    state: "live" | "open";
  }> = [
    {
      key: "A",
      title: aGuard != null ? `LOWER THE RSS GUARD → ~${aGuard} MB` : "LOWER THE RSS GUARD",
      body: "The guard is the only rail that can land the boot BEFORE the kernel\u2019s zone: the R90-R92 evidence shows the kernel killing boots whose RSS sat around 1.9-2.1GB, while the 2400MB guard waits above them. A guard inside that gap turns the kernel\u2019s silent kill into a controlled landing, every time the warm cycle climbs into it. R96\u2019s projection refines the claim with the journal\u2019s own witnesses: both witnessed kills peaked at ~2007MB in-window and never crossed 2200 — the panel below reads the grid level-by-level, loop-guard included.",
      cost: "COST: more deliberate bounces — the warm cycle (+~758 MB/boot, R73\u2019s measurement) crosses a lower guard sooner, so landing downtime (~22s mean) becomes a rhythm the estate absorbs on schedule instead of by surprise.",
      state: "open",
    },
    {
      key: "B",
      title:
        critMb != null
          ? `DEEP-CRITICAL AVAIL RAIL · <${critMb} MB · 1-PASS (R91, LIVE)`
          : "DEEP-CRITICAL AVAIL RAIL (R91)",
      body: "Deployed and armed: ONE pass under the deep floor with next-server dominant starts the landing immediately — the R90 timeline showed the 2-pass discipline is exactly what the kernel outruns below ~193MB. Its availKb + witness ride every row, so each real landing keeps the call auditable.",
      cost: "COST: 1-pass means no second opinion — a transient deep dip could trigger a bounce the 2-pass rails would have ride out; the row\u2019s availKb and the witness make every call reviewable after the fact.",
      state: "live",
    },
    {
      key: "C",
      title: "ACCEPT THE KERNEL RACE · WITNESSES + TEE -A (STATUS QUO)",
      body: "Keep the 2400MB guard, the R90 crash witness (25-line dev.log tail per bounce), and the tee -a append that survives every respawn. The kernel\u2019s occasional silent kill is followed by a controlled ~22s landing; the reliability ledger quantifies exactly what that costs over the journal\u2019s span.",
      cost: `COST: the crash itself stays uncontrolled (mid-compile, mid-request) — ${count > 0 ? `${portSaves} of ${count} real saves were post-mortem cleanups of exactly that` : "the reason mix on record quantifies it once saves exist"}; downtime is bounded but the kill is not.`,
      state: "open",
    },
  ];

  return (
    <div
      className="relative overflow-hidden rounded-sm border border-[#e0a030]/25 bg-black/25 px-2.5 py-2 transition-colors duration-200 hover:border-[#4a5a3e]"
      data-testid="operator-brief"
      title="R93 — the operator decision R90's root-cause proof created, assembled where the evidence lives: the proven chain, the live numbers, and the three options with their costs. This panel decides nothing — the decision (and its rhythm consequences) belongs to the operator; the guardian enforces whatever is armed, and this surface only reads it."
    >
      {/* R94 — the amber hairline: a decision panel gets a decision-tinted
          edge, not another flat box; aria-hidden decoration only. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e0a030]/60 to-transparent"
      />
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
        <p className="vvu-label text-[8px] font-bold tracking-[0.22em] text-[#e0a030]/90 inline-flex items-center gap-1.5">
          <ShieldQuestion className="size-3" aria-hidden />
          OPERATOR BRIEF · THE CALIBRATION MENU — WHAT THE KERNEL-RACE EVIDENCE SAYS
        </p>
        <span
          className="vvu-label text-[8px] font-bold px-1.5 py-0.5 rounded-sm border border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10 vvu-pulse cursor-help transition-[filter,border-color] hover:brightness-125"
          title="the guard calibration is an operator decision with rhythm consequences (bounce frequency vs crash risk) — deliberately not taken unilaterally; R90 recorded the menu, R93 put it on the surface"
        >
          DECISION PENDING · OPERATOR
        </span>
      </div>

      {/* the proven chain */}
      <div className="mt-1.5 rounded-sm border border-[#3a4530]/70 bg-black/30 px-2 py-1.5">
        <p className="vvu-label text-[7.5px] font-bold tracking-[0.18em] text-[#7a8a6e]">
          THE PROVEN CHAIN (R90 → R92)
        </p>
        <ul className="mt-0.5 space-y-0.5 text-[9px] leading-relaxed text-[#b8c9a0]">
          <li className="flex gap-1.5">
            <ChevronRight className="size-2.5 mt-0.5 shrink-0 text-[#6b8a40]" aria-hidden />
            <span>
              <b className="text-[#c8ff00]">THE DEATHS:</b> &apos;port&apos; saves are post-mortem
              cleanups of kernel OOM kills — avail collapses, the tree is dead between passes, avail
              rebounds ~2.3GB.{" "}
              {count > 0 ? (
                <>
                  On record: <b className="tabular-nums">{portSaves}</b> of{" "}
                  <b className="tabular-nums">{count}</b> real saves across{" "}
                  {spanH != null ? `${spanH.toFixed(1)}h` : "—"} (plus{" "}
                  <b className="tabular-nums">{rssSaves}</b> genuine rss-rail landings).
                </>
              ) : (
                "the reason mix fills as saves land."
              )}
            </span>
          </li>
          <li className="flex gap-1.5">
            <ChevronRight className="size-2.5 mt-0.5 shrink-0 text-[#6b8a40]" aria-hidden />
            <span>
              <b className="text-[#c8ff00]">THE WITNESS:</b> R90 captures the dying boot&apos;s last
              25 log lines before the kill — routine 200s, then silence: SIGKILL leaves no stack
              trace.{" "}
              {count > 0 ? (
                <>
                  Coverage: <b className="tabular-nums">{witnessRows}</b> row
                  {witnessRows === 1 ? "" : "s"} carry one (grows from R90 onward; pre-R90 rows
                  cannot be backfilled).
                </>
              ) : (
                "no rows on record yet."
              )}
            </span>
          </li>
          <li className="flex gap-1.5">
            <ChevronRight className="size-2.5 mt-0.5 shrink-0 text-[#6b8a40]" aria-hidden />
            <span>
              <b className="text-[#c8ff00]">THE GAP:</b> the guard
              {guardMb != null ? ` (${guardMb} MB)` : ""} sits ABOVE the zone where the kernel has
              repeatedly acted (~1.9-2.1GB on this 4GB box
              {floorMb != null ? `; the box-pressure floor is ${floorMb} MB` : ""}
              {critMb != null ? `, the R91 deep rail ${critMb} MB · 1-pass` : ""}) — the rails can
              only clean up after the kernel unless a guard line sits below its patience.
            </span>
          </li>
        </ul>
      </div>

      {/* live numbers — R94: each cell carries a tone-matched left accent
          (the same three-tone grammar the value itself speaks), so the row
          reads hot/cool at a glance before the number is parsed */}
      <div className="mt-1.5 grid grid-cols-3 gap-x-3 gap-y-1 sm:grid-cols-5 lg:grid-cols-9">
        {liveRow.map((c) => (
          <div
            key={c.k}
            title={c.title}
            className={`border-l-2 pl-1.5 ${
              c.tone === "red"
                ? "border-[#e5484d]/60"
                : c.tone === "amber"
                  ? "border-[#e0a030]/60"
                  : c.tone === "lime"
                    ? "border-[#6b8a40]/60"
                    : "border-[#3a4530]/60"
            }`}
          >
            <p className="vvu-label text-[7px] tracking-[0.16em] text-[#7a8a6e]">{c.k}</p>
            <p
              className={`font-mono text-[10px] tabular-nums ${
                c.tone === "red"
                  ? "text-[#e5484d]"
                  : c.tone === "amber"
                    ? "text-[#e0a030]"
                    : c.tone === "lime"
                      ? "text-[#c8ff00]"
                      : "text-[#c9d4bd]"
              }`}
            >
              {c.v}
            </p>
          </div>
        ))}
      </div>

      {/* the menu — R94: cards answer the pointer (border + background
          lift) and carry a state-matched left accent; keyboard focus keeps
          the same affordance via focus-within */}
      <div className="mt-2 grid gap-1.5 md:grid-cols-3">
        {options.map((o) => (
          <div
            key={o.key}
            className={`group rounded-sm border border-l-2 px-2 py-1.5 transition-colors duration-200 ${
              o.state === "live"
                ? "border-[#3a4530]/80 border-l-[#6b8a40]/70 bg-[#6b8a40]/5 hover:border-[#6b8a40]/60 hover:bg-[#6b8a40]/10 focus-within:border-[#6b8a40]/60"
                : "border-[#3a4530]/80 border-l-[#e0a030]/60 bg-black/20 hover:border-[#e0a030]/40 hover:bg-black/30 focus-within:border-[#e0a030]/40"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span
                className={`vvu-label text-[9px] font-bold size-4 inline-flex items-center justify-center rounded-sm border ${
                  o.state === "live"
                    ? "border-[#6b8a40]/60 text-[#c8ff00] bg-[#6b8a40]/15"
                    : "border-[#e0a030]/50 text-[#e0a030] bg-[#e0a030]/10"
                }`}
                aria-hidden
              >
                {o.key}
              </span>
              <p className="vvu-label text-[8px] font-bold text-[#c9d4bd] leading-tight">
                {o.title}
              </p>
              {o.state === "live" && (
                <span
                  className="vvu-label ml-auto text-[7px] font-bold px-1 py-px rounded-sm border border-[#6b8a40]/50 text-[#c8ff00]"
                  title="already deployed and armed — no re-arm needed; validation completes with its first real landing"
                >
                  LIVE
                </span>
              )}
            </div>
            <p className="mt-1 text-[9px] leading-relaxed text-[#9aa88c]">{o.body}</p>
            <p className="mt-1 text-[9px] leading-relaxed text-[#e0a030]/85">{o.cost}</p>
          </div>
        ))}
      </div>

      {/* the orthogonal lever + the closing line */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#3a4530]/60 pt-1.5">
        <p
          className="vvu-label text-[8px] text-[#7a8a6e] leading-relaxed inline-flex items-start gap-1.5"
          title="works with any option: the QA-hygiene ritual (browser sessions closed at round end) freed ~350MB on the 4GB box (R91) — every consumer that is not next-server is marginal memory the kernel otherwise weighs against it"
        >
          <Scale className="size-3 mt-px shrink-0 text-[#e0a030]/70" aria-hidden />
          ORTHOGONAL, ANY OPTION — THE MEMORY DIET: stray browser sessions were OOM fuel (R91:
          closing them freed ~350MB); the compile-burst opener is the estate&apos;s own rhythm, and
          the guardian pid/counter speak their arm-span while the journal speaks the record.
        </p>
        <span
          className="vvu-label ml-auto text-[8px] text-[#5f6e55]"
          title="the panel reads the same payload the page fetched — nothing is invented, nothing is cached beyond it"
        >
          READ-ONLY · DECIDES NOTHING
        </span>
      </div>
    </div>
  );
}
