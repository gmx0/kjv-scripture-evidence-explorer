import type { NextConfig } from "next";
import { resolve } from "node:path";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false,
  output: "standalone",
  turbopack: { root: resolve(import.meta.dirname, "../..") },
};

export default nextConfig;
