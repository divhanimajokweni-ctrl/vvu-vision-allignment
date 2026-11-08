/* VVU ADAPTERS — map each environment's NATIVE records to SF envelopes (producer side) and back (receiver side).
   Rule: an adapter may only restate what the native record says. It never raises a status, never converts a
   synthetic observation into a device one, never invents a link that is not in the native data.
   Every gap between native data and the envelope contract is written into `limitations`, not dropped. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VVUAdapters = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function make(V, ctx) {
    /* ctx: { environment, instance_id, operator_id, software_version?, signer?, envelope_version? } */
    var who = { environment: ctx.environment, instance_id: ctx.instance_id, operator_id: ctx.operator_id, software_version: ctx.software_version || '1.0.0' };
    var ver = ctx.envelope_version || '1.0.0';
    function iso(t) { return typeof t === 'number' ? new Date(t).toISOString() : String(t); }
    function tierOf(v) { return V.TIERS.indexOf(v) >= 0 ? v : null; }
    /* tier_tag has no legal top-level home in 1.0.0 (D-INT-02), so it travels in content there and at top level in 2.0.0 */
    function build(type, content, o) {
      o = o || {};
      var tier = o.tier || 'Hypothesis';
      if (ver === '1.0.0') content.tier_tag = tier;
      return V.seal({ artefact_id: o.artefact_id, artefact_type: type, produced_by: who, produced_at: o.produced_at, content: content, provenance: { inputs: o.inputs || [], supersedes: [], policy: o.policy, configuration: o.configuration }, status: o.status || 'DRAFT', limitations: o.limitations || [], tier_tag: tier },
        { envelope_version: ver, signer: ctx.signer });
    }
    function readNative(storage, key) { try { return JSON.parse(storage.getItem(key)); } catch (e) { return null; } }

    var A = { build: build, readNative: readNative };

    /* ---------------- FORGE ---------------- */
    A.forge = {
      claim: function (c) {
        if (c.status !== 'PROPOSED') throw new Error('Forge may only export PROPOSED claims');
        return build('claim', { statement: c.claim_text, scope: 'unspecified', basis: 'proposed by ' + c.author + '; supporting artefacts: ' + (c.supporting_artefact_ids || []).length, assumptions: [], proposed_status: 'PROPOSED', native_claim_id: c.claim_id },
          { tier: tierOf(c.tier_tag) || 'Hypothesis', inputs: (c.supporting_artefact_ids || []).filter(function (x) { return /^[0-9a-f]{8}-/.test(x); }), limitations: ['PROPOSED: not verified, not tested, not published', 'native supporting artefact ids that are not UUIDs were not carried: ' + (c.supporting_artefact_ids || []).filter(function (x) { return !/^[0-9a-f]{8}-/.test(x); }).length] });
      },
      /* legacy Forge artefacts carry non-UUID ids, top-level tier_tag/surface, and so cannot be exported as they are */
      legacyArtefact: function (a) {
        var c = a.content || {};
        var content = { model_id: a.artefact_id, model_type: (a.surface || 'forge-artefact') + ':' + a.artefact_type, parameters_ref: 'inline', code_ref: 'none', inputs: [], outputs: [], payload: c, legacy_artefact_id: a.artefact_id, legacy_digest: a.integrity && a.integrity.digest };
        return build('model', content, { tier: tierOf(a.tier_tag) || 'Hypothesis', produced_at: a.produced_at && /Z$/.test(a.produced_at) ? a.produced_at : undefined, limitations: ['re-wrapped from a non-conformant Forge artefact; original id and digest kept in content.legacy_*', 'provenance label: ' + ((a.provenance && a.provenance.label) || 'not recorded')] });
      }
    };

    /* ---------------- FIELD ---------------- */
    var SENSOR_MAP = { OK: 'NOMINAL', NOMINAL: 'NOMINAL', DEGRADED: 'DEGRADED', FAULT: 'FAULT', UNKNOWN: 'UNKNOWN' };
    A.field = {
      observation: function (o, gaps) {
        var lim = [], ss = SENSOR_MAP[o.sensor_state] || 'UNKNOWN';
        if (!SENSOR_MAP[o.sensor_state]) lim.push('native sensor_state "' + o.sensor_state + '" has no SF equivalent; recorded as UNKNOWN');
        if (o.provenance === 'SYNTHETIC-ONLY') lim.push('SYNTHETIC-ONLY: not device evidence');
        if (ss === 'FAULT') lim.push('sensor_state FAULT: reading recorded and flagged, never corrected');
        if (o.calibration_state === 'EXPIRED') lim.push('calibration EXPIRED at capture');
        if (o.clock_confidence && o.clock_confidence !== 'HIGH') lim.push('clock confidence ' + o.clock_confidence + ' (' + o.clock_source + ')');
        lim.push('location not captured by Field');
        var m = typeof o.measured_at === 'number' ? o.measured_at : Date.parse(o.measured_at), r = typeof o.received_at === 'number' ? o.received_at : Date.parse(o.received_at);
        (gaps || []).forEach(function (g) { if (typeof g.from === 'number' && m >= g.from - 1 && m <= g.to + 1) lim.push('captured inside recorded connectivity gap ' + iso(g.from) + ' to ' + iso(g.to)); });
        return build('observation', { value: o.value, unit: o.unit, sensor_id: o.sensor_id, measured_at: iso(o.measured_at), received_at: iso(o.received_at), sensor_state: ss, calibration_state: o.calibration_state, location: null,
          observation_id: o.observation_id, configuration_version: o.configuration_version, provenance_class: o.provenance, clock_source: o.clock_source, clock_confidence: o.clock_confidence, transmission_latency_ms: (isNaN(r) || isNaN(m)) ? null : r - m },
          { tier: 'Reality', status: 'DRAFT', limitations: lim });
      }
    };

    /* ---------------- FIRE ---------------- */
    function summarise(cases, blocked) {
      var n = { PASSED: 0, FAILED: 0, INCONCLUSIVE: 0, BLOCKED: 0, SKIPPED: 0 };
      cases.forEach(function (c) {
        if (c.outcome === 'PASSED-UNDER-CONDITIONS') n.PASSED++; else if (c.outcome === 'FAILED') n.FAILED++;
        else if (c.outcome === 'INCONCLUSIVE') n.INCONCLUSIVE++; else if (c.outcome === 'BLOCKED') n.BLOCKED++; else n.SKIPPED++;
      });
      var result = blocked ? 'BLOCKED' : n.FAILED ? 'FAILED' : (n.INCONCLUSIVE || n.BLOCKED || n.SKIPPED || !cases.length) ? 'INCONCLUSIVE' : 'PASSED-UNDER-CONDITIONS';
      return { result: result, counts: n, coverage_statement: blocked ? 'No case executed: ' + blocked : 'Executed ' + (cases.length - n.SKIPPED) + ' of ' + cases.length + ' registered cases. ' + n.SKIPPED + ' skipped by asset absence. A pass shows no failure observed on the registered inputs; it is not a safety claim.' };
    }
    A.fire = {
      testReport: function (run, counterexamples, threats) {
        var reportId = V.uuid4(), cxs = (counterexamples || []).filter(function (c) { return c.runId === run.id; });
        var cxEnv = cxs.map(function (c) {
          return build('counterexample', { target_ref: c.targetId + '@' + c.targetVersion, failure_ref: c.runId + '#' + c.caseId, minimal_reproduction: c.repro, conditions: { seed: c.seed, target_version: c.targetVersion }, expected: c.expected, actual: c.observed, native_counterexample_id: c.id },
            { tier: 'Reality', status: 'INTEGRITY_VALID', inputs: [reportId], limitations: ['preserved as the smallest reproduction Fire held; no minimisation beyond the native case'] });
        });
        var lim = [], hasThreats = threats && threats.length;
        if (!hasThreats) lim.push('RETROFITTED: no pre-registered threat model; expectations were not registered before the first result');
        var skipped = run.cases.filter(function (c) { return c.outcome === 'SKIPPED-BY-ASSET-ABSENCE'; });
        if (skipped.length) lim.push('skipped by asset absence: ' + skipped.map(function (c) { return c.caseId; }).join(', '));
        if (run.blocked) lim.push('run blocked: ' + run.blocked);
        if (!run.authRef && !run.blocked) lim.push('no authorisation reference recorded');
        var sum = summarise(run.cases, run.blocked || null);
        sum.seed = run.seed; sum.auth_ref = run.authRef || null;
        var cases = run.cases.map(function (c) {
          return { case_id: c.caseId, threat_ref: c.threatId || 'unregistered', expected: c.expected === undefined ? null : c.expected, actual: c.observed === undefined ? null : c.observed, result: c.outcome, detail: c.detail };
        });
        var report = build('test_report', { target_ref: run.targetId + '@' + run.targetVersion, threat_model_ref: hasThreats ? 'sha256:' + V.sha256Hex(V.jcs(threats)) : 'unregistered', cases: cases, summary: sum, counterexample_refs: cxEnv.map(function (e) { return e.artefact_id; }), native_run_id: run.id },
          { artefact_id: reportId, tier: 'Reality', status: 'INTEGRITY_VALID', limitations: lim, configuration: 'seed:' + run.seed });
        return { report: report, counterexamples: cxEnv };
      }
    };

    /* ---------------- BENCH ---------------- */
    A.bench = {
      /* re-seal a native receipt so it is conformant: UUID id, signature over raw digest bytes, no extra integrity keys */
      receipt: function (nativeReceipt) {
        var oc = nativeReceipt.envelope.content, native = nativeReceipt.envelope;
        var checks = (oc.checks || []).map(function (k, i) { return { check_id: k.check_id || k.check || 'check-' + i, description: k.description || k.detail || '', result: k.result, evidence_ref: k.evidence_ref || (oc.evidence_refs && oc.evidence_refs[0]) || 'none' }; });
        var content = { claim_ref: oc.claim_ref, policy: oc.policy, evidence_refs: oc.evidence_refs || [], checks: checks, outcome: oc.outcome, scope_statement: oc.scope_statement, limitations: oc.limitations || [], native_artefact_id: native.artefact_id, native_digest: native.integrity && native.integrity.digest };
        var status = oc.outcome === 'PROVEN' ? 'VERIFIED' : 'INTEGRITY_VALID';
        var lim = (oc.limitations || []).slice();
        if (oc.outcome !== 'PROVEN' && !lim.length) lim.push('outcome ' + oc.outcome + ': see checks');
        if (['INCONCLUSIVE', 'NOT_PROVEN', 'BLOCKED'].indexOf(oc.outcome) < 0 && oc.outcome === 'PROVEN') lim.push('scope: ' + oc.scope_statement);
        return build('verification_receipt', content, { tier: 'Reality', status: status === 'VERIFIED' ? 'VERIFIED' : 'INTEGRITY_VALID', policy: oc.policy, inputs: [], limitations: lim });
      },
      claimFromEnvelope: function (env) {
        if (env.artefact_type !== 'claim') throw new Error('not a claim');
        return { id: env.artefact_id, claim_text: env.content.statement, evidence_refs: env.provenance.inputs.slice(), requested_policy: null, imported_status: 'INTEGRITY_VALID', proposed: env.content.proposed_status === 'PROPOSED', created: Date.parse(env.produced_at) };
      }
    };

    /* ---------------- PRESS ---------------- */
    A.press = {
      receiptFromEnvelope: function (env, transitionsView) {
        if (env.artefact_type !== 'verification_receipt') throw new Error('not a verification_receipt');
        var c = env.content;
        return { id: env.artefact_id, artefact_id: env.artefact_id, policy: env.provenance.policy, outcome: c.outcome, scope_statement: c.scope_statement,
          limitations: (env.limitations || []).concat(c.limitations || []), digest: env.integrity.digest, signed: !!env.integrity.signature,
          expired: !!(transitionsView && transitionsView.some(function (t) { return (t.to_status || (t.content && t.content.to_status)) === 'EXPIRED'; })),
          superseded: !!(transitionsView && transitionsView.some(function (t) { return (t.to_status || (t.content && t.content.to_status)) === 'SUPERSEDED'; })),
          created: Date.parse(env.produced_at), imported_from_envelope: true };
      },
      publication: function (pub, receiptsById) {
        var refs = [], lim = [];
        var rec = pub.receiptId && receiptsById ? receiptsById[pub.receiptId] : null;
        if (pub.receiptId) {
          if (rec && rec.imported_from_envelope) refs.push({ artefact_id: rec.artefact_id, digest: rec.digest, outcome_at_approval: rec.outcome, policy: rec.policy });
          else lim.push('receipt ' + pub.receiptId + ' was not imported from an envelope: reference unresolved, verification language must not be inferred from it');
        }
        var appr = pub.approval ? [{ approver_id: pub.approval.approver, role: pub.approval.role, approved_at: pub.approval.approved_at, approved_version: pub.version_hash }] : [];
        if (!appr.length) lim.push('no approval record');
        (pub.approval && pub.approval.held_statements || []).forEach(function (h) { lim.push('held: ' + h); });
        if (pub.retracted) lim.push('source retracted; publication flagged, not removed');
        return build('publication', { title: pub.title, body_ref: 'sha256:' + V.sha256Hex(pub.body), body: pub.body, referenced_artefacts: refs, approvals: appr, version: pub.version, corrections: pub.corrections || [], native_publication_id: pub.id },
          { tier: 'Reality', status: 'INTEGRITY_VALID', inputs: refs.map(function (r) { return r.artefact_id; }), limitations: lim });
      }
    };
    return A;
  }
  return { make: make };
});
