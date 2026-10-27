# Architecture

## Style

**Modular monolith** with three deployable processes sharing packages:

```
apps/
  web/      Next.js UI (BFF-light; talks to API)
  api/      NestJS REST API (/api/v1)
  worker/   BullMQ consumers (CV, discovery, matching, maintenance)

packages/
  contracts/     Zod schemas, enums, shared types
  database/      Drizzle schema, migrations, DB client helpers
  security/      Auth helpers, policies, hashing
  observability/ Logging, request IDs, health helpers
  # Later phases (created when needed):
  # candidate-profile, cv-processing, job-connectors,
  # job-normalization, matching, feedback,
  # application-assistance, ai-runtime
```

Empty packages are **not** created solely to match a diagram. Domain packages appear when Phase 1+ work starts.

## Dependency direction

```
web → contracts
api → contracts, database, security, observability
worker → contracts, database, security, observability
domain packages → contracts (+ database where persistence belongs)
ai-runtime ← used by cv-processing / matching / application-assistance
```

No circular package dependencies. Domain logic does not import NestJS or Next.js.

## Data flow (target)

1. **CV upload** → API stores private object → enqueues `cv.process` → worker extracts text → AI structured extraction → pending profile → user review → approved immutable version.
2. **Discovery** → scheduled/on-demand jobs per enabled connector → normalize → dedupe → store canonical jobs.
3. **Matching** → worker ranks active profile vs jobs → persists score breakdown + explanations.
4. **Feedback** → audit events → deterministic preference updates (never silent CV mutation).
5. **Assistance** → draft generation grounded in approved profile + job → review/approve.

## Sync vs async

| Operation | Mode |
| --- | --- |
| Auth, profile reads, feedback writes | Synchronous HTTP |
| CV parse, discovery, matching, draft gen | Async via BullMQ; HTTP returns task id |

## AI boundary

`ai-runtime` (Phase 1) exposes a provider-agnostic interface. Production default: Ollama. Tests: mock adapter. Domain code never depends on Ollama response shapes.

## Deviations from the recommended diagram

- Phase 0 only creates packages needed for foundation (`contracts`, `database`, `security`, `observability`).
- File storage starts as local disk volume in Compose; S3-compatible adapter documented for production.
- OpenAPI generated/served from NestJS; contract schemas owned by `packages/contracts`.

## Scalability notes (non-goals for MVP)

Horizontal API/worker replicas are possible later because state lives in Postgres/Redis/object storage. Do not preemptively split into microservices.
