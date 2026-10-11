# ADR 0002: Short-lived access JWT + rotating refresh token in an httpOnly cookie

- Status: Accepted
- Date: 2026-10-11

## Context

The Angular SPA and the NestJS API need stateless request authentication, but a
stolen credential must be short-lived and revocable. Tokens must never be readable
by JavaScript (an XSS bug must not leak a long-lived credential).

## Decision

**Access token**

- JWT signed with HS256, 15 minutes by default (`JWT_ACCESS_TTL_SECONDS`, max 1 h).
- Claims: `sub` (user id), `email`. Nothing sensitive.
- Returned in the JSON body. The SPA keeps it **in memory only** (a signal), never in
  `localStorage`/`sessionStorage`, and sends it as `Authorization: Bearer`.
- Verified by a global `JwtAuthGuard` with the algorithm pinned to HS256. Routes are
  protected by default; `@Public()` opts out.

**Refresh token**

- 32 random bytes (base64url), opaque, not a JWT.
- Sent only as cookie `tf_refresh`: `HttpOnly; Secure; SameSite=Strict; Path=/api/auth`.
- Stored in `refresh_tokens` as **SHA-256(token)**, never in plain text. A fast hash is
  enough because the token has 256 bits of entropy; argon2 is reserved for passwords.
- **Rotated on every use**: `/auth/refresh` consumes the presented token and issues a
  successor in the same `familyId`. The consume step is a compare-and-set
  (`UPDATE ... WHERE revoked_at IS NULL`) inside a transaction.
- **Reuse detection**: presenting a token that was already consumed (or losing a
  concurrent rotation race) revokes the whole family. Either the attacker or the real
  user holds a stale token, so both must log in again.
- Logout revokes the family and clears the cookie. It is idempotent.

**Passwords**: argon2id. Logins with an unknown email still run one argon2
verification, so response time does not reveal which emails are registered.
Both failure cases return the same `Invalid email or password`.

**Abuse**: global throttling of 100 req/min/IP, and 5 req/min/IP on `/auth/login` and
`/auth/register`.

## Consequences

- Page reload loses the in-memory access token. The SPA silently calls `/auth/refresh`
  on startup (the cookie survives), so the user stays signed in.
- Two tabs refreshing with the same cookie at the same instant can trigger reuse
  detection and log the user out. The SPA de-duplicates concurrent refreshes within a
  tab. Cross-tab coordination (BroadcastChannel) can be added if it becomes a problem.
- Access tokens cannot be revoked before expiry. The short TTL bounds the damage. If
  instant revocation is needed later (e.g. on role change), add a token version per user.
- `register` returns 409 for an existing email. That does reveal account existence, an
  accepted UX trade-off, mitigated by the strict rate limit on that endpoint.
- Expired/revoked rows accumulate. A periodic cleanup job (BullMQ, MVP step 8) will
  delete rows past `expires_at`.
