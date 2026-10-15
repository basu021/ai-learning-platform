"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, Field, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { RichEditor } from "@/components/editor/rich-editor";
import { flattenOutline } from "@/components/content/outline-tree";
import { UserPicker } from "@/components/users/user-picker";
import {
  subjectsApi,
  tasksApi,
  type Frequency,
  type OutlineNode,
  type ScheduleInput,
  type SubjectListItem,
  type TaskDetail,
  type UserSummary,
} from "@/lib/api";
import { useSession } from "@/lib/auth";
import { cn, localDate, NODE_LABEL } from "@/lib/utils";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FREQS: { value: Frequency; label: string }[] = [
  { value: "ONCE", label: "Once" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "CUSTOM", label: "Every N days" },
];

export function ScheduleFields({
  value,
  onChange,
}: {
  value: ScheduleInput;
  onChange: (s: ScheduleInput) => void;
}) {
  const set = (patch: Partial<ScheduleInput>) => onChange({ ...value, ...patch });
  const weekdays = value.weekdays ?? [];
  return (
    <div className="space-y-3 rounded-lg border border-gray-800 bg-gray-950/40 p-3">
      <div className="flex flex-wrap gap-1">
        {FREQS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() =>
              set({
                frequency: f.value,
                weekdays: f.value === "WEEKLY" && !weekdays.length ? [new Date(`${value.startDate}T00:00:00`).getDay()] : value.weekdays,
                intervalDays: f.value === "CUSTOM" ? value.intervalDays ?? 2 : value.intervalDays,
                monthDay: f.value === "MONTHLY" ? value.monthDay ?? Number(value.startDate.slice(8, 10)) : value.monthDay,
              })
            }
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-medium",
              value.frequency === f.value
                ? "border-indigo-500/60 bg-indigo-500/15 text-indigo-200"
                : "border-gray-700 text-gray-400 hover:text-gray-200",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {value.frequency === "WEEKLY" && (
        <div>
          <p className="mb-1.5 text-xs text-gray-400">Repeat on</p>
          <div className="flex flex-wrap gap-1">
            {DAYS.map((d, i) => {
              const on = weekdays.includes(i);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => set({ weekdays: on ? weekdays.filter((x) => x !== i) : [...weekdays, i].sort() })}
                  className={cn(
                    "h-8 w-11 rounded-md border text-xs",
                    on ? "border-indigo-500/60 bg-indigo-500/20 text-indigo-200" : "border-gray-700 text-gray-400",
                  )}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {value.frequency === "MONTHLY" && (
        <Field label="Day of month" hint="Months without this day use their last day.">
          <Input type="number" min={1} max={31} value={value.monthDay ?? 1} onChange={(e) => set({ monthDay: Number(e.target.value) })} className="w-28" />
        </Field>
      )}
      {value.frequency === "CUSTOM" && (
        <Field label="Repeat every">
          <div className="flex items-center gap-2">
            <Input type="number" min={1} max={365} value={value.intervalDays ?? 2} onChange={(e) => set({ intervalDays: Number(e.target.value) })} className="w-24" />
            <span className="text-sm text-gray-400">days</span>
          </div>
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={value.frequency === "ONCE" ? "Date" : "Starts"}>
          <Input type="date" value={value.startDate} onChange={(e) => set({ startDate: e.target.value })} required />
        </Field>
        {value.frequency !== "ONCE" && (
          <Field label="Ends (optional)">
            <Input type="date" value={value.endDate ?? ""} min={value.startDate} onChange={(e) => set({ endDate: e.target.value || null })} />
          </Field>
        )}
      </div>
    </div>
  );
}

export interface TaskFormDefaults {
  subjectId?: string;
  nodeId?: string | null;
  assignees?: UserSummary[];
}

export function TaskFormModal({
  open,
  onClose,
  onSaved,
  defaults,
  task,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  defaults?: TaskFormDefaults;
  /** Edit mode when provided. */
  task?: TaskDetail | null;
}) {
  const { me, isAdmin } = useSession();
  const toast = useToast();
  const editing = !!task;
  const [subjects, setSubjects] = useState<SubjectListItem[]>([]);
  const [outline, setOutline] = useState<OutlineNode[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [nodeId, setNodeId] = useState("");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [difficulty, setDifficulty] = useState("beginner");
  const [estimatedMins, setEstimatedMins] = useState<number | "">(30);
  const [xpReward, setXpReward] = useState(10);
  const [schedule, setSchedule] = useState<ScheduleInput>({ frequency: "DAILY", startDate: localDate() });
  const [assignees, setAssignees] = useState<UserSummary[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset whenever the modal opens.
  useEffect(() => {
    if (!open) return;
    setError("");
    if (task) {
      setSubjectId(task.subjectId);
      setNodeId(task.nodeId ?? "");
      setTitle(task.title);
      setInstructions(task.instructions ?? "");
      setDifficulty(task.difficulty);
      setEstimatedMins(task.estimatedMins ?? "");
      setXpReward(task.xpReward);
      setSchedule({
        frequency: task.frequency,
        weekdays: task.weekdays,
        monthDay: task.monthDay ?? undefined,
        intervalDays: task.intervalDays ?? undefined,
        startDate: task.startDate,
        endDate: task.endDate,
      });
    } else {
      setSubjectId(defaults?.subjectId ?? "");
      setNodeId(defaults?.nodeId ?? "");
      setTitle("");
      setInstructions("");
      setDifficulty("beginner");
      setEstimatedMins(30);
      setXpReward(10);
      setSchedule({ frequency: "DAILY", startDate: localDate() });
      setAssignees(defaults?.assignees ?? []);
    }
    // Only reset when the modal opens or switches task, not on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id]);

  useEffect(() => {
    if (!open || editing) return;
    subjectsApi
      .list({ scope: isAdmin ? "all" : "library" })
      .then((list) => setSubjects(list.filter((s) => s.access.hasAccess || isAdmin)))
      .catch(() => {});
  }, [open, editing, isAdmin]);

  useEffect(() => {
    if (!open || !subjectId) {
      setOutline([]);
      return;
    }
    subjectsApi.get(subjectId).then((s) => setOutline(s.outline)).catch(() => setOutline([]));
  }, [open, subjectId]);

  const flat = useMemo(() => flattenOutline(outline), [outline]);
  const forOthers = assignees.some((a) => a.id !== me?.id);

  const submit = async () => {
    setSaving(true);
    setError("");
    const body = {
      nodeId: nodeId || null,
      title,
      instructions,
      difficulty,
      estimatedMins: estimatedMins === "" ? undefined : estimatedMins,
      xpReward,
      // Send only the fields that belong to the chosen frequency.
      schedule: {
        frequency: schedule.frequency,
        startDate: schedule.startDate,
        endDate: schedule.endDate,
        weekdays: schedule.frequency === "WEEKLY" ? schedule.weekdays : undefined,
        monthDay: schedule.frequency === "MONTHLY" ? schedule.monthDay : undefined,
        intervalDays: schedule.frequency === "CUSTOM" ? schedule.intervalDays : undefined,
      },
    };
    try {
      if (task) {
        await tasksApi.update(task.id, body);
        toast.success("Task updated");
      } else {
        await tasksApi.create({
          ...body,
          subjectId,
          assignees: assignees.length ? assignees.map((a) => a.username) : undefined,
        });
        toast.success(forOthers ? `Assigned to ${assignees.length} user${assignees.length > 1 ? "s" : ""}` : "Task scheduled");
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={editing ? "Edit task" : "New practice task"}
      description="Practise a whole subject or any chapter, topic or subtopic on a schedule."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !subjectId || title.trim().length < 2}>
            {saving ? "Saving…" : editing ? "Save changes" : forOthers ? "Assign task" : "Create task"}
          </Button>
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {error && <Alert>{error}</Alert>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Subject *">
              <Select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setNodeId(""); }} disabled={editing}>
                <option value="">Choose a subject…</option>
                {editing && task && <option value={task.subjectId}>{task.subject.title}</option>}
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}{isAdmin && !s.access.isOwner ? ` (@${s.owner.username})` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="What to practise">
              <Select value={nodeId} onChange={(e) => setNodeId(e.target.value)} disabled={!subjectId}>
                <option value="">Whole subject</option>
                {flat
                  .filter(({ node }) => !node.locked)
                  .map(({ node, depth }) => (
                    <option key={node.id} value={node.id}>
                      {"  ".repeat(depth * 2)}
                      {NODE_LABEL[node.type]}: {node.title}
                    </option>
                  ))}
              </Select>
            </Field>
          </div>
          <Field label="Task title *">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Extend a logical volume online and grow the filesystem" />
          </Field>
          <Field label="Instructions">
            <RichEditor
              value={instructions}
              onChange={setInstructions}
              minHeight={160}
              placeholder="Steps, expected outcome, commands to try, how to verify…"
              onUploadImage={
                subjectId
                  ? async (file) => (await subjectsApi.uploadAttachment(subjectId, file, { inline: true })).url
                  : undefined
              }
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Difficulty">
              <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                {["beginner", "intermediate", "advanced", "expert"].map((d) => (
                  <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>
                ))}
              </Select>
            </Field>
            <Field label="Minutes">
              <Input type="number" min={1} max={1440} value={estimatedMins} onChange={(e) => setEstimatedMins(e.target.value ? Number(e.target.value) : "")} />
            </Field>
            <Field label="XP">
              <Input type="number" min={0} max={1000} value={xpReward} onChange={(e) => setXpReward(Number(e.target.value))} />
            </Field>
          </div>
        </div>

        <div className="space-y-4">
          <Field label="Schedule">
            <ScheduleFields value={schedule} onChange={setSchedule} />
          </Field>
          {isAdmin && !editing && (
            <Field label="Assign to" hint="Leave empty to schedule it for yourself. Assignees get view access to the subject automatically.">
              <UserPicker value={assignees} onChange={setAssignees} placeholder="Search username…" />
            </Field>
          )}
          {editing && task?.assignedByOther && (
            <Alert tone="info">Assigned to @{task.assignee.username}. Changing the schedule re-plans from today; completed practice is kept.</Alert>
          )}
        </div>
      </div>
    </Modal>
  );
}
