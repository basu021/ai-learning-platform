import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { sanitizeRich } from '../common/utils/sanitize';
import { addDays, todayDate } from '../common/utils/dates';
import { ContentService } from '../subjects/content.service';
import {
  ProgressService,
  type SubjectProgress,
} from '../subjects/progress.service';
import {
  CreateTemplateDto,
  RelativeScheduleDto,
  UpdateTemplateDto,
} from './dto/create-task.dto';
import { breadcrumbOf, TASK_INCLUDE } from './tasks.service';
import { describe } from './schedule';

const TEMPLATE_INCLUDE = {
  subject: TASK_INCLUDE.subject,
  node: TASK_INCLUDE.node,
  triggerNode: TASK_INCLUDE.node,
  createdBy: TASK_INCLUDE.createdBy,
  _count: { select: { tasks: { where: { deletedAt: null } } } },
} satisfies Prisma.TaskTemplateInclude;

type TemplateWithRefs = Prisma.TaskTemplateGetPayload<{
  include: typeof TEMPLATE_INCLUDE;
}>;

function ruleFromRelative(s: RelativeScheduleDto) {
  const rule = {
    frequency: s.frequency,
    weekdays: null as string | null,
    monthDay: null as number | null,
    intervalDays: null as number | null,
    startAfterDays: s.startAfterDays,
    durationDays: s.frequency === 'ONCE' ? null : (s.durationDays ?? null),
  };
  if (s.frequency === 'WEEKLY') {
    if (!s.weekdays?.length)
      throw new BadRequestException('Pick at least one weekday');
    rule.weekdays = [...new Set(s.weekdays)].sort().join(',');
  }
  if (s.frequency === 'MONTHLY') rule.monthDay = s.monthDay ?? 1;
  if (s.frequency === 'CUSTOM') {
    if (!s.intervalDays)
      throw new BadRequestException('Set how many days between practice');
    rule.intervalDays = s.intervalDays;
  }
  return rule;
}

function days(n: number) {
  return `${n} day${n === 1 ? '' : 's'}`;
}

/** e.g. "Every 2 days, from 1 day after completion, for 14 days". */
export function relativeLabel(t: {
  frequency: TemplateWithRefs['frequency'];
  weekdays: string | null;
  monthDay: number | null;
  intervalDays: number | null;
  startAfterDays: number;
  durationDays: number | null;
}) {
  const start = t.startAfterDays
    ? `${days(t.startAfterDays)} after completion`
    : 'on completion day';
  if (t.frequency === 'ONCE') return `Once, ${start}`;
  const base = describe({ ...t, startDate: new Date(0), endDate: null });
  return `${base}, from ${start}${t.durationDays ? `, for ${days(t.durationDays)}` : ''}`;
}

/**
 * Auto-assigned tasks: an admin defines the task once, and each learner gets
 * their own copy when they complete the trigger (a chapter, topic, or the
 * whole subject). The copy's schedule starts relative to that day.
 */
@Injectable()
export class TemplatesService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private content: ContentService,
    private progress: ProgressService,
    private notifications: NotificationsService,
  ) {}

  onModuleInit() {
    this.progress.onCompletion((userId, subjectId, p) =>
      this.assignCompleted(userId, subjectId, p),
    );
  }

  async list(subjectId?: string) {
    const items = await this.prisma.taskTemplate.findMany({
      where: { deletedAt: null, ...(subjectId ? { subjectId } : {}) },
      include: TEMPLATE_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    return items.map((t) => this.present(t));
  }

  async create(user: AuthUser, dto: CreateTemplateDto) {
    const subject = await this.prisma.subject.findFirst({
      where: { id: dto.subjectId, deletedAt: null },
    });
    if (!subject) throw new NotFoundException('Subject not found');
    if (dto.nodeId) await this.content.findNode(dto.subjectId, dto.nodeId);
    if (dto.triggerNodeId)
      await this.content.findNode(dto.subjectId, dto.triggerNodeId);
    const t = await this.prisma.taskTemplate.create({
      data: {
        subjectId: dto.subjectId,
        nodeId: dto.nodeId || null,
        triggerNodeId: dto.triggerNodeId || null,
        createdById: user.id,
        title: dto.title.trim(),
        instructions: sanitizeRich(dto.instructions),
        difficulty: dto.difficulty ?? 'beginner',
        estimatedMins: dto.estimatedMins,
        xpReward: dto.xpReward ?? 10,
        ...ruleFromRelative(dto.schedule),
      },
      include: TEMPLATE_INCLUDE,
    });
    return this.present(t);
  }

  /** Changes apply to learners who complete from now on; tasks already given out stay as they are. */
  async update(id: string, dto: UpdateTemplateDto) {
    const t = await this.require(id);
    const data: Prisma.TaskTemplateUncheckedUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.instructions !== undefined)
      data.instructions = sanitizeRich(dto.instructions);
    if (dto.difficulty !== undefined) data.difficulty = dto.difficulty;
    if (dto.estimatedMins !== undefined) data.estimatedMins = dto.estimatedMins;
    if (dto.xpReward !== undefined) data.xpReward = dto.xpReward;
    if (dto.active !== undefined) data.active = !!dto.active;
    if (dto.nodeId !== undefined) {
      if (dto.nodeId) await this.content.findNode(t.subjectId, dto.nodeId);
      data.nodeId = dto.nodeId || null;
    }
    if (dto.triggerNodeId !== undefined) {
      if (dto.triggerNodeId)
        await this.content.findNode(t.subjectId, dto.triggerNodeId);
      data.triggerNodeId = dto.triggerNodeId || null;
    }
    if (dto.schedule) Object.assign(data, ruleFromRelative(dto.schedule));
    const updated = await this.prisma.taskTemplate.update({
      where: { id },
      data,
      include: TEMPLATE_INCLUDE,
    });
    return this.present(updated);
  }

  async remove(id: string) {
    await this.require(id);
    await this.prisma.taskTemplate.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
    return { ok: true };
  }

  private async require(id: string) {
    const t = await this.prisma.taskTemplate.findFirst({
      where: { id, deletedAt: null },
    });
    if (!t) throw new NotFoundException('Auto-assign task not found');
    return t;
  }

  private present(t: TemplateWithRefs) {
    const { _count, ...rest } = t;
    return {
      ...rest,
      weekdays: t.weekdays ? t.weekdays.split(',').map(Number) : [],
      scheduleLabel: relativeLabel(t),
      breadcrumb: breadcrumbOf(t),
      trigger: breadcrumbOf({ subject: t.subject, node: t.triggerNode }),
      assignedCount: _count.tasks,
    };
  }

  /** Gives the learner every template whose trigger they have now fully completed. */
  private async assignCompleted(
    userId: string,
    subjectId: string,
    p: SubjectProgress,
  ) {
    const templates = await this.prisma.taskTemplate.findMany({
      where: {
        subjectId,
        active: true,
        deletedAt: null,
        tasks: { none: { assigneeId: userId } },
        subject: { deletedAt: null },
      },
      include: {
        subject: { select: { title: true } },
        triggerNode: { select: { title: true } },
      },
    });
    const due = templates.filter((t) =>
      t.triggerNodeId
        ? p.nodes[t.triggerNodeId]?.state === 'done'
        : p.state === 'done',
    );
    if (!due.length) return;

    const today = todayDate();
    for (const t of due) {
      const startDate = addDays(today, t.startAfterDays);
      const created = await this.prisma.task
        .create({
          data: {
            subjectId: t.subjectId,
            nodeId: t.nodeId,
            templateId: t.id,
            createdById: t.createdById,
            assigneeId: userId,
            title: t.title,
            instructions: t.instructions,
            difficulty: t.difficulty,
            estimatedMins: t.estimatedMins,
            xpReward: t.xpReward,
            frequency: t.frequency,
            weekdays: t.weekdays,
            monthDay: t.monthDay,
            intervalDays: t.intervalDays,
            startDate,
            endDate: t.durationDays
              ? addDays(startDate, t.durationDays - 1)
              : null,
          },
        })
        // Unique (template, assignee): a concurrent completion already assigned it.
        .catch((e: { code?: string }) => {
          if (e.code === 'P2002') return null;
          throw e;
        });
      if (!created) continue;
      await this.notifications.notify(userId, {
        title: 'New practice unlocked',
        message: `You finished "${t.triggerNode?.title ?? t.subject.title}". "${t.title}" is now in your practice (${relativeLabel(t)}).`,
        type: 'assign',
        link: '/tasks',
      });
    }
  }
}
