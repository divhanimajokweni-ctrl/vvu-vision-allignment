import { IveShell } from "@/components/ive-site/IveShell";
import { SurfaceCard } from "@/components/ive-site/SurfaceCard";
import type { Provenance } from "@/components/ive-site/ProvenanceTag";

const SURFACES: {
  id: string;
  name: string;
  band: string;
  provenance: Provenance;
  blurb: string;
}[] = [
  {
    id: "01",
    name: "Spatial",
    band: "Operational",
    provenance: "MEASURED",
    blurb: "Geospatial view of assets, valves, sensors and field crews.",
  },
  {
    id: "02",
    name: "Analytics",
    band: "Evidence",
    provenance: "MEASURED",
    blurb: "Deterministic models with provenance tags on every output.",
  },
  {
    id: "03",
    name: "Outreach",
    band: "Commercial",
    provenance: "MEASURED",
    blurb: "POPIA-gated, consent-first, WORM-sealed sends.",
  },
  {
    id: "04",
    name: "Holocom",
    band: "Research",
    provenance: "MEASURED",
    blurb: "Holistic communication envelope for evidence exchange.",
  },
  {
    id: "05",
    name: "Capability",
    band: "Research",
    provenance: "MEASURED",
    blurb: "Capability index of the estate, per surface.",
  },
  {
    id: "06",
    name: "Metro",
    band: "Research",
    provenance: "MEASURED",
    blurb: "Metropolitan-scale rollup of surface telemetry.",
  },
  {
    id: "07",
    name: "Fieldkit",
    band: "Research",
    provenance: "MEASURED",
    blurb: "Field capture track for academic and municipal partners.",
  },
  {
    id: "08",
    name: "Support",
    band: "Operational",
    provenance: "MEASURED",
    blurb: "Operator-facing incident and support surface.",
  },
  {
    id: "09",
    name: "Records",
    band: "Evidence",
    provenance: "MEASURED",
    blurb: "The records surface: direct interface to the WORM ledger.",
  },
  {
    id: "H1",
    name: "Hydraulics",
    band: "Simulated",
    provenance: "SIMULATED",
    blurb: "HBK Mk-II hydraulic simulation. Deterministic, labelled.",
  },
  {
    id: "H2",
    name: "Proximity",
    band: "Simulated",
    provenance: "SIMULATED",
    blurb: "HBK Mk-II proximity model. Deterministic, labelled.",
  },
  {
    id: "H3",
    name: "Wildfire",
    band: "Simulated",
    provenance: "SIMULATED",
    blurb: "HBK Mk-II wildfire model. Deterministic, labelled.",
  },
  {
    id: "H4",
    name: "Twin",
    band: "Simulated",
    provenance: "SPEC",
    blurb: "HBK Mk-II digital twin. Specified, in progress.",
  },
];

export default function SurfacesPage() {
  return (
    <IveShell>
      <header className="py-10">
        <span className="ive-mono text-[10px] uppercase tracking-[0.32em] text-ive-gold/70">
          / 03 · SURFACES
        </span>
        <h1 className="mt-3 font-sans text-3xl font-bold sm:text-4xl">Nine surfaces. One spine.</h1>
        <p className="mt-3 max-w-[640px] text-base text-muted-foreground">
          Every surface shares the same ledger, the same permit kernel, and the same provenance
          grammar. Nothing talks to the network that doesn't have to. Everything that moves a real
          action goes through the kernel first.
        </p>
      </header>
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {SURFACES.map((s) => (
          <SurfaceCard key={s.id} {...s} />
        ))}
      </section>
    </IveShell>
  );
}
