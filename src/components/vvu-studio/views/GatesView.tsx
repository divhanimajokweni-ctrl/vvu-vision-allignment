/**
 * VVU · STUDIO — .vvu/gates.py view (Gate Monitor · L1–L13).
 */
import { COMPUTED_GATES, STUBBED_GATES } from "@/lib/vvu-studio/gates";
import { Card, Badge } from "../ui";

export function GatesView() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="vvu-doc">
        <div className="vk">.vvu/gates.py</div>
        <h1>Gate Monitor · L1–L13</h1>
        <p className="lede">
          Eleven gates are computed by a known logic path. Two are honestly stubbed
          and flagged — the system flags its own stubs.
        </p>
      </div>

      <Card title={`COMPUTED · ${COMPUTED_GATES.length}`}>
        <div className="space-y-1.5">
          {COMPUTED_GATES.map((g) => (
            <div
              key={g.id}
              className="flex items-center gap-2 rounded border border-[#065f46]/40 bg-[var(--vs-accentbg)]/30 px-2.5 py-1.5"
            >
              <Badge tone="pass">PASS</Badge>
              <span className="mono text-[11px] text-[var(--vs-text)]">{g.id}</span>
              <span className="mono text-[11px] text-[var(--vs-text2)]">{g.name}</span>
              <span className="mono ml-auto text-[10px] text-[var(--vs-dim)]">w={g.w} · computed</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title={`STUBBED · ${STUBBED_GATES.length}`}>
        <div className="space-y-1.5">
          {STUBBED_GATES.map((g) => (
            <div
              key={g.id}
              className="flex items-center gap-2 rounded border border-[#78350f]/50 bg-[var(--vs-amberbg)]/40 px-2.5 py-1.5"
            >
              <Badge tone="stub">STUB</Badge>
              <span className="mono text-[11px] text-[var(--vs-text)]">{g.id}</span>
              <span className="mono text-[11px] text-[var(--vs-text2)]">{g.name}</span>
              <span className="mono ml-auto text-[10px] text-[var(--vs-dim)]">w={g.w} · CANNOT_COMPUTE</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="vvu-doc">
        <div className="callout warn">
          <strong>Stubbed Gates Flagged.</strong> A gate that looks computed but isn't is worse
          than an honestly stubbed one — because you would act on it.
        </div>
      </div>
    </div>
  );
}
