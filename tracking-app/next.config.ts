import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // (optional) silence the multi-lockfile warning by pinning the root
};


export default nextConfig;
