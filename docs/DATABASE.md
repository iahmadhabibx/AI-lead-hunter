# Database

## Engine

PostgreSQL 16+ (Compose publishes host port **5433** → container 5432 to avoid clashes with other local Postgres instances). Extensions planned:

| Extension | When |
| --- | --- |
| `pgcrypto` / gen_random_uuid | Phase 0 (UUIDs) |
| `vector` (pgvector) | When embeddings land (matching/retrieval) |

Timestamps: **UTC** (`timestamptz`). Primary keys: **UUID v4** unless noted.

## ORM and migrations

- **Drizzle ORM** + `drizzle-kit` for version-controlled SQL migrations in `packages/database/migrations`.
- Application connects with a non-owner role (`app_user`) after bootstrap.
- Bootstrap/migrations may use `DB_ADMIN_URL`; runtime uses `DATABASE_URL` (app role).

## Phase 0 core tables

| Table | Purpose |
| --- | --- |
| `users` | Account identity, email (unique), password hash, status |
| `sessions` | Server-side sessions (token hash, expiry, user_id) |
| `audit_events` | Security/audit trail (minimal PII) |
| `background_tasks` | Long-running task metadata (status, type, owner) |

## Later tables (designed; migrate in later phases)

users-owned: `cv_documents`, `candidate_profiles`, `candidate_profile_versions`, `preferences`, `feedback_events`, `saved_jobs`, `applications`, `generated_documents`, `match_results`

shared/catalog: `job_sources`, `source_jobs`, `canonical_jobs`, `job_source_links`, `skills`, `job_skills`

## Multi-tenancy model

**Tenant = user account** for MVP (no org/team yet). Every private row has `user_id` (or ownership path via FK). Authorization never trusts client-supplied user IDs.

### Row-Level Security (RLS)

Where practical, enable RLS on user-owned tables and set `app.current_user_id` in a transaction via `set_config`. Phase 0 enables RLS on `sessions` (owner path via user) and establishes the pattern; full coverage expands with each domain migration.

## Redis

Queues and ephemeral locks only. **Not** authoritative business data.

## Constraints principles

- Foreign keys everywhere ownership/integrity matters
- Unique constraints for natural keys (email, source+source_job_id, content hashes)
- Check constraints for enums/status where helpful
- Indexes follow real query patterns (user_id + created_at, task status, etc.)

## Destructive changes

Require explicit review, backup/restore plan, and entry in `docs/DECISIONS.md`.
