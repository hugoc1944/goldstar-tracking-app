import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
    experimental: {
    // Server Actions form-data/body limit (affects some App Router code-paths)
    serverActions: { bodySizeLimit: '25mb' }, // pick the ceiling you’re comfy with
  },
  // Only affects Pages Router /api routes; harmless to keep for mixed setups
  api: { bodyParser: { sizeLimit: '25mb' } },
  // (optional) silence the multi-lockfile warning by pinning the root
};
export default nextConfig;
