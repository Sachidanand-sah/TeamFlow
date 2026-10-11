# ADR 0004: Real-time board updates over Socket.IO, fed by an in-process event bus

- Status: Accepted
- Date: 2026-10-11

## Context

Several people work on the same Kanban board. Without live updates they overwrite
each other's view and only notice after a reload. The spec names Socket.IO.

## Decision

- **Event bus.** Services publish typed `BoardEvent`s (`@teamflow/shared`) on an
  in-process RxJS Subject (`DomainEvents`) _after_ their database write succeeds.
  Publishers do not know their listeners (activity log, gateway, notifications).
- **Gateway** (`/realtime` namespace) only forwards bus events to the room
  `ws:<workspaceId>:project:<projectId>`. Clients never mutate over the socket;
  all writes stay on the HTTP API with its validation, guards and rate limits.
- **Auth.** The client sends its _access token_ in the Socket.IO handshake `auth`
  (never the refresh cookie). It is verified like HTTP (HS256 pinned). The server
  disconnects the socket when that token expires; the client refreshes over HTTP
  and reconnects with the new token (Socket.IO calls the `auth` callback on every
  connect). A retry brake prevents refresh/reconnect loops.
- **Joining a board** re-checks membership and that the project belongs to the
  workspace. One board per connection.
- **Client.** One socket per tab; one shared stream per board (ref-counted
  join/leave). Events are applied idempotently (upsert by id), so it does not matter
  whether the live event or our own HTTP response arrives first. Someone else's
  move triggers a board reload (positions of other cards changed). After a
  reconnect the board and feed reload, because events may have been missed.
- CORS for the socket uses the same single allowed origin as HTTP.

## Consequences

- Removing a member does not kick their open socket out of the room immediately;
  they stop receiving events at the latest when their access token expires
  (15 minutes) and the rejoin is refused. Acceptable for an MVP; a membership-change
  event could disconnect them instantly later.
- In-process bus + single API instance. With several API instances, rooms must
  be shared through the Socket.IO Redis adapter (Redis is already in the stack).
- Events published but not delivered (client offline) are not replayed; clients
  resync by reloading on reconnect.
