"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Check,
  Smartphone,
  Car,
  Droplets,
  Boxes,
  Zap,
  Crown,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PRICING_TIERS } from "../primitives";
import { useSkylanternStore } from "../hooks/useSkylanternStore";
import { skylanternApi } from "../lib/api";
import { skylanternConfig } from "../config";
import { formatZAR, relativeTime } from "../lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Domain } from "../types";

interface PricingTierPanelProps {
  open: boolean;
  onClose: () => void;
}

const DOMAIN_ICON: Record<Domain, React.ComponentType<{ className?: string }>> = {
  WATER: Droplets,
  CELLPHONE: Smartphone,
  VEHICLE: Car,
};

const TIER_FEATURES: Record<string, string[]> = {
  phone: [
    "BLE tether + seconds-level sync",
    "Theft inference (no mic/camera)",
    "Device brick & beacon dispatch",
    "Up to 1,000 users",
    "Tamper-evident beacon log",
  ],
  vehicle: [
    "Phone-absent + motion-present detection",
    "CAN bus hash-chained baseline",
    "Hijack indicator alerts",
    "Never actuates the engine",
    "Evidence log for insurers/response",
  ],
  fleet: [
    "Per-vehicle hash-chained CAN log",
    "Tamper-evident record for insurers",
    "Fleet-wide chain integrity verify",
    "Proof bundle export per vehicle",
    "API access for fleet management",
  ],
  water: [
    "DMA chamber flow/pressure meter",
    "Daily WORM sync of L/s delta",
    "Leak-candidate alert (no satellite)",
    "90-day pilot proof bundle",
    "Municipal auditor-ready export",
  ],
  dma: [
    "14km DMA chamber boundary",
    "Full network loss data integrity",
    "Proof bundle .ZIP for auditors",
    "Court-grade R2 evidence (with witness)",
    "Priority municipal engineering support",
  ],
};

/**
 * PricingTierPanel — the commercial constitution (slide 13).
 *
 * Shows the 5 pricing tiers as commercial-grade cards with feature lists,
 * prices, and Subscribe buttons. Enforces the R9–R9,999 cap as a design
 * constraint: "If a product cannot be built inside this band, it is not a
 * Skylantern product."
 *
 * Also shows existing subscriptions at the bottom.
 */
export function PricingTierPanel({ open, onClose }: PricingTierPanelProps) {
  const subscriptions = useSkylanternStore((s) => s.subscriptions);
  const openCheckout = useSkylanternStore((s) => s.openCheckout);
  const setSubscriptions = useSkylanternStore((s) => s.setSubscriptions);

  const handleCancel = async (id: string, label: string) => {
    try {
      const cancelled = await skylanternApi.cancelSubscription(id);
      const fresh = await skylanternApi.getSubscriptions();
      setSubscriptions(fresh);
      toast.success(`${label} subscription cancelled`, {
        description: `Cancelled ${relativeTime(cancelled.cancelledAt)}`,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cancel failed");
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-40 flex flex-col bg-slate-950/95 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Header */}
          <header className="flex items-center justify-between border-b border-slate-800 p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-600/20 p-2 ring-1 ring-amber-500/30">
                <Crown className="h-5 w-5 text-amber-300" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  The Commercial Constitution
                </h2>
                <p className="text-xs text-slate-500">
                  5 tiers · R{skylanternConfig.pricingBandFloorZAR}–R
                  {skylanternConfig.pricingBandCeilingZAR.toLocaleString("en-ZA")}{" "}
                  cap · slide 13
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400 hover:text-slate-100"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </header>

          <ScrollArea className="flex-1">
            <div className="mx-auto max-w-6xl p-6">
              {/* Constitution banner */}
              <div className="mb-6 rounded-lg border border-amber-900/30 bg-gradient-to-r from-amber-950/20 to-orange-950/10 p-4">
                <p className="text-sm text-amber-200/90">
                  <Crown className="mr-1.5 inline h-4 w-4" />
                  <strong>The R9–R9,999 cap is a design constraint.</strong>{" "}
                  It forces the product to be buildable at a price that a normal
                  buyer can pay without a procurement committee. If a product
                  cannot be built inside this band, it is not a Skylantern
                  product.
                </p>
              </div>

              {/* Tier cards grid */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {PRICING_TIERS.map((tier, idx) => {
                  const Icon =
                    DOMAIN_ICON[tier.domain as Domain] ?? Boxes;
                  const isPopular = tier.key === "vehicle";
                  const isPremium = tier.priceZAR >= 999;
                  const features = TIER_FEATURES[tier.key] ?? [];
                  return (
                    <motion.div
                      key={tier.key}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.08, type: "spring", stiffness: 300, damping: 28 }}
                      className={cn(
                        "relative flex flex-col overflow-hidden rounded-xl border bg-slate-950 p-5",
                        isPopular
                          ? "border-amber-500/40 ring-1 ring-amber-500/20"
                          : isPremium
                          ? "border-purple-500/30"
                          : "border-slate-800"
                      )}
                    >
                      {/* Popular badge */}
                      {isPopular && (
                        <div className="absolute right-0 top-0 rounded-bl-lg bg-gradient-to-br from-amber-400 to-orange-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                          ★ Popular
                        </div>
                      )}
                      {isPremium && !isPopular && (
                        <div className="absolute right-0 top-0 rounded-bl-lg bg-purple-600/30 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-purple-300">
                          Premium
                        </div>
                      )}

                      {/* Tier icon + name */}
                      <div className="mb-4 flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-lg",
                            isPopular
                              ? "bg-amber-500/15 ring-1 ring-amber-500/30"
                              : isPremium
                              ? "bg-purple-500/15 ring-1 ring-purple-500/30"
                              : "bg-slate-800/60 ring-1 ring-slate-700"
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-5 w-5",
                              isPopular
                                ? "text-amber-300"
                                : isPremium
                                ? "text-purple-300"
                                : "text-slate-400"
                            )}
                          />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-slate-100">
                            {tier.label}
                          </h3>
                          <span className="text-[10px] uppercase tracking-wider text-slate-500">
                            {tier.domain} · {tier.primitive}
                          </span>
                        </div>
                      </div>

                      {/* Price */}
                      <div className="mb-4 flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-slate-100">
                          {formatZAR(tier.priceZAR)}
                        </span>
                        <span className="text-xs text-slate-500">
                          / {tier.cadence}
                        </span>
                      </div>

                      {/* Blurb */}
                      <p className="mb-4 text-xs text-slate-400">
                        {tier.blurb}
                      </p>

                      {/* Features */}
                      <ul className="mb-5 flex-1 space-y-1.5">
                        {features.map((f, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-1.5 text-[11px] text-slate-400"
                          >
                            <Check
                              className={cn(
                                "mt-0.5 h-3 w-3 shrink-0",
                                isPopular
                                  ? "text-amber-400"
                                  : isPremium
                                  ? "text-purple-400"
                                  : "text-emerald-400"
                              )}
                            />
                            {f}
                          </li>
                        ))}
                      </ul>

                      {/* Subscribe button */}
                      <Button
                        className={cn(
                          "w-full",
                          isPopular
                            ? "bg-gradient-to-br from-amber-400 to-orange-600 text-white hover:from-amber-500 hover:to-orange-700"
                            : isPremium
                            ? "bg-purple-600 text-white hover:bg-purple-700"
                            : "bg-slate-800 text-slate-100 hover:bg-slate-700"
                        )}
                        onClick={() => openCheckout(tier.key)}
                      >
                        <Zap className="mr-1.5 h-3.5 w-3.5" />
                        Subscribe
                      </Button>
                    </motion.div>
                  );
                })}

                {/* Filler card: the R9–R9,999 promise */}
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-950/50 p-5 text-center">
                  <TrendingUp className="mb-2 h-8 w-8 text-slate-600" />
                  <p className="text-xs text-slate-500">
                    Every tier is priced inside the R9–R9,999 band. No
                    procurement committee required.
                  </p>
                </div>
              </div>

              {/* Existing subscriptions */}
              {subscriptions.length > 0 && (
                <div className="mt-8">
                  <div className="mb-3 flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-200">
                      Active Subscriptions
                    </h3>
                    <Badge
                      variant="outline"
                      className="border-slate-700 font-mono text-[10px] text-slate-400"
                    >
                      {subscriptions.filter((s) => s.status === "ACTIVE").length}{" "}
                      active
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {subscriptions.map((sub) => (
                      <div
                        key={sub.id}
                        className={cn(
                          "flex items-center justify-between rounded-lg border p-3",
                          sub.status === "ACTIVE"
                            ? "border-emerald-900/40 bg-emerald-950/10"
                            : "border-slate-800 bg-slate-900/30"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "h-2 w-2 rounded-full",
                              sub.status === "ACTIVE"
                                ? "bg-emerald-400"
                                : "bg-slate-600"
                            )}
                          />
                          <div>
                            <div className="text-sm font-medium text-slate-200">
                              {sub.tierLabel}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {sub.customerName} · {sub.customerEmail}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="font-mono text-sm font-semibold text-slate-200">
                              {formatZAR(sub.priceZAR)}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              since {relativeTime(sub.startDate)}
                            </div>
                          </div>
                          {sub.status === "ACTIVE" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-slate-500 hover:text-rose-300"
                              onClick={() =>
                                handleCancel(sub.id, sub.tierLabel)
                              }
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
