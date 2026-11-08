/**
 * Skylantern — thin fetch client. All routes are relative; the gateway layer
 * transparently forwards to the Next.js API via Caddy.
 */

import type {
  AttachWitnessRequest,
  AuditEventDTO,
  ChainIntegrityReport,
  CreateSubscriptionRequest,
  DeviceDTO,
  EvidenceRecordDTO,
  ProofBundle,
  RegisterDeviceRequest,
  StatsDTO,
  SubmitEvidenceRequest,
  SubscriptionDTO,
  VerificationState,
  Domain,
} from "../types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(
      (err as { error?: string }).error ?? `HTTP ${res.status}`
    );
  }
  return res.json() as Promise<T>;
}

export const skylanternApi = {
  async getStats(): Promise<StatsDTO> {
    const r = await fetch("/api/skylantern/stats", { cache: "no-store" });
    const d = await json<{ stats: StatsDTO }>(r);
    return d.stats;
  },

  async getDevices(): Promise<DeviceDTO[]> {
    const r = await fetch("/api/skylantern/devices", { cache: "no-store" });
    const d = await json<{ devices: DeviceDTO[] }>(r);
    return d.devices;
  },

  async getEvidence(opts?: {
    domain?: Domain;
    state?: VerificationState;
    sinceMs?: number;
    limit?: number;
  }): Promise<EvidenceRecordDTO[]> {
    const params = new URLSearchParams();
    if (opts?.domain) params.set("domain", opts.domain);
    if (opts?.state) params.set("state", opts.state);
    if (opts?.sinceMs) params.set("since", String(opts.sinceMs));
    if (opts?.limit) params.set("limit", String(opts.limit));
    const r = await fetch(
      `/api/skylantern/evidence?${params.toString()}`,
      { cache: "no-store" }
    );
    const d = await json<{ evidence: EvidenceRecordDTO[] }>(r);
    return d.evidence;
  },

  async getEvidenceById(id: string): Promise<EvidenceRecordDTO> {
    const r = await fetch(`/api/skylantern/evidence/${id}`, {
      cache: "no-store",
    });
    const d = await json<{ evidence: EvidenceRecordDTO }>(r);
    return d.evidence;
  },

  async getChain(limit = 60): Promise<
    {
      hash: string;
      previousHash: string | null;
      sequence: number;
      verificationState: VerificationState;
      tierTag: number;
      subject: string;
      source: string;
      observedAt: string;
      signedAt: string;
    }[]
  > {
    const r = await fetch("/api/skylantern/chain", { cache: "no-store" });
    const d = await json<{ blocks: { hash: string; sequence: number; previousHash: string | null; evidenceId: string; action: string; actor: string; source: string; observedAt: string; signedAt: string }[] }>(r);
    return d.blocks as never;
  },

  async submitEvidence(input: SubmitEvidenceRequest): Promise<EvidenceRecordDTO> {
    const r = await fetch("/api/skylantern/evidence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const d = await json<{ evidence: EvidenceRecordDTO }>(r);
    return d.evidence;
  },

  async attachWitness(
    input: AttachWitnessRequest
  ): Promise<EvidenceRecordDTO> {
    const r = await fetch("/api/skylantern/devices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const d = await json<{ evidence: EvidenceRecordDTO }>(r);
    return d.evidence;
  },

  async registerDevice(
    input: RegisterDeviceRequest
  ): Promise<DeviceDTO> {
    const r = await fetch("/api/skylantern/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const d = await json<{ device: DeviceDTO }>(r);
    return d.device;
  },

  async simulate(domain?: Domain, deviceExternalId?: string): Promise<{
    evidence: EvidenceRecordDTO;
    device: DeviceDTO;
  }> {
    const r = await fetch("/api/skylantern/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, deviceExternalId }),
    });
    return json(r);
  },

  async seed(): Promise<{
    devicesSeeded: number;
    lanternsSeeded: number;
    witnessesAttached: number;
  }> {
    const r = await fetch("/api/skylantern/seed", {
      method: "POST",
    });
    return json(r);
  },

  // ---- Round 2: Honest Limits feature set ----

  async simulateTamper(
    evidenceId: string,
    opts?: { field?: "value" | "raw"; newValue?: string }
  ): Promise<EvidenceRecordDTO> {
    const r = await fetch(
      `/api/skylantern/evidence/${evidenceId}/tamper`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts ?? {}),
      }
    );
    const d = await json<{ evidence: EvidenceRecordDTO }>(r);
    return d.evidence;
  },

  async getAuditTimeline(evidenceId: string): Promise<AuditEventDTO[]> {
    const r = await fetch(
      `/api/skylantern/evidence/${evidenceId}/audit`,
      { cache: "no-store" }
    );
    const d = await json<{ events: AuditEventDTO[] }>(r);
    return d.events;
  },

  async verifyChain(): Promise<ChainIntegrityReport> {
    const r = await fetch("/api/skylantern/chain/verify", {
      method: "POST",
    });
    const d = await json<{ report: ChainIntegrityReport }>(r);
    return d.report;
  },

  async downloadProofBundle(evidenceId: string): Promise<void> {
    // Trigger a browser download of the text-format proof bundle.
    const url = `/api/skylantern/evidence/${evidenceId}/proof-bundle?format=zip`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `skylantern-proof-bundle.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },

  async getProofBundle(evidenceId: string): Promise<ProofBundle> {
    const r = await fetch(
      `/api/skylantern/evidence/${evidenceId}/proof-bundle`,
      { cache: "no-store" }
    );
    const d = await json<{ bundle: ProofBundle }>(r);
    return d.bundle;
  },

  async archiveEvidence(
    evidenceId: string,
    actor?: string
  ): Promise<EvidenceRecordDTO> {
    const r = await fetch(
      `/api/skylantern/evidence/${evidenceId}/archive`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor }),
      }
    );
    const d = await json<{ evidence: EvidenceRecordDTO }>(r);
    return d.evidence;
  },

  // ---- Round 3: Commercial subscription flow ----

  async getSubscriptions(): Promise<SubscriptionDTO[]> {
    const r = await fetch("/api/skylantern/subscriptions", {
      cache: "no-store",
    });
    const d = await json<{ subscriptions: SubscriptionDTO[] }>(r);
    return d.subscriptions;
  },

  async createSubscription(
    input: CreateSubscriptionRequest
  ): Promise<SubscriptionDTO> {
    const r = await fetch("/api/skylantern/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const d = await json<{ subscription: SubscriptionDTO }>(r);
    return d.subscription;
  },

  async cancelSubscription(id: string): Promise<SubscriptionDTO> {
    const r = await fetch(
      `/api/skylantern/subscriptions?id=${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );
    const d = await json<{ subscription: SubscriptionDTO }>(r);
    return d.subscription;
  },
};
