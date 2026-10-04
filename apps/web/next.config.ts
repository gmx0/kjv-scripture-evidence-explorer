import type { NextConfig } from "next";
import { resolve } from "node:path";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  output: "standalone",
  turbopack: { root: resolve(import.meta.dirname, "../..") },
};

export default nextConfig;
