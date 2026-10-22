<?php
declare(strict_types=1);

final class Request
{
    public array $params = [];
    /** Signed-in user: id, email, name, username, role. */
    public ?array $user = null;
    private ?array $jsonBody = null;

    public function __construct(
        public readonly string $method,
        public readonly string $path,
        public readonly array $query,
        public readonly array $headers,
    ) {}

    public static function fromGlobals(): self
    {
        $headers = [];
        foreach ($_SERVER as $k => $v) {
            if (str_starts_with($k, 'HTTP_')) $headers[strtolower(str_replace('_', '-', substr($k, 5)))] = $v;
        }
        foreach (['CONTENT_TYPE' => 'content-type', 'CONTENT_LENGTH' => 'content-length'] as $k => $h) {
            if (isset($_SERVER[$k])) $headers[$h] = $_SERVER[$k];
        }
        // Apache/LiteSpeed CGI setups pass the Authorization header through a rewrite variable.
        $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? null;
        if ($auth === null && function_exists('getallheaders')) {
            foreach (getallheaders() as $k => $v) if (strtolower($k) === 'authorization') $auth = $v;
        }
        if ($auth !== null && $auth !== '') $headers['authorization'] = $auth;

        $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        // Installed in a sub-folder: strip it so routes always start at /api.
        $base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
        if ($base !== '' && str_starts_with($path, $base . '/')) $path = substr($path, strlen($base));
        $path = rawurldecode($path);
        if ($path !== '/' && str_ends_with($path, '/')) $path = rtrim($path, '/');

        return new self(strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET'), $path, $_GET, $headers);
    }

    public function header(string $name): ?string
    {
        return $this->headers[strtolower($name)] ?? null;
    }

    public function body(): array
    {
        if ($this->jsonBody === null) {
            $raw = file_get_contents('php://input');
            $this->jsonBody = [];
            if ($raw !== false && trim($raw) !== '' && str_contains((string) $this->header('content-type'), 'json')) {
                $decoded = json_decode($raw, true);
                if (json_last_error() !== JSON_ERROR_NONE) bad_request('Invalid JSON body');
                $this->jsonBody = is_array($decoded) ? $decoded : [];
            }
        }
        return $this->jsonBody;
    }

    public function param(string $name): string
    {
        return $this->params[$name];
    }

    /** Query string value; arrays (?a[]=1) are ignored like an absent value. */
    public function q(string $name): ?string
    {
        $v = $this->query[$name] ?? null;
        return is_string($v) ? $v : null;
    }
}

/** A handler result that writes its own response (files, redirects). */
final class RawResponse
{
    public function __construct(public readonly Closure $send) {}
}

final class Router
{
    private array $routes = [];

    /**
     * @param array{auth?: bool, roles?: string[], status?: int} $opts
     */
    public function add(string $method, string $pattern, callable $handler, array $opts = []): void
    {
        $regex = '#^' . preg_replace('#:(\w+)#', '(?P<$1>[^/]+)', $pattern) . '$#';
        $this->routes[] = [$method, $regex, $handler, $opts + ['auth' => true, 'roles' => [], 'status' => null]];
    }

    public function get(string $p, callable $h, array $o = []): void { $this->add('GET', $p, $h, $o); }
    public function post(string $p, callable $h, array $o = []): void { $this->add('POST', $p, $h, $o); }
    public function put(string $p, callable $h, array $o = []): void { $this->add('PUT', $p, $h, $o); }
    public function patch(string $p, callable $h, array $o = []): void { $this->add('PATCH', $p, $h, $o); }
    public function delete(string $p, callable $h, array $o = []): void { $this->add('DELETE', $p, $h, $o); }

    public function dispatch(Request $req): void
    {
        $method = $req->method === 'HEAD' ? 'GET' : $req->method;
        foreach ($this->routes as [$m, $regex, $handler, $opts]) {
            if ($m !== $method || !preg_match($regex, $req->path, $match)) continue;
            foreach ($match as $k => $v) if (is_string($k)) $req->params[$k] = $v;
            if ($opts['auth']) $req->user = Auth::authenticate($req);
            if ($opts['roles'] && !in_array($req->user['role'], $opts['roles'], true)) {
                forbidden('Forbidden resource');
            }
            $result = $handler($req);
            if ($result instanceof RawResponse) {
                ($result->send)();
                return;
            }
            $status = $opts['status'] ?? ($method === 'POST' ? 201 : 200);
            send_json($status, $result);
            return;
        }
        not_found("Cannot {$req->method} {$req->path}");
    }
}

function send_json(int $status, mixed $data): void
{
    http_response_code($status);
    // Like Express, a null result is an empty body.
    if ($data === null) return;
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
}

function send_error(int $status, string|array $message): void
{
    send_json($status, [
        'success' => false,
        'statusCode' => $status,
        'message' => $message,
        'timestamp' => iso(now_db()),
    ]);
}

/** Same rules as the Nest app's enableCors({ origin: [...], credentials: true }). */
function apply_cors(Request $req): bool
{
    $origins = array_map('trim', explode(',', env('CORS_ORIGINS') ?? env('FRONTEND_URL') ?? 'http://localhost:3000'));
    $origin = $req->header('origin');
    if ($origin !== null && in_array($origin, $origins, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
        header('Vary: Origin');
    }
    if ($req->method === 'OPTIONS') {
        header('Access-Control-Allow-Methods: GET,HEAD,PUT,PATCH,POST,DELETE');
        $asked = $req->header('access-control-request-headers');
        if ($asked) {
            header('Access-Control-Allow-Headers: ' . $asked);
            header('Vary: Origin, Access-Control-Request-Headers', false);
        }
        header('Content-Length: 0');
        http_response_code(204);
        return true;
    }
    return false;
}
