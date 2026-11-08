/**
 * VVU · STUDIO — labs/lab2_credential.py view (Credential Engine · SBT).
 */
import { useStudio } from "@/lib/vvu-studio/store";
import { Card } from "../ui";

export function Lab2View() {
  const minted = useStudio((s) => s.ledger.length);
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="vvu-doc">
        <div className="vk">labs/lab2_credential.py</div>
        <h1>Credential Engine · Soulbound Tokens</h1>
        <p className="lede">
          ERC-5192 / SBT — bound to the soul, not to the wallet.
        </p>
      </div>

      <Card title="CREDENTIAL FLOW">
        <pre className="mono whitespace-pre-wrap text-[12px] leading-[1.7] text-[#c4c4cc]">
{`submission → signed receipt
         → Merkle leaf
         → cohort Merkle root
         → SBT (ERC-5192)
         → Arweave pin
         → employer verifies by recomputing`}
        </pre>
      </Card>

      <Card title="ISSUED">
        <div className="flex items-end justify-between">
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.1em] text-[var(--vs-dim)]">total minted</div>
            <div className="mono text-[40px] font-bold leading-none text-[var(--vs-accent)]">
              {String(minted).padStart(2, "0")}
            </div>
          </div>
          <div className="text-right">
            <div className="mono text-[10px] uppercase tracking-[0.1em] text-[var(--vs-dim)]">transfers</div>
            <div className="mono text-[18px] text-[var(--vs-text2)]">
              0 <span className="text-[10px] text-[var(--vs-dim)]">· impossible by design</span>
            </div>
          </div>
        </div>
        <div className="mt-3 border-t border-[var(--vs-border)] pt-3 text-[12px] text-[var(--vs-dim)]">
          Run the IVE in <code className="rounded bg-[var(--vs-bg3)] px-1 text-[var(--vs-accent)]">pipeline.py</code> to anchor a receipt — every appended entry mints one credential.
        </div>
      </Card>
    </div>
  );
}
