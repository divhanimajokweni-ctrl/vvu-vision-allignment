// VVU Studio lib — labs module
// Lab 0 (number plane) + depot gate eval. The studio is a browser-only
// workspace; this module holds the lab constants + pure evaluation
// functions the views call into.

/** Lab 0 target: drag the white point to (3, 4). Numbers are places. */
export const LAB0_TARGET = { x: 3, y: 4 } as const;

/** Returns true when the point is at the target address (3, 4). Tolerates
 *  floating-point wobble at 0.05 — the snap-to-half grid can land on 2.95
 *  or 3.05; the doctrine is "the address is the place". */
export function lab0AtTarget(x: number, y: number): boolean {
  return Math.abs(x - LAB0_TARGET.x) < 0.05 && Math.abs(y - LAB0_TARGET.y) < 0.05;
}

/** Depot gate defaults — the values the form starts with. `date()` is a
 *  function so a fresh value is computed on every render (today's date). */
export const DEPOT_DEFAULTS = {
  date: () => new Date().toISOString().slice(0, 10),
  depot: "Brixton DMA Chamber 14km",
  role: "field tech",
  owner: "NMBM",
  cost: 22000,
  tier: "T1" as "T1" | "T2" | "T3" | "T4",
  q2: true,
  q3: true,
};

/** Evaluate the depot gate. The gate opens IFF:
 *   - Q1: cost > R20,000 (real economic stake)
 *   - tier ∈ {T1, T2}            (computed or documented, not claimed/hearsay)
 *   - Q2: structural — visible inefficiency from untrusted telemetry
 *   - Q3: capability — read-only tap without breaking the write-path
 *  All four must pass. The studio's doctrine: a gate that fails to open
 *  is "walk away", not "try harder". */
export function evalDepot(input: {
  cost: number;
  tier: "T1" | "T2" | "T3" | "T4";
  q2: boolean;
  q3: boolean;
}): {
  pass: boolean;
  finOk: boolean;
  tierOk: boolean;
  q2: boolean;
  q3: boolean;
} {
  const finOk = input.cost > 20000;
  const tierOk = input.tier === "T1" || input.tier === "T2";
  const pass = finOk && tierOk && input.q2 && input.q3;
  return {
    pass,
    finOk,
    tierOk,
    q2: input.q2,
    q3: input.q3,
  };
}
