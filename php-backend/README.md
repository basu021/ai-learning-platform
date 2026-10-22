# SkillForge API (PHP)

A PHP port of the NestJS API in `../backend`, for hosting that only runs PHP.
Same routes, request validation, JSON responses and database tables, so the
Next.js frontend works with either. No Composer packages are needed.

Requirements: PHP 8.1+ with `pdo_mysql`, `dom` and `mbstring`; MySQL 8 or
MariaDB 10.6+; Apache or LiteSpeed with `.htaccess` (mod_rewrite).

## Deploy (Hostinger or any PHP host)

1. Create the database tables: import a dump of the current data, or
   `../db/skillforge-dump.sql`. The schema is the Prisma schema in
   `../backend/prisma`; this API does not run migrations.
2. Upload the contents of this folder to the domain's document root
   (e.g. `public_html`), so `index.php` and `.htaccess` sit at the top.
3. Copy `.env.example` to `.env` and fill it in.
4. Make `uploads/` writable by PHP.
5. Check `https://<domain>/api/health` returns `{"status":"ok"}`.

`.htaccess` sends every request to `index.php`, so `.env`, `src/` and
`uploads/` are never served directly.

## Local run

```sh
php -S 127.0.0.1:3001 index.php
```

## Differences from the Node API

- Refresh tokens are stored as SHA-256 of the whole token. The Node API used
  bcrypt, which only reads the first 72 bytes, so any older refresh token of
  the same user was accepted. Tokens issued by the Node API still work once.
- Missing `title` on a new node, or a missing task-template `schedule`, gives
  a 400 validation error instead of a 500.
- Uploaded file names keep their UTF-8 characters (the Node API stored them
  as Latin-1 mojibake).
