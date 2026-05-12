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
    pending: "bg-gray-500/20 text-gray-400",
    started: "bg-blue-500/20 text-blue-400",
    in_progress: "bg-yellow-500/20 text-yellow-400",
    completed: "bg-green-500/20 text-green-400",
    skipped: "bg-gray-500/20 text-gray-500",
    revision_required: "bg-purple-500/20 text-purple-400",
  };
  return colors[status] || "bg-gray-500/20 text-gray-400";
}
