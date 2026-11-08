"use client";

import dynamic from "next/dynamic";
import { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  Layers,
  Scale,
  Flame,
  Cpu,
  Map as MapIcon,
  Boxes,
} from "lucide-react";
import { KpiBar } from "./KpiBar";
import { DeviceRegistry } from "./DeviceRegistry";
import { ChainInspector } from "./ChainInspector";
import { EvidenceDrawer } from "./EvidenceDrawer";
import { ReleaseLanternModal } from "./ReleaseLanternModal";
import { HelpOverlay } from "./HelpOverlay";
import { ChainGraphOverlay } from "./ChainGraphOverlay";
import { PricingTierPanel } from "./PricingTierPanel";
import { CheckoutModal } from "./CheckoutModal";
import { AnatomyOverlay } from "../anatomy/AnatomyOverlay";
import { MobileTabBar } from "./MobileTabBar";
import { useSkylanternStore } from "../hooks/useSkylanternStore";
import { useEvidenceStream } from "../hooks/useEvidenceStream";
import { skylanternApi } from "../lib/api";
import { toast } from "sonner";
import { skylanternConfig } from "../config";
import { cn } from "@/lib/utils";

// maplibre-gl is a browser library; load the map client-side only.
const SkylanternMap = dynamic(
  () => import("./SkylanternMap").then((m) => m.SkylanternMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-amber-400" />
          <span className="font-mono text-xs">initialising digital twin…</span>
        </div>
      </div>
    ),
  }
);

export function SkylanternDashboard() {
  const {
    evidence,
    selectedEvidence,
    selectedEvidenceId,
    isDrawerOpen,
    isReleaseModalOpen,
    isChainInspectorOpen,
    isDeviceRegistryOpen,
    isHelpOpen,
    isChainGraphOpen,
    isPricingOpen,
    isCheckoutOpen,
    isAnatomyOpen,
    autoRelease,
    devices,
    mobileView,
    selectEvidence,
    openDrawer,
    closeDrawer,
    closeReleaseModal,
    openReleaseModal,
    toggleAutoRelease,
    toggleChainInspector,
    toggleDeviceRegistry,
    toggleHelp,
    toggleChainGraph,
    toggleAnatomy,
    togglePricing,
    closeCheckout,
    setMobileView,
    attachWitnessFromStore,
  } = useDashboardStore();

  useEvidenceStream({ intervalMs: 4000 });

  // Auto-release loop: every 6s, when enabled, simulate a new sky lantern.
  useEffect(() => {
    if (!autoRelease) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      try {
        const { evidence: ev } = await skylanternApi.simulate();
        if (!cancelled) {
          toast(`Auto-released block #${ev.sequence}`, {
            description: `${ev.device.label} · ${ev.verificationState}`,
          });
        }
      } catch {
        // swallow
      }
    };
    tick();
    const handle = setInterval(tick, 6000);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [autoRelease]);

  // ---- Keyboard shortcuts ----
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.tagName === "SELECT")
      ) {
        return;
      }
      if (e.key === "Escape") {
        if (isAnatomyOpen) {
          toggleAnatomy();
          return;
        }
        if (isCheckoutOpen) {
          closeCheckout();
          return;
        }
        if (isPricingOpen) {
          togglePricing();
          return;
        }
        if (isChainGraphOpen) {
          toggleChainGraph();
          return;
        }
        if (isHelpOpen) {
          toggleHelp();
          return;
        }
        if (isReleaseModalOpen) {
          closeReleaseModal();
          return;
        }
        if (isDrawerOpen) {
          closeDrawer();
          return;
        }
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        toggleHelp();
        return;
      }
      if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        toggleAnatomy();
        return;
      }
      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        togglePricing();
        return;
      }
      if (e.key === "g" || e.key === "G") {
        e.preventDefault();
        toggleChainGraph();
        return;
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        openReleaseModal();
        return;
      }
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        skylanternApi
          .simulate()
          .then(({ evidence: ev }) =>
            toast.success(`Block #${ev.sequence} released`)
          )
          .catch((err) =>
            toast.error(err instanceof Error ? err.message : "Simulate failed")
          );
        return;
      }
      if (e.key === "v" || e.key === "V") {
        e.preventDefault();
        skylanternApi
          .verifyChain()
          .then((report) => {
            useSkylanternStore.getState().setChainIntegrity(report);
            if (report.tampered === 0) {
              toast.success(
                `Chain OK · ${report.verified}/${report.totalBlocks} blocks clean`
              );
            } else {
              toast.error(`${report.tampered} tampered block(s) detected`);
            }
          })
          .catch((err) =>
            toast.error(err instanceof Error ? err.message : "Verify failed")
          );
        return;
      }
      if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        toggleAutoRelease();
        return;
      }
      if (e.key === "[") {
        e.preventDefault();
        toggleDeviceRegistry();
        return;
      }
      if (e.key === "]") {
        e.preventDefault();
        toggleChainInspector();
        return;
      }
      // Mobile view shortcuts: 1=map, 2=devices, 3=chain
      if (e.key === "1") {
        e.preventDefault();
        setMobileView("map");
        return;
      }
      if (e.key === "2") {
        e.preventDefault();
        setMobileView("devices");
        return;
      }
      if (e.key === "3") {
        e.preventDefault();
        setMobileView("chain");
        return;
      }
    },
    [
      isChainGraphOpen,
      isHelpOpen,
      isReleaseModalOpen,
      isDrawerOpen,
      isPricingOpen,
      isCheckoutOpen,
      isAnatomyOpen,
      toggleChainGraph,
      toggleAnatomy,
      toggleHelp,
      togglePricing,
      closeCheckout,
      closeReleaseModal,
      closeDrawer,
      openReleaseModal,
      toggleAutoRelease,
      toggleDeviceRegistry,
      toggleChainInspector,
      setMobileView,
    ]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      <KpiBar />

      <main className="relative flex min-h-0 flex-1">
        {/* Left sidebar: device registry — hidden on mobile unless mobileView === 'devices' */}
        <AnimatePresence initial={false}>
          {isDeviceRegistryOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className={cn(
                "relative z-10 h-full overflow-hidden border-r border-slate-800 bg-slate-950/80",
                "hidden lg:block",
                mobileView === "devices" && "!flex lg:!block absolute inset-0 z-20 w-full !lg:w-[300px]"
              )}
            >
              <div className="h-full w-full lg:w-[300px]">
                <DeviceRegistry />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Mobile: show DeviceRegistry as a full-screen view */}
        <AnimatePresence initial={false}>
          {mobileView === "devices" && (
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="absolute inset-0 z-20 bg-slate-950 lg:hidden"
            >
              <DeviceRegistry />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center: the 3D map — FULLSCREEN, takes all available space.
            Panels are overlays, not sidebars. The map is the star. */}
        <section
          className={cn(
            "relative min-w-0 flex-1 bg-slate-950",
            mobileView !== "map" && "hidden lg:block"
          )}
          style={{ minWidth: 0 }}
        >
          <SkylanternMap
            evidence={evidence}
            selectedId={selectedEvidenceId}
            onSelect={(id) => {
              const ev = evidence.find((e) => e.id === id);
              if (ev) {
                selectEvidence(ev);
                openDrawer(id);
              }
            }}
          />
          {/* Top overlay: filter chips — hidden on mobile to save space */}
          <div className="pointer-events-none absolute left-1/2 top-3 z-10 hidden -translate-x-1/2 lg:block">
            <FilterChips />
          </div>
          {/* Empty state when there are no devices */}
          <AnimatePresence>
            {devices.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm"
              >
                <div className="pointer-events-auto max-w-sm rounded-xl border border-slate-800 bg-slate-950/90 p-6 text-center shadow-2xl">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 ring-1 ring-amber-500/30">
                    <Flame className="h-6 w-6 text-amber-400" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-100">
                    The chain is empty
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    No devices registered yet. The demo dataset will auto-seed
                    momentarily, or release your first sky lantern manually.
                  </p>
                  <button
                    onClick={() => openReleaseModal()}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-gradient-to-br from-amber-400 to-orange-600 px-4 py-2 text-sm font-medium text-white shadow-md hover:from-amber-500 hover:to-orange-700"
                  >
                    <Flame className="h-4 w-4" />
                    Release first lantern
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Right sidebar: worm chain inspector — hidden on mobile unless mobileView === 'chain' */}
        <AnimatePresence initial={false}>
          {isChainInspectorOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className={cn(
                "relative z-10 h-full overflow-hidden border-l border-slate-800 bg-slate-950/80",
                "hidden lg:block"
              )}
            >
              <div className="h-full w-[320px]">
                <ChainInspector />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Mobile: show ChainInspector as a full-screen view */}
        <AnimatePresence initial={false}>
          {mobileView === "chain" && (
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="absolute inset-0 z-20 bg-slate-950 lg:hidden"
            >
              <ChainInspector />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Slide-in evidence drawer */}
        <EvidenceDrawer
          evidence={selectedEvidence}
          open={isDrawerOpen}
          onClose={closeDrawer}
          onWitness={async () => {
            try {
              await attachWitnessFromStore();
              toast.success("Second witness attached · elevated to R2");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Witness failed");
            }
          }}
        />

        {/* Release modal */}
        <ReleaseLanternModal
          open={isReleaseModalOpen}
          onClose={closeReleaseModal}
        />

        {/* Help overlay */}
        <HelpOverlay open={isHelpOpen} onClose={toggleHelp} />

        {/* Chain graph overlay */}
        <ChainGraphOverlay open={isChainGraphOpen} onClose={toggleChainGraph} />

        {/* Pricing tier panel — the Commercial Constitution */}
        <PricingTierPanel open={isPricingOpen} onClose={togglePricing} />

        {/* Checkout modal — simulated Stripe checkout */}
        <CheckoutModal open={isCheckoutOpen} onClose={closeCheckout} />

        {/* Anatomy × VVU — Evidence Instrument overlay */}
        <AnatomyOverlay open={isAnatomyOpen} onClose={toggleAnatomy} />
      </main>

      {/* Mobile tab bar — hidden on desktop */}
      <MobileTabBar />

      <StickyFooter />
    </div>
  );
}

function useDashboardStore() {
  const evidence = useSkylanternStore((s) => s.evidence);
  const devices = useSkylanternStore((s) => s.devices);
  const selectedEvidence = useSkylanternStore((s) => s.selectedEvidence);
  const selectedEvidenceId = useSkylanternStore((s) => s.selectedEvidenceId);
  const isDrawerOpen = useSkylanternStore((s) => s.isDrawerOpen);
  const isReleaseModalOpen = useSkylanternStore((s) => s.isReleaseModalOpen);
  const isChainInspectorOpen = useSkylanternStore(
    (s) => s.isChainInspectorOpen
  );
  const isDeviceRegistryOpen = useSkylanternStore(
    (s) => s.isDeviceRegistryOpen
  );
  const isHelpOpen = useSkylanternStore((s) => s.isHelpOpen);
  const isChainGraphOpen = useSkylanternStore((s) => s.isChainGraphOpen);
  const isAnatomyOpen = useSkylanternStore((s) => s.isAnatomyOpen);
  const autoRelease = useSkylanternStore((s) => s.autoRelease);
  const mobileView = useSkylanternStore((s) => s.mobileView);
  const selectEvidence = useSkylanternStore((s) => s.selectEvidence);
  const openDrawer = useSkylanternStore((s) => s.openDrawer);
  const closeDrawer = useSkylanternStore((s) => s.closeDrawer);
  const closeReleaseModal = useSkylanternStore((s) => s.closeReleaseModal);
  const openReleaseModal = useSkylanternStore((s) => s.openReleaseModal);
  const toggleAutoRelease = useSkylanternStore((s) => s.toggleAutoRelease);
  const toggleChainInspector = useSkylanternStore(
    (s) => s.toggleChainInspector
  );
  const toggleDeviceRegistry = useSkylanternStore(
    (s) => s.toggleDeviceRegistry
  );
  const toggleHelp = useSkylanternStore((s) => s.toggleHelp);
  const toggleChainGraph = useSkylanternStore((s) => s.toggleChainGraph);
  const toggleAnatomy = useSkylanternStore((s) => s.toggleAnatomy);
  const isPricingOpen = useSkylanternStore((s) => s.isPricingOpen);
  const isCheckoutOpen = useSkylanternStore((s) => s.isCheckoutOpen);
  const togglePricing = useSkylanternStore((s) => s.togglePricing);
  const closeCheckout = useSkylanternStore((s) => s.closeCheckout);
  const setMobileView = useSkylanternStore((s) => s.setMobileView);

  const attachWitnessFromStore = async () => {
    if (!selectedEvidence) return;
    await skylanternApi.attachWitness({
      evidenceId: selectedEvidence.id,
      witnessType: "GNSS",
      witnessLabel: "External GNSS Anchor — operator-attached",
      witnessKeyHint: "gnss-zed-f9p-op",
    });
  };

  return {
    evidence,
    devices,
    selectedEvidence,
    selectedEvidenceId,
    isDrawerOpen,
    isReleaseModalOpen,
    isChainInspectorOpen,
    isDeviceRegistryOpen,
    isHelpOpen,
    isChainGraphOpen,
    isPricingOpen,
    isCheckoutOpen,
    isAnatomyOpen,
    autoRelease,
    mobileView,
    selectEvidence,
    openDrawer,
    closeDrawer,
    closeReleaseModal,
    openReleaseModal,
    toggleAutoRelease,
    toggleChainInspector,
    toggleDeviceRegistry,
    toggleHelp,
    toggleChainGraph,
    toggleAnatomy,
    togglePricing,
    closeCheckout,
    setMobileView,
    attachWitnessFromStore,
  };
}

function FilterChips() {
  const filterState = useSkylanternStore((s) => s.filterState);
  const setFilterState = useSkylanternStore((s) => s.setFilterState);
  const chips: { key: typeof filterState; label: string; color: string }[] = [
    { key: "ALL", label: "All", color: "#94a3b8" },
    { key: "CANDIDATE", label: "Candidate", color: "#f59e0b" },
    { key: "VERIFIED", label: "Verified", color: "#10b981" },
    { key: "TAMPER_DETECTED", label: "Tamper", color: "#ef4444" },
    { key: "ARCHIVED", label: "Archived", color: "#6b7280" },
  ];
  return (
    <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-slate-800 bg-slate-950/80 px-2 py-1 backdrop-blur">
      <Layers className="mr-1 h-3 w-3 text-slate-500" />
      {chips.map((c) => (
        <button
          key={c.key}
          onClick={() => setFilterState(c.key)}
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider transition-colors ${
            filterState === c.key
              ? "bg-slate-200 text-slate-900"
              : "text-slate-400 hover:bg-slate-800"
          }`}
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: c.color }}
          />
          {c.label}
        </button>
      ))}
    </div>
  );
}

function StickyFooter() {
  const totalEvidence = useSkylanternStore(
    (s) => s.stats?.totalEvidence ?? 0
  );
  const totalDevices = useSkylanternStore(
    (s) => s.stats?.totalDevices ?? 0
  );
  return (
    <footer className="relative z-10 border-t border-slate-800 bg-slate-950/95 px-4 py-2">
      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px]">
        <div className="flex items-center gap-2 text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          <span className="font-mono">
            One Primitive. Immutable Evidence. Honest Limits.
          </span>
          <span className="hidden text-slate-600 sm:inline">·</span>
          <span className="hidden text-slate-500 sm:inline">
            Zero Fabrication Rule enforced · we prove the record, not the reality.
          </span>
        </div>
        <div className="flex items-center gap-3 text-slate-500">
          <span className="flex items-center gap-1">
            <Cpu className="h-3.5 w-3.5" />
            {totalDevices} devices
          </span>
          <span className="text-slate-600">·</span>
          <span className="flex items-center gap-1">
            <Flame className="h-3.5 w-3.5 text-amber-400" />
            {totalEvidence} lanterns
          </span>
          <span className="hidden text-slate-600 md:inline">·</span>
          <span className="hidden items-center gap-1 md:flex">
            <Scale className="h-3.5 w-3.5" />
            R{skylanternConfig.pricingBandFloorZAR}–R
            {skylanternConfig.pricingBandCeilingZAR.toLocaleString("en-ZA")}
          </span>
          <span className="hidden text-slate-600 md:inline">·</span>
          <span className="hidden font-mono md:inline">
            {skylanternConfig.statusTier}
          </span>
        </div>
      </div>
    </footer>
  );
}
