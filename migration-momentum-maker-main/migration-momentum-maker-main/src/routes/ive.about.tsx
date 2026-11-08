import { createFileRoute } from "@tanstack/react-router";
import Page from "@/components/ive-site/pages/about";

export const Route = createFileRoute("/ive/about")({
  head: () => ({
    meta: [
      { title: "About VVU IVE — The Honesty Statement" },
      {
        name: "description",
        content:
          "South African, CIPC-registered, B-BBEE Level 1. Read the IVE honesty rule, provenance standards, and compliance posture.",
      },
      { property: "og:title", content: "About VVU IVE — The Honesty Statement" },
      {
        property: "og:description",
        content:
          "South African, CIPC-registered, B-BBEE Level 1. Read the IVE honesty rule, provenance standards, and compliance posture.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "icon", href: "/ive/ive-favicon.svg", type: "image/svg+xml" }],
  }),
  component: Page,
});
