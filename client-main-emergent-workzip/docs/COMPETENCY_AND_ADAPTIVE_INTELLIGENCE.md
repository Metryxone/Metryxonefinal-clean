# Competency Assessment & Adaptive Intelligence — Technical Document

**Project**: MetryxOne — Behavioural Intelligence SaaS
**Scope**: End-to-end technical reference for (a) the Competency Assessment runtime that captures user capability, and (b) the multi-phase Adaptive Career Intelligence stack that turns each capture into ontology-aware, benchmarked, longitudinal, and governance-grade workforce intelligence.
**Audience**: Engineers, data/ML, product, and security reviewers working inside `backend/`, `frontend/`, and `backend/migrations/`.
**Companion docs**: [`COMPETENCY_ASSESSMENT.md`](COMPETENCY_ASSESSMENT.md) (legacy, narrower spec), [`phase-history.md`](phase-history.md) (per-phase build archive), [`EMPLOYABILITY_INDEX.md`](EMPLOYABILITY_INDEX.md), [`MICRO_ACCURATE_STAGE_GUIDANCE.md`](MICRO_ACCURATE_STAGE_GUIDANCE.md), [`peer-benchmarking.md`](peer-benchmarking.md).

---

## 0. Reading Map

| If you want to… | Go to |
|---|---|
| Understand the assessment UX and setup flow | §1, §2 |
| Understand the scoring model + 7 domains | §3 |
| Wire a new endpoint into the assessment runtime | §4 |
| Understand the Phase 1–5 Adaptive Intelligence stack | §5 (overview), §6 (per-phase deep-dive) |
| Understand the explainability / governance envelope | §7 |
| Understand cross-cutting invariants (language, k-anonymity, append-only) | §8 |
| Look up an engine version | §9 |

---

## 1. Module map

| Concern | File(s) |
|---|---|
| Setup landing (Career Builder · AssessmentTab) | `frontend/src/pages/CareerBuilderPage.tsx` (AssessmentTab ~L5193–5640) |
| Predictive role/industry combobox | `frontend/src/components/career/AssessmentCombobox.tsx` |
| Catalog (Industry → Dept → Sub-dept → Role) | `frontend/src/data/catalogs/industryRoles.ts` |
| Shared options service (catalog + ontology merge, fuzzy match) | `frontend/src/lib/services/assessmentOptionsService.ts` |
| Custom user-added roles/industries (localStorage) | `frontend/src/lib/customEntries.ts` |
| Runtime backend (profile, run, score, percentile, gap, role-fit, interventions) | `backend/routes/competency-assessment-runtime.ts` |
| Snapshot writer (bridges into Phase 1–5 data layer) | `backend/services/assessment-writer.ts`, `backend/routes/assessment-writer.ts` |
| Fitment Intelligence panel (Jobs tab) | `frontend/src/components/career/FitmentInsightsPanel.tsx` |

---

## 2. User-facing flow

```
LandingPage / CareerBuilder ▸ AssessmentTab (setup)
        │
        ▼
  POST /api/competency/profile/:userId   ── upserts cra_profiles
        │
        ▼
  20-item adaptive question pool (7-domain coverage)
        │
        ▼
  POST /api/competency/run-assessment    ── appends cra_scores
        │
        ▼
  POST /api/career/assessment/snapshot   ── writes user_assessment_snapshots
                                            + user_competency_scores
                                            + p4_competency_history (append)
        │
        ▼
  GET  /api/competency/compute-score/:userId
  GET  /api/competency/get-percentile/:userId
  GET  /api/competency/gap-analysis/:userId
  GET  /api/competency/role-fit/:userId
  GET  /api/competency/interventions/:userId
        │
        ▼
  Downstream Adaptive Intelligence dashboards
  (benchmark, mobility, trajectory, workforce, governance,
   scientific, market, AI governance, enterprise workforce)
```

### 2.1 Setup landing — predictive typeahead

The four setup fields (Current Role, Target Role, Industry, Career Stage) are **input-first predictive** (not click-to-open dropdowns):

- `AssessmentCombobox` opens its popover on focus, filters live as the user types, and forwards Arrow/Enter to a hidden `cmdk` `CommandInput` via `cmdInputRef + dispatchEvent` so keyboard navigation works without focus leaving the visible input.
- Popover width is anchored to the input via `getBoundingClientRect` (no reliance on `--radix-popover-trigger-width`).
- The catalog (`industryRoles.ts`) is the **primary** source. Calls to `/api/ontology/roles` and `/api/ontology/industries` are merged in — matching rows copy `id`, `seniority`, `layerName` onto the catalog entry so `/api/mobility/adjacent` still fires.

### 2.2 Custom entries (user-added roles/industries)

The IT-focused catalog can't enumerate every job title a user may carry (e.g. `Founder`, `Chief of Staff`, `DevRel Lead`). The three freeform fields ship with `allowFreeText={true}`:

| Concern | Detail |
|---|---|
| Store | `frontend/src/lib/customEntries.ts` — localStorage keys `mx-custom-roles` / `mx-custom-industries` |
| Normalisation | Title-case, case-insensitive dedupe, 50-entry cap per list |
| Render | Top of popover, dedicated `CommandGroup` "Your custom roles / industries" with a violet **Custom** chip |
| Remove | Hover ✕ wired via `AssessmentCombobox`'s `onRemoveItem` prop; removes from localStorage and clears the field if currently selected |
| Selected-state UI | Violet `custom` badge + caption `custom role/industry — peer benchmarks build as more candidates pick this` |
| Metadata trade-off | Customs carry no industry/department/sub-dept metadata; adjacency suggestions and the role→industry auto-link gracefully fall back |

### 2.3 Validation gates

`Start Assessment` is enabled only when:

- `currentRole`, `targetRole`, `industry` are members of the union of **catalog values ∪ user customs**.
- `careerStage` is a member of the strict `stageValues` set (scoring taxonomy is fixed).
- Options have loaded (`optionsReady`).

Prefills from a saved profile are fuzzy-matched (`fuzzyMatchTitle`, Jaccard + substring boost, threshold 0.5). Matches auto-fill; non-matches clear the field and store `unmatchedHints[field]` to render an amber `pick from list` chip plus caption `your profile said "X" — pick the closest match`.

---

## 3. Scoring model

### 3.1 The 7 competency domains

| Code | Domain | Scope |
|---|---|---|
| **COG** | Cognitive & Analytical | Reasoning · problem decomposition · data interpretation |
| **COM** | Communication & Influence | Written/verbal clarity · persuasion · stakeholder navigation |
| **LEA** | Leadership & People | Direction-setting · coaching · team dynamics |
| **EXE** | Execution & Delivery | Planning · prioritisation · ownership · throughput |
| **ADP** | Adaptability & Growth | Learning agility · resilience · change tolerance |
| **TEC** | Technical & Domain | Role-specific technical depth + domain fluency |
| **EIQ** | Emotional & Social Intelligence | Self-awareness · empathy · regulation · collaboration |

Each domain rolls up to a single 0–100 score. Individual competencies (50+) map to a parent domain.

### 3.2 Stage anchors

`STAGE_ANCHOR` defines the floor for "expected level" by career stage:

| Stage | Anchor |
|---|---|
| Builder | 50 |
| Career-Ready | 65 |
| Hire-Ready | 80 |

`ROLE_PRIORITIES` applies a **+8 bonus** to expected level for competencies the target role weighs heavily; in role-fit specifically those priority competencies are weighted **1.5×**.

### 3.3 Gap / role-fit / percentile

| Output | Formula (summary) |
|---|---|
| Gap severity | `severity = (target_weight × expected_level) − actual_score` |
| Role-fit probability | weighted sum over competencies, priority codes ×1.5, normalised 0–100 |
| Percentile | empirical (binary-search over `bench_*.sorted_samples`) when cohort `n ≥ 3`, else score-based fallback |
| Reliability (Phase 2) | composite: consistency 0.40 · reverse 0.20 · (1 − contradictions) 0.20 · completion 0.15 · (1 − anomalies) 0.05 |

### 3.4 Auto-link (catalog-driven enrichment)

When a user picks a current role with a catalog match, `Industry` auto-fills with the role's `industryName` (unless the user has manually edited Industry). Department / sub-department surface as the field caption (e.g. `Engineering · Backend`). On submit, the profile payload to `/api/competency/profile/:userId` carries `currentDepartment / currentSubDepartment / targetDepartment / targetSubDepartment` as additive context. The runtime accepts and stores these but does not yet branch on them (`ROLE_PRIORITIES` is keyed by role title); they are reserved for future per-department weighting.

---

## 4. Competency Assessment Runtime

**Route file**: `backend/routes/competency-assessment-runtime.ts` — registered in `backend/routes.ts` via `registerCompetencyAssessmentRuntime({ app, pool: concernsPool, requireAuth })`.

### 4.1 Endpoints

All endpoints are `requireAuth`. Identity is bound to `req.user`; any path or body `userId` must equal the session user (else `403`).

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/competency/profile/:userId` | Upsert `currentRole / targetRole / industry / careerStage / experienceYears` (+ department/sub-dept additive context) |
| POST | `/api/competency/run-assessment` | Body `{ userId, scores: [{ competencyCode, rawScore, confidence }] }`. Codes allowlisted via `COMPETENCY_META`; `rawScore ∈ [0,100]`; ≤ 200 items; invalid entries skipped + counted |
| GET | `/api/competency/compute-score/:userId` | `{ overallScore, totalCompetencies, profile, domains[].competencies[] }` |
| GET | `/api/competency/get-percentile/:userId` | `{ overallPercentile, percentiles[] }` (empirical vs cohort, fallback when `n < 3`) |
| GET | `/api/competency/gap-analysis/:userId` | `{ gaps[], strengths[], summary }` using `STAGE_ANCHOR` + `ROLE_PRIORITIES` |
| GET | `/api/competency/role-fit/:userId` | `{ roleFitProbability, readinessLevel, transition.topGaps }` |
| GET | `/api/competency/interventions/:userId` | `{ interventions[] }` derived per gap |

### 4.2 Persistence

Lazy `CREATE TABLE IF NOT EXISTS` on first registration:

- **`cra_profiles`** — one row per user. Columns named `current_role_label` / `target_role_label` to sidestep `CURRENT_ROLE` / `TARGET_ROLE` being PostgreSQL reserved keywords.
- **`cra_scores`** — append-only. Latest row per `(user_id, competencyCode)` is the current score.

### 4.3 Bridge into Adaptive Intelligence

Frontend `submitAssessment` fires a non-blocking `POST /api/career/assessment/snapshot` immediately after `/api/competency/run-assessment` succeeds. This invokes `writeSnapshot()` in `backend/services/assessment-writer.ts`, which executes four steps in one call:

1. `INSERT` header into `user_assessment_snapshots`
2. `APPEND` one row per competency into `p4_competency_history` (via existing `recordCompetencyHistory`)
3. `UPSERT` latest values into `user_competency_scores`
4. Non-blocking audit writes to `bench_audit_logs` and (org-scoped) `m5_audit_logs`

Downstream resolvers (`adaptive-benchmark.parseScores`, `m5-enterprise-workforce.coachInput`) prefer `user_competency_scores` when `?user_id=` is supplied; they fall back to `?demo=true` deterministic vectors. The 6 sidebar deep-links to Adaptive Intelligence pages build `?user_id=…&org_id=…` from the JWT before navigating.

### 4.4 Fitment Intelligence panel (Jobs tab)

`frontend/src/components/career/FitmentInsightsPanel.tsx` renders three tabs at the top of `JobsTab`:

| Tab | Source |
|---|---|
| Peer ranking | `GET /api/competency/get-percentile/:userId`; flags `Provisional — cohort building` when `sampleSize < 30` (k-anonymity floor) |
| Applied positions | Ranks user's tracked `jobs[]` in-browser via `rankJobsForUser(profile, jobs)`; per-card FitRing + skill/comp/exp breakdown + `topGapCompetency` |
| Recruiter openings | `GET /api/career/recruiter-postings`; ranks each posting via `computeFitment`. If empty, falls back to MARKET_CATALOG demand-driven openings (filtered `fitScore ≥ 40`, ranked `fit·0.6 + demand·0.4`) with an explicit "demand-driven" badge so users never see fake employer postings. |

Backend: `backend/routes/recruiter-postings.ts` registered via `registerRecruiterPostingsRoutes`. Lazy `CREATE TABLE IF NOT EXISTS employer_jobs` on first request; returns `{ postings: [] }` gracefully on any DB error.

---

## 5. Adaptive Career Intelligence — System overview

Adaptive Intelligence is a stack of **read-only** analytical layers built on top of the assessment runtime. Each phase is:

- **Additive** — own namespaced tables, own routes, own page; never mutates earlier-phase data.
- **Version-stamped** — every engine ships a constant (`<NAME>_VERSION='<semver>'`) surfaced in response envelopes and `/api/.../_meta/versions`.
- **Audit-logged** — read-shaped and write-shaped events stamped to per-namespace `*_audit_logs`.
- **Language-policed** — outputs are developmental signals only (see §8.1).

```
                       Competency Assessment Runtime
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
        user_assessment_snapshots               cra_scores
        user_competency_scores
                  │
                  ▼
   ┌──────────── Phase 1 — Ontology (onto_*) ────────────┐
   ▼              gro_* (Global Role Ontology)            ▼
Phase 2 — Adaptive Benchmark (bench_*)         Scientific (sci_*)
   │              Phase 3 — Mobility (mobility_*)
   ▼
Phase 4 — Longitudinal + Workforce (p4_*)
   │
   ▼
Phase 5 — Enterprise + Governance (p5_*, gov_*, wos_*)
                  │
                  ▼
   m3_* (Market Intelligence + Evidence Graph + Mobility 2.0)
   m4_* (AI Governance + Localization + Predictive + Simulation)
   m5_* (Enterprise Workforce + AI Coaching + Executive Decision)
```

### 5.1 Phase index (deep-link map)

| Phase / Module | Namespace | Migration | Frontend page | Deep-link |
|---|---|---|---|---|
| P1 — Ontology + Workforce Taxonomy | `onto_*` | `20260523_competency_ontology_phase1.sql` | `OntologyExplorerPage.tsx` | `?screen=ontology-explorer` |
| P2 — Adaptive Benchmarking + Reliability | `bench_*` | `20260524_adaptive_benchmark_phase2.sql` | `BenchmarkDashboardPage.tsx` | `?screen=benchmark-dashboard` |
| P3 — Mobility + Pathway + Recommendations | `mobility_*` | `20260525_mobility_phase3.sql` | `CareerMobilityPage.tsx` | `?screen=career-mobility` |
| P4 — Longitudinal + Workforce Analytics | `p4_*` | `20260526_intelligence_phase4.sql` | `TrajectoryDashboardPage.tsx`, `WorkforceInsightsPage.tsx` | `?screen=trajectory-dashboard`, `?screen=workforce-insights` |
| P5 — Enterprise + Governance + Explainability | `gov_*`, `p5_*` | `20260527_intelligence_phase5.sql` | `EnterpriseIntelligencePage.tsx` | `?screen=enterprise-intelligence` |
| P5 — Workforce OS (multi-tenant) | `wos_*` | `20260529_workforce_os_phase5.sql` | `WorkforceOSPage.tsx` | `?screen=workforce-os` |
| P1+ — Global Role Ontology | `gro_*` | `20260601_global_ontology_phase1.sql` | (CAPADEX profile selectors) | — |
| P2+ — Scientific Competency Intelligence | `sci_*` | `20260605_scientific_competency_phase2.sql` | `ScientificCompetencyPage.tsx` | `?screen=scientific-competency` |
| P3+ — Market Intelligence + Evidence Graph + Mobility 2.0 | `m3_*` | `20260610_market_intelligence_phase3.sql` | `MarketIntelligencePage.tsx` | `?screen=market-intelligence` |
| P4+ — AI Governance + Localization + Predictive + Simulation | `m4_*` | `20260615_ai_governance_phase4.sql` | `AIGovernancePage.tsx` | `?screen=ai-governance` |
| P5+ — Enterprise Workforce + AI Coaching + Executive Decision | `m5_*` | `20260620_enterprise_workforce_phase5.sql` | `EnterpriseWorkforceOSPage.tsx` | `?screen=enterprise-workforce-os` |
| Assessment Writers (bridge) | `user_assessment_snapshots`, `user_competency_scores` | `20260621_assessment_writers.sql` | (writes from `submitAssessment`) | — |
| Competency Assessment Runtime | `cra_profiles`, `cra_scores` | lazy `CREATE TABLE IF NOT EXISTS` | `CareerBuilderPage` AssessmentTab | — |

---

## 6. Per-phase deep-dive

### 6.1 Phase 1 — Ontology + Workforce Taxonomy

- **DB** (19 `onto_*` tables): `onto_domains`, `onto_families`, `onto_competencies`, `onto_competency_aliases`, `onto_behavioral_indicators`, `onto_proficiency_levels`, `onto_organisational_layers`, `onto_complexity_models`, `onto_competency_relationships`, `onto_industries`, `onto_functions`, `onto_subfunctions`, `onto_role_families`, `onto_roles`, `onto_role_dna_profiles`, `onto_role_competency_weights`, `onto_capability_models`, `onto_competency_versions`, `onto_audit_logs`. Composite FK `onto_competencies(family_id, domain_id) → onto_families(id, domain_id)` enforces `competency.domain == family.domain`.
- **Seed**: 5 domains · 10 families · 13 competencies · 5-level proficiency · 4 organisational layers · 8 complexity rows · 5 roles · 5 DNAs · 35 role-competency weights · 2 capability models.
- **Service**: `backend/services/competency-ontology.ts` (read-only).
- **Routes**: 14 GETs under `/api/ontology/*` (`domains`, `families`, `competencies`, `competencies/:id`, `competencies/resolve/:name`, `proficiency-levels`, `layers`, `industries`, `functions`, `subfunctions`, `role-families`, `roles`, `roles/:id/dna`, `relationships`, `capability-models`, `methodology`).
- **Version**: `ONTOLOGY_VERSION='1.0.0'`.

### 6.2 Phase 2 — Adaptive Benchmarking + Reliability

- **Empirical percentile only** (binary search over `sorted_samples`). NO Gaussian. k-anonymity preserved (`k_min=30`, aggregate-only).
- **DB** (10 `bench_*` tables): `bench_cohorts`, `bench_competency_benchmarks`, `bench_cohort_statistics`, `bench_role_alignment_scores`, `bench_confidence`, `bench_psychometric_reliability`, `bench_assessment_quality_metrics`, `bench_percentile_distributions`, `bench_versions`, `bench_audit_logs`. Seeded: 15 cohorts (1 global=A / 2 industry=B / 3 function=B / 5 role=C / 4 layer=C), 195 benchmarks/histograms/confidence rows.
- **Services**:
  - `empirical-percentile.ts` — binary-search empirical pct + Wilson 95% CI + diagnostic z; `confidenceTier(n) → A=1000 / B=300 / C=100 / D=30 / provisional`.
  - `weighting-engine.ts` — context-aware dynamic weights joined to `is_current` DNA profile; modifier policies for layer / seniority / maturity / team_scale / industry / geography; L1-normalised.
  - `reliability-engine.ts` — composite reliability (see §3.3); quality tiers A≥0.85 / B≥0.70 / C≥0.50 / D.
  - `adaptive-benchmark.ts` — orchestrator with 60-second in-process cache.
- **Routes** (8 GET under `/api/benchmark/*`): `role`, `competency`, `family`, `domain`, `layer`, `aspirational`, `confidence`, `reliability`. Accept `?user_id=` (real data via `user_competency_scores`), `?demo=true`, or `?scores={…}`; context modifiers `?industry_id=&function_id=&layer_id=&seniority=&org_maturity=&team_scale=&geography=`.
- **Versions**: `BENCH_METHODOLOGY_VERSION='2.0.0'`, `WEIGHTING_VERSION='2.0.0'`.

### 6.3 Phase 3 — Mobility + Pathway + Recommendations

- **DB** (10 `mobility_*` tables + audit): `mobility_career_paths`, `mobility_role_transitions`, `mobility_transferability_maps`, `mobility_competency_gaps`, `mobility_development_pathways`, `mobility_capability_maturity` (5-level per competency), `mobility_role_mobility_scores`, `mobility_learning_sequences`, `mobility_aspiration_profiles`, `mobility_adjacent_role_mappings`. Seed: 169 transferability rows, 65 maturity rows, 8 transitions, 20 adjacencies, 5 pathways, 15 learning steps, 3 career paths.
- **Services**:
  - `mobility-engine.ts` — `compareRoles()` returns `composite mobility = 0.40·overlap + 0.35·transferability + 0.25·gap_coverage`; also `adjacentRoles()`, `mobilityGraph()`; 60s cache.
  - `pathway-engine.ts` — `listPathways`, `personalisedPathway` (projects each step against user's current maturity), `suggestPathways` (ranks by overlap with development priorities).
  - `recommendation-engine.ts` — emits 5 categories (`competency_development`, `leadership_growth`, `role_progression`, `transferable_strength`, `pathway_sequencing`, `adjacent_opportunity`); `fullMobilityReport()` bundles all outputs.
- **Routes** (11 GET under `/api/mobility/*`): `roles`, `compare`, `graph`, `adjacent`, `transitions`, `transferability`, `pathways`, `pathway/:id`, `maturity/:competency`, `recommendations`, `report`.
- **Versions**: `MOBILITY_VERSION='3.0.0'`, `PATHWAY_VERSION='3.0.0'`, `RECOMMENDATION_VERSION='3.0.0'`.

### 6.4 Phase 4 — Longitudinal + Workforce Analytics

- **Append-only history**; all projections are **conservative bands** with confidence tiers.
- **DB** (`p4_*`): `p4_competency_history` (append-only — never mutated), `p4_benchmark_trends`, `p4_organizational_heatmaps`, `p4_workforce_analytics`, `p4_trajectory_models`, `p4_audit_logs`. Seed: 390 history points (5 demo users × ~13 competencies × 6 months), 1170 trend rows, 52 heatmap cells, 5 workforce metrics, 3 trajectory models.
- **Engine**: EWMA `α=0.30` smoothing; conservative projection bands.
- **Frontend**: `TrajectoryDashboardPage.tsx`, `WorkforceInsightsPage.tsx`.

### 6.5 Phase 5 — Enterprise + Governance + Explainability

- **Two namespaces**: `gov_*` (governance/audit primitives) and `p5_*` (enterprise rollups).
- **Frontend**: `EnterpriseIntelligencePage.tsx`.
- See [`phase-history.md`](phase-history.md) for the full Phase 5 entry.

### 6.6 Phase 5 — Workforce OS expansion (`wos_*`)

Six net-new multi-tenant domains layered on `gov_*`/`p5_*`/`tenants`. Read-only against earlier phases. Language policy enforced in every envelope.

- **DB** (`wos_*`): `wos_market_signals`, `wos_skill_obsolescence`, `wos_workforce_risk`, `wos_role_emergence`, `wos_ai_exposure`, `wos_fairness_suites`, `wos_fairness_results`, `wos_disputes`, `wos_human_overrides`, `wos_roles`, `wos_role_assignments`, `wos_learning_roi`, `wos_audit_logs`. Extra tenants seeded: `MTRX_UNI`, `MTRX_SKILL`, `MTRX_AGENCY` (plus `MTRX_DEMO`).
- **Services** (all `5.0.0`): `market-intelligence-engine.ts`, `predictive-workforce-engine.ts`, `fairness-monitoring-engine.ts` (disparate impact, mean-score gap, selection-rate gap), `dispute-override-engine.ts` (FSM-guarded transitions), `rbac-tenant-engine.ts` (wildcard-aware: `'wos:*'`, `'platform:*'`), `learning-roi-engine.ts`.
- **Routes**: read-only `/api/wos/*` with envelope `{ ok, …, language_policy, methodology_versions, request_id }`; writes guarded by `requirePermission(pool, 'perm:scope')`; failures audit-logged to `wos_audit_logs`. Single rollup `GET /api/wos/dashboard?tenant_id=` bundles 8 surfaces.

### 6.7 Global Role Ontology enhancement (`gro_*`)

`backend/migrations/20260601_global_ontology_phase1.sql`. Powers the CAPADEX profile selectors with a broader role/industry vocabulary than the in-app catalog; merged into `assessmentOptionsService.loadRoleOptions / loadIndustryOptions`.

### 6.8 Scientific Competency Intelligence (`sci_*`)

`backend/migrations/20260605_scientific_competency_phase2.sql` · `ScientificCompetencyPage.tsx` · `?screen=scientific-competency`. Psychometric science layer (IRT, factor analytics) over Phase 1–2.

### 6.9 Market Intelligence + Evidence Graph + Mobility 2.0 (`m3_*`)

`backend/migrations/20260610_market_intelligence_phase3.sql` · `MarketIntelligencePage.tsx` · `?screen=market-intelligence`. Soft FKs to `onto_*` / `bench_*` / `sci_*` by design (cross-phase pattern).

### 6.10 AI Governance + Localization + Predictive + Simulation (`m4_*`)

- **DB**: `backend/migrations/20260615_ai_governance_phase4.sql`.
- **Services** (all `4.0.0`):
  - `m4-ai-governance.ts` — policy registry, decision logging, model versioning + rollback, hallucination flags.
  - `m4-fairness.ts` — runnable fairness suites; per-model thresholds.
  - `m4-localization.ts` — country profiles, per-country weight adaptation, language overrides.
  - `m4-predictive.ts` — trajectory classification, future-readiness, promotion proximity, leadership potential, skill decay, future gaps, burnout signal.
  - `m4-simulation.ts` — scenario runner.
  - `m4-org-risk.ts` — `computeCapabilityRisk`, `computeSuccessionRisk`, `computeResilience` = `0.40·R + 0.35·M + 0.25·LV`.
  - `m4-observability.ts` — pure `computePSI`, `computeMAPE`, `computeBrier`; `recordAccuracy`, `recordDrift` (PSI 0.10 warn / 0.20 fail).
- **Routes**: `/api/m4/gov/*`, `/fair/*`, `/loc/*`, `/pred/*`, `/sim/*`, `/risk/*`, `/obs/*`, `/_meta/versions`. All responses wrapped via `wrap()` from `explainability-engine.ts` with `METHOD_VERSIONS` envelope. Mutations write to `m4_audit_logs`.
- **Frontend**: `AIGovernancePage.tsx` — 7 tabs (AI Governance | Fairness & Bias | Localization | Predictive Workforce | Workforce Simulation | Organizational Risk | AI Observability).
- **Safe-language gate** — redacts (does not block); decisions logged with `[REDACTED]` rationale + hallucination flag.

### 6.11 Enterprise Workforce + AI Coaching + Executive Decision (`m5_*`)

- **DB**: ~36 `m5_*` tables across **Workforce Intelligence**, **Succession**, **AI Coaching**, **Simulation 2.0**, **Executive Decision**, **Org Benchmarking**, **Org Graph**, **Decision Support**, **Observability**, **Audit**.
- **Services** (all `5.0.0`, AI Coaching bumped to `5.0.1` for real-score resolver):
  - `m5-workforce-intelligence.ts` — maturity bands (L1–L5 at 35/50/65/80), readiness with consistency band, `computeECI` (avg of workforce/leadership/future-readiness/agility/resilience).
  - `m5-succession.ts` — `computeSuccessionReadiness({LC,SR,MA,FP,rc}) = (0.30·LC + 0.25·SR + 0.20·MA + 0.25·FP) × clip(0.7 + 0.3·rel, 0.7, 1.0)`; bands `ready_now ≥ 80 / ready_12m ≥ 65 / ready_24m ≥ 50 / developing`.
  - `m5-ai-coaching.ts` — `generateGrowthRoadmap` with per-competency `priority = gap × (0.5 + 0.5·market) × (1.2 − 0.4·velocity)`; `projected_uplift = gap × (0.30 + 0.40·velocity) × (horizon/12)`.
  - `m5-workforce-simulation.ts` — applies uplift_pct to targeted capabilities + 2% drift to non-targeted; derives `leadership_lift = composite_delta × 1.2`, `succession_lift × 0.85`, `resilience_lift × 0.65`; learning-ROI block when investment supplied; 18-month conservative band.
  - `m5-executive-intelligence.ts`, `m5-org-benchmark.ts`, `m5-org-graph.ts` (concentration-risk: edge-weight share ≥ 40% flagged fragile), `m5-enterprise-observability.ts`.
- **Routes**: `/api/m5/wfi/*`, `/succ/*`, `/coach/*`, `/sim/*`, `/exec/*`, `/bench/*`, `/graph/*`, `/obs/*`, `/_meta/versions`. Wrapped via `wrap()`; mutations write to `m5_audit_logs` + `m5_enterprise_observability_logs`.
- **Frontend**: `EnterpriseWorkforceOSPage.tsx` — 9-tab dashboard.

### 6.12 Assessment Writers (the bridge)

- **Migration**: `backend/migrations/20260621_assessment_writers.sql`.
- **Tables**: `user_assessment_snapshots` (header per submission), `user_competency_scores` (latest-value store, UPSERT on `(user_id, competency_id)`). Column add: `p4_competency_history.snapshot_id TEXT` (nullable, backward compatible).
- **Service**: `backend/services/assessment-writer.ts`, `ASSESSMENT_WRITER_VERSION='1.0.0'`. Single chokepoint `writeSnapshot()` does header + history append + UPSERT + non-blocking audit.
- **Routes**: `/api/career/assessment/snapshot` (POST), `/snapshot/:user_id`, `/snapshots/:user_id`, `/scores/:user_id`, `/_meta/version`.
- **Effect on resolvers**: `adaptive-benchmark.parseScores` and `m5-enterprise-workforce.coachInput` look up `user_competency_scores` when `?user_id=` is supplied; previously stuck on `DEMO_SCORES`.

---

## 7. Explainability envelope

Every Adaptive Intelligence response (m3/m4/m5/wos/bench/mobility) is wrapped via `wrap()` from `backend/services/explainability-engine.ts` and ships:

```jsonc
{
  "ok": true,
  "...payload...": "...",
  "methodology_versions": { "WORKFORCE_INTELLIGENCE_VERSION": "5.0.0", "...": "..." },
  "language_policy": {
    "allowed": ["developmental signal", "capability indicator", "readiness band", "..."],
    "disallowed": ["hiring decision", "promotion prediction", "candidate suitability", "..."]
  },
  "request_id": "req_..."
}
```

- **`/api/.../_meta/versions`** exposes the engine version map for the namespace.
- **Mutations** write to the namespace's `*_audit_logs`. WOS additionally enforces `requirePermission(pool, 'perm:scope')` with wildcard RBAC and audit-logs failures.
- **Safe-language gate (m4)** redacts non-compliant rationales rather than blocking; decisions are stored with `[REDACTED]` + a hallucination flag.

---

## 8. Cross-cutting invariants

### 8.1 Language policy (do not violate)

Every Adaptive Intelligence envelope ships allowed/disallowed term lists. Outputs are **developmental signals only**, NEVER hiring / promotion / candidate-suitability predictions. The policy is enforced in:

- Static UI copy in each phase's dashboard.
- `wrap()` envelopes on every API response.
- `m4` safe-language redaction gate on AI-derived rationales.

### 8.2 k-anonymity

Peer benchmarks suppressed below `k_min=30`. Cohort responses are aggregate-only. `confidenceTier(n)`: A=1000 / B=300 / C=100 / D=30 / `provisional` (<30). Frontend surfaces this as an amber hatched fill + pulsing `Provisional · cohort building` pill + `~ estimate` label whenever `bench_confidence.tier ∈ {C, D, provisional}`.

### 8.3 Append-only history

`p4_competency_history`, `m3_*` history tables, and assessment-writer-touched columns are **never** mutated in place. New events are always appended; the latest row per key is the current value.

### 8.4 Preserve existing UI

All Adaptive Intelligence phases are **additive new pages**, never modifications to:

- `CompetencyDashboard.tsx`
- `GapAnalysisPage.tsx`
- `CareerBuilderPage.tsx` core (the AssessmentTab landing is the one carve-out and is feature-flagged via `optionsReady` + custom-entries plumbing)
- `TrajectoryDashboardPage.tsx`

### 8.5 Read-only against earlier phases

Every phase reads from earlier-phase tables (often via soft FKs to absorb cross-phase drift) and writes only to its own `<namespace>_*` tables.

### 8.6 Tab name canon (do not regress)

The `TabId` union in `CareerBuilderPage.tsx` line 51 is the source of truth. Common typos to avoid: `'tracker'` → use `'jobs'`; `'mentor'` → use `'mentors'`. All deep-link targets (in `StageGuidancePanel` and elsewhere) must use canonical values.

---

## 9. Version registry

| Engine | Version |
|---|---|
| `ONTOLOGY_VERSION` | `1.0.0` |
| `BENCH_METHODOLOGY_VERSION` | `2.0.0` |
| `WEIGHTING_VERSION` | `2.0.0` |
| `MOBILITY_VERSION` | `3.0.0` |
| `PATHWAY_VERSION` | `3.0.0` |
| `RECOMMENDATION_VERSION` | `3.0.0` |
| `AI_GOVERNANCE_VERSION`, `FAIRNESS_VERSION`, `LOCALIZATION_VERSION`, `PREDICTIVE_VERSION`, `TRAJECTORY_VERSION`, `READINESS_VERSION`, `BURNOUT_VERSION`, `CAPABILITY_FORECAST_VERSION`, `SIMULATION_VERSION`, `ORG_RISK_VERSION`, `OBSERVABILITY_VERSION` | `4.0.0` |
| `WORKFORCE_INTELLIGENCE_VERSION`, `ECI_VERSION`, `SUCCESSION_VERSION`, `GROWTH_ROADMAP_VERSION`, `WORKFORCE_SIMULATION_VERSION`, `EXECUTIVE_INTELLIGENCE_VERSION`, `EXECUTIVE_RECOMMENDATION_VERSION`, `ORG_BENCHMARK_VERSION`, `ORG_GRAPH_VERSION`, `ENTERPRISE_OBSERVABILITY_VERSION` | `5.0.0` |
| `AI_COACHING_VERSION` | `5.0.1` (bumped for real-score resolver) |
| `MARKET_INTELLIGENCE_VERSION`, `PREDICTIVE_WORKFORCE_VERSION`, `FAIRNESS_MONITORING_VERSION`, `DISPUTE_OVERRIDE_VERSION`, `RBAC_TENANT_VERSION`, `LEARNING_ROI_VERSION` | `5.0.0` |
| `ASSESSMENT_WRITER_VERSION` | `1.0.0` |
| `CRA_VERSION` (Competency Assessment Runtime) | `1.0.0` |

---

## 10. Smoke-test recipes

```bash
# 1) Submit an assessment + write snapshot
curl -X POST $API/api/competency/run-assessment \
  -H 'Content-Type: application/json' \
  -d '{"userId":1,"scores":[{"competencyCode":"COG","rawScore":72,"confidence":0.8}, ...]}'

curl -X POST $API/api/career/assessment/snapshot \
  -d '{"user_id":1,"role_id":42,"scores":{"COG":72, ...},"reliability":0.78,"source":"assessment"}'

# 2) Verify the snapshot wrote through
curl $API/api/career/assessment/scores/1
# → 12 scores keyed by competency_id
curl $API/api/m5/coach/growth-plan?user_id=1
# → baselines now equal the submitted scores
curl "$API/api/benchmark/role?user_id=1&role_id=42"
# → uses persisted vector instead of demo
```

---

## 11. Where to extend next

| Want to add… | Touch |
|---|---|
| A new competency code | `COMPETENCY_META` in `competency-assessment-runtime.ts` + `onto_competencies` seed + bench seed |
| A new role + Role-DNA | `industryRoles.ts` (catalog) + `onto_roles` + `onto_role_dna_profiles` + `onto_role_competency_weights` |
| Per-department weighting | Currently reserved fields on `cra_profiles`; extend `ROLE_PRIORITIES` to be keyed by `(role, department)` |
| A new adaptive phase | New `*_*` namespace + migration + service + routes registered in `backend/routes.ts` + new page in `App.tsx` Screen union + `isValidScreen` allowlist + `?screen=` deep-link |
| A new fairness check | `m4-fairness.ts` (add threshold) or `wos_fairness_suites` (data-driven) |

---

_Last updated: 2026-05-22. Source of truth for live architecture: `replit.md`. Source of truth for per-phase build details: `docs/phase-history.md`._
