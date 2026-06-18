# CAPADEX WC-5 — Decision Intelligence & Product Routing Audit

**Phase type:** DESIGN + AUDIT only. No implementation, no schema/migration, no code,
no question generation. **STOP for approval.**

This audit evaluates whether CAPADEX can — *today, in code* — consistently and
accurately recommend the next best **action, report, product, pathway, mentor, and
subscription** for every user segment, i.e. whether it functions as a **Decision
Intelligence Platform**, not only an Assessment Platform.

---

## How this audit was grounded (no assumptions)

Every readiness claim below is grounded in the **actual implemented state** of the
codebase as of this phase, verified by reading the real services, routes, schema and
frontend surfaces. Where a surface is a placeholder, it is called a **STUB**; where
logic exists but is flag-gated OFF or not wired into the live loop, it is called
**REAL-but-dormant**; where it is fully live it is **REAL**. Nothing is scored on
aspiration.

**Primary evidence (files):**
- Intelligence chain: `backend/services/wc3/{stage,outcome,journey,question-stage,question-context}-intelligence.ts`, `wc3-schema.ts`; routes `backend/routes/capadex.ts`, `capadex-enterprise.ts`; flags `backend/config/feature-flags.ts`.
- Action layer: `backend/services/pil/intervention-intelligence-engine.ts`, `recommendation-builder.ts`; `backend/services/capadex-intervention-engine.ts`; libraries `intervention_library`, `recommendation_library`.
- Products: `LBIProductPage.tsx`/`LBIAdminPage.tsx` + LBI APIs in `backend/routes.ts`; `CareerBuilderPage.tsx`; `CompetitiveExamPortal.tsx`; `MentorMarketplacePage.tsx`.
- Commercial: `subscription_packages` in `backend/shared/schema.ts`; `/api/admin/subscription-packages`; `AdminPricingPage.tsx`.
- Segments / concerns / context: `frontend/src/components/assessment/phases/IntroPhase.tsx` (3-track × sub-persona picker); `capadex_concerns_master` (2,490 rows); `resolveCapadexConcern` in `backend/routes/capadex.ts`; L5B context taxonomy in `question-context-intelligence.ts`.

---

## Deliverables (this folder) — maps to the 11 requested outputs

| # | Requested output | File |
|---|------------------|------|
| 11 | Executive Summary | this file (below) |
| 1 | Decision Reachability Report + Missing Decision Matrix | `WC5_DECISION_REACHABILITY.md` |
| 2 | Product Routing Report + Product Gap Report | `WC5_PRODUCT_ROUTING.md` |
| 3 | Stage Decision Matrix (Track C) | `WC5_DECISION_MATRICES.md` |
| 4 | Context Decision Matrix (Track D) | `WC5_DECISION_MATRICES.md` |
| 5 | Future Readiness Decision Report (Track E) | `WC5_FUTURE_AND_COMMERCIAL.md` |
| 6 | Commercial Conversion Matrix (Track F) | `WC5_FUTURE_AND_COMMERCIAL.md` |
| 7 | Decision Intelligence Scorecard (Track G) | `WC5_SCORECARD_AND_BENCHMARK.md` |
| 8 | World-Class Decision Gap Report | `WC5_SCORECARD_AND_BENCHMARK.md` |
| 9 | Top 25 High-Impact Improvements | `WC5_ROADMAP.md` |
| 10 | CAPADEX Decision Intelligence Roadmap | `WC5_ROADMAP.md` |

---

## Executive Summary (Output #11)

**Headline verdict:** CAPADEX has **world-class decision *ingredients* but an
incomplete decision *assembly line*.** The first five links of the maturity chain
(Concern → Stage → Context → Outcome → Journey) are **really implemented and
deterministic**, and the Action layer (interventions + recommendations) is **real and
library-backed** (not generic AI). However, the last-mile links —
**Decision → Product → Growth Plan → Subscription** — are **not closed**: there is no
unified Decision layer, several product surfaces are stubs, there is **no persistent
Growth Plan**, and there is **no backend commercial-decision logic** linking an outcome
to a subscription nudge or tier-gated access. Additionally, the entire WC-3 chain is
**flag-gated OFF by default and not yet wired into the live assessment loop**, so its
intelligence is currently dormant from the end user's perspective.

**What is REAL (live or one flag away):**
- **L1 Stage Intelligence** — canonical 5-stage ladder Awareness→Curiosity→Clarity→Growth→Mastery, derived from `stage_code` + `csi_profiles`, with append-only progression history.
- **L2 Outcome Intelligence** — 6 active library-backed outcome models (`career_clarity`, `learning_effectiveness`, `employability_readiness`, `confidence_stability`, `decision_quality`, `family_wellbeing`); `exam_readiness` honestly **gated** (corpus not broad enough).
- **L3 Journey Intelligence** — deterministic product routing; **seeded defaults** (the catalog is table-driven/extensible via `wc3_journey_routes`) are `lbi`, `career_builder`, `employability_index`, `competitive_exam`=corpus_pending, `mentoring`=fallback, `family_support`→remaps to mentoring; "no concern terminates without a route."
- **Action layer** — `intervention-intelligence-engine` (≈660 curated actions across 6 horizons), `capadex-intervention-engine` (signal→`intervention_library`), `recommendation-builder` (Career/Learning/Project/Development).
- **Segments** — 7 of 8 audit segments are **first-class personas** (School, College, Job Seekers, Competitive-Exam Aspirants, Parents, Teachers, Counsellors); **Institutions** is **partial** (B2B2C `placement_career_cell` entry, no institutional-admin persona).
- **Subscriptions** — `subscription_packages` (tiers Basic/Family/Premium, `features` JSONB, `modules`, `max_students`) with full SuperAdmin CRUD, linked to institutes/users.

**What is MISSING / STUB (the decision last-mile):**
1. **No unified Decision layer** — nothing composes Stage+Context+Outcome+Journey into a single ranked "next best decision" envelope with confidence + ambiguity handling.
2. **Product surfaces uneven** — LBI is REAL; Career Builder is PARTIAL (frontend/localStorage, no persistent plan); Competitive-Exam Portal, Mentoring, Employability Index, Family Support are **STUBS** (hardcoded config / generic endpoints).
3. **No CAPADEX-chain Growth Plan persistence** — a growth-plan *does* exist in the M5 enterprise-workforce module (`m5_career_growth_plans` table + `createAICoach().growthPlan()` + `/api/m5/coach/growth-plan[/persist]`), but it is **decoupled from the CAPADEX decision chain**: the Concern→…→Journey flow does not produce or persist a growth plan, so CAPADEX plan state still lives only in session-intervention snapshots or `localStorage`. (Recommendation: extend/wire M5's existing plan persistence into the chain rather than build new.)
4. **No commercial-decision logic** — outcome→subscription nudges and tier-gated access exist only as UI stubs; no backend rule binds them.
5. **Chain dormant** — WC-3 layers default OFF and are not consumed by the runtime assessment/report loop; L5A/L5B sidecars are built but unused at runtime.
6. **Stage-taxonomy split** — backend canon is 5 stages (Awareness…Mastery) while the frontend `CAPADEX_STAGES` uses a 4-code set (`CAP_CUR/INS/GRW/MAS`); these must be reconciled before stage-keyed decisions surface to users.

**Maturity placement:** CAPADEX is roughly at the **"Insight/Recommendation" tier** of
the decision-platform ladder (it can say *what* and *why*, and can rank library-backed
*actions*), but **not yet at the "Routing/Activation/Commercialization" tier** (reliably
deep-linking a user into the right product, persisting a growth plan, and converting to
the right subscription). The good news: the gap is **wiring and last-mile
productization, not foundational intelligence** — the hard derivation work is done.

**Top 5 highest-leverage moves** (full set in `WC5_ROADMAP.md`):
1. Build a thin **Decision Composition layer** that fuses the existing Stage/Context/Outcome/Journey + Action outputs into one ranked decision envelope (compose-only, additive, flag-gated — mirrors WC-3 discipline).
2. **Wire M5's existing Growth Plan persistence** (`m5_career_growth_plans` + AI-coach service) into the CAPADEX decision chain so plans survive beyond a session and `localStorage` (extend, don't rebuild).
3. Close the **Action→Product deep-link** (route an intervention into the actual product surface with a concrete pathway).
4. Add **commercial-decision rules** (outcome/journey → subscription nudge + tier-gated module access) on the backend.
5. **Wire the dormant chain into the live loop** behind staged flag rollout, and **reconcile the stage taxonomy** first.

**Scope reminder:** This is audit/design only. No code, schema, or routes were changed.
Recommendations are proposals for a future approved build phase.
