# TeamFlow

Team project-management platform (a small Jira/Trello): workspaces, projects,
Kanban tasks, comments, real-time board updates.

Nx monorepo with an Angular frontend and a NestJS API on PostgreSQL (Prisma).

| Path           | What                                                   |
| -------------- | ------------------------------------------------------ |
| `apps/web`     | Angular app (standalone components, signals, zoneless) |
| `apps/api`     | NestJS API, one module per domain (modular monolith)   |
| `libs/shared`  | Framework-free API contracts shared by web and api     |
| `libs/ui`      | Angular design-system components                       |
| `apps/web-e2e` | Playwright end-to-end tests                            |
| `docs/adr`     | Architecture Decision Records                          |

## Status

- [x] Auth: register, login, refresh (rotating cookie), logout
- [ ] Workspaces and membership with roles
- [ ] Projects
- [ ] Tasks with Kanban statuses
- [ ] Comments and activity log
- [ ] Real-time board updates
- [ ] File attachments
- [ ] Email notifications via queue

## Getting started

Requirements: Node.js 22+ and Docker Desktop.

```bash
npm install
cp .env.example .env          # then set JWT_ACCESS_SECRET to a long random string
docker compose up -d          # postgres, redis, minio
npx prisma migrate dev        # apply database migrations
npx nx serve web              # starts the API too; open http://localhost:4200
```

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## Everyday commands

```bash
npx nx run-many -t lint test build     # everything CI checks
npx nx test api                        # API unit tests
npx nx e2e web-e2e                     # Playwright (first run: npx playwright install chromium)
npx prisma migrate dev --name <change> # after editing apps/api/prisma/schema.prisma
```

## Security model (short version)

Short-lived access JWT kept in memory only; refresh token in an httpOnly,
Secure, SameSite=Strict cookie, rotated on every use with reuse detection;
argon2id passwords; Helmet, strict CORS and rate limiting. Details in
[ADR 0002](docs/adr/0002-auth-access-and-refresh-tokens.md).
