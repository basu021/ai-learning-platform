"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouteId } from "@/lib/route-id";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, CheckCircle2, Clock, Play, SkipForward, Square, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, Field, Spinner } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { RichView } from "@/components/editor/rich-editor";
import { Breadcrumb } from "@/components/content/breadcrumb";
import { TaskMeta } from "@/components/tasks/agenda";
import { feedbackApi, tasksApi, type FeedbackData, type OccurrenceDetail } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { cn, formatDay, formatDuration, getStatusColor, timeAgo } from "@/lib/utils";

const EMPTY = {
  whatWasDone: "",
  problemsFaced: "",
  commandsUsed: "",
  confidenceLevel: 3,
  needsImprovement: "",
  notesForTomorrow: "",
};

function FeedbackCard({ f }: { f: FeedbackData }) {
  const rows: [string, string | null][] = [
    ["What was done", f.whatWasDone],
    ["Problems", f.problemsFaced],
    ["Commands", f.commandsUsed],
    ["Improve", f.needsImprovement],
    ["Next time", f.notesForTomorrow],
  ];
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-3 text-sm">
      <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
        <span>{timeAgo(f.createdAt)}</span>
        <span className="text-yellow-300">★ {f.confidenceLevel}/5</span>
      </div>
      <dl className="space-y-1">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="grid grid-cols-[110px_1fr] gap-2">
            <dt className="text-xs text-gray-500">{k}</dt>
            <dd className={cn("text-gray-300", k === "Commands" && "font-mono text-xs text-emerald-300")}>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function PracticePage() {
  const id = useRouteId("/practice");
  const router = useRouter();
  const toast = useToast();
  const { me, refresh } = useSession();
  const [occ, setOcc] = useState<OccurrenceDetail | null>(null);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    tasksApi.occurrence(id).then(setOcc).catch((e: Error) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  const active = occ?.taskSessions.find((s) => s.status === "active");
  const priorSeconds = occ?.taskSessions.filter((s) => s.status === "completed").reduce((n, s) => n + (s.duration ?? 0), 0) ?? 0;

  useEffect(() => {
    if (!active) {
      setElapsed(priorSeconds);
      return;
    }
    const tick = () => setElapsed(priorSeconds + Math.floor((Date.now() - new Date(active.startedAt).getTime()) / 1000));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [active, priorSeconds]);

  if (error) return <Alert className="mx-auto mt-10 max-w-lg">{error}</Alert>;
  if (!occ) return <Spinner />;

  const task = occ.task;
  const mine = occ.task.assignee.id === me?.id;
  const done = occ.status === "COMPLETED" || occ.status === "SKIPPED";
  const studyHref = task.nodeId ? `/subjects/${task.subjectId}?node=${task.nodeId}` : `/subjects/${task.subjectId}`;

  const start = async () => {
    try {
      await tasksApi.start(occ.id);
      load();
    } catch (e) {
      toast.error(e);
    }
  };
  const stop = async () => {
    if (active) await tasksApi.finishSession(active.id).catch(() => {});
    setShowForm(true);
    load();
  };
  const skip = async () => {
    if (!confirm("Skip this practice for today?")) return;
    try {
      await tasksApi.skip(occ.id);
      toast.info("Skipped");
      router.push("/tasks");
    } catch (e) {
      toast.error(e);
    }
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await feedbackApi.create({ occurrenceId: occ.id, ...form });
      toast.success(`Completed! +${task.xpReward} XP`);
      setShowForm(false);
      void refresh();
      load();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href="/tasks" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200">
        <ArrowLeft className="h-4 w-4" /> Practice
      </Link>

      <div className="space-y-3 rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <Breadcrumb items={task.breadcrumb} subjectId={task.subjectId} />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-100">{task.title}</h1>
            <div className="mt-2"><TaskMeta task={task} /></div>
          </div>
          <div className="text-right">
            <span className={cn("rounded-full px-2.5 py-1 text-xs", getStatusColor(occ.status))}>
              {occ.status.replace("_", " ").toLowerCase()}
            </span>
            <p className="mt-2 text-xs text-gray-500">Due {formatDay(occ.dueDate)}</p>
            {occ.session && <p className="mt-1 text-xs text-indigo-300">Practice {occ.session.n} of {occ.session.of}</p>}
          </div>
        </div>
        <Link href={studyHref} className="inline-flex items-center gap-1.5 text-sm text-indigo-400 hover:underline">
          <BookOpen className="h-4 w-4" /> Open study material
        </Link>
      </div>

      {task.instructions && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-300">Instructions</h2>
          <RichView html={task.instructions} />
        </div>
      )}

      {mine && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-5">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-indigo-400" />
            <div>
              <p className="font-mono text-3xl font-bold">{formatDuration(elapsed)}</p>
              <p className="text-xs text-gray-500">{active ? "In progress" : "Time spent"}</p>
            </div>
          </div>
          {done ? (
            <span className="flex items-center gap-1.5 text-sm text-emerald-300">
              <CheckCircle2 className="h-5 w-5" /> {occ.status === "COMPLETED" ? "Completed" : "Skipped"}
            </span>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={skip}><SkipForward className="mr-1 h-4 w-4" /> Skip</Button>
              {active ? (
                <Button variant="destructive" onClick={stop}><Square className="mr-1 h-4 w-4" /> Finish</Button>
              ) : (
                <>
                  {!showForm && <Button variant="outline" onClick={() => setShowForm(true)}>Log without timer</Button>}
                  <Button onClick={start}><Play className="mr-1 h-4 w-4" /> {occ.status === "IN_PROGRESS" ? "Resume" : "Start"}</Button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {mine && showForm && !done && (
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-indigo-500/30 bg-gray-900/60 p-5">
          <h2 className="font-semibold">How did it go?</h2>
          <Field label="What did you do?">
            <Textarea value={form.whatWasDone} onChange={(e) => setForm({ ...form, whatWasDone: e.target.value })} rows={3} />
          </Field>
          <Field label="Problems faced">
            <Textarea value={form.problemsFaced} onChange={(e) => setForm({ ...form, problemsFaced: e.target.value })} rows={2} />
          </Field>
          <Field label="Commands used">
            <Input value={form.commandsUsed} onChange={(e) => setForm({ ...form, commandsUsed: e.target.value })} className="font-mono" placeholder="lvextend -r -L +1G /dev/vg0/data" />
          </Field>
          <Field label={`Confidence: ${form.confidenceLevel}/5`}>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setForm({ ...form, confidenceLevel: n })}
                  className={cn(
                    "h-10 w-10 rounded-lg border",
                    n <= form.confidenceLevel ? "border-yellow-500/50 bg-yellow-500/20 text-yellow-400" : "border-gray-700 text-gray-600",
                  )}
                  aria-label={`${n} stars`}
                >
                  <Star className="mx-auto h-4 w-4" />
                </button>
              ))}
            </div>
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="What needs improvement?">
              <Textarea value={form.needsImprovement} onChange={(e) => setForm({ ...form, needsImprovement: e.target.value })} rows={2} />
            </Field>
            <Field label="Notes for next time">
              <Textarea value={form.notesForTomorrow} onChange={(e) => setForm({ ...form, notesForTomorrow: e.target.value })} rows={2} />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" variant="success" disabled={busy}>{busy ? "Saving…" : "Complete practice"}</Button>
          </div>
        </form>
      )}

      {occ.feedback.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-300">This session</h2>
          {occ.feedback.map((f) => <FeedbackCard key={f.id} f={f} />)}
        </section>
      )}
      {occ.previousFeedback.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-300">Earlier notes on this task</h2>
          {occ.previousFeedback.map((f) => <FeedbackCard key={f.id} f={f} />)}
        </section>
      )}
    </div>
  );
}
