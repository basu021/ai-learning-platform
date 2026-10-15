import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { ProgressService } from '../subjects/progress.service';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private tasks: TasksService,
    private progress: ProgressService,
  ) {}

  async getDashboard(userId: string) {
    const [
      agenda,
      user,
      streak,
      subjectProgress,
      recentActivity,
      weakAreas,
      reading,
    ] = await Promise.all([
      this.tasks.agenda(userId),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { totalXp: true, level: true, name: true, role: true },
      }),
      this.prisma.streak.findFirst({ where: { userId, type: 'daily' } }),
      this.getSubjectProgress(userId),
      this.getRecentActivity(userId),
      this.getWeakAreas(userId),
      this.progress.recent(userId),
    ]);

    const done = agenda.todayItems.filter(
      (o) => o.status === 'COMPLETED',
    ).length;
    return {
      user,
      streak,
      agenda,
      todayProgress: { total: agenda.todayItems.length, completed: done },
      subjectProgress,
      recentActivity,
      weakAreas,
      reading,
    };
  }

  /** Completion rate of due practice per subject. */
  private async getSubjectProgress(userId: string) {
    const groups = await this.prisma.taskOccurrence.groupBy({
      by: ['taskId', 'status'],
      where: { userId },
      _count: { _all: true },
    });
    if (!groups.length) return [];
    const tasks = await this.prisma.task.findMany({
      where: { id: { in: [...new Set(groups.map((g) => g.taskId))] } },
      select: {
        id: true,
        subject: { select: { id: true, title: true, color: true } },
      },
    });
    const bySubject = new Map<
      string,
      {
        id: string;
        title: string;
        color: string | null;
        due: number;
        completed: number;
      }
    >();
    for (const g of groups) {
      const subject = tasks.find((t) => t.id === g.taskId)?.subject;
      if (!subject) continue;
      const entry = bySubject.get(subject.id) ?? {
        ...subject,
        due: 0,
        completed: 0,
      };
      entry.due += g._count._all;
      if (g.status === 'COMPLETED') entry.completed += g._count._all;
      bySubject.set(subject.id, entry);
    }
    return [...bySubject.values()].map((s) => ({
      ...s,
      rate: s.due ? Math.round((s.completed / s.due) * 100) : 0,
    }));
  }

  private async getRecentActivity(userId: string) {
    const items = await this.prisma.taskOccurrence.findMany({
      where: { userId, status: 'COMPLETED' },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            subject: { select: { title: true } },
          },
        },
        taskSessions: {
          where: { status: 'completed' },
          select: { duration: true },
        },
      },
      orderBy: { completedAt: 'desc' },
      take: 8,
    });
    return items.map((o) => ({
      id: o.id,
      title: o.task.title,
      subject: o.task.subject.title,
      completedAt: o.completedAt,
      duration: o.taskSessions.reduce((sum, s) => sum + (s.duration ?? 0), 0),
    }));
  }

  private async getWeakAreas(userId: string) {
    const rows = await this.prisma.learningProgress.findMany({
      where: { userId, mastery: { lt: 40 } },
      orderBy: { mastery: 'asc' },
      take: 5,
    });
    const nodes = await this.prisma.contentNode.findMany({
      where: { id: { in: rows.map((r) => r.scopeKey) } },
      select: { id: true, title: true },
    });
    const subjects = await this.prisma.subject.findMany({
      where: { id: { in: rows.map((r) => r.subjectId) } },
      select: { id: true, title: true },
    });
    return rows.map((r) => ({
      mastery: r.mastery,
      title:
        nodes.find((n) => n.id === r.scopeKey)?.title ??
        subjects.find((s) => s.id === r.subjectId)?.title ??
        '',
      subjectId: r.subjectId,
    }));
  }
}
