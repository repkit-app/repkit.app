import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default withSentryConfig(nextConfig, {
  // Sentry Webpack Plugin Options
  org: "rustpoint",
  project: "repkit-app",

  // Only upload source maps in CI (not local dev)
  silent: !process.env.CI,
});
