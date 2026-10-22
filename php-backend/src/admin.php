<?php
declare(strict_types=1);

final class Attachments
{
    public const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
    private const INLINE_TYPES = '/^image\/(png|jpe?g|gif|webp)$/';

    private static function dir(): string
    {
        $dir = env('UPLOAD_DIR', './uploads');
        if (!preg_match('#^(/|[A-Za-z]:[\\\\/])#', $dir)) $dir = APP_ROOT . '/' . preg_replace('#^\./#', '', $dir);
        return rtrim($dir, '/');
    }

    /** Embedded images use signed URLs; the secret defaults to JWT_SECRET like the Node API. */
    public static function sign(string $id): string
    {
        $secret = env('ATTACHMENT_SECRET') ?? env('JWT_SECRET', 'dev-secret-change-me');
        return substr(hash_hmac('sha256', "attachment:$id", $secret), 0, 32);
    }

    public static function publicUrl(string $id): string
    {
        return "/api/attachments/$id/raw?sig=" . self::sign($id);
    }

    public static function upload(array $user, string $subjectId, Request $req): array
    {
        $file = $_FILES['file'] ?? null;
        if ($file && in_array($file['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
            throw new HttpError(413, 'File too large');
        }
        if (!$file || $file['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) bad_request('No file uploaded');
        if ($file['size'] > self::MAX_UPLOAD_BYTES) throw new HttpError(413, 'File too large');
        $inline = $req->q('inline') === '1';
        $nodeId = $req->q('nodeId') ?: null;
        $mime = (string) ($file['type'] ?: 'application/octet-stream');

        // Editors may embed images in proposed edits; listing files on a page
        // is a manager action because it isn't reviewed.
        $access = Access::require($subjectId, $user, $inline ? 'edit' : 'manage');
        if ($inline && !preg_match(self::INLINE_TYPES, $mime)) bad_request('Only PNG, JPEG, GIF or WebP images can be embedded');
        if ($nodeId) Content::findNode($subjectId, $nodeId);

        $id = uuid();
        $rel = "$subjectId/$id";
        $dir = self::dir() . "/$subjectId";
        if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) throw new RuntimeException("Cannot create $dir");
        if (!move_uploaded_file($file['tmp_name'], self::dir() . "/$rel")) throw new RuntimeException('Could not store upload');

        $att = Db::insert('attachments', [
            'id' => $id,
            'subjectId' => $access['subject']['id'],
            'nodeId' => $nodeId,
            'filename' => mb_substr(basename((string) $file['name']), 0, 191),
            'contentType' => $mime,
            'sizeBytes' => (int) $file['size'],
            'storagePath' => $rel,
            'checksum' => hash_file('sha256', self::dir() . "/$rel"),
            'inline' => $inline,
            'uploadedById' => $user['id'],
        ]);
        return [...$att, 'url' => self::publicUrl($id)];
    }

    private static function find(string $id): array
    {
        $att = Db::find('attachments', $id) ?? not_found('Attachment not found');
        $deleted = Db::q('SELECT deleted_at FROM subjects WHERE id = ?', [$att['subjectId']])[0] ?? null;
        if (!$deleted || $deleted['deleted_at'] !== null) not_found('Attachment not found');
        return $att;
    }

    public static function download(array $user, string $id): RawResponse
    {
        $att = self::find($id);
        $access = Access::require($att['subjectId'], $user, 'preview');
        if ($access['previewOnly']) {
            $node = $att['nodeId'] ? Db::find('content_nodes', $att['nodeId']) : null;
            if (!$node || !Content::isPreviewVisible($node)) forbidden('You need access to this subject');
        }
        return self::stream($att, $att['contentType'] ?: 'application/octet-stream', false);
    }

    /** Capability URL used for images embedded in rich content. */
    public static function raw(string $id, ?string $sig): RawResponse
    {
        if (!hash_equals(self::sign($id), (string) $sig)) not_found();
        $att = self::find($id);
        // Only images render inline; anything else downloads so it can't run on our origin.
        $isImage = (bool) preg_match(self::INLINE_TYPES, (string) $att['contentType']);
        return self::stream($att, $isImage ? $att['contentType'] : 'application/octet-stream', $isImage, [
            'Cache-Control: private, max-age=86400',
            'X-Content-Type-Options: nosniff',
        ]);
    }

    private static function stream(array $att, string $type, bool $inline, array $extra = []): RawResponse
    {
        $path = self::dir() . '/' . $att['storagePath'];
        if (!is_file($path)) not_found('File is missing on the server');
        // Like Express, text types are sent as UTF-8.
        if (str_starts_with($type, 'text/') && !str_contains($type, 'charset')) $type .= '; charset=utf-8';
        return new RawResponse(function () use ($att, $type, $inline, $extra, $path) {
            ini_set('default_charset', '');
            header('Content-Type: ' . $type);
            header('Content-Disposition: ' . ($inline ? 'inline' : 'attachment') . "; filename*=UTF-8''" . rawurlencode($att['filename']));
            header('Content-Length: ' . filesize($path));
            foreach ($extra as $h) header($h);
            readfile($path);
        });
    }

    public static function remove(array $user, string $id): array
    {
        $att = self::find($id);
        Access::require($att['subjectId'], $user, 'manage');
        Db::run('DELETE FROM attachments WHERE id = ?', [$id]);
        @unlink(self::dir() . '/' . $att['storagePath']);
        return ['ok' => true];
    }
}

final class Admin
{
    public static function stats(): array
    {
        $today = today();
        return [
            'today' => $today,
            'users' => Db::count('SELECT COUNT(*) FROM users WHERE deleted_at IS NULL'),
            'admins' => Db::count("SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND role = 'ADMIN'"),
            'subjects' => Db::count('SELECT COUNT(*) FROM subjects WHERE deleted_at IS NULL'),
            'catalog' => Db::count("SELECT COUNT(*) FROM subjects WHERE deleted_at IS NULL AND status = 'PUBLISHED' AND visibility IN ('PUBLIC','LISTED')"),
            'tasks' => Db::count('SELECT COUNT(*) FROM tasks WHERE deleted_at IS NULL AND active = 1'),
            'dueToday' => Db::count('SELECT COUNT(*) FROM task_occurrences WHERE due_date = ?', [$today]),
            'doneToday' => Db::count("SELECT COUNT(*) FROM task_occurrences WHERE due_date = ? AND status = 'COMPLETED'", [$today]),
            'pendingAccess' => Db::count("SELECT COUNT(*) FROM access_requests WHERE status = 'PENDING'"),
            'pendingChanges' => Db::count("SELECT COUNT(*) FROM change_requests WHERE status = 'PENDING'"),
        ];
    }

    public static function listUsers(?string $q): array
    {
        $where = '1 = 1';
        $params = [];
        if ($q) {
            $where = '(u.name LIKE ? OR u.username LIKE ? OR u.email LIKE ?)';
            $params = [like($q), like(strtolower($q)), like(strtolower($q))];
        }
        $rows = Db::q(
            "SELECT u.id, u.email, u.username, u.name, u.role, u.level, u.total_xp, u.created_at, u.deleted_at,
                (SELECT COUNT(*) FROM subjects s WHERE s.owner_id = u.id AND s.deleted_at IS NULL) AS subject_count,
                (SELECT COUNT(*) FROM subject_members m WHERE m.user_id = u.id) AS shared_count,
                (SELECT COUNT(*) FROM tasks t WHERE t.assignee_id = u.id AND t.deleted_at IS NULL AND t.active = 1) AS task_count
             FROM users u WHERE $where ORDER BY u.created_at ASC LIMIT 500",
            $params,
        );
        return array_map(function ($r) {
            $u = Db::hydrate('users', $r);
            return [
                'id' => $u['id'],
                'email' => $u['email'],
                'username' => $u['username'],
                'name' => $u['name'],
                'role' => $u['role'],
                'level' => $u['level'],
                'totalXp' => $u['totalXp'],
                'createdAt' => $u['createdAt'],
                'active' => $u['deletedAt'] === null,
                'subjectCount' => (int) $r['subject_count'],
                'sharedCount' => (int) $r['shared_count'],
                'taskCount' => (int) $r['task_count'],
            ];
        }, $rows);
    }

    public static function createUser(array $body): array
    {
        $dto = V::check($body, [
            'email' => ['email'],
            'username' => ['regex' => V::USERNAME],
            'name' => ['string', 'min' => 2, 'max' => 80],
            'password' => ['string', 'min' => 6],
            'role' => ['optional', 'in' => ['ADMIN', 'USER']],
        ]);
        return Auth::publicUser(Auth::createUser($dto));
    }

    public static function updateUser(array $admin, string $id, array $body): array
    {
        $dto = V::check($body, [
            'name' => ['optional', 'string', 'min' => 2, 'max' => 80],
            'role' => ['optional', 'in' => ['ADMIN', 'USER']],
            'password' => ['optional', 'string', 'min' => 6],
            'active' => ['optional', 'bool'],
        ]);
        if (!Db::scalar('SELECT 1 FROM users WHERE id = ?', [$id])) not_found('User not found');
        if ($id === $admin['id'] && (($dto['role'] ?? null) === 'USER' || ($dto['active'] ?? null) === false)) {
            bad_request("You can't demote or deactivate yourself");
        }
        $data = [];
        if (!empty($dto['name'])) $data['name'] = $dto['name'];
        if (!empty($dto['role'])) $data['role'] = $dto['role'];
        if (!empty($dto['password'])) {
            $data['passwordHash'] = bcrypt_hash($dto['password']);
            $data['refreshToken'] = null;
        }
        if (array_key_exists('active', $dto) && $dto['active'] !== null) {
            $data['deletedAt'] = $dto['active'] ? null : now_db();
            if (!$dto['active']) $data['refreshToken'] = null;
        }
        return Auth::publicUser(Db::update('users', $id, $data));
    }

    public static function userDetail(string $id): array
    {
        $user = Db::find('users', $id) ?? not_found('User not found');
        $owned = Db::rows(
            'subjects',
            'SELECT id, title, visibility, status, updated_at FROM subjects WHERE owner_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC',
            [$id],
        );
        $members = Db::rows(
            'subject_members',
            'SELECT m.* FROM subject_members m JOIN subjects s ON s.id = m.subject_id WHERE m.user_id = ? AND s.deleted_at IS NULL',
            [$id],
        );
        $sIds = array_column($members, 'subjectId');
        $subjects = $sIds ? index_by(Db::rows('subjects', 'SELECT id, title, visibility, owner_id FROM subjects WHERE id IN (' . marks($sIds) . ')', $sIds)) : [];
        $users = user_summaries([...array_column($subjects, 'ownerId'), ...array_column($members, 'grantedById')]);
        $memberships = array_map(function ($m) use ($subjects, $users) {
            $s = $subjects[$m['subjectId']];
            return [
                ...$m,
                'subject' => ['id' => $s['id'], 'title' => $s['title'], 'visibility' => $s['visibility'], 'owner' => $users[$s['ownerId']] ?? null],
                'grantedBy' => $m['grantedById'] ? ($users[$m['grantedById']] ?? null) : null,
            ];
        }, $members);
        $streak = Db::scalar("SELECT current_count FROM streaks WHERE user_id = ? AND type = 'daily' LIMIT 1", [$id]);
        return [
            ...Auth::publicUser($user),
            'active' => $user['deletedAt'] === null,
            'createdAt' => $user['createdAt'],
            'streak' => $streak === null ? 0 : (int) $streak,
            'owned' => $owned,
            'memberships' => $memberships,
        ];
    }

    public static function pendingAccessRequests(): array
    {
        $reqs = Db::rows(
            'access_requests',
            "SELECT r.* FROM access_requests r JOIN subjects s ON s.id = r.subject_id
             WHERE r.status = 'PENDING' AND s.deleted_at IS NULL ORDER BY r.created_at ASC",
        );
        $users = user_summaries(array_column($reqs, 'userId'));
        $subjects = Refs::subjects(array_column($reqs, 'subjectId'));
        return array_map(fn($r) => [
            ...$r,
            'user' => $users[$r['userId']] ?? null,
            'subject' => pick($subjects[$r['subjectId']] ?? null, ['id', 'title']),
        ], $reqs);
    }

    public static function pendingChanges(): array
    {
        $rows = Db::q(
            "SELECT c.id, c.action, c.change_note, c.created_at, c.author_id, c.subject_id, c.node_id, s.title AS subject_title, s.owner_id
             FROM change_requests c JOIN subjects s ON s.id = c.subject_id
             WHERE c.status = 'PENDING' AND s.deleted_at IS NULL ORDER BY c.created_at ASC",
        );
        $users = user_summaries([...array_column($rows, 'author_id'), ...array_column($rows, 'owner_id')]);
        $nIds = array_values(array_filter(array_column($rows, 'node_id')));
        $nodes = $nIds ? index_by(Db::rows('content_nodes', 'SELECT id, title, type FROM content_nodes WHERE id IN (' . marks($nIds) . ')', $nIds)) : [];
        return array_map(fn($r) => [
            'id' => $r['id'],
            'action' => $r['action'],
            'changeNote' => $r['change_note'],
            'createdAt' => iso($r['created_at']),
            'author' => $users[$r['author_id']] ?? null,
            'subject' => ['id' => $r['subject_id'], 'title' => $r['subject_title'], 'owner' => $users[$r['owner_id']] ?? null],
            'node' => $r['node_id'] ? ($nodes[$r['node_id']] ?? null) : null,
        ], $rows);
    }

    /** Username lookup for sharing/assigning; available to every signed-in user. */
    public static function searchUsers(string $me, ?string $q): array
    {
        $term = preg_replace('/^@/', '', strtolower(trim((string) $q)));
        if (mb_strlen($term) < 2) return [];
        return Db::rows(
            'users',
            'SELECT id, username, name FROM users WHERE deleted_at IS NULL AND id <> ? AND (username LIKE ? OR name LIKE ?) LIMIT 8',
            [$me, addcslashes($term, '%_\\') . '%', like($term)],
        );
    }
}
