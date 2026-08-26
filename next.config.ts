import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  outputFileTracingIncludes: {
    "/cases/*/reports/*": ["./reference-reports/**/*"],
  },
};

export default nextConfig;
