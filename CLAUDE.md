<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

# TeamFlow

Team project-management platform (mini Jira/Trello). Learning project for a full-stack
engineer: code quality, architecture and security matter more than speed.

## Tech stack

- Monorepo: Nx
- Frontend: Angular (standalone components, signals, RxJS), in `apps/web`
- Backend: NestJS, in `apps/api`
- Shared types and DTO interfaces: `libs/shared` (import as `@teamflow/shared`)
- Design-system components: `libs/ui` (import as `@teamflow/ui`)
- Database: PostgreSQL with Prisma (migrations only, never edit tables by hand)
- Cache and queues: Redis + BullMQ
- Real-time: NestJS WebSocket gateway (Socket.IO)
- File storage: S3-compatible (MinIO locally)
- Tests: Jest (unit), Playwright (e2e)
- Local infra: docker-compose (postgres, redis, minio)

## Architecture rules

- Modular monolith: one NestJS app, one module per domain
  (auth, users, workspaces, projects, tasks, comments, notifications, activity).
- Layering: controller (HTTP only) -> service (business logic) -> repository/Prisma.
  No business logic in controllers.
- Every request body is a DTO validated with class-validator.
- Every workspace-scoped query filters by workspaceId (multi-tenancy). Never trust
  a workspaceId from the client without checking membership.
- Angular: feature folders, smart/dumb components, services for API calls,
  design-system components in `libs/ui`.

## Security rules (non-negotiable)

- Passwords hashed with argon2.
- Short-lived access token; refresh token rotated on every use, stored hashed in DB,
  sent only as httpOnly, Secure, SameSite=Strict cookie. Never use localStorage for tokens.
- Reused refresh token revokes the whole token family.
- RBAC guard on every protected route (roles: OWNER, ADMIN, MEMBER, VIEWER).
- Helmet, strict CORS, @nestjs/throttler rate limiting.
- Secrets only in environment variables; `.env` is gitignored, `.env.example` is committed.

## Code quality

- TypeScript strict mode. No `any`.
- ESLint + Prettier must pass.
- Write unit tests for every service method you add.
- Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`).
- Small, focused changes. Explain design decisions briefly in the PR description.
- Record significant decisions in `docs/adr/` (Architecture Decision Records).

## MVP scope (build in this order)

1. Auth: register, login, refresh, logout
2. Workspaces and membership with roles
3. Projects
4. Tasks with Kanban statuses
5. Comments and activity log
6. Real-time board updates
7. File attachments
8. Email notifications via queue

## How to work with me

I am an Angular developer learning backend. When you write NestJS, database or
security code, briefly explain WHY it is done that way. Ask before adding a new
dependency. Do not skip tests.

## Common commands

- `npx nx serve api` / `npx nx serve web` — dev servers (web proxies `/api` to the API)
- `npx nx run-many -t lint test build` — full check before committing
- `docker compose up -d` — start postgres, redis, minio, mailpit (local inbox: http://localhost:8025)
- `npx prisma migrate dev --name <change>` — create + apply a migration (schema in `apps/api/prisma/schema.prisma`)
