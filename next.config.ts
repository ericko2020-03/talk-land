// path: next.config.ts

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-49d3c9b35154479797cbcfd3c53a6088.r2.dev",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;