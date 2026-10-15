import Link from "next/link";
import { BookOpen, Users, GitPullRequest, KeyRound, Lock } from "lucide-react";
import type { SubjectListItem } from "@/lib/api";
import { timeAgo } from "@/lib/utils";
import { AccessBadge, StatusBadge, TagList, VisibilityBadge } from "./badges";

export function SubjectCard({ s, onTag }: { s: SubjectListItem; onTag?: (t: string) => void }) {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-gray-800 bg-gray-900/50 transition-colors hover:border-gray-700">
      <div className="h-1" style={{ background: s.color || "#6366f1" }} />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <VisibilityBadge value={s.visibility} />
          <StatusBadge value={s.status} />
          <AccessBadge isOwner={s.access.isOwner} role={s.access.memberRole} />
          {!s.access.hasAccess && (
            <span className="inline-flex items-center gap-1 rounded-full border border-gray-700 px-2 py-0.5 text-[11px] text-gray-400">
              <Lock className="h-3 w-3" /> {s.access.accessRequested ? "Access requested" : "Preview"}
            </span>
          )}
          {s.category && <span className="ml-auto text-[11px] text-gray-500">{s.category.name}</span>}
        </div>
        <div>
          <Link href={`/subjects/${s.id}`} className="text-base font-semibold text-gray-100 after:absolute after:inset-0 group-hover:text-indigo-300">
            {s.title}
          </Link>
          {s.summary && <p className="mt-1 line-clamp-2 text-sm text-gray-400">{s.summary}</p>}
        </div>
        <div className="relative z-10">
          <TagList tags={s.tags} onClick={onTag} />
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-gray-800 pt-3 text-[11px] text-gray-500">
          <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" /> {s.chapterCount} chapters</span>
          {s.access.canManage && <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {s.memberCount}</span>}
          <span>@{s.owner.username}</span>
          <span className="ml-auto">{timeAgo(s.updatedAt)}</span>
        </div>
        {(s.pendingChanges > 0 || s.pendingAccessRequests > 0) && (
          <div className="relative z-10 flex gap-2">
            {s.pendingChanges > 0 && (
              <Link href={`/subjects/${s.id}/manage?tab=changes`} className="flex items-center gap-1 rounded bg-amber-500/10 px-2 py-1 text-[11px] text-amber-300 hover:bg-amber-500/20">
                <GitPullRequest className="h-3 w-3" /> {s.pendingChanges} to review
              </Link>
            )}
            {s.pendingAccessRequests > 0 && (
              <Link href={`/subjects/${s.id}/manage?tab=requests`} className="flex items-center gap-1 rounded bg-sky-500/10 px-2 py-1 text-[11px] text-sky-300 hover:bg-sky-500/20">
                <KeyRound className="h-3 w-3" /> {s.pendingAccessRequests} access requests
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
