import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getXpForLevel(level: number): number {
  const thresholds = [
    0, 100, 250, 500, 1000, 2000, 3500, 5500, 8000, 12000, 17000, 23000,
    30000, 40000, 55000, 75000, 100000,
  ];
  return thresholds[level] || thresholds[thresholds.length - 1] * 2;
}

export function getDifficultyColor(difficulty: string): string {
  const colors: Record<string, string> = {
    beginner: "text-green-400",
    intermediate: "text-yellow-400",
    advanced: "text-orange-400",
    expert: "text-red-400",
  };
  return colors[difficulty] || "text-gray-400";
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    PENDING: "bg-gray-500/20 text-gray-300 border border-gray-500/30",
    IN_PROGRESS: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30",
    COMPLETED: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
    SKIPPED: "bg-gray-500/10 text-gray-500 border border-gray-600/30",
    OVERDUE: "bg-red-500/15 text-red-300 border border-red-500/30",
  };
  return colors[status] || "bg-gray-500/20 text-gray-400";
}

export function timeAgo(date: string | Date): string {
  const s = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return formatDate(date);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Local calendar date as YYYY-MM-DD. */
export function localDate(d = new Date()): string {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" plus n days. */
export function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function formatDay(ymd: string): string {
  return new Date(`${ymd}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export const NODE_LABEL: Record<string, string> = {
  SUBJECT: "Subject",
  CHAPTER: "Chapter",
  TOPIC: "Topic",
  SUBTOPIC: "Subtopic",
};

export const CHILD_TYPE: Record<string, "CHAPTER" | "TOPIC" | "SUBTOPIC" | null> = {
  SUBJECT: "CHAPTER",
  CHAPTER: "TOPIC",
  TOPIC: "SUBTOPIC",
  SUBTOPIC: null,
};
