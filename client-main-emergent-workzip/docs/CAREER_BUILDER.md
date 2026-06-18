# Career Builder — Technical Documentation

**Status:** Production (additive intelligence layers feature-flagged)
**Last refresh:** 11 Jun 2026 (CGI added — see §Career Graph Intelligence)
**Related spec:** `docs/CAREER_GRAPH.md` — Career Graph Intelligence full spec (16 tables, 5 engines, API contract)
**Primary surface:** `frontend/src/pages/CareerBuilderPage.tsx` (7,891 LOC)
**Backing services:** `backend/routes/` (117 route files total; ~37 directly career-related — see §4.1), `backend/services/` (148 engines total; 43 referenced from Career Builder surfaces — see §4.2), 90+ migrations under `backend/migrations/`

---

## 1 · What Career Builder is

Career Builder is MetryxOne's behavioural-intelligence workspace for individual candidates. It sits on top of the platform's broader BIOS / CAPADEX / Workforce-OS stack and translates that stack into a single user-facing experience built around:

1. **Profile capture** — resume parsing + structured profile fields
2. **Competency assessment** — 7-domain (TEC / COG / LEA / EXE / COM / EIQ / ADP) measurement, 20 affinity-ranked questions drawn from a 63-item bank
3. **Gap analysis & growth plan** — relative to a chosen target role + career stage
4. **Adaptive intelligence views** — benchmarking, mobility, trajectory, jobs/fitment, learning velocity, mentors, market intel, visibility, AI copilot
5. **Pragati conversational coach** — escape hatch and behavioural runtime

Every output is positioned as a **developmental signal**, never a hiring, promotion, or suitability prediction. That constraint is enforced via every API response envelope (see §10).

---

## 2 · System architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│  React + Vite (frontend, port 5000)                                    │
│   ├── CareerBuilderPage.tsx (7,891 LOC monolith — being refactored)    │
│   ├── modules/career-builder/* (21 module dirs)                        │
│   ├── components/career/* (22 atomic + V2 panels)                      │
│   ├── lib/{engines×19, services×21, stores×10, events×3, hooks×2}      │
│   ├── data/catalogs/* (industry/role taxonomy, question banks ×10)     │
│   └── design-system/tokens.ts                                          │
│        │                                                               │
│        │ /api/*  proxy                                                 │
│        ▼                                                               │
│  Node + Express + tsx (backend, port 8080)                             │
│   ├── routes.ts (~22k LOC main router)                                 │
│   ├── routes/* (per-domain route modules — 37 career-related)          │
│   ├── services/* (43 engines: pure-function cores + DB helpers)        │
│   └── shared/schema.ts (Drizzle ORM, symlinked from /shared)           │
│        │                                                               │
│        ▼                                                               │
│  PostgreSQL (DATABASE_URL)                                             │
│   ├── Career Builder core (~13 tables)                                 │
│   ├── Adaptive Intelligence phases (60+ namespaced tables)             │
│   └── BIOS / CAPADEX / Pragati / Workforce-OS tables                   │
└────────────────────────────────────────────────────────────────────────┘
```

**Stack characteristics**

| Concern              | Choice / Convention                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------- |
| Frontend framework   | React 18 + Vite, TypeScript strict                                                        |
| State                | 10 Zustand stores per domain (`lib/stores/`)                                              |
| Server framework     | Express + tsx (TypeScript runtime, no build step in dev)                                  |
| ORM                  | Drizzle (`backend/shared/schema.ts`, symlinked from `/home/runner/workspace/shared`)      |
| API style            | REST, JSON, universal response envelope (§4.3)                                            |
| Auth                 | `requireAuth` middleware; UUID user IDs throughout (all `user_id` columns are `TEXT`)     |
| Migrations           | Forward-only SQL files in `backend/migrations/` — `YYYYMMDD_<topic>.sql`, append-only     |
| Feature gating       | `backend/config/feature-flags.ts` — every V2 layer has a flag; flag-off → routes 503, UI hides |

---

## 3 · Frontend topology

### 3.1 Page surfaces

| Page                                  | Path                                              | Purpose                                                  |
| ------------------------------------- | ------------------------------------------------- | -------------------------------------------------------- |
| `CareerBuilderPage`                   | `?screen=career-builder` (default after login)    | The Career Builder workspace itself (tabbed UI)          |
| `OntologyExplorerPage`                | `?screen=ontology-explorer`                       | Browse global role / competency ontology                 |
| `BenchmarkDashboardPage`              | `?screen=benchmark-dashboard`                     | Adaptive benchmarking + Phase 3 contextual scoring panel |
| `CareerMobilityPage`                  | `?screen=career-mobility`                         | Role transitions, adjacency, pathways                    |
| `TrajectoryDashboardPage`             | `?screen=trajectory-dashboard`                    | Longitudinal trajectory + velocity                       |
| `WorkforceInsightsPage`               | `?screen=workforce-insights`                      | Workforce analytics (read-only consumer view)            |
| `EnterpriseIntelligencePage`          | `?screen=enterprise-intelligence`                 | Phase-5 enterprise console (governance + explainability) |
| `WorkforceOSPage`                     | `?screen=workforce-os`                            | Multi-tenant Workforce OS (Phase 5 + V2 predictive + audit) |
| `ScientificCompetencyPage`            | `?screen=scientific-competency`                   | Psychometric Phase 2 console                             |
| `MarketIntelligencePage`              | `?screen=market-intelligence`                     | Market signals, evidence graph, mobility 2.0             |
| `AIGovernancePage`                    | `?screen=ai-governance`                           | Phase 4 governance + fairness                            |
| `EnterpriseWorkforceOSPage`           | `?screen=enterprise-workforce-os`                 | Phase 5 enterprise + AI coaching + executive decision    |
| `MentorMarketplacePage`               | `?screen=mentor-marketplace`                      | Mentor browse + booking                                  |

Plus admin pages outside Career Builder proper (`EnterpriseHiringPage`, `GovernanceConsolePage`, `WorkforceAnalyticsPage`).

### 3.2 The Career Builder page itself

`CareerBuilderPage.tsx` is a tab-routed workspace. The `TabId` union (lines 70–76) lists **19 canonical tab values**, in source order:

```ts
type TabId =
  | 'dashboard' | 'profile' | 'skills' | 'resume'
  | 'jobs' | 'interview' | 'learning' | 'pathways'
  | 'mentors' | 'goals' | 'assessment'
  | 'future-map' | 'development' | 'visibility'
  | 'fresher-hub'
  | 'simulations' | 'market-intel' | 'velocity' | 'workforce';
```

| Tab                | Mounts                                                                                  | Purpose                                                  |
| ------------------ | --------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `dashboard`        | `modules/career-builder/dashboard`                                                      | Landing — KPIs, stage card, peer benchmark, EI gauge, "Show me how" |
| `profile`          | `modules/career-builder/profile`                                                        | Structured profile editor                                |
| `skills`           | inline (uses `competencyEngine` + skill catalogs)                                       | Skills inventory + gap surface                           |
| `resume`           | `modules/career-builder/resume` + `components/career/ResumeStudio.tsx`                  | Resume upload + zety-style studio                        |
| `jobs`             | `modules/career-builder/jobs` + `FitmentInsightsPanel`                                  | Job tracker + Fitment Intelligence Panel                 |
| `interview`        | `modules/career-builder/interview`                                                      | Interview prep + question bank                           |
| `learning`         | `modules/career-builder/learning`                                                       | Courses catalogue + adaptive IDP plan                    |
| `pathways`         | `modules/career-builder/pathways`                                                       | Lateral / vertical career paths                          |
| `mentors`          | `modules/career-builder/mentors`                                                        | Mentor search + booking                                  |
| `goals`            | `modules/career-builder/goals`                                                          | IDP + goal tracking                                      |
| `assessment`       | `modules/career-builder/competency`                                                     | Competency assessment runtime (setup → questions → result) |
| `future-map`       | `modules/career-builder/future-map`                                                     | 1/3/5-year scenarios                                     |
| `development`      | `modules/career-builder/development`                                                    | Adaptive IDP plan                                        |
| `visibility`       | inline (`visibilityEngine`)                                                             | Profile-visibility / discoverability surface             |
| `fresher-hub`      | `modules/career-builder/fresher`                                                        | Fresher / entry-level specific intelligence              |
| `simulations`      | `modules/career-builder/simulations`                                                    | What-if salary / skill investment                        |
| `market-intel`     | inline (delegates to `MarketIntelligencePage` content)                                  | In-tab market intel summary                              |
| `velocity`         | inline (`learningVelocityEngine`)                                                       | Learning + growth velocity                               |
| `workforce`        | `modules/career-builder/workforce`                                                      | Predictive workforce dashboard + EWOS V2 dashboard       |

**Module dirs that are NOT canonical tabs** (mounted within other tabs, dispatched via dedicated pages, or scaffold for future tabs): `analytics`, `ai-copilot`, `benchmarking`, `intelligence`, `memory`, `recruiter`, `transformation`. The Phase 2/3/4/5 dashboards (`BenchmarkDashboardPage`, `TrajectoryDashboardPage`, `MarketIntelligencePage`, `AIGovernancePage`, `EnterpriseIntelligencePage`, `WorkforceOSPage`, `EnterpriseWorkforceOSPage`, `ScientificCompetencyPage`, etc.) are top-level routes reached via `?screen=…` deep-links, not tabs inside Career Builder.

> **Tab-name canon (do not regress):** never `tracker` (use `jobs`), never `mentor` (use `mentors`), never `fresher` (use `fresher-hub`), never `benchmarking` as a tab (it's a module dir + the dedicated `BenchmarkDashboardPage`). All deep-link targets (`StageGuidancePanel`, `FitmentInsightsPanel`, EI provenance links) must use canonical `TabId` values.

### 3.3 Foundation layers

> Counts below exclude barrel `index.ts` files (e.g. `lib/services/index.ts`, `data/catalogs/index.ts`).

| Layer                | Path                                              | Inventory                                                 |
| -------------------- | ------------------------------------------------- | --------------------------------------------------------- |
| Design system        | `frontend/src/design-system/tokens.ts`            | `COLOR`, `TYPOGRAPHY`, `SPACING`, `RADIUS`, `SHADOW`, `BREAKPOINTS`, `ANIMATION`, `CHART`, `EI_BANDS` + `getEIBand()` |
| Shared career UI     | `frontend/src/components/career/`                 | 22 components — atomic: `Chip`, `MetricCard`, `SectionCard`, `SkillBar`, `EmptyState`, `LoadingState`, `ErrorState`, `TabLayout`, `HeatMap`, `ProgressTimeline`. Composed: `EIGauge`, `EIProvenanceCard`, `DashboardIntro`, `InsightCard`, `BenchmarkCard`, `RecommendationCard`, `IntelligencePanel`. V2 panels: `ContextualBenchmarkV2Panel`, `WorkforceOSV2Panel`. Feature: `AssessmentCombobox`, `FitmentInsightsPanel`, `ResumeStudio`. Subdirs: `resume/` (`addons`, `library`, `templates`), `visualizations/` (`BenchmarkComparison`, `CompetencyHeatmap`, `GrowthTimeline`, `PercentileGraph`, `RadarChart`, `TrajectoryMap`). |
| Catalogs             | `frontend/src/data/catalogs/` (10 files)          | `industryRoles.ts`, `benchmarks.ts`, `interview-questions.ts`, `courses.ts`, `pathways.ts`, `mentors.ts`, `locations.ts`, `assessment-questions.ts` (V1), `assessment-question-bank-v2.ts` (V2, 63 items), `job-stages.ts` |
| Engines (pure)       | `frontend/src/lib/engines/` (19 engines)          | `scoringEngine`, `benchmarkEngine`, `benchmarkIntelligenceEngine`, `employabilityEngine`, `fitmentEngine`, `futureMapEngine`, `idpEngine`, `adaptiveIDPEngine`, `recommendationEngine`, `learningVelocityEngine`, `profileIntelligenceEngine`, `resumeIntelligenceEngine`, `visibilityEngine`, `successSignatureEngine`, `careerTrajectoryEngine`, `longitudinalIntelligenceEngine`, `workforceEngine`, `competencyEngine`, `explainableScoringEngine` |
| Services             | `frontend/src/lib/services/` (21 wrappers)        | `assessmentOptionsService`, `competencyService`, `competencyRuntimeV2Service`, `adaptiveAssessmentV2Service`, `contextualBenchmarkV2Service`, `workforceOsV2Service`, `benchmarkService`, `fitmentService`, `genomeService`, `idpService`, `intelligenceService`, `profileService`, `simulationService`, `transformationService`, `visibilityService`, `workforceService`, `adaptiveRuntimeAuthorityService`, `competencyGraphService`, `dynamicAssessmentService`, `roleDNAService`, `ucipService` |
| Stores               | `frontend/src/lib/stores/` (10 Zustand)           | `authStore`, `profileStore`, `competencyStore`, `competencyRuntimeStore`, `benchmarkStore`, `intelligenceStore`, `simulationStore`, `idpStore`, `workforceStore`, `uiStore` |
| Event pipeline       | `frontend/src/lib/events/` (3 files)              | `eventBus.ts` (typed bus), `careerEvents.ts`, `adaptiveIntelligenceEvents.ts` (pub/sub mirror of backend Phase-4 event bus) |
| Hooks                | `frontend/src/lib/hooks/` (2 hooks)               | `useHybridEI.ts` — hybrid client/server Employability Index hook; `useUCIP.ts` — Unified Career Intelligence Profile hook |
| Intelligence (Career OS) | `frontend/src/lib/intelligence/` (5)          | `behaviorGraph.ts` (P2 — typed read-only client over the backend Unified Behavior Graph), `constraintEngine.ts` (P3 — pure "Why am I stuck?" constraint deriver), `unifiedActionEngine.ts` (P4 — merges backend Top-5 + weekly + constraint hand-offs into one ranked plan), `progressLedger.ts` (P5 — one unified growth timeline across 5 axes), `outcomeAttributionEngine.ts` (P6 — links actions → metric movement, net of baseline drift). Orchestration / reshaping only — never recompute; best-effort & null-safe (see §3.5). |
| Custom-entry storage | `frontend/src/lib/customEntries.ts`               | localStorage-backed user-added roles/industries          |

### 3.4 Module convention

Every directory under `modules/career-builder/` follows the same shape:

```
modules/career-builder/<feature>/
  components/   # feature-specific UI
  hooks/        # reactive hooks bound to stores/services
  services/     # api calls (when not shared)
  stores/       # local zustand slice (when not shared)
  types/        # local TS types
  utils/        # pure helpers
  views/        # top-level views (rendered by CareerBuilderPage)
```

Inventory: 21 module dirs — `ai-copilot`, `analytics`, `benchmarking`, `competency`, `dashboard`, `development`, `fresher`, `future-map`, `goals`, `intelligence`, `interview`, `jobs`, `learning`, `memory`, `pathways`, `profile`, `recruiter`, `resume`, `simulations`, `transformation`, `workforce`.

### 3.5 Career OS layer (additive — orchestration over existing engines)

The **Career OS** is an additive aggregation/decision layer built on top of the existing engines and APIs. It adds **no new dashboards** and **no breaking changes**; every piece degrades to prior behaviour when its data is absent. Full roadmap & phase order (P2 → P3 → P4 → (P5 ∥ P6) → P7 → P8): `reports/career-os-architecture-blueprint.md`.

- **Career Brain** `frontend/src/lib/services/useCareerBrain.ts` — one hook fusing profile · resume · competency · BIOS signals · CAPADEX patterns · market · jobs into a single decision-ready `CareerBrain`. Best-effort & defensive: never throws, sane defaults when data is missing. Reads `GET /api/competency/score/:userId`, `/api/career/behavioural-memory/:userId`, `/api/career/behavior-profile/:userId`, and the Behavior Graph (below).
- **5-Zone workspace** — the sidebar groups tabs into 5 zones (Command Center / Profile Studio / Intelligence Hub / Execution Engine / Growth & Memory). Additive `TabId` values extend the canon in §3.2: `weekly-plan`, `next-actions`, `behavioral-growth`, `career-memory`. All existing tabs and deep-links are preserved (additive only).
- **Behavior Graph — P2** `frontend/src/lib/intelligence/behaviorGraph.ts` — a typed **read-only client** over the canonical backend Unified Behavior Graph (`backend/services/behavior-graph-service.ts`), **not** a recomputation. `fetchBehaviorGraph(userId)` → `GET /api/career/behavior-graph/:userId` (`requireAuth` + `resolveEffectiveUserId` IDOR guard); `assembleBehaviorGraph()` reshapes it into `{strengths, risks, patterns, contradictions, growthDrivers, growthBlockers, competencySignals, meta}`. Returns `null` on any failure / no linked session → no behaviour change. **Strengths = CSI `positive_factors` ONLY** (CAPADEX concern signals are diagnostic, never strengths). Wired as the additive nullable `behaviorGraph` field on `CareerBrain`.
- **Constraint Engine — P3** `frontend/src/lib/intelligence/constraintEngine.ts` — pure, deterministic `deriveConstraints(graph, brain, ctx)` answering **"Why am I stuck?"**. Reshapes already-computed data (no new compute, no fetch, never throws) into a ranked `ConstraintReport` over 5 `ConstraintType`s — `behavior` / `skill` / `experience` / `execution` / `confidence`. Each constraint's `rootCause` is **non-generic** (names the actual signal / skill / value); `severity` derives from impact × evidence strength; `primary` = top score (tie-break behaviour → execution → skill → confidence → experience). Surfaced additively in the existing **`BehavioralGrowthTab`** ("Why am I stuck?" card); `CareerBuilderPage` passes optional `profile` / `openJobs` (=`openJobsCount`) / `eiScore` props so the experience / pipeline-stagnation / low-EI branches can fire. `recommendedActions` are deterministic hints consumed by **P4 (Unified Action Engine)** below.
- **Unified Action Engine — P4** `frontend/src/lib/intelligence/unifiedActionEngine.ts` — pure, deterministic `buildUnifiedActions(brain, ctx, report?)` fusing the three action sources the Career OS **already** produces into ONE ranked, deduped `UnifiedAction[]` — **no new scoring model**. Sources: (1) **library-backed CAPADEX interventions** — the existing backend Top-5 ranker (`intervention-intelligence.ts` → `capadex_intervention_recommendations`, generated on session completion), now surfaced via the additive read endpoint `GET /api/career/next-actions/:userId` (`behavioural-memory.ts`; reuses `resolveEffectiveUserId` IDOR guard + the `buildBehaviorGraphForUser` user→latest-session bridge; `actions:[]` when no linked session / no library match — never generic) → fetched best-effort into the additive `bestNextActions` field on `CareerBrain`; (2) **weekly ROI moves** (`weeklyActionEngine.ts`); (3) **constraint hand-offs** (P3 `recommendedActions`). Tier bands keep authority intact: interventions lead (priority 0.50–1.00), weekly ROI interleaves (0.30–0.70 so a top-ROI lever can outrank a *weak* intervention but never a strong one), constraints fill (0.25–0.50). **Graceful degradation contract**: when `bestNextActions` is empty the engine emits **weekly-only** in identical ROI order (constraints are gated on backend presence) → exact prior behaviour. Consumed by the existing **`NextBestActionsTab`** (library-backed actions carry a "CAPADEX intervention" provenance pill); `WeeklyActionPlanTab` and all other `CareerBrain` consumers are unchanged.
- **Progress Ledger — P5** `frontend/src/lib/intelligence/progressLedger.ts` — pure, deterministic `buildProgressLedger({ snapshots })` reshaping the DB-backed behavioural-memory **snapshot history** (NOT the legacy in-memory `career-memory.ts`) into ONE unified growth timeline over 5 axes — `learning` / `behavior` / `career` / `competency` / `employability`. Each `LedgerEntry` is `{ ts, axis, metric, value, delta, evidence }`; deltas are computed **per metric series** vs the previous reading (career axis carries `market_readiness` + `transition_probability`, the latter stored 0..1 and scaled ×100 for comparable display; `employability` ← `ei_score`; `behavior` ← `interview_readiness`; `learning` ← mean realized `outcomes[].strength`×100). `summary` exposes `byAxisDelta` / `netImprovement` / `topMover`. Reuses `EvidenceRef` (P2). Returns **null** when `<2` snapshots (nothing to trend). Best-effort standalone fetch `fetchProgressLedger(userId)` reuses the same IDOR-guarded `GET /api/career/behavioural-memory/:userId` — **no new endpoint/table**.
- **Outcome Attribution — P6** `frontend/src/lib/intelligence/outcomeAttributionEngine.ts` — pure, deterministic `attributeOutcomes({ ledger, actionLog, learningAttribution? })` linking completed actions → measurable metric movement: for each action it finds the **nearest post-action movement within a 45-day window** across moved metric series, nets out that **metric's baseline drift** (mean per-step delta — keyed per `axis::metric` so `market_readiness` never contaminates `transition_probability`), and scores `confidence = proximity·0.6 + isolation·0.4`, lifted when a stored outcome backs it. `method` ∈ `pre_post` / `intervention_outcome_score` / `learning_attribution`; `explanation` is **non-generic** (names the action, metric and Δ). `deriveActionLog(snapshots)` treats each snapshot's interventions as actions observed at snapshot time and attaches the snapshot's mean outcome strength as `outcomeScore`. **NB**: the action→effectiveness loop is already closed server-side (`intervention-intelligence.ts` folds `capadex_interventions.outcome_score` into `historicalEffectiveness`) — P6 only **surfaces/explains** it, does not re-rank P4. Returns `[]` on `<2` snapshots. Both surfaced additively in the existing **`CareerMemoryTab`** ("Growth timeline" + "What moved your metrics" cards, built from the snapshots the tab already fetches — no extra requests; cards render only when non-empty).

---

## 4 · Backend topology

### 4.1 Route files (`backend/routes/`)

Routes are split per-domain. Each file exports a `register<Name>Routes({ app, pool, requireAuth })` function, all registered from `backend/routes.ts` (~215 `register*Routes` calls in total). The Career Builder slice consumes the following ~40 files (representative subset of the 117 total under `backend/routes/`):

| File                                       | Purpose                                                 |
| ------------------------------------------ | ------------------------------------------------------- |
| `career-profile.ts`                        | CRUD over `career_profiles`                             |
| `career-seeker.ts`                         | Seeker-specific profile + assessment glue               |
| `career-intelligence.ts`                   | Aggregator endpoint composing engine outputs            |
| `career-trajectory.ts` / `career-velocity.ts` / `career-memory.ts` | Trajectory + velocity + memory timeline |
| `career-benchmark.ts` / `adaptive-benchmark.ts` | Benchmarking layers (peer-benchmark surfaces composed in route handlers) |
| `career-workforce.ts` / `workforce-analytics.ts` / `workforce-os.ts` / `workforce-os-v2.ts` | Workforce surfaces (Phase 5 + V2 predictive depth) |
| `career-genome.ts`                         | Genome (skill/competency vector) view                   |
| `career-success.ts`                        | Success-signature surface                               |
| `career-simulations.ts`                    | What-if simulations                                     |
| `career-stage-guidance.ts`                 | Orchestrator for micro-accurate Show-Me-How (per `docs/MICRO_ACCURATE_STAGE_GUIDANCE.md`) |
| `competency-assessment-runtime.ts`         | Legacy `/api/competency/*` runtime (V1)                 |
| `competency-runtime-v2.ts`                 | V2 contextual DNA runtime                               |
| `competency-cohorts.ts` / `competency-ontology.ts` | Cohorts + ontology                              |
| `contextual-benchmark-v2.ts`               | Phase-3 contextual scoring V2 routes                    |
| `global-ontology.ts`                       | Phase-1 enhancement: global role ontology               |
| `m3-market-intelligence.ts`                | Phase-3 market intelligence + evidence graph + mobility 2.0 |
| `m4-ai-governance.ts`                      | Phase-4 governance + localization + predictive + simulation |
| `m5-enterprise-workforce.ts`               | Phase-5 enterprise + AI coaching + executive decision    |
| `enterprise-workforce-os.ts`               | Phase-8 enterprise workforce OS V2                      |
| `scientific-competency.ts`                 | Phase-2 psychometric                                    |
| `adaptive-assessment.ts` / `adaptive-assessment-v2.ts` | Adaptive runtime endpoints (V1 + V2) |
| `ai-assessment-v2.ts`                      | AI inference V2 (heuristic) routes                      |
| `assessment-writer.ts`                     | Snapshot bridge writes (`user_assessment_snapshots`, `user_competency_scores`) |
| `behavioural-intelligence.ts`              | BIOS surface for Career Builder                         |
| `cognitive-intelligence.ts`                | Cognitive load + reasoning chain endpoints              |
| `csi.ts`                                   | Career Stage Index                                      |
| `ei-governance.ts` / `ei-resolution.ts`    | Employability Index governance + provenance/resolution  |
| `enterprise-intelligence.ts`               | Phase 5 enterprise governance console                   |
| `predictive-intelligence.ts` / `predictive-intelligence-v2.ts` | Predictive layers (V1 + V2)        |
| `recruiter-postings.ts`                    | `/api/career/recruiter-postings` (lazy `employer_jobs`) |

### 4.2 Services (`backend/services/`)

Pattern: every engine is a **pure-function core** plus **thin DB helpers**. No engine holds state; every call is parametric. The Career Builder surfaces reference **~43 engines** (out of 148 total under `backend/services/`), grouped by concern:

- **Assessment runtime** — `adaptive-assessment-engine`, `assessment-blueprint-engine`, `assessment-runtime-orchestrator`, `question-generation-engine`, `behavioral-signal-engine`
- **Competency core** — `competency-resolution-engine`, `competency-confidence-engine`, `competency-graph-engine`, `competency-graph-engine-v2`, `competency-forecasting-engine`, `dynamic-weight-engine`, `contextual-weight-engine`, `runtime-explainability-engine`
- **Scoring & benchmarking** — `contextual-scoring-engine`, `contextual-norm-engine`, `dynamic-cohort-engine`, `reliability-engine`, `stability-analysis-engine`, `psychometric-intelligence-engine`, `bayesian-inference-engine`, `bars-engine`
- **Orchestration** — `competency-intelligence-orchestrator`, `competency-intelligence-profile-engine`
- **EI & explainability** — `ei-engine`, `explainability-engine`
- **Workforce OS (Phase 5 + V2)** — `market-intelligence-engine`, `predictive-workforce-engine`, `fairness-monitoring-engine`, `dispute-override-engine`, `enterprise-workforce-os-engine`
- **Predictive / readiness** — `predictive-competency-engine`, `predictive-readiness-engine`, `scenario-modeling-engine`, `causal-recommendation-engine`
- **Mobility & roles** — `mobility-engine`, `pathway-engine`, `role-fit-engine`, `trajectory-engine`, `ontology-engine`
- **Signal / inference** — `resume-signal-engine`, `intervention-engine`, `rie-opportunity-engine`, `recommendation-engine`

(For the conversational + GitHub/LinkedIn/portfolio inference engines under AI Inference V2 — `ai-competency-inference-engine`, `ai-reasoning-engine`, `conversational-assessment-engine`, `github-competency-analyzer`, `linkedin-intelligence-engine` — see §8.2.)

### 4.3 Response envelope (universal)

Every JSON response across V2 layers carries:

```ts
{
  ok: boolean,
  ...payload,
  methodology_versions: { <engineName>: 'v1.x.y', ... },
  language_policy: {
    allowed:    ['developmental signal', 'cohort percentile', ...],
    disallowed: ['hiring recommendation', 'promotion ranking', 'pass/fail verdict', ...]
  },
  feature_flag: <flagKey>
}
```

Errors use a parallel `errorEnvelope()` so 503/4xx/5xx carry the same metadata. Flag-off routes return 503; `/feature-flag` + `/_meta/versions` always remain public for UI-side gating. Heuristic-only layers add `language_policy.inference_mode = 'heuristic'`.

---

## 5 · Data model

### 5.1 Career Builder core schema (`20260519_career_builder_schema.sql`)

13 normalised tables anchoring profiles, assessments, scoring history, recommendations, IDP. The schema is the source of truth for V1; V2 layers append namespaced tables and read these as inputs.

### 5.2 Phase index (additive layers)

All detailed build logs live in `docs/phase-history.md`. The live doc keeps only pointers. Migrations are listed chronologically:

| Layer                                              | Table namespace                                                                                                                   | Migration                                                  | Frontend page / panel                                  |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| Phase 1 — Ontology & taxonomy                      | `onto_*`                                                                                                                          | `20260523_competency_ontology_phase1.sql` (+ `_fix`, `_seed`) | OntologyExplorerPage                                |
| Phase 2 — Adaptive benchmarking                    | `bench_*`                                                                                                                         | `20260524_adaptive_benchmark_phase2.sql` (+ `_seed`)       | BenchmarkDashboardPage                                 |
| Phase 3 — Mobility / pathways                      | `mobility_*`                                                                                                                      | `20260525_mobility_phase3.sql` (+ `_seed`)                 | CareerMobilityPage                                     |
| Phase 4 — Longitudinal + workforce                 | `p4_*`                                                                                                                            | `20260526_intelligence_phase4.sql` (+ `_seed`)             | TrajectoryDashboardPage, WorkforceInsightsPage         |
| Phase 4 — Adaptive causal                          | `causal_*`                                                                                                                        | `20260528_adaptive_causal_phase4.sql`                      | (backend orchestration)                                |
| Phase 5 — Enterprise + governance                  | `gov_*`, `p5_*`                                                                                                                   | `20260527_intelligence_phase5.sql` (+ `_seed`)             | EnterpriseIntelligencePage                             |
| Phase 5 — Workforce OS (multi-tenant)              | `wos_*`                                                                                                                           | `20260529_workforce_os_phase5.sql`                         | WorkforceOSPage                                        |
| Phase 6 — Role requirements                        | `role_*`                                                                                                                          | `20260530_role_requirements_phase6.sql`                    | (backend; consumed by `role-fit-engine`)               |
| Phase 1 enh. — Global role ontology                | `gro_*`                                                                                                                           | `20260601_global_ontology_phase1.sql`                      | CAPADEX profile selectors                              |
| Phase 2 — Scientific competency                    | `sci_*`                                                                                                                           | `20260605_scientific_competency_phase2.sql`                | ScientificCompetencyPage                               |
| Phase 3 — Market intel + evidence                  | `m3_*`                                                                                                                            | `20260610_market_intelligence_phase3.sql`                  | MarketIntelligencePage                                 |
| Phase 4 — AI governance + simulation               | `m4_*`                                                                                                                            | `20260615_ai_governance_phase4.sql`                        | AIGovernancePage                                       |
| Phase 5 — Enterprise WOS + AI coaching             | `m5_*`                                                                                                                            | `20260620_enterprise_workforce_phase5.sql`                 | EnterpriseWorkforceOSPage                              |
| Assessment writers (bridge)                        | `user_assessment_snapshots`, `user_competency_scores`                                                                             | `20260621_assessment_writers.sql`                          | (writes from `submitAssessment`)                       |
| Competency Assessment Runtime (V1)                 | `cra_profiles`, `cra_scores`                                                                                                      | lazy `CREATE TABLE IF NOT EXISTS`                          | CareerBuilderPage AssessmentTab                        |
| Competency Runtime V2                              | `competency_runtime_contexts`, `role_dna_profiles_v2`, `competency_runtime_weights`, `competency_context_modifiers`, `competency_resolution_history` | `20260630_competency_runtime_v2.sql`        | `V2ContextPreview` (debug-only)                        |
| Adaptive Assessment Runtime V2                     | `assessment_blueprints_v2`, `adaptive_question_pools`, `competency_signal_capture`, `behavioral_assessment_signals`, `assessment_explainability_logs`, etc. | `20260705_assessment_blueprint_v2.sql` | `AdaptiveAssessmentRuntime` (debug-only)               |
| Contextual scoring V2                              | `competency_norm_contexts`, `contextual_benchmark_cohorts`, `competency_percentile_distributions_v2`, etc.                        | `20260710_contextual_scoring_v2.sql`                       | `ContextualBenchmarkV2Panel`                           |
| Adaptive Orchestration V2                          | `adaptive_intelligence_events`, `intelligence_orchestration_logs`, `competency_graph_nodes/edges`, `orchestration_failures`, etc. | `20260715_adaptive_orchestration_v2.sql`                   | (backend + `lib/events/adaptiveIntelligenceEvents.ts`) |
| Workforce OS V2                                    | `wos_v2_*` (market forecasts, scenarios, fairness drift, dispute SLA, ABAC policies, learning attribution)                        | `20260715_workforce_os_v2.sql`                             | `WorkforceOSV2Panel`                                   |
| AI Inference V2                                    | `ai_inferred_competencies`, `behavioral_inference_profiles`, `conversational_assessment_sessions`, `ai_reasoning_chains`, etc.    | `20260720_ai_inference_v2.sql`                             | `intelligence/views/AICompetencyInsights.tsx`          |
| Phase 6 — Predictive Intelligence V2 (heuristic)   | `competency_forecasts`, `readiness_predictions`, `burnout_risk_models`, `skill_decay_models`, etc.                                | `20260725_predictive_intelligence_v2.sql`                  | `workforce/views/PredictiveWorkforceDashboard.tsx`     |
| Phase 7 — Governance Science V2 (heuristic)        | `psychometric_models`, `fairness_evaluations`, `explainability_chains`, `ai_decision_audits`, etc.                                | `20260730_governance_science_v2.sql`                       | `intelligence/views/GovernanceDashboard.tsx`           |
| Phase 8 — Enterprise WOS V2 (heuristic)            | `wos_tenant_profiles`, `wos_capability_risk`, `wos_executive_briefs`, `wos_resilience_scores`, etc.                               | `20260805_enterprise_workforce_os.sql`                     | `workforce/views/EnterpriseWorkforceOSDashboard.tsx`   |
| Phase 5 WOS Hardening                              | adds `escalated_at`/`escalation_level`/`escalation_target`/`last_sla_check_at` on `wos_disputes`                                  | `20260810_dispute_sla_escalation.sql`                      | `WorkforceOSPage` adds `audit` tab (8th)               |
| Competency Runtime V2 — Core gap-fill              | `runtime_explainability_logs`, `competency_profile_versions`                                                                      | `20260825_competency_runtime_v2_core.sql`                  | (backend; extends `competency-runtime-v2.ts`)          |
| Adaptive Runtime V2 — Phase 2 gap-fill             | `dynamic_question_generation_logs`, `ai_report_generations`                                                                       | `20260830_adaptive_runtime_v2.sql`                         | (backend; `services/question-generation-engine.ts`; adds `POST /api/v2/assessment/next` + `/respond` + `GET /api/v2/report/intelligence/:sessionId`) |
| Enterprise Adaptive Intelligence — Phase 3 gap-fill| `workforce_capability_graphs`, `organizational_readiness_profiles`, `intelligence_refresh_state`                                  | `20260905_enterprise_adaptive_intelligence.sql`            | (backend; alias `services/predictive-readiness-engine.ts`, `services/explainability-governance-engine.ts`) |
| Competency Taxonomy Expansion (299 canonical comps)| extends `onto_domains` / `onto_families` / `onto_competencies`                                                                    | `20260920_competency_taxonomy_expansion.sql`               | `OntologyExplorerPage` (auto-reflects via `/api/ontology/*`) |
| Competency Question Curation                       | extends `competency_question_templates` (adds `status` / `source` / `reviewed_by` / `reviewed_at` / `notes`)                       | `20260524_competency_question_curation.sql`                | `CompetencyQuestionsPanel` (SuperAdmin → Assessment Config) |

**Schema contracts**

- All `user_id` columns are `TEXT` (UUIDs).
- All V2 tables are `CREATE TABLE IF NOT EXISTS` and idempotent.
- History tables (`p4_competency_history`, `m3_*` history, `intelligence_snapshots_v2`, `assessment_explainability_logs`, `scoring_explainability_v2`, `ai_reasoning_chains`, `runtime_explainability_logs`, `competency_profile_versions`, `dynamic_question_generation_logs`, `ai_report_generations`) are **append-only — never mutated in place**.

---

## 6 · Assessment flow

### 6.1 Setup (AssessmentTab)

`AssessmentTab` in `CareerBuilderPage.tsx` (~L5476+) renders:

1. Header (title + 1-line description + "Edit profile" pill)
2. **"How this works"** instructions panel — 4 numbered steps + 7-domain legend + developmental-signals disclaimer
3. **Profile snapshot — verify & update** (when `profileLoaded === true`):
   - emerald-gradient header strip with avatar/initials + completeness bar
   - identity row (name/email/location/phone from `profile.personal`)
   - professional summary excerpt (280 char)
   - most-recent-role + highest-education two-column block
   - skills block: first 12 technical (indigo chips) + first 10 soft (violet chips)
   - counts strip for certifications / projects / achievements / languages
   - footer: "Re-upload resume" + "Update profile" CTAs (→ `resume` / `profile` tabs)
   - empty-field fallbacks ("Not set") for missing values
4. Optional amber "add your profile first" prompt (when `profileLoaded === false`)
5. **Section 1 · About you** (collapsible) — Age band / Geography / Education / Gender chips (all `allowClear`)
6. **Section 2 · Your current role** (required) — Current Role + Industry comboboxes, Org Layer + Org Maturity (required chips), Team Size + Work Arrangement (optional chips), Total Experience + Tenure-in-role (`NumberStepper`, 0–60 yrs / 0–600 mo), Primary Skills (comma-separated, 1000 char), Primary Responsibilities textarea (2000 char — auto-filled from resume)
7. **Section 3 · Where you're heading** (required) — Target Role + Career Stage comboboxes, Target Timeline chips, "What you want to be doing" textarea (2000 char, live word-count guidance, target 60–120 words)
8. **Action footer** — meta strip (~15–20 min · Auto-saved · Confidential · Tailored) + Start Assessment button + inline validation feedback

#### Validation contract

Six fields are **required**:

| Key            | Validation                                                       |
| -------------- | ---------------------------------------------------------------- |
| `currentRole`  | catalog match OR user-added custom                               |
| `industry`     | catalog match OR user-added custom                               |
| `orgLayer`     | non-empty                                                        |
| `orgMaturity`  | non-empty                                                        |
| `targetRole`   | catalog match OR user-added custom                               |
| `careerStage`  | strict canonical (`stageValues` set — fixed scoring taxonomy)    |

The Start button is **always clickable** (gray when invalid). On click with missing fields it sets `triedSubmit`, scrolls + rings the first missing field, flips all required labels from amber "needed" to red "required — please fill" (animate-pulse), and surfaces an inline summary listing exactly which fields are missing. Successful start resets `triedSubmit`. Click during catalog load is a no-op.

#### Auto-fill from profile

`deriveAssessmentDefaults(profile)` returns: `currentRole / targetRole / industry / careerStage / experienceYears / tenureMonths / educationLevel / orgLayer / currentResponsibilities` + per-field `sources`. Auxiliary helpers: `parseMonthYear`, `monthsBetween`, `deriveTenureMonths`, `deriveEducationLevel`, `deriveOrgLayer`, `extractCurrentResponsibilities` (walks all experience entries, decodes HTML entities, collapses bullets/newlines).

The re-sync `useEffect` honours `editedFields` so manual edits never get clobbered, and unconditionally re-applies defaults on profile re-upload. An "N auto-filled · M still need input" banner above Section 1 mirrors the Start button's gating exactly (single source of truth: `missingRequired`).

#### Predictive typeahead UX

The 4 role/industry/stage setup fields render as **input-first predictive fields** via `AssessmentCombobox.tsx`:

- Popover opens on focus, filters live as user types
- Arrow/Enter forwarded to a hidden `cmdk` `CommandInput` so keyboard navigation works without focus leaving the visible input
- Popover width anchored to input via `getBoundingClientRect`
- Custom entries shown at top of popover under "Your custom roles/industries" with violet **Custom** chip + inline ✕ to remove

#### Industry / role catalog

`frontend/src/data/catalogs/industryRoles.ts` — generated from `attached_assets/industrial_breakup_*.xlsx`. Tree: `INDUSTRY_TAXONOMY[] → departments[] → subDepartments[] → roles[]`; flat `ALL_ROLES` carries `{title, industry, department, subDepartment}`. Currently seeds Information Technology (IT / SaaS / AI) — 4 departments, 100 roles. Extensible (add more industries to xlsx → re-run extractor).

#### Custom entries

`frontend/src/lib/customEntries.ts` — localStorage-backed (`mx-custom-roles`, `mx-custom-industries`) with title-case normalisation, case-insensitive dedupe, 50-entry cap. The 3 freeform fields (Current Role, Target Role, Industry) ship with `allowFreeText={true}`. Selected-custom state shows a violet "custom" badge + caption *"custom role/industry — peer benchmarks build as more candidates pick this"*. Customs carry no industry/department/sub-dept metadata so adjacency suggestions + auto-link fall back gracefully.

#### Auto-link role → industry

When a user picks a current role with a catalog match, Industry auto-fills with the role's `industryName` (if user hasn't edited Industry). Department / sub-dept surface as the field caption (e.g. *Engineering · Backend*). On submit, profile payload at `/api/competency/profile/:userId` carries `currentDepartment / currentSubDepartment / targetDepartment / targetSubDepartment` as additive context (currently accepted but unused by `ROLE_PRIORITIES`; reserved for future weighting).

### 6.2 Question selection (DB-backed, with static fallback)

**Pipeline (rev May 2026 — DB-backed)**

- Primary: `selectAssessmentQuestionsFromAPI` in `frontend/src/lib/assessmentSelector.ts` calls `GET /api/competency/questions/select` (curated server-side pool, `status='approved'` only).
- Fallback: if the API errors or returns 0 rows, the local static selector runs against `ADAPTIVE_QUESTION_BANK_V2` (`frontend/src/data/catalogs/assessment-question-bank-v2.ts`, 63 items).
- `CareerBuilderPage.tsx` (~L5813) seeds initial state from the local bank for SSR-safe first render, then swaps in the API payload via `useEffect`.
- Selector logic (affinity, rotation, interleave) is **mirrored server-side** in `backend/routes/competency-questions.ts` so both paths produce equivalent UX.

**Output**: 20 affinity-ranked questions per attempt, balanced across the 7 domains.

**Affinity scoring**

- Per-question tag matches on `role` / `industry` / `stage` / `function` against the user's `role + industry + stage + department + subDepartment` haystack.
- **Mismatch penalty**: tagged-but-no-match items score *below* untagged generalists so non-product/non-HR users don't see strategy-flavoured items by tie-break.

**Two-layer freshness model**

1. **Per-user served-ID memory** — `localStorage` key `mx-assessment-served:<userId>` records every question ID ever shown to that user. The API path persists the ID using the `_origin_id` side-channel field returned alongside each question. The selector skips items already in the set and rotates only over fresh ones; when a domain's fresh pool exhausts, the served set is **auto-reset for that domain only** (not globally), so re-takes still see fresh items per domain.
2. **Per-user attempt counter** — `localStorage` key `mx-assessment-attempt:<userId>`. Bumped on Retake CTA and on Start when prior `answers`/`results` exist. Drives **tier-preserving rotation**: fresh items are bucketed by affinity score, then rotated *within* each tier so high-affinity items stay clustered at the top across attempts (the previous whole-list rotation could bury them).

**Domain order rotation** — Because 20 ÷ 7 = 2 r6 (one domain gets 2 questions, six get 3), domain order is rotated by attempt counter so the "short" slot moves across retakes. EIQ is no longer permanently shortchanged.

**Round-robin interleave** — Output is interleaved across domains so the first 7 questions span all 7 competencies rather than 3 COG back-to-back.

Memo deps `[attemptRunId, userId]` keep the active set stable through a single in-flight attempt — items don't reshuffle mid-flow as state ticks.

`userId` is threaded from `CareerBuilderPage.tsx` (~L5825) into the selector call (`selectAssessmentQuestions({ ...profile, userId })`) so the freshness keys are user-scoped.

### 6.2.1 SuperAdmin question curation

**Surface**: `frontend/src/components/superadmin/CompetencyQuestionsPanel.tsx` (nav: Assessment Config → Competency Questions).

**Backend**: `backend/routes/competency-questions.ts` exposes:

| Endpoint | Auth | Purpose |
| --- | --- | --- |
| `GET /api/competency/questions/select` | `requireAuth` | Runtime selector (mirrors client logic — affinity + mismatch penalty + tier-rotation + round-robin interleave). Returns AQ-shape items with side-channel `_domain` / `_origin_id` fields for client served-ID memory. |
| `GET /api/admin/competency-questions` | `requireSuperAdmin` | List with filters (status, domain, source, search). |
| `POST /api/admin/competency-questions` | `requireSuperAdmin` | Create — **always lands as `status='draft'`**. Admins must explicitly promote via PATCH after review. |
| `PATCH /api/admin/competency-questions/:id` | `requireSuperAdmin` | Update content or transition status (draft → approved / rejected / archived). |
| `DELETE /api/admin/competency-questions/:id` | `requireSuperAdmin` | Hard delete. |
| `GET /api/admin/competency-questions/stats` | `requireSuperAdmin` | Returns `{ by_domain, totals }` — counts grouped by (competency_code × status), plus per-status totals. (No source breakdown.) |
| `POST /api/admin/competency-questions/generate` | `requireSuperAdmin` | Rule-based variant generator: `generalist` / `rephrase` / `difficulty_shift` transforms from approved seeds. **No LLM**. Writes drafts only. |

**Storage**: `competency_question_templates` (extended by migration `20260524_competency_question_curation.sql`) gains columns `status` (draft | approved | rejected | archived), `source` (manual | generated | seed), `reviewed_by`, `reviewed_at`, `notes`.

**Seed**: `backend/scripts/seed-competency-templates.ts` ports the 63-item static bank into the DB as `status='approved'`, `source='seed'`, giving the API path content to serve on day one before any admin curation happens.

### 6.3 Runtime (V1, legacy `/api/competency/*`)

7 endpoints, `cra_profiles` / `cra_scores` tables. Lazy `CREATE TABLE IF NOT EXISTS`. `submitAssessment()` (~L5869) performs, in order:

1. `POST /api/competency/profile/:userId` (hard-fails with surfaced error)
2. `POST /api/competency/run-assessment` (hard-fails with surfaced error)
3. `Promise.all` of `compute-score`, `get-percentile`, `gap-analysis`, `role-fit`, `interventions` → `results` state
4. **EI propagation** (rev May 2026, ~L5933): pulls `overallScore` from compute-score response, calls `setProfile({...prev, assessmentScore: overall})` for instant UI update, then non-blocking `PATCH /api/cv/profile/:userId` with `{ assessmentScore: overall }` to persist
5. Best-effort snapshot bridge call (own try/catch)

`loadExistingResults()` (~L5957) does the same backfill on result load — covers users who took the assessment before the EI propagation fix shipped: `setProfile` writes `assessmentScore` locally only when `typeof prev.assessmentScore !== 'number'`, so prior writes are never clobbered.

Both ok-checks throw `Couldn't save your profile (NNN) — <truncated body>` on failure, surfacing in the `errorMsg` red banner instead of silently proceeding to results.

### 6.4 Runtime (V2 — additive, feature-flagged)

Hidden from candidate UI by default; engineers can preview via `?debug=1`. Three V2 layers stacked:

1. **Competency Runtime V2** (`competency-runtime-v2.ts`) — resolves contextual Role DNA per (role × stage × industry × org-maturity); seeds context modifiers (`startup`/`enterprise`/`leadership`/`executive`/`managerial`/`specialist`/`ai_ml`/`healthcare`/`regulated`). Now writes versioned profile snapshots to `competency_profile_versions` + decision rationale to `runtime_explainability_logs` (per `20260825_*_core.sql`).
2. **Adaptive Assessment Runtime V2** (`adaptive-assessment-engine.ts` + `assessment-runtime-orchestrator.ts` + `question-generation-engine.ts`) — generates dynamic blueprints from resolved Role DNA; runs the adaptive loop (difficulty escalation/de-escalation, depth expansion, contradiction probes, behavioural-signal inference); persists full explainability log per session. Phase 2 gap-fill adds `POST /api/v2/assessment/next` + `/respond` + `GET /api/v2/report/intelligence/:sessionId`, with question-generation logs in `dynamic_question_generation_logs` and AI report runs in `ai_report_generations`.
3. **Contextual Scoring V2** (`contextual-scoring-engine.ts` + `contextual-norm-engine.ts` + `dynamic-cohort-engine.ts` + `readiness-intelligence-engine.ts`) — role-DNA-, industry-, layer-, geography-relative scoring with k-anonymous progressive cohort broadening (`K_MIN_DEFAULT=30`) and 6-domain readiness envelopes.

All three are feature-flagged independently; flag-off → routes 503 + UI panel hides. None touch the V1 runtime path.

---

## 7 · Dashboard surfaces

### 7.1 Employability Index gauge + provenance

- `EIGauge` and `EIProvenanceCard` (`frontend/src/components/career/`) render the radial EI score + breakdown card. `eiBreakdown` is computed via `useMemo` at `CareerBuilderPage.tsx` L948; `eiScore = eiBreakdown.total` at L1067.
- The Competency-Assessment slice (25 pts) reads `profile.assessmentScore` — written by `submitAssessment` on completion and backfilled by `loadExistingResults` (see §6.3). The EI now updates immediately after the user finishes their assessment.
- `useHybridEI` hook (`frontend/src/lib/hooks/useHybridEI.ts`) blends the client-side breakdown with the server `/api/ei/*` resolution for cases where backend reconciliation runs out of band.
- `DashboardIntro` renders the welcome strip; explanatory copy beside the gauge cites each component's source via `EIProvenanceCard`.

### 7.2 Peer benchmark bar

`CareerBuilderPage.tsx` ~L1450. Renders an amber hatched fill + pulsing **"Provisional · cohort building"** pill + `~ estimate` label whenever `bench_confidence.tier ∈ {C, D, provisional}` (cohort n < 100). Reuses Phase 2 confidence-tier semantics.

### 7.3 "Show me how" stage guidance

`StageGuidancePanel`, gated by `showStageGuidance` state (~L1220). Renders as a **modal overlay** (backdrop + Escape-to-close ~L1596–1627) toggled from the "Show me how" button on the "Gap to next stage" card (~L1577) and from the peer-benchmark CTA (`setShowStageGuidance(true)` at L1819). Stage-keyed steps (Builder → Career-Ready → Hire-Ready):

- intro + estimated time
- numbered steps with EI-impact badges
- per-step "Go to [Tab]" deep-link (tabs validated against `TabId` union; `onGoToTab` closes modal)
- "Ask Pragati for a personalised plan" — secondary escape hatch, also closes modal

Current state: static `STAGE_GUIDANCE` heuristic. Planned rewrite (spec: `docs/MICRO_ACCURATE_STAGE_GUIDANCE.md`): micro-accurate, evidence-driven panel sourced from `/api/benchmark/role`, `/api/longitudinal/velocity`, `/api/mobility/recommendations`, `/api/mobility/adjacent`, `/api/benchmark/reliability` via new orchestrator `GET /api/career/stage-guidance`; hybrid rollout with static fallback.

### 7.4 Global ChatWidget mount

`App.tsx` line 809. `ChatWidget` mounted on every non-landing screen via `GlobalChatMount`. Pre-seeds `sessionStorage['mx-chat-dismissed']='1'` so widget renders closed; only opens on `mx-open-chat` CustomEvent dispatched by "Ask Pragati" CTAs.

### 7.5 Fitment Intelligence panel (Jobs tab)

`frontend/src/components/career/FitmentInsightsPanel.tsx` — three-tab panel rendered at the top of `JobsTab` (above the stage pipeline):

- **Peer ranking** — fetches `/api/competency/get-percentile/:userId`; shows overall percentile + top-3 strengths + bottom-3 closest-to-floor; flags `Provisional — cohort building` when `sampleSize < 30` (k-anonymity floor).
- **Applied positions** — ranks user's tracked `jobs[]` in-browser via existing `rankJobsForUser(profile, jobs)`; per-card FitRing + skill/comp/exp breakdown + `topGapCompetency` label.
- **Recruiter openings** — fetches `/api/career/recruiter-postings`, ranks each posting via `computeFitment`. Empty-list fallback: `MARKET_CATALOG` demand-driven suggested openings (filtered `fitScore >= 40`, ranked by `fit*0.6 + demand*0.4`) with explicit "demand-driven" badge — never shows fake employer postings.

Backend: `backend/routes/recruiter-postings.ts` — endpoint `GET /api/career/recruiter-postings` (requireAuth). Lazy `CREATE TABLE IF NOT EXISTS employer_jobs`; returns `{ postings: [] }` gracefully on any DB error.

---

## 8 · Adaptive Intelligence — V2 layers in depth

### 8.1 Adaptive Orchestration V2 (Phase 4)

Event-driven coordination layer over all V2 engines. **Strictly additive** — no existing service or table touched.

- **Event bus** (`adaptive-event-bus.ts`) — in-process `EventEmitter` wrapped with non-blocking persistence to `adaptive_intelligence_events`. 9 canonical event types:
  - `competency.{assessment.completed, score.updated, dna.resolved}`
  - `{benchmark, mobility, trajectory, coaching, workforce, simulation}.updated`
- **Profile aggregator** (`competency-intelligence-profile-engine.ts`) — reads 7 V2 tables in parallel via `safeFirst` / `safeAll` (per-layer status: `unavailable` | `empty` | `ok`; never throws on missing tables).
- **Orchestrator** (`competency-intelligence-orchestrator.ts`) — `orchestrateAssessmentCompletion()` runs 7 sequential steps (emit → propagate → sync → build profile → persist → refresh graph → graph stats), each wrapped in `runStep` / `runEmitStep` for fault-tolerance. Status resolves to `success` / `partial` / `failed`. Records to `intelligence_execution_history` + `intelligence_orchestration_logs` + `orchestration_failures` (all fire-and-forget).
- **Graph engine** (`competency-graph-engine-v2.ts`) — nodes (`competency | role | pathway | readiness | capability`) + edges (`requires | enables | adjacent | develops_into | gap_for`) with `ON CONFLICT DO UPDATE` idempotent upserts. File suffix `-v2.ts` avoids colliding with existing m3 `competency-graph-engine.ts`.
- **Frontend events** (`frontend/src/lib/events/adaptiveIntelligenceEvents.ts`) — `window.CustomEvent`-based pub/sub. 8 canonical event names mirror the backend bus (`adaptive:assessment.completed`, `adaptive:profile.updated`, `adaptive:{benchmark, mobility, trajectory, coaching, workforce, simulation}.updated`). `runOrchestration()` dispatches `assessment.completed` + `profile.updated` so subscribed components reactively refetch.

### 8.2 AI Inference V2 (Phase 5, **heuristic-only**)

Heuristic competency inference from resume / LinkedIn / GitHub / portfolio / conversational sources. **No LLM calls** — all inference is deterministic pattern matching. Envelope explicitly stamps `language_policy.inference_mode = 'heuristic'`.

| Engine                              | Role                                                              |
| ----------------------------------- | ----------------------------------------------------------------- |
| `resume-signal-engine.ts`           | Regex/keyword → tech keywords, leadership/exec verbs, project-complexity, industry exposure, years/team-size hints. Maps to canonical 7-domain levels. |
| `github-competency-analyzer.ts`     | Analyses GitHub-shaped payload (language histogram, stars/forks/size aggregates, log-scaled scoring). |
| `linkedin-intelligence-engine.ts`   | Position dates, leadership-title regex, ascending-trajectory detection, total/leadership years. |
| `conversational-assessment-engine.ts` | Turn-based runtime: 7-competency probe bank, round-robin under-explored selection, deterministic response scoring, contradiction detection (level delta > 35), auto-close at 7 turns or 3 contradictions. |
| `ai-reasoning-engine.ts`            | Pure-function explainability synthesis (why_inferred / confidence_reasoning / readiness_rationale / alternatives / caveats). |
| `ai-competency-inference-engine.ts` | Orchestrator. Loads source weights from `inference_confidence_models` (fallback defaults), runs per-source analysers, weighted-average per competency, calibrated confidence = `0.25 + 0.4*coverage + 0.3*richness` (capped 0.95). |

### 8.3 Phase 6 / 7 / 8 (predictive · governance · enterprise WOS)

All three are additive heuristic layers on top of Phases 4/5 — no existing surface touched. Same envelope contract; UUID user IDs throughout (`TEXT`).

- **Feature flags** (`backend/config/feature-flags.ts`): `predictiveIntelligenceV2`, `governanceScienceV2`, `enterpriseWorkforceOSV2`. Flag-off → all write/read routes 503; `/feature-flag` + `/_meta/versions` remain public.
- **Registration**: all three registered in `backend/routes.ts` (~L12869) next to `registerAiAssessmentV2`.

### 8.4 Workforce OS (Phase 5 baseline + V2 predictive depth)

Six-domain multi-tenant surface — **complete end-to-end** as of `20260715_workforce_os_v2.sql`:

| Domain               | Service                              | Phase-5 tables                            | V2 tables (additive)              |
| -------------------- | ------------------------------------ | ----------------------------------------- | --------------------------------- |
| Market intelligence  | `market-intelligence-engine.ts`      | `wos_market_signals`                      | `wos_v2_market_forecasts`         |
| Predictive workforce | `predictive-workforce-engine.ts`     | `wos_capability_forecasts`                | `wos_v2_scenarios`                |
| Fairness monitoring  | `fairness-monitoring-engine.ts`      | `wos_fairness_evaluations`                | `wos_v2_fairness_drift`           |
| Dispute & override   | `dispute-override-engine.ts`         | `wos_disputes`, `wos_overrides`           | `wos_v2_dispute_sla`              |
| RBAC / tenant        | `rbac-tenant-engine.ts`              | `wos_tenants`, `wos_roles`, `wos_users`   | `wos_v2_abac_policies`            |
| Learning ROI         | `learning-roi-engine.ts`             | `wos_learning_investments`                | `wos_v2_learning_attribution`     |

Phase 5 hardening (`20260810_dispute_sla_escalation.sql`) added `escalated_at` / `escalation_level` / `escalation_target` / `last_sla_check_at` to `wos_disputes` and a dedicated `audit` tab (8th) on `WorkforceOSPage`. Phase 8 EWOS V2 (`20260805_enterprise_workforce_os.sql`) overlays tenant-profile / capability-risk / executive-brief / resilience-score / observability tables consumed by `EnterpriseWorkforceOSDashboard`.

---

## 9 · Pragati — CAPADEX behavioural conversational runtime

Pragati is the conversational coach layered alongside Career Builder.

- **Backend**: `backend/routes/pragati.ts` (registered via `registerPragatiRoutes`)
- **Frontend**: `frontend/src/components/PragatiWorkspace.tsx`
- **Landing CTAs** (`frontend/src/components/LandingPage.tsx`): "Start Your Clarity Journey" → PragatiWorkspace · "Get My Stage Analysis" → FreeAssessmentModal
- **API**: `POST /api/pragati/session/start` · `POST /api/pragati/session/:id/respond` · `GET /api/pragati/session/:id/resume` · admin endpoints for sessions / escalations · `GET /api/pragati/flow-config` · `GET /api/pragati/ontology`

**Runtime engine (summary)**
- FSM: 13 states (`emotional_entry → … → complete`)
- Block types: `reflection | bridge | question | insight | reassurance | pattern_detection | progression | closure`
- Ontology: 12 concern types across academic/occupational/cognitive/social/professional/emotional/motivational/identity/digital/relational/physiological families
- 22 signal-extraction rules · 23 reflection templates · 18 bridge phrases · 11 pattern-detection rules with explainability pills
- Adaptive density + pacing + 4-dimension quality score (0–100) + drift detection (worsening/stabilizing/recovering/improving)
- Crisis-language escalation; 5-rule safety middleware; sessionStorage-backed recovery; deterministic try/catch fallback

**Frontend (PragatiWorkspace)** — 3-panel desktop (identity/journey/signals | conversation | patterns/interventions); mobile tab-switched. Session recovery on open; error fallback shows recovery chips, never breaks conversation.

---

## 10 · Cross-cutting policies & constraints

### 10.1 Language policy (enforced per envelope)

| Allowed                                                        | Disallowed                                                       |
| -------------------------------------------------------------- | ---------------------------------------------------------------- |
| developmental signal · cohort percentile · scenario projection · drift indicator · readiness band · policy decision · intelligence profile · inferred competency · behavioural evidence · confidence band | hiring recommendation · promotion ranking · pass/fail verdict · individual termination prediction · suitability prediction |

### 10.2 k-anonymity

Peer benchmarks suppressed below `k_min=30`; cohort responses aggregate-only. Cohort engine progressively broadens by dropping `geography → org_maturity → team_scale → industry → layer → experience_band` until k_min reached; flags `is_provisional` when still under k_min.

### 10.3 Append-only history

`p4_competency_history`, `m3_*` history, `intelligence_snapshots_v2`, `assessment_explainability_logs`, `scoring_explainability_v2`, `ai_reasoning_chains`, `runtime_explainability_logs`, `competency_profile_versions`, `dynamic_question_generation_logs`, `ai_report_generations` are append-only — never mutated in place.

### 10.4 Authentication & isolation

- All `user_id` columns are `TEXT` (UUIDs)
- `requireAuth` middleware on all writes and most reads
- IDOR guards on self-only routes (`/api/v2/orchestration/events?userId=`, `/api/v2/ai/conversation/:id`, etc.) verify query/path `userId` matches auth-uid or returns 403
- Internal V2 debug panels (`V2ContextPreview`, `AdaptiveAssessmentRuntime`) hidden from candidates by default; gated behind `?debug=1` query param

### 10.5 Preservation rules ("do not redesign")

- All Adaptive Intelligence phases are additive new pages, never modifications to `CompetencyDashboard.tsx`, `GapAnalysisPage.tsx`, `CareerBuilderPage.tsx` core, or `TrajectoryDashboardPage.tsx`
- "DO NOT overwrite" list: `benchmark`, `mobility`, `m3/m4/m5`, workforce dashboards, `CareerBuilderPage` — all untouched
- "Enhance existing engines" plan steps are implemented as orchestration calls + event broadcasts, NOT in-place edits. Existing engines remain authoritative.

### 10.6 Migration discipline

- Forward-only; never edit a shipped migration
- All V2 tables namespaced (`onto_*`, `bench_*`, `mobility_*`, `p4_*`, `gov_*`, `p5_*`, `wos_*`, `wos_v2_*`, `gro_*`, `sci_*`, `m3_*`, `m4_*`, `m5_*`, `cra_*`, `competency_runtime_*`, `assessment_*_v2`, `competency_*_v2`, `adaptive_*`, `intelligence_*`, `competency_graph_*`, `orchestration_*`, `ai_*`)
- All V2 migrations use `CREATE TABLE IF NOT EXISTS` and are idempotent
- Seed rows scoped per migration; never re-seed mid-flight

---

## 11 · Recent session fixes (May 2026, rev 3)

| Fix                                                 | Files                                                                        | Notes                                                                  |
| --------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| DB-backed question selection + SuperAdmin curation  | `backend/routes/competency-questions.ts`, `frontend/src/lib/assessmentSelector.ts`, `frontend/src/components/superadmin/CompetencyQuestionsPanel.tsx`, `backend/scripts/seed-competency-templates.ts`, `backend/migrations/20260524_competency_question_curation.sql` | Runtime now pulls from `competency_question_templates` (status='approved'). Static V2 bank kept as fallback. Admin panel for create/approve/reject/archive + rule-based variant generator (no LLM). Manual POSTs always land as draft. See §6.2 + §6.2.1. |
| Mismatch penalty + tier-preserving rotation         | `frontend/src/lib/assessmentSelector.ts`, `backend/routes/competency-questions.ts` | Tagged-but-no-match items now score below untagged generalists (stops strategy/HR items leaking into non-matching users). Per-attempt rotation happens *within* affinity tiers so the top-of-list cluster stays high-affinity across retakes. |
| Domain order rotation + round-robin interleave      | same files                                                                   | 20÷7 short-slot rotates per attempt (EIQ no longer permanently shortchanged). Output interleaves domains so the first 7 questions span all 7 competencies. |
| Custom roles / industries removable                 | `frontend/src/lib/customEntries.ts`, `frontend/src/components/career/AssessmentCombobox.tsx` | Inline ✕ on each custom chip in the typeahead popover (50-entry cap, dedupe, title-case). |
| EI propagation after assessment submit              | `frontend/src/pages/CareerBuilderPage.tsx` L5933 (submit) + L5970 (backfill) | Writes `profile.assessmentScore` locally + persists via `PATCH /api/cv/profile/:userId`. Backfills on result load for users who took assessment before this fix shipped. Root cause: `eiBreakdown` reads `profile.assessmentScore` which was never written. |
| Question bank expansion + per-user served-ID memory | `frontend/src/data/catalogs/assessment-question-bank-v2.ts`, `frontend/src/lib/assessmentSelector.ts` | Bank 36 → 63 (HR-tagged items across all 7 domains + generalist items). Per-user `mx-assessment-served:<userId>` map skips previously-served items, auto-resets per-domain. `userId` threaded from CareerBuilderPage L5825. |
| Redundant assessment-card badges removed            | `frontend/src/pages/CareerBuilderPage.tsx` ~L6720                            | Dropped "COGNITIVE & ANALYTICAL" + "OBJECTIVE TEST" pills; kept competency caption. |

---

## 12 · Key file map (quick lookup)

| Concern                            | File                                                                                     |
| ---------------------------------- | ---------------------------------------------------------------------------------------- |
| Career Builder page (monolith)     | `frontend/src/pages/CareerBuilderPage.tsx` (7,891 LOC)                                   |
| `TabId` union (19 tabs)            | same file, ~L70                                                                          |
| `eiBreakdown` / `eiScore`          | same file, L948 / L1067                                                                  |
| Assessment tab + setup flow        | same file, `AssessmentTab` ~L5476+                                                       |
| `submitAssessment` + EI write      | same file, ~L5869 (submit), ~L5933 (EI write), ~L5957 (loadExistingResults + backfill)   |
| Question selector + freshness      | `frontend/src/lib/assessmentSelector.ts`                                                 |
| Question curation backend          | `backend/routes/competency-questions.ts`                                                 |
| Question curation admin panel      | `frontend/src/components/superadmin/CompetencyQuestionsPanel.tsx`                        |
| Question template seed script      | `backend/scripts/seed-competency-templates.ts`                                           |
| V2 question bank (63 items, fallback) | `frontend/src/data/catalogs/assessment-question-bank-v2.ts`                           |
| Combobox (predictive typeahead)    | `frontend/src/components/career/AssessmentCombobox.tsx`                                  |
| Industry/role catalog              | `frontend/src/data/catalogs/industryRoles.ts`                                            |
| Custom entries (localStorage)      | `frontend/src/lib/customEntries.ts`                                                      |
| Shared options service             | `frontend/src/lib/services/assessmentOptionsService.ts`                                  |
| EI gauge + provenance              | `frontend/src/components/career/EIGauge.tsx`, `EIProvenanceCard.tsx`                     |
| Hybrid EI hook                     | `frontend/src/lib/hooks/useHybridEI.ts`                                                  |
| Resume Studio                      | `frontend/src/components/career/ResumeStudio.tsx`                                        |
| Fitment Intelligence panel         | `frontend/src/components/career/FitmentInsightsPanel.tsx`                                |
| V2 Contextual DNA preview          | `CareerBuilderPage.tsx` `V2ContextPreview` component (debug gated)                       |
| V2 Adaptive runtime preview        | `frontend/src/modules/career-builder/competency/views/AdaptiveAssessmentRuntime.tsx`     |
| V1 runtime backend                 | `backend/routes/competency-assessment-runtime.ts`                                        |
| V2 runtime backend                 | `backend/routes/competency-runtime-v2.ts`                                                |
| Adaptive Assessment V2 backend     | `backend/routes/adaptive-assessment-v2.ts`                                               |
| Contextual Scoring V2 backend      | `backend/routes/contextual-benchmark-v2.ts`                                              |
| AI Inference V2 backend            | `backend/routes/ai-assessment-v2.ts`                                                     |
| Workforce OS backend (Phase 5)     | `backend/routes/workforce-os.ts`                                                         |
| Workforce OS V2 backend            | `backend/routes/workforce-os-v2.ts`                                                      |
| Feature flags                      | `backend/config/feature-flags.ts`                                                        |
| Recruiter postings backend         | `backend/routes/recruiter-postings.ts`                                                   |
| Pragati backend                    | `backend/routes/pragati.ts`                                                              |
| Pragati frontend workspace         | `frontend/src/components/PragatiWorkspace.tsx`                                           |
| Career Brain aggregator            | `frontend/src/lib/services/useCareerBrain.ts`                                            |
| Behavior Graph client (P2)         | `frontend/src/lib/intelligence/behaviorGraph.ts`                                         |
| Constraint Engine (P3)             | `frontend/src/lib/intelligence/constraintEngine.ts`                                      |
| Unified Action Engine (P4)         | `frontend/src/lib/intelligence/unifiedActionEngine.ts` · endpoint `GET /api/career/next-actions/:userId` (`backend/routes/behavioural-memory.ts`) |
| Progress Ledger (P5)               | `frontend/src/lib/intelligence/progressLedger.ts` · surfaced in `frontend/src/components/career/CareerMemoryTab.tsx` (reuses `GET /api/career/behavioural-memory/:userId`) |
| Outcome Attribution (P6)           | `frontend/src/lib/intelligence/outcomeAttributionEngine.ts` · surfaced in `frontend/src/components/career/CareerMemoryTab.tsx` |
| Behavioural Growth tab ("Why am I stuck?") | `frontend/src/components/career/BehavioralGrowthTab.tsx`                         |
| Career OS roadmap / blueprint      | `reports/career-os-architecture-blueprint.md`                                            |
| Career Builder core schema         | `backend/migrations/20260519_career_builder_schema.sql`                                  |
| Detailed phase build logs          | `docs/phase-history.md`                                                                  |
| Companion specs                    | `docs/COMPETENCY_ASSESSMENT.md`, `docs/EMPLOYABILITY_INDEX.md`, `docs/MICRO_ACCURATE_STAGE_GUIDANCE.md`, `docs/peer-benchmarking.md` |

---

## 13 · Deployment & ops

- Dev runs via two Replit workflows: `Backend API` (`cd backend && npm run dev:server`, port 8080) + `Start application` (`cd frontend && npm run dev`, port 5000)
- Vite proxy: `/api/*` → `http://localhost:8080` (`frontend/vite.config.ts`)
- Frontend dev server allows all hosts (`server.allowedHosts: true`) because the Replit preview is a proxied mTLS iframe
- Production database is Replit-managed PostgreSQL (`DATABASE_URL`); migrations applied in order under `backend/migrations/`
- Feature flags can be flipped via env vars (`FF_<NAMESPACE>_V2=false`) to disable any V2 layer per environment without code changes
- Internal V2 debug previews accessible at `?debug=1` (any deployed environment)
- Super admin: `superadmin@metryx.one` / `admin123` (login surface `SuperAdminLogin.tsx` → SPA nav to `screen = 'admin-dashboard'`)

---

*End of document.*
