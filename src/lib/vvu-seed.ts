// src/lib/vvu-seed.ts — Idempotent seed of the sovereign DB
// (tenant, geographic anchor, physical nodes, spool profiles, invariants, gates).

import { db } from '@/lib/db';
import {
  GQEBERHA_TENANT_ID,
  PHYSICAL_NODES,
  PIPE_SPOOL_PROFILES,
  HYDRAULIC_INVARIANTS,
  GATE_DEFS,
} from '@/lib/vvu-data';

export async function seedSovereignDb() {
  const tenant = await db.tenant.upsert({
    where: { code: 'GQEBERHA-EDGE-01' },
    update: {},
    create: {
      id: GQEBERHA_TENANT_ID,
      code: 'GQEBERHA-EDGE-01',
      name: 'Gqeberha Edge Node',
      anchorLat: '-33.9608',
      anchorLon: '25.6022',
    },
  });

  const anchor = await db.geographicAnchor.findFirst({ where: { tenantId: GQEBERHA_TENANT_ID } });
  let anchorCreated = false;
  if (!anchor) {
    await db.geographicAnchor.create({
      data: { tenantId: GQEBERHA_TENANT_ID, name: 'Gqeberha WGS84 Anchor', wgs84Lat: '-33.9608', wgs84Lon: '25.6022', datum: 'WGS84' },
    });
    anchorCreated = true;
  }

  let nodesCreated = 0;
  for (const n of PHYSICAL_NODES) {
    const exists = await db.physicalNode.findFirst({ where: { tenantId: GQEBERHA_TENANT_ID, nodeId: n.nodeId } });
    if (!exists) {
      await db.physicalNode.create({
        data: {
          tenantId: GQEBERHA_TENANT_ID,
          nodeId: n.nodeId,
          name: n.name,
          role: n.role,
          xCoordMm: n.xMm,
          yCoordMm: n.yMm,
          zCoordMm: n.zMm,
          materialGrade: n.materialGrade ?? null,
          diameterMm: n.diameterMm ?? null,
          assemblyTorqueNm: n.assemblyTorqueNm ?? null,
        },
      });
      nodesCreated++;
    }
  }

  let spoolsCreated = 0;
  for (const p of PIPE_SPOOL_PROFILES) {
    const exists = await db.pipeSpoolProfile.findFirst({ where: { nominalSize: p.nominalSize } });
    if (!exists) {
      await db.pipeSpoolProfile.create({ data: p });
      spoolsCreated++;
    }
  }

  let invariantsCreated = 0;
  for (const h of HYDRAULIC_INVARIANTS) {
    const exists = await db.hydraulicInvariant.findFirst({ where: { parameter: h.parameter } });
    if (!exists) {
      await db.hydraulicInvariant.create({ data: h });
      invariantsCreated++;
    }
  }

  let gatesCreated = 0;
  for (const g of GATE_DEFS) {
    const exists = await db.trustGateState.findFirst({ where: { gateId: g.gateId } });
    if (!exists) {
      await db.trustGateState.create({
        data: { gateId: g.gateId, status: 'PENDING', beneficiary: g.beneficiary, shares: g.shares },
      });
      gatesCreated++;
    }
  }

  return {
    tenant: { created: tenant ? true : false, id: tenant?.id },
    anchorCreated,
    nodesCreated,
    spoolsCreated,
    invariantsCreated,
    gatesCreated,
  };
}

export async function getDbStats() {
  const [tenants, anchors, nodes, spools, invariants, telemetry, worm, audit, gates] = await Promise.all([
    db.tenant.count(),
    db.geographicAnchor.count(),
    db.physicalNode.count(),
    db.pipeSpoolProfile.count(),
    db.hydraulicInvariant.count(),
    db.telemetryLog.count(),
    db.wormEvent.count(),
    db.auditLog.count(),
    db.trustGateState.count(),
  ]);
  return { tables: { tenants, anchors, nodes, spools, invariants, telemetryLogs: telemetry, wormEvents: worm, auditLogs: audit, trustGates: gates } };
}
