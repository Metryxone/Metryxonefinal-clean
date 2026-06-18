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

export function isFlagEnabled(key: FeatureFlagKey): boolean {
  const ovr = envOverride(key);
  if (ovr !== undefined) return ovr;
  return FEATURE_FLAGS[key];
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

export function isDecisionPersistenceEnabled(): boolean {
  return isFlagEnabled('decisionPersistence');
}

export function isRevenueIntelligenceEnabled(): boolean {
  return isFlagEnabled('revenueIntelligence');
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

export function listFlags(): Record<FeatureFlagKey, boolean> {
  const out: Record<string, boolean> = {};
  (Object.keys(FEATURE_FLAGS) as FeatureFlagKey[]).forEach((k) => {
    out[k] = isFlagEnabled(k);
  });
  return out as Record<FeatureFlagKey, boolean>;
}
