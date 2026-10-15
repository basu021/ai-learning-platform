"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Bell, LogOut, Star, ShieldCheck } from "lucide-react";
import { notificationsApi, type NotificationItem } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { cn, timeAgo } from "@/lib/utils";

function Notifications() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ items: NotificationItem[]; unread: number }>({ items: [], unread: 0 });
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    notificationsApi.list().then(setData).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const openItem = async (n: NotificationItem) => {
    if (!n.read) await notificationsApi.read(n.id).catch(() => {});
    setOpen(false);
    load();
    if (n.link) router.push(n.link);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen(!open);
          if (!open) load();
        }}
        className="relative rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {data.unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {data.unread > 9 ? "9+" : data.unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-gray-800 bg-gray-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-800 px-4 py-2.5">
            <span className="text-sm font-semibold">Notifications</span>
            {data.unread > 0 && (
              <button
                className="text-xs text-indigo-400 hover:underline"
                onClick={() => notificationsApi.readAll().then(load)}
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {data.items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-500">You&apos;re all caught up</p>
            ) : (
              data.items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={cn(
                    "block w-full border-b border-gray-800/60 px-4 py-3 text-left hover:bg-gray-800/50",
                    !n.read && "bg-indigo-500/5",
                  )}
                >
                  <div className="flex items-center gap-2">
                    {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />}
                    <span className="text-sm font-medium text-gray-200">{n.title}</span>
                    <span className="ml-auto shrink-0 text-[11px] text-gray-500">{timeAgo(n.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">{n.message}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function Topbar() {
  const { me, isAdmin, logout } = useSession();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-gray-800 bg-gray-950/80 px-4 backdrop-blur-xl md:px-6">
      <div className="min-w-0 truncate text-sm text-gray-400">
        Signed in as <span className="text-gray-100">{me?.name}</span>{" "}
        <span className="text-gray-500">@{me?.username}</span>
      </div>
      <div className="flex items-center gap-2">
        {isAdmin && (
          <Badge variant="default" className="hidden gap-1 sm:inline-flex">
            <ShieldCheck className="h-3 w-3" /> Admin
          </Badge>
        )}
        <Link
          href="/dashboard"
          className="hidden items-center gap-1.5 rounded-lg border border-gray-700/50 bg-gray-800/50 px-2.5 py-1 text-xs text-gray-300 sm:flex"
        >
          <Star className="h-3.5 w-3.5 text-yellow-400" />
          {me?.totalXp ?? 0} XP · Lvl {me?.level ?? 1}
        </Link>
        <Notifications />
        <button onClick={logout} className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-gray-200" aria-label="Sign out">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
