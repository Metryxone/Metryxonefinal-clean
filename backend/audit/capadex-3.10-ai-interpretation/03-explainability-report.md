# CAPADEX 3.0 · Program 3 · Phase 3.10 — Explainability Report (dimension 2 · explainability)

> Deliverable 03 · Generated 2026-07-02T01:17:50.467Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:a3adfa09b058, written 2026-07-02T01:17:50.473Z).
> Scope: INTERPRETATION, EXPLAINABILITY, CONFIDENCE & HALLUCINATION-PROTECTION ONLY — interpretation engine/explainability/confidence/hallucination-protection/rule-repository/super admin/frontend/ux/APIs/testing/documentation that turn a STANDARDIZED score (3.8) + BENCHMARK result (3.9) into an interpreted, explainable, confidence-scored, hallucination-protected result; it NEVER re-scores, re-standardizes, re-benchmarks or builds a norm. Recommendation / learning-path / growth-planning / report-generation / dashboard-intelligence are OUT OF SCOPE (later phases; boundaries).
> Honesty: the ELEVEN certification dimensions (ai_interpretation · explainability · confidence · hallucination_protection · rule_repository · super_admin · frontend · ux · apis · testing · documentation) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Interpretation ABSTAINS below k_min=30 real evidence / the confidence floor. The composite interpretation index is a STRUCTURED AST (no eval / new Function). The interpretation CORE is deterministic; the LLM narration is an OPTIONAL, honest-degrading, grounded-token-constrained, output-validated seam. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

Every interpretation carries a full explanation — why / evidence basis / data sources / rule reference / score reference / benchmark reference / assessment reference / confidence rationale — emitted by the pure `composeExplanation` mechanism. A reference that does not exist yet (e.g. no benchmark) is an honest `null`, never fabricated.

**Explainability criteria:** 8 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (8 total).

| Capability | Status | Note |
|---|---|---|
| **Why (reasoning)** (`why_explanation`) | SUPPORTED | The plain-language reason this interpretation was produced — derived from the fired rule + the observed band / percentile. Deterministic, grounded. |
| **Evidence basis** (`evidence_basis`) | SUPPORTED | The concrete evidence supporting the interpretation (which scores / dimensions / benchmark drove it) — carried as a structured evidence[] on every result. |
| **Data sources** (`data_sources`) | SUPPORTED | The upstream data sources (standardized score 3.8 / benchmark 3.9 / assessment) the interpretation reads from — enumerated on every result. |
| **Rule reference** (`rule_reference`) | SUPPORTED | The interpretation rule (aixp_rules key + version) that fired — carried on every result for full traceability. |
| **Score reference** (`score_reference`) | SUPPORTED | The standardized score (astd_standard_scores) interpreted — the interpretation input, carried on every result. |
| **Benchmark reference** (`benchmark_reference`) | SUPPORTED | The benchmark result (abmk_results, 3.9) the interpretation contextualizes — carried on every result; null when no benchmark exists yet (honest null). |
| **Assessment reference** (`assessment_reference`) | SUPPORTED | The assessment + version the interpreted score was produced against — carried on every result. |
| **Confidence rationale** (`confidence_rationale`) | SUPPORTED | Why the interpretation has the confidence it does — the evidence-completeness breakdown + missing-evidence list from computeConfidence. |

### Explainability (`explainability`) — SUPPORTED
_Every interpretation carries a full explanation via composeExplanation — why (reasoning) / evidence basis / data sources / rule reference / score reference / benchmark reference / assessment reference / confidence rationale (8 facets). Each reference resolves to a real provenance value (verifyReferences); an absent reference (no benchmark yet) is an honest null, never fabricated._

- **Services**: services/ai-interpretation-mechanisms.ts, services/ai-interpretation-engine.ts
- **Routes**: routes/ai-interpretation.ts
- **Frontend**: components/ai-interpretation/AiInterpretationWorkbench.tsx
- **Tables**: aixp_runs
- **Verified**: svc 2/2 · rt 1/1 · fe 1/1 · tbl 0/1


_All 8 facets are emitted on every interpretation. A null reference (no benchmark / assessment version yet) renders as an honest null (—), distinct from 0 — never fabricated._
