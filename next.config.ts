import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/financas",
  assetPrefix: "/financas/",
  images: { unoptimized: true },
};

export default nextConfig;
