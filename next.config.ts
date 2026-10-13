import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The whole app is per-user and reads fresh data on every request,
  // so the classic dynamic rendering model is the right fit here.
  cacheComponents: false,
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
