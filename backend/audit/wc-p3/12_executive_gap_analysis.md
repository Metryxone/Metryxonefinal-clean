# WC-P3 — Executive Gap Analysis

> Generated: 2026-06-10T14:15:54.255Z  
> Career Builder structural coverage: **37%** | Activation confidence: **17%**  
> Verdict: **NO-GO**

---

## Tier 1 — Critical Gaps (EMPTY / STUB dimensions)

These gaps make entire product areas non-functional today:

- **[D01]** job_postings: 0 rows — entire job board inoperable
- **[D01]** employer_jobs: 0 rows — recruiter-postings returns empty
- **[D01]** Fitment engine (FitmentInsightsPanel) active but nothing to rank against
- **[D01]** No employer onboarding / posting flow
- **[D04]** m5_career_growth_plans: 0 rows — growth-plan-bridge always calls persist=false
- **[D04]** No persistence trigger in any career builder flow to write growth plans
- **[D04]** IDP engine (Development Plan tab) is a frontend heuristic, not DB-backed
- **[D04]** pil_growth_pathways (110) is a PIL catalog — not user growth plans
- **[D04]** No career-growth-plan CRUD route for users
- **[D06]** outcomeAttributionEngine needs ≥2 snapshots — currently 0 for all users
- **[D06]** career_interventions_log: 0 rows — no intervention tracking
- **[D06]** No outcome realization tracking (action → metric movement unverified)
- **[D06]** Stage guidance works but no outcome feedback loop
- **[D06]** Outcome model tables empty (no user-specific outcome data)
- **[D07]** CRITICAL: career-memory.ts uses in-memory Map — data lost on every server restart
- **[D07]** career_memory_snapshots: 0 rows (DB table exists but is never written)
- **[D07]** progressLedger requires ≥2 DB snapshots — currently 0 for all users
- **[D07]** career_trajectory_history: 0 rows
- **[D07]** career_benchmarks_history: 0 rows
- **[D07]** career_growth_patterns: 0 rows
- **[D07]** No snapshot-write trigger anywhere in career builder flows
- **[D10]** mentors: 0 rows — mentor marketplace is decorative
- **[D10]** job_postings: 0 rows — no job board supply side
- **[D10]** No mentor booking / payment route
- **[D10]** No employer onboarding / posting workflow
- **[D10]** No career builder subscription tier
- **[D10]** Recruiter-postings route stub (employer_jobs empty)

---

## Tier 2 — High-Priority Gaps (PARTIAL, low confidence)

These areas have structural scaffolding but produce no real user-keyed outputs:

- **[D03]** career_recommendations keyed on session_id not user_id — no Career Builder consumer queries it by user
- **[D03]** Resolution bridge (behavior-adapter user_id→session_id) exists but inactive: behavioural_memory=0 rows
- **[D08]** No dedicated career report surface for end users
- **[D08]** Stage guidance route lacks requireAuth middleware (IDOR guard is inline only)

---

## Tier 3 — Infrastructure Gaps

| Gap | Impact |
|-----|--------|
| `career-memory.ts` in-memory store | All career memory lost on server restart |
| 5 routes missing `requireAuth` | Inconsistent auth surface; static data exposed unauthenticated |
| `growth-plan-bridge.ts` never persists | No user growth plans ever created |
| `career_recommendations` missing `user_id` | Career recs unqueryable from Career Builder context |
| EI table `user_employability_scores` does not exist | EI computed at query time only, no persistence |

---

## Dimension Health Table

| Dimension | Coverage | Confidence | Blocker |
|-----------|----------|------------|---------|
| Career Discovery | 40% | 20% | job_postings: 0 rows — entire job board inoperable |
| Career Mapping | 75% | 70% | career_seeker_profiles: only 2 rows (2 users have career profile) |
| Career Recommendation | 35% | 15% | career_recommendations keyed on session_id not user_id — no Career Builder consumer queries it by user |
| Growth Planning | 30% | 0% | m5_career_growth_plans: 0 rows — growth-plan-bridge always calls persist=false |
| Career Pathway | 45% | 20% | m3_career_paths: 3 rows (seed data only, not user-personalized) |
| Outcome Intelligence | 25% | 0% | outcomeAttributionEngine needs ≥2 snapshots — currently 0 for all users |
| Longitudinal Intelligence | 15% | 0% | CRITICAL: career-memory.ts uses in-memory Map — data lost on every server restart |
| Report Intelligence | 35% | 15% | No dedicated career report surface for end users |
| Personalization | 55% | 25% | behavior graph empty → behavior-based personalization degraded for all users |
| Commercial | 10% | 0% | mentors: 0 rows — mentor marketplace is decorative |

---

## Key Honesty Flags

- **career_recommendations (24 rows)**: These are CAPADEX session-scoped recs. They are NOT accessible via Career Builder user queries (no user_id column). The 24 rows represent **1 CAPADEX user session**, not career recommendations for career builder users.
- **pil_growth_pathways (110 rows)**: This is a PIL curation catalog, not user growth plan instances.
- **wos_market_signals (54 rows)**: Real signal data; small dataset, not personalized per user.
- **Static routes are NOT intelligence**: Future Map, Workforce Intel, and Career Success return hardcoded arrays. They look like AI/data products but are compiled constants.
- **Career OS (useCareerBrain) degrades to near-empty**: With 0 behavioural_memory rows and 0 career_memory_snapshots, all four Career OS pillars (Constraint Engine, Action Engine, Progress Ledger, Outcome Attribution) return null / [] / heuristic-only output.
