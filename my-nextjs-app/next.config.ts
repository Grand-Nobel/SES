import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* other config options here */
  // swcMinify: true, // This is often true by default in newer Next.js versions
  // We'll rely on Next.js default behavior for now regarding LightningCSS,
  // as the experimental.css.lightningcss flag caused a type error.
  // Having lightningcss installed might be picked up automatically by SWC.
};

export default nextConfig;
