import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: ["sql.js"],
  allowedDevOrigins: ["26.255.208.186"],
  // Recorded mode is hidden on Vercel (no persistent disk for SQLite). Set NEXT_PUBLIC_RECORDED_MODE=on to force it.
  env: { NEXT_PUBLIC_RECORDED_MODE: process.env.NEXT_PUBLIC_RECORDED_MODE ?? (process.env.VERCEL ? "off" : "on") },
};

export default nextConfig;


