"use client";

import { useState, useEffect, useRef, use } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Play,
  Pause,
  Square,
  Clock,
  ArrowLeft,
  Lightbulb,
  Terminal,
  Tag,
  Send,
  CheckCircle2,
  Star,
} from "lucide-react";
import { tasksApi, feedbackApi, aiApi } from "@/lib/api";
import type { TaskData } from "@/lib/api";
import { getStatusColor, getDifficultyColor, formatDuration } from "@/lib/utils";
import Link from "next/link";

export default function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [task, setTask] = useState<TaskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState({
    whatWasDone: "",
    problemsFaced: "",
    commandsUsed: "",
    confidenceLevel: 3,
    needsImprovement: "",
    notesForTomorrow: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshTask = () => {
    tasksApi.get(id).then(setTask).catch(() => {});
  };

  const handleStart = async () => {
    try {
      const session = await tasksApi.start(id);
      setSessionId(session.id);
      setRunning(true);
      setElapsed(0);
      refreshTask();
    } catch {
      // Error
    }
  };

  const handleStop = async () => {
    setRunning(false);
    if (sessionId) {
      try {
        await tasksApi.finishSession(sessionId);
      } catch {
        // Error
      }
    }
    setShowFeedback(true);
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await feedbackApi.create({
        taskId: id,
        ...feedback,
      });
      await aiApi.analyze(id).catch(() => {});
      refreshTask();
      setShowFeedback(false);
    } catch {
      // Error
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    tasksApi.get(id).then((data) => {
      if (!cancelled) setTask(data);
    }).catch(() => {}).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [running]);

  const hints = task?.hints ? JSON.parse(task.hints) as string[] : [];
  const commands = task?.commands ? JSON.parse(task.commands) as string[] : [];
  const tags = task?.tags ? JSON.parse(task.tags) as string[] : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400">Task not found</p>
        <Link href="/tasks">
          <Button variant="ghost" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Tasks
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/tasks">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Tasks
        </Button>
      </Link>

      {/* Task Header */}
      <Card className="glow-indigo">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className={getStatusColor(task.status)}>
                  {task.status.replace("_", " ")}
                </Badge>
                <span className={`text-xs ${getDifficultyColor(task.difficulty)}`}>
                  {task.difficulty}
                </span>
                <Badge variant="secondary">{task.taskType}</Badge>
                {task.isRevision && <Badge variant="warning">Revision</Badge>}
              </div>
              <CardTitle className="text-xl">{task.title}</CardTitle>
              {task.subtopic && (
                <p className="text-sm text-gray-500 mt-1">
                  {task.subtopic.topic?.subject?.name} &rarr; {task.subtopic.topic?.name} &rarr;{" "}
                  {task.subtopic.name}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-2xl font-mono font-bold text-indigo-400">{task.xpReward} XP</p>
              {task.estimatedMins && (
                <p className="text-xs text-gray-500">{task.estimatedMins} min estimated</p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-gray-300 leading-relaxed">{task.description}</p>
        </CardContent>
      </Card>

      {/* Timer */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Clock className="h-5 w-5 text-indigo-400" />
              <div>
                <p className="text-3xl font-mono font-bold">{formatDuration(elapsed)}</p>
                <p className="text-xs text-gray-500">Time elapsed</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {task.status === "completed" ? (
                <Badge variant="success" className="text-sm py-1 px-3">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Completed
                </Badge>
              ) : !running ? (
                <Button onClick={handleStart} className="gap-2">
                  <Play className="h-4 w-4" />
                  Start Task
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setRunning(false)}>
                    <Pause className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" onClick={handleStop}>
                    <Square className="h-4 w-4 mr-2" />
                    Finish
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Hints */}
        {hints.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-400" />
                Hints
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {hints.map((hint, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                    <span className="text-yellow-400 mt-0.5">&#8226;</span>
                    {hint}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Commands */}
        {commands.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Terminal className="h-4 w-4 text-green-400" />
                Relevant Commands
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {commands.map((cmd, i) => (
                  <code
                    key={i}
                    className="block px-3 py-1.5 bg-gray-800 rounded text-xs text-green-400 font-mono"
                  >
                    {cmd}
                  </code>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-gray-500" />
          {tags.map((tag, i) => (
            <Badge key={i} variant="secondary">{tag}</Badge>
          ))}
        </div>
      )}

      {/* Feedback Form */}
      {showFeedback && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-indigo-500/30 glow-indigo">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-indigo-400" />
                Task Feedback
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitFeedback} className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">What was done?</label>
                  <Textarea
                    placeholder="Describe what you accomplished..."
                    value={feedback.whatWasDone}
                    onChange={(e) => setFeedback({ ...feedback, whatWasDone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Problems faced</label>
                  <Textarea
                    placeholder="Any issues or blockers encountered?"
                    value={feedback.problemsFaced}
                    onChange={(e) => setFeedback({ ...feedback, problemsFaced: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Commands used</label>
                  <Input
                    placeholder="e.g., ssh-keygen, chmod, systemctl"
                    value={feedback.commandsUsed}
                    onChange={(e) => setFeedback({ ...feedback, commandsUsed: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">
                    Confidence Level: {feedback.confidenceLevel}/5
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setFeedback({ ...feedback, confidenceLevel: level })}
                        className={`h-10 w-10 rounded-lg border transition-all ${
                          level <= feedback.confidenceLevel
                            ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-400"
                            : "border-gray-700 text-gray-600"
                        }`}
                      >
                        <Star className="h-4 w-4 mx-auto" />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">What needs improvement?</label>
                  <Textarea
                    placeholder="Areas to focus on next..."
                    value={feedback.needsImprovement}
                    onChange={(e) => setFeedback({ ...feedback, needsImprovement: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Notes for tomorrow</label>
                  <Textarea
                    placeholder="Things to remember for next session..."
                    value={feedback.notesForTomorrow}
                    onChange={(e) => setFeedback({ ...feedback, notesForTomorrow: e.target.value })}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Submitting..." : "Submit Feedback"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setShowFeedback(false)}>
                    Skip
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Previous Feedback */}
      {task.feedback && task.feedback.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Previous Feedback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {task.feedback.map((fb) => (
              <div key={fb.id} className="p-3 rounded-lg bg-gray-800/30 border border-gray-800 text-sm">
                {fb.whatWasDone && <p className="text-gray-300 mb-1">{fb.whatWasDone}</p>}
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>Confidence: {fb.confidenceLevel}/5</span>
                  <span>&bull;</span>
                  <span>{new Date(fb.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
