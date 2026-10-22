<?php
declare(strict_types=1);

// --------------------------------------------------------------- schedule
// A rule is frequency, weekdays ("0,3"), monthDay, intervalDays, startDate
// and endDate ('Y-m-d' or null).

final class Schedule
{
    private const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    public static function ruleOf(array $t): array
    {
        return [
            'frequency' => $t['frequency'],
            'weekdays' => $t['weekdays'] ?? null,
            'monthDay' => $t['monthDay'] ?? null,
            'intervalDays' => $t['intervalDays'] ?? null,
            'startDate' => ymd($t['startDate']),
            'endDate' => ymd($t['endDate'] ?? null),
        ];
    }

    public static function weekdayList(?string $weekdays): array
    {
        return array_map('intval', array_values(array_filter(explode(',', (string) $weekdays), fn($d) => $d !== '')));
    }

    /** Does the rule produce an occurrence on this day? */
    public static function occursOn(array $r, string $day): bool
    {
        if ($day < $r['startDate']) return false;
        if ($r['endDate'] && $day > $r['endDate']) return false;
        return match ($r['frequency']) {
            'ONCE' => $day === $r['startDate'],
            'DAILY' => true,
            'WEEKLY' => in_array(week_day($day), self::weekdayList($r['weekdays']), true),
            'MONTHLY' => month_day($day) === min($r['monthDay'] ?? 1, days_in_month($day)),
            'CUSTOM' => diff_days($day, $r['startDate']) % max(1, $r['intervalDays'] ?? 1) === 0,
            default => false,
        };
    }

    public static function datesBetween(array $r, string $from, string $to): array
    {
        $out = [];
        for ($d = $from; $d <= $to; $d = add_days($d, 1)) {
            if (self::occursOn($r, $d)) $out[] = $d;
        }
        return $out;
    }

    public static function next(array $r, string $after, int $horizonDays = 400): ?string
    {
        $start = $after < $r['startDate'] ? $r['startDate'] : $after;
        for ($i = 0; $i <= $horizonDays; $i++) {
            $d = add_days($start, $i);
            if ($r['endDate'] && $d > $r['endDate']) return null;
            if (self::occursOn($r, $d)) return $d;
        }
        return null;
    }

    public static function describe(array $r): string
    {
        return match ($r['frequency']) {
            'ONCE' => 'Once on ' . $r['startDate'],
            'DAILY' => 'Every day',
            'WEEKLY' => 'Weekly on ' . implode(', ', array_map(fn($d) => self::DAY_NAMES[$d] ?? '', self::weekdayList($r['weekdays']))),
            'MONTHLY' => 'Monthly on day ' . ($r['monthDay'] ?? 'null'),
            'CUSTOM' => $r['intervalDays'] === 1 ? 'Every day' : 'Every ' . ($r['intervalDays'] ?? 'null') . ' days',
            default => '',
        };
    }

    /** "1,3,5" from a list of weekday numbers, de-duplicated and sorted. */
    public static function weekdayString(array $days): string
    {
        $u = array_values(array_unique($days));
        sort($u, SORT_STRING);
        return implode(',', $u);
    }
}

// ------------------------------------------------------- shared lookups

final class Refs
{
    private static array $nodes = [];

    /** Loads id, title, type, parent_id of the given nodes and their two ancestor levels. */
    private static function loadNodes(array $ids): void
    {
        for ($level = 0; $level < 3; $level++) {
            $ids = array_values(array_unique(array_filter($ids, fn($id) => $id && !array_key_exists($id, self::$nodes))));
            if (!$ids) return;
            foreach ($ids as $id) self::$nodes[$id] = null;
            $next = [];
            foreach (Db::q('SELECT id, title, type, parent_id FROM content_nodes WHERE id IN (' . marks($ids) . ')', $ids) as $n) {
                self::$nodes[$n['id']] = $n;
                if ($n['parent_id']) $next[] = $n['parent_id'];
            }
            $ids = $next;
        }
    }

    /** Node with its parent and grandparent, shaped like the Prisma NODE_CHAIN select. */
    public static function chain(?string $id, int $depth = 0): ?array
    {
        if (!$id) return null;
        if (!array_key_exists($id, self::$nodes)) self::loadNodes([$id]);
        $n = self::$nodes[$id] ?? null;
        if (!$n) return null;
        $out = ['id' => $n['id'], 'title' => $n['title'], 'type' => $n['type']];
        if ($depth < 2) $out['parent'] = self::chain($n['parent_id'], $depth + 1);
        return $out;
    }

    /** Subject › Chapter › Topic › Subtopic, down to the given node. */
    public static function breadcrumb(array $subject, ?array $node): array
    {
        $chain = [];
        for ($n = $node; $n; $n = $n['parent'] ?? null) {
            array_unshift($chain, ['id' => $n['id'], 'title' => $n['title'], 'type' => $n['type']]);
        }
        return [['id' => $subject['id'], 'title' => $subject['title'], 'type' => 'SUBJECT'], ...$chain];
    }

    public static function subjects(array $ids): array
    {
        $ids = array_values(array_unique(array_filter($ids)));
        return $ids ? index_by(Db::rows('subjects', 'SELECT id, title, color FROM subjects WHERE id IN (' . marks($ids) . ')', $ids)) : [];
    }

    /** Adds subject, node, createdBy and assignee like TASK_INCLUDE. */
    public static function withTaskRefs(array $tasks): array
    {
        self::loadNodes(array_column($tasks, 'nodeId'));
        $subjects = self::subjects(array_column($tasks, 'subjectId'));
        $users = user_summaries([...array_column($tasks, 'createdById'), ...array_column($tasks, 'assigneeId')]);
        return array_map(fn($t) => [
            ...$t,
            'subject' => $subjects[$t['subjectId']] ?? null,
            'node' => self::chain($t['nodeId']),
            'createdBy' => $users[$t['createdById']] ?? null,
            'assignee' => $users[$t['assigneeId']] ?? null,
        ], $tasks);
    }
}

// ------------------------------------------------------------------ tasks

final class Tasks
{
    /** How far back missed occurrences are back-filled as overdue. */
    private const BACKFILL_DAYS = 30;
    private const UPCOMING_DAYS = 14;

    public static function scheduleSpec(): array
    {
        return [
            'frequency' => ['in' => V::FREQUENCY],
            'weekdays' => ['optional', 'array', 'each' => 'int', 'eachgte' => 0, 'eachlte' => 6],
            'monthDay' => ['optional', 'int', 'gte' => 1, 'lte' => 31],
            'intervalDays' => ['optional', 'int', 'gte' => 1, 'lte' => 365],
            'startDate' => ['date'],
            'endDate' => ['optional', 'date'],
        ];
    }

    private static function fieldsSpec(): array
    {
        return [
            'title' => ['string', 'min' => 2, 'max' => 191],
            'instructions' => ['optional', 'string'],
            'difficulty' => ['optional', 'in' => V::DIFFICULTY],
            'estimatedMins' => ['optional', 'int', 'gte' => 1, 'lte' => 1440],
            'xpReward' => ['optional', 'int', 'gte' => 0, 'lte' => 1000],
        ];
    }

    private static function ruleFromDto(array $s): array
    {
        $start = substr($s['startDate'], 0, 10);
        $end = !empty($s['endDate']) ? substr($s['endDate'], 0, 10) : null;
        if ($end && $end < $start) bad_request('End date must be after the start date');
        $rule = [
            'frequency' => $s['frequency'],
            'weekdays' => null,
            'monthDay' => null,
            'intervalDays' => null,
            'startDate' => $start,
            'endDate' => $s['frequency'] === 'ONCE' ? null : $end,
        ];
        if ($s['frequency'] === 'WEEKLY') {
            if (empty($s['weekdays'])) bad_request('Pick at least one weekday');
            $rule['weekdays'] = Schedule::weekdayString($s['weekdays']);
        }
        if ($s['frequency'] === 'MONTHLY') $rule['monthDay'] = $s['monthDay'] ?? month_day($start);
        if ($s['frequency'] === 'CUSTOM') {
            if (empty($s['intervalDays'])) bad_request('Set how many days between practice');
            $rule['intervalDays'] = $s['intervalDays'];
        }
        return $rule;
    }

    // ------------------------------------------------------- definitions

    public static function create(array $user, array $body): array
    {
        $dto = V::check($body, [
            'subjectId' => ['string'],
            'nodeId' => ['optional', 'string'],
            ...self::fieldsSpec(),
            'assignees' => ['optional', 'array', 'arrmax' => 100, 'each' => 'string'],
            'schedule' => ['nested' => self::scheduleSpec()],
        ]);
        $isAdmin = $user['role'] === 'ADMIN';
        $access = Access::require($dto['subjectId'], $user, 'view');
        if (!empty($dto['nodeId'])) Content::findNode($dto['subjectId'], $dto['nodeId']);
        $rule = self::ruleFromDto($dto['schedule']);

        $assignees = [['id' => $user['id'], 'username' => $user['username']]];
        if (!empty($dto['assignees'])) {
            $names = array_values(array_unique(array_map(fn($u) => preg_replace('/^@/', '', strtolower(trim($u))), $dto['assignees'])));
            $selfOnly = count($names) === 1 && $names[0] === $user['username'];
            if (!$selfOnly && !$isAdmin) forbidden('Only admins can assign tasks to other users');
            $assignees = Db::q('SELECT id, username FROM users WHERE username IN (' . marks($names) . ') AND deleted_at IS NULL', $names);
            $missing = array_values(array_diff($names, array_column($assignees, 'username')));
            if ($missing) not_found('Unknown username: ' . implode(', ', array_map(fn($m) => "@$m", $missing)));
        }

        $instructions = Sanitizer::rich($dto['instructions'] ?? null);
        $title = trim($dto['title']);
        $created = [];
        foreach ($assignees as $a) {
            // The assignee needs to be able to read what they're practising.
            if ($a['id'] !== $user['id']) Access::ensureViewer($dto['subjectId'], $a['id'], $user['id']);
            $created[] = Db::insert('tasks', [
                'subjectId' => $dto['subjectId'],
                'nodeId' => ($dto['nodeId'] ?? null) ?: null,
                'createdById' => $user['id'],
                'assigneeId' => $a['id'],
                'title' => $title,
                'instructions' => $instructions,
                'difficulty' => $dto['difficulty'] ?? 'beginner',
                'estimatedMins' => $dto['estimatedMins'] ?? null,
                'xpReward' => $dto['xpReward'] ?? 10,
                ...$rule,
            ]);
        }
        $others = array_values(array_filter(array_column($assignees, 'id'), fn($id) => $id !== $user['id']));
        Notifications::notify($others, [
            'title' => 'New practice task assigned',
            'message' => "{$user['name']} assigned \"$title\" in \"{$access['subject']['title']}\" (" . Schedule::describe($rule) . ').',
            'type' => 'assign',
            'link' => '/tasks',
        ]);
        return $created;
    }

    public static function list(array $user, array $query): array
    {
        $q = V::check($query, [
            'scope' => ['optional', 'in' => ['mine', 'assigned', 'all']],
            'assigneeId' => ['optional', 'string'],
            'subjectId' => ['optional', 'string'],
        ]);
        $where = ['t.deleted_at IS NULL'];
        $params = [];
        switch ($q['scope'] ?? 'mine') {
            case 'mine': $where[] = 't.assignee_id = ?'; $params[] = $user['id']; break;
            case 'assigned':
                $where[] = 't.created_by_id = ? AND t.assignee_id <> ?';
                array_push($params, $user['id'], $user['id']);
                break;
            case 'all':
                if ($user['role'] !== 'ADMIN') forbidden();
                if (!empty($q['assigneeId'])) { $where[] = 't.assignee_id = ?'; $params[] = $q['assigneeId']; }
                break;
        }
        if (!empty($q['subjectId'])) { $where[] = 't.subject_id = ?'; $params[] = $q['subjectId']; }

        $rows = Db::q(
            "SELECT t.*, (SELECT COUNT(*) FROM task_occurrences o WHERE o.task_id = t.id AND o.status = 'COMPLETED') AS completed_count
             FROM tasks t WHERE " . implode(' AND ', $where) . ' ORDER BY t.created_at DESC LIMIT 300',
            $params,
        );
        $counts = array_column($rows, 'completed_count', 'id');
        $tasks = Refs::withTaskRefs(array_map(function ($r) {
            unset($r['completed_count']);
            return Db::hydrate('tasks', $r);
        }, $rows));
        $today = today();
        return array_map(fn($t) => [
            ...self::present($t, $user),
            'completedCount' => (int) $counts[$t['id']],
            'nextDue' => $t['active'] ? Schedule::next(Schedule::ruleOf($t), $today) : null,
        ], $tasks);
    }

    private static function findTask(string $id): ?array
    {
        $t = Db::row('tasks', 'SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL', [$id]);
        return $t ? Refs::withTaskRefs([$t])[0] : null;
    }

    public static function get(array $user, string $id): array
    {
        $task = self::findTask($id) ?? not_found('Task not found');
        if ($task['assigneeId'] !== $user['id'] && $task['createdById'] !== $user['id'] && $user['role'] !== 'ADMIN') {
            not_found('Task not found');
        }
        $occurrences = Db::rows('task_occurrences', 'SELECT * FROM task_occurrences WHERE task_id = ? ORDER BY due_date DESC LIMIT 30', [$id]);
        $occurrences = array_map(fn($o) => [
            ...$o,
            'feedback' => Db::rows('feedback', 'SELECT * FROM feedback WHERE occurrence_id = ? ORDER BY created_at DESC LIMIT 1', [$o['id']]),
        ], $occurrences);
        return [...self::present($task, $user), 'occurrences' => $occurrences];
    }

    public static function update(array $user, string $id, array $body): array
    {
        $fields = self::fieldsSpec();
        array_unshift($fields['title'], 'optional');
        $dto = V::check($body, [
            ...$fields,
            'nodeId' => ['optional', 'string'],
            'schedule' => ['optional', 'nested' => self::scheduleSpec()],
            'active' => ['optional'],
        ]);
        $task = self::requireEditable($user, $id);
        $data = [];
        if (array_key_exists('title', $dto)) $data['title'] = trim((string) $dto['title']);
        if (array_key_exists('instructions', $dto)) $data['instructions'] = Sanitizer::rich($dto['instructions']);
        foreach (['difficulty', 'estimatedMins', 'xpReward'] as $k) if (array_key_exists($k, $dto)) $data[$k] = $dto[$k];
        if (array_key_exists('active', $dto)) $data['active'] = (bool) $dto['active'];
        if (array_key_exists('nodeId', $dto)) {
            if ($dto['nodeId']) Content::findNode($task['subjectId'], $dto['nodeId']);
            $data['nodeId'] = $dto['nodeId'] ?: null;
        }
        if (!empty($dto['schedule'])) {
            $data = [...$data, ...self::ruleFromDto($dto['schedule'])];
            // Re-evaluate from today; past occurrences stay as history.
            $data['generatedThru'] = add_days(today(), -1);
            Db::run("DELETE FROM task_occurrences WHERE task_id = ? AND status = 'PENDING' AND due_date >= ?", [$id, today()]);
        }
        Db::update('tasks', $id, $data);
        return self::get($user, $id);
    }

    public static function remove(array $user, string $id): array
    {
        self::requireEditable($user, $id);
        Db::update('tasks', $id, ['deletedAt' => now_db(), 'active' => false]);
        return ['ok' => true];
    }

    /** Creator or admin. Assignees can't change what an admin assigned them. */
    private static function requireEditable(array $user, string $id): array
    {
        $task = Db::row('tasks', 'SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL', [$id]) ?? not_found('Task not found');
        if ($task['createdById'] !== $user['id'] && $user['role'] !== 'ADMIN') {
            forbidden($task['assigneeId'] === $user['id']
                ? 'This task was assigned to you; only the person who assigned it can change it'
                : 'Not allowed');
        }
        return $task;
    }

    public static function present(array $t, array $user): array
    {
        $out = $t;
        unset($out['generatedThru']);
        return [
            ...$out,
            'startDate' => ymd($t['startDate']),
            'endDate' => ymd($t['endDate']),
            'weekdays' => Schedule::weekdayList($t['weekdays']),
            'scheduleLabel' => Schedule::describe(Schedule::ruleOf($t)),
            'breadcrumb' => Refs::breadcrumb($t['subject'], $t['node']),
            'assignedByOther' => $t['createdById'] !== $t['assigneeId'],
            'canEdit' => $t['createdById'] === $user['id'] || $user['role'] === 'ADMIN',
        ];
    }

    public static function presentLite(array $t): array
    {
        return [
            'id' => $t['id'],
            'title' => $t['title'],
            'difficulty' => $t['difficulty'],
            'estimatedMins' => $t['estimatedMins'],
            'xpReward' => $t['xpReward'],
            'frequency' => $t['frequency'],
            'scheduleLabel' => Schedule::describe(Schedule::ruleOf($t)),
            'breadcrumb' => Refs::breadcrumb($t['subject'], $t['node']),
            'subject' => $t['subject'],
            'createdBy' => $t['createdBy'],
            'assignedByOther' => $t['createdById'] !== $t['assigneeId'],
        ];
    }

    // ------------------------------------------------------- occurrences

    /** Materialises due occurrences up to today (back-filling missed days). */
    public static function ensureOccurrences(string $userId): void
    {
        $today = today();
        $tasks = Db::rows(
            'tasks',
            'SELECT * FROM tasks WHERE assignee_id = ? AND active = 1 AND deleted_at IS NULL AND start_date <= ?
             AND (generated_thru IS NULL OR generated_thru < ?)',
            [$userId, $today, $today],
        );
        $floor = add_days($today, -self::BACKFILL_DAYS);
        foreach ($tasks as $t) {
            $from = $t['generatedThru'] ? add_days(ymd($t['generatedThru']), 1) : ymd($t['startDate']);
            if ($from < $floor) $from = $floor;
            $now = now_db();
            foreach (Schedule::datesBetween(Schedule::ruleOf($t), $from, $today) as $due) {
                Db::run(
                    "INSERT IGNORE INTO task_occurrences (id, task_id, user_id, due_date, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'PENDING', ?, ?)",
                    [uuid(), $t['id'], $userId, $due, $now, $now],
                );
            }
            Db::update('tasks', $t['id'], ['generatedThru' => $today]);
        }
    }

    /** Occurrence rows with their task (TASK_INCLUDE). */
    private static function withTasks(array $occs): array
    {
        $ids = array_values(array_unique(array_column($occs, 'taskId')));
        $tasks = $ids ? index_by(Refs::withTaskRefs(Db::rows('tasks', 'SELECT * FROM tasks WHERE id IN (' . marks($ids) . ')', $ids))) : [];
        return array_map(fn($o) => [...$o, 'task' => $tasks[$o['taskId']]], $occs);
    }

    public static function agenda(string $userId): array
    {
        self::ensureOccurrences($userId);
        $today = today();
        $todayItems = self::withTasks(Db::rows(
            'task_occurrences',
            'SELECT o.* FROM task_occurrences o JOIN tasks t ON t.id = o.task_id
             WHERE o.user_id = ? AND o.due_date = ? AND t.deleted_at IS NULL ORDER BY o.created_at ASC',
            [$userId, $today],
        ));
        $overdue = self::withTasks(Db::rows(
            'task_occurrences',
            "SELECT o.* FROM task_occurrences o JOIN tasks t ON t.id = o.task_id
             WHERE o.user_id = ? AND o.due_date < ? AND o.status IN ('PENDING','IN_PROGRESS') AND t.deleted_at IS NULL AND t.active = 1
             ORDER BY o.due_date DESC LIMIT 50",
            [$userId, $today],
        ));
        $active = Refs::withTaskRefs(Db::rows('tasks', 'SELECT * FROM tasks WHERE assignee_id = ? AND active = 1 AND deleted_at IS NULL', [$userId]));

        // Future occurrences are computed, not stored.
        $upcoming = [];
        foreach ($active as $t) {
            foreach (Schedule::datesBetween(Schedule::ruleOf($t), add_days($today, 1), add_days($today, self::UPCOMING_DAYS)) as $d) {
                $upcoming[] = ['dueDate' => $d, 'task' => self::presentLite($t)];
            }
        }
        usort($upcoming, fn($a, $b) => strcmp($a['dueDate'], $b['dueDate']));

        $shape = fn($o) => [
            'id' => $o['id'],
            'status' => $o['status'],
            'dueDate' => ymd($o['dueDate']),
            'completedAt' => $o['completedAt'],
            'task' => self::presentLite($o['task']),
        ];
        return [
            'today' => $today,
            'todayItems' => array_map($shape, $todayItems),
            'overdue' => array_map($shape, $overdue),
            'upcoming' => $upcoming,
        ];
    }

    public static function getOccurrence(array $user, string $id): array
    {
        $occ = Db::find('task_occurrences', $id);
        if (!$occ || ($occ['userId'] !== $user['id'] && $user['role'] !== 'ADMIN')) not_found('Practice item not found');
        $occ = self::withTasks([$occ])[0];
        $occ['taskSessions'] = Db::rows('task_sessions', 'SELECT * FROM task_sessions WHERE occurrence_id = ? ORDER BY started_at DESC LIMIT 10', [$id]);
        $occ['feedback'] = Db::rows('feedback', 'SELECT * FROM feedback WHERE occurrence_id = ? ORDER BY created_at DESC', [$id]);
        $history = Db::rows(
            'feedback',
            'SELECT f.* FROM feedback f JOIN task_occurrences o ON o.id = f.occurrence_id
             WHERE o.task_id = ? AND f.occurrence_id <> ? ORDER BY f.created_at DESC LIMIT 5',
            [$occ['taskId'], $occ['id']],
        );
        return [
            ...$occ,
            'dueDate' => ymd($occ['dueDate']),
            'task' => self::present($occ['task'], $user),
            'previousFeedback' => $history,
        ];
    }

    private static function requireOwnOccurrence(array $user, string $id): array
    {
        $occ = Db::find('task_occurrences', $id);
        if (!$occ || $occ['userId'] !== $user['id']) not_found('Practice item not found');
        return $occ;
    }

    public static function start(array $user, string $occurrenceId): array
    {
        $occ = self::requireOwnOccurrence($user, $occurrenceId);
        if ($occ['status'] === 'COMPLETED') bad_request('Already completed');
        $active = Db::row('task_sessions', "SELECT * FROM task_sessions WHERE occurrence_id = ? AND status = 'active' LIMIT 1", [$occurrenceId]);
        if ($active) return $active;
        Db::update('task_occurrences', $occurrenceId, ['status' => 'IN_PROGRESS']);
        return Db::insert('task_sessions', ['occurrenceId' => $occurrenceId, 'userId' => $user['id']]);
    }

    public static function finishSession(array $user, string $sessionId): array
    {
        $s = Db::find('task_sessions', $sessionId);
        if (!$s || $s['userId'] !== $user['id']) not_found('Session not found');
        if ($s['status'] !== 'active') return $s;
        return self::closeSession($s);
    }

    /** Marks an active session completed with its duration in seconds. */
    public static function closeSession(array $s): array
    {
        $now = now_db();
        return Db::update('task_sessions', $s['id'], [
            'finishedAt' => $now,
            'duration' => intdiv(ms_of($now) - ms_of($s['startedAt']), 1000),
            'status' => 'completed',
        ]);
    }

    public static function skip(array $user, string $occurrenceId): array
    {
        $occ = self::requireOwnOccurrence($user, $occurrenceId);
        if ($occ['status'] === 'COMPLETED') bad_request('Already completed');
        Db::updateWhere('task_sessions', ['status' => 'abandoned', 'finishedAt' => now_db()], "occurrence_id = ? AND status = 'active'", [$occurrenceId]);
        return Db::update('task_occurrences', $occurrenceId, ['status' => 'SKIPPED']);
    }

    /** Practice history for one user (admin view or own). */
    public static function history(array $user, string $userId): array
    {
        if ($userId !== $user['id'] && $user['role'] !== 'ADMIN') forbidden();
        $items = self::withTasks(Db::rows(
            'task_occurrences',
            "SELECT * FROM task_occurrences WHERE user_id = ? AND status IN ('COMPLETED','SKIPPED') ORDER BY due_date DESC LIMIT 50",
            [$userId],
        ));
        return array_map(function ($o) {
            $fb = Db::scalar('SELECT confidence_level FROM feedback WHERE occurrence_id = ? ORDER BY created_at DESC LIMIT 1', [$o['id']]);
            return [
                'id' => $o['id'],
                'status' => $o['status'],
                'dueDate' => ymd($o['dueDate']),
                'completedAt' => $o['completedAt'],
                'confidence' => $fb === null ? null : (int) $fb,
                'task' => self::presentLite($o['task']),
            ];
        }, $items);
    }
}

// -------------------------------------------------------------- templates

/**
 * Auto-assigned tasks: an admin defines the task once, and each learner gets
 * their own copy when they complete the trigger (a chapter, topic, or the
 * whole subject). The copy's schedule starts relative to that day.
 */
final class Templates
{
    private static function relativeSpec(): array
    {
        return [
            'frequency' => ['in' => V::FREQUENCY],
            'weekdays' => ['optional', 'array', 'each' => 'int', 'eachgte' => 0, 'eachlte' => 6],
            'monthDay' => ['optional', 'int', 'gte' => 1, 'lte' => 31],
            'intervalDays' => ['optional', 'int', 'gte' => 1, 'lte' => 365],
            'startAfterDays' => ['int', 'gte' => 0, 'lte' => 365],
            'durationDays' => ['optional', 'int', 'gte' => 1, 'lte' => 3650],
        ];
    }

    private static function ruleFromRelative(array $s): array
    {
        $rule = [
            'frequency' => $s['frequency'],
            'weekdays' => null,
            'monthDay' => null,
            'intervalDays' => null,
            'startAfterDays' => $s['startAfterDays'],
            'durationDays' => $s['frequency'] === 'ONCE' ? null : ($s['durationDays'] ?? null),
        ];
        if ($s['frequency'] === 'WEEKLY') {
            if (empty($s['weekdays'])) bad_request('Pick at least one weekday');
            $rule['weekdays'] = Schedule::weekdayString($s['weekdays']);
        }
        if ($s['frequency'] === 'MONTHLY') $rule['monthDay'] = $s['monthDay'] ?? 1;
        if ($s['frequency'] === 'CUSTOM') {
            if (empty($s['intervalDays'])) bad_request('Set how many days between practice');
            $rule['intervalDays'] = $s['intervalDays'];
        }
        return $rule;
    }

    private static function days(int $n): string
    {
        return $n . ' day' . ($n === 1 ? '' : 's');
    }

    /** e.g. "Every 2 days, from 1 day after completion, for 14 days". */
    public static function relativeLabel(array $t): string
    {
        $start = $t['startAfterDays'] ? self::days($t['startAfterDays']) . ' after completion' : 'on completion day';
        if ($t['frequency'] === 'ONCE') return "Once, $start";
        $base = Schedule::describe([...$t, 'startDate' => '1970-01-01', 'endDate' => null]);
        return "$base, from $start" . ($t['durationDays'] ? ', for ' . self::days($t['durationDays']) : '');
    }

    public static function list(?string $subjectId): array
    {
        $sql = 'SELECT * FROM task_templates WHERE deleted_at IS NULL';
        $params = [];
        if ($subjectId) { $sql .= ' AND subject_id = ?'; $params[] = $subjectId; }
        return array_map([self::class, 'present'], Db::rows('task_templates', "$sql ORDER BY created_at ASC", $params));
    }

    public static function create(array $user, array $body): array
    {
        $dto = V::check($body, [
            'subjectId' => ['string'],
            'nodeId' => ['optional', 'string'],
            'triggerNodeId' => ['optional', 'string'],
            'title' => ['string', 'min' => 2, 'max' => 191],
            'instructions' => ['optional', 'string'],
            'difficulty' => ['optional', 'in' => V::DIFFICULTY],
            'estimatedMins' => ['optional', 'int', 'gte' => 1, 'lte' => 1440],
            'xpReward' => ['optional', 'int', 'gte' => 0, 'lte' => 1000],
            'schedule' => ['nested' => self::relativeSpec()],
        ]);
        if (!Db::scalar('SELECT 1 FROM subjects WHERE id = ? AND deleted_at IS NULL', [$dto['subjectId']])) not_found('Subject not found');
        if (!empty($dto['nodeId'])) Content::findNode($dto['subjectId'], $dto['nodeId']);
        if (!empty($dto['triggerNodeId'])) Content::findNode($dto['subjectId'], $dto['triggerNodeId']);
        $t = Db::insert('task_templates', [
            'subjectId' => $dto['subjectId'],
            'nodeId' => ($dto['nodeId'] ?? null) ?: null,
            'triggerNodeId' => ($dto['triggerNodeId'] ?? null) ?: null,
            'createdById' => $user['id'],
            'title' => trim($dto['title']),
            'instructions' => Sanitizer::rich($dto['instructions'] ?? null),
            'difficulty' => $dto['difficulty'] ?? 'beginner',
            'estimatedMins' => $dto['estimatedMins'] ?? null,
            'xpReward' => $dto['xpReward'] ?? 10,
            ...self::ruleFromRelative($dto['schedule']),
        ]);
        return self::present($t);
    }

    /** Changes apply to learners who complete from now on; tasks already given out stay as they are. */
    public static function update(string $id, array $body): array
    {
        $dto = V::check($body, [
            'nodeId' => ['optional', 'string'],
            'triggerNodeId' => ['optional', 'string'],
            'title' => ['optional', 'string', 'min' => 2, 'max' => 191],
            'instructions' => ['optional', 'string'],
            'difficulty' => ['optional', 'in' => V::DIFFICULTY],
            'estimatedMins' => ['optional', 'int', 'gte' => 1, 'lte' => 1440],
            'xpReward' => ['optional', 'int', 'gte' => 0, 'lte' => 1000],
            'active' => ['optional', 'bool'],
            'schedule' => ['optional', 'nested' => self::relativeSpec()],
        ]);
        $t = self::requireTemplate($id);
        $data = [];
        if (array_key_exists('title', $dto)) $data['title'] = trim((string) $dto['title']);
        if (array_key_exists('instructions', $dto)) $data['instructions'] = Sanitizer::rich($dto['instructions']);
        foreach (['difficulty', 'estimatedMins', 'xpReward'] as $k) if (array_key_exists($k, $dto)) $data[$k] = $dto[$k];
        if (array_key_exists('active', $dto)) $data['active'] = (bool) $dto['active'];
        foreach (['nodeId', 'triggerNodeId'] as $k) {
            if (!array_key_exists($k, $dto)) continue;
            if ($dto[$k]) Content::findNode($t['subjectId'], $dto[$k]);
            $data[$k] = $dto[$k] ?: null;
        }
        if (!empty($dto['schedule'])) $data = [...$data, ...self::ruleFromRelative($dto['schedule'])];
        return self::present(Db::update('task_templates', $id, $data));
    }

    public static function remove(string $id): array
    {
        self::requireTemplate($id);
        Db::update('task_templates', $id, ['deletedAt' => now_db(), 'active' => false]);
        return ['ok' => true];
    }

    private static function requireTemplate(string $id): array
    {
        return Db::row('task_templates', 'SELECT * FROM task_templates WHERE id = ? AND deleted_at IS NULL', [$id])
            ?? not_found('Auto-assign task not found');
    }

    private static function present(array $t): array
    {
        $subject = Refs::subjects([$t['subjectId']])[$t['subjectId']] ?? null;
        $node = Refs::chain($t['nodeId']);
        $trigger = Refs::chain($t['triggerNodeId']);
        $users = user_summaries([$t['createdById']]);
        $assigned = Db::count('SELECT COUNT(*) FROM tasks WHERE template_id = ? AND deleted_at IS NULL', [$t['id']]);
        return [
            ...$t,
            'subject' => $subject,
            'node' => $node,
            'triggerNode' => $trigger,
            'createdBy' => $users[$t['createdById']] ?? null,
            'weekdays' => Schedule::weekdayList($t['weekdays']),
            'scheduleLabel' => self::relativeLabel($t),
            'breadcrumb' => Refs::breadcrumb($subject, $node),
            'trigger' => Refs::breadcrumb($subject, $trigger),
            'assignedCount' => $assigned,
        ];
    }

    /** Gives the learner every template whose trigger they have now fully completed. */
    public static function assignCompleted(string $userId, string $subjectId, array $progress): void
    {
        $templates = Db::rows(
            'task_templates',
            'SELECT tt.* FROM task_templates tt JOIN subjects s ON s.id = tt.subject_id
             WHERE tt.subject_id = ? AND tt.active = 1 AND tt.deleted_at IS NULL AND s.deleted_at IS NULL
             AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.template_id = tt.id AND t.assignee_id = ?)',
            [$subjectId, $userId],
        );
        $nodes = (array) $progress['nodes'];
        $due = array_filter($templates, fn($t) => $t['triggerNodeId']
            ? (($nodes[$t['triggerNodeId']]['state'] ?? null) === 'done')
            : $progress['state'] === 'done');
        if (!$due) return;

        $subjectTitle = (string) Db::scalar('SELECT title FROM subjects WHERE id = ?', [$subjectId]);
        $today = today();
        foreach ($due as $t) {
            $start = add_days($today, $t['startAfterDays']);
            try {
                Db::insert('tasks', [
                    'subjectId' => $t['subjectId'],
                    'nodeId' => $t['nodeId'],
                    'templateId' => $t['id'],
                    'createdById' => $t['createdById'],
                    'assigneeId' => $userId,
                    'title' => $t['title'],
                    'instructions' => $t['instructions'],
                    'difficulty' => $t['difficulty'],
                    'estimatedMins' => $t['estimatedMins'],
                    'xpReward' => $t['xpReward'],
                    'frequency' => $t['frequency'],
                    'weekdays' => $t['weekdays'],
                    'monthDay' => $t['monthDay'],
                    'intervalDays' => $t['intervalDays'],
                    'startDate' => $start,
                    'endDate' => $t['durationDays'] ? add_days($start, $t['durationDays'] - 1) : null,
                ], false);
            } catch (PDOException $e) {
                // Unique (template, assignee): a concurrent completion already assigned it.
                if (Db::isDuplicate($e)) continue;
                throw $e;
            }
            $triggerTitle = $t['triggerNodeId'] ? Db::scalar('SELECT title FROM content_nodes WHERE id = ?', [$t['triggerNodeId']]) : null;
            Notifications::notify($userId, [
                'title' => 'New practice unlocked',
                'message' => 'You finished "' . ($triggerTitle ?? $subjectTitle) . "\". \"{$t['title']}\" is now in your practice (" . self::relativeLabel($t) . ').',
                'type' => 'assign',
                'link' => '/tasks',
            ]);
        }
    }
}
