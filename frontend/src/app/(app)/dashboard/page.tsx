"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Flame, Target, Star, AlertTriangle, CalendarDays, TrendingUp, Clock, CheckCircle2, Library } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmptyState, Spinner } from "@/components/ui/field";
import { OccurrenceRow, UpcomingList } from "@/components/tasks/agenda";
import { dashboardApi, type DashboardData } from "@/lib/api";
import { formatDuration, getXpForLevel, timeAgo } from "@/lib/utils";

function Stat({ label, value, sub, icon: Icon, tone, delay }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon: React.ComponentType<{ className?: string }>; tone: string; delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-400">{label}</p>
              <p className="mt-1 text-3xl font-bold">{value}</p>
            </div>
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
              <Icon className="h-5 w-5" />
            </div>
          </div>
          {sub && <div className="mt-3 text-xs text-gray-500">{sub}</div>}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function DashboardPage() {
  const [d, setD] = useState<DashboardData | null>(null);
  useEffect(() => {
    dashboardApi.get().then(setD).catch(() => {});
  }, []);
  if (!d) return <Spinner />;

  const { total, completed } = d.todayProgress;
  const level = d.user?.level ?? 1;
  const xp = d.user?.totalXp ?? 0;
  const next = getXpForLevel(level);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Today" value={<>{completed}<span className="text-lg text-gray-500">/{total}</span></>} icon={Target} tone="bg-indigo-500/10 text-indigo-400" delay={0}
          sub={<Progress value={total ? (completed / total) * 100 : 0} indicatorClassName="bg-gradient-to-r from-indigo-500 to-purple-500" />} />
        <Stat label="Streak" value={<>{d.streak?.currentCount ?? 0}<span className="text-lg text-gray-500"> days</span></>} icon={Flame} tone="bg-orange-500/10 text-orange-400" delay={0.05}
          sub={`Longest: ${d.streak?.longestCount ?? 0} days`} />
        <Stat label="XP" value={xp} icon={Star} tone="bg-yellow-500/10 text-yellow-400" delay={0.1} sub={`Level ${level} · ${Math.max(0, next - xp)} XP to next`} />
        <Stat label="Overdue" value={d.agenda.overdue.length} icon={AlertTriangle} tone="bg-red-500/10 text-red-400" delay={0.15}
          sub={d.agenda.overdue.length ? <Link href="/tasks" className="text-red-300 hover:underline">Catch up</Link> : "All caught up"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-indigo-400" /> Today&apos;s practice</CardTitle>
              <Link href="/tasks"><Button size="sm" variant="outline">All tasks</Button></Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {d.agenda.overdue.slice(0, 3).map((o) => <OccurrenceRow key={o.id} item={o} showDate />)}
              {d.agenda.todayItems.length === 0 && d.agenda.overdue.length === 0 ? (
                <EmptyState icon={Target} title="Nothing scheduled today">
                  Open a subject in the <Link href="/library" className="text-indigo-400 hover:underline">Library</Link> and choose “Practice this” to schedule daily, weekly or monthly practice.
                </EmptyState>
              ) : (
                d.agenda.todayItems.map((o) => <OccurrenceRow key={o.id} item={o} />)
              )}
            </CardContent>
          </Card>
          {d.agenda.upcoming.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Coming up</CardTitle></CardHeader>
              <CardContent><UpcomingList items={d.agenda.upcoming.slice(0, 8)} /></CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4 text-emerald-400" /> Consistency by subject</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {d.subjectProgress.length === 0 ? (
                <p className="py-2 text-center text-sm text-gray-500">Complete practice to see progress.</p>
              ) : (
                d.subjectProgress.map((s) => (
                  <div key={s.id}>
                    <div className="mb-1 flex justify-between text-sm">
                      <Link href={`/subjects/${s.id}`} className="truncate hover:text-indigo-300">{s.title}</Link>
                      <span className="text-xs text-gray-400">{s.rate}%</span>
                    </div>
                    <Progress value={s.rate} className="h-1.5" indicatorClassName="bg-gradient-to-r from-emerald-500 to-teal-400" />
                    <p className="mt-1 text-[11px] text-gray-500">{s.completed} of {s.due} sessions done</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          {d.weakAreas.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-yellow-400" /> Focus areas</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {d.weakAreas.map((w, i) => (
                  <Link key={i} href={`/subjects/${w.subjectId}`} className="flex items-center justify-between rounded border border-yellow-500/10 bg-yellow-500/5 px-2 py-1.5 text-sm hover:bg-yellow-500/10">
                    <span className="truncate">{w.title}</span>
                    <span className="text-xs text-yellow-300">{Math.round(w.mastery)}%</span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4 text-sky-400" /> Recent activity</CardTitle></CardHeader>
            <CardContent>
              {d.recentActivity.length === 0 ? (
                <EmptyState icon={Library} title="No activity yet" />
              ) : (
                <ul className="space-y-2">
                  {d.recentActivity.map((r) => (
                    <li key={r.id} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      <div className="min-w-0">
                        <p className="truncate text-sm">{r.title}</p>
                        <p className="text-[11px] text-gray-500">{r.subject} · {r.duration ? formatDuration(r.duration) : "no timer"} · {timeAgo(r.completedAt)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
