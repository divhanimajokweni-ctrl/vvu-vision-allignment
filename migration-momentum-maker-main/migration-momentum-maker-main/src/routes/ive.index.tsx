import { createFileRoute } from "@tanstack/react-router";
import Page from "@/components/ive-site/pages/home";

export const Route = createFileRoute("/ive/")({
  head: () => ({
    meta: [
      { title: "VVU IVE — Integrated Verification Environment" },
      {
        name: "description",
        content:
          "Engineer systems that can prove themselves. Bounded formal verification with cryptographically traceable evidence.",
      },
      { property: "og:title", content: "VVU IVE — Integrated Verification Environment" },
      { property: "og:description", content: "Engineer systems that can prove themselves." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "icon", href: "/ive/ive-favicon.svg", type: "image/svg+xml" }],
  }),
  component: Page,
});
