# Product Specification

## Vision

A privacy-first, multi-tenant SaaS that helps job seekers discover relevant roles, understand suitability with honest explanations, learn from explicit feedback, and prepare application materials under human review.

## Primary workflow

1. Register a private account.
2. Upload CV (PDF/DOCX).
3. Extract → validate → versioned canonical JSON.
4. User reviews and corrects extraction.
5. Store approved candidate profile (immutable versions + active pointer).
6. Discover jobs from configured, permitted sources.
7. Normalize, deduplicate, freshness-check, store.
8. Rank jobs against profile + preferences with explanations.
9. Save / reject / feedback (does not silently alter CV facts).
10. Track applications; draft tailored CV / cover letter / answers for review.
11. Privacy: export, deletion, tenant isolation.

## Fixed decisions

| Decision | Value |
| --- | --- |
| Product type | Public multi-tenant SaaS |
| Initial budget | Zero (no paid APIs/services for MVP) |
| AI inference | Local/self-hosted (Ollama) by default |
| Client | Responsive web (Next.js); desktop later |
| Application automation | AI drafts + human approval only |
| Architecture | Modular monolith + background workers |
| Database | PostgreSQL (+ pgvector when needed) |
| Queue | Redis + BullMQ |
| Backend | NestJS + TypeScript |
| Frontend | Next.js + React + TypeScript |

## Non-goals (MVP)

- Automated application submission / CAPTCHA bypass / scraping unauthorized sources
- Predicting interview or hiring probability from match scores
- Fine-tuning models from click feedback
- Inferring sensitive personal characteristics
- Global job search APIs that do not exist (Greenhouse/Lever are per-board)

## User-facing screens (required)

Landing, register/sign-in, onboarding, CV upload/progress, profile review, preferences, job feed, filters, job detail + match explanation, save/reject, application tracking, document editor, account settings, export/deletion.

## Honesty rules

- Never invent jobs, match %, or metrics for real users.
- Label demo/seed data clearly.
- Unknown eligibility (e.g. sponsorship) stays unknown without evidence.
- Match % is a weighted suitability score, not a hiring probability.

## Environments

| Environment | Purpose |
| --- | --- |
| Local development | Docker Compose + optional Ollama; mock AI for tests |
| Public demonstration | May lack persistent GPU inference; document limits |
| Production | Persistent Postgres/Redis/storage, workers, TLS, secrets management — not free by default |
