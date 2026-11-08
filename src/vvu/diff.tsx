"use client";
// VVU diff view — compare two BENCH receipts (or two FIRE runs) side-by-side.
// Highlights changed fields and changed digests.
import React from "react";
import { Panel, Hint, Btn, Badge, Code, Grid } from "./primitives";
import { selectCls } from "./primitives";
import { useBench, BenchReceipt } from "./envs/bench/store";
import { useFire } from "./envs/fire/store";

export function DiffView({ kind }: { kind: "bench" | "fire" }) {
  const [aId, setAId] = React.useState("");
  const [bId, setBId] = React.useState("");
  // call both hooks unconditionally (rules of hooks)
  const benchReceipts = useBench((s) => s.d.receipts);
  const fireRuns = useFire((s) => s.d.runs);

  if (kind === "bench") {
    const a = benchReceipts.find((r) => r.receipt_id === aId);
    const b = benchReceipts.find((r) => r.receipt_id === bId);
    return (
      <BenchDiff
        receipts={benchReceipts}
        a={a} b={b}
        aId={aId} bId={bId}
        setAId={setAId} setBId={setBId}
      />
    );
  }
  // fire
  const a = fireRuns.find((r: any) => (r.run_id || r.id) === aId);
  const b = fireRuns.find((r: any) => (r.run_id || r.id) === bId);
  return (
    <FireDiff
      runs={fireRuns}
      a={a as any} b={b as any}
      aId={aId} bId={bId}
      setAId={setAId} setBId={setBId}
    />
  );
}

// ============================================================
// BENCH receipt diff
// ============================================================
function BenchDiff({ receipts, a, b, aId, bId, setAId, setBId }: {
  receipts: BenchReceipt[];
  a?: BenchReceipt; b?: BenchReceipt;
  aId: string; bId: string;
  setAId: (s: string) => void; setBId: (s: string) => void;
}) {
  if (receipts.length < 2) {
    return (
      <Panel title="Receipt diff" hint="compare two receipts field-by-field">
        <div className="vvu-tempty">
          need at least 2 receipts to diff — run verifications in the Verify tab first
          <br /><span style={{ fontSize: 10 }}>current: {receipts.length} receipt(s)</span>
        </div>
      </Panel>
    );
  }

  const fields: { k: string; label: string; va: React.ReactNode; vb: React.ReactNode; mono?: boolean }[] = a && b ? [
    { k: "receipt_id", label: "Receipt ID", va: a.receipt_id, vb: b.receipt_id, mono: true },
    { k: "claim_ref", label: "Claim ref", va: a.claim_ref, vb: b.claim_ref, mono: true },
    { k: "policy", label: "Policy", va: a.policy, vb: b.policy },
    { k: "consent_tier", label: "Consent tier", va: a.consent_tier, vb: b.consent_tier },
    { k: "artefact_id", label: "Artefact ID", va: a.artefact_id, vb: b.artefact_id, mono: true },
    { k: "digest", label: "Digest", va: a.digest?.slice(0, 24) + "…", vb: b.digest?.slice(0, 24) + "…", mono: true },
    { k: "signature", label: "Signature", va: a.signature?.slice(0, 24) + "…", vb: b.signature?.slice(0, 24) + "…", mono: true },
    { k: "receipt_hash", label: "Receipt hash", va: a.receipt_hash?.slice(0, 24) + "…", vb: b.receipt_hash?.slice(0, 24) + "…", mono: true },
    { k: "outcome", label: "Outcome", va: <Badge kind={a.outcome === "PROVEN" ? "ok" : a.outcome === "BLOCKED" ? "warn" : "bad"}>{a.outcome}</Badge>, vb: <Badge kind={b.outcome === "PROVEN" ? "ok" : b.outcome === "BLOCKED" ? "warn" : "bad"}>{b.outcome}</Badge> },
    { k: "anchor_id", label: "Anchor", va: a.anchor?.anchor_id, vb: b.anchor?.anchor_id, mono: true },
    { k: "when", label: "When", va: new Date(a.when).toISOString().slice(11, 19), vb: new Date(b.when).toISOString().slice(11, 19), mono: true },
  ] : [];

  const changedCount = fields.filter((f) => String(f.va) !== String(f.vb) && !React.isValidElement(f.va)).length;
  const checksDiff = a && b ? a.checks.map((c, i) => ({
    check: c.check,
    a: c.result,
    b: b.checks[i]?.result ?? "—",
    aDetail: c.detail,
    bDetail: b.checks[i]?.detail ?? "",
  })) : [];

  return (
    <>
      <Panel title="Receipt diff" hint="compare two BENCH receipts field-by-field · changed fields highlighted">
        <Hint>
          Select two receipts from the dropdowns. Fields that differ between the two are highlighted
          with a <Badge kind="warn">CHANGED</Badge> badge and a tinted background. Check results that
          differ are shown in red.
        </Hint>
        <div className="vvu-diff-pickers">
          <div className="vvu-diff-picker">
            <label>A</label>
            <select className={selectCls} value={aId} onChange={(e) => setAId(e.target.value)}>
              <option value="">— select receipt A —</option>
              {receipts.map((r) => <option key={r.receipt_id} value={r.receipt_id}>{r.receipt_id} · {r.outcome}</option>)}
            </select>
          </div>
          <div className="vvu-diff-picker">
            <label>B</label>
            <select className={selectCls} value={bId} onChange={(e) => setBId(e.target.value)}>
              <option value="">— select receipt B —</option>
              {receipts.map((r) => <option key={r.receipt_id} value={r.receipt_id}>{r.receipt_id} · {r.outcome}</option>)}
            </select>
          </div>
        </div>
      </Panel>

      {a && b && (
        <>
          <Panel title="FIELD COMPARISON" hint={`${changedCount} field(s) changed`} right={
            <Btn sm onClick={() => { setAId(bId); setBId(aId); }}>⇄ swap A/B</Btn>
          }>
            <div className="vvu-diff-table">
              <div className="vvu-diff-row vvu-diff-head">
                <div className="k">FIELD</div>
                <div className="va">A</div>
                <div className="vb">B</div>
                <div className="st">STATUS</div>
              </div>
              {fields.map((f) => {
                const changed = String(f.va) !== String(f.vb) && !React.isValidElement(f.va) && !React.isValidElement(f.vb);
                return (
                  <div key={f.k} className={`vvu-diff-row ${changed ? "changed" : ""}`}>
                    <div className="k">{f.label}</div>
                    <div className={`va ${f.mono ? "mono" : ""}`}>{f.va}</div>
                    <div className={`vb ${f.mono ? "mono" : ""}`}>{f.vb}</div>
                    <div className="st">{changed ? <Badge kind="warn">CHANGED</Badge> : <Badge kind="ok">same</Badge>}</div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="CHECK RESULTS DIFF" hint={`${checksDiff.filter((c) => c.a !== c.b).length} check(s) differ`}>
            <div className="vvu-diff-table">
              <div className="vvu-diff-row vvu-diff-head">
                <div className="k">CHECK</div>
                <div className="va">A</div>
                <div className="vb">B</div>
                <div className="st">STATUS</div>
              </div>
              {checksDiff.map((c) => {
                const changed = c.a !== c.b;
                return (
                  <div key={c.check} className={`vvu-diff-row ${changed ? "changed" : ""}`}>
                    <div className="k">{c.check}</div>
                    <div className="va"><Badge kind={c.a === "PASS" ? "ok" : "bad"}>{c.a}</Badge></div>
                    <div className="vb"><Badge kind={c.b === "PASS" ? "ok" : "bad"}>{c.b}</Badge></div>
                    <div className="st">{changed ? <Badge kind="bad">DIFFERS</Badge> : <Badge kind="ok">same</Badge>}</div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="SCOPE & LIMITATIONS">
            <Grid cls="g2">
              <div>
                <div className="vvu-hint" style={{ fontWeight: 600, marginBottom: 6 }}>A · SCOPE</div>
                <Code>{a.scope}</Code>
                {a.limitations.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div className="vvu-hint" style={{ fontWeight: 600, marginBottom: 4 }}>A · LIMITATIONS</div>
                    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: "var(--vvu-dim)" }}>
                      {a.limitations.map((l, i) => <li key={i}>{l}</li>)}
                    </ul>
                  </div>
                )}
              </div>
              <div>
                <div className="vvu-hint" style={{ fontWeight: 600, marginBottom: 6 }}>B · SCOPE</div>
                <Code>{b.scope}</Code>
                {b.limitations.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div className="vvu-hint" style={{ fontWeight: 600, marginBottom: 4 }}>B · LIMITATIONS</div>
                    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: "var(--vvu-dim)" }}>
                      {b.limitations.map((l, i) => <li key={i}>{l}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </Grid>
          </Panel>
        </>
      )}
    </>
  );
}

// ============================================================
// FIRE run diff
// ============================================================
function FireDiff({ runs, a, b, aId, bId, setAId, setBId }: {
  runs: any[]; a: any; b: any;
  aId: string; bId: string;
  setAId: (s: string) => void; setBId: (s: string) => void;
}) {
  if (runs.length < 2) {
    return (
      <Panel title="Run diff" hint="compare two FIRE runs">
        <div className="vvu-tempty">
          need at least 2 runs to diff — execute runs in the Run tab first
          <br /><span style={{ fontSize: 10 }}>current: {runs.length} run(s)</span>
        </div>
      </Panel>
    );
  }
  const fields: { k: string; label: string; va: any; vb: any; mono?: boolean }[] = a && b ? [
    { k: "run_id", label: "Run ID", va: a.run_id || a.id, vb: b.run_id || b.id, mono: true },
    { k: "target", label: "Target", va: a.target, vb: b.target },
    { k: "seed", label: "Seed", va: a.seed, vb: b.seed, mono: true },
    { k: "auth", label: "Auth", va: a.auth_id || a.auth || "—", vb: b.auth_id || b.auth || "—", mono: true },
    { k: "ran", label: "Cases ran", va: a.ran ?? a.cases?.length ?? 0, vb: b.ran ?? b.cases?.length ?? 0 },
    { k: "passed", label: "Passed", va: a.passed ?? 0, vb: b.passed ?? 0 },
    { k: "failed", label: "Failed", va: a.failed ?? 0, vb: b.failed ?? 0 },
    { k: "state", label: "State", va: a.state || a.blocked || "—", vb: b.state || b.blocked || "—" },
  ] : [];
  const changedCount = fields.filter((f) => String(f.va) !== String(f.vb)).length;

  return (
    <>
      <Panel title="Run diff" hint="compare two FIRE runs field-by-field">
        <Hint>Select two runs to compare. Fields that differ are highlighted.</Hint>
        <div className="vvu-diff-pickers">
          <div className="vvu-diff-picker">
            <label>A</label>
            <select className={selectCls} value={aId} onChange={(e) => setAId(e.target.value)}>
              <option value="">— select run A —</option>
              {runs.map((r: any, i: number) => <option key={r.run_id || r.id || i} value={r.run_id || r.id}>{r.run_id || r.id || `run ${i+1}`} · {r.target}</option>)}
            </select>
          </div>
          <div className="vvu-diff-picker">
            <label>B</label>
            <select className={selectCls} value={bId} onChange={(e) => setBId(e.target.value)}>
              <option value="">— select run B —</option>
              {runs.map((r: any, i: number) => <option key={r.run_id || r.id || i} value={r.run_id || r.id}>{r.run_id || r.id || `run ${i+1}`} · {r.target}</option>)}
            </select>
          </div>
        </div>
      </Panel>
      {a && b && (
        <Panel title="FIELD COMPARISON" hint={`${changedCount} field(s) changed`} right={
          <Btn sm onClick={() => { setAId(bId); setBId(aId); }}>⇄ swap A/B</Btn>
        }>
          <div className="vvu-diff-table">
            <div className="vvu-diff-row vvu-diff-head">
              <div className="k">FIELD</div>
              <div className="va">A</div>
              <div className="vb">B</div>
              <div className="st">STATUS</div>
            </div>
            {fields.map((f) => {
              const changed = String(f.va) !== String(f.vb);
              return (
                <div key={f.k} className={`vvu-diff-row ${changed ? "changed" : ""}`}>
                  <div className="k">{f.label}</div>
                  <div className={`va ${f.mono ? "mono" : ""}`}>{String(f.va)}</div>
                  <div className={`vb ${f.mono ? "mono" : ""}`}>{String(f.vb)}</div>
                  <div className="st">{changed ? <Badge kind="warn">CHANGED</Badge> : <Badge kind="ok">same</Badge>}</div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}
    </>
  );
}
