import { createFileRoute } from "@tanstack/react-router";
import Page from "@/components/ive-site/pages/who";

export const Route = createFileRoute("/ive/who")({
  head: () => ({
    meta: [
      { title: "VVU IVE — Verification for Operators and Researchers" },
      {
        name: "description",
        content:
          "Evidence-first decision chains for water utilities, mining, financial assurance, and university research.",
      },
      { property: "og:title", content: "VVU IVE — Verification for Operators and Researchers" },
      {
        property: "og:description",
        content:
          "Evidence-first decision chains for water utilities, mining, financial assurance, and university research.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "icon", href: "/ive/ive-favicon.svg", type: "image/svg+xml" }],
  }),
  component: Page,
});
