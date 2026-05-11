import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateFeedbackDto) {
    const feedback = await this.prisma.feedback.create({
      data: { ...dto, userId },
    });

    await this.prisma.task.update({
      where: { id: dto.taskId },
      data: { status: 'completed' },
    });

    await this.updateLearningProgress(userId, dto.taskId, dto.confidenceLevel);

    return feedback;
  }

  async findByTask(taskId: string) {
    return this.prisma.feedback.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByUser(userId: string) {
    return this.prisma.feedback.findMany({
      where: { userId },
      include: { task: { include: { subtopic: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  private async updateLearningProgress(
    userId: string,
    taskId: string,
    confidence: number,
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { taskSessions: { orderBy: { startedAt: 'desc' }, take: 1 } },
    });
    if (!task) return;

    const existing = await this.prisma.learningProgress.findUnique({
      where: { userId_subtopicId: { userId, subtopicId: task.subtopicId } },
    });

    const timeSpent = task.taskSessions[0]?.duration || 0;

    if (existing) {
      const newTasksCompleted = existing.tasksCompleted + 1;
      const newAvgConfidence =
        (existing.avgConfidence * existing.tasksCompleted + confidence) /
        newTasksCompleted;
      const newAvgTimeSpent =
        (existing.avgTimeSpent * existing.tasksCompleted + timeSpent) /
        newTasksCompleted;
      const newMastery = Math.min(
        100,
        (newAvgConfidence / 5) *
          100 *
          (newTasksCompleted / (newTasksCompleted + 5)),
      );

      await this.prisma.learningProgress.update({
        where: { id: existing.id },
        data: {
          tasksCompleted: newTasksCompleted,
          avgConfidence: newAvgConfidence,
          avgTimeSpent: newAvgTimeSpent,
          mastery: newMastery,
          lastPracticedAt: new Date(),
        },
      });
    } else {
      await this.prisma.learningProgress.create({
        data: {
          userId,
          subtopicId: task.subtopicId,
          tasksCompleted: 1,
          avgConfidence: confidence,
          avgTimeSpent: timeSpent,
          mastery: (confidence / 5) * 100 * (1 / 6),
          lastPracticedAt: new Date(),
        },
      });
    }
  }
}
