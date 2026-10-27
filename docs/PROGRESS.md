# Progress

Standing rules for this file:

- **Retain permanently** alongside `AGENTS.md` — this is the cross-session record of verified work.
- Append dated entries; do not erase history of what was verified or what failed.
- Record **actual commands and results**. Do not claim PASS from generated files alone.
- A phase is complete only when features work, tests pass, and limitations are documented (`AGENTS.md` → Phase completion discipline).

## 2026-10-27 — Phase 1 CV onboarding (DoD)

### Verdict

**Phase 1 acceptance criteria: PASS** (job discovery not included).  
Browser Playwright e2e not added; vertical slice verified via API integration + unit tests + web pages wired to real endpoints.

### Acceptance criteria

| Criterion | Evidence |
| --- | --- |
| PDF/DOCX upload + magic-byte validation + private storage | `CvService` + `@aijh/cv-processing`; files under `STORAGE_ROOT/{userId}/` |
| Async processing + task status | BullMQ `cv-process`; `GET /tasks/:id`; document statuses |
| Canonical versioned JSON schema | `CandidateProfilePayload` schemaVersion `1.0.0` |
| Mock + Ollama adapters | `@aijh/ai-runtime` (`mock` default, `ollama` optional) |
| Review/edit + immutable approve | `PATCH /profile/draft`, `POST /profile/approve`; UI `/app/profile` |
| Integration path register→upload→review→approve | `cv.integration.test.ts` passed |

### Commands executed (actual)

| Command | Result |
| --- | --- |
| `pnpm db:migrate` | pass — applied `0002_cv_profiles` |
| `pnpm test` | pass — includes experience, file validation, DOCX extract, mock AI |
| `pnpm test:integration` | pass — 5 tests (auth, tenant RLS, **CV onboarding**) |
| `pnpm build` | pass — packages + api + worker + web |
| `pnpm typecheck` | pass after excluding integration tests from api `rootDir` (vitest still type-transpiles them) |

### Limitations (documented, not blockers)

- OCR for scanned PDFs **not** implemented; empty-text PDFs fail clearly
- Ollama requires explicit model setup; default CI/local uses `AI_PROVIDER=mock`
- No Playwright e2e browser suite yet
- Mock extractor is heuristic, not a substitute for model quality evaluation fixtures beyond unit coverage
- Job discovery / matching intentionally not started

### Next

Phase 2 — job connector framework + Greenhouse/Lever board integrations (after verifying current public docs).

---

## 2026-10-27 — Phase 0 acceptance audit (DoD)

### Verdict

**Phase 0 acceptance criteria: PASS.** Phase 1 not started (at time of Phase 0 audit).

### Acceptance criteria (`docs/IMPLEMENTATION_PLAN.md`)

| Criterion | Evidence |
| --- | --- |
| pnpm monorepo (`web`/`api`/`worker` + foundation packages) | Present; `pnpm-workspace.yaml` |
| `.env.example` + startup env validation | Zod `parseAppEnv` at API/worker boot |
| Docker Compose Postgres + Redis | `infra/docker/docker-compose.yml` healthy |
| Migrations: users, sessions, audit_events, background_tasks | `0000` + `0001_tenant_isolation` applied |
| NestJS health/ready + auth register/login/logout/me | Smoke + integration |
| Structured logging + request IDs | pino + `x-request-id` |
| Next.js landing + auth wired to API | `apps/web` builds; pages present |
| Worker boots + Redis | Heartbeat queue (prior + Compose Redis healthy) |
| Unit/integration tests + CI | See commands below; `.github/workflows/ci.yml` |
| Documentation set | 12 docs under `docs/` + `AGENTS.md` |

### Definition of done (Phase 0)

| DoD item | Status |
| --- | --- |
| Acceptance criteria met | Yes |
| Functionality implemented (not UI-only) | Yes — real auth, sessions, DB, Redis readiness |
| Input validation + authorization | Zod on auth; session guard; no client `userId` trust |
| Error/loading states | API error envelope; web form error/loading |
| Relevant tests passed | Yes (unit + integration including tenant RLS) |
| Project builds | Yes (`pnpm build`) |
| Migrations consistent | Yes (2 journal entries applied at Phase 0) |
| Docs reflect implementation | Updated (DATABASE/SECURITY/PROGRESS) |
| No secrets committed | `.env` gitignored; only `.env.example` placeholders |
| Remaining limitations reported | Below |

### Tenant isolation verification

- Runtime `DATABASE_URL` user: **`aijh_app`** (not migration owner).
- RLS + `FORCE ROW LEVEL SECURITY` on `sessions`, `background_tasks`.
- Policies: `background_tasks_owner_all`, `sessions_select_own`.
- Session DML via `SECURITY DEFINER`: `auth_create_session`, `auth_find_valid_session`, `auth_revoke_session`.
- Integration: owner can read own task; other tenant sees 0 rows; cross-tenant insert rejected.

### Commands executed this audit (actual)

| Command | Result |
| --- | --- |
| `pnpm db:migrate` | pass — migrations `0000`, `0001` applied |
| `pnpm test` | pass — 11 unit tests (contracts 3, observability 2, security 5, api 1) |
| `pnpm test:integration` | pass — 4 tests (auth 1 + tenant isolation 3) |
| `pnpm build` | pass — packages + api + worker + web |
| `pnpm typecheck` | pass — all workspace packages/apps |
| `GET /api/v1/health` | `{"status":"ok",...}` |
| `GET /api/v1/ready` | `{"status":"ready","checks":{"database":true,"redis":true}}` |
| Auth smoke (register → me → logout → me) | 200 / 200 / 200 / **401** |
| `git check-ignore .env` | ignored |

### Fixes applied during Phase 0 audit

1. Switched runtime DB role to `aijh_app`.
2. Added migration `0001_tenant_isolation` (definer session helpers + tightened RLS).
3. Auth session create/lookup/revoke uses definer functions.
4. Added tenant isolation integration tests + `assertTenantAccess` unit tests.
5. Documented runtime vs admin DB URLs.

### Known remaining limitations (Phase 0 era)

- CSRF deepening, password reset, auth rate limits → hardening
- Users/audit not RLS-scoped (login email lookup requires it)
- Worker was heartbeat-only until Phase 1
