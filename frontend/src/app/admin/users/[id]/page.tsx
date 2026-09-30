"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  RefreshCw,
  ShieldCheck,
  Trash2,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Trophy,
  Flame,
  Sparkles,
} from "lucide-react";
import { adminApi, authApi } from "@/lib/api";
import type { AdminUserOverview } from "@/lib/api";
import { REPEAT_INTERVAL_OPTIONS, formatRepeatInterval } from "@/lib/utils";

const STATUS_OPTIONS = [
  "pending",
  "started",
  "in_progress",
  "completed",
  "skipped",
  "revision_required",
];

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "success" | "warning" | "outline"> = {
  pending: "secondary",
  started: "default",
  in_progress: "default",
  completed: "success",
  skipped: "outline",
  revision_required: "warning",
};

export default function AdminUserDetailPage() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [data, setData] = useState<AdminUserOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [expandedSubtopics, setExpandedSubtopics] = useState<Set<string>>(new Set());

  useEffect(() => {
    setId(new URLSearchParams(window.location.search).get("id") || "");
  }, []);

  const load = useCallback(() => {
    if (!id) return;
    adminApi.getUser(id).then(setData).catch(() => {});
  }, [id]);

  useEffect(() => {
    authApi
      .profile()
      .then((profile) => {
        setIsAdmin(profile.role === "admin");
        if (profile.role === "admin") {
          load();
        }
      })
      .catch(() => {})
      .finally(() => {
        setCheckedAuth(true);
        setLoading(false);
      });
  }, [load]);

  const toggleTopic = (id: string) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSubtopic = (id: string) => {
    setExpandedSubtopics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteSubject = async (id: string) => {
    if (!confirm("Delete this subject and everything under it?")) return;
    await adminApi.deleteSubject(id);
    load();
  };

  const handleDeleteTopic = async (id: string) => {
    if (!confirm("Delete this topic and its subtopics/tasks?")) return;
    await adminApi.deleteTopic(id);
    load();
  };

  const handleDeleteSubtopic = async (id: string) => {
    if (!confirm("Delete this subtopic and its tasks?")) return;
    await adminApi.deleteSubtopic(id);
    load();
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm("Delete this task?")) return;
    await adminApi.deleteTask(id);
    load();
  };

  const handleStatusChange = async (id: string, status: string) => {
    await adminApi.updateTask(id, { status });
    load();
  };

  const handleRepeatChange = async (id: string, hours: string) => {
    await adminApi.updateTask(id, { repeatIntervalHours: Number(hours) });
    load();
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

  if (!data) {
    return (
      <div className="max-w-md mx-auto mt-20">
        <Card>
          <CardContent className="py-10 text-center text-gray-500">User not found</CardContent>
        </Card>
      </div>
    );
  }

  const { user, subjects } = data;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => router.push("/admin/users")}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Users
      </Button>

      <Card>
        <CardContent className="p-6 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xl font-semibold">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{user.name}</h1>
              {user.role === "admin" && <Badge variant="warning">admin</Badge>}
            </div>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-gray-300">
              <Trophy className="h-4 w-4 text-yellow-400" />
              Level {user.level}
            </div>
            <div className="flex items-center gap-1.5 text-gray-300">
              <Flame className="h-4 w-4 text-orange-400" />
              {user.totalXp} XP
            </div>
            <Badge variant="secondary">{user.difficulty}</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-indigo-400" />
          Learning Content
        </h2>
      </div>

      {subjects.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-gray-500">
            This student has no subjects yet. Use{" "}
            <a href="/admin/assign" className="text-indigo-400 hover:underline">Assign Work</a> to create some.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {subjects.map((subject) => (
            <Card key={subject.id} className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between border-b border-gray-800/50">
                <div className="flex items-center gap-3">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: subject.color || "#6366f1" }}
                  />
                  <CardTitle className="text-base">{subject.name}</CardTitle>
                  {subject.assignedBy && (
                    <Badge variant="default" className="text-[10px]">
                      <Sparkles className="h-3 w-3 mr-1" />assigned
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-400 hover:text-red-300"
                  onClick={() => handleDeleteSubject(subject.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardHeader>
              <CardContent className="p-3 space-y-2">
                {subject.topics.length === 0 ? (
                  <p className="text-xs text-gray-500 px-2 py-2">No topics yet</p>
                ) : (
                  subject.topics.map((topic) => {
                    const topicOpen = expandedTopics.has(topic.id);
                    return (
                      <div key={topic.id} className="rounded-lg border border-gray-800/50">
                        <div
                          className="flex items-center justify-between p-2.5 cursor-pointer hover:bg-gray-800/30"
                          onClick={() => toggleTopic(topic.id)}
                        >
                          <div className="flex items-center gap-2">
                            {topicOpen ? (
                              <ChevronDown className="h-4 w-4 text-gray-500" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-gray-500" />
                            )}
                            <span className="text-sm font-medium">{topic.name}</span>
                            <Badge variant="secondary" className="text-[10px]">
                              {topic.subtopics.length} subtopics
                            </Badge>
                            {topic.assignedBy && (
                              <Badge variant="default" className="text-[10px]">assigned</Badge>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-400 hover:text-red-300 h-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTopic(topic.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        {topicOpen && (
                          <div className="pl-6 pb-2 space-y-1.5">
                            {topic.subtopics.length === 0 ? (
                              <p className="text-xs text-gray-500 px-2">No subtopics yet</p>
                            ) : (
                              topic.subtopics.map((subtopic) => {
                                const subtopicOpen = expandedSubtopics.has(subtopic.id);
                                return (
                                  <div key={subtopic.id} className="rounded-md border border-gray-800/40">
                                    <div
                                      className="flex items-center justify-between p-2 cursor-pointer hover:bg-gray-800/20"
                                      onClick={() => toggleSubtopic(subtopic.id)}
                                    >
                                      <div className="flex items-center gap-2">
                                        {subtopicOpen ? (
                                          <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                                        ) : (
                                          <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
                                        )}
                                        <span className="text-xs font-medium text-gray-300">{subtopic.name}</span>
                                        <Badge variant="secondary" className="text-[10px]">
                                          {subtopic.tasks.length} tasks
                                        </Badge>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-red-400 hover:text-red-300 h-6"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteSubtopic(subtopic.id);
                                        }}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>

                                    {subtopicOpen && (
                                      <div className="pl-6 pb-2 space-y-1">
                                        {subtopic.tasks.length === 0 ? (
                                          <p className="text-xs text-gray-600 px-2">No tasks yet</p>
                                        ) : (
                                          subtopic.tasks.map((task) => {
                                            const repeatLabel = formatRepeatInterval(task.repeatIntervalHours);
                                            return (
                                              <div
                                                key={task.id}
                                                className="flex flex-wrap items-center justify-between gap-2 py-1.5 px-2 rounded hover:bg-gray-800/20"
                                              >
                                                <div className="min-w-0 flex-1 flex items-center gap-1.5">
                                                  <p className="text-xs text-gray-200 truncate">{task.title}</p>
                                                  {repeatLabel && (
                                                    <Badge variant="outline" className="text-[9px] shrink-0">
                                                      &#8635; {repeatLabel}
                                                      {task.timesCompleted > 0 && ` · ${task.timesCompleted}x`}
                                                    </Badge>
                                                  )}
                                                </div>
                                                <select
                                                  className="h-6 rounded border border-gray-700 bg-gray-800 px-1.5 text-[10px] text-gray-300 focus:outline-none"
                                                  value={task.status}
                                                  onChange={(e) => handleStatusChange(task.id, e.target.value)}
                                                >
                                                  {STATUS_OPTIONS.map((s) => (
                                                    <option key={s} value={s}>{s}</option>
                                                  ))}
                                                </select>
                                                <Badge variant={STATUS_VARIANT[task.status] || "secondary"} className="text-[10px]">
                                                  {task.status}
                                                </Badge>
                                                <select
                                                  className="h-6 rounded border border-gray-700 bg-gray-800 px-1.5 text-[10px] text-gray-300 focus:outline-none"
                                                  value={task.repeatIntervalHours || 0}
                                                  onChange={(e) => handleRepeatChange(task.id, e.target.value)}
                                                  title="Repeat interval"
                                                >
                                                  {REPEAT_INTERVAL_OPTIONS.map((o) => (
                                                    <option key={o.hours} value={o.hours}>{o.label}</option>
                                                  ))}
                                                </select>
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  className="text-red-400 hover:text-red-300 h-6"
                                                  onClick={() => handleDeleteTask(task.id)}
                                                >
                                                  <Trash2 className="h-3 w-3" />
                                                </Button>
                                              </div>
                                            );
                                          })
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
