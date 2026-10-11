# Permissions

Who can do what inside a workspace. Enforced by the API (`WorkspaceRoleGuard` for the
minimum role, services for relational rules); the web app only hides actions.
Rationale: [ADR 0003](adr/0003-workspace-tenancy-and-rbac.md).

Non-members get **404** for everything in a workspace; members below the required
role get **403**.

| Action                               | VIEWER | MEMBER | ADMIN | OWNER |
| ------------------------------------ | :----: | :----: | :---: | :---: |
| View workspace, members, projects    |   ✓    |   ✓    |   ✓   |   ✓   |
| Leave workspace                      |   ✓    |   ✓    |   ✓   |       |
| Rename workspace                     |        |        |   ✓   |   ✓   |
| Add / change / remove MEMBER, VIEWER |        |        |   ✓   |   ✓   |
| Add / change / remove ADMIN          |        |        |       |   ✓   |
| Create / edit / delete projects      |        |        |   ✓   |   ✓   |
| Delete workspace                     |        |        |       |   ✓   |

Rules that a table cannot show:

- Nobody can change their own role.
- OWNER is never granted through the API (ownership transfer is not built yet).
- A project's key cannot be changed after creation (task ids depend on it).

Tasks and comments (MVP steps 4-5) will add rows here: MEMBER and above will be able
to create and edit tasks; VIEWER stays read-only.
