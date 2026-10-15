"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "success" | "error" | "info";
interface Toast {
  id: number;
  tone: Tone;
  message: string;
}

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: Tone = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  const icons = { success: CheckCircle2, error: AlertCircle, info: Info };
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
        {toasts.map((t) => {
          const Icon = icons[t.tone];
          return (
            <div
              key={t.id}
              role="status"
              className={cn(
                "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm shadow-xl backdrop-blur",
                t.tone === "success" && "border-emerald-500/30 bg-emerald-950/90 text-emerald-200",
                t.tone === "error" && "border-red-500/30 bg-red-950/90 text-red-200",
                t.tone === "info" && "border-indigo-500/30 bg-indigo-950/90 text-indigo-200",
              )}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const push = useContext(ToastContext);
  return {
    success: (m: string) => push(m, "success"),
    error: (e: unknown) => push(e instanceof Error ? e.message : String(e), "error"),
    info: (m: string) => push(m, "info"),
  };
}
