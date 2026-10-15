"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2, Circle, CircleDot, RefreshCw } from "lucide-react";
import { progressApi, type Rollup, type RollupState } from "@/lib/api";
import { cn } from "@/lib/utils";

const LABEL: Record<RollupState, string> = {
  none: "Not started",
  progress: "In progress",
  done: "Completed",
  outdated: "Completed — updated since you read it",
};

/** Green tick when complete, orange tick when content changed after reading. */
export function ProgressTick({
  state,
  percent,
  className,
  showEmpty = true,
}: {
  state: RollupState;
  percent?: number;
  className?: string;
  showEmpty?: boolean;
}) {
  const title = state === "progress" && percent !== undefined ? `${LABEL[state]} · ${percent}%` : LABEL[state];
  if (state === "done") {
    return <CheckCircle2 aria-label={title} className={cn("h-3.5 w-3.5 shrink-0 text-emerald-400", className)}><title>{title}</title></CheckCircle2>;
  }
  if (state === "outdated") {
    return <CheckCircle2 aria-label={title} className={cn("h-3.5 w-3.5 shrink-0 text-orange-400", className)}><title>{title}</title></CheckCircle2>;
  }
  if (state === "progress") {
    return <CircleDot aria-label={title} className={cn("h-3.5 w-3.5 shrink-0 text-indigo-400", className)}><title>{title}</title></CircleDot>;
  }
  if (!showEmpty) return null;
  return <Circle aria-label={title} className={cn("h-3.5 w-3.5 shrink-0 text-gray-700", className)}><title>{title}</title></Circle>;
}

export function ProgressBar({ p, className, compact }: { p: Rollup; className?: string; compact?: boolean }) {
  const outdatedPct = p.total ? (p.outdated / p.total) * 100 : 0;
  return (
    <div className={cn("space-y-1", className)}>
      {!compact && (
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-gray-400">
            <ProgressTick state={p.state} />
            {p.state === "done" ? "Completed" : p.state === "outdated" ? "Completed · updates to read" : `${p.done} of ${p.total} read`}
          </span>
          <span className={cn("font-semibold", p.state === "done" ? "text-emerald-300" : p.state === "outdated" ? "text-orange-300" : "text-gray-300")}>
            {p.percent}%
          </span>
        </div>
      )}
      <div className="flex h-1.5 overflow-hidden rounded-full bg-gray-800" role="progressbar" aria-valuenow={p.percent} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn("h-full transition-all duration-500", p.state === "done" ? "bg-emerald-500" : "bg-indigo-500")} style={{ width: `${p.percent}%` }} />
        {outdatedPct > 0 && <div className="h-full bg-orange-400/80 transition-all duration-500" style={{ width: `${outdatedPct}%` }} title={`${p.outdated} updated since you read them`} />}
      </div>
      {!compact && p.outdated > 0 && (
        <p className="flex items-center gap-1 text-[11px] text-orange-300/90">
          <RefreshCw className="h-3 w-3" /> {p.outdated} item{p.outdated > 1 ? "s" : ""} updated since you read {p.outdated > 1 ? "them" : "it"}
        </p>
      )}
    </div>
  );
}

const BEAT_MS = 30_000;

/**
 * Records reading time for the item on screen. Only counts while the tab is
 * visible; the data is stored for later time-to-complete reports.
 */
export function useStudyTracker(subjectId: string, nodeId: string | null, enabled: boolean) {
  const since = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const visible = () => document.visibilityState === "visible";
    since.current = visible() ? Date.now() : null;
    progressApi.heartbeat(subjectId, nodeId, 0, true).catch(() => {});

    const flush = () => {
      if (since.current === null) return;
      const seconds = Math.round((Date.now() - since.current) / 1000);
      since.current = visible() ? Date.now() : null;
      if (seconds > 0) progressApi.heartbeat(subjectId, nodeId, Math.min(seconds, 120)).catch(() => {});
    };
    const onVisibility = () => {
      if (visible()) since.current = Date.now();
      else flush();
    };
    const timer = setInterval(flush, BEAT_MS);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, [subjectId, nodeId, enabled]);
}
