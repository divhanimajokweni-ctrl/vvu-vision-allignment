import { createFileRoute } from "@tanstack/react-router";

// POST /api/vvu/verify-hash — server-side recompute of a sample hash to prove
// "hash is proof". Same contract as the source route: { ok, filename, sha256,
// bytes, durationUs }.

interface VerifyHashBody {
  content?: unknown;
  filename?: unknown;
}

export const Route = createFileRoute("/api/vvu/verify-hash")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: VerifyHashBody;
        try {
          body = (await request.json()) as VerifyHashBody;
        } catch {
          return Response.json({ ok: false, error: "invalid JSON" }, { status: 400 });
        }

        const content = typeof body.content === "string" ? body.content : "";
        const filename = typeof body.filename === "string" ? body.filename : "inline";
        if (!content) {
          return Response.json({ ok: false, error: "missing content" }, { status: 400 });
        }

        const t0 = Date.now();
        const enc = new TextEncoder().encode(content);
        const digest = await crypto.subtle.digest("SHA-256", enc);
        const hex = Array.from(new Uint8Array(digest))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        const durationUs = Math.round((Date.now() - t0) * 1000);

        return Response.json({ ok: true, filename, sha256: hex, bytes: enc.length, durationUs });
      },
    },
  },
});
