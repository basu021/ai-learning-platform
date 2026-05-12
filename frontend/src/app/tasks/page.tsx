"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListTodo, Play, Filter } from "lucide-react";
import { tasksApi } from "@/lib/api";
import type { TaskData } from "@/lib/api";
import { getStatusColor, getDifficultyColor } from "@/lib/utils";
import Link from "next/link";

const statusFilters = ["all", "pending", "in_progress", "completed", "skipped"];

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    tasksApi.my(filter === "all" ? undefined : filter).then((data) => {
      if (!cancelled) setTasks(data);
    }).catch(() => {}).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [filter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-gray-400 text-sm mt-1">All your practice tasks</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-gray-500" />
        {statusFilters.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filter === s ? "default" : "ghost"}
            onClick={() => setFilter(s)}
            className="capitalize text-xs"
          >
            {s.replace("_", " ")}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ListTodo className="h-12 w-12 mx-auto mb-4 text-gray-700" />
            <h3 className="text-lg font-medium mb-2">No tasks found</h3>
            <p className="text-gray-500 text-sm">
              Generate tasks from your subjects to get started
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {tasks.map((task, i) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Card className="hover:border-gray-700 transition-all group">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-medium truncate">{task.title}</h3>
                        <Badge className={getStatusColor(task.status)} >{task.status.replace("_", " ")}</Badge>
                        <span className={`text-xs ${getDifficultyColor(task.difficulty)}`}>
                          {task.difficulty}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-2">{task.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                        {task.subtopic && (
                          <span>
                            {task.subtopic.topic?.subject?.name} &rarr; {task.subtopic.topic?.name} &rarr;{" "}
                            {task.subtopic.name}
                          </span>
                        )}
                        {task.estimatedMins && <span>{task.estimatedMins}m</span>}
                        <span>{task.xpReward} XP</span>
                        {task.isRevision && <Badge variant="warning" className="text-xs">Revision</Badge>}
                      </div>
                    </div>
                    <Link href={`/tasks/${task.id}`}>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Open
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
