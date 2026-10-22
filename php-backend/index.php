<?php
declare(strict_types=1);

// SkillForge API (PHP). Every request is routed here by .htaccess, or by
// `php -S host:port index.php` during development.

const APP_ROOT = __DIR__;

require APP_ROOT . '/src/core.php';
require APP_ROOT . '/src/http.php';
require APP_ROOT . '/src/auth.php';
require APP_ROOT . '/src/content.php';
require APP_ROOT . '/src/subjects.php';
require APP_ROOT . '/src/progress.php';
require APP_ROOT . '/src/tasks.php';
require APP_ROOT . '/src/learning.php';
require APP_ROOT . '/src/admin.php';
require APP_ROOT . '/src/routes.php';

load_env(APP_ROOT . '/.env');
ini_set('display_errors', '0');
ini_set('precision', '-1');
ini_set('serialize_precision', '-1');
date_default_timezone_set('UTC');

$req = Request::fromGlobals();
try {
    if (apply_cors($req)) exit;
    if (str_starts_with($req->path, '/api/auth') || $req->path === '/api/health') Auth::bootstrapAdmin();
    $router = new Router();
    register_routes($router);
    $router->dispatch($req);
} catch (HttpError $e) {
    send_error($e->status, $e->payload);
} catch (Throwable $e) {
    log_error(get_class($e) . ': ' . $e->getMessage() . ' at ' . $e->getFile() . ':' . $e->getLine());
    send_error(500, 'Internal server error');
}
