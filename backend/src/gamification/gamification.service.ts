import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GamificationService {
  private logger = new Logger('GamificationService');

  private levelThresholds = [
    0, 100, 250, 500, 1000, 2000, 3500, 5500, 8000, 12000, 17000, 23000, 30000,
    40000, 55000, 75000, 100000,
  ];

  constructor(private prisma: PrismaService) {}

  async awardXp(
    userId: string,
    amount: number,
    source: string,
    sourceId?: string,
  ) {
    await this.prisma.xpHistory.create({
      data: { userId, amount, source, sourceId },
    });

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { totalXp: { increment: amount } },
    });

    const newLevel = this.calculateLevel(user.totalXp);
    if (newLevel > user.level) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { level: newLevel },
      });
      await this.createNotification(
        userId,
        'Level Up!',
        `You reached Level ${newLevel}!`,
        'achievement',
      );
      this.logger.log(`User ${userId} leveled up to ${newLevel}`);
    }

    return { xp: user.totalXp, level: newLevel, awarded: amount };
  }

  async updateStreak(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let streak = await this.prisma.streak.findFirst({
      where: { userId, type: 'daily', subjectName: null },
    });

    if (!streak) {
      streak = await this.prisma.streak.create({
        data: {
          userId,
          type: 'daily',
          currentCount: 1,
          longestCount: 1,
          lastActiveAt: today,
        },
      });
      return streak;
    }

    const lastActive = new Date(streak.lastActiveAt);
    lastActive.setHours(0, 0, 0, 0);
    const diffDays = Math.floor(
      (today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays === 0) return streak;

    let newCount: number;
    if (diffDays === 1) {
      newCount = streak.currentCount + 1;
    } else {
      newCount = 1;
    }

    const longestCount = Math.max(streak.longestCount, newCount);

    streak = await this.prisma.streak.update({
      where: { id: streak.id },
      data: { currentCount: newCount, longestCount, lastActiveAt: today },
    });

    if (newCount % 7 === 0) {
      await this.awardXp(userId, 50, 'streak_bonus', streak.id);
    }
    if (newCount % 30 === 0) {
      await this.awardXp(userId, 200, 'streak_bonus', streak.id);
    }

    return streak;
  }

  async getStats(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totalXp: true, level: true },
    });

    const streak = await this.prisma.streak.findFirst({
      where: { userId, type: 'daily', subjectName: null },
    });

    const achievements = await this.prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
    });

    const xpHistory = await this.prisma.xpHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    const progressBySubtopic = await this.prisma.learningProgress.findMany({
      where: { userId },
      include: {
        subtopic: { include: { topic: { include: { subject: true } } } },
      },
    });

    const nextLevelXp = this.getNextLevelXp(user?.level || 1);

    return {
      xp: user?.totalXp || 0,
      level: user?.level || 1,
      nextLevelXp,
      streak: streak?.currentCount || 0,
      longestStreak: streak?.longestCount || 0,
      achievements: achievements.map((a) => ({
        ...a.achievement,
        unlockedAt: a.unlockedAt,
      })),
      xpHistory,
      progressBySubtopic,
    };
  }

  async getActivityHeatmap(userId: string) {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const sessions = await this.prisma.taskSession.findMany({
      where: {
        userId,
        startedAt: { gte: sixMonthsAgo },
        status: 'completed',
      },
      select: { startedAt: true, duration: true },
    });

    const heatmap: Record<string, { count: number; duration: number }> = {};
    sessions.forEach((s) => {
      const dateKey = s.startedAt.toISOString().split('T')[0];
      if (!heatmap[dateKey]) heatmap[dateKey] = { count: 0, duration: 0 };
      heatmap[dateKey].count++;
      heatmap[dateKey].duration += s.duration || 0;
    });

    return Object.entries(heatmap).map(([date, data]) => ({
      date,
      count: data.count,
      duration: data.duration,
    }));
  }

  private calculateLevel(xp: number): number {
    for (let i = this.levelThresholds.length - 1; i >= 0; i--) {
      if (xp >= this.levelThresholds[i]) return i + 1;
    }
    return 1;
  }

  private getNextLevelXp(level: number): number {
    if (level >= this.levelThresholds.length)
      return this.levelThresholds[this.levelThresholds.length - 1] * 2;
    return this.levelThresholds[level];
  }

  private async createNotification(
    userId: string,
    title: string,
    message: string,
    type: string,
  ) {
    await this.prisma.notification.create({
      data: { userId, title, message, type },
    });
  }
}
