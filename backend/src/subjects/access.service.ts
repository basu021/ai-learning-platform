import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Subject, SubjectMember } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';

export interface SubjectAccess {
  subject: Subject;
  isAdmin: boolean;
  isOwner: boolean;
  member: SubjectMember | null;
  /** Full read access to all content. */
  canView: boolean;
  /** Only the marketing preview of a LISTED subject. */
  previewOnly: boolean;
  /** May propose edits (applied directly when canManage, else queued for approval). */
  canEdit: boolean;
  /** Owner or admin: settings, sharing, approvals, restores. */
  canManage: boolean;
  /** Can ask for access (LISTED, published, no access yet). */
  canRequestAccess: boolean;
}

export type AccessLevel = 'preview' | 'view' | 'edit' | 'manage';

@Injectable()
export class AccessService {
  constructor(private prisma: PrismaService) {}

  async resolve(subjectId: string, user: AuthUser): Promise<SubjectAccess> {
    const subject = await this.prisma.subject.findFirst({
      where: { id: subjectId, deletedAt: null },
    });
    if (!subject) throw new NotFoundException('Subject not found');
    const member = await this.prisma.subjectMember.findUnique({
      where: { subjectId_userId: { subjectId, userId: user.id } },
    });
    return this.compute(subject, user, member);
  }

  compute(
    subject: Subject,
    user: AuthUser,
    member: SubjectMember | null,
  ): SubjectAccess {
    const isAdmin = user.role === 'ADMIN';
    const isOwner = subject.ownerId === user.id;
    const canManage = isAdmin || isOwner;
    const published = subject.status === 'PUBLISHED';
    const canView =
      canManage || !!member || (subject.visibility === 'PUBLIC' && published);
    const listed = subject.visibility === 'LISTED' && published;
    return {
      subject,
      isAdmin,
      isOwner,
      member,
      canView,
      previewOnly: !canView && listed,
      canEdit: canManage || member?.role === 'EDITOR',
      canManage,
      canRequestAccess: !canView && listed,
    };
  }

  async require(
    subjectId: string,
    user: AuthUser,
    level: AccessLevel,
  ): Promise<SubjectAccess> {
    const access = await this.resolve(subjectId, user);
    const ok =
      level === 'preview'
        ? access.canView || access.previewOnly
        : level === 'view'
          ? access.canView
          : level === 'edit'
            ? access.canEdit
            : access.canManage;
    if (!ok) {
      // Don't reveal that a private subject exists.
      if (!access.canView && !access.previewOnly) {
        throw new NotFoundException('Subject not found');
      }
      throw new ForbiddenException(
        level === 'view'
          ? 'You need access to this subject'
          : 'You do not have permission to do that',
      );
    }
    return access;
  }

  /** Grants view access if the user doesn't already have it (used when assigning tasks). */
  async ensureViewer(subjectId: string, userId: string, grantedById: string) {
    const subject = await this.prisma.subject.findUniqueOrThrow({
      where: { id: subjectId },
    });
    if (subject.ownerId === userId) return false;
    const existing = await this.prisma.subjectMember.findUnique({
      where: { subjectId_userId: { subjectId, userId } },
    });
    if (existing) return false;
    await this.prisma.subjectMember.create({
      data: { subjectId, userId, role: 'VIEWER', grantedById },
    });
    return true;
  }
}
