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

## Planned endpoints (later phases)

- Preferences (beyond profile preferences block)
- Search create/progress
- Jobs list/detail + match explanations
- Save/unsave, feedback
- Application drafts + tracking
- Source status
- Account export + deletion

## Pagination

Cursor or offset documented per list endpoint. Default page size bounded (e.g. 20, max 100).

## Idempotency

Mutations that may be retried (uploads, feedback, draft generation) accept `Idempotency-Key` where specified.

## Security

- Never expose password hashes, session raw tokens, storage keys, prompts, or other users' data.
- Rate-limit auth endpoints.
