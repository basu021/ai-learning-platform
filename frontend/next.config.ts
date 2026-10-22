import type { NextConfig } from "next";

// Default: a Next.js server build (`next start`), used by Docker and by
// Node.js hosting such as Hostinger Web Apps. NEXT_OUTPUT=export instead
// makes a static site in out/ for plain file hosting (Apache/LiteSpeed).
const staticExport = process.env.NEXT_OUTPUT === "export";

// Embedded images are stored as relative /api/attachments/... URLs so content
// keeps working if the public API address changes. The server build proxies
// them to the backend; the static build redirects them (out/.htaccess).
const apiInternal =
  process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const nextConfig: NextConfig = staticExport
  ? { output: "export", trailingSlash: true }
  : {
      async rewrites() {
        return [
          { source: "/api/attachments/:path*", destination: `${apiInternal}/api/attachments/:path*` },
        ];
      },
    };

export default nextConfig;
