"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Settings2,
  Trash2,
  Lock,
  KeyRound,
  ListPlus,
  GitPullRequest,
  ChevronRight,
  Clock,
  Info,
  CheckCircle2,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, Spinner } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { RichView } from "@/components/editor/rich-editor";
import { OutlineTree } from "@/components/content/outline-tree";
import { Breadcrumb } from "@/components/content/breadcrumb";
import { AttachmentsPanel } from "@/components/content/attachments-panel";
import { AccessBadge, StatusBadge, TagList, VisibilityBadge } from "@/components/content/badges";
import { TaskFormModal } from "@/components/tasks/task-form";
import { progressApi, subjectsApi, type ItemState, type NodeDetail, type NodeType, type OutlineNode, type SubjectDetail, type SubjectProgress } from "@/lib/api";
import { ProgressBar, ProgressTick, useStudyTracker } from "@/components/progress/progress";
import { CHILD_TYPE, NODE_LABEL, formatDate, timeAgo } from "@/lib/utils";

function RequestAccess({ subject, onDone }: { subject: SubjectDetail; onDone: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = subject.access.lastRequest?.status === "PENDING";
  const rejected = subject.access.lastRequest?.status === "REJECTED";

  const send = async () => {
    setBusy(true);
    try {
      await subjectsApi.requestAccess(subject.id, message);
      toast.success("Request sent. You'll be notified when it's reviewed.");
      setOpen(false);
      onDone();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-5">
      <div className="flex items-start gap-3">
        <KeyRound className="mt-0.5 h-5 w-5 text-sky-400" />
        <div className="flex-1">
          <h3 className="font-semibold text-sky-100">You&apos;re viewing a preview</h3>
          <p className="mt-1 text-sm text-sky-200/70">
            Some chapters are open as a preview. Request access to unlock everything in this subject.
          </p>
          {rejected && <p className="mt-2 text-xs text-gray-400">Your previous request was declined. You can ask again.</p>}
          <div className="mt-3">
            {pending ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-sky-500/10 px-3 py-1.5 text-sm text-sky-300">
                <Clock className="h-4 w-4" /> Request pending since {timeAgo(subject.access.lastRequest!.createdAt)}
              </span>
            ) : (
              <Button size="sm" onClick={() => setOpen(true)}>Request access</Button>
            )}
          </div>
        </div>
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Request access to ${subject.title}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={send} disabled={busy}>{busy ? "Sending…" : "Send request"}</Button>
          </>
        }
      >
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Optional: why you need it, your team…" maxLength={1000} />
      </Modal>
    </div>
  );
}

function ReadBar({
  own,
  completedAt,
  label,
  busy,
  onComplete,
  onUncomplete,
}: {
  own: ItemState;
  completedAt: string | null;
  label: string;
  busy: boolean;
  onComplete: () => void;
  onUncomplete: () => void;
}) {
  if (own === "done") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3">
        <span className="flex items-center gap-2 text-sm text-emerald-300">
          <CheckCircle2 className="h-5 w-5" /> You read this {label}
          {completedAt && <span className="text-xs text-emerald-400/60">on {formatDate(completedAt)}</span>}
        </span>
        <Button size="sm" variant="ghost" onClick={onUncomplete} disabled={busy}>Mark as unread</Button>
      </div>
    );
  }
  if (own === "outdated") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-500/30 bg-orange-500/5 px-4 py-3">
        <span className="flex items-center gap-2 text-sm text-orange-200">
          <RefreshCw className="h-5 w-5 text-orange-400" /> This {label} was updated after you read it. Read the changes, then mark it again.
        </span>
        <Button size="sm" onClick={onComplete} disabled={busy} className="bg-orange-600 shadow-orange-500/25 hover:bg-orange-700">
          <CheckCircle2 className="mr-1 h-4 w-4" /> Mark as read again
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-3">
      <span className="text-sm text-gray-400">Finished reading this {label}?</span>
      <Button size="sm" variant="success" onClick={onComplete} disabled={busy}>
        <CheckCircle2 className="mr-1 h-4 w-4" /> Mark as read
      </Button>
    </div>
  );
}

function SubjectView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const nodeId = params.get("node");

  const [subject, setSubject] = useState<SubjectDetail | null>(null);
  const [node, setNode] = useState<NodeDetail | null>(null);
  const [error, setError] = useState("");
  const [taskOpen, setTaskOpen] = useState(false);
  const [progress, setProgress] = useState<SubjectProgress | null>(null);
  const [marking, setMarking] = useState(false);

  const loadProgress = useCallback(() => {
    progressApi.get(id).then(setProgress).catch(() => setProgress(null));
  }, [id]);

  const loadSubject = useCallback(() => {
    loadProgress();
    return subjectsApi.get(id).then(setSubject).catch((e: Error) => setError(e.message));
  }, [id, loadProgress]);

  const loadNode = useCallback(() => {
    if (!nodeId) {
      setNode(null);
      return;
    }
    subjectsApi.getNode(id, nodeId).then(setNode).catch((e: Error) => toast.error(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, nodeId]);

  useEffect(() => {
    void loadSubject();
  }, [loadSubject]);
  useEffect(() => {
    loadNode();
  }, [loadNode]);

  // Reading time is recorded for whatever readable item is on screen.
  useStudyTracker(id, nodeId, !!subject?.access.canView && !node?.locked);

  if (error) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <Alert>{error}</Alert>
        <Link href="/library" className="mt-4 inline-block text-sm text-indigo-400 hover:underline">Back to library</Link>
      </div>
    );
  }
  if (!subject) return <Spinner />;

  const a = subject.access;
  const select = (n: OutlineNode) => router.push(`/subjects/${id}?node=${n.id}`, { scroll: false });
  const addChild = (parent: OutlineNode | null, type: NodeType) =>
    router.push(`/subjects/${id}/edit?type=${type}${parent ? `&parent=${parent.id}` : ""}`);

  const deleteNode = async () => {
    if (!node) return;
    const what = `${NODE_LABEL[node.type].toLowerCase()} "${node.title}"`;
    if (!confirm(a.editsNeedApproval ? `Propose deleting the ${what}? The owner must approve.` : `Delete the ${what} and everything inside it? You can restore it from Manage → Trash.`)) return;
    try {
      const r = await subjectsApi.deleteNode(id, node.id);
      if (r.pending) toast.info("Deletion sent to the owner for approval");
      else {
        toast.success("Deleted");
        router.push(node.parentId ? `/subjects/${id}?node=${node.parentId}` : `/subjects/${id}`);
        void loadSubject();
      }
    } catch (e) {
      toast.error(e);
    }
  };

  const showing = node ?? null;
  const locked = showing?.locked ?? false;
  const childType = CHILD_TYPE[showing ? showing.type : "SUBJECT"];
  // Progress of the item on screen: its own read state and the rollup of everything under it.
  const nodeProgress = showing ? progress?.nodes[showing.id] : undefined;
  const rollup = showing ? nodeProgress : progress;
  const ownState: ItemState | null = locked ? null : showing ? (nodeProgress?.own ?? null) : (progress?.overview ?? null);

  const mark = async (complete: boolean) => {
    setMarking(true);
    try {
      const next = complete
        ? await progressApi.complete(id, showing?.id ?? null)
        : await progressApi.uncomplete(id, showing?.id ?? null);
      setProgress(next);
      if (complete && showing) {
        const d = next.nodes[showing.id];
        if (d?.state === "done" && showing.parentId) toast.success(`${NODE_LABEL[showing.type]} complete`);
      }
      if (complete && next.state === "done") toast.success(`You've completed ${subject.title}!`);
    } catch (e) {
      toast.error(e);
    } finally {
      setMarking(false);
    }
  };

  const startOver = async () => {
    const what = showing ? `this ${NODE_LABEL[showing.type].toLowerCase()} and everything in it` : "the whole subject";
    if (!confirm(`Clear your read marks for ${what} and start over? Your reading time history is kept.`)) return;
    setMarking(true);
    try {
      setProgress(await progressApi.reset(id, showing?.id ?? null));
      toast.info("Progress reset — start over whenever you're ready");
    } catch (e) {
      toast.error(e);
    } finally {
      setMarking(false);
    }
  };
  const editHref = showing ? `/subjects/${id}/edit?node=${showing.id}` : `/subjects/${id}/edit`;
  const children: { id: string; title: string; summary: string | null; locked: boolean }[] = showing
    ? showing.children.map((c) => ({ ...c, locked: false }))
    : subject.outline.map((c) => ({ id: c.id, title: c.title, summary: null, locked: c.locked }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/library" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200">
          <ArrowLeft className="h-4 w-4" /> Library
        </Link>
        <div className="flex flex-wrap gap-2">
          {a.canManage && (
            <Link href={`/subjects/${id}/manage`}>
              <Button size="sm" variant="outline">
                <Settings2 className="mr-1 h-3.5 w-3.5" /> Manage
                {subject.pendingChanges + subject.pendingAccessRequests > 0 && (
                  <span className="ml-1.5 rounded-full bg-amber-500/25 px-1.5 text-[11px] text-amber-200">
                    {subject.pendingChanges + subject.pendingAccessRequests}
                  </span>
                )}
              </Button>
            </Link>
          )}
          {a.canView && (
            <Button size="sm" variant="outline" onClick={() => setTaskOpen(true)}>
              <ListPlus className="mr-1 h-3.5 w-3.5" /> Practice this
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr] xl:grid-cols-[260px_1fr_280px]">
        {/* Outline */}
        <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          <Link
            href={`/subjects/${id}`}
            scroll={false}
            className={`mb-2 flex items-center gap-2 rounded-md px-2 py-2 text-sm font-semibold ${!nodeId ? "bg-indigo-500/15 text-indigo-200" : "text-gray-200 hover:bg-gray-800/60"}`}
          >
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: subject.color || "#6366f1" }} />
            <span className="truncate">{subject.title}</span>
            {progress && <ProgressTick state={progress.state} percent={progress.percent} showEmpty={false} className="ml-auto" />}
          </Link>
          <OutlineTree
            key={subject.updatedAt + subject.outline.length}
            nodes={subject.outline}
            selectedId={nodeId}
            onSelect={select}
            onAdd={a.canEdit ? addChild : undefined}
            showPreviewMarks={a.canManage && subject.visibility === "LISTED"}
            progress={progress?.nodes}
          />
          {a.editsNeedApproval && (
            <p className="mt-3 flex gap-1.5 px-2 text-[11px] text-gray-500">
              <Info className="h-3.5 w-3.5 shrink-0" /> Your edits go to @{subject.owner.username} for approval.
            </p>
          )}
        </aside>

        {/* Content */}
        <article className="min-w-0 space-y-5">
          <header className="space-y-2">
            {showing && <Breadcrumb items={[{ id: subject.id, title: subject.title, type: "SUBJECT" }, ...showing.breadcrumb.slice(0, -1)]} subjectId={id} />}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
                  {showing ? NODE_LABEL[showing.type] : "Subject"}
                </p>
                <h1 className="mt-0.5 text-2xl font-bold text-gray-100">{showing ? showing.title : subject.title}</h1>
              </div>
              {a.canEdit && !locked && (
                <div className="flex gap-2">
                  <Link href={editHref}>
                    <Button size="sm" variant="secondary"><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button>
                  </Link>
                  {showing && (
                    <Button size="sm" variant="ghost" onClick={deleteNode} title="Delete">
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </Button>
                  )}
                </div>
              )}
            </div>
            {!showing && (
              <div className="flex flex-wrap items-center gap-1.5">
                <VisibilityBadge value={subject.visibility} />
                <StatusBadge value={subject.status} />
                <AccessBadge isOwner={a.isOwner} role={a.memberRole} />
              </div>
            )}
            {(showing ? showing.summary : subject.summary) && (
              <p className="text-base text-gray-400">{showing ? showing.summary : subject.summary}</p>
            )}
            {progress && rollup && rollup.total > (ownState ? 1 : 0) && (
              <div className="flex flex-wrap items-end gap-3 pt-1">
                <ProgressBar p={rollup} className="min-w-[220px] flex-1" />
                {(rollup.done > 0 || rollup.outdated > 0) && (
                  <Button size="sm" variant="ghost" onClick={startOver} disabled={marking} title="Clear read marks and start again">
                    <RotateCcw className="mr-1 h-3.5 w-3.5" /> Start over
                  </Button>
                )}
              </div>
            )}
            {showing && a.canManage && showing.pendingChanges > 0 && (
              <Link href={`/subjects/${id}/manage?tab=changes`} className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300 hover:bg-amber-500/20">
                <GitPullRequest className="h-3.5 w-3.5" /> {showing.pendingChanges} proposed change{showing.pendingChanges > 1 ? "s" : ""} to review
              </Link>
            )}
          </header>

          {!showing && a.previewOnly && <RequestAccess subject={subject} onDone={loadSubject} />}

          {locked ? (
            <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-8 text-center">
              <Lock className="mx-auto h-8 w-8 text-gray-600" />
              <p className="mt-3 font-medium text-gray-300">This part isn&apos;t in the preview</p>
              <p className="mt-1 text-sm text-gray-500">Request access to the subject to read it.</p>
              <Link href={`/subjects/${id}`} className="mt-3 inline-block text-sm text-indigo-400 hover:underline">Go to subject overview</Link>
            </div>
          ) : (
            <>
              {showing === null && nodeId ? (
                <Spinner />
              ) : (showing ? showing.content : subject.content) ? (
                <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-5">
                  <RichView html={showing ? showing.content : subject.content} />
                </div>
              ) : (
                a.canEdit && (
                  <div className="rounded-xl border border-dashed border-gray-800 p-6 text-center text-sm text-gray-500">
                    No content yet.{" "}
                    <Link href={editHref} className="text-indigo-400 hover:underline">Write it now</Link>
                  </div>
                )
              )}

              {progress && ownState && (showing !== null || !nodeId) && (
                <ReadBar
                  own={ownState}
                  completedAt={showing ? (progress.nodes[showing.id]?.completedAt ?? null) : progress.overviewCompletedAt}
                  label={showing ? NODE_LABEL[showing.type].toLowerCase() : "overview"}
                  busy={marking}
                  onComplete={() => mark(true)}
                  onUncomplete={() => mark(false)}
                />
              )}

              {childType && (children.length > 0 || a.canEdit) && (
                <section>
                  <h2 className="mb-2 text-sm font-semibold text-gray-300">
                    {NODE_LABEL[childType]}s{" "}
                    <span className="font-normal text-gray-500">{children.length}</span>
                  </h2>
                  <div className="divide-y divide-gray-800 rounded-xl border border-gray-800 bg-gray-900/40">
                    {children.map((c) => (
                      <Link
                        key={c.id}
                        href={`/subjects/${id}?node=${c.id}`}
                        scroll={false}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800/40"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 text-sm font-medium text-gray-200">
                            {c.title}
                            {c.locked && <Lock className="h-3 w-3 text-gray-600" />}
                          </p>
                          {c.summary && <p className="truncate text-xs text-gray-500">{c.summary}</p>}
                        </div>
                        {progress?.nodes[c.id] && !c.locked && (
                          <span className="flex items-center gap-1.5 text-xs text-gray-500">
                            {progress.nodes[c.id].total > 1 && progress.nodes[c.id].state !== "none" && `${progress.nodes[c.id].percent}%`}
                            <ProgressTick state={progress.nodes[c.id].state} percent={progress.nodes[c.id].percent} className="h-4 w-4" />
                          </span>
                        )}
                        <ChevronRight className="h-4 w-4 text-gray-600" />
                      </Link>
                    ))}
                    {a.canEdit && (
                      <Link
                        href={`/subjects/${id}/edit?type=${childType}${showing ? `&parent=${showing.id}` : ""}`}
                        className="block px-4 py-2.5 text-sm text-indigo-400 hover:bg-gray-800/40"
                      >
                        + Add {NODE_LABEL[childType].toLowerCase()}
                      </Link>
                    )}
                  </div>
                </section>
              )}
            </>
          )}
        </article>

        {/* Side panel */}
        <aside className="space-y-4 lg:col-span-2 xl:col-span-1">
          <div className="space-y-3 rounded-xl border border-gray-800 bg-gray-900/50 p-4 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-gray-500">Owner</span>
              <span className="text-gray-200">{subject.owner.name} <span className="text-gray-500">@{subject.owner.username}</span></span>
            </div>
            {subject.category && (
              <div className="flex justify-between gap-2">
                <span className="text-gray-500">Category</span>
                <span className="text-gray-200">{subject.category.name}</span>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <span className="text-gray-500">Updated</span>
              <span className="text-gray-200">{timeAgo(showing?.updatedAt ?? subject.updatedAt)}</span>
            </div>
            {a.canManage && (
              <div className="flex justify-between gap-2">
                <span className="text-gray-500">Shared with</span>
                <Link href={`/subjects/${id}/manage?tab=sharing`} className="text-indigo-400 hover:underline">{subject.memberCount} people</Link>
              </div>
            )}
            <TagList tags={subject.tags} />
          </div>

          {a.canView && !locked && (
            <AttachmentsPanel
              subjectId={id}
              nodeId={showing?.id ?? null}
              items={showing ? showing.attachments : subject.attachments}
              canManage={a.canManage}
              onChange={() => (showing ? loadNode() : void loadSubject())}
            />
          )}

          {a.canView && (
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
              <h4 className="text-sm font-semibold text-gray-200">Practice</h4>
              <p className="mt-1 text-xs text-gray-500">
                Schedule recurring practice for {showing ? `this ${NODE_LABEL[showing.type].toLowerCase()}` : "the whole subject"}.
                {showing && showing.taskCount > 0 && ` You have ${showing.taskCount} task${showing.taskCount > 1 ? "s" : ""} here.`}
              </p>
              <Button size="sm" className="mt-3 w-full" onClick={() => setTaskOpen(true)}>
                <ListPlus className="mr-1 h-3.5 w-3.5" /> Create practice task
              </Button>
            </div>
          )}
        </aside>
      </div>

      <TaskFormModal
        open={taskOpen}
        onClose={() => setTaskOpen(false)}
        onSaved={() => { loadNode(); }}
        defaults={{ subjectId: id, nodeId: showing?.id ?? null }}
      />
    </div>
  );
}

export default function SubjectPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <SubjectView />
    </Suspense>
  );
}
