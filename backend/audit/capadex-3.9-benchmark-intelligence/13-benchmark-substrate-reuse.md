# CAPADEX 3.0 · Program 3 · Phase 3.9 — Benchmark Substrate Reuse (reuse-before-build)

> Deliverable 13 · Generated 2026-07-01T18:15:29.031Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:cfbd7d362773, written 2026-07-01T18:15:29.033Z).
> Scope: BENCHMARKING & COMPARISON ONLY — benchmark engine/comparison engine/governance/super admin/frontend/ux/APIs/testing/documentation that turn a STANDARDIZED score (3.8) into percentile / z / delta / quartile against a reference group across multiple comparison dimensions + time modes; it NEVER re-scores, re-standardizes or builds a norm. AI-interpretation / recommendation / report / dashboard / candidate-analytics are OUT OF SCOPE (later phases).
> Honesty: the NINE certification dimensions (benchmark_engine · comparison_engine · governance · super_admin · frontend · ux · apis · testing · documentation) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Benchmarking ABSTAINS below k_min=30 real members in the reference group. The composite benchmark index is a STRUCTURED AST (no eval / new Function). Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

This platform **reuses** the existing benchmark substrate — it does NOT rebuild it. Each reused module below is composed by **existence-verification** in the certification scan (verified present on the live filesystem), and is **NEVER invoked at compose time**. Only the pure psychometric transforms (`zFromValue` / `zToPercentile`) + the 3.8 structured-AST formula engine are reused at RUNTIME inside the pure mechanisms.

## Reused substrate (existence-verified · NOT invoked at compose)
- `peer-benchmark` — peer / cohort benchmarking substrate.
- `m5-org-benchmark` — organization benchmarking substrate.
- `mei-benchmark-engine` — employability-index benchmarking substrate.
- `adaptive-benchmark` — adaptive difficulty / ability benchmarking substrate.
- `benchmark-engine` — generic benchmark metric-resolver substrate.
- `comparative-intelligence` — comparative / cohort-analytics substrate.

## Reused at RUNTIME (inside the pure mechanisms)
- `psychometric-standardization`: `zFromValue` / `zToPercentile` — the pure z / percentile transforms.
- Phase 3.8 structured-AST formula engine: `validateFormula` / `evaluateFormula` (via `evaluateBenchmarkFormula`) — the composite benchmark index (no eval / new Function).

**Repository-alignment (services present):** svc 17/17. Every claim verified vs the live FS. null (unknown) ≠ 0 (absent). NO duplicate benchmark / comparison engine, NO V2, NO breaking change.

## Benchmark decisions (freeze invariants)
- **Compose, never duplicate** (`D1`) — Benchmark Intelligence COMPOSES the existing benchmark substrate (peer-benchmark / m5-org-benchmark / mei-benchmark-engine / adaptive-benchmark / benchmark-engine / comparative-intelligence) + the pure psychometric transforms + the 3.8 structured-AST formula engine under one platform + an additive abmk_* overlay — NO duplicate benchmark / comparison engine, NO V2, NO breaking change.
- **Downstream of standardization** (`D2`) — Benchmarking consumes the standardized scores (3.8) + norm references (3.7). It NEVER re-scores, NEVER re-standardizes, NEVER builds a norm; it turns a standardized result + a reference group into a benchmark result (percentile / z / delta / quartile) and comparison verdicts.
- **Nine dimensions certified SEPARATELY** (`D3`) — benchmark_engine · comparison_engine · governance · super_admin · frontend · ux · apis · testing · documentation are reported SEPARATELY and NEVER composited into a single score.
- **Composite index is a STRUCTURED AST (no eval)** (`D4`) — The composite benchmark index reuses the 3.8 structured-AST formula engine (const/var/op/weighted/clamp/standardize nodes) evaluated by a whitelisted interpreter (evaluateFormula) — NEVER eval / new Function / string-executed. Formulas are validated before evaluation.
- **ABSTAIN below k_min; null ≠ 0** (`D5`) — Benchmarking ABSTAINS below k_min real members in the reference group. Coverage ⟂ Confidence ⟂ Adoption are never composited. null (unknown) ≠ 0 (absent). Never fabricate.
- **Governed & versioned, never destructive** (`D6`) — Every benchmark artefact moves through draft→review→validate→approve→publish→archive→retire with append-only version history + rollback + audit trail. Governance transitions are recorded, never destructive.
- **Byte-identical OFF incl. schema** (`D7`) — All DDL runs only on the flag-gated write paths; read certifications are GET (to_regclass/fs probes) and pure computes are side-effect-free. OFF is byte-identical incl. schema (0 abmk_* tables).
- **NO AI in this phase** (`D8`) — Every benchmark output is DETERMINISTIC. AI Interpretation, Recommendation Engine, Personalized Guidance, Report Generation, Dashboard Intelligence and Candidate Analytics are NOT implemented in 3.9 — they are later-phase scope.
- **Breadth is honest, never forced** (`D9`) — Institutional / geographic cohort TYPES (reachable via custom groups), fine-grained comparison DIMENSIONS (finer standardized inputs upstream) and time-series MODES (accumulated volume) are PARTIAL / ADOPTION — reported SEPARATELY and in-line, never padded to 100%, never fabricated.
