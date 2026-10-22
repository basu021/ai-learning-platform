<?php
declare(strict_types=1);

/** Same paths, methods and guards as the Nest controllers. */
function register_routes(Router $r): void
{
    $admin = ['roles' => ['ADMIN']];
    $ok = ['status' => 200];

    // ---- health & auth
    $r->get('/api/health', function () {
        Db::scalar('SELECT 1');
        return ['status' => 'ok'];
    }, ['auth' => false]);
    $r->post('/api/auth/register', fn(Request $q) => Auth::register($q->body()), ['auth' => false]);
    $r->post('/api/auth/login', fn(Request $q) => Auth::login($q->body()), ['auth' => false, 'status' => 200]);
    $r->get('/api/auth/google', fn() => Auth::googleRedirect(), ['auth' => false]);
    $r->get('/api/auth/google/callback', fn(Request $q) => Auth::googleCallback($q), ['auth' => false]);
    $r->post('/api/auth/refresh', fn(Request $q) => Auth::refresh($q->body()), ['auth' => false, 'status' => 200]);
    $r->post('/api/auth/logout', fn(Request $q) => Auth::logout($q->user['id']), $ok);
    $r->get('/api/auth/profile', fn(Request $q) => Auth::profile($q->user['id']));

    // ---- notifications
    $r->get('/api/notifications', fn(Request $q) => Notifications::list($q->user['id']));
    $r->post('/api/notifications/read-all', fn(Request $q) => Notifications::markAllRead($q->user['id']));
    $r->post('/api/notifications/:id/read', fn(Request $q) => Notifications::markRead($q->user['id'], $q->param('id')));

    // ---- subjects
    $r->get('/api/subjects', fn(Request $q) => Subjects::list($q->user, $q->query));
    $r->post('/api/subjects', fn(Request $q) => Subjects::create($q->user, $q->body()));
    $r->get('/api/subjects/:id', fn(Request $q) => Subjects::get($q->user, $q->param('id')));
    $r->put('/api/subjects/:id', fn(Request $q) => content_edit($q, null, 'UPDATE'));
    $r->patch('/api/subjects/:id/settings', fn(Request $q) => Subjects::updateSettings($q->user, $q->param('id'), $q->body()));
    $r->delete('/api/subjects/:id', fn(Request $q) => Subjects::remove($q->user, $q->param('id')));

    $r->post('/api/subjects/:id/nodes', fn(Request $q) => content_edit($q, null, 'CREATE'));
    $r->post('/api/subjects/:id/nodes/reorder', function (Request $q) {
        $dto = V::check($q->body(), [
            'parentId' => ['optional', 'string'],
            'orderedIds' => ['array', 'each' => 'string'],
        ]);
        return Content::reorder($q->user, $q->param('id'), $dto['parentId'] ?? null, $dto['orderedIds']);
    });
    $r->get('/api/subjects/:id/nodes/:nodeId', fn(Request $q) => Content::getNode($q->user, $q->param('id'), $q->param('nodeId')));
    $r->put('/api/subjects/:id/nodes/:nodeId', fn(Request $q) => content_edit($q, $q->param('nodeId'), 'UPDATE'));
    $r->delete('/api/subjects/:id/nodes/:nodeId', fn(Request $q) => Content::submit(
        $q->user, $q->param('id'), $q->param('nodeId'), 'DELETE', [], $q->q('note'),
    ));
    $r->patch('/api/subjects/:id/nodes/:nodeId/preview', function (Request $q) {
        $dto = V::check($q->body(), ['isPreview' => ['bool']]);
        return Content::setPreview($q->user, $q->param('id'), $q->param('nodeId'), $dto['isPreview']);
    });

    $r->get('/api/subjects/:id/changes', fn(Request $q) => Content::listChanges($q->user, $q->param('id'), $q->q('status')));
    $r->get('/api/subjects/:id/revisions', fn(Request $q) => Content::listRevisions(
        $q->user, $q->param('id'), array_key_exists('nodeId', $q->query), $q->q('nodeId'),
    ));
    $r->get('/api/subjects/:id/trash', fn(Request $q) => Content::listTrash($q->user, $q->param('id')));

    $r->get('/api/subjects/:id/members', fn(Request $q) => Subjects::listMembers($q->user, $q->param('id')));
    $r->post('/api/subjects/:id/members', fn(Request $q) => Subjects::addMembers($q->user, $q->param('id'), $q->body()));
    $r->patch('/api/subjects/:id/members/:userId', fn(Request $q) => Subjects::updateMember($q->user, $q->param('id'), $q->param('userId'), $q->body()));
    $r->delete('/api/subjects/:id/members/:userId', fn(Request $q) => Subjects::removeMember($q->user, $q->param('id'), $q->param('userId')));
    $r->post('/api/subjects/:id/access-requests', fn(Request $q) => Subjects::requestAccess($q->user, $q->param('id'), $q->body()));
    $r->get('/api/subjects/:id/access-requests', fn(Request $q) => Subjects::listAccessRequests($q->user, $q->param('id'), $q->q('status')));

    // ---- reviews
    $review = fn(Request $q) => V::check($q->body(), ['note' => ['optional', 'string', 'max' => 500]])['note'] ?? null;
    $r->post('/api/changes/:id/approve', fn(Request $q) => Content::reviewChange($q->user, $q->param('id'), true, $review($q)));
    $r->post('/api/changes/:id/reject', fn(Request $q) => Content::reviewChange($q->user, $q->param('id'), false, $review($q)));
    $r->post('/api/revisions/:id/restore', fn(Request $q) => Content::restoreRevision($q->user, $q->param('id')));
    $r->post('/api/access-requests/:id/approve', fn(Request $q) => Subjects::decideAccessRequest($q->user, $q->param('id'), true));
    $r->post('/api/access-requests/:id/reject', fn(Request $q) => Subjects::decideAccessRequest($q->user, $q->param('id'), false));

    // ---- categories
    $r->get('/api/categories', fn() => Subjects::listCategories());
    $r->post('/api/categories', fn(Request $q) => Subjects::createCategory($q->body()), $admin);
    $r->delete('/api/categories/:id', fn(Request $q) => Subjects::deleteCategory($q->param('id')), $admin);

    // ---- reading progress
    $r->get('/api/progress/recent', fn(Request $q) => Progress::recent($q->user['id']));
    $r->get('/api/progress/subjects/:id', fn(Request $q) => Progress::get($q->user, $q->param('id')));
    $r->post('/api/progress/subjects/:id/heartbeat', fn(Request $q) => Progress::heartbeat($q->user, $q->param('id'), $q->body()));
    $r->post('/api/progress/subjects/:id/complete', fn(Request $q) => Progress::setComplete($q->user, $q->param('id'), $q->body(), true));
    $r->post('/api/progress/subjects/:id/uncomplete', fn(Request $q) => Progress::setComplete($q->user, $q->param('id'), $q->body(), false));
    $r->post('/api/progress/subjects/:id/reset', fn(Request $q) => Progress::reset($q->user, $q->param('id'), $q->body()));
    $r->get('/api/progress/users/:userId', fn(Request $q) => Progress::adminForUser($q->param('userId')), $admin);

    // ---- attachments
    $r->post('/api/subjects/:id/attachments', fn(Request $q) => Attachments::upload($q->user, $q->param('id'), $q));
    $r->get('/api/attachments/:id', fn(Request $q) => Attachments::download($q->user, $q->param('id')));
    $r->get('/api/attachments/:id/raw', fn(Request $q) => Attachments::raw($q->param('id'), $q->q('sig')), ['auth' => false]);
    $r->delete('/api/attachments/:id', fn(Request $q) => Attachments::remove($q->user, $q->param('id')));

    // ---- tasks
    $r->post('/api/tasks', fn(Request $q) => Tasks::create($q->user, $q->body()));
    $r->get('/api/tasks', fn(Request $q) => Tasks::list($q->user, $q->query));
    $r->get('/api/tasks/agenda', fn(Request $q) => Tasks::agenda($q->user['id']));
    $r->get('/api/tasks/history', fn(Request $q) => Tasks::history($q->user, $q->q('userId') ?: $q->user['id']));
    $r->get('/api/tasks/occurrences/:id', fn(Request $q) => Tasks::getOccurrence($q->user, $q->param('id')));
    $r->post('/api/tasks/occurrences/:id/start', fn(Request $q) => Tasks::start($q->user, $q->param('id')));
    $r->post('/api/tasks/occurrences/:id/skip', fn(Request $q) => Tasks::skip($q->user, $q->param('id')));
    $r->post('/api/tasks/sessions/:id/finish', fn(Request $q) => Tasks::finishSession($q->user, $q->param('id')));
    $r->get('/api/tasks/:id', fn(Request $q) => Tasks::get($q->user, $q->param('id')));
    $r->put('/api/tasks/:id', fn(Request $q) => Tasks::update($q->user, $q->param('id'), $q->body()));
    $r->delete('/api/tasks/:id', fn(Request $q) => Tasks::remove($q->user, $q->param('id')));

    $r->get('/api/task-templates', fn(Request $q) => Templates::list($q->q('subjectId')), $admin);
    $r->post('/api/task-templates', fn(Request $q) => Templates::create($q->user, $q->body()), $admin);
    $r->put('/api/task-templates/:id', fn(Request $q) => Templates::update($q->param('id'), $q->body()), $admin);
    $r->delete('/api/task-templates/:id', fn(Request $q) => Templates::remove($q->param('id')), $admin);

    // ---- feedback, gamification, dashboard
    $r->post('/api/feedback', fn(Request $q) => Feedback::create($q->user['id'], $q->body()));
    $r->get('/api/feedback/my', fn(Request $q) => Feedback::findByUser($q->user['id']));
    $r->get('/api/gamification/stats', fn(Request $q) => Gamification::stats($q->user['id']));
    $r->get('/api/gamification/heatmap', fn(Request $q) => Gamification::heatmap($q->user['id']));
    $r->get('/api/dashboard', fn(Request $q) => Dashboard::get($q->user['id']));

    // ---- admin
    $r->get('/api/admin/stats', fn() => Admin::stats(), $admin);
    $r->get('/api/admin/users', fn(Request $q) => Admin::listUsers($q->q('q')), $admin);
    $r->post('/api/admin/users', fn(Request $q) => Admin::createUser($q->body()), $admin);
    $r->get('/api/admin/users/:id', fn(Request $q) => Admin::userDetail($q->param('id')), $admin);
    $r->patch('/api/admin/users/:id', fn(Request $q) => Admin::updateUser($q->user, $q->param('id'), $q->body()), $admin);
    $r->get('/api/admin/access-requests', fn() => Admin::pendingAccessRequests(), $admin);
    $r->get('/api/admin/changes', fn() => Admin::pendingChanges(), $admin);
    $r->get('/api/users/search', fn(Request $q) => Admin::searchUsers($q->user['id'], $q->q('q') ?? ''));
}

/** PUT subject / POST node / PUT node: content edits that may need approval. */
function content_edit(Request $q, ?string $nodeId, string $action): array
{
    $spec = [
        'title' => ['optional', 'string', 'min' => 1, 'max' => 191],
        'summary' => ['optional', 'string', 'max' => 1000],
        'content' => ['optional', 'string'],
        'changeNote' => ['optional', 'string', 'max' => 500],
    ];
    if ($action === 'CREATE') {
        $spec['title'] = ['string', 'min' => 1, 'max' => 191];
        $spec['type'] = ['in' => ['CHAPTER', 'TOPIC', 'SUBTOPIC']];
        $spec['parentId'] = ['optional', 'string'];
    }
    $dto = V::check($q->body(), $spec);
    $note = $dto['changeNote'] ?? null;
    unset($dto['changeNote']);
    return Content::submit($q->user, $q->param('id'), $nodeId, $action, $dto, $note);
}
