import { Link } from "@tanstack/react-router";
import { TrustSphere } from "./TrustSphere";

export function IveShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-10 mx-auto flex w-full max-w-[1180px] flex-1 flex-col px-6">
      <header className="flex items-center justify-between py-6">
        <Link to="/ive" className="flex items-center gap-3">
          <TrustSphere size={44} />
          <div className="flex flex-col">
            <span className="ive-mono text-[10px] uppercase tracking-[0.32em] text-ive-gold/70">
              / VVU IVE
            </span>
            <span className="font-sans text-sm font-semibold">
              Integrated Verification Environment
            </span>
          </div>
        </Link>
        <nav className="ive-mono hidden gap-6 text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:flex">
          <Link to="/ive/proof" className="hover:text-foreground">
            Proof
          </Link>
          <Link to="/ive/surfaces" className="hover:text-foreground">
            Surfaces
          </Link>
          <Link to="/ive/who" className="hover:text-foreground">
            Who
          </Link>
          <Link to="/ive/pricing" className="hover:text-foreground">
            Pricing
          </Link>
          <Link to="/ive/about" className="hover:text-foreground">
            About
          </Link>
          <Link to="/ive/contact" className="text-ive-gold/80 hover:text-ive-gold">
            Start a pilot
          </Link>
        </nav>
      </header>
      <main className="flex-1 pb-16">{children}</main>
      <footer className="ive-mono border-t border-white/[0.06] py-6 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
        VVU · venturevisionubuntu.co.za · VRES v1.0 · ZAR
      </footer>
    </div>
  );
}
