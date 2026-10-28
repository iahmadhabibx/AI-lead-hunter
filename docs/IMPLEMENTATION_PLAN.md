# Implementation Plan

## Repository findings (2026-10-27)

- Repository was **empty** (no source, no lockfile, no prior docs).
- Git initialized during Phase 0 bootstrap.
- Tooling available: Node 22, npm 10, pnpm 9.15 (via corepack), Docker 29 + Compose v5, Ollama binary present, Python 3.12.
- No secrets present to preserve.
- Host port 5432 occupied by another container → local Compose Postgres on **5433**.

## Phases

### Phase 0 — Engineering foundation ✅ PASS (audited 2026-10-27)

**Acceptance criteria**

- [x] pnpm monorepo with `web`, `api`, `worker`, and foundation packages
- [x] `.env.example` + startup env validation
- [x] Docker Compose for Postgres + Redis
- [x] Drizzle schema + migrations for users, sessions, audit_events, background_tasks
- [x] NestJS health/ready + auth register/login/logout/me
- [x] Structured logging + request IDs
- [x] Next.js app shell with landing + auth pages wired to API
- [x] Worker process boots and can connect to Redis
- [x] Unit/integration tests for auth/hashing/health; CI workflow
- [x] Documentation set complete and PROGRESS updated
- [x] Runtime uses non-owner DB role with verified tenant RLS on private tables

See `docs/PROGRESS.md` for command transcripts and DoD checklist.

### Phase 1 — CV onboarding vertical slice ✅ PASS (verified 2026-10-27)

Upload → extract → AI structured profile → review UI → versioned approved profile → statuses/errors → tests.

**Acceptance criteria**

- [x] PDF/DOCX upload with content validation + private storage
- [x] Async processing + task status API
- [x] Canonical candidate profile schema (versioned)
- [x] Mock AI adapter (tests) + Ollama adapter (optional local)
- [x] Review/correct UI; immutable approved versions
- [x] Integration path for register → upload → review → approve (Playwright e2e deferred; API integration covers the vertical slice)

See `docs/PROGRESS.md` for command results. Job discovery is **not** in this phase.

### Phase 2 — Connectors + normalization ✅ PASS (verified 2026-10-27)

Greenhouse/Lever board connectors (docs re-verified), registry, normalize, dedupe, freshness.

**Acceptance criteria**

- [x] Typed connector framework (`discover` / `fetchJob` / `healthCheck` / `getCapabilities`)
- [x] Configurable employer-board registry via `JOB_SOURCES_JSON` (not global search)
- [x] Greenhouse + Lever adapters after verifying official public GET docs
- [x] Normalized jobs, attribution, content hashes, idempotent ingestion
- [x] Dedup + freshness/status (`active`/`stale`/`closed`/`unknown`)
- [x] Bounded retries + source health reporting
- [x] Connector/normalization unit tests + ingest integration with mock transport
- [x] Matching engine **not** implemented (Phase 3)

See `docs/PROGRESS.md` and `docs/JOB_CONNECTORS.md`.

### Phase 3 — Matching ✅ PASS (verified 2026-10-28)

Hard filters, weighted components, explanations, persisted breakdowns, save/reject + auditable feedback events, regression tests. Application document generation **not** included.

**Acceptance criteria**

- [x] Deterministic versioned scoring (`MATCH_SCORING_VERSION` 1.0.0)
- [x] Hard eligibility + weighted components; unknown ≠ positive
- [x] Remote/hybrid/onsite, countries, relocation, sponsorship without inventing facts
- [x] Evidence-backed explanations + persisted score breakdowns
- [x] Job save/reject + auditable feedback events (preference learning deferred to Phase 4)
- [x] Unit, integration, hard-constraint regression tests
- [x] Application documents **not** generated (Phase 5)

See `docs/PROGRESS.md` and `docs/AI_AND_MATCHING.md`.

### Phase 4 — Feedback learning

Deterministic preference updates from events, reset UI (events already persisted in Phase 3).

### Phase 5 — Application assistance + tracking

Grounded drafts, editor, application records, official apply URL only.

### Phase 6 — Hardening + deployment

Export/delete, RLS coverage, rate limits, backups, production runbook.

## Dependencies between phases

Phase 1 depends on Phase 0 auth + storage + tasks.  
Phase 3 depends on Phase 1 profiles + Phase 2 jobs.  
Phase 5 depends on Phase 1 + 3.

## Commands

```bash
pnpm install
docker compose -f infra/docker/docker-compose.yml up -d
pnpm db:migrate
pnpm build
pnpm test
pnpm test:integration
pnpm dev
```
