"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  CreditCard,
  Lock,
  Check,
  Loader2,
  ShieldCheck,
  Zap,
  PartyPopper,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PRICING_TIERS } from "../primitives";
import { useSkylanternStore } from "../hooks/useSkylanternStore";
import { skylanternApi } from "../lib/api";
import { formatZAR } from "../lib/format";
import { skylanternConfig } from "../config";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * CheckoutModal — simulated Stripe checkout flow.
 *
 * Since we can't use real Stripe keys in the sandbox, this simulates the
 * checkout experience: card details form → processing → success state. On
 * success, it creates a real Subscription record via the API.
 *
 * The card number field accepts any input (no real validation) but shows a
 * realistic Visa/Mastercard icon based on the first digit.
 */
export function CheckoutModal({ open, onClose }: CheckoutModalProps) {
  const selectedTierKey = useSkylanternStore((s) => s.selectedTierKey);
  const closeCheckout = useSkylanternStore((s) => s.closeCheckout);
  const setSubscriptions = useSkylanternStore((s) => s.setSubscriptions);

  const tier = PRICING_TIERS.find((t) => t.key === selectedTierKey);

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [deviceExternalId, setDeviceExternalId] = useState("");
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!tier) return null;

  const cardBrand = cardNumber.startsWith("4")
    ? "Visa"
    : cardNumber.startsWith("5")
    ? "Mastercard"
    : cardNumber.startsWith("3")
    ? "Amex"
    : "";

  const canSubmit =
    customerName.trim().length > 1 &&
    customerEmail.includes("@") &&
    cardNumber.replace(/\s/g, "").length >= 12 &&
    expiry.length >= 4 &&
    cvc.length >= 3;

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast.error("Please fill in all fields correctly.");
      return;
    }
    setProcessing(true);
    // Simulate Stripe processing delay.
    await new Promise((r) => setTimeout(r, 1500));
    try {
      const sub = await skylanternApi.createSubscription({
        tierKey: tier.key,
        customerName,
        customerEmail,
        deviceExternalId: deviceExternalId || undefined,
      });
      // Refresh subscriptions list.
      const fresh = await skylanternApi.getSubscriptions();
      setSubscriptions(fresh);
      setProcessing(false);
      setSuccess(true);
      toast.success(`Subscription created!`, {
        description: `${tier.label} · ${formatZAR(tier.priceZAR)} ${tier.cadence}`,
      });
    } catch (e) {
      setProcessing(false);
      toast.error(e instanceof Error ? e.message : "Checkout failed");
    }
  };

  const handleClose = () => {
    setSuccess(false);
    setCustomerName("");
    setCustomerEmail("");
    setCardNumber("");
    setExpiry("");
    setCvc("");
    setDeviceExternalId("");
    closeCheckout();
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            initial={{ scale: 0.96, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 12, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-2xl"
          >
            {success ? (
              <SuccessState
                tier={tier}
                customerName={customerName}
                onClose={handleClose}
              />
            ) : (
              <>
                {/* Header */}
                <header className="flex items-start justify-between border-b border-slate-800 p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-slate-900 p-2 ring-1 ring-slate-800">
                      <CreditCard className="h-5 w-5 text-slate-300" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-slate-100">
                        Checkout
                      </h2>
                      <p className="text-xs text-slate-500">
                        {tier.label} · {formatZAR(tier.priceZAR)} {tier.cadence}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-400"
                    onClick={handleClose}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </header>

                <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
                  {/* Order summary */}
                  <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono uppercase tracking-wider text-slate-500">
                        Order Summary
                      </span>
                      <Badge
                        variant="outline"
                        className="border-emerald-800/50 bg-emerald-950/30 font-mono text-[9px] text-emerald-300"
                      >
                        <Lock className="mr-1 h-2.5 w-2.5" />
                        Secure
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm text-slate-200">
                        {tier.label}
                      </span>
                      <span className="font-mono text-sm font-semibold text-slate-100">
                        {formatZAR(tier.priceZAR)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{tier.cadence}</span>
                      <span>{tier.domain} · {tier.primitive}</span>
                    </div>
                    <div className="mt-2 border-t border-slate-800 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-200">
                          Total
                        </span>
                        <span className="font-mono text-lg font-bold text-amber-300">
                          {formatZAR(tier.priceZAR)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Customer info */}
                  <div>
                    <Label className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-400">
                      Customer Name
                    </Label>
                    <Input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Jane Mokoena"
                      className="bg-slate-900"
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-400">
                      Email
                    </Label>
                    <Input
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="jane@dma.co.za"
                      type="email"
                      className="bg-slate-900"
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-400">
                      Device ID <span className="text-slate-600">(optional)</span>
                    </Label>
                    <Input
                      value={deviceExternalId}
                      onChange={(e) => setDeviceExternalId(e.target.value)}
                      placeholder="FLOW-8x4428"
                      className="bg-slate-900 font-mono text-xs"
                    />
                  </div>

                  {/* Card details */}
                  <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                    <div className="mb-3 flex items-center gap-1.5">
                      <Lock className="h-3 w-3 text-slate-500" />
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                        Card Details (simulated)
                      </span>
                      {cardBrand && (
                        <Badge
                          variant="outline"
                          className="ml-auto border-slate-700 bg-slate-800 font-mono text-[9px] text-slate-300"
                        >
                          {cardBrand}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Input
                        value={cardNumber}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, "").slice(0, 16);
                          const formatted = raw.replace(/(\d{4})(?=\d)/g, "$1 ");
                          setCardNumber(formatted);
                        }}
                        placeholder="4242 4242 4242 4242"
                        className="bg-slate-950 font-mono"
                        inputMode="numeric"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          value={expiry}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
                            setExpiry(
                              raw.length >= 3
                                ? raw.slice(0, 2) + "/" + raw.slice(2)
                                : raw
                            );
                          }}
                          placeholder="MM/YY"
                          className="bg-slate-950 font-mono"
                          inputMode="numeric"
                        />
                        <Input
                          value={cvc}
                          onChange={(e) =>
                            setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))
                          }
                          placeholder="CVC"
                          className="bg-slate-950 font-mono"
                          inputMode="numeric"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Trust badges */}
                  <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/20 p-3 text-[10px] text-slate-500">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                    <span>
                      R{skylanternConfig.pricingBandFloorZAR}–R
                      {skylanternConfig.pricingBandCeilingZAR.toLocaleString("en-ZA")}{" "}
                      band · no procurement committee required
                    </span>
                  </div>
                </div>

                {/* Footer */}
                <footer className="border-t border-slate-800 bg-slate-950/80 p-4">
                  <Button
                    className="w-full bg-gradient-to-br from-amber-400 to-orange-600 text-white hover:from-amber-500 hover:to-orange-700"
                    onClick={handleSubmit}
                    disabled={!canSubmit || processing}
                  >
                    {processing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing…
                      </>
                    ) : (
                      <>
                        <Zap className="mr-2 h-4 w-4" />
                        Subscribe · {formatZAR(tier.priceZAR)}
                      </>
                    )}
                  </Button>
                  <p className="mt-2 text-center text-[10px] text-slate-600">
                    Simulated checkout · no real card is charged
                  </p>
                </footer>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SuccessState({
  tier,
  customerName,
  onClose,
}: {
  tier: (typeof PRICING_TIERS)[number];
  customerName: string;
  onClose: () => void;
}) {
  return (
    <div className="p-8 text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
        className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 ring-2 ring-emerald-500/40"
      >
        <Check className="h-8 w-8 text-emerald-400" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className="mb-1 text-xl font-bold text-slate-100">
          Welcome aboard, {customerName.split(" ")[0] || "operator"}!
        </h2>
        <p className="mb-4 text-sm text-slate-400">
          Your <strong className="text-slate-200">{tier.label}</strong>{" "}
          subscription is now active.
        </p>
        <div className="mx-auto mb-4 max-w-xs rounded-lg border border-emerald-900/40 bg-emerald-950/15 p-3 text-left">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Tier</span>
            <span className="font-medium text-slate-200">{tier.label}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="text-slate-400">Price</span>
            <span className="font-mono text-emerald-300">
              {formatZAR(tier.priceZAR)} / {tier.cadence}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="text-slate-400">Status</span>
            <span className="flex items-center gap-1 text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              ACTIVE
            </span>
          </div>
        </div>
        <div className="mb-4 flex items-center justify-center gap-1.5 text-xs text-amber-300/80">
          <PartyPopper className="h-3.5 w-3.5" />
          You can now release evidence lanterns on this tier.
        </div>
        <Button
          className="w-full bg-slate-800 text-slate-100 hover:bg-slate-700"
          onClick={onClose}
        >
          Start using Skylantern
        </Button>
      </motion.div>
    </div>
  );
}
