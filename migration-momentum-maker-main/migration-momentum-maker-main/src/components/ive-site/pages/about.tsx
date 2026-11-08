import { IveShell } from "@/components/ive-site/IveShell";

export default function AboutPage() {
  return (
    <IveShell>
      <header className="py-10">
        <span className="ive-mono text-[10px] uppercase tracking-[0.32em] text-ive-gold/70">
          / 06 · ABOUT
        </span>
        <h1 className="mt-3 font-sans text-3xl font-bold sm:text-4xl">The honesty statement.</h1>
      </header>
      <section className="grid gap-6 lg:grid-cols-2">
        <article className="ive-surface rounded-xl border border-white/[0.06] p-6">
          <h2 className="font-sans text-lg font-semibold">Who built it</h2>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            <li>· South Africa</li>
            <li>· CIPC registered</li>
            <li>· B-BBEE Level 1</li>
          </ul>
        </article>
        <article className="ive-surface rounded-xl border border-white/[0.06] p-6">
          <h2 className="font-sans text-lg font-semibold">The honesty rule</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Every number on this site is either measured, simulated and labelled, or spec'd. Nothing
            is fabricated. Where a value is not yet measured, it is marked{" "}
            <span className="ive-mono text-ive-blocked/90">MISSING - REQUIRES DECISION</span>.
          </p>
        </article>
        <article className="ive-surface rounded-xl border border-white/[0.06] p-6 lg:col-span-2">
          <h2 className="font-sans text-lg font-semibold">Compliance posture</h2>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            <li>
              · POPIA: consent-gated outreach, dry-run/live split. Status:{" "}
              <span className="ive-mono text-ive-gold/80">REQUIRES VALIDATION</span>.
            </li>
            <li>· VRES v1.0 conformance: declared Level A minimum, target Level B.</li>
            <li>· SLSA target: Level 3 (Level 4 for HBK Mk-II Tier 1 firmware).</li>
          </ul>
        </article>
      </section>
    </IveShell>
  );
}
