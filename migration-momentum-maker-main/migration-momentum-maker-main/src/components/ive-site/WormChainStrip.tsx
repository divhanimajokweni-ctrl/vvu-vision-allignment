import { useEffect, useState } from "react";

type ChainState = "VALID" | "TAMPERED" | "CHECKING";

/**
 * WormChainStrip — visual of the WORM chain.
 * DEMO-ONLY: the live tamper check is wired on /proof.
 * This component shows a static valid chain.
 */
export function WormChainStrip({ length = 12 }: { length?: number }) {
  const [state, setState] = useState<ChainState>("CHECKING");
  useEffect(() => {
    const t = setTimeout(() => setState("VALID"), 600);
    return () => clearTimeout(t);
  }, []);
  const color =
    state === "VALID"
      ? "var(--ive-proven)"
      : state === "TAMPERED"
        ? "var(--ive-blocked)"
        : "var(--ive-pending)";
  return (
    <div className="ive-surface flex items-center gap-2 rounded-lg border border-white/[0.06] p-3">
      <span className="ive-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        WORM
      </span>
      <div className="flex flex-1 items-center gap-1">
        {Array.from({ length }).map((_, i) => (
          <span
            key={i}
            className="h-1.5 flex-1 rounded-full"
            style={{
              background: i < length - 1 ? color : `color-mix(in oklab, ${color} 60%, transparent)`,
            }}
          />
        ))}
      </div>
      <span className="ive-mono text-[10px] uppercase tracking-[0.18em]" style={{ color }}>
        CHAIN {state}
      </span>
    </div>
  );
}
