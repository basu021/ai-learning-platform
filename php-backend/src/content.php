<?php
declare(strict_types=1);

final class Access
{
    public static function compute(array $subject, array $user, ?array $member): array
    {
        $isAdmin = $user['role'] === 'ADMIN';
        $isOwner = $subject['ownerId'] === $user['id'];
        $canManage = $isAdmin || $isOwner;
        $published = $subject['status'] === 'PUBLISHED';
        $canView = $canManage || $member !== null || ($subject['visibility'] === 'PUBLIC' && $published);
        $listed = $subject['visibility'] === 'LISTED' && $published;
        return [
            'subject' => $subject,
            'isAdmin' => $isAdmin,
            'isOwner' => $isOwner,
            'member' => $member,
            'canView' => $canView,
            'previewOnly' => !$canView && $listed,
            'canEdit' => $canManage || ($member['role'] ?? null) === 'EDITOR',
            'canManage' => $canManage,
            'canRequestAccess' => !$canView && $listed,
        ];
    }

    public static function resolve(string $subjectId, array $user): array
    {
        $subject = Db::row('subjects', 'SELECT * FROM subjects WHERE id = ? AND deleted_at IS NULL', [$subjectId])
            ?? not_found('Subject not found');
        $member = Db::row('subject_members', 'SELECT * FROM subject_members WHERE subject_id = ? AND user_id = ?', [$subjectId, $user['id']]);
        return self::compute($subject, $user, $member);
    }

    /** @param 'preview'|'view'|'edit'|'manage' $level */
    public static function require(string $subjectId, array $user, string $level): array
    {
        $a = self::resolve($subjectId, $user);
        $ok = match ($level) {
            'preview' => $a['canView'] || $a['previewOnly'],
            'view' => $a['canView'],
            'edit' => $a['canEdit'],
            default => $a['canManage'],
        };
        if (!$ok) {
            // Don't reveal that a private subject exists.
            if (!$a['canView'] && !$a['previewOnly']) not_found('Subject not found');
            forbidden($level === 'view' ? 'You need access to this subject' : 'You do not have permission to do that');
        }
        return $a;
    }

    /** Grants view access if the user doesn't already have it (used when assigning tasks). */
    public static function ensureViewer(string $subjectId, string $userId, string $grantedById): bool
    {
        $owner = Db::scalar('SELECT owner_id FROM subjects WHERE id = ?', [$subjectId]);
        if ($owner === null) not_found('Subject not found');
        if ($owner === $userId) return false;
        if (Db::scalar('SELECT 1 FROM subject_members WHERE subject_id = ? AND user_id = ?', [$subjectId, $userId])) return false;
        Db::insert('subject_members', ['subjectId' => $subjectId, 'userId' => $userId, 'role' => 'VIEWER', 'grantedById' => $grantedById], false);
        return true;
    }
}

final class Content
{
    public const MAX_REVISIONS = 3;
    private const CHILD_TYPE = ['ROOT' => 'CHAPTER', 'CHAPTER' => 'TOPIC', 'TOPIC' => 'SUBTOPIC', 'SUBTOPIC' => null];

    private static function cleanFields(array $f): array
    {
        $out = [];
        if (array_key_exists('title', $f)) $out['title'] = trim((string) $f['title']);
        if (array_key_exists('summary', $f)) $out['summary'] = trim_or_null($f['summary']);
        if (array_key_exists('content', $f)) $out['content'] = Sanitizer::rich($f['content']);
        return $out;
    }

    /** True if applying `$fields` would alter title, summary or content. */
    private static function changes(array $current, array $fields): bool
    {
        foreach (['title', 'summary', 'content'] as $k) {
            if (array_key_exists($k, $fields) && ($fields[$k] ?? null) !== ($current[$k] ?? null)) return true;
        }
        return false;
    }

    private static function snapshotOf(array $e): array
    {
        return ['title' => $e['title'], 'summary' => $e['summary'], 'content' => $e['content']];
    }

    // ------------------------------------------------------------- edits

    /**
     * Entry point for every content edit. Owners/admins apply immediately;
     * editors produce a pending change request for the owner to approve.
     */
    public static function submit(array $user, string $subjectId, ?string $nodeId, string $action, array $payload, ?string $changeNote): array
    {
        $access = Access::require($subjectId, $user, 'edit');
        $clean = match ($action) {
            'DELETE' => [],
            'CREATE' => [...self::cleanFields($payload), 'type' => $payload['type'], 'parentId' => $payload['parentId'] ?? null],
            default => self::cleanFields($payload),
        };
        self::validate($subjectId, $nodeId, $action, $clean);

        if ($access['canManage']) {
            $result = Db::tx(fn() => self::apply($subjectId, $nodeId, $action, $clean, $user['id'], $changeNote));
            return ['applied' => true, 'pending' => false, 'result' => $result];
        }

        $change = Db::insert('change_requests', [
            'subjectId' => $subjectId,
            'nodeId' => $nodeId,
            'action' => $action,
            'payload' => obj($clean),
            'changeNote' => trim_or_null($changeNote),
            'authorId' => $user['id'],
        ]);
        Notifications::notify($access['subject']['ownerId'], [
            'title' => 'Change awaiting your approval',
            'message' => "{$user['name']} (@{$user['username']}) proposed a change to \"{$access['subject']['title']}\".",
            'type' => 'change_request',
            'link' => "/subjects/$subjectId/manage?tab=changes",
        ]);
        return ['applied' => false, 'pending' => true, 'changeRequestId' => $change['id']];
    }

    private static function validate(string $subjectId, ?string $nodeId, string $action, array $p): void
    {
        if (array_key_exists('title', $p) && strlen($p['title']) < 1) bad_request('Title is required');
        if ($action === 'CREATE') {
            $parent = !empty($p['parentId']) ? self::findNode($subjectId, $p['parentId']) : null;
            $expected = self::CHILD_TYPE[$parent ? $parent['type'] : 'ROOT'];
            if (!$expected) bad_request('Subtopics cannot have children');
            if ($p['type'] !== $expected) {
                $what = $parent ? strtolower($parent['type']) : 'subject';
                bad_request("A $what can only contain " . strtolower($expected) . 's');
            }
            return;
        }
        if ($nodeId) self::findNode($subjectId, $nodeId);
        elseif ($action === 'DELETE') bad_request('Delete the subject from its settings');
    }

    public static function findNode(string $subjectId, string $nodeId, bool $includeDeleted = false): array
    {
        $sql = 'SELECT * FROM content_nodes WHERE id = ? AND subject_id = ?' . ($includeDeleted ? '' : ' AND deleted_at IS NULL');
        return Db::row('content_nodes', $sql, [$nodeId, $subjectId]) ?? not_found('Content not found');
    }

    /** Applies a change and records the previous state as a revision. Call inside a transaction. */
    private static function apply(string $subjectId, ?string $nodeId, string $action, array $payload, string $actorId, ?string $changeNote): array
    {
        $note = trim_or_null($changeNote);

        if ($action === 'CREATE') {
            $parentId = $payload['parentId'] ?? null;
            $siblings = Db::count(
                'SELECT COUNT(*) FROM content_nodes WHERE subject_id = ? AND parent_id <=> ? AND deleted_at IS NULL',
                [$subjectId, $parentId],
            );
            $node = Db::insert('content_nodes', [
                'subjectId' => $subjectId,
                'parentId' => $parentId,
                'type' => $payload['type'],
                'title' => $payload['title'],
                'summary' => $payload['summary'] ?? null,
                'content' => $payload['content'] ?? null,
                'hasContent' => ($payload['content'] ?? null) !== null && $payload['content'] !== '',
                'order' => $siblings,
            ]);
            self::record($subjectId, $node['id'], 'CREATE', [], $actorId, $note);
            return $node;
        }

        if ($action === 'DELETE') {
            $node = Db::row('content_nodes', 'SELECT * FROM content_nodes WHERE id = ? AND subject_id = ? AND deleted_at IS NULL', [$nodeId, $subjectId])
                ?? throw new RuntimeException('Node not found');
            $deletedAt = now_db();
            $ids = [$node['id'], ...self::descendantIds($node['id'])];
            Db::updateWhere('content_nodes', ['deletedAt' => $deletedAt], 'id IN (' . marks($ids) . ') AND deleted_at IS NULL', $ids);
            self::record($subjectId, $node['id'], 'DELETE', [...self::snapshotOf($node), 'deletedAt' => iso($deletedAt)], $actorId, $note);
            return ['id' => $node['id'], 'deleted' => true];
        }

        $fields = array_intersect_key($payload, ['title' => 1, 'summary' => 1, 'content' => 1]);
        if ($nodeId) {
            $node = Db::row('content_nodes', 'SELECT * FROM content_nodes WHERE id = ? AND subject_id = ? AND deleted_at IS NULL', [$nodeId, $subjectId])
                ?? throw new RuntimeException('Node not found');
            if (!self::changes($node, $fields)) return $node;
            self::record($subjectId, $nodeId, 'UPDATE', self::snapshotOf($node), $actorId, $note);
            $data = $fields + ['contentUpdatedAt' => now_db()];
            if (array_key_exists('content', $fields)) $data['hasContent'] = ($fields['content'] ?? null) !== null && $fields['content'] !== '';
            return Db::update('content_nodes', $nodeId, $data);
        }
        $subject = Db::find('subjects', $subjectId) ?? throw new RuntimeException('Subject not found');
        if (!self::changes($subject, $fields)) return $subject;
        self::record($subjectId, null, 'UPDATE', self::snapshotOf($subject), $actorId, $note);
        return Db::update('subjects', $subjectId, $fields + ['contentUpdatedAt' => now_db()]);
    }

    private static function record(string $subjectId, ?string $nodeId, string $action, array $snapshot, string $actorId, ?string $note): void
    {
        Db::insert('content_revisions', [
            'subjectId' => $subjectId,
            'nodeId' => $nodeId,
            'action' => $action,
            'snapshot' => obj($snapshot),
            'changeNote' => $note,
            'changedById' => $actorId,
        ], false);
        // Keep only the newest MAX_REVISIONS per entity.
        $stale = array_column(Db::q(
            'SELECT id FROM content_revisions WHERE subject_id = ? AND node_id <=> ? ORDER BY created_at DESC LIMIT 18446744073709551615 OFFSET ' . self::MAX_REVISIONS,
            [$subjectId, $nodeId],
        ), 'id');
        if ($stale) Db::run('DELETE FROM content_revisions WHERE id IN (' . marks($stale) . ')', $stale);
    }

    private static function descendantIds(string $rootId): array
    {
        $out = [];
        $frontier = [$rootId];
        while ($frontier) {
            $frontier = array_column(Db::q(
                'SELECT id FROM content_nodes WHERE parent_id IN (' . marks($frontier) . ') AND deleted_at IS NULL',
                $frontier,
            ), 'id');
            array_push($out, ...$frontier);
        }
        return $out;
    }

    // --------------------------------------------------- change requests

    public static function listChanges(array $user, string $subjectId, ?string $status): array
    {
        $access = Access::require($subjectId, $user, 'edit');
        $sql = 'SELECT * FROM change_requests WHERE subject_id = ?';
        $params = [$subjectId];
        if ($status) { $sql .= ' AND status = ?'; $params[] = $status; }
        if (!$access['canManage']) { $sql .= ' AND author_id = ?'; $params[] = $user['id']; }
        $changes = Db::rows('change_requests', "$sql ORDER BY created_at DESC LIMIT 100", $params);

        $users = user_summaries([...array_column($changes, 'authorId'), ...array_column($changes, 'reviewedById')]);
        $nodeIds = array_values(array_filter(array_column($changes, 'nodeId')));
        $nodes = $nodeIds ? index_by(Db::rows(
            'content_nodes',
            'SELECT id, title, type, summary, content, deleted_at FROM content_nodes WHERE id IN (' . marks($nodeIds) . ')',
            $nodeIds,
        )) : [];
        $subject = $access['subject'];
        // Attach the current state so the UI can show a before/after diff.
        return array_map(function ($c) use ($users, $nodes, $subject) {
            $node = $c['nodeId'] ? ($nodes[$c['nodeId']] ?? null) : null;
            return [
                ...$c,
                'author' => $users[$c['authorId']] ?? null,
                'reviewedBy' => $c['reviewedById'] ? ($users[$c['reviewedById']] ?? null) : null,
                'node' => $node,
                'current' => $c['nodeId']
                    ? ($node ? self::snapshotOf($node) : null)
                    : ($c['action'] === 'UPDATE' ? self::snapshotOf($subject) : null),
            ];
        }, $changes);
    }

    public static function reviewChange(array $user, string $changeId, bool $approve, ?string $reviewNote): array
    {
        $change = Db::find('change_requests', $changeId) ?? not_found('Change request not found');
        $access = Access::require($change['subjectId'], $user, 'manage');
        if ($change['status'] !== 'PENDING') bad_request('This change was already reviewed');
        $review = [
            'status' => $approve ? 'APPROVED' : 'REJECTED',
            'reviewedById' => $user['id'],
            'reviewNote' => trim_or_null($reviewNote),
            'reviewedAt' => now_db(),
        ];

        if ($approve) {
            if ($change['nodeId']) {
                $node = Db::find('content_nodes', $change['nodeId']);
                if (!$node || $node['deletedAt']) bad_request('The content this change targets has been deleted');
            }
            $payload = (array) $change['payload'];
            if ($change['action'] === 'CREATE' && !empty($payload['parentId'])) {
                self::findNode($change['subjectId'], $payload['parentId']);
            }
            Db::tx(function () use ($change, $payload, $review) {
                self::apply($change['subjectId'], $change['nodeId'], $change['action'], $payload, $change['authorId'], $change['changeNote']);
                Db::update('change_requests', $change['id'], $review);
            });
        } else {
            Db::update('change_requests', $change['id'], $review);
        }

        $verdict = $approve ? 'approved' : 'rejected';
        Notifications::notify($change['authorId'], [
            'title' => $approve ? 'Your change was approved' : 'Your change was rejected',
            'message' => "Your proposed change to \"{$access['subject']['title']}\" was $verdict" . ($reviewNote ? ": $reviewNote" : '.'),
            'type' => 'review',
            'link' => "/subjects/{$change['subjectId']}" . ($change['nodeId'] ? "?node={$change['nodeId']}" : ''),
        ]);
        return ['id' => $change['id'], 'status' => $review['status']];
    }

    // --------------------------------------------------------- revisions

    public static function listRevisions(array $user, string $subjectId, bool $filterNode, ?string $nodeId): array
    {
        Access::require($subjectId, $user, 'manage');
        $sql = 'SELECT * FROM content_revisions WHERE subject_id = ?';
        $params = [$subjectId];
        if ($filterNode) { $sql .= ' AND node_id <=> ?'; $params[] = $nodeId ?: null; }
        $revs = Db::rows('content_revisions', "$sql ORDER BY created_at DESC LIMIT 200", $params);
        return self::withRevisionRefs($revs, ['id', 'title', 'type', 'deletedAt']);
    }

    private static function withRevisionRefs(array $revs, array $nodeFields): array
    {
        $users = user_summaries(array_column($revs, 'changedById'));
        $nodeIds = array_values(array_unique(array_filter(array_column($revs, 'nodeId'))));
        $nodes = $nodeIds ? index_by(Db::rows('content_nodes', 'SELECT * FROM content_nodes WHERE id IN (' . marks($nodeIds) . ')', $nodeIds)) : [];
        return array_map(fn($r) => [
            ...$r,
            'changedBy' => $users[$r['changedById']] ?? null,
            'node' => $r['nodeId'] && isset($nodes[$r['nodeId']]) ? pick($nodes[$r['nodeId']], $nodeFields) : null,
        ], $revs);
    }

    /**
     * Undo a revision: UPDATE restores the snapshot, DELETE brings the node
     * (and the descendants deleted with it) back, CREATE removes the node again.
     */
    public static function restoreRevision(array $user, string $revisionId): array
    {
        $rev = Db::find('content_revisions', $revisionId) ?? not_found('Revision not found');
        Access::require($rev['subjectId'], $user, 'manage');
        $snap = (array) $rev['snapshot'];
        $note = 'Restored version from ' . str_replace('T', ' ', substr($rev['createdAt'], 0, 16));

        return Db::tx(function () use ($rev, $snap, $note, $user) {
            if ($rev['action'] === 'UPDATE') {
                if ($rev['nodeId']) {
                    $node = Db::find('content_nodes', $rev['nodeId']);
                    if (!$node || $node['deletedAt']) bad_request('Restore the deleted item first');
                }
                return self::apply($rev['subjectId'], $rev['nodeId'], 'UPDATE', [
                    'title' => $snap['title'] ?? null,
                    'summary' => $snap['summary'] ?? null,
                    'content' => $snap['content'] ?? null,
                ], $user['id'], $note);
            }

            $node = $rev['nodeId'] ? Db::find('content_nodes', $rev['nodeId']) : null;
            if ($rev['action'] === 'DELETE') {
                if (!$node) not_found('Content no longer exists');
                if (!$node['deletedAt']) bad_request('Already restored');
                if ($node['parentId']) {
                    $parent = Db::find('content_nodes', $node['parentId']);
                    if ($parent && $parent['deletedAt']) bad_request('Restore its parent first');
                }
                $raw = Db::scalar('SELECT deleted_at FROM content_nodes WHERE id = ?', [$node['id']]);
                Db::updateWhere('content_nodes', ['deletedAt' => null], 'subject_id = ? AND deleted_at = ?', [$rev['subjectId'], $raw]);
                Db::run('DELETE FROM content_revisions WHERE id = ?', [$rev['id']]);
                return ['id' => $node['id'], 'restored' => true];
            }

            // CREATE -> undo by deleting the created node.
            if (!$node || $node['deletedAt']) bad_request('Already removed');
            return self::apply($rev['subjectId'], $rev['nodeId'], 'DELETE', [], $user['id'], $note);
        });
    }

    /** Top-level nodes that were deleted and can be restored. */
    public static function listTrash(array $user, string $subjectId): array
    {
        Access::require($subjectId, $user, 'manage');
        $revs = Db::rows(
            'content_revisions',
            "SELECT r.* FROM content_revisions r JOIN content_nodes n ON n.id = r.node_id
             WHERE r.subject_id = ? AND r.action = 'DELETE' AND n.deleted_at IS NOT NULL
             ORDER BY r.created_at DESC",
            [$subjectId],
        );
        return self::withRevisionRefs($revs, ['id', 'title', 'type']);
    }

    // --------------------------------------------------------- structure

    public static function reorder(array $user, string $subjectId, ?string $parentId, array $orderedIds): array
    {
        Access::require($subjectId, $user, 'manage');
        $known = array_column(Db::q(
            'SELECT id FROM content_nodes WHERE subject_id = ? AND parent_id <=> ? AND deleted_at IS NULL',
            [$subjectId, $parentId],
        ), 'id');
        $set = array_flip($known);
        $bad = count($orderedIds) !== count($set);
        foreach ($orderedIds as $id) if (!isset($set[$id])) $bad = true;
        if ($bad) bad_request('Order must list every sibling exactly once');
        Db::tx(function () use ($orderedIds) {
            foreach ($orderedIds as $order => $id) Db::updateWhere('content_nodes', ['order' => $order], 'id = ?', [$id]);
        });
        return ['ok' => true];
    }

    public static function setPreview(array $user, string $subjectId, string $nodeId, bool $isPreview): array
    {
        $access = Access::require($subjectId, $user, 'manage');
        if (!$access['isAdmin']) forbidden('Only admins manage catalog previews');
        self::findNode($subjectId, $nodeId);
        return Db::update('content_nodes', $nodeId, ['isPreview' => $isPreview]);
    }

    // ------------------------------------------------------------- reads

    /** Ancestors from chapter down to the node itself. */
    public static function breadcrumb(array $node): array
    {
        $chain = [['id' => $node['id'], 'title' => $node['title'], 'type' => $node['type']]];
        $parentId = $node['parentId'];
        while ($parentId) {
            $p = Db::row('content_nodes', 'SELECT id, title, type, parent_id FROM content_nodes WHERE id = ?', [$parentId]);
            if (!$p) break;
            array_unshift($chain, ['id' => $p['id'], 'title' => $p['title'], 'type' => $p['type']]);
            $parentId = $p['parentId'];
        }
        return $chain;
    }

    /** Visible on a LISTED subject's preview if it or an ancestor is marked as preview. */
    public static function isPreviewVisible(array $node): bool
    {
        $current = $node;
        while ($current) {
            if ($current['isPreview']) return true;
            if (!$current['parentId']) return false;
            $current = Db::row('content_nodes', 'SELECT is_preview, parent_id FROM content_nodes WHERE id = ?', [$current['parentId']]);
        }
        return false;
    }

    public static function attachmentsFor(string $subjectId, ?string $nodeId): array
    {
        $atts = Db::rows(
            'attachments',
            'SELECT * FROM attachments WHERE subject_id = ? AND node_id <=> ? AND inline = 0 ORDER BY created_at DESC',
            [$subjectId, $nodeId],
        );
        $users = user_summaries(array_column($atts, 'uploadedById'), ['name', 'username']);
        return array_map(fn($a) => [...$a, 'uploadedBy' => $users[$a['uploadedById']] ?? null], $atts);
    }

    public static function getNode(array $user, string $subjectId, string $nodeId): array
    {
        $access = Access::require($subjectId, $user, 'preview');
        $node = self::findNode($subjectId, $nodeId);
        $locked = $access['previewOnly'] && !self::isPreviewVisible($node);
        $children = Db::rows(
            'content_nodes',
            'SELECT id, title, type, summary, `order` FROM content_nodes WHERE parent_id = ? AND deleted_at IS NULL ORDER BY `order` ASC',
            [$node['id']],
        );
        if ($locked) {
            [$attachments, $pending, $taskCount] = [[], 0, 0];
        } else {
            $attachments = self::attachmentsFor($subjectId, $nodeId);
            $pending = $access['canManage']
                ? Db::count("SELECT COUNT(*) FROM change_requests WHERE subject_id = ? AND node_id = ? AND status = 'PENDING'", [$subjectId, $nodeId])
                : 0;
            $taskCount = Db::count('SELECT COUNT(*) FROM tasks WHERE node_id = ? AND assignee_id = ? AND deleted_at IS NULL', [$nodeId, $user['id']]);
        }
        return [
            ...$node,
            'content' => $locked ? null : $node['content'],
            'locked' => $locked,
            'children' => $children,
            'breadcrumb' => self::breadcrumb($node),
            'attachments' => $attachments,
            'pendingChanges' => $pending,
            'taskCount' => $taskCount,
        ];
    }

    /**
     * The outline tree. For preview-only viewers, chapters are listed as
     * locked titles and only preview-marked branches expand.
     */
    public static function outline(string $subjectId, bool $previewOnly): array
    {
        $nodes = Db::rows(
            'content_nodes',
            'SELECT id, parent_id, type, title, `order`, is_preview FROM content_nodes WHERE subject_id = ? AND deleted_at IS NULL ORDER BY `order` ASC',
            [$subjectId],
        );
        $byId = [];
        foreach ($nodes as $n) $byId[$n['id']] = $n + ['locked' => false, 'children' => []];
        $kids = [];
        $roots = [];
        foreach ($byId as $id => $n) {
            if ($n['parentId'] && isset($byId[$n['parentId']])) $kids[$n['parentId']][] = $id;
            elseif (!$n['parentId']) $roots[] = $id;
        }
        $build = function (string $id) use (&$build, $byId, $kids): array {
            $n = $byId[$id];
            $n['children'] = array_map($build, $kids[$id] ?? []);
            return $n;
        };
        $tree = array_map($build, $roots);
        if (!$previewOnly) return $tree;

        // A node is unlocked if it or an ancestor is a preview. Locked chapters
        // still show their title; locked deeper nodes are hidden unless they
        // lead to a preview further down.
        $prune = function (array $list, bool $inherited) use (&$prune): array {
            $out = [];
            foreach ($list as $n) {
                $open = $inherited || $n['isPreview'];
                $children = $prune($n['children'], $open);
                if ($open) $out[] = ['children' => $children] + $n;
                elseif ($n['type'] === 'CHAPTER' || $children) $out[] = ['locked' => true, 'children' => $children] + $n;
            }
            return $out;
        };
        return $prune($tree, false);
    }
}
