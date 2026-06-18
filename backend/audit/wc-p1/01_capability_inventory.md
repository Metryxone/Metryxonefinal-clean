# WC-P1 — D1: Employability Index Capability Inventory

**Date**: 2026-06-10T13:27:06.692Z
**Method**: filesystem verification + DB queries + HTTP probes + source code analysis

---

## Fully Implemented

| Capability | Evidence |
|---|---|
| Frontend EI scoring engine (6-dim) | `employabilityEngine.ts` live; 198 `ei_calculation_logs` |
| EI breakdown modal (8-dim doc formula) | `CareerBuilderPage.tsx` lines 967–1080 |
| `useHybridEI` hook | `useHybridEI.ts` → `POST /api/ei/resolve` (debounced 600ms) |
| EIGauge component | `EIGauge.tsx` rendering in all Career Builder tabs |
| EIProvenanceCard | `EIProvenanceCard.tsx` — "Why this score" breakdown |
| `/api/ei/resolve` route | HTTP 200 (registered, active, writes calc logs) |
| `/api/ei/typeahead/:entity` | HTTP 200 (canonical suggestions) |
| `/api/employability/occupations` | HTTP 200 (returns 30 occupations) |
| `/api/employability/role-fit` | HTTP 500 (route present, real implementation) |
| `/api/employability/role-matches` | HTTP 200 (top-N matcher) |
| `/api/employability/trajectory` | HTTP 401 (forecast engine present) |
| `/api/career/intelligence/employability` | HTTP 200 |
| `/api/career/intelligence/dashboard` | HTTP 200 |
| `/api/career/intelligence/fitment` | HTTP 400 |
| EI Governance admin suite | HTTP 401/401/401 (rulesets/active/calc-logs) |
| EI ruleset + dimension rules | `ei_rulesets`: 1 row(s); `ei_dimension_rules`: 8 rows |
| EI confidence model | `ei_confidence_models`: 1 row(s) |
| Career seeker profiles persistence | `career_seeker_profiles`: 2 rows |
| EI Passport routes (flag-gated) | Registered; passportEnabled=false |
| Admin ruleset CRUD + preview + compare | Routes registered and real |
| `ei-resolver` (exact→alias→fuzzy) | Real implementation; pushes unresolved to review queue |
| `role-fit-engine` | Real implementation (skill-match, missing-skills, recommendations) |
| `trajectory-engine` | Real implementation (milestone scheduling against pathways) |

---

## Partially Implemented

| Capability | Gap |
|---|---|
| Competency Assessment → EI score | Assessment score IS in 8-dim modal breakdown (25pts) but ABSENT from `useHybridEI` 6-dim gauge score — two divergent numbers exist simultaneously |
| Education dimension | Documented as 15pts; present in modal breakdown; ABSENT from `useHybridEI` engine and DB ruleset |
| EI Passport snapshot | Routes live; 0 active snapshots; flag ❌ disabled |
| Fitment panel | `FitmentInsightsPanel.tsx` exists; marked "Provisional (n<30)" |
| Reference resolver | Fuzzy matching code real; only 67 institutions, 26 qualifications, 90 skills loaded vs thousands planned |
| Personalization | Behavioral nudges coded; band labels diverge across 3 schemas |

---

## Missing / Stub / Not Built

| Capability | Status |
|---|---|
| Longitudinal EI snapshots | Table exists; **0 rows ever written**; no cron/scheduler |
| Education tier-weighted scoring in gauge | Phase 1/2 planned (NIRF/UGC ref tables not seeded) |
| Verified credentials (+50% trust multiplier) | Phase 4 planned (Credly/DigiLocker not integrated) |
| Server-side institution/skill reference data | 67 institutions loaded vs NIRF Top 200 + WHED 19,400 planned |
| Company prestige overlay | Phase 5 (Future) |
| k-anonymity peer benchmarking data | Percentile uses hardcoded lookup table, not real cohort data |
| Nightly snapshot cron | Documented as planned; not implemented |
| LBI/SDI sessions | 0 rows; no EI feed path |
| Commercial gating of EI features | No subscription mapping |
