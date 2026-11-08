/**
 * VVU · STUDIO — the workspace shell.
 * Desktop: titlebar / activity / explorer / editor+terminal / agent / statusbar.
 * Mobile: header / tabs / editor / bottom-nav / drawers.
 *
 * 100% client-side. The browser is the validator.
 */
"use client";
import { useEffect } from "react";
import { useStudio } from "@/lib/vvu-studio/store";
import { useIsMobile } from "./MobileShell";
import { MobileHeader, MobileTabs, BottomNav, MobileDrawers } from "./MobileShell";
import { TitleBar, ActivityBar, StatusBar, WatchTile } from "./DesktopChrome";
import { DesktopTabs, Breadcrumb } from "./DesktopTabs";
import { Explorer } from "./Explorer";
import { Editor } from "./Editor";
import { Agent } from "./Agent";
import { Terminal } from "./Terminal";
import { ToastHost } from "./ToastHost";

function DesktopShell() {
  return (
    <div className="grid h-[100dvh] w-full" style={{ gridTemplateRows: "35px 1fr 22px" }}>
      <TitleBar />
      <div
        className="grid overflow-hidden"
        style={{ gridTemplateColumns: "48px var(--vs-explorer-w) 1fr var(--vs-agent-w)" }}
      >
        <ActivityBar />
        <div className="border-r border-[var(--vs-border)] bg-[var(--vs-bg2)]"><Explorer /></div>

        {/* center: tabs / editor (scroll) / terminal — non-overlapping rows */}
        <div className="grid overflow-hidden" style={{ gridTemplateRows: "35px 1fr var(--vs-term-h)" }}>
          <DesktopTabs />
          <div className="overflow-hidden bg-[var(--vs-bg)]">
            <Breadcrumb />
            <div className="h-[calc(100%-22px)] overflow-y-auto">
              <Editor />
            </div>
          </div>
          <div className="border-t border-[var(--vs-border)] bg-[var(--vs-bg2)]">
            <DesktopTerminal />
          </div>
        </div>

        <div className="border-l border-[var(--vs-border)] bg-[var(--vs-bg2)]">
          <Agent />
        </div>
      </div>
      <StatusBar />
      <WatchTile />
    </div>
  );
}

function DesktopTerminal() {
  return <Terminal />;
}

function MobileShell() {
  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden">
      <MobileHeader />
      <MobileTabs />
      <div
        className="flex-1 overflow-y-auto bg-[var(--vs-bg)]"
        style={{
          paddingTop: "calc(52px + 36px + var(--vs-safe-top))",
          paddingBottom: "calc(var(--vs-nav-h) + var(--vs-safe-bot))",
        }}
      >
        <Editor />
      </div>
      <BottomNav />
      <MobileDrawers />
    </div>
  );
}

export function StudioShell() {
  const mobile = useIsMobile();
  const runTerminal = useStudio((s) => s.runTerminal);
  const toggleDrawer = useStudio((s) => s.toggleDrawer);
  const closeAllDrawers = useStudio((s) => s.closeAllDrawers);
  const lab0Move = useStudio((s) => s.lab0Move);
  const active = useStudio((s) => s.activeTab);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
      if ((e.ctrlKey || e.metaKey) && e.key === "`") {
        e.preventDefault();
        toggleDrawer("terminal");
        return;
      }
      if (e.key === "Escape") {
        closeAllDrawers();
        return;
      }
      if (typing) return;
      if (active === "lab0") {
        if (e.key === "ArrowLeft") { e.preventDefault(); lab0Move(-1, 0); }
        else if (e.key === "ArrowRight") { e.preventDefault(); lab0Move(1, 0); }
        else if (e.key === "ArrowUp") { e.preventDefault(); lab0Move(0, 1); }
        else if (e.key === "ArrowDown") { e.preventDefault(); lab0Move(0, -1); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, toggleDrawer, closeAllDrawers, lab0Move]);

  void runTerminal; // terminal commands are dispatched inside the Terminal component

  // doctrine banner (once)
  useEffect(() => {
    if (typeof console !== "undefined") {
      console.log("VVU · STUDIO — paranoia-first workspace ready");
      console.log("doctrine: computed gates · stubbed gates flagged · strong = suspicious");
    }
  }, []);

  // on mount: sign any pending receipts (genesis) with real Ed25519 or honest stub
  const signAllPending = useStudio((s) => s.signAllPending);
  useEffect(() => { void signAllPending(); }, [signAllPending]);

  return (
    <div className="vvu-studio fixed inset-0 overflow-hidden">
      {mobile ? <MobileShell /> : <DesktopShell />}
      <ToastHost />
    </div>
  );
}
