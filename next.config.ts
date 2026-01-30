import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ignore TypeScript errors during build
  typescript: {
    ignoreBuildErrors: true,
  },
  // Note: 'webpack' config removed to avoid Turbopack conflict.
  // Note: 'eslint' config removed as it is unsupported in this version via next.config.ts.
  // Linting is skipped via 'next build --no-lint' in package.json.
};

export default nextConfig;
