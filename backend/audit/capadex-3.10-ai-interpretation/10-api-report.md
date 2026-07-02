# CAPADEX 3.0 · Program 3 · Phase 3.10 — API Report (dimension 9 · apis)

> Deliverable 10 · Generated 2026-07-02T01:17:50.467Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:a3adfa09b058, written 2026-07-02T01:17:50.473Z).
> Scope: INTERPRETATION, EXPLAINABILITY, CONFIDENCE & HALLUCINATION-PROTECTION ONLY — interpretation engine/explainability/confidence/hallucination-protection/rule-repository/super admin/frontend/ux/APIs/testing/documentation that turn a STANDARDIZED score (3.8) + BENCHMARK result (3.9) into an interpreted, explainable, confidence-scored, hallucination-protected result; it NEVER re-scores, re-standardizes, re-benchmarks or builds a norm. Recommendation / learning-path / growth-planning / report-generation / dashboard-intelligence are OUT OF SCOPE (later phases; boundaries).
> Honesty: the ELEVEN certification dimensions (ai_interpretation · explainability · confidence · hallucination_protection · rule_repository · super_admin · frontend · ux · apis · testing · documentation) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Interpretation ABSTAINS below k_min=30 real evidence / the confidence floor. The composite interpretation index is a STRUCTURED AST (no eval / new Function). The interpretation CORE is deterministic; the LLM narration is an OPTIONAL, honest-degrading, grounded-token-constrained, output-validated seam. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

The unified interpretation API surface at `/api/admin/ai-interpretation/*` (super-admin cert GETs) + `/api/ai-interpretation/enabled` (flag probe) + the mechanism POST paths (interpret / explain / confidence / hallucination-check / composite-index) and the overlay write paths (rules / prompts / thresholds / policies / runs / governance / audit / saved views save + list GETs).

**API groups:** 5 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (5 total).

| Capability | Status | Anchors |
|---|---|---|
| **Interpretation APIs** (`interpretation_apis`) | SUPPORTED | routes/ai-interpretation.ts, services/ai-interpretation-mechanisms.ts |
| **Explainability APIs** (`explainability_apis`) | SUPPORTED | routes/ai-interpretation.ts, services/ai-interpretation-mechanisms.ts |
| **Confidence APIs** (`confidence_apis`) | SUPPORTED | routes/ai-interpretation.ts, services/ai-interpretation-mechanisms.ts |
| **Rule APIs** (`rule_apis`) | SUPPORTED | routes/ai-interpretation.ts, aixp_rules, aixp_prompt_links |
| **Configuration APIs** (`configuration_apis`) | SUPPORTED | routes/ai-interpretation.ts, aixp_policies, aixp_thresholds |

## Traceability model (9 standardized-score→interpretation-provenance links)
Each link → the provenance artefact it carries + the EXISTING source it REUSES (reuse-before-build).

**Traceability status:** 9 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING.

| Link | Source (reused) | Status | Note |
|---|---|---|---|
| **Standardized score** (`standardized_score`) | `astd_standard_scores` | SUPPORTED | The standardized score (3.8) interpreted — the interpretation input, carried on every run. |
| **Benchmark result** (`benchmark_result`) | `abmk_results (3.9)` | SUPPORTED | The benchmark result (3.9) the interpretation contextualizes — carried on every run; null when no benchmark exists yet (honest null). |
| **Assessment version** (`assessment_version`) | `aixp_runs.assessment_version` | SUPPORTED | The assessment version the interpreted score was produced against — carried on every run. |
| **Norm version** (`norm_version`) | `aint_norm_tables (3.7) + aixp_runs.norm_version` | SUPPORTED | The norm reference (3.7) the score was standardized against — carried on every run. |
| **Standardization version** (`standardization_version`) | `astd_configs + aixp_runs.standardization_version` | SUPPORTED | The versioned standardization config (3.8) applied — carried on every run. |
| **Benchmark version** (`benchmark_version`) | `abmk_configs (3.9) + aixp_runs.benchmark_version` | SUPPORTED | The versioned benchmark config (3.9) applied — carried on every run. |
| **Rule version** (`rule_version`) | `aixp_rules.version + aixp_runs.rule_version` | SUPPORTED | The interpretation rule (key + version) that fired — carried on every run. |
| **Prompt version** (`prompt_version`) | `aixp_prompt_links.version + aixp_runs.prompt_version` | SUPPORTED | The prompt template (key + version) used for narration — carried on every run; null when narration is deterministic (honest null). |
| **Interpretation version** (`interpretation_version`) | `aixp_policies.version + aixp_runs.interpretation_version` | SUPPORTED | The versioned interpretation policy applied — carried on every run. |

### APIs (`apis`) — SUPPORTED
_interpretation / explainability / confidence / rule / configuration endpoints under /api/admin/ai-interpretation, composing the reused interpretation substrate + the aixp_* overlay. Read certifications are GET (to_regclass/fs probes); pure interpretation / explanation / confidence / hallucination-scan / composite computes are pure POSTs; overlay writes + governance transitions are flag-gated POSTs. The interpret endpoint returns an honest abstained / deterministic-fallback result when evidence is thin or the model is unavailable._

- **Services**: services/ai-interpretation-engine.ts, services/ai-interpretation-mechanisms.ts
- **Routes**: routes/ai-interpretation.ts
- **Frontend**: —
- **Tables**: —
- **Verified**: svc 2/2 · rt 1/1 · fe 0/0 · tbl 0/0

## Contract
- Cert GETs are **read-only** (to_regclass / fs probes) — no DDL at read time.
- Mechanism POSTs (interpret / explain / confidence / hallucination-check / composite-index) are **PURE** (no DB, no eval) unless `persist=true`; the overlay save routes + governance transition are the **ONLY** DDL sites, gated by `aiInterpretation` + super-admin.
- The composite interpretation index is a STRUCTURED AST evaluated by a whitelisted interpreter — no `eval` / `new Function`.
- Interpretation ABSTAINS below k_min=30 real evidence / the confidence floor — never fabricated.
- Flag OFF → `/enabled` 503, `/api/admin/ai-interpretation/*` 401, public-config `ai_interpretation:false`; interpretation flow + schema byte-identical.
