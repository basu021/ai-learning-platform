import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { GamificationService } from '../gamification/gamification.service';

@Injectable()
export class SchedulerService {
  private logger = new Logger('SchedulerService');

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private gamificationService: GamificationService,
  ) {}

  async generateDailyQueue(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingQueue = await this.prisma.dailyTaskQueue.findMany({
      where: { userId, scheduledAt: { gte: today, lt: tomorrow } },
    });
    if (existingQueue.length > 0) return existingQueue;

    const taskCount = user.dailyTaskCount;
    const revisionCount = Math.ceil(taskCount * 0.3);
    const newTaskCount = taskCount - revisionCount;

    const tasks: string[] = [];

    const revisionTasks = await this.getRevisionTasks(userId, revisionCount);
    tasks.push(...revisionTasks.map((t) => t.id));

    if (tasks.length < taskCount) {
      const pendingTasks = await this.prisma.task.findMany({
        where: { userId, status: 'pending', deletedAt: null },
        take: newTaskCount,
        orderBy: { priority: 'desc' },
      });
      tasks.push(...pendingTasks.map((t) => t.id));
    }

    if (tasks.length < taskCount) {
      const subtopics = await this.getActiveSubtopics(userId);
      for (const subtopic of subtopics) {
        if (tasks.length >= taskCount) break;
        try {
          const generated = await this.aiService.generateTasksForSubtopic(
            userId,
            subtopic.id,
            Math.min(3, taskCount - tasks.length),
          );
          const newTasks = await this.prisma.task.findMany({
            where: { userId, subtopicId: subtopic.id, status: 'pending' },
            take: taskCount - tasks.length,
            orderBy: { createdAt: 'desc' },
          });
          tasks.push(...newTasks.map((t) => t.id));
          this.logger.log(
            `Generated ${generated.length} tasks for ${subtopic.name}`,
          );
        } catch (err) {
          this.logger.error(
            `Failed to generate tasks for ${subtopic.name}`,
            err,
          );
        }
      }
    }

    const queue = await Promise.all(
      tasks.map((taskId, index) =>
        this.prisma.dailyTaskQueue.create({
          data: { userId, taskId, scheduledAt: today, position: index },
        }),
      ),
    );

    await this.gamificationService.updateStreak(userId);

    return queue;
  }

  async scheduleRevision(userId: string, taskId: string, daysFromNow: number) {
    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + daysFromNow);

    const count = await this.prisma.revisionHistory.count({
      where: { userId, taskId },
    });

    return this.prisma.revisionHistory.create({
      data: {
        userId,
        taskId,
        revisionNumber: count + 1,
        scheduledFor,
      },
    });
  }

  private async getRevisionTasks(userId: string, count: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pendingRevisions = await this.prisma.revisionHistory.findMany({
      where: {
        userId,
        scheduledFor: { lte: today },
        completedAt: null,
      },
      include: { task: true },
      take: count,
      orderBy: { scheduledFor: 'asc' },
    });

    return pendingRevisions.map((r) => r.task);
  }

  private async getActiveSubtopics(userId: string) {
    const subjects = await this.prisma.subject.findMany({
      where: { userId, deletedAt: null },
      include: {
        topics: {
          where: { deletedAt: null },
          include: {
            subtopics: { where: { deletedAt: null } },
          },
        },
      },
    });

    const subtopics: Array<{ id: string; name: string }> = [];
    subjects.forEach((s) =>
      s.topics.forEach((t) =>
        t.subtopics.forEach((st) =>
          subtopics.push({ id: st.id, name: st.name }),
        ),
      ),
    );

    return subtopics;
  }
}
