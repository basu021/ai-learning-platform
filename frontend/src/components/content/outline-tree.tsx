"use client";

import { useState } from "react";
import { ChevronRight, Lock, Plus, BookOpen, FileText, Hash, Sparkles } from "lucide-react";
import type { NodeProgress, NodeType, OutlineNode } from "@/lib/api";
import { ProgressTick } from "@/components/progress/progress";
import { cn, CHILD_TYPE, NODE_LABEL } from "@/lib/utils";

const ICONS: Record<NodeType, React.ComponentType<{ className?: string }>> = {
  CHAPTER: BookOpen,
  TOPIC: FileText,
  SUBTOPIC: Hash,
};

function collectOpen(nodes: OutlineNode[], selected: string | null): Set<string> {
  // Expand the path to the selected node, and all chapters by default.
  const open = new Set<string>();
  const walk = (list: OutlineNode[], trail: string[]): boolean =>
    list.some((n) => {
      if (n.id === selected) {
        trail.forEach((t) => open.add(t));
        open.add(n.id);
        return true;
      }
      return walk(n.children, [...trail, n.id]);
    });
  walk(nodes, []);
  nodes.forEach((n) => open.add(n.id));
  return open;
}

export function OutlineTree({
  nodes,
  selectedId,
  onSelect,
  onAdd,
  showPreviewMarks,
  progress,
}: {
  nodes: OutlineNode[];
  selectedId: string | null;
  onSelect: (node: OutlineNode) => void;
  /** Show "+" to add a child under a node (or under the subject when parent is null). */
  onAdd?: (parent: OutlineNode | null, type: NodeType) => void;
  showPreviewMarks?: boolean;
  /** Reading progress per node id; shows ticks when provided. */
  progress?: Record<string, NodeProgress>;
}) {
  const [open, setOpen] = useState<Set<string>>(() => collectOpen(nodes, selectedId));
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const render = (list: OutlineNode[], depth: number) =>
    list.map((n) => {
      const Icon = ICONS[n.type];
      const childType = CHILD_TYPE[n.type];
      const expanded = open.has(n.id);
      const hasKids = n.children.length > 0;
      return (
        <li key={n.id}>
          <div
            className={cn(
              "group flex items-center gap-1 rounded-md pr-1 text-sm",
              selectedId === n.id ? "bg-indigo-500/15 text-indigo-200" : "text-gray-300 hover:bg-gray-800/60",
            )}
            style={{ paddingLeft: depth * 14 + 4 }}
          >
            <button
              type="button"
              onClick={() => toggle(n.id)}
              className={cn("rounded p-0.5 text-gray-500 hover:text-gray-300", !hasKids && "invisible")}
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-90")} />
            </button>
            <button
              type="button"
              onClick={() => onSelect(n)}
              className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left"
              title={`${NODE_LABEL[n.type]}: ${n.title}`}
            >
              <Icon className={cn("h-3.5 w-3.5 shrink-0", n.locked ? "text-gray-600" : "text-gray-500")} />
              <span className={cn("truncate", n.locked && "text-gray-500")}>{n.title}</span>
              {n.locked && <Lock className="h-3 w-3 shrink-0 text-gray-600" />}
              {progress?.[n.id] && !n.locked && (
                <ProgressTick state={progress[n.id].state} percent={progress[n.id].percent} showEmpty={false} className="ml-auto" />
              )}
              {showPreviewMarks && n.isPreview && (
                <span title="Visible in catalog preview"><Sparkles className="h-3 w-3 shrink-0 text-sky-400" /></span>
              )}
            </button>
            {onAdd && childType && !n.locked && (
              <button
                type="button"
                onClick={() => onAdd(n, childType)}
                className="rounded p-1 text-gray-500 opacity-0 hover:bg-gray-700 hover:text-gray-200 group-hover:opacity-100"
                title={`Add ${NODE_LABEL[childType].toLowerCase()}`}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {hasKids && expanded && <ul>{render(n.children, depth + 1)}</ul>}
        </li>
      );
    });

  return (
    <div>
      {nodes.length === 0 ? (
        <p className="px-2 py-3 text-xs text-gray-500">No chapters yet.</p>
      ) : (
        <ul className="space-y-0.5">{render(nodes, 0)}</ul>
      )}
      {onAdd && (
        <button
          type="button"
          onClick={() => onAdd(null, "CHAPTER")}
          className="mt-2 flex w-full items-center gap-1.5 rounded-md border border-dashed border-gray-700 px-2 py-1.5 text-xs text-gray-400 hover:border-indigo-500/50 hover:text-indigo-300"
        >
          <Plus className="h-3.5 w-3.5" /> Add chapter
        </button>
      )}
    </div>
  );
}

/** Flatten an outline for <select> pickers (task scope etc.). */
export function flattenOutline(nodes: OutlineNode[], depth = 0): { node: OutlineNode; depth: number }[] {
  return nodes.flatMap((n) => [{ node: n, depth }, ...flattenOutline(n.children, depth + 1)]);
}
