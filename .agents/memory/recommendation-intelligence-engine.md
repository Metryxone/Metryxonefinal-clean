---
name: Recommendation Intelligence Engine (MX-800 Phase 2.8)
description: Read-only flag-gated tier that catalogs EXISTING recommendation/opportunity/intervention/optimization capabilities + composes prior tiers; recommend-only, never executes/decides; acceptance+effectiveness honest-null.
---

# Recommendation Intelligence Engine (MX-800 Phase 2.8)

Flag `recommendationIntelligenceEngine` / `FF_RECOMMENDATION_INTELLIGENCE_ENGINE` (default OFF, byte-identical incl. schema). ENHANCEMENT-ONLY read-only tier ABOUT the platform's recommendation capabilities — mirrors the 2.7 predictive-intelligence-engine scaffold exactly (service/route/migration/validator/deliverable all parallel). BASE `/api/admin/recommendation-intelligence`.

**Rule:** catalogs + composes EXISTING recommendation/opportunity/intervention/optimization engines; NEVER generates a recommendation, NEVER invokes/activates a dormant engine (reads file existence via `fs.existsSync` + persisted-table COUNT only), NEVER decides/executes/automates.
**Why:** the platform already has ~20 recommendation-producing capabilities scattered across services/ and routes/; a parallel engine would duplicate + risk activating dormant pipelines. This tier is an explainable read-only lens, not a new producer.
**How to apply:** when adding/auditing a recommendation surface, register it in the curated `RECOMMENDATION_SOURCES` catalog (DB table + engine-file verified) — don't fork an engine.

## Honesty specifics (differ from 2.7)
- Metrics = **6 SEPARATE** scores, NO composite: recommendation_quality / recommendation_confidence (STRUCTURAL) / recommendation_coverage / explainability_score / **acceptance_rate (honest-NULL)** / **effectiveness (honest-NULL)**.
- acceptance_rate null because there is NO accept/dismiss telemetry; effectiveness null because there are NO labelled recommendation outcomes. Recommendation≠Decision≠Automation≠Execution; Priority≠Approval; Opportunity≠Requirement.
- Part 4 Prioritization basis = `structural_substrate_volume` ONLY (Priority≠Approval, decision_safety all false). Part 2/5 carry `execution_safety` (executes/automates/decides/modifies_production all false, 0 business writes).

## Catalog provenance gotcha
`paie`/`roie` opportunity logic lives in `routes/` (paie-opportunity.ts, roie-opportunity.ts), NOT `services/` — record the real path, don't assume services/. causal/EI/runtime-optimization/cg recommendations have NULL persisted table (compute-on-read or flag-gated) — table_count honest-null, not 0.

## Structural guarantees (same discipline as the whole MX-700/800 family)
- Flag gate 503 before auth/DDL on the route; service write fns (`discover`/`register`/`captureRecommendationSnapshot`) `assertEnabled()` BEFORE `ensureRecommendationSchema()` → OFF = 0 tables even via direct/tooling callers. Reads degrade to `ready:false` (to_regclass probe), never ensure-schema.
- OWN 2 tables only: `recommendation_registry` + `recommendation_intelligence_audit_snapshots`. `discover` upsert EXCLUDES owner/lifecycle_uid from UPDATE (managed fields survive re-discovery).
- `/register` rejects unsafe table identifiers (unquoted-identifier regex before interpolation) — injection-tested.
- OFF smoke ∈ {401,403,503} (global `/api/admin` auth fires before route flag gate → 401, not 503; same as all prior tiers).
- Validator `scripts/mx800-2.8-recommendation-validate.ts` (62/62) proves reads never mutate 17 sentinel recommendation tables + engines never invoked + cleanup restores 0 own tables. tsx scripts MUST live inside `backend/`.
