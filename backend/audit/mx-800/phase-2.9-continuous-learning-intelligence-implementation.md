# MX-800 Phase 2.9 — Continuous Learning Intelligence Engine (implementation)

**Status:** Implemented, flag OFF by default (`continuousLearningIntelligenceEngine` / `FF_CONTINUOUS_LEARNING_INTELLIGENCE_ENGINE`). Byte-identical legacy behaviour incl. schema when OFF. **STOP for approval — NO deploy.**

**Validator:** `backend/scripts/mx800-2.9-learning-validate.ts` → **71/71 passed, 0 failed** (run with `FF_CONTINUOUS_LEARNING_INTELLIGENCE_ENGINE=1`).

**Architect code review:** PASS — no blocker-level defects; honesty + flag + learn-only contracts materially enforced; read-only / engines-never-invoked confirmed.

---

## What this is

An ENHANCEMENT-ONLY, READ-ONLY intelligence tier ABOUT the platform's learning capabilities. It **catalogs** the EXISTING learning / feedback / experience / adaptive / improvement / organizational-learning capabilities the platform already produces, and **composes** the prior intelligence tiers (2.1 platform / 2.3 engineering / 2.4 runtime / 2.5 knowledge / 2.6 decision / 2.7 predictive / 2.8 recommendation) into explainable learning intelligence (registry / feedback / experience / adaptive / continuous-improvement / explainability / validation / metrics / organizational).

It introduces **NO** parallel learning / adaptive / improvement engine, **DUPLICATES** no model, and changes **NO** business logic. It **INVOKES / ACTIVATES** no dormant learning or adaptive engine — it reads each engine's **EXISTENCE** (source file on disk) and its **PERSISTED OUTPUT** (learning/feedback/experience/adaptive tables, COUNT-only) only. It **never generates** learning, **never adapts autonomously**, and **never decides / executes / modifies business logic**. The repository + the existing learning tables remain the single source of truth.

---

## Surface

**Service** `backend/services/continuous-learning-intelligence-engine.ts` (9 parts + registry/discovery + summary + audit):
- Part 1 `getLearningCatalog` — curated, DB+file-verified catalog of **23 EXISTING learning capabilities** across **12 domains** and **6 kinds** (learning 7 / feedback 2 / experience 7 / adaptive 3 / improvement 2 / organizational 2). Each: persisted `table` (read-only COUNT-only) and/or `engine` source file (existence-read), governing `flag` state (Built ≠ Activated), soft `intelligence_uid`.
- Part 2 `getFeedbackIntelligence` — surfaces EXISTING feedback capabilities + composes prior tiers. **Feedback ≠ Truth.** `feedback_safety.treats_feedback_as_truth=false`, `generates_feedback=false`, `decides=false`, `write_paths_to_business_tables=0`.
- Part 3 `getExperienceIntelligence` — surfaces EXISTING experience/memory capabilities + composes prior tiers. **Experience ≠ Knowledge.** `experience_safety.equates_experience_with_knowledge=false`, `decides=false`.
- Part 4 `getAdaptiveIntelligence` — surfaces EXISTING adaptive capabilities + composes prior tiers. **Adaptation ≠ Autonomous Change.** `adaptation_safety.modifies_business_logic=false`, `autonomous_change=false`, `executes=false`, `decides=false`, `write_paths_to_business_tables=0`. Each capability carries `flag_state` (Built ≠ Activated).
- Part 5 `getContinuousImprovement` — evidence-only over EXISTING improvement substrate; **Improvement ≠ Optimization.** `evidence_basis: verified_existing_substrate`; `improvement_safety.optimizes=false`, `modifies_business_logic=false`, `autonomous=false`, `executes=false`, `decides=false`.
- Part 6 `explainLearning(uid)` — why / evidence / structural confidence / **previous_state + current_state + reason_for_change (honest "NO CHANGE")** / assumptions / alternatives / repo+knowledge+runtime refs / governance (human-approval mandatory; `automated_action=false`, `executes=false`, `decides=false`, `autonomous_learning=false`). Unknown uid → `found:false` (no fabrication).
- Part 7 `getLearningValidation` — STRUCTURAL only (7 checks: repository/engine/evidence/learning/trail/learning-consistency/registry). `learning_consistency` is STRUCTURAL self-consistency, explicitly **NOT** improvement or effectiveness. Verdict ∈ {STRUCTURAL_VALIDATED, PARTIAL, ABSENT}.
- Part 8 `getLearningMetrics` — **6 SEPARATE** measured scores, **NO composite** (`composite:null`):
  `learning_quality` (structural), `learning_confidence` (confidence, STRUCTURAL verifiability), `learning_coverage` (coverage), `explainability_score` (evidence), `improvement_rate` (**honest-NULL**, unmeasurable: no longitudinal labelled improvement deltas), `effectiveness` (**honest-NULL**, unmeasurable: no labelled learning outcomes).
- Part 9 `getOrganizationalLearning` — MEASURED preservation: `.agents/memory` lesson count + `docs` documentation count (filesystem, cwd-relative) + `platform_evolution_knowledge` / `m3_ontology_evolution_events` / `iil_self_evolution_log` COUNT(*) (null ≠ 0). **Experience ≠ Knowledge.** `preservation_safety.generates_lessons=false`, `decides=false`, `modifies_business_logic=false`. Composes prior tiers.
- `getLearningSummary` composes registry/catalog/metrics/validation/tiers (composition `of:7`); `learn_safety` executes/decides/adapts/modifies_business_logic/learns_autonomously all false, `learn_only=true`.
- Audit: `captureLearningSnapshot` (ONLY write path beyond discover/register — owns lazy ensure-schema), `getLearningSnapshots`, `getLearningDrift` (needs ≥2 snapshots; null delta = a side unmeasured).
- Registry: `discoverLearning` (upsert; `owner`/`lifecycle_uid` deliberately excluded from UPDATE set → re-discovery never clobbers MANAGED fields), `registerLearningCapability` (manual; rejects unsafe table identifiers), `getLearningRegistry`, `getLearningCapability`.

**Route** `backend/routes/continuous-learning-intelligence-engine.ts` — BASE `/api/admin/continuous-learning-intelligence`. `/enabled` (persona-agnostic probe), `gate` (503 before auth/DB when OFF), `/feature-flag`, GET reads (summary/catalog/feedback/experience/adaptive/continuous-improvement/organizational/validation/metrics/registry/audit-drift/audit-snapshots/explain/:uid/registry/:uid), POST writes (discover/register/audit/capture). Literal sub-paths before `:uid` params.

**Migration** `backend/migrations/20261228_continuous_learning_intelligence.sql` — 2 OWNED tables: `learning_registry` + `continuous_learning_intelligence_audit_snapshots` (mirrors the lazy `ensureLearningSchema`). Never creates/alters any EXISTING learning table.

**Flag** `backend/config/feature-flags.ts` — `continuousLearningIntelligenceEngine: false` + `isContinuousLearningIntelligenceEngineEnabled()`.

---

## Catalog provenance (DB + file verified)

Every catalog capability maps to a real persisted table and/or a real engine source file:
- **Learning (7):** `learn_outcomes` ↔ `services/intervention-learning-engine.ts`; `cg_user_learning_recs` ↔ `services/career-learning-rec-engine.ts`; `lip_learning_paths` ↔ `services/learning-path-engine.ts`; `wos_learning_roi` ↔ `services/learning-roi-engine.ts`; `lip_learning_needs` ↔ `services/lip-learning-need-engine.ts`; `meta_learning_profiles` ↔ engine null; `learning_recommendations` ↔ engine null.
- **Feedback (2):** `interview_feedback` ↔ `services/interview-feedback-engine.ts`; `learn_intervention_events` ↔ engine null.
- **Experience (7):** prediction-experience → compute-on-read (table null) ↔ `services/pil/prediction-experience.ts`; `cp_experience` ↔ engine null; `episodic_memory` ↔ engine null; `behavioural_memory` ↔ `services/behavioural-memory.ts`; longitudinal-memory → table null ↔ `services/longitudinal-memory.ts`; `competency_memory_history` ↔ `services/competency-memory-engine.ts`; `wcl5_memory` ↔ engine null.
- **Adaptive (3):** `adaptive_intelligence_events` ↔ `services/adaptive-event-bus.ts`; `adaptive_runtime_state` ↔ `services/unified-adaptive-runtime-orchestrator.ts`; `irt_adaptive_config` ↔ `services/adaptive-difficulty-activation.ts`.
- **Improvement (2):** `platform_evolution_audit_snapshots` ↔ `services/platform-evolution-intelligence.ts`; `iil_self_evolution_log` ↔ `routes/iil-evolution.ts`.
- **Organizational (2):** `platform_evolution_knowledge` ↔ engine null; `m3_ontology_evolution_events` ↔ engine null.

(NULL persisted table = compute-on-read or trail-only → `table_count` honest-null, not 0. NULL engine = persisted-trail-only capability, recorded honestly.)

---

## Honesty contract (enforced + verified)

- **null ≠ 0.** Population is exact `COUNT(*)` (NEVER `pg_stat` `n_live_tup`); absent table → `present:false`, count NULL; query error → NULL (≠ empty). `pct()` returns null on null numerator or 0/null denominator.
- **Metrics are 6 SEPARATE scores; NO composite/overall.** Blending would hide honest gaps.
- **learning_confidence is STRUCTURAL only** (substrate verifiability), not runtime/outcome/accuracy.
- **improvement_rate + effectiveness are honest-NULL (DEFERRED)** — improvement_rate requires longitudinal labelled improvement deltas (absent); effectiveness requires labelled learning outcomes (absent). This tier surfaces learning SUPPORT; it never measures whether learning improved or worked.
- **Coverage ⟂ Confidence ⟂ Evidence** — separate axes, never blended. Learning ≠ Automation; Experience ≠ Knowledge; Feedback ≠ Truth; Improvement ≠ Optimization; Adaptation ≠ Autonomous Change; Confidence ≠ Accuracy. Human approval mandatory.
- **Byte-identical OFF incl. schema** — route gate 503 before auth/DDL; every service write path asserts the flag before ensure-schema (defense-in-depth); reads never ensure-schema. OFF creates 0 tables.
- **LEARN ONLY** — never executes / adapts autonomously / decides / modifies business logic; no write to any business table.
- **MANAGED fields** (`owner`, `lifecycle_uid`) are honest-NULL when unassigned and survive re-discovery.

## What the validator proves (71 checks)
- All 9 parts return the contracted shapes; metrics 6-separate/no-composite; improvement_rate + effectiveness null; honesty axes asserted; feedback/experience/adaptation/improvement/preservation safety flags false; `tier_reachability.of === 7` across parts and `composition.of === 7` in summary.
- **Reads NEVER write**: exact `COUNT(*)` on **21** existing learning/feedback/experience/adaptive/improvement/organizational sentinel tables is unchanged before vs after exercising every read part.
- **Engines NEVER invoked**: e.g. `learn_outcomes` and `adaptive_intelligence_events` counts unchanged (the engines are existence-checked via `fs.existsSync`, never imported/invoked — confirmed by static review).
- **Injection rejected**: `/register` rejects a malicious `physical_table` identifier; no row written; target table survives.
- **Cleanup** drops both OWNED tables → 0 tables (byte-identical OFF).

## Smoke (flag OFF, live Backend API)
All `/api/admin/continuous-learning-intelligence/*` endpoints return **401** on GET / **403** on POST (global `/api/admin` auth middleware fires before the route-level flag gate; OFF smoke ∈ {401,403,503} per platform convention — the flag gate still enforces disabled behaviour). OWNED tables absent (`learning_registry`, `continuous_learning_intelligence_audit_snapshots` both NULL via `to_regclass`).

## STOP
Additive phase complete. **STOP for approval before merge/deploy. NO deploy.**
