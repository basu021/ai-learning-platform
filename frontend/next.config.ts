import type { NextConfig } from "next";

// Embedded images are stored as relative /api/attachments/... URLs so content
// keeps working if the public API address changes; proxy them to the backend.
const apiInternal =
  process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/attachments/:path*", destination: `${apiInternal}/api/attachments/:path*` },
    ];
  },
};

export default nextConfig;
