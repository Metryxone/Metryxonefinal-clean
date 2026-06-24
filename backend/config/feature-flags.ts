/**
 * Centralised feature-flag registry.
 *
 * Each flag has a default value; the environment may override via
 * `FF_<UPPER_SNAKE_CASE>=true|false`. Use the `isFlagEnabled` helper
 * (or one of the named helpers below) from any server module — never
 * read flags inline so we can flip behaviour from one place.
 */

export const FEATURE_FLAGS = {
  /** V2 Competency Intelligence Runtime — contextual DNA + dynamic weights. */
  advancedCompetencyRuntimeV2: true,
  /** V2 Adaptive Assessment Runtime — ontology-driven blueprints + adaptive flow. */
  adaptiveAssessmentRuntimeV2: true,
  /** V2 Contextual Scoring + Intelligent Benchmarking. */
  contextualScoringV2: true,
  /** V2 Workforce OS — additive depth: forecasting, simulation, fairness drift, SLA, ABAC, ROI attribution. */
  workforceOSV2: true,
  /** V2 Adaptive Intelligence Orchestration — event bus, profile engine, graph engine. */
  adaptiveOrchestrationV2: true,
  /** V2 AI Inference — heuristic competency inference from resume/LinkedIn/GitHub/conversational. */
  aiInferenceV2: true,
  /** V2 Predictive Intelligence — readiness/burnout/leadership/decay/promotion forecasting. */
  predictiveIntelligenceV2: true,
  /** V2 Governance Science — psychometrics, fairness, explainability graph, AI oversight. */
  governanceScienceV2: true,
  /** V2 Enterprise Workforce OS — org graph, executive intelligence, observability, optimisation. */
  enterpriseWorkforceOSV2: true,
  /** UCIP (Unified Competency Intelligence Profile) — master aggregation layer.
   *  Default OFF; turn ON only when Phase 2+ consumers are ready. Read-only when ON. */
  ucipEnabled: true,
  /** UCIP shadow mode — when ON (default), UCIP runs silently: aggregate + log + validate,
   *  but NEVER affects runtime, scoring, UI, or assessments. Independent of ucipEnabled. */
  ucipShadowMode: true,
  /** Adaptive Intelligence Foundation — umbrella flag for the Phase 1 foundation layer.
   *  Gates whether UCIP routes accept any request at all. */
  adaptiveIntelligenceFoundation: true,
  /** Role DNA Runtime (Phase 2). */
  roleDNARuntimeEnabled: true,
  /** Functional Competency Seeding (Phase 2). */
  functionalCompetencySeeding: true,
  /** Contextual Competency Resolution (Phase 2). */
  contextualCompetencyResolution: true,
  /** Competency Graph Runtime (Phase 3). */
  competencyGraphRuntime: true,
  /** Adaptive Blueprint Runtime (Phase 3). */
  adaptiveBlueprintRuntime: true,
  /** Competency Propagation (Phase 3). */
  competencyPropagation: true,
  /** Dynamic Question Generation (Phase 4). */
  dynamicQuestionGeneration: true,
  /** Adaptive Question Branching (Phase 4). */
  adaptiveQuestionBranching: true,
  /** Cognitive Runtime (Phase 4). */
  cognitiveRuntimeEnabled: true,
  /** Adaptive Runtime Authority (Phase 5) — umbrella flag for the unified
   *  adaptive runtime orchestrator. Shadow-mode writes only until authority is transitioned. */
  adaptiveRuntimeAuthority: true,
  /** Competency Fusion (Phase 5). */
  competencyFusionEnabled: true,
  /** Contextual Scoring Authority (Phase 5). */
  contextualScoringAuthority: true,
  /** Intelligence Narratives (Phase 5). */
  intelligenceNarratives: true,
  /** Continuous Competency Memory (Phase 5). */
  continuousCompetencyMemory: true,
  /** Employability Passport (T-P7) — shareable candidate artifact + public recruiter view. */
  employabilityPassport: true,
  /** Ontology Hierarchy Completion (Task #51) — Sector + Industry Segment entities and the
   *  persisted ont_*→onto_* role crosswalk consumed by the weight bridge. Default OFF →
   *  new routes 503, new admin panels hidden, the additive schema is never created, and the
   *  weight bridge falls back to the pure runtime title matcher (byte-identical to legacy). */
  ontologyHierarchyV2: false,
  /** Hypothesis-Driven Clarity (Phase 0B) — when ON, `/analyze` additionally attaches
   *  a hypothesis investigation envelope (bands + governance) to its response.
   *  Default OFF → response is byte-identical to current behaviour. */
  hypothesisDrivenClarity: false,
  /** Simulation & Validation Environment (0C) — admin-only harness that drives the
   *  live CAPADEX pipeline with simulated personas to validate it before production.
   *  Default OFF → admin simulation routes 503 + the dashboard panel hides. */
  simulationHarness: false,
  /** Adaptive Questioning (Phase B) — when ON, the clarity phase becomes adaptive:
   *  per-answer dynamic pathing, information-gain filtering, zero-repetition
   *  suppression, trait-contradiction probing, and stop-when-confident length.
   *  Default OFF → `/analyze` returns the existing batch and the incremental
   *  `/adaptive-next` endpoint reports `enabled:false` so the frontend falls back
   *  to today's byte-identical batch flow. */
  adaptiveQuestioning: true,
  /** Runtime Intelligence Activation (Phase 6) — when ON, the live assessment
   *  report surfaces the existing admin-authored PIL guidance chain (archetype →
   *  human problems → behaviours → search intents → interventions → growth path)
   *  for the assessed session. Strictly additive + read-only: flag OFF →
   *  `/api/capadex/session/:id/guidance` returns `{enabled:false}` and the report
   *  section hides → byte-identical legacy behaviour. */
  runtimeIntelligenceActivation: false,
  /** Runtime Intelligence Pipeline (Phase 6A) — when ON, the read-only resolver at
   *  `/api/capadex/session/:id/pipeline` returns the full forward lineage for an
   *  assessed session: Response → Signal → Concern → Capability → Problem →
   *  Behavior → Archetype → Intervention. Strictly additive + read-only (reuses
   *  the existing engines, no writes/recompute): flag OFF → the route returns
   *  `{enabled:false}` → byte-identical legacy behaviour. */
  runtimeIntelligencePipeline: false,
  /** Signal Grounding Runtime (WC-1B-R) — when ON, the runtime CONSUMES the
   *  WC-1B bridge-tag → signal grounding (`capadex_bridge_tag_signal_grounding`,
   *  `capadex_bridge_tag_family_grounding`). A resolved concern's bridge tag
   *  contributes capped, ranked, confidence-penalised grounded signals as
   *  additional activation seeds (gap-fill only, never displacing curated Tier-3
   *  mappings), additive resolver evidence (`signal_grounding` envelope +
   *  `resolution_confidence_grounded`, core score untouched), an additive
   *  question-ranking nudge, and a read-only explainability lineage
   *  (`/api/capadex/session/:id/grounding`). Strictly additive: flag OFF →
   *  byte-identical legacy behaviour at every surface. Consumes existing WC-1B
   *  assets only — never creates signals/concerns/tags. */
  signalGroundingRuntime: false,
  /** Runtime Metadata Activation (AQ-2R) — when ON, the live clarity-question
   *  selection (`pickQuestionsFromMaster`) CONSUMES the AQ-2 per-question metadata
   *  (`capadex_question_metadata`: age / persona / dev-stage / behavior / capability
   *  / signal). A resolved concern's curated clarity pool is additively re-ranked to
   *  prefer age-matched, persona-matched, high-signal-confidence, construct-bearing
   *  questions, and the final batch is ordered by development stage for natural
   *  progression. Strictly additive + reversible: flag OFF → no metadata join, no
   *  re-rank → byte-identical legacy ordering. Consumes existing AQ-2 metadata only —
   *  never creates/edits questions, scoring, or reports. */
  runtimeMetadataActivation: false,
  /** PHASE 7 — Validation Loop (structural, outcome-pending). When ON, the front-half realized-OUTCOME
   *  intake activates: POST /api/validation-loop/outcomes records realized hiring/performance/promotion/
   *  retention outcomes against an assessment subject (+ the decision-time prediction snapshot), and the
   *  admin GET /api/validation-loop/status + /calibration surface compose the EXISTING calibration engine
   *  (buildCalibrationModel) over the recorded (predicted, outcome) pairs. Predictions stay ABSTAINED
   *  (no empirical accuracy claim) until ≥30 realized non-demo outcomes accrue (platform k_min). Strictly
   *  additive + reversible: flag OFF → every route 503, the ensure-schema is NEVER reached so the table is
   *  never created → byte-identical legacy behaviour incl. schema. GET handlers probe via to_regclass and
   *  never write; demo rows are EXCLUDED from evidence-backed claims; no outcome is ever fabricated.
   *  MX-75X — DURABLE ACTIVATION: default flipped ON (redeploy/restart-safe, like `careerBuilderSuite`).
   *  Reverse with `FF_VALIDATION_LOOP=0`, which restores byte-identical legacy behaviour incl. schema
   *  (no DDL is reached when OFF). Activation only opens the read/intake surface — it CANNOT manufacture
   *  evidence: predictions stay ABSTAINED and certification stays PARTIAL until ≥30 realized non-demo
   *  outcomes accrue. Env: `FF_VALIDATION_LOOP`. */
  validationLoop: true,
  /** MX-102X — Outcome Intelligence Activation (read-only composer over the EXISTING realized-outcome
   *  substrates). When ON, a PURE read-only composer at `/api/outcome-intelligence/*` unifies the SIX
   *  realized-outcome types — hiring · performance · promotion · retention · career · learning — into one
   *  honest surface that keeps COVERAGE (realized outcomes captured) and CONFIDENCE/empirical-accuracy
   *  (calibration trusted only at ≥ k_min=30 realized predictions) as SEPARATE axes. It COMPOSES the
   *  already-present engines (validation-loop intake `validation_loop_outcomes`, the employer hiring
   *  feeder `employer_candidates`, the shared calibration engine `buildCalibrationModel`, the career
   *  evidence ledger `career_outcomes`, and the learning substrate `student_subscriptions`) — it never
   *  recomputes a score, never writes, and never fabricates an outcome or accuracy claim. With ~0 realized
   *  outcomes the surface honestly reports Coverage 0 and ABSTAINS on accuracy (PARTIAL, not inflated).
   *  Strictly additive + reversible: flag OFF → every route 503, no schema is touched (composer reads via
   *  to_regclass probes only) → byte-identical legacy behaviour. GET-only. Env: `FF_OUTCOME_INTELLIGENCE_ACTIVATION`. */
  outcomeIntelligenceActivation: false,
  /** MX-103X — Live Employer Ecosystem Activation (read-only audit + certification console over the EXISTING
   *  employer hiring funnel). When ON, a PURE read-only composer at `/api/admin/employer-ecosystem/*`
   *  (super-admin) inventories the nine funnel stages — onboarding · create-job · role-DNA · competencies ·
   *  assessment · candidate-match · interview · hiring-decision · outcome-tracking — reporting per stage:
   *  gating-flag state, substrate presence (to_regclass), and REAL-vs-DEMO row counts. It keeps COVERAGE
   *  (stage exercisable end-to-end) and CONFIDENCE (trustworthy real data; calibration ≥ k_min=30) as SEPARATE
   *  axes and never composites them. Demo rows (@example.com candidates / `validation_loop_outcomes.is_demo`)
   *  are counted separately and EXCLUDED from the confidence axis. It COMPOSES the already-built employer
   *  subsystem (employer-competency-match, hiring-assessment-engine, talent-matching, interview-intelligence,
   *  employer-hiring-intelligence, outcome-intelligence, tig calibration) — it recomputes no score, runs NO
   *  DDL, writes NO rows (GET-only), and abstains honestly (PARTIAL) until real non-demo outcomes accrue.
   *  Strictly additive + reversible: flag OFF → every route 503 before any DB touch → byte-identical legacy
   *  behaviour incl. schema. Env: `FF_LIVE_EMPLOYER_ECOSYSTEM`. */
  liveEmployerEcosystem: false,
  /** PHASE 8 — Global Competency (structural framework). When ON, an ADDITIVE region dimension threads
   *  through the five global-deployability surfaces (role libraries · benchmarks · competency models ·
   *  readiness models · demand intelligence) WITHOUT mutating any existing table: an overlay table
   *  (`global_region_content`) region-tags existing entities additively + reversibly, and the read-only
   *  admin surface (GET /api/global-competency/regions · /coverage · /coverage/:region) reports per-region
   *  coverage — the DEFAULT region (IN/India) inherits today's real global content counts, every other
   *  region (ME/EU/US/APAC) reports honest ZEROS until curated content is assigned. Structural framework +
   *  coverage ONLY — never fabricates regional benchmarks/content. Strictly additive + reversible: flag
   *  OFF → every route 503, the ensure-schema is NEVER reached so the overlay table is never created →
   *  byte-identical legacy behaviour incl. schema (default region == today). GET handlers probe via
   *  to_regclass and never write. Env: `FF_GLOBAL_COMPETENCY`. */
  globalCompetency: false,
  /** MX-76X — Global Intelligence (read-only composer over the EXISTING global/region/country assets).
   *  When ON, a PURE read-only composer at `/api/global-intel/*` unifies the already-present global
   *  deployability surfaces into one honest view: the 5-tier competency model (global→regional→country→
   *  industry→role), the canonical region set + crosswalk reconciling the three live region taxonomies
   *  (Phase-8 `global_region_content` ME/EU/US/APAC ↔ `m4_countries.region` EMEA/APAC/Americas ↔
   *  `nhda_regions` India sub-national), the `m4_*` country tier (via the existing `createLocalization`
   *  engine), the benchmark tier coverage (surfacing the latent `bench_cohorts(cohort_type='region')`
   *  read-only, k-anonymity preserved), Role-DNA region/country inheritance (variant=null honest resting
   *  state — no region-native role source exists, never fabricated), and the localization resolution
   *  (language packs + a country→currency display resolver defaulting to INR so India stays byte-identical).
   *  compose-never-recompute: GET-only, NO DDL/ensure-schema (zero new tables), every read to_regclass-
   *  probed; Coverage ⟂ Confidence; absent → null/`inherited`/`not_localized`/`not_measurable`, NEVER a
   *  fabricated value. Empty regions/countries (Africa/LATAM, countries beyond the seeded 5) report empty.
   *  Strictly additive + reversible: flag OFF → every route 503 before any DB touch → byte-identical legacy
   *  behaviour incl. schema. `/api/global-intel/enabled` is a persona-agnostic flag probe (flagGate-only)
   *  so employer/candidate UIs can gate their tabs; reference reads are flagGate→requireAuth (platform
   *  metadata, no PII); admin overview adds requireSuperAdmin. Env: `FF_GLOBAL_INTELLIGENCE`. */
  globalIntelligence: false,
  /** MX-100X PHASE 9 — Enterprise Workforce Intelligence Console. A PURE read-only COMPOSER that wires
   *  the EXISTING predictive-workforce engine (Phase 5: obsolescence / workforce risk / AI exposure /
   *  emerging roles) + the M5 enterprise engines (workforce intelligence, succession, simulation,
   *  executive) into ONE flag-gated console with 7 views: skill-gap, succession, internal-mobility,
   *  workforce-planning, talent-risk, talent-forecasting, readiness-forecasting. compose-never-recompute:
   *  calls only the existing engines' READ paths + read-only snapshot SELECTs (to_regclass-probed); it
   *  recomputes nothing, runs NO DDL, writes NO rows (GET-only, no ensure-schema). Forecasts ABSTAIN
   *  honestly below 2 longitudinal points; cohort aggregates SUPPRESSED below k=30. Unmeasured → null,
   *  NEVER 0. Developmental signals only — NOT hiring/promotion/suitability predictions (disclaimer +
   *  provenance on every view). OFF → every route 503 before any auth/DB touch (byte-identical legacy;
   *  no new tables). Super-admin gated (requireAuth → requireSuperAdmin). Distinct from Phase 5.12
   *  `workforceIntelligence` (employer-scoped). Env: `FF_ENTERPRISE_WORKFORCE_CONSOLE`. */
  enterpriseWorkforceConsole: false,
  /** WC-3 L1 — Stage Intelligence (Phase A). When ON, the post-completion runtime
   *  COMPOSES a per-session behavioural stage (canonical 5-stage progression:
   *  Awareness → Curiosity → Clarity → Growth → Mastery) from the already-computed
   *  session stage_code + CSI profile, persists current stage state + an append-only
   *  progression log, and exposes a read-only `/api/capadex/session/:id/stage`.
   *  Strictly additive + reversible: flag OFF → no write, route → `{enabled:false}`,
   *  byte-identical legacy behaviour. Composes existing CSI only — never recomputes
   *  scores, never edits ontology/signals/concerns. Env: `FF_WC3_STAGE`. */
  wc3Stage: false,
  /** WC-3 L4 — Dynamic Personalization Wiring (Phase A). When ON, the clarity
   *  picker additively attaches a `personalization` provenance envelope (the
   *  age / persona / context / severity / construct dimensions that drove the
   *  selection) + `personalized:true` marker to the `/analyze` response, and
   *  fire-and-forget records the personalization decision. Phase A is WIRING +
   *  OBSERVABILITY only: it NEVER re-orders or changes which questions are
   *  selected — selection stays byte-identical to legacy. flag OFF → no envelope,
   *  no marker, no log. Env: `FF_WC3_PERSONALIZATION`. */
  wc3Personalization: false,
  /** WC-3 L6 — Longitudinal Foundation (Phase A). When ON, the post-completion
   *  runtime appends an immutable per-session longitudinal snapshot (concern /
   *  stage / score / CSI vector) to `wc3_longitudinal_snapshots`, and exposes a
   *  read-only session-scoped `/api/capadex/session/:id/longitudinal` (PII-safe;
   *  the session UUID is the bearer token) that returns the raw snapshot history.
   *  STORAGE + HISTORY CAPTURE ONLY — NO progression analytics / trend
   *  computation in Phase A (the `wc3_longitudinal_trends` table is created but
   *  never written). Strictly additive + reversible: flag OFF → no write, route →
   *  `{enabled:false}`. Env: `FF_WC3_LONGITUDINAL`. */
  wc3Longitudinal: false,
  /** WC-3 L2 — Outcome Intelligence (Phase B). When ON, the post-completion
   *  runtime COMPOSES per-session outcome models (Career Clarity, Learning
   *  Effectiveness, Employability Readiness, Exam Readiness, Confidence Stability,
   *  Decision Quality) using L1 Stage Intelligence as the PRIMARY dependency:
   *  current = the canonical behavioural stage, desired = the next stage target,
   *  gap = the ladder distance, and actions = LIBRARY-BACKED interventions only
   *  (FK to intervention_library — never generic). Persists `wc3_outcome_state` +
   *  `wc3_outcome_actions` and exposes a read-only `/api/capadex/session/:id/outcome`.
   *  Emits nothing (honest UNCLASSIFIED) when the behavioural spine is empty.
   *  Strictly additive + reversible: flag OFF → no write, route → `{enabled:false}`,
   *  byte-identical legacy behaviour. Composes already-computed data only — never
   *  recomputes scores, never edits ontology/signals/concerns. Env: `FF_WC3_OUTCOME`. */
  wc3Outcome: false,
  /** WC-3 L3 — Journey Intelligence (Phase C). When ON, the post-completion runtime
   *  COMPOSES a per-session ROUTE recommendation using L1 Stage + L2 Outcome as the
   *  dependencies: a Primary Route + Secondary Route across the supported products
   *  (LBI, Career Builder, Employability Index, Competitive Exam Intelligence,
   *  Mentoring), a Route Confidence + confidence band, a Route Reason, the Expected
   *  Outcome, the Expected Stage Advancement (current → next stage up), and the
   *  Product Mapping. Business rules: NO session/concern ever terminates without a
   *  route (deterministic Mentoring fallback when nothing activates), and Competitive
   *  Exam pathways are always supported even when LOW_CONFIDENCE / CORPUS_PENDING.
   *  Persists `wc3_journey_state` + `wc3_journey_candidates` and exposes a read-only
   *  `/api/capadex/session/:id/journey`. Strictly additive + reversible: flag OFF →
   *  no write, route → `{enabled:false}`, byte-identical legacy behaviour. Composes
   *  already-computed L1/L2 data only — never recomputes scores, never edits
   *  ontology/signals/concerns. Env: `FF_WC3_JOURNEY`. */
  wc3Journey: false,
  /** WC-3 L5A — Question Stage Intelligence (Question Intelligence 2.0, Phase 1). When
   *  ON, the question-catalogue layer may CONSUME the derived canonical developmental
   *  STAGE (Primary + Secondary + confidence) that L5A stamps onto every clarity question
   *  in `wc3_question_intelligence` from existing metadata (`question_type`,
   *  `response_type`, `polarity`, `narrative_style`). Strictly additive + reversible: the
   *  derivation/table is offline tooling, nothing reads it at runtime yet, so the app is
   *  byte-identical whether ON or OFF. Composes already-stored metadata only — never
   *  authors question text, never recomputes scores, never edits ontology/signals/
   *  concerns. Env: `FF_WC3_QUESTION_INTEL`. */
  wc3QuestionIntel: false,
  /** WC-3 L5B — Question Context Intelligence (Question Intelligence 2.0, Phase 2). When
   *  ON, the question-catalogue layer may CONSUME the derived life-CONTEXT axis (Primary +
   *  Secondary context + confidence + `context_explicit` + relevance_risk) that L5B stamps
   *  onto every clarity question in `wc3_question_context`. Context is derived ONLY from
   *  existing data — a tightened, sense-disambiguated question lexicon corroborated by the
   *  concern `domain`, bridge tag, and `common_indian_context` phrase. No match ⇒ `GENERAL`
   *  (the ~80% of the bank that is legitimately context-neutral is never force-tagged);
   *  ambiguous/low-signal ⇒ `UNRESOLVED`. Strictly additive + reversible: the derivation/
   *  table is offline tooling, nothing reads it at runtime yet, so the app is byte-identical
   *  whether ON or OFF. Composes already-stored metadata only — never authors question text,
   *  never recomputes scores, never edits ontology/signals/concerns. Env:
   *  `FF_WC3_CONTEXT_INTEL`. */
  wc3ContextIntel: false,
  /** WC-3 L5C Runtime Wiring — Outcome Crosswalk clarity-bank tier (WC-10 Lever 1).
   *  When ON, the L2 Outcome runtime adds a THIRD construct-resolution tier: for a
   *  session whose behavioural spine (behavioural_hypotheses / capadex_session_patterns)
   *  yields NO constructs, it traverses the clarity bank via the L5C bridge-tag→construct
   *  crosswalk — resolving the session's concern bridge tag
   *  (`master_concern_pk → capadex_concerns_master.relational_bridge_tag`) to a HIGH
   *  construct (or REVIEW candidates), unioned with the session's already-resolved
   *  `primary_construct_key`. This lifts outcome (and downstream journey) coverage for
   *  empty-spine sessions that still carry a real concern. Strictly additive + reversible:
   *  flag OFF → spine-only resolution (byte-identical legacy); sessions that already had a
   *  spine are UNCHANGED in either state (the tier only fires when the spine is empty).
   *  Composes already-computed data + the curated crosswalk only — never fabricates a
   *  construct, never edits ontology/signals/concerns. Env: `FF_WC3_OUTCOME_CROSSWALK`. */
  wc3OutcomeCrosswalk: false,
  /** WC-7B Tier A — Decision Orchestrator (Deliverable 1). When ON, the read-only
   *  resolver at `/api/capadex/session/:id/activation` COMPOSES the already-derived
   *  WC-3 L1 Stage + L2 Outcome + L3 Journey getters (read-only; transient when the
   *  persistence flags were OFF at completion) into ONE unified activation envelope:
   *  a `decision` (stage + primary outcome + unified confidence + ambiguity + why[]),
   *  a `product` route mapping, and `growthPlan` / `mentor` / `subscription`
   *  activation slots (each honest `ready:false` until its own bridge flag is ON /
   *  out of scope). Strictly additive + read-only: flag OFF → route → `{enabled:false}`,
   *  byte-identical legacy behaviour. Composes already-derived data only — never
   *  recomputes scores, never writes, never fabricates. Env: `FF_DECISION_ORCHESTRATOR`. */
  decisionOrchestrator: false,
  /** WC-7B Tier A — Journey → Growth Plan Bridge (Deliverable 2). When ON, the
   *  Decision Orchestrator additively activates a Growth Plan from the unified
   *  decision: it maps the decision's activated L2 outcome models (current/desired
   *  canonical stage → score) into the existing M5 coach `CoachInput` and runs
   *  `createAICoach(pool).growthPlan(input, persist=false)` READ-ONLY (never
   *  persisted). Prefers real `user_competency_scores` when present. Strictly additive
   *  + reversible: flag OFF → `growthPlan.ready:false reason:'bridge_disabled'`,
   *  byte-identical. Composes the existing decision + M5 engine only — never recomputes
   *  scores, never writes. Env: `FF_JOURNEY_GROWTH_PLAN_BRIDGE`. */
  journeyGrowthPlanBridge: false,
  /** WC-7B Tier A — Decision → Mentor Bridge (Deliverable 3). When ON, the Decision
   *  Orchestrator additively derives mentor-type recommendations from the unified
   *  decision (concern domain + activated outcome models + stage) using the documented
   *  domain → mentor_type mapping. Backend-only + read-only (NO cross-server call, no
   *  booking). Strictly additive + reversible: flag OFF →
   *  `mentor.ready:false reason:'bridge_disabled'`, byte-identical. Never fabricates a
   *  mentor when no signal supports one. Env: `FF_DECISION_MENTOR_BRIDGE`. */
  decisionMentorBridge: false,
  /** WC-7B Tier A — Runtime Intelligence Consumption (Deliverable 4). When ON, the
   *  live clarity-question selection additively CONSUMES the derived WC-3 L5A question
   *  stage intelligence (`wc3_question_intelligence`) + L5B question context
   *  (`wc3_question_context`) — currently derived-but-unconsumed — to nudge ordering by
   *  developmental-stage progression and session-context match. Strictly additive +
   *  reversible: flag OFF → no join, no re-rank → byte-identical legacy ordering.
   *  Consumes existing L5A/L5B tables only — never creates/edits questions, scoring,
   *  or reports. Env: `FF_RUNTIME_INTELLIGENCE_CONSUMPTION`. */
  runtimeIntelligenceConsumption: false,
  /** WC-7B Tier A — Longitudinal Automation (Deliverable 5). When ON, the
   *  post-completion runtime additively auto-creates a behavioural-memory snapshot for
   *  the session (calling the writer in-process, reading existing signals/patterns) and
   *  surfaces OMEGA `buildMemory` detections (recurring / drift / burnout / resilience /
   *  growth) + an additive next-reassessment hint. Non-blocking + never-throws.
   *  Strictly additive + reversible: flag OFF → no snapshot, no change → byte-identical
   *  legacy behaviour. Writes only to existing longitudinal tables — no new out-of-scope
   *  tables. Env: `FF_LONGITUDINAL_AUTOMATION`. */
  longitudinalAutomation: false,
  /** WC-7C Wave 1 — Commercial Activation. When ON, the Decision Orchestrator additively
   *  fills the activation envelope's `subscription` slot (and adds an `offer` slot) by
   *  COMPOSING the unified decision onto the LIVE CAPADEX progressive-stage ladder (real
   *  Razorpay SKU), reading only `capadex_payments` for already-owned stages. Never sells
   *  into a stub, never auto-recommends on low confidence (D6 → `show_options`), and safety
   *  (D7) overrides commerce. Strictly additive + reversible: flag OFF → `subscription`
   *  stays the byte-identical `{ready:false, reason:'out_of_scope_tier_b'}` literal, no
   *  `offer` field → byte-identical legacy envelope. Composes already-derived data + the
   *  live ledger only — never writes, never recomputes, never fabricates. Env:
   *  `FF_COMMERCIAL_ACTIVATION`. */
  commercialActivation: false,
  /** WC-11 Layer 4 — Decision Persistence. When ON, the post-completion runtime additively
   *  PERSISTS the already-composed unified decision: it reads the activation envelope from the
   *  (read-only) Decision Orchestrator and UPSERTs ONE row per session into `wc7b_decision_state`
   *  (canonical stage + primary outcome + route + unified confidence + ambiguity + grounded why[]
   *  + per-slot activation readiness + composed_from). Non-blocking + never-throws. The orchestrator
   *  itself stays byte-identical (read-only); persistence is a separate write step (mirrors
   *  `resolveSessionOutcomes`). Strictly additive + reversible: flag OFF → no schema, no write →
   *  byte-identical legacy behaviour. Composes already-derived data only — never recomputes scores,
   *  never fabricates. Env: `FF_DECISION_PERSISTENCE`. */
  decisionPersistence: false,
  /** WC-L0 — User Intelligence Foundation. When ON, the post-completion runtime additively
   *  PERSISTS the already-derived user-intelligence layer for each completed session into ONE row
   *  in `wcl0_user_intelligence`: (1) persona + age-band segment + context (reusing the existing
   *  persona detection + canonical-persona normalisation; provenance-stamped selected vs derived),
   *  (2) the 6 behaviour dimensions PROJECTED from the already-built Unified Behavior Graph
   *  (`getBehaviorGraph`) — left NULL when no real behavioural signals exist (never fabricated from
   *  score), and (3) a longitudinal snapshot via the existing `captureLongitudinalSnapshot`.
   *  Strictly additive + reversible: flag OFF → no schema, no write → byte-identical legacy
   *  behaviour. Composes/persists already-derived data only — NO new intelligence engine, never
   *  recomputes scores, never fabricates. Env: `FF_USER_INTELLIGENCE_FOUNDATION`. */
  userIntelligenceFoundation: false,
  /** WC-L1 — Trend Intelligence. When ON, after a completed session the post-completion hook measures
   *  the progression DIRECTION (Improving / Stable / Declining) for the four EXISTING levers
   *  (Stage / Outcome / Journey / Decision) across the user's session history and UPSERTs the result
   *  into the long-existing (never-written) `wc3_longitudinal_trends` table. It introduces NO new
   *  intelligence engine/construct/ontology — it REUSES the existing longitudinal trend math
   *  (`leastSquaresSlope` / `directionOf` / `STABLE_DEADBAND` in longitudinal-consumption.ts) over
   *  values EXISTING intelligence already persisted (longitudinal snapshots + per-session
   *  outcome/journey/decision state). Honest degradation: a lever needs ≥2 comparable sessions or it
   *  gets no trend row (never fabricated); trend confidence scales with the number of comparable
   *  sessions. Strictly additive + reversible: flag OFF → no schema change, no write → byte-identical
   *  legacy behaviour. Env: `FF_TREND_INTELLIGENCE`. */
  trendIntelligence: false,
  /** WC-L0B — Behaviour Trend Intelligence. When ON, after a completed session the post-completion
   *  hook measures the progression DIRECTION (Improving / Stable / Declining) of the EXISTING
   *  behaviour dimensions (motivation / confidence / risk / engagement / adaptability — already
   *  PROJECTED into `wcl0_user_intelligence` from the Unified Behavior Graph) across the user's
   *  session history, and UPSERTs the result into `wc3_longitudinal_trends` (metric `behaviour_<dim>`).
   *  It introduces NO new intelligence engine / construct / dimension / ontology / scoring / AI model
   *  — it REUSES the existing longitudinal trend math (`leastSquaresSlope` / `directionOf` /
   *  `STABLE_DEADBAND`) over behaviour dims EXISTING intelligence already persisted. `learning_style`
   *  is categorical → reported, never numerically trended. Honest degradation: a dimension needs ≥2
   *  readable points for the SAME user or it gets no trend row (never fabricated); confidence scales
   *  with the number of comparable points. Strictly additive + reversible: flag OFF → no schema
   *  change, no write → byte-identical legacy behaviour. Env: `FF_BEHAVIOUR_TREND_INTELLIGENCE`. */
  behaviourTrendIntelligence: false,
  /** WC-L0D — Behaviour Namespace Alignment. When ON, the WC-L0 behaviour PROJECTION
   *  (`projectBehaviour` in services/wc3/user-intelligence-foundation.ts) additionally fills the four
   *  construct dimensions (motivation / confidence / engagement / adaptability) that the legacy
   *  positive-construct regex path leaves NULL — by inverse-coding the EXISTING runtime concern signal
   *  keys (`avoidance_pattern`, `career_confusion`, `social_withdrawal`, `placement_anxiety`,
   *  `cognitive_blocking`, `emotional_overload`) into a polarity-aware DEFICIT (value =
   *  min(50, 100 − strength) — capped at neutral). DEFICITS ONLY: a concern signal can only mark a
   *  construct as impaired (≤ neutral), never assert a strength — positive strengths still come
   *  exclusively from positive sources (the regex path / CSI positive_factors).
   *  Introduces NO new construct / dimension / ontology / scoring model / AI model — it only ROUTES
   *  existing signals to existing dims. Non-specific (`GENERAL_CONCERN`) and strength-less latency
   *  keys (`rapid_answer*`, `prolonged_hesitation`) are deliberately UNMAPPED (mapping them would
   *  fabricate a dimension). Strictly additive + reversible: flag OFF → the deficit block is skipped →
   *  byte-identical legacy projection (construct dims stay NULL). Realising the lift on already-persisted
   *  rows requires re-running the existing WC-L0 backfill with the flag ON. Env:
   *  `FF_BEHAVIOUR_NAMESPACE_ALIGNMENT`. */
  behaviourNamespaceAlignment: false,
  /** WC-L0E — Behaviour Signal Capture Backfill. Gates the OFFLINE backfill script
   *  (`scripts/wc3/wcl0e-backfill.ts`) that re-runs the EXISTING Signal Activation Runtime
   *  (`runEvidenceRuntime`) over historical completed sessions that captured no activation signals
   *  because they finished BEFORE the activation runtime went live. The script reconstructs the
   *  EvidenceInput batch purely from already-persisted `capadex_responses` (which snapshot
   *  `concern_bucket`), so the activated concern signals it produces are byte-identical to what the
   *  live `/respond` path would have written — telemetry-derived evidence (response_time_ms /
   *  answer_changed) is deliberately OMITTED, never fabricated, so sessions with no stored telemetry
   *  honestly get no rapid/hesitation signals. Backfilled rows are provenance-stamped
   *  (`signal_value.wcl0e_backfill = true`) so they are distinguishable from live captures. Introduces
   *  NO new engine / signal / construct / ontology — it only RE-RUNS an existing engine over existing
   *  data. Strictly additive + reversible: the script REFUSES to write unless this flag is ON; flag OFF
   *  → no script run → byte-identical legacy state (zero-signal sessions stay zero-signal). Env:
   *  `FF_BEHAVIOUR_SIGNAL_BACKFILL`. */
  behaviourSignalBackfill: false,
  /** WC-7C Wave 0 — Revenue Intelligence. When ON, the admin read surface
   *  `GET /api/capadex/admin/revenue-intelligence` returns read-only per-stage / per-concern
   *  conversion + revenue attribution composed from the live Razorpay ledger
   *  (`capadex_payments`) and conversion telemetry (`capadex_audit_events` 'payment_completed').
   *  Measurement only (real recorded payments — not estimates). Strictly additive + read-only:
   *  flag OFF → route → `{enabled:false}`, byte-identical legacy behaviour. Never writes, never
   *  recomputes. Env: `FF_REVENUE_INTELLIGENCE`. */
  revenueIntelligence: false,
  /** Commercial Wave 2 — Entitlement. When ON, the admin read surface section `entitlement`
   *  (`GET /api/capadex/admin/commercial-lifecycle`) returns read-only entitlement coverage
   *  composed from paid stages (`capadex_payments` status='paid') + active package grants. Fail-CLOSED
   *  on a ledger read error (never fabricates ownership). Additive + read-only: flag OFF → section
   *  omitted, byte-identical legacy. Env: `FF_COMMERCIAL_ENTITLEMENT`. */
  commercialEntitlement: false,
  /** WC-C4 — Commercial Entitlement ENFORCEMENT. When ON, the paid CAPADEX report / intelligence
   *  surfaces are gated by `requireEntitlement` (services/wc7c/require-entitlement.ts): the session's
   *  billing identity (`capadex_sessions.guest_email`, resolved SERVER-SIDE — never a client-supplied
   *  email) must OWN the report feature for the session's paid `stage_code`
   *  (CAP_INS→insight_report / CAP_GRW→growth_report / CAP_MAS→mastery_report) per the existing
   *  `deriveEntitlement` ledger. CAP_CUR (free) / unknown stage / unresolved (not-found or invalid-id)
   *  session → pass through (never gated → no regression). A ledger / lookup failure FAILS CLOSED
   *  (503 `entitlement_unavailable` — a ledger fault is never mistaken for "unpaid"); a paid stage with
   *  no owned feature → 402 `entitlement_required`. Introduces NO new entitlement model, NO
   *  schema/ontology change — it only ENFORCES the already-derived entitlement. Strictly additive +
   *  reversible: flag OFF → the middleware is a SYNCHRONOUS pass-through (`next()` before any await) →
   *  byte-identical legacy behaviour at every protected surface. Distinct from `commercialEntitlement`
   *  (the admin read overview). Env: `FF_COMMERCIAL_ENTITLEMENT_ENFORCEMENT`. */
  commercialEntitlementEnforcement: false,
  /** Phase 6.4 — Entitlement (Module Access) Engine. When ON, the per-module access-control
   *  middleware (`requireModuleAccess`) GATES the 7 product surfaces (Competency Assessments, EI,
   *  Career Builder, Career Passport, Employer Portal, Analytics, Workforce Intelligence) using the
   *  EXISTING commercial entitlement substrate (comm_plan_entitlements + comm_entitlement_grants).
   *  Identity is the authenticated email (server-derived); super-admins bypass; declared public paths
   *  stay open. Unentitled non-super-admin → 402 `module_access_required`; an entitlement-ledger fault
   *  → 503 `module_access_unavailable` (a fault is never read as "unentitled"). Strictly additive +
   *  reversible: flag OFF → the middleware is a SYNCHRONOUS pass-through (`next()` before any await),
   *  the /api/entitlement/* routes return 503, and NO schema is created → byte-identical legacy. Env:
   *  `FF_MODULE_ACCESS_CONTROL`. */
  moduleAccessControl: false,
  /** Commercial Wave 2 — Renewal. When ON, the admin section `renewal` returns the read-only renewal
   *  pipeline (due_soon / in_grace) over the validity-window package model (`student_subscriptions`).
   *  The B2C stage ladder has NO renewal (`renewal_not_applicable_b2c`). Never auto-charges. Additive +
   *  read-only: flag OFF → section omitted, byte-identical legacy. Env: `FF_COMMERCIAL_RENEWAL`. */
  commercialRenewal: false,
  /** Commercial Wave 2 — Upsell. When ON, the admin section `upsell` returns the read-only upsell
   *  overview composed from the subscription-engine ladder signal (requires a PRIOR paid stage) + the
   *  D6 high-confidence gate + the stub guard. Invents no behavioural triggers. Additive + read-only:
   *  flag OFF → section omitted, byte-identical legacy. Env: `FF_COMMERCIAL_UPSELL`. */
  commercialUpsell: false,
  /** Commercial Wave 2 — Subscription Lifecycle State. When ON, the admin section `lifecycle` returns
   *  a read-only lifecycle-state projection (pending/fulfilled/abandoned over the ladder;
   *  active/expiring_soon/expired/cancelled over packages), fully recomputed from status + expiry (no
   *  persistence). Additive + read-only: flag OFF → section omitted. Env: `FF_COMMERCIAL_LIFECYCLE_STATE`. */
  commercialLifecycleState: false,
  /** Commercial Wave 2 — Commercial Forecast Inputs. When ON, the admin section `forecast_inputs`
   *  returns the WC-L2 forecast input CONTRACT + measured per-series point availability (≥2 comparable
   *  points required). Never fabricates a series or a forecast. Additive + read-only: flag OFF → section
   *  omitted, byte-identical legacy. Env: `FF_COMMERCIAL_FORECAST_INPUTS`. */
  commercialForecastInputs: false,
  /** WC-P2 Lever B — Report Personalization Consumption. When ON, the PIL stakeholder
   *  report builder additively CONSUMES the already-derived persona (canonical persona /
   *  sub-persona) + the read-only career behaviour profile
   *  (`deriveCareerBehaviorProfile` over `getBehaviorGraph`) and appends a
   *  `behavior_profile` report section + a persona context block. Strictly additive +
   *  reversible: flag OFF → no fetch, no extra section → byte-identical legacy report.
   *  Composes already-computed data only — never recomputes signals, never fabricates a
   *  profile when the behaviour graph is empty (honest skip). Env:
   *  `FF_WC3_REPORT_PERSONALIZATION`. */
  wc3ReportPersonalization: false,
  /** WC-P2 Lever C — Recommendation Personalization Consumption. When ON, the PIL
   *  recommendation builder additively loads the already-derived WC-3 L1 Stage / L2
   *  Outcome / L3 Journey getters and attaches a read-only `personalization_context`
   *  block to the recommendation set (annotation only — the catalog-anchored selection
   *  and ordering are UNCHANGED; no rec is added or dropped). Strictly additive +
   *  reversible: flag OFF → no load, no block → byte-identical legacy rec set. Composes
   *  already-computed data only — never fabricates. Env: `FF_WC3_REC_PERSONALIZATION`. */
  wc3RecPersonalization: false,
  /** WC-P2 Lever D — Longitudinal Consumption. When ON, a pure read-only helper composes
   *  the existing immutable `wc3_longitudinal_snapshots` for the person behind a session
   *  into a per-metric trend (direction from ≥2 snapshots) + a simple linear next-step
   *  forecast, surfaced as an additive `longitudinal` report block. Strictly additive +
   *  reversible: flag OFF → no read, no block → byte-identical legacy report. With <2
   *  snapshots it emits an honest `no_trend_yet` (never fabricates a trend). Reads existing
   *  snapshots only — no writes, no DDL. Env: `FF_WC3_LONGITUDINAL_CONSUMPTION`. */
  wc3LongitudinalConsumption: false,
  /** WC-L2 — Forecast Intelligence Foundation. When ON, the read-only forecast engine
   *  (`services/wc3/forecast-intelligence.ts`) COMPOSES the already-derived Trend Intelligence
   *  (`computeUserTrends` stage/outcome/journey/decision + `computeUserBehaviourTrends` risk/…) and
   *  projects each EXISTING trend ONE step forward using the EXISTING linear formula
   *  (`forecast_next = clamp(last + slope_per_session)`, already proven in
   *  computeLongitudinalConsumption) at the EXISTING trend confidence. It introduces NO new construct,
   *  ontology, dimension, or scoring model — it only extrapolates a trend that existing intelligence
   *  already computed. Forecast→source map: risk←behaviour `risk` dim, growth←`stage` lever,
   *  outcome←`outcome` lever, journey←`journey` lever. Honest degradation: a forecast needs an
   *  underlying trend (≥2 comparable sessions); no trend → `forecastable:false` (never fabricated).
   *  Strictly additive + read-only + reversible: flag OFF → `computeUserForecasts` returns
   *  `{enabled:false}` and nothing in any runtime path changes → byte-identical legacy behaviour.
   *  Composes already-computed data only — never recomputes scores, never writes, never fabricates.
   *  Env: `FF_FORECAST_INTELLIGENCE`. */
  forecastIntelligence: false,
  /** WC-L4 — Intervention Intelligence Engine. When ON, the post-completion runtime additively COMPOSES
   *  per-session interventions and persists them into `wcl4_interventions`. The ONLY generator is the
   *  already-computed, library-backed `wc3_outcome_actions` (FK → `intervention_library`, "never generic")
   *  surfaced via `getSessionOutcomes`; each intervention is a REAL library intervention (its uuid + text),
   *  with confidence INHERITED from the generating L2 outcome model (never blended/invented). The other
   *  layers are PRIORITY/CONTEXT ANNOTATIONS only, never generators: L1 Stage, non-degraded L3 Journey +
   *  WC-11 Decision (degraded mentoring-fallback / NULL-outcome contribute ZERO), WC-L0 User persona, and
   *  polarity-aware concern signals from WC-L1 Trend + WC-L2 Forecast (user-trajectory context, never
   *  per-construct causation). FAIL-CLOSED: an empty/UNCLASSIFIED behavioural spine or no library-backed
   *  action ⇒ ZERO interventions (no generic fallback). Introduces NO new construct / ontology / scoring /
   *  AI model — it only re-shapes already-computed intelligence. Strictly additive + reversible: flag OFF →
   *  no schema, no write → byte-identical legacy behaviour. Realising it on already-persisted sessions
   *  requires the offline backfill (`scripts/wc3/wcl4-backfill.ts`) with this flag ON. Env:
   *  `FF_INTERVENTION_INTELLIGENCE`. */
  interventionIntelligence: false,
  /** WC-L5 — Memory Intelligence Engine. When ON, the post-completion runtime additively SNAPSHOTS the
   *  already-computed WC-L0→L4 intelligence for the completed session into `wcl5_memory` — a pure
   *  PERSISTENCE + RETRIEVAL layer. It introduces NO new construct / ontology / dimension / scoring / AI /
   *  forecast / intervention / decision: each memory row is a verbatim snapshot of an existing output
   *  (Stage via `getSessionStage`, Outcome via `getSessionOutcomes`, Journey via `getSessionJourney`,
   *  Decision via `getPersistedDecision`, User+Trend via `getUserIntelligence`+`getUserTrends` folded into
   *  `behaviour_memory`, Forecast via `computeUserForecasts`, and Intervention read from the persisted
   *  `wcl4_interventions`). FAIL-CLOSED: an absent / UNCLASSIFIED / empty layer ⇒ no row for that memory
   *  type (never a placeholder). UPSERT-only on (session_id,memory_type,memory_key) — no destructive write,
   *  per-session snapshots preserve history. Strictly additive + reversible: flag OFF → no schema, no write,
   *  no retrieval → byte-identical legacy behaviour. Realising it on already-persisted sessions requires the
   *  offline backfill (`scripts/wc5/wcl5-backfill.ts`, run AFTER the WC-L4 backfill) with this flag ON.
   *  Env: `FF_MEMORY_INTELLIGENCE`. */
  memoryIntelligence: true,
  /** Career Passport — lifelong portable career record (competencies, assessments, projects,
   *  achievements, certifications, experience, learning history, career goals, readiness scores).
   *  Ships with sharing framework (token-gated links), verification framework (platform + third-party
   *  email attestation), privacy rules (section-level visibility), and analytics endpoint.
   *  Additive + flag-gated: flag OFF → all /api/passport/* routes return 503, zero schema change.
   *  Env: `FF_CAREER_PASSPORT`. */
  careerPassport: false,
  /** Design Report Factory — 8-engine report generation system (Template Builder, Narrative Builder,
   *  Insight Engine, Visualization Engine, Benchmark Engine, PDF Generator, White Label Engine,
   *  Multi-language Engine). Stores generated reports + export jobs in 10 rf_* tables.
   *  Flag OFF → all /api/rf/* and /api/admin/rf/* routes return 503, zero schema change.
   *  Env: `FF_REPORT_FACTORY`. */
  reportFactory: false,
  /** Enterprise Analytics — 12-table analytics warehouse (anl_*) with ETL materializers,
   *  KPI engine, cohort analysis, benchmark snapshots, predictive feature store, data lake,
   *  and executive dashboard. Additive + read-only from operational tables.
   *  Flag OFF → all /api/analytics/* routes return 503, zero schema change.
   *  Env: `FF_ENTERPRISE_ANALYTICS`. */
  enterpriseAnalytics: false,
  /** AI Governance Platform — 15-table aig_* warehouse: Prompt Repository, Prompt Versioning,
   *  AI Workflow Engine, Model Registry, Insight Rules, Recommendation Rules, Audit Logs,
   *  Evaluation Framework, Hallucination Controls, Content Filters, Monitoring Metrics,
   *  Governance Policies, and Alerts. Additive + never mutates operational tables.
   *  Flag OFF → all /api/governance/ai/* routes return 503, zero schema change.
   *  Env: `FF_AI_GOVERNANCE`. */
  aiGovernance: false,
  /** EIOS World-Class Verified (EP-WORLDCLASS-98) — additive depth over the Employer
   *  Intelligence OS: (1) runtime-verified WS15 certification checks, (2) Activation-axis
   *  CSV/bulk employee import surfaces, (3) longitudinal metric snapshots → real last+slope
   *  trend/forecast with Coverage vs Confidence reported separately, (4) PDF/CSV export +
   *  talent drill-down. Strictly additive + read-only over already-computed data.
   *  Flag OFF → WS15 checks keep their static pass, no snapshot capture, export routes 503,
   *  no new UI surfaces → byte-identical legacy behaviour. Env: `FF_EIOS_WORLD_CLASS_VERIFIED_V2`. */
  eiosWorldClassVerifiedV2: false,
  /** Task #5 Commercial Runtime Spine — catalog data model (products / plans / bundles /
   *  promotions / coupons / discount rules) + admin CRUD. Flag OFF → all /api/commercial/admin/catalog/*
   *  routes return 503 and no catalog surface exists → byte-identical legacy. Env: `FF_COMMERCIAL_CATALOG`. */
  commercialCatalog: false,
  /** Task #5 Commercial Runtime Spine — customer + subscription lifecycle (email-keyed customers,
   *  subscription instances across the five segments, append-only lifecycle events). Flag OFF →
   *  all /api/commercial/admin/subscriptions/* + customer routes return 503 → byte-identical legacy.
   *  Env: `FF_COMMERCIAL_SUBSCRIPTIONS`. */
  commercialSubscriptions: false,
  /** Task #5 Commercial Runtime Spine — hardened Razorpay TEST integration (recurring subscriptions,
   *  payment links, idempotent verify/webhook, retry/backoff). Demo fallback works keyless. Flag OFF →
   *  the new /api/commercial/razorpay/* routes return 503; the existing B2C stage ladder is untouched.
   *  TEST keys only. Env: `FF_COMMERCIAL_RAZORPAY_RECURRING`. */
  commercialRazorpayRecurring: false,
  /** Task #6 Invoice & GST Engine — compliant billing documents (tax/proforma/credit-note/
   *  debit-note/payment-receipt/refund-receipt) + Indian GST (CGST/SGST/IGST, GSTIN validation,
   *  tax report) generated from REAL payment/subscription rows, with collision-safe invoice
   *  numbering and Zoho email delivery. Flag OFF → all /api/invoice/* routes return 503, NO `inv_*`
   *  table is created (schema unchanged), and the FinancialsPanel keeps its legacy stub →
   *  byte-identical legacy. Env: `FF_INVOICE_GST_ENGINE`. */
  invoiceGstEngine: false,
  /** Task #7 Entitlement, Metering & Revenue — generalized feature-class entitlement: resolve
   *  views/searches/reports/exports/assessments/ai/api feature classes from a customer's ACTIVE
   *  comm_subscriptions (UNION over plans) + super-admin manual grants (comm_entitlement_grants).
   *  EXTENDS (never replaces) the B2C stage ladder. Flag OFF → deriveEntitlement is byte-identical
   *  (stage features only), the grant/overview routes 503, and NO comm_entitlement_grants table is
   *  created. Env: `FF_COMMERCIAL_ENTITLEMENT_CLASSES`. */
  commercialEntitlementClasses: false,
  /** Task #7 Entitlement, Metering & Revenue — usage metering ledger (comm_usage_events) keyed by
   *  customer/subscription for the seven usage types (views/searches/unlocks/assessments/downloads/
   *  exports/api), with plan-quota checks where a plan defines limits. Fail-closed when over quota.
   *  Flag OFF → all /api/commercial/metering/* routes 503 and NO comm_usage_events table is created
   *  (schema unchanged). Env: `FF_COMMERCIAL_USAGE_METERING`. */
  commercialUsageMetering: false,
  /** Task #7 Entitlement, Metering & Revenue — recurring revenue intelligence: MRR/ARR, collections,
   *  renewals and forecasts (last+slope, ≥2 periods or abstain) from recurring comm_subscriptions ×
   *  comm_plans (not just the one-time ledger). Flag OFF → GET /api/capadex/admin/recurring-revenue
   *  returns {enabled:false} and the existing revenue-intelligence route is untouched → byte-identical
   *  legacy. Env: `FF_COMMERCIAL_RECURRING_REVENUE`. */
  commercialRecurringRevenue: false,
  /** Phase 6.6 Revenue Intelligence — composite revenue analytics: COMPOSES the recurring engine
   *  (MRR/ARR/collections/renewals/forecast) and adds revenue-by-dimension breakdowns (product,
   *  customer, segment, institution, employer, geography). READ-ONLY, never-throws, NO new tables.
   *  Flag OFF → GET /api/admin/commercial/revenue/* routes 503 and the SuperAdmin Revenue tab is
   *  hidden → byte-identical legacy. Env: `FF_COMMERCIAL_REVENUE_INTELLIGENCE`. */
  commercialRevenueIntelligence: false,
  /** Phase 6.8 Customer Success Intelligence — read-only admin analytics COMPOSING existing product
   *  substrate into Adoption / Engagement / Assessment Completion / EI Usage / Career Builder Usage /
   *  Employer Usage / Retention Risk / Expansion Opportunity, plus a transparent health index.
   *  Never recomputes, never writes schema, never fabricates (honest no_substrate vs empty). Flag OFF
   *  → GET /api/admin/commercial/success/* routes 503 and the SuperAdmin Customer Success tab is
   *  hidden → byte-identical legacy. Env: `FF_COMMERCIAL_CUSTOMER_SUCCESS`. */
  commercialCustomerSuccess: false,
  /** Phase 6.9 Enterprise Governance console — read-only admin console COMPOSING the EXISTING
   *  governance subsystem (RBAC + approval workflows + audit trails + security center) plus the
   *  genuinely-missing Data Governance (governance_events) and a transparent Compliance posture index.
   *  Never recomputes, never writes schema (to_regclass probes only — does NOT trigger
   *  ensureGovernanceSchema), never fabricates (honest no_substrate vs empty). Flag OFF → GET
   *  /api/admin/governance/console/* routes 503 and the SuperAdmin Enterprise Governance tab is hidden
   *  → byte-identical legacy. Distinct from `governanceRbacV2` (the operational write subsystem); this
   *  flag only adds the read-only console. Env: `FF_ENTERPRISE_GOVERNANCE_CONSOLE`. */
  enterpriseGovernanceConsole: false,
  /** Phase 6.10 Platform Intelligence console — read-only super-admin analytics console COMPOSING the
   *  EXISTING read-only commercial engines (engagement / retention / revenue) plus a new operational
   *  view (data quality, growth trend, conversion funnel, operational volume) into seven metric
   *  categories: Platform Health, Adoption, Growth, Conversion, Retention, Revenue, Operational, and the
   *  derived executive_dashboard + founder_dashboard projections. Never recomputes, never writes schema
   *  (to_regclass probes only — runs NO ensure-schema/DDL on the read path), never fabricates (honest
   *  no_substrate vs empty; rates null with a reason when no denominator). Flag OFF → GET
   *  /api/admin/platform/console/* routes 503 and the SuperAdmin Platform Intelligence tab is hidden →
   *  byte-identical legacy. Env: `FF_PLATFORM_INTELLIGENCE_CONSOLE`. */
  platformIntelligenceConsole: false,
  /** Phase 6.11 — Multi-Tenant Architecture console. Gates the read-only super-admin console for
   *  tenant_management (5 categories: Institutions/Employers/Partners/Franchise/Channel Partners),
   *  tenant_isolation audit, tenant_configuration, the new relationship models, and the PASS/WARN/FAIL
   *  validation harness. Flag OFF → GET /api/admin/tenant-architecture/console/* routes 503 and the
   *  SuperAdmin Multi-Tenant Architecture tab is hidden → byte-identical legacy (no DDL on read).
   *  Env: `FF_TENANT_MANAGEMENT_CONSOLE`. */
  tenantManagementConsole: false,
  /** Phase 6.11 sub-flag — opt-in tenant isolation ENFORCEMENT. Default OFF. When ON, the console may
   *  arm/disarm RLS policies on the FOUR additive relationship tables ONLY (never the legacy substrate)
   *  and the opt-in tenant-scope guard activates. OFF → arming is blocked and no query path is rewritten
   *  → byte-identical. Env: `FF_TENANT_ISOLATION_ENFORCEMENT`. */
  tenantIsolationEnforcement: false,
  /** Phase 6.13 — Automation Engine console. Gates the read-only super-admin console that composes the
   *  existing substrate (eios_campaigns, competency_reassessment_reminders, employer_pool_outreach,
   *  capadex_sessions, employer_candidates, comm/student_subscriptions) into automation posture across
   *  the 7 process types (Assessment Campaigns, Career Reviews, Employer Outreach, Student Follow-ups,
   *  Placement Drives, Subscription Renewals, Customer Success Actions) plus workflow & campaign engines.
   *  Flag OFF → GET /api/admin/automation/console/* routes 503 and the SuperAdmin Automation Engine tab
   *  is hidden → byte-identical legacy (no DDL on read). Env: `FF_AUTOMATION_ENGINE`. */
  automationEngine: false,
  /** Phase 6.13 sub-flag — opt-in automation EXECUTION. Default OFF. When ON, the console may enqueue
   *  intent-only automation runs (records WHAT would fire into automation_runs; never dispatches emails or
   *  external actions, executed_count stays 0). OFF → enqueue is blocked → byte-identical.
   *  Env: `FF_AUTOMATION_EXECUTION`. */
  automationExecution: false,
  /** Phase 6.14 — Super Admin Command Center. Default OFF. Composes the platform's 12 operational
   *  domains (Institutions, Employers, Students, Candidates, Assessments, EI, Career Builder, Jobs,
   *  Revenue, Subscriptions, Partners, Support) into one unified read-only view plus a platform
   *  control tower (pending actions / freshness / capacity) and global monitoring (alerts / 24h
   *  activity / subsystem status). Flag OFF → GET/POST /api/admin/command-center/console/* routes
   *  503 and the SuperAdmin Command Center tab is hidden → byte-identical legacy (no DDL on read).
   *  Env: `FF_COMMAND_CENTER`. */
  commandCenter: false,
  /** Phase 6.15 — Founder Control Center. Executive-grade read-only console that composes the live
   *  platform substrate into 9 founder domains — Revenue, Growth, Adoption, Retention (founder_dashboard);
   *  Customer / Institution / Employer / Platform Health (executive_intelligence); and Risk Indicators
   *  + derived strategic insights (strategic_insights). COMPOSE-never-recompute (reuses the Phase 6.14
   *  Global Monitoring engine), GET-never-writes, never-fabricate (absent source → null, unmeasurable
   *  health → no score). Flag OFF → GET/POST /api/admin/founder-control-center/console/* routes 503 and
   *  the Founder Control Center tab is hidden → byte-identical legacy (no DDL on read).
   *  Env: `FF_FOUNDER_CONTROL_CENTER`. */
  founderControlCenter: false,
  /** Phase 6.12 — Partner Ecosystem portal. Turns the read-only Phase 6.11 relationship tables into a
   *  working partner program: partner-agreement lifecycle (draft → active → suspended → terminated)
   *  editable from the SuperAdmin console (persisted to tenant_partner_agreements), channel-referral
   *  attribution + status tracking (tenant_channel_referrals), and a read-only commission/payout
   *  computation surface (honest, never fabricated). ADDITIVE + flag-gated: OFF → every
   *  /api/admin/tenant-architecture/console/partner-ecosystem/* route 503s, NO DDL runs (the lifecycle
   *  ensure-schema is gated too) and the Partner Ecosystem sub-tab self-hides → byte-identical legacy.
   *  GET-never-writes; requireAuth + requireSuperAdmin. Env: `FF_PARTNER_ECOSYSTEM`. */
  partnerEcosystem: false,
  /** Critical Gaps #2 & #3 — operational RBAC + Audit Trail + Governance/Security Center. Gates the
   *  whole governance subsystem: role/permission framework + hierarchies + permission groups, admin
   *  lifecycle (activate/suspend/terminate), categorized audit logging, generalized approval workflows,
   *  and the read-only security center. Flag OFF → every /api/admin/governance/* route 503s, NO rbac_*
   *  table is created, no seed runs, and the SuperAdmin panel is hidden → byte-identical legacy. The
   *  existing single super_admin gate on /api/admin/* remains the live enforcement path; RBAC grants are
   *  advisory definitions, never silently swapped in. Env: `FF_GOVERNANCE_RBAC_V2`. */
  governanceRbacV2: false,
  /** Phase 6 — Commercial Platform Validation. A read-only, compose-only super-admin honesty/invariant
   *  harness across the eight commercial subsystems (Commercial Layer, Institution Layer, Subscription,
   *  Entitlement, Revenue, Platform Governance, Customer Success, Enterprise Readiness). It re-reads
   *  already-recorded commercial data and composes existing pure read engines; it runs ZERO DDL, charges
   *  nothing, and writes nothing. Flag OFF → every /api/commercial-validation/* route returns 503 BEFORE
   *  any DB touch → byte-identical legacy behaviour. Env: `FF_COMMERCIAL_VALIDATION`. */
  commercialValidation: false,
  /** Phase 6.1 — Commercial Architecture. Net-new ADDITIVE catalog layer over the EXISTING comm_*
   *  spine: the SKU layer (comm_skus = sku_master), Add-ons (comm_addons + comm_sku_addons), and a
   *  first-class Entitlement Framework (comm_features + comm_plan_entitlements) that promotes the
   *  code-only FEATURE_CLASSES vocabulary (services/commercial/plan-features.ts) to catalog DATA.
   *  Structure: Product → Plan → SKU/Add-ons → Entitlements → Usage. Flag OFF → every
   *  /api/commercial-architecture/* route returns 503 BEFORE any DB touch AND the lazy ensure-schema
   *  never runs, so NO comm_skus / comm_addons / comm_sku_addons / comm_features /
   *  comm_plan_entitlements table is created → byte-identical legacy. Composes the existing catalog
   *  only — never a second ledger. Env: `FF_COMMERCIAL_ARCHITECTURE`. */
  commercialArchitecture: false,
  /** Career Builder — First Outcome Evidence Loop. Captures real observed outcomes (goal
   *  achieved, EI lift, role change) per subject alongside the prior score that preceded them,
   *  and exposes a read-only validation engine that links score -> real outcome with honest n
   *  and confidence (never presenting demo/synthetic data as validated). Flag OFF → the goal
   *  completion hook is a no-op, /api/career/outcomes* and /api/admin/career-evidence/* routes
   *  503, no career_outcomes table is created and the SuperAdmin panel hides → byte-identical
   *  legacy. Env: `FF_CAREER_OUTCOME_EVIDENCE`. */
  careerOutcomeEvidence: true,
  /** Competency Framework Intelligence Foundation (Phase 1). When ON, an additive,
   *  read-only "Competency Intelligence" service + API treats the EXISTING competency
   *  framework as ONE master spine by COMPOSING the two disjoint namespaces (the curated
   *  `onto_*` 300-competency genome + Role DNA as the canonical library; the operational
   *  `ont_*`/O*NET taxonomy/levels/indicators that attach to it) — exposing unified master
   *  views (`GET /api/competency-intelligence/*`), a crosswalk registry mapping the app's
   *  fragmented competency identifiers (assessment 7-domain codes, `onto_*` ids, `ont_*`
   *  ids) to one canonical id with honest matched/unmatched gaps, and an admin framework
   *  readiness/gap report (`GET /api/admin/competency-intelligence/readiness`) that flags
   *  populated-and-consumable vs empty-pending-import assets. Reports Coverage (data exists)
   *  and Confidence (trustworthy) as SEPARATE axes. Strictly additive + read-only: composes
   *  already-computed data only, never mutates competency content, never fabricates rows, no
   *  new schema/DDL. flag OFF → all routes return 503 + the SuperAdmin panel hides →
   *  byte-identical legacy behaviour. Phase 1 = FOUNDATION only; no consumer is rewritten to
   *  read from it yet. Env: `FF_COMPETENCY_FRAMEWORK_INTELLIGENCE`. */
  competencyFrameworkIntelligence: false,
  /** Competency Runtime (Phase 2) — operationalizes the live competency chain:
   *  Role → Assessment Blueprint → Assessment Generation → Competency Scoring →
   *  Competency Profile → Competency Gap Analysis. Strictly additive + flag-gated:
   *  flag OFF → all `/api/competency-runtime/*` routes return 503 `feature_disabled`
   *  and no schema/DDL runs → byte-identical legacy behaviour. Reuses the existing
   *  blueprint/role-assessment maps, the `competency_question_templates` bank
   *  (each option carries its own 0-100 score), and `getRoleReadiness`; never
   *  fabricates scores. Measurement is at the genome's 5 onto-domain grain
   *  (the 7 question-domain codes crosswalk down to it) — a per-competency
   *  domain-PROXY with honest coverage reporting until `onto_competency_question_map`
   *  is populated, at which point precise per-competency scoring activates with no
   *  rework. Env: `FF_COMPETENCY_RUNTIME`. */
  competencyRuntime: false,
  /** Phase 3 — Competency Employability Intelligence (CEI). When ON, the
   *  competency-anchored Employability Intelligence engine
   *  (services/competency-employability-engine.ts) is exposed at
   *  `/api/competency-ei/*`. It COMPOSES the Phase 2 competency-runtime outputs
   *  (profile / role-readiness / gap / signals / benchmark) into an
   *  employability-intelligence envelope: an Employability Index re-normalised
   *  over AVAILABLE component weights, drivers, positive-only strengths, gap-led
   *  development priorities, fired-risk flags, and Coverage vs Confidence as two
   *  SEPARATE axes (domain-proxy measurement caps confidence). Strictly additive
   *  + read-only (snapshots are explicit POST captures): flag OFF => every route
   *  503 BEFORE any DB touch => byte-identical legacy. Composes already-computed
   *  competency data only — never recomputes scores, never fabricates. DISTINCT
   *  from the legacy profile-based Employability Index (/api/ei/*). Env:
   *  `FF_COMPETENCY_EI`. */
  competencyEi: false,
  /** CAPADEX — Richer Behavioural Signal Capture (Task #22). Augments the evidence
   *  extractor so each answered item can emit an ADDITIONAL genuine concern signal
   *  keyed on its authored behavioural facet (sdi_items.dimension/subdomain_code),
   *  with polarity-adjusted distress. This gives a session ≥2 distinct co-active
   *  signals so the composite/pattern intelligence layer can finally form clusters
   *  (it needs ABSOLUTE_MIN_COUNT=2). Flag OFF → extractEvidence emits the exact
   *  legacy evidence set (concern-bucket answer + mutation + timing only) and the
   *  rich-signal backfill REFUSES to write → byte-identical legacy. No new table,
   *  no schema change. Env: `FF_RICH_BEHAVIORAL_SIGNALS`. */
  richBehavioralSignals: false,

  /** MX-74X — Career Builder Intelligence Suite (DURABLE ACTIVATION master switch).
   *  This is the ONLY career flag that defaults ON. It exists so the whole Career
   *  Builder intelligence layer (the Phase-4.x compose family + the Phase-6 activation
   *  endpoint) is reproducibly ACTIVE across a clean boot / redeploy WITHOUT depending
   *  on a runtime-only workflow command (the dozens of `FF_CAREER_*` env vars are NOT
   *  persisted in `.replit`, so a plain restart silently reverted every career route to
   *  503 / legacy heuristics). When this suite flag is enabled, every per-phase career
   *  flag in CAREER_SUITE_FLAGS that has NO explicit env override INHERITS the suite
   *  state (see `isFlagEnabled`). Granular flags keep their own code-default of OFF and
   *  remain individually OVERRIDABLE: an explicit `FF_CAREER_<PHASE>=0` env var force-
   *  disables just that phase even while the suite is ON, and `FF_CAREER_BUILDER_SUITE=0`
   *  reverts the ENTIRE layer to byte-identical legacy (the single reversibility lever).
   *  The suite only forces the CAREER-SPECIFIC flags; substrate engines (competency
   *  runtime / EI / Role DNA) are read by the bridge via read-only schema probes
   *  (`competencyRuntimeReady`), so they need no flag to be composed. Env:
   *  `FF_CAREER_BUILDER_SUITE`. */
  careerBuilderSuite: true,

  /** PHASE 4 — Career Intelligence Layer. Master flag for the additive, read-only
   *  bridge that COMPOSES the Phase 3 Competency-EI engines (EI profile, dimensions,
   *  role / industry / function readiness, signals, recommendations, history) into
   *  one career-intelligence envelope, surfaced across the six career deliverables
   *  (Career Builder, Pathways, Readiness, Planning, Growth Intelligence,
   *  Development Intelligence). REUSES existing career infra (cg_* graph, pathway
   *  intelligence, M5 growth plans, career_seeker_goals) — never rebuilds it.
   *  Strictly additive + read-only: flag OFF => the bridge route 503s BEFORE any DB
   *  touch and every existing career screen/route is byte-identical legacy. Coverage
   *  (data exists) and Confidence (trustworthy) are reported as SEPARATE axes; the
   *  domain-proxy confidence cap is disclosed; absent data is reported absent, never
   *  fabricated. Outputs are developmental signals only — never hiring/promotion/
   *  suitability predictions. Env: `FF_CAREER_INTELLIGENCE`. */
  careerIntelligence: false,

  /* PHASE 6 — Career Intelligence Activation. Additive + read-only. Surfaces the
   *  four named competency-driven Career Builder scores (career readiness / career
   *  growth / role progression / skill-gap pressure) + the gap-derived plan slice,
   *  COMPOSED by the existing Phase-4 career-intelligence bridge from the MEASURED
   *  competency profile. Toggles INDEPENDENTLY of `careerIntelligence` so the new
   *  frontend-facing endpoint can be activated on its own. Flag OFF => the
   *  /api/career/competency-activation/:userId route 503s BEFORE any DB touch and
   *  the frontend falls back to its existing heuristics (byte-identical legacy).
   *  GET never writes (competencyRuntimeReady gates the bridge's ensure-schema).
   *  Outputs are developmental signals only. Env: `FF_CAREER_INTELLIGENCE_ACTIVATION`. */
  careerIntelligenceActivation: false,

  /* PHASE 4.3 — Career Readiness Engine. Additive + read-only layer that COMPOSES
   *  the already-built readiness engines (Current = EI overall, Future = FRP/FRI,
   *  Role = role-readiness-v2, Growth = EI growth potential) into ONE unified
   *  career-readiness envelope, plus an append-only `career_readiness_history`
   *  snapshot. Flag OFF => every /api/career-readiness/* route 503s BEFORE any DB
   *  touch and NO schema is ensured (byte-identical). Coverage and Confidence are
   *  SEPARATE axes; the FRP default-score fabrication risk is neutralised (a block
   *  with zero real-data confidence is reported unmeasured, never a default 40).
   *  Env: `FF_CAREER_READINESS`. */
  careerReadiness: false,

  /* PHASE 4.2 — Career Match Engine. Additive + read-only layer that COMPOSES the
   *  already-built competency profile (getProfile), EI profile (buildEiProfile),
   *  Phase-4.3 career readiness (buildCareerReadiness) and role-readiness-v2's
   *  anchor-role requirement fit, and RANKS the live `cg_roles` catalog into the
   *  subject's top role MATCHES — each with a `match_percentage`, a SEPARATE
   *  `match_confidence` band and a templated `match_explanation`. The catalog has
   *  no per-role competency requirements, so a requirement-backed fit is real ONLY
   *  for the anchor role; every other match is 'Provisional' (capability supply +
   *  categorical alignment) — Match% and Confidence stay SEPARATE axes, never
   *  composited, never a hiring/suitability prediction. Config-as-data lives in an
   *  OPTIONAL `career_matching_rules` override + an append-only `career_match_history`
   *  snapshot. Flag OFF => every /api/career-match/* route 503s BEFORE any DB touch
   *  and NO schema is ensured (byte-identical). GET-never-writes: all composition
   *  runs only when competencyRuntimeReady(); config/history reads use to_regclass.
   *  Env: `FF_CAREER_MATCH`. */
  careerMatch: false,

  /* PHASE 4.4 — Career Gap Engine. Additive + read-only layer that COMPOSES the
   *  canonical role-readiness gaps (role-readiness-v2) and buckets each gapped
   *  competency into the five competency TYPES — Skill (technical), Behavioral,
   *  Cognitive, Functional, Future Skill — via `onto_competency_type_map`, with
   *  FRP/FRI as a separate forward-looking signal for the Future-Skill bucket.
   *  Adds a career_gap_dashboard projection + deterministic career_gap_prioritization
   *  + an append-only `career_gap_history` snapshot. Flag OFF => every
   *  /api/career-gap/* route 503s BEFORE any DB touch and NO schema is ensured
   *  (byte-identical). Type classification is never fabricated: unmapped competencies
   *  fall into an honest `unclassified` bucket and lower the classified-coverage axis.
   *  Env: `FF_CAREER_GAP`. */
  careerGap: false,

  /* PHASE 4.5 — Career Roadmap Engine. Additive + read-only layer that COMPOSES
   *  the already-built Career Gap engine (Phase 4.4 — competencies required +
   *  deterministic now/next/later prioritization) and the Career Readiness
   *  aggregator (Phase 4.3 — current/target readiness) into ONE Current → Target
   *  career roadmap: phased Milestones, the Competencies Required per milestone, a
   *  derived Development Plan, and a transparent Estimated Timeline (gap-points ×
   *  a published weeks-per-level heuristic — an ESTIMATE, never a prediction), plus
   *  an append-only `career_roadmap_history` snapshot. Flag OFF => every
   *  /api/career-roadmap/* route 503s BEFORE any DB touch and NO schema is ensured
   *  (byte-identical). It never recomputes a score, never fabricates a milestone or
   *  a course; development actions are DERIVED from the gap data only. GET is
   *  read-only (the composed role-readiness path is gated by a competency-runtime
   *  probe so no DDL ever runs on a read). Env: `FF_CAREER_ROADMAP`. */
  careerRoadmap: false,

  /* PHASE 4.6 — Career Development Engine. Additive + read-only layer that
   *  COMPOSES the already-built Career Roadmap engine (Phase 4.5 → 4.4 gaps → 4.3
   *  readiness) into PERSONALIZED DEVELOPMENT PLANS organized into development
   *  STREAMS by competency TYPE — Behavioral, Technical, Cognitive, Functional and
   *  Future Skills Development — plus longitudinal development TRACKING (gap-points
   *  closing / widening per stream vs the most recent prior snapshot) and an
   *  append-only `career_development_history` snapshot. The platform ontology has
   *  NO standalone "Leadership" TYPE, so leadership development is represented
   *  THROUGH the behavioral/cognitive/functional streams (surfaced via taxonomy_note)
   *  rather than fabricated. Flag OFF => every /api/career-development/* route 503s
   *  BEFORE any DB touch and NO schema is ensured (byte-identical). It never
   *  recomputes a score and never fabricates a development action; GET is read-only
   *  (composition delegates DDL-gating to the roadmap engine; history uses a
   *  to_regclass probe). Env: `FF_CAREER_DEVELOPMENT`. */
  careerDevelopment: false,

  /** PHASE 4.7 — Career Recommendation engine. Additive, read-only aggregator that
   *  COMPOSES the Career Development chain (4.6 → 4.5 → 4.4 → 4.3) with the live
   *  `cg_roles` catalog into SIX recommendation kinds (role / career / industry /
   *  function / future_role / alternative_career), driven by a config-as-data
   *  library + rules (inline defaults; admin-editable tables). It never recomputes
   *  a score and never fabricates a role/industry/function/number; Coverage and
   *  Confidence stay SEPARATE (personalized recs inherit the chain band, market-
   *  catalog-only recs are 'Provisional'). Flag OFF => every /api/career-recommendation/*
   *  route 503s BEFORE any DB touch and NO schema is ensured (byte-identical). GET is
   *  read-only (composition delegates DDL-gating to the development chain; config/
   *  history use to_regclass probes). Env: `FF_CAREER_RECOMMENDATION`. */
  careerRecommendation: false,

  /** PHASE 4.8 — Career Simulation Engine ("What-If Analysis"). Additive,
   *  read-only composition of the role-readiness scorer + competency profile +
   *  longitudinal trend engine: "if capability X improves to level N, which
   *  roles become available?". Flag OFF => every /api/career-simulation/* route
   *  503s BEFORE any DB touch and NO schema is ensured (byte-identical legacy).
   *  GET is read-only (probes competency-runtime + role-profile schemas, never
   *  CREATEs); the only write path is POST /:subject/snapshot (append-only
   *  career_simulation_runs). Env: `FF_CAREER_SIMULATION`. */
  careerSimulation: false,
  /** Phase 4.9 — Career Passport Foundation. Read-only COMPOSITION of already-
   *  computed engine outputs (competency-runtime profile, EI profile, Phase-4.3
   *  readiness) plus the subject's career_seeker_profiles record and append-only
   *  history into SIX passport components (competency / EI / career profile /
   *  readiness / achievements / journey). DISTINCT from the existing Career
   *  Passport (cp_* tables, flag `careerPassport`, /api/passport/*): NEW base
   *  /api/career-passport/*, NEW append-only table career_passport_snapshots.
   *  Flag OFF => every /api/career-passport/* route 503s BEFORE any DB touch and
   *  NO schema is ensured (byte-identical legacy). GET is read-only (probes the
   *  competency-runtime schema before composing it, never CREATEs); the only
   *  write path is POST /:subject/snapshot. Env: `FF_CAREER_PASSPORT_FOUNDATION`. */
  careerPassportFoundation: false,

  /** PHASE 4.10 — Career Signal Engine (additive, compose-only, read-only).
   *  NEW base /api/career-signal/*. Composes the already-built competency
   *  runtime, EI profile, Phase-4.3 career readiness and Phase-4.4 career gap
   *  engines into seven DEVELOPMENTAL signals (Career/Leadership/Technical/
   *  Growth/Promotion Potential + Career/Stagnation Risk) — NEVER recomputes a
   *  score, NEVER fabricates. Coverage and Confidence are reported as separate
   *  axes. Config-as-data: career_signal_library + career_signal_rules override
   *  the in-code defaults when present (admin CRUD is the only write/DDL path).
   *  Flag OFF => every /api/career-signal/* route 503s BEFORE any DB touch and
   *  NO schema is ensured (byte-identical legacy). GET is read-only (probes the
   *  competency-runtime + config schema, never CREATEs). Env: `FF_CAREER_SIGNAL`. */
  careerSignal: false,

  /** PHASE 4.11 — Career Progression Tracking. Additive, read-only layer that
   *  COMPOSES the already-accrued Phase-4.3 readiness history plus this phase's
   *  own append-only growth_tracking + career_history tables into five
   *  longitudinal progression dimensions (Career/Readiness/Competency Growth +
   *  Career Movement + Role Evolution) — it NEVER recomputes an upstream score
   *  and NEVER fabricates a trend (growth needs ≥2 datapoints over time).
   *  Coverage (datapoints) and Confidence (longitudinal strength) are reported
   *  as separate axes. Flag OFF => every /api/career-progression/* route 503s
   *  BEFORE any DB touch and NO schema is ensured (byte-identical legacy). GET is
   *  strictly read-only (history-table to_regclass probes only, no engine, no
   *  DDL); the POST snapshot is the ONLY write/DDL path. Env: `FF_CAREER_PROGRESSION`. */
  careerProgression: false,

  /** PHASE 4.12 — Super Admin Career Validation. A read-only honesty/invariant
   *  harness a super-admin runs for ONE subject. It COMPOSES every Phase-4.x
   *  career engine (Architecture / Matching / Readiness / Gaps / Roadmaps /
   *  Development / Recommendations / Simulations / Passport / Signals / Tracking)
   *  plus platform Audit-Log and Permission probes and asserts structural
   *  invariants across THIRTEEN areas — it performs NO new scoring. Three
   *  statuses: PASS (checked & valid) · WARN (honest absence / not measurable —
   *  e.g. Career Matching (4.2) is not yet built, an empty graph, or no measured
   *  profile — NEVER a failure) · FAIL (a real invariant violation: out-of-bounds
   *  score, band/score incoherence, count mismatch, fabricated fire, or an
   *  existing-but-unreadable table). never-throws: a thrown engine error is a FAIL
   *  for THAT area only, never a 500. Flag OFF => the /api/career-validation/*
   *  routes 503 BEFORE any DB touch (byte-identical legacy). GET is strictly
   *  read-only: zero DDL (to_regclass probes + competencyRuntimeReady gating so a
   *  composed engine's lazy ensure-schema never fires on a read). Env:
   *  `FF_CAREER_VALIDATION`. */
  careerValidation: false,

  /** MX-74X — Career Path generation (the first missing link). Additive, read-only,
   *  compose-only engine that SEQUENCES a graph-backed progression path (anchor role
   *  → rising-seniority cg_role_edges → lateral options → canonical track) by
   *  composing career-match + role-readiness + career-gap. Inherits the
   *  `careerBuilderSuite` master switch; flag OFF (and suite OFF) => /api/career-path/*
   *  503s BEFORE any DB touch (byte-identical legacy). GET is strictly read-only
   *  (to_regclass probes; competency-runtime gated). Env: `FF_CAREER_PATH`. */
  careerPath: false,

  /** MX-74X — Learning Path sequencing (the second missing link). Additive, read-only,
   *  compose-only engine that ORDERS the career-roadmap's gap-closure plan and JOINS
   *  each step to matching career-recommendation items into a single learning sequence.
   *  Inherits `careerBuilderSuite`; flag OFF => /api/learning-path/* 503s before any DB
   *  touch (byte-identical legacy). GET read-only. Env: `FF_LEARNING_PATH`. */
  learningPath: false,

  /** PHASE 5.15 — Super Admin Validation. The EMPLOYER analog of 4.12: a read-only,
   *  compose-only honesty/invariant harness a super-admin runs for ONE employer
   *  subject across fourteen areas (Employer Setup … Audit Logs). It re-reads
   *  already-recorded employer/talent data and composes the 0-DDL pure engines
   *  (Notifications 5.14, Workforce 5.12); it performs NO new scoring. never-throws:
   *  each area's failure is isolated to that area, never a 500. Flag OFF => the
   *  /api/employer-validation/* routes 503 BEFORE any DB touch (byte-identical
   *  legacy). GET is strictly read-only: zero DDL (to_regclass probes + pure
   *  SELECT; no composed engine with a lazy ensure-schema is exercised). Env:
   *  `FF_EMPLOYER_VALIDATION`. */
  employerValidation: false,

  /** PHASE 5 — Talent Intelligence & Hiring Platform consolidation surface. A
   *  strictly additive, read-only aggregator that COMPOSES the already-built
   *  Phase-5 components (Employer / Recruiter / Job-Architecture / Talent-Matching
   *  / Assessment-led-Hiring / Hiring-Intelligence / Workforce-Intelligence) into
   *  ONE coherent "Talent Intelligence" read surface. It NEVER recomputes a score
   *  and NEVER fabricates — it probes the underlying tables (to_regclass + SELECT)
   *  and reports honest Coverage (data present?) and Confidence (sufficient /
   *  calibrated?) per component as SEPARATE axes. Flag OFF => the
   *  /api/talent-intelligence/* routes 503 BEFORE any DB touch (byte-identical
   *  legacy). GET is strictly read-only (zero DDL — to_regclass probes only).
   *  Super-admin gated (operator-supplied org/candidate ids => IDOR guard). Env:
   *  `FF_TALENT_INTELLIGENCE`. */
  talentIntelligence: false,

  /** PHASE 5.1 + 5.2 — Talent Foundation (Employer Foundation + Job Architecture).
   *  Additive, read-only surfacing of the canonical foundation deliverables
   *  (employer_master / organization_master / employer_rbac / employer_profiles /
   *  job_architecture / job_role_framework / job_templates). These deliverable
   *  names are exposed as compatibility VIEWS over single canonical source tables
   *  (no duplicate data) + one thin additive table (job_templates, genuine gap).
   *  The aggregator COMPOSES (never recomputes / never fabricates): it probes each
   *  deliverable (to_regclass + SELECT) and reports honest Coverage (data present?)
   *  and Confidence (sufficient?) as SEPARATE axes. Flag OFF => the
   *  /api/talent-foundation/* routes 503 BEFORE any DB touch (byte-identical
   *  legacy). GET is strictly read-only (zero DDL). Super-admin gated
   *  (operator-supplied employer ids => IDOR guard). Env: `FF_TALENT_FOUNDATION`. */
  talentFoundation: false,

  /** PHASE 5.3 — Job Posting Engine (posting + management + approval workflow).
   *  Additive engine over the EXISTING but previously-unconsumed lifecycle spine
   *  (`job_postings` + `job_approval_logs` + `job_distributions`). Adds the three
   *  deliverable engines as ONE coherent surface: job_posting_engine (Create /
   *  Edit / Publish), job_management_engine (Pause / Close / Archive / Visibility),
   *  and job_workflows (the HR -> Legal -> Leadership approval state machine, every
   *  transition logged to job_approval_logs). NO new tables (one additive
   *  `visibility` column). Flag OFF => the /api/job-posting-engine/* routes 503
   *  BEFORE any DB touch (byte-identical legacy — no schema, no read, no write).
   *  Writes happen ONLY on explicit POST/PUT; GET is read-only (to_regclass probe,
   *  never DDL). Super-admin gated (operator-supplied ids => IDOR guard). State
   *  transitions are validated (illegal transition => 409, never a throw). Env:
   *  `FF_JOB_POSTING_ENGINE`. */
  jobPostingEngine: false,

  /** MX-103W Phase 1 — Employer Job Store Sync. Additive, reversible projection
   *  layer that, when a `job_postings` row is PUBLISHED (or leadership-approved),
   *  idempotently projects a linked row into the canonical hiring-funnel substrate
   *  `employer_jobs` (link via `source_posting_id`, ids as strings), so a posted
   *  job gains full employer_jobs citizenship (lists/feeds/dashboards), not only
   *  the read-time `resolveJob` fallback. Audit-logged to `job_projection_audit`.
   *  Flag OFF => no hook fires, NO DDL (the additive employer_jobs columns + the
   *  audit table are created ONLY on the projection write-path while ON), so OFF
   *  is byte-identical legacy INCLUDING schema. Reversible: un-project marks the
   *  projected row inactive (row + audit preserved — no data loss). Never throws
   *  (projection failure never affects the publish/approve result). Env:
   *  `FF_EMPLOYER_JOB_STORE_SYNC`. */
  employerJobStoreSync: false,

  /** MX-103W Phase 2 — Role DNA Auto-Resolution. Additive, read-only service that
   *  COMPOSES the existing crosswalk (resolveCuratedRoleByTitle), Role DNA runtime
   *  and assessment-foundation mapping into ONE pipeline: free-text role title ->
   *  top-5 curated matches (numeric confidence) -> Role DNA competency profile ->
   *  assessment blueprint, with an explainability envelope. O*NET stays the
   *  REFERENCE layer, Role DNA the CANONICAL layer. Human override + audit trail
   *  persist to `role_resolution_decisions` (ensure-schema POST-path only; GET uses
   *  a to_regclass probe). NEVER fabricates a match (abstains); Coverage⟂Confidence
   *  kept SEPARATE. Flag OFF => routes 503 before any auth/DB/DDL touch
   *  (byte-identical). Super-admin gated. Env: `FF_ROLE_AUTO_RESOLUTION`. */
  roleAutoResolution: false,

  /** PHASE 5.4 — Talent Discovery Engine (search + filter + curation surfaces).
   *  Additive engine surfacing the three deliverables as ONE coherent surface:
   *  candidate_search_engine (Search / Filter Candidates over the EXISTING
   *  `employer_candidates` substrate), talent_discovery_engine (Talent
   *  Segmentation read-only aggregation + Shortlists + Saved Searches) and
   *  talent_pools (membership management). Candidate reads are strictly
   *  read-only; FOUR new additive tables back the curation surfaces
   *  (talent_pools + talent_pool_members, talent_shortlists +
   *  talent_shortlist_members, talent_saved_searches). Flag OFF => the
   *  /api/talent-discovery-engine/* routes 503 BEFORE any DB touch
   *  (byte-identical legacy — no schema, no read, no write). DDL is created
   *  lazily on the WRITE path only; GET is read-only (to_regclass probe, never
   *  DDL). Super-admin gated; created_by/added_by are the authenticated
   *  principal (IDOR guard). Membership is validated against employer_candidates
   *  so pools/shortlists can never hold phantom members. Env:
   *  `FF_TALENT_DISCOVERY`. */
  talentDiscovery: false,

  /** Phase 5.5 — Competency Matching Engine. OFF => every route 503 before any
   *  auth/DB touch (byte-identical legacy). Pure read-only compute over EXISTING
   *  substrates (employer_candidates + onto_role_competency_profiles); composes
   *  the canonical getRoleReadiness and adds ZERO net-new tables / ZERO DDL.
   *  Produces Match/Fit/Gap/Readiness/Confidence as separate honest axes;
   *  keyword-inferred evidence never masquerades as a measured level. Super-admin
   *  gated, read-only (no client-supplied identity trusted). Env:
   *  `FF_TALENT_MATCHING`. */
  talentMatching: false,

  /** PHASE 5.6 — Employability Matching Engine. Composes the EI Profile, Career
   *  Profile and Readiness Profile into three developmental employability signals
   *  (Hiring Readiness, Job Readiness, Employer Fit). Additive, read-only
   *  (composes loadPassportContext; ZERO DDL), compose-never-recompute,
   *  never-throws. Outputs are developmental signals only — NEVER hiring/
   *  suitability predictions. Super-admin gated. Env: `FF_EMPLOYABILITY_MATCHING`. */
  employabilityMatching: false,

  /** PHASE 5.7 — Assessment-Led Hiring (hiring_assessment_engine). Supports the
   *  assessment-led hiring lifecycle — Invitations, Completion, Validation,
   *  Scoring, Comparison, Ranking — over the employer substrate. The assessment
   *  SCORE is COMPOSED (employer_candidates.assessment_score → a linked
   *  onto_competency_score_runs → a competency_profile proxy → unmeasured), never
   *  re-scored. Reads are GET-never-writes (to_regclass probe + degrade); the two
   *  net-new tables (assessment_invites, candidate_ranking) are created ONLY on the
   *  POST write path while the flag is ON, so OFF is byte-identical legacy (every
   *  route 503 before any auth/DB/DDL touch). Ranking is a developmental assessment
   *  ranking — NEVER a hire/suitability verdict. Super-admin gated. Env:
   *  `FF_HIRING_ASSESSMENT`. */
  hiringAssessment: false,

  /** PHASE 5.8 — Candidate Comparison (candidate_comparison_engine). Compares two
   *  or more employer candidates for a job across six developmental dimensions
   *  (Competencies, EI, Career Readiness, Signals, Strengths, Gaps) by COMPOSING
   *  existing read-only engines — nothing is re-scored. Subject-keyed dimensions
   *  (readiness/signals/gaps) are gated behind competencyRuntimeReady() so a GET
   *  never runs DDL; absent evidence is reported unmeasured, never fabricated.
   *  Reads are GET-never-writes (to_regclass probe + degrade); the two net-new
   *  tables (comparison_dashboard, comparison_reports) are created ONLY on the POST
   *  write path while the flag is ON, so OFF is byte-identical legacy (every route
   *  503 before any auth/DB/DDL touch). The output is a DEVELOPMENTAL comparison —
   *  NEVER a hire/reject/suitability verdict. Super-admin gated. Env:
   *  `FF_CANDIDATE_COMPARISON`. */
  candidateComparison: false,

  /** PHASE 5.9 — Shortlisting Engine. Operator-driven candidate hiring pipeline
   *  over employer_candidates for a job: status management (review/shortlist/hold/
   *  interview/offer/hire/reject) + append-only workflow tracking governed by a
   *  workflow state-machine. Additive + compose-never-recompute: the engine RECORDS
   *  human pipeline decisions and enforces valid transitions — it makes NO algorithmic
   *  shortlisting/ranking/suitability verdict. GET-never-writes (to_regclass probe +
   *  degrade); the two net-new tables (candidate_pipeline, workflow_transitions) are
   *  created ONLY on the POST write path while the flag is ON, so OFF is byte-identical
   *  legacy (every route 503 before any auth/DB/DDL touch). Super-admin gated + IDOR
   *  job-scoped (strict equality). Env: `FF_SHORTLISTING`. */
  shortlisting: false,

  /** PHASE 5.10 — Interview Intelligence. Operator-driven interview management over
   *  employer_jobs/employer_candidates for a job: interview scheduling + lifecycle FSM
   *  (scheduled/completed/cancelled/no_show/rescheduled) + decision tracking
   *  (interview_engine), panelist feedback + panel reviews (interview_feedback_engine),
   *  and interview scoring + evaluation (evaluation_engine). Additive +
   *  compose-never-recompute: the engines RECORD operator scheduling/decisions/feedback/
   *  scores and fold them into operator-recorded aggregates (panel review, evaluation) —
   *  they make NO algorithmic interview/scoring/suitability verdict. GET-never-writes
   *  (to_regclass probe + degrade); the net-new tables (interview_schedules,
   *  interview_decisions, interview_feedback, interview_scores) are created ONLY on the
   *  POST write path while the flag is ON, so OFF is byte-identical legacy (every route
   *  503 before any auth/DB/DDL touch). Super-admin gated + IDOR job-scoped (candidate
   *  strictly belongs to job; feedback/scores scoped to a valid interview).
   *  Env: `FF_INTERVIEW_INTELLIGENCE`. */
  interviewIntelligence: false,

  /** PHASE 5.11 — Hiring Intelligence. A PURE READ / compose layer over the Phase 5.10
   *  interview substrate (interview_schedules/scores/feedback/decisions) + employer_candidates
   *  operator columns (match_score/assessment_score/ei_score/rating/stage). Three engines
   *  (hiring_intelligence_engine, success_prediction_engine, talent_potential_engine) fold
   *  this OPERATOR-RECORDED evidence into six coverage-gated DEVELOPMENTAL indices: Hiring
   *  Probability, Hiring Risk, Success Potential, Retention Potential, Leadership Potential,
   *  Growth Potential. compose-never-recompute: deterministic weighted folds with an explicit
   *  Coverage axis; unmeasured signals abstain (null), NEVER 0. These are directional
   *  development signals — NOT predictions and NOT an algorithmic hiring/promotion/suitability
   *  verdict (disclaimer + provenance on every output). GET-never-writes by construction: the
   *  layer creates NO tables and writes NO rows (no POST, no ensure-schema); reads use a
   *  to_regclass probe + degrade, so OFF is byte-identical legacy (every route 503 before any
   *  auth/DB touch). Super-admin gated + IDOR job-scoped (candidate strictly belongs to job).
   *  Env: `FF_HIRING_INTELLIGENCE`. */
  hiringIntelligence: false,

  /** PHASE 5.12 — Workforce Intelligence Foundation. A PURE read/compose layer that aggregates the
   *  OPERATOR-RECORDED employer substrate (employer_jobs + employer_candidates operator columns +
   *  skills / competency_profile JSONB) at the EMPLOYER → department / role level into coverage-gated
   *  DEVELOPMENTAL workforce outputs: Team Competency Profile, Department Readiness, Skill Inventory,
   *  Capability Heatmaps, Talent Distribution. compose-never-recompute: deterministic folds with an
   *  explicit Coverage axis; unmeasured signals abstain (null), NEVER 0. These are directional
   *  development signals — NOT predictions and NOT an algorithmic hiring/promotion/suitability verdict
   *  (disclaimer + provenance on every output). GET-never-writes by construction: the layer creates NO
   *  tables and writes NO rows (no POST, no ensure-schema); reads use a to_regclass probe + degrade, so
   *  OFF is byte-identical legacy (every route 503 before any auth/DB touch). Super-admin gated + IDOR
   *  employer-scoped (every read strictly scoped by employer_id; cross-employer rows never leak).
   *  Env: `FF_WORKFORCE_INTELLIGENCE`. */
  workforceIntelligence: false,

  /** PHASE 5.13 — Employer Dashboards. Read-only, role-scoped dashboards (employer_dashboard,
   *  recruiter_dashboard, talent_dashboard) that COMPOSE the Phase 5.12 workforce engines + the
   *  operator-recorded employer substrate into 8 widgets (Open Jobs, Applications, Hiring Funnel,
   *  Talent Pool, Readiness, Competency / Assessment / Hiring Analytics). compose-never-recompute:
   *  deterministic, coverage-gated folds; unmeasured signals abstain (null), NEVER 0. These are
   *  operational + developmental views — NOT predictions and NOT an algorithmic hiring/promotion/
   *  suitability verdict (disclaimer + provenance on every output). GET-never-writes by construction:
   *  the layer creates NO tables and writes NO rows (no POST, no ensure-schema); reads use a
   *  to_regclass probe + degrade, so OFF is byte-identical legacy (every route 503 before any auth/DB
   *  touch). Super-admin gated + IDOR employer-scoped (every read strictly scoped by employer_id;
   *  cross-employer rows never leak). Env: `FF_EMPLOYER_DASHBOARDS`. */
  employerDashboards: false,

  /** PHASE 5.14 — Notifications & Workflows. A PURE READ / compose-never-recompute layer that DERIVES
   *  operational notification items (Job / Application / Interview / Offer / Employer / Recruiter
   *  alerts + Status Changes), workflow next-actions, and message previews from operator-recorded
   *  evidence. It composes the 5.13 dashboard evidence (→ 5.12 workforce evidence) + a scoped
   *  candidate/job timestamp read. It creates NO tables, writes NO rows, and SENDS NOTHING (no
   *  email/SMS/push; no POST, no ensure-schema); reads use a to_regclass probe + degrade, so OFF is
   *  byte-identical legacy (every route 503 before any auth/DB touch). Super-admin gated + IDOR
   *  employer-scoped. Env: `FF_NOTIFICATION_ENGINE`. */
  notificationEngine: false,

  /** 98X GAP CLOSURE — Phase 1: Role DNA Expansion. A NEW, isolated, additive engine
   *  (`services/role-dna-expansion-engine.ts` + `/api/v2/role-dna-expansion`) that SURFACES +
   *  GENERATES Role DNA from data that ALREADY exists — confidence-scored crosswalk coverage,
   *  competency inheritance from `map_role_competency` (curated `onto_*` always wins where
   *  bridged), role requirement + benchmark + DNA generation — and (POST-only) materializes
   *  them into a NEW dedicated, provenance-stamped table `role_dna_expansion_snapshots`. It does
   *  NOT rebuild or mutate any existing engine, the curated `onto_*` genome, or the O*NET `ont_*`
   *  reference library. GET-never-writes: reads use a to_regclass probe + degrade; lazy
   *  ensure-schema runs ONLY on the POST/write path. Fully reversible: delete rows by
   *  `provenance='98x_phase1_expansion'` (or `POST /rollback`) / drop the new table. Strictly
   *  additive: flag OFF → every route 503 before any auth/DB touch, no schema, no write →
   *  byte-identical legacy behaviour. Env: `FF_ROLE_DNA_EXPANSION`. */
  roleDnaExpansion: false,
  /** MX-100X Phase 1 — Role DNA Governance & Benchmarks. When ON, a NEW read-only governance
   *  engine COMPOSES the existing Role-DNA data (`ont_roles` inheritance chain + `map_role_competency`
   *  requirements) into per-role governance scores — Completeness (Coverage axis: which DNA
   *  components exist), Confidence (Confidence axis: provenance + link density), Quality (internal
   *  coherence checks) — plus a human-readable explainability trace, a version stamp, and
   *  benchmark availability across levels (role / competency / department / family / function /
   *  readiness from `map_role_competency` aggregates; industry abstains honestly — there is NO
   *  role↔industry linkage in the `ont_*` chain, so it is never fabricated). GET-never-writes:
   *  reads use a to_regclass probe + degrade; lazy ensure-schema runs ONLY on the POST/materialize
   *  path. Fully reversible: delete rows by `provenance='mx100x_p1_governance'` (or `POST /rollback`)
   *  / drop the new `role_dna_governance` table. Strictly additive: flag OFF → every route 503
   *  before any auth/DB touch, no schema, no write → byte-identical legacy behaviour. Env:
   *  `FF_ROLE_DNA_GOVERNANCE`. */
  roleDnaGovernance: false,
  /** 98X Gap Closure — Phase 2: Competency Intelligence Spine Contracts. When ON, a NEW
   *  read-only resolver + typed contracts module unifies the TWO parallel scoring ledgers
   *  (`onto_competency_score_runs` per-competency `comp_*` + `onto_competency_profiles`
   *  per-domain `dom_*`) into ONE canonical `UnifiedCompetencyProfile` per subject
   *  (latest-per-ledger, union, each ledger's confidence inherited; null where unmeasured —
   *  never fake 0). It introduces NO new scoring math and NO writes — it only gives every
   *  downstream consumer one canonical read. GET-never-writes: reads use a to_regclass probe
   *  + degrade (zero DDL). Optional `GET /api/v2/competency-spine/profile/:subjectId`. Strictly
   *  additive: flag OFF → every route 503 before any auth/DB touch, no consumer wired →
   *  byte-identical legacy behaviour. Reversible: flag OFF / delete the module (no data to undo).
   *  Env: `FF_COMPETENCY_SPINE_CONTRACTS`. */
  competencySpineContracts: false,
  /** 98X Gap Closure — Phase 3: Employer Competency Hiring Activation. When ON, a NEW
   *  read-only service makes employer candidate↔job matching COMPETENCY-DRIVEN by reading
   *  the canonical `onto_*` genome — composing Phase-1 `generateRoleDNA` (role requirements)
   *  + Phase-2 `resolveUnifiedCompetencyProfile` (candidate competency profile, keyed by the
   *  candidate's email subject) + (best-effort) `computeRoleReadinessV2` — instead of the
   *  legacy keyword/LBI heuristic in `employer-hiring-intelligence.ts` (left UNTOUCHED). It
   *  introduces NO new scoring math beyond a deterministic weighted attainment match, NO
   *  writes and NO DDL. Fails CLOSED: no competency profile → `competencyMatch:null` +
   *  `source:'heuristic_fallback'` (never a fabricated number); Coverage (requirements
   *  assessed) and Confidence (calibration state: `uncalibrated` until >=30 realized
   *  outcomes) reported as SEPARATE axes. Optional
   *  `GET /api/v2/employer/competency-match/:candidateId/:jobId` (org-scope IDOR). Strictly
   *  additive: flag OFF → every route 503 before any auth/DB touch, no consumer wired →
   *  byte-identical legacy behaviour. Reversible: flag OFF / delete the module (no data to
   *  undo). Env: `FF_EMPLOYER_COMPETENCY_HIRING`. */
  employerCompetencyHiring: false,

  /** 98X Gap Closure — Phase 4: Career Builder 2.0 Activation. Turns ON per-user
   *  generation of the (currently empty) `cg_user_*` calculation tables by COMPOSING
   *  the existing persisting engines (skill-gap, readiness, recommendation, learning-rec)
   *  + writing a reversible anchor→target career path. Adds explicit routes
   *  `POST /api/v2/career-builder/activate/:userId`, `GET /api/v2/career-builder/intelligence/:userId`,
   *  `POST /api/v2/career-builder/rollback/:userId` (resolveEffectiveUserId IDOR), plus a
   *  flag-gated never-throws completion hook. Strictly additive: flag OFF → every route
   *  503 before any auth/DB touch and the hook no-ops → byte-identical legacy behaviour
   *  (existing Career Graph routes + CareerBuilderPage UNTOUCHED). Reversible: rollback
   *  deletes only the rows generated for the activated user (career-path rows stamped
   *  `source='98x_phase4'`; cache rows scoped by the recorded provenance run); content
   *  tables untouched; no DDL on existing tables (lazy ensure-schema only for the net-new
   *  `cg_user_activation_runs` provenance table on its write path). Env: `FF_CAREER_BUILDER_ACTIVATION`. */
  careerBuilderActivation: false,
  /** Competency → Skill Intelligence (98X Gap Closure, Phase 5). When ON, the read-only chain
   *  resolver at `/api/v2/competency-skill/*` COMPOSES the genuine, already-live surfaces into a
   *  Competency → Skill → Learning → Certification → Role → Career chain. The ONLY net-new asset
   *  is `comp_skill_map` — the genuinely-missing first hop (onto_competencies genome →
   *  cg_skill_requirements.skill_key, by confidence-scored name/slug/token match, UNCLASSIFIED
   *  where no match — never fabricated; the honest ceiling is LOW because the genome is abstract
   *  O*NET vocabulary). Every downstream hop REUSES live data: cg_skill_resource_map +
   *  cg_learning_resources (learning), lip_certifications.skills_validated[] (certifications),
   *  cg_skill_requirements + cg_roles (roles) and cg_role_edges (career). NO parallel cert/role
   *  tables are created (the LIP namespace already provides them). Strictly additive + reversible:
   *  flag OFF → every route 503 before any auth/DB touch → byte-identical legacy behaviour; the
   *  `comp_skill_map` schema is created lazily on the WRITE (seed) path only and is fully
   *  reversible by `source='98x_phase5'`. Read-only at runtime — never recomputes scores, never
   *  edits the genome / graph / certification content. Env: `FF_COMPETENCY_SKILL_INTELLIGENCE`. */
  competencySkillIntelligence: false,
  /** O*NET Activation (98X Gap Closure, Phase 1 — O*NET-driven Role DNA). When ON, the read-only
   *  orchestration layer at `/api/v2/onet-activation/*` COMPOSES the already-live O*NET reference
   *  library (`ont_roles` 1,040 · `map_role_competency` 52k · `ont_role_families`/`departments`/
   *  `functions` hierarchy · `ti_role_benchmarks`) and the existing Phase-1 role-dna-expansion
   *  engine into 5 NAMED capabilities — Crosswalk Expansion, Role Intelligence, Competency
   *  Inheritance, Role DNA Generation, Benchmark Foundation. It does NOT rebuild those engines and
   *  adds NO parallel role/competency tables. O*NET stays a REFERENCE layer (never a scoring
   *  source); the curated `onto_*` genome stays canonical (curated requirements take precedence
   *  where a bridge exists, never fabricated). The only writes are reversible, provenance-stamped
   *  Role DNA snapshots (`role_dna_expansion_snapshots`, provenance `98x_phase1_expansion`) produced
   *  by the offline activation script — nothing in the request path writes. Strictly additive +
   *  reversible: flag OFF → every route 503 before any auth/DB touch → byte-identical legacy
   *  behaviour. Env: `FF_ONET_ACTIVATION`. */
  onetActivation: false,
  /** O*NET Crosswalk Activation (MX-100X Phase 2). When ON, a NEW read-only governance engine
   *  at `/api/v2/onet-crosswalk-governance/*` COMPOSES the EXISTING O*NET crosswalk bridge
   *  tables (`map_ont_onto_role` curated-role↔O*NET-role, `map_ont_onto_competency`
   *  curated↔O*NET competency) and `map_role_competency` into crosswalk GOVERNANCE intelligence:
   *  per-mapping confidence (read from the stored `confidence`/`match_method` — never a fabricated
   *  number), duplicate detection, missing-mapping detection, and an inheritance-closure analysis
   *  for unlinked roles. Coverage (a mapping exists) and Confidence (it is trustworthy) are
   *  reported as SEPARATE axes; the industry level abstains honestly (there is NO role↔industry
   *  linkage in the `ont_*` chain — never fabricated). O*NET stays a REFERENCE layer (never a
   *  scoring source); `ont_*` ids are INTEGER and `onto_*` ids are TEXT — never coerced. The ONLY
   *  writes are a reversible, provenance-stamped manual approve/reject audit on the new
   *  `onet_crosswalk_decisions` table (write-once per entity; an approval flips the existing
   *  `map_ont_onto_role.verified` flag and records the prior value so it is fully reversible).
   *  GET-never-writes: reads use a to_regclass probe + degrade; lazy ensure-schema runs ONLY on
   *  the POST/decision path. Strictly additive + reversible: flag OFF → every route 503 before any
   *  auth/DB touch, no schema, no write → byte-identical legacy behaviour. Reversible: `POST
   *  /rollback` (delete decisions by provenance `mx100x_p2_crosswalk` + restore prior verified) /
   *  drop the new table. Env: `FF_ONET_CROSSWALK_GOVERNANCE`. */
  onetCrosswalkGovernance: false,
  /** Competency Coverage Matrices (MX-100X Phase 3). When ON, a NEW read-only engine at
   *  `/api/v2/competency-coverage-matrices/*` COMPOSES the EXISTING competency genome
   *  (`onto_competencies` domain axis, `onto_competency_type_map` 5-type axis), the genome→question
   *  bridge (`onto_competency_question_map` → `competency_question_templates`) and the population
   *  benchmark store (`bench_competency_benchmarks`) into three COVERAGE matrices — competency,
   *  assessment and benchmark — each broken down by TYPE and by DOMAIN, plus a truthful
   *  assessment-ready count. Coverage (data exists) and Confidence/readiness (sufficient + above
   *  k-anonymity) are SEPARATE axes; sparse/empty types (e.g. future_skills = 0) and the low
   *  assessment-content coverage are reported as HONEST gaps, never fabricated. The assessment bank's
   *  `competency_question_templates.competency_code` is a DISJOINT namespace from the 419-competency
   *  genome — reported separately as context, NEVER force-joined to the 5-type axis. All ids here are
   *  `onto_*` TEXT (no `ont_*` INTEGER coercion). PURELY read-only: no new schema, no POST, no DDL —
   *  every GET uses a to_regclass probe + degrade (null = missing, never fake 0). Strictly additive:
   *  flag OFF → every route 503 before any auth/DB touch, no schema → byte-identical legacy
   *  behaviour (all existing competency/assessment/benchmark routes UNTOUCHED). Reversible by flipping
   *  the flag OFF / removing the route module. Env: `FF_COMPETENCY_COVERAGE_MATRICES`. */
  competencyCoverageMatrices: false,
  /** MX-101X — Question Factory (Competency Assessment Coverage Expansion). When ON, an additive
   *  admin Question Factory at `/api/admin/question-factory/*` generates DRAFT-only question packs
   *  for genome competencies (grounded in onto_competencies definition/type — provenance
   *  `template_generated`; `ai_generated` path is wired-but-inert without OPENAI_API_KEY; `imported`
   *  bulk path), each stamped with provenance, a confidence score, and `quality_review_status`
   *  (pending_review). Every generated question lands `status='draft'` and is routed through an
   *  approval workflow — only an explicit human approval flips it to `status='approved'` + activates
   *  its genome map link, so live coverage is NEVER inflated by generation. The coverage view
   *  separates HONEST live coverage (approved+mapped) from the draft PIPELINE. Strictly additive &
   *  reversible: flag OFF → every route 503 before any auth/DB touch, the ensure-schema is never
   *  reached so the new columns/ledger are never created → byte-identical legacy behaviour incl.
   *  schema. Never deletes a question/competency, never changes the framework. Env:
   *  `FF_QUESTION_FACTORY`. */
  questionFactory: false,

  /** MX-100X Phase 4 — Adaptive Assessment Activation (the keystone).
   *  Activates the Role/Seniority → required-proficiency → difficulty + level-aware-threshold
   *  flow in the LIVE assessment path so Junior/Mid/Senior/Leadership roles produce materially
   *  different assessments (difficulty intent, scoring + readiness thresholds). Consumes the
   *  seniority anchor (career stage) and `competency_runtime_weights.expected_level` WHEN present;
   *  falls back to the stage anchor honestly when Role DNA is unpopulated. Strictly additive &
   *  read-only (zero DDL): flag OFF → live `/api/competency/questions/select` returns byte-identical
   *  payload (no `difficulty_plan`), role-fit readiness bands stay the fixed 85/72/58/45 ladder, and
   *  the new `/api/competency/assessment/difficulty-plan` route 503s before any auth/DB touch.
   *  HONESTY CEILING: the live 7-domain bank is 100% `medium` difficulty, so the SERVED difficulty
   *  distribution cannot shift by level — surfaced as an explicit coverage gap, never padded.
   *  Reversible by flipping OFF / removing the route. Env: `FF_ADAPTIVE_DIFFICULTY_ACTIVATION`. */
  adaptiveDifficultyActivation: false,
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

function envOverride(key: FeatureFlagKey): boolean | undefined {
  const envKey = 'FF_' + key.replace(/([A-Z])/g, '_$1').toUpperCase();
  const raw = process.env[envKey];
  if (raw == null) return undefined;
  const v = raw.trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes' || v === 'on') return true;
  if (v === 'false' || v === '0' || v === 'no' || v === 'off') return false;
  return undefined;
}

/** MX-74X — per-phase career flags that INHERIT the `careerBuilderSuite` master switch
 *  when they have no explicit env override. Keeps each phase's code-default at OFF while
 *  the suite (default ON) provides durable, redeploy-safe activation. Excludes the suite
 *  flag itself (resolved normally) to avoid recursion. */
const CAREER_SUITE_FLAGS: ReadonlySet<FeatureFlagKey> = new Set<FeatureFlagKey>([
  'careerIntelligence',
  'careerIntelligenceActivation',
  'careerReadiness',
  'careerMatch',
  'careerGap',
  'careerRoadmap',
  'careerDevelopment',
  'careerRecommendation',
  'careerSimulation',
  'careerPassportFoundation',
  'careerSignal',
  'careerProgression',
  'careerValidation',
  'careerPath',
  'learningPath',
]);

export function isFlagEnabled(key: FeatureFlagKey): boolean {
  // 1. Explicit env override always wins (this is the "individually overridable" path:
  //    FF_CAREER_<PHASE>=0 force-disables a single phase even when the suite is ON).
  const ovr = envOverride(key);
  if (ovr !== undefined) return ovr;
  // 2. Code default ON.
  if (FEATURE_FLAGS[key]) return true;
  // 3. MX-74X durable activation: a career-suite phase with no explicit override inherits
  //    the `careerBuilderSuite` master switch. The suite flag itself is excluded from the
  //    set, so this recursion terminates after one hop.
  if (key !== 'careerBuilderSuite' && CAREER_SUITE_FLAGS.has(key) && isFlagEnabled('careerBuilderSuite')) {
    return true;
  }
  return false;
}

export function isAdvancedRuntimeEnabled(): boolean {
  return isFlagEnabled('advancedCompetencyRuntimeV2');
}

export function isAdaptiveAssessmentV2Enabled(): boolean {
  return isFlagEnabled('adaptiveAssessmentRuntimeV2');
}

export function isContextualScoringV2Enabled(): boolean {
  return isFlagEnabled('contextualScoringV2');
}

export function isWorkforceOSV2Enabled(): boolean {
  return isFlagEnabled('workforceOSV2');
}

export function isAdaptiveOrchestrationV2Enabled(): boolean {
  return isFlagEnabled('adaptiveOrchestrationV2');
}

export function isAiInferenceV2Enabled(): boolean {
  return isFlagEnabled('aiInferenceV2');
}

export function isPredictiveIntelligenceV2Enabled(): boolean {
  return isFlagEnabled('predictiveIntelligenceV2');
}

export function isGovernanceScienceV2Enabled(): boolean {
  return isFlagEnabled('governanceScienceV2');
}

export function isEnterpriseWorkforceOSV2Enabled(): boolean {
  return isFlagEnabled('enterpriseWorkforceOSV2');
}

export function isUcipEnabled(): boolean {
  return isFlagEnabled('ucipEnabled');
}

export function isUcipShadowMode(): boolean {
  return isFlagEnabled('ucipShadowMode');
}

export function isAdaptiveIntelligenceFoundationEnabled(): boolean {
  return isFlagEnabled('adaptiveIntelligenceFoundation');
}

export function isRoleDNARuntimeEnabled(): boolean {
  return isFlagEnabled('roleDNARuntimeEnabled');
}

export function isRoleDnaExpansionEnabled(): boolean {
  return isFlagEnabled('roleDnaExpansion');
}

export function isRoleDnaGovernanceEnabled(): boolean {
  return isFlagEnabled('roleDnaGovernance');
}

export function isCompetencySpineContractsEnabled(): boolean {
  return isFlagEnabled('competencySpineContracts');
}

export function isEmployerCompetencyHiringEnabled(): boolean {
  return isFlagEnabled('employerCompetencyHiring');
}

export function isCareerBuilderActivationEnabled(): boolean {
  return isFlagEnabled('careerBuilderActivation');
}

export function isCompetencySkillIntelligenceEnabled(): boolean {
  return isFlagEnabled('competencySkillIntelligence');
}

export function isOnetActivationEnabled(): boolean {
  return isFlagEnabled('onetActivation');
}

export function isOnetCrosswalkGovernanceEnabled(): boolean {
  return isFlagEnabled('onetCrosswalkGovernance');
}

export function isCompetencyCoverageMatricesEnabled(): boolean {
  return isFlagEnabled('competencyCoverageMatrices');
}

export function isQuestionFactoryEnabled(): boolean {
  return isFlagEnabled('questionFactory');
}

export function isAdaptiveDifficultyActivationEnabled(): boolean {
  return isFlagEnabled('adaptiveDifficultyActivation');
}

export function isFunctionalCompetencySeedingEnabled(): boolean {
  return isFlagEnabled('functionalCompetencySeeding');
}

export function isContextualCompetencyResolutionEnabled(): boolean {
  return isFlagEnabled('contextualCompetencyResolution');
}

export function isCompetencyGraphRuntimeEnabled(): boolean {
  return isFlagEnabled('competencyGraphRuntime');
}

export function isAdaptiveBlueprintRuntimeEnabled(): boolean {
  return isFlagEnabled('adaptiveBlueprintRuntime');
}

export function isCompetencyPropagationEnabled(): boolean {
  return isFlagEnabled('competencyPropagation');
}

export function isDynamicQuestionGenerationEnabled(): boolean {
  return isFlagEnabled('dynamicQuestionGeneration');
}

export function isAdaptiveQuestionBranchingEnabled(): boolean {
  return isFlagEnabled('adaptiveQuestionBranching');
}

export function isCognitiveRuntimeEnabled(): boolean {
  return isFlagEnabled('cognitiveRuntimeEnabled');
}

export function isAdaptiveRuntimeAuthorityEnabled(): boolean {
  return isFlagEnabled('adaptiveRuntimeAuthority');
}
export function isCompetencyFusionEnabled(): boolean {
  return isFlagEnabled('competencyFusionEnabled');
}
export function isContextualScoringAuthorityEnabled(): boolean {
  return isFlagEnabled('contextualScoringAuthority');
}
export function isIntelligenceNarrativesEnabled(): boolean {
  return isFlagEnabled('intelligenceNarratives');
}
export function isContinuousCompetencyMemoryEnabled(): boolean {
  return isFlagEnabled('continuousCompetencyMemory');
}

export function isHypothesisDrivenClarityEnabled(): boolean {
  return isFlagEnabled('hypothesisDrivenClarity');
}

export function isSimulationHarnessEnabled(): boolean {
  return isFlagEnabled('simulationHarness');
}

export function isAdaptiveQuestioningEnabled(): boolean {
  return isFlagEnabled('adaptiveQuestioning');
}

export function isRuntimeIntelligenceActivationEnabled(): boolean {
  return isFlagEnabled('runtimeIntelligenceActivation');
}

export function isRuntimeIntelligencePipelineEnabled(): boolean {
  return isFlagEnabled('runtimeIntelligencePipeline');
}

export function isSignalGroundingRuntimeEnabled(): boolean {
  return isFlagEnabled('signalGroundingRuntime');
}

export function isRuntimeMetadataActivationEnabled(): boolean {
  return isFlagEnabled('runtimeMetadataActivation');
}

export function isWc3StageEnabled(): boolean {
  return isFlagEnabled('wc3Stage');
}

export function isWc3PersonalizationEnabled(): boolean {
  return isFlagEnabled('wc3Personalization');
}

export function isWc3LongitudinalEnabled(): boolean {
  return isFlagEnabled('wc3Longitudinal');
}

export function isWc3OutcomeEnabled(): boolean {
  return isFlagEnabled('wc3Outcome');
}

export function isWc3JourneyEnabled(): boolean {
  return isFlagEnabled('wc3Journey');
}

export function isWc3OutcomeCrosswalkEnabled(): boolean {
  return isFlagEnabled('wc3OutcomeCrosswalk');
}

export function isWc3QuestionIntelEnabled(): boolean {
  return isFlagEnabled('wc3QuestionIntel');
}

export function isWc3ContextIntelEnabled(): boolean {
  return isFlagEnabled('wc3ContextIntel');
}

export function isDecisionOrchestratorEnabled(): boolean {
  return isFlagEnabled('decisionOrchestrator');
}

export function isJourneyGrowthPlanBridgeEnabled(): boolean {
  return isFlagEnabled('journeyGrowthPlanBridge');
}

export function isDecisionMentorBridgeEnabled(): boolean {
  return isFlagEnabled('decisionMentorBridge');
}

export function isRuntimeIntelligenceConsumptionEnabled(): boolean {
  return isFlagEnabled('runtimeIntelligenceConsumption');
}

export function isLongitudinalAutomationEnabled(): boolean {
  return isFlagEnabled('longitudinalAutomation');
}

export function isCommercialActivationEnabled(): boolean {
  return isFlagEnabled('commercialActivation');
}

export function isCommercialEntitlementEnforcementEnabled(): boolean {
  return isFlagEnabled('commercialEntitlementEnforcement');
}

export function isModuleAccessControlEnabled(): boolean {
  return isFlagEnabled('moduleAccessControl');
}

export function isCommercialValidationEnabled(): boolean {
  return isFlagEnabled('commercialValidation');
}

export function isCommercialArchitectureEnabled(): boolean {
  return isFlagEnabled('commercialArchitecture');
}

export function isDecisionPersistenceEnabled(): boolean {
  return isFlagEnabled('decisionPersistence');
}

export function isRevenueIntelligenceEnabled(): boolean {
  return isFlagEnabled('revenueIntelligence');
}

export function isCommercialEntitlementClassesEnabled(): boolean {
  return isFlagEnabled('commercialEntitlementClasses');
}

export function isCommercialUsageMeteringEnabled(): boolean {
  return isFlagEnabled('commercialUsageMetering');
}

export function isCommercialRecurringRevenueEnabled(): boolean {
  return isFlagEnabled('commercialRecurringRevenue');
}

export function isCommercialRevenueIntelligenceEnabled(): boolean {
  return isFlagEnabled('commercialRevenueIntelligence');
}

export function isCommercialCustomerSuccessEnabled(): boolean {
  return isFlagEnabled('commercialCustomerSuccess');
}

export function isEnterpriseGovernanceConsoleEnabled(): boolean {
  return isFlagEnabled('enterpriseGovernanceConsole');
}

export function isPlatformIntelligenceConsoleEnabled(): boolean {
  return isFlagEnabled('platformIntelligenceConsole');
}

export function isTenantManagementConsoleEnabled(): boolean {
  return isFlagEnabled('tenantManagementConsole');
}

export function isTenantIsolationEnforcementEnabled(): boolean {
  return isFlagEnabled('tenantIsolationEnforcement');
}

export function isAutomationEngineEnabled(): boolean {
  return isFlagEnabled('automationEngine');
}

export function isAutomationExecutionEnabled(): boolean {
  return isFlagEnabled('automationExecution');
}

export function isCommandCenterEnabled(): boolean {
  return isFlagEnabled('commandCenter');
}

export function isFounderControlCenterEnabled(): boolean {
  return isFlagEnabled('founderControlCenter');
}

export function isPartnerEcosystemEnabled(): boolean {
  return isFlagEnabled('partnerEcosystem');
}

export function isCommercialEntitlementEnabled(): boolean {
  return isFlagEnabled('commercialEntitlement');
}

export function isCommercialRenewalEnabled(): boolean {
  return isFlagEnabled('commercialRenewal');
}

export function isCommercialUpsellEnabled(): boolean {
  return isFlagEnabled('commercialUpsell');
}

export function isGovernanceRbacEnabled(): boolean {
  return isFlagEnabled('governanceRbacV2');
}

export function isCommercialLifecycleStateEnabled(): boolean {
  return isFlagEnabled('commercialLifecycleState');
}

export function isCommercialForecastInputsEnabled(): boolean {
  return isFlagEnabled('commercialForecastInputs');
}

export function isUserIntelligenceFoundationEnabled(): boolean {
  return isFlagEnabled('userIntelligenceFoundation');
}

export function isTrendIntelligenceEnabled(): boolean {
  return isFlagEnabled('trendIntelligence');
}

export function isBehaviourTrendIntelligenceEnabled(): boolean {
  return isFlagEnabled('behaviourTrendIntelligence');
}

export function isBehaviourNamespaceAlignmentEnabled(): boolean {
  return isFlagEnabled('behaviourNamespaceAlignment');
}

export function isBehaviourSignalBackfillEnabled(): boolean {
  return isFlagEnabled('behaviourSignalBackfill');
}

export function isRichBehavioralSignalsEnabled(): boolean {
  return isFlagEnabled('richBehavioralSignals');
}

export function isWc3ReportPersonalizationEnabled(): boolean {
  return isFlagEnabled('wc3ReportPersonalization');
}

export function isWc3RecPersonalizationEnabled(): boolean {
  return isFlagEnabled('wc3RecPersonalization');
}

export function isWc3LongitudinalConsumptionEnabled(): boolean {
  return isFlagEnabled('wc3LongitudinalConsumption');
}

export function isForecastIntelligenceEnabled(): boolean {
  return isFlagEnabled('forecastIntelligence');
}

export function isInterventionIntelligenceEnabled(): boolean {
  return isFlagEnabled('interventionIntelligence');
}

export function isMemoryIntelligenceEnabled(): boolean {
  return isFlagEnabled('memoryIntelligence');
}

export function isEiosWorldClassVerifiedEnabled(): boolean {
  return isFlagEnabled('eiosWorldClassVerifiedV2');
}

export function isCommercialCatalogEnabled(): boolean {
  return isFlagEnabled('commercialCatalog');
}

export function isCommercialSubscriptionsEnabled(): boolean {
  return isFlagEnabled('commercialSubscriptions');
}

export function isCommercialRazorpayRecurringEnabled(): boolean {
  return isFlagEnabled('commercialRazorpayRecurring');
}

export function isInvoiceGstEngineEnabled(): boolean {
  return isFlagEnabled('invoiceGstEngine');
}

export function isCareerOutcomeEvidenceEnabled(): boolean {
  return isFlagEnabled('careerOutcomeEvidence');
}

export function isCompetencyFrameworkIntelligenceEnabled(): boolean {
  return isFlagEnabled('competencyFrameworkIntelligence');
}

export function isCompetencyRuntimeEnabled(): boolean {
  return isFlagEnabled('competencyRuntime');
}

export function isCompetencyEiEnabled(): boolean {
  return isFlagEnabled('competencyEi');
}

export function isCareerBuilderSuiteEnabled(): boolean {
  return isFlagEnabled('careerBuilderSuite');
}

export function isCareerIntelligenceEnabled(): boolean {
  return isFlagEnabled('careerIntelligence');
}

export function isCareerIntelligenceActivationEnabled(): boolean {
  return isFlagEnabled('careerIntelligenceActivation');
}

export function isCareerReadinessEnabled(): boolean {
  return isFlagEnabled('careerReadiness');
}

export function isCareerMatchEnabled(): boolean {
  return isFlagEnabled('careerMatch');
}

export function isCareerGapEnabled(): boolean {
  return isFlagEnabled('careerGap');
}

export function isCareerRoadmapEnabled(): boolean {
  return isFlagEnabled('careerRoadmap');
}

export function isCareerDevelopmentEnabled(): boolean {
  return isFlagEnabled('careerDevelopment');
}

export function isCareerRecommendationEnabled(): boolean {
  return isFlagEnabled('careerRecommendation');
}

export function isCareerSimulationEnabled(): boolean {
  return isFlagEnabled('careerSimulation');
}

export function isCareerPassportFoundationEnabled(): boolean {
  return isFlagEnabled('careerPassportFoundation');
}

export function isCareerSignalEnabled(): boolean {
  return isFlagEnabled('careerSignal');
}

export function isCareerProgressionEnabled(): boolean {
  return isFlagEnabled('careerProgression');
}

export function isCareerValidationEnabled(): boolean {
  return isFlagEnabled('careerValidation');
}

export function isCareerPathEnabled(): boolean {
  return isFlagEnabled('careerPath');
}

export function isLearningPathEnabled(): boolean {
  return isFlagEnabled('learningPath');
}

export function isEmployerValidationEnabled(): boolean {
  return isFlagEnabled('employerValidation');
}

export function isTalentIntelligenceEnabled(): boolean {
  return isFlagEnabled('talentIntelligence');
}

export function isTalentFoundationEnabled(): boolean {
  return isFlagEnabled('talentFoundation');
}

export function isJobPostingEngineEnabled(): boolean {
  return isFlagEnabled('jobPostingEngine');
}

export function isEmployerJobStoreSyncEnabled(): boolean {
  return isFlagEnabled('employerJobStoreSync');
}

export function isRoleAutoResolutionEnabled(): boolean {
  return isFlagEnabled('roleAutoResolution');
}

export function isTalentMatchingEnabled(): boolean {
  return isFlagEnabled('talentMatching');
}

export function isEmployabilityMatchingEnabled(): boolean {
  return isFlagEnabled('employabilityMatching');
}

export function isHiringAssessmentEnabled(): boolean {
  return isFlagEnabled('hiringAssessment');
}

export function isCandidateComparisonEnabled(): boolean {
  return isFlagEnabled('candidateComparison');
}

export function isShortlistingEnabled(): boolean {
  return isFlagEnabled('shortlisting');
}

export function isInterviewIntelligenceEnabled(): boolean {
  return isFlagEnabled('interviewIntelligence');
}

export function isHiringIntelligenceEnabled(): boolean {
  return isFlagEnabled('hiringIntelligence');
}

export function isWorkforceIntelligenceEnabled(): boolean {
  return isFlagEnabled('workforceIntelligence');
}

export function isEmployerDashboardsEnabled(): boolean {
  return isFlagEnabled('employerDashboards');
}

export function isNotificationEngineEnabled(): boolean {
  return isFlagEnabled('notificationEngine');
}

export function isTalentDiscoveryEnabled(): boolean {
  return isFlagEnabled('talentDiscovery');
}

export function isValidationLoopEnabled(): boolean {
  return isFlagEnabled('validationLoop');
}

export function isOutcomeIntelligenceActivationEnabled(): boolean {
  return isFlagEnabled('outcomeIntelligenceActivation');
}

export function isLiveEmployerEcosystemEnabled(): boolean {
  return isFlagEnabled('liveEmployerEcosystem');
}

export function isGlobalCompetencyEnabled(): boolean {
  return isFlagEnabled('globalCompetency');
}

export function isEnterpriseWorkforceConsoleEnabled(): boolean {
  return isFlagEnabled('enterpriseWorkforceConsole');
}

export function listFlags(): Record<FeatureFlagKey, boolean> {
  const out: Record<string, boolean> = {};
  (Object.keys(FEATURE_FLAGS) as FeatureFlagKey[]).forEach((k) => {
    out[k] = isFlagEnabled(k);
  });
  return out as Record<FeatureFlagKey, boolean>;
}
