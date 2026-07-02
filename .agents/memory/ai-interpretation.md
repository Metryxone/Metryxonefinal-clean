---
name: Enterprise AI Interpretation & Explainability Platform (CAPADEX 3.0 · Program 3 · Phase 3.10)
description: Flag-gated read-only interpretation/explainability/confidence/hallucination-protection certification layer; mirrors 3.9. Traps + honesty invariants.
---

# Enterprise AI Interpretation & Explainability Platform (Phase 3.10)

Flag `aiInterpretation` / `FF_AI_INTERPRETATION`, default OFF, byte-identical incl. schema. Mirrors Phase 3.9 (Benchmark Intelligence) EXACTLY. The ONE canonical **INTERPRETATION · EXPLAINABILITY · CONFIDENCE · HALLUCINATION-PROTECTION** layer. Detail SSoT: `docs/AI_INTERPRETATION.md`.

## Scope + boundaries
- Turns a STANDARDIZED score (3.8) + a benchmarked result (3.9) → rule selection (3.8 structured-AST condition) → grounded `{{token}}` render → confidence scoring + abstention → 8-facet explanation → OPTIONAL grounded-token-constrained LLM narration validated by unsupported-claim detection + reference verification → deterministic fallback + source tag → governance → audit.
- NEVER re-scores / re-standardizes / re-validates / re-benchmarks (3.5/3.6/3.8/3.9).
- **DO-NOT-IMPLEMENT (later phases):** Recommendation, Learning-Path, Growth-Planning, Report-Generation, Dashboard-Intelligence. These stay OUT OF SCOPE.

## The 11 independent dimensions (never composited)
`ai_interpretation · explainability · confidence · hallucination_protection · rule_repository · super_admin · frontend · ux · apis · testing · documentation` — all 11 SUPPORTED. PARTIAL entries live INSIDE catalogs (interpretation-kinds 7S/3P, persona 12S/1P, lifecycle 4S/4P, testing 7S/1P) and are data-availability / upstream-input boundaries, NOT gaps.

## Honesty invariants (the reasons, not just the rules)
- **Confidence is COMPUTED from evidence completeness** (`present/required` facets) — never guessed. ABSTAINS below the confidence floor OR below k_min=30 real cohort members; raises `human_review` below the review threshold. `computeConfidence` returns `score:null` (unknown ≠ 0) when there are no required facets.
- **Hallucination guard (`detectUnsupportedClaims`):** every number in an LLM narration must appear among the grounded token values (exact or rounded); any that does not is an unsupported claim → the narration is rejected and the deterministic render is used. Cited references that do not resolve are DROPPED by `verifyReferences` (never fabricated).
- **Optional LLM narration is deterministic-FIRST:** the grounded `renderInterpretation` output is produced first; the LLM only rephrases within grounded tokens; its output is validated (claim scan + ref verify) and ANY failure falls back to deterministic + a `source` tag. AI output is NEVER fabricated.
- Rule conditions + composite interpretation index reuse the **3.8 structured AST** (`evaluateInterpretationFormula`) — a whitelisted interpreter, **never `eval` / `new Function`** (there is a source-level no-eval guard test).
- Coverage ⟂ Confidence ⟂ Adoption are NEVER composited. Adoption honest-0 (real interpreted/governed/saved VOLUME across the `aixp_*` overlay) is a SEPARATE axis, NEVER a gap.

## Mechanisms (pure, reuse-before-build)
`services/ai-interpretation-mechanisms.ts` (pure, no DB unless a write path): `matchRule` / `selectInterpretationRule` (priority + version tie-break) · `renderInterpretation` (grounded `{{token}}` whitelist — ungrounded stripped) · `computeConfidence` · `detectUnsupportedClaims` · `verifyReferences` · `composeExplanation` (8-facet; unresolved refs → null; `rule_reference` rendered `key@vN`) · `evaluateInterpretationFormula` ({value,valid,error} — SINGULAR `error`) · scoped `resolvePolicy`/`resolveThreshold` (most-specific-wins) · the `aixp_*` ensure-schema/save (the ONLY DDL sites). Composed substrate = `aiClient` LLM seam + `mei-narrative-engine` prior-art, by EXISTENCE — never invoked at compose time.

## Overlay (8 `aixp_*`, created lazily on flag-gated write paths only)
`aixp_rules · aixp_prompt_links · aixp_policies · aixp_thresholds · aixp_runs · aixp_governance_log · aixp_audit_log · aixp_saved_views`. Read ABSENT until the POSTs run — HONEST OFF, not a defect. Scan repo-align (pristine-OFF DB): svc 17/17 · rt 7/7 · fe 9/9 · tbl 0/16 (all overlay slots absent when flag OFF; a dirty flag-ON dev DB inflates this — re-run scan against a pristine-OFF DB before committing artifacts).

## Wiring traps
- **Probe-path parity:** backend registers `/api/ai-interpretation/enabled` (flag-gated, 503 OFF); the frontend panel probes THIS exact path (NOT `/api/admin/...`). Cert data lives under `/api/admin/ai-interpretation/*` (401 OFF via the GLOBAL gate). OFF smoke ∈ {401,403,503}.
- **public-config dual import-site 500-trap:** `routes/capadex.ts` `/public-config` `ai_interpretation` must `import { isAiInterpretationEnabled }` or the endpoint 500s (no tsc gate at runtime).
- **New route wiring requires a Backend API RESTART.**

## SSoT scan + deliverables + tests
- Scan `scripts/capadex-3.10-ai-interpretation-scan.ts` → `audit/capadex-3.10-ai-interpretation/scan.json` (computes catalog status_counts + embeds registry). Generator `scripts/capadex-3.10-generate-deliverables.ts` reads ONLY scan.json → EXACTLY 16 deliverables (16 = certification; 13 = `13-interpretation-substrate-reuse.md`). Re-run BOTH after any frontend/panel change.
- Testing dimension backed by a REAL runnable suite `tests/capadex-3.10-ai-interpretation.test.ts` (17 node:test cases incl. hallucination `detectUnsupportedClaims` + no-eval source guard). A SUPPORTED testing/doc claim MUST cite a file that physically exists.

## Verdict
`STRUCTURAL_COMPLETE_ADOPTION_PENDING`; all 11 dims SUPPORTED; `gaps` = 3 OPEN (0 Launch-Critical · 2 Medium GAP-AIXP-1/2 · 1 Future GAP-AIXP-3) + 10 RESOLVED via reuse; `ready_for_certification: YES`. Engineering closure ⟂ Adoption (overlay VOLUME honest-low/0). STOP for approval — flag stays OFF, no merge/enable/deploy without sign-off.
