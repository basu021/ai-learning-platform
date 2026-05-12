"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  BookOpen,
  ChevronRight,
  Trash2,
  FolderPlus,
  Sparkles,
} from "lucide-react";
import {
  subjectsApi,
  topicsApi,
  subtopicsApi,
  aiApi,
} from "@/lib/api";
import type { SubjectWithTopics, TopicData } from "@/lib/api";

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<SubjectWithTopics[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newSubject, setNewSubject] = useState({ name: "", description: "", color: "#6366f1" });
  const [showTopicForm, setShowTopicForm] = useState<string | null>(null);
  const [newTopic, setNewTopic] = useState({ name: "", description: "" });
  const [showSubtopicForm, setShowSubtopicForm] = useState<string | null>(null);
  const [newSubtopic, setNewSubtopic] = useState({ name: "", description: "" });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);

  const refreshSubjects = () => {
    subjectsApi.list().then(setSubjects).catch(() => {});
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await subjectsApi.create(newSubject);
      setNewSubject({ name: "", description: "", color: "#6366f1" });
      setShowCreate(false);
      refreshSubjects();
    } catch {
      // Error
    }
  };

  const handleCreateTopic = async (e: React.FormEvent, subjectId: string) => {
    e.preventDefault();
    try {
      await topicsApi.create({ ...newTopic, subjectId });
      setNewTopic({ name: "", description: "" });
      setShowTopicForm(null);
      refreshSubjects();
    } catch {
      // Error
    }
  };

  const handleCreateSubtopic = async (e: React.FormEvent, topicId: string) => {
    e.preventDefault();
    try {
      await subtopicsApi.create({ ...newSubtopic, topicId });
      setNewSubtopic({ name: "", description: "" });
      setShowSubtopicForm(null);
      refreshSubjects();
    } catch {
      // Error
    }
  };

  const handleDeleteSubject = async (id: string) => {
    try {
      await subjectsApi.delete(id);
      refreshSubjects();
    } catch {
      // Error
    }
  };

  const handleGenerateTasks = async (subtopicId: string) => {
    setGenerating(subtopicId);
    try {
      await aiApi.generate(subtopicId, 5);
    } catch {
      // Error
    } finally {
      setGenerating(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    subjectsApi.list().then((data) => {
      if (!cancelled) setSubjects(data);
    }).catch(() => {}).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Subjects</h1>
          <p className="text-gray-400 text-sm mt-1">Manage your learning paths</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus className="h-4 w-4 mr-2" />
          New Subject
        </Button>
      </div>

      {showCreate && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="p-6">
              <form onSubmit={handleCreateSubject} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Name</label>
                    <Input
                      placeholder="e.g., Linux System Administration"
                      value={newSubject.name}
                      onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Color</label>
                    <div className="flex gap-2">
                      {["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"].map((c) => (
                        <button
                          type="button"
                          key={c}
                          className={`h-10 w-10 rounded-lg border-2 transition-all ${
                            newSubject.color === c ? "border-white scale-110" : "border-transparent"
                          }`}
                          style={{ backgroundColor: c }}
                          onClick={() => setNewSubject({ ...newSubject, color: c })}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Description</label>
                  <Textarea
                    placeholder="Describe this subject..."
                    value={newSubject.description}
                    onChange={(e) => setNewSubject({ ...newSubject, description: e.target.value })}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit">Create Subject</Button>
                  <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {subjects.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-700" />
            <h3 className="text-lg font-medium mb-2">No subjects yet</h3>
            <p className="text-gray-500 text-sm mb-4">
              Create your first subject to start building your learning path
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Subject
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {subjects.map((subject, i) => (
            <motion.div
              key={subject.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between border-b border-gray-800/50">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: subject.color || "#6366f1" }}
                    />
                    <div>
                      <CardTitle>{subject.name}</CardTitle>
                      {subject.description && (
                        <p className="text-xs text-gray-500 mt-1">{subject.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{subject.topics.length} topics</Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setShowTopicForm(showTopicForm === subject.id ? null : subject.id)
                      }
                    >
                      <FolderPlus className="h-3.5 w-3.5 mr-1" />
                      Add Topic
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-400 hover:text-red-300"
                      onClick={() => handleDeleteSubject(subject.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="p-4">
                  {showTopicForm === subject.id && (
                    <form
                      onSubmit={(e) => handleCreateTopic(e, subject.id)}
                      className="flex gap-2 mb-4 p-3 rounded-lg bg-gray-800/30 border border-gray-800"
                    >
                      <Input
                        placeholder="Topic name (e.g., SSH)"
                        value={newTopic.name}
                        onChange={(e) => setNewTopic({ ...newTopic, name: e.target.value })}
                        required
                        className="flex-1"
                      />
                      <Button type="submit" size="sm">Add</Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setShowTopicForm(null)}>
                        Cancel
                      </Button>
                    </form>
                  )}

                  {subject.topics.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No topics yet. Add your first topic to get started.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {subject.topics.map((topic: TopicData) => (
                        <div key={topic.id} className="rounded-lg border border-gray-800/50 p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <ChevronRight className="h-4 w-4 text-gray-500" />
                              <span className="text-sm font-medium">{topic.name}</span>
                              <Badge variant="secondary" className="text-xs">
                                {topic.subtopics?.length || 0} subtopics
                              </Badge>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs"
                              onClick={() =>
                                setShowSubtopicForm(showSubtopicForm === topic.id ? null : topic.id)
                              }
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Subtopic
                            </Button>
                          </div>

                          {showSubtopicForm === topic.id && (
                            <form
                              onSubmit={(e) => handleCreateSubtopic(e, topic.id)}
                              className="flex gap-2 mb-2 ml-6"
                            >
                              <Input
                                placeholder="Subtopic name (e.g., SSH Key Authentication)"
                                value={newSubtopic.name}
                                onChange={(e) =>
                                  setNewSubtopic({ ...newSubtopic, name: e.target.value })
                                }
                                required
                                className="flex-1 h-8 text-xs"
                              />
                              <Button type="submit" size="sm" className="h-8 text-xs">Add</Button>
                            </form>
                          )}

                          {topic.subtopics && topic.subtopics.length > 0 && (
                            <div className="ml-6 space-y-1">
                              {topic.subtopics.map((subtopic) => (
                                <div
                                  key={subtopic.id}
                                  className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-800/30 group"
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-gray-600" />
                                    <span className="text-xs text-gray-300">{subtopic.name}</span>
                                    {subtopic._count && (
                                      <span className="text-xs text-gray-600">
                                        {subtopic._count.tasks} tasks
                                      </span>
                                    )}
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => handleGenerateTasks(subtopic.id)}
                                    disabled={generating === subtopic.id}
                                  >
                                    <Sparkles className="h-3 w-3 mr-1" />
                                    {generating === subtopic.id ? "Generating..." : "Generate Tasks"}
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
