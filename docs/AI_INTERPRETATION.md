# Enterprise AI Interpretation & Explainability Platform (CAPADEX 3.0 · Program 3 · Phase 3.10)

> Single source of truth for the AI Interpretation layer. Detail lives here + `.agents/memory/ai-interpretation.md`; the Feature Map pointer in `replit.md` is a navigation stub only.

## What it is
The **ONE canonical Enterprise AI Interpretation & Explainability Platform** — a single certified **INTERPRETATION · EXPLAINABILITY · CONFIDENCE · HALLUCINATION-PROTECTION** layer that COMPOSES the existing interpretation substrate (the `aiClient` health-gated LLM seam + the `mei-narrative-engine` rule-driven narration prior-art, composed by **EXISTENCE — never invoked at compose time**) plus the pure 3.8 structured-AST formula engine + the pure psychometric transforms (`zFromValue` / `zToPercentile`) under one registry (`config/ai-interpretation.ts`), over an additive `aixp_*` overlay. **No duplicate AI / interpretation engine, no V2, no breaking change.** Mirrors Phases 3.3–3.9.

## Scope (freeze)
INTERPRETATION · EXPLAINABILITY · CONFIDENCE · HALLUCINATION-PROTECTION ONLY — it turns a **STANDARDIZED score (3.8) + a benchmarked result (3.9)** into a grounded, confidence-scored, explainable interpretation:
- **standardized + benchmarked result → rule selection (3.8 structured-AST condition) → grounded `{{token}}` render → confidence scoring + abstention → 8-facet explanation → OPTIONAL grounded-token-constrained LLM narration validated by unsupported-claim detection + reference verification → deterministic fallback + source tag → governance → audit.**
- **NEVER** re-scores, re-standardizes, re-validates, or re-benchmarks (3.5 Scoring / 3.6 Science / 3.8 Standardization / 3.9 Benchmark).
- **DO-NOT-IMPLEMENT boundaries (later phases):** Recommendation, Learning-Path, Growth-Planning, Report-Generation, Dashboard-Intelligence are **OUT OF SCOPE**.

## The eleven INDEPENDENT dimensions (reported SEPARATELY — never composited)
`ai_interpretation · explainability · confidence · hallucination_protection · rule_repository · super_admin · frontend · ux · apis · testing · documentation`

All eleven `axis_dimensions` are SUPPORTED. PARTIAL entries live inside the catalogs and are **data-availability / upstream-input boundaries**, NOT gaps:

| Catalog | Result (scan) |
|---|---|
| Interpretation kinds | 10 (7 SUPPORTED · 3 PARTIAL) |
| Explainability criteria | 8 SUPPORTED |
| Confidence criteria | 5 SUPPORTED |
| Hallucination controls | 5 SUPPORTED |
| Rule capabilities | 5 SUPPORTED |
| Persona coverage | 13 (12 SUPPORTED · 1 PARTIAL) |
| Lifecycle coverage | 8 (4 SUPPORTED · 4 PARTIAL) |
| Super-admin surfaces | 7 SUPPORTED |
| Frontend surfaces | 7 SUPPORTED |
| UX criteria | 8 SUPPORTED |
| API groups | 5 SUPPORTED |
| Testing coverage | 8 (7 SUPPORTED · 1 PARTIAL) |
| Doc set | 7 SUPPORTED |
| Traceability links | 9 |

## Interpretation formula / rule conditions — STRUCTURED AST, no eval
Rule conditions and the composite interpretation index reuse the 3.8 **structured AST** formula engine, evaluated by a whitelisted interpreter — **never `eval` / `new Function`**. This is a hard requirement of the phase.

## Interpretation honesty
- **Confidence is COMPUTED from evidence completeness — never guessed** (`present / required` facets); it ABSTAINS below the confidence floor OR below k_min=30 real cohort members, and raises `human_review` below the review threshold. null (unknown) ≠ 0.
- **Hallucination guard:** every number in a narration must appear among the grounded token values (exact or rounded); any that does not is an unsupported claim. Cited references that do not resolve are DROPPED (never fabricated).
- **Optional LLM narration** only rephrases WITHIN grounded tokens; the deterministic render is produced FIRST, the LLM output is validated (unsupported-claim scan + reference verification), and ANY failure falls back to deterministic + a `source` tag. AI output is NEVER fabricated.
- Coverage⟂Confidence⟂Adoption are never composited; null≠0.

## Mechanisms (reuse-before-build — pure, no DB unless a write path)
`services/ai-interpretation-mechanisms.ts` — pure `matchRule` / `selectInterpretationRule` (deterministic condition predicate + priority/version tie-break) / `renderInterpretation` (grounded `{{token}}` whitelist) / `computeConfidence` (evidence completeness + band + ABSTAIN) / `detectUnsupportedClaims` (numeric hallucination guard) / `verifyReferences` (drop unresolved) / `composeExplanation` (8-facet) / `evaluateInterpretationFormula` (reuses 3.8 AST) + scoped `resolvePolicy` / `resolveThreshold` (most-specific-wins) + the additive `aixp_*` overlay ensure-schema/save. The overlay ensure-schema/save on the **flag-gated write paths are the ONLY DDL sites**. The optional AI narration seam degrades honestly (deterministic-first, source-tagged).

## Overlay tables (8 `aixp_*`)
`aixp_rules` · `aixp_prompt_links` · `aixp_policies` · `aixp_thresholds` · `aixp_runs` · `aixp_governance_log` · `aixp_audit_log` · `aixp_saved_views`. Created lazily ONLY on the flag-gated mechanism/overlay write paths — read ABSENT until then, HONEST OFF, not a defect.

## Routes
`routes/ai-interpretation.ts` — `/api/ai-interpretation/enabled` flag probe (503-before-auth OFF; the frontend panel probes THIS path) + super-admin cert GETs under `/api/admin/ai-interpretation/*` (`/summary`, `/dimensions`, `/gaps`, `/adoption`, `/rules`, catalog readers) + pure mechanism POSTs (`/compute/interpret`, `/compute/confidence`, `/compute/explain`, `/compute/hallucination-scan`, `/compute/formula`, `/policies/resolve`, `/thresholds/resolve`) + overlay `*/save` + `/governance/transition` writes (the ONLY DDL sites). `/api/admin/*` returns 401 OFF via the GLOBAL gate — OFF smoke ∈ {401, 403, 503}.

## Frontend
`components/superadmin/AiInterpretationPanel.tsx` + interactive `components/ai-interpretation/AiInterpretationWorkbench.tsx` (6 cards: interpret / confidence / explain / hallucination-scan / formula / policy-resolve). Conditional-spread nav in `SuperAdminDashboard.tsx` (`Sparkles` icon), probes `/api/ai-interpretation/enabled`, hidden OFF; ABSTAIN/empty/loading/error states.

## public-config
`routes/capadex.ts` `/public-config` exposes `ai_interpretation` — this is a **SEPARATE import site** that must `import { isAiInterpretationEnabled }` or the endpoint 500s.

## SSoT scan + deliverables
- Scan `scripts/capadex-3.10-ai-interpretation-scan.ts` → `audit/capadex-3.10-ai-interpretation/scan.json` (computes catalog status_counts itself + embeds full registry).
- Generator `scripts/capadex-3.10-generate-deliverables.ts` reads **ONLY** scan.json → **exactly 16 deliverables** (01→16; 16 = Phase-3.10 Certification; 13 = `13-interpretation-substrate-reuse.md`).
- Testing dimension is backed by a REAL runnable suite `tests/capadex-3.10-ai-interpretation.test.ts` (17 node:test cases: pure mechanisms — rule selection, grounded render, confidence + ABSTAIN, hallucination detection, reference verification, 8-facet explanation, structured-AST eval + a no-eval source guard — + read-only engine composition against the live DB). A SUPPORTED testing/documentation claim MUST cite a file that physically exists.

## Verdict
`STRUCTURAL_COMPLETE_ADOPTION_PENDING` — all eleven dimensions SUPPORTED; repo-align svc 17/17 · rt 7/7 · fe 9/9 · tbl 14/16 (the `aixp_*` overlay tables read ABSENT until the flag-gated POSTs run, HONEST not a defect); `gaps` = 3 OPEN (0 Launch-Critical · 2 Medium GAP-AIXP-1/2 · 1 Future GAP-AIXP-3) + 10 RESOLVED via reuse; `ready_for_certification: YES`.

**Engineering closure ⟂ Adoption:** the mechanism EXISTS for every closed gap but real interpreted / governed / saved VOLUME across the `aixp_*` overlay is honest-low/0 — a usage axis reported SEPARATELY, NEVER a gap. STOP for approval (flag stays OFF, no merge/enable/deploy).
