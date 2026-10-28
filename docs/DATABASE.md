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
- Application connects with a non-owner role (`aijh_app`) after bootstrap.
- Bootstrap/migrations use `DB_ADMIN_URL` (owner); runtime uses `DATABASE_URL` (`aijh_app`, subject to RLS).
- Session create/lookup/revoke go through `SECURITY DEFINER` functions so login works without a tenant setting.
- `background_tasks` (and later private tables) require `app.current_user_id` via `withTenantContext`.

## Phase 0 core tables

| Table | Purpose |
| --- | --- |
| `users` | Account identity, email (unique), password hash, status |
| `sessions` | Server-side sessions (token hash, expiry, user_id) |
| `audit_events` | Security/audit trail (minimal PII) |
| `background_tasks` | Long-running task metadata (status, type, owner) |

## Phase 1 tables

| Table | Purpose |
| --- | --- |
| `cv_documents` | Private uploaded CVs, status, storage path, content hash |
| `candidate_profiles` | One profile shell per user + `active_version_id` |
| `candidate_profile_versions` | Versioned JSON payloads; `pending_review` / `approved` / `superseded` |

RLS + `FORCE ROW LEVEL SECURITY` on all three; access via `withTenantContext`.

## Phase 2 catalog tables (shared — not per-user RLS)

| Table | Purpose |
| --- | --- |
| `job_sources` | Configured boards/sites, health + ingest metadata |
| `source_jobs` | Source-native IDs, raw payload, status, timestamps |
| `canonical_jobs` | Normalized listings + content hash + freshness |
| `job_source_links` | Many-to-many source ↔ canonical |

## Phase 3 matching / feedback tables (user-owned + RLS)

| Table | Purpose |
| --- | --- |
| `match_results` | Per user/profile-version/job/scoring-version; band, suitability %, breakdown JSON |
| `saved_jobs` | User-saved catalog jobs (unique per user+job) |
| `feedback_events` | Append-only interest/save/reject/… events with optional rejection reasons |

## Later tables (designed; migrate in later phases)

users-owned: `preferences` (learned), `applications`, `generated_documents`

shared/catalog: `skills`, `job_skills`

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
