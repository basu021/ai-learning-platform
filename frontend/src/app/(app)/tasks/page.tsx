"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, ListTodo, Plus, AlertTriangle, CheckCircle2, Pencil, Trash2, Pause, Play as PlayIcon, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, Spinner, Tabs } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { TaskFormModal } from "@/components/tasks/task-form";
import { OccurrenceRow, TaskMeta, UpcomingList } from "@/components/tasks/agenda";
import { Breadcrumb } from "@/components/content/breadcrumb";
import { tasksApi, type Agenda, type OccurrenceItem, type TaskDetail } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { cn, formatDay } from "@/lib/utils";

type Tab = "agenda" | "upcoming" | "mine" | "assigned" | "history";

function TaskDefinitions({ scope, onEdit, refreshKey }: { scope: "mine" | "assigned"; onEdit: (t: TaskDetail) => void; refreshKey: number }) {
  const toast = useToast();
  const [items, setItems] = useState<TaskDetail[] | null>(null);
  const load = useCallback(() => {
    tasksApi.list({ scope }).then(setItems).catch(() => setItems([]));
  }, [scope]);
  useEffect(load, [load, refreshKey]);

  if (!items) return <Spinner />;
  if (!items.length) {
    return (
      <EmptyState icon={ListTodo} title={scope === "mine" ? "No practice tasks yet" : "You haven't assigned any tasks"}>
        {scope === "mine" && "Open any subject, chapter or topic and choose “Practice this”, or use New task above."}
      </EmptyState>
    );
  }

  const toggle = async (t: TaskDetail) => {
    try {
      await tasksApi.update(t.id, { active: !t.active });
      load();
    } catch (e) {
      toast.error(e);
    }
  };
  const remove = async (t: TaskDetail) => {
    if (!confirm(`Delete "${t.title}"? Its completed history is kept.`)) return;
    try {
      await tasksApi.remove(t.id);
      load();
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <div className="space-y-2">
      {items.map((t) => (
        <div key={t.id} className={cn("flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-900/40 p-3", !t.active && "opacity-60")}>
          <span className="h-10 w-1 shrink-0 rounded-full" style={{ background: t.subject.color || "#6366f1" }} />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate text-sm font-medium text-gray-100">
              {t.title}
              {!t.active && <span className="ml-2 text-xs text-gray-500">(paused)</span>}
            </p>
            <Breadcrumb items={t.breadcrumb} />
            <TaskMeta task={t} />
          </div>
          <div className="hidden shrink-0 text-right text-[11px] text-gray-500 md:block">
            {scope === "assigned" && <p className="text-gray-300">@{t.assignee.username}</p>}
            <p>{t.completedCount ?? 0} done</p>
            {t.nextDue && <p>next {formatDay(t.nextDue)}</p>}
          </div>
          {t.canEdit ? (
            <div className="flex shrink-0 gap-1">
              <Button size="sm" variant="ghost" onClick={() => toggle(t)} title={t.active ? "Pause" : "Resume"}>
                {t.active ? <Pause className="h-3.5 w-3.5" /> : <PlayIcon className="h-3.5 w-3.5" />}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onEdit(t)} title="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="ghost" onClick={() => remove(t)} title="Delete"><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>
            </div>
          ) : (
            <span className="shrink-0 text-[11px] text-gray-500" title="Only the person who assigned it can change it">assigned</span>
          )}
        </div>
      ))}
    </div>
  );
}

function HistoryList() {
  const [items, setItems] = useState<(OccurrenceItem & { confidence: number | null })[] | null>(null);
  useEffect(() => {
    tasksApi.history().then(setItems).catch(() => setItems([]));
  }, []);
  if (!items) return <Spinner />;
  if (!items.length) return <EmptyState icon={History} title="Nothing completed yet" />;
  return (
    <div className="space-y-2">
      {items.map((o) => (
        <div key={o.id} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-xs text-gray-500">{formatDay(o.dueDate)}</span>
          <div className="flex-1"><OccurrenceRow item={o} /></div>
          {o.confidence !== null && <span className="w-14 shrink-0 text-xs text-yellow-300">★ {o.confidence}/5</span>}
        </div>
      ))}
    </div>
  );
}

export default function TasksPage() {
  const { isAdmin } = useSession();
  const [tab, setTab] = useState<Tab>("agenda");
  const [agenda, setAgenda] = useState<Agenda | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TaskDetail | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadAgenda = useCallback(() => {
    tasksApi.agenda().then(setAgenda).catch(() => {});
  }, []);
  useEffect(loadAgenda, [loadAgenda, refreshKey]);

  const saved = () => setRefreshKey((k) => k + 1);
  const todayOpen = agenda?.todayItems.filter((o) => o.status === "PENDING" || o.status === "IN_PROGRESS").length ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ListTodo className="h-6 w-6 text-indigo-400" /> Practice
          </h1>
          <p className="mt-1 text-sm text-gray-400">Your scheduled practice, by subject, chapter, topic or subtopic.</p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="mr-1 h-4 w-4" /> New task
        </Button>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "agenda", label: "Today", count: (agenda?.overdue.length ?? 0) + todayOpen },
          { value: "upcoming", label: "Upcoming" },
          { value: "mine", label: "My tasks" },
          ...(isAdmin ? [{ value: "assigned" as Tab, label: "Assigned by me" }] : []),
          { value: "history", label: "History" },
        ]}
      />

      {tab === "agenda" &&
        (!agenda ? (
          <Spinner />
        ) : (
          <div className="space-y-6">
            {agenda.overdue.length > 0 && (
              <section>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-300">
                  <AlertTriangle className="h-4 w-4" /> Overdue <span className="font-normal text-gray-500">{agenda.overdue.length}</span>
                </h2>
                <div className="space-y-2">
                  {agenda.overdue.map((o) => <OccurrenceRow key={o.id} item={o} showDate />)}
                </div>
              </section>
            )}
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-300">
                <CalendarDays className="h-4 w-4 text-indigo-400" /> {formatDay(agenda.today)}
              </h2>
              {agenda.todayItems.length === 0 ? (
                <EmptyState icon={CheckCircle2} title="Nothing scheduled today">
                  Add a task, or check Upcoming for what&apos;s next.
                </EmptyState>
              ) : (
                <div className="space-y-2">
                  {agenda.todayItems.map((o) => <OccurrenceRow key={o.id} item={o} />)}
                </div>
              )}
            </section>
          </div>
        ))}
      {tab === "upcoming" &&
        (!agenda ? <Spinner /> : agenda.upcoming.length === 0 ? <EmptyState icon={CalendarDays} title="Nothing in the next 14 days" /> : <UpcomingList items={agenda.upcoming} />)}
      {(tab === "mine" || tab === "assigned") && (
        <TaskDefinitions scope={tab} refreshKey={refreshKey} onEdit={(t) => { setEditing(t); setFormOpen(true); }} />
      )}
      {tab === "history" && <HistoryList />}

      <TaskFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={saved} task={editing} />
    </div>
  );
}
