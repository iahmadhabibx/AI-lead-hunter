# Job Connectors

## Contract (target)

Strongly typed operations:

- `discover(query, cursor)` — paginated discovery for a configured board/source
- `fetchJob(sourceJobId)` — fetch one listing
- `healthCheck()` — dependency health
- `getCapabilities()` — auth needs, rate limits, pagination style, attribution

Registry: enable/disable/configure/monitor sources independently.

## Initial sources (Phase 2)

Documented public **Greenhouse** and **Lever** job-board endpoints for **configured employer boards**.

These are **not** global job search APIs. Coverage = boards the operator configures.

Before implementation, re-verify current public docs, rate limits, attribution, and storage permissions. If unverifiable, ship connector as `unavailable`/`disabled` with a documented boundary — never invent jobs.

## Ingestion rules

- Canonical normalization + content hashes
- Source-specific IDs + canonical application URLs + attribution
- Dedup, first/last seen, last verified, published timestamps
- States: `active`, `stale`, `closed`, `unknown` — do not mark every miss as closed
- Bounded retries, exponential backoff + jitter, per-source concurrency
- Idempotent ingestion; reprocess after normalization version bumps

## Prohibited

- Unrestricted scraping
- CAPTCHA bypass
- Unauthorized authenticated access
- Deceptive automation

## Adding a source

Evaluate official API/feed, auth, rate limits, attribution, caching/storage rights, commercial-use licensing, coverage, redistribution terms. Document the evaluation in `docs/DECISIONS.md`.
