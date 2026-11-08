import { createFileRoute } from "@tanstack/react-router";

interface YoloStatusResponse {
  detection: string;
  tracked: number;
  alerts: number;
  model: string;
  confidence: number;
  process_time_ms: number;
  threat: string;
  engine: string;
  ts: string;
}

export const Route = createFileRoute("/api/yolo/status")({
  server: {
    handlers: {
      GET: async () => {
        const now = Date.now();
        const payload: YoloStatusResponse = {
          detection: "ON",
          tracked: 25,
          alerts: 14,
          model: "V8_NANO",
          confidence: 0.95,
          process_time_ms: 20 + Math.floor((now / 1000) % 5),
          threat: "ELEVATED",
          engine: "ONLINE",
          ts: new Date(now).toISOString(),
        };
        return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
