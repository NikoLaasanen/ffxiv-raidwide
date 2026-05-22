import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "v2.xivapi.com",
        pathname: "/api/asset",
      },
    ],
  },
};

export default nextConfig;
