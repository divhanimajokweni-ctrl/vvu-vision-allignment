/**
 * VVU · STUDIO — depot/gate_eval.py (ONE INSTRUMENT · day-one depot gate).
 */
"use client";
import { useState } from "react";
import { useStudio } from "@/lib/vvu-studio/store";
import { DEPOT_DEFAULTS, evalDepot } from "@/lib/vvu-studio/labs";
import { Card, Badge, Button, Field } from "../ui";
import { ShieldIcon } from "../Icons";

export function DepotView() {
  const result = useStudio((s) => s.depotResult);
  const evalDepotAction = useStudio((s) => s.evalDepot);
  const [date, setDate] = useState(DEPOT_DEFAULTS.date());
  const [depot, setDepot] = useState(DEPOT_DEFAULTS.depot);
  const [role, setRole] = useState(DEPOT_DEFAULTS.role);
  const [owner, setOwner] = useState(DEPOT_DEFAULTS.owner);
  const [cost, setCost] = useState(DEPOT_DEFAULTS.cost);
  const [tier, setTier] = useState<"T1" | "T2" | "T3" | "T4">(DEPOT_DEFAULTS.tier);
  const [q2, setQ2] = useState(DEPOT_DEFAULTS.q2);
  const [q3, setQ3] = useState(DEPOT_DEFAULTS.q3);

  const live = evalDepot({ cost, tier, q2, q3 });
  const shown = result ?? live;

  const mini = (ok: boolean) => (
    <Badge tone={ok ? "pass" : "fail"}>{ok ? "pass" : "fail"}</Badge>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="vvu-doc">
        <div className="vk">depot/gate_eval.py</div>
        <h1>Day-One Depot · ONE INSTRUMENT</h1>
        <p className="lede">One visit, one instrument, three questions, one recording line.</p>
      </div>

      <Card title="OBSERVATION">
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <Field label="date"><input className="vvu-input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="depot"><input className="vvu-input" value={depot} onChange={(e) => setDepot(e.target.value)} /></Field>
          <Field label="role"><input className="vvu-input" value={role} onChange={(e) => setRole(e.target.value)} /></Field>
          <Field label="owner"><input className="vvu-input" value={owner} onChange={(e) => setOwner(e.target.value)} /></Field>
          <Field label={`cost (R/month) · Q1`}>
            <input className="vvu-input" type="number" step={500} value={cost} onChange={(e) => setCost(Number(e.target.value) || 0)} />
          </Field>
          <Field label="tier">
            <select className="vvu-input" value={tier} onChange={(e) => setTier(e.target.value as "T1" | "T2" | "T3" | "T4")}>
              <option value="T1">T1 · Computed</option>
              <option value="T2">T2 · Documented</option>
              <option value="T3">T3 · Claimed</option>
              <option value="T4">T4 · Hearsay</option>
            </select>
          </Field>
        </div>

        <div className="mt-3 space-y-2 border-t border-[var(--vs-border)] pt-3">
          <label className="flex items-center justify-between text-[12px] text-[var(--vs-text2)]">
            <span><span className="mono text-[10px] text-[var(--vs-dim)]">Q2 · structural:</span> visible inefficiency from untrusted telemetry?</span>
            <input type="checkbox" checked={q2} onChange={(e) => setQ2(e.target.checked)} className="h-4 w-4 accent-[var(--vs-accent2)]" />
          </label>
          <label className="flex items-center justify-between text-[12px] text-[var(--vs-text2)]">
            <span><span className="mono text-[10px] text-[var(--vs-dim)]">Q3 · capability:</span> read-only tap without breaking the write-path?</span>
            <input type="checkbox" checked={q3} onChange={(e) => setQ3(e.target.checked)} className="h-4 w-4 accent-[var(--vs-accent2)]" />
          </label>
        </div>

        <div className="mt-3">
          <Button variant="primary" onClick={() => evalDepotAction({ cost, tier, q2, q3 })}>
            <ShieldIcon size={13} /> Evaluate Gate
          </Button>
        </div>
      </Card>

      <Card title="GATE RESULT">
        <div className="flex items-center gap-2">
          {shown.pass ? <Badge tone="pass">PASS</Badge> : <Badge tone="fail">FAIL</Badge>}
          <span className="text-[12px] text-[var(--vs-text2)]">
            {shown.pass ? "Build Kit #1 authorised" : "deployment prohibited"}
          </span>
        </div>
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]"><span className="mono text-[var(--vs-dim)]">Q1 · cost &gt; R20,000</span>{mini(shown.finOk)}</div>
          <div className="flex items-center justify-between text-[11px]"><span className="mono text-[var(--vs-dim)]">tier ∈ {`{T1, T2}`}</span>{mini(shown.tierOk)}</div>
          <div className="flex items-center justify-between text-[11px]"><span className="mono text-[var(--vs-dim)]">Q2 · structural</span>{mini(shown.q2)}</div>
          <div className="flex items-center justify-between text-[11px]"><span className="mono text-[var(--vs-dim)]">Q3 · capability</span>{mini(shown.q3)}</div>
        </div>
        <div className={"mt-3 rounded-md border-l-2 px-3 py-2 text-[12px] " + (shown.pass ? "border-[var(--vs-accent)] bg-[var(--vs-accentbg)]/40 text-[var(--vs-accent)]" : "border-[var(--vs-amber)] bg-[var(--vs-amberbg)] text-[var(--vs-amber)]")}>
          {shown.pass
            ? "PASS → Mk 0.5 · R1,671. A R5k depot PASS funds the passport."
            : "Gate did not open. Walk away."}
        </div>
      </Card>

      <Card title="RECORDING LINE">
        <div className="mono rounded-md border border-[var(--vs-border)] bg-[#050507] px-3 py-2 text-[11px] leading-relaxed">
          <span className="text-[var(--vs-accent)]">{date}</span>{" "}
          <span className="text-[#569cd6]">[{depot}]</span>{" "}
          <span className="text-[var(--vs-text2)]">[{role}]</span>{" "}
          <span className="text-[var(--vs-text2)]">cost = </span>
          <span className="text-[var(--vs-accent)]">R{cost.toLocaleString()}</span>{" "}
          <span className={shown.tierOk ? "text-[var(--vs-accent)]" : "text-[var(--vs-amber)]"}>[{tier}]</span>{" "}
          <span className="text-[var(--vs-text2)]">owner = {owner}</span>
        </div>
      </Card>
    </div>
  );
}
