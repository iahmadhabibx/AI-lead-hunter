# Job Connectors

## Contract (implemented)

Strongly typed operations in `@aijh/job-connectors`:

- `discover(query, cursor, signal?)` — paginated discovery for a configured board/source
- `fetchJob(sourceJobId, signal?)` — fetch one listing (`null` on confirmed 404)
- `healthCheck(signal?)` — dependency health
- `getCapabilities()` — auth needs, pagination, attribution, **`isGlobalSearch: false`**

Registry (`createConnectorRegistry`): enable/disable/configure sources independently. Disabled or unsupported entries surface an explicit `unavailableReason` — never fake jobs.

HTTP helper: bounded retries with exponential backoff + jitter for 429/5xx.

## Verified initial sources (Phase 2)

Documentation re-checked 2026-10-27:

| Provider | Official surface | Auth (read) | Scope |
| --- | --- | --- | --- |
| **Greenhouse Job Board API** | `GET https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs` (+ `?content=true`); one job `.../jobs/{id}` — [docs.greenhouse.io/job-board.html](https://docs.greenhouse.io/job-board.html) | None for GET | **Per board_token only** |
| **Lever Postings API** | `GET https://api.lever.co/v0/postings/{SITE}?mode=json&skip=&limit=` (EU: `api.eu.lever.co`); one posting `.../{SITE}/{id}` — [github.com/lever/postings-api](https://github.com/lever/postings-api) | None for public postings | **Per site slug only** |

These are **not** global job search APIs. Coverage = boards/sites the operator configures in `JOB_SOURCES_JSON`.

### Access / redistribution limitations

- Public GET board/postings feeds are intended for careers-site style consumption; commercial redistribution rights are not asserted here — store only for product matching with attribution preserved.
- Greenhouse application **POST** requires a Job Board API key — **out of scope** (no application automation).
- Lever authenticated API (`api.lever.co/v1`) — **out of scope**.
- Rate limits: Greenhouse docs do not publish a hard public GET limit; Lever postings are public. Clients still use bounded concurrency + retries.
- If a board/site 404s or health fails, ingest records the error and does **not** invent listings.

## Configuration

```bash
JOB_SOURCES_JSON='[
  {"type":"greenhouse","key":"acme-gh","boardToken":"acme","enabled":true,"displayName":"Acme via Greenhouse"},
  {"type":"lever","key":"acme-lever","site":"acme","eu":false,"enabled":true}
]'
```

Empty / `[]` = no discovery (valid).

## Ingestion rules (implemented)

- Canonical normalization (`@aijh/job-normalization`, version `1.0.0`) + content hashes
- Source-specific IDs + apply URLs + attribution strings
- Dedup via `(provider, sourceKey, sourceJobId)` and canonical `content_hash`
- Timestamps: first/last seen, last verified, published when provided by source
- States: `active`, `stale`, `closed`, `unknown` — missing from a successful discover pass → **stale**, not closed; `fetchJob` 404 can confirm absence without inventing closure narratives
- Idempotent upserts; worker queue `jobs-discover` (hourly schedule + `POST /api/v1/sources/discover`)

## Prohibited

- Unrestricted scraping
- CAPTCHA bypass
- Unauthorized authenticated access
- Deceptive automation
- Fabricating job listings for demos mixed into the real catalog

## Adding a source

Evaluate official API/feed, auth, rate limits, attribution, caching/storage rights, commercial-use licensing, coverage, redistribution terms. Document in `docs/DECISIONS.md`.
