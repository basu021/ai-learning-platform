"use client";

import { User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

export default function ProfilePage() {
  const { me } = useSession();
  if (!me) return null;
  const rows: [string, React.ReactNode][] = [
    ["Name", me.name],
    ["Username", <span key="u">@{me.username} <span className="text-xs text-gray-500">— people share subjects with you using this</span></span>],
    ["Email", me.email],
    ["Role", me.role === "ADMIN" ? "Administrator" : "Learner"],
    ["Level", `${me.level} (${me.totalXp} XP)`],
    ...(me.createdAt ? [["Member since", formatDate(me.createdAt)] as [string, React.ReactNode]] : []),
  ];
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold"><User className="h-6 w-6 text-indigo-400" /> Profile</h1>
      <Card>
        <CardHeader><CardTitle className="text-base">Account</CardTitle></CardHeader>
        <CardContent>
          <dl className="divide-y divide-gray-800">
            {rows.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[140px_1fr] gap-4 py-3 text-sm">
                <dt className="text-gray-500">{k}</dt>
                <dd className="text-gray-200">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-gray-500">To change your name or password, ask an administrator.</p>
        </CardContent>
      </Card>
    </div>
  );
}
