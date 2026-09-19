import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: {
    serverActions: { bodySizeLimit: "4.25mb" },
  },
  outputFileTracingIncludes: {
    "/cases/*/reports/*": ["./reports/**/*", "./evidence/**/*"],
    "/cases/*/timeline/**": ["./content/timelines/**/*"],
    "/cases/*/witness": ["./transcripts/preserved/**/*", "./transcripts/first-pass/**/*"],
    "/cases/*/witness/download": ["./transcripts/preserved/**/*", "./transcripts/first-pass/**/*"],
    "/cases/*/trial-index": ["./generated/day-intelligence/**/*", "./content/trial-index/collapse-days/**/*"],
  },
};

export default nextConfig;
