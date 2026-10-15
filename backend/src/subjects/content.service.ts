import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ChangeAction,
  ContentNode,
  NodeType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { sanitizeRich } from '../common/utils/sanitize';
import { AccessService } from './access.service';

export const MAX_REVISIONS = 3;

const CHILD_TYPE: Record<'ROOT' | NodeType, NodeType | null> = {
  ROOT: 'CHAPTER',
  CHAPTER: 'TOPIC',
  TOPIC: 'SUBTOPIC',
  SUBTOPIC: null,
};

export interface ContentFields {
  title?: string;
  summary?: string | null;
  content?: string | null;
}

export interface CreateNodePayload extends ContentFields {
  parentId?: string | null;
  type: NodeType;
  title: string;
}

type Tx = Prisma.TransactionClient;

function cleanFields(fields: ContentFields): ContentFields {
  const out: ContentFields = {};
  if (fields.title !== undefined) out.title = fields.title.trim();
  if (fields.summary !== undefined)
    out.summary = fields.summary?.trim() || null;
  if (fields.content !== undefined) out.content = sanitizeRich(fields.content);
  return out;
}

/** True if applying `fields` would alter title, summary or content. */
function changes(current: ContentFields, fields: ContentFields) {
  return (['title', 'summary', 'content'] as const).some(
    (k) =>
      fields[k] !== undefined && (fields[k] ?? null) !== (current[k] ?? null),
  );
}

function snapshotOf(entity: {
  title: string;
  summary: string | null;
  content: string | null;
}) {
  return {
    title: entity.title,
    summary: entity.summary,
    content: entity.content,
  };
}

@Injectable()
export class ContentService {
  constructor(
    private prisma: PrismaService,
    private access: AccessService,
    private notifications: NotificationsService,
  ) {}

  // ---------------------------------------------------------------- edits

  /**
   * Entry point for every content edit. Owners/admins apply immediately;
   * editors produce a pending ChangeRequest for the owner to approve.
   */
  async submit(
    user: AuthUser,
    subjectId: string,
    nodeId: string | null,
    action: ChangeAction,
    payload: ContentFields | CreateNodePayload,
    changeNote?: string,
  ) {
    const access = await this.access.require(subjectId, user, 'edit');
    const clean =
      action === 'DELETE'
        ? {}
        : action === 'CREATE'
          ? {
              ...cleanFields(payload),
              type: (payload as CreateNodePayload).type,
              parentId: (payload as CreateNodePayload).parentId ?? null,
            }
          : cleanFields(payload);

    await this.validate(subjectId, nodeId, action, clean);

    if (access.canManage) {
      const result = await this.prisma.$transaction((tx) =>
        this.apply(
          tx,
          subjectId,
          nodeId,
          action,
          clean as Record<string, unknown>,
          user.id,
          changeNote,
        ),
      );
      return { applied: true, pending: false, result };
    }

    const change = await this.prisma.changeRequest.create({
      data: {
        subjectId,
        nodeId,
        action,
        payload: clean as Prisma.InputJsonValue,
        changeNote: changeNote?.trim() || null,
        authorId: user.id,
      },
    });
    await this.notifications.notify(access.subject.ownerId, {
      title: 'Change awaiting your approval',
      message: `${user.name} (@${user.username}) proposed a change to "${access.subject.title}".`,
      type: 'change_request',
      link: `/subjects/${subjectId}/manage?tab=changes`,
    });
    return { applied: false, pending: true, changeRequestId: change.id };
  }

  private async validate(
    subjectId: string,
    nodeId: string | null,
    action: ChangeAction,
    payload: ContentFields & { type?: NodeType; parentId?: string | null },
  ) {
    if (payload.title !== undefined && payload.title.length < 1) {
      throw new BadRequestException('Title is required');
    }
    if (action === 'CREATE') {
      const parent = payload.parentId
        ? await this.findNode(subjectId, payload.parentId)
        : null;
      const expected = CHILD_TYPE[parent ? parent.type : 'ROOT'];
      if (!expected) {
        throw new BadRequestException('Subtopics cannot have children');
      }
      if (payload.type !== expected) {
        throw new BadRequestException(
          `A ${parent ? parent.type.toLowerCase() : 'subject'} can only contain ${expected.toLowerCase()}s`,
        );
      }
      return;
    }
    if (nodeId) await this.findNode(subjectId, nodeId);
    else if (action === 'DELETE') {
      throw new BadRequestException('Delete the subject from its settings');
    }
  }

  async findNode(subjectId: string, nodeId: string, includeDeleted = false) {
    const node = await this.prisma.contentNode.findFirst({
      where: {
        id: nodeId,
        subjectId,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
    });
    if (!node) throw new NotFoundException('Content not found');
    return node;
  }

  /** Applies a change and records the previous state as a revision. */
  private async apply(
    tx: Tx,
    subjectId: string,
    nodeId: string | null,
    action: ChangeAction,
    payload: Record<string, unknown>,
    actorId: string,
    changeNote?: string | null,
  ) {
    const note = changeNote?.trim() || null;

    if (action === 'CREATE') {
      const p = payload as unknown as CreateNodePayload;
      const siblings = await tx.contentNode.count({
        where: { subjectId, parentId: p.parentId ?? null, deletedAt: null },
      });
      const node = await tx.contentNode.create({
        data: {
          subjectId,
          parentId: p.parentId ?? null,
          type: p.type,
          title: p.title,
          summary: p.summary ?? null,
          content: p.content ?? null,
          hasContent: !!p.content,
          order: siblings,
        },
      });
      await this.record(tx, subjectId, node.id, 'CREATE', {}, actorId, note);
      return node;
    }

    if (action === 'DELETE') {
      const node = await tx.contentNode.findFirstOrThrow({
        where: { id: nodeId!, subjectId, deletedAt: null },
      });
      const deletedAt = new Date();
      const ids = await this.descendantIds(tx, node.id);
      await tx.contentNode.updateMany({
        where: { id: { in: [node.id, ...ids] }, deletedAt: null },
        data: { deletedAt },
      });
      await this.record(
        tx,
        subjectId,
        node.id,
        'DELETE',
        { ...snapshotOf(node), deletedAt: deletedAt.toISOString() },
        actorId,
        note,
      );
      return { id: node.id, deleted: true };
    }

    const fields = payload as ContentFields;
    if (nodeId) {
      const node = await tx.contentNode.findFirstOrThrow({
        where: { id: nodeId, subjectId, deletedAt: null },
      });
      if (!changes(node, fields)) return node;
      await this.record(
        tx,
        subjectId,
        nodeId,
        'UPDATE',
        snapshotOf(node),
        actorId,
        note,
      );
      return tx.contentNode.update({
        where: { id: nodeId },
        data: {
          ...fields,
          ...(fields.content !== undefined
            ? { hasContent: !!fields.content }
            : {}),
          contentUpdatedAt: new Date(),
        },
      });
    }
    const subject = await tx.subject.findUniqueOrThrow({
      where: { id: subjectId },
    });
    if (!changes(subject, fields)) return subject;
    await this.record(
      tx,
      subjectId,
      null,
      'UPDATE',
      snapshotOf(subject),
      actorId,
      note,
    );
    return tx.subject.update({
      where: { id: subjectId },
      data: { ...fields, contentUpdatedAt: new Date() },
    });
  }

  private async record(
    tx: Tx,
    subjectId: string,
    nodeId: string | null,
    action: ChangeAction,
    snapshot: Record<string, unknown>,
    actorId: string,
    changeNote: string | null,
  ) {
    await tx.contentRevision.create({
      data: {
        subjectId,
        nodeId,
        action,
        snapshot: snapshot as Prisma.InputJsonValue,
        changeNote,
        changedById: actorId,
      },
    });
    // Keep only the newest MAX_REVISIONS per entity.
    const stale = await tx.contentRevision.findMany({
      where: { subjectId, nodeId },
      orderBy: { createdAt: 'desc' },
      skip: MAX_REVISIONS,
      select: { id: true },
    });
    if (stale.length) {
      await tx.contentRevision.deleteMany({
        where: { id: { in: stale.map((r) => r.id) } },
      });
    }
  }

  private async descendantIds(tx: Tx, rootId: string): Promise<string[]> {
    const out: string[] = [];
    let frontier = [rootId];
    while (frontier.length) {
      const children = await tx.contentNode.findMany({
        where: { parentId: { in: frontier }, deletedAt: null },
        select: { id: true },
      });
      frontier = children.map((c) => c.id);
      out.push(...frontier);
    }
    return out;
  }

  // ------------------------------------------------------- change requests

  async listChanges(user: AuthUser, subjectId: string, status?: string) {
    const access = await this.access.require(subjectId, user, 'edit');
    const changes = await this.prisma.changeRequest.findMany({
      where: {
        subjectId,
        ...(status ? { status: status as 'PENDING' } : {}),
        ...(access.canManage ? {} : { authorId: user.id }),
      },
      include: {
        author: { select: { id: true, name: true, username: true } },
        reviewedBy: { select: { id: true, name: true, username: true } },
        node: {
          select: {
            id: true,
            title: true,
            type: true,
            summary: true,
            content: true,
            deletedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const subject = access.subject;
    // Attach the current state so the UI can show a before/after diff.
    return changes.map((c) => ({
      ...c,
      current: c.nodeId
        ? c.node
          ? snapshotOf(c.node)
          : null
        : c.action === 'UPDATE'
          ? snapshotOf(subject)
          : null,
    }));
  }

  async reviewChange(
    user: AuthUser,
    changeId: string,
    approve: boolean,
    reviewNote?: string,
  ) {
    const change = await this.prisma.changeRequest.findUnique({
      where: { id: changeId },
    });
    if (!change) throw new NotFoundException('Change request not found');
    const access = await this.access.require(change.subjectId, user, 'manage');
    if (change.status !== 'PENDING') {
      throw new BadRequestException('This change was already reviewed');
    }

    if (approve) {
      if (change.nodeId) {
        const node = await this.prisma.contentNode.findUnique({
          where: { id: change.nodeId },
        });
        if (!node || node.deletedAt) {
          throw new BadRequestException(
            'The content this change targets has been deleted',
          );
        }
      }
      const payload = change.payload as Record<string, unknown>;
      if (change.action === 'CREATE' && payload.parentId) {
        await this.findNode(change.subjectId, payload.parentId as string);
      }
      await this.prisma.$transaction(async (tx) => {
        await this.apply(
          tx,
          change.subjectId,
          change.nodeId,
          change.action,
          payload,
          change.authorId,
          change.changeNote,
        );
        await tx.changeRequest.update({
          where: { id: change.id },
          data: {
            status: 'APPROVED',
            reviewedById: user.id,
            reviewNote: reviewNote?.trim() || null,
            reviewedAt: new Date(),
          },
        });
      });
    } else {
      await this.prisma.changeRequest.update({
        where: { id: change.id },
        data: {
          status: 'REJECTED',
          reviewedById: user.id,
          reviewNote: reviewNote?.trim() || null,
          reviewedAt: new Date(),
        },
      });
    }

    await this.notifications.notify(change.authorId, {
      title: approve ? 'Your change was approved' : 'Your change was rejected',
      message: `Your proposed change to "${access.subject.title}" was ${approve ? 'approved' : 'rejected'}${reviewNote ? `: ${reviewNote}` : '.'}`,
      type: 'review',
      link: `/subjects/${change.subjectId}${change.nodeId ? `?node=${change.nodeId}` : ''}`,
    });
    return { id: change.id, status: approve ? 'APPROVED' : 'REJECTED' };
  }

  // -------------------------------------------------------------- revisions

  async listRevisions(user: AuthUser, subjectId: string, nodeId?: string) {
    await this.access.require(subjectId, user, 'manage');
    return this.prisma.contentRevision.findMany({
      where: {
        subjectId,
        ...(nodeId !== undefined ? { nodeId: nodeId || null } : {}),
      },
      include: {
        changedBy: { select: { id: true, name: true, username: true } },
        node: {
          select: { id: true, title: true, type: true, deletedAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  /**
   * Undo a revision: UPDATE restores the snapshot, DELETE brings the node
   * (and the descendants deleted with it) back, CREATE removes the node again.
   */
  async restoreRevision(user: AuthUser, revisionId: string) {
    const rev = await this.prisma.contentRevision.findUnique({
      where: { id: revisionId },
    });
    if (!rev) throw new NotFoundException('Revision not found');
    await this.access.require(rev.subjectId, user, 'manage');
    const snap = rev.snapshot as Record<string, unknown>;
    const note = `Restored version from ${rev.createdAt.toISOString().slice(0, 16).replace('T', ' ')}`;

    return this.prisma.$transaction(async (tx) => {
      if (rev.action === 'UPDATE') {
        if (rev.nodeId) {
          const node = await tx.contentNode.findUnique({
            where: { id: rev.nodeId },
          });
          if (!node || node.deletedAt) {
            throw new BadRequestException('Restore the deleted item first');
          }
        }
        return this.apply(
          tx,
          rev.subjectId,
          rev.nodeId,
          'UPDATE',
          { title: snap.title, summary: snap.summary, content: snap.content },
          user.id,
          note,
        );
      }

      if (rev.action === 'DELETE') {
        const node = await tx.contentNode.findUnique({
          where: { id: rev.nodeId! },
        });
        if (!node) throw new NotFoundException('Content no longer exists');
        if (!node.deletedAt) throw new BadRequestException('Already restored');
        if (node.parentId) {
          const parent = await tx.contentNode.findUnique({
            where: { id: node.parentId },
          });
          if (parent?.deletedAt) {
            throw new BadRequestException('Restore its parent first');
          }
        }
        await tx.contentNode.updateMany({
          where: { subjectId: rev.subjectId, deletedAt: node.deletedAt },
          data: { deletedAt: null },
        });
        await tx.contentRevision.delete({ where: { id: rev.id } });
        return { id: node.id, restored: true };
      }

      // CREATE -> undo by deleting the created node.
      const node = await tx.contentNode.findUnique({
        where: { id: rev.nodeId! },
      });
      if (!node || node.deletedAt)
        throw new BadRequestException('Already removed');
      return this.apply(
        tx,
        rev.subjectId,
        rev.nodeId,
        'DELETE',
        {},
        user.id,
        note,
      );
    });
  }

  /** Top-level nodes that were deleted and can be restored. */
  async listTrash(user: AuthUser, subjectId: string) {
    await this.access.require(subjectId, user, 'manage');
    return this.prisma.contentRevision.findMany({
      where: {
        subjectId,
        action: 'DELETE',
        node: { deletedAt: { not: null } },
      },
      include: {
        changedBy: { select: { id: true, name: true, username: true } },
        node: { select: { id: true, title: true, type: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // -------------------------------------------------------------- structure

  async reorder(
    user: AuthUser,
    subjectId: string,
    parentId: string | null,
    orderedIds: string[],
  ) {
    await this.access.require(subjectId, user, 'manage');
    const siblings = await this.prisma.contentNode.findMany({
      where: { subjectId, parentId, deletedAt: null },
      select: { id: true },
    });
    const known = new Set(siblings.map((s) => s.id));
    if (
      orderedIds.length !== known.size ||
      orderedIds.some((id) => !known.has(id))
    ) {
      throw new BadRequestException(
        'Order must list every sibling exactly once',
      );
    }
    await this.prisma.$transaction(
      orderedIds.map((id, order) =>
        this.prisma.contentNode.update({ where: { id }, data: { order } }),
      ),
    );
    return { ok: true };
  }

  async setPreview(
    user: AuthUser,
    subjectId: string,
    nodeId: string,
    isPreview: boolean,
  ) {
    const access = await this.access.require(subjectId, user, 'manage');
    if (!access.isAdmin) {
      throw new ForbiddenException('Only admins manage catalog previews');
    }
    await this.findNode(subjectId, nodeId);
    return this.prisma.contentNode.update({
      where: { id: nodeId },
      data: { isPreview },
    });
  }

  // ----------------------------------------------------------------- reads

  /** Ancestors from chapter down to the node itself. */
  async breadcrumb(
    node: Pick<ContentNode, 'id' | 'parentId' | 'title' | 'type'>,
  ) {
    const chain = [{ id: node.id, title: node.title, type: node.type }];
    let parentId = node.parentId;
    while (parentId) {
      const parent = await this.prisma.contentNode.findUnique({
        where: { id: parentId },
        select: { id: true, title: true, type: true, parentId: true },
      });
      if (!parent) break;
      chain.unshift({ id: parent.id, title: parent.title, type: parent.type });
      parentId = parent.parentId;
    }
    return chain;
  }

  /**
   * Is this node visible on a LISTED subject's preview? A node is visible if
   * it or an ancestor is marked as preview.
   */
  async isPreviewVisible(node: ContentNode) {
    let current: Pick<ContentNode, 'isPreview' | 'parentId'> | null = node;
    while (current) {
      if (current.isPreview) return true;
      if (!current.parentId) return false;
      current = await this.prisma.contentNode.findUnique({
        where: { id: current.parentId },
        select: { isPreview: true, parentId: true },
      });
    }
    return false;
  }

  async getNode(user: AuthUser, subjectId: string, nodeId: string) {
    const access = await this.access.require(subjectId, user, 'preview');
    const node = await this.findNode(subjectId, nodeId);
    const locked = access.previewOnly && !(await this.isPreviewVisible(node));
    const children = await this.prisma.contentNode.findMany({
      where: { parentId: node.id, deletedAt: null },
      select: { id: true, title: true, type: true, summary: true, order: true },
      orderBy: { order: 'asc' },
    });
    const [attachments, pendingChanges, taskCount] = locked
      ? [[], 0, 0]
      : await Promise.all([
          this.prisma.attachment.findMany({
            where: { subjectId, nodeId, inline: false },
            include: { uploadedBy: { select: { name: true, username: true } } },
            orderBy: { createdAt: 'desc' },
          }),
          access.canManage
            ? this.prisma.changeRequest.count({
                where: { subjectId, nodeId, status: 'PENDING' },
              })
            : 0,
          this.prisma.task.count({
            where: { nodeId, assigneeId: user.id, deletedAt: null },
          }),
        ]);
    return {
      ...node,
      summary: node.summary,
      content: locked ? null : node.content,
      locked,
      children,
      breadcrumb: await this.breadcrumb(node),
      attachments,
      pendingChanges,
      taskCount,
    };
  }

  /**
   * Builds the outline tree. For preview-only viewers, chapters are listed as
   * locked titles and only preview-marked branches expand.
   */
  async outline(subjectId: string, previewOnly: boolean) {
    const nodes = await this.prisma.contentNode.findMany({
      where: { subjectId, deletedAt: null },
      select: {
        id: true,
        parentId: true,
        type: true,
        title: true,
        order: true,
        isPreview: true,
      },
      orderBy: { order: 'asc' },
    });
    type OutlineNode = (typeof nodes)[number] & {
      locked: boolean;
      children: OutlineNode[];
    };
    const byId = new Map<string, OutlineNode>();
    nodes.forEach((n) => byId.set(n.id, { ...n, locked: false, children: [] }));

    const roots: OutlineNode[] = [];
    for (const n of byId.values()) {
      if (n.parentId && byId.has(n.parentId))
        byId.get(n.parentId)!.children.push(n);
      else if (!n.parentId) roots.push(n);
    }

    if (!previewOnly) return roots;

    // A node is unlocked if it or an ancestor is a preview. Locked chapters
    // still show their title; locked deeper nodes are hidden unless they
    // lead to a preview further down.
    const prune = (
      list: OutlineNode[],
      inheritedPreview: boolean,
    ): OutlineNode[] =>
      list.flatMap((n) => {
        const open = inheritedPreview || n.isPreview;
        const kids = prune(n.children, open);
        if (open) return [{ ...n, children: kids }];
        if (n.type === 'CHAPTER' || kids.length) {
          return [{ ...n, locked: true, children: kids }];
        }
        return [];
      });
    return prune(roots, false);
  }
}
