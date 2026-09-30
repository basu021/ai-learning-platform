import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { resetDueRepeatableTasks } from '../common/task-recurrence';
import { CreateTaskDto, UpdateTaskStatusDto } from './dto/create-task.dto';

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateTaskDto) {
    const subtopic = await this.prisma.subtopic.findFirst({
      where: {
        id: dto.subtopicId,
        deletedAt: null,
        topic: { subject: { userId } },
      },
    });
    if (!subtopic) throw new NotFoundException('Subtopic not found');

    return this.prisma.task.create({
      data: { ...dto, userId },
    });
  }

  async findBySubtopic(subtopicId: string, userId: string) {
    return this.prisma.task.findMany({
      where: { subtopicId, userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    await resetDueRepeatableTasks(this.prisma, userId);
    const task = await this.prisma.task.findFirst({
      where: { id, userId, deletedAt: null },
      include: {
        subtopic: { include: { topic: { include: { subject: true } } } },
        feedback: { orderBy: { createdAt: 'desc' }, take: 5 },
        taskSessions: { orderBy: { startedAt: 'desc' }, take: 5 },
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async updateStatus(id: string, userId: string, dto: UpdateTaskStatusDto) {
    const task = await this.findOne(id, userId);
    const enteringCompleted =
      dto.status === 'completed' && task.status !== 'completed';
    return this.prisma.task.update({
      where: { id: task.id },
      data: {
        status: dto.status,
        ...(enteringCompleted
          ? { completedAt: new Date(), timesCompleted: { increment: 1 } }
          : {}),
      },
    });
  }

  async startSession(taskId: string, userId: string) {
    await this.findOne(taskId, userId);
    await this.prisma.task.update({
      where: { id: taskId },
      data: { status: 'in_progress' },
    });
    return this.prisma.taskSession.create({
      data: { taskId, userId },
    });
  }

  async finishSession(sessionId: string, userId: string) {
    const session = await this.prisma.taskSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('Session not found');

    const now = new Date();
    const duration = Math.floor(
      (now.getTime() - session.startedAt.getTime()) / 1000,
    );

    return this.prisma.taskSession.update({
      where: { id: sessionId },
      data: { finishedAt: now, duration, status: 'completed' },
    });
  }

  async getTodaysTasks(userId: string) {
    await resetDueRepeatableTasks(this.prisma, userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.prisma.dailyTaskQueue.findMany({
      where: {
        userId,
        scheduledAt: { gte: today, lt: tomorrow },
      },
      include: {
        task: {
          include: {
            subtopic: { include: { topic: { include: { subject: true } } } },
          },
        },
      },
      orderBy: { position: 'asc' },
    });
  }

  async getUserTasks(userId: string, status?: string) {
    await resetDueRepeatableTasks(this.prisma, userId);
    const where: Record<string, unknown> = { userId, deletedAt: null };
    if (status) where.status = status;
    return this.prisma.task.findMany({
      where,
      include: {
        subtopic: { include: { topic: { include: { subject: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.task.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
