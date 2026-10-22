<?php
declare(strict_types=1);

final class Subjects
{
    private static function normalizeTags(?string $tags): ?string
    {
        if ($tags === null) return null;
        $list = array_values(array_unique(array_filter(array_map(fn($t) => strtolower(trim($t)), explode(',', $tags)), fn($t) => $t !== '')));
        return $list ? substr(implode(',', $list), 0, 500) : null;
    }

    // ---------------------------------------------------------- library

    public static function list(array $user, array $query): array
    {
        $q = V::check($query, [
            'scope' => ['optional', 'in' => ['library', 'mine', 'shared', 'catalog', 'all']],
            'q' => ['optional', 'string'],
            'categoryId' => ['optional', 'string'],
            'visibility' => ['optional', 'in' => ['PUBLIC', 'LISTED', 'PRIVATE']],
            'status' => ['optional', 'in' => ['DRAFT', 'PUBLISHED']],
            'tag' => ['optional', 'string'],
            'ownerId' => ['optional', 'string'],
        ]);
        $isAdmin = $user['role'] === 'ADMIN';
        $catalog = "(s.status = 'PUBLISHED' AND s.visibility IN ('PUBLIC','LISTED'))";
        $mine = '(s.owner_id = ?)';
        $shared = '(EXISTS (SELECT 1 FROM subject_members m WHERE m.subject_id = s.id AND m.user_id = ?))';

        $where = ['s.deleted_at IS NULL'];
        $params = [];
        switch ($q['scope'] ?? 'library') {
            case 'mine': $where[] = $mine; $params[] = $user['id']; break;
            case 'shared': $where[] = $shared; $params[] = $user['id']; break;
            case 'catalog': $where[] = $catalog; break;
            case 'all': if (!$isAdmin) forbidden(); break;
            default:
                $where[] = "($mine OR $shared OR $catalog)";
                array_push($params, $user['id'], $user['id']);
        }
        if (!empty($q['q'])) {
            $where[] = '(s.title LIKE ? OR s.summary LIKE ? OR s.tags LIKE ?)';
            array_push($params, like($q['q']), like($q['q']), like(strtolower($q['q'])));
        }
        if (!empty($q['categoryId'])) { $where[] = 's.category_id = ?'; $params[] = $q['categoryId']; }
        if (!empty($q['visibility'])) { $where[] = 's.visibility = ?'; $params[] = $q['visibility']; }
        if (!empty($q['status'])) { $where[] = 's.status = ?'; $params[] = $q['status']; }
        if (!empty($q['tag'])) { $where[] = 's.tags LIKE ?'; $params[] = like(strtolower($q['tag'])); }
        if (!empty($q['ownerId']) && $isAdmin) { $where[] = 's.owner_id = ?'; $params[] = $q['ownerId']; }

        $rows = Db::q(
            "SELECT s.id, s.title, s.summary, s.visibility, s.status, s.tags, s.color, s.owner_id, s.updated_at, s.created_at, s.category_id,
                (SELECT m.role FROM subject_members m WHERE m.subject_id = s.id AND m.user_id = ? LIMIT 1) AS member_role,
                (SELECT COUNT(*) FROM content_nodes n WHERE n.subject_id = s.id AND n.type = 'CHAPTER' AND n.deleted_at IS NULL) AS chapter_count,
                (SELECT COUNT(*) FROM subject_members m WHERE m.subject_id = s.id) AS member_count,
                (SELECT COUNT(*) FROM change_requests c WHERE c.subject_id = s.id AND c.status = 'PENDING') AS pending_changes,
                (SELECT COUNT(*) FROM access_requests a WHERE a.subject_id = s.id AND a.status = 'PENDING') AS pending_access
             FROM subjects s WHERE " . implode(' AND ', $where) . ' ORDER BY s.updated_at DESC LIMIT 200',
            [$user['id'], ...$params],
        );
        $ids = array_column($rows, 'id');
        $owners = user_summaries(array_column($rows, 'owner_id'));
        $catIds = array_values(array_unique(array_filter(array_column($rows, 'category_id'))));
        $cats = $catIds ? index_by(Db::rows('categories', 'SELECT id, name FROM categories WHERE id IN (' . marks($catIds) . ')', $catIds)) : [];
        $requested = $ids ? array_flip(array_column(Db::q(
            "SELECT subject_id FROM access_requests WHERE user_id = ? AND status = 'PENDING' AND subject_id IN (" . marks($ids) . ')',
            [$user['id'], ...$ids],
        ), 'subject_id')) : [];

        $items = [];
        foreach ($rows as $r) {
            $s = Db::hydrate('subjects', $r);
            $isOwner = $s['ownerId'] === $user['id'];
            $memberRole = $r['member_role'];
            $canManage = $isAdmin || $isOwner;
            $hasAccess = $canManage || $memberRole !== null || ($s['visibility'] === 'PUBLIC' && $s['status'] === 'PUBLISHED');
            $items[] = [
                'id' => $s['id'],
                'title' => $s['title'],
                'summary' => $s['summary'],
                'visibility' => $s['visibility'],
                'status' => $s['status'],
                'tags' => $s['tags'],
                'color' => $s['color'],
                'ownerId' => $s['ownerId'],
                'updatedAt' => $s['updatedAt'],
                'createdAt' => $s['createdAt'],
                'owner' => $owners[$s['ownerId']] ?? null,
                'category' => $s['categoryId'] ? ($cats[$s['categoryId']] ?? null) : null,
                'chapterCount' => (int) $r['chapter_count'],
                'memberCount' => (int) $r['member_count'],
                'pendingChanges' => $canManage ? (int) $r['pending_changes'] : 0,
                'pendingAccessRequests' => $canManage ? (int) $r['pending_access'] : 0,
                'access' => [
                    'isOwner' => $isOwner,
                    'memberRole' => $memberRole,
                    'canManage' => $canManage,
                    'hasAccess' => $hasAccess,
                    'accessRequested' => isset($requested[$s['id']]),
                ],
            ];
        }
        // Reading progress only where the user can actually read the content.
        $readable = array_column(array_filter($items, fn($i) => $i['access']['hasAccess']), 'id');
        $progress = Progress::summaries($user['id'], $readable);
        return array_map(fn($i) => [...$i, 'progress' => $progress[$i['id']] ?? null], $items);
    }

    public static function create(array $user, array $body): array
    {
        $dto = V::check($body, [
            'title' => ['string', 'min' => 2, 'max' => 191],
            'summary' => ['optional', 'string', 'max' => 1000],
            'content' => ['optional', 'string'],
            'visibility' => ['optional', 'in' => ['PUBLIC', 'LISTED', 'PRIVATE']],
            'status' => ['optional', 'in' => ['DRAFT', 'PUBLISHED']],
            'categoryId' => ['optional', 'string'],
            'tags' => ['optional', 'string', 'max' => 500],
            'color' => ['optional', 'regex' => ['/^#[0-9a-fA-F]{6}$/', 'color must match /^#[0-9a-fA-F]{6}$/ regular expression']],
        ]);
        $isAdmin = $user['role'] === 'ADMIN';
        if (!$isAdmin && !empty($dto['visibility']) && $dto['visibility'] !== 'PRIVATE') {
            forbidden('Only admins can publish subjects to the catalog');
        }
        if (!empty($dto['categoryId'])) self::requireCategory($dto['categoryId']);
        $data = [
            'ownerId' => $user['id'],
            'title' => trim($dto['title']),
            'summary' => trim_or_null($dto['summary'] ?? null),
            'content' => Sanitizer::rich($dto['content'] ?? null),
            'visibility' => $isAdmin ? ($dto['visibility'] ?? 'PRIVATE') : 'PRIVATE',
            // Personal subjects have no catalog workflow, so they're live immediately.
            'status' => $isAdmin ? ($dto['status'] ?? 'DRAFT') : 'PUBLISHED',
            'categoryId' => ($dto['categoryId'] ?? null) ?: null,
            'tags' => self::normalizeTags($dto['tags'] ?? null),
        ];
        if (array_key_exists('color', $dto)) $data['color'] = $dto['color'];
        return Db::insert('subjects', $data);
    }

    public static function get(array $user, string $id): array
    {
        $access = Access::require($id, $user, 'preview');
        $s = $access['subject'];
        $owner = user_summaries([$s['ownerId']])[$s['ownerId']] ?? null;
        $category = $s['categoryId'] ? Db::find('categories', $s['categoryId']) : null;
        $counts = $access['canManage'] ? [
            Db::count("SELECT COUNT(*) FROM change_requests WHERE subject_id = ? AND status = 'PENDING'", [$id]),
            Db::count("SELECT COUNT(*) FROM access_requests WHERE subject_id = ? AND status = 'PENDING'", [$id]),
            Db::count('SELECT COUNT(*) FROM subject_members WHERE subject_id = ?', [$id]),
        ] : [0, 0, 0];
        $myRequest = $access['canRequestAccess']
            ? Db::row('access_requests', 'SELECT status, created_at FROM access_requests WHERE subject_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1', [$id, $user['id']])
            : null;
        return [
            ...$s,
            'owner' => $owner,
            'category' => $category,
            'outline' => Content::outline($id, $access['previewOnly']),
            'attachments' => $access['canView'] ? Content::attachmentsFor($id, null) : [],
            'pendingChanges' => $counts[0],
            'pendingAccessRequests' => $counts[1],
            'memberCount' => $counts[2],
            'access' => [
                'isOwner' => $access['isOwner'],
                'isAdmin' => $access['isAdmin'],
                'memberRole' => $access['member']['role'] ?? null,
                'canView' => $access['canView'],
                'previewOnly' => $access['previewOnly'],
                'canEdit' => $access['canEdit'],
                'canManage' => $access['canManage'],
                'canRequestAccess' => $access['canRequestAccess'],
                'editsNeedApproval' => $access['canEdit'] && !$access['canManage'],
                'lastRequest' => $myRequest,
            ],
        ];
    }

    public static function updateSettings(array $user, string $id, array $body): array
    {
        $dto = V::check($body, [
            'visibility' => ['optional', 'in' => ['PUBLIC', 'LISTED', 'PRIVATE']],
            'status' => ['optional', 'in' => ['DRAFT', 'PUBLISHED']],
            'categoryId' => ['optional', 'string'],
            'tags' => ['optional', 'string', 'max' => 500],
            'color' => ['optional', 'regex' => ['/^#[0-9a-fA-F]{6}$/', 'color must match /^#[0-9a-fA-F]{6}$/ regular expression']],
        ]);
        $access = Access::require($id, $user, 'manage');
        $data = [];
        if (array_key_exists('visibility', $dto) || array_key_exists('status', $dto)) {
            if (!$access['isAdmin']) forbidden('Personal subjects are always private');
            if (!empty($dto['visibility'])) $data['visibility'] = $dto['visibility'];
            if (!empty($dto['status'])) $data['status'] = $dto['status'];
        }
        if (array_key_exists('categoryId', $dto)) {
            if ($dto['categoryId']) self::requireCategory($dto['categoryId']);
            $data['categoryId'] = $dto['categoryId'] ?: null;
        }
        if (array_key_exists('tags', $dto)) $data['tags'] = self::normalizeTags($dto['tags']);
        if (array_key_exists('color', $dto)) $data['color'] = $dto['color'];
        if (!$data) return Db::find('subjects', $id);
        return Db::update('subjects', $id, $data);
    }

    public static function remove(array $user, string $id): array
    {
        Access::require($id, $user, 'manage');
        Db::tx(function () use ($id) {
            Db::update('subjects', $id, ['deletedAt' => now_db()]);
            Db::updateWhere('tasks', ['active' => false], 'subject_id = ?', [$id]);
        });
        return ['ok' => true];
    }

    // ---------------------------------------------------------- sharing

    public static function listMembers(array $user, string $id): array
    {
        Access::require($id, $user, 'view');
        $members = Db::rows('subject_members', 'SELECT * FROM subject_members WHERE subject_id = ? ORDER BY created_at ASC', [$id]);
        $users = user_summaries([...array_column($members, 'userId'), ...array_column($members, 'grantedById')]);
        return array_map(fn($m) => [
            ...$m,
            'user' => $users[$m['userId']] ?? null,
            'grantedBy' => $m['grantedById'] ? ($users[$m['grantedById']] ?? null) : null,
        ], $members);
    }

    /** Share by usernames (users) or assign (admins) — same mechanism. */
    public static function addMembers(array $user, string $id, array $body): array
    {
        $dto = V::check($body, [
            'usernames' => ['array', 'arrmax' => 50, 'each' => 'string'],
            'role' => ['optional', 'in' => ['VIEWER', 'EDITOR']],
        ]);
        $role = $dto['role'] ?? 'VIEWER';
        $access = Access::require($id, $user, 'manage');
        $names = normalize_usernames($dto['usernames']);
        if (!$names) bad_request('Enter at least one username');
        $users = Db::rows('users', 'SELECT id, username FROM users WHERE username IN (' . marks($names) . ') AND deleted_at IS NULL', $names);
        $found = array_column($users, 'username');
        $missing = array_values(array_diff($names, $found));
        if ($missing) not_found('Unknown username: ' . implode(', ', array_map(fn($m) => "@$m", $missing)));
        $targets = array_values(array_filter($users, fn($u) => $u['id'] !== $access['subject']['ownerId']));
        foreach ($targets as $t) {
            $existing = Db::scalar('SELECT id FROM subject_members WHERE subject_id = ? AND user_id = ?', [$id, $t['id']]);
            if ($existing) Db::updateWhere('subject_members', ['role' => $role], 'id = ?', [$existing]);
            else Db::insert('subject_members', ['subjectId' => $id, 'userId' => $t['id'], 'role' => $role, 'grantedById' => $user['id']], false);
            Db::updateWhere(
                'access_requests',
                ['status' => 'APPROVED', 'decidedById' => $user['id'], 'decidedAt' => now_db()],
                "subject_id = ? AND user_id = ? AND status = 'PENDING'",
                [$id, $t['id']],
            );
        }
        Notifications::notify(array_column($targets, 'id'), [
            'title' => $access['isAdmin'] && !$access['isOwner'] ? 'Subject assigned to you' : 'Subject shared with you',
            'message' => "{$user['name']} (@{$user['username']}) gave you " . ($role === 'EDITOR' ? 'edit' : 'view') . " access to \"{$access['subject']['title']}\".",
            'type' => 'share',
            'link' => "/subjects/$id",
        ]);
        return self::listMembers($user, $id);
    }

    public static function updateMember(array $user, string $id, string $userId, array $body): array
    {
        $dto = V::check($body, ['role' => ['in' => ['VIEWER', 'EDITOR']]]);
        Access::require($id, $user, 'manage');
        $n = Db::count('SELECT COUNT(*) FROM subject_members WHERE subject_id = ? AND user_id = ?', [$id, $userId]);
        if (!$n) not_found('Member not found');
        Db::updateWhere('subject_members', ['role' => $dto['role']], 'subject_id = ? AND user_id = ?', [$id, $userId]);
        return self::listMembers($user, $id);
    }

    public static function removeMember(array $user, string $id, string $userId): array
    {
        $access = Access::require($id, $user, 'view');
        // Members may leave on their own; otherwise managers only.
        if ($userId !== $user['id'] && !$access['canManage']) forbidden();
        Db::run('DELETE FROM subject_members WHERE subject_id = ? AND user_id = ?', [$id, $userId]);
        return ['ok' => true];
    }

    // -------------------------------------------------- access requests

    public static function requestAccess(array $user, string $id, array $body): array
    {
        $dto = V::check($body, ['message' => ['optional', 'string', 'max' => 1000]]);
        $access = Access::require($id, $user, 'preview');
        if (!$access['canRequestAccess']) bad_request('You already have access to this subject');
        if (Db::scalar("SELECT 1 FROM access_requests WHERE subject_id = ? AND user_id = ? AND status = 'PENDING'", [$id, $user['id']])) {
            conflict('Your request is already pending');
        }
        $req = Db::insert('access_requests', [
            'subjectId' => $id,
            'userId' => $user['id'],
            'message' => trim_or_null($dto['message'] ?? null),
        ]);
        $note = [
            'title' => 'Access request',
            'message' => "{$user['name']} (@{$user['username']}) requested access to \"{$access['subject']['title']}\".",
            'type' => 'access_request',
            'link' => "/subjects/$id/manage?tab=requests",
        ];
        Notifications::notify($access['subject']['ownerId'], $note);
        Notifications::notifyAdmins($note, $access['subject']['ownerId']);
        return $req;
    }

    public static function listAccessRequests(array $user, string $id, ?string $status): array
    {
        Access::require($id, $user, 'manage');
        $sql = 'SELECT * FROM access_requests WHERE subject_id = ?';
        $params = [$id];
        if ($status) { $sql .= ' AND status = ?'; $params[] = $status; }
        $reqs = Db::rows('access_requests', "$sql ORDER BY created_at DESC", $params);
        $users = user_summaries([...array_column($reqs, 'userId'), ...array_column($reqs, 'decidedById')]);
        return array_map(fn($r) => [
            ...$r,
            'user' => $users[$r['userId']] ?? null,
            'decidedBy' => $r['decidedById'] ? ($users[$r['decidedById']] ?? null) : null,
        ], $reqs);
    }

    public static function decideAccessRequest(array $user, string $requestId, bool $approve): array
    {
        $req = Db::find('access_requests', $requestId) ?? not_found('Request not found');
        $access = Access::require($req['subjectId'], $user, 'manage');
        if ($req['status'] !== 'PENDING') bad_request('Already decided');
        $status = $approve ? 'APPROVED' : 'REJECTED';
        Db::tx(function () use ($req, $user, $approve, $status) {
            Db::updateWhere('access_requests', ['status' => $status, 'decidedById' => $user['id'], 'decidedAt' => now_db()], 'id = ?', [$req['id']]);
            if ($approve && !Db::scalar('SELECT 1 FROM subject_members WHERE subject_id = ? AND user_id = ?', [$req['subjectId'], $req['userId']])) {
                Db::insert('subject_members', ['subjectId' => $req['subjectId'], 'userId' => $req['userId'], 'role' => 'VIEWER', 'grantedById' => $user['id']], false);
            }
        });
        Notifications::notify($req['userId'], [
            'title' => $approve ? 'Access granted' : 'Access request declined',
            'message' => "Your request for \"{$access['subject']['title']}\" was " . ($approve ? 'approved' : 'declined') . '.',
            'type' => 'review',
            'link' => "/subjects/{$req['subjectId']}",
        ]);
        return ['id' => $requestId, 'status' => $status];
    }

    // ------------------------------------------------------- categories

    public static function listCategories(): array
    {
        $rows = Db::q(
            'SELECT c.*, (SELECT COUNT(*) FROM subjects s WHERE s.category_id = c.id AND s.deleted_at IS NULL) AS subject_count
             FROM categories c ORDER BY c.name ASC',
        );
        return array_map(function ($r) {
            $n = (int) $r['subject_count'];
            unset($r['subject_count']);
            return [...Db::hydrate('categories', $r), '_count' => ['subjects' => $n]];
        }, $rows);
    }

    public static function createCategory(array $body): array
    {
        $dto = V::check($body, [
            'name' => ['string', 'min' => 1, 'max' => 80],
            'description' => ['optional', 'string', 'max' => 191],
        ]);
        $name = trim($dto['name']);
        if ($name === '') bad_request('Name is required');
        if (Db::scalar('SELECT 1 FROM categories WHERE name = ?', [$name])) conflict('Category already exists');
        return Db::insert('categories', ['name' => $name, 'description' => trim_or_null($dto['description'] ?? null)]);
    }

    public static function deleteCategory(string $id): array
    {
        if (!Db::run('DELETE FROM categories WHERE id = ?', [$id])->rowCount()) not_found('Category not found');
        return ['ok' => true];
    }

    private static function requireCategory(string $id): void
    {
        if (!Db::scalar('SELECT 1 FROM categories WHERE id = ?', [$id])) bad_request('Unknown category');
    }
}

/** Lower-cased, de-duplicated usernames without a leading @. */
function normalize_usernames(array $names): array
{
    $out = [];
    foreach ($names as $n) {
        $n = preg_replace('/^@/', '', strtolower(trim((string) $n)));
        if ($n !== '' && !in_array($n, $out, true)) $out[] = $n;
    }
    return $out;
}
