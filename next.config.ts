import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Security headers — spec §10 requirements: CSP (Supabase + image hosts),
  // frame-ancestors none, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: [
            "default-src 'self'",
            "img-src 'self' https: data: blob:",
            "media-src 'self' blob:",
            "connect-src 'self' https:",
            "style-src 'self' 'unsafe-inline'",
            "script-src 'self'",
            "frame-ancestors 'none'",
          ].join("; ")},
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
