# ForgePath (AI Job Hunter)

Multi-tenant SaaS for CV-grounded job discovery, honest matching explanations, and human-reviewed application drafts.

## Status

**Phase 0 — engineering foundation** in progress / landing. See `docs/PROGRESS.md` and `docs/IMPLEMENTATION_PLAN.md`.

## Stack

- pnpm monorepo
- Next.js web (`apps/web`)
- NestJS API (`apps/api`)
- BullMQ worker (`apps/worker`)
- PostgreSQL + Redis via Docker Compose
- Local AI via Ollama (Phase 1+; mock in tests)

## Quick start

```bash
cp .env.example .env
pnpm install
docker compose -f infra/docker/docker-compose.yml up -d
pnpm db:migrate
pnpm --filter @aijh/contracts --filter @aijh/observability --filter @aijh/security --filter @aijh/database build
pnpm --filter @aijh/api --filter @aijh/worker --filter @aijh/web dev
```

- Web: http://localhost:3000  
- API health: http://localhost:3001/api/v1/health  
- OpenAPI: http://localhost:3001/api/v1/docs  

## Docs

Start at `AGENTS.md` and the files under `docs/`.
