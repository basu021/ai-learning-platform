"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi, clearSession, type Me } from "./api";

interface Session {
  me: Me | null;
  loading: boolean;
  isAdmin: boolean;
  refresh: () => Promise<void>;
  logout: () => void;
}

const SessionContext = createContext<Session | null>(null);

export function homeFor(role: Me["role"]) {
  return role === "ADMIN" ? "/admin" : "/dashboard";
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setMe(await authApi.profile());
    } catch {
      setMe(null);
    }
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("accessToken")) {
      router.replace("/auth/login");
      return;
    }
    refresh().finally(() => setLoading(false));
  }, [refresh, router]);

  const logout = useCallback(() => {
    authApi.logout().catch(() => {});
    clearSession();
    router.push("/auth/login");
  }, [router]);

  return (
    <SessionContext.Provider value={{ me, loading, isAdmin: me?.role === "ADMIN", refresh, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
