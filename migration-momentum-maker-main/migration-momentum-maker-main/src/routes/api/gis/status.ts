import { createFileRoute } from "@tanstack/react-router";

interface GisStatusResponse {
  map_sync: boolean;
  layers: number;
  accuracy: number;
  coords: string;
  source: string;
  engine: string;
  update_rt: string;
  anchors: {
    pe: { city: string; lat: number; lon: number; dms: string };
    jhb: { city: string; lat: number; lon: number; dms: string };
  };
  ts: string;
}

export const Route = createFileRoute("/api/gis/status")({
  server: {
    handlers: {
      GET: async () => {
        const payload: GisStatusResponse = {
          map_sync: true,
          layers: 5,
          accuracy: 99.9,
          coords: `S33°57'38" E25°36'07"`,
          source: "GEO_GRID",
          engine: "ONLINE",
          update_rt: "LIVE",
          anchors: {
            pe: {
              city: "GQEBERHA · PE PILOT",
              lat: -33.9608,
              lon: 25.6022,
              dms: `S33°57'38" E25°36'07"`,
            },
            jhb: {
              city: "JHB CORRIDOR · VANDERBIJLPARK",
              lat: -26.137,
              lon: 27.921,
              dms: `S26°08'13" E27°55'16"`,
            },
          },
          ts: new Date().toISOString(),
        };
        return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
