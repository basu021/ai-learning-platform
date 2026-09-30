"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  ShieldCheck,
  RefreshCw,
  Clock,
  CheckCircle2,
  BookOpen,
  ChevronRight,
  UserPlus,
} from "lucide-react";
import { adminApi, authApi } from "@/lib/api";
import type { AdminUserData } from "@/lib/api";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkedAuth, setCheckedAuth] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "user" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const refreshUsers = () => {
    adminApi.listUsers().then(setUsers).catch(() => {});
  };

  useEffect(() => {
    authApi
      .profile()
      .then((data) => {
        setIsAdmin(data.role === "admin");
        if (data.role === "admin") {
          adminApi
            .listUsers()
            .then(setUsers)
            .catch(() => {})
            .finally(() => setLoading(false));
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false))
      .finally(() => setCheckedAuth(true));
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      await adminApi.createUser(newUser);
      setNewUser({ name: "", email: "", password: "", role: "user" });
      setShowCreate(false);
      refreshUsers();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setCreating(false);
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-amber-400" />
            Users
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {users.length} student{users.length === 1 ? "" : "s"} &middot; view progress and manage their learning content
          </p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <UserPlus className="h-4 w-4 mr-2" />
          New User
        </Button>
      </div>

      {showCreate && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Create User</CardTitle>
              <CardDescription>Creates the account directly — no email verification needed</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Name</label>
                    <Input
                      placeholder="Full name"
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Email</label>
                    <Input
                      type="email"
                      placeholder="student@example.com"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Password</label>
                    <Input
                      type="password"
                      placeholder="Min. 6 characters"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      minLength={6}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Role</label>
                    <select
                      className="flex h-10 w-full rounded-lg border border-gray-700 bg-gray-800/50 px-3 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    >
                      <option value="user">Student</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                {createError && <p className="text-sm text-red-400">{createError}</p>}
                <div className="flex gap-2">
                  <Button type="submit" disabled={creating}>
                    {creating ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
                    Create User
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {users.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-gray-500">No users yet</CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {users.map((u, i) => (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Link href={`/admin/users/${u.id}`}>
                <Card className="hover:border-indigo-500/40 transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-semibold">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-100 truncate">{u.name}</p>
                          {u.role === "admin" && (
                            <Badge variant="warning" className="text-[10px]">admin</Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{u.email}</p>
                      </div>
                    </div>

                    <div className="hidden sm:flex items-center gap-4 text-xs text-gray-400 shrink-0">
                      <div className="flex items-center gap-1.5" title="Subjects">
                        <BookOpen className="h-3.5 w-3.5 text-indigo-400" />
                        {u.stats.subjectsCount}
                      </div>
                      <div className="flex items-center gap-1.5" title="Pending tasks">
                        <Clock className="h-3.5 w-3.5 text-amber-400" />
                        {u.stats.pendingTasks} pending
                      </div>
                      <div className="flex items-center gap-1.5" title="Completed tasks">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        {u.stats.completedTasks} done
                      </div>
                      <Badge variant="secondary">Lvl {u.level}</Badge>
                    </div>

                    <ChevronRight className="h-4 w-4 text-gray-600 shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
