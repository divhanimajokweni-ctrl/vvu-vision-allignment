-- VVU Sovereign Database Schema — migrated from prisma/schema.prisma (SQLite)
-- Model → table mapping preserved in table comments. Text IDs from the app
-- (no DB defaults); public-read dashboard data, writes via service-role code.
-- Tenant → tenant
CREATE TABLE public."tenant" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "anchorLat" TEXT NOT NULL,
  "anchorLon" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE ("code")
);
GRANT SELECT ON public."tenant" TO anon, authenticated;
GRANT ALL ON public."tenant" TO service_role;
ALTER TABLE public."tenant" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read tenant" ON public."tenant" FOR SELECT TO anon, authenticated USING (true);

-- GeographicAnchor → geographic_anchor
CREATE TABLE public."geographic_anchor" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "wgs84Lat" TEXT NOT NULL,
  "wgs84Lon" TEXT NOT NULL,
  "datum" TEXT DEFAULT 'WGS84' NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL
);
GRANT SELECT ON public."geographic_anchor" TO anon, authenticated;
GRANT ALL ON public."geographic_anchor" TO service_role;
ALTER TABLE public."geographic_anchor" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read geographic_anchor" ON public."geographic_anchor" FOR SELECT TO anon, authenticated USING (true);

-- PhysicalNode → physical_node
CREATE TABLE public."physical_node" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "nodeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "xCoordMm" INTEGER NOT NULL,
  "yCoordMm" INTEGER NOT NULL,
  "zCoordMm" INTEGER NOT NULL,
  "materialGrade" TEXT NULL,
  "diameterMm" INTEGER NULL,
  "assemblyTorqueNm" DOUBLE PRECISION NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE ("tenantId", "nodeId")
);
GRANT SELECT ON public."physical_node" TO anon, authenticated;
GRANT ALL ON public."physical_node" TO service_role;
ALTER TABLE public."physical_node" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read physical_node" ON public."physical_node" FOR SELECT TO anon, authenticated USING (true);

-- PipeSpoolProfile → pipe_spool_profile
CREATE TABLE public."pipe_spool_profile" (
  "id" TEXT PRIMARY KEY,
  "nominalSize" TEXT NOT NULL,
  "odMm" DOUBLE PRECISION NOT NULL,
  "wallMm" DOUBLE PRECISION NOT NULL,
  "material" TEXT NOT NULL,
  "flangeStandard" TEXT NOT NULL,
  "boltSpec" TEXT NOT NULL,
  "torqueNm" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE ("nominalSize")
);
GRANT SELECT ON public."pipe_spool_profile" TO anon, authenticated;
GRANT ALL ON public."pipe_spool_profile" TO service_role;
ALTER TABLE public."pipe_spool_profile" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read pipe_spool_profile" ON public."pipe_spool_profile" FOR SELECT TO anon, authenticated USING (true);

-- HydraulicInvariant → hydraulic_invariant
CREATE TABLE public."hydraulic_invariant" (
  "id" TEXT PRIMARY KEY,
  "parameter" TEXT NOT NULL,
  "minValue" DOUBLE PRECISION NULL,
  "maxValue" DOUBLE PRECISION NULL,
  "unit" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE ("parameter")
);
GRANT SELECT ON public."hydraulic_invariant" TO anon, authenticated;
GRANT ALL ON public."hydraulic_invariant" TO service_role;
ALTER TABLE public."hydraulic_invariant" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read hydraulic_invariant" ON public."hydraulic_invariant" FOR SELECT TO anon, authenticated USING (true);

-- TelemetryLog → telemetry_log
CREATE TABLE public."telemetry_log" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "nodeId" TEXT NOT NULL,
  "flowRate" DOUBLE PRECISION NOT NULL,
  "pressureHead" DOUBLE PRECISION NOT NULL,
  "acousticAbnormal" BOOLEAN DEFAULT false NOT NULL,
  "apuTemperature" DOUBLE PRECISION NOT NULL,
  "systemState" TEXT NOT NULL,
  "estimatedCelerity" DOUBLE PRECISION NULL,
  "invariantOk" BOOLEAN DEFAULT true NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL
);
GRANT SELECT ON public."telemetry_log" TO anon, authenticated;
GRANT ALL ON public."telemetry_log" TO service_role;
ALTER TABLE public."telemetry_log" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read telemetry_log" ON public."telemetry_log" FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX "telemetry_log_tenant_id_created_at_idx" ON public."telemetry_log" ("tenantId", "createdAt");

-- WormEvent → worm_event
CREATE TABLE public."worm_event" (
  "id" TEXT PRIMARY KEY,
  "seq" INTEGER NOT NULL,
  "source" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "details" TEXT NULL,
  "prevHash" TEXT NOT NULL,
  "hash" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE ("seq")
);
GRANT SELECT ON public."worm_event" TO anon, authenticated;
GRANT ALL ON public."worm_event" TO service_role;
ALTER TABLE public."worm_event" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read worm_event" ON public."worm_event" FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX "worm_event_created_at_idx" ON public."worm_event" ("createdAt");

-- AuditLog → audit_log
CREATE TABLE public."audit_log" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "actor" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "fromState" TEXT NULL,
  "toState" TEXT NULL,
  "symbol" TEXT NULL,
  "reason" TEXT NULL,
  "metadata" TEXT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL
);
GRANT SELECT ON public."audit_log" TO anon, authenticated;
GRANT ALL ON public."audit_log" TO service_role;
ALTER TABLE public."audit_log" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read audit_log" ON public."audit_log" FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX "audit_log_tenant_id_created_at_idx" ON public."audit_log" ("tenantId", "createdAt");

-- TrustGateState → trust_gate_state
CREATE TABLE public."trust_gate_state" (
  "id" TEXT PRIMARY KEY,
  "gateId" TEXT NOT NULL,
  "status" TEXT DEFAULT 'PENDING' NOT NULL,
  "beneficiary" TEXT NOT NULL,
  "shares" INTEGER NOT NULL,
  "certifiedAt" TIMESTAMPTZ NULL,
  "certifiedBy" TEXT NULL,
  "certHash" TEXT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  UNIQUE ("gateId")
);
GRANT SELECT ON public."trust_gate_state" TO anon, authenticated;
GRANT ALL ON public."trust_gate_state" TO service_role;
ALTER TABLE public."trust_gate_state" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read trust_gate_state" ON public."trust_gate_state" FOR SELECT TO anon, authenticated USING (true);

-- OutreachTarget → outreach_target
CREATE TABLE public."outreach_target" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT DEFAULT 'VVU_202625905307' NOT NULL,
  "org" TEXT NOT NULL,
  "contactName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "criticalIssue" TEXT NULL,
  "consentBasis" TEXT DEFAULT 'NONE' NOT NULL,
  "status" TEXT DEFAULT 'NEW' NOT NULL,
  "sequenceId" TEXT NULL,
  "currentStep" INTEGER DEFAULT -1 NOT NULL,
  "sector" TEXT NULL,
  "annualRevenue" INTEGER NULL,
  "employees" INTEGER NULL,
  "bbbeeLevel" INTEGER NULL,
  "supplierCount" INTEGER NULL,
  "auditFail12m" BOOLEAN DEFAULT false NOT NULL,
  "popiaRisk" BOOLEAN DEFAULT false NOT NULL,
  "govContracts" BOOLEAN DEFAULT false NOT NULL,
  "score" INTEGER DEFAULT 0 NOT NULL,
  "tier" TEXT DEFAULT 'UNSCORED' NOT NULL,
  "notes" TEXT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  UNIQUE ("tenantId", "email")
);
GRANT SELECT ON public."outreach_target" TO anon, authenticated;
GRANT ALL ON public."outreach_target" TO service_role;
ALTER TABLE public."outreach_target" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read outreach_target" ON public."outreach_target" FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX "outreach_target_tenant_id_idx" ON public."outreach_target" ("tenantId");
CREATE INDEX "outreach_target_sequence_id_idx" ON public."outreach_target" ("sequenceId");

-- OutreachEmail → outreach_email
CREATE TABLE public."outreach_email" (
  "id" TEXT PRIMARY KEY,
  "targetId" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "status" TEXT DEFAULT 'QUEUED' NOT NULL,
  "resendId" TEXT NULL,
  "error" TEXT NULL,
  "wormSeq" INTEGER NULL,
  "stepIndex" INTEGER NULL,
  "bodyHtml" TEXT NULL,
  "aiGenerated" BOOLEAN DEFAULT false NOT NULL,
  "sentAt" TIMESTAMPTZ NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL
);
GRANT SELECT ON public."outreach_email" TO anon, authenticated;
GRANT ALL ON public."outreach_email" TO service_role;
ALTER TABLE public."outreach_email" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read outreach_email" ON public."outreach_email" FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX "outreach_email_target_id_created_at_idx" ON public."outreach_email" ("targetId", "createdAt");
CREATE INDEX "outreach_email_step_index_idx" ON public."outreach_email" ("stepIndex");

-- OutreachSequence → outreach_sequence
CREATE TABLE public."outreach_sequence" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT DEFAULT 'VVU_202625905307' NOT NULL,
  "name" TEXT NOT NULL,
  "stepsJson" TEXT NOT NULL,
  "active" BOOLEAN DEFAULT true NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  UNIQUE ("tenantId", "name")
);
GRANT SELECT ON public."outreach_sequence" TO anon, authenticated;
GRANT ALL ON public."outreach_sequence" TO service_role;
ALTER TABLE public."outreach_sequence" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read outreach_sequence" ON public."outreach_sequence" FOR SELECT TO anon, authenticated USING (true);

-- HoloRenderInstance → holo_render_instance
CREATE TABLE public."holo_render_instance" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL,
  "deployment" TEXT NOT NULL,
  "site" TEXT NOT NULL,
  "region" TEXT NOT NULL,
  "engine" TEXT NOT NULL,
  "status" TEXT DEFAULT 'ACTIVE' NOT NULL,
  "gpuClass" TEXT NOT NULL,
  "cpuUtil" DOUBLE PRECISION DEFAULT 0.35 NOT NULL,
  "gpuUtil" DOUBLE PRECISION DEFAULT 0.5 NOT NULL,
  "memUtil" DOUBLE PRECISION DEFAULT 0.45 NOT NULL,
  "baseLatencyMs" DOUBLE PRECISION DEFAULT 8 NOT NULL,
  "capacityGbps" DOUBLE PRECISION DEFAULT 10 NOT NULL,
  "costPerHour" DOUBLE PRECISION DEFAULT 38 NOT NULL,
  "sessions" INTEGER DEFAULT 0 NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  UNIQUE ("code")
);
GRANT SELECT ON public."holo_render_instance" TO anon, authenticated;
GRANT ALL ON public."holo_render_instance" TO service_role;
ALTER TABLE public."holo_render_instance" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read holo_render_instance" ON public."holo_render_instance" FOR SELECT TO anon, authenticated USING (true);

-- HoloDiscoveryLog → holo_discovery_log
CREATE TABLE public."holo_discovery_log" (
  "id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "clientId" TEXT NOT NULL,
  "maxLatencyMs" INTEGER NOT NULL,
  "minBandwidthMbps" INTEGER NOT NULL,
  "qosClass" TEXT NOT NULL,
  "maxCostPerHour" DOUBLE PRECISION NULL,
  "matchedCode" TEXT NULL,
  "score" DOUBLE PRECISION NULL,
  "candidates" INTEGER DEFAULT 0 NOT NULL,
  "reason" TEXT NOT NULL,
  "wormSeq" INTEGER NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL
);
GRANT SELECT ON public."holo_discovery_log" TO anon, authenticated;
GRANT ALL ON public."holo_discovery_log" TO service_role;
ALTER TABLE public."holo_discovery_log" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read holo_discovery_log" ON public."holo_discovery_log" FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX "holo_discovery_log_created_at_idx" ON public."holo_discovery_log" ("createdAt");

-- HoloQoeSample → holo_qoe_sample
CREATE TABLE public."holo_qoe_sample" (
  "id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "mos" DOUBLE PRECISION NOT NULL,
  "latencyMs" DOUBLE PRECISION NOT NULL,
  "jitterMs" DOUBLE PRECISION NOT NULL,
  "lossPct" DOUBLE PRECISION NOT NULL,
  "stallMs" DOUBLE PRECISION NOT NULL,
  "codec" TEXT DEFAULT 'H265' NOT NULL,
  "wormSeq" INTEGER NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL
);
GRANT SELECT ON public."holo_qoe_sample" TO anon, authenticated;
GRANT ALL ON public."holo_qoe_sample" TO service_role;
ALTER TABLE public."holo_qoe_sample" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read holo_qoe_sample" ON public."holo_qoe_sample" FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX "holo_qoe_sample_created_at_idx" ON public."holo_qoe_sample" ("createdAt");

-- FieldKitCapture → field_kit_capture
CREATE TABLE public."field_kit_capture" (
  "id" TEXT PRIMARY KEY,
  "lecturer" TEXT NOT NULL,
  "faculty" TEXT NOT NULL,
  "field" TEXT NULL,
  "q1Unverifiable" TEXT NOT NULL,
  "q2FailurePath" TEXT NOT NULL,
  "q3TrustCondition" TEXT NOT NULL,
  "dominantBottleneck" TEXT NOT NULL,
  "wouldUse" TEXT NOT NULL,
  "offered" TEXT NULL,
  "followUp" TEXT NULL,
  "wormSeq" INTEGER NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL
);
GRANT SELECT ON public."field_kit_capture" TO anon, authenticated;
GRANT ALL ON public."field_kit_capture" TO service_role;
ALTER TABLE public."field_kit_capture" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read field_kit_capture" ON public."field_kit_capture" FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX "field_kit_capture_created_at_idx" ON public."field_kit_capture" ("createdAt");
CREATE INDEX "field_kit_capture_faculty_idx" ON public."field_kit_capture" ("faculty");

-- FundingContribution → funding_contribution
CREATE TABLE public."funding_contribution" (
  "id" TEXT PRIMARY KEY,
  "contributionId" TEXT NOT NULL,
  "contributorName" TEXT NOT NULL,
  "contributorEmail" TEXT NOT NULL,
  "institutionAffiliation" TEXT DEFAULT 'Nelson Mandela University' NOT NULL,
  "contributionType" TEXT NOT NULL,
  "amountZar" DOUBLE PRECISION NOT NULL,
  "allocatedTarget" TEXT DEFAULT 'Mk-I Prototype Fabrication' NOT NULL,
  "paymentMethod" TEXT NOT NULL,
  "gatewayReference" TEXT NULL,
  "sha256ReceiptHash" TEXT NULL,
  "paymentState" TEXT DEFAULT 'INITIATED' NOT NULL,
  "receiptId" TEXT NULL,
  "blockId" TEXT NULL,
  "wormSeq" INTEGER NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  UNIQUE ("contributionId"),
  UNIQUE ("gatewayReference")
);
GRANT SELECT ON public."funding_contribution" TO anon, authenticated;
GRANT ALL ON public."funding_contribution" TO service_role;
ALTER TABLE public."funding_contribution" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read funding_contribution" ON public."funding_contribution" FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX "funding_contribution_payment_state_idx" ON public."funding_contribution" ("paymentState");
CREATE INDEX "funding_contribution_created_at_idx" ON public."funding_contribution" ("createdAt");

-- FundingConfig → funding_config
CREATE TABLE public."funding_config" (
  "id" TEXT PRIMARY KEY,
  "targetZar" DOUBLE PRECISION DEFAULT 250000 NOT NULL,
  "targetLabel" TEXT DEFAULT 'Mk-I Prototype Fabrication & Field Validation' NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL
);
GRANT SELECT ON public."funding_config" TO anon, authenticated;
GRANT ALL ON public."funding_config" TO service_role;
ALTER TABLE public."funding_config" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read funding_config" ON public."funding_config" FOR SELECT TO anon, authenticated USING (true);

-- CapabilityProfile → capability_profile
CREATE TABLE public."capability_profile" (
  "id" TEXT PRIMARY KEY,
  "entityName" TEXT DEFAULT '' NOT NULL,
  "tradingAs" TEXT DEFAULT '' NOT NULL,
  "vividIsTranscription" BOOLEAN DEFAULT true NOT NULL,
  "province" TEXT NULL,
  "csdRegistered" BOOLEAN DEFAULT false NOT NULL,
  "sitaRegistered" BOOLEAN DEFAULT false NOT NULL,
  "provincialRegistered" BOOLEAN DEFAULT false NOT NULL,
  "vatRegistered" BOOLEAN DEFAULT false NOT NULL,
  "bbbeeLevel" TEXT NULL,
  "contactEmail" TEXT NULL,
  "contactPhone" TEXT NULL,
  "pilotDeclaration" TEXT DEFAULT 'SIMULATION_ONLY' NOT NULL,
  "notes" TEXT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL
);
GRANT SELECT ON public."capability_profile" TO anon, authenticated;
GRANT ALL ON public."capability_profile" TO service_role;
ALTER TABLE public."capability_profile" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read capability_profile" ON public."capability_profile" FOR SELECT TO anon, authenticated USING (true);

-- RailSweep → rail_sweep
CREATE TABLE public."rail_sweep" (
  "id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "at" TIMESTAMPTZ DEFAULT now() NOT NULL,
  "probed" INTEGER NOT NULL,
  "downCount" INTEGER NOT NULL,
  "downPorts" TEXT NOT NULL
);
GRANT SELECT ON public."rail_sweep" TO anon, authenticated;
GRANT ALL ON public."rail_sweep" TO service_role;
ALTER TABLE public."rail_sweep" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read rail_sweep" ON public."rail_sweep" FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX "rail_sweep_at_idx" ON public."rail_sweep" ("at");

-- IcshNode → icsh_node
CREATE TABLE public."icsh_node" (
  "id" TEXT PRIMARY KEY,
  "callsign" TEXT NOT NULL,
  "farm" TEXT NOT NULL,
  "district" TEXT NOT NULL,
  "tier" TEXT DEFAULT 'EDGE' NOT NULL,
  "trust" DOUBLE PRECISION DEFAULT 0.4 NOT NULL,
  "totpSecret" TEXT NOT NULL,
  "status" TEXT DEFAULT 'PENDING' NOT NULL,
  "joinCode" TEXT NULL,
  "joinedAt" TIMESTAMPTZ NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE ("callsign")
);
GRANT SELECT ON public."icsh_node" TO anon, authenticated;
GRANT ALL ON public."icsh_node" TO service_role;
ALTER TABLE public."icsh_node" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read icsh_node" ON public."icsh_node" FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX "icsh_node_status_idx" ON public."icsh_node" ("status");

-- IcshPeer → icsh_peer
CREATE TABLE public."icsh_peer" (
  "nodeId" TEXT PRIMARY KEY,
  "endpoint" TEXT NOT NULL,
  "lastHead" TEXT NULL,
  "reachable" BOOLEAN DEFAULT true NOT NULL,
  "bucket" INTEGER DEFAULT 0 NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL
);
GRANT SELECT ON public."icsh_peer" TO anon, authenticated;
GRANT ALL ON public."icsh_peer" TO service_role;
ALTER TABLE public."icsh_peer" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read icsh_peer" ON public."icsh_peer" FOR SELECT TO anon, authenticated USING (true);

-- IcshCycle → icsh_cycle
CREATE TABLE public."icsh_cycle" (
  "seq" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "cycle" INTEGER NOT NULL,
  "viewport" TEXT NOT NULL,
  "head" TEXT NOT NULL,
  "line" TEXT NOT NULL,
  "districtHead" TEXT NOT NULL,
  "vaultCount" INTEGER NOT NULL,
  "memoryBytes" INTEGER DEFAULT 32 NOT NULL,
  "peersReachable" INTEGER NOT NULL,
  "agreement" BOOLEAN NOT NULL,
  "divergentPeers" INTEGER DEFAULT 0 NOT NULL,
  "durationMs" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL
);
GRANT SELECT ON public."icsh_cycle" TO anon, authenticated;
GRANT ALL ON public."icsh_cycle" TO service_role;
ALTER TABLE public."icsh_cycle" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read icsh_cycle" ON public."icsh_cycle" FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX "icsh_cycle_cycle_idx" ON public."icsh_cycle" ("cycle");
CREATE INDEX "icsh_cycle_created_at_idx" ON public."icsh_cycle" ("createdAt");

-- IcshVaultNode → icsh_vault_node
CREATE TABLE public."icsh_vault_node" (
  "id" TEXT PRIMARY KEY,
  "cycle" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE ("name")
);
GRANT SELECT ON public."icsh_vault_node" TO anon, authenticated;
GRANT ALL ON public."icsh_vault_node" TO service_role;
ALTER TABLE public."icsh_vault_node" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read icsh_vault_node" ON public."icsh_vault_node" FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX "icsh_vault_node_cycle_idx" ON public."icsh_vault_node" ("cycle");

-- IcshRunStat → icsh_run_stat
CREATE TABLE public."icsh_run_stat" (
  "id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "cycles" INTEGER NOT NULL,
  "durationMs" DOUBLE PRECISION NOT NULL,
  "cyclesPerSec" DOUBLE PRECISION NOT NULL,
  "finalHead" TEXT NOT NULL,
  "headBefore" TEXT NOT NULL,
  "agreementRate" DOUBLE PRECISION NOT NULL,
  "peersReachable" INTEGER NOT NULL,
  "runner" TEXT DEFAULT 'OPERATOR' NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL
);
GRANT SELECT ON public."icsh_run_stat" TO anon, authenticated;
GRANT ALL ON public."icsh_run_stat" TO service_role;
ALTER TABLE public."icsh_run_stat" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read icsh_run_stat" ON public."icsh_run_stat" FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX "icsh_run_stat_created_at_idx" ON public."icsh_run_stat" ("createdAt");

-- IcshSession → icsh_session
CREATE TABLE public."icsh_session" (
  "id" TEXT PRIMARY KEY,
  "nodeId" TEXT NOT NULL,
  "callsign" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "totpCode" TEXT NOT NULL,
  "drift" INTEGER NOT NULL,
  "wormSeq" INTEGER NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "revokedAt" TIMESTAMPTZ NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL
);
GRANT SELECT ON public."icsh_session" TO anon, authenticated;
GRANT ALL ON public."icsh_session" TO service_role;
ALTER TABLE public."icsh_session" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read icsh_session" ON public."icsh_session" FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX "icsh_session_node_id_idx" ON public."icsh_session" ("nodeId");
CREATE INDEX "icsh_session_expires_at_idx" ON public."icsh_session" ("expiresAt");
CREATE INDEX "icsh_session_revoked_at_idx" ON public."icsh_session" ("revokedAt");

-- GovernanceSubject → governance_subject
CREATE TABLE public."governance_subject" (
  "id" TEXT PRIMARY KEY,
  "status" TEXT DEFAULT 'ACTIVE' NOT NULL,
  "role" TEXT DEFAULT 'OPERATOR' NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL
);
GRANT SELECT ON public."governance_subject" TO anon, authenticated;
GRANT ALL ON public."governance_subject" TO service_role;
ALTER TABLE public."governance_subject" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read governance_subject" ON public."governance_subject" FOR SELECT TO anon, authenticated USING (true);

-- GovernancePolicyState → governance_policy_state
CREATE TABLE public."governance_policy_state" (
  "id" TEXT PRIMARY KEY,
  "epoch" INTEGER DEFAULT 1 NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL
);
GRANT SELECT ON public."governance_policy_state" TO anon, authenticated;
GRANT ALL ON public."governance_policy_state" TO service_role;
ALTER TABLE public."governance_policy_state" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read governance_policy_state" ON public."governance_policy_state" FOR SELECT TO anon, authenticated USING (true);

-- GovernanceHazard → governance_hazard
CREATE TABLE public."governance_hazard" (
  "id" TEXT PRIMARY KEY,
  "actionId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "exposure" TEXT NOT NULL,
  "controllability" TEXT NOT NULL,
  "description" TEXT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL
);
GRANT SELECT ON public."governance_hazard" TO anon, authenticated;
GRANT ALL ON public."governance_hazard" TO service_role;
ALTER TABLE public."governance_hazard" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read governance_hazard" ON public."governance_hazard" FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX "governance_hazard_action_id_idx" ON public."governance_hazard" ("actionId");

-- GovernanceConsent → governance_consent
CREATE TABLE public."governance_consent" (
  "id" TEXT PRIMARY KEY,
  "subjectId" TEXT NOT NULL,
  "actionId" TEXT NOT NULL,
  "policyEpoch" INTEGER NOT NULL,
  "grantedAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE ("subjectId", "actionId", "policyEpoch")
);
GRANT SELECT ON public."governance_consent" TO anon, authenticated;
GRANT ALL ON public."governance_consent" TO service_role;
ALTER TABLE public."governance_consent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read governance_consent" ON public."governance_consent" FOR SELECT TO anon, authenticated USING (true);

-- GovernanceNonce → governance_nonce
CREATE TABLE public."governance_nonce" (
  "actionId" TEXT NOT NULL,
  "actionNonce" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "reservedAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
  "consumedAt" TIMESTAMPTZ NULL,
  "permitId" TEXT NULL
);
GRANT SELECT ON public."governance_nonce" TO anon, authenticated;
GRANT ALL ON public."governance_nonce" TO service_role;
ALTER TABLE public."governance_nonce" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read governance_nonce" ON public."governance_nonce" FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX "governance_nonce_state_expires_at_idx" ON public."governance_nonce" ("state", "expiresAt");

-- GovernancePermit → governance_permit
CREATE TABLE public."governance_permit" (
  "permitId" TEXT PRIMARY KEY,
  "actionId" TEXT NOT NULL,
  "actionNonce" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "policyEpoch" INTEGER NOT NULL,
  "evidenceManifestHash" TEXT NOT NULL,
  "governanceEventId" TEXT NOT NULL,
  "issuedAt" TIMESTAMPTZ NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "state" TEXT NOT NULL,
  "signature" TEXT NULL,
  "keyId" TEXT NULL,
  "signedAt" TIMESTAMPTZ NULL,
  "startedAt" TIMESTAMPTZ NULL,
  "confirmedAt" TIMESTAMPTZ NULL,
  "abortedAt" TIMESTAMPTZ NULL,
  "abortedReason" TEXT NULL,
  UNIQUE ("actionId", "actionNonce")
);
GRANT SELECT ON public."governance_permit" TO anon, authenticated;
GRANT ALL ON public."governance_permit" TO service_role;
ALTER TABLE public."governance_permit" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read governance_permit" ON public."governance_permit" FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX "governance_permit_subject_id_action_id_idx" ON public."governance_permit" ("subjectId", "actionId");
CREATE INDEX "governance_permit_state_issued_at_idx" ON public."governance_permit" ("state", "issuedAt");

-- GovernanceWormEvent → governance_worm_event
CREATE TABLE public."governance_worm_event" (
  "seq" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "eventId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "actionId" TEXT NULL,
  "subjectId" TEXT NULL,
  "permitId" TEXT NULL,
  "payload" TEXT NOT NULL,
  "prevHash" TEXT NOT NULL,
  "hash" TEXT NOT NULL,
  "observedAt" TIMESTAMPTZ NOT NULL,
  UNIQUE ("eventId")
);
GRANT SELECT ON public."governance_worm_event" TO anon, authenticated;
GRANT ALL ON public."governance_worm_event" TO service_role;
ALTER TABLE public."governance_worm_event" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read governance_worm_event" ON public."governance_worm_event" FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX "governance_worm_event_type_observed_at_idx" ON public."governance_worm_event" ("type", "observedAt");
CREATE INDEX "governance_worm_event_action_id_seq_idx" ON public."governance_worm_event" ("actionId", "seq");

-- ActuatorEffect → actuator_effect
CREATE TABLE public."actuator_effect" (
  "id" TEXT PRIMARY KEY,
  "permitId" TEXT NOT NULL,
  "actionId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "effect" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE ("permitId")
);
GRANT SELECT ON public."actuator_effect" TO anon, authenticated;
GRANT ALL ON public."actuator_effect" TO service_role;
ALTER TABLE public."actuator_effect" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read actuator_effect" ON public."actuator_effect" FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX "actuator_effect_action_id_created_at_idx" ON public."actuator_effect" ("actionId", "createdAt");

-- SafegridInbox → safegrid_inbox
CREATE TABLE public."safegrid_inbox" (
  "id" TEXT PRIMARY KEY,
  "consumerName" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "streamId" TEXT NOT NULL,
  "payload" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "receivedAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
  "leaseUntil" TIMESTAMPTZ NULL,
  "sealAttempts" INTEGER DEFAULT 0 NOT NULL,
  "lastSealError" TEXT NULL,
  "sealedAt" TIMESTAMPTZ NULL,
  "sealRef" TEXT NULL,
  UNIQUE ("consumerName", "eventId")
);
GRANT SELECT ON public."safegrid_inbox" TO anon, authenticated;
GRANT ALL ON public."safegrid_inbox" TO service_role;
ALTER TABLE public."safegrid_inbox" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read safegrid_inbox" ON public."safegrid_inbox" FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX "safegrid_inbox_status_received_at_idx" ON public."safegrid_inbox" ("status", "receivedAt");

-- WormSealIndex → worm_seal_index
CREATE TABLE public."worm_seal_index" (
  "eventId" TEXT PRIMARY KEY,
  "streamId" TEXT NOT NULL,
  "position" BIGINT NOT NULL,
  "recordHash" TEXT NOT NULL,
  "previousRecordHash" TEXT NOT NULL,
  "canonicalEventHash" TEXT NOT NULL,
  "canonicalBytes" TEXT NOT NULL,
  "sealedAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
  "algorithm" TEXT DEFAULT 'VVU-WORM-v1' NOT NULL,
  UNIQUE ("streamId", "position")
);
GRANT SELECT ON public."worm_seal_index" TO anon, authenticated;
GRANT ALL ON public."worm_seal_index" TO service_role;
ALTER TABLE public."worm_seal_index" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read worm_seal_index" ON public."worm_seal_index" FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX "worm_seal_index_stream_id_position_idx" ON public."worm_seal_index" ("streamId", "position");

-- ProximityRecord → proximity_record
CREATE TABLE public."proximity_record" (
  "eventId" TEXT PRIMARY KEY,
  "source" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "distanceCm" INTEGER NOT NULL,
  "rssiDbm" INTEGER NOT NULL,
  "batteryMv" INTEGER NOT NULL,
  "dwellMs" INTEGER NOT NULL,
  "riskMilli" INTEGER NOT NULL,
  "occurredAt" TEXT NOT NULL,
  "gateDecision" TEXT NOT NULL,
  "gateReason" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "rulesFired" TEXT NOT NULL,
  "sealRef" TEXT NULL,
  "ingestedAt" TIMESTAMPTZ DEFAULT now() NOT NULL
);
GRANT SELECT ON public."proximity_record" TO anon, authenticated;
GRANT ALL ON public."proximity_record" TO service_role;
ALTER TABLE public."proximity_record" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read proximity_record" ON public."proximity_record" FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX "proximity_record_source_ingested_at_idx" ON public."proximity_record" ("source", "ingestedAt");

-- WatchboardSnapshot → watchboard_snapshot
CREATE TABLE public."watchboard_snapshot" (
  "id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "builtAt" TIMESTAMPTZ NOT NULL,
  "signature" TEXT NOT NULL,
  "hotCount" INTEGER NOT NULL,
  "rows" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE ("builtAt")
);
GRANT SELECT ON public."watchboard_snapshot" TO anon, authenticated;
GRANT ALL ON public."watchboard_snapshot" TO service_role;
ALTER TABLE public."watchboard_snapshot" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read watchboard_snapshot" ON public."watchboard_snapshot" FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX "watchboard_snapshot_built_at_idx" ON public."watchboard_snapshot" ("builtAt");

-- Estate → estate
CREATE TABLE public."estate" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "accent" TEXT NOT NULL,
  "theorem" TEXT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  UNIQUE ("key")
);
GRANT SELECT ON public."estate" TO anon, authenticated;
GRANT ALL ON public."estate" TO service_role;
ALTER TABLE public."estate" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read estate" ON public."estate" FOR SELECT TO anon, authenticated USING (true);

-- Claim → claim
CREATE TABLE public."claim" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "claimType" TEXT DEFAULT 'empirical' NOT NULL,
  "state" TEXT DEFAULT 'UNTESTED' NOT NULL,
  "intendedAction" TEXT DEFAULT 'deploy' NOT NULL,
  "safetyCritical" BOOLEAN DEFAULT true NOT NULL,
  "estateId" TEXT NULL,
  "estateKey" TEXT DEFAULT 'canonical' NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL
);
GRANT SELECT ON public."claim" TO anon, authenticated;
GRANT ALL ON public."claim" TO service_role;
ALTER TABLE public."claim" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read claim" ON public."claim" FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX "claim_state_idx" ON public."claim" ("state");
CREATE INDEX "claim_claim_type_idx" ON public."claim" ("claimType");
CREATE INDEX "claim_estate_key_idx" ON public."claim" ("estateKey");

-- Evidence → evidence
CREATE TABLE public."evidence" (
  "id" TEXT PRIMARY KEY,
  "claimId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "embedding" TEXT NOT NULL,
  "weight" DOUBLE PRECISION DEFAULT 1.0 NOT NULL,
  "state" TEXT DEFAULT 'OBSERVED' NOT NULL,
  "collectedAt" TIMESTAMPTZ DEFAULT now() NOT NULL
);
GRANT SELECT ON public."evidence" TO anon, authenticated;
GRANT ALL ON public."evidence" TO service_role;
ALTER TABLE public."evidence" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read evidence" ON public."evidence" FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX "evidence_claim_id_idx" ON public."evidence" ("claimId");
CREATE INDEX "evidence_source_idx" ON public."evidence" ("source");

-- Authorization → authorization
CREATE TABLE public."authorization" (
  "id" TEXT PRIMARY KEY,
  "claimId" TEXT NOT NULL,
  "claimOk" BOOLEAN NOT NULL,
  "evidenceOk" BOOLEAN NOT NULL,
  "integrityOk" BOOLEAN NOT NULL,
  "safetyOk" BOOLEAN NOT NULL,
  "reviewOk" BOOLEAN NOT NULL,
  "authorized" BOOLEAN DEFAULT false NOT NULL,
  "reason" TEXT DEFAULT '' NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL
);
GRANT SELECT ON public."authorization" TO anon, authenticated;
GRANT ALL ON public."authorization" TO service_role;
ALTER TABLE public."authorization" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read authorization" ON public."authorization" FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX "authorization_claim_id_idx" ON public."authorization" ("claimId");
CREATE INDEX "authorization_authorized_idx" ON public."authorization" ("authorized");

-- CircuitBreaker → circuit_breaker
CREATE TABLE public."circuit_breaker" (
  "id" TEXT PRIMARY KEY,
  "claimId" TEXT NOT NULL,
  "triggered" BOOLEAN DEFAULT false NOT NULL,
  "reason" TEXT DEFAULT '' NOT NULL,
  "trippedAt" TIMESTAMPTZ DEFAULT now() NOT NULL
);
GRANT SELECT ON public."circuit_breaker" TO anon, authenticated;
GRANT ALL ON public."circuit_breaker" TO service_role;
ALTER TABLE public."circuit_breaker" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read circuit_breaker" ON public."circuit_breaker" FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX "circuit_breaker_claim_id_idx" ON public."circuit_breaker" ("claimId");
CREATE INDEX "circuit_breaker_triggered_idx" ON public."circuit_breaker" ("triggered");

-- NIndComputation → nind_computation
CREATE TABLE public."nind_computation" (
  "id" TEXT PRIMARY KEY,
  "claimId" TEXT NOT NULL,
  "numEvidence" INTEGER NOT NULL,
  "numSources" INTEGER NOT NULL,
  "nInd" DOUBLE PRECISION NOT NULL,
  "gamma" DOUBLE PRECISION NOT NULL,
  "eigenvalues" TEXT DEFAULT '[]' NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL
);
GRANT SELECT ON public."nind_computation" TO anon, authenticated;
GRANT ALL ON public."nind_computation" TO service_role;
ALTER TABLE public."nind_computation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read nind_computation" ON public."nind_computation" FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX "nind_computation_claim_id_idx" ON public."nind_computation" ("claimId");

-- HeatKernelStep → heat_kernel_step
CREATE TABLE public."heat_kernel_step" (
  "id" TEXT PRIMARY KEY,
  "claimId" TEXT NOT NULL,
  "step" INTEGER NOT NULL,
  "l2Norm" DOUBLE PRECISION NOT NULL,
  "highFreqEnergy" DOUBLE PRECISION NOT NULL,
  "nodeValues" TEXT DEFAULT '[]' NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now() NOT NULL
);
GRANT SELECT ON public."heat_kernel_step" TO anon, authenticated;
GRANT ALL ON public."heat_kernel_step" TO service_role;
ALTER TABLE public."heat_kernel_step" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read heat_kernel_step" ON public."heat_kernel_step" FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX "heat_kernel_step_claim_id_idx" ON public."heat_kernel_step" ("claimId");