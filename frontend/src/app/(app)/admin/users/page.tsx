"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Users, UserPlus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, Field, Select, Spinner } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { AdminOnly } from "@/components/layout/admin-only";
import { adminApi, type AdminUserRow, type Role } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";

function CreateUser({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", username: "", email: "", password: "", role: "USER" as Role });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await adminApi.createUser(form);
      toast.success(`Created @${form.username}`);
      setForm({ name: "", username: "", email: "", password: "", role: "USER" });
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Create user" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy ? "Creating…" : "Create"}</Button></>}>
      <div className="space-y-3">
        {error && <Alert>{error}</Alert>}
        <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Username" hint="Lowercase letters, numbers, . _ -"><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} /></Field>
        <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Password" hint="At least 6 characters"><Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        <Field label="Role">
          <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            <option value="USER">Learner</option>
            <option value="ADMIN">Admin</option>
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

function UsersList() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [open, setOpen] = useState(false);
  const load = useCallback(() => {
    adminApi.users(q || undefined).then(setUsers).catch(() => setUsers([]));
  }, [q]);
  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Users className="h-6 w-6 text-indigo-400" /> Users</h1>
        <Button onClick={() => setOpen(true)}><UserPlus className="mr-1 h-4 w-4" /> Create user</Button>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, username, email" className="pl-9" />
      </div>
      {!users ? (
        <Spinner />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">User</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2 text-right">Own subjects</th>
                <th className="px-4 py-2 text-right">Shared with</th>
                <th className="px-4 py-2 text-right">Tasks</th>
                <th className="px-4 py-2 text-right">XP</th>
                <th className="px-4 py-2">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {users.map((u) => (
                <tr key={u.id} className={cn("hover:bg-gray-900/60", !u.active && "opacity-50")}>
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/users/${u.id}`} className="font-medium text-gray-100 hover:text-indigo-300">{u.name}</Link>
                    <p className="text-xs text-gray-500">@{u.username} · {u.email}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={cn("rounded px-1.5 py-0.5 text-[11px]", u.role === "ADMIN" ? "bg-indigo-500/20 text-indigo-300" : "bg-gray-800 text-gray-400")}>
                      {u.role === "ADMIN" ? "Admin" : "Learner"}
                    </span>
                    {!u.active && <span className="ml-1 text-[11px] text-red-400">inactive</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">{u.subjectCount}</td>
                  <td className="px-4 py-2.5 text-right">{u.sharedCount}</td>
                  <td className="px-4 py-2.5 text-right">{u.taskCount}</td>
                  <td className="px-4 py-2.5 text-right">{u.totalXp}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{formatDate(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <CreateUser open={open} onClose={() => setOpen(false)} onCreated={load} />
    </div>
  );
}

export default function AdminUsersPage() {
  return <AdminOnly><UsersList /></AdminOnly>;
}
