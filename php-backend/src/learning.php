<?php
declare(strict_types=1);

final class Feedback
{
    /** Submitting feedback completes the occurrence and awards XP. */
    public static function create(string $userId, array $body): array
    {
        $dto = V::check($body, [
            'occurrenceId' => ['uuid'],
            'whatWasDone' => ['optional', 'string'],
            'problemsFaced' => ['optional', 'string'],
            'commandsUsed' => ['optional', 'string'],
            'confidenceLevel' => ['int', 'gte' => 1, 'lte' => 5],
            'needsImprovement' => ['optional', 'string'],
            'notesForTomorrow' => ['optional', 'string'],
        ]);
        $occ = Db::find('task_occurrences', $dto['occurrenceId']);
        if (!$occ || $occ['userId'] !== $userId) not_found('Practice item not found');
        if ($occ['status'] === 'COMPLETED') bad_request('Already completed');
        $task = Db::find('tasks', $occ['taskId']);

        $active = Db::row('task_sessions', "SELECT * FROM task_sessions WHERE occurrence_id = ? AND status = 'active' LIMIT 1", [$occ['id']]);
        if ($active) Tasks::closeSession($active);

        $feedback = Db::insert('feedback', [...$dto, 'userId' => $userId]);
        Db::update('task_occurrences', $occ['id'], ['status' => 'COMPLETED', 'completedAt' => now_db()]);

        if ($task['xpReward']) Gamification::awardXp($userId, $task['xpReward'], 'task_completion', $occ['id']);
        Gamification::updateStreak($userId);
        self::updateLearningProgress($userId, $occ['id'], $task, $dto['confidenceLevel']);
        return $feedback;
    }

    public static function findByUser(string $userId): array
    {
        $items = Db::rows('feedback', 'SELECT * FROM feedback WHERE user_id = ? ORDER BY created_at DESC LIMIT 20', [$userId]);
        return array_map(function ($f) {
            $occ = Db::find('task_occurrences', $f['occurrenceId']);
            if ($occ) $occ['task'] = Db::row('tasks', 'SELECT id, title FROM tasks WHERE id = ?', [$occ['taskId']]);
            return [...$f, 'occurrence' => $occ];
        }, $items);
    }

    private static function updateLearningProgress(string $userId, string $occurrenceId, array $task, int $confidence): void
    {
        $timeSpent = (int) Db::scalar("SELECT COALESCE(SUM(duration), 0) FROM task_sessions WHERE occurrence_id = ? AND status = 'completed'", [$occurrenceId]);
        $scopeKey = $task['nodeId'] ?? $task['subjectId'];
        $existing = Db::row('learning_progress', 'SELECT * FROM learning_progress WHERE user_id = ? AND scope_key = ?', [$userId, $scopeKey]);
        $n = ($existing['tasksCompleted'] ?? 0) + 1;
        $avgConfidence = (($existing['avgConfidence'] ?? 0) * ($n - 1) + $confidence) / $n;
        $avgTimeSpent = (($existing['avgTimeSpent'] ?? 0) * ($n - 1) + $timeSpent) / $n;
        // Confidence-weighted, ramping up with practice count.
        $mastery = min(100, ($avgConfidence / 5) * 100 * ($n / ($n + 5)));
        $data = [
            'tasksCompleted' => $n,
            'avgConfidence' => $avgConfidence,
            'avgTimeSpent' => $avgTimeSpent,
            'mastery' => $mastery,
            'lastPracticedAt' => now_db(),
        ];
        if ($existing) Db::update('learning_progress', $existing['id'], $data);
        else Db::insert('learning_progress', ['userId' => $userId, 'subjectId' => $task['subjectId'], 'scopeKey' => $scopeKey, ...$data], false);
    }
}

final class Gamification
{
    private const LEVELS = [0, 100, 250, 500, 1000, 2000, 3500, 5500, 8000, 12000, 17000, 23000, 30000, 40000, 55000, 75000, 100000];

    public static function awardXp(string $userId, int $amount, string $source, ?string $sourceId = null): array
    {
        Db::insert('xp_history', ['userId' => $userId, 'amount' => $amount, 'source' => $source, 'sourceId' => $sourceId], false);
        Db::run('UPDATE users SET total_xp = total_xp + ?, updated_at = ? WHERE id = ?', [$amount, now_db(), $userId]);
        $user = Db::row('users', 'SELECT total_xp, level FROM users WHERE id = ?', [$userId]);
        $newLevel = self::levelFor($user['totalXp']);
        if ($newLevel > $user['level']) {
            Db::update('users', $userId, ['level' => $newLevel]);
            Db::insert('notifications', ['userId' => $userId, 'title' => 'Level Up!', 'message' => "You reached Level $newLevel!", 'type' => 'achievement'], false);
        }
        return ['xp' => $user['totalXp'], 'level' => $newLevel, 'awarded' => $amount];
    }

    public static function updateStreak(string $userId): array
    {
        $today = gmdate('Y-m-d') . ' 00:00:00.000';
        $streak = Db::row('streaks', "SELECT * FROM streaks WHERE user_id = ? AND type = 'daily' LIMIT 1", [$userId]);
        if (!$streak) {
            return Db::insert('streaks', ['userId' => $userId, 'type' => 'daily', 'currentCount' => 1, 'longestCount' => 1, 'lastActiveAt' => $today]);
        }
        $diff = intdiv(day_ts(gmdate('Y-m-d')) - day_ts($streak['lastActiveAt']), 86400);
        if ($diff === 0) return $streak;
        $count = $diff === 1 ? $streak['currentCount'] + 1 : 1;
        $streak = Db::update('streaks', $streak['id'], [
            'currentCount' => $count,
            'longestCount' => max($streak['longestCount'], $count),
            'lastActiveAt' => $today,
        ]);
        if ($count % 7 === 0) self::awardXp($userId, 50, 'streak_bonus', $streak['id']);
        if ($count % 30 === 0) self::awardXp($userId, 200, 'streak_bonus', $streak['id']);
        return $streak;
    }

    public static function stats(string $userId): array
    {
        $user = Db::row('users', 'SELECT total_xp, level FROM users WHERE id = ?', [$userId]);
        $streak = Db::row('streaks', "SELECT * FROM streaks WHERE user_id = ? AND type = 'daily' LIMIT 1", [$userId]);
        $achievements = array_map(function ($ua) {
            $a = Db::find('achievements', $ua['achievementId']);
            return [...($a ?? []), 'unlockedAt' => $ua['unlockedAt']];
        }, Db::rows('user_achievements', 'SELECT * FROM user_achievements WHERE user_id = ?', [$userId]));
        $xpHistory = Db::rows('xp_history', 'SELECT * FROM xp_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 30', [$userId]);
        $progress = Db::rows('learning_progress', 'SELECT * FROM learning_progress WHERE user_id = ? ORDER BY last_practiced_at DESC LIMIT 50', [$userId]);
        $sIds = array_values(array_unique(array_column($progress, 'subjectId')));
        $nIds = array_values(array_unique(array_column($progress, 'scopeKey')));
        $subjects = $sIds ? index_by(Db::q('SELECT id, title FROM subjects WHERE id IN (' . marks($sIds) . ')', $sIds)) : [];
        $nodes = $nIds ? index_by(Db::q('SELECT id, title, type FROM content_nodes WHERE id IN (' . marks($nIds) . ')', $nIds)) : [];
        $byScope = array_map(fn($p) => [
            ...$p,
            'subjectTitle' => $subjects[$p['subjectId']]['title'] ?? '',
            'scopeTitle' => $nodes[$p['scopeKey']]['title'] ?? null,
            'scopeType' => $nodes[$p['scopeKey']]['type'] ?? 'SUBJECT',
        ], $progress);
        $level = ($user['level'] ?? 0) ?: 1;
        return [
            'xp' => ($user['totalXp'] ?? 0) ?: 0,
            'level' => $level,
            'nextLevelXp' => $level >= count(self::LEVELS) ? self::LEVELS[count(self::LEVELS) - 1] * 2 : self::LEVELS[$level],
            'streak' => ($streak['currentCount'] ?? 0) ?: 0,
            'longestStreak' => ($streak['longestCount'] ?? 0) ?: 0,
            'achievements' => $achievements,
            'xpHistory' => $xpHistory,
            'progressByScope' => $byScope,
        ];
    }

    public static function heatmap(string $userId): array
    {
        $since = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->modify('-6 months')->format('Y-m-d H:i:s.v');
        $sessions = Db::q("SELECT started_at, duration FROM task_sessions WHERE user_id = ? AND started_at >= ? AND status = 'completed'", [$userId, $since]);
        $map = [];
        foreach ($sessions as $s) {
            $day = substr((string) $s['started_at'], 0, 10);
            $map[$day] ??= ['count' => 0, 'duration' => 0];
            $map[$day]['count']++;
            $map[$day]['duration'] += (int) ($s['duration'] ?? 0);
        }
        $out = [];
        foreach ($map as $date => $d) $out[] = ['date' => (string) $date, 'count' => $d['count'], 'duration' => $d['duration']];
        return $out;
    }

    private static function levelFor(int $xp): int
    {
        for ($i = count(self::LEVELS) - 1; $i >= 0; $i--) if ($xp >= self::LEVELS[$i]) return $i + 1;
        return 1;
    }
}

final class Dashboard
{
    public static function get(string $userId): array
    {
        $agenda = Tasks::agenda($userId);
        $done = count(array_filter($agenda['todayItems'], fn($o) => $o['status'] === 'COMPLETED'));
        return [
            'user' => Db::row('users', 'SELECT total_xp, level, name, role FROM users WHERE id = ?', [$userId]),
            'streak' => Db::row('streaks', "SELECT * FROM streaks WHERE user_id = ? AND type = 'daily' LIMIT 1", [$userId]),
            'agenda' => $agenda,
            'todayProgress' => ['total' => count($agenda['todayItems']), 'completed' => $done],
            'subjectProgress' => self::subjectProgress($userId),
            'recentActivity' => self::recentActivity($userId),
            'weakAreas' => self::weakAreas($userId),
            'reading' => Progress::recent($userId),
        ];
    }

    /** Completion rate of due practice per subject. */
    private static function subjectProgress(string $userId): array
    {
        $groups = Db::q('SELECT task_id, status, COUNT(*) AS n FROM task_occurrences WHERE user_id = ? GROUP BY task_id, status', [$userId]);
        if (!$groups) return [];
        $taskIds = array_values(array_unique(array_column($groups, 'task_id')));
        $taskSubject = array_column(Db::q('SELECT id, subject_id FROM tasks WHERE id IN (' . marks($taskIds) . ')', $taskIds), 'subject_id', 'id');
        $subjects = Refs::subjects(array_values($taskSubject));
        $by = [];
        foreach ($groups as $g) {
            $subject = $subjects[$taskSubject[$g['task_id']] ?? ''] ?? null;
            if (!$subject) continue;
            $by[$subject['id']] ??= [...$subject, 'due' => 0, 'completed' => 0];
            $by[$subject['id']]['due'] += (int) $g['n'];
            if ($g['status'] === 'COMPLETED') $by[$subject['id']]['completed'] += (int) $g['n'];
        }
        return array_values(array_map(fn($s) => [...$s, 'rate' => $s['due'] ? js_round($s['completed'] / $s['due'] * 100) : 0], $by));
    }

    private static function recentActivity(string $userId): array
    {
        $items = Db::rows('task_occurrences', "SELECT * FROM task_occurrences WHERE user_id = ? AND status = 'COMPLETED' ORDER BY completed_at DESC LIMIT 8", [$userId]);
        return array_map(function ($o) {
            $t = Db::q('SELECT t.title, s.title AS subject FROM tasks t JOIN subjects s ON s.id = t.subject_id WHERE t.id = ?', [$o['taskId']])[0] ?? null;
            return [
                'id' => $o['id'],
                'title' => $t['title'] ?? '',
                'subject' => $t['subject'] ?? '',
                'completedAt' => $o['completedAt'],
                'duration' => (int) Db::scalar("SELECT COALESCE(SUM(duration), 0) FROM task_sessions WHERE occurrence_id = ? AND status = 'completed'", [$o['id']]),
            ];
        }, $items);
    }

    private static function weakAreas(string $userId): array
    {
        $rows = Db::rows('learning_progress', 'SELECT * FROM learning_progress WHERE user_id = ? AND mastery < 40 ORDER BY mastery ASC LIMIT 5', [$userId]);
        $nIds = array_values(array_unique(array_column($rows, 'scopeKey')));
        $sIds = array_values(array_unique(array_column($rows, 'subjectId')));
        $nodes = $nIds ? array_column(Db::q('SELECT id, title FROM content_nodes WHERE id IN (' . marks($nIds) . ')', $nIds), 'title', 'id') : [];
        $subjects = $sIds ? array_column(Db::q('SELECT id, title FROM subjects WHERE id IN (' . marks($sIds) . ')', $sIds), 'title', 'id') : [];
        return array_map(fn($r) => [
            'mastery' => $r['mastery'],
            'title' => $nodes[$r['scopeKey']] ?? $subjects[$r['subjectId']] ?? '',
            'subjectId' => $r['subjectId'],
        ], $rows);
    }
}
