# Release readiness report

**Date:** 2026-10-28  
**Verdict: NOT production-ready.** Hardening controls landed for Phase 6, but environmental and multi-instance gaps remain. Do not market this as a production SaaS until blockers below are closed.

## Scope reviewed

`docs/SECURITY.md`, `docs/TESTING.md`, `docs/DEPLOYMENT.md`, `AGENTS.md`, and current API/worker/database/CI implementation.

## Control matrix

| Area | Status | Notes |
| --- | --- | --- |
| Tenant isolation (RLS + ownership) | **Implemented (MVP)** | Private tables RLS + FORCE; IDOR tests for tasks/applications/exports |
| Authentication (argon2id, hashed sessions, Secure cookies) | **Implemented** | `Secure` when `NODE_ENV=production`; logout revokes server-side |
| File security | **Improved** | Magic-byte upload validation; path traversal hardened; private modes 0700/0600 |
| Auth rate limits | **Implemented (single-instance)** | In-memory limiter on login/register; not shared across replicas |
| Secrets handling | **Partial** | `.env` gitignored; startup Zod validation; placeholders in `.env.example` |
| Account export | **Implemented** | `POST /account/export` + download; excludes password hashes |
| Account deletion | **Implemented** | Confirmed delete; file tree removed; user row cascaded |
| Migrations | **Implemented** | Versioned SQL 0000–0005; non-destructive |
| Backups / recovery | **Partial** | `infra/scripts/backup-postgres.sh` + restore with `CONFIRM_RESTORE=YES` |
| Logging | **Partial** | Structured + requestId; avoid logging secrets/CV bodies (convention, not enforced scanner) |
| Dependency / CI | **Partial** | Lockfile + CI unit/integration; no automated CVE gate (`pnpm audit`) in CI yet |
| Public deployment | **Not ready** | Compose is local/dev; no TLS, durable object storage, or managed secrets |

## Defects fixed in this review

1. Auth endpoint rate limiting (`AuthRateLimitGuard` + `MemoryRateLimiter`)
2. Account export / delete APIs + worker jobs
3. Storage path traversal hardening (`resolveAbsolute`)
4. Security response headers middleware
5. Swagger disabled when `NODE_ENV=production`
6. Postgres backup/restore scripts
7. CI package build list updated (matching/feedback/application-assistance)
8. `TRUST_PROXY` / auth rate-limit env knobs documented

## Remaining production blockers (critical / high)

| Blocker | Severity | Why it blocks |
| --- | --- | --- |
| TLS termination + HTTPS cookies end-to-end | Critical | Production requires TLS; app alone does not terminate TLS |
| Secrets manager / non-dev DB credentials | Critical | Compose passwords and `.env` secrets are local-only |
| Durable private object storage | High | Local `STORAGE_ROOT` is ephemeral on many hosts |
| Multi-instance rate limit / session affinity | High | Memory limiter is per process |
| Password reset + email delivery | High | Documented gap; account recovery impossible |
| Full CSRF strategy beyond SameSite=Lax | Medium | SPA+cookie deployments may need stronger CSRF |
| Always-on workers + backup scheduling | High | Demo hosts may sleep; backups are manual scripts |
| Formal legal/compliance review | High | Do not claim GDPR/CCPA compliance |

## What is acceptable today

- **Local development** and **internal demos** with mock AI, Compose Postgres/Redis, and explicit Ollama setup.
- CI with mock AI / mock connectors (no live job APIs).

## Honest recommendation

Ship Phase 6 hardening as **pre-production**. Treat public internet exposure as unsafe until TLS, secrets, durable storage, multi-instance rate limits, and operational backup schedules are in place and re-verified.
