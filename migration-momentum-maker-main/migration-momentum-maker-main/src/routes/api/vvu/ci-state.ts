import { createFileRoute } from "@tanstack/react-router";
import { CI_STATE } from "@/lib/vvu/ci-state-data";

export const Route = createFileRoute("/api/vvu/ci-state")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(
          {
            ok: true,
            ledger: "vvu-trust/build/ci/ANDROID_APK_VALIDATION.md",
            ci: CI_STATE,
          },
          { headers: { "Cache-Control": "no-store" } },
        ),
    },
  },
});
