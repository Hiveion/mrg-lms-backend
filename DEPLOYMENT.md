# Deploying MRG LMS Backend to Railway

## Prerequisites

- Node.js 20+
- Railway account — [railway.app](https://railway.app)
- Railway CLI (optional): `npm install -g @railway/cli`
- Code pushed to a GitHub repository

## What's Already Configured


| File            | Purpose                                                 |
| --------------- | ------------------------------------------------------- |
| `Dockerfile`    | Builds the NestJS app using Node 20                     |
| `start.sh`      | Runs `prisma migrate deploy` then starts the server     |
| `railway.toml`  | Tells Railway to use the Dockerfile with restart policy |
| `.dockerignore` | Excludes `.env`, `node_modules`, `dist` from the image  |


---

## Step 1 — Create a Railway Project

**Via dashboard:**

1. Go to [railway.app/new](https://railway.app/new)
2. Click **Deploy from GitHub repo**
3. Select this repository and the `main` branch

**Via CLI:**

```bash
railway login
railway init
```

---

## Step 2 — Add PostgreSQL

1. Inside your Railway project, click **New** → **Database** → **Add PostgreSQL**
2. Railway automatically provisions the database and creates a `DATABASE_URL` variable
3. In your app service, go to **Variables** and add:
  ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
  ```
   This links the Postgres plugin's URL directly to your app.

---

## Step 3 — Link the GitHub Repo (for auto-deploys)

1. In your app service, click **Settings** → **Source**
2. Connect to your GitHub repo and select the `main` branch
3. Enable **Auto Deploy** so every push to `main` triggers a redeploy

---

## Step 4 — Set Environment Variables

In your app service, go to **Variables** and add all of the following:


| Variable                | Description                             | Example Value                                            |
| ----------------------- | --------------------------------------- | -------------------------------------------------------- |
| `DATABASE_URL`          | Auto-set by Railway Postgres plugin     | `${{Postgres.DATABASE_URL}}`                             |
| `BACKEND_URL`           | The public URL Railway assigns your app | `https://mrg-lms.railway.app`                            |
| `FRONTEND_URL`          | Your frontend app's URL                 | `https://mrg-frontend.vercel.app`                        |
| `JWT_SECRET`            | Secret key for signing JWTs             | any long random string                                   |
| `GOOGLE_CLIENT_ID`      | Google OAuth 2.0 client ID              | from Google Cloud Console                                |
| `GOOGLE_CLIENT_SECRET`  | Google OAuth 2.0 client secret          | from Google Cloud Console                                |
| `GOOGLE_CALLBACK_URL`   | OAuth redirect URI                      | `https://<your-domain>.railway.app/auth/google/callback` |
| `MAIL_HOST`             | SMTP server hostname                    | `sandbox.smtp.mailtrap.io`                               |
| `MAIL_PORT`             | SMTP port                               | `587`                                                    |
| `MAIL_USER`             | SMTP username                           | from your mail provider                                  |
| `MAIL_PASS`             | SMTP password                           | from your mail provider                                  |
| `MAIL_FROM`             | Sender name and address                 | `"MRG LMS <noreply@mrg-lms.com>"`                        |
| `EXCHANGE_RATE_API_KEY` | API key for exchange rate service       | from exchangerate-api.com                                |


> `PORT` does **not** need to be set — Railway injects it automatically.

---

## Step 5 — Deploy

**Via dashboard:** Click **Deploy** in the Railway project.

**Via CLI:**

```bash
railway up
```

The build process:

1. Railway builds the Docker image
2. Runs `npx prisma migrate deploy` (applies any pending DB migrations)
3. Starts the NestJS server

---

## Step 6 — Verify the Deploy

1. **Build logs** — confirm you see `prisma migrate deploy` completing without errors
2. **App logs** — confirm you see `Application is running on: https://...railway.app`
3. **Health check** — open your Railway domain in a browser or run:
  ```bash
   curl https://<your-domain>.railway.app/
  ```
4. **Google OAuth** — update the Authorized Redirect URIs in your [Google Cloud Console](https://console.cloud.google.com) to include:
  ```
   https://<your-domain>.railway.app/auth/google/callback
  ```

---

## Re-deploying / Updates

Push to `main` — Railway will automatically rebuild and redeploy.

To trigger a manual redeploy from the CLI:

```bash
railway up
```

---

## Running Migrations Manually

If you need to run migrations without a full redeploy:

```bash
railway run npx prisma migrate deploy
```

---

## Troubleshooting


| Problem                                | Fix                                                                               |
| -------------------------------------- | --------------------------------------------------------------------------------- |
| Build fails at `prisma generate`       | Ensure `prisma` is in `dependencies` (not just `devDependencies`)                 |
| App crashes with `DATABASE_URL` error  | Confirm the Postgres plugin is added and `${{Postgres.DATABASE_URL}}` is set      |
| Google OAuth returns redirect mismatch | Update the callback URL in Google Cloud Console to match your Railway domain      |
| Port not binding                       | Do not set `PORT` manually — Railway injects it; the app reads `process.env.PORT` |
| Migrations fail on first deploy        | Check the Railway Postgres service is healthy before the app service starts       |


