"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, Field, Spinner } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { RichEditor } from "@/components/editor/rich-editor";
import { Breadcrumb } from "@/components/content/breadcrumb";
import { subjectsApi, type Crumb, type NodeType, type SubjectDetail } from "@/lib/api";
import { NODE_LABEL } from "@/lib/utils";

function EditView() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const nodeId = params.get("node");
  const createType = params.get("type") as NodeType | null;
  const parentId = params.get("parent");
  const creating = !!createType && !nodeId;

  const [subject, setSubject] = useState<SubjectDetail | null>(null);
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const [form, setForm] = useState({ title: "", summary: "", content: "", changeNote: "" });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await subjectsApi.get(id);
        setSubject(s);
        const root: Crumb = { id: s.id, title: s.title, type: "SUBJECT" };
        if (nodeId) {
          const n = await subjectsApi.getNode(id, nodeId);
          setForm({ title: n.title, summary: n.summary ?? "", content: n.content ?? "", changeNote: "" });
          setCrumbs([root, ...n.breadcrumb]);
        } else if (creating) {
          const parent = parentId ? await subjectsApi.getNode(id, parentId) : null;
          setCrumbs(parent ? [root, ...parent.breadcrumb] : [root]);
        } else {
          setForm({ title: s.title, summary: s.summary ?? "", content: s.content ?? "", changeNote: "" });
          setCrumbs([root]);
        }
        setLoaded(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load");
      }
    })();
  }, [id, nodeId, creating, parentId]);

  if (error && !loaded) return <Alert className="mx-auto mt-10 max-w-lg">{error}</Alert>;
  if (!subject || !loaded) return <Spinner />;
  if (!subject.access.canEdit) {
    return <Alert className="mx-auto mt-10 max-w-lg">You don&apos;t have edit access to this subject.</Alert>;
  }

  const kind = creating ? NODE_LABEL[createType!] : nodeId ? NODE_LABEL[crumbs[crumbs.length - 1]?.type ?? "CHAPTER"] : "Subject";
  const backHref = nodeId ? `/subjects/${id}?node=${nodeId}` : parentId ? `/subjects/${id}?node=${parentId}` : `/subjects/${id}`;
  const set = <K extends keyof typeof form>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    setError("");
    const payload = {
      title: form.title.trim(),
      summary: form.summary.trim() || null,
      content: form.content || null,
      changeNote: form.changeNote.trim() || undefined,
    };
    try {
      const r = creating
        ? await subjectsApi.createNode(id, {
            type: createType!,
            parentId,
            title: payload.title,
            summary: payload.summary ?? undefined,
            content: payload.content ?? undefined,
            changeNote: payload.changeNote,
          })
        : nodeId
          ? await subjectsApi.editNode(id, nodeId, payload)
          : await subjectsApi.editContent(id, payload);
      if (r.pending) {
        toast.info(`Sent to @${subject.owner.username} for approval`);
        router.push(backHref);
      } else {
        toast.success(creating ? `${kind} created` : "Saved");
        router.push(creating && r.result ? `/subjects/${id}?node=${r.result.id}` : backHref);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <Link href={backHref} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <Breadcrumb items={crumbs} subjectId={id} className="mt-3" />
        <h1 className="mt-1 text-2xl font-bold">{creating ? `New ${kind.toLowerCase()}` : `Edit ${kind.toLowerCase()}`}</h1>
      </div>

      {subject.access.editsNeedApproval && (
        <Alert tone="warning" className="flex gap-2">
          <Info className="h-4 w-4 shrink-0" />
          <span>
            You&apos;re an editor. Saving sends your change to <b>@{subject.owner.username}</b> for approval. It won&apos;t be visible until they approve it.
          </span>
        </Alert>
      )}
      {error && <Alert>{error}</Alert>}

      <div className="space-y-4">
        <Field label="Title *">
          <Input value={form.title} onChange={(e) => set("title", e.target.value)} autoFocus={creating} maxLength={191} />
        </Field>
        <Field label="Summary" hint="Short description shown in lists and the outline.">
          <Textarea value={form.summary} onChange={(e) => set("summary", e.target.value)} rows={2} maxLength={1000} />
        </Field>
        <Field label="Content">
          <RichEditor
            value={form.content}
            onChange={(v) => set("content", v)}
            minHeight={380}
            placeholder="Explanations, commands, examples, diagrams… Paste or drop images straight in."
            onUploadImage={async (file) => (await subjectsApi.uploadAttachment(id, file, { inline: true })).url}
          />
        </Field>
        <Field label="Change note" hint="Kept in version history (last 3 versions are kept and can be restored by the owner).">
          <Input value={form.changeNote} onChange={(e) => set("changeNote", e.target.value)} maxLength={500} placeholder="What changed and why" />
        </Field>
      </div>

      <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-gray-800 bg-gray-950/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <Link href={backHref}>
          <Button variant="ghost">Cancel</Button>
        </Link>
        <Button onClick={save} disabled={saving || !form.title.trim()}>
          {saving ? "Saving…" : subject.access.editsNeedApproval ? "Submit for approval" : creating ? `Create ${kind.toLowerCase()}` : "Save"}
        </Button>
      </div>
    </div>
  );
}

export default function EditPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <EditView />
    </Suspense>
  );
}
