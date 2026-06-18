# WC-P3 — 95% Completion Roadmap

> Generated: 2026-06-10T14:15:54.256Z  
> Starting point: 37% structural coverage, 17% activation confidence.  
> Target: 95% structural coverage, ≥60% activation confidence.

---

## Phase 1 — Foundation Repairs (Required before any data activation)

These are blocking issues that must be fixed before confidence can grow:

| # | Task | Dimension | Effort |
|---|------|-----------|--------|
| 1 | Migrate `career-memory.ts` from in-memory Map to DB writes (career_memory_snapshots table) | D07 | Medium |
| 2 | Add snapshot-write trigger on assessment completion / profile update | D07 | Small |
| 3 | Add `user_id` column to `career_recommendations` + bridge CAPADEX session → career profile | D03 | Medium |
| 4 | Set `persist=true` (or add a persisted path) in `growth-plan-bridge.ts` | D04 | Small |
| 5 | Add `requireAuth` to `career-genome.ts`, `career-workforce.ts`, `career-simulations.ts`, `career-success.ts` | All | Small |

---

## Phase 2 — Data Supply (Commercial + Discovery)

| # | Task | Dimension | Effort |
|---|------|-----------|--------|
| 6 | Employer onboarding + job posting flow | D01, D10 | Large |
| 7 | Mentor onboarding + mentor profile creation | D10 | Large |
| 8 | Mentor booking + availability routing | D10 | Medium |
| 9 | Job application pipeline (user → job → employer) | D01 | Medium |
| 10 | Employer-jobs route activation (recruiter-postings.ts → real data) | D01 | Small |

---

## Phase 3 — Intelligence Activation

| # | Task | Dimension | Effort |
|---|------|-----------|--------|
| 11 | Wire career_recommendations to career profile (user_id bridge) | D03 | Medium |
| 12 | Surface PIL intervention library in Career Builder next-actions | D03, D09 | Medium |
| 13 | Activate behavioural memory snapshots → progressLedger → career-memory UI | D07, D09 | Medium |
| 14 | Wire outcome attribution engine to real snapshot history | D06 | Medium |
| 15 | Replace static genome/workforce/success data with DB-backed sources | D01, D09 | Large |

---

## Phase 4 — Enrichment (Coverage 95% target)

| # | Task | Dimension | Effort |
|---|------|-----------|--------|
| 16 | Add career report export (PDF / email) surface for users | D08 | Medium |
| 17 | Expand M3 market data beyond 5 seed roles | D05 | Large |
| 18 | Persist EI scores (create user_employability_scores table) | D02, D08 | Small |
| 19 | IDP engine → DB-backed (career_growth_plan_actions persistence) | D04 | Medium |
| 20 | Competency V2 contextual DNA flag-on (default users) | D02 | Small |

---

## Coverage Projection by Phase

| After Phase | Estimated Coverage | Estimated Confidence |
|-------------|-------------------|---------------------|
| Baseline now | 37% | 17% |
| After Phase 1 (repairs) | ~50% | ~25% |
| After Phase 2 (supply) | ~60% | ~40% |
| After Phase 3 (intelligence) | ~78% | ~55% |
| After Phase 4 (enrichment) | ~93% | ~65% |

> Note: Coverage projections are DIRECTIONAL estimates based on structural gap count,  
> not guaranteed outcomes. Each phase's ceiling depends on preceding phases being complete.

---

## Out-of-Scope for this Roadmap
- CAPADEX engine improvements (covered by WC-P1/P2/P3 series)
- PIL knowledge graph expansion (covered by Phase 8 follow-up task)
- A/B test framework / rollout strategy
- Third-party integrations (LinkedIn, GitHub inference — see §8.2 of docs/CAREER_BUILDER.md)
