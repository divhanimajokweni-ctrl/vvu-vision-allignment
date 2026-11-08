import { ProvenanceTag, type Provenance } from "./ProvenanceTag";

export function SurfaceCard({
  id,
  name,
  band,
  provenance,
  blurb,
}: {
  id: string;
  name: string;
  band: string;
  provenance: Provenance;
  blurb: string;
}) {
  return (
    <article className="ive-surface flex flex-col gap-3 rounded-xl border border-white/[0.06] p-5">
      <header className="flex items-start justify-between">
        <div>
          <span className="ive-mono text-[9px] uppercase tracking-[0.24em] text-ive-gold/70">
            {id} · {band}
          </span>
          <h3 className="mt-1 font-sans text-base font-semibold">{name}</h3>
        </div>
        <ProvenanceTag value={provenance} />
      </header>
      <p className="text-sm text-muted-foreground">{blurb}</p>
    </article>
  );
}
