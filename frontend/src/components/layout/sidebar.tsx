"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  BookOpen,
  ListTodo,
  Trophy,
  Settings,
  Zap,
  Brain,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/subjects", label: "Subjects", icon: BookOpen },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-gray-800 bg-gray-950/80 backdrop-blur-xl">
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-800">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              SkillForge
            </h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">
              AI Learning Platform
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-indigo-500/15 text-indigo-400 shadow-sm"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50",
                )}
              >
                <item.icon className={cn("h-4.5 w-4.5", isActive && "text-indigo-400")} />
                {item.label}
                {isActive && (
                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-400" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 mx-3 mb-4 rounded-xl bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border border-indigo-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-yellow-400" />
            <span className="text-xs font-medium text-gray-300">Daily Quest</span>
          </div>
          <p className="text-xs text-gray-400">Complete 5 tasks to earn bonus XP</p>
          <div className="mt-2 h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-yellow-400 to-orange-400" />
          </div>
        </div>

        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600">
              <Trophy className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-300">Level Up!</p>
              <p className="text-[10px] text-gray-500">Keep practicing daily</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
