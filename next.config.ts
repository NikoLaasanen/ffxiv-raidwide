import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["firebase-admin"],
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
