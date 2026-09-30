"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  SendHorizonal,
  RefreshCw,
  ShieldCheck,
  Plus,
  Trash2,
  CheckCircle2,
  Users as UsersIcon,
} from "lucide-react";
import { adminApi, authApi } from "@/lib/api";
import type { AdminUserData, AssignContentInput } from "@/lib/api";
import { REPEAT_INTERVAL_OPTIONS } from "@/lib/utils";

interface TaskRow {
  title: string;
  description: string;
  difficulty: string;
  taskType: string;
  estimatedMins: string;
  xpReward: string;
  repeatIntervalHours: string;
}

const emptyTask = (): TaskRow => ({
  title: "",
  description: "",
  difficulty: "beginner",
  taskType: "practice",
  estimatedMins: "",
  xpReward: "",
  repeatIntervalHours: "0",
});

export default function AdminAssignPage() {
  const [users, setUsers] = useState<AdminUserData[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [subjectName, setSubjectName] = useState("");
  const [subjectDescription, setSubjectDescription] = useState("");
  const [topicName, setTopicName] = useState("");
  const [subtopicName, setSubtopicName] = useState("");
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkedAuth, setCheckedAuth] = useState(false);

  useEffect(() => {
    authApi
      .profile()
      .then((profile) => {
        setIsAdmin(profile.role === "admin");
        if (profile.role === "admin") {
          adminApi.listUsers({ role: "user" }).then(setUsers).catch(() => {}).finally(() => setLoading(false));
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false))
      .finally(() => setCheckedAuth(true));
  }, []);

  const toggleUser = (id: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addTaskRow = () => setTasks((prev) => [...prev, emptyTask()]);
  const removeTaskRow = (idx: number) => setTasks((prev) => prev.filter((_, i) => i !== idx));
  const updateTaskRow = (idx: number, field: keyof TaskRow, value: string) => {
    setTasks((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    setError(null);

    if (selectedUserIds.size === 0) {
      setError("Select at least one student.");
      return;
    }

    const payload: AssignContentInput = {
      userIds: Array.from(selectedUserIds),
      subjectName,
      subjectDescription: subjectDescription || undefined,
      topicName: topicName || undefined,
      subtopicName: subtopicName || undefined,
      tasks: tasks.length
        ? tasks
            .filter((t) => t.title.trim() && t.description.trim())
            .map((t) => ({
              title: t.title,
              description: t.description,
              difficulty: t.difficulty,
              taskType: t.taskType,
              estimatedMins: t.estimatedMins ? Number(t.estimatedMins) : undefined,
              xpReward: t.xpReward ? Number(t.xpReward) : undefined,
              repeatIntervalHours: Number(t.repeatIntervalHours) || undefined,
            }))
        : undefined,
    };

    setSubmitting(true);
    try {
      const res = await adminApi.assign(payload);
      setResult(
        `Assigned to ${res.results.length} student${res.results.length === 1 ? "" : "s"}${
          payload.tasks?.length ? ` with ${payload.tasks.length} task(s) each` : ""
        }.`,
      );
      setSubjectName("");
      setSubjectDescription("");
      setTopicName("");
      setSubtopicName("");
      setTasks([]);
      setSelectedUserIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign content");
    } finally {
      setSubmitting(false);
    }
  };

  if (!checkedAuth || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto mt-20">
        <Card>
          <CardContent className="py-10 text-center">
            <ShieldCheck className="h-10 w-10 mx-auto mb-3 text-amber-400" />
            <p className="text-gray-300">Admin access required.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <SendHorizonal className="h-6 w-6 text-amber-400" />
          Assign Work
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Create a subject / topic / subtopic (reusing existing ones with matching names) and optionally
          assign tasks under it — to one or many students at once.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UsersIcon className="h-4 w-4 text-indigo-400" />
              Students
            </CardTitle>
            <CardDescription>Pick who this should be assigned to</CardDescription>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <p className="text-sm text-gray-500">No students found</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {users.map((u) => {
                  const selected = selectedUserIds.has(u.id);
                  return (
                    <button
                      type="button"
                      key={u.id}
                      onClick={() => toggleUser(u.id)}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all ${
                        selected
                          ? "border-indigo-500 bg-indigo-500/10"
                          : "border-gray-800 hover:border-gray-700"
                      }`}
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xs font-semibold">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-200 truncate">{u.name}</p>
                        <p className="text-[10px] text-gray-500 truncate">{u.email}</p>
                      </div>
                      {selected && <CheckCircle2 className="h-4 w-4 text-indigo-400 ml-auto shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
            {selectedUserIds.size > 0 && (
              <p className="text-xs text-gray-500 mt-3">{selectedUserIds.size} selected</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Curriculum</CardTitle>
            <CardDescription>
              If a student already has a subject/topic/subtopic with this name, it will be reused instead
              of duplicated.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Subject *</label>
              <Input
                placeholder="e.g., DevOps"
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Subject Description</label>
              <Textarea
                placeholder="Optional description"
                value={subjectDescription}
                onChange={(e) => setSubjectDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Topic</label>
                <Input
                  placeholder="e.g., Docker Basics"
                  value={topicName}
                  onChange={(e) => setTopicName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Subtopic</label>
                <Input
                  placeholder="e.g., Volumes"
                  value={subtopicName}
                  onChange={(e) => setSubtopicName(e.target.value)}
                  disabled={!topicName}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Tasks (optional)</CardTitle>
              <CardDescription>Added to the subtopic above for each selected student</CardDescription>
            </div>
            <Button type="button" size="sm" variant="secondary" onClick={addTaskRow} disabled={!subtopicName}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Task
            </Button>
          </CardHeader>
          {tasks.length > 0 && (
            <CardContent className="space-y-4">
              {tasks.map((task, idx) => (
                <div key={idx} className="rounded-lg border border-gray-800 p-3 space-y-2 relative">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2 text-red-400 hover:text-red-300 h-6"
                    onClick={() => removeTaskRow(idx)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <Input
                    placeholder="Task title"
                    value={task.title}
                    onChange={(e) => updateTaskRow(idx, "title", e.target.value)}
                    className="pr-8"
                  />
                  <Textarea
                    placeholder="Task description / instructions"
                    value={task.description}
                    onChange={(e) => updateTaskRow(idx, "description", e.target.value)}
                  />
                  <div className="grid grid-cols-4 gap-2">
                    <select
                      className="h-9 rounded-md border border-gray-800 bg-gray-900 px-2 text-xs text-gray-200 focus:border-indigo-500 focus:outline-none"
                      value={task.difficulty}
                      onChange={(e) => updateTaskRow(idx, "difficulty", e.target.value)}
                    >
                      {["beginner", "intermediate", "advanced", "expert"].map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <select
                      className="h-9 rounded-md border border-gray-800 bg-gray-900 px-2 text-xs text-gray-200 focus:border-indigo-500 focus:outline-none"
                      value={task.taskType}
                      onChange={(e) => updateTaskRow(idx, "taskType", e.target.value)}
                    >
                      {["practice", "troubleshooting", "scenario", "revision"].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      placeholder="Mins"
                      value={task.estimatedMins}
                      onChange={(e) => updateTaskRow(idx, "estimatedMins", e.target.value)}
                      className="h-9 text-xs"
                    />
                    <Input
                      type="number"
                      placeholder="XP"
                      value={task.xpReward}
                      onChange={(e) => updateTaskRow(idx, "xpReward", e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 mb-1 block">Repeat</label>
                    <select
                      className="h-9 w-full rounded-md border border-gray-800 bg-gray-900 px-2 text-xs text-gray-200 focus:border-indigo-500 focus:outline-none"
                      value={task.repeatIntervalHours}
                      onChange={(e) => updateTaskRow(idx, "repeatIntervalHours", e.target.value)}
                    >
                      {REPEAT_INTERVAL_OPTIONS.map((o) => (
                        <option key={o.hours} value={o.hours}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </CardContent>
          )}
        </Card>

        {error && (
          <div className="p-3 rounded-lg border border-red-800 bg-red-900/20 text-red-400 text-sm">
            {error}
          </div>
        )}
        {result && (
          <div className="flex items-center gap-2 p-3 rounded-lg border border-emerald-800 bg-emerald-900/20 text-emerald-400 text-sm">
            <CheckCircle2 className="h-4 w-4" />
            {result}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={submitting || !subjectName || selectedUserIds.size === 0}>
          {submitting ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <SendHorizonal className="h-4 w-4 mr-2" />}
          Assign to {selectedUserIds.size || 0} Student{selectedUserIds.size === 1 ? "" : "s"}
        </Button>
      </form>

      <Badge variant="outline" className="text-[10px]">
        Tip: leave Topic/Subtopic blank to just ensure the Subject exists for these students.
      </Badge>
    </div>
  );
}
