# Competency Assessment — Technical Document

**Module**: MetryxOne Career Builder · Competency Assessment
**Status**: Production · integrated with Phase 1 (Ontology) + Phase 2 (Adaptive Benchmark)
**Version**: `ONTOLOGY_VERSION='1.0.0'` · `BENCH_METHODOLOGY_VERSION='2.0.0'` · `WEIGHTING_VERSION='2.0.0'`

---

## 1. Overview

The Competency Assessment is MetryxOne's multi-method behavioural intelligence engine. It captures a user's profile (current role, target role, career stage, industry), runs a 20-question multi-method assessment, and returns:

- 7-domain competency scores (0–100)
- Role-Fit probability against the target role
- Industry/peer percentile ranking (empirical, k-anonymous)
- Gap analysis vs. target Role-DNA
- Recommended interventions (courses · projects · mentorship)

The system is **read-only against the ontology** (`onto_*` tables) and **read-only against the benchmark layer** (`bench_*` tables). It writes only to assessment-owned tables (`competency_scores`, `career_profiles`).

---

## 2. User-Facing Flow

| Step | Component | Notes |
|------|-----------|-------|
| 1. Setup | `frontend/src/components/assessment/phases/CapadexInsProfilePhase.tsx` | Current Role · Target Role · Career Stage · Industry · Experience years. Includes CV PDF text extraction (`extractTextFromPDF`) + role auto-complete via `RoleCombobox`. |
| 2. Assessment | `frontend/src/components/assessment/phases/CapadexQPhase.tsx` | 20 multi-method questions: MCQ · Situational Judgment · Self-Assessment · Behavioural Simulation. Auto-saves between answers. ~15–20 minutes. |
| 3. Result | `frontend/src/components/assessment/phases/CapadexResultPhase.tsx` | Score ring · percentile ranking · Domain Intelligence Map (bars) · Behavioural Intelligence insights. |
| 4. Drill-down | `frontend/src/pages/competency/GapAnalysisPage.tsx` · `frontend/src/components/CompetencyDashboard.tsx` | Per-domain breakdown · benchmark overlays · intervention picker. |

Setup is wired into Career Builder via `frontend/src/pages/CareerBuilderPage.tsx`.

---

## 3. The 7 Competency Domains

| Code | Domain | Scope |
|------|--------|-------|
| **COG** | Cognitive & Analytical | Reasoning · problem decomposition · data interpretation |
| **COM** | Communication & Influence | Written/verbal clarity · persuasion · stakeholder navigation |
| **LEA** | Leadership & People | Direction-setting · coaching · team dynamics |
| **EXE** | Execution & Delivery | Planning · prioritisation · ownership · throughput |
| **ADP** | Adaptability & Growth | Learning agility · resilience · change tolerance |
| **TEC** | Technical & Domain | Role-specific technical depth + domain fluency |
| **EIQ** | Emotional & Social Intelligence | Self-awareness · empathy · regulation · collaboration |

Each domain rolls up to a single 0–100 score. Domains are stored as `competency_domains` rows; individual competencies (50+) map to a parent domain.

---

## 4. Question Engine

- **Total items**: 20 (configurable; defaults seeded)
- **Methods**: 4 — MCQ, Situational Judgment (SJT), Self-Assessment (Likert), Behavioural Simulation
- **Coverage**: each session samples items to cover all 7 domains
- **Auto-save**: every answer is persisted; resumable session
- **Adaptive**: question pool and weighting flex against the target Role-DNA returned by `getRoleDNA(roleId)`

---

## 5. Backend Architecture

### Route prefix
- `/api/competency/*` — `frontend/server/src/routes/competency.ts`

### Services

| File | Responsibility |
|------|----------------|
| `frontend/server/src/services/competency/scoring.ts` | Orchestrates raw answers → per-competency scores → domain rollups |
| `frontend/server/src/services/competency/roleFitness.ts` | Computes Role-Fit using `role_weights` × user scores |
| `frontend/server/src/services/competency/gapAnalysis.ts` | `severity = (target_weight × expected_level) - actual_score` |
| `backend/services/competency-ontology.ts` | Phase 1 read-only ontology API (domains · families · competencies · aliases · Role-DNA) |
| `backend/services/adaptive-benchmark.ts` | Phase 2 empirical percentile + Wilson 95% CI + confidence tier |
| `backend/services/longitudinal-engine.ts` | Tracks score evolution across sessions (EWMA α=0.30, conservative projection bands) |

### Database tables

**Assessment-owned**
- `competency_domains` — 7 rows
- `competencies` — 50+ rows mapping competency → domain
- `role_weights` — `(role, stage, competency) → weight` for Role-Fit
- `competency_scores` — user-specific results (per-session, per-competency)
- `career_profiles` — setup payload (current/target role · industry · stage · experience)
- `competency_interventions` — `(gap_level, type) → intervention` lookup

**Read references (Phase 1 — `onto_*`)**
- `onto_competencies`, `onto_aliases`, `onto_dna_profiles`, `onto_role_weights`

**Read references (Phase 2 — `bench_*`)**
- `bench_cohorts`, `bench_competency_benchmarks` (with `sorted_samples`), `bench_confidence`

Schema source: `frontend/server/src/db/schema.ts`; migrations in `backend/migrations/`.

---

## 6. Scoring Methodology

### 6.1 Per-competency raw score
A weighted aggregation of all responses that touch a given competency, normalised to 0–100. Method weights (MCQ vs SJT vs Self vs Simulation) are configurable per item.

### 6.2 Domain rollup
```
domain_score = Σ(competency_score × competency_weight_in_domain) / Σ(weights)
```

### 6.3 Role-Fit
```
role_fit = Σ(user_score[c] × role_weight[role, stage, c]) / Σ(role_weight[role, stage, c])
```
`role_weight` is resolved via the ontology's `onto_role_weights` table joined to the current Role-DNA (`is_current = true`), with context modifiers (layer · seniority · org_maturity · team_scale · industry · geography) applied by `backend/services/weighting-engine.ts`.

### 6.4 Industry/peer percentile (Phase 2)
**Empirical only — no Gaussian assumption.** The benchmark service performs a binary search over the cohort's `sorted_samples` array:
```
percentile = empiricalPercentile(user_score, cohort.sorted_samples)
ci_95      = wilsonInterval(rank, n)
tier       = confidenceTier(n)   // A≥1000 · B≥300 · C≥100 · D≥30 · provisional<30
```
A diagnostic z-score is computed but **never used to derive the percentile** — it's surfaced only for transparency.

Cohort resolution priority: role × layer × industry → role × industry → role → function → global. First match with `n ≥ k_min (30)` wins.

### 6.5 Gap analysis
```
gap_severity[c] = max(0, target_weight[c] × expected_level[c] - actual_score[c])
gap_level       = critical | high | medium | low   // threshold-bucketed
```
`expected_level` anchors come from Role-DNA: levels 1→5 map to scores 30 / 50 / 65 / 80 / 92.

### 6.6 Interventions
Each non-zero gap is matched against `competency_interventions` filtered by `(gap_level, type)`. Output is a ranked list of courses · projects · mentor matches, deduplicated against the user's completed-learning history.

---

## 7. Phase 1 Integration — Competency Ontology

- Service: `backend/services/competency-ontology.ts` (read-only, raw pg Pool)
- 19 `onto_*` tables; deterministic seed; composite FK enforces `competency.domain == family.domain`
- Used by the assessment for:
  - **Canonical role resolution** — free-text current/target role → canonical role via `onto_aliases`
  - **Role-DNA lookup** — `getRoleDNA(roleId)` returns expected proficiency level per competency
  - **Domain/family taxonomy** — drives the 7-domain rollup

Full reference: `replit.md` § "Adaptive Career Intelligence — Phase 1".

---

## 8. Phase 2 Integration — Adaptive Benchmarking

- Service: `backend/services/adaptive-benchmark.ts` · routes: `/api/benchmark/*`
- 10 `bench_*` tables · 15 seeded cohorts (1 global / 2 industry / 3 function / 5 role / 4 layer)
- Empirical percentile + Wilson 95% CI + confidence tier; full audit logging via `bench_audit_logs`
- k-anonymity preserved (`k_min=30`, aggregate-only responses)

Full reference: `replit.md` § "Adaptive Career Intelligence — Phase 2".

---

## 9. Longitudinal Tracking (Phase 4 hook)

Every completed assessment writes a row to `p4_competency_history` (append-only). The Trajectory Dashboard (`frontend/src/pages/TrajectoryDashboardPage.tsx`) reads from `backend/services/longitudinal-engine.ts`:
- **Velocity**: EWMA momentum (α=0.30)
- **Projection bands**: conservative; widened by `(1 − consistency)`
- **Maturity heuristic**: score → level 1–5 at thresholds 50 / 65 / 80 / 92

This means repeat assessments accumulate evidence — a single result is interpreted alongside historical trend + reliability tier.

---

## 10. Reliability & Quality (Phase 2)

`backend/services/reliability-engine.ts` computes a composite reliability score per session:
```
reliability = 0.40 × consistency
            + 0.20 × reverse_item_agreement
            + 0.20 × (1 − contradictions)
            + 0.15 × completion
            + 0.05 × (1 − anomalies)

quality_tier = A ≥ 0.85 · B ≥ 0.70 · C ≥ 0.50 · D < 0.50
```
A reliability banner surfaces in the result UI whenever the session tier is C or D — recommendations are then labelled "directional".

---

## 11. Explainability Envelope (Phase 5)

Every assessment-related API response is wrapped by `backend/services/explainability-engine.ts → wrap()`. The envelope includes:
- `methodology_version` (ontology / benchmark / weighting / longitudinal)
- `cohort` + `cohort_tier`
- `data_sources` (evidence trail)
- `weighting_policy` (composition rationale)
- `language_policy` (allowed/disallowed phrases — developmental readiness · capability proximity; NEVER asserts hiring/promotion outcomes)

This envelope drives the in-app "How was this computed?" drawer and is the contract any downstream consumer can rely on.

---

## 12. Security & Privacy

- **k-anonymity** on every benchmark response (`k_min=30`)
- **DPDP/GDPR-aligned consent scaffold** via `backend/services/security-middleware.ts → requireConsent()`
- **Rate limiting** + request-ID stamping on all `/api/competency/*` and `/api/benchmark/*` routes
- **Anti-enumeration delay** on lookup endpoints
- **Full audit trail** — every benchmark call writes `bench_audit_logs` with `k_check_passed` stamped

---

## 13. Versions & Methodology Provenance

| Layer | Constant | Value |
|-------|----------|-------|
| Ontology | `ONTOLOGY_VERSION` | `1.0.0` |
| Benchmark | `BENCH_METHODOLOGY_VERSION` | `2.0.0` |
| Weighting | `WEIGHTING_VERSION` | `2.0.0` |
| Mobility | `MOBILITY_VERSION` | `3.0.0` |
| Longitudinal | `LONGITUDINAL_VERSION` | `4.0.0` |
| Workforce analytics | `WORKFORCE_ANALYTICS_VERSION` | `4.0.0` |

All versions are surfaced in the explainability envelope and persisted in `gov_methodology_versions` for governance review.

---

## 14. Key File Reference

### Frontend
- `frontend/src/components/assessment/phases/CapadexInsProfilePhase.tsx` — Setup
- `frontend/src/components/assessment/phases/CapadexQPhase.tsx` — Runner
- `frontend/src/components/assessment/phases/CapadexResultPhase.tsx` — Results
- `frontend/src/components/CompetencyDashboard.tsx` — 7-domain visualisation
- `frontend/src/pages/competency/GapAnalysisPage.tsx` — Gap drill-down
- `frontend/src/pages/CareerBuilderPage.tsx` — Entry point

### Backend / engines
- `frontend/server/src/routes/competency.ts` — `/api/competency/*`
- `frontend/server/src/services/competency/{scoring,roleFitness,gapAnalysis}.ts`
- `backend/services/competency-ontology.ts` — Phase 1 ontology
- `backend/services/adaptive-benchmark.ts` — Phase 2 percentile
- `backend/services/weighting-engine.ts` — Context-aware role weights
- `backend/services/reliability-engine.ts` — Session quality
- `backend/services/longitudinal-engine.ts` — History & momentum
- `backend/services/explainability-engine.ts` — Response envelope

### Database
- `frontend/server/src/db/schema.ts`
- `backend/migrations/20260523_competency_ontology_phase1.sql`
- `backend/migrations/20260524_adaptive_benchmark_phase2.sql`
- `backend/migrations/20260526_intelligence_phase4.sql`
- `backend/migrations/20260527_intelligence_phase5.sql`

---

## 15. Glossary

- **Role-DNA** — versioned competency profile for a canonical role (expected proficiency levels per competency)
- **Cohort** — population segment for benchmarking (global · industry · function · role · layer)
- **k-anonymity** — privacy guarantee that no benchmark response can be tied to fewer than `k` individuals
- **EWMA** — exponentially weighted moving average; used for velocity to favour recent evidence without discarding history
- **Wilson interval** — robust binomial confidence interval; preferred over normal-approximation for small `n`
- **Confidence tier** — A (n≥1000) · B (n≥300) · C (n≥100) · D (n≥30) · provisional (n<30)
- **Quality tier** — derived from composite reliability: A ≥ 0.85 · B ≥ 0.70 · C ≥ 0.50 · D

---

*Generated: May 21, 2026 — reflects the current state of the codebase. Update this document whenever methodology versions are bumped or new domains/phases are added.*
