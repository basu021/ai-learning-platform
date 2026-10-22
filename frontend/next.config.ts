import type { NextConfig } from "next";

// `next build` makes a static site in out/ for plain web hosting (Hostinger).
// The Docker image sets NEXT_OUTPUT=server to run `next start` instead.
const server = process.env.NEXT_OUTPUT === "server";

// Embedded images are stored as relative /api/attachments/... URLs so content
// keeps working if the public API address changes. The server build proxies
// them to the backend; the static build redirects them (out/.htaccess).
const apiInternal =
  process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const nextConfig: NextConfig = server
  ? {
      async rewrites() {
        return [
          { source: "/api/attachments/:path*", destination: `${apiInternal}/api/attachments/:path*` },
        ];
      },
    }
  : { output: "export", trailingSlash: true };

export default nextConfig;
