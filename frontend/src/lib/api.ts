export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("accessToken");
}

function encodeBody(body: unknown) {
  if (body === undefined) return undefined;
  return body instanceof FormData ? body : JSON.stringify(body);
}

async function send(endpoint: string, options: ApiOptions, token: string | null) {
  const headers: Record<string, string> = { ...options.headers };
  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${API_URL}${endpoint}`, {
    method: options.method || "GET",
    headers,
    body: encodeBody(options.body),
  });
}

async function request(endpoint: string, options: ApiOptions = {}) {
  let response = await send(endpoint, options, getToken());
  if (response.status === 401 && !endpoint.startsWith("/api/auth/login")) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await send(endpoint, options, refreshed);
    } else if (typeof window !== "undefined") {
      clearSession();
      window.location.href = "/auth/login";
    }
  }
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(error.message) ? error.message.join(", ") : error.message;
    throw new Error(message || `Request failed (${response.status})`);
  }
  return response;
}

export async function api<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const response = await request(endpoint, options);
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** Downloads an authenticated file through the browser. */
export async function downloadFile(endpoint: string, filename: string) {
  const response = await request(endpoint);
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function clearSession() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("userId");
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
    const data = (await response.json()) as { accessToken: string; refreshToken: string };
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

export function qs(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") search.set(k, String(v));
  });
  const s = search.toString();
  return s ? `?${s}` : "";
}

// ------------------------------------------------------------------ types

export type Role = "ADMIN" | "USER";
export type Visibility = "PUBLIC" | "LISTED" | "PRIVATE";
export type PublishStatus = "DRAFT" | "PUBLISHED";
export type NodeType = "CHAPTER" | "TOPIC" | "SUBTOPIC";
export type MemberRole = "VIEWER" | "EDITOR";
export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";
export type ChangeAction = "CREATE" | "UPDATE" | "DELETE";
export type Frequency = "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY" | "CUSTOM";
export type OccurrenceStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";

export interface UserSummary {
  id: string;
  name: string;
  username: string;
}

export interface Me {
  id: string;
  email: string;
  username: string;
  name: string;
  role: Role;
  level: number;
  totalXp: number;
  createdAt?: string;
}

export interface AuthResponse {
  user: Me;
  accessToken: string;
  refreshToken: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  _count?: { subjects: number };
}

export type ItemState = "unread" | "opened" | "done" | "outdated";
export type RollupState = "none" | "progress" | "done" | "outdated";

export interface Rollup {
  total: number;
  done: number;
  outdated: number;
  percent: number;
  state: RollupState;
}

export interface NodeProgress extends Rollup {
  own: ItemState | null;
  completedAt: string | null;
  timeSpentSec: number;
}

export interface SubjectProgress extends Rollup {
  overview: ItemState | null;
  overviewCompletedAt: string | null;
  nodes: Record<string, NodeProgress>;
}

export interface SubjectListItem {
  id: string;
  title: string;
  summary: string | null;
  visibility: Visibility;
  status: PublishStatus;
  tags: string | null;
  color: string | null;
  ownerId: string;
  updatedAt: string;
  owner: UserSummary;
  category: { id: string; name: string } | null;
  chapterCount: number;
  memberCount: number;
  pendingChanges: number;
  pendingAccessRequests: number;
  access: {
    isOwner: boolean;
    memberRole: MemberRole | null;
    canManage: boolean;
    hasAccess: boolean;
    accessRequested: boolean;
  };
  progress: (Rollup & { lastOpenedAt: string | null }) | null;
}

export interface OutlineNode {
  id: string;
  parentId: string | null;
  type: NodeType;
  title: string;
  order: number;
  isPreview: boolean;
  locked: boolean;
  children: OutlineNode[];
}

export interface AttachmentItem {
  id: string;
  filename: string;
  contentType: string | null;
  sizeBytes: number;
  createdAt: string;
  uploadedBy: { name: string; username: string };
}

export interface SubjectAccess {
  isOwner: boolean;
  isAdmin: boolean;
  memberRole: MemberRole | null;
  canView: boolean;
  previewOnly: boolean;
  canEdit: boolean;
  canManage: boolean;
  canRequestAccess: boolean;
  editsNeedApproval: boolean;
  lastRequest: { status: RequestStatus; createdAt: string } | null;
}

export interface SubjectDetail {
  id: string;
  ownerId: string;
  title: string;
  summary: string | null;
  content: string | null;
  visibility: Visibility;
  status: PublishStatus;
  categoryId: string | null;
  tags: string | null;
  color: string | null;
  createdAt: string;
  updatedAt: string;
  owner: UserSummary;
  category: Category | null;
  outline: OutlineNode[];
  attachments: AttachmentItem[];
  pendingChanges: number;
  pendingAccessRequests: number;
  memberCount: number;
  access: SubjectAccess;
}

export interface Crumb {
  id: string;
  title: string;
  type: NodeType | "SUBJECT";
}

export interface NodeDetail {
  id: string;
  subjectId: string;
  parentId: string | null;
  type: NodeType;
  title: string;
  summary: string | null;
  content: string | null;
  isPreview: boolean;
  updatedAt: string;
  locked: boolean;
  children: { id: string; title: string; type: NodeType; summary: string | null }[];
  breadcrumb: Crumb[];
  attachments: AttachmentItem[];
  pendingChanges: number;
  taskCount: number;
}

export interface EditResult {
  applied: boolean;
  pending: boolean;
  changeRequestId?: string;
  result?: { id: string };
}

export interface ContentSnapshot {
  title: string;
  summary: string | null;
  content: string | null;
}

export interface ChangeRequestItem {
  id: string;
  subjectId: string;
  nodeId: string | null;
  action: ChangeAction;
  payload: Partial<ContentSnapshot> & { type?: NodeType; parentId?: string | null };
  changeNote: string | null;
  status: RequestStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  author: UserSummary;
  reviewedBy: UserSummary | null;
  node: { id: string; title: string; type: NodeType; deletedAt: string | null } | null;
  current: ContentSnapshot | null;
}

export interface RevisionItem {
  id: string;
  nodeId: string | null;
  action: ChangeAction;
  snapshot: Partial<ContentSnapshot> & { deletedAt?: string };
  changeNote: string | null;
  createdAt: string;
  changedBy: UserSummary;
  node: { id: string; title: string; type: NodeType; deletedAt?: string | null } | null;
}

export interface MemberItem {
  id: string;
  role: MemberRole;
  createdAt: string;
  user: UserSummary;
  grantedBy: UserSummary | null;
}

export interface AccessRequestItem {
  id: string;
  message: string | null;
  status: RequestStatus;
  createdAt: string;
  decidedAt: string | null;
  user: UserSummary;
  decidedBy: UserSummary | null;
  subject?: { id: string; title: string };
}

export interface TaskLite {
  id: string;
  title: string;
  difficulty: string;
  estimatedMins: number | null;
  xpReward: number;
  frequency: Frequency;
  scheduleLabel: string;
  breadcrumb: Crumb[];
  subject: { id: string; title: string; color: string | null };
  createdBy: UserSummary;
  assignedByOther: boolean;
}

export interface TaskDetail extends Omit<TaskLite, "breadcrumb"> {
  breadcrumb: Crumb[];
  subjectId: string;
  nodeId: string | null;
  instructions: string | null;
  weekdays: number[];
  monthDay: number | null;
  intervalDays: number | null;
  startDate: string;
  endDate: string | null;
  active: boolean;
  assignee: UserSummary;
  canEdit: boolean;
  completedCount?: number;
  nextDue?: string | null;
  createdAt: string;
}

export interface OccurrenceItem {
  id: string;
  status: OccurrenceStatus;
  dueDate: string;
  completedAt: string | null;
  task: TaskLite;
}

export interface Agenda {
  today: string;
  todayItems: OccurrenceItem[];
  overdue: OccurrenceItem[];
  upcoming: { dueDate: string; task: TaskLite }[];
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

export interface OccurrenceDetail {
  id: string;
  status: OccurrenceStatus;
  dueDate: string;
  completedAt: string | null;
  task: TaskDetail;
  taskSessions: SessionData[];
  feedback: FeedbackData[];
  previousFeedback: FeedbackData[];
}

export interface FeedbackInput {
  occurrenceId: string;
  whatWasDone?: string;
  problemsFaced?: string;
  commandsUsed?: string;
  confidenceLevel: number;
  needsImprovement?: string;
  notesForTomorrow?: string;
}

export interface ScheduleInput {
  frequency: Frequency;
  weekdays?: number[];
  monthDay?: number;
  intervalDays?: number;
  startDate: string;
  endDate?: string | null;
}

export interface TaskInput {
  subjectId: string;
  nodeId?: string | null;
  title: string;
  instructions?: string;
  difficulty?: string;
  estimatedMins?: number;
  xpReward?: number;
  assignees?: string[];
  schedule: ScheduleInput;
}

export interface RelativeScheduleInput {
  frequency: Frequency;
  weekdays?: number[];
  monthDay?: number;
  intervalDays?: number;
  /** 0 = start on the completion day. */
  startAfterDays: number;
  /** Repeating tasks only; empty = no end. */
  durationDays?: number | null;
}

export interface TaskTemplateInput {
  subjectId: string;
  nodeId?: string | null;
  /** Empty = when the whole subject is complete. */
  triggerNodeId?: string | null;
  title: string;
  instructions?: string;
  difficulty?: string;
  estimatedMins?: number;
  xpReward?: number;
  schedule: RelativeScheduleInput;
}

/** An unassigned task given to each learner once they complete its trigger. */
export interface TaskTemplate {
  id: string;
  subjectId: string;
  nodeId: string | null;
  triggerNodeId: string | null;
  title: string;
  instructions: string | null;
  difficulty: string;
  estimatedMins: number | null;
  xpReward: number;
  frequency: Frequency;
  weekdays: number[];
  monthDay: number | null;
  intervalDays: number | null;
  startAfterDays: number;
  durationDays: number | null;
  active: boolean;
  subject: { id: string; title: string; color: string | null };
  createdBy: UserSummary;
  scheduleLabel: string;
  breadcrumb: Crumb[];
  trigger: Crumb[];
  assignedCount: number;
}

export interface DashboardData {
  user: { name: string; totalXp: number; level: number; role: Role } | null;
  streak: { currentCount: number; longestCount: number } | null;
  agenda: Agenda;
  todayProgress: { total: number; completed: number };
  subjectProgress: { id: string; title: string; color: string | null; due: number; completed: number; rate: number }[];
  recentActivity: { id: string; title: string; subject: string; completedAt: string; duration: number }[];
  weakAreas: { mastery: number; title: string; subjectId: string }[];
  reading: (Rollup & { id: string; title: string; color: string | null; lastOpenedAt: string | null })[];
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface AdminStats {
  today: string;
  users: number;
  admins: number;
  subjects: number;
  catalog: number;
  tasks: number;
  dueToday: number;
  doneToday: number;
  pendingAccess: number;
  pendingChanges: number;
}

export interface AdminUserRow {
  id: string;
  email: string;
  username: string;
  name: string;
  role: Role;
  level: number;
  totalXp: number;
  createdAt: string;
  active: boolean;
  subjectCount: number;
  sharedCount: number;
  taskCount: number;
}

export interface AdminUserDetail extends Me {
  active: boolean;
  streak: number;
  owned: { id: string; title: string; visibility: Visibility; status: PublishStatus; updatedAt: string }[];
  memberships: {
    id: string;
    role: MemberRole;
    subject: { id: string; title: string; visibility: Visibility; owner: UserSummary };
    grantedBy: UserSummary | null;
  }[];
}

export interface PendingChangeRow {
  id: string;
  action: ChangeAction;
  changeNote: string | null;
  createdAt: string;
  author: UserSummary;
  subject: { id: string; title: string; owner: UserSummary };
  node: { id: string; title: string; type: NodeType } | null;
}

// -------------------------------------------------------------- endpoints

export const authApi = {
  login: (email: string, password: string) =>
    api<AuthResponse>("/api/auth/login", { method: "POST", body: { email, password } }),
  register: (data: { name: string; username: string; email: string; password: string }) =>
    api<AuthResponse>("/api/auth/register", { method: "POST", body: data }),
  profile: () => api<Me>("/api/auth/profile"),
  logout: () => api("/api/auth/logout", { method: "POST" }),
};

export interface SubjectFilters {
  scope?: "library" | "mine" | "shared" | "catalog" | "all";
  q?: string;
  categoryId?: string;
  visibility?: Visibility;
  status?: PublishStatus;
  tag?: string;
  ownerId?: string;
}

export const subjectsApi = {
  list: (f: SubjectFilters = {}) => api<SubjectListItem[]>(`/api/subjects${qs({ ...f })}`),
  get: (id: string) => api<SubjectDetail>(`/api/subjects/${id}`),
  create: (data: {
    title: string;
    summary?: string;
    content?: string;
    visibility?: Visibility;
    status?: PublishStatus;
    categoryId?: string;
    tags?: string;
    color?: string;
  }) => api<{ id: string }>("/api/subjects", { method: "POST", body: data }),
  editContent: (id: string, data: Partial<ContentSnapshot> & { changeNote?: string }) =>
    api<EditResult>(`/api/subjects/${id}`, { method: "PUT", body: data }),
  updateSettings: (
    id: string,
    data: { visibility?: Visibility; status?: PublishStatus; categoryId?: string | null; tags?: string; color?: string },
  ) => api(`/api/subjects/${id}/settings`, { method: "PATCH", body: data }),
  remove: (id: string) => api(`/api/subjects/${id}`, { method: "DELETE" }),

  getNode: (id: string, nodeId: string) => api<NodeDetail>(`/api/subjects/${id}/nodes/${nodeId}`),
  createNode: (
    id: string,
    data: { type: NodeType; parentId?: string | null; title: string; summary?: string; content?: string; changeNote?: string },
  ) => api<EditResult>(`/api/subjects/${id}/nodes`, { method: "POST", body: data }),
  editNode: (id: string, nodeId: string, data: Partial<ContentSnapshot> & { changeNote?: string }) =>
    api<EditResult>(`/api/subjects/${id}/nodes/${nodeId}`, { method: "PUT", body: data }),
  deleteNode: (id: string, nodeId: string, note?: string) =>
    api<EditResult>(`/api/subjects/${id}/nodes/${nodeId}${qs({ note })}`, { method: "DELETE" }),
  reorder: (id: string, parentId: string | null, orderedIds: string[]) =>
    api(`/api/subjects/${id}/nodes/reorder`, { method: "POST", body: { parentId, orderedIds } }),
  setPreview: (id: string, nodeId: string, isPreview: boolean) =>
    api(`/api/subjects/${id}/nodes/${nodeId}/preview`, { method: "PATCH", body: { isPreview } }),

  changes: (id: string, status?: RequestStatus) =>
    api<ChangeRequestItem[]>(`/api/subjects/${id}/changes${qs({ status })}`),
  approveChange: (changeId: string, note?: string) =>
    api(`/api/changes/${changeId}/approve`, { method: "POST", body: { note } }),
  rejectChange: (changeId: string, note?: string) =>
    api(`/api/changes/${changeId}/reject`, { method: "POST", body: { note } }),
  revisions: (id: string, nodeId?: string) =>
    api<RevisionItem[]>(`/api/subjects/${id}/revisions${qs({ nodeId })}`),
  restoreRevision: (revisionId: string) =>
    api(`/api/revisions/${revisionId}/restore`, { method: "POST" }),
  trash: (id: string) => api<RevisionItem[]>(`/api/subjects/${id}/trash`),

  members: (id: string) => api<MemberItem[]>(`/api/subjects/${id}/members`),
  addMembers: (id: string, usernames: string[], role: MemberRole) =>
    api<MemberItem[]>(`/api/subjects/${id}/members`, { method: "POST", body: { usernames, role } }),
  updateMember: (id: string, userId: string, role: MemberRole) =>
    api<MemberItem[]>(`/api/subjects/${id}/members/${userId}`, { method: "PATCH", body: { role } }),
  removeMember: (id: string, userId: string) =>
    api(`/api/subjects/${id}/members/${userId}`, { method: "DELETE" }),

  requestAccess: (id: string, message?: string) =>
    api(`/api/subjects/${id}/access-requests`, { method: "POST", body: { message } }),
  accessRequests: (id: string, status?: RequestStatus) =>
    api<AccessRequestItem[]>(`/api/subjects/${id}/access-requests${qs({ status })}`),
  approveAccess: (requestId: string) =>
    api(`/api/access-requests/${requestId}/approve`, { method: "POST" }),
  rejectAccess: (requestId: string) =>
    api(`/api/access-requests/${requestId}/reject`, { method: "POST" }),

  uploadAttachment: (id: string, file: File, opts: { nodeId?: string | null; inline?: boolean } = {}) => {
    const fd = new FormData();
    fd.append("file", file);
    return api<AttachmentItem & { url: string }>(
      `/api/subjects/${id}/attachments${qs({ nodeId: opts.nodeId, inline: opts.inline ? 1 : undefined })}`,
      { method: "POST", body: fd },
    );
  },
  deleteAttachment: (attachmentId: string) =>
    api(`/api/attachments/${attachmentId}`, { method: "DELETE" }),
};

export const progressApi = {
  get: (subjectId: string) => api<SubjectProgress | null>(`/api/progress/subjects/${subjectId}`),
  heartbeat: (subjectId: string, nodeId: string | null, seconds: number, opened = false) =>
    api(`/api/progress/subjects/${subjectId}/heartbeat`, { method: "POST", body: { nodeId, seconds, opened } }),
  complete: (subjectId: string, nodeId: string | null) =>
    api<SubjectProgress>(`/api/progress/subjects/${subjectId}/complete`, { method: "POST", body: { nodeId } }),
  uncomplete: (subjectId: string, nodeId: string | null) =>
    api<SubjectProgress>(`/api/progress/subjects/${subjectId}/uncomplete`, { method: "POST", body: { nodeId } }),
  reset: (subjectId: string, nodeId: string | null) =>
    api<SubjectProgress>(`/api/progress/subjects/${subjectId}/reset`, { method: "POST", body: { nodeId } }),
  forUser: (userId: string) => api<Record<string, Rollup>>(`/api/progress/users/${userId}`),
};

export const categoriesApi = {
  list: () => api<Category[]>("/api/categories"),
  create: (name: string, description?: string) =>
    api<Category>("/api/categories", { method: "POST", body: { name, description } }),
  remove: (id: string) => api(`/api/categories/${id}`, { method: "DELETE" }),
};

export const tasksApi = {
  create: (data: TaskInput) => api<{ id: string }[]>("/api/tasks", { method: "POST", body: data }),
  list: (q: { scope?: "mine" | "assigned" | "all"; assigneeId?: string; subjectId?: string } = {}) =>
    api<TaskDetail[]>(`/api/tasks${qs(q)}`),
  get: (id: string) => api<TaskDetail & { occurrences: { id: string; dueDate: string; status: OccurrenceStatus }[] }>(`/api/tasks/${id}`),
  update: (id: string, data: Partial<Omit<TaskInput, "subjectId" | "assignees">> & { active?: boolean }) =>
    api<TaskDetail>(`/api/tasks/${id}`, { method: "PUT", body: data }),
  remove: (id: string) => api(`/api/tasks/${id}`, { method: "DELETE" }),
  agenda: () => api<Agenda>("/api/tasks/agenda"),
  history: (userId?: string) =>
    api<(OccurrenceItem & { confidence: number | null })[]>(`/api/tasks/history${qs({ userId })}`),
  occurrence: (id: string) => api<OccurrenceDetail>(`/api/tasks/occurrences/${id}`),
  start: (occurrenceId: string) =>
    api<SessionData>(`/api/tasks/occurrences/${occurrenceId}/start`, { method: "POST" }),
  skip: (occurrenceId: string) => api(`/api/tasks/occurrences/${occurrenceId}/skip`, { method: "POST" }),
  finishSession: (sessionId: string) =>
    api<SessionData>(`/api/tasks/sessions/${sessionId}/finish`, { method: "POST" }),
};

export const taskTemplatesApi = {
  list: (subjectId?: string) => api<TaskTemplate[]>(`/api/task-templates${qs({ subjectId })}`),
  create: (data: TaskTemplateInput) => api<TaskTemplate>("/api/task-templates", { method: "POST", body: data }),
  update: (id: string, data: Partial<Omit<TaskTemplateInput, "subjectId">> & { active?: boolean }) =>
    api<TaskTemplate>(`/api/task-templates/${id}`, { method: "PUT", body: data }),
  remove: (id: string) => api(`/api/task-templates/${id}`, { method: "DELETE" }),
};

export const feedbackApi = {
  create: (data: FeedbackInput) => api("/api/feedback", { method: "POST", body: data }),
};

export const dashboardApi = {
  get: () => api<DashboardData>("/api/dashboard"),
};

export const notificationsApi = {
  list: () => api<{ items: NotificationItem[]; unread: number }>("/api/notifications"),
  read: (id: string) => api(`/api/notifications/${id}/read`, { method: "POST" }),
  readAll: () => api("/api/notifications/read-all", { method: "POST" }),
};

export const usersApi = {
  search: (q: string) => api<UserSummary[]>(`/api/users/search${qs({ q })}`),
};

export const adminApi = {
  stats: () => api<AdminStats>("/api/admin/stats"),
  users: (q?: string) => api<AdminUserRow[]>(`/api/admin/users${qs({ q })}`),
  user: (id: string) => api<AdminUserDetail>(`/api/admin/users/${id}`),
  createUser: (data: { email: string; username: string; name: string; password: string; role: Role }) =>
    api<Me>("/api/admin/users", { method: "POST", body: data }),
  updateUser: (id: string, data: { name?: string; role?: Role; password?: string; active?: boolean }) =>
    api<Me>(`/api/admin/users/${id}`, { method: "PATCH", body: data }),
  accessRequests: () => api<AccessRequestItem[]>("/api/admin/access-requests"),
  changes: () => api<PendingChangeRow[]>("/api/admin/changes"),
};
