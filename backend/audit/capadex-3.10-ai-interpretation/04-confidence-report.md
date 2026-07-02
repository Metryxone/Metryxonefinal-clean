# CAPADEX 3.0 · Program 3 · Phase 3.10 — Confidence Report (dimension 3 · confidence)

> Deliverable 04 · Generated 2026-07-02T01:17:50.467Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:a3adfa09b058, written 2026-07-02T01:17:50.473Z).
> Scope: INTERPRETATION, EXPLAINABILITY, CONFIDENCE & HALLUCINATION-PROTECTION ONLY — interpretation engine/explainability/confidence/hallucination-protection/rule-repository/super admin/frontend/ux/APIs/testing/documentation that turn a STANDARDIZED score (3.8) + BENCHMARK result (3.9) into an interpreted, explainable, confidence-scored, hallucination-protected result; it NEVER re-scores, re-standardizes, re-benchmarks or builds a norm. Recommendation / learning-path / growth-planning / report-generation / dashboard-intelligence are OUT OF SCOPE (later phases; boundaries).
> Honesty: the ELEVEN certification dimensions (ai_interpretation · explainability · confidence · hallucination_protection · rule_repository · super_admin · frontend · ux · apis · testing · documentation) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Interpretation ABSTAINS below k_min=30 real evidence / the confidence floor. The composite interpretation index is a STRUCTURED AST (no eval / new Function). The interpretation CORE is deterministic; the LLM narration is an OPTIONAL, honest-degrading, grounded-token-constrained, output-validated seam. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

Each interpretation is confidence-scored from evidence completeness via the pure `computeConfidence` mechanism — missing-evidence detection, a human-review recommendation and ABSTENTION below the k_min=30 / confidence floor. Below the floor the interpretation returns `abstained=true` (reason: cohort below k_min / insufficient evidence), NEVER a fabricated confident value.

**Confidence criteria:** 5 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (5 total).

| Capability | Status | Note |
|---|---|---|
| **Confidence scoring** (`confidence_scoring`) | SUPPORTED | computeConfidence maps the fraction of required evidence present to a confidence score (0..1) + a band (low/medium/high). Deterministic. |
| **Evidence completeness** (`evidence_completeness`) | SUPPORTED | Which required evidence facets (score / benchmark / rule / cohort) are present vs missing — the confidence numerator/denominator. |
| **Missing-evidence detection** (`missing_evidence`) | SUPPORTED | The explicit list of missing evidence facets — surfaced so a reviewer knows exactly what is absent. null ≠ 0. |
| **Human-review recommendation** (`human_review`) | SUPPORTED | A human_review flag is raised when confidence is below the review threshold or an unsupported claim was detected — never auto-published silently. |
| **Abstention below floor** (`abstention`) | SUPPORTED | When cohort/evidence is below k_min / the confidence floor the interpretation ABSTAINS (abstained:true) rather than asserting — never fabricated. |

### Confidence (`confidence`) — SUPPORTED
_computeConfidence scores each interpretation from evidence completeness (fraction of required facets present → score + band), lists missing evidence, raises a human_review flag below the review threshold, and ABSTAINS below k_min / the confidence floor. Confidence ⟂ Coverage ⟂ Adoption — never composited. Confidence is COMPUTED, never guessed; null (unknown) ≠ 0._

- **Services**: services/ai-interpretation-mechanisms.ts, services/ai-interpretation-engine.ts
- **Routes**: routes/ai-interpretation.ts
- **Frontend**: components/ai-interpretation/AiInterpretationWorkbench.tsx
- **Tables**: aixp_runs, aixp_thresholds
- **Verified**: svc 2/2 · rt 1/1 · fe 1/1 · tbl 0/2


_Confidence is COMPUTED from evidence completeness, kept SEPARATE from Coverage and Adoption (never composited). Below the floor the mechanism ABSTAINS + recommends human review — null (unknown) ≠ 0 (absent) ≠ a fabricated confident value._
