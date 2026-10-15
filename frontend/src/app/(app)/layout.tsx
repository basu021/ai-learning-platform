"use client";

import { SessionProvider, useSession } from "@/lib/auth";
import { ToastProvider } from "@/components/ui/toast";
import { Sidebar, MobileNav } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Spinner } from "@/components/ui/field";

function Shell({ children }: { children: React.ReactNode }) {
  const { me, loading } = useSession();
  if (loading || !me) {
    return (
      <div className="min-h-screen bg-gray-950">
        <Spinner className="h-screen" />
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-gray-950">
      <Sidebar />
      <div className="md:ml-60">
        <Topbar />
        <MobileNav />
        <main className="mx-auto max-w-[1400px] p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        <Shell>{children}</Shell>
      </ToastProvider>
    </SessionProvider>
  );
}
