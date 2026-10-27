# Architecture Decision Records

## ADR-001: Start from empty repository

- **Status:** Accepted (2026-10-27)
- **Context:** Workspace contained no files.
- **Decision:** Bootstrap TypeScript pnpm monorepo per product prompt; do not invent prior app history.
- **Consequences:** All docs and code are greenfield; no legacy preservation beyond this ADR log.

## ADR-002: pnpm workspaces + modular monolith

- **Status:** Accepted
- **Context:** Need clear boundaries without microservice ops cost.
- **Decision:** `apps/api`, `apps/worker`, `apps/web` + shared packages; create domain packages when phases need them.
- **Consequences:** Fewer empty stubs; slightly more scaffolding when Phase 1 starts.

## ADR-003: Drizzle ORM + SQL migrations

- **Status:** Accepted
- **Context:** Need versioned migrations, strong typing, zero paid services.
- **Decision:** Drizzle + drizzle-kit; Postgres 16 in Compose.
- **Alternatives considered:** Prisma (heavier client, fine but not chosen), raw SQL only (slower DX).

## ADR-004: Session cookies + argon2id (local auth)

- **Status:** Accepted
- **Context:** Zero-budget; no external IdP credentials for local/MVP.
- **Decision:** First-party email/password with argon2id; server sessions in Postgres; httpOnly cookie.
- **Production boundary:** May later add OAuth/OIDC without replacing ownership model; document when introduced.
- **Consequences:** Password-reset and full CSRF hardening deferred to later hardening unless blocked earlier.

## ADR-005: Local Ollama + mock AI in tests

- **Status:** Accepted
- **Context:** Zero-budget inference; CI must be deterministic.
- **Decision:** Provider-agnostic AI interface; Ollama adapter; mock adapter for default tests; no hidden paid fallback.
- **Consequences:** Public demo hosts may lack GPU; production needs dedicated inference capacity.

## ADR-006: Tenant = user account

- **Status:** Accepted
- **Context:** MVP has no organizations/teams.
- **Decision:** `user_id` ownership on private rows; RLS pattern established early.
- **Consequences:** Org multi-tenancy would require a later migration and ADR.

## ADR-007: Local Postgres host port 5433

- **Status:** Accepted
- **Context:** Host `5432` already bound by another Docker Postgres (`ovotech_postgres`).
- **Decision:** Compose maps container `5432` → host `5433`; `.env.example` uses 5433.
- **Consequences:** CI still uses service port 5432 inside GitHub Actions networking.

## Unresolved

- Exact default Ollama model for extraction (decide in Phase 1 after size/quality check).
- Production object storage vendor (S3-compatible interface first).
- Password-reset email delivery provider (local: console/dev sink).
- Product display name currently **ForgePath** in the web UI (code name); confirm final branding later.

