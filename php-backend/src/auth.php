<?php
declare(strict_types=1);

const ACCESS_TTL = 15 * 60;
const REFRESH_TTL = 7 * 24 * 3600;

final class Auth
{
    /** Bearer token -> signed-in user, like the Nest JwtStrategy. */
    public static function authenticate(Request $req): array
    {
        $h = $req->header('authorization') ?? '';
        if (!preg_match('/^Bearer\s+(\S+)$/i', $h, $m)) unauthorized();
        $payload = Jwt::verify($m[1]);
        if (!$payload || !isset($payload['sub'])) unauthorized();
        $u = Db::row('users', 'SELECT id, email, name, username, role, deleted_at FROM users WHERE id = ?', [(string) $payload['sub']]);
        if (!$u || $u['deletedAt']) unauthorized();
        return pick($u, ['id', 'email', 'name', 'username', 'role']);
    }

    public static function publicUser(array $u): array
    {
        return pick($u, ['id', 'email', 'username', 'name', 'role', 'level', 'totalXp']);
    }

    /** Creates the first admin from ADMIN_EMAIL / ADMIN_PASSWORD if it doesn't exist yet. */
    public static function bootstrapAdmin(): void
    {
        $email = strtolower(trim((string) env('ADMIN_EMAIL', '')));
        $password = env('ADMIN_PASSWORD');
        if ($email === '' || !$password) return;
        if (Db::scalar('SELECT 1 FROM users WHERE email = ?', [$email])) return;
        self::createUser([
            'email' => $email,
            'password' => $password,
            'username' => env('ADMIN_USERNAME', 'admin'),
            'name' => env('ADMIN_NAME', 'Administrator'),
            'role' => 'ADMIN',
        ]);
    }

    public static function createUser(array $d): array
    {
        $email = strtolower(trim($d['email']));
        $username = strtolower(trim($d['username']));
        $clash = Db::row('users', 'SELECT email FROM users WHERE email = ? OR username = ? LIMIT 1', [$email, $username]);
        if ($clash) conflict($clash['email'] === $email ? 'Email already registered' : 'Username already taken');
        return Db::insert('users', [
            'email' => $email,
            'username' => $username,
            'passwordHash' => bcrypt_hash($d['password']),
            'name' => $d['name'],
            'avatar' => $d['avatar'] ?? null,
            'role' => $d['role'] ?? 'USER',
        ]);
    }

    public static function register(array $body): array
    {
        $dto = V::check($body, [
            'email' => ['email'],
            'username' => ['regex' => V::USERNAME],
            'password' => ['string', 'min' => 6],
            'name' => ['string', 'min' => 2, 'max' => 80],
            'avatar' => ['optional', 'string'],
        ]);
        $user = self::createUser($dto);
        $tokens = self::issueTokens($user['id'], $user['email']);
        return ['user' => self::publicUser($user), ...$tokens];
    }

    public static function login(array $body): array
    {
        $dto = V::check($body, [
            'email' => ['string', 'min' => 3],
            'password' => ['string', 'min' => 6],
        ]);
        $identifier = strtolower(trim($dto['email']));
        $col = str_contains($identifier, '@') ? 'email' : 'username';
        $user = Db::row('users', "SELECT * FROM users WHERE $col = ?", [$identifier]);
        if (!$user || !$user['passwordHash'] || $user['deletedAt']) unauthorized('Invalid credentials');
        if (!bcrypt_check($dto['password'], $user['passwordHash'])) unauthorized('Invalid credentials');
        $tokens = self::issueTokens($user['id'], $user['email']);
        return ['user' => self::publicUser($user), ...$tokens];
    }

    public static function refresh(array $body): array
    {
        $userId = $body['userId'] ?? null;
        $token = $body['refreshToken'] ?? null;
        if (!is_string($userId) || !is_string($token)) unauthorized('Access denied');
        $user = Db::row('users', 'SELECT id, email, refresh_token FROM users WHERE id = ?', [$userId]);
        if (!$user || !$user['refreshToken'] || !self::refreshMatches($token, $user['refreshToken'])) {
            unauthorized('Access denied');
        }
        return self::issueTokens($user['id'], $user['email']);
    }

    public static function logout(string $userId): array
    {
        Db::update('users', $userId, ['refreshToken' => null]);
        return ['message' => 'Logged out successfully'];
    }

    public static function profile(string $userId): ?array
    {
        return Db::row(
            'users',
            'SELECT id, email, username, name, role, avatar, level, total_xp, daily_task_count, daily_hours, difficulty, created_at
             FROM users WHERE id = ?',
            [$userId],
        );
    }

    private static function issueTokens(string $userId, string $email): array
    {
        $claims = ['sub' => $userId, 'email' => $email];
        $tokens = [
            'accessToken' => Jwt::sign($claims, ACCESS_TTL),
            'refreshToken' => Jwt::sign($claims, REFRESH_TTL),
        ];
        Db::update('users', $userId, ['refreshToken' => self::refreshHash($tokens['refreshToken'])]);
        return $tokens;
    }

    // The whole token is hashed: bcrypt only reads the first 72 bytes, which
    // for a JWT is the same header and user id on every token of that user.
    private static function refreshHash(string $token): string
    {
        return 'sha256:' . hash('sha256', $token);
    }

    private static function refreshMatches(string $token, string $stored): bool
    {
        if (str_starts_with($stored, 'sha256:')) return hash_equals($stored, self::refreshHash($token));
        return bcrypt_check($token, $stored); // issued by the Node API
    }

    // ------------------------------------------------------------- google

    public static function googleRedirect(): RawResponse
    {
        $url = 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query([
            'response_type' => 'code',
            'client_id' => env('GOOGLE_CLIENT_ID', 'google-client-id'),
            'redirect_uri' => self::googleCallbackUrl(),
            'scope' => 'email profile',
        ]);
        return new RawResponse(function () use ($url) {
            header('Location: ' . $url, true, 302);
        });
    }

    public static function googleCallback(Request $req): RawResponse
    {
        $code = $req->q('code');
        if (!$code) unauthorized();
        $token = self::postForm('https://oauth2.googleapis.com/token', [
            'code' => $code,
            'client_id' => env('GOOGLE_CLIENT_ID', 'google-client-id'),
            'client_secret' => env('GOOGLE_CLIENT_SECRET', 'google-client-secret'),
            'redirect_uri' => self::googleCallbackUrl(),
            'grant_type' => 'authorization_code',
        ]);
        if (empty($token['access_token'])) unauthorized();
        $profile = self::getJson('https://www.googleapis.com/oauth2/v3/userinfo', $token['access_token']);
        $email = (string) ($profile['email'] ?? '');
        if ($email === '') unauthorized();

        $user = Db::row('users', 'SELECT * FROM users WHERE email = ?', [$email]);
        if (!$user) {
            $user = Db::insert('users', [
                'email' => $email,
                'username' => self::uniqueUsername($email),
                'name' => (string) ($profile['name'] ?? $email),
                'avatar' => $profile['picture'] ?? null,
                'provider' => 'google',
                'providerId' => (string) ($profile['sub'] ?? ''),
                'emailVerified' => true,
            ]);
        }
        $tokens = self::issueTokens($user['id'], $user['email']);
        $front = env('FRONTEND_URL', 'http://localhost:3000');
        $to = "$front/auth/callback?accessToken={$tokens['accessToken']}&refreshToken={$tokens['refreshToken']}";
        return new RawResponse(function () use ($to) {
            header('Location: ' . $to, true, 302);
        });
    }

    private static function googleCallbackUrl(): string
    {
        return env('GOOGLE_CALLBACK_URL', 'http://localhost:3001/api/auth/google/callback');
    }

    private static function uniqueUsername(string $email): string
    {
        $base = substr(preg_replace('/[^a-z0-9_.-]/', '', strtolower(explode('@', $email)[0])), 0, 24) ?: 'user';
        $candidate = strlen($base) >= 3 ? $base : "{$base}user";
        for ($i = 1; Db::scalar('SELECT 1 FROM users WHERE username = ?', [$candidate]); $i++) {
            $candidate = "$base$i";
        }
        return $candidate;
    }

    private static function postForm(string $url, array $fields): array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query($fields),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
        ]);
        $res = curl_exec($ch);
        curl_close($ch);
        return is_string($res) ? (json_decode($res, true) ?: []) : [];
    }

    private static function getJson(string $url, string $bearer): array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_HTTPHEADER => ["Authorization: Bearer $bearer"],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
        ]);
        $res = curl_exec($ch);
        curl_close($ch);
        return is_string($res) ? (json_decode($res, true) ?: []) : [];
    }
}

final class Notifications
{
    /** @param string|string[] $userIds */
    public static function notify(string|array $userIds, array $data): void
    {
        $ids = array_values(array_unique(is_array($userIds) ? $userIds : [$userIds]));
        foreach ($ids as $id) {
            Db::insert('notifications', [
                'userId' => $id,
                'title' => $data['title'],
                'message' => $data['message'],
                'type' => $data['type'],
                'link' => $data['link'] ?? null,
            ], false);
        }
    }

    public static function notifyAdmins(array $data, ?string $exceptUserId = null): void
    {
        $sql = "SELECT id FROM users WHERE role = 'ADMIN' AND deleted_at IS NULL";
        $params = [];
        if ($exceptUserId !== null) {
            $sql .= ' AND id <> ?';
            $params[] = $exceptUserId;
        }
        self::notify(array_column(Db::q($sql, $params), 'id'), $data);
    }

    public static function list(string $userId): array
    {
        return [
            'items' => Db::rows('notifications', 'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30', [$userId]),
            'unread' => Db::count('SELECT COUNT(*) FROM notifications WHERE user_id = ? AND `read` = 0', [$userId]),
        ];
    }

    public static function markRead(string $userId, string $id): array
    {
        return ['count' => Db::updateWhere('notifications', ['read' => true], 'id = ? AND user_id = ?', [$id, $userId])];
    }

    public static function markAllRead(string $userId): array
    {
        return ['count' => Db::updateWhere('notifications', ['read' => true], 'user_id = ? AND `read` = 0', [$userId])];
    }
}

/** {id: {id, name, username}} for the given user ids. */
function user_summaries(array $ids, array $fields = ['id', 'name', 'username']): array
{
    $ids = array_values(array_unique(array_filter($ids)));
    if (!$ids) return [];
    $cols = implode(',', array_map(fn($f) => Db::snake($f), array_unique([...$fields, 'id'])));
    $out = [];
    foreach (Db::rows('users', "SELECT $cols FROM users WHERE id IN (" . marks($ids) . ')', $ids) as $u) {
        $out[$u['id']] = pick($u, $fields);
    }
    return $out;
}
