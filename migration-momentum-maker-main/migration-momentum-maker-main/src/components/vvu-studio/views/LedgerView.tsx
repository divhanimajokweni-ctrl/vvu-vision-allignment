/**
 * VVU · STUDIO — receipts/ledger.json (WORM chain + verification).
 */
"use client";
import { useStudio } from "@/lib/vvu-studio/store";
import { short } from "@/lib/vvu-studio/crypto";
import { Card, Badge, Button, Term, GateBadge } from "../ui";
import { ShieldIcon, TrashIcon } from "../Icons";

export function LedgerView() {
  const ledger = useStudio((s) => s.ledger);
  const verify = useStudio((s) => s.chainVerify);
  const verifyChain = useStudio((s) => s.verifyChain);
  const clearLedger = useStudio((s) => s.clearLedger);
  const last = ledger[ledger.length - 1];

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="vvu-doc">
        <div className="vk">receipts/ledger.json</div>
        <h1>WORM Ledger</h1>
        <p className="lede">Write-once, read-many. Each entry chains to the previous by SHA-256.</p>
      </div>

      <Card
        title={`CHAIN · ${ledger.length}`}
        right={
          <div className="flex gap-1.5">
            <Button variant="primary" onClick={verifyChain}><ShieldIcon size={13} /> Verify</Button>
            <Button variant="danger" onClick={clearLedger}><TrashIcon size={13} /> Reset</Button>
          </div>
        }
      >
        {verify && <div className="mb-3"><Term lines={verify.lines} /></div>}

        {ledger.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <ShieldIcon size={32} className="text-[var(--vs-dimmer)]" />
            <div className="mono text-[11px] tracking-[0.18em] text-[var(--vs-dimmer)]">LEDGER EMPTY</div>
            <div className="text-[12px] text-[var(--vs-dim)]">Run the IVE pipeline to anchor the first receipt.</div>
          </div>
        ) : (
          <div className="space-y-1">
            {[...ledger].reverse().map((e) => (
              <div key={e.seq} className="flex items-center gap-2 rounded px-2 py-1 text-[11px] hover:bg-[var(--vs-bg3)]">
                <span className="mono w-8 text-[var(--vs-dim)]">#{e.seq}</span>
                <span className="mono text-[var(--vs-accent)]">{short(e.contentHash, 20)}</span>
                <span className="mono hidden text-[var(--vs-text2)] sm:inline">{short(e.receiptHash, 20)}</span>
                <span className="mono ml-auto text-[10px] text-[var(--vs-dimmer)]">{e.ts.slice(11, 19)}Z</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {last && (
        <Card title="LAST ENTRY">
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div><span className="mono text-[10px] uppercase text-[var(--vs-dim)]">seq</span><div className="mono text-[var(--vs-text)]">{last.seq}</div></div>
            <div><span className="mono text-[10px] uppercase text-[var(--vs-dim)]">utc_ts</span><div className="mono text-[var(--vs-text)]">{last.ts}</div></div>
            <div className="col-span-2"><span className="mono text-[10px] uppercase text-[var(--vs-dim)]">content</span><div className="mono break-all text-[var(--vs-accent)]">{last.contentHash}</div></div>
            <div className="col-span-2"><span className="mono text-[10px] uppercase text-[var(--vs-dim)]">receipt</span><div className="mono break-all text-[var(--vs-accent)]">{last.receiptHash}</div></div>
            <div className="col-span-2">
              <span className="mono text-[10px] uppercase text-[var(--vs-dim)]">signature</span>
              <div className="mono break-all text-[var(--vs-amber)]">{last.sig} <Badge tone="stub">stubbed</Badge></div>
            </div>
            <div className="col-span-2"><span className="mono text-[10px] uppercase text-[var(--vs-dim)]">gates</span><div className="mono text-[var(--vs-text2)]">{last.gatesPass}/{last.gatesTotal} · {last.gatesStub} stubbed</div></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            {last.gates.map((g) => (
              <span key={g.id} className="flex items-center gap-1">
                <GateBadge status={g.status} />
                <span className="mono text-[9px] text-[var(--vs-dim)]">{g.id}</span>
              </span>
            ))}
          </div>
        </Card>
      )}

      <div className="vvu-doc">
        <div className="callout">
          <strong>Verification, not declaration.</strong> The chain re-computes every
          receipt hash from the genesis <code className="mx-1">0×64</code> prev. Any tamper
          breaks it loudly.
        </div>
      </div>
    </div>
  );
}
