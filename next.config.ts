import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
  experimental: {
    // The Turbopack dev filesystem cache (default-on since Next 16.1) writes
    // an LSM-tree into .next/dev/cache/turbopack/ and keeps it in the Rust
    // native addon's own allocator — OUTSIDE the V8 heap. This means no
    // NODE_OPTIONS memory flag can limit it, and it was causing 22GB virtual
    // / 1.7GB RSS → OOM-killed next-server every ~12-40s in the sandbox.
    // Disabling it is the single biggest memory win. See:
    // https://github.com/vercel/next.js/issues/81161
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
