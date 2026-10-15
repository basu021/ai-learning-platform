"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Users, Library, ListTodo, KeyRound, GitPullRequest, Plus, CalendarCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState, Spinner } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { AdminOnly } from "@/components/layout/admin-only";
import { TaskFormModal } from "@/components/tasks/task-form";
import { adminApi, subjectsApi, type AccessRequestItem, type AdminStats, type PendingChangeRow } from "@/lib/api";
import { NODE_LABEL, timeAgo } from "@/lib/utils";

function StatTile({ label, value, icon: Icon, href }: { label: string; value: React.ReactNode; icon: React.ComponentType<{ className?: string }>; href?: string }) {
  const body = (
    <Card className="h-full transition-colors hover:border-gray-700">
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400"><Icon className="h-5 w-5" /></div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-gray-400">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function Overview() {
  const toast = useToast();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [requests, setRequests] = useState<AccessRequestItem[]>([]);
  const [changes, setChanges] = useState<PendingChangeRow[]>([]);
  const [taskOpen, setTaskOpen] = useState(false);

  const load = useCallback(() => {
    adminApi.stats().then(setStats).catch(() => {});
    adminApi.accessRequests().then(setRequests).catch(() => {});
    adminApi.changes().then(setChanges).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const decide = async (r: AccessRequestItem, approve: boolean) => {
    try {
      if (approve) await subjectsApi.approveAccess(r.id);
      else await subjectsApi.rejectAccess(r.id);
      toast.success(approve ? `Granted @${r.user.username} access` : "Declined");
      load();
    } catch (e) {
      toast.error(e);
    }
  };

  if (!stats) return <Spinner />;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><ShieldCheck className="h-6 w-6 text-indigo-400" /> Admin overview</h1>
          <p className="mt-1 text-sm text-gray-400">Create and publish learning content, assign it, and schedule practice for your users.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setTaskOpen(true)}><ListTodo className="mr-1 h-4 w-4" /> Assign task</Button>
          <Link href="/subjects/new"><Button><Plus className="mr-1 h-4 w-4" /> New subject</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label={`users · ${stats.admins} admin${stats.admins === 1 ? "" : "s"}`} value={stats.users} icon={Users} href="/admin/users" />
        <StatTile label={`subjects · ${stats.catalog} in catalog`} value={stats.subjects} icon={Library} href="/admin/content" />
        <StatTile label="active practice tasks" value={stats.tasks} icon={ListTodo} />
        <StatTile label="sessions done today" value={`${stats.doneToday}/${stats.dueToday}`} icon={CalendarCheck} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4 text-sky-400" /> Access requests <span className="text-sm font-normal text-gray-500">{requests.length}</span></CardTitle></CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <EmptyState icon={KeyRound} title="No pending requests" />
            ) : (
              <ul className="divide-y divide-gray-800">
                {requests.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2 py-2.5">
                    <div className="min-w-0 flex-1 text-sm">
                      <p><span className="text-gray-200">@{r.user.username}</span> <span className="text-gray-500">wants</span> <Link href={`/subjects/${r.subject?.id}`} className="text-indigo-300 hover:underline">{r.subject?.title}</Link></p>
                      {r.message && <p className="text-xs text-gray-400">“{r.message}”</p>}
                      <p className="text-[11px] text-gray-500">{timeAgo(r.createdAt)}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => decide(r, false)}>Decline</Button>
                    <Button size="sm" variant="success" onClick={() => decide(r, true)}>Grant</Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><GitPullRequest className="h-4 w-4 text-amber-400" /> Proposed changes <span className="text-sm font-normal text-gray-500">{changes.length}</span></CardTitle></CardHeader>
          <CardContent>
            {changes.length === 0 ? (
              <EmptyState icon={GitPullRequest} title="Nothing waiting for review" />
            ) : (
              <ul className="divide-y divide-gray-800">
                {changes.map((c) => (
                  <li key={c.id} className="py-2.5 text-sm">
                    <Link href={`/subjects/${c.subject.id}/manage?tab=changes`} className="text-gray-200 hover:text-indigo-300">
                      {c.action.toLowerCase()} {c.node ? `${NODE_LABEL[c.node.type].toLowerCase()} “${c.node.title}”` : "overview"} in {c.subject.title}
                    </Link>
                    <p className="text-[11px] text-gray-500">by @{c.author.username} · owner @{c.subject.owner.username} · {timeAgo(c.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <TaskFormModal open={taskOpen} onClose={() => setTaskOpen(false)} onSaved={load} />
    </div>
  );
}

export default function AdminPage() {
  return <AdminOnly><Overview /></AdminOnly>;
}
