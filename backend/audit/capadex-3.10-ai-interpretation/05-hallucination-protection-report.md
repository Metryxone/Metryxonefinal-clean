# CAPADEX 3.0 · Program 3 · Phase 3.10 — Hallucination Protection Report (dimension 4 · hallucination_protection)

> Deliverable 05 · Generated 2026-07-02T01:17:50.467Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:a3adfa09b058, written 2026-07-02T01:17:50.473Z).
> Scope: INTERPRETATION, EXPLAINABILITY, CONFIDENCE & HALLUCINATION-PROTECTION ONLY — interpretation engine/explainability/confidence/hallucination-protection/rule-repository/super admin/frontend/ux/APIs/testing/documentation that turn a STANDARDIZED score (3.8) + BENCHMARK result (3.9) into an interpreted, explainable, confidence-scored, hallucination-protected result; it NEVER re-scores, re-standardizes, re-benchmarks or builds a norm. Recommendation / learning-path / growth-planning / report-generation / dashboard-intelligence are OUT OF SCOPE (later phases; boundaries).
> Honesty: the ELEVEN certification dimensions (ai_interpretation · explainability · confidence · hallucination_protection · rule_repository · super_admin · frontend · ux · apis · testing · documentation) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Interpretation ABSTAINS below k_min=30 real evidence / the confidence floor. The composite interpretation index is a STRUCTURED AST (no eval / new Function). The interpretation CORE is deterministic; the LLM narration is an OPTIONAL, honest-degrading, grounded-token-constrained, output-validated seam. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

The OPTIONAL LLM narration is constrained to grounded tokens and its output is VALIDATED — `detectUnsupportedClaims` flags any numeric/entity claim not present in the grounded token set, `verifyReferences` drops references that do not resolve, and ANY failure (health / claim / reference) falls back to the deterministic render + a `source` tag. No output is fabricated: an unverifiable token is stripped, not emitted.

**Hallucination controls:** 5 SUPPORTED · 0 PARTIAL · 0 DEAD_END · 0 MISSING (5 total).

| Capability | Status | Note |
|---|---|---|
| **Grounded tokens only** (`grounded_tokens_only`) | SUPPORTED | The LLM narration prompt is constrained to a whitelist of grounded tokens (the actual scores / bands / percentiles / dimensions) — it may only phrase, never introduce new facts. |
| **Unsupported-claim detection** (`unsupported_claim_detection`) | SUPPORTED | detectUnsupportedClaims scans narration output for numeric / factual claims not present in the grounded token set; any hit forces the deterministic fallback + human_review. |
| **Reference verification** (`reference_verification`) | SUPPORTED | verifyReferences confirms every score / benchmark / rule reference cited in the explanation resolves to a real provenance value — unresolved refs are dropped, never fabricated. |
| **Deterministic fallback** (`deterministic_fallback`) | SUPPORTED | If the model is unavailable (checkAIHealth not ok) OR the output fails validation, the interpretation falls back to the deterministic rule-rendered text with source:'deterministic' + a reason. |
| **Source tagging** (`source_tagging`) | SUPPORTED | Every interpretation is tagged source:'ai' | 'deterministic' (+ ai_available + reason) so a consumer always knows whether a human-grade model or the deterministic core produced it. |

### Hallucination Protection (`hallucination_protection`) — SUPPORTED
_The OPTIONAL LLM narration is constrained to a grounded-token whitelist; detectUnsupportedClaims scans output for facts not in the grounded set (any hit → deterministic fallback + human_review); verifyReferences confirms cited refs resolve; a deterministic fallback covers model-unavailable / validation-failure; and every output is source-tagged (ai | deterministic + ai_available + reason). No output is ever fabricated._

- **Services**: services/ai-interpretation-mechanisms.ts, services/ai-interpretation-engine.ts, services/aiClient.ts
- **Routes**: routes/ai-interpretation.ts
- **Frontend**: components/ai-interpretation/AiInterpretationWorkbench.tsx
- **Tables**: aixp_runs, aixp_prompt_links
- **Verified**: svc 3/3 · rt 1/1 · fe 1/1 · tbl 0/2


_The LLM is a seam, not the source of truth: `checkAIHealth` gates it, grounded tokens constrain it, `detectUnsupportedClaims` + `verifyReferences` validate it, and it degrades to deterministic + `source:'deterministic'` on ANY failure. AI output is NEVER fabricated._
