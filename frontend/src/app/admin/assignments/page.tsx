"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, RefreshCw, ShieldCheck, BookOpen } from "lucide-react";
import { adminApi, authApi } from "@/lib/api";
import type { AdminAssignmentGroup } from "@/lib/api";

export default function AdminAssignmentsPage() {
  const [groups, setGroups] = useState<AdminAssignmentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkedAuth, setCheckedAuth] = useState(false);

  useEffect(() => {
    authApi
      .profile()
      .then((profile) => {
        setIsAdmin(profile.role === "admin");
        if (profile.role === "admin") {
          adminApi.listAssignments().then(setGroups).catch(() => {}).finally(() => setLoading(false));
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false))
      .finally(() => setCheckedAuth(true));
  }, []);

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
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-amber-400" />
          Assignments
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Task batches assigned to students, with per-student completion progress
        </p>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-gray-500">
            No assignments yet. Create one from{" "}
            <a href="/admin/assign" className="text-indigo-400 hover:underline">Assign Work</a>.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <Card key={group.assignmentGroupId}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-indigo-400" />
                  {group.subjectName}
                  {group.topicName && <span className="text-gray-500 font-normal">/ {group.topicName}</span>}
                  <span className="text-gray-500 font-normal">/ {group.subtopicName}</span>
                </CardTitle>
                <p className="text-xs text-gray-500">
                  Assigned {new Date(group.createdAt).toLocaleString()} &middot; {group.targets.length} student
                  {group.targets.length === 1 ? "" : "s"}
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {group.targets.map((t) => {
                  const pct = t.total > 0 ? Math.round((t.completed / t.total) * 100) : 0;
                  return (
                    <div key={t.userId} className="flex items-center gap-3">
                      <span className="text-sm text-gray-300 w-40 truncate">{t.userName}</span>
                      <div className="flex-1 h-2 rounded-full bg-gray-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <Badge variant={t.completed === t.total ? "success" : "secondary"} className="text-[10px] w-16 justify-center">
                        {t.completed}/{t.total}
                      </Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
