"use client";

/**
 * Borromean Rings — the VVU brand mark.
 * Three interlocking circles: sage, ochre, lime.
 * None can be removed without the other two falling apart.
 *
 * Symbolism: governance (sage), evidence (ochre), execution (lime) —
 * the three pillars of VVU's epistemic architecture.
 * 100% founder-owned.
 */

export function BorromeanRings({ size = 34 }: { size?: number }) {
  const r = size * 0.3;
  const c = size / 2;
  const off = r * 0.62;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label="VVU Borromean rings — sage, ochre, lime"
      role="img"
    >
      <circle
        cx={c - off * 0.87}
        cy={c - off * 0.5}
        r={r}
        fill="none"
        stroke="#8fb35a"
        strokeWidth={size * 0.045}
      />
      <circle
        cx={c + off * 0.87}
        cy={c - off * 0.5}
        r={r}
        fill="none"
        stroke="#f3e38a"
        strokeWidth={size * 0.045}
      />
      <circle
        cx={c}
        cy={c + off}
        r={r}
        fill="none"
        stroke="#c8ff00"
        strokeWidth={size * 0.045}
      />
    </svg>
  );
}
