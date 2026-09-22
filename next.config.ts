import type { NextConfig } from "next";

/**
 * Response headers.
 *
 * The tracker is a personal log meant to sit behind a reverse proxy, but
 * "only I use it" describes today's habits, not a property of the code.
 * Scripts get `'self'` only; `'unsafe-inline'` for styles is Next's inlined
 * critical CSS.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  serverExternalPackages: ["node:sqlite"],

  /**
   * Emit a self-contained server alongside the build.
   *
   * `.next/standalone/server.js` runs without node_modules, which is what the
   * systemd unit points at: the app directory can then be mounted read-only,
   * and unlike `next start` the standalone server honours HOSTNAME, so the
   * service binds loopback from the unit file rather than a wrapper script.
   */
  output: "standalone",

  // Nothing gained by telling every visitor which framework to look up.
  poweredByHeader: false,

  /**
   * Keep the log out of the build. Output file tracing follows `fs` usage
   * statically, which is enough to sweep a live .db into the standalone
   * output and carry a stale copy onto the server.
   */
  outputFileTracingExcludes: {
    "/*": ["data/**/*", "test/**/*", "deploy/**/*", "scripts/**/*"],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
      {
        // A training log is nobody else's to cache.
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, private" }],
      },
    ];
  },
};

export default nextConfig;
