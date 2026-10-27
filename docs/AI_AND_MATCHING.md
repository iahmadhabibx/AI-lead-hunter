# AI and Matching

## AI runtime principles

- Provider-independent interface (Ollama adapter initially)
- Structured outputs validated against versioned Zod schemas
- Timeouts, bounded retries, concurrency limits
- Prompt + model version tracked on every generation
- Graceful degradation when inference unavailable
- **No mandatory paid AI API**
- Do not auto-download large models on app startup — explicit setup command

## CV extraction (Phase 1 — implemented)

Packages: `@aijh/ai-runtime`, `@aijh/cv-processing`, schema in `@aijh/contracts` (`CandidateProfilePayload` **v1.0.0**).

1. Magic-byte validation for PDF/DOCX; size limits via `MAX_UPLOAD_BYTES`
2. Text extraction with `pdf-parse` / `mammoth` (**OCR not enabled** — empty/scanned PDFs fail with a clear error)
3. AI extraction via provider-agnostic interface:
   - `mock` — deterministic heuristics for CI/local (default)
   - `ollama` — optional local chat JSON extraction; requires `OLLAMA_MODEL`
4. Zod validation of every model result; `missingFields` / `uncertainFields` explicit
5. Experience months calculated with overlap collapsing (`calculateExperienceMonths`)
6. Provenance stores provider/model/promptVersion on the profile version
7. User must review pending draft and **approve** to create an immutable active version

CV text is wrapped as data (`CV_TEXT_BEGIN`/`END` for Ollama). Model output cannot execute tools.

### Explicit setup for Ollama (not automatic)

1. Install Ollama and pull a model manually.
2. Set `AI_PROVIDER=ollama` and `OLLAMA_MODEL=<name>`.
3. Ensure `OLLAMA_BASE_URL` is reachable. App startup does **not** download models.

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
