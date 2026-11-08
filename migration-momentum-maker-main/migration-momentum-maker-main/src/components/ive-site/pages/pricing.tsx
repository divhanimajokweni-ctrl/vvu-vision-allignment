import { Link } from "@tanstack/react-router";
import { IveShell } from "@/components/ive-site/IveShell";

const TIERS = [
  { name: "Discovery", price: "R15,000", scope: "1 week, credited against pilot." },
  {
    name: "Pilot",
    price: "R50,000 fixed",
    scope: "6 weeks. 50% kickoff, 50% on acceptance of evidence report.",
  },
  {
    name: "Monitoring",
    price: "R5,000/mo",
    scope: "10 addresses. +R350/address, +R250/on-demand check.",
  },
];

export default function PricingPage() {
  return (
    <IveShell>
      <header className="py-10">
        <span className="ive-mono text-[10px] uppercase tracking-[0.32em] text-ive-gold/70">
          / 05 · PRICING
        </span>
        <h1 className="mt-3 font-sans text-3xl font-bold sm:text-4xl">
          Start small. Prove it. Then scale.
        </h1>
        <p className="mt-3 max-w-[640px] text-base text-muted-foreground">
          One pilot (R50,000) offsets a campaign. The story is pilot-acquisition, not scale. All
          pilots are evidence-first.
        </p>
      </header>
      <section className="grid gap-4 md:grid-cols-3">
        {TIERS.map((t) => (
          <article
            key={t.name}
            className="ive-surface flex flex-col gap-3 rounded-xl border border-white/[0.06] p-6"
          >
            <span className="ive-mono text-[10px] uppercase tracking-[0.18em] text-ive-gold/70">
              {t.name}
            </span>
            <div className="font-sans text-2xl font-bold">{t.price}</div>
            <p className="text-sm text-muted-foreground">{t.scope}</p>
          </article>
        ))}
      </section>
      <section className="mt-8 ive-surface rounded-xl border border-white/[0.06] p-6">
        <h2 className="font-sans text-lg font-semibold">Pilot success criteria</h2>
        <ul className="ive-mono mt-3 space-y-1 text-[12px] text-muted-foreground">
          <li>· pass ≥ 90%</li>
          <li>· recall ≥ 95%</li>
          <li>· 100% receipt-backed alerts</li>
        </ul>
        <p className="mt-4 text-sm text-muted-foreground">
          All pilots are evidence-first: you get the report, the hashes, and the valid/invalid test
          log.
        </p>
        <Link
          to="/ive/contact"
          className="ive-mono mt-5 inline-flex rounded-md border border-ive-gold/40 bg-ive-gold/10 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-ive-gold hover:bg-ive-gold/20"
        >
          Start a pilot →
        </Link>
      </section>
      <p className="mt-6 text-sm text-muted-foreground">
        Larger tracks: enterprise verification, water feasibility, bank fraud, field kit, academic.
        Range R5,000 → R2,000,000 depending on scope.
      </p>
    </IveShell>
  );
}
