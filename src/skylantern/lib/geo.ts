/**
 * Skylantern — geographic helpers for the digital twin.
 */

/** Haversine distance in metres between two [lng, lat] points. */
export function haversineMeters(
  a: [number, number],
  b: [number, number]
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Snap a [lng, lat] to a small jitter for the digital twin — keeps nearby
 *  lanterns from stacking on top of each other visually. */
export function jitter(
  lng: number,
  lat: number,
  salt: number,
  radius = 0.0009
): [number, number] {
  // Deterministic pseudo-random based on salt.
  const r1 = Math.sin(salt * 12.9898) * 43758.5453;
  const r2 = Math.sin(salt * 78.233) * 43758.5453;
  const dx = (r1 - Math.floor(r1) - 0.5) * 2 * radius;
  const dy = (r2 - Math.floor(r2) - 0.5) * 2 * radius;
  return [lng + dx, lat + dy];
}

/** Bounding box of a list of [lng, lat] points. */
export function bbox(points: [number, number][]): {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
} | null {
  if (points.length === 0) return null;
  let minLng = points[0][0];
  let maxLng = points[0][0];
  let minLat = points[0][1];
  let maxLat = points[0][1];
  for (const [lng, lat] of points) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  return { minLng, maxLng, minLat, maxLat };
}
