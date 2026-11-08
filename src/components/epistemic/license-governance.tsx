"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Shield,
  KeyRound,
  Lock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCheck2,
  Building2,
  Zap,
  Cpu,
  Eye,
  EyeOff,
  RefreshCw,
  Ban,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type LicenseTier = "OPEN_SOURCE" | "PRO" | "ENTERPRISE" | "GOVERNANCE";

interface LicenseResult {
  orgId: string;
  payload: {
    licenseId: string;
    tier: LicenseTier;
    organizationId: string;
    organizationName: string;
    issuedAt: string;
    expiresAt: string;
    features: string[];
    maxNodes: number;
    region: string;
  };
  signature: string;
  validation: {
    isValid: boolean;
    tier: LicenseTier;
    features: string[];
    organizationName: string;
    expiresAt: string;
    failureReason?: string;
    checks: {
      signatureValid: boolean;
      notExpired: boolean;
      featuresConsistent: boolean;
      hardwareMatch: boolean;
    };
  };
  tierInfo: {
    tier: LicenseTier;
    pricing: { monthly: number; currency: string; label: string };
    allowedFeatures: string[];
  };
}

interface GoldenRuleReport {
  timestamp: string;
  filesScanned: number;
  violationCount: number;
  forbiddenStrings: string[];
  violations: { file: string; line: number; keyword: string; content: string }[];
  status: "PASS" | "FAIL";
}

interface LicenseData {
  publicKeyPem: string;
  licenses: LicenseResult[];
  tiers: {
    tier: LicenseTier;
    monthly: number;
    currency: string;
    label: string;
    features: string[];
  }[];
  allFeatures: string[];
}

const TIER_COLOR: Record<LicenseTier, string> = {
  OPEN_SOURCE: "text-muted-foreground",
  PRO: "text-repairing",
  ENTERPRISE: "text-verified",
  GOVERNANCE: "text-quarantined",
};

const TIER_BORDER: Record<LicenseTier, string> = {
  OPEN_SOURCE: "border-border/60",
  PRO: "border-repairing/40",
  ENTERPRISE: "border-verified/40",
  GOVERNANCE: "border-quarantined/40",
};

export function LicenseGovernanceSection() {
  const [licenseData, setLicenseData] = useState<LicenseData | null>(null);
  const [goldenRule, setGoldenRule] = useState<GoldenRuleReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [showPublicKey, setShowPublicKey] = useState(false);

  const load = useCallback(async () => {
    try {
      const [lr, gr] = await Promise.all([
        fetch("/api/license").then((r) => r.json()),
        fetch("/api/golden-rule").then((r) => r.json()),
      ]);
      setLicenseData(lr);
      setGoldenRule(gr);
      if (lr.licenses?.[0]) setSelectedOrg(lr.licenses[0].orgId);
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !licenseData || !goldenRule) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const selected = licenseData.licenses.find((l) => l.orgId === selectedOrg);
  const allFeatures = licenseData.allFeatures;

  return (
    <section className="space-y-4">
      {/* Header */}
      <Card className="bg-card/60 backdrop-blur border-border/60 p-4 relative overflow-hidden">
        <div className="bg-grid absolute inset-0 opacity-20" />
        <div className="relative flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-verified/30 bg-verified/10 shrink-0">
            <Shield className="h-5 w-5 text-verified" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold flex items-center gap-2">
              License &amp; Governance
              <Badge variant="outline" className="border-verified/30 bg-verified/10 text-verified text-[9px] font-mono">
                Ed25519 · cryptographic
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              VVU EARTH TECH ⚙ — license validation, feature gates, and Golden Rule boundary enforcement.
            </p>
          </div>
          <Button size="sm" variant="ghost" className="h-8 text-[11px] text-muted-foreground" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> refresh
          </Button>
        </div>
      </Card>

      {/* Golden Rule status + license count */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className={cn("bg-card/60 backdrop-blur border p-3 relative overflow-hidden", goldenRule.status === "PASS" ? "border-verified/40" : "border-violating/40")}>
          <div className="bg-grid-fine absolute inset-0 opacity-20" />
          <div className="relative flex items-center gap-2">
            {goldenRule.status === "PASS" ? (
              <CheckCircle2 className="h-5 w-5 text-verified" />
            ) : (
              <XCircle className="h-5 w-5 text-violating" />
            )}
            <div>
              <div className={cn("text-sm font-semibold", goldenRule.status === "PASS" ? "text-verified" : "text-violating")}>
                Golden Rule
              </div>
              <div className="text-[10px] text-muted-foreground font-mono">
                {goldenRule.filesScanned} files · {goldenRule.violationCount} violations
              </div>
            </div>
          </div>
        </Card>
        <StatCard label="Licenses" value={licenseData.licenses.length} icon={KeyRound} />
        <StatCard label="Tiers" value={licenseData.tiers.length} icon={Building2} accent="repairing" />
        <StatCard label="Features" value={allFeatures.length} icon={Zap} accent="quarantined" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* License selector + validation */}
        <Card className="lg:col-span-2 bg-card/60 backdrop-blur border-border/60 p-4 relative overflow-hidden">
          <div className="bg-grid-fine absolute inset-0 opacity-20" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <KeyRound className="h-4 w-4 text-verified" />
              <h3 className="text-sm font-semibold">License validation</h3>
              <span className="ml-auto text-[10px] text-muted-foreground font-mono">
                Ed25519 signature verification
              </span>
            </div>

            {/* Org selector */}
            <div className="flex items-center gap-1.5 flex-wrap mb-3">
              {licenseData.licenses.map((l) => {
                const isActive = selectedOrg === l.orgId;
                const isValid = l.validation.isValid;
                return (
                  <button
                    key={l.orgId}
                    onClick={() => setSelectedOrg(l.orgId)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                      isActive
                        ? cn("bg-current/10", TIER_BORDER[l.payload.tier], TIER_COLOR[l.payload.tier])
                        : "border-border/60 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {isValid ? (
                      <CheckCircle2 className="h-3 w-3 text-verified" />
                    ) : (
                      <XCircle className="h-3 w-3 text-violating" />
                    )}
                    <span className="truncate max-w-[120px]">{l.payload.organizationName}</span>
                  </button>
                );
              })}
            </div>

            {selected && (
              <div className="space-y-3">
                {/* Validation checks */}
                <div className="rounded-md border border-border/40 bg-background/40 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn("text-sm font-semibold", selected.validation.isValid ? "text-verified" : "text-violating")}>
                      {selected.validation.isValid ? "✓ Valid license" : `✗ ${selected.validation.failureReason}`}
                    </span>
                    <Badge variant="outline" className={cn("text-[9px] ml-auto", TIER_COLOR[selected.payload.tier], "border-current/30")}>
                      {selected.payload.tier}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <CheckRow label="Signature" passed={selected.validation.checks.signatureValid} />
                    <CheckRow label="Not expired" passed={selected.validation.checks.notExpired} />
                    <CheckRow label="Features OK" passed={selected.validation.checks.featuresConsistent} />
                    <CheckRow label="Hardware" passed={selected.validation.checks.hardwareMatch} />
                  </div>
                </div>

                {/* License details */}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <Detail label="License ID" value={selected.payload.licenseId} mono />
                  <Detail label="Org ID" value={selected.payload.organizationId} mono />
                  <Detail label="Region" value={selected.payload.region} mono />
                  <Detail label="Max nodes" value={String(selected.payload.maxNodes)} mono />
                  <Detail label="Issued" value={new Date(selected.payload.issuedAt).toLocaleDateString()} />
                  <Detail label="Expires" value={new Date(selected.payload.expiresAt).toLocaleDateString()} />
                </div>

                {/* Signature */}
                <div className="rounded-md border border-border/40 bg-background/40 p-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Ed25519 signature</div>
                  <code className="text-[10px] font-mono text-verified break-all">{selected.signature}…</code>
                </div>

                {/* Feature gate matrix */}
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
                    Feature gates ({selected.payload.features.length} enabled)
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {allFeatures.map((f) => {
                      const enabled = selected.payload.features.includes(f);
                      return (
                        <div
                          key={f}
                          className={cn(
                            "flex items-center gap-1.5 rounded border px-2 py-1 text-[10px]",
                            enabled
                              ? "border-verified/30 bg-verified/5 text-verified"
                              : "border-border/40 bg-muted/20 text-muted-foreground",
                          )}
                        >
                          {enabled ? (
                            <Lock className="h-2.5 w-2.5 shrink-0" />
                          ) : (
                            <Ban className="h-2.5 w-2.5 shrink-0 opacity-40" />
                          )}
                          <span className="font-mono truncate">{f}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Tier structure + public key */}
        <div className="space-y-3">
          <Card className="bg-card/60 backdrop-blur border-border/60 p-3 relative overflow-hidden">
            <div className="bg-grid-fine absolute inset-0 opacity-20" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-3.5 w-3.5 text-repairing" />
                <span className="text-xs font-semibold">Commercial tiers</span>
              </div>
              <div className="space-y-1.5">
                {licenseData.tiers.map((t) => (
                  <div key={t.tier} className={cn("rounded-md border p-2", TIER_BORDER[t.tier])}>
                    <div className="flex items-center justify-between">
                      <span className={cn("text-[11px] font-semibold", TIER_COLOR[t.tier])}>{t.tier}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{t.label}</span>
                    </div>
                    <div className="text-[9px] text-muted-foreground mt-0.5">{t.features.length} features</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Public key */}
          <Card className="bg-card/60 backdrop-blur border-border/60 p-3 relative overflow-hidden">
            <div className="bg-grid-fine absolute inset-0 opacity-20" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <KeyRound className="h-3.5 w-3.5 text-verified" />
                <span className="text-xs font-semibold">Public key (PEM)</span>
                <button
                  onClick={() => setShowPublicKey((s) => !s)}
                  className="ml-auto text-muted-foreground hover:text-foreground"
                >
                  {showPublicKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </button>
              </div>
              {showPublicKey ? (
                <pre className="text-[9px] font-mono text-verified/80 break-all whitespace-pre-wrap">
                  {licenseData.publicKeyPem}
                </pre>
              ) : (
                <p className="text-[10px] text-muted-foreground italic">
                  Click eye to reveal Ed25519 public key
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Golden Rule detail */}
      <Card className={cn("bg-card/60 backdrop-blur border p-4 relative overflow-hidden", goldenRule.status === "PASS" ? "border-verified/30" : "border-violating/30")}>
        <div className="bg-grid-fine absolute inset-0 opacity-20" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <FileCheck2 className={cn("h-4 w-4", goldenRule.status === "PASS" ? "text-verified" : "text-violating")} />
            <h3 className="text-sm font-semibold">Golden Rule enforcement</h3>
            <Badge variant="outline" className={cn("text-[9px] ml-auto", goldenRule.status === "PASS" ? "border-verified/30 bg-verified/10 text-verified" : "border-violating/30 bg-violating/10 text-violating")}>
              {goldenRule.status === "PASS" ? "PASS" : `${goldenRule.violationCount} VIOLATIONS`}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
            The open-source AIR Kernel is horizontal infrastructure — it must not contain product-specific logic.
            The checker scans for {goldenRule.forbiddenStrings.length} forbidden strings across {goldenRule.filesScanned} files.
          </p>

          {goldenRule.violations.length > 0 ? (
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {goldenRule.violations.map((v, i) => (
                <div key={i} className="flex items-center gap-2 rounded border border-violating/30 bg-violating/5 px-2 py-1 text-[11px]">
                  <AlertTriangle className="h-3 w-3 text-violating shrink-0" />
                  <span className="font-mono text-muted-foreground shrink-0">{v.file}:{v.line}</span>
                  <span className="text-violating font-mono shrink-0">"{v.keyword}"</span>
                  <span className="text-muted-foreground truncate">{v.content}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-verified/20 bg-verified/5 px-3 py-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-verified" />
              <span className="text-xs text-verified">All clear — the AIR Kernel contains no product-specific logic.</span>
            </div>
          )}

          {/* Forbidden strings reference */}
          <div className="mt-3">
            <div className="text-[9px] uppercase tracking-wide text-muted-foreground mb-1">
              Forbidden strings ({goldenRule.forbiddenStrings.length})
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {goldenRule.forbiddenStrings.map((s) => (
                <Badge key={s} variant="outline" className="text-[8px] border-border/40 font-mono text-muted-foreground">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: number; icon: typeof KeyRound; accent?: string }) {
  const color = accent ?? "text-foreground";
  return (
    <Card className="bg-card/60 backdrop-blur border-border/60 p-3 relative overflow-hidden">
      <div className="bg-grid-fine absolute inset-0 opacity-20" />
      <div className="relative flex items-center gap-2">
        <Icon className={cn("h-4 w-4", color)} />
        <div>
          <div className={cn("text-lg font-semibold tabular-nums leading-none", color)}>{value}</div>
          <div className="text-[9px] uppercase tracking-wide text-muted-foreground mt-0.5">{label}</div>
        </div>
      </div>
    </Card>
  );
}

function CheckRow({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      {passed ? (
        <CheckCircle2 className="h-3 w-3 text-verified" />
      ) : (
        <XCircle className="h-3 w-3 text-violating" />
      )}
      <span className={passed ? "text-foreground" : "text-violating"}>{label}</span>
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded border border-border/40 bg-background/40 px-2 py-1">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("text-[11px] truncate mt-0.5", mono && "font-mono")}>{value}</div>
    </div>
  );
}
