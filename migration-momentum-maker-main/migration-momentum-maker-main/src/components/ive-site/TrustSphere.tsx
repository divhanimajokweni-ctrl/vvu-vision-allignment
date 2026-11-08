import { useEffect, useRef } from "react";

/**
 * TrustSphere — the three-ring emblem from the IVE snapshot.
 * Rings animate in on mount; the center pulse is ive-live-pulse.
 * Contract: a decorative mark, not data-bearing. No provenance needed.
 */
export function TrustSphere({ size = 120 }: { size?: number }) {
  const ref = useRef<SVGSVGElement | null>(null);
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const rings = svg.querySelectorAll("circle[data-ring]");
    rings.forEach((c, i) => {
      const el = c as SVGCircleElement;
      el.style.transition = "opacity .5s ease-out, transform .5s ease-out";
      setTimeout(() => {
        el.style.opacity = "1";
        el.style.transform = "scale(1)";
      }, 120 * i);
    });
  }, []);
  return (
    <svg ref={ref} width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <circle
        data-ring
        cx="36"
        cy="40"
        r="15"
        stroke="#8A9A5B"
        strokeWidth="3.5"
        style={{ transformOrigin: "50% 50%", transform: "scale(.4)", opacity: 0 }}
      />
      <circle
        data-ring
        cx="64"
        cy="40"
        r="15"
        stroke="#CC7722"
        strokeWidth="3.5"
        style={{ transformOrigin: "50% 50%", transform: "scale(.4)", opacity: 0 }}
      />
      <circle
        data-ring
        cx="50"
        cy="64"
        r="15"
        stroke="#E2E3DB"
        strokeWidth="3.5"
        style={{ transformOrigin: "50% 50%", transform: "scale(.4)", opacity: 0 }}
      />
      <circle cx="50" cy="48" r="3" fill="#C9A84C" className="ive-live-pulse" />
    </svg>
  );
}
