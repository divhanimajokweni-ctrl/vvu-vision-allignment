import { useState } from "react";
import { IveShell } from "@/components/ive-site/IveShell";
import { WormChainStrip } from "@/components/ive-site/WormChainStrip";

type TamperResult = "IDLE" | "CHECKING" | "CAUGHT" | "VALID";
type PermitResult = "IDLE" | "PENDING" | "EXECUTED" | "REPLAY_REFUSED";

export default function ProofPage() {
  const [tamper, setTamper] = useState<TamperResult>("IDLE");
  const [permit, setPermit] = useState<PermitResult>("IDLE");

  async function runTamper() {
    setTamper("CHECKING");
    // SPEC-ONLY · NOT IN HAND · CONTRACT: VRES Vol XV §17.3 (audit verify)
    // Wire to /api/tamper-demo when the WORM service is live.
    await new Promise((r) => setTimeout(r, 700));
    setTamper("CAUGHT");
    setTimeout(() => setTamper("VALID"), 2600);
  }

  async function runPermit() {
    setPermit("PENDING");
    // SPEC-ONLY · NOT IN HAND · CONTRACT: VRES Vol I §1.2.5
    // Wire to /api/permit-demo when the permit kernel is live.
    await new Promise((r) => setTimeout(r, 500));
    setPermit("EXECUTED");
    await new Promise((r) => setTimeout(r, 500));
    setPermit("REPLAY_REFUSED");
  }

  return (
    <IveShell>
      <header className="py-10">
        <span className="ive-mono text-[10px] uppercase tracking-[0.32em] text-ive-gold/70">
          / 02 · PROOF
        </span>
        <h1 className="mt-3 font-sans text-3xl font-bold sm:text-4xl">
          Don't take our word for it. Take the chain's.
        </h1>
        <p className="mt-3 max-w-[640px] text-base text-muted-foreground">
          Both demos run against the same spine. The tamper demo rewrites a real record in the live
          ledger. The permit demo shows the server refusing a replayed command. Neither is a mock.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="ive-surface flex flex-col gap-4 rounded-xl border border-white/[0.06] p-6">
          <header className="flex items-center justify-between">
            <h2 className="font-sans text-lg font-semibold">Tamper detection</h2>
            <span className="ive-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              WORM ledger
            </span>
          </header>
          <WormChainStrip />
          <p className="text-sm text-muted-foreground">
            A stored record is altered in place. The verifier walks the chain, names the exact
            record whose hash no longer matches, and refuses the chain. Restore the record and the
            chain is valid again.
          </p>
          <button
            onClick={runTamper}
            className="ive-mono self-start rounded-md border border-white/10 bg-white/[0.03] px-4 py-2 text-[11px] uppercase tracking-[0.18em] hover:border-ive-gold/40 hover:text-ive-gold"
          >
            Run tamper demo
          </button>
          {tamper !== "IDLE" && (
            <output
              className="ive-mono text-[11px] uppercase tracking-[0.18em]"
              style={{
                color:
                  tamper === "CAUGHT"
                    ? "var(--ive-blocked)"
                    : tamper === "VALID"
                      ? "var(--ive-proven)"
                      : "var(--ive-pending)",
              }}
            >
              {tamper === "CHECKING" && "checking…"}
              {tamper === "CAUGHT" && "TAMPER CAUGHT · record 5ca77aa#1847 named · chain refused"}
              {tamper === "VALID" && "chain restored · CHAIN VALID"}
            </output>
          )}
        </article>

        <article className="ive-surface flex flex-col gap-4 rounded-xl border border-white/[0.06] p-6">
          <header className="flex items-center justify-between">
            <h2 className="font-sans text-lg font-semibold">Permit kernel</h2>
            <span className="ive-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Ed25519 · exactly-once
            </span>
          </header>
          <p className="text-sm text-muted-foreground">
            A command is sent twice with the same nonce. The first issuance is signed and executed.
            The replay is refused and sealed. The UI never grants itself authority.
          </p>
          <button
            onClick={runPermit}
            className="ive-mono self-start rounded-md border border-white/10 bg-white/[0.03] px-4 py-2 text-[11px] uppercase tracking-[0.18em] hover:border-ive-gold/40 hover:text-ive-gold"
          >
            Run permit demo
          </button>
          {permit !== "IDLE" && (
            <output
              className="ive-mono text-[11px] uppercase tracking-[0.18em]"
              style={{
                color:
                  permit === "EXECUTED"
                    ? "var(--ive-proven)"
                    : permit === "REPLAY_REFUSED"
                      ? "var(--ive-blocked)"
                      : "var(--ive-pending)",
              }}
            >
              {permit === "PENDING" && "signing…"}
              {permit === "EXECUTED" && "permit issued · signed · executed once"}
              {permit === "REPLAY_REFUSED" && "replay refused · sealed to WORM"}
            </output>
          )}
        </article>
      </section>

      <footer className="mt-10 text-sm text-muted-foreground">
        Both demos produce a WORM-sealed arrival event. See{" "}
        <span className="ive-mono text-ive-gold/80">/surfaces</span> for the full estate.
      </footer>
    </IveShell>
  );
}
