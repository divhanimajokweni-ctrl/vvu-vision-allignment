import { createFileRoute } from "@tanstack/react-router";
import Page from "@/components/ive-site/pages/surfaces";

export const Route = createFileRoute("/ive/surfaces")({
  head: () => ({
    meta: [
      { title: "VVU IVE Surfaces — Nine Surfaces, One Spine" },
      {
        name: "description",
        content:
          "Explore nine operator surfaces and HBK Mk-II models sharing one WORM ledger, permit kernel, and provenance grammar.",
      },
      { property: "og:title", content: "VVU IVE Surfaces — Nine Surfaces, One Spine" },
      {
        property: "og:description",
        content:
          "Explore nine operator surfaces and HBK Mk-II models sharing one WORM ledger, permit kernel, and provenance grammar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "icon", href: "/ive/ive-favicon.svg", type: "image/svg+xml" }],
  }),
  component: Page,
});
