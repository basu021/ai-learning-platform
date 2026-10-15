import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, Task } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { sanitizeRich } from '../common/utils/sanitize';
import {
  addDays,
  formatDate,
  parseDate,
  todayDate,
} from '../common/utils/dates';
import { AccessService } from '../subjects/access.service';
import { ContentService } from '../subjects/content.service';
import {
  CreateTaskDto,
  ListTasksQuery,
  ScheduleDto,
  UpdateTaskDto,
} from './dto/create-task.dto';
import { datesBetween, describe, nextOccurrence } from './schedule';

/** How far back missed occurrences are back-filled as overdue. */
const BACKFILL_DAYS = 30;
const UPCOMING_DAYS = 14;

const NODE_CHAIN = {
  select: {
    id: true,
    title: true,
    type: true,
    parent: {
      select: {
        id: true,
        title: true,
        type: true,
        parent: { select: { id: true, title: true, type: true } },
      },
    },
  },
} as const;

export const TASK_INCLUDE = {
  subject: { select: { id: true, title: true, color: true } },
  node: NODE_CHAIN,
  createdBy: { select: { id: true, name: true, username: true } },
  assignee: { select: { id: true, name: true, username: true } },
} satisfies Prisma.TaskInclude;

type TaskWithRefs = Prisma.TaskGetPayload<{ include: typeof TASK_INCLUDE }>;

interface ChainNode {
  id: string;
  title: string;
  type: string;
  parent?: ChainNode | null;
}

/** Subject › Chapter › Topic › Subtopic, down to the task's scope. */
export function breadcrumbOf(task: Pick<TaskWithRefs, 'subject' | 'node'>) {
  const chain: { id: string; title: string; type: string }[] = [];
  let n = task.node as ChainNode | null;
  while (n) {
    chain.unshift({ id: n.id, title: n.title, type: n.type });
    n = n.parent ?? null;
  }
  return [
    { id: task.subject.id, title: task.subject.title, type: 'SUBJECT' },
    ...chain,
  ];
}

function ruleFromDto(s: ScheduleDto) {
  const startDate = parseDate(s.startDate);
  const endDate = s.endDate ? parseDate(s.endDate) : null;
  if (endDate && endDate < startDate) {
    throw new BadRequestException('End date must be after the start date');
  }
  const rule = {
    frequency: s.frequency,
    weekdays: null as string | null,
    monthDay: null as number | null,
    intervalDays: null as number | null,
    startDate,
    endDate: s.frequency === 'ONCE' ? null : endDate,
  };
  if (s.frequency === 'WEEKLY') {
    if (!s.weekdays?.length)
      throw new BadRequestException('Pick at least one weekday');
    rule.weekdays = [...new Set(s.weekdays)].sort().join(',');
  }
  if (s.frequency === 'MONTHLY') {
    rule.monthDay = s.monthDay ?? startDate.getUTCDate();
  }
  if (s.frequency === 'CUSTOM') {
    if (!s.intervalDays)
      throw new BadRequestException('Set how many days between practice');
    rule.intervalDays = s.intervalDays;
  }
  return rule;
}

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private access: AccessService,
    private content: ContentService,
    private notifications: NotificationsService,
  ) {}

  // ----------------------------------------------------------- definitions

  async create(user: AuthUser, dto: CreateTaskDto) {
    const isAdmin = user.role === 'ADMIN';
    const access = await this.access.require(dto.subjectId, user, 'view');
    if (dto.nodeId) await this.content.findNode(dto.subjectId, dto.nodeId);
    const rule = ruleFromDto(dto.schedule);

    let assignees: { id: string; username: string }[] = [
      { id: user.id, username: user.username },
    ];
    if (dto.assignees?.length) {
      const names = [
        ...new Set(
          dto.assignees.map((u) => u.trim().toLowerCase().replace(/^@/, '')),
        ),
      ];
      const isSelfOnly = names.length === 1 && names[0] === user.username;
      if (!isSelfOnly && !isAdmin) {
        throw new ForbiddenException(
          'Only admins can assign tasks to other users',
        );
      }
      assignees = await this.prisma.user.findMany({
        where: { username: { in: names }, deletedAt: null },
        select: { id: true, username: true },
      });
      const missing = names.filter(
        (n) => !assignees.some((a) => a.username === n),
      );
      if (missing.length) {
        throw new NotFoundException(
          `Unknown username: ${missing.map((m) => '@' + m).join(', ')}`,
        );
      }
    }

    const instructions = sanitizeRich(dto.instructions);
    const created: Task[] = [];
    for (const a of assignees) {
      if (a.id !== user.id) {
        // The assignee needs to be able to read what they're practising.
        await this.access.ensureViewer(dto.subjectId, a.id, user.id);
      }
      created.push(
        await this.prisma.task.create({
          data: {
            subjectId: dto.subjectId,
            nodeId: dto.nodeId || null,
            createdById: user.id,
            assigneeId: a.id,
            title: dto.title.trim(),
            instructions,
            difficulty: dto.difficulty ?? 'beginner',
            estimatedMins: dto.estimatedMins,
            xpReward: dto.xpReward ?? 10,
            ...rule,
          },
        }),
      );
    }

    const others = assignees.filter((a) => a.id !== user.id).map((a) => a.id);
    await this.notifications.notify(others, {
      title: 'New practice task assigned',
      message: `${user.name} assigned "${dto.title.trim()}" in "${access.subject.title}" (${describe(rule)}).`,
      type: 'assign',
      link: '/tasks',
    });
    return created;
  }

  async list(user: AuthUser, q: ListTasksQuery) {
    const isAdmin = user.role === 'ADMIN';
    const where: Prisma.TaskWhereInput = { deletedAt: null };
    switch (q.scope ?? 'mine') {
      case 'mine':
        where.assigneeId = user.id;
        break;
      case 'assigned':
        where.createdById = user.id;
        where.assigneeId = { not: user.id };
        break;
      case 'all':
        if (!isAdmin) throw new ForbiddenException();
        if (q.assigneeId) where.assigneeId = q.assigneeId;
        break;
    }
    if (q.subjectId) where.subjectId = q.subjectId;

    const tasks = await this.prisma.task.findMany({
      where,
      include: {
        ...TASK_INCLUDE,
        _count: { select: { occurrences: { where: { status: 'COMPLETED' } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    const today = todayDate();
    return tasks.map(({ _count, ...t }) => ({
      ...this.present(t, user),
      completedCount: _count.occurrences,
      nextDue: t.active
        ? nextOccurrence(t, today)
          ? formatDate(nextOccurrence(t, today)!)
          : null
        : null,
    }));
  }

  async get(user: AuthUser, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, deletedAt: null },
      include: TASK_INCLUDE,
    });
    if (!task) throw new NotFoundException('Task not found');
    if (
      task.assigneeId !== user.id &&
      task.createdById !== user.id &&
      user.role !== 'ADMIN'
    ) {
      throw new NotFoundException('Task not found');
    }
    const occurrences = await this.prisma.taskOccurrence.findMany({
      where: { taskId: id },
      orderBy: { dueDate: 'desc' },
      take: 30,
      include: { feedback: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    return { ...this.present(task, user), occurrences };
  }

  async update(user: AuthUser, id: string, dto: UpdateTaskDto) {
    const task = await this.requireEditable(user, id);
    const data: Prisma.TaskUncheckedUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.instructions !== undefined)
      data.instructions = sanitizeRich(dto.instructions);
    if (dto.difficulty !== undefined) data.difficulty = dto.difficulty;
    if (dto.estimatedMins !== undefined) data.estimatedMins = dto.estimatedMins;
    if (dto.xpReward !== undefined) data.xpReward = dto.xpReward;
    if (dto.active !== undefined) data.active = !!dto.active;
    if (dto.nodeId !== undefined) {
      if (dto.nodeId) await this.content.findNode(task.subjectId, dto.nodeId);
      data.nodeId = dto.nodeId || null;
    }
    if (dto.schedule) {
      Object.assign(data, ruleFromDto(dto.schedule));
      // Re-evaluate from today; past occurrences stay as history.
      data.generatedThru = addDays(todayDate(), -1);
      await this.prisma.taskOccurrence.deleteMany({
        where: { taskId: id, status: 'PENDING', dueDate: { gte: todayDate() } },
      });
    }
    await this.prisma.task.update({ where: { id }, data });
    return this.get(user, id);
  }

  async remove(user: AuthUser, id: string) {
    await this.requireEditable(user, id);
    await this.prisma.task.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
    return { ok: true };
  }

  /** Creator or admin. Assignees can't change what an admin assigned them. */
  private async requireEditable(user: AuthUser, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, deletedAt: null },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (task.createdById !== user.id && user.role !== 'ADMIN') {
      throw new ForbiddenException(
        task.assigneeId === user.id
          ? 'This task was assigned to you; only the person who assigned it can change it'
          : 'Not allowed',
      );
    }
    return task;
  }

  private present(t: TaskWithRefs, user: AuthUser) {
    return {
      ...t,
      startDate: formatDate(t.startDate),
      endDate: t.endDate ? formatDate(t.endDate) : null,
      generatedThru: undefined,
      weekdays: t.weekdays ? t.weekdays.split(',').map(Number) : [],
      scheduleLabel: describe(t),
      breadcrumb: breadcrumbOf(t),
      assignedByOther: t.createdById !== t.assigneeId,
      canEdit: t.createdById === user.id || user.role === 'ADMIN',
    };
  }

  // ----------------------------------------------------------- occurrences

  /** Materialises due occurrences up to today (back-filling missed days). */
  async ensureOccurrences(userId: string) {
    const today = todayDate();
    const tasks = await this.prisma.task.findMany({
      where: {
        assigneeId: userId,
        active: true,
        deletedAt: null,
        startDate: { lte: today },
        OR: [{ generatedThru: null }, { generatedThru: { lt: today } }],
      },
    });
    for (const t of tasks) {
      const floor = addDays(today, -BACKFILL_DAYS);
      let from = t.generatedThru ? addDays(t.generatedThru, 1) : t.startDate;
      if (from < floor) from = floor;
      const dates = datesBetween(t, from, today);
      if (dates.length) {
        await this.prisma.taskOccurrence.createMany({
          data: dates.map((dueDate) => ({ taskId: t.id, userId, dueDate })),
          skipDuplicates: true,
        });
      }
      await this.prisma.task.update({
        where: { id: t.id },
        data: { generatedThru: today },
      });
    }
  }

  async agenda(userId: string) {
    await this.ensureOccurrences(userId);
    const today = todayDate();
    const include = { task: { include: TASK_INCLUDE } } as const;

    const [todayItems, overdue, activeTasks] = await Promise.all([
      this.prisma.taskOccurrence.findMany({
        where: { userId, dueDate: today, task: { deletedAt: null } },
        include,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.taskOccurrence.findMany({
        where: {
          userId,
          dueDate: { lt: today },
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          task: { deletedAt: null, active: true },
        },
        include,
        orderBy: { dueDate: 'desc' },
        take: 50,
      }),
      this.prisma.task.findMany({
        where: { assigneeId: userId, active: true, deletedAt: null },
        include: TASK_INCLUDE,
      }),
    ]);

    // Future occurrences are computed, not stored.
    const upcoming = activeTasks
      .flatMap((t) =>
        datesBetween(t, addDays(today, 1), addDays(today, UPCOMING_DAYS)).map(
          (d) => ({
            dueDate: formatDate(d),
            task: this.presentLite(t),
          }),
        ),
      )
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    const shape = (o: (typeof todayItems)[number]) => ({
      id: o.id,
      status: o.status,
      dueDate: formatDate(o.dueDate),
      completedAt: o.completedAt,
      task: this.presentLite(o.task),
    });

    return {
      today: formatDate(today),
      todayItems: todayItems.map(shape),
      overdue: overdue.map(shape),
      upcoming,
    };
  }

  private presentLite(t: TaskWithRefs) {
    return {
      id: t.id,
      title: t.title,
      difficulty: t.difficulty,
      estimatedMins: t.estimatedMins,
      xpReward: t.xpReward,
      frequency: t.frequency,
      scheduleLabel: describe(t),
      breadcrumb: breadcrumbOf(t),
      subject: t.subject,
      createdBy: t.createdBy,
      assignedByOther: t.createdById !== t.assigneeId,
    };
  }

  async getOccurrence(user: AuthUser, id: string) {
    const occ = await this.prisma.taskOccurrence.findUnique({
      where: { id },
      include: {
        task: { include: TASK_INCLUDE },
        taskSessions: { orderBy: { startedAt: 'desc' }, take: 10 },
        feedback: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!occ || (occ.userId !== user.id && user.role !== 'ADMIN')) {
      throw new NotFoundException('Practice item not found');
    }
    const history = await this.prisma.feedback.findMany({
      where: {
        occurrence: { taskId: occ.taskId },
        occurrenceId: { not: occ.id },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    return {
      ...occ,
      dueDate: formatDate(occ.dueDate),
      task: this.present(occ.task, user),
      previousFeedback: history,
    };
  }

  private async requireOwnOccurrence(user: AuthUser, id: string) {
    const occ = await this.prisma.taskOccurrence.findUnique({ where: { id } });
    if (!occ || occ.userId !== user.id)
      throw new NotFoundException('Practice item not found');
    return occ;
  }

  async start(user: AuthUser, occurrenceId: string) {
    const occ = await this.requireOwnOccurrence(user, occurrenceId);
    if (occ.status === 'COMPLETED')
      throw new BadRequestException('Already completed');
    const active = await this.prisma.taskSession.findFirst({
      where: { occurrenceId, status: 'active' },
    });
    if (active) return active;
    await this.prisma.taskOccurrence.update({
      where: { id: occurrenceId },
      data: { status: 'IN_PROGRESS' },
    });
    return this.prisma.taskSession.create({
      data: { occurrenceId, userId: user.id },
    });
  }

  async finishSession(user: AuthUser, sessionId: string) {
    const session = await this.prisma.taskSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.userId !== user.id)
      throw new NotFoundException('Session not found');
    if (session.status !== 'active') return session;
    const now = new Date();
    return this.prisma.taskSession.update({
      where: { id: sessionId },
      data: {
        finishedAt: now,
        duration: Math.floor(
          (now.getTime() - session.startedAt.getTime()) / 1000,
        ),
        status: 'completed',
      },
    });
  }

  async skip(user: AuthUser, occurrenceId: string) {
    const occ = await this.requireOwnOccurrence(user, occurrenceId);
    if (occ.status === 'COMPLETED')
      throw new BadRequestException('Already completed');
    await this.prisma.taskSession.updateMany({
      where: { occurrenceId, status: 'active' },
      data: { status: 'abandoned', finishedAt: new Date() },
    });
    return this.prisma.taskOccurrence.update({
      where: { id: occurrenceId },
      data: { status: 'SKIPPED' },
    });
  }

  /** Practice history for one user (admin view or own). */
  async history(user: AuthUser, userId: string) {
    if (userId !== user.id && user.role !== 'ADMIN')
      throw new ForbiddenException();
    const items = await this.prisma.taskOccurrence.findMany({
      where: { userId, status: { in: ['COMPLETED', 'SKIPPED'] } },
      include: {
        task: { include: TASK_INCLUDE },
        feedback: { take: 1, orderBy: { createdAt: 'desc' } },
      },
      orderBy: { dueDate: 'desc' },
      take: 50,
    });
    return items.map((o) => ({
      id: o.id,
      status: o.status,
      dueDate: formatDate(o.dueDate),
      completedAt: o.completedAt,
      confidence: o.feedback[0]?.confidenceLevel ?? null,
      task: this.presentLite(o.task),
    }));
  }
}
