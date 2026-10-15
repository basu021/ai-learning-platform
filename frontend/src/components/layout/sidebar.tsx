"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth";
import {
  LayoutDashboard,
  Library,
  ListTodo,
  Settings,
  Brain,
  ShieldCheck,
  Users,
  FolderTree,
} from "lucide-react";

const userNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/library", label: "Library", icon: Library },
  { href: "/tasks", label: "Practice", icon: ListTodo },
  { href: "/settings", label: "Profile", icon: Settings },
];

const adminNav = [
  { href: "/admin", label: "Admin overview", icon: ShieldCheck, exact: true },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/content", label: "All content", icon: FolderTree },
];

function NavLink({ href, label, icon: Icon, exact }: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean }) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-indigo-500/15 text-indigo-300" : "text-gray-400 hover:bg-gray-800/60 hover:text-gray-200",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

export function Sidebar() {
  const { isAdmin } = useSession();
  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-60 border-r border-gray-800 bg-gray-950/90 backdrop-blur-xl md:block">
      <div className="flex h-full flex-col">
        <Link href={isAdmin ? "/admin" : "/dashboard"} className="flex items-center gap-3 border-b border-gray-800 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-lg font-bold text-transparent">SkillForge</h1>
            <p className="text-[10px] uppercase tracking-widest text-gray-500">Learning platform</p>
          </div>
        </Link>
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {isAdmin && (
            <div className="space-y-1">
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-600">Administration</p>
              {adminNav.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
            </div>
          )}
          <div className="space-y-1">
            {isAdmin && <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-600">Learning</p>}
            {userNav.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </div>
        </nav>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const { isAdmin } = useSession();
  const items = isAdmin ? [...adminNav.slice(0, 2), ...userNav.slice(1, 3)] : userNav;
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-gray-800 px-3 py-2 md:hidden">
      {items.map((item) => (
        <NavLink key={item.href} {...item} />
      ))}
    </nav>
  );
}
