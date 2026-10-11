# TeamFlow

Team project-management platform (a small Jira/Trello): workspaces with roles,
projects, a real-time Kanban board, comments, activity history, file attachments
and email notifications.

Nx monorepo with an Angular frontend and a NestJS API on PostgreSQL (Prisma),
Redis/BullMQ, Socket.IO and S3-compatible storage.

| Path           | What                                                              |
| -------------- | ----------------------------------------------------------------- |
| `apps/web`     | Angular app (standalone components, signals, zoneless)            |
| `apps/api`     | NestJS API, one module per domain (modular monolith)              |
| `libs/shared`  | Framework-free contracts and rules shared by web + api            |
| `libs/ui`      | Angular design-system components                                  |
| `apps/web-e2e` | Playwright end-to-end tests                                       |
| `docs`         | [ADRs](docs/adr) and the [permission matrix](docs/permissions.md) |

## Status: MVP complete

- [x] Auth: register, login, refresh (rotating cookie), logout ([ADR 0002](docs/adr/0002-auth-access-and-refresh-tokens.md))
- [x] Workspaces and membership with roles ([ADR 0003](docs/adr/0003-workspace-tenancy-and-rbac.md))
- [x] Projects
- [x] Tasks with Kanban statuses (drag-and-drop board, assignees, priorities)
- [x] Comments and activity log
- [x] Real-time board updates ([ADR 0004](docs/adr/0004-realtime-board-updates.md))
- [x] File attachments ([ADR 0005](docs/adr/0005-attachments-presigned-uploads.md))
- [x] Email notifications via queue ([ADR 0006](docs/adr/0006-notifications-queue.md))

## Getting started

Requirements: Node.js 22+ and Docker Desktop.

```bash
npm install
cp .env.example .env          # then set JWT_ACCESS_SECRET to a long random string
docker compose up -d          # postgres, redis, minio, mailpit
npx prisma migrate dev        # apply database migrations
npx nx serve web              # starts the API too; open http://localhost:4200
```

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Local services:

| Service       | URL                       | Notes                                      |
| ------------- | ------------------------- | ------------------------------------------ |
| Web app       | http://localhost:4200     | proxies `/api` and `/socket.io` to the API |
| API           | http://localhost:3000/api | `GET /api/health`                          |
| Mailpit inbox | http://localhost:8025     | every email sent locally lands here        |
| MinIO console | http://localhost:9001     | user/password from `.env`                  |

## Everyday commands

```bash
npx nx run-many -t lint test build     # everything CI checks
npx nx test api                        # API unit tests
npx nx e2e web-e2e                     # Playwright (first run: npx playwright install chromium)
npx prisma migrate dev --name <change> # after editing apps/api/prisma/schema.prisma
```

## Security model (short version)

- Short-lived access JWT kept in memory only; refresh token in an httpOnly, Secure,
  SameSite=Strict cookie, rotated on every use with reuse detection; argon2id passwords.
- Every workspace route checks membership in the database; non-members get 404.
  Every query filters by workspace. Roles: OWNER, ADMIN, MEMBER, VIEWER.
- Helmet, strict CORS (HTTP and WebSocket), rate limiting, whitelist validation.
- Files go browser <-> storage through short-lived signed URLs with enforced size and
  type, an allowlist without HTML/SVG, and forced download.
- Emails are queued, retried, HTML-escaped, and only sent to current members.
