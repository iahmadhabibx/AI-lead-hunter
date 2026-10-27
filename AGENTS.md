# AGENTS.md — AI Job-Hunting SaaS

Engineering rules for humans and AI agents working in this repository.

## Product

Multi-tenant SaaS that helps users upload CVs, extract structured profiles, discover jobs from permitted sources, match with explanations, collect feedback, and prepare application materials with human review.

## Architecture

- TypeScript monorepo (pnpm workspaces)
- Modular monolith: `apps/api` (NestJS), `apps/worker` (BullMQ), `apps/web` (Next.js)
- PostgreSQL (+ pgvector when needed), Redis (queues only)
- Local AI via Ollama adapter; deterministic mock AI for tests
- Shared packages under `packages/` with explicit dependency direction

Do not introduce microservices, Kubernetes, or paid AI APIs for the MVP.

## Mandatory process

1. Inspect existing code and docs before changing behavior.
2. Prefer small, cohesive changes over large rewrites.
3. Never fabricate APIs, credentials, external responses, or test results.
4. Never claim a feature works unless implemented and verified.
5. Never leave fake integrations masquerading as working ones.
6. Keep factual CV data separate from preferences and ranking signals.
7. Validate all untrusted input at runtime (including CV text for prompt injection).
8. Enforce tenant isolation on every private read/write.
9. Use versioned migrations; never run destructive migrations without review.
10. Update `docs/PROGRESS.md` after meaningful work with verified commands.

## Phase order

0. Engineering foundation  
1. CV onboarding vertical slice  
2. Job connectors + normalization  
3. Matching + explanations  
4. Feedback + personalization  
5. Application assistance + tracking  
6. SaaS hardening + deployment  

Do not implement later phases before earlier phase acceptance criteria are met.

## Secrets and config

- Commit `.env.example` with placeholders only.
- Never commit real secrets or print them in logs/tests.
- Validate environment at process startup.
- Local development must not require production credentials.

## Testing

- Unit, integration, e2e, security, and AI-evaluation suites as documented in `docs/TESTING.md`.
- Default CI uses mock AI and mock connectors — no live model or external job APIs required.
- Fix failing tests; do not weaken them solely to go green.

## Documentation sources of truth

| Topic | Document |
| --- | --- |
| Product | `docs/PRODUCT_SPEC.md` |
| Architecture | `docs/ARCHITECTURE.md` |
| Database | `docs/DATABASE.md` |
| API | `docs/API_CONTRACTS.md` |
| Security | `docs/SECURITY.md` |
| AI / matching | `docs/AI_AND_MATCHING.md` |
| Connectors | `docs/JOB_CONNECTORS.md` |
| Testing | `docs/TESTING.md` |
| Deployment | `docs/DEPLOYMENT.md` |
| Plan | `docs/IMPLEMENTATION_PLAN.md` |
| ADRs | `docs/DECISIONS.md` |
| Status | `docs/PROGRESS.md` |

## When blocked

Choose a documented default when a missing decision does not block safety. Ask only when a decision is destructive, externally consequential, or materially ambiguous.
