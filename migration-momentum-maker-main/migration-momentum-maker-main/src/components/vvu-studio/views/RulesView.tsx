/**
 * VVU · STUDIO — the rules (capability 2).
 * Written down. Deterministic. Same input → same result, for anyone.
 * The COUNT is irrelevant — what matters is they're published and reproducible.
 *
 * Capability 2 also says: "whatever rules — yours, mine, anyone's".
 * So each rule has an enable/disable toggle.
 */
"use client";
import { useStudio } from "@/lib/vvu-studio/store";
import { runRules, summarise, RULE_DEFS, type RuleVerdict } from "@/lib/vvu-studio/loop";
import { Card, Badge, Button } from "../ui";

function VBadge({ v }: { v: RuleVerdict }) {
  if (v === "PASS") return <Badge tone="pass">PASS</Badge>;
  if (v === "FAIL") return <Badge tone="fail">FAIL</Badge>;
  return <Badge tone="stub">CAN'T DECIDE</Badge>;
}

export function RulesView() {
  const observation = useStudio((s) => s.observation);
  const enabledRules = useStudio((s) => s.enabledRules);
  const toggleRule = useStudio((s) => s.toggleRule);
  const runLoop = useStudio((s) => s.runLoop);
  const results = runRules(observation, enabledRules);
  const summary = summarise(results);
  const enabledCount = RULE_DEFS.filter((r) => enabledRules[r.id] !== false).length;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="vvu-doc">
        <div className="vk">the loop / rules.py</div>
        <h1>The Rules · capability 2</h1>
        <p className="lede">
          Written down. Deterministic. Same input, same rules, same result — for anyone.
          The <strong>count</strong> is irrelevant. What matters: they're published and reproducible.
          <br />
          <span className="text-[var(--vs-dim)]">"Whatever rules — yours, mine, anyone's."</span> Toggle a rule off to see the loop adapt.
        </p>
      </div>

      <Card title={`RULES · ${enabledCount} enabled · ${summary.pass} pass · ${summary.fail} fail · ${summary.cant} can't-decide`}>
        <div className="space-y-1">
          {RULE_DEFS.map((def) => {
            const result = results.find((r) => r.id === def.id);
            const enabled = enabledRules[def.id] !== false;
            const verdict = result?.verdict;
            return (
              <div
                key={def.id}
                className={
                  "flex items-center gap-2 rounded-md border px-2.5 py-1.5 transition-colors " +
                  (!enabled
                    ? "border-[var(--vs-border)] bg-[var(--vs-bg2)] opacity-50"
                    : verdict === "FAIL"
                    ? "border-[#7f1d1d]/50 bg-[var(--vs-redbg)]/30"
                    : verdict === "PASS"
                    ? "border-[#065f46]/40 bg-[var(--vs-accentbg)]/20"
                    : "border-[#78350f]/50 bg-[var(--vs-amberbg)]/30")
                }
              >
                {/* enable/disable toggle */}
                <button
                  onClick={() => toggleRule(def.id)}
                  className={
                    "relative h-4 w-7 shrink-0 rounded-full transition-colors " +
                    (enabled ? "bg-[var(--vs-accent2)]" : "bg-[var(--vs-border3)]")
                  }
                  aria-label={enabled ? "disable " + def.id : "enable " + def.id}
                  title={enabled ? "enabled — click to disable" : "disabled — click to enable"}
                >
                  <span
                    className={
                      "absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform " +
                      (enabled ? "translate-x-3.5" : "translate-x-0.5")
                    }
                  />
                </button>
                <span className="mono w-7 text-[11px] text-[var(--vs-text)]">{def.id}</span>
                {enabled && verdict ? <VBadge v={verdict} /> : <Badge>OFF</Badge>}
                <span className="mono text-[11px] text-[var(--vs-text2)]">{def.name}</span>
                <span className="ml-auto truncate text-[10px] text-[var(--vs-dim)]" title={def.desc}>{def.desc}</span>
                {def.stub && <Badge tone="stub">stub</Badge>}
              </div>
            );
          })}
        </div>
        <div className="mt-3 border-t border-[var(--vs-border)] pt-3 text-[12px] text-[var(--vs-dim)]">
          Overall verdict: <span className="mono text-[var(--vs-text2)]">{summary.verdict}</span>.
          A receipt is issued in <strong>all three</strong> cases. The number goes up regardless.
          The first failing rule is recorded on the receipt (capability 6 — fail visible).
        </div>
      </Card>

      <Card title="RUN THE LOOP">
        <div className="text-[12px] text-[var(--vs-dim)]">
          Run the current observation through the {enabledCount} enabled rules → produce a receipt → number goes up.
        </div>
        <div className="mt-2">
          <Button variant="primary" onClick={runLoop}>Run the loop</Button>
        </div>
      </Card>

      <div className="vvu-doc">
        <div className="callout warn">
          <strong>What I got wrong before.</strong> I said "13 gates" like 13 mattered.
          It doesn't. The system cares that rules are written down and deterministic —
          not how many there are. Toggle rules off; the loop adapts; the receipt records
          only the rules that ran.
        </div>
      </div>
    </div>
  );
}
