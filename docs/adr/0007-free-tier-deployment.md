# ADR 0007: Free-tier deployment on one origin

- Status: Accepted
- Date: 2026-10-11

## Context

TeamFlow should be usable on the internet at zero cost. It needs a Node process
(HTTP + WebSockets + BullMQ worker), PostgreSQL, Redis, S3-compatible storage and SMTP.

## Decision

- **One Render web service** runs the NestJS API **and serves the built Angular app**
  (`SERVE_WEB_APP=true`, SPA fallback for non-`/api` paths). Same origin keeps the
  `SameSite=Strict` refresh cookie, the cookie path `/api/auth`, CORS and WebSockets
  exactly as designed; splitting frontend and API across domains would require
  `SameSite=None` cookies and weaken CSRF protection.
- **Render Key Value** (free, private network only, `noeviction` for BullMQ) for Redis.
- **Neon** for PostgreSQL (does not expire; Render's free Postgres does). The app uses
  the pooled URL; `prisma migrate deploy` uses `DIRECT_URL`, run on every start.
- **Supabase Storage** over its S3 protocol (no credit card needed).
- **Brevo** SMTP for email.
- `TRUST_PROXY=true` so `req.ip` is the visitor, not Render's proxy; otherwise one
  visitor's failed logins would rate-limit everyone.
- A real **Content Security Policy** (Helmet) now also protects the served web app:
  scripts only from `'self'`, `connect-src` limited to `'self'` and the storage origin.
  Angular's critical-CSS inlining is disabled because it relies on an inline
  `onload` handler that the CSP blocks.
- **Uploads switched from presigned POST to presigned PUT** (ADR 0005 updated):
  POST policies are not documented as supported by Supabase Storage or Cloudflare R2;
  presigned PUT is universal. Type, size and `Content-Disposition` are signed headers.
  SDK default request checksums are disabled (`WHEN_REQUIRED`) because browsers cannot
  send them.

## Consequences

- Cold starts (~1 min) after 15 idle minutes; sockets reconnect, scheduled cleanup
  only runs while awake.
- Free Redis has no persistence: queued-but-unsent emails are lost on restart.
- Moving to paid tiers or another host needs only environment changes, no code.
