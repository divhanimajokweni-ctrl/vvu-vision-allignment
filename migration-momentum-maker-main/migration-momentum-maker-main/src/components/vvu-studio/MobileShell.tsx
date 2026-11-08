/**
 * VVU · STUDIO — mobile chrome: header, tab strip, bottom nav, drawers.
 */
"use client";
import { useEffect, useState } from "react";
import { useStudio } from "@/lib/vvu-studio/store";
import { TAB_META, mobileLabel, groupOf } from "@/lib/vvu-studio/fs";
import { Icon, type IconName, MenuIcon, ChatIcon, EditorLogo, XIcon } from "./Icons";
import { Explorer } from "./Explorer";
import { Agent } from "./Agent";
import { Terminal } from "./Terminal";
import { WatchTileMobile } from "./WatchMobile";
import type { DrawerName, ViewKey } from "@/lib/vvu-studio/types";

const SUBTITLES: Record<string, string> = {
  loop: "the loop · record → rules → receipt → number",
  rules: "written-down deterministic rules",
  receipts: "hash + signature + timestamp",
  items: "close by producing the artifact",
  commit: "merkle root · single commitment",
  verify: "stranger-verify · sig + hashes + merkle proof",
  board: "public board · everything a stranger needs",
  tree: "merkle tree explorer · click a leaf",
  stats: "chain statistics · verdicts + sigs + rules",
  stakeholder: "what we built · what it proves · what's next",
  readme: "six things · one loop · the number goes up",
  doctrine: "computed · stubbed flagged · strong = suspicious",
  gates: "the rules (written down)",
  config: "studio configuration",
  lab0: "numbers are places",
  lab1: "reproducible randomness",
  lab2: "soulbound credentials",
  ive: "legacy 11-field pipeline",
  hash: "sorted JSON → SHA-256",
  depot: "ONE INSTRUMENT · R20,000 gate",
  ledger: "legacy WORM ledger",
  lesson0: "mathematics is a language",
  lesson1: "evidence independence",
  lesson2: "ERC-5192 / SBT",
  lesson3: "day-one depot protocol",
};

function extBadge(ext: "md" | "py" | "json") {
  const map = {
    md: { label: "M", color: "text-[var(--vs-blue)]" },
    py: { label: "P", color: "text-[var(--vs-yellow)]" },
    json: { label: "{}", color: "text-[var(--vs-orange)]" },
  } as const;
  const e = map[ext];
  return <span className={"mono flex h-4 w-4 items-center justify-center rounded text-[8px] font-bold " + e.color}>{e.label}</span>;
}

export function MobileHeader() {
  const drawer = useStudio((s) => s.drawer);
  const toggleDrawer = useStudio((s) => s.toggleDrawer);
  const active = useStudio((s) => s.activeTab);

  const label = active ? TAB_META[active].label : "no editor";
  const ext = active ? TAB_META[active].ext : "md";
  const sub = active ? SUBTITLES[active] ?? "vvu-studio" : "open a file from the explorer";

  return (
    <div
      className="fixed left-0 right-0 top-0 z-[60] flex items-center gap-1.5 border-b border-[var(--vs-border)] bg-[rgba(16,16,20,0.96)] px-1.5 backdrop-blur"
      style={{ height: "calc(52px + var(--vs-safe-top))", paddingTop: "var(--vs-safe-top)" }}
    >
      <button onClick={() => toggleDrawer("explorer")} className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--vs-text2)] hover:bg-[var(--vs-bg3)]" aria-label="Files">
        <MenuIcon size={20} />
      </button>
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center px-1">
        <div className="flex items-center gap-1.5">
          {extBadge(ext)}
          <span className="mono truncate text-[12.5px] text-[var(--vs-text)]">{label}</span>
        </div>
        <span className="mono truncate text-[9px] text-[var(--vs-dim)]">{sub}</span>
      </div>
      <button onClick={() => toggleDrawer("agent")} className="relative flex h-11 w-11 items-center justify-center rounded-lg text-[var(--vs-text2)] hover:bg-[var(--vs-bg3)]" aria-label="Agent">
        <ChatIcon size={20} />
        <span className="absolute right-2.5 top-2.5 h-[7px] w-[7px] rounded-full border-2 border-[var(--vs-bg2)] bg-[var(--vs-accent)]" />
      </button>
    </div>
  );
}

export function MobileTabs() {
  const openTabs = useStudio((s) => s.openTabs);
  const active = useStudio((s) => s.activeTab);
  const setActive = useStudio((s) => s.setActive);
  const closeTab = useStudio((s) => s.closeTab);
  return (
    <div
      className="fixed left-0 right-0 z-50 flex items-center border-b border-[var(--vs-border)] bg-[var(--vs-bg2)]"
      style={{ top: "calc(52px + var(--vs-safe-top))", height: 36 }}
    >
      <div className="vvu-no-scrollbar flex h-full items-stretch gap-0 overflow-x-auto">
        {openTabs.map((view: ViewKey) => {
          const meta = TAB_META[view];
          const isActive = active === view;
          return (
            <div
              key={view}
              onClick={() => setActive(view)}
              className={
                "group flex shrink-0 cursor-pointer items-center gap-1.5 px-3 text-[11px] " +
                (isActive ? "border-b-2 border-[var(--vs-accent)] text-[var(--vs-text)]" : "text-[var(--vs-dim)]")
              }
            >
              {extBadge(meta.ext)}
              <span className="mono">{mobileLabel(view)}</span>
              <button
                onClick={(e) => { e.stopPropagation(); closeTab(view); }}
                className="ml-0.5 text-[var(--vs-dimmer)] hover:text-[var(--vs-text)]"
                aria-label="Close"
              >
                <XIcon size={11} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const NAV: { label: string; icon: IconName; drawer?: DrawerName; editor?: boolean; dot?: "green" | "red" }[] = [
  { label: "FILES", icon: "files", drawer: "explorer" },
  { label: "TERM", icon: "terminal", drawer: "terminal" },
  { label: "EDITOR", icon: "ext", editor: true },
  { label: "AGENT", icon: "chat", drawer: "agent", dot: "green" },
  { label: "WATCH", icon: "video", drawer: "watch", dot: "red" },
];

export function BottomNav() {
  const drawer = useStudio((s) => s.drawer);
  const toggleDrawer = useStudio((s) => s.toggleDrawer);
  const closeAllDrawers = useStudio((s) => s.closeAllDrawers);
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[60] grid grid-cols-5 border-t border-[var(--vs-border)] bg-[rgba(16,16,20,0.98)] backdrop-blur"
      style={{ height: "calc(var(--vs-nav-h) + var(--vs-safe-bot))", paddingBottom: "var(--vs-safe-bot)" }}
    >
      {NAV.map((n) => {
        const isActive = n.editor ? drawer === null : drawer === n.drawer;
        return (
          <button
            key={n.label}
            onClick={() => (n.editor ? closeAllDrawers() : n.drawer ? toggleDrawer(n.drawer) : undefined)}
            className={
              "relative flex flex-col items-center justify-center gap-0.5 transition-colors " +
              (isActive ? "text-[var(--vs-accent)]" : "text-[var(--vs-dim)]")
            }
          >
            <div className="relative">
              <Icon name={n.icon} size={20} />
              {n.dot === "green" && <span className="absolute -right-1 -top-0.5 h-[7px] w-[7px] rounded-full border-2 border-[var(--vs-bg2)] bg-[var(--vs-accent)]" />}
              {n.dot === "red" && <span className="absolute -right-1 -top-0.5 h-[7px] w-[7px] animate-pulse rounded-full border-2 border-[var(--vs-bg2)] bg-[var(--vs-red)]" />}
            </div>
            <span className="mono text-[9px] tracking-[0.1em]">{n.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function DrawerBackdrop() {
  const drawer = useStudio((s) => s.drawer);
  const closeAllDrawers = useStudio((s) => s.closeAllDrawers);
  return (
    <div
      onClick={closeAllDrawers}
      className={
        "fixed inset-0 z-[55] bg-black/60 backdrop-blur-[2px] transition-opacity " +
        (drawer ? "opacity-100" : "pointer-events-none opacity-0")
      }
    />
  );
}

export function MobileDrawers() {
  const drawer = useStudio((s) => s.drawer);
  const closeDrawer = useStudio((s) => s.closeDrawer);

  return (
    <>
      <DrawerBackdrop />
      {/* Explorer drawer (left) */}
      <div
        className={
          "fixed bottom-0 left-0 top-0 z-[90] w-[86%] max-w-[330px] border-r border-[var(--vs-border)] bg-[var(--vs-bg2)] transition-transform duration-300 " +
          (drawer === "explorer" ? "translate-x-0" : "-translate-x-full")
        }
        style={{ transitionTimingFunction: "cubic-bezier(0.2,0.8,0.2,1)" }}
      >
        <Explorer />
      </div>

      {/* Agent drawer (right) */}
      <div
        className={
          "fixed bottom-0 right-0 top-0 z-[90] w-full max-w-[440px] border-l border-[var(--vs-border)] bg-[var(--vs-bg2)] transition-transform duration-300 " +
          (drawer === "agent" ? "translate-x-0" : "translate-x-full")
        }
        style={{ transitionTimingFunction: "cubic-bezier(0.2,0.8,0.2,1)" }}
      >
        <Agent />
      </div>

      {/* Terminal drawer (bottom sheet) */}
      <div
        className={
          "fixed bottom-0 left-0 right-0 z-[90] h-[66vh] rounded-t-2xl border-t border-[var(--vs-border)] bg-[var(--vs-bg2)] transition-transform duration-300 " +
          (drawer === "terminal" ? "translate-y-0" : "translate-y-full")
        }
        style={{ transitionTimingFunction: "cubic-bezier(0.2,0.8,0.2,1)", paddingBottom: "var(--vs-safe-bot)" }}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-[var(--vs-border3)]" />
        <div className="h-[calc(66vh-12px)]">
          <Terminal />
        </div>
      </div>

      {/* Watch drawer (bottom sheet) */}
      <div
        className={
          "fixed bottom-0 left-0 right-0 z-[90] h-[80vh] overflow-y-auto rounded-t-2xl border-t border-[var(--vs-border)] bg-[var(--vs-bg2)] transition-transform duration-300 " +
          (drawer === "watch" ? "translate-y-0" : "translate-y-full")
        }
        style={{ transitionTimingFunction: "cubic-bezier(0.2,0.8,0.2,1)", paddingBottom: "var(--vs-safe-bot)" }}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-[var(--vs-border3)]" />
        <div className="flex items-center justify-between px-4 pt-3">
          <span className="mono text-[12px] uppercase tracking-[0.14em] text-[var(--vs-text2)]">SESSION · WATCH</span>
          <button onClick={() => closeDrawer("watch")} className="rounded p-1.5 text-[var(--vs-dim)] hover:bg-[var(--vs-bg3)]"><XIcon size={16} /></button>
        </div>
        <WatchTileMobile />
      </div>
    </>
  );
}

export function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 899px)");
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return mobile;
}
