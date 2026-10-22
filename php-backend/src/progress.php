<?php
declare(strict_types=1);

/**
 * Reading progress. Readable units are the subject overview (when it has
 * content) and every node that has content or is a leaf. Containers without
 * content of their own are complete when everything inside them is.
 */
final class Progress
{
    private const MAX_HEARTBEAT_SEC = 120;

    private static function itemState(?array $p, string $updatedAt): string
    {
        if ($p && $p['completedAt']) return $p['completedAt'] >= $updatedAt ? 'done' : 'outdated';
        return ($p['firstOpenedAt'] ?? null) ? 'opened' : 'unread';
    }

    private static function finish(int $total, int $done, int $outdated, bool $touched): array
    {
        $state = $total > 0 && $done === $total ? 'done'
            : ($total > 0 && $done + $outdated === $total ? 'outdated'
            : ($touched || $done + $outdated > 0 ? 'progress' : 'none'));
        return [
            'total' => $total,
            'done' => $done,
            'outdated' => $outdated,
            'percent' => $total ? js_round($done / $total * 100) : 0,
            'state' => $state,
        ];
    }

    /**
     * @param array{id: string, hasOverview: bool, contentUpdatedAt: string} $subject
     * @param array[] $nodes id, parentId, hasContent, contentUpdatedAt
     * @param array[] $rows read_progress rows
     */
    public static function compute(array $subject, array $nodes, array $rows): array
    {
        $byKey = index_by($rows, 'scopeKey');
        $children = [];
        foreach ($nodes as $n) $children[$n['parentId'] ?? ''][] = $n;

        $out = [];
        $visit = function (array $n) use (&$visit, &$out, $children, $byKey): array {
            $kids = $children[$n['id']] ?? [];
            $isUnit = $n['hasContent'] || !$kids;
            $row = $byKey[$n['id']] ?? null;
            $own = $isUnit ? self::itemState($row, $n['contentUpdatedAt']) : null;
            $total = $isUnit ? 1 : 0;
            $done = $own === 'done' ? 1 : 0;
            $outdated = $own === 'outdated' ? 1 : 0;
            $touched = $own === 'opened';
            foreach ($kids as $k) {
                $r = $visit($k);
                $total += $r[0];
                $done += $r[1];
                $outdated += $r[2];
                $touched = $touched || $r[3];
            }
            $out[$n['id']] = [
                ...self::finish($total, $done, $outdated, $touched),
                'own' => $own,
                'completedAt' => $row['completedAt'] ?? null,
                'timeSpentSec' => $row['timeSpentSec'] ?? 0,
            ];
            return [$total, $done, $outdated, $touched];
        };

        $overviewRow = $byKey[$subject['id']] ?? null;
        $overview = $subject['hasOverview'] ? self::itemState($overviewRow, $subject['contentUpdatedAt']) : null;
        $total = $overview ? 1 : 0;
        $done = $overview === 'done' ? 1 : 0;
        $outdated = $overview === 'outdated' ? 1 : 0;
        $touched = $overview === 'opened';
        foreach ($children[''] ?? [] as $root) {
            $r = $visit($root);
            $total += $r[0];
            $done += $r[1];
            $outdated += $r[2];
            $touched = $touched || $r[3];
        }
        return [
            ...self::finish($total, $done, $outdated, $touched),
            'overview' => $overview,
            'overviewCompletedAt' => $overviewRow['completedAt'] ?? null,
            'nodes' => obj($out),
        ];
    }

    private static function loadTrees(array $subjectIds): array
    {
        if (!$subjectIds) return [[], []];
        $subjects = Db::rows(
            'subjects',
            'SELECT id, content IS NOT NULL AND content <> \'\' AS has_overview, content_updated_at FROM subjects WHERE id IN (' . marks($subjectIds) . ')',
            $subjectIds,
        );
        $nodes = Db::rows(
            'content_nodes',
            'SELECT id, subject_id, parent_id, has_content, content_updated_at FROM content_nodes WHERE subject_id IN (' . marks($subjectIds) . ') AND deleted_at IS NULL',
            $subjectIds,
        );
        return [$subjects, $nodes];
    }

    public static function forUser(string $userId, string $subjectId): array
    {
        [$subjects, $nodes] = self::loadTrees([$subjectId]);
        $rows = Db::rows('read_progress', 'SELECT * FROM read_progress WHERE user_id = ? AND subject_id = ?', [$userId, $subjectId]);
        $s = $subjects[0] ?? null;
        return self::compute([
            'id' => $subjectId,
            'hasOverview' => (bool) ($s['hasOverview'] ?? false),
            'contentUpdatedAt' => $s['contentUpdatedAt'] ?? iso('1970-01-01 00:00:00.000'),
        ], $nodes, $rows);
    }

    /** Progress for the viewer; null when they only see a preview. */
    public static function get(array $user, string $subjectId): ?array
    {
        $access = Access::require($subjectId, $user, 'preview');
        return $access['canView'] ? self::forUser($user['id'], $subjectId) : null;
    }

    /** Lightweight per-subject totals (no per-node map) for lists. */
    public static function summaries(string $userId, array $subjectIds): array|stdClass
    {
        $ids = array_values(array_unique($subjectIds));
        [$subjects, $nodes] = self::loadTrees($ids);
        $rows = $ids ? Db::rows('read_progress', 'SELECT * FROM read_progress WHERE user_id = ? AND subject_id IN (' . marks($ids) . ')', [$userId, ...$ids]) : [];
        $nodesBy = [];
        foreach ($nodes as $n) $nodesBy[$n['subjectId']][] = $n;
        $rowsBy = [];
        foreach ($rows as $r) $rowsBy[$r['subjectId']][] = $r;

        $result = [];
        foreach ($subjects as $s) {
            $mine = $rowsBy[$s['id']] ?? [];
            $full = self::compute(
                ['id' => $s['id'], 'hasOverview' => (bool) $s['hasOverview'], 'contentUpdatedAt' => $s['contentUpdatedAt']],
                $nodesBy[$s['id']] ?? [],
                $mine,
            );
            $last = null;
            foreach ($mine as $r) if ($r['lastOpenedAt'] && (!$last || $r['lastOpenedAt'] > $last)) $last = $r['lastOpenedAt'];
            $result[$s['id']] = [
                'total' => $full['total'],
                'done' => $full['done'],
                'outdated' => $full['outdated'],
                'percent' => $full['percent'],
                'state' => $full['state'],
                'lastOpenedAt' => $last,
            ];
        }
        return obj($result);
    }

    /** Subjects the user has started reading, most recent first. */
    public static function recent(string $userId, int $limit = 6): array
    {
        $rows = Db::q(
            'SELECT subject_id, MAX(last_opened_at) AS last FROM read_progress
             WHERE user_id = ? AND last_opened_at IS NOT NULL GROUP BY subject_id ORDER BY last DESC LIMIT ' . ($limit * 2),
            [$userId],
        );
        $ids = array_column($rows, 'subject_id');
        $live = $ids ? index_by(Db::rows('subjects', 'SELECT id, title, color FROM subjects WHERE id IN (' . marks($ids) . ') AND deleted_at IS NULL', $ids)) : [];
        $ids = array_slice(array_values(array_filter($ids, fn($id) => isset($live[$id]))), 0, $limit);
        $sums = (array) self::summaries($userId, $ids);
        return array_map(fn($id) => [...$live[$id], ...($sums[$id] ?? [])], $ids);
    }

    /** Admin: a user's reading progress across subjects they own, are shared or have opened. */
    public static function adminForUser(string $userId): array|stdClass
    {
        $ids = [
            ...array_column(Db::q('SELECT id FROM subjects WHERE owner_id = ? AND deleted_at IS NULL', [$userId]), 'id'),
            ...array_column(Db::q('SELECT subject_id FROM subject_members WHERE user_id = ?', [$userId]), 'subject_id'),
            ...array_column(Db::q('SELECT DISTINCT subject_id FROM read_progress WHERE user_id = ?', [$userId]), 'subject_id'),
        ];
        return self::summaries($userId, $ids);
    }

    // ------------------------------------------------------------ writes

    private static function target(array $user, string $subjectId, ?string $nodeId): string
    {
        Access::require($subjectId, $user, 'view');
        if ($nodeId) Content::findNode($subjectId, $nodeId);
        return $nodeId ?? $subjectId;
    }

    private static function event(string $userId, string $subjectId, ?string $nodeId, string $type): void
    {
        Db::insert('study_events', ['userId' => $userId, 'subjectId' => $subjectId, 'nodeId' => $nodeId, 'type' => $type], false);
    }

    private static function nodeIdOf(array $body): ?string
    {
        $dto = V::check($body, ['nodeId' => ['optional', 'string']]);
        return ($dto['nodeId'] ?? null) ?: null;
    }

    /** Called while an item is on screen; accumulates reading time. */
    public static function heartbeat(array $user, string $subjectId, array $body): array
    {
        $dto = V::check($body, [
            'nodeId' => ['optional', 'string'],
            'seconds' => ['int', 'gte' => 0, 'lte' => 600],
            'opened' => ['optional', 'bool'],
        ]);
        $nodeId = ($dto['nodeId'] ?? null) ?: null;
        $scopeKey = self::target($user, $subjectId, $nodeId);
        $secs = max(0, min(self::MAX_HEARTBEAT_SEC, $dto['seconds']));
        $now = now_db();
        $existing = Db::q('SELECT id, first_opened_at FROM read_progress WHERE user_id = ? AND scope_key = ?', [$user['id'], $scopeKey])[0] ?? null;
        if ($existing) {
            $data = ['lastOpenedAt' => $now];
            if (!$existing['first_opened_at']) $data['firstOpenedAt'] = $now;
            Db::updateWhere('read_progress', $data, 'id = ?', [$existing['id']]);
            Db::run('UPDATE read_progress SET time_spent_sec = time_spent_sec + ? WHERE id = ?', [$secs, $existing['id']]);
        } else {
            Db::insert('read_progress', [
                'userId' => $user['id'],
                'subjectId' => $subjectId,
                'nodeId' => $nodeId,
                'scopeKey' => $scopeKey,
                'firstOpenedAt' => $now,
                'lastOpenedAt' => $now,
                'timeSpentSec' => $secs,
            ], false);
        }
        if ($secs > 0) {
            Db::run(
                'INSERT INTO study_time (id, user_id, subject_id, node_id, scope_key, day, seconds) VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE seconds = seconds + ?',
                [uuid(), $user['id'], $subjectId, $nodeId, $scopeKey, today(), $secs, $secs],
            );
        }
        if (!empty($dto['opened'])) self::event($user['id'], $subjectId, $nodeId, 'OPEN');
        return ['ok' => true];
    }

    public static function setComplete(array $user, string $subjectId, array $body, bool $complete): array
    {
        $nodeId = self::nodeIdOf($body);
        $scopeKey = self::target($user, $subjectId, $nodeId);
        $now = now_db();
        $existing = Db::scalar('SELECT id FROM read_progress WHERE user_id = ? AND scope_key = ?', [$user['id'], $scopeKey]);
        if ($existing) {
            Db::updateWhere('read_progress', ['completedAt' => $complete ? $now : null], 'id = ?', [$existing]);
        } else {
            Db::insert('read_progress', [
                'userId' => $user['id'],
                'subjectId' => $subjectId,
                'nodeId' => $nodeId,
                'scopeKey' => $scopeKey,
                'firstOpenedAt' => $now,
                'lastOpenedAt' => $now,
                'completedAt' => $complete ? $now : null,
            ], false);
        }
        self::event($user['id'], $subjectId, $nodeId, $complete ? 'COMPLETE' : 'UNCOMPLETE');
        $progress = self::forUser($user['id'], $subjectId);
        if ($complete) {
            // A failing auto-assign must not undo or block the read mark.
            try {
                Templates::assignCompleted($user['id'], $subjectId, $progress);
            } catch (Throwable $e) {
                log_error('Completion listener failed: ' . $e->getMessage());
            }
        }
        return $progress;
    }

    /** Start over: clears read marks for the item and everything under it (whole subject when nodeId is null). */
    public static function reset(array $user, string $subjectId, array $body): array
    {
        $nodeId = self::nodeIdOf($body);
        self::target($user, $subjectId, $nodeId);
        if ($nodeId) {
            $all = Db::q('SELECT id, parent_id FROM content_nodes WHERE subject_id = ? AND deleted_at IS NULL', [$subjectId]);
            $keys = [$nodeId];
            for ($i = 0; $i < count($keys); $i++) {
                foreach ($all as $n) if ($n['parent_id'] === $keys[$i]) $keys[] = $n['id'];
            }
        } else {
            $keys = [$subjectId, ...array_column(Db::q('SELECT id FROM content_nodes WHERE subject_id = ?', [$subjectId]), 'id')];
        }
        // Time spent is kept for analytics; firstOpenedAt restarts the attempt.
        Db::updateWhere(
            'read_progress',
            ['completedAt' => null, 'firstOpenedAt' => null],
            'user_id = ? AND scope_key IN (' . marks($keys) . ')',
            [$user['id'], ...$keys],
        );
        self::event($user['id'], $subjectId, $nodeId, 'RESET');
        return self::forUser($user['id'], $subjectId);
    }
}
