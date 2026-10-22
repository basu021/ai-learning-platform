"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Check,
  X,
  History,
  RotateCcw,
  Trash2,
  UserPlus,
  Eye,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, EmptyState, Field, Select, Spinner, Tabs } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { RichView } from "@/components/editor/rich-editor";
import { UserPicker } from "@/components/users/user-picker";
import { VisibilityBadge, visibilityHelp } from "@/components/content/badges";
import {
  categoriesApi,
  subjectsApi,
  type AccessRequestItem,
  type Category,
  type ChangeRequestItem,
  type ContentSnapshot,
  type MemberItem,
  type MemberRole,
  type OutlineNode,
  type PublishStatus,
  type RevisionItem,
  type SubjectDetail,
  type UserSummary,
  type Visibility,
} from "@/lib/api";
import { cn, NODE_LABEL, timeAgo } from "@/lib/utils";

type Tab = "settings" | "sharing" | "changes" | "requests" | "structure" | "history" | "trash";

// ---------------------------------------------------------------- settings

function SettingsTab({ subject, reload }: { subject: SubjectDetail; reload: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({
    visibility: subject.visibility,
    status: subject.status,
    categoryId: subject.categoryId ?? "",
    tags: subject.tags ?? "",
    color: subject.color ?? "#6366f1",
  });
  const [saving, setSaving] = useState(false);
  const isAdmin = subject.access.isAdmin;

  useEffect(() => {
    categoriesApi.list().then(setCategories).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await subjectsApi.updateSettings(subject.id, {
        ...(isAdmin ? { visibility: form.visibility, status: form.status } : {}),
        categoryId: form.categoryId || null,
        tags: form.tags,
        color: form.color,
      });
      toast.success("Settings saved");
      reload();
    } catch (e) {
      toast.error(e);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (prompt(`Type the subject title to delete it:\n${subject.title}`) !== subject.title) return;
    try {
      await subjectsApi.remove(subject.id);
      toast.success("Subject deleted");
      router.push("/library");
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <div className="max-w-2xl space-y-5">
      {isAdmin ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Visibility" hint={visibilityHelp[form.visibility]}>
            <Select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value as Visibility })}>
              <option value="PRIVATE">Private</option>
              <option value="LISTED">Listed (preview + request access)</option>
              <option value="PUBLIC">Public</option>
            </Select>
          </Field>
          <Field label="Status" hint="Only published subjects appear in the catalog.">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as PublishStatus })}>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
            </Select>
          </Field>
        </div>
      ) : (
        <Alert tone="info">
          This is a personal subject, so it stays <b>private</b>. Share it with specific people from the Sharing tab.
        </Alert>
      )}
      {isAdmin && form.visibility === "LISTED" && (
        <Alert tone="info">
          Choose which chapters, topics or subtopics are open in the preview from the <b>Structure</b> tab. Everything else shows as locked until access is granted.
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category">
          <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
            <option value="">None</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Color">
          <Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-10 w-20 p-1" />
        </Field>
      </div>
      <Field label="Tags" hint="Comma separated">
        <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
      </Field>
      <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save settings"}</Button>

      <div className="mt-8 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
        <h4 className="text-sm font-semibold text-red-300">Delete subject</h4>
        <p className="mt-1 text-xs text-gray-400">Removes it for everyone and stops its practice tasks.</p>
        <Button variant="destructive" size="sm" className="mt-3" onClick={remove}>
          <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete subject
        </Button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------- sharing

function SharingTab({ subject }: { subject: SubjectDetail }) {
  const toast = useToast();
  const [members, setMembers] = useState<MemberItem[] | null>(null);
  const [picked, setPicked] = useState<UserSummary[]>([]);
  const [role, setRole] = useState<MemberRole>("VIEWER");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    subjectsApi.members(subject.id).then(setMembers).catch(toast.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject.id]);
  useEffect(load, [load]);

  const add = async () => {
    setBusy(true);
    try {
      setMembers(await subjectsApi.addMembers(subject.id, picked.map((p) => p.username), role));
      toast.success(`Shared with ${picked.length} ${picked.length > 1 ? "people" : "person"}`);
      setPicked([]);
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };

  const assigning = subject.access.isAdmin && !subject.access.isOwner;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <UserPlus className="h-4 w-4 text-indigo-400" /> {assigning ? "Assign to users" : "Share by username"}
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-start">
          <UserPicker value={picked} onChange={setPicked} />
          <Select value={role} onChange={(e) => setRole(e.target.value as MemberRole)}>
            <option value="VIEWER">Can view</option>
            <option value="EDITOR">Can edit (with approval)</option>
          </Select>
          <Button onClick={add} disabled={busy || picked.length === 0}>{busy ? "Adding…" : "Add"}</Button>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Editors can propose changes; every edit waits for {subject.access.isOwner ? "your" : `@${subject.owner.username}'s`} approval before anyone sees it.
        </p>
      </div>

      {members === null ? (
        <Spinner />
      ) : members.length === 0 ? (
        <EmptyState icon={UserPlus} title="Not shared with anyone yet" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Person</th>
                <th className="px-4 py-2">Access</th>
                <th className="hidden px-4 py-2 sm:table-cell">Added</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {members.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-2.5">
                    <span className="text-gray-200">{m.user.name}</span> <span className="text-gray-500">@{m.user.username}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Select
                      value={m.role}
                      className="h-8 w-36 text-xs"
                      onChange={(e) =>
                        subjectsApi.updateMember(subject.id, m.user.id, e.target.value as MemberRole).then(setMembers).catch(toast.error)
                      }
                    >
                      <option value="VIEWER">Viewer</option>
                      <option value="EDITOR">Editor</option>
                    </Select>
                  </td>
                  <td className="hidden px-4 py-2.5 text-xs text-gray-500 sm:table-cell">
                    {timeAgo(m.createdAt)}{m.grantedBy ? ` by @${m.grantedBy.username}` : ""}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => {
                        if (confirm(`Remove @${m.user.username}?`)) subjectsApi.removeMember(subject.id, m.user.id).then(load).catch(toast.error);
                      }}
                      className="rounded p-1 text-gray-500 hover:text-red-400"
                      aria-label="Remove"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------- changes

function SnapshotDiff({ before, after }: { before: Partial<ContentSnapshot> | null; after: Partial<ContentSnapshot> }) {
  const rows: { label: string; key: keyof ContentSnapshot }[] = [
    { label: "Title", key: "title" },
    { label: "Summary", key: "summary" },
    { label: "Content", key: "content" },
  ];
  const changed = rows.filter((r) => after[r.key] !== undefined && (before?.[r.key] ?? null) !== (after[r.key] ?? null));
  if (!changed.length) return <p className="text-sm text-gray-500">No differences from the current version.</p>;
  return (
    <div className="space-y-4">
      {changed.map((r) => (
        <div key={r.key}>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{r.label}</p>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
              <p className="mb-1 text-[10px] uppercase text-red-400/80">Current</p>
              {r.key === "content" ? <RichView html={before?.content ?? ""} /> : <p className="text-sm text-gray-300">{before?.[r.key] || <i className="text-gray-600">empty</i>}</p>}
              {r.key === "content" && !before?.content && <i className="text-sm text-gray-600">empty</i>}
            </div>
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <p className="mb-1 text-[10px] uppercase text-emerald-400/80">Proposed</p>
              {r.key === "content" ? <RichView html={after.content ?? ""} /> : <p className="text-sm text-gray-200">{after[r.key] || <i className="text-gray-600">empty</i>}</p>}
              {r.key === "content" && !after.content && <i className="text-sm text-gray-600">empty</i>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ChangesTab({ subject, reload }: { subject: SubjectDetail; reload: () => void }) {
  const toast = useToast();
  const [items, setItems] = useState<ChangeRequestItem[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    subjectsApi.changes(subject.id).then(setItems).catch(toast.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject.id]);
  useEffect(load, [load]);

  const decide = async (c: ChangeRequestItem, approve: boolean) => {
    try {
      if (approve) await subjectsApi.approveChange(c.id, notes[c.id]);
      else await subjectsApi.rejectChange(c.id, notes[c.id]);
      toast.success(approve ? "Approved and published" : "Rejected");
      load();
      reload();
    } catch (e) {
      toast.error(e);
    }
  };

  if (!items) return <Spinner />;
  const pending = items.filter((c) => c.status === "PENDING");
  const done = items.filter((c) => c.status !== "PENDING");

  const label = (c: ChangeRequestItem) =>
    c.action === "CREATE"
      ? `New ${NODE_LABEL[c.payload.type ?? "CHAPTER"].toLowerCase()}: ${c.payload.title}`
      : c.action === "DELETE"
        ? `Delete ${NODE_LABEL[c.node?.type ?? "CHAPTER"].toLowerCase()}: ${c.node?.title}`
        : c.node
          ? `Edit ${NODE_LABEL[c.node.type].toLowerCase()}: ${c.node.title}`
          : "Edit subject overview";

  return (
    <div className="space-y-6">
      {pending.length === 0 ? (
        <EmptyState icon={Check} title="Nothing waiting for review" />
      ) : (
        pending.map((c) => (
          <div key={c.id} className="rounded-xl border border-amber-500/20 bg-gray-900/60">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 px-4 py-3">
              <div>
                <p className="font-medium text-gray-100">{label(c)}</p>
                <p className="text-xs text-gray-500">
                  by {c.author.name} @{c.author.username} · {timeAgo(c.createdAt)}
                  {c.changeNote && <> · “{c.changeNote}”</>}
                </p>
              </div>
            </div>
            <div className="p-4">
              {c.action === "DELETE" ? (
                <Alert tone="warning">Deletes this item and everything under it. You can restore it later from Trash.</Alert>
              ) : c.action === "CREATE" ? (
                <SnapshotDiff before={null} after={c.payload} />
              ) : (
                <SnapshotDiff before={c.current} after={c.payload} />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-gray-800 px-4 py-3">
              <Input
                value={notes[c.id] ?? ""}
                onChange={(e) => setNotes({ ...notes, [c.id]: e.target.value })}
                placeholder="Note to the author (optional)"
                className="h-9 flex-1"
              />
              <Button size="sm" variant="outline" onClick={() => decide(c, false)}>
                <X className="mr-1 h-3.5 w-3.5" /> Reject
              </Button>
              <Button size="sm" variant="success" onClick={() => decide(c, true)}>
                <Check className="mr-1 h-3.5 w-3.5" /> Approve
              </Button>
            </div>
          </div>
        ))
      )}

      {done.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-400">Reviewed</h3>
          <ul className="divide-y divide-gray-800 rounded-xl border border-gray-800 text-sm">
            {done.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                <span className={cn("rounded px-1.5 py-0.5 text-[11px]", c.status === "APPROVED" ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300")}>
                  {c.status.toLowerCase()}
                </span>
                <span className="text-gray-300">{label(c)}</span>
                <span className="ml-auto text-xs text-gray-500">
                  @{c.author.username} · reviewed {c.reviewedAt ? timeAgo(c.reviewedAt) : ""}{c.reviewedBy ? ` by @${c.reviewedBy.username}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- requests

function RequestsTab({ subject, reload }: { subject: SubjectDetail; reload: () => void }) {
  const toast = useToast();
  const [items, setItems] = useState<AccessRequestItem[] | null>(null);
  const load = useCallback(() => {
    subjectsApi.accessRequests(subject.id).then(setItems).catch(toast.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject.id]);
  useEffect(load, [load]);

  const decide = async (r: AccessRequestItem, approve: boolean) => {
    try {
      if (approve) await subjectsApi.approveAccess(r.id);
      else await subjectsApi.rejectAccess(r.id);
      toast.success(approve ? `@${r.user.username} can now view this subject` : "Request declined");
      load();
      reload();
    } catch (e) {
      toast.error(e);
    }
  };

  if (!items) return <Spinner />;
  if (!items.length) {
    return (
      <EmptyState icon={Eye} title="No access requests">
        {subject.visibility === "LISTED" ? "People who see the preview can request access here." : "Requests come from Listed subjects in the catalog."}
      </EmptyState>
    );
  }
  return (
    <ul className="max-w-3xl divide-y divide-gray-800 rounded-xl border border-gray-800">
      {items.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-gray-200">{r.user.name} <span className="text-gray-500">@{r.user.username}</span></p>
            {r.message && <p className="mt-0.5 text-xs text-gray-400">“{r.message}”</p>}
            <p className="text-[11px] text-gray-500">{timeAgo(r.createdAt)}</p>
          </div>
          {r.status === "PENDING" ? (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => decide(r, false)}>Decline</Button>
              <Button size="sm" variant="success" onClick={() => decide(r, true)}>Grant access</Button>
            </div>
          ) : (
            <span className={cn("rounded px-2 py-0.5 text-xs", r.status === "APPROVED" ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300")}>
              {r.status.toLowerCase()}{r.decidedBy ? ` by @${r.decidedBy.username}` : ""}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

// --------------------------------------------------------------- structure

function StructureTab({ subject, reload }: { subject: SubjectDetail; reload: () => void }) {
  const toast = useToast();
  const listed = subject.visibility === "LISTED" && subject.access.isAdmin;

  const move = async (siblings: OutlineNode[], index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= siblings.length) return;
    const ids = siblings.map((s) => s.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    try {
      await subjectsApi.reorder(subject.id, siblings[0].parentId, ids);
      reload();
    } catch (e) {
      toast.error(e);
    }
  };

  const togglePreview = async (n: OutlineNode) => {
    try {
      await subjectsApi.setPreview(subject.id, n.id, !n.isPreview);
      reload();
    } catch (e) {
      toast.error(e);
    }
  };

  const render = (list: OutlineNode[], depth: number): React.ReactNode =>
    list.map((n, i) => (
      <div key={n.id}>
        <div className="flex items-center gap-2 border-b border-gray-800/70 py-2 pr-3" style={{ paddingLeft: 12 + depth * 22 }}>
          <span className="w-16 shrink-0 text-[10px] uppercase tracking-wide text-gray-500">{NODE_LABEL[n.type]}</span>
          <span className="min-w-0 flex-1 truncate text-sm text-gray-200">{n.title}</span>
          {listed && (
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-400" title="Visible to everyone in the catalog preview (including everything inside it)">
              <input type="checkbox" checked={n.isPreview} onChange={() => togglePreview(n)} className="accent-sky-500" />
              <Sparkles className={cn("h-3 w-3", n.isPreview ? "text-sky-400" : "text-gray-600")} /> Preview
            </label>
          )}
          <button onClick={() => move(list, i, -1)} disabled={i === 0} className="rounded p-1 text-gray-500 hover:text-gray-200 disabled:opacity-20" aria-label="Move up">
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => move(list, i, 1)} disabled={i === list.length - 1} className="rounded p-1 text-gray-500 hover:text-gray-200 disabled:opacity-20" aria-label="Move down">
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
        </div>
        {render(n.children, depth + 1)}
      </div>
    ));

  return (
    <div className="max-w-3xl space-y-3">
      {listed && (
        <Alert tone="info">
          Tick <b>Preview</b> on the parts people can read before they have access. The subject overview and chapter titles are always shown; unticked chapters appear locked.
        </Alert>
      )}
      {subject.outline.length === 0 ? (
        <EmptyState icon={History} title="No chapters yet">
          <Link href={`/subjects/${subject.id}/edit?type=CHAPTER`} className="text-indigo-400 hover:underline">Add the first chapter</Link>
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900/40">{render(subject.outline, 0)}</div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------- history

function HistoryTab({ subject, reload, trash }: { subject: SubjectDetail; reload: () => void; trash?: boolean }) {
  const toast = useToast();
  const [items, setItems] = useState<RevisionItem[] | null>(null);
  const [viewing, setViewing] = useState<RevisionItem | null>(null);

  const load = useCallback(() => {
    (trash ? subjectsApi.trash(subject.id) : subjectsApi.revisions(subject.id)).then(setItems).catch(toast.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject.id, trash]);
  useEffect(load, [load]);

  const restore = async (r: RevisionItem) => {
    const what =
      r.action === "UPDATE" ? "Restore this earlier version? The current version is kept in history."
      : r.action === "DELETE" ? `Restore "${r.node?.title}" and everything that was inside it?`
      : `Undo the creation of "${r.node?.title}"? It moves to Trash.`;
    if (!confirm(what)) return;
    try {
      await subjectsApi.restoreRevision(r.id);
      toast.success("Restored");
      load();
      reload();
    } catch (e) {
      toast.error(e);
    }
  };

  if (!items) return <Spinner />;
  if (!items.length) {
    return (
      <EmptyState icon={trash ? Trash2 : History} title={trash ? "Trash is empty" : "No history yet"}>
        {!trash && "Each item keeps its last 3 versions here so you can roll back an edit, even one you approved by mistake."}
      </EmptyState>
    );
  }

  // Group by entity (subject overview or a node).
  const groups = new Map<string, RevisionItem[]>();
  items.forEach((r) => groups.set(r.nodeId ?? "subject", [...(groups.get(r.nodeId ?? "subject") ?? []), r]));

  const actionLabel = { UPDATE: "Edited", CREATE: "Created", DELETE: "Deleted" } as const;

  return (
    <div className="max-w-3xl space-y-4">
      {!trash && <p className="text-xs text-gray-500">The last 3 versions of each item are kept. Older ones are removed automatically.</p>}
      {[...groups.entries()].map(([key, revs]) => {
        const first = revs[0];
        const title = key === "subject" ? "Subject overview" : `${NODE_LABEL[first.node?.type ?? "CHAPTER"]}: ${first.node?.title ?? "(removed)"}`;
        return (
          <div key={key} className="overflow-hidden rounded-xl border border-gray-800">
            <div className="bg-gray-900 px-4 py-2 text-sm font-medium text-gray-200">{title}</div>
            <ul className="divide-y divide-gray-800">
              {revs.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="w-16 text-xs text-gray-400">{actionLabel[r.action]}</span>
                  <span className="min-w-0 flex-1 text-xs text-gray-500">
                    {timeAgo(r.createdAt)} by @{r.changedBy.username}
                    {r.changeNote && <span className="text-gray-400"> · “{r.changeNote}”</span>}
                  </span>
                  {r.action === "UPDATE" && (
                    <Button size="sm" variant="ghost" onClick={() => setViewing(r)}>
                      <Eye className="mr-1 h-3.5 w-3.5" /> View
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => restore(r)}>
                    <RotateCcw className="mr-1 h-3.5 w-3.5" /> {r.action === "CREATE" ? "Undo" : "Restore"}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <Modal open={!!viewing} onClose={() => setViewing(null)} size="xl" title="Version before this change" description={viewing ? `Saved ${timeAgo(viewing.createdAt)} by @${viewing.changedBy.username}` : ""}>
        {viewing && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">{viewing.snapshot.title}</h3>
            {viewing.snapshot.summary && <p className="text-sm text-gray-400">{viewing.snapshot.summary}</p>}
            <RichView html={viewing.snapshot.content ?? ""} />
          </div>
        )}
      </Modal>
    </div>
  );
}

// -------------------------------------------------------------------- page

function ManageView() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const [subject, setSubject] = useState<SubjectDetail | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "settings");

  const load = useCallback(() => {
    subjectsApi.get(id).then(setSubject).catch((e: Error) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  const changeTab = (t: Tab) => {
    setTab(t);
    router.replace(`/subjects/${id}/manage?tab=${t}`, { scroll: false });
  };

  if (error) return <Alert className="mx-auto mt-10 max-w-lg">{error}</Alert>;
  if (!subject) return <Spinner />;
  if (!subject.access.canManage) return <Alert className="mx-auto mt-10 max-w-lg">Only the owner or an admin can manage this subject.</Alert>;

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/subjects/${id}`} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200">
          <ArrowLeft className="h-4 w-4" /> {subject.title}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">Manage subject</h1>
          <VisibilityBadge value={subject.visibility} />
        </div>
        {!subject.access.isOwner && (
          <p className="mt-1 text-xs text-gray-500">Owned by {subject.owner.name} @{subject.owner.username}. You&apos;re managing it as an admin.</p>
        )}
      </div>
      <Tabs
        value={tab}
        onChange={changeTab}
        tabs={[
          { value: "settings", label: "Settings" },
          { value: "sharing", label: subject.access.isAdmin && !subject.access.isOwner ? "Assign" : "Sharing" },
          { value: "changes", label: "Proposed changes", count: subject.pendingChanges },
          { value: "requests", label: "Access requests", count: subject.pendingAccessRequests },
          { value: "structure", label: subject.visibility === "LISTED" ? "Structure & preview" : "Structure" },
          { value: "history", label: "Version history" },
          { value: "trash", label: "Trash" },
        ]}
      />
      {tab === "settings" && <SettingsTab subject={subject} reload={load} />}
      {tab === "sharing" && <SharingTab subject={subject} />}
      {tab === "changes" && <ChangesTab subject={subject} reload={load} />}
      {tab === "requests" && <RequestsTab subject={subject} reload={load} />}
      {tab === "structure" && <StructureTab subject={subject} reload={load} />}
      {tab === "history" && <HistoryTab subject={subject} reload={load} />}
      {tab === "trash" && <HistoryTab subject={subject} reload={load} trash />}
    </div>
  );
}

export default function ManagePage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ManageView />
    </Suspense>
  );
}
