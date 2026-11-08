/**
 * HBK Mk-II shared types — WORM chain, spatial evidence, verification states.
 * Ported from hbk-mk2-code, rebuilt to match the Epistemic Runtime project.
 * No external dependencies — pure TypeScript types.
 */

export type TierTag = 1 | 2 | 3 | 4;

export type DeliverableStatus = "PENDING" | "IN_REVIEW" | "SIGNED" | "BLOCKED";

export type VerificationState =
  | "INCONCLUSIVE"
  | "CANDIDATE"
  | "VERIFIED"
  | "TAMPER_DETECTED";

export type NodeType =
  | "edge_node"
  | "tank"
  | "pump"
  | "valve"
  | "acoustic"
  | "prv"
  | "air_valve"
  | "meter"
  | "hydrant";

export interface Deliverable {
  id: string;
  phase: string; // R0 | R1 | R2 | R3 | C1 | C2 | C3
  title: string;
  owner: string;
  tier: TierTag;
  evidenceArtifact: string;
  acceptanceCriterion: string;
  status: DeliverableStatus;
  signedBy?: string | null;
  registrationNumber?: string | null;
  signedAt?: string | null;
  gateId?: string | null;
}

export interface Gate {
  id: string;
  gateId: string;
  name: string;
  description: string;
  status: "OPEN" | "PARTIAL" | "CLOSED";
  tierBefore: number;
  tierAfter: number;
}

export interface Risk {
  id: string;
  risk: string;
  mitigation: string;
  owner: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  likelihood: "LOW" | "MEDIUM" | "HIGH";
  status: "OPEN" | "MITIGATED" | "CLOSED";
}

export interface AcceptanceItem {
  id: string;
  category: "RESEARCH" | "COMMERCIAL" | "CORPORATE" | "GOVERNANCE";
  text: string;
  checked: boolean;
  tier: TierTag;
  order: number;
}

export interface WORMEvent {
  id: string;
  hash: string;
  previousHash?: string | null;
  wormHead: string;
  subject: string;
  source: string;
  tier: TierTag;
  verificationState: VerificationState;
  payload: string;
  observedAt: string;
}

export interface EISPoint {
  id: string;
  timestamp: string;
  eis: number;
  w1Pressure: number;
  w2Flow: number;
  w3Acoustic: number;
  modalityCount: number;
  label: string;
  scadaCeiling: boolean;
}

export interface PhysicalObservationVector {
  timestamp: string;
  pressure_m: number;
  baseline_pressure_m: number;
  flow_lps: number;
  acoustic_db: number;
  temperature_c: number;
  worm_head_hash: string;
  quality_flag: "VALID" | "ANOMALOUS" | "CORRELATED" | "IMPOSSIBLE_PHYSICS";
}

export interface NodeSpatialMarker {
  id: string;
  name: string;
  coordinates: [number, number]; // [Lng, Lat]
  elevation_m: number;
  type: "HYDRO_GATEWAY" | "JOJO_TANK" | "PRESSURE_PRV" | "SCADA_LOGGER";
  status: "ONLINE" | "WARNING" | "CRITICAL" | "FAIL_CLOSED";
  metrics: PhysicalObservationVector;
}

export interface SpatialEvidence {
  id: string;
  type: NodeType;
  name: string;
  position: { lng: number; lat: number; altitude: number };
  telemetry: {
    flowRate?: number;
    pressure?: number;
    tankLevel?: number;
    tankVol?: number;
    spl?: number;
    volume?: number;
    open?: number;
  };
  verificationState: VerificationState;
  tier: TierTag;
  observedAt: string;
}

export interface AggregateState {
  deliverables: Deliverable[];
  gates: Gate[];
  risks: Risk[];
  acceptance: AcceptanceItem[];
  wormEvents: WORMEvent[];
  eisPoints: EISPoint[];
  nodes: SpatialEvidence[];
  wormHead: string;
  eis: number;
}

// ── NMBM spatial nodes (Gqeberha / Nelson Mandela Bay) ──────────────────────

export const NMBM_SPATIAL_NODES: NodeSpatialMarker[] = [
  {
    id: "NODE-HG-01",
    name: "Baakens River Gateway (HBK Mk-II)",
    coordinates: [25.6022, -33.9608],
    elevation_m: 42.8,
    type: "HYDRO_GATEWAY",
    status: "ONLINE",
    metrics: {
      timestamp: new Date().toISOString(),
      pressure_m: 46.1,
      baseline_pressure_m: 48.5,
      flow_lps: 112.4,
      acoustic_db: 48.2,
      temperature_c: 18.6,
      worm_head_hash: "E965B01D8A294C71B043DE21FA6912E0",
      quality_flag: "VALID",
    },
  },
  {
    id: "NODE-TANK-04",
    name: "Algoa Bay JoJo Buffer Tank #4",
    coordinates: [25.6154, -33.9542],
    elevation_m: 68.2,
    type: "JOJO_TANK",
    status: "ONLINE",
    metrics: {
      timestamp: new Date().toISOString(),
      pressure_m: 12.4,
      baseline_pressure_m: 12.5,
      flow_lps: 45.0,
      acoustic_db: 22.1,
      temperature_c: 19.1,
      worm_head_hash: "E965B01D8A294C71B043DE21FA6912E0",
      quality_flag: "VALID",
    },
  },
  {
    id: "NODE-PRV-02",
    name: "Driefontein High-Pressure Valve",
    coordinates: [25.5891, -33.9685],
    elevation_m: 85.0,
    type: "PRESSURE_PRV",
    status: "WARNING",
    metrics: {
      timestamp: new Date().toISOString(),
      pressure_m: 38.2,
      baseline_pressure_m: 45.0,
      flow_lps: 148.9,
      acoustic_db: 62.4,
      temperature_c: 20.2,
      worm_head_hash: "E965B01D8A294C71B043DE21FA6912E0",
      quality_flag: "ANOMALOUS",
    },
  },
];
