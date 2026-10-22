"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/field";
import { SessionBadge } from "@/components/tasks/agenda";
import { tasksApi, type CalendarItem } from "@/lib/api";
import { addDays, cn, formatDay, getStatusColor, localDate } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The 6-week grid that shows `month` ("YYYY-MM"), Sunday first. */
function gridOf(month: string) {
  const first = `${month}-01`;
  const start = addDays(first, -new Date(`${first}T00:00:00Z`).getUTCDay());
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

function shiftMonth(month: string, n: number) {
  const d = new Date(`${month}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
}

/** Month view of the signed-in user's practice: done, overdue, due and planned. */
export function PracticeCalendar() {
  const [month, setMonth] = useState(localDate().slice(0, 7));
  const [items, setItems] = useState<CalendarItem[] | null>(null);
  const [today, setToday] = useState(localDate());
  const [selected, setSelected] = useState<string | null>(localDate());
  const days = useMemo(() => gridOf(month), [month]);

  useEffect(() => {
    setItems(null);
    tasksApi
      .calendar(days[0], days[days.length - 1])
      .then((r) => {
        setItems(r.items);
        setToday(r.today);
      })
      .catch(() => setItems([]));
  }, [days]);

  const byDay = useMemo(() => {
    const m = new Map<string, CalendarItem[]>();
    (items ?? []).forEach((i) => m.set(i.date, [...(m.get(i.date) ?? []), i]));
    return m;
  }, [items]);
  const title = new Date(`${month}-01T00:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const picked = selected ? byDay.get(selected) ?? [] : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-200">{title}</h2>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setMonth(shiftMonth(month, -1))} title="Previous month"><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => { setMonth(localDate().slice(0, 7)); setSelected(localDate()); }}>Today</Button>
          <Button size="sm" variant="ghost" onClick={() => setMonth(shiftMonth(month, 1))} title="Next month"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="relative">
        {!items && <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-950/40"><Spinner /></div>}
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-gray-800 bg-gray-800 text-xs">
          {WEEKDAYS.map((d) => (
            <div key={d} className="bg-gray-900 py-1 text-center text-[11px] text-gray-500">{d}</div>
          ))}
          {days.map((d) => {
            const list = byDay.get(d) ?? [];
            const inMonth = d.startsWith(month);
            return (
              <button
                key={d}
                type="button"
                onClick={() => setSelected(d)}
                className={cn(
                  "flex min-h-16 flex-col items-stretch gap-0.5 bg-gray-950 p-1 text-left sm:min-h-20",
                  !inMonth && "opacity-40",
                  selected === d && "ring-1 ring-inset ring-indigo-500",
                )}
              >
                <span className={cn("self-end rounded px-1 text-[11px]", d === today ? "bg-indigo-600 text-white" : "text-gray-400")}>
                  {Number(d.slice(8))}
                </span>
                {list.slice(0, 3).map((i, k) => (
                  <span key={k} className={cn("truncate rounded px-1 text-[10px]", getStatusColor(i.status))}>
                    <span className="hidden sm:inline">{i.task.title}</span>
                    <span className="sm:hidden">•</span>
                  </span>
                ))}
                {list.length > 3 && <span className="text-[10px] text-gray-500">+{list.length - 3} more</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] text-gray-500">
        {(["COMPLETED", "OVERDUE", "PENDING", "SKIPPED"] as const).map((s) => (
          <span key={s} className="flex items-center gap-1">
            <span className={cn("h-2.5 w-2.5 rounded-sm", getStatusColor(s))} /> {s.toLowerCase()}
          </span>
        ))}
      </div>

      {selected && (
        <section>
          <h3 className="mb-2 text-xs font-semibold text-gray-400">{formatDay(selected)}</h3>
          {picked.length === 0 ? (
            <p className="text-xs text-gray-500">No practice on this day.</p>
          ) : (
            <div className="space-y-1.5">
              {picked.map((i, k) => (
                <div key={k} className="flex items-center gap-3 rounded-lg border border-gray-800/70 px-3 py-2">
                  <span className="h-6 w-1 shrink-0 rounded-full" style={{ background: i.task.subject.color || "#6366f1" }} />
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    {i.occurrenceId ? (
                      <Link href={`/practice/${i.occurrenceId}`} className="truncate text-sm text-gray-200 hover:text-indigo-300">{i.task.title}</Link>
                    ) : (
                      <span className="truncate text-sm text-gray-200">{i.task.title}</span>
                    )}
                    <SessionBadge session={i.session} />
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px]", getStatusColor(i.status))}>{i.status.replace("_", " ").toLowerCase()}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
