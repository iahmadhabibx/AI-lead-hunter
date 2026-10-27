# Deployment

## Local development (supported)

Docker Compose provides:

- PostgreSQL 16 (+ extension bootstrap)
- Redis 7
- API, worker, web (or run Node processes on host against Compose services)
- Local file volume for private uploads

Optional: Ollama installed on host (detected on this machine under Windows Programs). Models are **not** pulled automatically.

```bash
cp .env.example .env
pnpm install
docker compose -f infra/docker/docker-compose.yml up -d postgres redis
# Host ports: Postgres 5433, Redis 6379 (5432 often occupied by other local DBs)
pnpm db:migrate
pnpm dev
```

See `.env.example` for variables. Local startup must not need production credentials.

## Ollama setup (explicit)

1. Install Ollama.
2. Pull a chosen model manually (document disk/RAM needs when a model is selected in Phase 1).
3. Set `OLLAMA_BASE_URL` (default `http://127.0.0.1:11434`).
4. Health check via AI runtime when that package exists.

## Public demonstration vs production

| Concern | Demo | Production |
| --- | --- | --- |
| Persistent Postgres | Often limited | Required |
| Workers | May sleep/cold start | Always-on |
| Local GPU/LLM | Usually unavailable | Dedicated inference host or approved self-host |
| Object storage | Ephemeral disk risk | Durable private bucket |
| TLS / secrets | Optional | Required |

Do not claim free hosts are production-ready without verifying persistent storage, workers, and inference.

## Health

- `GET /api/v1/health` — process up
- `GET /api/v1/ready` — DB + Redis reachable

## Backups

Document Postgres dump/restore before production cutover. Phase 0: `pg_dump` / `pg_restore` via Compose documented in scripts as they land.

## CI

GitHub Actions: install, typecheck, unit tests, build. Integration tests when services available.
