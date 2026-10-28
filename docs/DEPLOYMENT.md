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

```bash
# From repo root with DB_ADMIN_URL set (owner URL)
export DB_ADMIN_URL=postgres://aijh:aijh_dev_password@localhost:5433/aijh
bash infra/scripts/backup-postgres.sh

# Destructive restore (requires explicit confirmation)
CONFIRM_RESTORE=YES bash infra/scripts/restore-postgres.sh tmp/backups/aijh-….dump
```

Schedule backups operationally before production cutover. Scripts are helpers — not a managed backup service.

## Production runbook (minimum)

1. TLS terminator in front of API/web; set `NODE_ENV=production`, `TRUST_PROXY=true` only if the proxy is trusted.
2. Distinct strong `SESSION_SECRET` and DB passwords (not Compose defaults).
3. Runtime `DATABASE_URL` must use `aijh_app` (RLS); migrate with `DB_ADMIN_URL`.
4. Persistent volume or object storage for `STORAGE_ROOT`.
5. Always-on API + worker processes; Redis + Postgres HA as required by SLO.
6. Run backup script on a schedule; test restore in a staging DB.
7. Keep `AI_PROVIDER=mock` unless Ollama/host inference is provisioned intentionally.

**Public free hosts are not production** without persistent DB, workers, storage, and TLS.

## CI

GitHub Actions: install, migrate, unit tests, API/worker/web build with Postgres+Redis services. Mock AI only.

## Readiness

See `docs/RELEASE_READINESS.md`. Current verdict: **not production-ready** for public internet until blockers listed there are closed.
