"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, Field, Select } from "@/components/ui/field";
import { RichEditor } from "@/components/editor/rich-editor";
import { visibilityHelp } from "@/components/content/badges";
import { categoriesApi, subjectsApi, type Category, type PublishStatus, type Visibility } from "@/lib/api";
import { useSession } from "@/lib/auth";

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f59e0b", "#10b981", "#06b6d4", "#3b82f6", "#64748b"];

export default function NewSubjectPage() {
  const router = useRouter();
  const { isAdmin } = useSession();
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({
    title: "",
    summary: "",
    content: "",
    categoryId: "",
    tags: "",
    color: COLORS[0],
    visibility: "PRIVATE" as Visibility,
    status: "DRAFT" as PublishStatus,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    categoriesApi.list().then(setCategories).catch(() => {});
  }, []);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const s = await subjectsApi.create({
        title: form.title,
        summary: form.summary || undefined,
        content: form.content || undefined,
        categoryId: form.categoryId || undefined,
        tags: form.tags || undefined,
        color: form.color,
        ...(isAdmin ? { visibility: form.visibility, status: form.status } : {}),
      });
      router.push(`/subjects/${s.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create subject");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/library" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200">
          <ArrowLeft className="h-4 w-4" /> Library
        </Link>
        <h1 className="mt-2 text-2xl font-bold">New subject</h1>
        <p className="text-sm text-gray-400">
          A subject holds chapters, topics and subtopics. You can add those after it&apos;s created.
        </p>
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="grid gap-4 md:grid-cols-[1fr_260px]">
        <div className="space-y-4">
          <Field label="Title *">
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} required minLength={2} autoFocus placeholder="e.g. Linux Storage Administration" />
          </Field>
          <Field label="Summary" hint="One or two sentences. Shown on cards and in the catalog.">
            <Textarea value={form.summary} onChange={(e) => set("summary", e.target.value)} maxLength={1000} rows={2} />
          </Field>
          <Field label="Overview">
            <RichEditor value={form.content} onChange={(v) => set("content", v)} placeholder="What this subject covers, prerequisites, how to use it… (images can be added after creating)" minHeight={200} />
          </Field>
        </div>
        <div className="space-y-4">
          {isAdmin ? (
            <>
              <Field label="Visibility" hint={visibilityHelp[form.visibility]}>
                <Select value={form.visibility} onChange={(e) => set("visibility", e.target.value as Visibility)}>
                  <option value="PRIVATE">Private</option>
                  <option value="LISTED">Listed (preview + request access)</option>
                  <option value="PUBLIC">Public</option>
                </Select>
              </Field>
              <Field label="Status" hint="Drafts don't appear in the catalog.">
                <Select value={form.status} onChange={(e) => set("status", e.target.value as PublishStatus)}>
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                </Select>
              </Field>
            </>
          ) : (
            <Alert tone="info">
              Your subjects are private. Share them with other people by username from the subject&apos;s Manage page.
            </Alert>
          )}
          <Field label="Category">
            <Select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
              <option value="">None</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Tags" hint="Comma separated">
            <Input value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="linux, storage, lvm" />
          </Field>
          <Field label="Color">
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => set("color", c)}
                  className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{ background: c, borderColor: form.color === c ? "#fff" : "transparent" }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </Field>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-gray-800 pt-4">
        <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={saving || form.title.trim().length < 2}>
          {saving ? "Creating…" : "Create subject"}
        </Button>
      </div>
    </form>
  );
}
