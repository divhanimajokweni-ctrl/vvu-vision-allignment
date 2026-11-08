import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateEpd, evaluateInvariant, type PolicyNode } from "@/lib/epd";
import {
  REGIONS_GEO,
  project,
  haversineKm,
  type RegionGeo,
} from "@/lib/spatial";

// GET /api/geo — geospatial view of all shards positioned on a world map.
// Returns shard markers with real lat/lng + projected x/y, region polygons,
// and locality-preserving merge links (shards within ~2000km of each other).
export async function GET() {
  const W = 800;
  const H = 400;

  const shards = await db.shard.findMany({
    include: { policy: { select: { name: true, source: true } } },
    orderBy: { region: "asc" },
  });

  // Build shard markers with coordinates
  const markers = shards.map((s, i) => {
    const regionGeo = REGIONS_GEO[s.region] ?? null;
    // If region has no geo data, use a fallback based on index
    const lat = regionGeo?.lat ?? 0;
    const lng = regionGeo?.lng ?? (i * 10 - 100);
    const pos = project(lat, lng, W, H);

    // Evaluate invariants for this shard
    let invariantOk = 0;
    let invariantFail = 0;
    try {
      const result = validateEpd(s.policy.source);
      const node = result.ast?.policies[0] as PolicyNode | undefined;
      if (node) {
        const state = JSON.parse(s.state);
        for (const inv of node.invariants) {
          const ev = evaluateInvariant(inv, state);
          if (ev.passed) invariantOk++;
          else invariantFail++;
        }
      }
    } catch {
      /* ignore */
    }

    return {
      id: s.id,
      region: s.region,
      regionLabel: regionGeo?.label ?? s.region,
      nodeId: s.nodeId,
      policyName: s.policy.name,
      status: s.invariantStatus,
      lat,
      lng,
      x: pos.x,
      y: pos.y,
      peerCount: s.peerCount,
      mmrRoot: s.mmrRoot,
      invariantOk,
      invariantFail,
      hasGeo: !!regionGeo,
    };
  });

  // Build region polygons (only regions that have shards)
  const activeRegions = new Set(markers.map((m) => m.region));
  const regions: {
    id: string;
    label: string;
    lat: number;
    lng: number;
    x: number;
    y: number;
    polygon: { x: number; y: number }[];
    bbox: RegionGeo["bbox"];
    shardCount: number;
    healthyCount: number;
    violatingCount: number;
    timezone: string;
  }[] = [];

  for (const regionId of activeRegions) {
    const geo = REGIONS_GEO[regionId];
    if (!geo) continue;
    const regionMarkers = markers.filter((m) => m.region === regionId);
    const center = project(geo.lat, geo.lng, W, H);
    regions.push({
      id: geo.id,
      label: geo.label,
      lat: geo.lat,
      lng: geo.lng,
      x: center.x,
      y: center.y,
      polygon: geo.polygon.map(([lat, lng]) => project(lat, lng, W, H)),
      bbox: geo.bbox,
      shardCount: regionMarkers.length,
      healthyCount: regionMarkers.filter((m) => m.status === "healthy").length,
      violatingCount: regionMarkers.filter((m) => m.status === "violating").length,
      timezone: geo.timezone,
    });
  }

  // Build locality-preserving merge links: connect shards within ~2000km
  // that are on the same node or same region (peer gossip)
  const links: {
    from: string;
    to: string;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    distanceKm: number;
    type: "gossip" | "merge";
  }[] = [];

  for (let i = 0; i < markers.length; i++) {
    for (let j = i + 1; j < markers.length; j++) {
      const a = markers[i];
      const b = markers[j];
      if (!a.hasGeo || !b.hasGeo) continue;
      const dist = haversineKm(a.lat, a.lng, b.lat, b.lng);
      // Same region or same node → gossip link
      if (a.region === b.region || a.nodeId === b.nodeId) {
        links.push({
          from: a.id,
          to: b.id,
          fromX: a.x,
          fromY: a.y,
          toX: b.x,
          toY: b.y,
          distanceKm: Math.round(dist),
          type: "gossip",
        });
      }
      // Within 2000km and different region → locality-preserving merge link
      else if (dist < 2000) {
        links.push({
          from: a.id,
          to: b.id,
          fromX: a.x,
          fromY: a.y,
          toX: b.x,
          toY: b.y,
          distanceKm: Math.round(dist),
          type: "merge",
        });
      }
    }
  }

  // Summary
  const totalShards = markers.length;
  const geoShards = markers.filter((m) => m.hasGeo).length;
  const totalLinks = links.length;
  const mergeLinks = links.filter((l) => l.type === "merge").length;
  const avgDistance =
    links.length > 0
      ? Math.round(links.reduce((n, l) => n + l.distanceKm, 0) / links.length)
      : 0;

  return NextResponse.json({
    width: W,
    height: H,
    markers,
    regions,
    links,
    summary: {
      totalShards,
      geoShards,
      totalRegions: regions.length,
      totalLinks,
      mergeLinks,
      avgLinkDistanceKm: avgDistance,
    },
  });
}
