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

## Matching (Phase 3 — implemented)

Package: `@aijh/matching`. Scoring version **`MATCH_SCORING_VERSION = 1.0.0`**.

Deterministic, independently testable scoring. Weights (`DEFAULT_MATCH_WEIGHTS`):

| Component | Weight |
| --- | --- |
| Skills / technical requirements | 30% |
| Experience / seniority | 25% |
| Role alignment | 15% |
| Work mode / location | 15% |
| Compensation | 10% |
| Industry / interests | 5% |

Pipeline:

1. **Hard filters** — job status, excluded industries, work mode (when both known), country (place-specific conflicts), relocation refusal + onsite elsewhere, sponsorship (`yes` + evidenced `not_offered`).
2. Soft notes (e.g. sponsorship required but employer stance unknown) → band `needs_verification` (unknown ≠ positive).
3. **Component scores** — unknown components are excluded from the weighted average (never treated as 1.0).
4. Persist `match_results` with profile version id, job content hash, scoring version, band, suitability %, full breakdown JSON.

APIs: `POST /matches/run`, `GET /matches`, `GET /matches/:id`, save/reject + `feedback` endpoints. Worker queue `jobs-match`.

Requirements upheld:

- Hard eligibility filters first
- Unknown ≠ positive
- Sponsorship unknown unless evidenced in job text (`detectSponsorshipSignal`)
- Match % is **not** interview/hiring probability
- Embeddings not used for MVP scoring

## Feedback learning (Phase 4 — implemented)

Package: `@aijh/feedback` (`PREFERENCE_LEARNING_VERSION` **1.0.0**).

- Deterministic rules from `feedback_events` (+ job catalog context): interest/save boosts titles/modes; rejection reasons demote work modes / exclude industries.
- Persisted in `learned_preferences` (versioned; reset marks prior active as `reset`).
- APIs: `GET/POST /preferences/learned`, `POST /preferences/learned/recompute`, `POST /preferences/learned/reset`.
- Never mutates CV facts; never infers sensitive characteristics. Explicit profile preferences override learned signals at match time.

## Application assistance (Phase 5 — implemented)

Package: `@aijh/application-assistance` (`DRAFT_GENERATION_VERSION` **1.0.0**).

- Template-grounded drafts from **approved** profile evidence + job description only.
- Claim validation flags unsupported assertions; approval blocked while unsupported claims remain.
- Tables: `applications`, `generated_documents` (versioned per type).
- Worker queue `docs-generate`. Export Markdown with provenance headers.
- Status `applied` is **user-reported tracking only** — system never submits to employer portals.

## Evaluation

Fixtures under `tests/evaluation/`. Measure extraction field accuracy, unsupported claims, ranking regressions, hard-constraint violations. CI uses mock AI.
