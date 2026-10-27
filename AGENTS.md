# AGENTS.md — AI Job-Hunting SaaS

Engineering rules for humans and AI agents working in this repository.

**Keep this file and `docs/PROGRESS.md` in the repository for the entire life of the project.** They carry engineering rules and a verified record of what is actually implemented across sessions. Do not delete, empty, or replace them with aspirational status.

## Phase completion discipline

A phase is **not** complete because files, scaffolds, or UI shells were generated.

A phase is complete only when **all** of the following are true:

1. Acceptance criteria in `docs/IMPLEMENTATION_PLAN.md` are met by working behavior.
2. The feature works end-to-end for that phase (not merely represented in code or UI).
3. Input validation and authorization are implemented where the phase touches private data.
4. Relevant tests were **executed** and passed; record the commands and outcomes in `docs/PROGRESS.md`.
5. The project builds where applicable; migrations are consistent if schema changed.
6. Documentation matches the implementation.
7. Remaining limitations are stated honestly in `docs/PROGRESS.md`.

Never mark a phase ✅ / PASS from file presence alone. That discipline separates a serious SaaS product from a prototype that only looks impressive.

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
