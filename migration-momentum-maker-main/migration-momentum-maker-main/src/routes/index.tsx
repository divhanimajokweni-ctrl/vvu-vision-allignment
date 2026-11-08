import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { Suspense, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useHashRoute } from "@/hooks/use-hash-route";
import { useVvuSocketBootstrap } from "@/hooks/use-vvu-socket";
import { VvuHeader } from "@/components/vvu/VvuHeader";
import { VvuFooter } from "@/components/vvu/VvuFooter";
import { CommandPalette } from "@/components/vvu/CommandPalette";
import { ShortcutHelp } from "@/components/vvu/ShortcutHelp";
import WorkspaceToggle from "@/components/WorkspaceToggle";
import { WORKSPACES } from "@/components/workspaces/registry";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "VVU · Validation Dashboard — Venture Vision Ubuntu",
      },
      {
        name: "description",
        content:
          "VVU dual-projection dashboard: spatial intelligence verification in real-time (3D mesh · maps · telemetry) and the analyst view (Trust Gates 3A/3B/3C · MOI 70.66% · WORM ledger · B-BBEE).",
      },
      { property: "og:title", content: "VVU · Validation Dashboard — Venture Vision Ubuntu" },
      {
        property: "og:description",
        content:
          "VVU dual-projection dashboard: spatial intelligence verification in real-time (3D mesh · maps · telemetry) and the analyst view (Trust Gates 3A/3B/3C · MOI 70.66% · WORM ledger · B-BBEE).",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/logo.svg", type: "image/svg+xml" },
    ],
  }),
  component: Index,
});

// The keyboard layer (vanilla, loaded from /vvu-trust/surfaces/dashboard/) is
// chrome, not critical path — injected after mount like the source's
// lazyOnload strategy.
const KEYBOARD_SCRIPTS = [
  "/vvu-trust/surfaces/dashboard/lindiwe.js",
  "/vvu-trust/surfaces/dashboard/pinnable-panels.js",
  "/vvu-trust/surfaces/dashboard/keyboard-layer.js",
];

function ViewLoader({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#060806]">
      <div className="text-center">
        <div className="vvu-label text-2xl font-bold text-[#f3e38a] tracking-[0.3em]">VVU</div>
        <div className="vvu-label text-[9px] text-[#7a8a6e] mt-3 animate-pulse">{label}</div>
      </div>
    </div>
  );
}

/* The action bridge: the estate's real handlers for the vanilla keyboard
   layer's verbs. Everything else dispatches 'vvu:action'; unclaimed actions
   get the keyboard layer's honest status line. */
function ActionBridge() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const onAction = (e: Event) => {
      const detail = (e as CustomEvent<{ action: string; handled: boolean }>).detail;
      if (!detail) return;
      if (detail.action === "refresh") {
        detail.handled = true;
        void queryClient.invalidateQueries();
      }
    };
    window.addEventListener("vvu:action", onAction);
    return () => window.removeEventListener("vvu:action", onAction);
  }, [queryClient]);

  return null;
}

function Dashboard() {
  // The in-app telemetry feed (was the socket.io mini-service).
  useVvuSocketBootstrap();
  const [view] = useHashRoute();

  useEffect(() => {
    for (const src of KEYBOARD_SCRIPTS) {
      if (document.querySelector(`script[src="${src}"]`)) continue;
      const el = document.createElement("script");
      el.src = src;
      el.async = true;
      document.body.appendChild(el);
    }
  }, []);

  const entry = WORKSPACES[view] ?? WORKSPACES.spatial;
  const Workspace = entry.Component;

  return (
    <div className="min-h-screen flex flex-col bg-[#060806] text-[#c9d4bd]">
      <VvuHeader />
      <main className="relative flex-1 min-h-0 overflow-hidden">
        <Suspense fallback={<ViewLoader label={"INITIALIZING " + entry.label + "…"} />}>
          <Workspace />
        </Suspense>
      </main>
      <VvuFooter />
      <WorkspaceToggle />
      <CommandPalette />
      <ShortcutHelp />
      <ActionBridge />
    </div>
  );
}

function Index() {
  // The estate is a browser instrument (hash routing, keyboard layer, canvas
  // and 3D scenes) — it renders only after hydration.
  return (
    <ClientOnly fallback={<ViewLoader label="INITIALIZING THE ESTATE…" />}>
      <Dashboard />
    </ClientOnly>
  );
}
