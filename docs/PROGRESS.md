# Progress

## 2026-10-27 — Audit + Phase 0 foundation

### Audit summary

| Item | Finding |
| --- | --- |
| What exists | Empty directory at start; host tooling (Node 22, Docker, Ollama binary) |
| What is missing | Full product beyond Phase 0 (CV, connectors, matching, etc.) |
| Preserve | N/A (greenfield) |
| Architecture | pnpm modular monolith — see ADRs in `docs/DECISIONS.md` |
| Blockers | Local host port 5432 occupied → Compose uses **5433** |

### Phase 0 completed

- Monorepo: `apps/web`, `apps/api`, `apps/worker`, packages `contracts`, `database`, `security`, `observability`
- Docs set + `AGENTS.md` + README
- Docker Compose: Postgres 16 (host 5433), Redis 7
- Drizzle migration `0000_phase0_foundation` (users, sessions, audit_events, background_tasks + RLS pattern)
- NestJS: env validation, health/ready, register/login/logout/me, cookies, OpenAPI at `/api/v1/docs`
- Worker: BullMQ heartbeat bootstrap
- Web: ForgePath landing + register/login + authenticated `/app` shell
- CI workflow + unit/integration tests

### Verified commands

| Command | Result |
| --- | --- |
| `pnpm install` | pass |
| `docker compose -f infra/docker/docker-compose.yml up -d` | pass (Postgres **5433**, Redis 6379) |
| `pnpm db:migrate` | pass |
| `pnpm test` | pass (9 unit tests across packages/api) |
| `pnpm test:integration` | pass (auth register/me/logout) |
| `pnpm --filter @aijh/api --filter @aijh/worker build` | pass |
| `NODE_ENV=production pnpm --filter @aijh/web build` | pass |
| `GET /api/v1/health` | `{"status":"ok",...}` |
| `GET /api/v1/ready` | database+redis ready |
| Auth smoke (register/login/me) | pass |

### Known gaps (Phase 0)

- Default local `DATABASE_URL` uses DB owner role; `aijh_app` + stricter session RLS deferred toward hardening
- Password reset, email delivery, full CSRF strategy not implemented
- No CV/job domain packages yet (intentional)
- Worker only runs heartbeat; no domain queues yet

### Next — Phase 1 acceptance criteria

1. Secure PDF/DOCX upload with magic-byte validation and size limits  
2. Async CV processing task with status polling  
3. Text extraction + mock AI structured profile (Ollama adapter available)  
4. Canonical profile schema + review/correction UI  
5. Immutable approved profile versions + active pointer  
6. Integration + e2e coverage for the onboarding slice  
7. Docs updated (`AI_AND_MATCHING`, `PROGRESS`, API contracts)
