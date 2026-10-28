# Progress

Standing rules for this file:

- **Retain permanently** alongside `AGENTS.md` — this is the cross-session record of verified work.
- Append dated entries; do not erase history of what was verified or what failed.
- Record **actual commands and results**. Do not claim PASS from generated files alone.
- A phase is complete only when features work, tests pass, and limitations are documented (`AGENTS.md` → Phase completion discipline).

## 2026-10-28 — Phase 4 feedback learning + Phase 5 application assistance (DoD)

### Verdict

**Phase 4 PASS** and **Phase 5 PASS** (verified together). User request described application drafts while labeling “Phase 4”; plan order required feedback learning first, so both were implemented. No automated application submission.

### Phase 4 evidence

| Criterion | Evidence |
| --- | --- |
| Deterministic learned preferences | `@aijh/feedback` + `learned_preferences` |
| Review / recompute / reset | `/preferences/learned*` |
| CV facts untouched | Learning never writes profile versions |

### Phase 5 evidence

| Criterion | Evidence |
| --- | --- |
| Grounded CV / cover / answers | `@aijh/application-assistance` templates + claim validation |
| Provenance + versions | `generated_documents` + worker `docs-generate` |
| Editable preview / export / approve | `/documents/:id` PATCH, export, approve |
| Tracking without auto-submit | `applications` + status `applied` policy text |
| Tests | Unit (claims/export/learning) + integration ownership/export/approve |

### Commands executed (actual)

| Command | Result |
| --- | --- |
| `pnpm db:migrate` | pass — `0005_preferences_applications` |
| `pnpm --filter @aijh/feedback test` | pass — **3** |
| `pnpm --filter @aijh/application-assistance test` | pass — **3** |
| `pnpm test` | pass |
| `pnpm test:integration` | pass — **10** tests (incl. applications×2) |
| `pnpm build` | pass |
| `pnpm typecheck` | pass |

### Limitations

- Draft generation is template-grounded (deterministic); Ollama narrative polish not required for MVP honesty
- Claim validator is heuristic (bullets / credential phrases / bold) — not a full NLP fact checker
- Web UI for applications/preferences not built yet (API complete)
- Learned preferences are not yet folded into the matching scorer automatically (explicit profile prefs remain source of truth)

### Next

Phase 6 — SaaS hardening (export/delete account, rate limits, backups, deployment runbook).

---

## 2026-10-28 — Phase 3 matching engine (DoD)

### Verdict

**Phase 3 acceptance criteria: PASS.** Application document generation **not** started (Phase 5). Preference *learning* deferred to Phase 4; save/reject + auditable feedback events are in scope and verified.

### Acceptance evidence

| Criterion | Evidence |
| --- | --- |
| Deterministic versioned scoring | `@aijh/matching` + `MATCH_SCORING_VERSION` `1.0.0` |
| Hard filters + weighted components | `evaluateHardFilters` + `scoreComponents`; unknown components excluded from average |
| Work mode / country / relocation / sponsorship | Hard-fail only on evidenced conflicts; sponsorship unknown → `needs_verification` |
| Persisted breakdowns | `match_results` (migration `0004_matching_feedback`) |
| Save / reject + audit | `saved_jobs`, `feedback_events`, `audit_events`; APIs under `/matches`, `/saved-jobs`, `/feedback` |
| Worker | BullMQ `jobs-match` → `handleJobsMatch` |
| Tests | Matching unit 19 + hard-constraint regression; integration match path |

### Commands executed (actual)

| Command | Result |
| --- | --- |
| `pnpm db:migrate` | pass — `0004_matching_feedback` |
| `pnpm --filter @aijh/matching test` | pass — **19** tests |
| `pnpm test` | pass |
| `pnpm test:integration` | pass — **8** tests (auth, tenant, CV, sources×2, **match×1**) |
| `pnpm build` | pass |
| `pnpm typecheck` | pass |

### Limitations

- No match/feed UI in web app yet (API + worker complete)
- Preference learning / reset UI is Phase 4 (events stored only)
- Country matching is conservative string inclusion on `locationText`, not geocoding
- Salary soft-score uses a conservative `$` hint extractor; missing data → unknown, not positive
- Application drafts / tracking not implemented

### Next

Phase 4–5 completed 2026-10-28; see that entry for Phase 6 next steps.

---

## 2026-10-27 — Phase 2 connectors + normalization (DoD)

### Verdict

**Phase 2 acceptance criteria: PASS.** Matching engine **not** started.

### Docs verification (before coding)

| Source | Official docs used | Result |
| --- | --- | --- |
| Greenhouse Job Board API | https://docs.greenhouse.io/job-board.html | Public GET per `board_token`; no auth for reads |
| Lever Postings API | https://github.com/lever/postings-api | Public GET per `SITE`; `mode=json`; EU host optional |

Neither API is global job search. Empty `JOB_SOURCES_JSON` ⇒ no invented listings.

### Acceptance evidence

| Criterion | Evidence |
| --- | --- |
| Typed connector framework | `@aijh/job-connectors` |
| Board registry | `JOB_SOURCES_JSON` + `createConnectorRegistry` |
| Greenhouse + Lever | Adapters + capabilities `isGlobalSearch: false` |
| Normalize / hash / dedupe / freshness | `@aijh/job-normalization` + migration `0003_job_catalog` |
| Retries + health | `fetchJsonWithRetry`; source health fields; `GET /sources` |
| Tests | Connector/normalization unit + sources ingest integration (mock HTTP) |

### Commands executed (actual)

| Command | Result |
| --- | --- |
| `pnpm db:migrate` | pass — `0003_job_catalog` |
| `pnpm test` | pass (includes job-connectors 4, job-normalization 2, contracts job config) |
| `pnpm test:integration` | pass — **7** tests (auth, tenant, CV, **sources×2**) |
| `pnpm build` | pass |
| `pnpm typecheck` | pass |

### Limitations

- No live network required in CI; live boards only when configured
- Redistribution/commercial-use of third-party JD text needs legal review before production marketing claims
- `closed` status not auto-set from discover misses (stale only)
- Matching / ranking was deferred to Phase 3 (now complete — see 2026-10-28 entry)

### Next

Phase 3 completed 2026-10-28; see that entry for Phase 4 next steps.

---

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
