// src/lib/first-principles.ts
// ─────────────────────────────────────────────────────────────────────────────
// FIRST PRINCIPLES — the laws beneath the signals.
//
// Four videos, four disciplines, one substrate. Every mapping is labelled:
//
//   MEASURED  — the estate reads this signal
//   REPORTED  — the video states this law
//   DERIVED   — the coupling is computed here from the law
//   SPEC      — the coupling is proposed, not yet validated on live data
//
// The purpose is not to add data. It is to give the models the rules that
// generate the data, so a reading can be interpreted in terms of the law
// that produced it. Today the consensus lattice composes signals with
// Boolean AND; a first-principles layer lets a failed rule be diagnosed as
// a physical cause rather than reported as a binary fact.
//
// Honest limits (the projection does NOT claim the estate's models will
// improve — it claims the models will have the correct laws AVAILABLE):
//   · chapters covered              REPORTED — the chapter lists are on the pages
//   · estate reads these signals    MEASURED — pH 7.1, turbidity 1.0 NTU,
//                                    pressure 2.90 bar, flow 11.1 L/s,
//                                    storage 74 %, cycle 0.015 ms
//   · couplings are real            DERIVED for pressure-flow (orifice
//                                    equation); SPEC for the rest — proposed
//                                    relationships, not validated on the
//                                    estate's own data
//   · diagnostics will work         NOT EVIDENCED — the couplings must be
//                                    tested against historical frames first
// ─────────────────────────────────────────────────────────────────────────────

// ─── §1 CHEMISTRY — 19 min · atoms → bonds → forces → states → reactions →
//     energy → pH → redox ─────────────────────────────────────────────────────

export interface ChemistryBridge {
  id: string;
  videoChapter: string;
  estateSignal: string;
  liveValue: string | null;
  law: string;
  coupling: string;
  tag: 'MEASURED' | 'REPORTED' | 'DERIVED' | 'SPEC';
}

export const CHEMISTRY_BRIDGES: readonly ChemistryBridge[] = [
  {
    id: 'ph-turbidity',
    videoChapter: 'pH & pOH · Solubility',
    estateSignal: 'pH · Turbidity',
    liveValue: '7.1 pH · 1.0 NTU',
    law: 'Solubility of a solute is a function of pH. A shift in pH changes the saturation point, which changes the concentration of suspended particles, which changes turbidity.',
    coupling:
      'If pH moves but turbidity does not, the dissolved load is buffered. ' +
      'If turbidity moves but pH does not, the source is particulate ingress, not chemical.',
    tag: 'SPEC',
  },
  {
    id: 'pressure-flow',
    videoChapter: 'States of Matter · Van der Waals',
    estateSignal: 'Pressure · Flow',
    liveValue: '2.90 bar · 11.1 L/s',
    law: 'In a fixed geometry, flow is a function of the square root of pressure drop (orifice equation). The exponent is 0.5 for turbulent flow, 1.0 for laminar.',
    coupling:
      'The pressure-to-flow exponent is a diagnostic. An exponent near 0.5 is turbulent — normal. ' +
      'An exponent near 1.0 is laminar — a sign of low velocity or high viscosity.',
    tag: 'DERIVED',
  },
  {
    id: 'cycle-activation',
    videoChapter: 'Activation Energy · Catalysts',
    estateSignal: 'Cycle time',
    liveValue: '0.015 ms',
    law: 'Reaction rate k = A · exp(−Ea / RT). Cycle time is 1/k for a fixed work quantum.',
    coupling:
      'A cycle-time drift at constant temperature is a change in activation energy — a catalyst degrading, ' +
      'or an inhibitor accumulating. The video names this directly.',
    tag: 'SPEC',
  },
  {
    id: 'redox-storage',
    videoChapter: 'Redox · Oxidation Numbers · Gibbs',
    estateSignal: 'Storage level',
    liveValue: '74 %',
    law: 'A battery is a redox cell. Its voltage is −ΔG / nF. Capacity fade is electrode degradation, which is an oxidation-state change.',
    coupling:
      'Storage level alone is not a health signal. The rate of change per cycle is. ' +
      'A redox model converts the discharge curve into an electrode-health estimate.',
    tag: 'SPEC',
  },
];

// ─── §2 PHYSICS — 14 min · measurement → motion → forces → energy → waves →
//     fields ──────────────────────────────────────────────────────────────────

export interface PhysicsBridge {
  id: string;
  videoChapter: string;
  estateSignal: string;
  law: string;
  coupling: string;
  tag: 'MEASURED' | 'REPORTED' | 'DERIVED' | 'SPEC';
}

export const PHYSICS_BRIDGES: readonly PhysicsBridge[] = [
  {
    id: 'measurement-units',
    videoChapter: 'Measurement · Units · The Metre',
    estateSignal: 'All signals',
    law: 'Every measurement is a ratio to a standard. The standard defines the unit; the unit defines the comparison.',
    coupling:
      "The estate's readings are only comparable because they share units. A model that tracks units " +
      'catches a sensor reporting in the wrong scale before the number is trusted.',
    tag: 'REPORTED',
  },
  {
    id: 'change-direction',
    videoChapter: 'Arithmetic as four ways an amount can change',
    estateSignal: 'Trends',
    law: 'Every quantity can increase, decrease, stay constant, or oscillate. The derivative names which.',
    coupling:
      'The consensus engine reads instantaneous values. A physics layer reads the derivative. ' +
      'A pressure that is 2.90 bar but falling at 0.1 bar/s is a different state from 2.90 bar steady.',
    tag: 'SPEC',
  },
];

// ─── §3 BIOLOGY — 17 min · cells → metabolism → DNA → inheritance → evolution
//     → systems ───────────────────────────────────────────────────────────────

export interface BiologyBridge {
  id: string;
  videoChapter: string;
  estateSignal: string;
  law: string;
  coupling: string;
  tag: 'MEASURED' | 'REPORTED' | 'DERIVED' | 'SPEC';
}

export const BIOLOGY_BRIDGES: readonly BiologyBridge[] = [
  {
    id: 'homeostasis',
    videoChapter: 'Homeostasis',
    estateSignal: 'All signals',
    law: 'A living system holds its variables within a band by negative feedback. Deviation triggers correction.',
    coupling:
      "The estate's rules already assert bands. A homeostasis model adds the correction term: " +
      'when a signal leaves its band, what force is pushing it back, and how fast?',
    tag: 'REPORTED',
  },
  {
    id: 'evolution-selection',
    videoChapter: 'Natural Selection · Genetic Drift',
    estateSignal: 'Model weights',
    law: 'Variation + selection + inheritance = adaptation. Drift is the same process without selection.',
    coupling:
      "The estate's on-device personalization is a selection process. " +
      'The biology video names the failure mode: drift without selection produces random change, not improvement.',
    tag: 'SPEC',
  },
];

// ─── §4 MATHS — 15 min · number → change → measurement → geometry → the
//     unreachable ─────────────────────────────────────────────────────────────

export interface MathsBridge {
  id: string;
  videoChapter: string;
  estateSignal: string;
  law: string;
  coupling: string;
  tag: 'MEASURED' | 'REPORTED' | 'DERIVED' | 'SPEC';
}

export const MATHS_BRIDGES: readonly MathsBridge[] = [
  {
    id: 'measuring-unreachable',
    videoChapter: 'Measuring the Unreachable · Eratosthenes',
    estateSignal: 'Inference',
    law: 'A quantity that cannot be measured directly can be derived from a measurable proxy and a known relationship.',
    coupling:
      'The estate cannot measure the interior of the pipe. It measures pressure, flow, and acoustic. ' +
      'A maths layer derives the unmeasured quantity from the measured ones.',
    tag: 'REPORTED',
  },
  {
    id: 'geometry-physics',
    videoChapter: 'Every Kind of Geometry · Trigonometry',
    estateSignal: 'Spatial layout',
    law: 'The geometry of a system constrains the physics. A pipe bend is not a straight pipe.',
    coupling:
      "The estate's spatial view renders geometry. A geometry-aware model knows that pressure drop " +
      'across a bend is not the same as across a straight run, even at the same flow.',
    tag: 'SPEC',
  },
];

// ─── THE COUPLING MATRIX — the disciplines are not separate either ─────────

export type Discipline = 'chemistry' | 'physics' | 'biology' | 'maths';

export interface Coupling {
  from: Discipline;
  to: Discipline;
  via: string;
  example: string;
}

export const COUPLINGS: readonly Coupling[] = [
  { from: 'chemistry', to: 'physics', via: 'Thermodynamics',
    example: 'Gibbs free energy is both a chemical potential and a physical work term.' },
  { from: 'physics', to: 'maths', via: 'Measurement',
    example: 'The metre is a physical standard; the number is a mathematical one.' },
  { from: 'maths', to: 'biology', via: 'Feedback',
    example: 'Homeostasis is a negative feedback loop, which is a differential equation.' },
  { from: 'biology', to: 'chemistry', via: 'Metabolism',
    example: 'Cellular respiration is a redox reaction chain.' },
];

// ─── Projection metadata (the #/firstprinciples surface) ───────────────────

export interface FirstPrinciplesSection {
  key: Discipline;
  label: string;
  duration: string;
  path: string;
  bridges: ReadonlyArray<{ id: string; videoChapter: string; estateSignal: string; liveValue?: string | null; law: string; coupling: string; tag: ChemistryBridge['tag'] }>;
}

export const FIRST_PRINCIPLES_SECTIONS: readonly FirstPrinciplesSection[] = [
  { key: 'chemistry', label: 'CHEMISTRY', duration: '19 min', path: 'atoms → bonds → forces → states → reactions → energy → pH → redox', bridges: CHEMISTRY_BRIDGES },
  { key: 'physics', label: 'PHYSICS', duration: '14 min', path: 'measurement → motion → forces → energy → waves → fields', bridges: PHYSICS_BRIDGES },
  { key: 'biology', label: 'BIOLOGY', duration: '17 min', path: 'cells → metabolism → DNA → inheritance → evolution → systems', bridges: BIOLOGY_BRIDGES },
  { key: 'maths', label: 'MATHS', duration: '15 min', path: 'number → change → measurement → geometry → the unreachable', bridges: MATHS_BRIDGES },
];

/** §5 · Honest limits — the claim/status table, rendered as-is. */
export const FIRST_PRINCIPLES_CLAIMS: ReadonlyArray<{ claim: string; status: string; note: string }> = [
  {
    claim: 'The video covers these chapters',
    status: 'REPORTED',
    note: 'The chapter list is on the page.',
  },
  {
    claim: 'The estate reads these signals',
    status: 'MEASURED',
    note: 'pH 7.1, turbidity 1.0 NTU, pressure 2.90 bar, flow 11.1 L/s, storage 74 %, cycle 0.015 ms are on the screenshot.',
  },
  {
    claim: 'The couplings are real',
    status: 'DERIVED (pressure-flow) · SPEC (rest)',
    note: 'They are proposed relationships, not validated on the estate\u2019s own data.',
  },
  {
    claim: 'The diagnostics will work',
    status: 'NOT EVIDENCED',
    note: 'The couplings need to be tested against historical frames before they can be trusted.',
  },
];

/** The one-sentence summary (§5 close). */
export const FIRST_PRINCIPLES_ONE_SENTENCE =
  'The four videos are the substrate beneath the estate\u2019s signals — chemistry for the fluid, physics for the measurement, biology for the feedback, maths for the inference — and mapping them into a #/firstprinciples projection gives the models the laws that generate the readings, so a failed rule can be diagnosed as a physical cause rather than reported as a binary fact.';
