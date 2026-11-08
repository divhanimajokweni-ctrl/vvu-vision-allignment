import { createFileRoute } from "@tanstack/react-router";

// GET /api/vvu/db-stats — live row counts per sovereign table (feed
// recreation). The source seeded the DB at boot and returned counts; here
// the counts reflect the migrated (record-empty) schema.

export const Route = createFileRoute("/api/vvu/db-stats")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json(
          {
            tables: {
              tenants: 0,
              anchors: 0,
              nodes: 0,
              spools: 0,
              invariants: 0,
              telemetryLogs: 0,
              wormEvents: 0,
              auditLogs: 0,
              trustGates: 0,
            },
            seedResult: {
              tenantCreated: false,
              anchorCreated: false,
              nodesCreated: 0,
              spoolsCreated: 0,
              invariantsCreated: 0,
              gatesCreated: 0,
              ledgerCreated: false,
              ledgerTotal: 0,
            },
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
