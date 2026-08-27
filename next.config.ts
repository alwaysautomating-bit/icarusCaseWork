import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  outputFileTracingIncludes: {
    "/cases/*/reports/*": ["./reference-reports/**/*"],
    "/cases/*/trial-index": ["./generated/day-intelligence/**/*"],
  },
};

export default nextConfig;
