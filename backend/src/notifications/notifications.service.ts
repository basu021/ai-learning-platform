import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async notify(
    userIds: string | string[],
    data: { title: string; message: string; type: string; link?: string },
  ) {
    const ids = [...new Set(Array.isArray(userIds) ? userIds : [userIds])];
    if (ids.length === 0) return;
    await this.prisma.notification.createMany({
      data: ids.map((userId) => ({ userId, ...data })),
    });
  }

  async notifyAdmins(
    data: { title: string; message: string; type: string; link?: string },
    exceptUserId?: string,
  ) {
    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN', deletedAt: null, id: { not: exceptUserId } },
      select: { id: true },
    });
    await this.notify(
      admins.map((a) => a.id),
      data,
    );
  }

  list(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, read: false } });
  }

  markRead(userId: string, id: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
  }

  markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }
}
