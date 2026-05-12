const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

async function getToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("accessToken");
}

export async function api<T>(
  endpoint: string,
  options: ApiOptions = {},
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${endpoint}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers.Authorization = `Bearer ${refreshed}`;
      const retry = await fetch(`${API_URL}${endpoint}`, {
        method: options.method || "GET",
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      return retry.json() as Promise<T>;
    }
    if (typeof window !== "undefined") {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      window.location.href = "/auth/login";
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error((error as { message: string }).message || "Request failed");
  }

  return response.json() as Promise<T>;
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem("refreshToken");
  const userId = localStorage.getItem("userId");
  if (!refreshToken || !userId) return null;

  try {
    const response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, refreshToken }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      accessToken: string;
      refreshToken: string;
    };
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

export const authApi = {
  login: (email: string, password: string) =>
    api<{
      user: { id: string; email: string; name: string; level: number; totalXp: number };
      accessToken: string;
      refreshToken: string;
    }>("/api/auth/login", { method: "POST", body: { email, password } }),
  register: (name: string, email: string, password: string) =>
    api<{
      user: { id: string; email: string; name: string };
      accessToken: string;
      refreshToken: string;
    }>("/api/auth/register", { method: "POST", body: { name, email, password } }),
  profile: () =>
    api<{
      id: string;
      email: string;
      name: string;
      level: number;
      totalXp: number;
      dailyTaskCount: number;
      dailyHours: number;
      difficulty: string;
    }>("/api/auth/profile"),
  logout: () => api("/api/auth/logout", { method: "POST" }),
};

export const subjectsApi = {
  list: () => api<SubjectWithTopics[]>("/api/subjects"),
  get: (id: string) => api<SubjectWithTopics>(`/api/subjects/${id}`),
  create: (data: { name: string; description?: string; icon?: string; color?: string }) =>
    api<SubjectWithTopics>("/api/subjects", { method: "POST", body: data }),
  update: (id: string, data: { name?: string; description?: string; icon?: string; color?: string }) =>
    api(`/api/subjects/${id}`, { method: "PUT", body: data }),
  delete: (id: string) => api(`/api/subjects/${id}`, { method: "DELETE" }),
};

export const topicsApi = {
  list: (subjectId: string) => api<TopicData[]>(`/api/topics?subjectId=${subjectId}`),
  create: (data: { subjectId: string; name: string; description?: string }) =>
    api<TopicData>("/api/topics", { method: "POST", body: data }),
  delete: (id: string) => api(`/api/topics/${id}`, { method: "DELETE" }),
};

export const subtopicsApi = {
  list: (topicId: string) => api<SubtopicData[]>(`/api/subtopics?topicId=${topicId}`),
  create: (data: { topicId: string; name: string; description?: string }) =>
    api<SubtopicData>("/api/subtopics", { method: "POST", body: data }),
  delete: (id: string) => api(`/api/subtopics/${id}`, { method: "DELETE" }),
};

export const tasksApi = {
  today: () => api<DailyTaskQueueItem[]>("/api/tasks/today"),
  my: (status?: string) => api<TaskData[]>(`/api/tasks/my${status ? `?status=${status}` : ""}`),
  get: (id: string) => api<TaskData>(`/api/tasks/${id}`),
  start: (id: string) => api<{ id: string }>(`/api/tasks/${id}/start`, { method: "POST" }),
  finishSession: (sessionId: string) =>
    api(`/api/tasks/session/${sessionId}/finish`, { method: "POST" }),
  updateStatus: (id: string, status: string) =>
    api(`/api/tasks/${id}/status`, { method: "PUT", body: { status } }),
};

export const feedbackApi = {
  create: (data: FeedbackInput) =>
    api("/api/feedback", { method: "POST", body: data }),
  byTask: (taskId: string) => api<FeedbackData[]>(`/api/feedback/task/${taskId}`),
};

export const aiApi = {
  generate: (subtopicId: string, count?: number) =>
    api(`/api/ai/generate/${subtopicId}`, { method: "POST", body: { count: count || 5 } }),
  analyze: (taskId: string) =>
    api(`/api/ai/analyze/${taskId}`, { method: "POST" }),
};

export const dashboardApi = {
  get: () => api<DashboardData>("/api/dashboard"),
};

export const gamificationApi = {
  stats: () => api<GamificationStats>("/api/gamification/stats"),
  heatmap: () => api<HeatmapEntry[]>("/api/gamification/heatmap"),
};

export const schedulerApi = {
  generateDaily: () => api("/api/scheduler/generate-daily", { method: "POST" }),
};

// Types
export interface SubjectWithTopics {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  topics: TopicData[];
}

export interface TopicData {
  id: string;
  name: string;
  description: string | null;
  subtopics: SubtopicData[];
}

export interface SubtopicData {
  id: string;
  name: string;
  description: string | null;
  _count?: { tasks: number };
}

export interface TaskData {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  taskType: string;
  status: string;
  estimatedMins: number | null;
  xpReward: number;
  isRevision: boolean;
  hints: string | null;
  commands: string | null;
  tags: string | null;
  subtopic?: { name: string; topic?: { name: string; subject?: { name: string; color: string | null } } };
  feedback?: FeedbackData[];
  taskSessions?: SessionData[];
}

export interface SessionData {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  duration: number | null;
  status: string;
}

export interface FeedbackData {
  id: string;
  whatWasDone: string | null;
  problemsFaced: string | null;
  commandsUsed: string | null;
  confidenceLevel: number;
  needsImprovement: string | null;
  notesForTomorrow: string | null;
  createdAt: string;
}

export interface FeedbackInput {
  taskId: string;
  whatWasDone?: string;
  problemsFaced?: string;
  commandsUsed?: string;
  confidenceLevel: number;
  needsImprovement?: string;
  notesForTomorrow?: string;
}

export interface DailyTaskQueueItem {
  id: string;
  completed: boolean;
  position: number;
  task: TaskData;
}

export interface DashboardData {
  user: { name: string; totalXp: number; level: number; dailyTaskCount: number } | null;
  todaysTasks: DailyTaskQueueItem[];
  todayProgress: { total: number; completed: number };
  subjectProgress: SubjectProgressData[];
  weakAreas: WeakAreaData[];
  recentActivity: RecentActivityData[];
  upcomingRevisions: RevisionData[];
  streak: { currentCount: number; longestCount: number } | null;
  notifications: NotificationData[];
}

export interface SubjectProgressData {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  mastery: number;
  totalTasks: number;
  completedTasks: number;
  topicCount: number;
  subtopicCount: number;
}

export interface WeakAreaData {
  mastery: number;
  subtopic: { name: string; topic: { name: string; subject: { name: string } } };
}

export interface RecentActivityData {
  id: string;
  duration: number | null;
  finishedAt: string | null;
  task: { title: string; subtopic: { name: string } };
}

export interface RevisionData {
  scheduledFor: string;
  task: { title: string; subtopic: { name: string } };
}

export interface NotificationData {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
}

export interface GamificationStats {
  xp: number;
  level: number;
  nextLevelXp: number;
  streak: number;
  longestStreak: number;
  achievements: AchievementData[];
  xpHistory: XpHistoryEntry[];
  progressBySubtopic: LearningProgressEntry[];
}

export interface AchievementData {
  id: string;
  name: string;
  description: string;
  icon: string | null;
  category: string;
  unlockedAt: string;
}

export interface XpHistoryEntry {
  id: string;
  amount: number;
  source: string;
  createdAt: string;
}

export interface LearningProgressEntry {
  mastery: number;
  tasksCompleted: number;
  avgConfidence: number;
  subtopic: { name: string; topic: { name: string; subject: { name: string } } };
}

export interface HeatmapEntry {
  date: string;
  count: number;
  duration: number;
}
