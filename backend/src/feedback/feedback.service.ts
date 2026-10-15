import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(
    private prisma: PrismaService,
    private gamification: GamificationService,
  ) {}

  /** Submitting feedback completes the occurrence and awards XP. */
  async create(userId: string, dto: CreateFeedbackDto) {
    const occ = await this.prisma.taskOccurrence.findUnique({
      where: { id: dto.occurrenceId },
      include: { task: true },
    });
    if (!occ || occ.userId !== userId) {
      throw new NotFoundException('Practice item not found');
    }
    if (occ.status === 'COMPLETED') {
      throw new BadRequestException('Already completed');
    }

    const now = new Date();
    const active = await this.prisma.taskSession.findFirst({
      where: { occurrenceId: occ.id, status: 'active' },
    });
    if (active) {
      await this.prisma.taskSession.update({
        where: { id: active.id },
        data: {
          finishedAt: now,
          duration: Math.floor(
            (now.getTime() - active.startedAt.getTime()) / 1000,
          ),
          status: 'completed',
        },
      });
    }

    const feedback = await this.prisma.feedback.create({
      data: { ...dto, userId },
    });
    await this.prisma.taskOccurrence.update({
      where: { id: occ.id },
      data: { status: 'COMPLETED', completedAt: now },
    });

    if (occ.task.xpReward) {
      await this.gamification.awardXp(
        userId,
        occ.task.xpReward,
        'task_completion',
        occ.id,
      );
    }
    await this.gamification.updateStreak(userId);
    await this.updateLearningProgress(
      userId,
      occ.id,
      occ.task,
      dto.confidenceLevel,
    );

    return feedback;
  }

  async findByUser(userId: string) {
    return this.prisma.feedback.findMany({
      where: { userId },
      include: {
        occurrence: {
          include: { task: { select: { id: true, title: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  private async updateLearningProgress(
    userId: string,
    occurrenceId: string,
    task: { subjectId: string; nodeId: string | null },
    confidence: number,
  ) {
    const sessions = await this.prisma.taskSession.findMany({
      where: { occurrenceId, status: 'completed' },
      select: { duration: true },
    });
    const timeSpent = sessions.reduce((sum, s) => sum + (s.duration ?? 0), 0);
    const scopeKey = task.nodeId ?? task.subjectId;

    const existing = await this.prisma.learningProgress.findUnique({
      where: { userId_scopeKey: { userId, scopeKey } },
    });
    const n = (existing?.tasksCompleted ?? 0) + 1;
    const avgConfidence =
      ((existing?.avgConfidence ?? 0) * (n - 1) + confidence) / n;
    const avgTimeSpent =
      ((existing?.avgTimeSpent ?? 0) * (n - 1) + timeSpent) / n;
    // Confidence-weighted, ramping up with practice count.
    const mastery = Math.min(100, (avgConfidence / 5) * 100 * (n / (n + 5)));

    await this.prisma.learningProgress.upsert({
      where: { userId_scopeKey: { userId, scopeKey } },
      create: {
        userId,
        subjectId: task.subjectId,
        scopeKey,
        tasksCompleted: 1,
        avgConfidence,
        avgTimeSpent,
        mastery,
        lastPracticedAt: new Date(),
      },
      update: {
        tasksCompleted: n,
        avgConfidence,
        avgTimeSpent,
        mastery,
        lastPracticedAt: new Date(),
      },
    });
  }
}
