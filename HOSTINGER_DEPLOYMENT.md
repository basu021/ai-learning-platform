# Hostinger deployment

This project uses **MySQL** through Prisma. On Hostinger Web/Cloud hosting, create a MySQL database in **Websites -> Dashboard -> Databases -> Management**. For a database on the same Hostinger plan, the host is normally `localhost` and the port is `3306`.

Recommended domain layout:

- Frontend: `https://example.com`
- Backend API: `https://api.example.com`

Redis is not required by the current application code even though a Redis service exists in the local Docker Compose file.

## 1. Deploy the backend as a Web App

Upload a ZIP whose root is the contents of the `backend` directory. `package.json` must be at the ZIP root; do not upload the repository root as the backend app.

In Hostinger, choose **Add website -> Deploy Web App -> Upload your website files**, select NestJS and Node.js 22, then use:

- Install command: `npm ci`
- Build command: `npm run build`
- Start command: `npm run start:prod`
- Build output, if requested: `dist`
- Entry file, if requested: `dist/src/main.js`

Import environment variables using `backend/.env.hostinger.example` as the template. Do **not** set `PORT`; Hostinger provides it. The startup command runs `prisma db push` before starting NestJS, so the required tables are created in a new database. It does not use `--accept-data-loss`.

The application accepts either the separate `DB_*` variables or a `DATABASE_URL`. The separate values are recommended because database passwords containing characters such as `@`, `#`, `/`, or `:` do not need URL encoding.

After deployment, connect `api.example.com` to the Web App in Hostinger and test:

```text
https://api.example.com/api/health
```

Expected response:

```json
{"status":"ok"}
```

If Google sign-in is enabled, add this exact authorized redirect URI in Google Cloud:

```text
https://api.example.com/api/auth/google/callback
```

## 2. Build and upload the static frontend

Copy `frontend/.env.production.example` to `frontend/.env.production` and replace the API hostname. `NEXT_PUBLIC_API_URL` is embedded in the JavaScript at build time; uploading or changing the backend `.env` cannot change it.

From the `frontend` directory run:

```powershell
npm ci
npm run build:hostinger
```

Upload the **contents** of `frontend/out` to the frontend domain's `public_html` directory. Do not upload the `out` directory as another nested directory.

The static build uses these stable detail routes:

- `/tasks/view/?id=<task-id>`
- `/admin/users/view/?id=<user-id>`

They work with ordinary static file hosting and do not require a Next.js server.

## 3. Production environment checklist

Required backend values:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=your-hostinger-db-user
DB_PASSWORD=your-hostinger-db-password
DB_NAME=your-hostinger-db-name
JWT_SECRET=use-a-long-random-value
ADMIN_SETUP_KEY=use-a-different-long-random-value
FRONTEND_URL=https://example.com
GOOGLE_CALLBACK_URL=https://api.example.com/api/auth/google/callback
```

Required frontend build value:

```env
NEXT_PUBLIC_API_URL=https://api.example.com
```

Use URLs without a trailing slash. If both `www` and the apex domain will serve the frontend, `FRONTEND_URL` may contain a comma-separated allowlist, for example:

```env
FRONTEND_URL=https://example.com,https://www.example.com
```

## 4. Smoke test after deployment

1. Open `/api/health` on the API subdomain.
2. Register a new account from the frontend.
3. Confirm the new user appears in Hostinger phpMyAdmin in the `users` table.
4. Log in and open Dashboard, Tasks, and a task detail page.
5. If enabled, test Google login and SMTP separately.

Official Hostinger references:

- Web App deployment: https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/
- Environment variables: https://www.hostinger.com/support/how-to-add-environment-variables-during-node-js-application-deployment/
- Hostinger MySQL with Node.js: https://www.hostinger.com/support/connecting-a-hostinger-mysql-database-to-a-node-js-application/
- Custom Web App domain: https://www.hostinger.com/support/how-to-connect-a-custom-domain-to-a-node-js-application/

