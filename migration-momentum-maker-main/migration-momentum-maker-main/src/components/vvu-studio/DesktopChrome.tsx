/**
 * VVU · STUDIO — desktop chrome: title bar, activity bar, status bar, watch tile.
 */
"use client";
import { useStudio } from "@/lib/vvu-studio/store";
import { Icon, type IconName } from "./Icons";
import { VideoIcon } from "./Icons";
import type { ViewKey } from "@/lib/vvu-studio/types";

export function TitleBar() {
  return (
    <div className="flex h-[35px] items-center gap-2 border-b border-[var(--vs-border)] bg-[var(--vs-bg2)] px-3">
      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#f87171]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#fbbf24]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#34d399]" />
      </div>
      <div className="mono ml-3 text-[11px] text-[var(--vs-dim)]">
        VVU-STUDIO — <span className="text-[var(--vs-text2)]">paranoia-first learning environment</span>
      </div>
      <div className="mx-auto flex items-center gap-1">
        {["File", "Edit", "View", "Run", "Terminal", "Help"].map((m) => (
          <button key={m} className="mono rounded px-2 py-1 text-[11px] text-[var(--vs-dim)] hover:bg-[var(--vs-bg3)] hover:text-[var(--vs-text2)]">{m}</button>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--vs-accent)]" />
        <span className="mono text-[10px] text-[var(--vs-dim)]">live · client-side</span>
      </div>
    </div>
  );
}

const ACTIVITY: { icon: IconName; view?: ViewKey; toast?: string }[] = [
  { icon: "files" },
  { icon: "play", view: "loop" },
  { icon: "shield", view: "rules" },
  { icon: "layers", view: "receipts" },
  { icon: "lock", view: "items" },
  { icon: "search", toast: "search not implemented" },
  { icon: "git", toast: "the receipts are the history" },
  { icon: "ext", toast: "0 extensions" },
];

export function ActivityBar() {
  const openFile = useStudio((s) => s.openFile);
  const showToast = useStudio((s) => s.showToast);
  const active = useStudio((s) => s.activeTab);
  return (
    <div className="flex w-12 flex-col items-center border-r border-[var(--vs-border)] bg-[var(--vs-bg2)] py-2">
      {ACTIVITY.map((a, i) => {
        const isActive = a.view && active === a.view;
        return (
          <button
            key={i}
            onClick={() => (a.view ? openFile(a.view) : a.toast ? showToast(a.toast) : undefined)}
            className={
              "relative flex h-9 w-9 items-center justify-center rounded text-[var(--vs-dim)] transition-all hover:bg-[var(--vs-bg3)] hover:text-[var(--vs-text)] " +
              (isActive ? "text-[var(--vs-accent)]" : "")
            }
          >
            {isActive && <span className="absolute left-[-6px] top-2 bottom-2 w-0.5 rounded bg-[var(--vs-accent)]" />}
            <Icon name={a.icon} size={18} />
          </button>
        );
      })}
      <div className="flex-1" />
      <button className="flex h-9 w-9 items-center justify-center rounded text-[var(--vs-dim)] hover:bg-[var(--vs-bg3)] hover:text-[var(--vs-text)]"><Icon name="user" size={18} /></button>
      <button className="flex h-9 w-9 items-center justify-center rounded text-[var(--vs-dim)] hover:bg-[var(--vs-bg3)] hover:text-[var(--vs-text)]"><Icon name="settings" size={18} /></button>
    </div>
  );
}

export function StatusBar() {
  const ledgerLen = useStudio((s) => s.ledger.length);
  const receipts = useStudio((s) => s.receipts);
  const loopReceipts = useStudio((s) => s.loopReceipts.length);
  return (
    <div className="mono flex h-[22px] items-center gap-2 border-t border-[var(--vs-border)] bg-[var(--vs-bg2)] px-3 text-[10px] text-[var(--vs-dim)]">
      <span className="flex items-center gap-1 text-[var(--vs-text2)]"><Icon name="shield" size={11} /> main</span>
      <span>·</span>
      <span className="text-[var(--vs-accent)]">RECEIPTS: {loopReceipts}</span>
      <span>·</span>
      <span className="text-[var(--vs-amber)]">2 stubbed rules</span>
      <span>·</span>
      <span><strong className="font-semibold text-[var(--vs-amber)]">strong</strong> = suspicious</span>
      <span className="flex-1" />
      <span>Ln 1, Col 1</span>
      <span>·</span>
      <span>UTF-8</span>
      <span>·</span>
      <span className="text-[var(--vs-accent)]">VVU · v1.0</span>
      {ledgerLen > 0 && <><span>·</span><span>{ledgerLen} legacy</span></>}
      {receipts > 0 && <><span>·</span><span>{receipts} ive</span></>}
    </div>
  );
}

export function WatchTile() {
  const collapsed = useStudio((s) => s.watchCollapsed);
  const toggleWatch = useStudio((s) => s.toggleWatch);
  return (
    <div
      className={
        "fixed z-30 overflow-hidden rounded-lg border border-[var(--vs-border)] bg-[var(--vs-bg2)] shadow-2xl transition-all " +
        (collapsed
          ? "bottom-[calc(var(--vs-term-h)+30px)] right-[calc(var(--vs-agent-w)+14px)] w-[190px]"
          : "bottom-[calc(var(--vs-term-h)+30px)] right-[calc(var(--vs-agent-w)+14px)] w-[280px]")
      }
    >
      <button onClick={toggleWatch} className="flex w-full items-center gap-2 border-b border-[var(--vs-border)] px-3 py-2">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--vs-red)]" />
        <span className="mono text-[10px] uppercase tracking-[0.12em] text-[var(--vs-text2)]">SESSION · WATCH</span>
        <span className="mono ml-auto text-[10px] text-[var(--vs-dim)]">REC 12:04</span>
        <Icon name="chevron" size={12} className={collapsed ? "rotate-180 text-[var(--vs-dim)] transition-transform" : "text-[var(--vs-dim)] transition-transform"} />
      </button>
      {!collapsed && (
        <>
          <div className="relative aspect-video overflow-hidden bg-black">
            <div className="absolute left-0 right-0 h-px bg-[var(--vs-accent)]/40" style={{ animation: "vvu-scan 3s linear infinite" }} />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[var(--vs-dim)]">
              <VideoIcon size={28} className="text-[var(--vs-dimmer)]" />
              <span className="mono text-[10px] tracking-[0.18em]">LIVE SESSION</span>
              <span className="mono text-[9px] text-[var(--vs-dimmer)]">WebRTC stub — 0x0D</span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] text-[var(--vs-dim)]">
            <span className="text-[var(--vs-accent)]">● LIVE</span>
            <span>· 24 viewers</span>
            <span className="ml-auto">2.4 Mbps</span>
          </div>
        </>
      )}
    </div>
  );
}
