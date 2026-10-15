import { Globe, Lock, Eye, Megaphone, PenLine, Crown, FileClock } from "lucide-react";
import type { MemberRole, PublishStatus, Visibility } from "@/lib/api";
import { cn } from "@/lib/utils";

const pill = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium";

export function VisibilityBadge({ value }: { value: Visibility }) {
  const map = {
    PUBLIC: { icon: Globe, label: "Public", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
    LISTED: { icon: Megaphone, label: "Listed", cls: "border-sky-500/30 bg-sky-500/10 text-sky-300" },
    PRIVATE: { icon: Lock, label: "Private", cls: "border-gray-600 bg-gray-800 text-gray-300" },
  }[value];
  return (
    <span className={cn(pill, map.cls)} title={visibilityHelp[value]}>
      <map.icon className="h-3 w-3" />
      {map.label}
    </span>
  );
}

export const visibilityHelp: Record<Visibility, string> = {
  PUBLIC: "In the catalog. Everyone who signs in can open all of it.",
  LISTED: "In the catalog with a preview of the parts you choose. Full access on request.",
  PRIVATE: "Only the owner, people it is shared with or assigned to, and admins.",
};

export function StatusBadge({ value }: { value: PublishStatus }) {
  return value === "PUBLISHED" ? null : (
    <span className={cn(pill, "border-amber-500/30 bg-amber-500/10 text-amber-300")}>
      <FileClock className="h-3 w-3" />
      Draft
    </span>
  );
}

export function AccessBadge({ isOwner, role }: { isOwner?: boolean; role?: MemberRole | null }) {
  if (isOwner) {
    return (
      <span className={cn(pill, "border-indigo-500/30 bg-indigo-500/10 text-indigo-300")}>
        <Crown className="h-3 w-3" /> Owner
      </span>
    );
  }
  if (role === "EDITOR") {
    return (
      <span className={cn(pill, "border-purple-500/30 bg-purple-500/10 text-purple-300")}>
        <PenLine className="h-3 w-3" /> Editor
      </span>
    );
  }
  if (role === "VIEWER") {
    return (
      <span className={cn(pill, "border-gray-600 bg-gray-800 text-gray-300")}>
        <Eye className="h-3 w-3" /> Viewer
      </span>
    );
  }
  return null;
}

export function TagList({ tags, onClick }: { tags: string | null; onClick?: (t: string) => void }) {
  if (!tags) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.split(",").map((t) => (
        <button
          key={t}
          type="button"
          disabled={!onClick}
          onClick={() => onClick?.(t)}
          className="rounded bg-gray-800 px-1.5 py-0.5 text-[11px] text-gray-400 enabled:hover:bg-gray-700 enabled:hover:text-gray-200"
        >
          #{t}
        </button>
      ))}
    </div>
  );
}
