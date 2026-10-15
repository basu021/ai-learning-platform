import Link from "next/link";
import { CheckCircle2, Play, Repeat, ShieldCheck, Clock } from "lucide-react";
import type { OccurrenceItem, TaskLite } from "@/lib/api";
import { Breadcrumb } from "@/components/content/breadcrumb";
import { cn, formatDay, getDifficultyColor, getStatusColor } from "@/lib/utils";

export function TaskMeta({ task }: { task: TaskLite }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
      <span className="flex items-center gap-1"><Repeat className="h-3 w-3" /> {task.scheduleLabel}</span>
      <span className={getDifficultyColor(task.difficulty)}>{task.difficulty}</span>
      {task.estimatedMins && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {task.estimatedMins} min</span>}
      <span>{task.xpReward} XP</span>
      {task.assignedByOther && (
        <span className="flex items-center gap-1 text-indigo-300"><ShieldCheck className="h-3 w-3" /> from @{task.createdBy.username}</span>
      )}
    </div>
  );
}

export function OccurrenceRow({ item, showDate }: { item: OccurrenceItem; showDate?: boolean }) {
  const done = item.status === "COMPLETED" || item.status === "SKIPPED";
  return (
    <div className={cn("flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-900/40 p-3 transition-colors hover:border-gray-700", done && "opacity-60")}>
      <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: item.task.subject.color || "#6366f1" }} />
      <div className="min-w-0 flex-1 space-y-1">
        <Link href={`/practice/${item.id}`} className="block truncate text-sm font-medium text-gray-100 hover:text-indigo-300">
          {item.task.title}
        </Link>
        <Breadcrumb items={item.task.breadcrumb} linked={false} />
        <TaskMeta task={item.task} />
      </div>
      {showDate && <span className="hidden shrink-0 text-xs text-red-300 sm:block">{formatDay(item.dueDate)}</span>}
      <span className={cn("hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] sm:inline", getStatusColor(item.status))}>
        {item.status.replace("_", " ").toLowerCase()}
      </span>
      {done ? (
        <CheckCircle2 className={cn("h-5 w-5 shrink-0", item.status === "COMPLETED" ? "text-emerald-400" : "text-gray-600")} />
      ) : (
        <Link
          href={`/practice/${item.id}`}
          className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-indigo-600 px-3 text-xs font-medium text-white hover:bg-indigo-700"
        >
          <Play className="h-3 w-3" /> {item.status === "IN_PROGRESS" ? "Resume" : "Start"}
        </Link>
      )}
    </div>
  );
}

export function UpcomingList({ items }: { items: { dueDate: string; task: TaskLite }[] }) {
  const byDay = new Map<string, TaskLite[]>();
  items.forEach((u) => byDay.set(u.dueDate, [...(byDay.get(u.dueDate) ?? []), u.task]));
  return (
    <div className="space-y-4">
      {[...byDay.entries()].map(([day, tasks]) => (
        <div key={day}>
          <p className="mb-1.5 text-xs font-semibold text-gray-400">{formatDay(day)}</p>
          <div className="space-y-1.5">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-lg border border-gray-800/70 px-3 py-2">
                <span className="h-6 w-1 shrink-0 rounded-full" style={{ background: t.subject.color || "#6366f1" }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-gray-200">{t.title}</p>
                  <Breadcrumb items={t.breadcrumb} linked={false} />
                </div>
                <span className="hidden text-[11px] text-gray-500 sm:block">{t.scheduleLabel}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
