# CAPADEX 3.0 · Program 3 · Phase 3.10 — Interpretation Substrate Reuse (reuse-before-build)

> Deliverable 13 · Generated 2026-07-02T01:17:50.467Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:a3adfa09b058, written 2026-07-02T01:17:50.473Z).
> Scope: INTERPRETATION, EXPLAINABILITY, CONFIDENCE & HALLUCINATION-PROTECTION ONLY — interpretation engine/explainability/confidence/hallucination-protection/rule-repository/super admin/frontend/ux/APIs/testing/documentation that turn a STANDARDIZED score (3.8) + BENCHMARK result (3.9) into an interpreted, explainable, confidence-scored, hallucination-protected result; it NEVER re-scores, re-standardizes, re-benchmarks or builds a norm. Recommendation / learning-path / growth-planning / report-generation / dashboard-intelligence are OUT OF SCOPE (later phases; boundaries).
> Honesty: the ELEVEN certification dimensions (ai_interpretation · explainability · confidence · hallucination_protection · rule_repository · super_admin · frontend · ux · apis · testing · documentation) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Interpretation ABSTAINS below k_min=30 real evidence / the confidence floor. The composite interpretation index is a STRUCTURED AST (no eval / new Function). The interpretation CORE is deterministic; the LLM narration is an OPTIONAL, honest-degrading, grounded-token-constrained, output-validated seam. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

This platform **reuses** the existing interpretation substrate — it does NOT rebuild it. Each reused module below is composed by **existence-verification** in the certification scan (verified present on the live filesystem), and is **NEVER invoked at compose time**. Only the pure 3.8 structured-AST formula engine + the pure psychometric transforms + the `aiClient` health-gated LLM seam are reused at RUNTIME inside the pure mechanisms.

## Reused substrate (existence-verified · NOT invoked at compose)
- `aiClient` — the health-gated LLM seam (`checkAIHealth` gates the OPTIONAL narration; falls back to deterministic on ANY failure).
- `mei-narrative-engine` — rule-driven employability narration prior-art (the pattern for grounded, rule-selected narration).

## Reused at RUNTIME (inside the pure mechanisms)
- Phase 3.8 structured-AST formula engine: `validateFormula` / `evaluateFormula` (via `evaluateInterpretationFormula`) — the composite interpretation index (no eval / new Function).
- `psychometric-standardization`: `zFromValue` / `zToPercentile` — the pure z / percentile transforms carried into the interpretation inputs.

**Repository-alignment (services present):** svc 17/17. Every claim verified vs the live FS. null (unknown) ≠ 0 (absent). NO duplicate AI / interpretation engine, NO V2, NO breaking change.

## Do-not-implement boundaries (interpretation FEEDS these — reported in-line, NEVER gaps)
- **Recommendation Engine** (`recommendation_engine`, owner: later phase) — Interpretation FEEDS recommendations; it does NOT generate them. Building a recommendation engine here is out of scope — a boundary, not a gap.
- **Learning-Path Engine** (`learning_path`, owner: later phase) — Interpretation of "what to learn" is present; authoring a learning path is out of scope — a boundary, not a gap.
- **Growth-Planning Engine** (`growth_planning`, owner: later phase) — Interpretation of growth is present; a growth-planning engine is out of scope — a boundary, not a gap.
- **Report Generation** (`report_generation`, owner: later phase (report-factory)) — Interpretation is a report INPUT; report generation / rendering is out of scope here — a boundary, not a gap.
- **Dashboard Intelligence** (`dashboard_intelligence`, owner: later phase) — Interpretation feeds dashboards; building dashboard intelligence is out of scope here — a boundary, not a gap.

## Interpretation decisions (freeze invariants)
- **Compose, never duplicate** (`D1`) — AI Interpretation COMPOSES the existing interpretation substrate (aiClient health-gated LLM seam + mei-narrative-engine rule-driven narration prior-art) + the pure 3.8 structured-AST formula engine + the pure psychometric transforms under one platform + an additive aixp_* overlay — NO duplicate AI / interpretation engine, NO V2, NO breaking change.
- **Downstream of standardization + benchmarking** (`D2`) — Interpretation consumes the standardized scores (3.8) + benchmark results (3.9) + norm references (3.7). It NEVER re-scores, NEVER re-standardizes, NEVER re-benchmarks, NEVER builds a norm.
- **Eleven dimensions certified SEPARATELY** (`D3`) — ai_interpretation · explainability · confidence · hallucination_protection · rule_repository · super_admin · frontend · ux · apis · testing · documentation are reported SEPARATELY and NEVER composited into a single score.
- **Deterministic core, honest-degrading AI narration** (`D4`) — The interpretation CORE is deterministic (rule-select via 3.8 AST + grounded token render + confidence + explanation). The LLM narration is OPTIONAL: health-gated, grounded-token-constrained, output-validated (detectUnsupportedClaims + verifyReferences), and falls back to deterministic + source-tag on ANY failure. AI output is NEVER fabricated.
- **Composite index is a STRUCTURED AST (no eval)** (`D5`) — The composite interpretation index reuses the 3.8 structured-AST formula engine (const/var/op/weighted/clamp/standardize nodes) evaluated by a whitelisted interpreter (evaluateFormula) — NEVER eval / new Function / string-executed. Formulas are validated before evaluation.
- **ABSTAIN below floor; null ≠ 0** (`D6`) — Interpretation ABSTAINS below k_min real evidence / the confidence floor. Coverage ⟂ Confidence ⟂ Adoption are never composited. null (unknown) ≠ 0 (absent). Never fabricate.
- **Governed & versioned, never destructive** (`D7`) — Every interpretation asset (rule / prompt / threshold / policy) moves through draft→review→validate→approve→publish→archive→retire with append-only version history + rollback + audit trail. Governance transitions are recorded, never destructive.
- **Byte-identical OFF incl. schema** (`D8`) — All DDL runs only on the flag-gated write paths; read certifications are GET (to_regclass/fs probes) and pure computes are side-effect-free. OFF is byte-identical incl. schema (0 aixp_* tables).
- **DO-NOT-IMPLEMENT boundaries** (`D9`) — Recommendation Engine, Learning-Path Engine, Growth-Planning Engine, Report Generation and Dashboard Intelligence are NOT built in 3.10 — interpretation FEEDS them. They are later-phase BOUNDARIES, never counted as gaps.
- **Breadth is honest, never forced** (`D10`) — Fine-grained interpretation KINDS (finer standardized inputs upstream), some persona / lifecycle depth (authored volume) and longitudinal modes (accumulated volume) are PARTIAL / ADOPTION — reported SEPARATELY and in-line, never padded to 100%, never fabricated.
