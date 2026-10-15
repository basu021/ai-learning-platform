"use client";

import { Alert } from "@/components/ui/field";
import { useSession } from "@/lib/auth";

export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useSession();
  if (!isAdmin) return <Alert className="mx-auto mt-10 max-w-lg">This area is for administrators.</Alert>;
  return <>{children}</>;
}
