# Testing

## Layers

| Layer | Scope | Default deps |
| --- | --- | --- |
| Unit | Schemas, dates, scoring, filters, normalization | none |
| Integration | DB constraints, migrations, auth, queues, tenant isolation | Postgres/Redis via Compose |
| E2E | Full user journeys | Compose stack + mock AI |
| Security | IDOR, uploads, injection, rate limits, secret leakage | as above |
| AI evaluation | Extraction/ranking fixtures | mock or explicit local model |

## Commands (Phase 0+)

```bash
pnpm test          # unit across packages/apps
pnpm test:integration
pnpm test:e2e      # later phases
pnpm build
pnpm lint
pnpm typecheck
```

Exact scripts are defined in the root `package.json` as they land.

## Rules

- CI must not require live Ollama or external job APIs.
- Never claim a test passed without executing it.
- Do not delete/weaken tests solely to pass CI; fix the product or the test with justification.

## Phase 0 coverage targets

- Env validation
- Password hashing + session auth flows (integration)
- Health/ready endpoints
- Migration apply on clean database
