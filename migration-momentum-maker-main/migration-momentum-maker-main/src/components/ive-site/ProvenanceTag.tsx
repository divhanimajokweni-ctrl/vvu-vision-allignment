import clsx from "clsx";

export type Provenance =
  "MEASURED" | "SIMULATED" | "SPEC" | "REPORTED" | "MISSING - REQUIRES DECISION";

const COLORS: Record<Provenance, string> = {
  MEASURED: "border-ive-proven/30 text-ive-proven",
  SIMULATED: "border-ive-pending/30 text-ive-pending",
  SPEC: "border-ive-gold/30 text-ive-gold",
  REPORTED: "border-white/10 text-white/70",
  "MISSING - REQUIRES DECISION": "border-ive-blocked/30 text-ive-blocked",
};

export function ProvenanceTag({ value, className }: { value: Provenance; className?: string }) {
  return (
    <span
      className={clsx(
        "ive-mono inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em]",
        COLORS[value],
        className,
      )}
      aria-label={`Provenance: ${value}`}
    >
      {value}
    </span>
  );
}
