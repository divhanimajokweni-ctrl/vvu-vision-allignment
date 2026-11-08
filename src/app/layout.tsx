import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VVU · Validation Dashboard — Venture Vision Ubuntu",
  description:
    "VVU dual-projection dashboard: spatial intelligence verification in real-time (3D mesh · maps · telemetry) and the analyst view (Trust Gates 3A/3B/3C · MOI 70.66% · WORM ledger · B-BBEE).",
  keywords: ["VVU", "Venture Vision Ubuntu", "ProofBridge-Liner", "SEARM", "WORM", "B-BBEE", "ESD", "JSE", "MOI"],
  authors: [{ name: "Venture Vision Ubuntu (VVU)" }],
  // Task 48 — recovered Task 43-g PWA identity: installable app metadata
  // (manifest + icons from public/; the SW itself is registered passively
  // by <ServiceWorkerRegistrar /> in providers.tsx — network-first, dev-safe).
  // R54 — the install path: raster PNG set (192/512 from the single SVG
  // source in public/icons/), maskable + monochrome + apple-touch entries.
  manifest: "/manifest.webmanifest",
  applicationName: "VVU Dashboard",
  icons: {
    icon: [
      { url: "/logo.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    title: "VVU Dashboard",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // R54 — the install path: lime theme colour (the standalone window's
  // chrome adopts the estate accent) + cover so the installed app respects
  // notched-device safe areas (the install sheet also pads
  // env(safe-area-inset-bottom)).
  themeColor: "#c8ff00",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased vvu-app-shell`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
