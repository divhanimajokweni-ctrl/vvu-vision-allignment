"use client";

// src/components/vvu/CommandPalette.tsx — keyboard command palette (Ctrl+K /
// Cmd+K, alias "/") for the VVU dual-projection validation dashboard.
// A modal dialog available on BOTH projections (spatial `/` and analytics
// `/#/analytics`), SCADA-styled, focus-trapped, keyboard-first.
//
// Groups:
//   VIEW         — route switch (useHashRoute + WORM ROUTE_TOGGLE / COMMAND_PALETTE)
//   PROJECTION   — 3D MESH / TACTICAL MAP via window CustomEvent
//                  'vvu:set-projection' (detail: 'mesh' | 'map') — SpatialWorkspace
//                  owns the local sub-mode state; the orchestrator wires the
//                  listener. WORM-logs VIEW_MODE / COMMAND_PALETTE.
//   FSM COMMANDS — σ symbols with legal-edge awareness (Appendix B.3).
//                  Illegal δ rows are dimmed + tagged but STILL CLICKABLE so
//                  the edge service guard demonstrates the fsm-error toast.
//   SIMULATION   — speed ×1/×5/×20, SKIP → GATE 3A/3B/3C fast-path, RESET DEMO.
//   ACTIONS      — WORM chain re-verify (TanStack invalidate) + WhatsApp script copy.
//
// Contract notes for the orchestrator:
//   * Open programmatically:  window.dispatchEvent(new Event('vvu:open-palette'))
//   * Projection switching:   window event 'vvu:set-projection' detail 'mesh' | 'map'
//   * Route WORM log:         event ROUTE_TOGGLE · source COMMAND_PALETTE
//   * Projection WORM log:    event VIEW_MODE · source COMMAND_PALETTE

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  Activity,
  BadgeDollarSign,
  BarChart3,
  Boxes,
  BookOpenText,
  Briefcase,
  Building2,
  Cable,
  Coins,
  Copy,
  Cpu,
  Droplets,
  FastForward,
  FlameKindling,
  FlaskConical,
  Gauge,
  Globe2,
  HandCoins,
  HeartPulse,
  Map,
  Mountain,
  NotebookPen,
  Orbit,
  Power,
  Radar,
  Radio,
  RadioTower,
  Receipt,
  RefreshCw,
  RotateCcw,
  ScanLine,
  ScrollText,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  SkipForward,
  SquareTerminal,
  Stamp,
  SunMoon,
  Thermometer,
  TrainFront,
  Users,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useHashRoute } from "@/hooks/use-hash-route";
import type { VvuView } from "@/hooks/use-hash-route";
import {
  useConnected,
  useFsmState,
  useSendFsmCommand,
  useSendWormLog,
  useSetSimSpeed,
  useSimSkip,
  useVvuSocketStore,
} from "@/hooks/use-vvu-socket";
import type { FsmSymbol } from "@/types/vvu";

// ─── palette model ───────────────────────────────────────────────────────────

type GroupId = "VIEW" | "PROJECTION" | "FSM COMMANDS" | "SIMULATION" | "ACTIONS";
type BadgeTone = "lime" | "sage" | "amber" | "crimson" | "teal";

interface PaletteCommand {
  id: string;
  group: GroupId;
  label: string;
  hint: string;
  icon: LucideIcon;
  keywords: string;
  color?: string;
  badge?: { text: string; tone: BadgeTone };
  /** illegal FSM δ — dimmed, still clickable (guard demonstrates the toast) */
  illegal?: boolean;
  run: () => void;
}

const GROUP_ORDER: GroupId[] = ["VIEW", "PROJECTION", "FSM COMMANDS", "SIMULATION", "ACTIONS"];
const GROUP_SQUARE: Record<GroupId, string> = {
  VIEW: "#c8ff00",
  PROJECTION: "#8fb35a",
  "FSM COMMANDS": "#e5484d",
  SIMULATION: "#e0a030",
  ACTIONS: "#2ea8a0",
};

// FSM state colours (mirrors the spatial projection map; kept local so this
// component stays self-contained).
const FSM_COLOR: Record<string, string> = {
  DISCONNECTED: "#7a8a6e",
  PAIRING_BLE: "#e0a030",
  TOTP_VERIFICATION: "#e0a030",
  STEADY_STATE_LOCKED: "#c8ff00",
  LEAK_ACTIVE: "#e5484d",
  THERMAL_THROTTLE: "#e0a030",
  FAIL_CLOSED: "#e5484d",
};

// Legal edges per current state (Appendix B.3 — the run-time states only).
const EMPTY_EDGES: readonly FsmSymbol[] = [];
const LEGAL_EDGES: Record<string, readonly FsmSymbol[]> = {
  STEADY_STATE_LOCKED: ["CLICK", "WARN"],
  LEAK_ACTIVE: ["CLEAR", "WARN", "RESET"],
  THERMAL_THROTTLE: ["RESET", "CRIT"],
  FAIL_CLOSED: ["RESET"],
};

const FSM_DEFS: Array<{
  sym: FsmSymbol;
  label: string;
  hint: string;
  icon: LucideIcon;
  color: string;
}> = [
  {
    sym: "CLICK",
    label: "CLICK · simulate leak",
    hint: "δ → LEAK_ACTIVE · pipe breach arc",
    icon: Droplets,
    color: "#e5484d",
  },
  {
    sym: "CLEAR",
    label: "CLEAR · restore leak",
    hint: "δ → STEADY_STATE_LOCKED · slow tank refill",
    icon: Wrench,
    color: "#2ea8a0",
  },
  {
    sym: "WARN",
    label: "WARN · thermal throttle",
    hint: "δ → THERMAL_THROTTLE · APU clock reduce",
    icon: Thermometer,
    color: "#e0a030",
  },
  {
    sym: "CRIT",
    label: "CRIT · fail closed",
    hint: "δ → FAIL_CLOSED · battery disconnect ≤500ms",
    icon: Power,
    color: "#e5484d",
  },
  {
    sym: "RESET",
    label: "RESET · authorised recovery",
    hint: "δ → STEADY_STATE_LOCKED · SHA-256 audit",
    icon: RotateCcw,
    color: "#8fb35a",
  },
];

const VERIFY_SCRIPT =
  "/verify — VVU Procurement: please confirm (1) CIPC registration 2026/259053/07 (2) B-BBEE Level 1 135% procurement recognition (3) SARS tax compliance. Reply with screenshot evidence.";

// ─── small presentational helpers ────────────────────────────────────────────

const CHIP_TONE: Record<BadgeTone, string> = {
  lime: "text-[#c8ff00] border-[rgba(200,255,0,0.45)] bg-[rgba(200,255,0,0.08)]",
  sage: "text-[#8fb35a] border-[rgba(107,138,64,0.45)] bg-[rgba(107,138,64,0.12)]",
  amber: "text-[#e0a030] border-[rgba(224,160,48,0.45)] bg-[rgba(224,160,48,0.08)]",
  crimson: "text-[#e5484d] border-[rgba(229,72,77,0.45)] bg-[rgba(229,72,77,0.08)]",
  teal: "text-[#2ea8a0] border-[rgba(46,168,160,0.45)] bg-[rgba(46,168,160,0.08)]",
};

function KbdChip({ children, tone }: { children: ReactNode; tone: BadgeTone }) {
  return (
    <span
      className={`vvu-label shrink-0 text-[6px] font-bold px-1.5 py-[3px] rounded-sm border ${CHIP_TONE[tone]}`}
    >
      {children}
    </span>
  );
}

// ─── the palette ─────────────────────────────────────────────────────────────

export function CommandPalette() {
  const [view, setView] = useHashRoute();
  const fsmState = useFsmState();
  const connected = useConnected();
  const fsmError = useVvuSocketStore((s) => s.fsmError);
  const speedMult = useVvuSocketStore((s) => s.frame?.metrics?.speedMultiplier ?? 1);
  const sendFsmCommand = useSendFsmCommand();
  const sendWormLog = useSendWormLog();
  const setSimSpeed = useSetSimSpeed();
  const simSkip = useSimSkip();
  const queryClient = useQueryClient();
  // Task 16-a — DAYSHIFT light ops mode (setTheme only; the palette row and
  // the header button share the same WORM audit + stable toast id).
  const { setTheme } = useTheme();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [announce, setAnnounce] = useState("");

  const inputRef = useRef<HTMLInputElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const seenFsmErrorRef = useRef<string | null>(null);

  const fsmNow = fsmState ?? "STEADY_STATE_LOCKED";
  const legalEdges = LEGAL_EDGES[fsmNow] ?? EMPTY_EDGES;

  // ── open / close (focus save + restore) ──
  const openPalette = useCallback(() => {
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQuery("");
    setActiveIndex(0);
    setAnnounce("Command palette opened");
    setOpen(true);
  }, []);

  const closePalette = useCallback((message = "") => {
    setOpen(false);
    const prev = restoreFocusRef.current;
    if (prev && document.contains(prev)) prev.focus();
    else document.body.focus();
    if (message) setAnnounce(message);
  }, []);

  // Focus the input on open (no state writes here — focus is a side effect).
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Programmatic open hook for the orchestrator's chrome (mobile floating action).
  useEffect(() => {
    const onOpen = () => openPalette();
    window.addEventListener("vvu:open-palette", onOpen);
    return () => window.removeEventListener("vvu:open-palette", onOpen);
  }, [openPalette]);

  // fsm-error toasts for the ANALYTICS view (the spatial FsmPanel already
  // surfaces them where it is mounted). Guarded against re-toasting stale values.
  useEffect(() => {
    if (!fsmError) {
      seenFsmErrorRef.current = null;
      return;
    }
    if (seenFsmErrorRef.current === fsmError) return;
    seenFsmErrorRef.current = fsmError;
    // Stable id 'fsm-rejected' (shared with FsmPanel's own guard-rejection
    // line) — spatial + palette feedback agree and replace each other instead
    // of stacking a flood under rapid retries.
    if (view === "analytics")
      toast.error("FSM REJECTED", { id: "fsm-rejected", description: fsmError });
  }, [fsmError, view]);

  // ── global hotkeys: Ctrl+K / Cmd+K toggle, "/" alias, Esc fallback ──
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Escape always closes while open — belt-and-braces alongside the
      // dialog-level handler (covers focus landing outside the dialog).
      if (e.key === "Escape" && open) {
        e.preventDefault();
        closePalette("Command palette closed · Escape");
        return;
      }
      const isK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k";
      const isSlash = e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey;
      if (!isK && !isSlash) return; // pure modifier presses and everything else pass through
      const target = e.target instanceof HTMLElement ? e.target : null;
      const editable =
        target !== null &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (isK) {
        if (editable && target !== inputRef.current) return; // typing elsewhere — don't hijack
        e.preventDefault();
        if (open) closePalette("Command palette closed");
        else openPalette();
        return;
      }
      // "/" alias — never hijack text entry (including this palette's filter).
      if (editable) return;
      e.preventDefault();
      if (!open) openPalette();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, openPalette, closePalette]);

  // ── command registry ──
  const commands: PaletteCommand[] = useMemo(() => {
    const list: PaletteCommand[] = [];

    // VIEW — route switching (mirrors WorkspaceToggle's WORM ROUTE_TOGGLE)
    const VIEW_NAME: Record<VvuView, string> = {
      icsh: "ICSH · 4TH STATE ON CHAIN",
      spatial: "SPATIAL_INTELLIGENCE",
      analytics: "ANALYTICS · MISSION CONTROL",
      outreach: "SEQUENCE ENGINE",
      holocom: "HOLOCOM",
      urllc: "URLLC+ NEURAL EDGE",
      capability: "CAPABILITY DOSSIER",
      metro: "PROOFBRIDGE METRO",
      fieldkit: "FIELD KIT: CAMPUS WALK",
      support: "SUPPORT · MK-I FUNDING",
      commercial: "COMMERCIAL · DAY-1 SUPPLY",
      manifest: "ESTATE MANIFEST · EIS v1.0",
      twin: "MUNICIPAL TWIN",
      wildfire: "WILDFIRE EMERGENCY VIEW",
      mesh: "FIELD DEMO · SENSOR MESH",
      bridge: "EVIDENCE · VAULT BRIDGE",
      terminal: "TERMINAL · COMMAND CONSOLE",
      field: "BRIDGES · FIELD ONBOARDING",
      watchdog: "WATCHDOG · RAIL HEALTH",
      receipts: "RECEIPTS · CROSS-RAIL CHAIN",
      settings: "SETTINGS · LINDIWE · PINS",
      pools: "UBUNTU POOLS",
      docs: "DOCUMENTS · FIELD ACCESS",
      ops: "OPERATIONS LOOP",
      sphere: "TRUST SPHERE · METRICS",
      fleet: "DEVICE FLEET & ONBOARDING",
      broadcast: "BROADCAST · CREATOR LAYER",
      trust: "VVU-TRUST · COMMUNITY COMPUTE POOL",
      governance: "GOVERNANCE · THE PERMIT KERNEL",
      firstprinciples: "FIRST PRINCIPLES · THE SUBSTRATE",
      safegrid: "SAFEGRID · EVIDENCE RELAY",
      records: "PROXIMITY · RECORD LAYER",
      iveverify: "IVE · VERIFICATION LATTICE",
      studio: "VVU · STUDY STUDIO",
      fluid: "FLUID STUDIO",
    };
    const switchView = (to: VvuView) => {
      if (view === to) {
        // Stable id 'route-noop' — hammering the VIEW command for the current
        // route replaces this toast (timer resets) instead of stacking copies.
        toast(`ALREADY ON ${VIEW_NAME[to]}`, {
          id: "route-noop",
          description: "route unchanged",
        });
        return;
      }
      sendWormLog("ROUTE_TOGGLE", "COMMAND_PALETTE", `palette → ${VIEW_NAME[to]}`);
      toast.success(VIEW_NAME[to], {
        description: "WORM ROUTE_TOGGLE appended to ledger",
      });
      setView(to);
    };
    list.push(
      {
        id: "view-icsh",
        group: "VIEW",
        label: "Switch to ◀ ICSH · 4TH STATE ON CHAIN",
        hint: "contract on chain · ledger as storage · TOTP join · 11-beat loop · cost matrix",
        icon: Radio,
        keywords:
          "icsh 4th state contract chain ledger storage totp join worm ledger cycles cost matrix zoom sim iterations manifest",
        badge: view === "icsh" ? { text: "CURRENT", tone: "lime" } : undefined,
        run: () => switchView("icsh"),
      },
      {
        id: "view-analytics",
        group: "VIEW",
        label: "Switch to ANALYTICS ▸",
        hint: "Trust Gates 3A/3B/3C · MOI 70.66% · WORM ledger",
        icon: BarChart3,
        keywords: "analytics route toggle switch gates moi worm bbbee compliance",
        badge: view === "analytics" ? { text: "CURRENT", tone: "lime" } : undefined,
        run: () => switchView("analytics"),
      },
      {
        id: "view-spatial",
        group: "VIEW",
        label: "Switch to ◀ SPATIAL_INTELLIGENCE",
        hint: "3D mesh · tactical map · live telemetry",
        icon: Radar,
        keywords: "spatial route toggle switch mesh map 3d tactical telemetry",
        badge: view === "spatial" ? { text: "CURRENT", tone: "lime" } : undefined,
        run: () => switchView("spatial"),
      },
      // Round 17 — SEQUENCE ENGINE route (same VIEW-group pattern: appended,
      // no renumbering, WORM ROUTE_TOGGLE · COMMAND_PALETTE).
      {
        id: "view-outreach",
        group: "VIEW",
        label: "Switch to ▸ SEQUENCE ENGINE",
        hint: "outreach cadences · pipeline kanban · AI drafts · dry-run sends",
        icon: Send,
        keywords:
          "outreach sequence engine send cadence kanban pipeline contacts popia resend dry run ai personalisation",
        badge: view === "outreach" ? { text: "CURRENT", tone: "lime" } : undefined,
        run: () => switchView("outreach"),
      },
      // Round 19 — HOLOCOM route (6G NeXt split computing; same VIEW-group
      // pattern: appended, no renumbering, WORM ROUTE_TOGGLE · COMMAND_PALETTE).
      {
        id: "view-holocom",
        group: "VIEW",
        label: "Switch to ▸ HOLOCOM · 6G NeXt",
        hint: "MTP pipeline · cross-layer metrics · discovery · broker · QoE · fountain coding",
        icon: Orbit,
        keywords:
          "holocom 6g next hologram holography h3d split computing remote rendering mtp latency discovery service broker mos qoe fountain coding prediction edge cloud unity webrtc",
        badge: view === "holocom" ? { text: "CURRENT", tone: "lime" } : undefined,
        run: () => switchView("holocom"),
      },
      // Round 22 — CAPABILITY DOSSIER route (procurement capability facts;
      // same VIEW-group pattern: appended, no renumbering).
      {
        id: "view-capability",
        group: "VIEW",
        label: "Switch to ▸ CAPABILITY DOSSIER",
        hint: "pilot status · entity clarification · province · capability statement",
        icon: Stamp,
        keywords:
          "capability dossier procurement pilot scada simulation vivid vvu entity province csd sita bbbee registration statement sanwria dws water fact sheet",
        badge: view === "capability" ? { text: "CURRENT", tone: "lime" } : undefined,
        run: () => switchView("capability"),
      },
      // Round 24 — PROOFBRIDGE METRO route (the 8-bit node city: five
      // playable gates Mark 0→V; same VIEW-group pattern: appended, no
      // renumbering, WORM ROUTE_TOGGLE · COMMAND_PALETTE).
      {
        id: "view-metro",
        group: "VIEW",
        label: "Switch to ▸ PROOFBRIDGE METRO",
        hint: "8-bit node · districts · five playable gates · 5+3=8",
        icon: TrainFront,
        keywords:
          "metro 8-bit node city districts transit trunk bus clock ne555 74ls microcode gates mark verified breadboard ben eater wires pins leds simulator game",
        badge: view === "metro" ? { text: "CURRENT", tone: "lime" } : undefined,
        run: () => switchView("metro"),
      },
      // Round 28 — URLLC+ NEURAL EDGE route (the 6G paper projection: DTL
      // transfer lab · primal-dual bandwidth optimizer · LEO Doppler/waveform
      // lab · deployment matrix; same VIEW-group pattern: appended, WORM
      // ROUTE_TOGGLE · COMMAND_PALETTE).
      {
        id: "view-urllc",
        group: "VIEW",
        label: "Switch to ▸ URLLC+ NEURAL EDGE",
        hint: "DTL transfer lab · primal-dual optimizer · AFDM Doppler lab",
        icon: RadioTower,
        keywords:
          "urllc 6g extreme connectivity neural edge transfer learning dtl fine-tuning frozen layers lagrangian primal-dual unsupervised bandwidth reliability finite blocklength doppler leo satellite ka-band regenerative payload store and forward afdm otfs ocdm waveform tdl multi-head critic drl ddpg deployment matrix paradigm",
        badge: view === "urllc" ? { text: "CURRENT", tone: "lime" } : undefined,
        run: () => switchView("urllc"),
      },
      // Round 29 — FIELD KIT: CAMPUS WALK route (the five-part lecturer kit;
      // capture template = people notes; same VIEW-group pattern: appended,
      // WORM ROUTE_TOGGLE · COMMAND_PALETTE).
      {
        id: "view-fieldkit",
        group: "VIEW",
        label: "Switch to ▸ FIELD KIT · CAMPUS WALK",
        hint: "leave-behind · four bottlenecks · three questions · people notes",
        icon: NotebookPen,
        keywords:
          "fieldkit field kit campus walk lecturer conversation leave behind trust bottleneck provenance evidence institutional cost verification three questions capture template people notes faculty map nmu university q3 trust condition design constraints",
        badge: view === "fieldkit" ? { text: "CURRENT", tone: "lime" } : undefined,
        run: () => switchView("fieldkit"),
      },
      // Round 29 — SUPPORT · MK-I FUNDING route (the funding endpoint local
      // reference engine; same VIEW-group pattern: appended, WORM
      // ROUTE_TOGGLE · COMMAND_PALETTE).
      {
        id: "view-support",
        group: "VIEW",
        label: "Switch to ▸ SUPPORT · MK-I FUNDING",
        hint: "progress gauge · 5-state DFA · receipts · honesty ledger",
        icon: HandCoins,
        keywords:
          "support funding donation contribution mk1 mk-i prototype fabrication receipt sha256 dfa fsm state machine payment gateway payfast eft crypto ledger locked progress gauge allocation kria pcm1864 institutional academic grant alumni sponsorship poggi nmu",
        badge: view === "support" ? { text: "CURRENT", tone: "lime" } : undefined,
        run: () => switchView("support"),
      },
      // Round 30 — COMMERCIAL DAY-1 SUPPLY route (rebuilt after the prior
      // session's files were never persisted; same VIEW-group pattern:
      // appended, no renumbering, WORM ROUTE_TOGGLE · COMMAND_PALETTE).
      {
        id: "view-commercial",
        group: "VIEW",
        label: "Switch to ▸ COMMERCIAL · DAY-1 SUPPLY",
        hint: "17 price cards · QR station · 5 drafts · FS gate · 3 doors",
        icon: BadgeDollarSign,
        keywords:
          "commercial price cards pricing offer discovery pilot r15000 r50000 monitoring field kit ive enterprise studi searm water bank fraud academic licence qr code station payment discipline sow consent drafts emails fs operating standard three door scripts",
        badge: view === "commercial" ? { text: "CURRENT", tone: "lime" } : undefined,
        run: () => switchView("commercial"),
      },
      // Round 30 — ESTATE MANIFEST · EIS v1.0 route (the spec + regression
      // ledger + inventory; same VIEW-group pattern: appended, WORM
      // ROUTE_TOGGLE · COMMAND_PALETTE).
      {
        id: "view-manifest",
        group: "VIEW",
        label: "Switch to ▸ ESTATE MANIFEST · EIS v1.0",
        hint: "EIS spec · shared spine 11-field · regression ledger · inventory",
        icon: ScrollText,
        keywords:
          "manifest eis evidence independence specification zero fabrication rule shared spine canonical payload 11 field footer mandate regression ledger estate inventory provenance tiles components projections services documents",
        badge: view === "manifest" ? { text: "CURRENT", tone: "lime" } : undefined,
        run: () => switchView("manifest"),
      },
      // Round 31 — MUNICIPAL TWIN route: the byte-faithful Cape Town
      // wildfire artifact in a same-origin frame + the authorized WORM
      // pin (Option 1 — default visible, localStorage-persisted).
      {
        id: "view-twin",
        group: "VIEW",
        label: "Switch to ▸ MUNICIPAL TWIN · CAPE TOWN WILDFIRE",
        hint: "byte-faithful artifact · 8 layers · FSM · WORM pin",
        icon: Mountain,
        keywords:
          "twin municipal cape town wildfire artifact isometric layers fire wind smoke evacuation mesh assets environmental evidence chain fsm worm pin hud ledger scenario seed noordhoek hout bay table mountain peninsula",
        badge: view === "twin" ? { text: "CURRENT", tone: "lime" } : undefined,
        run: () => switchView("twin"),
      },
      // Round 31 — WINTER POOLS · WILDFIRE EMERGENCY VIEW route: the
      // operator-side console (03:00 discipline) on the consent-gated
      // :3006 mesh service.
      {
        id: "view-wildfire",
        group: "VIEW",
        label: "Switch to ▸ WILDFIRE EMERGENCY · WINTER POOLS",
        hint: "operator console · FSM 2-step · consent-gated mesh · evidence 9pt",
        icon: FlameKindling,
        keywords:
          "wildfire emergency winter pools operator console fire officer co-op consent mesh 3006 fsm declared escalated watch stand-down evacuation evidence rail journal hash chain verify mirror estate ledger noordhoek hout bay scarborough incident declaration 03:00",
        badge: view === "wildfire" ? { text: "CURRENT", tone: "lime" } : undefined,
        run: () => switchView("wildfire"),
      },
      // Round 32 — FIELD DEMO · SENSOR MESH route: the local-only :3007
      // rail (guests scan QR → phones become sensor nodes → hash-chained
      // journal → /verify walks from genesis). Separate rail per
      // TEMPLATE_QR_BRIDGE §15; QR carries a join URL — a reference, not a
      // secret (§1), rendered locally (§8).
      {
        id: "view-mesh",
        group: "VIEW",
        label: "Switch to ▸ FIELD DEMO · SENSOR MESH",
        hint: "local-only rail :3007 · QR join · hash-chained journal · verify",
        icon: ScanLine,
        keywords:
          "field demo sensor mesh qr join phone node camera mic gps motion battery local only 3007 hash chain journal verify genesis undefined never a guess stop sharing revocation local-only room mesh-demo",
        badge: view === "mesh" ? { text: "CURRENT", tone: "lime" } : undefined,
        run: () => switchView("mesh"),
      },
      // Task 47 — the keyboard spec's ten fixed surfaces + the estate's
      // new projections, reachable from the palette exactly like the rest.
      {
        id: "view-sphere",
        group: "VIEW",
        label: "Switch to ▸ TRUST SPHERE · METRICS",
        hint: "420 nodes · seven-state machine · five honest metric panels",
        icon: Globe2,
        keywords:
          "trust sphere metrics fibonacci 420 nodes states health sla trusted device mesh trend composite honest source line",
        badge: view === "sphere" ? { text: "CURRENT", tone: "lime" } : undefined,
        run: () => switchView("sphere"),
      },
      {
        id: "view-bridge",
        group: "VIEW",
        label: "Switch to ▸ EVIDENCE · VAULT BRIDGE",
        hint: "Ctrl+2 · live vault bridge · receipt per operation",
        icon: Cable,
        keywords:
          "evidence vault bridge obsidian android qr pairing receipts hash chain 3004 evidence log",
        badge: view === "bridge" ? { text: "CURRENT", tone: "lime" } : undefined,
        run: () => switchView("bridge"),
      },
      {
        id: "view-terminal",
        group: "VIEW",
        label: "Switch to ▸ TERMINAL · COMMAND CONSOLE",
        hint: "Ctrl+3 · whitelisted read-only endpoints · type help",
        icon: SquareTerminal,
        keywords: "terminal console command repl help watchdog integrity receipts read only",
        badge: view === "terminal" ? { text: "CURRENT", tone: "lime" } : undefined,
        run: () => switchView("terminal"),
      },
      {
        id: "view-field",
        group: "VIEW",
        label: "Switch to ▸ BRIDGES · FIELD ONBOARDING",
        hint: "Ctrl+9 · :3005 device pairing rail · paired nodes",
        icon: Radio,
        keywords:
          "bridges field onboarding device pairing qr nonce field techs 3005 paired nodes mesh",
        badge: view === "field" ? { text: "CURRENT", tone: "lime" } : undefined,
        run: () => switchView("field"),
      },
      {
        id: "view-watchdog",
        group: "VIEW",
        label: "Switch to ▸ WATCHDOG · RAIL HEALTH",
        hint: "Ctrl+6 · rail probes · integrity fingerprint · governance",
        icon: HeartPulse,
        keywords:
          "watchdog rail health uptime sla integrity governance 3003 3004 3005 probes verify",
        badge: view === "watchdog" ? { text: "CURRENT", tone: "lime" } : undefined,
        run: () => switchView("watchdog"),
      },
      {
        id: "view-governance",
        group: "VIEW",
        label: "Switch to ▸ GOVERNANCE · THE PERMIT KERNEL",
        hint: "Round 56 · SIL slice · Ed25519 permits · single-use nonces",
        icon: ShieldCheck,
        keywords:
          "governance kernel permit ed25519 nonce actuator worm chain asil hazard consent sil enforcement audit",
        badge: view === "governance" ? { text: "CURRENT", tone: "lime" } : undefined,
        run: () => switchView("governance"),
      },
      {
        id: "view-firstprinciples",
        group: "VIEW",
        label: "Switch to ▸ FIRST PRINCIPLES · THE SUBSTRATE",
        hint: "Chemistry · physics · biology · maths — the laws beneath the signals",
        icon: FlaskConical,
        keywords:
          "first principles substrate chemistry physics biology maths laws signals ph turbidity pressure flow coupling spec measured",
        badge: view === "firstprinciples" ? { text: "CURRENT", tone: "lime" } : undefined,
        run: () => switchView("firstprinciples"),
      },
      {
        id: "view-safegrid",
        group: "VIEW",
        label: "Switch to ▸ SAFEGRID · EVIDENCE RELAY",
        hint: "Round 57 · fail-closed suppression · outbox pipeline · WORM seals · :3008",
        icon: Cable,
        keywords:
          "safegrid evidence relay outbox worm seal chain fail closed suppression alert decision tenant consent policy epoch backlog reconcile relay tick",
        badge: view === "safegrid" ? { text: "CURRENT", tone: "lime" } : undefined,
        run: () => switchView("safegrid"),
      },
      {
        id: "view-records",
        group: "VIEW",
        label: "Switch to ▸ PROXIMITY · RECORD LAYER",
        hint: "Round 60 · contract → gate → seal → verify · tamper demo pinpoints the break",
        icon: ScanLine,
        keywords:
          "proximity records record layer scan contract governance gate seal worm chain verify tamper immutable boundary simulator production integer risk suppress",
        badge: view === "records" ? { text: "CURRENT", tone: "lime" } : undefined,
        run: () => switchView("records"),
      },
      {
        id: "view-receipts",
        group: "VIEW",
        label: "Switch to ▸ RECEIPTS · CROSS-RAIL CHAIN",
        hint: "Ctrl+7 · bridge :3004 / field :3005 · verify from genesis",
        icon: Receipt,
        keywords: "receipts chain merkle root verify genesis bridge field rails anchor",
        badge: view === "receipts" ? { text: "CURRENT", tone: "lime" } : undefined,
        run: () => switchView("receipts"),
      },
      {
        id: "view-settings",
        group: "VIEW",
        label: "Switch to ▸ SETTINGS",
        hint: "Ctrl+0 · Lindiwe memory · pins · preferences",
        icon: Settings2,
        keywords:
          "settings preferences lindiwe tutor memory mastery pins dock keyboard map shortcuts reset",
        badge: view === "settings" ? { text: "CURRENT", tone: "lime" } : undefined,
        run: () => switchView("settings"),
      },
      {
        id: "view-pools",
        group: "VIEW",
        label: "Switch to ▸ UBUNTU POOLS",
        hint: "Ctrl+8 · community pool view · contribution ≠ access",
        icon: Coins,
        keywords:
          "pools ubuntu community r5 r10 contribution access tiers winter pools mk-i funding separation",
        badge: view === "pools" ? { text: "CURRENT", tone: "lime" } : undefined,
        run: () => switchView("pools"),
      },
      {
        id: "view-docs",
        group: "VIEW",
        label: "Switch to ▸ DOCUMENTS · FIELD ACCESS",
        hint: "phone-first carry · QR access · every document readable",
        icon: BookOpenText,
        keywords: "documents field access qr phone pitch price card compliance pack email drafts",
        badge: view === "docs" ? { text: "CURRENT", tone: "lime" } : undefined,
        run: () => switchView("docs"),
      },
      {
        id: "view-ops",
        group: "VIEW",
        label: "Switch to ▸ OPERATIONS LOOP",
        hint: "field sales → back office · OPS_SWEEP_30M · pilot plays",
        icon: Briefcase,
        keywords:
          "operations ops loop sweep 30m field sales back office price cards b2b pilot plays compliance",
        badge: view === "ops" ? { text: "CURRENT", tone: "lime" } : undefined,
        run: () => switchView("ops"),
      },
      // Task 48 — the recovered lost-lineage projections (r31–r37 work
      // preserved in the /tmp snapshot; same VIEW-group pattern, appended).
      {
        id: "view-fleet",
        group: "VIEW",
        label: "Switch to ▸ DEVICE FLEET & ONBOARDING",
        hint: "Mk-0.5 fleet set · onboarding flow · seven documents from disk",
        icon: Cpu,
        keywords:
          "fleet device mk-0.5 mk05 tablet onboarding pipeline engine device mesh discovery protocol unified consent model blog four smart purchases",
        badge: view === "fleet" ? { text: "CURRENT", tone: "lime" } : undefined,
        run: () => switchView("fleet"),
      },
      {
        id: "view-broadcast",
        group: "VIEW",
        label: "Switch to ▸ BROADCAST · CREATOR LAYER",
        hint: "Mk-0.5 Pro tablet · subscription ledger · host rotation",
        icon: RadioTower,
        keywords:
          "broadcast creator mk-0.5 pro tablet subscription ledger b2b gift program influencer licence challenge format live routing creator agreement host rotation",
        badge: view === "broadcast" ? { text: "CURRENT", tone: "lime" } : undefined,
        run: () => switchView("broadcast"),
      },
      {
        id: "view-trust",
        group: "VIEW",
        label: "Switch to ▸ VVU-TRUST · COMMUNITY COMPUTE POOL",
        hint: "8-bit onboarding game · stokvel terms · smoke sweep receipts",
        icon: Users,
        keywords:
          "vvu-trust trust community compute pool stokvel terms onboarding 8-bit micro-city game three-valued status smoke sweep receipts program levels",
        badge: view === "trust" ? { text: "CURRENT", tone: "lime" } : undefined,
        run: () => switchView("trust"),
      },
      // Task 16-a — DAYSHIFT theme toggle, mirrored 1:1 from the header sun
      // button (VvuHeader.tsx): same setTheme call, same THEME_TOGGLE ·
      // OPERATOR WORM audit, same stable toast id 'theme-toggle'. Appended to
      // the VIEW group — no group renumbering, no new GroupId.
      {
        id: "view-theme-toggle",
        group: "VIEW",
        label: "Toggle DAYSHIFT light ops mode",
        hint: "high-contrast light theme for bright control rooms",
        icon: SunMoon,
        keywords:
          "theme dayshift light dark mode toggle nightwatch contrast bright control room ops",
        run: () => {
          const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
          setTheme(next);
          sendWormLog(
            "THEME_TOGGLE",
            "OPERATOR",
            next === "light" ? "DAYSHIFT light ops mode" : "NIGHTWATCH scada dark mode",
          );
          toast(next === "light" ? "DAYSHIFT · LIGHT OPS MODE" : "NIGHTWATCH · SCADA DARK MODE", {
            id: "theme-toggle",
            description: next === "light" ? "high-contrast ops theme" : "standard SCADA palette",
          });
        },
      },
    );

    // PROJECTION — spatial sub-mode via CustomEvent (SpatialWorkspace owns the state)
    const setProjection = (mode: "city" | "mesh" | "map") => {
      window.dispatchEvent(new CustomEvent<string>("vvu:set-projection", { detail: mode }));
      const label =
        mode === "city" ? "CITY TWIN · MAP_SYNC" : mode === "mesh" ? "3D RIG MESH" : "TACTICAL MAP";
      sendWormLog("VIEW_MODE", "COMMAND_PALETTE", `palette → ${label}`);
      toast.success(`${label} projection`, {
        description: "VIEW_MODE WORM-logged · applied in SPATIAL_INTELLIGENCE view",
      });
    };
    list.push(
      {
        id: "proj-city",
        group: "PROJECTION",
        label: "CITY TWIN view",
        hint: "GIS bench · N01–N06 on pipelines · 5 layers · YOLO",
        icon: Building2,
        keywords:
          "projection city twin gis bench map sync pipelines yolo layers digital twin view mode spatial",
        badge: { text: "MAP_SYNC", tone: "lime" },
        run: () => setProjection("city"),
      },
      {
        id: "proj-mesh",
        group: "PROJECTION",
        label: "3D RIG MESH view",
        hint: "Three.js rig scene · node inspector",
        icon: Boxes,
        keywords: "projection mesh 3d three rig scene view mode spatial",
        run: () => setProjection("mesh"),
      },
      {
        id: "proj-map",
        group: "PROJECTION",
        label: "TACTICAL MAP view",
        hint: "Canvas 2D ENU · radar sweep · geofence",
        icon: Map,
        keywords: "projection map tactical 2d enu canvas view mode spatial",
        run: () => setProjection("map"),
      },
    );

    // FSM COMMANDS — legal-edge aware σ input
    // Task 11-d — FSM STATE quick-glance: read-only live snapshot of the edge
    // FSM + sim clock (no σ emitted, no sim mutation) from any view; the
    // operator intent is WORM-logged like the other palette reads. Stable
    // toast id 'fsm-glance' — repeated glances replace, never stack.
    list.push({
      id: "fsm-state-glance",
      group: "FSM COMMANDS",
      label: "FSM STATE quick-glance",
      hint: `${fsmNow} · live snapshot toast · read-only`,
      icon: Activity,
      keywords: "fsm state status glance snapshot steady clock uptime sim month day",
      badge: connected ? { text: "LIVE", tone: "lime" } : { text: "LINK DOWN", tone: "amber" },
      run: () => {
        const f = useVvuSocketStore.getState().frame;
        const m = f?.metrics;
        const desc = m
          ? `M${m.simMonth}·D${m.simDay} · ${m.steadyStateHours.toFixed(1)}H STEADY${m.steadyFrozen ? " · FROZEN HOLD" : ""} · ${m.nodesSteady}/12 NODES STEADY · SIM ×${m.speedMultiplier} · ${m.customers} CUST · MRR R${(m.mrr / 1000).toFixed(1)}k`
          : "no telemetry frame yet — awaiting edge snapshot";
        toast(`${f?.fsmState ?? fsmNow} · EDGE FSM`, { id: "fsm-glance", description: desc });
        sendWormLog(
          "FSM_GLANCE",
          "OPERATOR",
          `palette glance · ${f?.fsmState ?? fsmNow} · M${m?.simMonth ?? "—"}·D${m?.simDay ?? "—"} · ×${m?.speedMultiplier ?? "—"}`,
        );
      },
    });
    for (const def of FSM_DEFS) {
      const illegal = !legalEdges.includes(def.sym);
      list.push({
        id: `fsm-${def.sym.toLowerCase()}`,
        group: "FSM COMMANDS",
        label: def.label,
        hint: illegal ? `${def.hint} · illegal from ${fsmNow}` : def.hint,
        icon: def.icon,
        color: def.color,
        keywords: `fsm symbol ${def.sym.toLowerCase()} ${def.label.toLowerCase()}`,
        badge: illegal ? { text: "ILLEGAL δ", tone: "crimson" } : { text: "FSM", tone: "sage" },
        illegal,
        run: () => {
          sendFsmCommand(def.sym);
          // The spatial FsmPanel already toasts the emit + guard rejection where
          // it is mounted; mirror that feedback on the analytics view only.
          // Same 'fsm-emit' id as FsmPanel's toast so the two views agree and
          // rapid σ repeats REPLACE the toast instead of stacking a flood.
          if (view === "analytics") {
            toast(`σ ${def.sym} EMITTED`, {
              id: "fsm-emit",
              description: illegal
                ? `illegal δ from ${fsmNow} — guard will reject`
                : "edge FSM command dispatched over socket",
            });
          }
        },
      });
    }

    // SIMULATION — speed, gate fast-paths, demo reset
    const speeds: Array<{ mult: 1 | 5 | 20; icon: LucideIcon; hint: string }> = [
      { mult: 1, icon: Gauge, hint: "real-time · 1.5s cadence" },
      { mult: 5, icon: Zap, hint: "business clock ×5 · customers + MRR accrual" },
      { mult: 20, icon: FastForward, hint: "business clock ×20 · month rollover ~2 min" },
    ];
    for (const s of speeds) {
      list.push({
        id: `sim-speed-${s.mult}`,
        group: "SIMULATION",
        label: `SIM speed ×${s.mult}`,
        hint: s.hint,
        icon: s.icon,
        keywords: `sim speed multiplier ${s.mult}x fast realtime`,
        badge:
          speedMult === s.mult
            ? { text: "CURRENT", tone: "lime" }
            : { text: `×${s.mult}`, tone: "sage" },
        run: () => {
          setSimSpeed(s.mult);
          toast.success(`SIM SPEED ×${s.mult}`, {
            description: "SIM_SPEED WORM-logged · clamped 1–20",
          });
        },
      });
    }
    const gates: Array<{ gate: "3A" | "3B" | "3C"; hint: string }> = [
      { gate: "3A", hint: "customers ≥ 1 · MRR R5k" },
      { gate: "3B", hint: "MRR R50k · 2 consecutive months" },
      { gate: "3C", hint: "72h steady · 3 nodes steady" },
    ];
    for (const g of gates) {
      list.push({
        id: `sim-skip-${g.gate.toLowerCase()}`,
        group: "SIMULATION",
        label: `SKIP → GATE ${g.gate} condition`,
        hint: `${g.hint} · certification still required`,
        icon: SkipForward,
        color: "#e0a030",
        keywords: `skip gate ${g.gate.toLowerCase()} fast path demo jump`,
        badge: { text: "AMBER", tone: "amber" },
        run: () => {
          simSkip(g.gate);
          toast.warning(`SKIP → GATE ${g.gate}`, {
            description: "fast-path business metrics — certification still required",
          });
        },
      });
    }
    list.push({
      id: "sim-reset-demo",
      group: "SIMULATION",
      label: "RESET DEMO STATE",
      hint: "fresh demo · MRR R5k · 1 customer · 66.2h steady",
      icon: RefreshCw,
      color: "#e5484d",
      keywords: "reset demo fresh state restart clear wipe",
      badge: { text: "CRIMSON", tone: "crimson" },
      run: () => {
        simSkip("RESET_DEMO");
        toast.success("DEMO STATE RESET", {
          description: "MRR R5k · 1 customer · 66.2h steady · ×1 speed",
        });
      },
    });

    // ACTIONS
    list.push(
      {
        id: "act-verify-worm",
        group: "ACTIONS",
        label: "Verify WORM chain",
        hint: "invalidate ledger query · re-fetch + SHA-256 recompute",
        icon: ShieldCheck,
        keywords: "verify worm chain ledger sha256 audit recheck",
        badge: { text: "QUERY", tone: "teal" },
        run: () => {
          void queryClient.invalidateQueries({ queryKey: ["vvu-ledger"] });
          toast.success("ledger re-verified", {
            description: "TanStack query invalidated · fresh fetch",
          });
        },
      },
      {
        id: "act-copy-whatsapp",
        group: "ACTIONS",
        label: "Copy WhatsApp verify script",
        hint: "CIPC · B-BBEE Level 1 · SARS → clipboard",
        icon: Copy,
        keywords: "copy whatsapp verify script clipboard cipc sars bbbee procurement message",
        badge: { text: "CLIP", tone: "teal" },
        run: () => {
          void navigator.clipboard
            .writeText(VERIFY_SCRIPT)
            .then(() =>
              toast.success("WhatsApp verify script copied", {
                description: "/verify message ready to paste",
              }),
            )
            .catch(() =>
              toast.error("CLIPBOARD UNAVAILABLE", {
                description: "navigator.clipboard blocked — copy manually",
              }),
            );
        },
      },
    );

    return list;
  }, [
    view,
    setView,
    setTheme,
    sendWormLog,
    sendFsmCommand,
    setSimSpeed,
    simSkip,
    queryClient,
    legalEdges,
    fsmNow,
    speedMult,
    connected,
  ]);

  // ── filtering (token AND match over label + group + keywords + hint) ──
  const filtered = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return commands;
    return commands.filter((c) => {
      const haystack = `${c.label} ${c.group} ${c.keywords} ${c.hint}`.toLowerCase();
      return tokens.every((t) => haystack.includes(t));
    });
  }, [commands, query]);

  const safeIndex = filtered.length === 0 ? 0 : Math.min(activeIndex, filtered.length - 1);
  const activeCmd = filtered.length === 0 ? null : filtered[safeIndex];
  const activeId = activeCmd ? `vvu-cmd-${activeCmd.id}` : "";

  // Keep the active row in view while navigating.
  useEffect(() => {
    if (!open || !activeId) return;
    document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [activeId, open]);

  const runCommand = useCallback(
    (cmd: PaletteCommand) => {
      setAnnounce(`Ran ${cmd.label}`);
      cmd.run();
      closePalette();
    },
    [closePalette],
  );

  const handleQueryChange = (e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setActiveIndex(0);
  };

  // ── dialog keyboard: ↑↓ Home End Enter Esc + Tab focus trap ──
  const handleDialogKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closePalette("Command palette closed · Escape");
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (filtered.length > 0) setActiveIndex((safeIndex + 1) % filtered.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (filtered.length > 0) setActiveIndex((safeIndex - 1 + filtered.length) % filtered.length);
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      if (filtered.length > 0) setActiveIndex(filtered.length - 1);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (activeCmd) runCommand(activeCmd);
      return;
    }
    if (e.key === "Tab") {
      // focus trap — cycle input ↔ active row only; never leave the dialog.
      e.preventDefault();
      const inputEl = inputRef.current;
      if (!inputEl) return;
      if (document.activeElement === inputEl) {
        if (filtered.length === 0) return;
        document.getElementById(`vvu-cmd-${filtered[safeIndex].id}`)?.focus();
      } else {
        inputEl.focus();
      }
    }
  };

  const fsmColor = FSM_COLOR[fsmNow] ?? "#7a8a6e";

  return (
    <>
      <div aria-live="polite" role="status" className="sr-only">
        {announce}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            key="vvu-palette-backdrop"
            className="fixed inset-0 z-[100] flex items-start justify-center bg-[rgba(6,8,6,0.85)] backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) closePalette("Command palette closed");
            }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Command palette"
              data-vvu="command-palette"
              onKeyDown={handleDialogKeyDown}
              initial={{ scale: 0.98, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.98, opacity: 0, y: 8 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
              className="w-full sm:w-[560px] sm:max-w-[560px] max-h-[86vh] sm:max-h-[64vh] flex flex-col rounded-b-lg sm:rounded-lg border-x border-b sm:border border-[rgba(107,138,64,0.35)] shadow-[0_24px_80px_rgba(0,0,0,0.6)] overflow-hidden"
              style={{ background: "rgba(11,15,10,0.92)" }}
            >
              {/* ── filter input row ── */}
              <div className="flex items-center gap-2.5 h-[52px] min-h-[52px] px-3.5 border-b border-[rgba(107,138,64,0.25)] shrink-0">
                <Search className="size-3.5 shrink-0 text-[#8fb35a]" aria-hidden />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={handleQueryChange}
                  inputMode="search"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder="type to command · ↑↓ navigate · ⏎ run"
                  aria-label="Search commands"
                  role="combobox"
                  aria-expanded="true"
                  aria-autocomplete="list"
                  aria-controls="vvu-palette-listbox"
                  aria-owns="vvu-palette-listbox"
                  aria-activedescendant={activeId || undefined}
                  className="flex-1 min-w-0 bg-transparent outline-none border-none font-mono text-[12px] text-[#d7e2c9] placeholder:text-[#5a6a50] placeholder:font-mono"
                />
                <KbdChip tone="sage">ESC</KbdChip>
              </div>

              {/* ── command list ── */}
              <div
                id="vvu-palette-listbox"
                role="listbox"
                aria-label="Commands"
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-1"
              >
                {filtered.length === 0 ? (
                  <div className="vvu-label text-[8px] text-[#7a8a6e] text-center py-10 vvu-blink">
                    NO COMMANDS MATCH — ESC TO CLEAR
                  </div>
                ) : (
                  GROUP_ORDER.map((g) => {
                    const items = filtered.filter((c) => c.group === g);
                    if (items.length === 0) return null;
                    const offline = (g === "FSM COMMANDS" || g === "SIMULATION") && !connected;
                    return (
                      <div key={g}>
                        <div className="flex items-center gap-1.5 px-3.5 pt-2 pb-1">
                          <span
                            className="inline-block size-1.5 shrink-0"
                            style={{ background: GROUP_SQUARE[g] }}
                            aria-hidden
                          />
                          <span className="vvu-label text-[6.5px] font-bold tracking-[0.22em] text-[#7a8a6e]">
                            {g}
                          </span>
                          {offline && (
                            <span className="vvu-label ml-auto text-[6px] text-[#7a8a6e] px-1.5 py-[2px] rounded-sm border border-[rgba(122,138,110,0.35)]">
                              TELEMETRY OFFLINE
                            </span>
                          )}
                        </div>
                        {items.map((cmd) => {
                          const idx = filtered.indexOf(cmd);
                          const isActive = idx === safeIndex;
                          const Icon = cmd.icon;
                          return (
                            <div
                              key={cmd.id}
                              id={`vvu-cmd-${cmd.id}`}
                              role="option"
                              aria-selected={isActive}
                              tabIndex={-1}
                              onClick={() => runCommand(cmd)}
                              onMouseEnter={() => setActiveIndex(idx)}
                              onFocus={() => setActiveIndex(idx)}
                              className={`flex items-center gap-2.5 min-h-[44px] pl-3.5 pr-3 cursor-pointer select-none outline-none transition-colors ${
                                isActive ? "bg-[rgba(200,255,0,0.08)]" : ""
                              } ${cmd.illegal ? "opacity-45" : ""}`}
                              style={isActive ? { boxShadow: "inset 2px 0 0 #c8ff00" } : undefined}
                            >
                              <Icon
                                className="size-3.5 shrink-0"
                                style={{ color: cmd.color ?? "#8fb35a" }}
                                aria-hidden
                              />
                              <div className="min-w-0 flex-1">
                                <div
                                  className={`font-mono text-[11px] leading-tight truncate ${
                                    cmd.illegal ? "text-[#7a8a6e]" : "text-[#d7e2c9]"
                                  }`}
                                >
                                  {cmd.label}
                                </div>
                                <div className="vvu-label text-[6.5px] text-[#5a6a50] leading-tight truncate mt-0.5">
                                  {cmd.hint}
                                </div>
                              </div>
                              <div className="shrink-0 flex items-center gap-1">
                                {cmd.badge && (
                                  <KbdChip tone={cmd.badge.tone}>{cmd.badge.text}</KbdChip>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>

              {/* ── live context footer ── */}
              <div className="flex items-center gap-2.5 h-9 min-h-9 px-3.5 border-t border-[rgba(107,138,64,0.25)] shrink-0 vvu-label text-[6.5px] text-[#7a8a6e] overflow-hidden flex-nowrap">
                <span className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                  <span
                    className="inline-block size-1.5"
                    style={{ background: fsmColor }}
                    aria-hidden
                  />
                  <span style={{ color: fsmColor }}>{fsmNow}</span>
                </span>
                <span className="shrink-0 text-[#3d4a36]">│</span>
                <span className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                  <span
                    className={`inline-block size-1.5 rounded-full ${
                      connected ? "bg-[#c8ff00] vvu-pulse" : "bg-[#e0a030] vvu-blink"
                    }`}
                    aria-hidden
                  />
                  <span style={{ color: connected ? "#c8ff00" : "#e0a030" }}>
                    {connected ? "LINK LIVE" : "LINK DOWN"}
                  </span>
                </span>
                <span className="shrink-0 text-[#3d4a36]">│</span>
                <span className="shrink-0 whitespace-nowrap">
                  {view === "analytics" ? "ANALYTICS" : "SPATIAL_INTELLIGENCE"}
                </span>
                <span className="ml-auto shrink-0 whitespace-nowrap text-[#5a6a50] hidden sm:inline">
                  {filtered.length} CMD · ↑↓ ⏎
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default CommandPalette;
