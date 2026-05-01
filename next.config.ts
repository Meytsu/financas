import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/financas",
  assetPrefix: "/financas/",
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: "/financas",
  },
};

export default nextConfig;
