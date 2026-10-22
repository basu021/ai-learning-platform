"use client";

import { useParams, usePathname } from "next/navigation";

/**
 * The [id] segment of the current route. Static builds export one placeholder
 * page ("_") per dynamic route, which the host serves for every id (see
 * scripts/write-htaccess.mjs), so the id is read from the URL in that case.
 */
export function useRouteId(base: string): string {
  const params = useParams<{ id?: string }>();
  const pathname = usePathname();
  if (params.id && params.id !== "_") return params.id;
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : "";
  return decodeURIComponent(rest.replace(/^\/+/, "").split("/")[0] ?? "");
}
