// Spatial intelligence — real geographic coordinates for shard regions.
// This is the geospatial backbone: every region has a lat/lng centroid,
// a bounding box, and a polygon for map rendering.

export interface RegionGeo {
  id: string;
  label: string;
  lat: number;
  lng: number;
  bbox: { north: number; south: number; east: number; west: number };
  // Simplified polygon (lat/lng pairs) for map rendering
  polygon: [number, number][];
  timezone: string;
}

// 12 real geographic regions covering global operations
export const REGIONS_GEO: Record<string, RegionGeo> = {
  "europe-west": {
    id: "europe-west",
    label: "Western Europe",
    lat: 50.11,
    lng: 8.68,
    bbox: { north: 54.0, south: 45.0, east: 12.0, west: 5.0 },
    polygon: [[45, 5], [45, 12], [54, 12], [54, 5]],
    timezone: "CET",
  },
  "europe-north": {
    id: "europe-north",
    label: "Northern Europe",
    lat: 59.33,
    lng: 18.07,
    bbox: { north: 71.0, south: 55.0, east: 30.0, west: 5.0 },
    polygon: [[55, 5], [55, 30], [71, 30], [71, 5]],
    timezone: "CET",
  },
  "na-east": {
    id: "na-east",
    label: "North America East",
    lat: 40.71,
    lng: -74.01,
    bbox: { north: 49.0, south: 25.0, east: -67.0, west: -87.0 },
    polygon: [[25, -87], [25, -67], [49, -67], [49, -87]],
    timezone: "EST",
  },
  "na-west": {
    id: "na-west",
    label: "North America West",
    lat: 37.77,
    lng: -122.42,
    bbox: { north: 49.0, south: 32.0, east: -114.0, west: -125.0 },
    polygon: [[32, -125], [32, -114], [49, -114], [49, -125]],
    timezone: "PST",
  },
  "apac-south": {
    id: "apac-south",
    label: "APAC South",
    lat: 1.35,
    lng: 103.82,
    bbox: { north: 8.0, south: -10.0, east: 115.0, west: 95.0 },
    polygon: [[-10, 95], [-10, 115], [8, 115], [8, 95]],
    timezone: "SGT",
  },
  "apac-east": {
    id: "apac-east",
    label: "APAC East",
    lat: 35.68,
    lng: 139.69,
    bbox: { north: 46.0, south: 30.0, east: 145.0, west: 130.0 },
    polygon: [[30, 130], [30, 145], [46, 145], [46, 130]],
    timezone: "JST",
  },
  // South Africa regions (VVU EARTH TECH home market)
  "za-ec": {
    id: "za-ec",
    label: "Eastern Cape (Gqeberha)",
    lat: -33.96,
    lng: 25.60,
    bbox: { north: -31.0, south: -35.0, east: 29.0, west: 23.0 },
    polygon: [[-35, 23], [-35, 29], [-31, 29], [-31, 23]],
    timezone: "SAST",
  },
  "za-wc": {
    id: "za-wc",
    label: "Western Cape (Cape Town)",
    lat: -33.92,
    lng: 18.42,
    bbox: { north: -31.0, south: -35.0, east: 21.0, west: 17.0 },
    polygon: [[-35, 17], [-35, 21], [-31, 21], [-31, 17]],
    timezone: "SAST",
  },
  "za-gp": {
    id: "za-gp",
    label: "Gauteng (Johannesburg)",
    lat: -26.20,
    lng: 28.05,
    bbox: { north: -25.0, south: -27.0, east: 29.0, west: 27.0 },
    polygon: [[-27, 27], [-27, 29], [-25, 29], [-25, 27]],
    timezone: "SAST",
  },
  "za-lp": {
    id: "za-lp",
    label: "Limpopo (Polokwane)",
    lat: -23.90,
    lng: 29.45,
    bbox: { north: -22.0, south: -25.0, east: 31.0, west: 27.0 },
    polygon: [[-25, 27], [-25, 31], [-22, 31], [-22, 27]],
    timezone: "SAST",
  },
};

// Equirectangular projection: lat/lng → x/y on an SVG canvas
// (lng: -180..180 → x: 0..W, lat: 90..-90 → y: 0..H)
export function project(lat: number, lng: number, W: number, H: number): { x: number; y: number } {
  const x = ((lng + 180) / 360) * W;
  const y = ((90 - lat) / 180) * H;
  return { x, y };
}

// Inverse projection: x/y → lat/lng
export function unproject(x: number, y: number, W: number, H: number): { lat: number; lng: number } {
  const lng = (x / W) * 360 - 180;
  const lat = 90 - (y / H) * 180;
  return { lat, lng };
}

// Haversine distance between two lat/lng points (km)
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Check if a point is inside a region's bounding box
export function inBbox(lat: number, lng: number, region: RegionGeo): boolean {
  const { bbox } = region;
  return (
    lat >= bbox.south && lat <= bbox.north && lng >= bbox.west && lng <= bbox.east
  );
}

// Find the nearest region to a given lat/lng
export function nearestRegion(lat: number, lng: number): RegionGeo | null {
  let nearest: RegionGeo | null = null;
  let minDist = Infinity;
  for (const r of Object.values(REGIONS_GEO)) {
    const d = haversineKm(lat, lng, r.lat, r.lng);
    if (d < minDist) {
      minDist = d;
      nearest = r;
    }
  }
  return nearest;
}
