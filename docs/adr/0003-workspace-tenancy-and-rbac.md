# ADR 0003: Workspaces as the tenant boundary, membership-based RBAC

- Status: Accepted
- Date: 2026-10-11

## Context

TeamFlow is multi-tenant: many teams share one database. A bug that lets one team
read or change another team's data is the worst failure this product can have.
Users can belong to several workspaces, with a different role in each.

## Decision

- **Workspace is the tenant.** Every workspace-owned record (projects, tasks,
  comments, ...) will carry a `workspaceId`, and every query on such data filters by it.
- **Roles are per membership**, not per user: `memberships(workspace_id, user_id, role)`
  with a unique pair. Roles, most to least privileged: OWNER, ADMIN, MEMBER, VIEWER.
- **`WorkspaceRoleGuard`** protects every route under `/workspaces/:workspaceId`:
  - reads the membership for (URL workspaceId, authenticated user) from the database;
  - non-member -> **404** (does not confirm the workspace exists);
  - member below the route's minimum role -> **403**;
  - a route without `@RequireWorkspaceRole(...)` -> **500** (fails closed);
  - attaches the verified membership; services receive a `WorkspaceMember`, never a
    raw client-supplied `workspaceId`.
- **Relational rules live in services, from shared pure functions**
  (`@teamflow/shared`: `hasAtLeastRole`, `canManageMember`, `canAssignRole`):
  - you can only manage members ranked strictly below you, and only grant roles
    strictly below your own. So ADMINs manage MEMBER/VIEWER; only the OWNER manages ADMINs;
  - nobody changes their own role; OWNER is never granted through the API;
  - anyone but the OWNER can leave; the OWNER deletes the workspace instead.
    The Angular app uses the same functions to hide actions, but the API is the authority.
- Members are added by email of an **existing** account. Invitations for people
  without an account come with the email queue (MVP step 8).

## Consequences

- Exactly one OWNER per workspace for now. Ownership transfer is a future,
  explicit operation (e.g. `POST /workspaces/:id/transfer-ownership`).
- Adding by email tells an ADMIN whether an email has a TeamFlow account. Accepted:
  only workspace admins can ask, and the global rate limit applies.
- Each workspace-scoped request costs one indexed membership lookup. Cheap; can be
  cached in Redis later if it ever shows up in profiles.
- Future modules (projects, tasks) reuse `WorkspaceRoleGuard` by importing
  `WorkspacesModule`, so tenancy checks stay in one place.
