import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getDashboard(userId: string) {
    const [
      todaysTasks,
      subjectProgress,
      weakAreas,
      recentActivity,
      upcomingRevisions,
      streak,
      user,
      notifications,
    ] = await Promise.all([
      this.getTodaysTasks(userId),
      this.getSubjectProgress(userId),
      this.getWeakAreas(userId),
      this.getRecentActivity(userId),
      this.getUpcomingRevisions(userId),
      this.getStreak(userId),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          totalXp: true,
          level: true,
          name: true,
          dailyTaskCount: true,
        },
      }),
      this.prisma.notification.findMany({
        where: { userId, read: false },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const totalTasks = todaysTasks.length;
    const completedTasks = todaysTasks.filter((t) => t.completed).length;

    return {
      user,
      todaysTasks,
      todayProgress: { total: totalTasks, completed: completedTasks },
      subjectProgress,
      weakAreas,
      recentActivity,
      upcomingRevisions,
      streak,
      notifications,
    };
  }

  private async getTodaysTasks(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.prisma.dailyTaskQueue.findMany({
      where: { userId, scheduledAt: { gte: today, lt: tomorrow } },
      include: {
        task: {
          include: {
            subtopic: { include: { topic: { include: { subject: true } } } },
            taskSessions: {
              where: { status: 'active' },
              take: 1,
            },
          },
        },
      },
      orderBy: { position: 'asc' },
    });
  }

  private async getSubjectProgress(userId: string) {
    const subjects = await this.prisma.subject.findMany({
      where: { userId, deletedAt: null },
      include: {
        topics: {
          where: { deletedAt: null },
          include: {
            subtopics: {
              where: { deletedAt: null },
              include: {
                learningProgress: { where: { userId } },
                _count: { select: { tasks: true } },
              },
            },
          },
        },
      },
    });

    return subjects.map((subject) => {
      let totalMastery = 0;
      let subtopicCount = 0;
      let totalTasks = 0;
      let completedTasks = 0;

      subject.topics.forEach((topic) => {
        topic.subtopics.forEach((subtopic) => {
          subtopicCount++;
          totalTasks += subtopic._count.tasks;
          if (subtopic.learningProgress.length > 0) {
            const progress = subtopic.learningProgress[0];
            totalMastery += progress.mastery;
            completedTasks += progress.tasksCompleted;
          }
        });
      });

      return {
        id: subject.id,
        name: subject.name,
        color: subject.color,
        icon: subject.icon,
        mastery: subtopicCount > 0 ? totalMastery / subtopicCount : 0,
        totalTasks,
        completedTasks,
        topicCount: subject.topics.length,
        subtopicCount,
      };
    });
  }

  private async getWeakAreas(userId: string) {
    return this.prisma.learningProgress.findMany({
      where: { userId, mastery: { lt: 40 } },
      include: {
        subtopic: { include: { topic: { include: { subject: true } } } },
      },
      orderBy: { mastery: 'asc' },
      take: 10,
    });
  }

  private async getRecentActivity(userId: string) {
    return this.prisma.taskSession.findMany({
      where: { userId, status: 'completed' },
      include: {
        task: { include: { subtopic: true } },
      },
      orderBy: { finishedAt: 'desc' },
      take: 10,
    });
  }

  private async getUpcomingRevisions(userId: string) {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    return this.prisma.revisionHistory.findMany({
      where: {
        userId,
        completedAt: null,
        scheduledFor: { lte: nextWeek },
      },
      include: { task: { include: { subtopic: true } } },
      orderBy: { scheduledFor: 'asc' },
      take: 10,
    });
  }

  private async getStreak(userId: string) {
    return this.prisma.streak.findFirst({
      where: { userId, type: 'daily', subjectName: null },
    });
  }
}
