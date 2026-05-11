import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAIProvider } from './providers/openai.provider';
import {
  AIProvider,
  GenerateTaskRequest,
  GeneratedTask,
  AnalyzeFeedbackRequest,
  FeedbackAnalysis,
} from './providers/ai-provider.interface';

@Injectable()
export class AiService {
  private provider: AIProvider;
  private logger = new Logger('AiService');

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.provider = new OpenAIProvider(configService);
  }

  async generateTasksForSubtopic(
    userId: string,
    subtopicId: string,
    count = 5,
  ): Promise<GeneratedTask[]> {
    const subtopic = await this.prisma.subtopic.findUnique({
      where: { id: subtopicId },
      include: { topic: { include: { subject: true } } },
    });
    if (!subtopic) throw new Error('Subtopic not found');

    const progress = await this.prisma.learningProgress.findUnique({
      where: { userId_subtopicId: { userId, subtopicId } },
    });

    const previousTasks = await this.prisma.task.findMany({
      where: { subtopicId, userId },
      select: { title: true },
      take: 20,
    });

    const recentFeedback = await this.prisma.feedback.findMany({
      where: { userId, task: { subtopicId } },
      select: { needsImprovement: true, problemsFaced: true },
      take: 5,
      orderBy: { createdAt: 'desc' },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    const request: GenerateTaskRequest = {
      subject: subtopic.topic.subject.name,
      topic: subtopic.topic.name,
      subtopic: subtopic.name,
      difficulty: user?.difficulty || 'beginner',
      count,
      previousTasks: previousTasks.map((t) => t.title),
      weakAreas: progress?.weakAreas
        ? (JSON.parse(progress.weakAreas) as string[])
        : [],
      feedbackHistory: recentFeedback
        .map((f) =>
          [f.needsImprovement, f.problemsFaced].filter(Boolean).join('; '),
        )
        .filter(Boolean),
    };

    const tasks = await this.provider.generateTasks(request);

    const createdTasks = await Promise.all(
      tasks.map((task) =>
        this.prisma.task.create({
          data: {
            subtopicId,
            userId,
            title: task.title,
            description: task.description,
            difficulty: task.difficulty,
            taskType: task.taskType,
            estimatedMins: task.estimatedMins,
            xpReward: this.calculateXp(task.difficulty),
            aiGenerated: true,
            aiModel: this.provider.name,
            hints: JSON.stringify(task.hints),
            commands: JSON.stringify(task.commands),
            tags: JSON.stringify(task.tags),
          },
        }),
      ),
    );

    this.logger.log(
      `Generated ${createdTasks.length} tasks for subtopic ${subtopic.name}`,
    );
    return tasks;
  }

  async analyzeFeedbackAndAdapt(
    userId: string,
    taskId: string,
  ): Promise<FeedbackAnalysis> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { subtopic: true },
    });
    if (!task) throw new Error('Task not found');

    const feedback = await this.prisma.feedback.findFirst({
      where: { taskId, userId },
      orderBy: { createdAt: 'desc' },
    });
    if (!feedback) throw new Error('No feedback found');

    const progress = await this.prisma.learningProgress.findUnique({
      where: { userId_subtopicId: { userId, subtopicId: task.subtopicId } },
    });

    const request: AnalyzeFeedbackRequest = {
      task: {
        title: task.title,
        description: task.description,
        subtopic: task.subtopic.name,
      },
      feedback: {
        whatWasDone: feedback.whatWasDone || '',
        problemsFaced: feedback.problemsFaced || '',
        commandsUsed: feedback.commandsUsed || '',
        confidenceLevel: feedback.confidenceLevel,
        needsImprovement: feedback.needsImprovement || '',
      },
      learningProgress: {
        mastery: progress?.mastery || 0,
        tasksCompleted: progress?.tasksCompleted || 0,
        avgConfidence: progress?.avgConfidence || 0,
        weakAreas: progress?.weakAreas
          ? (JSON.parse(progress.weakAreas) as string[])
          : [],
      },
    };

    const analysis = await this.provider.analyzeFeedback(request);

    if (progress) {
      await this.prisma.learningProgress.update({
        where: { id: progress.id },
        data: {
          weakAreas: JSON.stringify(analysis.weaknesses),
        },
      });
    }

    return analysis;
  }

  private calculateXp(difficulty: string): number {
    const xpMap: Record<string, number> = {
      beginner: 10,
      intermediate: 20,
      advanced: 35,
      expert: 50,
    };
    return xpMap[difficulty] || 10;
  }
}
