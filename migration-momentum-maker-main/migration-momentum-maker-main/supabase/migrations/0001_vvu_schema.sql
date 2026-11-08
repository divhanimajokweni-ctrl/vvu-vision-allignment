-- Prisma model-to-table mapping:
-- Tenant -> tenant
-- GeographicAnchor -> geographic_anchor
-- PhysicalNode -> physical_node
-- PipeSpoolProfile -> pipe_spool_profile
-- HydraulicInvariant -> hydraulic_invariant
-- TelemetryLog -> telemetry_log
-- WormEvent -> worm_event
-- AuditLog -> audit_log
-- TrustGateState -> trust_gate_state
-- OutreachTarget -> outreach_target
-- OutreachEmail -> outreach_email
-- OutreachSequence -> outreach_sequence
-- HoloRenderInstance -> holo_render_instance
-- HoloDiscoveryLog -> holo_discovery_log
-- HoloQoeSample -> holo_qoe_sample
-- FieldKitCapture -> field_kit_capture
-- FundingContribution -> funding_contribution
-- FundingConfig -> funding_config
-- CapabilityProfile -> capability_profile
-- RailSweep -> rail_sweep
-- IcshNode -> icsh_node
-- IcshPeer -> icsh_peer
-- IcshCycle -> icsh_cycle
-- IcshVaultNode -> icsh_vault_node
-- IcshRunStat -> icsh_run_stat
-- IcshSession -> icsh_session
-- GovernanceSubject -> governance_subject
-- GovernancePolicyState -> governance_policy_state
-- GovernanceHazard -> governance_hazard
-- GovernanceConsent -> governance_consent
-- GovernanceNonce -> governance_nonce
-- GovernancePermit -> governance_permit
-- GovernanceWormEvent -> governance_worm_event
-- ActuatorEffect -> actuator_effect
-- SafegridInbox -> safegrid_inbox
-- WormSealIndex -> worm_seal_index
-- ProximityRecord -> proximity_record
-- WatchboardSnapshot -> watchboard_snapshot
-- Estate -> estate
-- Claim -> claim
-- Evidence -> evidence
-- Authorization -> authorization
-- CircuitBreaker -> circuit_breaker
-- NIndComputation -> n_ind_computation
-- HeatKernelStep -> heat_kernel_step

-- Application schema converted from Prisma SQLite; app-generated text IDs have no DB default.
CREATE TABLE public.tenant (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  anchorLat text NOT NULL,
  anchorLon text NOT NULL,
  createdAt timestamptz NOT NULL
);
GRANT SELECT ON public.tenant TO anon, authenticated;
GRANT ALL ON public.tenant TO service_role;
ALTER TABLE public.tenant ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read tenant" ON public.tenant FOR SELECT TO anon, authenticated USING (true);
CREATE TABLE public.geographic_anchor (
  id text PRIMARY KEY,
  tenantId text NOT NULL,
  name text NOT NULL,
  wgs84Lat text NOT NULL,
  wgs84Lon text NOT NULL,
  datum text NOT NULL DEFAULT 'WGS84',
  createdAt timestamptz NOT NULL
);
GRANT SELECT ON public.geographic_anchor TO anon, authenticated;
GRANT ALL ON public.geographic_anchor TO service_role;
ALTER TABLE public.geographic_anchor ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read geographic_anchor" ON public.geographic_anchor FOR SELECT TO anon, authenticated USING (true);
CREATE TABLE public.physical_node (
  id text PRIMARY KEY,
  tenantId text NOT NULL,
  nodeId text NOT NULL,
  name text NOT NULL,
  role text NOT NULL,
  xCoordMm integer NOT NULL,
  yCoordMm integer NOT NULL,
  zCoordMm integer NOT NULL,
  materialGrade text,
  diameterMm integer,
  assemblyTorqueNm double precision,
  createdAt timestamptz NOT NULL,
  UNIQUE (tenantId, nodeId)
);
GRANT SELECT ON public.physical_node TO anon, authenticated;
GRANT ALL ON public.physical_node TO service_role;
ALTER TABLE public.physical_node ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read physical_node" ON public.physical_node FOR SELECT TO anon, authenticated USING (true);
CREATE TABLE public.pipe_spool_profile (
  id text PRIMARY KEY,
  nominalSize text NOT NULL UNIQUE,
  odMm double precision NOT NULL,
  wallMm double precision NOT NULL,
  material text NOT NULL,
  flangeStandard text NOT NULL,
  boltSpec text NOT NULL,
  torqueNm double precision NOT NULL,
  createdAt timestamptz NOT NULL
);
GRANT SELECT ON public.pipe_spool_profile TO anon, authenticated;
GRANT ALL ON public.pipe_spool_profile TO service_role;
ALTER TABLE public.pipe_spool_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read pipe_spool_profile" ON public.pipe_spool_profile FOR SELECT TO anon, authenticated USING (true);
CREATE TABLE public.hydraulic_invariant (
  id text PRIMARY KEY,
  parameter text NOT NULL UNIQUE,
  minValue double precision,
  maxValue double precision,
  unit text NOT NULL,
  createdAt timestamptz NOT NULL
);
GRANT SELECT ON public.hydraulic_invariant TO anon, authenticated;
GRANT ALL ON public.hydraulic_invariant TO service_role;
ALTER TABLE public.hydraulic_invariant ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read hydraulic_invariant" ON public.hydraulic_invariant FOR SELECT TO anon, authenticated USING (true);
CREATE TABLE public.telemetry_log (
  id text PRIMARY KEY,
  tenantId text NOT NULL,
  nodeId text NOT NULL,
  flowRate double precision NOT NULL,
  pressureHead double precision NOT NULL,
  acousticAbnormal boolean NOT NULL DEFAULT false,
  apuTemperature double precision NOT NULL,
  systemState text NOT NULL,
  estimatedCelerity double precision,
  invariantOk boolean NOT NULL DEFAULT true,
  createdAt timestamptz NOT NULL
);
GRANT SELECT ON public.telemetry_log TO anon, authenticated;
GRANT ALL ON public.telemetry_log TO service_role;
ALTER TABLE public.telemetry_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read telemetry_log" ON public.telemetry_log FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX telemetry_log_tenantId_createdAt_idx ON public.telemetry_log (tenantId, createdAt);
CREATE TABLE public.worm_event (
  id text PRIMARY KEY,
  seq integer NOT NULL UNIQUE,
  source text NOT NULL,
  event text NOT NULL,
  details text,
  prevHash text NOT NULL,
  hash text NOT NULL,
  createdAt timestamptz NOT NULL
);
GRANT SELECT ON public.worm_event TO anon, authenticated;
GRANT ALL ON public.worm_event TO service_role;
ALTER TABLE public.worm_event ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read worm_event" ON public.worm_event FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX worm_event_createdAt_idx ON public.worm_event (createdAt);
CREATE TABLE public.audit_log (
  id text PRIMARY KEY,
  tenantId text NOT NULL,
  actor text NOT NULL,
  action text NOT NULL,
  fromState text,
  toState text,
  symbol text,
  reason text,
  metadata text,
  createdAt timestamptz NOT NULL
);
GRANT SELECT ON public.audit_log TO anon, authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read audit_log" ON public.audit_log FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX audit_log_tenantId_createdAt_idx ON public.audit_log (tenantId, createdAt);
CREATE TABLE public.trust_gate_state (
  id text PRIMARY KEY,
  gateId text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'PENDING',
  beneficiary text NOT NULL,
  shares integer NOT NULL,
  certifiedAt timestamptz,
  certifiedBy text,
  certHash text,
  createdAt timestamptz NOT NULL,
  updatedAt timestamptz NOT NULL
);
GRANT SELECT ON public.trust_gate_state TO anon, authenticated;
GRANT ALL ON public.trust_gate_state TO service_role;
ALTER TABLE public.trust_gate_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read trust_gate_state" ON public.trust_gate_state FOR SELECT TO anon, authenticated USING (true);
CREATE TABLE public.outreach_target (
  id text PRIMARY KEY,
  tenantId text NOT NULL DEFAULT 'VVU_202625905307',
  org text NOT NULL,
  contactName text NOT NULL,
  email text NOT NULL,
  criticalIssue text,
  consentBasis text NOT NULL DEFAULT 'NONE',
  status text NOT NULL DEFAULT 'NEW',
  sequenceId text,
  currentStep integer NOT NULL DEFAULT -1,
  sector text,
  annualRevenue integer,
  employees integer,
  bbbeeLevel integer,
  supplierCount integer,
  auditFail12m boolean NOT NULL DEFAULT false,
  popiaRisk boolean NOT NULL DEFAULT false,
  govContracts boolean NOT NULL DEFAULT false,
  score integer NOT NULL DEFAULT 0,
  tier text NOT NULL DEFAULT 'UNSCORED',
  notes text,
  createdAt timestamptz NOT NULL,
  updatedAt timestamptz NOT NULL,
  UNIQUE (tenantId, email)
);
GRANT SELECT ON public.outreach_target TO anon, authenticated;
GRANT ALL ON public.outreach_target TO service_role;
ALTER TABLE public.outreach_target ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read outreach_target" ON public.outreach_target FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX outreach_target_tenantId_idx ON public.outreach_target (tenantId);
CREATE INDEX outreach_target_sequenceId_idx ON public.outreach_target (sequenceId);
CREATE TABLE public.outreach_email (
  id text PRIMARY KEY,
  targetId text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'QUEUED',
  resendId text,
  error text,
  wormSeq integer,
  stepIndex integer,
  bodyHtml text,
  aiGenerated boolean NOT NULL DEFAULT false,
  sentAt timestamptz,
  createdAt timestamptz NOT NULL
);
GRANT SELECT ON public.outreach_email TO anon, authenticated;
GRANT ALL ON public.outreach_email TO service_role;
ALTER TABLE public.outreach_email ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read outreach_email" ON public.outreach_email FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX outreach_email_targetId_createdAt_idx ON public.outreach_email (targetId, createdAt);
CREATE INDEX outreach_email_stepIndex_idx ON public.outreach_email (stepIndex);
CREATE TABLE public.outreach_sequence (
  id text PRIMARY KEY,
  tenantId text NOT NULL DEFAULT 'VVU_202625905307',
  name text NOT NULL,
  stepsJson text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  createdAt timestamptz NOT NULL,
  updatedAt timestamptz NOT NULL,
  UNIQUE (tenantId, name)
);
GRANT SELECT ON public.outreach_sequence TO anon, authenticated;
GRANT ALL ON public.outreach_sequence TO service_role;
ALTER TABLE public.outreach_sequence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read outreach_sequence" ON public.outreach_sequence FOR SELECT TO anon, authenticated USING (true);
CREATE TABLE public.holo_render_instance (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  deployment text NOT NULL,
  site text NOT NULL,
  region text NOT NULL,
  engine text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  gpuClass text NOT NULL,
  cpuUtil double precision NOT NULL DEFAULT 0.35,
  gpuUtil double precision NOT NULL DEFAULT 0.5,
  memUtil double precision NOT NULL DEFAULT 0.45,
  baseLatencyMs double precision NOT NULL DEFAULT 8,
  capacityGbps double precision NOT NULL DEFAULT 10,
  costPerHour double precision NOT NULL DEFAULT 38,
  sessions integer NOT NULL DEFAULT 0,
  createdAt timestamptz NOT NULL,
  updatedAt timestamptz NOT NULL
);
GRANT SELECT ON public.holo_render_instance TO anon, authenticated;
GRANT ALL ON public.holo_render_instance TO service_role;
ALTER TABLE public.holo_render_instance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read holo_render_instance" ON public.holo_render_instance FOR SELECT TO anon, authenticated USING (true);
CREATE TABLE public.holo_discovery_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  clientId text NOT NULL,
  maxLatencyMs integer NOT NULL,
  minBandwidthMbps integer NOT NULL,
  qosClass text NOT NULL,
  maxCostPerHour double precision,
  matchedCode text,
  score double precision,
  candidates integer NOT NULL DEFAULT 0,
  reason text NOT NULL,
  wormSeq integer,
  createdAt timestamptz NOT NULL
);
GRANT SELECT ON public.holo_discovery_log TO anon, authenticated;
GRANT ALL ON public.holo_discovery_log TO service_role;
ALTER TABLE public.holo_discovery_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read holo_discovery_log" ON public.holo_discovery_log FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX holo_discovery_log_createdAt_idx ON public.holo_discovery_log (createdAt);
CREATE TABLE public.holo_qoe_sample (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mos double precision NOT NULL,
  latencyMs double precision NOT NULL,
  jitterMs double precision NOT NULL,
  lossPct double precision NOT NULL,
  stallMs double precision NOT NULL,
  codec text NOT NULL DEFAULT 'H265',
  wormSeq integer,
  createdAt timestamptz NOT NULL
);
GRANT SELECT ON public.holo_qoe_sample TO anon, authenticated;
GRANT ALL ON public.holo_qoe_sample TO service_role;
ALTER TABLE public.holo_qoe_sample ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read holo_qoe_sample" ON public.holo_qoe_sample FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX holo_qoe_sample_createdAt_idx ON public.holo_qoe_sample (createdAt);
CREATE TABLE public.field_kit_capture (
  id text PRIMARY KEY,
  lecturer text NOT NULL,
  faculty text NOT NULL,
  field text,
  q1Unverifiable text NOT NULL,
  q2FailurePath text NOT NULL,
  q3TrustCondition text NOT NULL,
  dominantBottleneck text NOT NULL,
  wouldUse text NOT NULL,
  offered text,
  followUp text,
  wormSeq integer,
  createdAt timestamptz NOT NULL
);
GRANT SELECT ON public.field_kit_capture TO anon, authenticated;
GRANT ALL ON public.field_kit_capture TO service_role;
ALTER TABLE public.field_kit_capture ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read field_kit_capture" ON public.field_kit_capture FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX field_kit_capture_createdAt_idx ON public.field_kit_capture (createdAt);
CREATE INDEX field_kit_capture_faculty_idx ON public.field_kit_capture (faculty);
CREATE TABLE public.funding_contribution (
  id text PRIMARY KEY,
  contributionId text NOT NULL UNIQUE,
  contributorName text NOT NULL,
  contributorEmail text NOT NULL,
  institutionAffiliation text NOT NULL DEFAULT 'Nelson Mandela University',
  contributionType text NOT NULL,
  amountZar double precision NOT NULL,
  allocatedTarget text NOT NULL DEFAULT 'Mk-I Prototype Fabrication',
  paymentMethod text NOT NULL,
  gatewayReference text UNIQUE,
  sha256ReceiptHash text,
  paymentState text NOT NULL DEFAULT 'INITIATED',
  receiptId text,
  blockId text,
  wormSeq integer,
  createdAt timestamptz NOT NULL,
  updatedAt timestamptz NOT NULL
);
GRANT SELECT ON public.funding_contribution TO anon, authenticated;
GRANT ALL ON public.funding_contribution TO service_role;
ALTER TABLE public.funding_contribution ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read funding_contribution" ON public.funding_contribution FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX funding_contribution_paymentState_idx ON public.funding_contribution (paymentState);
CREATE INDEX funding_contribution_createdAt_idx ON public.funding_contribution (createdAt);
CREATE TABLE public.funding_config (
  id text PRIMARY KEY,
  targetZar double precision NOT NULL DEFAULT 250000,
  targetLabel text NOT NULL DEFAULT 'Mk-I Prototype Fabrication & Field Validation',
  updatedAt timestamptz NOT NULL
);
GRANT SELECT ON public.funding_config TO anon, authenticated;
GRANT ALL ON public.funding_config TO service_role;
ALTER TABLE public.funding_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read funding_config" ON public.funding_config FOR SELECT TO anon, authenticated USING (true);
CREATE TABLE public.capability_profile (
  id text PRIMARY KEY,
  entityName text NOT NULL DEFAULT '',
  tradingAs text NOT NULL DEFAULT '',
  vividIsTranscription boolean NOT NULL DEFAULT true,
  province text,
  csdRegistered boolean NOT NULL DEFAULT false,
  sitaRegistered boolean NOT NULL DEFAULT false,
  provincialRegistered boolean NOT NULL DEFAULT false,
  vatRegistered boolean NOT NULL DEFAULT false,
  bbbeeLevel text,
  contactEmail text,
  contactPhone text,
  pilotDeclaration text NOT NULL DEFAULT 'SIMULATION_ONLY',
  notes text,
  createdAt timestamptz NOT NULL,
  updatedAt timestamptz NOT NULL
);
GRANT SELECT ON public.capability_profile TO anon, authenticated;
GRANT ALL ON public.capability_profile TO service_role;
ALTER TABLE public.capability_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read capability_profile" ON public.capability_profile FOR SELECT TO anon, authenticated USING (true);
CREATE TABLE public.rail_sweep (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL,
  probed integer NOT NULL,
  downCount integer NOT NULL,
  downPorts text NOT NULL
);
GRANT SELECT ON public.rail_sweep TO anon, authenticated;
GRANT ALL ON public.rail_sweep TO service_role;
ALTER TABLE public.rail_sweep ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read rail_sweep" ON public.rail_sweep FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX rail_sweep_at_idx ON public.rail_sweep (at);
CREATE TABLE public.icsh_node (
  id text PRIMARY KEY,
  callsign text NOT NULL UNIQUE,
  farm text NOT NULL,
  district text NOT NULL,
  tier text NOT NULL DEFAULT 'EDGE',
  trust double precision NOT NULL DEFAULT 0.4,
  totpSecret text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  joinCode text,
  joinedAt timestamptz,
  createdAt timestamptz NOT NULL
);
GRANT SELECT ON public.icsh_node TO anon, authenticated;
GRANT ALL ON public.icsh_node TO service_role;
ALTER TABLE public.icsh_node ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read icsh_node" ON public.icsh_node FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX icsh_node_status_idx ON public.icsh_node (status);
CREATE TABLE public.icsh_peer (
  nodeId text NOT NULL,
  endpoint text NOT NULL,
  lastHead text,
  reachable boolean NOT NULL DEFAULT true,
  bucket integer NOT NULL DEFAULT 0,
  createdAt timestamptz NOT NULL
);
GRANT SELECT ON public.icsh_peer TO anon, authenticated;
GRANT ALL ON public.icsh_peer TO service_role;
ALTER TABLE public.icsh_peer ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read icsh_peer" ON public.icsh_peer FOR SELECT TO anon, authenticated USING (true);
CREATE TABLE public.icsh_cycle (
  seq integer NOT NULL,
  cycle integer NOT NULL,
  viewport text NOT NULL,
  head text NOT NULL,
  line text NOT NULL,
  districtHead text NOT NULL,
  vaultCount integer NOT NULL,
  memoryBytes integer NOT NULL DEFAULT 32,
  peersReachable integer NOT NULL,
  agreement boolean NOT NULL,
  divergentPeers integer NOT NULL DEFAULT 0,
  durationMs double precision NOT NULL,
  createdAt timestamptz NOT NULL
);
GRANT SELECT ON public.icsh_cycle TO anon, authenticated;
GRANT ALL ON public.icsh_cycle TO service_role;
ALTER TABLE public.icsh_cycle ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read icsh_cycle" ON public.icsh_cycle FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX icsh_cycle_cycle_idx ON public.icsh_cycle (cycle);
CREATE INDEX icsh_cycle_createdAt_idx ON public.icsh_cycle (createdAt);
CREATE TABLE public.icsh_vault_node (
  id text PRIMARY KEY,
  cycle integer NOT NULL,
  name text NOT NULL,
  content text NOT NULL,
  createdAt timestamptz NOT NULL,
  UNIQUE (name)
);
GRANT SELECT ON public.icsh_vault_node TO anon, authenticated;
GRANT ALL ON public.icsh_vault_node TO service_role;
ALTER TABLE public.icsh_vault_node ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read icsh_vault_node" ON public.icsh_vault_node FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX icsh_vault_node_cycle_idx ON public.icsh_vault_node (cycle);
CREATE TABLE public.icsh_run_stat (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cycles integer NOT NULL,
  durationMs double precision NOT NULL,
  cyclesPerSec double precision NOT NULL,
  finalHead text NOT NULL,
  headBefore text NOT NULL,
  agreementRate double precision NOT NULL,
  peersReachable integer NOT NULL,
  runner text NOT NULL DEFAULT 'OPERATOR',
  createdAt timestamptz NOT NULL
);
GRANT SELECT ON public.icsh_run_stat TO anon, authenticated;
GRANT ALL ON public.icsh_run_stat TO service_role;
ALTER TABLE public.icsh_run_stat ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read icsh_run_stat" ON public.icsh_run_stat FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX icsh_run_stat_createdAt_idx ON public.icsh_run_stat (createdAt);
CREATE TABLE public.icsh_session (
  id text PRIMARY KEY,
  nodeId text NOT NULL,
  callsign text NOT NULL,
  code text NOT NULL,
  totpCode text NOT NULL,
  drift integer NOT NULL,
  wormSeq integer NOT NULL,
  expiresAt timestamptz NOT NULL,
  revokedAt timestamptz,
  createdAt timestamptz NOT NULL
);
GRANT SELECT ON public.icsh_session TO anon, authenticated;
GRANT ALL ON public.icsh_session TO service_role;
ALTER TABLE public.icsh_session ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read icsh_session" ON public.icsh_session FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX icsh_session_nodeId_idx ON public.icsh_session (nodeId);
CREATE INDEX icsh_session_expiresAt_idx ON public.icsh_session (expiresAt);
CREATE INDEX icsh_session_revokedAt_idx ON public.icsh_session (revokedAt);
CREATE TABLE public.governance_subject (
  id text PRIMARY KEY,
  status text NOT NULL DEFAULT 'ACTIVE',
  role text NOT NULL DEFAULT 'OPERATOR',
  createdAt timestamptz NOT NULL,
  updatedAt timestamptz NOT NULL
);
GRANT SELECT ON public.governance_subject TO anon, authenticated;
GRANT ALL ON public.governance_subject TO service_role;
ALTER TABLE public.governance_subject ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read governance_subject" ON public.governance_subject FOR SELECT TO anon, authenticated USING (true);
CREATE TABLE public.governance_policy_state (
  id text PRIMARY KEY,
  epoch integer NOT NULL DEFAULT 1,
  updatedAt timestamptz NOT NULL
);
GRANT SELECT ON public.governance_policy_state TO anon, authenticated;
GRANT ALL ON public.governance_policy_state TO service_role;
ALTER TABLE public.governance_policy_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read governance_policy_state" ON public.governance_policy_state FOR SELECT TO anon, authenticated USING (true);
CREATE TABLE public.governance_hazard (
  id text PRIMARY KEY,
  actionId text NOT NULL,
  status text NOT NULL,
  severity text NOT NULL,
  exposure text NOT NULL,
  controllability text NOT NULL,
  description text,
  createdAt timestamptz NOT NULL,
  updatedAt timestamptz NOT NULL
);
GRANT SELECT ON public.governance_hazard TO anon, authenticated;
GRANT ALL ON public.governance_hazard TO service_role;
ALTER TABLE public.governance_hazard ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read governance_hazard" ON public.governance_hazard FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX governance_hazard_actionId_idx ON public.governance_hazard (actionId);
CREATE TABLE public.governance_consent (
  id text PRIMARY KEY,
  subjectId text NOT NULL,
  actionId text NOT NULL,
  policyEpoch integer NOT NULL,
  grantedAt timestamptz NOT NULL,
  UNIQUE (subjectId, actionId, policyEpoch)
);
GRANT SELECT ON public.governance_consent TO anon, authenticated;
GRANT ALL ON public.governance_consent TO service_role;
ALTER TABLE public.governance_consent ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read governance_consent" ON public.governance_consent FOR SELECT TO anon, authenticated USING (true);
CREATE TABLE public.governance_nonce (
  actionId text NOT NULL,
  actionNonce text NOT NULL,
  state text NOT NULL,
  expiresAt timestamptz NOT NULL,
  reservedAt timestamptz NOT NULL,
  consumedAt timestamptz,
  permitId text
);
GRANT SELECT ON public.governance_nonce TO anon, authenticated;
GRANT ALL ON public.governance_nonce TO service_role;
ALTER TABLE public.governance_nonce ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read governance_nonce" ON public.governance_nonce FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX governance_nonce_state_expiresAt_idx ON public.governance_nonce (state, expiresAt);
CREATE TABLE public.governance_permit (
  permitId text NOT NULL,
  actionId text NOT NULL,
  actionNonce text NOT NULL,
  subjectId text NOT NULL,
  policyEpoch integer NOT NULL,
  evidenceManifestHash text NOT NULL,
  governanceEventId text NOT NULL,
  issuedAt timestamptz NOT NULL,
  expiresAt timestamptz NOT NULL,
  state text NOT NULL,
  signature text,
  keyId text,
  signedAt timestamptz,
  startedAt timestamptz,
  confirmedAt timestamptz,
  abortedAt timestamptz,
  abortedReason text,
  UNIQUE (actionId, actionNonce)
);
GRANT SELECT ON public.governance_permit TO anon, authenticated;
GRANT ALL ON public.governance_permit TO service_role;
ALTER TABLE public.governance_permit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read governance_permit" ON public.governance_permit FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX governance_permit_subjectId_actionId_idx ON public.governance_permit (subjectId, actionId);
CREATE INDEX governance_permit_state_issuedAt_idx ON public.governance_permit (state, issuedAt);
CREATE TABLE public.governance_worm_event (
  seq integer NOT NULL,
  eventId text NOT NULL UNIQUE,
  type text NOT NULL,
  actionId text,
  subjectId text,
  permitId text,
  payload text NOT NULL,
  prevHash text NOT NULL,
  hash text NOT NULL,
  observedAt timestamptz NOT NULL
);
GRANT SELECT ON public.governance_worm_event TO anon, authenticated;
GRANT ALL ON public.governance_worm_event TO service_role;
ALTER TABLE public.governance_worm_event ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read governance_worm_event" ON public.governance_worm_event FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX governance_worm_event_type_observedAt_idx ON public.governance_worm_event (type, observedAt);
CREATE INDEX governance_worm_event_actionId_seq_idx ON public.governance_worm_event (actionId, seq);
CREATE TABLE public.actuator_effect (
  id text PRIMARY KEY,
  permitId text NOT NULL UNIQUE,
  actionId text NOT NULL,
  subjectId text NOT NULL,
  effect text NOT NULL,
  createdAt timestamptz NOT NULL
);
GRANT SELECT ON public.actuator_effect TO anon, authenticated;
GRANT ALL ON public.actuator_effect TO service_role;
ALTER TABLE public.actuator_effect ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read actuator_effect" ON public.actuator_effect FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX actuator_effect_actionId_createdAt_idx ON public.actuator_effect (actionId, createdAt);
CREATE TABLE public.safegrid_inbox (
  id text PRIMARY KEY,
  consumerName text NOT NULL,
  eventId text NOT NULL,
  eventType text NOT NULL,
  streamId text NOT NULL,
  payload text NOT NULL,
  status text NOT NULL,
  receivedAt timestamptz NOT NULL,
  leaseUntil timestamptz,
  sealAttempts integer NOT NULL DEFAULT 0,
  lastSealError text,
  sealedAt timestamptz,
  sealRef text,
  UNIQUE (consumerName, eventId)
);
GRANT SELECT ON public.safegrid_inbox TO anon, authenticated;
GRANT ALL ON public.safegrid_inbox TO service_role;
ALTER TABLE public.safegrid_inbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read safegrid_inbox" ON public.safegrid_inbox FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX safegrid_inbox_status_receivedAt_idx ON public.safegrid_inbox (status, receivedAt);
CREATE TABLE public.worm_seal_index (
  eventId text NOT NULL,
  streamId text NOT NULL,
  position bigint NOT NULL,
  recordHash text NOT NULL,
  previousRecordHash text NOT NULL,
  canonicalEventHash text NOT NULL,
  canonicalBytes text NOT NULL,
  sealedAt timestamptz NOT NULL,
  algorithm text NOT NULL DEFAULT 'VVU-WORM-v1',
  UNIQUE (streamId, position)
);
GRANT SELECT ON public.worm_seal_index TO anon, authenticated;
GRANT ALL ON public.worm_seal_index TO service_role;
ALTER TABLE public.worm_seal_index ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read worm_seal_index" ON public.worm_seal_index FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX worm_seal_index_streamId_position_idx ON public.worm_seal_index (streamId, position);
CREATE TABLE public.proximity_record (
  eventId text NOT NULL,
  source text NOT NULL,
  subjectId text NOT NULL,
  distanceCm integer NOT NULL,
  rssiDbm integer NOT NULL,
  batteryMv integer NOT NULL,
  dwellMs integer NOT NULL,
  riskMilli integer NOT NULL,
  occurredAt text NOT NULL,
  gateDecision text NOT NULL,
  gateReason text NOT NULL,
  action text NOT NULL,
  rulesFired text NOT NULL,
  sealRef text,
  ingestedAt timestamptz NOT NULL
);
GRANT SELECT ON public.proximity_record TO anon, authenticated;
GRANT ALL ON public.proximity_record TO service_role;
ALTER TABLE public.proximity_record ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read proximity_record" ON public.proximity_record FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX proximity_record_source_ingestedAt_idx ON public.proximity_record (source, ingestedAt);
CREATE TABLE public.watchboard_snapshot (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  builtAt timestamptz NOT NULL UNIQUE,
  signature text NOT NULL,
  hotCount integer NOT NULL,
  rows text NOT NULL,
  createdAt timestamptz NOT NULL
);
GRANT SELECT ON public.watchboard_snapshot TO anon, authenticated;
GRANT ALL ON public.watchboard_snapshot TO service_role;
ALTER TABLE public.watchboard_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read watchboard_snapshot" ON public.watchboard_snapshot FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX watchboard_snapshot_builtAt_idx ON public.watchboard_snapshot (builtAt);
CREATE TABLE public.estate (
  id text PRIMARY KEY,
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  accent text NOT NULL,
  theorem text,
  createdAt timestamptz NOT NULL,
  updatedAt timestamptz NOT NULL
);
GRANT SELECT ON public.estate TO anon, authenticated;
GRANT ALL ON public.estate TO service_role;
ALTER TABLE public.estate ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read estate" ON public.estate FOR SELECT TO anon, authenticated USING (true);
CREATE TABLE public.claim (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  claimType text NOT NULL DEFAULT 'empirical',
  state text NOT NULL DEFAULT 'UNTESTED',
  intendedAction text NOT NULL DEFAULT 'deploy',
  safetyCritical boolean NOT NULL DEFAULT true,
  estateId text,
  estateKey text NOT NULL DEFAULT 'canonical',
  createdAt timestamptz NOT NULL,
  updatedAt timestamptz NOT NULL
);
GRANT SELECT ON public.claim TO anon, authenticated;
GRANT ALL ON public.claim TO service_role;
ALTER TABLE public.claim ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read claim" ON public.claim FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX claim_state_idx ON public.claim (state);
CREATE INDEX claim_claimType_idx ON public.claim (claimType);
CREATE INDEX claim_estateKey_idx ON public.claim (estateKey);
CREATE TABLE public.evidence (
  id text PRIMARY KEY,
  claimId text NOT NULL,
  source text NOT NULL,
  content text NOT NULL,
  embedding text NOT NULL DEFAULT '[]',
  weight double precision NOT NULL DEFAULT 1.0,
  state text NOT NULL DEFAULT 'OBSERVED',
  collectedAt timestamptz NOT NULL
);
GRANT SELECT ON public.evidence TO anon, authenticated;
GRANT ALL ON public.evidence TO service_role;
ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read evidence" ON public.evidence FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX evidence_claimId_idx ON public.evidence (claimId);
CREATE INDEX evidence_source_idx ON public.evidence (source);
CREATE TABLE public.authorization (
  id text PRIMARY KEY,
  claimId text NOT NULL,
  claimOk boolean NOT NULL,
  evidenceOk boolean NOT NULL,
  integrityOk boolean NOT NULL,
  safetyOk boolean NOT NULL,
  reviewOk boolean NOT NULL,
  authorized boolean NOT NULL DEFAULT false,
  reason text NOT NULL DEFAULT '',
  createdAt timestamptz NOT NULL
);
GRANT SELECT ON public.authorization TO anon, authenticated;
GRANT ALL ON public.authorization TO service_role;
ALTER TABLE public.authorization ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read authorization" ON public.authorization FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX authorization_claimId_idx ON public.authorization (claimId);
CREATE INDEX authorization_authorized_idx ON public.authorization (authorized);
CREATE TABLE public.circuit_breaker (
  id text PRIMARY KEY,
  claimId text NOT NULL,
  triggered boolean NOT NULL DEFAULT false,
  reason text NOT NULL DEFAULT '',
  trippedAt timestamptz NOT NULL
);
GRANT SELECT ON public.circuit_breaker TO anon, authenticated;
GRANT ALL ON public.circuit_breaker TO service_role;
ALTER TABLE public.circuit_breaker ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read circuit_breaker" ON public.circuit_breaker FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX circuit_breaker_claimId_idx ON public.circuit_breaker (claimId);
CREATE INDEX circuit_breaker_triggered_idx ON public.circuit_breaker (triggered);
CREATE TABLE public.n_ind_computation (
  id text PRIMARY KEY,
  claimId text NOT NULL,
  numEvidence integer NOT NULL,
  numSources integer NOT NULL,
  nInd double precision NOT NULL,
  gamma double precision NOT NULL,
  eigenvalues text NOT NULL DEFAULT '[]',
  createdAt timestamptz NOT NULL
);
GRANT SELECT ON public.n_ind_computation TO anon, authenticated;
GRANT ALL ON public.n_ind_computation TO service_role;
ALTER TABLE public.n_ind_computation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read n_ind_computation" ON public.n_ind_computation FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX n_ind_computation_claimId_idx ON public.n_ind_computation (claimId);
CREATE TABLE public.heat_kernel_step (
  id text PRIMARY KEY,
  claimId text NOT NULL,
  step integer NOT NULL,
  l2Norm double precision NOT NULL,
  highFreqEnergy double precision NOT NULL,
  nodeValues text NOT NULL DEFAULT '[]',
  createdAt timestamptz NOT NULL
);
GRANT SELECT ON public.heat_kernel_step TO anon, authenticated;
GRANT ALL ON public.heat_kernel_step TO service_role;
ALTER TABLE public.heat_kernel_step ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read heat_kernel_step" ON public.heat_kernel_step FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX heat_kernel_step_claimId_idx ON public.heat_kernel_step (claimId);
