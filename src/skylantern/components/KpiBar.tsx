"use client";

import {
  Flame,
  Boxes,
  ShieldCheck,
  Hourglass,
  TriangleAlert,
  Activity,
  Cpu,
  Link2,
  RefreshCw,
  PlayCircle,
  PauseCircle,
  ChevronLeft,
  ChevronRight,
  ShieldCheck as ShieldVerify,
  Loader2,
  CircleCheck,
  CircleAlert,
  Keyboard,
  Network,
  Crown,
  Microscope,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { useSkylanternStore } from "../hooks/useSkylanternStore";
import { skylanternApi } from "../lib/api";
import { toast } from "sonner";
import { relativeTime } from "../lib/format";
import { skylanternConfig } from "../config";
import { cn } from "@/lib/utils";

export function KpiBar() {
  const stats = useSkylanternStore((s) => s.stats);
  const lastUpdated = useSkylanternStore((s) => s.lastUpdated);
  const isLoading = useSkylanternStore((s) => s.isLoading);
  const autoRelease = useSkylanternStore((s) => s.autoRelease);
  const toggleAutoRelease = useSkylanternStore((s) => s.toggleAutoRelease);
  const openReleaseModal = useSkylanternStore((s) => s.openReleaseModal);
  const toggleChainInspector = useSkylanternStore(
    (s) => s.toggleChainInspector
  );
  const toggleDeviceRegistry = useSkylanternStore(
    (s) => s.toggleDeviceRegistry
  );
  const toggleHelp = useSkylanternStore((s) => s.toggleHelp);
  const toggleChainGraph = useSkylanternStore((s) => s.toggleChainGraph);
  const togglePricing = useSkylanternStore((s) => s.togglePricing);
  const toggleAnatomy = useSkylanternStore((s) => s.toggleAnatomy);
  const subscriptions = useSkylanternStore((s) => s.subscriptions);
  const chainIntegrity = useSkylanternStore((s) => s.chainIntegrity);
  const setChainIntegrity = useSkylanternStore((s) => s.setChainIntegrity);
  const isVerifyingChain = useSkylanternStore((s) => s.isVerifyingChain);
  const setVerifyingChain = useSkylanternStore((s) => s.setVerifyingChain);

  const simulate = async () => {
    try {
      const { evidence, device } = await skylanternApi.simulate();
      toast.success(
        `Block #${evidence.sequence} released by ${device.label.slice(0, 24)}…`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Simulate failed");
    }
  };

  const verifyChain = async () => {
    setVerifyingChain(true);
    try {
      const report = await skylanternApi.verifyChain();
      setChainIntegrity(report);
      if (report.tampered === 0) {
        toast.success(`Chain integrity verified · ${report.verified}/${report.totalBlocks} blocks clean`, {
          description: "All hashes match. The chain has not been altered.",
        });
      } else {
        toast.error(`Chain integrity check found ${report.tampered} tampered block(s)`, {
          description: report.tamperedBlocks.map((b) => `Block #${b.sequence}`).join(", "),
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verify failed");
    } finally {
      setVerifyingChain(false);
    }
  };

  return (
    <header className="relative z-20 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <div className="flex items-center gap-4 px-4 py-2.5">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <motion.div
              animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -inset-1 rounded-full bg-amber-500/20 blur-md"
            />
            <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 shadow-lg">
              <Flame className="h-4 w-4 text-white" />
            </div>
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <h1 className="font-semibold tracking-tight text-slate-100">
                {skylanternConfig.productName}
              </h1>
              <Badge
                variant="outline"
                className="border-amber-500/30 bg-amber-500/10 font-mono text-[9px] uppercase tracking-wider text-amber-300"
              >
                {skylanternConfig.statusTier}
              </Badge>
            </div>
            <div className="font-mono text-[10px] text-slate-500">
              {skylanternConfig.codename} · digital twin
            </div>
          </div>
        </div>

        <div className="h-7 w-px bg-slate-800" />

        {/* KPI tiles */}
        <div className="hidden flex-1 items-center gap-2 lg:flex">
          <KpiTile
            icon={Cpu}
            label="Devices"
            value={stats?.totalDevices ?? 0}
            sublabel={`${stats?.activeDevices ?? 0} active`}
            tone="slate"
          />
          <KpiTile
            icon={Boxes}
            label="Evidence"
            value={stats?.totalEvidence ?? 0}
            sublabel={`head #${stats?.chainHead.sequence ?? 0}`}
            tone="slate"
          />
          <KpiTile
            icon={Hourglass}
            label="Candidates"
            value={stats?.chainHead.totalCandidates ?? 0}
            sublabel="tier R1"
            tone="amber"
          />
          <KpiTile
            icon={ShieldCheck}
            label="Verified"
            value={stats?.chainHead.totalVerified ?? 0}
            sublabel="tier R2 · court-grade"
            tone="emerald"
          />
          <KpiTile
            icon={TriangleAlert}
            label="Tamper"
            value={stats?.chainHead.totalTamperDetected ?? 0}
            sublabel="never silent"
            tone="rose"
          />
          <KpiTile
            icon={Link2}
            label="WORM Head"
            value={stats ? `#${stats.chainHead.sequence}` : "—"}
            sublabel={relativeTime(stats?.chainHead.lastObservedAt ?? null)}
            tone="slate"
            mono
          />
        </div>

        {/* Right controls */}
        <div className="ml-auto flex items-center gap-1.5">
          <div className="hidden items-center gap-1 rounded-md border border-slate-800 bg-slate-900/60 px-2 py-1 text-[10px] text-slate-400 md:flex">
            <Activity
              className={cn(
                "h-3 w-3",
                isLoading ? "text-amber-400" : "text-emerald-400"
              )}
            />
            {isLoading ? "syncing" : "live"} ·{" "}
            {relativeTime(lastUpdated ? new Date(lastUpdated).toISOString() : null)}
          </div>
          {/* Chain integrity badge */}
          {chainIntegrity && (
            <div
              className={cn(
                "hidden items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-mono uppercase tracking-wider md:flex",
                chainIntegrity.tampered === 0
                  ? "border-emerald-800/50 bg-emerald-950/30 text-emerald-300"
                  : "border-rose-800/50 bg-rose-950/30 text-rose-300"
              )}
              title={`Verified ${chainIntegrity.checkedAt}`}
            >
              {chainIntegrity.tampered === 0 ? (
                <CircleCheck className="h-3 w-3" />
              ) : (
                <CircleAlert className="h-3 w-3" />
              )}
              {chainIntegrity.tampered === 0
                ? `Chain OK · ${chainIntegrity.verified}/${chainIntegrity.totalBlocks}`
                : `${chainIntegrity.tampered} tampered`}
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={verifyChain}
            disabled={isVerifyingChain}
            className="border-slate-700 bg-slate-900 hover:bg-slate-800"
            title="Recompute every hash in the chain"
          >
            {isVerifyingChain ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShieldVerify className="mr-1.5 h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">Verify</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleChainGraph}
            className="border-slate-700 bg-slate-900 hover:bg-slate-800"
            title="Open full-screen chain graph (G)"
          >
            <Network className="mr-1.5 h-3.5 w-3.5" />
            <span className="hidden sm:inline">Chain Graph</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleAnatomy}
            className="border-cyan-800/50 bg-cyan-950/30 text-cyan-300 hover:bg-cyan-950/50 hover:text-cyan-200"
            title="Open Anatomy Evidence Instrument (E)"
          >
            <Microscope className="mr-1.5 h-3.5 w-3.5" />
            <span className="hidden sm:inline">Anatomy</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={togglePricing}
            className="relative border-amber-700/50 bg-amber-950/30 text-amber-300 hover:bg-amber-950/50 hover:text-amber-200"
            title="View pricing tiers & subscribe"
          >
            <Crown className="mr-1.5 h-3.5 w-3.5" />
            <span className="hidden sm:inline">Pricing</span>
            {subscriptions.filter((s) => s.status === "ACTIVE").length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-emerald-500 px-1 font-mono text-[8px] font-bold text-white">
                {subscriptions.filter((s) => s.status === "ACTIVE").length}
              </span>
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-slate-100"
            onClick={toggleHelp}
            title="Keyboard shortcuts (?)"
          >
            <Keyboard className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={simulate}
            className="border-slate-700 bg-slate-900 hover:bg-slate-800"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Simulate
          </Button>
          <Button
            variant={autoRelease ? "secondary" : "outline"}
            size="sm"
            onClick={toggleAutoRelease}
            className={
              autoRelease
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                : "border-slate-700 bg-slate-900 hover:bg-slate-800"
            }
          >
            {autoRelease ? (
              <PauseCircle className="mr-1.5 h-3.5 w-3.5" />
            ) : (
              <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
            )}
            Auto
          </Button>
          <Button
            size="sm"
            onClick={openReleaseModal}
            className="bg-gradient-to-br from-amber-400 to-orange-600 text-white shadow-md hover:from-amber-500 hover:to-orange-700"
          >
            <Flame className="mr-1.5 h-3.5 w-3.5" />
            Release Lantern
          </Button>
          <div className="ml-1 hidden items-center gap-0.5 lg:flex">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400"
              onClick={toggleDeviceRegistry}
              title="Toggle device registry"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400"
              onClick={toggleChainInspector}
              title="Toggle chain inspector"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

function KpiTile({
  icon: Icon,
  label,
  value,
  sublabel,
  tone,
  mono,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  sublabel: string;
  tone: "slate" | "amber" | "emerald" | "rose";
  mono?: boolean;
}) {
  const toneMap = {
    slate: "text-slate-300",
    amber: "text-amber-300",
    emerald: "text-emerald-300",
    rose: "text-rose-300",
  };
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md border border-slate-800 bg-slate-900/40 px-2.5 py-1.5">
      <Icon className={cn("h-3.5 w-3.5 shrink-0", toneMap[tone])} />
      <div className="min-w-0 leading-tight">
        <div className="text-[9px] uppercase tracking-wider text-slate-500">
          {label}
        </div>
        <div
          className={cn(
            "truncate text-sm font-semibold",
            mono ? "font-mono" : "",
            toneMap[tone]
          )}
        >
          {value}
        </div>
        <div className="hidden truncate text-[9px] text-slate-600 xl:block">{sublabel}</div>
      </div>
    </div>
  );
}
