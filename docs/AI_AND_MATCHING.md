# AI and Matching

## AI runtime principles

- Provider-independent interface (Ollama adapter initially)
- Structured outputs validated against versioned Zod schemas
- Timeouts, bounded retries, concurrency limits
- Prompt + model version tracked on every generation
- Graceful degradation when inference unavailable
- **No mandatory paid AI API**
- Do not auto-download large models on app startup — explicit setup command

## CV extraction (Phase 1)

1. Extract text with maintained PDF/DOCX libraries; OCR fallback for scans
2. Pass text to model for structured extraction constrained by schema
3. Validate; represent missing fields explicitly
4. Never fabricate names, employers, dates, skills, qualifications
5. Store evidence/provenance where practical
6. User review required before approved immutable profile version

CV/job text is untrusted. System instructions and tool permissions must not be overridable by document content.

## Matching (Phase 3)

Deterministic, independently testable scoring. Initial weights (configurable):

| Component | Weight |
| --- | --- |
| Skills / technical requirements | 30% |
| Experience / seniority | 25% |
| Role alignment | 15% |
| Work mode / location | 15% |
| Compensation | 10% |
| Industry / interests | 5% |

Requirements:

- Hard eligibility filters first
- Unknown ≠ positive
- Sponsorship unknown unless evidenced
- Persist profile version, job version/hash, scoring version, component scores, evidence, missing/unknowns
- Match % is **not** interview/hiring probability
- Embeddings optional for retrieval only; cosine ≠ calibrated success probability

## Feedback learning (Phase 4)

Auditable events → transparent deterministic preference updates. No fine-tune from small click sets. Explicit constraints override inferences. Users can review/reset learned preferences. Never infer sensitive characteristics.

## Application assistance (Phase 5)

Drafts grounded only in approved profile evidence + job description. Human edit/approve required. No automated submission.

## Evaluation

Fixtures under `tests/evaluation/`. Measure extraction field accuracy, unsupported claims, ranking regressions, hard-constraint violations. CI uses mock AI.
