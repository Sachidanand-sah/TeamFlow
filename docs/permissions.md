# Permissions

Who can do what inside a workspace. Enforced by the API (`WorkspaceRoleGuard` for the
minimum role, services for relational rules); the web app only hides actions.
Rationale: [ADR 0003](adr/0003-workspace-tenancy-and-rbac.md).

Non-members get **404** for everything in a workspace; members below the required
role get **403**.

| Action                               | VIEWER | MEMBER | ADMIN | OWNER |
| ------------------------------------ | :----: | :----: | :---: | :---: |
| View workspace, members, projects    |   ✓    |   ✓    |   ✓   |   ✓   |
| View tasks and the board             |   ✓    |   ✓    |   ✓   |   ✓   |
| Create, edit, assign, move tasks     |        |   ✓    |   ✓   |   ✓   |
| Delete a task you reported           |        |   ✓    |   ✓   |   ✓   |
| Delete any task                      |        |        |   ✓   |   ✓   |
| Read comments and project activity   |   ✓    |   ✓    |   ✓   |   ✓   |
| Comment; edit/delete own comments    |        |   ✓    |   ✓   |   ✓   |
| Delete anyone's comment (moderation) |        |        |   ✓   |   ✓   |
| Leave workspace                      |   ✓    |   ✓    |   ✓   |       |
| Rename workspace                     |        |        |   ✓   |   ✓   |
| Add / change / remove MEMBER, VIEWER |        |        |   ✓   |   ✓   |
| Add / change / remove ADMIN          |        |        |       |   ✓   |
| Create / edit / delete projects      |        |        |   ✓   |   ✓   |
| Delete workspace                     |        |        |       |   ✓   |

Rules that a table cannot show:

- Nobody can change their own role.
- Nobody, not even an admin, can edit someone else's comment (only delete it).
- OWNER is never granted through the API (ownership transfer is not built yet).
- A project's key cannot be changed after creation (task ids depend on it).
- A task can only be assigned to a current member of the same workspace. When a
  member leaves, their tasks in that workspace become unassigned automatically.
