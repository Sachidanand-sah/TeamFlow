# Deploying TeamFlow for free

Everything runs on free tiers. Total cost: 0. Time: about 30–45 minutes.

| Part                       | Service                                  | Free tier (check current terms)       |
| -------------------------- | ---------------------------------------- | ------------------------------------- |
| Web app + API + WebSockets | [Render](https://render.com) web service | 750 h/month, sleeps after 15 min idle |
| Redis (queue)              | Render Key Value                         | 25 MB, no persistence                 |
| PostgreSQL                 | [Neon](https://neon.com)                 | ~0.5–1 GB, scales to zero             |
| File storage               | [Supabase](https://supabase.com) Storage | 1 GB                                  |
| Email                      | [Brevo](https://www.brevo.com) SMTP      | 300 emails/day                        |

Why one Render service for both frontend and API: the refresh-token cookie is
`SameSite=Strict`, so the web app and API must share one origin (see
[ADR 0007](adr/0007-free-tier-deployment.md)).

Pick the **Singapore** region (or the same region) everywhere, so the services are close
to each other.

---

## 1. Database: Neon

1. Sign up at neon.com → **Create project** → name `teamflow`, Postgres 17, region
   **AWS Asia Pacific (Singapore)**.
2. Open **Connect**. Copy two connection strings:
   - **Pooled** (host contains `-pooler`) → this is `DATABASE_URL`.
   - **Direct** (turn "Connection pooling" off) → this is `DIRECT_URL`.
     Both end with `?sslmode=require`; keep that.

## 2. File storage: Supabase

1. Sign up at supabase.com → **New project** → region **Southeast Asia (Singapore)**.
   (The project's database is not used; only Storage.)
2. **Storage → New bucket** → name `teamflow-attachments`, **Public: off**.
3. **Project Settings → Storage → S3 Connection**: make sure S3 access is enabled. Note:
   - **Endpoint** → `S3_ENDPOINT` (looks like `https://<ref>.supabase.co/storage/v1/s3`)
   - **Region** → `S3_REGION` (e.g. `ap-southeast-1`)
4. **New access key** → copy **Access key ID** → `S3_ACCESS_KEY` and **Secret** →
   `S3_SECRET_KEY` (shown once).

## 3. Email: Brevo

1. Sign up at brevo.com (free plan).
2. **Senders, domains & dedicated IPs → Senders**: add and verify the address you will
   send from (e.g. your Gmail). Emails can only come from a verified sender.
3. **SMTP & API → SMTP**: note the **Login** → `SMTP_USER`, then **Generate a new SMTP
   key** → `SMTP_PASSWORD`.
4. `MAIL_FROM` = `TeamFlow <the-verified-address@example.com>`.

## 4. App + Redis: Render

1. Sign up at render.com with **GitHub** and allow access to the `TeamFlow` repository.
2. **New → Blueprint** → choose the repository. Render reads `render.yaml` and shows
   two resources: `teamflow` (web) and `teamflow-queue` (Key Value).
3. It asks for the `sync: false` values. Fill in everything from steps 1–3.
   For `CORS_ORIGIN` and `APP_URL` you need the service URL, which you only know after
   creation: enter `https://teamflow.onrender.com` for now.
4. **Apply**. The first build takes ~5–10 minutes. The start command runs the database
   migrations automatically.
5. When it is live, open the service page and copy its URL (e.g.
   `https://teamflow-abcd.onrender.com`). If it differs from what you entered, go to
   **Environment**, set `CORS_ORIGIN` and `APP_URL` to it (no trailing slash), and save
   (Render redeploys).

## 5. Check it

1. Open the URL. The first request after idle takes up to a minute (free tier wakes up).
2. Register, create a workspace, a project and a task.
3. Open the same board in a second browser (or a private window, as a second user you
   added to the workspace): moving a card shows up live in the other window.
4. Attach a small PDF to a task, then download it.
5. Assign a task to the second user: they receive an email (check spam the first time).

Every `git push` to `main` redeploys automatically.

## Free-tier behaviour to expect

- **Sleep:** after 15 minutes without traffic the service sleeps; the next visit waits
  ~1 minute. Open WebSockets are closed and reconnect on wake-up. The hourly cleanup job
  only runs while the service is awake.
- **Redis has no persistence:** queued emails waiting at the moment of a restart are
  lost. Fine for notifications.
- **Neon** suspends compute after 5 idle minutes; the first query after that is slower.

## Troubleshooting

| Symptom                                               | Fix                                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Deploy fails with `Invalid environment configuration` | A variable is missing or malformed; the log names it.                                       |
| Login works but you are logged out on reload          | `CORS_ORIGIN`/`APP_URL` do not match the real URL exactly (https, no trailing slash).       |
| Upload fails in the browser with a CORS error         | Check the bucket name and `S3_ENDPOINT`; the CSP allows only the `S3_ENDPOINT` origin.      |
| Upload says "failed verification"                     | The file changed or the bucket rejected the headers; try again, then check the Render logs. |
| No emails                                             | Sender not verified in Brevo, or wrong SMTP key; Render logs show the SMTP error.           |
| Build runs out of memory                              | Render → Settings → set `NODE_OPTIONS` to `--max-old-space-size=1536`, redeploy.            |

## Local development is unchanged

`docker compose up -d` still provides Postgres, Redis, MinIO and Mailpit locally;
`TRUST_PROXY` and `SERVE_WEB_APP` stay `false` in `.env`.
