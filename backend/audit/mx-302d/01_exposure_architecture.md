# MX-302D — Student Career Builder Exposure: Architecture & Provenance Map

_Generated 2026-06-27T04:03:34.328Z · read-only · flag `studentCareerBuilder` currently **OFF**_

MX-302D exposes the **full, existing Career Builder** to students (role `student` /
`campus_student`) as a first-class destination and applies student-appropriate framing on
the **shared** `CareerBuilderPage`. It is **exposure + framing only** — it forks NO engine,
route, page or metric. Students use the SAME recommendation / market / competency /
employability engines as career seekers. Gated by the additive `studentCareerBuilder` flag;
flag-OFF the student dashboard / portal are byte-identical and the Career Builder keeps its
existing career-seeker framing.

## The 10 features → existing surface + engine/route (PROVENANCE, not reimplementation)

| Feature | Reused surface | Served by (existing engine/route) |
|---------|----------------|-----------------------------------|
| Best Fit Roles | `CareerRecommendationsTab.tsx` | GET /api/career/recommendations (career-recommendation engine) |
| Career Paths | `CareerRecommendationsTab.tsx / PathwayExplorerPanel.tsx` | Career Graph (/api/career-graph/*) |
| Alternative Careers | `MarketIntelTab.tsx (Alternative Clusters)` | market intel (/api/career/market-intelligence) |
| Future Skills | `MarketIntelTab.tsx / FutureReadinessTab.tsx` | Hot Competencies (market intel + future-readiness) |
| Industry Comparison | `MarketIntelTab.tsx (Your Skills vs Market)` | market intel (/api/career/market-intelligence) |
| Skill Gap | `CareerIntelligenceHub.tsx / HiringReadinessTab.tsx` | key_gaps (career-gap engine) |
| Learning Roadmap | `GrowthRoadmap.tsx` | DB-tracked IDP items (career-roadmap engine) |
| Salary Insights | `MarketIntelTab.tsx / PromotionPathsPanel.tsx` | Salary P50 (market intel) |
| Career Timeline | `CareerIntelligenceHub.tsx (EI / Growth timeline)` | EI snapshots / longitudinal |
| Promotion Simulation | `PromotionPathsPanel.tsx + What-If Simulator` | career-simulation-engine (/api/career/simulation) |

## Supporting intelligence (same engines, also reused)

| Capability | Reused surface | Served by (existing engine/route) |
|------------|----------------|-----------------------------------|
| Role DNA fit | `CareerIntelligenceHub.tsx Trajectory/Transition` | onto_role_competency_profiles (Switchability %, ETA) |
| Competency Intelligence | `competency-intelligence tab` | GET /api/competency/intelligence/outcomes |
| Employability Engine | `EIGauge / useHybridEI` | employabilityEngine.ts |
| Employability Dashboard | `CareerBuilderPage dashboard / MX-302C Launchpad` | composes existing widgets (reuses MX-302C, no new metric) |

## Exposure wiring (the actual change — no engines)
- **Flag + probe**: `studentCareerBuilder` (default OFF) + un-gated `GET /api/student-career-builder/enabled` (mirrors MX-302A/B/C). No schema, no DDL, no persistence.
- **StudentDashboard**: the "Career Intel" quick-action is repointed to the full `career-builder` (label "Career Builder") ONLY when the flag is ON; OFF → routes to `student-career-portal` exactly as before.
- **CareerBuilderPage**: student-aware framing (Employability-Dashboard eyebrow + copy, "Student" labels) renders ONLY when the flag is ON AND the signed-in user is a student/campus_student. Same page, same tabs, same engines.
- **StudentCareerPage**: its existing `career-builder` CTAs are already live today and are left unchanged (changing them would break byte-identical-OFF).

## Employability Dashboard (step 4 — composition, not a new dashboard)
- The student Employability Dashboard is the EXISTING Career Builder dashboard tab, which under `careerLaunchpad` (MX-302C) renders the 15-widget Launchpad composing EI / skill-gap / Role-DNA / recommendations. MX-302D routes students into it and reframes the header — it does NOT build a competing dashboard.

## Honesty axes (kept separate, never composited)
- Each feature inherits the career-seeker honest empty/degraded states (`null ≠ 0`); where market/salary/future substrate is absent or no LLM key is set, students see the SAME honest degradation career seekers see. No fabricated recommendations.
- Provenance (same-engine) and live adoption (real data flowing) are reported as separate axes.
