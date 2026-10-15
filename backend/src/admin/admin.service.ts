import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService, publicUser } from '../auth/auth.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { formatDate, todayDate } from '../common/utils/dates';
import { AdminCreateUserDto, AdminUpdateUserDto } from './admin.dto';

const USER_SUMMARY = { id: true, name: true, username: true } as const;

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private auth: AuthService,
  ) {}

  async stats() {
    const today = todayDate();
    const [
      users,
      admins,
      subjects,
      catalog,
      tasks,
      dueToday,
      doneToday,
      pendingAccess,
      pendingChanges,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null, role: 'ADMIN' } }),
      this.prisma.subject.count({ where: { deletedAt: null } }),
      this.prisma.subject.count({
        where: {
          deletedAt: null,
          status: 'PUBLISHED',
          visibility: { in: ['PUBLIC', 'LISTED'] },
        },
      }),
      this.prisma.task.count({ where: { deletedAt: null, active: true } }),
      this.prisma.taskOccurrence.count({ where: { dueDate: today } }),
      this.prisma.taskOccurrence.count({
        where: { dueDate: today, status: 'COMPLETED' },
      }),
      this.prisma.accessRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.changeRequest.count({ where: { status: 'PENDING' } }),
    ]);
    return {
      today: formatDate(today),
      users,
      admins,
      subjects,
      catalog,
      tasks,
      dueToday,
      doneToday,
      pendingAccess,
      pendingChanges,
    };
  }

  async listUsers(q?: string) {
    const where: Prisma.UserWhereInput = q
      ? {
          OR: [
            { name: { contains: q } },
            { username: { contains: q.toLowerCase() } },
            { email: { contains: q.toLowerCase() } },
          ],
        }
      : {};
    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        level: true,
        totalXp: true,
        createdAt: true,
        deletedAt: true,
        _count: {
          select: {
            ownedSubjects: { where: { deletedAt: null } },
            memberships: true,
            assignedTasks: { where: { deletedAt: null, active: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });
    return users.map(({ _count, deletedAt, ...u }) => ({
      ...u,
      active: !deletedAt,
      subjectCount: _count.ownedSubjects,
      sharedCount: _count.memberships,
      taskCount: _count.assignedTasks,
    }));
  }

  async createUser(dto: AdminCreateUserDto) {
    return publicUser(await this.auth.createUser(dto));
  }

  async updateUser(admin: AuthUser, id: string, dto: AdminUpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (id === admin.id && (dto.role === 'USER' || dto.active === false)) {
      throw new BadRequestException("You can't demote or deactivate yourself");
    }
    const data: Prisma.UserUpdateInput = {};
    if (dto.name) data.name = dto.name;
    if (dto.role) data.role = dto.role;
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 12);
      data.refreshToken = null;
    }
    if (dto.active !== undefined) {
      data.deletedAt = dto.active ? null : new Date();
      if (!dto.active) data.refreshToken = null;
    }
    return publicUser(await this.prisma.user.update({ where: { id }, data }));
  }

  async userDetail(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    const [owned, memberships, streak] = await Promise.all([
      this.prisma.subject.findMany({
        where: { ownerId: id, deletedAt: null },
        select: {
          id: true,
          title: true,
          visibility: true,
          status: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.subjectMember.findMany({
        where: { userId: id, subject: { deletedAt: null } },
        include: {
          subject: {
            select: {
              id: true,
              title: true,
              visibility: true,
              owner: { select: USER_SUMMARY },
            },
          },
          grantedBy: { select: USER_SUMMARY },
        },
      }),
      this.prisma.streak.findFirst({ where: { userId: id, type: 'daily' } }),
    ]);
    return {
      ...publicUser(user),
      active: !user.deletedAt,
      createdAt: user.createdAt,
      streak: streak?.currentCount ?? 0,
      owned,
      memberships,
    };
  }

  pendingAccessRequests() {
    return this.prisma.accessRequest.findMany({
      where: { status: 'PENDING', subject: { deletedAt: null } },
      include: {
        user: { select: USER_SUMMARY },
        subject: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  pendingChanges() {
    return this.prisma.changeRequest.findMany({
      where: { status: 'PENDING', subject: { deletedAt: null } },
      select: {
        id: true,
        action: true,
        changeNote: true,
        createdAt: true,
        author: { select: USER_SUMMARY },
        subject: {
          select: { id: true, title: true, owner: { select: USER_SUMMARY } },
        },
        node: { select: { id: true, title: true, type: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
