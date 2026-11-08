// Client-safe license schema (mirrors shared/license/license-schema.ts without Node crypto)
export type LicenseTier = 'OPEN_SOURCE' | 'PRO' | 'ENTERPRISE' | 'GOVERNANCE';

/**
 * A single consent decision — appended to the license's consentLog.
 * Every entry is independently hash-chained so tampering is detectable.
 * (Client-safe mirror of shared/license/license-schema.ts ConsentEntry.)
 */
export interface ConsentEntry {
  target: string;
  timestamp: string;
  granted: boolean;
  signature: string;
  ip?: string;
}

export interface LicensePayload {
  licenseId: string;
  tier: LicenseTier;
  organizationId: string;
  organizationName: string;
  issuedAt: string;
  expiresAt: string;
  features: string[];
  hardwareFingerprint?: string;
  maxNodes: number;
  region: string;
  /** REA (Reverse-Engineering Agent) feature flag. */
  REA_ENABLED?: boolean;
  /** Append-only consent log for REA scans. */
  consentLog?: ConsentEntry[];
}

export interface SignedLicense {
  payload: LicensePayload;
  signature: string;
}

export const TIER_FEATURES: Record<LicenseTier, string[]> = {
  OPEN_SOURCE: ['AIR_KERNEL', 'EPISTEMIC_RUNTIME', 'HBK_ADAPTER_BASIC', 'SAFE_KRYPTE_BASIC'],
  PRO: ['AIR_KERNEL', 'EPISTEMIC_RUNTIME', 'HBK_ADAPTER_BASIC', 'SAFE_KRYPTE_BASIC', 'SAFE_LINER_BASIC', 'MULTI_NODE_BASIC'],
  ENTERPRISE: [
    'AIR_KERNEL', 'EPISTEMIC_RUNTIME', 'HBK_ADAPTER_BASIC', 'SAFE_KRYPTE_BASIC',
    'SAFE_LINER_BASIC', 'MULTI_NODE_BASIC', 'TEE_ATTESTATION', 'ZK_PROVER_GPU',
    'COMPLIANCE_AUTOMATION', 'ENTERPRISE_SSO',
  ],
  GOVERNANCE: [
    'AIR_KERNEL', 'EPISTEMIC_RUNTIME', 'HBK_ADAPTER_BASIC', 'SAFE_KRYPTE_BASIC',
    'SAFE_LINER_BASIC', 'MULTI_NODE_BASIC', 'TEE_ATTESTATION', 'ZK_PROVER_GPU',
    'COMPLIANCE_AUTOMATION', 'ENTERPRISE_SSO', 'TOKENIZATION', 'FULL_AUTONOMY',
    'GOVERNANCE_ENGINE', 'REVENUE_SHARE',
  ],
};

export const TIER_PRICING: Record<LicenseTier, { monthly: number; currency: string; label: string }> = {
  OPEN_SOURCE: { monthly: 0, currency: 'ZAR', label: 'Free / Apache 2.0' },
  PRO: { monthly: 5000, currency: 'ZAR', label: 'R5,000/mo' },
  ENTERPRISE: { monthly: 25000, currency: 'ZAR', label: 'R25,000/mo' },
  GOVERNANCE: { monthly: 100000, currency: 'ZAR', label: 'R100k+/mo' },
};

export const ALL_FEATURES = Array.from(
  new Set(Object.values(TIER_FEATURES).flat()),
).sort();
