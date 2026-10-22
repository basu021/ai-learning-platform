# Deploying SkillForge

All development happens in this repo (`ai-learning-platform`). Production on
Hostinger does not deploy from it. It deploys from two separate GitHub repos,
each a copy of one folder here:

| Folder here    | GitHub repo (branch `main`)                                                   | Hostinger site                                                  | Runs as             |
| -------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------- |
| `frontend/`    | [basu021/ai-learning-front](https://github.com/basu021/ai-learning-front)     | [learn.rbasu.in](https://learn.rbasu.in)                        | Node.js web app (Next.js) |
| `php-backend/` | [basu021/ai-learn-backend](https://github.com/basu021/ai-learn-backend)       | [learnbackend.rbasu.in](https://learnbackend.rbasu.in)          | PHP site (`public_html`)  |
| (database)     | schema in `php-backend/database/`                                             | Hostinger MySQL `u807244070_learnbackend`                       | MySQL / MariaDB     |

The two deploy repos are written only by `deploy/sync-repos.sh`. Never edit them
directly: the next sync overwrites them with this repo's folders.

`backend/` (NestJS) is the old API, kept as a reference and for rollback. It is
not deployed. API changes go in `php-backend/`.

---

## 1. Local development

```sh
docker compose up -d --build        # frontend :3100, PHP API :3101, MySQL :3406
```

Open http://10.150.216.42:3100. Ports and the public IP live in the root `.env`
(git-ignored).

Don't use `pkill -f …` on this server: other containers' processes are visible,
and the pattern can match your own shell.

## 2. Deploy

A deploy happens only when the owner asks for it. Run it from the repo root.

### 2.1 Commit and push this repo

Only committed code gets deployed; the sync script refuses to run with uncommitted
changes in `frontend/` or `php-backend/`.

```sh
git add -A && git commit -m "…"
git push origin HEAD
```

### 2.2 Database changes, if there are any

Skip this step if no tables, columns or seed content changed. Otherwise see
[section 3](#3-database-changes). In short:

```sh
deploy/db.sh schema             # refresh php-backend/database/schema.sql, then commit it
deploy/db.sh status prod        # see which migrations Hostinger is missing
deploy/db.sh migrate prod       # back up the Hostinger DB, then apply them
```

Apply DB changes **before** deploying the backend code that needs them.

### 2.3 Sync the deploy repos

```sh
deploy/sync-repos.sh --dry-run  # shows what changes in each repo; pushes nothing
deploy/sync-repos.sh            # pushes both (or: deploy/sync-repos.sh frontend)
```

For each folder, the script:
- mirrors the folder into a clone of its repo (default location `~/.cache/skillforge-deploy-repos`);
- commits the change with the same message and author as this repo's last commit;
- pushes the commit to `main`.

It refuses to push a `.env` file. For the backend it also writes an upload ZIP,
`~/skillforge-deploy/learnbackend-php-<commit>.zip`, which contains no `.env`.

### 2.4 Hand-over: tell the owner what to deploy

After pushing, send the owner a message like the one below, with the real
commit IDs and only the parts that apply:

> **Pushed, ready to deploy.**
> - Frontend: `ai-learning-front` main @ `<sha>`. In hPanel → Websites →
>   learn.rbasu.in, click **Redeploy**.
> - Backend: `ai-learn-backend` main @ `<sha>`. In hPanel → File Manager →
>   `public_html` of learnbackend.rbasu.in, upload `learnbackend-php-<sha>.zip`
>   and **Extract**, overwriting. Don't delete `.env` or `uploads/`.
>   (If the site uses Git deploy instead, click **Pull**.)
> - Database: already applied (`<migration names>`), or "no DB changes".
> - What changed: <one line per user-visible change>.
> - Then check: https://learnbackend.rbasu.in/api/health shows
>   `{"status":"ok"}`, and you can log in on https://learn.rbasu.in.

### 2.5 Owner: deploy on Hostinger

**Frontend (learn.rbasu.in, Node.js web app)**
1. hPanel → Websites → learn.rbasu.in → **Redeploy**. It builds `ai-learning-front` `main`.
2. Settings, only needed the first time or after they're lost:
   - Build command `npm run build`; start command `npm start`.
   - Environment variables:
     ```
     NEXT_PUBLIC_API_URL=https://learnbackend.rbasu.in
     API_INTERNAL_URL=https://learnbackend.rbasu.in
     ```
   - Do **not** set `NEXT_OUTPUT`: that switches to a static export, which
     `npm start` can't run.
3. `NEXT_PUBLIC_API_URL` is baked in at build time. After changing it, redeploy.

**Backend (learnbackend.rbasu.in, PHP)**
1. Use either way:
   - **ZIP:** File Manager → `public_html` → upload the ZIP → Extract, overwriting files.
   - **Git:** hPanel → Advanced → Git → **Pull** on the `ai-learn-backend` deployment.
     Setting up Git deploy needs an empty folder, so download `public_html/.env` and
     `public_html/uploads/` first and put them back afterwards.
2. `public_html/.env` lives only on the server; it's never in Git or the ZIP. Its
   keys are in `php-backend/.env.example`. The ones that matter:
   - `DB_*`: Hostinger DB (host `localhost`).
   - `JWT_SECRET`: changing it signs everyone out.
   - `ATTACHMENT_SECRET`: changing it breaks images already in content.
   - `FRONTEND_URL=https://learn.rbasu.in` and `CORS_ORIGINS=https://learn.rbasu.in`.
     A wrong CORS value shows up as "Failed to fetch" on the site.
3. `uploads/` holds uploaded images and files. It must stay writable, and you
   should never delete it.

### 2.6 Check

- https://learnbackend.rbasu.in/api/health shows `{"status":"ok"}`.
- https://learnbackend.rbasu.in/.env gives 403 or 404, never the file.
- On https://learn.rbasu.in:
  - you can log in;
  - the dashboard loads;
  - a subject and a chapter with an image open.
- Browser console has no errors. "Cannot read properties of undefined" usually
  means an old frontend build is still being served: redeploy it.

## 3. Database changes

Production has its own users, progress and content. **Change it with migrations,
not by replacing it.**

### Migrations (the normal way)

1. Write the change as SQL in `php-backend/database/migrations/`. Name files so they
   sort in order: `YYYYMMDD-HHMM_short_name.sql`, e.g. `20261105-1000_add_badges.sql`.
   - Make them safe to run on existing data, e.g. `ALTER TABLE … ADD COLUMN … DEFAULT …`.
   - `INSERT IGNORE` for seed rows.
   - It must work on both MySQL 8 (local) and MariaDB (Hostinger).
2. Apply locally and test: `deploy/db.sh migrate local`.
3. Refresh the schema file and commit both: `deploy/db.sh schema`.
4. At deploy time: `deploy/db.sh migrate prod`. It dumps the Hostinger DB to
   `~/skillforge-backups/hostinger-<time>.sql` first, then applies only the
   pending files. Applied names are recorded in the `deploy_migrations` table,
   so each file runs once.

`deploy/db.sh status local|prod` lists every migration and whether it has run.

### Full replace (rare; only when the owner asks)

`deploy/db.sh replace <dump.sql>` backs up Hostinger and drops **every** table,
then loads the dump. Production users and progress that aren't in the dump are
lost; you have to type `REPLACE` to confirm.

Make the dump with `deploy/db.sh dump-local`.

Images in content carry a signature made with `ATTACHMENT_SECRET`. If the
local and Hostinger secrets differ, images in the copied content break after a
replace until they're re-signed with the Hostinger secret.

### Connection settings

`deploy/db.sh` reads `deploy/.env` (git-ignored; template `deploy/.env.example`):
- the Hostinger DB host, name and user;
- the password, which is asked for when not set.

It uses the local `skillforge-mysql` container as the MySQL client.

Hostinger only accepts remote connections from IPs listed in hPanel → Databases →
Remote MySQL.

## 4. Rollback

- **Frontend or backend code:** in the deploy repo, revert the last commit, push,
  and redeploy, as below. Or check out an older commit here and run
  `deploy/sync-repos.sh` again.
  ```sh
  cd ~/.cache/skillforge-deploy-repos/<frontend|php-backend>
  git revert HEAD && git push
  ```
- **Database:** load the backup the migrate step made:
  `deploy/db.sh replace ~/skillforge-backups/hostinger-<time>.sql`.

## 5. Rules

- Never commit `.env` files or put passwords in docs, commits or chat logs.
  Keep backups and ZIPs `chmod 600`.
- Don't push to the deploy repos until a deploy is asked for.
- Back up the production DB before writing to it. `migrate` and `replace` do
  this for you.
