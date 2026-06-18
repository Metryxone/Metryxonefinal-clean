# WC-P3 D00 — Career Builder Capability Inventory

> Generated: 2026-06-10T14:15:54.247Z

## DB Table State (40 tables)

| Table | Status |
|-------|--------|
| `career_seeker_profiles` | ✓ 2 rows |
| `career_profiles` | ⚠ MISSING |
| `job_postings` | ○ EMPTY |
| `job_applications` | ○ EMPTY |
| `employer_jobs` | ○ EMPTY |
| `employer_profiles` | ⚠ MISSING |
| `mentors` | ○ EMPTY |
| `mentor_profiles` | ○ EMPTY |
| `mentorship_sessions` | ⚠ MISSING |
| `career_seeker_goals` | ○ EMPTY |
| `career_goal_milestones` | ⚠ MISSING |
| `career_goal_progress` | ⚠ MISSING |
| `m5_career_growth_plans` | ○ EMPTY |
| `career_growth_plan_actions` | ⚠ MISSING |
| `behavioural_memory` | ○ EMPTY |
| `career_interventions_log` | ○ EMPTY |
| `career_trajectory_history` | ○ EMPTY |
| `career_benchmarks_history` | ○ EMPTY |
| `career_memory_snapshots` | ○ EMPTY |
| `career_growth_patterns` | ○ EMPTY |
| `career_learning_milestones` | ⚠ MISSING |
| `user_competency_scores` | ✓ 16 rows |
| `user_assessment_snapshots` | ✓ 2 rows |
| `m3_market_roles` | ✓ 5 rows |
| `m3_market_competencies` | ✓ 10 rows |
| `m3_market_role_aliases` | ✓ 10 rows |
| `m3_market_velocity_scores` | ✓ 5 rows |
| `m3_role_market_scores` | ✓ 5 rows |
| `m3_competency_market_scores` | ✓ 7 rows |
| `m3_career_paths` | ✓ 3 rows |
| `mobility_career_paths` | ✓ 3 rows |
| `mobility_development_pathways` | ✓ 5 rows |
| `occupation_pathways` | ✓ 3 rows |
| `pil_growth_pathways` | ✓ 110 rows |
| `career_recommendations` | ✓ 24 rows |
| `wos_market_signals` | ✓ 54 rows |
| `wos_v2_market_forecasts` | ✓ 3 rows |
| `market_demand_models` | ✓ 5 rows |
| `employer_talent_pools` | ⚠ MISSING |
| `employer_assessments` | ⚠ MISSING |

## Route File Analysis

| File | requireAuth | Data Source | Notes |
|------|-------------|-------------|-------|
| `career-genome.ts` | ✗ | STATIC | ALL_STATIC_DATA; NO_AUTH_GUARD; |
| `career-workforce.ts` | ✗ | STATIC | ALL_STATIC_DATA; NO_AUTH_GUARD; |
| `career-simulations.ts` | ✗ | IN_MEM | IN_MEMORY_STORE; NO_AUTH_GUARD; |
| `career-success.ts` | ✗ | STATIC | ALL_STATIC_DATA; NO_AUTH_GUARD; |
| `career-memory.ts` | ✗ | IN_MEM | IN_MEMORY_STORE; NO_AUTH_GUARD; |
| `career-velocity.ts` | ✗ | HEURISTIC | NO_AUTH_GUARD; HEURISTIC_ONLY; |
| `career-trajectory.ts` | ✗ | HEURISTIC | NO_AUTH_GUARD; HEURISTIC_ONLY; |
| `career-profile.ts` | ✗ | IN_MEM | IN_MEMORY_STORE; NO_AUTH_GUARD; |
| `career-stage-guidance.ts` | ✗ | HEURISTIC | NO_AUTH_GUARD; HEURISTIC_ONLY; |
| `career-seeker.ts` | ✓ | HEURISTIC | HEURISTIC_ONLY; |
| `behavioural-memory.ts` | ✓ | DB | OK |
| `m3-market-intelligence.ts` | ✗ | DB | NO_AUTH_GUARD; |
| `career-benchmark.ts` | ✗ | HEURISTIC | NO_AUTH_GUARD; HEURISTIC_ONLY; |
| `career-intelligence.ts` | ✗ | HEURISTIC | NO_AUTH_GUARD; HEURISTIC_ONLY; |
| `recruiter-postings.ts` | ✓ | DB | OK |

## Auth Surface Issues

**Routes missing `requireAuth` middleware (12 files):**
- `career-genome.ts` — ALL_STATIC_DATA; NO_AUTH_GUARD;
- `career-workforce.ts` — ALL_STATIC_DATA; NO_AUTH_GUARD;
- `career-simulations.ts` — IN_MEMORY_STORE; NO_AUTH_GUARD;
- `career-success.ts` — ALL_STATIC_DATA; NO_AUTH_GUARD;
- `career-memory.ts` — IN_MEMORY_STORE; NO_AUTH_GUARD;
- `career-velocity.ts` — NO_AUTH_GUARD; HEURISTIC_ONLY;
- `career-trajectory.ts` — NO_AUTH_GUARD; HEURISTIC_ONLY;
- `career-profile.ts` — IN_MEMORY_STORE; NO_AUTH_GUARD;
- `career-stage-guidance.ts` — NO_AUTH_GUARD; HEURISTIC_ONLY;
- `m3-market-intelligence.ts` — NO_AUTH_GUARD;
- `career-benchmark.ts` — NO_AUTH_GUARD; HEURISTIC_ONLY;
- `career-intelligence.ts` — NO_AUTH_GUARD; HEURISTIC_ONLY;

**Routes with static hardcoded data (3 files):**
- `career-genome.ts`
- `career-workforce.ts`
- `career-success.ts`

**Routes with in-memory stores (3 files):**
- `career-simulations.ts` — data resets on server restart
- `career-memory.ts` — data resets on server restart
- `career-profile.ts` — data resets on server restart

## Tab Readiness Matrix (23 tabs)

| Tab ID | Label | Backend | Auth | Data State | Notes |
|--------|-------|---------|------|------------|-------|
| `dashboard` | Dashboard | REAL | ✓ | EI+competency scores real | EI gauge + career stats functional |
| `profile` | My Profile | REAL | ✓ | 2 profiles in DB | CRUD real; 2 profiles; 0 passports |
| `skills` | Skills Lab | PARTIAL | ✓ | 16 comp scores | Competency-backed; V2 behind flag |
| `resume` | Resume Studio | REAL | ✓ | CV CRUD real | ResumeStudio pure + CV routes real |
| `assessment` | Competency Assessment | REAL | ✓ | 16 users assessed | Full runtime V2 operational |
| `jobs` | Job Tracker | PARTIAL | ✓ | 0 job_postings, 0 employer_jobs | Routes real; job board supply=0 |
| `interview` | Interview Prep | STATIC | ✓ | Static catalog (interview-questions.ts) | No DB; static question bank only |
| `learning` | Learning Hub | STATIC | ✓ | Static courses catalog | courses.ts catalog; no DB |
| `pathways` | Career Pathways | PARTIAL | ✓ | 3 m3_career_paths (seed) | M3 routes real; thin seed data |
| `mentors` | Mentor Connect | EMPTY | ✓ | 0 mentors in DB | UI tab exists; 0 mentor rows |
| `goals` | Goals | PARTIAL | ✓ | career_seeker_goals: 0 rows | Routes real; no user goals yet |
| `development` | Development Plan | PARTIAL | ✓ | 0 growth plans (0) | IDP engine heuristic; M5 bridge never persists |
| `future-map` | Future Map | STATIC | ✗ MISSING | career-genome.ts ALL hardcoded | NO requireAuth; pure static GENOME constants |
| `simulations` | AI Simulations | PARTIAL | ✗ MISSING | Simulation logic exists | NO requireAuth on simulation routes |
| `market-intel` | Market Intelligence | PARTIAL | ✓ | 54 wos_signals; 5 m3 roles | M3 routes real; minimal seed |
| `velocity` | Career Velocity | PARTIAL | ✗ MISSING | learningVelocityEngine heuristic | NO requireAuth on velocity routes |
| `workforce` | Workforce Intel | STATIC | ✗ MISSING | career-workforce.ts ALL hardcoded | NO requireAuth; pure static constants |
| `visibility` | Recruiter Visibility | PARTIAL | ✓ | visibilityEngine heuristic | Heuristic scoring over profile data |
| `fresher-hub` | Fresher Hub | PARTIAL | ✓ | Fresher-specific static content | Static/heuristic; no dedicated DB |
| `weekly-plan` | This Week's Plan | PARTIAL | ✓ | weeklyActionEngine heuristic | Pure heuristic; no DB backing |
| `next-actions` | Next Best Actions | PARTIAL | ✓ | 0 behavioural_memory rows (0) | Route real; returns [] (no data) |
| `behavioral-growth` | Behavioural Growth | PARTIAL | ✓ | 0 behaviour dims (0) | Behavior adapter real; graph empty |
| `career-memory` | Career Memory | IN_MEMORY | ✓ | 0 DB snapshots (0) | career-memory.ts uses in-memory Map; resets on restart |

**Tab backend distribution:**
- REAL: 4
- PARTIAL: 13
- STATIC: 4
- IN_MEMORY: 1
- EMPTY: 1
