import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { resetDueRepeatableTasks } from '../common/task-recurrence';
import {
  AssignContentDto,
  AdminCreateUserDto,
  AdminUpdateSubjectDto,
  AdminUpdateTopicDto,
  AdminUpdateSubtopicDto,
  AdminUpdateTaskDto,
} from './dto/assign-content.dto';

@Injectable()
export class AdminManagementService {
  constructor(private prisma: PrismaService) {}

  async listUsers(role?: string) {
    const where: Record<string, unknown> = { deletedAt: null };
    if (role) where.role = role;

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        level: true,
        totalXp: true,
        difficulty: true,
        createdAt: true,
        _count: { select: { subjects: true, tasks: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const pendingCounts = await this.prisma.task.groupBy({
      by: ['userId'],
      where: {
        deletedAt: null,
        status: { in: ['pending', 'started', 'in_progress'] },
      },
      _count: { _all: true },
    });
    const completedCounts = await this.prisma.task.groupBy({
      by: ['userId'],
      where: { deletedAt: null, status: 'completed' },
      _count: { _all: true },
    });

    const pendingMap = new Map(pendingCounts.map((p) => [p.userId, p._count._all]));
    const completedMap = new Map(completedCounts.map((c) => [c.userId, c._count._all]));

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      level: u.level,
      totalXp: u.totalXp,
      difficulty: u.difficulty,
      createdAt: u.createdAt,
      stats: {
        subjectsCount: u._count.subjects,
        totalTasks: u._count.tasks,
        pendingTasks: pendingMap.get(u.id) || 0,
        completedTasks: completedMap.get(u.id) || 0,
      },
    }));
  }

  async createUser(dto: AdminCreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        role: dto.role || 'user',
        emailVerified: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        level: true,
        totalXp: true,
        createdAt: true,
      },
    });

    return user;
  }

  async getUserOverview(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        level: true,
        totalXp: true,
        difficulty: true,
        dailyTaskCount: true,
        dailyHours: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    await resetDueRepeatableTasks(this.prisma, userId);

    const subjects = await this.prisma.subject.findMany({
      where: { userId, deletedAt: null },
      include: {
        topics: {
          where: { deletedAt: null },
          include: {
            subtopics: {
              where: { deletedAt: null },
              include: {
                tasks: {
                  where: { deletedAt: null },
                  orderBy: { createdAt: 'desc' },
                },
              },
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    });

    return { user, subjects };
  }

  async listTasks(filters: { status?: string; userId?: string }) {
    await resetDueRepeatableTasks(this.prisma, filters.userId);
    const where: Record<string, unknown> = { deletedAt: null };
    if (filters.status) where.status = filters.status;
    if (filters.userId) where.userId = filters.userId;

    return this.prisma.task.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        subtopic: { include: { topic: { include: { subject: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async listAssignments() {
    const tasks = await this.prisma.task.findMany({
      where: { assignmentGroupId: { not: null }, deletedAt: null },
      include: {
        user: { select: { id: true, name: true, email: true } },
        subtopic: { include: { topic: { include: { subject: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const groups = new Map<
      string,
      {
        assignmentGroupId: string;
        assignedBy: string | null;
        subjectName: string;
        topicName: string | null;
        subtopicName: string;
        createdAt: Date;
        targets: Map<
          string,
          { userId: string; userName: string; userEmail: string; total: number; completed: number }
        >;
      }
    >();

    for (const task of tasks) {
      const groupId = task.assignmentGroupId as string;
      if (!groups.has(groupId)) {
        groups.set(groupId, {
          assignmentGroupId: groupId,
          assignedBy: task.assignedBy,
          subjectName: task.subtopic.topic.subject.name,
          topicName: task.subtopic.topic.name,
          subtopicName: task.subtopic.name,
          createdAt: task.createdAt,
          targets: new Map(),
        });
      }
      const group = groups.get(groupId)!;
      if (task.createdAt < group.createdAt) group.createdAt = task.createdAt;

      if (!group.targets.has(task.userId)) {
        group.targets.set(task.userId, {
          userId: task.userId,
          userName: task.user.name,
          userEmail: task.user.email,
          total: 0,
          completed: 0,
        });
      }
      const target = group.targets.get(task.userId)!;
      target.total += 1;
      if (task.status === 'completed') target.completed += 1;
    }

    return Array.from(groups.values())
      .map((g) => ({ ...g, targets: Array.from(g.targets.values()) }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async assignContent(adminId: string, dto: AssignContentDto) {
    const assignmentGroupId = dto.tasks && dto.tasks.length > 0 ? randomUUID() : null;

    const results = [];
    for (const userId of dto.userIds) {
      const targetUser = await this.prisma.user.findFirst({
        where: { id: userId, deletedAt: null },
      });
      if (!targetUser) continue;

      let subject = await this.prisma.subject.findFirst({
        where: { userId, name: dto.subjectName, deletedAt: null },
      });
      if (!subject) {
        subject = await this.prisma.subject.create({
          data: {
            userId,
            name: dto.subjectName,
            description: dto.subjectDescription,
            icon: dto.subjectIcon,
            color: dto.subjectColor,
            assignedBy: adminId,
          },
        });
      }

      let topic: Awaited<ReturnType<typeof this.prisma.topic.findFirst>> = null;
      if (dto.topicName) {
        topic = await this.prisma.topic.findFirst({
          where: { subjectId: subject.id, name: dto.topicName, deletedAt: null },
        });
        if (!topic) {
          topic = await this.prisma.topic.create({
            data: {
              subjectId: subject.id,
              name: dto.topicName,
              description: dto.topicDescription,
              assignedBy: adminId,
            },
          });
        }
      }

      let subtopic: Awaited<ReturnType<typeof this.prisma.subtopic.findFirst>> = null;
      if (topic && dto.subtopicName) {
        subtopic = await this.prisma.subtopic.findFirst({
          where: { topicId: topic.id, name: dto.subtopicName, deletedAt: null },
        });
        if (!subtopic) {
          subtopic = await this.prisma.subtopic.create({
            data: {
              topicId: topic.id,
              name: dto.subtopicName,
              description: dto.subtopicDescription,
              assignedBy: adminId,
            },
          });
        }
      }

      const createdTaskIds: string[] = [];
      if (subtopic && dto.tasks && dto.tasks.length > 0) {
        for (const taskInput of dto.tasks) {
          const task = await this.prisma.task.create({
            data: {
              subtopicId: subtopic.id,
              userId,
              title: taskInput.title,
              description: taskInput.description,
              difficulty: taskInput.difficulty,
              taskType: taskInput.taskType,
              estimatedMins: taskInput.estimatedMins,
              xpReward: taskInput.xpReward,
              repeatIntervalHours: taskInput.repeatIntervalHours,
              aiGenerated: false,
              assignedBy: adminId,
              assignmentGroupId,
            },
          });
          createdTaskIds.push(task.id);
        }
      }

      results.push({
        userId,
        userName: targetUser.name,
        subjectId: subject.id,
        topicId: topic?.id || null,
        subtopicId: subtopic?.id || null,
        taskIds: createdTaskIds,
      });
    }

    return { assignmentGroupId, results };
  }

  // --- Cross-user content management (admin override, any owner) ---

  async updateSubject(id: string, dto: AdminUpdateSubjectDto) {
    await this.findSubjectOrThrow(id);
    return this.prisma.subject.update({ where: { id }, data: dto });
  }

  async deleteSubject(id: string) {
    await this.findSubjectOrThrow(id);
    return this.prisma.subject.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async updateTopic(id: string, dto: AdminUpdateTopicDto) {
    await this.findTopicOrThrow(id);
    return this.prisma.topic.update({ where: { id }, data: dto });
  }

  async deleteTopic(id: string) {
    await this.findTopicOrThrow(id);
    return this.prisma.topic.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async updateSubtopic(id: string, dto: AdminUpdateSubtopicDto) {
    await this.findSubtopicOrThrow(id);
    return this.prisma.subtopic.update({ where: { id }, data: dto });
  }

  async deleteSubtopic(id: string) {
    await this.findSubtopicOrThrow(id);
    return this.prisma.subtopic.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async updateTask(id: string, dto: AdminUpdateTaskDto) {
    const task = await this.findTaskOrThrow(id);
    const enteringCompleted =
      dto.status === 'completed' && task.status !== 'completed';

    const { repeatIntervalHours, ...rest } = dto;
    return this.prisma.task.update({
      where: { id },
      data: {
        ...rest,
        ...(repeatIntervalHours !== undefined
          ? { repeatIntervalHours: repeatIntervalHours === 0 ? null : repeatIntervalHours }
          : {}),
        ...(enteringCompleted
          ? { completedAt: new Date(), timesCompleted: { increment: 1 } }
          : {}),
      },
    });
  }

  async deleteTask(id: string) {
    await this.findTaskOrThrow(id);
    return this.prisma.task.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private async findSubjectOrThrow(id: string) {
    const record = await this.prisma.subject.findFirst({ where: { id, deletedAt: null } });
    if (!record) throw new NotFoundException('Subject not found');
    return record;
  }

  private async findTopicOrThrow(id: string) {
    const record = await this.prisma.topic.findFirst({ where: { id, deletedAt: null } });
    if (!record) throw new NotFoundException('Topic not found');
    return record;
  }

  private async findSubtopicOrThrow(id: string) {
    const record = await this.prisma.subtopic.findFirst({ where: { id, deletedAt: null } });
    if (!record) throw new NotFoundException('Subtopic not found');
    return record;
  }

  private async findTaskOrThrow(id: string) {
    const record = await this.prisma.task.findFirst({ where: { id, deletedAt: null } });
    if (!record) throw new NotFoundException('Task not found');
    return record;
  }
}
