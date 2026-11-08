"use client";

// src/components/watchdog/WatchdogWorkspace.tsx — Task 41 · #/watchdog
// WATCHDOG · RAIL HEALTH — read-only monitor over the three service rails
// and the guardian's four bounce rails (rss guard · box floor · R91
// deep-critical · port liveness).
//
//   * /api/watchdog polled every 10s (server-side probe of :3003/:3004/:3005
//     with its own 2.5s timeout per rail — a down rail is displayed DOWN).
//   * /api/integrity polled every 30s — the :3000 surface's own
//     running-vs-disk fingerprint (stale module = fail-closed red).
//   * /api/bridge/governance polled every 10s (Task 42) — the vault-bridge
//     control-plane ledger: entries, chain validity, merkle root, the six
//     LOG rules wired, the DH queue, revoked + registered devIDs. VERIFY
//     CHAIN recomputes from genesis (?verify=1) — honest red on failure.
//   * RECHECK NOW invalidates + refetches all three queries + toast.
//   * NO WORM writes — the watchdog never mutates anything it watches.
//   * Skeletons on first load — never faked data.

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Check,
  ChevronDown,
  ClipboardList,
  Copy,
  Crosshair,
  DatabaseBackup,
  Download,
  HeartPulse,
  History,
  Link2,
  Loader2,
  RefreshCw,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { swStatus, swReset, type SwStatus } from "@/components/pwa/ServiceWorkerRegistrar";
import { readHashParts, useHashQuery, writeHashQuery } from "@/hooks/use-hash-route";
import {
  PlateauScope,
  usePlateauHistoryQuery,
  type PlateauHistoryResponse,
} from "@/components/watchdog/PlateauScope";
import { MemoryPressure, parseGuardianStampMs } from "@/components/watchdog/MemoryPressure";
import { OperatorBrief } from "@/components/watchdog/OperatorBrief";
import { OperatorProjection } from "@/components/watchdog/OperatorProjection";
import { LivingRead } from "@/components/watchdog/LivingRead";
import { PairSheet } from "@/components/watchdog/PairSheet";
import { DeathWindows } from "@/components/watchdog/DeathWindows";
import { SawtoothReadout } from "@/components/watchdog/SawtoothReadout";
import { LatencyLedger } from "@/components/watchdog/LatencyLedger";
import { Watchboard } from "@/components/watchdog/Watchboard";
import { BootLedger } from "@/components/watchdog/BootLedger";
import { DeathCauses } from "@/components/watchdog/DeathCauses";
import { LatencyMemory } from "@/components/watchdog/LatencyMemory";
import { SurvivalCurve } from "@/components/watchdog/SurvivalCurve";
import { Outlook } from "@/components/watchdog/Outlook";
import { ThreeDrifts } from "@/components/watchdog/ThreeDrifts";
import type { RailProjectionPayload } from "@/lib/operator-projection";
import {
  CONSOLE_POLL_ROUTES,
  KNOWN_SELF_ROUTES,
  arcPopulation,
  classifyVerdict,
  computeBootArcs,
  computeKnownSelf,
  computeSettles,
  FLAT_CLIMB_MB,
  MIXED_MB_PER_1K,
  SETTLE_BAND_HI,
  SETTLE_BAND_LO,
  TOO_FEW_REQUESTS,
  TRACKED_MB_PER_1K,
  openPairs,
  type ArcPopulation,
  type BootArc,
  type BootSettle,
  type VerdictKind,
} from "@/lib/verdict-tiers";
import { classifyIntervalVsMean } from "@/lib/intervals";
import {
  ARMED_WINDOW_MS,
  chronicleAllChipAria,
  chronicleClassChipAria,
  chronicleExportAria,
  chronicleMatchAria,
  copyArmAria,
  copyLinkAria,
  copyMixAria,
  copyVerdictAria,
  disarmVoice,
  drillFlightVoice,
  drillVoice,
  exportLedgerAria,
  pwaReloadAria,
  pwaWaitingAnnouncement,
  readFailureAria,
  recordFlightAria,
  recordReadingAria,
  restartFlightVoice,
  restartVoice,
  rereadStripAria,
  readDevseedWitnessFlag,
  witnessFoldAria,
} from "@/lib/watchboard-ledger";

// ── API contracts ────────────────────────────────────────────────────────────

interface ProximityAlarmLine {
  seq: number;
  raisedAtUtc: string;
  kind: string;
  brokenAt?: string | null;
  reason?: string | null;
}

interface RailStatusDetail {
  ok?: boolean;
  node?: string;
  protocol?: string;
  agentOnline?: boolean;
  pairedDevices?: number;
  viewerCount?: number;
  receipts?: {
    count: number;
    root?: string;
    verified?: boolean;
    merkleRoot?: string;
    anchored?: number;
  };
  // R62 — proximity record layer (in-process rail)
  valid?: boolean;
  records?: number;
  headPosition?: number | null;
  headHash?: string | null;
  brokenAt?: string | null;
  reason?: string | null;
  checkedInMs?: number;
  sentinel?: {
    running: boolean;
    enabled: boolean;
    killSwitch: boolean;
    intervalMs: number;
    consecutiveValid: number;
    totalPasses: number;
    lastSeenHeadPosition: number | null;
  };
  alarmCount?: number;
  alarms?: ProximityAlarmLine[];
}

interface WatchdogRail {
  id: "telemetry" | "bridge" | "field" | "proximity";
  label: string;
  port: number;
  ok: boolean;
  latencyMs: number;
  httpStatus?: number;
  error?: string;
  detail?: RailStatusDetail;
}

interface WatchdogResponse {
  checkedAt: string;
  ok: boolean;
  rails: WatchdogRail[];
}

interface Footprint {
  pid: number;
  rssKb: number | null;
  hwmKb: number | null;
  heapUsedMb: number;
  heapTotalMb: number;
  externalMb: number;
  arrayBuffersMb: number;
  guardMb: number;
  guardSource: string;
  boxTotalMb: number;
  boxAvailMb: number | null;
  sampledAtUtc: string;
}

interface IntegrityResponse {
  match: boolean;
  compiledAt: string;
  uptimeSec: number;
  watchedFiles?: string[];
  footprint?: Footprint;
}

// R66 — the :3000 guardian's own report via /api/guardian. present:false is
// an honest GUARDIAN OFF (no status file yet); stale:true is a guardian
// that stopped passing — both must be visible, never faked green.
interface GuardianBounceRow {
  at?: string;
  reason?: string;
  drill?: boolean;
  port?: number;
  rssKb?: number | null;
  guardKb?: number;
  oldPid?: number | null;
  newPid?: number | null;
  downtimeMs?: number | null;
  // R91 — the box's MemAvailable at the decision moment, when the caller had
  // it (every main-loop rail passes it; drills pass None). Absent on pre-R91
  // rows — the OOM-race forensics read per row from R91 onward.
  availKb?: number | null;
  ok?: boolean;
  error?: string | null;
  // R90 — the crash witness: the dying boot's own last lines, captured by
  // the guardian at bounce time BEFORE anything is killed and mirrored into
  // the journal row. Absent on pre-R90 rows — history cannot be backfilled.
  evidence?: { path?: string; truncated?: boolean; lines?: string[]; error?: string } | null;
  // R94 — the memory witness: the guardian's last ≤12 memSeries samples at
  // bounce time — the pressure SHAPE the save landed into, durable in the
  // journal. Absent on pre-R94 rows (and on drills — a scratch victim says
  // nothing about box pressure).
  atMs?: number;
  memWitness?: Array<{ t: string; rssKb: number | null; availKb: number | null }> | null;
  unparsable?: boolean;
  raw?: string;
}

interface GuardianResponse {
  present: boolean;
  guardianAlive?: boolean;
  stale?: boolean;
  armCommand?: string;
  error?: string;
  guardian?: {
    guardianPid: number;
    guardianFilePid?: number | null;
    startedAtUtc: string;
    intervalSec: number;
    guardMb: number;
    devPid: number | null;
    devPidAlive: boolean;
    nextServerPid: number | null;
    rssKb: number | null;
    hwmKb: number | null;
    boxAvailKb?: number | null;
    portOk: boolean;
    duplicateDetected: boolean;
    consecutiveOver: number;
    consecutiveDead: number;
    consecutiveLow: number;
    // R91 — the deep-critical rail's live state (absent on pre-R91 status
    // files — the honest rendering is omission, same contract as R75).
    consecutiveCrit?: number;
    availCriticalMb?: number;
    availFloorMb: number;
    bounces: number;
    lastAction: string;
    lastBounceAtUtc: string | null;
    lastPassAtUtc: string;
    // R75 — the scheduled quiet-save contract, read from status.json.
    // ABSENT on status files written before the flag existed — which is
    // exactly how the UI knows to say OFF honestly (no invention).
    schedule?: {
      enabled: boolean;
      at: string | null;
      minRssMb: number;
      lastFiredDateUtc: string | null;
      lastFiredAtUtc: string | null;
    } | null;
    // R93 — the bounded memory-pressure series (oldest first, ≤90 samples ≈
    // 30 min at the 20s pass), straight from the guardian's own /proc reads.
    // ABSENT on pre-R93 status files and reset by every re-arm — the
    // arm-span scope is disclosed on the surface, never passed off as more.
    memSeries?: Array<{ t: string; rssKb: number | null; availKb: number | null }>;
    // R99 — the auto-pair's live state from status.json: whether the
    // guardian records its own post-bounce verdict readings, and when the
    // next two fire. ABSENT on pre-R99 status files — the UI renders that
    // absence honestly (the R75 contract).
    autoPair?: {
      enabled: boolean;
      openerDueUtc: string | null;
      secondDueUtc: string | null;
      workerPid: number | null;
    };
  };
  bounces?: GuardianBounceRow[];
  journalRowsTotal?: number;
  // R67 — drill rows (reason "drill", drill:true) are evidence of
  // READINESS, counted separately from real bounces of the surface.
  drills?: { count: number; landed: number; last: GuardianBounceRow | null };
  // R90 — LANDING RESILIENCE: the downtime distribution and reason mix over
  // EVERY real (non-drill) save on record, computed server-side in one
  // journal read. spanHours is the journal's OWN coverage (first→last real
  // save) — never the arm age, which the journal cannot know.
  resilience?: {
    count: number;
    spanHours: number | null;
    totalDowntimeMs: number;
    meanMs: number | null;
    medianMs: number | null;
    longestMs: number | null;
    longestAt: string | null;
    slowLandings: number;
    byReason: Record<string, number>;
    witnessRows: number;
    // R92 — the reliability ledger: the same journal read as TIME and
    // AVAILABILITY, over the journal's own coverage only. mtbf/availability
    // are null with fewer than two real saves — one event has no interval,
    // and an availability number needs a span to live in.
    mtbfMin?: number | null;
    availabilityPct?: number | null;
    longestCalmMin?: number | null;
    longestCalmFrom?: string | null;
    longestCalmTo?: string | null;
    stormMin?: number | null;
    currentCalmMin?: number | null;
    // R96 — the live calm's percentile among all intervals on record (share
    // of historical gaps strictly shorter than this streak). ABSENT on
    // pre-R96 payloads — the cell renders its absence honestly.
    calmPercentile?: number | null;
    cadence?: "accelerating" | "cooling" | "steady" | null;
    // R94 — the interval tail: the cadence verdict's own numbers (≤40
    // consecutive-save intervals, oldest→newest, minutes). ABSENT on
    // pre-R94 payloads — the strip renders its absence honestly.
    intervalSeries?: Array<{ from: string; to: string; min: number }>;
    downtimeSeries?: Array<{ at: string; ms: number; reason: string }>;
  };
  // R96 — THE OPERATOR PROJECTION: the calibration menu's standing ask,
  // computed from the journal's own witnessed kills (r96-tested engine,
  // served from the same journal read). ABSENT on pre-R96 payloads — the
  // panel renders its absence honestly.
  railProjection?: RailProjectionPayload | null;
  // R69 — the warm plateau: median RSS of the guardian's 10 newest healthy
  // passes, and the honest headroom from that baseline to the guard.
  // R70 — driftMb: the plateau TREND across the sampled window (up to 120
  // passes) — newest-half median minus oldest-half median. A climbing
  // plateau eats the headroom; a drop is usually a fresh boot after a save.
  plateau?: {
    baselineMb: number | null;
    headroomMb: number | null;
    driftMb: number | null;
    samples: number;
    since: string | null;
    until: string | null;
  } | null;
}

// R75 — the FLEET HEALTH BOARD contract: the :3000 surface + the six
// sibling mini-services, root-probed server-side against a static registry
// whose expectations come from each service's own source.
interface FleetResponse {
  probedAtUtc: string;
  summary: { total: number; ok: number; odd: number; down: number };
  rows: Array<{
    port: number;
    name: string;
    service: string;
    role: string;
    kind: "surface" | "http" | "api-only";
    expectedRootStatus: number;
    httpStatus: number | null;
    latencyMs: number;
    verdict: "OK" | "DOWN" | "ODD";
    error: string | null;
    note: string | null;
  }>;
}

// R76 — the restart route's journal row (verbatim result of the helper).
interface FleetRestartResult {
  at: string;
  action: "restart";
  port: number;
  name: string;
  trigger: "console";
  oldPid: number | null;
  newPid: number | null;
  downtimeMs: number | null;
  httpStatus: number | null;
  ok: boolean;
  error: string | null;
}

// R70 — the estate chronicle: one timeline stitched READ-ONLY from the three
// append-only ledgers (guardian bounces.jsonl, vault-index.jsonl,
// sync-journal.jsonl). The API's honesty contract is the UI's: what was
// journaled is what is shown; corrupt lines are COUNTED, never hidden.

type ChronicleClass = "save" | "drill" | "snapshot" | "sync" | "fleet" | "verdict";
type ChronicleTone = "ok" | "warn" | "fail";

interface ChronicleMetaChip {
  k: string;
  v: string;
}

interface ChronicleEvent {
  id: string;
  at: string | null;
  atMs: number;
  cls: ChronicleClass;
  tone: ChronicleTone;
  title: string;
  detail: string | null;
  meta: ChronicleMetaChip[];
  /** R81 — per-event tone-chip label override (a MIXED verdict reading is
   *  not a REFUSAL — the chip says the row's own tier word). */
  toneLabel?: string;
}

interface ChronicleSource {
  id: "guardian" | "vault" | "sync" | "fleet" | "verdict";
  file: string;
  present: boolean;
  rows: number;
  corrupt: number;
  gone?: number;
}

interface ChronicleResponse {
  generatedAtUtc: string;
  events: ChronicleEvent[];
  totals: {
    all: number;
    save: number;
    drill: number;
    snapshot: number;
    sync: number;
    fleet: number;
    verdict: number;
    failed: number;
    warned: number;
  };
  sources: ChronicleSource[];
  /** R86 — the verdict scorecard folded into the evidence family: the SAME
   *  shared settle engine the trend strip uses (computeSettles), computed
   *  server-side from readings.jsonl. Null when no readings exist yet. */
  calibration: {
    bandLo: number;
    bandHi: number;
    boots: number;
    settledBoots: number;
    settledInBand: number;
    /** R89 — per-boot rows now carry the bounce join: the boot's tree root
     *  and (when the guardian journal holds one) the save that ENDED it. */
    perBoot: Array<{
      pid: number;
      readings: number;
      first: number | null;
      last: number | null;
      settlePct: number | null;
      inBand: boolean;
      treePid: number | null;
      ended: { reason: string; label: string; at: string | null; downtimeMs: number | null } | null;
    }>;
    latest: {
      at: string;
      bootPid: number;
      devTreePid: number | null;
      kind: string;
      mbPer1k: number | null;
    } | null;
    /** R89 — the guardian save histogram (drills excluded): the reason mix
     *  R88's handover asked to watch. Null when the journal is absent. */
    saves: { total: number; byReason: Record<string, number> } | null;
  } | null;
}

// Task 42 — vault-bridge governance ledger (proxied read-only at
// /api/bridge/governance → :3004 control plane).

interface GovernanceRule {
  ruleId: string;
  wiredAt: string;
  entrySeq: number;
  actorDevId: string;
}

interface GovernanceDhQueueItem {
  id: string;
  devId: string;
  ruleId: string;
  reason: string;
  at: string;
  status: string;
}

interface GovernanceDev {
  devId: string;
  label: string;
  scope: string;
  registeredAt: string;
  expiresAt: string | null;
  revoked: boolean;
}

interface GovernanceResponse {
  genesis: string;
  count: number;
  head: string;
  chainValid: boolean;
  merkleRoot: string;
  rules: GovernanceRule[];
  dhQueue: GovernanceDhQueueItem[];
  dhQueuePending: number;
  revoked: string[];
  devs: GovernanceDev[];
}

interface GovernanceVerifyResponse {
  valid: boolean;
  checked: number;
  firstBadIndex: number;
  root?: string;
  merkleRoot?: string;
  count?: number;
  head?: string;
}

interface GovVerifyState {
  busy: boolean;
  valid?: boolean;
  checked?: number;
  firstBadIndex?: number;
  reason?: string;
  at?: string;
}

// The six governance rules the ledger can wire (LOG_2 … LOG_7). A rule chip
// goes lime only when the ledger's rules[] actually contains its ruleId.
const GOV_RULES: ReadonlyArray<{ id: string; label: string }> = [
  { id: "LOG_2", label: "LOG_2 devID" },
  { id: "LOG_3", label: "LOG_3 ledger" },
  { id: "LOG_4", label: "LOG_4 auto-DH" },
  { id: "LOG_5", label: "LOG_5 session" },
  { id: "LOG_6", label: "LOG_6 scope" },
  { id: "LOG_7", label: "LOG_7 QR" },
] as const;

// ── helpers ─────────────────────────────────────────────────────────────────

function stamp(iso: string): string {
  // Alarm-raised times arrive already in the one-clock format
  // ("YYYY-MM-DD HH:MM:SS" from formatUtc) — pass them through untouched
  // rather than re-parsing through the viewer's local timezone.
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(iso)) return iso.slice(0, 19);
  const d = new Date(iso);
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}

function uptimeLabel(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

// R67 — ESTATE REPORT: the full operator hand-off, assembled from the data
// ALREADY POLLED by this workspace (no new fetches, no invention — every
// line comes from a query response this console actually holds). Plain
// text, paste-ready for the pilot conversation, stamped on the server-clock
// shaped strings the estate already uses.
function buildEstateReport(input: {
  rails: WatchdogRail[] | undefined;
  checkedAt: string | undefined;
  integrity: IntegrityResponse | undefined;
  governance: GovernanceResponse | undefined;
  guardian: GuardianResponse | undefined;
}): string {
  const p2 = (n: number) => String(n).padStart(2, "0");
  const now = new Date();
  const L: string[] = [];
  const bar = "─".repeat(46);

  L.push("VVU ESTATE · OPERATOR STATUS REPORT");
  L.push(
    `generated ${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())} ${p2(now.getHours())}:${p2(now.getMinutes())}:${p2(now.getSeconds())} (console-local) · as seen by this console's polls`,
  );
  L.push(bar);

  // 1 · rails
  const rails = input.rails ?? [];
  const up = rails.filter((r) => r.ok).length;
  L.push("");
  L.push(
    `RAILS (${up}/${rails.length} UP)${input.checkedAt ? ` · checked ${stamp(input.checkedAt)}` : ""}`,
  );
  for (const r of rails) {
    const verdict = r.ok ? "UP" : "DOWN";
    L.push(
      `  [${verdict}] ${r.label} (:${r.port}) · ${r.latencyMs}ms${r.httpStatus ? ` · HTTP ${r.httpStatus}` : ""}${r.error ? ` · ${r.error}` : ""}`,
    );
    if (r.id === "proximity" && r.detail) {
      const d = r.detail;
      L.push(
        `        chain ${d.valid ? "VALID" : `BROKEN AT ${d.brokenAt ?? "?"}`} · ${d.records ?? "?"} records · head ${d.headPosition ?? "?"} · sentinel ${d.sentinel ? (d.sentinel.killSwitch ? "KILL SWITCH" : d.sentinel.running ? `ON WATCH ${Math.round(d.sentinel.intervalMs / 1000)}s` : "DISARMED") : "?"}`,
      );
      L.push(`        alarm rail: ${d.alarmCount ?? 0} on record`);
    }
  }

  // 2 · governance
  const g = input.governance;
  if (g) {
    L.push("");
    L.push("VAULT-BRIDGE GOVERNANCE (:3004)");
    L.push(
      `  chain ${g.chainValid ? "VALID" : "BROKEN"} · ${g.count} entries · head ${g.head.slice(0, 24)}…`,
    );
    L.push(
      `  rules wired ${g.rules.length}/6 · DH queue ${g.dhQueuePending} · revoked ${g.revoked.length} · devs ${g.devs.length}`,
    );
  }

  // 3 · the :3000 surface
  const itg = input.integrity;
  if (itg) {
    const fp = itg.footprint;
    L.push("");
    L.push(":3000 SURFACE");
    L.push(
      `  running-vs-disk ${itg.match ? "MATCH" : "MISMATCH (stale module — fail-closed)"} · uptime ${uptimeLabel(itg.uptimeSec)}`,
    );
    if (fp) {
      const rss = fp.rssKb != null ? Math.round(fp.rssKb / 1024) : null;
      const hwm = fp.hwmKb != null ? Math.round(fp.hwmKb / 1024) : null;
      L.push(
        `  memory RSS ${rss ?? "?"}MB · peak ${hwm ?? "?"}MB · guard ${fp.guardMb}MB · box avail ${fp.boxAvailMb ?? "?"}MB · pid ${fp.pid}`,
      );
    }
  }

  // 4 · guardian
  const gd = input.guardian;
  L.push("");
  L.push("GUARDIAN (OOM RAIL)");
  if (!gd?.present) {
    L.push("  OFF — no status file; the surface is unguarded against kernel OOM kills");
  } else {
    const st = gd.guardian;
    L.push(
      `  ${gd.stale ? "STALE" : "ARMED"} · every ${st?.intervalSec ?? "?"}s · guard ${st?.guardMb ?? "?"}MB · box floor ${st?.availFloorMb ?? "?"}MB · crit rail <${st?.availCriticalMb ?? "?"}MB 1-pass · pid ${st?.guardianPid ?? "?"}`,
    );
    L.push(
      `  bounces ${st?.bounces ?? 0} · last action ${st?.lastAction ?? "?"} · port 3000 ${st?.portOk ? "UP" : "DOWN"} · duplicate ${st?.duplicateDetected ? "DETECTED" : "none"}`,
    );
    if (gd.drills) {
      const dl = gd.drills.last;
      L.push(
        `  drills ${gd.drills.count} run · ${gd.drills.landed} landed${dl ? ` · last ${dl.ok ? "PASSED" : "FAILED"} ${dl.at ? stamp(dl.at) : ""} (port ${dl.port ?? "?"})` : ""}`,
      );
    }
  }

  L.push("");
  L.push(bar);
  L.push(
    "honest-limits: this report is a point-in-time console snapshot; the WORM chain, journal and delivery logs on disk are the durable evidence.",
  );
  return L.join("\n");
}

/** 2–4 honest detail lines from the rail's OWN status payload. */
function detailLines(rail: WatchdogRail): string[] {
  const d = rail.detail;
  if (!d) return ["no detail payload — probe-level status only"];
  if (rail.id === "telemetry") {
    // :3003 /healthz answers { ok: true } and nothing else — that IS the detail.
    return [`probe GET /healthz · ok: ${String(d.ok === true)}`];
  }
  if (rail.id === "proximity") {
    // The integrity rail: what the walker just saw, plus the sentinel state.
    const lines: string[] = [];
    if (d.valid) {
      lines.push(`chain walk: ${d.records ?? "?"} records · VALID · ${d.checkedInMs ?? "?"}ms`);
      lines.push(`head: proximity#${d.headPosition ?? "?"} · ${(d.headHash ?? "—").slice(0, 14)}…`);
    } else {
      lines.push(`chain walk: BROKEN AT ${d.brokenAt ?? "?"}`);
    }
    const s = d.sentinel;
    if (s) {
      lines.push(
        `sentinel: ${s.killSwitch ? "KILL SWITCH" : s.running ? `ON WATCH · ${Math.round(s.intervalMs / 1000)}s · ${s.consecutiveValid} valid` : "DISARMED"}`,
      );
    }
    lines.push(`alarm rail: ${d.alarmCount ?? 0} on disk`);
    return lines.slice(0, 4);
  }
  const lines: string[] = [];
  const rec = d.receipts;
  if (rec) {
    const anchored = typeof rec.anchored === "number" ? ` · anchored ${rec.anchored}` : "";
    lines.push(
      `receipts: ${rec.count}${anchored}${rec.verified === false ? " · CHAIN UNVERIFIED" : ""}`,
    );
    if (rec.merkleRoot) lines.push(`merkle: ${rec.merkleRoot.slice(0, 16)}…`);
  }
  if (typeof d.pairedDevices === "number") {
    lines.push(`paired devices: ${d.pairedDevices} · viewers: ${d.viewerCount ?? 0}`);
  }
  if (d.node || d.protocol) {
    lines.push(`${d.node ?? "node"} · ${d.protocol ?? "—"}`);
  }
  return lines.slice(0, 4);
}

// ── query hooks ─────────────────────────────────────────────────────────────

function useWatchdogQuery() {
  return useQuery<WatchdogResponse, Error>({
    queryKey: ["watchdog-rails"],
    queryFn: async () => {
      const res = await fetch("/api/watchdog", { cache: "no-store" });
      if (!res.ok) throw new Error(`WATCHDOG PROBE HTTP ${res.status}`);
      return (await res.json()) as WatchdogResponse;
    },
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
  });
}

function useIntegrityQuery() {
  return useQuery<IntegrityResponse, Error>({
    queryKey: ["watchdog-integrity"],
    queryFn: async () => {
      const res = await fetch("/api/integrity", { cache: "no-store" });
      if (!res.ok) throw new Error(`INTEGRITY HTTP ${res.status}`);
      return (await res.json()) as IntegrityResponse;
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });
}

// R66 — the guardian's report every 15s: its own 20s pass clock means 15s
// polling keeps the gauge/journal within one pass of truth.
function useGuardianQuery() {
  return useQuery<GuardianResponse, Error>({
    queryKey: ["watchdog-guardian"],
    queryFn: async () => {
      const res = await fetch("/api/guardian", { cache: "no-store" });
      if (!res.ok) throw new Error(`GUARDIAN HTTP ${res.status}`);
      return (await res.json()) as GuardianResponse;
    },
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    staleTime: 7_000,
  });
}

// R75 — the fleet probe rides the integrity cadence (30s): sibling
// services are stable processes, not request-scoped rails; a minute-old
// fleet reading is still the truth, and the probe costs seven sockets.
function useFleetQuery() {
  return useQuery<FleetResponse, Error>({
    queryKey: ["watchdog-fleet"],
    queryFn: async () => {
      const res = await fetch("/api/fleet", { cache: "no-store" });
      if (!res.ok) throw new Error(`FLEET PROBE HTTP ${res.status}`);
      return (await res.json()) as FleetResponse;
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });
}

// R76 — traffic rides the integrity cadence: the leak hunt reads request
// volume against the plateau drift, and 30s is plenty for a counter that
// only moves when requests do.
function useTrafficQuery() {
  return useQuery<TrafficResponse, Error>({
    queryKey: ["watchdog-traffic"],
    queryFn: async () => {
      const res = await fetch("/api/traffic", { cache: "no-store" });
      if (!res.ok) throw new Error(`TRAFFIC HTTP ${res.status}`);
      return (await res.json()) as TrafficResponse;
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });
}

// R76 — the traffic counter's contract (see /api/traffic). R77 adds the
// per-route ledger: query-stripped `METHOD path` buckets counted at the
// http.Server layer, top 24 by volume, with the tracked/overflow honesty
// counters (the map is capped at 512 keys — overflow is counted, never hidden).
interface TrafficResponse {
  requestsSinceBoot: number | null;
  counterArmed: boolean;
  reqPerMin: number | null;
  routes: { key: string; count: number }[] | null;
  routesTracked: number | null;
  routeOverflow: number | null;
  uptimeSec: number;
  pid: number;
  sampledAtUtc: string;
  note: string;
}

function useGovernanceQuery() {
  // Same cadence as the rail probes — the DH queue is operator-actionable,
  // so 10s freshness beats the 30s integrity rhythm.
  return useQuery<GovernanceResponse, Error>({
    queryKey: ["watchdog-governance"],
    queryFn: async () => {
      const res = await fetch("/api/bridge/governance", { cache: "no-store" });
      if (!res.ok) throw new Error(`GOVERNANCE HTTP ${res.status}`);
      return (await res.json()) as GovernanceResponse;
    },
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
  });
}

// ── component ───────────────────────────────────────────────────────────────

export function WatchdogWorkspace() {
  const watchdog = useWatchdogQuery();
  const integrity = useIntegrityQuery();
  const governance = useGovernanceQuery();
  // R67 — same queryKey as ServerFootprintBlock's hook: react-query dedupes
  // to ONE fetch, but the header's estate report needs the guardian data.
  const guardian = useGuardianQuery();
  const [govVerify, setGovVerify] = useState<GovVerifyState>({ busy: false });
  const [reportCopied, setReportCopied] = useState(false);

  async function recheckNow() {
    void integrity.refetch();
    void governance.refetch();
    void guardian.refetch();
    const res = await watchdog.refetch();
    if (res.error) {
      toast.error("RECHECK FAILED", { description: res.error.message });
      return;
    }
    const data = res.data;
    if (data) {
      const up = data.rails.filter((r) => r.ok).length;
      toast(data.ok ? "RAILS RECHECKED" : "RAILS RECHECKED — SOME DOWN", {
        description: `${up}/${data.rails.length} rails up · ${data.rails.map((r) => `${r.id} ${r.ok ? "OK" : "DOWN"}`).join(" · ")}`,
      });
    }
  }

  const data = watchdog.data;
  const firstLoad = watchdog.isPending;
  const gov = governance.data;

  /** R67 — COPY ESTATE REPORT: one click puts the full operator hand-off on
      the clipboard. Built from the polls this console ALREADY holds — the
      report cannot claim a freshness the console does not have. */
  async function copyEstateReport() {
    const text = buildEstateReport({
      rails: data?.rails,
      checkedAt: data?.checkedAt,
      integrity: integrity.data,
      governance: gov,
      guardian: guardian.data,
    });
    try {
      await navigator.clipboard.writeText(text);
      setReportCopied(true);
      setTimeout(() => setReportCopied(false), 1600);
      const railCount = data?.rails.length ?? 0;
      toast("ESTATE REPORT ON THE CLIPBOARD", {
        description: `${railCount} rails · governance ${gov ? (gov.chainValid ? "VALID" : "BROKEN") : "—"} · guardian ${guardian.data?.stale ? "STALE" : guardian.data?.present ? "ARMED" : "OFF"} — paste-ready for the pilot conversation`,
      });
    } catch {
      toast.error("CLIPBOARD WRITE FAILED", {
        description: "the browser refused clipboard access — retry or copy manually",
      });
    }
  }

  /** VERIFY CHAIN for the governance ledger (?verify=1 — full recompute from
      genesis). Verdict shown INLINE; toasts mirror ReceiptsWorkspace. */
  async function verifyGovernance() {
    setGovVerify({ busy: true });
    try {
      const res = await fetch("/api/bridge/governance?verify=1", { cache: "no-store" });
      if (!res.ok) throw new Error(`verify HTTP ${res.status}`);
      const v = (await res.json()) as GovernanceVerifyResponse;
      if (v.valid) {
        setGovVerify({
          busy: false,
          valid: true,
          checked: v.checked,
          at: new Date().toISOString(),
        });
        toast("GOVERNANCE CHAIN VALID", {
          description: `checked ${v.checked} entries from genesis`,
        });
      } else {
        const reason = `chain broken at index ${v.firstBadIndex} (checked ${v.checked})`;
        setGovVerify({
          busy: false,
          valid: false,
          checked: v.checked,
          firstBadIndex: v.firstBadIndex,
          reason,
          at: new Date().toISOString(),
        });
        toast.error("GOVERNANCE CHAIN BROKEN", { description: reason });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setGovVerify({ busy: false, valid: false, reason: msg, at: new Date().toISOString() });
      toast.error("GOVERNANCE VERIFY FAILED", { description: msg });
    }
  }

  return (
    <div
      className="absolute inset-0 overflow-y-auto vvu-grid-bg"
      role="region"
      aria-label="Watchdog rail health monitor"
    >
      <div className="max-w-6xl mx-auto px-3 sm:px-6 pb-28 pt-6 space-y-5">
        {/* ── title block ── */}
        <section className="vvu-panel-solid p-4 sm:p-6" aria-labelledby="watchdog-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="vvu-label text-[10px] text-[#c8ff00] border border-[#c8ff00]/40 px-2 py-0.5">
                  TASK 41 · RAIL HEALTH
                </span>
                {!firstLoad && data && (
                  <span
                    className={`vvu-label text-[9px] px-2 py-0.5 rounded border ${
                      data.ok
                        ? "border-[#c8ff00]/50 text-[#c8ff00]"
                        : "border-[#e5484d]/60 text-[#e5484d]"
                    }`}
                  >
                    {data.ok ? "ALL RAILS UP" : "RAIL(S) DOWN"}
                  </span>
                )}
              </div>
              <h1
                id="watchdog-title"
                className="vvu-label text-xl sm:text-2xl font-bold text-[#f3e38a] tracking-[0.18em] mt-2"
              >
                WATCHDOG · RAIL HEALTH
              </h1>
              <p className="vvu-label text-[9px] sm:text-[10px] text-[#7a8a6e] mt-1 max-w-2xl leading-relaxed">
                HONEST STATUS — A RAIL THAT IS DOWN IS DISPLAYED DOWN
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void copyEstateReport()}
                  disabled={!data}
                  title="one click: the full operator status hand-off (rails · governance · :3000 surface · guardian) onto the clipboard"
                  className="min-h-[44px] vvu-label text-[10px] font-bold border-[#6b8a40]/50 text-[#c9d4bd] hover:bg-[#8fb35a]/10 hover:text-[#c8ff00] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00]"
                >
                  {reportCopied ? (
                    <Check className="size-3.5 text-[#c8ff00]" aria-hidden />
                  ) : (
                    <ClipboardList className="size-3.5" aria-hidden />
                  )}
                  {reportCopied ? "REPORT COPIED" : "COPY ESTATE REPORT"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={recheckNow}
                  disabled={watchdog.isFetching}
                  className="min-h-[44px] vvu-label text-[10px] font-bold border-[#6b8a40]/50 text-[#c9d4bd] hover:bg-[#8fb35a]/10 hover:text-[#c8ff00]"
                >
                  <RefreshCw
                    className={`size-3.5 ${watchdog.isFetching ? "animate-spin" : ""}`}
                    aria-hidden
                  />
                  RECHECK NOW
                </Button>
              </div>
              <p className="vvu-label text-[8px] text-[#7a8a6e] tabular-nums">
                {data
                  ? `LAST CHECKED ${stamp(data.checkedAt)}`
                  : firstLoad
                    ? "PROBING RAILS…"
                    : "—"}
              </p>
            </div>
          </div>
          {watchdog.isError && (
            <p className="vvu-label text-[9px] text-[#e5484d] mt-3 rounded-sm px-1.5 py-1 border border-[#e5484d]/40 bg-[#e5484d]/5 shadow-[0_0_6px_rgba(229,72,77,0.15)] transition-[box-shadow]">
              {/* R193 · THE HEARD ARRIVALS: the probe's failure speaks its
                  mount once — the reason when the error carries one. */}
              <span role="status" aria-live="polite" className="sr-only">
                {readFailureAria("the watchdog probe", watchdog.error.message)}
              </span>
              WATCHDOG PROBE ITSELF FAILED — {watchdog.error.message} (the :3000 surface may be
              degraded)
            </p>
          )}
        </section>

        {/* ── rail cards ── */}
        <section aria-labelledby="watchdog-rails-h">
          <div className="flex items-center gap-1.5 mb-3 px-0.5">
            <span className="inline-block size-1.5 bg-[#c8ff00]" aria-hidden />
            <h2
              id="watchdog-rails-h"
              className="vvu-label text-[8px] font-bold tracking-[0.22em] text-[#7a8a6e]"
            >
              RAILS · SERVER-SIDE PROBE · 2.5S TIMEOUT EACH
            </h2>
          </div>

          {firstLoad ? (
            // First-load skeletons — never fake data.
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="vvu-panel p-4 sm:p-5 space-y-3">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-8 w-28" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                  <Skeleton className="h-3 w-4/6" />
                </div>
              ))}
            </div>
          ) : watchdog.isError ? (
            <div
              className="vvu-panel-solid p-4 flex flex-wrap items-center justify-between gap-3"
              style={{ borderColor: "rgba(229,72,77,0.4)" }}
            >
              <span className="vvu-label text-[10px] text-[#e5484d]">
                RAIL PROBE UNAVAILABLE — DATA UNREACHABLE
              </span>
              <Button
                type="button"
                variant="outline"
                onClick={() => void watchdog.refetch()}
                className="min-h-[44px] vvu-label text-[10px] font-bold border-[#e5484d]/50 text-[#e5484d] hover:bg-[#e5484d]/10"
              >
                RETRY PROBE
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {data?.rails.map((rail) => (
                <article
                  key={rail.id}
                  className={`vvu-panel p-4 sm:p-5 flex flex-col gap-3 ${rail.ok ? "" : "!border-[#e5484d]/50"}`}
                  aria-label={`${rail.label} rail on port ${rail.port}, ${rail.ok ? "up" : "down"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="vvu-label text-[10px] font-bold text-[#f3e38a] tracking-[0.14em] truncate">
                        {rail.label}
                      </p>
                      <p className="vvu-label text-[8px] text-[#7a8a6e] mt-0.5">
                        {rail.port === 0
                          ? ":local · in-process walk"
                          : `:${rail.port} · ${rail.id}`}
                      </p>
                    </div>
                    <span
                      className={`vvu-label text-[10px] font-bold px-2.5 py-1.5 rounded-sm border shrink-0 ${
                        rail.ok
                          ? "border-[#c8ff00]/60 text-[#c8ff00] bg-[#c8ff00]/10"
                          : "border-[#e5484d]/60 text-[#e5484d] bg-[#e5484d]/10"
                      }`}
                    >
                      {rail.ok ? "OK" : "DOWN"}
                    </span>
                  </div>

                  <p className="font-mono text-[10px] text-[#c9d4bd] tabular-nums">
                    latency{" "}
                    <span className={rail.ok ? "text-[#c8ff00]" : "text-[#e5484d]"}>
                      {rail.latencyMs}ms
                    </span>
                    {typeof rail.httpStatus === "number" && (
                      <span className="text-[#7a8a6e]"> · HTTP {rail.httpStatus}</span>
                    )}
                  </p>

                  {rail.ok ? (
                    <ul className="font-mono text-[9px] text-[#d7e2c9] space-y-1 border-t border-[rgba(107,138,64,0.22)] pt-2.5">
                      {detailLines(rail).map((line) => (
                        <li key={line} className="truncate" title={line}>
                          {line}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="font-mono text-[9px] text-[#e5484d] border-t border-[rgba(229,72,77,0.3)] pt-2.5 break-all">
                      {rail.error ?? "unreachable"}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        {/* ── R75 · fleet health board — the estate's sibling services ── */}
        <FleetBoardBlock />

        {/* ── proximity sentinel (R62 — the integrity rail, estate-wide) ── */}
        <ProximitySentinelSection
          rail={data?.rails.find((r) => r.id === "proximity") ?? null}
          pending={firstLoad}
        />

        {/* ── governance control plane (Task 42) ── */}
        <section className="vvu-panel p-4 sm:p-6" aria-labelledby="watchdog-gov-h">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <span className="inline-block size-1.5 bg-[#2ea8a0]" aria-hidden />
              <h2
                id="watchdog-gov-h"
                className="vvu-label text-[8px] font-bold tracking-[0.22em] text-[#7a8a6e]"
              >
                GOVERNANCE · CONTROL PLANE · VAULT-BRIDGE :3004
              </h2>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void verifyGovernance()}
              disabled={govVerify.busy}
              className="min-h-[44px] vvu-label text-[10px] font-bold border-[#6b8a40]/50 text-[#c9d4bd] hover:bg-[#8fb35a]/10 hover:text-[#c8ff00]"
            >
              {govVerify.busy ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <ShieldCheck className="size-3.5" aria-hidden />
              )}
              VERIFY CHAIN
            </Button>
          </div>

          {governance.isPending ? (
            // First-load skeletons — never fake a ledger.
            <div className="mt-3 space-y-2.5">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-4/6" />
            </div>
          ) : governance.isError ? (
            // Honest DOWN path — the ledger is unreachable, so it is shown
            // unreachable. Never a fake green chip, never invented entries.
            <div
              className="mt-3 p-4 flex flex-wrap items-center justify-between gap-3 rounded-sm border bg-black/30"
              style={{ borderColor: "rgba(229,72,77,0.4)" }}
              role="alert"
            >
              <div className="min-w-0">
                <p className="vvu-label text-[10px] text-[#e5484d] font-bold">
                  GOVERNANCE LEDGER UNREACHABLE — NO DATA SHOWN
                </p>
                <p className="font-mono text-[9px] text-[#e5484d] break-all mt-1">
                  {governance.error.message}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => void governance.refetch()}
                className="min-h-[44px] vvu-label text-[10px] font-bold border-[#e5484d]/50 text-[#e5484d] hover:bg-[#e5484d]/10"
              >
                RETRY LEDGER
              </Button>
            </div>
          ) : gov ? (
            <div className="mt-3 space-y-3">
              {/* summary line — chain chip + ledger stats */}
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className={`vvu-label text-[10px] font-bold px-2.5 py-1.5 rounded-sm border inline-flex items-center gap-1.5 ${
                    gov.chainValid
                      ? "border-[#c8ff00]/60 text-[#c8ff00] bg-[#c8ff00]/10"
                      : "border-[#e5484d]/60 text-[#e5484d] bg-[#e5484d]/10"
                  }`}
                  title={`chain tip ${gov.head}`}
                >
                  {gov.chainValid ? (
                    <ShieldCheck className="size-3.5" aria-hidden />
                  ) : (
                    <ShieldAlert className="size-3.5" aria-hidden />
                  )}
                  {gov.chainValid
                    ? "CHAIN VALID"
                    : `CHAIN INVALID${govVerify.firstBadIndex !== undefined && govVerify.firstBadIndex >= 0 ? ` · @ ${govVerify.firstBadIndex}` : ""}`}
                </span>
                <LabelValue
                  label="ENTRIES"
                  value={String(gov.count)}
                  title={`genesis ${gov.genesis}`}
                />
                <LabelValue
                  label="MERKLE"
                  value={`${gov.merkleRoot.slice(0, 14)}…`}
                  mono
                  title={gov.merkleRoot}
                />
                <LabelValue
                  label="DH QUEUE"
                  value={String(gov.dhQueuePending)}
                  tone={gov.dhQueuePending > 0 ? "amber" : "dim"}
                />
                <LabelValue
                  label="REVOKED"
                  value={String(gov.revoked.length)}
                  tone={gov.revoked.length > 0 ? "red" : "dim"}
                />
                <LabelValue label="REGISTERED DEVS" value={String(gov.devs.length)} />
              </div>

              {!gov.chainValid && (
                <p className="vvu-label text-[9px] text-[#e5484d] font-bold">
                  LEDGER REPORTS CHAIN INVALID — RUN VERIFY CHAIN TO LOCATE THE BREAK
                </p>
              )}

              {/* rules wired n/6 — six chips, lime only when the ledger wired them */}
              <div>
                <p className="vvu-label text-[8px] text-[#7a8a6e] mb-1.5">
                  RULES WIRED{" "}
                  {GOV_RULES.filter((r) => gov.rules.some((w) => w.ruleId === r.id)).length}/6
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {GOV_RULES.map((r) => {
                    const wired = gov.rules.find((w) => w.ruleId === r.id);
                    return (
                      <span
                        key={r.id}
                        title={
                          wired
                            ? `${r.label} — wired ${stamp(wired.wiredAt)} by ${wired.actorDevId} (entry #${wired.entrySeq})`
                            : `${r.label} — not wired`
                        }
                        className={`vvu-label text-[8px] font-bold px-1.5 py-1 rounded-sm border transition-colors ${
                          wired
                            ? "border-[#c8ff00]/50 text-[#c8ff00] bg-[#c8ff00]/10"
                            : "border-[rgba(107,138,64,0.3)] text-[#7a8a6e]"
                        }`}
                      >
                        {r.label}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* registered devs — revoked ones in red, struck through */}
              <div>
                <p className="vvu-label text-[8px] text-[#7a8a6e] mb-1.5">
                  REGISTERED DEVICES
                  {gov.revoked.length > 0 ? ` · ${gov.revoked.length} REVOKED` : ""}
                </p>
                {gov.devs.length === 0 ? (
                  <p className="font-mono text-[9px] text-[#7a8a6e]">
                    no devices registered — ledger is at genesis
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {gov.devs.map((d) => (
                      <span
                        key={d.devId}
                        title={`${d.devId} · ${d.label} · scope ${d.scope} · registered ${stamp(d.registeredAt)}${
                          d.expiresAt ? ` · expires ${stamp(d.expiresAt)}` : " · no expiry"
                        }${d.revoked ? " · REVOKED" : ""}`}
                        className={`vvu-label text-[8px] px-1.5 py-1 rounded-sm border ${
                          d.revoked
                            ? "border-[#e5484d]/50 text-[#e5484d] line-through"
                            : "border-[rgba(107,138,64,0.35)] text-[#c9d4bd]"
                        }`}
                      >
                        {d.label || d.devId.slice(0, 12)} · {d.scope}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* DH queue — the honest operator-action note */}
              {gov.dhQueuePending > 0 && (
                <div className="space-y-1.5">
                  <p className="vvu-label text-[9px] text-[#e0a030] border border-[#e0a030]/40 px-2.5 py-1.5 rounded-sm inline-block">
                    DH QUEUE {gov.dhQueuePending} — AWAITING OPERATOR ADMIN DEVID (MINT VIA QR
                    ACTION)
                  </p>
                  {gov.dhQueue.slice(0, 3).map((q) => (
                    <p
                      key={q.id}
                      className="font-mono text-[9px] text-[#e0a030] truncate"
                      title={`${q.id} · ${q.ruleId} · ${q.at} · ${q.status}`}
                    >
                      {q.devId} · {q.reason}
                    </p>
                  ))}
                  {gov.dhQueue.length > 3 && (
                    <p className="font-mono text-[9px] text-[#7a8a6e]">
                      +{gov.dhQueue.length - 3} more queued…
                    </p>
                  )}
                </div>
              )}

              {/* inline verify verdict */}
              {govVerify.valid === true && (
                <p role="status" className="vvu-label text-[9px] text-[#c8ff00]">
                  GOVERNANCE CHAIN VALID · CHECKED {govVerify.checked} FROM GENESIS
                  <span className="text-[#7a8a6e] tabular-nums ml-2">
                    {govVerify.at ? stamp(govVerify.at) : ""}
                  </span>
                </p>
              )}
              {govVerify.valid === false && (
                <p role="alert" className="vvu-label text-[9px] text-[#e5484d]">
                  GOVERNANCE CHAIN VERIFICATION FAILED —{" "}
                  <span className="font-mono normal-case break-all">{govVerify.reason}</span>
                </p>
              )}

              {/* the honest label line */}
              <p className="vvu-label text-[8px] text-[#7a8a6e] leading-relaxed max-w-3xl">
                LOCAL WORM LEDGER — NOT EXTERNALLY ANCHORED (ANCHOR TARGET REMAINS STUB)
              </p>
            </div>
          ) : null}
        </section>

        {/* ── self-integrity ── */}
        <section className="vvu-panel p-4 sm:p-6" aria-labelledby="watchdog-int-h">
          <div className="flex items-center gap-1.5 mb-3 px-0.5">
            <span className="inline-block size-1.5 bg-[#f3e38a]" aria-hidden />
            <h2
              id="watchdog-int-h"
              className="vvu-label text-[8px] font-bold tracking-[0.22em] text-[#7a8a6e]"
            >
              SELF-INTEGRITY · THE :3000 SURFACE FINGERPRINTS ITSELF
            </h2>
          </div>

          {integrity.isPending ? (
            <div className="space-y-2.5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-72" />
              <Skeleton className="h-3 w-56" />
            </div>
          ) : integrity.isError ? (
            <p className="vvu-label text-[9px] text-[#e5484d]">
              INTEGRITY FEED ERROR — {integrity.error.message}
            </p>
          ) : (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className={`vvu-label text-[10px] font-bold px-2.5 py-1.5 rounded-sm border inline-flex items-center gap-1.5 ${
                    integrity.data?.match
                      ? "border-[#c8ff00]/60 text-[#c8ff00] bg-[#c8ff00]/10"
                      : "border-[#e5484d]/60 text-[#e5484d] bg-[#e5484d]/10"
                  }`}
                >
                  {integrity.data?.match ? (
                    <ShieldCheck className="size-3.5" aria-hidden />
                  ) : (
                    <ShieldAlert className="size-3.5" aria-hidden />
                  )}
                  {integrity.data?.match ? "MODULE MATCH" : "MODULE MISMATCH"}
                </span>
                <LabelValue
                  label="COMPILED"
                  value={integrity.data?.compiledAt ? stamp(integrity.data.compiledAt) : "—"}
                />
                <LabelValue
                  label="UPTIME"
                  value={integrity.data ? uptimeLabel(integrity.data.uptimeSec) : "—"}
                />
                <LabelValue
                  label="WATCHED FILES"
                  value={String(integrity.data?.watchedFiles?.length ?? "—")}
                />
              </div>
              {integrity.data && !integrity.data.match && (
                <p className="vvu-label text-[9px] text-[#e5484d] font-bold">
                  STALE MODULE DETECTED — RUNNING CODE DIFFERS FROM DISK
                </p>
              )}
              <p className="vvu-label text-[8px] text-[#7a8a6e] leading-relaxed max-w-3xl">
                runningHash (compile-time) vs diskHash (request-time) over the app shell files —
                fail-closed: a mismatch means the serving surface is stale, and it is displayed as
                exactly that.
              </p>
            </div>
          )}

          {/* ── R63 · PWA shell cache — the browser-side half of integrity ── */}
          <PwaCacheBlock />

          {/* ── R66 · server footprint — memory as a monitored rail ── */}
          <ServerFootprintBlock />

          {/* ── R77 · traffic mix — the leak hunt's per-route ledger ── */}
          <TrafficMixBlock />

          {/* ── R78 · leak verdict — climb × traffic, the attribution read ── */}
          <LeakVerdictBlock />
        </section>

        {/* ── R70 · estate chronicle — the unified evidence timeline ── */}
        <EstateChronicleBlock />

        {/* ── read-only note ── */}
        <p className="vvu-label text-[8px] text-[#7a8a6e] flex flex-wrap items-center gap-1.5 px-0.5">
          <Activity className="size-3" aria-hidden />
          THE WATCHDOG WATCHES READ-ONLY — ITS TWO ACTIONS (DRILL · FLEET RESTART) ARE EXPLICIT,
          GUARDED AND JOURNALED
          <HeartPulse className="size-3" aria-hidden />
          NO WORM WRITES · NO RAIL MUTATIONS · POLL 10S / INTEGRITY 30S / GOVERNANCE 10S / GUARDIAN
          15S / FLEET 30S
        </p>
      </div>
    </div>
  );
}

// ── R77 · TRAFFIC MIX — the per-route ledger's READ side ────────────────────

// The console's own known timer pollers — the SELF-POLL chip sums exactly
// this set and nothing else. Attribution beyond it is the READER'S job: the
// endpoint reports raw buckets and this surface only does the one sum it can
// defend (the watchman is part of the traffic it watches).
// R80 — the set now lives in src/lib/verdict-tiers.ts (imported above) so the
// verdict ledger's server-side rows subtract the SAME members: one definition,
// zero drift between the page's sums and a recorded row's claims.

function methodChip(method: string): string {
  switch (method) {
    case "GET":
      return "border-[#c8ff00]/50 text-[#c8ff00] bg-[#c8ff00]/10";
    case "POST":
      return "border-[#00d4e0]/50 text-[#00d4e0] bg-[#00d4e0]/10";
    case "HEAD":
      return "border-[#7a8a6e]/50 text-[#7a8a6e] bg-[#7a8a6e]/10";
    case "DELETE":
      return "border-[#e5484d]/50 text-[#e5484d] bg-[#e5484d]/10";
    default:
      return "border-[#e0a030]/50 text-[#e0a030] bg-[#e0a030]/10";
  }
}

function TrafficMixBlock() {
  const traffic = useTrafficQuery();
  const [copied, setCopied] = useState(false);

  const t = traffic.data ?? null;
  const routes = t?.routes ?? [];
  const total = t?.requestsSinceBoot ?? 0;
  const max = routes[0]?.count ?? 1;
  const selfPoll = routes
    .filter((r) => CONSOLE_POLL_ROUTES.has(r.key))
    .reduce((s, r) => s + r.count, 0);
  const selfPollPct = total > 0 && t?.counterArmed ? Math.round((selfPoll / total) * 100) : null;

  async function copyMix() {
    if (!t?.routes) return;
    const lines = [
      `VVU TRAFFIC MIX — ${t.sampledAtUtc}`,
      `requests since boot ${t.requestsSinceBoot ?? 0} · uptime ${uptimeLabel(t.uptimeSec)} · ${t.reqPerMin ?? "—"} req/min · routes tracked ${t.routesTracked ?? 0} (overflow ${t.routeOverflow ?? 0})`,
      "METHOD\tPATH\tCOUNT\tSHARE",
      ...t.routes.map(
        (r) => `${r.key}\t${r.count}\t${total > 0 ? ((r.count / total) * 100).toFixed(1) : "0.0"}%`,
      ),
      `note: ${t.note}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      toast.success("TRAFFIC MIX ON THE CLIPBOARD", {
        description: `top ${t.routes.length} of ${t.routesTracked ?? "?"} tracked routes — paste-ready for the leak-hunt log`,
      });
    } catch {
      toast.error("CLIPBOARD WRITE FAILED", {
        description: "the browser refused clipboard access — copy the rows by hand",
      });
    }
  }

  return (
    <div className="mt-4 rounded-sm border border-[#c8ff00]/25 bg-[#c8ff00]/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <p className="vvu-label text-[8px] font-bold tracking-[0.22em] text-[#c8ff00]/80">
          TRAFFIC MIX · WHO ASKS, SINCE BOOT
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {t?.counterArmed && (
            <span
              className="vvu-label text-[8px] font-bold px-1.5 py-0.5 rounded-sm border border-[#c8ff00]/40 text-[#c8ff00] bg-black/30 tabular-nums"
              title={`request rate since boot — ${t.requestsSinceBoot ?? 0} requests over ${uptimeLabel(t.uptimeSec)}; includes the console's own polling`}
            >
              {t.reqPerMin ?? "—"} REQ/MIN
            </span>
          )}
          {t?.routesTracked != null && (
            <span
              className="vvu-label text-[8px] font-bold px-1.5 py-0.5 rounded-sm border border-[#6b8a40]/40 text-[#7a8a6e] bg-black/30 tabular-nums"
              title="distinct METHOD-path buckets held since boot (cap 512) — the top 24 by volume are shown"
            >
              {t.routesTracked} ROUTES
            </span>
          )}
          {selfPollPct != null && t?.routes != null && (
            <span
              className={`vvu-label text-[8px] font-bold px-1.5 py-0.5 rounded-sm border tabular-nums ${
                selfPollPct >= 75
                  ? "border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10"
                  : "border-[#6b8a40]/40 text-[#7a8a6e] bg-black/30"
              }`}
              title={`share of requests from the console's own timer pollers (watchdog 10s · governance 10s · guardian 15s · integrity 30s · fleet 30s · plateau-history · chronicle · traffic) — amber means the baseline is mostly the console itself, so request-driven attribution must subtract it first`}
            >
              SELF-POLL {selfPollPct}%
            </span>
          )}
          {(t?.routeOverflow ?? 0) > 0 && (
            <span
              className="vvu-label text-[8px] font-bold px-1.5 py-0.5 rounded-sm border border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10 tabular-nums"
              title="requests whose route key did not fit the 512-key cap — counted, never hidden; the map must never become the leak it is hunting"
            >
              OVERFLOW {t?.routeOverflow}
            </span>
          )}
          {t?.routes && t.routes.length > 0 && (
            <button
              type="button"
              onClick={() => void copyMix()}
              aria-live="polite"
              aria-label={copyMixAria(copied)}
              className={`vvu-label inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-[9px] font-bold cursor-pointer transition-[filter,border-color,color] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00] ${
                copied
                  ? "border-[#c8ff00]/70 bg-[#c8ff00]/10 text-[#c8ff00] shadow-[0_0_6px_rgba(200,255,0,0.2)]"
                  : "border-[#c8ff00]/50 bg-black/40 text-[#c8ff00] hover:bg-[#c8ff00]/15"
              }`}
              title="copy the traffic mix as TSV — routes, counts, shares — for the leak-hunt log. R187 · THE COPIED HANDS: the offer and its arrival ride the aria — the clipboard's honesty spoken, heard without hovering."
            >
              {copied ? (
                <Check className="size-3" aria-hidden />
              ) : (
                <Copy className="size-3" aria-hidden />
              )}
              {copied ? "COPIED" : "COPY MIX"}
            </button>
          )}
        </div>
      </div>

      {!t ? (
        <div className="mt-2.5 space-y-1.5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      ) : !t.counterArmed ? (
        <p className="vvu-label text-[9px] text-[#e0a030] mt-2.5">
          COUNTER NOT ARMED — this node process booted before the traffic hook existed; the next
          boot arms it.
        </p>
      ) : t.routes == null ? (
        <p className="vvu-label text-[9px] text-[#e0a030] mt-2.5">
          PER-ROUTE LEDGER ARMS AT THE NEXT BOOT — this process predates R77&apos;s instrumentation;
          the total (REQS above) is already live, the buckets join it on the next restart.
        </p>
      ) : routes.length === 0 ? (
        <p className="vvu-label text-[9px] text-[#7a8a6e] mt-2.5">
          LEDGER ARMED · ZERO REQUESTS COUNTED SO FAR — the buckets fill as traffic arrives.
        </p>
      ) : (
        <ol className="mt-2.5 space-y-px">
          {routes.map((r, i) => {
            const spaceAt = r.key.indexOf(" ");
            const method = spaceAt === -1 ? r.key : r.key.slice(0, spaceAt);
            const path = spaceAt === -1 ? "" : r.key.slice(spaceAt + 1);
            const share = total > 0 ? (r.count / total) * 100 : 0;
            const w = Math.max(1, Math.min(100, (r.count / max) * 100));
            return (
              <li
                key={r.key}
                className="relative flex items-center gap-2 rounded-sm px-1.5 py-[3px] hover:bg-black/40 transition-colors"
                title={`${r.key} — ${r.count} requests since boot (${share.toFixed(1)}% of the total)`}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-sm bg-[#c8ff00]/10 border-r border-[#c8ff00]/40"
                  style={{ width: `${w}%` }}
                  aria-hidden
                />
                <span
                  className="relative w-4 shrink-0 text-right vvu-label text-[8px] text-[#7a8a6e] tabular-nums"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <span
                  className={`relative shrink-0 vvu-label text-[8px] font-bold px-1.5 py-0.5 rounded-sm border ${methodChip(method)}`}
                >
                  {method}
                </span>
                <span className="relative flex-1 min-w-0 truncate font-mono text-[10px] text-[#c9d4bd]">
                  {path}
                </span>
                <span className="relative shrink-0 w-14 text-right font-mono text-[9px] text-[#c8ff00] tabular-nums">
                  {r?.count != null ? r.count.toLocaleString() : "—"}
                </span>
                <span className="relative shrink-0 w-11 text-right vvu-label text-[8px] text-[#7a8a6e] tabular-nums">
                  {share.toFixed(1)}%
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <p
        className="vvu-label text-[8px] text-[#7a8a6e] leading-relaxed mt-2"
        title="the leak hunt's data phase: read these buckets against the plateau scope's climb at the same boot boundary"
      >
        R77 PER-ROUTE LEDGER · COUNTED AT THE http.Server LAYER — QUERY-STRIPPED BUCKETS, CAPPED AT
        512 KEYS (OVERFLOW COUNTED, NEVER HIDDEN). INCLUDES THIS DASHBOARD&apos;S OWN POLLING — THE
        WATCHMAN IS PART OF THE TRAFFIC IT WATCHES. HTTP ONLY: WEBSOCKET UPGRADES FIRE A DIFFERENT
        EVENT AND ARE NOT COUNTED. RESETS AT EVERY BOOT — THE BOOT BOUNDARY IS THE PLATEAU
        SCOPE&apos;S UNIT OF ANALYSIS.
      </p>
    </div>
  );
}

// ── R78 · LEAK VERDICT — climb × traffic, the attribution read ──────────────

// R77's data phase armed the per-route ledger; this is the reading it was
// arming FOR. Two boot-scoped numbers meet here — the plateau scope's
// CLIMB THIS BOOT (cut at the journal's own boot boundary) and the traffic
// counter's REQUESTS SINCE BOOT (resets at the same boundary by design) —
// and their ratio answers, with data instead of guesses, the question R70
// left open: is the climb request-driven, or is it compile/HMR churn?
//
// The verdict's known-self set: every route this estate itself generates,
// member by member. The console's eight timer pollers (the R77 SELF-POLL
// set) PLUS the mesh's own HTTP self-probes that arrive from the
// mini-service processes: the safegrid service reads the estate's health
// on an interval (mini-services/safegrid vvu-health) and the telemetry
// service posts its queue. The verdict subtracts ALL of them before it
// lets any request carry attribution.
// R80 — moved to src/lib/verdict-tiers.ts (imported above): the ledger's
// server-side rows share this exact set.

interface LeakVerdict {
  kind:
    | "no-plateau"
    | "no-climb"
    | "flat"
    | "no-counter"
    | "too-few"
    | "not-tracked"
    | "mixed"
    | "tracked";
  tone: "dim" | "lime" | "cyan" | "amber" | "rose";
  headline: string;
  detail: string;
  windowOnly: boolean;
}

/** The attribution read. Every tier is a JUDGMENT CALL, documented in the
 *  UI's tooltips — the raw numbers ride beside the headline so the reader
 *  can re-derive the verdict and disagree with it. R80: the TIER decision
 *  now comes from the shared engine (src/lib/verdict-tiers) — the SAME
 *  classifyVerdict the server's ledger rows use, so a recorded reading and
 *  the live page can never disagree about the rules. This function keeps
 *  only the display words for each tier. */
function computeLeakVerdict(
  p: PlateauHistoryResponse | null,
  t: TrafficResponse | null,
): LeakVerdict {
  const windowOnly = p?.stats?.bootComplete !== true;
  const c = classifyVerdict({
    plateauPresent: p?.present === true,
    climbMb: p?.stats?.climbMb ?? null,
    counterArmed: t?.counterArmed === true,
    requests: t?.requestsSinceBoot ?? null,
  });
  const climbMb = p?.stats?.climbMb ?? null;
  const requests = t?.requestsSinceBoot ?? 0;
  const climbLabel = climbMb != null ? `${climbMb > 0 ? "+" : ""}${climbMb} MB` : "n/a";
  const reqLabel = (requests ?? 0).toLocaleString();
  switch (c.kind) {
    case "no-plateau":
      return {
        kind: c.kind,
        tone: c.tone,
        windowOnly,
        headline: "NO VERDICT — THE SCOPE HAS NO READING",
        detail:
          "the attribution read joins the guardian pass log to the request counter; neither side may be invented",
      };
    case "no-climb":
      return {
        kind: c.kind,
        tone: c.tone,
        windowOnly,
        headline: "NO VERDICT — FEWER THAN TWO PASSES THIS BOOT",
        detail:
          "a climb needs two healthy passes at the same boot boundary; the scope fills one point per 20s guardian pass",
      };
    case "no-counter":
      return {
        kind: c.kind,
        tone: c.tone,
        windowOnly,
        headline: "NO VERDICT — TRAFFIC COUNTER NOT ARMED",
        detail: `the pass log reads a ${climbLabel} climb, but this node process predates the traffic hook — the next boot arms the counter`,
      };
    case "flat":
      return {
        kind: c.kind,
        tone: c.tone,
        windowOnly,
        headline: "FLAT THIS BOOT — NOTHING TO ATTRIBUTE",
        detail: `climb ${climbLabel} over ${reqLabel} requests — within the pass log's own noise. If boots stay flat, the hunt is over`,
      };
    case "too-few":
      return {
        kind: c.kind,
        tone: c.tone,
        windowOnly,
        headline: "TOO FEW REQUESTS TO ATTRIBUTE",
        detail: `climb ${climbLabel} against only ${requests} requests — the ratio would be noise; the verdict waits for a baseline`,
      };
    case "tracked":
      return {
        kind: c.kind,
        tone: c.tone,
        windowOnly,
        headline: "REQUEST-TRACKED — PROFILE THE TOP NON-SELF ROUTE",
        detail: `${(c.mbPer1k ?? 0).toFixed(1)} MB per 1k requests (${climbLabel} / ${reqLabel} req) — request-proportional growth is plausible; subtract the known-self share, then profile WHO`,
      };
    case "mixed":
      return {
        kind: c.kind,
        tone: c.tone,
        windowOnly,
        headline: "MIXED — CLIMB AND TRAFFIC PARTLY ALIGN",
        detail: `${(c.mbPer1k ?? 0).toFixed(1)} MB per 1k requests (${climbLabel} / ${reqLabel} req) — some request correlation is possible; read the top buckets before concluding`,
      };
    case "not-tracked":
      return {
        kind: c.kind,
        tone: c.tone,
        windowOnly,
        headline: "NOT REQUEST-TRACKED — COMPILE/HMR IS THE SUSPECT",
        detail: `${(c.mbPer1k ?? 0).toFixed(1)} MB per 1k requests (${climbLabel} / ${reqLabel} req) — this boot's requests cannot explain the climb; compile/HMR churn (the gate sweeps are the known churn source) is where the leak lives`,
      };
  }
}

function verdictToneClasses(tone: LeakVerdict["tone"]): string {
  switch (tone) {
    case "lime":
      return "border-[#c8ff00]/60 text-[#c8ff00] bg-[#c8ff00]/10";
    case "cyan":
      return "border-[#00d4e0]/60 text-[#00d4e0] bg-[#00d4e0]/10";
    case "amber":
      return "border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10";
    case "rose":
      return "border-[#e5484d]/60 text-[#e5484d] bg-[#e5484d]/10";
    default:
      return "border-[#6b8a40]/40 text-[#7a8a6e] bg-black/30";
  }
}

// ── R80 · THE VERDICT READINGS LEDGER — the trend across boots ─────────────

interface VerdictReadingRow {
  at: string;
  atMs: number;
  bootPid: number;
  /** R86 — the dev tree root (bounces.jsonl namespace); null on pre-R86 rows. */
  devTreePid?: number | null;
  uptimeSec: number;
  bootStartUtc: string | null;
  windowOnly: boolean;
  climbMb: number;
  requests: number;
  reqPerMin: number | null;
  mbPer1k: number | null;
  kind: VerdictKind;
  tone: "dim" | "lime" | "cyan" | "amber" | "rose";
  /** R99 — who pulled the trigger: the operator's button or the guardian's
   *  post-bounce auto-pair. ABSENT on pre-R99 rows (append-only; the UI
   *  renders the absence as the operator's hand — the only trigger that
   *  existed before R99). */
  via?: "operator" | "auto-guardian";
  knownSelfPct: number | null;
  residualReq: number | null;
  profileNextKey: string | null;
  profileNextCount: number | null;
  routesTracked: number | null;
}

interface VerdictLedgerResponse {
  ok: boolean;
  ledger: {
    present: boolean;
    rows: VerdictReadingRow[]; // newest first
    total: number;
    corrupt: number;
    cooldownMs: number;
  };
}

function useVerdictLedgerQuery() {
  return useQuery<VerdictLedgerResponse, Error>({
    queryKey: ["guardian-verdict-ledger"],
    queryFn: async () => {
      const res = await fetch("/api/guardian/verdict-ledger", { cache: "no-store" });
      if (!res.ok) throw new Error(`VERDICT LEDGER HTTP ${res.status}`);
      return (await res.json()) as VerdictLedgerResponse;
    },
    refetchInterval: 90_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
}

/** R84 — THE CURVE: the ledger's ratio trend as an inline SVG sparkline.
 *  One point per RATIO reading (FLAT rows never reach a ratio — they leave an
 *  honest GAP in the x-sequence, never an invented point), segments drawn only
 *  between consecutive readings of the SAME boot (a boot boundary is a break,
 *  not a line), vertical hairlines at boot changes, and the 16–32 MB/1k
 *  steady-state band the mature boots settled into (17201: 32.03, 21982: 16.36)
 *  shaded as the calibration target the hunt reads every curve against. The
 *  y-axis starts at ZERO — a truncated axis would exaggerate the very slopes
 *  this hunt is trying to judge honestly. */
const CURVE_TONE_HEX: Record<string, string> = {
  lime: "#c8ff00",
  cyan: "#00d4e0",
  amber: "#e0a030",
  rose: "#e5484d",
};
const CURVE_DIM_HEX = "#7a8a6e";
// R85 — the viewBox is a FIXED design width (1008): the on-page render sits
// near 1:1 at desktop width, points stay bead-sized instead of inflating into
// balloons, and the band labels stay label-sized. Row count no longer changes
// the width — time density does (see CURVE_W above).
const CURVE_H = 260;
const CURVE_PAD = 24;
const CURVE_PT_R = 7;
// R86 — the band moved to the SHARED tier engine (src/lib/verdict-tiers) so
// the chronicle's calibration block can read the same edges; these aliases
// keep the curve/strip references below verbatim. ONE definition, three
// readers — the edges can never drift between the strip and the chronicle.
const CURVE_BAND_LO = SETTLE_BAND_LO;
const CURVE_BAND_HI = SETTLE_BAND_HI;
// R85 — the curve's x-axis is WALL-CLOCK: a bead's x is proportional to the
// real elapsed time between readings, so a settle that folded in 7 minutes
// reads steep and a 30-minute boot gap reads as the empty stretch it was.
// W is a fixed design width (density grows honestly with row count); beads
// closer than CURVE_MIN_GAP units are nudged apart so they stay clickable.
const CURVE_W = 1008;
const CURVE_MIN_GAP = 18;

/** Pick a tick interval that yields ~3–5 labels for the span (minutes). */
function curveTickMinutes(spanMs: number): number {
  const spanMin = spanMs / 60000;
  for (const cand of [5, 10, 15, 30, 60, 120, 240, 480]) {
    if (spanMin / cand <= 5) return cand;
  }
  return 960;
}

function VerdictTrendCurve({ rows }: { rows: VerdictReadingRow[] }) {
  const n = rows.length;
  const ratioIdx: number[] = [];
  for (let i = 0; i < n; i++) if (rows[i].mbPer1k != null) ratioIdx.push(i);

  if (n < 2 || ratioIdx.length < 2) {
    return (
      <p
        className="vvu-label text-[7.5px] text-[#5f6e55] leading-relaxed mt-1.5"
        data-testid="verdict-curve-empty"
      >
        THE CURVE NEEDS ≥2 RATIO READINGS — {ratioIdx.length} SO FAR. FLAT ROWS NEVER REACH A RATIO,
        SO THEY LEAVE HONEST GAPS RATHER THAN INVENTED POINTS.
      </p>
    );
  }

  const t0 = rows[0].atMs;
  const t1 = rows[n - 1].atMs;
  const span = Math.max(1, t1 - t0);
  const yMax = Math.max(...ratioIdx.map((i) => rows[i].mbPer1k as number)) * 1.08;
  // Time-proportional x, then a minimum-gap pass (left → right): order and
  // near-proportionality preserved, sub-bead spacing made readable.
  const xs: number[] = rows.map(
    (r) => CURVE_PAD + ((r.atMs - t0) / span) * (CURVE_W - CURVE_PAD * 2),
  );
  for (let i = 1; i < xs.length; i++) {
    if (xs[i] - xs[i - 1] < CURVE_MIN_GAP) xs[i] = xs[i - 1] + CURVE_MIN_GAP;
  }
  const cy = (v: number) => CURVE_H - CURVE_PAD - (v / yMax) * (CURVE_H - CURVE_PAD * 2);

  // Segments: consecutive readings, both with ratios, SAME boot — a boot
  // boundary is a structural break, not a connectable slope.
  const segments: string[] = [];
  for (let i = 1; i < n; i++) {
    const a = rows[i - 1];
    const b = rows[i];
    if (a.mbPer1k != null && b.mbPer1k != null && a.bootPid === b.bootPid) {
      segments.push(`M ${xs[i - 1]} ${cy(a.mbPer1k)} L ${xs[i]} ${cy(b.mbPer1k)}`);
    }
  }
  // Boot dividers: one hairline per pid change, drawn in the gap midpoint.
  const dividers: number[] = [];
  for (let i = 1; i < n; i++) {
    if (rows[i].bootPid !== rows[i - 1].bootPid) dividers.push((xs[i - 1] + xs[i]) / 2);
  }
  // Time ticks (R85): the x-axis is wall-clock, so tick labels are real
  // HH:MM marks — cadence becomes readable, not just sequence.
  const tickMin = curveTickMinutes(span);
  const ticks: { x: number; label: string }[] = [];
  {
    const start = new Date(t0);
    const first = new Date(start);
    first.setSeconds(0, 0);
    first.setMinutes(Math.ceil(start.getMinutes() / tickMin) * tickMin);
    for (let t = first.getTime(); t <= t1; t += tickMin * 60000) {
      const x = CURVE_PAD + ((t - t0) / span) * (CURVE_W - CURVE_PAD * 2);
      const d = new Date(t);
      ticks.push({
        x,
        label: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
      });
    }
  }
  // The band renders only when the data range actually reaches down to it —
  // an off-scale band would be a rectangle lying about where the data sits.
  const bandVisible = yMax >= CURVE_BAND_LO;
  const bandTop = bandVisible ? Math.max(3, cy(CURVE_BAND_HI)) : 0;
  const bandBottom = bandVisible ? Math.min(CURVE_H - 3, cy(CURVE_BAND_LO)) : 0;

  return (
    <div className="mt-1.5" data-testid="verdict-curve">
      <p
        className="vvu-label text-[7.5px] font-bold tracking-[0.22em] text-[#00d4e0]/60"
        title={`the ratio of every reading that has one, oldest → newest, on a WALL-CLOCK x-axis — bead spacing is real elapsed time (a steep fold is a fast settle; a wide empty stretch is a real gap between boots), segments connect only within a boot, dashed verticals are boot boundaries, HH:MM ticks are wall-clock marks; the shaded band is the 16–32 MB/1k steady-state the mature boots settled into${bandVisible ? "" : " (off-scale for this data range)"}; readings closer than one bead diameter are nudged apart to stay readable`}
      >
        THE CURVE · RATIO OVER WALL-CLOCK TIME
      </p>
      <svg
        viewBox={`0 0 ${CURVE_W} ${CURVE_H}`}
        className="mt-0.5 h-auto w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`verdict ratio curve on a wall-clock time axis, ${ratioIdx.length} ratio readings across ${new Set(rows.map((r) => r.bootPid)).size} boots`}
      >
        {bandVisible && (
          <>
            <rect
              x={CURVE_PAD}
              y={bandTop}
              width={CURVE_W - CURVE_PAD * 2}
              height={Math.max(2, bandBottom - bandTop)}
              fill="#00d4e0"
              opacity="0.07"
            />
            <line
              x1={CURVE_PAD}
              y1={bandTop}
              x2={CURVE_W - CURVE_PAD}
              y2={bandTop}
              stroke="#00d4e0"
              strokeOpacity="0.45"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              strokeDasharray="3 3"
            />
            <line
              x1={CURVE_PAD}
              y1={bandBottom}
              x2={CURVE_W - CURVE_PAD}
              y2={bandBottom}
              stroke="#00d4e0"
              strokeOpacity="0.45"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              strokeDasharray="3 3"
            />
            <text
              x={CURVE_W - 1}
              y={bandTop + 13}
              textAnchor="end"
              fontSize="12"
              fill="#5f6e55"
              fontFamily="monospace"
            >
              {CURVE_BAND_HI}
            </text>
            <text
              x={CURVE_W - 1}
              y={bandBottom - 4}
              textAnchor="end"
              fontSize="12"
              fill="#5f6e55"
              fontFamily="monospace"
            >
              {CURVE_BAND_LO}
            </text>
          </>
        )}
        {ticks.map((tk, k) => (
          <g key={`tick-${k}`}>
            <line
              x1={tk.x}
              y1={CURVE_H - CURVE_PAD}
              x2={tk.x}
              y2={CURVE_H - CURVE_PAD + 5}
              stroke="#3a4530"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={tk.x}
              y={CURVE_H - CURVE_PAD + 16}
              textAnchor="middle"
              fontSize="10"
              fill="#5f6e55"
              fontFamily="monospace"
            >
              {tk.label}
            </text>
          </g>
        ))}
        {dividers.map((dx, k) => (
          <line
            key={`div-${k}`}
            x1={dx}
            y1={4}
            x2={dx}
            y2={CURVE_H - 4}
            stroke="#3a4530"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            strokeDasharray="2 3"
          />
        ))}
        {segments.map((d, k) => (
          <path
            key={`seg-${k}`}
            d={d}
            fill="none"
            stroke="#00d4e0"
            strokeOpacity="0.55"
            strokeWidth="1.25"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {ratioIdx.map((i) => {
          const r = rows[i];
          const ratio = r.mbPer1k as number;
          const hex = CURVE_TONE_HEX[r.tone] ?? CURVE_DIM_HEX;
          // R85 — the HALO is the interactive unit: 13px hit target, carries
          // the native <title>, catches every hover. The bead itself is
          // pointer-events:none — it never fights the halo for the cursor,
          // and the group:hover CSS does the breathing.
          return (
            <g key={`pt-${r.atMs}-${i}`} className="vvu-curve-pt">
              <circle cx={xs[i]} cy={cy(ratio)} r={CURVE_PT_R + 6} fill="transparent">
                <title>{`${ratio.toFixed(2)} MB/1k · ${r.at} · boot ${r.bootPid} · climb ${r.climbMb > 0 ? "+" : ""}${r.climbMb} MB / ${(r.requests ?? 0).toLocaleString()} req${r.windowOnly ? " · WINDOW-ONLY (not boot-comparable)" : ""}`}</title>
              </circle>
              <circle
                cx={xs[i]}
                cy={cy(ratio)}
                r={String(CURVE_PT_R)}
                fill={r.windowOnly ? "#000" : hex}
                stroke={hex}
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
                opacity={r.windowOnly ? 0.75 : 1}
                pointerEvents="none"
              />
            </g>
          );
        })}
      </svg>
      {rows.length > ratioIdx.length && (
        <p
          className="vvu-label text-[7px] text-[#5f6e55] mt-0.5"
          title="FLAT-tier rows carry no ratio by design (the tier never reaches one) — they occupy their moment on the x-axis as a gap, not a point"
        >
          {rows.length - ratioIdx.length} FLAT ROW{rows.length - ratioIdx.length === 1 ? "" : "S"}{" "}
          SHOWN AS GAPS — NO RATIO, NO INVENTED POINT
        </p>
      )}
    </div>
  );
}

/** R85 — ledger export: hand the readings their portability. The downloaded
 *  JSON is exactly the rows the GET returned (full ledger, display cap not
 *  applied) plus provenance — the client invents no numbers. R88 — the
 *  payload carries the ritual state TOO (the live boot's reading count and
 *  the chip's three-state read), so an exported ledger self-describes where
 *  the two-reading practice stood at export time. */
function exportVerdictLedger(rows: VerdictReadingRow[], livePid?: number | null) {
  const liveRows = livePid != null ? rows.filter((r) => r.bootPid === livePid) : [];
  const ritual =
    livePid == null
      ? null
      : {
          liveBootPid: livePid,
          liveBootReadings: liveRows.length,
          state:
            liveRows.length === 0
              ? "first-reading-due"
              : liveRows.length === 1
                ? "second-reading-due"
                : "pair-complete",
        };
  const payload = {
    exportedAtUtc: `${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC`,
    source: "vvu-trust/verdict/readings.jsonl via GET /api/guardian/verdict-ledger",
    count: rows.length,
    rows,
    ritual,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `verdict-readings-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** The trend strip — the verdict ledger's reading surface. Rows render
 *  OLDEST → NEWEST so the eye reads the ratio curve forward in time; the
 *  delta chip compares each row with the row before it (ratio DOWN = lime —
 *  the leak-per-request shrinking; UP = amber — worsening; |Δ| < 1 = dim
 *  FLAT). A NEW BOOT divider marks every boot-pid change — that boundary is
 *  the unit of comparison. WINDOW-ONLY rows render dimmed with the badge:
 *  honest evidence, but not boot-to-boot comparable. */
function VerdictTrendStrip({
  ledger,
  ledgerError,
  ledgerPending,
  onReread,
  rereading,
  livePid,
  projection,
  memSeries,
  guardMb,
  bootSinceMs,
}: {
  ledger: VerdictLedgerResponse | null;
  ledgerError: Error | null;
  ledgerPending: boolean;
  onReread?: () => void;
  rereading?: boolean;
  /** R87 — the LIVE boot's worker pid from the traffic counter, so the
   *  ritual chip keys to the boot that is actually serving, not to whatever
   *  row happens to be newest. Null when traffic is unarmed (chip stays
   *  silent — an unarmed counter cannot honestly claim any ritual state). */
  livePid?: number | null;
  /** R106 — the guardian's rail projection, threaded so THE THREE DRIFTS
   *  can reconcile the ceiling/floor axes with the pair sheet's opening
   *  axis on the same fetch (one guardian poll, many readers). Null when
   *  the guardian is absent — the card stays down, honestly. */
  projection?: RailProjectionPayload | null;
  /** R107 — the guardian's living memSeries + guard line, threaded so THE
   *  OUTLOOK can project the runway and read the lull on the same fetch
   *  (one guardian poll, many readers). Absent → the card stays down. */
  memSeries?: Array<{ t: string; rssKb: number | null; availKb: number | null }> | null;
  guardMb?: number | null;
  /** R107 — the current boot's first stamp (ms): the last bounce's time,
   *  parsed from the guardian's own lastBounceAtUtc. The runway scopes
   *  itself to THIS boot; absent → the full window speaks. */
  bootSinceMs?: number | null;
}) {
  const rows = ledger?.ledger.rows ?? [];
  const chronological = [...rows].reverse(); // API is newest-first; the eye reads forward
  const DISPLAY_CAP = 8;
  const visible = chronological.slice(-DISPLAY_CAP);
  const hiddenCount = chronological.length - visible.length;
  const bootCount = new Set(rows.map((r) => r.bootPid)).size;

  // R83 — THE SETTLE: each boot's own first→last ratio. R86 — the arithmetic
  // moved into the SHARED tier engine (computeSettles in src/lib/verdict-tiers)
  // so the estate chronicle's calibration block computes the SAME settles from
  // the SAME rows — one computation, two readers, zero drift. This is the
  // shape the calibration hunt reads: a FALLING settle with positive climb is
  // the compile/HMR signature resolving (R82's 376 → 16 evidence); a RISING
  // settle across mature boots is the hunt's next target. R93 — a boot whose
  // LAST reading is the FLAT tier (the climb collapsed into the pass log's
  // own noise) with a ratio-bearing first reading is a FLAT CLOSER: settled,
  // determinate, below the band — the strongest resolve the ledger records
  // (R89's compile-spike prediction CONFIRMED, not a dash). Only boots that
  // truly cannot be judged (fewer than two readings, no first ratio) stay
  // closer:null — the NO RATIO PAIR class.
  const settles: BootSettle[] = computeSettles(chronological);
  const settledBoots = settles.filter((s) => s.settled).length;
  // R85 — THE SCORECARD: settled boots (a determinate outcome: a ratio pair
  // OR — R93 — a flat closer) and how many of those landed in the band. A
  // flat closer sits BELOW the band by construction (the band is 16–32
  // MB/1k request-proportional; flat is sub-ratio noise) — it grows the
  // denominator, never the numerator: a different good, named as such.
  const settledBootsList = settles.filter((s) => s.settled);
  const settledInBand = settledBootsList.filter((s) => s.inBand).length;
  const flatClosers = settles.filter((s) => s.closer === "flat");
  // R95 — THE OPEN-PAIR WATCHLIST: the single-reading boots, from the SAME
  // rows the settle engine reads. The live boot's entry is the pair the
  // RECORD READING button can close; the dead ones are the races the ritual
  // lost — counted, named, never dressed up as settled.
  const openPairList = openPairs(chronological, livePid);
  // R97 — THE BOOT ARCS: the same rows the settle engine and the open-pair
  // watchlist read, regrouped into per-boot READING SEQUENCES with class-
  // transition detection. The scorecard reads a boot's ENDS; the arc reads
  // the BETWEEN — 11015's FLAT opener recording a REQUEST-TRACKED second
  // reading 17 minutes later is exactly what an ends-only view cannot name.
  // One dataset, three views, zero drift (the R93 lesson, extended).
  const arcs: BootArc[] = computeBootArcs(chronological, livePid);
  const arcPop: ArcPopulation = arcPopulation(arcs);

  // R87 — THE RITUAL CHIP: the two-reading practice made visible ON the strip
  // that serves it. A boot's settle pair is its first→last ratio, so a boot
  // holding a single reading cannot be judged yet — the scorecard skips it
  // and the curve draws an unconnected bead. The chip names that gap while
  // it is still open (the RECORD READING button below closes it — the client
  // sends no numbers; the server re-reads the scope and classifies). Keyed
  // to the LIVE boot's worker pid: if the live boot holds no rows at all,
  // the chip says exactly that instead of pointing at a dead boot's row.
  const liveRows = livePid != null ? chronological.filter((r) => r.bootPid === livePid) : [];
  const liveNewest = liveRows.length > 0 ? liveRows[liveRows.length - 1] : null;
  // R93 — the live boot's own resolve class, for the PAIR COMPLETE chip: the
  // pair exists AND the newest reading is FLAT over a ratio-bearing earlier
  // one — the strongest settle, named where the ritual closes.
  const liveFlatResolve =
    liveRows.length >= 2 && liveNewest?.kind === "flat" && liveRows.some((r) => r.mbPer1k != null);
  // R88 — the age ticker: the SECOND-READING-DUE chip's age used to move only
  // when the ledger refetched (90s cadence), so a chip could honestly say
  // '1M OLD' for two minutes. While the due state stands, a 30s tick keeps
  // the age honest BETWEEN refetches; no tick when the chip is silent.
  const [ageNow, setAgeNow] = useState<number>(() => Date.now());
  const ageDue = liveRows.length === 1;
  useEffect(() => {
    if (!ageDue) return;
    const id = setInterval(() => setAgeNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [ageDue]);
  const ritualAgeMin =
    ageDue && liveNewest?.atMs != null
      ? Math.max(0, Math.round((ageNow - liveNewest.atMs) / 60_000))
      : null;

  return (
    <div
      className="mt-2 rounded-sm border border-[#00d4e0]/25 bg-black/30 p-2"
      data-testid="verdict-trend"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="vvu-label text-[8px] font-bold tracking-[0.22em] text-[#00d4e0]/80 inline-flex items-center gap-1.5">
          <History className="size-3" aria-hidden />
          THE TREND · RATIO ACROSS BOOTS
        </p>
        <span className="inline-flex items-center gap-1.5">
          {/* R84 — RE-READ: the strip follows its 90s cadence (and refetches on
              window focus), but the operator should not have to wait out an
              interval — or burn a 60s-cooldown RECORD — just to see the file's
              newest rows. A re-read is a pure GET: it writes nothing. */}
          {onReread && (
            <button
              type="button"
              onClick={onReread}
              disabled={rereading}
              aria-live="polite"
              aria-label={rereadStripAria(rereading ?? false)}
              className="vvu-label inline-flex items-center gap-1 rounded-sm border border-[#00d4e0]/40 bg-black/30 px-1.5 py-0.5 text-[7.5px] font-bold tracking-[0.14em] text-[#00d4e0] enabled:hover:bg-[#00d4e0]/15 enabled:cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00d4e0]"
              title="re-read the ledger file now — the strip normally follows its 90s cadence (and refetches when the window regains focus); a re-read is a pure GET and writes nothing. R187 · THE COPIED HANDS: the seventh REREAD joins the chorus — the offer and its flight ride the aria, heard without hovering."
            >
              {rereading ? (
                <Loader2 className="size-2.5 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="size-2.5" aria-hidden />
              )}
              RE-READ
            </button>
          )}
          {rows.length > 0 && (
            <button
              type="button"
              onClick={() => exportVerdictLedger(chronological, livePid)}
              aria-label={exportLedgerAria()}
              className="vvu-label inline-flex items-center gap-1 rounded-sm border border-[#3a4530] bg-black/30 px-1.5 py-0.5 text-[7.5px] font-bold tracking-[0.14em] text-[#7a8a6e] hover:text-[#00d4e0] hover:border-[#00d4e0]/40 hover:bg-[#00d4e0]/10 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00d4e0]"
              title="export the FULL ledger as JSON — exactly the rows the GET returns (including readings below the display cap), wrapped with the export time, source path, and the live boot's ritual state; the client invents nothing. R187 · THE COPIED HANDS: the bare verb gains its object — the offer rides the aria, heard without hovering."
              data-testid="verdict-export"
            >
              <Download className="size-2.5" aria-hidden />
              EXPORT
            </button>
          )}
          {/* R87 — THE RITUAL CHIP (three honest states, keyed to the live boot) */}
          {livePid != null && liveRows.length === 1 && (
            <span
              className="vvu-label inline-flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded-sm border border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/5 tabular-nums cursor-help"
              data-testid="verdict-ritual"
              title={`THE TWO-READING RITUAL: boot ${livePid} holds ONE reading${ritualAgeMin != null && ritualAgeMin >= 1 ? `, recorded ${ritualAgeMin} min ago` : ""} — its settle pair (first→last ratio) does not exist yet, so the scorecard and the settle strip cannot judge it. Record the second reading with RECORD READING below (the client sends no numbers; the server re-reads the scope and classifies).`}
            >
              <span
                className="inline-block size-1.5 rounded-full bg-[#e0a030] vvu-pulse"
                aria-hidden
              />
              RITUAL · SECOND READING DUE · BOOT {livePid}
              {ritualAgeMin != null && ritualAgeMin >= 1 ? ` · ${ritualAgeMin}M OLD` : ""}
            </span>
          )}
          {livePid != null && liveRows.length >= 2 && (
            <span
              className="vvu-label text-[8px] px-1.5 py-0.5 rounded-sm border border-[#3a4530] text-[#7a8a6e] bg-black/30 tabular-nums cursor-help"
              data-testid="verdict-ritual"
              title={`boot ${livePid} holds ${liveRows.length} readings — its settle outcome exists${liveFlatResolve ? " and reads FLAT RESOLVE: the newest reading's boot-scoped climb collapsed to +" + (liveNewest?.climbMb ?? "—") + " MB over " + (liveNewest?.requests ?? 0).toLocaleString() + " requests, the storm resolved completely (below the band, a different good)" : " (first→last) and the scorecard/curve already read it"}; further readings extend the boot's line until the boot dies`}
            >
              RITUAL · PAIR COMPLETE · BOOT {livePid} · {liveRows.length} READING
              {liveRows.length === 1 ? "" : "S"}
              {liveFlatResolve ? " · FLAT RESOLVE" : ""}
            </span>
          )}
          {livePid != null && liveRows.length === 0 && (
            <span
              className="vvu-label text-[8px] px-1.5 py-0.5 rounded-sm border border-[#e0a030]/40 text-[#e0a030]/80 bg-black/30 tabular-nums cursor-help"
              data-testid="verdict-ritual"
              title={`the live boot (worker pid ${livePid}) has NO recorded readings yet — its first reading opens its ledger line; RECORD READING below takes it`}
            >
              RITUAL · FIRST READING DUE · BOOT {livePid}
            </span>
          )}
          {ledger?.ledger.present && (
            <span
              className="vvu-label text-[8px] px-1.5 py-0.5 rounded-sm border border-[#3a4530] text-[#7a8a6e] bg-black/30 tabular-nums cursor-help"
              title={`${ledger.ledger.total} recorded reading(s) across ${bootCount} distinct boot(s) · append-only JSONL at vvu-trust/verdict/readings.jsonl · ${ledger.ledger.corrupt} corrupt line(s) counted${ledger.ledger.corrupt > 0 ? ", never hidden" : ""} · 60s cooldown per boot pid keeps the ledger readable`}
            >
              {ledger.ledger.total} READING{ledger.ledger.total === 1 ? "" : "S"} · {bootCount} BOOT
              {bootCount === 1 ? "" : "S"}
            </span>
          )}
          {/* R100 — THE PROVENANCE MIX: who recorded the ledger's rows — the
              operator's hand, the guardian's auto-pair, or a pre-R99 row
              written before the via field existed. The record's honesty
              includes its triggers: the arithmetic was always server-derived,
              so this is provenance, not credibility. */}
          {rows.length > 0 &&
            (() => {
              let op = 0;
              let auto = 0;
              let pre = 0;
              for (const r of rows) {
                if (r.via === "auto-guardian") auto += 1;
                else if (r.via === "operator") op += 1;
                else pre += 1;
              }
              if (auto === 0 && pre === 0) return null; // all-operator record — the default needs no chip
              return (
                <span
                  className="vvu-label text-[8px] px-1.5 py-0.5 rounded-sm border border-[#3a4530] text-[#7a8a6e] bg-black/30 tabular-nums cursor-help"
                  data-testid="verdict-provenance-mix"
                  title={`the ledger's triggers: ${op} recorded by the operator (the button's hand), ${auto} by the guardian's auto-pair (R99 — armed after each bounce, +3.5 min opener / +18 min second), ${pre} pre-R99 rows written before the via field existed (they render as the operator's hand, honestly unmarked). The POST carries no numbers either way — the server re-derived every row, so this mix is provenance, never credibility.`}
                >
                  {op} OPERATOR{auto > 0 ? ` · ${auto} AUTO` : ""}
                  {pre > 0 ? ` · ${pre} PRE-VIA` : ""}
                </span>
              );
            })()}
        </span>
      </div>

      {ledgerPending && (
        <div className="mt-2 space-y-1.5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      )}
      {ledgerError && (
        <p className="vvu-label text-[9px] text-[#e5484d] mt-2" role="alert">
          TREND FEED ERROR — {ledgerError.message}
        </p>
      )}

      {!ledgerPending && !ledgerError && (!ledger?.ledger.present || rows.length === 0) && (
        <p className="vvu-label text-[8px] text-[#7a8a6e] leading-relaxed mt-1.5">
          NO READINGS RECORDED YET — RECORD THIS BOOT&apos;S READING TO START THE TREND. ONE ROW PER
          MOMENT IS A READING; THE RATIO&apos;S TREND ACROSS BOOTS IS THE SIGNAL (R78&apos;s
          CALIBRATION INSIGHT, NOW DURABLE).
        </p>
      )}

      {visible.length > 0 && (
        <div className="mt-1.5 space-y-1">
          {hiddenCount > 0 && (
            <p className="vvu-label text-[8px] text-[#5f6e55] tabular-nums">
              +{hiddenCount} EARLIER READING{hiddenCount === 1 ? "" : "S"} BELOW THE DISPLAY CAP (
              {DISPLAY_CAP}) — every row is in the JSONL, none are edited or dropped
            </p>
          )}
          {visible.map((row, idx) => {
            const prev = idx > 0 ? visible[idx - 1] : null;
            const newBoot = prev != null && prev.bootPid !== row.bootPid;
            const delta =
              prev && row.mbPer1k != null && prev.mbPer1k != null
                ? row.mbPer1k - prev.mbPer1k
                : null;
            const deltaTone =
              delta == null ? "dim" : Math.abs(delta) < 1 ? "dim" : delta < 0 ? "lime" : "amber";
            return (
              <div key={`${row.atMs}-${row.bootPid}`}>
                {newBoot && (
                  <p
                    className="vvu-label text-[7.5px] text-[#5f6e55] my-1 flex items-center gap-1.5"
                    title={`boot pid changed ${prev?.bootPid} → ${row.bootPid} — the journal's own boundary is the unit of comparison${row.devTreePid != null ? ` · this boot's tree root is ${row.devTreePid} (bounces.jsonl speaks that namespace)` : ""}`}
                  >
                    <span className="h-px flex-1 bg-[#3a4530]" aria-hidden />
                    NEW BOOT · PID {row.bootPid}
                    {row.devTreePid != null && row.devTreePid !== row.bootPid
                      ? ` · TREE ${row.devTreePid}`
                      : ""}
                    <span className="h-px flex-1 bg-[#3a4530]" aria-hidden />
                  </p>
                )}
                <div
                  className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-sm border px-1.5 py-1 ${
                    row.windowOnly
                      ? "border-[#3a4530]/60 bg-black/20"
                      : "border-[#3a4530] bg-black/30"
                  }`}
                >
                  <span
                    className={`vvu-label text-[8px] font-bold px-1 py-px rounded-sm border ${verdictToneClasses(row.tone)} ${row.windowOnly ? "opacity-70" : ""}`}
                  >
                    {row.kind.toUpperCase().replace("-", " ")}
                  </span>
                  {row.via === "auto-guardian" && (
                    <span
                      className="vvu-label text-[7px] font-bold px-1 py-px rounded-sm border border-[#00d4e0]/50 text-[#00d4e0] bg-[#00d4e0]/5 cursor-help"
                      title="recorded by the guardian's AUTO-PAIR (R99): after the bounce that produced this boot, the guardian itself triggered this reading — the POST carries no numbers, the ledger re-derived everything server-side. Provenance only; the row's arithmetic is identical to an operator recording."
                    >
                      AUTO
                    </span>
                  )}
                  {row.windowOnly && (
                    <span
                      className="vvu-label text-[7.5px] px-1 py-px rounded-sm border border-[#e0a030]/50 text-[#e0a030]"
                      title="no boot boundary inside this reading's scope window — the climb spans a boot tail, so the row is evidence but not boot-to-boot comparable"
                    >
                      WINDOW-ONLY
                    </span>
                  )}
                  <span
                    className="font-mono text-[10px] font-bold text-[#00d4e0] tabular-nums"
                    title="the attribution ratio at record time — server-computed from the same parser the scope chart draws"
                  >
                    {row.mbPer1k != null ? row.mbPer1k.toFixed(2) : "—"}
                    <span className="text-[8px] text-[#7a8a6e]"> MB/1K</span>
                  </span>
                  {delta != null && (
                    <span
                      className={`vvu-label text-[7.5px] font-bold px-1 py-px rounded-sm border ${verdictToneClasses(deltaTone)}`}
                      title={
                        deltaTone === "lime"
                          ? `ratio FELL ${Math.abs(delta).toFixed(2)} MB/1k vs the previous reading — leak-per-request shrinking`
                          : deltaTone === "amber"
                            ? `ratio ROSE ${delta.toFixed(2)} MB/1k vs the previous reading — leak-per-request worsening`
                            : "ratio moved less than 1 MB/1k — flat within calibration noise"
                      }
                    >
                      {delta < 0 ? "DOWN" : delta > 0 ? "UP" : "FLAT"} {delta > 0 ? "+" : ""}
                      {delta.toFixed(2)}
                    </span>
                  )}
                  <span
                    className="font-mono text-[8.5px] text-[#c9d4bd] tabular-nums"
                    title={`climb ${row.climbMb > 0 ? "+" : ""}${row.climbMb} MB over ${(row.requests ?? 0).toLocaleString()} requests · ${row.reqPerMin ?? "—"} req/min at record time`}
                  >
                    {row.climbMb > 0 ? "+" : ""}
                    {row.climbMb} MB / {(row.requests ?? 0).toLocaleString()} REQ
                  </span>
                  {row.knownSelfPct != null && (
                    <span
                      className="vvu-label text-[8px] text-[#7a8a6e] tabular-nums"
                      title={`known-self share of the top-24 buckets at record time · residual ${row.residualReq ?? 0} req left for attribution`}
                    >
                      SELF {row.knownSelfPct}%
                    </span>
                  )}
                  {row.profileNextKey && (
                    <span
                      className="font-mono text-[8px] text-[#f3e38a] truncate max-w-[180px]"
                      title={`profile-next at record time: ${row.profileNextKey} (${row.profileNextCount ?? 0} req)`}
                    >
                      NEXT {row.profileNextKey}
                    </span>
                  )}
                  <span
                    className="ml-auto font-mono text-[8px] text-[#7a8a6e] tabular-nums"
                    title={`recorded ${row.at} · worker pid ${row.bootPid} (served this reading, holds the traffic counter, keys the 60s cooldown)${row.devTreePid != null && row.devTreePid !== row.bootPid ? ` · tree root ${row.devTreePid} (the guardian's bounce namespace — the join key to bounces.jsonl)` : ""} · uptime ${row.uptimeSec}s · ${row.routesTracked ?? "?"} routes tracked`}
                  >
                    PID {row.bootPid}
                    {row.devTreePid != null && row.devTreePid !== row.bootPid && (
                      <span
                        className="text-[#5f6e55]"
                        aria-label={`tree root pid ${row.devTreePid}`}
                      >
                        ·T{row.devTreePid}
                      </span>
                    )}
                    {" · "}
                    {row.at.slice(11, 19)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <VerdictTrendCurve rows={chronological} />

      {/* R104 — THE PAIR SHEET: the auto-pair era's own record, read from the
          same ledger rows (one fetch, three readers — strip, curve, sheet).
          The storm history reads the dead's band drifting; this reads the
          living side of the same storm: the boots' opening climbs, the pair
          kinds, and the honest losses, one row per cycle. */}
      <PairSheet rows={chronological} />

      {/* R108 — THE DEATH WINDOWS: the dying minute, drawn. The record's
          central finding (sawtooth — crossings, not runaways) has been a
          word since R98; this panel draws the actual witness windows — the
          rss trajectories the kernel struck inside — on one shared MB scale
          and one shared clock, against the judged ceiling band the strip
          established. Same projection payload, zero new polls. */}
      {projection && <DeathWindows projection={projection} />}

      {/* R109 — THE SAWTOOTH READOUT: the breath, measured. R108 drew the
          dying minutes; this measures the swings the drawing showed — per
          certified reversal, the full rise + fall traversal in MB, the
          record's deepest breath, and an OLS over per-window median breath
          vs witnessed index (the sawtooth's own drift axis). Same
          projection payload, zero new polls. */}
      {projection && <SawtoothReadout projection={projection} />}

      {/* R106 — THE THREE DRIFTS: the reconciliation card. Three engines, one
          storm, three geographies (ceiling altitude / box depth / opening
          heat) — read verbatim and asked whether they agree. The verdict
          needs R² ≥ 0.5 AND the halves' agreement; the grind is a finding. */}
      {projection && <ThreeDrifts projection={projection} ledgerRows={chronological} />}

      {/* R107 — THE OUTLOOK: the forward read. The evidence stack ends in
          its forecast: the runway (this window's climb to the guard line)
          and the lull (the live gap vs the record's own heartbeat). Same
          fetch — the guardian poll the page already makes feeds both dials. */}
      <Outlook
        witnessed={projection?.witnessedDeaths ?? projection?.witnessed ?? null}
        memSeries={memSeries ?? null}
        guardMb={guardMb ?? null}
        bootSinceMs={bootSinceMs ?? null}
      />

      {/* R125 — THE WATCHBOARD: the standing watches, compiled. Every
          round's handoff has named the open tensions the next round must
          read before it trusts anything (the edge ride, the walk's holds,
          the whisker carve, the deep band, the quiet hour, the churn
          clock, the leadership line); the operator read them panel by
          panel. This board reads them ALL live from their home engines —
          one route, one journal parse, the memory store read-only — each
          watch a row with its own status word and contract. A read that
          fails renders NO FEED (the refusal is the status); the board
          forecasts nothing. Self-fetching (60s re-read, REREAD). */}
      <Watchboard />

      {/* R110 — THE LATENCY LEDGER: what serving costs. Every panel above
          reads the memory storm; this reads the request side — the dev
          log's own request lines parsed into per-route censuses and
          latency distributions, with the 404 probes named and the
          respawns counted. Self-fetching (60s re-read, REREAD button):
          the log is append-only, a bounded tail read is cheap and
          honest. */}
      <LatencyLedger />

      {/* R114 — THE LATENCY MEMORY: the R110 question answered by the
          record itself. R110 read the request side but one window cannot
          separate compile-cold from steady-heavy; the memory keeps a
          bounded store of ledger snapshots (one per read, same-window
          reads refused), marks each QUIET (zero respawn banners — the
          log's own vocabulary), and compares each tracked route's quiet
          p95 against its noisy p95 over the house lower-median:
          COMPILE-COLD / STEADY-HEAVY / MIXED / CALM / TOO FEW — with the
          estate p95 sparkline and per-route trends, gaps honest. Reads
          the same engine and store the /api/estate/latency-memory route
          serves — zero new polls beyond its own 60s re-read. */}
      <LatencyMemory />

      {/* R111 — THE BOOT LEDGER: how long boots hold the port. The record
          counted deaths but never tenures; the guardian's bounce journal
          carries the full spawn/death chain and this walks it — per-boot
          tenure, the settled median, halves + OLS trend, the stillborn
          named, the killer lens (tenure at death by cause). Self-fetching
          (60s re-read, REREAD button): the journal is append-only, a
          bounded read is cheap and honest. */}
      <BootLedger />

      {/* R116 — THE DEATH-CAUSE LENS: who kills the port, and is that
          changing? R115's risk #1 instrumented — the journal wrote port
          for 22 kills, then avail-critical began taking turns. Reads the
          same bounce journal through the same boot-ledger engine (one
          parse, many readers): census by cause, the run decomposition of
          the death order, per-cause strike strides, the stripline (one
          tick per death), and the recent-window shift verdict — PORT
          MONOPOLY / THE FLOOR TAKES TURN (≥ 25% non-port, inclusive) /
          PORT RULES / TOO FEW. Self-fetching (60s re-read, REREAD). */}
      <DeathCauses />

      {/* R112 — THE SURVIVAL CURVE: Kaplan-Meier on the boot ledger's own
          tenures. The living boot is censored at its current age (the
          honest grammar a settled median lacks); checkpoints at 5′/30′/60′,
          the KM median, and THE INFANCY WATCH — the R111 handover's named
          priority: deaths before the calibrated five-minute line. Reads
          the same /api/estate/boot-ledger walk (60s re-read, REREAD). */}
      <SurvivalCurve />

      {settledBoots > 0 && (
        <div className="mt-1.5 border-t border-[#3a4530]/60 pt-1.5">
          <p
            className="vvu-label text-[7.5px] font-bold tracking-[0.22em] text-[#00d4e0]/60 inline-flex flex-wrap items-center gap-1.5"
            title="each boot's own first→last reading outcome, from the full ledger — a falling settle with positive climb is the compile/HMR signature resolving (the storm settles, the ratio collapses); a rising settle across mature boots is the hunt's next target; a FLAT closer (R93) is the strongest resolve: the boot's climb collapsed into noise entirely"
          >
            THE SETTLE · FIRST→LAST OUTCOME PER BOOT
            {/* R98 — THE OPENER'S MOMENT QUALIFIER: the boot arcs engine's
                opener→closer agreement decides whether this strip's FIRST
                column predicts anything. When agreement falls below half,
                the strip says so on its own header — the first column
                describes the opener's MOMENT (a cold-boot snapshot), not the
                boot's outcome; the arc between carries the calibration. */}
            {arcPop.openerPredictsCloser != null &&
              arcPop.openerPredictsCloser.agreeing * 2 < arcPop.openerPredictsCloser.judged && (
                <span
                  className="vvu-label text-[7px] font-bold px-1 py-px rounded-sm border border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/5 tracking-normal cursor-help"
                  title={`the boot arcs' opener→closer agreement is ${arcPop.openerPredictsCloser.agreeing}/${arcPop.openerPredictsCloser.judged} — below half. The FIRST value in each row is the OPENER'S MOMENT (a cold-boot snapshot), not a prediction of the boot's outcome; the middle of the arc (see BOOT ARCS below) carries the calibration. This qualifier computes from the ledger's own rows and moves as they do.`}
                >
                  FIRST COLUMN = OPENER&apos;S MOMENT, NOT A PREDICTOR
                </span>
              )}
          </p>
          <div className="mt-1 space-y-0.5">
            {settles.map((s) => {
              const tone =
                s.closer === "flat"
                  ? "lime"
                  : s.settle != null
                    ? Math.abs(s.settle) < 1
                      ? "dim"
                      : s.settle < 0
                        ? "lime"
                        : "amber"
                    : s.closer === "ratio"
                      ? s.inBand
                        ? "lime"
                        : "amber"
                      : "dim";
              return (
                <div
                  key={s.pid}
                  className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-sm border-l-2 bg-black/20 px-1.5 py-0.5 ${
                    s.closer === "flat" ? "border-l-[#6b8a40]/60" : "border-l-[#00d4e0]/30"
                  }`}
                  title={
                    s.closer === "flat"
                      ? `boot pid ${s.pid}: ${s.count} readings · FLAT CLOSER — first ${s.first.mbPer1k != null ? s.first.mbPer1k.toFixed(2) : "—"} MB/1k at ${s.first.at.slice(11, 19)}, last reading's boot-scoped climb collapsed to +${s.flatClimbMb ?? "—"} MB over ${(s.flatRequests ?? 0).toLocaleString()} requests (the flat tier: climb ≤ 8 MB reads as the pass log's own noise, so no ratio computes) — the storm resolved COMPLETELY; R89's "compile-spike opener must not read as steady state" confirmed on this boot's own numbers`
                      : `boot pid ${s.pid}: ${s.count} reading(s) · first ${s.first.mbPer1k != null ? s.first.mbPer1k.toFixed(2) : "—"} MB/1k at ${s.first.at.slice(11, 19)} · last ${s.last.mbPer1k != null ? s.last.mbPer1k.toFixed(2) : "—"} MB/1k at ${s.last.at.slice(11, 19)}${s.settle != null ? ` · settle ${s.settle > 0 ? "+" : ""}${s.settle.toFixed(2)} MB/1k (${s.settlePct != null ? `${s.settlePct > 0 ? "+" : ""}${s.settlePct.toFixed(1)}%` : "—"})` : ""} — the boot's own shape, independent of other boots`
                  }
                >
                  <span className="font-mono text-[8px] text-[#7a8a6e] tabular-nums">
                    PID {s.pid}
                  </span>
                  <span className="vvu-label text-[7.5px] text-[#5f6e55] tabular-nums">
                    {s.count} RDG
                  </span>
                  {s.closer === "flat" ? (
                    <>
                      <span className="font-mono text-[8.5px] text-[#c9d4bd] tabular-nums">
                        {s.first.mbPer1k != null ? s.first.mbPer1k.toFixed(1) : "—"}
                        <span className="text-[#5f6e55]"> → </span>
                        <span className="text-[#b8c9a0]">FLAT</span>
                        <span className="text-[8px] text-[#7a8a6e]">
                          {" "}
                          (+{s.flatClimbMb ?? "—"} MB / {(s.flatRequests ?? 0).toLocaleString()}{" "}
                          REQ)
                        </span>
                      </span>
                      <span
                        className={`vvu-label text-[7.5px] font-bold px-1 py-px rounded-sm border ${verdictToneClasses("lime")}`}
                      >
                        SETTLE → FLAT
                      </span>
                      <span
                        className="vvu-label text-[7.5px] px-1 py-px rounded-sm border border-[#6b8a40]/50 bg-[#6b8a40]/10 text-[#c8ff00]"
                        title="the boot's LAST reading is the FLAT tier — its boot-scoped climb collapsed into the pass log's own noise (≤ 8 MB), so the ratio cannot and need not compute. This sits BELOW the 16–32 band by construction: a different good than in-band — the request-proportional story ENDED, not settled into"
                      >
                        FLAT RESOLVE
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-mono text-[8.5px] text-[#c9d4bd] tabular-nums">
                        {s.first.mbPer1k != null ? s.first.mbPer1k.toFixed(1) : "—"}
                        <span className="text-[#5f6e55]"> → </span>
                        {s.last.mbPer1k != null ? s.last.mbPer1k.toFixed(1) : "—"}
                        <span className="text-[8px] text-[#7a8a6e]"> MB/1K</span>
                      </span>
                      <span
                        className={`vvu-label text-[7.5px] font-bold px-1 py-px rounded-sm border ${verdictToneClasses(tone)}`}
                      >
                        {s.closer === null
                          ? "NO RATIO PAIR"
                          : s.settle != null
                            ? `SETTLE ${s.settle > 0 ? "+" : ""}${s.settle.toFixed(1)}${s.settlePct != null ? ` (${s.settlePct > 0 ? "+" : ""}${s.settlePct.toFixed(0)}%)` : ""}`
                            : `LAST RATIO ${s.last.mbPer1k != null ? s.last.mbPer1k.toFixed(1) : "—"}`}
                      </span>
                    </>
                  )}
                  {s.closer === "ratio" && s.inBand && (
                    <span
                      className="vvu-label text-[7.5px] font-bold px-1 py-px rounded-sm border border-[#00d4e0]/50 bg-[#00d4e0]/10 text-[#00d4e0]"
                      title={`the boot's last reading landed INSIDE the 16–32 MB/1k steady-state band — a settled calibration point; the band's edges are calibration (CURVE_BAND_LO/HI), not law`}
                    >
                      IN BAND
                    </span>
                  )}
                  {s.closer === "ratio" && !s.inBand && s.last.mbPer1k != null && (
                    <span
                      className="vvu-label text-[7.5px] px-1 py-px rounded-sm border border-[#3a4530] text-[#5f6e55]"
                      title={`the boot's last reading sits OUTSIDE the 16–32 MB/1k band (${s.last.mbPer1k > CURVE_BAND_HI ? "above" : "below"} it) — honest until it settles in; the band's edges are calibration, not law`}
                    >
                      OUT {s.last.mbPer1k > CURVE_BAND_HI ? "ABOVE" : "BELOW"}
                    </span>
                  )}
                </div>
              );
            })}
            {settledBootsList.length > 0 && (
              <p
                className="vvu-label text-[7.5px] text-[#7a8a6e] tabular-nums pt-0.5"
                title={`of ${settledBootsList.length} settled boots — a determinate outcome: ${settledBootsList.length - flatClosers.length} whose last reading carries a ratio (with or without a full pair to settle FROM — R93 judges the outcome, not just the arithmetic) + ${flatClosers.length} flat closer${flatClosers.length === 1 ? "" : "s"} whose climb collapsed below the band — ${settledInBand} landed their last ratio inside the ${CURVE_BAND_LO}–${CURVE_BAND_HI} MB/1k steady-state band; THREE in-band closes the compile/HMR question as ledger-settled. The band's edges are calibration, not law`}
                data-testid="verdict-settle-scorecard"
              >
                CALIBRATION SCORECARD — {settledInBand} OF {settledBootsList.length} SETTLED BOOT
                {settledBootsList.length === 1 ? "" : "S"} IN THE {CURVE_BAND_LO}–{CURVE_BAND_HI}{" "}
                BAND
                {flatClosers.length > 0
                  ? ` · ${flatClosers.length} FLAT RESOLVE${flatClosers.length === 1 ? "" : "S"}`
                  : ""}
              </p>
            )}
            {/* R95 — THE OPEN-PAIR WATCHLIST: the ritual's scoreboard against
                the kernel. A single-reading boot cannot be judged, and a DEAD
                single-reading boot can never BE judged — its opener is a
                boundary snapshot that will sit unpaired forever. The strip
                names the population (how many openers, which can still
                close), the opener's value and tier, and each entry's age.
                Absent when every boot with readings holds a pair. */}
            {openPairList.length > 0 && (
              <div className="pt-0.5" data-testid="verdict-open-pairs">
                <p
                  className="vvu-label text-[7.5px] font-bold tracking-[0.14em] text-[#e0a030]/80 tabular-nums"
                  title={`the open-pair population from the same rows the settle engine reads: ${openPairList.filter((e) => e.live).length} live (the pair can still be recorded) + ${openPairList.filter((e) => !e.live).length} that died open (readings attach only to the live boot, so a dead opener never closes — the two-reading ritual lost that race). Their settles stay unjudgeable by construction; the ledger keeps the boundary snapshots honestly.`}
                >
                  OPEN PAIRS · {openPairList.length} WAITING
                  {openPairList.some((e) => e.live) ? " · 1 CLOSEABLE" : ""}
                </p>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {openPairList.map((e) => (
                    <span
                      key={e.pid}
                      className={`vvu-label inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[7.5px] font-bold tabular-nums cursor-help ${
                        e.live
                          ? "border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10"
                          : "border-[#3a4530] text-[#7a8a6e] bg-black/30"
                      }`}
                      title={`BOOT ${e.pid} — opener ${e.openerMbPer1k != null ? `${e.openerMbPer1k.toFixed(2)} MB/1k` : `FLAT (+${e.openerClimbMb ?? "—"} MB / ${(e.openerRequests ?? 0).toLocaleString()} req)`} · ${e.openerKind ?? "unclassified"} · recorded ${e.openerAt}${e.live ? " · THIS BOOT IS LIVE — RECORD READING closes the pair" : " · the boot is gone: readings attach only to the live boot, so this opener can never gain its pair (the settle engine reads it closer:null — unjudgeable, not settled)"}`}
                    >
                      <span
                        className={`inline-block size-1.5 rounded-full ${e.live ? "bg-[#e0a030] vvu-pulse" : "bg-[#5f6e55]"}`}
                        aria-hidden
                      />
                      BOOT {e.pid} ·{" "}
                      {e.openerMbPer1k != null
                        ? `${e.openerMbPer1k.toFixed(2)} ${(e.openerKind ?? "?").toUpperCase()}`
                        : "FLAT OPENER"}
                      <span className={e.live ? "text-[#e0a030]" : "text-[#5f6e55]"}>
                        {e.live ? "· CLOSEABLE" : "· DIED OPEN"}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {/* R97 — THE BOOT ARCS: one row per boot, the readings as beads
                on a hairline, the amber ▸ where a boot changed class
                mid-boot. Rendered whenever any boot holds a reading — a
                ledger with rows always has arcs. */}
            {arcs.length > 0 && <BootArcsPanel arcs={arcs} pop={arcPop} livePid={livePid} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ── R97 · THE BOOT ARCS PANEL ────────────────────────────────────────────────
// One row per boot: the boot's readings as tone-colored beads on a hairline,
// left (opener) → right (closer), uptime-ordered. A class change between
// consecutive readings renders the amber ▸ where the class changed — the
// mark an ends-only scorecard can never draw. The arc answers the question
// the scorecard's opener column cannot: does a boot's first reading PREDICT
// the boot? (11015: FLAT opener → TRACKED closer — it does not, and now the
// surface says so with the record's own rows.)

const ARC_DOT_BG: Record<string, string> = {
  lime: "bg-[#c8ff00]",
  cyan: "bg-[#00d4e0]",
  amber: "bg-[#e0a030]",
  rose: "bg-[#e5484d]",
};

const ARC_SHAPE_CHIP: Record<BootArc["shape"], { label: string; cls: string }> = {
  single: { label: "1 READING", cls: "border-[#3a4530] text-[#5f6e55]" },
  stable: { label: "STABLE", cls: "border-[#6b8a40]/50 text-[#7a8a6e]" },
  transition: { label: "CHANGED CLASS", cls: "border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/5" },
};

function arcStepTitle(arc: BootArc, idx: number): string {
  const s = arc.steps[idx];
  if (!s) return "";
  const ratio =
    s.mbPer1k != null
      ? `${s.mbPer1k.toFixed(2)} MB/1k`
      : `no ratio (climb ${s.climbMb != null ? `${s.climbMb > 0 ? "+" : ""}${s.climbMb}` : "—"} MB / ${(s.requests ?? 0).toLocaleString()} req)`;
  const parts = [
    `reading ${idx + 1} of ${arc.steps.length}`,
    s.kind != null ? s.kind.toUpperCase().replace("-", " ") : "UNCLASSIFIED (pre-kind row)",
    ratio,
    s.uptimeSec != null ? `uptime ${Math.round(s.uptimeSec / 60)}m` : null,
    // R99 — the trigger's provenance when the row carries it (pre-R99 rows
    // were operator-recorded by construction and say nothing — honest).
    s.via === "auto-guardian" ? "AUTO — recorded by the guardian after the bounce" : null,
    s.at,
  ];
  return parts.filter(Boolean).join(" · ");
}

function BootArcsPanel({
  arcs,
  pop,
  livePid,
}: {
  arcs: BootArc[];
  pop: ArcPopulation;
  livePid: number | null | undefined;
}) {
  const ARC_CAP = 10;
  const visibleArcs = arcs.slice(-ARC_CAP);
  const hiddenArcs = arcs.length - visibleArcs.length;
  const agreement = pop.openerPredictsCloser;
  return (
    <div className="pt-0.5" data-testid="verdict-boot-arcs">
      <p
        className="vvu-label text-[7.5px] font-bold tracking-[0.14em] text-[#00d4e0]/80 tabular-nums"
        title={`the boot arcs from the same rows the settle engine and the open-pair watchlist read: one row per boot, that boot's readings in uptime order, colored by tier. A class change between consecutive readings draws the amber ▸ — the mid-boot story an ends-only scorecard cannot see. HONESTY: a transition needs BOTH classes witnessed — a pre-kind (null) reading is a gap in the arc and records NO transition across it; single-reading boots draw one bead and are the open-pair watchlist's territory.`}
      >
        BOOT ARCS · {pop.boots} BOOT{pop.boots === 1 ? "" : "S"} · {pop.stable} STABLE ·{" "}
        {pop.transitioning} CHANGED CLASS MID-BOOT
      </p>
      {(pop.transitioning > 0 || agreement != null) && (
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          {pop.flows.map((f) => (
            <span
              key={`${f.from}-${f.to}`}
              className="vvu-label inline-flex items-center rounded-sm border border-[#e0a030]/40 bg-[#e0a030]/5 px-1 py-px text-[7.5px] font-bold text-[#e0a030] tabular-nums cursor-help"
              title={`class flow observed ${f.count} time${f.count === 1 ? "" : "s"} across all boots: a reading classified ${f.from.toUpperCase()} was followed (in its own boot, consecutive readings) by one classified ${f.to.toUpperCase()}.`}
            >
              {f.from.toUpperCase()} ▸ {f.to.toUpperCase()} ×{f.count}
            </span>
          ))}
          {agreement != null && (
            <span
              className={`vvu-label inline-flex items-center gap-1 rounded-sm border px-1 py-px text-[7.5px] font-bold tabular-nums cursor-help ${
                agreement.agreeing === agreement.judged
                  ? "border-[#6b8a40]/50 text-[#7a8a6e]"
                  : "border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/5"
              }`}
              title={`OPENER→CLOSER AGREEMENT across the ${agreement.judged} multi-reading boot${agreement.judged === 1 ? "" : "s"} whose opener AND closer both carry a class: ${agreement.agreeing} kept the opener's tier to the end. LOW agreement means the scorecard's opener column describes the OPENER'S MOMENT, not the boot's outcome — the arc, not the ends, carries the calibration. (A single-reading boot cannot be judged and is excluded; a classless end excludes its boot too.)`}
            >
              {agreement.agreeing * 2 < agreement.judged && (
                <span
                  className="inline-block size-1 rounded-full bg-[#e0a030] vvu-pulse"
                  aria-hidden
                />
              )}
              OPENER→CLOSER {agreement.agreeing}/{agreement.judged}
            </span>
          )}
        </div>
      )}
      <div className="mt-1 space-y-0.5">
        {hiddenArcs > 0 && (
          <p className="vvu-label text-[7.5px] text-[#5f6e55] tabular-nums">
            +{hiddenArcs} EARLIER BOOT{hiddenArcs === 1 ? "" : "S"} BELOW THE DISPLAY CAP ({ARC_CAP}
            ) — every reading stays in the JSONL
          </p>
        )}
        {visibleArcs.map((arc) => {
          const chip = ARC_SHAPE_CHIP[arc.shape];
          return (
            <div
              key={arc.pid}
              className={`flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-sm border px-1 py-0.5 transition-colors ${
                arc.live
                  ? "border-[#00d4e0]/30 bg-[#00d4e0]/5"
                  : "border-transparent hover:border-[#3a4530] hover:bg-black/20"
              }`}
              title={`BOOT ${arc.pid}${arc.devTreePid != null && arc.devTreePid !== arc.pid ? ` · tree ${arc.devTreePid}` : ""}${arc.bootStartUtc != null ? ` · boot started ${arc.bootStartUtc}` : ""}${arc.live ? " · LIVE — future readings extend this arc" : ""}`}
            >
              <span
                className={`vvu-label text-[7.5px] font-bold tabular-nums inline-flex items-center gap-1 ${arc.live ? "text-[#00d4e0]" : "text-[#7a8a6e]"}`}
              >
                {arc.live && (
                  <span
                    className="inline-block size-1 rounded-full bg-[#00d4e0] vvu-pulse"
                    aria-hidden
                  />
                )}
                BOOT {arc.pid}
              </span>
              <span
                className={`vvu-label text-[7px] font-bold px-1 py-px rounded-sm border ${chip.cls}`}
              >
                {chip.label}
              </span>
              <span className="inline-flex items-center" aria-hidden>
                {arc.steps.map((s, i) => {
                  const transitionHere = arc.transitions.some((t) => t.readingIndex === i);
                  const dotCls =
                    s.tone != null ? (ARC_DOT_BG[s.tone] ?? "bg-[#5f6e55]") : "bg-[#5f6e55]";
                  return (
                    <span key={i} className="inline-flex items-center">
                      {i > 0 &&
                        (transitionHere ? (
                          <span
                            className="vvu-label text-[8px] font-bold text-[#e0a030] px-0.5 cursor-help drop-shadow-[0_0_3px_rgba(224,160,48,0.55)]"
                            title={`CLASS CHANGED HERE: ${arc.transitions.find((t) => t.readingIndex === i)?.fromKind.toUpperCase()} ▸ ${arc.transitions.find((t) => t.readingIndex === i)?.toKind.toUpperCase()} — consecutive readings in this boot, both classes witnessed. The ends-only scorecard reads the two ends; this mark is the BETWEEN.`}
                          >
                            ▸
                          </span>
                        ) : (
                          <span className="h-px w-1.5 bg-[#3a4530]" />
                        ))}
                      <span
                        className={`inline-block size-1.5 rounded-full ${dotCls} ${arc.live && i === arc.steps.length - 1 ? "vvu-pulse" : ""} ${
                          s.tone == null ? "opacity-50" : ""
                        } cursor-help`}
                        title={arcStepTitle(arc, i)}
                      />
                    </span>
                  );
                })}
              </span>
              {arc.steps.length >= 2 &&
                arc.steps[0]?.mbPer1k != null &&
                arc.steps[arc.steps.length - 1]?.mbPer1k != null && (
                  <span className="vvu-label text-[7.5px] text-[#5f6e55] tabular-nums">
                    {(arc.steps[0]?.mbPer1k as number).toFixed(1)} →{" "}
                    {(arc.steps[arc.steps.length - 1]?.mbPer1k as number).toFixed(1)}
                  </span>
                )}
            </div>
          );
        })}
      </div>
      <p
        className="vvu-label mt-0.5 flex flex-wrap items-center gap-x-2 text-[7px] text-[#5f6e55] tabular-nums"
        title="the bead key — each arc's beads are colored by the SHARED tier table the verdict block and the ledger both classify through"
      >
        <span className="inline-flex items-center gap-1">
          <span className="inline-block size-1.5 rounded-full bg-[#c8ff00]" aria-hidden />
          FLAT
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block size-1.5 rounded-full bg-[#e0a030]" aria-hidden />
          MIXED
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block size-1.5 rounded-full bg-[#e5484d]" aria-hidden />
          TRACKED
        </span>
        <span className="inline-flex items-center gap-1">
          <span
            className="inline-block size-1.5 rounded-full bg-[#5f6e55] opacity-50"
            aria-hidden
          />
          NO RATIO / PRE-KIND
        </span>
        <span>· ▸ CLASS CHANGED MID-BOOT · BEADS RUN OPENER → CLOSER, UPTIME-ORDERED</span>
      </p>
      {livePid == null && (
        <p className="vvu-label mt-0.5 text-[7.5px] text-[#5f6e55]">
          TRAFFIC COUNTER UNARMED — the LIVE arc cannot be keyed; beads render without the live
          pulse
        </p>
      )}
    </div>
  );
}

function LeakVerdictBlock() {
  const traffic = useTrafficQuery();
  const plateau = usePlateauHistoryQuery(); // same queryKey as the scope — ONE fetch, two readers
  const ledger = useVerdictLedgerQuery();
  const guardian = useGuardianQuery(); // same queryKey again — ONE fetch, the drift card's ceiling/floor inputs
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [recording, setRecording] = useState(false);

  const t = traffic.data ?? null;
  const p = plateau.data ?? null;
  const verdict = useMemo(() => computeLeakVerdict(p, t), [p, t]);

  const routes = t?.routes ?? [];
  const total = t?.requestsSinceBoot ?? 0;
  const routesArmed = t?.routes != null;
  const { selfPct, residual, profileNext } = useMemo(
    () => computeKnownSelf(routes, total, routesArmed),
    [routes, total, routesArmed],
  );
  const residualPerMin =
    residual != null && t && t.uptimeSec > 0 ? Math.round((residual / t.uptimeSec) * 60) : null;
  const climbMb = p?.stats?.climbMb ?? null;
  const bootMin = t && t.uptimeSec > 0 ? t.uptimeSec / 60 : null;
  const climbPerMin = climbMb != null && bootMin ? climbMb / bootMin : null;
  const mbPer1k = climbMb != null && total > 0 ? climbMb / (total / 1000) : null;
  const recordable = climbMb != null && t?.counterArmed === true && t?.requestsSinceBoot != null;

  // R89 — the ritual affordance: the trend strip's chip names the gap (ONE
  // reading on the live boot), and THIS button is what closes it. The ledger
  // query is already here (same queryKey — one fetch, two readers), so the
  // block knows the same truth the chip does and the button can say so: a
  // due state lights the closer amber-pulsing instead of leaving the
  // operator to connect a chip in one header to a button in another.
  const livePid = t?.pid ?? null;
  const liveLedgerRows =
    livePid != null ? (ledger.data?.ledger.rows ?? []).filter((r) => r.bootPid === livePid) : [];
  const ritualDue = liveLedgerRows.length === 1;
  const ritualCloseable = ritualDue && recordable;

  // R80 — RECORD READING: the client sends NO numbers. The server re-reads
  // the plateau scope and its own traffic counter and classifies through the
  // shared tier engine; this button only triggers that reading and relays
  // what came back (a row, a 409 cooldown, or an honest refusal).
  async function recordReading() {
    setRecording(true);
    try {
      const res = await fetch("/api/guardian/verdict-ledger", { method: "POST" });
      const json = (await res.json()) as {
        ok: boolean;
        row?: VerdictReadingRow;
        ledgerTotal?: number;
        error?: string;
        retryableAfterSec?: number;
      };
      if (!res.ok || !json.ok) {
        if (res.status === 409) {
          toast.warning("READING NOT RECORDED — COOLDOWN", {
            description: `${json.error}${json.retryableAfterSec != null ? ` · retry in ~${json.retryableAfterSec}s` : ""}`,
          });
        } else {
          toast.error("READING NOT RECORDED", { description: json.error ?? `HTTP ${res.status}` });
        }
        return;
      }
      const row = json.row!;
      toast.success(`READING RECORDED · ${row.kind.toUpperCase().replace("-", " ")}`, {
        description: `${row.mbPer1k != null ? `${row.mbPer1k.toFixed(2)} MB/1K REQ` : `CLIMB ${row.climbMb > 0 ? "+" : ""}${row.climbMb} MB`} · boot pid ${row.bootPid} · ledger ${json.ledgerTotal ?? "?"} row(s)`,
      });
      void queryClient.invalidateQueries({ queryKey: ["guardian-verdict-ledger"] });
    } catch (e) {
      toast.error("READING NOT RECORDED", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setRecording(false);
    }
  }

  async function copyVerdict() {
    if (!verdict) return;
    const lines = [
      `VVU LEAK VERDICT — ${t?.sampledAtUtc ?? new Date().toISOString()}`,
      `verdict: ${verdict.headline}`,
      `detail: ${verdict.detail}`,
      climbMb != null
        ? `climb this boot: ${climbMb > 0 ? "+" : ""}${climbMb} MB (boot boundary ${p?.stats?.bootStart ?? "window-only"})`
        : "climb: n/a",
      t
        ? `traffic: ${(total ?? 0).toLocaleString()} req since boot · ${t.reqPerMin ?? "—"} req/min · uptime ${uptimeLabel(t.uptimeSec)} · pid ${t.pid}`
        : "traffic: n/a",
      mbPer1k != null ? `ratio: ${mbPer1k.toFixed(2)} MB per 1k requests` : "ratio: n/a",
      routesArmed
        ? `known-self: ${selfPct ?? "—"}% of top-24 buckets · residual ${residual ?? 0} req (${residualPerMin ?? "—"}/min)${profileNext ? ` · profile next: ${profileNext.key} (${profileNext.count} req)` : ""}`
        : "per-route ledger: arms at the next boot (this process predates R77 instrumentation)",
      "note: tiers are a first calibration — re-read as boots accumulate; the raw numbers above are the evidence",
    ];
    try {
      await navigator.clipboard.writeText(lines.filter(Boolean).join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      toast.success("LEAK VERDICT ON THE CLIPBOARD", {
        description: verdict.headline,
      });
    } catch {
      toast.error("CLIPBOARD WRITE FAILED", {
        description: "the browser refused clipboard access — copy the verdict by hand",
      });
    }
  }

  return (
    <div
      className="mt-3 rounded-sm border border-[#00d4e0]/25 bg-[#00d4e0]/5 p-3"
      data-testid="leak-verdict"
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <p className="vvu-label text-[8px] font-bold tracking-[0.22em] text-[#00d4e0]/80 inline-flex items-center gap-1.5">
          <Scale className="size-3" aria-hidden />
          LEAK VERDICT · CLIMB × TRAFFIC — THE ATTRIBUTION READ
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {verdict.windowOnly && climbMb != null && (
            <span
              className="vvu-label text-[8px] font-bold px-1.5 py-0.5 rounded-sm border border-[#e0a030]/50 text-[#e0a030] bg-black/30"
              title="no boot boundary inside the scope window — the climb spans the tail of a boot (or several), so the read is window-scoped, not boot-scoped"
            >
              WINDOW-ONLY
            </span>
          )}
          {t?.counterArmed && (
            <span
              className="vvu-label text-[8px] px-1.5 py-0.5 rounded-sm border border-[#3a4530] text-[#7a8a6e] bg-black/30 tabular-nums"
              title={`boot pid ${t.pid} · uptime ${uptimeLabel(t.uptimeSec)} — both sides of the ratio reset at this same boundary`}
            >
              BOOT PID {t.pid}
            </span>
          )}
          <button
            type="button"
            onClick={() => void copyVerdict()}
            aria-live="polite"
            aria-label={copyVerdictAria(copied)}
            className={`vvu-label inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-[9px] font-bold cursor-pointer transition-[filter,border-color,color] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00] ${
              copied
                ? "border-[#c8ff00]/70 bg-[#c8ff00]/10 text-[#c8ff00] shadow-[0_0_6px_rgba(200,255,0,0.2)]"
                : "border-[#00d4e0]/50 bg-black/40 text-[#00d4e0] hover:bg-[#00d4e0]/15"
            }`}
            title="copy the verdict with its raw numbers — paste-ready for the leak-hunt log. R187 · THE COPIED HANDS: the offer and its arrival ride the aria — the clipboard's honesty spoken, heard without hovering."
          >
            {copied ? (
              <Check className="size-3" aria-hidden />
            ) : (
              <Copy className="size-3" aria-hidden />
            )}
            {copied ? "COPIED" : "COPY VERDICT"}
          </button>
          <button
            type="button"
            onClick={() => void recordReading()}
            disabled={recording || !recordable}
            aria-live="polite"
            aria-label={
              recording
                ? recordFlightAria()
                : recordReadingAria({
                    recordable,
                    ritualCloseable,
                    bootPid: livePid,
                    missingClimb: climbMb == null,
                    missingCounter: t?.counterArmed !== true || t?.requestsSinceBoot == null,
                  })
            }
            className={`vvu-label inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-[9px] font-bold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00d4e0] enabled:cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-[colors,box-shadow] ${
              ritualCloseable
                ? "border-[#e0a030]/70 bg-[#e0a030]/10 text-[#e0a030] shadow-[0_0_6px_rgba(224,160,48,0.3)] hover:bg-[#e0a030]/25"
                : "border-[#00d4e0]/50 bg-[#00d4e0]/10 text-[#00d4e0] enabled:hover:bg-[#00d4e0]/25"
            }`}
            title={
              (recordable
                ? ritualCloseable
                  ? "the ritual chip says boot " +
                    livePid +
                    " holds ONE reading — THIS is the closer: recording now completes its settle pair (the client sends no numbers; the server recomputes the reading from its own sources; 60s cooldown per boot)"
                  : "record this moment as a ledger row — the SERVER recomputes the reading from its own sources (the client sends no numbers); 60s cooldown per boot"
                : "no reading to record yet — the row needs a boot-scoped climb AND an armed traffic counter") +
              " R188 · THE STATE\u2019S WHY: the offer, the ritual, and the refusal\u2019s own reason ride the aria — heard without hovering."
            }
          >
            {recording ? (
              <Loader2 className="size-3 animate-spin" aria-hidden />
            ) : (
              <>
                {ritualCloseable && (
                  <span
                    className="inline-block size-1.5 rounded-full bg-[#e0a030] vvu-pulse"
                    aria-hidden
                  />
                )}
                <DatabaseBackup className="size-3" aria-hidden />
              </>
            )}
            {recording ? "RECORDING…" : "RECORD READING"}
          </button>
        </div>
      </div>

      {(plateau.isPending || traffic.isPending) && (
        <div className="mt-2.5 space-y-1.5">
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-4 w-full" />
        </div>
      )}

      {(plateau.isError || traffic.isError) && (
        <p className="vvu-label text-[9px] text-[#e5484d] mt-2.5" role="alert">
          VERDICT FEED ERROR — {plateau.isError ? plateau.error.message : traffic.error?.message}
        </p>
      )}

      {verdict && !plateau.isPending && !traffic.isPending && (
        <>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span
              role="status"
              className={`vvu-label text-[10px] font-bold px-2.5 py-1.5 rounded-sm border inline-flex items-center gap-1.5 ${verdictToneClasses(verdict.tone)}`}
              title={`${verdict.detail} — tiers are a first calibration (climb ≤8MB flat · <150 requests too few · ≥50 MB/1k tracked · <5 not-tracked), re-read as boots accumulate`}
            >
              <Scale className="size-3.5" aria-hidden />
              {verdict.headline}
            </span>
          </div>
          <p className="vvu-label text-[9px] text-[#c9d4bd] leading-relaxed mt-1.5">
            {verdict.detail}
          </p>

          {/* the ratio row — the block's evidence numbers */}
          <div className="mt-2.5 flex flex-wrap items-stretch gap-2">
            {climbMb != null && (
              <div
                className="flex-1 min-w-[128px] rounded-sm border border-[#3a4530] bg-black/30 px-2.5 py-1.5"
                title={`RSS change across ${verdict.windowOnly ? "the scope window (no boot boundary inside it)" : "the current boot — cut at the journal's own boot boundary"}${p?.stats?.bootPids?.[0] != null ? ` · boot pids ${p.stats.bootPids[0]}${p.stats.bootPids[1] != null && p.stats.bootPids[1] !== p.stats.bootPids[0] ? ` → ${p.stats.bootPids[1]}` : ""}` : ""}`}
              >
                <p className="vvu-label text-[8px] text-[#7a8a6e]">
                  {verdict.windowOnly ? "WINDOW CLIMB" : "CLIMB THIS BOOT"}
                </p>
                <p className="font-mono text-[15px] text-[#c8ff00] tabular-nums leading-tight">
                  {climbMb > 0 ? "+" : ""}
                  {climbMb} <span className="text-[10px] text-[#7a8a6e]">MB</span>
                  {climbPerMin != null && (
                    <span className="text-[9px] text-[#7a8a6e]">
                      {" "}
                      · {climbPerMin >= 10 ? climbPerMin.toFixed(0) : climbPerMin.toFixed(1)} MB/MIN
                    </span>
                  )}
                </p>
              </div>
            )}
            {t?.counterArmed && (
              <div
                className="flex-1 min-w-[128px] rounded-sm border border-[#3a4530] bg-black/30 px-2.5 py-1.5"
                title={`${(total ?? 0).toLocaleString()} requests since boot · ${t.reqPerMin ?? "—"} req/min · includes the console's own polling and the mesh's self-probes — the known-self share is subtracted below before attribution`}
              >
                <p className="vvu-label text-[8px] text-[#7a8a6e]">TRAFFIC SINCE BOOT</p>
                <p className="font-mono text-[15px] text-[#00d4e0] tabular-nums leading-tight">
                  {(total ?? 0).toLocaleString()}{" "}
                  <span className="text-[10px] text-[#7a8a6e]">REQ</span>
                  <span className="text-[9px] text-[#7a8a6e]"> · {t.reqPerMin ?? "—"}/MIN</span>
                </p>
              </div>
            )}
            {mbPer1k != null && (
              <div
                className="flex-1 min-w-[128px] rounded-sm border border-[#00d4e0]/30 bg-black/40 px-2.5 py-1.5"
                title="the attribution ratio: boot climb ÷ requests since boot, per thousand — the number the verdict tiers read; both sides reset at the same boot boundary"
              >
                <p className="vvu-label text-[8px] text-[#7a8a6e]">MB / 1K REQ</p>
                <p className="font-mono text-[15px] text-[#00d4e0] tabular-nums leading-tight">
                  {mbPer1k.toFixed(2)}
                </p>
              </div>
            )}
            {selfPct != null && (
              <div
                className="flex-1 min-w-[128px] rounded-sm border border-[#3a4530] bg-black/30 px-2.5 py-1.5"
                title={`share of the top-24 buckets the estate itself generates: the console's eight timer pollers + the safegrid health probe + the telemetry/ledger posts — subtracted FIRST, because the watchman is part of the traffic it watches. Residual ${residual ?? 0} req (${residualPerMin ?? "—"}/min) is all the traffic that could carry attribution`}
              >
                <p className="vvu-label text-[8px] text-[#7a8a6e]">KNOWN-SELF</p>
                <p className="font-mono text-[15px] text-[#7a8a6e] tabular-nums leading-tight">
                  {selfPct}%
                  <span className="text-[9px] text-[#5f6e55]">
                    {" "}
                    · {residualPerMin ?? "—"}/MIN LEFT
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* profile-next — the verdict's actionable hand-off */}
          {routesArmed && profileNext && (
            <div
              className="mt-2 rounded-sm border border-[#3a4530] bg-black/30 px-2 py-1.5 flex items-center gap-2"
              title="the busiest traffic the estate itself does NOT generate — the first profile target if the verdict reads request-tracked"
            >
              <Crosshair className="size-3 shrink-0 text-[#f3e38a]" aria-hidden />
              <p className="vvu-label text-[8px] text-[#7a8a6e] shrink-0">PROFILE NEXT</p>
              <span
                className={`shrink-0 vvu-label text-[8px] font-bold px-1.5 py-0.5 rounded-sm border ${methodChip(profileNext.key.slice(0, profileNext.key.indexOf(" ")))}`}
              >
                {profileNext.key.slice(0, profileNext.key.indexOf(" "))}
              </span>
              <span className="flex-1 min-w-0 truncate font-mono text-[10px] text-[#c9d4bd]">
                {profileNext.key.slice(profileNext.key.indexOf(" ") + 1)}
              </span>
              <span className="shrink-0 font-mono text-[9px] text-[#c8ff00] tabular-nums">
                {(profileNext?.count ?? 0).toLocaleString()}
              </span>
              <span className="shrink-0 vvu-label text-[8px] text-[#7a8a6e] tabular-nums">
                {total > 0 ? ((profileNext.count / total) * 100).toFixed(1) : "0.0"}%
              </span>
            </div>
          )}
          {routesArmed && !profileNext && routes.length > 0 && (
            <p className="vvu-label text-[8px] text-[#7a8a6e] mt-2">
              EVERY BUCKET IN THE TOP-24 IS KNOWN-SELF TRAFFIC — nothing left to profile yet; the
              residual fills as real usage arrives.
            </p>
          )}
          {!routesArmed && t?.counterArmed && (
            <p className="vvu-label text-[8px] text-[#e0a030] mt-2">
              THE WHO JOINS AT THE NEXT BOOT — this process predates R77&apos;s per-route ledger;
              the verdict runs on totals only, and PROFILE NEXT / KNOWN-SELF appear the moment the
              buckets arm.
            </p>
          )}
        </>
      )}

      {/* R80 — THE TREND: recorded readings, boot N vs boot N+1. One boot's
             ratio is a reading; the trend of the ratio across boots is the
             signal. Rows are SERVER-computed at record time. */}
      <VerdictTrendStrip
        ledger={ledger.data ?? null}
        ledgerError={ledger.error ?? null}
        ledgerPending={ledger.isPending}
        onReread={() => void ledger.refetch()}
        rereading={ledger.isFetching}
        livePid={t?.pid ?? null}
        projection={guardian.data?.railProjection ?? null}
        memSeries={guardian.data?.guardian?.memSeries ?? null}
        guardMb={guardian.data?.guardian?.guardMb ?? null}
        bootSinceMs={
          guardian.data?.guardian?.lastBounceAtUtc
            ? parseGuardianStampMs(guardian.data.guardian.lastBounceAtUtc)
            : null
        }
      />

      <p
        className="vvu-label text-[8px] text-[#7a8a6e] leading-relaxed mt-2"
        title="the leak hunt's reading contract: boot-scoped climb × boot-scoped requests, known-self subtracted first, tiers disclosed as calibration"
      >
        R78 ATTRIBUTION READ · BOOT-SCOPED CLIMB (THE JOURNAL&apos;S OWN BOUNDARY) × REQUESTS SINCE
        BOOT (THE SAME BOUNDARY BY DESIGN). KNOWN-SELF TRAFFIC IS SUBTRACTED FIRST — THE WATCHMAN IS
        PART OF WHAT IT WATCHES. THE TIERS ARE A FIRST CALIBRATION, NOT A LAW: THE RAW NUMBERS ARE
        THE EVIDENCE, AND THE VERDICT IS RE-READ AS BOOTS ACCUMULATE.
      </p>
    </div>
  );
}

// ── small local atom (dim label + tabular value) ────────────────────────────

/** R90 — honest downtime formatting: sub-minute reads as seconds, a minute
 *  or more reads as m+s. The journal's toFixed(1)s grammar, extended. */
function fmtMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

// R92 — minutes formatting for the reliability ledger (MTBF, calm streaks,
// storm gaps). Under an hour reads as minutes; above it reads as hours with
// one decimal — the same honest-dash grammar as fmtMs.
function fmtMin(min: number | null | undefined): string {
  if (min == null || !Number.isFinite(min) || min < 0) return "—";
  if (min < 60) return `${min < 10 ? min.toFixed(1) : Math.round(min)}m`;
  return `${(min / 60).toFixed(1)}h`;
}

function LabelValue({
  label,
  value,
  tone = "dim",
  mono = false,
  title,
}: {
  label: string;
  value: string;
  tone?: "dim" | "lime" | "red" | "amber";
  mono?: boolean;
  title?: string;
}) {
  return (
    <span
      className="inline-flex items-baseline gap-1.5 vvu-label text-[8px] text-[#7a8a6e]"
      title={title}
    >
      {label}
      <span
        className={`tabular-nums ${mono ? "font-mono text-[9px]" : "text-[9px]"} ${
          tone === "lime"
            ? "text-[#c8ff00]"
            : tone === "red"
              ? "text-[#e5484d]"
              : tone === "amber"
                ? "text-[#e0a030]"
                : "text-[#c9d4bd]"
        }`}
      >
        {value}
      </span>
    </span>
  );
}

// ── R62 · proximity sentinel section — the integrity rail, estate-wide ──────

function ProximitySentinelSection({
  rail,
  pending,
}: {
  rail: WatchdogRail | null;
  pending: boolean;
}) {
  const d = rail?.detail;
  const broken = rail !== null && rail.ok === false;
  const alarmCount = d?.alarmCount ?? 0;
  const alarms = d?.alarms ?? [];
  const s = d?.sentinel;
  const sentinelTone = broken ? "red" : s?.running ? "lime" : "amber";

  return (
    <section
      className={`vvu-panel p-4 sm:p-6 ${broken ? "!border-[#e5484d]/50" : ""}`}
      aria-labelledby="watchdog-prox-h"
      role={broken ? "alert" : undefined}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <span className="inline-block size-1.5 bg-[#2ea8a0]" aria-hidden />
          <h2
            id="watchdog-prox-h"
            className="vvu-label text-[8px] font-bold tracking-[0.22em] text-[#7a8a6e]"
          >
            PROXIMITY · RECORD LAYER SENTINEL · WORM CHAIN INTEGRITY
          </h2>
        </div>
        <a
          href="#/records"
          className="vvu-label text-[10px] font-bold min-h-[44px] inline-flex items-center gap-1.5 px-3 rounded-sm border border-[#2ea8a0]/50 text-[#7fd4cd] hover:bg-[#2ea8a0]/10 transition-[color,background-color,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2ea8a0] hover:shadow-[0_0_6px_rgba(46,168,160,0.25)]"
          title="open the proximity record layer workspace (its WATCHDOG tab has the full sentinel console)"
        >
          OPEN PROXIMITY WATCHDOG
          <span aria-hidden>→</span>
        </a>
      </div>

      {pending ? (
        <div className="mt-3 space-y-2.5">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </div>
      ) : !rail || !d ? (
        <p className="vvu-label text-[9px] text-[#e0a030] mt-3">
          PROXIMITY RAIL NOT IN THIS PROBE — THE RAIL ROW ABOVE IS THE HONEST STATE
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {/* verdict strip — the walker's word, this probe */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={`vvu-label text-[10px] font-bold px-2.5 py-1.5 rounded-sm border inline-flex items-center gap-1.5 ${
                rail.ok
                  ? "border-[#c8ff00]/60 text-[#c8ff00] bg-[#c8ff00]/10"
                  : "border-[#e5484d]/60 text-[#e5484d] bg-[#e5484d]/10"
              }`}
              title={
                rail.ok ? `head ${(d.headHash ?? "—").slice(0, 20)}…` : (d.reason ?? undefined)
              }
            >
              {rail.ok ? (
                <ShieldCheck className="size-3.5" aria-hidden />
              ) : (
                <ShieldAlert className="size-3.5" aria-hidden />
              )}
              {rail.ok ? "CHAIN VALID" : `BROKEN AT ${d.brokenAt ?? "?"}`}
            </span>
            <LabelValue
              label="RECORDS"
              value={String(d.records ?? "—")}
              tone={rail.ok ? "lime" : "red"}
            />
            <LabelValue
              label="HEAD POS"
              value={d.headPosition != null ? `#${d.headPosition}` : "—"}
            />
            <LabelValue
              label="WALK LATENCY"
              value={`${rail.latencyMs}ms`}
              mono
              tone={rail.latencyMs > 1000 ? "amber" : "dim"}
            />
            <LabelValue
              label="SENTINEL"
              value={
                s?.killSwitch
                  ? "KILL SWITCH"
                  : s?.running
                    ? `ON WATCH · ${Math.round(s.intervalMs / 1000)}S`
                    : "DISARMED"
              }
              tone={sentinelTone}
            />
            <LabelValue
              label="VALID STREAK"
              value={s ? `${s.consecutiveValid} passes` : "—"}
              title={
                s
                  ? `${s.totalPasses} total passes since boot · last seen head #${s.lastSeenHeadPosition ?? "—"}`
                  : undefined
              }
            />
            <LabelValue
              label="ALARM RAIL"
              value={`${alarmCount} on disk`}
              tone={alarmCount > 0 ? "amber" : "dim"}
            />
          </div>

          {/* active fault — the walker's reason, verbatim */}
          {broken && (
            <p className="font-mono text-[9px] text-[#e5484d] border border-[#e5484d]/40 bg-[#e5484d]/5 rounded-sm px-2.5 py-2 break-all">
              ACTIVE FAULT · {d.brokenAt ?? "chain"} —{" "}
              {d.reason ?? "stored bytes no longer match their digests"}. RESTORE THE RECORDS, THEN
              LET THE NEXT SENTINEL PASS CLEAR THE ALARM.
            </p>
          )}

          {/* the append-only alarm rail — historical evidence, never edited */}
          <div>
            <p className="vvu-label text-[8px] text-[#7a8a6e] mb-1.5">
              ALARM RAIL · APPEND-ONLY · vvu-trust/chains/proximity-alarms.jsonl
            </p>
            {alarms.length === 0 ? (
              <p className="font-mono text-[9px] text-[#7a8a6e]">
                no alarms on the rail — every scheduled walk has matched the sealed bytes
              </p>
            ) : (
              <ul className="space-y-1.5">
                {alarms.map((a) => (
                  <li
                    key={a.seq}
                    className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-sm border px-2.5 py-1.5 ${
                      a.kind === "CHAIN_SHORTENED"
                        ? "border-[#e0a030]/40 bg-[#e0a030]/5"
                        : "border-[#e5484d]/40 bg-[#e5484d]/5"
                    }`}
                    title={a.reason ?? undefined}
                  >
                    <span className="vvu-label text-[8px] text-[#7a8a6e] tabular-nums">
                      #{a.seq}
                    </span>
                    <span
                      className={`vvu-label text-[8px] font-bold px-1.5 py-0.5 rounded-sm border ${
                        a.kind === "CHAIN_SHORTENED"
                          ? "border-[#e0a030]/50 text-[#e0a030]"
                          : "border-[#e5484d]/50 text-[#e5484d]"
                      }`}
                    >
                      {a.kind === "CHAIN_SHORTENED" ? "DELETION" : "TAMPER"}
                    </span>
                    <span className="font-mono text-[9px] text-[#c9d4bd]">{a.brokenAt ?? "—"}</span>
                    <span
                      className="font-mono text-[9px] text-[#7a8a6e] truncate max-w-[16rem]"
                      title={a.reason ?? undefined}
                    >
                      {a.reason ?? ""}
                    </span>
                    <span className="vvu-label text-[8px] text-[#7a8a6e] tabular-nums ml-auto">
                      {stamp(a.raisedAtUtc)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="vvu-label text-[8px] text-[#7a8a6e] leading-relaxed max-w-3xl">
            THE RAIL IS PROBED IN-PROCESS — A READ-ONLY WALK OF THE STORED BYTES, NOT AN HTTP PING.
            THIS PROBE RAISES NO ALARMS AND WRITES NO HISTORY; ONLY THE 30S SENTINEL SCHEDULE DOES.
            ALARMS ARE EVIDENCE: APPEND-ONLY, NEVER EDITED, SURVIVE RESTARTS.
          </p>
        </div>
      )}
    </section>
  );
}

// ── R63 · PWA shell cache — the browser-side half of self-integrity ─────────

// ── R75 · FLEET HEALTH BOARD ────────────────────────────────────────────────
// The six mini-services (:3003-:3008) + the :3000 surface itself were only
// ever visible to the cron health check — the dashboard probed its own
// rails but never showed the fleet AS a fleet. This board does, with the
// honesty rules baked in: a root 404 on a pure-API service is the DESIGNED
// answer (encoded as expectation in the registry), a DOWN is shown DOWN
// with the real error string, and an ODD answer (healthy-looking but not
// what the service's own source says it should answer) is reported, never
// smoothed over.

function latencyTone(ms: number, verdict: "OK" | "DOWN" | "ODD"): "lime" | "amber" | "red" | "dim" {
  if (verdict === "DOWN") return "red";
  if (ms > 150) return "amber"; // localhost answering slower than 150ms is worth a raised eyebrow
  if (ms <= 25) return "lime";
  return "dim";
}

function FleetBoardBlock() {
  const fleet = useFleetQuery();
  const data = fleet.data;

  // R76 — the restart state machine, ONE action at a time (the route
  // enforces the same server-side): idle → confirm (5s window, auto-disarm)
  // → running (POST) → result strip + refetch. :3000 never enters the
  // machine — its row renders the guardian's claim instead.
  const [rsPort, setRsPort] = useState<number | null>(null);
  const [rsPhase, setRsPhase] = useState<"idle" | "confirm" | "running">("idle");
  const [rsElapsed, setRsElapsed] = useState(0);
  const [rsResult, setRsResult] = useState<FleetRestartResult | null>(null);
  const rsConfirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rsTickTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (rsConfirmTimer.current) clearTimeout(rsConfirmTimer.current);
      if (rsTickTimer.current) clearInterval(rsTickTimer.current);
    };
  }, []);

  function armRestart(port: number) {
    if (rsPhase !== "idle") return;
    setRsPort(port);
    setRsPhase("confirm");
    rsConfirmTimer.current = setTimeout(() => {
      setRsPhase("idle");
      setRsPort(null);
    }, ARMED_WINDOW_MS);
  }

  function disarmRestart() {
    if (rsConfirmTimer.current) clearTimeout(rsConfirmTimer.current);
    setRsPhase("idle");
    setRsPort(null);
  }

  async function runRestart(port: number) {
    if (rsPhase === "running") return;
    if (rsConfirmTimer.current) clearTimeout(rsConfirmTimer.current);
    setRsPhase("running");
    setRsElapsed(0);
    rsTickTimer.current = setInterval(() => setRsElapsed((s) => s + 1), 1000);
    try {
      const res = await fetch("/api/fleet/restart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ port }),
        cache: "no-store",
      });
      const json = (await res.json()) as {
        ok: boolean;
        refused?: boolean;
        reason?: string;
        detail?: string;
        result?: FleetRestartResult;
      };
      if (json.refused) {
        toast.warning(
          `RESTART REFUSED · ${(json.reason ?? "guard").toUpperCase().replace(/-/g, " ")}`,
          {
            description: json.detail ?? "the guard refused the restart — read the reason",
          },
        );
      } else if (json.result?.ok) {
        const r = json.result;
        toast.success(`FLEET RESTART LANDED · :${port}`, {
          description: `pid ${r.oldPid ?? "?"} → ${r.newPid ?? "?"} · downtime ${((r.downtimeMs ?? 0) / 1000).toFixed(1)}s · root HTTP ${r.httpStatus ?? "?"} — journaled, the chronicle carries it`,
        });
        setRsResult(r);
      } else {
        const r = json.result;
        toast.error(`FLEET RESTART FAILED · :${port}`, {
          description: r?.error ?? "the restart did not land — the journal row carries the attempt",
        });
        setRsResult(r ?? null);
      }
    } catch (e) {
      toast.error("RESTART DISPATCH FAILED", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      if (rsTickTimer.current) clearInterval(rsTickTimer.current);
      setRsPhase("idle");
      setRsPort(null);
      void fleet.refetch();
    }
  }

  const summaryChip = data
    ? data.summary.down > 0 || data.summary.odd > 0
      ? {
          cls: "border-[#e5484d]/60 text-[#e5484d]",
          label: `FLEET DEGRADED · ${data.summary.ok}/${data.summary.total} OK`,
          title:
            data.summary.down > 0
              ? "one or more sibling services did not answer — the red rows carry the real error strings"
              : "every service answered, but at least one answered something OTHER than what its own source says it should — read the amber rows",
        }
      : {
          cls: "border-[#c8ff00]/50 text-[#c8ff00]",
          label: `FLEET UP · ${data.summary.total}/${data.summary.total}`,
          title:
            "every service answered exactly what its own source says it should answer at the root",
        }
    : null;

  return (
    <section className="vvu-panel p-4 sm:p-6" aria-labelledby="fleet-h">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="vvu-label text-[10px] text-[#8fd0ff] border border-[#8fd0ff]/40 px-2 py-0.5">
              TASK 41 · SIBLING SERVICES
            </span>
            {summaryChip && (
              <span
                className={`vvu-label text-[9px] px-2 py-0.5 rounded border ${summaryChip.cls}`}
                title={summaryChip.title}
              >
                {summaryChip.label}
              </span>
            )}
          </div>
          <h2
            id="fleet-h"
            className="vvu-label text-lg sm:text-xl font-bold text-[#f3e38a] tracking-[0.18em] mt-2"
          >
            FLEET · MINI-SERVICE HEALTH BOARD
          </h2>
          <p className="vvu-label text-[9px] sm:text-[10px] text-[#7a8a6e] mt-1 max-w-3xl leading-relaxed">
            THE :3000 SURFACE AND ITS SIX SIBLINGS, ROOT-PROBED SERVER-SIDE AGAINST A REGISTRY BUILT
            FROM EACH SERVICE&apos;S OWN SOURCE. A HEALTHY 404 IS NOT DRESSED UP AS AN ERROR.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void fleet.refetch()}
            disabled={fleet.isFetching}
            className="min-h-[44px] vvu-label text-[10px] font-bold border-[#6b8a40]/50 text-[#c9d4bd] hover:bg-[#8fb35a]/10 hover:text-[#c8ff00] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00]"
          >
            {fleet.isFetching ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-3.5" aria-hidden />
            )}
            PROBE FLEET
          </Button>
          <span className="vvu-label text-[8px] text-[#7a8a6e] tabular-nums">
            {data
              ? `PROBED ${stamp(data.probedAtUtc)}`
              : fleet.isPending
                ? "PROBING THE FLEET…"
                : "—"}
          </span>
        </div>
      </div>

      {fleet.error && (
        <div className="mt-4 rounded-sm border border-[#e5484d]/50 bg-[#e5484d]/5 px-2.5 py-2">
          <p className="vvu-label text-[10px] font-bold text-[#e5484d]">
            FLEET PROBE UNAVAILABLE — NO BOARD SHOWN
          </p>
          <p className="font-mono text-[9px] text-[#e5484d] break-all mt-1">
            {fleet.error.message}
          </p>
        </div>
      )}

      {fleet.isPending && (
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-9 w-full rounded-sm" />
          ))}
        </div>
      )}

      {data && (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse font-mono text-[8.5px] text-[#c9d4bd]">
              <thead>
                <tr className="text-left vvu-label text-[8px] text-[#5f6e55]">
                  <th scope="col" className="font-normal py-1.5 pr-2 border-b border-[#2a3324]">
                    PORT
                  </th>
                  <th scope="col" className="font-normal py-1.5 pr-2 border-b border-[#2a3324]">
                    SERVICE
                  </th>
                  <th
                    scope="col"
                    className="font-normal py-1.5 pr-2 border-b border-[#2a3324] hidden md:table-cell"
                  >
                    ROLE
                  </th>
                  <th scope="col" className="font-normal py-1.5 pr-2 border-b border-[#2a3324]">
                    ROOT
                  </th>
                  <th
                    scope="col"
                    className="font-normal py-1.5 pr-2 border-b border-[#2a3324] text-right"
                  >
                    LATENCY
                  </th>
                  <th
                    scope="col"
                    className="font-normal py-1.5 pr-2 border-b border-[#2a3324] text-right"
                  >
                    VERDICT
                  </th>
                  <th
                    scope="col"
                    className="font-normal py-1.5 border-b border-[#2a3324] text-right"
                  >
                    OPS
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => {
                  const down = r.verdict === "DOWN";
                  const odd = r.verdict === "ODD";
                  const tone = latencyTone(r.latencyMs, r.verdict);
                  return (
                    <tr
                      key={r.port}
                      title={
                        r.note ??
                        (r.kind === "surface"
                          ? "the dev server itself — the guardian watches this one"
                          : `expected root answer: HTTP ${r.expectedRootStatus} — from the service's own source, not a guess`)
                      }
                      className={`transition-colors duration-150 border-b border-[#2a3324]/60 ${down ? "bg-[#e5484d]/[0.06]" : "hover:bg-[#8fb35a]/[0.05]"}`}
                    >
                      <td className="py-1.5 pr-2 tabular-nums text-[#e6e0c8]">:{r.port}</td>
                      <td className="py-1.5 pr-2">
                        <span className="vvu-label font-bold text-[9px] text-[#e6e0c8]">
                          {r.name}
                        </span>
                        <span className="text-[#5f6e55]"> · {r.service}</span>
                      </td>
                      <td className="py-1.5 pr-2 text-[#8a9a7e] hidden md:table-cell max-w-[240px] truncate">
                        {r.role}
                      </td>
                      <td className="py-1.5 pr-2 tabular-nums">
                        {r.httpStatus != null ? (
                          <span className={odd ? "text-[#e0a030]" : "text-[#c9d4bd]"}>
                            HTTP {r.httpStatus}
                            <span className="text-[#5f6e55]"> / exp {r.expectedRootStatus}</span>
                          </span>
                        ) : (
                          <span className="text-[#e5484d]">no answer</span>
                        )}
                      </td>
                      <td
                        className={`py-1.5 pr-2 text-right tabular-nums ${
                          tone === "lime"
                            ? "text-[#c8ff00]"
                            : tone === "amber"
                              ? "text-[#e0a030]"
                              : tone === "red"
                                ? "text-[#e5484d]"
                                : "text-[#8a9a7e]"
                        }`}
                      >
                        {r.latencyMs}ms
                      </td>
                      <td className="py-1.5 pr-2 text-right">
                        <span
                          className={`vvu-label inline-flex items-center gap-1.5 text-[8px] font-bold px-1.5 py-0.5 rounded-sm border ${
                            down
                              ? "border-[#e5484d]/60 text-[#e5484d] bg-[#e5484d]/10"
                              : odd
                                ? "border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10"
                                : "border-[#c8ff00]/50 text-[#c8ff00] bg-[#c8ff00]/5"
                          }`}
                        >
                          {/* the pulse marks ALIVE, not perfection — an ODD
                              verdict is answered-but-wrong, so it does not
                              pulse; reduced-motion operators get the same
                              dot, static (globals.css R71 contract) */}
                          <span
                            aria-hidden
                            className={`size-1.5 rounded-full ${
                              down
                                ? "bg-[#e5484d]"
                                : odd
                                  ? "bg-[#e0a030]"
                                  : "bg-[#c8ff00] vvu-pulse"
                            }`}
                          />
                          {r.verdict}
                        </span>
                      </td>
                      <td className="py-1.5 text-right">
                        {r.port === 3000 ? (
                          <span
                            className="vvu-label text-[8px] font-bold text-[#5f6e55]"
                            title="the guardian owns :3000 — the console may not bounce it (drill control lives in the footprint block below)"
                          >
                            GUARDIAN
                          </span>
                        ) : rsPhase === "running" && rsPort === r.port ? (
                          <span
                            className="vvu-label inline-flex items-center gap-1 text-[8px] font-bold text-[#e0a030]"
                            aria-live="polite"
                            aria-label={restartFlightVoice(r.port)}
                            title={`R186 · THE ASKED HANDS: the flight speaks its state without the seconds — the elapsed count is the eyes' own show.`}
                          >
                            <Loader2 className="size-3 animate-spin" aria-hidden />
                            {rsElapsed}S
                          </span>
                        ) : rsPhase === "confirm" && rsPort === r.port ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (rsPort != null) void runRestart(rsPort);
                            }}
                            aria-label={restartVoice(r.port, true)}
                            title="click to CONFIRM — the restart fires NOW; do nothing and it disarms within 5s. R186 · THE ASKED HANDS: the ask and its escape window ride the aria — heard without hovering."
                            className="vvu-label text-[8px] font-bold px-1.5 py-1 rounded-sm border border-[#e5484d]/60 bg-[#e5484d]/10 text-[#e5484d] animate-pulse shadow-[0_0_8px_rgba(229,72,77,0.35)] cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00] min-h-[24px]"
                          >
                            CONFIRM?
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => armRestart(r.port)}
                            disabled={rsPhase !== "idle"}
                            aria-label={restartVoice(r.port, false)}
                            title={`controlled restart of :${r.port} — the guardian's own discipline (kill tree → port free → daemonize → wait for the healthy answer); journaled to the fourth ledger. R186 · THE ASKED HANDS: the offer and its ask ride the aria — the first click asks, heard without hovering.`}
                            className="vvu-label text-[8px] font-bold px-1.5 py-1 rounded-sm border border-[#3a4530] bg-black/30 text-[#7a8a6e] hover:border-[#e0a030]/60 hover:text-[#e0a030] disabled:opacity-40 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00] min-h-[24px] transition-colors"
                          >
                            RESTART
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {data.summary.down > 0 && (
            <div className="mt-2.5 space-y-1">
              {data.rows
                .filter((r) => r.verdict === "DOWN")
                .map((r) => (
                  <p key={r.port} className="font-mono text-[9px] text-[#e5484d] break-all">
                    :{r.port} {r.name} — {r.error ?? "unreachable"}
                  </p>
                ))}
            </div>
          )}

          {rsResult && (
            <div
              role="status"
              aria-live="polite"
              className={`mt-2.5 rounded-sm border px-2.5 py-2 font-mono text-[9px] vvu-audit-in ${
                rsResult.ok
                  ? "border-[#c8ff00]/40 bg-[#c8ff00]/5 text-[#c9d4bd]"
                  : "border-[#e5484d]/50 bg-[#e5484d]/5 text-[#e5484d]"
              }`}
            >
              LAST FLEET ACTION · {rsResult.ok ? "LANDED" : "FAILED"} · :{rsResult.port}{" "}
              {rsResult.name} · pid {rsResult.oldPid ?? "?"} → {rsResult.newPid ?? "?"} · downtime{" "}
              {rsResult.downtimeMs != null ? `${(rsResult.downtimeMs / 1000).toFixed(1)}s` : "—"} ·
              root {rsResult.httpStatus != null ? `HTTP ${rsResult.httpStatus}` : "—"} ·{" "}
              {rsResult.at}
              {rsResult.error ? ` · ${rsResult.error}` : ""}
            </div>
          )}

          <p className="mt-3 vvu-label text-[8px] text-[#7a8a6e] leading-relaxed max-w-3xl">
            THE REGISTRY IS STATIC AND HONEST — :3003 AND :3008 ARE PURE-API SERVICES WHOSE SOURCE
            SERVES NO ROOT ROUTE, SO THEIR HEALTHY ANSWER IS HTTP 404 AND THE BOARD SHOWS IT AS OK;
            AN HTTP 200 FROM THEM WOULD BE REPORTED AS ODD, NOT CELEBRATED. :3000 IS THE
            GUARDIAN&apos;S — ITS ROW CARRIES NO RESTART BUTTON. RESTARTS RUN THE GUARDIAN&apos;S
            OWN DISCIPLINE (IDENTIFY BY CWD → KILL TREE → REQUIRE PORT FREE → DAEMONIZE → WAIT FOR
            THE HEALTHY ANSWER), ONE AT A TIME WITH A 60S COOLDOWN, AND ARE JOURNALED TO
            VVU-TRUST/FLEET/ACTIONS.JSONL — THE FOURTH EVIDENCE LEDGER, WHICH THE CHRONICLE BELOW
            READS AS FLEET OPS. A PROBE ITSELF TOUCHES NOTHING.
          </p>
        </>
      )}
    </section>
  );
}

function PwaCacheBlock() {
  const [status, setStatus] = useState<SwStatus | null>(null);
  const [probed, setProbed] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [updateWaiting, setUpdateWaiting] = useState(false);

  useEffect(() => {
    let alive = true;
    void swStatus().then((s) => {
      if (!alive) return;
      setStatus(s);
      setProbed(true);
    });
    // a waiting worker = a newer shell is downloaded but not applied —
    // surface it persistently, not only via the one-time toast
    if (navigator.serviceWorker) {
      void navigator.serviceWorker.getRegistration().then((reg) => {
        if (alive && reg?.waiting && navigator.serviceWorker.controller) setUpdateWaiting(true);
      });
    }
    return () => {
      alive = false;
    };
  }, []);

  const totalEntries = status?.caches.reduce((n, c) => n + c.entries, 0) ?? 0;
  const version = status?.version ?? null;

  async function reset() {
    setResetting(true);
    try {
      const r = await swReset();
      if (r) {
        toast.success("PWA CACHE WIPED", {
          description: `${r.cleared.length} cache(s) cleared · ${r.primed} identity assets re-primed (${r.version}) — reloading into a fresh shell`,
        });
        setTimeout(() => window.location.reload(), 1400);
      } else {
        toast.error("PWA RESET UNAVAILABLE", {
          description: "no controlling service worker on this device — nothing to wipe",
        });
        setResetting(false);
      }
    } catch {
      toast.error("PWA RESET FAILED");
      setResetting(false);
    }
  }

  return (
    <div className="mt-4 rounded-sm border border-[rgba(107,138,64,0.25)] bg-black/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <p className="vvu-label text-[8px] font-bold tracking-[0.22em] text-[#7a8a6e]">
          PWA SHELL CACHE · THE BROWSER-SIDE HALF OF INTEGRITY
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => void reset()}
          disabled={resetting || !status}
          className="min-h-[36px] vvu-label text-[9px] font-bold border-[#6b8a40]/50 text-[#c9d4bd] hover:bg-[#8fb35a]/10 hover:text-[#c8ff00]"
        >
          {resetting ? (
            <Loader2 className="size-3 animate-spin" aria-hidden />
          ) : (
            <DatabaseBackup className="size-3" aria-hidden />
          )}
          {resetting ? "WIPING…" : "RESET PWA CACHE"}
        </Button>
      </div>

      {!probed ? (
        <div className="mt-2.5 space-y-1.5">
          <Skeleton className="h-3 w-56" />
          <Skeleton className="h-3 w-72" />
        </div>
      ) : !status ? (
        <p className="vvu-label text-[9px] text-[#7a8a6e] mt-2.5">
          NO SERVICE WORKER CONTROLLING THIS PAGE — THE SHELL RUNS NETWORK-ONLY, NOTHING TO WIPE
        </p>
      ) : (
        <div className="mt-2.5 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="vvu-label text-[10px] font-bold px-2.5 py-1 rounded-sm border border-[#c8ff00]/60 text-[#c8ff00] bg-[#c8ff00]/10">
              {version}
            </span>
            {updateWaiting && (
              <>
                {/* R188 · THE STATE'S WHY: a mount is not a label swap —
                    the waiting news rides a live region of its own, once. */}
                <span role="status" aria-live="polite" className="sr-only">
                  {pwaWaitingAnnouncement()}
                </span>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  aria-label={pwaReloadAria()}
                  title="a newer shell is downloaded — click to apply it now. R188 · THE STATE\u2019S WHY: the wait, the deed, and the boundary (the estate\u2019s records never move) ride the aria — heard without hovering."
                  className="vvu-label text-[9px] font-bold px-2 py-1 rounded-sm border border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10 shadow-[0_0_6px_rgba(224,160,48,0.35)] hover:bg-[#e0a030]/20 animate-pulse cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#e0a030]"
                >
                  UPDATE WAITING · RELOAD TO APPLY
                </button>
              </>
            )}
            <LabelValue label="CACHE STORES" value={String(status.caches.length)} />
            <LabelValue label="CACHED ENTRIES" value={String(totalEntries)} />
            <LabelValue
              label="BUILD ASSETS"
              value="network-first · cache no-store"
              title="R62 lesson: recompiled chunks keep their URLs — the worker never trusts the HTTP cache for them"
            />
          </div>
          <p className="vvu-label text-[8px] text-[#7a8a6e] leading-relaxed max-w-3xl">
            THE WORKER ANSWERS THE PAGE OVER A MESSAGE CHANNEL — VERSION AND CACHE CONTENTS ARE ITS
            OWN REPORT, NOT A GUESS. RESET WIPES EVERY STORE AND RE-PRIMES THE IDENTITY ASSETS, THEN
            RELOADS. IF THE APP EVER LOOKS STALE AFTER A DEPLOY, THIS BUTTON IS THE SELF-HEAL.
          </p>
        </div>
      )}
    </div>
  );
}

// ── R66 · server footprint — memory as a monitored rail ─────────────────────
//
// The OOM pattern (3 kernel kills: R61/R64) made next-server's resident set
// a first-class integrity fact. The gauge reads the KERNEL's numbers (VmRSS
// / VmHWM from /proc — what the OOM killer weighs), and the guardian's own
// report rides beside it: its pass clock, its bounce journal, its honest
// OFF/STALE states. present:false and stale:true are displayed as exactly
// that — never faked green.

const GUARDIAN_ARM_COMMAND =
  "python3 .zscripts/daemonize.py --cwd /home/z/my-project --pidfile .zscripts/guardian.pid --log .zscripts/guardian.log -- python3 .zscripts/guardian.py";

// R68 — drill-from-console: the five assertions the drill binary asserts,
// surfaced verbatim. A drill that never ran is an untested bounce path.
interface DrillSummary {
  port?: number;
  assertions?: {
    bouncedOk: boolean;
    pidChanged: boolean;
    portServes: boolean;
    cleanedUp: boolean;
    realUntouched: boolean;
  };
  victimPids?: { old: number | null; new: number | null };
  downtimeMs?: number | null;
  rowError?: string | null;
  error?: string;
}

interface DrillResponse {
  ok: boolean;
  verdict?: "PASS" | "FAIL";
  summary?: DrillSummary;
  refused?: boolean;
  reason?: string;
  detail?: string;
  error?: string;
  atUtc?: string;
}

const DRILL_ASSERTIONS: Array<{
  key: keyof NonNullable<DrillSummary["assertions"]>;
  label: string;
  hint: string;
}> = [
  { key: "bouncedOk", label: "BOUNCED", hint: "the bounce row landed ok:true in the journal" },
  {
    key: "pidChanged",
    label: "PID CHANGED",
    hint: "old victim pid ≠ new victim pid — the R66 race guard held",
  },
  {
    key: "portServes",
    label: "PORT SERVES",
    hint: "the scratch port answers HTTP 200 after the bounce",
  },
  {
    key: "cleanedUp",
    label: "CLEANED UP",
    hint: "the drill victim is dead and its port released — nothing left behind",
  },
  {
    key: "realUntouched",
    label: "REAL :3000 UNTOUCHED",
    hint: "same dev.pid before and after; :3000 answered 200 throughout",
  },
];

function ServerFootprintBlock() {
  // R102 — THE TRY LINE's rehearsal, held at THIS level because the
  // projection panel unmounts when a poll cycle reports present:false —
  // a rehearsal that dies with a refetch is one the operator cannot
  // trust. Client-side only: it draws and reads, it never arms.
  const [tryGuardMb, setTryGuardMb] = useState<number | null>(null);
  const integrity = useIntegrityQuery();
  const guardian = useGuardianQuery();
  const traffic = useTrafficQuery();
  const [copied, setCopied] = useState(false);
  // R90 — the crash-witness disclosure: ONE row's witness open at a time
  // (an accordion keeps the append-only section compact). Key = row key.
  const [witnessOpen, setWitnessOpen] = useState<string | null>(null);

  // R68 — drill-from-console state machine: idle → confirm (5s window) →
  // running (elapsed ticks) → result strip. One drill at a time; the API
  // enforces the same guard server-side (honest 409 refusals).
  const [drillPhase, setDrillPhase] = useState<"idle" | "confirm" | "running">("idle");
  const [drillElapsed, setDrillElapsed] = useState(0);
  const [drillResult, setDrillResult] = useState<DrillResponse | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      if (tickTimer.current) clearInterval(tickTimer.current);
    };
  }, []);

  function armDrill() {
    if (drillPhase !== "idle") return;
    setDrillPhase("confirm");
    confirmTimer.current = setTimeout(() => setDrillPhase("idle"), ARMED_WINDOW_MS); // auto-disarm — the window the voice speaks (R186)
  }

  function disarmDrill() {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setDrillPhase("idle");
  }

  async function runDrill() {
    if (drillPhase === "running") return;
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setDrillPhase("running");
    setDrillElapsed(0);
    tickTimer.current = setInterval(() => setDrillElapsed((s) => s + 1), 1000);
    try {
      const res = await fetch("/api/guardian/drill", { method: "POST", cache: "no-store" });
      const json = (await res.json()) as DrillResponse;
      setDrillResult(json);
      if (json.refused) {
        toast.warning(
          `DRILL REFUSED · ${(json.reason ?? "guard").toUpperCase().replace(/-/g, " ")}`,
          {
            description:
              json.detail ??
              "the guard refused the drill — read the reason, fix the state, drill again",
          },
        );
      } else if (json.ok && json.verdict === "PASS") {
        toast.success("DRILL PASSED · BOUNCE PATH VERIFIED", {
          description: `victim ${json.summary?.victimPids?.old ?? "?"} → ${json.summary?.victimPids?.new ?? "?"} on :${json.summary?.port ?? "?"} · downtime ${((json.summary?.downtimeMs ?? 0) / 1000).toFixed(1)}s · real :3000 untouched`,
        });
      } else {
        toast.error("DRILL FAILED", {
          description:
            json.summary?.rowError ??
            json.error ??
            json.detail ??
            "one or more assertions did not hold — read the strip",
        });
      }
    } catch (e) {
      setDrillResult({ ok: false, error: e instanceof Error ? e.message : String(e) });
      toast.error("DRILL DISPATCH FAILED", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      if (tickTimer.current) clearInterval(tickTimer.current);
      setDrillPhase("idle");
      void guardian.refetch(); // the fresh cyan journal row
    }
  }

  const fp = integrity.data?.footprint;
  const g = guardian.data;

  // R192 · THE OPENED WITNESS: the devseed family's third flag —
  // 'open' unfolds the accordion's FIRST row on load, so the
  // expanded witness voice (R191's suite-pinned remainder) exists
  // click-free: the capture choreography composed again. Production
  // never reads the flag; a broken store reads as closed; the seed
  // never fights the reader — exactly one auto-open per mount, and
  // a reader's own close stays closed.
  const witnessFlagUsed = useRef(false);
  useEffect(() => {
    if (witnessFlagUsed.current) return;
    if (process.env.NODE_ENV === "production") return;
    if (typeof window === "undefined") return;
    if (!readDevseedWitnessFlag(window.localStorage)) return;
    const first = g?.bounces?.[0];
    if (!first) return;
    witnessFlagUsed.current = true;
    setWitnessOpen(`${first.at ?? "row"}-0`);
  }, [g]);

  const rssMb = fp?.rssKb != null ? Math.round(fp.rssKb / 1024) : null;
  const hwmMb = fp?.hwmKb != null ? Math.round(fp.hwmKb / 1024) : null;
  const guardMb = fp?.guardMb ?? null;
  const ratio = rssMb != null && guardMb ? rssMb / guardMb : null;
  // Zones rescaled to the real operating range (R66: the warmed estate
  // idles at ~1.85-1.95GB against a 2100 guard, so "distance to the bounce
  // line" is what the color encodes — 80% / 95% of guard).
  const zone: "lime" | "amber" | "rose" | "dim" =
    ratio == null ? "dim" : ratio >= 0.95 ? "rose" : ratio >= 0.8 ? "amber" : "lime";

  // Gauge geometry: the track spans 0 → guard × 1.15, so the guard tick
  // sits INSIDE the track and anything past it reads as "beyond the cliff".
  const maxMb = guardMb ? guardMb * 1.15 : null;
  const fillPct = rssMb != null && maxMb ? Math.min(100, Math.max(2, (rssMb / maxMb) * 100)) : 0;
  const tickPct = maxMb && guardMb ? (guardMb / maxMb) * 100 : 100;
  const hwmPct = hwmMb != null && maxMb ? Math.min(100, (hwmMb / maxMb) * 100) : null;

  const zoneBar =
    zone === "lime"
      ? "bg-[#c8ff00]"
      : zone === "amber"
        ? "bg-[#e0a030]"
        : zone === "rose"
          ? "bg-[#e5484d]"
          : "bg-[#6b8a40]";

  async function copyArm() {
    try {
      await navigator.clipboard.writeText(GUARDIAN_ARM_COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      toast.success("ARM COMMAND ON THE CLIPBOARD", {
        description: "paste into the estate shell to daemonize the guardian",
      });
    } catch {
      toast.error("CLIPBOARD WRITE FAILED", {
        description: "the command is printed in the block — copy it by hand",
      });
    }
  }

  return (
    <div className="mt-4 rounded-sm border border-[rgba(107,138,64,0.25)] bg-black/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <p className="vvu-label text-[8px] font-bold tracking-[0.22em] text-[#7a8a6e]">
          SERVER FOOTPRINT · MEMORY AS A MONITORED RAIL
        </p>
        {!g?.present ? (
          <span className="vvu-label text-[9px] font-bold px-2.5 py-1 rounded-sm border border-[#6b8a40]/40 text-[#7a8a6e] bg-black/30">
            GUARDIAN OFF
          </span>
        ) : g.stale ? (
          <span
            className="vvu-label text-[9px] font-bold px-2.5 py-1 rounded-sm border border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10 animate-pulse"
            title={
              g.guardianAlive === false
                ? "the guardian process is not running"
                : "the guardian has not completed a pass within 3× its interval"
            }
          >
            GUARDIAN STALE
          </span>
        ) : g.guardian?.duplicateDetected ? (
          <span className="vvu-label text-[9px] font-bold px-2.5 py-1 rounded-sm border border-[#e5484d]/60 text-[#e5484d] bg-[#e5484d]/10">
            DUPLICATE NEXT-SERVER · OPERATOR DECISION
          </span>
        ) : (
          <span className="vvu-label text-[9px] font-bold px-2.5 py-1 rounded-sm border border-[#c8ff00]/60 text-[#c8ff00] bg-[#c8ff00]/10">
            GUARDIAN ARMED · {g.guardian?.intervalSec ?? "?"}S · {g.guardian?.bounces ?? 0} BOUNCES
          </span>
        )}
      </div>

      {!fp ? (
        <p className="vvu-label text-[9px] text-[#7a8a6e] mt-2.5">
          FOOTPRINT UNAVAILABLE — /api/integrity returned no footprint payload
          {integrity.isError ? ` (${integrity.error.message})` : ""}
        </p>
      ) : (
        <div className="mt-2.5 space-y-2">
          {/* the gauge: current RSS fill, kernel high-water mark, guard tick */}
          <div className="mt-5 relative h-3 rounded-sm border border-[#6b8a40]/25 bg-black/40 overflow-visible">
            <div
              className={`absolute inset-y-0 left-0 rounded-sm ${zoneBar} ${zone === "rose" ? "animate-pulse" : ""} opacity-80`}
              style={{ width: `${fillPct}%` }}
              aria-hidden
            />
            {hwmPct != null && (
              <div
                className="absolute -top-0.5 -bottom-0.5 w-[2px] bg-[#f3e38a]/70"
                style={{ left: `${hwmPct}%` }}
                title={`peak since boot (VmHWM): ${hwmMb} MB — the kernel's high-water mark`}
                aria-hidden
              />
            )}
            <div
              className="absolute -top-1 -bottom-1 w-[2px] bg-[#e5484d]/80"
              style={{ left: `${tickPct}%` }}
              title={`OOM guard: ${guardMb} MB — two consecutive passes over this line and the guardian bounces the surface`}
              aria-hidden
            />
            <span
              className="absolute -top-4 vvu-label text-[8px] text-[#e5484d]/80"
              style={{ left: `calc(${tickPct}% - 34px)` }}
              aria-hidden
            >
              ▸ guard {guardMb}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <LabelValue
              label="RSS"
              value={rssMb != null ? `${rssMb} MB` : "—"}
              tone={zone === "rose" ? "red" : zone === "dim" ? "dim" : zone}
              mono
              title="VmRSS from /proc — the number the OOM killer weighs"
            />
            <LabelValue
              label="PEAK"
              value={hwmMb != null ? `${hwmMb} MB` : "—"}
              tone="amber"
              mono
              title="VmHWM — high-water mark since process start; a dropped RSS cannot unsee it"
            />
            <LabelValue
              label="HEAP USED"
              value={`${fp.heapUsedMb} MB`}
              mono
              title="JS heap — a subset of the resident set"
            />
            <LabelValue
              label="BOX AVAIL"
              value={fp.boxAvailMb != null ? `${fp.boxAvailMb} MB` : "—"}
              mono
              title="MemAvailable — what the whole box can still hand out before the kernel starts killing"
            />
            <LabelValue
              label="GUARD"
              value={`${guardMb} MB · ${fp.guardSource}`}
              mono
              title={`two consecutive passes over this line → controlled bounce · read live from the guardian's own status (source: ${fp.guardSource}) — R73 raised it 2100 → 2400 from the scope's own data`}
            />
            <LabelValue label="PID" value={String(fp.pid)} mono />
            {/* R76 — the leak hunt's request baseline: requests since boot,
                read next to the plateau scope's RSS drift. The watchman is
                part of its own traffic — the tooltip says so. */}
            <LabelValue
              label="REQS"
              value={
                traffic.data?.counterArmed
                  ? `${traffic.data.requestsSinceBoot ?? 0} / ${uptimeLabel(traffic.data.uptimeSec)}`
                  : "—"
              }
              mono
              title={`HTTP requests this node process has received since its boot (counter armed ${traffic.data?.counterArmed ? "yes" : "no"}${traffic.data ? ` · uptime ${uptimeLabel(traffic.data.uptimeSec)}` : ""}) — the leak hunt's request baseline: read it against the plateau scope's climb. IT INCLUDES THIS DASHBOARD'S OWN POLLING — the watchman is part of the traffic it watches; resets at every boot`}
            />
            <LabelValue label="SAMPLED" value={fp.sampledAtUtc ? stamp(fp.sampledAtUtc) : "—"} />
          </div>

          {/* R73 — THE GUARD DECISION, recorded where the number lives. The
              operator call R70/R72 kept flagging is TAKEN: the rss rail was
              firing in normal operation (warm cycles climbed +758MB/boot and
              crossed the 2100 guard every ~70-90min); the plateau scope's own
              evidence chose the new line. The box-pressure floor (300MB)
              stays the true kernel-OOM model — 4GB box, RSS 2400 still leaves
              ~700-900MB MemAvailable, far above the floor. */}
          <p
            className="vvu-label text-[8px] text-[#7a8a6e] leading-relaxed mt-0.5"
            title="the guard is read live from the guardian's status.json — display and enforcement can no longer drift"
          >
            R73 GUARD DECISION · 2100 → 2400 MB — CHOSEN FROM THE SCOPE&apos;S OWN DATA (WARM CYCLES
            CLIMBED +758 MB/BOOT AND CROSSED 2100 IN NORMAL OPERATION). THE ENFORCING VALUE IS THE
            GUARDIAN&apos;S OWN; THIS SURFACE ONLY READS IT. THE 300 MB BOX-PRESSURE FLOOR REMAINS
            THE TRUE OOM RAIL.
          </p>

          {/* guardian report — the OUTSIDE watcher's own words */}
          {g?.present && g.guardian && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <LabelValue
                label="LAST PASS"
                value={g.guardian.lastPassAtUtc ? stamp(g.guardian.lastPassAtUtc) : "—"}
              />
              <LabelValue
                label="LAST ACTION"
                value={g.guardian.lastAction}
                tone={g.guardian.lastAction.startsWith("bounce") ? "amber" : "dim"}
              />
              <LabelValue
                label="PORT 3000"
                value={g.guardian.portOk ? "UP" : "DOWN"}
                tone={g.guardian.portOk ? "lime" : "red"}
              />
              <LabelValue
                label="NEXT-SERVER PID"
                value={g.guardian.nextServerPid ? String(g.guardian.nextServerPid) : "—"}
                mono
              />
              <LabelValue
                label="OVER GUARD"
                value={`${g.guardian.consecutiveOver}/2`}
                tone={g.guardian.consecutiveOver > 0 ? "amber" : "dim"}
                mono
              />
              <LabelValue
                label="LOW BOX"
                value={`${g.guardian.consecutiveLow ?? 0}/2`}
                tone={(g.guardian.consecutiveLow ?? 0) > 0 ? "amber" : "dim"}
                mono
                title="consecutive passes with box MemAvailable under the floor while next-server is the dominant consumer"
              />
              {/* R91 — the deep-critical rail: one pass below 150MB avail with
                  next-server dominant. The R90 case study lives in the tooltip:
                  19:39:21 avail 193MB (1st pass) → 19:39:41 tree DEAD — the
                  kernel OOM-killed between passes, and the 2-pass discipline
                  was exactly what it outran. Below the deep floor the landing
                  starts NOW; the row's availKb + witness keep it auditable. */}
              {g.guardian.availCriticalMb != null && (
                <LabelValue
                  label="CRIT RAIL"
                  value={`<${g.guardian.availCriticalMb} MB · 1-PASS`}
                  tone={(g.guardian.consecutiveCrit ?? 0) > 0 ? "red" : "dim"}
                  mono
                  title="R91 deep-critical rail: ONE pass with box MemAvailable under this floor while next-server is the dominant consumer triggers the controlled landing immediately. The R90 case: avail 193MB at 19:39:21, the tree was DEAD at 19:39:41 — the kernel OOM-killer outran the 2-pass floor rail. Warning zone (floor..deep floor) stays 2-pass."
                />
              )}
              {/* R75 — the scheduled quiet-save: the R72 decision menu's
                  remaining option, now built. A status file from a guardian
                  armed WITHOUT the flag carries no schedule key — OFF is the
                  honest rendering, not a missing feature. */}
              <LabelValue
                label="SCHEDULED SAVE"
                value={
                  g.guardian.schedule?.enabled && g.guardian.schedule.at
                    ? `${g.guardian.schedule.at} UTC · ≥${g.guardian.schedule.minRssMb} MB`
                    : "OFF"
                }
                tone={g.guardian.schedule?.enabled ? "lime" : "dim"}
                mono
                title={
                  g.guardian.schedule?.enabled
                    ? `a deliberate daily save at ${g.guardian.schedule.at} UTC, fired only when next-server RSS sits above ${g.guardian.schedule.minRssMb} MB (a cold server has nothing worth saving) — at most once per UTC date; the rss/avail/port rails always outrank it`
                    : "the R72 decision menu\u2019s remaining option: a deliberate daily bounce at a quiet hour, bounded by RSS (fires only above the warm floor) and by date (once per UTC day). OFF until the guardian is re-armed with --bounce-at HH:MM — arming command is in the arm block below"
                }
              />
              {/* R99 — THE AUTO-PAIR state, straight from status.json: when
                  the guardian's next post-bounce verdict readings fire. A
                  status file from a pre-R99 guardian carries no autoPair
                  key — ABSENT reads honestly as the manual-only era. */}
              {g.guardian.autoPair && (
                <LabelValue
                  label="AUTO-PAIR"
                  value={
                    !g.guardian.autoPair.enabled
                      ? "OFF"
                      : g.guardian.autoPair.openerDueUtc || g.guardian.autoPair.secondDueUtc
                        ? `OPENER ${g.guardian.autoPair.openerDueUtc ? g.guardian.autoPair.openerDueUtc.slice(11, 19) + "Z" : "DONE"} · SECOND ${g.guardian.autoPair.secondDueUtc ? g.guardian.autoPair.secondDueUtc.slice(11, 19) + "Z" : "DONE"}`
                        : "ARMED · WAITING FOR NEXT BOUNCE"
                  }
                  tone={g.guardian.autoPair.enabled ? "lime" : "dim"}
                  mono
                  title={
                    !g.guardian.autoPair.enabled
                      ? "the guardian runs without the auto-pair — every verdict reading needs a human trigger (the dead-open population is the cost of that)"
                      : `R99 — the two-reading ritual automated at the guardian's own handoff: after each successful bounce the guardian arms an opener reading (+${"3.5"} min) and a pair-closing second reading (+${"18"} min) against the fresh boot. The POST carries no numbers — the ledger re-derives everything server-side and the rows carry via="auto-guardian" provenance. Timers shown are the next fire times (UTC); a boot that dies before a reading fires loses it honestly, and the next bounce re-arms the pair.`
                  }
                />
              )}
              {/* R69 — the warm plateau, straight from the guardian's own pass
                  log: the median RSS of the last 10 healthy passes and the
                  honest headroom from that baseline to the guard line. */}
              {g.plateau && g.plateau.baselineMb != null && (
                <>
                  <LabelValue
                    label="WARM BASELINE"
                    value={`~${g.plateau.baselineMb} MB`}
                    tone="dim"
                    mono
                    title={`median VmRSS of the guardian's 10 newest healthy passes (window: ${g.plateau.samples} passes, ${g.plateau.since ?? "?"} → ${g.plateau.until ?? "??"}) — the estate's honest operating baseline, from its own pass log`}
                  />
                  <LabelValue
                    label="HEADROOM"
                    value={`${g.plateau.headroomMb} MB`}
                    tone={
                      (g.plateau.headroomMb ?? 0) < 150
                        ? "red"
                        : (g.plateau.headroomMb ?? 0) < 300
                          ? "amber"
                          : "lime"
                    }
                    mono
                    title="guard line minus the warm baseline — if this shrinks, recalibrate the guard BEFORE the journal fills with bounce clusters"
                  />
                  {/* R70 — the plateau trend: the same log read for DIRECTION,
                      not just level. Amber at a climbing plateau is the gauge
                      telling the truth — the recalibration question is live. */}
                  {g.plateau.driftMb != null && (
                    <LabelValue
                      label="PLATEAU TREND"
                      value={`${g.plateau.driftMb > 0 ? "+" : ""}${g.plateau.driftMb} MB`}
                      tone={g.plateau.driftMb > 16 ? "amber" : "dim"}
                      mono
                      title={`median of the newest half minus median of the oldest half across the last ${g.plateau.samples} healthy passes (${g.plateau.since ?? "?"} → ${g.plateau.until ?? "??"}) — a climb eats the headroom beside it and puts the guard calibration on the table; a drop is usually a fresh boot after a save, not recovery`}
                    />
                  )}
                </>
              )}
              {g.drills && (
                <>
                  <LabelValue
                    label="DRILLS"
                    value={`${g.drills.count} RUN · ${g.drills.landed} LANDED`}
                    tone={
                      g.drills.count === 0
                        ? "dim"
                        : g.drills.landed === g.drills.count
                          ? "lime"
                          : "amber"
                    }
                    mono
                    title="guardian.py --drill — the bounce machinery exercised against a throwaway victim on a scratch port; :3000 asserted untouched"
                  />
                  <LabelValue
                    label="LAST DRILL"
                    value={
                      g.drills.last
                        ? `${g.drills.last.ok ? "PASSED" : "FAILED"} · ${g.drills.last.at ? stamp(g.drills.last.at) : "—"}`
                        : "NEVER"
                    }
                    tone={g.drills.last ? (g.drills.last.ok ? "lime" : "red") : "dim"}
                    title="a drill that never ran is an untested bounce path — fire one from DRILL CONTROL below (or: python3 .zscripts/guardian.py --drill)"
                  />
                </>
              )}
            </div>
          )}

          {/* R93 — MEMORY PRESSURE: the guardian's R93 ring buffer draws BOTH
              sides of the kernel race (next-server RSS vs box MemAvailable)
              with the rail lines on their true scales; the OPERATOR BRIEF
              assembles the R90→R92 evidence chain and the calibration menu
              the proof created — on the surface, deciding nothing. */}
          {g?.present && (
            <>
              <MemoryPressure
                present={g.present}
                series={g.guardian?.memSeries}
                guardMb={g.guardian?.guardMb}
                availFloorMb={g.guardian?.availFloorMb}
                availCriticalMb={g.guardian?.availCriticalMb}
                rssKb={g.guardian?.rssKb}
                hwmKb={g.guardian?.hwmKb}
                boxAvailKb={g.guardian?.boxAvailKb}
                bounceMarks={(g.bounces ?? [])
                  .filter((b) => b.drill !== true && b.reason !== "drill")
                  // R94 FIX (live QA): raw journal rows carry `at` (the
                  // guardian's own UTC stamp) — atMs is added downstream by
                  // the chronicle stitcher, NOT by the journal itself. The
                  // mark position parses the row's own stamp with the same
                  // grammar the server uses; rows without a parsable stamp
                  // are skipped, never guessed into the window.
                  .map((b) => ({
                    atMs:
                      typeof b.atMs === "number"
                        ? b.atMs
                        : (parseGuardianStampMs(b.at) ?? Number.NaN),
                    reason: b.reason ?? "unknown",
                    ok: b.ok === true,
                    drill: b.drill === true,
                    downtimeMs: b.downtimeMs ?? null,
                  }))
                  .filter((m) => Number.isFinite(m.atMs))}
              />
              <OperatorBrief
                present={g.present}
                guardian={g.guardian}
                plateau={g.plateau}
                resilience={g.resilience}
              />
              {/* R96 — the projection: the menu's numbers, computed. Sits
                  directly under the brief so the decision and its arithmetic
                  are one scroll apart, never two surfaces. */}
              <OperatorProjection
                projection={g.railProjection}
                series={g.guardian?.memSeries}
                tryGuardMb={tryGuardMb}
                onTryGuardMb={setTryGuardMb}
              />
              {/* R101 — THE LIVING READ: the ceiling drew the dead; this
                  places the guardian's own ring-buffer series (the warm
                  boot, ~30 min at 20s) beside the dead's band — position,
                  phase, next line above, in MB, never in minutes. */}
              <LivingRead
                projection={g.railProjection}
                series={g.guardian?.memSeries}
                guardMb={g.guardian?.guardMb}
              />
            </>
          )}

          {/* R72 — PLATEAU SCOPE: the pass log as a time series. R69 gave the
              plateau a level, R70 a trend; the shape of the cycle (boot →
              climb → guard → save) is what the operator calibrates against. */}
          <PlateauScope />

          {/* R68 — DRILL CONTROL: the self-test fired from the console, not
              the shell. Two-step arm (5s auto-disarm), honest refusals, the
              five assertions surfaced verbatim in cyan. */}
          <div className="rounded-sm border border-[#00d4e0]/25 bg-[#00d4e0]/5 px-2.5 py-2">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <p className="vvu-label text-[8px] font-bold tracking-[0.22em] text-[#00d4e0]/80">
                DRILL CONTROL · SELF-TEST THE BOUNCE PATH
              </p>
              <div className="ml-auto flex items-center gap-1.5">
                {drillPhase === "idle" && (
                  <button
                    type="button"
                    onClick={armDrill}
                    className="vvu-label inline-flex items-center gap-1.5 rounded-sm border border-[#00d4e0]/50 bg-black/40 px-2.5 py-1 text-[9px] font-bold text-[#00d4e0] hover:bg-[#00d4e0]/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00d4e0] cursor-pointer"
                    aria-label={drillVoice(false)}
                    title="arm the guardian self-test — runs guardian.py --drill against a throwaway victim on a scratch port; :3000 asserted untouched. R186 · THE ASKED HANDS: the offer rides the aria — the first click asks, heard without hovering."
                  >
                    <Crosshair className="size-3" aria-hidden />
                    RUN DRILL
                  </button>
                )}
                {drillPhase === "confirm" && (
                  <span className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void runDrill()}
                      aria-label={drillVoice(true)}
                      title="second click within 5s fires the drill — spawns real throwaway processes on a scratch port. R186 · THE ASKED HANDS: the ask and its escape window ride the aria — heard without hovering."
                      className="vvu-label inline-flex animate-pulse items-center gap-1.5 rounded-sm border border-[#00d4e0] bg-[#00d4e0]/20 px-2.5 py-1 text-[9px] font-bold text-[#00d4e0] shadow-[0_0_8px_rgba(0,212,224,0.3)] hover:bg-[#00d4e0]/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00d4e0] cursor-pointer"
                    >
                      <Crosshair className="size-3" aria-hidden />
                      CONFIRM DRILL · SPINS REAL PROCESSES
                    </button>
                    <button
                      type="button"
                      onClick={disarmDrill}
                      aria-label={disarmVoice()}
                      title="R186 · THE ASKED HANDS: the retreat is heard — the ask escapes, the drill never fires."
                      className="vvu-label rounded-sm border border-[#6b8a40]/40 px-2 py-1 text-[9px] text-[#7a8a6e] hover:border-[#7a8a6e]/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00] cursor-pointer"
                    >
                      DISARM
                    </button>
                  </span>
                )}
                {drillPhase === "running" && (
                  <span
                    className="vvu-label inline-flex items-center gap-1.5 rounded-sm border border-[#00d4e0]/60 bg-[#00d4e0]/10 px-2.5 py-1 text-[9px] font-bold text-[#00d4e0]"
                    aria-live="polite"
                    aria-label={drillFlightVoice()}
                    title="R186 · THE ASKED HANDS: the flight speaks its state without the seconds — the elapsed count is the eyes' own show."
                  >
                    <Loader2 className="size-3 animate-spin" aria-hidden />
                    DRILL IN FLIGHT · {drillElapsed}S
                  </span>
                )}
              </div>
            </div>
            <p className="vvu-label mt-1 text-[8px] leading-relaxed text-[#7a8a6e]">
              RUNS THE EXACT DRILL BINARY (guardian.py --drill) THROUGH /api/guardian/drill — THE
              GUARD'S OWN REFUSALS APPLY: GUARDIAN OFF/STALE, DUPLICATE NEXT-SERVER, A REAL BOUNCE
              IN FLIGHT OR WITHIN 10 MINUTES OF LANDING (recent-real-bounce — THE FRESH SURFACE IS
              STILL WARMING), BOX UNDER 450MB, OR A DRILL ALREADY IN FLIGHT, EACH RETURNING AN
              HONEST 409.
            </p>
            {drillResult && (
              <div
                className={`mt-2 rounded-sm border px-2 py-1.5 ${
                  drillResult.refused
                    ? "border-[#e0a030]/40 bg-[#e0a030]/5"
                    : drillResult.ok
                      ? "border-[#00d4e0]/40 bg-black/30"
                      : "border-[#e5484d]/40 bg-[#e5484d]/5"
                }`}
              >
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span
                    className={`vvu-label text-[8px] font-bold px-1.5 py-0.5 rounded-sm border ${
                      drillResult.refused
                        ? "border-[#e0a030]/60 text-[#e0a030]"
                        : drillResult.ok
                          ? "border-[#00d4e0]/60 text-[#00d4e0]"
                          : "border-[#e5484d]/50 text-[#e5484d]"
                    }`}
                  >
                    {drillResult.refused
                      ? "REFUSED"
                      : drillResult.ok
                        ? "DRILL PASSED"
                        : "DRILL FAILED"}
                  </span>
                  {drillResult.atUtc && <LabelValue label="AT" value={stamp(drillResult.atUtc)} />}
                  {drillResult.summary?.port != null && (
                    <LabelValue label="SCRATCH PORT" value={`:${drillResult.summary.port}`} mono />
                  )}
                  {drillResult.summary?.victimPids && (
                    <LabelValue
                      label="VICTIM PIDS"
                      value={`${drillResult.summary.victimPids.old ?? "—"} → ${drillResult.summary.victimPids.new ?? "—"}`}
                      mono
                    />
                  )}
                  {drillResult.summary?.downtimeMs != null && (
                    <LabelValue
                      label="DOWNTIME"
                      value={`${(drillResult.summary.downtimeMs / 1000).toFixed(1)}s`}
                      mono
                    />
                  )}
                  {drillResult.refused && drillResult.detail && (
                    <span className="vvu-label text-[8px] text-[#e0a030] normal-case font-mono">
                      {drillResult.detail}
                    </span>
                  )}
                  {!drillResult.refused && drillResult.summary?.rowError && (
                    <span className="vvu-label text-[8px] text-[#e5484d] normal-case font-mono">
                      {drillResult.summary.rowError}
                    </span>
                  )}
                  {!drillResult.refused && !drillResult.summary && drillResult.error && (
                    <span className="vvu-label text-[8px] text-[#e5484d] normal-case font-mono">
                      {drillResult.error}
                    </span>
                  )}
                </div>
                {!drillResult.refused && drillResult.summary?.assertions && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {DRILL_ASSERTIONS.map((a) => {
                      const held = drillResult.summary?.assertions?.[a.key] === true;
                      return (
                        <span
                          key={a.key}
                          title={a.hint}
                          className={`vvu-label text-[8px] font-bold px-1.5 py-0.5 rounded-sm border ${
                            held
                              ? "border-[#00d4e0]/50 text-[#00d4e0]"
                              : "border-[#e5484d]/50 text-[#e5484d]"
                          }`}
                        >
                          {held ? "✓" : "✗"} {a.label}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* R90 — landing resilience: what the save rail actually costs,
              derived from every real save on record. No arm-age claims,
              no uptime percentages — the journal knows only its own span. */}
          {g?.present && g.resilience && g.resilience.count > 0 && (
            <div
              className="rounded-sm border border-[#6b8a40]/30 bg-black/25 px-2.5 py-2"
              title="derived from every real (non-drill) save in the append-only journal — span is the journal's own coverage, never the arm age; slow landing = downtime over 45s (the #14/#15 class); witnesses ride rows from R90 onward"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className="vvu-label text-[8px] font-bold tracking-[0.22em] text-[#7a8a6e]">
                  LANDING RESILIENCE
                </p>
                <p className="vvu-label text-[8px] text-[#7a8a6e] tabular-nums">
                  {g.resilience.count} REAL SAVES ACROSS{" "}
                  {g.resilience.spanHours != null ? `${g.resilience.spanHours.toFixed(1)}H` : "—"}
                </p>
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                <div>
                  <p className="vvu-label text-[7px] tracking-[0.18em] text-[#7a8a6e]">
                    TOTAL DOWNTIME
                  </p>
                  <p className="font-mono text-[11px] text-[#b8c9a0] tabular-nums">
                    {fmtMs(g.resilience.totalDowntimeMs)}
                  </p>
                </div>
                <div>
                  <p className="vvu-label text-[7px] tracking-[0.18em] text-[#7a8a6e]">
                    MEAN · MEDIAN
                  </p>
                  <p className="font-mono text-[11px] text-[#b8c9a0] tabular-nums">
                    {g.resilience.meanMs != null ? fmtMs(g.resilience.meanMs) : "—"}
                    <span className="text-[#7a8a6e]"> · </span>
                    {g.resilience.medianMs != null ? fmtMs(g.resilience.medianMs) : "—"}
                  </p>
                </div>
                <div>
                  <p className="vvu-label text-[7px] tracking-[0.18em] text-[#7a8a6e]">LONGEST</p>
                  <p
                    className={`font-mono text-[11px] tabular-nums ${
                      (g.resilience.slowLandings ?? 0) > 0 ? "text-[#e0a030]" : "text-[#b8c9a0]"
                    }`}
                    title={
                      g.resilience.longestAt
                        ? `longest landing ${g.resilience.longestAt}`
                        : undefined
                    }
                  >
                    {g.resilience.longestMs != null ? fmtMs(g.resilience.longestMs) : "—"}
                  </p>
                </div>
                <div>
                  <p className="vvu-label text-[7px] tracking-[0.18em] text-[#7a8a6e]">
                    SLOW &gt;45S
                  </p>
                  <p
                    className={`font-mono text-[11px] tabular-nums ${
                      (g.resilience.slowLandings ?? 0) > 0 ? "text-[#e0a030]" : "text-[#c8ff00]"
                    }`}
                  >
                    {g.resilience.slowLandings}
                  </p>
                </div>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                {Object.entries(g.resilience.byReason ?? {}).map(([reason, n]) => (
                  <span
                    key={reason}
                    className="vvu-label text-[8px] font-bold px-1.5 py-0.5 rounded-sm border border-[#6b8a40]/40 text-[#b8c9a0] tabular-nums"
                  >
                    {reason.toUpperCase()} {n}
                  </span>
                ))}
                <span
                  className="vvu-label text-[8px] text-[#7a8a6e] tabular-nums"
                  title="rows carrying the R90 crash witness — the dying boot's own last lines, captured before the kill; pre-R90 rows cannot be backfilled"
                >
                  WITNESS {g.resilience.witnessRows}/{g.resilience.count}
                </span>
              </div>
            </div>
          )}

          {/* R92 — the reliability ledger: the same journal read as TIME
              BETWEEN saves and availability over the journal's own coverage.
              Every number here is derived from bounces.jsonl alone — the
              availability number cannot outlive its evidence window, the
              current calm is the server clock's honest streak, and the
              sparkline is the per-save downtime tail (no smoothing, no
              backfill). Pre-R92 payloads render dashes, not guesses. */}
          {g?.present && g.resilience && g.resilience.count > 0 && (
            <div
              className="rounded-sm border border-[#6b8a40]/30 bg-black/25 px-2.5 py-2"
              title="derived from the journal's own coverage (first→last real save) — MTBF is the mean interval between consecutive real saves, availability is 1 − downtime/span over that same span (never arm age, never all-time), current calm is now − last save from the server clock, storm is the narrowest interval on record (the fastest double-bounce)"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className="vvu-label text-[8px] font-bold tracking-[0.22em] text-[#7a8a6e]">
                  RELIABILITY LEDGER
                </p>
                {g.resilience.cadence ? (
                  <span
                    className={`vvu-label text-[8px] font-bold px-1.5 py-0.5 rounded-sm border tabular-nums ${
                      g.resilience.cadence === "accelerating"
                        ? "border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10"
                        : g.resilience.cadence === "cooling"
                          ? "border-[#6b8a40]/60 text-[#c8ff00] bg-[#6b8a40]/10"
                          : "border-[#6b8a40]/40 text-[#b8c9a0]"
                    }`}
                    title={`the last 3 save intervals against the overall mean — ${g.resilience.cadence}; R91's cadence question, answered from the journal's own intervals (needs ≥6 intervals to speak)`}
                  >
                    CADENCE {g.resilience.cadence.toUpperCase()}
                  </span>
                ) : (
                  <span
                    className="vvu-label text-[8px] text-[#7a8a6e]/70"
                    title="cadence needs at least 6 real-save intervals — the journal has fewer; absence honest, nothing guessed"
                  >
                    CADENCE —
                  </span>
                )}
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-5">
                <div>
                  <p className="vvu-label text-[7px] tracking-[0.18em] text-[#7a8a6e]">MTBF</p>
                  <p className="font-mono text-[11px] text-[#b8c9a0] tabular-nums">
                    {fmtMin(g.resilience.mtbfMin ?? null)}
                  </p>
                </div>
                <div>
                  <p className="vvu-label text-[7px] tracking-[0.18em] text-[#7a8a6e]">AVAIL</p>
                  <p
                    className={`font-mono text-[11px] tabular-nums ${
                      g.resilience.availabilityPct == null
                        ? "text-[#b8c9a0]"
                        : g.resilience.availabilityPct < 99
                          ? "text-[#e5484d]"
                          : g.resilience.availabilityPct < 99.9
                            ? "text-[#e0a030]"
                            : "text-[#c8ff00]"
                    }`}
                    title={
                      g.resilience.availabilityPct != null
                        ? `${g.resilience.availabilityPct.toFixed(3)}% over the journal's own coverage — the honest window, not arm age`
                        : undefined
                    }
                  >
                    {g.resilience.availabilityPct != null
                      ? `${g.resilience.availabilityPct.toFixed(3)}%`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="vvu-label text-[7px] tracking-[0.18em] text-[#7a8a6e]">CALM NOW</p>
                  <p
                    className="font-mono text-[11px] text-[#c8ff00] tabular-nums"
                    title="now − last real save, from the server clock — the live streak, reset by every save"
                  >
                    {fmtMin(g.resilience.currentCalmMin ?? null)}
                    {/* R96 — the streak's percentile: where THIS calm sits in
                        the journal's own interval distribution — the same
                        honesty grammar as the RECORD RUN accent (R95), one
                        line down: the record's shape, the live streak's
                        place in it. */}
                    {g.resilience.calmPercentile != null &&
                      g.resilience.currentCalmMin != null &&
                      g.resilience.currentCalmMin > 0 && (
                        <span
                          className="ml-1 vvu-label text-[7px] font-bold text-[#7a8a6e]"
                          title={`${g.resilience.calmPercentile}% of the save-intervals on record ended before this streak is this old — the journal's own distribution, not a prediction; the next save resets it honestly`}
                        >
                          ▸ P{g.resilience.calmPercentile}
                        </span>
                      )}
                    {/* R95 — the RECORD RUN: when the live streak outgrows the
                        longest calm on record, the record line is moving WITH
                        this streak — said here, never left for the operator
                        to compare two cells. Resets honestly at the next save. */}
                    {g.resilience.currentCalmMin != null &&
                      g.resilience.longestCalmMin != null &&
                      g.resilience.currentCalmMin > g.resilience.longestCalmMin && (
                        <span
                          className="ml-1 vvu-label text-[7px] font-bold text-[#f3e38a]"
                          title="the live streak has outgrown the longest calm on record — the record line is moving with this streak (the LONGEST CALM cell's from→to predates it); the next save resets both honestly"
                        >
                          ◆ RECORD RUN
                        </span>
                      )}
                  </p>
                </div>
                <div>
                  <p className="vvu-label text-[7px] tracking-[0.18em] text-[#7a8a6e]">
                    LONGEST CALM
                  </p>
                  <p
                    className="font-mono text-[11px] text-[#b8c9a0] tabular-nums"
                    title={
                      g.resilience.longestCalmFrom && g.resilience.longestCalmTo
                        ? `the calmest stretch on record: ${g.resilience.longestCalmFrom} → ${g.resilience.longestCalmTo}`
                        : undefined
                    }
                  >
                    {fmtMin(g.resilience.longestCalmMin ?? null)}
                  </p>
                </div>
                <div>
                  <p className="vvu-label text-[7px] tracking-[0.18em] text-[#7a8a6e]">STORM</p>
                  <p
                    className={`font-mono text-[11px] tabular-nums ${
                      g.resilience.stormMin != null && g.resilience.stormMin < 30
                        ? "text-[#e0a030]"
                        : "text-[#b8c9a0]"
                    }`}
                    title="the narrowest interval between consecutive saves — the fastest double-bounce on record; amber under 30m"
                  >
                    {fmtMin(g.resilience.stormMin ?? null)}
                  </p>
                </div>
              </div>
              {g.resilience.downtimeSeries && g.resilience.downtimeSeries.length > 0 && (
                <div className="mt-2">
                  <div
                    className="flex items-end gap-px h-8"
                    role="img"
                    aria-label="per-save downtime tail, oldest to newest"
                  >
                    {g.resilience.downtimeSeries.map((p, i) => {
                      const h = Math.max(6, Math.min(100, (p.ms / 45_000) * 100));
                      return (
                        <span
                          key={`${p.at}-${i}`}
                          className="flex-1 min-w-[2px] rounded-t-[1px] transition-opacity hover:opacity-75"
                          style={{
                            height: `${h}%`,
                            backgroundColor:
                              p.ms > 45_000 ? "#e5484d" : p.ms > 20_000 ? "#e0a030" : "#6b8a40",
                          }}
                          title={`${p.at} — ${fmtMs(p.ms)} — ${p.reason}`}
                        />
                      );
                    })}
                  </div>
                  <div className="mt-0.5 flex justify-between">
                    <span className="vvu-label text-[7px] text-[#7a8a6e]/70">
                      {g.resilience.downtimeSeries[0]?.at?.slice(11, 19)} UTC
                    </span>
                    <span
                      className="vvu-label text-[7px] text-[#7a8a6e]/70"
                      title="bar height = landing downtime, 45s scale · rose over 45s · amber over 20s"
                    >
                      DOWNTIME TAIL · {g.resilience.downtimeSeries.length} SAVES · 45S SCALE
                    </span>
                    <span className="vvu-label text-[7px] text-[#7a8a6e]/70">
                      {g.resilience.downtimeSeries[
                        g.resilience.downtimeSeries.length - 1
                      ]?.at?.slice(11, 19)}{" "}
                      UTC
                    </span>
                  </div>
                </div>
              )}
              {/* R94 — THE INTERVAL TAIL: the cadence verdict's own numbers.
                  One bar per consecutive-save interval (same ≤40 window the
                  downtime tail speaks), colored by the cadence engine's own
                  bands (≤0.67× mean hot / ≥1.5× cool / else steady) so the
                  strip and the CADENCE chip can never disagree — one engine,
                  two readers (the R93 lesson). The dashed rail is the mean:
                  bars above it stretched the calm, bars under it bought the
                  storm. ABSENT on pre-R94 payloads — honest omission. */}
              {g.resilience.intervalSeries && g.resilience.intervalSeries.length > 0 && (
                <div className="mt-2">
                  <div
                    className="relative flex items-end gap-px h-8"
                    role="img"
                    aria-label="interval between consecutive saves, oldest to newest, mean shown as the dashed rail"
                  >
                    {(() => {
                      const series = g.resilience.intervalSeries as Array<{
                        from: string;
                        to: string;
                        min: number;
                      }>;
                      const mean = g.resilience.mtbfMin ?? null;
                      // captured OUTSIDE the map closure — TS cannot carry the
                      // outer g.resilience narrowing into the callback
                      const stormMin = g.resilience.stormMin ?? null;
                      const max = Math.max(...series.map((p) => p.min), mean ?? 0);
                      const meanPct =
                        mean != null && max > 0
                          ? Math.max(0, Math.min(100, (mean / max) * 100))
                          : null;
                      return (
                        <>
                          {meanPct != null && (
                            <span
                              className="absolute left-0 right-0 border-t border-dashed border-[#7a8a6e]/60 pointer-events-none"
                              style={{ bottom: `${meanPct}%` }}
                              aria-hidden
                            />
                          )}
                          {series.map((p, i) => {
                            const cls = classifyIntervalVsMean(p.min, mean);
                            // R95 — the STORM MARK: the bar(s) that ARE the
                            // record's narrowest interval get a pale-gold
                            // outline so the STORM cell and the strip point
                            // at the same event (one number, two readers).
                            const isStorm = stormMin != null && Math.abs(p.min - stormMin) < 0.05;
                            const h = Math.max(6, Math.min(100, (p.min / max) * 100));
                            return (
                              <span
                                key={`${p.to}-${i}`}
                                className={`flex-1 min-w-[2px] rounded-t-[1px] transition-opacity hover:opacity-75 ${
                                  isStorm
                                    ? "outline outline-1 outline-[#f3e38a]/80 -outline-offset-1"
                                    : ""
                                }`}
                                style={{
                                  height: `${h}%`,
                                  backgroundColor:
                                    cls === "hot"
                                      ? "#e5484d"
                                      : cls === "cool"
                                        ? "#00d4e0"
                                        : "#6b8a40",
                                }}
                                title={`${p.from.slice(11, 19)} → ${p.to.slice(11, 19)} UTC — ${p.min.toFixed(1)}m ${
                                  mean != null
                                    ? `vs mean ${mean.toFixed(1)}m (${cls})`
                                    : "(mean needs ≥2 saves)"
                                }${isStorm ? " · THE STORM — the narrowest interval on record" : ""}`}
                              />
                            );
                          })}
                        </>
                      );
                    })()}
                  </div>
                  <div className="mt-0.5 flex justify-between">
                    <span className="vvu-label text-[7px] text-[#7a8a6e]/70">
                      {(g.resilience.intervalSeries as Array<{ from: string }>)[0]?.from.slice(
                        11,
                        19,
                      )}{" "}
                      UTC
                    </span>
                    <span
                      className="vvu-label text-[7px] text-[#7a8a6e]/70"
                      title="bar height = minutes between consecutive real saves, scaled to the window's own max · the dashed rail is the mean · rose ≤0.67× mean (storm side) · cyan ≥1.5× (calm side) · olive between — the cadence chip's own bands · the pale-gold outline marks THE STORM (the narrowest interval on record, same number as the STORM cell)"
                    >
                      INTERVAL TAIL · {(g.resilience.intervalSeries as Array<unknown>).length}{" "}
                      INTERVALS
                      {g.resilience.mtbfMin != null
                        ? ` · MEAN ${g.resilience.mtbfMin.toFixed(1)}M · MEAN RAIL`
                        : ""}
                      {g.resilience.stormMin != null
                        ? ` · STORM ${g.resilience.stormMin < 1 ? `${Math.round(g.resilience.stormMin * 60)}S` : `${g.resilience.stormMin.toFixed(1)}M`} MARKED`
                        : ""}
                    </span>
                    <span className="vvu-label text-[7px] text-[#7a8a6e]/70">
                      {(g.resilience.intervalSeries as Array<{ to: string }>)[
                        (g.resilience.intervalSeries as Array<unknown>).length - 1
                      ]?.to.slice(11, 19)}{" "}
                      UTC
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* bounce journal — append-only evidence, newest first */}
          {g?.present && (
            <div className="pt-1">
              <p className="vvu-label text-[8px] font-bold tracking-[0.22em] text-[#7a8a6e] mb-1.5">
                BOUNCE JOURNAL · {g.journalRowsTotal ?? 0} ON RECORD · APPEND-ONLY
              </p>
              {!g.bounces || g.bounces.length === 0 ? (
                <p className="vvu-label text-[9px] text-[#7a8a6e]">
                  NO BOUNCES ON RECORD — CLEAN RECORD. THE KERNEL OOM-KILLS ARE THE ALTERNATIVE
                  HISTORY THIS RAIL EXISTS TO CLOSE.
                </p>
              ) : (
                <div className="space-y-1">
                  {g.bounces.map((b, i) => {
                    const isDrill = b.drill === true || b.reason === "drill";
                    return (
                      <div
                        key={`${b.at ?? "row"}-${i}`}
                        className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-sm border px-2 py-1.5 ${
                          isDrill
                            ? "border-[#00d4e0]/40 bg-[#00d4e0]/5"
                            : b.ok
                              ? "border-[#c8ff00]/30 bg-[#c8ff00]/5"
                              : "border-[#e5484d]/40 bg-[#e5484d]/5"
                        }`}
                      >
                        <span
                          className={`vvu-label text-[8px] font-bold px-1.5 py-0.5 rounded-sm border ${
                            isDrill
                              ? "border-[#00d4e0]/60 text-[#00d4e0]"
                              : b.reason === "avail-critical"
                                ? "border-[#e5484d] bg-[#e5484d]/15 text-[#e5484d]"
                                : b.reason === "rss"
                                  ? "border-[#e5484d]/50 text-[#e5484d]"
                                  : b.reason === "avail"
                                    ? "border-[#f3e38a]/60 text-[#f3e38a]"
                                    : "border-[#e0a030]/50 text-[#e0a030]"
                          }`}
                          title={
                            b.reason === "avail-critical"
                              ? "R91 deep-critical rail — ONE pass under the deep floor with next-server dominant: the landing started immediately because the kernel OOM-killer outruns the 2-pass discipline in this zone (R90 case study)"
                              : undefined
                          }
                        >
                          {isDrill
                            ? `DRILL · :${b.port ?? "?"}`
                            : b.reason === "avail-critical"
                              ? "AVAIL CRITICAL · 1-PASS"
                              : b.reason === "rss"
                                ? "RSS OVER GUARD"
                                : b.reason === "avail"
                                  ? "BOX PRESSURE"
                                  : b.reason === "port"
                                    ? "PORT DEAD"
                                    : (b.reason ?? "?").toUpperCase()}
                        </span>
                        <span
                          className={`vvu-label text-[8px] font-bold px-1.5 py-0.5 rounded-sm border ${
                            b.ok
                              ? "border-[#c8ff00]/50 text-[#c8ff00]"
                              : "border-[#e5484d]/50 text-[#e5484d]"
                          }`}
                        >
                          {b.ok ? (isDrill ? "LANDED · CLEANED" : "LANDED") : "FAILED"}
                        </span>
                        <LabelValue label="AT" value={b.at ? stamp(b.at) : "—"} />
                        {!isDrill && (
                          <LabelValue
                            label="RSS AT BOUNCE"
                            value={b.rssKb != null ? `${Math.round(b.rssKb / 1024)} MB` : "—"}
                            mono
                          />
                        )}
                        {/* R91 — the box's own avail at the decision moment: the
                            OOM-race forensics read per row from R91 onward. */}
                        {b.availKb != null && (
                          <LabelValue
                            label="BOX AVAIL"
                            value={`${Math.round(b.availKb / 1024)} MB`}
                            mono
                            tone={
                              b.availKb < 200 * 1024
                                ? "red"
                                : b.availKb < 400 * 1024
                                  ? "amber"
                                  : "dim"
                            }
                            title="box MemAvailable at the moment the rail decided — R91 rows carry it; the R90 case read 193MB one pass before the kernel killed the tree"
                          />
                        )}
                        <LabelValue
                          label="PIDS"
                          value={`${b.oldPid ?? "—"} → ${b.newPid ?? "—"}`}
                          mono
                        />
                        {b.downtimeMs != null && (
                          <LabelValue
                            label="DOWNTIME"
                            value={`${(b.downtimeMs / 1000).toFixed(1)}s`}
                            mono
                          />
                        )}
                        {b.error && (
                          <span className="vvu-label text-[8px] text-[#e5484d] font-mono normal-case">
                            {b.error}
                          </span>
                        )}
                        {/* R94 — the MEM WITNESS: the guardian's own pressure
                            samples leading INTO the decision (≤12 · ~4min),
                            durable in the row. A chip with the shape read —
                            first→last RSS and box avail — so every row shows
                            what the save landed INTO without opening it;
                            pre-R94 rows honestly carry none. */}
                        {(() => {
                          const mw = Array.isArray(b.memWitness) ? b.memWitness : [];
                          if (mw.length === 0) return null;
                          const first = mw[0];
                          const last = mw[mw.length - 1];
                          const fRss =
                            first && first.rssKb != null ? Math.round(first.rssKb / 1024) : null;
                          const lRss =
                            last && last.rssKb != null ? Math.round(last.rssKb / 1024) : null;
                          const fAv =
                            first && first.availKb != null
                              ? Math.round(first.availKb / 1024)
                              : null;
                          const lAv =
                            last && last.availKb != null ? Math.round(last.availKb / 1024) : null;
                          const deepDip = mw.some(
                            (s) => s.availKb != null && s.availKb < 150 * 1024,
                          );
                          return (
                            <span
                              className={`vvu-label inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[8px] font-bold ${
                                deepDip
                                  ? "border-[#e5484d]/60 text-[#e5484d]"
                                  : "border-[#00d4e0]/50 text-[#00d4e0]/90"
                              }`}
                              title={`R94 mem witness — the guardian's last ${mw.length} pressure samples (~${Math.round((mw.length * 20) / 60)} min) leading into the decision: RSS ${fRss ?? "—"}→${lRss ?? "—"} MB · box avail ${fAv ?? "—"}→${lAv ?? "—"} MB${deepDip ? " · a sample sat UNDER the 150MB deep rail — the kernel-imminent zone" : ""}. Durable in the journal row; the live series is arm-span only.`}
                            >
                              MEM · {mw.length} SAMPLE{mw.length === 1 ? "" : "S"}
                              {fRss != null && lRss != null ? ` · RSS ${fRss}→${lRss}` : ""}
                              {fAv != null && lAv != null ? ` · AVAIL ${fAv}→${lAv}` : ""}
                              {deepDip ? " · DEEP DIP" : ""}
                            </span>
                          );
                        })()}
                        {/* R90 — the crash witness: the dying boot's own last
                            lines. A toggle chip, not an always-open wall; one
                            witness open at a time keeps the ledger legible. */}
                        {(() => {
                          const ev = b.evidence;
                          const lines = Array.isArray(ev?.lines) ? ev.lines : [];
                          const rowKey = `${b.at ?? "row"}-${i}`;
                          if (lines.length === 0) {
                            return ev?.error ? (
                              <span
                                className="vvu-label text-[8px] text-[#7a8a6e]/70 normal-case"
                                title={`witness unavailable: ${ev.error}`}
                              >
                                WITNESS UNAVAILABLE
                              </span>
                            ) : null;
                          }
                          const open = witnessOpen === rowKey;
                          return (
                            <>
                              <button
                                type="button"
                                onClick={() => setWitnessOpen(open ? null : rowKey)}
                                aria-expanded={open}
                                aria-label={witnessFoldAria(
                                  `WITNESS · ${lines.length} LINE${lines.length === 1 ? "" : "S"}`,
                                  open,
                                  !!ev?.truncated,
                                )}
                                title={`${lines.length} line${lines.length === 1 ? "" : "s"} of the dying boot's own log, captured before the kill${ev?.truncated ? " (older lines exist — the tail is bounded)" : ""} · ${ev?.path ?? ""}`}
                                className={`vvu-label inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[8px] font-bold transition-[color,border-color,box-shadow] cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#e0a030] ${
                                  open
                                    ? "border-[#e0a030] bg-[#e0a030]/20 text-[#e0a030] shadow-[0_0_6px_rgba(224,160,48,0.3)]"
                                    : "border-[#e0a030]/50 text-[#e0a030]/90 hover:bg-[#e0a030]/15"
                                }`}
                              >
                                <ChevronDown
                                  className={`size-2.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                                  aria-hidden
                                />
                                WITNESS · {lines.length} LINE{lines.length === 1 ? "" : "S"}
                              </button>
                              {open && (
                                <div className="w-full basis-full mt-1.5 rounded-sm border border-[#e0a030]/30 bg-black/50 px-2 py-1.5 max-h-44 overflow-auto">
                                  <p className="vvu-label text-[7px] tracking-[0.18em] text-[#7a8a6e] mb-1 break-all">
                                    {ev?.path ?? "boot log"}
                                    {ev?.truncated ? " · TAIL BOUNDED — OLDER LINES EXIST" : ""}
                                  </p>
                                  <pre className="font-mono text-[9px] leading-[1.7] text-[#b8c9a0] whitespace-pre-wrap break-all tabular-nums">
                                    {lines.map((ln, li) => {
                                      const text = String(ln).slice(0, 200);
                                      return /error|fail|crash|killed|exception|refused/i.test(
                                        text,
                                      ) ? (
                                        <span key={li} className="text-[#e5484d]">
                                          {text}
                                          {"\n"}
                                        </span>
                                      ) : (
                                        <span key={li}>
                                          {text}
                                          {"\n"}
                                        </span>
                                      );
                                    })}
                                  </pre>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* arm command when off — the self-serve path */}
          {!g?.present && (
            <button
              type="button"
              onClick={() => void copyArm()}
              aria-live="polite"
              aria-label={copyArmAria(copied)}
              className={`mt-1 w-full flex items-center gap-2 rounded-sm border px-2.5 py-2 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00] cursor-pointer transition-[filter,border-color] ${
                copied
                  ? "border-[#c8ff00]/70 bg-[#c8ff00]/10 shadow-[0_0_6px_rgba(200,255,0,0.2)]"
                  : "border-dashed border-[#6b8a40]/40 bg-black/30 hover:border-[#c8ff00]/50"
              }`}
              title="copy the arm command to the clipboard. R187 · THE COPIED HANDS: the offer and its arrival ride the aria — the clipboard's honesty spoken, heard without hovering."
            >
              {copied ? (
                <Check className="size-3 text-[#c8ff00] shrink-0" aria-hidden />
              ) : (
                <Copy className="size-3 text-[#7a8a6e] shrink-0" aria-hidden />
              )}
              <span className="font-mono text-[9px] text-[#c9d4bd] truncate">
                {GUARDIAN_ARM_COMMAND}
              </span>
              <span className="vvu-label text-[8px] text-[#7a8a6e] shrink-0 ml-auto">
                {copied ? "COPIED" : "COPY · ARM"}
              </span>
            </button>
          )}

          <p className="vvu-label text-[8px] text-[#7a8a6e] leading-relaxed max-w-3xl">
            RSS AND PEAK ARE THE KERNEL'S OWN NUMBERS (/proc) — THE SAME ONES THE OOM KILLER WEIGHS.
            THE GUARDIAN IS AN OUTSIDE WATCHER WITH THREE BOUNCE RAILS: 2 CONSECUTIVE OVER-GUARD
            PASSES (rss), 2 CONSECUTIVE BOX-PRESSURE PASSES — MemAvailable UNDER THE FLOOR WITH
            NEXT-SERVER THE DOMINANT CONSUMER, THE EXACT SHAPE OF ALL THREE REAL KERNEL OOM KILLS
            (avail) — OR 2 DEAD-PORT PASSES (port). A BOUNCE IS THE R63 PLAYBOOK: KILL TREE → PORT
            FREE → DAEMONIZE FRESH → HTTP 200. IT NEVER TOUCHES THE MINI-SERVICES AND NEVER
            AUTO-KILLS AN AMBIGUOUS OR DUPLICATED INSTANCE — THAT IS REPORTED AND LEFT TO THE
            OPERATOR. A BOUNCE COSTS SECONDS: THE WORM CHAIN IS ON DISK AND THE SENTINEL + RETRY
            TICKER RE-ARM ON BOOT. CYAN ROWS ARE DRILLS — `python3 .zscripts/guardian.py --drill`
            RUNS THIS EXACT BOUNCE PATH AGAINST A THROWAWAY VICTIM ON A SCRATCH PORT AND ASSERTS
            :3000 STAYED UNTOUCHED; DRILL CONTROL (ABOVE) FIRES THE SAME BINARY FROM THE CONSOLE
            WITH THE GUARD'S OWN REFUSALS — A BOUNCE PATH NEVER DRILLED IS AN UNTESTED LANDING. WARM
            BASELINE IS THE MEDIAN RSS OF THE GUARDIAN'S 10 NEWEST HEALTHY PASSES; IF HEADROOM TO
            THE GUARD SHRINKS, RECALIBRATE THE GUARD BEFORE THE JOURNAL — NOT THE GAUGE — TELLS YOU.
            PLATEAU TREND READS THE SAME LOG FOR DIRECTION ACROSS A WIDER WINDOW: A CLIMBING PLATEAU
            PUTS THE GUARD CALIBRATION ON THE TABLE (R70 CONSIDERED AND REJECTED LOWERING THE AMBER
            FLOOR — AMBER AT A CLIMBING PLATEAU IS THE GAUGE TELLING THE TRUTH).
          </p>
        </div>
      )}
    </div>
  );
}

// ── R70 · estate chronicle — the unified evidence timeline ──────────────────
// One timeline stitched READ-ONLY from the three append-only ledgers. Each
// class keeps the identity it already has elsewhere on this surface: real
// saves are lime (the journal rows above), drills are cyan (DRILL CONTROL),
// snapshots are violet (the vault ledger), syncs are sky (the off-box block).

type ChronFilter = "all" | ChronicleClass;

const CHRONICLE_CAP = 12;

// R73 — the filter keys that may ride a deep link (cf=…) — invalid values
// in a shared URL are IGNORED, never applied.
const CHRONICLE_FILTER_KEYS: ReadonlyArray<ChronFilter> = [
  "all",
  "save",
  "drill",
  "snapshot",
  "sync",
  "fleet",
  "verdict",
];

// R81 — the fifth class joins: verdict readings carry the verdict block's
// PROFILE-NEXT cream-gold (#f3e38a) — the attribution read's evidence accent,
// distinct from the drill cyan and the fleet amber at a glance.
const CHRONICLE_CLASS_STYLE: Record<
  ChronicleClass,
  { label: string; chip: string; dot: string; active: string }
> = {
  save: {
    label: "SAVE",
    chip: "border-[#c8ff00]/50 text-[#c8ff00]",
    dot: "bg-[#c8ff00] shadow-[0_0_6px_rgba(200,255,0,0.45)]",
    active:
      "border-[#c8ff00]/60 text-[#c8ff00] bg-[#c8ff00]/10 shadow-[0_0_6px_rgba(200,255,0,0.2)]",
  },
  drill: {
    label: "DRILL",
    chip: "border-[#00d4e0]/60 text-[#00d4e0]",
    dot: "bg-[#00d4e0] shadow-[0_0_6px_rgba(0,212,224,0.45)]",
    active:
      "border-[#00d4e0]/60 text-[#00d4e0] bg-[#00d4e0]/10 shadow-[0_0_6px_rgba(0,212,224,0.2)]",
  },
  snapshot: {
    label: "SNAPSHOT",
    chip: "border-[#c084fc]/50 text-[#c084fc]",
    dot: "bg-[#c084fc] shadow-[0_0_6px_rgba(192,132,252,0.45)]",
    active:
      "border-[#c084fc]/60 text-[#c084fc] bg-[#c084fc]/10 shadow-[0_0_6px_rgba(192,132,252,0.2)]",
  },
  sync: {
    label: "SYNC",
    chip: "border-[#7dd3fc]/50 text-[#7dd3fc]",
    dot: "bg-[#7dd3fc] shadow-[0_0_6px_rgba(125,211,252,0.45)]",
    active:
      "border-[#7dd3fc]/60 text-[#7dd3fc] bg-[#7dd3fc]/10 shadow-[0_0_6px_rgba(125,211,252,0.2)]",
  },
  // R76 — console fleet actions (restarts): amber-gold family, distinct
  // from the sync sky and the drill cyan — an OPERATOR action, not a
  // system event, and the color should say so at a glance.
  fleet: {
    label: "FLEET",
    chip: "border-[#e0a030]/50 text-[#e0a030]",
    dot: "bg-[#e0a030] shadow-[0_0_6px_rgba(224,160,48,0.45)]",
    active:
      "border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10 shadow-[0_0_6px_rgba(224,160,48,0.2)]",
  },
  verdict: {
    label: "VERDICT",
    chip: "border-[#f3e38a]/50 text-[#f3e38a]",
    dot: "bg-[#f3e38a] shadow-[0_0_6px_rgba(243,227,138,0.45)]",
    active:
      "border-[#f3e38a]/60 text-[#f3e38a] bg-[#f3e38a]/10 shadow-[0_0_6px_rgba(243,227,138,0.2)]",
  },
};

const CHRONICLE_TONE_STYLE: Record<ChronicleTone, { label: string; cls: string; row: string }> = {
  ok: {
    label: "OK",
    cls: "border-[#c8ff00]/40 text-[#c8ff00]",
    row: "border-[#252b1e] bg-black/20",
  },
  warn: {
    label: "REFUSED",
    cls: "border-[#e0a030]/60 text-[#e0a030]",
    row: "border-[#e0a030]/40 bg-[#e0a030]/5",
  },
  fail: {
    label: "FAILED",
    cls: "border-[#e5484d]/60 text-[#e5484d]",
    row: "border-[#e5484d]/40 bg-[#e5484d]/5",
  },
};

function useChronicleQuery() {
  return useQuery<ChronicleResponse, Error>({
    queryKey: ["estate-chronicle"],
    queryFn: async () => {
      const res = await fetch("/api/estate/chronicle", { cache: "no-store" });
      if (!res.ok) throw new Error(`CHRONICLE HTTP ${res.status}`);
      return (await res.json()) as ChronicleResponse;
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  });
}

// R71 — the pilot artifact becomes portable. The chronicle is READ-ONLY by
// construction (the ledgers are the evidence); export stays on that side of
// the line: both formats are built CLIENT-SIDE from the already-fetched
// payload — no server write, no journal entry, nothing appended anywhere.
// JSON is the machine-readable bundle (events + totals + sources, exactly
// what /api/estate/chronicle returned); CSV is the demo-walk spreadsheet,
// one row per event with the meta chips flattened to k=v pairs.
function chronicleToCsv(data: ChronicleResponse): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const head = ["at", "cls", "tone", "title", "detail", "meta"];
  const rows = data.events.map((e) =>
    [
      e.at ?? "",
      e.cls,
      e.tone,
      e.title,
      e.detail ?? "",
      (e.meta ?? []).map((m) => `${m.k}=${m.v}`).join("; "),
    ]
      .map((c) => esc(String(c)))
      .join(","),
  );
  return [head.map(esc).join(","), ...rows].join("\n");
}

// R87 — the calibration rides the CSV too, as its OWN section below the
// event table (blank-line separated, section-header row first): these rows
// are DERIVED aggregates (computeSettles over the verdict ledger), not
// journaled events, so they must never masquerade as rows of the events
// table. The summary line carries the scorecard sentence verbatim.
function calibrationToCsv(data: ChronicleResponse): string {
  const c = data.calibration;
  if (!c) return "";
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const head = [
    "pid",
    "readings",
    "first_mb_per_1k",
    "last_mb_per_1k",
    "settle_pct",
    "in_band",
    "tree_pid",
    "ended_by",
    "ended_down_s",
  ]
    .map(esc)
    .join(",");
  const rows = c.perBoot.map((b) =>
    [
      b.pid,
      b.readings,
      b.first != null ? b.first.toFixed(2) : "",
      b.last != null ? b.last.toFixed(2) : "",
      b.settlePct != null ? b.settlePct.toFixed(1) : "",
      b.inBand ? "yes" : "no",
      b.treePid != null ? b.treePid : "",
      b.ended?.reason ?? "",
      b.ended?.downtimeMs != null ? (b.ended.downtimeMs / 1000).toFixed(1) : "",
    ]
      .map((v) => esc(String(v)))
      .join(","),
  );
  const summary = [
    esc(
      `CALIBRATION SUMMARY — ${c.settledInBand} of ${c.settledBoots} settled boots in the ${c.bandLo}-${c.bandHi} MB/1k band`,
    ),
    ...(c.latest
      ? [
          esc(
            `LATEST — boot ${c.latest.bootPid} · ${c.latest.kind} · ${c.latest.mbPer1k != null ? `${c.latest.mbPer1k.toFixed(2)} MB/1k` : "flat"} at ${c.latest.at}`,
          ),
        ]
      : []),
  ].join("\n");
  return [
    "",
    "## CALIBRATION — derived from vvu-trust/verdict/readings.jsonl by computeSettles (not journaled events)",
    head,
    ...rows,
    summary,
  ].join("\n");
}

function downloadChronicle(data: ChronicleResponse, fmt: "json" | "csv"): string {
  // Stamp from the payload's own generatedAtUtc — the export is named by
  // WHEN THE LEDGERS WERE READ, not by the moment the button was clicked.
  const stampId = data.generatedAtUtc.replace(/[^0-9]/g, "").slice(0, 14);
  const filename = `estate-chronicle-${stampId}.${fmt}`;
  const blob =
    fmt === "json"
      ? new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      : new Blob(["\ufeff" + chronicleToCsv(data) + calibrationToCsv(data)], {
          type: "text/csv;charset=utf-8",
        }); // BOM: Excel reads the header honestly
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return filename;
}

// R72 — search highlighting. Case-insensitive matches are wrapped in
// <mark class="vvu-mark"> (the styling lives in globals.css beside the
// rest of the estate chrome). Every occurrence highlights, not just the
// first — a ledger search should SHOW what matched.
function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const lower = text.toLowerCase();
  const parts: React.ReactNode[] = [];
  let i = 0;
  let k = 0;
  for (;;) {
    const idx = lower.indexOf(q, i);
    if (idx === -1) {
      parts.push(text.slice(i));
      break;
    }
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(
      <mark key={`m${k++}`} className="vvu-mark">
        {text.slice(idx, idx + q.length)}
      </mark>,
    );
    i = idx + q.length;
  }
  return <>{parts}</>;
}

function EstateChronicleBlock() {
  const chron = useChronicleQuery();
  // R73 — DEEP-LINKS, DERIVED not effect-synced. The reading state (class
  // filter + search) adopts the hash query #/watchdog?cf=…&q=… and any
  // local interaction takes an OVERRIDE that wins until the surface is
  // left. useHashQuery rides the estate's own hash store (useSyncExternal
  // Store), so SSR and the first client render agree ('' → defaults) and a
  // deep link applies itself the moment the client sees the real hash — no
  // setState-in-effect (that pattern cascades renders; derivation cannot).
  // The silent mirror keeps the URL a truthful ADDRESS of this reading for
  // COPY LINK without ever firing hashchange back at the component.
  const hashQs = useHashQuery();
  const hq = useMemo(() => new URLSearchParams(hashQs), [hashQs]);
  const [override, setOverride] = useState<{ cf: ChronFilter | null; q: string | null } | null>(
    null,
  );
  const [showAll, setShowAll] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );

  const hashCf = hq.get("cf");
  const filter: ChronFilter =
    override?.cf ??
    (hashCf && (CHRONICLE_FILTER_KEYS as readonly string[]).includes(hashCf)
      ? (hashCf as ChronFilter)
      : "all");
  const query = override?.q ?? (hq.get("q") ?? "").slice(0, 120);

  // Interactions: the local override wins; the hash mirrors SILENTLY
  // (history.replaceState — no hashchange, no back-button spam) so the URL
  // stays a shareable address of this reading.
  const applyFilter = (key: ChronFilter) => {
    setOverride((o) => ({ cf: key, q: o?.q ?? null }));
    setShowAll(false);
    writeHashQuery({ cf: key === "all" ? null : key });
  };
  const applyQuery = (v: string) => {
    setOverride((o) => ({ cf: o?.cf ?? null, q: v }));
    writeHashQuery({ q: v.trim() ? v : null });
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
      const { query: hqp } = readHashParts();
      const bits = [
        hqp.get("cf") ? `cf=${hqp.get("cf")}` : null,
        hqp.get("q") ? `q=${hqp.get("q")}` : null,
      ].filter((b): b is string => b != null);
      toast.success("CHRONICLE LINK COPIED", {
        id: "chronicle-link",
        description: bits.length
          ? `the URL carries the reading state — ${bits.join(" · ")} — open it and the chronicle opens filtered`
          : "the URL carries the full unfiltered chronicle",
      });
    } catch {
      toast.error("CLIPBOARD WRITE FAILED", {
        description: "the browser refused clipboard access — copy the address bar instead",
      });
    }
  };

  const data = chron.data;
  const totals = data?.totals;
  const q = query.trim().toLowerCase();
  const classFiltered = (data?.events ?? []).filter((e) => filter === "all" || e.cls === filter);
  const filtered = classFiltered.filter((e) => {
    if (!q) return true;
    return (
      e.title.toLowerCase().includes(q) ||
      (e.detail ?? "").toLowerCase().includes(q) ||
      (e.at ?? "").toLowerCase().includes(q) ||
      e.cls.includes(q) ||
      e.meta.some((m) => `${m.k} ${m.v}`.toLowerCase().includes(q))
    );
  });
  const visible = showAll ? filtered : filtered.slice(0, CHRONICLE_CAP);

  const filters: Array<{ key: ChronFilter; label: string; count: number; active: string }> = [
    {
      key: "all",
      label: "ALL",
      count: totals?.all ?? 0,
      active:
        "border-[#e0a030]/70 text-[#e0a030] bg-[#e0a030]/10 shadow-[0_0_6px_rgba(224,160,48,0.2)]",
    },
    {
      key: "save",
      label: "SAVES",
      count: totals?.save ?? 0,
      active: CHRONICLE_CLASS_STYLE.save.active,
    },
    {
      key: "drill",
      label: "DRILLS",
      count: totals?.drill ?? 0,
      active: CHRONICLE_CLASS_STYLE.drill.active,
    },
    {
      key: "snapshot",
      label: "SNAPSHOTS",
      count: totals?.snapshot ?? 0,
      active: CHRONICLE_CLASS_STYLE.snapshot.active,
    },
    {
      key: "sync",
      label: "SYNCS",
      count: totals?.sync ?? 0,
      active: CHRONICLE_CLASS_STYLE.sync.active,
    },
    {
      key: "fleet",
      label: "FLEET OPS",
      count: totals?.fleet ?? 0,
      active: CHRONICLE_CLASS_STYLE.fleet.active,
    },
    {
      key: "verdict",
      label: "VERDICTS",
      count: totals?.verdict ?? 0,
      active: CHRONICLE_CLASS_STYLE.verdict.active,
    },
  ];

  return (
    <section className="vvu-panel p-4 sm:p-6" aria-labelledby="chronicle-h">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="vvu-label text-[10px] text-[#e0a030] border border-[#e0a030]/40 px-2 py-0.5">
              TASK 41 · EVIDENCE LEDGERS
            </span>
            {totals && (
              <span
                className={`vvu-label text-[9px] px-2 py-0.5 rounded border ${
                  totals.failed > 0
                    ? "border-[#e5484d]/60 text-[#e5484d]"
                    : "border-[#6b8a40]/50 text-[#c9d4bd]"
                }`}
                title={
                  totals.failed > 0
                    ? "one or more journaled events FAILED — read the red rows"
                    : "every journaled event landed or was honestly refused"
                }
              >
                {totals.all} EVENTS
                {totals.failed > 0 ? ` · ${totals.failed} FAILED` : " · NONE FAILED"}
              </span>
            )}
          </div>
          <h2
            id="chronicle-h"
            className="vvu-label text-lg sm:text-xl font-bold text-[#f3e38a] tracking-[0.18em] mt-2"
          >
            ESTATE CHRONICLE · UNIFIED EVIDENCE TIMELINE
          </h2>
          <p className="vvu-label text-[9px] sm:text-[10px] text-[#7a8a6e] mt-1 max-w-3xl leading-relaxed">
            ONE TIMELINE STITCHED READ-ONLY FROM THE FIVE APPEND-ONLY LEDGERS — GUARDIAN JOURNAL,
            VAULT INDEX, SYNC JOURNAL, FLEET ACTIONS, VERDICT READINGS. WHAT WAS JOURNALED IS WHAT
            IS SHOWN.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void chron.refetch()}
            disabled={chron.isFetching}
            className="min-h-[44px] vvu-label text-[10px] font-bold border-[#6b8a40]/50 text-[#c9d4bd] hover:bg-[#8fb35a]/10 hover:text-[#c8ff00] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00]"
          >
            {chron.isFetching ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-3.5" aria-hidden />
            )}
            REFRESH
          </Button>
          {/* R71 — EXPORT · JSON / CSV. Disabled until the ledgers have been
              read once (an export of nothing would be an invention). Both
              builds are client-side from the fetched payload; the ledgers
              are never touched. */}
          {(["json", "csv"] as const).map((fmt) => (
            <Button
              key={fmt}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                if (!data) return;
                const filename = downloadChronicle(data, fmt);
                toast.success(`CHRONICLE EXPORTED · ${fmt.toUpperCase()}`, {
                  id: `chronicle-export-${fmt}`,
                  description: `${data.events.length} events · ${data.totals.failed} failed · ${data.totals.warned} refused → ${filename} — built client-side, the ledgers were not touched`,
                });
              }}
              disabled={!data}
              aria-label={chronicleExportAria(fmt, !!data)}
              title={
                (fmt === "json"
                  ? "Machine-readable bundle: events + totals + sources + the calibration block, exactly what the chronicle API returned"
                  : "Spreadsheet: one row per event, meta chips flattened to k=v, plus the CALIBRATION section (derived per-boot settles) below the event table (BOM included for Excel)") +
                " R188 · THE STATE\u2019S WHY: the payload and the disabled WHY ride the aria — heard without hovering."
              }
              className={`min-h-[44px] vvu-label text-[10px] font-bold border-[#3a4530] text-[#7a8a6e] hover:border-[#6b8a40]/60 hover:bg-[#8fb35a]/10 hover:text-[#c8ff00] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00] disabled:opacity-40 transition-[filter,border-color,box-shadow] ${
                data ? "shadow-[0_0_6px_rgba(143,179,90,0.15)]" : ""
              }`}
            >
              <Download className="size-3.5" aria-hidden />
              {fmt.toUpperCase()}
            </Button>
          ))}
          {/* R73 — COPY LINK. The URL IS the reading state: cf + q ride the
              hash, so the demo walk can hand over a filtered chronicle as a
              link instead of a click-path. Shares the outline family; the
              label flips to LINK COPIED for 2s (aria-live honest for
              readers, reduced-motion safe — a color flip, not an animation). */}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void copyLink()}
            disabled={!data}
            aria-label={copyLinkAria(copied)}
            title="copy a link to THIS reading — the class filter and search ride the URL and reopen applied. R187 · THE COPIED HANDS: the offer and its arrival ride the aria — the clipboard's honesty spoken, heard without hovering."
            aria-live="polite"
            className={`min-h-[44px] vvu-label text-[10px] font-bold transition-[filter,border-color,color] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00] disabled:opacity-40 ${
              copied
                ? "border-[#c8ff00]/70 text-[#c8ff00] bg-[#8fb35a]/10 shadow-[0_0_6px_rgba(200,255,0,0.2)]"
                : "border-[#3a4530] text-[#7a8a6e] hover:border-[#6b8a40]/60 hover:bg-[#8fb35a]/10"
            }`}
          >
            {copied ? (
              <Check className="size-3.5" aria-hidden />
            ) : (
              <Link2 className="size-3.5" aria-hidden />
            )}
            {copied ? "LINK COPIED" : "COPY LINK"}
          </Button>
        </div>
      </div>

      {/* filter chips — one per class, count honest from the ledger read */}
      {!chron.isPending && data && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => applyFilter(f.key)}
              aria-pressed={filter === f.key}
              aria-label={
                f.key === "all"
                  ? chronicleAllChipAria(f.count, filter === f.key)
                  : chronicleClassChipAria(f.label, f.count, filter === f.key)
              }
              className={`vvu-label inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-[9px] font-bold cursor-pointer transition-[color,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00] ${
                filter === f.key
                  ? f.active
                  : "border-[#3a4530] text-[#7a8a6e] hover:border-[#6b8a40]/60 hover:text-[#c9d4bd]"
              }`}
            >
              {f.label}
              <span className="font-mono">{f.count}</span>
            </button>
          ))}
          {totals && totals.warned > 0 && (
            <span
              className="vvu-label rounded-sm border border-[#e0a030]/50 px-2 py-1 text-[9px] font-bold text-[#e0a030]"
              title="events that were honestly REFUSED — e.g. a sync run with no target configured; a refusal is journaled evidence, not a failure"
            >
              {totals.warned} REFUSED
            </span>
          )}
          {data && (
            <span
              className="vvu-label ml-auto text-[8px] text-[#7a8a6e]"
              title="when the chronicle last read the ledgers"
            >
              READ AT {stamp(data.generatedAtUtc)}
            </span>
          )}
        </div>
      )}

      {/* R86 — THE CALIBRATION STRIP: the verdict scorecard folded into the
          evidence family. The SAME shared settle engine the trend strip uses
          (computeSettles, one computation / two readers / zero drift)
          computed this server-side from readings.jsonl; the chronicle
          invents nothing. Renders once a settle pair exists — before that
          the trend strip's own empty state owns the story. */}
      {!chron.isPending && data?.calibration && data.calibration.settledBoots > 0 && (
        <div
          className="mt-3 rounded-sm border border-[#00d4e0]/20 bg-black/20 px-3 py-2"
          data-testid="chronicle-calibration"
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p
              className="vvu-label text-[8px] font-bold tracking-[0.22em] text-[#00d4e0]/70 cursor-help"
              title="the leak hunt's calibration verdict, computed from the verdict readings ledger by the same shared settle engine the trend strip draws — the chronicle carries it so the evidence timeline answers the compile/HMR question too"
            >
              CALIBRATION · {data.calibration.bandLo}–{data.calibration.bandHi} MB/1K BAND
            </p>
            <span
              className={`vvu-label text-[9px] font-bold px-1.5 py-0.5 rounded-sm border tabular-nums cursor-help transition-colors ${
                data.calibration.settledInBand >= 3
                  ? "border-[#6b8a40]/70 text-[#c8ff00] bg-[#8fb35a]/10"
                  : "border-[#3a4530] text-[#c9d4bd] hover:border-[#6b8a40]/60"
              }`}
              title={`of the ${data.calibration.settledBoots} boot(s) holding a settle pair (a first and last ratio), ${data.calibration.settledInBand} landed their last reading inside the ${data.calibration.bandLo}–${data.calibration.bandHi} MB/1k steady-state band — each is a settled calibration point; THREE closes the compile/HMR question as ledger-settled`}
            >
              {data.calibration.settledInBand} OF {data.calibration.settledBoots} SETTLED BOOTS IN
              BAND
              {data.calibration.settledInBand < 3 && (
                <span className="text-[#7a8a6e]">
                  {" "}
                  · NEED {3 - data.calibration.settledInBand} MORE
                </span>
              )}
            </span>
            {/* R89 — the save mix: the bounce journal's reason histogram, the
                tally R88's handover asked to watch (three 'port' saves in a
                row reads very differently from rss-pressure saves). Drills
                are excluded upstream; absence of the journal hides the chip. */}
            {data.calibration.saves && data.calibration.saves.total > 0 && (
              <span
                className="vvu-label inline-flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded-sm border border-[#3a4530] bg-black/30 text-[#7a8a6e] tabular-nums cursor-help"
                title={`the guardian's REAL saves in vvu-trust/guardian/bounces.jsonl (drills excluded), by reason: ${Object.entries(
                  data.calibration.saves.byReason,
                )
                  .map(([k, n]) => `${k} ${n}`)
                  .join(
                    " · ",
                  )}. A save is the guardian landing a controlled bounce BEFORE the kernel could — the reason mix is calibration-relevant for the guardian's thresholds (a port-probe save means the probe failed, not that memory climbed).`}
              >
                <ShieldCheck className="size-2.5" aria-hidden />
                SAVES {data.calibration.saves.total}
                {Object.entries(data.calibration.saves.byReason)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, n]) => ` · ${k} ${n}`)
                  .join("")}
              </span>
            )}
            {data.calibration.latest && (
              <span
                className="vvu-label ml-auto inline-flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded-sm border border-[#3a4530] bg-black/30 text-[#c9d4bd] tabular-nums cursor-help"
                title={`the newest recorded reading: boot worker pid ${data.calibration.latest.bootPid}${data.calibration.latest.devTreePid != null && data.calibration.latest.devTreePid !== data.calibration.latest.bootPid ? ` (tree root ${data.calibration.latest.devTreePid})` : ""} at ${data.calibration.latest.at} · tier ${data.calibration.latest.kind}${data.calibration.latest.mbPer1k != null ? ` · ${data.calibration.latest.mbPer1k.toFixed(2)} MB per 1k requests` : ""}`}
              >
                <span
                  className="inline-block size-1.5 rounded-full bg-[#c8ff00] vvu-pulse"
                  aria-hidden
                />
                LATEST{" "}
                {data.calibration.latest.mbPer1k != null
                  ? `${data.calibration.latest.mbPer1k.toFixed(2)} MB/1K`
                  : "FLAT"}{" "}
                · {data.calibration.latest.kind.toUpperCase().replace("-", " ")} · BOOT{" "}
                {data.calibration.latest.bootPid}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {data.calibration.perBoot.map((b) => (
              <span
                key={b.pid}
                className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[8px] tabular-nums cursor-help transition-colors ${
                  b.inBand
                    ? "border-[#00d4e0]/40 text-[#00d4e0] bg-[#00d4e0]/5 hover:bg-[#00d4e0]/15 hover:border-[#00d4e0]/70"
                    : "border-[#3a4530] text-[#7a8a6e] hover:border-[#6b8a40]/60 hover:text-[#c9d4bd] hover:bg-black/40"
                }`}
                title={`boot worker pid ${b.pid}: ${b.readings} reading(s) · first ${b.first != null ? b.first.toFixed(2) : "—"} → last ${b.last != null ? b.last.toFixed(2) : "—"} MB/1k${b.settlePct != null ? ` (settle ${b.settlePct > 0 ? "+" : ""}${b.settlePct.toFixed(1)}%)` : ""} · last reading ${b.inBand ? "INSIDE" : "outside"} the band — the same per-boot shape the trend strip's settle block renders${b.ended ? ` · the boot ENDED by the guardian's ${b.ended.label} save${b.ended.at ? ` at ${b.ended.at}` : ""} (${b.ended.downtimeMs != null ? `${(b.ended.downtimeMs / 1000).toFixed(1)}s of dark port` : "downtime unrecorded"})` : b.treePid != null ? " · no guardian save joins this boot's tree — it is still serving (the live boot)" : " · no tree provenance (pre-R86 row) — the bounce journal cannot join it, and history is not backfilled"}`}
              >
                PID {b.pid} · {b.first != null ? b.first.toFixed(1) : "—"}→
                {b.last != null ? b.last.toFixed(1) : "—"}
                {b.inBand ? " · IN BAND" : " · OUT"}
                {/* R89 — the boot's END, in the journal's own words: forced
                    saves read amber (the boot died to a trigger), planned
                    quiet-saves stay dim (a deliberate landing). A live boot
                    renders no suffix — it has no end to show. */}
                {b.ended && (
                  <span
                    className={b.ended.reason === "scheduled" ? "text-[#7a8a6e]" : "text-[#e0a030]"}
                  >
                    {" "}
                    · {b.ended.label}
                    {b.ended.downtimeMs != null
                      ? ` ${(b.ended.downtimeMs / 1000).toFixed(1)}s`
                      : ""}
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* R72 — the search row: one input over the fetched payload, an honest
          match count, Escape and the × both clear. No ledger re-reads. */}
      {!chron.isPending && data && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search
              className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-[#5f6e55] pointer-events-none"
              aria-hidden
            />
            <input
              type="text"
              value={query}
              onChange={(e) => applyQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") applyQuery("");
              }}
              placeholder="search the ledgers — title, detail, stamp, meta…"
              aria-label="search chronicle events"
              className="w-full rounded-sm border border-[#3a4530] bg-black/30 pl-7 pr-8 py-1.5 font-mono text-[10px] text-[#e6e0c8] placeholder:text-[#5f6e55] focus:outline-none focus:border-[#c8ff00]/60 focus:ring-1 focus:ring-[#c8ff00]/40 transition-colors"
            />
            {query && (
              <button
                type="button"
                onClick={() => applyQuery("")}
                aria-label="clear search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-[#7a8a6e] hover:text-[#c8ff00] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00] cursor-pointer"
              >
                <X className="size-3" aria-hidden />
              </button>
            )}
          </div>
          {q && (
            <span
              aria-label={chronicleMatchAria(filtered.length, classFiltered.length, query.trim())}
              className={`vvu-label text-[8px] font-bold px-2 py-1 rounded-sm border tabular-nums transition-[box-shadow,border-color,color] ${
                filtered.length > 0
                  ? "border-[#e0a030]/50 text-[#e0a030] shadow-[0_0_6px_rgba(224,160,48,0.2)]"
                  : "border-[#e5484d]/50 text-[#e5484d] shadow-[0_0_6px_rgba(229,72,77,0.2)]"
              }`}
              title="matches within the CURRENT class filter — the search narrows a filter, it never broadens one"
            >
              {filtered.length}/{classFiltered.length} MATCH &quot;{query.trim().toUpperCase()}
              &quot;
            </span>
          )}
        </div>
      )}

      {/* error — honest red, no fake timeline */}
      {chron.error && (
        <div className="mt-4 rounded-sm border border-[#e5484d]/50 bg-[#e5484d]/5 px-2.5 py-2 shadow-[0_0_6px_rgba(229,72,77,0.15)] transition-[box-shadow]">
          {/* R193 · THE HEARD ARRIVALS: the failure announces itself once
              at the strip's mount (R188's own law, applied to the reads
              at last) — the reason rides when the error carries one. */}
          <span role="status" aria-live="polite" className="sr-only">
            {readFailureAria("the chronicle", chron.error.message)}
          </span>
          <p className="vvu-label text-[10px] font-bold text-[#e5484d]">
            CHRONICLE UNREACHABLE — NO TIMELINE SHOWN
          </p>
          <p className="font-mono text-[9px] text-[#e5484d] break-all mt-1">
            {chron.error.message}
          </p>
        </div>
      )}

      {/* first load skeleton */}
      {chron.isPending && (
        <div className="mt-4 space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-sm" />
          ))}
          <p className="vvu-label text-[8px] text-[#7a8a6e]">READING THE LEDGERS…</p>
        </div>
      )}

      {/* the timeline */}
      {data && (
        <>
          {filtered.length === 0 ? (
            classFiltered.length === 0 ? (
              <p className="mt-4 vvu-label text-[9px] text-[#7a8a6e] border border-dashed border-[#3a4530] rounded-sm px-3 py-4 text-center">
                NO {filter === "all" ? "EVENTS" : CHRONICLE_CLASS_STYLE[filter].label + " EVENTS"}{" "}
                ON THE LEDGERS — AN EMPTY CLASS IS DATA TOO, NOT AN ERROR.
              </p>
            ) : (
              <p className="mt-4 vvu-label text-[9px] text-[#e0a030] border border-dashed border-[#e0a030]/40 rounded-sm px-3 py-4 text-center">
                NO EVENTS MATCH &quot;{query.trim().toUpperCase()}&quot; WITHIN THE CURRENT FILTER —
                THE LEDGERS CONTAIN NO SUCH ROW. SEARCH COVERS TITLE, DETAIL, STAMP, CLASS AND META
                CHIPS.
              </p>
            )
          ) : (
            <ol className="mt-4 relative ml-2 border-l border-[#2a3324] pl-5 space-y-2">
              {visible.map((e) => {
                const cs = CHRONICLE_CLASS_STYLE[e.cls];
                const ts = CHRONICLE_TONE_STYLE[e.tone];
                return (
                  <li key={e.id} className="relative">
                    <span
                      aria-hidden
                      className={`absolute -left-[24.5px] top-[9px] size-[7px] rounded-full ring-2 ring-black/60 ${cs.dot}`}
                    />
                    <div className={`rounded-sm border px-2.5 py-2 ${ts.row}`}>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-mono text-[9px] text-[#7a8a6e]">
                          {e.at ? stamp(e.at) : "UNSTAMPED"}
                        </span>
                        <span
                          className={`vvu-label text-[8px] font-bold px-1.5 py-0.5 rounded-sm border ${cs.chip}`}
                        >
                          {cs.label}
                        </span>
                        <span className="vvu-label text-[9px] font-bold text-[#e6e0c8]">
                          <Highlight text={e.title} q={q} />
                        </span>
                        <span
                          className={`vvu-label text-[8px] font-bold px-1.5 py-0.5 rounded-sm border ${ts.cls}`}
                        >
                          {e.toneLabel ?? ts.label}
                        </span>
                      </div>
                      {e.detail && (
                        <p className="font-mono text-[9px] text-[#7a8a6e] mt-1 leading-relaxed">
                          <Highlight text={e.detail} q={q} />
                        </p>
                      )}
                      {e.meta.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {e.meta.map((m) => (
                            <span
                              key={m.k}
                              className="inline-flex items-center gap-1 rounded-sm border border-[#2a3324] bg-black/30 px-1.5 py-0.5 font-mono text-[8px] text-[#8a9a7e]"
                            >
                              <span className="text-[#5f6e55]">{m.k}</span> {m.v}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {filtered.length > CHRONICLE_CAP && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-2.5 min-h-[36px] w-full vvu-label text-[9px] font-bold rounded-sm border border-dashed border-[#6b8a40]/40 bg-black/20 px-2.5 py-1.5 text-[#c9d4bd] hover:border-[#c8ff00]/50 hover:text-[#c8ff00] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00] cursor-pointer"
            >
              {showAll
                ? `COLLAPSE — SHOW THE ${CHRONICLE_CAP} NEWEST`
                : `SHOW ALL ${filtered.length} EVENTS — SHOWING THE ${CHRONICLE_CAP} NEWEST`}
            </button>
          )}

          {/* sources — every ledger accounted for, corrupt lines COUNTED */}
          <p className="mt-3 vvu-label text-[8px] text-[#7a8a6e] leading-relaxed">
            SOURCES ·{" "}
            {data.sources
              .map((s) => {
                const bits = [
                  `${s.file.split("/").pop()?.toUpperCase() ?? s.file} ${s.present ? `${s.rows} ROWS` : "ABSENT"}`,
                ];
                if (s.corrupt > 0) bits.push(`${s.corrupt} CORRUPT (COUNTED)`);
                if (s.gone) bits.push(`${s.gone} GONE`);
                return bits.join(" · ");
              })
              .join("  ·  ")}
          </p>
          <p className="mt-1.5 vvu-label text-[8px] text-[#7a8a6e] leading-relaxed max-w-3xl">
            ONE TIMELINE, FIVE LEDGERS, ZERO INVENTION — THE CHRONICLE READS BOUNCES.JSONL,
            VAULT-INDEX.JSONL, SYNC-JOURNAL.JSONL, FLEET/ACTIONS.JSONL AND VERDICT/READINGS.JSONL AT
            REQUEST TIME AND SHOWS WHAT THEY JOURNALED; IT IS HISTORY, NOT A LIVE STREAM. CLASS
            IDENTITY MATCHES THE REST OF THIS SURFACE: LIME ROWS ARE REAL GUARDIAN SAVES, CYAN ROWS
            ARE DRILLS (READINESS EVIDENCE — NEVER COUNTED AS SAVES), VIOLET ROWS ARE VAULT
            SNAPSHOTS, SKY ROWS ARE SYNC RUNS, GOLD ROWS ARE FLEET OPS (CONSOLE-INITIATED RESTARTS —
            OPERATOR ACTIONS, JOURNALED LIKE EVERYTHING ELSE) AND CREAM ROWS ARE VERDICT READINGS
            (THE LEAK HUNT'S RECORDED ATTRIBUTION READS — R80'S LEDGER JOINED AS THE FIFTH SOURCE IN
            R81); AN AMBER ROW IS AN HONEST REFUSAL (E.G. A SYNC WITH NO TARGET CONFIGURED) AND A
            RED ROW FAILED. A CORRUPT LEDGER LINE IS COUNTED IN THE SOURCES LINE — NEVER SILENTLY
            DROPPED. THE LEDGERS ARE THE EVIDENCE; THE CHRONICLE IS THE READING.
          </p>
        </>
      )}
    </section>
  );
}
