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

## Data lifecycle

- Export: user-initiated dump of owned personal data (Phase 6+)
- Deletion: account + files + derived personal data; document lawful retention exceptions when known
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

## Known gaps (track in PROGRESS)

- Full CSRF strategy for cookie+SPA (SameSite=Lax mitigates basic cross-site POST; deepen in hardening)
- Password reset + email delivery
- Production secrets management / TLS termination
- Auth endpoint rate limits (documented for hardening)
- Users/audit tables are not RLS-scoped (login needs email lookup; audit writes are server-side)
