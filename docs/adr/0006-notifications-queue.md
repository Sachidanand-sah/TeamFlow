# ADR 0006: Email notifications and maintenance through a BullMQ queue

- Status: Accepted
- Date: 2026-10-11

## Context

People should get an email when a task is assigned to them or when someone comments
on a task they reported or are assigned to. Sending email inside an HTTP request is
slow and fragile (SMTP timeouts, provider outages). We also need periodic cleanup
(expired refresh tokens, abandoned uploads). Redis is already in the stack.

## Decision

- **BullMQ on Redis** (v5, which bundles `ioredis`), queues `notifications` and
  `maintenance`, producers and workers in the same NestJS app for now.
- **Producer**: `NotificationsListener` subscribes to the event bus and turns
  `activity.recorded` events into jobs via a pure rule function:
  - task assigned (on create or update) -> `task-assigned` for the assignee;
  - comment added -> `comment-added` fan-out;
  - never for your own actions; nothing for moves, deletions, unassignment.
- **Jobs carry ids, not content.** Workers reload the task/comment/recipient when
  they run and **skip** if the task or comment is gone, the task was reassigned, or
  the recipient is no longer a member of the workspace.
- **Idempotency.** Job ids are derived from the activity id (and recipient), so a
  retried producer or fan-out never queues the same email twice; the fan-out makes
  one job per recipient so a retry never re-sends to people already emailed.
- **Retries**: 5 attempts, exponential backoff from 10 s; completed/failed job
  history is capped.
- **Two connection profiles**: workers use `maxRetriesPerRequest: null` (required by
  BullMQ, waits for Redis); producers use `enableOfflineQueue: false` plus a 3 s
  timeout, so an outage is logged instead of piling up waiting calls. Producing is
  best effort: the user's change has already succeeded.
- **Email safety**: all user-provided text is HTML-escaped in templates; subjects have
  line breaks removed (header injection); every email has a plain-text part.
- **Mailpit** in docker-compose catches all local email (UI on :8025).
- **Maintenance**: an hourly BullMQ _job scheduler_ (stored in Redis, so it runs once
  per hour across instances) deletes expired refresh tokens (revoked-but-unexpired
  ones are kept for reuse detection) and PENDING uploads older than 24 h.

## Consequences

- Notifications are at-least-once: a crash between "sent" and "job completed" can
  re-send one email. Acceptable for notifications.
- No per-user notification preferences or digests yet.
- Invitations for people without an account (email links) can reuse this pipeline.
- Workers can move to a separate process (`apps/worker`) later without changing
  producers, since they only share the queue.
