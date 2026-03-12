import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "http", hostname: "localhost" },
    ],
  },
  // This tells Next.js to ignore the lockfile in your home directory
  outputFileTracingRoot: path.join(__dirname, "./"),
};

export default nextConfig;