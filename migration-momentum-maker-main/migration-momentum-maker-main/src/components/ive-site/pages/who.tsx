import { IveShell } from "@/components/ive-site/IveShell";

const AUDIENCES = [
  {
    title: "Water / Utilities",
    problem: "Dashboards cannot be audited when a regulator asks.",
    answer: "Every reading, every valve decision, sealed and verifiable.",
    range: "R15k → R50k → R5k/mo",
  },
  {
    title: "Mining",
    problem: "Wildfire, proximity, asset decisions leave no proof trail.",
    answer: "Deterministic models, provenance-tagged, WORM-sealed.",
    range: "R50k → R2M",
  },
  {
    title: "Financial (fraud / assurance)",
    problem: "Adverse-action review cannot prove the decision chain.",
    answer: "Verifiable decision chains, Ed25519-signed receipts.",
    range: "R50k → R2M",
  },
  {
    title: "Research / Universities",
    problem: "Reproducibility is asserted, not demonstrated.",
    answer: "Reproducibility package, evidence bundle, WORM-sealed.",
    range: "Sponsored",
  },
];

export default function WhoPage() {
  return (
    <IveShell>
      <header className="py-10">
        <span className="ive-mono text-[10px] uppercase tracking-[0.32em] text-ive-gold/70">
          / 04 · WHO
        </span>
        <h1 className="mt-3 font-sans text-3xl font-bold sm:text-4xl">
          Built for the operators who have to prove it.
        </h1>
        <p className="mt-3 max-w-[640px] text-base text-muted-foreground">
          We don't sell to everyone. We sell to the operator who has already been asked "prove it"
          and didn't have an answer.
        </p>
      </header>
      <section className="grid gap-4 md:grid-cols-2">
        {AUDIENCES.map((a) => (
          <article
            key={a.title}
            className="ive-surface flex flex-col gap-2 rounded-xl border border-white/[0.06] p-6"
          >
            <h2 className="font-sans text-lg font-semibold">{a.title}</h2>
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Problem:</strong> {a.problem}
            </p>
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">VVU:</strong> {a.answer}
            </p>
            <div className="ive-mono mt-2 text-[10px] uppercase tracking-[0.18em] text-ive-gold/70">
              Pilot range: {a.range}
            </div>
          </article>
        ))}
      </section>
    </IveShell>
  );
}
