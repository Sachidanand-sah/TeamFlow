# ADR 0001: Modular monolith in an Nx monorepo

- Status: Accepted
- Date: 2026-10-11

## Context

TeamFlow is a team project-management app (workspaces, projects, tasks, comments,
real-time board). It is built by one developer as a learning project, so the
architecture must be easy to run locally and easy to reason about, while still
teaching boundaries that would survive growth.

## Decision

- One Nx monorepo containing:
  - `apps/api`: a single NestJS application (the backend).
  - `apps/web`: a single Angular application (the frontend).
  - `libs/shared`: framework-free TypeScript types shared by both
    (request/response contracts, enums). No runtime dependencies.
  - `libs/ui`: Angular design-system components (dumb, presentational).
- The API is a **modular monolith**: one deployable, one NestJS module per domain
  (auth, users, workspaces, projects, tasks, comments, notifications, activity).
- Inside each module: controller (HTTP only) -> service (business rules) ->
  repository (Prisma data access). Modules talk to each other through exported
  services, never by reaching into another module's repository.

## Consequences

- One process, one database, one deploy: simple local setup and debugging.
- Domain boundaries are explicit, so a module could be extracted into its own
  service later if it ever needs to scale independently.
- `libs/shared` keeps API contracts in sync at compile time: changing a response
  shape breaks the Angular build instead of failing at runtime.
- `libs/shared` must stay free of NestJS/Angular imports, because both apps
  depend on it. Validation decorators therefore live in API DTO classes, which
  `implement` the shared interfaces.
