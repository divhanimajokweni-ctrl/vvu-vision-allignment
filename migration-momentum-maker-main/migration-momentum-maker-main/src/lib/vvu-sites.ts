// VVU South-African site configurations
// 3 sites: Gqeberha beachfront R&D · Anglo American Mogalakwena · Sibanye-Stillwater Marikana
// Each site has WGS84 coords, an accent color, and ENU-mm terrain pin layouts for the HBK nodes.

export interface VvuSiteNode {
  id: string;
  componentName: string;
  x: number; // ENU mm, mapped to 0–100 grid
  y: number;
  z: number;
  functionalRole: string;
}

export interface VvuSite {
  slug: "gqeberha" | "mogalakwena" | "marikana";
  name: string;
  region: string;
  latitude: number;
  longitude: number;
  altitudeM: number;
  accent: string; // tailwind/hex accent
  accentSoft: string; // softer variant
  nodes: VvuSiteNode[];
}

export const VVU_SITES: VvuSite[] = [
  {
    slug: "gqeberha",
    name: "Gqeberha Beachfront R&D",
    region: "Eastern Cape",
    latitude: -33.9608,
    longitude: 25.6022,
    altitudeM: 5,
    accent: "#C46D1A", // Venture burnt-orange
    accentSoft: "#3a2410",
    nodes: [
      { id: "N01", componentName: "HBK-APU-01", x: 50, y: 18, z: 0, functionalRole: "COMPUTE" },
      { id: "N02", componentName: "BATT-8S4P-01", x: 32, y: 22, z: 0, functionalRole: "POWER" },
      { id: "N03", componentName: "NVME-WORM-01", x: 68, y: 22, z: 0, functionalRole: "STORAGE" },
      { id: "N04", componentName: "ATECC608B-01", x: 50, y: 30, z: 0, functionalRole: "SECURITY" },
      {
        id: "N05",
        componentName: "FLANGE-DN300-01",
        x: 50,
        y: 50,
        z: 0,
        functionalRole: "HYDRAULIC",
      },
      { id: "N06", componentName: "PRESS-XDCR-01", x: 38, y: 56, z: 0, functionalRole: "SENSOR" },
      { id: "N07", componentName: "FLOW-XDCR-01", x: 62, y: 56, z: 0, functionalRole: "SENSOR" },
      { id: "N08", componentName: "ACOUSTIC-N7", x: 30, y: 70, z: 0, functionalRole: "SENSOR" },
      { id: "N09", componentName: "ACOUSTIC-N8", x: 70, y: 70, z: 0, functionalRole: "SENSOR" },
      { id: "N10", componentName: "RF-BULKHEAD-01", x: 50, y: 82, z: 0, functionalRole: "COMMS" },
      { id: "N11", componentName: "THERMAL-BRIDGE", x: 50, y: 42, z: 0, functionalRole: "THERMAL" },
    ],
  },
  {
    slug: "mogalakwena",
    name: "Anglo American Mogalakwena",
    region: "Limpopo",
    latitude: -24.345,
    longitude: 28.784,
    altitudeM: 1050,
    accent: "#6B8A40", // Ubuntu olive
    accentSoft: "#1f2c14",
    nodes: [
      { id: "M01", componentName: "HBK-APU-02", x: 50, y: 25, z: 0, functionalRole: "COMPUTE" },
      { id: "M02", componentName: "BATT-8S4P-02", x: 30, y: 32, z: 0, functionalRole: "POWER" },
      { id: "M03", componentName: "NVME-WORM-02", x: 70, y: 32, z: 0, functionalRole: "STORAGE" },
      {
        id: "M04",
        componentName: "FLANGE-DN100-02",
        x: 50,
        y: 55,
        z: 0,
        functionalRole: "HYDRAULIC",
      },
      { id: "M05", componentName: "PRESS-XDCR-02", x: 38, y: 62, z: 0, functionalRole: "SENSOR" },
      { id: "M06", componentName: "FLOW-XDCR-02", x: 62, y: 62, z: 0, functionalRole: "SENSOR" },
      { id: "M07", componentName: "ACOUSTIC-N9", x: 50, y: 78, z: 0, functionalRole: "SENSOR" },
      { id: "M08", componentName: "RF-BULKHEAD-02", x: 50, y: 90, z: 0, functionalRole: "COMMS" },
    ],
  },
  {
    slug: "marikana",
    name: "Sibanye-Stillwater Marikana",
    region: "North West",
    latitude: -25.67,
    longitude: 27.35,
    altitudeM: 1180,
    accent: "#F3E38A", // Vision cream
    accentSoft: "#36331a",
    nodes: [
      { id: "R01", componentName: "HBK-APU-03", x: 50, y: 22, z: 0, functionalRole: "COMPUTE" },
      { id: "R02", componentName: "BATT-8S4P-03", x: 32, y: 28, z: 0, functionalRole: "POWER" },
      { id: "R03", componentName: "NVME-WORM-03", x: 68, y: 28, z: 0, functionalRole: "STORAGE" },
      { id: "R04", componentName: "ATECC608B-03", x: 50, y: 35, z: 0, functionalRole: "SECURITY" },
      {
        id: "R05",
        componentName: "FLANGE-DN300-03",
        x: 50,
        y: 52,
        z: 0,
        functionalRole: "HYDRAULIC",
      },
      { id: "R06", componentName: "PRESS-XDCR-03", x: 40, y: 60, z: 0, functionalRole: "SENSOR" },
      { id: "R07", componentName: "FLOW-XDCR-03", x: 60, y: 60, z: 0, functionalRole: "SENSOR" },
      { id: "R08", componentName: "ACOUSTIC-N10", x: 50, y: 75, z: 0, functionalRole: "SENSOR" },
      { id: "R09", componentName: "RF-BULKHEAD-03", x: 50, y: 88, z: 0, functionalRole: "COMMS" },
      {
        id: "R10",
        componentName: "THERMAL-BRIDGE-03",
        x: 50,
        y: 44,
        z: 0,
        functionalRole: "THERMAL",
      },
    ],
  },
];

export function getSite(slug: string): VvuSite {
  return VVU_SITES.find((s) => s.slug === slug) ?? VVU_SITES[0];
}
