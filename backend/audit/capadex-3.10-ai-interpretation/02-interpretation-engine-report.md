# CAPADEX 3.0 · Program 3 · Phase 3.10 — Interpretation Engine Report (dimension 1 · ai_interpretation)

> Deliverable 02 · Generated 2026-07-02T01:17:50.467Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:a3adfa09b058, written 2026-07-02T01:17:50.473Z).
> Scope: INTERPRETATION, EXPLAINABILITY, CONFIDENCE & HALLUCINATION-PROTECTION ONLY — interpretation engine/explainability/confidence/hallucination-protection/rule-repository/super admin/frontend/ux/APIs/testing/documentation that turn a STANDARDIZED score (3.8) + BENCHMARK result (3.9) into an interpreted, explainable, confidence-scored, hallucination-protected result; it NEVER re-scores, re-standardizes, re-benchmarks or builds a norm. Recommendation / learning-path / growth-planning / report-generation / dashboard-intelligence are OUT OF SCOPE (later phases; boundaries).
> Honesty: the ELEVEN certification dimensions (ai_interpretation · explainability · confidence · hallucination_protection · rule_repository · super_admin · frontend · ux · apis · testing · documentation) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Interpretation ABSTAINS below k_min=30 real evidence / the confidence floor. The composite interpretation index is a STRUCTURED AST (no eval / new Function). The interpretation CORE is deterministic; the LLM narration is an OPTIONAL, honest-degrading, grounded-token-constrained, output-validated seam. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

A standardized score (3.8) + benchmark result (3.9) is interpreted — overall / domain / competency / behaviour / employability / leadership / readiness — via the pure `selectInterpretationRule` (a 3.8 structured-AST condition over the band + benchmark percentile) + `renderInterpretation` (grounded {{token}} substitution — fabricated tokens are stripped, never emitted) mechanisms, reusing the `aiClient` health-gated LLM seam for OPTIONAL narration only. The interpretation CORE is DETERMINISTIC; the LLM narration is honest-degrading (falls back to deterministic + source tag). Interpretation ABSTAINS below k_min=30 real evidence / the confidence floor — never fabricated.

**Interpretation kinds:** 7 SUPPORTED · 3 PARTIAL · 0 DEAD_END · 0 MISSING (10 total).

| Capability | Status | Note |
|---|---|---|
| **Overall interpretation** (`overall`) | SUPPORTED | Interprets the overall standardized + benchmarked result — selectInterpretationRule over the overall band + benchmark percentile, rendered from grounded tokens. |
| **Domain interpretation** (`domain`) | SUPPORTED | Per-domain interpretation over the standardized domain scores + domain benchmark (3.9), rendered from grounded tokens. |
| **Competency interpretation** (`competency`) | SUPPORTED | Per-competency interpretation over the standardized competency scores + competency benchmark (3.9). |
| **Behaviour interpretation** (`behaviour`) | SUPPORTED | Per-behaviour interpretation over the standardized behaviour scores + behaviour benchmark (3.9). |
| **Employability interpretation** (`employability`) | SUPPORTED | Employability interpretation composing the MEI substrate + employability benchmark (3.9); the mei-narrative-engine is prior-art rule-driven narration. |
| **Leadership interpretation** (`leadership`) | SUPPORTED | Leadership interpretation over the standardized leadership scores + leadership benchmark (3.9). |
| **Readiness interpretation** (`readiness`) | SUPPORTED | Readiness interpretation over the standardized readiness scores + readiness benchmark (3.9). |
| **Skill interpretation** (`skill`) | PARTIAL | Skill-level interpretation depends on a finer-grained standardized skill input not uniformly present upstream (GAP-AIXP-1). Reachable when the standardized substrate exposes skill scores. PARTIAL, not MISSING. |
| **Learning interpretation** (`learning`) | PARTIAL | Learning-outcome interpretation depends on a standardized learning-outcome input not uniformly present upstream (GAP-AIXP-1). |
| **Growth interpretation** (`growth`) | PARTIAL | Longitudinal growth interpretation depends on accumulated benchmark time-series VOLUME (abmk_results) — an ADOPTION axis (honest 0), reported SEPARATELY, never a gap. |

### AI Interpretation (`ai_interpretation`) — SUPPORTED
_ONE canonical interpretation layer (aixp_runs) turning a standardized (3.8) + benchmarked (3.9) result into an interpreted result. The CORE is DETERMINISTIC — selectInterpretationRule (3.8 structured-AST condition, NO eval) + renderInterpretation (grounded {{token}} render). An OPTIONAL LLM narration (aiClient.checkAIHealth-gated, grounded-token-constrained) enhances phrasing and degrades honestly to deterministic + source-tagged on any failure. 7 interpretation KINDS are SUPPORTED (overall/domain/competency/behaviour/employability/leadership/readiness); the 3 finer KINDS (skill/learning/growth) are PARTIAL — depending on finer standardized input upstream / accumulated volume (GAP-AIXP-1), a breadth boundary NOT an engine gap. A composite interpretation index reuses the 3.8 structured-AST formula engine (no eval)._

- **Services**: services/ai-interpretation-mechanisms.ts, services/ai-interpretation-engine.ts, services/aiClient.ts, services/mei-narrative-engine.ts, services/score-standardization-mechanisms.ts, services/psychometric-standardization.ts
- **Routes**: routes/ai-interpretation.ts
- **Frontend**: components/ai-interpretation/AiInterpretationWorkbench.tsx
- **Tables**: astd_standard_scores, abmk_results, aixp_runs, aixp_rules
- **Verified**: svc 6/6 · rt 1/1 · fe 1/1 · tbl 0/4


_The 7 SUPPORTED kinds are computable now (the standardized + benchmarked substrate exposes the axis); the 3 PARTIAL kinds (skill / learning / growth) depend on a finer-grained standardized input not uniformly present upstream (GAP-AIXP-1) or accumulated benchmark VOLUME (an ADOPTION axis) — reachable via the generic rule set, PARTIAL not MISSING. The composite interpretation index is a STRUCTURED AST — no `eval`, no `new Function`._
