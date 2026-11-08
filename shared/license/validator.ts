// Stub LicenseValidator — shared/license/validator
// Minimal implementation to satisfy imports.

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  tier?: string;
}

export class LicenseValidator {
  constructor(private publicKeyPem: string) {}

  validate(license: { payload: unknown; signature: string }): ValidationResult {
    return { valid: true, reason: "stub" };
  }
}

export function signLicense(payload: unknown, privateKeyPem: string): string {
  return "stub-signature";
}
