# API Contracts

Base path: **`/api/v1`**

Format: JSON. Errors: consistent envelope. Auth: session cookie (httpOnly, Secure in production, SameSite=Lax).

## Error envelope

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable summary",
    "details": [],
    "requestId": "uuid"
  }
}
```

Common status codes: `400` validation, `401` unauthenticated, `403` forbidden, `404` not found, `409` conflict, `429` rate limit, `500` unexpected.

## Phase 0 endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/health` | no | Liveness |
| GET | `/ready` | no | Readiness (DB + Redis) |
| POST | `/auth/register` | no | Create account |
| POST | `/auth/login` | no | Create session |
| POST | `/auth/logout` | yes | Destroy session |
| GET | `/auth/me` | yes | Current user |

OpenAPI: served at `/api/v1/docs` (Swagger UI) when API is running.

## Phase 1 endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/cv/uploads` | yes | Multipart `file` (PDF/DOCX); optional `Idempotency-Key` |
| GET | `/cv/documents/:id` | yes | Document metadata + processing status |
| GET | `/tasks/:id` | yes | Background task status |
| GET | `/profile` | yes | Active + pending profile versions |
| GET | `/profile/versions` | yes | Version history |
| PATCH | `/profile/draft` | yes | Correct pending extraction (Zod-validated) |
| POST | `/profile/approve` | yes | Freeze pending as immutable approved + active |

Long-running CV processing returns `{ documentId, taskId, status }` and clients poll `/tasks/:id`.

## Phase 2 endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/sources` | yes | Configured board registry + health/ingest persistence |
| POST | `/sources/discover` | yes | Enqueue discovery (`?sourceKey=` optional) → `{ taskId }` |
| GET | `/sources/jobs` | yes | Active canonical jobs from ingested boards (empty if none) |

## Phase 3 endpoints (matching / feedback events)

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/matches/run` | yes | Enqueue matching vs catalog |
| GET | `/matches` | yes | List match results |
| GET | `/matches/:id` | yes | Score breakdown + evidence |
| POST | `/saved-jobs` | yes | Save job |
| GET | `/saved-jobs` | yes | List saved |
| DELETE | `/saved-jobs/:canonicalJobId` | yes | Unsave |
| POST | `/matches/reject` | yes | Reject with reasons |
| POST | `/feedback` | yes | Typed feedback event |
| GET | `/feedback` | yes | List feedback events |

## Phase 4 endpoints (learned preferences)

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/preferences/learned` | yes | Active learned preferences (or null) |
| POST | `/preferences/learned/recompute` | yes | Recompute from feedback events |
| POST | `/preferences/learned/reset` | yes | Clear active learned preferences |

## Phase 5 endpoints (applications / drafts)

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/applications` | yes | Create/track application (stores official apply URL) |
| GET | `/applications` | yes | List applications |
| GET | `/applications/:id` | yes | Application + document summaries |
| PATCH | `/applications/:id/status` | yes | User-reported status (applied ≠ auto-submit) |
| POST | `/applications/generate` | yes | Enqueue grounded draft generation |
| GET | `/documents/:id` | yes | Editable draft preview + provenance |
| PATCH | `/documents/:id` | yes | Edit draft markdown |
| POST | `/documents/:id/approve` | yes | Approve (blocked if unsupported claims) |
| GET | `/documents/:id/export` | yes | Markdown export download |

## Planned endpoints (later phases)

- Account export + deletion
- Match/feed UI polish

## Pagination

Cursor or offset documented per list endpoint. Default page size bounded (e.g. 20, max 100).

## Idempotency

Mutations that may be retried (uploads, feedback, draft generation) accept `Idempotency-Key` where specified.

## Security

- Never expose password hashes, session raw tokens, storage keys, prompts, or other users' data.
- Rate-limit auth endpoints.
