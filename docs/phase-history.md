# MetryxOne — Phase History Archive

Archived build logs for Adaptive Career Intelligence Phases 1–5 (two parallel tracks), Phase 5 Workforce OS, Resume Studio, Scientific Competency, Market Intelligence, AI Governance, Enterprise Workforce OS, Assessment Writers, and Competency Assessment Runtime. Detached from `replit.md` to keep the live README focused on current architecture and conventions.

_Last archived: 2026-05-28. Source: `replit.md` — Phase Index Tables block moved here on 2026-05-24; CAPADEX Concerns Master / Clarity Questions / Signal Ontology Hub / IntroPhase Evolution archived on 2026-05-28; Search & Clarity Routing + Orchestration Context + Competency Curation/Selector internals archived on 2026-05-28._

---

## Phase Index Tables (live snapshot)

Archived from `replit.md` on 2026-05-24 to keep the README scannable. These are the canonical navigation tables for every Adaptive Career Intelligence phase and the Shadow-mode Adaptive Runtime stack. Detailed engine internals for each row live in the per-phase sections further down this file.

### Track A — Adaptive Career Intelligence (Original 5 phases)
| Phase | Namespace | Migration | Deep-link |
|---|---|---|---|
| 1 — Ontology + Workforce Taxonomy | `onto_*` | `20260523_competency_ontology_phase1.sql` | `?screen=ontology-explorer` |
| 2 — Adaptive Benchmarking + Reliability | `bench_*` | `20260524_adaptive_benchmark_phase2.sql` | `?screen=benchmark-dashboard` |
| 3 — Mobility + Pathway + Recommendations | `mobility_*` | `20260525_mobility_phase3.sql` | `?screen=career-mobility` |
| 4 — Longitudinal + Workforce Analytics | `p4_*` | `20260526_intelligence_phase4.sql` | `?screen=trajectory-dashboard`, `?screen=workforce-insights` |
| 5 — Enterprise + Governance + Explainability | `gov_*`, `p5_*` | `20260527_intelligence_phase5.sql` | `?screen=enterprise-intelligence` |
| 5 — Workforce OS (multi-tenant) | `wos_*` | `20260529_workforce_os_phase5.sql` | `?screen=workforce-os` |

### Track B — Scientific / Market / Governance / Enterprise (5 phases)
| Phase | Namespace | Migration | Deep-link |
|---|---|---|---|
| 1 Enhancement — Global Role Ontology | `gro_*` | `20260601_global_ontology_phase1.sql` | — |
| 2 — Scientific Competency Intelligence | `sci_*` | `20260605_scientific_competency_phase2.sql` | `?screen=scientific-competency` |
| 3 — Market Intelligence + Evidence Graph + Mobility 2.0 | `m3_*` | `20260610_market_intelligence_phase3.sql` | `?screen=market-intelligence` |
| 4 — AI Governance + Localization + Predictive + Simulation | `m4_*` | `20260615_ai_governance_phase4.sql` | `?screen=ai-governance` |
| 5 — Enterprise Workforce + AI Coaching + Executive Decision | `m5_*` | `20260620_enterprise_workforce_phase5.sql` | `?screen=enterprise-workforce-os` |

### Runtime + Bridge layers (deployment order)
Assessment Writers (bridge, `20260621`) · Competency Assessment Runtime (lazy DDL) · Competency Runtime V2 (`20260630`) · Adaptive Assessment Runtime V2 (`20260705`) · Contextual Scoring & Intelligent Benchmarking V2 (`20260710`) · Workforce OS V2 predictive depth (`20260715`) · Adaptive Orchestration V2 event-driven (`20260715`) · Competency Taxonomy Expansion 299 competencies (`20260920`) · AI Inference V2 heuristic (`20260720`) · Competency Runtime V2 Core gap-fill (`20260825`) · Adaptive Runtime V2 Phase 2 gap-fill (`20260830`) · Enterprise Adaptive Intelligence Phase 3 gap-fill (`20260905`) · Phase 6 Predictive Intelligence V2 (`20260725`) · Phase 7 Governance Science V2 (`20260730`) · Phase 8 Enterprise Workforce OS V2 (`20260805`) · Phase 5 WOS Hardening audit gap closure (`20260810`).

### Shadow-mode Adaptive Runtime stack (UCIP → Phase 5)
All 5 layers flag-gated, append-only, never mutate upstream tables. As of 2026-05-23, all 16 umbrella flags default ON; writes carry `shadow_mode=true` until authority is transitioned via `POST /api/v2/adaptive-runtime/authority/transition` (admin-only).

| Phase | API base | Migration |
|---|---|---|
| 1 — UCIP Foundation (engine v1.4.0) | `/api/v2/ucip/*` | `20261001_ucip_foundation.sql` |
| 2 — Role DNA Runtime | `/api/v2/role-dna/*` | `20261005_role_dna_runtime.sql` |
| 3 — Competency Graph + Adaptive Blueprint | `/api/v2/competency-graph/*` | `20261010_competency_graph_runtime.sql` |
| 4 — Dynamic Question Generation + Cognitive Runtime | `/api/v2/dynamic-assessment/*` | `20261015_dynamic_assessment_runtime.sql` (+`20261016_..._fks.sql`) |
| 5 — Intelligence Fusion + Contextual Scoring + Runtime Authority | `/api/v2/adaptive-runtime/*` | `20261020_adaptive_runtime_authority.sql` |

### Assessment → Adaptive Intelligence orchestration wiring (2026-05-23)
`POST /api/career/assessment/snapshot` (`backend/routes/assessment-writer.ts`) fires `fanOutAdaptiveOrchestration()` after the writer succeeds — non-blocking, flag-gated, errors logged only. Phase 1–4 via `orchestrateAssessmentCompletion()` (rebuilds UCIP, refreshes competency graph). Phase 5 via `runAdaptiveRuntime(stage:'shadow')` (fusion → calibration → contextual scoring → memory → narratives). All Phase 5 writes `shadow_mode=true`.

---

## Adaptive Career Intelligence — Phase 1 (Ontology + Workforce Taxonomy)

**Read-only scientific foundation. Existing `competency_*`, `role_families`, peer-benchmark, and k-anonymity systems are UNTOUCHED — new tables are namespaced `onto_*`.**

### DB
- **Migrations**: `backend/migrations/20260523_competency_ontology_phase1.sql` (19 `onto_*` tables) + `_seed.sql` (5 domains, 10 families, 13 competencies, aliases, indicators, 5-level proficiency, 4 layers, 8 complexity rows, 2 industries, 5 roles, 5 DNAs, 35 weights, 2 capability models) + `_phase1_fix.sql` (composite FK `onto_competencies(family_id, domain_id) → onto_families(id, domain_id)` enforcing competency.domain == family.domain)
- **Tables**: `onto_domains`, `onto_families`, `onto_competencies`, `onto_competency_aliases`, `onto_behavioral_indicators`, `onto_proficiency_levels`, `onto_organisational_layers`, `onto_complexity_models`, `onto_competency_relationships`, `onto_industries`, `onto_functions`, `onto_subfunctions`, `onto_role_families`, `onto_roles`, `onto_role_dna_profiles`, `onto_role_competency_weights`, `onto_capability_models`, `onto_competency_versions`, `onto_audit_logs`

### Backend
- **Service**: `backend/services/competency-ontology.ts` (read-only, raw pg Pool)
- **Routes**: `backend/routes/competency-ontology.ts` — 14 GET endpoints under `/api/ontology/*` (`domains`, `families`, `competencies`, `competencies/:id`, `competencies/resolve/:name`, `proficiency-levels`, `layers`, `industries`, `functions`, `subfunctions`, `role-families`, `roles`, `roles/:id/dna`, `relationships`, `capability-models`, `methodology`)
- **Registered**: `backend/routes.ts` line 36 (import) + ~12819 (register via `registerCompetencyOntologyRoutes`)
- **Versioning constant**: `ONTOLOGY_VERSION = '1.0.0'`

### Frontend
- **Explorer**: `frontend/src/pages/OntologyExplorerPage.tsx` — 5 tabs (Domains&Families | Competencies+detail modal | Workforce Taxonomy tree | Role DNA visualiser | Layers&Proficiency)
- **Wired**: `App.tsx` lazy import + `'ontology-explorer'` in Screen union + render branch + `isValidScreen` allowlist
- **Deep-link**: `?screen=ontology-explorer`

### Phase 2 (deferred)
Mapping behavioural signals → competency vectors, writing scoring, calibration, version writers, audit-log writers.

---

## Adaptive Career Intelligence — Phase 2 (Adaptive Benchmarking + Reliability)

**Read-only against ontology. New tables namespaced `bench_*`. Empirical percentile only — NO Gaussian. k-anonymity preserved (k_min=30, aggregate-only responses).**

### DB
- **Migrations**: `backend/migrations/20260524_adaptive_benchmark_phase2.sql` (10 `bench_*` tables) + `_seed.sql` (deterministic Box-Muller via `setseed(0.4242)`)
- **Tables**: `bench_cohorts`, `bench_competency_benchmarks` (with `sorted_samples` for empirical lookup), `bench_cohort_statistics`, `bench_role_alignment_scores`, `bench_confidence`, `bench_psychometric_reliability`, `bench_assessment_quality_metrics`, `bench_percentile_distributions`, `bench_versions`, `bench_audit_logs`
- **Seeded**: 15 cohorts (1 global=A / 2 industry=B / 3 function=B / 5 role=C / 4 layer=C), 195 benchmarks, 195 histograms, 195 confidence rows

### Backend Services
- `backend/services/empirical-percentile.ts` — binary-search empirical pct + Wilson 95% CI + diagnostic z (never used for percentile); `confidenceTier(n)` → A=1000/B=300/C=100/D=30/provisional
- `backend/services/weighting-engine.ts` — context-aware dynamic weights: `computeWeights(pool, roleId, ctx)` reads `onto_role_weights` (column `dna_profile_id`) joined to `onto_dna_profiles` (`is_current`); modifier policies for layer/seniority/maturity/team_scale/industry/geography; L1-normalised; `WEIGHTING_VERSION='2.0.0'`
- `backend/services/reliability-engine.ts` — pure `computeReliability(sessionId, responses)`: composite of consistency 0.40 + reverse 0.20 + (1-contradictions) 0.20 + completion 0.15 + (1-anomalies) 0.05; quality tiers A≥0.85 / B≥0.70 / C≥0.50 / D; ships `demoResponses(sessionId)` so the endpoint works without upstream item store
- `backend/services/adaptive-benchmark.ts` — orchestrator: `resolveCohort`, `benchmarkCompetency`, `benchmarkRole`, `benchmarkFamilyOrDomain`, `buildExplainability`, `auditLog`, `demoUserScores`; 60s in-process cache; `BENCH_METHODOLOGY_VERSION='2.0.0'`

### Backend Routes (`backend/routes/adaptive-benchmark.ts`)
Registered in `backend/routes.ts` line 37 (import) + ~12821 (`registerAdaptiveBenchmarkRoutes({ app, pool: concernsPool })`).
8 GET endpoints under `/api/benchmark/*`:
- `role` — role alignment + weighted percentile + per-competency breakdown
- `competency` — single competency vs cohort (empirical pct + 95% CI + z-diagnostic)
- `family` / `domain` — aggregate empirical percentile across competencies
- `layer` — competency vector vs organisational-layer cohort
- `aspirational` — gap analysis vs target role expected_level anchors (1→5 = 30/50/65/80/92)
- `confidence` — cohort × competency tier rows + tier summary
- `reliability` — psychometric reliability + quality tier from `demoResponses`

All accept `?demo=true` (server-generated deterministic scores) or `?scores={...}` (inline JSON). Context modifiers: `?industry_id=&function_id=&layer_id=&seniority=&org_maturity=&team_scale=&geography=`. Full audit logging via `bench_audit_logs` (k_check_passed stamped).

### Frontend
- **Dashboard**: `frontend/src/pages/BenchmarkDashboardPage.tsx` — 6 panels (Role alignment + SVG radar | Cohort & confidence | Competency deep-dive + percentile distribution | Reliability bars | Aspirational gap analysis | Weighting modifiers table)
- **Wired**: `App.tsx` lazy import + `'benchmark-dashboard'` in Screen union + render branch + `isValidScreen` allowlist
- **Deep-link**: `?screen=benchmark-dashboard`

### Versions
`BENCH_METHODOLOGY_VERSION='2.0.0'`, `WEIGHTING_VERSION='2.0.0'`, `ONTOLOGY_VERSION='1.0.0'`

---

## Adaptive Career Intelligence — Phase 3 (Mobility + Pathway + Recommendations)

**Read-only against Phase 1 (`onto_*`) + Phase 2 (`bench_*`). New tables namespaced `mobility_*`. Language policy: developmental readiness · capability proximity · alignment indicators · development opportunity. NEVER asserts hiring outcomes, candidate suitability, or promotion likelihood.**

### DB
- **Migrations**: `backend/migrations/20260525_mobility_phase3.sql` (10 `mobility_*` tables + `mobility_audit_logs`) + `_seed.sql` (derived transferability + adjacency from ontology; 5 canonical pathways with 15 learning steps; 8 role transitions; 65 maturity rows)
- **Tables**: `mobility_career_paths`, `mobility_role_transitions`, `mobility_transferability_maps`, `mobility_competency_gaps`, `mobility_development_pathways`, `mobility_capability_maturity` (5-level per competency), `mobility_role_mobility_scores`, `mobility_learning_sequences`, `mobility_aspiration_profiles`, `mobility_adjacent_role_mappings`, `mobility_audit_logs`
- **Seed counts**: 169 transferability rows, 65 maturity rows, 8 transitions, 20 adjacencies, 5 pathways, 15 learning steps, 3 career paths

### Backend Services
- `backend/services/mobility-engine.ts` — `compareRoles()` (weighted Role-DNA overlap + per-competency transferability lookup + categorised gaps + composite mobility = 0.40·overlap + 0.35·transferability + 0.25·gap-coverage); `adjacentRoles()`; `mobilityGraph()` (scores all targets reachable from a role); 60s cache; `MOBILITY_VERSION='3.0.0'`
- `backend/services/pathway-engine.ts` — `listPathways()`, `personalisedPathway()` (projects each learning step against user's current maturity level), `suggestPathways()` (ranks pathways by overlap with development priorities); `PATHWAY_VERSION='3.0.0'`
- `backend/services/recommendation-engine.ts` — `generateRecommendations()` emits 5 categories (`competency_development`, `leadership_growth`, `role_progression`, `transferable_strength`, `pathway_sequencing`, `adjacent_opportunity`) with priority ranking + alignment indicators + developmental actions; `fullMobilityReport()` bundles comparison + suggested pathways + top-pathway detail; `RECOMMENDATION_VERSION='3.0.0'`

### Backend Routes (`backend/routes/mobility.ts`)
Registered in `backend/routes.ts` line 38 (import) + ~12823 (`registerMobilityRoutes({ app, pool: concernsPool })`).
11 GET endpoints under `/api/mobility/*`:
- `roles` — convenience list of ontology roles
- `compare` — current vs target role comparison
- `graph` — mobility scores across all reachable target roles
- `adjacent` — adjacency-scored neighbour roles
- `transitions` — directed canonical transition metadata
- `transferability` — competency × competency transferability rows
- `pathways` — list curated developmental pathways
- `pathway/:id` — personalised pathway projection
- `maturity/:competency` — 5-level capability maturity model
- `recommendations` — ranked developmental recommendations
- `report` — full bundle (comparison + recommendations + suggested pathways + top-pathway detail)

All accept `?demo=true&session_id=…` (deterministic per-session scores via `demoUserScores`) or `?scores={...}` (inline JSON). Audit logging via `mobility_audit_logs` on all write-shaped events.

### Frontend
- **Dashboard**: `frontend/src/pages/CareerMobilityPage.tsx` — 9 panels (readiness composite | current-vs-target SVG radar | transferable strengths | capability heatmap with anchor markers | gap categories | development roadmap with progress + maturity levels | mobility graph cards across all reachable roles | adjacent role explorer | personalised recommendations grouped by priority)
- **Wired**: `App.tsx` lazy import + `'career-mobility'` in Screen union + render branch + `isValidScreen` allowlist
- **Deep-link**: `?screen=career-mobility`

### Versions
`MOBILITY_VERSION='3.0.0'`, `PATHWAY_VERSION='3.0.0'`, `RECOMMENDATION_VERSION='3.0.0'`

---

## Adaptive Career Intelligence — Phase 4 (Longitudinal + Workforce Analytics)

**Read-only against Phases 1–3. New tables namespaced `p4_*`. Append-only history; all projections are conservative bands with confidence tiers (A/B/C/D/provisional) — NEVER hiring/promotion predictions.**

### DB
- **Migrations**: `backend/migrations/20260526_intelligence_phase4.sql` + `_seed.sql`
- **Tables**: `p4_competency_history` (append-only), `p4_benchmark_trends`, `p4_organizational_heatmaps`, `p4_workforce_analytics`, `p4_trajectory_models`, `p4_audit_logs`
- **Seed counts**: 390 history points (5 demo users × ~13 comps × 6 months), 1170 trend rows, 52 heatmap cells, 5 workforce metrics, 3 trajectory models

### Backend
- **Services**: `backend/services/longitudinal-engine.ts` (history/velocity/trajectory/maturity; EWMA momentum α=0.30; conservative projection bands widened by (1 - consistency)); `backend/services/workforce-analytics.ts` (heatmap/metrics/distribution/leadership pipeline)
- **Routes**: `backend/routes/longitudinal.ts` (`/api/longitudinal/*`: history, velocity, trajectory, maturity, trends), `backend/routes/workforce-analytics.ts` (`/api/workforce/*`: heatmap, metrics, distribution, pipeline)
- **Registered**: `backend/routes.ts` lines 39–40 (imports) + ~12828–12829 (register)
- Maturity heuristic: score→level 1–5 at thresholds 50/65/80/92

### Frontend
- **Trajectory Dashboard**: `frontend/src/pages/TrajectoryDashboardPage.tsx` — velocity table · projection bands (baseline/current markers, range = trajectory_type color) · maturity ladder · sparklines
- **Workforce Insights**: `frontend/src/pages/WorkforceInsightsPage.tsx` — capability heatmap (layers × competencies, intensity coloured) · leadership pipeline stacked bars · capability distribution table
- **Wired**: `App.tsx` lazy imports + `'trajectory-dashboard'` / `'workforce-insights'` in Screen union + isValidScreen + render branches
- **Deep-links**: `?screen=trajectory-dashboard` (defaults to demo_user_alpha), `?screen=workforce-insights`

### Versions
`LONGITUDINAL_VERSION='4.0.0'`, `TRAJECTORY_VERSION='4.0.0'`, `WORKFORCE_ANALYTICS_VERSION='4.0.0'`

---

## Adaptive Career Intelligence — Phase 5 (Enterprise + Governance + Explainability + Security)

**Governance, methodology versioning, per-score explainability envelope, enterprise workforce intelligence, security hardening. New tables namespaced `gov_*` and `p5_*`. Language policy enforced in every API envelope.**

### DB
- **Migrations**: `backend/migrations/20260527_intelligence_phase5.sql` + `_seed.sql`
- **Tables (gov)**: `gov_workflows`, `gov_ontology_reviews`, `gov_methodology_versions`, `gov_audit_framework`, `gov_explainability_logs`, `gov_rate_limit_buckets`
- **Tables (p5)**: `p5_workforce_intelligence`, `p5_succession_models`, `p5_organizational_capabilities`, `p5_enterprise_analytics`
- **Seed counts**: 5 workflows, 7 methodologies (1.0–4.0), 2 sample reviews (pending), 9 workforce-intel rows, 15 succession rows, 52 capability rows, 1 enterprise overview

### Backend Services
- `backend/services/explainability-engine.ts` — `wrap()` attaches `_explainability` envelope (contributors · weighting policy · methodology versions · cohort · freshness · rationale · language_policy allowed/disallowed); `decomposeWeightedComposite`, `currentMethodologies(pool)`, `logExplanation`, `buildRationale`
- `backend/services/governance-engine.ts` — `listWorkflows`, `listReviews`, `proposeReview`, `decideReview`, `listMethodologies`, `auditFramework` (never throws)
- `backend/services/enterprise-intelligence.ts` — workforce intelligence rollups, succession readiness (developmental bands only), org capabilities, strategic capability gap derivation, enterprise overview snapshot
- `backend/services/security-middleware.ts` — in-process `rateLimit({max,pool})`, `requestId()`, `antiEnumDelay()`, `requireConsent()` scaffold (DPDP/GDPR aligned)

### Backend Routes
Registered in `backend/routes.ts` lines 41–42 (imports) + ~12830–12831 (register).
- **`/api/gov/*`** (`governance-workflow.ts`): `workflows`, `reviews` (GET) + `reviews/propose` (POST) + `reviews/:id/decide` (POST), `methodologies?current=true`, `audit?domain=…`, `explainability/recent`
- **`/api/enterprise/*`** (`enterprise-intelligence.ts`): `overview`, `workforce-intelligence`, `succession?target_role_id=&user_id=`, `capabilities`, `strategic-gaps`

Every response wraps the payload with `_explainability` (methodology versions, rationale, language_policy block).

### Frontend
- **Enterprise Intelligence**: `frontend/src/pages/EnterpriseIntelligencePage.tsx` — overview stats · enterprise metrics · capability density per layer · succession cards (developmental bands) · strategic gaps · methodology version chips
- **Governance Console**: `frontend/src/pages/GovernanceConsolePage.tsx` — 5 tabs (Workflows | Reviews with Approve/Reject buttons | Methodologies | Audit | Explainability log)
- **Wired**: `App.tsx` lazy imports + Screen union + isValidScreen + render branches
- **Deep-links**: `?screen=enterprise-intelligence`, `?screen=governance-console`

### Language Policy (enforced in every Phase 5 envelope)
- **Allowed**: developmental readiness · capability proximity · alignment indicator · development opportunity · capability evolution · trajectory indicator
- **Disallowed**: hiring prediction · promotion guarantee · employment prediction · suitable candidate · likely to get hired

### Versions
`EXPLAINABILITY_VERSION='5.0.0'`, `GOVERNANCE_VERSION='5.0.0'`, `ENTERPRISE_VERSION='5.0.0'`

---

## Micro-Accurate Stage Guidance — Phase 1

**Replaces static `STAGE_GUIDANCE` heuristic in `StageGuidancePanel` with evidence-driven panel. Read-only orchestrator over Phase 1–4 services. Language policy: developmental only.**

### Backend
- **Orchestrator**: `backend/services/stage-guidance-orchestrator.ts` — `buildStageGuidance()` parallel-fans to `benchmarkRole` + `getUserVelocity` + `computeReliability(demoResponses)` + `adjacentRoles` + `batchP50ForCohort` + `batchBehaviouralIndicators` (`onto_indicators`). Exports `rankingScore()` (testable).
- **Ranking formula**: `(projected_ei_lift / max(effort_h, 0.5)) × velocity_mult × confidence_mult`
  - `projected_ei_lift = gap_pts × competency_weight` (already weighted; role-DNA weight is embedded **once** to avoid double-weighting)
  - velocity_mult: accelerating 1.4 · stabilizing 1.1 · flat 1.0 · declining 1.6 (Phase 4 `steady→stabilizing`, `plateau→flat` via `normaliseTrend`)
  - confidence_mult: A 1.0 · B 0.9 · C 0.7 · D 0.4
- **Adjacent offramp**: triggers when `totalWeightedGap > 12 pts` AND adjacent role exists AND projects gap saving > 3 pts.
- **LEVEL_ANCHORS** = [0, 30, 50, 65, 80, 92] (mirrors Phase 3 mobility engine).
- **Route**: `backend/routes/career-stage-guidance.ts` — `GET /api/career/stage-guidance` (query: `session_id`, `target_role_id`, `user_id`, `scores`, `demo`, context modifiers). **Never throws** — on any error returns 200 with `{static_fallback_used: true, fallback_reason}`. Default target role auto-resolved from `onto_roles` (first non-deprecated).
- **Strict evidence contract**: orchestrator throws `no_user_scores_available` / `no_response_data_for_reliability` when real data is absent and `demo!==true`. Required sources (benchmark, reliability, adjacent, indicators) all bubble up failures to the fallback envelope. Only optional source: velocity, which is skipped when `user_id` not supplied (no synthetic data inserted).
- **Demo gating**: `?demo=true` is the **only** path that synthesises competency scores (`demoUserScores`) and reliability responses (`demoResponses`). Frontend currently passes `demo:true` as an interim flag until real per-user score/response plumbing reaches `StageGuidancePanel` — drop this when wiring real scores in.
- **Registered**: `backend/routes.ts` line 39 (import) + ~12829 (`registerCareerStageGuidanceRoutes`).
- **Version**: `STAGE_GUIDANCE_VERSION='1.0.0'`.

### Frontend
- **Hook**: `frontend/src/hooks/useStageGuidance.ts` — typed payload, in-flight de-dup, `demo?` flag, telemetry events `guidance.rendered` / `guidance.fallback_used` / `guidance.error` on `window`.
- **Enhanced panel**: `CareerBuilderPage.tsx` `StageGuidancePanel` (~line 1848) — preserved Phase 0 UI shell + Pragati escape hatch; consumes API when payload present and not flagged static; falls back to original `STAGE_GUIDANCE` table on `static_fallback_used:true` / fetch error / empty `ranked_steps`.
- **New UI elements (evidence path)**: target-role chip · low-reliability banner (tier C/D only) · top-3 weighted gap bars with median (gray) + target (green) anchor markers + trend glyphs + 30d velocity · ranked steps with `+EI ±range` chip + confidence pill + ROI score + effort hours + per-step rationale + `why_recommended` bullets + behavioural indicator quote · adjacent offramp card · `How we computed this` explainability drawer (methodology version, cohort tier, evidence sources, ranking formula breakdown, language policy).

### Validated
- Endpoint smoke: `?session_id=demo-frontend&user_id=demo_user_alpha` → 14 ms via Vite proxy. Returns role `role_be_eng`, alignment 67.8, cohort tier C (n=170), reliability tier A, velocities surfaced (`accelerating` + 30d pts).
- Static fallback preserved: any orchestrator failure renders original heuristic guidance with neutral status banner.

---

## Career Builder — Phase 0 Constraints (do not violate)
- `BRAND` const stays inline in `CareerBuilderPage.tsx` (used everywhere with inline styles)
- `CAREER_PATHS` stays as `const CAREER_PATHS = CAREER_DOMAINS[0].paths` (derived from imported catalog)
- `ROLES`, `STAGES`, `INDUSTRIES` stay inline (small, only used inside `AssessmentTab`)
- `DOMAIN_COLORS` uses `BRAND` values — imported from catalog (catalog references `BRAND` from page scope via function arg pattern)
- All scoring formulas bit-for-bit identical to original

---

## Behavioural Intelligence — Phase 2 (Micro-Signals + Evidence + Contradictions + Memory)

**Transforms broad competency guidance into behavioural intelligence. Pure-function services (no model in the loop). Read-only against ontology / benchmarks. New tables namespaced `bsig_*`. Language policy: developmental indicator · behavioural pattern · evidence strength · narrative gap.**

### Services (3 new, pure functions)
- `backend/services/behavioral-signal-engine.ts` — **23 micro-signals across 10 ontology competencies** (`SIGNAL_TAXONOMY`). Each signal carries lexical regex patterns + optional `expects_quantifier` + optional `negative_patterns`. `scoreSignal(key, hits[])` → `{ frequency, confidence, evidence_count, recency_weight, behavioural_strength }` with **180-day half-life recency decay** and `softCount` diminishing returns. `rollupCompetency(competency_id, scores[])` → mean/weakest/strongest. `BSIG_VERSION='2.0.0'`.
- `backend/services/evidence-extractor.ts` — `extractFromSource(EvidenceSource)` walks taxonomy patterns over text and emits `EvidenceHit[]` (snippet + provenance + match_strength). Quantifier bonus + hedge penalty + negative-pattern penalty. `extractAndScore(sources[])` aggregates hits → `SignalScore[]` (sorted desc). `buildSourcesFromProfile({profile, jobs, goals, transcripts, simulations})` normalises 7 source types: `interview_transcript` · `simulation` · `resume` · `project_description` · `goal` · `profile_summary` · `job_note`.
- `backend/services/contradiction-detector.ts` — **6 rules**: `leadership_without_ownership` · `strategy_without_systems_thinking` · `inflated_project_scale` · `inconsistent_timelines` · `quantification_gap` · `hedging_dominant`. Each rule returns `{ rule_id, severity, title, detail, source_ids[], developmental_action }`. Composite `contradiction_score` ∈ [0,1] weight-summed across rules. `CONTRADICTION_VERSION='2.0.0'`.

### Behavioural Memory (persistence)
- `backend/services/behavioural-memory.ts` — `persistBehaviouralSnapshot()` writes one row per signal to `bsig_signal_snapshots` + top-3 evidence to `bsig_evidence` + flagged rules to `bsig_contradiction_history` (single transaction). `getBehaviouralEvolution(userId, windowDays)` → per-signal timelines with **trend** (improving / steady / declining / insufficient based on 30d delta) + **maturity_band** (emerging / developing / consistent / mature).
- **Migration**: `backend/migrations/20260521_behavioural_signals_phase2.sql` — 4 tables (`bsig_signal_snapshots`, `bsig_evidence`, `bsig_contradiction_history`, `bsig_audit_logs`) + indexes.

### Backend Routes (`backend/routes/behavioural-intelligence.ts`)
Registered in `backend/routes.ts` line 46 (import) + ~12837 (`registerBehaviouralIntelligenceRoutes({ app, pool: concernsPool })`).
- `GET  /api/behavioural/taxonomy` — signal definitions (23 signals, pattern counts, taxonomy version)
- `POST /api/behavioural/diagnose` — inline `{ sources: [...] }` → full diagnosis envelope
- `POST /api/behavioural/diagnose/profile` — `{ user_id }` → server-loads career-seeker profile + jobs + goals from `career_seeker_profiles` / `career_seeker_jobs` / `career_seeker_goals`, runs extraction, **best-effort persists snapshot** (non-blocking)
- `GET  /api/behavioural/evolution/:userId?window_days=180` — persisted timelines + trend + maturity_band per signal
- `POST /api/behavioural/snapshot` — manual snapshot persistence
- `POST /api/behavioural/recommendations` — behaviour-driven recommendations (weakest signals + contradiction flags translated to developmental actions, e.g. *"Strengthen quantified outcomes — narrative contains 0 numeric anchors. Add 3 measurable outcomes."*)

**Auth model**: `/taxonomy`, `/diagnose` (inline), `/recommendations` (inline) are public — they read nothing from DB and persist nothing. `/diagnose/profile`, `/evolution/:userId`, `/snapshot` **require auth** (passport session); `user_id` is bound to `req.user.id` server-side — client-supplied IDs are ignored. `/evolution/:userId` enforces self-only (403 on cross-user reads). All routes **never throw** — errors return 200 with `{ ok:false, fallback:true, fallback_reason }`. **Every envelope** (success / fallback / 401 / 403) carries `language_policy: { allowed, disallowed }` via a single `withPolicy()` helper.

### Frontend
- **Hook**: `frontend/src/hooks/useBehaviouralIntelligence.ts` — accepts `{ sources?, userId? }`; routes to `/diagnose` (inline) or `/diagnose/profile` (server-loaded); typed `SignalScore` + `ContradictionFlag`.
- **UI**: `BehaviouralIntelligenceSection` mounted inside `StageGuidancePanel` (`CareerBuilderPage.tsx` ~line 1993) — only renders on the evidence-driven path (skipped on static fallback):
  - Header: hit count · source count · contradiction badge (color-graded by `contradiction_score`)
  - **Signal confidence bars** (top 6 by behavioural_strength) — clickable to expand evidence snippets with `[source_type]` tag
  - **"Why your gaps exist"** — bottom-3 weakest signals translated to a one-line developmental insight (e.g. *"Quantified outcomes at 12% — no evidence found in your narrative. Add 2–3 concrete examples."*)
  - **Narrative contradictions** — color-coded by severity (low/medium/high), each with detail + italic developmental action
- **Demo sources**: `BI_DEMO_SOURCES` const used when `userId` is absent so the panel always has something to render until per-user profile plumbing is wired.

### Tests
- `backend/tests/behavioural-signals.test.ts` — **16 unit tests** (`node --test` via `tsx`): taxonomy invariants · scoring formula (zero hits / multi-source / duplicate-source) · pattern matching (ownership + quantified outcomes co-fire) · quantifier bonus · hedge penalty · `extractAndScore` end-to-end · `buildSourcesFromProfile` defensiveness · all 4 main contradiction rules · composite score bounded [0,1] · `rollupCompetency`. **Run**: `cd backend && npx tsx --test tests/behavioural-signals.test.ts`. All 16 pass.

### Versions
`BSIG_VERSION='2.0.0'`, `CONTRADICTION_VERSION='2.0.0'`.

### Integration with Phase 1 Stage Guidance
`StageGuidancePanel` shows the behavioural section **below** the adjacent offramp card on the evidence-driven path — Phase 1 ranked steps + Phase 2 behavioural insights are complementary surfaces (Phase 1 = *what to do*, Phase 2 = *why the gap exists*). The orchestrator does not need to call into Phase 2 services to function — degrades cleanly when behavioural sources are unavailable (section returns `null`).

---

## Psychometric Rigor — Phase 3 (Reliability + Bayesian Inference + Stability)

**Quantifies uncertainty across the BIOS pipeline. Read-only against Phase 1/2 (signal taxonomy, contradiction graph, behavioural memory). New tables namespaced `psy_*`. Language policy: probability of mastery · posterior estimate · confidence interval · evidence strength · reliability composite · stability indicator. NEVER hiring prediction · guaranteed outcome · character defect · psychiatric diagnosis.**

### DB
- **Migration**: `backend/migrations/20260522_psychometric_phase3.sql`
- **Tables**: `psy_signal_inferences` (per-signal posterior + CI + reliability breakdown), `psy_competency_inferences` (rollup with shrinkage), `psy_stability_flags` (4 flag families), `psy_audit_logs`

### Backend Services
- `backend/services/evidence-reliability-engine.ts` — 6-component composite (metric_specificity · behavioural_density · external_validation · consistency · recency · contradiction_penalty) ∈ [0,1]; floor at 0.30 → `excluded_evidence_reason`; **zero-evidence short-circuit** returns composite=0 + `excluded='no_evidence'`. `RELIABILITY_VERSION='3.0.0'`
- `backend/services/bayesian-inference-engine.ts` — Beta-Binomial conjugate update with prior Beta(2,2); `nEff = evidence_count × composite_reliability`; **hard exclusion**: signals with `excluded_evidence_reason` collapse to prior (nEff=0, mean=0.5, evidence_strength=0) and contribute **zero weight** to competency rollup (no +0.5 floor). Logit-space normal-approx 95% CI; competency rollup uses pure `evidence_strength` weighting + shrinkage `1/(1+evidenceTotal)`; `wSum<=0` falls back to prior mean+variance. Exports `uncertaintyBand({point_score, evidence_strength, reliability})` → `{lower, upper, uncertainty_pts}` for EI/fitment/transition surfaces. `BAYES_VERSION='3.0.0'`
- `backend/services/stability-analysis-engine.ts` — 4 flag families: `temporary_spike` (z>2 on isolated point), `inconsistency` (sd>0.18 across snapshots), `coaching_contamination` (≥5 signals jump ≥0.20 in ≤7d), `behavioural_instability` (≥3 direction changes). Composite `stability_index` ∈ [0,1]; consumes `MemoryEvolutionSummary` from `behavioural-memory.ts`. `STABILITY_VERSION='3.0.0'`

### Backend Routes (`backend/routes/psychometrics.ts`)
Registered in `backend/routes.ts` line 47 (import) + ~12839 (`registerPsychometricsRigorRoutes`). **Renamed export** to avoid collision with existing `psychometrics-engine.ts`.
5 endpoints under `/api/psychometrics/*`:
- `GET methodology` — exposes all version constants + language policy
- `POST infer` — stateless: body `{scores, reliabilities?, sources?, prior?}` → signal posteriors + competency rollups (no auth, no persistence)
- `POST infer/profile` — **auth required**; session `user_id` is canonical (client `user_id` ignored); persists via single `BEGIN/COMMIT` transaction across `psy_signal_inferences` + `psy_competency_inferences`
- `GET stability?window_days=` — **auth required, self-only**; calls `getBehaviouralEvolution` → `analyseStability`; **atomic batch insert** via `persistStabilityFlags` (single client `BEGIN/COMMIT`, awaited); returns `persisted:boolean`. Persistence failure does NOT 500 — warns + returns `persisted:false`
- `POST uncertainty-band` — point-score → symmetric CI band for EI/fitment/transition

**Envelope contract** (every response including 401/403/fallback): `language_policy{allowed, disallowed}` + `methodology_versions{bsig, contradiction, reliability, bayesian, stability}` + `request_id`. All handlers wrapped — never throws.

### Frontend
- **Hook**: `frontend/src/hooks/useBehaviouralIntelligence.ts` — extended to fetch `/api/psychometrics/infer/profile` + `/stability` in parallel with diagnosis; surfaces `signalPosteriors`, `competencyPosteriors`, `reliabilityByKey`, `excludedSignals`, `stability` (never throws — degrades to `null`)
- **UI**: `frontend/src/pages/CareerBuilderPage.tsx` `BehaviouralIntelligenceSection` (~line 2069) — **CI whiskers** under each signal bar (logit-space 95% CI), **reliability tier pills** (R-A ≥0.85 / R-B ≥0.70 / R-C ≥0.50 / R-D <0.50), **excluded-evidence list** with reason chips, **stability flags card** with severity + developmental_action copy

### Tests (`backend/tests/psychometrics.test.ts` — 25/25 passing)
- 8 reliability (bounds · exclusion · contradiction penalty · zero-evidence short-circuit)
- 9 bayesian (CI containment · monotonicity · prior collapse · competency rollup · uncertaintyBand · excluded-signal posterior collapse · **excluded signals do NOT shift competency rollup**)
- 4 stability (all 4 flag triggers)
- 4 routes (envelope · auth boundary · self-only · transactional persistence with `distinct stability_index = 1`)
- Test harness: ephemeral express on port 0 with auth-stub middleware; synthetic `__psy_*` IDs cleaned up in finally blocks

### Versions
`RELIABILITY_VERSION='3.0.0'`, `BAYES_VERSION='3.0.0'`, `STABILITY_VERSION='3.0.0'`

---

## Adaptive Career Intelligence — Phase 4 (Adaptive Causal Intelligence)

**Self-improving recommendation loop: recommendation → action → behavioural change → competency delta → EI delta → trajectory shift. Composes 4 engines. Read-only against Phases 1–3 ontology/benchmark/mobility. New tables namespaced `learn_*`. Language policy: developmental readiness · capability proximity · expected lift (with confidence band) · ROI signal · sequenced step · transfer cascade — NEVER hiring/promotion/suitability assertions.**

### DB
- **Migration**: `backend/migrations/20260528_adaptive_causal_phase4.sql`
- **Tables**: `learn_interventions`, `learn_intervention_events`, `learn_outcomes`, `learn_effectiveness` (unique expression index `ux_learn_eff_key` on `(intervention_id, COALESCE(competency_id,'_any'), profile_segment)` for ON CONFLICT with nullable competency), `learn_transfer_edges`, `learn_dependencies`, `learn_recommendations`, `learn_audit_logs`
- **Seed counts**: 27 interventions (course/practice/coaching/job_simulation across 13 competencies), 7 transfer edges (derived from `onto_relationships`), 3 dependencies, 36 synthetic outcomes (3 demo users × ~6 completed), 6 effectiveness rollup rows

### Backend Services
- `backend/services/intervention-learning-engine.ts` — `shrunkMean` (prior 0.5, prior weight 5), `confidenceTier` (A≥100/B≥30/C≥10/D≥3/provisional), `rollupEffectiveness` (group → average → ROI = Δ/effort), `recordEvent`, `recordOutcome`, `refreshEffectivenessRollup` (BEGIN/TRUNCATE/INSERT/COMMIT atomic); `INTERVENTION_LEARNING_VERSION='4.0.0'`
- `backend/services/competency-transfer-graph.ts` — `buildGraph`, BFS `cascadeFrom` with cycle protection (visited-set + bounded depth + multiplicative strength propagation, best-path retention), `precursorsOf` via truly-inverted edges (swap source/target, not just maps), 60s in-process cache; `TRANSFER_GRAPH_VERSION='4.0.0'`
- `backend/services/dependency-sequencer.ts` — Kahn topological sort with cycle breaking (locate cycle via incoming-walk DFS, **reverse the cycle** to get forward edges, drop weakest by `dependency_strength`), rebuilds incoming/outgoing maps each iteration from `activeEdges` (avoids Kahn-mutation bug), computes `scaffold_depth`/`is_ready_now`/`blocking_prereqs` per node; exports `scoreToLevel(score)` (thresholds 50/65/80/92 → levels 1–5); `DEPENDENCY_SEQUENCER_VERSION='4.0.0'`
- `backend/services/causal-recommendation-engine.ts` — `generateCausalRecommendations` composes all three: causal_score = roi × velocityMult × confidenceMult × readinessMult × cascadeBonus; velocity boosts (accelerating 1.30 / recovering 1.20 / flat 1.00 / declining 1.40 urgency); confidence multipliers (A 1.00 → provisional 0.40); readiness penalty (0.75 if sequenced-later); cascade bonus up to +30%; CI envelope on expected EI lift widens with low n/low tier; `persistRecommendations` BEGIN/COMMIT atomic batch with rank; `buildAdaptiveGuidance` snapshot (completion signal · momentum · intervention winners · next actions); `CAUSAL_RECOMMENDATION_VERSION='4.0.0'`

### Backend Routes (`backend/routes/adaptive-causal.ts`)
Registered in `backend/routes.ts` line 48 (import) + 12841 (`registerAdaptiveCausalRoutes({ app, pool: concernsPool })`).
11 endpoints under `/api/adaptive/*`:
- `GET /methodology`
- `POST /interventions/event` (auth) — record recommended/viewed/started/completed/dismissed/abandoned
- `POST /interventions/outcome` (auth) — record observed competency/EI delta
- `GET /interventions/effectiveness` — query rollup
- `POST /interventions/refresh` (auth) — rebuild rollup
- `GET /transfer/from/:competency_id` — forward cascade
- `GET /transfer/to/:competency_id` — precursors
- `GET /transfer/edges` — raw edges (paginated)
- `POST /sequence` — sequence candidate competencies via dependency engine
- `GET /recommendations` — causal-ranked recs (auto-persists when authed)
- `GET /guidance` (auth) — adaptive guidance snapshot

Every response wraps with `language_policy` (allowed/disallowed lists) + `methodology_versions` + `request_id`. `safeAsync` wrapper guarantees no thrown response. Demo mode: `?demo=true` uses `demoUserScores`. Inline scores via `?scores={...}` JSON. Audit logging via `learn_audit_logs` never blocks responses.

### Frontend
- **Dashboard**: `frontend/src/pages/AdaptiveCausalPage.tsx` — causal recommendation cards (rank · tier · ready-now/sequenced · CI-bounded EI lift · ROI · effort · transfer cascade bars · per-rec rationale: base_effectiveness/sequencing/cascade/momentum) + intervention effectiveness table
- **Wired**: `App.tsx` lazy import + `'adaptive-causal'` in Screen union + `isValidScreen` allowlist + render branch
- **Deep-link**: `?screen=adaptive-causal`

### Tests (`backend/tests/adaptive-causal.test.ts` — 23/23 passing)
- 3 learning (tier boundaries · shrinkage prior collapse · rollup ROI ranking)
- 5 transfer (multiplicative propagation · sort order · minStrength prune · cycle safety · reverse precursors)
- 4 sequencer (linear topo · readiness · weakest-edge cycle break · scoreToLevel thresholds)
- 2 causal (CI containment + monotonic ranking · declining velocity outranks flat)
- 9 routes (envelope + version contract · auth 401 boundary · authed event persistence · demo recs · atomic batch persistence · cascade endpoint · guidance auth + payload shape)
- Test harness: ephemeral express on port 0 with auth-stub middleware (mirrors psychometrics pattern); synthetic `__phase4_*` IDs cleaned in finally blocks

### Self-Improvement Data Flow
As real users hit `POST /interventions/event` (started → completed) and `POST /interventions/outcome` (observed deltas), `learn_outcomes` accumulates. A periodic or on-demand `POST /interventions/refresh` rebuilds `learn_effectiveness`. The next call to `GET /recommendations` reads the updated rollup → ROI scores shift → causal ranking evolves automatically. Guidance evolves with: completion signal (events table), momentum (velocity input from Phase 4 longitudinal), market drift (target_role_id changes), and effectiveness rollup (intervention winners).

### Versions
`INTERVENTION_LEARNING_VERSION='4.0.0'`, `TRANSFER_GRAPH_VERSION='4.0.0'`, `DEPENDENCY_SEQUENCER_VERSION='4.0.0'`, `CAUSAL_RECOMMENDATION_VERSION='4.0.0'`

---

## Adaptive Career Intelligence — Phase 5 Workforce OS (Multi-Tenant Intelligence Operating System)

**Net-new layer on top of `gov_*` / `p5_*`. 6 domains under `wos_*` namespace. Multi-tenant via `wos_tenants` (3 seeded: school/university/skilling/agency) + `wos_role_assignments`. Developmental language enforced in envelope. All endpoints return `_explainability` style envelope: `language_policy` + `methodology_versions` + `request_id`.**

### DB
- **Migration**: `backend/migrations/20260529_workforce_os_phase5.sql` (13 `wos_*` tables + extensive seed)
- **Tables**: `wos_market_signals`, `wos_skill_obsolescence`, `wos_workforce_risk`, `wos_role_emergence`, `wos_ai_exposure`, `wos_fairness_suites`, `wos_fairness_results`, `wos_disputes`, `wos_human_overrides`, `wos_roles`, `wos_role_assignments`, `wos_learning_roi`, `wos_audit_logs` (+ 3 new tenants appended to existing `tenants`/equiv)
- **Seed**: 5 system roles (`role_platform_admin`, `role_tenant_admin`, `role_workforce_analyst`, `role_governance_reviewer`, `role_end_user`); risk/obsolescence/exposure/emerging-role/macro-trend/fairness/dispute/ROI demo rows for tenant 1

### Backend Services (`backend/services/*-engine.ts`)
- **`market-intelligence-engine.ts`** — `ingestSignals` (per-type metric_value bounds-clamping; clamped count returned + original preserved in `context.original_metric_value` for audit), `querySignals` (parameterised WHERE builder, hardened against placeholder collisions), `aggregateBySignalType`, `macroTrends`. `MARKET_INTELLIGENCE_VERSION='5.0.0'`
- **`predictive-workforce-engine.ts`** — `listObsolescence`, `listWorkforceRisk` (tenant-scoped), `aiExposure`, `listEmergingRoles`, `severityFromScore` (low/medium/high/critical bands). `PREDICTIVE_WORKFORCE_VERSION='5.0.0'`
- **`fairness-monitoring-engine.ts`** — `computeFairness({metric, group_a, group_b, threshold})` — supports `disparate_impact_ratio` (four-fifths), `mean_score_gap`, `selection_rate_gap`; surfaces `insufficient_data` flag when both groups have zero selected candidates rather than asserting fair. `runSuite`, `recordResult`, `surfaceSummary`. `FAIRNESS_MONITORING_VERSION='5.0.0'`
- **`dispute-override-engine.ts`** — `canTransition(from,to)` FSM matrix: `open → in_review → {resolved_upheld | resolved_overturned | withdrawn}` (terminal); `fileDispute`, `transitionDispute` (FOR UPDATE lock; atomic override creation on overturn), `applyOverridesToPayload` (nested field paths, expiry-aware, inactive-filter). `DISPUTE_OVERRIDE_VERSION='5.0.0'`
- **`rbac-tenant-engine.ts`** — `hasPermission(grants, required)` with `:*` wildcard support (`platform:*` matches anything; `enterprise:*` matches `enterprise:read|write|…`); `assignRole`, `revokeAssignment`, `effectivePermissions(userId, tenantId)`, `listRoles`, `listAssignments`. `RBAC_TENANT_VERSION='5.0.0'`
- **`learning-roi-engine.ts`** — `computeRoi({tenant_id, intervention_id, cohort_size, total_program_cost})` returns `completion_rate`, `capability_uplift`, `estimated_capacity_gain_hours`, `estimated_retention_lift_pct` (bounded 0–5%), `roi_index`, `confidence_tier` (A/B/C/D/provisional), `language_note`. `persistRoi`, `listRoi`. `LEARNING_ROI_VERSION='5.0.0'`

### Backend Routes (`backend/routes/workforce-os.ts`)
Registered in `backend/routes.ts` line 49 (import) + ~12843 (`registerWorkforceOsRoutes({ app, pool: concernsPool })`).
- **Envelope**: every response wrapped with `LANGUAGE_POLICY` (allowed/disallowed lists) + `METHODOLOGY_VERSIONS` + `request_id` + `ok` flag.
- **Auth model**: `requireAuth` on all writes; `requirePermission(perm)` middleware (Express) reads user from `req.user`, joins `wos_role_assignments` → `wos_roles`, evaluates `hasPermission` with wildcards.
- **Safety**: `safeAsync` wrapper catches and audits all errors via `wos_audit_logs` (never throws).

~25 endpoints under `/api/wos/*`:
- `methodology` — version envelope
- `tenants` — list
- `dashboard?tenant_id=N` — aggregate snapshot (8 bundles: workforce_risks, top_obsolete_competencies, ai_exposure_top, emerging_roles, fairness_summary, open_disputes, recent_roi, macro_trends). **Tenant id is required** (no silent fallback) — returns 400 if absent.
- `market/signals` (GET, filter by type/role/competency/industry/geography/since_days) | `market/ingest` (POST, perm `market:write`) | `market/aggregate`
- `predictive/risks?tenant_id` | `predictive/obsolescence` | `predictive/exposure` | `predictive/emerging-roles`
- `fairness/suites` (GET/POST) | `fairness/results` | `fairness/run` (POST, perm `fairness:run`) | `fairness/summary`
- `disputes` (GET/POST) | `disputes/:id` | `disputes/:id/transition` (POST, perm `dispute:review`) | `overrides`
- `rbac/roles` | `rbac/assignments` (GET/POST/DELETE, perm `rbac:admin`) | `rbac/effective`
- `roi/snapshots` | `roi/compute` (POST, perm `roi:write`)

### Frontend
- **Workforce OS Console**: `frontend/src/pages/WorkforceOSPage.tsx` — 7-tab page (Overview · Predictive · Market · Fairness · Disputes · RBAC · ROI). Tenant selector populates from `/api/wos/tenants`. Version chips in header. Bottom strip surfaces language policy allowed/disallowed terms. All tables/cards consume the dashboard bundle + per-domain endpoints.
- **Wired**: `App.tsx` lazy import (line 83) + `'workforce-os'` in Screen union + `isValidScreen` allowlist + render branch
- **Deep-link**: `?screen=workforce-os`

### Versions
`MARKET_INTELLIGENCE_VERSION='5.0.0'`, `PREDICTIVE_WORKFORCE_VERSION='5.0.0'`, `FAIRNESS_MONITORING_VERSION='5.0.0'`, `DISPUTE_OVERRIDE_VERSION='5.0.0'`, `RBAC_TENANT_VERSION='5.0.0'`, `LEARNING_ROI_VERSION='5.0.0'`

### Tests
`backend/tests/workforce-os.test.ts` — 20/20 passing. Covers: fairness pure compute (all 3 metrics + edge cases), dispute FSM matrix + override path patching with expiry/inactive filters, RBAC wildcards + DB roundtrip (assign/effective/revoke), predictive severity bands + seed reads, market ingest/query roundtrip, ROI compute bounds, route envelope contract, auth/permission boundaries (401 unauth → 403 no-perm → 200 with role), full dispute workflow (file → invalid transition rejected → in_review → resolved_overturned with override applied), rbac/effective reflecting assigned roles.

---

## Resume Studio — zety-style expansion

**Component**: `frontend/src/components/career/ResumeStudio.tsx` (~1170 lines) — main editor + Design panel + PDF/.doc export
**Modular files**: `frontend/src/components/career/resume/`
- `library.ts` — `THEME_PRESETS` (10), `FONT_FAMILIES` (5), `PAGE_SIZES` (a4/letter), `TEMPLATES` (8), `AI_BULLET_LIBRARY` (12 role groups, keyword-tagged), `ATS_STOPWORDS`, `COVER_LETTER_DEFAULT`, pure fns `tokenizeForATS / topKeywords / atsScore`
- `templates.tsx` — 5 new template previews (`ExecutivePreview`, `CreativePreview`, `TechPreview`, `AcademicPreview`, `TwoColumnPreview`) + `NEW_TEMPLATE_RENDERERS` map. Each accepts `{data, fontFamily, fontScale, pageHmm}`
- `addons.tsx` — `AIBulletPicker` (modal · role-matched bullets · placeholders %x/%n/%m) · `ATSCheckPanel` (JD paste → match score + matched/missing keyword chips) · `CoverLetterStudio` (editor + live A4 preview + PDF export · localStorage `mx-cover-letter-${userId}` · user-switch rehydration)

**ResumeData extensions** (back-compat defaults): `template: TemplateId` (was 3-union), `themeId`, `fontFamilyId`, `fontScale` (0.9/1.0/1.1), `pageSize` ('a4'|'letter')

**Mode toggle**: header `Resume | Cover Letter` — Cover Letter mode mounts `CoverLetterStudio`, Resume mode keeps the existing editor/preview grid

**Design panel** (Sparkles section): 8-template grid + 10-theme presets (sets both `themeId` + `accentColor`) + accent swatches + font-family `<select>` + text-size buttons + page-size buttons

**AI bullet picker**: `Wand2` button on each `BulletEditor` opens `AIBulletPicker` keyed by parent `experience.role` (matched against `AI_BULLET_LIBRARY.keywords`); click any bullet to append

**ATS check panel**: mounted below editor sections; computes empirical keyword match between pasted JD and a flattened `resumeText` blob built from all sections

**Export**:
- **PDF**: `downloadPDF` honours `data.pageSize` — `jsPDF` `format: 'a4'|'letter'` + dimensions sourced from `PAGE_SIZES[pageSize]` (no longer hard-coded)
- **Word (.doc)**: `downloadDOCX` wraps `previewRef.outerHTML` in Office HTML namespaces and downloads as `application/msword` `.doc` (Word-compatible HTML, not strict OOXML — labelled "Word (.doc)" in UI to avoid mismatch)

**Font scale behaviour**: new templates (executive/creative/tech/academic/two-column) honour `fontScale` via inline `fs()` helper. Legacy 3 templates (modern-sidebar/classic/minimal) honour it via `style={{ zoom: fontScale }}` wrapper (preserves geometry while scaling typography uniformly across hard-coded `text-[Xpx]` classes)

**Spellcheck**: `spellCheck` attribute set on summary, bullet textareas, cover-letter paragraphs — browser-native red-underline checking

---

## Adaptive Career Intelligence — Phase 1 Enhancement (Global Ontology + Role Intelligence)

**Read-only enhancement on top of existing `onto_*` / `bench_*` / `mobility_*` / `p4_*` / `p5_*` / `gov_*`. All new tables namespaced `gro_*` (Global Role Ontology). NEVER mutates existing `onto_*`, `competency_*`, `weighting-engine`, or `explainability-engine`.**

### DB
- **Migration**: `backend/migrations/20260601_global_ontology_phase1.sql` (23 tables + seed)
- **Tables (taxonomy)**: `gro_industry_families`, `gro_industries`, `gro_industry_geographies`, `gro_industry_complexity_profiles`, `gro_industry_aliases`, `gro_function_families`, `gro_business_functions`, `gro_function_aliases`, `gro_function_role_mappings`, `gro_role_layers`, `gro_role_families`, `gro_role_family_paths`, `gro_canonical_roles`, `gro_role_aliases`, `gro_role_hierarchy`
- **Tables (modifiers)**: `gro_industry_modifiers`, `gro_layer_modifiers`, `gro_function_modifiers`, `gro_organizational_complexity_modifiers`, `gro_geography_modifiers`
- **Tables (expectations)**: `gro_role_competency_expectations` (min/median/max + P10/P25/P50/P75/P90/P99 distribution), `gro_role_competency_thresholds`
- **Tables (graph staging — deferred Neo4j migration)**: `gro_competency_relationship_staging`, `gro_role_relationship_staging`
- **Tables (governance)**: `gro_audit_logs`, `gro_versions`
- **Backward-compat**: every `gro_*` row optionally carries `onto_*_id` soft FK; existing `onto_*` readers unaffected
- **Universal hygiene**: every table has `deleted_at` (soft delete), `version`, `provenance` JSONB
- **Seed**: 8 industry families, 15 industries, 11 functions, 5 role layers (IC/LEAD/MGR/STRAT/EXEC), 5 role families, 12 canonical roles (full engineering chain Engineer → Sr → Lead → Architect → EM → CTO), 14 role aliases, 7 industry + 10 layer + 7 function + 7 complexity + 4 geography modifiers, full expectation matrix for engineering chain

### Services (`backend/services/`)
- `global-role-engine.ts` — `listRoles`/`getRole`/`resolveRole` (canonical title → alias → fuzzy), `listHierarchyFor` (recursive parent chain), 60s cache
- `role-layer-engine.ts` — `detectLayer` 2-stage: **(1) canonical role/alias DB lookup → (2) heuristic fallback** (title regex → word-boundary seniority match → years-exp). Returns `basis` tag so caller knows which stage fired. Word-boundary scan prevents "senior" substring breaking "Engineering Manager" detection
- `role-family-engine.ts` — families/paths/functions/industries/geographies reads with tree assembly
- `contextual-weight-engine.ts` — `resolveAll(ctx, competencyIds)` parallelises 5 modifier lookups; missing rows default 1.000; combined clamped to `[0.50, 1.75]`
- `expectation-engine.ts` — `expectationsFor(roleId, ctx)` applies formula **`expected = base × industry × layer × function × geography × complexity`**; emits `multiplier_raw`, `multiplier_clamped`, `score_clamped` transparency flags so saturation at 100 is never silent; `gapVsExpectations` adds severity buckets (`meets/low/medium/high/critical`) + weighted_gap ranking

### Routes (`backend/routes/global-ontology.ts`)
Registered in `backend/routes.ts` (import line 44, register ~line 12839 via `registerGlobalOntologyRoutes({ app, pool: concernsPool })`).
- `/api/global-roles` (paginated) · `/api/global-roles/:id` · `/api/global-roles/resolve/:text` · `/api/global-roles/:id/hierarchy`
- `/api/role-families` · `/api/role-families/:id` · `/api/role-families/:id/paths`
- `/api/role-layers` · `/api/role-layers/detect?role_title=&seniority=&years_exp=` · `/api/role-layers/:code`
- `/api/functions` · `/api/industries` · `/api/industry-families` · `/api/geographies?industry_id=`
- `/api/contextual-expectations/:role_id?industry_id=&layer_id=&function_id=&geography_code=&complexity_level=`
- `/api/contextual-expectations/:role_id/gaps?...&scores={...}`
- `/api/contextual-expectations/_meta/version`

Every response wrapped via `explainability-engine.wrap()` with methodology versions + LANGUAGE_POLICY envelope. Read-domain audit rows written to `gro_audit_logs` (non-blocking).

### Frontend — CAPADEX Profile Phase
`frontend/src/components/assessment/phases/CapadexInsProfilePhase.tsx`:
- Current/Target industry selects sourced from `/api/industries` (Global Ontology), with static `INDUSTRIES` fallback when API unavailable
- New context selectors: **Business Function** (`/api/functions`), **Primary Geography** (`/api/geographies`), **Organisational Complexity** (5-level)
- **Auto-detected Layer badge** — live calls `/api/role-layers/detect` on (currentRole, seniority, yearsExp) change with `AbortController` cleanup; renders pill with detected layer name
- All new fields persisted to `sessionStorage.metryx_ins_profile` for downstream consumption by expectation engine

### Versions
`GLOBAL_ONTOLOGY_VERSION='1.0.0'`, `GLOBAL_ROLE_ENGINE_VERSION='1.0.0'`, `ROLE_LAYER_ENGINE_VERSION='1.0.0'`, `ROLE_FAMILY_ENGINE_VERSION='1.0.0'`, `EXPECTATION_ENGINE_VERSION='1.0.0'`

### Deferred (out of Phase 1 scope per spec)
- Neo4j graph migration (staging tables ready, no migration yet)
- `ALTER TABLE competencies` additive columns are guarded by `IF EXISTS` and only fire if a top-level `competencies` table is present
- Frontend visualization page for ontology tree (defer to follow-up)

---

## Adaptive Career Intelligence — Phase 2 (Scientific Competency Intelligence Engine)

**Enhancement-only. All net-new tables namespaced `sci_*` to preserve existing `competency_*`, `onto_*`, `psychometric_*`, `student_competency_scores`, plus `scoring.ts` / `roleFitness.ts` / `gapAnalysis.ts` / `reliability-engine.ts` / `evidence-reliability-engine.ts` / `psychometric-calibration.ts` / `explainability-engine.ts`. Soft FK to ontology via nullable `ontology_competency_id` / `competency_id` columns. NEVER asserts hiring outcomes, promotion likelihood, or candidate suitability.**

### DB
- **Migration**: `backend/migrations/20260605_scientific_competency_phase2.sql` (26 `sci_*` tables + seed — bars / frameworks / graph / psychometrics / adaptive / confidence / governance groupings below)
- **BARS**: `sci_competency_bars`, `sci_bars_behavioral_anchors`, `sci_bars_evidence_examples`, `sci_bars_calibration_versions`
- **Frameworks**: `sci_functional_frameworks`, `sci_framework_domains`, `sci_framework_competencies`, `sci_framework_role_mappings`, `sci_framework_aliases`, `sci_framework_versions`
- **Graph**: `sci_competency_relationships`, `sci_competency_dependency_paths`, `sci_competency_influence_weights`, `sci_capability_evolution_paths`
- **Psychometrics**: `sci_psychometric_results`, `sci_reliability_metrics`, `sci_validity_metrics`, `sci_fairness_metrics`, `sci_assessment_calibration_results`
- **Adaptive + Confidence**: `sci_assessment_confidence_scores`, `sci_assessment_uncertainty`, `sci_adaptive_assessment_paths`, `sci_response_behavioral_patterns`, `sci_confidence_snapshots`
- **Governance**: `sci_audit_logs`, `sci_versions`
- **Seed**: 7 functional frameworks (SHRM/SFIA/NICE/CFA/PMI/Pragmatic/SAFe) + 10 framework competencies + 5 aliases + 5 BARS proficiency levels × 5 layers × 5 core competencies (125 anchor rows) + 8 dependency edges + 4 influence weights + canonical EIQ→COM→LEA→STR evolution path

### Services (`backend/services/`)
- `bars-engine.ts` — `getAnchors(comp, layer)`, `resolveAnchor(score)`, `mapScores`, `describeProficiency` (current + next + prior level). 60s cache. `BARS_ENGINE_VERSION='2.0.0'`
- `framework-intelligence.ts` — `listFrameworks`, `getFramework`, `resolveCompetency` (code/name/alias case-insensitive), `mappingsForOntologyCompetency`, `expectationsForRole`, `scoreThroughFramework` (coverage + avg via ontology bridge). `FRAMEWORK_INTELLIGENCE_VERSION='2.0.0'`
- `competency-graph-engine.ts` — Iterative BFS (never recursive SQL); `allEdges` 60s cache, `neighbours(dir)`, `traversePaths(from, to, maxDepth)` with cycle-prevention + cumulative-strength product, `influenceLift`, `sequenceInterventions(target, scores)` (prerequisite/dependency/amplification/acceleration edges only, ranked by gap × strength), `listEvolutionPaths`, `adjacent`. `COMPETENCY_GRAPH_VERSION='2.0.0'`
- `sci-psychometric-engine.ts` — Pure: `cronbachAlpha(matrix)` α = k/(k-1) × (1 − Σ Var(i) / Var(total)); `testRetest` Pearson r; `cohensKappa(a,b)` (Pa−Pe)/(1−Pe); `adverseImpact` four-fifths rule; `constructValidity`; `reliabilityTier` (A≥0.90 / B≥0.80 / C≥0.70 / D≥0.60 / provisional); `fullDiagnostics(seed)` for demo. `SCI_PSYCHOMETRIC_VERSION='2.0.0'`
- `competency-confidence-engine.ts` — `computeConfidence(components, weights?)` = Σ w_i · component_i across (reliability 0.30 + behavioural_consistency 0.20 + evidence_validation 0.20 + historical_stability 0.15 + benchmark_confidence 0.15); returns `{confidence, reliability_tier, evidence_strength, components, weights}`; `scoreVector` for whole competency map; persists to `sci_confidence_snapshots`. `CONFIDENCE_ENGINE_VERSION='2.0.0'`
- `sci-gap-intelligence.ts` — Typed gaps (behavioural/cognitive/functional/leadership/strategic/readiness); severity buckets (meets/low/medium/high/critical); priority = severity_weight × gap_type_criticality × market_demand × (1 + 0.1 × downstream_unlocks); reads from competency graph for dependency-aware ranking. `SCI_GAP_INTELLIGENCE_VERSION='2.0.0'`

### Routes (`backend/routes/scientific-competency.ts`)
Registered in `backend/routes.ts` line 45 (import) + line 12841 (`registerScientificCompetencyRoutes({ app, pool: concernsPool })`).
Mounted under `/api/sci/*` — every response wrapped via `explainability-engine.wrap()` with `METHOD_VERSIONS` envelope + platform `LANGUAGE_POLICY`. Audit rows non-blocking to `sci_audit_logs`.
- **BARS**: `bars/layers`, `bars/competencies`, `bars/:comp/:layer`, `bars/:comp/:layer/resolve?score=`, `bars/:layer/map?scores={...}`
- **Frameworks**: `frameworks`, `frameworks/:id`, `frameworks/resolve/:text`, `frameworks/mappings/:competency_id`, `frameworks/:id/role/:role_id`, `frameworks/:id/score?scores={...}`
- **Graph**: `graph/edges`, `graph/adjacent/:competency_id`, `graph/paths?from=&to=&max_depth=`, `graph/influence`, `graph/sequence/:target?scores=&max_steps=`, `graph/evolution-paths`
- **Psychometrics**: `psychometrics/demo?seed=` (GET) + POST `psychometrics/cronbach` (responses=2D matrix) + POST `psychometrics/kappa` + POST `psychometrics/adverse-impact` + POST `psychometrics/test-retest` + `psychometrics/assessment/:id`
- **Confidence**: POST `confidence/compute` (components, optional weights) + `confidence/vector?scores={...}&session_id=&persist=true` (persists per-competency snapshots to `sci_confidence_snapshots` when persist=true and a non-demo session_id is supplied) + `confidence/session/:session_id` (read snapshots)
- **Gaps**: `gaps/compute?current={...}&expected={...}`
- **Meta**: `_meta/versions`

### Frontend
- **Page**: `frontend/src/pages/ScientificCompetencyPage.tsx` — 6 panels (BARS · Frameworks · Dependency Graph · Psychometrics · Confidence · Gaps); does NOT modify existing `CompetencyDashboard.tsx`
- **Wired**: `App.tsx` lazy import (line 88) + `'scientific-competency'` in Screen union + `isValidScreen` allowlist + render branch
- **Deep-link**: `?screen=scientific-competency`

### Versions
`BARS_ENGINE_VERSION='2.0.0'`, `FRAMEWORK_INTELLIGENCE_VERSION='2.0.0'`, `COMPETENCY_GRAPH_VERSION='2.0.0'`, `SCI_PSYCHOMETRIC_VERSION='2.0.0'`, `CONFIDENCE_ENGINE_VERSION='2.0.0'`, `SCI_GAP_INTELLIGENCE_VERSION='2.0.0'`

### Deferred (out of Phase 2 scope per spec / disabled this session)
- Tests (test runner disabled)
- Inline enhancement of `CapadexQPhase.tsx` adaptive sequencing (sci_adaptive_assessment_paths table seeded but not consumed by question loop — endpoint exists; downstream wiring is a follow-up)
- Augmenting existing `CompetencyDashboard.tsx` with BARS/confidence overlays (new page is additive; legacy dashboard untouched per "preserve existing UI" constraint)

---

## Adaptive Career Intelligence — Phase 3 (Market Intelligence + Evidence Graph + Mobility 2.0)

**Read-only against `onto_*` / `bench_*` / `sci_*`. New tables namespaced `m3_*`. Append-only history. Dynamic ontology proposes events but NEVER mutates `onto_*` automatically — promotion is a manual governance step. Language policy: market signals, developmental readiness, capability evidence — NEVER hiring/promotion predictions.**

### DB
- **Migration**: `backend/migrations/20260610_market_intelligence_phase3.sql` (27 `m3_*` tables + seed)
- **Tables**: `m3_source_registry`, `m3_market_roles`, `m3_market_role_aliases`, `m3_market_competencies`, `m3_skill_demand`, `m3_salary_trends`, `m3_role_trends`, `m3_emerging_competencies`, `m3_industry_demand`, `m3_geography_demand`, `m3_canonical_role_mappings`, `m3_role_similarity_vectors`, `m3_role_normalization_history`, `m3_semantic_role_clusters`, `m3_competency_market_scores`, `m3_role_market_scores`, `m3_future_skill_forecasts`, `m3_market_velocity_scores`, `m3_evidence_sources`, `m3_evidence_nodes`, `m3_evidence_relationships`, `m3_capability_evidence_links`, `m3_evidence_confidence_scores`, `m3_role_adjacency`, `m3_career_paths`, `m3_transition_probability`, `m3_mobility_clusters`, `m3_capability_adjacency_scores`, `m3_ontology_evolution_events`, `m3_emerging_role_candidates`, `m3_emerging_skill_candidates`, `m3_deprecated_competencies`, `m3_ontology_change_audits`, `m3_audit_logs`
- **Seed**: 7 sources, 5 market roles, 10 aliases, 10 market competencies, demand/salary/trends rows, 5 role adjacencies, 3 career paths, 3 emerging roles + 3 emerging skills, 9 evidence sources, 6 demo evidence nodes for `demo_user`
- Note: `m3_market_roles.embedding` and `m3_market_competencies.embedding` are backfilled at deploy time using the same djb2 16-dim hash function as `m3-role-normalization.embed()` so cosine matching operates in one consistent vector space (pgvector-ready). `m3_competency_market_scores.market_demand` rows are recomputed from the canonical formula so seeded composites and runtime composites stay aligned.

### Backend Services (all v3.0.0)
- `backend/services/m3-market-intelligence.ts` — sources/roles/competencies/demand/salary/trends/emerging readers + `ingestPosting()` (resolves via exact→alias; unmatched titles become emerging-role candidates)
- `backend/services/m3-role-normalization.ts` — deterministic 16-dim djb2 hash pseudo-embedding + cosine. `resolveTitle()` runs **exact → alias → embedding ≥0.55 → unresolved (emerging candidate)** and logs every resolution to `m3_role_normalization_history`
- `backend/services/m3-market-demand.ts` — composite **Market Demand = 0.30·hiring + 0.20·salary + 0.20·industry + 0.25·future − 0.15·automation**, clipped 0..100; `recomputeCompetency()` persists new rows
- `backend/services/m3-evidence-graph.ts` — `addEvidence()` writes node + capability link with `weight = observed_strength × source.trust_weight`, then `refreshConfidence()` upserts `m3_evidence_confidence_scores` (verification_level: weak/moderate/strong/verified)
- `backend/services/m3-dynamic-ontology.ts` — emerging-roles/skills readers; `proposeEvent()` writes to `m3_ontology_evolution_events` + audit; `reviewCandidate(kind, id, status)` flips candidate status. **Never touches `onto_*` directly**
- `backend/services/m3-career-mobility.ts` — `scoreMobility = 0.40·capability_sim + 0.25·market_adj + 0.20·experience + 0.15·learning`; `adjacent()`, `pathsTo()` (BFS depth-capped, per-walk cycle-safe), `recommend()` (readiness: ready ≥0.75 / developing ≥0.55 / aspirational)
- `backend/services/m3-confidence-v2.ts` — confidence v2 = **0.25·assessment_reliability + 0.25·evidence_strength + 0.15·historical_consistency + 0.20·market_validation + 0.15·benchmark_stability**; market_validation sourced via `DISTINCT ON` for the latest row per competency. Wraps Phase 2 confidence model — does NOT replace it

### Backend Routes (`backend/routes/m3-market-intelligence.ts`)
Registered in `backend/routes.ts` line 46 (import) + ~12843 (`registerMarketIntelligencePhase3Routes({ app, pool: concernsPool })`). All responses wrapped via `explainability-engine.wrap()` with `methodology.versions` for all 7 engines.
- **Market**: `GET /api/m3/sources`, `/market-roles`, `/market-competencies`, `/skill-demand`, `/salary-trends`, `/role-trends`, `/emerging`, `/industry-demand`, `/geography-demand`; `POST /api/m3/ingest`
- **Normalize**: `GET /api/m3/normalize/resolve?title=&session_id=`, `/normalize/similar?title=&k=`, `/normalize/clusters`
- **Demand**: `GET /api/m3/demand/competency[?competency=]`, `/demand/role`, `/demand/forecasts`, `/demand/velocity`; `POST /api/m3/demand/recompute`
- **Evidence**: `GET /api/m3/evidence/sources`, `/evidence/:subject_id[?competency=]`, `/evidence/:subject_id/graph`, `/evidence/:subject_id/confidence`; `POST /api/m3/evidence/add`
- **Dynamic ontology**: `GET /api/m3/dyn/emerging-roles`, `/dyn/emerging-skills`, `/dyn/deprecated`, `/dyn/events`; `POST /api/m3/dyn/propose`, `/dyn/review`
- **Mobility**: `GET /api/m3/mobility/adjacent/:role_id`, `/mobility/paths?to=&depth=`, `/mobility/transitions`, `/mobility/career-paths`, `/mobility/capability-adjacency`, `/mobility/recommend?role=&scores={...}`
- **Confidence v2**: `GET /api/m3/confidence/vector?subject_id=&scores={...}`
- **Meta**: `GET /api/m3/_meta/versions`

All mutable endpoints write to `m3_audit_logs` with request_id + ip. Known gap: write endpoints (`/ingest`, `/demand/recompute`, `/evidence/add`, `/dyn/propose`, `/dyn/review`) are not yet gated by `requireAuth`/RBAC — consistent with current Phase 2 routing convention but flagged for follow-up.

### Frontend
- **Page**: `frontend/src/pages/MarketIntelligencePage.tsx` — 6 panels (Market Demand · Role Normalization · Evidence Graph · Career Mobility · Dynamic Ontology · Confidence v2) with live API binding, inline ingest/propose/promote actions, version footer
- **Wired**: `App.tsx` lazy import (line 89) + `'market-intelligence'` in Screen union + `isValidScreen` allowlist + render branch
- **Deep-link**: `?screen=market-intelligence`
- Existing `CompetencyDashboard`, `GapAnalysisPage`, `CareerBuilderPage`, `TrajectoryDashboardPage` are intentionally **NOT modified** — Phase 3 is additive per the "preserve existing UI" constraint

### Forward-compatible deferrals
- **pgvector / Neo4j**: schema uses `REAL[]` columns for embeddings, swap to `vector(16)` once the extension is provisioned. `m3_role_similarity_vectors` is the planned write target for a `graph-sync-engine.ts` / `neo4j-sync-service.ts` mirror — engines are pure-function so swap is local
- **Tests**: skipped this session (test runner disabled)
- **Write-side RBAC**: tracked above

### Versions
`MARKET_INTELLIGENCE_VERSION='3.0.0'`, `ROLE_NORMALIZATION_VERSION='3.0.0'`, `MARKET_DEMAND_VERSION='3.0.0'`, `EVIDENCE_GRAPH_VERSION='3.0.0'`, `DYNAMIC_ONTOLOGY_VERSION='3.0.0'`, `CAREER_MOBILITY_VERSION='3.0.0'`, `CONFIDENCE_V2_VERSION='3.0.0'`

---

## Adaptive Career Intelligence — Phase 4 (AI Governance + Localization + Predictive + Simulation + Org Risk + Observability)

**Enhancement-only. New tables namespaced `m4_*` (distinct from older `p4_*` longitudinal). Soft FK via TEXT cols to onto_*/bench_*/sci_*/m3_*. Existing engines/pages untouched. Language policy: outputs are developmental signals — NEVER hiring/promotion predictions.**

### DB
- **Migration**: `backend/migrations/20260615_ai_governance_phase4.sql` (~40 m4_* tables + ~120 seed rows in single file)
- **Governance**: `m4_ai_governance_policies` (5 policies: LANG_SAFE, FAIRNESS_DEFAULT, EXPLAINABILITY_REQ, SAFETY_NEVER, RISK_TIERING), `m4_ai_model_registry` (7 models w/ versions), `m4_ai_model_versions`, `m4_ai_decision_logs`, `m4_ai_explainability_logs`, `m4_ai_fairness_scores`, `m4_ai_bias_detection_results`, `m4_ai_risk_classifications`, `m4_ai_hallucination_flags`, `m4_ai_audit_events`
- **Fairness**: `m4_fairness_evaluations`, `m4_bias_detection_runs`, `m4_demographic_impact_analysis`, `m4_protected_attribute_checks` (gender=excluded, age=monitored, ethnicity=excluded, region=controlled), `m4_model_fairness_thresholds`
- **Localization**: `m4_countries` (US/IN/JP/DE/AE), `m4_country_workforce_profiles`, `m4_cultural_behavioral_norms` (Hofstede-style: assertiveness, hierarchy), `m4_regional_competency_expectations`, `m4_regional_leadership_models`, `m4_localization_weights`, `m4_regional_language_policies`
- **Predictive**: `m4_capability_trajectories`, `m4_future_readiness_scores`, `m4_promotion_readiness_predictions`, `m4_leadership_potential_predictions`, `m4_skill_decay_forecasts`, `m4_burnout_risk_scores`, `m4_future_capability_gaps`, `m4_trajectory_classifications` (accelerating/stable/plateauing/declining/high_potential/leadership_emerging)
- **Longitudinal (additive)**: `m4_trajectory_events`, `m4_capability_acceleration`, `m4_capability_stagnation`, `m4_longitudinal_forecasts`, `m4_workforce_evolution_history`
- **Simulation**: `m4_simulation_scenarios` (4 seeded: STR+15%, LEA+10%, promotion, pipeline), `m4_simulation_capability_models`, `m4_simulation_results`, `m4_simulation_forecasts`
- **Org Risk**: `m4_organizational_capability_risks`, `m4_succession_risk_scores`, `m4_leadership_gap_predictions`, `m4_workforce_resilience_scores`, `m4_critical_capability_risks`
- **Observability**: `m4_prediction_monitoring`, `m4_forecast_accuracy_tracking` (MAPE+Brier), `m4_model_drift_detection` (PSI), `m4_ai_observability_logs`
- **Audit**: `m4_audit_logs` (engine writes)

### Backend Services (all v4.0.0)
- `backend/services/m4-ai-governance.ts` — policies, model registry/versions, register/rollback, `logDecision()` (writes envelope + auto-runs `checkLanguage()` safe-language gate; forbidden phrases are **redacted to `[REDACTED]`** in persisted rationale AND flagged in `m4_ai_hallucination_flags` per LANG_SAFE policy), decision/hallucination/risk/audit accessors
- `backend/services/m4-fairness.ts` — `computeDemographicParity`, `computeDisparateImpact` (4/5 rule, 0.85 warn / 0.80 fail), `computeEqualOpportunity` (TPR delta); `runFairnessSuite`, `runBiasDetection` with drift delta vs prior eval; `demoSamples(seed, n)` deterministic generator; empty-group safe
- `backend/services/m4-localization.ts` — `cultural_modifier = clip(1 + (norm.score − 50) / 200, 0.7, 1.3)`; `localizedWeights(country, comps)`, `adaptScores(country, scores)` vs regional expected levels (1→5 = 8/30/50/70/92 anchors), language policy lookup
- `backend/services/m4-predictive.ts` — `forecastFutureCapability({current, learning_velocity, experience_momentum, market_exposure, capability_decay, horizon, consistency})` → `current + lv·h + em·h + me·h·0.25 − decay·h`; band widens by `(1−consistency)·h·1.2`; `classifyTrajectory()` heuristic; `burnoutRisk` = `0.50·workload + 0.25·(1−recovery) + 0.25·variance`; null-safe on empty trajectories
- `backend/services/m4-simulation.ts` — `runScenario(scenarioIdOrCode, subjectId, horizonMonths)` applies capability uplift deltas → forecasts per-competency band + composite readiness delta; persists to `m4_simulation_results`; never mutates trajectories
- `backend/services/m4-org-risk.ts` — `computeCapabilityRisk(coverage, velocity)`, `computeSuccessionRisk({successors_n, ready_now, ready_12m, ready_24m})`, `computeResilience({redundancy, mobility, learning_velocity})` = `0.40R + 0.35M + 0.25LV`
- `backend/services/m4-observability.ts` — pure `computePSI`, `computeMAPE`, `computeBrier`; `recordAccuracy`, `recordDrift` (PSI thresholds 0.10 warn / 0.20 fail)

### Backend Routes (`backend/routes/m4-ai-governance.ts`)
Registered in `backend/routes.ts` line 47 (import) + 12845 (`registerM4Routes({ app, pool: concernsPool })`). All responses wrapped via `wrap()` from `explainability-engine.ts` with `METHOD_VERSIONS` envelope. Mutations write to `m4_audit_logs`.
- **`/api/m4/gov/*`** (GET): `policies?category=`, `models`, `risk`, `decisions?subject_id=&model_id=&limit=`, `explainability/:decision_id`, `hallucinations`, `audit?domain=`; (POST): `decision`, `model/version`, `model/rollback`
- **`/api/m4/fair/*`** (GET): `scores`, `bias`, `protected-attributes`, `thresholds/:model_id`; (POST): `run` (full suite), `bias/run`
- **`/api/m4/loc/*`** (GET): `countries`, `profile/:country_id`, `weights/:country_id?competencies=`, `adapt/:country_id?scores={…}`, `language/:country_id`
- **`/api/m4/pred/*`** (GET): `trajectories`, `classify`, `future-readiness?horizon_months=`, `readiness-history`, `promotion`, `leadership-potential`, `skill-decay`, `future-gaps`, `trajectory-classifications`, `burnout?signals={…}`; (POST): `future-readiness/persist`
- **`/api/m4/sim/*`** (GET): `scenarios`, `results?scenario_id=&subject_id=`; (POST): `run`
- **`/api/m4/risk/*`** (GET): `capabilities?org_unit=`, `succession?role_id=`, `leadership-gaps`, `resilience`, `critical`
- **`/api/m4/obs/*`** (GET): `accuracy`, `drift`, `monitoring`, `logs`; (POST): `accuracy/record`, `drift/record`
- **`/api/m4/_meta/versions`** — engine version map

### Frontend
- **Page**: `frontend/src/pages/AIGovernancePage.tsx` — 7 tabs (AI Governance | Fairness & Bias | Localization | Predictive Workforce | Workforce Simulation | Organizational Risk | AI Observability); on-demand "Run Fairness Suite" + "Run Simulation" buttons; country picker drives localization view; deterministic demo_user subject
- **Wired**: `App.tsx` lazy import + `'ai-governance'` in Screen union + `isValidScreen` allowlist + render branch
- **Deep-link**: `?screen=ai-governance`

### Versions
`AI_GOVERNANCE_VERSION='4.0.0'`, `FAIRNESS_VERSION='4.0.0'`, `LOCALIZATION_VERSION='4.0.0'`, `PREDICTIVE_VERSION='4.0.0'`, `TRAJECTORY_VERSION='4.0.0'`, `READINESS_VERSION='4.0.0'`, `BURNOUT_VERSION='4.0.0'`, `CAPABILITY_FORECAST_VERSION='4.0.0'`, `SIMULATION_VERSION='4.0.0'`, `ORG_RISK_VERSION='4.0.0'`, `OBSERVABILITY_VERSION='4.0.0'`

### Notes
- Tests skipped this session (runner disabled)
- Safe-language gate redacts (not blocks) — decisions are logged with `[REDACTED]` rationale + hallucination flag
- Soft FKs to onto_*/bench_*/sci_*/m3_* by design (cross-phase pattern)
- replit.md is getting large — consider trimming older phases at a natural pause

---

## Adaptive Career Intelligence — Phase 5 (Enterprise Workforce + AI Coaching + Executive Decision Intelligence)

**Enhancement-only over Phases 1-4. New tables namespaced `m5_*` (distinct from older `p5_*`/`gov_*`/`wos_*`). Outputs are developmental signals — NEVER hiring/promotion predictions.**

### DB
- **Migration**: `backend/migrations/20260620_enterprise_workforce_phase5.sql` (~36 m5_* tables + ~60 seed rows)
- **Workforce Intelligence**: `m5_organizational_capabilities`, `m5_organizational_capability_maps`, `m5_workforce_capability_heatmaps`, `m5_workforce_maturity_scores`, `m5_organizational_skill_gaps`, `m5_department_capability_scores`, `m5_enterprise_capability_indices`, `m5_workforce_readiness_scores`
- **Succession**: `m5_succession_candidates`, `m5_succession_readiness`, `m5_leadership_successor_paths`, `m5_critical_role_successors`, `m5_leadership_gap_risks`, `m5_bench_strength_scores`
- **AI Coaching**: `m5_career_growth_plans`, `m5_learning_recommendations`, `m5_coaching_interventions`, `m5_mentor_recommendations`, `m5_career_transition_guidance`, `m5_development_journeys`, `m5_capability_growth_goals`
- **Simulation 2.0**: `m5_organizational_simulations`, `m5_capability_uplift_models`, `m5_learning_impact_models`, `m5_leadership_pipeline_simulations`, `m5_future_workforce_forecasts`, `m5_workforce_transformation_scenarios`
- **Executive Decision**: `m5_executive_workforce_insights`, `m5_strategic_workforce_risks`, `m5_future_capability_forecasts`, `m5_enterprise_transformation_readiness`, `m5_workforce_strategy_recommendations`
- **Org Benchmarking**: `m5_organizational_benchmarks`, `m5_industry_workforce_benchmarks`, `m5_enterprise_maturity_benchmarks`, `m5_leadership_benchmarks`
- **Org Graph**: `m5_organizational_graph_nodes`, `m5_organizational_relationships`, `m5_department_relationship_graph`, `m5_leadership_influence_graph`
- **Decision Support**: `m5_executive_recommendations`, `m5_strategy_recommendation_logs`, `m5_organizational_intervention_recommendations`
- **Observability**: `m5_enterprise_observability_logs`, `m5_simulation_accuracy_tracking`, `m5_organizational_forecast_accuracy`, `m5_executive_decision_audits`
- **Audit**: `m5_audit_logs`

### Backend Services (all v5.0.0)
- `backend/services/m5-workforce-intelligence.ts` — `capabilities`, `heatmap`, `maturity` (avg→L1-L5 at 35/50/65/80), `skillGaps`, `departments`, `readiness` (with consistency band), `enterpriseIndices`, `computeECI` (avg of workforce/leadership/future-readiness/agility/resilience)
- `backend/services/m5-succession.ts` — `computeSuccessionReadiness({LC,SR,MA,FP,reliability_confidence})` = `(0.30·LC + 0.25·SR + 0.20·MA + 0.25·FP) × clip(0.7 + 0.3·rel, 0.7, 1.0)`; bands `ready_now ≥ 80 / ready_12m ≥ 65 / ready_24m ≥ 50 / developing`; `candidates`, `criticalRoles`, `leadershipGapRisks`, `benchStrength`, `successionSummary`
- `backend/services/m5-ai-coaching.ts` — `generateGrowthRoadmap({currentScores, targetScores, marketDemand, learningVelocity, reliability, horizonMonths})` → per-competency `priority = gap × (0.5 + 0.5·market) × (1.2 − 0.4·velocity)` + `projected_uplift = gap × (0.30 + 0.40·velocity) × (horizon/12)`; `growthPlan` (persist optional), `learningRecommendations`, `interventions`, `mentorMatches`, `transitionGuidance`
- `backend/services/m5-workforce-simulation.ts` — `runScenario(orgId, scenarioCode, horizon)` applies targeted uplift_pct to capabilities + 2% drift to non-targeted; derives `leadership_lift = composite_delta × 1.2`, `succession_lift × 0.85`, `resilience_lift × 0.65`; learning ROI block when investment supplied; `futureForecast` (18-mo conservative band)
- `backend/services/m5-executive-intelligence.ts` — `insights`, `strategicRisks`, `transformationReadiness`, `strategyRecommendations`, `executiveRecommendations`, `interventionRecommendations`, `logDecision` (writes `m5_executive_decision_audits` + `m5_strategy_recommendation_logs`)
- `backend/services/m5-org-benchmark.ts` — `orgBenchmarks`, `industryBenchmarks`, `leadershipBenchmarks`, `maturityBenchmarks`
- `backend/services/m5-org-graph.ts` — `nodes`, `relationships`, `departmentGraph`, `leadershipInfluence`, `concentrationRisk` (edge-weight contributes to both endpoints; share ≥ 40% flagged fragile)
- `backend/services/m5-enterprise-observability.ts` — `forecastAccuracy`, `simulationAccuracy`, `observabilityLogs`, `recordEvent`, `recordSimulationAccuracy` (MAPE), `driftStatus` (stable/warning/critical rollup)

### Backend Routes (`backend/routes/m5-enterprise-workforce.ts`)
Registered in `backend/routes.ts` line 48 (import) + 12847 (`registerM5Routes({ app, pool: concernsPool })`). All responses wrapped via `wrap()` from `explainability-engine.ts` with `METHOD_VERSIONS` envelope. Mutations write to `m5_audit_logs` and `m5_enterprise_observability_logs`.
- **`/api/m5/wfi/*`** (GET): `capabilities`, `heatmap`, `maturity`, `skill-gaps`, `departments`, `readiness`, `indices`, `eci`
- **`/api/m5/succ/*`** (GET): `candidates?target_role_id=`, `critical-roles`, `gap-risks`, `bench-strength`, `summary`, `score?lc=&sr=&ma=&fp=&rc=`
- **`/api/m5/coach/*`** (GET): `growth-plan`, `learning`, `interventions`, `mentors`, `transition`; (POST): `growth-plan/persist`
- **`/api/m5/sim/*`** (GET): `scenarios`, `transformation`, `future-forecast?horizon_months=`; (POST): `run`
- **`/api/m5/exec/*`** (GET): `insights`, `strategic-risks`, `transformation-readiness`, `strategy-recommendations`, `recommendations?category=`, `interventions`, `audits`; (POST): `log-decision`
- **`/api/m5/bench/*`** (GET): `org?peer_cohort=`, `industry?industry=`, `leadership?industry=`, `maturity?industry=`
- **`/api/m5/graph/*`** (GET): `nodes`, `relationships`, `departments`, `leadership-influence`, `concentration-risk`
- **`/api/m5/obs/*`** (GET): `forecast-accuracy`, `simulation-accuracy?simulation_id=`, `drift`, `logs?event_type=&limit=`; (POST): `event`
- **`/api/m5/_meta/versions`** — engine version map

### Frontend
- **Page**: `frontend/src/pages/EnterpriseWorkforceOSPage.tsx` — 9-tab dashboard (Workforce Command | Executive Intelligence | Succession | Org Heatmap | Workforce Simulation | AI Coaching | Enterprise Benchmark | Org Graph | Observability); org_id input drives all queries; on-demand "Run Simulation" runner with composite delta + derived lifts + capability uplift table + learning ROI panel
- **Wired**: `App.tsx` lazy import (line 91) + `'enterprise-workforce-os'` in Screen union + `isValidScreen` allowlist + render branch (line 798)
- **Deep-link**: `?screen=enterprise-workforce-os`

### Versions
`WORKFORCE_INTELLIGENCE_VERSION='5.0.0'`, `ECI_VERSION='5.0.0'`, `SUCCESSION_VERSION='5.0.0'`, `AI_COACHING_VERSION='5.0.0'`, `GROWTH_ROADMAP_VERSION='5.0.0'`, `WORKFORCE_SIMULATION_VERSION='5.0.0'`, `EXECUTIVE_INTELLIGENCE_VERSION='5.0.0'`, `EXECUTIVE_RECOMMENDATION_VERSION='5.0.0'`, `ORG_BENCHMARK_VERSION='5.0.0'`, `ORG_GRAPH_VERSION='5.0.0'`, `ENTERPRISE_OBSERVABILITY_VERSION='5.0.0'`

### Notes
- Tests skipped this session (runner disabled)
- Enhancement-only — older `p5_*`/`gov_*`/`wos_*` tables and routes untouched
- Architect review: no severe issues

---

## Adaptive Career Intelligence — Assessment Writers (Option 2)

**Bridges the Competency Assessment into the Phase 1-5 data layer. Every assessment completion now writes durable snapshots; all dashboards prefer real persisted scores over demo data when `?user_id=` is supplied.**

### DB
- **Migration**: `backend/migrations/20260621_assessment_writers.sql`
- **Tables**:
  - `user_assessment_snapshots` — header per submission: `id`, `user_id`, `org_id`, `role_id`, `assessment_version`, `source`, `taken_at`, `composite_score`, `n_competencies`, `reliability`, `metadata` JSONB
  - `user_competency_scores` — latest-value store keyed on `(user_id, competency_id)` with `score`, `reliability`, `source`, `snapshot_id` FK, `assessed_at`
- **Column add**: `p4_competency_history.snapshot_id TEXT` (nullable, backward compatible) — stamped onto rows created during a snapshot write

### Backend
- **Service**: `backend/services/assessment-writer.ts` — `ASSESSMENT_WRITER_VERSION='1.0.0'`
  - `writeSnapshot({userId, orgId?, roleId?, scores, reliability?, source?, sessionId?})` — single chokepoint:
    1. INSERT header into `user_assessment_snapshots`
    2. APPEND one row per competency into `p4_competency_history` (via existing `recordCompetencyHistory`)
    3. UPSERT latest values into `user_competency_scores`
    4. Non-blocking audit writes to `bench_audit_logs` + `m5_audit_logs` (org-scoped)
  - `realUserScores(userId)` — reads `user_competency_scores`; returns `null` if no rows so callers can fall back to demo
  - `latestSnapshot(userId)` + `snapshotHistory(userId, limit)` for display
  - Pure helper `composeScoreVector(scores)` for tests
- **Routes**: `backend/routes/assessment-writer.ts` under `/api/career/assessment/*`
  - `POST /snapshot` — write a snapshot (returns snapshot_id + counts)
  - `GET /snapshot/:user_id` — latest header
  - `GET /snapshots/:user_id?limit=N` — header history
  - `GET /scores/:user_id` — latest competency scores
  - `GET /_meta/version`
- **Registered**: `backend/routes.ts` line 49 (import) + 12849 (call)

### Resolver updates (read sites that now prefer real data)
- `backend/routes/adaptive-benchmark.ts` `parseScores()` — when `?user_id=` is supplied and no inline `?scores=`, looks up `user_competency_scores`. Falls back to `?demo=true` deterministic vector. Affects `/api/benchmark/role`, `/competency`, `/family`, `/domain`, `/layer`, `/aspirational`.
- `backend/routes/m5-enterprise-workforce.ts` `coachInput()` — same lookup; affects `/api/m5/coach/growth-plan`, `/learning`, `/mentors`, `/transition`. Coaching version bumped to `5.0.1`.

### Frontend wiring
- **Assessment completion**: `frontend/src/pages/CareerBuilderPage.tsx` `submitAssessment` — after the existing `/api/competency/run-assessment` POST, fires a non-blocking `POST /api/career/assessment/snapshot` with `{user_id, org_id?, role_id, scores: {competencyCode: rawScore}, reliability: 0.78, source: 'assessment'}`. Failure does not block UI.
- **Sidebar deep-links**: the 6 "Adaptive Intelligence" entries now build `?user_id=…&org_id=…` from the logged-in JWT before navigating, so every downstream dashboard receives real-user context.

### Smoke-tested flow
1. `POST /api/career/assessment/snapshot` with 12 scores → returns `snapshot_id`, `history_rows=12`, `upserted_scores=12`, `composite=66.92`
2. `GET /api/career/assessment/scores/:user_id` → returns the 12 scores keyed by competency_id
3. `GET /api/m5/coach/growth-plan?user_id=…` → growth-plan baselines now equal the submitted scores (was previously stuck on `DEMO_SCORES`)
4. `GET /api/benchmark/role?user_id=…&role_id=…` → uses persisted vector instead of demo

### Versions
`ASSESSMENT_WRITER_VERSION='1.0.0'`, `AI_COACHING_VERSION='5.0.1'` (bumped for real-score resolver)

### Backward compatibility
- All existing `?demo=true` and inline `?scores={…}` paths still work
- Trajectory dashboard already keyed on `user_id` — populates automatically as snapshots accumulate
- No changes to scoring formulas, existing tables, or seed data

---

## Phase 5 — Workforce OS expansion (`wos_*`)

**Six net-new domains layered on top of existing `gov_*`/`p5_*`/`tenants`. Read-only against earlier phases. All tables namespaced `wos_*`. Language policy enforced in every envelope (developmental signals only — no hiring/promotion assertions).**

### DB
- **Migration**: `backend/migrations/20260529_workforce_os_phase5.sql` (applied; tables + seed in one file)
- **Tables**: `wos_market_signals`, `wos_skill_obsolescence`, `wos_workforce_risk`, `wos_role_emergence`, `wos_ai_exposure`, `wos_fairness_suites`, `wos_fairness_results`, `wos_disputes`, `wos_human_overrides`, `wos_roles`, `wos_role_assignments`, `wos_learning_roi`, `wos_audit_logs`
- **Extra tenants seeded**: `MTRX_UNI`, `MTRX_SKILL`, `MTRX_AGENCY` (alongside existing `MTRX_DEMO`)

### Backend Services (all version `5.0.0`)
- `backend/services/market-intelligence-engine.ts` — `ingestSignals`, `querySignals`, `competencyDisruptionSummary`, `roleDemandMomentum`, `emergingRoles`, `macroTrends`
- `backend/services/predictive-workforce-engine.ts` — `listObsolescence`, `listWorkforceRisk`, `recomputeOrgRiskSnapshot`, `aiExposure`, `listEmergingRoles`, `severityFromScore`
- `backend/services/fairness-monitoring-engine.ts` — `computeFairness` (pure: disparate impact, mean-score gap, selection-rate gap), `listSuites`, `createSuite`, `recordResult`, `listResults`, `summary`
- `backend/services/dispute-override-engine.ts` — `fileDispute`, `getDispute`, `listDisputes`, `transitionDispute` (FSM-guarded), `listOverrides`, `applyOverridesToPayload`, `canTransition`
- `backend/services/rbac-tenant-engine.ts` — `listRoles`, `listAssignments`, `assignRole`, `revokeAssignment`, `effectivePermissions`, `userHasPermission` (wildcard match), `listTenants`, `resolveTenantFromRequest`, `tenantConnection`
- `backend/services/learning-roi-engine.ts` — `computeRoi` (capability_uplift / log(1+cost)), `persistRoi`, `listRoi`

### Backend Routes (`backend/routes/workforce-os.ts`)
Registered in `backend/routes.ts` line 52 (import) + via `registerWorkforceOsRoutes({ app, pool: concernsPool })`. All responses use a flat envelope:
```
{ ok, <payload fields>, language_policy, methodology_versions, request_id }
```

**Endpoints under `/api/wos/*`** (read-only unless noted):
- `methodology` — version manifest
- **Market**: `market/signals`, `market/disruption`, `market/demand-momentum`, `market/emerging-roles`, `market/macro-trends`; POST `market/ingest` (requires `market:write`)
- **Predictive**: `predictive/obsolescence`, `predictive/risk`, `predictive/ai-exposure`, `predictive/role-emergence`; POST `predictive/risk/refresh` (requires `wos:write`)
- **Fairness**: `fairness/suites`, `fairness/results`, `fairness/summary`; POST `fairness/suites` + `fairness/compute` (requires `fairness:write`)
- **Disputes**: `disputes`, `disputes/:id`, `overrides`; POST `disputes` (requireAuth), `disputes/:id/transition` (requires `disputes:resolve`)
- **RBAC**: `rbac/roles`, `rbac/assignments`, `rbac/effective`, `tenants`; POST/DELETE `rbac/assignments` (requires `platform:*`)
- **ROI**: `roi`; POST `roi/compute` (requires `wos:write`)
- **Dashboard**: `dashboard?tenant_id=…` — single rollup bundling workforce_risks, top_obsolete_competencies, ai_exposure_top, emerging_roles, fairness_summary, open_disputes, recent_roi, macro_trends

**Security**: `requireAuth` on every write; `requirePermission(pool, 'perm:scope')` enforces wildcard-aware RBAC checks via `wos_role_assignments`; failures audit-logged into `wos_audit_logs`. Wildcards: `'wos:*'` grants `wos:read`/`wos:write`; `'platform:*'` grants anything.

### Frontend
- **Page**: `frontend/src/pages/WorkforceOSPage.tsx` — renders all six domains via the dashboard rollup + per-domain panels
- **Wired**: `App.tsx` lazy import + `'workforce-os'` in Screen union + `isValidScreen` allowlist + render branch
- **Deep-link**: `?screen=workforce-os`

### Smoke-tested
- `GET /api/wos/methodology` → all 6 service versions
- `GET /api/wos/market/signals?limit=3` → 3 seeded signals (macro/job_demand/etc.)
- `GET /api/wos/fairness/summary` → 3-surface pass/fail rollup
- `GET /api/wos/disputes` → 3 seeded disputes (open / in_review / resolved_upheld)
- `GET /api/wos/rbac/roles` → 5 system roles
- `GET /api/wos/dashboard?tenant_id=1` → full bundle with 8 rollup keys

### Tests
Skipped: testing skill disabled this session (`runTest` unavailable). Manual end-to-end smoke verified all read endpoints + envelope contract.

### Versions
`MARKET_INTELLIGENCE_VERSION='5.0.0'`, `PREDICTIVE_WORKFORCE_VERSION='5.0.0'`, `FAIRNESS_MONITORING_VERSION='5.0.0'`, `DISPUTE_OVERRIDE_VERSION='5.0.0'`, `RBAC_TENANT_VERSION='5.0.0'`, `LEARNING_ROI_VERSION='5.0.0'`

---

## Competency Assessment Runtime (CareerBuilder · AssessmentTab)

Implements the 7 `/api/competency/*` endpoints the AssessmentTab depended on (previously 404 → submissions silently vanished).

- **Route file**: `backend/routes/competency-assessment-runtime.ts` — registered in `backend/routes.ts` (import line 47 + `registerCompetencyAssessmentRuntime({ app, pool: concernsPool, requireAuth })`).
- **Endpoints** (all `requireAuth`; identity bound to `req.user` server-side; path/body `userId` must equal session user else 403):
  - `POST profile/:userId` — upsert `currentRole/targetRole/industry/careerStage/experienceYears`
  - `POST run-assessment` — body `{userId, scores:[{competencyCode,rawScore,confidence}]}` (allowlisted codes via `COMPETENCY_META`, scores 0–100, ≤200 items, invalid entries skipped+counted)
  - `GET  compute-score/:userId` → `{overallScore, totalCompetencies, profile (camelCase), domains[].competencies[]}`
  - `GET  get-percentile/:userId` → `{overallPercentile, percentiles[]}` (empirical vs cohort; score-based fallback when n<3)
  - `GET  gap-analysis/:userId` → `{gaps[], strengths[], summary}` (anchor = `STAGE_ANCHOR`; +8 for `ROLE_PRIORITIES`)
  - `GET  role-fit/:userId` → `{roleFitProbability, readinessLevel, transition.topGaps}` (priority codes weighted 1.5×)
  - `GET  interventions/:userId` → `{interventions[]}` (derived per gap)
- **Auto-created tables**: `cra_profiles` (1 row/user), `cra_scores` (append-only — latest per (user, code) is current). Lazy `CREATE TABLE IF NOT EXISTS` on registration, gated per request with retry. Columns named `current_role_label`/`target_role_label` to sidestep `CURRENT_ROLE`/`TARGET_ROLE` PostgreSQL reserved-keyword parse errors.
- **Phase 1–5 bridge**: untouched — frontend still calls `/api/career/assessment/snapshot` post-submit so longitudinal + benchmark dashboards keep receiving the same scoreMap.
- **Version**: `CRA_VERSION='1.0.0'`

---

# Archived from replit.md (2026-05-22 trim)

The sections below were previously inlined in `replit.md`. They are preserved here verbatim. The live `replit.md` retains only one-line pointers in the Phase Index table.

## Phase 6/7/8 — Predictive · Governance · Enterprise WOS (additive, feature-flagged)

All three are additive on top of Phases 4/5 — none touch existing surfaces. Heuristic-only (no LLM keys). Same envelope as Phase 5: `{ ok, ...payload, methodology_versions, language_policy, feature_flag }`. UUID user IDs throughout (all `user_id` columns are `TEXT`).

### Feature flags (`backend/config/feature-flags.ts`)
- `predictiveIntelligenceV2 = true` (`FF_PREDICTIVE_INTELLIGENCE_V2`), `isPredictiveIntelligenceV2Enabled()`
- `governanceScienceV2 = true` (`FF_GOVERNANCE_SCIENCE_V2`), `isGovernanceScienceV2Enabled()`
- `enterpriseWorkforceOSV2 = true` (`FF_ENTERPRISE_WORKFORCE_OS_V2`), `isEnterpriseWorkforceOSV2Enabled()`
- Flag-off → all write/read routes return 503; `/feature-flag` + `/_meta/versions` remain public.

### Registration
- All three registered in `backend/routes.ts` (~L12869) next to `registerAiAssessmentV2`:
  - `registerPredictiveIntelligenceV2({ app, pool: concernsPool, requireAuth })`
  - `registerGovernanceV2({ app, pool: concernsPool, requireAuth })`
  - `registerEnterpriseWorkforceOS({ app, pool: concernsPool, requireAuth })`

### Phase 6 — Predictive Intelligence V2
- **Routes** (`/api/v2/predictive/*`): `GET /feature-flag`, `GET /_meta/versions`, `GET /readiness`, `GET /burnout-risk`, `GET /leadership`, `GET /forecast`, `POST /simulate`. Self-only IDOR guard on all `userId` query (403 on cross-user).
- **Services**: `predictive-competency-engine.ts` (readiness/burnout/leadership/promotion-proximity/skill-decay), `competency-forecasting-engine.ts` (EWMA + intervention boost + confidence), `workforce-simulation-v2.ts` (capability uplift / attrition / hiring scenarios + resilience).
- **Frontend**: `PredictiveWorkforceDashboard.tsx` (additive panel — not yet routed; mount via caller).

### Phase 7 — Governance Science V2
- **Routes** (`/api/v2/gov/*`): `GET /feature-flag`, `GET /_meta/versions`, `GET /models`, `POST /psychometrics/compute` (Cronbach α + factor loadings), `POST /psychometrics/estimate-theta` (3PL IRT MLE), `POST /fairness/evaluate` (demographic parity, disparate impact, scoring imbalance), `GET /fairness`, `POST /explainability/build` + `GET /explainability` (score-lineage graph), `POST /audit` (policy violation detection — flags "hiring/promotion/suitability" language), `GET /reliability`, `POST /override` (self-only override workflow).
- **Services**: `psychometric-intelligence-engine.ts`, `fairness-governance-engine.ts`, `explainability-graph-engine.ts`, `ai-governance-v2.ts`.
- **Frontend**: `GovernanceDashboard.tsx` (additive panel).

### Phase 8 — Enterprise Workforce OS V2
- **Routes** (`/api/v2/wos/*` — **distinct from existing `/api/wos/v2/*`**): `GET /feature-flag`, `GET /_meta/versions`, `POST /profiles/build`, `GET /dashboard` (LRU-cached per-tenant), `GET /capability-risk`, `GET /executive-intelligence`, `GET /resilience`, `POST /observability/record`, `GET /observability`.
- **Services**: `enterprise-workforce-os-engine.ts` (tenant profile build + readiness aggregation + dependency graph), `executive-workforce-intelligence-engine.ts` (heatmap + succession signals + workforce risk index), `intelligence-observability-engine.ts` (perf + orchestration + cache stats), `runtime-optimization-engine.ts` (tiny in-process LRU shared across routes).
- **Frontend**: `EnterpriseWorkforceOSDashboard.tsx` (additive panel).

### Verified contracts
- 22/22 protected endpoints return 200 with envelope; 2/2 IDOR cross-user attempts return 403.
- All `user_id` / `requested_by` / `ran_by` columns are `TEXT` (UUIDs from real users; earlier BIGINT defaults converted via ALTER).
- Public metadata: `/feature-flag` + `/_meta/versions` on all three namespaces (no auth).
- Regression: existing V2 surfaces (`/api/v2/orchestration|ai|benchmark|competency/feature-flag`, `/api/wos/v2/feature-flag`) all still 200.

### Backward compatibility
- Append-only migrations; all tables namespaced (`wos_*` v2 vs older `wos_*` Phase 5 use distinct table names — no collisions).
- Existing `WorkforceOSPage.tsx` (Phase 5 `?screen=workforce-os`) untouched; Phase 8 dashboard is a new mountable panel under `modules/career-builder/workforce/views/`.
- Routes `/api/v2/wos/*` (Phase 8) and `/api/wos/v2/*` (Phase 5 wos_v2) intentionally distinct paths.

### Additional docs
- `docs/MICRO_ACCURATE_STAGE_GUIDANCE.md` — planned evidence-driven stage guidance spec
- `docs/COMPETENCY_ASSESSMENT.md` — assessment landing + runtime spec
- `docs/EMPLOYABILITY_INDEX.md` — employability scoring model
- `docs/peer-benchmarking.md` — peer benchmark surfacing rules
- `docs/CAREER_BUILDER.md` — Career Builder module technical document

---

## Competency Runtime V2 (additive, feature-flagged)

Additive V2 Competency Intelligence Foundation — dynamic ontology-driven competency resolution, runtime role DNA, contextual modifiers, explainability. Does NOT touch existing `competency-assessment-runtime.ts`, `cra_*`, `onto_*`, `bench_*`, `mobility_*`, or m3/m4/m5 surfaces.

### Feature flag
- `backend/config/feature-flags.ts` — `advancedCompetencyRuntimeV2 = true` (override `FF_ADVANCED_COMPETENCY_RUNTIME_V2=false` to disable)
- `isAdvancedRuntimeEnabled()` helper; all V2 write routes return 503 when off; UI hides V2 panel.

### Backend
- **Migration**: `backend/migrations/20260630_competency_runtime_v2.sql` — 5 tables (`competency_runtime_contexts`, `role_dna_profiles_v2`, `competency_runtime_weights`, `competency_context_modifiers`, `competency_resolution_history`) + 9 seeded context modifiers (`startup`, `enterprise`, `regulated`, `healthcare`, `ai_ml`, `leadership`, `executive`, `managerial`, `specialist`). Idempotent via `UNIQUE(modifier_type, modifier_name) ON CONFLICT DO NOTHING`.
- **Services**:
  - `backend/services/role-dna-generator.ts` — reads `onto_role_competency_weights`, `onto_organisational_layers`, `onto_complexity_models`; falls back to canonical 7-domain (COG/COM/LEA/EXE/ADP/TEC/EIQ) weights when ontology coverage is empty.
  - `backend/services/runtime-explainability-engine.ts` — pure; emits `why_competencies_selected / why_weights_assigned / why_readiness_level / why_cohort / confidence / language_policy`.
  - `backend/services/competency-resolution-engine.ts` — orchestrates: persist context → resolve+cache DNA → load modifiers → apply (weight multipliers + level deltas + intensity delta) → L1-renormalise → persist runtime weights → build explainability → append resolution history.
- **Routes**: `backend/routes/competency-runtime-v2.ts` — registered via `registerCompetencyRuntimeV2({ app, pool: concernsPool, requireAuth })` in `backend/routes.ts` (next to `registerCompetencyAssessmentRuntime`). 7 endpoints under `/api/v2/competency/`:
  - `POST /resolve-dna` (auth + flag)
  - `POST /runtime-context` (auth + flag)
  - `GET  /role-dna/:roleId` (auth + flag)
  - `GET  /runtime-weights/:userId` (auth + flag + path-uid match)
  - `GET  /contextual-expectations/:userId` (auth + flag + path-uid match)
  - `GET  /feature-flag` (public — UI gating)
  - `GET  /_meta/versions` (public)
- **Envelope**: every response stamps `methodology_versions` + `language_policy` + `feature_flag` for explainability + provenance.

### Frontend
- `frontend/src/lib/services/competencyRuntimeV2Service.ts` — `isEnabled / resolveDNA / fetchRoleDNA / fetchRuntimeWeights / fetchContextualExpectations` (returns `null` on failure; no try/catch noise for callers).
- `frontend/src/lib/stores/competencyRuntimeStore.ts` — Zustand: `enabled / runtimeContext / roleDNA / runtimeWeights / contextualExpectations / appliedModifiers / explainability / confidence / intensity / loading / error` + `checkFlag / resolve / reset`.
- **AssessmentTab integration**: `V2ContextPreview` component in `CareerBuilderPage.tsx` (~L5213), mounted **below** the existing setup fields (~L5797). Renders nothing when flag is off. Maps user inputs (`careerStage` / `industry`) to seeded modifier tokens (`startup`/`enterprise`/`leadership`/`executive`/`managerial`/`specialist`/`ai_ml`/`healthcare`/`regulated`). Shows: contextual weight bars per competency, applied modifiers with multipliers, confidence %, assessment intensity, "Why these competencies" + cohort rationale. Carries the explicit disclaimer `Developmental signals only — not a hiring, promotion, or suitability prediction.`

### Backward compatibility
- Existing AssessmentTab setup + `Start Assessment` flow untouched.
- `competency-assessment-runtime.ts` and `/api/competency/*` endpoints untouched.
- `onto_*`, `bench_*`, `mobility_*`, `m3_*/m4_*/m5_*` tables read-only from V2.
- All migrations append-only; all V2 tables namespaced; flag-off means routes 503 and UI panel hides.

---

## Adaptive Assessment Runtime V2 (Phase 2 — additive, feature-flagged)

Phase 2 layered onto Competency Runtime V2. Generates dynamic, ontology-driven assessment **blueprints** from resolved Role DNA; runs an **adaptive loop** (difficulty escalation/de-escalation, depth expansion, contradiction probes, behavioural-signal inference); persists full **explainability log** per session.

### Feature flag
- `adaptiveAssessmentRuntimeV2 = true` in `backend/config/feature-flags.ts` (override `FF_ADAPTIVE_ASSESSMENT_RUNTIME_V2=false`)
- Helper: `isAdaptiveAssessmentV2Enabled()`. All write routes 503 when off; UI hides the runtime panel.

### Backend
- **Migration**: `backend/migrations/20260705_assessment_blueprint_v2.sql` — 9 tables (`assessment_blueprints_v2`, `assessment_blueprint_competencies`, `adaptive_question_pools`, `competency_question_templates`, `assessment_branching_rules`, `assessment_runtime_sessions_v2`, `competency_signal_capture`, `behavioral_assessment_signals`, `assessment_explainability_logs`) + seeded baseline branching rules (`low_conf_global`, `contradict_global`, `expand_depth_lea`, `escalate_high_conf`, `behav_probe_eiq`) + 7 seeded pool keys (one per canonical 7-domain competency).
- **Services**:
  - `backend/services/assessment-blueprint-engine.ts` — `generateBlueprint()` + `persistBlueprint()`. Per-competency question budgets scale with importance weight + runtime intensity (base 6, capped 14). Depth band by expected level (`≥75 deep`, `≥55 standard`, else `shallow`). Attaches branching rules.
  - `backend/services/adaptive-assessment-engine.ts` — pure: `applyResponse()` (EMA over score/confidence + streak tracking), `decideNext()` (branching priority: contradiction → low-confidence → high-streak escalation → LEA depth-expand → serve_next → complete_competency → complete_session), `inferBehavioralSignals()` (consistency / depth / hesitation).
  - `backend/services/assessment-runtime-orchestrator.ts` — `startSession()` calls `resolveCompetencyDNA()` (V2) → blueprint → persist → seed session state. `submitResponse()` applies + decides + writes `competency_signal_capture` + `assessment_explainability_logs` + updates session. `completeSession()` infers behavioural signals into `behavioral_assessment_signals`. `getExplainability()` enforces session ownership.
- **Routes**: `backend/routes/adaptive-assessment-v2.ts` (registered via `registerAdaptiveAssessmentV2({ app, pool: concernsPool, requireAuth })` in `backend/routes.ts` next to `registerCompetencyRuntimeV2`). 8 endpoints under `/api/v2/assessment/`:
  - `POST /generate-blueprint` (auth + flag) — dry-run preview
  - `POST /start` (auth + flag)
  - `POST /next-question` (auth + flag)
  - `POST /submit-response` (auth + flag)
  - `POST /complete` (auth + flag)
  - `GET  /explainability/:sessionId` (auth + flag + session-ownership check)
  - `GET  /feature-flag` (public)
  - `GET  /_meta/versions` (public)
- **Envelope**: every response stamps `methodology_versions` (`ASSESSMENT_ORCHESTRATOR_VERSION` / `ASSESSMENT_BLUEPRINT_VERSION` / `ADAPTIVE_ASSESSMENT_VERSION`) + `language_policy` + `feature_flag`.

### Frontend
- `frontend/src/data/catalogs/assessment-question-bank-v2.ts` — `ADAPTIVE_QUESTION_BANK_V2` + `pickByPool()`; seeds 8 sample questions across the 7 canonical pools (mcq / sjt / scenario / case / behavioral).
- `frontend/src/lib/services/adaptiveAssessmentV2Service.ts` — `isEnabled / start / nextQuestion / submitResponse / complete / explainability`.
- `frontend/src/modules/career-builder/competency/views/AdaptiveAssessmentRuntime.tsx` — self-contained 3-panel runtime UI (question card + per-competency progress bars + branching/explainability hints + completion screen with behavioural signals). Mounted in `CareerBuilderPage.tsx` AssessmentTab below `V2ContextPreview` (~L5961). Renders nothing when flag is off. Carries the explicit disclaimer `Developmental signals only — not a hiring, promotion, or suitability prediction.`

### Backward compatibility
- AssessmentTab setup + `Start Assessment` (legacy `cra_*` flow) and `competency-assessment-runtime.ts` are untouched.
- Existing scoring + score APIs (`/api/competency/*`) and Phase 1 V2 (`/api/v2/competency/*`) remain untouched.
- All 9 new tables are namespaced and append-only; flag-off means routes 503 and the UI panel hides.

---

## Contextual Scoring & Intelligent Benchmarking V2 (Phase 3 — additive, feature-flagged)

Phase 3 layered onto Phases 1 & 2. Replaces *generic* competency scoring with role-DNA-, industry-, layer-, geography-relative scoring; intelligent k-anonymous cohort formation with progressive broadening; per-competency confidence + reliability profiles; multi-domain readiness envelopes (role / leadership / transition / execution / strategic / capability); full explainability lineage. Does NOT touch existing `bench_*`, `/api/benchmark/*`, or any legacy scoring path.

### Feature flag
- `contextualScoringV2 = true` in `backend/config/feature-flags.ts` (override `FF_CONTEXTUAL_SCORING_V2=false`)
- Helper: `isContextualScoringV2Enabled()`. All endpoints 503 when off; UI panel hides.

### Backend
- **Migration**: `backend/migrations/20260710_contextual_scoring_v2.sql` — 8 tables (`competency_norm_contexts`, `contextual_benchmark_cohorts`, `competency_percentile_distributions_v2`, `competency_readiness_models`, `competency_growth_velocity`, `competency_confidence_profiles`, `competency_reliability_history`, `scoring_explainability_v2`) + seeded baseline readiness models (canonical 7-domain global + LEA/EXE layer-tuned) + global context placeholder.
- **Services** (all pure-function cores + thin DB helpers):
  - `backend/services/contextual-scoring-engine.ts` — `normalizeAgainstRoleDNA()` (piecewise-linear anchor at DNA expected = 50, raw 100 → 100), `computeContextualScore()`, `computeConfidence()` (logistic stabilisation on evidence count + variance penalty), `computeReliability()` (classical-test-theory proxy), `computeReadiness()` (band + probability gated by confidence).
  - `backend/services/contextual-norm-engine.ts` — 8-dimension `NormContext` (role × layer × industry × geography × org_maturity × team_scale × seniority × experience), `upsertNormContext()`, `getDistribution()` (returns canonical fallback distribution when cohort n<30), `rankPercentile()` (piecewise interpolation across p10/p25/p50/p75/p90).
  - `backend/services/dynamic-cohort-engine.ts` — `generateCohort()` with k-anonymity floor `K_MIN_DEFAULT=30`, progressively broadens by dropping `geography → org_maturity → team_scale → industry → layer → experience_band` until k_min reached; flags `is_provisional` when still under k_min. Counts members from `cra_profiles` (best-effort, returns 0 on any error).
  - `backend/services/readiness-intelligence-engine.ts` — `computeDomainReadiness()` + `computeAllReadiness()` across 6 domains (role / leadership / transition / execution / strategic / capability) with per-domain canonical-7-domain weight matrices.
- **Routes**: `backend/routes/contextual-benchmark-v2.ts` (registered via `registerContextualBenchmarkV2({ app, pool: concernsPool, requireAuth })` in `backend/routes.ts` next to `registerAdaptiveAssessmentV2`). 7 endpoints under `/api/v2/benchmark/`:
  - `GET /contextual` (auth + flag) — `?competency=COG&raw=72&expected=70&role=…&layer=…&industry=…` → full envelope: scored, percentile, readiness, cohort, distribution, explainability (why_cohort / why_percentile / why_readiness / why_confidence)
  - `GET /readiness` (auth + flag) — `?scores=COG:72,COM:65,…` → 6-domain readiness envelopes
  - `GET /peer-cohort` (auth + flag) — multi-dim context → cohort + broadening trail + provisional flag
  - `GET /confidence` (auth + flag) — per-user, per-competency confidence profile lookup
  - `GET /distribution` (auth + flag) — percentile distribution for cohort × competency
  - `GET /feature-flag` (public — UI gating)
  - `GET /_meta/versions` (public)
- **Envelope**: every response stamps `methodology_versions` (`CONTEXTUAL_SCORING_VERSION` / `CONTEXTUAL_NORM_VERSION` / `DYNAMIC_COHORT_VERSION` / `READINESS_INTELLIGENCE_VERSION`) + `language_policy` (allows `developmental signal`/`cohort percentile`; disallows `hiring decision`/`pass/fail`) + `feature_flag`. Error responses use a parallel `errorEnvelope()` so 503/4xx/5xx carry the same metadata.
- **Explainability**: `scoring_explainability_v2` table appended (never mutated) on `/contextual` and `/readiness`; carries rationale + payload + endpoint + user/competency.

### Frontend
- `frontend/src/lib/services/contextualBenchmarkV2Service.ts` — `isEnabled / contextual / readiness / peerCohort / distribution` (returns `null` on failure; never throws).
- `frontend/src/components/career/ContextualBenchmarkV2Panel.tsx` — additive 3-card layout (score · cohort distribution mini-bars · explainability lineage) + 6-domain readiness envelopes strip. Mounted at the top of `BenchmarkDashboardPage.tsx` (just below `DashboardIntro`); reads `roleId / layerId / seniority / geography` from the existing context-bar state. Renders nothing when flag is off. Carries explicit disclaimer that signals are developmental, never hiring/promotion predictions.

### Backward compatibility
- Existing `/api/benchmark/*` (Phase 2 adaptive benchmark) and `bench_*` tables are read-only / untouched.
- `BenchmarkDashboardPage` body, selectors, charts, modals all preserved — the V2 panel is purely additive above the existing content.
- All 8 new tables namespaced and append-only; flag-off → routes 503 + UI panel hides.

---

## Workforce OS V2 (Phase 5 — additive, feature-flagged)

Phase 5 Workforce OS extension. Adds *predictive depth* on top of the existing `wos_*` Phase 5 surface: time-series market forecasting, what-if workforce scenario simulation, statistical fairness-drift detection, dispute SLA / escalation policies, ABAC (attribute-based) policy layer over RBAC, and longitudinal learning-ROI attribution. Does NOT touch existing `wos_*` tables, `/api/wos/*` Phase 5 routes, or the Phase 5 dashboard sections.

### Feature flag
- `workforceOSV2 = true` in `backend/config/feature-flags.ts` (override `FF_WORKFORCE_OS_V2=false`)
- Helper: `isWorkforceOSV2Enabled()`. All endpoints 503 when off; UI panel hides.

### Backend
- **Migration**: `backend/migrations/20260715_workforce_os_v2.sql` — 6 tables (`wos_v2_market_forecasts`, `wos_v2_scenarios`, `wos_v2_fairness_drift`, `wos_v2_dispute_sla`, `wos_v2_abac_policies`, `wos_v2_learning_attribution`) + seed default SLA policy + 2 sample ABAC policies (`allow_compliance_fairness_read`, `deny_export_pii`).
- **Services** (all pure-function cores + thin persistence helpers):
  - `backend/services/market-intelligence-engine.ts` — `forecastSignal()` (OLS slope on weekly samples + R² confidence), `fetchSignalHistory()` (reads existing `wos_market_signals`), `persistForecast()`.
  - `backend/services/predictive-workforce-engine.ts` — `simulateScenario()` (quarterly headcount/attrition/hiring projection + skill-coverage gap + 4-band risk envelope), `persistScenario()`.
  - `backend/services/fairness-monitoring-engine.ts` — `detectDrift()` (two-proportion z-test on fairness metric drift, significance α=0.05), `persistDrift()`.
  - `backend/services/dispute-override-engine.ts` — `loadSLAPolicy()` (tenant-specific then global fallback), `evaluateSLA()` (age vs triage/resolve budgets → escalation step).
  - `backend/services/rbac-tenant-engine.ts` — `loadPolicies()`, `decide()` (deny-overrides-allow with priority ordering, full trace + rationale). Layers ABAC on top of existing `wos_roles` RBAC.
  - `backend/services/learning-roi-engine.ts` — `computeAttribution()` (cohort pre/post Δ + Cohen's d + baseline-adjusted attribution share), `persistAttribution()`.
- **Routes**: `backend/routes/workforce-os-v2.ts` (registered via `registerWorkforceOsV2Routes({ app, pool: concernsPool, requireAuth })` in `backend/routes.ts` next to `registerContextualBenchmarkV2`). 8 endpoints under `/api/wos/v2/`:
  - `POST /market/forecast` (auth + flag) — pass `history` or auto-fetch from `wos_market_signals`
  - `POST /predictive/simulate` (auth + flag) — `{baseline, knobs, scenarioName}` → outcome + scenario_id
  - `POST /fairness/drift` (auth + flag) — `{metric, baseline, current, baselineN, currentN}` → z-score + significance
  - `GET  /dispute/sla/:disputeId` (auth + flag) — reads existing `wos_disputes`; returns 404 if not found
  - `POST /rbac/abac/evaluate` (auth + flag) — `{resource, action, attributes}` → decision + trace
  - `POST /learning/attribution` (auth + flag) — `{interventionKey, observations[], baselineDelta}` → attribution envelope
  - `GET  /feature-flag` (public)
  - `GET  /_meta/versions` (public)
- **Envelope**: every response stamps `methodology_versions` (6 service versions) + `language_policy` (allows `scenario projection`/`drift indicator`/`policy decision`; disallows `hiring recommendation`/`individual termination prediction`/`pass/fail`) + `feature_flag`. Error responses use a parallel `errorEnvelope()`. All persistence writes are fire-and-forget (caught + warned) so route responses succeed even if the DB write fails.

### Frontend
- `frontend/src/lib/services/workforceOsV2Service.ts` — `isEnabled / marketForecast / simulate / fairnessDrift / abacEvaluate / attribution` (returns `null` on failure; never throws).
- `frontend/src/components/career/WorkforceOSV2Panel.tsx` — 6-tile responsive grid (forecast · scenario · drift · ABAC · attribution · SLA-policy reference) with rationale text on every tile. Mounted directly under the page header in `WorkforceOSPage.tsx` (above the existing version chips). Renders nothing when the flag is off. Carries explicit disclaimer that all signals are developmental/planning indicators, never individual hiring or termination predictions.

### Backward compatibility
- Existing `/api/wos/*` Phase 5 routes (market/predictive/fairness/disputes/overrides/rbac/tenants/roi) untouched.
- Existing `wos_*` tables read-only from V2; SLA `dispute/sla/:id` does a best-effort `SELECT` against `wos_disputes`.
- `WorkforceOSPage` tabs, sections, panels, and bundle fetch all preserved — the V2 panel is purely additive above the existing content.
- All 6 new tables namespaced and append-only; flag-off → routes 503 + UI panel hides.

---

## Adaptive Orchestration V2 (Phase 4 — additive, feature-flagged)

Event-driven intelligence orchestration layer that coordinates Adaptive Intelligence modules without modifying them. Implements the orchestrator, in-process event bus, unified intelligence profile aggregator, and competency-relationship graph. **Strictly additive** — no existing service or table touched; the "enhance existing engines" plan steps (5–9) are implemented via the orchestrator's `synchronizeIntelligenceLayers()` (touch-stamp pattern) + the event bus (existing engines can subscribe in future) rather than modifying source code.

### Feature flag
- `adaptiveOrchestrationV2 = true` in `backend/config/feature-flags.ts` (override `FF_ADAPTIVE_ORCHESTRATION_V2=false`)
- Helper: `isAdaptiveOrchestrationV2Enabled()`. All protected routes 503 when off.

### Backend
- **Migration**: `backend/migrations/20260715_adaptive_orchestration_v2.sql` — 10 new tables (`adaptive_intelligence_events`, `intelligence_orchestration_logs`, `competency_intelligence_profiles`, `intelligence_dependency_graph`, `intelligence_snapshots_v2`, `intelligence_execution_history`, `competency_graph_nodes`, `competency_graph_edges`, `orchestration_failures`, `adaptive_runtime_state`) + seeded 10 dependency-graph edges. All `CREATE TABLE IF NOT EXISTS`, idempotent.
- **Services** (all NEW files; existing engines untouched):
  - `backend/services/adaptive-event-bus.ts` — in-process `EventEmitter` wrapped with non-blocking persistence to `adaptive_intelligence_events`. Listener errors caught in both sync + async paths. 9 canonical event types: `competency.{assessment.completed,score.updated,dna.resolved}`, `{benchmark,mobility,trajectory,coaching,workforce,simulation}.updated`. Exports `emit / on / initEventBus / recentEvents`.
  - `backend/services/competency-graph-engine-v2.ts` — graph nodes (`competency|role|pathway|readiness|capability`) + edges (`requires|enables|adjacent|develops_into|gap_for`) with `ON CONFLICT DO UPDATE` idempotent upserts. Exports `upsertNode / upsertEdge / getNeighbors / snapshotStats / seedCanonicalCompetencies`. **Note**: file is `-v2.ts` to avoid colliding with existing `competency-graph-engine.ts` (m3 phase, `createCompetencyGraphEngine` factory pattern).
  - `backend/services/competency-intelligence-profile-engine.ts` — unified profile aggregator. Reads `competency_runtime_weights`, `competency_percentile_distributions_v2`, `contextual_benchmark_cohorts`, `mobility_role_transitions`, `competency_readiness_models`, `competency_growth_velocity`, `p4_predictions` in parallel via `safeFirst`/`safeAll` (returns `status: 'unavailable' | 'empty' | 'ok'` per layer; never throws on missing tables). Persists to `competency_intelligence_profiles` (latest, upsert) + `intelligence_snapshots_v2` (append-only). Exports `buildProfile / persistProfile / getLatestProfile`.
  - `backend/services/competency-intelligence-orchestrator.ts` — coordinates the lifecycle. `orchestrateAssessmentCompletion()` runs 7 sequential steps (emit → propagate → sync → build profile → persist → refresh graph → graph stats), each wrapped in `runStep` / `runEmitStep` for fault-tolerance. Status resolves to `success`/`partial`/`failed` based on step outcomes. Records to `intelligence_execution_history` (per-step) + `intelligence_orchestration_logs` (per-run) + `orchestration_failures` (per failure) — all fire-and-forget. `synchronizeIntelligenceLayers()` throws on real DB errors so failures propagate to step status accurately (fix from architect review).
- **Routes**: `backend/routes/adaptive-orchestration-v2.ts` (registered via `registerAdaptiveOrchestrationV2({ app, pool: concernsPool, requireAuth })` in `backend/routes.ts` next to `registerWorkforceOsV2Routes`). 8 endpoints under `/api/v2/orchestration/`:
  - `POST /run` (auth + flag, self-only via auth-uid match) — orchestrate end-to-end
  - `GET  /profile/:userId` (auth + flag + self-only) — latest cached profile
  - `POST /profile/:userId/rebuild` (auth + flag + self-only) — rebuild + persist + fire-and-forget snapshot
  - `GET  /graph/stats` (auth + flag) — nodes/edges/by_kind counts
  - `GET  /graph/neighbors?nodeKind=&nodeKey=&edgeKind=&limit=` (auth + flag)
  - `POST /graph/refresh` (auth + flag) — re-seeds canonical 7-domain nodes
  - `GET  /events?userId=&limit=` (auth + flag, **self-only**: query userId must match auth or 403 — architect IDOR fix)
  - `GET  /feature-flag`, `GET  /_meta/versions` (public)
- **Envelope**: every response stamps `methodology_versions` (4 service versions) + `language_policy` (allows `intelligence profile`/`orchestration step`/`graph relationship`/`lineage`; disallows `hiring recommendation`/`promotion ranking`/`individual fitness prediction`) + `feature_flag`. Parallel `errorEnvelope()` on failures.

### Frontend
- `frontend/src/lib/events/adaptiveIntelligenceEvents.ts` — `window.CustomEvent`-based pub/sub. Helpers: `emitAdaptive / onAdaptive / runOrchestration / fetchProfile`. 8 canonical event names mirror the backend bus (`adaptive:assessment.completed`, `adaptive:profile.updated`, `adaptive:{benchmark,mobility,trajectory,coaching,workforce,simulation}.updated`). `runOrchestration()` calls the backend then dispatches `assessment.completed` + `profile.updated` so subscribed components can refetch their slices reactively. **No existing component touched** — modules opt-in by importing `onAdaptive` in their own effect hooks.

### Backward compatibility / scope discipline
- "DO NOT overwrite" list respected: `benchmark`, `mobility`, `m3/m4/m5`, workforce dashboards, `CareerBuilderPage` — all untouched.
- The "enhance existing engines" plan steps (5–9) are implemented as orchestration calls + event broadcast, NOT in-place edits. Existing engines remain authoritative; future PRs can wire engine-side `on(ADAPTIVE_EVENTS.X, ...)` subscribers without breaking changes.
- `competency-graph-engine-v2.ts` (new) is namespaced because `competency-graph-engine.ts` already exists (Phase m3, factory pattern).
- All 10 new tables namespaced under `adaptive_*` / `intelligence_*` / `competency_graph_*` / `orchestration_*` prefixes; append-only or `ON CONFLICT DO UPDATE` semantics. Flag-off → protected routes 503.

---

## AI Inference V2 (Phase 5 — additive, feature-flagged, **heuristic-only**)

Heuristic competency inference from resume / LinkedIn / GitHub / portfolio / conversational sources. **No LLM calls** — all inference is deterministic pattern matching (regex, keyword counts, weighted scoring). The envelope explicitly stamps `language_policy.inference_mode = 'heuristic'`. Future LLM enrichment can subscribe via the Phase 4 event bus without modifying this layer.

### Feature flag
- `aiInferenceV2 = true` in `backend/config/feature-flags.ts` (override `FF_AI_INFERENCE_V2=false`)
- Helper: `isAiInferenceV2Enabled()`. All protected routes 503 when off.

### Backend
- **Migration**: `backend/migrations/20260720_ai_inference_v2.sql` — 10 new tables: `competency_inference_sources`, `ai_inferred_competencies`, `behavioral_inference_profiles`, `conversational_assessment_sessions`, `ai_reasoning_chains`, `portfolio_signal_analysis`, `github_signal_analysis`, `linkedin_signal_analysis`, `inference_confidence_models`, `ai_assessment_memory`. Idempotent; seeded 5 source-confidence calibration rows (resume 0.65, linkedin 0.70, github 0.85, portfolio 0.75, conversation 0.60).
- **Services** (all NEW files; no existing engine touched):
  - `backend/services/resume-signal-engine.ts` — regex/keyword extraction → `ResumeSignals` (tech keywords, leadership/exec verbs, project-complexity score, industry exposure, years/team-size hints). Maps to canonical 7-domain levels (TEC/LEA/EXE/COG/ADP/COM/EIQ).
  - `backend/services/github-competency-analyzer.ts` — analyses GitHub-shaped payload deterministically (language histogram, stars/forks/size aggregates, log-scaled scoring). Caller fetches raw data; we never call the GitHub API.
  - `backend/services/linkedin-intelligence-engine.ts` — analyses LinkedIn-shaped profile (position dates, leadership-title regex, ascending-trajectory detection, total/leadership years).
  - `backend/services/conversational-assessment-engine.ts` — turn-based runtime: 7-competency probe bank, round-robin under-explored selection, deterministic response scoring (length/specifics/reflective/concrete markers), contradiction detection (level delta > 35 vs prior turn for same competency), running quality score. Auto-closes at 7 turns; auto-escalates at 3 contradictions.
  - `backend/services/ai-reasoning-engine.ts` — pure-function explainability synthesis (why_inferred · confidence_reasoning · readiness_rationale · alternatives · caveats). Persisted to `ai_reasoning_chains`.
  - `backend/services/ai-competency-inference-engine.ts` — orchestrator: loads source weights from `inference_confidence_models` (fallback defaults), runs per-source analysers, weighted-average per competency, calibrated confidence = `0.25 + 0.4*coverage + 0.3*richness` (capped 0.95). Persists source row + per-competency rows + reasoning chains fire-and-forget.
- **Routes**: `backend/routes/ai-assessment-v2.ts` (registered via `registerAiAssessmentV2({ app, pool: concernsPool, requireAuth })` in `backend/routes.ts` next to `registerAdaptiveOrchestrationV2`). 10 endpoints under `/api/v2/ai/` — 8 protected (auth + flag), 2 public metadata (intentional, matches the V2 pattern used in `/api/v2/orchestration/*`, `/api/wos/v2/*`, `/api/v2/benchmark/*` for UI-side gating before login):
  - `POST /infer-competencies` (auth + flag + self-only: body `userId` must match auth) — multi-source inference
  - `POST /analyze-resume` (auth + flag) — resume text → signals + levels (no persistence)
  - `POST /analyze-linkedin` (auth + flag) — payload → analysis + levels (no persistence)
  - `POST /analyze-github` (auth + flag) — payload → analysis + levels (no persistence)
  - `POST /start-conversation` (auth + flag) — creates session, returns first probe
  - `POST /conversation/:id/respond` (auth + flag + self-only: session `user_id` must match auth) — records turn, returns next probe or close
  - `GET  /conversation/:id` (auth + flag + self-only) — fetch session state
  - `GET  /reasoning/:userId` (auth + flag + self-only) — list reasoning chains
  - `GET  /feature-flag`, `GET  /_meta/versions` (public)
- **Envelope**: every response stamps 6 service versions + `language_policy` with `allowed: ['inferred competency', 'developmental signal', 'reasoning chain', 'behavioural evidence', 'confidence band']`, `disallowed: ['hiring recommendation', 'promotion ranking', 'individual suitability prediction', 'pass/fail verdict']`, and explicit `inference_mode: 'heuristic'`. Parallel `errorEnvelope()` on failures.

### Frontend
- `frontend/src/modules/career-builder/intelligence/views/AICompetencyInsights.tsx` — standalone panel; not wired into `CareerBuilderPage` (parent components opt-in by importing). Fetches `/api/v2/ai/feature-flag` on mount and hides itself when flag is off. Renders per-competency level bar + confidence % + collapsible reasoning (why/confidence/readiness/evidence chips/caveats). Optional `onRunInference` callback so parent can trigger inference. Carries explicit developmental-only disclaimer in the header.

### Backward compatibility / scope discipline
- No existing service or table touched (collision-checked before any write — lesson from earlier in this session).
- All 6 service files have **never-before-used** filenames; routes file is new.
- All 10 new tables namespaced under `competency_inference_*` / `ai_*` / `*_signal_analysis` / `conversational_*` prefixes; `ON CONFLICT DO UPDATE` on the upsert paths; everything else append-only.
- Flag-off → protected routes 503; UI panel hides itself.
- **Inference is heuristic**, NOT machine-learning or LLM-based — the envelope makes this explicit so consumers don't over-claim. Adding an LLM later is a drop-in `SourceInput` extension; no schema or route change needed.

---

## Phase 5 Workforce OS — Audit-driven Hardening (2026-05-22)

Audit verdict: Workforce OS is real (OLS regression, disparate-impact math, recursive simulation, real multi-tenancy + wildcard RBAC). **5 gaps were closed** instead of rebuilding:

### Gap #1 — Fairness auto-sampling
- **New**: `sampleCohortScores()` + `fairnessAttributeWhitelist()` in `backend/services/fairness-monitoring-engine.ts`
- **New routes** (`backend/routes/workforce-os.ts`):
  - `GET /api/wos/fairness/attributes` — lists 9 whitelisted attributes
  - `POST /api/wos/fairness/compute-auto` — pulls latest `cra_scores` joined to `cra_profiles`, scoped by whitelisted attribute (industry/career_stage/org_layer/org_maturity/geography/current_department/education_level/age_band/gender). Auth: `requirePermission('fairness:write')`. Attribute column is **hard-whitelisted** (never interpolated).

### Gap #2 — SLA escalation firing
- **Migration**: `backend/migrations/20260810_dispute_sla_escalation.sql` — adds `escalated_at`, `escalation_level`, `escalation_target`, `last_sla_check_at` on `wos_disputes`
- **New**: `markBreachedDisputes()` sweeper in `dispute-override-engine-v2.ts` with lazy `ALTER … IF NOT EXISTS` guards. Race-safe conditional `UPDATE … WHERE COALESCE(escalation_level,0) < $2 RETURNING id`. Triage-only breach → level 1 / `chain[0]`; resolve breach → level=min(chain.length,3) / `chain[level-1]`.
- **New route**: `POST /api/wos/v2/dispute/sla/sweep` — requires positive `tenantId` + `disputes:resolve` permission (inline `userHasPermission` check).

### Gap #3 — Tenant guard
- `tenantId()` in `backend/routes/workforce-os-v2.ts` tightened to reject `0`/negative/non-integer (previously accepted any finite number). Callers that require a tenant (e.g. SLA sweep) now reject `null` explicitly.

### Gap #4 — Audit trail UI
- **New route**: `GET /api/wos/audit?tenant_id=&status=&limit=` in `workforce-os.ts` — gated by `requirePermission('platform:*')` (audit logs are cross-cutting sensitive). Tenant default = session-resolved; query override allowed only because platform:* was already verified. Status filter regex-constrained (`/^[a-z_]{1,32}$/`).
- **New UI**: `AuditTable` component + `'audit'` tab in `frontend/src/pages/WorkforceOSPage.tsx` (8th tab).

### Gap #5 — Horizon configurable
- `<select>` for horizon (4/8/12/26/52 weeks) added to `WorkforceOSV2Panel.tsx`; `horizonWeeks` state drives `useEffect` refetch + card label.

### Architect review status
First pass: Gaps #1 and #5 passed; #2/#3/#4 failed (auth gaps + race condition + cross-tenant leak). All three rewired; second pass: **PASS** — confirms no remaining auth bypass or cross-tenant read paths.

> Note: `replit.md` is large — consider trimming archived phase notes into `docs/phase-history.md` at a natural pause.

---

## UCIP Foundation (Phase 1, shadow-mode, additive)

**Migration**: `20261001_ucip_foundation.sql` · **API**: `/api/v2/ucip/*` · **Debug panel**: `UCIPDebugPanel` (`?debug=1`)

**Tables**: `ucip_profiles`, `ucip_competencies`, `ucip_evidence_signals`, `ucip_confidence_models`, `ucip_role_snapshots`, `ucip_cognitive_profiles`, `ucip_behavioral_profiles`, `ucip_assessment_memory`, `ucip_runtime_logs`

Unified Competency Intelligence Profile master aggregation layer. Read-only fan-out over existing engines via `ucip-orchestration-adapter`; aggregates via `unified-competency-profile-engine`; ordered pipeline via `ucip-builder-pipeline`; canonical identity via `competency-normalization-engine`; schema/integrity checks via `ucip-validation-engine`. Event-bus extended with 4 UCIP events (`UCIP_REBUILD_STARTED/COMPLETED/FAILED`, `UCIP_PROFILE_UPDATED`). Flags: `ucipEnabled`, `ucipShadowMode` (default ON), `adaptiveIntelligenceFoundation`. Routes 503 with envelope when foundation flag is OFF. Frontend hook (`useUCIP`), service (`ucipService`), and debug panel ship inert until flags flip. Never mutates upstream tables; persist to `ucip_*` is best-effort.

---

## Role DNA Runtime (Phase 2, shadow-mode, additive)

**Migration**: `20261005_role_dna_runtime.sql` · **API**: `/api/v2/role-dna/*` · **Debug panel**: `RoleDNADebugPanel` (`?debug=1`)

**Tables**: `role_dna_master_profiles`, `role_functional_competencies`, `role_behavioral_competencies`, `role_cognitive_expectations`, `role_leadership_expectations`, `role_execution_profiles`, `role_contextual_weights`, `role_competency_seed_logs`

Operationalises Role DNA at request time. WRAPS (never replaces) `role-dna-generator`, `role-fit-engine`, `ontology-engine`, `competency-resolution-engine`. Resolves raw role title → canonical role + seniority band via `contextual-role-resolution-engine` (reads `gro_role_aliases`/`gro_role_hierarchy`/`m3_canonical_role_mappings`, slug fallback). `functional-competency-seeding-engine` reads `gro_role_competency_expectations` + `mobility_adjacent_role_mappings` and emits `CompetencyTarget[]` in mandatory/supporting/adjacent/emerging buckets. `role-dna-runtime-engine` composes the above and applies `role_contextual_weights` modifier overlays (industry/org_maturity/org_layer/career_stage/experience_years/work_arrangement/leadership_scope). `role-dna-cache-engine` provides in-memory TTL+LRU cache with event-driven invalidation (`ROLE_CONTEXT_UPDATED`, `ROLE_COMPETENCIES_SEEDED`). Event-bus extended with 3 events. Flags: `roleDNARuntimeEnabled`, `functionalCompetencySeeding`, `contextualCompetencyResolution`. Routes gated foundation→roleDNA→[functionalSeeding]→auth→[admin]; `/seed/:roleId` and `/cache/stats` require admin. UCIP engine `buildUcip()` accepts optional `roleContext`; bumped to `UCIP_ENGINE_VERSION='1.1.0'`. Never mutates upstream tables.

---

## Competency Graph + Adaptive Blueprint Runtime (Phase 3, shadow-mode, additive)

**Migration**: `20261010_competency_graph_runtime.sql` · **Debug panel**: `CompetencyGraphDebugPanel` (`?debug=1`)

**Tables**: `competency_dependency_edges`, `competency_propagation_logs`, `competency_confidence_decay`, `competency_graph_execution_logs`, `adaptive_blueprint_sessions`, `adaptive_blueprint_targets`, `adaptive_blueprint_rules`

Operationalises competency dependency graph + propagation + adaptive blueprint generation. WRAPS Phase 1 UCIP + Phase 2 Role DNA. `competency-graph-traversal-engine` provides pure `loadEdgesForCompetencies`, BFS `traverse`, `propagateConfidence`, `clusterGaps`. `competency-propagation-engine` writes audit rows only (never to `user_competency_scores`); normalises `{ delta }` → `{ deltaConfidence }`. `adaptive-blueprint-generation-engine` reads UCIP + graph and emits AdaptiveBlueprint (`targetCompetencies`, `confidenceGapTargets`, `contradictionProbes`, `branchingRules`, `adaptiveDepthRules`, `cognitiveTargets`, `evidenceTargets`); best-effort persists. Event-bus extended with 3 events (`COMPETENCY_GRAPH_UPDATED`, `COMPETENCY_PROPAGATION_COMPLETED`, `ADAPTIVE_BLUEPRINT_GENERATED`). Flags: `competencyGraphRuntime`, `adaptiveBlueprintRuntime`, `competencyPropagation`. Routes gated foundation→graph→[propagation|blueprint]→auth→[admin|owner-or-admin]; `/propagate` admin-only; `/blueprint/:userId` owner-or-admin. UCIP bumped to `1.2.0` with `competencyGraphState`/`propagationMetadata`/`adaptiveBlueprintMetadata` (flag-gated). Uses its own `competency_dependency_edges` namespace — does NOT touch `competency_graph_edges` (Adaptive Orchestration V2).

---

## Dynamic Question Generation + Cognitive Runtime (Phase 4, shadow-mode, additive)

**Migrations**: `20261015_dynamic_assessment_runtime.sql` + `20261016_dynamic_assessment_fks.sql` · **API**: `/api/v2/dynamic-assessment/*` · **Debug panel**: `DynamicAssessmentDebugPanel` (`?debug=1`)

**Tables**: `dynamic_question_sessions`, `dynamic_question_generations`, `adaptive_question_branches`, `cognitive_runtime_profiles`, `behavioral_contradiction_logs`, `question_context_signals`

Operationalises adaptive contextual assessment intelligence. WRAPS Phase 1 UCIP + Phase 2 Role DNA + Phase 3 Graph. `contextual-question-generation-engine` provides pure `generateQuestion()` + `nextQuestionType()` + DB helpers. 7 question types (situational, behavioral, leadership, analytical, technical, contradiction_probe, evidence_validation) × 5 depth levels. `adaptive-branching-engine` exposes pure `chooseBranch()` with 6 policies (escalate_depth, reduce_ambiguity, probe_contradiction, increase_complexity, shift_focus, maintain). `cognitive-runtime-engine` tracks 7 signals (AnalyticalReasoning, SystemsThinking, DecisionVelocity, LearningAgility, WorkingMemory, StrategicJudgement, ProblemSolving). `behavioral-contradiction-engine` detects 4 classes (inconsistent_response, inflated_claim, leadership_inconsistency, execution_contradiction). Event-bus extended with 4 events (`QUESTION_GENERATED`, `BRANCH_EXECUTED`, `CONTRADICTION_DETECTED`, `COGNITIVE_PROFILE_UPDATED`). Flags: `dynamicQuestionGeneration`, `adaptiveQuestionBranching`, `cognitiveRuntimeEnabled`. Routes gated foundation→[feature]→auth→[owner-or-admin|session-owner-or-admin]; session routes always look up `dynamic_question_sessions.user_id` (404 for non-existent). `/session/start` enforces admin for cross-user body.userId. Phase 4 sessions are hardcoded `shadow_mode=true` (independent of `ucipShadowMode`). UCIP bumped to `1.3.0` with `cognitiveRuntimeProfile`/`contradictionHistory`/`adaptiveRuntimeMetadata`/`branchingIntelligence` (flag-gated); `profileVersion` bumps to 4. All FKs added (`crp_session_fk`, `aqb_from_question_fk`, `bcl_session_fk`).

---

## Intelligence Fusion + Contextual Scoring + Runtime Authority (Phase 5, shadow-mode, additive)

**Migration**: `20261020_adaptive_runtime_authority.sql` · **API**: `/api/v2/adaptive-runtime/*` · **Debug panel**: `AdaptiveRuntimeAuthorityDebugPanel` (`?debug=1`)

**Tables**: `competency_fusion_logs`, `confidence_calibration_logs`, `contextual_scoring_profiles`, `intelligence_narratives`, `competency_memory_history`, `runtime_authority_transitions`

Operationalises the Adaptive Workforce Intelligence Operating System. WRAPS Phases 1–4; does NOT replace V1 scoring, assessment runtime, or upstream tables. `competency-fusion-engine` provides pure `fuseCompetencies()` over 9 sources (assessments/resume/github/linkedin/conversational/learning_velocity/market/behavioral/graph) with weighted blend + dispersion penalty. `confidence-calibration-engine` exposes pure `calibrate()` returning `{score, confidence, evidenceCount, evidenceDiversity, sourceCoverage, decayFactor, benchmarkConfidence, lastValidatedAt, components}` — evidence curve (1−e^(−n/4)), 90-day half-life decay, dispersion penalty. `intelligence-narrative-engine` produces 9 narrative kinds (strength/growth/confidence_gaps/benchmark_deviations/cognitive_summary/behavioral_summary/market_alignment/predictive_trajectory/learning_velocity). `competency-memory-engine` writes append-only `competency_memory_history` (score/confidence deltas, growth velocity, drift severity, leadership layer, readiness band). `unified-adaptive-runtime-orchestrator` coordinates UCIP→fusion→calibration→contextual scoring→memory→narratives→authority transition, implementing the 5-stage dual-runtime strategy (shadow → dual → silent_compare → progressive → authority); always writes `shadow_mode=true` until stage='authority' is explicitly transitioned. Event-bus extended with 5 events (`RUNTIME_AUTHORITY_UPDATED`, `COMPETENCY_FUSED`, `CONTEXTUAL_SCORING_COMPLETED`, `NARRATIVE_GENERATED`, `MEMORY_UPDATED`). Flags: `adaptiveRuntimeAuthority`, `competencyFusionEnabled`, `contextualScoringAuthority`, `intelligenceNarratives`, `continuousCompetencyMemory`. Routes gated foundation→authority→auth→[owner-or-admin|admin]; `/authority/transition` and `/authority/transitions` admin-only. UCIP bumped to `1.4.0` with `fusionSummary`/`contextualScoringAuthoritySnapshot`/`narrativeSummary`/`competencyMemorySummary` (flag-gated); `profileVersion` bumps to 5 when any Phase 5 summary present.

**Wired (2026-05-23)**: After `POST /api/career/assessment/snapshot` succeeds, `fanOutAdaptiveOrchestration()` in `backend/routes/assessment-writer.ts` fires both `orchestrateAssessmentCompletion` (Phase 1–4) and `runAdaptiveRuntime(stage:'shadow')` (Phase 5) non-blocking. All 16 umbrella flags flipped default-ON; safety profile preserved by `shadow_mode=true` writes only.

---

## CAPADEX Data-Layer Audits & IntroPhase Evolution (archived 2026-05-28)

Verbose build narratives moved from `replit.md` to keep the live README scannable. Live tables, routes, panels, and DDL remain authoritative in the codebase; this archive preserves the audit-pipeline reasoning and IntroPhase version history.

### CAPADEX Concerns Master — audit pipeline detail
Audited behavioural-intelligence catalogue — 2,488 rows ingested from `attached_assets/concerns_*.csv` via `scripts/audit_capadex_concerns.py` (pandas pipeline: junk-col scrub, phantom-row drop (rows where both Concern ID + Domain are null — 17 trailing-empty CSV artefacts), Title-Case categoricals, regex age-band split → `age_min`/`age_max` Int64, `Relational_Bridge_Tag` derived from `Domain` first-2-tokens, sibling-derived routing fallback (blank Assessment Dimension / Root Cause Group / Intervention Lens / Capability Mapping inherit from `Intelligence Layer` / `Concern Category` / `Contextual Modifier` / `Domain` via per-slot fallback chain; `UNASSIGNED_ROUTING_NODE` sentinel only when every candidate is also blank)). Output: `audited_capadex_concerns.csv` (21 cols, 951 KB). Seed stats: 2,488 rows · 350 domains · 327 bridge buckets · 0 rows missing age · 0 unassigned routing (FAC_1286's blank routing slots derived from siblings). Schema note: after phantom-drop, all 2,488 surviving `concern_id` values are unique; column is indexed but constraint kept non-unique to tolerate future source-CSV duplicates. Surrogate PK on SERIAL `id`. API supports import modes `append|upsert|replace` with `?dryRun=1`; upsert uses try-UPDATE-then-INSERT so no global UNIQUE constraint is created at runtime. Multer 10 MB cap with structured 413/400 responses. Lazy DDL on first request makes endpoint self-bootstrapping. Standalone sidebar entry was removed (2026-05-28); legacy `activeTab='capadex-concerns-master'` IDs redirect to the framework view via a fallback render block in `SuperAdminDashboard.tsx`.

### CAPADEX Clarity Questions — audit + orphan-patch pipeline detail
Audited child question pool — 14,291 rows ingested from `attached_assets/Clarity_Questions_*.csv` via `scripts/audit_clarity_questions.py` (pandas pipeline: latin1/utf-8-sig auto-load with header-row=1 auto-detect, dedup 4,441 colliding `question_id`s with `_v2/_v3` suffix preserving every row, null fortification on text cols, score columns coerced to nullable `Int64`, `concern_id_prefix` derived from `concern_id` (`CAR_001` → `CAR`), `Relational_Bridge_Tag` raw text passthrough, curated `master_bridge_tag` resolved via 150+ entry `PREFIX_TO_MASTER_BRIDGE` map + token-heuristic fallback against `/tmp/master_bridge_tags.txt` snapshot of `capadex_concerns_master.relational_bridge_tag`). Output: `audited_clarity_questions.csv` (5.8 MB, 26 cols). Seed stats (post-orphan-patch): 14,291 rows · 397 unique concerns · 373 legacy prefixes · 56 master buckets · 0 UNMAPPED · 14,166 (99.1%) joinable. **Orphan-patch pipeline** (`scripts/patch_orphans.py`): 3-tier fallback that resolved all 225 UNMAPPED rows — Tier A regex-keyword routing (`STRESS|ANXIETY|PRESSURE → EXAM_STRESS`, `CAREER|DIRECTION|FUTURE → CAREER_READINESS`, `COLLEGE|CAMPUS|ACADEMIC → COLLEGE_ADAPT`, `TIME|HABIT|DISCIPLINE → DISCIPLINE_HABITS`, `ADJUST|COPING|BURN → ADJUSTMENT_COPING`); Tier B token-prefix heuristic matching `concern_id` first underscore-token against the live `relational_bridge_tag` set (resolved 100 rows into new buckets like `EXAMINATION_STRESS`, `STRESS_AND_RESILIENCE`, `EMERGING_AI_BURNOUT`); Tier C falls remaining 125 unresolvable rows to `GENERAL_CONCERN` sentinel for human triage. Script also re-applies `_v2/_v3` suffixing, coerces score cols to `Int64` with `fillna(0)`, strips option-text whitespace, fills `question_weight` NaN with 1.0. Emits Title-Case headers so the seed `COLUMN_MAP` keys match. Idempotent. Relational contract: `clarity.master_bridge_tag = master.relational_bridge_tag` (many-to-many at the bucket level). Standalone sidebar entry was removed (2026-05-28); legacy `activeTab='capadex-clarity-questions'` IDs redirect to the framework view.

### CAPADEX Signal Ontology Hub — import pipeline detail
4-tier Behavioural Signal Ontology subsystem ingested from 4 xlsx files via `scripts/import_signal_ontology.py` (pandas pipeline: phantom header-row drop (3 rows in Atomic), `FFAM_*` → `FAM_*` typo repair (40 rows), Title-Case categoricals, regex age-band split, sibling-derived routing fallback with `UNASSIGNED_ROUTING_NODE` sentinel, bridge-tag derivation via `BRIDGE_RULES`). Outputs: `audited_domains.csv` (20×11), `audited_families.csv` (400×7), `audited_signals.csv` (20×22), `audited_atomic_signals.csv` (15,972×45). Migration creates 4 tables + 14 indexes + 3 advisory NOT VALID FKs; routing/categorical cols NOT NULL with sentinel defaults. Seed stats: 20 domains · 400 families · 20 signals · 15,972 atomic · 6 bridge buckets (GENERAL_CONCERN=10,352/64.8% — expected for granular behavioural patterns that don't map to lifecycle buckets). API: `resource` validated via `validateResource` middleware against the `RESOURCES` whitelist so no SQL injection is possible. Lazy DDL anchored via `fileURLToPath(import.meta.url)`. No standalone sidebar entry.

### IntroPhase persona overhaul (2026-05-28, original)
`PERSONA_FIELD_MAP` (6 keys: parent/teacher/professional/student + legacy campus/jobseeker) carried per-persona `f1/f2/f3` labels + placeholders, `concernHeader`, `concernPlaceholder`, plus the client-visible mirror of `actor/target/relationship` (parent→PARENT/STUDENT/parent_child, teacher→TEACHER/STUDENT/teacher_student, others→self/direct). Trust strip "14,000+ audited data matrices · 20+ Core Cognitive Domains · Free & Confidential" replaced the legacy "10 q · ★ 4.8 · 12,400+ taken" line. 300ms debounced ontology-mapping pill below the concern input. CTA gate required Name (≥2 chars) + persona-bounded valid Age + concern + email-verified; text → `Launch Clarity Journey`. `FreeAssessmentModal.handleAnalyseConcern` payload sent `actor_persona/target_persona/relationship_type` explicitly to `/api/capadex/concern/analyze` (server `runtime-context.ts` remained authoritative and re-derived — client send was belt-and-suspenders). Superseded by the macro-track overhaul.

### IntroPhase macro-track overhaul + progressive disclosure (2026-05-28, second)
3-track × 11-sub-persona model: **Learner** (Campus Student, Competitive Aspirant, Career Explorer, Skill Development Learner), **Professional** (Early/Mid-Career/Career Transition), **Proxy** (Parent, Teacher/Educator, Academic Counsellor, Placement & Career Cell — `isProxy=true`). `TRACK_GROUPS` + `ALL_SUB_PERSONAS` config in `IntroPhase.tsx` L50-141; each sub-persona carries `legacyKey` (maps onto the 6-key legacy `PersonaKey` so downstream phases stay unchanged) + `ageBands` whitelist. Age became a 5-bracket dropdown (`AGE_BANDS = ['6-14','14-17','17-24','24-45','45+']`); midpoint feeds the legacy `userAge` numeric field for `getAgeRange` compat. Two-field identity row (is_proxy-aware): proxy → "Target Name" + "Target's Institution"; non-proxy → "Your Name" + "Your Domain/Industry". Ontology preview chip: `[ 🔍 Core Domain: <label> ]` font-mono pill + rose `✨ Context Alert: Sociocultural performance amplifiers detected.` line when regex matched JEE/NEET/coaching/placement keywords. Progressive disclosure: persona selector started collapsed showing only 3 large track header cards with chevron; tapping a header expanded its sub-personas (`expandedTrack` state, one-at-a-time accordion). Headers carried `aria-expanded` / `aria-controls`; bodies carried `id` + `role="region"` + `aria-labelledby`. State lifted to FreeAssessmentModal: `primaryPersona / isProxy / ageBand` (+ setters) live on the modal and reset on close via `reset()`. `PhaseProps` (assessment/types.ts) extended for compile-time contract safety. `/api/capadex/concern/analyze` payload reshape: legacy keys retained PLUS new spec envelope `{primary_persona, is_proxy, target_age_band, assessee_name, contextual_anchor, raw_concern_text}`. Superseded by the sentence-case/Indian-context polish and conditional-dropdown follow-up.

### IntroPhase conditional dropdowns + visible validation (2026-05-28, follow-up)
`PERSONA_FIELD_MAP` extended with optional `f3bLabel` + `f3bOptions` that switch the f3 row into a 2-col `grid-cols-[1fr_minmax(140px,180px)]` (text input + native `<select>`). Per-persona structured options: parent→Grade (`GRADE_OPTIONS` Class 1–12 + 1st–Final Year + Post-Grad), teacher→Section (`SECTION_OPTIONS` A–E + Mixed), professional/jobseeker→Industry (`INDUSTRY_OPTIONS` 20 verticals), student/campus→Year. Field state stored as TWO separate local React states (`contextText`, `contextDetail`) — never split a canonical string for render (architect review caught: `trim()` ate trailing spaces, user-typed " — " corrupted parsing, persona-reset desynced). A single `useEffect([contextText, contextDetail])` joins them as `"<text> — <detail>"` into the prop-level `contextField`. Persona-switch effect resets BOTH halves. Visible inline validation hints: red border + "Please enter at least 2 characters" under participantName when typed length=1. `handleAnalyseConcern` payload extended with `context_field` + `participant_name`. Wiring into `runtime_context.target_school`/`target_grade`/`target_role`/`target_industry` remains a follow-up.

---

## CAPADEX Search & Clarity Routing — 2026-05-28

Three additive improvements consolidating the persona-aware concern surface and the master-curated clarity-question pipeline.

### Persona-aware hybrid search
`/api/concerns/search` accepts `subPersona` (IntroPhase sub-persona id). `backend/routes/short-assessments.ts` carries a `PERSONA_AFFINITY` map (12 sub-personas → master `primary_persona` strings, lowercase, ordered closest cohort first). Master SELECT adds `AND LOWER(COALESCE(primary_persona,'')) = ANY($N::text[])` when affinity is known. **Hybrid fallback**: zero rows under the persona constraint → rerun without it → set `personaFallback:true` on the response. IntroPhase shows an amber `AlertCircle` note "No exact match for your persona — showing related concerns from adjacent cohorts" when the flag is true and suggestions exist. `competitive_aspirant` affinity intentionally broadened to `['competitive aspirant','student','campus student','early career learner','skill development learner']` so terms like "placement" surface adjacent-learner rows instead of falling silently to TPO-tagged ones. Frontend (`FreeAssessmentModal`) aggregates the flag across primary + secondary keyword retries (`||`-merge), resets it in all three concern-reset sites, and lists `primaryPersona` in the effect deps so sub-persona switches sharing a legacy persona still refetch.

### `display_label` column
Nullable user-facing short copy on `capadex_concerns_master`. Migration `20260528_capadex_concerns_display_label.sql` backfills via regex-strip of clinical prefixes ("Weak Ability to", "Difficulty Managing" etc.) from `concern_cluster`. Frontend fallback chain: `display_label → concern_cluster → concern_area → domain`. **Display-only** — routing keys (`concern_area`, `concern_id`, `domain`, `concern_cluster`) unchanged; `ontologyPreview` carries split `{key, label}` so curated copy never leaks into the selected-concerns identifier set. Editable per row via `CapadexConcernsMasterPanel`.

### Free-text master resolver + clarity-question 3-tier picker chain
`/api/capadex/concern/analyze` accepts optional `concern_id` (master taxonomy). 3-tier picker chain in `backend/routes/capadex-concern-intelligence.ts`:
1. `pickQuestionsFromMaster()` joins `capadex_clarity_questions` via `master_bridge_tag = relational_bridge_tag` (drops rows with <2 valid options).
2. `pickQuestionsFromDB()` keyed on construct/category from `adaptive_question_bank`.
3. Static `pickQuestions()` fallback.

Returns `clarity_source: 'master_curated'|'adaptive_bank'|'static_fallback'` — `CapadexClarifyPhase` surfaces it as honest provenance pill ("Tailored to your concern" teal vs "General behavioural cluster" slate). Only ~17% of master buckets (55/327 bridge tags) have curated clarity rows today — fallback is the common path. IntroPhase headline "Mapped to" chip is derived from the top master-search result (not hardcoded regex), so its label + click metadata + analyze-payload `concern_id` all come from the same canonical source.

**Free-text resolver**: when the client omits `concern_id` (typical for users who type a phrase and submit without clicking a typeahead chip), `resolveMasterConcernIdFromText(pool, text)` scores typed text against `capadex_concerns_master` using additive per-token + per-column scoring (cluster=30, display=20, domain=10, bridge_tag=5) + phrase-in-cluster bonus (60) / phrase-in-display bonus (40). Restricted to rows whose `relational_bridge_tag` actually has clarity rows. Adoption threshold score ≥60; weaker matches return null so the fallback chain still engages honestly. Resolved id is returned as `resolved_concern_id` so the frontend can persist it. Smoke verified: "work stress" → CONCERN_COM_430 (master_curated), "exam stress" → CONCERN_CON_2145, "career confusion" → CONCERN_CON_1736, "random gibberish xyz" → static_fallback.

### Orchestration Context (2026-05-24)
`backend/services/runtime-context.ts` derives `actor_persona/target_persona/relationship_type` from `(persona, assesseeType, age)` — parent+my-child→PARENT/STUDENT/parent_child, teacher+a-student→TEACHER/STUDENT/teacher_student, counsellor/corporate+someone-else→COUNSELLOR-CLIENT/MANAGER-REPORT, `*`+myself→self, fallback→direct. `/api/capadex/concern/analyze` calls `persistRuntimeContext()` (best-effort INSERT into `capadex_runtime_sessions`, never throws) and attaches `runtime_context` envelope to response. FreeAssessmentModal captures into `runtimeContext` state + spreads through `allPhaseProps` so downstream phases read one canonical source. Migration `20260524_runtime_sessions_nullable_session_id.sql` drops NOT NULL on `session_id` so the envelope persists pre-session.

### Competency Question Curation (SuperAdmin)
`backend/routes/competency-questions.ts` + `frontend/src/components/superadmin/CompetencyQuestionsPanel.tsx` (nav: Assessment Config → Competency Questions). Table `competency_question_templates` extended with `status` (draft|approved|rejected|archived) / `source` (manual|generated|seed) / `reviewed_by` / `reviewed_at` / `notes` (migration `20260524_competency_question_curation.sql`). Seed script `backend/scripts/seed-competency-templates.ts` ports the 63-item static bank as `status='approved' source='seed'`. APIs: public `GET /api/competency/questions/select` (mirrors selector — affinity + tier-rotation + round-robin interleave, returns AQ-shape with side-channel `_domain`/`_origin_id` for client served-ID memory); admin (requireSuperAdmin) `GET|POST|PATCH|DELETE /api/admin/competency-questions`, `GET .../stats`, `POST .../generate` (rule-based variant generator: generalist/rephrase/difficulty_shift transforms from approved seeds, no LLM, writes drafts only). Manual POST always lands as `status='draft'` — admins explicitly promote via PATCH after review.

### Competency Assessment selector internals
`selectAssessmentQuestionsFromAPI` in `frontend/src/lib/assessmentSelector.ts` calls `GET /api/competency/questions/select` (curated pool, `status='approved'` only); falls back to the static `ADAPTIVE_QUESTION_BANK_V2` selector if the API errors or returns 0 rows. CareerBuilderPage L5813 seeds initial state from the local bank for SSR-safe first render, then swaps in the API payload via `useEffect`. Selector logic mirrored server-side. Picks 20 affinity-ranked questions across 7 domains. Affinity = matches on role/industry/stage/function tags against `role+industry+stage+department+subDepartment` haystack; **mismatch penalty** (tagged-but-no-match scores below untagged generalists) so non-product/non-HR users don't see strategy-flavoured items by tie-break. Two-layer freshness: (a) per-user **served-ID memory** in localStorage (`mx-assessment-served:<userId>`) skips questions already shown on prior attempts, auto-resets per-domain when pool exhausted; (b) per-user attempt counter (`mx-assessment-attempt:<userId>`) drives **tier-preserving rotation** — fresh items are bucketed by score, then rotated WITHIN each tier so high-affinity items stay clustered at top across attempts. Bumped on Retake + on Start when prior `answers`/`results` exist. Memo deps `[attemptRunId, userId]` keep mid-flow set stable. **Domain order rotated** by attempt so the "short" slot (20÷7 → 6 domains get 3, 1 gets 2) rotates across retakes. **Output interleaves domains** round-robin so the first 7 questions span all 7 competencies rather than 3 COG back-to-back.

## CAPADEX Clarity Routing & SuperAdmin Reports — 2026-05-29

Archived from the `replit.md` Feature Map on 2026-05-29 to keep the primary log lean for the next sprint. All items below are live; this is the detailed change history. (Single-select detection, proxy first-reference naming and clarify-copy cleanup also have a code-level write-up in `docs/CAPADEX.md` §18.)

### Proxy third-person clarity reframe
`rephraseForProxy` + `proxySubjectNoun` (capadex-concern-intelligence.ts) rewrite clarity question text to third person about the assessed person when `is_proxy=true` (parent/teacher/counsellor track) — self-report stems ("how confident are you that you can…") read wrong for a rater. Subject = `assessee_name` else "your child" (parent) / "your student" (teacher/counsellor) / "this person". Inserted via a sentinel so the possessive pass can't corrupt "your child"→"their child". `envelope.is_proxy`+`assessee_name` threaded into `analyzeConcern`; only `clarification_questions[].question` is rewritten (ids/options untouched → scoring + Likert routing unaffected). Self track (`is_proxy=false`) unchanged.

#### First-reference naming fix
The subject is now named at the EARLIEST "you" reference in ANY grammatical form — inverted aux (`are you`→`is <subject>`), subject+aux (`you are`→`<subject> is`), or bare subject (`you`→`<subject>`) — chosen by string index (ties broken inv→subjaux→bare). Only LATER references degrade to singular they/their/them. Previously only an inverted auxiliary named the subject, so stems opening with "When you are…" produced a leading pronoun with NO antecedent ("When **they** are… how confident does Abhi feel about **their**…", reads as plural/wrong). Now: "When **Abhi is** in a group…, how confident do they feel about their own abilities?" Verb conjugation via `AUX_THIRD_PERSON` (are→is, do→does, have→has, were→was; modals pass through). Closes with additive defensive grammar sweeps (`is is→is`, `does feel→feels`, `they is→they are`, `they has→they have`, `they does→they do`) that no-op on well-formed output. (Note: a naïve word-split rewriter naming the subject at the first bare `you` mis-handles the inverted "are you" → "are <name>"; the index-ranked form selection avoids that.)

### Persona-aware clarity filter
`pickQuestionsFromMaster` (capadex-concern-intelligence.ts) now applies a hard persona filter alongside the age filter — coarse bridge tags (e.g. `EXAMINATION_STRESS`) are shared across personas, so generic emotional concerns leaked exam-specific questions to adults. Recovers each clarity row's persona by joining `concern`→`master.concern_cluster` and keeps only rows whose concept maps to a master row in the user's `personaCohortFor(primary_persona)`; `envelope.primary_persona` threaded through `analyzeConcern`. Persona-unknown skips the filter; under-fill cascades to Tier-2/Tier-3.

### Learner concern-picker filtering
Two fixes so the IntroPhase dropdown returns rows for student/learner personas. (1) `IntroPhase.tsx` `filteredSuggestions` age-band gate now does numeric INTERVAL OVERLAP via `parseAgeRange` (canonical band like `17-24` vs master rows' arbitrary `typical_age_band` like `20-24`) instead of exact string equality, which silently dropped every master row. (2) `short-assessments.ts` (~L207) `LEGACY_PERSONA_MAP={campus:['student'],jobseeker:['student','professional']}` + array-overlap (`ca.target_personas && $n::text[]`) so IntroPhase legacy keys `campus`/`jobseeker` map onto legacy `concern_areas.target_personas` {student,parent,professional,teacher}. Note: term `scrolling` has no DB rows for any persona (content lives under `screen time`/`digital`/`distraction`) — benign keyword gap, not a filter bug.

### Seen-question exclusion + uniform variety
Schema-safe, in-memory, no migration. `analyzeConcern` gained an optional trailing `seenIds` param; new `applySeenFilterAndShuffle(questions, seenIds)` (capadex-concern-intelligence.ts ~L1438) excludes already-shown clarity ids then Fisher–Yates shuffles, applied UNIFORMLY after the 3-tier pick (master/adaptive/static) and BEFORE proxy reframe + prefill (so `inferPrefillAnswers` index alignment + proxy rewrite are unaffected). Guard: if exclusion empties the pool it keeps the unfiltered (still shuffled) set so the clarify phase never stalls. Envelope reads `seen_question_ids` (alias `answered_question_ids`), trimmed + capped 200. Options stay `string[]` (frontend `handleClarifyAnswer` contract). Career-transition→master routing was already correct (resolver dropped its orphan-bucket restriction) — verified live `master_curated`/`CONCERN_CON_1016` with real options. **Activation (live)**: `FreeAssessmentModal.handleAnalyseConcern` now persists shown clarity ids in `sessionStorage` (`SEEN_CLARITY_KEY='mx-capadex-seen-clarity'`) and POSTs them as `answeredIds` on each `/analyze`; the returned batch is merged back (Set dedup, capped 200). Because `/analyze` returns a BATCH per concern, de-dup is across analyze calls within the tab session (re-runs / other concerns), not per-question — persistence is intentional and matches "same session" (sessionStorage clears on tab close). Backend `parseAnalyzeEnvelope` accepts `answeredIds` as a third alias (besides `seen_question_ids`/`answered_question_ids`). Verified live: run 2 with run 1's ids → 0 overlap.

### Orphan bridge-tag resolver + clarity-question variety
ROOT CAUSE of "same questions repeating" — clarity questions are authored against only **56 canonical `master_bridge_tag` buckets**, but concerns carry **328 finer `relational_bridge_tag` values**. The picker joins `clarity.master_bridge_tag = concern.relational_bridge_tag`, so the **272 orphan tags (524 concerns, ~21%)** had no match → dead-ended to the generic static 3-question fallback (identical every time). FIX 1 (orphan): `resolveCoveredBridgeTag(tag)` (capadex-concern-intelligence.ts, ~L1519) maps EVERY tag → a covered bucket via 4-step resolution — (1) tag already covered → as-is; (2) hand-verified `ORPHAN_BRIDGE_TAG_FALLBACK` overrides (10 entries, e.g. `EXAMINATION_READINESS→EXAMINATION_STRESS`, `CAREER_TRANSITION→CAREER_GROWTH`, where keyword rules would mis-route); (3) prioritised `BRIDGE_TAG_KEYWORD_RULES` (24 regex→target, most-specific first); (4) ultimate `GENERAL_CONCERN` (125 real curated rows). `COVERED_BRIDGE_TAGS` Set guards every target. `pickQuestionsFromMaster` under-fill (<2) branch now calls `resolveCoveredBridgeTag(ownTag)` (skips if it resolves back to ownTag) with persona relaxed. FIX 2 (repetition): `runByTag` previously took the **first** `CLARITY_TARGET`(10) of the top-40 weighted pool — but `question_weight` has only 21 distinct values over 14k rows, so the top tier alone exceeds 10 → same 10 every run. Now Fisher–Yates shuffles the high-weight pool and samples 10, so successive analyses of the same concern vary while staying within the most-relevant questions. FIX 3 (resolver): every concern now resolves to a covered bucket, so `resolveMasterConcernIdFromText` dropped its bridge-tag WHERE restriction entirely (removed `fallbackIdx`/`fallbackTags`). Verified live: orphan concerns return `master_curated` topically-relevant Qs; same concern 3× → 3 different sets.

### Professional focus-at-work clarity seed
`backend/scripts/seed-focus-at-work-clarity.mjs` (idempotent, rollback ids `FAW_PROF_001..003`) inserts 3 workplace-focus clarity rows under `master_bridge_tag='ACADEMIC_COGNITIVE'` with `concern='Weak Ability to Sustain Focus During Long Work Hours'` — DATA fix, no code/schema change. ROOT CAUSE: "focus at work" (Working Professional) resolves to `CONCERN_LEA_602` whose tag `ACADEMIC_COGNITIVE` held ONLY academic-persona rows, so the picker's hard persona filter emptied the pool → generic static fallback. The 3 rows are the only professional-persona rows under that tag → pass persona+age filter → `master_curated`. `situational_fit` response_type, neutral equal option scores (non-ordinal qualitative options; score cols unused in master retrieval path). Verified: serves master_curated for the 4 professional focus concerns sharing the tag (LEA_602/579/650, WOR_623 — all focus/deep-work/meeting-focus themed, topically aligned); student/academic focus stays `static_fallback` with NO leakage; proxy reframe applies. Feeds existing Fisher–Yates shuffle + answeredIds exclusion + `rephraseForProxy` unchanged. Code-level detail: `docs/CAPADEX.md` §18.4.

### Ranking-hint copy removed
`CapadexClarifyPhase.tsx` — the "Tap in order of importance — most relevant first." subtitle now renders only for `isSingle` questions (~L224), and the "Tap options in order of importance" footer is hidden while a ranking question is unanswered (`!submitting && !isSingle && ranked.length===0`, ~L336) — the instruction was redundant/confusing in the new flow.

### SuperAdmin Reports Console — restore committed-missing config
`UnifiedReportsPanel.tsx` was committed missing its `SourceType` / `SOURCES` registry / `SourceTab` / `AllSourcesOverview` / `EmptySourcePanel` definitions → runtime `SOURCES is not defined`; restored. `CapadexReportsPanel.tsx` was committed missing its module-scope config block → cascading `X is not defined` runtime crashes (`NAVY_BG`, `NAVY_DARK`, `LEVEL_META`, `STAGE_META`, `STAGE_SIGN_OFFS`, `STATUS_META`, `STATUS_STEPS`, `getLevelFromScore` + icons `Minus`/`MessageSquare`/`Edit3`); all restored. Email preview (`backend/routes.ts` ~L7065) was throwing `Invalid character in header content` because the subject (`backend/email.ts` L644) contains an em-dash `—` and HTTP headers are ASCII-only; fixed by `encodeURIComponent(subject)` on the `X-Preview-Subject` header (`escapeHtml` does NOT make it header-safe). Active canon for these panels lives in the `replit.md` Feature Map.

### CAPADEX Simulation & Validation Environment (Phase 0C)
Flag-safe (`simulationHarness`, default OFF, env `FF_SIMULATION_HARNESS`) black-box harness that validates the EXISTING pipeline by driving the REAL public HTTP endpoints (start→respond→complete→report + signals/patterns/explain/analyze) — never mocks. Flag-off → admin routes 503 + SuperAdmin panel self-hides; sim sessions uniquely-emailed `sim+<tag>-<id>@simulation.metryx` and purged after each run (zero live-runtime impact). 10 personas × seeded mulberry32 profiles → stratified sample → per-run relevance/repetition/quality/confidence/coverage metrics → `evaluate`→`pass|warn|fail` persisted to `capadex_simulation_runs`. Key calibration lessons live in `docs/CAPADEX.md` §23: items are distress-worded `(-)` (simulant emits lived raw answer, engine reverse-scores); `concernMatch` is SEMANTIC because the engine remaps fine concerns onto coarse master buckets; seed-coverage (`404` at `/start`) is a distinct soft dimension, not a relevance failure. The harness is allowed to FAIL — a `fail` verdict (relevance ~0.64 vs 0.85 target; 4 spec concerns unseeded; several professional concerns mis-route to "Exam Stress") is a legitimate pre-production finding, NOT something to tune away.
