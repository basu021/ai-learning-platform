import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { MemberRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { sanitizeRich } from '../common/utils/sanitize';
import { AccessService } from './access.service';
import { ContentService } from './content.service';
import { ProgressService } from './progress.service';
import {
  CreateSubjectDto,
  ListSubjectsQuery,
  UpdateSettingsDto,
} from './dto/subject.dto';

const USER_SUMMARY = { id: true, name: true, username: true } as const;

function normalizeTags(tags?: string | null) {
  if (tags == null) return null;
  const list = [
    ...new Set(
      tags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  return list.length ? list.join(',').slice(0, 500) : null;
}

@Injectable()
export class SubjectsService {
  constructor(
    private prisma: PrismaService,
    private access: AccessService,
    private content: ContentService,
    private notifications: NotificationsService,
    private progress: ProgressService,
  ) {}

  // ------------------------------------------------------------- library

  async list(user: AuthUser, q: ListSubjectsQuery) {
    const isAdmin = user.role === 'ADMIN';
    const scope = q.scope ?? 'library';
    const catalog: Prisma.SubjectWhereInput = {
      status: 'PUBLISHED',
      visibility: { in: ['PUBLIC', 'LISTED'] },
    };
    const mine: Prisma.SubjectWhereInput = { ownerId: user.id };
    const shared: Prisma.SubjectWhereInput = {
      members: { some: { userId: user.id } },
    };

    let scopeWhere: Prisma.SubjectWhereInput;
    switch (scope) {
      case 'mine':
        scopeWhere = mine;
        break;
      case 'shared':
        scopeWhere = shared;
        break;
      case 'catalog':
        scopeWhere = catalog;
        break;
      case 'all':
        if (!isAdmin) throw new ForbiddenException();
        scopeWhere = {};
        break;
      default:
        scopeWhere = { OR: [mine, shared, catalog] };
    }

    const filters: Prisma.SubjectWhereInput[] = [
      { deletedAt: null },
      scopeWhere,
    ];
    if (q.q) {
      filters.push({
        OR: [
          { title: { contains: q.q } },
          { summary: { contains: q.q } },
          { tags: { contains: q.q.toLowerCase() } },
        ],
      });
    }
    if (q.categoryId) filters.push({ categoryId: q.categoryId });
    if (q.visibility) filters.push({ visibility: q.visibility });
    if (q.status) filters.push({ status: q.status });
    if (q.tag) filters.push({ tags: { contains: q.tag.toLowerCase() } });
    if (q.ownerId && isAdmin) filters.push({ ownerId: q.ownerId });

    const subjects = await this.prisma.subject.findMany({
      where: { AND: filters },
      select: {
        id: true,
        title: true,
        summary: true,
        visibility: true,
        status: true,
        tags: true,
        color: true,
        ownerId: true,
        updatedAt: true,
        createdAt: true,
        owner: { select: USER_SUMMARY },
        category: { select: { id: true, name: true } },
        members: { where: { userId: user.id }, select: { role: true } },
        _count: {
          select: {
            nodes: { where: { type: 'CHAPTER', deletedAt: null } },
            members: true,
            changeRequests: { where: { status: 'PENDING' } },
            accessRequests: { where: { status: 'PENDING' } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });

    const pendingRequests = await this.prisma.accessRequest.findMany({
      where: {
        userId: user.id,
        status: 'PENDING',
        subjectId: { in: subjects.map((s) => s.id) },
      },
      select: { subjectId: true },
    });
    const requested = new Set(pendingRequests.map((r) => r.subjectId));

    const items = subjects.map(({ members, _count, ...s }) => {
      const isOwner = s.ownerId === user.id;
      const memberRole = members[0]?.role ?? null;
      const canManage = isAdmin || isOwner;
      const hasAccess =
        canManage ||
        !!memberRole ||
        (s.visibility === 'PUBLIC' && s.status === 'PUBLISHED');
      return {
        ...s,
        chapterCount: _count.nodes,
        memberCount: _count.members,
        pendingChanges: canManage ? _count.changeRequests : 0,
        pendingAccessRequests: canManage ? _count.accessRequests : 0,
        access: {
          isOwner,
          memberRole,
          canManage,
          hasAccess,
          accessRequested: requested.has(s.id),
        },
      };
    });

    // Reading progress only where the user can actually read the content.
    const progress = await this.progress.summaries(
      user.id,
      items.filter((i) => i.access.hasAccess).map((i) => i.id),
    );
    return items.map((i) => ({ ...i, progress: progress[i.id] ?? null }));
  }

  async create(user: AuthUser, dto: CreateSubjectDto) {
    const isAdmin = user.role === 'ADMIN';
    if (!isAdmin && dto.visibility && dto.visibility !== 'PRIVATE') {
      throw new ForbiddenException(
        'Only admins can publish subjects to the catalog',
      );
    }
    if (dto.categoryId) await this.requireCategory(dto.categoryId);
    return this.prisma.subject.create({
      data: {
        ownerId: user.id,
        title: dto.title.trim(),
        summary: dto.summary?.trim() || null,
        content: sanitizeRich(dto.content),
        visibility: isAdmin ? (dto.visibility ?? 'PRIVATE') : 'PRIVATE',
        // Personal subjects have no catalog workflow, so they're live immediately.
        status: isAdmin ? (dto.status ?? 'DRAFT') : 'PUBLISHED',
        categoryId: dto.categoryId || null,
        tags: normalizeTags(dto.tags),
        color: dto.color,
      },
    });
  }

  async get(user: AuthUser, id: string) {
    const access = await this.access.require(id, user, 'preview');
    const s = access.subject;
    const [owner, category, outline, attachments, counts, myRequest] =
      await Promise.all([
        this.prisma.user.findUnique({
          where: { id: s.ownerId },
          select: USER_SUMMARY,
        }),
        s.categoryId
          ? this.prisma.category.findUnique({ where: { id: s.categoryId } })
          : null,
        this.content.outline(id, access.previewOnly),
        access.canView
          ? this.prisma.attachment.findMany({
              where: { subjectId: id, nodeId: null, inline: false },
              include: {
                uploadedBy: { select: { name: true, username: true } },
              },
              orderBy: { createdAt: 'desc' },
            })
          : [],
        access.canManage
          ? Promise.all([
              this.prisma.changeRequest.count({
                where: { subjectId: id, status: 'PENDING' },
              }),
              this.prisma.accessRequest.count({
                where: { subjectId: id, status: 'PENDING' },
              }),
              this.prisma.subjectMember.count({ where: { subjectId: id } }),
            ])
          : [0, 0, 0],
        access.canRequestAccess
          ? this.prisma.accessRequest.findFirst({
              where: { subjectId: id, userId: user.id },
              orderBy: { createdAt: 'desc' },
              select: { status: true, createdAt: true },
            })
          : null,
      ]);
    return {
      ...s,
      owner,
      category,
      outline,
      attachments,
      pendingChanges: counts[0],
      pendingAccessRequests: counts[1],
      memberCount: counts[2],
      access: {
        isOwner: access.isOwner,
        isAdmin: access.isAdmin,
        memberRole: access.member?.role ?? null,
        canView: access.canView,
        previewOnly: access.previewOnly,
        canEdit: access.canEdit,
        canManage: access.canManage,
        canRequestAccess: access.canRequestAccess,
        editsNeedApproval: access.canEdit && !access.canManage,
        lastRequest: myRequest,
      },
    };
  }

  async updateSettings(user: AuthUser, id: string, dto: UpdateSettingsDto) {
    const access = await this.access.require(id, user, 'manage');
    const data: Prisma.SubjectUpdateInput = {};
    if (dto.visibility !== undefined || dto.status !== undefined) {
      if (!access.isAdmin) {
        throw new ForbiddenException('Personal subjects are always private');
      }
      if (dto.visibility) data.visibility = dto.visibility;
      if (dto.status) data.status = dto.status;
    }
    if (dto.categoryId !== undefined) {
      if (dto.categoryId) await this.requireCategory(dto.categoryId);
      data.category = dto.categoryId
        ? { connect: { id: dto.categoryId } }
        : { disconnect: true };
    }
    if (dto.tags !== undefined) data.tags = normalizeTags(dto.tags);
    if (dto.color !== undefined) data.color = dto.color;
    return this.prisma.subject.update({ where: { id }, data });
  }

  async remove(user: AuthUser, id: string) {
    await this.access.require(id, user, 'manage');
    await this.prisma.$transaction([
      this.prisma.subject.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
      this.prisma.task.updateMany({
        where: { subjectId: id },
        data: { active: false },
      }),
    ]);
    return { ok: true };
  }

  // ------------------------------------------------------------- sharing

  async listMembers(user: AuthUser, id: string) {
    await this.access.require(id, user, 'view');
    return this.prisma.subjectMember.findMany({
      where: { subjectId: id },
      include: {
        user: { select: USER_SUMMARY },
        grantedBy: { select: USER_SUMMARY },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Share by usernames (users) or assign (admins) — same mechanism. */
  async addMembers(
    user: AuthUser,
    id: string,
    usernames: string[],
    role: MemberRole,
  ) {
    const access = await this.access.require(id, user, 'manage');
    const names = [
      ...new Set(
        usernames.map((u) => u.trim().toLowerCase().replace(/^@/, '')),
      ),
    ].filter(Boolean);
    if (!names.length)
      throw new BadRequestException('Enter at least one username');
    const users = await this.prisma.user.findMany({
      where: { username: { in: names }, deletedAt: null },
      select: { id: true, username: true },
    });
    const missing = names.filter((n) => !users.some((u) => u.username === n));
    if (missing.length) {
      throw new NotFoundException(
        `Unknown username: ${missing.map((m) => '@' + m).join(', ')}`,
      );
    }
    const targets = users.filter((u) => u.id !== access.subject.ownerId);
    for (const t of targets) {
      await this.prisma.subjectMember.upsert({
        where: { subjectId_userId: { subjectId: id, userId: t.id } },
        create: { subjectId: id, userId: t.id, role, grantedById: user.id },
        update: { role },
      });
      await this.prisma.accessRequest.updateMany({
        where: { subjectId: id, userId: t.id, status: 'PENDING' },
        data: {
          status: 'APPROVED',
          decidedById: user.id,
          decidedAt: new Date(),
        },
      });
    }
    await this.notifications.notify(
      targets.map((t) => t.id),
      {
        title:
          access.isAdmin && !access.isOwner
            ? 'Subject assigned to you'
            : 'Subject shared with you',
        message: `${user.name} (@${user.username}) gave you ${role === 'EDITOR' ? 'edit' : 'view'} access to "${access.subject.title}".`,
        type: 'share',
        link: `/subjects/${id}`,
      },
    );
    return this.listMembers(user, id);
  }

  async updateMember(
    user: AuthUser,
    id: string,
    userId: string,
    role: MemberRole,
  ) {
    await this.access.require(id, user, 'manage');
    await this.prisma.subjectMember.update({
      where: { subjectId_userId: { subjectId: id, userId } },
      data: { role },
    });
    return this.listMembers(user, id);
  }

  async removeMember(user: AuthUser, id: string, userId: string) {
    const access = await this.access.require(id, user, 'view');
    // Members may leave on their own; otherwise managers only.
    if (userId !== user.id && !access.canManage) throw new ForbiddenException();
    await this.prisma.subjectMember.deleteMany({
      where: { subjectId: id, userId },
    });
    return { ok: true };
  }

  // ------------------------------------------------------ access requests

  async requestAccess(user: AuthUser, id: string, message?: string) {
    const access = await this.access.require(id, user, 'preview');
    if (!access.canRequestAccess) {
      throw new BadRequestException('You already have access to this subject');
    }
    const pending = await this.prisma.accessRequest.findFirst({
      where: { subjectId: id, userId: user.id, status: 'PENDING' },
    });
    if (pending) throw new ConflictException('Your request is already pending');
    const req = await this.prisma.accessRequest.create({
      data: {
        subjectId: id,
        userId: user.id,
        message: message?.trim() || null,
      },
    });
    const note = {
      title: 'Access request',
      message: `${user.name} (@${user.username}) requested access to "${access.subject.title}".`,
      type: 'access_request',
      link: `/subjects/${id}/manage?tab=requests`,
    };
    await this.notifications.notify(access.subject.ownerId, note);
    await this.notifications.notifyAdmins(note, access.subject.ownerId);
    return req;
  }

  async listAccessRequests(user: AuthUser, id: string, status?: string) {
    await this.access.require(id, user, 'manage');
    return this.prisma.accessRequest.findMany({
      where: {
        subjectId: id,
        ...(status ? { status: status as 'PENDING' } : {}),
      },
      include: {
        user: { select: USER_SUMMARY },
        decidedBy: { select: USER_SUMMARY },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async decideAccessRequest(
    user: AuthUser,
    requestId: string,
    approve: boolean,
  ) {
    const req = await this.prisma.accessRequest.findUnique({
      where: { id: requestId },
    });
    if (!req) throw new NotFoundException('Request not found');
    const access = await this.access.require(req.subjectId, user, 'manage');
    if (req.status !== 'PENDING')
      throw new BadRequestException('Already decided');
    await this.prisma.$transaction(async (tx) => {
      await tx.accessRequest.update({
        where: { id: requestId },
        data: {
          status: approve ? 'APPROVED' : 'REJECTED',
          decidedById: user.id,
          decidedAt: new Date(),
        },
      });
      if (approve) {
        await tx.subjectMember.upsert({
          where: {
            subjectId_userId: { subjectId: req.subjectId, userId: req.userId },
          },
          create: {
            subjectId: req.subjectId,
            userId: req.userId,
            role: 'VIEWER',
            grantedById: user.id,
          },
          update: {},
        });
      }
    });
    await this.notifications.notify(req.userId, {
      title: approve ? 'Access granted' : 'Access request declined',
      message: `Your request for "${access.subject.title}" was ${approve ? 'approved' : 'declined'}.`,
      type: 'review',
      link: `/subjects/${req.subjectId}`,
    });
    return { id: requestId, status: approve ? 'APPROVED' : 'REJECTED' };
  }

  // ----------------------------------------------------------- categories

  listCategories() {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { subjects: { where: { deletedAt: null } } } },
      },
    });
  }

  async createCategory(name: string, description?: string) {
    const clean = name.trim();
    if (!clean) throw new BadRequestException('Name is required');
    const exists = await this.prisma.category.findUnique({
      where: { name: clean },
    });
    if (exists) throw new ConflictException('Category already exists');
    return this.prisma.category.create({
      data: { name: clean, description: description?.trim() || null },
    });
  }

  async deleteCategory(id: string) {
    await this.prisma.category.delete({ where: { id } });
    return { ok: true };
  }

  private async requireCategory(id: string) {
    const c = await this.prisma.category.findUnique({ where: { id } });
    if (!c) throw new BadRequestException('Unknown category');
  }
}
