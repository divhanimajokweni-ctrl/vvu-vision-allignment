import { createFileRoute } from "@tanstack/react-router";
import Page from "@/components/ive-site/pages/proof";

export const Route = createFileRoute("/ive/proof")({
  head: () => ({
    meta: [
      { title: "VVU IVE Proof — Tamper Detection and Permit Replay" },
      {
        name: "description",
        content:
          "Explore the IVE WORM-chain tamper detection and exactly-once permit replay demonstrations.",
      },
      { property: "og:title", content: "VVU IVE Proof — Tamper Detection and Permit Replay" },
      {
        property: "og:description",
        content:
          "Explore the IVE WORM-chain tamper detection and exactly-once permit replay demonstrations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "icon", href: "/ive/ive-favicon.svg", type: "image/svg+xml" }],
  }),
  component: Page,
});
