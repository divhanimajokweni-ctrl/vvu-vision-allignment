import { createFileRoute } from "@tanstack/react-router";
import Page from "@/components/ive-site/pages/contact";

export const Route = createFileRoute("/ive/contact")({
  head: () => ({
    meta: [
      { title: "Contact VVU IVE — Start a Pilot" },
      {
        name: "description",
        content:
          "Discuss a verification pilot, sponsorship, research partnership, or investment with VVU IVE.",
      },
      { property: "og:title", content: "Contact VVU IVE — Start a Pilot" },
      {
        property: "og:description",
        content:
          "Discuss a verification pilot, sponsorship, research partnership, or investment with VVU IVE.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "icon", href: "/ive/ive-favicon.svg", type: "image/svg+xml" }],
  }),
  component: Page,
});
