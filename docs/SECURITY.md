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
- Expand RLS as tables land

## Data lifecycle

- Export: user-initiated dump of owned personal data (Phase 6+)
- Deletion: account + files + derived personal data; document lawful retention exceptions when known
- Do **not** claim GDPR/CCPA compliance without jurisdiction review and implemented controls

## Uploads (Phase 1)

- Validate magic bytes, not only MIME/extension
- Size and processing limits
- Malformed file handling; temp file cleanup
- CV content is untrusted

## AI (Phase 1+)

- Model output cannot execute commands, SQL, or submit applications
- No paid AI API as hidden fallback
- Mock adapter for CI

## Logging

- Structured logs with `requestId`
- No passwords, tokens, full CV bodies, or secrets in logs
- Audit events minimize PII

## Known gaps (track in PROGRESS)

Phase 0 establishes auth + session foundation. Full CSRF strategy for cookie+SPA, password reset, and production secrets management land in hardening phase unless needed earlier.
