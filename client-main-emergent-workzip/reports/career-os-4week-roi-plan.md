# Career OS — Highest-ROI 4-Week Plan

**Date:** 30 May 2026
**Budget:** ~4 weeks of development effort.
**Hard rules honoured:** No new tabs · No new dashboards · No redesign · No major DB migrations.
**Focus only:** Orchestration · Reuse · Integration · Behavioural Intelligence.
**Source of truth:** `reports/intelligence-waste-report.md` + `reports/career-builder-dependency-map.md` (every item below wires *already-built, already-persisted* architecture — no new compute engines, no new schema).

### Scoring model
- **Impact** — user/product value (Very High / High / Med / Low).
- **Effort** — dev time (Very Low ≈ hours · Low ≈ ½–1 day · Med ≈ 2–4 days).
- **Risk** — blast radius (Very Low = additive read-only render · Low = additive + localStorage · Med = changes user-visible ranking/behaviour).
- **ROI Score = Impact² ÷ (Effort × Risk)**, on internal 1–5 scales (higher = better). Used purely to rank.

> Theme: the platform already **computes and persists** its most valuable behavioural intelligence every session, but collapses it to 5 scalars or never surfaces it. The cheapest wins are *reads*, not new engines.

---

## Top 20 (ranked by ROI)

| Rank | Change | Impact | Effort | Risk | ROI Score |
|---|---|---|---|---|---|
| 1 | **Render `brain.behaviorGraph` (P2, already fetched) in the existing Behavioural Growth tab** — unlock the staged P2 graph (strengths/risks/patterns/growth) that is fetched but currently unread. | High | Very Low | Very Low | 16.0 |
| 2 | **Surface Top-5 Best-Next-Actions (`capadex_intervention_recommendations`) in the existing report + Next Best Actions tab** — data persisted every session, read via existing `getInterventionRecommendations`; 0% surfaced today. | Very High | Low | Very Low | 12.5 |
| 3 | **Surface OMEGA-X growth indicators (longitudinal memory) in Behavioural Growth / Career Memory tabs** — already inside `behaviorGraph.growthIndicators`; pure render. | Med | Very Low | Very Low | 9.0 |
| 4 | **Add a "Why this result" lineage card to the report from `GET /api/capadex/session/:id/explain`** — insight-explainer endpoint exists, read-only, never called by frontend. | Very High | Med | Very Low | 8.3 |
| 5 | **Render persisted behavioural patterns (`capadex_session_patterns`) in the report** — computed every session, only collapsed into scalars today. | High | Low | Very Low | 8.0 |
| 6 | **Feed Behaviour-Graph `risks`/`growthBlockers` into the Next Best Actions tab** (replacing heuristic `coreBottleneck`) — reuse the P2 consumer surface. | High | Low | Very Low | 8.0 |
| 7 | **Map graph `risks` → `brain.riskFactors`** so weekly-plan/next-actions rank on real behavioural risk, not profile gaps alone. | Med | Low | Very Low | 4.5 |
| 8 | **Career Memory tab: feed from `behavioural-memory` snapshots + graph improving/worsening deltas** (already computed by the snapshot diff). | Med | Low | Very Low | 4.5 |
| 9 | **Enrich `behavior.interviewReadiness` (Interview Prep) with graph signals/patterns** — reuse already-loaded brain. | Med | Low | Very Low | 4.5 |
| 10 | **Blend the backend Top-5 recommendations into `weeklyActionEngine`** (currently client heuristics only) — orchestration of two existing producers. | High | Low | Low | 4.0 |
| 11 | **Surface composites (`capadex_session_composites`) inside the §4 explainer card** — piggybacks on the `/explain` payload; near-free once #4 lands. | Low | Very Low | Very Low | 4.0 |
| 12 | **Velocity de-dup cleanup** — standardise on backend `/api/career/velocity/compute`; retire the type-only orphan `learningVelocityEngine` confusion. | Low | Very Low | Very Low | 4.0 |
| 13 | **Visibility tab: feed behavioural signals already in brain** into the recruiter-view estimate (currently eiScore-only). | Low | Very Low | Very Low | 4.0 |
| 14 | **Wire IDP gap roadmap → Learning Hub filtering** — pass `buildIDP()` output as the `COURSE_RECS` filter (missing link; both already exist). | High | Med | Low | 2.7 |
| 15 | **Pass competency dimensions into `recommendFutureRoles(profile, n, behavior)`** so Future Map fitment reflects competency, not just profile (missing link). | High | Med | Med | 1.8 |
| 16 | **Include Top-5 actions + key patterns in the CAPADEX report email** — reuse existing email-preview infra; extend the template only. | Med | Med | Low | 1.5 |
| 17 | **Consume Simulation archetypes (behavioural-memory) in brain/next-actions** — close the Simulation→downstream island. | Med | Med | Med | 1.0 |
| 18 | **Feed graph `competencySignals` into `FitmentInsightsPanel`** for richer job ranking (reuse rankJobsForUser inputs). | Med | Med | Med | 1.0 |
| 19 | **Neutralise the dormant duplicate backbone** — gate/remove the never-initialised `careerEvents` pipeline + unsubscribed `competencyStore`/`idpStore` to end the two-twin ambiguity (clarity + bundle size). | Low | Low | Low | 1.0 |
| 20 | **Backfill behaviour graph on user load when missing** (`buildBehaviorGraphForUser`) so #1/#2/#6 have data more often — additive, best-effort, non-blocking. | Med | Med | Med | 1.0 |

---

## Suggested 4-week sequencing

**Week 1 — "Surface what already exists" (ranks 1–6, all read-only, near-zero risk).**
Unlock P2 graph render, Top-5 actions, growth indicators, `/explain` lineage card, patterns, risk-driven next actions. This alone moves the most differentiating intelligence from 0% → visible.

**Week 2 — "Orchestrate the brain" (ranks 7–13).**
Route graph risks into ranking, wire Career Memory + Interview from existing brain, blend backend Top-5 into the weekly engine, composites in the explainer, velocity/visibility cleanups.

**Week 3 — "Close the missing links" (ranks 14–18).**
IDP→Learning, Competency→Future Map, email enrichment, Simulation→brain, fitment enrichment. These touch user-visible ranking → land with care + before/after checks.

**Week 4 — "Consolidate & harden" (ranks 19–20 + buffer).**
Retire the duplicate backbone, add the non-blocking graph backfill, regression-check all surfaced panels, code review.

---

## Explicitly EXCLUDED (do not spend the 4 weeks here)
- **Writing the dead `career_*` memory tables** (`career_interventions_log`, etc.) — would need schema writers / migration work → violates "no major migrations" and is lower ROI than surfacing existing data.
- **Reviving the predictive/RIE cluster** (`/api/predictions/compute`) — needs verification it's even reachable; uncertain payoff.
- **Initialising the `careerEvents` reactive backbone** — high-risk rewrite of the live imperative path for no user-visible gain; prefer to *retire* it (rank 19), not adopt it.
- **Any new tab, dashboard, redesign, or large migration** — out of scope by rule.

---

## One-line thesis
**Spend the 4 weeks reading, not building.** ~80% of the highest-ROI value is surfacing behavioural intelligence the platform already computes and persists every session — additive renders and small orchestration glue over existing engines, endpoints, and tables.
