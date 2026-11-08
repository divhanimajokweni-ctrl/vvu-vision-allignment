"use client";

import { create } from "zustand";
import type {
  AuditEventDTO,
  ChainIntegrityReport,
  DeviceDTO,
  EvidenceRecordDTO,
  StatsDTO,
  SubscriptionDTO,
} from "../types";

export interface SkylanternState {
  // Data
  stats: StatsDTO | null;
  devices: DeviceDTO[];
  evidence: EvidenceRecordDTO[];
  chain: {
    hash: string;
    previousHash: string | null;
    sequence: number;
    verificationState: EvidenceRecordDTO["verificationState"];
    tierTag: number;
    subject: string;
    source: string;
    observedAt: string;
    signedAt: string;
  }[];
  chainIntegrity: ChainIntegrityReport | null;
  auditTimeline: AuditEventDTO[];
  isVerifyingChain: boolean;
  subscriptions: SubscriptionDTO[];

  // UI
  selectedEvidenceId: string | null;
  selectedEvidence: EvidenceRecordDTO | null;
  isDrawerOpen: boolean;
  isReleaseModalOpen: boolean;
  isChainInspectorOpen: boolean;
  isDeviceRegistryOpen: boolean;
  isHelpOpen: boolean;
  isChainGraphOpen: boolean;
  isPricingOpen: boolean;
  isCheckoutOpen: boolean;
  isAnatomyOpen: boolean;
  selectedTierKey: string | null;
  autoRelease: boolean;
  lastUpdated: number | null;
  isLoading: boolean;
  filterDomain: "ALL" | "WATER" | "CELLPHONE" | "VEHICLE";
  filterState:
    | "ALL"
    | "CANDIDATE"
    | "VERIFIED"
    | "TAMPER_DETECTED"
    | "ARCHIVED";
  /** Mobile tab: which panel is visible on small screens. */
  mobileView: "map" | "devices" | "chain";

  // Setters
  setStats: (s: StatsDTO) => void;
  setDevices: (d: DeviceDTO[]) => void;
  setEvidence: (e: EvidenceRecordDTO[]) => void;
  setChain: (c: SkylanternState["chain"]) => void;
  setChainIntegrity: (r: ChainIntegrityReport | null) => void;
  setAuditTimeline: (a: AuditEventDTO[]) => void;
  setVerifyingChain: (b: boolean) => void;
  selectEvidence: (evidence: EvidenceRecordDTO | null) => void;
  openDrawer: (evidenceId: string) => void;
  closeDrawer: () => void;
  openReleaseModal: () => void;
  closeReleaseModal: () => void;
  toggleChainInspector: () => void;
  toggleDeviceRegistry: () => void;
  toggleAutoRelease: () => void;
  toggleHelp: () => void;
  toggleChainGraph: () => void;
  togglePricing: () => void;
  openCheckout: (tierKey: string) => void;
  closeCheckout: () => void;
  toggleAnatomy: () => void;
  setSubscriptions: (s: SubscriptionDTO[]) => void;
  setMobileView: (v: SkylanternState["mobileView"]) => void;
  setFilterDomain: (d: SkylanternState["filterDomain"]) => void;
  setFilterState: (s: SkylanternState["filterState"]) => void;
  setLoading: (b: boolean) => void;
  markUpdated: () => void;
}

export const useSkylanternStore = create<SkylanternState>((set) => ({
  stats: null,
  devices: [],
  evidence: [],
  chain: [],
  chainIntegrity: null,
  auditTimeline: [],
  isVerifyingChain: false,
  selectedEvidenceId: null,
  selectedEvidence: null,
  isDrawerOpen: false,
  isReleaseModalOpen: false,
  isChainInspectorOpen: true,
  isDeviceRegistryOpen: true,
  isHelpOpen: false,
  isChainGraphOpen: false,
  isPricingOpen: false,
  isCheckoutOpen: false,
  isAnatomyOpen: false,
  selectedTierKey: null,
  subscriptions: [],
  autoRelease: false,
  lastUpdated: null,
  isLoading: false,
  filterDomain: "ALL",
  filterState: "ALL",
  mobileView: "map",

  setStats: (s) => set({ stats: s }),
  setDevices: (d) => set({ devices: d }),
  setEvidence: (e) => set({ evidence: e }),
  setChain: (c) => set({ chain: c }),
  setChainIntegrity: (r) => set({ chainIntegrity: r }),
  setAuditTimeline: (a) => set({ auditTimeline: a }),
  setVerifyingChain: (b) => set({ isVerifyingChain: b }),
  selectEvidence: (evidence) =>
    set({ selectedEvidence: evidence, selectedEvidenceId: evidence?.id ?? null }),
  openDrawer: (evidenceId) =>
    set({ selectedEvidenceId: evidenceId, isDrawerOpen: true }),
  closeDrawer: () => set({ isDrawerOpen: false, auditTimeline: [] }),
  openReleaseModal: () => set({ isReleaseModalOpen: true }),
  closeReleaseModal: () => set({ isReleaseModalOpen: false }),
  toggleChainInspector: () =>
    set((s) => ({ isChainInspectorOpen: !s.isChainInspectorOpen })),
  toggleDeviceRegistry: () =>
    set((s) => ({ isDeviceRegistryOpen: !s.isDeviceRegistryOpen })),
  toggleAutoRelease: () => set((s) => ({ autoRelease: !s.autoRelease })),
  toggleHelp: () => set((s) => ({ isHelpOpen: !s.isHelpOpen })),
  toggleChainGraph: () => set((s) => ({ isChainGraphOpen: !s.isChainGraphOpen })),
  togglePricing: () => set((s) => ({ isPricingOpen: !s.isPricingOpen })),
  openCheckout: (tierKey) => set({ selectedTierKey: tierKey, isCheckoutOpen: true, isPricingOpen: false }),
  closeCheckout: () => set({ isCheckoutOpen: false, selectedTierKey: null }),
  toggleAnatomy: () => set((s) => ({ isAnatomyOpen: !s.isAnatomyOpen })),
  setSubscriptions: (s) => set({ subscriptions: s }),
  setMobileView: (v) => set({ mobileView: v }),
  setFilterDomain: (d) => set({ filterDomain: d }),
  setFilterState: (s) => set({ filterState: s }),
  setLoading: (b) => set({ isLoading: b }),
  markUpdated: () => set({ lastUpdated: Date.now() }),
}));
