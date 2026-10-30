import type { NextConfig } from "next";

// Basic hardening headers. A strict Content-Security-Policy is listed as a
// production-hardening step in the README (it needs tuning for your setup).
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Type errors still fail the build. Lint is run separately with `npm run lint`.
  eslint: { ignoreDuringBuilds: true },
  // These parsers use Node-only code, so keep them out of the bundler.
  serverExternalPackages: ["exceljs", "mammoth", "jszip"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
