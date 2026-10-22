"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Spinner } from "@/components/ui/field";
import { tasksApi, type PlanItem, type PlanStatus } from "@/lib/api";
import { cn, formatDay, getStatusColor } from "@/lib/utils";

const STATUS_LABEL: Record<PlanStatus, string> = {
  PENDING: "pending",
  OVERDUE: "overdue",
  IN_PROGRESS: "in progress",
  COMPLETED: "completed",
  SKIPPED: "skipped",
};

const DOT: Record<PlanStatus, string> = {
  PENDING: "bg-gray-500",
  OVERDUE: "bg-red-400",
  IN_PROGRESS: "bg-yellow-400",
  COMPLETED: "bg-emerald-400",
  SKIPPED: "bg-gray-700",
};

/** Every planned practice date of a task with its status (task details). */
export function TaskPlan({ taskId, isAssignee }: { taskId: string; isAssignee: boolean }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof tasksApi.get>> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    tasksApi.get(taskId).then(setData).catch((e) => setError(e instanceof Error ? e.message : "Could not load"));
  }, [taskId]);

  if (error) return <p className="text-xs text-red-300">{error}</p>;
  if (!data) return <Spinner />;
  const spaced = data.frequency === "SPACED";
  const s = data.planSummary;
  const done = s.COMPLETED;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
        <span className="text-gray-200">{data.scheduleLabel}</span>
        {spaced && <span>{done} of {s.total} done</span>}
        {(["OVERDUE", "PENDING", "SKIPPED"] as const).map((k) => s[k] > 0 && (
          <span key={k} className="flex items-center gap-1"><span className={cn("h-2 w-2 rounded-full", DOT[k])} /> {s[k]} {STATUS_LABEL[k]}</span>
        ))}
      </div>
      {spaced && s.total > 0 && (
        <div className="flex h-1.5 overflow-hidden rounded-full bg-gray-800">
          {data.plan.map((p) => <span key={p.date} className={cn("flex-1 border-r border-gray-950 last:border-0", DOT[p.status])} />)}
        </div>
      )}
      {!spaced && <p className="text-[11px] text-gray-500">Recent practice and the next dates.</p>}
      <div className="max-h-72 overflow-y-auto rounded-md border border-gray-800">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-900 text-[11px] text-gray-500">
            <tr>
              {spaced && <th className="px-2 py-1 text-left font-normal">#</th>}
              <th className="px-2 py-1 text-left font-normal">Date</th>
              {spaced && <th className="px-2 py-1 text-left font-normal">Day</th>}
              {spaced && <th className="px-2 py-1 text-left font-normal">Gap</th>}
              <th className="px-2 py-1 text-left font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.plan.map((p: PlanItem) => (
              <tr key={p.date} className="border-t border-gray-800/60 text-gray-300">
                {spaced && <td className="px-2 py-1 text-gray-500">{p.session ? `${p.session.n}/${p.session.of}` : "–"}</td>}
                <td className="px-2 py-1">{formatDay(p.date)}</td>
                {spaced && <td className="px-2 py-1">{p.day}</td>}
                {spaced && <td className="px-2 py-1 text-gray-500">{p.gap ? `+${p.gap}` : p.session?.n === 1 ? "start" : ""}</td>}
                <td className="px-2 py-1">
                  {isAssignee && p.occurrenceId && p.status !== "COMPLETED" && p.status !== "SKIPPED" ? (
                    <Link href={`/practice/${p.occurrenceId}`} className={cn("rounded-full px-2 py-0.5 text-[11px] hover:underline", getStatusColor(p.status))}>
                      {STATUS_LABEL[p.status]} · open
                    </Link>
                  ) : (
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px]", getStatusColor(p.status))}>{STATUS_LABEL[p.status]}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
