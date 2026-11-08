import { createFileRoute } from "@tanstack/react-router";
import Page from "@/components/ive-site/pages/pricing";

export const Route = createFileRoute("/ive/pricing")({
  head: () => ({
    meta: [
      { title: "VVU IVE Pricing — Discovery, Pilot and Monitoring" },
      {
        name: "description",
        content:
          "Evidence-first verification in ZAR: R15,000 discovery, R50,000 pilots, and monitoring from R5,000 per month.",
      },
      { property: "og:title", content: "VVU IVE Pricing — Discovery, Pilot and Monitoring" },
      {
        property: "og:description",
        content:
          "Evidence-first verification in ZAR: R15,000 discovery, R50,000 pilots, and monitoring from R5,000 per month.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "icon", href: "/ive/ive-favicon.svg", type: "image/svg+xml" }],
  }),
  component: Page,
});
