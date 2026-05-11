"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Bell,
  Flame,
  LogOut,
  Star,
} from "lucide-react";
import { authApi } from "@/lib/api";
import { getXpForLevel } from "@/lib/utils";

interface UserProfile {
  name: string;
  level: number;
  totalXp: number;
}

export function Topbar() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    authApi.profile().then((data) => {
      setUser({ name: data.name, level: data.level, totalXp: data.totalXp });
    }).catch(() => {});
  }, []);

  const handleLogout = () => {
    authApi.logout().catch(() => {});
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("userId");
    router.push("/auth/login");
  };

  const nextLevelXp = user ? getXpForLevel(user.level) : 100;
  const xpProgress = user ? Math.min((user.totalXp / nextLevelXp) * 100, 100) : 0;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-800 bg-gray-950/80 backdrop-blur-xl px-6">
      <div className="flex items-center gap-4">
        <h2 className="text-sm font-medium text-gray-400">
          Welcome back,{" "}
          <span className="text-gray-100">{user?.name || "Engineer"}</span>
        </h2>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 rounded-lg bg-gray-800/50 px-3 py-1.5 border border-gray-700/50">
          <Flame className="h-4 w-4 text-orange-400" />
          <span className="text-xs font-medium text-gray-300">0 day streak</span>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-gray-800/50 px-3 py-1.5 border border-gray-700/50">
          <Star className="h-4 w-4 text-yellow-400" />
          <span className="text-xs font-medium text-gray-300">
            {user?.totalXp || 0} XP
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-indigo-500/10 border-indigo-500/30">
            Lvl {user?.level || 1}
          </Badge>
          <Progress value={xpProgress} className="w-20 h-1.5" indicatorClassName="bg-gradient-to-r from-indigo-500 to-purple-500" />
        </div>

        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4 text-gray-400" />
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500" />
        </Button>

        <Button variant="ghost" size="icon" onClick={handleLogout}>
          <LogOut className="h-4 w-4 text-gray-400" />
        </Button>
      </div>
    </header>
  );
}
