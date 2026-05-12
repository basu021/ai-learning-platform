"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Flame,
  Target,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Play,
  BookOpen,
  Zap,
  Calendar,
  Star,
} from "lucide-react";
import { dashboardApi, schedulerApi } from "@/lib/api";
import type { DashboardData } from "@/lib/api";
import { formatDuration, getStatusColor } from "@/lib/utils";
import Link from "next/link";

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    dashboardApi.get().then((data) => {
      if (!cancelled) setDashboard(data);
    }).catch(() => {}).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const refreshDashboard = () => {
    dashboardApi.get().then(setDashboard).catch(() => {});
  };

  const handleGenerateDaily = async () => {
    try {
      await schedulerApi.generateDaily();
      refreshDashboard();
    } catch {
      // Error generating
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const d = dashboard;

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card className="glow-indigo">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Today&apos;s Progress</p>
                  <p className="text-3xl font-bold mt-1">
                    {d?.todayProgress.completed || 0}
                    <span className="text-lg text-gray-500">/{d?.todayProgress.total || 0}</span>
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                  <Target className="h-6 w-6 text-indigo-400" />
                </div>
              </div>
              <Progress
                value={d?.todayProgress.total ? (d.todayProgress.completed / d.todayProgress.total) * 100 : 0}
                className="mt-3"
                indicatorClassName="bg-gradient-to-r from-indigo-500 to-purple-500"
              />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Current Streak</p>
                  <p className="text-3xl font-bold mt-1">
                    {d?.streak?.currentCount || 0}
                    <span className="text-lg text-gray-500"> days</span>
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                  <Flame className="h-6 w-6 text-orange-400" />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Longest: {d?.streak?.longestCount || 0} days
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Total XP</p>
                  <p className="text-3xl font-bold mt-1">
                    {d?.user?.totalXp || 0}
                    <span className="text-lg text-gray-500"> xp</span>
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                  <Star className="h-6 w-6 text-yellow-400" />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Level {d?.user?.level || 1}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Subjects</p>
                  <p className="text-3xl font-bold mt-1">{d?.subjectProgress.length || 0}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-emerald-400" />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Active learning paths
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Tasks */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-400" />
                Today&apos;s Tasks
              </CardTitle>
              <Button size="sm" onClick={handleGenerateDaily}>
                <Zap className="h-3.5 w-3.5 mr-1" />
                Generate Tasks
              </Button>
            </CardHeader>
            <CardContent>
              {(!d?.todaysTasks || d.todaysTasks.length === 0) ? (
                <div className="text-center py-12 text-gray-500">
                  <Target className="h-12 w-12 mx-auto mb-3 text-gray-700" />
                  <p className="font-medium">No tasks scheduled for today</p>
                  <p className="text-sm mt-1">Create subjects and generate tasks to get started</p>
                  <div className="flex gap-2 justify-center mt-4">
                    <Link href="/subjects">
                      <Button size="sm" variant="outline">Create Subject</Button>
                    </Link>
                    <Button size="sm" onClick={handleGenerateDaily}>Generate Daily Queue</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {d.todaysTasks.map((item, i) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-4 p-3 rounded-lg border border-gray-800 hover:border-gray-700 transition-all group"
                    >
                      <div className={`h-2 w-2 rounded-full ${item.completed ? "bg-green-400" : "bg-gray-600"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.task.title}</p>
                        <p className="text-xs text-gray-500">
                          {item.task.subtopic?.topic?.subject?.name} &rarr; {item.task.subtopic?.name}
                        </p>
                      </div>
                      <Badge className={getStatusColor(item.task.status)}>{item.task.status}</Badge>
                      {!item.completed && (
                        <Link href={`/tasks/${item.task.id}`}>
                          <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <Play className="h-3 w-3" />
                          </Button>
                        </Link>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar cards */}
        <div className="space-y-6">
          {/* Subject Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                Subject Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(!d?.subjectProgress || d.subjectProgress.length === 0) ? (
                <p className="text-sm text-gray-500 text-center py-4">No subjects yet</p>
              ) : (
                d.subjectProgress.map((subject) => (
                  <div key={subject.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{subject.name}</span>
                      <span className="text-xs text-gray-400">{Math.round(subject.mastery)}%</span>
                    </div>
                    <Progress
                      value={subject.mastery}
                      className="h-1.5"
                      indicatorClassName={`bg-gradient-to-r ${subject.color ? "" : "from-indigo-500 to-purple-500"}`}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {subject.completedTasks}/{subject.totalTasks} tasks &bull; {subject.topicCount} topics
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Weak Areas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-400" />
                Focus Areas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(!d?.weakAreas || d.weakAreas.length === 0) ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  Complete tasks to identify focus areas
                </p>
              ) : (
                <div className="space-y-2">
                  {d.weakAreas.slice(0, 5).map((area, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded bg-yellow-500/5 border border-yellow-500/10">
                      <span className="text-sm">{area.subtopic.name}</span>
                      <Badge variant="warning">{Math.round(area.mastery)}%</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-400" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(!d?.recentActivity || d.recentActivity.length === 0) ? (
                <p className="text-sm text-gray-500 text-center py-4">No recent activity</p>
              ) : (
                <div className="space-y-2">
                  {d.recentActivity.slice(0, 5).map((activity) => (
                    <div key={activity.id} className="flex items-center gap-3 py-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{activity.task.title}</p>
                        <p className="text-xs text-gray-500">
                          {activity.duration ? formatDuration(activity.duration) : "N/A"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
