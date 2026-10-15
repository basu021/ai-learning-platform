"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ListPlus, Library, KeyRound, Shield, UserX, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner, Tabs } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { AdminOnly } from "@/components/layout/admin-only";
import { TaskFormModal } from "@/components/tasks/task-form";
import { TaskMeta } from "@/components/tasks/agenda";
import { Breadcrumb } from "@/components/content/breadcrumb";
import { AccessBadge, VisibilityBadge } from "@/components/content/badges";
import { adminApi, tasksApi, type AdminUserDetail, type OccurrenceItem, type TaskDetail } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { formatDay, timeAgo } from "@/lib/utils";

type Tab = "subjects" | "tasks" | "history";

function Detail() {
  const { id } = useParams<{ id: string }>();
  const { me } = useSession();
  const toast = useToast();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [tasks, setTasks] = useState<TaskDetail[]>([]);
  const [history, setHistory] = useState<(OccurrenceItem & { confidence: number | null })[]>([]);
  const [tab, setTab] = useState<Tab>("subjects");
  const [taskOpen, setTaskOpen] = useState(false);
  const [editing, setEditing] = useState<TaskDetail | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState("");

  const load = useCallback(() => {
    adminApi.user(id).then(setUser).catch(toast.error);
    tasksApi.list({ scope: "all", assigneeId: id }).then(setTasks).catch(() => {});
    tasksApi.history(id).then(setHistory).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(load, [load]);

  const update = async (data: Parameters<typeof adminApi.updateUser>[1], msg: string) => {
    try {
      await adminApi.updateUser(id, data);
      toast.success(msg);
      load();
    } catch (e) {
      toast.error(e);
    }
  };

  if (!user) return <Spinner />;
  const self = user.id === me?.id;

  return (
    <div className="space-y-5">
      <Link href="/admin/users" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200"><ArrowLeft className="h-4 w-4" /> Users</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{user.name}</h1>
          <p className="text-sm text-gray-400">@{user.username} · {user.email} · Level {user.level} · {user.totalXp} XP · {user.streak}-day streak</p>
          {!user.active && <p className="mt-1 text-sm text-red-400">Deactivated — can&apos;t sign in.</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { setEditing(null); setTaskOpen(true); }}><ListPlus className="mr-1 h-4 w-4" /> Assign task</Button>
          <Button variant="outline" onClick={() => setPwOpen(true)}><KeyRound className="mr-1 h-4 w-4" /> Reset password</Button>
          {!self && (
            <>
              <Button variant="outline" onClick={() => update({ role: user.role === "ADMIN" ? "USER" : "ADMIN" }, "Role updated")}>
                <Shield className="mr-1 h-4 w-4" /> {user.role === "ADMIN" ? "Make learner" : "Make admin"}
              </Button>
              <Button variant={user.active ? "destructive" : "success"} onClick={() => update({ active: !user.active }, user.active ? "Deactivated" : "Reactivated")}>
                {user.active ? <UserX className="mr-1 h-4 w-4" /> : <UserCheck className="mr-1 h-4 w-4" />}
                {user.active ? "Deactivate" : "Reactivate"}
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "subjects", label: `Subjects (${user.owned.length + user.memberships.length})` },
          { value: "tasks", label: `Practice tasks (${tasks.length})` },
          { value: "history", label: "Recent practice" },
        ]}
      />

      {tab === "subjects" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <h3 className="mb-2 text-sm font-semibold text-gray-300">Their own subjects</h3>
            {user.owned.length === 0 ? <p className="text-sm text-gray-500">None</p> : (
              <ul className="divide-y divide-gray-800 rounded-xl border border-gray-800">
                {user.owned.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                    <Link href={`/subjects/${s.id}`} className="flex-1 truncate text-gray-200 hover:text-indigo-300">{s.title}</Link>
                    <VisibilityBadge value={s.visibility} />
                    <span className="text-[11px] text-gray-500">{timeAgo(s.updatedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3 className="mb-2 text-sm font-semibold text-gray-300">Shared with / assigned to them</h3>
            {user.memberships.length === 0 ? (
              <p className="text-sm text-gray-500">None. Assign a subject from its Manage → Assign tab.</p>
            ) : (
              <ul className="divide-y divide-gray-800 rounded-xl border border-gray-800">
                {user.memberships.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                    <Link href={`/subjects/${m.subject.id}`} className="flex-1 truncate text-gray-200 hover:text-indigo-300">{m.subject.title}</Link>
                    <AccessBadge role={m.role} />
                    <span className="text-[11px] text-gray-500">by @{m.grantedBy?.username ?? "?"}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/admin/content" className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-400 hover:underline"><Library className="h-3 w-3" /> Browse all content to assign</Link>
          </section>
        </div>
      )}

      {tab === "tasks" && (
        <div className="space-y-2">
          {tasks.length === 0 && <p className="text-sm text-gray-500">No practice tasks.</p>}
          {tasks.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-900/40 p-3">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium text-gray-100">{t.title}{!t.active && <span className="ml-2 text-xs text-gray-500">(paused)</span>}</p>
                <Breadcrumb items={t.breadcrumb} />
                <TaskMeta task={t} />
              </div>
              <div className="hidden text-right text-[11px] text-gray-500 sm:block">
                <p>{t.completedCount ?? 0} done</p>
                {t.nextDue && <p>next {formatDay(t.nextDue)}</p>}
              </div>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(t); setTaskOpen(true); }}>Edit</Button>
            </div>
          ))}
        </div>
      )}

      {tab === "history" && (
        <ul className="divide-y divide-gray-800 rounded-xl border border-gray-800">
          {history.length === 0 && <li className="px-4 py-6 text-center text-sm text-gray-500">No completed practice yet.</li>}
          {history.map((h) => (
            <li key={h.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="w-24 shrink-0 text-xs text-gray-500">{formatDay(h.dueDate)}</span>
              <span className="min-w-0 flex-1 truncate">{h.task.title}</span>
              <span className={h.status === "COMPLETED" ? "text-xs text-emerald-300" : "text-xs text-gray-500"}>{h.status.toLowerCase()}</span>
              {h.confidence !== null && <span className="text-xs text-yellow-300">★ {h.confidence}</span>}
            </li>
          ))}
        </ul>
      )}

      <TaskFormModal
        open={taskOpen}
        onClose={() => setTaskOpen(false)}
        onSaved={load}
        task={editing}
        defaults={{ assignees: [{ id: user.id, name: user.name, username: user.username }] }}
      />
      <Modal
        open={pwOpen}
        onClose={() => setPwOpen(false)}
        size="sm"
        title={`Reset password for @${user.username}`}
        footer={<><Button variant="ghost" onClick={() => setPwOpen(false)}>Cancel</Button><Button disabled={pw.length < 6} onClick={async () => { await update({ password: pw }, "Password reset"); setPw(""); setPwOpen(false); }}>Set password</Button></>}
      >
        <Input value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password (min 6 characters)" />
      </Modal>
    </div>
  );
}

export default function AdminUserPage() {
  return <AdminOnly><Detail /></AdminOnly>;
}
