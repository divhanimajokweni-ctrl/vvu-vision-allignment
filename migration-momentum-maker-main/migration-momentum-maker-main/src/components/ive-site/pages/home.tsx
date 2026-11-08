import { Link } from "@tanstack/react-router";
import { IveShell } from "@/components/ive-site/IveShell";
import { TrustSphere } from "@/components/ive-site/TrustSphere";
import { WormChainStrip } from "@/components/ive-site/WormChainStrip";

export default function Page() {
  return (
    <IveShell>
      <section className="flex flex-col items-center gap-6 pt-[12vh] text-center">
        <TrustSphere size={120} />
        <div className="ive-mono text-[10px] uppercase tracking-[0.4em] text-ive-gold/70">
          VVU · IVE
        </div>
        <h1 className="font-sans text-4xl font-bold tracking-tight sm:text-5xl">
          Make every operational decision provable.
        </h1>
        <p className="max-w-[560px] text-base text-muted-foreground">
          One workspace. Nine operator surfaces. One SHA-256 WORM ledger. One server-side permit
          kernel. No cloud dependency. No fabricated metrics.
        </p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/ive/proof"
            className="ive-mono rounded-md border border-ive-gold/40 bg-ive-gold/10 px-5 py-2 text-[11px] uppercase tracking-[0.18em] text-ive-gold hover:bg-ive-gold/20"
          >
            See the proof →
          </Link>
          <Link
            to="/ive/contact"
            className="ive-mono rounded-md border border-white/10 bg-white/[0.03] px-5 py-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
          >
            Book a pilot
          </Link>
        </div>
        <div className="mt-10 w-full max-w-[560px]">
          <WormChainStrip />
        </div>
      </section>
    </IveShell>
  );
}
