export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      actuator_effect: {
        Row: {
          actionId: string;
          createdAt: string;
          effect: string;
          id: string;
          permitId: string;
          subjectId: string;
        };
        Insert: {
          actionId: string;
          createdAt?: string;
          effect: string;
          id: string;
          permitId: string;
          subjectId: string;
        };
        Update: {
          actionId?: string;
          createdAt?: string;
          effect?: string;
          id?: string;
          permitId?: string;
          subjectId?: string;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          action: string;
          actor: string;
          createdAt: string;
          fromState: string | null;
          id: string;
          metadata: string | null;
          reason: string | null;
          symbol: string | null;
          tenantId: string;
          toState: string | null;
        };
        Insert: {
          action: string;
          actor: string;
          createdAt?: string;
          fromState?: string | null;
          id: string;
          metadata?: string | null;
          reason?: string | null;
          symbol?: string | null;
          tenantId: string;
          toState?: string | null;
        };
        Update: {
          action?: string;
          actor?: string;
          createdAt?: string;
          fromState?: string | null;
          id?: string;
          metadata?: string | null;
          reason?: string | null;
          symbol?: string | null;
          tenantId?: string;
          toState?: string | null;
        };
        Relationships: [];
      };
      authorization: {
        Row: {
          authorized: boolean;
          claimId: string;
          claimOk: boolean;
          createdAt: string;
          evidenceOk: boolean;
          id: string;
          integrityOk: boolean;
          reason: string;
          reviewOk: boolean;
          safetyOk: boolean;
        };
        Insert: {
          authorized?: boolean;
          claimId: string;
          claimOk: boolean;
          createdAt?: string;
          evidenceOk: boolean;
          id: string;
          integrityOk: boolean;
          reason?: string;
          reviewOk: boolean;
          safetyOk: boolean;
        };
        Update: {
          authorized?: boolean;
          claimId?: string;
          claimOk?: boolean;
          createdAt?: string;
          evidenceOk?: boolean;
          id?: string;
          integrityOk?: boolean;
          reason?: string;
          reviewOk?: boolean;
          safetyOk?: boolean;
        };
        Relationships: [];
      };
      capability_profile: {
        Row: {
          bbbeeLevel: string | null;
          contactEmail: string | null;
          contactPhone: string | null;
          createdAt: string;
          csdRegistered: boolean;
          entityName: string;
          id: string;
          notes: string | null;
          pilotDeclaration: string;
          province: string | null;
          provincialRegistered: boolean;
          sitaRegistered: boolean;
          tradingAs: string;
          updatedAt: string;
          vatRegistered: boolean;
          vividIsTranscription: boolean;
        };
        Insert: {
          bbbeeLevel?: string | null;
          contactEmail?: string | null;
          contactPhone?: string | null;
          createdAt?: string;
          csdRegistered?: boolean;
          entityName?: string;
          id: string;
          notes?: string | null;
          pilotDeclaration?: string;
          province?: string | null;
          provincialRegistered?: boolean;
          sitaRegistered?: boolean;
          tradingAs?: string;
          updatedAt: string;
          vatRegistered?: boolean;
          vividIsTranscription?: boolean;
        };
        Update: {
          bbbeeLevel?: string | null;
          contactEmail?: string | null;
          contactPhone?: string | null;
          createdAt?: string;
          csdRegistered?: boolean;
          entityName?: string;
          id?: string;
          notes?: string | null;
          pilotDeclaration?: string;
          province?: string | null;
          provincialRegistered?: boolean;
          sitaRegistered?: boolean;
          tradingAs?: string;
          updatedAt?: string;
          vatRegistered?: boolean;
          vividIsTranscription?: boolean;
        };
        Relationships: [];
      };
      circuit_breaker: {
        Row: {
          claimId: string;
          id: string;
          reason: string;
          triggered: boolean;
          trippedAt: string;
        };
        Insert: {
          claimId: string;
          id: string;
          reason?: string;
          triggered?: boolean;
          trippedAt?: string;
        };
        Update: {
          claimId?: string;
          id?: string;
          reason?: string;
          triggered?: boolean;
          trippedAt?: string;
        };
        Relationships: [];
      };
      claim: {
        Row: {
          claimType: string;
          createdAt: string;
          description: string;
          estateId: string | null;
          estateKey: string;
          id: string;
          intendedAction: string;
          safetyCritical: boolean;
          state: string;
          title: string;
          updatedAt: string;
        };
        Insert: {
          claimType?: string;
          createdAt?: string;
          description: string;
          estateId?: string | null;
          estateKey?: string;
          id: string;
          intendedAction?: string;
          safetyCritical?: boolean;
          state?: string;
          title: string;
          updatedAt: string;
        };
        Update: {
          claimType?: string;
          createdAt?: string;
          description?: string;
          estateId?: string | null;
          estateKey?: string;
          id?: string;
          intendedAction?: string;
          safetyCritical?: boolean;
          state?: string;
          title?: string;
          updatedAt?: string;
        };
        Relationships: [];
      };
      estate: {
        Row: {
          accent: string;
          createdAt: string;
          description: string;
          id: string;
          key: string;
          name: string;
          theorem: string | null;
          updatedAt: string;
        };
        Insert: {
          accent: string;
          createdAt?: string;
          description: string;
          id: string;
          key: string;
          name: string;
          theorem?: string | null;
          updatedAt: string;
        };
        Update: {
          accent?: string;
          createdAt?: string;
          description?: string;
          id?: string;
          key?: string;
          name?: string;
          theorem?: string | null;
          updatedAt?: string;
        };
        Relationships: [];
      };
      evidence: {
        Row: {
          claimId: string;
          collectedAt: string;
          content: string;
          embedding: string;
          id: string;
          source: string;
          state: string;
          weight: number;
        };
        Insert: {
          claimId: string;
          collectedAt?: string;
          content: string;
          embedding: string;
          id: string;
          source: string;
          state?: string;
          weight?: number;
        };
        Update: {
          claimId?: string;
          collectedAt?: string;
          content?: string;
          embedding?: string;
          id?: string;
          source?: string;
          state?: string;
          weight?: number;
        };
        Relationships: [];
      };
      field_kit_capture: {
        Row: {
          createdAt: string;
          dominantBottleneck: string;
          faculty: string;
          field: string | null;
          followUp: string | null;
          id: string;
          lecturer: string;
          offered: string | null;
          q1Unverifiable: string;
          q2FailurePath: string;
          q3TrustCondition: string;
          wormSeq: number | null;
          wouldUse: string;
        };
        Insert: {
          createdAt?: string;
          dominantBottleneck: string;
          faculty: string;
          field?: string | null;
          followUp?: string | null;
          id: string;
          lecturer: string;
          offered?: string | null;
          q1Unverifiable: string;
          q2FailurePath: string;
          q3TrustCondition: string;
          wormSeq?: number | null;
          wouldUse: string;
        };
        Update: {
          createdAt?: string;
          dominantBottleneck?: string;
          faculty?: string;
          field?: string | null;
          followUp?: string | null;
          id?: string;
          lecturer?: string;
          offered?: string | null;
          q1Unverifiable?: string;
          q2FailurePath?: string;
          q3TrustCondition?: string;
          wormSeq?: number | null;
          wouldUse?: string;
        };
        Relationships: [];
      };
      funding_config: {
        Row: {
          id: string;
          targetLabel: string;
          targetZar: number;
          updatedAt: string;
        };
        Insert: {
          id: string;
          targetLabel?: string;
          targetZar?: number;
          updatedAt: string;
        };
        Update: {
          id?: string;
          targetLabel?: string;
          targetZar?: number;
          updatedAt?: string;
        };
        Relationships: [];
      };
      funding_contribution: {
        Row: {
          allocatedTarget: string;
          amountZar: number;
          blockId: string | null;
          contributionId: string;
          contributionType: string;
          contributorEmail: string;
          contributorName: string;
          createdAt: string;
          gatewayReference: string | null;
          id: string;
          institutionAffiliation: string;
          paymentMethod: string;
          paymentState: string;
          receiptId: string | null;
          sha256ReceiptHash: string | null;
          updatedAt: string;
          wormSeq: number | null;
        };
        Insert: {
          allocatedTarget?: string;
          amountZar: number;
          blockId?: string | null;
          contributionId: string;
          contributionType: string;
          contributorEmail: string;
          contributorName: string;
          createdAt?: string;
          gatewayReference?: string | null;
          id: string;
          institutionAffiliation?: string;
          paymentMethod: string;
          paymentState?: string;
          receiptId?: string | null;
          sha256ReceiptHash?: string | null;
          updatedAt: string;
          wormSeq?: number | null;
        };
        Update: {
          allocatedTarget?: string;
          amountZar?: number;
          blockId?: string | null;
          contributionId?: string;
          contributionType?: string;
          contributorEmail?: string;
          contributorName?: string;
          createdAt?: string;
          gatewayReference?: string | null;
          id?: string;
          institutionAffiliation?: string;
          paymentMethod?: string;
          paymentState?: string;
          receiptId?: string | null;
          sha256ReceiptHash?: string | null;
          updatedAt?: string;
          wormSeq?: number | null;
        };
        Relationships: [];
      };
      geographic_anchor: {
        Row: {
          createdAt: string;
          datum: string;
          id: string;
          name: string;
          tenantId: string;
          wgs84Lat: string;
          wgs84Lon: string;
        };
        Insert: {
          createdAt?: string;
          datum?: string;
          id: string;
          name: string;
          tenantId: string;
          wgs84Lat: string;
          wgs84Lon: string;
        };
        Update: {
          createdAt?: string;
          datum?: string;
          id?: string;
          name?: string;
          tenantId?: string;
          wgs84Lat?: string;
          wgs84Lon?: string;
        };
        Relationships: [];
      };
      governance_consent: {
        Row: {
          actionId: string;
          grantedAt: string;
          id: string;
          policyEpoch: number;
          subjectId: string;
        };
        Insert: {
          actionId: string;
          grantedAt?: string;
          id: string;
          policyEpoch: number;
          subjectId: string;
        };
        Update: {
          actionId?: string;
          grantedAt?: string;
          id?: string;
          policyEpoch?: number;
          subjectId?: string;
        };
        Relationships: [];
      };
      governance_hazard: {
        Row: {
          actionId: string;
          controllability: string;
          createdAt: string;
          description: string | null;
          exposure: string;
          id: string;
          severity: string;
          status: string;
          updatedAt: string;
        };
        Insert: {
          actionId: string;
          controllability: string;
          createdAt?: string;
          description?: string | null;
          exposure: string;
          id: string;
          severity: string;
          status: string;
          updatedAt: string;
        };
        Update: {
          actionId?: string;
          controllability?: string;
          createdAt?: string;
          description?: string | null;
          exposure?: string;
          id?: string;
          severity?: string;
          status?: string;
          updatedAt?: string;
        };
        Relationships: [];
      };
      governance_nonce: {
        Row: {
          actionId: string;
          actionNonce: string;
          consumedAt: string | null;
          expiresAt: string;
          permitId: string | null;
          reservedAt: string;
          state: string;
        };
        Insert: {
          actionId: string;
          actionNonce: string;
          consumedAt?: string | null;
          expiresAt: string;
          permitId?: string | null;
          reservedAt?: string;
          state: string;
        };
        Update: {
          actionId?: string;
          actionNonce?: string;
          consumedAt?: string | null;
          expiresAt?: string;
          permitId?: string | null;
          reservedAt?: string;
          state?: string;
        };
        Relationships: [];
      };
      governance_permit: {
        Row: {
          abortedAt: string | null;
          abortedReason: string | null;
          actionId: string;
          actionNonce: string;
          confirmedAt: string | null;
          evidenceManifestHash: string;
          expiresAt: string;
          governanceEventId: string;
          issuedAt: string;
          keyId: string | null;
          permitId: string;
          policyEpoch: number;
          signature: string | null;
          signedAt: string | null;
          startedAt: string | null;
          state: string;
          subjectId: string;
        };
        Insert: {
          abortedAt?: string | null;
          abortedReason?: string | null;
          actionId: string;
          actionNonce: string;
          confirmedAt?: string | null;
          evidenceManifestHash: string;
          expiresAt: string;
          governanceEventId: string;
          issuedAt: string;
          keyId?: string | null;
          permitId: string;
          policyEpoch: number;
          signature?: string | null;
          signedAt?: string | null;
          startedAt?: string | null;
          state: string;
          subjectId: string;
        };
        Update: {
          abortedAt?: string | null;
          abortedReason?: string | null;
          actionId?: string;
          actionNonce?: string;
          confirmedAt?: string | null;
          evidenceManifestHash?: string;
          expiresAt?: string;
          governanceEventId?: string;
          issuedAt?: string;
          keyId?: string | null;
          permitId?: string;
          policyEpoch?: number;
          signature?: string | null;
          signedAt?: string | null;
          startedAt?: string | null;
          state?: string;
          subjectId?: string;
        };
        Relationships: [];
      };
      governance_policy_state: {
        Row: {
          epoch: number;
          id: string;
          updatedAt: string;
        };
        Insert: {
          epoch?: number;
          id: string;
          updatedAt: string;
        };
        Update: {
          epoch?: number;
          id?: string;
          updatedAt?: string;
        };
        Relationships: [];
      };
      governance_subject: {
        Row: {
          createdAt: string;
          id: string;
          role: string;
          status: string;
          updatedAt: string;
        };
        Insert: {
          createdAt?: string;
          id: string;
          role?: string;
          status?: string;
          updatedAt: string;
        };
        Update: {
          createdAt?: string;
          id?: string;
          role?: string;
          status?: string;
          updatedAt?: string;
        };
        Relationships: [];
      };
      governance_worm_event: {
        Row: {
          actionId: string | null;
          eventId: string;
          hash: string;
          observedAt: string;
          payload: string;
          permitId: string | null;
          prevHash: string;
          seq: number;
          subjectId: string | null;
          type: string;
        };
        Insert: {
          actionId?: string | null;
          eventId: string;
          hash: string;
          observedAt: string;
          payload: string;
          permitId?: string | null;
          prevHash: string;
          seq?: never;
          subjectId?: string | null;
          type: string;
        };
        Update: {
          actionId?: string | null;
          eventId?: string;
          hash?: string;
          observedAt?: string;
          payload?: string;
          permitId?: string | null;
          prevHash?: string;
          seq?: never;
          subjectId?: string | null;
          type?: string;
        };
        Relationships: [];
      };
      heat_kernel_step: {
        Row: {
          claimId: string;
          createdAt: string;
          highFreqEnergy: number;
          id: string;
          l2Norm: number;
          nodeValues: string;
          step: number;
        };
        Insert: {
          claimId: string;
          createdAt?: string;
          highFreqEnergy: number;
          id: string;
          l2Norm: number;
          nodeValues?: string;
          step: number;
        };
        Update: {
          claimId?: string;
          createdAt?: string;
          highFreqEnergy?: number;
          id?: string;
          l2Norm?: number;
          nodeValues?: string;
          step?: number;
        };
        Relationships: [];
      };
      holo_discovery_log: {
        Row: {
          candidates: number;
          clientId: string;
          createdAt: string;
          id: number;
          matchedCode: string | null;
          maxCostPerHour: number | null;
          maxLatencyMs: number;
          minBandwidthMbps: number;
          qosClass: string;
          reason: string;
          score: number | null;
          wormSeq: number | null;
        };
        Insert: {
          candidates?: number;
          clientId: string;
          createdAt?: string;
          id?: never;
          matchedCode?: string | null;
          maxCostPerHour?: number | null;
          maxLatencyMs: number;
          minBandwidthMbps: number;
          qosClass: string;
          reason: string;
          score?: number | null;
          wormSeq?: number | null;
        };
        Update: {
          candidates?: number;
          clientId?: string;
          createdAt?: string;
          id?: never;
          matchedCode?: string | null;
          maxCostPerHour?: number | null;
          maxLatencyMs?: number;
          minBandwidthMbps?: number;
          qosClass?: string;
          reason?: string;
          score?: number | null;
          wormSeq?: number | null;
        };
        Relationships: [];
      };
      holo_qoe_sample: {
        Row: {
          codec: string;
          createdAt: string;
          id: number;
          jitterMs: number;
          latencyMs: number;
          lossPct: number;
          mos: number;
          stallMs: number;
          wormSeq: number | null;
        };
        Insert: {
          codec?: string;
          createdAt?: string;
          id?: never;
          jitterMs: number;
          latencyMs: number;
          lossPct: number;
          mos: number;
          stallMs: number;
          wormSeq?: number | null;
        };
        Update: {
          codec?: string;
          createdAt?: string;
          id?: never;
          jitterMs?: number;
          latencyMs?: number;
          lossPct?: number;
          mos?: number;
          stallMs?: number;
          wormSeq?: number | null;
        };
        Relationships: [];
      };
      holo_render_instance: {
        Row: {
          baseLatencyMs: number;
          capacityGbps: number;
          code: string;
          costPerHour: number;
          cpuUtil: number;
          createdAt: string;
          deployment: string;
          engine: string;
          gpuClass: string;
          gpuUtil: number;
          id: string;
          memUtil: number;
          region: string;
          sessions: number;
          site: string;
          status: string;
          updatedAt: string;
        };
        Insert: {
          baseLatencyMs?: number;
          capacityGbps?: number;
          code: string;
          costPerHour?: number;
          cpuUtil?: number;
          createdAt?: string;
          deployment: string;
          engine: string;
          gpuClass: string;
          gpuUtil?: number;
          id: string;
          memUtil?: number;
          region: string;
          sessions?: number;
          site: string;
          status?: string;
          updatedAt: string;
        };
        Update: {
          baseLatencyMs?: number;
          capacityGbps?: number;
          code?: string;
          costPerHour?: number;
          cpuUtil?: number;
          createdAt?: string;
          deployment?: string;
          engine?: string;
          gpuClass?: string;
          gpuUtil?: number;
          id?: string;
          memUtil?: number;
          region?: string;
          sessions?: number;
          site?: string;
          status?: string;
          updatedAt?: string;
        };
        Relationships: [];
      };
      hydraulic_invariant: {
        Row: {
          createdAt: string;
          id: string;
          maxValue: number | null;
          minValue: number | null;
          parameter: string;
          unit: string;
        };
        Insert: {
          createdAt?: string;
          id: string;
          maxValue?: number | null;
          minValue?: number | null;
          parameter: string;
          unit: string;
        };
        Update: {
          createdAt?: string;
          id?: string;
          maxValue?: number | null;
          minValue?: number | null;
          parameter?: string;
          unit?: string;
        };
        Relationships: [];
      };
      icsh_cycle: {
        Row: {
          agreement: boolean;
          createdAt: string;
          cycle: number;
          districtHead: string;
          divergentPeers: number;
          durationMs: number;
          head: string;
          line: string;
          memoryBytes: number;
          peersReachable: number;
          seq: number;
          vaultCount: number;
          viewport: string;
        };
        Insert: {
          agreement: boolean;
          createdAt?: string;
          cycle: number;
          districtHead: string;
          divergentPeers?: number;
          durationMs: number;
          head: string;
          line: string;
          memoryBytes?: number;
          peersReachable: number;
          seq?: never;
          vaultCount: number;
          viewport: string;
        };
        Update: {
          agreement?: boolean;
          createdAt?: string;
          cycle?: number;
          districtHead?: string;
          divergentPeers?: number;
          durationMs?: number;
          head?: string;
          line?: string;
          memoryBytes?: number;
          peersReachable?: number;
          seq?: never;
          vaultCount?: number;
          viewport?: string;
        };
        Relationships: [];
      };
      icsh_node: {
        Row: {
          callsign: string;
          createdAt: string;
          district: string;
          farm: string;
          id: string;
          joinCode: string | null;
          joinedAt: string | null;
          status: string;
          tier: string;
          totpSecret: string;
          trust: number;
        };
        Insert: {
          callsign: string;
          createdAt?: string;
          district: string;
          farm: string;
          id: string;
          joinCode?: string | null;
          joinedAt?: string | null;
          status?: string;
          tier?: string;
          totpSecret: string;
          trust?: number;
        };
        Update: {
          callsign?: string;
          createdAt?: string;
          district?: string;
          farm?: string;
          id?: string;
          joinCode?: string | null;
          joinedAt?: string | null;
          status?: string;
          tier?: string;
          totpSecret?: string;
          trust?: number;
        };
        Relationships: [];
      };
      icsh_peer: {
        Row: {
          bucket: number;
          createdAt: string;
          endpoint: string;
          lastHead: string | null;
          nodeId: string;
          reachable: boolean;
        };
        Insert: {
          bucket?: number;
          createdAt?: string;
          endpoint: string;
          lastHead?: string | null;
          nodeId: string;
          reachable?: boolean;
        };
        Update: {
          bucket?: number;
          createdAt?: string;
          endpoint?: string;
          lastHead?: string | null;
          nodeId?: string;
          reachable?: boolean;
        };
        Relationships: [];
      };
      icsh_run_stat: {
        Row: {
          agreementRate: number;
          createdAt: string;
          cycles: number;
          cyclesPerSec: number;
          durationMs: number;
          finalHead: string;
          headBefore: string;
          id: number;
          peersReachable: number;
          runner: string;
        };
        Insert: {
          agreementRate: number;
          createdAt?: string;
          cycles: number;
          cyclesPerSec: number;
          durationMs: number;
          finalHead: string;
          headBefore: string;
          id?: never;
          peersReachable: number;
          runner?: string;
        };
        Update: {
          agreementRate?: number;
          createdAt?: string;
          cycles?: number;
          cyclesPerSec?: number;
          durationMs?: number;
          finalHead?: string;
          headBefore?: string;
          id?: never;
          peersReachable?: number;
          runner?: string;
        };
        Relationships: [];
      };
      icsh_session: {
        Row: {
          callsign: string;
          code: string;
          createdAt: string;
          drift: number;
          expiresAt: string;
          id: string;
          nodeId: string;
          revokedAt: string | null;
          totpCode: string;
          wormSeq: number;
        };
        Insert: {
          callsign: string;
          code: string;
          createdAt?: string;
          drift: number;
          expiresAt: string;
          id: string;
          nodeId: string;
          revokedAt?: string | null;
          totpCode: string;
          wormSeq: number;
        };
        Update: {
          callsign?: string;
          code?: string;
          createdAt?: string;
          drift?: number;
          expiresAt?: string;
          id?: string;
          nodeId?: string;
          revokedAt?: string | null;
          totpCode?: string;
          wormSeq?: number;
        };
        Relationships: [];
      };
      icsh_vault_node: {
        Row: {
          content: string;
          createdAt: string;
          cycle: number;
          id: string;
          name: string;
        };
        Insert: {
          content: string;
          createdAt?: string;
          cycle: number;
          id: string;
          name: string;
        };
        Update: {
          content?: string;
          createdAt?: string;
          cycle?: number;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      nind_computation: {
        Row: {
          claimId: string;
          createdAt: string;
          eigenvalues: string;
          gamma: number;
          id: string;
          nInd: number;
          numEvidence: number;
          numSources: number;
        };
        Insert: {
          claimId: string;
          createdAt?: string;
          eigenvalues?: string;
          gamma: number;
          id: string;
          nInd: number;
          numEvidence: number;
          numSources: number;
        };
        Update: {
          claimId?: string;
          createdAt?: string;
          eigenvalues?: string;
          gamma?: number;
          id?: string;
          nInd?: number;
          numEvidence?: number;
          numSources?: number;
        };
        Relationships: [];
      };
      outreach_email: {
        Row: {
          aiGenerated: boolean;
          bodyHtml: string | null;
          createdAt: string;
          error: string | null;
          id: string;
          resendId: string | null;
          sentAt: string | null;
          status: string;
          stepIndex: number | null;
          subject: string;
          targetId: string;
          wormSeq: number | null;
        };
        Insert: {
          aiGenerated?: boolean;
          bodyHtml?: string | null;
          createdAt?: string;
          error?: string | null;
          id: string;
          resendId?: string | null;
          sentAt?: string | null;
          status?: string;
          stepIndex?: number | null;
          subject: string;
          targetId: string;
          wormSeq?: number | null;
        };
        Update: {
          aiGenerated?: boolean;
          bodyHtml?: string | null;
          createdAt?: string;
          error?: string | null;
          id?: string;
          resendId?: string | null;
          sentAt?: string | null;
          status?: string;
          stepIndex?: number | null;
          subject?: string;
          targetId?: string;
          wormSeq?: number | null;
        };
        Relationships: [];
      };
      outreach_sequence: {
        Row: {
          active: boolean;
          createdAt: string;
          id: string;
          name: string;
          stepsJson: string;
          tenantId: string;
          updatedAt: string;
        };
        Insert: {
          active?: boolean;
          createdAt?: string;
          id: string;
          name: string;
          stepsJson: string;
          tenantId?: string;
          updatedAt: string;
        };
        Update: {
          active?: boolean;
          createdAt?: string;
          id?: string;
          name?: string;
          stepsJson?: string;
          tenantId?: string;
          updatedAt?: string;
        };
        Relationships: [];
      };
      outreach_target: {
        Row: {
          annualRevenue: number | null;
          auditFail12m: boolean;
          bbbeeLevel: number | null;
          consentBasis: string;
          contactName: string;
          createdAt: string;
          criticalIssue: string | null;
          currentStep: number;
          email: string;
          employees: number | null;
          govContracts: boolean;
          id: string;
          notes: string | null;
          org: string;
          popiaRisk: boolean;
          score: number;
          sector: string | null;
          sequenceId: string | null;
          status: string;
          supplierCount: number | null;
          tenantId: string;
          tier: string;
          updatedAt: string;
        };
        Insert: {
          annualRevenue?: number | null;
          auditFail12m?: boolean;
          bbbeeLevel?: number | null;
          consentBasis?: string;
          contactName: string;
          createdAt?: string;
          criticalIssue?: string | null;
          currentStep?: number;
          email: string;
          employees?: number | null;
          govContracts?: boolean;
          id: string;
          notes?: string | null;
          org: string;
          popiaRisk?: boolean;
          score?: number;
          sector?: string | null;
          sequenceId?: string | null;
          status?: string;
          supplierCount?: number | null;
          tenantId?: string;
          tier?: string;
          updatedAt: string;
        };
        Update: {
          annualRevenue?: number | null;
          auditFail12m?: boolean;
          bbbeeLevel?: number | null;
          consentBasis?: string;
          contactName?: string;
          createdAt?: string;
          criticalIssue?: string | null;
          currentStep?: number;
          email?: string;
          employees?: number | null;
          govContracts?: boolean;
          id?: string;
          notes?: string | null;
          org?: string;
          popiaRisk?: boolean;
          score?: number;
          sector?: string | null;
          sequenceId?: string | null;
          status?: string;
          supplierCount?: number | null;
          tenantId?: string;
          tier?: string;
          updatedAt?: string;
        };
        Relationships: [];
      };
      physical_node: {
        Row: {
          assemblyTorqueNm: number | null;
          createdAt: string;
          diameterMm: number | null;
          id: string;
          materialGrade: string | null;
          name: string;
          nodeId: string;
          role: string;
          tenantId: string;
          xCoordMm: number;
          yCoordMm: number;
          zCoordMm: number;
        };
        Insert: {
          assemblyTorqueNm?: number | null;
          createdAt?: string;
          diameterMm?: number | null;
          id: string;
          materialGrade?: string | null;
          name: string;
          nodeId: string;
          role: string;
          tenantId: string;
          xCoordMm: number;
          yCoordMm: number;
          zCoordMm: number;
        };
        Update: {
          assemblyTorqueNm?: number | null;
          createdAt?: string;
          diameterMm?: number | null;
          id?: string;
          materialGrade?: string | null;
          name?: string;
          nodeId?: string;
          role?: string;
          tenantId?: string;
          xCoordMm?: number;
          yCoordMm?: number;
          zCoordMm?: number;
        };
        Relationships: [];
      };
      pipe_spool_profile: {
        Row: {
          boltSpec: string;
          createdAt: string;
          flangeStandard: string;
          id: string;
          material: string;
          nominalSize: string;
          odMm: number;
          torqueNm: number;
          wallMm: number;
        };
        Insert: {
          boltSpec: string;
          createdAt?: string;
          flangeStandard: string;
          id: string;
          material: string;
          nominalSize: string;
          odMm: number;
          torqueNm: number;
          wallMm: number;
        };
        Update: {
          boltSpec?: string;
          createdAt?: string;
          flangeStandard?: string;
          id?: string;
          material?: string;
          nominalSize?: string;
          odMm?: number;
          torqueNm?: number;
          wallMm?: number;
        };
        Relationships: [];
      };
      proximity_record: {
        Row: {
          action: string;
          batteryMv: number;
          distanceCm: number;
          dwellMs: number;
          eventId: string;
          gateDecision: string;
          gateReason: string;
          ingestedAt: string;
          occurredAt: string;
          riskMilli: number;
          rssiDbm: number;
          rulesFired: string;
          sealRef: string | null;
          source: string;
          subjectId: string;
        };
        Insert: {
          action: string;
          batteryMv: number;
          distanceCm: number;
          dwellMs: number;
          eventId: string;
          gateDecision: string;
          gateReason: string;
          ingestedAt?: string;
          occurredAt: string;
          riskMilli: number;
          rssiDbm: number;
          rulesFired: string;
          sealRef?: string | null;
          source: string;
          subjectId: string;
        };
        Update: {
          action?: string;
          batteryMv?: number;
          distanceCm?: number;
          dwellMs?: number;
          eventId?: string;
          gateDecision?: string;
          gateReason?: string;
          ingestedAt?: string;
          occurredAt?: string;
          riskMilli?: number;
          rssiDbm?: number;
          rulesFired?: string;
          sealRef?: string | null;
          source?: string;
          subjectId?: string;
        };
        Relationships: [];
      };
      rail_sweep: {
        Row: {
          at: string;
          downCount: number;
          downPorts: string;
          id: number;
          probed: number;
        };
        Insert: {
          at?: string;
          downCount: number;
          downPorts: string;
          id?: never;
          probed: number;
        };
        Update: {
          at?: string;
          downCount?: number;
          downPorts?: string;
          id?: never;
          probed?: number;
        };
        Relationships: [];
      };
      safegrid_inbox: {
        Row: {
          consumerName: string;
          eventId: string;
          eventType: string;
          id: string;
          lastSealError: string | null;
          leaseUntil: string | null;
          payload: string;
          receivedAt: string;
          sealAttempts: number;
          sealedAt: string | null;
          sealRef: string | null;
          status: string;
          streamId: string;
        };
        Insert: {
          consumerName: string;
          eventId: string;
          eventType: string;
          id: string;
          lastSealError?: string | null;
          leaseUntil?: string | null;
          payload: string;
          receivedAt?: string;
          sealAttempts?: number;
          sealedAt?: string | null;
          sealRef?: string | null;
          status: string;
          streamId: string;
        };
        Update: {
          consumerName?: string;
          eventId?: string;
          eventType?: string;
          id?: string;
          lastSealError?: string | null;
          leaseUntil?: string | null;
          payload?: string;
          receivedAt?: string;
          sealAttempts?: number;
          sealedAt?: string | null;
          sealRef?: string | null;
          status?: string;
          streamId?: string;
        };
        Relationships: [];
      };
      telemetry_log: {
        Row: {
          acousticAbnormal: boolean;
          apuTemperature: number;
          createdAt: string;
          estimatedCelerity: number | null;
          flowRate: number;
          id: string;
          invariantOk: boolean;
          nodeId: string;
          pressureHead: number;
          systemState: string;
          tenantId: string;
        };
        Insert: {
          acousticAbnormal?: boolean;
          apuTemperature: number;
          createdAt?: string;
          estimatedCelerity?: number | null;
          flowRate: number;
          id: string;
          invariantOk?: boolean;
          nodeId: string;
          pressureHead: number;
          systemState: string;
          tenantId: string;
        };
        Update: {
          acousticAbnormal?: boolean;
          apuTemperature?: number;
          createdAt?: string;
          estimatedCelerity?: number | null;
          flowRate?: number;
          id?: string;
          invariantOk?: boolean;
          nodeId?: string;
          pressureHead?: number;
          systemState?: string;
          tenantId?: string;
        };
        Relationships: [];
      };
      tenant: {
        Row: {
          anchorLat: string;
          anchorLon: string;
          code: string;
          createdAt: string;
          id: string;
          name: string;
        };
        Insert: {
          anchorLat: string;
          anchorLon: string;
          code: string;
          createdAt?: string;
          id: string;
          name: string;
        };
        Update: {
          anchorLat?: string;
          anchorLon?: string;
          code?: string;
          createdAt?: string;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      trust_gate_state: {
        Row: {
          beneficiary: string;
          certHash: string | null;
          certifiedAt: string | null;
          certifiedBy: string | null;
          createdAt: string;
          gateId: string;
          id: string;
          shares: number;
          status: string;
          updatedAt: string;
        };
        Insert: {
          beneficiary: string;
          certHash?: string | null;
          certifiedAt?: string | null;
          certifiedBy?: string | null;
          createdAt?: string;
          gateId: string;
          id: string;
          shares: number;
          status?: string;
          updatedAt: string;
        };
        Update: {
          beneficiary?: string;
          certHash?: string | null;
          certifiedAt?: string | null;
          certifiedBy?: string | null;
          createdAt?: string;
          gateId?: string;
          id?: string;
          shares?: number;
          status?: string;
          updatedAt?: string;
        };
        Relationships: [];
      };
      watchboard_snapshot: {
        Row: {
          builtAt: string;
          createdAt: string;
          hotCount: number;
          id: number;
          rows: string;
          signature: string;
        };
        Insert: {
          builtAt: string;
          createdAt?: string;
          hotCount: number;
          id?: never;
          rows: string;
          signature: string;
        };
        Update: {
          builtAt?: string;
          createdAt?: string;
          hotCount?: number;
          id?: never;
          rows?: string;
          signature?: string;
        };
        Relationships: [];
      };
      worm_event: {
        Row: {
          createdAt: string;
          details: string | null;
          event: string;
          hash: string;
          id: string;
          prevHash: string;
          seq: number;
          source: string;
        };
        Insert: {
          createdAt?: string;
          details?: string | null;
          event: string;
          hash: string;
          id: string;
          prevHash: string;
          seq: number;
          source: string;
        };
        Update: {
          createdAt?: string;
          details?: string | null;
          event?: string;
          hash?: string;
          id?: string;
          prevHash?: string;
          seq?: number;
          source?: string;
        };
        Relationships: [];
      };
      worm_seal_index: {
        Row: {
          algorithm: string;
          canonicalBytes: string;
          canonicalEventHash: string;
          eventId: string;
          position: number;
          previousRecordHash: string;
          recordHash: string;
          sealedAt: string;
          streamId: string;
        };
        Insert: {
          algorithm?: string;
          canonicalBytes: string;
          canonicalEventHash: string;
          eventId: string;
          position: number;
          previousRecordHash: string;
          recordHash: string;
          sealedAt?: string;
          streamId: string;
        };
        Update: {
          algorithm?: string;
          canonicalBytes?: string;
          canonicalEventHash?: string;
          eventId?: string;
          position?: number;
          previousRecordHash?: string;
          recordHash?: string;
          sealedAt?: string;
          streamId?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
