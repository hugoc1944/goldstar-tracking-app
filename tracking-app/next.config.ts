import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // (optional) silence the multi-lockfile warning by pinning the root
  turbopack: { root: './tracking-app' },
};


export default nextConfig;
