<?php
declare(strict_types=1);

// ------------------------------------------------------------------ config

/** Reads KEY=VALUE lines into the environment; real environment variables win. */
function load_env(string $file): void
{
    if (!is_file($file)) return;
    foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) continue;
        [$key, $value] = array_map('trim', explode('=', $line, 2));
        $q = $value[0] ?? '';
        if (strlen($value) >= 2 && ($q === '"' || $q === "'") && str_ends_with($value, $q)) {
            $value = substr($value, 1, -1);
        }
        if (getenv($key) === false) {
            putenv("$key=$value");
            $_ENV[$key] = $value;
        }
    }
}

function env(string $key, ?string $default = null): ?string
{
    $v = getenv($key);
    return ($v === false || $v === '') ? $default : $v;
}

// ------------------------------------------------------------------ errors

final class HttpError extends RuntimeException
{
    /** @param string|string[] $payload */
    public function __construct(public readonly int $status, public readonly string|array $payload)
    {
        parent::__construct(is_array($payload) ? implode(', ', $payload) : $payload);
    }
}

function bad_request(string|array $m = 'Bad Request'): never { throw new HttpError(400, $m); }
function unauthorized(string $m = 'Unauthorized'): never { throw new HttpError(401, $m); }
function forbidden(string $m = 'Forbidden'): never { throw new HttpError(403, $m); }
function not_found(string $m = 'Not Found'): never { throw new HttpError(404, $m); }
function conflict(string $m = 'Conflict'): never { throw new HttpError(409, $m); }

// ------------------------------------------------------------------- dates
// Timestamps are stored in UTC as 'Y-m-d H:i:s.v' and sent as ISO strings.
// Calendar days are 'Y-m-d' strings, which compare correctly as strings.

function now_db(): string
{
    $t = microtime(true);
    $ms = (int) floor(($t - floor($t)) * 1000);
    return gmdate('Y-m-d H:i:s', (int) floor($t)) . sprintf('.%03d', $ms);
}

function iso(?string $db): ?string
{
    if ($db === null) return null;
    if (strlen($db) === 10) return $db . 'T00:00:00.000Z';
    $v = str_replace(' ', 'T', $db);
    if (!str_contains($v, '.')) $v .= '.000';
    return substr(str_pad($v, 23, '0'), 0, 23) . 'Z';
}

/** Milliseconds since the epoch for a stored or ISO timestamp. */
function ms_of(string $ts): int
{
    $ts = rtrim(str_replace('T', ' ', $ts), 'Z');
    [$base, $frac] = array_pad(explode('.', $ts, 2), 2, '0');
    return strtotime($base . ' UTC') * 1000 + (int) str_pad(substr($frac, 0, 3), 3, '0');
}

function today(): string
{
    $tz = new DateTimeZone(env('APP_TIMEZONE', 'Asia/Kolkata'));
    return (new DateTimeImmutable('now', $tz))->format('Y-m-d');
}

function day_ts(string $ymd): int { return (int) strtotime(substr($ymd, 0, 10) . ' 00:00:00 UTC'); }
function add_days(string $ymd, int $n): string { return gmdate('Y-m-d', day_ts($ymd) + $n * 86400); }
function diff_days(string $a, string $b): int { return (int) round((day_ts($a) - day_ts($b)) / 86400); }
function days_in_month(string $ymd): int { return (int) gmdate('t', day_ts($ymd)); }
function week_day(string $ymd): int { return (int) gmdate('w', day_ts($ymd)); }
function month_day(string $ymd): int { return (int) gmdate('j', day_ts($ymd)); }
function ymd(?string $isoOrDb): ?string { return $isoOrDb === null ? null : substr($isoOrDb, 0, 10); }

// ------------------------------------------------------------------- misc

function uuid(): string
{
    $b = random_bytes(16);
    $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
    $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
}

/** Trimmed string, or null when empty (JS `s?.trim() || null`). */
function trim_or_null(mixed $s): ?string
{
    if ($s === null) return null;
    $t = trim((string) $s);
    return $t === '' ? null : $t;
}

/** JS-style Math.round for non-negative numbers. */
function js_round(float $x): int { return (int) floor($x + 0.5); }

/** `%term%` for LIKE, with wildcards in the term escaped. */
function like(string $s): string { return '%' . addcslashes($s, '%_\\') . '%'; }

/** "?,?,?" for an IN list; "NULL" (matches nothing) when empty. */
function marks(array $values): string
{
    return $values ? implode(',', array_fill(0, count($values), '?')) : 'NULL';
}

/** An empty PHP array encodes as []; use this where the API returns an object. */
function obj(array $a): array|stdClass { return $a ? $a : new stdClass(); }

function pick(?array $row, array $keys): ?array
{
    if ($row === null) return null;
    $out = [];
    foreach ($keys as $k) $out[$k] = $row[$k] ?? null;
    return $out;
}

function index_by(array $rows, string $key = 'id'): array
{
    $out = [];
    foreach ($rows as $r) $out[$r[$key]] = $r;
    return $out;
}

function log_error(string $msg): void { error_log('[skillforge] ' . $msg); }

// --------------------------------------------------------------------- db

final class Db
{
    /** tinyint(1) columns returned as booleans. */
    private const BOOLS = [
        'attachments' => ['inline'],
        'content_nodes' => ['is_preview', 'has_content'],
        'notifications' => ['read'],
        'task_templates' => ['active'],
        'tasks' => ['active'],
        'users' => ['email_verified'],
    ];
    /** DATE columns (Prisma @db.Date). Every *_at column is a DATETIME(3). */
    private const DATES = [
        'study_time' => ['day'],
        'task_occurrences' => ['due_date'],
        'tasks' => ['start_date', 'end_date', 'generated_thru'],
    ];
    private const JSONS = [
        'change_requests' => ['payload'],
        'content_revisions' => ['snapshot'],
        'task_templates' => ['spacing'],
        'tasks' => ['spacing'],
    ];
    /** Columns Prisma fills with now() on insert. */
    private const NOW_ON_INSERT = [
        'users' => ['created_at', 'updated_at'],
        'categories' => ['created_at'],
        'subjects' => ['created_at', 'updated_at', 'content_updated_at'],
        'content_nodes' => ['created_at', 'updated_at', 'content_updated_at'],
        'subject_members' => ['created_at'],
        'access_requests' => ['created_at'],
        'change_requests' => ['created_at'],
        'content_revisions' => ['created_at'],
        'attachments' => ['created_at'],
        'tasks' => ['created_at', 'updated_at'],
        'task_templates' => ['created_at', 'updated_at'],
        'task_occurrences' => ['created_at', 'updated_at'],
        'task_sessions' => ['started_at', 'created_at', 'updated_at'],
        'feedback' => ['created_at', 'updated_at'],
        'streaks' => ['last_active_at', 'created_at', 'updated_at'],
        'achievements' => ['created_at'],
        'user_achievements' => ['unlocked_at'],
        'xp_history' => ['created_at'],
        'learning_progress' => ['created_at', 'updated_at'],
        'notifications' => ['created_at', 'updated_at'],
        'read_progress' => ['created_at', 'updated_at'],
        'study_events' => ['created_at'],
        'study_time' => [],
    ];

    private static ?PDO $pdo = null;

    public static function pdo(): PDO
    {
        if (self::$pdo === null) {
            $dsn = sprintf(
                'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
                env('DB_HOST', 'localhost'),
                env('DB_PORT', '3306'),
                env('DB_NAME', 'ai_learning_platform'),
            );
            self::$pdo = new PDO($dsn, env('DB_USER', 'root'), env('DB_PASSWORD', 'password') ?? '', [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_STRINGIFY_FETCHES => false,
            ]);
            self::$pdo->exec("SET time_zone = '+00:00'");
        }
        return self::$pdo;
    }

    public static function run(string $sql, array $params = []): PDOStatement
    {
        $st = self::pdo()->prepare($sql);
        $st->execute(array_map(fn($v) => is_bool($v) ? (int) $v : $v, array_values($params)));
        return $st;
    }

    /** Raw rows with database column names. */
    public static function q(string $sql, array $params = []): array
    {
        return self::run($sql, $params)->fetchAll();
    }

    public static function scalar(string $sql, array $params = []): mixed
    {
        $v = self::run($sql, $params)->fetchColumn();
        return $v === false ? null : $v;
    }

    public static function count(string $sql, array $params = []): int
    {
        return (int) self::scalar($sql, $params);
    }

    /** Rows shaped like Prisma returns them: camelCase keys, booleans, ISO dates, decoded JSON. */
    public static function rows(string $table, string $sql, array $params = []): array
    {
        return array_map(fn($r) => self::hydrate($table, $r), self::q($sql, $params));
    }

    public static function row(string $table, string $sql, array $params = []): ?array
    {
        $r = self::run($sql, $params)->fetch();
        return $r === false ? null : self::hydrate($table, $r);
    }

    public static function find(string $table, string $id): ?array
    {
        return self::row($table, "SELECT * FROM `$table` WHERE id = ?", [$id]);
    }

    public static function hydrate(string $table, array $r): array
    {
        $out = [];
        foreach ($r as $col => $v) {
            if ($v !== null) {
                if (in_array($col, self::BOOLS[$table] ?? [], true)) $v = (bool) $v;
                elseif (in_array($col, self::DATES[$table] ?? [], true)) $v = iso((string) $v);
                elseif (str_ends_with($col, '_at')) $v = iso((string) $v);
                elseif (in_array($col, self::JSONS[$table] ?? [], true)) $v = json_decode((string) $v);
            }
            $out[self::camel($col)] = $v;
        }
        return $out;
    }

    public static function camel(string $col): string
    {
        return lcfirst(str_replace('_', '', ucwords($col, '_')));
    }

    public static function snake(string $field): string
    {
        return strtolower(preg_replace('/[A-Z]/', '_$0', $field));
    }

    private static function encode(string $table, string $col, mixed $v): mixed
    {
        if (in_array($col, self::JSONS[$table] ?? [], true)) {
            return json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
        return is_bool($v) ? (int) $v : $v;
    }

    /** Inserts camelCase `$data`, filling id and timestamps; returns the stored row. */
    public static function insert(string $table, array $data, bool $returnRow = true): ?array
    {
        $now = now_db();
        $cols = [];
        foreach ($data as $k => $v) $cols[self::snake($k)] = $v;
        $cols['id'] ??= uuid();
        foreach (self::NOW_ON_INSERT[$table] ?? [] as $c) $cols[$c] ??= $now;
        $names = implode(',', array_map(fn($c) => "`$c`", array_keys($cols)));
        $values = [];
        foreach ($cols as $c => $v) $values[] = self::encode($table, $c, $v);
        self::run("INSERT INTO `$table` ($names) VALUES (" . marks($values) . ')', $values);
        return $returnRow ? self::find($table, $cols['id']) : null;
    }

    /** UPDATE … SET camelCase `$data` WHERE `$where`; bumps updated_at like Prisma's @updatedAt. */
    public static function updateWhere(string $table, array $data, string $where, array $params = []): int
    {
        $cols = [];
        foreach ($data as $k => $v) $cols[self::snake($k)] = $v;
        if (in_array('updated_at', self::NOW_ON_INSERT[$table] ?? [], true)) $cols['updated_at'] ??= now_db();
        if (!$cols) return 0;
        $set = implode(',', array_map(fn($c) => "`$c` = ?", array_keys($cols)));
        $values = [];
        foreach ($cols as $c => $v) $values[] = self::encode($table, $c, $v);
        return self::run("UPDATE `$table` SET $set WHERE $where", [...$values, ...$params])->rowCount();
    }

    public static function update(string $table, string $id, array $data): ?array
    {
        self::updateWhere($table, $data, 'id = ?', [$id]);
        return self::find($table, $id);
    }

    /** Runs `$fn` in a transaction (joins an open one). */
    public static function tx(callable $fn): mixed
    {
        $pdo = self::pdo();
        if ($pdo->inTransaction()) return $fn();
        $pdo->beginTransaction();
        try {
            $result = $fn();
            $pdo->commit();
            return $result;
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }

    public static function isDuplicate(Throwable $e): bool
    {
        return $e instanceof PDOException && ($e->errorInfo[1] ?? null) === 1062;
    }
}

// -------------------------------------------------------------------- jwt

final class Jwt
{
    private static function b64(string $s): string
    {
        return rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
    }

    private static function unb64(string $s): string|false
    {
        $pad = strlen($s) % 4;
        if ($pad) $s .= str_repeat('=', 4 - $pad);
        return base64_decode(strtr($s, '-_', '+/'), true);
    }

    private static function secret(): string
    {
        return env('JWT_SECRET', 'dev-secret-change-me');
    }

    public static function sign(array $payload, int $ttlSeconds): string
    {
        $now = time();
        $payload += ['iat' => $now, 'exp' => $now + $ttlSeconds];
        $head = self::b64(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
        $body = self::b64(json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        $sig = self::b64(hash_hmac('sha256', "$head.$body", self::secret(), true));
        return "$head.$body.$sig";
    }

    /** Payload of a valid, unexpired token, else null. */
    public static function verify(string $token): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) return null;
        [$head, $body, $sig] = $parts;
        $header = json_decode((string) self::unb64($head), true);
        if (($header['alg'] ?? null) !== 'HS256') return null;
        $expected = self::b64(hash_hmac('sha256', "$head.$body", self::secret(), true));
        if (!hash_equals($expected, $sig)) return null;
        $payload = json_decode((string) self::unb64($body), true);
        if (!is_array($payload)) return null;
        if (isset($payload['exp']) && time() >= (int) $payload['exp']) return null;
        return $payload;
    }
}

// -------------------------------------------------------------- validation
// Mirrors the class-validator DTOs: same rules, same messages. Unknown
// properties are dropped. Optional fields keep an explicit null so services
// can tell "cleared" from "not sent" with array_key_exists.

final class V
{
    public const USERNAME = ['/^[a-z0-9_.-]{3,30}$/', 'username must be 3-30 characters: lowercase letters, numbers, dot, dash or underscore'];
    public const DIFFICULTY = ['beginner', 'intermediate', 'advanced', 'expert'];
    public const FREQUENCY = ['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM', 'SPACED'];

    public static function check(mixed $input, array $spec): array
    {
        $errors = [];
        $out = self::object(is_array($input) ? $input : [], $spec, '', $errors);
        if ($errors) throw new HttpError(400, $errors);
        return $out;
    }

    private static function object(array $in, array $spec, string $prefix, array &$errors): array
    {
        $out = [];
        foreach ($spec as $field => $rules) {
            $present = array_key_exists($field, $in);
            $value = $present ? $in[$field] : null;
            if (in_array('optional', $rules, true) && $value === null) {
                if ($present) $out[$field] = null;
                continue;
            }
            $before = count($errors);
            if (isset($rules['nested'])) {
                if (!is_array($value) || (array_is_list($value) && $value !== [])) {
                    $errors[] = "{$prefix}nested property $field must be either object or array";
                    continue;
                }
                $out[$field] = self::object($value, $rules['nested'], "$prefix$field.", $errors);
                continue;
            }
            $mine = [];
            self::value($field, $value, $rules, $mine);
            foreach ($mine as $m) $errors[] = $prefix . $m;
            if (count($errors) === $before) $out[$field] = $value;
        }
        return $out;
    }

    /**
     * Like class-validator, every rule is checked and a value of the wrong type
     * fails all of them; messages come out in reverse decorator order.
     */
    private static function value(string $name, mixed $v, array $rules, array &$errors): void
    {
        $num = fn($x) => is_int($x) || is_float($x);
        $items = is_array($v) && array_is_list($v) ? $v : [$v];
        $mine = [];
        foreach ($rules as $key => $rule) {
            $r = is_int($key) ? $rule : $key;
            $arg = is_int($key) ? null : $rule;
            $msg = match ($r) {
                'string' => is_string($v) ? null : "$name must be a string",
                'int' => is_int($v) ? null : "$name must be an integer number",
                'bool' => is_bool($v) ? null : "$name must be a boolean value",
                'array' => is_array($v) && array_is_list($v) ? null : "$name must be an array",
                'email' => is_string($v) && filter_var($v, FILTER_VALIDATE_EMAIL) ? null : "$name must be an email",
                'uuid' => is_string($v) && preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $v)
                    ? null : "$name must be a UUID",
                'date' => self::isDate($v) ? null : "$name must be a valid ISO 8601 date string",
                'in' => in_array($v, $arg, true) ? null : "$name must be one of the following values: " . implode(', ', $arg),
                'regex' => is_string($v) && preg_match($arg[0], $v) ? null : $arg[1],
                'min' => is_string($v) && mb_strlen($v) >= $arg ? null : "$name must be longer than or equal to $arg characters",
                'max' => is_string($v) && mb_strlen($v) <= $arg ? null : "$name must be shorter than or equal to $arg characters",
                'gte' => $num($v) && $v >= $arg ? null : "$name must not be less than $arg",
                'lte' => $num($v) && $v <= $arg ? null : "$name must not be greater than $arg",
                'arrmax' => is_array($v) && array_is_list($v) && count($v) <= $arg ? null : "$name must contain no more than $arg elements",
                'each' => self::all($items, fn($x) => $arg === 'int' ? is_int($x) : is_string($x))
                    ? null : "each value in $name must be " . ($arg === 'int' ? 'an integer number' : 'a string'),
                'eachgte' => self::all($items, fn($x) => $num($x) && $x >= $arg) ? null : "each value in $name must not be less than $arg",
                'eachlte' => self::all($items, fn($x) => $num($x) && $x <= $arg) ? null : "each value in $name must not be greater than $arg",
                default => null,
            };
            if ($msg !== null) $mine[] = $msg;
        }
        array_push($errors, ...array_reverse($mine));
    }

    private static function all(array $items, callable $ok): bool
    {
        foreach ($items as $x) if (!$ok($x)) return false;
        return true;
    }

    private static function isDate(mixed $v): bool
    {
        return is_string($v)
            && preg_match('/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/', $v)
            && checkdate((int) substr($v, 5, 2), (int) substr($v, 8, 2), (int) substr($v, 0, 4));
    }
}

// --------------------------------------------------------------- sanitizer
// Port of the sanitize-html options used by the Node API: rich-text bodies
// are authored by one user and rendered for others, so only the markup the
// editor can produce is allowed through.

final class Sanitizer
{
    private const TAGS = [
        'h1', 'h2', 'h3', 'h4', 'p', 'br', 'hr', 'blockquote', 'strong', 'b', 'em', 'i', 'u', 's',
        'code', 'pre', 'mark', 'sub', 'sup', 'ul', 'ol', 'li', 'a', 'img', 'span', 'div', 'table',
        'thead', 'tbody', 'tr', 'th', 'td', 'colgroup', 'col', 'label', 'input',
    ];
    private const ATTRS = [
        'a' => ['href', 'target', 'rel'],
        'img' => ['src', 'alt', 'title', 'width', 'height'],
        'code' => ['class'],
        'pre' => ['class'],
        'span' => ['class'],
        'div' => ['class', 'data-type'],
        'ul' => ['data-type'],
        'li' => ['data-type', 'data-checked'],
        'th' => ['colspan', 'rowspan', 'colwidth'],
        'td' => ['colspan', 'rowspan', 'colwidth'],
        'col' => ['style'],
        'input' => ['type', 'checked', 'disabled'],
        'p' => ['style'],
        'h1' => ['style'],
        'h2' => ['style'],
        'h3' => ['style'],
        'h4' => ['style'],
    ];
    private const CLASSES = [
        'code' => ['/^language-[\w-]+$/'],
        'pre' => ['/^language-[\w-]+$/'],
        'span' => ['/^hljs[\w-]*$/'],
        'div' => ['callout', 'callout-info', 'callout-warning', 'callout-danger', 'callout-success'],
    ];
    private const STYLES_ALL = ['text-align' => '/^(left|right|center|justify)$/'];
    private const STYLES = ['col' => ['width' => '/^\d+px$/', 'min-width' => '/^\d+px$/']];
    private const SELF_CLOSING = ['img', 'br', 'hr', 'input', 'col'];
    private const NON_TEXT = ['script', 'style', 'textarea', 'option', 'noscript', 'head', 'title'];
    private const SCHEMES = ['http', 'https', 'mailto'];
    private const IMG_SCHEMES = ['http', 'https', 'data'];

    public static function rich(?string $html): ?string
    {
        if ($html === null) return null;
        $doc = new DOMDocument();
        $prev = libxml_use_internal_errors(true);
        $doc->loadHTML(
            '<!DOCTYPE html><html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"></head>'
            . '<body><div id="__sf_root">' . $html . '</div></body></html>',
            LIBXML_NONET | LIBXML_HTML_NODEFDTD,
        );
        libxml_clear_errors();
        libxml_use_internal_errors($prev);
        $root = $doc->getElementById('__sf_root');
        $out = $root ? self::children($root) : '';
        $out = trim($out);
        return $out === '' ? null : $out;
    }

    private static function children(DOMNode $node): string
    {
        $s = '';
        foreach ($node->childNodes as $child) $s .= self::node($child);
        return $s;
    }

    private static function esc(string $s, bool $quote = false): string
    {
        $s = str_replace(['&', '<', '>'], ['&amp;', '&lt;', '&gt;'], $s);
        return $quote ? str_replace('"', '&quot;', $s) : $s;
    }

    private static function node(DOMNode $n): string
    {
        if ($n instanceof DOMText) return self::esc($n->data);
        if (!$n instanceof DOMElement) return '';
        $tag = strtolower($n->tagName);
        if (!in_array($tag, self::TAGS, true)) {
            return in_array($tag, self::NON_TEXT, true) ? '' : self::children($n);
        }
        $attrs = [];
        foreach ($n->attributes as $attr) $attrs[strtolower($attr->name)] = $attr->value;
        if ($tag === 'a') {
            $attrs['rel'] = 'noopener noreferrer';
            $attrs['target'] = '_blank';
        }
        $s = '<' . $tag;
        foreach ($attrs as $name => $value) {
            if (!in_array($name, self::ATTRS[$tag] ?? [], true)) continue;
            if (($name === 'href' || $name === 'src') && self::naughty($value, $tag === 'img' ? self::IMG_SCHEMES : self::SCHEMES)) continue;
            if ($name === 'class') {
                $value = self::classes($tag, $value);
                if ($value === '') continue;
            }
            if ($name === 'style') {
                $value = self::style($tag, $value);
                if ($value === '') continue;
            }
            $s .= ' ' . $name;
            if ($value !== '') $s .= '="' . self::esc($value, true) . '"';
            elseif ($name === 'alt') $s .= '=""';
        }
        if (in_array($tag, self::SELF_CLOSING, true)) return $s . ' />';
        return $s . '>' . self::children($n) . "</$tag>";
    }

    private static function naughty(string $href, array $schemes): bool
    {
        $clean = preg_replace('/[\x00-\x20]+/', '', $href);
        if (preg_match('/^([a-zA-Z][a-zA-Z0-9.\-+]*):/', $clean, $m)) {
            return !in_array(strtolower($m[1]), $schemes, true);
        }
        return false;
    }

    private static function classes(string $tag, string $value): string
    {
        $allowed = self::CLASSES[$tag] ?? [];
        $keep = [];
        foreach (preg_split('/\s+/', trim($value)) as $c) {
            if ($c === '') continue;
            foreach ($allowed as $rule) {
                if ($rule[0] === '/' ? preg_match($rule, $c) : $rule === $c) { $keep[] = $c; break; }
            }
        }
        return implode(' ', $keep);
    }

    private static function style(string $tag, string $value): string
    {
        $allowed = (self::STYLES[$tag] ?? []) + self::STYLES_ALL;
        $keep = [];
        foreach (explode(';', $value) as $decl) {
            if (!str_contains($decl, ':')) continue;
            [$prop, $val] = array_map('trim', explode(':', $decl, 2));
            $important = false;
            if (preg_match('/\s*!important$/i', $val)) {
                $important = true;
                $val = trim(preg_replace('/\s*!important$/i', '', $val));
            }
            if (isset($allowed[$prop]) && preg_match($allowed[$prop], $val)) {
                $keep[] = "$prop:$val" . ($important ? ' !important' : '');
            }
        }
        return implode(';', $keep);
    }
}

// ----------------------------------------------------------------- bcrypt

/** bcrypt with the $2b$ prefix bcryptjs writes, so hashes work with either API. */
function bcrypt_hash(string $password): string
{
    $h = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    return '$2b$' . substr($h, 4);
}

function bcrypt_check(string $password, string $hash): bool
{
    if (str_starts_with($hash, '$2b$') || str_starts_with($hash, '$2a$')) $hash = '$2y$' . substr($hash, 4);
    return password_verify($password, $hash);
}
