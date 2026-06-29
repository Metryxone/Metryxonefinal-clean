---
name: Continuous Learning Intelligence Engine (MX-800 Phase 2.9)
description: Read-only flag-gated tier that catalogs EXISTING learning/feedback/experience/adaptive/improvement/organizational capabilities + composes 7 prior tiers; learn-only, never executes/adapts/decides; improvement_rate+effectiveness honest-null.
---

# Continuous Learning Intelligence Engine (MX-800 Phase 2.9)

Flag `continuousLearningIntelligenceEngine` / `FF_CONTINUOUS_LEARNING_INTELLIGENCE_ENGINE` (default OFF, byte-identical incl. schema). ENHANCEMENT-ONLY read-only tier ABOUT the platform's learning capabilities — mirrors the 2.8 recommendation-intelligence-engine scaffold exactly (service/route/migration/validator/deliverable all parallel). BASE `/api/admin/continuous-learning-intelligence`.

**Rule:** catalogs + composes EXISTING learning/feedback/experience/adaptive/improvement/organizational engines; NEVER generates learning, NEVER invokes/activates a dormant engine (reads file existence via `fs.existsSync` + persisted-table COUNT only), NEVER adapts/decides/executes/modifies business logic.
**Why:** the platform already has ~23 learning-producing capabilities scattered across services/ and routes/; a parallel engine would duplicate + risk activating dormant adaptive/learning pipelines. This tier is an explainable read-only lens, not a new producer.
**How to apply:** when adding/auditing a learning surface, register it in the curated `LEARNING_SOURCES` catalog (DB table + engine-file verified) — don't fork an engine.

## Honesty specifics (differ from 2.8)
- 9 parts (2.8 had 8 + summary): the extra is Part 9 **Organizational Learning** = MEASURED preservation (`.agents/memory` lesson count + `docs` doc count via filesystem cwd-relative, + `platform_evolution_knowledge`/`m3_ontology_evolution_events`/`iil_self_evolution_log` COUNT(*)). Experience ≠ Knowledge.
- Metrics = **6 SEPARATE** scores, NO composite: learning_quality / learning_confidence (STRUCTURAL) / learning_coverage / explainability_score / **improvement_rate (honest-NULL)** / **effectiveness (honest-NULL)**.
- improvement_rate null because there are NO longitudinal labelled improvement deltas; effectiveness null because there are NO labelled learning outcomes. Learning≠Automation; Experience≠Knowledge; Feedback≠Truth; Improvement≠Optimization; Adaptation≠Autonomous Change.
- Part 6 explain carries `previous_state` + `current_state` + `reason_for_change` (honest "NO CHANGE" — this tier never mutated anything) + `governance.autonomous_learning=false`.
- Compose **7** prior tiers (added 2.8 `getRecommendationSummary` to the 2.7 set). `tier_reachability.of === 7` in parts; `composition.of === 7` in summary.

## Catalog provenance gotcha
6 kinds across 12 domains: learning(7)/feedback(2)/experience(7)/adaptive(3)/improvement(2)/organizational(2). NULL persisted table (prediction-experience, longitudinal-memory) = compute-on-read → table_count honest-null not 0. NULL engine (meta_learning_profiles, learning_recommendations, cp_experience, episodic_memory, wcl5_memory, platform_evolution_knowledge, m3_ontology_evolution_events) = persisted-trail-only. `iil_self_evolution_log` engine lives in `routes/iil-evolution.ts` NOT services/ — record the real path.

## Structural guarantees (same discipline as the whole MX-700/800 family)
- Flag gate 503 before auth/DDL on the route; service write fns (`discoverLearning`/`registerLearningCapability`/`captureLearningSnapshot`) `assertEnabled()` BEFORE `ensureLearningSchema()` → OFF = 0 tables even via direct/tooling callers. Reads degrade to `ready:false` (to_regclass probe), never ensure-schema.
- OWN 2 tables only: `learning_registry` + `continuous_learning_intelligence_audit_snapshots`. `discover` upsert EXCLUDES owner/lifecycle_uid from UPDATE (managed fields survive re-discovery).
- `/register` rejects unsafe table identifiers (unquoted-identifier regex before interpolation) — injection-tested.
- OFF smoke ∈ {401,403,503} (global `/api/admin` auth fires before route flag gate → GET 401 / POST 403, not 503; same as all prior tiers).
- Validator `scripts/mx800-2.9-learning-validate.ts` (71/71) proves reads never mutate 21 sentinel learning tables + engines never invoked + cleanup restores 0 own tables. tsx scripts MUST live inside `backend/`.
