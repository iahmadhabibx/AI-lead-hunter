# Security

## Threat model (MVP summary)

| Asset | Threat | Control |
| --- | --- | --- |
| Accounts | Credential stuffing | Argon2id, rate limits, session expiry |
| Sessions | Theft / fixation | httpOnly cookies, hashed tokens, rotate on login |
| CV files | Cross-tenant read | Private storage paths + authz on every access |
| Profiles/jobs/matches | IDOR | Server-side ownership checks + RLS |
| AI prompts | Injection via CV/JD | Isolate untrusted data; no tool execution from model |
| Secrets | Leakage | Env validation, never log secrets, `.gitignore` |

## Authentication (Phase 0)

- Email + password registration/login
- Passwords hashed with **argon2id**
- Sessions stored in Postgres; cookie holds opaque token; DB stores hash
- Logout invalidates session server-side
- Production: `Secure` cookies, TLS termination

## Authorization

- Never trust client-supplied `userId`
- Every private resource resolved via session user
- Runtime DB role: `aijh_app` (not the migration owner)
- RLS on `background_tasks` keyed by `app.current_user_id` (`withTenantContext`)
- Session create/lookup/revoke via `SECURITY DEFINER` functions (no open session DML for the app role)
- Expand RLS as additional private tables land

## Data lifecycle (Phase 6 — implemented)

- Export: `POST /account/export` → worker builds JSON under `STORAGE_ROOT/{userId}/exports/`; download via `GET /account/export/download` (owner only). Password hashes excluded.
- Deletion: `POST /account/delete` with email + phrase confirmation → worker deletes file tree and user row (FK cascades). Audit may retain minimal metadata until purged by retention policy.
- Do **not** claim GDPR/CCPA compliance without jurisdiction review and implemented controls

## Uploads (Phase 1 — implemented)

- Validate magic bytes, not only MIME/extension (`detectCvFormat`)
- Size limits via `MAX_UPLOAD_BYTES`
- Private storage under `STORAGE_ROOT/{userId}/{documentId}.{ext}` (mode 0600)
- Malformed / unsupported files → `VALIDATION_ERROR`
- CV content treated as untrusted input to the AI adapter
- OCR not enabled; empty-text documents fail with an actionable error

## AI (Phase 1+)

- Model output cannot execute commands, SQL, or submit applications
- No paid AI API as hidden fallback
- Mock adapter for CI

## Logging

- Structured logs with `requestId`
- No passwords, tokens, full CV bodies, or secrets in logs
- Audit events minimize PII

## Hardening landed (Phase 6)

- Auth login/register rate limits (in-process `MemoryRateLimiter`; configure `AUTH_RATE_LIMIT_*`)
- Security headers middleware; Swagger disabled in production
- Storage path traversal checks tightened
- Backup/restore scripts under `infra/scripts/`

## Known gaps (still block public production)

- Full CSRF strategy for cookie+SPA (SameSite=Lax mitigates basic cross-site POST)
- Password reset + email delivery
- Production secrets management / TLS termination
- Multi-instance rate limiting (memory limiter is single-process)
- Durable object storage (S3-compatible) instead of local disk
- Users/audit tables are not RLS-scoped (login needs email lookup; audit writes are server-side)
- Automated dependency CVE gating in CI

See `docs/RELEASE_READINESS.md` for the non-marketing readiness verdict.
