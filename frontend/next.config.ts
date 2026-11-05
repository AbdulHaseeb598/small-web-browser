import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker Desktop bind mounts may not forward host filesystem events.
  watchOptions: { pollIntervalMs: 1000 },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
