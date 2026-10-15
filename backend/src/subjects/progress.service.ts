import { Injectable } from '@nestjs/common';
import type { ReadProgress, StudyEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { todayDate } from '../common/utils/dates';
import { AccessService } from './access.service';
import { ContentService } from './content.service';

/** Reading state of one item for one user. */
export type ItemState = 'unread' | 'opened' | 'done' | 'outdated';
/** Combined state of an item and everything beneath it. */
export type RollupState = 'none' | 'progress' | 'done' | 'outdated';

export interface Rollup {
  total: number;
  done: number;
  outdated: number;
  percent: number;
  state: RollupState;
}

export interface NodeProgress extends Rollup {
  /** null when the item is only a container (no content of its own, has children). */
  own: ItemState | null;
  completedAt: Date | null;
  timeSpentSec: number;
}

export interface SubjectProgress extends Rollup {
  overview: ItemState | null;
  overviewCompletedAt: Date | null;
  nodes: Record<string, NodeProgress>;
}

interface TreeNode {
  id: string;
  parentId: string | null;
  hasContent: boolean;
  contentUpdatedAt: Date;
}

const MAX_HEARTBEAT_SEC = 120;

function itemState(p: ReadProgress | undefined, updatedAt: Date): ItemState {
  if (p?.completedAt) return p.completedAt >= updatedAt ? 'done' : 'outdated';
  return p?.firstOpenedAt ? 'opened' : 'unread';
}

function finish(
  total: number,
  done: number,
  outdated: number,
  touched: boolean,
): Rollup {
  const state: RollupState =
    total > 0 && done === total
      ? 'done'
      : total > 0 && done + outdated === total
        ? 'outdated'
        : touched || done + outdated > 0
          ? 'progress'
          : 'none';
  return {
    total,
    done,
    outdated,
    percent: total ? Math.round((done / total) * 100) : 0,
    state,
  };
}

/**
 * Readable units are the subject overview (when it has content) and every
 * node that has content or is a leaf. Containers without content of their
 * own are complete when everything inside them is.
 */
export function computeProgress(
  subject: { id: string; hasOverview: boolean; contentUpdatedAt: Date },
  nodes: TreeNode[],
  rows: ReadProgress[],
): SubjectProgress {
  const byKey = new Map(rows.map((r) => [r.scopeKey, r]));
  const children = new Map<string | null, TreeNode[]>();
  nodes.forEach((n) =>
    children.set(n.parentId, [...(children.get(n.parentId) ?? []), n]),
  );

  const out: Record<string, NodeProgress> = {};
  const visit = (
    n: TreeNode,
  ): { total: number; done: number; outdated: number; touched: boolean } => {
    const kids = children.get(n.id) ?? [];
    const isUnit = n.hasContent || kids.length === 0;
    const row = byKey.get(n.id);
    const own = isUnit ? itemState(row, n.contentUpdatedAt) : null;
    let total = isUnit ? 1 : 0;
    let done = own === 'done' ? 1 : 0;
    let outdated = own === 'outdated' ? 1 : 0;
    let touched = own === 'opened';
    for (const k of kids) {
      const r = visit(k);
      total += r.total;
      done += r.done;
      outdated += r.outdated;
      touched ||= r.touched;
    }
    out[n.id] = {
      ...finish(total, done, outdated, touched),
      own,
      completedAt: row?.completedAt ?? null,
      timeSpentSec: row?.timeSpentSec ?? 0,
    };
    return { total, done, outdated, touched };
  };

  const overviewRow = byKey.get(subject.id);
  const overview = subject.hasOverview
    ? itemState(overviewRow, subject.contentUpdatedAt)
    : null;
  let total = overview ? 1 : 0;
  let done = overview === 'done' ? 1 : 0;
  let outdated = overview === 'outdated' ? 1 : 0;
  let touched = overview === 'opened';
  for (const root of children.get(null) ?? []) {
    const r = visit(root);
    total += r.total;
    done += r.done;
    outdated += r.outdated;
    touched ||= r.touched;
  }
  return {
    ...finish(total, done, outdated, touched),
    overview,
    overviewCompletedAt: overviewRow?.completedAt ?? null,
    nodes: out,
  };
}

@Injectable()
export class ProgressService {
  constructor(
    private prisma: PrismaService,
    private access: AccessService,
    private content: ContentService,
  ) {}

  private async loadTrees(subjectIds: string[]) {
    if (!subjectIds.length) return { subjects: [], nodes: [] };
    const [subjects, nodes] = await Promise.all([
      this.prisma.subject.findMany({
        where: { id: { in: subjectIds } },
        select: { id: true, content: true, contentUpdatedAt: true },
      }),
      this.prisma.contentNode.findMany({
        where: { subjectId: { in: subjectIds }, deletedAt: null },
        select: {
          id: true,
          subjectId: true,
          parentId: true,
          hasContent: true,
          contentUpdatedAt: true,
        },
      }),
    ]);
    return { subjects, nodes };
  }

  async forUser(userId: string, subjectId: string): Promise<SubjectProgress> {
    const [{ subjects, nodes }, rows] = await Promise.all([
      this.loadTrees([subjectId]),
      this.prisma.readProgress.findMany({ where: { userId, subjectId } }),
    ]);
    const s = subjects[0];
    return computeProgress(
      {
        id: subjectId,
        hasOverview: !!s?.content,
        contentUpdatedAt: s?.contentUpdatedAt ?? new Date(0),
      },
      nodes,
      rows,
    );
  }

  /** Progress for the viewer; null when they only see a preview. */
  async get(user: AuthUser, subjectId: string) {
    const access = await this.access.require(subjectId, user, 'preview');
    if (!access.canView) return null;
    return this.forUser(user.id, subjectId);
  }

  /** Lightweight per-subject totals (no per-node map) for lists. */
  async summaries(userId: string, subjectIds: string[]) {
    const ids = [...new Set(subjectIds)];
    const [{ subjects, nodes }, rows] = await Promise.all([
      this.loadTrees(ids),
      this.prisma.readProgress.findMany({
        where: { userId, subjectId: { in: ids } },
      }),
    ]);
    const result: Record<string, Rollup & { lastOpenedAt: Date | null }> = {};
    for (const s of subjects) {
      const mine = rows.filter((r) => r.subjectId === s.id);
      const full = computeProgress(
        {
          id: s.id,
          hasOverview: !!s.content,
          contentUpdatedAt: s.contentUpdatedAt,
        },
        nodes.filter((n) => n.subjectId === s.id),
        mine,
      );
      const last = mine.reduce<Date | null>(
        (acc, r) =>
          r.lastOpenedAt && (!acc || r.lastOpenedAt > acc)
            ? r.lastOpenedAt
            : acc,
        null,
      );
      result[s.id] = {
        total: full.total,
        done: full.done,
        outdated: full.outdated,
        percent: full.percent,
        state: full.state,
        lastOpenedAt: last,
      };
    }
    return result;
  }

  /** Subjects the user has started reading, most recent first. */
  async recent(userId: string, limit = 6) {
    const rows = await this.prisma.readProgress.groupBy({
      by: ['subjectId'],
      where: { userId, lastOpenedAt: { not: null } },
      _max: { lastOpenedAt: true },
      orderBy: { _max: { lastOpenedAt: 'desc' } },
      take: limit * 2,
    });
    const live = await this.prisma.subject.findMany({
      where: { id: { in: rows.map((r) => r.subjectId) }, deletedAt: null },
      select: { id: true, title: true, color: true },
    });
    const ids = rows
      .map((r) => r.subjectId)
      .filter((id) => live.some((s) => s.id === id))
      .slice(0, limit);
    const sums = await this.summaries(userId, ids);
    return ids.map((id) => ({
      ...live.find((s) => s.id === id)!,
      ...sums[id],
    }));
  }

  // --------------------------------------------------------------- writes

  private async target(
    user: AuthUser,
    subjectId: string,
    nodeId: string | null,
  ) {
    await this.access.require(subjectId, user, 'view');
    if (nodeId) await this.content.findNode(subjectId, nodeId);
    return { scopeKey: nodeId ?? subjectId };
  }

  private event(
    userId: string,
    subjectId: string,
    nodeId: string | null,
    type: StudyEventType,
  ) {
    return this.prisma.studyEvent.create({
      data: { userId, subjectId, nodeId, type },
    });
  }

  /** Called while an item is on screen; accumulates reading time. */
  async heartbeat(
    user: AuthUser,
    subjectId: string,
    nodeId: string | null,
    seconds: number,
    opened: boolean,
  ) {
    const { scopeKey } = await this.target(user, subjectId, nodeId);
    const secs = Math.max(
      0,
      Math.min(MAX_HEARTBEAT_SEC, Math.round(seconds || 0)),
    );
    const now = new Date();
    const existing = await this.prisma.readProgress.findUnique({
      where: { userId_scopeKey: { userId: user.id, scopeKey } },
    });
    await this.prisma.readProgress.upsert({
      where: { userId_scopeKey: { userId: user.id, scopeKey } },
      create: {
        userId: user.id,
        subjectId,
        nodeId,
        scopeKey,
        firstOpenedAt: now,
        lastOpenedAt: now,
        timeSpentSec: secs,
      },
      update: {
        lastOpenedAt: now,
        timeSpentSec: { increment: secs },
        ...(existing?.firstOpenedAt ? {} : { firstOpenedAt: now }),
      },
    });
    if (secs > 0) {
      const day = todayDate();
      await this.prisma.studyTime.upsert({
        where: { userId_scopeKey_day: { userId: user.id, scopeKey, day } },
        create: {
          userId: user.id,
          subjectId,
          nodeId,
          scopeKey,
          day,
          seconds: secs,
        },
        update: { seconds: { increment: secs } },
      });
    }
    if (opened) await this.event(user.id, subjectId, nodeId, 'OPEN');
    return { ok: true };
  }

  async setComplete(
    user: AuthUser,
    subjectId: string,
    nodeId: string | null,
    complete: boolean,
  ) {
    const { scopeKey } = await this.target(user, subjectId, nodeId);
    const now = new Date();
    await this.prisma.readProgress.upsert({
      where: { userId_scopeKey: { userId: user.id, scopeKey } },
      create: {
        userId: user.id,
        subjectId,
        nodeId,
        scopeKey,
        firstOpenedAt: now,
        lastOpenedAt: now,
        completedAt: complete ? now : null,
      },
      update: { completedAt: complete ? now : null },
    });
    await this.event(
      user.id,
      subjectId,
      nodeId,
      complete ? 'COMPLETE' : 'UNCOMPLETE',
    );
    return this.forUser(user.id, subjectId);
  }

  /** Start over: clears read marks for the item and everything under it (whole subject when nodeId is null). */
  async reset(user: AuthUser, subjectId: string, nodeId: string | null) {
    await this.target(user, subjectId, nodeId);
    let keys: string[];
    if (nodeId) {
      const all = await this.prisma.contentNode.findMany({
        where: { subjectId, deletedAt: null },
        select: { id: true, parentId: true },
      });
      keys = [nodeId];
      for (let i = 0; i < keys.length; i++) {
        all
          .filter((n) => n.parentId === keys[i])
          .forEach((n) => keys.push(n.id));
      }
    } else {
      keys = [subjectId];
      const all = await this.prisma.contentNode.findMany({
        where: { subjectId },
        select: { id: true },
      });
      keys.push(...all.map((n) => n.id));
    }
    // Time spent is kept for analytics; firstOpenedAt restarts the attempt.
    await this.prisma.readProgress.updateMany({
      where: { userId: user.id, scopeKey: { in: keys } },
      data: { completedAt: null, firstOpenedAt: null },
    });
    await this.event(user.id, subjectId, nodeId, 'RESET');
    return this.forUser(user.id, subjectId);
  }
}
