# ADR 0005: Attachments via presigned S3 uploads, verified before use

- Status: Accepted
- Date: 2026-10-11

## Context

Tasks need file attachments. Files are user-controlled bytes: they can be large,
malicious, or not what the client claims. The stack includes S3-compatible storage
(MinIO locally).

## Decision

- **Bytes never pass through the API.** Three steps:
  1. `POST .../attachments` with name, type, size -> the API stores a **PENDING** row
     and returns a **presigned PUT URL** (valid 5 minutes) for one object key, plus the
     exact headers to send.
  2. The browser uploads directly to storage.
  3. `POST .../attachments/:id/complete` -> the API calls `HeadObject` and marks the row
     **READY** only if the object exists with exactly the announced size and type;
     otherwise it deletes object and row (400).
- **Storage enforces the signature**: `Content-Type`, `Content-Length` and
  `Content-Disposition` are signed headers, so a different type, size or disposition
  invalidates the request. (Originally a presigned POST policy; changed to PUT in
  ADR 0007 because POST policies are not supported by all S3-compatible services.)
- **Keys are server-generated**: `workspaces/<w>/tasks/<t>/<uuid>`. The user's file
  name is display-only (sanitised: no paths, control or header-breaking characters).
- **Type allowlist** shared with the web app (images, PDF, text/CSV, Office, zip).
  No HTML, SVG or JavaScript, which could execute when rendered.
- **Downloads** are 60-second presigned GET URLs. The object is stored with
  `Content-Disposition: attachment` (RFC 5987 file name), so it is never rendered
  inline.
  The API returns the URL as JSON; a redirect would not carry the Bearer token.
- Only READY files are listed or downloadable. Upload/complete: MEMBER+, uploader
  only for complete. Delete: uploader or ADMIN+.
- Deleting a task removes its objects (event bus listener, prefix delete).

## Consequences

- No virus scanning yet. A queue job (e.g. ClamAV) could scan between "uploaded" and
  READY later; the PENDING state already models that gap.
- Abandoned uploads (no `complete`) leave PENDING rows and maybe objects; the
  maintenance job from MVP step 8 deletes them after 24 hours.
- Deleting a whole project or workspace cascades the rows but not the objects yet.
  A periodic orphan sweep (list prefix, compare with DB) is the follow-up.
- The storage endpoint must be reachable from browsers, and its CORS must allow the
  web origin (configured in docker-compose for MinIO).
