---
name: Competency Runtime (Phase 2) activation
description: How the live competency chain (generate→score→profile→gap) is grounded, why scores are a domain-proxy, and why it's super-admin gated.
---

# Competency Runtime — Phase 2

Flag `competencyRuntime` (default OFF → 503 before any DB/auth). Engine in
`services/competency-runtime.ts`, routes in `routes/competency-runtime.ts`,
tables `onto_assessment_instances/responses/competency_scores/competency_profiles`
(profile append-only).

## Phase 2.4 Competency Scoring Engine — shares Phase 2.3's substrate
`services/competency-scoring.ts` (version `phase-2.4`) depends on the EXACT same substrate as Phase 2.3 assembly: `onto_question_competency_mapping`, `competency_question_templates.status='approved'`, and the `competencyRuntime` flag (env `FF_COMPETENCY_RUNTIME`). Once 2.3 was activated, 2.4 needed ZERO new fixes.
Chain: deriveRawScore (Q→raw; correct→100/0, or Likert ladder) → computeCompetencyScores (difficulty-weighted sum, ordinal foundational=1..expert=5) → normalizeScore (weighted %, or cohort T-score ONLY when real cohort n≥30, never fabricated) → calculateCompetencyLevel (≥80/60/40/20 → L5..L2 else L1; null→unmeasurable, never floored to 1). Empty/unscoreable responses → status `scoring_empty` + null overall. Persists to `onto_competency_score_runs`; reads level labels from `onto_proficiency_levels` (5 rows). Routes: POST /score, POST /score-preview (run_id null = not persisted), GET /score-runs/:runId.

## Domain-proxy measurement (the honesty crux)
- Question bank `competency_question_templates` is keyed by **7 codes**
  (COG/COM/LEA/EXE/ADP/TEC/EIQ); the genome taxonomy has **5 onto-domains**.
  `onto_competency_question_map` is **0 rows**, so a competency cannot be scored
  by its own questions yet.
- Curated inert `DOMAIN_CODE_TO_ONTO` crosswalk maps the 7 codes DOWN to the 5
  onto-domains; a competency inherits its **onto-domain** score →
  `measurement: "domain_proxy"`. **Auto-upgrades** to per-competency precision the
  moment `onto_competency_question_map` is populated — no code change.
- `dom_strategic` has **no bank code** → its competencies are reported
  `unmeasurable` (reason string), excluded from scores and coverage numerator.
  **Never** fabricate a score for them.
- Coverage (measurable vs total) is a SEPARATE axis from score. Bank empty (0
  approved templates) → generation honestly yields 0 questions.

## Scoring deviation
Mirrors bank `option.score` (0–100), NOT the CAF/IRT engine (wrong data shape).
`scoreToLevel`: ≥80→5, ≥60→4, ≥40→3, ≥20→2, else 1. Likert/no-option questions
default to a 5-point 0/25/50/75/100 scale (see competency-questions.ts rowToQuestion).

## Access control
`subject_id` is an OPERATOR-supplied identifier for any assessed person (not the
caller's own identity). All five routes are `gate → requireAuth → requireSuperAdmin`.
A `requireAuth`-only version is an IDOR (any user reads/scores any subject) — a code
review caught exactly this. Reuses `getRoleReadiness` for gap analysis.

## Phase 2.5 Profile Engine + Phase 2.6 Role Readiness
- TWO DISTINCT scoring paths feed the chain — do not confuse:
  1. **Phase 2 generate→score** (7-letter codes COG/COM/LEA/EXE/ADP/TEC/EIQ,
     `question_type='likert'`) writes `onto_competency_profiles`. This is what 2.5/2.6
     READ.
  2. **Phase 2.3/2.4 assemble→/score** (comp_* ids) writes `onto_competency_score_runs`
     (the existing panel Steps 1–3). Separate substrate.
- `computeTypeProfile()` buckets each blueprint competency into 5 onto-TYPES
  (behavioral/cognitive/functional/technical/future_skills) via `onto_competency_type_map`;
  UNCLASSIFIED when the map has no row (never fabricate). Buckets carry score/level/count;
  `classification_coverage_pct` is a separate axis from score.
- `computeRoleReadinessForSubject` → `getRoleReadiness` returns `null` ONLY when no
  role profile exists (honest "unmeasured"). Do NOT wrap it in `.catch(()=>null)` — that
  masks real DB errors as business-state absence; let them propagate to a 500.
- `roleFit()` adds `strengths` (attainment ≥100% met-or-exceeded), `gap_areas`,
  `critical_gaps`, and a `role_fit` band to readiness output.
- Seeded demo: `onto_role_competency_profiles` blueprint_derived rows;
  `onto_competency_type_map` via competency-types seed (confidence 'high' + evidence,
  needs_review). Demo Likert bank `template_key LIKE 'demo7_<CODE>_<n>'`.

## Flag-gated admin tab (frontend hide when OFF)
Tab `competency-runtime` in `useAdminDashboardState.tsx` is gated by probing a gated GET
(`/api/competency-runtime/competency-types/report` → `res.ok`) into `competencyRuntimeEnabled`,
then a `.map` that filters the nav item out when false (mirrors simHarness/governance pattern).
Flag OFF → routes 503 + tab hidden = byte-identical to legacy.

## Testing
No UI/HTTP-ON path in dev (workflow leaves flag OFF). Exercise the engine via a
tsx script that sets `process.env.FF_COMPETENCY_RUNTIME='1'`, seeds demo `approved`
templates (`template_key LIKE 'demo_phase2_%'`) against `blueprint_pm`, runs the
chain, then DELETEs every demo row (shared dev/prod DB → must be purgeable).

## Phase 2.7 — Competency Gap Analysis (additive over computeGapAnalysis)
- `prioritizeGap(GapRow)` is PURE: matrix critical&gap>0→high(0); important gap≥2→high(1)
  else medium(10); desirable gap≥2→medium(11) else low(20); optional gap≥1→low(21);
  gap≤0→none(80); unmeasurable/unscored→unprioritized(90). Sort rank,gap,weight.
  unmeasurable/unscored NEVER get a fabricated priority — that IS the honesty contract.
- `computeCompetencyGapEngine()` COMPOSES `computeGapAnalysis()` (never recomputes gaps),
  reshapes each row to canon Required/Current/Gap/Priority/Development Need via
  `developmentNeed()` deterministic templates (raise / maintain / cannot-be-measured /
  not-scored). `computeGapDashboard()` = engine + readiness + coverage rollup.
- Routes `GET /api/competency-runtime/gap-engine/:subjectId` + `/gap-dashboard/:subjectId`,
  `gate, requireAuth, requireSuperAdmin` (gate FIRST = byte-identical OFF). Responses wrap
  under `.data` ({ok,version,data:{...}}).
- Frontend: gap table (Required/Current/Gap/Priority/Development Need) + priority-summary
  badges in `CompetencyRuntimePanel.tsx`, fetched alongside dashboard in `loadDashboard`
  (Promise.all); gapEngine null-tolerant so a 503 just hides the table.
- Demo subject `demo_subj_pm` meets/exceeds all reqs → all 'none'/'unprioritized', 0 dev
  needs. That's the HONEST output, not a bug (no High/Med/Low fires without a real gap).

## Phase 2.8 — Competency Signal Engine (additive over computeGapAnalysis)
- Higher-order behavioural SIGNALS from COMBINATIONS of measured competency states (e.g.
  Low Comm+Low Collab+Low Presentation→Workplace Communication Risk; High Problem Solving+
  High Systems Thinking→Innovation Potential). `SIGNAL_LIBRARY` (7 metadata entries) +
  `SIGNAL_RULES` (7 keyword-condition rules) are STATIC curated catalogs in section 10 of
  `backend/services/competency-runtime.ts`. Thresholds FIXED/published: low ≤ L2, high ≥ L4.
- `evaluateSignalCondition()` matches by keyword SUBSTRING on competency NAME; rep = strongest
  evidence in direction (tie-break competency_id asc). Honesty status precedence is the whole
  point: no matched competency in blueprint OR matched-but-none-scored → condition
  'unevaluable'; then ANY unevaluable condition → signal 'unevaluable'; else all met → 'fired';
  else 'not_fired'. A signal CANNOT fire from missing/unscored data — that IS the contract.
- `computeCompetencySignalEngine()` COMPOSES `computeGapAnalysis()` (never recomputes scores).
  Per-condition output carries status + matched_competency(or null) + reason; fired signals
  carry triggered_by[]. summary = {total,fired,risk_fired,potential_fired,not_fired,unevaluable}.
- Routes `GET /api/competency-runtime/signal-library` (literal, MUST be registered BEFORE the
  param route) + `/signal-engine/:subjectId`, both `gate, requireAuth, requireSuperAdmin`
  (gate FIRST = byte-identical OFF, 503). Responses wrap under `.data`.
- Frontend: Signals section in `CompetencyRuntimePanel.tsx`, fetched in `loadDashboard`
  Promise.all (null-tolerant → 503 hides section); fired/not_fired/unevaluable + polarity badges.
- Demo `demo_subj_pm`: 3 fired potentials (change_resilience/ownership/collaborative_leadership),
  2 not_fired risks (stakeholder_disconnect/disengagement — evaluable, comps high), 2 unevaluable
  (workplace_communication_risk: Comm/Presentation absent + Agile Collaboration unmeasured;
  innovation_potential: Problem Solving/Systems Thinking absent). That spread IS the honest output.

## Phase 2.9 — Benchmark Foundation (Candidate vs Role/Dept/Function/Industry/Institution)
- COMPOSES the EXISTING benchmark substrate — never reinvent percentile math. Real infra:
  `bench_cohorts` (cohort_type ∈ global/industry/function/role/layer, k_min=30) +
  `bench_competency_benchmarks` (sorted_samples, n). Engine = `services/adaptive-benchmark.ts`
  (resolveCohort, benchmarkCompetency w/ k-anonymity) + `empirical-percentile.ts`
  (count ≤ candidate / n, never Gaussian). Candidate per-comp score = `computeGapAnalysis`
  GapRow.measured_score (0-100 domain-proxy) — composed, not recomputed.
- Dimension honesty matrix is the whole point (NEVER fabricate membership):
  Role=available (profile.role_id→cohort, e.g. role_pm→coh_role_pm n=340); Function/Industry=
  context_unavailable (cohorts EXIST but candidate has NO function_id/industry_id captured —
  honest, not inferred); Department/Institution=dimension_unsupported (no bench cohort_type at all).
- Per-competency status precedence: unscored→`unevaluable`; no bench row for that competency_id→
  `no_benchmark`; cohort n<k_min→`suppressed` (delegated to benchmarkCompetency, never expose raw
  peers); else empirical band vs cohort → above/at/below. bandToStatus: top/upper→above, mid→at,
  lower/bottom→below.
- 3 fns in section 11 of `backend/services/competency-runtime.ts`: computeBenchmarkEngine
  (dimension resolution + cohort ref/n/k), computeBenchmarkComparison (per available cohort,
  benchmarkCompetency each scored comp + per-dim summary), computeBenchmarkDashboard (rollup +
  primary dim). Routes `/benchmark-engine|comparison|dashboard/:subjectId`, all
  `gate, requireAuth, requireSuperAdmin` (gate FIRST = byte-identical OFF 503). Responses wrap `.data`.
- Frontend: Benchmark Foundation section in `CompetencyRuntimePanel.tsx`, fetched in loadDashboard
  Promise.all (null-tolerant → 503 hides section); per-dimension cards w/ status badges +
  per-competency percentile/band table for available dim only.
- Demo `demo_subj_pm`: Role available, 4 compared (all 'at', mid band, aggregate P46),
  comp_ambiguity_tolerance=no_benchmark (no bench row), comp_agile_collaboration=unevaluable
  (unscored); Function/Industry context_unavailable; Department/Institution dimension_unsupported.
  Unmeasured subject → measured=false, total=0, all dims honest. That spread IS the honest output.

## Phase 2.10 — Super-Admin Runtime Validation
- `computeRuntimeValidation(pool, subjectId)` (section 12 of `backend/services/competency-runtime.ts`):
  read-only, never-throws end-to-end validator over 11 stages (blueprint_creation, question_mapping,
  assessment_generation, scoring, competency_profile, readiness_calculation, gap_analysis,
  signal_generation, benchmarks, audit_logs, permissions). COMPOSES same-file engines (getProfile,
  computeGapAnalysis, computeRoleReadinessForSubject, computeCompetencySignalEngine,
  computeBenchmarkDashboard) + raw COUNT via local `safeCount` (returns null on error, NEVER coerced
  to 0). Each stage wrapped in a `run()` try/catch so one broken link can't abort the report.
- HONESTY-SEMANTICS RULE (architect-corrected, the key lesson): map status precisely —
  `pass` = mechanism present AND real evidence; `gap` = mechanism present but NO data (honest empty,
  NOT a failure, NEVER inflated to pass); `fail` = mechanism BROKEN. A composed engine returning
  `ok:false` is a BROKEN mechanism → MUST be `fail`, never `gap`. First pass wrongly mapped engine
  `!ok` to gap for readiness/gap/signal — that under-reports breakage. Reserve `gap` strictly for
  ok:true-but-empty. (computeRoleReadinessForSubject never returns ok:false — always ok:true w/ null
  readiness for empty; computeGapAnalysis DOES return ok:false on blueprint_not_found = real fail.)
- Signal engine SHAPE TRAP: `computeCompetencySignalEngine` returns {ok, measured, summary, signals}
  at TOP LEVEL, NOT wrapped under `.data` (unlike the route's wrap()). Reading `s.data.summary`
  throws → mis-reports a working stage as fail. Read `s.summary`/`s.measured` directly.
- Two PERMANENT honest gaps for demo_subj_pm (9 pass / 2 gap / 0 fail): Question Mapping (empty
  onto_competency_question_map, Phase 2.2) and Audit Logs (COVERAGE BOUNDARY — admin audit middleware
  `createAdminAuditMiddleware` mounted ONLY on app.use('/api/admin'), so /api/competency-runtime/*
  mutations are NOT auto-captured; report honestly, do not paper over).
- Route `GET /api/competency-runtime/validation/:subjectId` (gate→requireAuth→requireSuperAdmin,
  wrap .data). Frontend Validation section in `CompetencyRuntimePanel.tsx` fetched in loadDashboard
  Promise.all (null-tolerant → 503 hides section); per-stage cards w/ pass/gap/fail badges + summary.
- Only new cross-import added: `isCompetencyRuntimeEnabled` from config/feature-flags (permissions
  stage reports live flag state). Avoided importing blueprint-builder etc. (circular risk).
