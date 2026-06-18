# WC-P3 Career Builder Readiness Audit — Scorecard

> Generated: 2026-06-10T14:15:54.246Z  
> Scope: read-only structural + activation measurement, 10 dimensions, 23 tabs.  
> Coverage = structural element quality (routes + schema + implementation fidelity).  
> Confidence = real user-keyed data activation (separate axis, never merged with Coverage).

---

## Overall Verdict: NO-GO

| Axis | Score |
|------|-------|
| **Structural Coverage** | **37%** |
| **Activation Confidence** | **17%** |

> Interpretation: 37% of the Career Builder's architecture is structurally implemented.  
> Only 17% of dimensions are producing real user-keyed outputs today.  
> **Confidence score method**: gated on real DB row counts; magnitude values are expert-calibrated estimates, not statistically measured. Report as directional, not precise.

---

## Dimension Summary

| # | Dimension | Coverage | Confidence | Verdict |
|---|-----------|----------|------------|---------|
| D01 | Career Discovery | 40% | 20% | STUB |
| D02 | Career Mapping | 75% | 70% | PARTIAL |
| D03 | Career Recommendation | 35% | 15% | PARTIAL |
| D04 | Growth Planning | 30% | 0% | STUB |
| D05 | Career Pathway | 45% | 20% | PARTIAL |
| D06 | Outcome Intelligence | 25% | 0% | STUB |
| D07 | Longitudinal Intelligence | 15% | 0% | EMPTY |
| D08 | Report Intelligence | 35% | 15% | PARTIAL |
| D09 | Personalization | 55% | 25% | PARTIAL |
| D10 | Commercial | 10% | 0% | EMPTY |
| | **AVERAGE** | **37%** | **17%** | |

**Verdict distribution:** READY=0 · PARTIAL=5 · STUB=3 · EMPTY=2

---

## Critical Findings

1. **D07 Longitudinal — in-memory store** `career-memory.ts` uses a server-process `Map<string,Snapshot[]>` — all data lost on every restart. DB tables exist but are never written.
2. **D10 Commercial — zero supply** Mentor (0 rows), job board (0 postings), employer jobs (0) — entire commercial surface is decorative.
3. **D03 Recommendation bridge inactive** `career_recommendations` (24 rows) are CAPADEX session-keyed (no user_id column). A user→session bridge exists in `career-behavior-adapter.ts` but no Career Builder consumer queries recommendations via it; bridge is also data-starved (behavioural_memory=0).
4. **D04 Growth plans never persist** `growth-plan-bridge.ts` calls `persist=false` unconditionally — `m5_career_growth_plans` has 0 rows.
5. **Unauthenticated routes** 12 of 15 audited route files lack `requireAuth`. Key risks: `career-memory.ts` has no auth and accepts userId from query/body (IDOR pattern — low blast radius today, critical before DB migration); `career-stage-guidance.ts` has inline IDOR guard only (no middleware). Static-data routes (`career-genome.ts`, `career-workforce.ts`, `career-success.ts`) have no user data but inconsistent auth surface.
6. **Static data masquerading as intelligence** Future Map, Workforce Intel, Career Success all return hardcoded arrays with no DB reads.

---

## DB State Snapshot

| Status | Count |
|--------|-------|
| Tables checked | 40 |
| Tables in schema (exist) | 31 |
| Tables with data | 18 |
| Empty tables (exist, 0 rows) | 13 |
| Tables missing from schema | 9 |

Total career domain rows: 272

Missing tables: `career_profiles`, `employer_profiles`, `mentorship_sessions`, `career_goal_milestones`, `career_goal_progress`, `career_growth_plan_actions`, `career_learning_milestones`, `employer_talent_pools`, `employer_assessments`
