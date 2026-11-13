import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
