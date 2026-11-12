import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: ["sql.js"],
  allowedDevOrigins: ["26.255.208.186"],
};

export default nextConfig;


