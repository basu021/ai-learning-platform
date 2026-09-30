import { PrismaService } from '../prisma/prisma.service';

/**
 * Repeatable tasks reopen a fixed number of hours after completion instead of
 * running on a background job. Called from read paths (task lists, dashboard,
 * admin views) so a due task flips back to "pending" the next time anyone looks.
 */
export async function resetDueRepeatableTasks(
  prisma: PrismaService,
  userId?: string,
): Promise<void> {
  const where: Record<string, unknown> = {
    status: 'completed',
    repeatIntervalHours: { not: null },
    completedAt: { not: null },
    deletedAt: null,
  };
  if (userId) where.userId = userId;

  const candidates = await prisma.task.findMany({
    where,
    select: { id: true, completedAt: true, repeatIntervalHours: true },
  });

  const now = Date.now();
  const dueIds = candidates
    .filter(
      (t) =>
        t.completedAt &&
        t.repeatIntervalHours &&
        t.completedAt.getTime() + t.repeatIntervalHours * 3_600_000 <= now,
    )
    .map((t) => t.id);

  if (dueIds.length > 0) {
    await prisma.task.updateMany({
      where: { id: { in: dueIds } },
      data: { status: 'pending', completedAt: null },
    });
  }
}
